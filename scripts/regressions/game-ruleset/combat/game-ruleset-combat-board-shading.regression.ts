/**
 * Light and fog drawn on the fight board.
 *
 *   - `rulesetBoardShading`: each cell's light where it is not bright, and each cell a fog or haze
 *     covers, the same light `rulesetLightAt` reads cell by cell.
 *   - The director's view carries them on its grid, only when there is something to draw.
 *   - The client's board cells and what a square says aloud.
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
  rowsFromCatalogEntry,
  rulesetBoardShading,
  rulesetCombatOptions,
  rulesetLightAt,
  rulesetSheetBuildSchema,
  type DirectedRulesetView,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import { rulesetBoardCells, rulesetCellSentences } from "../../../../packages/client/src/lib/ruleset-combat-board.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-board-shading-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { directedRulesetView } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "utility", cost: [{ pool: "slots_1", amount: 1 }], ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const zone = (id: string, size: number, rest: Record<string, unknown>) =>
    spell(id, { area: { shape: "burst", size }, range: 120, zone: { rounds: 10, triggers: [], ...rest } });
  const spells = [
    zone("daylight", 20, { lights: { bright: 10, dim: 10 } }),
    zone("sunbeam", 5, { lights: { bright: 5, dim: 0, sunlight: true } }),
    zone("dark", 5, { obscures: { darkness: true } }),
    zone("fog", 5, { obscures: {} }),
    zone("haze", 10, { obscures: { light: true } }),
  ];
  const fiveE = (real: boolean): RulesetDefinition => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    if (real) doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const real = fiveE(true);
  const plain = fiveE(false);
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const block = (): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  });
  const fight = (definition: RulesetDefinition, light?: "bright" | "dim" | "dark"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "a", name: "A", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 24, height: 15, tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, a: { x: 20, y: 7 } },
        ...(light ? { light } : {}),
      },
    });
    state.order = ["mage", "a"];
    state.turn = 0;
    return state;
  };
  const cast = (definition: RulesetDefinition, state: RulesetEncounterState, label: string, at: RulesetCombatCell) => {
    state.turn = 0;
    state.combatants.find((one) => one.id === "mage")!.budgets = { action: 1, bonus: 1, reaction: 1 } as never;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step.state;
  };
  // Every cell the shading lists matches rulesetLightAt, and every cell it leaves out is bright.
  const agrees = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    const { light } = rulesetBoardShading(definition, state);
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 24; x++) {
        assert.equal(light[`${x},${y}`] ?? "bright", rulesetLightAt(definition, state, { x, y }), `${x},${y}`);
      }
    }
    return light;
  };

  // ── A dark board, Daylight cast into it ──
  {
    const lit = cast(real, fight(real, "dark"), "Daylight", { x: 12, y: 7 });
    const light = agrees(real, lit);
    assert.equal(light["12,7"], undefined, "its middle is bright");
    assert.equal(light["15,7"], "dim");
    assert.equal(light["17,7"], "dark");
    assert.equal(light["0,0"], "dark");
  }

  // ── A bright board: only sunlight and magical darkness show ──
  {
    const bright = fight(real);
    assert.deepEqual(rulesetBoardShading(real, bright), { light: {}, fog: {} }, "nothing to draw");
    const sunny = cast(real, bright, "Sunbeam", { x: 12, y: 7 });
    const light = agrees(real, sunny);
    assert.equal(light["12,7"], "sunlight");
    assert.equal(light["13,7"], "sunlight");
    assert.equal(light["14,7"], undefined);
    const darkened = cast(real, fight(real), "Dark", { x: 12, y: 7 });
    const shade = agrees(real, darkened);
    assert.equal(shade["12,7"], "dark", "magical darkness on a bright board");
    assert.equal(shade["14,7"], undefined);
    // A torch beside it lights all around but not inside the magical darkness.
    const torch = fight(real);
    const a = torch.combatants.find((one) => one.id === "a")!;
    a.block = { ...a.block!, light: { bright: 20, dim: 20 } } as never;
    a.x = 14;
    a.y = 7;
    const torchlit = agrees(real, cast(real, torch, "Dark", { x: 12, y: 7 }));
    assert.equal(torchlit["12,7"], "dark", "torchlight does not reach into it");
  }

  // ── A dim board: dim everywhere nobody lights ──
  {
    const light = agrees(real, fight(real, "dim"));
    assert.equal(Object.keys(light).length, 24 * 15);
    assert.equal(light["5,5"], "dim");
  }

  // ── A ruleset where the dark is not real: the board's own light, everywhere ──
  {
    assert.equal(rulesetBoardShading(plain, fight(plain, "dark")).light["3,3"], "dark");
    assert.equal(Object.keys(rulesetBoardShading(plain, fight(plain, "dim")).light).length, 24 * 15);
    assert.deepEqual(rulesetBoardShading(plain, fight(plain)).light, {});
    // Its darkness spell only obscures: no dark drawn on a bright board.
    const darkened = cast(plain, fight(plain), "Dark", { x: 12, y: 7 });
    assert.deepEqual(agrees(plain, darkened), {});
    assert.equal(rulesetBoardShading(plain, darkened).fog["12,7"], "heavy");
  }

  // ── Fog heavy, haze light; where both lie it is heavy ──
  {
    const fogged = cast(real, fight(real), "Fog", { x: 12, y: 7 });
    const both = cast(real, fogged, "Haze", { x: 13, y: 7 });
    const { fog } = rulesetBoardShading(real, both);
    assert.equal(fog["12,7"], "heavy", "fog over haze");
    assert.equal(fog["15,7"], "light", "haze alone");
    assert.equal(fog["16,7"], undefined);
    // The other order cast, the same.
    const hazed = cast(real, cast(real, fight(real), "Haze", { x: 13, y: 7 }), "Fog", { x: 12, y: 7 });
    assert.equal(rulesetBoardShading(real, hazed).fog["12,7"], "heavy", "haze over fog");
    // Off a grid, nothing.
    const off = fight(real);
    delete (off.board as { grid?: unknown }).grid;
    assert.deepEqual(rulesetBoardShading(real, off), { light: {}, fog: {} });
  }

  // ── The director's view and the client's squares ──
  {
    const fogged = cast(real, cast(real, fight(real, "dark"), "Daylight", { x: 12, y: 7 }), "Fog", { x: 2, y: 2 });
    const director = (encounter: RulesetEncounterState) =>
      directedRulesetView(real, {
        style: "ruleset",
        rulesetFight: { encounter, events: [], eventSeq: 0, controllers: {}, live: {}, adjustments: [] },
      } as never) as DirectedRulesetView;
    const view = director(fogged);
    assert.equal(view.grid?.light?.["15,7"], "dim");
    assert.equal(view.grid?.light?.["12,7"], undefined);
    assert.equal(view.grid?.fog?.["2,2"], "heavy");
    const clear = director(fight(real));
    assert.equal(clear.grid?.light, undefined, "no light map on a bright board");
    assert.equal(clear.grid?.fog, undefined, "no fog map in clear air");
    const t = ((key: string) => key) as never;
    const cells = rulesetBoardCells(view, null);
    const at = (x: number, y: number) => cells.find((cell) => cell.x === x && cell.y === y)!;
    assert.equal(at(15, 7).light, "dim");
    assert.equal(at(12, 7).light, undefined);
    assert.equal(at(17, 7).light, "dark");
    assert.equal(at(2, 2).fog, "heavy");
    assert.equal(at(5, 5).fog, undefined);
    const said = rulesetCellSentences(at(2, 2), view, t);
    assert.ok(said.includes("game.combat.ruleset.board.light.dark"), JSON.stringify(said));
    assert.ok(said.includes("game.combat.ruleset.board.fog.heavy"), JSON.stringify(said));
    assert.ok(rulesetCellSentences(at(15, 7), view, t).includes("game.combat.ruleset.board.light.dim"));
    assert.ok(!rulesetCellSentences(at(12, 7), view, t).some((line) => /\.(light|fog)\./u.test(line)));
    const haze = cast(real, fight(real), "Haze", { x: 13, y: 7 });
    const hazeCells = rulesetBoardCells(director(haze), null);
    const hazed = hazeCells.find((cell) => cell.x === 13 && cell.y === 7)!;
    assert.equal(hazed.fog, "light");
    assert.ok(rulesetCellSentences(hazed, director(haze), t).includes("game.combat.ruleset.board.fog.light"));
    const sunny = director(cast(real, fight(real), "Sunbeam", { x: 12, y: 7 }));
    const sunCell = rulesetBoardCells(sunny, null).find((cell) => cell.x === 12 && cell.y === 7)!;
    assert.ok(rulesetCellSentences(sunCell, sunny, t).includes("game.combat.ruleset.board.light.sunlight"));
  }

  console.log("Board shading: light and fog cell by cell, carried on the view, drawn and said on the squares.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
