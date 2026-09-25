/**
 * Spending a resource to change a check (#6405, the standing-rule half).
 *
 * Some systems let a player pay for a roll they are about to make: a point of will for an automatic
 * success. It cannot be two tags in one reply, because the dice are thrown before the `[sheet: ...]`
 * commands are applied, so the check tag carries `spend="pool:N"` and ONE resolution both rolls and
 * pays.
 *
 * What is pinned:
 *   - `resolution.spend` buys automatic successes, and they are added after the dice are counted.
 *   - It can buy extra dice instead, thrown with the pool and held to the pool's own ceiling.
 *   - `perCheck` caps how many purchases one check may make; asking for more is clamped, not refused.
 *   - All or nothing: a pool that cannot cover the spend buys nothing and is not deducted.
 *   - The cost really leaves the sheet, and the record says what was paid and what nobody rolled.
 *   - Two checks in one turn spend from what the first one left, not from where the turn started.
 *   - The model never touches the dice: what it writes in `rolls=` is still discarded.
 *   - A check with no `spend=` rolls exactly as it does today.
 *   - Every refusal at import.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  readRulesetLive,
  rollDicePoolCheck,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
  type RulesetLiveStates,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-check-spend-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, resolveSkillCheckTagsInContent } =
    await import("../../packages/server/src/services/game/skill-check-resolution.service.js");

  const gravewatchUrl = new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url);
  const gravewatchText = readFileSync(fileURLToPath(gravewatchUrl), "utf8");
  const parsed = parseRulesetDefinition(JSON.parse(gravewatchText));
  assert.ok(parsed.ok, `the gravewatch example must validate: ${JSON.stringify(parsed)}`);
  const gravewatch: RulesetDefinition = parsed.definition;
  assert.ok(gravewatch.resolution.spend?.length, "the example ships a standing spend");

  const build = defaultRulesetSheetBuild(gravewatch);
  const cards = [{ name: "Bram", rulesetSheet: { v: 1, build } }];
  const contextFor = (live: RulesetLiveStates | null): SkillCheckModifierContext => ({
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(gravewatch, cards, cards[0], live),
  });
  /** Resolve is the pool a spend pays from; a blank warden starts with it full. */
  const resolveLeft = (live: RulesetLiveStates | null) =>
    readRulesetLive(gravewatch, build, live?.bram).pools.find((pool) => pool.key === "resolve")!;
  const full = resolveLeft(null);
  assert.ok(full.value >= 2, `the blank warden has Resolve to spend (${full.value}/${full.max})`);

  // The injected die stands in only where a d20 is thrown, and this ruleset throws d10s, so the
  // faces here are the real generator's. Determinism comes from ARITHMETIC instead: a pool's own
  // successes are recomputable from the faces it reports, so what a purchase added is exactly what
  // the total has that the dice do not.
  const noSuccessDie = () => 1;
  /** The successes the DICE earned, counted the way this ruleset counts them. */
  const fromDice = (result: { rolls: number[]; threshold?: number }, cancelUpTo = 0) => {
    const counted = result.rolls.filter((face) => face >= (result.threshold ?? 0)).length;
    const cancelled = cancelUpTo > 0 ? result.rolls.filter((face) => face <= cancelUpTo).length : 0;
    return Math.max(0, counted - cancelled);
  };
  /** A gravewatch with no exploding, cancelling or botching, so the dice it reports are the dice it
   *  threw and a count of them is exact. Everything the purchase does is unchanged. */
  const plainDocument = () => {
    const copy = JSON.parse(gravewatchText) as Record<string, any>;
    delete copy.layers;
    copy.id = "gravewatch-plain";
    for (const key of ["explode", "cancel", "botch", "double"]) delete copy.resolution[key];
    // A fixed Resolve maximum, so what a purchase costs can be compared against a known number
    // rather than against whatever the blank warden's Nerve happens to make it.
    copy.sheet.live.pools[0].max = { const: 8 };
    return copy;
  };
  const contextForDocument = (document: Record<string, any>, live: RulesetLiveStates | null) => {
    const built = parseRulesetDefinition(document);
    assert.ok(built.ok, `the variant must validate: ${JSON.stringify(built)}`);
    const variantBuild = defaultRulesetSheetBuild(built.definition);
    const variantCards = [{ name: "Bram", rulesetSheet: { v: 1, build: variantBuild } }];
    const context: SkillCheckModifierContext = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(built.definition, variantCards, variantCards[0], live),
    };
    /** That variant's Resolve as it stands, read with its OWN definition: the shipped ruleset's
     *  maximum is a derived value and would clamp a variant's larger pool back down. */
    const poolValue = (state: RulesetLiveStates | null) =>
      readRulesetLive(built.definition, variantBuild, state?.bram).pools.find((pool) => pool.key === "resolve")!.value;
    return { definition: built.definition, build: variantBuild, context, poolValue };
  };
  /** Roll one check and hand back the result plus whatever the spend wrote back. */
  const roll = (
    live: RulesetLiveStates | null,
    request: Parameters<typeof resolveSkillCheckWithContext>[1],
    die: () => number = noSuccessDie,
  ) => {
    const context = contextFor(live);
    let written: RulesetLiveStates | null = null;
    const result = resolveSkillCheckWithContext(context, request, die, (key, state) => {
      written = { ...(written ?? {}), [key]: state };
    });
    return { result, written };
  };

  // ── A spend buys automatic successes, added AFTER the dice are counted ──
  {
    const { context, poolValue } = contextForDocument(plainDocument(), null);
    const started = poolValue(null);
    const bare = resolveSkillCheckWithContext(context, { skill: "Nerve", dc: 1 }, noSuccessDie);
    assert.equal(bare.total, fromDice(bare), "with no purchase the total is exactly what the dice earned");
    assert.equal(bare.spent, undefined, "a check with no spend says nothing about one");
    assert.equal(bare.autoSuccesses, undefined);

    let written: RulesetLiveStates | null = null;
    const bought = resolveSkillCheckWithContext(
      context,
      { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: 1 } },
      noSuccessDie,
      (key, state) => {
        written = { [key]: state };
      },
    );
    assert.deepEqual(bought.spent, { pool: "resolve", amount: 1 }, "the record says what was paid");
    assert.equal(bought.autoSuccesses, 1, "and how many successes nobody rolled");
    assert.equal(bought.total, fromDice(bought) + 1, "the bought success is in the total and only once");
    assert.equal(bought.success, true, "one bought success always meets a difficulty of one");
    assert.equal(bought.rolls.length, bare.rolls.length, "buying successes throws no extra dice");

    // The points really left the sheet.
    assert.ok(written, "a purchase writes the live state it paid out of");
    assert.equal(poolValue(written), started - 1);
  }

  // ── Bought successes are added AFTER the dice are counted and AFTER cancelling ──
  {
    // Straight at the roller, where the die can be scripted: three faces of 1 on a ruleset that
    // cancels a success for every 1. The dice earn nothing and cancel three times, so a purchase
    // added before the cancelling would be eaten by it. It is not: it is added to a total of 0.
    const cancels = gravewatch.resolution.kind === "dice-pool" ? gravewatch.resolution.cancel : undefined;
    assert.ok(cancels, "the example cancels successes on low faces, which is what makes this case bite");
    const rolled = rollDicePoolCheck(
      gravewatch,
      { modifier: 3, required: 1, isSave: false, bought: { successes: 2 } },
      () => 1,
    );
    assert.deepEqual(rolled.rolls, [1, 1, 1], "three dice, every one of them a cancelling face");
    assert.equal(rolled.autoSuccesses, 2);
    assert.equal(rolled.total, 2, "the two bought successes survived three cancels");
    // And with nothing bought the same roll counts nothing at all.
    const plain = rollDicePoolCheck(gravewatch, { modifier: 3, required: 1, isSave: false }, () => 1);
    assert.equal(plain.total, 0);
    assert.equal(plain.autoSuccesses, 0);
  }

  // ── A spend the pool cannot cover buys NOTHING and costs nothing ──
  {
    // An empty pool: the purchase is refused outright, so the roll is the one it would have been.
    const empty = { bram: { pools: { resolve: { value: 0 } } } };
    const broke = roll(empty, { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: 1 } });
    assert.equal(broke.result.spent, undefined, "nothing was bought");
    assert.equal(broke.result.autoSuccesses, undefined);
    assert.equal(broke.written, null, "and nothing was deducted");
    assert.equal(resolveLeft(empty).value, 0, "the pool is where it was");

    // One point left, and a purchase that costs two: still all or nothing.
    const pairs = plainDocument();
    pairs.id = "gravewatch-costly";
    pairs.resolution.spend = [{ pool: "resolve", amount: 2, successes: 1, perCheck: 1 }];
    const { context, poolValue } = contextForDocument(pairs, { bram: { pools: { resolve: { value: 1 } } } });
    const short = resolveSkillCheckWithContext(
      context,
      { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: 2 } },
      noSuccessDie,
      () => assert.fail("a purchase the pool cannot cover must not be paid for"),
    );
    assert.equal(short.spent, undefined, "one point cannot buy a two-point purchase");
    assert.equal(poolValue({ bram: { pools: { resolve: { value: 1 } } } }), 1, "and the point is still there");

    // A pool the ruleset does not offer a purchase from buys nothing either.
    const wrongPool = roll(null, { skill: "Nerve", dc: 1, spend: { pool: "nowhere", amount: 1 } });
    assert.equal(wrongPool.result.spent, undefined);
    assert.equal(wrongPool.written, null);
  }

  // ── `perCheck` caps the purchase; asking for more is clamped, not refused ──
  {
    const offer = gravewatch.resolution.spend![0]!;
    const { context, poolValue } = contextForDocument(plainDocument(), null);
    const started = poolValue(null);
    let written: RulesetLiveStates | null = null;
    const greedy = resolveSkillCheckWithContext(
      context,
      { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: offer.amount * 6 } },
      noSuccessDie,
      (key, state) => {
        written = { [key]: state };
      },
    );
    assert.ok(started >= offer.amount * 6, "the variant could have afforded every point that was asked for");
    assert.deepEqual(
      greedy.spent,
      { pool: "resolve", amount: offer.amount * offer.perCheck },
      "paid for the cap, not for what was asked",
    );
    assert.equal(greedy.autoSuccesses, (offer.successes ?? 0) * offer.perCheck);
    assert.equal(poolValue(written), started - offer.amount * offer.perCheck, "and only the cap left the sheet");
    assert.ok(offer.perCheck < 6, "which is what stops a full pool buying an unlosable roll");
  }

  // ── Half a purchase buys nothing ──
  {
    // The example's spend costs 1, so a fractional ask is the only unbuyable one. A ruleset whose
    // spend costs 2 refuses 3 the same way; both go through the "whole purchases only" rule.
    const wide = plainDocument();
    wide.id = "gravewatch-pairs";
    wide.resolution.spend = [{ pool: "resolve", amount: 2, successes: 1, perCheck: 2 }];
    const { context, poolValue } = contextForDocument(wide, null);
    assert.ok(poolValue(null) >= 4, `the variant has four points to spend (${poolValue(null)})`);
    const odd = resolveSkillCheckWithContext(
      context,
      { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: 3 } },
      noSuccessDie,
      () => assert.fail("a partial purchase must not be paid for"),
    );
    assert.equal(odd.spent, undefined, "three points is not a whole number of two-point purchases");
    const even = resolveSkillCheckWithContext(
      context,
      { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: 4 } },
      noSuccessDie,
      () => {},
    );
    assert.deepEqual(even.spent, { pool: "resolve", amount: 4 });
    assert.equal(even.autoSuccesses, 2);
  }

  // ── A spend can buy DICE instead, thrown with the pool ──
  {
    const diced = plainDocument();
    diced.id = "gravewatch-dice";
    diced.resolution.spend = [{ pool: "resolve", amount: 1, dice: 3, perCheck: 1 }];
    const { context } = contextForDocument(diced, null);
    const bare = resolveSkillCheckWithContext(context, { skill: "Nerve", dc: 1 }, noSuccessDie);
    const bought = resolveSkillCheckWithContext(
      context,
      { skill: "Nerve", dc: 1, spend: { pool: "resolve", amount: 1 } },
      noSuccessDie,
      () => {},
    );
    assert.equal(bought.rolls.length, bare.rolls.length + 3, "three more dice were really thrown");
    assert.equal(bought.autoSuccesses, undefined, "and nothing was added to the count afterwards");
    assert.deepEqual(bought.spent, { pool: "resolve", amount: 1 });
  }

  // ── Through the tag resolver: the record, the write-back, and two checks in one turn ──
  {
    const context = contextFor(null);
    const rolled = await resolveSkillCheckTagsInContent(
      `He steadies himself. [skill_check: skill="Nerve" dc="1" spend="resolve:1" rolls="9|9|9" total="3" result="success"]`,
      { loadContext: async () => context, rulesetPinned: true },
    );
    assert.equal(rolled.resolved, 1, "the Engine rolled it rather than believing the model's numbers");
    const record = parseSkillCheckTagBody(/\[skill_check:([^\]]+)\]/.exec(rolled.content)![1]!);
    assert.ok(record?.resolvedResult, "the rewritten tag reads back as a result");
    assert.deepEqual(record.spend, { pool: "resolve", amount: 1 }, "and says what was spent");
    assert.match(rolled.content, /auto="1"/, "and how much of it nobody rolled");
    assert.ok(rolled.live, "the turn carries the live state the purchase paid out of");
    assert.equal(resolveLeft(rolled.live!).value, full.value - 1);

    // Two checks in one turn spend from what the first left, so the second cannot pay twice out of
    // the same point. With Resolve at 1, only the first check buys anything.
    const oneLeftContext = contextFor({ bram: { pools: { resolve: { value: 1 } } } });
    const twice = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Nerve" dc="1" spend="resolve:1"] and again [skill_check: skill="Nerve" dc="1" spend="resolve:1"]`,
      { loadContext: async () => oneLeftContext, rulesetPinned: true },
    );
    assert.equal(twice.results?.length, 2);
    assert.deepEqual(twice.results![0]!.spent, { pool: "resolve", amount: 1 }, "the first check bought its success");
    assert.equal(twice.results![1]!.spent, undefined, "the second found the pool empty and bought nothing");
    assert.equal(resolveLeft(twice.live!).value, 0, "and one point left the sheet, not two");
  }

  // ── The tag reader ──
  {
    assert.deepEqual(parseSkillCheckTagBody(`skill="Nerve" dc="2" spend="resolve:2"`)?.spend, {
      pool: "resolve",
      amount: 2,
    });
    // A body that declares nothing the Engine could act on.
    for (const body of [`spend="resolve"`, `spend=":2"`, `spend="resolve:0"`, `spend="resolve:1.5"`, `spend=""`]) {
      assert.equal(parseSkillCheckTagBody(`skill="Nerve" dc="2" ${body}`)?.spend, undefined, body);
    }
    // And the record round-trips through the serializer.
    const written = serializeResolvedSkillCheckTag({
      skill: "Nerve",
      dc: 1,
      rolls: [1, 1],
      usedRoll: 1,
      modifier: 0,
      total: 1,
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution: "successes",
      spent: { pool: "resolve", amount: 2 },
      autoSuccesses: 2,
    });
    assert.match(written, /spend="resolve:2" auto="2"/);
    assert.deepEqual(parseSkillCheckTagBody(written.slice("[skill_check: ".length, -1))?.spend, {
      pool: "resolve",
      amount: 2,
    });
  }

  // ── Refusals at import ──
  {
    const refuse = (mutate: (copy: Record<string, any>) => void, pattern: RegExp) => {
      const copy = JSON.parse(gravewatchText) as Record<string, any>;
      delete copy.layers;
      mutate(copy);
      const result = parseRulesetDefinition(copy);
      assert.equal(result.ok, false, `expected a refusal matching ${pattern}`);
      const issues = result.ok ? [] : result.issues;
      assert.ok(
        issues.some((issue) => pattern.test(issue)),
        `expected ${pattern} in ${JSON.stringify(issues)}`,
      );
    };
    // A summed ruleset has no successes to add and no pool to add dice to.
    refuse((copy) => {
      copy.resolution = {
        kind: "dice-sum",
        dice: { count: 1, sides: 20 },
        abilityModifier: { op: "identity" },
        proficiencyTiers: copy.resolution.proficiencyTiers,
        spend: [{ pool: "resolve", amount: 1, successes: 1, perCheck: 1 }],
        difficultyLadder: [{ label: "Plain work", dc: 10 }],
      };
    }, /no successes or pool dice to buy/);
    // A pool nobody declared.
    refuse((copy) => {
      copy.resolution.spend = [{ pool: "nowhere", amount: 1, successes: 1, perCheck: 1 }];
    }, /Unknown live pool "nowhere"/);
    // A purchase that buys nothing.
    refuse((copy) => {
      copy.resolution.spend = [{ pool: "resolve", amount: 1, perCheck: 1 }];
    }, /buys successes, dice, or both/);
    // Past what the Engine lets one purchase be worth.
    refuse((copy) => {
      copy.resolution.spend = [{ pool: "resolve", amount: 1, successes: 99, perCheck: 1 }];
    }, /successes/);
    // Two spends on one pool: a check could not say which it meant.
    refuse((copy) => {
      copy.resolution.spend = [
        { pool: "resolve", amount: 1, successes: 1, perCheck: 1 },
        { pool: "resolve", amount: 2, dice: 2, perCheck: 1 },
      ];
    }, /Two spends on one pool/);
    // A pool that counts UP has nothing in it to spend when play starts.
    refuse((copy) => {
      copy.sheet.live.pools.push({
        id: "dread",
        label: "Dread",
        max: { const: 5 },
        start: "empty",
      });
      copy.resolution.spend = [{ pool: "dread", amount: 1, successes: 1, perCheck: 1 }];
    }, /starts empty, so there is nothing in it to spend/);
  }

  console.info("game ruleset check-spend regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
