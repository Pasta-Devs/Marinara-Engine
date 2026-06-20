// ──────────────────────────────────────────────
// Legacy Extended Descriptions → character lorebooks
// ──────────────────────────────────────────────
//
// Older character cards could carry toggleable description blocks at
// `data.extensions.altDescriptions` (and the alias `descriptionExtensions`).
// The current card editor no longer surfaces those blocks, so migrate them into
// a character-linked lorebook where each block remains independently editable.

import type { CharacterData } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";

const SOURCE_AGENT_ID = "extended-descriptions-migration";
const MIGRATION_METADATA_KEY = "extendedDescriptionsLorebook";
const LEGACY_EXTENSION_KEYS = ["altDescriptions", "descriptionExtensions"] as const;

type CharacterRow = Awaited<ReturnType<ReturnType<typeof createCharactersStorage>["list"]>>[number];

type LegacyDescription = {
  legacyId: string | null;
  label: string;
  content: string;
  enabled: boolean;
  sourceKey: string;
};

type MigrationStats = {
  scanned: number;
  charactersMigrated: number;
  lorebooksCreated: number;
  entriesCreated: number;
  skippedAlreadyMigrated: number;
  errors: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseCharacterData(value: unknown): CharacterData | null {
  try {
    if (typeof value === "string") return JSON.parse(value) as CharacterData;
    return isRecord(value) ? (value as unknown as CharacterData) : null;
  } catch {
    return null;
  }
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readEnabled(entry: Record<string, unknown>): boolean {
  if (typeof entry.active === "boolean") return entry.active;
  if (typeof entry.enabled === "boolean") return entry.enabled;
  if (typeof entry.disabled === "boolean") return !entry.disabled;
  return true;
}

function prettifyKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeDescriptionEntry(
  raw: unknown,
  sourceKey: string,
  fallbackLabel: string,
): LegacyDescription | null {
  const parsed = parseJsonIfString(raw);
  if (typeof parsed === "string") {
    const content = parsed.trim();
    return content ? { legacyId: null, label: fallbackLabel, content, enabled: true, sourceKey } : null;
  }
  if (!isRecord(parsed)) return null;

  const content =
    asString(parsed.content) ||
    asString(parsed.text) ||
    asString(parsed.value) ||
    asString(parsed.description) ||
    asString(parsed.prompt);
  if (!content) return null;

  const label =
    asString(parsed.label) ||
    asString(parsed.name) ||
    asString(parsed.title) ||
    asString(parsed.key) ||
    asString(parsed.id) ||
    fallbackLabel;

  return {
    legacyId: asString(parsed.id) || null,
    label,
    content,
    enabled: readEnabled(parsed),
    sourceKey,
  };
}

function collectDescriptionsFromValue(raw: unknown, sourceKey: string): LegacyDescription[] {
  const parsed = parseJsonIfString(raw);
  const entries: LegacyDescription[] = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((entry, index) => {
      const normalized = normalizeDescriptionEntry(entry, sourceKey, `Extended Description ${index + 1}`);
      if (normalized) entries.push(normalized);
    });
  } else if (isRecord(parsed)) {
    Object.entries(parsed).forEach(([key, value], index) => {
      const normalized = normalizeDescriptionEntry(value, sourceKey, prettifyKey(key) || `Extended Description ${index + 1}`);
      if (normalized) entries.push(normalized);
    });
  } else {
    const normalized = normalizeDescriptionEntry(parsed, sourceKey, "Extended Description");
    if (normalized) entries.push(normalized);
  }
  return entries;
}

function collectLegacyDescriptions(data: CharacterData): LegacyDescription[] {
  const extensions: Record<string, unknown> = isRecord(data.extensions)
    ? (data.extensions as unknown as Record<string, unknown>)
    : {};
  const descriptions: LegacyDescription[] = [];
  for (const key of LEGACY_EXTENSION_KEYS) {
    descriptions.push(...collectDescriptionsFromValue(extensions[key], key));
  }

  const seen = new Set<string>();
  return descriptions.filter((description) => {
    const key = `${description.label}\u0000${description.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function migrationMetadata(data: CharacterData): Record<string, unknown> | null {
  const extensions: Record<string, unknown> = isRecord(data.extensions)
    ? (data.extensions as unknown as Record<string, unknown>)
    : {};
  const importMetadata = isRecord(extensions.importMetadata) ? extensions.importMetadata : null;
  const migration = isRecord(importMetadata?.[MIGRATION_METADATA_KEY])
    ? (importMetadata[MIGRATION_METADATA_KEY] as Record<string, unknown>)
    : null;
  return migration;
}

function hasMigrationMarker(data: CharacterData): boolean {
  const metadata = migrationMetadata(data);
  return typeof metadata?.lorebookId === "string" || metadata?.migrated === true;
}

function withMigrationMarker(
  data: CharacterData,
  marker: {
    lorebookId: string;
    entries: number;
    enabledEntries: number;
  },
): CharacterData["extensions"] {
  const extensions: Record<string, unknown> = isRecord(data.extensions)
    ? { ...(data.extensions as unknown as Record<string, unknown>) }
    : {};
  const importMetadata = isRecord(extensions.importMetadata)
    ? { ...(extensions.importMetadata as Record<string, unknown>) }
    : {};
  importMetadata[MIGRATION_METADATA_KEY] = {
    migrated: true,
    migratedAt: new Date().toISOString(),
    sourceAgentId: SOURCE_AGENT_ID,
    ...marker,
  };
  return {
    ...extensions,
    importMetadata,
  } as unknown as CharacterData["extensions"];
}

async function findExistingMigrationLorebook(
  lorebooksStore: ReturnType<typeof createLorebooksStorage>,
  characterId: string,
): Promise<Record<string, unknown> | null> {
  const books = (await lorebooksStore.listByCharacter(characterId)) as Array<Record<string, unknown>>;
  return books.find((book) => book.sourceAgentId === SOURCE_AGENT_ID) ?? null;
}

async function ensureEntries(
  lorebooksStore: ReturnType<typeof createLorebooksStorage>,
  lorebookId: string,
  descriptions: LegacyDescription[],
): Promise<number> {
  const existingEntries = (await lorebooksStore.listEntries(lorebookId)) as Array<Record<string, unknown>>;
  const existingKeys = new Set(
    existingEntries.map((entry) => `${String(entry.name ?? "")}\u0000${String(entry.content ?? "")}`),
  );
  let created = 0;
  for (const [index, description] of descriptions.entries()) {
    const entryKey = `${description.label}\u0000${description.content}`;
    if (existingKeys.has(entryKey)) continue;
    await lorebooksStore.createEntry({
      lorebookId,
      name: description.label,
      content: description.content,
      description: `Migrated from legacy ${description.sourceKey}.`,
      keys: [],
      secondaryKeys: [],
      enabled: description.enabled,
      constant: true,
      order: 100 + index,
      position: 0,
      depth: 4,
      role: "system",
      locked: true,
      tag: "migrated",
      preventRecursion: true,
    });
    existingKeys.add(entryKey);
    created += 1;
  }
  return created;
}

async function migrateCharacter(
  db: DB,
  character: CharacterRow,
  stats: MigrationStats,
): Promise<void> {
  const data = parseCharacterData(character.data);
  if (!data) return;
  if (hasMigrationMarker(data)) {
    stats.skippedAlreadyMigrated += 1;
    return;
  }

  const descriptions = collectLegacyDescriptions(data);
  if (descriptions.length === 0) return;

  const lorebooksStore = createLorebooksStorage(db);
  const charactersStore = createCharactersStorage(db);
  let lorebook = await findExistingMigrationLorebook(lorebooksStore, character.id);
  if (!lorebook) {
    lorebook = (await lorebooksStore.create({
      name: `${data.name || "Character"} — Extended Descriptions`,
      description: "Automatically migrated from legacy Extended Descriptions on the character card.",
      category: "character",
      scanDepth: 2,
      tokenBudget: 2048,
      entryLimit: Math.max(100, descriptions.length),
      recursiveScanning: false,
      maxRecursionDepth: 3,
      characterIds: [character.id],
      isGlobal: false,
      enabled: true,
      tags: ["migrated", "extended-descriptions"],
      generatedBy: "import",
      sourceAgentId: SOURCE_AGENT_ID,
    })) as Record<string, unknown> | null;
    stats.lorebooksCreated += lorebook ? 1 : 0;
  }
  const lorebookId = typeof lorebook?.id === "string" ? lorebook.id : null;
  if (!lorebookId) return;

  const createdEntries = await ensureEntries(lorebooksStore, lorebookId, descriptions);
  stats.entriesCreated += createdEntries;
  await charactersStore.update(
    character.id,
    {
      extensions: withMigrationMarker(data, {
        lorebookId,
        entries: descriptions.length,
        enabledEntries: descriptions.filter((description) => description.enabled).length,
      }),
    },
    undefined,
    {
      updatedAt: character.updatedAt,
      skipVersionSnapshot: true,
    },
  );
  stats.charactersMigrated += 1;
}

export async function migrateCharacterExtendedDescriptionsToLorebooks(db: DB): Promise<MigrationStats> {
  const stats: MigrationStats = {
    scanned: 0,
    charactersMigrated: 0,
    lorebooksCreated: 0,
    entriesCreated: 0,
    skippedAlreadyMigrated: 0,
    errors: 0,
  };
  const charactersStore = createCharactersStorage(db);
  const characters = await charactersStore.list();
  stats.scanned = characters.length;

  for (const character of characters) {
    try {
      await migrateCharacter(db, character, stats);
    } catch (err) {
      stats.errors += 1;
      logger.error(err, "[migration] Failed to migrate legacy Extended Descriptions for character %s", character.id);
    }
  }

  if (stats.charactersMigrated > 0 || stats.errors > 0) {
    logger.info(
      "[migration] Extended Descriptions migrated: %d characters, %d lorebooks, %d entries, %d errors",
      stats.charactersMigrated,
      stats.lorebooksCreated,
      stats.entriesCreated,
      stats.errors,
    );
  }
  return stats;
}
