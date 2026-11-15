/** Capability API 1.214: a row or entry applied to a roll may switch off the faces that cancel
 *  successes, for exWoD specialties that keep 1s from taking successes away. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseRulesetDefinition,
  rollDicePoolCheck,
  rulesetContextualCheck,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-no-cancel-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.lists.push({
    id: "specialties",
    label: "Specialties",
    maxItems: 20,
    columns: [
      { id: "name", label: "Specialty", type: "text", maxLength: 60 },
      { id: "skill", label: "Skill", type: "text", maxLength: 60 },
    ],
    contextual: { name: "name", skill: "skill", check: { cancel: false } },
  });
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};

try {
  const definition = parse(fixture());
  const faces = (...values: number[]) => {
    let at = 0;
    return () => values[at++]!;
  };
  const roll = (cancel?: false) =>
    rollDicePoolCheck(
      definition,
      { modifier: 4, required: 1, isSave: false, ...(cancel === false ? { bought: { cancel } } : {}) },
      faces(8, 9, 1, 1),
    );
  // Two successes and two 1s: cancelled to nothing, or kept with the switch.
  assert.equal(roll().total, 0);
  assert.equal(roll(false).total, 2);

  // Merged from what was applied: any one switches it off.
  assert.deepEqual(rulesetContextualCheck([{ name: "a", source: { name: "a" }, check: { cancel: false } }]), {
    cancel: false,
  });
  assert.deepEqual(rulesetContextualCheck([{ name: "a", source: { name: "a" }, check: { dice: 1 } }]), { dice: 1 });

  // ── The schema ──
  const refused = parseRulesetDefinition(fixture((doc) => delete doc.resolution.cancel));
  assert.ok(!refused.ok && refused.issues.some((issue) => /no resolution\.cancel to switch off/.test(issue)));

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "no-cancel",
    name: "No cancel",
    version: "1.0.0",
    description: "No cancel proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(213, fixture()) ?? "", /1\.214/);
  assert.equal(gate(214, fixture()), null);

  console.log("game-ruleset-no-cancel: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
