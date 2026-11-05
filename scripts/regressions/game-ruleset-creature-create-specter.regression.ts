/**
 * Calls raised from a corpse, and held to a most (Capability API 1.554).
 *
 *   - A wraith's Create Specter: offered only with a humanoid corpse that died no more than 10
 *     rounds ago; the specter rises in the corpse's space, on the wraith's side, and the corpse is
 *     gone. A beast's corpse, or one dead too long, is never offered.
 *   - No more than seven specters at once.
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
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-create-specter-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 554);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid", "undead"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
    creatures.entries.push(
      {
        id: "specter",
        label: "Specter",
        creature: {
          health: 22,
          defense: 12,
          initiativeModifier: 2,
          speed: 50,
          tier: "cr_1",
          type: "undead",
          actions: [{ id: "touch", name: "Life Drain", budget: "action", toHit: 4, damage: { flat: 10 }, reach: 5 }],
        },
      },
      {
        id: "wraith",
        label: "Wraith",
        creature: {
          health: 67,
          defense: 13,
          initiativeModifier: 3,
          speed: 60,
          tier: "cr_5",
          type: "undead",
          actions: [
            { id: "drain", name: "Life Drain", budget: "action", toHit: 6, damage: { flat: 21 }, reach: 5 },
            {
              id: "create_specter",
              name: "Create Specter",
              budget: "action",
              reach: 10,
              calls: {
                creature: "creatures/specter",
                count: { flat: 1 },
                atCorpse: { withinRounds: 10, is: { types: ["humanoid"] } },
                atMost: 7,
              },
            },
          ],
        },
      },
    );
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const creaturesId = definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.id;
  assert.equal(creaturesId, "creatures");
  const block = (id: string) =>
    rulesetCreatureBlock(
      definition,
      definition.catalogs!.flatMap((catalog) => catalog.entries).find((one) => one.id === id),
    )!;
  const plain = (type: string): RulesetStatBlock =>
    ({
      health: 10,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      type,
      actions: [{ id: "hit", name: "Hit", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    }) as RulesetStatBlock;
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wraith",
          name: "Wraith",
          side: "enemy",
          creature: { catalogId: "creatures", entryId: "wraith" },
          block: block("wraith"),
        },
        { id: "guard", name: "Guard", side: "party", block: plain("humanoid") },
        { id: "dog", name: "Dog", side: "party", block: plain("beast") },
        { id: "knight", name: "Knight", side: "party", block: plain("humanoid") },
      ],
      board: {
        grid: { width: 10, height: 10, tiles: Array.from({ length: 10 }, () => Array(10).fill("plains")) },
        placements: { wraith: { x: 4, y: 4 }, guard: { x: 5, y: 4 }, dog: { x: 4, y: 5 }, knight: { x: 3, y: 4 } },
      },
    } as never);
    state.order = ["wraith", "guard", "dog", "knight"];
    state.turn = 0;
    return state;
  };
  const kill = (state: RulesetEncounterState, id: string, round: number) => {
    const one = rulesetCombatant(state, id)!;
    one.health!.value = 0;
    Object.assign(one, { down: true, defeated: true, diedRound: round });
  };
  const create = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "wraith").find((one) => one.label === "Create Specter");

  // ── Nothing dead: not offered ──
  assert.equal(create(fight()), undefined);

  // ── A dead guard and a dead dog: only the guard ──
  {
    const state = fight();
    kill(state, "guard", 1);
    kill(state, "dog", 1);
    const option = create(state);
    assert.ok(option, "offered with a humanoid corpse");
    assert.deepEqual(rulesetOptionTargets(definition, state, "wraith", option, true), ["guard"]);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wraith", optionId: option.id, targetIds: ["guard"] },
      () => 10,
    );
    const called = step.state.combatants.filter((one) => one.calledBy === "wraith");
    assert.equal(called.length, 1);
    assert.equal(called[0]!.name, "Specter");
    assert.equal(called[0]!.side, "enemy");
    assert.deepEqual([called[0]!.x, called[0]!.y], [5, 4], "in the corpse's space");
    const guard = rulesetCombatant(step.state, "guard")!;
    assert.ok(guard.corpseRaised);
    assert.equal(guard.x, undefined, "the corpse is gone");
    step.state.turn = 0;
    rulesetCombatant(step.state, "wraith")!.budgets.action = 1;
    assert.equal(create(step.state), undefined, "the dog will not do");
  }

  // ── Dead too long ──
  {
    const state = fight();
    kill(state, "guard", 1);
    state.round = 12;
    assert.equal(create(state), undefined);
  }

  // ── Seven at most ──
  {
    const state = fight();
    kill(state, "knight", 1);
    for (let index = 0; index < 7; index++) {
      state.combatants.push({
        ...structuredClone(rulesetCombatant(state, "dog")!),
        id: `specter-${index}`,
        defeated: false,
        down: false,
        calledBy: "wraith",
        calledWith: "create_specter",
      });
    }
    assert.equal(create(state), undefined, "seven already");
    rulesetCombatant(state, "specter-0")!.defeated = true;
    assert.ok(create(state), "six standing");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call raised from a corpse or held to a most (calls.atCorpse, calls.atMost) requires schemaVersion 2 and capabilityApi 1.554 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(553) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(554) as never, document()), gate);
  }

  console.log(
    "Create Specter: offered only with a fresh humanoid corpse, the specter rises in its space on the wraith's side and the corpse is gone, never past seven at once; gated at 1.554.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
