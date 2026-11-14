/** Capability API 1.207: a spend offer whose price the source has not supplied yet shows, holds the
 *  pool up for nothing, and is never bought. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderSpendAction,
  rulesetBuilderSpending,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-unpriced-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = () => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push(
    { id: "climbing", label: "Climbing ranks", type: "number", min: 0, max: 20, default: 0 },
    { id: "swimming", label: "Swimming ranks", type: "number", min: 0, max: 20, default: 0 },
  );
  doc.sheet.builder = {
    pools: [{ id: "dp", label: "Development points", budget: { const: 10 } }],
    steps: [
      {
        id: "ranks",
        label: "Ranks",
        kind: "spend",
        pool: "dp",
        offers: [
          {
            id: "climbing",
            label: "Climbing",
            target: { field: "climbing" },
            min: 0,
            max: 20,
            cost: { unpriced: true },
          },
          { id: "swimming", label: "Swimming", target: { field: "swimming" }, min: 0, max: 20, cost: { flat: 2 } },
        ],
      },
    ],
  };
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};

try {
  const definition = parse(fixture());
  let state = readRulesetBuilderState(undefined);
  let build = applyRulesetBuilder(definition, defaultRulesetSheetBuild(definition), state, {}).build;
  const pool = () => rulesetBuilderSpending(definition, build, state, {})[0]!;
  const row = (id: string) => pool().rows.find((each) => each.offer.id === id)!;
  assert.equal(pool().invalid, false, "an unpriced offer holds nothing up");
  assert.equal(row("climbing").next, null);
  assert.equal(row("climbing").canBuy, false);
  assert.equal(rulesetBuilderSpendAction(definition, build, state, {}, "ranks", "climbing", "buy"), state);
  state = rulesetBuilderSpendAction(definition, build, state, {}, "ranks", "swimming", "buy");
  ({ build, state } = applyRulesetBuilder(definition, build, state, {}));
  assert.equal(build.fields.swimming, 1);
  assert.equal(pool().spent, 2);
  // A purchase saved under a price later taken away goes inactive, kept for repair.
  const later = parse(
    (() => {
      const doc = fixture();
      doc.sheet.builder.steps[0].offers[1].cost = { unpriced: true };
      return doc;
    })(),
  );
  const repaired = rulesetBuilderSpending(later, build, state, {})[0]!;
  assert.equal(repaired.invalid, true);
  assert.equal(repaired.rows.find((each) => each.offer.id === "swimming")!.inactive, true);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "unpriced",
    name: "Unpriced",
    version: "1.0.0",
    description: "Unpriced proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(206, fixture()) ?? "", /1\.207/);
  assert.equal(gate(207, fixture()), null);

  console.log("game-ruleset-unpriced: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
