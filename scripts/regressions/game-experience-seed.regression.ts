// Client-side coercion pin for the setup wizard's world-seed field.
//
// The server lane (`experience-setup-config.regression.ts`) proves the SERVER stores whatever
// `experienceConfig` it is handed. This lane pins the CLIENT side, which is the side that can drift: the
// field is text, the contract is a number, and a game-surface package type-checks the value it reads back.
// A fraction, a negative or a value past uint32 falls through whatever default the package uses instead, so
// the player gets a world unrelated to the number the wizard showed them, with no error anywhere. That
// silence is the whole reason this lane exists.
//
// The rule this pins: the field accepts DIGITS ONLY, with optional surrounding whitespace, and
// `parseExperienceSeed` returns EITHER null (the wizard refuses Start and says so) OR the uint32 those
// digits spell. Nothing is salvaged out of a value that is not all digits: `Number` reads "1e3" as 1000 and
// "0x10" as 16, `Number.parseInt` reads "1.5" as 1 and "12abc" as 12, so the world would be built from a
// number the player never saw. Refusing is visible; quietly building a different world is not.
import assert from "node:assert/strict";

import {
  MAX_EXPERIENCE_SEED,
  isExperienceSeed,
  parseExperienceSeed,
} from "../../packages/client/src/lib/game-experience-setup.js";

assert.equal(MAX_EXPERIENCE_SEED, 0xffffffff, "The seed is written as an unsigned 32-bit integer");

/** Everything that leaves the parser is null or a writable uint32. There is no third shape. */
function assertWritable(raw: unknown) {
  const parsed = parseExperienceSeed(raw);
  if (parsed === null) return null;
  assert.equal(typeof parsed, "number", `parseExperienceSeed(${JSON.stringify(raw)}) must never yield a non-number`);
  assert.ok(Number.isInteger(parsed), `parseExperienceSeed(${JSON.stringify(raw)}) must never yield a fraction`);
  assert.ok(isExperienceSeed(parsed), `parseExperienceSeed(${JSON.stringify(raw)}) must never yield a stray seed`);
  // The package reads the value back as a uint32, so a parsed value that is not already its own uint32 would
  // stop being the number the wizard showed.
  assert.equal(parsed >>> 0, parsed, `parseExperienceSeed(${JSON.stringify(raw)}) must already be its own uint32`);
  return parsed;
}

// Not all digits, so refused outright rather than salvaged. `1e3`, `0x10` and `1.5` are the ones worth
// staring at: each is a number a JavaScript reader would happily accept, and each would mean something
// different to the package than it looks like on screen.
for (const raw of [
  "",
  " ",
  "\t\n",
  "abc",
  "one",
  "1.5",
  "3.999",
  "12abc",
  "+5",
  "1e3",
  "0x10",
  "-0.5",
  "-1",
  "-12",
  "2 3",
  "NaN",
  "Infinity",
])
  assert.equal(parseExperienceSeed(raw), null, `${JSON.stringify(raw)} should not produce a seed`);

// All digits, but past the ceiling. The digits-only test is not enough on its own; the range check still runs.
for (const raw of ["4294967296", "99999999999"])
  assert.equal(parseExperienceSeed(raw), null, `${JSON.stringify(raw)} is digits but outside the uint32 range`);

// Numbers reach the parser from imported setup files, where the same range rule applies.
for (const value of [1.5, -3, -0.5, 4294967296, Number.NaN, Number.POSITIVE_INFINITY])
  assert.equal(parseExperienceSeed(value), null, `${value} must not be accepted as a seed`);
for (const value of [null, undefined, {}, [], true])
  assert.equal(parseExperienceSeed(value), null, "Only numbers and digit strings can be seeds");

// Accepted, including both ends of the range. The value is exactly the number the digits spell, and the
// SHAPE never degrades: null, or a writable uint32.
assert.equal(assertWritable("0"), 0, "0 is a usable seed");
assert.equal(assertWritable("4294967295"), MAX_EXPERIENCE_SEED, "The top of the uint32 range is a usable seed");
assert.equal(assertWritable("0012"), 12, "Leading zeroes are read as decimal, never as octal");
assert.equal(assertWritable(123456), 123456, "An imported numeric seed round-trips");

// Surrounding whitespace is tolerated rather than refused: a pasted seed carries it, and the number the
// player can see on screen is still the number the world is built from.
assert.equal(assertWritable(" 7 "), 7, "Whitespace around a seed is trimmed, not treated as a typo");
assert.equal(assertWritable("\n42\t"), 42, "Any surrounding whitespace is tolerated");

// The validator the import path gates on agrees with the parser.
for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_EXPERIENCE_SEED + 1])
  assert.equal(isExperienceSeed(value), false, `${value} must not be writable as a seed`);
for (const value of [0, 1, 123456, MAX_EXPERIENCE_SEED])
  assert.equal(isExperienceSeed(value), true, `${value} must be writable as a seed`);

// A fresh roll is always writable. The wizard prefills and randomizes with this expression, and a roll the
// parser then refused would block Start on a seed the player never typed. Drawn many times because the
// failure mode is rare per draw and permanent per world.
const seen = new Set<number>();
for (let draw = 0; draw < 500; draw += 1) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  assert.equal(isExperienceSeed(seed), true, "Every rolled seed must pass the wizard's own validation");
  assert.equal(parseExperienceSeed(String(seed)), seed, "Every rolled seed must survive the text field");
  seen.add(seed);
}
assert.ok(seen.size > 1, "The random seed must not return one constant");

console.log("World-seed coercion accepts digits only and never yields a fraction or an out-of-range seed.");
