/**
 * Flying height (Capability API 1.114).
 *
 *   - On a board whose ruleset gives `combat.elevation.levelHeight`, a flier is offered Fly up and
 *     Fly down where it stands, each a level's worth of its flight. Nobody else is, and nobody is
 *     without levels.
 *   - Up in the air it only flies, and only over ground no higher than it is; flying or walking onto
 *     ground as high as it is lands it.
 *   - The distance between two combatants counts the height between them when one is up: reach is
 *     refused against a flier too high, and its own bite cannot reach down either.
 *   - It has the high ground over anybody lower, and leaving the reach of somebody it is too high for
 *     draws no strike.
 *   - Downed up in the air it falls as `falling` says, unless it hovers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  RULESET_FLY_DOWN_OPTION,
  RULESET_FLY_UP_OPTION,
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatantDistance,
  rulesetCombatOptions,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  rulesetTargetRefusal,
  type RulesetCombatantInput,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../../../packages/shared/src/index.js";
import { rulesetThreateningEnemies } from "../../../../packages/shared/src/features/ruleset-combat/grid.js";
import { rulesetAbove } from "../../../../packages/shared/src/features/ruleset-combat/options.js";

const fiveEText = readFileSync(
  fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
  "utf8",
);
const parsed = (edit: (doc: Record<string, any>) => void): RulesetDefinition => {
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
// A level is five feet, a cell is five feet: one cell of flight a level.
const definition = parsed((doc) => {
  doc.combat.elevation = {
    levelHeight: 5,
    falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning", prone: "prone" },
  };
});
const flat = parsed(() => {});

const drawn = (width: number, heights?: string): TacticalGrid => ({
  width,
  height: 1,
  tiles: [Array.from({ length: width }, () => "plains" as const)],
  ...(heights ? { elevation: [[...heights].map(Number)] } : {}),
});
/** Speeds in feet: six cells is 30. */
const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
  health: 20,
  defense: 12,
  initiativeModifier: 20,
  speed: 30,
  actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 3, damage: { count: 1, sides: 6, flat: 0 } }],
  ...extra,
});
const weapon = (name: string, range: number) => ({
  name,
  ability: "str",
  proficient: true,
  bonus: 0,
  damage: "1d6",
  damage_type: "piercing",
  reach: 5,
  range,
  long_range: range * 4,
});
/** The flier first, then Brenna on the other side, with a longsword and javelins to throw at it. */
const fight = (
  grid: TacticalGrid,
  extra: Partial<RulesetStatBlock> = {},
  brennaAt = 1,
  ruleset = definition,
): RulesetEncounterState =>
  createRulesetEncounter({
    definition: ruleset,
    seed: 1,
    roller: () => 18,
    combatants: [
      { id: "flier", name: "Flier", side: "enemy", block: block(extra) } as RulesetCombatantInput,
      {
        id: "brenna",
        name: "Brenna",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
          lists: { attacks: [weapon("Longsword", 0), weapon("Javelin", 30)] },
        }),
        live: {},
        catalogs: {},
      } as RulesetCombatantInput,
    ],
    board: { grid, placements: { flier: { x: 0, y: 0 }, brenna: { x: brennaAt, y: 0 } } },
  });
const optionNamed = (state: RulesetEncounterState, actorId: string, label: string) => {
  const option = rulesetCombatOptions(definition, state, actorId).find((entry) => entry.label === label);
  assert.ok(option, `no ${label} for ${actorId}`);
  return option.id;
};
const act = (
  state: RulesetEncounterState,
  choice: Omit<RulesetCombatChoice, "targetIds"> & { targetIds?: string[] },
) => {
  const step = applyRulesetCombatChoice(
    definition,
    state,
    { targetIds: [], ...choice } as RulesetCombatChoice,
    () => 18,
  );
  const refused = step.events.find((event) => event.type === "refused");
  assert.equal(refused, undefined, JSON.stringify(refused));
  return step;
};
const flyUp = (state: RulesetEncounterState, times = 1) => {
  for (let i = 0; i < times; i += 1) state = act(state, { actorId: "flier", optionId: RULESET_FLY_UP_OPTION }).state;
  return state;
};
const ids = (state: RulesetEncounterState, actorId = "flier", ruleset = definition) =>
  rulesetCombatOptions(ruleset, state, actorId).map((option) => option.id);
const flier = (state: RulesetEncounterState) => rulesetCombatant(state, "flier")!;

// ── What is offered ──
{
  const grounded = fight(drawn(8), { speeds: { fly: 30 } });
  assert.equal(grounded.board?.levelCells, 1, "a five-foot level on five-foot cells");
  assert.ok(ids(grounded).includes(RULESET_FLY_UP_OPTION), "a flier may go up");
  assert.ok(!ids(grounded).includes(RULESET_FLY_DOWN_OPTION), "and is already down");
  assert.ok(!ids(fight(drawn(8))).includes(RULESET_FLY_UP_OPTION), "somebody who only walks may not");
  assert.ok(
    !ids(fight(drawn(8), { speeds: { fly: 30 } }, 1, flat), "flier", flat).includes(RULESET_FLY_UP_OPTION),
    "a ruleset without levels has no height to fly to",
  );
}

// ── Up and down ──
{
  const state = fight(drawn(8), { speeds: { fly: 30 } });
  const up = act(state, { actorId: "flier", optionId: RULESET_FLY_UP_OPTION });
  const flew = up.events.find((event) => event.type === "flew") as Extract<RulesetCombatEvent, { type: "flew" }>;
  assert.deepEqual(
    { from: flew?.from, to: flew?.to, cost: flew?.cost, left: flew?.left },
    { from: 0, to: 1, cost: 1, left: 5 },
  );
  assert.equal(flier(up.state).altitude, 1);
  assert.deepEqual(flier(up.state).modeLeft, { walk: 5, fly: 5 }, "a level comes off every way, as a cell does");
  const higher = flyUp(up.state);
  assert.equal(flier(higher).altitude, 2);
  assert.ok(ids(higher).includes(RULESET_FLY_DOWN_OPTION));
  const down = act(act(higher, { actorId: "flier", optionId: RULESET_FLY_DOWN_OPTION }).state, {
    actorId: "flier",
    optionId: RULESET_FLY_DOWN_OPTION,
  });
  assert.equal(flier(down.state).altitude, undefined, "back on the ground");
  assert.equal(flier(down.state).movementLeft, 2);
  // Nothing left of the flight, nothing offered.
  const spent = flyUp(fight(drawn(8), { speeds: { fly: 10 } }), 2);
  assert.ok(!ids(spent).includes(RULESET_FLY_UP_OPTION) && !ids(spent).includes(RULESET_FLY_DOWN_OPTION));
}

// ── Up in the air it only flies ──
{
  // Walk 30, fly 10: up a level costs one cell of the two it flies, and then the one that is left
  // is all it can go, however much walk it has.
  const state = flyUp(fight(drawn(8), { speeds: { fly: 10 } }));
  const cells = rulesetReachableCells(definition, state, "flier").map((cell) => `${cell.x},${cell.y}`);
  assert.deepEqual(cells, [], "Brenna is in the only cell a single flown step reaches");
  const open = flyUp(fight(drawn(8), { speeds: { fly: 10 } }, 7));
  assert.deepEqual(
    rulesetReachableCells(definition, open, "flier").map((cell) => `${cell.x},${cell.y}:${cell.cost}`),
    ["1,0:1"],
    "one cell, flown",
  );
  // Onto ground as high as it is, or higher, it lands; past it, it flies on as from the ground.
  const ridge = flyUp(fight(drawn(8, "01200000"), { speeds: { fly: 60 } }, 7));
  const over = new Map(rulesetReachableCells(definition, ridge, "flier").map((cell) => [cell.x, cell.cost]));
  assert.equal(over.get(1), 1, "level ground at its height, a cell");
  assert.equal(over.get(3), 3, "and on over the ridge, a cell a step");
  for (const [x, landsAt] of [
    [1, 1],
    [2, 2],
  ] as const) {
    const landed = act(ridge, { actorId: "flier", optionId: RULESET_MOVE_OPTION, to: { x, y: 0 } });
    assert.equal(flier(landed.state).altitude, undefined, `flown onto ground of height ${landsAt}: landed`);
    assert.equal((landed.events.find((event) => event.type === "move") as { cost: number }).cost, x);
  }
  // Flown past the ridge to low ground, it is on the ground there too: the ridge brought it down.
  const past = act(ridge, { actorId: "flier", optionId: RULESET_MOVE_OPTION, to: { x: 3, y: 0 } });
  assert.equal(flier(past.state).altitude, undefined);
  // Up three, it stays up over all of it.
  const high = act(flyUp(fight(drawn(8, "01200000"), { speeds: { fly: 60 } }, 7), 3), {
    actorId: "flier",
    optionId: RULESET_MOVE_OPTION,
    to: { x: 3, y: 0 },
  });
  assert.equal(flier(high.state).altitude, 3, "flown over at height 3");
}

// ── Reach counts the height ──
{
  const state = fight(drawn(8), { speeds: { fly: 30 } });
  assert.equal(rulesetCombatantDistance(state, flier(state), rulesetCombatant(state, "brenna")!), 1);
  const one = flyUp(state);
  assert.equal(rulesetTargetRefusal(one, "flier", "bite", "brenna"), null, "a level up, the bite still reaches");
  const two = flyUp(one);
  assert.equal(rulesetCombatantDistance(two, flier(two), rulesetCombatant(two, "brenna")!), 2);
  assert.equal(rulesetTargetRefusal(two, "flier", "bite", "brenna"), "out-of-reach", "too high to bite down");
  // On Brenna's turn, the flier still two levels up.
  const hers = act(two, { actorId: "flier", optionId: "end-turn" }).state;
  const sword = optionNamed(hers, "brenna", "Longsword");
  assert.equal(rulesetTargetRefusal(hers, "brenna", sword, "flier"), "out-of-reach", "or to be stabbed");
  assert.equal(
    rulesetTargetRefusal(hers, "brenna", optionNamed(hers, "brenna", "Javelin"), "flier"),
    null,
    "but not to be shot",
  );
  // High ground: a flier is as high as it flies.
  assert.ok(!rulesetAbove(state, flier(state), rulesetCombatant(state, "brenna")!), "level, on the ground");
  assert.ok(rulesetAbove(one, flier(one), rulesetCombatant(one, "brenna")!), "above, a level up");
  assert.ok(!rulesetAbove(one, rulesetCombatant(one, "brenna")!, flier(one)));
}

// ── No strike from below at somebody too high ──
{
  const combat = definition.combat!;
  const ground = fight(drawn(8), { speeds: { fly: 30 } });
  const threats = (state: RulesetEncounterState) =>
    rulesetThreateningEnemies(definition, combat, state, rulesetCombatant(state, "brenna")!).map(
      (threat) => threat.combatant.id,
    );
  assert.deepEqual(threats(ground), ["flier"], "on the ground the flier's bite threatens Brenna");
  assert.deepEqual(threats(flyUp(ground)), ["flier"], "a level up it still does");
  assert.deepEqual(threats(flyUp(ground, 2)), [], "two levels up it does not");
}

// ── Downed up in the air ──
{
  const shotDown = (extra: Partial<RulesetStatBlock>) => {
    let state = flyUp(fight(drawn(8), { health: 1, speeds: { fly: 60 }, ...extra }, 4), 4);
    state = act(state, { actorId: "flier", optionId: "end-turn" }).state;
    return act(state, { actorId: "brenna", optionId: optionNamed(state, "brenna", "Javelin"), targetIds: ["flier"] });
  };
  const fell = shotDown({});
  const fall = fell.events.find((event) => event.type === "fell") as Extract<RulesetCombatEvent, { type: "fell" }>;
  assert.deepEqual(fall, { type: "fell", targetId: "flier", levels: 4 }, "four levels down");
  assert.equal(flier(fell.state).altitude, undefined, "and on the ground");
  // Twenty feet is two of the ruleset's tens: the fall throws two dice.
  const blows = fell.events.filter((event) => event.type === "damage" && event.label === "fall") as Array<
    Extract<RulesetCombatEvent, { type: "damage" }>
  >;
  assert.equal(blows.length, 1, JSON.stringify(fell.events));
  assert.equal(blows[0]!.rolls.length, 2);
  const hovering = shotDown({ hover: true });
  assert.ok(!hovering.events.some((event) => event.type === "fell"), "a hoverer stays up");
  assert.equal(flier(hovering.state).altitude, 4);
}

console.log("Flying height: fliers go up and down, reach and strikes count the height, and the downed fall.");
