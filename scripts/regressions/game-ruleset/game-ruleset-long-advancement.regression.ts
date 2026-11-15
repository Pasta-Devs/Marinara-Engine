/** Capability API 1.219: sheet advancement lists up to 64 fields, gated over 24. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRulesetDefinition } from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-long-advancement-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (count: number) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = `adv_${index}`;
    doc.sheet.fields.push({ id, label: `Advance ${index}`, type: "number", min: 0, max: 9, default: 0 });
    ids.push(id);
  }
  doc.sheet.advancement = { fields: ids };
  return doc;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  assert.equal(issuesOf(fixture(30)), "", "30 advancement fields parse");
  assert.equal(issuesOf(fixture(64)), "", "64 advancement fields parse");
  assert.notEqual(issuesOf(fixture(65)), "", "65 advancement fields are refused");

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "long-advancement",
    name: "Long advancement",
    version: "1.0.0",
    description: "Long advancement proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(218, fixture(30)) ?? "", /1\.219/);
  assert.equal(gate(219, fixture(30)), null);
  assert.doesNotMatch(gate(218, fixture(24)) ?? "", /1\.219/);

  console.log("game-ruleset-long-advancement: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
