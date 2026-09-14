// Client-side coercion pin for the setup wizard's world-seed field.
//
// The server lane (`experience-setup-config.regression.ts`) proves the SERVER stores whatever
// `experienceConfig` it is handed. Nothing pinned the CLIENT side, which is the side that can drift: the
// field is text, the contract is a number, and a game-surface package type-checks the value it reads back.
// A string, a NaN, a negative or a value past uint32 falls through whatever default the package uses
// instead, so the player gets a world unrelated to the number the wizard showed them, with no error
// anywhere. That silence is the whole reason this lane exists.
//
// The rule this pins: `parseSeedInput` returns EITHER null (the caller keeps its last accepted value and
// refuses Start) OR a uint32 integer. It never returns a string, a NaN, a negative, a fraction or anything
// above 0xffffffff — for any input the field can hold, including partially typed and pasted values.
import assert from "node:assert/strict";
import {
  MAX_GAME_EXPERIENCE_SEED,
  isValidSeed,
  parseSeedInput,
  randomSeed,
} from "../../packages/client/src/lib/game-experience-seed.js";

assert.equal(MAX_GAME_EXPERIENCE_SEED, 0xffffffff, "The seed is written as an unsigned 32-bit integer");

/** Everything that leaves the module is null or a writable uint32. There is no third shape. */
function assertWritable(raw: string) {
  const parsed = parseSeedInput(raw);
  if (parsed === null) return null;
  assert.equal(typeof parsed, "number", `parseSeedInput(${JSON.stringify(raw)}) must never yield a non-number`);
  assert.ok(Number.isInteger(parsed), `parseSeedInput(${JSON.stringify(raw)}) must never yield a fraction`);
  assert.ok(
    parsed >= 0 && parsed <= MAX_GAME_EXPERIENCE_SEED,
    `parseSeedInput(${JSON.stringify(raw)}) must never yield an out-of-range seed`,
  );
  // The wizard writes `seed >>> 0`, so a parsed value that is not already its own uint32 would be
  // rewritten on the way out and the number on screen would stop being the number the world is built from.
  assert.ok(parsed >>> 0 === parsed, `parseSeedInput(${JSON.stringify(raw)}) must already be its own uint32`);
  return parsed;
}

// Refused outright. Each one keeps the last accepted seed standing and marks the field invalid, rather
// than writing a value the package cannot use.
for (const raw of ["", " ", "\t\n", "abc", "-1", "-12", "4294967296", "99999999999", "NaN", "Infinity", "one"])
  assert.equal(parseSeedInput(raw), null, `${JSON.stringify(raw)} should not produce a seed`);

// Accepted, including both ends of the range.
assert.equal(parseSeedInput("0"), 0, "0 is a usable seed");
assert.equal(parseSeedInput("4294967295"), MAX_GAME_EXPERIENCE_SEED, "The top of the uint32 range is a usable seed");
assert.equal(parseSeedInput("123456"), 123456, "A plain number round-trips");

// Surrounding whitespace is tolerated rather than refused: a pasted seed carries it, and the number the
// player can see on screen is the number the world is built from.
assert.equal(parseSeedInput(" 7 "), 7, "Whitespace around a seed is trimmed, not treated as a typo");
assert.equal(parseSeedInput("\n42\t"), 42, "Any surrounding whitespace is tolerated");

// Values the field can hold mid-typing or receive from a paste. Whatever the coercion decides for each
// one, the SHAPE never degrades: null, or a writable uint32.
for (const raw of ["12abc", "1.5", "3.999", "0012", "+5", " 7 ", "2 3", "1e3", "0x10", "-0.5", "4294967295.9"])
  assertWritable(raw);
assert.equal(assertWritable("1.5"), 1, "A fraction is truncated to its whole part rather than written as a fraction");
assert.equal(assertWritable("12abc"), 12, "A numeric prefix is read as that number rather than written as text");

// The validator the wizard gates Start on agrees with the parser.
for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_GAME_EXPERIENCE_SEED + 1])
  assert.equal(isValidSeed(value), false, `${value} must not be writable as a seed`);
for (const value of [0, 1, 123456, MAX_GAME_EXPERIENCE_SEED])
  assert.equal(isValidSeed(value), true, `${value} must be writable as a seed`);

// A fresh roll is always writable. Drawn many times because the failure mode — a rounding or shift bug at
// one end of the range — is rare per draw and permanent per world.
const seen = new Set<number>();
for (let draw = 0; draw < 500; draw += 1) {
  const seed = randomSeed();
  assert.equal(typeof seed, "number", "randomSeed must return a number");
  assert.ok(Number.isInteger(seed), "randomSeed must return an integer");
  assert.ok(seed >= 0 && seed <= MAX_GAME_EXPERIENCE_SEED, "randomSeed must stay inside the uint32 range");
  assert.equal(isValidSeed(seed), true, "Every rolled seed must pass the wizard's own validation");
  seen.add(seed);
}
assert.ok(seen.size > 1, "randomSeed must not return one constant");

console.log("World-seed coercion never yields a non-number or an out-of-range seed.");
