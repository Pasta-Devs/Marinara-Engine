/**
 * Stopping time (Capability API 1.507).
 *
 *   - 1d4 + 1 turns in a row once the casting turn ends: no step along the order, no new round.
 *   - Nobody else answers meanwhile: walking out of an ogre's reach provokes nothing.
 *   - Over after the last turn; ended at once by an attack on somebody else.
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-time-stop-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 507);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "time_stop", label: "Time Stop" });
    doc.combat.conditions.push({ condition: "time_stop", effects: [], stopsTime: { dice: "1d4", flat: 1 } });
    edit(doc);
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
      health: 60,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "stab", name: "Stab", budget: "action", toHit: 0, damage: { count: 1, sides: 4, flat: 0 }, reach: 5 },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (stopped: boolean): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "wizard", name: "Wizard", side: "party", block: block() },
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 6, height: 3, tiles: Array.from({ length: 3 }, () => Array(6).fill("plains")) } as never,
        placements: { wizard: { x: 2, y: 1 }, ogre: { x: 3, y: 1 } },
      },
    });
    state.order = ["wizard", "ogre"];
    state.turn = 0;
    if (stopped) rulesetCombatant(state, "wizard")!.tracked.push({ condition: "time_stop", rounds: 1 });
    return state;
  };
  const end = (state: RulesetEncounterState, actorId: string, roll = 3) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, () => roll);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const actor = (state: RulesetEncounterState) => state.order[state.turn];
  const holds = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "wizard")!.tracked.some((one) => one.condition === "time_stop");

  // ── Four turns in a row on a 3, and over after the last ──
  {
    let step = end(fight(true), "wizard");
    assert.deepEqual(
      of(step.events, "timeStop").map((one) => one.turns),
      [4],
    );
    const round = step.state.round;
    let turns = 0;
    while (actor(step.state) === "wizard" && turns < 10) {
      turns += 1;
      assert.equal(step.state.round, round, "no new round while time is stopped");
      assert.ok(of(step.events, "turn").some((one) => one.actorId === "wizard"));
      step = end(step.state, "wizard");
    }
    assert.equal(turns, 4);
    assert.deepEqual(
      of(step.events, "timeStop").map((one) => one.ended),
      ["over"],
    );
    assert.equal(actor(step.state), "ogre");
    assert.ok(!holds(step.state));
  }

  // ── Out of the ogre's reach with time stopped: nobody answers ──
  {
    const walk = (state: RulesetEncounterState) =>
      applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "wizard", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 0, y: 1 } },
        () => 10,
      );
    const plain = walk(fight(false));
    assert.ok(plain.state.window, "without it, leaving the ogre's reach provokes");
    const stopped = walk(end(fight(true), "wizard").state);
    assert.equal(stopped.state.window, undefined, JSON.stringify(stopped.events));
    assert.equal(rulesetCombatant(stopped.state, "wizard")!.x, 0);
  }

  // ── An attack on the ogre ends it at once ──
  {
    const during = end(fight(true), "wizard").state;
    const swing = applyRulesetCombatChoice(
      definition,
      during,
      { actorId: "wizard", optionId: "stab", targetIds: ["ogre"] },
      () => 10,
    );
    assert.deepEqual(
      of(swing.events, "timeStop").map((one) => one.ended),
      ["affected"],
      JSON.stringify(swing.events),
    );
    assert.ok(!holds(swing.state));
    assert.equal(actor(end(swing.state, "wizard").state), "ogre");
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "time_stop").stopsTime = {})),
    /how many turns/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions stop time for turns in a row (a condition's stopsTime) requires schemaVersion 2 and capabilityApi 1.507 or newer";
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
    doc.combat.conditions[0].stopsTime = { dice: "1d4", flat: 1 };
    assert.equal(getCapabilityPackageInstallIssue(manifest(506) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(507) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(506) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Time Stop: 1d4 + 1 turns in a row with no new round, no answers from anybody else, over after the last or at once on reaching somebody; gated at 1.507.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
