// ──────────────────────────────────────────────
// Game: Loot Table System
//
// Weighted random loot generation, no LLM needed.
// Difficulty and location affect rarity distribution.
// ──────────────────────────────────────────────

type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

interface LootItem {
  name: string;
  description: string;
  rarity: ItemRarity;
  type: "weapon" | "armor" | "potion" | "scroll" | "material" | "key" | "currency" | "misc";
  value: number;
  /** Optional stat modifiers when equipped */
  modifiers?: Record<string, number>;
}

export interface LootDrop {
  item: LootItem;
  quantity: number;
}

// ── Rarity Weights by Difficulty ──

const RARITY_WEIGHTS: Record<string, Record<ItemRarity, number>> = {
  casual: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 },
  normal: { common: 40, uncommon: 30, rare: 20, epic: 8, legendary: 2 },
  hard: { common: 30, uncommon: 30, rare: 25, epic: 12, legendary: 3 },
  brutal: { common: 20, uncommon: 25, rare: 30, epic: 18, legendary: 7 },
};

// ── Base Item Tables ──

const WEAPON_TABLE: Omit<LootItem, "rarity" | "value">[] = [
  {
    name: "Rusty Dagger",
    description: "A well-worn blade that has seen better days.",
    type: "weapon",
    modifiers: { attack: 1 },
  },
  {
    name: "Iron Shortsword",
    description: "A reliable shortsword forged from solid iron.",
    type: "weapon",
    modifiers: { attack: 3 },
  },
  {
    name: "Steel Longsword",
    description: "A finely crafted longsword with keen edge.",
    type: "weapon",
    modifiers: { attack: 5 },
  },
  {
    name: "Enchanted Rapier",
    description: "A slender blade that hums with arcane energy.",
    type: "weapon",
    modifiers: { attack: 8 },
  },
  {
    name: "Flamebrand",
    description: "A legendary sword wreathed in eternal flame.",
    type: "weapon",
    modifiers: { attack: 12 },
  },
  {
    name: "Hunting Bow",
    description: "A simple but effective ranged weapon.",
    type: "weapon",
    modifiers: { attack: 2 },
  },
  {
    name: "Composite Longbow",
    description: "A powerful bow with impressive range.",
    type: "weapon",
    modifiers: { attack: 6 },
  },
  {
    name: "Staff of Sparks",
    description: "A gnarled staff that crackles with static.",
    type: "weapon",
    modifiers: { attack: 4 },
  },
  { name: "Warhammer", description: "A heavy hammer that can crush armor.", type: "weapon", modifiers: { attack: 7 } },
  {
    name: "Shadowblade",
    description: "A blade that seems to drink the light around it.",
    type: "weapon",
    modifiers: { attack: 10 },
  },
];

const ARMOR_TABLE: Omit<LootItem, "rarity" | "value">[] = [
  {
    name: "Leather Vest",
    description: "Basic protection from glancing blows.",
    type: "armor",
    modifiers: { defense: 1 },
  },
  {
    name: "Chainmail Shirt",
    description: "Interlocking metal rings provide solid defense.",
    type: "armor",
    modifiers: { defense: 3 },
  },
  {
    name: "Steel Breastplate",
    description: "A polished breastplate that deflects strikes.",
    type: "armor",
    modifiers: { defense: 5 },
  },
  {
    name: "Mithril Chainmail",
    description: "Lightweight yet incredibly strong armor.",
    type: "armor",
    modifiers: { defense: 8, speed: 1 },
  },
  {
    name: "Dragonscale Plate",
    description: "Armor forged from the scales of a dragon.",
    type: "armor",
    modifiers: { defense: 12 },
  },
  { name: "Wooden Shield", description: "A simple round shield.", type: "armor", modifiers: { defense: 2 } },
  { name: "Iron Buckler", description: "A small, sturdy metal shield.", type: "armor", modifiers: { defense: 4 } },
  {
    name: "Enchanted Cloak",
    description: "A shimmering cloak that wards off harm.",
    type: "armor",
    modifiers: { defense: 6, speed: 2 },
  },
];

const POTION_TABLE: Omit<LootItem, "rarity" | "value">[] = [
  { name: "Minor Healing Potion", description: "Restores a small amount of health.", type: "potion" },
  { name: "Healing Potion", description: "Restores a moderate amount of health.", type: "potion" },
  { name: "Greater Healing Potion", description: "Restores a large amount of health.", type: "potion" },
  { name: "Potion of Strength", description: "Temporarily boosts attack power.", type: "potion" },
  { name: "Potion of Iron Skin", description: "Temporarily boosts defense.", type: "potion" },
  { name: "Potion of swiftness", description: "Temporarily boosts speed.", type: "potion" },
  { name: "Antidote", description: "Cures most common poisons.", type: "potion" },
  { name: "Elixir of Vitality", description: "Fully restores health and cures ailments.", type: "potion" },
];

const MISC_TABLE: Omit<LootItem, "rarity" | "value">[] = [
  { name: "Torch", description: "Provides light in dark places.", type: "misc" },
  { name: "Rope (50ft)", description: "Sturdy hempen rope.", type: "material" },
  { name: "Lockpick Set", description: "Tools for opening locked containers.", type: "misc" },
  { name: "Ancient Coin", description: "A weathered coin from a forgotten era.", type: "currency" },
  { name: "Gemstone", description: "A sparkling precious stone.", type: "currency" },
  { name: "Mysterious Key", description: "An ornate key of unknown purpose.", type: "key" },
  { name: "Spell Scroll", description: "A scroll containing a single-use spell.", type: "scroll" },
  { name: "Monster Hide", description: "Tough hide from a slain creature.", type: "material" },
  { name: "Enchanting Dust", description: "Magical residue used to enchant items.", type: "material" },
  { name: "Map Fragment", description: "A torn piece of an old map.", type: "misc" },
];

const ALL_TABLES = [WEAPON_TABLE, ARMOR_TABLE, POTION_TABLE, MISC_TABLE];

// ── Rarity → value multiplier ──

const VALUE_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 3,
  rare: 10,
  epic: 30,
  legendary: 100,
};

// ── Rarity assignment by index in table ──
// Lower index items are more common, higher index items are rarer

function assignRarity(index: number, tableSize: number): ItemRarity {
  const ratio = index / Math.max(1, tableSize - 1);
  if (ratio < 0.3) return "common";
  if (ratio < 0.5) return "uncommon";
  if (ratio < 0.7) return "rare";
  if (ratio < 0.9) return "epic";
  return "legendary";
}

// ── Core Functions ──

/** Pick a weighted random rarity based on difficulty. */
function pickRarity(difficulty: string): ItemRarity {
  const weights = RARITY_WEIGHTS[difficulty] ?? RARITY_WEIGHTS.normal!;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;

  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity as ItemRarity;
  }
  return "common";
}

/** Generate a single loot drop based on difficulty. */
function generateLootDrop(difficulty: string = "normal"): LootDrop {
  const targetRarity = pickRarity(difficulty);

  // Pick a random table
  const table = ALL_TABLES[Math.floor(Math.random() * ALL_TABLES.length)]!;

  // Find items matching the target rarity
  const candidates = table
    .map((item, i) => ({ item, rarity: assignRarity(i, table.length) }))
    .filter((c) => c.rarity === targetRarity);

  // Fallback to any item if no match
  const pick =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]!
      : { item: table[0]!, rarity: "common" as ItemRarity };

  const baseValue = 5 + Math.floor(Math.random() * 20);
  const value = baseValue * VALUE_MULTIPLIER[pick.rarity];

  return {
    item: { ...pick.item, rarity: pick.rarity, value },
    quantity: pick.item.type === "currency" ? 1 + Math.floor(Math.random() * 10) : 1,
  };
}

/** Generate multiple loot drops (e.g., after combat or from a chest). */
export function generateLootTable(count: number, difficulty: string = "normal"): LootDrop[] {
  const drops: LootDrop[] = [];
  for (let i = 0; i < count; i++) {
    drops.push(generateLootDrop(difficulty));
  }
  return drops;
}

/** Generate loot appropriate for a combat encounter based on enemy count and difficulty. */
export function generateCombatLoot(enemyCount: number, difficulty: string = "normal"): LootDrop[] {
  // Base drops: 1-2 per enemy, plus bonus for harder difficulties
  const difficultyBonus: Record<string, number> = { casual: 0, normal: 0, hard: 1, brutal: 2 };
  const bonus = difficultyBonus[difficulty] ?? 0;
  const count = Math.min(10, enemyCount + Math.floor(Math.random() * (enemyCount + 1)) + bonus);
  return generateLootTable(count, difficulty);
}
