/**
 * #9117: a fight's combatants are merged by name, never by list position. A reply that returns the party or the
 * enemies in another order, or leaves one out, used to put attacks, items, sprites and descriptions on the wrong
 * combatant and drop the one left out.
 */
import assert from "node:assert/strict";

const { sanitizeParty, sanitizeEnemies } = await import("../../packages/client/src/lib/encounter-combatants.ts");

const party = [
  {
    name: "Shape Dru",
    hp: 10,
    maxHp: 12,
    attacks: [{ name: "Dru's blade" }],
    items: [{ name: "Dru's tonic" }],
    statuses: [],
    isPlayer: false,
  },
  {
    name: "Ines",
    hp: 8,
    maxHp: 8,
    attacks: [{ name: "Ines's lamp" }],
    items: [],
    statuses: [],
    isPlayer: true,
  },
];

// Returned in the other order, each still keeps its own kit and is updated with its own numbers.
const swapped = sanitizeParty(
  [
    { name: "ines", hp: 3, maxHp: 8 },
    { name: "Shape Dru", hp: 7 },
  ],
  party,
);
assert.deepEqual(
  swapped.map(({ name, hp, isPlayer }) => ({ name, hp, isPlayer })),
  [
    { name: "Ines", hp: 3, isPlayer: true },
    { name: "Shape Dru", hp: 7, isPlayer: false },
  ],
);
assert.equal(swapped[0]!.attacks[0]!.name, "Ines's lamp");
assert.equal(swapped[1]!.items[0]!.name, "Dru's tonic");

// One left out keeps the state it had; it does not disappear from the fight.
const partial = sanitizeParty([{ name: "Ines", hp: 2 }], party);
assert.deepEqual(
  partial.map(({ name, hp }) => ({ name, hp })),
  [
    { name: "Ines", hp: 2 },
    { name: "Shape Dru", hp: 10 },
  ],
);

// An entry with no name of its own updates nobody, and the fight stays whole.
assert.deepEqual(sanitizeParty([{}, { hp: 1 }], party), party);

const enemies = [
  { name: "Shape", hp: 20, maxHp: 20, attacks: [{ name: "claw" }], statuses: [], description: "mud", sprite: "a" },
  { name: "Dru", hp: 5, maxHp: 5, attacks: [], statuses: [], description: "false", sprite: "b" },
];
const foes = sanitizeEnemies(
  [
    { name: "Dru", hp: 1 },
    { name: "Shape", hp: 9, sprite: "c" },
  ],
  enemies,
);
assert.deepEqual(
  foes.map(({ name, hp, sprite, description }) => ({ name, hp, sprite, description })),
  [
    { name: "Dru", hp: 1, sprite: "b", description: "false" },
    { name: "Shape", hp: 9, sprite: "c", description: "mud" },
  ],
);
assert.equal(foes[1]!.attacks[0]!.name, "claw");

// A foe the fight does not have yet joins it, as it came.
const joined = sanitizeEnemies([{ name: "Mud thing", hp: 4, maxHp: 4 }], enemies);
assert.deepEqual(
  joined.map(({ name, hp }) => ({ name, hp })),
  [
    { name: "Mud thing", hp: 4 },
    { name: "Shape", hp: 20 },
    { name: "Dru", hp: 5 },
  ],
);

console.log("Encounter combatants: merged by name, never by list position (#9117).");
