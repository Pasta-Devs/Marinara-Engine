/**
 * Saves against a quality (Capability API 1.652): 5e's Necklace of Adaptation, advantage on saves
 * against gases.
 *
 *   - A save whose `against.qualities` is `["gas"]` is reached by a modifier for saves against gas;
 *     one that says nothing, or another quality, is not.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-save-qualities-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 652);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "adapted", label: "Necklace of Adaptation" });
    doc.combat.conditions.push({
      condition: "adapted",
      effects: [],
      modifiers: [{ to: "saves", mode: "advantage", against: { qualities: ["gas"] } }],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const cloud = (against?: Record<string, unknown>) => ({
    id: "cloud",
    name: "Choking Cloud",
    budget: "action",
    range: 60,
    damage: { flat: 1, type: "poison" },
    save: { save: "con_save", difficulty: 15, onSuccess: "negates", ...(against ? { against } : {}) },
  });
  const save = (against?: Record<string, unknown>) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hag",
          name: "Hag",
          side: "enemy",
          block: {
            health: 30,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [cloud(against)],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          block: {
            health: 30,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["hag", "hero"];
    state.turn = 0;
    rulesetCombatant(state, "hero")!.tracked.push({ condition: "adapted", rounds: null } as never);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hag", optionId: "cloud", targetIds: ["hero"] },
      (sides) => (sides === 20 ? 10 : 1),
    );
    const saves = step.events.filter(
      (one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save",
    );
    assert.equal(saves.length, 1, JSON.stringify(step.events));
    return saves[0]!.mode ?? "normal";
  };

  assert.equal(save({ qualities: ["gas"] }), "advantage", "a gas");
  assert.equal(save(), "normal", "a save that says nothing");
  assert.equal(save({ qualities: ["spore"] }), "normal", "another quality");
  assert.equal(save({ damage: ["poison"] }), "normal", "against poison, not gas");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a save against a quality (save.against.qualities, a modifier's against.qualities) requires schemaVersion 2 and capabilityApi 1.652 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(651) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(652) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(651) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Saves against a quality: a Necklace of Adaptation's advantage against gas, and nothing else; gated at 1.652.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
