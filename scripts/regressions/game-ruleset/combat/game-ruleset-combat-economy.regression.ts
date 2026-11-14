/**
 * Ruleset combat, combat C6d: conditions that change the action economy, as Haste and Slow do.
 *
 *   - `budgets`: a turn's count of a budget, more or fewer, from the first turn on; a budget may be
 *     declared with a count of 0, for one only a condition fills.
 *   - `grants`: what that budget may be spent on: the standard actions named, one weapon attack of a
 *     single strike (Extra Attack's strikes are not given), an item's use.
 *   - `exclusive`: of two budgets a turn spends only one; spending either empties the other.
 *   - `attacksPerTurn`: no attack past the cap, whatever strikes an action would give.
 *   - `onEnd`: what a condition leaves behind when it ends for good, as Haste's lethargy is.
 *   - The 1.76 gate is the install gate's (combat-cover pins its neighbours); the schema refuses
 *     budgets and conditions the ruleset does not declare.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const fiveEText = read("../../../../docs/development/ruleset-5e-2014.example.json");
const variant = (edit: (doc: Record<string, any>) => void) => {
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  edit(doc);
  return doc;
};
const parsedOrThrow = (document: unknown): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const refusal = (document: unknown): string => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(!parsed.ok, "this document was supposed to be refused");
  return parsed.issues.join("; ");
};

/** The 5e example with a haste budget of no count, and three conditions: quickened (Haste), sluggish
 *  (Slow) and drained (the lethargy Haste leaves). */
const withEconomy = (doc: Record<string, any>) => {
  doc.combat.economy.budgets.push({ id: "haste", label: "Haste action", per: "turn", count: 0 });
  for (const [id, label] of [
    ["quickened", "Quickened"],
    ["sluggish", "Sluggish"],
    ["drained", "Drained"],
  ])
    doc.sheet.live.conditions.push({ id, label });
  doc.combat.conditions.push(
    {
      condition: "quickened",
      budgets: [{ budget: "haste", flat: 1 }],
      grants: { budget: "haste", standard: ["dash", "disengage", "hide"], attacks: true },
      onEnd: { applies: [{ condition: "drained", duration: { rounds: 1 } }] },
    },
    { condition: "sluggish", effects: ["cannot-react"], exclusive: ["action", "bonus"], attacksPerTurn: 1 },
    { condition: "drained", effects: ["cannot-act"] },
  );
};
const fiveE = parsedOrThrow(variant(withEconomy));

const dice = (...faces: number[]): RulesetCombatRoller => {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
};
type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
  events.filter((event): event is EventOf<T> => event.type === type);

/** Brenna attacks twice an Attack action (Extra Attack), and holds what `live` says she does. */
const brenna = (conditions: string[] = []): RulesetCombatantInput => ({
  id: "brenna",
  name: "Brenna",
  side: "party",
  build: rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    saves: { str_save: "proficient", con_save: "proficient" },
    fields: { level: 7, ac: 18, speed: 30, hp_max: 60, attacks_per_action: 2 },
    lists: {
      attacks: [
        { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
      ],
    },
  }),
  live: conditions.length ? { conditions } : {},
  catalogs: {},
});
const snag = (): RulesetCombatantInput => ({
  id: "snag",
  name: "Snag",
  side: "enemy",
  block: {
    health: 200,
    defense: 5,
    initiativeModifier: 2,
    speed: 30,
    actions: [
      { id: "scimitar", name: "Scimitar", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2 } },
    ],
  },
});
const fight = (conditions: string[]): RulesetEncounterState =>
  createRulesetEncounter({ definition: fiveE, seed: 3, combatants: [brenna(conditions), snag()], roller: dice(20, 1) });
const act = (state: RulesetEncounterState, choice: Omit<RulesetCombatChoice, "actorId">, ...faces: number[]) =>
  applyRulesetCombatChoice(fiveE, state, { actorId: "brenna", ...choice } as RulesetCombatChoice, dice(...faces));
const menu = (state: RulesetEncounterState) => rulesetCombatOptions(fiveE, state, "brenna");
const sword = (state: RulesetEncounterState) => menu(state).find((option) => option.label === "Longsword");

// ── Budgets and grants (Haste) ──
{
  const plain = fight([]);
  assert.equal(rulesetCombatant(plain, "brenna")!.budgets.haste, 0, "a budget of no count is empty");
  const hasted = fight(["quickened"]);
  assert.equal(rulesetCombatant(hasted, "brenna")!.budgets.haste, 1, "quickened fills it from the first turn");
  assert.ok(
    menu(hasted).some((option) => option.id === "standard:dash@haste"),
    "a dash on it",
  );
  assert.ok(!menu(plain).some((option) => option.id === "standard:dash@haste"), "and none without it");
  // The Attack action spends the action: two strikes, the second in hand.
  let state = hasted;
  const first = act(state, { optionId: sword(state)!.id, targetIds: ["snag"] }, 15, 4);
  state = first.state;
  assert.deepEqual(
    eventsOf(first.events, "budget").map((event) => event.budget),
    ["action"],
  );
  const second = act(state, { optionId: sword(state)!.id, targetIds: ["snag"] }, 15, 4);
  state = second.state;
  assert.deepEqual(eventsOf(second.events, "budget"), [], "the second strike is in hand");
  // With the action spent and nothing in hand, the haste action buys ONE more strike.
  const extra = sword(state)!;
  assert.equal(extra.budget, "haste");
  assert.equal(extra.oneStrike, true);
  const third = act(state, { optionId: extra.id, targetIds: ["snag"] }, 15, 4);
  state = third.state;
  assert.deepEqual(
    eventsOf(third.events, "budget").map((event) => event.budget),
    ["haste"],
  );
  assert.equal(rulesetCombatant(state, "brenna")!.strikesLeft, undefined, "no strike put in hand");
  assert.equal(sword(state), undefined, "and nothing left to attack with");
  // Next turn the haste action is back.
  state = act(state, { optionId: "end-turn", targetIds: [] }).state;
  state = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "snag", optionId: "end-turn", targetIds: [] },
    dice(),
  ).state;
  assert.equal(rulesetCombatant(state, "brenna")!.budgets.haste, 1);
}

// ── Exclusive budgets and a cap on attacks (Slow) ──
{
  let state = fight(["sluggish"]);
  const swing = act(state, { optionId: sword(state)!.id, targetIds: ["snag"] }, 15, 4);
  state = swing.state;
  assert.deepEqual(
    eventsOf(swing.events, "budget").map((event) => [event.budget, event.left]),
    [
      ["action", 0],
      ["bonus", 0],
    ],
    "the action spent empties the bonus action",
  );
  assert.equal(rulesetCombatant(state, "brenna")!.budgets.bonus, 0, "the bonus action is gone with it");
  assert.equal(sword(state), undefined, "one attack a turn, whatever Extra Attack gives");
  // Dash is still there? No: it is on the action, which is spent. Nothing on the bonus action either.
  assert.ok(!menu(state).some((option) => option.budget === "bonus"));
}

// ── A sequence stops at the cap: a slowed creature's multiattack makes one attack ──
{
  const brute = (conditions: string[]): RulesetCombatantInput => ({
    id: "brute",
    name: "Brute",
    side: "enemy",
    block: {
      health: 200,
      defense: 5,
      initiativeModifier: 20,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } },
        { id: "maul", name: "Multiattack", budget: "action", sequence: [{ action: "claw", times: 3 }] },
      ],
    },
    ...(conditions.length ? { conditions } : {}),
  });
  const mauled = (conditions: string[]) => {
    const state = createRulesetEncounter({
      definition: fiveE,
      seed: 3,
      combatants: [brenna(), brute(conditions)],
      roller: dice(1, 20),
    });
    if (conditions.length) rulesetCombatant(state, "brute")!.tracked.push({ condition: "sluggish", rounds: null });
    const step = applyRulesetCombatChoice(
      fiveE,
      state,
      { actorId: "brute", optionId: "maul", targetIds: ["brenna", "brenna", "brenna"] },
      dice(15, 3, 15, 3, 15, 3),
    );
    return eventsOf(step.events, "attack").length;
  };
  assert.equal(mauled([]), 3, "three claws");
  assert.equal(mauled(["sluggish"]), 1, "one, slowed");
}

// ── A hasted creature's extra action: one attack of its stat block at one target, after its multiattack ──
{
  let state = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [
      brenna(),
      {
        id: "brute",
        name: "Brute",
        side: "enemy",
        block: {
          health: 200,
          defense: 5,
          initiativeModifier: 20,
          speed: 30,
          actions: [
            { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } },
            {
              id: "sweep",
              name: "Sweep",
              budget: "action",
              toHit: 4,
              targetCount: 2,
              damage: { count: 1, sides: 6, flat: 0 },
            },
            { id: "maul", name: "Multiattack", budget: "action", sequence: [{ action: "claw", times: 2 }] },
          ],
        },
      },
    ],
    roller: dice(1, 20),
  });
  rulesetCombatant(state, "brute")!.tracked.push({ condition: "quickened", rounds: null });
  for (const actorId of ["brute", "brenna"]) {
    state = applyRulesetCombatChoice(fiveE, state, { actorId, optionId: "end-turn", targetIds: [] }, dice()).state;
  }
  assert.equal(rulesetCombatant(state, "brute")!.budgets.haste, 1, "its turn came round hasted");
  state = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brute", optionId: "maul", targetIds: ["brenna", "brenna"] },
    dice(15, 3, 15, 3),
  ).state;
  const options = rulesetCombatOptions(fiveE, state, "brute");
  const claw = options.find((option) => option.id === "claw");
  assert.equal(claw?.budget, "haste", "a claw on the haste action");
  assert.equal(claw?.oneStrike, true);
  assert.equal(
    options.find((option) => option.id === "sweep"),
    undefined,
    "an attack at two is not one weapon attack",
  );
  const extra = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brute", optionId: "claw", targetIds: ["brenna"] },
    dice(15, 3),
  );
  assert.equal(eventsOf(extra.events, "attack").length, 1);
  assert.deepEqual(
    eventsOf(extra.events, "budget").map((event) => event.budget),
    ["haste"],
  );
}

// ── No reactions (Slow): a foe walking away is struck at by the fighter, not by a slowed one ──
{
  const walkAway = (conditions: string[]) => {
    const state = createRulesetEncounter({
      definition: fiveE,
      seed: 3,
      combatants: [brenna(conditions), snag()],
      roller: dice(20, 1),
      board: {
        grid: { width: 8, height: 1, tiles: [Array.from({ length: 8 }, () => "plains" as const)] },
        placements: { brenna: { x: 0, y: 0 }, snag: { x: 1, y: 0 } },
      },
    });
    const turned = act(state, { optionId: "end-turn", targetIds: [] }).state;
    return applyRulesetCombatChoice(
      fiveE,
      turned,
      { actorId: "snag", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 0 } },
      dice(),
    ).state;
  };
  assert.equal(walkAway([]).window?.trigger.kind, "leaves-reach", "the fighter may strike");
  assert.equal(walkAway(["sluggish"]).window, undefined, "a slowed one may not");
}

// ── What a condition leaves behind (Haste's lethargy) ──
{
  // Quickened for one round: it ends at the end of Brenna's turn, and drained follows it.
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [brenna(), snag()],
    roller: dice(20, 1),
  });
  const holder = rulesetCombatant(state, "brenna")!;
  holder.tracked.push({ condition: "quickened", rounds: 1 });
  const ended = act(state, { optionId: "end-turn", targetIds: [] });
  const conditions = eventsOf(ended.events, "condition").map((event) => [event.condition, event.active]);
  assert.deepEqual(
    conditions,
    [
      ["quickened", false],
      ["drained", true],
    ],
    "quickened ends and leaves drained",
  );
  assert.ok(rulesetCombatant(ended.state, "brenna")!.tracked.some((entry) => entry.condition === "drained"));
}

// ── Lethargy that starts in the middle of its holder's own turn lasts through the NEXT turn ──
{
  // Corwin hastes himself (concentration), then casts another concentration spell on his next turn:
  // Haste ends mid-turn, and 5e's lethargy is "until after its next turn", not the rest of this one.
  const spells = [
    {
      id: "quicken",
      label: "Quicken",
      rows: [{ list: "spells", values: { name: "Quicken", level: 3, prepared: true } }],
      mechanics: {
        kind: "buff",
        targets: "ally",
        applies: [{ condition: "quickened", duration: { rounds: 10 } }],
        concentration: true,
        cost: [{ pool: "slots_3", amount: 1 }],
      },
    },
    {
      id: "hold-fast",
      label: "Hold Fast",
      rows: [{ list: "spells", values: { name: "Hold Fast", level: 2, prepared: true } }],
      mechanics: {
        kind: "debuff",
        save: { save: "wis_save", onSuccess: "negates" },
        applies: [{ condition: "paralyzed", duration: { rounds: 10 }, saveEnds: { save: "wis_save", at: "turn-end" } }],
        concentration: true,
        cost: [{ pool: "slots_2", amount: 1 }],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const corwin: RulesetCombatantInput = {
    id: "corwin",
    name: "Corwin",
    side: "party",
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
      saves: { int_save: "proficient", wis_save: "proficient" },
      fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int", slots_max_2: 3, slots_max_3: 3 },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    }),
    live: {},
    catalogs: { spells },
  };
  let state = createRulesetEncounter({ definition: fiveE, seed: 3, combatants: [corwin, snag()], roller: dice(20, 1) });
  const step = (actorId: string, choice: Omit<RulesetCombatChoice, "actorId">, ...faces: number[]) => {
    const result = applyRulesetCombatChoice(
      fiveE,
      state,
      { actorId, ...choice } as RulesetCombatChoice,
      dice(...faces),
    );
    state = result.state;
    return result;
  };
  const spell = (label: string) =>
    rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === label)!;
  const holds = () => rulesetCombatant(state, "corwin")!.tracked.map((entry) => entry.condition);
  step("corwin", { optionId: spell("Quicken").id, targetIds: ["corwin"] });
  step("corwin", { optionId: "end-turn", targetIds: [] });
  step("snag", { optionId: "end-turn", targetIds: [] });
  const cast = step("corwin", { optionId: spell("Hold Fast").id, targetIds: ["snag"] }, 20);
  assert.deepEqual(
    eventsOf(cast.events, "condition")
      .filter((event) => event.targetId === "corwin")
      .map((event) => [event.condition, event.active]),
    [
      ["quickened", false],
      ["drained", true],
    ],
  );
  step("corwin", { optionId: "end-turn", targetIds: [] });
  assert.deepEqual(holds(), ["drained"], "still drained after the turn it began in");
  step("snag", { optionId: "end-turn", targetIds: [] });
  assert.deepEqual(
    rulesetCombatOptions(fiveE, state, "corwin").map((option) => option.id),
    ["end-turn"],
    "the whole next turn lost",
  );
  step("corwin", { optionId: "end-turn", targetIds: [] });
  assert.deepEqual(holds(), [], "and over after it");

  // The fight's own conditions come off when it ends, without what they leave behind, and the
  // concentration that held one ends with it. A condition with no clock stays.
  const fresh = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [corwin, snag()],
    roller: dice(20, 1),
  });
  state = fresh;
  step("corwin", { optionId: spell("Quicken").id, targetIds: ["corwin"] });
  rulesetCombatant(state, "corwin")!.tracked.push({ condition: "prone", rounds: null });
  assert.ok(rulesetCombatant(state, "corwin")!.concentrating);
  const lifted = liftRulesetFightEffects(fiveE, state);
  assert.deepEqual(
    lifted.map((event) => event.type === "condition" && [event.condition, event.active, event.reason]),
    [["quickened", false, "expired"]],
  );
  assert.deepEqual(holds(), ["prone"], "no lethargy, and the fall's prone stays");
  assert.equal(rulesetCombatant(state, "corwin")!.concentrating, null);
}

// ── The fight ends with Haste on: it is gone from the sheet, and the next fight starts plain ──
{
  let state = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [
      brenna(),
      {
        ...snag(),
        block: { ...(snag() as { block: Record<string, unknown> }).block, health: 1 },
      } as RulesetCombatantInput,
    ],
    roller: dice(20, 1),
  });
  rulesetCombatant(state, "brenna")!.tracked.push({ condition: "quickened", rounds: 10 });
  const won = act(state, { optionId: sword(state)!.id, targetIds: ["snag"] }, 15, 4);
  state = won.state;
  assert.equal(eventsOf(won.events, "outcome")[0]?.outcome, "victory");
  assert.deepEqual(rulesetCombatant(state, "brenna")!.tracked, []);
  assert.ok(!eventsOf(won.events, "condition").some((event) => event.condition === "drained"));
}

// ── Slow's one attack counts a grapple or a shove made in place of a strike ──
{
  let state = fight(["sluggish"]);
  state = act(state, { optionId: sword(state)!.id, targetIds: ["snag"] }, 15, 4).state;
  assert.equal(rulesetCombatant(state, "brenna")!.strikesLeft, 1, "Extra Attack's second strike is in hand");
  assert.ok(!menu(state).some((option) => option.id.startsWith("contest:")), "but no shove with it");
  // The other way round: a shove first, and then no swing.
  let shoved = fight(["sluggish"]);
  const shove = menu(shoved).find((option) => option.id.startsWith("contest:shove"))!;
  shoved = act(shoved, { optionId: shove.id, targetIds: ["snag"] }, 15, 3).state;
  assert.equal(sword(shoved), undefined);
}

// ── A cap on attacks counts the holder's own turn only; a grant never pays for a reaction ──
{
  const capped = parsedOrThrow(
    variant((doc) => {
      withEconomy(doc);
      doc.sheet.live.conditions.push({ id: "steady", label: "Steady" });
      doc.combat.conditions.push({ condition: "steady", attacksPerTurn: 1 });
    }),
  );
  const brute: RulesetCombatantInput = {
    id: "brute",
    name: "Brute",
    side: "enemy",
    block: {
      health: 200,
      defense: 5,
      initiativeModifier: 20,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } },
        {
          id: "riposte",
          name: "Riposte",
          budget: "reaction",
          toHit: 4,
          damage: { count: 1, sides: 6, flat: 0 },
          reaction: { on: "harmed" },
        },
      ],
    },
  };
  const run = (definition: RulesetDefinition, condition: string, board?: boolean) => {
    let state = createRulesetEncounter({
      definition,
      seed: 3,
      combatants: [brenna(), brute],
      roller: dice(1, 20),
      ...(board
        ? {
            board: {
              grid: { width: 8, height: 1, tiles: [Array.from({ length: 8 }, () => "plains" as const)] },
              placements: { brute: { x: 1, y: 0 }, brenna: { x: 2, y: 0 } },
            },
          }
        : {}),
    });
    rulesetCombatant(state, "brute")!.tracked.push({ condition, rounds: null });
    const step = (actorId: string, choice: Omit<RulesetCombatChoice, "actorId">, ...faces: number[]) => {
      const result = applyRulesetCombatChoice(
        definition,
        state,
        { actorId, ...choice, ...(state.window ? { window: state.window.id } : {}) } as RulesetCombatChoice,
        dice(...faces),
      );
      state = result.state;
      return result;
    };
    return { get: () => state, step };
  };
  // Capped at one, the brute claws on its turn; on Brenna's turn it still strikes as she walks away,
  // and that strike is not one of its turn's.
  const walk = run(capped, "steady", true);
  walk.step("brute", { optionId: "claw", targetIds: ["brenna"] }, 15, 3);
  assert.equal(rulesetCombatant(walk.get(), "brute")!.flags.attacks, 1);
  walk.step("brute", { optionId: "end-turn", targetIds: [] });
  walk.step("brenna", { optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 0 } });
  const struck = rulesetWindowOptions(capped, walk.get(), "brute");
  assert.deepEqual(
    struck.map((option) => option.id),
    ["claw"],
  );
  const made = walk.step("brute", { optionId: "claw", targetIds: [] }, 15, 3);
  assert.equal(eventsOf(made.events, "attack").length, 1);
  assert.equal(rulesetCombatant(walk.get(), "brute")!.flags.attacks, 1, "not counted on Brenna's turn");
  // Nor is a reaction through the menu capped there: struck on Brenna's turn, it may riposte.
  const struckBack = run(capped, "steady");
  struckBack.step("brute", { optionId: "claw", targetIds: ["brenna"] }, 15, 3);
  struckBack.step("brute", { optionId: "end-turn", targetIds: [] });
  const longsword = rulesetCombatOptions(capped, struckBack.get(), "brenna").find(
    (option) => option.label === "Longsword",
  )!;
  struckBack.step("brenna", { optionId: longsword.id, targetIds: ["brute"] }, 15, 4);
  assert.deepEqual(
    rulesetWindowOptions(capped, struckBack.get(), "brute").map((option) => option.id),
    ["riposte"],
  );
  // Hasted, with its own reaction spent, the brute is not offered a second riposte out of the haste
  // action: that action is one of its own turns.
  const hasted = run(fiveE, "quickened");
  hasted.step("brute", { optionId: "end-turn", targetIds: [] });
  hasted.step("brenna", { optionId: "end-turn", targetIds: [] });
  assert.equal(rulesetCombatant(hasted.get(), "brute")!.budgets.haste, 1);
  hasted.step("brute", { optionId: "end-turn", targetIds: [] });
  const swing = () =>
    rulesetCombatOptions(fiveE, hasted.get(), "brenna").find((option) => option.label === "Longsword")!;
  hasted.step("brenna", { optionId: swing().id, targetIds: ["brute"] }, 15, 4);
  hasted.step("brute", { optionId: "riposte", targetIds: [] }, 15, 3);
  hasted.step("brenna", { optionId: swing().id, targetIds: ["brute"] }, 15, 4);
  assert.equal(hasted.get().window, undefined, "no reaction left, and the haste action does not stand in");
}

// ── A budget a condition raises still takes an ability's gift ──
{
  const rushed = parsedOrThrow(
    variant((doc) => {
      withEconomy(doc);
      doc.sheet.live.conditions.push({ id: "rushed", label: "Rushed" });
      doc.combat.conditions.push({ condition: "rushed", budgets: [{ budget: "action", flat: 1 }] });
    }),
  );
  const surge = [
    {
      id: "surge",
      label: "Surge",
      rows: [{ list: "spells", values: { name: "Surge", level: 0, prepared: true } }],
      mechanics: { kind: "utility", free: true, gives: [{ budget: "action", count: 1 }] },
    },
  ] as unknown as RulesetCatalogEntry[];
  const surger = (conditions: string[]): RulesetCombatantInput =>
    ({
      ...brenna(conditions),
      build: rulesetSheetBuildSchema.parse({
        abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
        fields: { level: 7, ac: 18, speed: 30, hp_max: 60, spellcasting_ability: "int" },
        lists: { spells: surge.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
      }),
      catalogs: { spells: surge },
    }) as RulesetCombatantInput;
  for (const [conditions, after] of [
    [[], 2],
    [["rushed"], 3],
  ] as const) {
    const state = createRulesetEncounter({
      definition: rushed,
      seed: 3,
      combatants: [surger([...conditions]), snag()],
      roller: dice(20, 1),
    });
    const option = rulesetCombatOptions(rushed, state, "brenna").find((entry) => entry.label === "Surge")!;
    const step = applyRulesetCombatChoice(
      rushed,
      state,
      { actorId: "brenna", optionId: option.id, targetIds: [] },
      dice(),
    );
    assert.equal(
      rulesetCombatant(step.state, "brenna")!.budgets.action,
      after,
      `with ${conditions.join() || "nothing"}`,
    );
  }
}

// ── A creature that falls while concentrating on its own Haste is not made lethargic as it dies ──
{
  const caster = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [brenna(), snag()],
    roller: dice(20, 1),
  });
  const foe = rulesetCombatant(caster, "snag")!;
  foe.health = { ...foe.health!, value: 1 };
  foe.tracked.push({ condition: "quickened", rounds: 10, source: "snag", concentration: true });
  foe.concentrating = { actionId: "quicken", label: "Quicken" };
  const felled = act(caster, { optionId: sword(caster)!.id, targetIds: ["snag"] }, 15, 4);
  assert.ok(!eventsOf(felled.events, "condition").some((event) => event.condition === "drained"));
  assert.deepEqual(rulesetCombatant(felled.state, "snag")!.tracked, []);
}

// ── Spent, a haste action's standard actions say so ──
{
  let state = fight(["quickened"]);
  state = act(state, { optionId: "standard:dash@haste", targetIds: [] }).state;
  const again = act(state, { optionId: "standard:dash@haste", targetIds: [] });
  assert.equal(eventsOf(again.events, "refused")[0]?.reason, "no-budget");
}

// ── An invented creature never spends a budget only a condition fills ──
{
  const clamped = clampRulesetStatBlock(
    fiveE,
    {
      health: 10,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ id: "bite", name: "Bite", budget: "haste", toHit: 2, damage: { count: 1, sides: 4, flat: 0 } }],
    },
    fiveE.combat!.threat!.tiers[0]!.id,
  );
  assert.equal(clamped.block.actions[0]!.budget, "action");
  assert.ok(clamped.adjusted.some((line) => /only a condition fills/.test(line)));
}

// ── The schema ──
{
  assert.match(
    refusal(
      variant((doc) => {
        withEconomy(doc);
        doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "quickened").grants.budget =
          "focus";
      }),
    ),
    /Unknown budget "focus"/,
  );
  assert.match(
    refusal(
      variant((doc) => {
        withEconomy(doc);
        doc.combat.conditions.find(
          (entry: { condition: string }) => entry.condition === "quickened",
        ).onEnd.applies[0].condition = "weary";
      }),
    ),
    /Unknown condition "weary"/,
  );
  assert.match(
    refusal(
      variant((doc) => {
        withEconomy(doc);
        doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "quickened").grants = {
          budget: "haste",
        };
      }),
    ),
    /A grant says what its budget may be spent on/,
  );
  const quickened = (doc: Record<string, any>) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "quickened");
  for (const [edit, message] of [
    [
      (doc: Record<string, any>) => {
        doc.combat.economy.budgets.push({ id: "focus", label: "Focus", per: "round", count: 1 });
        quickened(doc).budgets = [{ budget: "focus", flat: 1 }];
      },
      /"focus" refills per round, not per turn/,
    ],
    [
      (doc: Record<string, any>) => (quickened(doc).onEnd.applies[0].duration = "until-save"),
      /What a condition leaves behind lasts some rounds/,
    ],
    [
      (doc: Record<string, any>) => (quickened(doc).onEnd.applies[0].duration = "instant"),
      /What a condition leaves behind lasts some rounds/,
    ],
    [
      (doc: Record<string, any>) => (quickened(doc).grants.standard = ["ready", "dash"]),
      /does not have the standard action "ready"/,
    ],
    [
      (doc: Record<string, any>) => (quickened(doc).grants.budget = "action"),
      /Every standard action is already taken for "action"/,
    ],
    [(doc: Record<string, any>) => (quickened(doc).grants.items = { tags: ["mundane"] }), /Unknown item tag "mundane"/],
  ] as const) {
    assert.match(
      refusal(
        variant((doc) => {
          withEconomy(doc);
          if (!doc.combat.standard?.includes("dash")) throw new Error("the example has no Dash");
          doc.combat.standard = doc.combat.standard.filter((name: string) => name !== "ready");
          edit(doc);
        }),
      ),
      message,
    );
  }
}

console.log("Ruleset combat economy: budgets, grants, exclusive budgets, a cap on attacks and what ends leave.");
