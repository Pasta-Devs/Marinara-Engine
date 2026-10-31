/**
 * Cover only from what stands in the way (Capability API 1.770): `combat.cover.groundUnderTarget`.
 *
 *   - By default a target standing in a forest has half cover against an attack from the ground
 *     under it.
 *   - With `groundUnderTarget: false` it has none from there, and a creature in the way still gives
 *     half cover.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetDefenseAgainst,
  supportedCapabilityApi,
  type RulesetCombatAction,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cover-ground-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 770);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (cover: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.cover = { bonus: 2, threeQuarters: 5, creatures: true, ...cover };
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const block = (): RulesetStatBlock =>
    ({ health: 40, defense: 12, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const bow = {
    id: "bow",
    label: "Longbow",
    kind: "attack",
    budget: "action",
    targets: { side: "enemy", count: 1 },
    range: { normal: 30 },
  } as unknown as RulesetCombatAction;
  // The archer at (0,2), the target in a forest at (4,2), and somebody at (2,2) when screened.
  const cover = (definition: RulesetDefinition, screened: boolean) => {
    const tiles = Array.from({ length: 5 }, () => Array(8).fill("plains"));
    tiles[2]![4] = "forest";
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "archer", name: "Archer", side: "party", block: block() },
        { id: "target", name: "Target", side: "enemy", block: block() },
        ...(screened ? [{ id: "screen", name: "Screen", side: "enemy" as const, block: block() }] : []),
      ],
      board: {
        grid: { width: 8, height: 5, tiles },
        placements: { archer: { x: 0, y: 2 }, target: { x: 4, y: 2 }, ...(screened ? { screen: { x: 2, y: 2 } } : {}) },
      },
    } as never);
    return rulesetDefenseAgainst(
      definition,
      definition.combat!,
      state,
      rulesetCombatant(state, "target")!,
      rulesetCombatant(state, "archer")!,
      bow,
    ).cover;
  };

  const underfoot = parsed(fiveE({}));
  assert.equal(cover(underfoot, false), 2, "by default the forest under it is half cover");
  const between = parsed(fiveE({ groundUnderTarget: false }));
  assert.equal(cover(between, false), 0, "only what stands in the way counts");
  assert.equal(cover(between, true), 2, "and a creature in the way still does");

  // ── The install gate ──
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
      "A ruleset that says whether the ground under a target gives cover (cover.groundUnderTarget) requires schemaVersion 2 and capabilityApi 1.770 or newer";
    const doc = fiveE({ groundUnderTarget: false });
    assert.equal(getCapabilityPackageInstallIssue(manifest(769) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(770) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(769) as never, fiveE({})), gate);
  }

  console.log(
    "Cover from the ground: a forest under the target is half cover unless the ruleset says only what stands in the way counts; gated at 1.770.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
