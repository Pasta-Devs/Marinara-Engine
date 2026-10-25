import {
  decodeLorebookImages,
  saveDecodedLorebookImages,
  discardImportedLorebookImages,
} from "../lorebook/lorebook-images.js";
// ──────────────────────────────────────────────
// Importer: SillyTavern World Info / Lorebook
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { inArray } from "../../db/file-query.js";
import { lorebookEntries } from "../../db/schema/index.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import type { CreateLorebookEntryInput, LorebookCategory } from "@marinara-engine/shared";
import { parseLorebookDecisionActivation } from "@marinara-engine/shared";
import type { TimestampOverrides } from "./import-timestamps.js";
import { resolveLorebookEntryRole } from "./lorebook-role.js";

interface STWorldInfoEntry {
  uid?: number;
  /** Marinara extension (#6570). */
  decisionStatement?: string;
  decisionMode?: string;
  id?: number;
  // ST World Info format
  key?: string[] | string;
  keysecondary?: string[] | string;
  comment?: string;
  disable?: boolean;
  order?: number;
  // V2 Character Book format (alternative field names)
  keys?: string[] | string;
  secondary_keys?: string[] | string;
  name?: string;
  enabled?: boolean;
  insertion_order?: number;
  case_sensitive?: boolean;
  match_whole_words?: boolean;
  scan_depth?: number | null;
  // Common fields (same in both formats)
  content?: string;
  description?: string;
  constant?: boolean;
  selective?: boolean;
  selectiveLogic?: number | string;
  position?: number | string;
  outletName?: string;
  depth?: number;
  probability?: number | null;
  useProbability?: boolean;
  use_probability?: boolean;
  scanDepth?: number | null;
  matchWholeWords?: boolean | null;
  caseSensitive?: boolean | null;
  role?: number | string;
  group?: string;
  groupWeight?: number | null;
  sticky?: number | null;
  cooldown?: number | null;
  delay?: number | null;
  ephemeral?: number | null;
  vectorized?: boolean;
  excludeFromVectorization?: boolean;
  regex?: boolean;
  useRegex?: boolean;
  preventRecursion?: boolean;
  excludeRecursion?: boolean;
  delayUntilRecursion?: boolean;
  locked?: boolean;
  extensions?: Record<string, unknown>;
}

interface STWorldInfo {
  entries?: Record<string, STWorldInfoEntry> | STWorldInfoEntry[];
  name?: string;
  description?: string;
  scan_depth?: number;
  scanDepth?: number;
  token_budget?: number;
  tokenBudget?: number;
  recursive_scanning?: boolean;
  recursiveScanning?: boolean;
  max_recursion_depth?: number;
  maxRecursionDepth?: number;
  extensions?: Record<string, unknown>;
}

// ── Category auto-detection ──

const CATEGORY_SIGNALS: Record<LorebookCategory, string[]> = {
  world: [
    "world",
    "realm",
    "kingdom",
    "empire",
    "continent",
    "geography",
    "climate",
    "history",
    "era",
    "age",
    "calendar",
    "religion",
    "magic system",
    "faction",
    "political",
    "economy",
    "trade",
    "war",
    "alliance",
    "treaty",
    "culture",
  ],
  character: [
    "personality",
    "backstory",
    "motivation",
    "goal",
    "fear",
    "trait",
    "relationship",
    "family",
    "appearance",
    "outfit",
    "skill",
    "ability",
    "power",
    "weakness",
    "likes",
    "dislikes",
    "occupation",
    "class",
  ],
  npc: [
    "shopkeeper",
    "innkeeper",
    "guard",
    "merchant",
    "villager",
    "bartender",
    "noble",
    "servant",
    "priest",
    "soldier",
    "bandit",
    "traveler",
    "stranger",
    "quest giver",
    "companion",
    "ally",
    "enemy",
    "rival",
    "mentor",
  ],
  spellbook: [
    "spell",
    "incantation",
    "cantrip",
    "ritual",
    "fireball",
    "heal",
    "magic missile",
    "lightning bolt",
    "summon",
    "enchant",
    "curse",
    "ward",
    "buff",
    "debuff",
    "attack skill",
    "special attack",
    "technique",
    "martial art",
    "combo",
  ],
  uncategorized: [],
};

function asEntryList(entries: STWorldInfo["entries"]): STWorldInfoEntry[] {
  if (Array.isArray(entries)) return entries;
  if (entries && typeof entries === "object") return Object.values(entries);
  return [];
}

function asStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return [raw];
  return [];
}

function nonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function asNullablePercentage(value: unknown): number | null {
  const parsed = asNullableNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, parsed));
}

function resolveProbability(entry: STWorldInfoEntry): number | null {
  const useProbability = entry.useProbability ?? entry.use_probability;
  if (useProbability === false) return null;
  return asNullablePercentage(entry.probability);
}

export function resolveSelectiveLogic(value: unknown): "and" | "and_all" | "or" | "not" | "not_all" {
  const logicMap: Record<number, "and" | "and_all" | "not" | "not_all"> = {
    0: "and",
    1: "not_all",
    2: "not",
    3: "and_all",
  };
  if (typeof value === "string" && ["and", "and_all", "or", "not", "not_all"].includes(value)) {
    return value as "and" | "and_all" | "or" | "not" | "not_all";
  }
  return logicMap[typeof value === "number" ? value : 0] ?? "and";
}

export function resolvePosition(value: unknown): number {
  if (typeof value === "string") {
    if (value === "after_char") return 1;
    if (value === "at_depth" || value === "depth") return 2;
    if (value === "outlet") return 7;
    return 0;
  }
  const positionMap: Record<number, number> = {
    0: 0, // ST before_char
    1: 1, // ST after_char
    2: 0, // ST ANTop
    3: 1, // ST ANBottom
    4: 2, // ST @D / at-depth
    5: 0, // ST EMTop
    6: 1, // ST EMBottom
    7: 7, // ST Outlet
  };
  if (typeof value === "number" && Number.isInteger(value)) return positionMap[value] ?? 0;
  return 0;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSlashDelimitedRegex(value: string): { source: string } | null {
  const match = value.match(/^\/(.+)\/([dgimsuvy]*)$/u);
  const source = match?.[1];
  return source ? { source } : null;
}

function hasSlashDelimitedRegex(keys: string[]): boolean {
  return keys.some((key) => parseSlashDelimitedRegex(key) !== null);
}

function normalizeRegexKeys(
  keys: string[],
  options: { useRegex: boolean; entryUsesRegex: boolean; matchWholeWords: boolean },
): string[] {
  if (!options.useRegex) return keys;
  return keys.map((key) => {
    const parsed = parseSlashDelimitedRegex(key);
    if (parsed) return parsed.source;
    if (options.entryUsesRegex) return key;
    const escaped = escapeRegexLiteral(key);
    return options.matchWholeWords ? `\\b${escaped}\\b` : escaped;
  });
}

function detectCategory(entries: STWorldInfoEntry[], name?: string): LorebookCategory {
  const scores: Record<LorebookCategory, number> = {
    world: 0,
    character: 0,
    npc: 0,
    spellbook: 0,
    uncategorized: 0,
  };

  // Build a single text blob for analysis
  const allText = [
    name ?? "",
    ...entries.map((e) => [e.comment ?? e.name ?? "", e.content ?? "", ...asStringArray(e.key ?? e.keys)].join(" ")),
  ]
    .join(" ")
    .toLowerCase();

  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS) as [LorebookCategory, string[]][]) {
    for (const signal of signals) {
      if (allText.includes(signal)) {
        scores[cat]++;
      }
    }
  }

  // Find highest-scoring category
  let best: LorebookCategory = "world"; // default
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores) as [LorebookCategory, number][]) {
    if (cat === "uncategorized") continue;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  return bestScore > 0 ? best : "world";
}

/**
 * Auto-detect a tag for an individual entry based on its content/keys.
 */
function detectEntryTag(entry: STWorldInfoEntry): string {
  const text = [entry.comment ?? entry.name ?? "", entry.content ?? "", ...asStringArray(entry.key ?? entry.keys)]
    .join(" ")
    .toLowerCase();
  const tagSignals: Record<string, string[]> = {
    location: [
      "city",
      "town",
      "village",
      "forest",
      "mountain",
      "river",
      "cave",
      "dungeon",
      "castle",
      "tower",
      "temple",
      "tavern",
      "inn",
    ],
    character: ["personality", "backstory", "appearance", "motivation", "fear", "goal", "trait"],
    item: ["sword", "potion", "artifact", "weapon", "armor", "ring", "amulet", "scroll", "tome"],
    faction: ["guild", "order", "alliance", "faction", "clan", "tribe", "house", "court"],
    lore: ["history", "legend", "myth", "prophecy", "ancient", "origin", "creation", "divine"],
    magic: ["spell", "enchant", "ritual", "arcane", "mana", "rune", "conjur", "summon"],
    creature: ["dragon", "beast", "monster", "demon", "undead", "spirit", "elemental", "golem"],
    event: ["battle", "war", "festival", "ceremony", "ritual", "tournament", "coronation"],
  };

  let bestTag = "";
  let bestScore = 0;
  for (const [tag, signals] of Object.entries(tagSignals)) {
    let score = 0;
    for (const signal of signals) {
      if (text.includes(signal)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTag = tag;
    }
  }
  return bestTag;
}

export interface LorebookImportResult {
  success: true;
  lorebookId: string;
  name: string;
  category: LorebookCategory;
  entriesImported: number;
  reimported: boolean;
}

/**
 * Import a SillyTavern World Info JSON file.
 */
export async function importSTLorebook(
  raw: Record<string, unknown>,
  db: DB,
  options?: {
    characterId?: string;
    namePrefix?: string;
    fallbackName?: string;
    timestampOverrides?: TimestampOverrides | null;
    existingLorebookId?: string | null;
    allowLocalImagePaths?: boolean;
    /** Runs with the imported rows, before commit and chat-reference cleanup. */
    beforeCommit?: (tx: DB, result: LorebookImportResult) => Promise<void>;
  },
): Promise<LorebookImportResult> {
  const wi = raw as unknown as STWorldInfo;

  const entryList = asEntryList(wi.entries);
  const decodedImages = new Map<(typeof entryList)[number], Awaited<ReturnType<typeof decodeLorebookImages>>>();
  for (const entry of entryList)
    decodedImages.set(
      entry,
      await decodeLorebookImages(entry.extensions?.marinaraImages, options?.allowLocalImagePaths),
    );
  const restoredImages = new Map<(typeof entryList)[number], Awaited<ReturnType<typeof saveDecodedLorebookImages>>>();
  try {
    for (const entry of entryList)
      restoredImages.set(entry, await saveDecodedLorebookImages(decodedImages.get(entry)!));
    const mutate = async (tx: DB) => {
      const storage = createLorebooksStorage(tx);
      let lorebook: Record<string, unknown> | null = null;
      const existingEntryIds: string[] = [];
      let createdLorebook = false;
      const detectedCategory = detectCategory(entryList, wi.name);

      const lbName = options?.namePrefix
        ? `${options.namePrefix} — ${wi.name ?? "Lorebook"}`
        : (wi.name ?? options?.fallbackName ?? "Imported Lorebook");

      const lorebookInput = {
        name: lbName,
        description: nonEmptyString(wi.description) ?? "Imported from SillyTavern",
        category: detectedCategory,
        scanDepth: asNumber(wi.scan_depth ?? wi.scanDepth, 2),
        tokenBudget: asNumber(wi.token_budget ?? wi.tokenBudget, 2048),
        recursiveScanning: Boolean(wi.recursive_scanning ?? wi.recursiveScanning ?? false),
        maxRecursionDepth: asNumber(wi.max_recursion_depth ?? wi.maxRecursionDepth, 3),
        generatedBy: "import" as const,
        ...(options?.characterId ? { characterIds: [options.characterId] } : {}),
      };

      const existingLorebookId = options?.existingLorebookId ?? null;
      if (existingLorebookId) {
        const existing = (await storage.getById(existingLorebookId)) as Record<string, unknown> | null;
        if (existing) {
          lorebook = existing;
          const existingEntries = (await storage.listEntries(existingLorebookId)) as unknown as Array<{ id: string }>;
          existingEntryIds.push(...existingEntries.map((entry) => entry.id));
        }
      }

      if (!lorebook) {
        lorebook = (await storage.create(lorebookInput, options?.timestampOverrides)) as Record<string, unknown> | null;
        createdLorebook = Boolean(lorebook);
      }

      if (!lorebook) {
        throw new Error("Failed to create lorebook");
      }

      const lorebookId = lorebook.id as string;
      const lorebookName = lbName;
      let imported = 0;

      for (const entry of entryList) {
        // Resolve fields that differ between ST World Info format and V2 Character Book format
        const rawKeys = entry.key ?? entry.keys;
        const rawResolvedKeys = asStringArray(rawKeys);
        const rawSecondary = entry.keysecondary ?? entry.secondary_keys;
        const rawResolvedSecondaryKeys = asStringArray(rawSecondary);
        const resolvedName = nonEmptyString(entry.comment, entry.name) ?? `Entry ${imported + 1}`;
        // ST uses `disable` (inverted), V2 uses `enabled`
        const resolvedEnabled = entry.disable != null ? !entry.disable : (entry.enabled ?? true);
        const resolvedOrder = asNumber(entry.order ?? entry.insertion_order, 100);
        // V2 position can be string ("before_char"/"after_char") — map to number
        const resolvedPosition = resolvePosition(entry.position);
        // Role can be a number (ST) or string (V2)
        const resolvedRole = resolveLorebookEntryRole(entry.role);
        const resolvedCaseSensitive = entry.caseSensitive ?? entry.case_sensitive ?? false;
        const resolvedMatchWholeWords = entry.matchWholeWords ?? entry.match_whole_words ?? false;
        const entryUsesRegex = Boolean(entry.useRegex ?? entry.regex ?? false);
        const resolvedUseRegex =
          entryUsesRegex || hasSlashDelimitedRegex(rawResolvedKeys) || hasSlashDelimitedRegex(rawResolvedSecondaryKeys);
        const resolvedKeys = normalizeRegexKeys(rawResolvedKeys, {
          useRegex: resolvedUseRegex,
          entryUsesRegex,
          matchWholeWords: resolvedMatchWholeWords,
        });
        const resolvedSecondaryKeys = normalizeRegexKeys(rawResolvedSecondaryKeys, {
          useRegex: resolvedUseRegex,
          entryUsesRegex,
          matchWholeWords: resolvedMatchWholeWords,
        });
        const sanitizedContent = normalizeString(entry.content);
        const sanitizedDescription = normalizeString(entry.description);

        const input: CreateLorebookEntryInput = {
          lorebookId: lorebookId,
          name: resolvedName,
          content: sanitizedContent,
          images: restoredImages.get(entry) ?? [],
          description: sanitizedDescription,
          keys: resolvedKeys,
          secondaryKeys: resolvedSecondaryKeys,
          enabled: resolvedEnabled,
          constant: entry.constant ?? false,
          selective: entry.selective ?? false,
          selectiveLogic: resolveSelectiveLogic(entry.selectiveLogic),
          probability: resolveProbability(entry),
          scanDepth: asNullableNumber(entry.scanDepth ?? entry.scan_depth),
          matchWholeWords: resolvedMatchWholeWords,
          caseSensitive: resolvedCaseSensitive,
          useRegex: resolvedUseRegex,
          position: resolvedPosition,
          outletName: normalizeString(entry.outletName),
          depth: asNumber(entry.depth, 4),
          order: resolvedOrder,
          role: resolvedRole,
          sticky: asNullableNumber(entry.sticky),
          cooldown: asNullableNumber(entry.cooldown),
          delay: asNullableNumber(entry.delay),
          ephemeral: asNullableNumber(entry.ephemeral),
          group: entry.group ?? "",
          groupWeight: asNullableNumber(entry.groupWeight),
          tag: detectEntryTag(entry),
          relationships: {},
          dynamicState: {},
          activationConditions: [],
          schedule: null,
          preventRecursion: entry.preventRecursion == null ? true : Boolean(entry.preventRecursion),
          excludeRecursion: Boolean(entry.excludeRecursion ?? false),
          delayUntilRecursion: Boolean(entry.delayUntilRecursion ?? false),
          excludeFromVectorization: entry.vectorized === false ? true : entry.excludeFromVectorization === true,
          locked: Boolean(entry.locked ?? false),
          // Marinara's own exports carry decision activation (#6570); SillyTavern files do not.
          ...parseLorebookDecisionActivation(entry),
        };

        const created = (await storage.createEntry(input)) as Record<string, unknown> | null;
        if (typeof created?.id !== "string") throw new Error("Failed to create lorebook entry");
        imported++;
      }

      if (existingLorebookId && !createdLorebook) {
        const current = await storage.getById(existingLorebookId);
        if (!current) throw new Error("Failed to update lorebook");
        const updated = await storage.update(existingLorebookId, {
          ...lorebookInput,
          characterIds: lorebookInput.characterIds
            ? [...current.characterIds, ...lorebookInput.characterIds]
            : undefined,
        });
        if (!updated) throw new Error("Failed to update lorebook");
        if (existingEntryIds.length > 0) {
          await tx.delete(lorebookEntries).where(inArray(lorebookEntries.id, existingEntryIds));
        }
      }
      const result: LorebookImportResult = {
        success: true,
        lorebookId,
        name: lorebookName,
        category: detectedCategory,
        entriesImported: imported,
        reimported: !!existingLorebookId,
      };
      await options?.beforeCommit?.(tx, result);
      return { result, removedEntryIds: existingEntryIds };
    };
    if (options?.existingLorebookId) {
      let result: LorebookImportResult | undefined;
      // Metadata queues precede the transaction; nested queue acquisition would deadlock.
      await createChatsStorage(db).pruneLorebookChatMetadata(async (tx) => {
        const imported = await mutate(tx);
        result = imported.result;
        return imported.removedEntryIds;
      });
      return result!;
    }
    return (await db.transaction(mutate)).result;
  } catch (error) {
    // The transaction restored all rows/references. Files are outside the store:
    // remove only newly written images, never reused paths owned by existing entries.
    await discardImportedLorebookImages(restoredImages.values(), decodedImages.values());
    throw error;
  }
}
