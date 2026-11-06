/**
 * Sharing spaces (Capability API 1.680).
 *
 *   - A condition's `sharesSpace`, kept on a swarm: it walks into anybody's space and stops there, and
 *     anybody walks into its space and stops there. Somebody without it is still kept out.
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetReachableCells,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-shares-space-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 680);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "swarm", label: "Swarm" });
    doc.combat.conditions.push({ condition: "swarm", sharesSpace: true });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (extra: Record<string, unknown> = {}) =>
    ({
      health: 20,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "swarm", name: "Swarm of Rats", side: "enemy", block: block({ keepsOn: ["swarm"] }) },
        { id: "wolf", name: "Wolf", side: "enemy", block: block() },
        { id: "hero", name: "Hero", side: "party", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { swarm: { x: 5, y: 5 }, hero: { x: 8, y: 5 }, wolf: { x: 8, y: 8 } },
      },
    });
    state.order = ["swarm", "hero", "wolf"];
    state.turn = 0;
    return state;
  };
  const stops = (state: RulesetEncounterState, id: string, cell: RulesetCombatCell) =>
    rulesetReachableCells(definition, state, id).some((one) => one.x === cell.x && one.y === cell.y);

  {
    const state = fight();
    assert.ok(stops(state, "swarm", { x: 8, y: 5 }), "the swarm stops in the hero's space");
    assert.ok(stops(state, "swarm", { x: 8, y: 8 }), "and in its own side's");
    state.turn = 1;
    assert.ok(stops(state, "hero", { x: 5, y: 5 }), "the hero stops in the swarm's");
    assert.ok(!stops(state, "hero", { x: 8, y: 8 }), "never in the wolf's");
    // Walked there and sharing it.
    state.turn = 0;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "swarm", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 8, y: 5 } },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    const swarm = rulesetCombatant(step.state, "swarm")!;
    assert.deepEqual({ x: swarm.x, y: swarm.y }, { x: 8, y: 5 });
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose holder shares spaces (sharesSpace) requires schemaVersion 2 and capabilityApi 1.680 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(679) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(680) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(679) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("sharesSpace: a swarm stops in anybody's space and anybody in its own; gated at 1.680.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
