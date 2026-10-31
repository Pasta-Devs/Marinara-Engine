/**
 * Three findings of a level 4 party's laptop playtest on the 5e rules (2026-10-26).
 *
 *   - Coins the Game Master gives an opponent in a purse ("Pouch, gold pieces", "a pouch of 30 gold",
 *     "12 gp") are that many of the ruleset's coin, read off its own currencies: a count where the line
 *     gives one, else the ruleset's usual purse of that coin (its loot tables' line for it), else 2d6.
 *     A purse alone ("Pouch") is passed over without a word; anything else that is no item is told.
 *   - A rest of one kind taken again in the reply that took it or the next, or with no time passed on
 *     the game's clock since, is refused (`rested-already`), and gives nothing back.
 *   - What only meant something inside a fight (Bless's Blessed, on a clock) is not listed on the party
 *     once it is over, and comes off the sheet however the fight ended: a surrender too.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySheetCommandTags,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetEncounterSummary,
  rulesetItemBook,
  rulesetLiveStateSchema,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetLiveStates,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-l4-findings-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const english = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, string>;

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const parsed = (document: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(document);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};

try {
  // ── Coins in a purse ──
  {
    const emberText = read("../../docs/examples/rulesets/ember-roads.json");
    // Ember Roads with a second family of coins named as 5e names them.
    const ember = (edit: (doc: Record<string, any>) => void = () => {}) => {
      const doc = JSON.parse(emberText) as Record<string, any>;
      doc.items.currencies.push({
        id: "pieces",
        label: "Pieces",
        units: [
          { id: "cp", label: "copper pieces", one: "copper piece", value: 1 },
          { id: "sp", label: "silver pieces", one: "silver piece", value: 10 },
          { id: "gp", label: "gold pieces", one: "gold piece", value: 100 },
        ],
      });
      edit(doc);
      return doc;
    };
    const begin = (definition: RulesetDefinition, items: string[], seed = 4) => {
      const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
        (definition.catalogs ?? []).flatMap((catalog) =>
          catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
        ),
      );
      const book = rulesetItemBook(definition, entries);
      const bestiaryId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
      const built = createRulesetFight({
        definition,
        seed,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "thief", name: "thief", creature: `${bestiaryId}/rust-jackal`, items }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
        playerName: null,
        live: {},
        items: () => [],
        itemBook: book,
        partyCatalogs: {},
        bestiary: { [bestiaryId]: entries[bestiaryId]! },
      } as never);
      assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
      const fight = (built as { fight: any }).fight;
      const purse = (fight.purses?.thief ?? []) as Array<{ ref: string; name: string; count: number }>;
      return {
        fight,
        coins: Object.fromEntries(purse.map((coin) => [coin.name, coin.count])),
        told: (fight.adjustments as string[]).filter((line) => /no item called/.test(line)),
      };
    };
    const definition = parsed(ember());

    // Counted, however the line says it: before or after, joined to its id, in a purse.
    for (const [line, coins] of [
      ["12 gp", { "gold pieces": 12 }],
      ["12gp", { "gold pieces": 12 }],
      ["a pouch of 30 gold", { "gold pieces": 30 }],
      ["Pouch with 7 silver pieces", { "silver pieces": 7 }],
      ["gold pieces x5", { "gold pieces": 5 }],
      ["a gold piece", { "gold pieces": 1 }],
      ["one copper coin", { "copper pieces": 1 }],
      ["9 marks", { marks: 9 }],
    ] as const) {
      const given = begin(definition, [line]);
      assert.deepEqual(given.coins, coins, `${line}: ${JSON.stringify(given.fight.purses)}`);
      assert.deepEqual(given.told, [], `${line} is no refusal`);
    }

    // With no count: 2d6 of it, by the fight's own dice, the same for the same fight.
    const uncounted = begin(definition, ["Pouch, gold pieces"]);
    const gold = uncounted.coins["gold pieces"]!;
    assert.ok(gold >= 2 && gold <= 12, `2d6 gold pieces: ${gold}`);
    assert.deepEqual(uncounted.told, []);
    assert.equal(
      begin(definition, ["Pouch, gold pieces"]).coins["gold pieces"],
      gold,
      "the same fight, the same purse",
    );
    assert.equal(begin(definition, ["gold pieces"]).coins["gold pieces"], gold, "a bare coin is a purse of it too");
    // The ruleset's usual purse of that coin, where its loot tables drop one.
    const purses = parsed(
      ember((doc) => {
        doc.items.lootTables = [
          {
            id: "pockets",
            label: "Pockets",
            entries: [
              { coins: "gp", count: "10d6" },
              { coins: "sp", count: 3 },
            ],
          },
        ];
      }),
    );
    const usual = begin(purses, ["Pouch, gold pieces", "a purse of silver"]).coins;
    assert.ok(usual["gold pieces"]! >= 10 && usual["gold pieces"]! <= 60, `10d6 gold: ${usual["gold pieces"]}`);
    assert.equal(usual["silver pieces"], 3);

    // A purse alone is nothing to give, and nothing to tell.
    for (const line of ["Pouch", "a small leather pouch", "Coin purse"]) {
      const empty = begin(definition, [line]);
      assert.deepEqual(empty.coins, {}, line);
      assert.deepEqual(empty.told, [], `${line} is passed over`);
      assert.equal(rulesetCombatant(empty.fight.encounter, "thief")!.carried, undefined);
    }
    // Anything else the ruleset has no item of is told, as before: a gold ring is no gold.
    for (const line of ["Gold ring", "Bag of Holding", "10 gold and 5 silver bars"]) {
      const odd = begin(definition, [line]);
      assert.deepEqual(odd.coins, {}, line);
      assert.equal(odd.told.length, 1, `${line} is told: ${odd.fight.adjustments.join(" | ")}`);
    }
    // And an item it has is still that item, beside a purse.
    const both = begin(definition, ["Poultice", "Pouch, 4 marks"]);
    assert.deepEqual(both.coins, { marks: 4 });
    assert.deepEqual(rulesetCombatant(both.fight.encounter, "thief")!.carried, [
      { ref: "outfitter/poultice", name: "Poultice", count: 1 },
    ]);
    // Ruleset-neutral: Ember Roads alone has no gold at all.
    const plain = parsed(JSON.parse(emberText));
    assert.equal(begin(plain, ["Pouch, gold pieces"]).told.length, 1, "no coin of that name, so it is told");
  }

  // ── A rest taken twice ──
  {
    const definition = parsed(JSON.parse(read("../../docs/development/ruleset-5e-2014.example.json")));
    const cleric = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
      fields: { level: 4, hp_max: 30, spellcasting_ability: "wis", slots_max_1: 4, slots_max_2: 3 },
    });
    const bran = normalizeCharacterLookupName("Bran");
    const hurt = { pools: { hp: { value: 10 }, slots_1: { value: 1 } } };
    const turn = (content: string, live: RulesetLiveStates, clock?: number) =>
      applySheetCommandTags(content, {
        definition,
        cards: [{ name: "Bran", build: cleric }],
        playerName: "Bran",
        live,
        ...(clock !== undefined ? { clock } : {}),
      });
    const hp = (live: RulesetLiveStates) =>
      readRulesetLive(definition, cleric, live[bran]).pools.find((pool) => pool.key === "hp")!.value;
    const long = `They sleep. [sheet: who="party" op="rest" rest="Long rest"]`;

    const first = turn(long, { [bran]: hurt as never }, 1260);
    assert.equal(first.outcomes[0]!.ok, true, JSON.stringify(first.outcomes));
    assert.equal(hp(first.live), 30);
    assert.deepEqual(first.live[bran]!.rested, { long: { at: 1260, fresh: true } });
    assert.ok(rulesetLiveStateSchema.safeParse(first.live[bran]).success, "stored as it is");
    assert.deepEqual(first.rests, [{ who: "Bran", rest: "Long rest" }]);

    // The next reply, the story's clock moved on to the morning the rest ended in: refused all the same.
    const hurtAgain = { ...first.live, [bran]: { ...first.live[bran]!, pools: hurt.pools } };
    const again = turn(`They wake. [sheet: who="Bran" op="rest" rest="long"]`, hurtAgain, 1260 + 660);
    assert.equal(again.outcomes[0]!.ok, false);
    assert.equal(again.outcomes[0]!.reason, "rested-already");
    assert.match(again.content, /result="refused"[^\]]*reason="rested-already"/);
    assert.equal(hp(again.live), 10, "and gives nothing back");
    assert.deepEqual(again.rests, []);
    assert.deepEqual(again.live[bran]!.rested, { long: { at: 1260 } }, "no longer the reply before's");
    // Twice in one reply: the second refused, and a short rest is another kind.
    const doubled = turn(`${long} ${long} [sheet: who="Bran" op="rest" rest="Short rest"]`, { [bran]: hurt as never });
    assert.deepEqual(
      doubled.outcomes.map((outcome) => outcome.reason ?? "ok"),
      ["ok", "rested-already", "ok"],
    );

    // Later: refused while the clock has not moved since, taken once it has.
    const later = turn("They talk.", again.live, 1920);
    assert.equal(
      turn(long, { ...later.live, [bran]: { ...later.live[bran]!, rested: { long: { at: 1920 } } } }, 1920).outcomes[0]!
        .reason,
      "rested-already",
      "no time passed since",
    );
    const next = turn(long, later.live, 1920);
    assert.equal(next.outcomes[0]!.ok, true, "a reply between and time passed since");
    assert.deepEqual(next.live[bran]!.rested, { long: { at: 1920, fresh: true } });
    // A game with no clock: the reply that took it and the next only.
    const unclocked = turn(long, { [bran]: hurt as never });
    assert.deepEqual(unclocked.live[bran]!.rested, { long: { fresh: true } });
    assert.equal(turn(long, unclocked.live).outcomes[0]!.reason, "rested-already");
    assert.equal(turn(long, turn("They walk on.", unclocked.live).live).outcomes[0]!.ok, true);

    // A rest the ruleset says is taken only so often (1.810): 5e's long rest, once in 24 hours from the
    // start of the last, whatever the clock did in between.
    const daily = parsed(
      (() => {
        const doc = JSON.parse(read("../../docs/development/ruleset-5e-2014.example.json"));
        doc.rests.find((rest: { id: string }) => rest.id === "long").every = 24;
        return doc;
      })(),
    );
    const dailyTurn = (live: RulesetLiveStates, clock: number) =>
      applySheetCommandTags(long, {
        definition: daily,
        cards: [{ name: "Bran", build: cleric }],
        playerName: "Bran",
        live,
        clock,
      });
    const slept = { [bran]: { ...(hurt as object), rested: { long: { at: 1260 } } } as never };
    assert.equal(dailyTurn(slept, 1260 + 9 * 60).outcomes[0]!.reason, "rested-already", "the next morning");
    assert.equal(dailyTurn(slept, 1260 + 24 * 60).outcomes[0]!.ok, true, "a day on");

    // The player is told in plain words.
    const sheetView = read("../../packages/client/src/components/game/GameRulesetSheet.tsx");
    assert.match(sheetView, /"rested-already": "game\.ruleset\.sheet\.refusal\.restedAlready"/);
    assert.ok(english["game.ruleset.sheet.refusal.restedAlready"]);
  }

  // ── Blessed past the fight ──
  {
    const definition = parsed(JSON.parse(read("../../docs/examples/rulesets/ember-roads.json")));
    const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const bestiaryId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 20,
      maxHp: 20,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
    });
    const begin = () => {
      const built = createRulesetFight({
        definition,
        seed: 4,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "jackal", name: "jackal", creature: `${bestiaryId}/rust-jackal` }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
        playerName: null,
        live: {},
        items: () => [],
        partyCatalogs: {},
        bestiary: { [bestiaryId]: entries[bestiaryId]! },
      } as never) as { ok: true; fight: any };
      assert.ok(built.ok);
      const fight = built.fight;
      // Shaken on a clock, as a fight's spell puts it (Bless's Blessed), and Held with none.
      const ada = rulesetCombatant(fight.encounter, "ada")!;
      ada.tracked.push({ condition: "shaken", rounds: 3 }, { condition: "held", rounds: null });
      ada.sheet!.live = { ...ada.sheet!.live, conditions: ["shaken", "held"] };
      return fight;
    };
    const fight = begin();
    assert.deepEqual(
      rulesetEncounterSummary(definition, fight.encounter).party[0]!.conditions,
      ["held"],
      "what ends with the fight is not listed past it",
    );

    // Given up: the fight is over, and what it put on comes off the sheet too.
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "player")],
      enemies: [unit("jackal", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 4,
    } as never);
    state.rulesetFight = begin();
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    state.enemies[0]!.tactics = { ...state.enemies[0]!.tactics!, adjective: "honourable" };
    const yielded = commandRulesetCombatDirector(definition, state, { type: "yield" });
    assert.ok(yielded.ok, JSON.stringify(yielded));
    assert.equal(state.outcome, "defeat");
    const ada = rulesetCombatant(state.rulesetFight!.encounter, "ada")!;
    assert.deepEqual(
      ada.tracked.map((entry) => entry.condition),
      ["held"],
    );
    assert.deepEqual(ada.sheet!.live.conditions, ["held"], "off the sheet the fight writes back");
  }

  console.log("game-l4-findings regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
