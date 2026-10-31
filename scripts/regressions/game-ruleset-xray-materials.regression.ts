/**
 * Sight through so much of each material (Capability API 1.759): 5e's Ring of X-ray Vision, "1 foot
 * of stone, 1 inch of common metal, or up to 3 feet of wood or dirt. Thicker substances block the
 * vision, as does a thin sheet of lead".
 *
 *   - A sense's `throughWalls` may name the most inches of each material it sees through, every wall
 *     on the line added up; a material it does not name stops it.
 *   - A board's own walls are what `combat.sight.boardWalls` says, each cell that thick; unsaid, they
 *     stop it. A cast wall is its own `material`.
 *   - Refusals and the install gate.
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
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-xray-materials-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 759);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const ring = { stone: 12, metal: 1, wood: 36, dirt: 36 };
  const wall = (material?: unknown) =>
    ({
      id: "wall",
      label: "Wall",
      rows: [{ list: "spells", values: { name: "Wall", level: 1, prepared: true } }],
      mechanics: {
        kind: "utility",
        area: { shape: "wall", size: 15 },
        range: 60,
        zone: { rounds: 10, triggers: [], blocks: ["move", "sight"], ...(material ? { material } : {}) },
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (options: { sense?: unknown; boardWalls?: unknown; material?: unknown } = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "xray", label: "X-ray Vision", throughWalls: options.sense ?? ring }];
    if (options.boardWalls) doc.combat.sight = { ...(doc.combat.sight ?? {}), boardWalls: options.boardWalls };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [wall(options.material)] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const brute = (id: string, side: "party" | "enemy", xray?: number) => ({
    id,
    name: id,
    side,
    block: {
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      ...(xray ? { senses: { xray } } : {}),
      actions: [],
    } as never,
  });

  // ── A board's own walls ──
  // Wall tiles at x 3 (and 4) between the seer at 0 and whoever stands at 6.
  const seesPastTiles = (definition: RulesetDefinition, walls: number[] = [3]) => {
    const tiles = [Array.from({ length: 12 }, (_, x) => (walls.includes(x) ? "wall" : "plains"))];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      board: {
        grid: { width: 12, height: 1, tiles },
        placements: { seer: { x: 0, y: 0 }, hidden: { x: 6, y: 0 } },
      } as never,
      combatants: [brute("seer", "party", 30), brute("hidden", "enemy")],
    });
    return rulesetCanSee(definition, state, rulesetCombatant(state, "seer")!, rulesetCombatant(state, "hidden")!);
  };
  assert.equal(seesPastTiles(parsed(fiveE())), false, "a wall the board says nothing of stops it");
  assert.equal(seesPastTiles(parsed(fiveE({ boardWalls: { of: "stone", inches: 60 } }))), false, "5 feet of stone");
  assert.equal(seesPastTiles(parsed(fiveE({ boardWalls: { of: "wood", inches: 36 } }))), true, "3 feet of wood");
  assert.equal(seesPastTiles(parsed(fiveE({ boardWalls: { of: "wood", inches: 36 } })), [3, 4]), false, "6 feet of it");
  assert.equal(seesPastTiles(parsed(fiveE({ boardWalls: { of: "lead", inches: 1 } }))), false, "never lead");
  assert.equal(seesPastTiles(parsed(fiveE({ sense: true }))), true, "a sense through every wall still sees");

  // ── A cast wall, of its own material ──
  const seesPastCast = (definition: RulesetDefinition) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    let state: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int", slots_max_1: 4 },
            lists: {
              spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            },
          }),
          catalogs: { spells: entries },
        },
        brute("seer", "party", 30),
        brute("hidden", "enemy"),
      ],
      board: {
        grid: { width: 15, height: 15, tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")) },
        placements: { mage: { x: 2, y: 7 }, seer: { x: 1, y: 7 }, hidden: { x: 7, y: 7 } },
      } as never,
    });
    state.order = ["mage", "seer", "hidden"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Wall")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 5, y: 7 } },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    state = step.state;
    assert.ok(state.board!.grid.walls?.["5,7"], "the wall stands between");
    return rulesetCanSee(definition, state, rulesetCombatant(state, "seer")!, rulesetCombatant(state, "hidden")!);
  };
  assert.equal(seesPastCast(parsed(fiveE({ material: { of: "stone", inches: 6 } }))), true, "6 inches of stone");
  assert.equal(seesPastCast(parsed(fiveE({ material: { of: "metal", inches: 1 } }))), true, "an inch of iron");
  assert.equal(seesPastCast(parsed(fiveE({ material: { of: "metal", inches: 2 } }))), false, "two inches");
  assert.equal(seesPastCast(parsed(fiveE({ material: { of: "lead", inches: 1 } }))), false, "lead");
  assert.equal(seesPastCast(parsed(fiveE())), false, "a wall of nothing it knows");
  assert.equal(
    seesPastCast(parsed(fiveE({ boardWalls: { of: "stone", inches: 6 } }))),
    true,
    "one with no material of its own is the board's",
  );

  // ── Refused ──
  refused(fiveE({ sense: {} }), /1 to 16 materials/);
  refused(fiveE({ sense: { stone: 0 } }), /throughWalls/);
  refused(fiveE({ boardWalls: { of: "Stone", inches: 6 } }), /boardWalls/);
  {
    const doc = fiveE();
    doc.catalogs.at(-1).entries[0].mechanics.zone.blocks = ["move"];
    doc.catalogs.at(-1).entries[0].mechanics.zone.material = { of: "stone", inches: 6 };
    refused(doc, /"material" is what sight goes through/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with sight through so much of each material (a sense's throughWalls naming materials, a wall's material, or combat.sight.boardWalls) requires schemaVersion 2 and capabilityApi 1.759 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(758) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(758) as never,
        fiveE({ sense: true, material: { of: "stone", inches: 6 } }),
      ),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(759) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(758) as never, fiveE({ sense: true })), gate);
  }

  console.log(
    "X-ray materials: sees through a foot of stone, an inch of metal, 3 feet of wood, never lead, the board's walls as the ruleset says and a cast wall as its own; gated at 1.759.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
