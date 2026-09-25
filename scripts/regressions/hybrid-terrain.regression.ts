import assert from "node:assert/strict";
import {
  applyAction,
  buildTacticalSummary,
  createTacticalCombat,
  forecastAttack,
  generateTacticalBattlefield,
  getMovementRange,
  summarizeTacticalBattlefield,
  validateTacticalBattlefieldBrief,
} from "../../packages/shared/src/features/tactical-combat/index.js";
import { generateGrid } from "../../packages/shared/src/features/tactical-combat/grid-gen.js";
import { deterministicRng } from "../../packages/shared/src/features/tactical-combat/rng.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";

const combatant = (id: string, movementMode?: Combatant["movementMode"]): Combatant => ({
  id,
  name: id,
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 4,
  speed: 10,
  level: 1,
  side: id.startsWith("enemy") ? "enemy" : "player",
  ...(movementMode ? { movementMode } : {}),
});

// An omitted brief must keep the old seeded grid byte-for-byte, even though the
// new battlefield path records provenance separately.
const legacy = generateGrid(2, deterministicRng(71, 0), "forest");
const hybrid = generateTacticalBattlefield(2, deterministicRng(71, 0), "forest", undefined);
assert.equal(hybrid.ok, true, "an omitted brief must produce a generated battlefield");
if (!hybrid.ok) throw new Error(hybrid.error);
assert.deepEqual(hybrid.grid, legacy, "an omitted brief must preserve legacy seeded terrain output");
assert.equal(hybrid.battlefield.generatorVersion, 1);
assert.equal(hybrid.battlefield.size, "small");

for (const [unitCount, size, width, height] of [
  [5, "small", 12, 8],
  [6, "medium", 13, 9],
  [8, "medium", 13, 9],
  [9, "large", 14, 10],
] as const) {
  const generated = generateTacticalBattlefield(unitCount, deterministicRng(71, 0), "forest", undefined);
  if (!generated.ok) throw new Error(generated.error);
  assert.deepEqual([generated.battlefield.size, generated.grid.width, generated.grid.height], [size, width, height]);
  assert.deepEqual(generated.grid, generateGrid(unitCount, deterministicRng(71, 0), "forest"));
}

const landmark = generateTacticalBattlefield(2, deterministicRng(99, 0), "plains", {
  size: "large",
  features: [{ terrain: "wall", placement: "center", shape: "barrier" }],
});
assert.equal(landmark.ok, true, "a bounded landmark brief must generate a battle");
if (!landmark.ok) throw new Error(landmark.error);
assert.deepEqual([landmark.grid.width, landmark.grid.height], [14, 10], "the requested fixed size must be resolved");
assert.equal(
  [...landmark.protectedTiles].every((key) => {
    const [x, y] = key.split(",").map(Number) as [number, number];
    return landmark.grid.tiles[y]?.[x] === "wall";
  }),
  true,
  "protected landmark tiles must survive connectivity repair",
);

assert.equal(
  validateTacticalBattlefieldBrief({
    features: Array.from({ length: 5 }, () => ({ terrain: "wall", placement: "center", shape: "barrier" })),
  }).ok,
  false,
  "briefs must cap landmark count",
);
assert.equal(
  validateTacticalBattlefieldBrief({ features: [{ terrain: "forest", placement: "center", shape: "barrier" }] }).ok,
  false,
  "barriers must be impassable landmark terrain",
);
assert.equal(
  validateTacticalBattlefieldBrief({ size: "toString" }).ok,
  false,
  "prototype property names must not be accepted as battlefield sizes",
);
assert.equal(
  validateTacticalBattlefieldBrief({ features: [{ terrain: "__proto__", placement: "center", shape: "patch" }] }).ok,
  false,
  "prototype property names must not be accepted as battlefield terrain",
);
assert.deepEqual(
  validateTacticalBattlefieldBrief({
    features: [{ terrain: "forest", placement: "north", shape: "patch", ignoredByTheContract: true }],
  }),
  { ok: true, brief: { features: [{ terrain: "forest", placement: "north", shape: "patch" }] } },
  "valid briefs must retain only bounded battlefield fields",
);
assert.equal(
  generateTacticalBattlefield(2, deterministicRng(13, 0), "plains", {
    features: [
      { terrain: "forest", placement: "center", shape: "patch" },
      { terrain: "wall", placement: "center", shape: "barrier" },
    ],
  }).ok,
  false,
  "overlapping features with conflicting terrain must be rejected",
);

const centerBarrierOptions = {
  seed: 41,
  difficulty: "normal",
  battlefield: { features: [{ terrain: "wall" as const, placement: "center" as const, shape: "barrier" as const }] },
};
const centerBarrier = createTacticalCombat(
  [combatant("barrier-party")],
  [combatant("enemy-barrier")],
  centerBarrierOptions,
);
assert.deepEqual(
  [centerBarrier.grid.tiles[4]?.[5], centerBarrier.grid.tiles[4]?.[6], centerBarrier.grid.tiles[4]?.[7]],
  ["wall", "wall", "wall"],
  "a center barrier must survive deployment connectivity repair",
);
assert.deepEqual(
  createTacticalCombat([combatant("barrier-party")], [combatant("enemy-barrier")], centerBarrierOptions),
  centerBarrier,
  "a fixed seed and brief must reproduce terrain and deployment together",
);
assert.match(
  buildTacticalSummary(centerBarrier).battlefieldSummary ?? "",
  /Accepted features: wall center barrier/,
  "the final combat summary must retain its accepted terrain context",
);
assert.match(
  summarizeTacticalBattlefield(centerBarrier) ?? "",
  /Resolved terrain:/,
  "a complete generated grid must produce terrain context",
);

const wrongGridDimensions = structuredClone(centerBarrier);
wrongGridDimensions.grid.width--;
assert.equal(
  summarizeTacticalBattlefield(wrongGridDimensions),
  undefined,
  "saved terrain context must reject dimensions that do not match its generated board size",
);

const incompleteGridRow = structuredClone(centerBarrier);
incompleteGridRow.grid.tiles[0]!.pop();
assert.equal(
  summarizeTacticalBattlefield(incompleteGridRow),
  undefined,
  "saved terrain context must reject incomplete grid rows",
);

const unknownTerrain = structuredClone(centerBarrier);
unknownTerrain.grid.tiles[0]![0] = "unknown-terrain" as never;
assert.equal(
  summarizeTacticalBattlefield(unknownTerrain),
  undefined,
  "saved terrain context must reject unknown terrain cells",
);
for (const formation of ["line", "ambush", "surrounded", "skirmish", "defense"] as const) {
  const state = createTacticalCombat(
    Array.from({ length: 3 }, (_, index) => combatant(`${formation}-party-${index}`)),
    Array.from({ length: 3 }, (_, index) => combatant(`enemy-${formation}-${index}`)),
    { ...centerBarrierOptions, formation },
  );
  const centerX = Math.floor(state.grid.width / 2);
  const centerY = Math.floor(state.grid.height / 2);
  assert.deepEqual(
    [
      state.grid.tiles[centerY]?.[centerX - 1],
      state.grid.tiles[centerY]?.[centerX],
      state.grid.tiles[centerY]?.[centerX + 1],
    ],
    ["wall", "wall", "wall"],
    `${formation} deployment must preserve a center barrier`,
  );
  const deployed = state.units.map((unit) => `${unit.x},${unit.y}`);
  assert.equal(new Set(deployed).size, state.units.length, `${formation} deployment must use unique tiles`);
  assert.equal(
    state.units.every((unit) => !["wall", "water", "mountain"].includes(state.grid.tiles[unit.y]?.[unit.x] ?? "wall")),
    true,
    `${formation} deployment must use passable tiles`,
  );
}

const movementState = createTacticalCombat([combatant("walker")], [], { seed: 1, difficulty: "normal" });
movementState.grid = {
  width: 5,
  height: 1,
  tiles: [["plains", "forest", "wall", "water", "mountain"]],
};
movementState.units[0]!.x = 0;
movementState.units[0]!.y = 0;
movementState.units[0]!.movement = 4;

assert.deepEqual(
  getMovementRange(movementState, "walker"),
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  "walkers must still pay forest cost and stop at impassable terrain",
);

movementState.units[0]!.movementMode = "fly";
assert.deepEqual(
  getMovementRange(movementState, "walker"),
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
  ],
  "flying units must cross and hover on every unoccupied terrain type at flat range cost",
);

movementState.units[0]!.movementMode = "teleport";
assert.deepEqual(
  getMovementRange(movementState, "walker"),
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  "teleporters must cross terrain but may only end on walkable, unoccupied tiles",
);

movementState.units[0]!.movementMode = "legacy-invalid" as NonNullable<Combatant["movementMode"]>;
assert.deepEqual(
  getMovementRange(movementState, "walker"),
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  "malformed legacy movement modes must retain walk-only rules",
);

function actionState(movementMode: NonNullable<Combatant["movementMode"]>) {
  const state = createTacticalCombat([combatant(`${movementMode}-mover`, movementMode)], [combatant("enemy-blocker")], {
    seed: 4,
    difficulty: "normal",
  });
  state.grid = {
    width: 4,
    height: 1,
    tiles: [["plains", "plains", "wall", "plains"]],
  };
  const mover = state.units.find((unit) => unit.id === `${movementMode}-mover`)!;
  const blocker = state.units.find((unit) => unit.id === "enemy-blocker")!;
  mover.x = 0;
  mover.y = 0;
  mover.movement = 4;
  blocker.x = 1;
  blocker.y = 0;
  return state;
}

const flight = actionState("fly");
const flightMove = applyAction(flight, { type: "move", unitId: "fly-mover", to: { x: 3, y: 0 } });
assert.equal(flightMove.ok, true, "flying units must move across occupied and impassable intervening tiles");
if (!flightMove.ok) throw new Error(flightMove.error);
assert.deepEqual(
  [
    flightMove.state.units.find((unit) => unit.id === "fly-mover")!.x,
    flightMove.state.units.find((unit) => unit.id === "fly-mover")!.y,
  ],
  [3, 0],
  "flight must end directly on the requested legal tile",
);
assert.equal(
  applyAction(flight, { type: "move", unitId: "fly-mover", to: { x: 1, y: 0 } }).ok,
  false,
  "flying units must not end on an occupied tile",
);

const teleport = actionState("teleport");
const teleportMove = applyAction(teleport, { type: "move", unitId: "teleport-mover", to: { x: 3, y: 0 } });
assert.equal(teleportMove.ok, true, "teleporters must cross occupied and impassable intervening tiles");
if (!teleportMove.ok) throw new Error(teleportMove.error);
assert.deepEqual(
  [
    teleportMove.state.units.find((unit) => unit.id === "teleport-mover")!.x,
    teleportMove.state.units.find((unit) => unit.id === "teleport-mover")!.y,
  ],
  [3, 0],
  "teleportation must end directly on the requested legal tile",
);
assert.equal(
  applyAction(teleport, { type: "move", unitId: "teleport-mover", to: { x: 1, y: 0 } }).ok,
  false,
  "teleporters must not end on an occupied tile",
);
assert.equal(
  applyAction(teleport, { type: "move", unitId: "teleport-mover", to: { x: 2, y: 0 } }).ok,
  false,
  "teleporters must not end inside impassable terrain",
);

const forestForecast = createTacticalCombat([combatant("attacker")], [combatant("enemy-defender")], {
  seed: 5,
  difficulty: "normal",
});
forestForecast.grid = { width: 2, height: 1, tiles: [["plains", "forest"]] };
forestForecast.units.find((unit) => unit.id === "attacker")!.x = 0;
forestForecast.units.find((unit) => unit.id === "attacker")!.y = 0;
forestForecast.units.find((unit) => unit.id === "enemy-defender")!.x = 1;
forestForecast.units.find((unit) => unit.id === "enemy-defender")!.y = 0;
for (const movementMode of ["walk", "fly", "teleport"] as const) {
  forestForecast.units.find((unit) => unit.id === "enemy-defender")!.movementMode = movementMode;
  const forecast = forecastAttack(forestForecast, "attacker", "enemy-defender");
  assert.deepEqual(
    { damage: forecast.damage, hitChance: forecast.hitChance },
    { damage: 3, hitChance: 65 },
    `forest defense and evasion bonuses must still apply to ${movementMode}`,
  );
}

console.log("Hybrid terrain regression passed");
