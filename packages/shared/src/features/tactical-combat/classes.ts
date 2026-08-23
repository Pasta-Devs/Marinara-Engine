// ──────────────────────────────────────────────
// Tactical Combat — class profiles + derivation
// ──────────────────────────────────────────────
// Round 3: every combatant resolves to a TacticalClass that fixes its basic-
// attack reach, a flat movement bonus, and a crit bonus. Derivation is pure
// (string/stat logic, no RNG) so the same Combatant always yields the same
// class — determinism is preserved. types.ts owns only the `TacticalClass`
// union; the profile table + `deriveClass`/`normalizeClass` live here.

import type { Combatant } from "../../types/game.js";
import type { TacticalAttackRange, TacticalClass } from "./types.js";

export interface ClassProfile {
  /** Basic-attack reach in Manhattan distance. */
  attackRange: TacticalAttackRange;
  /** Added to stat-derived movement, then clamped to [2, 7]. */
  moveBonus: number;
  /** Added to the crit formula (still clamped 0..60). */
  critBonus: number;
  label: string;
  blurb: string;
}

export const CLASS_PROFILES: Record<TacticalClass, ClassProfile> = {
  fighter: { attackRange: { min: 1, max: 1 }, moveBonus: 0, critBonus: 0, label: "Fighter", blurb: "Balanced melee." },
  knight: {
    attackRange: { min: 1, max: 1 },
    moveBonus: -1,
    critBonus: 0,
    label: "Knight",
    blurb: "Armored frontline.",
  },
  rogue: { attackRange: { min: 1, max: 1 }, moveBonus: 1, critBonus: 10, label: "Rogue", blurb: "Fast flanker." },
  archer: {
    attackRange: { min: 2, max: 3 },
    moveBonus: 0,
    critBonus: 5,
    label: "Archer",
    blurb: "Cannot strike or counter adjacent.",
  },
  mage: { attackRange: { min: 1, max: 2 }, moveBonus: 0, critBonus: 0, label: "Mage", blurb: "Ranged caster." },
  healer: {
    attackRange: { min: 1, max: 1 },
    moveBonus: 0,
    critBonus: 0,
    label: "Healer",
    blurb: "Support; heal reach stays 2.",
  },
};

const CLASS_NAMES: readonly TacticalClass[] = Object.keys(CLASS_PROFILES) as TacticalClass[];

/** Normalize a free-form class string (trim + lowercase) to a valid TacticalClass, else undefined. */
export function normalizeClass(value?: string): TacticalClass | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return (CLASS_NAMES as readonly string[]).includes(v) ? (v as TacticalClass) : undefined;
}

// Keyword tables scanned over the combatant's name + skill names (all lowercased).
// Order matters: the first matching category wins.
const KEYWORDS: Array<{ cls: TacticalClass; re: RegExp }> = [
  { cls: "archer", re: /bow|arrow|archer|shot|sniper|crossbow|gun|rifle|marksman/ },
  { cls: "mage", re: /mage|wizard|sorcer|witch|warlock|arcan|spell|elementalist/ },
  { cls: "rogue", re: /rogue|thief|assassin|ninja|scout|stalker/ },
  { cls: "knight", re: /knight|guard|paladin|tank|golem|shield|sentinel|juggernaut/ },
];

/**
 * Resolve a Combatant to its tactical class. Pure. Precedence (per the Round 3
 * contract):
 *   1. explicit `combatClass` (normalized) if valid
 *   2. any heal-type skill → healer
 *   3. name/skill keyword scan → archer/mage/rogue/knight
 *   4. ≥2 attack skills carrying an element → mage
 *   5. defense > attack → knight; else speed >= attack + 4 → rogue
 *   6. default fighter
 */
export function deriveClass(c: Combatant): TacticalClass {
  const explicit = normalizeClass(c.combatClass);
  if (explicit) return explicit;

  const skills = c.skills ?? [];

  if (skills.some((s) => s.type === "heal")) return "healer";

  const haystack = [c.name, ...skills.map((s) => s.name)].join(" ").toLowerCase();
  for (const { cls, re } of KEYWORDS) {
    if (re.test(haystack)) return cls;
  }

  const elementalAttacks = skills.filter((s) => s.type === "attack" && !!s.element).length;
  if (elementalAttacks >= 2) return "mage";

  if (c.defense > c.attack) return "knight";
  if (c.speed >= c.attack + 4) return "rogue";

  return "fighter";
}
