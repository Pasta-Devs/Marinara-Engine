/**
 * Creatures that hang on (Capability API 1.676).
 *
 *   - A condition's `attaches`: whoever put it on comes along beside its holder as they walk or are
 *     pushed, and attacks nobody (`"none"`, a stirge) or nobody but its holder (`"holder"`, a
 *     cloaker); `endsAfterHarm` lets go once its harms have dealt that much in all (a stirge's 10).
 *   - An applies' `withAdvantage`: put on only by an attack rolled with advantage (a cloaker's bite on
 *     the head, blinding).
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-attaches-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 676);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const withRules = (doc: Record<string, any>) => {
    doc.sheet.live.conditions.push(
      { id: "drained", label: "Drained by a stirge" },
      { id: "smothered", label: "Held by a cloaker" },
    );
    doc.combat.conditions.push(
      {
        condition: "drained",
        harms: { at: "source-turn-start", dice: "1d4", flat: 3 },
        attaches: { sourceAttacks: "none", endsAfterHarm: 10 },
      },
      { condition: "smothered", attaches: { sourceAttacks: "holder" } },
    );
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    withRules(doc);
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const drain = {
    id: "drain",
    name: "Blood Drain",
    budget: "action",
    toHit: 30,
    reach: 5,
    damage: { count: 1, sides: 4, flat: 3 },
    applies: [{ condition: "drained", duration: "instant" }],
  };
  const bite = {
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 30,
    reach: 5,
    damage: { count: 1, sides: 4, flat: 1 },
    applies: [
      { condition: "smothered", duration: "instant" },
      { condition: "blinded", duration: "instant", withAdvantage: true },
    ],
  };
  const shove = { id: "shove", name: "Shove", budget: "action", toHit: 30, reach: 5, push: 10 };
  const block = (actions: unknown[]): RulesetStatBlock =>
    ({ health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  // Every die rolls its highest, short of 10.
  const roller = (sides: number) => Math.min(sides, 10);
  const fight = (places: Record<string, RulesetCombatCell>) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "stirge", name: "Stirge", side: "enemy", block: block([drain]) },
        { id: "cloaker", name: "Cloaker", side: "enemy", block: block([bite]) },
        { id: "ogre", name: "Ogre", side: "enemy", block: block([shove]) },
        { id: "hero", name: "Hero", side: "party", block: block([]) },
        { id: "other", name: "Other", side: "party", block: block([]) },
      ],
      board: {
        grid: grid(),
        placements: {
          stirge: { x: 0, y: 0 },
          cloaker: { x: 0, y: 14 },
          ogre: { x: 19, y: 14 },
          other: { x: 19, y: 0 },
          ...places,
        } as never,
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const holds = (state: RulesetEncounterState, id: string) => who(state, id).tracked.map((one) => one.condition);
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const targets = (state: RulesetEncounterState, actorId: string, label: string) => {
    state.turn = state.order.indexOf(actorId);
    const actor = who(state, actorId);
    actor.budgets = { ...actor.budgets, action: Math.max(1, actor.budgets.action ?? 0) };
    actor.spent = [];
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    return option ? rulesetOptionTargets(definition, state, actorId, option) : [];
  };
  const use = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    choice: { targetIds?: string[]; to?: RulesetCombatCell },
  ) => {
    state.turn = state.order.indexOf(actorId);
    const option =
      label === "move"
        ? { id: RULESET_MOVE_OPTION }
        : rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: choice.targetIds ?? [], ...(choice.to ? { to: choice.to } : {}) },
      roller,
    );
    const refusal = step.events.find((one) => one.type === "refused");
    assert.equal(refusal, undefined, JSON.stringify(refusal));
    return step.state;
  };

  // ── A stirge: on, along for the walk, attacking nobody, and off once it has drunk 10 ──
  {
    let state = use(
      fight({ stirge: { x: 5, y: 5 }, hero: { x: 6, y: 5 }, other: { x: 5, y: 6 } }),
      "stirge",
      "Blood Drain",
      {
        targetIds: ["hero"],
      },
    );
    assert.deepEqual(holds(state, "hero"), ["drained"]);
    assert.deepEqual(targets(state, "stirge", "Blood Drain"), [], "attacks nobody while it hangs on");
    state = use(state, "hero", "move", { to: { x: 9, y: 5 } });
    assert.deepEqual(at(state, "hero"), { x: 9, y: 5 });
    // Into the last cell the hero walked through, beside them still.
    const stirgeAt = at(state, "stirge");
    assert.equal(Math.max(Math.abs(stirgeAt.x! - 9), Math.abs(stirgeAt.y! - 5)), 1, "carried along");
    // Pushed: carried along into the last cell they passed.
    state.order = ["ogre", "hero", "stirge", "cloaker", "other"];
    who(state, "ogre").x = 9;
    who(state, "ogre").y = 4;
    state = use(state, "ogre", "Shove", { targetIds: ["hero"] });
    assert.deepEqual(at(state, "hero"), { x: 9, y: 7 });
    assert.deepEqual(at(state, "stirge"), { x: 9, y: 6 });
    // The stirge's turns: 1d4 + 3 each, 7 then 7, and it lets go once it has 10.
    const before = health(state, "hero");
    state.turn = state.order.indexOf("hero");
    state = advanceRulesetTurn(definition, state, roller).state;
    assert.equal(state.order[state.turn], "stirge");
    assert.equal(health(state, "hero"), before - 7);
    assert.deepEqual(holds(state, "hero"), ["drained"]);
    state.turn = state.order.indexOf("hero");
    state = advanceRulesetTurn(definition, state, roller).state;
    assert.equal(health(state, "hero"), before - 14);
    assert.deepEqual(holds(state, "hero"), [], "let go at 10");
    assert.deepEqual(targets(state, "stirge", "Blood Drain").includes("hero"), true, "attacks again once off");
  }
  // ── A cloaker: nobody but whoever it holds; blinding only with advantage ──
  {
    let state = use(
      fight({ cloaker: { x: 5, y: 5 }, hero: { x: 6, y: 5 }, other: { x: 4, y: 5 } }),
      "cloaker",
      "Bite",
      {
        targetIds: ["hero"],
      },
    );
    assert.deepEqual(holds(state, "hero"), ["smothered"], "no advantage, no blinding");
    assert.deepEqual(targets(state, "cloaker", "Bite"), ["hero"], "nobody else");
    // Unseen, it bites with advantage: on the head.
    state = fight({ cloaker: { x: 5, y: 5 }, hero: { x: 6, y: 5 }, other: { x: 4, y: 5 } });
    who(state, "cloaker").tracked.push({ condition: "invisible" } as never);
    state = use(state, "cloaker", "Bite", { targetIds: ["hero"] });
    assert.deepEqual(holds(state, "hero").sort(), ["blinded", "smothered"]);
  }

  // ── Refusals ──
  refused(
    fiveE(
      (doc) => delete doc.combat.conditions.find((one: { condition: string }) => one.condition === "drained").harms,
    ),
    /"endsAfterHarm" counts what the condition's "harms" deal/,
  );
  refused(
    fiveE((doc) => {
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "smothered").attaches.sourceAttacks =
        "some";
    }),
    /sourceAttacks/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose source hangs on to its holder, or one put on only by an attack with advantage (attaches, withAdvantage), requires schemaVersion 2 and capabilityApi 1.676 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(675) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(676) as never, fiveE()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(675) as never, JSON.parse(fiveEText) as Record<string, unknown>),
      gate,
    );
  }

  console.log(
    "Attaches: carried along, attacking nobody or only its holder, let go after its harms; withAdvantage; gated at 1.676.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
