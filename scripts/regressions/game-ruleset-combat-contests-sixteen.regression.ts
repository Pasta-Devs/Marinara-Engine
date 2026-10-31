/**
 * Up to 16 contests (Capability API 1.597): 5e's Arcane Hand gets a grasp of its own.
 *
 *   - Sixteen parse and are offered; seventeen are refused.
 *   - The install gate, at more than twelve.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition, supportedCapabilityApi } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-contests-sixteen-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 597);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const withContests = (count: number) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const first = doc.combat.contests[0];
    const kept = doc.combat.contests.length;
    for (let index = kept; index < count; index++) {
      doc.combat.contests.push({ ...structuredClone(first), id: `grasp_${index}`, label: `Grasp ${index}` });
    }
    doc.combat.contests = doc.combat.contests.slice(0, count);
    delete doc.combat.contests.at(-1).$comment;
    return doc;
  };
  const sixteen = parseRulesetDefinition(withContests(16));
  assert.ok(sixteen.ok, sixteen.ok ? "" : sixteen.issues.join("; "));
  assert.equal(sixteen.definition.combat!.contests!.length, 16);
  const seventeen = parseRulesetDefinition(withContests(17));
  assert.equal(seventeen.ok, false, "seventeen is too many");

  {
    const gate = "A ruleset with more than 12 contests requires schemaVersion 2 and capabilityApi 1.597 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(596) as never, withContests(13)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(596) as never, withContests(12)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(597) as never, withContests(16)), gate);
  }

  console.log("Sixteen contests: parsed, seventeen refused; more than twelve gated at 1.597.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
