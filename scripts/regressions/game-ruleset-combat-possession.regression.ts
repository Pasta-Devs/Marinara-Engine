/**
 * A creature that goes into whom it lands on (Capability API 1.696): a ghost's Possession, "the ghost
 * disappears, and the target is incapacitated and loses control of its body. The ghost now controls
 * the body ... The possession lasts until the body drops to 0 hit points".
 *
 *   - Failed, the target holds the condition and fights on the ghost's side; the ghost is away.
 *   - Made, nothing happens and the ghost stays.
 *   - The body dropping to nothing ends it: the ghost comes back beside it, the body back on its own side.
 *   - The condition ended any other way brings the ghost back the same: `endable` lets the ghost leave
 *     at will, as a bonus action taken through the body.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-possession-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 696);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const possession = (dismisses: Record<string, unknown> = { while: "possessed", possesses: true }) => ({
    id: "possession",
    name: "Possession",
    budget: "action",
    reach: 5,
    save: { save: "cha_save", difficulty: 13, onSuccess: "negates" },
    applies: [{ condition: "possessed", duration: "until-dispelled" }],
    dismisses,
  });
  const fiveE = (action: Record<string, unknown> = possession()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "possessed", label: "Possessed" });
    doc.combat.conditions.push({
      condition: "possessed",
      effects: [],
      controls: true,
      endsWhenHolder: { downed: true },
    });
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.push(action);
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
  const definition = parsed(fiveE());
  const block = (more: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...more,
    }) as unknown as RulesetStatBlock;
  const fight = (chaSave: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ghost", name: "Ghost", side: "enemy", block: block({ actions: [possession()] }) },
        { id: "knight", name: "Knight", side: "party", block: block({ saves: { cha_save: chaSave } }) },
        { id: "squire", name: "Squire", side: "party", block: block() },
      ],
      board: {
        grid: { width: 12, height: 3, tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")) },
        placements: { ghost: { x: 5, y: 1 }, knight: { x: 6, y: 1 }, squire: { x: 0, y: 0 } },
      },
    } as never);
    state.order = ["ghost", "knight", "squire"];
    state.turn = 0;
    return state;
  };
  const possess = (chaSave: number) => {
    const step = applyRulesetCombatChoice(
      definition,
      fight(chaSave),
      { actorId: "ghost", optionId: "possession", targetIds: ["knight"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };

  // ── Made: nothing ──
  {
    const made = possess(5);
    assert.equal(rulesetCombatant(made.state, "ghost")!.away, undefined);
    assert.equal(rulesetCombatant(made.state, "knight")!.side, "party");
  }
  // ── Failed: the ghost goes in, the knight fights for it ──
  const failed = possess(0);
  {
    const ghost = rulesetCombatant(failed.state, "ghost")!;
    const knight = rulesetCombatant(failed.state, "knight")!;
    assert.equal(ghost.away?.possessing, "knight");
    assert.equal(ghost.defeated, true);
    assert.ok(knight.tracked.some((one) => one.condition === "possessed" && one.source === "ghost"));
    assert.equal(knight.side, "enemy", "on the ghost's side");
    assert.equal(failed.state.outcome ?? null, null, "the fight goes on");
  }
  // ── The body dropped to nothing: out comes the ghost, beside it ──
  {
    const state = structuredClone(failed.state);
    state.turn = state.order.indexOf("squire");
    rulesetCombatant(state, "knight")!.health!.value = 1;
    const squire = rulesetCombatant(state, "squire")!;
    squire.x = 7;
    squire.y = 1;
    squire.block = {
      ...squire.block!,
      actions: [
        { id: "club", name: "Club", budget: "action", toHit: 20, damage: { count: 1, sides: 4, flat: 5 }, reach: 5 },
      ],
    } as never;
    squire.actions = createRulesetEncounter({
      definition,
      seed: 1,
      combatants: [{ id: "s", name: "S", side: "party", block: squire.block! }],
    } as never).combatants[0]!.actions;
    squire.budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "squire", optionId: squire.actions[0]!.id, targetIds: ["knight"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    const ghost = rulesetCombatant(step.state, "ghost")!;
    const knight = rulesetCombatant(step.state, "knight")!;
    assert.equal(knight.down, true);
    assert.equal(
      knight.tracked.some((one) => one.condition === "possessed"),
      false,
    );
    assert.equal(ghost.away, undefined, JSON.stringify(step.events));
    assert.equal(ghost.defeated, false);
    assert.ok(Math.max(Math.abs(ghost.x! - knight.x!), Math.abs(ghost.y! - knight.y!)) <= 1, "beside the body");
    assert.equal(knight.side, "party", "back on its own side");
    assert.ok(of(step.events, "returned").some((one) => one.targetId === "ghost"));
  }

  // ── The ghost ending it at will, as a bonus action, through the body it holds ──
  {
    const doc = fiveE();
    doc.combat.conditions.find((one: { condition: string }) => one.condition === "possessed").endable = {
      budget: "bonus",
    };
    const endable = parsed(doc);
    const state = createRulesetEncounter({
      definition: endable,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ghost", name: "Ghost", side: "enemy", block: block({ actions: [possession()] }) },
        { id: "knight", name: "Knight", side: "party", block: block({ saves: { cha_save: 0 } }) },
      ],
      board: {
        grid: { width: 12, height: 3, tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")) },
        placements: { ghost: { x: 5, y: 1 }, knight: { x: 6, y: 1 } },
      },
    } as never);
    state.order = ["ghost", "knight"];
    state.turn = 0;
    const went = applyRulesetCombatChoice(
      endable,
      state,
      { actorId: "ghost", optionId: "possession", targetIds: ["knight"] },
      () => 10,
    );
    assert.equal(rulesetCombatant(went.state, "ghost")!.away?.possessing, "knight");
    const next = structuredClone(went.state);
    next.turn = next.order.indexOf("knight");
    rulesetCombatant(next, "knight")!.budgets.bonus = 1;
    const step = applyRulesetCombatChoice(
      endable,
      next,
      { actorId: "knight", optionId: "end-condition:possessed", targetIds: [] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    assert.equal(rulesetCombatant(step.state, "ghost")!.away, undefined, "the ghost comes out");
    assert.equal(rulesetCombatant(step.state, "knight")!.side, "party");
  }

  // ── Refused ──
  refused(
    fiveE(possession({ while: "possessed", possesses: true, turns: true })),
    /"possesses" sends the creature into its target/,
  );
  refused(
    fiveE({ ...possession(), self: true }),
    /"possesses" goes into whom the action lands on, so the action is not "self"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that goes into whom it lands on (dismisses.possesses) requires schemaVersion 2 and capabilityApi 1.696 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(695) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(696) as never, fiveE()), gate);
  }

  console.log(
    "Possession: the ghost goes into the knight, who fights for it, and comes out beside the body as it drops; gated at 1.696.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
