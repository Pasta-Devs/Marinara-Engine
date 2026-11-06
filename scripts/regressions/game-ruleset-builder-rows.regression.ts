/** Capability API 1.154: named rows the player adds, edits and removes in a guided builder step.
 *  Capability API 1.799: a rows step's `countFrom`, the rows it wants read off the sheet (5e's hit
 *  point rolls, one per level after 1st; 5e ship-readiness re-test 2026-10-24). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderFillRows,
  rulesetBuilderNewRow,
  rulesetBuilderOwnRows,
  rulesetBuilderRemaining,
  rulesetBuilderRowsCountFrom,
  rulesetBuilderRowsMin,
  RULESET_CATALOG_ROW_KEY,
  type RulesetBuilderStep,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

type RowsStep = Extract<RulesetBuilderStep, { kind: "rows" }>;

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-rows-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const base = () =>
  JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"));
const parse = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? [] : result.issues;
};
const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const fixture = () => {
  const doc = base();
  doc.sheet.lists.push({
    id: "retainers",
    label: "Retainers",
    maxItems: 6,
    columns: [
      { id: "name", label: "Name", type: "text", maxLength: 80 },
      { id: "role", label: "Role", type: "text", maxLength: 80 },
      { id: "loyalty", label: "Loyalty", type: "number", min: 0, max: 12, default: 7 },
    ],
  });
  doc.sheet.builder = {
    steps: [
      { id: "feats", label: "Features", kind: "catalog", catalog: "feats", min: 0, max: 2 },
      {
        id: "retainers",
        label: "Retainers",
        kind: "rows",
        list: "retainers",
        required: ["name"],
        min: 2,
        max: 4,
        defaults: { role: "Hireling" },
      },
      { id: "notes", label: "Notes", kind: "rows", list: "features", columns: ["name", "text"] },
    ],
  };
  return doc;
};

try {
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  const state = readRulesetBuilderState(undefined);
  const rowsOf = (build: RulesetSheetBuild, list: string) => (build.lists[list] ?? []) as Record<string, unknown>[];
  const withRows = (build: RulesetSheetBuild, list: string, rows: Record<string, unknown>[]) =>
    ({ ...build, lists: { ...build.lists, [list]: rows } }) as RulesetSheetBuild;

  // Nothing added yet: the step waits on two whole rows.
  let build = defaultRulesetSheetBuild(definition);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).retainers, 2);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).notes, 0);

  // Two retainers with the same name stay two rows through the builder.
  build = withRows(build, "retainers", [
    { name: "Ser Ash", role: "Hireling", loyalty: 7 },
    { name: "Ser Ash", role: "Torchbearer", loyalty: 9 },
  ]);
  let applied = applyRulesetBuilder(definition, build, state, catalogs);
  assert.equal(rowsOf(applied.build, "retainers").length, 2);
  assert.equal(rulesetBuilderRemaining(definition, applied.build, applied.state, catalogs).retainers, 0);

  // Rename one and reorder: each row is its own, found by where it sits.
  const renamed = rowsOf(applied.build, "retainers").map((row, index) =>
    index === 1 ? { ...row, name: "Brin" } : row,
  );
  applied = applyRulesetBuilder(
    definition,
    withRows(applied.build, "retainers", renamed.reverse()),
    applied.state,
    catalogs,
  );
  assert.deepEqual(
    rowsOf(applied.build, "retainers").map((row) => row.name),
    ["Brin", "Ser Ash"],
  );

  // Removing one keeps the other, and the step waits on a row again.
  applied = applyRulesetBuilder(
    definition,
    withRows(applied.build, "retainers", rowsOf(applied.build, "retainers").slice(1)),
    applied.state,
    catalogs,
  );
  assert.deepEqual(rowsOf(applied.build, "retainers"), [{ name: "Ser Ash", role: "Hireling", loyalty: 7 }]);
  assert.equal(rulesetBuilderRemaining(definition, applied.build, applied.state, catalogs).retainers, 1);

  // A row whose required cell is empty is the one thing left to do, counted once: filling it in is
  // the row the step waits on (laptop 2026-10-25: four unrolled rows read "8 choices left").
  applied = applyRulesetBuilder(
    definition,
    withRows(applied.build, "retainers", [...rowsOf(applied.build, "retainers"), { name: "", role: "Hireling" }]),
    applied.state,
    catalogs,
  );
  assert.equal(rulesetBuilderRemaining(definition, applied.build, applied.state, catalogs).retainers, 1);

  // Rows a pick wrote are the pick's: they are not the player's own, and unpicking takes back only them.
  const picked = applyRulesetBuilder(
    definition,
    withRows(applied.build, "features", [{ name: "Old wound", text: "Aches in the cold." }]),
    { ...applied.state, picks: { feats: ["second-effort"] } },
    catalogs,
  );
  const features = rowsOf(picked.build, "features");
  assert.equal(features.length, 2);
  assert.ok(features.some((row) => row[RULESET_CATALOG_ROW_KEY] === "feats/second-effort"));
  assert.deepEqual(
    rulesetBuilderOwnRows(picked.build, "features").map(({ row, index }) => [row.name, index]),
    [["Old wound", 0]],
  );
  const unpicked = applyRulesetBuilder(definition, picked.build, { ...picked.state, picks: { feats: [] } }, catalogs);
  assert.deepEqual(rowsOf(unpicked.build, "features"), [{ name: "Old wound", text: "Aches in the cold." }]);

  // The step is checked against the list it edits.
  const broken = (change: (step: Record<string, unknown>) => void) => {
    const next = fixture();
    change(next.sheet.builder.steps[1]);
    return issuesOf(next).join("; ");
  };
  assert.match(
    broken((step) => (step.list = "missing")),
    /Unknown list "missing"/,
  );
  assert.match(
    broken((step) => (step.columns = ["name", "missing"])),
    /Unknown column "missing"/,
  );
  assert.match(
    broken((step) => (step.columns = ["role"])),
    /"name" is not one of this step's columns/,
  );
  assert.match(
    broken((step) => (step.max = 7)),
    /holds at most 6 rows/,
  );
  assert.match(
    broken((step) => (step.min = 5)),
    /more rows than it lets the player add/,
  );
  assert.match(
    broken((step) => (step.defaults = { loyalty: "high" })),
    /takes a number/,
  );
  assert.match(
    broken((step) => (step.defaults = { missing: 1 })),
    /Unknown column "missing"/,
  );

  // A rows step that counts its rows off the sheet (1.799): one hit point roll per level after 1st.
  const countedFixture = (step: Record<string, unknown> = {}) => {
    const next = base();
    next.sheet.derived.push({
      id: "hp_rolls_due",
      label: "Hit point rolls due",
      op: "sum",
      of: [{ field: "level" }, { const: -1 }],
    });
    next.sheet.lists.push({
      id: "hp_rolls",
      label: "Hit point rolls",
      maxItems: 30,
      columns: [
        { id: "die", label: "Die", type: "text", maxLength: 8, default: "d6" },
        { id: "roll", label: "Roll", type: "number", min: 1, max: 12 },
        { id: "note", label: "Note", type: "text", maxLength: 40, default: "" },
      ],
    });
    next.sheet.builder = {
      steps: [
        {
          id: "hit_point_rolls",
          label: "Hit point rolls",
          kind: "rows",
          list: "hp_rolls",
          required: ["die", "roll"],
          defaults: { die: "d8" },
          countFrom: { derived: "hp_rolls_due" },
          ...step,
        },
      ],
    };
    return next;
  };
  const counted = countedFixture();
  const countedDefinition = parse(counted);
  const countedCatalogs = catalogsOf(countedDefinition);
  const hpStep = countedDefinition.sheet.builder!.steps[0]! as RowsStep;
  const atLevel = (definition: RulesetDefinition, level: number) => {
    const sheet = defaultRulesetSheetBuild(definition);
    return { ...sheet, fields: { ...sheet.fields, level } } as RulesetSheetBuild;
  };
  // A level-20 character wants 19 rows, and the step waits on all of them while none is there.
  let hp = atLevel(countedDefinition, 20);
  assert.equal(rulesetBuilderRowsCountFrom(countedDefinition, hpStep, hp), 19);
  assert.equal(rulesetBuilderRemaining(countedDefinition, hp, state, countedCatalogs).hit_point_rolls, 19);
  // Started with 19 rows, each as "add row" makes it: the columns' defaults under the step's own.
  assert.deepEqual(rulesetBuilderNewRow(countedDefinition, hpStep), { die: "d8", note: "" });
  hp = rulesetBuilderFillRows(countedDefinition, hpStep, hp);
  assert.equal(rowsOf(hp, "hp_rolls").length, 19);
  assert.ok(rowsOf(hp, "hp_rolls").every((row) => row.die === "d8" && row.note === "" && row.roll === undefined));
  // Rows not yet rolled are not whole: the step stays unfinished until each one is.
  applied = applyRulesetBuilder(countedDefinition, hp, state, countedCatalogs);
  assert.equal(rowsOf(applied.build, "hp_rolls").length, 19, "Applying the builder keeps the rows");
  assert.equal(
    rulesetBuilderRemaining(countedDefinition, applied.build, applied.state, countedCatalogs).hit_point_rolls,
    19,
  );
  const rolled = rowsOf(applied.build, "hp_rolls").map((row, index) => (index < 18 ? { ...row, roll: 5 } : row));
  hp = withRows(applied.build, "hp_rolls", rolled);
  assert.equal(rulesetBuilderRemaining(countedDefinition, hp, applied.state, countedCatalogs).hit_point_rolls, 1);
  hp = withRows(
    hp,
    "hp_rolls",
    rolled.map((row) => ({ ...row, roll: 5 })),
  );
  assert.equal(rulesetBuilderRemaining(countedDefinition, hp, applied.state, countedCatalogs).hit_point_rolls, 0);
  // Filling again with enough rows changes nothing, and never takes a row away: a 3rd-level sheet
  // holding five keeps all five.
  assert.equal(rulesetBuilderFillRows(countedDefinition, hpStep, hp), hp);
  const five = withRows(atLevel(countedDefinition, 3), "hp_rolls", rowsOf(hp, "hp_rolls").slice(0, 5));
  assert.equal(rulesetBuilderFillRows(countedDefinition, hpStep, five), five);
  assert.equal(rulesetBuilderRemaining(countedDefinition, five, state, countedCatalogs).hit_point_rolls, 0);
  // Some rows already there: only the rest are added, after them.
  const partial = withRows(atLevel(countedDefinition, 5), "hp_rolls", [{ die: "d10", roll: 7 }]);
  assert.deepEqual(rowsOf(rulesetBuilderFillRows(countedDefinition, hpStep, partial), "hp_rolls"), [
    { die: "d10", roll: 7 },
    { die: "d8", note: "" },
    { die: "d8", note: "" },
    { die: "d8", note: "" },
  ]);
  // The count is read off the sheet given (the builder's applied one), the rows written to the other.
  assert.equal(
    rowsOf(
      rulesetBuilderFillRows(countedDefinition, hpStep, atLevel(countedDefinition, 1), atLevel(countedDefinition, 3)),
      "hp_rolls",
    ).length,
    2,
  );
  // Rows a pick wrote are not the player's own and do not count toward it.
  const withPicked = withRows(atLevel(countedDefinition, 3), "hp_rolls", [
    { die: "d8", roll: 8, [RULESET_CATALOG_ROW_KEY]: "feats/x" },
  ]);
  assert.equal(rowsOf(rulesetBuilderFillRows(countedDefinition, hpStep, withPicked), "hp_rolls").length, 3);
  // Never past the step's max: a 20th-level sheet on a step of at most 5 gets 5, and waits on 5.
  const cappedDefinition = parse(countedFixture({ max: 5 }));
  const cappedStep = cappedDefinition.sheet.builder!.steps[0]! as RowsStep;
  const capped = atLevel(cappedDefinition, 20);
  assert.equal(rowsOf(rulesetBuilderFillRows(cappedDefinition, cappedStep, capped), "hp_rolls").length, 5);
  assert.equal(
    rulesetBuilderRemaining(cappedDefinition, capped, state, catalogsOf(cappedDefinition)).hit_point_rolls,
    5,
  );
  // Nor past the list's own maximum, counting the rows a pick wrote there.
  const fullDoc = countedFixture();
  fullDoc.sheet.lists.find((list: { id: string }) => list.id === "hp_rolls").maxItems = 4;
  const fullDefinition = parse(fullDoc);
  const fullStep = fullDefinition.sheet.builder!.steps[0]! as RowsStep;
  const crowded = withRows(atLevel(fullDefinition, 20), "hp_rolls", [
    { die: "d8", roll: 8, [RULESET_CATALOG_ROW_KEY]: "feats/x" },
  ]);
  assert.equal(rowsOf(rulesetBuilderFillRows(fullDefinition, fullStep, crowded), "hp_rolls").length, 4);
  // min and countFrom together: the larger. A 2nd-level sheet wants 1, a min of 3 wants 3.
  const bothDefinition = parse(countedFixture({ min: 3 }));
  const bothStep = bothDefinition.sheet.builder!.steps[0]! as RowsStep;
  assert.equal(rulesetBuilderRowsMin(bothDefinition, bothStep, atLevel(bothDefinition, 2)), 3);
  assert.equal(rulesetBuilderRowsMin(bothDefinition, bothStep, atLevel(bothDefinition, 9)), 8);
  // Only countFrom fills: a step with a min alone starts as it always has, empty.
  const minOnly = definition.sheet.builder!.steps[1]! as RowsStep;
  const empty = defaultRulesetSheetBuild(definition);
  assert.equal(rulesetBuilderFillRows(definition, minOnly, empty), empty);
  // A 1st-level sheet wants none.
  assert.equal(
    rulesetBuilderRemaining(countedDefinition, atLevel(countedDefinition, 1), state, countedCatalogs).hit_point_rolls,
    0,
  );
  // Its countFrom is checked like any other sheet read.
  assert.match(issuesOf(countedFixture({ countFrom: { derived: "missing" } })).join("; "), /missing/);

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "builder-rows",
    name: "Builder rows",
    version: "1.0.0",
    description: "Named rows proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue = (minor: number, value: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, value);
  assert.match(issue(153, doc) ?? "", /1\.154/);
  assert.equal(issue(154, doc), null);
  // countFrom on a rows step is gated at 1.799.
  assert.equal(
    issue(798, counted),
    "A ruleset whose builder rows steps count their rows off the sheet (a rows step's countFrom) requires schemaVersion 2 and capabilityApi 1.799 or newer",
  );
  assert.equal(issue(799, counted), null);
  console.log("game-ruleset-builder-rows: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
