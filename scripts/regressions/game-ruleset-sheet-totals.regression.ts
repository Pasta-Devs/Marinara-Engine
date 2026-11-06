/**
 * Number fields held to a combined most (Capability API 1.672).
 *
 *   - `sheet.totals`: each field's most is lowered by what the others hold, never below its least.
 *   - The Game Master's advancement refuses a value past it, and takes one within it.
 *   - A sheet over it says so; one within it says nothing.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetFieldMax,
  rulesetSheetTotalsOver,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sheet-totals-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const source = readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(source);
    doc.sheet.fields.push(
      { id: "level_fighter", label: "Fighter levels", type: "number", min: 0, max: 20 },
      { id: "level_wizard", label: "Wizard levels", type: "number", min: 0, max: 20 },
      { id: "level_rogue", label: "Rogue levels", type: "number", min: 0, max: 20, default: 1 },
      { id: "note", label: "Note", type: "text", maxLength: 40 },
    );
    doc.sheet.totals = [{ fields: ["level_fighter", "level_wizard", "level_rogue"], max: 20, label: "Class levels" }];
    doc.sheet.advancement = { fields: ["level_fighter", "level_wizard", "level_rogue"] };
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const build = (fields: Record<string, number>): RulesetSheetBuild => {
    const out = defaultRulesetSheetBuild(definition);
    out.fields = { ...out.fields, ...fields };
    return out;
  };

  // ── Each field's most, less what the others hold ──
  {
    const sheet = build({ level_fighter: 12, level_wizard: 5 });
    // The rogue's default 1 counts too.
    assert.equal(rulesetFieldMax(definition, sheet, "level_fighter"), 14);
    assert.equal(rulesetFieldMax(definition, sheet, "level_wizard"), 7);
    assert.equal(rulesetFieldMax(definition, sheet, "level_rogue"), 3);
    // Never below its least, however far over the others are.
    assert.equal(rulesetFieldMax(definition, build({ level_fighter: 20, level_wizard: 20 }), "level_rogue"), 0);
    assert.deepEqual(rulesetSheetTotalsOver(definition, sheet), []);
  }

  // ── Advancement: within it, and past it ──
  {
    const sheet = build({ level_fighter: 12, level_wizard: 5 });
    const up = applyRulesetSheetOp(definition, sheet, {}, { op: "advance", field: "level_wizard", by: 2 });
    assert.equal(up.ok, true, JSON.stringify(up));
    const past = applyRulesetSheetOp(definition, sheet, {}, { op: "advance", field: "level_wizard", by: 3 });
    assert.equal(past.ok, false);
    if (!past.ok) assert.match(past.reason, /bad-amount: integer 0 to 7/);
    const to = applyRulesetSheetOp(definition, sheet, {}, { op: "advance", field: "level_fighter", to: 15 });
    assert.equal(to.ok, false, "15 + 5 + 1 is over 20");
  }

  // ── A sheet over it says so ──
  assert.deepEqual(rulesetSheetTotalsOver(definition, build({ level_fighter: 15, level_wizard: 10 })), [
    { label: "Class levels", total: 26, max: 20 },
  ]);

  // ── Refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(document(edit));
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok) assert.match(result.issues.join("; "), pattern);
    };
    refused((doc) => (doc.sheet.totals[0].fields = ["level_fighter", "nosuch"]), /Unknown total field "nosuch"/);
    refused((doc) => (doc.sheet.totals[0].fields = ["level_fighter", "note"]), /Total field "note" must be a number/);
    refused(
      (doc) => (doc.sheet.totals[0].fields = ["level_fighter", "level_fighter"]),
      /"level_fighter" is named twice/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose sheet holds fields to a combined most (sheet.totals) requires schemaVersion 2 and capabilityApi 1.672 or newer";
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
    const plain = document((doc) => delete doc.sheet.totals);
    assert.equal(getCapabilityPackageInstallIssue(manifest(671) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(672) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(671) as never, plain), gate);
  }

  console.log(
    "Sheet totals: each field's most less what the others hold, advancement refused past it, a sheet over it says so; gated at 1.672.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
