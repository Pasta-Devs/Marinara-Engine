/**
 * Rests that do nothing (Capability API 1.722): a rakshasa's curse.
 *
 *   - While the sheet holds a condition with `blocksRests`, the rests it names (or all) do nothing,
 *     and say so; other rests, and the same rest without it, do as always.
 *   - Import refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-blocks-rests-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 722);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (blocks: unknown = "all"): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "cursed", label: "Cursed" });
    doc.combat.conditions.push({ condition: "cursed", effects: [], blocksRests: blocks });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
  });
  const rest = (definition: RulesetDefinition, which: string, cursed: boolean) => {
    const stored = {
      pools: { hp: { value: 5 } },
      tracks: { exhaustion: 2 },
      ...(cursed ? { conditions: ["cursed"] } : {}),
    };
    const result = applyRulesetSheetOp(definition, build, stored, { op: "rest", rest: which });
    assert.ok(result.ok, JSON.stringify(result));
    const live = readRulesetLive(definition, build, result.live);
    return {
      now: result.now,
      hp: live.pools.find((pool) => pool.key === "hp")!.value,
      exhaustion: live.tracks.find((track) => track.id === "exhaustion")!.value,
    };
  };

  // ── Cursed: a long rest does nothing, and says so ──
  {
    const definition = parsed(fiveE());
    const barred = rest(definition, "long", true);
    assert.deepEqual([barred.hp, barred.exhaustion], [5, 2]);
    assert.equal(barred.now, "Long rest: no benefit while Cursed");
    const free = rest(definition, "long", false);
    assert.deepEqual([free.hp, free.exhaustion], [20, 1]);
  }

  // ── Only the rests it names ──
  {
    const definition = parsed(fiveE(["short"]));
    assert.equal(rest(definition, "long", true).hp, 20, "a long rest still heals");
    assert.match(rest(definition, "short", true).now, /Short rest: no benefit while Cursed/);
  }

  // ── Refusals and the install gate ──
  {
    refused(fiveE(["nap"]), /Unknown rest "nap"/);
    refused(fiveE([]), /blocksRests/);
    const gate =
      "A ruleset with a condition that bars rests (combat.conditions[].blocksRests) requires schemaVersion 2 and capabilityApi 1.722 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(721) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(722) as never, fiveE()), gate);
  }

  console.log("Rests barred: cursed, a long rest does nothing and says so; only the rests named; gated at 1.722.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
