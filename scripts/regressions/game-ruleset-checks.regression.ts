/**
 * Slice 2 of Game Mode rulesets: a game that pinned a ruleset rolls its checks through the
 * ruleset's `dice-sum` kind and the party's ruleset sheets, and a game that pinned nothing is
 * untouched, prompt and result alike.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollDiceSumCheck,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-checks-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckTagsInContent, resolveSkillCheckWithContext },
    { buildGmFormatReminder },
    { buildGameSkillModifierView, resolveSheetModifier },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/game/one-request-dice.js"),
  ]);

  const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
  const parsedExample = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(exampleUrl), "utf8")));
  assert.ok(parsedExample.ok);
  const fiveE: RulesetDefinition = parsedExample.definition;

  const buildWith = (overrides: Partial<RulesetSheetBuild>): RulesetSheetBuild => ({
    ...defaultRulesetSheetBuild(fiveE),
    ...overrides,
  });
  const levelBuild = (level: number, overrides: Partial<RulesetSheetBuild> = {}): RulesetSheetBuild => {
    const base = buildWith(overrides);
    return { ...base, fields: { ...base.fields, level } };
  };

  // ── Sheet arithmetic ──
  {
    // The proficiency table steps at 5, 9, 13 and 17.
    for (const [level, bonus] of [
      [1, 2],
      [4, 2],
      [5, 3],
      [8, 3],
      [9, 4],
      [16, 5],
      [17, 6],
      [20, 6],
    ] as const) {
      assert.equal(evaluateRulesetSheet(fiveE, levelBuild(level)).proficiencyBonus, bonus, `level ${level}`);
    }

    const rogue = evaluateRulesetSheet(
      fiveE,
      levelBuild(5, {
        abilities: { str: 8, dex: 16, con: 12, int: 13, wis: 10, cha: 14 },
        skills: { stealth: "expertise", acrobatics: "proficient", history: "half" },
        saves: { dex_save: "proficient" },
        bonuses: { perception: 1 },
      }),
    );
    assert.equal(rogue.abilityMods.str, -1, "8 is -1, rounded down");
    assert.equal(rogue.skillMods.stealth, 3 + 6, "expertise doubles the +3 bonus");
    assert.equal(rogue.skillMods.acrobatics, 3 + 3);
    assert.equal(rogue.skillMods.history, 1 + 1, "half of +3 rounds down to +1");
    assert.equal(rogue.skillMods.athletics, -1, "an unmentioned skill takes the first tier");
    assert.equal(rogue.saveMods.dex_save, 3 + 3);
    assert.equal(rogue.saveMods.con_save, 1);
    assert.equal(rogue.derived.passive_perception, 10 + 0 + 1, "passive Perception is a sum over a skill modifier");
    assert.equal(rogue.derived.initiative, 3);
    assert.equal(rogue.derived.spell_save_dc, 8 + 3 + 0, "no spellcasting ability reads as +0");

    const wizard = evaluateRulesetSheet(
      fiveE,
      levelBuild(9, {
        abilities: { int: 18 },
        fields: { ...defaultRulesetSheetBuild(fiveE).fields, level: 9, spellcasting_ability: "int" },
      }),
    );
    assert.equal(wizard.derived.spell_save_dc, 8 + 4 + 4);
    assert.equal(wizard.derived.spell_attack, 4 + 4);

    // An unset spellcasting choice reads as the field's declared default, not as nothing.
    const defaulted = {
      ...fiveE,
      sheet: {
        ...fiveE.sheet,
        fields: fiveE.sheet.fields.map((field) =>
          field.id === "spellcasting_ability" && field.type === "enum" ? { ...field, default: "wis" } : field,
        ),
      },
    };
    const cleric = levelBuild(1, { abilities: { wis: 16 } });
    delete (cleric.fields as Record<string, unknown>).spellcasting_ability;
    assert.equal(evaluateRulesetSheet(defaulted, cleric).derived.spell_attack, 2 + 3);
    // A stored choice the ruleset no longer offers reads as the default too, never as a bare +0.
    const staleChoice = levelBuild(1, { abilities: { wis: 16 }, fields: { spellcasting_ability: "luck" } });
    assert.equal(evaluateRulesetSheet(defaulted, staleChoice).derived.spell_attack, 2 + 3);

    // Tolerant reading: junk reads as the default, unknown keys are ignored, nothing throws.
    const junk = evaluateRulesetSheet(fiveE, {
      abilities: { dex: Number.NaN, luck: 99 },
      skills: { stealth: "grandmaster" },
      saves: {},
      bonuses: {},
      fields: { level: "nine" },
      lists: {},
    } as unknown as RulesetSheetBuild);
    assert.equal(junk.abilityMods.dex, 0);
    assert.equal(junk.proficiencyBonus, 2);
    assert.equal(junk.skillTiers.stealth, "none");
  }

  // ── What a requested name means ──
  {
    const target = (name: string) => {
      const match = matchRulesetCheckTarget(fiveE, name);
      return match ? `${match.type}:${match.id}` : null;
    };
    assert.equal(target("Stealth"), "skill:stealth");
    assert.equal(target("sleight of hand"), "skill:sleight_of_hand");
    assert.equal(target("Sleight_of_Hand check"), "skill:sleight_of_hand");
    assert.equal(target("Dexterity save"), "save:dex_save");
    assert.equal(target("DEX saving throw"), "save:dex_save");
    assert.equal(target("dex_save"), "save:dex_save");
    assert.equal(target("Strength"), "ability:str");
    assert.equal(target("Strength check"), "ability:str");
    assert.equal(target("Basket weaving"), null, "an unknown name is never mapped to a guessed ability");
    assert.equal(target("Luck save"), null);
  }

  // ── The dice ──
  {
    const script = (values: number[]) => {
      let index = 0;
      return (sides: number) => {
        assert.equal(sides, 20);
        assert.ok(index < values.length, "asked for more dice than scripted");
        return values[index++]!;
      };
    };
    const base = { modifier: 4, dc: 15, isSave: false };
    // 2014 rules: a natural 20 below the DC fails and a natural 1 above it passes.
    const nat20 = rollDiceSumCheck(fiveE, { ...base, modifier: -1, dc: 25 }, script([20]));
    assert.deepEqual([nat20.total, nat20.success, nat20.criticalSuccess], [19, false, false]);
    const nat1 = rollDiceSumCheck(fiveE, { ...base, modifier: 11, dc: 10 }, script([1]));
    assert.deepEqual([nat1.total, nat1.success, nat1.criticalFailure], [12, true, false]);

    const advantage = rollDiceSumCheck(fiveE, { ...base, advantage: true }, script([7, 15]));
    assert.deepEqual(
      [advantage.rolls, advantage.usedRoll, advantage.rollMode, advantage.dice],
      [[7, 15], 15, "advantage", "2d20"],
    );
    const disadvantage = rollDiceSumCheck(fiveE, { ...base, disadvantage: true }, script([7, 15]));
    assert.equal(disadvantage.usedRoll, 7);
    const cancelled = rollDiceSumCheck(fiveE, { ...base, advantage: true, disadvantage: true }, script([9]));
    assert.deepEqual([cancelled.rolls, cancelled.rollMode], [[9], "normal"]);
    const playerDie = rollDiceSumCheck(fiveE, { ...base, advantage: true, preRolled: 12 }, script([]));
    assert.deepEqual([playerDie.rolls, playerDie.total, playerDie.rollMode], [[12], 16, "normal"]);

    // A ruleset may say otherwise: the policy is the ruleset's, per roll type.
    const crits: RulesetDefinition = {
      ...fiveE,
      resolution: { ...fiveE.resolution, naturals: { check: "both", save: "max-only" } },
    };
    const critCheck = rollDiceSumCheck(crits, { ...base, modifier: -1, dc: 25 }, script([20]));
    assert.deepEqual([critCheck.success, critCheck.criticalSuccess], [true, true]);
    const saveFumble = rollDiceSumCheck(crits, { ...base, modifier: 11, dc: 10, isSave: true }, script([1]));
    assert.deepEqual([saveFumble.success, saveFumble.criticalFailure], [true, false], "max-only leaves a 1 alone");

    // Not d20-shaped: 2d6 plus a modifier, where advantage is not a thing.
    const twoD6: RulesetDefinition = {
      ...fiveE,
      resolution: { ...fiveE.resolution, dice: { count: 2, sides: 6 }, advantage: false },
    };
    let next = 0;
    const d6 = [3, 5, 6, 6];
    const roll = rollDiceSumCheck(twoD6, { modifier: 1, dc: 8, isSave: false, advantage: true }, (sides) => {
      assert.equal(sides, 6);
      return d6[next++]!;
    });
    assert.deepEqual(
      [roll.rolls, roll.total, roll.success, roll.dice, roll.rollMode],
      [[3, 5], 9, true, "2d6", "normal"],
    );
  }

  // ── Through the GM's tags ──
  const cards = [
    {
      name: "Mira",
      rulesetSheet: { v: 1, build: levelBuild(5, { abilities: { dex: 16 }, skills: { stealth: "expertise" } }) },
    },
    {
      name: "Tam the Bold",
      rulesetSheet: { v: 1, build: levelBuild(1, { abilities: { str: 18 }, skills: { athletics: "proficient" } }) },
    },
    { name: "Sheetless" },
  ];
  const context: SkillCheckModifierContext = {
    skills: { Stealth: 99 },
    attributes: null,
    sheetAttributes: { dex: 30 },
    ruleset: buildSkillCheckRulesetContext(fiveE, cards, cards[0]),
  };
  const scripted = (values: number[]) => {
    let index = 0;
    return () => {
      assert.ok(index < values.length, "asked for more d20s than scripted");
      return values[index++]!;
    };
  };
  const resolve = (content: string, dice: number[], rulesetPinned = true) =>
    resolveSkillCheckTagsInContent(content, {
      loadContext: async () => context,
      rollD20: scripted(dice),
      rulesetPinned,
    });

  {
    // The player, by default: DEX +3 and expertise +6, and none of the legacy modifier sources.
    const player = await resolve(`She slips past. [skill_check: skill="Stealth" dc="15"]`, [4]);
    assert.equal(
      player.content,
      `She slips past. [skill_check: skill="Stealth" dc="15" rolls="4" used="4" modifier="9" total="13" result="failure" mode="normal" resolution="sum" dice="1d20"]`,
    );

    // A named party member, and the name survives the rewrite so the record says who rolled.
    const member = await resolve(`[skill_check: skill="Athletics" dc="12" who="tam the bold"]`, [6]);
    assert.match(member.content, /modifier="6" total="12" result="success"/);
    assert.match(member.content, /who="tam the bold"\]$/);

    // No sheet, or nobody by that name: unmodified dice, never someone else's sheet.
    const sheetless = await resolve(`[skill_check: skill="Stealth" dc="10" who="Sheetless"]`, [10]);
    assert.match(sheetless.content, /modifier="0" total="10" result="success"/);
    const stranger = await resolve(`[skill_check: skill="Stealth" dc="10" who="A Guard"]`, [10]);
    assert.match(stranger.content, /modifier="0" total="10"/);

    // Defaults are not neutral in every system. A party member without a sheet gets the ruleset's
    // blank build; a stranger, or a name two cards share, gets no modifier at all.
    const gritty: RulesetDefinition = {
      ...fiveE,
      resolution: {
        ...fiveE.resolution,
        proficiencyTiers: [
          { id: "untrained", label: "Untrained", multiplier: 0, round: "down", flat: -3 },
          ...fiveE.resolution.proficiencyTiers,
        ],
      },
    };
    const grittyCards = [...cards, { name: "Twin" }, { name: "twin" }];
    const grittyContext = { ...context, ruleset: buildSkillCheckRulesetContext(gritty, grittyCards, cards[0]) };
    const grittyResolve = (content: string) =>
      resolveSkillCheckTagsInContent(content, {
        loadContext: async () => grittyContext,
        rollD20: scripted([10]),
        rulesetPinned: true,
      });
    assert.match(
      (await grittyResolve(`[skill_check: skill="Arcana" dc="10" who="Sheetless"]`)).content,
      /modifier="-3" total="7"/,
    );
    assert.match(
      (await grittyResolve(`[skill_check: skill="Arcana" dc="10" who="A Guard"]`)).content,
      /modifier="0" total="10"/,
    );
    assert.match(
      (await grittyResolve(`[skill_check: skill="Arcana" dc="10" who="Twin"]`)).content,
      /modifier="0" total="10"/,
    );
    // The player keeps a name they share with a party member.
    const sharedName = buildSkillCheckRulesetContext(fiveE, [{ name: "mira" }, ...cards], cards[0]);
    assert.equal(sharedName.sheets.get("mira"), sharedName.sheets.get(sharedName.playerKey!));
    assert.equal(sharedName.sheets.get("mira")!.skillMods.stealth, 9);

    // Natural 20 that misses the DC is a plain failure in the saved text and on the card.
    const nat20 = await resolve(`[skill_check: skill="Arcana" dc="25"]`, [20]);
    assert.match(nat20.content, /rolls="20" used="20" modifier="0" total="20" result="failure"/);
    const reread = parseSkillCheckTagBody(nat20.content.slice("[skill_check:".length, -1));
    assert.equal(reread?.resolvedResult?.criticalSuccess, false);
    assert.equal(reread?.resolvedResult?.success, false);

    // Idempotent: what the Engine wrote is what the ruleset vouches for, so a second pass rolls nothing.
    const again = await resolve(player.content, []);
    assert.equal(again.content, player.content);
    assert.deepEqual([again.resolved, again.trusted], [0, 1]);

    // The GM's own tidy arithmetic with the wrong modifier is not the character's check.
    const invented = await resolve(
      `[skill_check: skill="Stealth" dc="15" rolls="12" used="12" modifier="2" total="14" result="failure" mode="normal" resolution="sum" dice="1d20"]`,
      [12],
    );
    assert.match(invented.content, /modifier="9" total="21" result="success"/);
    assert.equal(invented.resolved, 1);
    // ...and an invented critical is not one either, under a ruleset whose checks have none.
    const inventedCrit = await resolve(
      `[skill_check: skill="Stealth" dc="40" rolls="20" used="20" modifier="9" total="29" result="critical_success" mode="normal" resolution="sum" dice="1d20"]`,
      [20],
    );
    assert.match(inventedCrit.content, /total="29" result="failure"/);

    // The die that counted has to be the die the mode keeps.
    const wrongKept = await resolve(
      `[skill_check: skill="Stealth" dc="15" rolls="3|18" used="3" modifier="9" total="12" result="failure" mode="advantage" resolution="sum" dice="2d20"]`,
      [3, 18],
    );
    assert.match(wrongKept.content, /rolls="3\|18" used="18" modifier="9" total="27" result="success"/);
    const honestAdvantage = `[skill_check: skill="Stealth" dc="15" rolls="3|18" used="18" modifier="9" total="27" result="success" mode="advantage" resolution="sum" dice="2d20"]`;
    assert.equal((await resolve(honestAdvantage, [])).content, honestAdvantage);

    // A tag that names another system is left exactly as written.
    const pool = `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]`;
    const foreign = await resolve(pool, []);
    assert.equal(foreign.content, pool);
    const otherDie = `[skill_check: skill="Endurance" dc="12" dice="3d6"]`;
    assert.equal((await resolve(otherDie, [])).content, otherDie);

    // The ruleset's ladder may reach past the Engine's own DC bounds; anything past both is left.
    const wide: RulesetDefinition = {
      ...fiveE,
      resolution: { ...fiveE.resolution, difficultyLadder: [{ label: "Mythic", dc: 60 }] },
    };
    const wideContext = { ...context, ruleset: buildSkillCheckRulesetContext(wide, cards, cards[0]) };
    const mythic = await resolveSkillCheckTagsInContent(`[skill_check: skill="Stealth" dc="60"]`, {
      loadContext: async () => wideContext,
      rollD20: scripted([20]),
      rulesetPinned: true,
    });
    assert.match(mythic.content, /total="29" result="failure"/);
    const beyond = `[skill_check: skill="Stealth" dc="61"]`;
    assert.equal(
      (await resolveSkillCheckTagsInContent(beyond, { loadContext: async () => wideContext, rulesetPinned: true }))
        .content,
      beyond,
    );

    // Invented numbers on a check that cannot be rolled either: the ask survives, the claim does not.
    const unrollable = await resolve(
      `[skill_check: skill="Stealth" dc="99" who="Mira" rolls="12" used="12" modifier="2" total="14" result="failure" mode="normal" resolution="sum" dice="1d20"]`,
      [],
    );
    assert.equal(unrollable.content, `[skill_check: skill="Stealth" dc="99" dice="1d20" who="Mira"]`);
    assert.deepEqual([unrollable.resolved, unrollable.trusted, unrollable.sparse], [0, 0, 1]);

    // A pin the install cannot honour: the context refuses to load, and the checks are saved
    // sparse, still owing a roll, never answered with another system's arithmetic.
    const unavailable = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Stealth" dc="15" who="Mira" rolls="12" used="12" modifier="2" total="14" result="failure" mode="normal" resolution="sum" dice="1d20"] ${pool}`,
      {
        loadContext: async () => {
          throw new Error("ruleset 5e-2014 is not available (missing)");
        },
        rulesetPinned: true,
      },
    );
    assert.equal(unavailable.content, `[skill_check: skill="Stealth" dc="15" dice="1d20" who="Mira"] ${pool}`);
    assert.deepEqual([unavailable.resolved, unavailable.sparse], [0, 1]);
  }

  // ── The sighted pool rolls for the named party member too ──
  {
    const { createGameDicePoolSession } = await import("../../packages/server/src/services/game/dice-pool.service.js");
    const { createGameDicePool, DEFAULT_GAME_DICE_POOL_WINDOW, DEFAULT_GAME_DICE_POOL_AGE_TURNS } =
      await import("../../packages/shared/src/index.js");
    const pool = createGameDicePool(() => 1);
    pool.values.d20 = [6, 11, 3];
    const session = createGameDicePoolSession({
      chatId: "chat-ruleset-pool",
      pool,
      settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
    });
    const pooled = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Athletics" dc="12" who="Tam the Bold" mode="normal" dice="1d20" rolls="19" pool="d20:1"]`,
      { loadContext: async () => context, rulesetPinned: true, pool: session },
    );
    assert.match(
      pooled.content,
      /rolls="6" used="6" modifier="6" total="12" result="success"/,
      "the pool's die, Tam's sheet",
    );
    assert.match(pooled.content, /who="Tam the Bold"/);

    // A ruleset with no advantage spends ONE pool value even when the tag asks for advantage.
    const noAdvantage: RulesetDefinition = { ...fiveE, resolution: { ...fiveE.resolution, advantage: false } };
    const onePool = createGameDicePool(() => 1);
    onePool.values.d20 = [4, 17, 9];
    const oneSession = createGameDicePoolSession({
      chatId: "chat-ruleset-pool-noadv",
      pool: onePool,
      settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
    });
    const single = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Athletics" dc="12" who="Tam the Bold" mode="advantage" pool="d20:1|2"]`,
      {
        loadContext: async () => ({ ...context, ruleset: buildSkillCheckRulesetContext(noAdvantage, cards, cards[0]) }),
        rulesetPinned: true,
        pool: oneSession,
      },
    );
    assert.match(single.content, /rolls="4" used="4" modifier="6" total="10" result="failure" mode="normal"/);
    assert.match(single.content, /pool="d20:1"/, "one slot spent and recorded, not two");

    // A pool with nothing left saves the ask sparse, and the ask still says who it was for.
    const emptyPool = createGameDicePool(() => 1);
    emptyPool.values.d20 = [];
    const emptySession = createGameDicePoolSession({
      chatId: "chat-ruleset-pool-empty",
      pool: emptyPool,
      settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
    });
    const overflow = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Athletics" dc="12" who="Tam the Bold" pool="d20:1"]`,
      { loadContext: async () => context, rulesetPinned: true, pool: emptySession },
    );
    assert.match(overflow.content, /^\[skill_check: skill="Athletics" dc="12"[^\]]*who="Tam the Bold"\]$/);
    assert.doesNotMatch(overflow.content, /total=/);

    // The pool holds d20s, so a ruleset that rolls 2d6 gets an ordinary roll and spends nothing.
    const twoD6Pool: RulesetDefinition = {
      ...fiveE,
      resolution: { ...fiveE.resolution, dice: { count: 2, sides: 6 }, advantage: false },
    };
    const before = [...session.pool.values.d20];
    const unpooled = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Athletics" dc="8" who="Tam the Bold" pool="d20:1"]`,
      {
        loadContext: async () => ({ ...context, ruleset: buildSkillCheckRulesetContext(twoD6Pool, cards, cards[0]) }),
        rulesetPinned: true,
        pool: session,
      },
    );
    assert.match(unpooled.content, /dice="2d6"/);
    assert.doesNotMatch(unpooled.content, /pool=/);
    assert.deepEqual(session.pool.values.d20, before, "no pool value was spent");
  }

  // ── A failed load on the pool path still saves the ask with its name ──
  {
    const { createGameDicePoolSession } = await import("../../packages/server/src/services/game/dice-pool.service.js");
    const { createGameDicePool, DEFAULT_GAME_DICE_POOL_WINDOW, DEFAULT_GAME_DICE_POOL_AGE_TURNS } =
      await import("../../packages/shared/src/index.js");
    const pool = createGameDicePool(() => 1);
    pool.values.d20 = [6, 11, 3];
    const session = createGameDicePoolSession({
      chatId: "chat-ruleset-pool-fail",
      pool,
      settings: { window: DEFAULT_GAME_DICE_POOL_WINDOW, ageTurns: DEFAULT_GAME_DICE_POOL_AGE_TURNS },
    });
    const failed = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Athletics" dc="12" who="Tam the Bold" mode="normal" dice="1d20" rolls="19" pool="d20:1"]`,
      {
        loadContext: async () => {
          throw new Error("ruleset 5e-2014 is not available (missing)");
        },
        rulesetPinned: true,
        pool: session,
      },
    );
    assert.match(failed.content, /who="Tam the Bold"\]$/, "the owed check is still Tam's, not the player's");
    assert.doesNotMatch(failed.content, /total=/);
  }

  // ── The parser never puts `who` on a result: only the ruleset resolver does ──
  {
    const parsed = parseSkillCheckTagBody(
      ` skill="Stealth" dc="15" who="Tam" rolls="12" used="12" modifier="2" total="14" result="failure" mode="normal" resolution="sum" dice="1d20"`,
    );
    assert.equal(parsed?.who, "Tam");
    assert.ok(parsed?.resolvedResult);
    assert.equal("who" in parsed.resolvedResult, false);
  }

  // ── engine-legacy is untouched ──
  {
    const legacy: SkillCheckModifierContext = {
      skills: { Stealth: 2 },
      attributes: null,
      sheetAttributes: { dex: 14 },
    };
    const withWho = await resolveSkillCheckTagsInContent(`[skill_check: skill="Stealth" dc="15" who="Tam"]`, {
      loadContext: async () => legacy,
      rollD20: scripted([20]),
    });
    assert.equal(
      withWho.content,
      `[skill_check: skill="Stealth" dc="15" rolls="20" used="20" modifier="4" total="24" result="critical_success" mode="normal" resolution="sum" dice="1d20"]`,
      "without a pin the legacy arithmetic, the legacy critical and the legacy bytes all stand",
    );
    // A full tag with tidy arithmetic is still trusted without loading anything.
    const honest = `[skill_check: skill="Stealth" dc="15" rolls="12" used="12" modifier="2" total="14" result="failure" mode="normal" resolution="sum" dice="1d20"]`;
    const trusted = await resolveSkillCheckTagsInContent(honest, {
      loadContext: async () => {
        throw new Error("a legacy game must not load the context for a finished tag");
      },
    });
    assert.deepEqual([trusted.content, trusted.trusted], [honest, 1]);
    assert.equal(resolveSkillCheckWithContext(legacy, { skill: "Stealth", dc: 10 }, () => 1).criticalFailure, true);
  }

  // ── Roll placeholders read the ruleset sheet ──
  {
    assert.deepEqual(resolveSheetModifier(context, "DEX"), { value: 3, source: "attribute" });
    assert.deepEqual(resolveSheetModifier(context, "stealth"), { value: 9, source: "skill" });
    assert.deepEqual(resolveSheetModifier(context, "PROF"), { value: 3, source: "attribute" });
    assert.equal(resolveSheetModifier(context, "Basket"), null, "an unknown name is refused, never zero");
    const view = buildGameSkillModifierView(context);
    assert.ok(view.skills.includes("stealth") && view.skills.includes("dex_save"));
    assert.deepEqual(view.attributes, ["STR", "DEX", "CON", "INT", "WIS", "CHA", "PROF"]);
  }

  // ── The GM reminder ──
  {
    const base = {
      turnNumber: 3,
      gameActiveState: "exploration" as const,
      partyNames: ["Tam the Bold"],
      playerName: "Mira",
    };
    const legacyReminder = buildGmFormatReminder(base);
    assert.equal(
      buildGmFormatReminder({ ...base, ruleset: undefined }),
      legacyReminder,
      "no ruleset renders the reminder byte for byte",
    );
    assert.match(legacyReminder, /request a d20 check only when uncertainty matters/);
    assert.match(legacyReminder, /For other checks, declare the actual notation/);

    const reminder = buildGmFormatReminder({ ...base, ruleset: fiveE });
    assert.ok(reminder.includes(fiveE.gm.checkGuidance));
    assert.match(
      reminder,
      /Difficulty: Very easy 5, Easy 10, Medium 15, Hard 20, Very hard 25, Nearly impossible 30\./,
    );
    assert.match(reminder, /Add who="Character Name" to roll for a party member/);
    assert.match(reminder, /mode="advantage" or mode="disadvantage"/);
    assert.match(reminder, /the engine rolls 1d20 and applies the character sheet/);
    assert.doesNotMatch(reminder, /request a d20 check only when uncertainty matters/);
    assert.doesNotMatch(reminder, /For other checks, declare the actual notation/);
    // Everything outside the check lines is the same reminder.
    const strip = (text: string) =>
      text
        .split("\n")
        .filter(
          (line) =>
            !line.startsWith("- [skill_check:") &&
            !line.startsWith("- For other checks") &&
            !line.startsWith("- If roll_dice has already returned") &&
            !line.startsWith("- Do not use roll_dice for"),
        )
        .join("\n");
    assert.equal(strip(reminder), strip(legacyReminder));

    // The tool is still there for damage and the like, but it is never how a check is recorded.
    assert.match(reminder, /Do not use roll_dice for an ability check, skill check or saving throw/);
    assert.doesNotMatch(reminder, /modifier="tool modifier"/);
    assert.match(legacyReminder, /modifier="tool modifier"/);

    // With one-request dice on, no line of the reminder still teaches the built-in 1-20 range.
    const oneRequest = buildGmFormatReminder({ ...base, ruleset: fiveE, oneRequestDice: true });
    assert.doesNotMatch(oneRequest, /dc="1-20"/);
    assert.match(buildGmFormatReminder({ ...base, oneRequestDice: true }), /dc="1-20"/);

    const submitted = buildGmFormatReminder({ ...base, ruleset: fiveE, playerDiceRollSubmitted: true });
    assert.match(submitted, /rolls="the player's d20 result"/);
  }

  console.info("game ruleset check regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
