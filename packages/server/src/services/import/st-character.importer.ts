import { syncCharacterBookFromLorebook } from "../lorebook/character-book-sync.js";
// ──────────────────────────────────────────────
// Importer: SillyTavern Character (JSON / V2 Card / CharX)
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { characters as charactersTable } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { createCharactersStorage, withCharacterUpdateQueue } from "../storage/characters.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { createRegexScriptsStorage } from "../storage/regex-scripts.storage.js";
import { importSTLorebook } from "./st-lorebook.importer.js";
import {
  DESCRIPTION_SPLIT_VERSION,
  unassignCardFieldAlternatives,
  capImportedRulesetSheets,
  containsDecisionStatements,
  dropUnreadableOnboarding,
  isPatternSafe,
  ONBOARDING_MAX_QUESTIONS,
  splitCharacterDescription,
  type DescriptionSplitResult,
} from "@marinara-engine/shared";
import type {
  CharacterBookEntryPosition,
  CharacterBookEntryRole,
  CharacterData,
  CreateRegexScriptInput,
  RegexPlacement,
} from "@marinara-engine/shared";
import { existsSync, mkdirSync } from "fs";
import { unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { DATA_DIR } from "../../utils/data-dir.js";
import { isAllowedImageBuffer } from "../../utils/security.js";
import { parseJsonBytes } from "../../utils/large-json.js";
import { openZipArchive, type ZipArchive } from "../../lib/zip-reader.js";
import { normalizeTimestampOverrides, type TimestampOverrides } from "./import-timestamps.js";
import { restoreSprites } from "./marinara.importer.js";

const AVATAR_DIR = join(DATA_DIR, "avatars");
/** The import routes' upload limit. A .charx reads its card and icon up to the same size, so raising
 *  the limit raises both. */
export const IMPORT_BODY_LIMIT_BYTES = 256 * 1024 * 1024;
const IMPORT_METADATA_KEY = "importMetadata";

/** Remove Marinara sprite binaries from card metadata before the normalized card is stored. */
export function takeEmbeddedMarinaraSprites(
  raw: Record<string, unknown>,
  key: "sprites" | "spriteCatalog" = "sprites",
): unknown {
  const cardData = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : raw;
  if (!cardData.extensions || typeof cardData.extensions !== "object") return undefined;
  const extensions = cardData.extensions as Record<string, unknown>;
  if (!extensions.marinara || typeof extensions.marinara !== "object") return undefined;
  const marinara = extensions.marinara as Record<string, unknown>;
  const sprites = marinara[key];
  delete marinara[key];
  return sprites;
}

function ensureAvatarDir() {
  if (!existsSync(AVATAR_DIR)) {
    mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

function countEmbeddedLorebookEntries(book: unknown): number {
  return getCharacterBookEntries(book).length;
}

async function removeImportedAvatarFile(avatarPath: string | undefined) {
  if (!avatarPath?.startsWith("/api/avatars/file/")) return;
  const filename = avatarPath.split("/").pop();
  if (!filename) return;
  try {
    await unlink(join(AVATAR_DIR, filename));
  } catch (err) {
    logger.warn(err, "Failed to roll back imported character avatar");
  }
}

async function rollbackImportedCharacter(db: DB, characterId: string | undefined, avatarPath: string | undefined) {
  if (!characterId) {
    await removeImportedAvatarFile(avatarPath);
    return;
  }

  const characterStorage = createCharactersStorage(db);
  const lorebookStorage = createLorebooksStorage(db);
  try {
    const linkedLorebooks = (await lorebookStorage.listByCharacter(characterId)) as Array<{ id?: string }>;
    for (const lorebook of linkedLorebooks) {
      if (typeof lorebook.id === "string") {
        await lorebookStorage.remove(lorebook.id);
      }
    }
  } catch (err) {
    logger.warn(err, "Failed to roll back imported character lorebook");
  }

  try {
    await characterStorage.remove(characterId);
  } catch (err) {
    logger.warn(err, "Failed to roll back imported character");
  }

  await removeImportedAvatarFile(avatarPath);
}

/**
 * Import a SillyTavern character card (JSON format).
 * Handles V1, V2, Pygmalion, and RisuAI formats.
 * If _avatarDataUrl is present, saves the avatar image.
 */
export interface STCharacterImportPreview {
  success: boolean;
  name?: string;
  creator?: string;
  version?: string;
  hasEmbeddedLorebook: boolean;
  embeddedLorebookEntries: number;
  error?: string;
}

export interface STCharacterImportOptions {
  timestampOverrides?: TimestampOverrides | null;
  importEmbeddedLorebook?: boolean;
  tagImportMode?: STCharacterTagImportMode;
  existingTagKeys?: ReadonlySet<string>;
  /** Where embedded regex scripts land: scoped to the character (default) or global. */
  regexScriptScope?: "character" | "global";
  /** Split a labelled description into personality, appearance, backstory and the other card fields. */
  splitDescription?: boolean;
  /**
   * Update this existing character with the card instead of adding a new one (a newer release of a card you already
   * have). The character keeps its id, so its chats, memories, gallery, sprites, folder and favorite stay with it.
   */
  updateCharacterId?: string;
  /** With updateCharacterId: use the card's picture (default) or keep the current one. */
  useCardPicture?: boolean;
  /**
   * With updateCharacterId, what happens to Creator's Notes, which people edit (custom CSS, the library blurb):
   * "merge" (default) keeps yours and brings in the author's changes, "card" takes the card's, "mine" keeps yours.
   */
  creatorNotes?: CreatorNotesUpdate;
}

/** A character in the library that an imported card may be a newer release of. */
export interface CharacterImportMatch {
  id: string;
  name: string;
  creator: string;
  version: string;
  avatarPath: string | null;
  updatedAt: string;
  /** "browser": downloaded from the same Card Browser page. "name": same name and creator. */
  reason: "browser" | "name";
}

export type CreatorNotesUpdate = "merge" | "card" | "mine";

const STYLE_START = /<style[\s>]/i;

/**
 * Bring the author's changes to Creator's Notes into notes you edited, line by line. `base` is the notes the card
 * came with last time (unknown for imports made before it was remembered). Lines the author added go in before
 * your first style block, so your CSS stays last; lines the author removed are dropped if you still have them as
 * they were. Unedited notes simply become the card's.
 */
export function mergeCreatorNotes(base: string | null, mine: string, theirs: string): string {
  if (base !== null && mine === base) return theirs;
  if (mine === theirs || !theirs.trim()) return mine;
  if (!mine.trim()) return theirs;
  const key = (line: string) => line.trim();
  const baseKeys = new Set((base ?? "").split("\n").map(key));
  const theirLines = theirs.split("\n");
  const theirKeys = new Set(theirLines.map(key));
  const removed = new Set(base === null ? [] : [...baseKeys].filter((line) => line && !theirKeys.has(line)));
  const kept = mine.split("\n").filter((line) => !removed.has(key(line)));
  const keptKeys = new Set(kept.map(key));
  const added = theirLines.filter((line) => key(line) && !baseKeys.has(key(line)) && !keptKeys.has(key(line)));
  if (added.length === 0) return tidyBlankLines(kept);
  const styleAt = kept.findIndex((line) => STYLE_START.test(line));
  const insertAt = styleAt === -1 ? kept.length : styleAt;
  const before = kept.slice(0, insertAt);
  // A blank line between your text and the new lines, unless one is already there.
  const gap = before.length > 0 && key(before[before.length - 1]!) ? [""] : [];
  return tidyBlankLines([...before, ...gap, ...added, ...(styleAt === -1 ? [] : ["", ...kept.slice(insertAt)])]);
}

/** Lines dropped from the middle of your notes leave no stack of empty lines behind, nor any at the ends. */
function tidyBlankLines(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim() && (out.length === 0 || !out[out.length - 1]!.trim())) continue;
    out.push(line);
  }
  while (out.length > 0 && !out[out.length - 1]!.trim()) out.pop();
  return out.join("\n");
}

// SillyTavern regex placement ids → our placement strings (1 = user input, 2 = AI output).
// Unknown-only placement arrays are skipped by the importer instead of being
// silently remapped to AI output.
function convertStPlacements(placement: unknown): RegexPlacement[] | null {
  if (!Array.isArray(placement)) return ["ai_output"];
  const out: RegexPlacement[] = [];
  for (const n of placement) {
    if (n === 1 && !out.includes("user_input")) out.push("user_input");
    else if (n === 2 && !out.includes("ai_output")) out.push("ai_output");
  }
  return out.length > 0 ? out : null;
}

function readBooleanFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function convertStRegexApplyMode(s: Record<string, unknown>): "prompt" | "display" | "both" {
  if (s.applyMode === "prompt" || s.applyMode === "display" || s.applyMode === "both") return s.applyMode;
  const promptOnly =
    readBooleanFlag(s.promptOnly) || readBooleanFlag(s.prompt_only) || readBooleanFlag(s.onlyFormatPrompt);
  const markdownOnly =
    readBooleanFlag(s.markdownOnly) || readBooleanFlag(s.markdown_only) || readBooleanFlag(s.onlyFormatDisplay);
  if (promptOnly && !markdownOnly) return "prompt";
  if (markdownOnly && !promptOnly) return "display";
  return "both";
}

/**
 * Convert a SillyTavern card's embedded `regex_scripts` into CreateRegexScriptInput
 * rows scoped to the imported character. ST stores the pattern as `/source/flags`
 * (or a bare source) and placements as numbers; scripts with an empty or
 * ReDoS-prone source, or one that won't compile, are skipped.
 */
function convertStRegexScripts(
  stScripts: unknown,
  characterId: string,
  scope: "character" | "global",
): CreateRegexScriptInput[] {
  if (!Array.isArray(stScripts)) return [];
  const out: CreateRegexScriptInput[] = [];
  for (const [index, entry] of stScripts.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const s = entry as Record<string, unknown>;
    const rawFind = typeof s.findRegex === "string" ? s.findRegex.trim() : "";
    if (!rawFind) continue;
    // ST patterns are usually `/source/flags`; fall back to treating the whole string as the source.
    const delimited = /^\/(.*)\/([a-z]*)$/is.exec(rawFind);
    const source = delimited ? delimited[1]! : rawFind;
    if (!source || !isPatternSafe(source)) continue;
    const flags = Array.from(new Set((delimited?.[2] ?? "").replace(/[^gimsuy]/g, ""))).join("");
    try {
      new RegExp(source, flags);
    } catch {
      continue;
    }
    const placement = convertStPlacements(s.placement);
    if (!placement) continue;
    const applyMode = convertStRegexApplyMode(s);
    out.push({
      name: typeof s.scriptName === "string" && s.scriptName.trim() ? s.scriptName.trim() : "Imported regex",
      enabled: s.disabled !== true,
      findRegex: source,
      replaceString: typeof s.replaceString === "string" ? s.replaceString : "",
      trimStrings: Array.isArray(s.trimStrings) ? s.trimStrings.filter((t): t is string => typeof t === "string") : [],
      placement,
      flags,
      promptOnly: applyMode === "prompt",
      applyMode,
      targetCharacterIds: scope === "global" ? [] : [characterId],
      targetPromptPresetIds: [],
      // Preserve the card's authoring order so multi-script imports keep a stable
      // execution/list order (all-zero ties leave it undefined). Gaps from skipped
      // entries are harmless — list() only sorts by ascending order.
      order: index,
      minDepth: typeof s.minDepth === "number" ? s.minDepth : null,
      maxDepth: typeof s.maxDepth === "number" ? s.maxDepth : null,
    });
  }
  return out;
}

export type STCharacterTagImportMode = "all" | "none" | "existing";

export async function importSTCharacter(raw: Record<string, unknown>, db: DB, options?: STCharacterImportOptions) {
  const storage = createCharactersStorage(db);
  const normalizedTimestamps = normalizeTimestampOverrides(options?.timestampOverrides);
  const shouldImportEmbeddedLorebook = options?.importEmbeddedLorebook ?? true;
  const tagImportMode = options?.tagImportMode ?? "all";
  const embeddedMarinaraSprites = takeEmbeddedMarinaraSprites(raw);
  const embeddedSpriteCatalog = takeEmbeddedMarinaraSprites(raw, "spriteCatalog");

  // Extract avatar data URL if present (from PNG import)
  const avatarDataUrl = raw._avatarDataUrl as string | null;
  delete raw._avatarDataUrl;

  // Extract browser source marker if present
  const botBrowserSource = raw._botBrowserSource as string | null;
  delete raw._botBrowserSource;

  const data = normalizeCharacterData(raw);
  data.extensions.cardFieldAlternatives = unassignCardFieldAlternatives(data.extensions.cardFieldAlternatives);
  const rawEmbeddedLorebook = extractRawCharacterBook(raw) ?? data.character_book;
  if (rawEmbeddedLorebook) {
    data.character_book = normalizeCharacterBook(rawEmbeddedLorebook);
  }
  data.tags = await filterImportedTags(data.tags, db, tagImportMode, options?.existingTagKeys);

  // Cards that keep everything in the description are split into Marinara's fields when asked.
  // The card is imported as it came and the split is saved afterwards as a new card version, so
  // the unsplit card stays in the version history. The outcome is reported for every card, so the
  // import list can show the same summary as the editor's split dialog.
  const split = options?.splitDescription ? splitCharacterDescription(data) : null;
  let descriptionSplit: DescriptionSplitResult | null = split;

  // Tag with browser source if imported from browser
  if (botBrowserSource) {
    data.extensions.botBrowserSource = botBrowserSource;
  }

  const existingImportMetadata =
    data.extensions[IMPORT_METADATA_KEY] && typeof data.extensions[IMPORT_METADATA_KEY] === "object"
      ? (data.extensions[IMPORT_METADATA_KEY] as Record<string, unknown>)
      : {};
  const cardSpecMetadata = buildCardSpecMetadata(raw);
  const embeddedLorebookEntries = countEmbeddedLorebookEntries(data.character_book);
  const hasEmbeddedLorebook = embeddedLorebookEntries > 0;
  // Strip any `lorebookId` carried by the source card. That ID references
  // the exporter's database (e.g. a different Marinara instance), not
  // ours, so preserving it leaves an orphan pointer that makes "Edit
  // Linked Lorebook" open a 404 editor before the auto-import below has
  // a chance to set the real ID. The fresh value is written below at the
  // end of the auto-import branch when (and only when) we actually
  // created a lorebook in this DB.
  const carriedEmbeddedLorebook =
    typeof existingImportMetadata.embeddedLorebook === "object" && existingImportMetadata.embeddedLorebook
      ? (existingImportMetadata.embeddedLorebook as Record<string, unknown>)
      : {};
  const { lorebookId: _staleLorebookId, ...sanitizedEmbeddedLorebook } = carriedEmbeddedLorebook;
  void _staleLorebookId;
  data.extensions[IMPORT_METADATA_KEY] = {
    ...existingImportMetadata,
    // The notes as the card came, so a later update can merge the author's changes into notes you edited.
    importedCreatorNotes: data.creator_notes ?? "",
    ...(cardSpecMetadata ? { card: cardSpecMetadata } : {}),
    embeddedLorebook: {
      ...sanitizedEmbeddedLorebook,
      hasEmbeddedLorebook,
    },
  };

  // Save avatar image if provided
  let avatarPath: string | undefined;
  if (avatarDataUrl && avatarDataUrl.startsWith("data:image/")) {
    // Strip data URL header → raw base64
    const base64 = avatarDataUrl.split(",")[1];
    if (base64) {
      const declaredExt = avatarDataUrl.match(/^data:image\/([\w+]+);/)?.[1]?.replace("+xml", "");
      const avatarBuffer = Buffer.from(base64, "base64");
      const imageInfo = isAllowedImageBuffer(avatarBuffer, declaredExt ? `.${declaredExt}` : undefined);
      if (imageInfo) {
        ensureAvatarDir();
        const filename = `${randomUUID()}.${imageInfo.ext}`;
        const filePath = join(AVATAR_DIR, filename);
        await writeFile(filePath, avatarBuffer);
        avatarPath = `/api/avatars/file/${filename}`;
      }
    }
  }

  if (options?.updateCharacterId) {
    return updateCharacterFromCard({
      db,
      characterId: options.updateCharacterId,
      raw,
      data,
      rawEmbeddedLorebook,
      avatarPath,
      useCardPicture: options.useCardPicture !== false,
      shouldImportEmbeddedLorebook,
      hasEmbeddedLorebook,
      embeddedLorebookEntries,
      embeddedMarinaraSprites,
      embeddedSpriteCatalog,
      split,
      options,
    });
  }

  const character = await storage.create(data, avatarPath, normalizedTimestamps);
  const charId = (character as { id?: string } | null)?.id;

  // Extract character_book into a standalone lorebook linked to this character
  let lorebookResult: { lorebookId?: string; entriesImported?: number } | null = null;
  if (shouldImportEmbeddedLorebook && data.character_book && charId) {
    const wiData = embeddedBookAsWorldInfo(data.name, rawEmbeddedLorebook);

    try {
      const result = await importSTLorebook(wiData, db, {
        characterId: charId,
        namePrefix: data.name,
        timestampOverrides: options?.timestampOverrides,
        beforeCommit: async (tx, result) => {
          const updatedImportMetadata = {
            ...(data.extensions[IMPORT_METADATA_KEY] as Record<string, unknown>),
            embeddedLorebook: {
              ...(((data.extensions[IMPORT_METADATA_KEY] as Record<string, unknown>)?.embeddedLorebook as
                Record<string, unknown> | undefined) ?? {}),
              hasEmbeddedLorebook: true,
              lorebookId: result.lorebookId,
            },
          };
          data.extensions[IMPORT_METADATA_KEY] = updatedImportMetadata;
          const updated = await createCharactersStorage(tx).update(
            charId,
            { extensions: { ...data.extensions } },
            undefined,
            {
              updatedAt: normalizedTimestamps?.updatedAt ?? normalizedTimestamps?.createdAt ?? null,
              skipVersionSnapshot: true,
            },
          );
          if (!updated) throw new Error("Character no longer exists");
          await syncCharacterBookFromLorebook(tx, result.lorebookId, { throwOnError: true });
        },
      });
      lorebookResult = {
        lorebookId: result.lorebookId,
        entriesImported: result.entriesImported,
      };
    } catch (err) {
      await rollbackImportedCharacter(db, charId, avatarPath);
      logger.warn(err, "Rolled back character import after embedded lorebook import failed");
      throw err;
    }
  }

  // Import any regex scripts embedded in the ST card, scoped to this character.
  if (charId) await importEmbeddedRegexScripts(db, raw, charId, options?.regexScriptScope);

  if (charId && embeddedMarinaraSprites !== undefined) {
    try {
      await restoreSprites(embeddedMarinaraSprites, charId, embeddedSpriteCatalog);
    } catch (err) {
      logger.warn(err, "Skipped optional embedded sprite restore for %s", charId);
    }
  }

  if (charId && split?.status === "changed") {
    const { appearance, backstory, ...fields } = split.after;
    try {
      await storage.update(charId, { ...fields, extensions: { appearance, backstory } }, undefined, {
        versionSource: DESCRIPTION_SPLIT_VERSION.source,
        versionReason: DESCRIPTION_SPLIT_VERSION.reason,
        updatedAt: normalizedTimestamps?.updatedAt ?? normalizedTimestamps?.createdAt ?? null,
      });
    } catch (err) {
      logger.warn(err, "Imported %s without splitting its description", charId);
      descriptionSplit = {
        ...split,
        status: "skipped",
        reason: "the split could not be saved",
        after: { ...split.before },
        changed: [],
        keywordSorted: false,
      };
    }
  }

  return {
    success: true,
    characterId: charId,
    name: data.name,
    embeddedLorebook: {
      hasEmbeddedLorebook,
      entries: embeddedLorebookEntries,
      imported: !!lorebookResult,
      skipped: hasEmbeddedLorebook && !shouldImportEmbeddedLorebook,
    },
    ...(lorebookResult ? { lorebook: lorebookResult } : {}),
    ...(descriptionSplit ? { descriptionSplit } : {}),
  };
}

// ST character_book uses the same shape as World Info.
function embeddedBookAsWorldInfo(characterName: string, rawEmbeddedLorebook: unknown): Record<string, unknown> {
  const bookRaw = rawEmbeddedLorebook as Record<string, unknown>;
  return {
    name: `${characterName}'s Lorebook`,
    entries: bookRaw.entries ?? {},
    description: bookRaw.description,
    scan_depth: bookRaw.scan_depth,
    scanDepth: bookRaw.scanDepth,
    token_budget: bookRaw.token_budget,
    tokenBudget: bookRaw.tokenBudget,
    recursive_scanning: bookRaw.recursive_scanning,
    recursiveScanning: bookRaw.recursiveScanning,
    max_recursion_depth: bookRaw.max_recursion_depth,
    maxRecursionDepth: bookRaw.maxRecursionDepth,
    extensions: bookRaw.extensions ?? {},
  };
}

// RisuAI cards keep some extensions as top-level fields (see convertRisuToV2).
const RISU_TOP_LEVEL_EXTENSIONS: Array<[field: string, key: string]> = [
  ["depth_prompt", "depth_prompt"],
  ["depthPrompt", "depth_prompt"],
  ["talkativeness", "talkativeness"],
  ["regex_scripts", "regex_scripts"],
  ["regexScripts", "regex_scripts"],
  ["backstory", "backstory"],
  ["appearance", "appearance"],
];

/** The extensions a card file itself carries, including RisuAI's top-level ones. */
function rawCardExtensions(raw: Record<string, unknown>): Record<string, unknown> {
  const cardData = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : raw;
  const extensions: Record<string, unknown> = {};
  for (const source of cardData === raw ? [raw] : [raw, cardData]) {
    for (const [field, key] of RISU_TOP_LEVEL_EXTENSIONS) {
      if (source[field] !== undefined && extensions[key] === undefined) extensions[key] = source[field];
    }
  }
  // As convertRisuToV2 reads { ...raw, ...data }: data's extensions, else a RisuAI card's top-level ones.
  const own =
    cardData.extensions && typeof cardData.extensions === "object"
      ? cardData.extensions
      : raw.type === "character" && raw.extensions && typeof raw.extensions === "object"
        ? raw.extensions
        : null;
  return own ? { ...extensions, ...(own as Record<string, unknown>) } : extensions;
}

/**
 * Import the regex scripts embedded in a card and remember their ids on the character (importMetadata.regexScriptIds),
 * so a later update can bring them in line with the newer card. On update the remembered scripts are updated by name
 * (keeping whether you turned them off), the card's new scripts are added, and remembered scripts the card no longer
 * has are removed. Scripts you made yourself are never touched. A character imported before ids were remembered
 * skips scripts it already has, as an exact copy.
 */
async function importEmbeddedRegexScripts(
  db: DB,
  raw: Record<string, unknown>,
  charId: string,
  scope: "character" | "global" | undefined,
  update?: { recordedIds: string[] | null },
) {
  const importedRegex = convertStRegexScripts(rawCardExtensions(raw).regex_scripts, charId, scope ?? "character");
  const regexStorage = createRegexScriptsStorage(db);
  const scriptKey = (script: { name: string; findRegex: string; replaceString?: string | null }) =>
    JSON.stringify([script.name, script.findRegex, script.replaceString ?? ""]);
  const keptIds: string[] = [];
  // Recorded ids per name, in order: a card may carry several scripts with one name.
  const recordedByName = new Map<string, string[]>();
  const recordedIds = new Set(update?.recordedIds ?? []);
  const existingKeys = new Map<string, string>();
  if (update) {
    for (const script of await regexStorage.list()) {
      if (recordedIds.has(script.id)) {
        const queue = recordedByName.get(script.name) ?? [];
        queue.push(script.id);
        recordedByName.set(script.name, queue);
        continue;
      }
      if (update.recordedIds) continue;
      const targets = parseStringArray(script.targetCharacterIds);
      if (targets.length === 0 || targets.includes(charId)) existingKeys.set(scriptKey(script), script.id);
    }
  }
  let created = 0;
  for (const input of importedRegex) {
    try {
      const recordedId = recordedByName.get(input.name)?.shift();
      if (recordedId) {
        // Remembered even if the edit below fails, so the script is never left untracked.
        keptIds.push(recordedId);
        // Only the card's own rule changes. Whether it is on, its place, and which characters and presets it
        // applies to are yours.
        const {
          enabled: _enabled,
          order: _order,
          targetCharacterIds: _targetCharacterIds,
          targetPromptPresetIds: _targetPromptPresetIds,
          ...fields
        } = input;
        void _enabled;
        void _order;
        void _targetCharacterIds;
        void _targetPromptPresetIds;
        await regexStorage.update(recordedId, fields);
        continue;
      }
      const existingId = existingKeys.get(scriptKey(input));
      if (existingId) {
        keptIds.push(existingId);
        continue;
      }
      const script = await regexStorage.create(input);
      if (script?.id) keptIds.push(script.id);
      created += 1;
    } catch (err) {
      logger.warn(err, "Failed to import an embedded regex script");
    }
  }
  // Scripts from the previous release that the newer card dropped.
  for (const staleId of [...recordedByName.values()].flat()) {
    try {
      await regexStorage.remove(staleId);
    } catch (err) {
      keptIds.push(staleId);
      logger.warn(err, "Failed to remove a regex script the newer card dropped");
    }
  }
  if (created > 0) logger.info("Imported %d embedded regex script(s) for character %s", created, charId);
  if (keptIds.length === 0 && !update?.recordedIds) return;
  try {
    await withCharacterUpdateQueue(charId, () =>
      createCharactersStorage(db).update(
        charId,
        { extensions: { [IMPORT_METADATA_KEY]: { regexScriptIds: keptIds } } },
        undefined,
        { skipVersionSnapshot: true },
      ),
    );
  } catch (err) {
    logger.warn(err, "Could not remember the regex scripts imported for character %s", charId);
  }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    return parseStringArray(JSON.parse(value));
  } catch {
    return [];
  }
}

function matchKey(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
}

/** The library's characters, read once, for matching several cards against (see findMatchingCharacters). */
export type CharacterMatchCandidates = Array<{
  id: string;
  data: Record<string, unknown>;
  avatarPath: string | null;
  updatedAt: string;
}>;

export async function loadCharacterMatchCandidates(db: DB): Promise<CharacterMatchCandidates> {
  const rows = await db
    .select({
      id: charactersTable.id,
      data: charactersTable.data,
      avatarPath: charactersTable.avatarPath,
      updatedAt: charactersTable.updatedAt,
    })
    .from(charactersTable);
  const candidates: CharacterMatchCandidates = [];
  for (const row of rows) {
    try {
      const data = JSON.parse(row.data) as unknown;
      if (!data || typeof data !== "object") continue;
      candidates.push({
        id: row.id,
        data: data as Record<string, unknown>,
        avatarPath: row.avatarPath ?? null,
        updatedAt: String(row.updatedAt ?? ""),
      });
    } catch {
      continue;
    }
  }
  return candidates;
}

/**
 * Characters an imported card may be a newer release of: the one downloaded from the same Card Browser page, or one
 * with the same name whose creator matches (or is blank on either side, as cards passed through other apps often are).
 * Pass `candidates` from loadCharacterMatchCandidates to match many cards against one read of the library.
 */
export async function findMatchingCharacters(
  db: DB,
  card: {
    name?: string | null;
    creator?: string | null;
    botBrowserSource?: string | null;
    characterId?: string | null;
  },
  candidates?: CharacterMatchCandidates,
): Promise<CharacterImportMatch[]> {
  const name = matchKey(card.name);
  const creator = matchKey(card.creator);
  const source = typeof card.botBrowserSource === "string" ? card.botBrowserSource.trim() : "";
  // A chosen character ("Update from card file…" in its editor) is the only match, whatever the card is called.
  const characterId = typeof card.characterId === "string" ? card.characterId : "";
  if (!name && !source && !characterId) return [];
  const rows = candidates ?? (await loadCharacterMatchCandidates(db));
  const matches: CharacterImportMatch[] = [];
  for (const row of rows) {
    const data = row.data;
    const extensions =
      data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
    const sameSource = !!source && extensions.botBrowserSource === source;
    const rowCreator = matchKey(data.creator);
    const sameName = !!name && matchKey(data.name) === name && (!creator || !rowCreator || creator === rowCreator);
    if (characterId ? row.id !== characterId : !sameSource && !sameName) continue;
    matches.push({
      id: row.id,
      name: typeof data.name === "string" ? data.name : "",
      creator: typeof data.creator === "string" ? data.creator : "",
      version: typeof data.character_version === "string" ? data.character_version : "",
      avatarPath: row.avatarPath,
      updatedAt: row.updatedAt,
      reason: sameSource ? "browser" : "name",
    });
  }
  // The Card Browser link first, then the most recently changed.
  return matches
    .sort((a, b) => (a.reason === b.reason ? b.updatedAt.localeCompare(a.updatedAt) : a.reason === "browser" ? -1 : 1))
    .slice(0, 5);
}

// Extension keys that belong to the user's copy, not to the card: an update never takes them from the new card.
const USER_OWNED_EXTENSION_KEYS = new Set([
  "fav",
  "world",
  "versioningEnabled",
  "avatarCrop",
  "nameColor",
  "dialogueColor",
  "boxColor",
  "cardFieldAlternatives",
  "characterSheetImageId",
  "useCharacterSheetAsReference",
  "conversationStatus",
  "conversationStatusOverride",
  "conversationSchedule",
  "conversationScheduleAutoRenew",
  "phoneticName",
  "combatIcon",
  "rulesetSheets",
  "trackerCustomFieldDefaults",
  IMPORT_METADATA_KEY,
  "botBrowserSource",
]);
// Card text Marinara keeps in extensions. A new card without them clears the old text (it stays in Version history),
// so a card whose description now holds everything does not repeat it in Appearance and Backstory.
const CARD_TEXT_EXTENSION_KEYS = ["appearance", "backstory"] as const;

async function updateCharacterFromCard(input: {
  db: DB;
  characterId: string;
  raw: Record<string, unknown>;
  data: CharacterData;
  rawEmbeddedLorebook: unknown;
  avatarPath: string | undefined;
  useCardPicture: boolean;
  shouldImportEmbeddedLorebook: boolean;
  hasEmbeddedLorebook: boolean;
  embeddedLorebookEntries: number;
  embeddedMarinaraSprites: unknown;
  embeddedSpriteCatalog: unknown;
  split: DescriptionSplitResult | null;
  options: STCharacterImportOptions;
}) {
  const { db, characterId, data } = input;
  const storage = createCharactersStorage(db);
  const keepPicture = !input.useCardPicture || !input.avatarPath;
  const discardNewPicture = () => (keepPicture ? removeImportedAvatarFile(input.avatarPath) : Promise.resolve());
  const existing = await storage.getById(characterId);
  if (!existing) {
    await removeImportedAvatarFile(input.avatarPath);
    return { success: false, error: "The character to update no longer exists" };
  }
  const current = JSON.parse(existing.data) as CharacterData;
  const currentExtensions = (current.extensions ?? {}) as Record<string, unknown>;
  const cardExtensionKeys = new Set(Object.keys(rawCardExtensions(input.raw)));

  const extensions: Record<string, unknown> = { ...currentExtensions };
  for (const [key, value] of Object.entries(data.extensions)) {
    if (USER_OWNED_EXTENSION_KEYS.has(key)) continue;
    if (cardExtensionKeys.has(key)) extensions[key] = value;
  }
  for (const key of CARD_TEXT_EXTENSION_KEYS) extensions[key] = data.extensions[key] ?? "";
  // The new picture needs its own framing.
  if (!keepPicture) delete extensions.avatarCrop;
  const newBrowserSource = data.extensions.botBrowserSource;
  if (typeof newBrowserSource === "string" && newBrowserSource) extensions.botBrowserSource = newBrowserSource;
  const currentImportMetadata =
    currentExtensions[IMPORT_METADATA_KEY] && typeof currentExtensions[IMPORT_METADATA_KEY] === "object"
      ? (currentExtensions[IMPORT_METADATA_KEY] as Record<string, unknown>)
      : {};
  const newImportMetadata = data.extensions[IMPORT_METADATA_KEY] as Record<string, unknown>;
  const currentEmbedded =
    currentImportMetadata.embeddedLorebook && typeof currentImportMetadata.embeddedLorebook === "object"
      ? (currentImportMetadata.embeddedLorebook as Record<string, unknown>)
      : {};
  extensions[IMPORT_METADATA_KEY] = {
    ...currentImportMetadata,
    ...newImportMetadata,
    embeddedLorebook: { ...currentEmbedded, hasEmbeddedLorebook: input.hasEmbeddedLorebook },
  };

  const { tags: cardTags, extensions: _cardExtensions, ...cardFields } = data;
  void _cardExtensions;
  const notesChoice = input.options.creatorNotes ?? "merge";
  if (notesChoice !== "card") {
    const mine = typeof current.creator_notes === "string" ? current.creator_notes : "";
    const base =
      typeof currentImportMetadata.importedCreatorNotes === "string"
        ? currentImportMetadata.importedCreatorNotes
        : null;
    cardFields.creator_notes =
      notesChoice === "mine" ? mine : mergeCreatorNotes(base, mine, cardFields.creator_notes ?? "");
  }
  const tags = [...(Array.isArray(current.tags) ? current.tags : [])];
  const tagKeys = new Set(tags.map(tagKey));
  for (const tag of cardTags) {
    if (!tagKeys.has(tagKey(tag))) {
      tags.push(tag);
      tagKeys.add(tagKey(tag));
    }
  }
  const versionReason = "Updated from a newer card";
  // Version history keeps the card as it was, even with Automatic versioning off, so the update can be undone.
  if (currentExtensions.versioningEnabled === false) {
    await storage.createVersionSnapshot(characterId, { source: "card-update", reason: versionReason });
  }
  let updated;
  try {
    updated = await withCharacterUpdateQueue(characterId, () =>
      storage.update(
        characterId,
        { ...cardFields, tags, extensions } as CharacterData,
        keepPicture ? undefined : input.avatarPath,
        {
          mergeExtensions: false,
          versionSource: "card-update",
          versionReason,
        },
      ),
    );
  } catch (err) {
    await removeImportedAvatarFile(input.avatarPath);
    throw err;
  }
  await discardNewPicture();
  if (!updated) return { success: false, error: "The character to update no longer exists" };

  // The card's lorebook replaces the entries of the lorebook made from it before, or becomes a new linked one.
  let lorebookResult: { lorebookId?: string; entriesImported?: number } | null = null;
  let lorebookError: string | undefined;
  if (input.shouldImportEmbeddedLorebook && data.character_book) {
    const existingLorebookId = typeof currentEmbedded.lorebookId === "string" ? currentEmbedded.lorebookId : null;
    try {
      const result = await importSTLorebook(embeddedBookAsWorldInfo(data.name, input.rawEmbeddedLorebook), db, {
        characterId,
        namePrefix: data.name,
        existingLorebookId,
        beforeCommit: async (tx, result) => {
          const latest = await createCharactersStorage(tx).getById(characterId);
          const latestData = latest ? (JSON.parse(latest.data) as CharacterData) : null;
          const latestMetadata = (latestData?.extensions?.[IMPORT_METADATA_KEY] ?? {}) as Record<string, unknown>;
          await createCharactersStorage(tx).update(
            characterId,
            {
              extensions: {
                [IMPORT_METADATA_KEY]: {
                  ...latestMetadata,
                  embeddedLorebook: {
                    ...((latestMetadata.embeddedLorebook as Record<string, unknown> | undefined) ?? {}),
                    hasEmbeddedLorebook: true,
                    lorebookId: result.lorebookId,
                  },
                },
              },
            },
            undefined,
            { skipVersionSnapshot: true },
          );
          await syncCharacterBookFromLorebook(tx, result.lorebookId, { throwOnError: true });
        },
      });
      lorebookResult = { lorebookId: result.lorebookId, entriesImported: result.entriesImported };
    } catch (err) {
      logger.warn(err, "Updated character %s but not its lorebook", characterId);
      lorebookError = err instanceof Error ? err.message : String(err);
    }
  }

  const recordedRegexIds = Array.isArray(currentImportMetadata.regexScriptIds)
    ? currentImportMetadata.regexScriptIds.filter((id): id is string => typeof id === "string")
    : null;
  await importEmbeddedRegexScripts(db, input.raw, characterId, input.options.regexScriptScope, {
    recordedIds: recordedRegexIds,
  });

  if (input.embeddedMarinaraSprites !== undefined) {
    try {
      await restoreSprites(input.embeddedMarinaraSprites, characterId, input.embeddedSpriteCatalog);
    } catch (err) {
      logger.warn(err, "Skipped optional embedded sprite restore for %s", characterId);
    }
  }

  let descriptionSplit: DescriptionSplitResult | null = input.split;
  if (input.split?.status === "changed") {
    const { appearance, backstory, ...fields } = input.split.after;
    try {
      await storage.update(characterId, { ...fields, extensions: { appearance, backstory } }, undefined, {
        versionSource: DESCRIPTION_SPLIT_VERSION.source,
        versionReason: DESCRIPTION_SPLIT_VERSION.reason,
      });
    } catch (err) {
      logger.warn(err, "Updated %s without splitting its description", characterId);
      descriptionSplit = {
        ...input.split,
        status: "skipped",
        reason: "the split could not be saved",
        after: { ...input.split.before },
        changed: [],
        keywordSorted: false,
      };
    }
  }

  return {
    success: true,
    updated: true,
    characterId,
    name: data.name,
    embeddedLorebook: {
      hasEmbeddedLorebook: input.hasEmbeddedLorebook,
      entries: input.embeddedLorebookEntries,
      imported: !!lorebookResult,
      skipped: input.hasEmbeddedLorebook && !input.shouldImportEmbeddedLorebook,
    },
    ...(lorebookResult ? { lorebook: lorebookResult } : {}),
    ...(lorebookError ? { lorebookError } : {}),
    ...(descriptionSplit ? { descriptionSplit } : {}),
  };
}

export function inspectSTCharacter(raw: Record<string, unknown>): STCharacterImportPreview {
  try {
    const data = normalizeCharacterData(raw);
    const embeddedLorebookEntries = countEmbeddedLorebookEntries(data.character_book);
    return {
      success: true,
      name: data.name,
      creator: data.creator ?? "",
      version: data.character_version ?? "",
      hasEmbeddedLorebook: embeddedLorebookEntries > 0,
      embeddedLorebookEntries,
    };
  } catch (error) {
    return {
      success: false,
      hasEmbeddedLorebook: false,
      embeddedLorebookEntries: 0,
      error: error instanceof Error ? error.message : "Invalid character card",
    };
  }
}

/**
 * Import a CharX (.charx) file — RisuAI Character Card V3 zip format.
 * Extracts card.json and the main icon asset from the zip.
 */
export async function importCharX(buf: Buffer, db: DB, options?: STCharacterImportOptions) {
  const zip = openZipArchive(buf);

  // Extract card.json from root of the zip
  const cardJson = readCharXCardJson(zip);
  if (!cardJson) return { success: false, error: "Invalid .charx file: missing card.json at root." };

  // Resolve the main icon asset from the zip
  let avatarDataUrl: string | null = null;

  // The card.json is a CCv3 wrapper: { spec: "chara_card_v3", data: { ... } }
  const cardData = (cardJson.data ?? cardJson) as Record<string, unknown>;
  const assets = cardData.assets as Array<{ type: string; uri: string; name: string; ext: string }> | undefined;

  if (assets && Array.isArray(assets)) {
    // Find the main icon asset
    const mainIcon =
      assets.find((a) => a.type === "icon" && a.name === "main") ?? assets.find((a) => a.type === "icon");

    if (mainIcon && mainIcon.uri) {
      avatarDataUrl = resolveCharXAsset(zip, mainIcon.uri, mainIcon.ext);
    }
  }

  // If no icon found via assets, check for common fallback paths
  if (!avatarDataUrl) {
    for (const fallback of [
      "assets/icon/images/main.png",
      "assets/icon/images/main.webp",
      "assets/icon/images/main.jpg",
    ]) {
      const entry = zip.getEntry(fallback);
      if (entry) {
        const ext = fallback.split(".").pop() ?? "png";
        const data = entry.read(IMPORT_BODY_LIMIT_BYTES);
        const imageInfo = isAllowedImageBuffer(data, `.${ext}`);
        if (imageInfo) {
          avatarDataUrl = `data:${imageInfo.mimeType};base64,${data.toString("base64")}`;
          break;
        }
      }
    }
  }

  // Attach avatar and delegate to the standard importer
  if (avatarDataUrl) {
    cardJson._avatarDataUrl = avatarDataUrl;
  }

  const result = await importSTCharacter(cardJson as Record<string, unknown>, db, options);
  // The importer reports decision statements (#6569); only the server opens a .charx.
  return result.success && containsDecisionStatements(cardJson) ? { ...result, usesDecisions: true } : result;
}

export function inspectCharX(buf: Buffer): STCharacterImportPreview {
  try {
    const zip = openZipArchive(buf);
    const cardJson = readCharXCardJson(zip);
    if (!cardJson) {
      return {
        success: false,
        hasEmbeddedLorebook: false,
        embeddedLorebookEntries: 0,
        error: "Invalid .charx file: missing card.json at root.",
      };
    }
    return inspectSTCharacter(cardJson);
  } catch (error) {
    return {
      success: false,
      hasEmbeddedLorebook: false,
      embeddedLorebookEntries: 0,
      error: error instanceof Error ? error.message : "Invalid .charx file",
    };
  }
}

function readCharXCardJson(zip: ZipArchive): Record<string, unknown> | null {
  const cardEntry = zip.getEntry("card.json");
  if (!cardEntry) return null;
  return parseJsonBytes(cardEntry.read(IMPORT_BODY_LIMIT_BYTES)) as Record<string, unknown>;
}

function normalizeCharacterData(raw: Record<string, unknown>): CharacterData {
  // Detect format
  if ((raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") && raw.data) {
    // V2 / V3 format — extract from data wrapper
    return normalizeV2(raw.data as Record<string, unknown>);
  }
  if (raw.type === "character" && raw.data) {
    // RisuAI format
    const data = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {};
    return convertRisuToV2({ ...raw, ...data });
  }
  if (raw.char_name || raw.name) {
    // V1 / Pygmalion format — convert to V2
    return convertV1toV2(raw);
  }
  // Try treating the whole object as character data
  return normalizeV2(raw);
}

function extractRawCharacterBook(raw: Record<string, unknown>): unknown {
  if ((raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") && raw.data && typeof raw.data === "object") {
    return selectBestCharacterBook(raw.character_book, (raw.data as Record<string, unknown>).character_book);
  }
  if (raw.type === "character" && raw.data && typeof raw.data === "object") {
    return selectBestCharacterBook(raw.character_book, (raw.data as Record<string, unknown>).character_book);
  }
  return raw.character_book;
}

function getCharacterBookEntries(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = (raw as Record<string, unknown>).entries;
  if (Array.isArray(entries))
    return entries.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
  if (entries && typeof entries === "object") {
    return Object.values(entries).filter(
      (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object",
    );
  }
  return [];
}

function selectBestCharacterBook(...books: unknown[]): unknown {
  let best: unknown = null;
  let bestNamedEntries = -1;

  for (const book of books) {
    if (!book || typeof book !== "object") continue;
    const entries = getCharacterBookEntries(book);
    if (entries.length === 0) continue;
    const namedEntries = entries.filter((entry) => firstNonEmptyString(entry.comment, entry.name)).length;
    if (namedEntries > bestNamedEntries) {
      best = book;
      bestNamedEntries = namedEntries;
    }
  }

  return best;
}

function normalizeCharacterBookPosition(value: unknown): CharacterBookEntryPosition {
  if (typeof value === "string") {
    if (value === "after_char" || value === "at_depth" || value === "depth") return value;
    return "before_char";
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 7) {
    return value as CharacterBookEntryPosition;
  }
  return "before_char";
}

function normalizeCharacterBookRole(value: unknown): CharacterBookEntryRole | undefined {
  if (value === "system" || value === "user" || value === "assistant") return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2) {
    return value as CharacterBookEntryRole;
  }
  return undefined;
}

function optionalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickDefinedFields(source: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
}

const V3_CHARACTER_DATA_FIELDS = [
  "group_only_greetings",
  "nickname",
  "assets",
  "creation_date",
  "source",
  "creator_notes_multilingual",
];

const CHARACTER_BOOK_ENTRY_PASSTHROUGH_FIELDS = [
  "probability",
  "useProbability",
  "use_probability",
  "selectiveLogic",
  "sticky",
  "cooldown",
  "delay",
  "group",
  "groupWeight",
  "scanDepth",
  "scan_depth",
  "matchWholeWords",
  "match_whole_words",
  "caseSensitive",
  "case_sensitive",
  "useRegex",
  "regex",
  "preventRecursion",
  "excludeRecursion",
  "delayUntilRecursion",
  "vectorized",
  "outletName",
  "decisionStatement",
  "decisionMode",
];

function buildCardSpecMetadata(raw: Record<string, unknown>) {
  const spec = typeof raw.spec === "string" ? raw.spec : null;
  const specVersion = typeof raw.spec_version === "string" ? raw.spec_version : null;
  if (!spec && !specVersion) return null;

  return {
    ...(spec ? { spec } : {}),
    ...(specVersion ? { specVersion } : {}),
  };
}

function tagKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

export async function getExistingCharacterTagKeys(db: DB) {
  const tags = new Set<string>();
  const rows = await db.select({ data: charactersTable.data }).from(charactersTable);
  for (const row of rows) {
    try {
      const data = JSON.parse(row.data) as { tags?: unknown };
      if (!Array.isArray(data.tags)) continue;
      for (const tag of data.tags) {
        if (typeof tag !== "string") continue;
        const key = tagKey(tag);
        if (key) tags.add(key);
      }
    } catch {
      // Ignore malformed character records; import can still proceed.
    }
  }
  return tags;
}

async function filterImportedTags(
  tags: string[],
  db: DB,
  mode: STCharacterTagImportMode,
  existingTagKeys?: ReadonlySet<string>,
) {
  if (mode === "all" || tags.length === 0) return tags;
  if (mode === "none") return [];

  const existingTags = existingTagKeys ?? (await getExistingCharacterTagKeys(db));
  return tags.filter((tag) => existingTags.has(tagKey(tag)));
}

/** Resolve an asset URI from a CharX zip to a data URL. */
function resolveCharXAsset(zip: ZipArchive, uri: string, ext?: string): string | null {
  // Handle embeded:// URIs (note: spec uses "embeded" not "embedded")
  let zipPath: string | null = null;

  if (uri.startsWith("embeded://")) {
    zipPath = uri.slice("embeded://".length);
  } else if (uri.startsWith("embedded://")) {
    // Accept the common misspelling too
    zipPath = uri.slice("embedded://".length);
  } else if (uri.startsWith("data:image/")) {
    // Already a data URL
    return uri;
  } else if (!uri.includes("://") && uri !== "ccdefault:") {
    // Treat as a relative path within the zip
    zipPath = uri;
  }

  if (!zipPath) return null;

  const entry = zip.getEntry(zipPath);
  if (!entry) return null;

  const data = entry.read(IMPORT_BODY_LIMIT_BYTES);
  const fileExt = ext ?? zipPath.split(".").pop() ?? "png";
  const imageInfo = isAllowedImageBuffer(data, `.${fileExt}`);
  if (!imageInfo) return null;
  return `data:${imageInfo.mimeType};base64,${data.toString("base64")}`;
}

function normalizeV2(raw: Record<string, unknown>): CharacterData {
  // Ruleset sheets travel dormant under their key; only one the boundary would refuse is dropped.
  // The raw key is taken out of the spread below, so a value that is not a sheet map leaves nothing.
  const { rulesetSheets: rawRulesetSheets, ...extensionsWithOnboarding } = optionalRecord(raw.extensions);
  const onboardingImport = dropUnreadableOnboarding(extensionsWithOnboarding);
  const rawExtensions = onboardingImport.extensions;
  if (onboardingImport.dropped)
    logger.warn("[import] Dropped unreadable interactive onboarding from an imported character");
  if (onboardingImport.truncated) {
    logger.warn("[import] Kept the first %d onboarding questions of an imported character", ONBOARDING_MAX_QUESTIONS);
  }
  const importedSheets = capImportedRulesetSheets(rawRulesetSheets);
  if (importedSheets.dropped.length > 0) {
    logger.warn(
      "[import] Dropped %d unusable ruleset sheet(s) from an imported character: %s",
      importedSheets.dropped.length,
      importedSheets.dropped.join(", "),
    );
  }
  return {
    name: String(raw.name ?? "Unknown"),
    summary: String(raw.summary ?? "").trim(),
    description: String(raw.description ?? ""),
    personality: String(raw.personality ?? ""),
    scenario: String(raw.scenario ?? ""),
    first_mes: String(raw.first_mes ?? ""),
    mes_example: String(raw.mes_example ?? ""),
    creator_notes: String(raw.creator_notes ?? ""),
    system_prompt: String(raw.system_prompt ?? ""),
    post_history_instructions: String(raw.post_history_instructions ?? ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    creator: String(raw.creator ?? ""),
    character_version: String(raw.character_version ?? ""),
    alternate_greetings: Array.isArray(raw.alternate_greetings) ? raw.alternate_greetings.map(String) : [],
    extensions: {
      ...rawExtensions,
      talkativeness: Number(rawExtensions.talkativeness ?? 0.5),
      fav: Boolean(rawExtensions.fav),
      world: String(rawExtensions.world ?? ""),
      depth_prompt: {
        prompt: String((rawExtensions.depth_prompt as Record<string, unknown>)?.prompt ?? ""),
        depth: Number((rawExtensions.depth_prompt as Record<string, unknown>)?.depth ?? 4),
        role:
          ((rawExtensions.depth_prompt as Record<string, unknown>)?.role as "system" | "user" | "assistant") ??
          "system",
      },
      backstory: String(rawExtensions.backstory ?? ""),
      appearance: String(rawExtensions.appearance ?? ""),
      ...(importedSheets.sheets ? { rulesetSheets: importedSheets.sheets } : {}),
    },
    character_book: normalizeCharacterBook(raw.character_book),
    ...pickDefinedFields(raw, V3_CHARACTER_DATA_FIELDS),
  };
}

/** Coerce an unknown value into a string array, handling single-string and missing cases. */
function normalizeStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/**
 * Normalize a character_book from any format (ST World Info or V2 spec) into
 * the V2 CharacterBook shape with entries as an array of CharacterBookEntry objects.
 */
function normalizeCharacterBook(raw: unknown): CharacterData["character_book"] {
  if (!raw || typeof raw !== "object") return null;
  const book = raw as Record<string, unknown>;

  const entries = getCharacterBookEntries(book).map((e, i) => {
    const position = normalizeCharacterBookPosition(e.position);
    const depth = typeof e.depth === "number" && Number.isFinite(e.depth) ? e.depth : null;
    const role = normalizeCharacterBookRole(e.role);
    const title = firstNonEmptyString(e.comment, e.name) ?? `Entry ${i + 1}`;
    const passthrough = pickDefinedFields(e, CHARACTER_BOOK_ENTRY_PASSTHROUGH_FIELDS);

    return {
      ...passthrough,
      keys: normalizeStringArray(e.key ?? e.keys),
      secondary_keys: normalizeStringArray(e.keysecondary ?? e.secondary_keys),
      content: String(e.content ?? ""),
      extensions: (e.extensions ?? {}) as Record<string, unknown>,
      enabled: e.disable != null ? !e.disable : e.enabled != null ? Boolean(e.enabled) : true,
      insertion_order: (e.order ?? e.insertion_order ?? 100) as number,
      case_sensitive: Boolean(e.caseSensitive ?? e.case_sensitive ?? false),
      name: title,
      priority: (e.priority ?? 10) as number,
      id: (e.uid ?? e.id ?? i) as number,
      comment: title,
      selective: Boolean(e.selective ?? false),
      constant: Boolean(e.constant ?? false),
      position,
      ...(depth !== null ? { depth } : {}),
      ...(role !== undefined ? { role } : {}),
    };
  });

  return {
    name: String(book.name ?? ""),
    description: String(book.description ?? ""),
    scan_depth: Number(book.scan_depth ?? book.scanDepth ?? 2),
    token_budget: Number(book.token_budget ?? book.tokenBudget ?? 2048),
    recursive_scanning: Boolean(book.recursive_scanning ?? book.recursiveScanning ?? false),
    extensions: (book.extensions ?? {}) as Record<string, unknown>,
    entries,
  };
}

function convertV1toV2(raw: Record<string, unknown>): CharacterData {
  return normalizeV2({
    name: raw.char_name ?? raw.name ?? "Unknown",
    description: raw.char_persona ?? raw.description ?? "",
    personality: raw.personality ?? "",
    scenario: raw.world_scenario ?? raw.scenario ?? "",
    first_mes: raw.char_greeting ?? raw.first_mes ?? "",
    mes_example: raw.example_dialogue ?? raw.mes_example ?? "",
    // Preserve V2 fields when present instead of discarding them
    creator_notes: raw.creator_notes ?? "",
    system_prompt: raw.system_prompt ?? "",
    post_history_instructions: raw.post_history_instructions ?? "",
    tags: raw.tags ?? [],
    creator: raw.creator ?? "",
    character_version: raw.character_version ?? "",
    alternate_greetings: raw.alternate_greetings ?? [],
    extensions: raw.extensions ?? {},
    character_book: raw.character_book ?? null,
  });
}

function convertRisuToV2(raw: Record<string, unknown>): CharacterData {
  const risuExtensions: Record<string, unknown> = {
    ...optionalRecord(raw.extensions),
    ...pickDefinedFields(raw, [
      "depth_prompt",
      "depthPrompt",
      "talkativeness",
      "fav",
      "world",
      "regex_scripts",
      "regexScripts",
      "backstory",
      "appearance",
    ]),
  };
  if (risuExtensions.depth_prompt === undefined && raw.depthPrompt !== undefined) {
    risuExtensions.depth_prompt = raw.depthPrompt;
  }
  if (risuExtensions.regex_scripts === undefined && raw.regexScripts !== undefined) {
    risuExtensions.regex_scripts = raw.regexScripts;
  }

  return normalizeV2({
    name: raw.name ?? "Unknown",
    description: raw.description ?? "",
    personality: raw.personality ?? "",
    scenario: raw.scenario ?? "",
    first_mes: raw.firstMessage ?? raw.first_mes ?? raw.first_message ?? "",
    mes_example: raw.exampleMessage ?? raw.mes_example ?? raw.example_dialogue ?? "",
    system_prompt: raw.systemPrompt ?? "",
    creator_notes: raw.creatorNotes ?? "",
    post_history_instructions:
      raw.postHistoryInstructions ?? raw.post_history_instructions ?? raw.jailbreak ?? raw.jailbreakPrompt ?? "",
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    creator: String(raw.creator ?? ""),
    character_version: raw.characterVersion ?? raw.character_version ?? "",
    alternate_greetings: Array.isArray(raw.alternateGreetings)
      ? raw.alternateGreetings.map(String)
      : Array.isArray(raw.alternate_greetings)
        ? raw.alternate_greetings.map(String)
        : [],
    extensions: risuExtensions,
    character_book: raw.character_book ?? raw.characterBook ?? raw.lorebook ?? raw.world_info ?? raw.worldInfo ?? null,
  });
}
