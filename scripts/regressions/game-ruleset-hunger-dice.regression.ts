/**
 * Special dice and paired faces in a pool (Capability API 1.823): Vampire V5's Hunger dice and
 * paired 10s.
 *
 * What is pinned here:
 *   - The schema takes a d10 pool with `hunger` and `pairs`, and refuses a paired face below the
 *     target and pairs beside `double`.
 *   - Each pair of 10s counts 4 successes, three 10s count 5, and a success with a pair is critical.
 *   - `hunger=` makes the first dice special, held to `hunger.max` and the pool; a critical with a
 *     special 10 is messy, a failure with a special 1 is bestial; a re-throw never touches them.
 *   - Through the resolver, the record and the Game Master; a packaged ruleset declares 1.823.
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
  rulesetPoolMaxSuccesses,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-hunger-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const gravewatchText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url)),
    "utf8",
  );
  /** Gravewatch thrown as V5: a fixed 6+ on d10s, no explosions, cancels or botches. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(gravewatchText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? [])
      .filter((catalog: { holds?: string }) => catalog.holds !== "creatures")
      .map((catalog: Record<string, any>) => ({
        ...catalog,
        entries: (catalog.entries ?? []).filter((entry: any) => !entry.mechanics?.check),
      }));
    for (const skill of document.sheet.skills) if (skill.untrained === "harder") delete skill.untrained;
    const resolution = document.resolution;
    for (const key of ["explode", "cancel", "botch", "exceptional"]) delete resolution[key];
    resolution.target = { default: 6, min: 6, max: 6 };
    for (const step of resolution.difficultyLadder) delete step.target;
    resolution.pairs = { from: 10, successes: 4 };
    resolution.hunger = { label: "Hunger", max: 5, text: "The Beast acts on a messy critical or a bestial failure." };
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
  const v5 = parsed(doc());
  {
    refuses(
      doc((d) => (d.resolution.pairs.from = 5)),
      /at or above the highest target/,
      "a paired face that would not succeed",
    );
    refuses(
      doc((d) => (d.resolution.double = { from: 10 })),
      /leave double and stances out/,
      "pairs beside double",
    );
    assert.ok(v5.resolution.kind === "dice-pool");
    refuses(
      doc((d) => (d.resolution.hunger.max = d.resolution.pool.max + 1)),
      /Hunger dice come from the pool/,
      "more hunger dice than the pool holds",
    );
    // 15 dice: seven pairs of 4 and one die left over, which counts one.
    assert.equal(v5.resolution.pool.max, 15);
    assert.equal(rulesetPoolMaxSuccesses(v5.resolution), 29, "an odd die left over counts one, not half a pair");
  }

  // ── The roll ──
  {
    const roll = (dice: number, required: number, hunger: number | undefined, ...thrown: number[]) =>
      rollDicePoolCheck(v5, { modifier: dice, required, isSave: false, hunger }, faces(...thrown));
    // A pair of 10s, one of them a Hunger die: four successes for the pair, one for the 7, messy.
    const messy = roll(5, 1, 2, 10, 3, 10, 7, 2);
    assert.deepEqual(
      [messy.total, messy.success, messy.criticalSuccess, messy.hunger, messy.messy, messy.bestial],
      [5, true, true, 2, true, undefined],
    );
    // The pair on ordinary dice is a clean critical.
    const clean = roll(3, 1, 1, 4, 10, 10);
    assert.deepEqual([clean.total, clean.criticalSuccess, clean.messy], [4, true, undefined]);
    // Three 10s are one pair and one more: five.
    assert.equal(roll(3, 1, undefined, 10, 10, 10).total, 5);
    // One 10 is one success and no critical.
    const single = roll(2, 1, 1, 10, 2);
    assert.deepEqual([single.total, single.criticalSuccess, single.messy], [1, false, undefined]);
    // A failure with a Hunger die on a 1 is bestial; a success with one is not.
    const bestial = roll(4, 2, 2, 1, 3, 7, 2);
    assert.deepEqual([bestial.success, bestial.bestial, bestial.criticalFailure], [false, true, false]);
    assert.equal(roll(3, 1, 1, 1, 8, 2).bestial, undefined, "a success is never bestial");
    assert.equal(roll(3, 2, 1, 4, 1, 2).bestial, undefined, "a 1 on an ordinary die is not bestial");
    // Held to the ruleset's max and to the pool.
    assert.equal(roll(3, 1, 9, 2, 2, 2).hunger, 3);
    assert.equal(roll(8, 1, 9, 2, 2, 2, 2, 2, 2, 2, 2).hunger, 5);
    assert.equal(roll(3, 1, 0, 2, 2, 2).hunger, undefined, "no Hunger dice, nothing said");
    // A re-throw passes the Hunger dice by.
    const rethrown = rollDicePoolCheck(
      v5,
      { modifier: 2, required: 1, isSave: false, hunger: 1, bought: { reroll: { upTo: 5, mode: "once" } } },
      faces(2, 3, 8),
    );
    assert.deepEqual([rethrown.rolls, rethrown.rerolled], [[2, 8], 1]);
    // A pool without the keys rolls exactly as it did.
    const plain = parsed(doc((d) => (delete d.resolution.pairs, delete d.resolution.hunger)));
    const before = rollDicePoolCheck(plain, { modifier: 2, required: 1, isSave: false, hunger: 2 }, faces(10, 10));
    assert.deepEqual([before.total, before.criticalSuccess, before.hunger], [2, false, undefined]);

    // The record says the special dice and what they did, and reads back.
    const record = serializeResolvedSkillCheckTag({
      skill: "Dig",
      dc: 1,
      modifier: 0,
      resolution: "successes",
      ...messy,
      hungerLabel: "Hunger",
    });
    assert.match(record, /hunger="2" hungerLabel="Hunger" messy="true"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([back?.hunger, back?.hungerLabel, back?.messy, back?.total], [2, "Hunger", true, 5]);
    assert.match(formatSkillCheckResultSummary(back!), /2 Hunger dice \(the first 2\); a messy critical\.$/);
    const bestialBack = parseSkillCheckTagBody(
      serializeResolvedSkillCheckTag({ skill: "Dig", dc: 2, modifier: 0, resolution: "successes", ...bestial }).slice(
        "[skill_check:".length,
        -1,
      ),
    )?.resolvedResult;
    assert.equal(bestialBack?.bestial, true);
  }

  // ── Through the resolver, the Game Master and the package gate ──
  {
    assert.equal(parseSkillCheckTagBody('skill="Dig" dc="1" hunger="2"')?.hunger, 2);
    const cards = [{ name: "Wren", rulesetSheet: { v: v5.sheet.version, build: defaultRulesetSheetBuild(v5) } }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(v5, cards, cards[0]),
    };
    const result = resolveSkillCheckWithContext(context as any, { skill: "Wrestle", dc: 1, hunger: 2 });
    assert.equal(result.hunger, Math.min(2, result.rolls.length));
    assert.equal(result.hungerLabel, "Hunger");

    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: ["Wren"],
      playerName: "Wren",
      ruleset: v5,
    });
    assert.match(reminder, /Each pair of dice showing 10 or more counts 4 successes/);
    assert.match(reminder, /Add hunger="N" to make N of the pool's dice Hunger dice, up to 5/);

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-hunger",
      name: "Hunger",
      version: "0.1.0",
      description: "A packaged ruleset with special dice.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(822) as any, doc()) ?? "", /capabilityApi 1\.823/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(823) as any, doc()), null);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
