/**
 * A dice pool's target read off the sheet, stances and the exact face (Capability API 1.137).
 *
 * What is pinned here:
 *   - The schema refuses a stance naming an unknown skill, a skill in two stances, a stance beside a
 *     rule read against "at or above" (explode), and a `target.from` naming a value the sheet lacks.
 *   - Lasers & Feelings: the target is each character's Number off their sheet, which `threshold=`
 *     does not move; Lasers counts dice under it, Feelings over it, and a die on it is LASER
 *     FEELINGS, which counts as a success unless the ruleset says otherwise.
 *   - The record reads back with its direction and its exact dice, the summary says them, the Game
 *     Master is told the rule, and a packaged ruleset that has the keys declares 1.137.
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
  rollDicePoolCheck,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-pool-stances-"));
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
  const gravewatchText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url)),
    "utf8",
  );
  /** Gravewatch thrown as Lasers & Feelings: d6, the Number off Warmth, Lasers and Feelings stances. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(gravewatchText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string; id?: string }) => catalog.holds !== "creatures",
    );
    // A charm moves the explode face, which a stance leaves out.
    for (const catalog of document.catalogs) {
      for (const entry of catalog.entries ?? []) {
        const check = entry.mechanics?.check;
        if (!check) continue;
        delete check.explode;
        delete check.double;
        if (Object.keys(check).length === 0) delete entry.mechanics.check;
      }
    }
    const resolution = document.resolution;
    for (const key of ["explode", "double", "cancel", "botch", "reroll"]) delete resolution[key];
    for (const step of resolution.difficultyLadder) delete step.target;
    resolution.die = { sides: 6 };
    resolution.target = { default: 4, min: 2, max: 5, from: { abilityScore: "warmth" } };
    resolution.stances = [
      { id: "lasers", label: "Lasers", count: "below", skills: ["dig", "wrestle", "listen", "ward"] },
      { id: "feelings", label: "Feelings", count: "above", skills: ["soothe", "barter"] },
    ];
    resolution.exact = { label: "LASER FEELINGS", text: "ask the Game Master a question; they answer honestly." };
    edit?.(document);
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

  // ── The schema ──
  {
    parsed(doc());
    refuses(
      doc((d) => (d.resolution.stances[0].skills = ["dig", "sing"])),
      /Unknown skill "sing"/,
      "a stance naming a skill the sheet lacks",
    );
    refuses(
      doc((d) => d.resolution.stances[1].skills.push("dig")),
      /"dig" is in two stances/,
      "a skill in two stances",
    );
    refuses(
      doc((d) => (d.resolution.explode = { from: 6 })),
      /stances counts dice below or above the target, so it has no explode/,
      "a stance beside an exploding die",
    );
    refuses(
      doc((d) => (d.resolution.stances[1].id = "lasers")),
      /lasers/,
      "two stances with one id",
    );
    const missing = parseRulesetDefinition(doc((d) => (d.resolution.target.from = { abilityScore: "luck" })));
    assert.ok(!missing.ok, "a target read from an ability the sheet lacks");
  }

  // ── The roller ──
  const lf = parsed(doc());
  const roll = (stance: "below" | "above" | undefined, sheetTarget: number | undefined, ...thrown: number[]) =>
    rollDicePoolCheck(
      lf,
      { modifier: thrown.length, required: 1, isSave: false, sheetTarget, stance, threshold: 2 },
      faces(...thrown),
    );
  {
    // Number 3: Lasers count 1 and 2, Feelings 4 to 6, and a 3 is LASER FEELINGS either way.
    const lasers = roll("below", 3, 1, 2, 5);
    assert.deepEqual([lasers.threshold, lasers.total, lasers.compare, lasers.exact], [3, 2, "below", 0]);
    const feelings = roll("above", 3, 1, 2, 5);
    assert.deepEqual([feelings.total, feelings.compare], [1, "above"]);
    const insight = roll("above", 3, 3, 1);
    assert.deepEqual([insight.total, insight.exact, insight.success], [1, 1, true], "a die on the Number counts");
    assert.equal(roll("below", 3, 3, 3).exact, 2);
    // The Number is the character's: the Game Master's threshold="2" leaves it, and the range holds it.
    assert.equal(roll("below", 6, 1).threshold, 5, "held to the ruleset's range");
    assert.equal(roll("below", undefined, 1).threshold, 2, "with no sheet, threshold= moves it as before");
    // Without a stance a die counts at or above the target, and the exact die is not counted twice.
    const plain = roll(undefined, 3, 3, 4, 1);
    assert.deepEqual([plain.total, plain.exact, plain.compare], [2, 1, undefined]);
    // An exact face that does not count is still flagged.
    const flagged = parsed(doc((d) => (d.resolution.exact.counts = false)));
    const quiet = rollDicePoolCheck(
      flagged,
      { modifier: 2, required: 1, isSave: false, sheetTarget: 3, stance: "above" },
      faces(3, 1),
    );
    assert.deepEqual([quiet.total, quiet.exact, quiet.success], [0, 1, false]);
  }

  // ── Through the resolver, off each character's sheet ──
  {
    const build = defaultRulesetSheetBuild(lf);
    const cards = [
      {
        name: "Kit",
        rulesetSheet: { v: lf.sheet.version, build: { ...build, abilities: { ...build.abilities, warmth: 5 } } },
      },
      {
        name: "Ro",
        rulesetSheet: { v: lf.sheet.version, build: { ...build, abilities: { ...build.abilities, warmth: 2 } } },
      },
    ];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(lf, cards, cards[0]),
    };
    const kit = resolveSkillCheckWithContext(context as any, { skill: "Soothe", dc: 1, threshold: 3 } as any);
    assert.equal(kit.threshold, 5, "Kit's Number, not the Game Master's threshold");
    assert.equal(kit.compare, "above");
    const ro = resolveSkillCheckWithContext(context as any, { skill: "Wrestle", dc: 1, who: "Ro" } as any);
    assert.deepEqual([ro.threshold, ro.compare], [2, "below"]);

    // ── The record, the summary and the Game Master ──
    const rolled = roll("above", 3, 3, 5, 1);
    const result = {
      skill: "Soothe",
      dc: 1,
      modifier: 3,
      resolution: "successes" as const,
      ...rolled,
      exactLabel: "LASER FEELINGS",
    };
    const record = serializeResolvedSkillCheckTag(result);
    assert.match(record, /compare="above"/);
    assert.match(record, /exact="1" exactLabel="LASER FEELINGS"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([back?.compare, back?.exact, back?.exactLabel], ["above", 1, "LASER FEELINGS"]);
    assert.match(formatSkillCheckResultSummary(result), /1 die showed exactly 3: LASER FEELINGS\.$/);

    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration" as const,
      partyNames: ["Kit"],
      playerName: "Kit",
      ruleset: lf,
    });
    assert.match(reminder, /per-die target is .*Warmth.*; threshold does not change it\./);
    assert.match(reminder, /Lasers checks \(Dig, Wrestle, Listen, Ward\) count dice below the target\./);
    assert.match(reminder, /Feelings checks \(Soothe, Barter\) count dice above the target\./);
    assert.match(reminder, /exactly the target is LASER FEELINGS and counts as a success; the engine marks exact="N"/);
    assert.doesNotMatch(reminder, /threshold="/, "threshold= is not offered when the sheet sets the target");
  }

  // ── The gate ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-pool-stances",
      name: "Pool stances",
      version: "0.1.0",
      description: "A packaged ruleset with stances.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /counts by stance or flags exact faces requires schemaVersion 2 and capabilityApi 1\.137/;
    const only = (key: "stances" | "exact" | "from") =>
      doc((d) => {
        if (key !== "stances") delete d.resolution.stances;
        if (key !== "exact") delete d.resolution.exact;
        if (key !== "from") delete d.resolution.target.from;
      });
    for (const document of [only("stances"), only("exact"), only("from")]) {
      assert.match(getCapabilityPackageInstallIssue(manifest(136) as any, document) ?? "", gate);
      assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(137) as any, document) ?? "", gate);
    }
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
