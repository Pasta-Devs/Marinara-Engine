/** A builder stamps rows from the first pick that offered the entry (1.130), once on addition. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetBuilderOptions,
  rulesetBuilderStamp,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const parsed = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const document = JSON.parse(read("docs/development/ruleset-5e-2014.example.json"));
const spellList = document.sheet.lists.find((list: { id: string }) => list.id === "spells");
for (const id of ["class", "class_id", "casting"]) {
  spellList.columns.push({ id, label: id, type: "text", maxLength: 80 });
}
document.catalogs.push(
  {
    id: "classes",
    label: "Classes",
    filters: [
      { id: "ability", label: "Ability", type: "text" },
      { id: "caster_level", label: "Caster level", type: "number" },
      { id: "tags", label: "Tags", type: "tags" },
      { id: "missing", label: "Missing", type: "text" },
    ],
    entries: [
      {
        id: "wizard",
        label: "Wizard",
        filters: { ability: "int", caster_level: 0, tags: ["arcane"] },
        grants: { sets: { hit_die: "d6" } },
      },
      {
        id: "cleric",
        label: "Cleric",
        filters: { ability: "wis", caster_level: 2, tags: ["divine"], missing: "cleric value" },
        grants: { sets: { hit_die: "d8" } },
      },
    ],
  },
  {
    id: "spells",
    label: "Spells",
    feeds: ["spells"],
    filters: [{ id: "class_ids", label: "Classes", type: "tags" }],
    entries: [
      { id: "wizard-only", label: "Wizard spell", filters: { class_ids: ["wizard"] } },
      { id: "shared", label: "Shared spell", filters: { class_ids: ["cleric", "wizard"] } },
      { id: "orphan", label: "Unmatched spell", filters: { class_ids: ["bard"] } },
    ].map((entry) => ({
      ...entry,
      rows: [{ list: "spells", values: { name: entry.label, level: 1, prepared: false } }],
    })),
  },
);
document.sheet.builder = {
  steps: [
    { id: "class", label: "Class", kind: "catalog", catalog: "classes", min: 0, max: 2 },
    {
      id: "spells",
      label: "Spells",
      kind: "catalog",
      catalog: "spells",
      min: 0,
      max: 3,
      within: { step: "class", filter: "class_ids" },
      stamp: {
        class: { fromWithin: "label" },
        class_id: { fromWithin: "id" },
        casting: { fromWithin: "ability" },
        prepared: true,
      },
    },
  ],
};
const dataDir = mkdtempSync(join(tmpdir(), "marinara-stamp-from-within-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
try {
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
  assert.ok(supportedCapabilityApi.minor >= 125);
  const definition = parsed(document);
  const catalogs = Object.fromEntries(definition.catalogs!.map((catalog) => [catalog.id, catalog.entries ?? []]));
  const blank = defaultRulesetSheetBuild(definition);
  const step = definition.sheet.builder!.steps[1]!;
  assert.ok(step.kind === "catalog");
  const picks = { class: ["wizard", "cleric"], spells: ["wizard-only", "shared"] };
  const added = applyRulesetBuilder(definition, blank, { picks }, catalogs);
  assert.deepEqual(
    added.build.lists.spells!.map(({ class: label, class_id, casting, prepared }) => [
      label,
      class_id,
      casting,
      prepared,
    ]),
    [
      ["Wizard", "wizard", "int", true],
      ["Wizard", "wizard", "int", true],
    ],
  );
  const swapped = { picks: { ...picks, class: ["cleric", "wizard"] } };
  const reordered = applyRulesetBuilder(definition, blank, swapped, catalogs);
  assert.deepEqual(
    reordered.build.lists.spells!.map(({ class: label, class_id, casting }) => [label, class_id, casting]),
    [
      ["Wizard", "wizard", "int"],
      ["Cleric", "cleric", "wis"],
    ],
    "the shared spell follows pick order, not catalog or filter order",
  );
  const parentsFirst = applyRulesetBuilder(definition, blank, { picks: { class: picks.class } }, catalogs);
  const thenSpells = applyRulesetBuilder(
    definition,
    parentsFirst.build,
    { ...parentsFirst.state, ...swapped },
    catalogs,
  );
  assert.equal(thenSpells.build.lists.spells![1]!.class, "Cleric", "order is read when the row is added");
  const edited = structuredClone(added.build);
  edited.lists.spells![1]!.class = "Player's class";
  const again = applyRulesetBuilder(definition, edited, { ...added.state, ...swapped }, catalogs);
  assert.equal(again.build.lists.spells![1]!.class, "Player's class", "later edits survive parent changes");
  assert.equal(again.build.lists.spells![1]!.class_id, "wizard", "an existing row is not re-stamped");
  assert.equal(
    applyRulesetBuilder(definition, edited, swapped, catalogs).build.lists.spells![1]!.class,
    "Player's class",
    "a row the player already held is not stamped",
  );
  const noParent = catalogs.spells!.find((entry) => entry.id === "orphan")!;
  assert.deepEqual(rulesetBuilderStamp(definition, step, noParent, { picks }, catalogs, blank), { prepared: true });
  assert.deepEqual(
    rulesetBuilderStamp(definition, step, catalogs.spells![0]!, { picks: { class: [] } }, catalogs, blank),
    { prepared: true },
    "no parent leaves dynamic columns unstamped without losing fixed stamps",
  );
  assert.ok(!rulesetBuilderOptions(definition, step, { picks }, catalogs, blank).includes(noParent));
  const scalarFilter = { ...catalogs.spells![0]!, filters: { class_ids: "wizard" } };
  assert.equal(rulesetBuilderStamp(definition, step, scalarFilter, { picks }, catalogs, blank).class, "Wizard");

  // Only picks the parent step still offers and counts can offer this entry.
  const limitedDoc = structuredClone(document);
  limitedDoc.sheet.builder.steps[0].filters = { ability: "wis" };
  const limited = parsed(limitedDoc);
  assert.equal(applyRulesetBuilder(limited, blank, { picks }, catalogs).build.lists.spells![0]!.class, "Cleric");
  const cappedDoc = structuredClone(document);
  cappedDoc.sheet.builder.steps[0].max = 1;
  const capped = parsed(cappedDoc);
  assert.equal(
    rulesetBuilderStamp(capped, step, scalarFilter, swapped, catalogs, blank).class,
    undefined,
    "a parent pick beyond the step's max does not offer a stamp",
  );

  for (const filter of ["missing", "tags", "caster_level"]) {
    const doc = structuredClone(document);
    doc.sheet.builder.steps[1].stamp.casting = { fromWithin: filter };
    if (filter === "caster_level") {
      delete doc.sheet.builder.steps[1].stamp.casting;
      doc.sheet.builder.steps[1].stamp.level = { fromWithin: filter };
    }
    const rules = parsed(doc);
    const rows = applyRulesetBuilder(rules, blank, { picks }, catalogs).build.lists.spells!;
    assert.ok(rows.every((row) => row.prepared === true));
    if (filter === "caster_level") {
      assert.equal(rows[0]!.level, 0, "a numeric parent filter, including zero, is written as a number");
      assert.equal(applyRulesetBuilder(rules, blank, swapped, catalogs).build.lists.spells![1]!.level, 2);
    } else {
      assert.ok(
        rows.every((row) => row.casting === undefined),
        "missing or array filters are not stamped",
      );
      if (filter === "missing") {
        assert.equal(
          applyRulesetBuilder(rules, blank, swapped, catalogs).build.lists.spells![1]!.casting,
          "cleric value",
          "a missing filter on the first offering pick does not fall through to the second",
        );
      }
    }
  }

  const refused = (edit: (doc: any) => void, pattern: RegExp) => {
    const doc = structuredClone(document);
    edit(doc);
    const result = parseRulesetDefinition(doc);
    assert.ok(!result.ok, `must refuse ${pattern}`);
    assert.match(result.issues.join("; "), pattern);
  };
  refused((doc) => delete doc.sheet.builder.steps[1].within, /A stamp from the offering pick needs the step's within/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.class.fromWithin = "absent"), /Unknown filter "absent"/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.class.fromWithin = "class_ids"), /Unknown filter "class_ids"/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.class = {}), /stamp/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.class.extra = true), /Unrecognized key/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.class.fromWithin = 1), /stamp/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.class.fromWithin = "bad-key"), /stamp/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp = {}), /1 to 4/);
  refused((doc) => (doc.sheet.builder.steps[1].stamp.level = 1), /1 to 4/);
  refused((doc) => {
    doc.sheet.builder.steps[1].stamp.absent = doc.sheet.builder.steps[1].stamp.class;
    delete doc.sheet.builder.steps[1].stamp.class;
  }, /Unknown column/);

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "stamp-from-within",
    name: "Stamp from within",
    version: "0.1.0",
    description: "Stamp from the offering pick.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issue =
    "A ruleset whose builder stamps from the offering pick requires schemaVersion 2 and capabilityApi 1.130 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(129) as any, document), issue);
  assert.equal(getCapabilityPackageInstallIssue(manifest(130) as any, document), null);
  const missing = manifest(130) as any;
  delete missing.capabilityApi;
  assert.match(getCapabilityPackageInstallIssue(missing, document) ?? "", /requires schemaVersion 2/);
  assert.match(
    getCapabilityPackageInstallIssue({ ...manifest(130), schemaVersion: 1 } as any, document) ?? "",
    /requires schemaVersion 2/,
  );
  const fixed = structuredClone(document);
  fixed.sheet.builder.steps[1].stamp = { class: "wizard", prepared: true };
  assert.equal(getCapabilityPackageInstallIssue(manifest(129) as any, fixed), null);
  assert.equal(applyRulesetBuilder(parsed(fixed), blank, { picks }, catalogs).build.lists.spells![0]!.class, "wizard");

  // The emitted schema retains the record bound and the strict new value union.
  const schema = JSON.parse(read("docs/extending/ruleset.schema.json"));
  const nodes: any[] = [];
  const visit = (node: any) => {
    if (node && typeof node === "object") {
      nodes.push(node);
      Object.values(node).forEach(visit);
    }
  };
  visit(schema);
  const stamp = nodes.find((node) => node.properties?.stamp)?.properties.stamp;
  assert.deepEqual([stamp.minProperties, stamp.maxProperties], [1, 4]);
  const fromWithin = stamp.additionalProperties.anyOf.find((node: any) => node.properties?.fromWithin);
  assert.equal(fromWithin.properties.fromWithin.type, "string");
  assert.deepEqual(fromWithin.required, ["fromWithin"]);
  assert.equal(fromWithin.additionalProperties, false);
  console.log(
    "Stamp from within: pick order, row addition, edits, missing values, import, schema and 1.130 gate passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
