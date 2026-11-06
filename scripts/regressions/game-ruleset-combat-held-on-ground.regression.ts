/**
 * A condition held only on some ground (Capability API 1.714): 5e's vampire in running water.
 *
 *   - `heldOnlyIn.ground`: it holds only while its holder stands on a tile it names, on a board whose
 *     place it names, or in a lasting area left by an action it names by id or label.
 *   - Off a board it is held off.
 *   - Import refusals and the install gate.
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatHealth,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-on-ground-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 714);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (heldOnlyIn: Record<string, unknown> = { ground: ["water", "Running Water"] }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "in_water", label: "Running Water" });
    doc.combat.conditions.push({ condition: "in_water", effects: [], heldOnlyIn });
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
    ({ health: 80, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  // One row: plains, water, plains and the rest; the vampire stands at x.
  const fight = (x: number | null, { environment, zone }: { environment?: string; zone?: string } = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "vampire", name: "Vampire", side: "enemy", block: block() },
        { id: "druid", name: "Druid", side: "party", block: block() },
      ],
      ...(x === null
        ? {}
        : {
            board: {
              grid: {
                width: 8,
                height: 2,
                tiles: [["plains", "water", ...Array(6).fill("plains")], Array(8).fill("wall")],
              },
              placements: { vampire: { x, y: 0 }, druid: { x: 7, y: 0 } },
            },
          }),
    } as never) as RulesetEncounterState;
    if (environment) state.board!.environment = environment as never;
    if (zone) {
      const druid = rulesetCombatant(state, "druid")!;
      druid.actions.push({
        id: "current",
        label: zone,
        budget: "action",
        targets: { side: "enemy" },
        zone: {},
      } as never);
      druid.zones = [
        {
          actionId: "current",
          label: zone,
          rounds: 10,
          anchor: "point",
          triggers: [],
          at: { x: 4, y: 0 },
          cells: [3, 4, 5].map((at) => ({ x: at, y: 0 })),
        },
      ];
    }
    rulesetCombatant(state, "vampire")!.tracked.push({ condition: "in_water", rounds: null } as never);
    return state;
  };
  const holds = (state: RulesetEncounterState) =>
    rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(state, "vampire")!, state).some(
      (one) => one.condition === "in_water",
    );

  // ── On a water tile, not off it ──
  assert.equal(holds(fight(1)), true);
  assert.equal(holds(fight(0)), false);
  // ── On a board whose whole place it names ──
  {
    const doc = fiveE({ ground: ["swamp"] });
    const swamp = parsed(doc);
    const state = fight(0, { environment: "swamp" });
    assert.equal(
      rulesetActiveConditions(swamp, swamp.combat!, rulesetCombatant(state, "vampire")!, state).some(
        (one) => one.condition === "in_water",
      ),
      true,
    );
  }
  // ── In a lasting area left by an action it names, by label or id ──
  assert.equal(holds(fight(4, { zone: "Running Water" })), true);
  assert.equal(holds(fight(4, { zone: "Fog Cloud" })), false);
  assert.equal(holds(fight(6, { zone: "Running Water" })), false, "outside the area");
  // ── Off a board, held off ──
  assert.equal(holds(fight(null)), false);

  // ── Held off, it harms nobody: a vampire's running water away from water ──
  {
    const doc = fiveE();
    doc.combat.conditions.at(-1).harms = { at: "turn-end", flat: 20, type: "acid" };
    const harmful = parsed(doc);
    const harmed = (x: number) => {
      const state = fight(x);
      state.order = ["vampire", "druid"];
      state.turn = 0;
      const step = applyRulesetCombatChoice(
        harmful,
        state,
        { actorId: "vampire", optionId: "end-turn", targetIds: [] },
        () => 10,
      );
      return 80 - rulesetCombatHealth(harmful, harmful.combat!, rulesetCombatant(step.state, "vampire")!).value;
    };
    assert.equal(harmed(1), 20, "in the water");
    assert.equal(harmed(0), 0, "on dry ground");
  }

  // ── Refusals ──
  refused(fiveE({ ground: [] }), /ground/);
  refused(fiveE({}), /heldOnlyIn/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition held only on ground it names (heldOnlyIn.ground) requires schemaVersion 2 and capabilityApi 1.714 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(713) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(714) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(713) as never, fiveE({ light: ["sunlight"] })), gate);
  }

  console.log(
    "Held on ground: a vampire's running-water condition holds on a water tile, a swamp board and a Running Water area, and is held off elsewhere and off a board; gated at 1.714.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
