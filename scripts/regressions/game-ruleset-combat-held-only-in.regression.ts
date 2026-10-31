/**
 * A condition that holds only in some light (Capability API 1.605): a shadow's Sunlight Weakness.
 *
 *   - `heldOnlyIn.light`: in sunlight it holds, with what it does; in dim light it is held off, not
 *     ended, and holds again once its holder is back in the sun.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetActiveConditions,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-only-in-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 605);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const weakness = (rule: unknown = { light: ["sunlight"] }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "sunlight_weakness", label: "Sunlight Weakness" });
    doc.combat.conditions.push({
      condition: "sunlight_weakness",
      effects: ["own-attacks-disadvantage", "own-checks-disadvantage", "own-saves-disadvantage"],
      heldOnlyIn: rule,
    });
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
  const definition = parsed(weakness());
  const block = {
    health: 16,
    defense: 12,
    initiativeModifier: 2,
    speed: 40,
    actions: [],
  } as unknown as RulesetStatBlock;
  const fight = (light: "sunlight" | "dim"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "shadow", name: "Shadow", side: "enemy", block }],
      board: {
        grid: { width: 4, height: 4, tiles: Array.from({ length: 4 }, () => Array(4).fill("plains")) },
        light,
        placements: { shadow: { x: 1, y: 1 } },
      },
    });
    rulesetCombatant(state, "shadow")!.tracked.push({ condition: "sunlight_weakness", rounds: null });
    return state;
  };
  const holds = (state: RulesetEncounterState) =>
    rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(state, "shadow")!, state).some(
      (one) => one.condition === "sunlight_weakness",
    );

  // ── In the sun it holds; in dim light it is held off, not ended ──
  const sun = fight("sunlight");
  assert.equal(holds(sun), true);
  const dim = fight("dim");
  assert.equal(holds(dim), false);
  assert.ok(rulesetCombatant(dim, "shadow")!.tracked.some((one) => one.condition === "sunlight_weakness"));
  dim.board!.light = "sunlight";
  assert.equal(holds(dim), true, "holds again back in the sun");

  // ── Refusals ──
  refused(weakness({ light: [] }), /heldOnlyIn/);
  refused(weakness({ light: ["noon"] }), /heldOnlyIn/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that holds only in some light (heldOnlyIn) requires schemaVersion 2 and capabilityApi 1.605 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(604) as never, weakness()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(605) as never, weakness()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(604) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Held only in: Sunlight Weakness holds in the sun, is held off in dim light and holds again; gated at 1.605.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
