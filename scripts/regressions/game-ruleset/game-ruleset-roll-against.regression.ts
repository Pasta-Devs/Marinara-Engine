/**
 * Rolling against the sheet's number: the `roll-against` resolution kind (Capability API 1.139).
 *
 * What is pinned here:
 *   - The schema takes Call of Cthulhu, GURPS and an old-school saving throw, and refuses tens dice
 *     off a d100, a critical with both faces and pastTarget, a critical face the dice cannot show, a
 *     fraction band on another kind or on an at-least roll, and a divide on a summed ladder.
 *   - Call of Cthulhu: at or under the skill, Hard at half and Extreme at a fifth by divide, bands
 *     read as a fraction of the target, 01 a critical, 100 (and 96+ under 50) a fumble, and bonus and
 *     penalty tens dice keeping the best or worst.
 *   - GURPS: 3d6 at or under the skill, criticals that depend on the skill and a failure by 10.
 *   - An old-school save: at least the number.
 *   - Through the resolver: the skill's percentage is its sheet bonus, a named step divides it, and
 *     the record says the number it was read against and reads back; the summary, the Game Master's
 *     line and the 1.139 gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  formatSkillCheckResultSummary,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollAgainstCheck,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-roll-against-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, readRulesetDifficulty },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  /** Ember Roads rolled as Call of Cthulhu, its fight and layers left out. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    document.sheet.bonusRange = { min: -20, max: 99 };
    const old = document.resolution;
    document.resolution = {
      kind: "roll-against",
      dice: { count: 1, sides: 100 },
      abilityModifier: old.abilityModifier,
      proficiencyTiers: old.proficiencyTiers,
      against: "at-most",
      criticalSuccess: [{ from: 1, to: 1 }],
      criticalFailure: [
        { from: 100, to: 100 },
        { from: 96, whenTarget: { below: 50 } },
      ],
      tens: { max: 2 },
      difficultyLadder: [
        { label: "Regular", dc: 0 },
        { label: "Hard", dc: 0, divide: 2 },
        { label: "Extreme", dc: 0, divide: 5 },
      ],
      outcomes: {
        by: "fraction",
        tiers: [
          { id: "critical", label: "Critical", on: "critical-success", success: true },
          { id: "extreme", label: "Extreme success", atLeast: 5, success: true },
          { id: "hard", label: "Hard success", atLeast: 2, success: true },
          { id: "regular", label: "Regular success", atLeast: 1, success: true },
          { id: "fail", label: "Failure" },
          { id: "fumble", label: "Fumble", on: "critical-failure" },
        ],
      },
    };
    edit?.(document);
    return document;
  };
  const gurpsDoc = () =>
    doc((d) => {
      delete d.resolution.outcomes;
      delete d.resolution.tens;
      d.resolution.dice = { count: 3, sides: 6 };
      d.resolution.criticalSuccess = [
        { from: 3, to: 4 },
        { from: 5, to: 5, whenTarget: { atLeast: 15 } },
        { from: 6, to: 6, whenTarget: { atLeast: 16 } },
      ];
      d.resolution.criticalFailure = [{ from: 18 }, { from: 17, whenTarget: { below: 16 } }, { pastTarget: 10 }];
      d.resolution.difficultyLadder = [
        { label: "Average", dc: 0 },
        { label: "Hard", dc: -2 },
      ];
    });
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refuses = (document: unknown, pattern: RegExp, why: string) => {
    const result = parseRulesetDefinition(document);
    assert.ok(!result.ok, `${why}: should have been refused`);
    assert.ok(
      result.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(result.issues)}`,
    );
  };
  const faces = (...values: number[]) => {
    let at = 0;
    return () => {
      assert.ok(at < values.length, "the roll threw more dice than the test planned");
      return values[at++]!;
    };
  };

  // ── The schema ──
  {
    parsed(doc());
    parsed(gurpsDoc());
    refuses(
      doc((d) => (d.resolution.dice = { count: 1, sides: 20 })),
      /Tens dice are thrown on a single d100/,
      "tens dice off a d100",
    );
    refuses(
      doc((d) => (d.resolution.criticalFailure = [{ from: 99, pastTarget: 10 }])),
      /one of the two/,
      "a critical with both faces and pastTarget",
    );
    refuses(
      doc((d) => (d.resolution.criticalSuccess = [{ pastTarget: 10 }])),
      /names a critical failure/,
      "pastTarget on a success",
    );
    refuses(
      doc((d) => (d.resolution.criticalFailure = [{ from: 101 }])),
      /1d100 shows 1 to 100/,
      "a face the dice cannot show",
    );
    refuses(
      doc((d) => (d.resolution.against = "at-least")),
      /fraction of the target is read on a roll at most/,
      "a fraction band on an at-least roll",
    );
    const ember = JSON.parse(emberText) as Record<string, any>;
    ember.resolution.outcomes = {
      by: "fraction",
      tiers: [
        { id: "a", label: "A", atLeast: 2, success: true },
        { id: "b", label: "B" },
      ],
    };
    refuses(ember, /Only a roll-against ruleset reads a fraction/, "a fraction band on a summed ruleset");
    const divided = JSON.parse(emberText) as Record<string, any>;
    divided.resolution.difficultyLadder[0].divide = 2;
    refuses(divided, /divide/, "a divide on a summed ladder");
  }

  // ── Call of Cthulhu ──
  const coc = parsed(doc());
  {
    const roll = (skill: number, divide: number, ...thrown: number[]) =>
      rollAgainstCheck(coc, { modifier: skill, dc: 0, divide, isSave: false }, faces(...thrown));
    assert.deepEqual([roll(60, 1, 45).outcome, roll(60, 1, 45).target], ["Regular success", 60]);
    assert.equal(roll(60, 1, 30).outcome, "Hard success");
    assert.equal(roll(60, 1, 12).outcome, "Extreme success");
    assert.equal(roll(60, 1, 13).outcome, "Hard success", "60 / 5 is 12");
    assert.deepEqual([roll(60, 1, 61).success, roll(60, 1, 61).outcome], [false, "Failure"]);
    // Hard: the skill halved before the roll is read.
    const hard = roll(60, 2, 31);
    assert.deepEqual([hard.target, hard.success], [30, false]);
    assert.deepEqual([roll(60, 1, 1).outcome, roll(60, 1, 1).criticalSuccess], ["Critical", true]);
    assert.deepEqual([roll(60, 1, 100).outcome, roll(60, 1, 100).criticalFailure], ["Fumble", true]);
    assert.equal(roll(60, 1, 97).outcome, "Failure", "96+ fumbles only under 50");
    assert.equal(roll(40, 1, 97).outcome, "Fumble");
    // Bonus and penalty dice: the units die first, then a tens die per candidate; 00 and 0 is 100.
    const tens = (bonus: number, ...thrown: number[]) =>
      rollAgainstCheck(coc, { modifier: 50, dc: 0, isSave: false, tens: bonus }, faces(...thrown));
    const bonus = tens(1, 3, 7, 2);
    assert.deepEqual([bonus.rolls, bonus.usedRoll, bonus.rollMode, bonus.dice], [[73, 23], 23, "advantage", "2d100"]);
    const penalty = tens(-2, 3, 7, 2, 4);
    assert.deepEqual([penalty.usedRoll, penalty.tens, penalty.rollMode], [73, -2, "disadvantage"]);
    assert.equal(tens(5, 1, 1, 1, 1).tens, 2, "held to tens.max");
    assert.deepEqual(tens(1, 10, 10, 1).rolls, [100, 10], "00 and 0 is 100");
  }

  // ── GURPS ──
  {
    const gurps = parsed(gurpsDoc());
    const roll = (skill: number, ...thrown: number[]) =>
      rollAgainstCheck(gurps, { modifier: skill, dc: 0, isSave: false }, faces(...thrown));
    assert.deepEqual([roll(12, 4, 4, 4).total, roll(12, 4, 4, 4).success], [12, true]);
    assert.equal(roll(12, 5, 4, 4).success, false);
    assert.equal(roll(12, 1, 2, 2).criticalSuccess, false, "5 is a critical only at 15 or more");
    assert.equal(roll(15, 1, 2, 2).criticalSuccess, true);
    assert.equal(roll(16, 1, 2, 3).criticalSuccess, true, "6 at 16 or more");
    assert.equal(roll(12, 6, 6, 5).criticalFailure, true, "17 under 16");
    assert.equal(roll(16, 6, 6, 5).criticalFailure, false, "17 at 16 is an ordinary failure");
    assert.equal(roll(5, 6, 6, 3).criticalFailure, true, "15 is 10 past 5");
    const harder = rollAgainstCheck(gurps, { modifier: 12, dc: -2, isSave: false }, faces(4, 3, 4));
    assert.deepEqual([harder.target, harder.success], [10, false]);
  }

  // ── An old-school saving throw ──
  {
    const save = parsed(
      doc((d) => {
        delete d.resolution.outcomes;
        delete d.resolution.tens;
        delete d.resolution.criticalSuccess;
        delete d.resolution.criticalFailure;
        d.resolution.against = "at-least";
        d.resolution.dice = { count: 1, sides: 20 };
      }),
    );
    const roll = (target: number, face: number) =>
      rollAgainstCheck(save, { modifier: target, dc: 0, isSave: true }, faces(face));
    assert.equal(roll(14, 14).success, true);
    assert.equal(roll(14, 13).success, false);
  }

  // ── Through the resolver, the record and the Game Master ──
  {
    const build = defaultRulesetSheetBuild(coc);
    const sneak = coc.sheet.skills.find((skill) => skill.id === "sneak")!;
    const ability = sneak.ability ? (build.abilities[sneak.ability] ?? 0) : 0;
    const cards = [
      {
        name: "Ada",
        rulesetSheet: { v: coc.sheet.version, build: { ...build, bonuses: { ...build.bonuses, sneak: 60 - ability } } },
      },
    ];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(coc, cards, cards[0]),
    };
    const request = readRulesetDifficulty({ skill: "Sneak", difficulty: "Hard" } as any, coc);
    assert.equal(request.dc, 0, "a step's dc is what it moves the number by");
    const result = resolveSkillCheckWithContext(context as any, request);
    assert.deepEqual([result.dc, result.against, result.modifier], [30, "at-most", 0], "60 halved");
    assert.equal(result.success, result.criticalSuccess || (!result.criticalFailure && result.total <= 30));

    const record = serializeResolvedSkillCheckTag({
      ...result,
      rolls: [23],
      usedRoll: 23,
      total: 23,
      dice: "1d100",
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      outcome: "Regular success",
    });
    assert.match(record, /against="at-most"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([back?.against, back?.dc, back?.total, back?.success], ["at-most", 30, 23, true]);
    assert.match(formatSkillCheckResultSummary(back!), /^Sneak check \(at most 30\): /);

    // A single d20 at most its number reads back too, though the d20 audit would read it the other way.
    const d20 = serializeResolvedSkillCheckTag({
      skill: "Sneak",
      dc: 12,
      rolls: [8],
      usedRoll: 8,
      modifier: 0,
      total: 8,
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution: "sum",
      dice: "1d20",
      against: "at-most",
    });
    assert.equal(parseSkillCheckTagBody(d20.slice("[skill_check:".length, -1))?.resolvedResult?.success, true);

    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: ["Ada"], playerName: "Ada" };
    const reminder = buildGmFormatReminder({ ...base, ruleset: coc });
    assert.match(reminder, /rolls 1d100 and succeeds at or under the character's number from the sheet/);
    assert.match(
      reminder,
      /Steps: Regular \(the number as it is\), Hard \(the number divided by 2\), Extreme \(the number divided by 5\)/,
    );
    assert.match(reminder, /Critical failure: 100; 96 or more when the number is below 50\./);
    assert.match(reminder, /Extreme success \(at most the target divided by 5, success\)/);
    assert.match(reminder, /bonus="\+N" for bonus dice/);

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-roll-against",
      name: "Roll against",
      version: "0.1.0",
      description: "A packaged ruleset that rolls under the sheet.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /rolls against the sheet's number requires schemaVersion 2 and capabilityApi 1\.139/;
    assert.match(getCapabilityPackageInstallIssue(manifest(138) as any, doc()) ?? "", gate);
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(139) as any, doc()) ?? "", gate);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
