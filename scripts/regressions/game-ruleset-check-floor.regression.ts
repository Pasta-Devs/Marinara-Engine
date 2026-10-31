/**
 * A floor under checks (Capability API 1.418).
 *
 *   - Reliable Talent: a d20 below 10 on a skill its holder adds their whole proficiency to counts as
 *     10, outside a fight; not on an untrained skill, not on half proficiency, never on a save.
 *   - Indomitable Might: a Strength check's total below the Strength score counts as the score,
 *     outside a fight and in a fight's contest.
 *   - Held off while (1.417) counts outside a fight too.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-check-floor-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [{ buildSkillCheckRulesetContext, resolveSkillCheckWithContext }, { getCapabilityPackageInstallIssue }] =
  await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);

try {
  assert.ok(supportedCapabilityApi.minor >= 418);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.derived.push({ id: "class_level", label: "Class level", op: "sum", of: [{ field: "level" }] });
    doc.combat.levels = [
      ...(doc.combat.levels ?? []),
      { derived: "class_level", at: 11, checkFloor: { face: 10, proficient: true }, notWhile: ["poisoned"] },
      { derived: "class_level", at: 18, checkFloor: { total: { abilityScore: "str" }, abilities: ["str"] } },
    ];
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
  const build = (level: number) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 20, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      skills: { stealth: "proficient", perception: "half", athletics: "none" },
      fields: { level, ac: 12, speed: 30, hp_max: 40 },
    });

  // ── Outside a fight ──
  {
    const check = (level: number, skill: string, d20: number, live?: RulesetLiveStates) => {
      const party = [{ name: "Mira", rulesetSheet: { v: 1, build: build(level) } }];
      const ruleset = buildSkillCheckRulesetContext(definition, party, party[0], live);
      const result = resolveSkillCheckWithContext(
        { skills: null, attributes: null, sheetAttributes: {}, ruleset },
        { skill, dc: 15 },
        () => d20,
      );
      return result;
    };
    // Dexterity +2 and proficiency +4 at 11th level.
    const reliable = check(11, "Stealth", 3);
    assert.deepEqual([reliable.usedRoll, reliable.total], [10, 16], JSON.stringify(reliable));
    assert.ok(
      reliable.from?.some((name) => name.includes("Class level")),
      JSON.stringify(reliable.from),
    );
    assert.equal(check(11, "Stealth", 15).usedRoll, 15, "a higher face stands");
    assert.equal(check(10, "Stealth", 3).usedRoll, 3, "not before 11th level");
    assert.equal(check(11, "Perception", 3).usedRoll, 3, "half proficiency is not the whole bonus");
    assert.equal(check(11, "Arcana", 3).usedRoll, 3, "not untrained");
    assert.equal(check(11, "Dexterity save", 3).usedRoll, 3, "never a save");
    assert.equal(
      check(11, "Stealth", 3, { mira: { conditions: ["poisoned"] } }).usedRoll,
      3,
      "held off while poisoned, as notWhile says",
    );
    // Indomitable Might: Athletics, Strength +5 untrained: 1 + 5 lifted to the score, 20.
    const mighty = check(18, "Athletics", 1);
    assert.deepEqual([mighty.usedRoll, mighty.total], [1, 20], JSON.stringify(mighty));
    assert.equal(check(18, "Athletics", 19).total, 24, "a higher total stands");
    assert.equal(check(18, "Acrobatics", 1).total, 3, "a Dexterity check is not lifted");
    assert.equal(check(17, "Athletics", 1).total, 6, "not before 18th level");
  }

  // ── In a fight: the shove's contest ──
  {
    const block = (): RulesetStatBlock => ({
      health: 40,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
    });
    const shove = (level: number) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 1,
        combatants: [
          {
            id: "barb",
            name: "Barbarian",
            side: "party",
            build: build(level),
            live: {},
          },
          { id: "foe", name: "Foe", side: "enemy", block: block() },
        ],
      });
      state.order = ["barb", "foe"];
      state.turn = 0;
      const option = rulesetCombatOptions(definition, state, "barb").find((one) => one.label === "Shove away");
      assert.ok(option, "the barbarian can shove");
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "barb", optionId: option.id, targetIds: ["foe"] },
        () => 1,
      );
      const contest = step.events.find(
        (one): one is Extract<RulesetCombatEvent, { type: "contest" }> => one.type === "contest",
      );
      assert.ok(contest, JSON.stringify(step.events));
      return contest;
    };
    assert.equal(shove(18).attacker.total, 20, "lifted to the Strength score");
    assert.equal(shove(17).attacker.total, 6);
  }

  // ── Refusals ──
  {
    const withFloor = (checkFloor: Record<string, unknown>) =>
      document((doc) => {
        doc.combat.levels.push({ derived: "class_level", at: 5, checkFloor });
      });
    refused(withFloor({ proficient: true }), /A check floor names a "face", a "total" or both/);
    refused(withFloor({ face: 10, abilities: ["luck"] }), /Unknown ability "luck"/);
    refused(withFloor({ face: 10, skills: ["juggling"] }), /Unknown skill "juggling"/);
    refused(withFloor({ total: { derived: "nothing_here" } }), /nothing_here/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or levels put a floor under their holder's checks (checkFloor) requires schemaVersion 2 and capabilityApi 1.418 or newer";
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
    const floorOnly = document((doc) => {
      doc.combat.levels = doc.combat.levels.map((level: Record<string, unknown>) => {
        const { notWhile: _notWhile, ...rest } = level;
        return rest;
      });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(417) as never, floorOnly), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(418) as never, floorOnly), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(417) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Check floors: Reliable Talent lifts a d20 below 10 on a fully proficient skill, never a save, held off as notWhile says; Indomitable Might lifts a Strength check's total to the score, outside a fight and in a contest; gated at 1.418.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
