/**
 * More senses (Capability API 1.743): up to 12 in `combat.senses`, 8 before. 5e's Ring of X-ray
 * Vision is its ninth.
 *
 *   - A ruleset takes 12 senses; a 13th is refused.
 *   - The install gate on more than 8.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition, supportedCapabilityApi } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-senses-twelve-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 743);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (count: number) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = Array.from({ length: count }, (_, index) => ({
      id: `sense_${index}`,
      label: `Sense ${index}`,
    }));
    return doc;
  };

  // ── Twelve fit, thirteen do not ──
  assert.equal(parseRulesetDefinition(document(12)).ok, true);
  assert.equal(parseRulesetDefinition(document(13)).ok, false);

  // ── The install gate ──
  const gate =
    "A ruleset with more than 8 senses (combat.senses) requires schemaVersion 2 and capabilityApi 1.743 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(742) as never, document(9)), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(743) as never, document(9)), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(742) as never, document(8)), gate);

  console.log("Senses twelve: a ruleset takes up to 12 senses, 8 before; gated at 1.743.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
