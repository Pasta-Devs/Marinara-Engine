// The dice a ruleset fight is made of, and the one place they are read out of text.
//
// Its own module so a creature, a party member's attack row and a turn in progress all throw dice
// the same way, without the bestiary having to reach into the encounter or the other way round.

import { deriveSubSeed, mulberry32 } from "../tactical-combat/rng.js";
import type { RulesetCombatAmount, RulesetCombatRoller } from "./types.js";

/** The seeded roller a server uses: the tactical engine's own stream, one die per tick, so a fight
 *  replays from its seed and the choices that were made. A caller that has its own dice (a test
 *  with a written sequence) passes those instead. */
export function rulesetCombatRoller(seed: number, cursor: number): RulesetCombatRoller {
  let tick = cursor;
  return (sides) => Math.floor(mulberry32(deriveSubSeed(seed, tick++))() * sides) + 1;
}

/** A face this die actually has. A roller that hands back something else is a caller's bug, and it
 *  costs that one die rather than the fight. */
function face(value: number, sides: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(sides, Math.max(1, Math.floor(value)));
}

/** Throw `count` dice, in order. */
export function rollRulesetDice(roll: RulesetCombatRoller, count: number, sides: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < Math.max(0, Math.min(100, Math.floor(count))); i++) rolls.push(face(roll(sides), sides));
  return rolls;
}

export function sumOf(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `2d6`, `1d8+3` or a plain number, as a sheet's dice column happens to hold it. A dice column is
 *  free text, so anything else reads as no dice at all rather than failing a turn. */
export function parseRulesetCombatDice(text: unknown): RulesetCombatAmount | null {
  // A dice column is short by its own schema; anything longer is not dice, and saying so first
  // keeps every pattern below on a string of bounded length.
  if (typeof text !== "string" || text.length > 40) return null;
  // Spaces are allowed around the parts ("2d6 + 3") and nowhere inside a number ("1 2d6" is not
  // twelve dice), so the parts are split on the letter and the sign rather than matched with a
  // pattern full of optional whitespace.
  const trimmed = text.trim();
  const split = /^([^dD]*)[dD]([^+-]*)([+-].*)?$/.exec(trimmed);
  const whole = (part: string | undefined, max: number) => {
    const digits = (part ?? "").trim();
    return /^\d+$/.test(digits) && digits.length <= max ? Number(digits) : null;
  };
  const count = split ? whole(split[1], 3) : null;
  const sides = split ? whole(split[2], 4) : null;
  const bonus = split?.[3] ? whole(split[3].slice(1), 4) : 0;
  if (!split || count === null || sides === null || bonus === null) {
    const flat = Number(trimmed);
    return trimmed !== "" && Number.isFinite(flat) && flat !== 0
      ? { count: 0, sides: 0, flat: Math.trunc(flat) }
      : null;
  }
  return { count, sides, flat: split[3]?.startsWith("-") ? -bonus : bonus };
}

/** The average of a roll. Never a future die: the expected amount, as it stands. */
export function rulesetAverageAmount(amount: { count: number; sides: number; flat: number }): number {
  return amount.count * ((amount.sides + 1) / 2) + amount.flat;
}

/**
 * What a whole blow averages: its first amount and every clause on it.
 *
 * A clause with a save of its own is counted IN FULL, because a forecast says what a blow would do,
 * not what a die nobody has thrown might take off it: the same reading the first amount gets when
 * the action itself asks for a save.
 */
export function rulesetAverageDamage(damage: {
  count: number;
  sides: number;
  flat: number;
  plus?: ReadonlyArray<{ count: number; sides: number; flat: number }>;
}): number {
  return (damage.plus ?? []).reduce(
    (total, clause) => total + rulesetAverageAmount(clause),
    rulesetAverageAmount(damage),
  );
}
