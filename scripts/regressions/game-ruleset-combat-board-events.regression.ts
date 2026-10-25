/**
 * The board doing things on its own each round (Capability API 1.318), and growth.
 *
 *   - `board.events`: checked as handed (where, what, when); the cells a ring, a sweep, a block, a
 *     list or a spread of growth reaches each time; when each happens.
 *   - Run as the round turns, and round 1's start as the fight begins: terrain, height, light, fog, growth, a season, a block turned with
 *     whoever and whatever stands in it, a line told; whoever is left on ground nobody stands on is
 *     moved off it.
 *   - Growth is hard going and lightly obscures; a slashing blow cuts a square back with no roll,
 *     fire burns it away, and an entry or item that `clears` growth clears its area.
 *   - Painted on a world's battlefield (growth rows and events), it reaches the director's fight and
 *     view; the client draws and says it; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  checkWorldBrief,
  compileGameWorld,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseWorldKit,
  rowsFromCatalogEntry,
  rulesetBoardEventCells,
  rulesetBoardEvents,
  rulesetBoardEventTime,
  rulesetBoardShading,
  rulesetChangeGround,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLightAt,
  rulesetSheetBuildSchema,
  rulesetStandsObscured,
  supportedCapabilityApi,
  worldBattlefieldBlankRows,
  worldBattlefieldHere,
  worldBattlefieldIssues,
  worldBattlefieldMapSchema,
  worldBattlefieldEventSchema,
  type DirectedRulesetView,
  type GameWorld,
  type RulesetBoardEventInput,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetCellEnterCost } from "../../packages/shared/src/features/ruleset-combat/grid.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";
import { rulesetBoardCells, rulesetCellSentences } from "../../packages/client/src/lib/ruleset-combat-board.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-board-events-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createRulesetFight, directedRulesetView } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 318);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("burst", {
      kind: "attack",
      range: 60,
      area: { shape: "burst", size: 5 },
      amount: { flat: 4 },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
    }),
    spell("prune", { kind: "utility", range: 60, area: { shape: "box", size: 15 }, clears: "growth" }),
  ];
  const brute: RulesetStatBlock = {
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "cleaver",
        name: "Cleaver",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "slashing" },
      },
      {
        id: "club",
        name: "Club",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "bludgeoning" },
      },
      { id: "brand", name: "Brand", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2, type: "fire" } },
    ],
  } as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 12,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(12).fill("plains")),
  });
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (
    events: RulesetBoardEventInput[] = [],
    extra: Record<string, unknown> = {},
    placements: Record<string, { x: number; y: number }> = { mage: { x: 1, y: 1 }, a: { x: 5, y: 5 } },
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
      board: { grid: grid(), placements, events, ...extra } as never,
    });
    state.order = ["mage", "a"];
    state.turn = 1;
    return state;
  };
  const keys = (cells: RulesetCombatCell[] | undefined) => (cells ?? []).map((cell) => `${cell.x},${cell.y}`).sort();
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  /** To the next round: the brute's turn ends. */
  const nextRound = (state: RulesetEncounterState) => {
    state.turn = 1;
    return advanceRulesetTurn(definition, state, roll);
  };
  const ground = (state: RulesetEncounterState) => state.board?.grid.ground ?? {};
  const growing = (state: RulesetEncounterState) =>
    Object.entries(ground(state))
      .filter(([, here]) => here.growth)
      .map(([at]) => at)
      .sort();
  const seeded = (cells: string[]) => Object.fromEntries(cells.map((at) => [at, { growth: true }]));

  // ── Checked as handed ──
  {
    const kept = rulesetBoardEvents(grid(), [
      {
        at: "round-start",
        where: {
          cells: [
            { x: 1, y: 1 },
            { x: 20, y: 1 },
          ],
        },
        change: { growth: true },
      },
      { at: "round-end", where: { block: { x: 0, y: 0, w: 3, h: 2 } }, change: { rotate: 1 } },
      { at: "round-end", where: { block: { x: 0, y: 0, w: 3, h: 3 } }, change: { rotate: 1, tell: " Turns. " } },
      {
        id: "x",
        at: "round-start",
        where: { ring: { x: 5, y: 5, start: 1, step: 1 } },
        change: { terrain: "lava" as never },
      },
      {
        id: "x",
        at: "round-start",
        every: 2,
        until: 6,
        from: 3,
        where: { spread: "growth" },
        change: { growth: true },
      },
      { at: "noon" as never, where: { spread: "growth" }, change: { growth: true } },
      { at: "round-start", where: { cells: [{ x: 30, y: 30 }] }, change: { growth: true } },
    ]);
    assert.deepEqual(
      kept.map((event) => [event.id, event.at, event.from, event.every, event.until, event.change]),
      [
        ["event-1", "round-start", 2, 1, undefined, { growth: true }],
        ["event-3", "round-end", 1, 1, undefined, { rotate: 1, tell: "Turns." }],
        ["x", "round-start", 3, 2, 6, { growth: true }],
      ],
      "a rotation of no square, a terrain nobody knows, a time nobody knows and nowhere on the board are left out",
    );
    assert.deepEqual(keys((kept[0]!.where as { cells: RulesetCombatCell[] }).cells), ["1,1"]);
    assert.deepEqual(
      rulesetBoardEvents(grid(), [
        { id: "y", at: "round-start", where: { spread: "growth" }, change: { growth: true } },
        { id: "y", at: "round-end", where: { spread: "growth" }, change: { growth: true } },
      ]).map((event) => event.id),
      ["y", "y-2"],
      "a second id the same is told apart",
    );
    // When each happens.
    const every = kept[2]!;
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7].map((round) => rulesetBoardEventTime(every, "round-start", round)),
      [null, null, 0, null, 1, null, null],
    );
    assert.equal(rulesetBoardEventTime(every, "round-end", 3), null, "only at its own moment");
  }

  // ── The cells each reaches ──
  {
    const board = grid();
    const ring = { where: { ring: { x: 5, y: 5, start: 1, step: 1 } } } as const;
    assert.equal(rulesetBoardEventCells(board, ring, 0).length, 8, "those beside the cell, not the cell");
    const far = { where: { ring: { x: 5, y: 5, start: 3, step: 1 } } } as const;
    assert.equal(rulesetBoardEventCells(board, far, 0).length, 24, "only the band 3 out");
    assert.ok(!keys(rulesetBoardEventCells(board, far, 0)).includes("5,5"), "the heart left be");
    const still = { where: { ring: { x: 5, y: 5, start: 2, step: 0 } } } as const;
    assert.deepEqual(
      [0, 1].map((time) => rulesetBoardEventCells(board, still, time).length),
      [16, 16],
      "a ring that never grows is the band 2 out each time",
    );
    assert.equal(
      rulesetBoardEventCells(board, { where: { ring: { ...far.where.ring, filled: true } } }, 0).length,
      49,
      "filled is everything inside, the first time too",
    );
    assert.equal(rulesetBoardEventCells(board, ring, 1).length, 16, "the next band out");
    assert.equal(
      rulesetBoardEventCells(board, { where: { ring: { x: 5, y: 5, start: 1, step: 1, filled: true } } }, 1).length,
      25,
      "everything inside",
    );
    const sweep = { where: { sweep: { from: "north" as const, start: 0, step: 2 } } };
    assert.deepEqual([...new Set(rulesetBoardEventCells(board, sweep, 0).map((cell) => cell.y))], [0]);
    assert.deepEqual([...new Set(rulesetBoardEventCells(board, sweep, 1).map((cell) => cell.y))], [1, 2]);
    const east = { where: { sweep: { from: "east" as const, start: 0, step: 1 } } };
    assert.deepEqual([...new Set(rulesetBoardEventCells(board, east, 0).map((cell) => cell.x))], [11]);
    assert.deepEqual(keys(rulesetBoardEventCells(board, { where: { block: { x: 1, y: 2, w: 2, h: 1 } } }, 4)), [
      "1,2",
      "2,2",
    ]);
    board.ground = seeded(["3,3"]);
    board.tiles[3]![4] = "water";
    assert.deepEqual(
      keys(rulesetBoardEventCells(board, { where: { spread: "growth" } }, 0)),
      ["2,3", "3,2", "3,4"],
      "beside growth, not into water",
    );
    board.tiles[1]![1] = "forest";
    assert.deepEqual(
      keys(rulesetBoardEventCells(board, { where: { block: { x: 0, y: 0, w: 3, h: 3 } }, onlyOn: ["forest"] }, 0)),
      ["1,1"],
    );
  }

  // ── Run as the round turns ──
  {
    const state = fight(
      [
        { id: "spread", at: "round-start", where: { spread: "growth" }, change: { growth: true } },
        {
          id: "dusk",
          at: "round-end",
          where: { cells: [{ x: 8, y: 8 }] },
          change: { light: "dark", obscured: "heavy", season: "winter" },
        },
        {
          id: "dawn",
          at: "round-start",
          from: 3,
          until: 3,
          where: { cells: [{ x: 8, y: 8 }] },
          change: { light: "clear", obscured: "clear", season: null },
        },
        {
          id: "rise",
          at: "round-start",
          from: 3,
          where: { cells: [{ x: 9, y: 9 }] },
          change: { height: 2, tell: "The ground heaves." },
        },
      ],
      { ground: seeded(["0,5"]) },
    );
    assert.deepEqual(growing(state), ["0,5"], "growth as handed");
    const one = nextRound(state);
    assert.equal(one.state.round, 2);
    const said = of(one.events, "boardEvent");
    assert.deepEqual(
      said.map((event) => [event.id, event.cells]),
      [
        ["dusk", 1],
        ["spread", 3],
      ],
      "the round's end first, then the next one's start",
    );
    const roundAt = one.events.findIndex((event) => event.type === "round");
    assert.ok(
      one.events.findIndex((event) => event.type === "boardEvent" && event.id === "dusk") < roundAt &&
        one.events.findIndex((event) => event.type === "boardEvent" && event.id === "spread") > roundAt,
    );
    assert.deepEqual(growing(one.state), ["0,4", "0,5", "0,6", "1,5"]);
    assert.deepEqual(ground(one.state)["8,8"], { light: "dark", obscured: "heavy", season: "winter" });
    assert.deepEqual(one.state.board?.happened, { dusk: 1, spread: 1 });
    assert.equal(rulesetLightAt(definition, one.state, { x: 8, y: 8 }), "dark");
    assert.equal(rulesetBoardShading(definition, one.state).fog["8,8"], "heavy");
    assert.equal(
      rulesetBoardShading(definition, one.state).light["8,8"],
      "dark",
      "the board shows the cell's own light",
    );
    assert.equal(rulesetBoardShading(definition, one.state).fog["0,4"], "light", "growth lightly obscures");
    const two = nextRound(one.state);
    assert.deepEqual(
      of(two.events, "boardEvent").find((event) => event.id === "rise"),
      { type: "boardEvent", id: "rise", tell: "The ground heaves.", cells: 1 },
    );
    assert.equal(two.state.board?.grid.elevation?.[9]?.[9], 2);
    assert.equal(ground(two.state)["8,8"], undefined, "light, fog and season cleared at dawn");
  }

  // ── Ground nobody stands on, and a block turned ──
  {
    // Round 1's start is the fight's own: a board opening dark, once, and not again as round 2 starts.
    const dusk = {
      id: "dusk",
      at: "round-start" as const,
      from: 1,
      until: 1,
      where: { block: { x: 0, y: 0, w: 12, h: 10 } },
      change: { light: "dark" as const },
    };
    const opened = fight([dusk, { ...dusk, id: "later", from: undefined, until: undefined, change: { light: "dim" } }]);
    assert.equal(ground(opened)["5,5"]?.light, "dark");
    assert.deepEqual(
      of(opened.opening, "boardEvent").map((one) => one.id),
      ["dusk"],
      "a round-start event left at its default waits for round 2",
    );
    assert.deepEqual(opened.board?.happened, { dusk: 1 });
    const second = nextRound(opened);
    assert.deepEqual(second.state.board?.happened, { dusk: 1, later: 1 });
    assert.equal(ground(second.state)["5,5"]?.light, "dim");
    // Ice cracks under the brute: it is moved to the nearest open cell.
    const cracked = nextRound(
      fight([{ id: "crack", at: "round-start", where: { cells: [{ x: 5, y: 5 }] }, change: { terrain: "water" } }]),
    );
    const moved = of(cracked.events, "boardEvent")[0]!.moved;
    assert.equal(moved?.[0]?.id, "a");
    const brute = rulesetCombatant(cracked.state, "a")!;
    assert.notDeepEqual([brute.x, brute.y], [5, 5]);
    assert.equal(cracked.state.board?.grid.tiles[5]?.[5], "water");
    // The wheel turns a quarter: the brute at its top-left goes to its top-right, a prop with it,
    // and the tiles and growth too.
    const wheel = fight(
      [{ id: "wheel", at: "round-start", where: { block: { x: 4, y: 4, w: 3, h: 3 } }, change: { rotate: 1 } }],
      {
        ground: seeded(["4,6"]),
        props: [{ id: "spoke", label: "Spoke", cells: [{ x: 5, y: 4 }], health: 5, blocks: { move: true } }],
      },
      { mage: { x: 1, y: 1 }, a: { x: 4, y: 4 } },
    );
    wheel.board!.grid.tiles[4]![6] = "forest";
    const turned = nextRound(wheel);
    const spun = rulesetCombatant(turned.state, "a")!;
    assert.deepEqual([spun.x, spun.y], [6, 4], "top-left to top-right");
    assert.deepEqual(keys(turned.state.board?.props?.[0]?.cells), ["6,5"]);
    assert.equal(turned.state.board?.grid.walls?.["6,5"], 1, "the spoke's wall turns with it");
    assert.equal(turned.state.board?.grid.walls?.["5,4"], undefined);
    assert.equal(turned.state.board?.grid.tiles[6]?.[6], "forest", "top-right to bottom-right");
    assert.deepEqual(growing(turned.state), ["4,4"], "bottom-left to top-left");
    assert.deepEqual([rulesetCombatant(turned.state, "mage")!.x, rulesetCombatant(turned.state, "mage")!.y], [1, 1]);
  }

  // ── The millrace carries, the drifts blow (1.329) ──
  {
    assert.ok(supportedCapabilityApi.minor >= 324);
    // Checked as handed: a way and at most 6 squares; anything else is left out.
    const carry = rulesetBoardEvents(grid(), [
      {
        at: "round-start",
        where: { cells: [{ x: 1, y: 1 }] },
        change: { push: { toward: "south", squares: 9 }, drift: { toward: "up" as never, squares: 1 } },
      },
    ]);
    assert.deepEqual(carry[0]?.change, { push: { toward: "south", squares: 6 } });
    // The race runs east along row 5: the brute is carried 3 east, the mage beside the race is not;
    // a second race stops a step short of the mage and of a wall.
    const race = Array.from({ length: 10 }, (_, x) => ({ x, y: 5 }));
    const flowing = nextRound(
      fight(
        [{ id: "race", at: "round-start", where: { cells: race }, change: { push: { toward: "east", squares: 3 } } }],
        {},
        {
          mage: { x: 2, y: 4 },
          a: { x: 2, y: 5 },
        },
      ),
    );
    const [ran] = of(flowing.events, "boardEvent");
    assert.deepEqual(ran?.pushed, [{ id: "a", from: { x: 2, y: 5 }, to: { x: 5, y: 5 } }]);
    assert.deepEqual([rulesetCombatant(flowing.state, "a")!.x, rulesetCombatant(flowing.state, "a")!.y], [5, 5]);
    assert.deepEqual([rulesetCombatant(flowing.state, "mage")!.x, rulesetCombatant(flowing.state, "mage")!.y], [2, 4]);
    const blocked = fight(
      [{ id: "race", at: "round-start", where: { cells: race }, change: { push: { toward: "east", squares: 4 } } }],
      { props: [{ id: "weir", label: "Weir", cells: [{ x: 4, y: 5 }], health: 5, blocks: { move: true } }] },
      { mage: { x: 8, y: 8 }, a: { x: 1, y: 5 } },
    );
    const stopped = nextRound(blocked);
    assert.deepEqual(of(stopped.events, "boardEvent")[0]?.pushed?.[0]?.to, { x: 3, y: 5 }, "a step short of the weir");
    // Somebody aloft is not carried.
    const aloft = fight(
      [{ id: "race", at: "round-start", where: { cells: race }, change: { push: { toward: "east", squares: 2 } } }],
      {},
      { mage: { x: 8, y: 8 }, a: { x: 1, y: 5 } },
    );
    rulesetCombatant(aloft, "a")!.altitude = 10;
    assert.equal(of(nextRound(aloft).events, "boardEvent")[0]?.pushed, undefined);
    // The drifts: heavy fog in a 4-wide block blown 3 east comes back in at the block's west side.
    const leaves = fight(
      [
        {
          id: "wind",
          at: "round-start",
          where: { block: { x: 0, y: 0, w: 4, h: 2 } },
          change: { drift: { toward: "east", squares: 3 } },
        },
      ],
      {
        ground: {
          "0,0": { obscured: "heavy" },
          "2,1": { obscured: "light", growth: true },
          "6,0": { obscured: "heavy" },
        },
      },
      { mage: { x: 8, y: 8 }, a: { x: 5, y: 5 } },
    );
    const blown = ground(nextRound(leaves).state);
    assert.equal(blown["3,0"]?.obscured, "heavy");
    assert.equal(blown["0,0"]?.obscured, undefined);
    assert.equal(blown["1,1"]?.obscured, "light", "2 + 3 comes back in at 1");
    assert.equal(blown["2,1"]?.growth, true, "the growth stays");
    assert.equal(blown["2,1"]?.obscured, undefined);
    assert.equal(blown["6,0"]?.obscured, "heavy", "outside the block, nothing blows");
    // Painted on a battlefield, and checked.
    const painted = {
      id: "e1",
      at: "round-start",
      where: { cells: [{ x: 0, y: 0 }] },
      change: { push: { toward: "west", squares: 2 } },
    };
    assert.ok(worldBattlefieldEventSchema.safeParse(painted).success);
    assert.equal(
      worldBattlefieldEventSchema.safeParse({ ...painted, change: { drift: { toward: "west", squares: 7 } } }).success,
      false,
    );
  }

  // ── Growth: hard going, lightly obscuring, cut, burnt, cleared ──
  {
    d20 = 15;
    const state = fight([], { ground: seeded(["5,4", "4,5", "9,9"]) });
    const board = state.board!.grid;
    assert.equal(rulesetCellEnterCost(board, 5, 4), 2);
    assert.equal(rulesetCellEnterCost(board, 6, 4), 1);
    board.tiles[4]![5] = "forest";
    assert.equal(rulesetCellEnterCost(board, 5, 4), 2, "does not make hard going harder");
    board.tiles[4]![5] = "plains";
    rulesetCombatant(state, "a")!.x = 4;
    assert.equal(rulesetStandsObscured(state, rulesetCombatant(state, "a")!), true, "standing in growth");
    rulesetCombatant(state, "a")!.x = 5;
    assert.equal(rulesetStandsObscured(state, rulesetCombatant(state, "a")!), false);
    // A cleaver may cut the squares it reaches; a club may not.
    const options = rulesetCombatOptions(definition, state, "a");
    assert.deepEqual(keys(options.find((one) => one.label === "Cleaver")!.walls), ["4,5", "5,4"]);
    assert.equal(options.find((one) => one.label === "Club")!.walls, undefined);
    const cut = applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "a",
        optionId: options.find((one) => one.label === "Cleaver")!.id,
        targetIds: [],
        wall: { x: 5, y: 4 },
      },
      roll,
    );
    assert.equal(
      cut.events.find((event) => event.type === "refused"),
      undefined,
      JSON.stringify(cut.events),
    );
    assert.deepEqual(of(cut.events, "growth"), [
      { type: "growth", actorId: "a", label: "Cleaver", cells: 1, by: "cut" },
    ]);
    assert.equal(of(cut.events, "attack").length, 0, "no roll");
    assert.deepEqual(growing(cut.state), ["4,5", "9,9"]);
    assert.equal(rulesetCombatant(cut.state, "a")!.budgets.action, 0, "the action is spent");
    // Fire on somebody standing in growth burns it away.
    const burning = fight([], { ground: seeded(["1,1", "2,2"]) });
    const brand = rulesetCombatOptions(definition, burning, "a").find((one) => one.label === "Brand")!;
    rulesetCombatant(burning, "a")!.x = 2;
    rulesetCombatant(burning, "a")!.y = 2;
    const burnt = applyRulesetCombatChoice(
      definition,
      burning,
      { actorId: "a", optionId: brand.id, targetIds: ["mage"] },
      roll,
    );
    assert.deepEqual(
      of(burnt.events, "growth").map((event) => [event.by, event.cells]),
      [["burnt", 1]],
    );
    assert.deepEqual(growing(burnt.state), ["2,2"]);
    // A fire burst with nobody in it burns it all the same; a prune clears a 15-foot square.
    const field = fight([], { ground: seeded(["8,8", "8,9", "10,2", "11,2", "11,3", "0,9"]) });
    field.turn = 0;
    const cast = (state: RulesetEncounterState, label: string, at: RulesetCombatCell) => {
      rulesetCombatant(state, "mage")!.budgets.action = 1;
      const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label)!;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: option.id, targetIds: [], at },
        roll,
      );
      assert.equal(
        step.events.find((event) => event.type === "refused"),
        undefined,
        JSON.stringify(step.events),
      );
      return step;
    };
    const fired = cast(field, "Burst", { x: 8, y: 8 });
    assert.deepEqual(
      of(fired.events, "growth").map((event) => [event.by, event.cells]),
      [["burnt", 2]],
    );
    const pruned = cast(fired.state, "Prune", { x: 10, y: 2 });
    assert.deepEqual(
      of(pruned.events, "growth").map((event) => [event.by, event.cells, event.label]),
      [["cleared", 3, "Prune"]],
    );
    assert.deepEqual(growing(pruned.state), ["0,9"]);
    // A board that says otherwise: cold burns it, piercing cuts it.
    const odd = fight([], { ground: seeded(["5,4"]), growth: { burnedBy: ["Cold"], cutBy: ["piercing"] } });
    assert.deepEqual(odd.board?.growth, { burnedBy: ["cold"], cutBy: ["piercing"] });
    assert.equal(rulesetCombatOptions(definition, odd, "a").find((one) => one.label === "Cleaver")!.walls, undefined);
  }

  // ── Read from a ruleset: `clears` needs an area; on an item's use too; the gate ──
  const shears = (use: Record<string, unknown>) =>
    fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "shears",
            label: "Shears",
            item: { category: "gear", use: { kind: "utility", budget: "action", ...use } },
          },
        ],
      });
    });
  {
    parsed(shears({ range: 5, area: { shape: "box", size: 15 }, clears: "growth" }));
    const flat = parseRulesetDefinition(shears({ range: 5, clears: "growth" }));
    assert.ok(
      !flat.ok && flat.issues.some((issue) => issue.includes('"clears" takes growth off the cells of an area')),
    );
    const entry = parseRulesetDefinition(
      fiveE((doc) =>
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [{ id: "p", label: "P", rows: [], mechanics: { kind: "utility", range: 30, clears: "growth" } }],
        }),
      ),
    );
    assert.ok(
      !entry.ok && entry.issues.some((issue) => issue.includes('"clears" takes growth off the cells of an area')),
    );
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset with an entry or an item use that clears growth requires schemaVersion 2 and capabilityApi 1.318 or newer";
    const doc = shears({ range: 5, area: { shape: "box", size: 15 }, clears: "growth" });
    assert.equal(getCapabilityPackageInstallIssue(manifest(317) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(318) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(317) as never, fiveE()), gate);
  }

  // ── Painted on a world's battlefield: the director's fight and its view, drawn and said ──
  {
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
    const rows = worldBattlefieldBlankRows("small");
    const growth = rows.map((row, y) => (y === 2 ? `g${".".repeat(row.length - 1)}` : ".".repeat(row.length)));
    const map = worldBattlefieldMapSchema.parse({
      id: "b1",
      name: "Orchard",
      place: start,
      size: "small",
      scene: "forest",
      rows,
      growth,
      events: [
        {
          id: "e1",
          label: "The orchard grows",
          at: "round-start",
          where: { spread: "growth" },
          change: { growth: true },
        },
      ],
      // What standing in its light does (1.319) is carried along too.
      lightRule: { rounds: 2, tracks: [{ track: "exhaustion", by: 1 }] },
    });
    assert.deepEqual(worldBattlefieldIssues(map), []);
    assert.deepEqual(worldBattlefieldIssues({ ...map, growth: ["g"] }), [
      "Its growth rows are not the shape of its tiles",
    ]);
    assert.deepEqual(worldBattlefieldIssues({ ...map, events: [map.events![0]!, map.events![0]!] }), [
      "Two board events are numbered e1",
    ]);
    assert.equal(
      worldBattlefieldMapSchema.safeParse({
        ...map,
        events: [{ id: "e1", at: "round-start", where: { block: { x: 0, y: 0, w: 2, h: 3 } }, change: { rotate: 1 } }],
      }).success,
      false,
      "only a square block turns",
    );
    assert.equal(
      worldBattlefieldMapSchema.safeParse({
        ...map,
        events: [{ id: "e1", at: "round-start", where: { spread: "growth" }, change: {} }],
      }).success,
      false,
      "an event changes something",
    );
    const made = worldBattlefieldHere({ ...bare, edits: { battlefields: [map] } as GameWorld["edits"] }, start, 1)!;
    assert.deepEqual(made.growth, [{ x: 0, y: 2 }]);
    assert.deepEqual(made.lightRule, { rounds: 2, tracks: [{ track: "exhaustion", by: 1 }] });
    assert.equal(made.events?.[0]?.id, "e1");
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
      made: { ...made, seasons: { "1,1": "winter" } },
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const encounter = (built as { fight: { encounter: RulesetEncounterState } }).fight.encounter;
    assert.deepEqual(encounter.board?.grid.ground, { "0,2": { growth: true }, "1,1": { season: "winter" } });
    assert.equal(encounter.board?.events?.[0]?.from, 2);
    const view = directedRulesetView(definition, {
      style: "ruleset",
      rulesetFight: { encounter, events: [], eventSeq: 0, controllers: {}, live: {}, adjustments: [] },
    } as never) as DirectedRulesetView;
    assert.deepEqual(view.grid?.ground, { "0,2": { growth: true }, "1,1": { season: "winter" } });
    const t = ((key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ""}`) as never;
    const cells = rulesetBoardCells(view, null);
    const at = (x: number, y: number) => cells.find((cell) => cell.x === x && cell.y === y)!;
    assert.equal(at(0, 2).growth, true);
    assert.equal(at(1, 2).growth, undefined);
    assert.equal(at(1, 1).season, "winter");
    assert.ok(rulesetCellSentences(at(0, 2), view, t).includes("game.combat.ruleset.board.growth"));
    assert.ok(rulesetCellSentences(at(1, 1), view, t).includes('game.combat.ruleset.board.season{"season":"winter"}'));
    const plain = createRulesetFight({
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
      made: { ...made, growth: undefined, events: undefined },
    } as never) as { fight: { encounter: RulesetEncounterState } };
    assert.equal(plain.fight.encounter.board?.grid.ground, undefined);
    assert.equal(plain.fight.encounter.board?.events, undefined);
  }

  // ── Features asked for that cannot all stand keep those that can, the first said first (laptop
  //    playtest 2026-10-25: forest and mountain both laid east left a fight unstartable) ──
  {
    const features = [
      { terrain: "forest", placement: "center", shape: "patch" },
      { terrain: "wall", placement: "center", shape: "barrier" },
    ];
    const seeded = (battlefield: unknown) =>
      createRulesetFight({
        definition,
        seed: 13,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "x", name: "X" }],
        bestiary: {},
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
        playerName: null,
        live: {},
        items: () => [],
        partyCatalogs: {},
        positioned: true,
        environment: "plains",
        battlefield,
      } as never);
    const both = seeded({ features });
    assert.ok(both.ok, both.ok ? "" : (both as { error: string }).error);
    const first = seeded({ features: [features[0]] });
    assert.ok(first.ok);
    const grid = (built: typeof both) =>
      JSON.stringify((built as { fight: { encounter: RulesetEncounterState } }).fight.encounter.board?.grid.tiles);
    assert.equal(grid(both), grid(first), "the forest stands, and the wall that cannot is left out");
  }

  // ── Only cells on the board change ──
  {
    const state = fight();
    const before = JSON.stringify(state.board!.grid);
    const off = [
      { x: -1, y: 0 },
      { x: 12, y: 0 },
      { x: 0, y: 10 },
      { x: 1.5, y: 0 },
      { x: "__proto__", y: 0 },
      { x: 0, y: "__proto__" },
    ] as unknown as RulesetCombatCell[];
    rulesetChangeGround(state, off, { terrain: "water", height: 2, light: "dark" });
    assert.equal(JSON.stringify(state.board!.grid), before, "nothing off the board changes");
    rulesetChangeGround(state, [{ x: 0, y: 0 }], { terrain: "water" });
    assert.equal(state.board!.grid.tiles[0]![0], "water", "a cell on the board still changes");
  }

  console.log(
    "Board events: rings, sweeps, blocks and spreading growth each round; terrain, light, fog, seasons and a turning wheel; growth cut, burnt and cleared; asked-for features that clash keep those that can; painted, shown and gated.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
