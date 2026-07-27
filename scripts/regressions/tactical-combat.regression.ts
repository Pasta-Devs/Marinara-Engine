import assert from "node:assert/strict";
import {
  applyAction,
  forecastAttack,
  forecastSkill,
  getTargetsInRange,
  hasLineOfSight,
  runEnemyPhase,
  type CombatSkill,
  type TacticalCombatState,
  type TacticalUnit,
} from "../../packages/shared/src/index.js";

function unit(
  id: string,
  side: "party" | "enemy",
  x: number,
  y: number,
  attackRange: { min: number; max: number },
  skills: CombatSkill[] = [],
): TacticalUnit {
  return {
    id,
    name: id,
    side,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
    attack: 10,
    defense: 5,
    speed: 10,
    level: 1,
    skills,
    statusEffects: [],
    x,
    y,
    unitClass: attackRange.min > 1 ? "archer" : "fighter",
    movement: 3,
    attackRange,
    hasMoved: false,
    hasActed: false,
    defending: false,
    skillCooldowns: {},
  };
}

function state(
  units: TacticalUnit[],
  tiles: TacticalCombatState["grid"]["tiles"],
  phase: TacticalCombatState["phase"] = "player",
): TacticalCombatState {
  return {
    schemaVersion: 1,
    grid: { width: tiles[0]?.length ?? 0, height: tiles.length, tiles },
    units,
    phase,
    round: 1,
    seed: 123,
    actionCounter: 1,
    log: [],
    difficulty: "normal",
    inventory: [],
    itemEffects: [],
    hazards: [],
  };
}

const blockedSkill: CombatSkill = {
  id: "piercing-shot",
  name: "Piercing Shot",
  type: "attack",
  mpCost: 2,
  power: 1.2,
  description: "A ranged strike.",
};
const blocked = state(
  [unit("party", "party", 0, 0, { min: 1, max: 1 }), unit("enemy", "enemy", 4, 0, { min: 2, max: 4 }, [blockedSkill])],
  [["plains", "plains", "wall", "plains", "plains"]],
  "enemy",
);
assert.equal(hasLineOfSight(blocked.grid, blocked.units[1]!, blocked.units[0]!), false);
assert.deepEqual(getTargetsInRange(blocked, "enemy"), []);
assert.deepEqual(forecastAttack(blocked, "enemy", "party"), {
  damage: 0,
  hitChance: 0,
  critChance: 0,
  hits: 0,
});
assert.deepEqual(forecastSkill(blocked, "enemy", "party", blockedSkill.name), {
  damage: 0,
  hitChance: 0,
  critChance: 0,
  hits: 0,
});
const blockedEnemyPhase = runEnemyPhase(blocked);
assert.equal(blockedEnemyPhase.state.units.find((entry) => entry.id === "party")?.hp, 100);
assert.equal(
  blockedEnemyPhase.events.some((event) => event.kind === "damage"),
  false,
);

const archerReaction = state(
  [unit("party", "party", 1, 0, { min: 1, max: 1 }), unit("archer", "enemy", 2, 0, { min: 2, max: 4 })],
  [["plains", "plains", "plains", "plains"]],
);
const movedPastArcher = applyAction(archerReaction, { type: "move", unitId: "party", to: { x: 0, y: 0 } });
assert.equal(movedPastArcher.ok, true);
if (movedPastArcher.ok) {
  assert.equal(
    movedPastArcher.events.some((event) => event.kind === "counter"),
    false,
  );
  assert.equal(movedPastArcher.state.units.find((entry) => entry.id === "party")?.hp, 100);
}

const enemyOverwatch = state(
  [unit("party", "party", 0, 1, { min: 1, max: 1 }), unit("enemy", "enemy", 4, 1, { min: 2, max: 2 })],
  [
    ["plains", "plains", "plains", "plains", "wall"],
    ["plains", "plains", "plains", "water", "plains"],
    ["plains", "plains", "plains", "plains", "wall"],
  ],
  "enemy",
);
const armedEnemyPhase = runEnemyPhase(enemyOverwatch);
assert.equal(
  armedEnemyPhase.state.units
    .find((entry) => entry.id === "enemy")
    ?.statusEffects.some((effect) => effect.name === "Overwatch" && effect.turnsLeft === 1),
  true,
);
const enteredEnemyOverwatch = applyAction(armedEnemyPhase.state, {
  type: "move",
  unitId: "party",
  to: { x: 2, y: 1 },
});
assert.equal(enteredEnemyOverwatch.ok, true);
if (enteredEnemyOverwatch.ok) {
  assert.equal(
    enteredEnemyOverwatch.events.some((event) => event.kind === "counter"),
    true,
  );
  assert.equal(
    enteredEnemyOverwatch.state.units
      .find((entry) => entry.id === "enemy")
      ?.statusEffects.some((effect) => effect.name === "Overwatch"),
    false,
  );
}

const playerOverwatch = state(
  [unit("party", "party", 0, 0, { min: 1, max: 4 }), unit("enemy", "enemy", 4, 0, { min: 99, max: 99 })],
  [["plains", "plains", "plains", "plains", "plains"]],
);
const armedPlayer = applyAction(playerOverwatch, { type: "overwatch", unitId: "party" });
assert.equal(armedPlayer.ok, true);
if (armedPlayer.ok) {
  const status = armedPlayer.state.units
    .find((entry) => entry.id === "party")
    ?.statusEffects.find((effect) => effect.name === "Overwatch");
  assert.equal(status?.turnsLeft, 1);
  const playerCoverage = runEnemyPhase(armedPlayer.state);
  assert.equal(
    playerCoverage.events.some((event) => event.kind === "counter"),
    true,
  );
  assert.equal(playerCoverage.state.units.find((entry) => entry.id === "enemy")?.hp < 100, true);
}

process.stdout.write("Tactical combat regression passed.\n");
