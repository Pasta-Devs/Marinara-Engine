/**
 * A wall a creature's action lays (Capability API 1.728): an ice devil's Wall of Ice.
 *
 *   - A creature action's `area` may be a `"wall"`, with `width`, `ring` and `ringOnly`, as a
 *     catalog entry's: it lays a zone that blocks and stands in sections struck one by one.
 *   - Laid straight or, with `ring`, as a ring around the aimed cell.
 *   - Copied off its catalog entry into its block; import refusals and the install gate.
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
  rulesetCombatOptions,
  rulesetStatBlockFromCreature,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-walls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 728);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // Wall of Ice: 30 ft long in 10-ft sections of AC 5 and 30 health, fire doing double; a broken one
  // leaves frigid air, 5d6 cold on a failed Constitution save.
  const iceZone = () => ({
    rounds: 10,
    triggers: [],
    blocks: ["move", "sight"],
    sections: {
      every: 10,
      health: 30,
      defense: 5,
      vulnerable: ["fire"],
      broken: { triggers: ["enter"], amount: { dice: "5d6" }, damageType: "cold", save: "con_save", onSave: "half" },
    },
  });
  const wallOfIce = (area: Record<string, unknown> = { shape: "wall", size: 30, ring: 20 }) => ({
    id: "wall_of_ice",
    name: "Wall of Ice",
    budget: "action",
    range: 60,
    save: { save: "dex_save", difficulty: 17, onSuccess: "half" },
    area,
    zone: iceZone(),
  });
  const fiveE = (action: Record<string, unknown> = wallOfIce()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.push(action);
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
  const definition = parsed(fiveE());
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const copied = rulesetStatBlockFromCreature(definition, creature)!.actions.find((one) => one.id === "wall_of_ice");
  assert.deepEqual(copied?.area, { shape: "wall", size: 30, ring: 20 }, "copied into its block");
  assert.ok(copied?.zone?.sections, "its sections too");

  const devil = (area?: Record<string, unknown>): RulesetStatBlock =>
    ({
      health: 180,
      defense: 18,
      initiativeModifier: 0,
      speed: 40,
      actions: [{ ...wallOfIce(area), id: "wall-of-ice" }],
    }) as unknown as RulesetStatBlock;
  const fight = (area?: Record<string, unknown>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "devil", name: "Ice Devil", side: "enemy", block: devil(area) },
        {
          id: "knight",
          name: "Knight",
          side: "party",
          block: {
            health: 50,
            defense: 16,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: {
          width: 15,
          height: 15,
          tiles: Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => "plains")),
        } as never,
        placements: { devil: { x: 2, y: 7 }, knight: { x: 12, y: 2 } },
      },
    });
    state.order = ["devil", "knight"];
    state.turn = 0;
    return state;
  };
  const lay = (state: RulesetEncounterState, at: RulesetCombatCell, extra: Record<string, unknown> = {}) => {
    const option = rulesetCombatOptions(definition, state, "devil").find((one) => one.label === "Wall of Ice");
    assert.ok(option, "no Wall of Ice");
    assert.equal(option.area?.shape, "wall");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "devil", optionId: option.id, targetIds: [], at, ...extra },
      () => 10,
    );
  };
  const refusal = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const keys = (cells: RulesetCombatCell[] | undefined) => (cells ?? []).map((cell) => `${cell.x},${cell.y}`).sort();

  // ── Laid straight: 30 feet across the aimed cell in three sections of 30 ──
  {
    const step = lay(fight(), { x: 5, y: 7 });
    assert.equal(refusal(step), undefined, JSON.stringify(step.events));
    const shown = rulesetZonesShown(step.state)[0]!;
    assert.equal(shown.cells.length, 6);
    assert.deepEqual(
      shown.sections?.map((section) => [section.cells.length, section.health, section.max]),
      [
        [2, 30, 30],
        [2, 30, 30],
        [2, 30, 30],
      ],
    );
    const walls = step.state.board!.grid.walls ?? {};
    assert.ok(
      keys(shown.cells).every((cell) => walls[cell] !== undefined),
      "it blocks",
    );
  }
  // ── Or as a ring 20 feet across around the aimed cell ──
  {
    const step = lay(fight(), { x: 8, y: 7 }, { ring: true });
    assert.equal(refusal(step), undefined, JSON.stringify(step.events));
    const cells = rulesetZonesShown(step.state)[0]!.cells;
    assert.equal(cells.length, 16);
    assert.ok(cells.every((cell) => Math.max(Math.abs(cell.x - 8), Math.abs(cell.y - 7)) === 2));
  }
  // ── A ring only, whatever its creature says ──
  {
    const step = lay(fight({ shape: "wall", size: 30, ring: 20, ringOnly: true }), { x: 8, y: 7 });
    assert.equal(refusal(step), undefined, JSON.stringify(step.events));
    assert.equal(rulesetZonesShown(step.state)[0]!.cells.length, 16);
  }
  // ── A wall with no ring is never laid as one ──
  assert.ok(refusal(lay(fight({ shape: "wall", size: 30 }), { x: 5, y: 7 }, { ring: true })));

  // ── Refusals and the install gate ──
  refused(fiveE({ ...wallOfIce(), zone: undefined }), /A wall only ever stays, so it needs a zone/);
  refused(fiveE({ ...wallOfIce(), zone: { ...iceZone(), anchor: "caster" } }), /A wall stays where it is cast/);
  refused(
    fiveE({ ...wallOfIce(), save: undefined }),
    /A broken section's save is rolled against the action's own difficulty/,
  );
  refused(fiveE(wallOfIce({ shape: "burst", size: 10, ring: 20 })), /Only a wall is a ring/);
  refused(fiveE(wallOfIce({ shape: "wall", size: 30, ringOnly: true })), /"ringOnly" lays it as its ring/);
  refused(fiveE(wallOfIce({ shape: "cone", size: 30, width: 10 })), /Only a line or a wall may carry width/);
  const gate =
    'A ruleset with a wall a creature\'s action lays (actions[].area.shape "wall") requires schemaVersion 2 and capabilityApi 1.728 or newer';
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(727) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(728) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(727) as never, JSON.parse(fiveEText)), gate);

  console.log("Wall of Ice: a creature's action lays a wall in sections, straight or as a ring; gated at 1.728.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
