// ──────────────────────────────────────────────
// Service: Skill Check Resolution
//
// Resolves d20-based skill checks using player
// stats. Supports advantage/disadvantage, crits,
// and attribute-linked modifiers.
// ──────────────────────────────────────────────

import type { RPGAttributes } from "@marinara-engine/shared";

export interface SkillCheckInput {
  /** Skill name (e.g. "Perception", "Stealth"). */
  skill: string;
  /** Difficulty class to beat. */
  dc: number;
  /** Skill modifier from playerStats.skills (pre-looked-up). */
  skillModifier: number;
  /** Attribute modifier (floor((score - 10) / 2) — D&D-style). */
  attributeModifier: number;
  /** Roll with advantage (take higher of 2) or disadvantage (take lower). */
  advantage?: boolean;
  disadvantage?: boolean;
  /**
   * Player-submitted d20 result (1-20). When present, skips internal d20()
   * and uses this value as the used roll, so a [dice:1d20] pre-roll flows
   * through the same modifier-application code path. Ignored if out of range.
   */
  preRolledD20?: number;
  /**
   * Die source, for tests and for callers that own their own RNG. Defaults to
   * the shipped unseeded `Math.random()` roller — consolidating call sites onto
   * this service deliberately did not change how the engine rolls.
   */
  rollD20?: () => number;
}

export interface SkillCheckResult {
  skill: string;
  dc: number;
  /** The raw d20 roll(s) — 2 if advantage/disadvantage, 1 otherwise. */
  rolls: number[];
  /** The die value that was used (1-20), not an index into rolls. */
  usedRoll: number;
  /** Total modifier applied (skill + attribute). */
  modifier: number;
  /** Final total: usedRoll + modifier. */
  total: number;
  /** Whether the check passed. */
  success: boolean;
  /** Natural 20 on the used roll. */
  criticalSuccess: boolean;
  /** Natural 1 on the used roll. */
  criticalFailure: boolean;
  /** Roll mode used by the resolver. */
  rollMode: "advantage" | "disadvantage" | "normal";
  /** Built-in checks add the used die and modifiers. */
  resolution: "sum";
  /** Notation for the dice actually thrown (e.g. "1d20", "2d20" with advantage). */
  dice: string;
}

function d20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Compute a D&D-style attribute modifier: floor((score - 10) / 2).
 */
export function attributeModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Map common skills to their governing attribute.
 * Falls back to "int" for unlisted skills.
 */
const SKILL_ATTRIBUTE_MAP: Record<string, keyof RPGAttributes> = {
  // Direct ability checks
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",

  // STR
  athletics: "str",

  // DEX
  acrobatics: "dex",
  sleight_of_hand: "dex",
  stealth: "dex",

  // CON
  endurance: "con",

  // INT
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",

  // WIS
  animal_handling: "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",

  // CHA
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
};

/**
 * Look up the governing attribute for a skill name.
 * Normalises the skill name (lowercase, spaces → underscores).
 */
export function getGoverningAttribute(skill: string): keyof RPGAttributes {
  const key = skill
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_(?:ability_)?check$/, "")
    .replace(/_saving_throw$/, "")
    .replace(/_save$/, "");
  return SKILL_ATTRIBUTE_MAP[key] ?? "int";
}

/**
 * Map character-sheet attribute names (free-form, e.g. "STR", "Strength",
 * "Dexterity") to the strict {str,dex,...} RPGAttributes shape used for skill
 * resolution. Case-insensitive; unrecognised names are dropped.
 */
const ATTRIBUTE_NAME_MAP: Record<string, keyof RPGAttributes> = {
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",
};

/**
 * Read one free-form attribute name as a strict `RPGAttributes` key, or `null` when it
 * names no attribute. Exported so a caller that resolves a single name — the dice
 * placeholder's `+STR` term — folds the same way the sheet mapper does rather than
 * carrying a second spelling of the same table.
 */
export function mapSheetAttributeName(name: string): keyof RPGAttributes | null {
  if (typeof name !== "string") return null;
  return ATTRIBUTE_NAME_MAP[name.trim().toLowerCase()] ?? null;
}

/** The short sheet spellings, in the order a character sheet lists them. */
export const SHEET_ATTRIBUTE_LABELS: ReadonlyArray<[keyof RPGAttributes, string]> = [
  ["str", "STR"],
  ["dex", "DEX"],
  ["con", "CON"],
  ["int", "INT"],
  ["wis", "WIS"],
  ["cha", "CHA"],
];

/**
 * The score a check reads for one attribute: the snapshot's engine-shape attributes
 * first, then the player card's sheet, or null when neither carries it.
 *
 * ONE reader for the check resolver, the dice placeholder and the sighted pool, so the
 * three cannot disagree about what a sheet value means. It keeps the coercion the check
 * resolver has always used (`Number(...)` guarded by `Number.isFinite`), so a placeholder's
 * `+STR` adds exactly what a check's STR adds; tightening that is a change to every
 * shipped check and belongs to its own change.
 */
export function readContextAttributeScore(
  context: { attributes: Record<string, unknown> | null; sheetAttributes: Partial<RPGAttributes> },
  attribute: keyof RPGAttributes,
): number | null {
  if (context.attributes && Number.isFinite(Number(context.attributes[attribute]))) {
    return Number(context.attributes[attribute]);
  }
  const sheet = context.sheetAttributes[attribute];
  return sheet == null ? null : sheet;
}

export function mapSheetAttributesToRPG(
  attrs: ReadonlyArray<{ name: string; value: number }> | null | undefined,
): Partial<RPGAttributes> {
  if (!Array.isArray(attrs)) return {};
  const out: Partial<RPGAttributes> = {};
  for (const attr of attrs) {
    if (!attr || typeof attr.name !== "string") continue;
    const key = mapSheetAttributeName(attr.name);
    if (!key) continue;
    const value = Number(attr.value);
    if (!Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Resolve a skill check with d20 + modifiers vs DC.
 */
export function resolveSkillCheck(input: SkillCheckInput): SkillCheckResult {
  const modifier = input.skillModifier + input.attributeModifier;
  const rollOne = input.rollD20 ?? d20;

  // Player-submitted [dice:1d20] short-circuits internal rolling so the
  // sheet's attribute modifier still applies on top of the player's number.
  const preRoll =
    Number.isInteger(input.preRolledD20) && input.preRolledD20! >= 1 && input.preRolledD20! <= 20
      ? input.preRolledD20!
      : null;

  // Roll d20 (twice if advantage/disadvantage; ignored when preRoll present)
  const useAdvantage = !preRoll && input.advantage && !input.disadvantage;
  const useDisadvantage = !preRoll && input.disadvantage && !input.advantage;
  const rollTwice = useAdvantage || useDisadvantage;

  const rolls = preRoll != null ? [preRoll] : rollTwice ? [rollOne(), rollOne()] : [rollOne()];
  const usedRoll =
    preRoll != null
      ? preRoll
      : rollTwice
        ? useAdvantage
          ? Math.max(rolls[0]!, rolls[1]!)
          : Math.min(rolls[0]!, rolls[1]!)
        : rolls[0]!;

  const total = usedRoll + modifier;
  const criticalSuccess = usedRoll === 20;
  const criticalFailure = usedRoll === 1;

  // Crit success always passes, crit failure always fails
  const success = criticalSuccess ? true : criticalFailure ? false : total >= input.dc;

  return {
    skill: input.skill,
    dc: input.dc,
    rolls,
    usedRoll,
    modifier,
    total,
    success,
    criticalSuccess,
    criticalFailure,
    rollMode: useAdvantage ? "advantage" : useDisadvantage ? "disadvantage" : "normal",
    resolution: "sum",
    // Notation for the dice actually thrown, so the card labels advantage rolls
    // "2d20" rather than claiming a single die.
    dice: `${rolls.length}d20`,
  };
}
