/** Capability API 1.213: a row applied by name whose skill cell names an ability, so a World of
 *  Darkness attribute specialty ("Strength: lifting") applies to any check rolled with Strength. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetContextualItems,
  type RulesetCheckTarget,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ability-specialties-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.sheet.lists.push({
    id: "specialties",
    label: "Specialties",
    maxItems: 20,
    columns: [
      { id: "name", label: "Specialty", type: "text", maxLength: 60 },
      { id: "skill", label: "Trait", type: "text", maxLength: 60 },
      { id: "bonus", label: "Bonus", type: "number", min: 0, max: 5, default: 1 },
    ],
    contextual: { name: "name", skill: "skill", bonus: "bonus", abilities: true },
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
  const blank = defaultRulesetSheetBuild(definition);
  const build: RulesetSheetBuild = {
    ...blank,
    lists: {
      ...blank.lists,
      specialties: [
        { name: "lifting", skill: "Strength", bonus: 2 },
        { name: "climbing", skill: "Athletics", bonus: 1 },
      ],
    },
  };
  const applied = (definitionUsed: RulesetDefinition, name: string, target: RulesetCheckTarget) =>
    rulesetContextualItems(definitionUsed, build, {}, [name], target).map((item) => item.name);
  const strength: RulesetCheckTarget = { type: "ability", id: "str", label: "Strength" };
  const athletics: RulesetCheckTarget = { type: "skill", id: "athletics", label: "Athletics", ability: "str" };
  const stealth: RulesetCheckTarget = { type: "skill", id: "stealth", label: "Stealth", ability: "dex" };
  const stealthWithStr: RulesetCheckTarget = { ...stealth, withAbility: "str" };
  const dexterity: RulesetCheckTarget = { type: "ability", id: "dex", label: "Dexterity" };

  // A raw Strength check, a skill rolled with Strength, and one swapped to Strength by `with=`.
  assert.deepEqual(applied(definition, "lifting", strength), ["lifting"]);
  assert.deepEqual(applied(definition, "lifting", athletics), ["lifting"]);
  assert.deepEqual(applied(definition, "lifting", stealthWithStr), ["lifting"]);
  // Not a check rolled with another ability.
  assert.deepEqual(applied(definition, "lifting", stealth), []);
  assert.deepEqual(applied(definition, "lifting", dexterity), []);
  // A skill's own specialty still reads as before.
  assert.deepEqual(applied(definition, "climbing", athletics), ["climbing"]);
  assert.deepEqual(applied(definition, "climbing", strength), []);
  // Without the key, an ability in the cell matches nothing, as before 1.213.
  const older = parse(fixture((doc) => delete doc.sheet.lists.at(-1).contextual.abilities));
  assert.deepEqual(applied(older, "lifting", strength), []);
  assert.deepEqual(applied(older, "lifting", athletics), []);

  // ── The schema ──
  const refused = parseRulesetDefinition(fixture((doc) => delete doc.sheet.lists.at(-1).contextual.skill));
  assert.ok(!refused.ok && refused.issues.some((issue) => /needs one/.test(issue)));

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ability-specialties",
    name: "Ability specialties",
    version: "1.0.0",
    description: "Ability specialties proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(212, fixture()) ?? "", /1\.213/);
  assert.equal(gate(213, fixture()), null);

  console.log("game-ruleset-ability-specialties: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
