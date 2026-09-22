// The ruleset catalog picker's decidable half, driven through the REAL exported helpers and the
// REAL example ruleset, so nothing here can agree with a mistake the picker also makes.
//
// What it pins: the filter options a catalog offers come from the entries and sort the way their
// type reads; a filter with `startFrom` opens on the sheet's own value, case and label included;
// an entry the sheet already holds is marked from ANY list the catalog feeds; a selection reports
// what each list gains against the room it has, drops a row the ruleset would refuse, and names a
// list it would overflow; and the mechanics line is built entirely from localization keys and the
// ruleset's own labels, so nothing in it is shaped to one system.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntry,
  type RulesetCatalogFilter,
  type RulesetField,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import {
  CATALOG_FILTER_ANY,
  catalogEntryAlreadyAdded,
  catalogFilterOptions,
  catalogFilterStartValue,
  catalogFilterViews,
  catalogMechanicsLabels,
  filterCatalogEntries,
  formatCatalogMechanics,
  planCatalogAddition,
  sheetFieldMatchTexts,
} from "../../packages/client/src/lib/ruleset-catalog.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;

/** English rendering with i18next's own plural suffix and interpolation, so the assertions below
 *  read the shipped strings rather than a copy of them. */
function translate(key: string, params: Record<string, unknown> = {}): string {
  const count = params.count;
  const plural = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : key;
  const message = messages[plural] ?? messages[key];
  assert.ok(message, `en.json is missing ${key}`);
  return message.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_all, name: string) => String(params[name] ?? ""));
}
const t = translate as unknown as Parameters<typeof formatCatalogMechanics>[2];

/** A translator that says WHICH key was asked for and with what, instead of rendering English. The
 *  mechanics line is asserted through it, so rewording a string in en.json cannot fail a test that
 *  is about which parts the line has and in what order. */
function describeKey(key: string, params: Record<string, unknown> = {}): string {
  const name = key.replace("game.ruleset.catalog.", "");
  const shown = Object.keys(params)
    .sort()
    .map((param) => `${param}=${String(params[param])}`);
  return shown.length > 0 ? `${name}(${shown.join(",")})` : name;
}
const keyed = describeKey as unknown as Parameters<typeof formatCatalogMechanics>[2];

// ── Every key the picker asks for exists ──

const keyPattern = /"(game\.ruleset\.catalog\.[a-zA-Z0-9_.]+)"/gu;
const sources = [
  readSource("packages/client/src/lib/ruleset-catalog.ts"),
  readSource("packages/client/src/components/rulesets/RulesetCatalogPicker.tsx"),
  readSource("packages/client/src/components/rulesets/RulesetSheetEditor.tsx"),
];
const referenced = new Set<string>();
for (const source of sources) for (const match of source.matchAll(keyPattern)) referenced.add(match[1]!);
assert.ok(referenced.size >= 30, "the picker's localization keys were not found in the source");
for (const key of referenced) {
  // A key used with a count resolves to its plural forms, and both have to exist.
  const present = key in messages || (`${key}_one` in messages && `${key}_other` in messages);
  assert.ok(present, `en.json is missing ${key}`);
}

// ── The example ruleset, parsed exactly as the Engine parses it ──

const parsed = parseRulesetDefinition(JSON.parse(readSource("docs/examples/rulesets/ember-roads.json")));
assert.ok(parsed.ok, `the example ruleset does not parse: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
const definition = parsed.definition;
const catalog = definition.catalogs?.[0];
assert.ok(catalog, "the example ruleset ships a catalog");
const entries = catalog.entries ?? [];
assert.equal(entries.length, 7);

const emptyBuild = (lists: RulesetSheetBuild["lists"] = {}, fields: RulesetSheetBuild["fields"] = {}) =>
  ({ abilities: {}, skills: {}, saves: {}, bonuses: {}, fields, lists }) satisfies RulesetSheetBuild;

// ── Filter options come from the entries, and sort the way their type reads ──

const gritFilter = catalog.filters?.find((filter) => filter.id === "grit");
const roadFilter = catalog.filters?.find((filter) => filter.id === "road");
const callingFilter = catalog.filters?.find((filter) => filter.id === "callings");
assert.ok(gritFilter && roadFilter && callingFilter);
assert.deepEqual(catalogFilterOptions(gritFilter, entries), ["0", "1"]);
assert.deepEqual(catalogFilterOptions(roadFilter, entries), ["Ash Flats", "Every road", "Glasslands", "Rustways"]);
assert.deepEqual(catalogFilterOptions(callingFilter, entries), [
  "Courier",
  "Ember-tender",
  "Hauler",
  "Scout",
  "Tinker",
]);

// A number filter sorts numerically: 10 belongs after 9, not between 1 and 2.
const numeric: RulesetCatalogFilter = { id: "cost", label: "Cost", type: "number" };
const numericEntries = [2, 10, 9, 1].map(
  (cost, index) =>
    ({ id: `e${index}`, label: `E${index}`, filters: { cost }, rows: [] }) as unknown as RulesetCatalogEntry,
);
assert.deepEqual(catalogFilterOptions(numeric, numericEntries), ["1", "2", "9", "10"]);

// A filter nothing carries offers nothing, so the picker can leave it out entirely.
assert.deepEqual(catalogFilterOptions({ id: "nobody", label: "Nobody", type: "text" }, entries), []);

// ── `startFrom` opens on the sheet's own value ──

// The sheet spells it differently than the catalog does; the match ignores case.
const scoutViews = catalogFilterViews(catalog, entries, definition, emptyBuild({}, { calling: "scout" }));
assert.equal(scoutViews.find((view) => view.filter.id === "callings")?.start, "Scout");
// A filter with no `startFrom` always opens on "Any", whatever the sheet says.
assert.equal(scoutViews.find((view) => view.filter.id === "road")?.start, CATALOG_FILTER_ANY);
// A value no entry carries falls back to "Any" rather than filtering everything away.
const strangerViews = catalogFilterViews(catalog, entries, definition, emptyBuild({}, { calling: "Lamplighter" }));
assert.equal(strangerViews.find((view) => view.filter.id === "callings")?.start, CATALOG_FILTER_ANY);
// An empty sheet starts on "Any" too, and every declared filter is still drawn.
const blankViews = catalogFilterViews(catalog, entries, definition, emptyBuild());
assert.deepEqual(
  blankViews.map((view) => view.start),
  [CATALOG_FILTER_ANY, CATALOG_FILTER_ANY, CATALOG_FILTER_ANY],
);

// An enum field is named by its VALUE or by the label the sheet shows for it.
const enumField: RulesetField = {
  id: "school",
  label: "School",
  type: "enum",
  values: ["evo"],
  valueLabels: { evo: "Evocation" },
};
assert.deepEqual(sheetFieldMatchTexts(enumField, "evo"), ["evo", "Evocation"]);
assert.equal(catalogFilterStartValue(["Abjuration", "Evocation"], sheetFieldMatchTexts(enumField, "evo")), "Evocation");
assert.equal(catalogFilterStartValue(["Abjuration"], sheetFieldMatchTexts(enumField, "evo")), CATALOG_FILTER_ANY);
// Nothing stored and no default means nothing to start from.
assert.deepEqual(sheetFieldMatchTexts(undefined, undefined), []);

// ── Search and filters narrow together ──

const roadOnly = filterCatalogEntries(entries, blankViews, "", { road: "Rustways" });
assert.deepEqual(
  roadOnly.map((entry) => entry.id),
  ["scrap-whisper"],
);
// A tags filter matches one tag out of the list.
assert.deepEqual(
  filterCatalogEntries(entries, blankViews, "", { callings: "Scout" }).map((entry) => entry.id),
  ["road-sense", "hold-the-line", "second-breath"],
);
// Search reads the summary as well as the label.
assert.deepEqual(
  filterCatalogEntries(entries, blankViews, "dead machines", {}).map((entry) => entry.id),
  ["scrap-whisper"],
);
// An entry carrying no value for a chosen filter is not what the user asked for.
assert.equal(filterCatalogEntries(numericEntries, blankViews, "", { callings: "Scout" }).length, 0);

// ── "Added" is read from the reserved mark, in ANY list the catalog feeds ──

const roadSense = entries.find((entry) => entry.id === "road-sense")!;
const lastEmber = entries.find((entry) => entry.id === "last-ember")!;
assert.equal(catalogEntryAlreadyAdded(catalog.id, roadSense, catalog.feeds ?? [], {}), false);
assert.equal(
  catalogEntryAlreadyAdded(catalog.id, roadSense, catalog.feeds ?? [], {
    knacks: [{ name: "Road Sense", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" }],
  }),
  true,
);
// The mark is found even when it sits in the OTHER list the catalog feeds.
assert.equal(
  catalogEntryAlreadyAdded(catalog.id, roadSense, catalog.feeds ?? [], {
    tricks: [{ name: "Road Sense", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" }],
  }),
  true,
);
// A hand-typed row that happens to share the name is not the catalog's row.
assert.equal(
  catalogEntryAlreadyAdded(catalog.id, roadSense, catalog.feeds ?? [], { knacks: [{ name: "Road Sense" }] }),
  false,
);

// ── What a pick costs each list ──

// One entry, two lists, one plan: the feature and the counter that tracks it move together.
const twoLists = planCatalogAddition(definition, catalog.id, [lastEmber], {});
assert.deepEqual(Object.keys(twoLists.lists).sort(), ["knacks", "tricks"]);
assert.equal(twoLists.dropped, 0);
assert.deepEqual(twoLists.full, []);
assert.deepEqual(
  twoLists.targets.map((target) => [target.label, target.current, target.adding, target.room]),
  [
    ["Knacks", 0, 1, 20],
    ["Limited tricks", 0, 1, 12],
  ],
);
// The rows are copies carrying only the mark that says where they came from.
assert.deepEqual(twoLists.lists.knacks?.[0], {
  name: "Last Ember",
  notes: "Spend 1 Grit to give a downed friend 3 Grit back. Once between camps for each point of Heart.",
  [RULESET_CATALOG_ROW_KEY]: "knacks/last-ember",
});

// Existing rows are kept, and the count of what is added is measured against them.
const onTop = planCatalogAddition(definition, catalog.id, [roadSense], { knacks: [{ name: "Old knack" }] });
assert.equal(onTop.lists.knacks?.length, 2);
assert.deepEqual(onTop.lists.knacks?.[0], { name: "Old knack" });
assert.deepEqual(
  onTop.targets.map((target) => [target.label, target.current, target.adding, target.room]),
  [["Knacks", 1, 1, 19]],
);

// A full list is named rather than silently overfilled.
const brimming = Array.from({ length: 20 }, (_row, index) => ({ name: `Knack ${index}` }));
const overflow = planCatalogAddition(definition, catalog.id, [roadSense, lastEmber], { knacks: brimming });
assert.deepEqual(overflow.full, ["Knacks"]);
assert.deepEqual(
  overflow.targets.map((target) => [target.label, target.adding, target.room]),
  [
    ["Knacks", 2, 0],
    ["Limited tricks", 1, 12],
  ],
);

// An entry with a row the ruleset itself would refuse is left out WHOLE and counted: its good row
// is not spliced in without the one that belongs with it.
const badEntry = {
  id: "too-many-uses",
  label: "Too many uses",
  rows: [
    { list: "tricks", values: { name: "Nope", uses: 99 } },
    { list: "knacks", values: { name: "Fine" } },
  ],
} as unknown as RulesetCatalogEntry;
const dropping = planCatalogAddition(definition, catalog.id, [badEntry], {});
assert.equal(dropping.dropped, 1);
assert.deepEqual(Object.keys(dropping.lists), []);
// A list hidden on this sheet takes no rows: the rest of the entry is still added, and an entry that
// would only write to hidden lists adds nothing and is counted.
const aroundHidden = planCatalogAddition(definition, catalog.id, [lastEmber], {}, new Set(["tricks"]));
assert.deepEqual(Object.keys(aroundHidden.lists), ["knacks"]);
assert.equal(aroundHidden.dropped, 0);
assert.equal(planCatalogAddition(definition, catalog.id, [lastEmber], {}, new Set(["knacks", "tricks"])).dropped, 1);
// A stored sheet is read tolerantly: a list that is not rows reads as empty instead of throwing.
const malformed = { knacks: "not rows" } as unknown as Parameters<typeof planCatalogAddition>[3];
assert.equal(catalogEntryAlreadyAdded(catalog.id, roadSense, catalog.feeds ?? [], malformed), false);
assert.equal(planCatalogAddition(definition, catalog.id, [roadSense], malformed).lists.knacks?.length, 1);
// An entry for a list this ruleset does not have is dropped the same way.
const strayEntry = {
  id: "stray",
  label: "Stray",
  rows: [{ list: "nowhere", values: { name: "Nope" } }],
} as unknown as RulesetCatalogEntry;
assert.equal(planCatalogAddition(definition, catalog.id, [strayEntry], {}).dropped, 1);

// ── The mechanics line ──

const labels = catalogMechanicsLabels(definition, catalog);
assert.equal(labels.pools.grit, "Grit");
assert.equal(labels.units?.distance?.label, "paces");

const coldfire = entries.find((entry) => entry.id === "coldfire-toss")!;
assert.equal(
  formatCatalogMechanics(coldfire.mechanics!, labels, keyed),
  "kind.attack · mechanics.range(distance=mechanics.distance(unit=paces,value=12)) · mechanics.area(distance=mechanics.distance(unit=paces,value=4),shape=shape.burst) · targets.any · mechanics.friendlyFire · mechanics.amountOfType(amount=2d6,type=coldfire)",
);
assert.equal(
  formatCatalogMechanics(lastEmber.mechanics!, labels, keyed),
  "kind.heal · mechanics.selfOrTouch · targets.ally · 3 · mechanics.cost(count=1,pool=Grit)",
);
// One line through the shipped English, to prove the keys render as a sentence at all. Its wording
// is free to change: only the ruleset's own words are looked for.
const shipped = formatCatalogMechanics(lastEmber.mechanics!, labels, t);
assert.ok(shipped.includes("Grit") && !shipped.includes("{{"), shipped);

// Nothing in the line is hard-coded to one system: the save and the pool are named by the RULESET,
// the unit by the CATALOG, and every other word by a localization key.
const d20Labels = {
  units: { distance: { label: "ft", perCell: 5 } },
  saves: { dexterity: "Dexterity" },
  pools: { slots3: "Slots (3rd)" },
  budgets: { action: "Action", bonus: "Bonus action" },
};
assert.equal(
  formatCatalogMechanics(
    {
      kind: "attack",
      range: 150,
      area: { shape: "burst", size: 20 },
      amount: { dice: "8d6" },
      damageType: "fire",
      save: { save: "dexterity", onSuccess: "half" },
      cost: [{ pool: "slots3", amount: 1 }],
    },
    d20Labels,
    keyed,
  ),
  "kind.attack · mechanics.range(distance=mechanics.distance(unit=ft,value=150)) · mechanics.area(distance=mechanics.distance(unit=ft,value=20),shape=shape.burst) · mechanics.amountOfType(amount=8d6,type=fire) · mechanics.saveHalf(save=Dexterity) · mechanics.cost(count=1,pool=Slots (3rd))",
);

// The remaining vocabulary still renders, and an unknown save or pool falls back to its own id
// rather than showing an empty word.
assert.equal(
  formatCatalogMechanics(
    {
      kind: "debuff",
      targets: "enemy",
      attackRoll: true,
      amount: { dice: "1d8", flat: 3 },
      perCostStep: { flat: 2 },
      save: { save: "grit", onSuccess: "negates" },
      concentration: true,
      reaction: true,
    },
    d20Labels,
    keyed,
  ),
  "kind.debuff · targets.enemy · mechanics.attackRoll · 1d8+3 · mechanics.perStep(amount=2) · mechanics.saveNegates(save=grit) · mechanics.concentration · mechanics.reaction",
);
assert.equal(formatCatalogMechanics({ kind: "utility" }, d20Labels, keyed), "kind.utility");
const checkEffect = formatCatalogMechanics(
  { kind: "utility", check: { reroll: { upTo: 1, mode: "once" }, dice: 2, successes: 3, threshold: 8 } },
  d20Labels,
  t,
);
assert.match(checkEffect, /reroll dice ≤ 1 once/);
assert.match(checkEffect, /\+2 dice/);
assert.match(checkEffect, /\+3 successes/);
assert.match(checkEffect, /success on 8\+/);
// And what this slice added, which is the whole of what some entries do: an ability that costs no
// action, one that hands a budget back, one that buys standard actions with another budget, and the
// clauses beside a blow's first amount, each said on its own because each is rolled on its own.
assert.equal(
  formatCatalogMechanics(
    {
      kind: "utility",
      free: true,
      gives: [{ budget: "action", count: 1 }],
      standard: { actions: ["dash", "hide"], budget: "bonus" },
    },
    d20Labels,
    keyed,
  ),
  "kind.utility · mechanics.free · mechanics.gives(budget=Action,count=1) · mechanics.standard(actions=game.combat.ruleset.standard.dash(defaultValue=dash), game.combat.ruleset.standard.hide(defaultValue=hide),budget=Bonus action)",
);
assert.equal(
  formatCatalogMechanics(
    {
      kind: "attack",
      amount: { dice: "1d8" },
      damageType: "slashing",
      plus: [{ dice: "2d6", type: "fire" }, { flat: 2 }],
    },
    d20Labels,
    keyed,
  ),
  "kind.attack · mechanics.amountOfType(amount=1d8,type=slashing) · mechanics.plus(amount=2d6,type=fire) · mechanics.plus(amount=2,type=mechanics.riderSameType)",
);
// A clause may ask for a saving throw of its own, which is a different throw from the action's and
// is the only thing standing between the target and that part of the blow. It reads beside the
// clause it belongs to, and an unnamed save falls back to its id like every other name here.
assert.equal(
  formatCatalogMechanics(
    {
      kind: "attack",
      amount: { dice: "1d8" },
      save: { save: "dexterity", onSuccess: "half" },
      plus: [
        { dice: "2d6", type: "fire", save: { save: "dexterity", onSuccess: "none" } },
        { dice: "1d6", type: "poison", save: { save: "grit", onSuccess: "half" } },
      ],
    },
    d20Labels,
    keyed,
  ),
  "kind.attack · 1d8 · mechanics.plus(amount=2d6,type=fire) · mechanics.saveNone(save=Dexterity) · mechanics.plus(amount=1d6,type=poison) · mechanics.saveHalf(save=grit) · mechanics.saveHalf(save=Dexterity)",
);
// A budget this ruleset does not name falls back to its own id, exactly as a save or a pool does.
assert.equal(
  formatCatalogMechanics({ kind: "utility", gives: [{ budget: "nowhere", count: 2 }] }, d20Labels, keyed),
  "kind.utility · mechanics.gives(budget=nowhere,count=2)",
);
// A catalog that declares no distance unit still reads, with bare numbers.
assert.equal(
  formatCatalogMechanics({ kind: "buff", range: 4 }, { units: undefined, saves: {}, pools: {}, budgets: {} }, keyed),
  "kind.buff · mechanics.range(distance=4)",
);

// ── The lane stays hooked up ──

assert.match(
  readSource("scripts/regressions/tsconfig.client-lanes.json"),
  /ruleset-catalog-picker\.regression\.ts/u,
  "this lane needs DOM-free client types, so the client lint's lane tsconfig must include it",
);

console.log("Ruleset catalog picker regressions passed.");
