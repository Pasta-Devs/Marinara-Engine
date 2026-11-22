// ──────────────────────────────────────────────
// Importer: SillyTavern Bulk Import (folder scan)
// ──────────────────────────────────────────────
import { readdir, readFile, stat, copyFile, mkdir } from "fs/promises";
import { join, extname, basename, relative } from "path";
import { existsSync, readdirSync } from "fs";
import { createHash, randomUUID } from "crypto";
import { inflateSync } from "node:zlib";
import type { DB } from "../../db/connection.js";
import {
  convertStRegexScripts,
  getExistingCharacterTagKeys,
  importSTCharacter,
  type STCharacterTagImportMode,
} from "./st-character.importer.js";
import {
  buildPersonaLookup,
  importSTChat,
  personaLookupKey,
  stChatFileFingerprint,
  stChatNameFromFileName,
  type STChatImportNote,
} from "./st-chat.importer.js";
import { importSTPreset, type STPresetLeftOut, type STPresetWorldInfo } from "./st-prompt.importer.js";
import { importSTLorebook } from "./st-lorebook.importer.js";
import { createRegexScriptsStorage } from "../storage/regex-scripts.storage.js";
import { characters as charactersTable, chats as chatsTable } from "../../db/schema/index.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";
import { getFileTimestampOverrides, parseTrustedTimestamp } from "./import-timestamps.js";
import { normalizeTextForMatch, withImportTags, type ImportTagOptions } from "@marinara-engine/shared";

const BG_DIR = join(DATA_DIR, "backgrounds");
/**
 * A bulk import writes thousands of chats and reads none of them back, yet each one it writes stays
 * in memory. A big SillyTavern library (3000 chats) ran a 2 GB Node heap out of memory, so every
 * few chats the import flushes and lets all but the most recent ones go back to disk.
 */
const IMPORT_TRIM_EVERY_CHATS = 25;
const IMPORT_RESIDENT_CHATS = 16;
const BG_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

// ─── Helpers ───

const CHARA_KEYWORDS = new Set(["ccv3", "chara"]);

/** Read PNG tEXt/zTXt/iTXt chunks with keyword "ccv3" or "chara" → base64 JSON. Prefers ccv3 (V3). */
function extractCharaFromPng(buf: Buffer): Record<string, unknown> | null {
  // PNG signature: 8 bytes
  if (buf.length < 8) return null;
  const found = new Map<string, Record<string, unknown>>();
  let offset = 8; // skip signature

  while (offset < buf.length - 8) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const payload = buf.subarray(offset + 8, offset + 8 + length);

    if (type === "tEXt") {
      const nullIdx = payload.indexOf(0);
      if (nullIdx >= 0) {
        const keyword = payload.subarray(0, nullIdx).toString("ascii");
        if (CHARA_KEYWORDS.has(keyword) && !found.has(keyword)) {
          const b64 = payload.subarray(nullIdx + 1).toString("ascii");
          try {
            const json = Buffer.from(b64, "base64").toString("utf-8");
            found.set(keyword, JSON.parse(json));
          } catch {
            /* skip malformed */
          }
        }
      }
    } else if (type === "zTXt") {
      // zTXt: keyword\0 compressionMethod(1 byte, 0 = zlib deflate) compressedText.
      // Character Tavern cards store their chara/ccv3 payloads this way.
      const nullIdx = payload.indexOf(0);
      if (nullIdx >= 0) {
        const keyword = payload.subarray(0, nullIdx).toString("ascii");
        if (CHARA_KEYWORDS.has(keyword) && !found.has(keyword) && payload[nullIdx + 1] === 0) {
          try {
            const text = inflateSync(payload.subarray(nullIdx + 2), { maxOutputLength: 4 * 1024 * 1024 }).toString(
              "utf-8",
            );
            try {
              found.set(keyword, JSON.parse(text));
            } catch {
              found.set(keyword, JSON.parse(Buffer.from(text, "base64").toString("utf-8")));
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } else if (type === "iTXt") {
      const nullIdx = payload.indexOf(0);
      if (nullIdx >= 0) {
        const keyword = payload.subarray(0, nullIdx).toString("ascii");
        if (CHARA_KEYWORDS.has(keyword) && !found.has(keyword)) {
          const compressionFlag = payload[nullIdx + 1];
          const langEnd = payload.indexOf(0, nullIdx + 3);
          if (langEnd >= 0) {
            const transEnd = payload.indexOf(0, langEnd + 1);
            if (transEnd >= 0 && compressionFlag === 0) {
              const text = payload.subarray(transEnd + 1).toString("utf-8");
              try {
                found.set(keyword, JSON.parse(text));
              } catch {
                try {
                  const decoded = Buffer.from(text, "base64").toString("utf-8");
                  found.set(keyword, JSON.parse(decoded));
                } catch {
                  /* skip */
                }
              }
            }
          }
        }
      }
    }

    // Move past length(4) + type(4) + data(length) + crc(4)
    offset += 12 + length;
    if (type === "IEND") break;
  }

  return found.get("ccv3") ?? found.get("chara") ?? null;
}

/** Try multiple possible ST data folder layouts */
function resolveSTDataDir(rootPath: string): string | null {
  // 1. Check data/default-user (most common)
  const defaultUser = join(rootPath, "data", "default-user");
  if (existsSync(join(defaultUser, "characters"))) return defaultUser;

  // 2. Check ALL user profile folders under data/ (ST allows custom profile names)
  const dataParent = join(rootPath, "data");
  if (existsSync(dataParent)) {
    try {
      const entries = readdirSync(dataParent, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const candidate = join(dataParent, e.name);
        if (existsSync(join(candidate, "characters"))) return candidate;
      }
    } catch {
      // skip if unreadable
    }
  }

  // 3. Legacy / alternative layouts
  if (existsSync(join(rootPath, "public", "characters"))) return join(rootPath, "public");
  if (existsSync(join(rootPath, "characters"))) return rootPath;

  return null;
}

async function listFiles(dir: string, ext?: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && (!ext || extname(e.name).toLowerCase() === ext))
    .map((e) => join(dir, e.name));
}

async function listFilesRecursive(dir: string, ext?: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...(await listFilesRecursive(full, ext)));
    } else if (!ext || extname(e.name).toLowerCase() === ext) {
      results.push(full);
    }
  }
  return results;
}

function makeScanItemId(category: string, dataDir: string, filePath: string) {
  return `${category}:${relative(dataDir, filePath).replace(/\\/g, "/")}`;
}

function isPlaceholderChatName(value: unknown) {
  if (typeof value !== "string") return true;
  const name = value.trim().toLowerCase();
  return !name || name === "unused" || name === "new chat";
}

/** A folder chat's name: the file's, unless the file name is a placeholder ("New Chat", "unused"). */
function folderChatName(fileName: string, characterName: string) {
  const name = stChatNameFromFileName(fileName);
  return name && !isPlaceholderChatName(name) ? name : characterName;
}

function isConfidentBuiltinPreset(filePath: string) {
  const name = basename(filePath, extname(filePath)).trim().toLowerCase();
  return new Set([
    "default",
    "deterministic",
    "neutral",
    "universal-creative",
    "universal-light",
    "universal-super-creative",
  ]).has(name);
}

// ─── Scan ───

interface STBulkScanItemBase {
  id: string;
  path: string;
  name: string;
  modifiedAt: string | null;
}

export interface STBulkScanResult {
  success: boolean;
  error?: string;
  dataDir?: string;
  characters: Array<STBulkScanItemBase & { format: string }>;
  chats: Array<STBulkScanItemBase & { characterName: string; folderName: string; chatName: string }>;
  groupChats: Array<STBulkScanItemBase & { groupName: string; members: string[]; activationStrategy?: number | null }>;
  /** samplersOnly: a Text Completion preset ("TextGen Settings"), which holds samplers and no prompts. */
  presets: Array<STBulkScanItemBase & { isBuiltin?: boolean; samplersOnly?: boolean }>;
  lorebooks: STBulkScanItemBase[];
  backgrounds: STBulkScanItemBase[];
  personas: Array<STBulkScanItemBase & { description: string }>;
  /** Global regex scripts from settings.json (extension_settings.regex); index is the script's place there. */
  regexScripts?: Array<STBulkScanItemBase & { index: number }>;
  /** What the folder holds that Marinara has no matching feature for, counted so the import can say so. */
  notBroughtOver?: STNotBroughtOver;
}

export interface STNotBroughtOver {
  quickReplies: number;
  instruct: number;
  context: number;
  systemPrompts: number;
}

export async function scanSTFolder(rootPath: string): Promise<STBulkScanResult> {
  // Validate
  if (!existsSync(rootPath)) {
    return {
      success: false,
      error: "Folder does not exist",
      characters: [],
      chats: [],
      groupChats: [],
      presets: [],
      lorebooks: [],
      backgrounds: [],
      personas: [],
    };
  }

  const dataDir = resolveSTDataDir(rootPath);
  if (!dataDir) {
    return {
      success: false,
      error:
        "Could not find SillyTavern data directory. Make sure the path points to your SillyTavern installation folder.",
      characters: [],
      chats: [],
      groupChats: [],
      presets: [],
      lorebooks: [],
      backgrounds: [],
      personas: [],
    };
  }

  const characters: STBulkScanResult["characters"] = [];
  const chats: STBulkScanResult["chats"] = [];
  const groupChats: STBulkScanResult["groupChats"] = [];
  const presets: STBulkScanResult["presets"] = [];
  const lorebooks: STBulkScanResult["lorebooks"] = [];
  const backgrounds: STBulkScanResult["backgrounds"] = [];
  const personas: STBulkScanResult["personas"] = [];

  // 1. Characters — JSON and PNG files in characters/
  const charDir = join(dataDir, "characters");
  if (existsSync(charDir)) {
    const entries = await readdir(charDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      const fullPath = join(charDir, e.name);

      if (ext === ".json") {
        try {
          const raw = JSON.parse(await readFile(fullPath, "utf-8"));
          const name = raw?.data?.name ?? raw?.char_name ?? raw?.name ?? basename(e.name, ".json");
          const fileInfo = await stat(fullPath);
          characters.push({
            id: makeScanItemId("characters", dataDir, fullPath),
            path: fullPath,
            name: String(name),
            format: "json",
            modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
          });
        } catch {
          // skip
        }
      } else if (ext === ".png") {
        try {
          const buf = await readFile(fullPath);
          const card = extractCharaFromPng(buf);
          if (card) {
            const d = card.data as Record<string, unknown> | undefined;
            const name = d?.name ?? card.char_name ?? card.name ?? basename(e.name, ".png");
            const fileInfo = await stat(fullPath);
            characters.push({
              id: makeScanItemId("characters", dataDir, fullPath),
              path: fullPath,
              name: String(name),
              format: "png",
              modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
            });
          }
        } catch {
          // skip
        }
      }
    }
  }

  // 2. Chats — JSONL files in chats/<character_name>/ subfolders
  const chatsDir = join(dataDir, "chats");
  if (existsSync(chatsDir)) {
    const jsonlFiles = await listFilesRecursive(chatsDir, ".jsonl");
    for (const f of jsonlFiles) {
      try {
        const content = await readFile(f, "utf-8");
        const firstLine = content.split("\n")[0];
        if (firstLine) {
          const header = JSON.parse(firstLine);
          const fileBaseName = basename(f, ".jsonl");
          const folderName = basename(join(f, ".."));
          const charName = isPlaceholderChatName(header.character_name) ? folderName : String(header.character_name);
          const fileInfo = await stat(f);
          chats.push({
            id: makeScanItemId("chats", dataDir, f),
            path: f,
            name: fileBaseName,
            chatName: fileBaseName,
            characterName: String(charName),
            folderName,
            modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
          });
        }
      } catch {
        // skip
      }
    }
  }

  // 3. Presets — JSON files in TextGen Settings/ and OpenAI Settings/
  for (const folder of ["TextGen Settings", "OpenAI Settings", "textgen settings", "openai settings"]) {
    const presetDir = join(dataDir, folder);
    const samplersOnly = folder.toLowerCase() === "textgen settings";
    const files = await listFiles(presetDir, ".json");
    for (const f of files) {
      try {
        const raw = JSON.parse(await readFile(f, "utf-8"));
        const name = raw.name ?? basename(f, ".json");
        const fileInfo = await stat(f);
        presets.push({
          id: makeScanItemId("presets", dataDir, f),
          path: f,
          name: String(name),
          modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
          ...(isConfidentBuiltinPreset(f) ? { isBuiltin: true } : {}),
          ...(samplersOnly ? { samplersOnly: true } : {}),
        });
      } catch {
        // skip
      }
    }
  }

  // 4. Lorebooks / World Info — JSON files in worlds/
  const worldsDir = join(dataDir, "worlds");
  if (existsSync(worldsDir)) {
    const files = await listFiles(worldsDir, ".json");
    for (const f of files) {
      try {
        const raw = JSON.parse(await readFile(f, "utf-8"));
        const name = raw.name ?? basename(f, ".json");
        const fileInfo = await stat(f);
        lorebooks.push({
          id: makeScanItemId("lorebooks", dataDir, f),
          path: f,
          name: String(name),
          modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
        });
      } catch {
        // skip
      }
    }
  }

  // 5. Backgrounds — image files in backgrounds/
  for (const folder of ["backgrounds", "Backgrounds"]) {
    const bgDir = join(dataDir, folder);
    if (!existsSync(bgDir)) continue;
    const entries = await readdir(bgDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      if (BG_EXTS.has(ext)) {
        const fullPath = join(bgDir, e.name);
        const fileInfo = await stat(fullPath);
        backgrounds.push({
          id: makeScanItemId("backgrounds", dataDir, fullPath),
          path: fullPath,
          name: e.name,
          modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
        });
      }
    }
    break; // only use the first matching folder
  }

  // 6. Group chats — groups/ (metadata) + group chats/ (JSONL files)
  const groupsDir = join(dataDir, "groups");
  const groupChatsDir = join(dataDir, "group chats");
  if (existsSync(groupsDir)) {
    // SillyTavern stores group chats as flat `<chatId>.jsonl` files and
    // associates them through each group's `chats` array.
    const groupMetaMap = new Map<string, { name: string; members: string[]; activationStrategy: number | null }>();
    const groupFiles = await listFiles(groupsDir, ".json");
    for (const f of groupFiles) {
      try {
        const raw = JSON.parse(await readFile(f, "utf-8"));
        const gId = raw.id ?? basename(f, extname(f));
        const gName = raw.name ?? "Unnamed Group";
        // Members can be an array of filenames (e.g. "char.png") or character names
        const members = Array.isArray(raw.members)
          ? raw.members
              .filter((member: unknown): member is string => typeof member === "string")
              .map((member: string) => member.replace(/\.(png|json)$/i, ""))
          : [];
        // 0 natural, 1 list, 2 manual, 3 pooled: who answers next in SillyTavern.
        const activationStrategy = typeof raw.activation_strategy === "number" ? raw.activation_strategy : null;
        const metadata = { name: String(gName), members, activationStrategy };
        const chatIds = new Set<unknown>([gId, raw.chat_id, ...(Array.isArray(raw.chats) ? raw.chats : [])]);
        for (const chatId of chatIds) {
          if ((typeof chatId === "string" || typeof chatId === "number") && String(chatId).trim()) {
            groupMetaMap.set(String(chatId), metadata);
          }
        }
      } catch {
        // skip
      }
    }

    // Scan group chat JSONL files
    if (existsSync(groupChatsDir)) {
      const gcEntries = await readdir(groupChatsDir, { withFileTypes: true });
      for (const e of gcEntries) {
        if (e.isFile() && extname(e.name).toLowerCase() === ".jsonl") {
          const meta = groupMetaMap.get(basename(e.name, extname(e.name)));
          if (!meta) continue;
          const f = join(groupChatsDir, e.name);
          groupChats.push({
            id: makeScanItemId("groupChats", dataDir, f),
            path: f,
            name: meta.name,
            groupName: meta.name,
            members: meta.members,
            activationStrategy: meta.activationStrategy,
            modifiedAt: null,
          });
          continue;
        }
        if (!e.isDirectory()) continue;
        const groupId = e.name;
        const meta = groupMetaMap.get(groupId);
        if (!meta) continue;

        const gcFolder = join(groupChatsDir, groupId);
        const jsonlFiles = await listFiles(gcFolder, ".jsonl");
        for (const f of jsonlFiles) {
          const fileInfo = await stat(f);
          groupChats.push({
            id: makeScanItemId("groupChats", dataDir, f),
            path: f,
            name: meta.name,
            groupName: meta.name,
            members: meta.members,
            activationStrategy: meta.activationStrategy,
            modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
          });
        }
      }
    }
  }

  // 7. User Personas — PNG/JPG files in User Avatars/
  // SillyTavern stores persona display names in power_user.personas
  // and descriptions in power_user.persona_descriptions within settings.json
  let stPersonaNames: Record<string, string> = {};
  let stPersonaDescs: Record<string, { description?: string } | string> = {};
  const regexScripts: NonNullable<STBulkScanResult["regexScripts"]> = [];
  const settingsPath = join(dataDir, "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      stPersonaNames = settings?.power_user?.personas ?? {};
      stPersonaDescs = settings?.power_user?.persona_descriptions ?? {};
      // 8. Global regex scripts (SillyTavern's Regex extension, "Global scripts").
      const globalRegex = readSettingsRegexScripts(settings);
      const modifiedAt = parseTrustedTimestamp((await stat(settingsPath)).mtime);
      for (const [index, script] of globalRegex.entries()) {
        if (!script || typeof script !== "object") continue;
        const name = (script as Record<string, unknown>).scriptName;
        const findRegex = (script as Record<string, unknown>).findRegex;
        // The id names the script, not only its place, so a pick still means the same script if the list moved.
        const fingerprint = createHash("sha1")
          .update(`${typeof name === "string" ? name : ""}\u0000${typeof findRegex === "string" ? findRegex : ""}`)
          .digest("hex")
          .slice(0, 12);
        regexScripts.push({
          id: makeScanItemId("regexScripts", dataDir, `${settingsPath}#${index}:${fingerprint}`),
          path: settingsPath,
          name: typeof name === "string" && name.trim() ? name.trim() : `Regex ${index + 1}`,
          index,
          modifiedAt,
        });
      }
    } catch {
      // skip – import avatars with filename-based names
    }
  }

  const PERSONA_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  for (const folder of ["User Avatars", "user avatars"]) {
    const avatarDir = join(dataDir, folder);
    if (!existsSync(avatarDir)) continue;
    const entries = await readdir(avatarDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      if (PERSONA_EXTS.has(ext)) {
        // Use display name from settings, fall back to filename without extension
        const fallbackName = basename(e.name, ext);
        const displayName = stPersonaNames[e.name] ?? fallbackName;
        // Get description from settings
        const descEntry = stPersonaDescs[e.name];
        const description = typeof descEntry === "string" ? descEntry : (descEntry?.description ?? "");
        const fullPath = join(avatarDir, e.name);
        const fileInfo = await stat(fullPath);
        personas.push({
          id: makeScanItemId("personas", dataDir, fullPath),
          path: fullPath,
          name: displayName,
          description,
          modifiedAt: parseTrustedTimestamp(fileInfo.mtime),
        });
      }
    }
    break;
  }

  // 9. What has no matching feature here: counted, so the import can name it instead of staying quiet.
  const countJson = async (...folders: string[]) => {
    for (const folder of folders) {
      const dir = join(dataDir, folder);
      if (existsSync(dir)) return (await listFiles(dir, ".json")).length;
    }
    return 0;
  };
  const notBroughtOver: STNotBroughtOver = {
    quickReplies: await countJson("QuickReplies", "quickreplies"),
    instruct: await countJson("instruct", "Instruct"),
    context: await countJson("context", "Context"),
    systemPrompts: await countJson("sysprompt", "Sysprompt"),
  };

  return {
    success: true,
    dataDir,
    characters,
    chats,
    groupChats,
    presets,
    lorebooks,
    backgrounds,
    personas,
    regexScripts,
    notBroughtOver,
  };
}

function readSettingsRegexScripts(settings: unknown): unknown[] {
  const extensionSettings = (settings as { extension_settings?: { regex?: unknown } } | null)?.extension_settings;
  return Array.isArray(extensionSettings?.regex) ? extensionSettings.regex : [];
}

// ─── Bulk Import ───

export type STBulkImportSelection = boolean | string[];

export interface STBulkImportOptions {
  characters: STBulkImportSelection;
  chats: STBulkImportSelection;
  groupChats: STBulkImportSelection;
  presets: STBulkImportSelection;
  lorebooks: STBulkImportSelection;
  backgrounds: STBulkImportSelection;
  personas: STBulkImportSelection;
  /** Global regex scripts from settings.json. */
  regexScripts?: STBulkImportSelection;
  characterTagImportMode?: STCharacterTagImportMode;
  regexScriptScope?: "character" | "global";
  /** Import each card's embedded lorebook (on unless false). */
  importEmbeddedLorebook?: boolean;
  /** Import embedded lorebooks hidden from the Lorebook library (still linked to their character). */
  hideEmbeddedLorebook?: boolean;
  /** The "Tag imported" / "Tag source" checkboxes; everything imported is tagged "Imported" and "ST". */
  importTags?: ImportTagOptions;
  /**
   * Skip characters and chats this Engine already has from an earlier import (on unless false).
   * An import that looked stuck was often run again, and every run added a full second copy.
   */
  skipAlreadyImported?: boolean;
}

export interface STBulkImportResult {
  success: boolean;
  error?: string;
  imported: {
    characters: number;
    chats: number;
    groupChats: number;
    presets: number;
    lorebooks: number;
    backgrounds: number;
    personas: number;
    regexScripts?: number;
  };
  /** Left out because this Engine already had them (skipAlreadyImported). */
  skipped?: { characters: number; chats: number; groupChats: number; personas?: number };
  /** What came along beyond the counts, and what could not. */
  report?: STBulkImportReport;
  errors: string[];
}

export interface STBulkImportReport {
  /** Chats whose Author's Note came in as is. */
  authorsNotes: number;
  /** Chats whose Author's Note came in but SillyTavern placed it differently (frequency, position or role). */
  authorsNotesPlacement: number;
  /** Chats whose Author's Note SillyTavern had turned off; kept in metadata, still off. */
  authorsNotesOff: number;
  /** Chats linked to a persona by the SillyTavern user's name or persona lock. */
  personasLinked: number;
  /** SillyTavern user names with no persona of that name here (up to 20). */
  missingPersonas: string[];
  /** Messages SillyTavern hid from the AI; they stay hidden. */
  hiddenMessages: number;
  /** Group chats set to Individual mode, as SillyTavern's groups answer. */
  groupChatsIndividual: number;
  /** Lorebook entries placed around SillyTavern's Author's Note, now at depth 4. */
  lorebookEntriesMovedFromAuthorsNote: number;
  /** Lorebook entries placed around SillyTavern's example messages, now after the character definitions. */
  lorebookEntriesMovedFromExamples: number;
  /** Regex scripts that run only on slash commands, World Info or reasoning, which have no regex here. */
  regexSkipped: number;
  /** Text Completion presets imported (samplers only). */
  samplersOnlyPresets: number;
  /** In the folder, with no matching feature here. */
  notBroughtOver: STNotBroughtOver;
  /** Presets that brought sampler settings along. */
  presetsWithSettings: number;
  /** Preset settings with no place in a Marinara preset. */
  presetSettingsLeftOut: STPresetLeftOut[];
  /** SillyTavern personas left out because a persona of that name is already here (chats link to it). Up to 20. */
  personasAlreadyHere: string[];
  /** Presets per World Info layout (before/after kept apart, one combined spot, or turned off). */
  presetWorldInfo: Partial<Record<STPresetWorldInfo, number>>;
}

function emptyBulkImportReport(): STBulkImportReport {
  return {
    authorsNotes: 0,
    authorsNotesPlacement: 0,
    authorsNotesOff: 0,
    personasLinked: 0,
    missingPersonas: [],
    hiddenMessages: 0,
    groupChatsIndividual: 0,
    lorebookEntriesMovedFromAuthorsNote: 0,
    lorebookEntriesMovedFromExamples: 0,
    regexSkipped: 0,
    samplersOnlyPresets: 0,
    notBroughtOver: { quickReplies: 0, instruct: 0, context: 0, systemPrompts: 0 },
    presetsWithSettings: 0,
    presetSettingsLeftOut: [],
    presetWorldInfo: {},
    personasAlreadyHere: [],
  };
}

const MAX_REPORTED_MISSING_PERSONAS = 20;

/** Progress event emitted during bulk import */
export interface ImportProgress {
  /** Which category is being imported */
  category: string;
  /** Name of the item currently being imported */
  item: string;
  /** Current index (1-based) within this category */
  current: number;
  /** Total items in this category */
  total: number;
  /** Cumulative counts so far */
  imported: STBulkImportResult["imported"];
}

function resolveSelectedItems<T extends { id: string }>(items: T[], selection: STBulkImportSelection | undefined) {
  if (selection === true) return items;
  if (selection === false || !Array.isArray(selection) || selection.length === 0) return [];
  const selectedIds = new Set(selection);
  return items.filter((item) => selectedIds.has(item.id));
}

/** Same card, same text: name, description and first message. Catches re-imports of an unchanged card. */
function characterImportSignature(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const inner = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : record;
  const name = normalizeTextForMatch(typeof inner.name === "string" ? inner.name : record.name);
  if (!name) return null;
  const text = (value: unknown) => (typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "");
  return createHash("sha256")
    .update(
      `${name}\u0001${text(inner.description ?? record.description)}\u0001${text(inner.first_mes ?? record.first_mes)}`,
    )
    .digest("hex");
}

/**
 * Chats imported before fingerprints existed: the same file gives the same chat name, file label
 * and file time, which no two different files share in practice.
 */
function legacyChatSignature(name: string, branchName: string | null | undefined, createdAt: string | null) {
  if (!createdAt) return null;
  return `${normalizeTextForMatch(name)}\u0001${branchName ?? ""}\u0001${createdAt}`;
}

async function existingImportSignatures(db: DB) {
  const characters = new Set<string>();
  const chats = new Set<string>();
  for (const row of await db.select({ data: charactersTable.data }).from(charactersTable)) {
    try {
      const signature = characterImportSignature(JSON.parse(row.data));
      if (signature) characters.add(signature);
    } catch {
      // unreadable card: never matches
    }
  }
  const chatRows = await db
    .select({ name: chatsTable.name, metadata: chatsTable.metadata, createdAt: chatsTable.createdAt })
    .from(chatsTable);
  for (const row of chatRows) {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata || "{}") as Record<string, unknown>;
    } catch {
      // no metadata: legacy signature with no label
    }
    // A chat that remembers its file matches only that file; name and time matching is for chats from older
    // versions, which kept no fingerprint (two different files can share a label and a time).
    if (typeof metadata.importFingerprint === "string") {
      chats.add(`fp:${metadata.importFingerprint}`);
      continue;
    }
    const createdAt = parseTrustedTimestamp(row.createdAt);
    const branch = typeof metadata.branchName === "string" ? metadata.branchName : null;
    const legacy = legacyChatSignature(row.name, branch, createdAt);
    if (legacy) chats.add(`legacy:${legacy}`);
    // Group chats carry no file label.
    const legacyNoBranch = legacyChatSignature(row.name, null, createdAt);
    if (legacyNoBranch) chats.add(`legacy:${legacyNoBranch}`);
  }
  return { characters, chats };
}

export async function runSTBulkImport(
  rootPath: string,
  options: STBulkImportOptions,
  db: DB,
  onProgress?: (progress: ImportProgress) => void,
): Promise<STBulkImportResult> {
  const importTags = options.importTags;
  const scanResult = await scanSTFolder(rootPath);
  if (!scanResult.success || !scanResult.dataDir) {
    return {
      success: false,
      error: scanResult.error ?? "Scan failed",
      imported: { characters: 0, chats: 0, groupChats: 0, presets: 0, lorebooks: 0, backgrounds: 0, personas: 0 },
      errors: [],
    };
  }

  const imported: STBulkImportResult["imported"] = {
    characters: 0,
    chats: 0,
    groupChats: 0,
    presets: 0,
    lorebooks: 0,
    backgrounds: 0,
    personas: 0,
  };
  const errors: string[] = [];
  const selectedCharacters = resolveSelectedItems(scanResult.characters, options.characters);
  const selectedChats = resolveSelectedItems(scanResult.chats, options.chats);
  const selectedGroupChats = resolveSelectedItems(scanResult.groupChats, options.groupChats);
  const selectedPresets = resolveSelectedItems(scanResult.presets, options.presets);
  const selectedLorebooks = resolveSelectedItems(scanResult.lorebooks, options.lorebooks);
  const selectedBackgrounds = resolveSelectedItems(scanResult.backgrounds, options.backgrounds);
  const selectedPersonas = resolveSelectedItems(scanResult.personas, options.personas);
  const tagImportMode = options.characterTagImportMode ?? "all";
  const regexScriptScope = options.regexScriptScope ?? "character";
  const importEmbeddedLorebook = options.importEmbeddedLorebook !== false;
  const hideEmbeddedLorebook = options.hideEmbeddedLorebook === true;
  const existingTagKeys =
    tagImportMode === "existing" && selectedCharacters.length > 0 ? await getExistingCharacterTagKeys(db) : undefined;
  const skipAlreadyImported = options.skipAlreadyImported !== false;
  const skipped = { characters: 0, chats: 0, groupChats: 0, personas: 0 };
  const report = emptyBulkImportReport();
  const missingPersonas = new Set<string>();
  const presetLeftOut = new Set<STPresetLeftOut>();
  const noteChatImport = (notes: STChatImportNote[] | undefined) => {
    for (const note of notes ?? []) {
      if (note.kind === "authorsNote") report.authorsNotes++;
      else if (note.kind === "authorsNotePlacement") report.authorsNotesPlacement++;
      else if (note.kind === "authorsNoteOff") report.authorsNotesOff++;
      else if (note.kind === "persona") report.personasLinked++;
      else if (note.kind === "personaMissing") missingPersonas.add(note.name);
      else if (note.kind === "hiddenMessages") report.hiddenMessages += note.count;
      else if (note.kind === "groupIndividual") report.groupChatsIndividual++;
    }
  };
  const noteCharacterImport = (result: Awaited<ReturnType<typeof importSTCharacter>>) => {
    if (!result || !("regexSkipped" in result)) return;
    report.regexSkipped += result.regexSkipped ?? 0;
    for (const note of result.lorebook?.notes ?? []) {
      if (note.from === "authorsNote") report.lorebookEntriesMovedFromAuthorsNote += note.count;
      else report.lorebookEntriesMovedFromExamples += note.count;
    }
  };
  let chatsWritten = 0;
  const releaseWrittenChats = async () => {
    if (++chatsWritten % IMPORT_TRIM_EVERY_CHATS !== 0) return;
    try {
      await db._fileStore?.trimResidentChatUnits?.(IMPORT_RESIDENT_CHATS);
    } catch (err) {
      // The chats are written; a failed flush here is retried by the next one.
      logger.warn(err, "[import] Could not flush imported chats yet");
    }
  };
  const known = skipAlreadyImported ? await existingImportSignatures(db) : null;
  /**
   * True when this Engine already has it. Otherwise the first key (a content fingerprint) is
   * remembered, so a folder's own exact copies import once. Later keys (legacy signatures) only
   * match what existed before this run: two different files can share one.
   */
  const alreadyHave = (set: Set<string> | undefined, remembered: string | null, ...priorOnly: Array<string | null>) => {
    if (!set) return false;
    if ([remembered, ...priorOnly].some((key) => key !== null && set.has(key))) return true;
    if (remembered !== null) set.add(remembered);
    return false;
  };

  // Import characters
  if (selectedCharacters.length > 0) {
    const total = selectedCharacters.length;
    let idx = 0;
    for (const ch of selectedCharacters) {
      idx++;
      onProgress?.({ category: "Characters", item: ch.name, current: idx, total, imported });
      try {
        const fileInfo = await stat(ch.path);
        const timestampOverrides = getFileTimestampOverrides(fileInfo);
        if (ch.format === "png") {
          const buf = await readFile(ch.path);
          const card = extractCharaFromPng(buf);
          if (card && alreadyHave(known?.characters, characterImportSignature(card))) {
            skipped.characters++;
          } else if (card) {
            // Attach avatar as data URL
            const b64 = buf.toString("base64");
            const dataUrl = `data:image/png;base64,${b64}`;
            (card as Record<string, unknown>)._avatarDataUrl = dataUrl;
            noteCharacterImport(
              await importSTCharacter(card as Record<string, unknown>, db, {
                timestampOverrides,
                tagImportMode,
                existingTagKeys,
                regexScriptScope,
                importTags,
                importEmbeddedLorebook,
                hideEmbeddedLorebook,
              }),
            );
            imported.characters++;
          }
        } else {
          const raw = JSON.parse(await readFile(ch.path, "utf-8"));
          if (alreadyHave(known?.characters, characterImportSignature(raw))) {
            skipped.characters++;
            continue;
          }
          noteCharacterImport(
            await importSTCharacter(raw, db, {
              timestampOverrides,
              tagImportMode,
              existingTagKeys,
              regexScriptScope,
              importTags,
              importEmbeddedLorebook,
              hideEmbeddedLorebook,
            }),
          );
          imported.characters++;
        }
      } catch (err) {
        errors.push(`Character "${ch.name}": ${(err as Error).message}`);
      }
    }
  }

  // Build a name → characterId map for linking chats to characters
  // We look at ALL characters in DB (including ones just imported)
  const charNameToId = new Map<string, string>();
  try {
    const allChars = await db.select().from(charactersTable);
    for (const ch of allChars) {
      try {
        const data = JSON.parse(ch.data);
        const name = normalizeTextForMatch(data?.name);
        if (name) charNameToId.set(name, ch.id);
      } catch {
        // skip
      }
    }
  } catch {
    // DB read failed, continue without linking
  }

  // Also index by character card filename.
  // Use ALL scanned characters, not just selectedCharacters, so chats can still
  // link to already-existing characters even when they were not re-imported now.
  for (const ch of scanResult.characters) {
    const displayNameKey = normalizeTextForMatch(ch.name);
    const filenameKey = normalizeTextForMatch(basename(ch.path, extname(ch.path)));

    const charId = charNameToId.get(displayNameKey) ?? charNameToId.get(filenameKey) ?? null;

    if (charId) {
      if (displayNameKey && !charNameToId.has(displayNameKey)) {
        charNameToId.set(displayNameKey, charId);
      }
      if (filenameKey && !charNameToId.has(filenameKey)) {
        charNameToId.set(filenameKey, charId);
      }
    }
  }

  // Import personas first, so the chats below can be linked to them.
  const importedPersonaAvatars = new Map<string, string>();
  if (selectedPersonas.length > 0) {
    const storage = createCharactersStorage(db);
    const AVATAR_DIR = join(DATA_DIR, "avatars");
    if (!existsSync(AVATAR_DIR)) {
      await mkdir(AVATAR_DIR, { recursive: true });
    }
    // With "Skip what's already here", a persona of the same name (from a chat import or an earlier run)
    // is used instead of a second, empty copy. Only personas from before this run count, so two
    // SillyTavern personas sharing a name both come in.
    const existingPersonas = skipAlreadyImported ? await buildPersonaLookup(db) : null;
    const total = selectedPersonas.length;
    let idx = 0;
    for (const p of selectedPersonas) {
      idx++;
      onProgress?.({ category: "Personas", item: p.name, current: idx, total, imported });
      const existingId = existingPersonas?.get(personaLookupKey(p.name));
      if (existingId) {
        importedPersonaAvatars.set(basename(p.path), existingId);
        skipped.personas++;
        if (report.personasAlreadyHere.length < MAX_REPORTED_MISSING_PERSONAS) report.personasAlreadyHere.push(p.name);
        continue;
      }
      try {
        // Copy avatar image
        const ext = extname(p.path).toLowerCase();
        const destName = `${randomUUID()}${ext}`;
        await copyFile(p.path, join(AVATAR_DIR, destName));
        const avatarPath = `/api/avatars/file/${destName}`;
        const fileInfo = await stat(p.path);
        const persona = await storage.createPersona(
          p.name,
          p.description,
          avatarPath,
          importTags ? { tags: JSON.stringify(withImportTags([], "st", importTags)) } : undefined,
          getFileTimestampOverrides(fileInfo),
        );
        if (persona) importedPersonaAvatars.set(basename(p.path), persona.id);
        imported.personas++;
      } catch (err) {
        errors.push(`Persona "${p.name}": ${(err as Error).message}`);
      }
    }
  }

  // Chats are linked to the persona SillyTavern spoke as: its persona lock (avatar file), else the user's name.
  let personaLookup: Map<string, string> | undefined;
  if (selectedChats.length > 0 || selectedGroupChats.length > 0) {
    try {
      personaLookup = await buildPersonaLookup(db);
      for (const [avatar, id] of importedPersonaAvatars) personaLookup.set(`avatar:${avatar}`, id);
      // A persona already here from an earlier import keeps its SillyTavern name, so a lock finds it by name.
      for (const p of scanResult.personas) {
        const id = personaLookup.get(personaLookupKey(p.name));
        const avatar = `avatar:${basename(p.path)}`;
        if (id && !personaLookup.has(avatar)) personaLookup.set(avatar, id);
      }
    } catch (err) {
      logger.warn(err, "[import] Could not read personas; chats import without one");
      personaLookup = new Map();
    }
  }

  // Import chats (with character linking)
  // Group chats by character, but preserve each imported file's name as a branch label.
  if (selectedChats.length > 0) {
    const charGroupIds = new Map<string, string>();
    const total = selectedChats.length;
    let idx = 0;

    for (const ct of selectedChats) {
      idx++;
      onProgress?.({ category: "Chats", item: ct.characterName, current: idx, total, imported });

      try {
        const content = await readFile(ct.path, "utf-8");
        const fileInfo = await stat(ct.path);
        const fingerprint = stChatFileFingerprint(content);
        const branchName = ct.chatName ?? basename(ct.path, ".jsonl");
        const chatName = folderChatName(branchName, ct.characterName);
        const fileCreatedAt = parseTrustedTimestamp(getFileTimestampOverrides(fileInfo)?.createdAt);
        // Older folder runs named the chat after the character; chats are named after the file now.
        const legacy = legacyChatSignature(ct.characterName, branchName, fileCreatedAt);
        const legacyByFile = legacyChatSignature(chatName, branchName, fileCreatedAt);
        if (
          alreadyHave(
            known?.chats,
            `fp:${fingerprint}`,
            legacy && `legacy:${legacy}`,
            legacyByFile && `legacy:${legacyByFile}`,
          )
        ) {
          skipped.chats++;
          continue;
        }

        const normalizedCharacterName = normalizeTextForMatch(ct.characterName);
        const normalizedFolderName = normalizeTextForMatch(ct.folderName);

        // Prefer folder name first because ST chat folders usually track the
        // character card filename more reliably than character_name headers.
        const charId = charNameToId.get(normalizedFolderName) ?? charNameToId.get(normalizedCharacterName) ?? null;

        const groupKey = normalizedFolderName || normalizedCharacterName;
        let groupId = charGroupIds.get(groupKey);
        if (!groupId) {
          groupId = randomUUID();
          charGroupIds.set(groupKey, groupId);
        }

        const chatResult = await importSTChat(content, db, {
          personaLookup,
          characterId: charId,
          // Named after the SillyTavern file, as a single chat import is ("Ilse Marrow - Beach date").
          // A placeholder file name falls back to the character's.
          chatName,
          branchName,
          groupId,
          sourceFingerprint: fingerprint,
          timestampOverrides: getFileTimestampOverrides(fileInfo),
          importTags,
        });
        if ("importNotes" in chatResult) noteChatImport(chatResult.importNotes);

        imported.chats++;
        await releaseWrittenChats();
      } catch (err) {
        errors.push(`Chat "${ct.characterName}": ${(err as Error).message}`);
      }
    }
  }

  // Import group chats
  if (selectedGroupChats.length > 0) {
    const gcGroupIds = new Map<string, string>();
    const total = selectedGroupChats.length;
    let idx = 0;
    for (const gc of selectedGroupChats) {
      idx++;
      onProgress?.({ category: "Group Chats", item: gc.groupName, current: idx, total, imported });
      try {
        const content = await readFile(gc.path, "utf-8");
        const fileInfo = await stat(gc.path);
        const fingerprint = stChatFileFingerprint(content);
        const legacy = legacyChatSignature(
          gc.groupName,
          null,
          parseTrustedTimestamp(getFileTimestampOverrides(fileInfo)?.createdAt),
        );
        if (alreadyHave(known?.chats, `fp:${fingerprint}`, legacy && `legacy:${legacy}`)) {
          skipped.groupChats++;
          continue;
        }
        // Build speaker→characterId map from member names
        // Members first, in the group's own order (it decides who speaks first), then their other names.
        const speakerMap: Record<string, string> = {};
        const memberCharacterIds = new Set<string>();
        for (const memberName of gc.members) {
          const key = normalizeTextForMatch(memberName);
          const cid = charNameToId.get(key);
          if (!cid) continue;
          memberCharacterIds.add(cid);
          if (!(key in speakerMap)) speakerMap[key] = cid;
        }
        for (const [alias, characterId] of charNameToId) {
          if (memberCharacterIds.has(characterId)) speakerMap[alias] = characterId;
        }
        const groupKey = normalizeTextForMatch(gc.groupName);
        if (!gcGroupIds.has(groupKey)) {
          gcGroupIds.set(groupKey, randomUUID());
        }
        const chatResult = await importSTChat(content, db, {
          personaLookup,
          chatName: gc.groupName,
          // Each file shows under its own name, as character chats do (the group name stays the chat's name).
          branchName: basename(gc.path, ".jsonl"),
          speakerMap,
          stGroupActivationStrategy: gc.activationStrategy ?? null,
          mode: "roleplay",
          groupId: gcGroupIds.get(groupKey)!,
          sourceFingerprint: fingerprint,
          timestampOverrides: getFileTimestampOverrides(fileInfo),
          importTags,
        });
        if ("importNotes" in chatResult) noteChatImport(chatResult.importNotes);
        imported.groupChats++;
        await releaseWrittenChats();
      } catch (err) {
        errors.push(`Group chat "${gc.groupName}": ${(err as Error).message}`);
      }
    }
  }

  // Import presets
  if (selectedPresets.length > 0) {
    const total = selectedPresets.length;
    let idx = 0;
    for (const pr of selectedPresets) {
      idx++;
      onProgress?.({ category: "Presets", item: pr.name, current: idx, total, imported });
      try {
        const raw = JSON.parse(await readFile(pr.path, "utf-8"));
        const fileInfo = await stat(pr.path);
        const presetResult = await importSTPreset(raw, db, pr.name, {
          timestampOverrides: getFileTimestampOverrides(fileInfo),
          importTags,
        });
        if ((presetResult.parametersImported?.length ?? 0) > 0) report.presetsWithSettings++;
        if (pr.samplersOnly) report.samplersOnlyPresets++;
        if (presetResult.worldInfo) {
          report.presetWorldInfo[presetResult.worldInfo] = (report.presetWorldInfo[presetResult.worldInfo] ?? 0) + 1;
        }
        report.regexSkipped += presetResult.regexSkipped ?? 0;
        for (const key of presetResult.parametersLeftOut ?? []) presetLeftOut.add(key);
        imported.presets++;
      } catch (err) {
        errors.push(`Preset "${pr.name}": ${(err as Error).message}`);
      }
    }
  }

  // Import lorebooks
  if (selectedLorebooks.length > 0) {
    const total = selectedLorebooks.length;
    let idx = 0;
    for (const lb of selectedLorebooks) {
      idx++;
      onProgress?.({ category: "Lorebooks", item: lb.name, current: idx, total, imported });
      try {
        const raw = JSON.parse(await readFile(lb.path, "utf-8"));
        const fileInfo = await stat(lb.path);
        const lorebookResult = await importSTLorebook(raw, db, {
          fallbackName: lb.name,
          timestampOverrides: getFileTimestampOverrides(fileInfo),
          importTags,
        });
        for (const note of lorebookResult.notes) {
          if (note.from === "authorsNote") report.lorebookEntriesMovedFromAuthorsNote += note.count;
          else report.lorebookEntriesMovedFromExamples += note.count;
        }
        imported.lorebooks++;
      } catch (err) {
        errors.push(`Lorebook "${lb.name}": ${(err as Error).message}`);
      }
    }
  }

  // Import backgrounds
  if (selectedBackgrounds.length > 0) {
    // Ensure our backgrounds directory exists
    if (!existsSync(BG_DIR)) {
      await mkdir(BG_DIR, { recursive: true });
    }
    const total = selectedBackgrounds.length;
    let idx = 0;
    for (const bg of selectedBackgrounds) {
      idx++;
      onProgress?.({ category: "Backgrounds", item: bg.name, current: idx, total, imported });
      try {
        const ext = extname(bg.name).toLowerCase();
        const destName = `${randomUUID()}${ext}`;
        await copyFile(bg.path, join(BG_DIR, destName));
        imported.backgrounds++;
      } catch (err) {
        errors.push(`Background "${bg.name}": ${(err as Error).message}`);
      }
    }
  }

  // Global regex scripts from settings.json, after every script already here in run order.
  const selectedRegex = resolveSelectedItems(scanResult.regexScripts ?? [], options.regexScripts);
  if (selectedRegex.length > 0) {
    onProgress?.({ category: "Regex scripts", item: "settings.json", current: 1, total: 1, imported });
    try {
      const settings = JSON.parse(await readFile(selectedRegex[0]!.path, "utf-8"));
      const all = readSettingsRegexScripts(settings);
      const picked = selectedRegex.map((item) => all[item.index]).filter((script) => script !== undefined);
      const regexStorage = createRegexScriptsStorage(db);
      const existing = await regexStorage.list();
      const orderBase = existing.reduce((maximum, script) => Math.max(maximum, script.order), -1) + 1;
      imported.regexScripts = 0;
      const converted = convertStRegexScripts(picked, {}, orderBase);
      report.regexSkipped += picked.length - converted.length;
      for (const input of converted) {
        try {
          await regexStorage.create(input);
          imported.regexScripts++;
        } catch (err) {
          errors.push(`Regex script "${input.name}": ${(err as Error).message}`);
        }
      }
    } catch (err) {
      errors.push(`Regex scripts: ${(err as Error).message}`);
    }
  }

  if (scanResult.notBroughtOver) report.notBroughtOver = scanResult.notBroughtOver;
  report.missingPersonas = [...missingPersonas].slice(0, MAX_REPORTED_MISSING_PERSONAS);
  report.presetSettingsLeftOut = [...presetLeftOut];
  return { success: true, imported, ...(skipAlreadyImported ? { skipped } : {}), report, errors };
}
