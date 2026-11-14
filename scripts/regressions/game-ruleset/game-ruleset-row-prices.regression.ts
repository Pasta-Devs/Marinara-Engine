/** Capability API 1.206: a row's price worked out from the row: a column scaled and offset (a talent
 *  at 5 XP a tier), and a cheaper price when a derived value named by the row's cell reads above 0
 *  (a Charm of a Caste or Favored Ability). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderRowPrice,
  rulesetBuilderSpending,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-row-prices-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push({ id: "favored_melee", label: "Melee is Favored", type: "number", min: 0, max: 1, default: 0 });
  doc.sheet.derived.push(
    {
      id: "affinity_melee",
      label: "Melee affinity",
      op: "sum",
      of: [{ field: "favored_melee" }],
    },
    { id: "affinity_sail", label: "Sail affinity", op: "sum", of: [{ const: 0 }] },
  );
  doc.sheet.lists.push(
    {
      id: "charms",
      label: "Charms",
      maxItems: 20,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "ability", label: "Ability", type: "enum", values: ["melee", "sail"], default: "melee" },
      ],
    },
    {
      id: "talents",
      label: "Talents",
      maxItems: 20,
      columns: [
        { id: "name", label: "Name", type: "text", maxLength: 80 },
        { id: "tier", label: "Tier", type: "number", min: 1, max: 5, default: 1 },
      ],
    },
  );
  doc.sheet.builder = {
    pools: [{ id: "xp", label: "XP", budget: { const: 40 } }],
    steps: [
      {
        id: "charms",
        label: "Charms",
        kind: "rows",
        list: "charms",
        pool: "xp",
        cost: { add: 5, overrides: [{ derived: { prefix: "affinity_", cell: "ability" }, cost: 4 }] },
      },
      {
        id: "talents",
        label: "Talents",
        kind: "rows",
        list: "talents",
        pool: "xp",
        cost: { column: "tier", times: 5 },
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
  const state = readRulesetBuilderState(undefined);
  const priced = (fields: Record<string, unknown>, lists: Record<string, unknown[]>) => {
    let build = {
      ...blank,
      fields: { ...blank.fields, ...fields },
      lists: { ...blank.lists, ...lists },
    } as RulesetSheetBuild;
    build = applyRulesetBuilder(definition, build, state, {}).build;
    return rulesetBuilderSpending(definition, build, state, {})[0]!;
  };
  const talents = [
    { name: "Grit", tier: 1 },
    { name: "Dodge", tier: 2 },
  ];
  const charms = [
    { name: "Excellent Strike", ability: "melee" },
    { name: "Wind-Reading", ability: "sail" },
  ];

  // A talent costs 5 XP a tier.
  let pool = priced({}, { talents });
  assert.deepEqual(
    pool.priced.map((item) => item.cost),
    [5, 10],
  );
  // A Charm costs 5, and 4 when its Ability is Favored.
  pool = priced({}, { charms });
  assert.deepEqual(
    pool.priced.map((item) => item.cost),
    [5, 5],
  );
  pool = priced({ favored_melee: 1 }, { charms, talents });
  assert.deepEqual(
    pool.priced.map((item) => [item.label, item.cost]),
    [
      ["Excellent Strike", 4],
      ["Wind-Reading", 5],
      ["Grit", 5],
      ["Dodge", 10],
    ],
  );
  assert.equal(pool.spent, 24);
  // The same price shows beside the row.
  const step = definition.sheet.builder!.steps[0] as Parameters<typeof rulesetBuilderRowPrice>[0];
  const favored = { ...blank, fields: { ...blank.fields, favored_melee: 1 } } as RulesetSheetBuild;
  assert.equal(rulesetBuilderRowPrice(step, charms[0]!, evaluateRulesetSheet(definition, favored).derived), 4);
  assert.equal(rulesetBuilderRowPrice(step, charms[0]!), 5, "without the sheet, the plain price");

  // ── The schema ──
  const cost = (index: number, value: unknown) =>
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[index].cost = value)));
  assert.match(cost(1, {}), /names a column, an amount or overrides/);
  assert.match(cost(1, { add: 1, times: 2 }), /times scales a column/);
  assert.match(cost(1, { column: "name" }), /No number column "name"/);
  assert.match(
    cost(0, { add: 5, overrides: [{ derived: { prefix: "nope_", cell: "ability" }, cost: 4 }] }),
    /No derived value "nope_melee"/,
  );
  assert.match(
    cost(0, { add: 5, overrides: [{ derived: { prefix: "affinity_", cell: "nope" }, cost: 4 }] }),
    /no column "nope"/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "row-prices",
    name: "Row prices",
    version: "1.0.0",
    description: "Row prices proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(205, fixture()) ?? "", /1\.206/);
  assert.equal(gate(206, fixture()), null);
  const scaledOnly = fixture((doc) => doc.sheet.builder.steps.shift());
  assert.match(gate(205, scaledOnly) ?? "", /1\.206/);
  const plain = fixture((doc) => {
    doc.sheet.builder.steps.shift();
    doc.sheet.builder.steps[0].cost = { column: "tier" };
  });
  assert.equal(gate(159, plain), null, "a plain column price stays 1.159");

  console.log("game-ruleset-row-prices: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
