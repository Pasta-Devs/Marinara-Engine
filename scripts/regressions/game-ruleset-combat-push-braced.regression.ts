/**
 * Braced against being moved (Capability API 1.718): 5e's Dwarven Plate, "if an effect moves you
 * against your will along the ground, you can use a reaction to reduce the distance you are moved by
 * up to 10 feet".
 *
 *   - `pushReducedBy {by, budget}`: a push goes that much less, paying 1 of the budget; with none of
 *     it left, the whole way. Without a budget, every time. Never more than the way.
 *   - Not while up in the air.
 *   - The log line, import refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-push-braced-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 718);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (pushReducedBy: unknown = { by: 10, budget: "reaction" }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "plate", label: "Dwarven Plate" });
    doc.combat.conditions.push({ condition: "plate", effects: [], pushReducedBy });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = (actions: unknown[] = []): RulesetStatBlock =>
    ({ health: 80, defense: 5, initiativeModifier: 0, speed: 30, actions }) as unknown as RulesetStatBlock;
  const fight = (definition: RulesetDefinition, push = 15): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "giant",
          name: "Giant",
          side: "enemy",
          block: block([
            { id: "slam", name: "Slam", budget: "action", toHit: 10, damage: { flat: 1 }, reach: 5, push },
          ]),
        },
        { id: "dwarf", name: "Dwarf", side: "party", block: block() },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] } as never,
        placements: { giant: { x: 0, y: 0 }, dwarf: { x: 1, y: 0 } },
      },
    });
    state.order = ["giant", "dwarf"];
    rulesetCombatant(state, "dwarf")!.tracked.push({ condition: "plate", rounds: null } as never);
    return state;
  };
  const slam = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    state.turn = 0;
    const giant = rulesetCombatant(state, "giant")!;
    giant.budgets.action = 1;
    // Stepped up beside the dwarf again.
    giant.x = rulesetCombatant(state, "dwarf")!.x! - 1;
    const option = rulesetCombatOptions(definition, state, "giant").find((one) => one.label === "Slam")!;
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "giant", optionId: option.id, targetIds: ["dwarf"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return step;
  };
  const definition = parsed(fiveE());

  // ── 15 feet, braced: 5 feet, the reaction spent; again with none left, the whole 15 ──
  {
    const first = slam(definition, fight(definition));
    assert.deepEqual(of(first.events, "pushBraced"), [
      { type: "pushBraced", actorId: "dwarf", label: "Dwarven Plate", cells: 2 },
    ]);
    const dwarf = rulesetCombatant(first.state, "dwarf")!;
    assert.equal(dwarf.x, 2);
    assert.equal(dwarf.budgets.reaction, 0);
    const second = slam(definition, first.state);
    assert.deepEqual(of(second.events, "pushBraced"), []);
    assert.equal(rulesetCombatant(second.state, "dwarf")!.x, 5);
  }

  // ── A push no longer than the brace goes nowhere ──
  {
    const step = slam(definition, fight(definition, 10));
    assert.equal(of(step.events, "pushBraced")[0]!.cells, 2);
    assert.deepEqual(of(step.events, "pushed"), []);
    assert.equal(rulesetCombatant(step.state, "dwarf")!.x, 1);
  }

  // ── Without a budget, every time ──
  {
    const free = parsed(fiveE({ by: 5 }));
    const first = slam(free, fight(free));
    const second = slam(free, first.state);
    assert.equal(of(second.events, "pushBraced").length, 1);
    assert.equal(rulesetCombatant(second.state, "dwarf")!.x, 5);
    assert.equal(rulesetCombatant(second.state, "dwarf")!.budgets.reaction, 1);
  }

  // ── Up in the air, not braced ──
  {
    const state = fight(definition);
    const flier = rulesetCombatant(state, "dwarf")!;
    flier.altitude = 1;
    flier.speeds = { ...flier.speeds, fly: 30 };
    const step = slam(definition, state);
    assert.deepEqual(of(step.events, "pushBraced"), []);
  }

  // ── Refusals ──
  refused(fiveE({ by: 0 }), /pushReducedBy/);
  refused(fiveE({ budget: "reaction" }), /pushReducedBy/);
  refused(fiveE({ by: 10, budget: "swift" }), /swift|budget/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition braced against being moved (pushReducedBy) requires schemaVersion 2 and capabilityApi 1.718 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(717) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(718) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(717) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Push braced: Dwarven Plate takes 10 feet off a 15-foot shove for its reaction, the next goes the whole way, a 10-foot one goes nowhere; gated at 1.718.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
