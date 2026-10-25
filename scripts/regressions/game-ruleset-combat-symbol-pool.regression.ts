/**
 * Ruleset combat: the `symbol-pool` kind (Capability API 1.382), a fight thrown in the ruleset's own
 * symbol dice.
 *
 * What is pinned here, on Ember Roads with the guide's own narrative dice, with scripted faces:
 *   - The principle: a to-hit number is the attacker's dice, the larger of ability and skill ranks
 *     with the smaller upgraded; a defense is the difficulty dice thrown against them; a condition's
 *     flat number is boost or setback dice.
 *   - Net successes land the blow and add to its harm, and the target soaks a number off it.
 *   - What is left over is spent by the side that spends that symbol, the most worth for what it has:
 *     extra harm, a boost for the next ally, a critical with a condition, a track and setback dice on
 *     the attacker, and nothing bought for an ally nobody is.
 *   - Boost and setback dice a spend left wait on the next roll their holder makes, and that roll
 *     uses them up.
 *   - Initiative thrown as a pool of symbol dice.
 *   - The forecast: the hit chance exact against every face, and the AI's worth.
 *   - Every import refusal, the 1.382 install gate and the log lines.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  pickRulesetSymbolSpends,
  rollSymbolPoolCheck,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetSymbolChance,
  rulesetSymbolAttackForecast,
  rulesetSymbolDice,
  rulesetSymbolSpendBudget,
  rulesetSymbolOutcomes,
  rulesetWindowOptions,
  RULESET_ENGINE_SPENDS_OPTION,
  RULESET_PASS_OPTION,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-symbol-fight-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [{ getCapabilityPackageInstallIssue }, { rulesetCombatEventLine, rulesetCombatNames }] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
  ]);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const ember = JSON.parse(read("../../docs/examples/rulesets/ember-roads.json"));
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;
  const guide = read("../../docs/extending/writing-rulesets.md").split("#### `symbol-pool`")[1]!;
  const example = JSON.parse(`{${guide.split("```json\n")[1]!.split("```")[0]}}`).resolution;

  /** Ember Roads thrown in the guide's narrative dice: an attack row reads a skill as well as the
   *  ability it swings with, a Guard is two difficulty dice, initiative is Wits thrown, Brawn soaks,
   *  and the spends cover every effect a spend may have. */
  const doc = (edit: (document: Record<string, any>) => void = () => {}) => {
    const document = structuredClone(ember);
    delete document.layers;
    document.resolution = { ...structuredClone(example), proficiencyTiers: ember.resolution.proficiencyTiers };
    const combat = document.combat;
    combat.kind = "symbol-pool";
    delete combat.attackRoll;
    combat.defense = { const: 2 };
    combat.initiative = { pool: { abilityMod: "wits" } };
    document.sheet.lists
      .find((list: { id: string }) => list.id === "gear")
      .columns.push({ id: "skill", label: "Skill", type: "enum", values: ["scrap", "sneak"] });
    combat.attacks[0].toHit.skill = { column: "skill" };
    combat.symbols = {
      soak: { all: { abilityMod: "brawn" } },
      spends: [
        { id: "cut", label: "Cut deeper", by: "attacker", symbol: "a", cost: 2, when: "hit", max: 2, damage: 1 },
        { id: "rally", label: "Rally", by: "attacker", symbol: "a", cost: 1, boost: { dice: 1, on: "attacker-ally" } },
        {
          id: "telling",
          label: "Telling blow",
          by: "attacker",
          symbol: "t",
          cost: 1,
          when: "hit",
          critical: true,
          condition: { id: "wounded", on: "target", rounds: 2 },
        },
        {
          id: "overreach",
          label: "Overreach",
          by: "target",
          symbol: "h",
          cost: 2,
          track: { id: "heat", by: 1, on: "attacker" },
        },
        { id: "slip", label: "Slip", by: "target", symbol: "h", cost: 1, setback: { dice: 1, on: "attacker" } },
        {
          id: "balance",
          label: "Off balance",
          by: "target",
          symbol: "d",
          cost: 1,
          condition: { id: "shaken", on: "attacker" },
        },
      ],
    };
    document.catalogs
      .find((catalog: { id: string }) => catalog.id === "road_trouble")
      .entries.push({
        id: "brute",
        label: "Brute",
        summary: "Big, slow and hard to hurt.",
        creature: {
          health: 12,
          defense: 2,
          initiativeModifier: 1,
          speed: 8,
          abilities: { brawn: 2, wits: 0, heart: 0 },
          tier: "stray",
          soak: { all: 1 },
          actions: [
            {
              id: "club",
              name: "Club",
              budget: "act",
              toHit: 2,
              upgrades: 1,
              damage: { dice: "1d4", type: "crush" },
              reach: 2,
            },
          ],
        },
      });
    edit(document);
    return document;
  };
  const parsedOrThrow = (document: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `the symbol fight must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refuses = (edit: (document: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const parsed = parseRulesetDefinition(doc(edit));
    assert.ok(!parsed.ok, `${why}: it should have been refused`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };
  const definition = parsedOrThrow(doc());

  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      const face = faces[index++]!;
      assert.ok(face >= 1 && face <= sides, `face ${face} on a d${sides}`);
      return face;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T> => {
    const found = eventsOf(events, type)[0];
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };
  const catalogs = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  /** Ada: Brawn 3 and Scrap at expert (two ranks), so her Cleaver throws three dice, two upgraded.
   *  Bo: Brawn 1 and no ranks, one plain die. */
  const traveller = (id: string, brawn: number, wits: number, scrap?: string): RulesetCombatantInput =>
    ({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      side: "party",
      build: rulesetSheetBuildSchema.parse({
        abilities: { brawn, wits, heart: 1 },
        skills: scrap ? { scrap } : {},
        lists: { gear: [{ name: "Cleaver", swing: "brawn", skill: "scrap", damage: "1d6", harm: "cut" }] },
      }),
      live: {},
      catalogs,
    }) as RulesetCombatantInput;
  const brute: RulesetCombatantInput = {
    id: "brute",
    name: "Brute",
    side: "enemy",
    creature: { catalogId: "road_trouble", entryId: "brute" },
  };
  const swing = (state: RulesetEncounterState, actorId: string, targetId: string, ...faces: number[]) => {
    const option = rulesetCombatOptions(definition, state, actorId).find(
      (entry) => entry.label === "Cleaver" || entry.label === "Club",
    );
    assert.ok(option, `${actorId} has nothing to swing`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [targetId] },
      dice(...faces),
    );
  };
  const endTurn = (state: RulesetEncounterState, actorId: string) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, dice()).state;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;

  // ── Refused at import ──
  {
    refuses(
      (document) => (document.combat.kind = "attack-vs-defense"),
      /A symbol-pool ruleset fights as a "symbol-pool" fight/,
      "a symbol ruleset fighting with summed dice",
    );
    refuses(
      (document) => (document.resolution = ember.resolution),
      /resolution.kind is "symbol-pool" too/,
      "a symbol fight on a summed ruleset",
    );
    refuses(
      (document) => (document.combat.attackRoll = { dice: { count: 2, sides: 6 } }),
      /throws symbol dice, so it rolls no attack dice/,
      "attack dice in a symbol fight",
    );
    refuses((document) => delete document.combat.symbols, /says what its symbols do in "symbols"/, "no symbols block");
    refuses(
      (document) => (document.combat.symbols.spends[2].max = 2),
      /A condition or a critical lands once/,
      "a condition or critical bought twice in one throw",
    );
    refuses(
      (document) =>
        document.combat.symbols.spends.push({
          id: "again",
          label: "Again",
          by: "attacker",
          symbol: "a",
          cost: 3,
          condition: { id: "wounded", on: "target" },
        }),
      /already puts that condition, or one of its kind, on the same one/,
      "two spends putting one condition on one holder",
    );
    // A hit's spend and a miss's are never bought on one throw, so they may both name it.
    parsedOrThrow(
      doc((document) => {
        document.combat.symbols.spends.push({
          id: "graze",
          label: "Graze",
          by: "attacker",
          symbol: "a",
          cost: 3,
          when: "miss",
          condition: { id: "wounded", on: "target" },
        });
      }),
    );
    refuses(
      (document) => (document.resolution.pool.build = "sum"),
      /has no upgraded dice to throw/,
      "a creature's upgraded dice on a pool that has none",
    );
    refuses(
      (document) => (document.combat.symbols.spends[0].symbol = "s"),
      /Successes land the hit and add its harm/,
      "a spend that buys with successes",
    );
    refuses(
      (document) => (document.combat.symbols.spends[0].symbol = "x"),
      /Unknown symbol "x"/,
      "a spend that buys with no symbol",
    );
    refuses(
      (document) => (document.combat.symbols.spends[0].when = "any"),
      /Harm and a critical land with a hit/,
      "harm bought on a miss",
    );
    refuses(
      (document) => (document.combat.symbols.spends[0].by = "target"),
      /Harm and a critical are the attacker's to add/,
      "harm bought by the target",
    );
    refuses(
      (document) => (document.combat.symbols.spends[4].by = "attacker"),
      /"h" is spent by the target too; one side spends a symbol/,
      "one symbol spent by both sides",
    );
    refuses(
      (document) => (document.combat.symbols.spends[2].condition.id = "dazzled"),
      /Unknown condition "dazzled"/,
      "a spend's unknown condition",
    );
    refuses(
      (document) => (document.combat.symbols.spends[3].track = { id: "strain", by: 1, on: "attacker" }),
      /the track it moves is a plain one/,
      "a spend that moves the wound track",
    );
    refuses(
      (document) => (document.combat.symbols.spends[3].track.by = 0),
      /moves by something/,
      "a track moved by nothing",
    );
    refuses(
      (document) =>
        (document.combat.symbols.spends[1] = { id: "rally", label: "Rally", by: "attacker", symbol: "a", cost: 1 }),
      /A spend buys something/,
      "a spend of nothing",
    );
    refuses((document) => delete document.resolution.boost, /has no boost dice/, "a boost spend with no boost dice");
    refuses((document) => (document.combat.symbols.soak = {}), /Soak soaks something/, "soak of nothing");
    refuses(
      (document) => delete document.combat.symbols.soak,
      /"symbols" says nothing about soak/,
      "a creature's soak with no soak rule",
    );
    refuses(
      (document) => (document.catalogs.at(-2).entries.at(-1).creature.actions[0].upgrades = 3),
      /Only its 2 toHit dice can be upgraded/,
      "more upgrades than dice",
    );
    refuses(
      (document) => (document.combat.conditions[1].modifiers = [{ to: "attacks", dice: "1d4" }]),
      /A "symbol-pool" fight adds dice to a pool, so a modifier gives a flat number of dice/,
      "a rolled modifier in a symbol fight",
    );
    // A creature's upgraded dice and the symbols block are a symbol fight's alone.
    const summed = parseRulesetDefinition(
      (() => {
        const document = structuredClone(ember);
        document.combat.symbols = { spends: [] };
        document.catalogs[1].entries[0].creature.actions[0].upgrades = 1;
        return document;
      })(),
    );
    assert.ok(!summed.ok);
    assert.ok(summed.issues.some((issue) => /"symbols" is for a "symbol-pool" fight/.test(issue)));
    assert.ok(summed.issues.some((issue) => /Upgraded dice are for a "symbol-pool" fight/.test(issue)));
  }

  // ── A sheet's to-hit, a creature's, soak, and initiative thrown in symbol dice ──
  // Ada's two Wits dice show two successes each, Bo's one shows one and the Brute's blank.
  const opened = createRulesetEncounter({
    definition,
    seed: 1,
    combatants: [traveller("ada", 3, 2, "expert"), traveller("bo", 1, 1), brute],
    bestiary: catalogs,
    roller: dice(4, 4, 2, 1),
  });
  assert.deepEqual(opened.order, ["ada", "bo", "brute"]);
  assert.equal(rulesetCombatant(opened, "ada")!.initiative, 4);
  const ada = rulesetCombatant(opened, "ada")!;
  const cleaver = ada.actions.find((action) => action.label === "Cleaver")!;
  assert.equal(cleaver.toHit, 3, "Brawn 3 is the larger of the two");
  assert.equal(cleaver.upgrades, 2, "two ranks of Scrap upgrade two of them");
  assert.deepEqual(ada.soak, { all: 3 }, "soak read off her Brawn");
  const bo = rulesetCombatant(opened, "bo")!;
  assert.equal(bo.actions.find((action) => action.label === "Cleaver")!.upgrades, 0);
  const club = rulesetCombatant(opened, "brute")!.actions.find((action) => action.label === "Club")!;
  assert.deepEqual([club.toHit, club.upgrades], [2, 1]);
  assert.deepEqual(rulesetCombatant(opened, "brute")!.soak, { all: 1 });

  // ── The forecast: exact against every face ──
  {
    const option = rulesetCombatOptions(definition, opened, "ada").find((entry) => entry.label === "Cleaver")!;
    const thrown = rulesetSymbolDice(definition, { dice: 3, upgrades: 2, difficulty: 2 });
    let hits = 0;
    let all = 0;
    for (let a = 1; a <= 12; a++)
      for (let b = 1; b <= 12; b++)
        for (let c = 1; c <= 8; c++)
          for (let d = 1; d <= 8; d++)
            for (let e = 1; e <= 8; e++) {
              const faces = [a, b, c, d, e];
              const result = rollSymbolPoolCheck(
                definition,
                { ability: 3, rank: 2, difficulty: 2, isSave: false },
                () => faces.shift()!,
              );
              all += 1;
              if (result.success) hits += 1;
            }
    assert.ok(Math.abs(rulesetSymbolChance(definition, thrown) - hits / all) < 1e-9, "the spread is exact");
    assert.equal(option.forecast?.hitChance, Math.round((hits / all) * 1000) / 1000);
    const total = rulesetSymbolOutcomes(definition, thrown).reduce((sum, outcome) => sum + outcome.chance, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
    // A hit's harm: 1d6 and Brawn, each net success, and Cut deeper, less the Brute's one soaked.
    assert.ok(option.forecast!.averageDamage! > 3.5 + 3 + 1 - 1, `averageDamage ${option.forecast?.averageDamage}`);
    // What the AI weighs it at counts what the spends buy as well.
    assert.ok(option.forecast!.worth !== undefined && option.forecast!.worth > 0);
    // The Brute has no ally for Rally's boost, so the fight leaves Rally unbought, and its forecast
    // prices it the same way: as nothing.
    const brutesTurn = { ...opened, turn: opened.order.indexOf("brute") };
    const clubbing = rulesetCombatOptions(definition, brutesTurn, "brute").find((entry) => entry.label === "Club")!;
    const clubDice = rulesetSymbolDice(definition, { dice: 2, upgrades: 1, difficulty: 2 });
    const priced = (copies?: (spend: { max: number; boost?: { on: string } }) => number) =>
      rulesetSymbolAttackForecast(
        definition,
        definition.combat!,
        clubDice,
        2.5,
        3,
        copies ? () => ({ copies, take: () => {} }) : undefined,
      ).worth;
    const withoutRally = priced((spend) => (spend.boost?.on === "attacker-ally" ? 0 : spend.max));
    assert.ok(priced() > withoutRally, "Rally would be worth something to a Brute with an ally");
    assert.equal(
      clubbing.forecast?.worth,
      Math.round(withoutRally * 100) / 100,
      "a spend nobody can take is priced at nothing",
    );
  }

  // ── A contest: each side throws its own dice, and the more net successes wins ──
  {
    const grab = rulesetCombatOptions(definition, opened, "ada").find((entry) => entry.label === "Grab")!;
    // Three Brawn dice against a Brute with no check of its own: anything but no success wins.
    assert.equal(grab.forecast?.hitChance, 0.875);
    const grabbed = applyRulesetCombatChoice(
      definition,
      opened,
      { actorId: "ada", optionId: grab.id, targetIds: ["brute"] },
      dice(4, 1, 5),
    );
    const contest = firstOf(grabbed.events, "contest");
    assert.equal(contest.winner, "actor");
    assert.equal(contest.attacker.total, 2);
    assert.deepEqual(contest.attacker.pool?.symbols, { s: 2, a: 1 });
    assert.equal(contest.defender.total, 0);
  }

  // ── The spend picker: the most worth for the symbols there are ──
  {
    const combat = definition.combat!;
    const ids = (picks: ReturnType<typeof pickRulesetSymbolSpends>) => picks.map((pick) => [pick.spend.id, pick.times]);
    assert.deepEqual(ids(pickRulesetSymbolSpends(combat, { s: 1, a: 3 }, true, "attacker")), [
      ["cut", 1],
      ["rally", 1],
    ]);
    assert.deepEqual(ids(pickRulesetSymbolSpends(combat, { s: 1, a: 4 }, true, "attacker")), [["cut", 2]]);
    assert.deepEqual(
      ids(pickRulesetSymbolSpends(combat, { a: 3 }, false, "attacker")),
      [["rally", 1]],
      "no harm on a miss",
    );
    assert.deepEqual(
      ids(
        pickRulesetSymbolSpends(combat, { a: 3 }, true, "attacker", {
          copies: (spend) => (spend.id === "rally" ? 0 : spend.max),
          take: () => {},
        }),
      ),
      [["cut", 1]],
      "an ally nobody is buys nothing",
    );
    assert.deepEqual(ids(pickRulesetSymbolSpends(combat, { h: 3, d: 1 }, false, "target")), [
      ["overreach", 1],
      ["slip", 1],
      ["balance", 1],
    ]);
    assert.deepEqual(ids(pickRulesetSymbolSpends(combat, { h: 3 }, false, "attacker")), [], "threat is the target's");
  }

  // ── Ada's hit: two successes, three advantage and a threat ──
  // Proficiency ss and aa, ability aa, difficulty blank and h, then the Cleaver's d6.
  const first = swing(opened, "ada", "brute", 4, 10, 8, 1, 4, 4);
  {
    const attack = firstOf(first.events, "attack");
    assert.equal(attack.outcome, "hit");
    assert.equal(attack.total, 2);
    assert.deepEqual(attack.pool, { dice: 3, target: 0, symbols: { s: 2, a: 3 }, upgrades: 2, difficulty: 2 });
    const spends = eventsOf(first.events, "symbol-spend");
    assert.deepEqual(
      spends.map((spend) => [spend.spendId, spend.times, spend.onId ?? null, spend.boost ?? null]),
      [
        ["cut", 1, null, null],
        ["rally", 1, "bo", 1],
      ],
    );
    // 4 on the d6, Brawn 3, two successes and Cut deeper, less one soaked.
    assert.equal(firstOf(first.events, "damage").amount, 9);
    assert.equal(health(first.state, "brute"), 3);
    assert.deepEqual(rulesetCombatant(first.state, "bo")!.symbolDice, { boost: 1 });
  }

  // ── Bo's swing uses the boost he was left ──
  const boTurn = endTurn(first.state, "ada");
  const second = swing(boTurn, "bo", "brute", 2, 6, 1, 1, 1);
  {
    const attack = firstOf(second.events, "attack");
    assert.deepEqual(attack.pool, { dice: 1, target: 0, symbols: { s: 1, a: 1 }, difficulty: 2, boost: 1 });
    assert.equal(rulesetCombatant(second.state, "bo")!.symbolDice, undefined, "the roll used it up");
    // One advantage: Rally for the next of his side, Ada.
    assert.equal(firstOf(second.events, "symbol-spend").onId, "ada");
    // 1 on the d6, Brawn 1 and one success, less one soaked.
    assert.equal(firstOf(second.events, "damage").amount, 2);
    assert.equal(health(second.state, "brute"), 1);
  }

  // ── The Brute misses, and its threat is Ada's to spend ──
  const bruteTurn = endTurn(second.state, "bo");
  // Proficiency s, ability blank, difficulty hh and fh: nothing net, three threat.
  const third = swing(bruteTurn, "brute", "ada", 2, 1, 7, 8);
  {
    assert.equal(firstOf(third.events, "attack").outcome, "miss");
    const spends = eventsOf(third.events, "symbol-spend");
    assert.deepEqual(
      spends.map((spend) => [spend.actorId, spend.spendId, spend.onId ?? null]),
      [
        ["ada", "overreach", null],
        ["ada", "slip", "brute"],
      ],
    );
    const struck = rulesetCombatant(third.state, "brute")!;
    assert.deepEqual(struck.symbolDice, { setback: 1 });
    assert.equal(struck.tracks?.heat, 1, "Overreach put heat on the Brute");
    assert.equal(eventsOf(third.events, "damage").length, 0);
  }

  // ── A triumph: a critical, and a condition, through Ada's boost ──
  const adaAgain = endTurn(third.state, "brute");
  // Proficiency t and blank, ability blank, the boost blank, difficulty blank twice, then the d6.
  const fourth = swing(adaAgain, "ada", "brute", 12, 1, 1, 1, 1, 1, 6);
  {
    const attack = firstOf(fourth.events, "attack");
    assert.deepEqual(attack.pool?.symbols, { s: 1, t: 1 });
    assert.equal(attack.pool?.boost, 1);
    const spend = firstOf(fourth.events, "symbol-spend");
    assert.equal(spend.spendId, "telling");
    assert.equal(spend.critical, true);
    const damage = firstOf(fourth.events, "damage");
    assert.equal(damage.critical, true, "the blow is a critical one");
    assert.ok(rulesetCombatant(fourth.state, "brute")!.defeated);
  }

  // ── A condition that would not go on is not bought ──
  {
    // Wounded is one of a kind; a Brute already wounded can't take a second, so Telling blow (its
    // critical with it) stays on the roll rather than charging the triumph for nothing.
    const kinded = parsedOrThrow(
      doc((document) => {
        document.combat.conditions.find((one: { condition: string }) => one.condition === "wounded").oneAtATime =
          "hurt";
      }),
    );
    const already = structuredClone(adaAgain);
    rulesetCombatant(already, "brute")!.tracked.push({ condition: "wounded" } as never);
    const ada = rulesetCombatant(already, "ada")!;
    const brute = rulesetCombatant(already, "brute")!;
    const budget = rulesetSymbolSpendBudget(kinded, already, ada, brute);
    const telling = kinded.combat!.symbols!.spends!.find((spend) => spend.id === "telling")!;
    assert.equal(budget.copies(telling), 0, "a second wound of the kind would not go on");
    const fresh = (id: string) => rulesetCombatant(adaAgain, id)!;
    const clean = rulesetSymbolSpendBudget(kinded, adaAgain, fresh("ada"), fresh("brute"));
    assert.equal(clean.copies(telling), 1);
    clean.take(telling, 1);
    assert.equal(clean.copies(telling), 0, "one throw puts it on once");
    // A track moves only as far as it has room, and what one spend takes another can't: Overreach is
    // not bought on a Brute whose heat is full, and once one step is bought at 4 of 5 none is left.
    const overreach = kinded.combat!.symbols!.spends!.find((spend) => spend.id === "overreach")!;
    const hot = structuredClone(adaAgain);
    const heated = (heat: number) => {
      rulesetCombatant(hot, "brute")!.tracks = { heat };
      return rulesetSymbolSpendBudget(kinded, hot, rulesetCombatant(hot, "brute")!, rulesetCombatant(hot, "ada")!);
    };
    assert.equal(heated(5).copies(overreach), 0, "heat is full");
    const room = heated(4);
    assert.equal(room.copies(overreach), 1);
    room.take(overreach, 1);
    assert.equal(room.copies(overreach), 0, "the step is taken");
    assert.deepEqual(
      pickRulesetSymbolSpends(kinded.combat!, { h: 2 }, false, "target", heated(5)).map((pick) => pick.spend.id),
      ["slip"],
    );
    assert.deepEqual(pickRulesetSymbolSpends(kinded.combat!, { t: 1 }, true, "attacker", budget), []);
    // Two spends reaching for one step of heat: the worthier gets it whatever the order they are
    // listed in, and the symbols the other would have used buy the best of what still lands.
    const contended = parsedOrThrow(
      doc((document) => {
        const spends = document.combat.symbols.spends;
        spends.find((spend: { id: string }) => spend.id === "overreach").worth = 2.5;
        spends.push({
          id: "scorch",
          label: "Scorch",
          by: "target",
          symbol: "h",
          cost: 1,
          track: { id: "heat", by: 1, on: "attacker" },
          worth: 3,
        });
      }),
    );
    rulesetCombatant(hot, "brute")!.tracks = { heat: 4 };
    const oneStep = () =>
      rulesetSymbolSpendBudget(contended, hot, rulesetCombatant(hot, "brute")!, rulesetCombatant(hot, "ada")!);
    assert.deepEqual(
      pickRulesetSymbolSpends(contended.combat!, { h: 3 }, false, "target", oneStep()).map((pick) => [
        pick.spend.id,
        pick.times,
      ]),
      [
        ["slip", 1],
        ["scorch", 1],
      ],
    );
    const cleaver = rulesetCombatOptions(kinded, already, "ada").find((entry) => entry.label === "Cleaver")!;
    const declined = applyRulesetCombatChoice(
      kinded,
      already,
      { actorId: "ada", optionId: cleaver.id, targetIds: ["brute"] },
      dice(12, 1, 1, 1, 1, 1, 6),
    );
    assert.equal(eventsOf(declined.events, "symbol-spend").length, 0);
  }

  // ── The log ──
  {
    const t = ((key: string, params: Record<string, unknown> = {}) => {
      const count = params.count;
      const plural = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : key;
      const text = english[key] ?? english[plural] ?? key;
      return text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""));
    }) as never;
    const view = { combatants: opened.combatants.map((one) => ({ id: one.id, name: one.name })) } as never;
    const names = rulesetCombatNames(definition, view, t);
    assert.equal(
      rulesetCombatEventLine(firstOf(first.events, "attack"), names, t),
      "Ada attacks Brute with Cleaver: 2 Success, 3 Advantage from 3 dice (2 upgraded), against 2 difficulty dice, a hit.",
    );
    const [cut, rally] = eventsOf(first.events, "symbol-spend");
    assert.equal(rulesetCombatEventLine(cut!, names, t), "Ada spends 2 Advantage: Cut deeper.");
    assert.equal(
      rulesetCombatEventLine(rally!, names, t),
      "Ada spends 1 Advantage: Rally. Bo throws 1 die more as boost on their next roll.",
    );
    assert.equal(
      rulesetCombatEventLine(firstOf(second.events, "attack"), names, t),
      "Bo attacks Brute with Cleaver: 1 Success, 1 Advantage from 1 die (+1 boost), against 2 difficulty dice, a hit.",
    );
    assert.equal(
      rulesetCombatEventLine(firstOf(third.events, "attack"), names, t),
      "Brute attacks Ada with Club: 3 Threat from 2 dice (1 upgraded), against 2 difficulty dice, a miss.",
    );
  }

  // ── Every new key needs 1.382 to install ──
  {
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json"] } },
      }) as never;
    const issue =
      /throw its symbol dice, or a creature with upgraded attack dice, requires schemaVersion 2 and capabilityApi 1\.382/;
    const cases: Array<[string, unknown]> = [
      ["a symbol fight", { combat: { kind: "symbol-pool" } }],
      ["a symbols block", { combat: { symbols: {} } }],
      [
        "a creature's upgraded dice",
        { catalogs: [{ id: "c", entries: [{ id: "a", creature: { actions: [{ upgrades: 1 }] } }] }] },
      ],
    ];
    for (const [what, ruleset] of cases) {
      assert.match(getCapabilityPackageInstallIssue(manifest(381), ruleset as never) ?? "", issue, what);
      assert.equal(getCapabilityPackageInstallIssue(manifest(382), ruleset as never), null, what);
    }
  }

  // ── Choosing your own spends: the throw is held until its chooser has picked ──
  {
    const asked = (state: RulesetEncounterState, ids: string[]) => ({ ...structuredClone(state), askSpends: ids });
    const answer = (state: RulesetEncounterState, actorId: string, optionId: string, ...faces: number[]) =>
      applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds: [] }, dice(...faces));
    const held = swing(asked(opened, ["ada"]), "ada", "brute", 4, 10, 8, 1, 4);
    const window = held.state.window!;
    assert.equal(window.kind, "spend");
    assert.deepEqual(window.waiting, ["ada"]);
    assert.equal(window.trigger.kind === "spend" && window.trigger.by, "attacker");
    assert.equal(eventsOf(held.events, "damage").length, 0, "nothing lands while she chooses");
    assert.equal(eventsOf(held.events, "symbol-spend").length, 0);
    const menu = rulesetWindowOptions(definition, held.state, "ada");
    assert.deepEqual(
      menu.map((option) => [option.id, option.label, option.cost?.[0]?.amount ?? null]),
      [
        [RULESET_ENGINE_SPENDS_OPTION, "Cut deeper, Rally", null],
        ["spend:cut", "Cut deeper", 2],
        ["spend:rally", "Rally", 1],
      ],
    );
    assert.deepEqual(rulesetWindowOptions(definition, held.state, "bo"), [], "only the chooser is asked");
    assert.equal(firstOf(answer(held.state, "bo", "spend:rally").events, "refused").reason, "window-open");

    // Rally, then Cut deeper with the two advantage left: nothing is left to buy, so it lands.
    const rallied = answer(held.state, "ada", "spend:rally");
    assert.equal(rallied.state.window?.id, window.id, "asked again while there is more to buy");
    assert.deepEqual(
      rulesetWindowOptions(definition, rallied.state, "ada").map((option) => option.id),
      [RULESET_ENGINE_SPENDS_OPTION, "spend:cut"],
      "Rally is bought once",
    );
    const cut = answer(rallied.state, "ada", "spend:cut", 4);
    assert.equal(cut.state.window, undefined);
    assert.deepEqual(
      eventsOf(cut.events, "symbol-spend").map((spend) => [spend.spendId, spend.times]),
      [
        ["rally", 1],
        ["cut", 1],
      ],
    );
    assert.equal(firstOf(cut.events, "damage").amount, 9, "the same blow as the Engine's pick");

    // Passing keeps what was chosen, here nothing: the advantage stays on the roll.
    const passed = answer(held.state, "ada", RULESET_PASS_OPTION, 4);
    assert.equal(passed.state.window, undefined);
    assert.equal(eventsOf(passed.events, "symbol-spend").length, 0);
    assert.equal(firstOf(passed.events, "damage").amount, 8);

    // A spend Ada chose and then the Engine's pick for the rest.
    const onlyRally = answer(held.state, "ada", "spend:rally");
    const rest = rulesetWindowOptions(definition, onlyRally.state, "ada").find(
      (option) => option.id === RULESET_ENGINE_SPENDS_OPTION,
    )!;
    assert.equal(rest.label, "Cut deeper");
    const engine = answer(onlyRally.state, "ada", RULESET_ENGINE_SPENDS_OPTION, 4);
    assert.deepEqual(
      eventsOf(engine.events, "symbol-spend").map((spend) => spend.spendId),
      ["rally", "cut"],
    );
    assert.equal(rulesetCombatant(engine.state, "bo")!.symbolDice?.boost, 1);

    // The target's side: the Brute's miss leaves Ada three threat, and she spends only Slip.
    const bruteHeld = swing(asked(bruteTurn, ["ada"]), "brute", "ada", 2, 1, 7, 8);
    const spending = bruteHeld.state.window!;
    assert.equal(spending.trigger.kind === "spend" && spending.trigger.by, "target");
    assert.equal(spending.trigger.kind === "spend" && spending.trigger.hit, false);
    assert.deepEqual(spending.waiting, ["ada"]);
    const slipped = answer(bruteHeld.state, "ada", "spend:slip");
    assert.ok(slipped.state.window, "two threat still buy Overreach");
    const done = answer(slipped.state, "ada", RULESET_PASS_OPTION);
    assert.equal(done.state.window, undefined);
    assert.deepEqual(
      eventsOf(done.events, "symbol-spend").map((spend) => [spend.actorId, spend.spendId]),
      [["ada", "slip"]],
    );
    assert.equal(rulesetCombatant(done.state, "brute")!.tracks?.heat, undefined, "Overreach was left");

    // Somebody who does not choose for themselves is never asked: the Brute's own spends are the
    // Engine's, and a throw with nothing to buy holds nothing.
    const notAsked = swing(asked(bruteTurn, ["brute"]), "brute", "ada", 2, 1, 7, 8);
    assert.equal(notAsked.state.window, undefined);
    const blank = swing(asked(opened, ["ada"]), "ada", "brute", 1, 1, 1, 1, 1, 1);
    assert.equal(blank.state.window, undefined, "nothing to buy, nothing to ask");
  }

  // ── The director: the player turns choosing on for whoever they play, and answers the window ──
  {
    const [{ createCombatDirector }, director] = await Promise.all([
      import("../../packages/server/src/services/game/combat-director.service.js"),
      import("../../packages/server/src/services/game/ruleset-combat-director.service.js"),
    ]);
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      side,
      hp: 12,
      maxHp: 12,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
    });
    const state = createCombatDirector({
      id: "spends",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "player"), unit("bo", "player")],
      enemies: [unit("brute", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 1,
    } as never);
    state.rulesetFight = {
      encounter: structuredClone(opened),
      eventSeq: 0,
      events: [],
      controllers: { bo: "ai" },
      bosses: [],
      adjustments: [],
    };
    director.syncRulesetCombatants(definition, state);
    state.stage = director.rulesetDirectorStage(state);
    const fight = state.rulesetFight!;
    assert.deepEqual(director.directedRulesetView(definition, state)?.spends, { choose: false });
    assert.ok(director.commandRulesetCombatDirector(definition, state, { type: "spends", choose: true }, "manual").ok);
    assert.deepEqual(fight.encounter.askSpends, ["ada"], "only whoever the player plays is asked");
    assert.deepEqual(director.directedRulesetView(definition, state)?.spends, { choose: true });
    assert.ok(
      director.commandRulesetCombatDirector(
        definition,
        state,
        { type: "control", unitId: "bo", controller: "manual" },
        "manual",
      ).ok,
    );
    assert.deepEqual(fight.encounter.askSpends, ["ada", "bo"], "and follows who they take over");

    // Ada's swing is held for her; the view carries the spend window and its menu.
    fight.encounter = swing(fight.encounter, "ada", "brute", 4, 10, 8, 1, 4).state;
    state.stage = director.rulesetDirectorStage(state);
    assert.equal(state.stage, "action");
    const view = director.directedRulesetView(definition, state)!;
    assert.equal(view.window?.kind, "spend");
    assert.deepEqual(view.window?.spend, { by: "attacker", hit: true });
    assert.deepEqual(
      view.options?.map((option) => option.id),
      [RULESET_ENGINE_SPENDS_OPTION, "spend:cut", "spend:rally"],
    );
    // Handed to the Engine while she is asked, she gets the Engine's pick.
    const handed = structuredClone(state);
    assert.ok(
      director.commandRulesetCombatDirector(
        definition,
        handed,
        { type: "control", unitId: "ada", controller: "ai" },
        "manual",
      ).ok,
    );
    assert.deepEqual(handed.rulesetFight!.encounter.askSpends, ["bo"]);
    assert.ok(director.commandRulesetCombatDirector(definition, handed, { type: "continue" }, "manual").ok);
    assert.deepEqual(
      handed
        .rulesetFight!.events.flatMap(({ event }) => (event.type === "symbol-spend" ? [event.spendId] : []))
        .slice(0, 2),
      ["cut", "rally"],
    );
    assert.ok(
      director.commandRulesetCombatDirector(
        definition,
        state,
        { type: "ruleset", optionId: RULESET_ENGINE_SPENDS_OPTION, targetIds: [] },
        "manual",
      ).ok,
    );
    assert.equal(fight.encounter.window, undefined);
    assert.ok(fight.events.some(({ event }) => event.type === "symbol-spend" && event.spendId === "cut"));

    assert.ok(director.commandRulesetCombatDirector(definition, state, { type: "spends", choose: false }, "manual").ok);
    assert.equal(fight.encounter.askSpends, undefined);
    // A fight thrown in summed dice has nothing to choose.
    const summed = parseRulesetDefinition(ember);
    assert.ok(summed.ok);
    const refused = director.commandRulesetCombatDirector(
      summed.definition,
      state,
      { type: "spends", choose: true },
      "manual",
    );
    assert.ok(!refused.ok && refused.code === "ruleset_combat_no_spends");
  }

  console.info("game ruleset combat symbol pool regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
