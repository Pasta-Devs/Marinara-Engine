/** Wide sheet lists (Capability API 1.165): a list may have up to 24 columns, and more than 12 is gated. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition, supportedCapabilityApi } from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wide-lists-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 160);
  const base = JSON.parse(readFileSync(join(root, "docs/examples/rulesets/ember-roads.json"), "utf8"));
  const withColumns = (count: number) => {
    const doc = structuredClone(base);
    doc.sheet.lists.push({
      id: "wide",
      label: "Wide",
      maxItems: 10,
      columns: Array.from({ length: count }, (_, index) => ({
        id: `c${index}`,
        label: `C${index}`,
        type: "text",
        maxLength: 40,
      })),
    });
    return doc;
  };
  const parsed = (doc: unknown) => parseRulesetDefinition(doc);

  assert.ok(parsed(withColumns(12)).ok, "12 columns parse");
  const wide = parsed(withColumns(24));
  assert.ok(wide.ok, wide.ok ? "" : wide.issues.join("; "));
  assert.equal(wide.ok && wide.definition.sheet.lists.find((list) => list.id === "wide")?.columns.length, 24);
  assert.ok(!parsed(withColumns(25)).ok, "25 columns are refused");

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "ember",
    name: "Ember",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset with a sheet list of more than 12 columns requires schemaVersion 2 and capabilityApi 1.165 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(132) as never, withColumns(13)), gate);
  assert.equal(getCapabilityPackageInstallIssue(manifest(165) as never, withColumns(13)), null);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(132) as never, withColumns(12)), gate);
  console.log("Wide sheet lists: up to 24 columns, more than 12 gated at 1.165.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
