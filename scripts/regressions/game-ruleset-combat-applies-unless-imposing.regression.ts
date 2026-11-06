/**
 * A condition put on unless its applier already holds one (Capability API 1.740), and a sequence's
 * reach (no minor): a chain devil's Chain, "grappled (escape DC 14) if the devil isn't already
 * grappling a creature", its restraint ending with the grapple; its Multiattack of two chains, each
 * reaching 10 feet.
 *
 *   - The first chain grapples and restrains; the second, at another, only strikes.
 *   - The Multiattack is offered at a foe 10 feet off, and each part is made only where it reaches.
 *   - Import and the install gate.
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
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-applies-unless-imposing-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 740);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const chainApplies = (unless: unknown = ["grappled"]) => [
    {
      condition: "grappled",
      duration: "instant",
      escapeDc: 14,
      ...(unless !== null ? { unlessImposing: unless } : {}),
    },
    { condition: "restrained", duration: "instant", endsWith: "grappled" },
  ];
  const fiveE = (unless: unknown = ["grappled"]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const creatures = doc.catalogs.find((one: { id: string }) => one.id === "creatures");
    creatures.entries[0].creature.actions.push(
      {
        id: "chain",
        name: "Chain",
        budget: "action",
        toHit: 8,
        damage: { dice: "2d6", flat: 4, type: "slashing" },
        reach: 10,
        applies: chainApplies(unless),
      },
      { id: "chains", name: "Multiattack", budget: "action", sequence: [{ action: "chain", times: 2 }] },
      { id: "claw", name: "Claw", budget: "action", toHit: 8, damage: { dice: "1d6", type: "slashing" }, reach: 5 },
      {
        id: "chain_and_claw",
        name: "Chain and Claw",
        budget: "action",
        sequence: [
          { action: "chain", times: 1 },
          { action: "claw", times: 1 },
        ],
      },
    );
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
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const devil = rulesetStatBlockFromCreature(definition, creature)!;
  const foe = {
    health: 500,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const fight = (placements: Record<string, { x: number; y: number }>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "devil", name: "Chain Devil", side: "enemy", block: { ...devil, health: 200 } },
        { id: "ana", name: "Ana", side: "party", block: foe },
        { id: "bo", name: "Bo", side: "party", block: foe },
      ],
      board: {
        grid: { width: 12, height: 8, tiles: Array.from({ length: 8 }, () => Array(12).fill("plains")) },
        placements,
      },
    } as never);
    state.order = ["devil", "ana", "bo"];
    state.turn = 0;
    return state;
  };
  const holds = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!
      .tracked.map((one) => one.condition)
      .filter((one) => one === "grappled" || one === "restrained")
      .sort();

  // ── One grapple at a time: the second chain only strikes ──
  {
    const state = fight({ devil: { x: 2, y: 3 }, ana: { x: 3, y: 3 }, bo: { x: 2, y: 4 } });
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "devil", optionId: "chains", targetIds: ["ana", "bo"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    assert.equal(of(step.events, "attack").filter((one) => one.outcome === "hit").length, 2);
    assert.deepEqual(holds(step.state, "ana"), ["grappled", "restrained"]);
    assert.deepEqual(holds(step.state, "bo"), []);
  }

  // ── The Multiattack reaches as far as its chains, each made only where it reaches ──
  {
    const state = fight({ devil: { x: 2, y: 3 }, ana: { x: 4, y: 3 }, bo: { x: 9, y: 3 } });
    const offered = rulesetCombatOptions(definition, state, "devil").find((one) => one.id === "chains");
    assert.ok(offered, "offered");
    const near = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "devil", optionId: "chains", targetIds: ["ana", "ana"] },
      () => 10,
    );
    assert.deepEqual(of(near.events, "refused"), [], JSON.stringify(near.events));
    assert.equal(of(near.events, "attack").length, 2, "both chains at Ana, 10 feet off");
    const far = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "devil", optionId: "chains", targetIds: ["ana", "bo"] },
      () => 10,
    );
    assert.equal(of(far.events, "refused").length, 1, "Bo, 35 feet off, is beyond the chain");
    const mixed = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "devil", optionId: "chain_and_claw", targetIds: ["ana", "ana"] },
      () => 10,
    );
    assert.deepEqual(of(mixed.events, "refused"), [], JSON.stringify(mixed.events));
    assert.deepEqual(
      of(mixed.events, "attack").map((one) => one.optionId),
      ["chain"],
      "the claw does not reach Ana 10 feet off",
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition put on only while its applier holds none of some on anybody (applies[].unlessImposing) requires schemaVersion 2 and capabilityApi 1.740 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(739) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(740) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(739) as never, fiveE(null)), gate);
  }

  console.log(
    "Applies unless imposing: a chain devil grapples one at a time, its Multiattack reaching 10 feet chain by chain; gated at 1.740.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
