// ──────────────────────────────────────────────
// Game: the one-request dice roller
//
// Every mechanism the one-request chance pass owns
// rolls through this supplier, and nothing else does.
//
// Deliberately not Math.random(): the shipped rollers
// in shared/utils/dice-notation.ts and skill-check.service.ts
// use it, the grammar consolidation left that RNG alone on
// purpose, and this is new code, so it starts on the stronger
// primitive without touching either existing call site.
//
// Deliberately not the macro engine's seeded randomness
// either: that seed is derived from data the model can see.
// ──────────────────────────────────────────────

import { randomInt } from "node:crypto";

/** One die of `sides` faces. Injected wherever a roll has to be substitutable in a lane. */
export type DieRoller = (sides: number) => number;

/** Throw one fair die, 1..sides inclusive. */
export const rollDieSecurely: DieRoller = (sides) => {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new RangeError(`A die needs at least one whole face, received ${String(sides)}`);
  }
  return randomInt(1, sides + 1);
};
