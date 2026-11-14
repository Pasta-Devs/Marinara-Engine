/**
 * Lair actions (Capability API 1.315).
 *
 *   - `lair` on a creature's action and `lairInitiative` on the creature: while it fights in its
 *     lair (`inLair`), one lair action a round as the count passes its lair's number, losing ties,
 *     never the one it took the round before, aimed and resolved as on its own turn.
 *   - The count between two turns, after the last turn when everybody is at it or above, and before
 *     the very first turn when everybody is below it.
 *   - Never on its own turn's menu, nor while it is out of its lair, down or unable to act.
 *   - The director's own creature takes them, and the Game Master's `inLair` reaches the fight.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetLairOptions,
  rulesetOpenLairWindow,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  RULESET_PASS_OPTION,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lair-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 315);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const definition = parsed(fiveE());
  const member = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
      fields: { level: 1, ac: 10, speed: 30, hp_max: 200 },
      lists: { attacks: [{ name: "Sword", ability: "str", proficient: true, bonus: 0, damage: "1d8", reach: 5 }] },
    });
  const claw = { id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 1, sides: 6, flat: 0 } };
  const quake = {
    id: "quake",
    name: "Quake",
    budget: "action",
    lair: true,
    toHit: 30,
    damage: { count: 1, sides: 1, flat: 6 },
  };
  const gust = {
    id: "gust",
    name: "Gust",
    budget: "action",
    lair: true,
    toHit: 30,
    damage: { count: 1, sides: 1, flat: 3 },
  };
  // The same as a bestiary writes them.
  const cClaw = { ...claw, damage: { dice: "1d6" } };
  const cQuake = { ...quake, damage: { dice: "1d4+2" } };
  const dragonBlock = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 300,
      defense: 30,
      initiativeModifier: 0,
      speed: 40,
      actions: [claw, quake, gust],
      ...extra,
    }) as unknown as RulesetStatBlock;
  /** A fight in the dragon's lair, with everybody's count as given, in that order. */
  const fight = (
    counts: Record<"ada" | "bo" | "dragon", number>,
    options: { inLair?: boolean; block?: Record<string, unknown> } = {},
  ) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build: member(), live: {} },
        { id: "bo", name: "Bo", side: "party", build: member(), live: {} },
        { id: "dragon", name: "Dragon", side: "enemy", block: dragonBlock(options.block) },
      ],
      ...(options.inLair === false ? {} : { inLair: ["dragon"] }),
    });
    for (const one of state.combatants) one.initiative = counts[one.id as "ada" | "bo" | "dragon"];
    state.order = [...state.combatants].sort((a, b) => b.initiative - a.initiative).map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const end = (state: RulesetEncounterState) => {
    const actor = state.order[state.turn]!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const lairIds = (state: RulesetEncounterState) =>
    rulesetWindowOptions(definition, state, "dragon").map((one) => one.id);
  const take = (state: RulesetEncounterState, id: string, target = "ada") => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "dragon", optionId: `lair>${id}`, targetIds: [target], window: state.window!.id },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const pass = (state: RulesetEncounterState) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "dragon", optionId: RULESET_PASS_OPTION, targetIds: [], window: state.window!.id },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const current = (state: RulesetEncounterState) => state.order[state.turn];
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;

  // ── Between two turns: after everybody at 20 or above, before anybody below ──
  {
    let state = fight({ ada: 22, dragon: 20, bo: 15 });
    assert.deepEqual(state.order, ["ada", "dragon", "bo"]);
    // Not on its own turn's menu.
    state = end(state).state;
    assert.equal(state.window, undefined, "22 to 20: the count has not passed 20 yet");
    assert.equal(current(state), "dragon");
    assert.ok(!rulesetCombatOptions(definition, state, "dragon").some((one) => /quake|gust/u.test(one.id)));
    const budgets = { ...who(state, "dragon").budgets };
    const ended = end(state);
    state = ended.state;
    assert.equal(state.window?.kind, "signature", "20 to 15: its lair's count");
    assert.deepEqual(state.window?.waiting, ["dragon"]);
    assert.deepEqual(lairIds(state).sort(), ["lair>gust", "lair>quake"]);
    // Taken already this round, none.
    const already = structuredClone(state);
    who(already, "dragon").lair!.last = { round: 1, id: "gust" };
    assert.deepEqual(rulesetLairOptions(definition, already, "dragon"), [], "one a round");
    const before = health(state, "ada");
    const quaked = take(state, "quake");
    state = quaked.state;
    assert.equal(quaked.events[0]?.type, "lair");
    assert.ok(quaked.events.some((one) => one.type === "lair" && one.label === "Quake" && one.actorId === "dragon"));
    assert.equal(health(state, "ada"), before - 7, "it lands as on its own turn: 1d1 + 6");
    assert.equal(state.window, undefined);
    assert.equal(current(state), "bo", "and the next turn begins");
    assert.deepEqual(who(state, "dragon").budgets, budgets, "nothing of its own turn spent");
    assert.deepEqual(who(state, "dragon").lair?.last, { round: 1, id: "quake" });
    // Not again this round: 15 to 22 wraps past nobody's 20.
    state = end(state).state;
    assert.equal(state.window, undefined);
    assert.equal(state.round, 2);
    state = end(state).state;
    assert.equal(state.window, undefined);
    // Round 2: not the quake again.
    state = end(state).state;
    assert.deepEqual(lairIds(state), ["lair>gust"], "not the same one two rounds running");
    // A refused quake all the same.
    const again = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "dragon", optionId: "lair>quake", targetIds: ["ada"], window: state.window!.id },
      roll,
    );
    assert.ok(refused(again), "the quake is refused");
    // Passed this round, the next round may have either.
    state = pass(state).state;
    assert.equal(current(state), "bo");
    state = end(end(end(state).state).state).state;
    assert.equal(state.round, 3);
    assert.deepEqual(lairIds(state).sort(), ["lair>gust", "lair>quake"], "a round passed, the quake again");
    // Gust this round, so the next has only the quake.
    state = take(state, "gust", "bo").state;
    state = end(end(end(state).state).state).state;
    assert.deepEqual(lairIds(state), ["lair>quake"]);
  }

  // ── Everybody at its count or above: after the last turn of the round ──
  {
    let state = fight({ ada: 25, dragon: 22, bo: 21 });
    state = end(end(state).state).state;
    assert.equal(state.window, undefined);
    state = end(state).state;
    assert.equal(state.window?.kind, "signature", "after the last turn");
    assert.deepEqual(lairIds(state).sort(), ["lair>gust", "lair>quake"]);
    state = take(state, "quake").state;
    assert.equal(state.round, 2);
    assert.equal(current(state), "ada");
    assert.deepEqual(who(state, "dragon").lair?.last, { round: 1, id: "quake" });
  }

  // ── A count of its own: 10, losing ties ──
  {
    let state = fight({ ada: 22, dragon: 10, bo: 15 }, { block: { lairInitiative: 10 } });
    assert.deepEqual(state.order, ["ada", "bo", "dragon"]);
    state = end(state).state;
    assert.equal(state.window, undefined, "22 to 15");
    state = end(state).state;
    assert.equal(state.window, undefined, "15 to 10: the dragon at 10 goes first");
    state = end(state).state;
    assert.equal(state.window?.kind, "signature", "after the dragon at 10, its lair");
    state = pass(state).state;
    assert.equal(state.round, 2);
  }

  // ── Passed before the first turn: not again until the next round's count ──
  {
    let state = rulesetOpenLairWindow(definition, fight({ ada: 15, dragon: 18, bo: 12 }));
    assert.equal(state.window?.kind, "signature");
    state = pass(state).state;
    assert.equal(current(state), "dragon");
    state = end(state).state;
    assert.equal(state.window, undefined, "18 to 15, both below its count: it came before them");
    // Somebody at exactly 20 goes first: before the first turn is too early.
    const tied = rulesetOpenLairWindow(definition, fight({ ada: 20, dragon: 18, bo: 12 }));
    assert.equal(tied.window, undefined, "losing ties");
    // Whoever cannot take a turn is passed over in finding the count: Bo is down.
    let skipped = fight({ ada: 22, bo: 21, dragon: 15 });
    who(skipped, "bo").down = true;
    who(skipped, "bo").stable = true;
    skipped = end(skipped).state;
    assert.equal(skipped.window?.kind, "signature", "from Ada at 22 straight to the dragon at 15");
  }

  // ── A bestiary creature's own count and lair actions ──
  {
    const withDragon = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        const dragon = structuredClone(creatures.entries[0]);
        dragon.id = "dragon";
        dragon.creature.lairInitiative = 7;
        dragon.creature.actions = [cClaw, cQuake];
        delete dragon.creature.signaturePoints;
        creatures.entries.push(dragon);
      }),
    );
    const bestiary = Object.fromEntries(
      (withDragon.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const catalogId = (withDragon.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const state = createRulesetEncounter({
      definition: withDragon,
      seed: 1,
      bestiary,
      combatants: [{ id: "dragon", name: "Dragon", side: "enemy", creature: { catalogId, entryId: "dragon" } }],
      inLair: ["dragon"],
    });
    assert.equal(who(state, "dragon").lair?.at, 7);
    assert.equal(who(state, "dragon").actions.find((one) => one.id === "quake")?.lair, true);
  }

  // ── Initiative thrown again each round: its lair's count as the round turns over ──
  {
    const rethrown = structuredClone(definition);
    rethrown.combat!.initiative.each = "round";
    let state = fight({ ada: 22, dragon: 21, bo: 15 });
    const endIn = (current: RulesetEncounterState) =>
      applyRulesetCombatChoice(
        rethrown,
        current,
        { actorId: current.order[current.turn]!, optionId: "end-turn", targetIds: [] },
        roll,
      ).state;
    state = endIn(endIn(state));
    assert.equal(state.window?.kind, "signature", "round 1's, after the dragon");
    state = applyRulesetCombatChoice(
      rethrown,
      state,
      { actorId: "dragon", optionId: "lair>quake", targetIds: ["ada"], window: state.window!.id },
      roll,
    ).state;
    state = endIn(state);
    assert.equal(state.window?.kind, "signature", "round 2's, before its order is thrown");
    assert.deepEqual(
      rulesetWindowOptions(rethrown, state, "dragon").map((one) => one.id),
      ["lair>gust"],
    );
    state = applyRulesetCombatChoice(
      rethrown,
      state,
      { actorId: "dragon", optionId: "lair>gust", targetIds: ["ada"], window: state.window!.id },
      roll,
    ).state;
    assert.equal(state.round, 2);
    assert.deepEqual(who(state, "dragon").lair?.last, { round: 2, id: "gust" });
    for (let turn = 0; turn < 2; turn++) {
      state = endIn(state);
      assert.ok(!state.window || !rulesetWindowOptions(rethrown, state, "dragon").some((one) => one.lairOf));
      if (state.window)
        state = applyRulesetCombatChoice(
          rethrown,
          state,
          { actorId: state.window.waiting[0]!, optionId: RULESET_PASS_OPTION, targetIds: [], window: state.window.id },
          roll,
        ).state;
    }
  }

  // ── Everybody below it: before the very first turn ──
  {
    let state = rulesetOpenLairWindow(definition, fight({ ada: 12, dragon: 18, bo: 15 }));
    assert.equal(state.window?.kind, "signature");
    assert.equal(state.window?.trigger.kind === "between-turns" && state.window.trigger.opening, true);
    assert.ok(state.opening.some((one) => one.type === "window" && one.kind === "signature"));
    assert.deepEqual(lairIds(state).sort(), ["lair>gust", "lair>quake"]);
    assert.equal(current(state), "dragon");
    const turnBudgets = { ...who(state, "dragon").budgets };
    state = take(state, "gust").state;
    assert.equal(state.window, undefined);
    assert.equal(state.round, 1, "still the first round");
    assert.equal(current(state), "dragon", "whose first turn goes on as it was handed out");
    assert.deepEqual(who(state, "dragon").budgets, turnBudgets);
    assert.ok(rulesetCombatOptions(definition, state, "dragon").some((one) => one.id === "claw"));
    // Not again before its next round: the last turn wraps to the next round, below 20 again.
    state = end(state).state;
    assert.equal(state.window, undefined);
    state = end(state).state;
    assert.equal(state.window, undefined);
    state = end(state).state;
    assert.equal(state.window?.kind, "signature", "the next round's, before its first turn");
    assert.equal(state.round, 1, "asked as the round turns over");
    assert.deepEqual(lairIds(state), ["lair>quake"], "not the gust two rounds running");
    state = take(state, "quake").state;
    assert.equal(state.round, 2);
    assert.deepEqual(who(state, "dragon").lair?.last, { round: 2, id: "quake" });
    // Nobody's lair before the first turn: the fight as it was.
    const plain = fight({ ada: 22, dragon: 21, bo: 15 });
    assert.equal(rulesetOpenLairWindow(definition, plain), plain);
    const away = fight({ ada: 12, dragon: 18, bo: 15 }, { inLair: false });
    assert.equal(rulesetOpenLairWindow(definition, away), away);
  }

  // ── Out of its lair, down, or unable to act: none ──
  {
    let state = fight({ ada: 22, dragon: 21, bo: 15 }, { inLair: false });
    assert.equal(who(state, "dragon").lair, undefined);
    state = end(end(state).state).state;
    assert.equal(state.window, undefined, "not in its lair");
    let down = fight({ ada: 22, dragon: 21, bo: 15 });
    down = end(down).state;
    who(down, "dragon").tracked.push({ condition: "paralyzed", rounds: null } as never);
    assert.deepEqual(rulesetLairOptions(definition, down, "dragon"), [], "it is the dragon's turn yet");
    const ended = applyRulesetCombatChoice(
      definition,
      down,
      { actorId: "dragon", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(ended.state.window, undefined, "paralyzed, its lair does nothing");
    // A creature without lair actions is never in its lair.
    const none = createRulesetEncounter({
      definition,
      seed: 1,
      combatants: [{ id: "x", name: "X", side: "enemy", block: dragonBlock({ actions: [claw] }) }],
      inLair: ["x"],
    });
    assert.equal(who(none, "x").lair, undefined);
  }

  // ── The director's own dragon, in its lair as the Game Master said ──
  {
    const withDragon = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        const dragon = structuredClone(creatures.entries[0]);
        dragon.id = "dragon";
        dragon.label = "Dragon";
        dragon.creature.initiativeModifier = -20;
        // Below Ada's count and above its own: between their turns.
        dragon.creature.lairInitiative = 0;
        dragon.creature.actions = [
          // It misses, and its lair barely scratches: the fight lasts long enough to watch.
          { ...claw, toHit: -30, damage: { dice: "1d4" } },
          { ...cQuake, damage: { dice: "1d2" } },
          { ...gust, damage: { dice: "1d2" } },
        ];
        delete dragon.creature.signaturePoints;
        creatures.entries.push(dragon);
      }),
    );
    const bestiary = Object.fromEntries(
      (withDragon.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (withDragon.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const seed = (inLair: string[]) =>
      createRulesetFight({
        definition: withDragon,
        seed: 3,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "dragon", name: "Dragon", creature: `${creaturesId}/dragon` }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withDragon) } }],
        playerName: null,
        live: {},
        items: () => [],
        partyCatalogs: {},
        bestiary,
        inLair,
      } as never);
    const built = seed(["dragon"]);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const encounter = (built as { fight: { encounter: RulesetEncounterState } }).fight.encounter;
    assert.ok(who(encounter, "dragon").lair, "in its lair");
    assert.equal(encounter.window, undefined, "Ada is above its lair's count, so nothing acts before her");
    // A lair's count above everybody's acts before the first turn.
    const high = (bestiary as Record<string, Array<{ id: string; creature: { lairInitiative?: number } }>>)[
      creaturesId
    ]!.find((entry) => entry.id === "dragon")!;
    high.creature.lairInitiative = 50;
    const early = seed(["dragon"]) as { fight: { encounter: RulesetEncounterState } };
    assert.equal(early.fight.encounter.window?.kind, "signature", "its lair acts before Ada");
    high.creature.lairInitiative = 0;
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("dragon", "Dragon", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    syncRulesetCombatants(withDragon, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(withDragon, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 12 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(withDragon, state, { type: "continue" }).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    const lairs = events.filter((event) => event.type === "lair");
    assert.ok(lairs.length >= 2, `its lair acted each round: ${JSON.stringify(events.map((event) => event.type))}`);
    assert.ok(lairs.every((event) => event.type === "lair" && event.actorId === "dragon"));
    // Never the same two rounds running.
    for (let index = 1; index < lairs.length; index++) {
      assert.notEqual(
        (lairs[index] as { label: string }).label,
        (lairs[index - 1] as { label: string }).label,
        JSON.stringify(lairs),
      );
    }
  }

  // ── Import refusals ──
  {
    const withCreature = (creature: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "d",
            label: "D",
            creature: { health: 10, defense: 10, initiativeModifier: 0, speed: 30, tier: "cr_0", ...creature },
          },
        ],
      });
    };
    parsed(fiveE(withCreature({ lairInitiative: 20, actions: [cClaw, cQuake] })));
    parsed(fiveE(withCreature({ actions: [cClaw, cQuake] })));
    refusedDoc(
      withCreature({ signaturePoints: 3, actions: [cClaw, { ...cQuake, signature: { cost: 1 } }] }),
      /A lair action is taken on its own count, so it is neither a reaction nor bought with points/,
    );
    refusedDoc(
      withCreature({ actions: [cClaw, { ...cQuake, reaction: { on: "hit" } }] }),
      /A lair action is taken on its own count/,
    );
    refusedDoc(withCreature({ lairInitiative: 20, actions: [cClaw] }), /A lair's count is for its lair actions/);
    refusedDoc(
      withCreature({
        actions: [cClaw, cQuake, { id: "both", name: "Both", budget: "action", sequence: [{ action: "quake" }] }],
      }),
      /"quake" is a lair action, so a sequence cannot name it/,
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
    const gate = "A ruleset with a creature's lair actions requires schemaVersion 2 and capabilityApi 1.315 or newer";
    const doc = (creature: Record<string, unknown>) =>
      fiveE((doc) => doc.catalogs.push({ id: "x", label: "X", entries: [{ id: "a", label: "A", creature }] }));
    assert.equal(getCapabilityPackageInstallIssue(manifest(314) as never, doc({ actions: [cQuake] })), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(314) as never, doc({ lairInitiative: 20, actions: [cClaw] })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(315) as never, doc({ actions: [cQuake] })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(314) as never, fiveE()), gate, "the plain 5e example");
    // A ruleset's own value ids are its data: a row's `lair`, `reaps`, `clears` or `icon` column asks for
    // nothing newer.
    const columns = fiveE((doc) =>
      doc.catalogs.push({
        id: "x",
        label: "X",
        entries: [
          {
            id: "a",
            label: "A",
            values: {
              lair: 1,
              lairInitiative: 20,
              legendaryResistance: 3,
              reaps: true,
              clears: true,
              shade: 1,
              alerts: true,
              stillIn: 1,
              untilLair: true,
              usableNear: 1,
              whileNearProp: 1,
              aroundProp: 1,
              feeds: 2,
              lingers: 1,
              hangsOn: 1,
              heldAtMost: 1,
              reaction: true,
              icon: "ic_lair",
            },
          },
        ],
      }),
    );
    assert.doesNotMatch(
      getCapabilityPackageInstallIssue(manifest(314) as never, columns) ?? "",
      /capabilityApi 1\.3[1-3]\d or newer/,
    );
  }

  console.log(
    "Ruleset lair actions: one a round on the lair's count, losing ties, never the same two rounds running, before the first turn when everybody is below it, taken by the director's dragon.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
