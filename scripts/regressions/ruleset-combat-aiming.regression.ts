/**
 * Aiming a shape on the board, as the 5e playtest asked (aoe-spells F1, F4, F5, F6, F7, F8).
 *
 *   - A one-cell line runs at any angle it is aimed, not only the eight ways a grid runs.
 *   - A sphere is not centred inside solid rock; a lasting sphere held on its caster is aimed only
 *     where they stand, and the menu sends it there without a placing step.
 *   - The board draws the template of the shape under the pointer, and names who of the caster's
 *     own side it catches.
 *   - Sculpt Spells is offered only for a shape some aim of which catches an ally, and costs nothing.
 *   - A higher payment's button says what it adds.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetAimLegal,
  rulesetAreaCells,
  rulesetCombatOptions,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type RulesetDefinition,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";
import {
  rulesetAimCatchesAllies,
  rulesetAimTemplate,
  rulesetCellKey,
  rulesetSelfAim,
  rulesetUsefulAlters,
} from "../../packages/client/src/lib/ruleset-combat-board.js";
import { rulesetPayGainText } from "../../packages/client/src/lib/ruleset-combat-menu.js";

const t = ((key: string, params: Record<string, unknown> = {}) =>
  `${key}${Object.keys(params).length ? JSON.stringify(params) : ""}`) as never;

const flat = (width: number, height: number): TacticalGrid => ({
  width,
  height,
  tiles: Array.from({ length: height }, () => Array(width).fill("plains")),
});

// ── Lines at any angle ──
{
  const grid = flat(12, 12);
  const line = rulesetAreaCells("line", 4, { x: 0, y: 0 }, { x: 4, y: 2 }, grid);
  assert.deepEqual(
    line,
    [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
    "toward (4,2): one cell out each step, nearest the straight run",
  );
  assert.deepEqual(
    rulesetAreaCells("line", 3, { x: 5, y: 5 }, { x: 5, y: 1 }, grid),
    [
      { x: 5, y: 4 },
      { x: 5, y: 3 },
      { x: 5, y: 2 },
    ],
    "along an axis, as before",
  );
  const left = rulesetAreaCells("line", 4, { x: 6, y: 6 }, { x: 2, y: 4 }, grid);
  const right = rulesetAreaCells("line", 4, { x: 6, y: 6 }, { x: 10, y: 4 }, grid);
  assert.deepEqual(
    left.map((cell) => ({ x: 12 - cell.x, y: cell.y })),
    right,
    "a line aimed left is the mirror of one aimed right",
  );
}

// ── Where a shape may be aimed ──
const definition = ((): RulesetDefinition => {
  const parsed = parseRulesetDefinition(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
        "utf8",
      ),
    ),
  );
  assert.ok(parsed.ok);
  return parsed.definition;
})();
const block = (actions: unknown[]): RulesetStatBlock =>
  ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    actions,
  }) as unknown as RulesetStatBlock;
{
  const grid = flat(10, 10);
  grid.tiles[3]![6] = "mountain";
  const encounter = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "mage",
        name: "Mage",
        side: "party",
        block: block([
          {
            id: "ball",
            name: "Ball",
            budget: "action",
            range: { normal: 60 },
            area: { shape: "burst", size: 10 },
            save: { ability: "dex", difficulty: 13 },
            damage: { count: 2, sides: 6, flat: 0 },
          },
          {
            id: "guardians",
            name: "Guardians",
            budget: "action",
            range: { normal: 5 },
            area: { shape: "burst", size: 10 },
            zone: { rounds: 10, anchor: "caster", triggers: [] },
          },
        ]),
      },
      { id: "orc", name: "Orc", side: "enemy", block: block([]) },
    ],
    board: { grid, placements: { mage: { x: 2, y: 3 }, orc: { x: 8, y: 3 } } } as never,
  });
  assert.equal(rulesetAimLegal(encounter, "mage", "ball", { x: 6, y: 3 }), false, "not inside the rock");
  assert.equal(rulesetAimLegal(encounter, "mage", "ball", { x: 6, y: 4 }), true, "beside it is fine");
  assert.equal(rulesetAimLegal(encounter, "mage", "guardians", { x: 3, y: 3 }), false, "held on its caster");
  assert.equal(rulesetAimLegal(encounter, "mage", "guardians", { x: 2, y: 3 }), true, "only where they stand");
  const guardians = rulesetCombatOptions(definition, encounter, "mage").find((one) => one.id === "guardians");
  assert.ok(guardians?.area, "it is a shape on the board");
  // A zone with nothing that happens to those inside it is a ward; a fireball is not.
  assert.equal(guardians?.harmless, true, "a ward harms nobody it catches");
  const ball = rulesetCombatOptions(definition, encounter, "mage").find((one) => one.id === "ball");
  assert.equal(ball?.harmless, undefined, "a fireball is no ward");
}

// ── The board's template, its allies, and the self-centred aim ──
const view = {
  actorId: "mage",
  combatants: [
    { id: "mage", name: "Mage", side: "party", x: 2, y: 2 },
    { id: "ada", name: "Ada", side: "party", x: 6, y: 2 },
    { id: "orc", name: "Orc", side: "enemy", x: 7, y: 2 },
  ],
  grid: { ...flat(10, 10), distance: { label: "ft", perCell: 5 } },
} as unknown as DirectedRulesetView;
const ball = {
  id: "ball",
  area: { shape: "burst", size: 1, range: 12 },
  aim: [
    { x: 7, y: 2, targetIds: ["ada", "orc"] },
    { x: 8, y: 2, targetIds: ["orc"] },
  ],
  targets: { count: 0, side: "enemy" },
} as unknown as DirectedRulesetOption;
{
  const step = { stage: "aim", option: ball, targets: [] } as never;
  const template = rulesetAimTemplate(view, step, { x: 7, y: 2 }).map(rulesetCellKey).sort();
  assert.deepEqual(
    template,
    ["6,1", "6,2", "6,3", "7,1", "7,2", "7,3", "8,1", "8,2", "8,3"],
    "a sphere of one cell drawn around where it is aimed",
  );
  assert.deepEqual(rulesetAimTemplate(view, null, { x: 7, y: 2 }), [], "nothing aimed, nothing drawn");
  assert.deepEqual(rulesetAimCatchesAllies(view, ["ada", "orc"]), ["ada"], "Ada is the caster's own");
  assert.deepEqual(rulesetAimCatchesAllies(view, ["orc"]), []);
  // A ward that does nothing to those it catches (Magic Circle) warns about nobody (re-test 9).
  assert.deepEqual(rulesetAimCatchesAllies(view, ["ada", "orc"], { harmless: true } as never), []);
  assert.equal(rulesetSelfAim(view, ball), null, "a choice of where");
  const guardians = {
    ...ball,
    id: "guardians",
    aim: [{ x: 2, y: 2, targetIds: [] }],
  } as unknown as DirectedRulesetOption;
  assert.deepEqual(rulesetSelfAim(view, guardians), { x: 2, y: 2 }, "only its caster's square: sent there");
}

// ── Sculpt Spells only where an ally could be caught ──
{
  const sculpt = { id: "sculpt", label: "Sculpt Spells", cost: 0, spares: 2 };
  const quicken = { id: "quicken", label: "Quickened", cost: 2 };
  const withAlters = (aim: unknown) =>
    ({ ...ball, aim, alters: [sculpt, quicken] }) as unknown as DirectedRulesetOption;
  assert.deepEqual(
    rulesetUsefulAlters(view, withAlters(ball.aim)).map((one) => one.id),
    ["sculpt", "quicken"],
    "Ada could be caught",
  );
  assert.deepEqual(
    rulesetUsefulAlters(view, withAlters([{ x: 8, y: 2, targetIds: ["orc"] }])).map((one) => one.id),
    ["quicken"],
    "no aim catches anybody of the caster's side",
  );
}

// ── What a higher payment adds ──
{
  const option = {
    ...ball,
    targets: { count: 1, side: "enemy" },
    targetsWith: { slots_4: 2 },
    payGains: { slots_4: { amount: { count: 1, sides: 6, flat: 0 } }, slots_5: { size: 2 } },
  } as unknown as DirectedRulesetOption;
  const distance = { label: "ft", perCell: 5 };
  const fourth = rulesetPayGainText(option, "slots_4", t, distance);
  assert.match(fourth, /gainDamage\{"dice":"1d6"\}/);
  assert.match(fourth, /gainTargets\{"count":2\}/);
  assert.match(rulesetPayGainText(option, "slots_5", t, distance), /gainSize/);
  assert.equal(rulesetPayGainText(option, "slots_6", t, distance), "", "nothing said of nothing");
  // Sculpt Spells spares one more for each level paid above its own, said only once it is picked.
  const sculpted = {
    ...option,
    alters: [{ id: "sculpt", label: "Sculpt Spells", cost: 0, spares: 4, sparesByLevel: true }],
    levels: { base: 3, pay: { slots_4: 4, slots_5: 5 } },
  } as unknown as DirectedRulesetOption;
  assert.match(rulesetPayGainText(sculpted, "slots_5", t, distance, ["sculpt"]), /gainSpared\{"count":2\}/);
  assert.doesNotMatch(rulesetPayGainText(sculpted, "slots_5", t, distance), /gainSpared/);
}

console.log(
  "Ruleset aiming: lines at any angle, no aim inside rock, held auras placed on their caster, the template and the allies it catches, Sculpt Spells only where it matters, and what an upcast adds.",
);
