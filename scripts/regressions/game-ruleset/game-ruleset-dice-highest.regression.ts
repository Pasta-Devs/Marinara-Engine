/**
 * Keep-the-highest dice: the `dice-highest` resolution kind (Capability API 1.138).
 *
 * What is pinned here:
 *   - The schema takes Blades in the Dark and Trophy Dark, and refuses a ladder step past what the
 *     kept dice can show, a critical face the die lacks, a critical no roll could reach, a spend that
 *     buys successes, and a fight beside the kind.
 *   - Blades: the highest die is the result, read into bands; two sixes are the critical; no dice
 *     throws two and keeps the lower, never a critical; `zeroDice: "fail"` fails without a roll.
 *   - Trophy: dark dice are added with `dark=`, held to their max, read with the rest, and flagged
 *     when one beats every light die; `keep: 2` adds the two highest.
 *   - Through the resolver: the sheet's number is the dice, `bonus=` and `dark=` apply, and the
 *     record reads back with its kept dice and its dark dice; the summary and the Game Master say
 *     them, and a packaged ruleset of this kind declares 1.138.
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
  rollDiceHighestCheck,
  serializeResolvedSkillCheckTag,
  skillCheckLightKeptIndices,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-dice-highest-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
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
  /** Ember Roads thrown as Blades in the Dark, its fight and layers left out. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    const old = document.resolution;
    document.resolution = {
      kind: "dice-highest",
      die: { sides: 6 },
      abilityModifier: old.abilityModifier,
      proficiencyTiers: old.proficiencyTiers,
      adjust: old.adjust,
      pool: { min: 0, max: 6 },
      critical: { count: 2 },
      situationalDice: { min: -1, max: 2 },
      difficultyLadder: [
        { label: "Partial", dc: 4 },
        { label: "Full", dc: 6 },
      ],
      outcomes: {
        by: "total",
        tiers: [
          { id: "critical", label: "Critical", on: "critical-success", success: true },
          { id: "full", label: "Full success", atLeast: 6, success: true },
          { id: "partial", label: "Partial success", atLeast: 4, success: true },
          { id: "bad", label: "Bad outcome" },
        ],
      },
    };
    edit?.(document);
    return document;
  };
  const trophyDoc = () =>
    doc((d) => {
      delete d.resolution.outcomes;
      delete d.resolution.critical;
      d.resolution.dark = { label: "dark", max: 3, text: "mark Ruin if it beats your Ruin." };
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
    parsed(trophyDoc());
    refuses(
      doc((d) => (d.resolution.difficultyLadder[1].dc = 7)),
      /The kept dice show 1 to 6/,
      "a step past the die",
    );
    refuses(
      doc((d) => (d.resolution.critical = { count: 2, face: 8 })),
      /from 2 to 6/,
      "a critical face the die lacks",
    );
    refuses(
      doc((d) => (d.resolution.critical = { count: 10 })),
      /could never happen/,
      "a critical no roll reaches",
    );
    refuses(
      doc((d) => {
        d.sheet.live.pools.push({ id: "grit", label: "Grit", max: { const: 3 } });
        d.resolution.spend = [{ pool: "grit", amount: 1, successes: 1, perCheck: 1 }];
      }),
      /buys only dice/,
      "a spend that buys a success",
    );
    const fight = JSON.parse(emberText) as Record<string, any>;
    refuses(
      doc((d) => (d.combat = fight.combat)),
      /no fight of its own/,
      "a fight beside the kind",
    );
  }

  // ── Blades ──
  const blades = parsed(doc());
  {
    const roll = (dc: number, ...thrown: number[]) =>
      rollDiceHighestCheck(blades, { modifier: thrown.length, dc, isSave: false }, faces(...thrown));
    const partial = roll(4, 2, 5, 1);
    assert.deepEqual([partial.total, partial.success, partial.outcome], [5, true, "Partial success"]);
    assert.equal(roll(4, 6, 3).outcome, "Full success");
    assert.equal(roll(4, 3, 2, 1).outcome, "Bad outcome");
    const critical = roll(4, 6, 6, 1);
    assert.deepEqual([critical.outcome, critical.criticalSuccess], ["Critical", true], "two sixes");
    // No dice: two thrown, the lower kept, and never a critical however they land.
    const zero = rollDiceHighestCheck(blades, { modifier: 0, dc: 4, isSave: false }, faces(6, 6));
    assert.deepEqual(
      [zero.rolls, zero.total, zero.zero, zero.criticalSuccess, zero.outcome],
      [[6, 6], 6, true, false, "Full success"],
    );
    assert.equal(rollDiceHighestCheck(blades, { modifier: 0, dc: 4, isSave: false }, faces(5, 2)).total, 2);
    // The pool is held to its range, and bonus= adds dice within the ruleset's own.
    const many = rollDiceHighestCheck(blades, { modifier: 9, dc: 4, isSave: false }, () => 3);
    assert.equal(many.rolls.length, 6);
    const helped = rollDiceHighestCheck(blades, { modifier: 1, dc: 4, isSave: false, bonusDice: 5 }, () => 3);
    assert.deepEqual([helped.rolls.length, helped.bonusDice], [3, 2]);
    // A ruleset whose empty pool fails rolls nothing at all.
    const failing = parsed(doc((d) => (d.resolution.zeroDice = "fail")));
    const none = rollDiceHighestCheck(failing, { modifier: 0, dc: 4, isSave: false }, faces());
    assert.deepEqual([none.rolls, none.success, none.outcome, none.dice], [[], false, "Bad outcome", "0d6"]);
  }

  // ── Trophy ──
  const trophy = parsed(trophyDoc());
  {
    const roll = (light: number, dark: number, ...thrown: number[]) =>
      rollDiceHighestCheck(trophy, { modifier: light, dc: 4, isSave: false, dark }, faces(...thrown));
    const ruin = roll(2, 1, 3, 4, 6);
    assert.deepEqual([ruin.rolls, ruin.total, ruin.dark, ruin.darkHighest], [[3, 4, 6], 6, 1, true]);
    assert.equal(roll(2, 1, 6, 4, 6).darkHighest, false, "a tie is not the dark die beating the light");
    assert.equal(roll(1, 9, 2, 1, 1, 1).dark, 3, "held to dark.max");
    const two = parsed(
      doc((d) => {
        d.resolution.keep = 2;
        d.resolution.zeroDice = "fail";
        delete d.resolution.outcomes;
        d.resolution.difficultyLadder = [{ label: "Endurance", dc: 9 }];
      }),
    );
    const fight = rollDiceHighestCheck(two, { modifier: 3, dc: 9, isSave: false }, faces(5, 2, 4));
    assert.deepEqual([fight.total, fight.success], [9, true], "the two highest added");
  }

  // 1.149: dark dice are still thrown, but only light dice choose the outcome.
  const lightDoc = () =>
    doc((d) => {
      d.resolution.dark = { label: "dark", max: 3, outcome: "light" };
    });
  const lightOnly = parsed(lightDoc());
  {
    refuses(
      doc((d) => {
        d.resolution.dark = { label: "dark", max: 3, outcome: "dark" };
      }),
      /outcome/,
      "unknown dark outcome",
    );
    refuses(
      doc((d) => {
        d.resolution.dark = { label: "dark", max: 3, outcome: "light" };
        d.resolution.critical.count = 9;
      }),
      /could never happen/,
      "dark dice cannot make an unreachable light critical possible",
    );
    const roll = (light: number, dark: number, ...thrown: number[]) =>
      rollDiceHighestCheck(lightOnly, { modifier: light, dc: 4, isSave: false, dark }, faces(...thrown));
    const ruin = roll(1, 1, 4, 6);
    assert.deepEqual([ruin.total, ruin.usedRoll, ruin.outcome, ruin.darkHighest], [4, 4, "Partial success", true]);
    assert.equal(roll(1, 1, 6, 6).criticalSuccess, false, "a dark six cannot supply the second critical die");
    assert.equal(roll(1, 1, 6, 6).darkHighest, false, "ties still do not flag Ruin");
    assert.equal(roll(2, 1, 6, 6, 1).criticalSuccess, true);
    const zero = roll(0, 1, 2, 5, 6);
    assert.deepEqual(
      [zero.rolls, zero.total, zero.zero, zero.darkHighest, zero.criticalSuccess],
      [[2, 5, 6], 2, true, true, false],
    );
    const failDoc = lightDoc();
    failDoc.resolution.zeroDice = "fail";
    const failed = rollDiceHighestCheck(parsed(failDoc), { modifier: 0, dc: 4, isSave: false, dark: 1 }, faces(6));
    assert.deepEqual(
      [failed.rolls, failed.total, failed.success, failed.outcome, failed.darkHighest],
      [[6], 0, false, "Bad outcome", true],
    );
    const keepDoc = lightDoc();
    keepDoc.resolution.keep = 2;
    keepDoc.resolution.zeroDice = "fail";
    const two = rollDiceHighestCheck(parsed(keepDoc), { modifier: 2, dc: 4, isSave: false, dark: 1 }, faces(2, 3, 6));
    assert.equal(two.total, 5);
    for (const rolled of [ruin, zero, failed, two]) {
      const result = {
        skill: "Wits",
        dc: 4,
        modifier: 0,
        resolution: "sum" as const,
        ...rolled,
        highest: rolled === two ? 2 : 1,
        zeroDice: rolled.zero,
        darkOutcome: "light" as const,
      };
      const back = parseSkillCheckTagBody(serializeResolvedSkillCheckTag(result).slice(13, -1))?.resolvedResult;
      assert.equal(back?.darkOutcome, "light");
      assert.deepEqual(back?.rolls, rolled.rolls);
      assert.equal(back?.total, rolled.total);
      assert.deepEqual(skillCheckLightKeptIndices(back!), rolled === failed ? [] : rolled === two ? [1, 0] : [0]);
      assert.match(formatSkillCheckResultSummary(back!), /Only light dice decide the outcome/);
    }
    assert.deepEqual(
      skillCheckLightKeptIndices({ rolls: [4, 4], dark: 1, darkOutcome: "light", highest: 1 }),
      [0],
      "a tied dark die is never highlighted",
    );
    assert.equal(
      skillCheckLightKeptIndices({ rolls: [4, 6], dark: 1, highest: 1 }),
      undefined,
      "legacy highlights are unchanged",
    );
    const cards = [
      { name: "Wren", rulesetSheet: { v: lightOnly.sheet.version, build: defaultRulesetSheetBuild(lightOnly) } },
    ];
    const result = resolveSkillCheckWithContext(
      {
        skills: null,
        attributes: null,
        sheetAttributes: {},
        ruleset: buildSkillCheckRulesetContext(lightOnly, cards, cards[0]),
      } as any,
      { skill: "Wits", dc: 4, darkDice: 1 },
    );
    assert.equal(result.darkOutcome, "light");
    assert.equal(result.total, (result.zeroDice ? Math.min : Math.max)(...result.rolls.slice(0, -1)));
  }

  // ── Through the resolver, the record and the Game Master ──
  {
    const build = defaultRulesetSheetBuild(trophy);
    const cards = [{ name: "Wren", rulesetSheet: { v: trophy.sheet.version, build } }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(trophy, cards, cards[0]),
    };
    const expected = defaultRulesetSheetBuild(trophy).abilities.wits ?? 0;
    const result = resolveSkillCheckWithContext(
      context as any,
      { skill: "Wits", dc: 4, darkDice: 2, bonusDice: 1 } as any,
    );
    assert.equal(result.highest, 1);
    assert.equal(result.dark, 2);
    assert.equal(result.rolls.length, Math.min(6, expected + 1) + 2, "the sheet's dice, the bonus and the dark dice");
    assert.equal(result.modifier, 0);
    assert.equal(result.total, Math.max(...result.rolls));

    const record = serializeResolvedSkillCheckTag({
      ...result,
      rolls: [3, 2, 5],
      usedRoll: 5,
      total: 5,
      dice: "3d6",
      dark: 1,
      darkLabel: "dark",
      darkHighest: true,
    });
    assert.match(record, /highest="1"/);
    assert.match(record, /dark="1" darkLabel="dark" darkHighest="true"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual(
      [back?.highest, back?.dark, back?.darkLabel, back?.darkHighest, back?.total],
      [1, 1, "dark", true, 5],
    );
    assert.match(
      formatSkillCheckResultSummary(back!),
      /Highest die kept\. 1 dark die \(the last one\); a dark die rolled highest\.$/,
    );

    // A pool of none that failed reads back as the failure it was.
    const failing = parsed(doc((d) => (d.resolution.zeroDice = "fail")));
    const empty = rollDiceHighestCheck(failing, { modifier: 0, dc: 4, isSave: false }, faces());
    const emptyRecord = serializeResolvedSkillCheckTag({
      skill: "Wits",
      dc: 4,
      modifier: 0,
      resolution: "sum",
      ...empty,
      highest: 1,
    });
    const emptyBack = parseSkillCheckTagBody(emptyRecord.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([emptyBack?.rolls, emptyBack?.success], [[], false]);

    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: ["Wren"], playerName: "Wren" };
    const bladesReminder = buildGmFormatReminder({ ...base, ruleset: blades });
    assert.match(
      bladesReminder,
      /throws as many d6 as the character's rating and reads the highest die; dc is what that must reach/,
    );
    assert.match(bladesReminder, /With no dice, the engine throws two and keeps the lower/);
    assert.match(bladesReminder, /2 or more dice showing 6 is a critical success/);
    assert.match(bladesReminder, /Partial success \(4 or more on the kept dice, success\)/);
    const lightReminder = buildGmFormatReminder({ ...base, ruleset: lightOnly });
    assert.match(lightReminder, /Only light dice decide/);
    assert.match(lightReminder, /even with dark dice/);
    assert.match(lightReminder, /strictly beats every light die/);
    const trophyReminder = buildGmFormatReminder({ ...base, ruleset: trophy });
    assert.match(trophyReminder, /Add dark="N" to throw up to 3 dark dice/);

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-dice-highest",
      name: "Dice highest",
      version: "0.1.0",
      description: "A packaged ruleset that reads the highest die.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /reads the highest die requires schemaVersion 2 and capabilityApi 1\.138/;
    assert.match(getCapabilityPackageInstallIssue(manifest(137) as any, trophyDoc()) ?? "", gate);
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(138) as any, trophyDoc()) ?? "", gate);
    assert.match(getCapabilityPackageInstallIssue(manifest(148) as any, lightDoc()) ?? "", /capabilityApi 1\.149/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(149) as any, lightDoc()), null);
    const explicitAll = lightDoc();
    explicitAll.resolution.dark.outcome = "all";
    assert.match(getCapabilityPackageInstallIssue(manifest(148) as any, explicitAll) ?? "", /capabilityApi 1\.149/);
    const override = doc((d) => {
      d.resolution.overrides = [
        { id: "light", label: "Light", abilities: ["wits"], set: { dark: lightDoc().resolution.dark } },
      ];
    });
    parsed(override);
    assert.match(getCapabilityPackageInstallIssue(manifest(148) as any, override) ?? "", /capabilityApi 1\.149/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(149) as any, override), null);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
