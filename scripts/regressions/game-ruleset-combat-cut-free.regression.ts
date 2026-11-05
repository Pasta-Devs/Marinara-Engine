/**
 * Conditions cut away (Capability API 1.531).
 *
 *   - A net, "dealing 5 slashing damage to the net (AC 10) also frees the creature": a slashing blow
 *     at it is offered, rolls against 10, and only its slashing wears the net down; what is left
 *     carries over, and at none the netted creature is free. A bludgeoning blow is not offered.
 *   - The netted creature may strike at its own net.
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
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cut-free-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 531);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (cutFree: unknown = { defense: 10, health: 5, damageTypes: ["slashing"] }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "netted", label: "Net" });
    doc.combat.conditions.push({ condition: "netted", effects: ["speed-zero"], cutFree });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const block = (): RulesetStatBlock =>
    ({
      health: 30,
      defense: 20,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "axe", name: "Axe", budget: "action", toHit: 0, damage: { flat: 3, type: "slashing" }, reach: 5 },
        { id: "club", name: "Club", budget: "action", toHit: 0, damage: { flat: 9, type: "bludgeoning" }, reach: 5 },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ally", name: "Ally", side: "party", block: block() },
        { id: "caught", name: "Caught", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    rulesetCombatant(state, "caught")!.tracked.push({ condition: "netted", rounds: null, source: "foe" });
    return state;
  };
  const turn = (state: RulesetEncounterState, id: string) => {
    state.order = [id, ...state.order.filter((one) => one !== id)];
    state.turn = 0;
  };
  const option = (state: RulesetEncounterState, id: string, label: string) =>
    rulesetCombatOptions(definition, state, id).find((one) => one.label === label)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const cut = (state: RulesetEncounterState, actorId: string, optionId: string, roll: number) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId, targetIds: [], cut: { holderId: "caught", condition: "netted" } } as RulesetCombatChoice,
      () => roll,
    );
  const netted = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "caught")!.tracked.some((one) => one.condition === "netted");

  // ── Offered to a slashing blow, not a bludgeoning one ──
  let state = fight();
  turn(state, "ally");
  const axe = option(state, "ally", "Axe");
  assert.deepEqual(axe.cuts, [{ holderId: "caught", condition: "netted", label: "Net", left: 5 }]);
  assert.equal(option(state, "ally", "Club").cuts, undefined, "bludgeoning cuts no net");

  // ── A miss, then 3 of 5, then free ──
  const missed = cut(state, "ally", axe.id, 5);
  assert.equal(of(missed.events, "cut")[0]?.outcome, "miss", JSON.stringify(missed.events));
  assert.ok(netted(missed.state));
  const first = cut(state, "ally", axe.id, 12);
  const told = of(first.events, "cut")[0]!;
  assert.equal(told.outcome, "hit");
  assert.equal(told.dealt, 3);
  assert.equal(told.left, 2);
  assert.ok(netted(first.state), "still netted");
  assert.equal(of(first.events, "damage").length, 0, "the stand-in's damage is not told");
  assert.equal(rulesetCombatant(first.state, "caught")!.health?.value, 30, "the caught one unharmed");
  state = first.state;
  turn(state, "caught");
  const own = option(state, "caught", "Axe");
  assert.equal(own.cuts?.[0]?.left, 2, "what is left carries over, and its holder may cut it");
  const freed = cut(state, "caught", own.id, 12);
  assert.equal(of(freed.events, "cut")[0]?.freed, true);
  assert.ok(!netted(freed.state), "free");

  // ── Refusals ──
  refused(document({ defense: 10 }), /health/);
  refused(document({ defense: 10, health: 0 }), /health|greater than or equal to 1/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions may be struck at and cut away (cutFree) requires schemaVersion 2 and capabilityApi 1.531 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(530) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(531) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(530) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Cut free: a slashing blow is offered against a net at AC 10, its 5 worn down across blows, its holder freed at none; bludgeoning is not offered; gated at 1.531.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
