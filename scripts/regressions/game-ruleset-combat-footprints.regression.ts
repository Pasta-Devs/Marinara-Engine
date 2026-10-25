/**
 * Creatures that fill more than one cell (Capability API 1.194).
 *
 *   - A size's `cells`: a Large ogre fills two cells a side, its own cell the top-left one.
 *   - Set down where all of it fits, the nearest such place, and anybody asked to stand inside it
 *     steps aside.
 *   - Reach, range and adjacency run to and from the nearest cell it fills.
 *   - It walks only where all of it fits, and nobody walks through any of it.
 *   - An area catches it when any of its cells is inside; a push moves the whole of it.
 *   - It is seen from, and sees with, whichever of its cells is clear; cover is the least of its cells.
 *   - The board draws it once across its cells; the import refusals and the install gate.
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
  rulesetActiveConditions,
  rulesetAimLegal,
  rulesetAimedCells,
  rulesetAreaTargets,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCoverBonus,
  rulesetFootprint,
  rulesetGap,
  rulesetOptionTargets,
  rulesetPushPath,
  rulesetReachableCells,
  rulesetSees,
  rulesetSheetBuildSchema,
  rulesetTargetRefusal,
  rulesetThreateningEnemies,
  rulesetZoneCells,
  rulesetZoneOccupants,
  rulesetStepLeavesReach,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-footprints-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { directedRulesetView, rulesetClosingMove, rulesetWalkableCells } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { rulesetBoardCells } = await import("../../packages/client/src/lib/ruleset-combat-board.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 189);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const sizes = {
    order: [
      { id: "small", label: "Small" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large", cells: 2 },
      { id: "huge", label: "Huge", cells: 3 },
    ],
    default: "medium",
  };
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.combat.sizes = sizes;
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 40 },
  });
  const sword = {
    name: "Sword",
    quantity: 1,
    worn: true,
    item: {
      category: "gear",
      slots: { hands: 1 },
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
      },
    } as RulesetCatalogItem,
  } as RulesetSheetItem;
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 5,
      initiativeModifier: -20,
      speed: 30,
      actions: [{ id: "club", name: "Club", budget: "action", toHit: 5, damage: { count: 1, sides: 4, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  const grid = (edit: (tiles: string[][]) => void = () => {}): TacticalGrid => {
    const tiles = Array.from({ length: 12 }, () => Array(12).fill("plains"));
    edit(tiles);
    return { width: 12, height: 12, tiles } as TacticalGrid;
  };
  const roller = (sides: number) => (sides === 20 ? 15 : 2);
  const fight = (
    placements: Record<string, { x: number; y: number }>,
    foes: Record<string, Partial<RulesetStatBlock>> = { ogre: { size: "large" } },
    board = grid(),
  ) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, items: [sword] },
        ...Object.entries(foes).map(([id, extra]) => ({ id, name: id, side: "enemy" as const, block: block(extra) })),
      ],
      board: { grid: board, placements },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, actor: string, label: string) =>
    rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
  const targetsOf = (state: RulesetEncounterState, actor: string, label: string) => {
    state.turn = state.order.indexOf(actor);
    const option = optionOf(state, actor, label);
    return option ? rulesetOptionTargets(definition, state, actor, option).sort() : [];
  };
  const keys = (cells: Array<{ x: number; y: number }>) => cells.map((cell) => `${cell.x},${cell.y}`).sort();

  // ── Placement ──
  {
    const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
    assert.equal(who(state, "ogre").span, 2);
    assert.equal(who(state, "hero").span, undefined, "one cell says nothing");
    assert.deepEqual(keys(rulesetFootprint(who(state, "ogre"))), ["5,5", "5,6", "6,5", "6,6"]);
    // At the board's edge it is set back onto it, and off a wall onto open ground.
    const edge = fight({ hero: { x: 0, y: 0 }, ogre: { x: 11, y: 11 } });
    assert.deepEqual([who(edge, "ogre").x, who(edge, "ogre").y], [10, 10]);
    const walled = fight(
      { hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } },
      undefined,
      grid((tiles) => (tiles[6]![6] = "wall")),
    );
    assert.ok(
      rulesetFootprint(who(walled, "ogre")).every((cell) => walled.board!.grid.tiles[cell.y]![cell.x] !== "wall"),
    );
    assert.equal(rulesetGap(who(walled, "ogre"), { x: 5, y: 5 } as never), 0, "as near as it can");
    // Somebody asked to stand inside it steps aside; two of one cell are left where they asked.
    const crowded = fight({ hero: { x: 6, y: 6 }, ogre: { x: 5, y: 5 } });
    assert.ok(
      !rulesetFootprint(who(crowded, "ogre")).some(
        (cell) => cell.x === who(crowded, "hero").x && cell.y === who(crowded, "hero").y,
      ),
    );
    assert.deepEqual([who(crowded, "ogre").x, who(crowded, "ogre").y], [5, 5], "the big one keeps its place");
    assert.equal(rulesetGap(who(crowded, "hero"), who(crowded, "ogre")), 1, "the nearest open cell");
    // A Huge one, three a side.
    const giant = fight({ hero: { x: 0, y: 0 }, giant: { x: 4, y: 4 } }, { giant: { size: "huge" } });
    assert.equal(rulesetFootprint(who(giant, "giant")).length, 9);
    // A size with no cells, or no size, fills one.
    const goblin = fight({ hero: { x: 0, y: 0 }, goblin: { x: 4, y: 4 } }, { goblin: { size: "small" } });
    assert.deepEqual(rulesetFootprint(who(goblin, "goblin")), [{ x: 4, y: 4 }]);
  }

  // ── Reach and adjacency to the nearest cell ──
  {
    // The ogre fills 5-6 by 5-6: beside its far corner is beside it.
    assert.deepEqual(targetsOf(fight({ hero: { x: 7, y: 7 }, ogre: { x: 5, y: 5 } }), "hero", "Sword"), ["ogre"]);
    assert.deepEqual(targetsOf(fight({ hero: { x: 7, y: 5 }, ogre: { x: 5, y: 5 } }), "hero", "Sword"), ["ogre"]);
    assert.deepEqual(targetsOf(fight({ hero: { x: 8, y: 5 }, ogre: { x: 5, y: 5 } }), "hero", "Sword"), []);
    // And its own club reaches from its far cells too.
    assert.deepEqual(targetsOf(fight({ hero: { x: 7, y: 7 }, ogre: { x: 5, y: 5 } }), "ogre", "Club"), ["hero"]);
    // A blow lands.
    const state = fight({ hero: { x: 7, y: 6 }, ogre: { x: 5, y: 5 } });
    who(state, "hero").budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, "hero", "Sword")!.id, targetIds: ["ogre"] },
      roller,
    );
    assert.ok(step.events.some((one) => one.type === "damage" && one.targetId === "ogre"));
  }

  // ── Walking: all of it fits, and nobody walks through any of it ──
  {
    const state = fight({ hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 } });
    const heroCells = keys(rulesetReachableCells(definition, state, "hero"));
    for (const cell of ["5,5", "5,6", "6,5", "6,6"]) assert.ok(!heroCells.includes(cell), `never into ${cell}`);
    // Beside any of it is somewhere to stop.
    assert.ok(heroCells.includes("4,6") && heroCells.includes("5,4"));
    // The ogre itself: never where any of it would stand on the hero or a wall.
    const walled = fight(
      { hero: { x: 8, y: 5 }, ogre: { x: 5, y: 5 } },
      undefined,
      grid((tiles) => (tiles[8]![5] = "wall")),
    );
    walled.turn = walled.order.indexOf("ogre");
    who(walled, "ogre").movementLeft = 6;
    const ogreCells = keys(rulesetReachableCells(definition, walled, "ogre"));
    assert.ok(!ogreCells.includes("7,5"), "its right half would stand on the hero");
    assert.ok(!ogreCells.includes("5,7"), "its lower half would stand in the wall");
    assert.ok(!ogreCells.includes("11,5"), "its right half would be off the board");
    assert.ok(ogreCells.includes("4,5") && ogreCells.includes("5,4"));
    // Walking it, it ends with all of it there.
    const walk = rulesetCombatOptions(definition, walled, "ogre").find((one) => one.kind === "move")!;
    const moved = applyRulesetCombatChoice(
      definition,
      walled,
      { actorId: "ogre", optionId: walk.id, targetIds: [], to: { x: 4, y: 4 } },
      roller,
    );
    assert.deepEqual(keys(rulesetFootprint(rulesetCombatant(moved.state, "ogre"))), ["4,4", "4,5", "5,4", "5,5"]);
  }

  // ── Leaving its reach is measured from all of it ──
  {
    const state = fight({ hero: { x: 7, y: 6 }, ogre: { x: 5, y: 5 } });
    const threat = rulesetThreateningEnemies(definition, definition.combat!, state, who(state, "hero")).find(
      (one) => one.combatant.id === "ogre",
    )!;
    assert.ok(threat, "the ogre threatens");
    assert.equal(rulesetStepLeavesReach(threat, { x: 7, y: 6 }, { x: 7, y: 7 }), false, "still beside it");
    assert.equal(rulesetStepLeavesReach(threat, { x: 7, y: 7 }, { x: 8, y: 8 }), true, "away from it");
  }

  // ── Areas catch any cell; pushes move the whole of it ──
  {
    const state = fight({ hero: { x: 1, y: 6 }, ogre: { x: 5, y: 5 } });
    who(state, "hero").actions.push({
      id: "burst",
      label: "Burst",
      kind: "ability",
      budget: "action",
      targets: { side: "enemy", count: 0 },
      range: { normal: 12 },
      area: { shape: "burst", size: 1 },
      damage: { count: 1, sides: 4, flat: 0 },
    } as never);
    // Aimed beyond its far corner, so only that corner is inside.
    assert.deepEqual(rulesetAreaTargets(state, "hero", "burst", { x: 7, y: 7 }), ["ogre"]);
    assert.deepEqual(rulesetAreaTargets(state, "hero", "burst", { x: 8, y: 8 }), []);
    // Shoved east, every cell of it moves, and a wall stops the whole of it.
    const shoved = fight({ hero: { x: 4, y: 5 }, ogre: { x: 5, y: 5 } });
    assert.deepEqual(rulesetPushPath(shoved, "hero", "ogre", 2), [
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ]);
    const stopped = fight(
      { hero: { x: 4, y: 5 }, ogre: { x: 5, y: 5 } },
      undefined,
      grid((tiles) => (tiles[6]![8] = "wall")),
    );
    assert.deepEqual(rulesetPushPath(stopped, "hero", "ogre", 3), [{ x: 6, y: 5 }], "its lower half meets the wall");
    // Contest push lands it there.
    const contested = fight({ hero: { x: 4, y: 5 }, ogre: { x: 5, y: 5 } });
    who(contested, "hero").budgets.action = 1;
    const events: RulesetCombatEvent[] = applyRulesetCombatChoice(
      definition,
      contested,
      { actorId: "hero", optionId: "contest:shove_away", targetIds: ["ogre"] },
      (sides) => (sides === 20 ? 20 : 1),
    ).events;
    const push = events.find((one) => one.type === "pushed");
    assert.ok(push && push.type === "pushed", JSON.stringify(events));
  }

  // ── Sight and cover from whichever cell is clearest ──
  {
    // A wall in front of its top-left cell only: the hero still sees it, and it is not hidden.
    const board = grid((tiles) => (tiles[5]![3] = "wall"));
    const state = fight({ hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 } }, undefined, board);
    assert.ok(rulesetSees(state, who(state, "hero"), who(state, "ogre")));
    assert.ok(rulesetSees(state, who(state, "ogre"), who(state, "hero")));
    assert.deepEqual(targetsOf(state, "ogre", "Club").length, 0, "out of reach");
    // Walled off entirely, nobody sees anybody.
    const walled = fight(
      { hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 } },
      undefined,
      grid((tiles) => tiles.forEach((row) => (row[3] = "wall"))),
    );
    assert.equal(rulesetSees(walled, who(walled, "hero"), who(walled, "ogre")), false);
    // Cover: half cover screening one of its cells is no cover when another is clear.
    const covered = parse(
      document((doc) => {
        doc.combat.cover = { bonus: 2, creatures: true };
      }),
    );
    const screened = createRulesetEncounter({
      definition: covered,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build },
        { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large" }) },
        { id: "imp", name: "imp", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 }, imp: { x: 3, y: 5 } } },
    });
    const from = { x: 0, y: 5 };
    assert.equal(rulesetCoverBonus(covered.combat!, screened, who(screened, "ogre"), from, "attack", "hero"), 0);
    who(screened, "ogre").span = undefined;
    assert.equal(
      rulesetCoverBonus(covered.combat!, screened, who(screened, "ogre"), from, "attack", "hero"),
      2,
      "one cell behind the imp is covered",
    );
  }

  // ── Every other place that measures, from any cell it fills ──
  {
    const giveAction = (state: RulesetEncounterState, id: string, action: Record<string, unknown>) => {
      who(state, id).actions.push(action as never);
      return action.id as string;
    };
    const giveZone = (
      state: RulesetEncounterState,
      id: string,
      action: Record<string, unknown>,
      cells: Array<{ x: number; y: number }>,
      at = cells[0]!,
    ) => {
      giveAction(state, id, action);
      const rule = action.zone as { rounds: number; triggers: string[] };
      who(state, id).zones = [
        ...(who(state, id).zones ?? []),
        {
          actionId: action.id as string,
          label: action.label as string,
          rounds: rule.rounds,
          anchor: "point",
          triggers: rule.triggers as never,
          at,
          cells,
        },
      ];
    };
    const zoneAction = (id: string, zone: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
      id,
      label: id,
      kind: "ability",
      budget: "action",
      targets: { side: "any", count: 0 },
      range: { normal: 12 },
      area: { shape: "burst", size: 0 },
      zone: { rounds: 10, anchor: "point", triggers: [], atCast: false, ...zone },
      ...extra,
    });
    const walk = (state: RulesetEncounterState, id: string, to: { x: number; y: number }) => {
      state.turn = state.order.indexOf(id);
      who(state, id).movementLeft = 6;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        {
          actorId: id,
          optionId: rulesetCombatOptions(definition, state, id).find((one) => one.kind === "move")!.id,
          targetIds: [],
          to,
        },
        roller,
      );
      return step;
    };
    const damaged = (events: RulesetCombatEvent[], id: string) =>
      events.filter((one) => one.type === "damage" && one.targetId === id);

    // Ground that hurts to cross hurts it when any of it stands there.
    {
      const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
      giveZone(state, "hero", zoneAction("spikes", { perDistance: { every: 1, amount: { flat: 2 } } }), [
        { x: 8, y: 6 },
      ]);
      const step = walk(state, "ogre", { x: 7, y: 5 });
      assert.equal(damaged(step.events, "ogre").length, 1, JSON.stringify(step.events));
    }
    // A zone holds it when it holds any of it, and what standing in it gives is on it.
    {
      const state = fight({ hero: { x: 9, y: 5 }, ogre: { x: 7, y: 5 } });
      const action = zoneAction("haven", { inside: { immune: ["slashing"] } });
      giveZone(state, "hero", action, [{ x: 8, y: 6 }]);
      assert.deepEqual(
        rulesetZoneOccupants(state, who(state, "hero"), who(state, "hero").zones![0]!, action as never),
        ["ogre"],
      );
      who(state, "hero").budgets.action = 1;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: optionOf(state, "hero", "Sword")!.id, targetIds: ["ogre"] },
        roller,
      );
      const blow = damaged(step.events, "ogre")[0];
      assert.ok(blow && blow.type === "damage" && blow.dealt === 0, JSON.stringify(step.events));
    }
    // Stepping any of it onto a bead sets it off.
    {
      const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
      giveZone(
        state,
        "hero",
        zoneAction(
          "bead",
          { detonates: { touched: true } },
          { damage: { count: 1, sides: 4, flat: 0 }, save: { save: "dex_save", difficulty: 30, onSuccess: "half" } },
        ),
        [{ x: 7, y: 6 }],
      );
      const step = walk(state, "ogre", { x: 6, y: 5 });
      assert.deepEqual(rulesetCombatant(step.state, "hero").zones ?? [], [], "it went off");
    }
    // A zone carried by it stands around all of it.
    {
      const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
      const action = { ...zoneAction("aura", {}), area: { shape: "burst", size: 1 } };
      giveAction(state, "ogre", action);
      const zone = { actionId: "aura", label: "aura", rounds: 10, anchor: "caster" as const, triggers: [] };
      const cells = keys(rulesetZoneCells(state, who(state, "ogre"), zone as never));
      assert.ok(cells.includes("7,7") && cells.includes("4,4"), cells.join(" "));
    }
    // Fire reaching any of it lights the web it stands in.
    {
      const state = fight({ hero: { x: 7, y: 6 }, ogre: { x: 5, y: 5 } });
      giveZone(state, "hero", zoneAction("web", { burns: { by: ["fire"], amount: { flat: 1 }, damageType: "fire" } }), [
        { x: 6, y: 6 },
      ]);
      giveAction(state, "hero", {
        id: "flame",
        label: "Flame",
        kind: "attack",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 1 },
        range: { normal: 12 },
        damage: { count: 0, sides: 0, flat: 3, type: "fire" },
      });
      who(state, "hero").budgets.action = 1;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: "flame", targetIds: ["ogre"] },
        roller,
      );
      assert.equal(rulesetCombatant(step.state, "hero").zones?.[0]?.burning, true, JSON.stringify(step.events));
    }
    // A wall that goes up across any of it puts all of it off the wall.
    {
      const state = fight({ hero: { x: 0, y: 6 }, ogre: { x: 5, y: 5 } });
      giveAction(state, "hero", {
        ...zoneAction("stone", { blocks: { move: true, sight: true } }),
        area: { shape: "wall", size: 3 },
      });
      who(state, "hero").budgets.action = 1;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: "stone", targetIds: [], at: { x: 6, y: 7 }, toward: { x: 6, y: 5 } },
        roller,
      );
      const wall = new Set(keys(rulesetCombatant(step.state, "hero").zones![0]!.cells!));
      assert.ok(wall.has("6,6"), [...wall].join(" "));
      assert.ok(
        rulesetFootprint(rulesetCombatant(step.state, "ogre")).every((cell) => !wall.has(`${cell.x},${cell.y}`)),
        JSON.stringify(rulesetCombatant(step.state, "ogre")),
      );
      // Its own wall runs square to the line from its nearest cell.
      const maker = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
      maker.turn = maker.order.indexOf("ogre");
      giveAction(maker, "ogre", {
        ...zoneAction("stone", { blocks: { move: true } }),
        area: { shape: "wall", size: 3 },
      });
      who(maker, "ogre").budgets.action = 1;
      const raised = applyRulesetCombatChoice(
        definition,
        maker,
        { actorId: "ogre", optionId: "stone", targetIds: [], at: { x: 6, y: 2 } },
        roller,
      );
      assert.deepEqual(keys(rulesetCombatant(raised.state, "ogre").zones![0]!.cells!), ["5,2", "6,2", "7,2"]);
    }
    // A bolt catches it standing on any of the run.
    {
      const javelin = {
        name: "Javelin",
        quantity: 1,
        worn: true,
        item: {
          category: "gear",
          slots: { hands: 1 },
          stack: 1,
          charges: { max: 1 },
          attack: {
            budget: "action",
            toHit: { abilities: ["str"] },
            damage: { dice: "1d6", abilities: ["str"], type: "piercing" },
            range: { normal: 60 },
            modes: [
              {
                id: "bolt",
                label: "Bolt",
                range: { normal: 120 },
                line: { dice: "4d6", type: "lightning", save: { save: "dex_save", difficulty: 30, onSuccess: "half" } },
                charges: 1,
              },
            ],
          },
        },
      } as unknown as RulesetSheetItem;
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build, items: [javelin] },
          { id: "imp", name: "imp", side: "enemy", block: block() },
          { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large" }) },
        ],
        board: { grid: grid(), placements: { hero: { x: 1, y: 5 }, imp: { x: 9, y: 5 }, ogre: { x: 4, y: 4 } } },
      });
      state.turn = state.order.indexOf("hero");
      who(state, "hero").budgets.action = 1;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: optionOf(state, "hero", "Javelin")!.id, targetIds: ["imp"], mode: "bolt" },
        roller,
      );
      assert.ok(damaged(step.events, "ogre").length > 0, JSON.stringify(step.events));
    }
    // A helping friend beside any of it.
    {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build, items: [sword] },
          { id: "squire", name: "Squire", side: "party", build },
          { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large" }) },
        ],
        board: { grid: grid(), placements: { hero: { x: 4, y: 5 }, squire: { x: 7, y: 7 }, ogre: { x: 5, y: 5 } } },
      });
      state.turn = state.order.indexOf("hero");
      who(state, "hero").budgets.action = 1;
      who(state, "hero").riders = [
        { id: "sneak", label: "Sneak", on: "hit", when: ["ally-adjacent"], oncePer: "turn", amount: { flat: 3 } },
      ];
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "hero", optionId: optionOf(state, "hero", "Sword")!.id, targetIds: ["ogre"] },
        roller,
      );
      assert.deepEqual(rulesetCombatant(step.state, "hero").ridersSpent, ["sneak"], JSON.stringify(step.events));
    }
    // A coven counts its members from any of it.
    {
      const coven = { spellcasting: { spells: [], coven: { id: "c" } } } as never;
      const state = fight(
        { hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 }, hag: { x: 8, y: 5 } },
        {
          ogre: { size: "large", ...(coven as object) },
          hag: coven,
        },
      );
      giveAction(state, "ogre", {
        id: "hex",
        label: "Hex",
        kind: "ability",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 1 },
        range: { normal: 12 },
        innate: { level: 1, baseLevel: 1, coven: { id: "c", size: 2, within: 2 } },
        damage: { count: 0, sides: 0, flat: 1 },
      });
      state.turn = state.order.indexOf("ogre");
      assert.ok(optionOf(state, "ogre", "Hex"), "the hag is two cells from its near side");
      who(state, "hag").x = 9;
      assert.equal(optionOf(state, "ogre", "Hex"), undefined);
    }
    // Aimed from its nearest cell: as far as that one carries, and laid from there.
    {
      const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
      giveAction(state, "ogre", {
        id: "slam",
        label: "Slam",
        kind: "ability",
        budget: "action",
        targets: { side: "enemy", count: 0 },
        range: { normal: 3 },
        area: { shape: "burst", size: 0 },
        damage: { count: 0, sides: 0, flat: 1 },
      });
      giveAction(state, "ogre", {
        id: "breath",
        label: "Breath",
        kind: "ability",
        budget: "action",
        targets: { side: "enemy", count: 0 },
        area: { shape: "line", size: 3 },
        damage: { count: 0, sides: 0, flat: 1 },
      });
      assert.equal(rulesetAimLegal(state, "ogre", "slam", { x: 9, y: 6 }), true);
      assert.equal(rulesetAimLegal(state, "ogre", "slam", { x: 10, y: 6 }), false);
      assert.deepEqual(keys(rulesetAimedCells(state, "ogre", "breath", { x: 9, y: 6 })), ["7,6", "8,6", "9,6"]);
    }
    // A summoned weapon reaches the nearest cell it fills.
    {
      const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
      giveAction(state, "hero", {
        id: "blade",
        label: "Blade",
        kind: "attack",
        budget: "bonus",
        toHit: 5,
        targets: { side: "enemy", count: 1 },
        range: { normal: 12 },
        damage: { count: 1, sides: 4, flat: 0 },
        summons: { budget: "bonus", rounds: 10, move: 0, reach: 1 },
      });
      who(state, "hero").summons = [
        { actionId: "blade", label: "Blade", budget: "bonus", rounds: 10, move: 0, reach: 1, at: { x: 7, y: 7 } },
      ];
      assert.equal(rulesetTargetRefusal(state, "hero", "summon:blade", "ogre"), null);
      who(state, "hero").summons![0]!.at = { x: 8, y: 7 };
      assert.equal(rulesetTargetRefusal(state, "hero", "summon:blade", "ogre"), "out-of-reach");
    }
    // Seen past a wall in front of its near corner, so a shot at it is not refused.
    {
      const state = fight(
        { hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 } },
        undefined,
        grid((tiles) => (tiles[5]![3] = "wall")),
      );
      giveAction(state, "hero", {
        id: "dart",
        label: "Dart",
        kind: "attack",
        budget: "action",
        toHit: 5,
        targets: { side: "enemy", count: 1 },
        range: { normal: 12 },
        damage: { count: 1, sides: 4, flat: 0 },
      });
      assert.equal(rulesetTargetRefusal(state, "hero", "dart", "ogre"), null);
    }
    // Any of it screens somebody behind it.
    {
      const covered = parse(document((doc) => (doc.combat.cover = { bonus: 2, creatures: true })));
      const state = createRulesetEncounter({
        definition: covered,
        seed: 1,
        roller,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build },
          { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large" }) },
          { id: "imp", name: "imp", side: "enemy", block: block() },
        ],
        board: { grid: grid(), placements: { hero: { x: 0, y: 5 }, ogre: { x: 2, y: 4 }, imp: { x: 6, y: 5 } } },
      });
      assert.equal(rulesetCoverBonus(covered.combat!, state, who(state, "imp"), { x: 0, y: 5 }, "attack", "hero"), 2);
    }
    // Afraid while whoever frightened them is in sight from any of it.
    {
      const afraid = (board: TacticalGrid) => {
        const state = fight({ hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 } }, undefined, board);
        who(state, "hero").tracked.push({ condition: "frightened", rounds: null, source: "ogre" } as never);
        return rulesetActiveConditions(definition, definition.combat!, who(state, "hero"), state).some((entry) =>
          entry.effects?.includes("own-attacks-disadvantage"),
        );
      };
      assert.equal(afraid(grid((tiles) => (tiles[5]![3] = "wall"))), true);
      assert.equal(afraid(grid((tiles) => tiles.forEach((row) => (row[3] = "wall")))), false);
    }
    // Senses reach to the nearest cell, and fog that hides one cell of it hides none of it.
    {
      const sighted = parse(
        document((doc) => {
          doc.combat.senses = [{ id: "blindsight", label: "Blindsight", blind: true }];
          for (const entry of doc.combat.conditions) {
            if (entry.condition === "invisible") entry.unseen = { pierced: ["blindsight"] };
          }
        }),
      );
      const state = createRulesetEncounter({
        definition: sighted,
        seed: 1,
        roller,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build },
          { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large", senses: { blindsight: 5 } }) },
        ],
        board: { grid: grid(), placements: { hero: { x: 7, y: 7 }, ogre: { x: 5, y: 5 } } },
      });
      who(state, "hero").tracked.push({ condition: "invisible", rounds: null } as never);
      assert.equal(rulesetCanSee(sighted, state, who(state, "ogre"), who(state, "hero")), true);
      who(state, "hero").x = 8;
      assert.equal(rulesetCanSee(sighted, state, who(state, "ogre"), who(state, "hero")), false);
      const foggy = fight({ hero: { x: 0, y: 5 }, ogre: { x: 5, y: 5 } });
      giveZone(foggy, "hero", zoneAction("fog", { obscures: { pierced: [] } }), [
        { x: 3, y: 5 },
        { x: 4, y: 5 },
      ]);
      assert.equal(rulesetCanSee(definition, foggy, who(foggy, "hero"), who(foggy, "ogre")), true);
    }
    // Shoved from the side, it goes straight away from the nearest of it, and anybody's cells stop it.
    {
      const side = fight({ hero: { x: 7, y: 6 }, ogre: { x: 5, y: 5 } });
      assert.deepEqual(rulesetPushPath(side, "hero", "ogre", 1), [{ x: 4, y: 5 }]);
      const below = fight({ hero: { x: 6, y: 7 }, ogre: { x: 5, y: 5 } });
      assert.deepEqual(rulesetPushPath(below, "hero", "ogre", 1), [{ x: 5, y: 4 }]);
      const blocked = fight(
        { hero: { x: 4, y: 5 }, ogre: { x: 5, y: 5 }, troll: { x: 8, y: 4 } },
        {
          ogre: { size: "large" },
          troll: { size: "large" },
        },
      );
      assert.deepEqual(rulesetPushPath(blocked, "hero", "ogre", 3), [{ x: 6, y: 5 }]);
    }
    // Set back onto the board from its right edge too.
    {
      const state = fight({ hero: { x: 0, y: 0 }, ogre: { x: 11, y: 5 } });
      assert.equal(who(state, "ogre").x, 10);
      assert.ok(Math.abs(who(state, "ogre").y! - 5) <= 1, "one step in");
    }
    // It never walks any of it through a foe, nor stops with any of it on a friend.
    {
      const corridor = grid((tiles) => tiles.forEach((row, y) => y !== 5 && y !== 6 && row.fill("wall")));
      const state = fight({ hero: { x: 8, y: 6 }, ogre: { x: 2, y: 5 } }, undefined, corridor);
      state.turn = state.order.indexOf("ogre");
      who(state, "ogre").movementLeft = 12;
      assert.ok(!keys(rulesetReachableCells(definition, state, "ogre")).includes("10,5"), "the hero fills the way");
      const crowd = fight(
        { hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 }, imp: { x: 8, y: 6 } },
        {
          ogre: { size: "large" },
          imp: {},
        },
      );
      crowd.turn = crowd.order.indexOf("ogre");
      who(crowd, "ogre").movementLeft = 6;
      const cells = keys(rulesetReachableCells(definition, crowd, "ogre"));
      for (const cell of ["7,5", "7,6", "8,5"])
        assert.ok(!cells.includes(cell), `never stopping on the imp from ${cell}`);
    }
    // Its saves come from the nearest of it.
    {
      const covered = parse(document((doc) => (doc.combat.cover = { bonus: 2, creatures: true, saves: ["dex_save"] })));
      const state = createRulesetEncounter({
        definition: covered,
        seed: 1,
        roller,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build },
          { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large" }) },
          { id: "imp", name: "imp", side: "enemy", block: block() },
        ],
        board: { grid: grid(), placements: { hero: { x: 9, y: 6 }, ogre: { x: 5, y: 5 }, imp: { x: 0, y: 0 } } },
      });
      state.turn = state.order.indexOf("ogre");
      giveAction(state, "ogre", {
        id: "roar",
        label: "Roar",
        kind: "ability",
        budget: "action",
        targets: { side: "enemy", count: 1 },
        range: { normal: 12 },
        save: { save: "dex_save", difficulty: 15, onSuccess: "none" },
        damage: { count: 0, sides: 0, flat: 1 },
      });
      who(state, "ogre").budgets.action = 1;
      const step = applyRulesetCombatChoice(
        covered,
        state,
        { actorId: "ogre", optionId: "roar", targetIds: ["hero"] },
        roller,
      );
      // From its top-left cell its own far cells would stand in the way.
      const saved = step.events.find((one) => one.type === "save");
      assert.ok(saved && saved.type === "save" && saved.modifier === 0, JSON.stringify(step.events));
      assert.ok(!step.events.some((one) => one.type === "cover"));
    }
  }

  // ── The director closes on, and walks, all of it ──
  {
    const state = fight({ hero: { x: 5, y: 5 }, goblin: { x: 7, y: 7 } }, { goblin: {} });
    who(state, "hero").span = 2;
    state.turn = state.order.indexOf("goblin");
    assert.equal(rulesetClosingMove(definition, state, "goblin"), null, "already beside its far corner");
    const ogre = fight({ hero: { x: 8, y: 5 }, ogre: { x: 3, y: 9 } });
    ogre.turn = ogre.order.indexOf("ogre");
    // Beside the hero from its own far side, nearer than a cell that only looks as near from its corner.
    const sorted = rulesetWalkableCells(definition, ogre, "ogre").map((cell) => `${cell.x},${cell.y}`);
    assert.ok(sorted.indexOf("6,4") >= 0 && sorted.indexOf("6,4") < sorted.indexOf("6,7"), sorted.join(" "));
  }

  // ── The view carries how many cells a side it fills ──
  {
    const encounter = fight({ hero: { x: 0, y: 0 }, ogre: { x: 5, y: 5 } });
    const view = directedRulesetView(definition, {
      style: "ruleset",
      party: [],
      enemies: [],
      rulesetFight: { encounter, events: [], eventSeq: 0, controllers: {}, adjustments: [], bosses: [] },
    } as never)!;
    assert.equal(view.combatants.find((entry) => entry.id === "ogre")!.span, 2);
    assert.equal(view.combatants.find((entry) => entry.id === "hero")!.span, undefined);
  }

  // ── The board draws it once across its cells ──
  {
    const view = {
      grid: grid(),
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", x: 5, y: 5, span: 2, health: { value: 1, max: 1 } },
        { id: "hero", name: "Hero", side: "party", x: 0, y: 0, health: { value: 1, max: 1 } },
      ],
    };
    const cells = rulesetBoardCells(view as never, null);
    const ogre = cells.filter((cell: any) => cell.occupant?.id === "ogre");
    assert.deepEqual(keys(ogre), ["5,5", "5,6", "6,5", "6,6"]);
    assert.deepEqual(
      cells.filter((cell: any) => cell.anchor).map((cell: any) => `${cell.occupant.id}@${cell.x},${cell.y}`),
      ["hero@0,0", "ogre@5,5"],
    );
    // Whoever stands on a body is the one drawn there, whichever comes first in the list.
    for (const order of [
      ["body", "cultist"],
      ["cultist", "body"],
    ]) {
      const fallen = {
        body: { id: "body", name: "Body", side: "enemy", x: 3, y: 1, defeated: true, health: { value: 0, max: 1 } },
        cultist: { id: "cultist", name: "Cultist", side: "enemy", x: 3, y: 1, health: { value: 6, max: 6 } },
      } as Record<string, unknown>;
      const drawn = rulesetBoardCells({ grid: grid(), combatants: order.map((id) => fallen[id]) } as never, null);
      assert.equal(drawn.find((cell: any) => cell.x === 3 && cell.y === 1)?.occupant?.id, "cultist", order.join());
    }
  }

  // ── Refusals and the gate ──
  {
    const refused = (doc: unknown) => assert.equal(parseRulesetDefinition(doc).ok, false);
    refused(document((doc) => (doc.combat.sizes.order[2].cells = 0)));
    refused(document((doc) => (doc.combat.sizes.order[2].cells = 7)));
    refused(document((doc) => (doc.combat.sizes.order[2].cells = 1.5)));
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
      "A ruleset with sizes that fill more than one cell requires schemaVersion 2 and capabilityApi 1.194 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(193) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(194) as never, document()), gate);
    const plain = document((doc) => doc.combat.sizes.order.forEach((size: any) => delete size.cells));
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(193) as never, plain), gate, "sizes alone are 1.103's");
  }

  console.log(
    "Ruleset footprints: a Large ogre fills four cells, is set down where it fits, is reached beside any of them, walks and is pushed whole, and is caught, seen and covered by its clearest cell.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
