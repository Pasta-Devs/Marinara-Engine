/** Capability API 1.208: a sheet may declare up to 240 fields (160 before it). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RULESET_FIELDS_MAX,
  RULESET_FIELDS_MAX_BEFORE_1203,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-more-fields-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8");
const withFields = (count: number) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  while (doc.sheet.fields.length < count)
    doc.sheet.fields.push({
      id: `potential_${doc.sheet.fields.length}`,
      label: `Potential ${doc.sheet.fields.length}`,
      type: "number",
      min: 0,
      max: 101,
      default: 0,
    });
  return doc;
};

try {
  assert.equal(RULESET_FIELDS_MAX, 240);
  assert.equal(RULESET_FIELDS_MAX_BEFORE_1203, 160);
  const parsed = parseRulesetDefinition(withFields(240));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  assert.equal(Object.keys(defaultRulesetSheetBuild(parsed.definition).fields).length, 240);
  assert.equal(parseRulesetDefinition(withFields(241)).ok, false);

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "more-fields",
    name: "More fields",
    version: "1.0.0",
    description: "More fields proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(207, withFields(161)) ?? "", /1\.208/);
  assert.equal(gate(207, withFields(160)), null);
  assert.equal(gate(208, withFields(240)), null);

  console.log("game-ruleset-more-fields: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
