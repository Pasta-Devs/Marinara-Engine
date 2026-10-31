/**
 * No critical hits (Capability API 1.510).
 *
 *   - `criticals-against-normal`: a natural 20 on its holder is a plain hit, its dice rolled once.
 *   - It wins over `attacks-from-adjacent-critical` too; without it, both still crit.
 *   - The install gate, for a condition's effects and a worn item's (read the same way since 1.45).
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-no-criticals-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 510);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "adamantine", label: "Adamantine" },
      { id: "held_still", label: "Held Still" },
    );
    doc.combat.conditions.push(
      { condition: "adamantine", effects: ["criticals-against-normal"] },
      { condition: "held_still", effects: ["attacks-from-adjacent-critical"] },
    );
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "stab", name: "Stab", budget: "action", toHit: 0, reach: 5, damage: { count: 1, sides: 6, flat: 0 } },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (...conditions: string[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
        { id: "knight", name: "Knight", side: "party", block: block() },
      ],
      board: {
        grid: { width: 5, height: 3, tiles: Array.from({ length: 3 }, () => Array(5).fill("plains")) } as never,
        placements: { ogre: { x: 1, y: 1 }, knight: { x: 2, y: 1 } },
      },
    });
    state.order = ["ogre", "knight"];
    state.turn = 0;
    for (const condition of conditions) rulesetCombatant(state, "knight")!.tracked.push({ condition, rounds: null });
    return state;
  };
  // A d20 shows `d20`, every other die 4.
  const strike = (state: RulesetEncounterState, d20: number) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ogre", optionId: "stab", targetIds: ["knight"] },
      (sides) => (sides === 20 ? d20 : 4),
    );
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const outcome = (state: RulesetEncounterState, d20: number) => {
    const step = strike(state, d20);
    return [of(step.events, "attack")[0]?.outcome, of(step.events, "damage")[0]?.amount];
  };

  assert.deepEqual(outcome(fight(), 20), ["critical", 8], "a natural 20 doubles the dice");
  assert.deepEqual(outcome(fight("adamantine"), 20), ["hit", 4], "a plain hit on adamantine");
  assert.deepEqual(outcome(fight("held_still"), 13), ["critical", 8], "from the next cell on one held still");
  assert.deepEqual(outcome(fight("held_still", "adamantine"), 13), ["hit", 4], "adamantine wins");
  assert.deepEqual(outcome(fight("adamantine"), 5), ["miss", undefined]);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or worn items turn critical hits on their holder into plain hits (the criticals-against-normal effect) requires schemaVersion 2 and capabilityApi 1.510 or newer";
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
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.conditions[0].effects = ["criticals-against-normal"];
    assert.equal(getCapabilityPackageInstallIssue(manifest(509) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(510) as never, doc), gate);
    const item = JSON.parse(fiveEText) as Record<string, any>;
    item.catalogs.push({
      id: "armory",
      label: "Armory",
      feeds: ["features"],
      entries: [{ id: "plate", label: "Adamantine Plate", worn: { effects: ["criticals-against-normal"] } }],
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(509) as never, item), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(509) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "No criticals: a natural 20 or a hit from beside one held still is a plain hit on whoever has criticals-against-normal; gated at 1.510.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
