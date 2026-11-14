/**
 * Valued faces, open-ended rolls and unmodified faces on a summed check (Capability API 1.136).
 *
 * What is pinned here:
 *   - The schema refuses faces that do not match the die, an open-ended roll on several dice or on
 *     faces, a `low` at or above `high`, and an unmodified face the die does not have.
 *   - Fate's 4dF: the faces are recorded as thrown and added by their worth, with the bands.
 *   - Rolemaster's open-ended d100: a high face chains and adds, a low face takes the next roll away
 *     and that chains on high, every die is on the record, the chain ends, and the natural and the
 *     unmodified face are the first die's.
 *   - The record reads back with its faces and its unmodified face, the summary says them, the Game
 *     Master is told what the engine rolls, and a packaged ruleset that has them declares 1.136.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatSkillCheckResultSummary,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollDiceSumCheck,
  RULESET_OPEN_ENDED_MAX_ROLLS,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
  type SkillCheckResult,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-dice-faces-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [{ buildGmFormatReminder }, { getCapabilityPackageInstallIssue }] = await Promise.all([
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  /** Ember Roads with other dice, its fight left out (it is written for 2d6). */
  const doc = (edit: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    edit(document);
    return document;
  };
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
  const fateDoc = () =>
    doc((d) => {
      d.resolution.dice = { count: 4, sides: 3, faces: [-1, 0, 1] };
      d.resolution.outcomes = {
        by: "margin",
        tiers: [
          { id: "style", label: "Success with style", atLeast: 3, success: true },
          { id: "success", label: "Success", atLeast: 1, success: true },
          { id: "tie", label: "Tie", atLeast: 0, success: true, text: "Succeed at a minor cost." },
          { id: "fail", label: "Failure" },
        ],
      };
    });
  const rolemasterDoc = () =>
    doc((d) => {
      d.resolution.dice = { count: 1, sides: 100 };
      d.resolution.openEnded = { high: 96, low: 5 };
      d.resolution.unmodified = [66, 100];
    });

  // ── The schema ──
  {
    parsed(fateDoc());
    parsed(rolemasterDoc());
    refuses(
      doc((d) => (d.resolution.dice = { count: 4, sides: 3, faces: [-1, 1] })),
      /A d3 has 3 faces/,
      "faces that do not match the die",
    );
    refuses(
      doc((d) => {
        d.resolution.dice = { count: 2, sides: 100 };
        d.resolution.openEnded = { high: 96 };
      }),
      /open-ended roll needs a single die/,
      "open-ended on two dice",
    );
    refuses(
      doc((d) => {
        d.resolution.dice = { count: 1, sides: 3, faces: [-1, 0, 1] };
        d.resolution.openEnded = { high: 3 };
      }),
      /has no faces/,
      "open-ended on valued faces",
    );
    refuses(
      doc((d) => {
        d.resolution.dice = { count: 1, sides: 100 };
        d.resolution.openEnded = { high: 50, low: 50 };
      }),
      /would roll both ways/,
      "a low at the high",
    );
    refuses(
      doc((d) => {
        d.resolution.dice = { count: 1, sides: 100 };
        d.resolution.openEnded = { high: 101 };
      }),
      /from 2 to 100/,
      "a high the die does not have",
    );
    refuses(
      doc((d) => {
        d.resolution.dice = { count: 1, sides: 20 };
        d.resolution.unmodified = [66];
      }),
      /from 1 to 20/,
      "an unmodified face the die does not have",
    );
    refuses(
      doc((d) => (d.resolution.unmodified = [6])),
      /a single die's/,
      "an unmodified face on 2d6",
    );
  }

  // ── Fate ──
  {
    const fate = parsed(fateDoc());
    const roll = (modifier: number, dc: number, ...thrown: number[]) =>
      rollDiceSumCheck(fate, { modifier, dc, isSave: false }, faces(...thrown));
    // + + 0 - is +1; with Good (+3) against Fair (2) that is 4: two past it.
    const shifts = roll(3, 2, 3, 3, 2, 1);
    assert.deepEqual(shifts.rolls, [3, 3, 2, 1], "the faces as thrown");
    assert.equal(shifts.usedRoll, 1, "worth -1, 0, +1 each");
    assert.deepEqual([shifts.total, shifts.outcome], [4, "Success"]);
    assert.deepEqual(shifts.faces, [-1, 0, 1]);
    assert.equal(roll(3, 2, 1, 1, 2, 2).outcome, "Failure", "-2 brings Good down to Average against Fair");
    assert.equal(roll(2, 2, 2, 2, 2, 2).outcome, "Tie");
    assert.equal(roll(2, 2, 3, 3, 3, 2).outcome, "Success with style", "three past it");
    assert.equal(roll(0, 0, 1, 1, 1, 1).total, -4, "the lowest a roll can be");
  }

  // ── Rolemaster ──
  {
    const rolemaster = parsed(rolemasterDoc());
    const roll = (...thrown: number[]) =>
      rollDiceSumCheck(rolemaster, { modifier: 20, dc: 100, isSave: false }, faces(...thrown));
    const plain = roll(50);
    assert.deepEqual([plain.rolls, plain.usedRoll, plain.total, plain.unmodified], [[50], 50, 70, undefined]);
    const high = roll(97, 98, 40);
    assert.deepEqual([high.rolls, high.usedRoll], [[97, 98, 40], 235], "97 + 98 + 40, chained while 96 or more");
    assert.equal(high.dice, "3d100");
    const low = roll(3, 97, 20);
    assert.deepEqual([low.rolls, low.usedRoll], [[3, 97, 20], 3 - 97 - 20], "a low roll takes the chain away");
    const lowStops = roll(5, 60);
    assert.equal(lowStops.usedRoll, 5 - 60, "the face at low itself rolls again");
    const six = roll(66);
    assert.deepEqual([six.unmodified, six.usedRoll], [66, 66]);
    assert.equal(roll(100, 30).unmodified, 100, "an unmodified face that also rolls on");
    assert.equal(roll(97, 66, 10).unmodified, undefined, "only the first die is unmodified");
    // The chain ends.
    const endless = rollDiceSumCheck(rolemaster, { modifier: 0, dc: 100, isSave: false }, () => 100);
    assert.equal(endless.rolls.length, RULESET_OPEN_ENDED_MAX_ROLLS);
    // A face the player rolled first opens the chain the same way.
    const preRolled = rollDiceSumCheck(
      rolemaster,
      { modifier: 20, dc: 100, isSave: false, preRolled: 97 },
      faces(98, 40),
    );
    assert.deepEqual([preRolled.rolls, preRolled.usedRoll], [[97, 98, 40], 235], "a rolled-first 97 chains on");

    // The natural is the first die's: a 1 that the policy makes automatic stays a failure however far
    // the chain goes, and a 100 rolled on later in a chain is not a natural.
    const natural = parsed(
      doc((d) => {
        d.resolution.dice = { count: 1, sides: 100 };
        d.resolution.openEnded = { high: 96, low: 5 };
        d.resolution.naturals = { check: "both", save: "none" };
      }),
    );
    const natRoll = (...thrown: number[]) =>
      rollDiceSumCheck(natural, { modifier: 0, dc: 100, isSave: false }, faces(...thrown));
    assert.equal(natRoll(97, 100, 3).criticalSuccess, false, "a later 100 is not the natural");
    assert.equal(natRoll(100, 2).criticalSuccess, true);
    assert.equal(natRoll(1, 5).criticalFailure, true);

    // Advantage keeps the better set by what it is worth, every die on the record.
    const leaning = parsed(
      doc((d) => {
        d.resolution.dice = { count: 1, sides: 100 };
        d.resolution.openEnded = { high: 96 };
        d.resolution.advantage = true;
      }),
    );
    const better = rollDiceSumCheck(
      leaning,
      { modifier: 0, dc: 100, isSave: false, advantage: true },
      faces(97, 10, 99, 1),
    );
    assert.deepEqual([better.rolls, better.usedRoll], [[97, 10, 99, 1], 107]);
    const worse = rollDiceSumCheck(
      leaning,
      { modifier: 0, dc: 100, isSave: false, disadvantage: true },
      faces(97, 10, 99, 1),
    );
    assert.equal(worse.usedRoll, 100);
  }

  // ── The record, the summary, the Game Master and the gate ──
  {
    const fate = parsed(fateDoc());
    const rolled = rollDiceSumCheck(fate, { modifier: 2, dc: 2, isSave: false }, faces(3, 1, 2, 3));
    const result: SkillCheckResult = { skill: "Sway", dc: 2, modifier: 2, resolution: "sum", ...rolled };
    const record = serializeResolvedSkillCheckTag(result);
    assert.match(record, /faces="-1\|0\|1"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual(back?.faces, [-1, 0, 1]);
    assert.deepEqual(back?.rolls, [3, 1, 2, 3]);
    assert.match(formatSkillCheckResultSummary(result), /\[\+1, -1, 0, \+1\] \+2 → 3/);

    const rolemaster = parsed(rolemasterDoc());
    const um = rollDiceSumCheck(rolemaster, { modifier: 0, dc: 100, isSave: false }, faces(66));
    const umResult: SkillCheckResult = { skill: "Sway", dc: 100, modifier: 0, resolution: "sum", ...um };
    const umRecord = serializeResolvedSkillCheckTag(umResult);
    assert.match(umRecord, /unmodified="66"/);
    assert.equal(parseSkillCheckTagBody(umRecord.slice("[skill_check:".length, -1))?.resolvedResult?.unmodified, 66);
    assert.match(formatSkillCheckResultSummary(umResult), /Unmodified 66\.$/);

    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: ["Mira"], playerName: "Mira" };
    assert.match(
      buildGmFormatReminder({ ...base, ruleset: fate }),
      /the engine rolls 4d3 whose faces are worth -1, 0, \+1 and applies the character sheet/,
    );
    const rmReminder = buildGmFormatReminder({ ...base, ruleset: rolemaster, playerDiceRollSubmitted: true });
    assert.match(
      rmReminder,
      /rolls 1d100 open-ended \(96 or more rolls again and adds, 5 or less rolls again and takes it away\)/,
    );
    assert.match(rmReminder, /unmodified="N" rolled that face before anything was added or rolled again \(66, 100\)/);

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-dice-faces",
      name: "Dice faces",
      version: "0.1.0",
      description: "A packaged ruleset with Fudge dice.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      /valued faces, roll open-ended or mark unmodified faces requires schemaVersion 2 and capabilityApi 1\.136/;
    const plainFaces = doc((d) => (d.resolution.dice = { count: 4, sides: 3, faces: [-1, 0, 1] }));
    for (const document of [plainFaces, rolemasterDoc()]) {
      assert.match(getCapabilityPackageInstallIssue(manifest(135) as any, document) ?? "", gate);
      assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(136) as any, document) ?? "", gate);
    }
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
