// Coercion rules for the setup wizard's world-seed field, kept free of React and the DOM so the
// contract can be exercised on its own.
//
// The seed is a NUMBER everywhere, never a string. A game-surface package reads it back out of its
// own `experienceConfig` and typically type-checks it; a string falls through whatever default the
// package uses instead, so the player gets a world unrelated to the number the wizard showed them,
// with no error anywhere. Every value that leaves this module is a uint32 or null.
//
// The field accepts DIGITS ONLY, with optional surrounding whitespace. Anything else is refused
// rather than salvaged, because salvaging is the same silent failure in a different coat:
// `Number.parseInt` alone reads "1.5" as 1, "12abc" as 12, "1e3" as 1, "0x10" as 0 and "-0.5" as -0,
// so the world would be built from a number the player never saw and was never told about. Refusing
// turns the field red and blocks Start, which the player can see and correct.

/** Largest value the field accepts. The seed is written as an unsigned 32-bit integer. */
export const MAX_GAME_EXPERIENCE_SEED = 0xffffffff;

/** A fresh seed for a new game. */
export function randomSeed(): number {
  return (Math.random() * MAX_GAME_EXPERIENCE_SEED) >>> 0;
}

/** Whether a number may be written to `experienceConfig` as a seed. */
export function isValidSeed(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_GAME_EXPERIENCE_SEED;
}

/**
 * The typed value, or null when the field does not hold a usable seed. Only a run of digits, with
 * optional surrounding whitespace, is read; every other shape is null, and so is a digit run that
 * spells a number past the uint32 ceiling. Null covers the empty field too: the caller keeps its
 * last accepted value and marks the field invalid rather than silently writing nothing.
 */
export function parseSeedInput(raw: string): number | null {
  if (!/^\s*\d+\s*$/u.test(raw)) return null;
  const parsed = Number.parseInt(raw.trim(), 10);
  return isValidSeed(parsed) ? parsed : null;
}
