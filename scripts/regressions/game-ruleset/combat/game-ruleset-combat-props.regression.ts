/**
 * Props on the fight board that may be broken (Capability API 1.316): a jar, a crate, a door.
 *
 *   - An encounter's `board.props`: kept on the board with their health, off-board cells and empty
 *     ones dropped; one that closes its cells closes them from the start, and nobody stands in it.
 *   - Struck as a wall's section is: listed among an attack's `walls`, rolled at as at a creature,
 *     told as a `prop` line; a fragile one anything hits is broken outright.
 *   - Caught in an area as anybody is, from the same roll, never saving; broken, it stops closing its
 *     cells and its label goes on the board's list, the fight's summary and the recap.
 *   - Painted on a world's battlefield, it reaches the director's fight and its view, and the client
 *     draws and says it.
 *   - A story's `broke` trigger trips on what the recap says was broken.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  applyRulesetCombatChoice,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseWorldKit,
  rowsFromCatalogEntry,
  rulesetBoardProps,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetEncounterSummary,
  rulesetSheetBuildSchema,
  storyFightBroken,
  storyTurn,
  worldBattlefieldBlankRows,
  worldBattlefieldHere,
  worldBattlefieldIssues,
  worldBattlefieldMapSchema,
  type DirectedRulesetView,
  type GameWorld,
  type RulesetBoardPropInput,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type StoryScriptInput,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";
import { rulesetBoardCells, rulesetCellSentences } from "../../../../packages/client/src/lib/ruleset-combat-board.js";
import { rulesetCombatRecapLines } from "../../../../packages/client/src/lib/ruleset-combat-bridge.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-props-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { createRulesetFight, directedRulesetView } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsedRuleset = parseRulesetDefinition(JSON.parse(fiveEText));
  assert.ok(parsedRuleset.ok, parsedRuleset.ok ? "" : parsedRuleset.issues.join("; "));
  const definition = parsedRuleset.definition;

  // A burst of fire, saved against for half.
  const burst = {
    id: "burst",
    label: "Burst",
    rows: [{ list: "spells", values: { name: "Burst", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      range: 60,
      area: { shape: "burst", size: 10 },
      amount: { flat: 10 },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
    },
  } as unknown as RulesetCatalogEntry;
  const spells = [burst];
  const brute: RulesetStatBlock = {
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "club",
        name: "Club",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "bludgeoning" },
      },
      { id: "brand", name: "Brand", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2, type: "fire" } },
      {
        id: "spit",
        name: "Spit",
        budget: "action",
        save: { save: "dex_save", difficulty: 12 },
        damage: { count: 1, sides: 6, flat: 0, type: "acid" },
      },
    ],
  } as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  // A crate beside the brute that closes its cell, fire doing double; a jar that breaks at a touch and
  // shrugs off clubs; a lantern far off.
  const crate: RulesetBoardPropInput = {
    id: "crate",
    label: "Crate",
    cells: [{ x: 5, y: 7 }],
    health: 8,
    defense: 10,
    vulnerable: ["fire"],
    blocks: { move: true, sight: true },
  };
  const jar: RulesetBoardPropInput = {
    id: "jar",
    label: "Oil Jar",
    cells: [{ x: 6, y: 8 }],
    health: 5,
    immune: ["bludgeoning"],
    fragile: true,
  };
  const lantern: RulesetBoardPropInput = { id: "lantern", label: "Lantern", cells: [{ x: 12, y: 12 }], health: 2 };
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (
    props: RulesetBoardPropInput[] = [crate, jar, lantern],
    placements: Record<string, { x: number; y: number }> = { mage: { x: 2, y: 7 }, a: { x: 6, y: 7 } },
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: brute },
      ],
      board: { grid: grid(), placements, props },
    });
    state.order = ["mage", "a"];
    state.turn = 1;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    return option;
  };
  const keys = (cells: RulesetCombatCell[] | undefined) => (cells ?? []).map((cell) => `${cell.x},${cell.y}`).sort();
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const propsSaid = (events: RulesetCombatEvent[]) => events.flatMap((one) => (one.type === "prop" ? [one] : []));
  const strike = (state: RulesetEncounterState, label: string, wall: RulesetCombatCell) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "a", optionId: optionOf(state, "a", label).id, targetIds: [], wall },
      roll,
    );
  const health = (state: RulesetEncounterState) =>
    Object.fromEntries((state.board?.props ?? []).map((prop) => [prop.id, prop.health]));
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;

  // ── Kept on the board as handed, closing what it closes from the start ──
  {
    const state = fight();
    assert.deepEqual(
      state.board?.props?.map((prop) => [prop.id, prop.label, prop.health, prop.max, prop.defense]),
      [
        ["crate", "Crate", 8, 8, 10],
        ["jar", "Oil Jar", 5, 5, 10],
        ["lantern", "Lantern", 2, 2, 10],
      ],
      "a defense not said is 10",
    );
    assert.equal(state.board?.grid.walls?.["5,7"], 3, "the crate closes its cell to walking and seeing");
    assert.equal(state.board?.grid.walls?.["6,8"], undefined, "the jar closes nothing");
    assert.deepEqual(state.board?.props?.[1]?.immune, ["bludgeoning"]);
    assert.equal(state.board?.props?.[1]?.fragile, true);
    assert.equal(state.board?.broken, undefined);
    // Somebody asked to stand in the crate steps aside; nobody else moves.
    const moved = fight(undefined, { mage: { x: 5, y: 7 }, a: { x: 6, y: 7 } });
    const mage = rulesetCombatant(moved, "mage")!;
    assert.notDeepEqual([mage.x, mage.y], [5, 7]);
    assert.deepEqual([rulesetCombatant(moved, "a")!.x, rulesetCombatant(moved, "a")!.y], [6, 7]);
    // Without props, no list.
    assert.equal(fight([]).board?.props, undefined);
    // What cannot stand on the board is left out.
    const kept = rulesetBoardProps(grid(), [
      { label: "Off", cells: [{ x: 15, y: 0 }], health: 3 },
      {
        label: "Half",
        cells: [
          { x: 14, y: 0 },
          { x: 15, y: 0 },
          { x: 14, y: 0 },
        ],
        health: 3.7,
        defense: 13,
      },
      { label: "Dead", cells: [{ x: 1, y: 1 }], health: 0 },
      { label: " ", cells: [{ x: 1, y: 1 }], health: 3 },
      { id: "half", label: "Twin", cells: [{ x: 2, y: 2 }], health: 1 },
      { id: "half", label: "Twin", cells: [{ x: 3, y: 3 }], health: 1, blocks: { sight: true } },
    ]);
    assert.deepEqual(
      kept.map((prop) => [prop.id, prop.label, keys(prop.cells), prop.health, prop.defense, prop.blocks]),
      [
        ["prop-2", "Half", ["14,0"], 3, 13, undefined],
        ["half", "Twin", ["2,2"], 1, 10, undefined],
        ["half-6", "Twin", ["3,3"], 1, 10, { sight: true }],
      ],
    );
  }

  // ── Struck: listed, hit, missed, doubled, broken; a fragile one at a touch ──
  {
    d20 = 15;
    const state = fight();
    assert.deepEqual(keys(optionOf(state, "a", "Club").walls), ["5,7", "6,8"], "the lantern is out of reach");
    assert.equal(optionOf(state, "a", "Spit").walls, undefined, "nor what is saved against");
    const hit = strike(state, "Club", { x: 5, y: 7 });
    assert.equal(refused(hit), undefined, JSON.stringify(hit.events));
    assert.deepEqual(
      propsSaid(hit.events).map((one) => [one.prop, one.label, one.outcome, one.dealt, one.health, one.broken]),
      [["Crate", "Club", "hit", 5, 3, undefined]],
    );
    assert.equal(health(hit.state).crate, 3);
    assert.ok(!hit.state.combatants.some((one) => one.object), "the stand-in is gone");
    assert.ok(!hit.events.some((one) => "targetId" in one && one.targetId === "wall-section"), "nor told");
    assert.equal(hit.state.board?.grid.walls?.["5,7"], 3, "still standing, still closed");
    assert.equal(rulesetCombatant(hit.state, "a")!.budgets.action, 0, "the attack is paid for");
    d20 = 2;
    const missed = propsSaid(strike(fight(), "Club", { x: 5, y: 7 }).events)[0]!;
    assert.deepEqual([missed.outcome, missed.dealt, missed.health], ["miss", 0, 8]);
    d20 = 20;
    const critical = propsSaid(strike(fight(), "Club", { x: 5, y: 7 }).events)[0]!;
    assert.equal(critical.outcome, "critical");
    // Fire does double, 10: broken, it closes nothing more and goes on the list.
    d20 = 15;
    const burnt = strike(fight(), "Brand", { x: 5, y: 7 });
    assert.deepEqual(
      propsSaid(burnt.events).map((one) => [one.dealt, one.health, one.broken]),
      [[10, 0, true]],
    );
    assert.equal(burnt.state.board?.grid.walls?.["5,7"], undefined);
    assert.deepEqual(burnt.state.board?.broken, ["Crate"]);
    assert.deepEqual(rulesetEncounterSummary(definition, burnt.state).broken, ["Crate"]);
    assert.equal(rulesetEncounterSummary(definition, fight()).broken, undefined);
    // Broken, it is struck at no more.
    rulesetCombatant(burnt.state, "a")!.budgets.action = 1;
    assert.deepEqual(keys(optionOf(burnt.state, "a", "Club").walls), ["6,8"]);
    assert.ok(refused(strike(burnt.state, "Club", { x: 5, y: 7 })), "already broken");
    // The jar shrugs off a club, but anything that hits it breaks it.
    const shattered = strike(fight(), "Club", { x: 6, y: 8 });
    assert.deepEqual(
      propsSaid(shattered.events).map((one) => [one.prop, one.dealt, one.health, one.broken]),
      [["Oil Jar", 0, 0, true]],
    );
    assert.deepEqual(shattered.state.board?.broken, ["Oil Jar"]);
    d20 = 2;
    const spared = strike(fight(), "Club", { x: 6, y: 8 });
    assert.deepEqual(
      propsSaid(spared.events).map((one) => [one.outcome, one.health, one.broken]),
      [["miss", 5, undefined]],
    );
    // Not a prop, nothing to strike.
    d20 = 15;
    assert.ok(refused(strike(fight(), "Club", { x: 7, y: 7 })), "not a prop");
    // A sturdy prop's last points break it all the same.
    rulesetCombatant(hit.state, "a")!.budgets.action = 1;
    const twice = strike(hit.state, "Club", { x: 5, y: 7 });
    assert.deepEqual(
      propsSaid(twice.events).map((one) => [one.health, one.broken]),
      [[0, true]],
    );
  }

  // ── Caught in an area: the same roll, no save, broken where it is enough ──
  {
    d20 = 15;
    const state = fight();
    state.turn = 0;
    const before = hp(state, "a");
    const cast = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, "mage", "Burst").id, targetIds: [], at: { x: 6, y: 8 } },
      roll,
    );
    assert.equal(refused(cast), undefined, JSON.stringify(cast.events));
    const said = propsSaid(cast.events);
    assert.deepEqual(
      said.map((one) => [one.prop, one.label, one.outcome, one.dealt, one.health, one.broken]),
      [
        ["Crate", "Burst", "area", 20, 0, true],
        ["Oil Jar", "Burst", "area", 10, 0, true],
      ],
      "the crate takes the full 10 doubled, the jar breaks",
    );
    assert.ok(!cast.state.combatants.some((one) => one.object), "no stand-in left");
    assert.ok(
      !cast.events.some(
        (one) =>
          ("targetId" in one && String(one.targetId).startsWith("prop>")) ||
          ("actorId" in one && one.actorId.startsWith("prop>")),
      ),
      "nothing told about a stand-in",
    );
    assert.ok(
      cast.events.some((one) => one.type === "save" && one.actorId === "a"),
      "the brute still saves",
    );
    assert.ok(hp(cast.state, "a") < before, "and is still burned");
    assert.deepEqual(cast.state.board?.broken, ["Crate", "Oil Jar"]);
    assert.equal(health(cast.state).lantern, 2, "the lantern is out of it");
    assert.equal(cast.state.board?.grid.walls?.["5,7"], undefined, "the crate's cell is open");
    // A sturdier crate takes the same roll and stands.
    const tough = fight([{ ...crate, health: 30 }]);
    tough.turn = 0;
    const scorched = applyRulesetCombatChoice(
      definition,
      tough,
      { actorId: "mage", optionId: optionOf(tough, "mage", "Burst").id, targetIds: [], at: { x: 6, y: 8 } },
      roll,
    );
    assert.deepEqual(
      propsSaid(scorched.events).map((one) => [one.dealt, one.health, one.broken]),
      [[20, 10, undefined]],
    );
    // Aimed away from every prop, it touches none.
    const wide = fight();
    wide.turn = 0;
    const missed = applyRulesetCombatChoice(
      definition,
      wide,
      { actorId: "mage", optionId: optionOf(wide, "mage", "Burst").id, targetIds: [], at: { x: 2, y: 2 } },
      roll,
    );
    assert.deepEqual(propsSaid(missed.events), []);
    // The recap tells the Game Master what broke, a semicolon between them.
    const lines = rulesetCombatRecapLines(definition, rulesetEncounterSummary(definition, cast.state));
    assert.ok(lines.includes("Broken: Crate; Oil Jar"), JSON.stringify(lines));
    assert.ok(
      !rulesetCombatRecapLines(definition, rulesetEncounterSummary(definition, fight())).some((line) =>
        line.startsWith("Broken:"),
      ),
    );
  }

  // ── Painted on a world's battlefield: the director's fight and its view ──
  const kitParsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
  assert.ok(kitParsed.ok);
  const kit = kitParsed.kit;
  const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
  const brief = checkWorldBrief(kit, {
    briefVersion: 1,
    premise: "A river kingdom",
    places: [{ name: "Ashford", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
    groups: [],
    peopleNames: kit.cultures.map((culture) => ({
      culture: culture.id,
      given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato", "Tamsin", "Wren", "Edda", "Fenn"],
      family: ["Arnwald", "Fennick", "Holt", "Marrow", "Voss", "Drey", "Callow"],
    })),
  });
  assert.ok(brief.ok, JSON.stringify(brief));
  const stored = {
    seed: 31,
    generatorVersion: WORLD_GENERATOR_VERSION,
    grounding: "expand" as const,
    brief: brief.brief,
  };
  const bare: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };
  const start = bare.world.startId;
  const map = worldBattlefieldMapSchema.parse({
    id: "b1",
    name: "Mill Yard",
    place: start,
    size: "small",
    scene: "forest",
    rows: worldBattlefieldBlankRows("small"),
    props: [
      {
        id: "p1",
        label: "Sluice Gate",
        cells: [
          { x: 3, y: 2 },
          { x: 3, y: 3 },
        ],
        health: 12,
        blocks: { move: true },
      },
      { id: "p2", label: "Oil Jar", cells: [{ x: 5, y: 5 }], health: 1, fragile: true, defense: 8 },
    ],
  });
  {
    assert.deepEqual(worldBattlefieldIssues(map), []);
    const refusedLabel = worldBattlefieldMapSchema.safeParse({
      ...map,
      props: [{ id: "p1", label: "Jar; Lid", cells: [{ x: 1, y: 1 }], health: 1 }],
    });
    assert.equal(refusedLabel.success, false, "a semicolon is refused");
    assert.equal(
      worldBattlefieldMapSchema.safeParse({
        ...map,
        props: [{ id: "x1", label: "Jar", cells: [{ x: 1, y: 1 }], health: 1 }],
      }).success,
      false,
      "a prop's id is p and a number",
    );
    assert.equal(
      worldBattlefieldMapSchema.safeParse({
        ...map,
        props: [{ id: "p1", label: "Jar", cells: [{ x: 1, y: 1 }], health: 0 }],
      }).success,
      false,
      "health at least 1",
    );
    const width = map.rows[0]!.length;
    assert.deepEqual(
      worldBattlefieldIssues({ ...map, props: [{ id: "p1", label: "Jar", cells: [{ x: width, y: 0 }], health: 1 }] }),
      ["Jar stands off the board"],
    );
    assert.deepEqual(
      worldBattlefieldIssues({
        ...map,
        props: [
          { id: "p1", label: "Jar", cells: [{ x: 1, y: 0 }], health: 1 },
          { id: "p1", label: "Lid", cells: [{ x: 2, y: 0 }], health: 1 },
        ],
      }),
      ["Two props are numbered p1"],
    );
  }
  const game: GameWorld = { ...bare, edits: { battlefields: [map] } as GameWorld["edits"] };
  {
    const made = worldBattlefieldHere(game, start, 1);
    assert.deepEqual(
      made?.props?.map((prop) => [prop.id, prop.label]),
      [
        ["p1", "Sluice Gate"],
        ["p2", "Oil Jar"],
      ],
    );
    assert.equal(worldBattlefieldHere(bare, start, 1), null);
    const plain = worldBattlefieldHere(
      { ...bare, edits: { battlefields: [{ ...map, props: undefined }] } as GameWorld["edits"] },
      start,
      1,
    );
    assert.equal(plain?.props, undefined);
    const built = createRulesetFight({
      definition,
      seed: 3,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "x", name: "X" }],
      bestiary: {},
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      positioned: true,
      made,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const encounter = (built as { fight: { encounter: RulesetEncounterState } }).fight.encounter;
    assert.deepEqual(
      encounter.board?.props?.map((prop) => [prop.id, prop.health, prop.defense, prop.fragile]),
      [
        ["p1", 12, 10, undefined],
        ["p2", 1, 8, true],
      ],
    );
    assert.equal(encounter.board?.grid.walls?.["3,2"], 1, "the gate closes its cells to walking");
    const view = (state: RulesetEncounterState) =>
      directedRulesetView(definition, {
        style: "ruleset",
        rulesetFight: { encounter: state, events: [], eventSeq: 0, controllers: {}, live: {}, adjustments: [] },
      } as never) as DirectedRulesetView;
    const shown = view(encounter);
    assert.deepEqual(
      shown.props?.map((prop) => [prop.id, prop.label, keys(prop.cells), prop.health, prop.max]),
      [
        ["p1", "Sluice Gate", ["3,2", "3,3"], 12, 12],
        ["p2", "Oil Jar", ["5,5"], 1, 1],
      ],
    );
    // Broken, it is still shown, at 0.
    const broken = structuredClone(encounter);
    broken.board!.props![1]!.health = 0;
    assert.equal(view(broken).props?.[1]?.health, 0);
    // Without a board, none.
    const off = structuredClone(encounter);
    delete off.board;
    assert.equal(view(off).props, undefined);
    // The client draws it on its cells and says what it is.
    const t = ((key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ""}`) as never;
    const cells = rulesetBoardCells(shown, null);
    const at = (x: number, y: number) => cells.find((cell) => cell.x === x && cell.y === y)!;
    assert.deepEqual(at(3, 3).prop, { label: "Sluice Gate", health: 12, max: 12, dx: 0, dy: 1 });
    assert.equal(at(4, 4).prop, undefined);
    assert.ok(
      rulesetCellSentences(at(3, 3), shown, t).includes(
        'game.combat.ruleset.board.prop{"label":"Sluice Gate","health":12,"max":12}',
      ),
    );
    const brokenView = view(broken);
    const rubble = rulesetBoardCells(brokenView, null).find((cell) => cell.x === 5 && cell.y === 5)!;
    assert.ok(
      rulesetCellSentences(rubble, brokenView, t).includes('game.combat.ruleset.board.propBroken{"label":"Oil Jar"}'),
    );
  }

  // ── A story's `broke`: what the recap says was broken ──
  {
    const recap =
      "*Done.*\n\n[combat_result]\nOUTCOME: VICTORY (2 rounds)\nBroken: Sluice Gate; Oil Jar\n[/combat_result]";
    assert.deepEqual(storyFightBroken(recap), ["Sluice Gate", "Oil Jar"]);
    assert.deepEqual(storyFightBroken("Broken: Sluice Gate"), [], "only a combat recap says so");
    assert.deepEqual(
      storyFightBroken(`Broken: the Mill\n\n${recap}`),
      ["Sluice Gate", "Oil Jar"],
      "the player's own words before the recap are not read",
    );
    assert.deepEqual(
      storyFightBroken(`[combat_result]\nBroken: the Mill\n[/combat_result]\n\n${recap}`),
      ["Sluice Gate", "Oil Jar"],
      "a recap the player wrote before the Engine's is not read",
    );
    assert.deepEqual(storyFightBroken("[combat_result]\nOUTCOME: VICTORY\n[/combat_result]"), []);
    // A long run of blanks after "Broken:" is read at once.
    const blanks = `[combat_result]\nbroken:${"\t".repeat(100_000)}\n[/combat_result]`;
    const started = performance.now();
    assert.deepEqual(storyFightBroken(blanks), []);
    // A regex that backtracks over 100,000 blanks takes minutes; a loaded runner never takes 2 seconds.
    assert.ok(performance.now() - started < 2_000, "a long blank line is read quickly");
    assert.deepEqual(storyFightBroken("[combat_result]\r\nBROKEN:  Sluice Gate ; \r\n"), ["Sluice Gate"]);
    const input: StoryScriptInput = {
      storyVersion: 1,
      flags: [
        { id: "flooded", kind: "bool", initial: false },
        { id: "jars", kind: "number", initial: 0 },
      ],
      directions: [],
      events: [
        { id: "flood", when: { on: "broke", prop: "sluice gate" }, do: [{ set: "flooded", value: true }] },
        { id: "jar", when: { on: "broke", prop: "Oil Jar" }, repeat: true, do: [{ add: "jars", amount: 1 }] },
      ],
      cutscenes: [],
    };
    const read = checkStoryScript(game, input);
    assert.ok(read.ok, JSON.stringify(read));
    const story = read.story;
    const turn = (replies: string[], broke?: string[]) =>
      storyTurn(story, {
        game,
        replies,
        repliesBefore: replies.length,
        latest: replies.at(-1) ?? null,
        told: [],
        day: 0,
        fight: null,
        ...(broke ? { broke } : {}),
      });
    assert.deepEqual(turn(["a"], ["Sluice Gate", "Oil Jar"]).tripped, ["flood", "jar"], "by label, any case");
    assert.deepEqual(turn(["a"], ["Oil Jar"]).tripped, ["jar"]);
    assert.deepEqual(turn(["a"]).tripped, [], "nothing broken, nothing tripped");
    assert.deepEqual(turn(["a"], ["Barrel"]).tripped, []);
    const first = turn(["a"], ["Sluice Gate", "Oil Jar"]);
    const after = [`${first.prepend}a`, "b"];
    assert.deepEqual(turn(after, ["Sluice Gate", "Oil Jar"]).tripped, ["jar"], "once, unless it repeats");
    // Only what a battlefield of the world has can be broken.
    const unknown = checkStoryScript(game, {
      ...input,
      events: [{ id: "x", when: { on: "broke", prop: "Barrel" }, do: [{ set: "flooded", value: true }] }],
    });
    assert.equal(unknown.ok, false);
    assert.ok(
      !unknown.ok &&
        unknown.issues.some((issue) => issue.includes('no battlefield of this world has a prop called "Barrel"')),
      JSON.stringify(unknown),
    );
    assert.equal(checkStoryScript(bare, input).ok, false, "a world without battlefields has nothing to break");
  }

  console.log(
    "Ruleset props: kept on the board, struck and caught in areas, broken and told, painted on battlefields, shown, and tripping a story.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
