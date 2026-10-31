/**
 * Dragging a grappled creature (Capability API 1.497).
 *
 *   - A grappler's walk drags whoever holds `grappled` from them into each cell they leave, at half
 *     speed; a creature two sizes smaller is dragged at full speed.
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
  rulesetReachableCells,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-dragging-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 497);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (dragged: Record<string, unknown> | null = { unlessSmaller: 2 }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sizes = {
      order: [
        { id: "tiny", label: "Tiny" },
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
      ],
      default: "medium",
    };
    const grappled = doc.combat.conditions.find((one: { condition: string }) => one.condition === "grappled");
    if (dragged) grappled.dragged = dragged;
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
  const block = (size: string): RulesetStatBlock =>
    ({ health: 30, defense: 10, initiativeModifier: 0, speed: 30, size, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (definition: RulesetDefinition, size: string): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "wrestler", name: "Wrestler", side: "party", block: block("medium") },
        { id: "held", name: "Held", side: "enemy", block: block(size) },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] } as never,
        placements: { wrestler: { x: 2, y: 0 }, held: { x: 1, y: 0 } },
      },
    });
    state.order = ["wrestler", "held"];
    state.turn = 0;
    rulesetCombatant(state, "held")!.tracked.push({ condition: "grappled", rounds: null, source: "wrestler" });
    return state;
  };
  const far = (definition: RulesetDefinition, state: RulesetEncounterState) =>
    Math.max(...rulesetReachableCells(definition, state, "wrestler").map((cell) => cell.x));
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());

  // ── Dragged at half speed: three cells of six ──
  {
    const state = fight(definition, "small");
    assert.equal(far(definition, state), 5, "three cells on");
    const walked = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wrestler", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 0 } },
      () => 10,
    );
    assert.deepEqual(of(walked.events, "refused"), [], JSON.stringify(walked.events));
    const held = rulesetCombatant(walked.state, "held")!;
    assert.deepEqual([held.x, held.y], [4, 0], "dragged into the cell left behind");
    assert.equal(rulesetCombatant(walked.state, "wrestler")!.movementLeft, 0);
    assert.ok(
      held.tracked.some((one) => one.condition === "grappled"),
      "still held",
    );
  }

  // ── Two sizes smaller: full speed ──
  {
    const state = fight(definition, "tiny");
    assert.equal(far(definition, state), 8, "six cells on");
  }

  // ── Without the rule, nobody is dragged and the walk is not slowed ──
  {
    const plain = parsed(fiveE(null));
    const state = fight(plain, "small");
    assert.equal(far(plain, state), 8);
    const walked = applyRulesetCombatChoice(
      plain,
      state,
      { actorId: "wrestler", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 0 } },
      () => 10,
    );
    assert.equal(rulesetCombatant(walked.state, "held")!.x, 1, "left where it was");
  }

  // ── Refusals ──
  refused(fiveE({ unlessSmaller: 0 }), /unlessSmaller/);
  refused(fiveE({ halves: true }), /Unrecognized key/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions drag their holder along with whoever put them on (dragged) requires schemaVersion 2 and capabilityApi 1.497 or newer";
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
    const onlyDrag = JSON.parse(fiveEText) as Record<string, any>;
    onlyDrag.combat.conditions.find((one: { condition: string }) => one.condition === "grappled").dragged = {};
    assert.equal(getCapabilityPackageInstallIssue(manifest(496) as never, onlyDrag), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(497) as never, onlyDrag), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(496) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Dragging: a grappler drags whoever they hold into each cell they leave at half speed, at full speed two sizes smaller; gated at 1.497.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
