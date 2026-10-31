/**
 * Ground some creatures cross easily, or are harmed in (Capability API 1.708).
 *
 *   - Ice Walk (`easyGround`): woods on a snowy board, and a Sleet Storm's ice, are no hard going for
 *     a white dragon; woods elsewhere, and a web, still are.
 *   - Water Susceptibility (`harmedEntering`): a fire elemental takes 1 cold for each cell it walks
 *     in a Wall of Water.
 *   - Refused with nowhere to harm; the install gate.
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
import { rulesetSyncSpeeds } from "../../packages/shared/src/features/ruleset-combat/encounter.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ground-by-tile-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 708);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const susceptible = { terrain: ["water"], zones: ["Wall of Water"], harm: { flat: 1, damageType: "cold" } };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "ice_walk", label: "Ice Walk" },
      { id: "water_sus", label: "Water Susceptibility" },
    );
    doc.combat.conditions.push(
      { condition: "ice_walk", effects: [], easyGround: ["snow", "Sleet Storm"] },
      { condition: "water_sus", effects: [], harmedEntering: susceptible },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({ health: 80, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  // One row: the mover at (0,0), the ground from x=1 on woods or plains, a foe out of the way.
  const fight = (
    conditions: string[],
    tile: "forest" | "plains",
    { environment, zone }: { environment?: string; zone?: string } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mover", name: "Mover", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 12, height: 2, tiles: [["plains", ...Array(11).fill(tile)], Array(12).fill("wall")] },
        placements: { mover: { x: 0, y: 0 }, foe: { x: 11, y: 0 } },
      },
    } as never);
    if (environment) state.board!.environment = environment as never;
    if (zone) {
      const foe = rulesetCombatant(state, "foe")!;
      foe.actions.push({
        id: "storm",
        label: zone,
        budget: "action",
        targets: { side: "enemy" },
        zone: { difficult: true },
      } as never);
      foe.zones = [
        {
          actionId: "storm",
          label: zone,
          rounds: 10,
          anchor: "point",
          triggers: [],
          at: { x: 3, y: 0 },
          cells: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 0 })),
        },
      ];
    }
    const mover = rulesetCombatant(state, "mover")!;
    for (const condition of conditions) mover.tracked.push({ condition, rounds: null } as never);
    rulesetSyncSpeeds(definition, state);
    state.order = ["mover", "foe"];
    state.turn = 0;
    return state;
  };
  const farthest = (state: RulesetEncounterState) =>
    Math.max(...rulesetReachableCells(definition, state, "mover").map((cell) => cell.x));

  // ── Ice Walk: woods on a snowy board, and a Sleet Storm, are easy going ──
  assert.equal(farthest(fight([], "forest", { environment: "snow" })), 3, "woods are hard going");
  assert.equal(farthest(fight(["ice_walk"], "forest")), 3, "woods off the snow are still hard going");
  assert.equal(farthest(fight(["ice_walk"], "forest", { environment: "snow" })), 6, "snowy woods are not");
  assert.equal(farthest(fight([], "plains", { zone: "Sleet Storm" })), 3);
  assert.equal(farthest(fight(["ice_walk"], "plains", { zone: "Sleet Storm" })), 6, "nor is a Sleet Storm's ice");
  assert.equal(farthest(fight(["ice_walk"], "plains", { zone: "Web" })), 3, "a web still is");

  // ── Water Susceptibility: 1 cold for each cell walked in a Wall of Water ──
  {
    const state = fight(["water_sus"], "plains", { zone: "Wall of Water" });
    rulesetCombatant(state, "foe")!.actions.find((one) => one.id === "storm")!.zone = {} as never;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mover", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 3, y: 0 } },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    const cold = of(step.events, "damage").filter((one) => one.targetId === "mover");
    assert.equal(cold.length, 3, JSON.stringify(cold));
    assert.ok(cold.every((one) => one.dealt === 1 && one.damageType === "cold"));
  }
  {
    const state = fight(["water_sus"], "plains", { zone: "Web" });
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mover", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 2, y: 0 } },
      () => 10,
    );
    assert.equal(of(step.events, "damage").length, 0, "not in a web");
  }

  // ── Refused with nowhere to harm ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "water_sus").harmedEntering = {
          harm: { flat: 1 },
        };
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Say where it harms/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose holder goes easily over some tiles or is harmed walking into some (easyGround or harmedEntering) requires schemaVersion 2 and capabilityApi 1.708 or newer";
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
    const without = fiveE((doc) => {
      for (const one of doc.combat.conditions) {
        delete one.easyGround;
        delete one.harmedEntering;
      }
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(707) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(708) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(707) as never, without), gate);
  }

  console.log(
    "Ground by tile: Ice Walk crosses snowy woods and a Sleet Storm at a plain step, not a web; a fire elemental takes 1 cold a cell in a Wall of Water; gated at 1.708.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
