// ──────────────────────────────────────────────
// Game: Random Encounter Service
//
// Rolls encounter chances based on location, game
// state, and difficulty. No LLM needed — just tells
// the GM "an encounter happens now" with mechanics.
// ──────────────────────────────────────────────

import { rollDice } from "./dice.service.js";

type EncounterType = "combat" | "social" | "trap" | "puzzle" | "merchant" | "event";

export interface EncounterRoll {
  triggered: boolean;
  type: EncounterType | null;
  difficulty: string;
  /** A deterministic context hint for the GM to narrate */
  hint: string;
  /** Raw roll for transparency */
  roll: number;
  threshold: number;
}

// ── Encounter Chance Tables ──

/** Base encounter chance (out of 100) per action type. */
const ENCOUNTER_CHANCES: Record<string, number> = {
  explore: 25,
  travel: 35,
  rest_long: 20,
  rest_short: 10,
  map_move: 30,
  default: 15,
};

/** Difficulty multiplier for encounter chance. */
const DIFFICULTY_MULT: Record<string, number> = {
  casual: 0.5,
  normal: 1.0,
  hard: 1.3,
  brutal: 1.6,
};

/** Location danger modifiers (added to base chance). */
const LOCATION_DANGER: Record<string, number> = {
  safe: -20,
  town: -15,
  road: -5,
  wilderness: 0,
  ruins: 10,
  dungeon: 15,
  hostile: 25,
};

/** Encounter type distribution. */
const ENCOUNTER_TYPES: Array<{ type: EncounterType; weight: number }> = [
  { type: "combat", weight: 35 },
  { type: "social", weight: 20 },
  { type: "trap", weight: 15 },
  { type: "puzzle", weight: 10 },
  { type: "merchant", weight: 10 },
  { type: "event", weight: 10 },
];

// ── Encounter Hints (deterministic suggestions for the GM) ──

const HINTS: Record<EncounterType, string[]> = {
  combat: [
    "Hostile creatures emerge from hiding.",
    "An ambush has been sprung!",
    "A group of enemies blocks the path ahead.",
    "Sounds of aggression grow near — combat is imminent.",
    "A territorial beast challenges the party.",
  ],
  social: [
    "A wandering traveler approaches with news.",
    "A distressed NPC calls for help from nearby.",
    "A mysterious figure offers cryptic advice.",
    "A group of locals gossips about recent events.",
    "A bard sings a song that contains a hidden clue.",
  ],
  trap: [
    "The ground ahead looks suspicious.",
    "Something glints in the shadows — could be a trap.",
    "A clicking sound echoes — mechanisms are at work.",
    "The architecture here seems designed to deceive.",
    "Warning signs of a previous victim are visible.",
  ],
  puzzle: [
    "An ancient mechanism blocks further progress.",
    "Strange symbols cover the walls — they must mean something.",
    "A locked door with no visible keyhole stands before the party.",
    "A riddle is inscribed on a stone pedestal.",
    "The room rearranges itself when approached.",
  ],
  merchant: [
    "A traveling merchant has set up shop nearby.",
    "A peddler hails the party with wares to sell.",
    "A caravan rests here, offering trade opportunities.",
    "A mysterious shopkeeper beckons from a hidden stall.",
  ],
  event: [
    "The weather shifts dramatically.",
    "A distant explosion echoes through the area.",
    "Strange lights appear in the sky.",
    "The ground trembles briefly underfoot.",
    "An unusual silence falls over the surroundings.",
  ],
};

// ── Core Functions ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Pick a weighted random encounter type. */
function pickEncounterType(): EncounterType {
  const total = ENCOUNTER_TYPES.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of ENCOUNTER_TYPES) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return "combat";
}

/** Infer location danger from a location string. */
function inferLocationDanger(location: string): string {
  const lower = location.toLowerCase();
  if (/town|city|village|inn|tavern|market|home|palace|temple|church/.test(lower)) return "town";
  if (/road|path|trail|highway/.test(lower)) return "road";
  if (/forest|plains|field|hill|river|lake|meadow/.test(lower)) return "wilderness";
  if (/ruin|abandoned|desolate|cursed/.test(lower)) return "ruins";
  if (/dungeon|cave|crypt|tomb|lair|mine|abyss/.test(lower)) return "dungeon";
  if (/warzone|battlefield|hostile|enemy/.test(lower)) return "hostile";
  return "wilderness";
}

/**
 * Roll to determine if a random encounter triggers.
 * Pure server-side — no LLM call. The hint is passed
 * to the GM prompt if triggered.
 */
export function rollEncounter(action: string, difficulty: string, location: string): EncounterRoll {
  const baseChance = ENCOUNTER_CHANCES[action] ?? ENCOUNTER_CHANCES.default!;
  const diffMult = DIFFICULTY_MULT[difficulty] ?? 1.0;
  const danger = inferLocationDanger(location);
  const dangerMod = LOCATION_DANGER[danger] ?? 0;

  const threshold = Math.round(Math.min(90, Math.max(5, baseChance * diffMult + dangerMod)));
  const roll = rollDice("1d100").total;

  const triggered = roll <= threshold;

  if (!triggered) {
    return { triggered: false, type: null, difficulty, hint: "", roll, threshold };
  }

  const type = pickEncounterType();
  const hint = pick(HINTS[type]!);

  return { triggered: true, type, difficulty, hint, roll, threshold };
}

/**
 * Calculate how many enemies should appear in a combat encounter.
 * Based on party size and difficulty.
 */
export function rollEnemyCount(partySize: number, difficulty: string): number {
  const base = Math.max(1, Math.floor(partySize * 0.75));
  const diffBonus: Record<string, number> = { casual: -1, normal: 0, hard: 1, brutal: 2 };
  const bonus = diffBonus[difficulty] ?? 0;
  const variance = rollDice("1d4").total - 2; // -1 to +2
  return Math.max(1, base + bonus + variance);
}
