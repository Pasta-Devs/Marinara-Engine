/**
 * A condition that ends on an idle turn (Capability API 1.436).
 *
 *   - Rage: kept through a turn its holder attacked a foe, or one after they took damage; gone as a
 *     turn ends with neither since their last.
 *   - Persistent Rage: `unless` keeps it on from barbarian 15.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-idle-end-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 436);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const persistent = { unless: { value: { field: "level" }, atLeast: 15 } };
  const fiveE = (endsIdle: unknown = persistent): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "raging", label: "Raging" });
    doc.combat.conditions.push({ condition: "raging", effects: [], endsIdle });
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
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 20, reach: 5, damage: { count: 0, sides: 0, flat: 2 } },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")),
  });
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (level = 5): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "barbarian",
          name: "Barbarian",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 8 },
            fields: { level, ac: 15, speed: 30, hp_max: 120 },
            lists: {
              attacks: [{ name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 }],
            },
          }),
          live: {},
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { barbarian: { x: 2, y: 1 }, foe: { x: 3, y: 1 } } },
    });
    state.order = ["barbarian", "foe"];
    state.turn = 0;
    rulesetCombatant(state, "barbarian")!.tracked.push({ condition: "raging", rounds: 10 });
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: Partial<RulesetCombatChoice> & { actorId: string }) => {
    const taken = applyRulesetCombatChoice(definition, state, { optionId: "end-turn", targetIds: [], ...choice }, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    return taken.state;
  };
  const raging = (state: RulesetEncounterState) =>
    who(state, "barbarian").tracked.some((one) => one.condition === "raging");
  const swing = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "barbarian").find((one) => one.label === "Greataxe");
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "barbarian")
        .map((one) => one.label)
        .join(", "),
    );
    return step(state, { actorId: "barbarian", optionId: option.id, targetIds: ["foe"] });
  };
  const idle = (state: RulesetEncounterState) => step(state, { actorId: "foe" });

  // ── Rage ──
  {
    // Attacked a foe: kept.
    let state = step(swing(fight()), { actorId: "barbarian" });
    assert.ok(raging(state), "kept through a turn it attacked");
    // The foe's turn passes without touching it, and the barbarian does nothing: gone.
    state = idle(state);
    state = step(state, { actorId: "barbarian" });
    assert.equal(raging(state), false, "gone after an idle turn");
    // Hit on the foe's turn, then idle on its own: kept.
    let hit = step(fight(), { actorId: "barbarian" });
    assert.equal(raging(hit), false, "its first turn, idle, ends it");
    hit = fight();
    hit.turn = 1;
    hit = step(hit, { actorId: "foe", optionId: "claw", targetIds: ["barbarian"] });
    hit = step(hit, { actorId: "foe" });
    assert.ok(raging(hit), "the foe's turn ends; the barbarian's own turn is what counts");
    hit = step(hit, { actorId: "barbarian" });
    assert.ok(raging(hit), "kept after taking damage since its last turn");
    // And then idle once more: gone.
    hit = idle(hit);
    hit = step(hit, { actorId: "barbarian" });
    assert.equal(raging(hit), false);
  }

  // ── Persistent Rage ──
  {
    let state = step(fight(15), { actorId: "barbarian" });
    state = idle(state);
    state = step(state, { actorId: "barbarian" });
    assert.ok(raging(state), "kept from barbarian 15");
  }

  // ── Refusals ──
  refused(fiveE({ unless: { value: { field: "no_such_field" }, atLeast: 15 } }), /no_such_field/);
  refused(fiveE({ unless: { value: { field: "level" } } }), /"unless" says at least one of/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions end on an idle turn (endsIdle) requires schemaVersion 2 and capabilityApi 1.436 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(435) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(436) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(435) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Idle end: Rage holds through a turn that attacked a foe or followed damage, ends on an idle turn, and Persistent Rage keeps it from barbarian 15; gated at 1.436.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
