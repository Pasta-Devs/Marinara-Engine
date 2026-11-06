/**
 * Elemental forms, and landing from a fallen mount (Capability API 1.504).
 *
 *   - `stopsInFoes`: into a hostile creature's space and stopping there; never in a friend's.
 *   - `entering`: the first time in a turn its holder enters a creature's space, harm and a condition.
 *   - `mounts.fall.landsWith`: a reaction lands a rider on their feet off a mount knocked prone.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-elemental-forms-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 504);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const entering = {
    harm: { dice: "1d10", damageType: "fire" },
    applies: [{ condition: "on_fire", duration: "until-dispelled" }],
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "air_form", label: "Air Form" },
      { id: "fire_form", label: "Fire Form" },
      { id: "on_fire", label: "On Fire" },
    );
    doc.combat.conditions.push(
      { condition: "air_form", effects: [], stopsInFoes: true },
      { condition: "fire_form", effects: [], stopsInFoes: true, entering },
      { condition: "on_fire", effects: [] },
    );
    doc.combat.sizes = {
      order: [
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large" },
      ],
      default: "medium",
    };
    doc.combat.mounts = {
      larger: 1,
      fall: { save: "dex_save", difficulty: 10, applies: "prone", when: ["prone"], landsWith: "reaction" },
    };
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
  const block = (size = "medium"): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      size,
      saves: { dex_save: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const fight = (form: string | null): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 5,
      combatants: [
        { id: "elemental", name: "Elemental", side: "enemy", block: block() },
        { id: "foe", name: "Foe", side: "party", block: block() },
        { id: "other", name: "Other", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 10, height: 1, tiles: [Array(10).fill("plains")] } as never,
        placements: { elemental: { x: 1, y: 0 }, foe: { x: 3, y: 0 }, other: { x: 6, y: 0 }, friend: { x: 0, y: 0 } },
      },
    });
    state.order = ["elemental", "foe", "other", "friend"];
    state.turn = 0;
    if (form) rulesetCombatant(state, "elemental")!.tracked.push({ condition: form, rounds: null });
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const stops = (state: RulesetEncounterState) =>
    rulesetReachableCells(definition, state, "elemental").map((cell) => cell.x);
  const walk = (state: RulesetEncounterState, x: number) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "elemental", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x, y: 0 } },
      () => 5,
    );

  // ── Air Form: into a foe's space and stopping there; never a friend's ──
  {
    assert.ok(!stops(fight(null)).includes(3), "a foe's space is no stop without it");
    assert.ok(!stops(fight(null)).includes(4), "nor walked through");
    const air = fight("air_form");
    assert.ok(stops(air).includes(3), JSON.stringify(stops(air)));
    assert.ok(stops(air).includes(4), "through and beyond");
    assert.ok(!stops(air).includes(0), "a friend's space is not somewhere to stop");
    const into = walk(air, 3);
    assert.deepEqual(of(into.events, "refused"), []);
    assert.equal(rulesetCombatant(into.state, "elemental")!.x, 3);
    assert.equal(of(into.events, "damage").length, 0, "Air Form burns nobody");
  }

  // ── Fire Form: 1d10 fire and set alight, once a turn each ──
  {
    const through = walk(fight("fire_form"), 4);
    const burns = of(through.events, "damage");
    assert.equal(burns.length, 1, JSON.stringify(through.events));
    assert.equal(burns[0]!.targetId, "foe");
    assert.equal(burns[0]!.damageType, "fire");
    assert.equal(burns[0]!.amount, 5);
    assert.ok(rulesetCombatant(through.state, "foe")!.tracked.some((one) => one.condition === "on_fire"));
    // Back through the same space in the same turn: nothing more.
    const back = walk(through.state, 2);
    assert.equal(of(back.events, "damage").length, 0, "once a turn");
    // Somebody new is burned on the same turn.
    rulesetCombatant(back.state, "elemental")!.movementLeft = 6;
    const on = walk(back.state, 6);
    assert.deepEqual(of(on.events, "refused"), []);
    assert.deepEqual(
      of(on.events, "damage").map((one) => one.targetId),
      ["other"],
    );
  }

  // ── A rider whose mount is knocked prone lands on their feet for a reaction ──
  const ridden = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 5,
      combatants: [
        { id: "knight", name: "Knight", side: "party", block: block() },
        { id: "horse", name: "Horse", side: "party", block: block("large") },
        { id: "goblin", name: "Goblin", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 8, height: 3, tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")) } as never,
        placements: { knight: { x: 1, y: 1 }, horse: { x: 2, y: 1 }, goblin: { x: 7, y: 1 } },
      },
    });
    state.order = ["knight", "horse", "goblin"];
    state.turn = 0;
    const mounted = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "knight", optionId: "move:mount:horse", targetIds: [] },
      () => 5,
    ).state;
    assert.equal(rulesetCombatant(mounted, "knight")!.mountedOn, "horse");
    mounted.turn = 2;
    return mounted;
  };
  const endGoblin = (state: RulesetEncounterState) =>
    applyRulesetCombatChoice(definition, state, { actorId: "goblin", optionId: "end-turn", targetIds: [] }, () => 5);
  {
    const state = ridden();
    rulesetCombatant(state, "horse")!.tracked.push({ condition: "prone", rounds: null });
    const landed = endGoblin(state);
    const knight = rulesetCombatant(landed.state, "knight")!;
    assert.equal(knight.mountedOn, undefined);
    assert.ok(!knight.tracked.some((one) => one.condition === "prone"), "on their feet");
    assert.equal(of(landed.events, "save").length, 0, "no save thrown");
    assert.equal(of(landed.events, "mount")[0]?.fell, undefined);
    // With no reaction left (the horse's turn comes next, so the knight's is not back yet): the save,
    // failed on a 5, and prone.
    const spent = ridden();
    spent.order = ["knight", "goblin", "horse"];
    spent.turn = 1;
    rulesetCombatant(spent, "knight")!.budgets.reaction = 0;
    rulesetCombatant(spent, "horse")!.tracked.push({ condition: "prone", rounds: null });
    const thrown = endGoblin(spent);
    assert.ok(rulesetCombatant(thrown.state, "knight")!.tracked.some((one) => one.condition === "prone"));
    assert.equal(of(thrown.events, "mount")[0]?.fell, true);
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "fire_form").entering = {})),
    /harm or applies/,
  );
  refused(
    fiveE(
      (doc) =>
        (doc.combat.conditions.find((one: any) => one.condition === "fire_form").entering = {
          applies: [{ condition: "burning", duration: "instant" }],
        }),
    ),
    /Unknown condition "burning"/,
  );
  refused(
    fiveE((doc) => (doc.combat.mounts.fall.landsWith = "luck")),
    /Unknown budget "luck"/,
  );
  refused(
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "air_form").stopsInFoes = false)),
    /stopsInFoes/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose combatants stop in a foe's space, harm whoever's space they enter, or land from a fallen mount (stopsInFoes, entering, mounts fall landsWith) requires schemaVersion 2 and capabilityApi 1.504 or newer";
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
    const doc = (edit: (one: Record<string, any>) => void) => {
      const one = JSON.parse(fiveEText) as Record<string, any>;
      edit(one);
      return one;
    };
    const air = doc((one) => (one.combat.conditions[0].stopsInFoes = true));
    assert.equal(getCapabilityPackageInstallIssue(manifest(503) as never, air), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(504) as never, air), gate);
    const fire = doc((one) => (one.combat.conditions[0].entering = entering));
    assert.equal(getCapabilityPackageInstallIssue(manifest(503) as never, fire), gate);
    const lands = doc(
      (one) => (one.combat.mounts = { larger: 1, fall: { save: "dex_save", difficulty: 10, landsWith: "reaction" } }),
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(503) as never, lands), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(503) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Elemental forms: Air Form stops in a foe's space, Fire Form burns and sets alight each it enters once a turn, a rider lands on their feet for a reaction; gated at 1.504.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
