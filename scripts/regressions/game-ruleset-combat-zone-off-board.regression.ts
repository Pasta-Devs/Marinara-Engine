/**
 * An area that leaves a zone, used with and without a board: 5e's Eversmoking Bottle (1.637).
 *
 *   - On a board it is aimed, at its user's own cell as much as any other within reach.
 *   - Off a board, where nothing is aimed, it may be set down on nobody in particular; pointing it at
 *     somebody still works.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCombatChoice,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const doc = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)), "utf8"),
) as Record<string, any>;
doc.items = { categories: [{ id: "gear", label: "Gear" }] };
doc.catalogs.push({
  id: "kit",
  label: "Kit",
  holds: "items",
  entries: [
    {
      id: "bottle",
      label: "Eversmoking Bottle",
      item: {
        category: "gear",
        use: {
          kind: "utility",
          budget: "action",
          range: 0,
          targets: "any",
          area: { shape: "burst", size: 60 },
          zone: {
            rounds: 14400,
            anchor: "point",
            triggers: [],
            atCast: false,
            obscures: { dispersed: true },
            close: { budget: "action", lingers: 100 },
            spreads: { by: 10, every: 10, upTo: 120 },
          },
        },
      },
    },
  ],
});
const parsed = parseRulesetDefinition(doc);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const bottle = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
const start = (board: boolean) => {
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "thief",
        name: "Thief",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
          fields: { level: 3, ac: 14, speed: 30, hp_max: 20 },
        }),
        items: [{ item: bottle, quantity: 1, worn: false, name: "Eversmoking Bottle" }],
      },
      {
        id: "guard",
        name: "Guard",
        side: "enemy",
        block: {
          health: 11,
          defense: 16,
          initiativeModifier: 0,
          speed: 30,
          actions: [],
        } as unknown as RulesetStatBlock,
      },
    ],
    ...(board
      ? {
          board: {
            grid: { width: 30, height: 30, tiles: Array.from({ length: 30 }, () => Array(30).fill("plains")) } as never,
            placements: { thief: { x: 5, y: 5 }, guard: { x: 25, y: 25 } },
          },
        }
      : {}),
  });
  state.order = ["thief", "guard"];
  state.turn = 0;
  return state;
};
const pour = (board: boolean, choice: Partial<RulesetCombatChoice>) => {
  const state = start(board);
  const option = rulesetCombatOptions(definition, state, "thief").find((one) => one.label === "Eversmoking Bottle");
  assert.ok(option);
  const step = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "thief", optionId: option.id, targetIds: [], ...choice },
    () => 10,
  );
  assert.equal(
    step.events.find((one) => one.type === "refused"),
    undefined,
    JSON.stringify(step.events.filter((one) => one.type !== "area")),
  );
  assert.ok(step.state.combatants.find((one) => one.id === "thief")!.zones?.length, "the smoke stands");
  return { option, step };
};

// ── On a board: aimed at its user's own cell ──
{
  const { option } = pour(true, { at: { x: 5, y: 5 } });
  assert.equal(option.area?.shape, "burst");
}

// ── Off a board: on nobody in particular, with or without a point, or at somebody ──
pour(false, {});
pour(false, { at: { x: 0, y: 0 } });
pour(false, { targetIds: ["guard"] });

console.log("Eversmoking Bottle: its smoke is aimed on a board, and set down on nobody in particular off one.");
