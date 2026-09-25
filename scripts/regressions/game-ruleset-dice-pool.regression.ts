/**
 * Slice 7b of Game Mode rulesets: the `dice-pool` resolution kind.
 *
 * What is pinned here:
 *   - The schema refuses a pool whose rules could never fire, and the cross-checks the two kinds
 *     share run for both while the dice-sum-only ones stay where they are.
 *   - The roll itself, with an injected die sequence, so doubling, exploding, cancelling, botches,
 *     exceptional successes, an empty pool and every clamp are deterministic.
 *   - The tag's three per-check attributes (`threshold=`, `bonus=`, `with=`), their bounds, and
 *     that they survive whichever serializer rewrites the tag.
 *   - The Game Master line and the sheet block say dice where a pool ruleset means dice.
 *   - A packaged pool ruleset needs Capability API 1.24.
 *   - The legacy `resolution="successes"` tag, which belongs to games with no ruleset at all, is
 *     unchanged apart from carrying the threshold it already counted with.
 *   - The sighted one-request pool never feeds a d20 face into a pool of another die.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  formatRulesetCheckValue,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  renderRulesetSheetBlock,
  rollDicePoolCheck,
  rollDiceSumCheck,
  rulesetCheckModifier,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type SkillCheckResult,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-dice-pool-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckTagsInContent, resolveSkillCheckWithContext },
    { buildGmFormatReminder },
    { resolveGameDiceRequests },
    { getCapabilityPackageInstallIssue },
    { buildGameSkillModifierView, resolveSheetModifier },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/game/dice.service.js"),
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
  /** The shipped example, optionally edited first. */
  const pool = (edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition => {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    edit(doc);
    // The example's Grave Sight charm moves the exploding face, which a ruleset may only let a check
    // do while its explode rule has a min; a variant that takes the min away takes the charm too.
    if (doc.resolution.explode?.min === undefined) {
      for (const catalog of doc.catalogs ?? []) {
        catalog.entries = (catalog.entries ?? []).filter((entry: any) => entry.mechanics?.check?.explode === undefined);
      }
    }
    return parsedOrThrow(doc, "the pool example");
  };
  const gravewatch = pool();
  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");

  /** Nail the target down. A ladder step may only name one while the GM can move it, so the two
   *  edits always travel together. */
  const fixTarget = (doc: Record<string, any>) => {
    doc.resolution.target = { default: 7, min: 7, max: 7 };
    // Every ladder in the file, the layers' own included: a step names a target only where the
    // Game Master can move it, and a layer's ladder is held to the same rule as the base one.
    const ladders = [
      doc.resolution.difficultyLadder,
      ...(doc.layers ?? []).map((layer: any) => layer.difficultyLadder),
    ];
    for (const ladder of ladders) for (const step of ladder ?? []) delete step.target;
  };

  const refusals = (edit: (doc: Record<string, any>) => void): string[] => {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    edit(doc);
    const parsed = parseRulesetDefinition(doc);
    assert.ok(!parsed.ok, "this ruleset should have been refused");
    return parsed.issues;
  };
  const refuses = (edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const issues = refusals(edit);
    assert.ok(
      issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(issues)}`,
    );
  };

  /** A die that hands out a written sequence, then repeats its last value. */
  const scripted = (values: readonly number[]) => {
    let index = 0;
    return () => values[index++] ?? values[values.length - 1] ?? 1;
  };

  // ── The example is a real pool ruleset, and it is not the d20 one ──
  {
    assert.equal(gravewatch.resolution.kind, "dice-pool");
    assert.ok(gravewatch.resolution.kind === "dice-pool");
    assert.equal(gravewatch.resolution.die.sides, 10);
    assert.deepEqual(gravewatch.resolution.target, { default: 7, min: 5, max: 9 });
    assert.equal(gravewatch.sheet.abilities.length, 3);
    assert.equal(gravewatch.sheet.skills.length, 6);
    assert.equal(gravewatch.sheet.saves.length, 1);
    assert.equal(gravewatch.resolution.difficultyLadder.length, 4);
    assert.equal(gravewatch.sheet.live.pools.length, 1);
    assert.equal(gravewatch.rests.length, 1);
    assert.equal(gravewatch.resolution.abilityModifier.op, "identity");
  }

  // ── Schema: a rule that could never fire is refused at import ──
  {
    refuses((doc) => (doc.resolution.target.max = 11), /^resolution\.target\.max: /, "a target is a face of the die");
    refuses(
      (doc) => (doc.resolution.target.default = 4),
      /^resolution\.target\.default: default is outside min\.\.max/,
      "the default target sits inside the range the GM may move it in",
    );
    refuses(
      (doc) => (doc.resolution.target = { default: 7, min: 9, max: 5 }),
      /^resolution\.target\.min: min is above max/,
      "an inverted target range is a typo",
    );
    refuses(
      (doc) => (doc.resolution.cancel.upTo = 5),
      /^resolution\.cancel\.upTo: .*below the lowest target \(5\)/,
      "a face cannot both succeed and cancel",
    );
    refuses(
      (doc) => (doc.resolution.botch.upTo = 6),
      /^resolution\.botch\.upTo: .*below the lowest target \(5\)/,
      "a face cannot both succeed and botch",
    );
    refuses(
      (doc) => (doc.resolution.explode.from = 11),
      /^resolution\.explode\.from: /,
      "an exploding face has to be a face",
    );
    refuses((doc) => (doc.resolution.pool = { min: 9, max: 3 }), /^resolution\.pool\.min: /, "an inverted pool range");
    refuses(
      (doc) => (doc.resolution.difficultyLadder[1].target = 4),
      /^resolution\.difficultyLadder\.1\.target: .*inside 5 to 9/,
      "a ladder step cannot ask for a target the GM could not set",
    );
    refuses(
      (doc) => {
        doc.resolution.target = { default: 7, min: 7, max: 7 };
        doc.resolution.cancel.upTo = 1;
      },
      /^resolution\.difficultyLadder\.0\.target: .*target\.min is below target\.max/,
      "a fixed target leaves a ladder step nothing to say",
    );
    refuses(
      (doc) => (doc.resolution.naturals = { check: "both", save: "none" }),
      /^resolution: /,
      "a pool has no natural results, so the key is not its own",
    );
    refuses(
      (doc) => (doc.resolution.dice = { count: 2, sides: 6 }),
      /^resolution: /,
      "a pool declares a die, never a dice-sum notation",
    );

    // A number no roll could ever count is a typo: 15 dice, as many again exploded, none doubled.
    refuses(
      (doc) => (doc.resolution.exceptional = { successes: 31 }),
      /^resolution\.exceptional\.successes: The largest pool can count 30 at most/,
      "an exceptional result nobody could reach",
    );
    refuses(
      (doc) => (doc.resolution.difficultyLadder[0].successes = 31),
      /^resolution\.difficultyLadder\.0\.successes: The largest pool can count 30 at most/,
      "a difficulty nobody could meet",
    );

    // The sheet math both kinds share is checked for both: this one is the dice-sum rule read
    // through a pool ruleset.
    refuses(
      (doc) => (doc.resolution.proficiencyTiers[2].multiplier = 0.5),
      /^resolution\.proficiencyTiers\.2\.multiplier: .*needs resolution\.proficiency\.bonus/,
      "a tier that multiplies needs a bonus to multiply, whichever kind declares it",
    );

    // And the dice-sum-only rule stays dice-sum only: a pool has no single die to read naturals off.
    const twoDiceNaturals = JSON.parse(emberText) as Record<string, any>;
    twoDiceNaturals.resolution.naturals = { check: "both", save: "none" };
    const naturals = parseRulesetDefinition(twoDiceNaturals);
    assert.ok(!naturals.ok && naturals.issues.some((issue) => /^resolution\.naturals: /.test(issue)));
  }

  // ── The roll ──
  {
    const roll = (
      definition: RulesetDefinition,
      input: { modifier: number; required: number; threshold?: number; bonusDice?: number },
      faces: readonly number[],
    ) => rollDicePoolCheck(definition, { ...input, isSave: false }, scripted(faces));

    // Count, cancel, and the dice label naming every die that was thrown.
    const plain = roll(gravewatch, { modifier: 5, required: 1 }, [7, 3, 10, 1, 6, 4]);
    assert.deepEqual(plain.rolls, [7, 3, 10, 1, 6, 4], "the 10 exploded into one more die");
    assert.equal(plain.threshold, 7);
    assert.equal(plain.total, 1, "two dice reached 7, one 1 cancelled one of them");
    assert.equal(plain.usedRoll, plain.total, "the successes are the number the outcome turned on");
    assert.equal(plain.dice, "6d10");
    assert.equal(plain.rollMode, "normal");
    assert.deepEqual([plain.success, plain.criticalSuccess, plain.criticalFailure], [true, false, false]);

    // Exploding chains: a die added by an explosion can explode itself.
    const chain = roll(gravewatch, { modifier: 1, required: 2 }, [10, 10, 2]);
    assert.deepEqual(chain.rolls, [10, 10, 2]);
    assert.equal(chain.total, 2);

    // And the chain is capped, so a low exploding face cannot roll for the rest of the turn.
    const capped = roll(
      pool((doc) => {
        doc.resolution.explode = { from: 2 };
        doc.resolution.pool = { min: 1, max: 3 };
      }),
      { modifier: 3, required: 1 },
      [10],
    );
    assert.equal(capped.rolls.length, 6, "three dice plus three extra, and no more");

    // Cancelling floors at none rather than going negative.
    const floored = roll(gravewatch, { modifier: 4, required: 1 }, [7, 1, 1, 1]);
    assert.deepEqual([floored.total, floored.success], [0, false]);
    assert.equal(floored.criticalFailure, false, "a die succeeded, so a cancelled-away pool is not a botch");

    // A botch is nothing working AND something going wrong.
    const botched = roll(gravewatch, { modifier: 3, required: 1 }, [1, 4, 5]);
    assert.deepEqual([botched.total, botched.success, botched.criticalFailure], [0, false, true]);
    const missed = roll(gravewatch, { modifier: 3, required: 1 }, [2, 4, 5]);
    assert.deepEqual([missed.total, missed.success, missed.criticalFailure], [0, false, false]);

    // Doubling, and the exceptional success it can reach.
    const doubled = roll(
      pool((doc) => {
        delete doc.resolution.explode;
        doc.resolution.double = { from: 10 };
      }),
      { modifier: 5, required: 3 },
      [10, 10, 8, 8, 9],
    );
    assert.deepEqual(doubled.rolls, [10, 10, 8, 8, 9], "no explosions without the rule");
    assert.equal(doubled.total, 7, "each 10 counted twice");
    assert.deepEqual([doubled.success, doubled.criticalSuccess], [true, true]);

    // An empty pool fails with no roll at all.
    let thrown = 0;
    const empty = rollDicePoolCheck(
      pool((doc) => (doc.resolution.pool = { min: 0, max: 15 })),
      { modifier: 0, required: 1, isSave: false },
      () => {
        thrown += 1;
        return 10;
      },
    );
    assert.deepEqual([empty.rolls, empty.total, empty.success, empty.dice], [[], 0, false, "0d10"]);
    assert.equal(thrown, 0, "nothing was thrown for a pool with no dice in it");

    // Its record has no rolls to show, and still reads back as the failure it was, so a reload does
    // not turn it into a check nobody rolled.
    const emptyRecord = serializeResolvedSkillCheckTag({
      skill: "Ward",
      dc: 1,
      modifier: 0,
      resolution: "successes",
      ...empty,
    });
    assert.match(emptyRecord, /rolls="" .*dice="0d10"/);
    const emptyRead = parseSkillCheckTagBody(emptyRecord.slice("[skill_check:".length, -1));
    assert.deepEqual(
      [emptyRead?.resolvedResult?.rolls, emptyRead?.resolvedResult?.success, emptyRead?.resolvedResult?.dice],
      [[], false, "0d10"],
    );
    // Only that exact shape is read that way: an empty rolls= beside any dice, or beside a success,
    // is still a check the Engine owes a roll.
    for (const forged of [
      ` skill="Ward" dc="1" rolls="" used="0" modifier="0" total="0" result="success" resolution="successes" dice="0d10"`,
      ` skill="Ward" dc="1" rolls="" used="0" modifier="0" total="0" result="failure" resolution="successes" dice="3d10"`,
      ` skill="Ward" dc="1" rolls="" used="0" modifier="0" total="2" result="failure" resolution="successes" dice="0d10"`,
      ` skill="Ward" dc="1" rolls="" used="0" modifier="0" total="0 or so" result="failure" resolution="successes" dice="0d10"`,
      ` skill="Ward" dc="1" rolls="" used="0" modifier="0x1" total="0" result="failure" resolution="successes" dice="0d10"`,
    ]) {
      assert.equal(parseSkillCheckTagBody(forged)?.resolvedResult, undefined, forged);
    }

    // Clamps: the pool size, the per-die target, and the situational dice.
    assert.equal(roll(gravewatch, { modifier: 99, required: 1 }, [2]).rolls.length, 15, "the pool's own ceiling");
    assert.equal(roll(gravewatch, { modifier: -5, required: 1 }, [2]).rolls.length, 1, "and its own floor");
    assert.equal(roll(gravewatch, { modifier: 2, required: 1, threshold: 12 }, [2]).threshold, 9);
    assert.equal(roll(gravewatch, { modifier: 2, required: 1, threshold: 3 }, [2]).threshold, 5);
    assert.equal(roll(gravewatch, { modifier: 2, required: 1, threshold: Number.NaN }, [2]).threshold, 7);
    assert.equal(
      roll(pool(fixTarget), { modifier: 2, required: 1, threshold: 5 }, [2]).threshold,
      7,
      "a ruleset that fixes its target ignores a threshold the GM wrote",
    );
    assert.equal(roll(gravewatch, { modifier: 4, required: 1, bonusDice: 9 }, [2]).rolls.length, 4 + 3);
    assert.equal(roll(gravewatch, { modifier: 8, required: 1, bonusDice: -9 }, [2]).rolls.length, 8 - 3);
    assert.equal(
      roll(
        pool((doc) => delete doc.resolution.situationalDice),
        { modifier: 4, required: 1, bonusDice: 3 },
        [2],
      ).rolls.length,
      4,
      "no situational dice declared means the GM cannot add any",
    );

    // Neither roller answers for the other kind: it comes back as a failure with no dice at all.
    const wrongKind = rollDiceSumCheck(gravewatch, { modifier: 3, dc: 10, isSave: false }, () => 20);
    assert.deepEqual([wrongKind.rolls, wrongKind.success, wrongKind.dice], [[], false, ""]);
    const alsoWrong = rollDicePoolCheck(ember, { modifier: 3, required: 1, isSave: false }, () => 10);
    assert.deepEqual([alsoWrong.rolls, alsoWrong.success, alsoWrong.threshold], [[], false, 0]);
  }

  // ── The sheet, and how a pool ruleset spells its numbers ──
  const wardenBuild: RulesetSheetBuild = {
    ...defaultRulesetSheetBuild(gravewatch),
    abilities: { sinew: 3, nerve: 4, warmth: 2 },
    skills: { ward: "rating_3" },
    saves: { steel: "rating_2" },
    bonuses: { ward: 1 },
  };
  {
    const warden = evaluateRulesetSheet(gravewatch, wardenBuild);
    assert.equal(warden.skillMods.ward, 4 + 3 + 1, "the rating, the trade and the sheet's own bonus are all dice");
    assert.equal(warden.saveMods.steel, 4 + 2);
    assert.equal(warden.skillMods.dig, 3, "an untried trade is the rating alone");

    assert.equal(formatRulesetCheckValue(gravewatch, 8), "8 dice");
    assert.equal(formatRulesetCheckValue(gravewatch, 1), "1 die");
    assert.equal(formatRulesetCheckValue(gravewatch, 0), "0 dice");
    assert.equal(formatRulesetCheckValue(ember, 5), "+5");
    assert.equal(formatRulesetCheckValue(ember, -1), "-1");

    const block = renderRulesetSheetBlock(gravewatch, { name: "Bram the Quiet", build: wardenBuild }, null);
    assert.match(block, /^Bram the Quiet\n/);
    assert.match(block, /SIN 3 dice, NRV 4 dice, WRM 2 dice/);
    assert.match(block, /Trained: Ward 8 dice, Steel 6 dice/);
    assert.doesNotMatch(block, /\+\d/, "nothing on a pool sheet reads as a bonus added to a roll");

    // The summed example still reads exactly as it always has.
    const emberBlock = renderRulesetSheetBlock(
      ember,
      { name: "Sil", build: { ...defaultRulesetSheetBuild(ember), abilities: { brawn: 2, wits: 1, heart: 0 } } },
      null,
    );
    assert.match(emberBlock, /BRN \+2, WIT \+1, HRT \+0/);
  }

  // ── `with=`: rolling a trade with another rating, on both kinds ──
  {
    const wardWithSinew = matchRulesetCheckTarget(gravewatch, "Ward", "Sinew");
    assert.deepEqual(wardWithSinew, {
      type: "skill",
      id: "ward",
      label: "Ward",
      ability: "nerve",
      withAbility: "sinew",
    });
    const warden = evaluateRulesetSheet(gravewatch, wardenBuild);
    assert.equal(rulesetCheckModifier(warden, wardWithSinew), 8 - 4 + 3, "Nerve steps aside for Sinew");
    assert.equal(
      rulesetCheckModifier(warden, matchRulesetCheckTarget(gravewatch, "Steel", "Warmth")),
      6 - 4 + 2,
      "a save swaps its ability the same way",
    );

    // An ability nobody answers to is ignored, and the trade keeps its own.
    const unknown = matchRulesetCheckTarget(gravewatch, "Ward", "Luck");
    assert.equal(unknown && "withAbility" in unknown, false);
    assert.equal(rulesetCheckModifier(warden, unknown), 8);
    // A raw ability check already names the ability it rolls, so on a pool that does not add two
    // abilities together `with=` means nothing there. Gravewatch does add them (proven in the
    // check-rules regression), so the plain case runs on a copy without the switch.
    const unpaired = pool((doc) => delete doc.resolution.pool.abilityPlusAbility);
    assert.deepEqual(matchRulesetCheckTarget(unpaired, "Sinew", "Nerve"), {
      type: "ability",
      id: "sinew",
      label: "Sinew",
    });

    // The same override on the summed kind, because the modifier function is shared.
    const scout = evaluateRulesetSheet(ember, {
      ...defaultRulesetSheetBuild(ember),
      abilities: { brawn: 3, wits: 1, heart: 0 },
      skills: { sneak: "trained" },
    });
    assert.equal(rulesetCheckModifier(scout, matchRulesetCheckTarget(ember, "Sneak")), 1 + 1);
    assert.equal(rulesetCheckModifier(scout, matchRulesetCheckTarget(ember, "Sneak", "Brawn")), 3 + 1);
  }

  // ── The tag: three attributes, read and written back ──
  {
    const tag = parseSkillCheckTagBody(` skill="Ward" dc="2" who="Bram" with="Sinew" bonus="+2" threshold="8"`);
    assert.equal(tag?.withAbility, "Sinew");
    assert.equal(tag?.bonusDice, 2);
    assert.equal(tag?.threshold, 8);
    assert.equal(parseSkillCheckTagBody(` skill="Ward" dc="2" bonus="-3"`)?.bonusDice, -3);
    for (const unusable of ["1.5", "many", "", "  "]) {
      const parsed = parseSkillCheckTagBody(` skill="Ward" dc="2" bonus="${unusable}"`);
      assert.equal(parsed?.bonusDice, undefined, `bonus="${unusable}" is not a number of dice`);
    }
    assert.equal(parseSkillCheckTagBody(` skill="Ward" dc="2" with=""`)?.withAbility, undefined);

    // Both round-trip through the sparse serializer, so an ask the Engine could not roll keeps them.
    const sparse = serializeSparseSkillCheckTag({ skill: "Ward", dc: 2 }, { who: "Bram", with: "Sinew", bonus: -1 });
    assert.equal(sparse, `[skill_check: skill="Ward" dc="2" who="Bram" with="Sinew" bonus="-1"]`);
    const reread = parseSkillCheckTagBody(sparse.slice("[skill_check:".length, -1));
    assert.deepEqual([reread?.who, reread?.withAbility, reread?.bonusDice], ["Bram", "Sinew", -1]);

    // And the resolved serializer writes the threshold the result counted with.
    const record = serializeResolvedSkillCheckTag({
      skill: "Ward",
      dc: 2,
      rolls: [9, 3],
      usedRoll: 1,
      modifier: 0,
      total: 1,
      success: false,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution: "successes",
      dice: "2d10",
      threshold: 7,
    });
    assert.match(record, /resolution="successes" dice="2d10" threshold="7"\]$/);
  }

  // ── A game on the pool ruleset, through the tag resolver ──
  const cards = [
    { name: "Mira", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(gravewatch) } },
    { name: "Bram the Quiet", rulesetSheet: { v: 1, build: wardenBuild } },
  ];
  const context: SkillCheckModifierContext = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(gravewatch, cards, cards[0]),
  };
  /** The one record a rewritten turn holds, read back as a tag. */
  const resolvedTag = (content: string) => {
    const body = /\[skill_check:([^\]]+)\]/.exec(content)?.[1] ?? "";
    const parsed = parseSkillCheckTagBody(body);
    assert.ok(parsed, `the rewritten tag should read back as a check: ${content}`);
    return parsed;
  };
  const poolFaces = (result: SkillCheckResult) => {
    assert.equal(result.resolution, "successes");
    assert.equal(result.modifier, 0, "the sheet bought the dice; nothing is added to the successes");
    assert.equal(result.dice, `${result.rolls.length}d10`);
    assert.ok(
      result.rolls.every((face) => Number.isInteger(face) && face >= 1 && face <= 10),
      `every face is a face of the declared die: ${JSON.stringify(result.rolls)}`,
    );
    const counted = result.rolls.filter((face) => face >= (result.threshold ?? 0)).length;
    const cancelled = result.rolls.filter((face) => face <= 1).length;
    assert.equal(result.total, Math.max(0, counted - cancelled), "the record's successes are its own dice, counted");
    return result;
  };

  {
    // A party member's check rolls that member's pool, and the record says whose it was.
    const rolled = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="2" who="Bram the Quiet"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(rolled.resolved, 1);
    const result = poolFaces(rolled.results![0]!);
    // Eight dice, plus whatever the explosions added.
    assert.ok(result.rolls.length >= 8, `at least the sheet's eight dice: ${result.rolls.length}`);
    assert.equal(result.rolls.length, 8 + result.rolls.filter((face) => face >= 10).length);
    assert.equal(result.threshold, 7);
    assert.equal(result.who, "Bram the Quiet");
    assert.match(rolled.content, /resolution="successes"/);
    assert.match(rolled.content, /who="Bram the Quiet"/);

    // A save rolls the save's own pool.
    assert.equal(matchRulesetCheckTarget(gravewatch, "Steel")?.type, "save");
    const saved = await resolveSkillCheckTagsInContent(`[skill_check: skill="Steel" dc="1" who="Bram the Quiet"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    const saveResult = poolFaces(saved.results![0]!);
    assert.equal(saveResult.rolls.length, 6 + saveResult.rolls.filter((face) => face >= 10).length);

    // `with=` and `bonus=` change the pool, and both ride back out on the record.
    const swapped = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" dc="2" who="Bram the Quiet" with="Sinew" bonus="-2"]`,
      { loadContext: async () => context, rulesetPinned: true },
    );
    const swappedResult = poolFaces(swapped.results![0]!);
    assert.equal(
      swappedResult.rolls.length,
      8 - 4 + 3 - 2 + swappedResult.rolls.filter((face) => face >= 10).length,
      "Sinew for Nerve, and two dice taken away",
    );
    const rewritten = resolvedTag(swapped.content);
    assert.deepEqual([rewritten.withAbility, rewritten.bonusDice], ["Sinew", -2]);

    // The record says what the roll APPLIED, not what the tag asked for: nine bonus dice are the
    // ruleset's three, and an ability nobody answers to was never swapped in.
    const greedy = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" dc="2" who="Bram the Quiet" with="Moonlight" bonus="+9"]`,
      { loadContext: async () => context, rulesetPinned: true },
    );
    const greedyResult = poolFaces(greedy.results![0]!);
    assert.equal(greedyResult.rolls.length, 8 + 3 + greedyResult.rolls.filter((face) => face >= 10).length);
    const greedyRecord = resolvedTag(greedy.content);
    assert.deepEqual([greedyRecord.withAbility, greedyRecord.bonusDice], [undefined, 3]);
    assert.doesNotMatch(greedy.content, /Moonlight|bonus="\+9"/);

    // `threshold=` moves the per-die target inside the range, and is clamped rather than refused.
    const hard = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="1" threshold="9"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(hard.results![0]!.threshold, 9);
    const silly = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="1" threshold="99"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(silly.results![0]!.threshold, 9);

    // Numbers the model wrote for a pool are never believed, whatever else the tag declares.
    const invented = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" dc="2" dice="8d10" resolution="successes" threshold="7" mode="advantage" rolls="10|10|10|10|10|10|10|10" used="8" modifier="0" total="8" result="critical_success"]`,
      { loadContext: async () => context, rulesetPinned: true },
    );
    assert.equal(invented.resolved, 1, "a finished-looking pool tag is still rolled by the Engine");
    assert.equal(invented.trusted, 0);
    poolFaces(invented.results![0]!);
    assert.match(invented.content, /mode="normal"/, "the pool has no advantage to keep");

    // The difficulty is a count of successes, so its ceiling is what the largest roll could count
    // (15 dice and as many again exploded), not the d20's, and the same number the schema allows a
    // ladder step to ask for.
    const tooMany = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="31"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(tooMany.resolved, 0, "more successes than any roll could count is not a check");
    const atTheCeiling = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="30"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(atTheCeiling.resolved, 1);

    // A placeholder cannot borrow a pool number: it would add a count of dice to a damage roll.
    assert.equal(resolveSheetModifier(context, "ward"), null);
    assert.deepEqual(buildGameSkillModifierView(context), { skills: [], attributes: [] });
  }

  // ── The sighted one-request pool holds d20s, so it never serves a pool check ──
  {
    const { createGameDicePoolSession } = await import("../../packages/server/src/services/game/dice-pool.service.js");
    const { createGameDicePool, DEFAULT_GAME_DICE_POOL_WINDOW, DEFAULT_GAME_DICE_POOL_AGE_TURNS } =
      await import("../../packages/shared/src/index.js");
    const sighted = createGameDicePool(() => 1);
    sighted.values.d20 = [19, 4, 11];
    const session = createGameDicePoolSession({
      chatId: "chat-ruleset-dice-pool",
      pool: sighted,
      settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
    });
    const before = [...session.pool.values.d20];
    const blind = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" dc="2" who="Bram the Quiet" rolls="19" pool="d20:1"]`,
      { loadContext: async () => context, rulesetPinned: true, pool: session },
    );
    assert.equal(blind.resolved, 1);
    const result = poolFaces(blind.results![0]!);
    assert.ok(result.rolls.length >= 8, "the sheet's own pool, not one d20 face");
    assert.doesNotMatch(blind.content, /pool="d20/, "no slot was recorded against a roll it did not decide");
    assert.deepEqual(session.pool.values.d20, before, "and no pool value was spent");

    // A check nobody could roll keeps its whole ask, the declared threshold included, so whoever
    // rolls it later counts with what the Game Master set.
    const owed = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="+1" rolls="9|9" total="2"]`,
      {
        loadContext: async () => {
          throw new Error("the pinned ruleset is not installed");
        },
        rulesetPinned: true,
      },
    );
    assert.equal(owed.resolved, 0);
    assert.match(owed.content, /threshold="8"/);
    assert.match(owed.content, /bonus="\+1"/);
    assert.doesNotMatch(owed.content, /rolls=|total=/, "and none of the numbers the model wrote");

    // The blind roll applies what the record says it applied: the tag's own with=, bonus= and
    // threshold= reach the roller even though the request was bound by the sighted pool's reader.
    const blindAsk = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" dc="2" who="Bram the Quiet" with="Sinew" bonus="-2" threshold="9" pool="d20:1"]`,
      { loadContext: async () => context, rulesetPinned: true, pool: session },
    );
    const blindAskResult = poolFaces(blindAsk.results![0]!);
    assert.equal(
      blindAskResult.rolls.length,
      8 - 4 + 3 - 2 + blindAskResult.rolls.filter((face) => face >= 10).length,
      "Sinew for Nerve and two dice fewer, exactly as without the sighted pool",
    );
    assert.equal(blindAsk.results![0]!.threshold, 9);
    const blindRecord = resolvedTag(blindAsk.content);
    assert.deepEqual([blindRecord.withAbility, blindRecord.bonusDice], ["Sinew", -2]);

    // This is the one path that reaches the resolver with an unbounded difficulty, because the
    // pool bounds a written DC before any ruleset is loaded. The ruleset's own ceiling holds.
    const wild = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="40" pool="d20:1"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
      pool: session,
    });
    assert.equal(wild.results![0]!.dc, 30, "clamped to what this pool could count, not to the d20 bound of 40");
    assert.match(wild.content, /dc="30"/);
  }

  // ── The Game Master line ──
  {
    const base = {
      turnNumber: 2,
      gameActiveState: "exploration" as const,
      partyNames: ["Bram the Quiet"],
      playerName: "Mira",
    };
    const reminder = buildGmFormatReminder({ ...base, ruleset: gravewatch });
    assert.ok(reminder.includes(gravewatch.gm.checkGuidance));
    assert.match(reminder, /dc is how many successes the check needs\./);
    assert.match(
      reminder,
      /Difficulty: Plain work 1 success \(target 6\), Awkward 2 successes, Grim 3 successes \(target 8\), Hopeless 5 successes \(target 9\)\./,
    );
    assert.match(reminder, /the engine rolls the pool from the character sheet and counts the successes/);
    assert.match(reminder, /Add who="Character Name" to roll for a party member/);
    assert.match(reminder, /Add threshold="N" to move the per-die target, from 5 to 9; without it the target is 7\./);
    assert.match(reminder, /Add bonus="\+N" or bonus="-N" to add or take dice for this check, from -3 to 3\./);
    assert.match(reminder, /Add with="Ability" to roll a skill or save with another ability than its own\./);
    assert.doesNotMatch(reminder, /mode="advantage" or mode="disadvantage"/, "the kind has no advantage");
    assert.doesNotMatch(reminder, /the engine rolls \d+d\d+ and applies the character sheet/);
    assert.doesNotMatch(reminder, /request a d20 check only when uncertainty matters/);

    // A player's own d20 is not this ruleset's die, so the line never asks for it.
    const submitted = buildGmFormatReminder({ ...base, ruleset: gravewatch, playerDiceRollSubmitted: true });
    assert.doesNotMatch(submitted, /rolls="the player's d20 result"/);
    assert.match(submitted, /A skill check is still written down with the \[skill_check: \.\.\.\] tag above/);

    // Each clause is offered only where the ruleset declares what it names.
    const plainest = buildGmFormatReminder({
      ...base,
      ruleset: pool((doc) => {
        fixTarget(doc);
        delete doc.resolution.situationalDice;
      }),
    });
    assert.doesNotMatch(plainest, /Add threshold=/);
    assert.doesNotMatch(plainest, /Add bonus=/);
    assert.match(plainest, /Add with="Ability"/, "three ratings still give with= somewhere to go");
    assert.match(plainest, /Difficulty: Plain work 1 success, Awkward 2 successes, Grim 3 successes,/);

    // One ability is nothing to swap for.
    const oneAbility = buildGmFormatReminder({
      ...base,
      ruleset: pool((doc) => {
        doc.sheet.abilities = doc.sheet.abilities.filter((ability: { id: string }) => ability.id === "nerve");
        doc.sheet.skills = doc.sheet.skills.filter((skill: { ability: string }) => skill.ability === "nerve");
      }),
    });
    assert.doesNotMatch(oneAbility, /Add with="Ability"/);

    // The summed kind keeps the line it has always rendered, plus the one new clause.
    const emberReminder = buildGmFormatReminder({ ...base, ruleset: ember });
    assert.match(emberReminder, /Difficulty: Easy 6, Risky 8, Hard 10, Desperate 12\./);
    assert.match(emberReminder, /the engine rolls 2d6 and applies the character sheet/);
    assert.match(emberReminder, /Add with="Ability"/);
    assert.doesNotMatch(emberReminder, /counts the successes/);
  }

  // ── Install gate: a packaged pool ruleset needs 1.24 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-gravewatch",
      name: "Gravewatch",
      version: "0.1.0",
      description: "A packaged pool ruleset.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const document = JSON.parse(gravewatchText);
    // The shipped example also carries a layer, a wound track, a spend on a check and a charm that
    // changes one, each with a gate of its own (proven in the layers and wound-track regressions).
    // This case is about the resolution kind, so it reads the file without any of them.
    delete document.layers;
    document.sheet.live.tracks = [];
    delete document.resolution.penaltyFrom;
    delete document.resolution.spend;
    for (const catalog of document.catalogs ?? []) {
      for (const entry of catalog.entries ?? []) delete entry.mechanics?.check;
    }
    // And the rules a check may move, two abilities together and a botch rule, which are 1.37's.
    delete document.resolution.explode.min;
    delete document.resolution.pool.abilityPlusAbility;
    // And 1.38's standing re-throw.
    delete document.resolution.reroll;
    assert.match(
      getCapabilityPackageInstallIssue(manifest(23) as any, document) ?? "",
      /dice-pool resolution requires schemaVersion 2 and capabilityApi 1\.24 or newer/,
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(24) as any, document), null);
    // A summed ruleset is unaffected: it installs on the declaration it always needed.
    assert.equal(getCapabilityPackageInstallIssue(manifest(20) as any, { resolution: { kind: "dice-sum" } }), null);
  }

  // ── The legacy successes path, which belongs to games with no ruleset at all ──
  {
    const roll = (notation: string) => ({ notation, rolls: [6, 2, 9, 1, 7, 6], modifier: 0, total: 31 });
    const legacy = resolveGameDiceRequests(
      `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]`,
      [],
      roll,
    );
    assert.equal(
      legacy.content,
      `[skill_check: skill="Intimidation" dc="4" rolls="6|2|9|1|7|6" used="4" modifier="0" total="4" result="success" mode="normal" resolution="successes" dice="6d10" threshold="6"]`,
      "the bytes this path has always written",
    );
    assert.equal(legacy.checkResults[0]!.threshold, 6, "and it now says which threshold it counted with");
    assert.equal(legacy.checkResults[0]!.total, 4);

    // A summed check still carries no threshold at all.
    const summed = resolveGameDiceRequests(`[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`, [], (notation) => ({
      notation,
      rolls: [4, 5, 6],
      modifier: 2,
      total: 17,
    }));
    assert.equal(summed.checkResults[0]!.threshold, undefined);
    assert.doesNotMatch(summed.content, /threshold=/);
  }

  // ── engine-legacy checks are untouched, prompt and record alike ──
  {
    const legacy: SkillCheckModifierContext = {
      skills: { Stealth: 2 },
      attributes: null,
      sheetAttributes: { dex: 14 },
    };
    const rolled = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Stealth" dc="15" with="Sinew" bonus="+2"]`,
      { loadContext: async () => legacy, rollD20: () => 12 },
    );
    assert.equal(
      rolled.content,
      `[skill_check: skill="Stealth" dc="15" rolls="12" used="12" modifier="4" total="16" result="success" mode="normal" resolution="sum" dice="1d20"]`,
      "without a pin the new attributes are read and then ignored, and nothing is written back",
    );
    assert.equal(resolveSkillCheckWithContext(legacy, { skill: "Stealth", dc: 10 }, () => 20).criticalSuccess, true);
  }

  console.info("game ruleset dice-pool regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
