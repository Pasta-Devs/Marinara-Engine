/**
 * Conditions that change derived values (Capability API 1.662): 5e's Enhance Ability (Bull's
 * Strength), "your carrying capacity doubles".
 *
 *   - Held on the sheet, the derived value is multiplied, then added to; what reads it reads that.
 *   - Put on in a fight, the same.
 *   - Refused for an unknown derived value or a change of nothing; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-condition-derived-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 662);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (changes: unknown = { carry: { times: 2 } }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.derived.push(
      { id: "carry", label: "Carrying capacity", op: "sum", of: [{ const: 150 }] },
      { id: "push_drag", label: "Push, drag or lift", op: "scale", of: { derived: "carry" }, multiplier: 2 },
    );
    doc.sheet.live.conditions.push({ id: "bulls", label: "Bull's Strength" }, { id: "laden", label: "Laden" });
    doc.combat.conditions.push(
      { condition: "bulls", effects: [], derivedChanges: changes },
      { condition: "laden", effects: [], derivedChanges: { carry: { add: -50 } } },
    );
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
  });
  const derived = (conditions: string[], fight: string[] = []) =>
    evaluateRulesetSheetLive(definition, build, { conditions }, undefined, fight).derived;

  // ── On the sheet: doubled, and what reads it reads that ──
  assert.equal(derived([]).carry, 150);
  assert.equal(derived(["bulls"]).carry, 300);
  assert.equal(derived(["bulls"]).push_drag, 600, "read by what comes after it");
  assert.equal(derived(["bulls", "laden"]).carry, 250, "every multiplier, then every addition");
  // ── In a fight ──
  assert.equal(derived([], ["bulls"]).carry, 300);

  // ── Refused; the install gate ──
  refused(document({ nope: { times: 2 } }), /Unknown derived value "nope"/);
  refused(document({ carry: {} }), /multiplies it, adds to it, or both/);
  const gate =
    "A ruleset whose conditions change their holder's derived values (a combat condition's derivedChanges) requires schemaVersion 2 and capabilityApi 1.662 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(661) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(662) as never, document()), gate);

  console.log("Bull's Strength: a condition doubles a derived value, read by everything after it; gated at 1.662.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
