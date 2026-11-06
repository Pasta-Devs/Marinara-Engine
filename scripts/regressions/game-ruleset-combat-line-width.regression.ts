/**
 * A line's width (Capability API 1.128): distances become cells, and previews and resolution cover
 * the same band. The one-cell path is pinned against the code from before width was supported.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetAreaCells,
  rulesetAreaTargets,
  rulesetCombatant,
  rulesetCellBlocked,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  rulesetItemUseSchema,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { blocksSight } from "../../packages/shared/src/features/tactical-combat/math.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-line-width-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 123);
  const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));
  const base = read("../../docs/development/ruleset-5e-2014.example.json");
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  const origin = { x: 7, y: 7 };
  const keys = (cells: RulesetCombatCell[]) => cells.map(({ x, y }) => `${x},${y}`).sort();
  const directions = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const;

  // The previous line loop, copied rather than computed through the new implementation.
  const previousLine = (size: number, toward: RulesetCombatCell, board: TacticalGrid) => {
    const cells: RulesetCombatCell[] = [];
    const dx = Math.sign(toward.x - origin.x);
    const dy = Math.sign(toward.y - origin.y);
    if (dx === 0 && dy === 0) return cells;
    for (let step = 1; step <= Math.max(1, Math.round(size)); step++) {
      const cell = { x: origin.x + dx * step, y: origin.y + dy * step };
      if (blocksSight(board, cell.x, cell.y)) break;
      if (rulesetCellBlocked(board, cell.x, cell.y)) continue;
      cells.push(cell);
    }
    return cells;
  };
  for (const [dx, dy] of directions) {
    for (const terrain of ["plains", "water", "wall", "mountain"] as const) {
      const board = grid();
      board.tiles[origin.y + dy * 2]![origin.x + dx * 2] = terrain;
      for (const size of [0.1, 3, 3.5, 10000]) {
        // Along the eight ways a grid runs, a one-cell line is as it was. Aimed between them it runs
        // at its own angle (ruleset-combat-aiming covers that).
        const toward = { x: origin.x + dx * 2, y: origin.y + dy * 2 };
        const before = keys(previousLine(size, toward, board));
        assert.deepEqual(keys(rulesetAreaCells("line", size, origin, toward, board)), before);
        assert.deepEqual(keys(rulesetAreaCells("line", size, origin, toward, board, 1)), before);
      }
    }
  }
  assert.deepEqual(rulesetAreaCells("line", 3, origin, origin, grid(), 3), []);

  // Offsets from the caster for three cells of length. Diagonal bands are contiguous: their
  // across coordinate is the axis difference, and their along coordinate is the axis average.
  const expected = {
    1: {
      1: [
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      2: [
        [1, 0],
        [2, 0],
        [3, 0],
        [1, -1],
        [2, -1],
        [3, -1],
      ],
      3: [
        [1, 0],
        [2, 0],
        [3, 0],
        [1, -1],
        [2, -1],
        [3, -1],
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    },
    2: {
      1: [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
      2: [
        [1, 1],
        [2, 2],
        [3, 3],
        [1, 0],
        [2, 1],
        [3, 2],
      ],
      3: [
        [1, 1],
        [2, 2],
        [3, 3],
        [1, 0],
        [2, 1],
        [3, 2],
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    },
  } as const;
  const expectedCells = (dx: number, dy: number, width: 1 | 2 | 3): RulesetCombatCell[] => {
    const diagonal = dx !== 0 && dy !== 0;
    return expected[diagonal ? 2 : 1][width].map(([x, y]) => ({
      x: origin.x + (dx !== 0 ? x * dx : -y * dy),
      y: origin.y + (dy !== 0 ? (diagonal ? y : x) * dy : y * dx),
    }));
  };
  // Reflecting a diagonal reverses left and right, so reflect its band across the centre line too.
  const coverage = (dx: number, dy: number, width: 1 | 2 | 3) => {
    const cells = expectedCells(dx, dy, width);
    if (dx !== 0 && dy !== 0 && dx * dy < 0) {
      return cells.map(({ x, y }) => ({
        x: origin.x + ((y - origin.y) * dx) / dy,
        y: origin.y + ((x - origin.x) * dy) / dx,
      }));
    }
    return cells;
  };
  for (const [dx, dy] of directions) {
    for (const width of [1, 2, 3] as const) {
      assert.deepEqual(
        keys(rulesetAreaCells("line", 3, origin, { x: origin.x + dx, y: origin.y + dy }, grid(), width)),
        keys(coverage(dx, dy, width)),
        `${dx},${dy}, width ${width}`,
      );
    }
  }
  const obstructed = grid();
  obstructed.tiles[7]![9] = "wall";
  const obstructedCells = keys(rulesetAreaCells("line", 10000, origin, { x: 8, y: 7 }, obstructed, 10000));
  assert.ok(obstructedCells.length <= 225, "huge sizes scan only the board");
  assert.ok(
    !obstructedCells.includes("9,7") && !obstructedCells.includes("10,7"),
    "a wall and cells behind it are out",
  );

  const document = (width?: unknown, shape = "line", perCell = 5) => {
    const doc = structuredClone(base);
    const area = { shape, size: 15, ...(width !== undefined ? { width } : {}) };
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      units: { distance: { label: "ft", perCell } },
      entries: [
        {
          id: "bolt",
          label: "Bolt",
          rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
          mechanics: { kind: "attack", amount: { flat: 4 }, area: { ...area }, targetCount: 2, range: 60 },
        },
      ],
    });
    doc.catalogs.push({
      id: "breathers",
      label: "Breathers",
      holds: "creatures",
      entries: [
        {
          id: "breather",
          label: "Breather",
          creature: {
            tier: "cr_1",
            health: 80,
            defense: 12,
            initiativeModifier: 0,
            speed: 30,
            actions: [
              {
                id: "breath",
                name: "Breath",
                budget: "action",
                damage: { flat: 4 },
                area: { ...area },
                targetCount: 2,
                range: 60,
              },
            ],
          },
        },
      ],
    });
    return doc;
  };
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const block: RulesetStatBlock = { health: 80, defense: 12, initiativeModifier: 0, speed: 30, actions: [] };
  const fight = (definition: RulesetDefinition, kind: "catalog" | "creature", board = true) => {
    const spells = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries!;
    const breather = definition.catalogs!.find((catalog) => catalog.id === "breathers")!.entries![0]!;
    const targets = [
      { id: "centre", x: 8, y: 7 },
      { id: "left", x: 8, y: 6 },
      { id: "right", x: 8, y: 8 },
    ];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        kind === "catalog"
          ? {
              id: "caster",
              name: "Caster",
              side: "party",
              build: rulesetSheetBuildSchema.parse({
                abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 16, cha: 10 },
                fields: { level: 3, ac: 12, speed: 30, hp_max: 80 },
                lists: {
                  spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
                },
              }),
              live: {},
              catalogs: { spells },
            }
          : { id: "caster", name: "Breather", side: "enemy", block: rulesetCreatureBlock(definition, breather)! },
        ...targets.map(({ id }) => ({ id, name: id, side: "enemy" as const, block })),
      ],
      ...(board
        ? {
            board: {
              grid: grid(),
              placements: { caster: origin, ...Object.fromEntries(targets.map(({ id, x, y }) => [id, { x, y }])) },
            },
          }
        : {}),
    });
    rulesetCombatant(state, "caster")!.side = "party";
    state.turn = state.order.indexOf("caster");
    const option = rulesetCombatOptions(definition, state, "caster").find(
      (one) => one.label === (kind === "catalog" ? "Bolt" : "Breath"),
    )!;
    assert.ok(option);
    return { state, option, action: rulesetCombatant(state, "caster")!.actions.find((one) => one.id === option.id)! };
  };
  for (const kind of ["catalog", "creature"] as const) {
    for (const [distance, width] of [
      [undefined, 1],
      [1, 1],
      [7.4, 1],
      [7.5, 2],
      [10, 2],
      [15, 3],
    ] as const) {
      const definition = parsedOrThrow(document(distance));
      const { state, option, action } = fight(definition, kind);
      assert.equal(action.area?.size, 3);
      assert.equal(action.area?.width, distance === undefined ? undefined : width);
      assert.equal(option.area?.width, action.area?.width);
      for (const [dx, dy] of directions) {
        const at = { x: origin.x + dx, y: origin.y + dy };
        const cells = coverage(dx, dy, width);
        const threeWide = coverage(dx, dy, 3);
        const placements = [threeWide[0]!, threeWide[3]!, threeWide[6]!];
        for (const [index, id] of ["centre", "left", "right"].entries()) {
          const target = rulesetCombatant(state, id)!;
          const cell = placements[index]!;
          target.x = cell.x;
          target.y = cell.y;
        }
        const expectedTargets = ["centre", "left", "right"].filter((_, index) =>
          keys(cells).includes(keys([placements[index]!])[0]!),
        );
        assert.deepEqual(rulesetAreaTargets(state, "caster", option.id, at), expectedTargets);
        const step = applyRulesetCombatChoice(
          definition,
          state,
          { actorId: "caster", optionId: option.id, at },
          () => 1,
        );
        const area = step.events.find((event) => event.type === "area");
        assert.ok(area?.type === "area", `${kind}: the area resolves`);
        assert.deepEqual(keys(area.cells), keys(cells));
        assert.deepEqual(
          step.events.filter((event) => event.type === "damage").map((event) => event.targetId),
          expectedTargets,
        );
      }
      const boardless = fight(definition, kind, false);
      assert.equal(boardless.option.area, undefined);
      assert.equal(boardless.option.targets.count, 2, "without a board only targetCount decides the limit");
      assert.equal(rulesetOptionTargets(definition, boardless.state, "caster", boardless.option).length, 3);
    }
  }
  const customUnits = fight(parsedOrThrow(document(10, "line", 10)), "catalog");
  assert.equal(customUnits.action.area?.size, 2, "the catalog's own cell unit rounds the length");
  assert.equal(customUnits.action.area?.width, 1, "and the width");

  for (const kind of ["catalog", "creature"] as const) {
    const only = (width: unknown, shape: string) => {
      const doc = document(width, shape);
      // Test each strict schema independently, so one refusal cannot hide a missing one.
      const other = doc.catalogs.at(kind === "catalog" ? -1 : -2).entries[0];
      if (kind === "catalog") delete other.creature.actions[0].area;
      else delete other.mechanics.area;
      return doc;
    };
    for (const shape of ["cone", "burst"]) {
      assert.equal(parseRulesetDefinition(only(undefined, shape)).ok, true);
      const parsed = parseRulesetDefinition(only(10, shape));
      assert.ok(!parsed.ok);
      assert.match(parsed.issues.join("; "), /Only a line (area|or a wall) may carry width/);
    }
    for (const width of [0, -1, "10", null, Infinity, NaN]) {
      assert.equal(parseRulesetDefinition(only(width, "line")).ok, false, `${kind}: invalid width ${width}`);
    }
  }

  assert.ok(rulesetItemUseSchema.safeParse({ kind: "attack", area: { shape: "line", size: 15 } }).success);
  // An item's use gives its line a width too (1.184), and nothing else one.
  assert.ok(rulesetItemUseSchema.safeParse({ kind: "attack", area: { shape: "line", size: 15, width: 10 } }).success);
  assert.equal(
    rulesetItemUseSchema.safeParse({ kind: "attack", area: { shape: "cone", size: 15, width: 10 } }).success,
    false,
  );

  // Compile each generated area node, so editor help refuses what the import refuses.
  const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Ajv = require("ajv");
  const ajv = new Ajv({ strict: false });
  let areas = 0;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (node.type === "object" && node.properties?.shape && node.properties.width) {
      areas++;
      const valid = ajv.compile(node);
      assert.ok(valid({ shape: "line", size: 15, width: 10 }));
      for (const shape of ["cone", "burst"]) {
        assert.ok(valid({ shape, size: 15 }));
        assert.equal(valid({ shape, size: 15, width: 10 }), false);
      }
      assert.equal(valid({ shape: "line", size: 15, width: 0 }), false);
    }
    Object.values(node).forEach(walk);
  };
  walk(read("../../docs/extending/ruleset.schema.json"));
  assert.ok(areas >= 2, "editor schema describes catalog and creature areas");

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-line-width",
    name: "Line width",
    version: "0.1.0",
    description: "A ruleset with wide lines.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/lines.json"] } },
    files: ["ruleset.json", "catalogs/lines.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const gate =
    "A ruleset whose lines are wider than one cell requires schemaVersion 2 and capabilityApi 1.128 or newer";
  for (const kind of ["catalog", "creature"] as const) {
    for (const file of [false, true]) {
      for (const width of [undefined, 5, 10]) {
        const doc = document();
        const catalog = doc.catalogs.at(kind === "catalog" ? -2 : -1);
        const area =
          kind === "catalog" ? catalog.entries[0].mechanics.area : catalog.entries[0].creature.actions[0].area;
        if (width !== undefined) area.width = width;
        const documents = new Map<string, unknown>();
        if (file) {
          documents.set("catalogs/lines.json", { entries: catalog.entries });
          delete catalog.entries;
          catalog.asset = "catalogs/lines.json";
        }
        assert.equal(
          getCapabilityPackageInstallIssue(manifest(127) as any, doc, documents),
          width === undefined ? null : gate,
        );
        assert.equal(getCapabilityPackageInstallIssue(manifest(128) as any, doc, documents), null);
        if (width !== undefined)
          assert.match(
            getCapabilityPackageInstallIssue({ ...manifest(128), schemaVersion: 1 } as any, doc, documents) ?? "",
            /requires schemaVersion 2/,
          );
      }
    }
  }
  console.info("Line width: legacy cells unchanged, wide lines agree in preview and resolution, gated at 1.128.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
