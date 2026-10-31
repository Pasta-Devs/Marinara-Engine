/**
 * A derived value read from the words of a text field (Capability API 1.690): 5e's alignment,
 * written freely, as a number a creature's rules can read.
 *
 *   - "Lawful Good" reads `good`; "chaotic evil" reads `evil`; a field naming none reads `default`.
 *   - Whole words only, ignoring case: "Goodly" is not "good".
 *   - The first word of the table the field names wins.
 *   - Refused on a field that is not text, an unknown field, and more than 40 words.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  supportedCapabilityApi,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-words-table-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 690);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const withTable = (from: string, table: Record<string, number>) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.derived.push({
      id: "moral_axis",
      label: "Moral axis",
      op: "wordsTable",
      from: { field: from },
      table,
      default: 0,
    });
    return doc;
  };
  const table = { good: 1, evil: -1, "lawful neutral": 5 };
  const parsed = parseRulesetDefinition(withTable("alignment", table));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const read = (alignment: string) => {
    const build = defaultRulesetSheetBuild(definition);
    build.fields.alignment = alignment;
    return evaluateRulesetSheet(definition, build).derived.moral_axis;
  };
  assert.equal(read("Lawful Good"), 1);
  assert.equal(read("chaotic EVIL"), -1);
  assert.equal(read("True Neutral"), 0, "naming none reads the default");
  assert.equal(read("Goodly"), 0, "whole words only");
  assert.equal(read("Lawful   Neutral"), 5, "a phrase across spaces");
  assert.equal(read("evil, mostly good"), 1, "the first word of the table wins");
  assert.equal(read(""), 0);

  const enumField = JSON.parse(fiveEText) as Record<string, any>;
  const notText = enumField.sheet.fields.find((field: { type: string }) => field.type === "number");
  assert.ok(notText, "the example has a number field");
  const refusedType = parseRulesetDefinition(withTable(notText.id, table));
  assert.equal(refusedType.ok, false);
  assert.match(refusedType.ok ? "" : refusedType.issues.join("; "), /is not text/);
  const unknown = parseRulesetDefinition(withTable("nowhere", table));
  assert.equal(unknown.ok, false);
  assert.match(unknown.ok ? "" : unknown.issues.join("; "), /Unknown field "nowhere"/);
  const many = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`word${index}`, index]));
  assert.equal(parseRulesetDefinition(withTable("alignment", many)).ok, false, "41 words are too many");

  {
    const gate =
      "A ruleset with a derived value read from the words of a text field (derived op wordsTable) requires schemaVersion 2 and capabilityApi 1.690 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(689) as never, withTable("alignment", table)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(690) as never, withTable("alignment", table)), gate);
  }

  console.log("Words table: alignment read as whole words, first match wins, default otherwise; gated at 1.690.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
