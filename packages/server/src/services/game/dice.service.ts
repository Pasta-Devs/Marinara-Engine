// ──────────────────────────────────────────────
// Game: Dice Rolling Service
//
// The NdM grammar and the roller live in
// @marinara-engine/shared (utils/dice-notation.ts).
// What stays here is this path's own bounds policy:
// an oversized roll is clamped to the ceilings, not
// refused, so /roll still answers 500d6 with a roll.
// The result names the dice it threw, so a clamped
// roll reads 100d6 rather than the 500d6 asked for.
// ──────────────────────────────────────────────

import {
  clampParsedDiceToLimits,
  parseDiceNotation,
  rollParsedDice,
  type DiceRollResult,
} from "@marinara-engine/shared";

export { isDiceNotation } from "@marinara-engine/shared";

/**
 * Parse and roll dice using NdM notation (e.g. "2d6+3", "d20", "4d8-1").
 * Returns individual rolls, modifier, and total.
 */
export function rollDice(notation: string): DiceRollResult {
  const parsed = parseDiceNotation(notation);
  if (!parsed) {
    throw new Error(`Invalid dice notation: "${notation}". Use NdM format (e.g. 2d6, d20+3, 4d8-1).`);
  }

  return rollParsedDice(clampParsedDiceToLimits(parsed));
}
