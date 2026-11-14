/**
 * What the in-game ruleset sheet shows beside its editor:
 *
 *   - The summary leaves out what the sheet hides for this build (hideWhen), as the Game Master's own
 *     summary does: a field or derived value hidden for a non-caster is not shown to them either.
 *   - A pool group's heading reads its id as words ("hit_dice" is "Hit dice").
 *   - The card header's level is the ruleset sheet's derived `level`, as the sheet works it out, and none
 *     when the ruleset has no `level` (or hides it): never the game card's stale one.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";
import {
  rulesetPoolGroupLabel,
  rulesetSheetLevel,
  rulesetSheetSummaryShown,
} from "../../../packages/client/src/lib/ruleset-sheet-view.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const gravewatchText = readFileSync(join(repositoryRoot, "docs/examples/rulesets/gravewatch.json"), "utf8");
const parsed = (edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition => {
  const doc = JSON.parse(gravewatchText) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};

// Gravewatch with a level worked out from a field, the lantern oil and a derived value hidden off the
// night watch, and all three in the summary.
const definition = parsed((doc) => {
  doc.sheet.fields.push({ id: "years", label: "Years on watch", type: "number", min: 1, max: 20, default: 3 });
  doc.sheet.derived.push(
    { id: "level", label: "Level", op: "sum", of: [{ field: "years" }, { const: 1 }] },
    {
      id: "wick",
      label: "Wick",
      op: "sum",
      of: [{ const: 2 }],
      hideWhen: { field: "watch", notEquals: "night" },
    },
  );
  doc.gm.sheetSummary.fields = ["watch", "lantern"];
  doc.gm.sheetSummary.derived = ["level", "wick"];
});
const night = defaultRulesetSheetBuild(definition);
const dawn = { ...night, fields: { ...night.fields, watch: "dawn" } };

{
  const shown = (build: typeof night) => {
    const { fields, derived } = rulesetSheetSummaryShown(definition, build);
    return [fields.map((field) => field.id), derived.map((entry) => entry.id)];
  };
  assert.deepEqual(shown(night), [
    ["watch", "lantern"],
    ["level", "wick"],
  ]);
  assert.deepEqual(
    shown(dawn),
    [["watch"], ["level"]],
    "what the sheet hides off the dawn watch is not in its summary",
  );
}

{
  assert.equal(rulesetPoolGroupLabel("hit_dice"), "Hit dice");
  assert.equal(rulesetPoolGroupLabel("SLOTS"), "Slots");
  assert.equal(rulesetPoolGroupLabel("spell-slots"), "Spell slots");
  // The catalog's cost line names a pool group the same way.
  const { catalogMechanicsLabels } = await import("../../../packages/client/src/lib/ruleset-catalog.js");
  const grouped = parsed((doc) => (doc.sheet.live.pools[0].group = "hit_dice"));
  assert.equal(catalogMechanicsLabels(grouped, { units: undefined } as never).pools.hit_dice, "Hit dice");
}

{
  assert.equal(rulesetSheetLevel(definition, undefined, undefined, undefined), 4, "the default build's level");
  assert.equal(
    rulesetSheetLevel(
      definition,
      { v: 1, build: { ...night, fields: { ...night.fields, years: 7 } } },
      undefined,
      undefined,
    ),
    8,
    "the build's own",
  );
  assert.equal(rulesetSheetLevel(parsed(), undefined, undefined, undefined), null, "no level: none shown");
  const hidden = parsed((doc) => {
    doc.sheet.derived.push({
      id: "level",
      label: "Level",
      op: "sum",
      of: [{ const: 1 }],
      hideWhen: { field: "watch", notEquals: "dusk" },
    });
  });
  assert.equal(rulesetSheetLevel(hidden, undefined, undefined, undefined), null, "a hidden level: none shown");
  // A level typed on the sheet as a number field (the 5e 0.1.0 package's) is read too.
  const typed = parsed((doc) => {
    doc.sheet.fields.push({ id: "level", label: "Level", type: "number", min: 1, max: 20, default: 1 });
  });
  const typedBase = defaultRulesetSheetBuild(typed);
  assert.equal(
    rulesetSheetLevel(
      typed,
      { v: 1, build: { ...typedBase, fields: { ...typedBase.fields, level: 5 } } },
      undefined,
      undefined,
    ),
    5,
  );
}

console.log(
  "Ruleset sheet view: the summary hides what the sheet hides, group headings read as words, the level is the sheet's.",
);
