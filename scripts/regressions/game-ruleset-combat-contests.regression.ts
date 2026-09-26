/**
 * Ruleset combat, slice C5d (#6707): contests, driven with scripted dice.
 *
 * What is pinned here:
 *   - Both sides throw the fight's own attack dice and add the best check they may use; the higher
 *     total wins and a tie goes where the contest says. One event says both sides and the winner.
 *   - Winning applies conditions to the loser with the winner as their source, ends conditions on
 *     either side, and pushes the loser straight away on a board, stopping short of anything solid,
 *     anybody standing, the edge and a corner too tight to squeeze through. Losing does nothing.
 *   - The menu: a contest is an option of kind `contest` whose forecast is its exact chance to win,
 *     legal only against somebody it reaches. Breaking free is offered only while held, and only
 *     against whoever holds on.
 *   - A contest that takes the place of a strike is paid for out of strikes in hand, as an attack is.
 *   - Checks come off the sheet, or off a creature's own numbers, and an invented opponent's are held
 *     to its tier. A ruleset with no contests fights exactly as it did.
 *   - Every import refusal, the published words the log prints, and the 1.43 gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  holdRulesetCombatant,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetContestChance,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
  type TacticalGrid,
  type TacticalTerrain,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-contests-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [
    { getCapabilityPackageInstallIssue },
    { rulesetCombatEventLine, rulesetCombatNames },
    { rulesetOptionForecastText, RULESET_MENU_KINDS },
  ] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
    import("../../packages/client/src/lib/ruleset-combat-menu.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;

  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const variant = (base: string, edit: (doc: Record<string, any>) => void, what = "the variant") => {
    const doc = JSON.parse(base) as Record<string, any>;
    edit(doc);
    return parsedOrThrow(doc, what);
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
  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
  const fiveE = parsedOrThrow(JSON.parse(fiveEText), "the 5e reference");
  const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
  const contestOf = (doc: Record<string, any>, id: string) =>
    doc.combat.contests.find((entry: { id: string }) => entry.id === id);

  /** Dice written down in advance; running out is a failure. */
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);

  const TERRAIN: Record<string, TacticalTerrain> = { ".": "plains", "#": "wall" };
  const drawn = (...rows: string[]): TacticalGrid => ({
    width: rows[0]!.length,
    height: rows.length,
    tiles: rows.map((row) => [...row].map((glyph) => TERRAIN[glyph]!)),
  });

  // Juno wrestles on Brawn 3 and slips a grip on Wits 1; the hound's numbers are its own.
  const juno = (): RulesetCombatantInput => ({
    id: "juno",
    name: "Juno",
    side: "party",
    build: build({
      abilities: { brawn: 3, wits: 1, heart: 1 },
      fields: { toughness: 2 },
      lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
    }),
    live: {},
  });
  const hound = (checks?: Record<string, number>, id = "ash"): RulesetCombatantInput => ({
    id,
    name: id === "ash" ? "Ash-hound" : "Dust-hound",
    side: "enemy",
    block: {
      health: 6,
      defense: 5,
      initiativeModifier: 0,
      speed: 12,
      ...(checks ? { checks } : {}),
      actions: [
        { id: "bite", name: "Bite", budget: "act", toHit: 1, damage: { count: 1, sides: 6, flat: 0 }, reach: 2 },
      ],
    },
  });
  /** Juno first: 6 + 6 + Wits 1 against the hounds' ones. */
  const fight = (
    definition: RulesetDefinition,
    opponents: RulesetCombatantInput[] = [hound({ brawn: 2 })],
    board?: { grid: TacticalGrid; placements: Record<string, { x: number; y: number }> },
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 7,
      combatants: [juno(), ...opponents],
      roller: dice(6, 6, ...opponents.flatMap(() => [1, 1])),
      ...(board ? { board } : {}),
    });
  const act = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    choice: RulesetCombatChoice,
    ...faces: number[]
  ) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
  const grab = (targetIds = ["ash"]): RulesetCombatChoice => ({ actorId: "juno", optionId: "contest:grab", targetIds });

  // ── Refused at import ──
  {
    refuses(
      emberText,
      (doc) => (contestOf(doc, "grab").attacker.checks = ["heft"]),
      /Unknown contest check "heft"/,
      "an unknown check",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "grab").defender.checks = ["heft"]),
      /Unknown contest check "heft"/,
      "an unknown defending check",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "grab").budget = "swing"),
      /Unknown budget "swing"/,
      "an unknown budget",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "grab").onWin.applies[0].condition = "stuck"),
      /Unknown condition "stuck"/,
      "applying an unknown condition",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "break_free").onWin.ends[0].condition = "stuck"),
      /Unknown condition "stuck"/,
      "ending an unknown condition",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "break_free").from.holding = "stuck"),
      /Unknown condition "stuck"/,
      "breaking free of an unknown condition",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "grab").defender.checks = ["brawn", "brawn"]),
      /Duplicate check "brawn"/,
      "the same check twice on one side",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "break_free").onWin.applies = [{ condition: "held" }]),
      /breaks free of "held" cannot also apply it/,
      "breaking free of a hold by taking one",
    );
    refuses(
      emberText,
      (doc) => (contestOf(doc, "grab").onWin = {}),
      /applies, ends or pushes something/,
      "a win that does nothing",
    );
    refuses(
      emberText,
      (doc) => {
        delete doc.combat.distance;
        delete doc.combat.economy.movement;
        for (const source of doc.combat.attacks ?? []) delete source.reach;
        doc.combat.contests = [contestOf(doc, "shove")];
      },
      /"push" is measured in cells/,
      "a push with no cell to measure it in",
    );
    refuses(
      emberText,
      (doc) => {
        // Everything else that measures in cells goes too, so only the contest's reach can trip.
        delete doc.combat.distance;
        delete doc.combat.economy.movement;
        for (const source of doc.combat.attacks ?? []) delete source.reach;
        doc.combat.contests = [{ ...contestOf(doc, "grab"), reach: 4 }];
      },
      /contests\.0\.reach: "reach" is measured in cells/,
      "a reach with no cell to measure it in",
    );
    refuses(
      emberText,
      (doc) => doc.combat.contests.push({ ...contestOf(doc, "grab") }),
      /Duplicate contest id "grab"/,
      "two contests under one id",
    );
    refuses(
      emberText,
      (doc) => doc.combat.checks.push({ ...doc.combat.checks[0] }),
      /Duplicate contest check id "brawn"/,
      "two checks under one id",
    );
    refuses(
      emberText,
      (doc) =>
        (doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries[0].creature.checks =
          { heft: 1 }),
      /Unknown contest check "heft"/,
      "a creature's unknown check",
    );
    // A creature written as a sheet reads its checks off it, like everything else, and gives none of its own.
    refuses(
      emberText,
      (doc) => {
        const warden = doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((entry: { creature?: { sheet?: unknown } }) => entry.creature?.sheet);
        warden.creature.checks = { brawn: 1 };
      },
      /checks/,
      "numbers beside a sheet",
    );
  }

  // ── The menu ──
  {
    const state = fight(ember);
    const options = rulesetCombatOptions(ember, state, "juno");
    const contests = options.filter((option) => option.kind === "contest");
    assert.deepEqual(
      contests.map((option) => [option.id, option.label, option.budget]),
      [
        ["contest:grab", "Grab", "act"],
        ["contest:shove", "Shove back", "act"],
      ],
      "breaking free is not on offer while nothing holds on",
    );
    // The forecast is the exact share of 2d6 + 3 against 2d6 + 2 that the actor wins, ties to the defender.
    let wins = 0;
    for (let a1 = 1; a1 <= 6; a1++)
      for (let a2 = 1; a2 <= 6; a2++)
        for (let d1 = 1; d1 <= 6; d1++) for (let d2 = 1; d2 <= 6; d2++) if (a1 + a2 + 3 > d1 + d2 + 2) wins++;
    assert.equal(contests[0]!.forecast?.hitChance, Math.round((wins / 1296) * 1000) / 1000);
    const ash = rulesetCombatant(state, "ash")!;
    assert.equal(
      rulesetContestChance(
        ember.combat!,
        rulesetCombatant(state, "juno")!,
        ash,
        rulesetCombatant(state, "juno")!.actions.find((a) => a.id === "contest:grab")!.contest!,
      ),
      wins / 1296,
    );
    assert.deepEqual(rulesetCombatant(state, "juno")!.checks, { brawn: 3, wits: 1 }, "off the sheet");
    assert.deepEqual(ash.checks, { brawn: 2, wits: 0 }, "off the block, and zero where it says nothing");
  }

  // ── Winning, losing and ties ──
  {
    // 6 + 6 + 3 = 15 against 1 + 1 + 2 = 4.
    const won = act(ember, fight(ember), grab(), 6, 6, 1, 1);
    const [contest] = eventsOf(won.events, "contest");
    assert.deepEqual(contest, {
      type: "contest",
      actorId: "juno",
      targetId: "ash",
      optionId: "contest:grab",
      label: "Grab",
      attacker: { check: "brawn", rolls: [6, 6], modifier: 3, total: 15 },
      defender: { check: "brawn", rolls: [1, 1], modifier: 2, total: 4 },
      winner: "actor",
    });
    assert.deepEqual(eventsOf(won.events, "condition"), [
      { type: "condition", targetId: "ash", condition: "held", active: true, reason: "applied" },
    ]);
    assert.deepEqual(rulesetCombatant(won.state, "ash")!.tracked, [
      { condition: "held", rounds: null, source: "juno" },
    ]);
    assert.equal(rulesetCombatant(won.state, "juno")!.budgets.act, 0, "the budget is spent");

    // 1 + 1 + 3 = 5 against 6 + 6 + 2 = 14: nothing happens.
    const lost = act(ember, fight(ember), grab(), 1, 1, 6, 6);
    assert.equal(eventsOf(lost.events, "contest")[0]!.winner, "target");
    assert.deepEqual(eventsOf(lost.events, "condition"), []);
    assert.deepEqual(rulesetCombatant(lost.state, "ash")!.tracked, []);

    // Level: the defender takes it unless the contest says the attacker does. 2 + 3 + 3 = 8 against 3 + 3 + 2 = 8.
    assert.equal(eventsOf(act(ember, fight(ember), grab(), 2, 3, 3, 3).events, "contest")[0]!.winner, "target");
    const shoved = act(
      ember,
      fight(ember),
      { actorId: "juno", optionId: "contest:shove", targetIds: ["ash"] },
      2,
      3,
      3,
      3,
    );
    assert.equal(eventsOf(shoved.events, "contest")[0]!.winner, "actor", "Shove back gives ties to whoever shoves");
    assert.deepEqual(eventsOf(shoved.events, "pushed"), [], "and a fight with no board moves nobody");

    // The defender rolls the best check it may use: its Wits 5 here, not its Brawn.
    const slippery = act(ember, fight(ember, [hound({ brawn: 1, wits: 5 })]), grab(), 6, 6, 1, 1);
    assert.deepEqual(eventsOf(slippery.events, "contest")[0]!.defender, {
      check: "wits",
      rolls: [1, 1],
      modifier: 5,
      total: 7,
    });
  }

  // ── Breaking free ──
  {
    // Juno and Pell against two hounds: Juno 6 + 6 + 1, Ash 5 + 5, Pell and Dust 1 + 1.
    const pell: RulesetCombatantInput = {
      id: "pell",
      name: "Pell",
      side: "party",
      build: build({ abilities: { brawn: 1, wits: 0, heart: 0 }, fields: { toughness: 1 }, lists: {} }),
      live: {},
    };
    const four = createRulesetEncounter({
      definition: ember,
      seed: 7,
      combatants: [juno(), pell, hound({ brawn: 2 }), hound({ brawn: 2 }, "dust")],
      roller: dice(6, 6, 1, 1, 5, 5, 1, 1),
    });
    assert.deepEqual(four.order, ["juno", "ash", "pell", "dust"]);
    const held = act(ember, four, grab(), 6, 6, 1, 1).state;
    // Juno's turn ends, and the held hound's begins.
    let state = act(ember, held, { actorId: "juno", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(state.order[state.turn], "ash");
    const menu = rulesetCombatOptions(ember, state, "ash");
    const free = menu.find((option) => option.id === "contest:break_free");
    assert.ok(free, "breaking free is offered while held");
    assert.deepEqual(
      rulesetOptionTargets(ember, state, "ash", free!),
      ["juno"],
      "and aimed only at whoever holds on, not at Pell beside her",
    );
    assert.deepEqual(
      eventsOf(
        act(ember, state, { actorId: "ash", optionId: "contest:break_free", targetIds: ["pell"] }, 6, 6, 1, 1).events,
        "refused",
      )[0]?.reason,
      "bad-target",
    );
    // Its best is Brawn 2; Juno's defence is her Brawn 3. 6 + 5 + 2 = 13 against 1 + 2 + 3 = 6.
    const broke = act(
      ember,
      state,
      { actorId: "ash", optionId: "contest:break_free", targetIds: ["juno"] },
      6,
      5,
      1,
      2,
    );
    assert.equal(eventsOf(broke.events, "contest")[0]!.winner, "actor");
    assert.deepEqual(eventsOf(broke.events, "condition"), [
      { type: "condition", targetId: "ash", condition: "held", active: false, reason: "contest" },
    ]);
    state = broke.state;
    assert.deepEqual(rulesetCombatant(state, "ash")!.tracked, []);
    // Nothing holds on now, so it is gone from the menu, and the other hound was never able to use it.
    state = act(ember, state, { actorId: "ash", optionId: "end-turn", targetIds: [] }).state;
    state = act(ember, state, { actorId: "pell", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(state.order[state.turn], "dust");
    assert.ok(!rulesetCombatOptions(ember, state, "dust").some((option) => option.id === "contest:break_free"));
  }

  // ── A board: reach and pushes ──
  {
    const at = (
      juno: { x: number; y: number },
      ash: { x: number; y: number },
      grid = drawn(".......", ".......", ".......", ".......", ".......", "......."),
    ) => fight(ember, [hound({ brawn: 2 })], { grid, placements: { juno, ash } });
    const shove = (state: RulesetEncounterState, ...faces: number[]) =>
      act(ember, state, { actorId: "juno", optionId: "contest:shove", targetIds: ["ash"] }, ...faces);
    // Straight away, two cells.
    const pushed = shove(at({ x: 1, y: 2 }, { x: 2, y: 2 }), 6, 6, 1, 1);
    assert.deepEqual(eventsOf(pushed.events, "pushed"), [
      {
        type: "pushed",
        actorId: "juno",
        targetId: "ash",
        from: { x: 2, y: 2 },
        to: { x: 4, y: 2 },
        path: [
          { x: 3, y: 2 },
          { x: 4, y: 2 },
        ],
      },
    ]);
    assert.deepEqual([rulesetCombatant(pushed.state, "ash")!.x, rulesetCombatant(pushed.state, "ash")!.y], [4, 2]);
    // Corner-wise the same way.
    const diagonal = shove(at({ x: 1, y: 1 }, { x: 2, y: 2 }), 6, 6, 1, 1);
    assert.deepEqual(eventsOf(diagonal.events, "pushed")[0]!.to, { x: 4, y: 4 });
    // Short of a wall, and not at all into one.
    const walled = shove(
      at({ x: 1, y: 2 }, { x: 2, y: 2 }, drawn(".......", ".......", "....#..", ".......", ".......", ".......")),
      6,
      6,
      1,
      1,
    );
    assert.deepEqual(eventsOf(walled.events, "pushed")[0]!.to, { x: 3, y: 2 });
    const flat = shove(
      at({ x: 1, y: 2 }, { x: 2, y: 2 }, drawn(".......", ".......", "...#...", ".......", ".......", ".......")),
      6,
      6,
      1,
      1,
    );
    assert.deepEqual(eventsOf(flat.events, "pushed"), [], "nowhere to go, so no push is said");
    // Nor through a corner too tight to squeeze through.
    const squeezed = shove(
      at({ x: 1, y: 1 }, { x: 2, y: 2 }, drawn(".......", ".......", "...#...", "..#....", ".......", ".......")),
      6,
      6,
      1,
      1,
    );
    assert.deepEqual(eventsOf(squeezed.events, "pushed"), []);
    // Nor onto somebody standing there.
    const crowded = createRulesetEncounter({
      definition: ember,
      seed: 7,
      combatants: [juno(), hound({ brawn: 2 }), hound({ brawn: 2 }, "dust")],
      roller: dice(6, 6, 1, 1, 1, 1),
      board: {
        grid: drawn(".......", ".......", ".......", "......."),
        placements: { juno: { x: 1, y: 2 }, ash: { x: 2, y: 2 }, dust: { x: 4, y: 2 } },
      },
    });
    assert.deepEqual(eventsOf(shove(crowded, 6, 6, 1, 1).events, "pushed")[0]!.to, { x: 3, y: 2 });
    // Reach: the next cell unless the contest says further.
    const apart = at({ x: 1, y: 2 }, { x: 3, y: 2 });
    assert.deepEqual(
      rulesetOptionTargets(ember, apart, "juno", { id: "contest:grab", targets: { side: "enemy", count: 1 } }),
      [],
    );
    assert.deepEqual(eventsOf(act(ember, apart, grab(), 6, 6, 1, 1).events, "refused")[0]!.reason, "out-of-reach");
    const long = variant(emberText, (doc) => (contestOf(doc, "grab").reach = 4));
    const reaching = fight(long, [hound({ brawn: 2 })], {
      grid: drawn(".......", "......."),
      placements: { juno: { x: 1, y: 1 }, ash: { x: 3, y: 1 } },
    });
    assert.deepEqual(
      rulesetOptionTargets(long, reaching, "juno", { id: "contest:grab", targets: { side: "enemy", count: 1 } }),
      ["ash"],
    );
  }

  // ── In place of a strike ──
  {
    // A 5e fighter whose Attack action buys two strikes grapples with the first and swings with the second.
    const fighter = (): RulesetCombatantInput => ({
      id: "juno",
      name: "Juno",
      side: "party",
      build: build({
        abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
        skills: { athletics: "proficient" },
        fields: { level: 7, ac: 18, speed: 30, hp_max: 60, attacks_per_action: 2 },
        lists: {
          attacks: [
            { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
          ],
        },
      }),
      live: {},
    });
    const state = createRulesetEncounter({
      definition: fiveE,
      seed: 7,
      combatants: [
        fighter(),
        {
          id: "ash",
          name: "Ash",
          side: "enemy",
          block: { health: 20, defense: 10, initiativeModifier: 0, actions: [] },
        },
      ],
      roller: dice(20, 1),
    });
    const juno5e = rulesetCombatant(state, "juno")!;
    assert.equal(juno5e.checks?.might, 4 + 3, "Athletics off the sheet: Strength +4 and proficiency +3");
    assert.equal(juno5e.actions.find((action) => action.id === "contest:grapple")?.strikes, 2);
    const grappled = act(fiveE, state, { actorId: "juno", optionId: "contest:grapple", targetIds: ["ash"] }, 15, 2);
    assert.equal(rulesetCombatant(grappled.state, "juno")!.strikesLeft, 1);
    const swing = rulesetCombatOptions(fiveE, grappled.state, "juno").find((option) => option.label === "Longsword");
    assert.ok(swing && swing.budget === undefined && swing.strikes === 1, "the second strike costs nothing more");
    // Escaping is not one of those: the 5e reference says it takes the whole action.
    assert.equal(juno5e.actions.find((action) => action.id === "contest:escape")?.strikes, undefined);
  }

  // ── Opponents nobody wrote ──
  {
    const tier = ember.combat!.threat!.tiers[0]!;
    const held = clampRulesetStatBlock(
      ember,
      {
        health: 6,
        defense: 5,
        initiativeModifier: 0,
        checks: { brawn: 40, heft: 9 },
        actions: [{ name: "Maul", budget: "act", toHit: 1, damage: { count: 1, sides: 6, flat: 0 } }],
      },
      tier.id,
    );
    const cap = tier.toHit + 2;
    assert.deepEqual(
      held.block.checks,
      { brawn: cap },
      "held to the tier's to-hit, and a check it does not have dropped",
    );
    assert.ok(
      held.adjusted.some((line) => /heft/.test(line)) && held.adjusted.some((line) => /brawn is now/.test(line)),
    );
    const built = rulesetCombatant(fight(ember, [hound({ brawn: 2 })]), "ash")!;
    built.checks = { brawn: 99, wits: 0 };
    holdRulesetCombatant(ember, built, ember.combat!.threat!.tiers[0]!);
    assert.equal(built.checks.brawn, cap);
  }

  // ── A ruleset with no contests fights as it did ──
  {
    const plain = variant(emberText, (doc) => {
      delete doc.combat.checks;
      delete doc.combat.contests;
    });
    const state = fight(plain);
    for (const combatant of state.combatants) {
      assert.equal("checks" in combatant, false);
      assert.ok(!combatant.actions.some((action) => action.kind === "contest"));
    }
  }

  // ── What the log says ──
  {
    const t = ((key: string, params: Record<string, unknown> = {}) =>
      (english[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""))) as never;
    const won = act(ember, fight(ember), grab(), 6, 6, 1, 1);
    const view = {
      combatants: won.state.combatants.map((combatant) => ({ id: combatant.id, name: combatant.name })),
    } as never;
    const names = rulesetCombatNames(ember, view, t);
    assert.equal(
      rulesetCombatEventLine(eventsOf(won.events, "contest")[0]!, names, t),
      "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins.",
    );
    const lost = act(ember, fight(ember), grab(), 1, 1, 6, 6);
    assert.match(rulesetCombatEventLine(eventsOf(lost.events, "contest")[0]!, names, t) ?? "", /, and fails\.$/);
    assert.equal(
      rulesetCombatEventLine(
        { type: "condition", targetId: "ash", condition: "held", active: false, reason: "contest" },
        names,
        t,
      ),
      "Ash-hound is no longer Held.",
    );
    // A contest's forecast is its chance to win, in its own group of the menu.
    const option = rulesetCombatOptions(ember, fight(ember), "juno").find((entry) => entry.id === "contest:grab")!;
    assert.match(rulesetOptionForecastText({ ...option, targetIds: ["ash"] }, t), /^\d+% to win$/);
    assert.ok((RULESET_MENU_KINDS as readonly string[]).includes("contest"));
  }

  // ── Every new key needs 1.43 to install ──
  {
    assert.equal(supportedCapabilityApi.minor, 43);
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
    const issue = /requires schemaVersion 2 and capabilityApi 1\.43 or newer/;
    const documents = [
      { combat: { checks: [{ id: "c", label: "C", value: { const: 1 } }] } },
      { combat: { contests: [] } },
      { catalogs: [{ id: "b", holds: "creatures", entries: [{ id: "x", creature: { checks: { c: 1 } } }] }] },
    ];
    for (const document of documents) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(42) as never, document) ?? "",
        issue,
        JSON.stringify(document),
      );
    }
    assert.equal(getCapabilityPackageInstallIssue(manifest(43) as never, documents[0]!), null);
    assert.equal(getCapabilityPackageInstallIssue(manifest(43) as never, documents[1]!), null);
  }

  console.info("game ruleset combat contest regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
