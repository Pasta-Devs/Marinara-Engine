/**
 * A creature's move toward a hostile it can see, on its own turn (Capability API 1.607): an orc's
 * Aggressive.
 *
 *   - `move.toward: "seen-hostile"` on an action that does nothing but move: offered on its own turn
 *     with its budget, every cell it offers reached by steps that each bring it nearer a hostile it
 *     can see, and its turn's own movement kept.
 *   - Seeing no hostile, it is not offered.
 *   - The install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-aggressive-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 607);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const aggressive = { id: "aggressive", name: "Aggressive", budget: "bonus", move: { toward: "seen-hostile" } };
  const greataxe = {
    id: "greataxe",
    name: "Greataxe",
    budget: "action",
    toHit: 5,
    damage: { dice: "1d12", flat: 3, type: "slashing" },
    reach: 5,
  };
  const fiveE = (actions: unknown[] = [greataxe, aggressive]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    const orc = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
    orc.id = "orc";
    orc.label = "Orc";
    orc.creature.speed = 30;
    orc.creature.actions = actions;
    creatures.entries.push(orc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const creatures = definition.catalogs!.find((catalog) => catalog.holds === "creatures")!;
  const block = creatures.entries!.find((one) => one.id === "orc")!.creature as unknown as RulesetStatBlock;
  const fight = (wall = false): RulesetEncounterState => {
    const tiles = Array.from({ length: 5 }, () => Array(14).fill("plains"));
    if (wall) for (let y = 0; y < 5; y++) tiles[y]![4] = "wall";
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "orc", name: "Orc", side: "enemy", block },
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 10, speed: 30, hp_max: 20 },
          }),
        },
      ],
      board: {
        grid: { width: 14, height: 5, tiles },
        placements: { orc: { x: 1, y: 2 }, ada: { x: 12, y: 2 } },
      },
    });
    state.order = ["orc", "ada"];
    state.turn = 0;
    return state;
  };
  const gap = (cell: { x: number; y: number }) => Math.max(Math.abs(cell.x - 12), Math.abs(cell.y - 2));

  // ── Offered with cells that each step nearer the hostile ──
  {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "orc").find((one) => one.label === "Aggressive");
    assert.ok(option?.cells?.length, "offered, with somewhere to go");
    assert.equal(option.budget, "bonus");
    const keys = new Set(option.cells!.map((cell) => `${cell.x},${cell.y}`));
    assert.ok(keys.has("7,2"), "six cells straight at her");
    assert.ok(!keys.has("0,2") && !keys.has("1,1"), "never away, nor sideways");
    for (const cell of option.cells!) assert.ok(gap(cell) < gap({ x: 1, y: 2 }));
    const before = rulesetCombatant(state, "orc")!.movementLeft;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "orc", optionId: option.id, targetIds: [], to: { x: 7, y: 2 } },
      () => 10,
    );
    assert.deepEqual(
      step.events.filter((one) => one.type === "refused"),
      [],
    );
    const orc = rulesetCombatant(step.state, "orc")!;
    assert.deepEqual([orc.x, orc.y], [7, 2]);
    assert.equal(orc.budgets.bonus, 0, "its bonus spent");
    assert.equal(orc.movementLeft, before, "its own movement kept");
    // Away from her is refused.
    const away = applyRulesetCombatChoice(
      definition,
      fight(),
      { actorId: "orc", optionId: option.id, targetIds: [], to: { x: 0, y: 2 } },
      () => 10,
    );
    assert.ok(away.events.some((one) => one.type === "refused"));
  }

  // ── Seeing nobody, it is not offered ──
  {
    const state = fight(true);
    assert.equal(
      rulesetCombatOptions(definition, state, "orc").find((one) => one.label === "Aggressive"),
      undefined,
    );
  }

  // ── Refused when it does more than move ──
  {
    const result = parseRulesetDefinition(
      fiveE([greataxe, { ...aggressive, damage: { dice: "1d4", type: "bludgeoning" }, toHit: 3 }]),
    );
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.match(result.issues.join("; "), /A move taken on its own turn \("toward"\) does nothing but move/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's move toward a hostile it can see (move.toward) requires schemaVersion 2 and capabilityApi 1.607 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(606) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(607) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(606) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Creature Aggressive: a bonus move on its own turn, every step nearer a hostile it sees; gated at 1.607.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
