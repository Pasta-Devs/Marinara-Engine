/**
 * A rest that gives back one named row's pool, and only while a value off the sheet says so
 * (Capability API 1.434).
 *
 *   - Sorcerous Restoration: a short rest gives a 20th-level sorcerer 4 spent sorcery points back,
 *     never past the most, and a 19th-level one nothing; another counter on the same list is left be.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rest-rows-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 434);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const restoration = {
    listPools: "counters",
    row: "sorcery points",
    by: { const: 4 },
    when: { value: { field: "level" }, atLeast: 20 },
  };
  const document = (step: Record<string, unknown> = restoration) => {
    const doc = JSON.parse(fiveEText);
    doc.rests.find((rest: { id: string }) => rest.id === "short").restore.push(step);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const sorcerer = (level: number) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
      fields: { level, ac: 12, speed: 30, hp_max: 100, spellcasting_ability: "cha" },
      lists: {
        counters: [
          { name: "Sorcery Points", max: 20, recharge: "long" },
          { name: "Luck", max: 5, recharge: "long" },
        ],
      },
    });
  const apply = (build: ReturnType<typeof sorcerer>, live: unknown, op: Record<string, unknown>) => {
    const result = applyRulesetSheetOp(definition, build, live as never, op as never);
    assert.ok(result.ok, JSON.stringify(result));
    return result.live;
  };
  const left = (build: ReturnType<typeof sorcerer>, live: unknown, label: string) =>
    readRulesetLive(definition, build, live as never).pools.find((pool) => pool.label === label)!.value;
  const spentDown = (build: ReturnType<typeof sorcerer>) => {
    let live = apply(build, undefined, { op: "spend", pool: "Sorcery Points", amount: 10 });
    live = apply(build, live, { op: "spend", pool: "Luck", amount: 2 });
    return live;
  };

  // ── 20th level: 4 back on a short rest, the other counter left be ──
  {
    const build = sorcerer(20);
    let live = spentDown(build);
    live = apply(build, live, { op: "rest", rest: "short" });
    assert.equal(left(build, live, "Sorcery Points"), 14);
    assert.equal(left(build, live, "Luck"), 3, "only the named row");
    // Never past the most.
    for (let index = 0; index < 3; index++) live = apply(build, live, { op: "rest", rest: "short" });
    assert.equal(left(build, live, "Sorcery Points"), 20);
  }

  // ── 19th level: nothing ──
  {
    const build = sorcerer(19);
    let live = spentDown(build);
    live = apply(build, live, { op: "rest", rest: "short" });
    assert.equal(left(build, live, "Sorcery Points"), 10);
  }

  // ── Refusals ──
  refused(document({ pool: "hp", row: "x", to: "max" }), /"row" only narrows listPools/);
  refused(document({ ...restoration, when: { value: { field: "no_such_field" }, atLeast: 20 } }), /no_such_field/);
  refused(document({ ...restoration, when: { value: { field: "level" } } }), /"when" says at least one of/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose rests give back one named row's pool (row) or only while a value off the sheet says so (when) requires schemaVersion 2 and capabilityApi 1.434 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(433) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(434) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(433) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Rest rows: a short rest gives a 20th-level sorcerer 4 sorcery points back, up to the most, a 19th-level one nothing, and leaves another counter be; gated at 1.434.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
