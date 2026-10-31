/**
 * Counter-the-counter: a spell taken as an answer is itself something the other side may answer.
 *
 *   - Corwin counters the mage's bolt: his Counter is paid for and held, and the mage is asked.
 *   - The mage counters his Counter: it never happens, the log says with what, and the bolt lands.
 *   - The mage lets it through: Corwin's Counter is taken as he chose it, and the bolt never lands.
 *   - With no reaction left to answer with, nobody is asked and it is taken at once, as before.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-counter-counter-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
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

  const counterReaction = (extra: Record<string, unknown> = {}) => ({
    on: "used",
    cancels: true,
    against: { catalogs: ["spells"] },
    upTo: "paid",
    above: { check: { abilityModFromField: "spellcasting_ability" }, dc: 10 },
    ...extra,
  });
  const spells = (reaction: Record<string, unknown> = counterReaction()): RulesetCatalogEntry[] =>
    [
      {
        id: "bolt",
        label: "Bolt",
        rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
        mechanics: {
          kind: "attack",
          autoHit: true,
          amount: { flat: 3 },
          damageType: "fire",
          cost: [{ pool: "slots_1", amount: 1 }],
          perCostStep: { flat: 1 },
        },
      },
      {
        id: "counter",
        label: "Counter",
        rows: [{ list: "spells", values: { name: "Counter", level: 3, prepared: true } }],
        mechanics: {
          kind: "utility",
          budget: "reaction",
          cost: [{ pool: "slots_3", amount: 1 }],
          reaction,
        },
      },
    ] as unknown as RulesetCatalogEntry[];
  const caster = (entries: RulesetCatalogEntry[], abilities: Record<string, number>) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, con: 12, wis: 12, cha: 10, ...abilities },
      fields: {
        level: 9,
        ac: 12,
        speed: 30,
        hp_max: 40,
        spellcasting_ability: "int",
        slots_max_1: 4,
        slots_max_2: 3,
        slots_max_3: 3,
        slots_max_4: 3,
        slots_max_5: 1,
      },
      lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  /** The mage first, and Corwin, who answers it: Int 18, so +4 on the check. */
  const fight = (definition: RulesetDefinition, entries = spells()): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells: entries },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: { sheet: caster(entries, { dex: 20, int: 16 }), actions: [] },
        } as RulesetCombatantInput,
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: caster(entries, { dex: 1, int: 18 }),
          live: {},
          catalogs: { spells: entries },
        },
      ],
    });
  const definition = parsedOrThrow(fiveE(), "the 5e example");
  const bolt = (state: RulesetEncounterState, payWith?: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((entry) => entry.label === "Bolt");
    assert.ok(option, "the mage has its bolt");
    const held = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["corwin"], ...(payWith ? { payWith } : {}) },
      dice(),
    );
    assert.ok(held.state.window, JSON.stringify(held.events));
    return held;
  };
  const passFor = (step: { state: RulesetEncounterState; events: RulesetCombatEvent[] }, who: string) => {
    const window = step.state.window!;
    assert.equal(window.waiting[0], who, `${who} is asked`);
    const next = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: who, optionId: RULESET_PASS_OPTION, targetIds: [], window: window.id },
      dice(),
    );
    return { state: next.state, events: [...step.events, ...next.events] };
  };
  const counterBy = (
    step: { state: RulesetEncounterState; events: RulesetCombatEvent[] },
    who: string,
    payWith?: string,
  ) => {
    const window = step.state.window!;
    assert.equal(window.waiting[0], who, `${who} is asked`);
    const option = rulesetWindowOptions(definition, step.state, who).find((entry) => entry.label === "Counter");
    assert.ok(option, `${who} may counter`);
    const next = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: who, optionId: option.id, targetIds: [], window: window.id, ...(payWith ? { payWith } : {}) },
      dice(),
    );
    return { state: next.state, events: [...step.events, ...next.events] };
  };

  // ── Corwin's Counter is held while the mage is asked about it ──
  {
    const asked = counterBy(bolt(fight(definition)), "corwin");
    const window = asked.state.window!;
    assert.equal(window.trigger.kind, "used");
    assert.equal(window.resume?.kind, "answer", "his answer is what is held");
    assert.ok(window.outer, "the bolt's window waits behind it");
    assert.deepEqual(eventsOf(asked.events, "cancelled"), [], "nothing is stopped yet");
    assert.ok(
      eventsOf(asked.events, "spend").some((spend) => spend.actorId === "corwin" && spend.pool === "slots_3"),
      "his Counter is paid for as it is chosen",
    );

    // The mage counters it: Corwin's Counter never happens, and the bolt lands.
    const duel = counterBy(asked, "mage");
    const [stopped] = eventsOf(duel.events, "cancelled");
    assert.deepEqual(
      [stopped?.actorId, stopped?.label, stopped?.byId, stopped?.with],
      ["corwin", "Counter", "mage", "Counter"],
      "the log says what stopped what",
    );
    assert.equal(eventsOf(duel.events, "cancelled").length, 1, "only his Counter is stopped");
    assert.equal(eventsOf(duel.events, "damage")[0]?.targetId, "corwin", "the bolt lands");
    assert.equal(duel.state.window, undefined);

    // The mage lets it through: Corwin's Counter is taken, and the bolt never lands.
    const through = passFor(asked, "mage");
    const [cancelled] = eventsOf(through.events, "cancelled");
    assert.deepEqual([cancelled?.actorId, cancelled?.label, cancelled?.byId], ["mage", "Bolt", "corwin"]);
    assert.deepEqual(eventsOf(through.events, "damage"), []);
    assert.equal(through.state.window, undefined);
  }

  // ── No reaction left: nobody is asked ──
  {
    const held = bolt(fight(definition));
    rulesetCombatant(held.state, "mage")!.budgets.reaction = 0;
    const taken = counterBy(held, "corwin");
    assert.equal(taken.state.window, undefined, "nobody could answer it");
    assert.equal(eventsOf(taken.events, "cancelled")[0]?.label, "Bolt", "the bolt is stopped at once");
  }

  console.log(
    "Counter-the-counter: a Counter is held while the other side may counter it; stopped, the log says with what and what it answered lands; let through, it is taken as chosen; with no reaction left it is taken at once.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
