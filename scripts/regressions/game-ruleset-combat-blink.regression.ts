/**
 * Blinking out (Capability API 1.506).
 *
 *   - As its holder's turn ends, an 11 or higher on a d20 takes them off the board: no target, and the
 *     fight is not lost for it. Under it, they stay.
 *   - As their next turn starts they come back where they vanished, or the nearest free place.
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
  rulesetEncounterOutcome,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-blink-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 506);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "blink", label: "Blink" });
    doc.combat.conditions.push({ condition: "blink", effects: [], blinks: { atLeast: 11 } });
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
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "wizard", name: "Wizard", side: "party", block: block() },
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 5, height: 3, tiles: Array.from({ length: 3 }, () => Array(5).fill("plains")) } as never,
        placements: { wizard: { x: 1, y: 1 }, ogre: { x: 2, y: 1 } },
      },
    });
    state.order = ["wizard", "ogre"];
    state.turn = 0;
    rulesetCombatant(state, "wizard")!.tracked.push({ condition: "blink", rounds: 10 });
    return state;
  };
  const end = (state: RulesetEncounterState, actorId: string, roll: number) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, () => roll);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const wizard = (state: RulesetEncounterState) => rulesetCombatant(state, "wizard")!;

  // ── A 10 as the turn ends: still here ──
  {
    const stayed = end(fight(), "wizard", 10);
    assert.deepEqual(
      of(stayed.events, "blink").map((one) => [one.roll, one.needed, one.vanished]),
      [[10, 11, false]],
    );
    assert.equal(wizard(stayed.state).away, undefined);
  }

  // ── An 11: gone until their next turn, out of reach, and the fight not lost ──
  {
    const gone = end(fight(), "wizard", 11);
    assert.equal(of(gone.events, "blink")[0]?.vanished, true);
    assert.equal(wizard(gone.state).away?.blinked, true);
    assert.equal(rulesetEncounterOutcome(gone.state), "ongoing", "a party away for a blink has not lost");
    assert.equal(gone.state.order[gone.state.turn], "ogre");
    const swing = applyRulesetCombatChoice(
      definition,
      gone.state,
      { actorId: "ogre", optionId: "stab", targetIds: ["wizard"] },
      () => 20,
    );
    assert.ok(of(swing.events, "refused").length > 0, "nobody reaches them");
    assert.equal(wizard(swing.state).health!.value, 60);
    // The ogre steps into where they were: back in the nearest free place as their turn starts.
    rulesetCombatant(gone.state, "ogre")!.x = 1;
    const back = end(gone.state, "ogre", 10);
    assert.deepEqual(
      of(back.events, "returned").map((one) => one.targetId),
      ["wizard"],
    );
    assert.equal(wizard(back.state).away, undefined);
    assert.equal(wizard(back.state).defeated, false);
    assert.equal(back.state.order[back.state.turn], "wizard");
    const at = wizard(back.state);
    assert.ok(Math.max(Math.abs(at.x! - 1), Math.abs(at.y! - 1)) === 1, JSON.stringify([at.x, at.y]));
    const returned = back.events.findIndex((one) => one.type === "returned");
    const turn = back.events.findIndex((one) => one.type === "turn" && one.actorId === "wizard");
    assert.ok(returned >= 0 && returned < turn, "back before the turn begins");
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "blink").blinks = { atLeast: 21 })),
    /a face of its die/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions blink their holder off the board until their next turn (a condition's blinks) requires schemaVersion 2 and capabilityApi 1.506 or newer";
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
    doc.combat.conditions[0].blinks = { atLeast: 11 };
    assert.equal(getCapabilityPackageInstallIssue(manifest(505) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(506) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(505) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Blink: an 11 as the turn ends takes its holder off the board, out of reach and not lost, back as their next turn starts in the nearest free place; gated at 1.506.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
