/** A field a builder pick sets, typed over in the builder (playtest): a class level raised from 1 to 5
 *  in the levels step stays 5 through every later click, and is taken back with the class. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  type RulesetCatalogEntriesById,
} from "../../packages/shared/src/index.js";

const doc = JSON.parse(
  readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
);
doc.sheet.fields.push({ id: "level_fighter", label: "Fighter levels", type: "number", min: 0, max: 20, default: 0 });
doc.catalogs.push({
  id: "classes",
  label: "Classes",
  entries: [{ id: "fighter", label: "Fighter", grants: { sets: { level_fighter: 1 } } }],
});
doc.catalogs.push({
  id: "backgrounds",
  label: "Backgrounds",
  entries: [
    { id: "acolyte", label: "Acolyte", grants: { sets: { background: "Acolyte" } } },
    { id: "sage", label: "Sage", grants: { sets: { background: "Sage" } } },
  ],
});
doc.sheet.builder = {
  tier: "proficient",
  steps: [
    { id: "class", label: "Class", kind: "catalog", catalog: "classes", max: 1 },
    { id: "levels", label: "Levels", kind: "fields", fields: ["level_fighter"] },
    { id: "background", label: "Background", kind: "catalog", catalog: "backgrounds", max: 1 },
  ],
};
const parsed = parseRulesetDefinition(doc);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
  definition.catalogs.map((catalog) => [catalog.id, catalog.entries ?? []]),
);

const picked = applyRulesetBuilder(
  definition,
  defaultRulesetSheetBuild(definition),
  { picks: { class: ["fighter"] } },
  catalogs,
);
assert.equal(picked.build.fields.level_fighter, 1, "the class sets its level");
// Typed over in the levels step, as the builder screen does it.
const typed = applyRulesetBuilder(
  definition,
  { ...picked.build, fields: { ...picked.build.fields, level_fighter: 5 } },
  { ...picked.state, applied: { ...picked.state.applied!, typedFields: ["level_fighter"] } },
  catalogs,
);
assert.equal(typed.build.fields.level_fighter, 5);
// Another click anywhere keeps it, read back from storage too.
const stored = readRulesetBuilderState({ builder: typed.state });
const later = applyRulesetBuilder(
  definition,
  typed.build,
  { ...stored, picks: { ...stored.picks, background: ["sage"] } },
  catalogs,
);
assert.equal(later.build.fields.level_fighter, 5, "not written back to 1");
assert.deepEqual(later.state.applied?.typedFields, ["level_fighter"]);
// Unpicking the class takes the level it set back, typed over or not.
const unpicked = applyRulesetBuilder(
  definition,
  later.build,
  { ...later.state, picks: { ...later.state.picks, class: [] } },
  catalogs,
);
assert.equal(unpicked.build.fields.level_fighter ?? 0, 0);

console.log("Typed fields: a class level typed over a pick's stays through later clicks and goes with the class.");
