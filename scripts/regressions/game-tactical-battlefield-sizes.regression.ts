/**
 * The larger boards (2026-10-24, Alyssa: a fireball took up most of the board; some fights are in a
 * dragon's castle ruins or on a war's battlefield).
 *
 *   - Huge 24x16, vast 40x26 and colossal 64x40 boards generate, a brief may name them, and past 20
 *     fighters the Engine picks the huge one by itself.
 *   - On a board larger than the huge one the sides line up on its middle, not a whole battlefield
 *     apart: the strips are plains there, the formations land there, and a feature is as big as the
 *     board's scale.
 *   - A ruleset fight left to the Engine whose board has no room for the gaps its blasts need grows
 *     to a size that has, up to the vast one; one the Game Master or the player sized stays as named.
 *   - A turn on the colossal board still takes a moment, not a minute.
 *   - Shaped boards (2026-10-24, Alyssa: why are all the maps rectangular?): a round tower, a cavern,
 *     a valley and a broken ruin, each its place's by default (a cave a cavern). Off the map is a wall
 *     drawn as nothing; the strips the sides line up on stay on the map, all of it is one piece, and
 *     nobody is placed off it. A saved board whose cells off the map are not walls is refused, and
 *     nothing that changes the ground changes them.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetPositionOf,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import {
  tacticalOutsideValid,
  tacticalOutlineFor,
} from "../../packages/shared/src/features/tactical-combat/board-outline.js";
import { isImpassable } from "../../packages/shared/src/features/tactical-combat/math.js";
import { summarizeTacticalBattlefield } from "../../packages/shared/src/features/tactical-combat/battlefield-summary.js";
import { rulesetChangeGround } from "../../packages/shared/src/features/ruleset-combat/board-events.js";
import {
  defaultBattlefieldSize,
  generateTacticalBattlefield,
  placeSpawns,
  tacticalArena,
  tacticalEngagement,
  validateTacticalBattlefieldBrief,
} from "../../packages/shared/src/features/tactical-combat/grid-gen.js";
import { deterministicRng } from "../../packages/shared/src/features/tactical-combat/rng.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-battlefield-sizes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight, rulesetClosingMove, pickRulesetChoice } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");

try {
  // ── The boards themselves ──
  for (const [size, width, height] of [
    ["huge", 24, 16],
    ["vast", 40, 26],
    ["colossal", 64, 40],
  ] as const) {
    assert.ok(validateTacticalBattlefieldBrief({ size }).ok, `a brief may name ${size}`);
    const made = generateTacticalBattlefield(8, deterministicRng(7, 0), "forest", { size });
    assert.ok(made.ok, made.ok ? "" : made.error);
    assert.equal(made.grid.width, width, `${size} is ${width} across`);
    assert.equal(made.grid.height, height, `${size} is ${height} down`);
    const arena = tacticalEngagement(made.grid);
    // The strips the sides line up on: plains, at the two sides of where they engage.
    for (let y = arena.y; y < arena.y + arena.height; y++)
      for (const x of [arena.x, arena.x + 1, arena.x + arena.width - 2, arena.x + arena.width - 1])
        assert.equal(made.grid.tiles[y]![x], "plains", `${size}: the strip at ${x},${y} is plains`);
    const units = [
      ...[0, 1, 2, 3].map((i) => ({ side: "party" as const, x: 0, y: 0, id: `p${i}` })),
      ...[0, 1, 2, 3].map((i) => ({ side: "enemy" as const, x: 0, y: 0, id: `e${i}` })),
    ];
    assert.ok(placeSpawns(made.grid, units, "line", deterministicRng(7, 1), made.protectedTiles));
    for (const unit of units) {
      assert.ok(
        unit.x >= arena.x && unit.x < arena.x + arena.width && unit.y >= arena.y && unit.y < arena.y + arena.height,
        `${size}: ${unit.id} lines up in the arena: ${JSON.stringify(unit)} in ${JSON.stringify(arena)}`,
      );
    }
    const across =
      Math.min(...units.filter((u) => u.side === "enemy").map((u) => u.x)) -
      Math.max(...units.filter((u) => u.side === "party").map((u) => u.x));
    // No farther apart than on a large board, whatever the size (re-test B1).
    assert.ok(across <= 12, `${size}: the sides start ${across} apart, as on a large board`);
  }
  assert.deepEqual(tacticalArena({ width: 14, height: 10 }), { x: 0, y: 0, width: 14, height: 10 });
  assert.deepEqual(tacticalArena({ width: 64, height: 40 }), { x: 16, y: 10, width: 32, height: 20 });
  assert.deepEqual(tacticalEngagement({ width: 64, height: 40 }), { x: 25, y: 10, width: 14, height: 20 });
  assert.deepEqual(tacticalEngagement({ width: 24, height: 16 }), { x: 5, y: 0, width: 14, height: 16 });
  assert.deepEqual(tacticalEngagement({ width: 12, height: 8 }), { x: 0, y: 0, width: 12, height: 8 });
  assert.equal(defaultBattlefieldSize(21), "huge", "past 20 fighters, the huge board");
  assert.equal(defaultBattlefieldSize(9), "large");
  // A wall on the colossal board is a wall, not three squares of it.
  const walled = generateTacticalBattlefield(8, deterministicRng(3, 0), "forest", {
    size: "colossal",
    features: [{ terrain: "wall", placement: "center", shape: "barrier" }],
  });
  assert.ok(walled.ok);
  assert.ok(walled.protectedTiles.size >= 40, `the wall scales with the board: ${walled.protectedTiles.size} squares`);

  // ── Shaped boards ──
  assert.equal(tacticalOutlineFor("cave"), "cavern");
  assert.equal(tacticalOutlineFor("ruins"), "broken");
  assert.equal(tacticalOutlineFor("plains"), "box");
  assert.ok(validateTacticalBattlefieldBrief({ outline: "round" }).ok);
  assert.ok(!validateTacticalBattlefieldBrief({ outline: "star" }).ok, "an unknown outline is refused");
  const plainBox = generateTacticalBattlefield(8, deterministicRng(1, 0), "plains", { size: "large" });
  assert.ok(plainBox.ok && !plainBox.grid.outside, "open ground stays a box");
  for (const outline of ["round", "cavern", "valley", "broken"] as const) {
    for (const size of ["small", "large", "huge", "vast", "colossal"] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const made = generateTacticalBattlefield(10, deterministicRng(seed, 0), "forest", {
          size,
          outline,
          features: [{ terrain: "water", placement: "north", shape: "patch" }],
        });
        const where = `${outline} ${size} seed ${seed}`;
        assert.ok(made.ok, `${where}: ${made.ok ? "" : made.error}`);
        const { grid } = made;
        assert.ok(grid.outside, `${where}: cut to its outline`);
        assert.ok(tacticalOutsideValid(grid), `${where}: off the map is wall`);
        const off = grid.outside!.flat().filter(Boolean).length;
        assert.ok(off > 0, `${where}: some of it is off the map`);
        assert.ok(off < grid.width * grid.height * 0.6, `${where}: most of it is on the map (${off} off)`);
        const arena = tacticalEngagement(grid);
        for (let y = arena.y; y < arena.y + arena.height; y++)
          for (const x of [arena.x, arena.x + 1, arena.x + arena.width - 2, arena.x + arena.width - 1])
            assert.ok(!grid.outside![y]![x] && grid.tiles[y]![x] === "plains", `${where}: the strip at ${x},${y}`);
        // One piece: every cell on the map that is not a wall's own reaches the middle around walls.
        const units = [
          ...[0, 1, 2, 3, 4].map((i) => ({ side: "party" as const, x: 0, y: 0, id: `p${i}` })),
          ...[0, 1, 2, 3, 4].map((i) => ({ side: "enemy" as const, x: 0, y: 0, id: `e${i}` })),
        ];
        for (const formation of ["line", "ambush", "surrounded", "skirmish", "defense"] as const) {
          const board = structuredClone(grid);
          assert.ok(
            placeSpawns(board, units, formation, deterministicRng(seed, 1), made.protectedTiles),
            `${where} ${formation}: placed`,
          );
          assert.ok(tacticalOutsideValid(board), `${where} ${formation}: no corridor off the map`);
          for (const unit of units) {
            assert.ok(!board.outside![unit.y]![unit.x], `${where} ${formation}: ${unit.id} on the map`);
            assert.ok(!isImpassable(board, unit.x, unit.y), `${where} ${formation}: ${unit.id} on open ground`);
          }
        }
      }
    }
  }
  const cave = generateTacticalBattlefield(8, deterministicRng(4, 0), "cave", undefined);
  assert.ok(cave.ok && cave.grid.outside, "a cave is a cavern by itself");
  assert.equal((cave as { battlefield: { outline?: string } }).battlefield.outline, "cavern");
  assert.match(
    summarizeTacticalBattlefield({ seed: 4, environment: "cave", battlefield: cave.battlefield, grid: cave.grid }) ??
      "",
    /Outline: cavern, \d+ squares off the map/,
    "the Game Master is told its outline",
  );
  // Saved: off the map must be wall; nothing that changes the ground changes it.
  const broken = structuredClone(cave.grid);
  const offCell = (() => {
    for (let y = 0; y < broken.height; y++)
      for (let x = 0; x < broken.width; x++) if (broken.outside![y]![x]) return { x, y };
    throw new Error("no cell off the map");
  })();
  broken.tiles[offCell.y]![offCell.x] = "plains";
  assert.equal(tacticalOutsideValid(broken), false, "a board with open ground off the map is refused");
  const ground = { board: { grid: structuredClone(cave.grid), placements: {} }, combatants: [] } as never;
  rulesetChangeGround(ground, [offCell], { terrain: "plains" } as never);
  assert.equal((ground as any).board.grid.tiles[offCell.y][offCell.x], "wall", "the ground off the map never changes");

  // ── A ruleset fight that needs room ──
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const slam = { id: "slam", name: "Slam", budget: "action", toHit: 5, reach: 5, damage: { dice: "1d6" } };
  const fireball = {
    id: "fireball",
    name: "Fireball",
    budget: "action",
    range: { normal: 150 },
    autoHit: true,
    damage: { dice: "8d6", type: "fire" },
    area: { shape: "burst", size: 20 },
  };
  const withMage = (actions: Record<string, unknown>[]): RulesetDefinition => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    const mage = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
    mage.id = "mage";
    mage.label = "Mage";
    mage.creature.actions = actions;
    creatures.entries.push(mage);
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const names = ["Ada", "Bram", "Cora", "Dain"];
  const fight = (definition: RulesetDefinition, battlefield?: unknown, enemies = 1, environment?: string) => {
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition,
      seed: 5,
      positioned: true,
      ...(battlefield ? { battlefield } : {}),
      ...(environment ? { environment } : {}),
      party: names.map((name) => ({ id: name.toLowerCase(), name })),
      enemies: Array.from({ length: enemies }, (_, i) => ({
        id: i === 0 ? "mage" : `mage${i}`,
        name: i === 0 ? "Mage" : `Mage ${i}`,
        creature: `${creaturesId}/mage`,
      })),
      cards: names.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } })),
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    return (built as { fight: { encounter: any } }).fight.encounter;
  };
  const gap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const party = (encounter: any) =>
    names.map((name) =>
      rulesetPositionOf(encounter.combatants.find((one: { id: string }) => one.id === name.toLowerCase()))!,
    );
  const closest = (cells: { x: number; y: number }[]) =>
    Math.min(...cells.flatMap((a, i) => cells.slice(i + 1).map((b) => gap(a, b))));

  const plain = fight(withMage([slam]));
  assert.equal(plain.board.grid.width, 12, "with nothing that blasts, the board its head count gives");
  const grown = fight(withMage([slam, fireball]));
  assert.equal(grown.board.grid.width, 24, "a 20-foot fireball needs the huge board for four kept clear of it");
  assert.ok(
    closest(party(grown)) >= 5,
    `and there the party keeps exactly clear of it: ${JSON.stringify(party(grown))}`,
  );
  const caved = fight(withMage([slam]), undefined, 1, "cave");
  assert.ok(caved.board.grid.outside, "a ruleset fight in a cave is fought in a cavern");
  for (const one of caved.combatants) assert.ok(!caved.board.grid.outside[one.y][one.x], `${one.id} stands on the map`);
  const named = fight(withMage([slam, fireball]), { size: "small" });
  assert.equal(named.board.grid.width, 12, "a size the Game Master named stays as named");

  // ── A turn on the colossal board ──
  const mages = withMage([slam, fireball]);
  const big = fight(mages, { size: "colossal" }, 8);
  assert.equal(big.board.grid.width, 64);
  big.turn = big.order.indexOf("ada");
  let started = performance.now();
  const move = rulesetClosingMove(mages, big, "ada");
  const walked = performance.now() - started;
  assert.ok(move?.to, "it closes in across the colossal board");
  assert.ok(walked < 5000, `a closing walk on 64 by 40 takes ${Math.round(walked)} ms`);
  // A whole turn picked by the Engine, for a mage holding a fireball.
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 20,
    maxHp: 20,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 9,
    skills: [],
  });
  const state = createCombatDirector({
    id: "fight",
    anchor: "anchor",
    style: "ruleset",
    party: big.combatants.filter((one: any) => one.side === "party").map((one: any) => unit(one.id, "player")),
    enemies: big.combatants.filter((one: any) => one.side === "enemy").map((one: any) => unit(one.id, "enemy")),
    gm: false,
    difficulty: "normal",
    seed: 3,
  } as never);
  big.turn = big.order.indexOf("mage");
  started = performance.now();
  const picked = pickRulesetChoice(mages, state, big, "mage");
  const turned = performance.now() - started;
  assert.ok(picked, "the mage picks something");
  assert.ok(turned < 15000, `a mage's turn on 64 by 40 takes ${Math.round(turned)} ms`);
  console.log(
    `Battlefield sizes: huge, vast and colossal boards line up on their middle, a fight a blast needs room for grows (to ${grown.board.grid.width} by ${grown.board.grid.height}), a named size stays; on the colossal board a walk took ${Math.round(walked)} ms and a mage's turn ${Math.round(turned)} ms.`,
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
