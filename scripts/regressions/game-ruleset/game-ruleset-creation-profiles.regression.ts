/** Capability API 1.160: creation profiles that bring their own steps and budgets, and steps that read
 *  the sheet as the steps before another make it. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  rulesetBuilderActiveProfile,
  rulesetBuilderBuildBefore,
  rulesetBuilderInitialize,
  rulesetBuilderOptions,
  rulesetBuilderRemaining,
  rulesetBuilderSpendAction,
  rulesetBuilderSpending,
  rulesetBuilderStepVisible,
  type RulesetBuilderState,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creation-profiles-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.fields.push(
    { id: "dragon", label: "Dragon-Blooded", type: "number", min: 0, max: 1, default: 0 },
    { id: "lunar", label: "Lunar", type: "number", min: 0, max: 1, default: 0 },
    { id: "renown", label: "Renown", type: "number", min: 0, max: 10, default: 0 },
    { id: "standing", label: "Starting standing", type: "number", min: 0, max: 10 },
  );
  const feats = doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats");
  feats.entries.find((entry: { id: string }) => entry.id === "sly-strike").offeredWhen = { field: "renown" };
  doc.sheet.builder = {
    pools: [{ id: "bp", label: "Bonus points", budget: { const: 5 } }],
    profiles: [
      {
        id: "dragon",
        label: "Dragon-Blooded",
        when: { field: "dragon" },
        steps: ["dragon_gifts"],
        budgets: { bp: { const: 10 } },
      },
      { id: "lunar", label: "Lunar", when: { field: "lunar" }, steps: ["lunar_gifts"], budgets: { bp: { const: 3 } } },
    ],
    steps: [
      { id: "info", label: "Type", kind: "fields", fields: ["dragon", "lunar"], optional: ["dragon", "lunar"] },
      { id: "dragon_gifts", label: "Aspect gifts", kind: "catalog", catalog: "feats", min: 0, max: 1 },
      { id: "lunar_gifts", label: "Moon gifts", kind: "catalog", catalog: "feats", min: 0, max: 1 },
      {
        id: "train",
        label: "Training",
        kind: "spend",
        pool: "bp",
        offers: [{ id: "renown", label: "Renown", target: { field: "renown" }, min: 0, max: 10, cost: { flat: 1 } }],
      },
      { id: "honors", label: "Honors", kind: "catalog", catalog: "feats", min: 0, max: 3, reads: { before: "train" } },
      {
        id: "start",
        label: "Starting values",
        kind: "initialize",
        reads: { before: "train" },
        writes: [{ field: "standing", value: { field: "renown" } }],
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
  const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  const steps = definition.sheet.builder!.steps;
  const stepOf = (id: string) => steps.find((step) => step.id === id)!;
  let state: RulesetBuilderState = readRulesetBuilderState(undefined);
  let build: RulesetSheetBuild = defaultRulesetSheetBuild(definition);
  const apply = () => ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  const setField = (id: string, value: number) => {
    build = { ...build, fields: { ...build.fields, [id]: value } };
    apply();
  };
  const pool = () => rulesetBuilderSpending(definition, build, state, catalogs).find((each) => each.id === "bp")!;
  const buy = (times: number) => {
    for (let i = 0; i < times; i += 1) {
      state = rulesetBuilderSpendAction(definition, build, state, catalogs, "train", "renown", "buy");
      apply();
    }
  };
  apply();

  // No type yet: neither type's steps show, and the pool keeps its own budget.
  assert.equal(rulesetBuilderActiveProfile(definition, build), undefined);
  assert.equal(rulesetBuilderStepVisible(definition, stepOf("dragon_gifts"), build), false);
  assert.equal(pool().budget, 5);

  // A Dragon-Blooded gets the aspect step and its budget.
  setField("dragon", 1);
  assert.equal(rulesetBuilderActiveProfile(definition, build)?.id, "dragon");
  assert.equal(rulesetBuilderStepVisible(definition, stepOf("dragon_gifts"), build), true);
  assert.equal(rulesetBuilderStepVisible(definition, stepOf("lunar_gifts"), build), false);
  assert.equal(pool().budget, 10);
  state = { ...state, picks: { ...state.picks, dragon_gifts: ["quick-hands"] } };
  apply();
  buy(6);
  assert.equal(build.fields.renown, 6);
  assert.ok((build.lists.features ?? []).some((row) => row.name === "Quick Hands"));

  // Switching to Lunar takes away the Dragon-Blooded budget and steps, never their saved answers.
  setField("dragon", 0);
  setField("lunar", 1);
  assert.equal(rulesetBuilderActiveProfile(definition, build)?.id, "lunar");
  assert.equal(pool().budget, 3);
  assert.equal(pool().invalid, true, "6 points bought against a budget of 3");
  assert.equal(build.fields.renown, 0, "the overspent purchases stop applying");
  assert.ok(!(build.lists.features ?? []).some((row) => row.name === "Quick Hands"), "the hidden step grants nothing");
  assert.deepEqual(state.picks?.dragon_gifts, ["quick-hands"]);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).train, 1);
  // Switching back restores both.
  setField("lunar", 0);
  setField("dragon", 1);
  assert.equal(build.fields.renown, 6);
  assert.ok((build.lists.features ?? []).some((row) => row.name === "Quick Hands"));

  // Honors read the sheet before training: Renown bought there does not open Sly Strike.
  const before = rulesetBuilderBuildBefore(definition, build, state, catalogs, "train");
  assert.equal(before.fields.renown, 0);
  const honors = stepOf("honors") as Extract<(typeof steps)[number], { kind: "catalog" }>;
  const offered = (sheet: RulesetSheetBuild) =>
    rulesetBuilderOptions(definition, honors, state, catalogs, sheet).map((entry) => entry.id);
  assert.ok(!offered(build).includes("sly-strike"));
  // Renown the character already had before training counts.
  setField("renown", 8);
  assert.equal(build.fields.renown, 8);
  assert.equal(rulesetBuilderBuildBefore(definition, build, state, catalogs, "train").fields.renown, 2);
  assert.ok(offered(build).includes("sly-strike"));

  // A starting value worked out before training snapshots the pre-training number.
  const written = rulesetBuilderInitialize(definition, build, state, catalogs, "start");
  assert.equal(written.build.fields.standing, 2);

  // ── The schema ──
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.profiles[0].steps = ["missing"]))),
    /Unknown builder step "missing"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.profiles[0].budgets = { nowhere: { const: 1 } }))),
    /Unknown builder pool "nowhere"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[4].reads = { before: "missing" }))),
    /Unknown builder step "missing"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[4].reads = { before: "info" }))),
    /No step comes before the first/,
  );
  assert.match(
    issuesOf(fixture((doc) => doc.sheet.builder.profiles.push({ ...doc.sheet.builder.profiles[0] }))),
    /builder profile/,
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "creation-profiles",
    name: "Creation profiles",
    version: "1.0.0",
    description: "Creation profiles proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(159, fixture()) ?? "", /1\.160/);
  assert.equal(gate(160, fixture()), null);

  console.log("game-ruleset-creation-profiles: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
