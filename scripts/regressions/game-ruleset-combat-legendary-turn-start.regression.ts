/**
 * Signature actions at a foe's turn start (Capability API 1.805; Alyssa's pick 2026-10-26: an opt-in
 * ruleset option, off for 5e).
 *
 *   - `combat.signatureAtTurnStart`: as a hero's turn starts, a boss holding points is asked before
 *     the hero acts, and the hero's turn goes on once it has answered.
 *   - Not at its own side's turns, and left out (5e as written) only between turns.
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
  currentRulesetActor,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-legendary-turn-start-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const strict = parsed(fiveE());
  const anticipating = parsed(fiveE((doc) => (doc.combat.signatureAtTurnStart = true)));
  assert.equal(anticipating.combat?.signatureAtTurnStart, true);

  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Sword", ability: "str", proficient: true, bonus: 0, damage: "1d8", reach: 5 }] },
  });
  const slam = { id: "slam", name: "Slam", budget: "action", toHit: 5, reach: 5, damage: { count: 1, sides: 6 } };
  const tail = { ...slam, id: "tail", name: "Tail", signature: { cost: 1 } };
  const fight = (definition: RulesetDefinition): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        {
          id: "boss",
          name: "Boss",
          side: "enemy",
          block: {
            health: 100,
            defense: 12,
            initiativeModifier: 0,
            speed: 30,
            signaturePoints: 3,
            actions: [slam, tail],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "imp",
          name: "Imp",
          side: "enemy",
          block: {
            health: 10,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [slam],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    // The imp acts, then the hero: the boss is asked between the two, and again as the hero starts.
    state.order = ["imp", "hero", "boss"];
    state.turn = 0;
    delete state.window;
    return state;
  };
  const roll = () => 10;
  const pass = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: RULESET_PASS_OPTION, targetIds: [], window: state.window!.id },
      roll,
    ).state;

  // ── The option on: asked between turns, then again as the hero's turn starts ──
  {
    let state = applyRulesetCombatChoice(
      anticipating,
      fight(anticipating),
      { actorId: "imp", optionId: "end-turn", targetIds: [] },
      roll,
    ).state;
    assert.equal(state.window?.kind, "signature");
    assert.equal(state.window?.trigger.kind, "between-turns");
    state = pass(anticipating, state, "boss");
    assert.equal(currentRulesetActor(state)?.id, "hero");
    assert.equal(state.window?.kind, "signature", "the boss is asked as the hero's turn starts");
    assert.equal(state.window?.trigger.kind, "turn-start");
    assert.deepEqual(state.window?.waiting, ["boss"]);
    const options = rulesetWindowOptions(anticipating, state, "boss");
    assert.ok(
      options.some((one) => one.id === "tail"),
      JSON.stringify(options.map((one) => one.id)),
    );
    // It buys its Tail on the hero, and the hero's turn goes on.
    const step = applyRulesetCombatChoice(
      anticipating,
      state,
      { actorId: "boss", optionId: "tail", targetIds: ["hero"], window: state.window!.id },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    assert.ok(step.events.some((one) => one.type === "signature" && one.optionId === "tail"));
    assert.equal(step.state.window, undefined, "the hero's turn goes on");
    assert.equal(currentRulesetActor(step.state)?.id, "hero");
    assert.equal(rulesetCombatant(step.state, "boss")!.signature?.points, 2);
    // At its own side's turn it is not asked as that turn starts.
    let next = applyRulesetCombatChoice(
      anticipating,
      step.state,
      { actorId: "hero", optionId: "end-turn", targetIds: [] },
      roll,
    ).state;
    assert.equal(next.window?.trigger.kind, "between-turns");
    next = pass(anticipating, next, "boss");
    assert.equal(currentRulesetActor(next)?.id, "boss");
    assert.equal(next.window, undefined, "nobody is asked as the boss's own turn starts");
  }

  // ── Passed: the hero acts ──
  {
    let state = applyRulesetCombatChoice(
      anticipating,
      fight(anticipating),
      { actorId: "imp", optionId: "end-turn", targetIds: [] },
      roll,
    ).state;
    state = pass(anticipating, state, "boss");
    state = pass(anticipating, state, "boss");
    assert.equal(state.window, undefined);
    assert.equal(currentRulesetActor(state)?.id, "hero");
  }

  // ── 5e as written: only between turns ──
  {
    let state = applyRulesetCombatChoice(
      strict,
      fight(strict),
      { actorId: "imp", optionId: "end-turn", targetIds: [] },
      roll,
    ).state;
    assert.equal(state.window?.trigger.kind, "between-turns");
    state = pass(strict, state, "boss");
    assert.equal(currentRulesetActor(state)?.id, "hero");
    assert.equal(state.window, undefined, "no window at the hero's turn start");
  }

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
      "A ruleset whose signature actions are bought at a turn's start (combat.signatureAtTurnStart) requires schemaVersion 2 and capabilityApi 1.805 or newer";
    const doc = fiveE((doc) => (doc.combat.signatureAtTurnStart = true));
    assert.equal(getCapabilityPackageInstallIssue(manifest(804) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(805) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(804) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log("game-ruleset-combat-legendary-turn-start: ok");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
