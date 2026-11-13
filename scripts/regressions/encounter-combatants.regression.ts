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

// Two foes of one name are matched one for the other: the reply's two entries update both, never both the first.
const twins = [
  { name: "Wolf", hp: 5, maxHp: 5, attacks: [], statuses: [], description: "grey", sprite: "a" },
  { name: "Wolf", hp: 7, maxHp: 7, attacks: [], statuses: [], description: "dark", sprite: "b" },
];
const pair = sanitizeEnemies(
  [
    { name: "Wolf", hp: 1 },
    { name: "Wolf", hp: 2 },
  ],
  twins,
);
assert.deepEqual(
  pair.map(({ hp, description, sprite }) => ({ hp, description, sprite })),
  [
    { hp: 1, description: "grey", sprite: "a" },
    { hp: 2, description: "dark", sprite: "b" },
  ],
);
// A reply that names one other love interest's... one Wolf leaves the other as it was.
const one = sanitizeEnemies([{ name: "Wolf", hp: 3 }], twins);
assert.deepEqual(
  one.map(({ hp }) => hp),
  [3, 7],
);

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

// A reply naming one foe more often than the fight has foes of that name adds no phantom: the pair is matched
// one for the other and the third is dropped, rather than arriving with hp from the reply and no attacks.
const repeated = sanitizeEnemies(
  [
    { name: "Wolf", hp: 2 },
    { name: "Wolf", hp: 4 },
    { name: "Wolf", hp: 6 },
  ],
  twins,
);
assert.deepEqual(
  repeated.map(({ name, hp }) => ({ name, hp })),
  [
    { name: "Wolf", hp: 2 },
    { name: "Wolf", hp: 4 },
  ],
);

// A repeat spelled with other case is the same foe: matching reads names without case, so the guard does too.
const cased = sanitizeEnemies(
  [
    { name: "wolf", hp: 2 },
    { name: "wolf", hp: 4 },
  ],
  twins,
);
assert.deepEqual(
  cased.map(({ name, hp }) => ({ name, hp })),
  [
    { name: "Wolf", hp: 2 },
    { name: "Wolf", hp: 4 },
  ],
  "a second wolf is the fight's other Wolf, not a new foe",
);

console.log("Encounter combatants: merged by name, never by list position (#9117).");
