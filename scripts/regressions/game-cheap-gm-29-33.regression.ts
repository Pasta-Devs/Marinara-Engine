/**
 * Cheap-model Game Master playtest, 2026-10-26 (5e SRD game), findings 29 to 33:
 *
 *   - 29: a rest's dice are spent only on a sheet below its maximum, and only as many as it takes to
 *     fill it; a restore of the same pool beside a rest whose dice healed it is left to the rest, once.
 *   - 30: a thought line with no colon (`[Saffron Reyes] [thought] ...`), or with its text on the next
 *     line, is that character's thought; any other type without a colon is left as it is.
 *   - 31: Metamagic is asked about only where an option is of use: one that moves the cast to another
 *     budget only while that budget is left, Twinned only with somebody more to aim at, Distant only
 *     with somebody beyond reach.
 *   - 32: the line a fight's recap asks the Game Master for a reward on stays in the recap and never
 *     shows on the player's Combat Result card.
 *   - 33: a ranger's kit Longbow, carried and not equipped, is offered as an attack in a ruleset fight
 *     (Capability API 1.808's draw on use).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GAME_REWARD_PROMPT_LINE,
  applyRulesetSheetOp,
  applySheetCommandTags,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  parseGameNarrationSegments,
  parseRulesetDefinition,
  readRulesetLive,
  repairGameSpeakerLine,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  rulesetSheetItems,
  stripGameRewardPromptLine,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { DirectedRulesetOption, DirectedRulesetView } from "../../packages/shared/src/features/combat-director.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";
import { rulesetAlterOffers } from "../../packages/shared/src/features/ruleset-combat/options.js";
import { rulesetUsefulAlters } from "../../packages/client/src/lib/ruleset-combat-board.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cheap-gm-29-33-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };

  // ── 29: a rest's dice fill the sheet, and heal it once ──
  {
    const doc = JSON.parse(fiveEText);
    doc.rests.find((rest: { id: string }) => rest.id === "short").dice = {
      pool: "hit_dice",
      die: { field: "hit_die" },
      add: { abilityMod: "con" },
      heals: "hp",
    };
    const definition = parsed(doc);
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      fields: { level: 4, ac: 12, speed: 30, hp_max: 40, hit_die: "d10" },
    });
    // Every d10 a 7: 9 healed a die with Constitution's +2.
    const roll = (sides: number) => (sides === 10 ? 7 : 3);
    const at = (hp: number) => ({ pools: { hp: { value: hp } } });
    const pool = (live: unknown, key: string) =>
      readRulesetLive(definition, build, live).pools.find((one) => one.key === key)?.value;

    // At full health: no die is spent, and the rest goes on.
    const full = applyRulesetSheetOp(definition, build, at(40), { op: "rest", rest: "short", dice: 2 }, roll);
    assert.ok(full.ok, JSON.stringify(full));
    assert.equal(pool(full.live, "hit_dice"), 4, "no hit die spent at full health");
    assert.equal(pool(full.live, "hp"), 40);
    assert.match(full.now, /none spent: .* already full/);
    // Five short of it: one die fills it, and the second is never rolled.
    const near = applyRulesetSheetOp(definition, build, at(35), { op: "rest", rest: "short", dice: 2 }, roll);
    assert.ok(near.ok, JSON.stringify(near));
    assert.equal(pool(near.live, "hit_dice"), 3, "one die is all it takes");
    assert.equal(pool(near.live, "hp"), 40);
    assert.ok(near.now.startsWith("1 of 2 spent (7), full after"), near.now);
    // Far below it, every die asked for is spent, as before.
    const low = applyRulesetSheetOp(definition, build, at(10), { op: "rest", rest: "short", dice: 2 }, roll);
    assert.ok(low.ok);
    assert.equal(pool(low.live, "hit_dice"), 2);
    assert.equal(pool(low.live, "hp"), 28);
    assert.ok(low.now.startsWith("2 spent (7, 7): "), low.now);

    // The party: a full member spends nothing, a hurt one spends what it needs.
    const ada = normalizeCharacterLookupName("Ada");
    const sef = normalizeCharacterLookupName("Sef");
    const run = (content: string, live = { [ada]: at(40), [sef]: at(20) }) =>
      applySheetCommandTags(content, {
        definition,
        cards: [
          { name: "Ada", build },
          { name: "Sef", build },
        ],
        playerName: "Ada",
        live: live as never,
        roll,
      });
    const party = run(`They rest. [sheet: who="party" op="rest" rest="short" dice="2"]`);
    assert.ok(party.outcomes[0]!.ok, JSON.stringify(party.outcomes));
    assert.equal(pool(party.live[ada], "hit_dice"), 4, "Ada was at full health");
    assert.equal(pool(party.live[sef], "hit_dice"), 2);
    assert.equal(pool(party.live[sef], "hp"), 38);
    // The sorcerer's dice heal him, and the 2d6+2 restore written beside the rest is left to it.
    const twice = run(
      `[sheet: who="Sef" op="rest" rest="short" dice="2"] [sheet: who="Sef" op="restore" pool="Hit points" amount="9"]`,
    );
    assert.deepEqual(
      twice.outcomes.map((one) => one.ok),
      [true, true],
    );
    assert.match(twice.outcomes[1]!.now!, /left to the Short rest, whose dice heal it/);
    assert.equal(pool(twice.live[sef], "hp"), 38, "healed by the dice alone");
    // One rest stands for one restore: a second still heals, and so does one with no rest's dice.
    const second = run(
      `[sheet: who="Sef" op="rest" rest="short" dice="1"] [sheet: who="Sef" op="restore" pool="hp" amount="3"] [sheet: who="Sef" op="restore" pool="hp" amount="2"]`,
    );
    assert.equal(pool(second.live[sef], "hp"), 31, "20 + 9 by the die, the first restore left, then 2");
    const bare = run(`[sheet: who="Sef" op="rest" rest="short"] [sheet: who="Sef" op="restore" pool="hp" amount="4"]`);
    assert.equal(pool(bare.live[sef], "hp"), 24, "a rest that spent no dice heals nothing of its own");
    // Somebody else's restore is theirs.
    const other = run(
      `[sheet: who="Sef" op="rest" rest="short" dice="1"] [sheet: who="Ada" op="restore" pool="hp" amount="4"]`,
      { [ada]: at(30), [sef]: at(20) },
    );
    assert.equal(pool(other.live[ada], "hp"), 34);
  }

  // ── 30: a thought with no colon ──
  {
    assert.equal(
      repairGameSpeakerLine("[Saffron Reyes] [thought] This is going to hurt."),
      "[Saffron Reyes] [thought]: This is going to hurt.",
    );
    assert.equal(
      repairGameSpeakerLine("[Saffron Reyes] [thought] [worried] Not again."),
      "[Saffron Reyes] [thought] [worried]: Not again.",
    );
    // Any other type with no colon may be prose about the character, and is left alone.
    assert.equal(repairGameSpeakerLine("[Alice] [main] [happy] waves."), "[Alice] [main] [happy] waves.");
    const segments = (content: string) =>
      parseGameNarrationSegments({ id: "m", content }).map((one) => ({
        type: one.type,
        speaker: one.speaker,
        partyType: one.partyType,
        content: one.content,
      }));
    const thought = {
      type: "dialogue",
      speaker: "Saffron Reyes",
      partyType: "thought",
      content: "This is going to hurt.",
    };
    assert.deepEqual(segments("[Saffron Reyes] [thought] This is going to hurt."), [thought]);
    // The text on the line after it.
    assert.deepEqual(segments("The door creaks.\n\n[Saffron Reyes] [thought]\nThis is going to hurt."), [
      { type: "narration", speaker: undefined, partyType: undefined, content: "The door creaks." },
      thought,
    ]);
    // A tag line after it is its own.
    assert.equal(
      segments('[Saffron Reyes] [thought]\n[Saffron Reyes] [main]: "Hi."').some((one) => one.partyType === "main"),
      true,
    );
  }

  // ── 31: Metamagic only where it is of use ──
  {
    const spell = {
      id: "bolt",
      label: "Bolt",
      rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        damageType: "fire",
        range: 60,
        amount: { dice: "2d10" },
        cost: [{ pool: "slots_1", amount: 1 }],
      },
    };
    const meta = (id: string, label: string, alters: Record<string, unknown>, price: Record<string, unknown> = {}) => ({
      id,
      label,
      rows: [{ list: "features", values: { name: label } }],
      mechanics: { kind: "utility", usesOf: "Sorcery Points", alters: { catalogs: ["spells"], ...alters }, ...price },
    });
    const sorcery = [
      {
        id: "points",
        label: "Font of Magic",
        rows: [
          { list: "features", values: { name: "Font of Magic" } },
          { list: "counters", values: { name: "Sorcery Points", max: 5, recharge: "long" } },
        ],
      },
      meta("quickened", "Quickened Spell", { budget: { from: "action", to: "bonus" } }, { usesSpent: 2 }),
      meta("twinned", "Twinned Spell", { twins: true }, { usesSpentByLevel: true }),
      meta("distant", "Distant Spell", { range: { times: 2, touch: 30 } }),
    ] as unknown as RulesetCatalogEntry[];
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: [spell] },
      { id: "sorcery", label: "Sorcery", feeds: ["features", "counters"], entries: sorcery },
    );
    const definition = parsed(doc);
    const rows = (catalog: string, entries: RulesetCatalogEntry[], list: string) =>
      entries.flatMap((entry) =>
        rowsFromCatalogEntry(catalog, entry).flatMap((one) => (one.list === list ? [one.row] : [])),
      );
    const spells = [spell] as unknown as RulesetCatalogEntry[];
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "cha", slots_max_1: 4 },
      lists: {
        spells: rows("spells", spells, "spells"),
        features: rows("sorcery", sorcery, "features"),
        counters: rows("sorcery", sorcery, "counters"),
      },
    });
    const block = {
      health: 30,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: {},
      actions: [],
    } as unknown as RulesetStatBlock;
    const grid: TacticalGrid = {
      width: 20,
      height: 10,
      tiles: Array.from({ length: 10 }, () => Array(20).fill("plains")),
    };
    const fight = (): RulesetEncounterState => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 3,
        bestiary: {},
        combatants: [
          { id: "sorc", name: "Sorcerer", side: "party", build, live: {}, catalogs: { spells, sorcery } },
          { id: "a", name: "A", side: "enemy", block },
        ],
        board: { grid, placements: { sorc: { x: 2, y: 5 }, a: { x: 6, y: 5 } } },
      });
      state.order = ["sorc", "a"];
      state.turn = 0;
      return state;
    };
    const bolt = (state: RulesetEncounterState) =>
      rulesetCombatOptions(definition, state, "sorc").find((one) => one.label === "Bolt")!;
    const offered = (state: RulesetEncounterState) =>
      rulesetAlterOffers(
        definition,
        state,
        rulesetCombatant(state, "sorc")!,
        rulesetCombatant(state, "sorc")!.actions.find((one) => one.label === "Bolt")!,
      ).map((one) => one.label);
    const fresh = fight();
    assert.ok(offered(fresh).includes("Quickened Spell"), "the bonus action is free");
    assert.ok(
      bolt(fresh).alters?.some((one) => one.ranges),
      "Distant says it stretches the range",
    );
    // The bonus action spent: Quickened has nothing to move the cast to.
    const spent = fight();
    rulesetCombatant(spent, "sorc")!.budgets.bonus = 0;
    assert.ok(!offered(spent).includes("Quickened Spell"), JSON.stringify(offered(spent)));
    assert.ok(!bolt(spent).alters?.some((one) => one.label === "Quickened Spell"));
    // With nothing affordable, nothing is offered and the step is skipped.
    const broke = fight();
    const sorc = rulesetCombatant(broke, "sorc")!;
    rulesetCombatant(broke, "sorc")!.sheet!.live = {
      ...sorc.sheet!.live,
      pools: { ...sorc.sheet!.live.pools, "counters:sorcery points": { value: 0 } },
    };
    assert.deepEqual(offered(broke), []);

    // On the menu: Twinned with one foe to aim at, and Distant with nobody beyond reach, are left out.
    const view = { actorId: "sorc", combatants: [] } as unknown as DirectedRulesetView;
    const alters = [
      { id: "twinned", label: "Twinned Spell", cost: 1, twins: true as const },
      { id: "distant", label: "Distant Spell", cost: 1, ranges: true as const },
      { id: "subtle", label: "Subtle Spell", cost: 1 },
    ];
    const option = (targetIds: string[], beyond: DirectedRulesetOption["beyond"] = []) =>
      ({ id: "bolt", targetIds, targets: { count: 1, side: "enemy" }, alters, beyond }) as DirectedRulesetOption;
    const useful = (one: DirectedRulesetOption) => rulesetUsefulAlters(view, one).map((offer) => offer.id);
    assert.deepEqual(useful(option(["a"])), ["subtle"], "one foe, everybody in reach");
    assert.deepEqual(useful(option(["a", "b"])), ["twinned", "subtle"]);
    assert.deepEqual(useful(option(["a"], [{ id: "b", why: "out-of-reach", cells: 20, reach: 12 }])), [
      "distant",
      "subtle",
    ]);
    assert.deepEqual(useful(option(["a"], [{ id: "b", why: "no-line-of-sight" }])), ["subtle"]);
    // One the option is offered only with is kept, of use or not.
    assert.deepEqual(useful({ ...option(["a"]), alterNeeded: "twinned" }), ["twinned", "subtle"]);
  }

  // ── 32: the reward line is the Game Master's alone ──
  {
    const recap = ["OUTCOME: VICTORY (after 3 rounds)", "Defeated: Goblin", GAME_REWARD_PROMPT_LINE].join("\n");
    assert.equal(stripGameRewardPromptLine(recap), "OUTCOME: VICTORY (after 3 rounds)\nDefeated: Goblin");
    // The card is the recap with the line taken out (the formatter needs a DOM, so it is read as text),
    // and the recap sent to the Game Master writes it from the one constant.
    const source = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
    const formatter = source("packages/client/src/components/game/game-narration-format.ts");
    const card = formatter.slice(formatter.indexOf("[combat_result]"), formatter.indexOf("[item_used]"));
    assert.match(card, /stripGameRewardPromptLine\(recap\)/, "the Combat Result card leaves it out");
    const surface = source("packages/client/src/components/game/GameSurface.tsx");
    assert.match(surface, /recapLines\.push\(GAME_REWARD_PROMPT_LINE\)/, "the Game Master's recap keeps it");
    assert.doesNotMatch(surface, /'Rewards: If a reward is narratively appropriate/);
  }

  // ── 33: the kit Longbow, carried, is an attack ──
  {
    // Ember Roads' two hands, weapons drawn as they are used: its two-handed Hunting bow stands for the
    // ranger's kit Longbow, carried and never equipped, beside a hand axe in hand and a spare one.
    const doc = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
    );
    doc.items.drawOnUse = { categories: ["weapon"] };
    const definition = parsed(doc);
    const entries = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    ) as Record<string, RulesetCatalogEntry[]>;
    const book = rulesetItemBook(definition, entries, { actor: "player" });
    const stacks = [
      { id: "bow", name: "Hunting bow", item: "outfitter/hunting-bow", quantity: 1 },
      { id: "arrows", name: "Arrows", item: "outfitter/arrows", quantity: 20 },
      { id: "axe", name: "Hand axe", item: "outfitter/hand-axe", quantity: 1, equipped: true },
      { id: "axe2", name: "Hand axe", item: "outfitter/hand-axe", quantity: 1 },
    ] as GameInventoryStack[];
    const items = rulesetSheetItems(book, stacks, undefined);
    assert.equal(items.find((one) => one.name === "Hunting bow")?.drawOnUse, true);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      bestiary: {},
      combatants: [
        { id: "rae", name: "Rae", side: "party", build: defaultRulesetSheetBuild(definition), live: {}, items },
        {
          id: "g",
          name: "G",
          side: "enemy",
          block: { health: 7, defense: 1, initiativeModifier: 0, speed: 6, saves: {}, actions: [] } as never,
        },
      ],
    });
    state.order = ["rae", "g"];
    state.turn = 0;
    const attacks = rulesetCombatOptions(definition, state, "rae")
      .filter((one) => one.kind === "attack")
      .map((one) => one.label);
    assert.ok(attacks.includes("Hunting bow"), JSON.stringify(attacks));
    assert.ok(attacks.includes("Hand axe"), JSON.stringify(attacks));
  }

  console.log(
    "Cheap-GM 29-33: rest dice fill the sheet and heal it once, colonless thoughts show as thoughts, Metamagic only where it is of use, the reward line stays off the card, the kit Longbow is an attack.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
