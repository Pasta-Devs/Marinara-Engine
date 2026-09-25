/**
 * What a check may buy and what rides along on it (issue #6652): standing re-throws a check names,
 * a spend that buys a re-throw, a spend's limit read off the sheet, and modifiers the sheet adds to
 * every check they apply to. Capability API 1.38.
 *
 * What is pinned here:
 *   - `resolution.reroll`: a standing re-throw named with `reroll="id"` (without case), thrown once
 *     per roll; beside one a spend or an entry bought, the wider of the two is thrown; the record
 *     names it only when it was the one thrown and it threw something; an unknown name is ignored.
 *   - A spend may buy a `reroll`, bought once however many purchases the check makes.
 *   - `perCheck` as a number, a value off the sheet or `"pool"` (the check's own dice), worked out
 *     for whoever rolls; a limit of nothing buys nothing and pays nothing. Four spends, one a pool.
 *   - `resolution.adjust`: on both kinds, only on the abilities it names (or on every check), dice
 *     on a pool and a flat number on a sum, beside the wound penalty; the record writes and reads
 *     it, and a summed record that left it out is not vouched for.
 *   - The Game Master's reminder offers `reroll=` only where the ruleset has one, and says what a
 *     spend buys and how its limit is set.
 *   - The one-request branch arm, the sighted pool and the skill-check endpoint carry `reroll=`.
 *   - Every refusal at import, and every new key needs Capability API 1.38 to install.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollDicePoolCheck,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetSheetBuild,
  type SkillCheckResult,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-rerolls-spends-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [
    {
      boundPoolCheckRequest,
      buildSkillCheckRulesetContext,
      planRulesetCheckPurchase,
      resolveSkillCheckTagsInContent,
      resolveSkillCheckWithContext,
    },
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
  /** Gravewatch with nothing that adds or takes dice after the throw (no exploding, cancelling or
   *  botching, no layer), so what it reports is exactly what it threw, and a re-throw that runs
   *  `until` every die clears 6 leaves only dice that count at the default target of 7. (Not 9: an
   *  `until` stops at the Engine's hundred re-throws, which ten dice clearing 9 can reach.) Its
   *  Resolve holds twenty. */
  const plain = (edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition => {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    delete doc.layers;
    delete doc.resolution.explode;
    delete doc.resolution.cancel;
    delete doc.resolution.botch;
    doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
    doc.resolution.reroll = [
      { id: "sure", upTo: 6, mode: "until" },
      { id: "careful", upTo: 3, mode: "once" },
    ];
    doc.sheet.live.pools[0].max = { const: 20 };
    edit(doc);
    return parsedOrThrow(doc, "the plain pool variant");
  };
  /** A warden with Sinew and Nerve at 5 and every trade at its top rating: ten dice on Ward or
   *  Wrestle, so ten dice clearing 6 by chance, with no re-throw at all, is about one in ten
   *  thousand rather than one in six. */
  const strong = (definition: RulesetDefinition, edit: (build: RulesetSheetBuild) => void = () => {}) => {
    const build = defaultRulesetSheetBuild(definition);
    build.abilities = { ...build.abilities, sinew: 5, nerve: 5 };
    build.skills = Object.fromEntries(definition.sheet.skills.map((skill) => [skill.id, "rating_5"]));
    edit(build);
    return build;
  };
  const contextFor = (
    definition: RulesetDefinition,
    build: RulesetSheetBuild = defaultRulesetSheetBuild(definition),
    live: RulesetLiveStates | null = null,
  ): SkillCheckModifierContext => {
    const party = [{ name: "Mira", rulesetSheet: { v: 1, build } }];
    return {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(definition, party, party[0], live),
    };
  };
  /** Roll one check the way a generated turn does, with a caller that can persist what a spend paid. */
  const roll = (context: SkillCheckModifierContext, request: Parameters<typeof resolveSkillCheckWithContext>[1]) => {
    let written: RulesetLiveStates | null = null;
    const result = resolveSkillCheckWithContext(context, request, undefined, (key, state) => {
      written = { ...(written ?? {}), [key]: state };
    });
    return { result, written: written as RulesetLiveStates | null };
  };
  const full = { mira: { pools: { resolve: { value: 20 } } } } as unknown as RulesetLiveStates;
  /** Every die ended above 6, which only a re-throw that ran until they did makes certain. */
  const cleared = (result: SkillCheckResult) => result.rolls.every((face) => face > 6);

  // ── Refused at import ──
  {
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.reroll = [{ id: "all", upTo: 10, mode: "once" }]),
      /resolution\.reroll\.0\.upTo: This ruleset throws d10, so a re-throw is on a face from 1 to 9/,
      "a re-throw of every face never ends",
    );
    refuses(
      gravewatchText,
      (doc) =>
        (doc.resolution.reroll = [
          { id: "twice", upTo: 1, mode: "once" },
          { id: "twice", upTo: 2, mode: "until" },
        ]),
      /Duplicate re-throw id "twice"/,
      "two re-throws answer to one name",
    );
    refuses(
      gravewatchText,
      (doc) =>
        (doc.resolution.reroll = Array.from({ length: 7 }, (_, index) => ({
          id: `r${index}`,
          upTo: 1,
          mode: "once",
        }))),
      /resolution\.reroll/,
      "seven standing re-throws",
    );
    refuses(
      emberText,
      (doc) => (doc.resolution.reroll = [{ id: "again", upTo: 1, mode: "once" }]),
      /reroll/,
      "a summed ruleset has no dice to throw again",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.spend[0].reroll = { upTo: 10, mode: "until" }),
      /resolution\.spend\.0\.reroll\.upTo: This ruleset throws d10, so a re-throw is on a face from 1 to 9/,
      "a bought re-throw is held to the same die",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.spend = [{ pool: "resolve", amount: 1, perCheck: 1 }]),
      /A spend buys successes, dice, a re-throw, or several/,
      "a spend that buys nothing",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.spend[0].perCheck = { abilityScore: "grace" }),
      /resolution\.spend\.0\.perCheck/,
      "a limit off an ability the sheet does not have",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.spend[0].perCheck = "dice"),
      /resolution\.spend\.0\.perCheck/,
      "a limit is a number, a value off the sheet, or the check's own dice",
    );
    refuses(
      gravewatchText,
      (doc) =>
        (doc.resolution.spend = Array.from({ length: 5 }, () => ({
          pool: "resolve",
          amount: 1,
          successes: 1,
          perCheck: 1,
        }))),
      /resolution\.spend/,
      "five spends",
    );
    refuses(
      emberText,
      (doc) => (doc.resolution.adjust = [{ value: { derived: "burden" }, abilities: ["grace"] }]),
      /resolution\.adjust\.0\.abilities\.0: Unknown ability "grace"/,
      "a modifier on an ability the sheet does not have",
    );
    refuses(
      emberText,
      (doc) => (doc.resolution.adjust = [{ value: { field: "weight" } }]),
      /resolution\.adjust\.0\.value/,
      "a modifier off a field the sheet does not have",
    );
    refuses(
      emberText,
      (doc) => (doc.resolution.adjust = Array.from({ length: 9 }, () => ({ value: { const: 1 } }))),
      /resolution\.adjust/,
      "nine modifiers",
    );
    // What installs: four spends, each limit form, and a modifier on both kinds.
    plain((doc) => {
      doc.sheet.live.pools.push(
        ...[1, 2, 3].map((index) => ({ id: `p${index}`, label: `P${index}`, max: { const: 5 } })),
      );
      doc.resolution.spend = [
        { pool: "resolve", amount: 1, successes: 1, perCheck: 2 },
        { pool: "p1", amount: 1, dice: 1, perCheck: "pool" },
        { pool: "p2", amount: 2, reroll: { upTo: 3, mode: "once" }, perCheck: 1 },
        { pool: "p3", amount: 1, successes: 1, perCheck: { abilityScore: "nerve" } },
      ];
      doc.resolution.adjust = [{ value: { const: -1 } }];
    });
    parsedOrThrow(JSON.parse(emberText), "the shipped 2d6 example, which carries a modifier");
    parsedOrThrow(JSON.parse(gravewatchText), "the shipped pool example, which carries a standing re-throw");
  }

  // ── The roller throws the low faces again (the report's own numbers) ──
  {
    const definition = plain((doc) => (doc.resolution.target = { default: 8, min: 5, max: 9 }));
    // Four dice at 8 or more: 1, 1, 9, 3. Everything at 7 or less is thrown again once: 8, 2, 10.
    const rolled = rollDicePoolCheck(
      definition,
      { modifier: 4, required: 1, isSave: false, bought: { reroll: { upTo: 7, mode: "once" } } },
      scripted([1, 1, 9, 3, 8, 2, 10]),
    );
    assert.equal(rolled.rerolled, 3, "three low dice were thrown again");
    assert.deepEqual(
      [...rolled.rolls].sort((a, b) => a - b),
      [2, 8, 9, 10],
    );
    assert.equal(rolled.total, 3);
  }

  // ── A standing re-throw the Game Master names ──
  const definition = plain();
  const build = strong(definition);
  {
    const context = contextFor(definition, build);
    const sure = roll(context, { skill: "Ward", dc: 1, reroll: "SURE" }).result;
    assert.equal(sure.rolls.length, 10, "ten dice, with nothing added or taken after the throw");
    assert.ok(cleared(sure), `a re-throw until every die clears 6: ${sure.rolls.join(",")}`);
    assert.equal(sure.reroll, sure.rerolled ? "sure" : undefined, "named by its id, matched without case");
    const record = serializeResolvedSkillCheckTag(sure);
    const named = serializeResolvedSkillCheckTag({ ...sure, rerolled: 3, reroll: "sure" });
    assert.match(named, / reroll="sure"/);
    const namedBack = parseSkillCheckTagBody(/\[skill_check:([^\]]+)\]/.exec(named)![1]!);
    assert.deepEqual([namedBack?.reroll, namedBack?.resolvedResult?.reroll], ["sure", "sure"], "and reads it back");
    assert.doesNotMatch(serializeResolvedSkillCheckTag({ ...sure, reroll: undefined }), /reroll=/);

    const careful = roll(context, { skill: "Ward", dc: 1, reroll: "careful" }).result;
    assert.equal(careful.reroll, careful.rerolled ? "careful" : undefined, "said only when it threw something");

    const unknown = roll(context, { skill: "Ward", dc: 1, reroll: "lucky" }).result;
    assert.deepEqual([unknown.rerolled, unknown.reroll], [undefined, undefined], "an unknown name is ignored");
    const none = roll(context, { skill: "Ward", dc: 1 }).result;
    assert.deepEqual([none.rerolled, none.reroll], [undefined, undefined], "and nothing is thrown unasked");

    // Through the tag a generated turn writes.
    const turn = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="1" reroll="sure"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.match(turn.content, / total="10" /, "ten dice that all count");
    // An ask that is not rolled keeps the name, so whichever path rolls it later rolls the same thing.
    const ask = parseSkillCheckTagBody(` skill="Ward" dc="1" reroll="sure"`)!;
    assert.equal(
      serializeSparseSkillCheckTag({ skill: "Ward", dc: 1 }, { reroll: "sure" }),
      `[skill_check: skill="Ward" dc="1" reroll="sure"]`,
    );
    // A tag the sighted pool could not serve goes back as the ask, and the ask keeps the name.
    const { createGameDicePoolSession } = await import("../../packages/server/src/services/game/dice-pool.service.js");
    const { createGameDicePool, DEFAULT_GAME_DICE_POOL_WINDOW, DEFAULT_GAME_DICE_POOL_AGE_TURNS } =
      await import("../../packages/shared/src/index.js");
    const sighted = createGameDicePool(() => 1);
    sighted.values.d20 = [14];
    const lost = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Ward" difficulty="Nope" pool="d20:1" reroll="sure"]`,
      {
        loadContext: async () => context,
        rulesetPinned: true,
        pool: createGameDicePoolSession({
          chatId: "chat-rerolls-pool",
          pool: sighted,
          settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
        }),
      },
    );
    assert.equal(lost.content, `[skill_check: skill="Ward" difficulty="Nope" reroll="sure"]`);
    assert.equal(boundPoolCheckRequest(ask)?.reroll, "sure", "and the sighted pool carries it too");
  }

  // ── One re-throw per roll: the wider of a bought one and a standing one ──
  {
    const buying = (bought: { upTo: number; mode: "once" | "until" }) =>
      plain((doc) => (doc.resolution.spend = [{ pool: "resolve", amount: 1, reroll: bought, perCheck: 3 }]));
    // The spend reaches more faces than the standing one named beside it, so it is the one thrown,
    // and the record does not claim the standing one.
    const wideSpend = buying({ upTo: 6, mode: "until" });
    const wider = roll(contextFor(wideSpend, strong(wideSpend), full), {
      skill: "Ward",
      dc: 1,
      reroll: "careful",
      spend: { pool: "resolve", amount: 1 },
    });
    assert.ok(cleared(wider.result), `the bought re-throw was thrown: ${wider.result.rolls.join(",")}`);
    assert.equal(wider.result.reroll, undefined);
    assert.deepEqual(wider.result.spent, { pool: "resolve", amount: 1 });
    // The other way round: the standing one reaches more, so it is thrown and named.
    const narrowSpend = buying({ upTo: 2, mode: "once" });
    const standing = roll(contextFor(narrowSpend, strong(narrowSpend), full), {
      skill: "Ward",
      dc: 1,
      reroll: "sure",
      spend: { pool: "resolve", amount: 1 },
    });
    assert.ok(cleared(standing.result));
    assert.equal(standing.result.reroll, standing.result.rerolled ? "sure" : undefined);
    // Same reach: `until` beats `once`.
    const sameReach = plain((doc) => {
      doc.resolution.reroll = [{ id: "sure", upTo: 6, mode: "once" }];
      doc.resolution.spend = [{ pool: "resolve", amount: 1, reroll: { upTo: 6, mode: "until" }, perCheck: 1 }];
    });
    const tie = roll(contextFor(sameReach, strong(sameReach), full), {
      skill: "Ward",
      dc: 1,
      reroll: "sure",
      spend: { pool: "resolve", amount: 1 },
    });
    assert.ok(cleared(tie.result), "a tie goes to the re-throw that keeps going");
    assert.equal(tie.result.reroll, undefined);
    // Bought once however many purchases were made.
    const thrice = planRulesetCheckPurchase(
      contextFor(wideSpend, strong(wideSpend), full).ruleset!,
      { pool: "resolve", amount: 3 },
      undefined,
      10,
    );
    assert.deepEqual(thrice?.bought, { reroll: { upTo: 6, mode: "until" } });
    assert.deepEqual(thrice?.spent, { pool: "resolve", amount: 3 });
  }

  // ── A spend's limit off the sheet ──
  {
    const limited = (perCheck: unknown) =>
      plain((doc) => (doc.resolution.spend = [{ pool: "resolve", amount: 1, successes: 1, perCheck }]));
    // The report's case: Sinew 4 and a trade at 5 throw nine dice, and "as many as the pool" lets
    // fourteen points buy nine successes and no more.
    const byPool = limited("pool");
    const nine = strong(byPool, (sheet) => (sheet.abilities = { ...sheet.abilities, sinew: 4 }));
    const pooled = roll(contextFor(byPool, nine, full), {
      skill: "Wrestle",
      dc: 1,
      spend: { pool: "resolve", amount: 14 },
    });
    assert.equal(pooled.result.rolls.length, 9);
    assert.equal(pooled.result.autoSuccesses, 9);
    assert.deepEqual(pooled.result.spent, { pool: "resolve", amount: 9 }, "only what was bought is paid");
    assert.equal((pooled.written as any)?.mira?.pools?.resolve?.value, 11);
    // The limit is the sheet's number for the check, not what a wound or a modifier leaves of it.
    const marked = applyRulesetSheetOp(byPool, nine, full.mira!, {
      op: "damage",
      track: "harm",
      kind: "knock",
      amount: 3,
    });
    assert.ok(marked.ok);
    const hurt = roll(contextFor(byPool, nine, { mira: marked.live }), {
      skill: "Wrestle",
      dc: 1,
      spend: { pool: "resolve", amount: 14 },
    });
    assert.ok((hurt.result.penalty ?? 0) < 0, "the warden is hurt");
    assert.equal(hurt.result.rolls.length, 9 + hurt.result.penalty!, "and throws fewer dice");
    assert.equal(hurt.result.autoSuccesses, 9, "but may still buy as many as the sheet gives the check");

    // Off a value on the sheet: Nerve 3 lets a check buy three.
    const byNerve = limited({ abilityScore: "nerve" });
    const three = strong(byNerve, (sheet) => (sheet.abilities = { ...sheet.abilities, nerve: 3 }));
    const nerved = roll(contextFor(byNerve, three, full), {
      skill: "Wrestle",
      dc: 1,
      spend: { pool: "resolve", amount: 10 },
    });
    assert.equal(nerved.result.autoSuccesses, 3);
    assert.deepEqual(nerved.result.spent, { pool: "resolve", amount: 3 });
    // A limit that works out to nothing buys nothing and takes nothing.
    const byLantern = limited({ field: "lantern" });
    const dark = strong(byLantern, (sheet) => (sheet.fields = { ...sheet.fields, lantern: 0 }));
    const nothing = roll(contextFor(byLantern, dark, full), {
      skill: "Wrestle",
      dc: 1,
      spend: { pool: "resolve", amount: 2 },
    });
    assert.deepEqual(
      [nothing.result.spent, nothing.result.autoSuccesses, nothing.written],
      [undefined, undefined, null],
    );
    // A stranger has no sheet to read a limit off, or to pay from.
    const stranger = roll(contextFor(byPool, nine, full), {
      skill: "Wrestle",
      dc: 1,
      who: "Nobody",
      spend: { pool: "resolve", amount: 3 },
    });
    assert.equal(stranger.result.spent, undefined);
  }

  // ── Modifiers off the sheet ──
  {
    // Ember Roads ships one: Burden comes off every Brawn roll. Six bulk packed is two off; the tent
    // left behind counts for nothing.
    const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
    const laden = defaultRulesetSheetBuild(ember);
    laden.lists = {
      ...laden.lists,
      gear: [
        { name: "Anvil", bulk: 3 },
        { name: "Rope", bulk: 3, packed: true },
        { name: "Tent", bulk: 3, packed: false },
      ],
    };
    const context = contextFor(ember, laden);
    const scrap = roll(context, { skill: "Scrap", dc: 6 }).result;
    assert.equal(scrap.adjust, -2, "Scrap rolls with Brawn");
    assert.equal(scrap.modifier, -2, "and on a sum it is inside the number added to the dice");
    assert.equal(scrap.total, scrap.usedRoll + scrap.modifier);
    const sway = roll(context, { skill: "Sway", dc: 6 }).result;
    assert.deepEqual([sway.adjust, sway.modifier], [undefined, 0], "Sway rolls with Heart, which it leaves alone");
    const swapped = roll(context, { skill: "Sway", dc: 6, withAbility: "Brawn" }).result;
    assert.equal(swapped.adjust, -2, "a skill rolled with Brawn instead takes it");
    const brawn = roll(context, { skill: "Brawn", dc: 6 }).result;
    assert.equal(brawn.adjust, -2, "and so does the ability check itself");
    assert.equal(roll(context, { skill: "Scrap", dc: 6, who: "Nobody" }).result.adjust, undefined, "a stranger");
    assert.equal(roll(contextFor(ember), { skill: "Scrap", dc: 6 }).result.adjust, undefined, "an empty pack");

    // The record writes it signed and reads it back.
    const record = serializeResolvedSkillCheckTag(scrap);
    assert.match(record, / adjust="-2"/);
    const back = parseSkillCheckTagBody(/\[skill_check:([^\]]+)\]/.exec(record)![1]!);
    assert.equal(back?.resolvedResult?.adjust, -2);
    assert.match(serializeResolvedSkillCheckTag({ ...scrap, adjust: 1 }), / adjust="\+1"/);
    assert.doesNotMatch(serializeResolvedSkillCheckTag(sway), /adjust=/);

    // A summed record is kept only when its modifier is the one this sheet gives, modifier included.
    const written: SkillCheckResult = {
      skill: "Scrap",
      dc: 6,
      rolls: [3, 4],
      usedRoll: 7,
      modifier: -2,
      total: 5,
      success: false,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution: "sum",
      dice: "2d6",
      adjust: -2,
    };
    const vouched = serializeResolvedSkillCheckTag(written);
    const kept = await resolveSkillCheckTagsInContent(vouched, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(kept.content, vouched, "the Engine's own record stands");
    const forgot = serializeResolvedSkillCheckTag({
      ...written,
      modifier: 0,
      total: 7,
      success: true,
      adjust: undefined,
    });
    const rerolled = await resolveSkillCheckTagsInContent(forgot, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.notEqual(rerolled.content, forgot, "one that left the burden out is rolled again");
    assert.match(rerolled.content, /modifier="-2"/);

    // On a pool it is dice: every Ward loses two, and nothing but Nerve's checks does.
    const heavy = plain((doc) => (doc.resolution.adjust = [{ value: { const: -2 }, abilities: ["nerve"] }]));
    const heavyContext = contextFor(heavy, strong(heavy));
    const ward = roll(heavyContext, { skill: "Ward", dc: 1 }).result;
    assert.deepEqual([ward.rolls.length, ward.adjust, ward.modifier], [8, -2, 0]);
    assert.equal(roll(heavyContext, { skill: "Wrestle", dc: 1 }).result.rolls.length, 10);
    assert.equal(
      roll(heavyContext, { skill: "Ward", dc: 1, who: "Nobody" }).result.adjust,
      undefined,
      "a stranger has no sheet for it to come off",
    );
    // Nerve and Sinew together: the pair rolls with Nerve, so it takes the modifier.
    const paired = roll(heavyContext, { skill: "Sinew", dc: 1, withAbility: "Nerve" }).result;
    assert.deepEqual([paired.rolls.length, paired.adjust], [8, -2]);
    // With no abilities named it is on every check, beside the wound penalty and under the same floor.
    const everywhere = plain((doc) => (doc.resolution.adjust = [{ value: { const: -20 } }]));
    const floored = roll(contextFor(everywhere, strong(everywhere)), { skill: "Wrestle", dc: 1 }).result;
    assert.deepEqual([floored.rolls.length, floored.adjust], [1, -20], "held at pool.min");
  }

  // ── The Game Master's reminder ──
  {
    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: [], playerName: "Mira" };
    const shipped = buildGmFormatReminder({
      ...base,
      ruleset: parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch"),
    });
    assert.match(
      shipped,
      /When the rules let a roll be thrown again, add reroll="id": careful \(dice showing 6 or less, once\)\./,
    );
    assert.match(shipped, /every 1 Resolve buys 1 automatic success, up to 2 times per check\./);
    const summed = buildGmFormatReminder({ ...base, ruleset: parsedOrThrow(JSON.parse(emberText), "Ember Roads") });
    assert.doesNotMatch(summed, /reroll=/, "a ruleset with none is never offered one");
    const bought = buildGmFormatReminder({
      ...base,
      ruleset: plain((doc) => {
        doc.sheet.live.pools.push(
          ...[1, 2, 3].map((index) => ({ id: `p${index}`, label: `Pool ${index}`, max: { const: 5 } })),
        );
        doc.sheet.fields.push({ id: "gift", label: "Gift", type: "enum", values: ["sinew", "nerve", "warmth"] });
        doc.resolution.spend = [
          { pool: "resolve", amount: 1, reroll: { upTo: 9, mode: "until" }, dice: 1, perCheck: "pool" },
          { pool: "p1", amount: 2, successes: 2, perCheck: { abilityScore: "nerve" } },
          { pool: "p2", amount: 1, successes: 1, perCheck: 1 },
          { pool: "p3", amount: 1, dice: 1, perCheck: { abilityModFromField: "gift" } },
        ];
      }),
    });
    assert.match(
      bought,
      /every 1 Resolve buys 1 extra die and a throw again of dice showing 9 or less, until they show more, up to as many times per check as the check has dice\./,
    );
    assert.match(
      bought,
      /every 2 Pool 1 buys 2 automatic successes, up to as many times per check as the sheet's Nerve\./,
    );
    assert.match(bought, /every 1 Pool 2 buys 1 automatic success, up to 1 time per check\./);
    assert.match(
      bought,
      /every 1 Pool 3 buys 1 extra die, up to as many times per check as the modifier of the ability the sheet's Gift names\./,
    );
    assert.match(
      bought,
      /reroll="id": sure \(dice showing 6 or less, until they show more\), careful \(dice showing 3 or less, once\)\./,
    );
  }

  // ── The one-request branch arm and the endpoint carry the name ──
  {
    const branched = await resolveGameTurnBranches(
      [
        `Before. [skill_check: skill="Ward" dc="1" reroll="sure" branch="door"]`,
        `[branch: door]`,
        `[on success] It opens.`,
        `[on failure] It holds.`,
        `[/branch]`,
      ].join("\n"),
      createGameTurnChanceSession({
        db: null as never,
        chatId: "lane",
        roll: () => 1,
        loadModifierContext: () => Promise.resolve(contextFor(definition, build)),
      }),
    );
    const faces = /rolls="([^"]+)"/.exec(branched.content)?.[1]?.split("|").map(Number) ?? [];
    assert.ok(faces.length === 10 && faces.every((face) => face > 6), `thrown again: ${faces.join(",")}`);
    assert.match(branched.content, /It opens\./, "ten dice that all count always open it");
    assert.doesNotMatch(branched.content, /It holds\./);

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
      // The endpoint's player has no sheet of their own, so a blank warden throws: Nerve 2 on Ward.
      // A re-throw until every die clears 6 still leaves only dice that count.
      const document = JSON.parse(gravewatchText);
      delete document.layers;
      delete document.resolution.explode;
      document.catalogs[0].entries = document.catalogs[0].entries.filter((entry: any) => entry.id !== "grave-sight");
      document.resolution.reroll = [{ id: "sure", upTo: 6, mode: "until" }];
      await createGameRulesetsStorage(db).put({
        rulesetId: "local/gravewatch",
        version: definition.version,
        sourceKind: "local",
        definition: JSON.stringify(document),
      });
      const chats = createChatsStorage(db);
      const chat = await chats.create({ name: "Rerolls", mode: "game", characterIds: [] } as never);
      assert.ok(chat);
      await chats.patchMetadata(chat.id, {
        gameRuleset: { id: "local/gravewatch", version: definition.version, packageId: null, options: {} },
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/game/skill-check",
        payload: { chatId: chat.id, skill: "Ward", dc: 1, reroll: "sure" },
      });
      assert.equal(response.statusCode, 200, response.body);
      const { result } = response.json() as { result: SkillCheckResult };
      assert.ok(result.rolls.length >= 1 && cleared(result), `the endpoint threw it again: ${result.rolls.join(",")}`);
    } finally {
      await app.close();
      await closeDB();
    }
  }

  // ── Every new key needs 1.38 to install ──
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
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const issue = /requires schemaVersion 2 and capabilityApi 1\.38 or newer/;
    const spend = { pool: "resolve", amount: 1, successes: 1, perCheck: 1 };
    const resolutions = [
      { kind: "dice-pool", reroll: [{ id: "sure", upTo: 9, mode: "until" }] },
      { kind: "dice-pool", adjust: [{ value: { const: -1 } }] },
      { kind: "dice-sum", adjust: [{ value: { field: "burden" }, abilities: ["brawn"] }] },
      { kind: "dice-pool", spend: [{ ...spend, successes: undefined, reroll: { upTo: 1, mode: "once" } }] },
      { kind: "dice-pool", spend: [{ ...spend, perCheck: "pool" }] },
      { kind: "dice-pool", spend: [{ ...spend, perCheck: { abilityScore: "nerve" } }] },
      { kind: "dice-pool", spend: [spend, spend, spend] },
    ];
    for (const resolution of resolutions) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(37) as never, { resolution }) ?? "",
        issue,
        JSON.stringify(resolution),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(38) as never, { resolution }), null);
    }
    // Two spends with a number for a limit are what every file before 1.38 could say.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(37) as never, {
        resolution: { kind: "dice-pool", spend: [spend, spend] },
      }),
      null,
    );
  }

  console.info("game ruleset reroll and spend regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
