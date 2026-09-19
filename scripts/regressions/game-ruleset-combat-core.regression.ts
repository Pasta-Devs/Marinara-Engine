/**
 * Ruleset combat, slice C1: the `combat` block and the pure resolver behind it.
 *
 * What is pinned here:
 *   - The FORMAT is not shaped around one game system. Every rule below is proven twice: once on
 *     the 5e draft (a d20 against a defense, with lucky faces, criticals, saves, slots, conditions,
 *     concentration and death saves) and once on Ember Roads (two six-sided dice, no advantage, no
 *     lucky faces, no saves at all and one thing to do a turn).
 *   - Every name the block carries points at something the sheet declares, and at the right sort of
 *     thing: a pool, a field, a column of the list it names, a save, a condition, a track.
 *   - The menu is the only place legality lives. An ability whose price the sheet would refuse is
 *     not on it, and a choice that is not on it changes nothing and says why.
 *   - Every event carries the numbers it was decided by, so a log can print the arithmetic.
 *   - A party member's health, resources, conditions and concentration are the SHEET'S, written
 *     through `applyRulesetSheetOp`, so the fight and the sheet never disagree.
 *   - The state is plain JSON: a fight carried through `JSON.parse(JSON.stringify(...))` mid-battle
 *     resolves the next step identically.
 *   - Combat and the new `mechanics` keys are Capability API 1.26.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCatalogEntryIssues,
  rulesetCombatant,
  parseRulesetCombatDice,
  rulesetCombatOptions,
  rulesetCombatRoller,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
  rulesetHitChance,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogHeader,
  type RulesetCombatant,
  type RulesetCombatantInput,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");

/** One of the shipped examples, optionally edited first. */
const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return doc;
};
const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
/** The issues a document is refused with, as plain `path: message` lines. */
const refusal = (document: unknown): string => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(!parsed.ok, "this document was supposed to be refused");
  return parsed.issues.join("; ");
};
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

const fiveE = parsedOrThrow(variant(fiveEText), "the 5e example");
const ember = parsedOrThrow(variant(emberText), "the 2d6 example");

/** Dice written down in advance. Running out is a failure, so an extra roll nobody expected is
 *  caught where it happens rather than showing up as a wrong number later. */
function dice(...faces: number[]): RulesetCombatRoller {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
}

type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
  events.filter((event): event is EventOf<T> => event.type === type);
function firstOf<T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T> {
  const found = eventsOf(events, type)[0];
  assert.ok(found, `expected a "${type}" event, got ${events.map((event) => event.type).join(", ") || "nothing"}`);
  return found;
}

// ── The block, and what it refuses ──
{
  const combat = fiveE.combat!;
  assert.equal(combat.kind, "attack-vs-defense");
  assert.equal(combat.health.pool, "hp");
  assert.deepEqual(combat.defense, { field: "ac" });
  assert.deepEqual(combat.attackRoll.naturals, { max: "critical", min: "miss" });
  assert.equal(combat.attackRoll.critical, "double-dice");
  assert.deepEqual(
    combat.economy.budgets.map((budget) => [budget.id, budget.per, budget.count]),
    [
      ["action", "turn", 1],
      ["bonus", "turn", 1],
      ["reaction", "turn", 1],
    ],
  );
  assert.equal(combat.threat!.tiers.length, 9, "the scale an opponent is picked from, CR 0 to CR 5");
  assert.equal(fiveE.coverage.combat, false, "coverage stays honest until a fight really runs on it");

  // Nothing about the other example is shaped like this one.
  const rough = ember.combat!;
  assert.deepEqual(rough.attackRoll.dice, { count: 2, sides: 6 });
  assert.equal(rough.attackRoll.advantage, false);
  assert.deepEqual(rough.attackRoll.naturals, { max: "none", min: "none" });
  assert.equal(rough.attackRoll.critical, "none");
  assert.deepEqual(rough.defense, { derived: "guard" });
  assert.equal(rough.economy.budgets.length, 1);
  assert.equal(rough.dying, undefined, "a system may simply have you go down");
  assert.equal(rough.concentration, undefined);

  // A ruleset may carry both blocks: the bridge is what an Engine that cannot read `combat` falls
  // back to, and a fight that runs on `combat` never takes it.
  assert.ok(fiveE.battle && fiveE.combat);

  const withCombat = (edit: (combat: Record<string, any>) => void) =>
    variant(fiveEText, (doc) => edit(doc.combat as Record<string, any>));
  assert.match(refusal(withCombat((combat) => (combat.health.pool = "vigour"))), /Unknown live pool "vigour"/);
  assert.match(refusal(withCombat((combat) => (combat.health.pool = "counters"))), /not a live pool/);
  assert.match(refusal(withCombat((combat) => (combat.defense = { field: "armour" }))), /Unknown field "armour"/);
  assert.match(refusal(withCombat((combat) => (combat.defense = { field: "class" }))), /is not a number/);
  assert.match(
    refusal(withCombat((combat) => (combat.initiative.modifier = { derived: "reflexes" }))),
    /Unknown derived value "reflexes"/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.attackRoll.dice = { count: 2, sides: 10 }))),
    /Natural results need a single die/,
  );
  assert.match(
    refusal(withCombat((combat) => combat.economy.budgets.push({ id: "action", label: "Again", per: "turn" }))),
    /Duplicate budget id "action"/,
  );
  assert.match(refusal(withCombat((combat) => (combat.attacks[0].budget = "swing"))), /Unknown budget "swing"/);
  assert.match(refusal(withCombat((combat) => (combat.attacks[0].name = "title"))), /Unknown column "title"/);
  assert.match(
    refusal(withCombat((combat) => (combat.attacks[0].name = "proficient"))),
    /combat\.attacks\.0\.name: Must name a text column/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.attacks[0].damage.dice.column = "name"))),
    /Must name a dice column/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.attacks[0].toHit.proficiency.column = "bonus"))),
    /Must name a boolean column/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.attacks[0].toHit.ability.column = "damage"))),
    /Must name a enum column/,
  );
  assert.match(refusal(withCombat((combat) => (combat.abilities[0].onlyWhen = "level"))), /Must name a boolean column/);
  assert.match(
    refusal(withCombat((combat) => (combat.abilities[0].saveDifficulty = { derived: "spell_power" }))),
    /Unknown derived value "spell_power"/,
  );
  assert.match(
    refusal(withCombat((combat) => combat.conditions.push({ condition: "hexed", effects: ["cannot-act"] }))),
    /Unknown condition "hexed"/,
  );
  assert.match(
    refusal(withCombat((combat) => combat.conditions.push({ condition: "poisoned", effects: [] }))),
    /Duplicate condition "poisoned"/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.conditions[0].effects = ["hard-to-see"]))),
    /Invalid enum value/,
    "the effects are a closed list the kind implements",
  );
  assert.match(
    refusal(withCombat((combat) => (combat.conditions[5].failsSaves = ["luck_save"]))),
    /Unknown save "luck_save"/,
  );
  assert.match(refusal(withCombat((combat) => (combat.concentration.text = "focus"))), /Unknown live text "focus"/);
  assert.match(refusal(withCombat((combat) => (combat.concentration.save = "grit_save"))), /Unknown save "grit_save"/);
  assert.match(refusal(withCombat((combat) => (combat.dying.successes = "wounds"))), /Unknown track "wounds"/);
  assert.match(
    refusal(withCombat((combat) => (combat.dying.failures = combat.dying.successes))),
    /two different tracks/,
  );
  assert.match(refusal(withCombat((combat) => (combat.dying.condition = "dead"))), /Unknown condition "dead"/);
  assert.match(
    refusal(withCombat((combat) => (combat.threat.tiers[0].health = [12, 3]))),
    /lowest is above the highest/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.damageTypes = ["fire", "Fire"]))),
    /Duplicate damage type "Fire"/,
  );
  assert.match(refusal(withCombat((combat) => (combat.standard = ["dodge", "dodge"]))), /Duplicate standard action/);
  assert.match(refusal(withCombat((combat) => (combat.kind = "grid-tactics"))), /Invalid literal value/);
  assert.match(refusal(withCombat((combat) => (combat.reach = 5))), /Unrecognized key/);

  // A pool that counts up cannot be what a fight takes away.
  assert.match(
    refusal(
      variant(fiveEText, (doc) => {
        doc.sheet.live.pools.push({ id: "dread", label: "Dread", max: { const: 6 }, start: "empty" });
        doc.combat.health.pool = "dread";
      }),
    ),
    /"dread" starts empty, so it cannot be the health pool/,
  );
}

// ── The mechanics a fight reads, checked against the ruleset that declares them ──
{
  const header = (feeds: string[]): RulesetCatalogHeader =>
    ({ id: "spells", label: "Spells", feeds, entries: [] }) as unknown as RulesetCatalogHeader;
  const entry = (mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id: "test-entry",
      label: "Test entry",
      rows: [{ list: "spells", values: { name: "Test entry", level: 1 } }],
      mechanics: { kind: "attack", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const issues = (mechanics: Record<string, unknown>) =>
    rulesetCatalogEntryIssues(fiveE, header(["spells"]), [entry(mechanics)])
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

  assert.equal(issues({ targetCount: 3, autoHit: true, budget: "bonus" }), "");
  assert.match(issues({ budget: "swing" }), /Unknown budget "swing"/);
  assert.match(
    issues({ applies: [{ condition: "hexed", duration: "instant" }] }),
    /mechanics\.applies\.0\.condition: Unknown condition "hexed"/,
  );
  assert.match(
    issues({ applies: [{ condition: "prone", duration: "until-save", saveEnds: { save: "luck", at: "turn-end" } }] }),
    /Unknown save "luck"/,
  );
  // A save has to be rolled against something. With the abilities source's saveDifficulty gone, an
  // entry that asks for a save, its own or one that ends a condition, is refused rather than
  // quietly saved against nothing.
  const noDifficulty = structuredClone(fiveE);
  delete (noDifficulty.combat!.abilities![0]! as { saveDifficulty?: unknown }).saveDifficulty;
  const bare = (mechanics: Record<string, unknown>) =>
    rulesetCatalogEntryIssues(noDifficulty, header(["spells"]), [entry(mechanics)])
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
  assert.match(
    bare({ save: { save: "dex_save", onSuccess: "half" } }),
    /mechanics\.save: The combat abilities source for "spells" declares no saveDifficulty/,
  );
  assert.match(
    bare({ applies: [{ condition: "prone", duration: "until-save", saveEnds: { save: "str_save", at: "turn-end" } }] }),
    /mechanics\.applies: The combat abilities source for "spells" declares no saveDifficulty/,
  );
  assert.equal(bare({ targetCount: 2 }), "", "an entry that asks for no save needs none");
  assert.match(issues({ scales: { from: { derived: "power" }, table: [[1, 0]] } }), /Unknown derived value "power"/);
  assert.equal(issues({ scales: { from: { field: "level" }, table: [[1, 0]] } }), "");
  assert.equal(issues({ temporary: { dice: "1d4", flat: 4 } }), "");
  // A condition with nothing to end it would never come off again, so it is refused at import.
  assert.match(
    refusal(
      variant(fiveEText, (doc) => {
        doc.catalogs = [
          {
            id: "kit",
            label: "Kit",
            feeds: ["spells"],
            entries: [
              {
                id: "hex",
                label: "Hex",
                rows: [{ list: "spells", values: { name: "Hex", level: 1 } }],
                mechanics: { kind: "debuff", applies: [{ condition: "prone", duration: "until-save" }] },
              },
            ],
          },
        ];
      }),
    ),
    /"until-save" needs the save that ends it/,
  );
  // A ruleset with no action economy has no budget to check a `budget` against, so it carries it
  // and reads nothing, exactly as `reaction` is carried today.
  const noCombat = parsedOrThrow(
    variant(fiveEText, (doc) => delete doc.combat),
    "a ruleset without a combat block",
  );
  assert.equal(rulesetCatalogEntryIssues(noCombat, header(["spells"]), [entry({ budget: "anything" })]).length, 0);
}

// ── A party, a catalog of abilities and a handful of opponents ──

/** The 5e draft ships no catalog of its own, so the fight is given one here, exactly as a package
 *  would: every ability is a catalog entry, and a row on the sheet marked with where it came from. */
const spellEntries = [
  {
    id: "fire-bolt",
    label: "Fire Bolt",
    rows: [{ list: "spells", values: { name: "Fire Bolt", level: 0, prepared: false } }],
    mechanics: {
      kind: "attack",
      attackRoll: true,
      amount: { dice: "1d10" },
      damageType: "fire",
      scales: {
        from: { field: "level" },
        table: [
          [1, 0],
          [5, 1],
          [11, 2],
          [17, 3],
        ],
      },
    },
  },
  {
    id: "fireball",
    label: "Fireball",
    rows: [{ list: "spells", values: { name: "Fireball", level: 3, prepared: true } }],
    mechanics: {
      kind: "attack",
      amount: { dice: "8d6" },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
      targetCount: 3,
      cost: [{ pool: "slots_3", amount: 1 }],
      perCostStep: { dice: "1d6" },
    },
  },
  {
    id: "mending-light",
    label: "Mending Light",
    rows: [{ list: "spells", values: { name: "Mending Light", level: 1, prepared: true } }],
    mechanics: {
      kind: "heal",
      targets: "ally",
      amount: { dice: "1d8", flat: 4 },
      cost: [{ pool: "slots_1", amount: 1 }],
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
  {
    id: "ward",
    label: "Ward",
    rows: [{ list: "spells", values: { name: "Ward", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      temporary: { dice: "1d4", flat: 4 },
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
  {
    id: "spirit-lash",
    label: "Spirit Lash",
    rows: [{ list: "spells", values: { name: "Spirit Lash", level: 0, prepared: false } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      attackRoll: true,
      amount: { dice: "1d6" },
      damageType: "radiant",
      budget: "bonus",
    },
  },
  {
    id: "slumber",
    label: "Slumber",
    rows: [{ list: "spells", values: { name: "Slumber", level: 1, prepared: false } }],
    mechanics: {
      kind: "debuff",
      applies: [{ condition: "unconscious", duration: { rounds: 10 } }],
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
  {
    id: "shield",
    label: "Shield",
    rows: [{ list: "spells", values: { name: "Shield", level: 1, prepared: true } }],
    mechanics: { kind: "buff", targets: "self", reaction: true, cost: [{ pool: "slots_1", amount: 1 }] },
  },
] as unknown as RulesetCatalogEntry[];

{
  const header = { id: "spells", label: "Spells", feeds: ["spells"], entries: [] } as unknown as RulesetCatalogHeader;
  assert.deepEqual(
    rulesetCatalogEntryIssues(fiveE, header, spellEntries).map((issue) => issue.message),
    [],
    "the fight's own catalog is one the ruleset would accept",
  );
}

const spellRows = spellEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));
const spellCatalogs = { spells: spellEntries };

const fighterBuild = () =>
  build({
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    saves: { str_save: "proficient", con_save: "proficient" },
    fields: { level: 7, ac: 18, speed: 30, hp_max: 60 },
    lists: {
      attacks: [
        { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
      ],
    },
  });
const wizardBuild = () =>
  build({
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    saves: { int_save: "proficient", wis_save: "proficient" },
    fields: {
      level: 7,
      ac: 12,
      speed: 30,
      hp_max: 38,
      spellcasting_ability: "int",
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 3,
      slots_max_4: 1,
    },
    lists: { spells: spellRows },
  });

const fighter = (live: unknown = {}): RulesetCombatantInput => ({
  id: "brenna",
  name: "Brenna",
  side: "party",
  build: fighterBuild(),
  live,
  catalogs: {},
});
const wizard = (live: unknown = {}): RulesetCombatantInput => ({
  id: "corwin",
  name: "Corwin",
  side: "party",
  build: wizardBuild(),
  live,
  catalogs: spellCatalogs,
});
const foe = (id: string, name: string, block: RulesetStatBlock): RulesetCombatantInput => ({
  id,
  name,
  side: "enemy",
  block,
});
const snag = () =>
  foe("snag", "Snag", {
    health: 12,
    defense: 13,
    initiativeModifier: 2,
    saves: { dex_save: 2, con_save: 0, wis_save: -1 },
    resist: ["fire"],
    actions: [
      {
        id: "scimitar",
        name: "Scimitar",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "slashing" },
        reach: 5,
      },
    ],
  });
const rot = () =>
  foe("rot", "Rot", {
    health: 14,
    defense: 12,
    initiativeModifier: 0,
    saves: { dex_save: 1, wis_save: 0 },
    vulnerable: ["fire"],
    actions: [
      {
        id: "bite",
        name: "Bite",
        budget: "action",
        toHit: 3,
        damage: { count: 1, sides: 8, flat: 1, type: "piercing" },
      },
    ],
  });
const husk = () =>
  foe("husk", "Husk", {
    health: 20,
    defense: 11,
    initiativeModifier: 0,
    immune: ["fire"],
    conditionImmunities: ["paralyzed"],
    actions: [
      {
        id: "slam",
        name: "Slam",
        budget: "action",
        toHit: 3,
        damage: { count: 1, sides: 6, flat: 1, type: "bludgeoning" },
      },
    ],
  });
/** Something so poorly defended that only the rule about a natural 1 can save it. */
const mote = () => foe("mote", "Mote", { health: 4, defense: 5, initiativeModifier: -2, actions: [] });

const fight = (
  definition: RulesetDefinition,
  combatants: RulesetCombatantInput[],
  ...initiative: number[]
): RulesetEncounterState => createRulesetEncounter({ definition, seed: 4242, combatants, roller: dice(...initiative) });
const act = (
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  ...faces: number[]
) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
const endTurn = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, ...faces: number[]) =>
  applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, dice(...faces));
const who = (state: RulesetEncounterState, id: string): RulesetCombatant => {
  const combatant = rulesetCombatant(state, id);
  assert.ok(combatant, `no combatant "${id}"`);
  return combatant;
};
const labels = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
  rulesetCombatOptions(definition, state, id).map((option) => option.label);

// ── A sheet's dice column is free text, and only real dice are read as dice ──
{
  const read = (text: unknown) => parseRulesetCombatDice(text);
  assert.deepEqual(read("2d6"), { count: 2, sides: 6, flat: 0 });
  assert.deepEqual(read(" 1D8 + 3 "), { count: 1, sides: 8, flat: 3 });
  assert.deepEqual(read("1d8-1"), { count: 1, sides: 8, flat: -1 });
  assert.deepEqual(read("7"), { count: 0, sides: 0, flat: 7 }, "a plain number is a flat amount");
  for (const notDice of ["", "   ", "rope", "d6", "2d", "2d6+", "1 2d6", "2d6+1 0", "1234d6", "2d6+3+1", 12, null]) {
    assert.equal(read(notDice), null, `${JSON.stringify(notDice)} is not dice`);
  }
  // Long input is refused before any pattern sees it, so a pasted wall of spaces costs nothing.
  assert.equal(read(`2d6${" ".repeat(100_000)}+3`), null);
}

// ── Initiative: the order, and the two tiebreaks ──
{
  // Brenna and Corwin both roll 15 with the same modifier, so the order they were handed in decides;
  // Rot reaches the same total with a smaller modifier and goes after both.
  const state = fight(fiveE, [fighter(), wizard(), snag(), rot()], 15, 15, 10, 17);
  assert.deepEqual(state.order, ["brenna", "corwin", "rot", "snag"]);
  assert.equal(state.cursor, 4, "one die each, and the cursor says so");
  const rolled = firstOf(state.opening, "initiative");
  assert.deepEqual(rolled.entries, [
    { actorId: "brenna", roll: [15], modifier: 2, total: 17 },
    { actorId: "corwin", roll: [15], modifier: 2, total: 17 },
    { actorId: "rot", roll: [17], modifier: 0, total: 17 },
    { actorId: "snag", roll: [10], modifier: 2, total: 12 },
  ]);
  assert.deepEqual(firstOf(state.opening, "turn"), { type: "turn", actorId: "brenna", round: 1 });
  assert.equal(rulesetEncounterOutcome(state), "ongoing");
}

// ── One exchange on the 5e draft: the menu, a hit, a budget, and the turn passing on ──
{
  let state = fight(fiveE, [fighter(), wizard(), snag(), rot()], 20, 14, 5, 3);
  assert.deepEqual(state.order, ["brenna", "corwin", "snag", "rot"]);

  const menu = rulesetCombatOptions(fiveE, state, "brenna");
  const longsword = menu.find((option) => option.label === "Longsword")!;
  assert.ok(longsword, "the sheet's own attack row is on the menu");
  assert.equal(longsword.budget, "action");
  assert.deepEqual(longsword.targets, { side: "enemy", count: 1 });
  assert.equal(longsword.cost, undefined, "a weapon costs nothing off the sheet");
  // 1d8+4 averages 8.5, and 15 of the 20 faces land against a defense of 13 with +7.
  assert.deepEqual(longsword.forecast, { hitChance: 0.75, averageDamage: 8.5 });
  assert.deepEqual(
    menu.map((option) => option.id),
    [
      "attack:0:0",
      "standard:dash",
      "standard:disengage",
      "standard:dodge",
      "standard:help",
      "standard:hide",
      "standard:ready",
      "end-turn",
    ],
  );
  assert.deepEqual(rulesetCombatOptions(fiveE, state, "corwin"), [], "only the actor on turn has a menu");

  const swing = act(fiveE, state, { actorId: "brenna", optionId: longsword.id, targetIds: ["snag"] }, 12, 5);
  assert.deepEqual(
    swing.events.map((event) => event.type),
    ["budget", "attack", "damage"],
  );
  assert.deepEqual(firstOf(swing.events, "attack"), {
    type: "attack",
    actorId: "brenna",
    targetId: "snag",
    optionId: "attack:0:0",
    label: "Longsword",
    mode: "normal",
    rolls: [12],
    kept: 12,
    modifier: 7,
    total: 19,
    defense: 13,
    outcome: "hit",
  });
  assert.deepEqual(firstOf(swing.events, "damage"), {
    type: "damage",
    targetId: "snag",
    sourceId: "brenna",
    label: "Longsword",
    damageType: "slashing",
    rolls: [5],
    flat: 4,
    amount: 9,
    dealt: 9,
    adjust: "none",
    toTemp: 0,
    health: 3,
    maxHealth: 12,
  });
  state = swing.state;
  assert.equal(state.cursor, 6, "four initiative dice, one attack die and one damage die");

  const again = act(fiveE, state, { actorId: "brenna", optionId: longsword.id, targetIds: ["snag"] });
  assert.equal(again.state, state, "a refusal changes nothing at all, not even a copy");
  assert.deepEqual(again.events, [{ type: "refused", actorId: "brenna", optionId: "attack:0:0", reason: "no-budget" }]);
  assert.deepEqual(act(fiveE, state, { actorId: "corwin", optionId: "attack:0:0", targetIds: ["snag"] }).events, [
    { type: "refused", actorId: "corwin", optionId: "attack:0:0", reason: "not-your-turn" },
  ]);
  assert.deepEqual(
    act(fiveE, state, { actorId: "brenna", optionId: "standard:dodge", targetIds: [] }).events,
    [{ type: "refused", actorId: "brenna", optionId: "standard:dodge", reason: "no-budget" }],
    "a standard action spends the first declared budget, so it is gone too",
  );
  assert.deepEqual(act(fiveE, state, { actorId: "brenna", optionId: "attack:9:9", targetIds: ["snag"] }).events, [
    { type: "refused", actorId: "brenna", optionId: "attack:9:9", reason: "unknown-option" },
  ]);

  // The wizard's own menu, once the turn reaches him.
  state = endTurn(fiveE, state, "brenna").state;
  assert.equal(currentRulesetActor(state)?.id, "corwin");
  const spells = rulesetCombatOptions(fiveE, state, "corwin");
  assert.deepEqual(
    spells.filter((option) => option.kind === "ability").map((option) => option.label),
    ["Fire Bolt", "Fireball", "Mending Light", "Hold Fast", "Ward", "Spirit Lash"],
    "an unprepared spell and a reaction are both left off",
  );
  const fireball = spells.find((option) => option.label === "Fireball")!;
  assert.deepEqual(fireball.cost, [{ pool: "slots_3", label: "3rd-level slots", amount: 1 }]);
  assert.deepEqual(fireball.payWith, ["slots_4"], "the one higher slot this caster actually has");
  assert.equal(spells.find((option) => option.label === "Spirit Lash")!.budget, "bonus");
  assert.equal(
    who(state, "corwin").actions.find((action) => action.label === "Fire Bolt")!.damage!.count,
    2,
    "the cantrip grew with the sheet's own level",
  );

  const bolt = act(
    fiveE,
    state,
    { actorId: "corwin", optionId: spells.find((option) => option.label === "Fire Bolt")!.id, targetIds: ["snag"] },
    15,
    4,
    6,
  );
  const burned = firstOf(bolt.events, "damage");
  assert.deepEqual([burned.rolls, burned.amount, burned.dealt, burned.adjust], [[4, 6], 10, 5, "resist"]);
  assert.deepEqual(firstOf(bolt.events, "defeated"), { type: "defeated", actorId: "snag" });
  state = bolt.state;
  assert.equal(rulesetEncounterOutcome(state), "ongoing", "one opponent is left standing");

  const toRot = endTurn(fiveE, state, "corwin");
  assert.equal(firstOf(toRot.events, "turn").actorId, "rot", "a defeated opponent is stepped over");
  state = toRot.state;
  const bite = rulesetCombatOptions(fiveE, state, "rot").find((option) => option.id === "bite")!;
  assert.deepEqual(bite.forecast, { hitChance: 0.3, averageDamage: 5.5 }, "a stat block forecasts like anything else");
  const bit = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["brenna"] }, 18, 5);
  assert.equal(firstOf(bit.events, "damage").health, 54, "the party member's own sheet took it");
  state = bit.state;
  const live = readRulesetLive(fiveE, who(state, "brenna").sheet!.build, who(state, "brenna").sheet!.live);
  assert.equal(live.pools.find((pool) => pool.key === "hp")!.value, 54);

  const round2 = endTurn(fiveE, state, "rot");
  assert.deepEqual(firstOf(round2.events, "round"), { type: "round", round: 2 });
  assert.equal(firstOf(round2.events, "turn").actorId, "brenna");
  assert.equal(who(round2.state, "brenna").budgets.action, 1, "a turn budget is back at the actor's own next turn");
  assert.equal(who(round2.state, "rot").budgets.reaction, 1, "and a round budget when the round turns over");
}

// ── The extreme faces of the die ──
{
  const state = fight(fiveE, [fighter(), mote()], 20, 1);
  const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword")!;

  const crit = act(fiveE, state, { actorId: "brenna", optionId: sword.id, targetIds: ["mote"] }, 20, 5, 6);
  const attack = firstOf(crit.events, "attack");
  assert.equal(attack.outcome, "critical");
  const damage = firstOf(crit.events, "damage");
  assert.deepEqual([damage.rolls, damage.flat, damage.amount, damage.critical], [[5, 6], 4, 15, true]);
  assert.deepEqual(firstOf(crit.events, "outcome"), { type: "outcome", outcome: "victory" });
  const summary = rulesetEncounterSummary(fiveE, crit.state);
  assert.equal(summary.outcome, "victory");
  assert.deepEqual(summary.enemies, [{ id: "mote", name: "Mote", health: 0, maxHealth: 4, defeated: true }]);
  assert.deepEqual(summary.party, [
    { id: "brenna", name: "Brenna", health: 60, maxHealth: 60, temp: 0, down: false, dying: false, conditions: [] },
  ]);

  // A natural 1 misses something it would otherwise have hit, and no damage die is thrown for it.
  const flub = act(fiveE, state, { actorId: "brenna", optionId: sword.id, targetIds: ["mote"] }, 1);
  const missed = firstOf(flub.events, "attack");
  assert.deepEqual([missed.total, missed.defense, missed.outcome], [8, 5, "miss"]);
  assert.equal(eventsOf(flub.events, "damage").length, 0);
}

// ── Advantage, disadvantage, and the two cancelling out ──
{
  // Dodging: the next attack against the dodger is rolled twice and the worse one is kept.
  let state = fight(fiveE, [fighter(), wizard(), snag(), rot()], 20, 14, 5, 3);
  const dodged = act(fiveE, state, { actorId: "brenna", optionId: "standard:dodge", targetIds: [] });
  assert.deepEqual(firstOf(dodged.events, "standard"), { type: "standard", actorId: "brenna", action: "dodge" });
  state = endTurn(fiveE, endTurn(fiveE, dodged.state, "brenna").state, "corwin").state;
  assert.equal(currentRulesetActor(state)?.id, "snag");
  const swipe = act(fiveE, state, { actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 18, 6);
  const dodgedRoll = firstOf(swipe.events, "attack");
  assert.deepEqual(
    [dodgedRoll.mode, dodgedRoll.rolls, dodgedRoll.kept, dodgedRoll.outcome],
    ["disadvantage", [18, 6], 6, "miss"],
  );
  state = endTurn(fiveE, endTurn(fiveE, swipe.state, "snag").state, "rot").state;
  assert.equal(currentRulesetActor(state)?.id, "brenna");
  assert.deepEqual(who(state, "brenna").flags, {}, "a stance lasts until the actor's own next turn");

  // Help: the ally's next attack is rolled twice and the better one is kept.
  let helped = fight(fiveE, [fighter(), wizard(), snag(), rot()], 14, 20, 5, 3);
  assert.deepEqual(helped.order, ["corwin", "brenna", "snag", "rot"]);
  assert.deepEqual(
    act(fiveE, helped, { actorId: "corwin", optionId: "standard:help", targetIds: ["corwin"] }).events,
    [{ type: "refused", actorId: "corwin", optionId: "standard:help", reason: "bad-target" }],
    "helping yourself is not help",
  );
  helped = act(fiveE, helped, { actorId: "corwin", optionId: "standard:help", targetIds: ["brenna"] }).state;
  assert.equal(who(helped, "brenna").flags.helped, true);
  helped = endTurn(fiveE, helped, "corwin").state;
  const boosted = act(fiveE, helped, { actorId: "brenna", optionId: "attack:0:0", targetIds: ["snag"] }, 4, 16, 3);
  const better = firstOf(boosted.events, "attack");
  assert.deepEqual([better.mode, better.rolls, better.kept, better.outcome], ["advantage", [4, 16], 16, "hit"]);
  assert.equal(who(boosted.state, "brenna").flags.helped, false, "the help is spent by the attack it was given for");

  // Poisoned and helped at once: one of each cancels out and a single set is rolled.
  let torn = fight(fiveE, [fighter({ conditions: ["poisoned"] }), wizard(), snag(), rot()], 14, 20, 5, 3);
  torn = act(fiveE, torn, { actorId: "corwin", optionId: "standard:help", targetIds: ["brenna"] }).state;
  torn = endTurn(fiveE, torn, "corwin").state;
  const cancelled = act(fiveE, torn, { actorId: "brenna", optionId: "attack:0:0", targetIds: ["snag"] }, 11, 4);
  const plain = firstOf(cancelled.events, "attack");
  assert.deepEqual([plain.mode, plain.rolls, plain.kept], ["normal", [11], 11]);
}

// ── Two attack rolls are two attacks: each hit rolls its own damage ──
{
  const volley = foe("volley", "Volley", {
    health: 20,
    defense: 12,
    initiativeModifier: 5,
    actions: [
      {
        id: "twin-shot",
        name: "Twin Shot",
        budget: "action",
        toHit: 10,
        damage: { count: 1, sides: 6, flat: 0, type: "piercing" },
        targetCount: 2,
      },
    ],
  });
  const state = fight(fiveE, [fighter(), wizard(), volley], 1, 1, 20);
  assert.equal(state.order[0], "volley");
  const shot = rulesetCombatOptions(fiveE, state, "volley").find((option) => option.label === "Twin Shot")!;
  // The dice as they fall: an attack roll and its damage for the first target, then the same again.
  const loosed = act(
    fiveE,
    state,
    { actorId: "volley", optionId: shot.id, targetIds: ["brenna", "corwin"] },
    15,
    2,
    15,
    5,
  );
  assert.deepEqual(
    eventsOf(loosed.events, "damage").map((event) => [event.targetId, event.rolls]),
    [
      ["brenna", [2]],
      ["corwin", [5]],
    ],
    "an ability that rolls to hit each target rolls its damage for each hit",
  );
}

// ── An area, one damage roll, a save each, and what each hide is made of ──
{
  let state = fight(fiveE, [wizard(), snag(), rot(), husk()], 20, 5, 3, 2);
  const fireball = rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === "Fireball")!;
  const blast = act(
    fiveE,
    state,
    { actorId: "corwin", optionId: fireball.id, targetIds: ["snag", "rot", "husk"] },
    5,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    18,
    4,
  );
  assert.deepEqual(firstOf(blast.events, "spend"), {
    type: "spend",
    actorId: "corwin",
    pool: "slots_3",
    label: "3rd-level slots",
    amount: 1,
  });
  const hits = eventsOf(blast.events, "damage");
  assert.deepEqual(
    hits.map((event) => event.rolls),
    [
      [3, 3, 3, 3, 3, 3, 3, 3],
      [3, 3, 3, 3, 3, 3, 3, 3],
      [3, 3, 3, 3, 3, 3, 3, 3],
    ],
    "one roll, shared by everything it covered",
  );
  assert.deepEqual(
    hits.map((event) => [event.targetId, event.amount, event.dealt, event.adjust, event.saved ?? false]),
    [
      ["snag", 24, 12, "resist", false],
      ["rot", 12, 24, "vulnerable", true],
      ["husk", 24, 0, "immune", false],
    ],
  );
  const saves = eventsOf(blast.events, "save");
  assert.deepEqual(
    saves.map((event) => [event.actorId, event.rolls, event.modifier, event.total, event.difficulty, event.success]),
    [
      ["snag", [5], 2, 7, 15, false],
      ["rot", [18], 1, 19, 15, true],
      ["husk", [4], 0, 4, 15, false],
    ],
    "one save each, against the caster's own difficulty",
  );
  const slots = readRulesetLive(fiveE, who(blast.state, "corwin").sheet!.build, who(blast.state, "corwin").sheet!.live);
  assert.equal(slots.pools.find((pool) => pool.key === "slots_3")!.value, 2, "the slot came off the sheet");

  // Paid out of a higher pool of the same family: one step up, one die more.
  const upcast = act(
    fiveE,
    state,
    { actorId: "corwin", optionId: fireball.id, targetIds: ["snag"], payWith: "slots_4" },
    5,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    6,
  );
  assert.equal(firstOf(upcast.events, "spend").pool, "slots_4");
  const bigger = firstOf(upcast.events, "damage");
  assert.deepEqual([bigger.rolls.length, bigger.amount, bigger.dealt], [9, 22, 11]);
  assert.deepEqual(
    act(fiveE, state, { actorId: "corwin", optionId: fireball.id, targetIds: ["snag"], payWith: "slots_1" }).events,
    [{ type: "refused", actorId: "corwin", optionId: fireball.id, reason: "bad-pool" }],
    "a lower pool is not an upcast, and is not offered",
  );
  assert.deepEqual(
    act(fiveE, state, { actorId: "corwin", optionId: fireball.id, targetIds: ["snag", "rot", "husk", "corwin"] })
      .events,
    [{ type: "refused", actorId: "corwin", optionId: fireball.id, reason: "bad-target" }],
    "more targets than it takes",
  );
}

// ── A price the sheet would refuse is not offered, and is refused if asked for anyway ──
{
  const state = fight(fiveE, [wizard({ pools: { slots_3: { value: 0 } } }), snag()], 20, 5);
  assert.ok(
    !rulesetCombatOptions(fiveE, state, "corwin").some((option) => option.label === "Fireball"),
    "no third-level slot, no Fireball",
  );
  assert.deepEqual(act(fiveE, state, { actorId: "corwin", optionId: "ability:0:1", targetIds: ["snag"] }).events, [
    { type: "refused", actorId: "corwin", optionId: "ability:0:1", reason: "insufficient" },
  ]);
}

// ── Temporary points go first, and an ability that always lands rolls nothing to hit ──
{
  let state = fight(fiveE, [wizard(), rot()], 20, 3);
  const ward = rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === "Ward")!;
  const warded = act(fiveE, state, { actorId: "corwin", optionId: ward.id, targetIds: ["corwin"] }, 4);
  const buffer = firstOf(warded.events, "temporary");
  assert.deepEqual([buffer.rolls, buffer.flat, buffer.amount], [[4], 4, 8]);
  state = warded.state;

  const lash = rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === "Spirit Lash")!;
  assert.ok(lash, "the bonus-action budget is untouched by an action");
  const zap = act(fiveE, state, { actorId: "corwin", optionId: lash.id, targetIds: ["rot"] }, 5);
  assert.equal(eventsOf(zap.events, "attack").length, 0, "autoHit lands without a roll");
  assert.deepEqual([firstOf(zap.events, "damage").amount, firstOf(zap.events, "damage").damageType], [5, "radiant"]);
  state = endTurn(fiveE, zap.state, "corwin").state;

  const bit = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["corwin"] }, 15, 6);
  const through = firstOf(bit.events, "damage");
  assert.deepEqual([through.dealt, through.toTemp, through.health], [7, 7, 38], "the buffer took all of it");
}

// ── A condition with a save to end it, and the concentration that holds it ──
{
  let state = fight(fiveE, [wizard(), husk(), snag(), rot()], 20, 2, 5, 3);
  assert.deepEqual(state.order, ["corwin", "snag", "rot", "husk"]);
  const hold = rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === "Hold Fast")!;

  const immune = act(fiveE, state, { actorId: "corwin", optionId: hold.id, targetIds: ["husk"] }, 4);
  assert.deepEqual(firstOf(immune.events, "condition"), {
    type: "condition",
    targetId: "husk",
    condition: "paralyzed",
    active: false,
    reason: "immune",
  });

  const held = act(fiveE, state, { actorId: "corwin", optionId: hold.id, targetIds: ["snag"] }, 5);
  assert.deepEqual(firstOf(held.events, "concentration"), {
    type: "concentration",
    actorId: "corwin",
    label: "Hold Fast",
    state: "started",
  });
  assert.deepEqual(firstOf(held.events, "condition"), {
    type: "condition",
    targetId: "snag",
    condition: "paralyzed",
    active: true,
    reason: "applied",
  });
  state = held.state;
  const noted = readRulesetLive(fiveE, who(state, "corwin").sheet!.build, who(state, "corwin").sheet!.live);
  assert.equal(noted.text.find((entry) => entry.id === "concentration")!.value, "Hold Fast");

  // Held fast: nothing on the menu but the end of the turn.
  state = endTurn(fiveE, state, "corwin").state;
  assert.deepEqual(labels(fiveE, state, "snag"), ["End turn"]);
  assert.deepEqual(act(fiveE, state, { actorId: "snag", optionId: "scimitar", targetIds: ["corwin"] }).events, [
    { type: "refused", actorId: "snag", optionId: "scimitar", reason: "cannot-act" },
  ]);

  // The end of its own turn is when it gets to try again, and this one fails.
  const ticked = endTurn(fiveE, state, "snag", 3);
  const repeated = firstOf(ticked.events, "save");
  assert.deepEqual(
    [repeated.actorId, repeated.rolls, repeated.total, repeated.difficulty, repeated.success],
    ["snag", [3], 2, 15, false],
  );
  state = ticked.state;
  assert.equal(who(state, "snag").tracked[0]!.rounds, 9, "and a round of its ten has run off");

  // Damage to the caster forces the ruleset's own save, and losing it takes the hold with it.
  const bit = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["corwin"] }, 15, 6, 4);
  const forced = eventsOf(bit.events, "save").at(-1)!;
  assert.deepEqual(
    [forced.save, forced.modifier, forced.total, forced.difficulty, forced.success],
    ["con_save", 1, 5, 10, false],
  );
  assert.deepEqual(firstOf(bit.events, "concentration"), {
    type: "concentration",
    actorId: "corwin",
    label: "Hold Fast",
    state: "ended",
    reason: "damage",
  });
  const released = eventsOf(bit.events, "condition").find((event) => event.targetId === "snag")!;
  assert.deepEqual([released.active, released.reason], [false, "concentration"]);
  assert.deepEqual(who(bit.state, "snag").tracked, []);
  const cleared = readRulesetLive(fiveE, who(bit.state, "corwin").sheet!.build, who(bit.state, "corwin").sheet!.live);
  assert.equal(cleared.text.find((entry) => entry.id === "concentration")!.value, "");
}

// ── A second concentration ability ends the first ──
{
  let state = fight(fiveE, [wizard(), snag(), rot()], 20, 5, 3);
  const hold = rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === "Hold Fast")!;
  state = act(fiveE, state, { actorId: "corwin", optionId: hold.id, targetIds: ["snag"] }, 5).state;
  state = endTurn(fiveE, state, "corwin").state;
  state = endTurn(fiveE, state, "snag", 3).state;
  state = endTurn(fiveE, state, "rot").state;
  assert.equal(currentRulesetActor(state)?.id, "corwin");
  const second = act(fiveE, state, { actorId: "corwin", optionId: hold.id, targetIds: ["rot"] }, 5);
  assert.deepEqual(
    eventsOf(second.events, "concentration").map((event) => [event.state, event.reason ?? null]),
    [
      ["ended", "replaced"],
      ["started", null],
    ],
  );
  assert.deepEqual(who(second.state, "snag").tracked, [], "what the first one held goes with it");
  assert.equal(who(second.state, "rot").tracked[0]!.condition, "paralyzed");
}

// ── The blow that takes her down ends her concentration without a roll ──
{
  // Corwin holds Snag, then Rot takes him to zero. Going down ends what he was holding outright:
  // there is no save to keep it, so the only dice thrown are the attack and its damage.
  let state = fight(fiveE, [wizard({ pools: { hp: { value: 3 } } }), snag(), rot()], 20, 5, 3);
  const hold = rulesetCombatOptions(fiveE, state, "corwin").find((option) => option.label === "Hold Fast")!;
  state = act(fiveE, state, { actorId: "corwin", optionId: hold.id, targetIds: ["snag"] }, 5).state;
  state = endTurn(fiveE, state, "corwin").state;
  state = endTurn(fiveE, state, "snag", 3).state;
  assert.equal(currentRulesetActor(state)?.id, "rot");
  const felled = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["corwin"] }, 18, 8);
  assert.equal(eventsOf(felled.events, "save").length, 0, "nothing is rolled to keep it");
  assert.deepEqual(
    eventsOf(felled.events, "concentration").map((event) => [event.state, event.reason ?? null]),
    [["ended", "down"]],
  );
  assert.deepEqual(who(felled.state, "snag").tracked, [], "and what he held lets go");
}

// ── Down, dying, and back again ──
{
  let state = fight(fiveE, [fighter({ pools: { hp: { value: 5 } } }), wizard(), rot()], 10, 9, 18);
  assert.deepEqual(state.order, ["rot", "brenna", "corwin"]);
  const felled = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["brenna"] }, 18, 8);
  assert.deepEqual(firstOf(felled.events, "down"), { type: "down", actorId: "brenna", dying: true });
  assert.equal(
    eventsOf(felled.events, "condition").find((event) => event.condition === "unconscious")!.active,
    true,
    "the ruleset's own word for being down",
  );
  state = felled.state;
  assert.equal(rulesetEncounterOutcome(state), "ongoing", "the party is not beaten while somebody stands");

  const first = endTurn(fiveE, state, "rot", 3);
  const failed = firstOf(first.events, "dying");
  assert.deepEqual([failed.rolls, failed.difficulty, failed.result, failed.failures], [[3], 10, "failure", 1]);
  assert.deepEqual(labels(fiveE, first.state, "brenna"), ["End turn"]);
  state = endTurn(fiveE, endTurn(fiveE, first.state, "brenna").state, "corwin").state;

  // She is unconscious, so the blow is rolled twice and the better one kept.
  const kicked = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["brenna"] }, 15, 4, 6);
  assert.equal(firstOf(kicked.events, "attack").mode, "advantage");
  assert.equal(firstOf(kicked.events, "damage").health, 0, "still at zero, and it still counts against her");
  const tracks = (id: string, track: string, source = kicked.state) =>
    readRulesetLive(fiveE, who(source, id).sheet!.build, who(source, id).sheet!.live).tracks.find(
      (entry) => entry.id === track,
    )!.value;
  assert.equal(tracks("brenna", "death_save_failures"), 2);

  const up = endTurn(fiveE, kicked.state, "rot", 20);
  assert.equal(firstOf(up.events, "dying").result, "revived");
  assert.deepEqual(firstOf(up.events, "revived"), { type: "revived", actorId: "brenna", health: 1 });
  assert.deepEqual([who(up.state, "brenna").down, who(up.state, "brenna").dying], [false, false]);
  assert.equal(tracks("brenna", "death_save_failures", up.state), 0, "the tracks are cleared with her");
  assert.deepEqual(rulesetEncounterSummary(fiveE, up.state).party[0]!.conditions, [], "and so is being down");
}

// ── Three rolls against death, and healing from zero ──
{
  let state = fight(fiveE, [fighter({ pools: { hp: { value: 0 } } }), wizard(), rot()], 10, 9, 18);
  assert.deepEqual([who(state, "brenna").down, who(state, "brenna").dying], [true, true]);
  for (const face of [3, 5, 7]) {
    state = endTurn(fiveE, state, "rot", face).state;
    state = endTurn(fiveE, state, "brenna").state;
    state = endTurn(fiveE, state, "corwin").state;
  }
  assert.equal(who(state, "brenna").defeated, true, "three failures and she is gone");
  assert.equal(rulesetEncounterOutcome(state), "ongoing");

  // Healing brings somebody back from zero, which is why a downed ally is still a legal target.
  let rescue = fight(fiveE, [wizard(), fighter({ pools: { hp: { value: 0 } } }), rot()], 20, 10, 3);
  const mend = rulesetCombatOptions(fiveE, rescue, "corwin").find((option) => option.label === "Mending Light")!;
  const healed = act(fiveE, rescue, { actorId: "corwin", optionId: mend.id, targetIds: ["brenna"] }, 5);
  const heal = firstOf(healed.events, "heal");
  assert.deepEqual([heal.rolls, heal.flat, heal.amount, heal.health], [[5], 4, 9, 9]);
  assert.deepEqual(firstOf(healed.events, "revived"), { type: "revived", actorId: "brenna", health: 9 });
  assert.equal(firstOf(healed.events, "spend").pool, "slots_1");
}

// ── Three successes make her stable, and a blow while stable starts the count again ──
{
  let state = fight(fiveE, [fighter({ pools: { hp: { value: 0 } } }), wizard(), rot()], 10, 9, 18);
  const track = (source: RulesetEncounterState, id: string) =>
    readRulesetLive(fiveE, who(source, "brenna").sheet!.build, who(source, "brenna").sheet!.live).tracks.find(
      (entry) => entry.id === id,
    )!.value;
  let last = endTurn(fiveE, state, "rot", 12);
  for (const face of [14, 16]) {
    state = endTurn(fiveE, endTurn(fiveE, last.state, "brenna").state, "corwin").state;
    last = endTurn(fiveE, state, "rot", face);
  }
  assert.equal(eventsOf(last.events, "dying").at(-1)!.result, "stable");
  assert.equal(who(last.state, "brenna").stable, true);
  assert.deepEqual(
    [track(last.state, "death_save_successes"), track(last.state, "death_save_failures")],
    [0, 0],
    "the count is over once it is decided",
  );
  // Stable and still down: no more rolls for her, until something hurts her.
  state = endTurn(fiveE, endTurn(fiveE, last.state, "brenna").state, "corwin").state;
  const kicked = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["brenna"] }, 15, 4, 6);
  assert.equal(who(kicked.state, "brenna").stable, false, "a blow while stable ends it");
  assert.equal(track(kicked.state, "death_save_failures"), 1, "and the new count opens with that blow");
  const again = endTurn(fiveE, kicked.state, "rot", 11);
  assert.equal(firstOf(again.events, "dying").result, "success", "she is rolling again");
}

// ── Defeat, and a fight that is over ──
{
  const state = fight(fiveE, [fighter({ pools: { hp: { value: 3 } } }), rot()], 5, 18);
  const over = act(fiveE, state, { actorId: "rot", optionId: "bite", targetIds: ["brenna"] }, 18, 8);
  assert.deepEqual(firstOf(over.events, "outcome"), { type: "outcome", outcome: "defeat" });
  assert.deepEqual(act(fiveE, over.state, { actorId: "rot", optionId: "bite", targetIds: ["brenna"] }).events, [
    { type: "refused", actorId: "rot", optionId: "bite", reason: "encounter-over" },
  ]);
  assert.deepEqual(advanceRulesetTurn(fiveE, over.state, dice()).events, [{ type: "outcome", outcome: "defeat" }]);
  const summary = rulesetEncounterSummary(fiveE, over.state);
  assert.deepEqual(summary, {
    outcome: "defeat",
    rounds: 1,
    party: [
      {
        id: "brenna",
        name: "Brenna",
        health: 0,
        maxHealth: 60,
        temp: 0,
        down: true,
        dying: true,
        conditions: ["unconscious"],
      },
    ],
    enemies: [{ id: "rot", name: "Rot", health: 14, maxHealth: 14, defeated: false }],
  });
}

// ── The state is plain JSON, and a fight carried through it resolves the same ──
{
  let state = fight(fiveE, [fighter(), wizard(), snag(), rot()], 20, 14, 5, 3);
  state = act(fiveE, state, { actorId: "brenna", optionId: "attack:0:0", targetIds: ["snag"] }, 12, 5).state;
  state = endTurn(fiveE, state, "brenna").state;
  const carried = JSON.parse(JSON.stringify(state)) as RulesetEncounterState;
  assert.deepEqual(carried, state, "nothing in the state fails to survive the trip");
  const choice: RulesetCombatChoice = { actorId: "corwin", optionId: "ability:0:1", targetIds: ["snag", "rot"] };
  const faces = [5, 4, 4, 4, 4, 4, 4, 4, 4, 12];
  const here = act(fiveE, state, choice, ...faces);
  const there = act(fiveE, carried, choice, ...faces);
  assert.deepEqual(there.events, here.events);
  assert.deepEqual(there.state, here.state);
}

// ── The seeded roller, and the forecast ──
{
  const one = rulesetCombatRoller(99, 3);
  const two = rulesetCombatRoller(99, 3);
  const faces = [one(20), one(20), one(6)];
  assert.deepEqual(faces, [two(20), two(20), two(6)], "the same seed and cursor is the same fight");
  assert.ok(
    faces.every((face, index) => face >= 1 && face <= (index === 2 ? 6 : 20)),
    "and every face is one the die has",
  );
  assert.equal(rulesetHitChance(fiveE.combat!, 7, 13), 0.75);
  assert.equal(rulesetHitChance(fiveE.combat!, 7, 13, "advantage"), 1 - 0.25 ** 2);
  assert.equal(rulesetHitChance(fiveE.combat!, 7, 13, "disadvantage"), 0.75 ** 2);
  // Two six-sided dice reach four or more in 33 of their 36 combinations.
  assert.equal(Math.round(rulesetHitChance(ember.combat!, 2, 6)! * 1000) / 1000, 0.917);
}

// ── The same skeleton, on two six-sided dice ──
//
// Ember Roads has no lucky faces, no criticals, no advantage, no saving throws, no slots and one
// thing to do a turn. Everything below is the same resolver reading its numbers instead.
{
  const knacks = ember.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
  const knackEntry = (id: string) => knacks.find((entry) => entry.id === id)!;
  const knackRows = (id: string) => rowsFromCatalogEntry("knacks", knackEntry(id));
  const rowsFor = (list: string, ids: string[]) =>
    ids.flatMap((id) =>
      knackRows(id)
        .filter((row) => row.list === list)
        .map((row) => row.row),
    );
  const picked = ["road-sense", "last-ember", "coldfire-toss", "hold-the-line"];

  const travellerBuild = () =>
    build({
      abilities: { brawn: 2, wits: 1, heart: 1 },
      skills: { scrap: "trained" },
      fields: { calling: "Hauler", toughness: 2 },
      lists: {
        gear: [
          { name: "Road axe", notes: "Heavy, and it knows it", swing: "brawn", damage: "1d6", harm: "cut" },
          { name: "Rope", notes: "Fifty feet" },
        ],
        knacks: rowsFor("knacks", picked),
        tricks: rowsFor("tricks", picked),
      },
    });
  const pellBuild = () =>
    build({ abilities: { brawn: 1, wits: 2, heart: 0 }, fields: { calling: "Scout", toughness: 1 }, lists: {} });

  const emberCatalogs = { knacks };
  const traveller = (live: unknown = {}): RulesetCombatantInput => ({
    id: "juno",
    name: "Juno",
    side: "party",
    build: travellerBuild(),
    live,
    catalogs: emberCatalogs,
  });
  const pell = (live: unknown = {}): RulesetCombatantInput => ({
    id: "pell",
    name: "Pell",
    side: "party",
    build: pellBuild(),
    live,
    catalogs: {},
  });
  const hound = (id: string, name: string, health = 6): RulesetCombatantInput => ({
    id,
    name,
    side: "enemy",
    block: {
      health,
      defense: 6,
      initiativeModifier: 1,
      actions: [
        { id: "claw", name: "Claw", budget: "act", toHit: 1, damage: { count: 1, sides: 6, flat: 0, type: "cut" } },
      ],
    },
  });
  const emberLive = (state: RulesetEncounterState, id: string) =>
    readRulesetLive(ember, who(state, id).sheet!.build, who(state, id).sheet!.live);
  const pool = (state: RulesetEncounterState, id: string, key: string) =>
    emberLive(state, id).pools.find((entry) => entry.key === key)!;

  // Initiative on two dice, plus the stat this system reads for it.
  let state = fight(
    ember,
    [traveller(), pell(), hound("ash", "Ash-hound", 20), hound("cinder", "Cinder-hound", 20)],
    ...[6, 5, 3, 3, 2, 1, 1, 2],
  );
  assert.deepEqual(firstOf(state.opening, "initiative").entries, [
    { actorId: "juno", roll: [6, 5], modifier: 1, total: 12 },
    { actorId: "pell", roll: [3, 3], modifier: 2, total: 8 },
    { actorId: "ash", roll: [2, 1], modifier: 1, total: 4 },
    { actorId: "cinder", roll: [1, 2], modifier: 1, total: 4 },
  ]);
  assert.deepEqual(state.order, ["juno", "pell", "ash", "cinder"]);

  // The menu: a piece of gear with damage dice is a weapon, rope is not, and a knack with no
  // mechanics behind it says nothing in numbers.
  const menu = rulesetCombatOptions(ember, state, "juno");
  assert.deepEqual(
    menu.map((option) => option.label),
    ["Road axe", "Last Ember", "Coldfire Toss", "Hold the Line", "dodge", "help", "End turn"],
  );
  const axe = menu.find((option) => option.label === "Road axe")!;
  assert.deepEqual(axe.forecast, { hitChance: 0.917, averageDamage: 5.5 }, "1d6+2 against a Guard of 6");
  assert.deepEqual(menu.find((option) => option.label === "Hold the Line")!.cost, [
    { pool: "luck", label: "Luck", amount: 1 },
  ]);
  assert.deepEqual(menu.find((option) => option.label === "Last Ember")!.cost, [
    { pool: "grit", label: "Grit", amount: 1 },
    { pool: "tricks:last ember", label: "Last Ember", amount: 1 },
  ]);
  assert.equal(menu.find((option) => option.label === "Hold the Line")!.payWith, undefined, "no families here");

  // A hit: two dice plus the stat the gear swings with, against the Guard.
  const swing = act(ember, state, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 4, 3, 5);
  const attack = firstOf(swing.events, "attack");
  assert.deepEqual(
    [attack.rolls, attack.kept, attack.modifier, attack.total, attack.defense, attack.outcome],
    [[4, 3], 7, 2, 9, 6, "hit"],
  );
  const cut = firstOf(swing.events, "damage");
  assert.deepEqual([cut.rolls, cut.flat, cut.amount, cut.dealt, cut.damageType, cut.health], [[5], 2, 7, 7, "cut", 13]);
  assert.equal(cut.critical, undefined, "there are no critical hits in this system");

  // Both extremes are plain arithmetic here: neither face decides anything by itself.
  const high = act(ember, state, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 6, 6, 1);
  assert.equal(firstOf(high.events, "attack").outcome, "hit");
  assert.equal(firstOf(high.events, "damage").critical, undefined);
  const low = act(ember, state, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 1, 1);
  assert.deepEqual([firstOf(low.events, "attack").total, firstOf(low.events, "attack").outcome], [4, "miss"]);

  // Help changes nothing where the ruleset does not roll twice.
  let helped = fight(ember, [traveller(), pell(), hound("ash", "Ash-hound")], 3, 3, 6, 5, 1, 1);
  assert.deepEqual(helped.order, ["pell", "juno", "ash"]);
  helped = act(ember, helped, { actorId: "pell", optionId: "standard:help", targetIds: ["juno"] }).state;
  helped = endTurn(ember, helped, "pell").state;
  const plain = firstOf(
    act(ember, helped, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 4, 4, 2).events,
    "attack",
  );
  assert.deepEqual([plain.mode, plain.rolls], ["normal", [4, 4]], "one set of dice, whoever was helping");

  // An area with no roll and no save: everything it covers takes the same dice.
  const toss = menu.find((option) => option.label === "Coldfire Toss")!;
  assert.deepEqual(toss.targets, { side: "any", count: 3 });
  const thrown = act(ember, state, { actorId: "juno", optionId: toss.id, targetIds: ["ash", "cinder"] }, 3, 4);
  assert.equal(eventsOf(thrown.events, "attack").length, 0);
  assert.equal(eventsOf(thrown.events, "save").length, 0, "this system has no saving throws at all");
  assert.deepEqual(
    eventsOf(thrown.events, "damage").map((event) => [event.targetId, event.rolls, event.dealt]),
    [
      ["ash", [3, 4], 7],
      ["cinder", [3, 4], 7],
    ],
  );
  assert.deepEqual(
    eventsOf(thrown.events, "condition").map((event) => [event.targetId, event.condition, event.active]),
    [
      ["ash", "shaken", true],
      ["cinder", "shaken", true],
    ],
  );

  // An entry that rolls to hit ROLLS, even in a list whose source names no bonus: nothing is added
  // to the dice, and it can miss. Landing it without a roll would be a free hit.
  {
    const aimed = structuredClone(knacks);
    aimed.find((entry) => entry.id === "coldfire-toss")!.mechanics!.attackRoll = true;
    const aimedState = createRulesetEncounter({
      definition: ember,
      seed: 4242,
      combatants: [
        { ...traveller(), catalogs: { knacks: aimed } },
        hound("ash", "Ash-hound"),
        hound("cinder", "Cinder-hound"),
      ],
      // Two dice each for initiative, and the traveller goes first.
      roller: dice(6, 5, 1, 1, 1, 1),
    });
    const aimedToss = rulesetCombatOptions(ember, aimedState, "juno").find(
      (option) => option.label === "Coldfire Toss",
    )!;
    const missed = applyRulesetCombatChoice(
      ember,
      aimedState,
      { actorId: "juno", optionId: aimedToss.id, targetIds: ["ash"] },
      dice(1, 1),
    );
    const roll = firstOf(missed.events, "attack");
    assert.deepEqual([roll.rolls, roll.modifier, roll.total, roll.outcome], [[1, 1], 0, 2, "miss"]);
    assert.equal(eventsOf(missed.events, "damage").length, 0, "a miss deals nothing");
  }

  // A condition the ruleset says any damage ends comes off the next time something lands.
  let shaken = thrown.state;
  assert.equal(who(shaken, "cinder").tracked[0]!.rounds, 2);
  for (const actor of ["juno", "pell", "ash", "cinder"]) shaken = endTurn(ember, shaken, actor).state;
  assert.equal(currentRulesetActor(shaken)?.id, "juno", "round two");
  assert.equal(who(shaken, "cinder").tracked[0]!.rounds, 1, "a round of it ran off at the end of its own turn");
  const landed = act(ember, shaken, { actorId: "juno", optionId: axe.id, targetIds: ["cinder"] }, 4, 3, 2);
  const ended = eventsOf(landed.events, "condition").find((event) => event.condition === "shaken")!;
  assert.deepEqual([ended.targetId, ended.active, ended.reason], ["cinder", false, "damage"]);

  // A price paid through the sheet, and the same ability refused once the pool is empty.
  const steady = act(ember, state, { actorId: "juno", optionId: "ability:0:3", targetIds: ["pell"] });
  assert.deepEqual(firstOf(steady.events, "spend"), {
    type: "spend",
    actorId: "juno",
    pool: "luck",
    label: "Luck",
    amount: 1,
  });
  assert.equal(firstOf(steady.events, "temporary").amount, 2);
  assert.equal(pool(steady.state, "juno", "luck").value, 2, "the sheet is where the price came from");
  const spent = fight(ember, [traveller({ pools: { luck: { value: 0 } } }), hound("ash", "Ash-hound")], 6, 5, 1, 1);
  assert.ok(!labels(ember, spent, "juno").includes("Hold the Line"));
  assert.deepEqual(act(ember, spent, { actorId: "juno", optionId: "ability:0:3", targetIds: ["juno"] }).events, [
    { type: "refused", actorId: "juno", optionId: "ability:0:3", reason: "insufficient" },
  ]);

  // A knack that costs health and a use of its own counter, healing an ally for a flat amount.
  const mended = act(ember, state, { actorId: "juno", optionId: "ability:0:1", targetIds: ["pell"] });
  assert.deepEqual(
    eventsOf(mended.events, "spend").map((event) => [event.pool, event.amount]),
    [
      ["grit", 1],
      ["tricks:last ember", 1],
    ],
  );
  const mending = firstOf(mended.events, "heal");
  assert.deepEqual([mending.rolls, mending.flat, mending.amount], [[], 3, 3]);
  assert.equal(pool(mended.state, "juno", "grit").value, 7);
  assert.equal(pool(mended.state, "juno", "tricks:last ember").value, 0);

  // No dying rule: a character at zero is simply down, with no roll to make and no turn to take.
  let losing = fight(
    ember,
    [traveller({ pools: { grit: { value: 2 } } }), pell(), hound("ash", "Ash-hound")],
    1,
    1,
    2,
    1,
    6,
    6,
  );
  assert.equal(currentRulesetActor(losing)?.id, "ash");
  const felled = act(ember, losing, { actorId: "ash", optionId: "claw", targetIds: ["juno"] }, 4, 4, 4);
  assert.deepEqual(firstOf(felled.events, "down"), { type: "down", actorId: "juno", dying: false });
  losing = felled.state;
  assert.equal(who(losing, "juno").dying, false);
  const skipped = endTurn(ember, losing, "ash");
  assert.equal(firstOf(skipped.events, "turn").actorId, "pell", "somebody down with nothing to roll is stepped over");
  assert.equal(eventsOf(skipped.events, "dying").length, 0);

  // A condition that stops an actor acting, whatever else is on their sheet.
  const pinned = fight(ember, [traveller({ conditions: ["pinned"] }), hound("ash", "Ash-hound")], 6, 5, 1, 1);
  assert.deepEqual(labels(ember, pinned, "juno"), ["End turn"]);
  assert.deepEqual(act(ember, pinned, { actorId: "juno", optionId: "attack:0:0", targetIds: ["ash"] }).events, [
    { type: "refused", actorId: "juno", optionId: "attack:0:0", reason: "cannot-act" },
  ]);

  // Victory, the summary and a fight carried through JSON in the middle of it.
  const carried = JSON.parse(JSON.stringify(state)) as RulesetEncounterState;
  assert.deepEqual(carried, state);
  const choice: RulesetCombatChoice = { actorId: "juno", optionId: axe.id, targetIds: ["ash"] };
  const here = act(ember, state, choice, 4, 3, 5);
  const there = act(ember, carried, choice, 4, 3, 5);
  assert.deepEqual([there.events, there.state], [here.events, here.state]);

  let won = fight(ember, [traveller(), hound("ash", "Ash-hound")], 6, 5, 1, 1);
  const last = act(ember, won, { actorId: "juno", optionId: axe.id, targetIds: ["ash"] }, 5, 5, 6);
  assert.deepEqual(firstOf(last.events, "outcome"), { type: "outcome", outcome: "victory" });
  const summary = rulesetEncounterSummary(ember, last.state);
  assert.deepEqual(summary, {
    outcome: "victory",
    rounds: 1,
    party: [{ id: "juno", name: "Juno", health: 8, maxHealth: 8, temp: 0, down: false, dying: false, conditions: [] }],
    enemies: [{ id: "ash", name: "Ash-hound", health: 0, maxHealth: 6, defeated: true }],
  });
}

// ── Capability API 1.26, read from the ruleset's own bytes ──
{
  assert.ok(
    supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 26,
    "the host still advertises the combat seam introduced in API 1.26",
  );
  const { getCapabilityPackageInstallIssue } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const manifest = (minor: number) =>
    ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "ruleset-ember-roads",
      kind: ["ruleset"],
      permissions: [],
      restartRequired: false,
      contributions: { assets: { paths: ["ruleset.json", "catalogs/knacks.json"] } },
    }) as any;

  const combatOnly = variant(emberText, (doc) => delete doc.catalogs);
  assert.match(
    getCapabilityPackageInstallIssue(manifest(25), combatOnly) ?? "",
    /A ruleset with a combat block requires schemaVersion 2 and capabilityApi 1\.26 or newer/,
    "the block lives inside the ruleset file, so the gate reads the file",
  );
  assert.equal(getCapabilityPackageInstallIssue(manifest(26), combatOnly), null);
  assert.equal(getCapabilityPackageInstallIssue(manifest(26), variant(emberText)), null);

  // The mechanics a fight reads are new keys in the same strict file, inline in the ruleset or in a
  // catalog asset beside it, so both are read the same way.
  const inlineOnly = variant(emberText, (doc) => delete doc.combat);
  assert.match(
    getCapabilityPackageInstallIssue(manifest(25), inlineOnly) ?? "",
    /catalog mechanics reach a fight requires schemaVersion 2 and capabilityApi 1\.26 or newer/,
  );
  const assetOnly = variant(emberText, (doc) => {
    delete doc.combat;
    delete doc.catalogs[0].entries;
    doc.catalogs[0].asset = "catalogs/knacks.json";
  });
  const assetEntries = {
    schemaVersion: 1,
    catalog: "knacks",
    entries: [
      {
        id: "coldfire-toss",
        label: "Coldfire Toss",
        rows: [{ list: "knacks", values: { name: "Coldfire Toss" } }],
        mechanics: { kind: "attack", targetCount: 3 },
      },
    ],
  };
  const assets = new Map([["catalogs/knacks.json", assetEntries]]);
  assert.match(
    getCapabilityPackageInstallIssue(manifest(25), assetOnly, assets) ?? "",
    /catalog mechanics reach a fight requires schemaVersion 2 and capabilityApi 1\.26 or newer/,
  );
  assert.equal(getCapabilityPackageInstallIssue(manifest(26), assetOnly, assets), null);

  // A ruleset with neither installs on the declaration it always needed.
  const plain = variant(emberText, (doc) => {
    delete doc.combat;
    delete doc.catalogs;
    delete doc.battle;
    delete doc.layers;
  });
  assert.equal(getCapabilityPackageInstallIssue(manifest(20), plain), null);
}

console.info("game ruleset combat core regressions passed.");
