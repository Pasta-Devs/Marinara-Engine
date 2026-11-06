/** Capability API 1.767: a builder step that marks rows already on a list, ticking a boolean column:
 *  a wizard's prepared spells out of the spellbook an earlier step wrote. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderMarkRows,
  rulesetBuilderMarked,
  rulesetBuilderRemaining,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-mark-"));
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
const refuse = (doc: unknown, message: RegExp) => {
  const result = parseRulesetDefinition(doc);
  assert.ok(
    !result.ok && result.issues.some((issue) => message.test(issue)),
    result.ok ? "unexpectedly accepted" : result.issues.join("; "),
  );
};
const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const spell = (id: string, level: number) => ({
  id,
  label: id,
  filters: { level },
  rows: [{ list: "spells", values: { name: id, level, prepared: false } }],
});
const fixture = () => {
  const doc = base();
  doc.sheet.fields.push({ id: "prepares", label: "Prepares", type: "number", min: 0, max: 30, default: 2 });
  doc.sheet.derived.push({ id: "spells_prepared", label: "Spells prepared", op: "sum", of: [{ field: "prepares" }] });
  doc.catalogs.push({
    id: "book",
    label: "Spellbook",
    feeds: ["spells"],
    filters: [{ id: "level", label: "Level", type: "number" }],
    entries: [spell("light", 0), spell("magic-missile", 1), spell("shield", 1), spell("sleep", 1), spell("web", 2)],
  });
  doc.sheet.builder = {
    tier: "proficient",
    steps: [
      { id: "counts", label: "Counts", kind: "fields", fields: ["prepares"] },
      { id: "spellbook", label: "Spellbook", kind: "catalog", catalog: "book", min: 0, max: 10 },
      {
        id: "prepared",
        label: "Prepared spells",
        kind: "mark",
        list: "spells",
        column: "prepared",
        where: { level: { atLeast: 1 } },
        countFrom: { derived: "spells_prepared" },
      },
    ],
  };
  return doc;
};

try {
  const doc = fixture();
  const definition = parse(doc);
  const catalogs = catalogsOf(definition);
  const blank = defaultRulesetSheetBuild(definition);
  const step = definition.sheet.builder!.steps[2]! as Parameters<typeof rulesetBuilderMarkRows>[0];

  // The spellbook written first: the leveled spells are what may be prepared, the cantrip is not.
  const picked: RulesetBuilderState = { picks: { spellbook: ["light", "magic-missile", "shield", "sleep"] } };
  const written = applyRulesetBuilder(definition, blank, picked, catalogs);
  assert.deepEqual(
    rulesetBuilderMarkRows(step, written.build).map(({ ref }) => ref),
    ["book/magic-missile", "book/shield", "book/sleep"],
  );
  assert.equal(rulesetBuilderRemaining(definition, written.build, written.state, catalogs).prepared, 2);

  // Two marked of the two the sheet allows: ticked on the sheet, and nothing waits.
  const marking = { ...written.state, marks: { prepared: ["book/magic-missile", "book/sleep", "book/shield"] } };
  assert.deepEqual(rulesetBuilderMarked(definition, "prepared", marking, written.build), [
    "book/magic-missile",
    "book/sleep",
  ]);
  const marked = applyRulesetBuilder(definition, written.build, marking, catalogs);
  const prepared = (build: typeof blank) =>
    (build.lists.spells ?? [])
      .filter((row) => row.prepared === true)
      .map((row) => row.name)
      .sort();
  assert.deepEqual(prepared(marked.build), ["magic-missile", "sleep"]);
  assert.equal(rulesetBuilderRemaining(definition, marked.build, marked.state, catalogs).prepared, 0);
  // Saved and read back, the marks are kept.
  assert.deepEqual(readRulesetBuilderState({ builder: marked.state }).marks, marking.marks);

  // Unmarking clears only what it ticked; a tick the player made themselves stays.
  const own = {
    ...marked.build,
    lists: {
      ...marked.build.lists,
      spells: marked.build.lists.spells!.map((row) => (row.name === "shield" ? { ...row, prepared: true } : row)),
    },
  };
  const unmarked = applyRulesetBuilder(
    definition,
    own,
    { ...marked.state, marks: { prepared: ["book/sleep"] } },
    catalogs,
  );
  assert.deepEqual(prepared(unmarked.build), ["shield", "sleep"]);

  // A spell taken out of the book is no longer offered, and the count moves with the sheet.
  const smaller = applyRulesetBuilder(
    definition,
    unmarked.build,
    { ...unmarked.state, picks: { spellbook: ["light", "magic-missile", "shield"] } },
    catalogs,
  );
  assert.deepEqual(rulesetBuilderMarked(definition, "prepared", smaller.state, smaller.build), []);
  const more = { ...smaller.build, fields: { ...smaller.build.fields, prepares: 5 } };
  assert.equal(
    rulesetBuilderRemaining(definition, more, smaller.state, catalogs).prepared,
    2,
    "never more than there are rows",
  );

  // Refusals.
  const notBoolean = fixture();
  notBoolean.sheet.builder.steps[2].column = "level";
  refuse(notBoolean, /No boolean column "level"/);
  const both = fixture();
  both.sheet.builder.steps[2].max = 3;
  refuse(both, /max or countFrom, exactly one/);
  const textAtLeast = fixture();
  textAtLeast.sheet.builder.steps[2].where = { name: { atLeast: 1 } };
  refuse(textAtLeast, /Only a number column is filtered by atLeast/);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "fivee",
    name: "5e",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset with a builder step that marks rows (kind mark) requires schemaVersion 2 and capabilityApi 1.767 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(766) as never, fixture()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(767) as never, fixture()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(766) as never, base()), gate, "nothing without the step");

  console.log(
    "mark: a wizard prepares spells out of the spellbook, up to a sheet value; unmarking clears only its own ticks; refusals; gated at 1.767.",
  );
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
