// ──────────────────────────────────────────────
// Service: Character ↔ Linked Lorebook sync
// ──────────────────────────────────────────────
//
// When an embedded lorebook is imported via
// POST /characters/:id/embedded-lorebook/import the resulting standalone
// lorebook keeps a back-pointer (`lorebooks.characterId`) to its source
// character, and the character keeps a forward pointer at
// `data.extensions.importMetadata.embeddedLorebook.lorebookId`.
//
// Subsequent edits flow through /lorebooks/* — they mutate the standalone
// row and entries but, without sync, leave the V2 `data.character_book`
// frozen at import time. The character editor's Lorebook tab reads from
// `data.character_book` directly, so deletes/edits made via "Edit Linked
// Lorebook" appeared to roll back when the editor was reopened (issue:
// users could not delete embedded lorebook entries).
//
// These helpers mirror standalone-lorebook mutations back into the
// character's `data.character_book` so the two stores stay coherent.

import { like } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import type { CharacterBook, CharacterBookEntry } from "@marinara-engine/shared";
import { characters } from "../../db/schema/index.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { logger } from "../../lib/logger.js";

type LoreEntryRow = Record<string, unknown>;
type LorebookRow = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

/**
 * Map a standalone-lorebook entry row (post `parseEntryRow`) onto a V2
 * Character Book entry. Field mapping mirrors the inverse done by
 * `importSTLorebook`. At-depth entries use ST's numeric @D position so a
 * synced embedded book can round-trip through the standalone lorebook without
 * losing depth placement.
 */
function toCharacterBookEntry(entry: LoreEntryRow, index: number): CharacterBookEntry {
  const order = asNumber(entry.order, 100);
  const positionValue = asNumber(entry.position, 0);
  const position =
    positionValue === 7 ? 7 : positionValue === 2 ? 4 : positionValue === 1 ? "after_char" : "before_char";
  const role = entry.role === "user" ? 1 : entry.role === "assistant" ? 2 : 0;
  return {
    keys: asStringArray(entry.keys),
    content: asString(entry.content),
    extensions: {},
    enabled: asBoolean(entry.enabled),
    insertion_order: order,
    case_sensitive: asBoolean(entry.caseSensitive),
    name: asString(entry.name, `Entry ${index + 1}`),
    priority: order,
    id: index,
    comment: asString(entry.name, `Entry ${index + 1}`),
    description: asString(entry.description),
    selective: asBoolean(entry.selective),
    secondary_keys: asStringArray(entry.secondaryKeys),
    constant: asBoolean(entry.constant),
    position,
    outletName: asString(entry.outletName),
    depth: asNumber(entry.depth, 4),
    role,
    selectiveLogic: asString(entry.selectiveLogic, "and"),
    probability: asNullableNumber(entry.probability),
    scanDepth: asNullableNumber(entry.scanDepth),
    scan_depth: asNullableNumber(entry.scanDepth),
    matchWholeWords: asBoolean(entry.matchWholeWords),
    match_whole_words: asBoolean(entry.matchWholeWords),
    useRegex: asBoolean(entry.useRegex),
    regex: asBoolean(entry.useRegex),
    sticky: asNullableNumber(entry.sticky),
    cooldown: asNullableNumber(entry.cooldown),
    delay: asNullableNumber(entry.delay),
    ephemeral: asNullableNumber(entry.ephemeral),
    group: asString(entry.group),
    groupWeight: asNullableNumber(entry.groupWeight),
    tag: asString(entry.tag),
    locked: asBoolean(entry.locked),
    preventRecursion: asBoolean(entry.preventRecursion, true),
    excludeRecursion: asBoolean(entry.excludeRecursion),
    delayUntilRecursion: asBoolean(entry.delayUntilRecursion),
    vectorized: !asBoolean(entry.excludeFromVectorization),
    excludeFromVectorization: asBoolean(entry.excludeFromVectorization),
  };
}

export function toCharacterBook(lorebook: LorebookRow, entries: LoreEntryRow[]): CharacterBook {
  return {
    name: asString(lorebook.name, "Character Lorebook"),
    description: asString(lorebook.description),
    scan_depth: asNumber(lorebook.scanDepth, 2),
    token_budget: asNumber(lorebook.tokenBudget, 2048),
    recursive_scanning: lorebook.recursiveScanning === true,
    extensions: {},
    entries: entries.map((entry, index) => toCharacterBookEntry(entry, index)),
  };
}

function parseCharacterData(data: unknown): Record<string, unknown> {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    // A corrupt character row must not abort a lorebook mutation or delete —
    // treat it as having no embedded pointer.
    return {};
  }
}

export function getEmbeddedLorebookId(characterData: Record<string, unknown>): string | null {
  const extensions =
    characterData.extensions && typeof characterData.extensions === "object"
      ? (characterData.extensions as Record<string, unknown>)
      : null;
  const importMetadata =
    extensions?.importMetadata && typeof extensions.importMetadata === "object"
      ? (extensions.importMetadata as Record<string, unknown>)
      : null;
  const embeddedLorebook =
    importMetadata?.embeddedLorebook && typeof importMetadata.embeddedLorebook === "object"
      ? (importMetadata.embeddedLorebook as Record<string, unknown>)
      : null;
  return typeof embeddedLorebook?.lorebookId === "string" ? embeddedLorebook.lorebookId : null;
}

/**
 * Resolve which character actually embeds this lorebook — the one whose
 * `extensions.importMetadata.embeddedLorebook.lorebookId` names it (the
 * authoritative forward pointer).
 *
 * The lorebook's hydrated `characterId` is only the alphabetically-first
 * *linked* character (lorebooks.storage `parseLorebookRow`), which is not
 * necessarily the embedding one for a lorebook linked to several characters.
 * So it is used only as a fast path — confirmed against the forward pointer
 * (identical to the previous behaviour, and the only case for the single-link
 * import path) — before falling back to a prefiltered scan. The `LIKE` is a
 * cheap prefilter on a unique lorebook id; `getEmbeddedLorebookId` is the
 * authority.
 */
export async function resolveEmbeddedCharacterId(
  db: DB,
  lorebookId: string,
  lorebookHint?: LorebookRow | null,
): Promise<string | null> {
  const charactersStorage = createCharactersStorage(db);

  const lorebook = lorebookHint ?? ((await createLorebooksStorage(db).getById(lorebookId)) as LorebookRow | null);
  const derived = typeof lorebook?.characterId === "string" ? lorebook.characterId : null;
  if (derived) {
    const character = await charactersStorage.getById(derived);
    if (character && getEmbeddedLorebookId(parseCharacterData(character.data)) === lorebookId) {
      return derived;
    }
  }

  // Only a lorebook linked to MORE THAN ONE character can be embedded in a
  // character other than its derived (first-linked) one; for 0/1 links the fast
  // path above is authoritative, so skip the table scan. This keeps the common
  // path (world lorebooks, single-linked character lorebooks) scan-free —
  // identical cost to the pre-fix behaviour.
  const linkCount = Array.isArray(lorebook?.characterIds) ? (lorebook.characterIds as unknown[]).length : 0;
  if (linkCount <= 1) return null;

  const rows = await db
    .select()
    .from(characters)
    .where(like(characters.data, `%"${lorebookId}"%`));
  for (const row of rows) {
    if (getEmbeddedLorebookId(parseCharacterData(row.data)) === lorebookId) return row.id;
  }
  return null;
}

/**
 * Embed a standalone/linked character lorebook INTO a character's card: write
 * its current entries to `data.character_book` and set the
 * `extensions.importMetadata.embeddedLorebook` forward pointer, so the lorebook
 * travels with the card on export and future edits keep syncing. The inverse of
 * the embedded-lorebook import (card → standalone). Eligibility (category,
 * already-occupied slot) is gated by the caller; this is a pure writer.
 *
 * `refreshed` is true when the character already embedded this same lorebook —
 * the write regenerates `character_book` from the lorebook's *current* entries.
 */
export async function embedLorebookIntoCharacter(
  db: DB,
  characterId: string,
  lorebookId: string,
): Promise<{ entriesEmbedded: number; refreshed: boolean; characterBook: CharacterBook }> {
  const lorebookStorage = createLorebooksStorage(db);
  const lorebook = (await lorebookStorage.getById(lorebookId)) as LorebookRow | null;
  if (!lorebook) throw new Error("Lorebook not found");

  const charactersStorage = createCharactersStorage(db);
  const character = await charactersStorage.getById(characterId);
  if (!character) throw new Error("Character not found");

  const currentData = parseCharacterData(character.data);
  const refreshed = getEmbeddedLorebookId(currentData) === lorebookId;

  const entries = (await lorebookStorage.listEntries(lorebookId)) as LoreEntryRow[];
  const nextBook = toCharacterBook(lorebook, entries);

  // Read-modify-write the extensions subtree (the storage layer only shallow-
  // merges CharacterData), preserving sibling importMetadata/extension keys.
  const extensions =
    currentData.extensions && typeof currentData.extensions === "object"
      ? ({ ...(currentData.extensions as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const importMetadata =
    extensions.importMetadata && typeof extensions.importMetadata === "object"
      ? ({ ...(extensions.importMetadata as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const existingEmbedded =
    importMetadata.embeddedLorebook && typeof importMetadata.embeddedLorebook === "object"
      ? (importMetadata.embeddedLorebook as Record<string, unknown>)
      : {};
  importMetadata.embeddedLorebook = { ...existingEmbedded, hasEmbeddedLorebook: true, lorebookId };
  extensions.importMetadata = importMetadata;

  await charactersStorage.update(
    characterId,
    { character_book: nextBook, extensions: extensions as never },
    undefined,
    { skipVersionSnapshot: true },
  );

  return { entriesEmbedded: nextBook.entries.length, refreshed, characterBook: nextBook };
}

/**
 * Mirror the current state of a standalone lorebook into its source
 * character's `data.character_book`. No-op when no character embeds this
 * lorebook (via the authoritative forward pointer), or when the resolved
 * character's embedded-lorebook metadata does not point at this lorebook.
 * Ordinary character-scoped lorebooks also use `characterId` for
 * auto-activation, but they must not overwrite the V2 embedded
 * `character_book`.
 *
 * Sync errors are logged but never thrown — the user's primary mutation
 * (entry create/update/delete) has already succeeded by the time this is
 * called, and a sync failure should not surface as an HTTP error.
 */
export async function syncCharacterBookFromLorebook(db: DB, lorebookId: string): Promise<void> {
  try {
    const lorebookStorage = createLorebooksStorage(db);
    const lorebook = (await lorebookStorage.getById(lorebookId)) as LorebookRow | null;
    if (!lorebook) return;
    const characterId = await resolveEmbeddedCharacterId(db, lorebookId, lorebook);
    if (!characterId) return;

    const charactersStorage = createCharactersStorage(db);
    const character = await charactersStorage.getById(characterId);
    if (!character) return;

    const currentData = parseCharacterData(character.data);
    if (getEmbeddedLorebookId(currentData) !== lorebookId) return;

    const entries = (await lorebookStorage.listEntries(lorebookId)) as LoreEntryRow[];
    const nextBook = toCharacterBook(lorebook, entries);

    await charactersStorage.update(characterId, { character_book: nextBook }, undefined, { skipVersionSnapshot: true });
  } catch (err) {
    logger.error(err, "Failed to sync character_book from lorebook %s", lorebookId);
  }
}

/**
 * Clear the embedded-lorebook footprint from a character: drop
 * `data.character_book` and the
 * `extensions.importMetadata.embeddedLorebook` pointer. Called when the
 * standalone lorebook is being deleted, so the V2 `character_book` cannot
 * resurrect on the next character open and the dangling
 * `lorebookId` pointer cannot leave a broken "Edit Embedded Lorebook"
 * button behind.
 *
 * The character storage layer recursively merges `extensions`, so this helper
 * builds the full replacement subtree and disables that merge. Otherwise the
 * omitted `embeddedLorebook` key would be restored from the old data.
 */
export async function clearCharacterEmbeddedLorebook(db: DB, characterId: string, lorebookId: string): Promise<void> {
  try {
    const charactersStorage = createCharactersStorage(db);
    const character = await charactersStorage.getById(characterId);
    if (!character) return;

    const currentData = parseCharacterData(character.data);
    if (getEmbeddedLorebookId(currentData) !== lorebookId) return;

    const extensions =
      currentData.extensions && typeof currentData.extensions === "object"
        ? ({ ...(currentData.extensions as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const importMetadata =
      extensions.importMetadata && typeof extensions.importMetadata === "object"
        ? ({ ...(extensions.importMetadata as Record<string, unknown>) } as Record<string, unknown>)
        : null;
    if (importMetadata && "embeddedLorebook" in importMetadata) {
      delete importMetadata.embeddedLorebook;
      extensions.importMetadata = importMetadata;
    }

    await charactersStorage.update(
      characterId,
      {
        character_book: null,
        extensions: extensions as never,
      },
      undefined,
      { skipVersionSnapshot: true, mergeExtensions: false },
    );
  } catch (err) {
    logger.error(err, "Failed to clear embedded lorebook for character %s", characterId);
  }
}

/**
 * Unconditionally clear a character's embedded-lorebook footprint — drop
 * `data.character_book` and the `extensions.importMetadata.embeddedLorebook`
 * pointer — regardless of whether a standalone still exists or the pointer still
 * matches. Backs the user-initiated "Remove from card" action; the linked
 * standalone lorebook, if any, is left untouched. Returns false when the
 * character does not exist. Unlike `clearCharacterEmbeddedLorebook` (a
 * fire-and-forget side effect of deleting a standalone), this is user-driven, so
 * DB errors propagate to the route instead of being swallowed.
 */
export async function clearEmbeddedLorebookFromCharacter(db: DB, characterId: string): Promise<boolean> {
  const charactersStorage = createCharactersStorage(db);
  const character = await charactersStorage.getById(characterId);
  if (!character) return false;

  const currentData = parseCharacterData(character.data);
  const extensions =
    currentData.extensions && typeof currentData.extensions === "object"
      ? ({ ...(currentData.extensions as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const importMetadata =
    extensions.importMetadata && typeof extensions.importMetadata === "object"
      ? ({ ...(extensions.importMetadata as Record<string, unknown>) } as Record<string, unknown>)
      : null;
  if (importMetadata && "embeddedLorebook" in importMetadata) {
    delete importMetadata.embeddedLorebook;
    extensions.importMetadata = importMetadata;
  }

  await charactersStorage.update(characterId, { character_book: null, extensions: extensions as never }, undefined, {
    skipVersionSnapshot: true,
    mergeExtensions: false,
  });
  return true;
}
