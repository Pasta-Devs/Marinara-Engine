/** Capability API 1.210: a list column worked out from other columns of its row, so a CoC specialty
 *  is its base plus the occupation and interest points spent on it, never typed by hand. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRulesetSheetEnvelope,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  readRulesetSheetEnvelope,
  workOutRulesetListRow,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-worked-columns-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.lists.push({
    id: "specialties",
    label: "Specialties",
    maxItems: 30,
    columns: [
      { id: "name", label: "Name", type: "text", maxLength: 80 },
      { id: "base", label: "Base", type: "number", min: 0, max: 99, default: 1 },
      { id: "occupation", label: "Occupation", type: "number", min: 0, max: 99, default: 0 },
      { id: "interest", label: "Interest", type: "number", min: 0, max: 99, default: 0 },
      { id: "rating", label: "Rating", type: "number", min: 0, max: 99, sum: ["base", "occupation", "interest"] },
    ],
  });
  doc.sheet.derived.push({
    id: "specialty_total",
    label: "Specialty total",
    op: "sum",
    of: [{ listSum: { list: "specialties", column: "rating" } }],
  });
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  const definition = parse(fixture());
  const list = definition.sheet.lists.find((each) => each.id === "specialties")!;
  // A row works out its rating; one already right is the same object.
  const row = workOutRulesetListRow(list, { name: "Art (Photography)", base: 5, occupation: 30, interest: 10 });
  assert.equal(row.rating, 45);
  assert.equal(workOutRulesetListRow(list, row), row);
  // Empty cells read their column's default; the total is held to the column's max.
  assert.equal(workOutRulesetListRow(list, { name: "Swim" }).rating, 1);
  assert.equal(workOutRulesetListRow(list, { base: 60, occupation: 60 }).rating, 99);
  // A typed rating is replaced by the worked-out one.
  assert.equal(workOutRulesetListRow(list, { base: 5, rating: 80 }).rating, 5);

  // Every read of a stored sheet fills them in, and the sheet's sums read them.
  const blank = defaultRulesetSheetBuild(definition);
  const build: RulesetSheetBuild = {
    ...blank,
    lists: {
      ...blank.lists,
      specialties: [
        { name: "Art", base: 5, occupation: 30 },
        { name: "Swim", rating: 70 },
      ],
    },
  };
  const read = readRulesetSheetEnvelope(definition, createRulesetSheetEnvelope(definition, build))!;
  assert.deepEqual(
    (read.build.lists.specialties as Record<string, unknown>[]).map((each) => each.rating),
    [35, 1],
  );
  assert.equal(evaluateRulesetSheet(definition, build).derived.specialty_total, 36, "a draft counts them too");

  // ── The schema ──
  const column = (edit: (rating: Record<string, any>) => void) =>
    issuesOf(fixture((doc) => edit(doc.sheet.lists.at(-1).columns.at(-1))));
  assert.match(
    column((each) => (each.sum = ["name"])),
    /"name" is not another number column/,
  );
  assert.match(
    column((each) => (each.sum = ["rating"])),
    /"rating" is not another number column/,
  );
  assert.match(
    column((each) => (each.sum = ["base", "base"])),
    /"base" is named twice/,
  );
  assert.match(
    column((each) => (each.roll = { count: 1, sides: 6 })),
    /A worked-out column is not rolled/,
  );
  assert.match(
    issuesOf(
      fixture((doc) => {
        const columns = doc.sheet.lists.at(-1).columns;
        columns.push({ id: "double", label: "Double", type: "number", min: 0, max: 200, sum: ["rating", "base"] });
      }),
    ),
    /"rating" is itself worked out/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "worked-columns",
    name: "Worked columns",
    version: "1.0.0",
    description: "Worked columns proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(209, fixture()) ?? "", /1\.210/);
  assert.equal(gate(210, fixture()), null);

  console.log("game-ruleset-worked-columns: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
