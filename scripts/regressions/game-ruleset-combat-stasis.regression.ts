/**
 * A condition holding its holder out of time (Capability API 1.647): 5e's Sequester.
 *
 *   - Its holder takes no turns: the order passes them by.
 *   - Their other conditions keep their rounds, and what others put on them that runs on those
 *     others' turns neither harms them nor counts down.
 *   - It ends as it says: harmed, with `endsWhen: ["damaged"]`, they take turns again.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-stasis-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 647);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "sequestered", label: "Sequestered" },
      { id: "burning", label: "Burning" },
      { id: "dazzled", label: "Dazzled" },
    );
    doc.combat.conditions.push(
      { condition: "sequestered", effects: [], stasis: true, endsWhen: ["damaged"] },
      { condition: "burning", effects: [], harms: { at: "source-turn-start", flat: 5, type: "fire" } },
      { condition: "dazzled", effects: [] },
    );
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ id: "club", name: "Club", budget: "action", toHit: 10, damage: { count: 1, sides: 6, flat: 0 } }],
    }) as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const definition = parsed(document());
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
        { id: "cleric", name: "Cleric", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
      ],
    });
    state.order = ["ogre", "cleric", "friend"];
    state.turn = 0;
    const friend = rulesetCombatant(state, "friend")!;
    friend.tracked.push(
      { condition: "sequestered", rounds: null, source: "cleric" } as never,
      { condition: "burning", rounds: 3, source: "ogre", clockOf: "source" } as never,
      { condition: "dazzled", rounds: 2 } as never,
    );
    return state;
  };
  const advance = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll);
  const friendOf = (state: RulesetEncounterState) => rulesetCombatant(state, "friend")!;
  const rounds = (state: RulesetEncounterState, condition: string) =>
    friendOf(state).tracked.find((one) => one.condition === condition)?.rounds;

  // ── No turns, and nothing on them runs ──
  {
    let state = fight();
    const seen: string[] = [];
    const harmed: number[] = [];
    for (let step = 0; step < 6; step++) {
      const next = advance(state);
      state = next.state;
      harmed.push(
        ...of(next.events, "damage")
          .filter((one) => one.targetId === "friend")
          .map((one) => one.dealt),
      );
      seen.push(currentRulesetActor(state)!.id);
    }
    assert.deepEqual(seen, ["cleric", "ogre", "cleric", "ogre", "cleric", "ogre"], "the order passes them by");
    assert.deepEqual(harmed, [], "the ogre's fire does not burn them");
    assert.equal(rounds(state, "burning"), 3, "its clock stopped");
    assert.equal(rounds(state, "dazzled"), 2, "their own clocks stopped");
  }

  // ── Without it, the same fire burns and the clocks run ──
  {
    let state = fight();
    friendOf(state).tracked = friendOf(state).tracked.filter((one) => one.condition !== "sequestered");
    const seen: string[] = [];
    let burnt = 0;
    for (let step = 0; step < 3; step++) {
      const next = advance(state);
      state = next.state;
      burnt += of(next.events, "damage").filter((one) => one.targetId === "friend").length;
      seen.push(currentRulesetActor(state)!.id);
    }
    assert.deepEqual(seen, ["cleric", "friend", "ogre"]);
    assert.equal(burnt, 1, "burnt as the ogre's turn starts");
    assert.equal(rounds(state, "dazzled"), 1);
  }

  // ── Harmed, it ends: they take turns again ──
  {
    let state = fight();
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ogre", optionId: "club", targetIds: ["friend"] },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    state = step.state;
    assert.equal(rounds(state, "sequestered"), undefined, "the blow ended it");
    state = advance(state).state;
    state = advance(state).state;
    assert.equal(currentRulesetActor(state)!.id, "friend");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition holding its holder out of time (stasis) requires schemaVersion 2 and capabilityApi 1.647 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(646) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(647) as never, document()), gate);
  }

  console.log("Sequester: a holder out of time takes no turns and nothing on them runs, until harmed; gated at 1.647.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
