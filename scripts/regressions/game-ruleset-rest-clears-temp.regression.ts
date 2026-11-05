/**
 * A rest that clears temporary points (Capability API 1.804).
 *
 *   - A long rest with `clear.temp` takes temporary hit points away and says so; one without leaves
 *     them be (laptop playtest 2026-10-25: temporary hit points kept past a long rest).
 *   - The install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rest-temp-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 804);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (clears: boolean) => {
    const doc = JSON.parse(fiveEText);
    if (clears) {
      const long = doc.rests.find((rest: { id: string }) => rest.id === "long");
      long.clear = { ...long.clear, temp: true };
    }
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 24 },
  });
  const rested = (definition: RulesetDefinition, rest: string) => {
    const hurt = applyRulesetSheetOp(definition, build, undefined, { op: "damage", pool: "hp", amount: 5 });
    assert.ok(hurt.ok, JSON.stringify(hurt));
    const buffered = applyRulesetSheetOp(definition, build, hurt.live, { op: "temp", pool: "hp", amount: 8 });
    assert.ok(buffered.ok, JSON.stringify(buffered));
    const after = applyRulesetSheetOp(definition, build, buffered.live, { op: "rest", rest });
    assert.ok(after.ok, JSON.stringify(after));
    const hp = readRulesetLive(definition, build, after.live).pools.find((pool) => pool.key === "hp")!;
    return { hp, now: after.now };
  };

  // ── A long rest that clears them ──
  {
    const definition = parsed(document(true));
    const long = rested(definition, "long");
    assert.equal(long.hp.temp, 0, "no temporary hit points after a long rest");
    assert.equal(long.hp.value, long.hp.max, "and its own restores still happen");
    assert.match(long.now, /temporary points gone/);
    // A short rest has no `clear.temp`, so they stay.
    const short = rested(definition, "short");
    assert.equal(short.hp.temp, 8);
    assert.doesNotMatch(short.now, /temporary/);
  }

  // ── A rest without it leaves them be, as before ──
  {
    const long = rested(parsed(document(false)), "long");
    assert.equal(long.hp.temp, 8);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose rest clears temporary points (clear.temp) requires schemaVersion 2 and capabilityApi 1.804 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(803) as never, document(true)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(804) as never, document(true)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(803) as never, document(false)), gate);
  }

  console.log(
    "Rest clears temp: a long rest with clear.temp takes temporary hit points away and says so, a short rest and a rest without it leave them; gated at 1.804.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
