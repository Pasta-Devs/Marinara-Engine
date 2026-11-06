/**
 * Ground a careful walker crosses safely, and ground that stops a walk (Capability API 1.689).
 *
 *   - `terrain.spareSlowWalkers`: caltrops near, "Move carefully" is offered, every step into them
 *     costing double, and a careful walk across them is not caught; a plain walk is.
 *   - `terrain.endsWalk`: caught walking in and failing the save, the walker stops there with no
 *     movement left; a made save walks on.
 *   - Import refusal, and the install gate.
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
  RULESET_CAREFUL_OPTION,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetPositionOf,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-caltrops-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 689);
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
  const definition = parsed(fiveE());
  const block = (actions: unknown[] = []): RulesetStatBlock =>
    ({ health: 40, defense: 10, initiativeModifier: 0, speed: 40, actions }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({ width: 12, height: 1, tiles: [Array(12).fill("plains")] }) as TacticalGrid;
  /** Caltrops on cells 3 and 4 of a corridor, the hero at 1. */
  const fight = (rule: Record<string, unknown>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
        {
          id: "rogue",
          name: "Rogue",
          side: "enemy",
          block: block([
            {
              id: "caltrops",
              name: "Caltrops",
              budget: "action",
              autoHit: true,
              save: { save: "dex_save", difficulty: 15, onSuccess: "negates" },
              damage: { count: 0, sides: 1, flat: 1, type: "piercing" },
            },
          ]),
        },
      ],
      board: { grid: grid(), placements: { hero: { x: 1, y: 0 }, friend: { x: 0, y: 0 }, rogue: { x: 11, y: 0 } } },
    });
    const rogue = rulesetCombatant(state, "rogue")!;
    rogue.actions.find((one) => one.id === "caltrops")!.zone = rule as never;
    rogue.zones = [
      {
        actionId: "caltrops",
        label: "Caltrops",
        rounds: 100,
        anchor: "point",
        triggers: ["enter"],
        at: { x: 3, y: 0 },
        cells: [
          { x: 3, y: 0 },
          { x: 4, y: 0 },
        ],
      } as never,
    ];
    state.order = ["hero", "friend", "rogue"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const walk = (state: RulesetEncounterState, optionId: string, face: number) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId, targetIds: [], to: { x: 6, y: 0 } },
      () => face,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    const hero = rulesetCombatant(step.state, "hero")!;
    return {
      at: rulesetPositionOf(hero),
      left: hero.movementLeft,
      saves: of(step.events, "save").filter((one) => one.actorId === "hero"),
    };
  };
  const both = { spareSlowWalkers: true, endsWalk: true };

  // ── Offered while caltrops are down; careful steps over them cost double ──
  {
    const state = fight(both);
    const options = rulesetCombatOptions(definition, state, "hero");
    const careful = options.find((one) => one.id === RULESET_CAREFUL_OPTION);
    const plain = options.find((one) => one.id === RULESET_MOVE_OPTION);
    assert.ok(careful && plain, JSON.stringify(options.map((one) => one.id)));
    const cost = (cells: typeof careful.cells) => cells!.find((one) => one.x === 6 && one.y === 0)?.cost;
    assert.equal(cost(plain.cells), 5);
    assert.equal(cost(careful.cells), 7, "two cells of caltrops at double");
    // Without caltrops, no careful walk on offer.
    const bare = fight(both);
    rulesetCombatant(bare, "rogue")!.zones = [];
    assert.ok(!rulesetCombatOptions(definition, bare, "hero").some((one) => one.id === RULESET_CAREFUL_OPTION));
  }
  // ── Careful: across, uncaught ──
  {
    const crossed = walk(fight(both), RULESET_CAREFUL_OPTION, 2);
    assert.deepEqual(crossed.at, { x: 6, y: 0 });
    assert.equal(crossed.saves.length, 0);
    assert.equal(crossed.left, 40 / 5 - 7);
  }
  // ── Plain, failing the save: stopped in the caltrops, no movement left ──
  {
    const stuck = walk(fight(both), RULESET_MOVE_OPTION, 2);
    assert.equal(stuck.saves.length, 1);
    assert.deepEqual(stuck.at, { x: 3, y: 0 });
    assert.equal(stuck.left, 0);
  }
  // ── Plain, saving: on through, and the next cell of it caught no more this turn ──
  {
    const through = walk(fight(both), RULESET_MOVE_OPTION, 19);
    assert.deepEqual(through.at, { x: 6, y: 0 });
    assert.equal(through.saves.length, 1);
  }
  // ── Without endsWalk, a failure walks on ──
  {
    const on = walk(fight({ spareSlowWalkers: true }), RULESET_MOVE_OPTION, 2);
    assert.deepEqual(on.at, { x: 6, y: 0 });
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with ground a careful walker crosses safely, or that stops a walk (terrain spareSlowWalkers, endsWalk) requires schemaVersion 2 and capabilityApi 1.689 or newer";
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
    const spell = { entries: [{ mechanics: { zone: { terrain: { endsWalk: true } } } }] };
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(688) as never, JSON.parse(fiveEText), new Map([["c.json", spell]])),
      gate,
    );
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(689) as never, JSON.parse(fiveEText), new Map([["c.json", spell]])),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(688) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Caltrops: a careful walk crosses at half speed uncaught, a failed save stops a plain one; gated at 1.689.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
