/**
 * Rules a check can move for one roll (issue #6651): a difficulty named by its ladder step, a pool
 * rule whose face a check may move, two abilities rolled together, and a botch read off half the
 * dice. Capability API 1.37.
 *
 * What is pinned here:
 *   - A ladder step at the table: `difficulty="Label"` supplies the number (successes on a pool, the
 *     difficulty on a sum) and, on a pool, its per-die target; a bare `dc=` uses the target of the ONE
 *     step needing that many successes; `threshold=` and `dc=` still win; a name no step answers to,
 *     or two steps share, is ignored. The record writes the numbers, never the name.
 *   - A tag that names only a difficulty is an ask: kept by the reader, rolled only where a ladder
 *     can read it, left as written in a game without one, and kept whole by a sparse rewrite.
 *   - `explode` and `double` with a `min`: the schema's refusals, the roller's clamp and its
 *     precedence (an entry, then the tag, then the file), a rule with no `from` firing only when
 *     asked, the record saying a face only when the check moved it, and an entry refused at import
 *     where no check may move the rule.
 *   - `pool.abilityPlusAbility`: an ability check adds a second ability, a skill keeps swapping, and
 *     a summed ruleset cannot declare it.
 *   - `botch.rule: "halfOrMore"`: counted over the dice first thrown, a critical failure only with no
 *     success, a complication alongside any other result, written and read back by the record.
 *   - The Game Master's reminder offers each of these only where the ruleset declares it.
 *   - The skill-check endpoint and the one-request branch arm read a named difficulty too.
 *   - Every new key needs Capability API 1.37 to install, inline or in a catalog file.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  formatSkillCheckResultSummary,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollDicePoolCheck,
  rulesetCheckModifier,
  rulesetDifficultyStep,
  rulesetLadderTargetFor,
  rulesetPoolMaxSuccesses,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  type RulesetDefinition,
  type SkillCheckResult,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-check-rules-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { boundPoolCheckRequest, buildSkillCheckRulesetContext, resolveSkillCheckTagsInContent, readRulesetDifficulty },
  { buildGmFormatReminder },
  { getCapabilityPackageInstallIssue },
  { createGameTurnChanceSession, resolveGameTurnBranches },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/gm-prompts.js"),
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../packages/server/src/services/game/one-request-dice.js"),
]);

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");

const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
/** Gravewatch, optionally edited first. Its layer swaps the ladder, so it goes wherever the ladder
 *  under test is not the shipped one. */
const pool = (edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition => {
  const doc = JSON.parse(gravewatchText) as Record<string, any>;
  edit(doc);
  return parsedOrThrow(doc, "the pool example");
};
const refuses = (base: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
  const doc = JSON.parse(base) as Record<string, any>;
  edit(doc);
  const parsed = parseRulesetDefinition(doc);
  assert.ok(!parsed.ok, `${why}: it should have been refused`);
  assert.ok(
    parsed.issues.some((issue) => pattern.test(issue)),
    `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
  );
};
/** A die that hands out a written sequence, then repeats its last value. */
const scripted = (values: readonly number[]) => {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 1;
};

const gravewatch = pool();
const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
/** A ladder of seven steps at one success each, every one naming its own target: the shape a
 *  difficulty picked by its NAME exists for, since `dc` alone cannot say which of them was meant. */
const sevenSteps = pool((doc) => {
  delete doc.layers;
  doc.resolution.target = { default: 6, min: 3, max: 9 };
  doc.resolution.cancel = { upTo: 1 };
  doc.resolution.botch = { upTo: 1 };
  doc.resolution.difficultyLadder = [
    { label: "Easy", successes: 1, target: 3 },
    { label: "Routine", successes: 1, target: 4 },
    { label: "Straightforward", successes: 1, target: 5 },
    { label: "Standard", successes: 1, target: 6 },
    { label: "Challenging", successes: 1, target: 7 },
    { label: "Difficult", successes: 1, target: 8 },
    { label: "Extremely difficult", successes: 1, target: 9 },
  ];
});

const cards = (definition: RulesetDefinition) => [
  { name: "Mira", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } },
];
const contextFor = (definition: RulesetDefinition): SkillCheckModifierContext => {
  const party = cards(definition);
  return {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(definition, party, party[0]),
  };
};
/** One check through the resolver a generated turn uses, in a game pinned to `definition`. */
const resolve = async (definition: RulesetDefinition, tag: string) => {
  const rolled = await resolveSkillCheckTagsInContent(tag, {
    loadContext: async () => contextFor(definition),
    rulesetPinned: true,
  });
  return rolled;
};
const only = (rolled: Awaited<ReturnType<typeof resolve>>): SkillCheckResult => {
  assert.equal(rolled.resolved, 1, `one check should have been rolled: ${rolled.content}`);
  return rolled.results![0]!;
};

try {
  // ── G3: a ladder step, picked by name ──
  {
    // The lookup: without case or punctuation, and only a name exactly one step answers to.
    assert.equal(rulesetDifficultyStep(gravewatch, "Grim")?.label, "Grim");
    assert.equal(rulesetDifficultyStep(gravewatch, " plain  WORK ")?.label, "Plain work");
    assert.equal(rulesetDifficultyStep(gravewatch, "Nope"), null);
    assert.equal(rulesetDifficultyStep(gravewatch, undefined), null);
    const shared = pool((doc) => {
      delete doc.layers;
      doc.resolution.difficultyLadder.push({ label: "Grim", successes: 4 });
    });
    assert.equal(rulesetDifficultyStep(shared, "Grim"), null, "a name two steps share picks neither");
    assert.equal(rulesetDifficultyStep(ember, "Hard")?.label, "Hard");

    // The one step needing exactly that many successes names the target; several, or none, do not.
    assert.equal(rulesetLadderTargetFor(gravewatch, 1), 6);
    assert.equal(rulesetLadderTargetFor(gravewatch, 2), undefined, "Awkward names no target");
    assert.equal(rulesetLadderTargetFor(gravewatch, 3), 8);
    assert.equal(rulesetLadderTargetFor(gravewatch, 4), undefined, "no step needs four");
    assert.equal(rulesetLadderTargetFor(sevenSteps, 1), undefined, "seven steps need one: none of them is meant");
    assert.equal(rulesetLadderTargetFor(ember, 1), undefined, "a sum has no per-die target");

    // At the table. `dc=` alone rolls at the one step's target, or the ruleset's default.
    assert.equal(only(await resolve(gravewatch, `[skill_check: skill="Ward" dc="1"]`)).threshold, 6);
    assert.equal(only(await resolve(gravewatch, `[skill_check: skill="Ward" dc="2"]`)).threshold, 7);
    assert.equal(only(await resolve(gravewatch, `[skill_check: skill="Ward" dc="3"]`)).threshold, 8);
    assert.equal(only(await resolve(sevenSteps, `[skill_check: skill="Ward" dc="1"]`)).threshold, 6);

    // A name supplies both numbers, and the record says the numbers rather than the name.
    const grim = await resolve(gravewatch, `[skill_check: skill="Ward" difficulty="Grim"]`);
    assert.deepEqual([only(grim).dc, only(grim).threshold], [3, 8]);
    assert.match(grim.content, /dc="3"/);
    assert.match(grim.content, /threshold="8"/);
    assert.doesNotMatch(grim.content, /difficulty=/, "a rolled record carries the numbers the step stood for");
    const difficult = only(await resolve(sevenSteps, `[skill_check: skill="Ward" difficulty="Difficult"]`));
    assert.deepEqual([difficult.dc, difficult.threshold], [1, 8], "difficulty 8 is one success at 8, not eight");
    assert.equal(only(await resolve(gravewatch, `[skill_check: skill="Ward" difficulty="grim"]`)).dc, 3);

    // `dc=` and `threshold=` still win where they were written; a step with no target leaves the default.
    const both = only(await resolve(gravewatch, `[skill_check: skill="Ward" dc="2" difficulty="Grim"]`));
    assert.deepEqual([both.dc, both.threshold], [2, 8], "the number written wins, the step's target still applies");
    const moved = only(await resolve(gravewatch, `[skill_check: skill="Ward" difficulty="Grim" threshold="5"]`));
    assert.deepEqual([moved.dc, moved.threshold], [3, 5]);
    const awkward = only(await resolve(gravewatch, `[skill_check: skill="Ward" dc="3" difficulty="Awkward"]`));
    assert.equal(awkward.threshold, 7, "the named step has no target, so the default, not the dc's step");

    // A name no step answers to is ignored, like an unknown `with=`.
    const nope = only(await resolve(gravewatch, `[skill_check: skill="Ward" dc="2" difficulty="Nope"]`));
    assert.deepEqual([nope.dc, nope.threshold], [2, 7]);
    const nothing = await resolve(gravewatch, `[skill_check: skill="Ward" difficulty="Nope"]`);
    assert.deepEqual([nothing.resolved, nothing.left], [0, 1]);
    assert.equal(
      nothing.content,
      `[skill_check: skill="Ward" difficulty="Nope"]`,
      "an ask nothing can read stays as written",
    );

    // A summed ruleset reads its ladder's difficulty.
    const hard = only(await resolve(ember, `[skill_check: skill="Sneak" difficulty="Hard"]`));
    assert.equal(hard.dc, 10);
    assert.equal(hard.resolution, "sum");
    assert.equal(hard.threshold, undefined);

    // Read back: an ask with no number is a check, an attribute neither way names nothing.
    const ask = parseSkillCheckTagBody(` skill="Ward" difficulty="Grim"`);
    assert.deepEqual([ask?.dc, ask?.difficulty, ask?.resolvedResult], [undefined, "Grim", undefined]);
    assert.equal(parseSkillCheckTagBody(` skill="Ward"`), null);
    const claimed = parseSkillCheckTagBody(
      ` skill="Ward" difficulty="Grim" rolls="9|3" modifier="0" total="1" result="success" resolution="successes" dice="2d10"`,
    );
    assert.equal(claimed?.resolvedResult, undefined, "a record always has the number it was rolled against");
    const d20Ask = parseSkillCheckTagBody(` skill="Sneak" difficulty="Hard" rolls="14"`);
    assert.equal(d20Ask?.preRolledD20, 14, "the player's own die is still picked up beside a named difficulty");

    // A game with no ladder leaves such an ask exactly as it was.
    const legacy = await resolveSkillCheckTagsInContent(`[skill_check: skill="Stealth" difficulty="Hard"]`, {
      loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }),
    });
    assert.deepEqual([legacy.resolved, legacy.left], [0, 1]);
    assert.equal(legacy.content, `[skill_check: skill="Stealth" difficulty="Hard"]`);

    // A roll that cannot happen keeps the ask whole: the name and the faces the check asked for.
    const failed = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" difficulty="Grim" explode="9"]`, {
      loadContext: async () => {
        throw new Error("the snapshot would not load");
      },
      rulesetPinned: true,
    });
    assert.equal(failed.content, `[skill_check: skill="Ward" difficulty="Grim" explode="9"]`);
    assert.equal(
      serializeSparseSkillCheckTag({ skill: "Ward" }, { difficulty: "Grim", explode: 9, double: 8 }),
      `[skill_check: skill="Ward" difficulty="Grim" explode="9" double="8"]`,
    );

    // The sighted pool binds its request before the ruleset is read, so it carries the whole ask with
    // it for whichever path rolls it, a step named in place of a number included.
    const bound = boundPoolCheckRequest(
      parseSkillCheckTagBody(` skill="Ward" dc="1" difficulty="Grim" explode="9" double="8"`)!,
    );
    assert.deepEqual([bound?.dc, bound?.difficulty, bound?.explode, bound?.double], [1, "Grim", 9, 8]);
    const named = boundPoolCheckRequest(parseSkillCheckTagBody(` skill="Ward" difficulty="Grim"`)!);
    assert.deepEqual([named?.dc, named?.difficulty], [undefined, "Grim"]);

    // And spends the d20 the Game Master saw on it once the ladder is read: the step's number, the
    // pool's die. A step no ladder has goes back as the ask, the way an overflow does.
    {
      const { createGameDicePoolSession } =
        await import("../../packages/server/src/services/game/dice-pool.service.js");
      const { createGameDicePool, DEFAULT_GAME_DICE_POOL_WINDOW, DEFAULT_GAME_DICE_POOL_AGE_TURNS } =
        await import("../../packages/shared/src/index.js");
      const emberDoc = JSON.parse(emberText);
      emberDoc.resolution.dice = { count: 1, sides: 20 };
      const d20Ember = parsedOrThrow(emberDoc, "a d20 Ember Roads");
      const sessionWith = (values: number[]) => {
        const sighted = createGameDicePool(() => 1);
        sighted.values.d20 = values;
        return createGameDicePoolSession({
          chatId: "chat-check-rules-pool",
          pool: sighted,
          settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
        });
      };
      const pooled = await resolveSkillCheckTagsInContent(
        `[skill_check: skill="Sneak" difficulty="Hard" pool="d20:1"]`,
        {
          loadContext: async () => contextFor(d20Ember),
          rulesetPinned: true,
          pool: sessionWith([14, 3]),
        },
      );
      assert.equal(pooled.resolved, 1);
      assert.match(pooled.content, /dc="10" rolls="14"/, "the ladder's number, the pool's die");
      assert.match(pooled.content, /pool="d20:1"/);
      const lost = await resolveSkillCheckTagsInContent(`[skill_check: skill="Sneak" difficulty="Nope" pool="d20:1"]`, {
        loadContext: async () => contextFor(d20Ember),
        rulesetPinned: true,
        pool: sessionWith([14, 3]),
      });
      assert.deepEqual([lost.resolved, lost.left, lost.sparse], [0, 1, 1]);
      assert.equal(lost.content, `[skill_check: skill="Sneak" difficulty="Nope"]`);
    }

    // The request reader fills the number only where it can.
    assert.equal(readRulesetDifficulty({ skill: "Ward", difficulty: "Grim" }, gravewatch).dc, 3);
    assert.equal(readRulesetDifficulty({ skill: "Ward", difficulty: "Grim", dc: 1 }, gravewatch).dc, 1);
    assert.equal(readRulesetDifficulty({ skill: "Ward", difficulty: "Grim" }).dc, undefined);
  }

  // ── G4: a pool rule's face, moved for one check ──
  {
    // The schema: a rule says something, its default is not below how far a check may move it, and
    // every face it names is a face of the die.
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.explode = {}),
      /^resolution\.explode: Give from, min or both/,
      "an empty rule",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.explode = { from: 7, min: 8 }),
      /^resolution\.explode\.from: from is below min/,
      "a default below the lowest face a check may ask for",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.double = { min: 11 }),
      /^resolution\.double\.min: /,
      "a face the die has not got",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.explode = { from: 10 }),
      /mechanics\.check\.explode: This ruleset gives resolution\.explode no min/,
      "an entry cannot move a rule no check may move",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.catalogs[0].entries[1].mechanics.check.explode = 7),
      /mechanics\.check\.explode: This ruleset lets a check move explode from 8 to 10/,
      "an entry cannot move it further than a check may",
    );
    refuses(
      emberText,
      (doc) => (doc.resolution.pool = { min: 1, max: 5, abilityPlusAbility: true }),
      /^resolution: /,
      "a summed ruleset has no pool to add two abilities into",
    );
    const onAsk = pool((doc) => {
      delete doc.layers;
      doc.resolution.explode = { min: 10 };
      doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
    });
    assert.equal(onAsk.resolution.kind === "dice-pool" && onAsk.resolution.explode?.from, undefined);
    assert.equal(
      rulesetPoolMaxSuccesses(onAsk.resolution as never),
      30,
      "a rule a check may turn on still counts toward the most a roll can count",
    );

    const roll = (definition: RulesetDefinition, input: Record<string, unknown>, faces: number[]) =>
      rollDicePoolCheck(definition, { modifier: 3, required: 1, isSave: false, ...input }, scripted(faces));

    // Gravewatch explodes on 10 and lets a check lower it to 8.
    const plain = roll(gravewatch, {}, [9, 3, 10, 2]);
    assert.deepEqual(plain.rolls, [9, 3, 10, 2], "only the 10 rolled again");
    assert.equal(plain.explodeFrom, 10);
    const nine = roll(gravewatch, { explode: 9 }, [9, 3, 10, 2, 4]);
    assert.deepEqual(nine.rolls, [9, 3, 10, 2, 4], "the 9 and the 10 each rolled one more die");
    assert.equal(nine.explodeFrom, 9);
    assert.equal(roll(gravewatch, { explode: 7 }, [5]).explodeFrom, 8, "clamped up to the lowest face allowed");
    assert.equal(roll(gravewatch, { explode: 42 }, [5]).explodeFrom, 10, "clamped down to the die's own top face");
    // An entry the character used outranks the tag, as a bought threshold does.
    assert.equal(roll(gravewatch, { explode: 9, bought: { explode: 8 } }, [5]).explodeFrom, 8);
    // Where the file gives no min, the ask is ignored and the file's own face stands.
    const fixed = pool((doc) => {
      delete doc.layers;
      doc.resolution.explode = { from: 10 };
      doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
    });
    const ignored = roll(fixed, { explode: 9 }, [9, 3, 10, 2]);
    assert.deepEqual(ignored.rolls, [9, 3, 10, 2]);
    assert.equal(ignored.explodeFrom, 10);
    // A rule with only a min fires only when a check asks.
    assert.deepEqual(roll(onAsk, {}, [10, 3, 10]).rolls, [10, 3, 10], "no explosion unless asked");
    assert.equal(roll(onAsk, {}, [10, 3, 10]).explodeFrom, undefined);
    assert.deepEqual(roll(onAsk, { explode: 10 }, [10, 3, 10, 4, 5]).rolls, [10, 3, 10, 4, 5]);

    // Doubling moves the same way.
    const doubling = pool((doc) => {
      delete doc.layers;
      delete doc.resolution.explode;
      doc.resolution.double = { from: 10, min: 8 };
      doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
    });
    const doubled = rollDicePoolCheck(
      doubling,
      { modifier: 3, required: 1, isSave: false, threshold: 7, double: 9 },
      scripted([9, 7, 2]),
    );
    assert.equal(doubled.total, 3, "the 9 counts twice and the 7 once");
    assert.equal(doubled.doubleFrom, 9);

    // The tag: a whole face, or nothing.
    const tag = parseSkillCheckTagBody(` skill="Ward" dc="1" explode="9" double="8"`);
    assert.deepEqual([tag?.explode, tag?.double], [9, 8]);
    assert.equal(parseSkillCheckTagBody(` skill="Ward" dc="1" explode="9.5"`)?.explode, undefined);

    // Through the resolver: the record says a face only when the check moved it.
    const movedRecord = await resolve(gravewatch, `[skill_check: skill="Ward" dc="1" explode="9"]`);
    assert.equal(only(movedRecord).explodeFrom, 9);
    assert.match(movedRecord.content, /explode="9"/);
    const unmoved = await resolve(gravewatch, `[skill_check: skill="Ward" dc="1" explode="10"]`);
    assert.equal(only(unmoved).explodeFrom, undefined);
    assert.doesNotMatch(unmoved.content, /explode=/, "the file's own face is not news");
  }

  // ── G5: two abilities rolled together ──
  {
    const pair = matchRulesetCheckTarget(gravewatch, "Nerve", "Warmth");
    assert.deepEqual(pair, { type: "ability", id: "nerve", label: "Nerve", withAbility: "warmth" });
    const warden = evaluateRulesetSheet(gravewatch, {
      ...defaultRulesetSheetBuild(gravewatch),
      abilities: { sinew: 3, nerve: 2, warmth: 4 },
    });
    assert.equal(rulesetCheckModifier(warden, pair), 2 + 4);
    assert.equal(rulesetCheckModifier(warden, matchRulesetCheckTarget(gravewatch, "Nerve")), 2);
    // An ability nobody answers to adds nothing; a skill keeps swapping rather than adding.
    assert.equal(rulesetCheckModifier(warden, matchRulesetCheckTarget(gravewatch, "Nerve", "Luck")), 2);
    const ward = matchRulesetCheckTarget(gravewatch, "Ward", "Sinew");
    assert.equal(ward?.type, "skill");
    assert.equal(ward?.withAbility, "sinew");
    // Without the switch, `with=` on an ability check still means nothing.
    const unpaired = pool((doc) => delete doc.resolution.pool.abilityPlusAbility);
    assert.equal(matchRulesetCheckTarget(unpaired, "Nerve", "Warmth")?.withAbility, undefined);

    // The record names the second ability, so a reader can tell where the extra dice came from.
    const rolled = await resolve(gravewatch, `[skill_check: skill="Nerve" dc="1" with="Warmth"]`);
    assert.equal(only(rolled).withAbility, "Warmth");
    assert.match(rolled.content, /with="Warmth"/);
    const plainRoll = await resolve(unpaired, `[skill_check: skill="Nerve" dc="1" with="Warmth"]`);
    assert.equal(only(plainRoll).withAbility, undefined, "a pairing that did not happen is not claimed");
  }

  // ── G13: a botch off half the dice ──
  {
    const half = pool((doc) => {
      delete doc.layers;
      doc.resolution.die = { sides: 6 };
      doc.resolution.target = { default: 5, min: 5, max: 5 };
      doc.resolution.difficultyLadder = [{ label: "Standard", successes: 1 }];
      delete doc.resolution.explode;
      delete doc.resolution.cancel;
      delete doc.resolution.exceptional;
      doc.resolution.situationalDice = { min: -3, max: 3 };
      doc.resolution.botch = { upTo: 1, rule: "halfOrMore" };
      doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
    });
    const throwIt = (faces: number[], input: Record<string, unknown> = {}) =>
      rollDicePoolCheck(half, { modifier: faces.length, required: 1, isSave: false, ...input }, scripted(faces));

    // Two hits and four ones out of seven: the check stands and something went wrong alongside it.
    const slipped = throwIt([6, 1, 1, 1, 5, 1, 4]);
    assert.deepEqual(
      [slipped.total, slipped.success, slipped.criticalFailure, slipped.complication],
      [2, true, false, true],
    );
    // No hits and four ones: the whole roll went wrong.
    const crashed = throwIt([1, 1, 1, 1, 2, 3, 4]);
    assert.deepEqual(
      [crashed.total, crashed.success, crashed.criticalFailure, crashed.complication],
      [0, false, true, false],
    );
    // Fewer than half is nothing; exactly half is enough.
    assert.equal(throwIt([6, 1, 2, 3]).complication, false);
    assert.equal(throwIt([6, 1, 1, 3]).complication, true);
    // A roll that failed without going wrong entirely keeps its failure, and the complication alongside it.
    const missed = throwIt([2, 1, 1, 4], { modifier: 4, required: 1 });
    assert.deepEqual([missed.success, missed.criticalFailure, missed.complication], [false, true, false]);
    // Counted over the dice first thrown: an explosion adds dice that do not change what half was.
    const exploding = pool((doc) => {
      delete doc.layers;
      doc.resolution.die = { sides: 6 };
      doc.resolution.target = { default: 5, min: 5, max: 5 };
      doc.resolution.difficultyLadder = [{ label: "Standard", successes: 1 }];
      doc.resolution.explode = { from: 6 };
      delete doc.resolution.cancel;
      delete doc.resolution.exceptional;
      doc.resolution.botch = { upTo: 1, rule: "halfOrMore" };
      doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
    });
    const chained = rollDicePoolCheck(
      exploding,
      { modifier: 2, required: 1, isSave: false },
      scripted([1, 6, 6, 6, 2]),
    );
    assert.deepEqual(chained.rolls, [1, 6, 6, 6, 2]);
    assert.equal(chained.complication, true, "one one out of the TWO dice first thrown is half");
    // An empty pool threw nothing, so nothing went wrong on the side of it.
    const empty = rollDicePoolCheck(
      pool((doc) => {
        delete doc.layers;
        doc.resolution.pool = { min: 0, max: 15 };
        doc.resolution.botch = { upTo: 1, rule: "halfOrMore" };
      }),
      { modifier: 0, required: 1, isSave: false },
      scripted([1]),
    );
    assert.deepEqual([empty.rolls.length, empty.complication, empty.criticalFailure], [0, false, false]);
    // The default reads a botch exactly as it always has.
    const shipped = rollDicePoolCheck(gravewatch, { modifier: 3, required: 1, isSave: false }, scripted([1, 1, 7]));
    assert.deepEqual([shipped.criticalFailure, shipped.complication], [false, false]);

    // The record writes it, reads it back, and the summary says it after the outcome.
    const result: SkillCheckResult = {
      skill: "Ward",
      dc: 1,
      rolls: [6, 1, 1, 1],
      usedRoll: 1,
      modifier: 0,
      total: 1,
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution: "successes",
      dice: "4d6",
      threshold: 5,
      complication: true,
    };
    const record = serializeResolvedSkillCheckTag(result);
    assert.match(record, /result="success" .*complication="true"\]$/);
    const back = parseSkillCheckTagBody(/\[skill_check:([^\]]+)\]/.exec(record)![1]!);
    assert.equal(back?.resolvedResult?.complication, true);
    assert.match(formatSkillCheckResultSummary(result), /Success\. Something went wrong on the side\.$/);
    assert.doesNotMatch(serializeResolvedSkillCheckTag({ ...result, complication: undefined }), /complication/);
  }

  // ── The Game Master is taught each of these only where the ruleset declares it ──
  {
    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: [], playerName: "Mira" };
    const reminder = buildGmFormatReminder({ ...base, ruleset: gravewatch });
    assert.match(reminder, /Or name a step with difficulty="Label" in place of dc\. A step's target is the one/);
    assert.match(
      reminder,
      /Add explode="N" to make dice showing N or more roll one more die on this check, from 8 to 10; without it dice showing 10 or more do\./,
    );
    assert.doesNotMatch(reminder, /double="N"/, "Gravewatch does not double");
    assert.match(reminder, /On an ability check, with= adds a second ability's dice: skill="Sinew" with="Nerve"\./);
    assert.doesNotMatch(reminder, /complication/, "its botch is the default one");

    const quiet = buildGmFormatReminder({
      ...base,
      ruleset: pool((doc) => {
        delete doc.layers;
        doc.resolution.explode = { from: 10 };
        delete doc.resolution.pool.abilityPlusAbility;
        doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
      }),
    });
    assert.doesNotMatch(quiet, /explode="N"/);
    assert.doesNotMatch(quiet, /On an ability check/);

    const asked = buildGmFormatReminder({ ...base, ruleset: sevenSteps });
    const glitchy = buildGmFormatReminder({
      ...base,
      ruleset: pool((doc) => {
        delete doc.layers;
        doc.resolution.explode = { min: 9 };
        doc.resolution.botch = { upTo: 1, rule: "halfOrMore" };
        doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
      }),
    });
    assert.match(glitchy, /from 9 to 10; without it none do\./);
    assert.match(glitchy, /complication="true" kept its result/);
    assert.match(asked, /difficulty="Label"/);

    const summed = buildGmFormatReminder({ ...base, ruleset: ember });
    assert.match(
      summed,
      /Difficulty: Easy 6, Risky 8, Hard 10, Desperate 12\. Or name a step with difficulty="Label" in place of dc\./,
    );
    assert.doesNotMatch(summed, /A step's target/);
  }

  // ── The one-request branch arm reads a named difficulty once the sheet is loaded ──
  {
    const d20 = parsedOrThrow(
      (() => {
        const doc = JSON.parse(emberText);
        doc.resolution.dice = { count: 1, sides: 20 };
        return doc;
      })(),
      "a d20 Ember Roads",
    );
    const branch = (difficulty: string, face: number) =>
      resolveGameTurnBranches(
        [
          `Before. [skill_check: skill="Sneak" difficulty="${difficulty}" branch="door"]`,
          `[branch: door]`,
          `[on success] It opens.`,
          `[on failure] It holds.`,
          `[/branch]`,
        ].join("\n"),
        createGameTurnChanceSession({
          db: null as never,
          chatId: "lane",
          roll: () => face,
          loadModifierContext: () => Promise.resolve(contextFor(d20)),
        }),
      );
    const opened = await branch("Hard", 15);
    assert.match(opened.content, /dc="10"/, "the step's difficulty is the one rolled against");
    assert.match(opened.content, /It opens\./);
    assert.doesNotMatch(opened.content, /It holds\./);
    const refused = await branch("Nope", 15);
    assert.doesNotMatch(refused.content, /It opens\.|It holds\./, "no roll, so neither half is kept");
    assert.match(
      refused.content,
      /\[skill_check: skill="Sneak" difficulty="Nope" branch="door"\]/,
      "and the ask stays",
    );
  }

  // ── Every new key needs 1.37 to install ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-test",
      name: "Test",
      version: "0.1.0",
      description: "A packaged ruleset.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json", "catalogs/charms.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const issue =
      /pool checks can move their rules, add two abilities or read a botch off half the dice requires schemaVersion 2 and capabilityApi 1\.37 or newer/;
    const resolutions = [
      { kind: "dice-pool", explode: { from: 10, min: 8 } },
      { kind: "dice-pool", double: { min: 9 } },
      { kind: "dice-pool", pool: { min: 1, max: 9, abilityPlusAbility: true } },
      { kind: "dice-pool", botch: { upTo: 1, rule: "halfOrMore" } },
    ];
    for (const resolution of resolutions) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(36) as never, { resolution }) ?? "",
        issue,
        JSON.stringify(resolution),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(37) as never, { resolution }), null);
    }
    // A rule that only says `from`, as every file before 1.37 did, needs nothing new.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(24) as never, {
        resolution: { kind: "dice-pool", explode: { from: 10 } },
      }),
      null,
    );
    const charm = { id: "c", label: "C", mechanics: { kind: "utility", check: { explode: 8 } } };
    const inline = { catalogs: [{ id: "charms", label: "Charms", feeds: ["charms"], entries: [charm] }] };
    assert.match(getCapabilityPackageInstallIssue(manifest(36) as never, inline) ?? "", issue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(37) as never, inline), null);
    const asset = { catalogs: [{ id: "charms", label: "Charms", feeds: ["charms"], asset: "catalogs/charms.json" }] };
    const files = new Map([
      ["catalogs/charms.json", { entries: [{ ...charm, mechanics: { kind: "utility", check: { double: 9 } } }] }],
    ]);
    assert.match(getCapabilityPackageInstallIssue(manifest(36) as never, asset, files) ?? "", issue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(37) as never, asset, files), null);
  }

  // ── The endpoint a client falls back on reads a named difficulty too ──
  {
    const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
    const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
    const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
    const { createGameRulesetsStorage } =
      await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
    const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
    const db = await getDB();
    const app = Fastify();
    app.decorate("db", db);
    await app.register(gameRoutes, { prefix: "/api/game" });
    try {
      await createGameRulesetsStorage(db).put({
        rulesetId: "local/gravewatch",
        version: gravewatch.version,
        sourceKind: "local",
        definition: gravewatchText,
      });
      const chats = createChatsStorage(db);
      const chat = await chats.create({ name: "Check rules", mode: "game", characterIds: [] } as never);
      assert.ok(chat);
      await chats.patchMetadata(chat.id, {
        gameRuleset: { id: "local/gravewatch", version: gravewatch.version, packageId: null, options: {} },
      });
      const message = await chats.createMessage({
        chatId: chat.id,
        role: "assistant",
        content: `The barrow gapes. [skill_check: skill="Ward" difficulty="Grim"]`,
      } as never);
      const post = (payload: Record<string, unknown>) =>
        app.inject({
          method: "POST",
          url: "/api/game/skill-check",
          payload: { chatId: chat.id, skill: "Ward", ...payload },
        });

      const named = await post({ difficulty: "Grim", messageId: message!.id });
      assert.equal(named.statusCode, 200, named.body);
      const body = named.json() as { result: SkillCheckResult; updatedContent?: string };
      assert.deepEqual([body.result.dc, body.result.threshold], [3, 8]);
      assert.match(
        body.updatedContent ?? "",
        /\[skill_check: skill="Ward" dc="3" .*threshold="8"/,
        "the ask in the message is the one rolled",
      );

      const unknown = await post({ difficulty: "Nope" });
      assert.equal(unknown.statusCode, 400);
      assert.equal((unknown.json() as { code: string }).code, "skill_check_difficulty_unknown");
      const bare = await post({});
      assert.notEqual(bare.statusCode, 200, "a check with neither a number nor a step is refused");

      const plainChat = await chats.create({ name: "No rules", mode: "game", characterIds: [] } as never);
      const noLadder = await app.inject({
        method: "POST",
        url: "/api/game/skill-check",
        payload: { chatId: plainChat!.id, skill: "Stealth", difficulty: "Hard" },
      });
      assert.equal(noLadder.statusCode, 400, "the Engine's own rules have no ladder to read a name off");
    } finally {
      await app.close();
      await closeDB();
    }
  }

  console.info("game ruleset check-rule regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
