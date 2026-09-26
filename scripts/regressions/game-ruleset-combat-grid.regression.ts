/**
 * Ruleset combat, slice C4a: the fight on a grid, driven with hand-drawn boards and scripted dice.
 *
 * What is pinned here:
 *   - A fight WITHOUT a board behaves byte for byte as it did before any of this existed. The same
 *     scenarios are run twice, on the very same rulesets that now declare a cell size, and the whole
 *     event log is compared.
 *   - Nothing is hard-wired to one game system. Every rule below is proven on the 5e draft, which
 *     measures in feet and has long shots, cover and opportunity strikes, AND on Ember Roads, which
 *     measures in paces, has none of those three, and proves that none of them is required.
 *   - The board is the TACTICAL engine's own grid and terrain table. This slice adds the way a
 *     tabletop grid is played on top of it: eight neighbours, distance as the larger axis
 *     difference, real burst, cone and line shapes, and line of sight.
 *   - The menu is still the only place legality lives. Where a move may go, who an option may be
 *     pointed at and where a shape may be aimed are all one rule the resolution checks against.
 *   - Every refusal changes nothing and says exactly why: out of reach, no line of sight, a cell
 *     that cannot be reached, a cell a shape may not be aimed at.
 *   - The format's cross-checks: a cell size above zero, a declared opportunity budget, reach and
 *     range columns that exist and hold numbers, a long distance at least the ordinary one, and a
 *     refusal for any of the board's keys without a cell size to measure them in.
 *   - Capability API 1.28.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  RULESET_MOVE_OPTION,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  rulesetAimCells,
  rulesetAimLegal,
  rulesetAreaCells,
  rulesetAreaTargets,
  rulesetAttackMode,
  rulesetCellDistance,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatFailsSave,
  rulesetCombatOptions,
  rulesetWindowOptions,
  rulesetInCells,
  rulesetLineOfSight,
  rulesetMovementAllowance,
  rulesetOpportunityAttack,
  rulesetOptionReach,
  rulesetOptionTargets,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatant,
  type RulesetCombatCell,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetCombatantInput,
  type RulesetEncounterState,
  type RulesetSheetBuild,
  type TacticalGrid,
  type TacticalTerrain,
} from "../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
/** Both examples less 1.43's contests and the checks they read: this lane is about the board, and a
 *  contest on it is proven in the contest lane. */
const withoutContests = (text: string): string => {
  const doc = JSON.parse(text);
  delete doc.combat.checks;
  delete doc.combat.contests;
  for (const catalog of doc.catalogs ?? []) for (const entry of catalog.entries ?? []) delete entry.creature?.checks;
  return JSON.stringify(doc);
};
const fiveEText = withoutContests(read("../../docs/development/ruleset-5e-2014.example.json"));
const emberText = withoutContests(read("../../docs/examples/rulesets/ember-roads.json"));
const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return doc;
};
const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
const refusalOf = (document: unknown): string => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(!parsed.ok, "this document was supposed to be refused");
  return parsed.issues.join("; ");
};
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

const fiveE = parsedOrThrow(variant(fiveEText), "the 5e example");
const ember = parsedOrThrow(variant(emberText), "the 2d6 example");

/** Dice written down in advance. Running out is a failure, so an extra roll nobody expected is
 *  caught where it happens rather than showing up as a wrong number later. */
function dice(...faces: number[]): RulesetCombatRoller {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
}

type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
  events.filter((event): event is EventOf<T> => event.type === type);
function firstOf<T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T> {
  const found = eventsOf(events, type)[0];
  assert.ok(found, `expected a "${type}" event, got ${events.map((event) => event.type).join(", ") || "nothing"}`);
  return found;
}

// ── Hand-drawn boards ──
//
// One character per cell, so a board in this file reads as the picture it is:
//   "." plains (one cell to step onto)   "," forest (two, and it is cover)
//   "#" wall (solid)                     "~" water (solid)
//   "r" ruins (one cell, and it is cover)

const TERRAIN: Record<string, TacticalTerrain> = {
  ".": "plains",
  ",": "forest",
  "#": "wall",
  "~": "water",
  r: "ruin",
};

function drawn(...rows: string[]): TacticalGrid {
  const tiles = rows.map((row) => [...row].map((glyph) => TERRAIN[glyph] ?? assert.fail(`no terrain "${glyph}"`)));
  const width = tiles[0]!.length;
  for (const row of tiles) assert.equal(row.length, width, "every row of a drawn board is the same width");
  return { width, height: tiles.length, tiles };
}

/** A plain field, for the cases where the ground is not what is being proven. */
const open = (width: number, height: number) => drawn(...Array.from({ length: height }, () => ".".repeat(width)));

// ── The party and the opponents, on both rulesets ──

const spellEntries = [
  {
    id: "fire-bolt",
    label: "Fire Bolt",
    rows: [{ list: "spells", values: { name: "Fire Bolt", level: 0, prepared: false } }],
    mechanics: { kind: "attack", attackRoll: true, amount: { dice: "1d10" }, damageType: "fire", range: 60 },
  },
  {
    // Range 0 is self or touch: the next cell, and never a shot.
    id: "chill-grasp",
    label: "Chill Grasp",
    rows: [{ list: "spells", values: { name: "Chill Grasp", level: 0, prepared: false } }],
    mechanics: { kind: "attack", attackRoll: true, amount: { dice: "1d8" }, damageType: "cold", range: 0 },
  },
  {
    id: "fireball",
    label: "Fireball",
    rows: [{ list: "spells", values: { name: "Fireball", level: 3, prepared: true } }],
    mechanics: {
      kind: "attack",
      amount: { dice: "8d6" },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
      targetCount: 3,
      range: 150,
      area: { shape: "burst", size: 20 },
      cost: [{ pool: "slots_3", amount: 1 }],
    },
  },
  {
    id: "searing-line",
    label: "Searing Line",
    rows: [{ list: "spells", values: { name: "Searing Line", level: 2, prepared: true } }],
    mechanics: {
      kind: "attack",
      amount: { dice: "4d6" },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
      area: { shape: "line", size: 30 },
      friendlyFire: false,
      cost: [{ pool: "slots_2", amount: 1 }],
    },
  },
  {
    id: "mending-circle",
    label: "Mending Circle",
    rows: [{ list: "spells", values: { name: "Mending Circle", level: 1, prepared: true } }],
    mechanics: {
      kind: "heal",
      targets: "ally",
      amount: { dice: "1d4" },
      range: 30,
      area: { shape: "burst", size: 10 },
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
  {
    id: "scouring-breath",
    label: "Scouring Breath",
    rows: [{ list: "spells", values: { name: "Scouring Breath", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      amount: { dice: "2d6" },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
      area: { shape: "cone", size: 15 },
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
] as unknown as RulesetCatalogEntry[];
const spellRows = spellEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));
const spellCatalogs = { spells: spellEntries };

/** A fighter with a reach weapon, a thrown one and a plain one, so reach 1, reach 2 and a shot with
 *  a long distance beyond it are all one sheet's own rows. */
const fighterBuild = () =>
  build({
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    saves: { str_save: "proficient", con_save: "proficient" },
    fields: { level: 7, ac: 18, speed: 30, hp_max: 60 },
    lists: {
      attacks: [
        {
          name: "Longsword",
          ability: "str",
          proficient: true,
          bonus: 0,
          damage: "1d8",
          damage_type: "slashing",
          reach: 5,
          range: 0,
          long_range: 0,
        },
        {
          name: "Pike",
          ability: "str",
          proficient: true,
          bonus: 0,
          damage: "1d10",
          damage_type: "piercing",
          reach: 10,
          range: 0,
          long_range: 0,
        },
        {
          name: "Javelin",
          ability: "str",
          proficient: true,
          bonus: 0,
          damage: "1d6",
          damage_type: "piercing",
          reach: 5,
          range: 30,
          long_range: 120,
        },
      ],
    },
  });
const wizardBuild = () =>
  build({
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    saves: { int_save: "proficient", wis_save: "proficient" },
    fields: {
      level: 7,
      ac: 12,
      speed: 30,
      hp_max: 38,
      spellcasting_ability: "int",
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 3,
    },
    lists: { spells: spellRows },
  });

const fighter = (): RulesetCombatantInput => ({
  id: "brenna",
  name: "Brenna",
  side: "party",
  build: fighterBuild(),
  live: {},
  catalogs: {},
});
const wizard = (): RulesetCombatantInput => ({
  id: "corwin",
  name: "Corwin",
  side: "party",
  build: wizardBuild(),
  live: {},
  catalogs: spellCatalogs,
});

const snag = (id = "snag", name = "Snag"): RulesetCombatantInput => ({
  id,
  name,
  side: "enemy",
  block: {
    health: 12,
    defense: 13,
    initiativeModifier: 2,
    speed: 30,
    saves: { dex_save: 2, con_save: 0, wis_save: -1 },
    actions: [
      {
        id: "scimitar",
        name: "Scimitar",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "slashing" },
        reach: 5,
      },
    ],
  },
});
/** A pikeman: its reach is two cells, so it strikes at somebody two cells away and at somebody
 *  leaving the ring two cells out. */
const pikeman = (id = "pike", name = "Pikeman"): RulesetCombatantInput => ({
  id,
  name,
  side: "enemy",
  block: {
    health: 14,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "pike",
        name: "Pike",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 10, flat: 2, type: "piercing" },
        reach: 10,
      },
    ],
  },
});
const mote = (id = "mote", name = "Mote"): RulesetCombatantInput => ({
  id,
  name,
  side: "enemy",
  block: { health: 4, defense: 5, initiativeModifier: -2, speed: 30, actions: [] },
});

// The 2d6 system, whose people walk eight paces and swing two.
const emberKnacks = ember.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
const emberRowsFor = (list: string, ids: string[]) =>
  ids.flatMap((id) =>
    rowsFromCatalogEntry("knacks", emberKnacks.find((entry) => entry.id === id)!)
      .filter((row) => row.list === list)
      .map((row) => row.row),
  );
const emberPicked = ["road-sense", "last-ember", "coldfire-toss", "hold-the-line"];
const travellerBuild = () =>
  build({
    abilities: { brawn: 2, wits: 1, heart: 1 },
    skills: { scrap: "trained" },
    fields: { calling: "Hauler", toughness: 2 },
    lists: {
      gear: [{ name: "Road axe", notes: "Heavy, and it knows it", swing: "brawn", damage: "1d6", harm: "cut" }],
      knacks: emberRowsFor("knacks", emberPicked),
      tricks: emberRowsFor("tricks", emberPicked),
    },
  });
const traveller = (): RulesetCombatantInput => ({
  id: "juno",
  name: "Juno",
  side: "party",
  build: travellerBuild(),
  live: {},
  catalogs: { knacks: emberKnacks },
});
const emberHound = (id = "ash", name = "Ash-hound"): RulesetCombatantInput => ({
  id,
  name,
  side: "enemy",
  block: {
    health: 6,
    defense: 5,
    initiativeModifier: 0,
    speed: 12,
    actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 1, damage: { count: 1, sides: 6, flat: 0 }, reach: 2 }],
  },
});

// ── Starting a fight, with and without a board ──

interface BoardInput {
  grid: TacticalGrid;
  placements: Record<string, { x: number; y: number }>;
}
const fight = (
  definition: RulesetDefinition,
  combatants: RulesetCombatantInput[],
  initiative: number[],
  board?: BoardInput,
): RulesetEncounterState =>
  createRulesetEncounter({
    definition,
    seed: 4242,
    combatants,
    roller: dice(...initiative),
    ...(board ? { board } : {}),
  });
const act = (
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  ...faces: number[]
) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
/** A walk, and every window it opens answered by taking whatever is on offer. That is what a walk
 *  did before a window could hold it, so a test that is about the walk rather than about the asking
 *  reads exactly as it did. The dice are ONE stream across the lot: the strike's are rolled in the
 *  answer that takes it, not in the step that opened the window. */
const walkThrough = (
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  ...faces: number[]
) => {
  const roll = dice(...faces);
  let step = applyRulesetCombatChoice(definition, state, choice, roll);
  const events = [...step.events];
  for (let guard = 0; step.state.window && guard < 20; guard++) {
    const window = step.state.window;
    const asking = window.waiting[0]!;
    const option = rulesetWindowOptions(definition, step.state, asking)[0];
    step = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: asking, optionId: option?.id ?? RULESET_PASS_OPTION, targetIds: [], window: window.id },
      roll,
    );
    events.push(...step.events);
  }
  // The guard is there so a bug cannot hang the lane. Saying so is the point: without this, a walk
  // whose window never closed would come back half resolved and every assertion after it would
  // fail for a reason that has nothing to do with what it was testing.
  assert.equal(step.state.window, undefined, "a walk was still being asked about after 20 answers");
  return { state: step.state, events };
};
const who = (state: RulesetEncounterState, id: string) => {
  const combatant = rulesetCombatant(state, id);
  assert.ok(combatant, `no combatant "${id}"`);
  return combatant;
};
const optionIds = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
  rulesetCombatOptions(definition, state, id).map((option) => option.id);
const optionNamed = (definition: RulesetDefinition, state: RulesetEncounterState, id: string, label: string) => {
  const option = rulesetCombatOptions(definition, state, id).find((entry) => entry.label === label);
  assert.ok(option, `no option "${label}" for ${id}, only ${optionIds(definition, state, id).join(", ")}`);
  return option;
};
const cellsOf = (cells: Array<{ x: number; y: number }>) =>
  [...cells.map((cell) => `${cell.x},${cell.y}`)].sort((a, b) => a.localeCompare(b));

// ── The unit conversion, and its rounding ──
{
  // One cell is the smallest step there is, so anything with a number reaches at least one, and a
  // touch (zero) is one cell when it is aimed at somebody else.
  assert.equal(rulesetInCells(0, 5), 1);
  assert.equal(rulesetInCells(5, 5), 1);
  assert.equal(rulesetInCells(10, 5), 2);
  assert.equal(rulesetInCells(30, 5), 6);
  assert.equal(rulesetInCells(120, 5), 24);
  // Rounded to the nearest cell, which is the same rounding the older battle bridge already uses.
  assert.equal(rulesetInCells(7, 5), 1, "seven feet is nearer one square than two");
  assert.equal(rulesetInCells(8, 5), 2);
  // And the other system's unit, which is not feet and is not five.
  assert.equal(rulesetInCells(2, 2), 1);
  assert.equal(rulesetInCells(12, 2), 6);
  assert.equal(rulesetInCells(4, 2), 2);

  // Distance is the larger of the two axis differences, so a step corner-wise is one step.
  assert.equal(rulesetCellDistance({ x: 0, y: 0 }, { x: 0, y: 0 }), 0);
  assert.equal(rulesetCellDistance({ x: 0, y: 0 }, { x: 1, y: 1 }), 1);
  assert.equal(rulesetCellDistance({ x: 0, y: 0 }, { x: 3, y: 1 }), 3);
  assert.equal(rulesetCellDistance({ x: 4, y: 7 }, { x: 1, y: 2 }), 5);
}

// ── A movement allowance, in the ruleset's own unit ──
{
  const board = { grid: open(8, 5), placements: { brenna: { x: 0, y: 2 }, snag: { x: 6, y: 2 } } };
  const state = fight(fiveE, [fighter(), snag()], [12, 9, 9], board);
  // Thirty feet, five feet a square: six squares, rounded DOWN, and it starts full.
  assert.equal(who(state, "brenna").movement, 6);
  assert.equal(who(state, "brenna").movementLeft, 6);
  assert.equal(who(state, "snag").movement, 6);

  // Twelve paces, two a cell: six. A slower one rounds down rather than up.
  const rough = fight(ember, [traveller(), emberHound()], [3, 4, 2, 3], {
    grid: open(8, 5),
    placements: { juno: { x: 0, y: 2 }, ash: { x: 5, y: 2 } },
  });
  assert.equal(who(rough, "ash").movement, 6, "twelve paces at two a cell");
  assert.equal(who(rough, "juno").movement, 4, "the ruleset's own eight paces a turn");
  const slow = { ...who(rough, "ash"), speed: 5 };
  assert.equal(rulesetMovementAllowance(ember, ember.combat!, slow), 2, "five paces is two cells, not three");
  const crawling = { ...who(rough, "ash"), speed: 1 };
  assert.equal(rulesetMovementAllowance(ember, ember.combat!, crawling), 1, "anything that moves reaches one cell");
  const still = { ...who(rough, "ash"), speed: 0 };
  assert.equal(rulesetMovementAllowance(ember, ember.combat!, still), 0);
}

// ── Where a walk may go: terrain, walls, corners, friends and foes ──
{
  //  0 1 2 3 4
  //  . . # . .     a wall at 2,0 and 2,1, with a gap at 2,2
  //  . A # . B     A is the mover, B is an opponent
  //  . . . , .     the forest at 3,2 costs two to step onto
  const grid = drawn("..#..", "..#..", "...,.");
  const state = fight(fiveE, [fighter(), snag()], [12, 9, 9], {
    grid,
    placements: { brenna: { x: 1, y: 1 }, snag: { x: 4, y: 1 } },
  });
  const reach = rulesetReachableCells(fiveE, state, "brenna");
  const byCell = new Map(reach.map((cell) => [`${cell.x},${cell.y}`, cell]));

  assert.ok(!byCell.has("2,0"), "a wall may not be entered");
  assert.ok(!byCell.has("2,1"), "nor the one below it");
  assert.equal(byCell.get("1,0")!.cost, 1, "one step onto plains");
  assert.equal(byCell.get("0,0")!.cost, 1, "a corner step costs the same as a straight one");
  assert.equal(byCell.get("2,2")!.cost, 1, "one step corner-wise, through the gap below the wall");
  assert.equal(byCell.get("3,2")!.cost, 3, "and then the forest, which costs two to step onto");
  assert.equal(byCell.get("4,2")!.cost, 3, "and past it the cheap way, round the forest rather than through it");
  assert.ok(!byCell.has("4,1"), "nobody may be stopped on, and an opponent is standing there");

  // No cutting between two solid corners. With the gap at 2,2 filled in, the only way round is gone.
  const sealed = drawn("..#..", "..#..", "..#..");
  const walled = fight(fiveE, [fighter(), snag()], [12, 9, 9], {
    grid: sealed,
    placements: { brenna: { x: 1, y: 1 }, snag: { x: 3, y: 1 } },
  });
  assert.deepEqual(
    cellsOf(rulesetReachableCells(fiveE, walled, "brenna")),
    ["0,0", "0,1", "0,2", "1,0", "1,2"],
    "a solid column is a wall, and the far side of it is unreachable",
  );
  const corner = drawn("..#", ".#.", "...");
  const cutting = fight(fiveE, [fighter(), snag()], [12, 9, 9], {
    grid: corner,
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 2, y: 2 } },
  });
  const cut = new Map(rulesetReachableCells(fiveE, cutting, "brenna").map((cell) => [`${cell.x},${cell.y}`, cell]));
  assert.ok(!cut.has("2,0"), "the wall itself");
  assert.equal(
    cut.get("2,1")!.cost,
    3,
    "no squeezing between the two walls: two steps the short way is refused, so it goes round the bottom",
  );

  // A friend may be walked past and never stood on. An opponent is a wall.
  const line = fight(fiveE, [fighter(), wizard(), snag()], [12, 10, 9, 9], {
    grid: open(6, 1),
    placements: { brenna: { x: 0, y: 0 }, corwin: { x: 1, y: 0 }, snag: { x: 4, y: 0 } },
  });
  const past = new Map(rulesetReachableCells(fiveE, line, "brenna").map((cell) => [`${cell.x},${cell.y}`, cell]));
  assert.ok(!past.has("1,0"), "a friend's own cell is not somewhere to stop");
  assert.equal(past.get("2,0")!.cost, 2, "but the walk goes through them");
  assert.ok(!past.has("4,0"), "and an opponent's cell is not enterable at all");
  assert.ok(!past.has("5,0"), "so nothing behind them is reachable either");
}

// ── Line of sight ──
{
  const grid = drawn(".....", "..#..", ".....");
  assert.equal(rulesetLineOfSight(grid, { x: 0, y: 1 }, { x: 4, y: 1 }), false, "the wall is on the line");
  assert.equal(rulesetLineOfSight(grid, { x: 4, y: 1 }, { x: 0, y: 1 }), false, "and the other way round");
  assert.equal(rulesetLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 }), true, "a clear row");
  assert.equal(rulesetLineOfSight(grid, { x: 1, y: 1 }, { x: 2, y: 1 }), true, "the cell itself is never in the way");
  assert.equal(rulesetLineOfSight(grid, { x: 0, y: 0 }, { x: 2, y: 2 }), true, "a diagonal that misses it");
  assert.equal(
    rulesetLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 2 }),
    false,
    "and one that does not: at two across the line is exactly on the wall",
  );
}

// ── Reach one, reach two, and range with a long distance beyond it ──
{
  const board = {
    grid: open(30, 1),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 1, y: 0 }, pike: { x: 2, y: 0 }, mote: { x: 8, y: 0 } },
  };
  const state = fight(fiveE, [fighter(), snag(), pikeman(), mote()], [12, 9, 9, 8, 7], board);
  const targetsOf = (label: string) => {
    const option = optionNamed(fiveE, state, "brenna", label);
    return rulesetOptionTargets(fiveE, state, "brenna", option);
  };
  // A sword reaches one cell, a pike two, and a javelin twenty-four (120 feet) with disadvantage
  // past six (30 feet).
  assert.deepEqual(targetsOf("Longsword"), ["snag"], "one cell only");
  assert.deepEqual(targetsOf("Pike"), ["snag", "pike"], "ten feet is two cells");
  assert.deepEqual(targetsOf("Javelin"), ["snag", "pike", "mote"], "and a throw carries the length of the row");

  // Past the long distance, nobody at all.
  const far = fight(fiveE, [fighter(), mote()], [12, 9], {
    grid: open(30, 1),
    placements: { brenna: { x: 0, y: 0 }, mote: { x: 25, y: 0 } },
  });
  assert.deepEqual(rulesetOptionTargets(fiveE, far, "brenna", optionNamed(fiveE, far, "brenna", "Javelin")), []);
  // And the refusal says which rule it broke, not merely that the target was wrong.
  const refused = act(fiveE, far, {
    actorId: "brenna",
    optionId: optionNamed(fiveE, far, "brenna", "Javelin").id,
    targetIds: ["mote"],
  });
  assert.deepEqual(firstOf(refused.events, "refused").reason, "out-of-reach");
  assert.deepEqual(refused.state, far, "a refusal changes nothing at all");

  // Ember Roads swings two paces, which is one cell, through a constant rather than a column.
  const rough = fight(ember, [traveller(), emberHound(), emberHound("dust", "Dust-hound")], [3, 4, 2, 3, 2, 4], {
    grid: open(6, 1),
    placements: { juno: { x: 0, y: 0 }, ash: { x: 1, y: 0 }, dust: { x: 3, y: 0 } },
  });
  const axe = optionNamed(ember, rough, "juno", "Road axe");
  assert.deepEqual(rulesetOptionTargets(ember, rough, "juno", axe), ["ash"], "two paces is one cell");
}

// ── Long range and a foe at your elbow both make the shot harder ──
{
  const shoot = (foeAt: { x: number; y: number } | null, targetAt: number) => {
    const combatants = [fighter(), mote("far", "Far mote"), ...(foeAt ? [snag()] : [])];
    const placements: Record<string, { x: number; y: number }> = {
      brenna: { x: 0, y: 0 },
      far: { x: targetAt, y: 0 },
      ...(foeAt ? { snag: foeAt } : {}),
    };
    const state = fight(fiveE, combatants, foeAt ? [12, 9, 9] : [12, 9], { grid: open(30, 1), placements });
    const option = optionNamed(fiveE, state, "brenna", "Javelin");
    // Two 20s: one roll on a normal attack, and the pair a roll with advantage or disadvantage
    // needs. The event says which mode it was, so the dice that were kept say it too.
    return act(fiveE, state, { actorId: "brenna", optionId: option.id, targetIds: ["far"] }, 18, 3, 4).events;
  };
  assert.equal(firstOf(shoot(null, 5), "attack").mode, "normal", "inside the ordinary range and nobody near");
  assert.equal(firstOf(shoot(null, 12), "attack").mode, "disadvantage", "past thirty feet");
  assert.equal(firstOf(shoot({ x: 1, y: 0 }, 5), "attack").mode, "disadvantage", "a foe in the next square");
  // A thrown weapon is a swing in the hand and a shot beyond it: the javelin carries a reach AND a
  // range, so used on the foe in the next square neither ranged rule reads it.
  const inHand = fight(fiveE, [fighter(), snag(), mote("far", "Far mote")], [12, 9, 3], {
    grid: open(8, 1),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 1, y: 0 }, far: { x: 4, y: 0 } },
  });
  const javelin = optionNamed(fiveE, inHand, "brenna", "Javelin");
  assert.equal(
    firstOf(
      act(fiveE, inHand, { actorId: "brenna", optionId: javelin.id, targetIds: ["snag"] }, 18, 3, 4, 5, 6, 2).events,
      "attack",
    ).mode,
    "normal",
    "a javelin in the hand is swung, not thrown, so the foe holding it is not in its own way",
  );
  assert.equal(
    firstOf(
      act(fiveE, inHand, { actorId: "brenna", optionId: javelin.id, targetIds: ["far"] }, 18, 3, 4, 5, 6, 2).events,
      "attack",
    ).mode,
    "disadvantage",
    "and thrown past that same foe it is a shot with somebody at the thrower's elbow",
  );
  // And it is something to strike a passer-by with: somebody carrying nothing but a javelin still
  // swings at one going by, where somebody carrying nothing but a bow has nothing to swing.
  const carrying = (combatant: RulesetCombatant, label: string) => {
    const actions = combatant.actions.filter((action) => action.label === label);
    assert.equal(actions.length, 1, `${combatant.name} carries exactly one "${label}"`);
    return { ...combatant, actions };
  };
  assert.equal(rulesetOpportunityAttack(carrying(who(inHand, "brenna"), "Javelin"))?.label, "Javelin");
  // A spell shot across the room is not something to swing at a passer-by, and the wizard who
  // really has one proves it.
  const casting = fight(fiveE, [wizard(), snag()], [12, 9], {
    grid: open(8, 1),
    placements: { corwin: { x: 0, y: 0 }, snag: { x: 1, y: 0 } },
  });
  assert.equal(rulesetOpportunityAttack(carrying(who(casting, "corwin"), "Fire Bolt")), null);

  // A shape that comes off the caster is not a shot: a foe at the elbow makes shooting harder and
  // breathing no harder at all, so a cone with no distance of its own is rolled plainly.
  const crowded = fight(fiveE, [wizard(), snag(), mote("far", "Far mote")], [12, 9, 3], {
    grid: open(8, 1),
    placements: { corwin: { x: 0, y: 0 }, snag: { x: 1, y: 0 }, far: { x: 2, y: 0 } },
  });
  const breath = optionNamed(fiveE, crowded, "corwin", "Scouring Breath");
  assert.equal(rulesetOptionReach(crowded, "corwin", breath.id)!.shot, false);
  const thrown = optionNamed(fiveE, crowded, "corwin", "Fireball");
  assert.equal(rulesetOptionReach(crowded, "corwin", thrown.id)!.shot, true, "a ball thrown a hundred feet is");

  // A touch is not a shot either: an ability whose range is 0 reaches the next cell and no further,
  // and the foe it is laid on does not make it harder.
  const touching = fight(fiveE, [wizard(), snag(), mote("far", "Far mote")], [12, 9, 3], {
    grid: open(6, 1),
    placements: { corwin: { x: 0, y: 0 }, snag: { x: 1, y: 0 }, far: { x: 3, y: 0 } },
  });
  const grasp = optionNamed(fiveE, touching, "corwin", "Chill Grasp");
  assert.deepEqual(
    rulesetOptionTargets(fiveE, touching, "corwin", grasp),
    ["snag"],
    "a touch reaches the next cell only",
  );
  assert.equal(
    firstOf(
      act(fiveE, touching, { actorId: "corwin", optionId: grasp.id, targetIds: ["snag"] }, 15, 4).events,
      "attack",
    ).mode,
    "normal",
    "laying a hand on the foe beside you is not shooting with a foe beside you",
  );
  // The same on a creature: a range written as 0 is no range, so its bite is a swing at its reach.
  const biter = snag("biter", "Biter");
  biter.block!.actions[0] = { ...biter.block!.actions[0]!, range: 0 };
  const bitten = fight(fiveE, [fighter(), biter], [9, 12], {
    grid: open(6, 1),
    placements: { brenna: { x: 0, y: 0 }, biter: { x: 1, y: 0 } },
  });
  const bite = rulesetCombatOptions(fiveE, bitten, "biter").find((option) => option.kind === "block")!;
  assert.equal(
    firstOf(act(fiveE, bitten, { actorId: "biter", optionId: bite.id, targetIds: ["brenna"] }, 15, 3).events, "attack")
      .mode,
    "normal",
    "a creature whose range reads 0 swings, and a foe beside it changes nothing",
  );
  // A swing is not a shot, so neither rule touches it.
  const melee = fight(fiveE, [fighter(), snag()], [12, 9], {
    grid: open(6, 1),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 1, y: 0 } },
  });
  const sword = optionNamed(fiveE, melee, "brenna", "Longsword");
  assert.equal(
    firstOf(act(fiveE, melee, { actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 18, 4).events, "attack")
      .mode,
    "normal",
  );
}

// ── Cover, said out loud and added to the defense the roll is made against ──
{
  //  Brenna on plains, Snag standing in the ruins, which are worth one on the tactical table.
  const grid = drawn(".r");
  const state = fight(fiveE, [fighter(), snag()], [12, 9], {
    grid,
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 1, y: 0 } },
  });
  const sword = optionNamed(fiveE, state, "brenna", "Longsword");
  const step = act(fiveE, state, { actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 6, 4);
  const cover = firstOf(step.events, "cover");
  assert.deepEqual(cover, { type: "cover", targetId: "snag", bonus: 2, defense: 15 });
  const attack = firstOf(step.events, "attack");
  assert.equal(attack.defense, 15, "the roll was made against the covered number");
  assert.equal(attack.total, 6 + 7, "six on the die plus the sheet's own bonus");
  assert.equal(attack.outcome, "miss", "which would have hit a Snag standing in the open");
  // The forecast agrees with the roll, because both read the same number.
  const inTheOpen = fight(fiveE, [fighter(), snag()], [12, 9], {
    grid: drawn(".."),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 1, y: 0 } },
  });
  const covered = optionNamed(fiveE, state, "brenna", "Longsword").forecast!.hitChance!;
  const bare = optionNamed(fiveE, inTheOpen, "brenna", "Longsword").forecast!.hitChance!;
  assert.ok(covered < bare, "a covered target is harder to hit, and the menu says so before the roll");
  // Ember Roads declares no cover, so the same ground adds nothing.
  const rough = fight(ember, [traveller(), emberHound()], [3, 4, 2, 3], {
    grid: drawn(".r"),
    placements: { juno: { x: 0, y: 0 }, ash: { x: 1, y: 0 } },
  });
  const axe = optionNamed(ember, rough, "juno", "Road axe");
  const swing = act(ember, rough, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 4, 3, 2, 2);
  assert.equal(eventsOf(swing.events, "cover").length, 0);
  assert.equal(firstOf(swing.events, "attack").defense, who(rough, "ash").defense);
}

// ── A wall between them stops a shot and says which rule it broke ──
{
  const grid = drawn(".#.");
  const state = fight(fiveE, [fighter(), mote()], [12, 9], {
    grid,
    placements: { brenna: { x: 0, y: 0 }, mote: { x: 2, y: 0 } },
  });
  const javelin = optionNamed(fiveE, state, "brenna", "Javelin");
  assert.deepEqual(rulesetOptionTargets(fiveE, state, "brenna", javelin), [], "there is a wall in the way");
  const refused = act(fiveE, state, { actorId: "brenna", optionId: javelin.id, targetIds: ["mote"] });
  assert.equal(firstOf(refused.events, "refused").reason, "no-line-of-sight");
  assert.deepEqual(refused.state, state);
}

// ── Shapes: burst, cone and line, drawn against what they should cover ──
{
  const field = open(9, 9);
  const middle = { x: 4, y: 4 };
  // A burst is every cell within its size of the cell it was aimed at.
  assert.equal(rulesetAreaCells("burst", 1, { x: 0, y: 0 }, middle, field).length, 9, "three by three");
  assert.equal(rulesetAreaCells("burst", 2, { x: 0, y: 0 }, middle, field).length, 25, "five by five");

  // A line runs one cell wide, from the actor toward the cell it was aimed at.
  assert.deepEqual(cellsOf(rulesetAreaCells("line", 3, { x: 0, y: 4 }, { x: 8, y: 4 }, field)), ["1,4", "2,4", "3,4"]);
  assert.deepEqual(
    cellsOf(rulesetAreaCells("line", 3, { x: 0, y: 0 }, { x: 8, y: 8 }, field)),
    ["1,1", "2,2", "3,3"],
    "and corner-wise it is still one cell wide",
  );

  // A cone is as wide at each step as it is far, and the same whichever way it is aimed.
  assert.deepEqual(cellsOf(rulesetAreaCells("cone", 3, { x: 0, y: 4 }, { x: 8, y: 4 }, field)), [
    "1,4",
    "2,3",
    "2,4",
    "2,5",
    "3,3",
    "3,4",
    "3,5",
  ]);
  assert.equal(
    rulesetAreaCells("cone", 3, { x: 4, y: 0 }, { x: 4, y: 8 }, field).length,
    7,
    "pointed down, the same seven cells",
  );
  assert.equal(
    rulesetAreaCells("cone", 3, { x: 0, y: 0 }, { x: 8, y: 8 }, field).length,
    7,
    "and pointed corner-wise, the same seven again: no direction is quietly wider",
  );
  // Aimed at the cell it is standing in there is no direction, so the shape covers nothing.
  assert.deepEqual(rulesetAreaCells("cone", 3, middle, middle, field), []);

  // Nothing spreads past something solid.
  const blocked = drawn(".........", ".........", ".........", ".........", "..#......", ".........");
  assert.deepEqual(
    cellsOf(rulesetAreaCells("line", 4, { x: 0, y: 4 }, { x: 8, y: 4 }, blocked)),
    ["1,4"],
    "the line ends at the wall",
  );
  assert.ok(
    !cellsOf(rulesetAreaCells("burst", 2, { x: 0, y: 4 }, { x: 1, y: 4 }, blocked)).includes("3,4"),
    "and a burst does not spread past it either",
  );
}

// ── A shape lands on a cell, on everybody standing in it, and `targetCount` says nothing ──
{
  //  0 1 2 3 4 5
  //  . . . . . .
  //  . W B S P M    the wizard, the fighter beside them, and three opponents in a row at y=1
  const grid = open(6, 2);
  const state = fight(fiveE, [wizard(), fighter(), snag(), pikeman(), mote()], [14, 12, 9, 8, 7], {
    grid,
    placements: {
      corwin: { x: 1, y: 1 },
      brenna: { x: 2, y: 1 },
      snag: { x: 3, y: 1 },
      pike: { x: 4, y: 1 },
      mote: { x: 5, y: 1 },
    },
  });
  const fireball = optionNamed(fiveE, state, "corwin", "Fireball");
  // Twenty feet is four cells, a hundred and fifty is thirty, and the menu carries both in cells.
  assert.deepEqual(fireball.area, { shape: "burst", size: 4, range: 30 });
  assert.deepEqual(rulesetOptionTargets(fiveE, state, "corwin", fireball), [], "a shape names nobody");
  // Aimed at the far end of the row it catches every one of the five, though its own targetCount
  // says three and two of them are on the caster's own side.
  assert.deepEqual(rulesetAreaTargets(state, "corwin", fireball.id, { x: 4, y: 1 }).sort(), [
    "brenna",
    "corwin",
    "mote",
    "pike",
    "snag",
  ]);
  const aims = rulesetAimCells(state, "corwin", fireball.id);
  assert.ok(
    aims.some((aim) => aim.x === 4 && aim.y === 1 && aim.targetIds.length === 5),
    "the menu carries what every aim would catch",
  );

  // A shape that says its own side is left out leaves them out.
  const line = optionNamed(fiveE, state, "corwin", "Searing Line");
  assert.deepEqual(line.area, { shape: "line", size: 6, range: 6 });
  assert.deepEqual(rulesetAreaTargets(state, "corwin", line.id, { x: 5, y: 1 }).sort(), ["mote", "pike", "snag"]);

  // Something that mends lands only on whom its author pointed it at: the same circle drawn over
  // the same five people closes the wounds of the two friends in it and nobody else's.
  const circle = optionNamed(fiveE, state, "corwin", "Mending Circle");
  assert.equal(circle.heals, true);
  assert.deepEqual(rulesetAreaTargets(state, "corwin", circle.id, { x: 3, y: 1 }).sort(), ["brenna", "corwin"]);

  // And it really resolves on everybody it caught: one budget, one set of dice, a save each.
  const step = act(
    fiveE,
    state,
    { actorId: "corwin", optionId: fireball.id, targetIds: [], at: { x: 4, y: 1 } },
    // Eight damage dice, then a save each for the five it caught.
    ...[4, 4, 4, 4, 4, 4, 4, 4],
    18,
    2,
    2,
    2,
    2,
  );
  const area = firstOf(step.events, "area");
  assert.deepEqual(area.at, { x: 4, y: 1 });
  assert.equal(area.cells.length, 12, "a burst of four cells, cut to the board it was drawn on");
  assert.equal(eventsOf(step.events, "save").length, 5, "everybody in the cells, friend and foe");
  assert.equal(eventsOf(step.events, "damage").length, 5);
  assert.ok(
    eventsOf(step.events, "damage").some((event) => event.targetId === "corwin"),
    "a shape that does not say otherwise catches its own caster",
  );
  assert.equal(who(step.state, "corwin").budgets.action, 0, "and one budget paid for the lot");

  // A cell it may not be aimed at is refused, and changes nothing.
  const bad = act(fiveE, state, {
    actorId: "corwin",
    optionId: fireball.id,
    targetIds: [],
    at: { x: 99, y: 99 },
  });
  assert.equal(firstOf(bad.events, "refused").reason, "bad-cell");
  assert.deepEqual(bad.state, state);
  const none = act(fiveE, state, { actorId: "corwin", optionId: fireball.id, targetIds: [] });
  assert.equal(firstOf(none.events, "refused").reason, "bad-cell", "a shape without a cell is not a choice");

  // A cone, from the caster toward the cell it was aimed at, on the same board.
  const breath = optionNamed(fiveE, state, "corwin", "Scouring Breath");
  assert.deepEqual(breath.area, { shape: "cone", size: 3, range: 3 });
  assert.deepEqual(rulesetAreaTargets(state, "corwin", breath.id, { x: 4, y: 1 }).sort(), ["brenna", "pike", "snag"]);
}

// ── Where a shape may be aimed is worked out the short way, and it is the same answer ──
{
  // A wide board and a long throw: the cells a ball could be sent to are thousands, and the ones
  // worth offering are the handful around the people on it. Both ways are compared cell for cell.
  const grid = drawn(...Array.from({ length: 12 }, (_, row) => (row === 6 ? "#".repeat(24) : ".".repeat(24))));
  const state = fight(fiveE, [wizard(), fighter(), snag("a", "Snag"), snag("b", "Other Snag")], [12, 9, 8, 7], {
    grid,
    placements: { corwin: { x: 1, y: 1 }, brenna: { x: 3, y: 2 }, a: { x: 14, y: 3 }, b: { x: 15, y: 4 } },
  });
  const ball = optionNamed(fiveE, state, "corwin", "Fireball");
  const reach = rulesetOptionReach(state, "corwin", ball.id)!;
  /** Every cell of the board the shape could legally be sent to, looked at one by one. */
  const theLongWay = () => {
    const found: Array<{ x: number; y: number; targetIds: string[] }> = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (rulesetCellDistance({ x: 1, y: 1 }, { x, y }) > reach.max) continue;
        if (!rulesetAimLegal(state, "corwin", ball.id, { x, y })) continue;
        const targetIds = rulesetAreaTargets(state, "corwin", ball.id, { x, y });
        if (targetIds.length > 0) found.push({ x, y, targetIds });
      }
    }
    return found;
  };
  const sorted = (cells: Array<{ x: number; y: number; targetIds: string[] }>) =>
    [...cells]
      .sort((one, two) => one.y - two.y || one.x - two.x)
      .map((cell) => `${cell.x},${cell.y}:${[...cell.targetIds].sort().join("+")}`);
  const slow = theLongWay();
  assert.ok(slow.length > 4, "there is a real answer to compare against");
  assert.deepEqual(sorted(rulesetAimCells(state, "corwin", ball.id)), sorted(slow));
  // And a cone, which reaches out from the caster rather than landing on a spot, is unchanged.
  const cone = optionNamed(fiveE, state, "corwin", "Scouring Breath");
  const slowCone: Array<{ x: number; y: number; targetIds: string[] }> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!rulesetAimLegal(state, "corwin", cone.id, { x, y })) continue;
      const targetIds = rulesetAreaTargets(state, "corwin", cone.id, { x, y });
      if (targetIds.length > 0) slowCone.push({ x, y, targetIds });
    }
  }
  assert.deepEqual(sorted(rulesetAimCells(state, "corwin", cone.id)), sorted(slowCone));

  // And somebody on the ground is still somebody a shape is set down on: a mending circle aimed at
  // the ally who fell, far from anybody standing, is offered.
  const fallen = fight(fiveE, [wizard(), fighter(), snag("a", "Snag")], [12, 9, 8], {
    grid,
    // Far enough from everybody still standing that only her own square reaches her.
    placements: { corwin: { x: 1, y: 1 }, brenna: { x: 5, y: 5 }, a: { x: 2, y: 1 } },
  });
  Object.assign(who(fallen, "brenna"), { down: true, dying: true });
  const mend = optionNamed(fiveE, fallen, "corwin", "Mending Circle");
  const mends = rulesetAimCells(fallen, "corwin", mend.id);
  assert.ok(
    mends.some((cell) => cell.x === 5 && cell.y === 5 && cell.targetIds.includes("brenna")),
    "the square the fallen one lies on is offered, and mending her is what it catches",
  );
}

// ── A creature breathes a real shape, and spares its own pack when its entry says so ──
{
  /** A hound whose breath is a 15 foot cone that never catches another hound. */
  const breather = (id: string, name: string, at: { x: number; y: number }) => ({
    combatant: {
      id,
      name,
      side: "enemy" as const,
      block: {
        health: 12,
        defense: 11,
        initiativeModifier: 0,
        speed: 30,
        actions: [
          { id: "bite", name: "Bite", budget: "action", toHit: 3, damage: { count: 1, sides: 6, flat: 1 }, reach: 5 },
          {
            id: "breath",
            name: "Scalding Breath",
            budget: "action",
            save: { save: "dex_save", onSuccess: "half" },
            saveDifficulty: 11,
            damage: { count: 2, sides: 6, flat: 0, type: "fire" },
            area: { shape: "cone" as const, size: 15, friendlyFire: false },
          },
        ],
      },
    },
    at,
  });
  const pack = [breather("hound", "Scald Hound", { x: 0, y: 2 }), breather("mate", "Pack Mate", { x: 0, y: 3 })];
  const state = fight(fiveE, [fighter(), wizard(), ...pack.map((entry) => entry.combatant)], [4, 3, 18, 17], {
    grid: open(8, 5),
    placements: {
      brenna: { x: 2, y: 2 },
      corwin: { x: 3, y: 2 },
      ...Object.fromEntries(pack.map((entry) => [entry.combatant.id, entry.at])),
    },
  });
  const breath = optionNamed(fiveE, state, "hound", "Scalding Breath");
  // Fifteen feet is three cells of this ruleset, and a shape with no range of its own is aimed no
  // further than it draws.
  assert.deepEqual(breath.area, { shape: "cone", size: 3, range: 3 });
  assert.deepEqual(
    rulesetAreaTargets(state, "hound", breath.id, { x: 3, y: 2 }).sort(),
    ["brenna", "corwin"],
    "the cone catches both of them and never the hound beside it",
  );
  const blown = act(
    fiveE,
    state,
    { actorId: "hound", optionId: breath.id, targetIds: [], at: { x: 3, y: 2 } },
    5,
    3,
    4,
    2,
  );
  const area = firstOf(blown.events, "area");
  assert.deepEqual(area.at, { x: 3, y: 2 });
  assert.ok(area.cells.length > 1, "it landed as a shape rather than on one square");
  assert.equal(
    area.cells.some((cell) => cell.x === 0 && cell.y === 3),
    false,
    "and never on the pack mate's own square",
  );
  assert.deepEqual(
    eventsOf(blown.events, "damage")
      .map((event) => event.targetId)
      .sort(),
    ["brenna", "corwin"],
  );
  // A BALL with no distance of its own goes off where it is set down: only the creature's own cell
  // may be aimed at, where a cone with none may be aimed anywhere within the length it draws.
  const cloudy = {
    ...pack[0]!.combatant,
    id: "squid",
    name: "Ink Squid",
    block: {
      ...pack[0]!.combatant.block,
      actions: [
        {
          id: "ink",
          name: "Ink Cloud",
          budget: "action",
          save: { save: "dex_save", onSuccess: "half" },
          saveDifficulty: 11,
          damage: { count: 1, sides: 6, flat: 0, type: "poison" },
          area: { shape: "burst" as const, size: 15, friendlyFire: false },
        },
      ],
    },
  };
  const inky = fight(fiveE, [fighter(), cloudy], [4, 18], {
    grid: open(8, 5),
    placements: { brenna: { x: 2, y: 2 }, squid: { x: 0, y: 2 } },
  });
  const ink = optionNamed(fiveE, inky, "squid", "Ink Cloud");
  assert.deepEqual(ink.area, { shape: "burst", size: 3, range: 0 });
  assert.deepEqual(
    (ink.aim ?? rulesetAimCells(inky, "squid", ink.id)).map((cell) => ({ x: cell.x, y: cell.y })),
    [{ x: 0, y: 2 }],
    "the only square it may be set down on is the one the squid stands on",
  );
  assert.equal(rulesetAimLegal(inky, "squid", ink.id, { x: 2, y: 2 }), false, "and it cannot be thrown at somebody");

  // Off a board the same creature still breathes, on as many as its entry says: the old fight.
  const theatre = fight(fiveE, [fighter(), wizard(), ...pack.map((entry) => entry.combatant)], [4, 3, 18, 17]);
  const flat = optionNamed(fiveE, theatre, "hound", "Scalding Breath");
  assert.equal(flat.area, undefined, "a fight with no board draws no shapes");
}

// ── Ember Roads throws its own shape, in its own catalog's own unit ──
{
  const state = fight(ember, [traveller(), emberHound(), emberHound("dust", "Dust-hound")], [3, 4, 2, 3, 2, 4], {
    grid: open(10, 2),
    placements: { juno: { x: 0, y: 0 }, ash: { x: 5, y: 0 }, dust: { x: 6, y: 0 } },
  });
  const toss = optionNamed(ember, state, "juno", "Coldfire Toss");
  // The knacks catalog declares two paces a cell of its own: range 12 is six cells, a burst of
  // four paces is two.
  assert.deepEqual(toss.area, { shape: "burst", size: 2, range: 6 });
  assert.deepEqual(rulesetAreaTargets(state, "juno", toss.id, { x: 5, y: 0 }).sort(), ["ash", "dust"]);
}

// ── A strike made in passing keeps the same books as one made on a turn ──
{
  // A creature whose only way of striking can be used once. Spent, it threatens nobody: the menu
  // lists no one a walk past it provokes, and nothing is thrown when the walk is taken.
  const stinger: RulesetCombatantInput = {
    id: "stinger",
    name: "Stinger",
    side: "enemy",
    block: {
      health: 12,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        {
          id: "sting",
          name: "Sting",
          budget: "action",
          toHit: 4,
          damage: { count: 1, sides: 6, flat: 0, type: "piercing" },
          reach: 5,
          uses: { per: "encounter", count: 1 },
        },
      ],
    },
  };
  const board = { grid: open(7, 3), placements: { brenna: { x: 0, y: 1 }, stinger: { x: 2, y: 1 } } };
  const state = fight(fiveE, [fighter(), stinger], [12, 9], board);
  const past = { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } };
  const first = walkThrough(fiveE, state, past, 17, 4);
  assert.equal(eventsOf(first.events, "opportunity").length, 1, "the one sting it has is thrown at the passer-by");
  assert.equal(who(first.state, "stinger").uses.sting, 0, "and it is spent, exactly as it would be on its own turn");

  // A fresh round gives the reaction back, and the sting is still gone.
  const endOf = (from: RulesetEncounterState, actorId: string) =>
    act(fiveE, from, { actorId, optionId: "end-turn", targetIds: [] }).state;
  const round = endOf(endOf(first.state, "brenna"), "stinger");
  assert.equal(who(round, "stinger").budgets.reaction, 1);
  const back = optionNamed(fiveE, round, "brenna", "Move").cells!.find((cell) => cell.x === 0 && cell.y === 1);
  assert.deepEqual(back?.provokes, [], "with nothing left to strike with, it threatens nobody");
  const second = walkThrough(fiveE, round, { ...past, to: { x: 0, y: 1 } });
  assert.equal(eventsOf(second.events, "opportunity").length, 0);
}

// ── Moving, and being struck at on the way ──
{
  //    0 1 2 3 4 5 6
  //  0 . . . . . . .
  //  1 B . S . . . .     Snag reaches one cell, so the ring around 2,1 is what it strikes at
  //  2 . . . . . . .
  const board = { grid: open(7, 3), placements: { brenna: { x: 0, y: 1 }, snag: { x: 2, y: 1 } } };
  const state = fight(fiveE, [fighter(), snag()], [12, 9], board);
  const move = optionNamed(fiveE, state, "brenna", "Move");
  const cellAt = (option: typeof move, x: number, y: number) => {
    const found = option.cells!.find((cell) => cell.x === x && cell.y === y);
    assert.ok(found, `${x},${y} was supposed to be reachable`);
    return found;
  };
  assert.deepEqual(cellAt(move, 1, 1).provokes, [], "walking INTO somebody's reach and stopping provokes nothing");
  assert.deepEqual(
    cellAt(move, 5, 1).provokes,
    ["snag"],
    "the menu says who a walk would be met by before it is taken",
  );

  // Walking through the reach and out of it: struck at once, and the walk still finishes.
  const struck = walkThrough(
    fiveE,
    state,
    { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } },
    // Snag's strike: the attack roll, then its damage.
    17,
    5,
  );
  assert.deepEqual(firstOf(struck.events, "opportunity"), {
    type: "opportunity",
    actorId: "snag",
    targetId: "brenna",
    label: "Scimitar",
    budget: "reaction",
  });
  assert.equal(firstOf(struck.events, "attack").actorId, "snag");
  assert.equal(firstOf(struck.events, "damage").dealt, 7, "five on the die and the block's own two");
  assert.equal(who(struck.state, "snag").budgets.reaction, 0, "and it cost the declared budget");
  const walked = firstOf(struck.events, "move");
  assert.deepEqual(walked.from, { x: 0, y: 1 });
  assert.deepEqual(walked.to, { x: 5, y: 1 }, "the walk still finished");
  assert.equal(walked.stopped, undefined);
  assert.equal(walked.cost, 5);
  assert.equal(walked.left, 1);

  // One budget, one strike: walking back through it costs nothing more this round.
  const again = walkThrough(fiveE, struck.state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 4, y: 1 },
  });
  assert.equal(eventsOf(again.events, "opportunity").length, 0);

  // Disengaging prevents it for the rest of the turn.
  const disengaged = act(fiveE, state, { actorId: "brenna", optionId: "standard:disengage", targetIds: [] });
  const quiet = walkThrough(fiveE, disengaged.state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 5, y: 1 },
  });
  assert.equal(eventsOf(quiet.events, "opportunity").length, 0, "nobody strikes at somebody who disengaged");
  assert.deepEqual(firstOf(quiet.events, "move").to, { x: 5, y: 1 });
  for (const cell of optionNamed(fiveE, disengaged.state, "brenna", "Move").cells!) {
    assert.deepEqual(cell.provokes, [], "and the menu stops promising a strike that will not happen");
  }

  // A pikeman reaches two cells, so the ring it strikes at is two cells out.
  const pikeFight = fight(fiveE, [fighter(), pikeman()], [12, 9], {
    grid: open(8, 3),
    placements: { brenna: { x: 1, y: 1 }, pike: { x: 3, y: 1 } },
  });
  const pikeMove = optionNamed(fiveE, pikeFight, "brenna", "Move");
  assert.deepEqual(
    pikeMove.cells!.find((cell) => cell.x === 0 && cell.y === 1)!.provokes,
    ["pike"],
    "one cell further out is outside a reach of two, so leaving is leaving",
  );
  assert.deepEqual(
    pikeMove.cells!.find((cell) => cell.x === 2 && cell.y === 0)!.provokes,
    [],
    "and a step inside that ring is not",
  );

  // Ember Roads declares no opportunity budget, so nobody is ever struck at for walking.
  const rough = fight(ember, [traveller(), emberHound()], [3, 4, 2, 3], {
    grid: open(6, 1),
    placements: { juno: { x: 1, y: 0 }, ash: { x: 0, y: 0 } },
  });
  const roughMove = optionNamed(ember, rough, "juno", "Move");
  for (const cell of roughMove.cells!) assert.deepEqual(cell.provokes, [], "this system simply has no such strike");
  const strolled = act(ember, rough, {
    actorId: "juno",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 5, y: 0 },
  });
  assert.equal(eventsOf(strolled.events, "opportunity").length, 0);
  assert.deepEqual(firstOf(strolled.events, "move").to, { x: 5, y: 0 });
}

// ── The window a walk opens: asked, answered or let go, and never asked twice ──
{
  //    0 1 2 3 4 5 6
  //  1 B . S . . . .     Snag reaches one cell: stepping out of 1,1 leaves it
  const board = { grid: open(7, 3), placements: { brenna: { x: 0, y: 1 }, snag: { x: 2, y: 1 } } };
  const state = fight(fiveE, [fighter(), snag()], [12, 9], board);
  const away = { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } };

  // The walk STOPS where it stands and asks, rather than being struck at on the way.
  const held = act(fiveE, state, away);
  const window = held.state.window;
  assert.ok(window, "the walk is held open");
  assert.equal(window.kind, "reaction");
  assert.deepEqual(window.waiting, ["snag"]);
  assert.equal(window.trigger.kind, "leaves-reach");
  const step = window.trigger.kind === "leaves-reach" ? window.trigger : null;
  assert.equal(step?.moverId, "brenna");
  // The one step that did it, not the whole walk: the cells are next to each other, and the mover
  // is standing on the near one while the question is asked.
  assert.ok(
    step && Math.abs(step.from.x - step.to.x) <= 1 && Math.abs(step.from.y - step.to.y) <= 1,
    "the trigger is one step, not a whole walk",
  );
  assert.equal(eventsOf(held.events, "opportunity").length, 0, "nothing is taken for them");
  assert.equal(eventsOf(held.events, "move").length, 0, "and the walk has not finished");
  assert.deepEqual(
    { x: who(held.state, "brenna").x, y: who(held.state, "brenna").y },
    step?.from,
    "they are standing where the question was asked",
  );
  assert.deepEqual(firstOf(held.events, "window"), {
    type: "window",
    window: window.id,
    kind: "reaction",
    waiting: ["snag"],
    moverId: "brenna",
  });

  // Only the one being asked may answer, and only the window that is open.
  assert.deepEqual(
    act(fiveE, held.state, { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 6, y: 1 } })
      .events,
    [{ type: "refused", actorId: "brenna", optionId: RULESET_MOVE_OPTION, reason: "window-open" }],
    "the fight does not go on around a window",
  );
  assert.deepEqual(
    act(fiveE, held.state, { actorId: "snag", optionId: RULESET_PASS_OPTION, targetIds: [], window: "w99" }).events,
    [{ type: "refused", actorId: "snag", optionId: RULESET_PASS_OPTION, reason: "stale-window" }],
    "an answer written for a closed window buys nothing",
  );

  assert.deepEqual(
    act(fiveE, held.state, { actorId: "brenna", optionId: "end-turn", targetIds: [] }).events,
    [{ type: "refused", actorId: "brenna", optionId: "end-turn", reason: "window-open" }],
    "not even the end of the turn goes on around a window",
  );

  // The window's own menu is the one strike it may take, and taking it costs the declared budget.
  assert.deepEqual(
    rulesetWindowOptions(fiveE, held.state, "snag").map((option) => [option.id, option.budget]),
    [["scimitar", "reaction"]],
  );
  assert.deepEqual(
    rulesetWindowOptions(fiveE, held.state, "snag")[0]!.targets,
    { side: "self", count: 0 },
    "the strike lands on whoever is walking away, so there is nobody to pick",
  );
  const took = act(
    fiveE,
    held.state,
    { actorId: "snag", optionId: "scimitar", targetIds: [], window: window.id },
    17,
    5,
  );
  assert.equal(firstOf(took.events, "opportunity").targetId, "brenna");
  assert.equal(who(took.state, "snag").budgets.reaction, 0);
  assert.equal(took.state.window, undefined, "the window closed behind the answer");
  assert.deepEqual(firstOf(took.events, "move").to, { x: 5, y: 1 }, "and the walk picked up where it stopped");
  assert.equal(firstOf(took.events, "move").cost, 5, "paying for every cell it really crossed");

  // A fight saved in the middle of a walk by an Engine from before a resume said what kind it was
  // comes back as one: answering the window still finishes the walk, rather than leaving the
  // walker standing on the step they were asked about.
  {
    const saved = JSON.parse(JSON.stringify(held.state)) as RulesetEncounterState;
    delete (saved.window!.resume as { kind?: string }).kind;
    const resumed = act(fiveE, saved, {
      actorId: "snag",
      optionId: RULESET_PASS_OPTION,
      targetIds: [],
      window: saved.window!.id,
    });
    assert.equal(resumed.state.window, undefined);
    assert.deepEqual(firstOf(resumed.events, "move").to, { x: 5, y: 1 }, "an old save's walk still finishes");
  }

  // Letting it go by costs nothing and finishes the same walk.
  const let_go = act(fiveE, held.state, { actorId: "snag", optionId: RULESET_PASS_OPTION, targetIds: [], window: window.id });
  assert.deepEqual(firstOf(let_go.events, "pass"), { type: "pass", actorId: "snag", window: window.id });
  assert.equal(eventsOf(let_go.events, "opportunity").length, 0);
  assert.equal(who(let_go.state, "snag").budgets.reaction, 1, "nothing was spent");
  assert.deepEqual(firstOf(let_go.events, "move").to, { x: 5, y: 1 }, "and the walk still finished");
  assert.equal(let_go.state.window, undefined);

  // One chance each for the WHOLE walk. A wall down the middle leaves one gap, so the only way past
  // Snag leaves its reach, comes back into it and leaves again: three steps that each provoke, and
  // one question.
  //
  //    0 1 2 3 4 5 6
  //  0 . . # . . . .
  //  1 . . # . . . .
  //  2 B . S . . . .     Snag reaches one cell around 2,2
  //  3 . . # . . . .
  //  4 . . . . . . .
  const maze = {
    grid: drawn("..#....", "..#....", ".......", "..#....", "......."),
    placements: { brenna: { x: 0, y: 2 }, snag: { x: 2, y: 2 } },
  };
  const twice = fight(fiveE, [fighter(), snag()], [12, 9], maze);
  const long = act(fiveE, twice, { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 6, y: 2 } });
  const ring = (cell: RulesetCombatCell) => Math.max(Math.abs(cell.x - 2), Math.abs(cell.y - 2)) <= 1;
  const route = optionNamed(fiveE, twice, "brenna", "Move").cells!.find((cell) => cell.x === 6 && cell.y === 2)!.path!;
  const leaves = route.filter(
    (cell, index) => ring(index === 0 ? { x: 0, y: 2 } : route[index - 1]!) && !ring(cell),
  ).length;
  assert.ok(leaves >= 2, `the route must leave Snag's reach more than once, it leaves ${leaves} time(s)`);
  assert.ok(long.state.window, "the first step out of the reach asks");
  const answered = act(fiveE, long.state, {
    actorId: "snag",
    optionId: RULESET_PASS_OPTION,
    targetIds: [],
    window: long.state.window!.id,
  });
  assert.equal(answered.state.window, undefined, "and the rest of the same walk asks nobody again");
  assert.equal(eventsOf([...long.events, ...answered.events], "window").length, 1, "one question for one walk");
  assert.deepEqual(firstOf(answered.events, "move").to, { x: 6, y: 2 }, "the walk still finished");

  // What stops a SECOND asking in the same round is the budget, not the asking. Somebody else walks
  // out of the same reach on the next turn: after a strike there is nothing left to ask about, and
  // after a pass there is.
  const wren = (): RulesetCombatantInput => ({ ...fighter(), id: "wren", name: "Wren" });
  const pair = fight(fiveE, [fighter(), wren(), snag()], [12, 11, 9], {
    grid: open(7, 4),
    placements: { brenna: { x: 0, y: 1 }, wren: { x: 1, y: 2 }, snag: { x: 2, y: 1 } },
  });
  const first = act(fiveE, pair, { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } });
  assert.ok(first.state.window, "the first walk asks");
  const answerWith = (optionId: string, ...faces: number[]) =>
    act(
      fiveE,
      first.state,
      { actorId: "snag", optionId, targetIds: [], window: first.state.window!.id },
      ...faces,
    ).state;
  for (const [what, after, left, asks] of [
    ["struck", answerWith("scimitar", 17, 5), 0, false],
    ["passed", answerWith(RULESET_PASS_OPTION), 1, true],
  ] as const) {
    assert.equal(who(after, "snag").budgets.reaction, left, `${what}: the budget says so`);
    const next = act(fiveE, after, { actorId: "brenna", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(currentRulesetActor(next)?.id, "wren", `${what}: and the next turn is somebody else's`);
    const away = act(fiveE, next, { actorId: "wren", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 0, y: 3 } });
    assert.equal(
      !!away.state.window,
      asks,
      `${what}: a second walk out of the same reach is asked about only while there is something to ask`,
    );
  }
}

// ── A strike on the way that drops the mover ends the walk where they fell ──
{
  /** The same sheet, with one hit point on it: a blow on the way out is enough to stop the walk. */
  const glass = (): RulesetCombatantInput => ({
    id: "glass",
    name: "Glass",
    side: "party",
    build: build({
      abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
      fields: { level: 7, ac: 18, speed: 30, hp_max: 1 },
      lists: { attacks: [] },
    }),
    live: {},
    catalogs: {},
  });
  const board = { grid: open(6, 3), placements: { glass: { x: 1, y: 1 }, snag: { x: 0, y: 1 } } };
  const state = fight(fiveE, [glass(), snag()], [18, 9], board);
  const step = walkThrough(
    fiveE,
    state,
    { actorId: "glass", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } },
    // Snag hits, and a scimitar is more than one hit point.
    18,
    6,
  );
  const moved = firstOf(step.events, "move");
  assert.equal(moved.stopped, true);
  assert.deepEqual(moved.to, { x: 1, y: 1 }, "they never left the cell they were struck in");
  assert.deepEqual(moved.path, []);
  assert.equal(moved.cost, 0, "and none of the allowance was spent");
  assert.equal(who(step.state, "glass").down, true);
  assert.equal(who(step.state, "glass").x, 1);
  // Said once. The window path can end a fight in more than one place, and a log that printed two
  // endings would read as two fights.
  assert.equal(eventsOf(step.events, "outcome").length, 1, "the fight ends once");
}

// ── Movement is a budget: spent before, between and after, and sprinting buys it again ──
{
  const board = { grid: open(13, 1), placements: { brenna: { x: 0, y: 0 }, snag: { x: 12, y: 0 } } };
  const state = fight(fiveE, [fighter(), snag()], [12, 9], board);
  const first = act(fiveE, state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 2, y: 0 },
  });
  assert.equal(who(first.state, "brenna").movementLeft, 4);
  const swing = act(
    fiveE,
    first.state,
    { actorId: "brenna", optionId: optionNamed(fiveE, first.state, "brenna", "Javelin").id, targetIds: ["snag"] },
    // Ten squares away is past the javelin's thirty feet, so it is thrown with disadvantage: two
    // rolls, the worse kept, and then its damage.
    18,
    15,
    4,
  );
  assert.equal(firstOf(swing.events, "attack").mode, "disadvantage");
  assert.equal(who(swing.state, "brenna").movementLeft, 4, "acting costs no movement");
  const second = act(fiveE, swing.state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 6, y: 0 },
  });
  assert.equal(who(second.state, "brenna").movementLeft, 0, "and the rest is spent after");
  assert.equal(
    rulesetCombatOptions(fiveE, second.state, "brenna").some((option) => option.id === RULESET_MOVE_OPTION),
    false,
    "with nothing left there is nowhere to walk",
  );
  // A cell beyond what is left is refused, and changes nothing.
  const tooFar = act(fiveE, second.state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 7, y: 0 },
  });
  assert.equal(firstOf(tooFar.events, "refused").reason, "unreachable");
  assert.deepEqual(tooFar.state, second.state);

  // Sprinting adds the same allowance again.
  const fresh = fight(fiveE, [fighter(), snag()], [12, 9], board);
  const dashed = act(fiveE, fresh, { actorId: "brenna", optionId: "standard:dash", targetIds: [] });
  assert.equal(who(dashed.state, "brenna").movementLeft, 12, "six squares, and six more");
  const sprint = act(fiveE, dashed.state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 10, y: 0 },
  });
  assert.deepEqual(firstOf(sprint.events, "move").to, { x: 10, y: 0 });
  assert.equal(firstOf(sprint.events, "move").left, 2);

  // And the next turn starts on a full allowance again.
  const ended = act(fiveE, sprint.state, { actorId: "brenna", optionId: "end-turn", targetIds: [] });
  const round = act(fiveE, ended.state, { actorId: "snag", optionId: "end-turn", targetIds: [] });
  assert.equal(who(round.state, "brenna").movementLeft, 6);
  assert.equal(who(round.state, "brenna").movement, 6);
}

// ── Pinned in place, and getting back up ──
{
  const board = { grid: open(6, 1), placements: { juno: { x: 0, y: 0 }, ash: { x: 4, y: 0 } } };
  const state = fight(ember, [traveller(), emberHound()], [4, 3, 2, 3], board);
  assert.ok(optionIds(ember, state, "juno").includes(RULESET_MOVE_OPTION));
  // "pinned" carries both `cannot-act` and `speed-zero` on this ruleset, so a pinned traveller is
  // offered nothing but the end of their turn.
  const pinned = structuredClone(state);
  who(pinned, "juno").tracked.push({ condition: "pinned", rounds: null });
  assert.deepEqual(optionIds(ember, pinned, "juno"), ["end-turn"]);
  // And one that only stops the walking still acts.
  const stuck = parsedOrThrow(
    variant(emberText, (doc) => {
      doc.combat.conditions.push({ condition: "shaken", effects: ["speed-zero"] });
      doc.combat.conditions = doc.combat.conditions.filter(
        (entry: Record<string, any>, index: number) =>
          doc.combat.conditions.findIndex((other: Record<string, any>) => other.condition === entry.condition) ===
          index,
      );
      doc.combat.conditions.find((entry: Record<string, any>) => entry.condition === "shaken").effects = ["speed-zero"];
    }),
    "an Ember Roads whose shaken condition pins somebody",
  );
  const rooted = fight(stuck, [traveller(), emberHound()], [4, 3, 2, 3], board);
  who(rooted, "juno").tracked.push({ condition: "shaken", rounds: null });
  assert.equal(optionIds(stuck, rooted, "juno").includes(RULESET_MOVE_OPTION), false, "no walking");
  assert.ok(optionIds(stuck, rooted, "juno").length > 1, "but a turn is still a turn");

  // The other one: the 5e draft's own prone condition costs half the allowance to shake off, and
  // nothing else moves until it is gone.
  const flat = fight(fiveE, [fighter(), snag()], [12, 9], {
    grid: open(8, 1),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 7, y: 0 } },
  });
  const down = structuredClone(flat);
  who(down, "brenna").tracked.push({ condition: "prone", rounds: null });
  const menu = rulesetCombatOptions(fiveE, down, "brenna");
  const stand = menu.find((option) => option.id === RULESET_STAND_OPTION);
  assert.ok(stand, "getting up is what a positioned menu offers instead of walking");
  assert.equal(stand.movementCost, 3, "half of six");
  assert.equal(
    menu.some((option) => option.id === RULESET_MOVE_OPTION),
    false,
    "and nothing else moves until they are up",
  );
  const up = act(fiveE, down, { actorId: "brenna", optionId: RULESET_STAND_OPTION, targetIds: [] });
  assert.equal(who(up.state, "brenna").movementLeft, 3);
  assert.equal(
    firstOf(up.events, "condition").active,
    false,
    "the condition that held them down is gone from the fight and from the sheet",
  );
  assert.deepEqual(firstOf(up.events, "move").path, [], "movement spent and nowhere gone");
  assert.equal(firstOf(up.events, "move").cost, 3);
  assert.ok(rulesetCombatOptions(fiveE, up.state, "brenna").some((option) => option.id === RULESET_MOVE_OPTION));
  // And a fight with no board never offers either of them, prone or not.
  const theatre = fight(fiveE, [fighter(), snag()], [12, 9]);
  who(theatre, "brenna").tracked.push({ condition: "prone", rounds: null });
  const flatMenu = rulesetCombatOptions(fiveE, theatre, "brenna").map((option) => option.id);
  assert.equal(flatMenu.includes(RULESET_STAND_OPTION), false);
  assert.equal(flatMenu.includes(RULESET_MOVE_OPTION), false);
}

// ── The three distance condition effects, as the 5e draft already declares them ──
{
  const strike = (weapon: string, condition: string, targetAt: number, ...faces: number[]) => {
    const state = fight(fiveE, [fighter(), snag()], [12, 9], {
      grid: open(20, 1),
      placements: { brenna: { x: 0, y: 0 }, snag: { x: targetAt, y: 0 } },
    });
    who(state, "snag").tracked.push({ condition, rounds: null });
    const option = optionNamed(fiveE, state, "brenna", weapon);
    return act(fiveE, state, { actorId: "brenna", optionId: option.id, targetIds: ["snag"] }, ...faces).events;
  };
  // "prone" is adjacent-advantage and far-disadvantage on the same condition, so the same target is
  // easier from the next square and harder from four away.
  assert.equal(firstOf(strike("Longsword", "prone", 1, 12, 3, 4), "attack").mode, "advantage");
  assert.equal(firstOf(strike("Javelin", "prone", 4, 12, 3, 4), "attack").mode, "disadvantage");
  // A javelin used on somebody in the next square is SWUNG, not thrown, so the only thing the roll
  // reads there is the target being on the ground.
  assert.equal(firstOf(strike("Javelin", "prone", 1, 12, 3, 4), "attack").mode, "advantage");
  // Thrown past its ordinary range at somebody who cannot move is both at once, and the two cancel,
  // exactly as every other pair of advantage and disadvantage in this kind does.
  assert.equal(firstOf(strike("Javelin", "paralyzed", 8, 12, 4), "attack").mode, "normal");
  // "paralyzed" says a blow from the next square always tells. It also gives advantage, so the pair
  // of dice is rolled, and this ruleset's critical rolls the damage dice twice.
  const critical = firstOf(strike("Longsword", "paralyzed", 1, 12, 3, 4, 5), "attack");
  assert.equal(critical.outcome, "critical", "twelve plus seven is a hit, and being next to them makes it a critical");
  assert.equal(critical.kept, 12, "the die that was kept is still the die that fell");
  // Four squares away the same roll is an ordinary hit, because it is no longer next to them.
  assert.equal(firstOf(strike("Javelin", "paralyzed", 4, 12, 3, 4), "attack").outcome, "hit");
  // And with no board at all, none of the three says anything: this is the old fight, unchanged.
  const theatre = fight(fiveE, [fighter(), snag()], [12, 9]);
  who(theatre, "snag").tracked.push({ condition: "paralyzed", rounds: null });
  const option = optionNamed(fiveE, theatre, "brenna", "Longsword");
  const flat = act(fiveE, theatre, { actorId: "brenna", optionId: option.id, targetIds: ["snag"] }, 12, 3, 4).events;
  assert.equal(firstOf(flat, "attack").outcome, "hit", "no positions, no critical from the next square");
}

// ── A fight WITHOUT a board is the fight it always was, event for event ──
{
  /** The same scenario twice: once with no board at all, and once on a ruleset stripped of every
   *  key this slice added. Both logs are compared whole. */
  const unpositioned = parsedOrThrow(
    variant(fiveEText, (doc) => {
      for (const key of ["distance", "ranged", "cover", "opportunity"]) delete doc.combat[key];
      for (const source of doc.combat.attacks ?? []) {
        delete source.reach;
        delete source.range;
      }
    }),
    "a 5e draft that says nothing about cells",
  );
  const run = (definition: RulesetDefinition) => {
    const state = fight(definition, [fighter(), wizard(), snag(), mote()], [12, 10, 9, 8, 7]);
    const events: RulesetCombatEvent[] = [];
    let now = state;
    const step = (choice: RulesetCombatChoice, ...faces: number[]) => {
      const applied = act(definition, now, choice, ...faces);
      events.push(...applied.events);
      now = applied.state;
    };
    const sword = optionNamed(definition, state, "brenna", "Longsword");
    step({ actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 15, 5);
    step({ actorId: "brenna", optionId: "end-turn", targetIds: [] });
    const bolt = optionNamed(definition, now, "corwin", "Fire Bolt");
    step({ actorId: "corwin", optionId: bolt.id, targetIds: ["snag"] }, 14, 7, 3);
    step({ actorId: "corwin", optionId: "end-turn", targetIds: [] });
    step({ actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 17, 4);
    step({ actorId: "snag", optionId: "end-turn", targetIds: [] });
    return {
      events,
      state: now,
      menu: rulesetCombatOptions(definition, state, "brenna"),
      targets: rulesetOptionTargets(fiveE, state, "brenna", sword),
    };
  };
  const withKeys = run(fiveE);
  const without = run(unpositioned);
  assert.deepEqual(withKeys.events, without.events, "the same events, in the same order, with the same numbers");
  assert.deepEqual(
    withKeys.menu.map((option) => [option.id, option.kind, option.label, option.forecast]),
    without.menu.map((option) => [option.id, option.kind, option.label, option.forecast]),
    "the same menu, with the same forecasts",
  );
  assert.deepEqual(withKeys.targets, without.targets, "and everybody is still pointable at everybody");
  assert.equal(
    withKeys.menu.some((option) => option.kind === "move"),
    false,
    "no board, no walking",
  );
  assert.equal(withKeys.state.board, undefined);
  for (const combatant of withKeys.state.combatants) {
    assert.equal(combatant.x, undefined, `${combatant.id} stands nowhere`);
    assert.equal(combatant.movement, undefined);
  }
  // And the same on the other system.
  const roughRun = (definition: RulesetDefinition) => {
    const state = fight(definition, [traveller(), emberHound()], [3, 4, 2, 3]);
    const axe = optionNamed(definition, state, "juno", "Road axe");
    return act(definition, state, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 4, 3, 2, 2).events;
  };
  const strippedEmber = parsedOrThrow(
    variant(emberText, (doc) => {
      delete doc.combat.distance;
      delete doc.combat.economy.movement;
      for (const source of doc.combat.attacks ?? []) delete source.reach;
    }),
    "an Ember Roads that says nothing about cells",
  );
  assert.deepEqual(roughRun(ember), roughRun(strippedEmber));
}

// ── Everybody on the board, or nobody ──
{
  // One combatant with no cell and the fight stays theatre of the mind rather than half on a grid,
  // because a fight where one of them stands nowhere could answer nothing about distance.
  const half = fight(fiveE, [fighter(), snag()], [12, 9], {
    grid: open(5, 1),
    placements: { brenna: { x: 0, y: 0 } },
  } as BoardInput);
  assert.equal(half.board, undefined);
  assert.equal(who(half, "brenna").x, undefined);
  // And a cell outside the board is the same answer.
  const outside = fight(fiveE, [fighter(), snag()], [12, 9], {
    grid: open(5, 1),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 9, y: 0 } },
  });
  assert.equal(outside.board, undefined);
  // A ruleset that never says what a cell is worth ignores a board it was handed.
  const silent = parsedOrThrow(
    variant(fiveEText, (doc) => {
      for (const key of ["distance", "ranged", "cover", "opportunity"]) delete doc.combat[key];
      for (const source of doc.combat.attacks ?? []) {
        delete source.reach;
        delete source.range;
      }
    }),
    "a 5e draft that says nothing about cells",
  );
  const ignored = fight(silent, [fighter(), snag()], [12, 9], {
    grid: open(5, 1),
    placements: { brenna: { x: 0, y: 0 }, snag: { x: 4, y: 0 } },
  });
  assert.equal(ignored.board, undefined, "without a cell size there is nothing to measure a board in");
}

// ── A positioned fight is plain JSON, and a round trip continues on the same dice ──
{
  const board = { grid: drawn("..,..", "....."), placements: { brenna: { x: 0, y: 0 }, snag: { x: 4, y: 1 } } };
  const state = fight(fiveE, [fighter(), snag()], [12, 9], board);
  const carried = JSON.parse(JSON.stringify(state)) as RulesetEncounterState;
  assert.deepEqual(carried, state, "nothing in the state is a Map, a class or a function");
  const here = act(fiveE, state, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 2, y: 1 },
  });
  const there = act(fiveE, carried, {
    actorId: "brenna",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 2, y: 1 },
  });
  assert.deepEqual(here.events, there.events);
  assert.deepEqual(here.state, there.state);
}

// ── What the format refuses ──
{
  const withCombat = (edit: (combat: Record<string, any>) => void) =>
    variant(fiveEText, (doc) => edit(doc.combat as Record<string, any>));

  // A cell has to be worth something.
  assert.match(refusalOf(withCombat((combat) => (combat.distance.perCell = 0))), /greater than 0/);
  assert.match(refusalOf(withCombat((combat) => (combat.distance.perCell = -5))), /greater than 0/);

  // Everything that is measured in cells needs a cell to measure it in.
  const measured = ["ranged", "cover", "opportunity"] as const;
  for (const key of measured) {
    assert.match(
      refusalOf(
        withCombat((combat) => {
          // ONLY this key is left standing beside the missing cell size, so the refusal is its own.
          delete combat.distance;
          for (const other of measured) if (other !== key) delete combat[other];
          for (const source of combat.attacks as Array<Record<string, unknown>>) {
            delete source.reach;
            delete source.range;
          }
        }),
      ),
      /is measured in cells, so the block declares "distance" too/,
      `"${key}" without a cell size`,
    );
  }
  assert.match(
    refusalOf(
      withCombat((combat) => {
        delete combat.distance;
        delete combat.ranged;
        delete combat.cover;
        delete combat.opportunity;
        delete combat.attacks[0].range;
      }),
    ),
    /combat\.attacks\.0\.reach: "reach" is measured in cells/,
  );
  assert.match(
    refusalOf(
      withCombat((combat) => {
        delete combat.distance;
        delete combat.ranged;
        delete combat.cover;
        delete combat.opportunity;
        delete combat.attacks[0].reach;
      }),
    ),
    /combat\.attacks\.0\.range: "range" is measured in cells/,
  );

  // The budget a strike at a passer-by costs has to be one the economy declares.
  assert.match(
    refusalOf(withCombat((combat) => (combat.opportunity.budget = "instinct"))),
    /combat\.opportunity\.budget: Unknown budget "instinct"/,
  );

  // A distance read off a row names a column of that row's own list, and a number one.
  assert.match(
    refusalOf(withCombat((combat) => (combat.attacks[0].reach = { column: "nowhere" }))),
    /combat\.attacks\.0\.reach\.column: Unknown column "nowhere"/,
  );
  assert.match(
    refusalOf(withCombat((combat) => (combat.attacks[0].reach = { column: "name" }))),
    /combat\.attacks\.0\.reach\.column: Must name a number column/,
  );
  assert.match(
    refusalOf(withCombat((combat) => (combat.attacks[0].range.normal = { column: "damage" }))),
    /combat\.attacks\.0\.range\.normal\.column: Must name a number column/,
  );
  assert.match(
    refusalOf(withCombat((combat) => (combat.attacks[0].range.long = { column: "proficient" }))),
    /combat\.attacks\.0\.range\.long\.column: Must name a number column/,
  );

  // Two numbers that are both written down can be compared at import.
  assert.match(
    refusalOf(
      withCombat((combat) => {
        combat.attacks[0].range = { normal: { const: 60 }, long: { const: 30 } };
      }),
    ),
    /combat\.attacks\.0\.range\.long: The long distance is at least the ordinary one/,
  );
  // And so can a creature's own pair.
  assert.match(
    refusalOf(
      variant(fiveEText, (doc) => {
        const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.holds === "creatures");
        bestiary.entries[1].creature.actions[1].range = { normal: 30, long: 15 };
      }),
    ),
    /The long distance is at least the ordinary one/,
  );
  // A plain number is still a legal range, and so is the pair.
  assert.ok(
    parseRulesetDefinition(
      variant(fiveEText, (doc) => {
        const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.holds === "creatures");
        bestiary.entries[1].creature.actions[1].range = { normal: 15, long: 30 };
      }),
    ).ok,
  );

  // A ruleset that says nothing about cells is exactly as legal as it was.
  assert.ok(
    parseRulesetDefinition(
      withCombat((combat) => {
        delete combat.distance;
        delete combat.ranged;
        delete combat.cover;
        delete combat.opportunity;
        delete combat.attacks[0].reach;
        delete combat.attacks[0].range;
      }),
    ).ok,
  );
}

// ── Capability API 1.28 ──
{
  assert.ok(
    supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 28,
    "the host still advertises the positions seam introduced in API 1.28",
  );
}

// ── A shape far bigger than the board costs no more than the board ──
{
  const board = open(6, 4);
  const vast = rulesetAreaCells("burst", 100000, { x: 2, y: 2 }, { x: 2, y: 2 }, board);
  const wide = rulesetAreaCells("cone", 100000, { x: 0, y: 0 }, { x: 5, y: 0 }, board);
  assert.equal(vast.length, 24, "a burst that size is simply the whole board");
  assert.ok(wide.length > 0 && wide.length <= 24, "and a cone that size is what of the board it faces");
  // No clock in here: a scan that ran over the shape instead of the board would be ten thousand
  // million steps, and the lane's own timeout is what says so.
}

// ── Slice C5a: the two condition effects a board gives meaning to ──
//
// One of them keeps somebody away from whoever put it on them, and one only counts while that
// somebody is in sight. Both need cells, which is why they are proven here.
{
  /** Something that puts a condition on whoever it touches, and then stands still. */
  const holder = (id: string, condition: string): RulesetCombatantInput => ({
    id,
    name: "Holder",
    side: "enemy",
    block: {
      health: 30,
      defense: 1,
      initiativeModifier: 9,
      speed: 30,
      actions: [
        {
          id: "loom",
          name: "Loom",
          budget: "action",
          autoHit: true,
          range: 60,
          applies: [{ condition, duration: { rounds: 9 } }],
        },
      ],
    },
  });

  // A frightened character may not walk to a cell nearer to what frightened them.
  {
    const board = { grid: open(9, 3), placements: { brenna: { x: 4, y: 1 }, dread: { x: 8, y: 1 } } };
    let state = fight(fiveE, [fighter(), holder("dread", "frightened")], [1, 20], board);
    assert.equal(currentRulesetActor(state)?.id, "dread");
    const free = rulesetReachableCells(fiveE, state, "brenna").map((cell) => `${cell.x},${cell.y}`);
    assert.ok(free.includes("5,1"), "before anything is on them, they may walk towards it");
    state = act(fiveE, state, { actorId: "dread", optionId: "loom", targetIds: ["brenna"] }).state;
    state = advanceRulesetTurn(fiveE, state, dice()).state;
    assert.equal(currentRulesetActor(state)?.id, "brenna");
    const held = rulesetReachableCells(fiveE, state, "brenna").map((cell) => `${cell.x},${cell.y}`);
    assert.ok(!held.includes("5,1"), "a cell nearer to what frightened them is not offered");
    assert.ok(!held.includes("6,1"));
    assert.ok(held.includes("3,1"), "away is still away, and so is standing still");
    assert.ok(held.includes("4,0"), "and a step that keeps the same distance is fine");
    // The menu is the only place legality lives, so a walk it did not offer is refused.
    assert.deepEqual(
      act(fiveE, state, { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } }).events,
      [{ type: "refused", actorId: "brenna", optionId: RULESET_MOVE_OPTION, reason: "unreachable" }],
    );
  }

  // And the ROUTE counts, not only where it ends. A cell far enough off on the other side of what
  // frightened them could only be walked to by going straight past it, which is the same "closer"
  // the condition forbids, and the board would draw that walk.
  {
    const board = { grid: open(9, 3), placements: { brenna: { x: 0, y: 1 }, dread: { x: 2, y: 1 } } };
    let state = fight(fiveE, [fighter(), holder("dread", "frightened")], [1, 20], board);
    state = act(fiveE, state, { actorId: "dread", optionId: "loom", targetIds: ["brenna"] }).state;
    state = advanceRulesetTurn(fiveE, state, dice()).state;
    assert.equal(currentRulesetActor(state)?.id, "brenna");
    const held = rulesetReachableCells(fiveE, state, "brenna").map((cell) => `${cell.x},${cell.y}`);
    assert.ok(!held.includes("1,1"), "the step that would start the walk past them is not offered");
    assert.ok(!held.includes("4,1"), "and neither is a cell just as far off that nothing but that walk could reach");
    assert.ok(held.includes("0,0"), "a step that keeps the same distance is still fine");
    assert.deepEqual(
      act(fiveE, state, { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 1 } }).events,
      [{ type: "refused", actorId: "brenna", optionId: RULESET_MOVE_OPTION, reason: "unreachable" }],
    );
  }

  // And its effects count only while the source is in sight: a wall between them and the thing
  // that frightened them gives their own attacks back.
  {
    const grid = drawn("....#....", "....#....", ".........");
    const board = { grid, placements: { brenna: { x: 2, y: 2 }, dread: { x: 6, y: 2 }, snag: { x: 3, y: 2 } } };
    let state = fight(fiveE, [fighter(), holder("dread", "frightened"), snag()], [1, 20, 1], board);
    state = act(fiveE, state, { actorId: "dread", optionId: "loom", targetIds: ["brenna"] }).state;
    state = advanceRulesetTurn(fiveE, state, dice()).state;
    assert.equal(currentRulesetActor(state)?.id, "brenna");
    assert.ok(
      rulesetCombatConditions(fiveE, rulesetCombatant(state, "brenna")!).includes("frightened"),
      "the condition is on them either way",
    );
    const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword")!;
    const modeIn = (encounter: RulesetEncounterState) =>
      rulesetAttackMode(
        fiveE,
        fiveE.combat!,
        rulesetCombatant(encounter, "brenna")!,
        rulesetCombatant(encounter, "snag")!,
        { state: encounter, optionId: sword.id },
      );
    assert.equal(modeIn(state), "disadvantage", "in plain sight of it, their own attacks are harder");
    // The same fight with a wall between the two of them.
    const hidden = structuredClone(state);
    rulesetCombatant(hidden, "brenna")!.y = 0;
    rulesetCombatant(hidden, "dread")!.y = 0;
    assert.ok(!rulesetLineOfSight(grid, { x: 2, y: 0 }, { x: 6, y: 0 }), "the wall really is between them");
    assert.equal(modeIn(hidden), "normal", "out of its sight, only the effect the gate names goes");
    // But not everything goes with it. A fright stops you walking nearer whether or not you can see
    // what frightened you, so the effect the gate does NOT name still stands behind the wall.
    const nearer = rulesetReachableCells(fiveE, hidden, "brenna").map((cell) => `${cell.x},${cell.y}`);
    assert.ok(nearer.length > 0, "there is somewhere to walk at all");
    assert.ok(!nearer.includes("3,0"), "and it is still not a cell nearer to what frightened them");

    // And when the gate names EVERY effect the condition has, the condition itself still stands:
    // `failsSaves` and `saves` are not effects and the gate never named them, so a fright you fail
    // a save against whether or not you can see it keeps failing that save behind the wall.
    const gatedWhole = structuredClone(fiveE);
    const fright = gatedWhole.combat!.conditions!.find((entry) => entry.condition === "frightened")!;
    fright.effects = ["own-attacks-disadvantage"];
    fright.failsSaves = ["dex_save"];
    fright.whileSourceInSight = ["own-attacks-disadvantage"];
    const seen = rulesetCombatFailsSave(
      gatedWhole,
      gatedWhole.combat!,
      rulesetCombatant(state, "brenna")!,
      "dex_save",
      state,
    );
    const unseen = rulesetCombatFailsSave(
      gatedWhole,
      gatedWhole.combat!,
      rulesetCombatant(hidden, "brenna")!,
      "dex_save",
      hidden,
    );
    assert.equal(seen, true, "in sight, the condition fails that save without rolling");
    assert.equal(unseen, true, "and out of sight it still does, because the gate named no save");
  }

  // Three strikes for one spend, with a walk between them: the walk is the board's own option and
  // costs the allowance, and the budget is still spent exactly once.
  {
    const striker = (): RulesetCombatantInput => ({
      id: "vess",
      name: "Vess",
      side: "party",
      build: build({
        abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 10, cha: 10 },
        fields: { level: 1, ac: 15, speed: 30, hp_max: 20, attacks_per_action: 3 },
        lists: {
          attacks: [
            {
              name: "Rapier",
              ability: "dex",
              proficient: true,
              bonus: 0,
              damage: "1d8",
              damage_type: "piercing",
              finesse: false,
              reach: 5,
              range: 0,
              long_range: 0,
            },
          ],
        },
      }),
      live: {},
      catalogs: {},
    });
    const board = {
      grid: open(9, 3),
      placements: { vess: { x: 1, y: 1 }, snag: { x: 0, y: 1 }, pike: { x: 4, y: 1 } },
    };
    let state = fight(fiveE, [striker(), snag(), pikeman()], [20, 1, 1], board);
    let step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["snag"] }, 18, 5);
    assert.equal(firstOf(step.events, "strikes").left, 2);
    state = step.state;
    assert.equal(rulesetCombatant(state, "vess")!.budgets.action, 0, "one spend, and the walk is still free");
    // Two cells towards the pikeman, which the board offers as its own option.
    const walk = rulesetCombatOptions(fiveE, state, "vess").find((option) => option.id === RULESET_MOVE_OPTION)!;
    assert.ok(walk.cells?.some((cell) => cell.x === 3 && cell.y === 1));
    // Snag is standing next to them, so the walk is struck at on the way, as any walk would be.
    step = walkThrough(
      fiveE,
      state,
      { actorId: "vess", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 3, y: 1 } },
      1,
    );
    assert.equal(eventsOf(step.events, "opportunity").length, 1, "a walk between strikes is still a walk");
    assert.equal(firstOf(step.events, "move").stopped, undefined);
    state = step.state;
    assert.equal(rulesetCombatant(state, "vess")!.movementLeft, 4, "the walk cost the allowance and nothing else");
    assert.equal(rulesetCombatant(state, "vess")!.strikesLeft, 2, "and left the strikes alone");
    // And the next strike, at somebody else, is still free.
    const next = rulesetCombatOptions(fiveE, state, "vess").find((option) => option.id === "attack:0:0")!;
    assert.equal(next.budget, undefined);
    assert.deepEqual(rulesetOptionTargets(fiveE, state, "vess", next), ["pike"], "only what is in reach from here");
    step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["pike"] }, 18, 6);
    assert.equal(firstOf(step.events, "strikes").left, 1);
    assert.equal(rulesetCombatant(step.state, "vess")!.budgets.action, 0, "the budget was spent once for all of it");
  }

  // A rider that asks for a friend beside the target reads the board when there is one.
  {
    const feats = fiveE.catalogs!.find((catalog) => catalog.id === "feats")!.entries!;
    const slyRows = rowsFromCatalogEntry("feats", feats.find((entry) => entry.id === "sly-strike")!);
    const rogue = (): RulesetCombatantInput => ({
      id: "vess",
      name: "Vess",
      side: "party",
      build: build({
        abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 10, cha: 10 },
        fields: { level: 1, ac: 15, speed: 30, hp_max: 20 },
        lists: {
          attacks: [
            {
              name: "Rapier",
              ability: "dex",
              proficient: true,
              bonus: 0,
              damage: "1d8",
              damage_type: "piercing",
              finesse: true,
              reach: 5,
              range: 0,
              long_range: 0,
            },
          ],
          features: slyRows.filter((row) => row.list === "features").map((row) => row.row),
        },
      }),
      live: {},
      catalogs: { feats },
    });
    // The friend is across the board, so nobody is beside the target and nothing fires.
    const far = {
      grid: open(9, 3),
      placements: { vess: { x: 0, y: 1 }, brenna: { x: 8, y: 1 }, snag: { x: 1, y: 1 } },
    };
    const apart = fight(fiveE, [rogue(), fighter(), snag()], [20, 1, 1], far);
    const alone = act(fiveE, apart, { actorId: "vess", optionId: "attack:0:0", targetIds: ["snag"] }, 18, 5);
    assert.equal(eventsOf(alone.events, "rider").length, 0, "a friend eight cells away is not beside anybody");
    // One step closer for the friend, and the blow carries it.
    const near = {
      grid: open(9, 3),
      placements: { vess: { x: 0, y: 1 }, brenna: { x: 2, y: 1 }, snag: { x: 1, y: 1 } },
    };
    const beside = fight(fiveE, [rogue(), fighter(), snag()], [20, 1, 1], near);
    const carried = act(fiveE, beside, { actorId: "vess", optionId: "attack:0:0", targetIds: ["snag"] }, 18, 5, 3);
    assert.equal(eventsOf(carried.events, "rider").length, 1, "a friend in the next cell is beside them");
  }
}

console.info("game ruleset combat grid regressions passed.");
