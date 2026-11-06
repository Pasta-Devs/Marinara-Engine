/**
 * A condition that takes its holder over (Capability API 1.577): 5e's Magic Jar.
 *
 *   - `controls`: whoever holds it fights on its source's side while it holds, and on their own again
 *     once it comes off.
 *   - `holderDies`: as the host dies, its source throws that save against the difficulty off their own
 *     sheet, and dies on a failure; a success keeps them.
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
  rulesetCombatant,
  rulesetCombatOptions,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-controls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 577);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (rule: Record<string, unknown> = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "possessed", label: "Possessed" });
    doc.combat.conditions.push({
      condition: "possessed",
      effects: [],
      controls: true,
      holderDies: { save: "cha_save", difficulty: { const: 15 } },
      ...rule,
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const block = (saves: Record<string, number> = {}): RulesetStatBlock =>
    ({ health: 30, defense: 12, initiativeModifier: 0, speed: 30, saves, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (mageSave: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", block: block({ cha_save: mageSave }) },
        { id: "knight", name: "Knight", side: "enemy", block: block() },
        { id: "squire", name: "Squire", side: "enemy", block: block() },
      ],
    });
    state.order = ["mage", "knight", "squire"];
    state.turn = 0;
    rulesetCombatant(state, "knight")!.tracked.push({ condition: "possessed", rounds: null, source: "mage" } as never);
    return state;
  };
  const endTurn = (state: RulesetEncounterState, actorId: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.kind === "end-turn")!;
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds: [] }, () => 10);
    assert.deepEqual(of(step.events, "refused"), []);
    return step;
  };

  // ── Possessed: on the mage's side, then back on its own as it ends ──
  {
    const step = endTurn(fight(0), "mage");
    assert.equal(rulesetCombatant(step.state, "knight")!.side, "party");
    assert.deepEqual(
      of(step.events, "controlled").map((one) => [one.targetId, one.sourceId, one.active]),
      [["knight", "mage", true]],
    );
    assert.equal(rulesetCombatant(step.state, "squire")!.side, "enemy", "the squire is its own");
    const freed = structuredClone(step.state);
    const knight = rulesetCombatant(freed, "knight")!;
    knight.tracked = knight.tracked.filter((one) => one.condition !== "possessed");
    const after = endTurn(freed, "knight");
    assert.equal(rulesetCombatant(after.state, "knight")!.side, "enemy");
    assert.deepEqual(
      of(after.events, "controlled").map((one) => one.active),
      [false],
    );
  }
  // ── The host dies: a failed Charisma save kills the mage, a success keeps them ──
  for (const [save, dies] of [
    [-20, true],
    [20, false],
  ] as const) {
    const state = endTurn(fight(save), "mage").state;
    const host = rulesetCombatant(state, "knight")!;
    host.defeated = true;
    const step = endTurn(state, "knight");
    const thrown = of(step.events, "save").filter((one) => one.actorId === "mage");
    assert.equal(thrown.length, 1, "thrown once");
    assert.equal(thrown[0]!.difficulty, 15);
    assert.equal(!!rulesetCombatant(step.state, "mage")!.defeated, dies);
    // Never again (with the mage dead, the fight is over).
    if (!dies) assert.equal(of(endTurn(step.state, "squire").events, "save").length, 0);
  }

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(document({ holderDies: { save: "luck_save", difficulty: { const: 15 } } }));
    assert.ok(!result.ok && result.issues.some((issue) => /Unknown save "luck_save"/.test(issue)));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that puts its holder under its source's control (controls, holderDies) requires schemaVersion 2 and capabilityApi 1.577 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(576) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(577) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(576) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Controls: a possessed knight fights on the mage's side and goes back as it ends; its death has the mage throw Charisma to live; gated at 1.577.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
