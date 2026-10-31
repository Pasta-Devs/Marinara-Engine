/**
 * Jumping (Capability API 1.499).
 *
 *   - A long jump of the Strength score in feet after a 10-foot run-up, half that standing; every
 *     cell of it a cell of movement.
 *   - Over water and friends, never through a wall or a foe; a high jump clears a rise only as far as
 *     3 + Strength modifier.
 *   - A condition's `jumps`: tripled by Jump, plus the Strength modifier on a running long jump.
 *   - A hard landing: the check, or prone.
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
  RULESET_JUMP_OPTION,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetJumpReach,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-jumping-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 499);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const rule = {
    long: { ability: "str", of: "score" },
    high: { ability: "str", of: "modifier", plus: 3 },
    runUp: 10,
    standing: "half",
    hardLanding: { check: "agility", difficulty: 10, applies: "prone" },
  };
  const fiveE = (jumping: unknown = rule): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "jump", label: "Jump" }, { id: "athlete", label: "Remarkable Athlete" });
    doc.combat.conditions.push(
      { condition: "jump", effects: [], jumps: { times: 3 } },
      { condition: "athlete", effects: [], jumps: { plus: { ability: "str", long: true } } },
    );
    if (jumping !== null) doc.combat.jumping = jumping;
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
  const block = (str = 15): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      checks: { agility: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const fight = (
    definition: RulesetDefinition,
    opts: {
      str?: number;
      tiles?: Record<number, string>;
      elevation?: Record<number, number>;
      other?: { x: number; side: "party" | "enemy" };
    } = {},
  ): RulesetEncounterState => {
    const row = Array.from({ length: 20 }, (_, x) => opts.tiles?.[x] ?? "plains");
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "leaper", name: "Leaper", side: "party", block: block(opts.str) },
        { id: "other", name: "Other", side: opts.other?.side ?? "enemy", block: block() },
      ],
      board: {
        grid: {
          width: 20,
          height: 1,
          tiles: [row],
          ...(opts.elevation ? { elevation: [Array.from({ length: 20 }, (_, x) => opts.elevation![x] ?? 0)] } : {}),
        } as never,
        placements: { leaper: { x: 0, y: 0 }, other: { x: opts.other?.x ?? 19, y: 0 } },
      },
    });
    state.order = ["leaper", "other"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const jumpOption = (use: RulesetDefinition, state: RulesetEncounterState) =>
    rulesetCombatOptions(use, state, "leaper").find((option) => option.id === RULESET_JUMP_OPTION);
  const landings = (use: RulesetDefinition, state: RulesetEncounterState) =>
    (jumpOption(use, state)?.cells ?? []).filter((cell) => cell.x > 2).map((cell) => cell.x);
  const walk = (use: RulesetDefinition, state: RulesetEncounterState, x: number, roll = 10) =>
    applyRulesetCombatChoice(
      use,
      state,
      { actorId: "leaper", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x, y: 0 } },
      () => roll,
    ).state;
  const jump = (use: RulesetDefinition, state: RulesetEncounterState, x: number, roll = 10) =>
    applyRulesetCombatChoice(
      use,
      state,
      { actorId: "leaper", optionId: RULESET_JUMP_OPTION, targetIds: [], to: { x, y: 0 } },
      () => roll,
    );

  // ── Standing, 7 feet: under two cells, so no jump; after a 10-foot run-up, 15 feet ──
  {
    const state = fight(definition);
    assert.deepEqual(rulesetJumpReach(definition, state, rulesetCombatant(state, "leaper")!), {
      long: 1,
      high: 0,
      running: false,
    });
    assert.equal(jumpOption(definition, state), undefined);
    const ran = walk(definition, state, 2);
    assert.deepEqual(rulesetJumpReach(definition, ran, rulesetCombatant(ran, "leaper")!), {
      long: 3,
      high: 1,
      running: true,
    });
    assert.deepEqual(landings(definition, ran), [4, 5]);
    const leapt = jump(definition, ran, 5);
    const moved = of(leapt.events, "move")[0]!;
    assert.equal(moved.jumped, true, JSON.stringify(leapt.events));
    assert.equal(moved.cost, 3);
    const leaper = rulesetCombatant(leapt.state, "leaper")!;
    assert.equal(leaper.x, 5);
    assert.equal(leaper.movementLeft, 1, "6 cells, 2 walked and 3 jumped");
  }

  // ── Over water and a friend; not through a wall or a foe ──
  {
    const wet = walk(definition, fight(definition, { tiles: { 3: "water" } }), 2);
    assert.deepEqual(landings(definition, wet), [4, 5], "over the water");
    const friend = walk(definition, fight(definition, { other: { x: 3, side: "party" } }), 2);
    assert.deepEqual(landings(definition, friend), [4, 5], "over a friend");
    const foe = walk(definition, fight(definition, { other: { x: 4, side: "enemy" } }), 2);
    assert.deepEqual(landings(definition, foe), [], "never over a foe");
    const wall = walk(definition, fight(definition, { tiles: { 4: "wall" } }), 2);
    assert.deepEqual(landings(definition, wall), [], "never through a wall");
    // A rise of one level is five feet, as high as 3 + 2 clears; two levels is not.
    const low = walk(definition, fight(definition, { elevation: { 4: 1 } }), 2);
    assert.deepEqual(landings(definition, low), [4, 5], "a level cleared");
    const high = walk(definition, fight(definition, { elevation: { 4: 2 } }), 2);
    assert.deepEqual(landings(definition, high), [], "two levels not");
  }

  // ── Jump triples it; Remarkable Athlete adds the Strength modifier to a running long jump ──
  {
    const tripled = fight(definition);
    rulesetCombatant(tripled, "leaper")!.tracked.push({ condition: "jump", rounds: 10, source: "leaper" });
    assert.equal(rulesetJumpReach(definition, tripled, rulesetCombatant(tripled, "leaper")!)!.long, 4, "22 feet");
    assert.equal(Math.max(...jumpOption(definition, tripled)!.cells!.map((cell) => cell.x)), 4);
    const strong = fight(definition, { str: 18 });
    rulesetCombatant(strong, "leaper")!.tracked.push({ condition: "athlete", rounds: null, source: "leaper" });
    assert.equal(rulesetJumpReach(definition, strong, rulesetCombatant(strong, "leaper")!)!.long, 1, "standing");
    const running = walk(definition, strong, 2);
    const reach = rulesetJumpReach(definition, running, rulesetCombatant(running, "leaper")!)!;
    assert.equal(reach.long, 4, "18 + 4 feet");
    assert.equal(reach.high, 1, "the high jump is not added to");
  }

  // ── Landing in the woods: DC 10 Acrobatics, or prone ──
  {
    const woods = () => walk(definition, fight(definition, { tiles: { 5: "forest" } }), 2);
    const fell = jump(definition, woods(), 5, 1);
    assert.ok(
      rulesetCombatant(fell.state, "leaper")!.tracked.some((one) => one.condition === "prone"),
      JSON.stringify(fell.events),
    );
    const kept = jump(definition, woods(), 5, 15);
    assert.ok(!rulesetCombatant(kept.state, "leaper")!.tracked.some((one) => one.condition === "prone"));
    const plain = jump(definition, walk(definition, fight(definition), 2), 5, 1);
    assert.ok(!rulesetCombatant(plain.state, "leaper")!.tracked.some((one) => one.condition === "prone"));
  }

  // ── Without the rule, nobody jumps ──
  {
    const plain = parsed(fiveE(null));
    assert.equal(jumpOption(plain, walk(plain, fight(plain), 2)), undefined);
  }

  // ── Refusals ──
  refused(fiveE({ ...rule, long: { ability: "brawn", of: "score" } }), /Unknown ability "brawn"/);
  refused(fiveE({ ...rule, hardLanding: { check: "tumble", difficulty: 10, applies: "prone" } }), /tumble/);
  refused(fiveE({ ...rule, hardLanding: { check: "agility", difficulty: 10, applies: "sprawled" } }), /sprawled/);
  refused(fiveE({ ...rule, standing: "third" }), /standing/);
  {
    const doc = fiveE();
    doc.combat.conditions.find((one: { condition: string }) => one.condition === "jump").jumps = {};
    refused(doc, /times or plus/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose combatants jump (combat jumping, a condition's jumps) requires schemaVersion 2 and capabilityApi 1.499 or newer";
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
    const only = JSON.parse(fiveEText) as Record<string, any>;
    only.combat.jumping = rule;
    assert.equal(getCapabilityPackageInstallIssue(manifest(498) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(499) as never, only), gate);
    const keyOnly = JSON.parse(fiveEText) as Record<string, any>;
    keyOnly.combat.conditions[0].jumps = { times: 2 };
    assert.equal(getCapabilityPackageInstallIssue(manifest(498) as never, keyOnly), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(498) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Jumping: Strength in feet after a run-up, half standing, over water and friends but not walls or foes, Jump triples it, a hard landing knocks prone on a failed check; gated at 1.499.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
