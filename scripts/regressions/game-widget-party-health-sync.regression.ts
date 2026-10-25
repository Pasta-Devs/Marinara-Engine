/** A party's health widget follows the sheets when the Game Master writes no widget tag (laptop playtest
 *  2026-10-25: "Ulfgar HP" stayed at 50 while the sheet said 48). Each row keeps the shape it was
 *  written in, and a row that is nobody's, or names two members, is left alone. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyGameWidgetUpdate, partyHealthWidgetUpdates } from "../../packages/shared/src/utils/game-widget-update.js";
import { rulesetHealthWords } from "../../packages/shared/src/features/rulesets/combat-bridge.js";
import { parseRulesetDefinition } from "../../packages/shared/src/schemas/ruleset.schema.js";
import type { HudWidget } from "../../packages/shared/src/types/game.js";

const widgets = [
  {
    id: "party_hp",
    type: "stat_block",
    label: "Party",
    config: {
      stats: [
        { name: "Ulfgar HP", value: "50/55" },
        { name: "Kesh HP", value: 33 },
        { name: "Vyre Hit Points", value: "26" },
        { name: "Vyre MP", value: "10/10" },
        { name: "Bram HP", value: "Bloodied" },
        { name: "Stranger HP", value: "9/9" },
      ],
    },
  },
  {
    id: "vitals",
    type: "stat_block",
    label: "Health",
    config: {
      stats: [
        { name: "Ulfgar", value: "50/55" },
        { name: "Morale", value: 3 },
      ],
    },
  },
  { id: "gold", type: "counter", label: "Gold", config: { count: 5 } },
] as unknown as HudWidget[];

const rows = [
  { name: "Ulfgar Stonebeard", value: 48, max: 55 },
  { name: "Kesh", value: 20, max: 33 },
  { name: "Vyre Ashcombe", value: 7, max: 26 },
  { name: "Bram", value: 4, max: 30 },
];
const updates = partyHealthWidgetUpdates(widgets, rows);
const synced = updates.reduce((all, update) => applyGameWidgetUpdate(all, update), widgets);
const stats = (index: number) =>
  (synced[index]!.config.stats as Array<{ name: string; value: unknown }>).map((stat) => [stat.name, stat.value]);
assert.deepEqual(stats(0), [
  ["Ulfgar HP", "48/55"],
  ["Kesh HP", 20],
  ["Vyre Hit Points", "7"],
  ["Vyre MP", "10/10"],
  ["Bram HP", "Bloodied"],
  ["Stranger HP", "9/9"],
]);
// A bare name is a member's row only in a widget about health.
assert.deepEqual(stats(1), [
  ["Ulfgar", "48/55"],
  ["Morale", 3],
]);
assert.deepEqual(synced[2], widgets[2]);
// Rows already in step ask for nothing, so the sync settles.
assert.deepEqual(partyHealthWidgetUpdates(synced, rows), []);
// A first name two members share belongs to neither.
const twins = partyHealthWidgetUpdates(
  [{ id: "hp", type: "stat_block", label: "HP", config: { stats: [{ name: "Ana HP", value: "5/5" }] } }] as HudWidget[],
  [
    { name: "Ana Reyes", value: 1, max: 5 },
    { name: "Ana Cole", value: 2, max: 5 },
  ],
);
assert.deepEqual(twins, []);
console.log("Party health widget rows follow the sheets, keeping each row's shape.");
// The ruleset's own word for health names a row too: Ember Roads' "Grit".
const grit = partyHealthWidgetUpdates(
  [
    {
      id: "party",
      type: "stat_block",
      label: "Party",
      config: {
        stats: [
          { name: "Juno Grit", value: "9/9" },
          { name: "Juno Luck", value: 3 },
        ],
      },
    },
  ] as HudWidget[],
  [{ name: "Juno", value: 2, max: 9 }],
  ["Grit"],
);
assert.deepEqual(grit, [{ widgetId: "party", changes: { statName: "Juno Grit", value: "2/9" } }]);
// A word in any script names health, on a label as on a row: "Santé du groupe" holds the ruleset's "Santé".
const sante = partyHealthWidgetUpdates(
  [
    {
      id: "groupe",
      type: "stat_block",
      label: "Santé du groupe",
      config: { stats: [{ name: "Ulfgar", value: "50/55" }] },
    },
    { id: "", type: "stat_block", label: "", config: { stats: [{ name: "Ulfgar", value: "50/55" }] } },
  ] as HudWidget[],
  [{ name: "Ulfgar", value: 48, max: 55 }],
  ["Santé"],
);
assert.deepEqual(sante, [{ widgetId: "groupe", changes: { statName: "Ulfgar", value: "48/55" } }]);
// Two rows of one name: only the first is the one an update reaches, so only it is asked for, and once
// it is in step nothing more is.
const twice = [
  {
    id: "hp",
    type: "stat_block",
    label: "Party",
    config: {
      stats: [
        { name: "Ulfgar HP", value: "50/55" },
        { name: "ulfgar hp", value: "1/55" },
      ],
    },
  },
] as HudWidget[];
const once = partyHealthWidgetUpdates(twice, [{ name: "Ulfgar", value: 48, max: 55 }]);
assert.equal(once.length, 1);
const settled = once.reduce((all, update) => applyGameWidgetUpdate(all, update), twice);
assert.deepEqual(partyHealthWidgetUpdates(settled, [{ name: "Ulfgar", value: 48, max: 55 }]), []);
// The ruleset's word is a pool's label (what remains), never a track's (the marks taken): a "Juno Strain"
// row counts marks, so it is left alone, while "Juno HP" still follows what remains.
const ember = JSON.parse(
  readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
);
const pooled = parseRulesetDefinition(ember);
if (!pooled.ok) throw new Error(pooled.issues.join("; "));
assert.deepEqual(rulesetHealthWords(pooled.definition), ["Grit"]);
// The same rules with health on the Strain track (read from the parsed rules: only the health block moves).
const tracked = { ...pooled.definition, battle: { ...pooled.definition.battle!, health: { track: "strain" } } };
const trackWords = rulesetHealthWords(tracked);
assert.deepEqual(trackWords, []);
assert.deepEqual(
  partyHealthWidgetUpdates(
    [
      {
        id: "party",
        type: "stat_block",
        label: "Party",
        config: {
          stats: [
            { name: "Juno Strain", value: "1/4" },
            { name: "Juno HP", value: "4/4" },
          ],
        },
      },
    ] as HudWidget[],
    [{ name: "Juno", value: 3, max: 4 }],
    trackWords,
  ),
  [{ widgetId: "party", changes: { statName: "Juno HP", value: "3/4" } }],
);
