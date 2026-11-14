/** Creatures cast without slots and covens share their uses (Capability API 1.123). */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  parseRulesetDefinition,
  parseRulesetCatalogFile,
  rulesetBestiarySheetCatalogIds,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetCreatureSchema,
  rulesetOptionTargets,
  rulesetProposedStatBlock,
  rulesetProposedCreatureSchema,
  rulesetSheetBuildSchema,
  rulesetPaidLevel,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-innate-spells-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown> = {}) => ({
    id,
    label: id,
    rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      range: 60,
      budget: "action",
      autoHit: true,
      amount: { flat: 3 },
      cost: [{ pool: "slots_1", amount: 1 }],
      ...mechanics,
    },
  });
  const creature = () => ({
    id: "dryad",
    label: "Dryad",
    creature: {
      tier: "cr_5",
      health: 100,
      defense: 13,
      initiativeModifier: 20,
      actions: [{ id: "claw", name: "Claw", budget: "action", damage: { flat: 1 } }],
      spellcasting: {
        saveDifficulty: 14,
        toHit: 7,
        spells: [
          { entry: "spells/spark" },
          { entry: "spells/daily", uses: { per: "day", count: 1 } },
          { entry: "spells/bolt" },
          { entry: "spells/save" },
          { entry: "spells/scaled", level: 3 },
          { entry: "spells/heal" },
          { entry: "spells/self" },
        ],
      },
    },
  });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        spell("spark"),
        spell("daily"),
        spell("bolt", { autoHit: false, attackRoll: true }),
        spell("save", { autoHit: false, save: { save: "dex_save", onSuccess: "negates" } }),
        spell("scaled", { amount: { dice: "1d6", flat: 1 }, perCostStep: { dice: "1d6", flat: 2 } }),
        spell("heal", { kind: "heal", autoHit: false, amount: { flat: 7 } }),
        spell("self", { kind: "buff", autoHit: false, targets: "self", amount: undefined, temporary: { flat: 5 } }),
      ],
    });
    doc.catalogs.push({ id: "fey", label: "Fey", holds: "creatures", entries: [creature()] });
    edit(doc);
    return doc;
  };
  const casting = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].creature.spellcasting;
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
    const parsed = parseRulesetDefinition(fiveE(edit));
    assert.equal(parsed.ok, false, `must refuse ${pattern}`);
    if (!parsed.ok) assert.match(parsed.issues.join("; "), pattern);
  };
  const definition = parsedOrThrow(fiveE());
  const catalogs = (rules = definition) =>
    Object.fromEntries(rules.catalogs!.map((catalog) => [catalog.id, catalog.entries ?? []]));
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `ran out of dice for d${sides}`);
      const face = faces[index++]!;
      assert.ok(face >= 1 && face <= sides);
      return face;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const fight = (rules = definition, members = 1, board = false): RulesetEncounterState =>
    createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      bestiary: catalogs(rules),
      ...(board
        ? {
            board: {
              grid: { width: 20, height: 1, tiles: [Array.from({ length: 20 }, () => "plains")] },
              placements: {
                dryad: { x: 0, y: 0 },
                sister1: { x: 2, y: 0 },
                sister2: { x: 6, y: 0 },
                hero: { x: 4, y: 0 },
              },
            },
          }
        : {}),
      combatants: [
        ...Array.from({ length: members }, (_, i) => ({
          id: i === 0 ? "dryad" : `sister${i}`,
          name: "Dryad",
          side: "enemy" as const,
          creature: { catalogId: "fey", entryId: "dryad" },
        })),
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 13, hp_max: 300, speed: 30 },
          }),
          live: {},
        },
      ],
    });
  const actor = (state: RulesetEncounterState, id = "dryad") => rulesetCombatant(state, id)!;
  const option = (state: RulesetEncounterState, id: string, rules = definition, who = "dryad") =>
    rulesetCombatOptions(rules, state, who).find((entry) => entry.id === `spells/${id}`);
  const cast = (
    state: RulesetEncounterState,
    id: string,
    faces: number[] = [],
    rules = definition,
    who = "dryad",
    targetIds = ["hero"],
  ) => applyRulesetCombatChoice(rules, state, { actorId: who, optionId: `spells/${id}`, targetIds }, dice(...faces));
  const nextTurn = (state: RulesetEncounterState, rules = definition, who = "dryad") => {
    do {
      const result = applyRulesetCombatChoice(
        rules,
        state,
        { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] },
        dice(),
      );
      assert.deepEqual(eventsOf(result.events, "refused"), []);
      state = result.state;
    } while (state.order[state.turn] !== who);
    return state;
  };
  assert.equal(supportedCapabilityApi.major, 1);
  assert.ok(supportedCapabilityApi.minor >= 118);

  // At will means each turn, while limited uses survive a save and never refill on a turn.
  {
    let state = fight();
    const before = structuredClone(state);
    for (let turn = 0; turn < 3; turn++) {
      assert.equal(option(state, "spark")!.budget, "action");
      const result = cast(state, "spark");
      assert.deepEqual(eventsOf(result.events, "refused"), []);
      assert.deepEqual(
        eventsOf(result.events, "damage").map((event) => event.dealt),
        [3],
      );
      assert.equal(actor(result.state).budgets.action, 0);
      assert.equal(option(result.state, "spark"), undefined);
      assert.equal(option(state, "spark")!.cost, undefined);
      assert.equal(option(state, "spark")!.payWith, undefined);
      state = nextTurn(result.state);
    }
    assert.deepEqual(fight(), before, "resolution leaves its input alone");
    assert.equal(option(state, "daily")!.left, 1);
    state = nextTurn(cast(state, "daily").state);
    state = JSON.parse(JSON.stringify(state));
    assert.equal(actor(state).uses["spells/daily"], 0);
    assert.equal(option(state, "daily"), undefined);
    assert.equal(eventsOf(cast(state, "daily").events, "refused").length, 1);
  }
  {
    const hit = cast(fight(), "bolt", [6]);
    assert.equal(eventsOf(hit.events, "attack")[0]!.total, 13);
    assert.deepEqual(
      eventsOf(hit.events, "damage").map((event) => event.dealt),
      [3],
    );
    const miss = cast(fight(), "bolt", [5]);
    assert.equal(eventsOf(miss.events, "attack")[0]!.total, 12);
    assert.equal(eventsOf(miss.events, "damage").length, 0);
    assert.deepEqual(
      eventsOf(cast(fight(), "save", [13]).events, "damage").map((event) => event.dealt),
      [3],
    );
    assert.equal(
      eventsOf(cast(fight(), "save", [14]).events, "damage")[0]?.dealt ?? 0,
      0,
      JSON.stringify(cast(fight(), "save", [14]).events),
    );
    assert.deepEqual(
      eventsOf(cast(fight(), "scaled", [2, 3, 4]).events, "damage").map((event) => event.dealt),
      [14],
    );
    const state = fight();
    assert.equal(option(state, "scaled")!.forecast!.averageDamage, 15.5);
    assert.equal(
      rulesetPaidLevel(
        definition,
        actor(state),
        actor(state).actions.find((action) => action.id === "spells/scaled")!,
      ),
      3,
    );
    assert.equal(
      rulesetPaidLevel(
        definition,
        actor(state),
        actor(state).actions.find((action) => action.id === "spells/spark")!,
      ),
      1,
    );
    assert.deepEqual(rulesetOptionTargets(definition, state, "dryad", option(state, "heal")!), ["dryad"]);
    assert.deepEqual(rulesetOptionTargets(definition, state, "dryad", option(state, "self")!), ["dryad"]);
    actor(state).health!.value = 20;
    assert.equal(actor(cast(state, "heal", [], definition, "dryad", ["dryad"]).state).health!.value, 27);
    assert.equal(actor(cast(state, "self", [], definition, "dryad", ["dryad"]).state).health!.temp, 5);
  }

  // A pool fight forecasts the scaled dice as successes, with soak taken only once.
  {
    const doc = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../docs/examples/rulesets/gravewatch.json", import.meta.url)), "utf8"),
    );
    doc.catalogs.push({
      id: "innate",
      label: "Innate",
      feeds: ["charms"],
      entries: [
        {
          id: "spark",
          label: "Spark",
          rows: [{ list: "charms", values: { name: "Spark" } }],
          mechanics: {
            kind: "attack",
            budget: "act",
            autoHit: true,
            amount: { dice: "1d10", flat: 1 },
            cost: [{ pool: "resolve", amount: 1 }],
            perCostStep: { dice: "1d10", flat: 2 },
          },
        },
      ],
    });
    doc.catalogs.push({
      id: "fey",
      label: "Fey",
      holds: "creatures",
      entries: [
        {
          id: "dryad",
          label: "Dryad",
          creature: {
            tier: "nuisance",
            health: 100,
            defense: 1,
            initiativeModifier: 20,
            spellcasting: { spells: [{ entry: "innate/spark", level: 2 }] },
          },
        },
      ],
    });
    const rules = parsedOrThrow(doc);
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 6,
      bestiary: catalogs(rules),
      combatants: [
        { id: "dryad", name: "Dryad", side: "enemy", creature: { catalogId: "fey", entryId: "dryad" } },
        {
          id: "hero",
          name: "Hero",
          side: "enemy",
          block: { health: 100, defense: 1, initiativeModifier: -10, actions: [] },
        },
      ],
    });
    actor(state, "hero").side = "party";
    actor(state, "hero").soak = { all: 1 };
    const offered = rulesetCombatOptions(rules, state, "dryad").find((entry) => entry.id === "innate/spark")!;
    assert.equal(offered.forecast!.averageDamage, 6);
    const result = applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "dryad", optionId: offered.id, targetIds: ["hero"] },
      dice(6, 6, 6, 6),
    );
    assert.deepEqual(
      eventsOf(result.events, "damage").map((event) => event.dealt),
      [7],
    );
  }

  // A sheet supplies omitted casting numbers but never pays slots or points for these actions.
  {
    const rules = parsedOrThrow(
      fiveE((doc) => {
        doc.combat.abilities.reverse();
        doc.catalogs.at(-2).feeds.push("features");
        const creature = doc.catalogs.at(-1).entries[0].creature;
        delete creature.health;
        delete creature.defense;
        delete creature.initiativeModifier;
        delete creature.spellcasting.saveDifficulty;
        delete creature.spellcasting.toHit;
        creature.sheet = {
          abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 10, cha: 18 },
          fields: { level: 5, hp_max: 100, ac: 13, spellcasting_ability: "cha", slots_max_1: 3 },
        };
      }),
    );
    const state = fight(rules);
    const live = structuredClone(actor(state).sheet!.live);
    const save = actor(state).actions.find((action) => action.id === "spells/save")!;
    assert.equal(save.save!.difficulty, 15);
    assert.equal(actor(state).actions.find((action) => action.id === "spells/bolt")!.toHit, 7);
    const result = cast(state, "save", [14], rules);
    assert.deepEqual(eventsOf(result.events, "refused"), []);
    assert.deepEqual(
      eventsOf(result.events, "damage").map((event) => event.dealt),
      [3],
    );
    assert.deepEqual(actor(result.state).sheet!.live, live);
    const override = structuredClone(rules);
    override.catalogs!.at(-1)!.entries![0]!.creature!.spellcasting!.saveDifficulty = 19;
    override.catalogs!.at(-1)!.entries![0]!.creature!.spellcasting!.toHit = 11;
    const overridden = actor(fight(override));
    assert.equal(overridden.actions.find((action) => action.id === "spells/save")!.save!.difficulty, 19);
    assert.equal(overridden.actions.find((action) => action.id === "spells/bolt")!.toHit, 11);
  }

  // A coven counts standing members on its own side, within plain cell distance of the caster.
  const covenRules = parsedOrThrow(
    fiveE((doc) => {
      casting(doc).coven = { id: "sisters", size: 3, within: 30 };
      casting(doc).spells[1].coven = true;
    }),
  );
  {
    assert.equal(option(fight(covenRules, 2), "daily", covenRules), undefined);
    for (const board of [false, true]) {
      let state = fight(covenRules, 3, board);
      assert.equal(option(state, "daily", covenRules)!.left, 1);
      const result = cast(state, "daily", [], covenRules);
      assert.deepEqual(eventsOf(result.events, "refused"), []);
      assert.equal(result.state.covenUses!["sisters/spells/daily"], 0);
      assert.equal(actor(result.state).uses["spells/daily"], undefined);
      assert.equal(state.covenUses, undefined);
      state = JSON.parse(JSON.stringify(result.state));
      for (const who of ["sister1", "sister2", "dryad"]) {
        state = nextTurn(state, covenRules, who);
        assert.equal(option(state, "daily", covenRules, who), undefined);
        assert.equal(eventsOf(cast(state, "daily", [], covenRules, who).events, "refused").length, 1);
      }
    }
    for (const change of [
      (state: RulesetEncounterState) => {
        actor(state, "sister2").down = true;
      },
      (state: RulesetEncounterState) => {
        actor(state, "sister2").defeated = true;
      },
      (state: RulesetEncounterState) => {
        actor(state, "sister2").side = "party";
      },
      (state: RulesetEncounterState) => {
        actor(state, "sister2").block!.spellcasting!.coven!.id = "other";
      },
      (state: RulesetEncounterState) => {
        actor(state, "sister2").x = 7;
      },
    ]) {
      const state = fight(covenRules, 3, true);
      change(state);
      assert.equal(option(state, "daily", covenRules), undefined);
    }
    const elevated = fight(covenRules, 3, true);
    actor(elevated, "sister2").altitude = 100;
    assert.ok(option(elevated, "daily", covenRules), "coven range uses plain cell distance");
    const shorter = structuredClone(covenRules);
    shorter.catalogs!.at(-1)!.entries![0]!.creature!.spellcasting!.coven!.within = 29;
    assert.equal(option(fight(shorter, 3, true), "daily", shorter), undefined, "range is not rounded up beyond within");
    const state = fight(covenRules, 3);
    actor(state, "sister2").x = 19;
    assert.ok(option(state, "daily", covenRules), "no board means no distance gate");
  }

  // The catalog resolver still supplies areas, concentration, reactions and summoned strikes.
  {
    const rules = parsedOrThrow(
      fiveE((doc) => {
        doc.catalogs.at(-2).entries.push(
          spell("weapon", {
            budget: "bonus",
            amount: { dice: "1d6" },
            perCostStep: { dice: "1d6" },
            concentration: true,
            summons: { budget: "bonus", rounds: 2, move: 20, reach: 5 },
          }),
        );
        casting(doc).spells.push({ entry: "spells/weapon", level: 2, uses: { per: "day", count: 1 } });
      }),
    );
    const made = cast(fight(rules), "weapon", [2, 3], rules);
    assert.deepEqual(
      eventsOf(made.events, "damage").map((event) => event.dealt),
      [5],
    );
    assert.equal(eventsOf(made.events, "concentration").length, 1);
    assert.equal(actor(made.state).budgets.bonus, 0);
    assert.equal(actor(made.state).budgets.action, 1);
    let state = nextTurn(JSON.parse(JSON.stringify(made.state)), rules);
    assert.equal(option(state, "weapon", rules), undefined);
    const strike = rulesetCombatOptions(rules, state, "dryad").find((entry) => entry.id === "summon:spells/weapon");
    assert.ok(strike);
    const result = applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "dryad", optionId: strike.id, targetIds: ["hero"] },
      dice(3, 4),
    );
    assert.deepEqual(
      eventsOf(result.events, "damage").map((event) => event.dealt),
      [7],
    );
    assert.equal(actor(result.state).uses["spells/weapon"], 0);
    state = nextTurn(result.state, rules);
    state = nextTurn(state, rules);
    assert.equal(actor(state).summons?.length ?? 0, 0);
  }
  {
    const rules = parsedOrThrow(
      fiveE((doc) => {
        doc.catalogs.at(-2).entries.push(spell("burst", { area: { shape: "burst", size: 5 }, friendlyFire: false }));
        casting(doc).spells.push({ entry: "spells/burst" });
      }),
    );
    const state = fight(rules, 1, true);
    const result = applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "dryad", optionId: "spells/burst", targetIds: [], at: { x: 4, y: 0 } },
      dice(),
    );
    assert.deepEqual(eventsOf(result.events, "refused"), []);
    assert.deepEqual(
      eventsOf(result.events, "damage").map((event) => event.targetId),
      ["hero"],
    );
    assert.deepEqual(option(state, "burst", rules)!.area, { shape: "burst", size: 1, range: 12 });
  }
  for (const against of [{ entries: ["spells/spark"] }, { catalogs: ["spells"] }]) {
    const rules = parsedOrThrow(
      fiveE((doc) => {
        doc.catalogs.at(-2).entries.push(
          spell("answer", {
            kind: "utility",
            amount: undefined,
            autoHit: false,
            budget: "reaction",
            reaction: { on: "used", at: "source", cancels: true, against },
          }),
        );
        casting(doc).spells.push({ entry: "spells/answer", uses: { per: "day", count: 1 } });
      }),
    );
    const state = fight(rules);
    const hero = actor(state, "hero");
    hero.actions.push({ ...actor(state).actions.find((action) => action.id === "spells/spark")! });
    state.turn = state.order.indexOf("hero");
    const held = cast(state, "spark", [], rules, "hero", ["dryad"]);
    assert.equal(held.state.window?.trigger.kind, "used");
    const answer = rulesetWindowOptions(rules, held.state, "dryad").find((entry) => entry.id === "spells/answer");
    assert.ok(answer);
    const result = applyRulesetCombatChoice(
      rules,
      held.state,
      { actorId: "dryad", optionId: answer.id, targetIds: [], window: held.state.window!.id },
      dice(),
    );
    assert.equal(eventsOf(result.events, "cancelled").length, 1);
    assert.equal(actor(result.state).uses["spells/answer"], 0);
  }

  {
    const rules = parsedOrThrow(
      fiveE((doc) => {
        doc.catalogs.at(-2).entries.push(
          spell("guard", {
            kind: "utility",
            amount: undefined,
            autoHit: false,
            standard: { actions: ["dodge"], budget: "bonus" },
          }),
        );
        casting(doc).coven = { id: "sisters", size: 3, within: 30 };
        casting(doc).spells.push({ entry: "spells/guard", coven: true, uses: { per: "day", count: 1 } });
      }),
    );
    const state = fight(rules, 3);
    const guard = rulesetCombatOptions(rules, state, "dryad").find((entry) => entry.id === "standard:dodge@bonus");
    assert.ok(guard);
    const result = applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "dryad", optionId: guard.id, targetIds: [] },
      dice(),
    );
    assert.deepEqual(eventsOf(result.events, "refused"), []);
    assert.equal(result.state.covenUses!["sisters/spells/guard"], 0);
    assert.equal(
      rulesetCombatOptions(rules, nextTurn(result.state, rules, "sister1"), "sister1").some(
        (entry) => entry.id === guard.id,
      ),
      false,
    );
    assert.equal(
      rulesetCombatOptions(rules, fight(rules, 2), "dryad").some((entry) => entry.id === guard.id),
      false,
    );
  }

  // Catalog loading and the proposal clamp carry the declaration without sharing mutable data.
  {
    assert.deepEqual(rulesetBestiarySheetCatalogIds(definition, { fey: catalogs().fey! }), ["spells"]);
    assert.deepEqual(rulesetBestiarySheetCatalogIds(definition, catalogs()), []);
    const entry = catalogs().fey![0]!;
    const block = rulesetCreatureBlock(definition, entry)!;
    block.spellcasting!.spells[0]!.entry = "spells/daily";
    assert.equal(entry.creature!.spellcasting!.spells[0]!.entry, "spells/spark");
    const proposed = rulesetProposedStatBlock(definition, entry.creature!)!;
    for (const rules of [definition, { ...definition, combat: { ...definition.combat!, threat: undefined } }]) {
      const clamped = clampRulesetStatBlock(rules, proposed, "cr_5");
      assert.equal(clamped.block.spellcasting, undefined);
      assert.ok(clamped.adjusted.some((note) => /Spellcasting.*dropped/.test(note)));
    }
    assert.ok(proposed.spellcasting);
  }

  // Check the declaration's bound without catalog errors masking an oversized list.
  {
    const entry = creature();
    assert.ok(rulesetProposedCreatureSchema.safeParse({ ...entry.creature, actions: [] }).success);
    entry.creature.spellcasting.spells = Array.from({ length: 61 }, (_, i) => ({ entry: `spells/s${i}` }));
    assert.equal(rulesetCreatureSchema.safeParse(entry.creature).success, false);
  }

  refused((doc) => {
    casting(doc).coven = { id: "sisters", size: 3, within: 30, extra: true };
    casting(doc).spells[0].coven = true;
  }, /extra/);

  // Import refusals, including references whose catalog entries live in another file.
  refused((doc) => {
    casting(doc).spells[0].coven = true;
  }, /coven spell needs/);
  refused((doc) => {
    casting(doc).coven = { id: "sisters", size: 3, within: 30 };
  }, /needs at least one coven spell/);
  refused((doc) => {
    casting(doc).spells.push(casting(doc).spells[0]);
  }, /Duplicate spell entry/);
  refused((doc) => {
    casting(doc).spells[0].entry = "missing/spark";
  }, /Unknown spell catalog/);
  refused((doc) => {
    casting(doc).spells[0].entry = "spells/missing";
  }, /Unknown spell entry/);
  refused((doc) => {
    delete doc.catalogs.at(-2).entries[0].mechanics;
  }, /needs mechanics/);
  refused((doc) => {
    delete casting(doc).toHit;
  }, /needs spellcasting.toHit/);
  refused((doc) => {
    delete casting(doc).saveDifficulty;
  }, /needs spellcasting.saveDifficulty/);
  for (const mechanics of [
    {
      kind: "attack",
      budget: "action",
      amount: { flat: 1 },
      plus: [{ flat: 1, save: { save: "dex_save", onSuccess: "none" } }],
    },
    {
      kind: "debuff",
      budget: "action",
      applies: [{ condition: "poisoned", duration: "until-save", saveEnds: { save: "con_save", at: "turn-end" } }],
    },
  ])
    refused((doc) => {
      casting(doc).spells = [{ entry: "spells/spark" }];
      delete casting(doc).saveDifficulty;
      doc.catalogs.at(-2).entries[0].mechanics = mechanics;
    }, /needs spellcasting.saveDifficulty/);
  parsedOrThrow(
    fiveE((doc) => {
      casting(doc).spells = [{ entry: "spells/spark", level: 0 }];
      delete casting(doc).saveDifficulty;
      delete casting(doc).toHit;
    }),
  );
  for (const [key, value] of [
    ["saveDifficulty", 0],
    ["saveDifficulty", 61],
    ["saveDifficulty", 1.5],
    ["toHit", -51],
    ["toHit", 101],
    ["toHit", 1.5],
    ["extra", true],
  ] as const) {
    refused((doc) => {
      casting(doc)[key] = value;
    }, /spellcasting/);
  }
  for (const value of [-1, 21, 1.5])
    refused((doc) => {
      casting(doc).spells[0].level = value;
    }, /level/);
  for (const value of ["spark", "spells/spark/extra", ""])
    refused((doc) => {
      casting(doc).spells[0].entry = value;
    }, /entry/);
  for (const value of [[], Array.from({ length: 61 }, (_, i) => ({ entry: `spells/s${i}` }))])
    refused((doc) => {
      casting(doc).spells = value;
    }, /spells/);
  for (const value of [
    { per: "rest", count: 1 },
    { per: "day", count: 0 },
    { per: "day", count: 21 },
    { per: "day", count: 1.5 },
    { per: "day", count: 1, extra: true },
  ])
    refused((doc) => {
      casting(doc).spells[0].uses = value;
    }, /uses/);
  for (const value of [
    { id: "bad/id", size: 3, within: 30 },
    { id: "s", size: 1, within: 30 },
    { id: "s", size: 7, within: 30 },
    { id: "s", size: 2.5, within: 30 },
    { id: "s", size: 3, within: 0 },
  ])
    refused((doc) => {
      casting(doc).coven = value;
      casting(doc).spells[0].coven = true;
    }, /coven/);
  refused((doc) => {
    casting(doc).spells[0].coven = false;
  }, /coven/);
  refused((doc) => {
    casting(doc).spells[0].extra = true;
  }, /extra/);
  parsedOrThrow(
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].creature.actions = [];
    }),
  );

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-innate",
    name: "Innate spells",
    version: "0.1.0",
    description: "Creatures cast without slots.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json", "catalogs/fey.json", "catalogs/spells.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  for (const file of [false, true]) {
    const doc = fiveE();
    const files = new Map<string, unknown>();
    if (file)
      for (const header of doc.catalogs.slice(-2)) {
        files.set(`catalogs/${header.id}.json`, { schemaVersion: 1, catalog: header.id, entries: header.entries });
        delete header.entries;
        header.asset = `catalogs/${header.id}.json`;
      }
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(122) as any, doc, files),
      "A ruleset whose creatures cast spells without slots requires schemaVersion 2 and capabilityApi 1.123 or newer",
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(123) as any, doc, files), null);
    if (file) {
      const parsed = parsedOrThrow(doc);
      assert.ok(parseRulesetCatalogFile(parsed, "fey", files.get("catalogs/fey.json")).ok);
      (files.get("catalogs/spells.json") as any).entries.shift();
      assert.match(getCapabilityPackageInstallIssue(manifest(123) as any, doc, files)!, /Unknown spell entry/);
    }
  }
  assert.equal(getCapabilityPackageInstallIssue(manifest(122) as any, JSON.parse(fiveEText)), null);

  // Both import boundaries read references after every catalog file has been checked.
  {
    const { readRulesetPackageFile } = await import("../../../../packages/server/src/services/game/ruleset-package-file.js");
    const { createGameRulesetsStorage } =
      await import("../../../../packages/server/src/services/storage/game-rulesets.storage.js");
    const { getDB, closeDB } = await import("../../../../packages/server/src/db/connection.js");
    const storage = createGameRulesetsStorage(await getDB());
    try {
      for (const fault of ["missing", "mechanics", "dc", "hit", "valid"]) {
        const doc = fiveE();
        if (fault === "missing") doc.catalogs.at(-2).entries.shift();
        if (fault === "mechanics") delete doc.catalogs.at(-2).entries[0].mechanics;
        if (fault === "dc") delete casting(doc).saveDifficulty;
        if (fault === "hit") delete casting(doc).toHit;
        const files: Record<string, string> = {};
        for (const header of doc.catalogs.slice(-2)) {
          files[header.id] = JSON.stringify({ schemaVersion: 1, catalog: header.id, entries: header.entries });
          delete header.entries;
          header.asset = `catalogs/${header.id}.json`;
        }
        const documents = {
          "ruleset.json": JSON.stringify(doc),
          ...Object.fromEntries(Object.entries(files).map(([id, text]) => [`catalogs/${id}.json`, text])),
        };
        const declared = {
          ...manifest(123),
          files: Object.entries(documents).map(([path, text]) => ({
            path,
            bytes: Buffer.byteLength(text),
            sha256: createHash("sha256").update(text).digest("hex"),
          })),
        };
        const result = readRulesetPackageFile({
          format: "marinara-ruleset",
          version: 1,
          manifest: declared,
          files: Object.fromEntries(
            Object.entries(documents).map(([path, text]) => [path, Buffer.from(text).toString("base64")]),
          ),
        });
        assert.equal(result.ok, fault === "valid", JSON.stringify(result));
        const input = {
          rulesetId: `local/${doc.id}`,
          version: doc.version,
          sourceKind: "local" as const,
          definition: JSON.stringify(doc),
          catalogs: files,
        };
        const pattern =
          fault === "missing"
            ? /Unknown spell entry/
            : fault === "mechanics"
              ? /needs mechanics/
              : fault === "dc"
                ? /needs spellcasting.saveDifficulty/
                : /needs spellcasting.toHit/;
        if (fault === "valid") assert.equal((await storage.put(input)).status, "added");
        else {
          if (!result.ok) assert.match(result.issues.join("; "), pattern);
          await assert.rejects(storage.put(input), pattern);
        }
      }
    } finally {
      await closeDB();
    }
  }

  // A fight saved before 1.123 has none of the new keys and still resolves the same action.
  {
    const rules = parsedOrThrow(
      fiveE((doc) => {
        delete doc.catalogs.at(-1).entries[0].creature.spellcasting;
      }),
    );
    const state = fight(rules);
    assert.equal(state.covenUses, undefined);
    assert.equal(actor(state).block!.spellcasting, undefined);
    const choice = { actorId: "dryad", optionId: "claw", targetIds: ["hero"] };
    const original = applyRulesetCombatChoice(rules, state, choice, dice());
    const loaded = applyRulesetCombatChoice(rules, JSON.parse(JSON.stringify(state)), choice, dice());
    assert.deepEqual(loaded, original);
    assert.deepEqual(
      eventsOf(loaded.events, "damage").map((event) => event.dealt),
      [1],
    );
  }

  // The editor can express the coven pairing, bounds, and a creature with only spells.
  {
    const schema = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
    );
    let found = 0;
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.properties?.spellcasting && node.properties?.sheet) {
        found++;
        const casting = node.properties.spellcasting;
        assert.equal(casting.additionalProperties, false);
        assert.equal(casting.properties.spells.uniqueItems, true);
        assert.equal(casting.properties.spells.minItems, 1);
        assert.equal(casting.properties.spells.maxItems, 60);
        assert.deepEqual(casting.allOf[0].if, { required: ["coven"] });
        assert.deepEqual(casting.allOf[0].then.properties.spells.contains, { required: ["coven"] });
        assert.deepEqual(casting.allOf[0].else.properties.spells.items.not, { required: ["coven"] });
        assert.deepEqual(node.allOf.at(-1).else.anyOf[1], { required: ["spellcasting"] });
      }
      Object.values(node).forEach(visit);
    };
    visit(schema);
    assert.ok(found > 0);
  }
  console.log(
    "Innate spells: at will, limited uses, casting numbers and levels, covens, import, clamp, and 1.123 gate.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
