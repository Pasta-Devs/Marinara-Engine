// ──────────────────────────────────────────────
// Dice Notation — the one NdM grammar
//
// The tool executor, the /roll service, the GM
// skill-check tag and the client slash roller all
// parse through this module; the {{roll}} macro and
// the narration badge read the same grammar (the
// macro keeps its own looser count and face limits).
// The dice card keeps its own display-only reader.
// Before this module existed, those four command
// readers each carried their own regex, and they
// disagreed: bare "d20" was legal in three of them
// and an error in the fourth.
//
// It also holds the one roller shape (`DieRoller`),
// so the code that reads a roll never chooses where
// its dice come from.
// ──────────────────────────────────────────────

import type { DiceRollResult } from "../types/game.js";

/**
 * NdM notation: an optional die count (bare `d20` means one die), a face count,
 * and an optional flat modifier. Case-insensitive.
 */
export const DICE_NOTATION_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;

/**
 * The same notation as a pattern source with no groups, for a reader that finds
 * dice inside longer text (the narration badge's `[dice: 2d6+3 = 11]`) rather
 * than parsing a whole string. Build with the `i` flag.
 */
export const DICE_NOTATION_PATTERN = String.raw`\d*d\d+(?:[+-]\d+)?`;

/** Most dice one notation may throw. */
export const MAX_DICE_COUNT = 100;
/** Most faces a die may have. */
export const MAX_DICE_SIDES = 1000;

export interface ParsedDiceNotation {
  /** The notation as written, trimmed. */
  notation: string;
  /** The NdM half, lowercased and without the modifier — "d20", "2d6". */
  dice: string;
  /** Number of dice to throw (at least 1). */
  count: number;
  /** Faces per die (at least 1). */
  sides: number;
  /** Flat modifier; 0 when the notation carried none. */
  modifier: number;
}

/**
 * Parse NdM notation.
 *
 * Returns `null` when the text is not dice notation, when it asks for fewer
 * than one die or fewer than one face, when a count, face or modifier value is
 * too large to be an exact integer, or when the range of totals the notation
 * could roll would leave the exact integers at either end.
 *
 * Ceilings past that are each caller's policy, not the grammar's: this module
 * does not decide whether `500d6` is refused or clamped, because the shipped
 * callers genuinely disagree — see `isWithinDiceLimits` and
 * `clampParsedDiceToLimits`.
 */
export function parseDiceNotation(value: string): ParsedDiceNotation | null {
  const notation = value.trim();
  const match = notation.match(DICE_NOTATION_REGEX);
  if (!match) return null;

  const countText = match[1];
  const sidesText = match[2]!;
  const count = Number.parseInt(countText ?? "1", 10);
  const sides = Number.parseInt(sidesText, 10);
  // The modifier is held to the same exactness bar as the count and the faces.
  // The regex puts no ceiling on its digits, so "1d6+<49 nines>" parses to an
  // imprecise float and a long enough one parses to Infinity — either way the
  // roll's total stops being a number anyone can trust, and a caller that hands
  // it to a model reports a wrong total rather than a rejected notation.
  const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(sides) || !Number.isSafeInteger(modifier)) return null;
  if (count < 1 || sides < 1) return null;

  // Exact pieces are not enough. What every reader reports is the total, and the
  // total is `sum(rolls) + modifier` added as floats. Each die shows at least 1
  // and at most `sides`, so a throw lands somewhere in
  // [modifier + count, modifier + count * sides], and the rule is that *both*
  // ends of that range stay exact — which end a throw lands near is the RNG's
  // business, not the parser's. "1d6+9007199254740991" is exact in every piece
  // and still totals 2^53 the moment the die shows a 6.
  //
  // Only the high end needs a branch. The low end is the negative mirror, and it
  // cannot leave the safe integers on its own: dice only ever add, so a negative
  // modifier is pushed *toward* zero (modifier + count > modifier >= -(2^53-1)),
  // and a positive modifier puts the low end under a high end that has already
  // been checked. The asymmetry is the arithmetic's — "1d6-9007199254740991"
  // stays legal while its positive twin no longer does. The low end is pinned in
  // the regression as a property of every accepted notation rather than here as
  // a branch no input can reach.
  //
  // `count * sides` is checked on its own first: past 2^53 the product itself
  // rounds, and a rounded product carried into the sum can land a notation back
  // inside the safe range and claim an exactness the true total does not have
  // ("3d3002399751580331-1" is that shape).
  const maxRollSum = count * sides;
  if (!Number.isSafeInteger(maxRollSum)) return null;
  if (!Number.isSafeInteger(modifier + maxRollSum)) return null;

  return {
    notation,
    dice: `${countText ?? ""}d${sidesText}`.toLowerCase(),
    count,
    sides,
    modifier,
  };
}

/** Whether the text is dice notation this engine can roll. */
export function isDiceNotation(value: string): boolean {
  return parseDiceNotation(value) !== null;
}

/** Whether a parsed notation sits inside the shared count and face ceilings. */
export function isWithinDiceLimits(parsed: Pick<ParsedDiceNotation, "count" | "sides">): boolean {
  return parsed.count <= MAX_DICE_COUNT && parsed.sides <= MAX_DICE_SIDES;
}

/**
 * Trim an oversized notation down to the ceilings instead of refusing it.
 *
 * The clamped result carries the notation of the dice that will actually be
 * thrown, not the one that was asked for — `500d6` comes back as `100d6`. This
 * type holds one notation, not a requested/rolled pair, and the notation every
 * reader of a roll shows is this one: the dice card's header, the narrator tag
 * the model is handed, the metadata stored on the message. A clamped roll used
 * to hand all three the request, so a hundred dice landed under a card headed
 * `500d6`. The request now survives only where a caller kept its own copy of the
 * input, which is where a caller that wants to say "asked for 500, threw 100"
 * would read it from.
 *
 * A notation already inside the ceilings comes back unchanged down to the
 * characters — `1d020` stays `1d020` — so only a roll that really was trimmed
 * reads differently than it did.
 *
 * Callers that must not throw fewer dice than a model asked for use
 * `isWithinDiceLimits` and refuse instead.
 */
export function clampParsedDiceToLimits(parsed: ParsedDiceNotation): ParsedDiceNotation {
  const count = Math.min(parsed.count, MAX_DICE_COUNT);
  const sides = Math.min(parsed.sides, MAX_DICE_SIDES);
  if (count === parsed.count && sides === parsed.sides) return { ...parsed };

  // Rebuilt from the clamped pieces, in the form the notation was written in.
  // `dice` is the parser's own record of whether a count was spelled out, so
  // reading its leading `d` keeps bare `d5000` bare rather than promoting it to
  // `1d1000` — and a bare notation is one die, which is never the piece that
  // clamps. The modifier is outside both ceilings and carries its own sign back.
  const dice = `${parsed.dice.startsWith("d") ? "" : count}d${sides}`;
  const modifierText = parsed.modifier === 0 ? "" : `${parsed.modifier > 0 ? "+" : ""}${parsed.modifier}`;
  return { notation: `${dice}${modifierText}`, dice, count, sides, modifier: parsed.modifier };
}

/**
 * One die of `sides` faces, 1..sides inclusive.
 *
 * Every roller in the engine has this shape, so a caller decides where its dice
 * come from and the code that reads a roll does not: player-facing rolls use
 * `rollDieSecurely`, and a ruleset fight passes its seeded stream so it can be
 * replayed.
 */
export type DieRoller = (sides: number) => number;

/** Most faces `rollDieSecurely` can draw evenly from one 32-bit value. */
const SECURE_DIE_RANGE = 0x1_0000_0000;

/**
 * Throw one fair die from the platform's cryptographic RNG.
 *
 * Web Crypto's `getRandomValues`, so the browser and the server roll the same
 * way. A draw past the last whole multiple of `sides` is thrown again rather
 * than wrapped, so no face comes up more often than another.
 */
export const rollDieSecurely: DieRoller = (sides) => {
  if (!Number.isInteger(sides) || sides < 1 || sides > SECURE_DIE_RANGE) {
    throw new RangeError(`A die needs at least one whole face, received ${String(sides)}`);
  }
  const limit = SECURE_DIE_RANGE - (SECURE_DIE_RANGE % sides);
  const draw = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(draw);
  while (draw[0]! >= limit);
  return (draw[0]! % sides) + 1;
};

/** Throw the dice a parsed notation asks for, one `roll(sides)` per die. */
export function rollParsedDice(parsed: ParsedDiceNotation, roll: DieRoller = rollDieSecurely): DiceRollResult {
  const rolls: number[] = [];
  for (let index = 0; index < parsed.count; index += 1) {
    rolls.push(roll(parsed.sides));
  }
  return {
    notation: parsed.notation,
    rolls,
    modifier: parsed.modifier,
    total: rolls.reduce((sum, face) => sum + face, 0) + parsed.modifier,
  };
}
