/**
 * Words a text field offers to pick (Capability API 1.796, laptop class builds 2026-10-24): a
 * `type: "text"` field or list column's `suggestions`, shown as chips under it, the field still typed
 * in freely. A ranger's favored enemies out of the creature types.
 *
 *   - Read and kept; refused empty or past 40.
 *   - Gated at 1.796.
 *   - How many to pick (1.797), `pick`, read off the sheet: kept, gated at 1.797.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-text-suggestions-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const ember = (suggestions?: unknown): Record<string, any> => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    if (suggestions !== undefined)
      doc.sheet.fields.find((field: { id: string }) => field.id === "calling").suggestions = suggestions;
    return doc;
  };
  const words = ["Drover", "Tinker", "Road warden"];
  const read = parseRulesetDefinition(ember(words));
  assert.ok(read.ok, read.ok ? "" : read.issues.join("; "));
  const calling = read.definition.sheet.fields.find((field) => field.id === "calling");
  assert.deepEqual(calling?.type === "text" ? calling.suggestions : undefined, words);
  assert.equal(parseRulesetDefinition(ember([])).ok, false, "an empty list says nothing");
  assert.equal(
    parseRulesetDefinition(ember(Array.from({ length: 41 }, (_, index) => `w${index}`))).ok,
    false,
    "no more than 40",
  );

  const gate =
    "A ruleset whose text fields offer words to pick (a text field's suggestions) requires schemaVersion 2 and capabilityApi 1.796 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(795) as never, ember(words)), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(796) as never, ember(words)), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(795) as never, ember()), gate);

  // How many to pick (1.797), read off the sheet: kept, and gated on its own.
  const picking = ember(words);
  picking.sheet.fields.find((field: { id: string }) => field.id === "calling").pick = { const: 2 };
  const picked = parseRulesetDefinition(picking);
  assert.ok(picked.ok, picked.ok ? "" : picked.issues.join("; "));
  const pickField = picked.definition.sheet.fields.find((field) => field.id === "calling");
  assert.deepEqual(pickField?.type === "text" ? pickField.pick : undefined, { const: 2 });
  const pickGate =
    "A ruleset whose text fields say how many words to pick (a text field's pick) requires schemaVersion 2 and capabilityApi 1.797 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(796) as never, picking), pickGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(797) as never, picking), pickGate);

  console.info("Text suggestions: read and kept, refused empty or past 40, gated at 1.796; pick at 1.797.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
