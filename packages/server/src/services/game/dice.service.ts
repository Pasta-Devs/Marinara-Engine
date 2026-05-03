// ──────────────────────────────────────────────
// Game: Dice Rolling Service
// ──────────────────────────────────────────────

import type { DiceRollResult } from "@marinara-engine/shared";

export const DICE_NOTATION_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;

export function isDiceNotation(value: string): boolean {
  const match = value.trim().match(DICE_NOTATION_REGEX);
  if (!match) return false;
  const count = parseInt(match[1] ?? "1", 10);
  const sides = parseInt(match[2]!, 10);
  return count >= 1 && sides >= 1;
}

/**
 * Parse and roll dice using NdM notation (e.g. "2d6+3", "d20", "4d8-1").
 * Returns individual rolls, modifier, and total.
 */
export function rollDice(notation: string): DiceRollResult {
  const match = notation.trim().match(DICE_NOTATION_REGEX);
  if (!match) {
    throw new Error(`Invalid dice notation: "${notation}". Use NdM format (e.g. 2d6, d20+3, 4d8-1).`);
  }

  const count = Math.min(parseInt(match[1] ?? "1", 10), 100);
  const sides = Math.min(parseInt(match[2]!, 10), 1000);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1 || sides < 1) {
    throw new Error("Dice count and sides must be at least 1.");
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;

  return { notation: notation.trim(), rolls, modifier, total };
}
