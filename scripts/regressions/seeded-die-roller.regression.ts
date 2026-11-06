import assert from "node:assert/strict";
import {
  dieRollerFrom,
  parseDicePool,
  rollParsedDice,
  rulesetCombatRoller,
  seededDieRoller,
} from "../../packages/shared/dist/index.js";
import { deriveSubSeed, mulberry32 } from "../../packages/shared/dist/features/tactical-combat/rng.js";

// A ruleset fight replays from its seed, so moving its roller into the shared dice module must not
// change one face. The formula below is the one ruleset combat carried before; every seed, cursor
// and die size here has to throw exactly what it threw.
const before = (seed: number, cursor: number) => {
  let tick = cursor;
  return (sides: number) => Math.floor(mulberry32(deriveSubSeed(seed, tick++))() * sides) + 1;
};

for (const seed of [0, 1, 42, 0x7fffffff, 0xffffffff, 123456789]) {
  for (const cursor of [0, 1, 7, 10_000, 20_000]) {
    const old = before(seed, cursor);
    const shared = seededDieRoller(seed, cursor);
    const combat = rulesetCombatRoller(seed, cursor);
    for (const sides of [2, 4, 6, 8, 10, 12, 20, 100, 3, 7]) {
      const face = old(sides);
      assert.equal(shared(sides), face, `seed ${seed}, cursor ${cursor}, d${sides}`);
      assert.equal(combat(sides), face, "ruleset combat throws through the shared roller");
      assert.ok(face >= 1 && face <= sides);
    }
  }
}

// Each die costs one tick: a roller started one tick later is the same stream, one die behind.
const first = seededDieRoller(99, 0);
first(20);
const second = seededDieRoller(99, 1);
for (let i = 0; i < 20; i++) assert.equal(first(20), second(20));

// A caller that already holds a [0,1) stream gets the same faces it computed by hand.
const stream = mulberry32(deriveSubSeed(5, 3));
const sameStream = mulberry32(deriveSubSeed(5, 3));
const fromStream = dieRollerFrom(stream);
for (const sides of [4, 6, 8, 20, 100]) {
  assert.equal(fromStream(sides), 1 + Math.floor(sameStream() * sides));
}

// The plain notation reader takes the seeded roller too, so a replayed NdM roll is the same roll.
const pool = parseDicePool("4d6kh3+2");
assert.ok(pool);
assert.deepEqual(rollParsedDice(pool, seededDieRoller(7, 0)), rollParsedDice(pool, seededDieRoller(7, 0)));

process.stdout.write("Seeded die roller regression passed.\n");
