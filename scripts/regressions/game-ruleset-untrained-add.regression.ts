/**
 * What untrained adds, off the sheet (Capability API 1.419).
 *
 *   - Jack of All Trades: an untrained skill adds half the proficiency bonus from 2nd bard level, a
 *     trained one does not, and a raw ability check adds it through the ability's `checkAdd`.
 *   - A fight's contest reads the same number off the sheet.
 *   - Refusals (a skill read, or a derived value up to it that reads one) and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-untrained-add-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [{ buildSkillCheckRulesetContext, resolveSkillCheckWithContext }, { getCapabilityPackageInstallIssue }] =
  await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);

try {
  assert.ok(supportedCapabilityApi.minor >= 419);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    // Declared right after the proficiency bonus, above any derived value that reads a skill.
    doc.sheet.derived.splice(
      1,
      0,
      {
        id: "bard_flag",
        label: "Bard 2",
        op: "stepTable",
        from: { field: "level" },
        table: [
          [1, 0],
          [2, 1],
        ],
      },
      {
        id: "half_proficiency",
        label: "Half proficiency",
        op: "scale",
        of: { derived: "proficiency_bonus" },
        multiplier: 0.5,
        round: "down",
      },
      {
        id: "jack",
        label: "Jack of All Trades",
        op: "multiply",
        of: [{ derived: "bard_flag" }, { derived: "half_proficiency" }],
      },
    );
    for (const skill of doc.sheet.skills) skill.untrained = { add: { derived: "jack" } };
    for (const ability of doc.sheet.abilities) ability.checkAdd = { derived: "jack" };
    edit(doc);
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
  // Proficiency +3 at 5th level, so half is +1; Strength 14 is +2, Dexterity 16 is +3.
  const build = (level: number) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 14, dex: 16, con: 12, int: 10, wis: 10, cha: 14 },
      skills: { stealth: "proficient" },
      fields: { level, ac: 12, speed: 30, hp_max: 30 },
    });

  // ── On the sheet and outside a fight ──
  {
    const sheet = evaluateRulesetSheetLive(definition, build(5), {});
    assert.equal(sheet.skillMods.athletics, 2 + 1, "untrained adds half proficiency");
    assert.equal(sheet.skillMods.stealth, 3 + 3, "trained adds the whole, and not half on top");
    assert.equal(evaluateRulesetSheetLive(definition, build(1), {}).skillMods.athletics, 2, "not before 2nd level");
    const check = (skill: string) => {
      const party = [{ name: "Mira", rulesetSheet: { v: 1, build: build(5) } }];
      const ruleset = buildSkillCheckRulesetContext(definition, party, party[0]);
      return resolveSkillCheckWithContext(
        { skills: null, attributes: null, sheetAttributes: {}, ruleset },
        { skill, dc: 10 },
        () => 10,
      );
    };
    assert.equal(check("Athletics").modifier, 3);
    assert.equal(check("Strength").modifier, 2 + 1, "a raw ability check adds checkAdd");
    assert.equal(check("Stealth").modifier, 6);
  }

  // ── In a fight: the contest reads the same number ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "bard", name: "Bard", side: "party", build: build(5), live: {} }],
    });
    assert.equal(rulesetCombatant(state, "bard")!.checks?.might, 3, "Athletics untrained, with Jack");
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => {
        doc.sheet.skills[0].untrained = { add: { skillMod: "stealth" } };
      }),
      /What untrained adds cannot read a skill or save modifier/,
    );
    refused(
      document((doc) => {
        doc.sheet.abilities[0].checkAdd = { derived: "passive_perception" };
      }),
      /feeds An ability check's add and cannot read a skill or save modifier/,
    );
    refused(
      document((doc) => {
        doc.sheet.skills[0].untrained = { add: { derived: "nothing_here" } };
      }),
      /nothing_here/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose untrained skills or saves add a value off the sheet (untrained add) or whose abilities add to their checks (checkAdd) requires schemaVersion 2 and capabilityApi 1.419 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(418) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(419) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(418) as never, JSON.parse(fiveEText)), gate);

    // Up to 40 combat levels, more than 20 gated at 1.419.
    const many = (count: number) =>
      document((doc) => {
        doc.combat.levels = Array.from({ length: count }, (_, at) => ({
          derived: "jack",
          at: at + 1,
          effects: ["cannot-react"],
        }));
      });
    parsed(many(40));
    refused(many(41), /levels/);
    const levelsGate =
      "A ruleset with more than 20 combat levels requires schemaVersion 2 and capabilityApi 1.419 or newer";
    const plain = (count: number) => {
      const doc = many(count);
      for (const skill of doc.sheet.skills) delete skill.untrained;
      for (const ability of doc.sheet.abilities) delete ability.checkAdd;
      return doc;
    };
    assert.equal(getCapabilityPackageInstallIssue(manifest(418) as never, plain(21)), levelsGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(418) as never, plain(20)), levelsGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(419) as never, plain(21)), levelsGate);
  }

  console.log(
    "Untrained add: Jack of All Trades adds half proficiency to untrained skills and raw ability checks, on the sheet, outside a fight and in a contest; refuses skill reads; up to 40 combat levels; gated at 1.419.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
