/**
 * Where each side begins (2026-10-24, Alyssa).
 *
 *   - The Game Master places every opponent: one started "behind" the party stands past it, one
 *     "among" it in its middle.
 *   - A party member the story put somewhere ("front": the wizard who walked in first) stands there,
 *     and the player does not move them.
 *   - Everyone else of the party the player sets down before the first turn: on a lit square near
 *     their side, never beside an opponent, never onto somebody else. Nobody acts until they begin.
 *   - A party the Engine plays all of has nobody to set down, and a fight built without asking for
 *     it (a test, a preview) starts at once.
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
  rulesetStartPlacements,
  rulesetWaterStarts,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-deploy-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { commandRulesetCombatDirector, createRulesetFight, directedRulesetView, rulesetDirectorStage } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const creatures = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!;
  const bestiary = { [creatures.id]: creatures.entries ?? [] };
  const lurker = `${creatures.id}/thorn-lurker`;
  const names = ["Ada", "Bram", "Cora"];
  const gap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  const begin = (opts: {
    deploy?: boolean;
    ai?: boolean;
    adaStart?: "front";
    allStart?: boolean;
    foeStarts?: Array<"behind" | "among">;
  }) => {
    const foes = opts.foeStarts ?? [undefined, undefined];
    const built = createRulesetFight({
      definition,
      seed: 9,
      positioned: true,
      ...(opts.deploy ? { deploy: true } : {}),
      party: names.map((name) => ({
        id: name.toLowerCase(),
        name,
        ...(name === "Ada" && opts.adaStart ? { start: opts.adaStart } : {}),
        ...(opts.allStart ? { start: "front" as const } : {}),
      })),
      enemies: foes.map((start, i) => ({
        id: `foe${i}`,
        name: `Foe ${i}`,
        creature: lurker,
        ...(start ? { start } : {}),
      })),
      cards: names.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } })),
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      speed: 1,
      level: 1,
      side,
      ...(opts.ai && side === "player" ? { controller: "ai" as const } : {}),
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: names.map((name) => unit(name.toLowerCase(), "player")),
      enemies: foes.map((_, i) => unit(`foe${i}`, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 9,
    });
    state.rulesetFight = built.fight;
    if (opts.ai) for (const name of names) state.rulesetFight.controllers[name.toLowerCase()] = "ai";
    state.stage = rulesetDirectorStage(state);
    return state;
  };
  const at = (state: ReturnType<typeof begin>, id: string) =>
    rulesetPositionOf(state.rulesetFight!.encounter.combatants.find((one) => one.id === id)!)!;
  const centre = (cells: Array<{ x: number; y: number }>) => ({
    x: cells.reduce((sum, one) => sum + one.x, 0) / cells.length,
    y: cells.reduce((sum, one) => sum + one.y, 0) / cells.length,
  });

  {
    // Nobody asked: the fight starts at once, as every fight did.
    const state = begin({});
    assert.equal(state.rulesetFight!.deploy, undefined);
    assert.notEqual(state.stage, "deploy");
  }

  {
    const state = begin({ deploy: true, adaStart: "front" });
    assert.equal(state.stage, "deploy", "the fight waits for the player to set the party down");
    const turns = () => state.rulesetFight!.events.filter((entry) => entry.event.type === "turn").length;
    assert.equal(turns(), 0, "nobody's turn is said before the fight begins");
    const view = directedRulesetView(definition, state)!;
    assert.deepEqual(view.deploy?.ids, ["bram", "cora"], "Ada, whom the story put at the front, is not theirs to move");
    assert.ok(view.deploy!.cells.length > 0, "there are squares to choose");
    const foes = ["foe0", "foe1"].map((id) => at(state, id));
    for (const cell of view.deploy!.cells)
      assert.ok(
        foes.every((foe) => gap(foe, cell) > 2),
        `no lit square beside an opponent: ${JSON.stringify(cell)}`,
      );
    // Ada stands nearer the foes than the rest of the party.
    const foeCentre = centre(foes);
    const toFoes = (id: string) => Math.hypot(at(state, id).x - foeCentre.x, at(state, id).y - foeCentre.y);
    assert.ok(toFoes("ada") < Math.min(toFoes("bram"), toFoes("cora")), "the one who walked in first is at the front");

    // Nobody acts while the party is being set down.
    const refused = commandRulesetCombatDirector(definition, state, { type: "continue" });
    assert.ok(!refused.ok && refused.code === "ruleset_combat_deploying", JSON.stringify(refused));
    const moved = commandRulesetCombatDirector(definition, state, {
      type: "deploy",
      unitId: "ada",
      to: view.deploy!.cells[0]!,
    });
    assert.ok(!moved.ok, "the player does not move whom the story placed");

    // A free lit square takes Bram; a held one, or one not lit, is refused.
    const held = new Set(state.rulesetFight!.encounter.combatants.map((one) => `${one.x},${one.y}`));
    const free = view.deploy!.cells.find((cell) => !held.has(`${cell.x},${cell.y}`))!;
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "deploy", unitId: "bram", to: free }).ok);
    assert.deepEqual(at(state, "bram"), free, "Bram stands where the player put him");
    assert.ok(
      !commandRulesetCombatDirector(definition, state, { type: "deploy", unitId: "cora", to: free }).ok,
      "nobody onto somebody else",
    );
    assert.ok(
      !commandRulesetCombatDirector(definition, state, { type: "deploy", unitId: "cora", to: foes[0]! }).ok,
      "nor onto a square that is not lit",
    );
    assert.equal(state.stage, "deploy");

    // Beginning the fight ends it, and the turns run.
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "deployed" }).ok);
    assert.equal(state.rulesetFight!.deploy, undefined);
    assert.ok(turns() >= 1, "and once it has, whose turn it is");
    assert.notEqual(state.stage, "deploy");
    assert.equal(directedRulesetView(definition, state)!.deploy, undefined);
    assert.ok(
      !commandRulesetCombatDirector(definition, state, { type: "deploy", unitId: "bram", to: free }).ok,
      "and nobody is set down once it has begun",
    );
  }

  {
    // A Game Master who started the whole party somewhere started nobody in particular (laptop party
    // A): the player still sets every one of them down.
    const state = begin({ deploy: true, allStart: true });
    assert.equal(state.stage, "deploy");
    assert.deepEqual(directedRulesetView(definition, state)!.deploy?.ids, ["ada", "bram", "cora"]);
  }

  {
    // Handing the last one the player plays to the Engine begins it as well.
    const state = begin({ deploy: true });
    for (const id of ["ada", "bram"])
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "control", unitId: id, controller: "ai" }).ok);
    assert.equal(state.stage, "deploy");
    assert.ok(
      commandRulesetCombatDirector(definition, state, { type: "control", unitId: "cora", controller: "ai" }).ok,
    );
    assert.equal(state.rulesetFight!.deploy, undefined, "with nobody left to set down, the fight begins");
  }

  {
    // The Game Master's places for opponents, read straight off a board.
    const grid: TacticalGrid = {
      width: 20,
      height: 12,
      tiles: Array.from({ length: 12 }, () => Array.from({ length: 20 }, () => "plains")),
    } as never;
    const placements = {
      a: { x: 2, y: 5 },
      b: { x: 2, y: 6 },
      c: { x: 3, y: 5 },
      x: { x: 16, y: 5 },
      y: { x: 16, y: 6 },
      z: { x: 17, y: 5 },
    };
    const stands = [
      { id: "a", side: "party" as const },
      { id: "b", side: "party" as const },
      { id: "c", side: "party" as const },
      { id: "x", side: "enemy" as const },
      { id: "y", side: "enemy" as const },
      { id: "z", side: "enemy" as const },
    ];
    const placed = rulesetStartPlacements(grid, placements, stands, { x: "behind", y: "among" });
    const party = centre([placements.a, placements.b, placements.c]);
    assert.ok(placed.x!.x < party.x, `one started behind the party stands past it: ${JSON.stringify(placed.x)}`);
    // And a step clear of its back, not beside a hero (laptop e8bd 2026-10-26).
    for (const hero of [placements.a, placements.b, placements.c])
      assert.ok(
        Math.max(Math.abs(hero.x - placed.x!.x), Math.abs(hero.y - placed.x!.y)) > 2,
        `one started behind stands clear of ${JSON.stringify(hero)}: ${JSON.stringify(placed.x)}`,
      );
    assert.ok(gap(placed.y!, party) <= 1, `one started among them stands in their middle: ${JSON.stringify(placed.y)}`);
    assert.deepEqual(placed.z, placements.z, "one with no place keeps its formation's");
    const keys = Object.values(placed).map((cell) => `${cell.x},${cell.y}`);
    assert.equal(new Set(keys).size, keys.length, "nobody onto anybody else");
    // A caster steps back from the front, a bruiser forward.
    const roles = rulesetStartPlacements(grid, placements, stands, {}, { a: "spellcaster", c: "bruiser" });
    assert.ok(roles.a!.x < placements.a.x, `the caster is set back: ${JSON.stringify(roles.a)}`);
    assert.ok(roles.c!.x > placements.c.x, `the bruiser forward: ${JSON.stringify(roles.c)}`);
  }

  {
    // One at home in water begins in it (laptop 2026-10-30: reef sharks "in the deep water" stood on the
    // plains and bit from there); a walker, a flier, the party and a dry board change nothing.
    const tiles = Array.from({ length: 6 }, () => Array.from({ length: 12 }, () => "plains"));
    for (const row of tiles) for (let x = 6; x <= 8; x++) row[x] = "water";
    const grid = { width: 12, height: 6, tiles } as never as TacticalGrid;
    const placements = {
      hero: { x: 1, y: 2 },
      shark: { x: 10, y: 2 },
      croc: { x: 10, y: 3 },
      wolf: { x: 10, y: 4 },
      gull: { x: 11, y: 2 },
      merfolk: { x: 1, y: 3 },
    };
    const swimmers = [
      { id: "hero", side: "party", walk: 30, swim: 30 },
      { id: "shark", side: "enemy", walk: 0, swim: 40 },
      { id: "croc", side: "enemy", walk: 20, swim: 30 },
      { id: "wolf", side: "enemy", walk: 50 },
      { id: "gull", side: "enemy", walk: 10, swim: 30, fly: 60 },
      { id: "merfolk", side: "party", walk: 10, swim: 40 },
    ];
    const wet = rulesetWaterStarts(grid, placements, swimmers);
    assert.equal(tiles[wet.shark!.y]![wet.shark!.x], "water");
    assert.deepEqual(wet.shark, { x: 8, y: 2 }, "the nearest water to where it was put");
    assert.equal(tiles[wet.croc!.y]![wet.croc!.x], "water", "one that swims faster than it walks");
    for (const id of ["hero", "wolf", "gull", "merfolk"] as const) assert.deepEqual(wet[id], placements[id], id);
    const keys = Object.values(wet).map((cell) => `${cell.x},${cell.y}`);
    assert.equal(new Set(keys).size, keys.length, "nobody onto anybody else");
    const dry = { width: 12, height: 6, tiles: Array.from({ length: 6 }, () => Array(12).fill("plains")) } as never;
    assert.deepEqual(rulesetWaterStarts(dry, placements, swimmers), placements, "no water, no change");
    // A Large one takes a square of water wide enough for all of it (laptop 2026-10-30: Large crocodiles
    // stayed on the shore), clear of the others in it.
    const big = rulesetWaterStarts(grid, { ...placements, croc: { x: 10, y: 3 } }, [
      ...swimmers.filter((one) => one.id !== "croc"),
      { id: "croc", side: "enemy", walk: 20, swim: 30, span: 2 },
    ]);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const)
      assert.equal(
        tiles[big.croc!.y + dy]![big.croc!.x + dx],
        "water",
        `all of it in water: ${JSON.stringify(big.croc)}`,
      );
    assert.ok(
      !(
        big.shark!.x >= big.croc!.x &&
        big.shark!.x <= big.croc!.x + 1 &&
        big.shark!.y >= big.croc!.y &&
        big.shark!.y <= big.croc!.y + 1
      ),
      "not over the shark",
    );
  }

  {
    // An ambush on a vast board (laptop party A): the foes ring the party, so a "rear" one goes out past
    // the ring by the board's size, and a pack on a flank keeps to one side together.
    const grid = {
      width: 40,
      height: 26,
      tiles: Array.from({ length: 26 }, () => Array.from({ length: 40 }, () => "plains")),
    } as never;
    const placements: Record<string, { x: number; y: number }> = {
      a: { x: 20, y: 13 },
      b: { x: 20, y: 14 },
      archer: { x: 23, y: 13 },
      z1: { x: 17, y: 13 },
      z2: { x: 20, y: 10 },
      g1: { x: 20, y: 17 },
      g2: { x: 23, y: 16 },
    };
    const stands = [
      { id: "a", side: "party" as const },
      { id: "b", side: "party" as const },
      { id: "archer", side: "enemy" as const, group: "archer" },
      { id: "z1", side: "enemy" as const, group: "zombie" },
      { id: "z2", side: "enemy" as const, group: "zombie" },
      { id: "g1", side: "enemy" as const, group: "ghoul" },
      { id: "g2", side: "enemy" as const, group: "ghoul" },
    ];
    const placed = rulesetStartPlacements(grid, placements, stands, {
      archer: "rear",
      z1: "flank",
      z2: "flank",
      g1: "flank",
      g2: "flank",
    });
    const party = centre([placements.a!, placements.b!]);
    assert.ok(gap(placed.archer!, party) >= 9, `the rear is well out past the ring: ${JSON.stringify(placed.archer)}`);
    const sideOf = (cell: { x: number; y: number }) => Math.sign(cell.y - party.y) || Math.sign(cell.x - party.x);
    assert.equal(sideOf(placed.z1!), sideOf(placed.z2!), "the zombies keep one flank");
    assert.equal(sideOf(placed.g1!), sideOf(placed.g2!), "the ghouls keep one flank");
    assert.notEqual(sideOf(placed.z1!), sideOf(placed.g1!), "the ghouls take the other");
  }

  {
    // Sides apart (a defense board): a flank is off to the party's side and held back toward its own,
    // not beside the party (laptop interim 2026-10-26: flanking skeletons began two cells from a hero).
    const grid = {
      width: 20,
      height: 12,
      tiles: Array.from({ length: 12 }, () => Array.from({ length: 20 }, () => "plains")),
    } as never;
    const placements: Record<string, { x: number; y: number }> = {
      a: { x: 4, y: 5 },
      b: { x: 4, y: 6 },
      lich: { x: 15, y: 5 },
      s1: { x: 15, y: 6 },
      s2: { x: 15, y: 7 },
    };
    const stands = [
      { id: "a", side: "party" as const },
      { id: "b", side: "party" as const },
      { id: "lich", side: "enemy" as const, group: "lich" },
      { id: "s1", side: "enemy" as const, group: "skeleton" },
      { id: "s2", side: "enemy" as const, group: "skeleton" },
    ];
    const placed = rulesetStartPlacements(grid, placements, stands, { lich: "rear", s1: "flank", s2: "flank" });
    for (const id of ["s1", "s2"]) {
      const near = Math.min(gap(placed[id]!, placements.a!), gap(placed[id]!, placements.b!));
      assert.ok(near >= 4, `${id} keeps its distance: ${JSON.stringify(placed[id])}`);
      assert.ok(placed[id]!.x > placements.a!.x, `${id} is held back toward its own side`);
    }
  }

  {
    // One kind alone on the flanks is split between both, each out of the party's reach (laptop pass 8
    // 2026-10-26: four zombies bunched at one edge, one beside a hero).
    const grid = {
      width: 14,
      height: 10,
      tiles: Array.from({ length: 10 }, () => Array.from({ length: 14 }, () => "plains")),
    } as never;
    const placements: Record<string, { x: number; y: number }> = {
      a: { x: 12, y: 3 },
      b: { x: 12, y: 5 },
      c: { x: 12, y: 7 },
      lich: { x: 2, y: 5 },
      z1: { x: 2, y: 3 },
      z2: { x: 2, y: 4 },
      z3: { x: 2, y: 6 },
      z4: { x: 2, y: 7 },
    };
    const stands = [
      { id: "a", side: "party" as const },
      { id: "b", side: "party" as const },
      { id: "c", side: "party" as const },
      { id: "lich", side: "enemy" as const, group: "lich" },
      ...["z1", "z2", "z3", "z4"].map((id) => ({ id, side: "enemy" as const, group: "zombie" })),
    ];
    const placed = rulesetStartPlacements(grid, placements, stands, {
      lich: "front",
      z1: "flank",
      z2: "flank",
      z3: "flank",
      z4: "flank",
    });
    const party = centre([placements.a!, placements.b!, placements.c!]);
    const sides = ["z1", "z2", "z3", "z4"].map((id) => Math.sign(placed[id]!.y - party.y));
    assert.deepEqual(sides.slice().sort(), [-1, -1, 1, 1], `two on each flank: ${JSON.stringify(placed)}`);
    for (const id of ["z1", "z2", "z3", "z4"]) {
      const near = Math.min(...["a", "b", "c"].map((hero) => gap(placed[id]!, placements[hero]!)));
      assert.ok(near >= 3, `${id} keeps its distance: ${JSON.stringify(placed[id])}`);
    }
  }

  {
    // Foes sent round both flanks of a party in a ring begin a step clear of its line, not beside it
    // (laptop 0706 Party B: a bandit began next to Lyra, crossbowmen in reach of her).
    const grid = {
      width: 12,
      height: 10,
      tiles: Array.from({ length: 10 }, () => Array.from({ length: 12 }, () => "plains")),
    } as never;
    const placements: Record<string, { x: number; y: number }> = {
      a: { x: 5, y: 5 },
      b: { x: 6, y: 5 },
      c: { x: 7, y: 5 },
      b1: { x: 4, y: 4 },
      b2: { x: 4, y: 6 },
      x1: { x: 8, y: 4 },
      x2: { x: 8, y: 6 },
    };
    const stands = [
      { id: "a", side: "party" as const },
      { id: "b", side: "party" as const },
      { id: "c", side: "party" as const },
      { id: "b1", side: "enemy" as const, group: "bandit" },
      { id: "b2", side: "enemy" as const, group: "bandit" },
      { id: "x1", side: "enemy" as const, group: "crossbow" },
      { id: "x2", side: "enemy" as const, group: "crossbow" },
    ];
    const placed = rulesetStartPlacements(grid, placements, stands, {
      b1: "flank",
      b2: "flank",
      x1: "flank",
      x2: "flank",
    });
    for (const id of ["b1", "b2", "x1", "x2"]) {
      const near = Math.min(...["a", "b", "c"].map((hero) => gap(placed[id]!, placements[hero]!)));
      assert.ok(near >= 3, `${id} keeps its distance: ${JSON.stringify(placed)}`);
    }
  }

  console.info(
    "Ruleset deployment: the Game Master places opponents and anyone the story put somewhere, the player sets down the rest before the first turn.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
