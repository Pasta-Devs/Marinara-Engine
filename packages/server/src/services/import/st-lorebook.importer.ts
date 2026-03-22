// ──────────────────────────────────────────────
// Importer: SillyTavern World Info / Lorebook
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import type { CreateLorebookEntryInput, LorebookCategory } from "@marinara-engine/shared";

interface STWorldInfoEntry {
  uid?: number;
  key?: string[];
  keysecondary?: string[];
  comment?: string;
  content?: string;
  constant?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  order?: number;
  position?: number;
  disable?: boolean;
  depth?: number;
  probability?: number | null;
  scanDepth?: number | null;
  matchWholeWords?: boolean | null;
  caseSensitive?: boolean | null;
  role?: number;
  group?: string;
  groupWeight?: number | null;
  sticky?: number | null;
  cooldown?: number | null;
  delay?: number | null;
  vectorized?: boolean;
}

interface STWorldInfo {
  entries?: Record<string, STWorldInfoEntry>;
  name?: string;
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
  uncategorized: [],
};

function detectCategory(entries: STWorldInfoEntry[], name?: string): LorebookCategory {
  const scores: Record<LorebookCategory, number> = {
    world: 0,
    character: 0,
    npc: 0,
    uncategorized: 0,
  };

  // Build a single text blob for analysis
  const allText = [name ?? "", ...entries.map((e) => [e.comment ?? "", e.content ?? "", ...(e.key ?? [])].join(" "))]
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
  const text = [entry.comment ?? "", entry.content ?? "", ...(entry.key ?? [])].join(" ").toLowerCase();
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

/**
 * Import a SillyTavern World Info JSON file.
 */
export async function importSTLorebook(
  raw: Record<string, unknown>,
  db: DB,
  options?: { characterId?: string; namePrefix?: string; fallbackName?: string },
) {
  const storage = createLorebooksStorage(db);
  const wi = raw as unknown as STWorldInfo;

  const entryList = Object.values(wi.entries ?? {});
  const detectedCategory = detectCategory(entryList, wi.name);

  const lbName = options?.namePrefix
    ? `${options.namePrefix} — ${wi.name ?? "Lorebook"}`
    : (wi.name ?? options?.fallbackName ?? "Imported Lorebook");

  // Create the lorebook
  const lorebook = (await storage.create({
    name: lbName,
    description: "Imported from SillyTavern",
    category: detectedCategory,
    scanDepth: 2,
    tokenBudget: 2048,
    recursiveScanning: false,
    generatedBy: "import",
    characterId: options?.characterId ?? null,
  })) as Record<string, unknown> | null;

  if (!lorebook) return { error: "Failed to create lorebook" };

  const lorebookId = lorebook.id as string;
  const lorebookName = lorebook.name as string;
  const entries = wi.entries ?? {};
  let imported = 0;

  for (const [, entry] of Object.entries(entries)) {
    // Map ST selective logic: 0=AND, 1=OR, 2=NOT
    const logicMap: Record<number, "and" | "or" | "not"> = { 0: "and", 1: "or", 2: "not" };

    // Map ST role: 0=system, 1=user, 2=assistant
    const roleMap: Record<number, "system" | "user" | "assistant"> = {
      0: "system",
      1: "user",
      2: "assistant",
    };

    const input: CreateLorebookEntryInput = {
      lorebookId: lorebookId,
      name: entry.comment ?? `Entry ${imported + 1}`,
      content: entry.content ?? "",
      keys: entry.key ?? [],
      secondaryKeys: entry.keysecondary ?? [],
      enabled: !(entry.disable ?? false),
      constant: entry.constant ?? false,
      selective: entry.selective ?? false,
      selectiveLogic: logicMap[entry.selectiveLogic ?? 0] ?? "and",
      probability: entry.probability ?? null,
      scanDepth: entry.scanDepth ?? null,
      matchWholeWords: entry.matchWholeWords ?? false,
      caseSensitive: entry.caseSensitive ?? false,
      useRegex: false,
      position: entry.position ?? 0,
      depth: entry.depth ?? 4,
      order: entry.order ?? 100,
      role: roleMap[entry.role ?? 0] ?? "system",
      sticky: entry.sticky ?? null,
      cooldown: entry.cooldown ?? null,
      delay: entry.delay ?? null,
      group: entry.group ?? "",
      groupWeight: entry.groupWeight ?? null,
      tag: detectEntryTag(entry),
      relationships: {},
      dynamicState: {},
      activationConditions: [],
      schedule: null,
    };

    await storage.createEntry(input);
    imported++;
  }

  return {
    success: true,
    lorebookId: lorebookId,
    name: lorebookName,
    category: detectedCategory,
    entriesImported: imported,
  };
}
