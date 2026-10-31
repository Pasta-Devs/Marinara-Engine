/**
 * Flyby (Capability API 1.679).
 *
 *   - A condition's `flyby`, kept on an owl: with a flying speed it leaves an enemy's reach without
 *     drawing an opportunity attack. Without the condition, or without a flying speed, it draws one.
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
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-flyby-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 679);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "flyby", label: "Flyby" });
    doc.combat.conditions.push({ condition: "flyby", flyby: true });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const claw = { name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } };
  const owl = (extra: Record<string, unknown>) =>
    ({
      health: 10,
      defense: 10,
      initiativeModifier: 0,
      speed: 5,
      actions: [claw],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  /** Whether the owl leaving the fighter's reach opens a window for a strike. */
  const provokes = (block: RulesetStatBlock) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "owl", name: "Owl", side: "enemy", block },
        {
          id: "fighter",
          name: "Fighter",
          side: "party",
          block: {
            health: 30,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [claw],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: { grid: grid(), placements: { owl: { x: 5, y: 5 }, fighter: { x: 6, y: 5 } } },
    });
    state.order = ["owl", "fighter"];
    state.turn = 0;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "owl", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 5 } },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    return step.events.some((one) => one.type === "window" && one.waiting.includes("fighter"));
  };

  assert.equal(provokes(owl({ speeds: { fly: 60 }, keepsOn: ["flyby"] })), false, "flies out of reach");
  assert.equal(provokes(owl({ speeds: { fly: 60 } })), true, "no Flyby");
  assert.equal(provokes(owl({ speed: 30, keepsOn: ["flyby"] })), true, "nothing to fly by on");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose holder flies out of reach without drawing a strike (flyby) requires schemaVersion 2 and capabilityApi 1.679 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(678) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(679) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(678) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Flyby: out of reach on the wing without a strike, and only with the condition and a flying speed; gated at 1.679.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
