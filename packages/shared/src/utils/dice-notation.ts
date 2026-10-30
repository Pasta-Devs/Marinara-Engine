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
  /** The dice half, lowercased and without the modifier — "d20", "2d6", or a pool's "4d6kh3". */
  dice: string;
  /** Number of dice to throw (at least 1). */
  count: number;
  /** Faces per die (at least 1). */
  sides: number;
  /** Flat modifier; 0 when the notation carried none. */
  modifier: number;
  /** Which dice count toward the total (`4d6kh3`, `2d20kl1`, `4d6dl1`), read only by
   *  `parseDicePool`. Absent, every die counts. */
  keep?: DiceKeep;
}

/** The dice of a pool that count: the highest or lowest `count` of them. A drop is the keep of the
 *  rest (`4d6dl1` keeps the highest 3), so a rolled pool only ever reads one rule. */
export interface DiceKeep {
  highest: boolean;
  count: number;
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

/** NdM with a keep or drop, then the modifier: `4d6kh3`, `2d20kl1`, `4d6dl1+2`. `k` alone keeps the
 *  highest, as most tabletop rollers read it. */
const DICE_POOL_REGEX = /^(\d*d\d+)(kh|kl|dh|dl|k)(\d+)([+-]\d+)?$/i;

/**
 * Parse a dice pool: NdM, or NdM that keeps or drops some of its dice before the modifier is added.
 *
 * The plain rollers (`/roll`, composer dice, the `roll_dice` tool, multiplayer `/roll`) read this;
 * readers that only ever take NdM (sheets, the GM's tags) keep `parseDiceNotation`. A keep must
 * leave at least one die and at most every die (`2d20kh3` and `4d6dl4` are refused); everything
 * else is held to `parseDiceNotation`'s rules.
 */
export function parseDicePool(value: string): ParsedDiceNotation | null {
  const notation = value.trim();
  const match = notation.match(DICE_POOL_REGEX);
  if (!match) return parseDiceNotation(notation);
  const base = parseDiceNotation(`${match[1]}${match[4] ?? ""}`);
  const named = Number.parseInt(match[3]!, 10);
  if (!base || !Number.isSafeInteger(named)) return null;
  const rule = match[2]!.toLowerCase();
  const count = rule.startsWith("d") ? base.count - named : named;
  if (count < 1 || count > base.count) return null;
  return {
    ...base,
    notation,
    dice: `${base.dice}${rule}${match[3]}`.toLowerCase(),
    keep: { highest: rule === "k" || rule === "kh" || rule === "dl", count },
  };
}

/** Whether the text is dice notation this engine can roll. */
export function isDiceNotation(value: string): boolean {
  return parseDiceNotation(value) !== null;
}

/** Whether the text is a dice pool the plain rollers can roll (NdM, or NdM with a keep or drop). */
export function isDicePoolNotation(value: string): boolean {
  return parseDicePool(value) !== null;
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
  // A pool's keep is held to the dice that are left, and written as the keep it now is.
  const keep = parsed.keep ? { highest: parsed.keep.highest, count: Math.min(parsed.keep.count, count) } : undefined;
  const dice = `${parsed.dice.startsWith("d") ? "" : count}d${sides}${keep ? `${keep.highest ? "kh" : "kl"}${keep.count}` : ""}`;
  const modifierText = parsed.modifier === 0 ? "" : `${parsed.modifier > 0 ? "+" : ""}${parsed.modifier}`;
  return {
    notation: `${dice}${modifierText}`,
    dice,
    count,
    sides,
    modifier: parsed.modifier,
    ...(keep ? { keep } : {}),
  };
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

/** Throw the dice a parsed notation asks for, one `roll(sides)` per die. A pool that keeps some
 *  (`4d6kh3`) reports every face and the places of the kept ones, and totals only those. */
export function rollParsedDice(parsed: ParsedDiceNotation, roll: DieRoller = rollDieSecurely): DiceRollResult {
  const rolls: number[] = [];
  for (let index = 0; index < parsed.count; index += 1) {
    rolls.push(roll(parsed.sides));
  }
  const kept = parsed.keep ? keptDice(rolls, parsed.keep) : undefined;
  const counted = kept ? kept.map((index) => rolls[index]!) : rolls;
  return {
    notation: parsed.notation,
    rolls,
    modifier: parsed.modifier,
    total: counted.reduce((sum, face) => sum + face, 0) + parsed.modifier,
    ...(kept ? { kept } : {}),
  };
}

/** A rolled pool's faces as text, each die that did not count struck through: `6, 5, ~~1~~, 4`. */
export function formatKeptRolls(rolls: readonly number[], kept?: readonly number[]): string {
  return rolls.map((face, index) => (!kept || kept.includes(index) ? String(face) : `~~${face}~~`)).join(", ");
}

/** Whether a stored `kept` reads as places in a roll of `length` dice: whole, in range, ascending, none twice. */
export function isKeptDice(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (index, place) =>
        Number.isSafeInteger(index) &&
        index >= 0 &&
        index < length &&
        (place === 0 || index > (value[place - 1] as number)),
    )
  );
}

/** The places, in throw order, of the dice a keep counts. Every face stays as it fell; a tie goes
 *  to the die thrown first. */
export function keptDice(rolls: readonly number[], keep: DiceKeep): number[] {
  return rolls
    .map((face, index) => ({ face, index }))
    .sort((a, b) => (keep.highest ? b.face - a.face : a.face - b.face) || a.index - b.index)
    .slice(0, keep.count)
    .map(({ index }) => index)
    .sort((a, b) => a - b);
}
