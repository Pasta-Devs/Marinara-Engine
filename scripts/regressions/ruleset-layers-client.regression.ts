// The client half of ruleset layers, driven through the REAL exported helpers and the REAL example
// rulesets, so nothing here can agree with a mistake the wizard and the picker also make.
//
// What it pins: the setup wizard's toggles come out in declaration order and name the checked layer
// that rules one of them out; turning one on or off keeps the selection in that order and a blocked
// toggle changes nothing; the record the create call sends holds only the checked layers and is one
// the server accepts; a saved or shared setup restores the layers the installed ruleset still has
// and drops the rest; the catalog picker leaves out the entries a layer hides, in its list and in
// its count, while Refresh from ruleset still sees a row whose entry is now hidden; and every
// localization key the changed client code asks for exists.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogRowRef,
  parseRulesetDefinition,
  rulesetLayerOptionKey,
  rulesetLayerSelectionIssues,
  RULESET_CATALOG_ROW_KEY,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import {
  restoredRulesetLayers,
  rulesetLayerChoices,
  rulesetLayerOptions,
  toggleRulesetLayer,
} from "../../packages/client/src/lib/ruleset-layers.js";
import {
  catalogFilterViews,
  filterCatalogEntries,
  planCatalogRefresh,
  visibleCatalogEntries,
} from "../../packages/client/src/lib/ruleset-catalog.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;

// ── Every key the changed client code asks for exists ──

const keyPattern = /"(game\.ruleset\.(?:setup|sheet)\.[a-zA-Z0-9_.]+)"/gu;
const sources = [
  "packages/client/src/components/game/GameSetupRulesChooser.tsx",
  "packages/client/src/components/game/GameRulesetSheet.tsx",
  "packages/client/src/hooks/use-game.ts",
].map(readSource);
const referenced = new Set<string>();
for (const source of sources) for (const match of source.matchAll(keyPattern)) referenced.add(match[1]!);
for (const key of ["game.ruleset.setup.layersHeading", "game.ruleset.setup.layerBlocked"]) {
  assert.ok(referenced.has(key), `the chooser no longer asks for ${key}`);
}
for (const key of referenced) {
  const present = key in messages || (`${key}_one` in messages && `${key}_other` in messages);
  assert.ok(present, `en.json is missing ${key}`);
}

// ── The example rulesets, parsed exactly as the Engine parses them ──

function parseExample(path: string): RulesetDefinition {
  const parsed = parseRulesetDefinition(JSON.parse(readSource(path)));
  assert.ok(parsed.ok, `${path} does not parse: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
}

const ember = parseExample("docs/examples/rulesets/ember-roads.json");
const gravewatch = parseExample("docs/examples/rulesets/gravewatch.json");
// The 5e draft is the only example with two layers and a conflict between them, which is what makes
// the disabled toggle and the dropped restore testable at all.
const fifth = parseExample("docs/development/ruleset-5e-2014.example.json");

assert.deepEqual(
  (ember.layers ?? []).map((layer) => layer.id),
  ["hard_winter"],
);
assert.deepEqual(
  (gravewatch.layers ?? []).map((layer) => layer.id),
  ["long_night"],
);
assert.deepEqual(
  (fifth.layers ?? []).map((layer) => layer.id),
  ["low_magic", "high_magic"],
);

// ── The toggles the chooser draws ──

// Nothing checked: every layer is offered, in the order the ruleset declares them, and none of them
// is blocked, because only a CHECKED layer can rule another one out.
const nothingChecked = rulesetLayerChoices(fifth, []);
assert.deepEqual(
  nothingChecked.map((choice) => choice.layer.id),
  ["low_magic", "high_magic"],
);
assert.deepEqual(
  nothingChecked.map((choice) => choice.checked),
  [false, false],
);
assert.deepEqual(
  nothingChecked.map((choice) => choice.blockedBy),
  [null, null],
);

// The checked layer stays checked and never blocks itself; the one it rules out is blocked BY IT,
// by name, so the chooser can say which toggle to turn off.
const lowMagicOn = rulesetLayerChoices(fifth, ["low_magic"]);
assert.equal(lowMagicOn[0]?.checked, true);
assert.equal(lowMagicOn[0]?.blockedBy, null);
assert.equal(lowMagicOn[1]?.checked, false);
assert.equal(lowMagicOn[1]?.blockedBy?.id, "low_magic");
assert.equal(lowMagicOn[1]?.blockedBy?.label, "Low magic");

// Conflicts read both ways: only Low magic names the pair, and checking High magic still blocks it.
const highMagicOn = rulesetLayerChoices(fifth, ["high_magic"]);
assert.equal(highMagicOn[0]?.blockedBy?.id, "high_magic");
assert.equal(highMagicOn[1]?.checked, true);

// A ruleset whose single layer conflicts with nothing never blocks it.
assert.deepEqual(
  rulesetLayerChoices(ember, ["hard_winter"]).map((choice) => [choice.checked, choice.blockedBy]),
  [[true, null]],
);
// A ruleset with no layers at all draws no rows, so the block is never rendered.
assert.deepEqual(rulesetLayerChoices({ layers: undefined }, []), []);

// ── Toggling ──

assert.deepEqual(toggleRulesetLayer(fifth, [], "high_magic"), ["high_magic"]);
assert.deepEqual(toggleRulesetLayer(fifth, ["high_magic"], "high_magic"), []);
// Two layers that do not rule each other out, so the order a selection keeps is visible: checked
// ids come back in DECLARATION order however they were clicked, and the record they build is the
// same one either way round.
const friendly = { layers: (fifth.layers ?? []).map((layer) => ({ ...layer, conflicts: [] })) };
assert.deepEqual(toggleRulesetLayer(friendly, ["high_magic"], "low_magic"), ["low_magic", "high_magic"]);
assert.deepEqual(toggleRulesetLayer(friendly, ["low_magic"], "high_magic"), ["low_magic", "high_magic"]);
assert.deepEqual(rulesetLayerOptions(toggleRulesetLayer(friendly, ["high_magic"], "low_magic")), {
  "layer.low_magic": true,
  "layer.high_magic": true,
});
// A blocked toggle changes nothing: the chooser disables the box, and a click that reaches here
// anyway must not build a selection the server would refuse.
assert.deepEqual(toggleRulesetLayer(fifth, ["low_magic"], "high_magic"), ["low_magic"]);
// Turning one off is always allowed, even when it is what blocks the other.
assert.deepEqual(toggleRulesetLayer(fifth, ["low_magic"], "low_magic"), []);
// A layer this ruleset does not have is ignored rather than added.
assert.deepEqual(toggleRulesetLayer(ember, ["hard_winter"], "low_magic"), ["hard_winter"]);

// ── The record the create call sends ──

// Nothing checked sends the empty record a ruleset without layers has always sent.
assert.deepEqual(rulesetLayerOptions([]), {});
assert.deepEqual(rulesetLayerOptions(["hard_winter"]), { "layer.hard_winter": true });
assert.deepEqual(rulesetLayerOptions(["low_magic"]), { [rulesetLayerOptionKey("low_magic")]: true });
// What the wizard builds is what the server accepts: the route refuses a selection this call
// reports an issue for, so a selection the chooser can reach must report none.
for (const checked of [[], ["low_magic"], ["high_magic"]]) {
  assert.deepEqual(rulesetLayerSelectionIssues(fifth, rulesetLayerOptions(checked)), []);
}
// The pair the chooser will not let the player reach is exactly the one the server refuses.
assert.deepEqual(
  rulesetLayerSelectionIssues(fifth, rulesetLayerOptions(["low_magic", "high_magic"])).map((issue) => issue.code),
  ["ruleset_layer_conflict"],
);

// ── Restoring a saved or shared setup ──

assert.deepEqual(restoredRulesetLayers(ember, { "layer.hard_winter": true }), ["hard_winter"]);
// A layer id this installed ruleset no longer has is dropped instead of being sent on to a create
// call that would answer `ruleset_layer_unknown`.
assert.deepEqual(restoredRulesetLayers(ember, { "layer.hard_winter": true, "layer.gone": true }), ["hard_winter"]);
assert.deepEqual(restoredRulesetLayers(ember, { "layer.long_night": true }), []);
// A file that turned a layer off, and one with no layer keys at all, restore to nothing checked.
assert.deepEqual(restoredRulesetLayers(ember, { "layer.hard_winter": false }), []);
assert.deepEqual(restoredRulesetLayers(ember, {}), []);
assert.deepEqual(restoredRulesetLayers(ember, undefined), []);
// A hand-edited file that turned on both sides of a conflict restores the one the shared resolver
// would apply, so the wizard shows the rules the game would really run on.
assert.deepEqual(restoredRulesetLayers(fifth, { "layer.low_magic": true, "layer.high_magic": true }), ["low_magic"]);
// Keys that belong to somebody else are not layers and restore nothing.
assert.deepEqual(restoredRulesetLayers(ember, { somebodyElse: "yes" }), []);

// ── The catalog picker leaves out what a layer hides ──

const knacks = ember.catalogs?.find((entry) => entry.id === "knacks");
assert.ok(knacks, "Ember Roads ships its knacks catalog");
const entries = knacks.entries ?? [];
assert.equal(entries.length, 7);

const hardWinter = { "layer.hard_winter": true };
const offered = visibleCatalogEntries(ember, hardWinter, "knacks", entries);
// Hard winter hides the knacks that cost Grit, and only those.
assert.deepEqual(
  offered.map((entry) => entry.id),
  ["road-sense", "scrap-whisper", "iron-stomach", "hold-the-line", "second-breath"],
);
// With no game pinned, and with the layer off, the picker offers the whole catalog.
assert.equal(visibleCatalogEntries(ember, undefined, "knacks", entries).length, entries.length);
assert.equal(visibleCatalogEntries(ember, {}, "knacks", entries).length, entries.length);
// The rule names one catalog, so another catalog's entries are untouched by it.
assert.equal(visibleCatalogEntries(ember, hardWinter, "somewhere-else", entries).length, entries.length);

const emptyBuild = (lists: RulesetSheetBuild["lists"] = {}) =>
  ({ abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: {}, lists }) satisfies RulesetSheetBuild;

// The count under the picker counts what is offered, not what the file holds: the filters run over
// the narrowed entries, so a hidden entry is missing from the list AND from the match count.
const layeredViews = catalogFilterViews(knacks, offered, ember, emptyBuild());
assert.equal(filterCatalogEntries(offered, layeredViews, "", {}).length, 5);
// A search for a hidden knack by name finds nothing at all.
assert.equal(filterCatalogEntries(offered, layeredViews, "Coldfire", {}).length, 0);
assert.equal(
  filterCatalogEntries(entries, catalogFilterViews(knacks, entries, ember, emptyBuild()), "Coldfire", {}).length,
  1,
);
// A filter value only a hidden entry carries is not offered either, so no select can filter the
// list down to nothing.
const gritOptions = layeredViews.find((view) => view.filter.id === "grit")?.options ?? [];
assert.deepEqual(gritOptions, ["0"]);

// ── Refresh from ruleset still sees a row whose entry is now hidden ──

// Hidden means "not offered", not "gone": a character who took Last Ember before the layer was on,
// or on another game, keeps the row and still gets the ruleset's newer text for it.
const lastEmberRef = catalogRowRef("knacks", "last-ember");
const sheetWithHiddenRow = emptyBuild({
  knacks: [{ [RULESET_CATALOG_ROW_KEY]: lastEmberRef, name: "Last Ember", notes: "What it used to say." }],
});
const refresh = planCatalogRefresh(ember, "knacks", entries, sheetWithHiddenRow.lists);
assert.deepEqual(
  refresh.map((list) => list.listId),
  ["knacks"],
);
const refreshedRow = refresh[0]?.rows[0];
assert.equal(refreshedRow?.name, "Last Ember");
assert.deepEqual(
  refreshedRow?.columns.map((column) => column.columnId),
  ["notes"],
);
assert.equal(refreshedRow?.columns[0]?.current, "What it used to say.");
assert.equal(
  refreshedRow?.columns[0]?.next,
  entries.find((entry) => entry.id === "last-ember")?.rows?.[0]?.values.notes,
);
// The same row, and the picker still does not offer the entry it came from.
assert.ok(!offered.some((entry) => entry.id === "last-ember"));

console.log("ruleset-layers-client regression passed");
