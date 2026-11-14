/**
 * Outcome bands on a check (Capability API 1.135): `resolution.outcomes`.
 *
 * What is pinned here:
 *   - The schema refuses bands that could never be read: out of order, a last band with a floor, a
 *     band missing one, nothing that succeeds or nothing that fails, a shift with several dice or
 *     beside the summed kind's own naturals, and `exceptional` beside bands on a pool.
 *   - A summed check lands in the band its margin (or total) reaches, a natural shifts it one band
 *     either way and never past the ends, and an automatic natural pins the best or the worst band.
 *   - A pool read by its total, and a botch landing in the worst band.
 *   - Success and the criticals are the band's own, the record says `outcome="..."` and reads back,
 *     a GM-written record is never vouched for, and the summary says the band.
 *   - The Game Master is taught the bands, and a packaged ruleset that has them declares 1.135.
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
  rollDicePoolCheck,
  rollDiceSumCheck,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-outcomes-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, resolveSkillCheckTagsInContent },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../../docs/examples/rulesets/gravewatch.json");

  /** Pathfinder's four degrees: 10 past the DC, at it, short of it, 10 short of it. */
  const degrees = () => ({
    by: "margin",
    naturals: "shift",
    tiers: [
      { id: "critical_success", label: "Critical success", atLeast: 10, success: true, critical: true },
      { id: "success", label: "Success", atLeast: 0, success: true },
      { id: "failure", label: "Failure", atLeast: -9 },
      { id: "critical_failure", label: "Critical failure", critical: true },
    ],
  });
  /** Ember Roads rolled on one d20, with its bands, and its fight left out (it is written for 2d6). */
  const d20Doc = (edit?: (doc: Record<string, any>) => void) => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    delete doc.combat;
    doc.catalogs = (doc.catalogs ?? []).filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
    doc.resolution.dice = { count: 1, sides: 20 };
    doc.resolution.naturals = { check: "none", save: "none" };
    doc.resolution.outcomes = degrees();
    edit?.(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refuses = (doc: unknown, pattern: RegExp, why: string) => {
    const result = parseRulesetDefinition(doc);
    assert.ok(!result.ok, `${why}: should have been refused`);
    assert.ok(
      result.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(result.issues)}`,
    );
  };
  /** A die that throws the given faces in order. */
  const faces = (...values: number[]) => {
    let at = 0;
    return () => {
      assert.ok(at < values.length, "the roll threw more dice than the test planned");
      return values[at++]!;
    };
  };

  // ── The schema ──
  {
    const d20 = parsed(d20Doc());
    assert.equal(d20.resolution.outcomes?.tiers.length, 4);
    assert.equal(d20.resolution.outcomes?.tiers[2]!.success, false, "success defaults to false");
    refuses(
      d20Doc((doc) => (doc.resolution.outcomes.tiers[3].atLeast = -20)),
      /last band catches everything/,
      "a last band with a floor",
    );
    refuses(
      d20Doc((doc) => delete doc.resolution.outcomes.tiers[1].atLeast),
      /Every band but the last needs atLeast/,
      "a middle band with no floor",
    );
    refuses(
      d20Doc((doc) => (doc.resolution.outcomes.tiers[1].atLeast = 10)),
      /best first/,
      "two bands with the same floor",
    );
    refuses(
      d20Doc((doc) => (doc.resolution.outcomes.tiers[2].id = "success")),
      /share an id/,
      "two bands with one id",
    );
    refuses(
      d20Doc((doc) => doc.resolution.outcomes.tiers.forEach((tier: any) => (tier.success = false))),
      /No band is a success/,
      "nothing succeeds",
    );
    refuses(
      d20Doc((doc) => doc.resolution.outcomes.tiers.forEach((tier: any) => (tier.success = true))),
      /Every band is a success/,
      "nothing fails",
    );
    refuses(
      d20Doc((doc) => (doc.resolution.dice = { count: 2, sides: 10 })),
      /only where one die is rolled/,
      "a shift on two dice",
    );
    refuses(
      d20Doc((doc) => (doc.resolution.naturals = { check: "both", save: "none" })),
      /replaces resolution\.naturals/,
      "a shift beside automatic naturals",
    );
    const pool = JSON.parse(gravewatchText) as Record<string, any>;
    pool.resolution.exceptional = { successes: 5 };
    pool.resolution.outcomes = {
      by: "total",
      tiers: degrees().tiers.map(({ id, label, success }, index) => ({
        id,
        label,
        success,
        ...(index < 3 ? { atLeast: 3 - index } : {}),
      })),
    };
    refuses(pool, /leave exceptional out/, "exceptional beside bands");
  }

  // ── A summed check ──
  {
    const d20 = parsed(d20Doc());
    const roll = (die: number, modifier: number, dc: number) =>
      rollDiceSumCheck(d20, { modifier, dc, isSave: false }, faces(die));
    const plain = roll(10, 5, 15);
    assert.deepEqual([plain.outcome, plain.success, plain.criticalSuccess], ["Success", true, false], "margin 0");
    const crit = roll(15, 10, 15);
    assert.deepEqual([crit.outcome, crit.success, crit.criticalSuccess], ["Critical success", true, true], "margin 10");
    const short = roll(5, 1, 15);
    assert.deepEqual([short.outcome, short.success, short.criticalFailure], ["Failure", false, false], "margin -9");
    const botched = roll(4, 1, 15);
    assert.deepEqual([botched.outcome, botched.criticalFailure], ["Critical failure", true], "margin -10");
    // A natural moves the band one either way and never past the ends.
    assert.equal(roll(20, 0, 25).outcome, "Success", "a natural 20 on margin -5 is one band better");
    assert.equal(roll(20, 10, 15).outcome, "Critical success", "and stops at the best band");
    assert.equal(roll(1, 14, 15).outcome, "Failure", "a natural 1 on margin 0 is one band worse");
    assert.equal(roll(1, 0, 15).outcome, "Critical failure", "and stops at the worst band");
    // The margin is what the bands read, never the bare comparison: a 20 on a DC 25 with nothing to add.
    const success = roll(20, 0, 25);
    assert.equal(success.total < 25 && success.success, true);

    // Read by the total, whatever the difficulty, and with no shift.
    const byTotal = parsed(
      d20Doc((doc) => {
        doc.resolution.outcomes = {
          by: "total",
          tiers: [
            { id: "great", label: "Great", atLeast: 18, success: true },
            { id: "fine", label: "Fine", atLeast: 10, success: true },
            { id: "poor", label: "Poor" },
          ],
        };
      }),
    );
    const total = (die: number) => rollDiceSumCheck(byTotal, { modifier: 2, dc: 30, isSave: false }, faces(die));
    assert.deepEqual([total(16).outcome, total(8).outcome, total(7).outcome], ["Great", "Fine", "Poor"]);
    assert.equal(total(20).outcome, "Great", "no shift without naturals: shift");

    // An automatic natural pins the best or the worst band.
    const automatic = parsed(
      d20Doc((doc) => {
        doc.resolution.naturals = { check: "both", save: "none" };
        delete doc.resolution.outcomes.naturals;
      }),
    );
    const auto = (die: number, modifier: number) =>
      rollDiceSumCheck(automatic, { modifier, dc: 15, isSave: false }, faces(die));
    assert.equal(auto(20, -10).outcome, "Critical success", "a natural 20 the policy makes automatic");
    assert.equal(auto(1, 30).outcome, "Critical failure", "a natural 1 the policy makes automatic");
    assert.equal(
      rollDiceSumCheck(automatic, { modifier: -10, dc: 15, isSave: true }, faces(20)).outcome,
      "Failure",
      "a save whose policy is none reads its margin",
    );

    // A band on a critical is reached by that critical alone, and the measure skips it.
    const onCritical = parsed(
      d20Doc((doc) => {
        doc.resolution.naturals = { check: "both", save: "none" };
        doc.resolution.outcomes = {
          by: "margin",
          tiers: [
            { id: "triumph", label: "Triumph", on: "critical-success", success: true },
            { id: "success", label: "Success", atLeast: 0, success: true },
            { id: "failure", label: "Failure" },
            { id: "fumble", label: "Fumble", on: "critical-failure" },
          ],
        };
      }),
    );
    const on = (die: number, modifier: number) =>
      rollDiceSumCheck(onCritical, { modifier, dc: 15, isSave: false }, faces(die));
    assert.deepEqual(
      [on(19, 20).outcome, on(19, 20).criticalSuccess],
      ["Success", false],
      "a big margin is no triumph",
    );
    assert.deepEqual([on(20, -10).outcome, on(20, -10).criticalSuccess], ["Triumph", true]);
    assert.deepEqual([on(2, -10).outcome, on(2, -10).criticalFailure], ["Failure", false]);
    assert.deepEqual([on(1, 30).outcome, on(1, 30).criticalFailure], ["Fumble", true]);
    const onDoc = (edit: (tiers: any[]) => void) =>
      d20Doc((doc) => {
        doc.resolution.naturals = { check: "both", save: "none" };
        delete doc.resolution.outcomes.naturals;
        doc.resolution.outcomes.tiers.unshift({
          id: "triumph",
          label: "Triumph",
          on: "critical-success",
          success: true,
        });
        edit(doc.resolution.outcomes.tiers);
      });
    refuses(
      onDoc((tiers) => (tiers[0].atLeast = 20)),
      /reached by the critical alone/,
      "a band on a critical with a floor",
    );
    refuses(
      onDoc((tiers) => (tiers[0].success = false)),
      /is a success/,
      "a failing band on a critical success",
    );
    refuses(
      onDoc((tiers) => tiers.push({ id: "again", label: "Again", on: "critical-success", success: true })),
      /Only one band may be on a critical-success/,
      "two bands on one critical",
    );
  }

  // ── A pool read by its total, and a botch ──
  {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    delete doc.resolution.exceptional;
    doc.resolution.outcomes = {
      by: "total",
      tiers: [
        { id: "critical", label: "Critical", atLeast: 3, success: true, critical: true },
        { id: "good", label: "Good", atLeast: 2, success: true },
        { id: "barely", label: "Barely", atLeast: 1, success: true, text: "It works, at a cost." },
        { id: "miss", label: "Miss" },
      ],
    };
    const pool = parsed(doc);
    const throwPool = (required: number, ...rolled: number[]) =>
      rollDicePoolCheck(pool, { modifier: rolled.length, required, isSave: false }, faces(...rolled));
    // Gravewatch: target 7, tens explode? Read the faces the file declares and stay under them.
    assert.equal(pool.resolution.kind, "dice-pool");
    if (pool.resolution.kind !== "dice-pool") throw new Error("unreachable");
    const target = pool.resolution.target.default;
    const hit = target;
    const miss = target - 1;
    assert.equal(throwPool(3, hit, miss, miss).outcome, "Barely", "one success is a success here, whatever dc says");
    assert.equal(throwPool(3, hit, miss, miss).success, true);
    assert.equal(throwPool(1, hit, hit, miss).outcome, "Good");
    const critical = throwPool(1, hit, hit, hit);
    assert.deepEqual([critical.outcome, critical.criticalSuccess], ["Critical", true]);
    assert.equal(throwPool(1, miss, miss, miss).outcome, "Miss");
    assert.ok(pool.resolution.botch, "the example pool has a botch");
    const botched = throwPool(1, 1, miss, miss);
    assert.deepEqual([botched.outcome, botched.criticalFailure], ["Miss", true], "a botch is the worst band");

    // ── The record, the summary and the Game Master ──
    const cards = [{ name: "Bram the Quiet", rulesetSheet: null }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(pool, cards, cards[0]),
    };
    const result = resolveSkillCheckWithContext(context as any, { skill: "Ward", dc: 2 });
    assert.ok(result.outcome, "a resolved check names its band");
    const record = serializeResolvedSkillCheckTag(result);
    assert.match(record, new RegExp(`outcome="${result.outcome}"`));
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1));
    assert.equal(back?.resolvedResult?.outcome, result.outcome, "the band reads back");
    assert.match(
      formatSkillCheckResultSummary(result),
      new RegExp(`${result.outcome} \\((success|failure)\\)\\.`),
      "the summary says the band and whether it succeeded",
    );

    // A summed ruleset with bands never adopts a record the Game Master wrote, however tidy.
    const d20 = parsed(d20Doc());
    const d20Cards = [{ name: "Mira", rulesetSheet: null }];
    const d20Context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(d20, d20Cards, d20Cards[0]),
    };
    const claimed = `[skill_check: skill="Sway" dc="10" rolls="15" used="15" modifier="0" total="15" result="success" mode="normal" resolution="sum" dice="1d20" outcome="Success"]`;
    const resolved = await resolveSkillCheckTagsInContent(claimed, {
      loadContext: async () => d20Context as any,
      rulesetPinned: true,
    });
    assert.ok(resolved.results?.length === 1, "the claimed record was rolled again by the Engine");

    const base = {
      turnNumber: 2,
      gameActiveState: "exploration" as const,
      partyNames: ["Bram the Quiet"],
      playerName: "Mira",
    };
    const poolReminder = buildGmFormatReminder({ ...base, ruleset: pool });
    assert.match(
      poolReminder,
      /outcome="\.\.\." with the band it landed in: Critical \(3 or more successes, success\); Good \(2 or more successes, success\); Barely \(1 or more successes, success: It works, at a cost\.\); Miss \(below that, failure\)\./,
    );
    const sumReminder = buildGmFormatReminder({ ...base, ruleset: d20 });
    assert.match(sumReminder, /Critical success \(10 or more points past the dc, success\)/);
    assert.match(sumReminder, /highest face moves the band one better, its lowest one worse/);
    assert.doesNotMatch(buildGmFormatReminder({ ...base, ruleset: parsed(JSON.parse(emberText)) }), /outcome="/);
  }

  // ── The install gate: 1.135 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-outcome-bands",
      name: "Outcome bands",
      version: "0.1.0",
      description: "A packaged ruleset whose checks land in bands.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const doc = d20Doc();
    assert.match(
      getCapabilityPackageInstallIssue(manifest(134) as any, doc) ?? "",
      /outcome bands requires schemaVersion 2 and capabilityApi 1\.135/,
    );
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(135) as any, doc) ?? "", /outcome bands/);
    assert.doesNotMatch(
      getCapabilityPackageInstallIssue(manifest(134) as any, JSON.parse(emberText)) ?? "",
      /outcome bands/,
      "a ruleset without bands needs nothing new",
    );
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
