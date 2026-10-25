/**
 * Ruleset combat, slice C5g (#6728): the moment after an attack hits, and creatures that react.
 *
 * What is pinned here:
 *   - `on: "hit"`: an attack roll that hits somebody holding an answer for it is HELD before its
 *     damage, and a window asks the one it hit. What they take counts for that attack: the same roll
 *     is checked again against their defense as it now stands, a hit that no longer reaches it
 *     misses, and a natural face still decides whatever the defense.
 *   - The held attack picks up exactly where it stopped: the rest of its targets, the rest of an
 *     action made of other actions, whoever it had already hurt (for the moment after it), and a
 *     fight saved while the window is open.
 *   - Nothing opened inside a window opens another, so an attack made inside one is never held.
 *   - A creature's own action may be a reaction and land on the creature itself (a Parry), and a
 *     one-attack guard it puts on is spent by the attack it answered.
 *   - `rulesetAnswerDeflects`, which the Engine's picker reads: true only when the answer turns the
 *     hit into a miss.
 *   - Every import refusal, the log, and the 1.46 gate.
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
  rowsFromCatalogEntry,
  rulesetAnswerDeflects,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-hit-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [{ getCapabilityPackageInstallIssue }, { rulesetCombatEventLine, rulesetCombatNames }] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;

  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const edited = (text: string, edit: (doc: Record<string, any>) => void) => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const refuses = (edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const parsed = parseRulesetDefinition(edited(fiveEText, edit));
    assert.ok(!parsed.ok, `${why}: it should have been refused`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };

  // Shield raises Armor Class by 5 until its holder's next turn begins; Evading halves the harm of the
  // one attack it answers. Parrying (+2 for one attack) ships with the reference, on its Toll Sergeant.
  const fiveE = parsedOrThrow(
    edited(fiveEText, (doc) => {
      doc.sheet.live.conditions.push({ id: "shielded", label: "Shielded" }, { id: "evading", label: "Evading" });
      doc.combat.conditions.push(
        { condition: "shielded", modifiers: [{ to: "defense", flat: 5 }] },
        { condition: "evading", effects: ["resist-all"] },
      );
    }),
    "the 5e reference with Shield's condition",
  );

  const reactions = [
    {
      id: "shield",
      label: "Shield",
      rows: [{ list: "spells", values: { name: "Shield", level: 1, prepared: true } }],
      mechanics: {
        kind: "buff",
        targets: "self",
        budget: "reaction",
        reaction: { on: "hit" },
        applies: [{ condition: "shielded", duration: { rounds: 1, at: "turn-start" } }],
      },
    },
    {
      id: "uncanny-dodge",
      label: "Uncanny Dodge",
      rows: [{ list: "spells", values: { name: "Uncanny Dodge", level: 1, prepared: true } }],
      mechanics: {
        kind: "buff",
        targets: "self",
        budget: "reaction",
        reaction: { on: "hit" },
        applies: [{ condition: "evading", duration: { rounds: 1 }, endsAfter: "attacked" }],
      },
    },
    {
      // Rolls to hit and is held together while it lasts, so picking it up after a hold must not
      // start holding it a second time.
      id: "hex-bolt",
      label: "Hex Bolt",
      rows: [{ list: "spells", values: { name: "Hex Bolt", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        attackRoll: true,
        amount: { dice: "1d6" },
        damageType: "force",
        concentration: true,
      },
    },
    {
      id: "flinch",
      label: "Flinch",
      rows: [{ list: "spells", values: { name: "Flinch", level: 1, prepared: true } }],
      mechanics: { kind: "buff", targets: "self", free: true, reaction: { on: "harmed" }, temporary: { flat: 1 } },
    },
  ] as unknown as RulesetCatalogEntry[];
  const rowsOf = (ids: string[]) =>
    ids.flatMap((id) =>
      rowsFromCatalogEntry(
        "spells",
        reactions.find((entry) => entry.id === id)!,
      ).map((row) => row.row),
    );

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
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T> => {
    const found = eventsOf(events, type)[0];
    assert.ok(found, `no ${type} event`);
    return found;
  };

  /** A fighter at Armor Class 18 who holds the reactions named. */
  const fighter = (id: string, held: string[] = [], ac = 18): RulesetCombatantInput => ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    side: "party",
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
      saves: { str_save: "proficient", con_save: "proficient" },
      fields: { level: 7, ac, speed: 30, hp_max: 60 },
      lists: {
        attacks: [
          { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
        ],
        spells: rowsOf(held),
      },
    }),
    live: {},
    catalogs: { spells: reactions },
  });
  const parry = {
    id: "parry",
    name: "Parry",
    budget: "reaction",
    self: true as const,
    reaction: { on: "hit" as const },
    applies: [{ condition: "parrying", duration: { rounds: 1 }, endsAfter: "attacked" as const }],
  };
  /** A stat block at Armor Class 13 with a scimitar at +4, one that strikes twice, one that sweeps two,
   *  and, when asked for, a Parry of its own. */
  const snag = (parries = false): RulesetCombatantInput => ({
    id: "snag",
    name: "Snag",
    side: "enemy",
    block: {
      health: 60,
      defense: 13,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "scimitar", name: "Scimitar", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2 } },
        { id: "twin", name: "Twin Cuts", budget: "action", sequence: [{ action: "scimitar", times: 2 }] },
        {
          id: "sweep",
          name: "Sweep",
          budget: "action",
          toHit: 4,
          targetCount: 2,
          damage: { count: 1, sides: 6, flat: 2 },
        },
        ...(parries ? [parry] : []),
      ],
    } as RulesetStatBlock,
  });
  /** The party first: a 20 each against Snag's 1. */
  const fight = (combatants: RulesetCombatantInput[]): RulesetEncounterState =>
    createRulesetEncounter({
      definition: fiveE,
      seed: 5,
      combatants,
      roller: dice(...combatants.map((combatant) => (combatant.side === "party" ? 20 : 1))),
    });
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, ...faces: number[]) =>
    applyRulesetCombatChoice(fiveE, state, choice, dice(...faces));
  const endTurn = (state: RulesetEncounterState, actorId: string) =>
    act(state, { actorId, optionId: "end-turn", targetIds: [] }).state;
  const idOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const action = rulesetCombatant(state, actorId)!.actions.find((entry) => entry.label === label);
    assert.ok(action, `${actorId} has no "${label}"`);
    return action.id;
  };
  const answer = (state: RulesetEncounterState, actorId: string, label: string, ...faces: number[]) =>
    act(state, { actorId, optionId: idOf(state, actorId, label), targetIds: [], window: state.window!.id }, ...faces);
  const pass = (state: RulesetEncounterState, actorId: string, ...faces: number[]) =>
    act(state, { actorId, optionId: RULESET_PASS_OPTION, targetIds: [], window: state.window!.id }, ...faces);
  /** Snag's turn, with Brenna (and whoever else) done. */
  const snagsTurn = (combatants: RulesetCombatantInput[]) => {
    let state = fight(combatants);
    for (const one of combatants) if (one.side === "party") state = endTurn(state, one.id);
    return state;
  };
  const scimitar = (state: RulesetEncounterState, target = "brenna", ...faces: number[]) =>
    act(state, { actorId: "snag", optionId: "scimitar", targetIds: [target] }, ...faces);

  // ── Refused at import ──
  {
    const bestiary = (doc: Record<string, any>) =>
      doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries;
    const sergeant = (doc: Record<string, any>) =>
      bestiary(doc).find((entry: { id: string }) => entry.id === "toll-sergeant").creature;
    refuses(
      (doc) => (sergeant(doc).actions[0].reaction = { on: "hit", cancels: true }),
      /Only an "aimed" or "used" reaction cancels/,
      "a hit cannot be called off",
    );
    refuses(
      (doc) => (sergeant(doc).actions[0].targetCount = 2),
      /lands on the creature itself takes no other target/,
      "self and a target count",
    );
    refuses(
      (doc) => (sergeant(doc).actions[0].signature = { cost: 1 }),
      /A reaction is taken at its moment, so it is not bought between turns as well/,
      "a reaction and a signature",
    );
    refuses(
      (doc) => (sergeant(doc).actions[0].reaction = { on: "hit", against: { catalogs: ["hexes"] } }),
      /Unknown catalog "hexes"/,
      "what it answers must exist",
    );
    refuses(
      (doc) =>
        sergeant(doc).actions.push({
          id: "both",
          name: "Both",
          budget: "action",
          sequence: [{ action: "parry", times: 1 }],
        }),
      /"parry" is a reaction, so no sequence can make it/,
      "a sequence that makes a reaction",
    );
    refuses(
      (doc) =>
        sergeant(doc).actions.push({
          id: "odd",
          name: "Odd",
          budget: "action",
          sequence: [{ action: "parry", times: 1 }],
          self: true,
        }),
      /A sequence resolves the actions it names, so it carries nothing of its own/,
      "a sequence that lands on itself",
    );
    // The shipped reference parries, on the moment, on itself.
    const shipped = parsedOrThrow(JSON.parse(fiveEText), "the 5e reference");
    const sergeantEntry = shipped
      .catalogs!.find((catalog) => catalog.holds === "creatures")!
      .entries!.find((entry) => entry.id === "toll-sergeant")!;
    assert.deepEqual(sergeantEntry.creature!.actions![0]!.reaction, { on: "hit", at: "source" });
    assert.equal(sergeantEntry.creature!.actions![0]!.self, true);
  }

  // ── Shield: held after the roll, asked, and the same roll checked again ──
  {
    const state = snagsTurn([fighter("brenna", ["shield"]), snag()]);
    assert.ok(!rulesetCombatOptions(fiveE, state, "brenna").some((option) => option.label === "Shield"));
    // 16 and +4 is 20 against 18: a hit, and nothing is dealt yet.
    const held = scimitar(state, "brenna", 16);
    const window = held.state.window!;
    assert.ok(window, "the hit is held");
    assert.deepEqual(window.trigger, {
      kind: "hit",
      sourceId: "snag",
      optionId: "scimitar",
      label: "Scimitar",
      blow: "melee",
      weapon: true,
      // The budget it was paid for from (1.248).
      budget: "action",
      total: 20,
      defense: 18,
    });
    assert.deepEqual(window.waiting, ["brenna"]);
    assert.deepEqual(window.resume, {
      kind: "action",
      actorId: "snag",
      optionId: "scimitar",
      targetIds: ["brenna"],
      budget: "action",
      held: {
        targetId: "brenna",
        rest: [],
        roll: { mode: "normal", total: 20, defense: 18, critical: false, natural: false },
        mine: [],
        hurt: [],
      },
    });
    assert.equal(firstOf(held.events, "attack").outcome, "hit");
    assert.deepEqual(eventsOf(held.events, "damage"), [], "held before its damage");
    assert.deepEqual(firstOf(held.events, "window"), {
      type: "window",
      window: window.id,
      kind: "reaction",
      waiting: ["brenna"],
      moment: "hit",
      label: "Scimitar",
      sourceId: "snag",
      total: 20,
      defense: 18,
    });
    assert.deepEqual(
      rulesetWindowOptions(fiveE, held.state, "brenna").map((option) => [option.label, option.targets]),
      [["Shield", { side: "self", count: 1 }]],
    );

    // Shield: 23 now, so the 20 misses, and no dice are thrown for it.
    const shielded = answer(held.state, "brenna", "Shield");
    assert.deepEqual(eventsOf(shielded.events, "recheck"), [
      {
        type: "recheck",
        actorId: "snag",
        targetId: "brenna",
        optionId: "scimitar",
        label: "Scimitar",
        total: 20,
        defense: 23,
        guards: [{ condition: "shielded", value: 5 }],
        unguarded: 18,
        outcome: "miss",
      },
    ]);
    assert.deepEqual(eventsOf(shielded.events, "damage"), []);
    assert.equal(shielded.state.window, undefined);
    assert.equal(rulesetCombatant(shielded.state, "brenna")!.budgets.reaction, 0);
    assert.equal(shielded.state.order[shielded.state.turn], "snag", "and it is still Snag's turn");
    // It lasts until Brenna's own turn begins.
    const back = endTurn(shielded.state, "snag");
    assert.ok(!rulesetCombatant(back, "brenna")!.tracked.some((entry) => entry.condition === "shielded"));

    // Let go, the blow lands as rolled.
    const through = pass(held.state, "brenna", 4);
    assert.deepEqual(eventsOf(through.events, "recheck"), [], "nothing changed, so nothing is checked aloud");
    assert.equal(firstOf(through.events, "damage").dealt, 6);

    // A roll that beats the Shield too still hits, and says so.
    const high = answer(scimitar(state, "brenna", 19).state, "brenna", "Shield", 5);
    assert.equal(firstOf(high.events, "recheck").outcome, "hit");
    assert.equal(firstOf(high.events, "damage").dealt, 7);

    // A natural 20 hits whatever the defense, and is still a critical: at Armor Class 20 and Shield's
    // 25, its 24 would miss on the number alone.
    const armoured = snagsTurn([fighter("brenna", ["shield"], 20), snag()]);
    const natural = scimitar(armoured, "brenna", 20);
    assert.equal(
      natural.state.window?.resume?.kind === "action" && natural.state.window.resume.held?.roll.natural,
      true,
    );
    const struck = answer(natural.state, "brenna", "Shield", 3, 3);
    assert.equal(firstOf(struck.events, "recheck").outcome, "critical");
    assert.equal(firstOf(struck.events, "damage").dealt, 8, "two dice and the 2");

    // A miss asks nobody.
    assert.equal(scimitar(state, "brenna", 5).state.window, undefined);
    // Somebody holding nothing for it is not asked either.
    const bare = snagsTurn([fighter("brenna"), snag()]);
    assert.equal(scimitar(bare, "brenna", 16, 4).state.window, undefined);
  }

  // ── Uncanny Dodge: an answer that halves this one attack's harm ──
  {
    const state = snagsTurn([fighter("brenna", ["uncanny-dodge"]), snag()]);
    const dodged = answer(scimitar(state, "brenna", 16).state, "brenna", "Uncanny Dodge", 6);
    assert.deepEqual(eventsOf(dodged.events, "recheck"), [], "no defense changed");
    assert.equal(firstOf(dodged.events, "damage").dealt, 4, "6 + 2 halved");
    assert.ok(!rulesetCombatant(dodged.state, "brenna")!.tracked.some((entry) => entry.condition === "evading"));
    assert.equal(
      rulesetAnswerDeflects(
        fiveE,
        scimitar(state, "brenna", 16).state,
        rulesetCombatant(state, "brenna")!,
        idOf(state, "brenna", "Uncanny Dodge"),
      ),
      null,
      "an answer that changes no defense is weighed as anything else is",
    );
  }

  // ── A creature's Parry ──
  {
    const state = fight([fighter("brenna"), snag(true)]);
    const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword")!;
    // 7 and +7 is 14 against 13: a hit Snag may parry.
    const held = act(state, { actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 7);
    assert.deepEqual(held.state.window?.waiting, ["snag"]);
    const snagNow = rulesetCombatant(held.state, "snag")!;
    assert.equal(
      rulesetAnswerDeflects(fiveE, held.state, snagNow, idOf(state, "snag", "Parry")),
      true,
      "14 against 15",
    );
    const parried = answer(held.state, "snag", "Parry");
    assert.equal(firstOf(parried.events, "recheck").outcome, "miss");
    assert.deepEqual(firstOf(parried.events, "recheck").guards, [{ condition: "parrying", value: 2 }]);
    // One attack: spent by the one it answered.
    assert.ok(
      eventsOf(parried.events, "condition").some((event) => event.condition === "parrying" && event.reason === "spent"),
    );
    assert.equal(parried.state.order[parried.state.turn], "brenna", "and the turn is still Brenna's");
    // 10 and +7 is 17: the Parry could not turn it, and the picker's check says so.
    const beaten = act(state, { actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 10);
    assert.equal(
      rulesetAnswerDeflects(fiveE, beaten.state, rulesetCombatant(beaten.state, "snag")!, idOf(state, "snag", "Parry")),
      false,
    );
    // A held attack that is held together while it lasts is not started a second time once it is
    // picked up: whatever it did before the hold has happened.
    const caster = fight([fighter("brenna", ["hex-bolt"]), snag(true)]);
    const bolt = rulesetCombatant(caster, "brenna")!.actions.find((action) => action.label === "Hex Bolt")!;
    // Exactly Snag's 13, so a Parry turns it.
    const cast = act(caster, { actorId: "brenna", optionId: bolt.id, targetIds: ["snag"] }, 13 - bolt.toHit!);
    assert.equal(firstOf(cast.events, "concentration").state, "started");
    assert.deepEqual(cast.state.window?.waiting, ["snag"]);
    const turned = answer(cast.state, "snag", "Parry");
    assert.equal(firstOf(turned.events, "recheck").outcome, "miss");
    assert.deepEqual(eventsOf(turned.events, "concentration"), [], "not started again");
    assert.equal(rulesetCombatant(turned.state, "brenna")!.concentrating?.actionId, bolt.id);

    // Nobody but the one hit is asked about it, and not somebody who is not being asked at all.
    assert.equal(
      rulesetAnswerDeflects(fiveE, state, rulesetCombatant(state, "snag")!, idOf(state, "snag", "Parry")),
      null,
    );
  }

  // ── A creature out of a bestiary keeps its reaction ──
  // Named the way a Game Master names one, so it is read out of the catalog rather than written as a
  // block: the reference's Toll Sergeant still parries on the moment, on itself, and never on its turn.
  {
    const bestiary = Object.fromEntries((fiveE.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
    const state = createRulesetEncounter({
      definition: fiveE,
      seed: 5,
      combatants: [
        fighter("brenna"),
        {
          id: "sergeant",
          name: "Toll Sergeant",
          side: "enemy",
          creature: { catalogId: "creatures", entryId: "toll-sergeant" },
        },
      ],
      bestiary,
      roller: dice(20, 1),
    });
    const parryAction = rulesetCombatant(state, "sergeant")!.actions.find((action) => action.label === "Parry")!;
    assert.deepEqual(parryAction.reaction, { on: "hit", at: "source" });
    assert.deepEqual(parryAction.targets, { side: "self", count: 0 });
    const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword")!;
    // 11 and +7 is 18 against its 17: a hit it may parry.
    const held = act(state, { actorId: "brenna", optionId: sword.id, targetIds: ["sergeant"] }, 11);
    assert.deepEqual(held.state.window?.waiting, ["sergeant"]);
    const parried = answer(held.state, "sergeant", "Parry");
    assert.equal(firstOf(parried.events, "recheck").outcome, "miss", "18 against 19");
    const sergeantsTurn = endTurn(state, "brenna");
    assert.ok(
      !rulesetCombatOptions(fiveE, sergeantsTurn, "sergeant").some((option) => option.label === "Parry"),
      "a reaction is not on its own turn's menu",
    );
  }

  // ── An action made of others: held at each part, and nothing done twice ──
  {
    const state = snagsTurn([fighter("brenna", ["shield"]), snag()]);
    const first = act(state, { actorId: "snag", optionId: "twin", targetIds: ["brenna"] }, 16);
    const firstHeld = first.state.window?.resume?.kind === "action" ? first.state.window.resume.held : undefined;
    assert.equal(firstHeld?.part, 0);
    assert.equal(first.state.window?.trigger.kind === "hit" && first.state.window.trigger.optionId, "scimitar");
    // Let the first go: its damage, then the second cut is rolled, hits, and is held in its turn.
    const second = pass(first.state, "brenna", 4, 17);
    assert.equal(eventsOf(second.events, "attack").length, 1, "only the second cut is rolled");
    assert.equal(firstOf(second.events, "damage").dealt, 6);
    const secondHeld = second.state.window?.resume?.kind === "action" ? second.state.window.resume.held : undefined;
    assert.equal(secondHeld?.part, 1);
    assert.deepEqual(secondHeld?.hurt, ["brenna"], "whoever it had already hurt travels with it");
    const shielded = answer(second.state, "brenna", "Shield");
    assert.equal(firstOf(shielded.events, "recheck").outcome, "miss");
    assert.equal(eventsOf(shielded.events, "attack").length, 0, "and nothing is rolled again");
    assert.equal(shielded.state.window, undefined);
  }

  // ── Several targets: the rest after the held one, and being hurt asked about once it is all done ──
  {
    // Corwin is hit first and holds something for being hurt; Brenna is hit second and holds Shield.
    const state = snagsTurn([fighter("corwin", ["flinch"]), fighter("brenna", ["shield"]), snag()]);
    const swept = act(state, { actorId: "snag", optionId: "sweep", targetIds: ["corwin", "brenna"] }, 15, 3, 16);
    assert.equal(firstOf(swept.events, "damage").targetId, "corwin");
    const held = swept.state.window?.resume?.kind === "action" ? swept.state.window.resume.held : undefined;
    assert.deepEqual([held?.targetId, held?.rest, held?.hurt], ["brenna", [], ["corwin"]]);
    // Being hurt is not asked about yet: the action is not over.
    assert.equal(swept.state.window?.trigger.kind, "hit");
    const after = pass(swept.state, "brenna", 4);
    assert.equal(after.state.window?.trigger.kind, "harmed");
    assert.deepEqual(after.state.window?.waiting, ["corwin"], "Corwin, hurt before the hold, is asked now");

    // Held on the FIRST target, the rest are rolled after the answer.
    const early = snagsTurn([fighter("brenna", ["shield"]), fighter("corwin"), snag()]);
    const heldFirst = act(early, { actorId: "snag", optionId: "sweep", targetIds: ["brenna", "corwin"] }, 16);
    assert.deepEqual(
      heldFirst.state.window?.resume?.kind === "action" ? heldFirst.state.window.resume.held?.rest : undefined,
      ["corwin"],
    );
    const rest = answer(heldFirst.state, "brenna", "Shield", 12);
    assert.deepEqual(
      eventsOf(rest.events, "attack").map((event) => [event.targetId, event.outcome]),
      [["corwin", "miss"]],
      "Corwin's roll is made after Brenna answered",
    );
  }

  // ── Saved while the window is open, it comes back the same ──
  {
    const state = snagsTurn([fighter("brenna", ["shield"]), snag()]);
    const held = act(state, { actorId: "snag", optionId: "twin", targetIds: ["brenna"] }, 16);
    const saved = JSON.parse(JSON.stringify(held.state)) as RulesetEncounterState;
    assert.deepEqual(pass(saved, "brenna", 4, 17).events, pass(held.state, "brenna", 4, 17).events);
    assert.deepEqual(pass(saved, "brenna", 4, 17).state, pass(held.state, "brenna", 4, 17).state);
  }

  // ── Nothing is held inside a window ──
  {
    // Snag answers being hurt with a cut back at Brenna, who holds Shield: that cut is made inside a
    // window, so it is not held, and it lands.
    const retorting: RulesetCombatantInput = {
      ...snag(),
      block: {
        ...(snag() as { block: RulesetStatBlock }).block,
        actions: [
          ...(snag() as { block: RulesetStatBlock }).block.actions,
          {
            id: "retort",
            name: "Retort",
            budget: "reaction",
            toHit: 4,
            damage: { count: 1, sides: 6, flat: 2 },
            reaction: { on: "harmed" },
          },
        ],
      } as RulesetStatBlock,
    };
    const state = fight([fighter("brenna", ["shield"]), retorting]);
    const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword")!;
    const hurt = act(state, { actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 15, 4);
    assert.equal(hurt.state.window?.trigger.kind, "harmed");
    const back = answer(hurt.state, "snag", "Retort", 16, 4);
    assert.equal(firstOf(back.events, "attack").outcome, "hit");
    assert.equal(firstOf(back.events, "damage").targetId, "brenna", "it lands without asking her");
    assert.equal(back.state.window, undefined);
  }

  // ── What the screen says ──
  {
    const t = ((key: string, params: Record<string, unknown> = {}) =>
      (english[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""))) as never;
    const state = snagsTurn([fighter("brenna", ["shield"]), snag()]);
    const view = { combatants: state.combatants.map((one) => ({ id: one.id, name: one.name })) } as never;
    const names = rulesetCombatNames(fiveE, view, t);
    const held = scimitar(state, "brenna", 16);
    assert.equal(
      rulesetCombatEventLine(firstOf(held.events, "window"), names, t),
      "Snag hits Brenna with Scimitar: 20 against Armor Class 18. Brenna may answer.",
    );
    const shielded = answer(held.state, "brenna", "Shield");
    assert.equal(
      rulesetCombatEventLine(firstOf(shielded.events, "recheck"), names, t),
      "Against Armor Class 23 (from 18: Shielded + 5), Snag's Scimitar now misses Brenna.",
    );
    // A guard whose name carries its number says it once (#8273: "Parrying (+2) + 2").
    const recheck = firstOf(shielded.events, "recheck");
    assert.equal(
      rulesetCombatEventLine(
        {
          ...recheck,
          defense: 17,
          unguarded: 15,
          guards: [{ ...recheck.guards![0]!, condition: "Parrying (+2)", item: true, value: 2 }],
        },
        names,
        t,
      ),
      "Against Armor Class 17 (from 15: Parrying (+2)), Snag's Scimitar now misses Brenna.",
    );
    // With no base carried (a pool's clamped need), only what raised it is said.
    const { unguarded: _base, ...bare } = recheck;
    assert.equal(
      rulesetCombatEventLine(bare, names, t),
      "Against Armor Class 23 (Shielded + 5), Snag's Scimitar now misses Brenna.",
    );
    assert.equal(
      english["game.combat.ruleset.menu.windowHit"],
      "{{mover}} hits {{name}} with {{label}}: {{total}} against {{defense}}.",
    );
  }

  // ── Every new key needs 1.46 to install ──
  {
    assert.ok(supportedCapabilityApi.minor >= 46);
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json", "catalogs/extra.json"] } },
      }) as never;
    const issue =
      /reactions answer being hit, or whose creatures react or act on themselves, requires schemaVersion 2 and capabilityApi 1\.46 or newer/;
    const cases: Array<[string, unknown, Map<string, unknown>?]> = [
      [
        "an entry on the hit moment",
        { catalogs: [{ id: "k", entries: [{ id: "a", mechanics: { reaction: { on: "hit" } } }] }] },
      ],
      [
        "a creature's reaction",
        { catalogs: [{ id: "c", entries: [{ id: "a", creature: { actions: [{ reaction: { on: "aimed" } }] } }] }] },
      ],
      [
        "a creature acting on itself",
        { catalogs: [{ id: "c", entries: [{ id: "a", creature: { actions: [{ self: true }] } }] }] },
      ],
      [
        "a catalog file",
        { catalogs: [{ id: "k", asset: "catalogs/extra.json" }] },
        new Map<string, unknown>([
          [
            "catalogs/extra.json",
            { schemaVersion: 1, catalog: "k", entries: [{ id: "a", mechanics: { reaction: { on: "hit" } } }] },
          ],
        ]),
      ],
    ];
    for (const [what, ruleset, assets] of cases) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(45), ruleset as never, assets as never) ?? "",
        issue,
        what,
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(46), ruleset as never, assets as never), null, what);
    }
    // A moment 1.44 already knew is still only 1.44's.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(45), {
        catalogs: [{ id: "k", entries: [{ id: "a", mechanics: { reaction: { on: "used" } } }] }],
      } as never),
      null,
    );
  }

  console.info("game ruleset combat hit regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
