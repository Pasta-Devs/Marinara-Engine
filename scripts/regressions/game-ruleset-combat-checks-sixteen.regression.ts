/**
 * Up to 16 combat checks (Capability API 1.686): 5e's thieves' tools beside its skills.
 *
 *   - Sixteen parse; seventeen are refused.
 *   - The install gate, at more than twelve.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition, supportedCapabilityApi } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-checks-sixteen-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 686);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const withChecks = (count: number) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const first = doc.combat.checks[0];
    for (let index = doc.combat.checks.length; index < count; index++) {
      const copy = structuredClone(first);
      delete copy.$comment;
      doc.combat.checks.push({ ...copy, id: `tools_${index}`, label: `Tools ${index}` });
    }
    doc.combat.checks = doc.combat.checks.slice(0, count);
    return doc;
  };
  const sixteen = parseRulesetDefinition(withChecks(16));
  assert.ok(sixteen.ok, sixteen.ok ? "" : sixteen.issues.join("; "));
  assert.equal(sixteen.definition.combat!.checks!.length, 16);
  const seventeen = parseRulesetDefinition(withChecks(17));
  assert.equal(seventeen.ok, false, "seventeen is too many");

  {
    const gate = "A ruleset with more than 12 combat checks requires schemaVersion 2 and capabilityApi 1.686 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(685) as never, withChecks(13)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(685) as never, withChecks(12)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(686) as never, withChecks(16)), gate);
  }

  console.log("Sixteen combat checks: parsed, seventeen refused; more than twelve gated at 1.686.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
