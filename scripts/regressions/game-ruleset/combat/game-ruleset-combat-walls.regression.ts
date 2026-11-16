/**
 * Boxes and walls (Capability API 1.177).
 *
 *   - `area.shape: "box"`: a square of its size a side, near corner on the aimed cell, reaching away
 *     from its maker, centred along an axis its maker is level with; against its maker with no range.
 *   - `area.shape: "wall"`: across the line from its maker, or toward the choice's `toward`; closed on
 *     a diagonal; a `ring` around the aimed cell.
 *   - `zone.blocks`: movement, sight or both, gone when the wall is; whoever stands there is shoved.
 *   - `zone.side`: the chosen side catches as its own triggers say (Wall of Fire).
 *   - Import refusals, the choice's own checks, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetLineOfSight,
  rulesetSheetBuildSchema,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-walls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 172);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // A 15-ft cube that stays: 5 at the cast and to whoever starts a turn in it.
  const cube = spell("cube", {
    area: { shape: "box", size: 15 },
    range: 60,
    amount: { flat: 5 },
    zone: { rounds: 10, triggers: ["turn-start"] },
  });
  // A 10-ft cube off its maker, gone at once.
  const thunder = spell("thunder", { area: { shape: "box", size: 10 }, amount: { flat: 5 } });
  // Walls 15 ft long: stone blocks both, force movement, a curtain sight.
  const wallOf = (id: string, blocks: string[]) =>
    spell(id, { area: { shape: "wall", size: 15 }, range: 60, zone: { rounds: 1, triggers: [], blocks } });
  const stone = wallOf("stone", ["move", "sight"]);
  const force = wallOf("force", ["move"]);
  const curtain = wallOf("curtain", ["sight"]);
  // Wall of Fire, small: 5 to whoever walks into it or ends a turn in it, or ends a turn within
  // 10 ft of its chosen side.
  const fire = spell("fire", {
    area: { shape: "wall", size: 15 },
    range: 60,
    amount: { flat: 5 },
    zone: { rounds: 10, triggers: ["enter", "turn-end"], side: { distance: 10, triggers: ["turn-end"] } },
  });
  // The same wall whose side catches whoever walks onto it.
  const blaze = spell("blaze", {
    area: { shape: "wall", size: 15 },
    range: 60,
    amount: { flat: 5 },
    zone: { rounds: 10, triggers: ["turn-end"], side: { distance: 10, triggers: ["enter"] } },
  });
  const ring = spell("ring", {
    area: { shape: "wall", size: 15, ring: 20 },
    range: 60,
    zone: { rounds: 10, triggers: [], blocks: ["move"] },
  });
  const spells = [cube, thunder, stone, force, curtain, fire, blaze, ring];
  const block: RulesetStatBlock = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  const fight = (placements: Record<string, { x: number; y: number }> = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
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
        { id: "a", name: "A", side: "enemy", block },
        { id: "b", name: "B", side: "enemy", block },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 8, y: 7 }, b: { x: 11, y: 7 }, ...placements },
      },
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    return option;
  };
  const cast = (
    state: RulesetEncounterState,
    label: string,
    at: RulesetCombatCell,
    extra: { toward?: RulesetCombatCell; side?: "near" | "far"; ring?: boolean } = {},
  ) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, "mage", label).id, targetIds: [], at, ...extra },
      roll,
    );
  const walk = (state: RulesetEncounterState, actorId: string, to: RulesetCombatCell) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to }, roll);
  const walkCost = (state: RulesetEncounterState, actorId: string, to: RulesetCombatCell) =>
    rulesetCombatOptions(definition, state, actorId)
      .find((one) => one.id === RULESET_MOVE_OPTION)
      ?.cells?.find((cell) => cell.x === to.x && cell.y === to.y)?.cost;
  const end = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll);
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const keys = (cells: RulesetCombatCell[]) => cells.map((cell) => `${cell.x},${cell.y}`).sort();
  const shown = (state: RulesetEncounterState) => rulesetZonesShown(state)[0]!;
  const sees = (state: RulesetEncounterState, a: RulesetCombatCell, b: RulesetCombatCell) =>
    rulesetLineOfSight(state.board!.grid, a, b);

  // ── Boxes ──
  {
    // Level with its maker along y: three across from x 8, centred on row 7.
    const step = cast(fight({ b: { x: 10, y: 9 } }), "Cube", { x: 8, y: 7 });
    assert.equal(refused(step), undefined);
    assert.deepEqual(keys(shown(step.state).cells), keys([6, 7, 8].flatMap((y) => [8, 9, 10].map((x) => ({ x, y })))));
    assert.equal(hp(step.state, "a"), 95, "caught at the cast");
    assert.equal(hp(step.state, "b"), 100, "a cell outside the box");
    // Aimed off both axes: it reaches away on both.
    const corner = cast(fight(), "Cube", { x: 8, y: 9 });
    assert.deepEqual(
      keys(shown(corner.state).cells),
      keys([9, 10, 11].flatMap((y) => [8, 9, 10].map((x) => ({ x, y })))),
    );
    // With no range it sits against its maker: the next cell is the nearest it may be aimed.
    assert.ok(refused(cast(fight(), "Thunder", { x: 4, y: 7 })), "two cells off is too far");
    const thunderStep = cast(fight({ a: { x: 4, y: 8 } }), "Thunder", { x: 3, y: 7 });
    assert.equal(refused(thunderStep), undefined);
    const area = thunderStep.events.find((one) => one.type === "area");
    assert.deepEqual(
      keys(area && area.type === "area" ? area.cells : []),
      keys([
        { x: 3, y: 7 },
        { x: 4, y: 7 },
        { x: 3, y: 8 },
        { x: 4, y: 8 },
      ]),
    );
    assert.equal(hp(thunderStep.state, "a"), 95);
  }

  // ── Walls that block ──
  {
    // Costs are read on A's own turn.
    assert.equal(walkCost(end(fight()).state, "a", { x: 4, y: 7 }), 4);
    const before = fight();
    // Across the line from the mage, centred on the aimed cell.
    const step = cast(before, "Stone", { x: 5, y: 7 });
    assert.equal(refused(step), undefined);
    const wall = [6, 7, 8].map((y) => ({ x: 5, y }));
    assert.deepEqual(keys(shown(step.state).cells), keys(wall));
    assert.deepEqual(step.state.board!.grid.walls, { "5,6": 3, "5,7": 3, "5,8": 3 });
    assert.equal(sees(step.state, { x: 2, y: 7 }, { x: 8, y: 7 }), false, "nobody sees through stone");
    // A's turn: round the end of it, never through.
    const aTurn = end(step.state).state;
    assert.equal(walkCost(aTurn, "a", { x: 5, y: 7 }), undefined, "nobody walks into it");
    assert.ok((walkCost(aTurn, "a", { x: 4, y: 7 }) ?? 0) > 4, "the way round costs more");
    // Gone with its rounds, and with it what it closed.
    let state = aTurn;
    for (let turn = 0; turn < 6 && rulesetZonesShown(state).length > 0; turn++) state = end(state).state;
    assert.equal(rulesetZonesShown(state).length, 0);
    assert.equal(state.board!.grid.walls, undefined, "nothing closed once it is gone");
    assert.equal(sees(state, { x: 2, y: 7 }, { x: 8, y: 7 }), true);

    // Force: no walking through, but seen through. A curtain: walked through, never seen through.
    const forced = end(cast(fight(), "Force", { x: 5, y: 7 }).state).state;
    assert.equal(sees(forced, { x: 2, y: 7 }, { x: 8, y: 7 }), true);
    assert.equal(walkCost(forced, "a", { x: 5, y: 7 }), undefined);
    const curtained = end(cast(fight(), "Curtain", { x: 5, y: 7 }).state).state;
    assert.equal(sees(curtained, { x: 2, y: 7 }, { x: 8, y: 7 }), false);
    assert.equal(walkCost(curtained, "a", { x: 4, y: 7 }), 4);

    // Whoever stands where it goes up is shoved off it, to the nearest open cell.
    const shoved = cast(fight({ a: { x: 5, y: 7 } }), "Stone", { x: 5, y: 7 });
    const a = rulesetCombatant(shoved.state, "a")!;
    assert.ok(a.x !== 5, "off the wall");
    assert.equal(Math.max(Math.abs(a.x! - 5), Math.abs(a.y! - 7)), 1, "to the next cell");
    assert.ok(shoved.events.some((one) => one.type === "zone" && one.outcome === "shoved" && one.targetId === "a"));

    // Run toward a cell: from the aimed cell that way, its length.
    const run = cast(fight(), "Stone", { x: 5, y: 3 }, { toward: { x: 9, y: 3 } });
    assert.deepEqual(keys(shown(run.state).cells), keys([5, 6, 7].map((x) => ({ x, y: 3 }))));
    // Corner-wise, every step's corner is filled so nothing slips between.
    const slant = cast(fight(), "Stone", { x: 5, y: 3 }, { toward: { x: 9, y: 7 } });
    assert.deepEqual(
      keys(shown(slant.state).cells),
      keys([
        { x: 5, y: 3 },
        { x: 6, y: 3 },
        { x: 6, y: 4 },
        { x: 7, y: 4 },
        { x: 7, y: 5 },
      ]),
    );
    // Laid as a ring 20 ft across when its caster says so: the cells two out from the aimed one.
    const ringed = cast(fight({ a: { x: 13, y: 13 } }), "Ring", { x: 8, y: 7 }, { ring: true });
    assert.equal(refused(ringed), undefined);
    const ringCells = shown(ringed.state).cells;
    assert.equal(ringCells.length, 16);
    assert.ok(ringCells.every((cell) => Math.max(Math.abs(cell.x - 8), Math.abs(cell.y - 7)) === 2));
    // And straight, its length, when not.
    const straight = cast(fight({ a: { x: 13, y: 13 } }), "Ring", { x: 8, y: 7 });
    assert.equal(shown(straight.state).cells.length, 3);
    // A wall with no ring is never laid as one.
    assert.ok(refused(cast(fight(), "Stone", { x: 5, y: 7 }, { ring: true })));
  }

  // ── Wall of Fire: its own cells, and the side chosen ──
  {
    // The far side (away from the mage) by default: A stands there, B on the near side.
    const placed = { a: { x: 7, y: 7 }, b: { x: 3, y: 9 } };
    const step = cast(fight(placed), "Fire", { x: 5, y: 7 });
    assert.equal(refused(step), undefined);
    const side = shown(step.state).side!;
    assert.ok(side.some((cell) => cell.x === 7 && cell.y === 7));
    assert.ok(
      side.every((cell) => cell.x > 5),
      "all on the far side",
    );
    assert.ok(
      side.every((cell) => cell.x <= 7),
      "within 10 ft",
    );
    // A ends a turn on the side: 5. B ends one on the other: nothing.
    let state = end(step.state).state;
    assert.equal(hp(state, "a"), 100, "nothing as the turn starts: the side catches at its end");
    state = end(state).state;
    assert.equal(hp(state, "a"), 95);
    state = end(state).state;
    assert.equal(hp(state, "b"), 100);
    // The near side when chosen: then B, not A.
    const near = cast(fight(placed), "Fire", { x: 5, y: 7 }, { side: "near" });
    let nearState = end(end(near.state).state).state;
    assert.equal(hp(nearState, "a"), 100);
    nearState = end(nearState).state;
    assert.equal(hp(nearState, "b"), 95);
    // Walking onto the side catches nobody (only its turn-end does); walking into the wall does, once.
    const fromAfar = end(cast(fight({ a: { x: 10, y: 7 }, b: { x: 3, y: 9 } }), "Fire", { x: 5, y: 7 }).state).state;
    const ontoSide = walk(fromAfar, "a", { x: 7, y: 9 });
    assert.equal(refused(ontoSide), undefined);
    assert.equal(hp(ontoSide.state, "a"), 100, "the side's own triggers, not the wall's");
    const walkState = end(step.state).state;
    const into = walk(walkState, "a", { x: 5, y: 7 });
    assert.equal(hp(into.state, "a"), 95, "the wall's own enter");
    const ended = end(into.state);
    assert.equal(hp(ended.state, "a"), 95, "once a turn, wall and side together");
    // A side that catches on the way in: walking onto it does; moving about on it does not.
    const blazing = end(cast(fight({ a: { x: 10, y: 7 }, b: { x: 3, y: 9 } }), "Blaze", { x: 5, y: 7 }).state).state;
    assert.equal(hp(walk(blazing, "a", { x: 7, y: 9 }).state, "a"), 95);
    const already = end(cast(fight(placed), "Blaze", { x: 5, y: 7 }).state).state;
    assert.equal(hp(walk(already, "a", { x: 6, y: 9 }).state, "a"), 100, "already on it");
    // A slanting wall's side is still only what lies within its distance.
    const slanted = cast(
      fight({ a: { x: 13, y: 13 }, b: { x: 13, y: 12 } }),
      "Fire",
      { x: 5, y: 3 },
      { toward: { x: 9, y: 7 } },
    );
    const slantWall = shown(slanted.state).cells;
    const slantSide = shown(slanted.state).side!;
    assert.ok(slantSide.length > 0);
    assert.ok(
      slantSide.every((cell) =>
        slantWall.some((one) => Math.max(Math.abs(one.x - cell.x), Math.abs(one.y - cell.y)) <= 2),
      ),
      "within 10 ft of the wall",
    );
  }

  // ── The choice's own checks ──
  {
    assert.ok(refused(cast(fight(), "Fire", { x: 5, y: 7 }, { side: "up" as never })));
    assert.ok(refused(cast(fight(), "Fire", { x: 5, y: 7 }, { toward: { x: 40, y: 7 } })));
  }

  // ── Import refusals ──
  {
    const refusedDoc = (mechanics: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({
            id: "walls",
            label: "Walls",
            feeds: ["spells"],
            entries: [{ ...spell("x", {}), mechanics }],
          });
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const wallArea = { shape: "wall", size: 15 };
    refusedDoc({ kind: "attack", area: wallArea }, /A wall only ever stays/);
    refusedDoc(
      { kind: "attack", area: { shape: "burst", size: 5 }, zone: { rounds: 1, triggers: [], blocks: ["move"] } },
      /Only a wall "blocks"/,
    );
    refusedDoc(
      {
        kind: "attack",
        area: { shape: "box", size: 5 },
        zone: { rounds: 1, triggers: ["enter"], side: { distance: 5, triggers: ["turn-end"] } },
      },
      /Only a wall "blocks" or has a "side"/,
    );
    refusedDoc(
      {
        kind: "attack",
        area: wallArea,
        zone: { rounds: 1, triggers: ["enter"], move: { budget: "action", distance: 30 } },
      },
      /A wall stays where it is cast/,
    );
    refusedDoc(
      { kind: "attack", area: { shape: "burst", size: 5, ring: 20 }, zone: { rounds: 1, triggers: ["enter"] } },
      /Only a wall is a ring/,
    );
    refusedDoc({ kind: "attack", area: { shape: "box", size: 5, width: 5 } }, /Only a line or a wall/);
    refusedDoc(
      { kind: "attack", area: wallArea, zone: { rounds: 1, triggers: [], blocks: ["move", "move"] } },
      /Each is named once/,
    );
    // A wall needs no trigger of its own: Wind Wall only does its effect as it appears.
    parsed(
      fiveE((doc) => {
        doc.catalogs.push({
          id: "walls",
          label: "Walls",
          feeds: ["spells"],
          entries: [
            spell("wind", {
              area: { shape: "wall", size: 50 },
              range: 120,
              amount: { flat: 5 },
              zone: { rounds: 10, triggers: [] },
            }),
          ],
        });
      }),
    );
    // A blocking wall needs no trigger of its own.
    parsed(
      fiveE((doc) => {
        doc.catalogs.push({ id: "walls", label: "Walls", feeds: ["spells"], entries: [stone] });
      }),
    );
  }

  // ── The gate ──
  {
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
      "A ruleset with box or wall areas, or walls that block or have a side, requires schemaVersion 2 and capabilityApi 1.177 or newer";
    for (const entry of [cube, thunder, stone, fire, ring]) {
      const withEntry = fiveE((doc) => {
        doc.catalogs.push({ id: "walls", label: "Walls", entries: [entry] });
      });
      assert.equal(getCapabilityPackageInstallIssue(manifest(176) as never, withEntry), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(177) as never, withEntry), gate, entry.id);
    }
    const wand = fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "kit",
        label: "Kit",
        entries: [
          {
            id: "wand",
            label: "Wand",
            item: {
              category: "gear",
              use: {
                kind: "debuff",
                budget: "action",
                area: { shape: "box", size: 20 },
                zone: { rounds: 10, triggers: ["enter"] },
              },
            },
          },
        ],
      });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(176) as never, wand), gate, "an item's cube");
    const burst = fiveE((doc) => {
      doc.catalogs.push({
        id: "walls",
        label: "Walls",
        entries: [spell("ball", { area: { shape: "burst", size: 20 }, range: 150, amount: { flat: 5 } })],
      });
    });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(176) as never, burst), gate, "a burst alone");
  }

  console.log(
    "Walls: cubes reach away from their maker; walls run across or toward, close their corners and ring; stone, force and a curtain block as they say until they end; Wall of Fire catches its own cells and the side chosen; gated at 1.177.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
