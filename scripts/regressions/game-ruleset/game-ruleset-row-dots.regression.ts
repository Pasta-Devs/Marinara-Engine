/** Capability API 1.216: list rows' own ratings funded at creation. Dots on a row count against an
 *  allocation group's budget, and a rows step prices a row's dots at a rate its sheet sets, so
 *  Exalted's Craft rows take Ability dots, then BP at 1 a dot on a Favored Ability and 2 otherwise. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderAllocations,
  rulesetBuilderRowPrice,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-row-dots-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push(
    { id: "virtue", label: "Virtue", type: "number", min: 0, max: 5, default: 0 },
    { id: "favored_craft", label: "Craft is Favored", type: "number", min: 0, max: 1, default: 0 },
  );
  doc.sheet.derived.push({
    id: "affinity_craft",
    label: "Craft affinity",
    op: "sum",
    of: [{ field: "favored_craft" }],
  });
  doc.sheet.lists.push({
    id: "crafts",
    label: "Crafts",
    maxItems: 10,
    columns: [
      { id: "name", label: "Name", type: "text", maxLength: 60 },
      { id: "ability", label: "Ability", type: "enum", values: ["craft"], default: "craft" },
      { id: "dots", label: "Dots", type: "number", min: 0, max: 5, default: 0 },
      { id: "bought", label: "Bought", type: "number", min: 0, max: 5, default: 0 },
    ],
  });
  doc.sheet.builder = {
    pools: [{ id: "bp", label: "BP", budget: { const: 15 } }],
    steps: [
      {
        id: "abilities",
        label: "Abilities",
        kind: "allocate",
        groups: [
          {
            id: "dots",
            label: "Ability dots",
            targets: [{ field: "virtue" }],
            base: 0,
            min: 0,
            max: 5,
            budget: { const: 5 },
            rows: [{ list: "crafts", column: "dots" }],
          },
        ],
      },
      {
        id: "bonus",
        label: "Bonus points",
        kind: "rows",
        list: "crafts",
        pool: "bp",
        cost: {
          column: "bought",
          times: 2,
          overrides: [{ derived: { prefix: "affinity_", cell: "ability" }, times: 1 }],
        },
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
  const blank = defaultRulesetSheetBuild(definition);
  const withCrafts = (rows: Record<string, unknown>[], favored = 0): RulesetSheetBuild => ({
    ...blank,
    fields: { ...blank.fields, favored_craft: favored },
    lists: { ...blank.lists, crafts: rows },
  });
  const state = readRulesetBuilderState(undefined);
  const group = (build: RulesetSheetBuild) => rulesetBuilderAllocations(definition, build, state, {})[0]!;

  // Row dots count against the budget beside the targets'.
  let build = withCrafts([{ name: "Craft (Forge)", dots: 2 }]);
  assert.deepEqual([group(build).spent, group(build).remaining], [2, 3]);
  build = withCrafts([
    { name: "Craft (Forge)", dots: 4 },
    { name: "Craft (Air)", dots: 3 },
  ]);
  assert.equal(group(build).remaining, -2);
  assert.ok(group(build).missing >= 1, "more row dots than the budget is still to undo");
  assert.ok(group(build).rows.every((row) => !row.canAdd));

  // Each bought dot at the row's rate: 2, or 1 on a Favored Ability.
  const step = definition.sheet.builder!.steps[1] as Parameters<typeof rulesetBuilderRowPrice>[0];
  const row = { name: "Craft (Forge)", ability: "craft", bought: 3 };
  assert.equal(rulesetBuilderRowPrice(step, row, evaluateRulesetSheet(definition, withCrafts([row])).derived), 6);
  assert.equal(rulesetBuilderRowPrice(step, row, evaluateRulesetSheet(definition, withCrafts([row], 1)).derived), 3);

  // ── The schema ──
  const groupEdit = (edit: (group: Record<string, any>) => void) =>
    issuesOf(fixture((doc) => edit(doc.sheet.builder.steps[0].groups[0])));
  assert.match(
    groupEdit((each) => (each.rows = [{ list: "nope", column: "dots" }])),
    /Unknown list "nope"/,
  );
  assert.match(
    groupEdit((each) => (each.rows = [{ list: "crafts", column: "name" }])),
    /No number column "name"/,
  );
  const override = (value: Record<string, unknown>) =>
    issuesOf(fixture((doc) => Object.assign(doc.sheet.builder.steps[1].cost.overrides[0], value)));
  assert.match(override({ cost: 4 }), /a cost or a rate, exactly one/);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "row-dots",
    name: "Row dots",
    version: "1.0.0",
    description: "Row dots proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(215, fixture()) ?? "", /1\.216/);
  assert.equal(gate(216, fixture()), null);
  const rateOnly = fixture((doc) => delete doc.sheet.builder.steps[0].groups[0].rows);
  assert.match(gate(215, rateOnly) ?? "", /1\.216/, "a rate override alone is 1.216's too");

  console.log("game-ruleset-row-dots: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
