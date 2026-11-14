/**
 * The showcase bosses' asks (Capability API 1.320).
 *
 *   - An aura that `grows` as its holder's turns start, to its most: The Owed's Frost Debt, 20 feet
 *     growing by 10 to 40; that `harms` as each turn of whoever it reaches starts (`on`); and whose
 *     conditions `lingers` until that one's next turn starts once it no longer reaches them.
 *   - `heldAtMost` on what an action puts on: The Owed's Grasps hold two at most.
 *   - A creature's `hangsOn`: left at 1 instead of dropping, with a turn of its own straight after,
 *     the Miller's Hourglass; the order is as it was once that turn is over.
 *   - `shakeOff.self`: the held tears free with an action and no check, the Seed Hopper.
 *   - Refused shapes, and the install gate.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetAuraDistance,
  rulesetCreatureBlock,
  rulesetSyncAuras,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  rulesetCombatHealth,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-boss-asks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 320);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const frostDebt = {
    distance: 20,
    side: "enemies",
    conditions: ["no_heal"],
    grows: { by: 10, upTo: 40 },
    lingers: true,
    harms: { dice: "2d6", type: "cold", on: "their-turn" },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    for (const [id, label] of [
      ["frost_debt", "Frost Debt"],
      ["no_heal", "No Healing"],
      ["hopper_held", "Held by the Seed Hopper"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      { condition: "frost_debt", effects: [], auras: [structuredClone(frostDebt)] },
      { condition: "no_heal", effects: [] },
      { condition: "hopper_held", effects: [], shakeOff: { budget: "action", self: true } },
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
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const fighter = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  type Spot = { x: number; y: number };
  const fight = (
    foe: Partial<RulesetStatBlock>,
    at: { bard: Spot; ally: Spot; cat: Spot; foe: Spot },
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build, live: {} },
        { id: "ally", name: "Ally", side: "party", build, live: {} },
        { id: "cat", name: "Cat", side: "party", build: fighter, live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block(foe) },
      ],
      board: {
        grid: { width: 24, height: 15, tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")) },
        placements: at,
      },
    });
    state.order = ["bard", "ally", "cat", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    state.turn =
      state.order.indexOf(choice.actorId) >= 0 && state.order[state.turn] !== choice.actorId
        ? state.order.indexOf(choice.actorId)
        : state.turn;
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const dagger = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "cat").find((one) => one.label === "Dagger")!.id;
  const pass = (state: RulesetEncounterState, id: string) =>
    act(state, { actorId: id, optionId: "end-turn", targetIds: [] });

  // ── Frost Debt: grows, harms on their own turns, and its no-healing lingers ──
  {
    // The ally 20 feet off, the bard 35, the cat 60.
    const state = fight({}, { bard: { x: 3, y: 7 }, ally: { x: 6, y: 7 }, cat: { x: 22, y: 7 }, foe: { x: 10, y: 7 } });
    who(state, "foe").tracked.push({ condition: "frost_debt", rounds: null, kept: true });
    // As the ally's turn starts: 2d6 cold, from the foe. Nothing as the cat's starts.
    let step = pass(state, "bard");
    assert.deepEqual(
      of(step.events, "damage").map((one) => [one.targetId, one.amount, one.damageType, one.sourceId]),
      [["ally", 6, "cold", "foe"]],
    );
    assert.ok(has(step.state, "ally", "no_heal"));
    assert.ok(!has(step.state, "bard", "no_heal"));
    step = pass(step.state, "ally");
    assert.deepEqual(of(step.events, "damage"), [], "nobody else in reach as the cat's turn starts");
    // As the foe's own turn starts it grows to 30 feet, and reaches the bard 35 feet off no more than
    // before; a turn later it reaches 40 and goes no further.
    step = pass(step.state, "cat");
    assert.deepEqual(
      of(step.events, "auraGrows").map((one) => [one.actorId, one.condition, one.distance]),
      [["foe", "frost_debt", 30]],
    );
    assert.ok(!has(step.state, "bard", "no_heal"));
    who(step.state, "foe").auraGrown = { frost_debt: 2 };
    step.state.turn = 2;
    const most = pass(step.state, "cat");
    assert.deepEqual(of(most.events, "auraGrows"), [], "40 feet is its most");
    assert.ok(has(most.state, "bard", "no_heal"), "35 feet is within 40");
    // Growing by more than is left, it stops at its most.
    assert.equal(
      rulesetAuraDistance(
        { auraGrown: { frost_debt: 2 } } as never,
        { ...frostDebt, grows: { by: 15, upTo: 40 } } as never,
        "frost_debt",
      ),
      40,
    );
    // The ally walks away (put down 60 feet off): the no-healing stays until their next turn starts.
    const lingering = pass(step.state, "cat");
    who(lingering.state, "foe").auraGrown = { frost_debt: 0 };
    who(lingering.state, "ally").x = 22;
    who(lingering.state, "ally").y = 1;
    const away = pass(lingering.state, "foe");
    const left = who(away.state, "ally").tracked.find((entry) => entry.condition === "no_heal");
    assert.ok(left?.lingering, JSON.stringify(who(away.state, "ally").tracked));
    assert.equal(left?.aura, undefined);
    const theirTurn = pass(away.state, "bard");
    assert.ok(!has(theirTurn.state, "ally", "no_heal"), "off as their next turn starts");
    assert.deepEqual(of(theirTurn.events, "damage"), [], "out of its reach, no cold either");
    // Back within reach while it lingers, the aura holds it again.
    const back = pass(lingering.state, "foe");
    who(back.state, "ally").x = 6;
    who(back.state, "ally").y = 7;
    const held = pass(back.state, "bard");
    const again = who(held.state, "ally").tracked.find((entry) => entry.condition === "no_heal");
    assert.equal(again?.aura, "foe");
    assert.equal(again?.lingering, undefined);
    // Mid-turn too, before their own turn would have taken it off: the lingering entry is the aura's again.
    const midway = structuredClone(back.state);
    who(midway, "ally").x = 6;
    who(midway, "ally").y = 7;
    assert.ok(who(midway, "ally").tracked.find((entry) => entry.condition === "no_heal")?.lingering);
    rulesetSyncAuras(definition, midway);
    const reclaimed = who(midway, "ally").tracked.filter((entry) => entry.condition === "no_heal");
    assert.equal(reclaimed.length, 1);
    assert.equal(reclaimed[0]?.aura, "foe");
    assert.equal(reclaimed[0]?.lingering, undefined);
  }

  // ── The Owed's Grasps hold two at most ──
  {
    const grasp = {
      id: "grasp",
      name: "Grasp",
      budget: "action",
      toHit: 10,
      damage: { count: 1, sides: 4, flat: 0 },
      applies: [{ condition: "grappled", duration: "instant", heldAtMost: 2 }],
    };
    const state = fight(
      { actions: [grasp] as never },
      { bard: { x: 9, y: 7 }, ally: { x: 11, y: 7 }, cat: { x: 10, y: 8 }, foe: { x: 10, y: 7 } },
    );
    state.turn = 3;
    let step = act(state, { actorId: "foe", optionId: "grasp", targetIds: ["bard"] });
    who(step.state, "foe").budgets.action = 1;
    step = act(step.state, { actorId: "foe", optionId: "grasp", targetIds: ["ally"] });
    who(step.state, "foe").budgets.action = 1;
    step = act(step.state, { actorId: "foe", optionId: "grasp", targetIds: ["cat"] });
    assert.ok(has(step.state, "bard", "grappled") && has(step.state, "ally", "grappled"));
    assert.ok(!has(step.state, "cat", "grappled"), "a third is not held");
    assert.deepEqual(
      of(step.events, "condition")
        .filter((one) => one.targetId === "cat")
        .map((one) => one.reason),
      ["full"],
    );
    // One let go, the next is held.
    who(step.state, "bard").tracked = who(step.state, "bard").tracked.filter((entry) => entry.condition !== "grappled");
    who(step.state, "foe").budgets.action = 1;
    step = act(step.state, { actorId: "foe", optionId: "grasp", targetIds: ["cat"] });
    assert.ok(has(step.state, "cat", "grappled"));
    // Holding one already, it is held again, not refused.
    who(step.state, "foe").budgets.action = 1;
    step = act(step.state, { actorId: "foe", optionId: "grasp", targetIds: ["cat"] });
    assert.ok(has(step.state, "cat", "grappled"));
    assert.deepEqual(
      of(step.events, "condition")
        .filter((one) => one.reason === "full")
        .map((one) => one.targetId),
      [],
    );
    // One of the two held falls: they no longer count, so the bard is held again.
    who(step.state, "ally").defeated = true;
    who(step.state, "foe").budgets.action = 1;
    step = act(step.state, { actorId: "foe", optionId: "grasp", targetIds: ["bard"] });
    assert.ok(
      who(step.state, "bard").tracked.some((entry) => entry.condition === "grappled" && entry.source === "foe"),
      "the fallen one's hold does not count",
    );
    assert.deepEqual(
      of(step.events, "condition").map((one) => one.reason),
      ["applied"],
    );
  }

  // ── The Hourglass: at 1 instead, and a turn straight after ──
  {
    const state = fight(
      { health: 3, hangsOn: { uses: 1, extraTurn: true, label: "Hourglass" } },
      { bard: { x: 2, y: 2 }, ally: { x: 2, y: 4 }, cat: { x: 9, y: 7 }, foe: { x: 10, y: 7 } },
    );
    state.order = ["cat", "bard", "foe", "ally"];
    state.turn = 0;
    const struck = act(state, { actorId: "cat", optionId: dagger(state), targetIds: ["foe"] });
    assert.deepEqual(of(struck.events, "hangsOn"), [{ type: "hangsOn", actorId: "foe", label: "Hourglass", left: 0 }]);
    assert.equal(who(struck.state, "foe").health?.value, 1);
    assert.ok(!who(struck.state, "foe").down && !who(struck.state, "foe").defeated);
    assert.deepEqual(struck.state.order, ["cat", "foe", "bard", "foe", "ally"]);
    assert.equal(of(struck.events, "extraTurn")[0]?.label, "Hourglass");
    // The cat's turn ends: the foe's own turn now, then the bard's, and the order is as it was.
    const extra = pass(struck.state, "cat");
    assert.equal(extra.state.order[extra.state.turn], "foe");
    const after = applyRulesetCombatChoice(
      definition,
      extra.state,
      { actorId: "foe", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.deepEqual(after.state.order, ["cat", "bard", "foe", "ally"]);
    assert.equal(after.state.order[after.state.turn], "bard");
    assert.equal(after.state.interjected, undefined);
    // Once only: the next blow takes it out.
    who(after.state, "cat").budgets.action = 1;
    after.state.turn = 0;
    const again = act(after.state, { actorId: "cat", optionId: dagger(after.state), targetIds: ["foe"] });
    assert.deepEqual(of(again.events, "hangsOn"), []);
    assert.ok(who(again.state, "foe").defeated);
    // Read off a bestiary creature as its block.
    const hourDef = parsed(
      document((doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        creatures.entries[0].creature.hangsOn = { uses: 1, extraTurn: true };
      }),
    );
    const entry = hourDef.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries![0]!;
    assert.deepEqual(rulesetCreatureBlock(hourDef, entry)?.hangsOn, { uses: 1, extraTurn: true });
    // Without extraTurn, at 1 and nothing more.
    const plain = fight(
      { health: 3, hangsOn: { uses: 2 } },
      { bard: { x: 2, y: 2 }, ally: { x: 2, y: 4 }, cat: { x: 9, y: 7 }, foe: { x: 10, y: 7 } },
    );
    plain.turn = 2;
    const hit = act(plain, { actorId: "cat", optionId: dagger(plain), targetIds: ["foe"] });
    assert.deepEqual(of(hit.events, "hangsOn")[0]?.left, 1);
    assert.deepEqual(hit.state.order, ["bard", "ally", "cat", "foe"]);
    // A creature that fights with a sheet hangs on in its hit point pool, as 5e-2014's do.
    const sheeted = fight(
      { health: 3, hangsOn: { uses: 1, label: "Hourglass" } },
      { bard: { x: 2, y: 2 }, ally: { x: 2, y: 4 }, cat: { x: 9, y: 7 }, foe: { x: 10, y: 7 } },
    );
    const foe = who(sheeted, "foe");
    foe.sheet = structuredClone(who(sheeted, "ally").sheet);
    delete foe.health;
    const hp = (state: RulesetEncounterState) =>
      rulesetCombatHealth(definition, definition.combat!, who(state, "foe")).value;
    const full = hp(sheeted);
    const pool = (definition.combat!.health as { pool: string }).pool;
    foe.sheet!.live = { ...foe.sheet!.live, pools: { ...foe.sheet!.live.pools, [pool]: { value: 1 } } };
    assert.equal(hp(sheeted), 1);
    sheeted.order = ["cat", "bard", "foe", "ally"];
    sheeted.turn = 0;
    const struckSheet = act(sheeted, { actorId: "cat", optionId: dagger(sheeted), targetIds: ["foe"] });
    const worn = struckSheet.state;
    assert.ok(full > 1);
    assert.equal(of(struckSheet.events, "hangsOn")[0]?.label, "Hourglass");
    assert.ok(!who(worn, "foe").defeated, "hung on, never defeated");
    assert.equal(hp(worn), 1, "the sheet's hit points at 1");
    assert.ok(!who(worn, "foe").down);
    // What slays outright is not hung on through.
    const slain = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "cat", name: "Cat", side: "party", build: fighter, live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block({ health: 30, hangsOn: { uses: 1, extraTurn: true } }) },
        {
          id: "reaper",
          name: "Reaper",
          side: "enemy",
          block: block({
            actions: [
              {
                id: "reap",
                name: "Reap",
                budget: "action",
                reach: 5,
                autoHit: true,
                save: { save: "con_save", difficulty: 30, onSuccess: "negates" },
                slaysOnFailedSave: true,
              },
            ] as never,
          }),
        },
      ],
      board: {
        grid: { width: 24, height: 15, tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")) },
        placements: { cat: { x: 2, y: 2 }, foe: { x: 10, y: 7 }, reaper: { x: 11, y: 7 } },
      },
    });
    // Turned against its own (as a charm would): the reaper fights for the party now.
    who(slain, "reaper").side = "party";
    slain.order = ["reaper", "cat", "foe"];
    slain.turn = 0;
    const reaped = act(slain, { actorId: "reaper", optionId: "reap", targetIds: ["foe"] });
    assert.deepEqual(
      of(reaped.events, "slain").map((one) => one.targetId),
      ["foe"],
    );
    assert.deepEqual(of(reaped.events, "hangsOn"), []);
    assert.ok(who(reaped.state, "foe").defeated);
    assert.deepEqual(reaped.state.order, ["reaper", "cat", "foe"]);
  }

  // ── The Seed Hopper: torn free with an action, no check, by the held or an ally ──
  {
    const state = fight({}, { bard: { x: 5, y: 7 }, ally: { x: 6, y: 7 }, cat: { x: 20, y: 7 }, foe: { x: 12, y: 7 } });
    who(state, "bard").tracked.push({ condition: "hopper_held", rounds: null, source: "foe" });
    const own = rulesetCombatOptions(definition, state, "bard").find((one) => one.id === "shake:hopper_held@bard");
    assert.equal(own?.label, "Tear free of Held by the Seed Hopper");
    const torn = act(state, { actorId: "bard", optionId: own!.id, targetIds: [] });
    assert.ok(!has(torn.state, "bard", "hopper_held"));
    assert.equal(of(torn.events, "check").length, 0, "no check");
    // An ally beside them may too, as before.
    const helped = fight(
      {},
      { bard: { x: 5, y: 7 }, ally: { x: 6, y: 7 }, cat: { x: 20, y: 7 }, foe: { x: 12, y: 7 } },
    );
    who(helped, "bard").tracked.push({ condition: "hopper_held", rounds: null, source: "foe" });
    helped.turn = 1;
    assert.ok(rulesetCombatOptions(definition, helped, "ally").some((one) => one.id === "shake:hopper_held@bard"));
    // Without `self`, the held has no such option.
    const plainDef = parsed(
      document((doc) => {
        doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "hopper_held").shakeOff = {
          budget: "action",
        };
      }),
    );
    const plain = createRulesetEncounter({
      definition: plainDef,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build, live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    who(plain, "bard").tracked.push({ condition: "hopper_held", rounds: null, source: "foe" });
    plain.turn = plain.order.indexOf("bard");
    assert.ok(!rulesetCombatOptions(plainDef, plain, "bard").some((one) => one.id.startsWith("shake:")));
  }

  // ── Refused shapes ──
  refused(
    document((doc) => {
      doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "frost_debt").auras[0].grows = {
        by: 10,
        upTo: 20,
      };
    }),
    /An aura grows to more than its distance/,
  );
  refused(
    document((doc) => {
      const aura = doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "frost_debt")
        .auras[0];
      delete aura.conditions;
    }),
    /Only what an aura spreads lingers/,
  );

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
      "A ruleset with an aura that grows, lingers or harms on its targets' turns, a hold with a most, tearing free or hanging on requires schemaVersion 2 and capabilityApi 1.320 or newer";
    const only = (edit: (doc: Record<string, any>) => void) => {
      const doc = JSON.parse(fiveEText);
      doc.sheet.live.conditions.push({ id: "x", label: "X" }, { id: "y", label: "Y" });
      edit(doc);
      return doc;
    };
    const cases: Array<[string, Record<string, any>]> = [
      [
        "grows",
        only((doc) =>
          doc.combat.conditions.push({
            condition: "x",
            effects: [],
            auras: [{ distance: 10, side: "all", conditions: ["y"], grows: { by: 5, upTo: 20 } }],
          }),
        ),
      ],
      [
        "lingers",
        only((doc) =>
          doc.combat.conditions.push({
            condition: "x",
            effects: [],
            auras: [{ distance: 10, side: "all", conditions: ["y"], lingers: true }],
          }),
        ),
      ],
      [
        "their-turn",
        only((doc) =>
          doc.combat.conditions.push({
            condition: "x",
            effects: [],
            auras: [{ distance: 10, side: "all", harms: { flat: 1, on: "their-turn" } }],
          }),
        ),
      ],
      [
        "self",
        only((doc) =>
          doc.combat.conditions.push({ condition: "x", effects: [], shakeOff: { budget: "action", self: true } }),
        ),
      ],
      [
        "hangsOn",
        only((doc) => {
          const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
          creatures.entries[0].creature.hangsOn = { uses: 1 };
        }),
      ],
      [
        "heldAtMost",
        only((doc) => {
          const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
          const action = creatures.entries
            .flatMap((entry: any) => entry.creature.actions)
            .find((one: any) => one.applies);
          action.applies[0].heldAtMost = 2;
        }),
      ],
    ];
    for (const [name, doc] of cases) {
      parsed(doc);
      assert.equal(getCapabilityPackageInstallIssue(manifest(319) as never, doc), gate, name);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(320) as never, doc), gate, name);
    }
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(319) as never, JSON.parse(fiveEText)),
      gate,
      "the plain 5e example",
    );
  }

  console.log(
    "Boss asks: Frost Debt grows, harms on its targets' turns and lingers; Grasps hold two at most; the Hourglass hangs on at 1 with a turn after; the Seed Hopper is torn free without a check.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
