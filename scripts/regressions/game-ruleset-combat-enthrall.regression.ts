/**
 * A check mode narrowed to finding anybody but whoever put the condition on (Capability API 1.567):
 * 5e's Enthrall, disadvantage on Wisdom (Perception) checks made to perceive any creature other than
 * the caster.
 *
 *   - A Search throws plain for the caster and with disadvantage for everybody else.
 *   - Elsewhere the modifier does nothing.
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
  rulesetCheckMode,
  rulesetCombatOptions,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-enthrall-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 567);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.combat.standard.push("search");
    doc.sheet.live.conditions.push({ id: "enthralled", label: "Enthralled" });
    doc.combat.conditions.push({
      condition: "enthralled",
      effects: [],
      modifiers: [{ to: "checks", skills: ["perception"], mode: "disadvantage", exceptSource: true }],
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
  const block = (): RulesetStatBlock =>
    ({
      health: 30,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      checks: { look: 0, sneak: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "guard", name: "Guard", side: "party", block: block() },
      { id: "bard", name: "Bard", side: "enemy", block: block() },
      { id: "rogue", name: "Rogue", side: "enemy", block: block() },
    ],
  });
  state.order = ["guard", "bard", "rogue"];
  state.turn = 0;
  const guard = rulesetCombatant(state, "guard")!;
  guard.tracked.push({ condition: "enthralled", rounds: 10, source: "bard" } as never);
  for (const id of ["bard", "rogue"]) rulesetCombatant(state, id)!.hiding = { total: 10, from: ["guard"] } as never;

  // ── Elsewhere it does nothing: a plain Perception check is plain ──
  assert.equal(rulesetCheckMode(definition, definition.combat!, guard, state, "perception"), "normal");
  assert.equal(
    rulesetCheckMode(definition, definition.combat!, guard, state, "perception", undefined, undefined, "rogue"),
    "disadvantage",
  );
  assert.equal(
    rulesetCheckMode(definition, definition.combat!, guard, state, "perception", undefined, undefined, "bard"),
    "normal",
  );

  // ── A Search: the bard found on a plain 15, the rogue missed on the lower of 5 and 15 ──
  const rolls = [15, 5, 15];
  const option = rulesetCombatOptions(definition, state, "guard").find((one) => one.id.includes("search"));
  assert.ok(option, "Search is offered");
  const step = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "guard", optionId: option.id, targetIds: [] },
    () => rolls.shift() ?? 10,
  );
  assert.deepEqual(of(step.events, "refused"), []);
  const searched = of(step.events, "standard").find((one) => one.action === "search")!;
  assert.deepEqual(searched.found, ["bard"]);
  assert.deepEqual(
    searched.apart?.map((one) => one.ids),
    [["rogue"]],
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a check modifier for finding anybody but whoever put the condition on (exceptSource) requires schemaVersion 2 and capabilityApi 1.567 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(566) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(567) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(566) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Enthrall: a Search finds the caster on a plain throw and everybody else with disadvantage; nothing else changes; gated at 1.567.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
