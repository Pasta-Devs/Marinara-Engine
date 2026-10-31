/**
 * Harm copied to a condition's source (Capability API 1.409): 5e's Warding Bond.
 *
 *   - The warded ally takes half (resistance), and the caster takes the same half.
 *   - The caster's own resistance counts; two bonds do not pass the damage back and forth.
 *   - It ends when the caster goes down.
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
  rulesetCombatConditions,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-copied-harm-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 409);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push({ id: "warded", label: "Warding Bond" }, { id: "stoneskin", label: "Stoneskin" });
    doc.combat.conditions.push(
      { condition: "warded", effects: ["resist-all"], copiesHarmToSource: true, endsWhenSourceDown: true },
      { condition: "stoneskin", effects: ["resist-all"] },
    );
    edit(doc);
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
  const block = (health: number, blow: number): RulesetStatBlock => ({
    health,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "blade", name: "Blade", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: blow } }],
  });
  const fight = (clericHealth = 40): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "brute", name: "Brute", side: "enemy", block: block(40, 10) },
        { id: "cleric", name: "Cleric", side: "party", block: block(clericHealth, 1) },
        { id: "fighter", name: "Fighter", side: "party", block: block(40, 1) },
      ],
    });
    state.order = ["brute", "cleric", "fighter"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hold = (state: RulesetEncounterState, id: string, condition: string, source?: string) =>
    who(state, id).tracked.push({ condition, rounds: null, ...(source ? { source } : {}) } as never);
  const strike = (state: RulesetEncounterState, target: string) =>
    applyRulesetCombatChoice(definition, state, { actorId: "brute", optionId: "blade", targetIds: [target] }, () => 10);

  // ── 10 on the warded fighter: 5 to them, 5 to the cleric ──
  {
    const state = fight();
    hold(state, "fighter", "warded", "cleric");
    const hit = strike(state, "fighter");
    assert.deepEqual(
      of(hit.events, "damage").map((one) => [one.targetId, one.dealt, one.label]),
      [
        ["fighter", 5, "Blade"],
        ["cleric", 5, "Warding Bond"],
      ],
      JSON.stringify(of(hit.events, "damage")),
    );
    assert.equal(who(hit.state, "cleric").health!.value, 35);
    // The caster's own resistance halves it again.
    const tough = fight();
    hold(tough, "fighter", "warded", "cleric");
    hold(tough, "cleric", "stoneskin");
    assert.deepEqual(
      of(strike(tough, "fighter").events, "damage").map((one) => [one.targetId, one.dealt]),
      [
        ["fighter", 5],
        ["cleric", 2],
      ],
    );
    // Bonded both ways: passed on once (halved by the cleric's own ward), not back.
    const both = fight();
    hold(both, "fighter", "warded", "cleric");
    hold(both, "cleric", "warded", "fighter");
    assert.deepEqual(
      of(strike(both, "fighter").events, "damage").map((one) => [one.targetId, one.dealt]),
      [
        ["fighter", 5],
        ["cleric", 2],
      ],
    );
    // Nobody bonded: the blow stays.
    assert.equal(of(strike(fight(), "fighter").events, "damage").length, 1);
  }

  // ── The cleric at 3 goes down taking it, and the bond ends ──
  {
    const state = fight(3);
    hold(state, "fighter", "warded", "cleric");
    const hit = strike(state, "fighter");
    assert.ok(who(hit.state, "cleric").down || who(hit.state, "cleric").defeated, JSON.stringify(hit.events));
    assert.ok(
      !rulesetCombatConditions(definition, who(hit.state, "fighter")).includes("warded"),
      JSON.stringify(hit.events),
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose condition copies its holder's harm to whoever put it on (copiesHarmToSource) requires schemaVersion 2 and capabilityApi 1.409 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(408) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(409) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(408) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Copied harm: Warding Bond's caster takes what the warded take, after both resistances, passed on once and never back, ending as the caster falls; gated at 1.409.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
