/**
 * In the air (Capability API 1.354).
 *
 *   - A flier with no walk, or that hovers, starts in the air; one that walks starts on the ground.
 *   - A flier on the ground is offered Take off, one in the air with a walk Land, both free. Nobody
 *     else is offered either.
 *   - A step only its flight takes, or flying up, puts it in the air; knocked prone it comes down.
 *   - A fighter in the air is shown in its flying art.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  RULESET_FLY_UP_OPTION,
  RULESET_LAND_OPTION,
  RULESET_MOVE_OPTION,
  RULESET_TAKE_OFF_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatantFlying,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCombatantInput,
  type RulesetCombatChoice,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const fiveEText = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
const options = (state: RulesetEncounterState) => rulesetCombatOptions(definition, state, "flier").map((o) => o.id);
const flier = (state: RulesetEncounterState) => rulesetCombatant(state, "flier")!;
const shown = (state: RulesetEncounterState) => rulesetCombatantFlying(state.board?.grid, flier(state));

// ── How it starts ──
{
  const walker = fight(drawn(4), { speeds: { fly: 60 } });
  assert.equal(flier(walker).airborne, undefined, "a flier that walks starts on the ground");
  assert.equal(shown(walker), false);
  assert.ok(options(walker).includes(RULESET_TAKE_OFF_OPTION));
  assert.ok(!options(walker).includes(RULESET_LAND_OPTION));
  const onlyFlies = fight(drawn(4), { speed: 0, speeds: { fly: 60 } });
  assert.equal(flier(onlyFlies).airborne, true, "no walk: in the air");
  assert.ok(!options(onlyFlies).includes(RULESET_LAND_OPTION), "nothing to land on");
  assert.equal(shown(onlyFlies), true);
  const hovers = fight(drawn(4), { speeds: { fly: 60 }, hover: true });
  assert.equal(flier(hovers).airborne, true, "a hoverer starts in the air");
  assert.ok(options(hovers).includes(RULESET_LAND_OPTION), "and may land, having a walk");
  const ground = fight(drawn(4));
  assert.ok(!options(ground).some((id) => id === RULESET_TAKE_OFF_OPTION || id === RULESET_LAND_OPTION));
}

// ── Take off and land, for nothing ──
{
  let state = fight(drawn(4), { speeds: { fly: 60 } });
  const before = flier(state).movementLeft;
  let step = act(state, { actorId: "flier", optionId: RULESET_TAKE_OFF_OPTION });
  state = step.state;
  assert.equal(flier(state).airborne, true);
  assert.equal(flier(state).movementLeft, before, "taking off is free");
  assert.ok(step.events.some((event) => event.type === "lift" && event.up));
  assert.equal(shown(state), true);
  assert.ok(options(state).includes(RULESET_LAND_OPTION));
  step = act(state, { actorId: "flier", optionId: RULESET_LAND_OPTION });
  state = step.state;
  assert.equal(flier(state).airborne, undefined);
  assert.ok(step.events.some((event) => event.type === "lift" && !event.up));
  assert.equal(shown(state), false);
}

// ── A step only its flight takes ──
{
  const water: TacticalGrid = { width: 4, height: 1, tiles: [["plains", "water", "plains", "plains"]] };
  let state = fight(water, { speeds: { fly: 60 } }, 3);
  state = act(state, { actorId: "flier", optionId: RULESET_MOVE_OPTION, to: { x: 2, y: 0 } }).state;
  assert.equal(flier(state).x, 2);
  assert.equal(flier(state).airborne, true, "over the water on its wings");
  const dry = act(fight(drawn(4), { speeds: { fly: 60 } }, 3), {
    actorId: "flier",
    optionId: RULESET_MOVE_OPTION,
    to: { x: 2, y: 0 },
  }).state;
  assert.equal(flier(dry).airborne, undefined, "walked");
  // Flying up a level puts it in the air too.
  const up = act(fight(drawn(4), { speeds: { fly: 60 } }), { actorId: "flier", optionId: RULESET_FLY_UP_OPTION }).state;
  assert.equal(flier(up).airborne, true);
}

console.log("In the air: fliers start, take off and land as they fly, shown flying while up.");
