// ──────────────────────────────────────────────
// Routes: Import (SillyTavern data)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyRequest } from "fastify";
import { execFile } from "child_process";
import { randomUUID } from "node:crypto";
import { inflateSync } from "node:zlib";
import { platform, homedir } from "os";
import { realpathSync } from "fs";
import { readdir, stat } from "fs/promises";
import { resolve as pathResolve } from "path";
import {
  containsDecisionStatements,
  IMPORT_TAGS_FIELD,
  normalizeTextForMatch,
  readImportTagOptions,
  type ChatMode,
  type ImportTagOptions,
} from "@marinara-engine/shared";
import { importSTChat, stChatFileFingerprint, stChatNameFromFileName } from "../services/import/st-chat.importer.js";
import {
  importSTCharacter,
  importCharX,
  inspectSTCharacter,
  inspectCharX,
  getExistingCharacterTagKeys,
  findMatchingCharacters,
  loadCharacterMatchCandidates,
  type CharacterMatchCandidates,
  IMPORT_BODY_LIMIT_BYTES,
  type CharacterImportMatch,
  type CreatorNotesUpdate,
  type STCharacterImportPreview,
  type STCharacterTagImportMode,
} from "../services/import/st-character.importer.js";
import { importSTPreset } from "../services/import/st-prompt.importer.js";
import { importSTLorebook } from "../services/import/st-lorebook.importer.js";
import { importMarinara } from "../services/import/marinara.importer.js";
import {
  scanSTFolder,
  runSTBulkImport,
  type ImportProgress as STBulkImportProgress,
  type STBulkImportOptions,
  type STBulkImportResult,
} from "../services/import/st-bulk.importer.js";
import { characters as charactersTable } from "../db/schema/index.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { newId } from "../utils/id-generator.js";
import { normalizeTimestampOverrides } from "../services/import/import-timestamps.js";
import { getImportAllowedRoots } from "../config/runtime-config.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { assertInsideDir, safeCompareString, tokenForPath } from "../utils/security.js";
import { logger } from "../lib/logger.js";
import { openZipArchive, type ZipArchive } from "../lib/zip-reader.js";
import { parseJsonBytes } from "../utils/large-json.js";
import { STATUS_POLL_RATE_LIMIT } from "../middleware/rate-limit.js";

const PICK_FOLDER_TIMEOUT_MS = 60_000; // 60s — prevents infinite hang on headless servers
const FOLDER_TOKEN_TTL_MS = 15 * 60_000;
const NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES = 1024 * 1024 * 1024;
const MAX_BATCH_IMPORT_FILES = 128;
const NATIVE_PACKAGE_ENTRY_LIMIT_BYTES = 256 * 1024 * 1024;

/** "picker": chosen in this computer's own folder window. "browse": reached through /list-directory. */
type FolderTokenSource = "picker" | "browse";
const folderTokens = new Map<string, { path: string; expiresAt: number; source: FolderTokenSource }>();

function cleanupFolderTokens() {
  const now = Date.now();
  for (const [token, entry] of folderTokens) {
    if (entry.expiresAt < now) folderTokens.delete(token);
  }
}

function issueFolderToken(pathValue: string, source: FolderTokenSource) {
  cleanupFolderTokens();
  const resolved = realPathOrSelf(pathResolve(pathValue));
  const token = tokenForPath(`${resolved}:${Date.now()}:${Math.random()}`);
  folderTokens.set(token, { path: resolved, expiresAt: Date.now() + FOLDER_TOKEN_TTL_MS, source });
  return token;
}

function isUnderRoot(pathValue: string, root: string): boolean {
  try {
    assertInsideDir(root, pathResolve(pathValue));
    return true;
  } catch {
    return false;
  }
}

function isAllowedImportRoot(pathValue: string) {
  return getImportAllowedRoots().some((root) => isUnderRoot(pathValue, realPathOrSelf(pathResolve(root))));
}

/** Whether a folder is inside the home folder once links are followed (Browse's limit). */
function isHomeContained(pathValue: string) {
  return isUnderRoot(realPathOrSelf(pathResolve(pathValue)), realPathOrSelf(homedir()));
}

/** Whether a typed folder is inside the home folder, or IMPORT_ALLOWED_ROOTS when set, once links are followed. */
function isTypedFolderAllowed(pathValue: string) {
  const real = realPathOrSelf(pathResolve(pathValue));
  const roots = getImportAllowedRoots().length > 0 ? getImportAllowedRoots() : [homedir()];
  return roots.some((root) => isUnderRoot(real, realPathOrSelf(pathResolve(root))));
}

function resolveImportFolder(body: {
  folderPath?: unknown;
  folderToken?: unknown;
}): { ok: true; path: string } | { ok: false; error: string } {
  const rawPath = typeof body.folderPath === "string" ? body.folderPath.trim() : "";
  const token = typeof body.folderToken === "string" ? body.folderToken.trim() : "";
  cleanupFolderTokens();

  if (token) {
    const entry = folderTokens.get(token);
    if (!entry) return { ok: false, error: "Folder token is missing or expired" };
    if (rawPath && !safeCompareString(realPathOrSelf(pathResolve(rawPath)), entry.path)) {
      return { ok: false, error: "Folder token does not match folderPath" };
    }
    // Follow links again at use: the folder may have been swapped for a link since it was listed.
    const real = realPathOrSelf(entry.path);
    if (getImportAllowedRoots().length > 0 && !isAllowedImportRoot(real)) {
      return { ok: false, error: describeImportFolderLimit() };
    }
    if (entry.source === "browse" && !isHomeContained(real)) {
      return { ok: false, error: describeImportFolderLimit() };
    }
    return { ok: true, path: real };
  }

  if (!rawPath) return { ok: false, error: "folderPath or folderToken is required" };
  const resolved = pathResolve(rawPath);
  // A typed path gets what Browse already reaches: the home folder, unless IMPORT_ALLOWED_ROOTS names others.
  // Links are followed first, so a link inside the home folder can't lead the import outside it.
  if (!isTypedFolderAllowed(resolved)) return { ok: false, error: describeImportFolderLimit() };
  return { ok: true, path: realPathOrSelf(resolved) };
}

function realPathOrSelf(pathValue: string): string {
  try {
    return realpathSync(pathValue);
  } catch {
    return pathValue;
  }
}

function describeImportFolderLimit() {
  return getImportAllowedRoots().length > 0
    ? "Marinara can only read folders inside the import folders this server allows (IMPORT_ALLOWED_ROOTS). Move the SillyTavern folder into one of them, or ask whoever runs the server to allow its location."
    : `Marinara can only read folders inside your home folder (${homedir()}). Move the SillyTavern folder there, or ask whoever runs the server to allow its location (IMPORT_ALLOWED_ROOTS).`;
}

/**
 * Opens a native OS folder picker and returns the selected path.
 * macOS  → osascript
 * Linux  → zenity / kdialog
 * Windows → PowerShell
 * Times out after 60s to prevent hanging on headless/remote machines.
 */
function pickFolder(): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val: string | null) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    const timer = setTimeout(() => done(null), PICK_FOLDER_TIMEOUT_MS);
    const cleanup = () => clearTimeout(timer);

    const os = platform();

    if (os === "darwin") {
      execFile(
        "osascript",
        ["-e", 'POSIX path of (choose folder with prompt "Select your SillyTavern folder")'],
        (err, stdout) => {
          cleanup();
          if (err) return done(null);
          const p = stdout.trim().replace(/\/$/, "");
          done(p || null);
        },
      );
    } else if (os === "win32") {
      // -STA is required for WinForms dialogs. A hidden topmost form is created
      // as the owner window so the dialog appears in the foreground instead of
      // flashing and closing immediately (common Node.js-spawned-PowerShell bug).
      const ps = [
        "-STA",
        "-NoProfile",
        "-Command",
        `Add-Type -AssemblyName System.Windows.Forms;` +
          `$f = New-Object System.Windows.Forms.Form;` +
          `$f.TopMost = $true;` +
          `$f.WindowState = 'Minimized';` +
          `$f.ShowInTaskbar = $false;` +
          `$f.Show();` +
          `$f.Hide();` +
          `$d = New-Object System.Windows.Forms.FolderBrowserDialog;` +
          `$d.Description = 'Select your SillyTavern folder';` +
          `if ($d.ShowDialog($f) -eq 'OK') { $d.SelectedPath } else { '' };` +
          `$f.Dispose()`,
      ];
      execFile("powershell.exe", ps, (err, stdout) => {
        cleanup();
        if (err) return done(null);
        const p = stdout.trim();
        done(p || null);
      });
    } else {
      // Linux — try zenity first, then kdialog
      execFile(
        "zenity",
        ["--file-selection", "--directory", "--title=Select your SillyTavern folder"],
        (err, stdout) => {
          if (!err && stdout.trim()) {
            cleanup();
            return done(stdout.trim());
          }
          execFile(
            "kdialog",
            ["--getexistingdirectory", ".", "--title", "Select your SillyTavern folder"],
            (err2, stdout2) => {
              cleanup();
              if (err2) return done(null);
              const p = stdout2.trim();
              done(p || null);
            },
          );
        },
      );
    }
  });
}

/** Read PNG tEXt chunk with keyword "chara" → base64-encoded JSON character data */
const CHARA_KEYWORDS = new Set(["ccv3", "chara"]);

/** Parse chunk text that may be raw JSON or base64-encoded JSON. */
function parseCharaChunkText(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(Buffer.from(text, "base64").toString("utf-8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/** Extract character JSON from a PNG buffer, checking tEXt, zTXt, and iTXt chunks for "ccv3" (V3) or "chara" (V2) keywords. */
export function extractCharaFromPng(buf: Buffer): Record<string, unknown> | null {
  if (buf.length < 8) return null;
  const found = new Map<string, Record<string, unknown>>();
  let offset = 8; // skip PNG signature

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
            const parsed = parseCharaChunkText(text);
            if (parsed) found.set(keyword, parsed);
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
          // Skip compressionMethod, then find languageTag\0 and translatedKeyword\0
          const langEnd = payload.indexOf(0, nullIdx + 3);
          if (langEnd >= 0) {
            const transEnd = payload.indexOf(0, langEnd + 1);
            if (transEnd >= 0) {
              const textBuf = payload.subarray(transEnd + 1);
              if (compressionFlag === 0) {
                const text = textBuf.toString("utf-8");
                try {
                  // iTXt may be raw JSON or base64-encoded
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
    }

    offset += 12 + length;
    if (type === "IEND") break;
  }

  // Prefer ccv3 (V3 full data) over chara (V2 / backward-compat)
  return found.get("ccv3") ?? found.get("chara") ?? null;
}

function readTimestampOverridesValue(value: unknown) {
  if (typeof value === "string") {
    try {
      return normalizeTimestampOverrides(JSON.parse(value));
    } catch {
      return normalizeTimestampOverrides({ createdAt: value, updatedAt: value });
    }
  }
  if (value && typeof value === "object") {
    return normalizeTimestampOverrides(value as Record<string, unknown>);
  }
  return undefined;
}

function readTimestampOverridesFromBody(body: Record<string, unknown>) {
  return (
    readTimestampOverridesValue(body.timestampOverrides ?? body.__timestampOverrides) ??
    normalizeTimestampOverrides({
      createdAt: body.createdAt,
      updatedAt: body.updatedAt,
    })
  );
}

function readTimestampOverridesFromMultipart(file: { fields?: Record<string, any> } | null | undefined) {
  const field = file?.fields?.timestampOverrides ?? file?.fields?.__timestampOverrides;
  const rawValue = Array.isArray(field) ? field.at(-1)?.value : field?.value;
  return readTimestampOverridesValue(rawValue);
}

function readBooleanOption(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function readMultipartBooleanField(file: { fields?: Record<string, any> } | null | undefined, fieldName: string) {
  const field = file?.fields?.[fieldName];
  const rawValue = Array.isArray(field) ? field.at(-1)?.value : field?.value;
  return readBooleanOption(rawValue);
}

function readTagImportMode(value: unknown): STCharacterTagImportMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "none" || normalized === "existing") return normalized;
  return undefined;
}

function readMultipartTagImportMode(file: { fields?: Record<string, any> } | null | undefined) {
  const field = file?.fields?.tagImportMode;
  const rawValue = Array.isArray(field) ? field.at(-1)?.value : field?.value;
  return readTagImportMode(rawValue);
}

function readRegexScriptScope(value: unknown): "character" | "global" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "character" || normalized === "global") return normalized;
  return undefined;
}

function readMultipartRegexScriptScope(file: { fields?: Record<string, any> } | null | undefined) {
  const field = file?.fields?.regexScriptScope;
  const rawValue = Array.isArray(field) ? field.at(-1)?.value : field?.value;
  return readRegexScriptScope(rawValue);
}

function readMultipartFieldValue(file: { fields?: Record<string, any> } | null | undefined, fieldName: string) {
  const field = file?.fields?.[fieldName];
  return Array.isArray(field) ? field.at(-1)?.value : field?.value;
}

/** The "Tag imported" / "Tag source" checkboxes from a multipart upload; both on when the field is missing. */
function readMultipartImportTags(file: { fields?: Record<string, any> } | null | undefined) {
  return readImportTagOptions(readMultipartFieldValue(file, IMPORT_TAGS_FIELD));
}

/** The same checkboxes from a JSON body, removed from it so the importers never see the key. */
function takeBodyImportTags(body: Record<string, unknown>) {
  const options = readImportTagOptions(body[IMPORT_TAGS_FIELD]);
  delete body[IMPORT_TAGS_FIELD];
  return options;
}

function readChatMode(value: unknown): ChatMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "conversation" || normalized === "roleplay" || normalized === "game") {
    return normalized;
  }
  return undefined;
}

function readMultipartChatModeField(file: { fields?: Record<string, any> } | null | undefined) {
  return readChatMode(readMultipartFieldValue(file, "mode"));
}

function invalidTagImportModeResponse() {
  return {
    success: false,
    error: "Invalid tagImportMode. Expected one of: all, none, existing.",
  };
}

function invalidRegexScriptScopeResponse() {
  return {
    success: false,
    error: "Invalid regexScriptScope. Expected one of: character, global.",
  };
}

function invalidChatModeResponse() {
  return {
    success: false,
    error: "Invalid mode. Expected one of: conversation, roleplay, game.",
  };
}

type MultipartImportFile = { filename?: string; buffer: Buffer };

async function readMultipartFileWithFields(req: FastifyRequest) {
  let file: MultipartImportFile | null = null;
  const fields: Record<string, unknown> = {};

  for await (const part of req.parts({ limits: { files: 1, parts: 8, fileSize: IMPORT_BODY_LIMIT_BYTES } })) {
    if (part.type === "file") {
      file = {
        filename: part.filename,
        buffer: await part.toBuffer(),
      };
      continue;
    }

    fields[part.fieldname] = part.value;
  }

  return { file, fields };
}

/**
 * Tell the importer when an imported file uses decision statements (#6569). A PNG,
 * .charx or .marinara file is parsed here, not in the browser, so only the server can
 * see them.
 */
function flagDecisionStatements<T extends { success?: boolean }>(result: T, parsed: unknown): T {
  return result.success && containsDecisionStatements(parsed) ? { ...result, usesDecisions: true } : result;
}

/** Which existing character a card updates, when the person picked "Update" for a newer release of a card. */
type CharacterUpdateTarget = { characterId: string; useCardPicture?: boolean; creatorNotes?: CreatorNotesUpdate };

function readCreatorNotesUpdate(value: unknown): CreatorNotesUpdate {
  return value === "card" || value === "mine" ? value : "merge";
}

type CharacterUpdateTargets = {
  byIndex: Map<number, CharacterUpdateTarget>;
  byName: Map<string, CharacterUpdateTarget[]>;
};

/**
 * Parse the `updateTargets` field: `[{ index, name: filename, characterId, useCardPicture, creatorNotes }]`, one per
 * file to update. `index` is the file's position in the upload; entries without one are matched by filename.
 */
function readCharacterUpdateTargets(value: unknown): CharacterUpdateTargets {
  const targets: CharacterUpdateTargets = { byIndex: new Map(), byName: new Map() };
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value ?? "[]"));
  } catch {
    return targets;
  }
  if (!Array.isArray(parsed)) return targets;
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { index, name, characterId, useCardPicture, creatorNotes } = entry as Record<string, unknown>;
    if (typeof characterId !== "string" || !characterId) continue;
    const target: CharacterUpdateTarget = {
      characterId,
      useCardPicture: useCardPicture !== false,
      creatorNotes: readCreatorNotesUpdate(creatorNotes),
    };
    if (typeof index === "number" && Number.isInteger(index) && index >= 0) {
      targets.byIndex.set(index, target);
      continue;
    }
    if (typeof name !== "string") continue;
    const queue = targets.byName.get(name) ?? [];
    queue.push(target);
    targets.byName.set(name, queue);
  }
  return targets;
}

function takeCharacterUpdateTarget(targets: CharacterUpdateTargets, index: number, filename: string) {
  return targets.byIndex.get(index) ?? targets.byName.get(filename)?.shift();
}

/**
 * The group picked for a chat that imports are being added to (/st-chat-into-group), kept only while at least one of
 * those imports is still running, so a failed import doesn't leave its pick behind.
 */
const pendingChatGroupIds = new Map<string, { groupId: string; imports: number }>();

async function importCharacterBuffer(
  fileName: string,
  buffer: Buffer,
  db: FastifyInstance["db"],
  timestampOverrides?: ReturnType<typeof normalizeTimestampOverrides>,
  importEmbeddedLorebook?: boolean,
  tagImportMode?: STCharacterTagImportMode,
  existingTagKeys?: ReadonlySet<string>,
  regexScriptScope?: "character" | "global",
  splitDescription?: boolean,
  importTags?: ImportTagOptions,
  update?: CharacterUpdateTarget,
  hideEmbeddedLorebook?: boolean,
) {
  const updateOptions = update
    ? {
        updateCharacterId: update.characterId,
        useCardPicture: update.useCardPicture !== false,
        creatorNotes: update.creatorNotes ?? "merge",
      }
    : {};
  if (fileName.toLowerCase().endsWith(".png")) {
    const charData = extractCharaFromPng(buffer);
    if (!charData) {
      return {
        success: false,
        error: "No character data found in PNG. Make sure this is a valid character card with embedded metadata.",
      };
    }

    const avatarB64 = buffer.toString("base64");
    charData._avatarDataUrl = `data:image/png;base64,${avatarB64}`;
    try {
      return flagDecisionStatements(
        await importSTCharacter(charData, db, {
          timestampOverrides,
          importEmbeddedLorebook,
          hideEmbeddedLorebook,
          tagImportMode,
          existingTagKeys,
          regexScriptScope,
          splitDescription,
          importTags,
          ...updateOptions,
        }),
        charData,
      );
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (fileName.toLowerCase().endsWith(".charx")) {
    try {
      return await importCharX(buffer, db, {
        timestampOverrides,
        importEmbeddedLorebook,
        hideEmbeddedLorebook,
        tagImportMode,
        existingTagKeys,
        regexScriptScope,
        splitDescription,
        importTags,
        ...updateOptions,
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  let json: Record<string, unknown>;
  try {
    json = parseJsonBytes(buffer) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      error:
        "Invalid file format. Expected a JSON character card, a PNG with embedded character data, or a .charx file.",
    };
  }
  try {
    return flagDecisionStatements(
      await importSTCharacter(json, db, {
        timestampOverrides,
        importEmbeddedLorebook,
        hideEmbeddedLorebook,
        tagImportMode,
        existingTagKeys,
        regexScriptScope,
        splitDescription,
        importTags,
        ...updateOptions,
      }),
      json,
    );
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function inspectCharacterBuffer(fileName: string, buffer: Buffer) {
  if (fileName.toLowerCase().endsWith(".png")) {
    const charData = extractCharaFromPng(buffer);
    if (!charData) {
      return {
        success: false,
        error: "No character data found in PNG. Make sure this is a valid character card with embedded metadata.",
        hasEmbeddedLorebook: false,
        embeddedLorebookEntries: 0,
      };
    }
    return inspectSTCharacter(charData);
  }

  if (fileName.toLowerCase().endsWith(".charx")) {
    return inspectCharX(buffer);
  }

  try {
    const json = parseJsonBytes(buffer) as Record<string, unknown>;
    return inspectSTCharacter(json);
  } catch {
    return {
      success: false,
      error:
        "Invalid file format. Expected a JSON character card, a PNG with embedded character data, or a .charx file.",
      hasEmbeddedLorebook: false,
      embeddedLorebookEntries: 0,
    };
  }
}

type STBulkImportJob = {
  id: string;
  running: boolean;
  startedAt: string;
  finishedAt?: string;
  progress: STBulkImportProgress | null;
  result: STBulkImportResult | null;
};

/** One SillyTavern import at a time; a second start would import everything twice. */
let stBulkImportJob: STBulkImportJob | null = null;

function emptyImportCounts(): STBulkImportResult["imported"] {
  return { characters: 0, chats: 0, groupChats: 0, presets: 0, lorebooks: 0, backgrounds: 0, personas: 0 };
}

export async function importRoutes(app: FastifyInstance) {
  /** Import a SillyTavern JSONL chat file. */
  app.post("/st-chat", async (req) => {
    const data = await req.file();
    if (!data) return { error: "No file uploaded" };
    const content = await data.toBuffer();
    const text = content.toString("utf-8");
    const timestampOverrides = readTimestampOverridesFromMultipart(data as any);
    const rawMode = readMultipartFieldValue(data as any, "mode");
    const mode = readMultipartChatModeField(data as any);
    if (rawMode !== undefined && mode === undefined) return invalidChatModeResponse();

    // Use the uploaded filename (minus extension) as chat name if available
    const chatName = stChatNameFromFileName(data.filename);

    // Try to link the chat to a character by matching the JSONL header's character_name
    let characterId: string | null = null;
    try {
      const firstLine = text.split("\n")[0];
      if (firstLine) {
        const header = JSON.parse(firstLine);
        const headerName = normalizeTextForMatch(header.character_name);
        if (headerName) {
          const allChars = await app.db.select().from(charactersTable);
          for (const ch of allChars) {
            try {
              const charData = JSON.parse(ch.data);
              if (normalizeTextForMatch(charData?.name) === headerName) {
                characterId = ch.id;
                break;
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (err) {
      // Non-fatal: import without a character link. Only the error type is logged at warn, since a
      // JSON parse message can quote chat text; the full error stays at debug.
      logger.warn(
        { errorType: err instanceof Error ? err.name : typeof err },
        "[import] SillyTavern chat header unreadable; importing without a character link",
      );
      logger.debug(err, "[import] SillyTavern chat header parse error");
    }

    return importSTChat(text, app.db, {
      ...(chatName ? { chatName } : {}),
      ...(characterId ? { characterId } : {}),
      // The file's own mode wins; the picked one applies to a plain SillyTavern log.
      ...(mode ? { modeFallback: mode } : {}),
      ...(timestampOverrides ? { timestampOverrides } : {}),
      importTags: readMultipartImportTags(data as any),
      // So a later folder import knows this file is already here.
      sourceFingerprint: stChatFileFingerprint(text),
    });
  });

  /**
   * Import a SillyTavern JSONL chat file as a new branch of an existing chat.
   * Inherits the target chat's group, character roster, persona, connection,
   * and prompt preset so the imported transcript shows up as a sibling
   * "chat file" instead of spawning a new character entry.
   */
  app.post("/st-chat-into-group", async (req, reply) => {
    const { file, fields } = await readMultipartFileWithFields(req);
    if (!file) return reply.status(400).send({ success: false, error: "No file uploaded" });

    const targetChatId = typeof fields.chatId === "string" ? fields.chatId : null;
    if (!targetChatId || typeof targetChatId !== "string") {
      return reply.status(400).send({ success: false, error: "Missing chatId" });
    }

    const storage = createChatsStorage(app.db);
    const targetChat = await storage.getById(targetChatId);
    if (!targetChat) return reply.status(404).send({ success: false, error: "Target chat not found" });

    const text = file.buffer.toString("utf-8");
    const timestampOverrides = readTimestampOverridesValue(fields.timestampOverrides ?? fields.__timestampOverrides);

    // Auto-create a groupId on the target chat if it isn't already in one, so
    // the imported transcript can sit alongside it as a branch (mirrors the
    // behavior of POST /chats/:id/branch).
    // The chat joins the group only once the file has come in, so a file that isn't a chat changes nothing. Two
    // imports at once into a chat with no group share the one group the first of them picked.
    const targetHadGroup = !!targetChat.groupId;
    const pending = targetHadGroup ? undefined : pendingChatGroupIds.get(targetChatId);
    const groupId = (targetChat.groupId as string | null) || pending?.groupId || newId();
    if (!targetHadGroup) pendingChatGroupIds.set(targetChatId, { groupId, imports: (pending?.imports ?? 0) + 1 });
    try {
      // Inherit the existing chat's character roster instead of trying to match
      // characters out of the JSONL header — that path creates new characters
      // when no match is found, which is exactly what we want to avoid here.
      let inheritedCharacterIds: string[] = [];
      try {
        const parsed = JSON.parse(targetChat.characterIds as string);
        if (Array.isArray(parsed))
          inheritedCharacterIds = parsed.filter((cid): cid is string => typeof cid === "string");
      } catch {
        inheritedCharacterIds = [];
      }

      // For multi-character chats, map each speaker name in the JSONL to one of
      // the existing characters so per-message attribution survives the import.
      let speakerMap: Record<string, string> | undefined;
      if (inheritedCharacterIds.length > 1) {
        speakerMap = {};
        const allChars = await app.db.select().from(charactersTable);
        const byId = new Map(allChars.map((ch) => [ch.id, ch] as const));
        for (const cid of inheritedCharacterIds) {
          const ch = byId.get(cid);
          if (!ch) continue;
          try {
            const charData = JSON.parse(ch.data);
            const charName = typeof charData?.name === "string" ? charData.name.trim() : "";
            if (charName) speakerMap[charName] = cid;
          } catch {
            // skip
          }
        }
      }

      // A group chat that already has a mode keeps it for the imported branch.
      let targetMetadata: Record<string, unknown> = {};
      try {
        const parsed: unknown =
          typeof targetChat.metadata === "string" ? JSON.parse(targetChat.metadata) : targetChat.metadata;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          targetMetadata = parsed as Record<string, unknown>;
      } catch {
        targetMetadata = {};
      }
      const targetGroupChatMode =
        targetMetadata.groupChatMode === "individual" || targetMetadata.groupChatMode === "merged"
          ? targetMetadata.groupChatMode
          : undefined;

      const rawName = file.filename ?? "";
      const branchName =
        rawName
          .replace(/\.jsonl$/i, "")
          .replace(/_/g, " ")
          .trim() || "Imported";

      const result = await importSTChat(text, app.db, {
        groupId,
        chatName: targetChat.name,
        branchName,
        mode: targetChat.mode as any,
        ...(inheritedCharacterIds.length === 1 ? { characterId: inheritedCharacterIds[0] } : {}),
        ...(inheritedCharacterIds.length > 0 ? { characterIds: inheritedCharacterIds } : {}),
        ...(speakerMap ? { speakerMap } : {}),
        ...(targetGroupChatMode ? { groupChatMode: targetGroupChatMode } : {}),
        personaId: targetChat.personaId ?? null,
        personaCharacterId: targetChat.personaCharacterId ?? null,
        connectionId: targetChat.connectionId ?? null,
        promptPresetId: targetChat.promptPresetId ?? null,
        ...(timestampOverrides ? { timestampOverrides } : {}),
        sourceFingerprint: stChatFileFingerprint(text),
      });

      if ("error" in result && result.error) return { ...result, groupId: targetChat.groupId ?? null };
      if (!targetHadGroup) {
        try {
          await storage.update(targetChatId, { groupId });
        } catch (err) {
          // The branch must not stay in a group its chat isn't in: take this request's import back out.
          const importedChatId = "chatId" in result ? result.chatId : undefined;
          if (importedChatId) {
            await storage
              .remove(importedChatId)
              .catch((cleanupErr) =>
                logger.warn(cleanupErr, "Could not remove the imported branch %s", importedChatId),
              );
          }
          throw err;
        }
      }
      return { ...result, groupId };
    } finally {
      const entry = pendingChatGroupIds.get(targetChatId);
      if (!targetHadGroup && entry?.groupId === groupId && --entry.imports <= 0)
        pendingChatGroupIds.delete(targetChatId);
    }
  });

  /** Import a Marinara Engine export (.marinara.json). */
  app.post("/marinara", { bodyLimit: IMPORT_BODY_LIMIT_BYTES }, async (req) => {
    const body = { ...(req.body as Record<string, unknown>) };
    const importTags = takeBodyImportTags(body);
    const timestampOverrides = readTimestampOverridesFromBody(body);
    const payload =
      timestampOverrides && body.data && typeof body.data === "object"
        ? {
            ...body,
            data: {
              ...(body.data as Record<string, unknown>),
              metadata: {
                ...(((body.data as Record<string, unknown>).metadata &&
                typeof (body.data as Record<string, unknown>).metadata === "object"
                  ? ((body.data as Record<string, unknown>).metadata as Record<string, unknown>)
                  : {}) as Record<string, unknown>),
                timestamps: timestampOverrides,
              },
            },
          }
        : body;
    return importMarinara(payload as any, app.db, { importTags });
  });

  /**
   * Import a Marinara Engine native package (.marinara file — a zip with
   * data.json plus the avatar binary). Single-file multipart upload. A native
   * .marinara.json too large for the JSON route (a big gallery) is uploaded
   * here as a file too and read in pieces.
   */
  app.post("/marinara-package", { bodyLimit: NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES }, async (req, reply) => {
    const file = await req.file({
      limits: { fields: 2, parts: 3, files: 1, fieldSize: 64 * 1024, fileSize: NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES },
    });
    if (!file) return reply.status(400).send({ success: false, error: "No file uploaded" });
    const buffer = await file.toBuffer();
    const importEnvelope = async (envelope: Record<string, unknown>) => {
      const timestampOverrides = readTimestampOverridesFromMultipart(file as any);
      if (timestampOverrides && envelope.data && typeof envelope.data === "object") {
        const data = envelope.data as Record<string, unknown>;
        const existingMeta =
          data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {};
        data.metadata = { ...existingMeta, timestamps: timestampOverrides };
      }
      return flagDecisionStatements(
        await importMarinara(envelope as any, app.db, { importTags: readMultipartImportTags(file as any) }),
        envelope,
      );
    };
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      const firstChar = buffer
        .subarray(0, 64)
        .toString("utf8")
        .replace(/^\uFEFF/, "")
        .trimStart()[0];
      if (firstChar !== "{") {
        return reply.status(400).send({ success: false, error: "Not a .marinara package (zip signature missing)" });
      }
      let envelope: Record<string, unknown>;
      try {
        envelope = parseJsonBytes(buffer) as Record<string, unknown>;
      } catch {
        return reply.status(400).send({ success: false, error: "The file is not valid JSON" });
      }
      return importEnvelope(envelope);
    }
    // Native packages contain data.json plus an optional avatar. Keep the
    // structural entry boundary, checked before the file list is read, but do
    // not reject legitimate large embedded galleries or avatars by byte size.
    const MAX_PACKAGE_ENTRIES = 8;
    const tooManyEntries = ".marinara package has too many entries";
    let zip: ZipArchive;
    try {
      zip = openZipArchive(buffer, { maxEntries: MAX_PACKAGE_ENTRIES, tooManyEntries });
    } catch (error) {
      const tooMany = error instanceof Error && error.message === tooManyEntries;
      const message = tooMany ? tooManyEntries : "Could not read .marinara package";
      return reply.status(400).send({ success: false, error: message });
    }
    const entries = zip.getEntries();
    let totalUncompressedBytes = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const size = entry.size;
      if (!Number.isSafeInteger(size) || size < 0 || size > NATIVE_PACKAGE_ENTRY_LIMIT_BYTES) {
        return reply.status(413).send({ success: false, error: ".marinara package entry is too large" });
      }
      totalUncompressedBytes += size;
      if (totalUncompressedBytes > NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES) {
        return reply.status(413).send({ success: false, error: ".marinara package contents are too large" });
      }
    }
    const dataEntry = zip.getEntry("data.json");
    if (!dataEntry) {
      return reply.status(400).send({ success: false, error: ".marinara package is missing data.json" });
    }
    let envelope: Record<string, unknown>;
    try {
      const dataJson = dataEntry.read(NATIVE_PACKAGE_ENTRY_LIMIT_BYTES).toString("utf-8");
      envelope = JSON.parse(dataJson) as Record<string, unknown>;
    } catch {
      return reply.status(400).send({ success: false, error: "data.json is not valid JSON" });
    }
    const avatarEntry = entries.find((e) => /^avatar\.(png|jpe?g|webp|gif|avif)$/i.test(e.entryName));
    if (avatarEntry && envelope.data && typeof envelope.data === "object") {
      const ext = avatarEntry.entryName.split(".").pop()!.toLowerCase();
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : ext === "avif"
                ? "image/avif"
                : "image/png";
      const dataUrl = `data:${mime};base64,${avatarEntry.read(NATIVE_PACKAGE_ENTRY_LIMIT_BYTES).toString("base64")}`;
      (envelope.data as Record<string, unknown>).avatar = dataUrl;
    }
    return importEnvelope(envelope);
  });

  /** Import a SillyTavern character (JSON body or PNG file upload). */
  app.post("/st-character", { bodyLimit: IMPORT_BODY_LIMIT_BYTES }, async (req) => {
    const contentType = req.headers["content-type"] ?? "";

    // Handle multipart file upload (PNG character cards)
    if (contentType.includes("multipart/form-data")) {
      const file = await req.file({
        limits: { fields: 9, parts: 10, files: 1, fieldSize: 64 * 1024, fileSize: IMPORT_BODY_LIMIT_BYTES },
      });
      if (!file) return { success: false, error: "No file uploaded" };
      const timestampOverrides = readTimestampOverridesFromMultipart(file as any);
      const importEmbeddedLorebook = readMultipartBooleanField(file as any, "importEmbeddedLorebook");
      const rawTagImportModeField = (file as any)?.fields?.tagImportMode;
      const rawTagImportMode = Array.isArray(rawTagImportModeField)
        ? rawTagImportModeField.at(-1)?.value
        : rawTagImportModeField?.value;
      const tagImportMode = readMultipartTagImportMode(file as any);
      if (rawTagImportMode !== undefined && tagImportMode === undefined) return invalidTagImportModeResponse();
      const rawRegexScriptScopeField = (file as any)?.fields?.regexScriptScope;
      const rawRegexScriptScope = Array.isArray(rawRegexScriptScopeField)
        ? rawRegexScriptScopeField.at(-1)?.value
        : rawRegexScriptScopeField?.value;
      const regexScriptScope = readMultipartRegexScriptScope(file as any);
      if (rawRegexScriptScope !== undefined && regexScriptScope === undefined) return invalidRegexScriptScopeResponse();
      const splitDescription = readMultipartBooleanField(file as any, "splitDescription");
      return importCharacterBuffer(
        file.filename ?? "",
        await file.toBuffer(),
        app.db,
        timestampOverrides,
        importEmbeddedLorebook,
        tagImportMode,
        undefined,
        regexScriptScope,
        splitDescription,
        readMultipartImportTags(file as any),
        undefined,
        readMultipartBooleanField(file as any, "hideEmbeddedLorebook"),
      );
    }

    // Standard JSON body
    const body = { ...(req.body as Record<string, unknown>) };
    const importEmbeddedLorebook = readBooleanOption(body.importEmbeddedLorebook);
    const hideEmbeddedLorebook = readBooleanOption(body.hideEmbeddedLorebook);
    const rawTagImportMode = body.tagImportMode;
    const tagImportMode = readTagImportMode(rawTagImportMode);
    if (rawTagImportMode !== undefined && tagImportMode === undefined) return invalidTagImportModeResponse();
    const rawRegexScriptScope = body.regexScriptScope;
    const regexScriptScope = readRegexScriptScope(rawRegexScriptScope);
    if (rawRegexScriptScope !== undefined && regexScriptScope === undefined) return invalidRegexScriptScopeResponse();
    const splitDescription = readBooleanOption(body.splitDescription);
    const importTags = takeBodyImportTags(body);
    const updateCharacterId = typeof body.updateCharacterId === "string" ? body.updateCharacterId : undefined;
    const useCardPicture = body.useCardPicture !== false;
    const creatorNotes = readCreatorNotesUpdate(body.creatorNotes);
    delete body.importEmbeddedLorebook;
    delete body.hideEmbeddedLorebook;
    delete body.tagImportMode;
    delete body.regexScriptScope;
    delete body.splitDescription;
    delete body.updateCharacterId;
    delete body.useCardPicture;
    delete body.creatorNotes;
    try {
      return await importSTCharacter(body, app.db, {
        timestampOverrides: readTimestampOverridesFromBody(body),
        importEmbeddedLorebook,
        hideEmbeddedLorebook,
        tagImportMode,
        regexScriptScope,
        splitDescription,
        importTags,
        ...(updateCharacterId ? { updateCharacterId, useCardPicture, creatorNotes } : {}),
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  /** Characters a card from the Card Browser may be a newer release of (same page, or same name and creator). */
  app.post("/st-character/matches", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 500) : "");
    return {
      matches: await findMatchingCharacters(app.db, {
        name: text(body.name),
        creator: text(body.creator),
        botBrowserSource: text(body.botBrowserSource),
        characterId: text(body.characterId),
      }),
    };
  });

  /** Inspect character cards before importing, so clients can ask about embedded lorebooks and cards you already have. */
  app.post("/st-character/inspect", { bodyLimit: IMPORT_BODY_LIMIT_BYTES }, async (req, reply) => {
    const parts = req.parts({
      limits: { files: MAX_BATCH_IMPORT_FILES, parts: MAX_BATCH_IMPORT_FILES + 8, fileSize: IMPORT_BODY_LIMIT_BYTES },
    });
    let totalBytes = 0;
    const results: Array<{ filename: string; matches?: CharacterImportMatch[] } & STCharacterImportPreview> = [];
    // The library is read once for every file in the request.
    let candidates: CharacterMatchCandidates | null = null;

    for await (const part of parts) {
      if (part.type !== "file") continue;
      const buffer = await part.toBuffer();
      totalBytes += buffer.length;
      if (totalBytes > IMPORT_BODY_LIMIT_BYTES) {
        return reply.status(413).send({
          success: false,
          error: "Import exceeds the total upload limit",
          results: [],
        });
      }
      try {
        const result = await inspectCharacterBuffer(part.filename ?? "character", buffer);
        let matches: CharacterImportMatch[] = [];
        if (result.success) {
          candidates ??= await loadCharacterMatchCandidates(app.db);
          matches = await findMatchingCharacters(app.db, result, candidates);
        }
        results.push({ filename: part.filename ?? "character", ...result, matches });
      } catch (error) {
        results.push({
          filename: part.filename ?? "character",
          success: false,
          error: error instanceof Error ? error.message : "Inspection failed",
          hasEmbeddedLorebook: false,
          embeddedLorebookEntries: 0,
        });
      }
    }

    return {
      success: results.length > 0,
      results,
    };
  });

  /** Import multiple character cards in one multipart request. */
  app.post("/st-character/batch", { bodyLimit: IMPORT_BODY_LIMIT_BYTES }, async (req, reply) => {
    const parts = req.parts({
      limits: { files: MAX_BATCH_IMPORT_FILES, parts: MAX_BATCH_IMPORT_FILES + 8, fileSize: IMPORT_BODY_LIMIT_BYTES },
    });
    const files: Array<{ filename: string; buffer: Buffer }> = [];
    let totalBytes = 0;
    const timestampEntries: Array<{ name?: string; lastModified?: number | string }> = [];
    let importEmbeddedLorebook: boolean | undefined;
    let hideEmbeddedLorebook: boolean | undefined;
    let tagImportMode: STCharacterTagImportMode | undefined;
    let invalidTagImportMode = false;
    let regexScriptScope: "character" | "global" | undefined;
    let invalidRegexScriptScope = false;
    let splitDescription: boolean | undefined;
    let importTags = readImportTagOptions(undefined);
    let updateTargets: CharacterUpdateTargets = { byIndex: new Map(), byName: new Map() };

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        totalBytes += buffer.length;
        if (totalBytes > IMPORT_BODY_LIMIT_BYTES) {
          return reply.status(413).send({
            success: false,
            error: "Import exceeds the total upload limit",
            results: [],
          });
        }
        files.push({
          filename: part.filename ?? "character",
          buffer,
        });
        continue;
      }

      if (part.fieldname === "fileTimestamps") {
        try {
          const parsed = JSON.parse(String(part.value ?? "[]"));
          if (Array.isArray(parsed)) {
            // Only well-formed entries; a null or a string in the list is dropped instead of failing the upload.
            timestampEntries.push(
              ...parsed.filter(
                (entry): entry is { name?: string; lastModified?: number | string } =>
                  !!entry && typeof entry === "object" && !Array.isArray(entry),
              ),
            );
          }
        } catch {
          // ignore malformed metadata and continue importing
        }
      }

      if (part.fieldname === "importEmbeddedLorebook") {
        importEmbeddedLorebook = readBooleanOption(part.value);
      }

      if (part.fieldname === "hideEmbeddedLorebook") {
        hideEmbeddedLorebook = readBooleanOption(part.value);
      }

      if (part.fieldname === "tagImportMode") {
        tagImportMode = readTagImportMode(part.value);
        invalidTagImportMode ||= part.value !== undefined && tagImportMode === undefined;
      }

      if (part.fieldname === "regexScriptScope") {
        regexScriptScope = readRegexScriptScope(part.value);
        invalidRegexScriptScope ||= part.value !== undefined && regexScriptScope === undefined;
      }

      if (part.fieldname === "splitDescription") {
        splitDescription = readBooleanOption(part.value);
      }

      if (part.fieldname === IMPORT_TAGS_FIELD) {
        importTags = readImportTagOptions(part.value);
      }

      if (part.fieldname === "updateTargets") {
        updateTargets = readCharacterUpdateTargets(part.value);
      }
    }

    if (invalidTagImportMode) return { ...invalidTagImportModeResponse(), results: [] };
    if (invalidRegexScriptScope) return { ...invalidRegexScriptScopeResponse(), results: [] };

    if (files.length === 0) {
      return { success: false, error: "No files uploaded", results: [] };
    }

    const timestampsByName = new Map<string, Array<{ lastModified?: number | string }>>();
    for (const entry of timestampEntries) {
      if (typeof entry.name !== "string" || !entry.name) continue;
      const queue = timestampsByName.get(entry.name) ?? [];
      queue.push(entry);
      timestampsByName.set(entry.name, queue);
    }

    const results = [];
    const existingTagKeys =
      tagImportMode === "existing" && files.length > 0 ? await getExistingCharacterTagKeys(app.db) : undefined;
    for (const [fileIndex, file] of files.entries()) {
      const timestampEntry = timestampsByName.get(file.filename)?.shift();
      const timestampOverrides = normalizeTimestampOverrides({
        createdAt: timestampEntry?.lastModified,
        updatedAt: timestampEntry?.lastModified,
      });
      try {
        const result = await importCharacterBuffer(
          file.filename,
          file.buffer,
          app.db,
          timestampOverrides,
          importEmbeddedLorebook,
          tagImportMode,
          existingTagKeys,
          regexScriptScope,
          splitDescription,
          importTags,
          takeCharacterUpdateTarget(updateTargets, fileIndex, file.filename),
          hideEmbeddedLorebook,
        );
        results.push({ filename: file.filename, ...result });
      } catch (error) {
        results.push({
          filename: file.filename,
          success: false,
          error: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    return {
      success: results.some((result) => result.success),
      results,
    };
  });

  /** Import a SillyTavern prompt preset (JSON body). */
  app.post("/st-preset", async (req) => {
    const body = { ...(req.body as Record<string, unknown>) };
    const importTags = takeBodyImportTags(body);
    const fileName = typeof body.__filename === "string" ? body.__filename : undefined;
    return importSTPreset(body, app.db, fileName, {
      timestampOverrides: readTimestampOverridesFromBody(body),
      importTags,
    });
  });

  /** Import a SillyTavern World Info / lorebook (JSON body). */
  app.post("/st-lorebook", async (req) => {
    const body = { ...(req.body as Record<string, unknown>) };
    const importTags = takeBodyImportTags(body);
    // A lorebook the bot browser brings along carries the site it came from as its source tag.
    const importSource =
      typeof body.__importSource === "string" && body.__importSource.trim()
        ? body.__importSource.trim().slice(0, 40)
        : undefined;
    delete body.__importSource;
    const fallbackName = typeof body.__filename === "string" ? body.__filename : undefined;
    return importSTLorebook(body, app.db, {
      ...(fallbackName ? { fallbackName } : {}),
      timestampOverrides: readTimestampOverridesFromBody(body),
      importTags,
      ...(importSource ? { source: importSource } : {}),
    });
  });

  // ═══════════════════════════════════════════════
  // Bulk Import: Scan + Run from a local ST folder
  // ═══════════════════════════════════════════════

  /** Scan a SillyTavern installation folder, return counts of importable data. */
  app.post("/st-bulk/scan", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "SillyTavern bulk import scan" })) return;
    const resolved = resolveImportFolder(req.body as { folderPath?: unknown; folderToken?: unknown });
    if (!resolved.ok) return { success: false, error: resolved.error };
    return scanSTFolder(resolved.path);
  });

  /** Run a bulk import from a SillyTavern installation folder (SSE stream with progress). */
  app.post("/st-bulk/run", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "SillyTavern bulk import" })) return;
    const { options } = (req.body ?? {}) as {
      folderPath?: string;
      folderToken?: string;
      options?: STBulkImportOptions;
    };
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      return reply.status(400).send({ success: false, error: "Missing import options" });
    }
    const resolved = resolveImportFolder(req.body as { folderPath?: unknown; folderToken?: unknown });
    if (!resolved.ok) return reply.send({ success: false, error: resolved.error });
    const rawCharacterTagImportMode = (req.body as { options?: { characterTagImportMode?: unknown } }).options
      ?.characterTagImportMode;
    const characterTagImportMode = readTagImportMode(rawCharacterTagImportMode);
    if (rawCharacterTagImportMode !== undefined && characterTagImportMode === undefined) {
      return reply.send(invalidTagImportModeResponse());
    }
    if (characterTagImportMode) options.characterTagImportMode = characterTagImportMode;
    const rawBulkRegexScriptScope = (req.body as { options?: { regexScriptScope?: unknown } }).options
      ?.regexScriptScope;
    const bulkRegexScriptScope = readRegexScriptScope(rawBulkRegexScriptScope);
    if (rawBulkRegexScriptScope !== undefined && bulkRegexScriptScope === undefined) {
      return reply.send(invalidRegexScriptScopeResponse());
    }
    if (bulkRegexScriptScope) options.regexScriptScope = bulkRegexScriptScope;
    options.importTags = readImportTagOptions((req.body as { options?: { importTags?: unknown } }).options?.importTags);
    const bulkLorebookOptions = req.body as {
      options?: { importEmbeddedLorebook?: unknown; hideEmbeddedLorebook?: unknown };
    };
    options.importEmbeddedLorebook = readBooleanOption(bulkLorebookOptions.options?.importEmbeddedLorebook);
    options.hideEmbeddedLorebook = readBooleanOption(bulkLorebookOptions.options?.hideEmbeddedLorebook);

    if (stBulkImportJob?.running) {
      return reply.status(409).send({
        success: false,
        code: "import-running",
        error: "A SillyTavern import is already running. Its progress is shown here until it finishes.",
      });
    }
    const job: STBulkImportJob = {
      id: randomUUID(),
      running: true,
      startedAt: new Date().toISOString(),
      progress: null,
      result: null,
    };
    stBulkImportJob = job;

    // Set up SSE headers. The stream is written by hand, so the headers Fastify's hooks already set (CORS and the
    // like) are copied over; and if the stream can't start, the job is not left marked as running forever.
    reply.hijack();
    try {
      reply.raw.writeHead(200, {
        ...(reply.getHeaders() as Record<string, string | string[] | number>),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    } catch (err) {
      job.running = false;
      job.finishedAt = new Date().toISOString();
      job.result = { success: false, error: (err as Error).message, imported: emptyImportCounts(), errors: [] };
      reply.raw.destroy();
      return;
    }

    // The import keeps going when the page goes away (tab closed, laptop asleep, dropped
    // connection): it is the server's work, and stopping halfway would leave half a library.
    // GET /st-bulk/status lets a reopened page pick the progress back up.
    const sendEvent = (event: string, data: unknown) => {
      if (reply.raw.destroyed || reply.raw.writableEnded) return;
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // A heartbeat keeps proxies and browsers from closing a quiet stream during one long item.
    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.write(": keep-alive\n\n");
    }, 15_000);
    heartbeat.unref();

    try {
      const result = await runSTBulkImport(resolved.path, options, app.db, (progress) => {
        job.progress = progress;
        sendEvent("progress", progress);
      });
      job.result = result;
      sendEvent("done", result);
    } catch (err) {
      job.result = { success: false, error: (err as Error).message, imported: emptyImportCounts(), errors: [] };
      sendEvent("done", job.result);
    } finally {
      clearInterval(heartbeat);
      job.running = false;
      job.finishedAt = new Date().toISOString();
    }
    if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
  });

  /** The running or last SillyTavern import, for a page that lost or never had its progress stream. */
  app.get("/st-bulk/status", { config: { rateLimit: STATUS_POLL_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "SillyTavern bulk import" })) return;
    reply.header("Cache-Control", "no-store");
    return { job: stBulkImportJob };
  });

  /** Open a native OS folder picker dialog and return the selected path. */
  app.post("/pick-folder", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Folder picker" })) return;
    const selected = await pickFolder();
    if (!selected) return { success: false, error: "No folder selected" };
    return { success: true, path: selected, folderToken: issueFolderToken(selected, "picker") };
  });

  /** List directories at a given path (for remote/headless folder browsing).
   *  Restricted to subdirectories of the user's home directory to prevent
   *  arbitrary filesystem enumeration. */
  app.post<{ Body: { path?: string } }>("/list-directory", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Folder browser" })) return;
    const home = homedir();
    const requestedPath = (req.body?.path || "").trim();
    const dirPath = requestedPath || home;
    const resolved = pathResolve(dirPath);

    // Restrict browsing to the home directory tree, after following links.
    if (!isHomeContained(resolved)) {
      return { success: false, error: "Access denied: path outside home directory" };
    }

    try {
      const info = await stat(resolved);
      if (!info.isDirectory()) return { success: false, error: "Not a directory" };

      const entries = await readdir(resolved, { withFileTypes: true });
      const folders = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

      return { success: true, path: resolved, folderToken: issueFolderToken(resolved, "browse"), folders };
    } catch {
      return { success: false, error: "Cannot read directory" };
    }
  });
}
