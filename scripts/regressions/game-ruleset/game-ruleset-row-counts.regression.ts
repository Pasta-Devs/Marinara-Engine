/** Capability API 1.205: a list's rows counted, or a column added up, over only the rows whose cell
 *  equals a value, so a creation rule can hold Genesys's talent pyramid. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  rulesetBuilderConstraintFailures,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-row-counts-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.lists.push({
    id: "talents",
    label: "Talents",
    maxItems: 30,
    columns: [
      { id: "name", label: "Name", type: "text", maxLength: 80 },
      { id: "tier", label: "Tier", type: "number", min: 1, max: 5, default: 1 },
      { id: "ranked", label: "Ranked", type: "boolean", default: false },
    ],
  });
  doc.sheet.derived.push(
    {
      id: "tier1",
      label: "Tier 1 talents",
      op: "sum",
      of: [{ listSum: { list: "talents", count: true, where: { column: "tier", equals: 1 } } }],
    },
    {
      id: "tier2",
      label: "Tier 2 talents",
      op: "sum",
      of: [{ listSum: { list: "talents", count: true, where: { column: "tier", equals: 2 } } }],
    },
    { id: "tier1_less_one", label: "Tier 1 less one", op: "sum", of: [{ derived: "tier1" }, { const: -1 }] },
    {
      id: "tier2_levels",
      label: "Tier 2 levels",
      op: "sum",
      of: [{ listSum: { list: "talents", column: "tier", where: { column: "tier", equals: 2 } } }],
    },
  );
  doc.sheet.builder = {
    steps: [{ id: "talents", label: "Talents", kind: "rows", list: "talents" }],
    constraints: [
      {
        id: "pyramid",
        label: "Each tier holds fewer talents than the one below it.",
        step: "talents",
        value: { derived: "tier2" },
        max: { derived: "tier1_less_one" },
      },
    ],
  };
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
  const withTalents = (rows: Record<string, unknown>[]): RulesetSheetBuild => {
    const blank = defaultRulesetSheetBuild(definition);
    return { ...blank, lists: { ...blank.lists, talents: rows } };
  };
  const derived = (build: RulesetSheetBuild) => evaluateRulesetSheet(definition, build).derived;
  const failures = (build: RulesetSheetBuild) =>
    rulesetBuilderConstraintFailures(definition, build).map((rule) => rule.id);

  // Two tier 1 and one tier 2: the pyramid holds.
  let build = withTalents([
    { name: "Grit", tier: 1 },
    { name: "Toughened", tier: 1 },
    { name: "Dodge", tier: 2 },
  ]);
  assert.equal(derived(build).tier1, 2);
  assert.equal(derived(build).tier2, 1);
  assert.equal(derived(build).tier2_levels, 2, "a column added up over only the matching rows");
  assert.deepEqual(failures(build), []);
  // A second tier 2 talent breaks it.
  build = withTalents([
    { name: "Grit", tier: 1 },
    { name: "Toughened", tier: 1 },
    { name: "Dodge", tier: 2 },
    { name: "Parry", tier: 2 },
  ]);
  assert.deepEqual(failures(build), ["pyramid"]);
  // An empty cell reads its column's default.
  build = withTalents([{ name: "Grit" }, { name: "Quick" }]);
  assert.equal(derived(build).tier1, 2);
  assert.equal(derived(withTalents([])).tier1, 0);

  // ── The schema ──
  const ref = (listSum: Record<string, unknown>) =>
    issuesOf(fixture((doc) => (doc.sheet.derived.at(-1).of = [{ listSum }])));
  assert.match(ref({ list: "talents" }), /adds up a column or counts rows/);
  assert.match(ref({ list: "talents", column: "tier", count: true }), /adds up a column or counts rows/);
  assert.match(ref({ list: "talents", count: true, where: { column: "nope", equals: 1 } }), /no column "nope"/);
  assert.match(ref({ list: "talents", count: true, where: { column: "tier", equals: "two" } }), /never holds "two"/);
  assert.match(ref({ list: "talents", count: true, where: { column: "ranked", equals: 1 } }), /never holds 1/);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "row-counts",
    name: "Row counts",
    version: "1.0.0",
    description: "Row counts proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(204, fixture()) ?? "", /1\.205/);
  assert.equal(gate(205, fixture()), null);

  console.log("game-ruleset-row-counts: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
