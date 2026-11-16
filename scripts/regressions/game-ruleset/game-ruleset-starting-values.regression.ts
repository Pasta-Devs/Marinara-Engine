/** Capability API 1.158: starting values set once on the player's word, and live pools or tracks that
 *  start at a value read off the sheet. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetBuilderState,
  readRulesetLive,
  rulesetBuilderInitialize,
  rulesetBuilderInitializePreview,
  rulesetBuilderRemaining,
  rulesetBuilderSpendAction,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-starting-values-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const emberText = readFileSync(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(emberText) as Record<string, any>;
  doc.sheet.fields.push(
    { id: "pow", label: "Power", type: "number", min: 0, max: 99, default: 0 },
    { id: "san_start", label: "Starting Sanity", type: "number", min: 0, max: 99 },
    { id: "edge", label: "Edge", type: "number", min: 0, max: 10, default: 0 },
    { id: "xp", label: "Experience", type: "number", min: 0, max: 500 },
    { id: "omen", label: "Omen", type: "text", maxLength: 40 },
  );
  doc.sheet.live.pools.push({ id: "sanity", label: "Sanity", max: { const: 99 }, startFrom: { field: "san_start" } });
  doc.sheet.live.tracks[0].startFrom = { field: "edge" };
  doc.sheet.builder = {
    pools: [{ id: "points", label: "Points", budget: { const: 10 } }],
    steps: [
      { id: "info", label: "Info", kind: "fields", fields: ["pow"] },
      {
        id: "buy",
        label: "Buy",
        kind: "spend",
        pool: "points",
        offers: [{ id: "edge", label: "Edge", target: { field: "edge" }, min: 0, max: 10, cost: { flat: 3 } }],
      },
      {
        id: "start",
        label: "Starting values",
        kind: "initialize",
        writes: [
          { field: "san_start", value: { field: "pow" } },
          { field: "xp", remaining: "points" },
          { field: "omen", value: "A black dog" },
        ],
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
  const catalogs = {};
  let state = readRulesetBuilderState(undefined);
  let build: RulesetSheetBuild = {
    ...defaultRulesetSheetBuild(definition),
    fields: { ...defaultRulesetSheetBuild(definition).fields, pow: 60 },
  };
  ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  state = rulesetBuilderSpendAction(definition, build, state, catalogs, "buy", "edge", "buy");
  ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  assert.equal(build.fields.edge, 1);

  // Waiting on the player's word: the badge counts it, and the preview writes nothing.
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).start, 1);
  const preview = rulesetBuilderInitializePreview(definition, build, state, catalogs, "start")!;
  assert.deepEqual(
    preview.rows.map((row) => [row.field, row.now, row.next]),
    [
      ["san_start", 0, 60],
      ["xp", 0, 7],
      ["omen", "", "A black dog"],
    ],
  );
  assert.equal(preview.done, false);
  assert.equal(build.fields.san_start, 0);

  // Set once: POW 60 starts Sanity at 60 and the 7 points left over become experience.
  ({ build, state } = rulesetBuilderInitialize(definition, build, state, catalogs, "start"));
  assert.equal(build.fields.san_start, 60);
  assert.equal(build.fields.xp, 7);
  assert.equal(rulesetBuilderRemaining(definition, build, state, catalogs).start, 0);
  assert.deepEqual(state.initialized?.start, { san_start: 60, xp: 7, omen: "A black dog" });
  // It survives the envelope, and running the builder again never rewrites it.
  state = readRulesetBuilderState({ builder: JSON.parse(JSON.stringify(state)) });
  ({ build, state } = applyRulesetBuilder(definition, build, state, catalogs));
  assert.equal(build.fields.san_start, 60);

  const sanity = (stored: unknown, sheet = build) =>
    readRulesetLive(definition, sheet, stored).pools.find((pool) => pool.key === "sanity")!.value;
  assert.equal(sanity(undefined), 60);
  // Heat starts at Edge, read off the sheet.
  assert.equal(readRulesetLive(definition, build, undefined).tracks.find((track) => track.id === "heat")!.value, 1);

  // Played down to 42, it stays at 42 however the sheet changes after.
  const spent = applyRulesetSheetOp(definition, build, undefined, { op: "spend", pool: "sanity", amount: 18 });
  assert.ok(spent.ok);
  assert.deepEqual(spent.live.pools?.sanity, { value: 42 });
  const later = { ...build, fields: { ...build.fields, pow: 75 } };
  assert.equal(sanity(spent.live, later), 42);

  // Reopening after POW changes shows what setting again would replace, and never does it itself.
  ({ build, state } = applyRulesetBuilder(definition, later, state, catalogs));
  const changed = rulesetBuilderInitializePreview(definition, build, state, catalogs, "start")!;
  assert.equal(changed.done, true);
  assert.equal(changed.changed, true);
  assert.deepEqual(
    changed.rows.map((row) => [row.field, row.written, row.next]),
    [
      ["san_start", 60, 75],
      ["xp", 7, 7],
      ["omen", "A black dog", "A black dog"],
    ],
  );
  assert.equal(build.fields.san_start, 60);
  assert.equal(sanity(undefined), 60);
  // Setting again is the player's explicit choice.
  const again = rulesetBuilderInitialize(definition, build, state, catalogs, "start");
  assert.equal(again.build.fields.san_start, 75);
  assert.equal(sanity(spent.live, again.build), 42, "played state is never overwritten");

  // A character described as it already is never gets written to.
  const described = rulesetBuilderInitialize(
    definition,
    defaultRulesetSheetBuild(definition),
    { describing: true },
    catalogs,
    "start",
  );
  assert.equal(described.build.fields.san_start, 0);
  assert.equal(described.state.initialized, undefined);
  assert.equal(rulesetBuilderRemaining(definition, described.build, { describing: true }, catalogs).start, 0);

  // A start read off the sheet is held to the pool's own maximum and floor.
  const high = { ...build, fields: { ...build.fields, san_start: 99 } };
  assert.equal(sanity(undefined, high), 99);
  // Back at its start, a played value drops out of the store again.
  const healed = applyRulesetSheetOp(definition, build, spent.live, { op: "restore", pool: "sanity", amount: 18 });
  assert.ok(healed.ok);
  assert.equal(healed.live.pools?.sanity, undefined);

  // ── The schema ──
  const broken = (write: Record<string, unknown>) =>
    issuesOf(fixture((doc) => (doc.sheet.builder.steps[2].writes = [write])));
  assert.match(broken({ field: "missing", value: 1 }), /Unknown field "missing"/);
  assert.match(broken({ field: "xp", remaining: "missing" }), /Unknown builder pool "missing"/);
  assert.match(broken({ field: "omen", value: { field: "pow" } }), /"omen" is not a number field/);
  assert.match(broken({ field: "xp", value: "lots" }), /"xp" takes a number value/);
  assert.match(broken({ field: "xp", value: 1, remaining: "points" }), /value or remaining, not both/);
  assert.match(
    issuesOf(fixture((doc) => doc.sheet.builder.steps[2].writes.push({ field: "xp", value: 3 }))),
    /"xp" is written twice/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.sheet.live.tracks[1].startFrom = { field: "edge" }))),
    /A wound track starts unmarked/,
  );
  assert.match(issuesOf(fixture((doc) => (doc.sheet.live.pools[2].startFrom = { field: "nowhere" }))), /nowhere/);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "starting-values",
    name: "Starting values",
    version: "1.0.0",
    description: "Starting values proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(157, fixture()) ?? "", /1\.158/);
  assert.equal(gate(158, fixture()), null);
  const poolOnly = fixture((doc) => {
    doc.sheet.builder.steps.pop();
  });
  assert.match(gate(157, poolOnly) ?? "", /1\.158/, "a pool that starts at a sheet value counts");

  console.log("game-ruleset-starting-values: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
