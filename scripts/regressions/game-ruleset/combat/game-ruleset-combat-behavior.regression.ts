/**
 * Forced behavior (Capability API 1.264).
 *
 *   - `behavior.only` and `moves: "away"`: 5e's Turn Undead. The turned creature walks only away
 *     from the cleric, may only Dash or break free, and Dodges only with nowhere to go; the
 *     director walks it as far off as it can.
 *   - `moves: "toward"`: Command's "approach", which stops once beside the caster; `only: []`:
 *     "halt".
 *   - `table`: Confusion's d10, rolled as the turn starts: wander, nothing, a strike at a random
 *     creature in reach (an ally too), or a normal turn; the `compelled` event.
 *   - `saveEnds.at: "action"`: Irresistible Dance, a save its holder spends their action on.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-behavior-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetClosingMove } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 259);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const conditionsOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    for (const [id, label] of [
      ["turned", "Turned"],
      ["approach", "Commanded: Approach"],
      ["halt", "Commanded: Halt"],
      ["confused", "Confused"],
      ["dancing", "Dancing"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "turned",
        effects: ["cannot-react"],
        behavior: { only: ["move", "dash", "escape"], onlyWhenStuck: ["dodge"], moves: "away" },
      },
      { condition: "approach", effects: [], behavior: { only: ["move"], moves: "toward" } },
      { condition: "halt", effects: [], behavior: { only: [] } },
      {
        condition: "confused",
        effects: ["cannot-react"],
        behavior: {
          table: {
            dice: "1d10",
            rows: [
              { atMost: 1, does: "wander" },
              { atMost: 6, does: "nothing" },
              { atMost: 8, does: "strike" },
              { atMost: 10, does: "normal" },
            ],
          },
        },
      },
      { condition: "dancing", effects: ["speed-zero"] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40 },
  });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: 0 },
    actions: [
      { name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } },
      { name: "Spit", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 }, range: { normal: 30 } },
      {
        name: "Dagger",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 4, flat: 0 },
        reach: 5,
        range: { normal: 20 },
      },
    ],
    ...extra,
  });
  // Faces by die size, then 10 for anything left.
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? 10;
  const fight = (
    at: { cleric: number; foe: number; other?: number },
    grid?: { tiles: string[][]; cleric: { x: number; y: number }; foe: { x: number; y: number } },
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "cleric", name: "Cleric", side: "party", build, live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
        ...(at.other !== undefined ? [{ id: "other", name: "Other", side: "enemy" as const, block: block() }] : []),
      ],
      board: grid
        ? {
            grid: {
              width: grid.tiles[0]!.length,
              height: grid.tiles.length,
              tiles: grid.tiles,
              elevation: grid.tiles.map((row) => row.map(() => 0)),
            },
            placements: { cleric: grid.cleric, foe: grid.foe },
          }
        : {
            grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")], elevation: [Array(12).fill(0)] },
            placements: {
              cleric: { x: at.cleric, y: 0 },
              foe: { x: at.foe, y: 0 },
              ...(at.other !== undefined ? { other: { x: at.other, y: 0 } } : {}),
            },
          },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    applyRulesetCombatChoice(definition, state, choice, roll);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = step(state, choice);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const refusedAs = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    of(step(state, choice).events, "refused")[0]?.reason;
  const menu = (state: RulesetEncounterState, id: string) => rulesetCombatOptions(definition, state, id);
  const ids = (state: RulesetEncounterState, id: string) => menu(state, id).map((option) => option.id);
  /** The foe's turn, begun from the cleric's. */
  const foeTurn = (state: RulesetEncounterState) =>
    act(state, { actorId: "cleric", optionId: "end-turn", targetIds: [] });
  const cellsOf = (state: RulesetEncounterState, id: string) =>
    menu(state, id)
      .find((option) => option.id === RULESET_MOVE_OPTION)
      ?.cells?.map((cell) => cell.x) ?? [];

  // ── Turned: away from the cleric, Dash or break free only, Dodge only when cornered ──
  {
    const state = fight({ cleric: 2, foe: 5 });
    who(state, "foe").tracked.push({ condition: "turned", rounds: null, source: "cleric" });
    state.turn = 1;
    assert.deepEqual(ids(state, "foe").sort(), [RULESET_MOVE_OPTION, "end-turn", "standard:dash"].sort());
    const cells = cellsOf(state, "foe");
    assert.ok(cells.length > 0 && cells.every((x) => x > 5), `only further off: ${cells}`);
    assert.equal(
      refusedAs(state, { actorId: "foe", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 0 } }),
      "unreachable",
    );
    assert.equal(refusedAs(state, { actorId: "foe", optionId: "block:0", targetIds: ["cleric"] }), "compelled");
    assert.equal(refusedAs(state, { actorId: "foe", optionId: "standard:dodge", targetIds: [] }), "compelled");
    // The director walks it as far as it goes.
    assert.deepEqual(rulesetClosingMove(definition, state, "foe")?.to, { x: 11, y: 0 });
    // Cornered, it may Dodge, and still not strike.
    const cornered = fight({ cleric: 9, foe: 11 });
    who(cornered, "foe").tracked.push({ condition: "turned", rounds: null, source: "cleric" });
    cornered.turn = 1;
    assert.deepEqual(ids(cornered, "foe").sort(), ["end-turn", "standard:dash", "standard:dodge"].sort());
    // On open ground, only somewhere further off than it began, never as far as it was.
    const open = fight(
      { cleric: 0, foe: 0 },
      { tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")), cleric: { x: 0, y: 0 }, foe: { x: 3, y: 0 } },
    );
    who(open, "foe").tracked.push({ condition: "turned", rounds: null, source: "cleric" });
    open.turn = 1;
    const spots = menu(open, "foe").find((option) => option.id === RULESET_MOVE_OPTION)!.cells!;
    assert.ok(spots.length > 0 && spots.every((cell) => Math.max(cell.x, cell.y) > 3), JSON.stringify(spots));
    // Hemmed in so that the only way out goes nearer first: it does not go, and Dodges.
    const P = "plains";
    const W = "water";
    const pen = fight(
      { cleric: 0, foe: 0 },
      {
        tiles: [
          [P, P, P, P, W, P, P, P],
          [P, P, P, W, W, P, P, P],
          [P, P, P, P, P, P, P, P],
        ],
        cleric: { x: 0, y: 0 },
        foe: { x: 3, y: 0 },
      },
    );
    who(pen, "foe").tracked.push({ condition: "turned", rounds: null, source: "cleric" });
    pen.turn = 1;
    assert.deepEqual(ids(pen, "foe").sort(), ["end-turn", "standard:dash", "standard:dodge"].sort());
    // Its source gone, it walks as it likes, but still only Dashes.
    const free = fight({ cleric: 2, foe: 5 });
    who(free, "foe").tracked.push({ condition: "turned", rounds: null, source: "cleric" });
    who(free, "cleric").defeated = true;
    free.turn = 1;
    assert.ok(cellsOf(free, "foe").includes(3));
    assert.equal(ids(free, "foe").includes("block:0"), false);
  }

  // ── Command: approach stops beside the caster; halt does nothing ──
  {
    const state = fight({ cleric: 2, foe: 6 });
    who(state, "foe").tracked.push({ condition: "approach", rounds: 1, source: "cleric" });
    state.turn = 1;
    assert.deepEqual(cellsOf(state, "foe").sort(), [3, 4, 5]);
    assert.equal(ids(state, "foe").includes("block:0"), false);
    assert.deepEqual(rulesetClosingMove(definition, state, "foe")?.to, { x: 3, y: 0 });
    const beside = act(state, { actorId: "foe", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 3, y: 0 } });
    assert.deepEqual(ids(beside.state, "foe"), ["end-turn"]);
    const halted = fight({ cleric: 2, foe: 3 });
    who(halted, "foe").tracked.push({ condition: "halt", rounds: 1, source: "cleric" });
    halted.turn = 1;
    assert.deepEqual(ids(halted, "foe"), ["end-turn"]);
  }

  // ── Confusion's d10, as the turn starts ──
  {
    const confused = (
      at: { cleric: number; foe: number; other?: number },
      d10: number,
      extra: Record<number, number[]> = {},
    ) => {
      const state = fight(at);
      who(state, "foe").tracked.push({ condition: "confused", rounds: 10, source: "cleric" });
      faces = { 10: [d10], ...extra };
      const begun = foeTurn(state);
      faces = {};
      return begun;
    };
    // 2-6: nothing at all.
    const still = confused({ cleric: 2, foe: 3 }, 4);
    assert.deepEqual(
      of(still.events, "compelled").map((one) => [one.actorId, one.condition, one.roll, one.does]),
      [["foe", "confused", 4, "nothing"]],
    );
    assert.deepEqual(ids(still.state, "foe"), ["end-turn"]);
    assert.equal(refusedAs(still.state, { actorId: "foe", optionId: "block:0", targetIds: ["cleric"] }), "compelled");
    // 9-10: a normal turn.
    const normal = confused({ cleric: 2, foe: 3 }, 9);
    assert.equal(of(normal.events, "compelled")[0]!.does, "normal");
    assert.ok(ids(normal.state, "foe").includes("block:0"));
    // 7-8: a strike at whoever the dice pick in reach, an ally as much as a foe.
    const lash = confused({ cleric: 2, foe: 5, other: 6 }, 7);
    const strike = of(lash.events, "compelled")[0]!;
    assert.deepEqual([strike.does, strike.targetId], ["strike", "other"]);
    assert.deepEqual(
      ids(lash.state, "foe"),
      ["block:0", "block:2", "end-turn"],
      "a melee strike, no spitting or walking",
    );
    const swung = act(lash.state, { actorId: "foe", optionId: "block:0", targetIds: ["other"] });
    assert.ok(of(swung.events, "attack").some((one) => one.targetId === "other"));
    // Two in reach: the dice pick, in id order.
    const both = confused({ cleric: 4, foe: 5, other: 6 }, 8, { 2: [1] });
    assert.equal(of(both.events, "compelled")[0]!.targetId, "cleric");
    const both2 = confused({ cleric: 4, foe: 5, other: 6 }, 8, { 2: [2] });
    assert.equal(of(both2.events, "compelled")[0]!.targetId, "other");
    assert.equal(refusedAs(both2.state, { actorId: "foe", optionId: "block:0", targetIds: ["cleric"] }), "bad-target");
    // Nobody in reach: nothing.
    const alone = confused({ cleric: 0, foe: 6 }, 7);
    assert.deepEqual(
      of(alone.events, "compelled").map((one) => [one.does, one.targetId]),
      [["nothing", undefined]],
    );
    assert.deepEqual(ids(alone.state, "foe"), ["end-turn"]);
    // 1: wanders all its speed one way a d8 picks, here west, stopped by the cleric in the way.
    const west = confused({ cleric: 2, foe: 8 }, 1, { 8: [7] });
    assert.equal(of(west.events, "compelled")[0]!.does, "wander");
    assert.equal(who(west.state, "foe").x, 3);
    assert.deepEqual(ids(west.state, "foe"), ["end-turn"]);
    // East, as far as its speed allows, past a friend in the way.
    const east = confused({ cleric: 0, foe: 2, other: 4 }, 1, { 8: [3] });
    assert.equal(who(east.state, "foe").x, 8);
    // Somebody only its spit or a thrown dagger reaches is not in reach.
    assert.equal(of(confused({ cleric: 2, foe: 5 }, 7).events, "compelled")[0]!.does, "nothing");
    // Unable to act, it rolls nothing.
    const out = fight({ cleric: 2, foe: 3 });
    who(out, "foe").tracked.push({ condition: "confused", rounds: 10 }, { condition: "incapacitated", rounds: 10 });
    assert.deepEqual(of(foeTurn(out).events, "compelled"), []);
  }

  // ── Irresistible Dance: a save spent an action on ──
  {
    const state = fight({ cleric: 2, foe: 6 });
    who(state, "cleric").tracked.push({
      condition: "dancing",
      rounds: 10,
      source: "foe",
      difficulty: 15,
      saveEnds: { save: "wis_save", at: "action" },
    });
    const option = menu(state, "cleric").find((one) => one.id === "resave:dancing");
    assert.ok(option, ids(state, "cleric").join(", "));
    assert.equal(option.label, "Try to end Dancing");
    faces = { 20: [2] };
    const failed = act(state, { actorId: "cleric", optionId: "resave:dancing", targetIds: [] });
    assert.ok(has(failed.state, "cleric", "dancing"));
    assert.equal(ids(failed.state, "cleric").includes("resave:dancing"), false, "the action is spent");
    faces = { 20: [15] };
    const passed = act(state, { actorId: "cleric", optionId: "resave:dancing", targetIds: [] });
    assert.equal(has(passed.state, "cleric", "dancing"), false);
    assert.ok(of(passed.events, "condition").some((one) => one.condition === "dancing" && one.reason === "save"));
    faces = {};
    // Never rolled as a turn ends.
    const ended = act(state, { actorId: "cleric", optionId: "end-turn", targetIds: [] });
    assert.ok(has(ended.state, "cleric", "dancing"));
  }

  // ── Import ──
  {
    refused(
      document((doc) => (conditionsOf(doc, "turned").behavior.only = ["move", "sprint"])),
      /only/,
    );
    refused(
      document((doc) => {
        doc.combat.standard = ["dodge"];
      }),
      /This ruleset has no standard action "dash"/,
    );
    refused(
      document((doc) => delete conditionsOf(doc, "turned").behavior.only),
      /"onlyWhenStuck" goes with "only" naming "move"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "confused").behavior.table.rows[2].atMost = 5)),
      /Rows run strictly up/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "halt").behavior = {})),
      /A behavior says at least one thing/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "confused").behavior.table.rows[0].does = "dance")),
      /does/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "approach").behavior.moves = "around")),
      /moves/,
    );
  }

  // ── The install gate ──
  {
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
    const gate =
      "A ruleset with a condition that decides its holder's turn, or a save spent an action on, requires schemaVersion 2 and capabilityApi 1.264 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const behaving = document();
    assert.equal(issue(263, behaving), gate);
    assert.notEqual(issue(264, behaving), gate);
    const dance = {
      ...without,
      extra: { dance: { applies: [{ condition: "x", saveEnds: { save: "wis_save", at: "action" } }] } },
    };
    assert.equal(issue(263, dance), gate);
    assert.notEqual(issue(264, dance), gate);
    assert.notEqual(issue(263, without), gate);
    assert.equal(
      issue(263, without, new Map([["spells.json", { entries: [{ mechanics: dance.extra.dance }] }]])),
      gate,
    );
  }

  console.log(
    "Ruleset forced behavior: Turn Undead flees and only dashes, Command approaches or halts, Confusion's d10 wanders, freezes or lashes out at whoever is near, Irresistible Dance is a save spent an action on; gated at 1.264.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
