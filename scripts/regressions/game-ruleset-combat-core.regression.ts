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
  rulesetCombatConditions,
  parseRulesetCombatDice,
  rulesetCombatOptions,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  rulesetOptionTargets,
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
/** The example less the sheet keys 1.37 added (a track always shown, a summary list's columns),
 *  1.38's modifier off the sheet and 1.39's list sum: every gate this lane proves is older, so it
 *  is proven on a file that trips nothing newer. */
const emberText = (() => {
  const doc = JSON.parse(read("../../docs/examples/rulesets/ember-roads.json"));
  for (const track of doc.sheet.live.tracks) delete track.alwaysShow;
  for (const list of doc.gm.sheetSummary?.lists ?? []) delete list.columns;
  delete doc.resolution.adjust;
  doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => !["burden", "burdened"].includes(entry.id));
  return JSON.stringify(doc);
})();

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
  assert.equal(fiveE.coverage.combat, true, "a fight really runs on it now, and coverage says so");

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
  // A death-save track counts to the rules' own number, with room to count, on every sheet: a top
  // the sheet works out, a top with no room, or a hidden track would each let one roll settle it.
  const withSuccessesTrack = (edit: (track: Record<string, any>) => void) =>
    variant(fiveEText, (doc) =>
      edit(doc.sheet.live.tracks.find((entry: Record<string, any>) => entry.id === "death_save_successes")),
    );
  assert.match(
    refusal(withSuccessesTrack((track) => (track.max = { const: 2 }))),
    /"death_save_successes" counts death saves, so its max is a number rather than the sheet's/,
  );
  assert.match(
    refusal(withSuccessesTrack((track) => (track.max = track.min))),
    /"death_save_successes" counts death saves, so its max is at least 1 and above its min/,
  );
  // Room above a floor below zero is not enough: a top of 0 is reached by the very first roll.
  assert.match(
    refusal(
      withSuccessesTrack((track) => {
        track.min = -1;
        track.max = 0;
        track.default = -1;
      }),
    ),
    /"death_save_successes" counts death saves, so its max is at least 1 and above its min/,
  );
  assert.match(
    refusal(withSuccessesTrack((track) => (track.hideWhen = { field: "level", equals: 1 }))),
    /"death_save_successes" counts death saves, so it cannot be hidden/,
  );
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
  // `reaction` has taken a boolean since the key existed, and `false` says the same as leaving it
  // out. A package that has been shipping one is not broken by the moment an object now names.
  assert.equal(issues({ reaction: false }), "");
  assert.equal(issues({ reaction: true }), "");
  assert.equal(issues({ reaction: { on: "aimed", cancels: true } }), "");
  // What has already happened cannot be called off. That one is the schema's, not this checker's:
  // `rulesetCatalogEntryIssues` reads an entry against the ruleset's own names, and the shape of
  // the key is settled before it ever gets here.
  {
    const entries = (fiveE.catalogs ?? []).find((catalog) => catalog.entries?.length)?.entries;
    assert.ok(entries?.length, "the example ships a catalog with entries in it");
    const badMoment = variant(fiveEText, (doc) => {
      const catalog = (doc.catalogs as Array<Record<string, any>>).find((entry) => entry.entries?.length)!;
      catalog.entries[0].mechanics = { ...catalog.entries[0].mechanics, reaction: { on: "harmed", cancels: true } };
    });
    assert.match(refusal(badMoment), /Only an "aimed" reaction cancels/);
  }
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
    variant(fiveEText, (doc) => {
      delete doc.combat;
      // The bestiary is written in the numbers that block declares, so it goes with it.
      delete doc.catalogs;
    }),
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

/** The two that wait for a moment. They live in a catalog of their own rather than beside the
 *  spells every fixture holds: a wizard who answers being aimed at would hold up every other test
 *  that aims something at him, which is the whole point of a window and not what those prove. */
const reactionEntries = [
  {
    // A moment, not a turn: taken when somebody aims something at its holder, and it stops that
    // thing from happening at all.
    id: "unmake",
    label: "Unmake",
    rows: [{ list: "spells", values: { name: "Unmake", level: 3, prepared: true } }],
    mechanics: {
      kind: "utility",
      reaction: { on: "aimed", cancels: true },
      budget: "reaction",
      cost: [{ pool: "slots_3", amount: 1 }],
    },
  },
  {
    // The other moment: taken once something has hurt its holder, and aimed back at whoever did.
    id: "sear",
    label: "Sear",
    rows: [{ list: "spells", values: { name: "Sear", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      reaction: { on: "harmed" },
      budget: "reaction",
      amount: { dice: "2d10" },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
  {
    // Its holder picks, rather than it being aimed back at whoever caused the moment, and it may be
    // pointed at anybody. Hits hard enough to take a wizard out in one, because what this is for is
    // what happens to a held blow when one of the two it was aimed at is gone before it lands.
    id: "backlash",
    label: "Backlash",
    rows: [{ list: "spells", values: { name: "Backlash", level: 2, prepared: true } }],
    mechanics: {
      kind: "attack",
      reaction: { on: "aimed", at: "chosen" },
      budget: "reaction",
      targets: "any",
      autoHit: true,
      amount: { dice: "1d4", flat: 60 },
      damageType: "force",
    },
  },
  {
    // Free of the economy, so it is taken at its moment whether or not a reaction is left.
    id: "flinch",
    label: "Flinch",
    rows: [{ list: "spells", values: { name: "Flinch", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      reaction: { on: "harmed" },
      free: true,
      temporary: { dice: "1d4" },
    },
  },
] as unknown as RulesetCatalogEntry[];
const reactionRows = reactionEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));

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
/** The same wizard, holding the two that wait for a moment as well. */
const reactiveWizard = (live: unknown = {}): RulesetCombatantInput => {
  const base = wizardBuild();
  return {
    ...wizard(live),
    build: { ...base, lists: { ...base.lists, spells: [...spellRows, ...reactionRows] } },
    catalogs: { spells: [...spellEntries, ...reactionEntries] },
  };
};
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
    {
      id: "brenna",
      name: "Brenna",
      health: 60,
      maxHealth: 60,
      temp: 0,
      down: false,
      dying: false,
      stable: false,
      conditions: [],
    },
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

// ── A death track's top is read off the track, not assumed ──
{
  // Two successes, because this variant's successes track stops at two.
  const shorter = parsedOrThrow(
    variant(fiveEText, (doc) => {
      doc.sheet.live.tracks.find((entry: Record<string, any>) => entry.id === "death_save_successes").max = 2;
    }),
    "5e with a shorter death track",
  );
  let state = fight(shorter, [fighter({ pools: { hp: { value: 0 } } }), wizard(), rot()], 10, 9, 18);
  let last = endTurn(shorter, state, "rot", 12);
  state = endTurn(shorter, endTurn(shorter, last.state, "brenna").state, "corwin").state;
  last = endTurn(shorter, state, "rot", 14);
  assert.equal(eventsOf(last.events, "dying").at(-1)!.result, "stable", "two of the track's two are enough");
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
        stable: false,
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
    party: [
      {
        id: "juno",
        name: "Juno",
        health: 8,
        maxHealth: 8,
        temp: 0,
        down: false,
        dying: false,
        stable: false,
        conditions: [],
      },
    ],
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

  /** The bestiary is a declaration of its own, one release later, so the cases about this seam drop
   *  it and leave that gate to the slice that added it. */
  const withoutBestiary = (doc: Record<string, any>) => {
    doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.holds !== "creatures");
    if (doc.catalogs.length === 0) delete doc.catalogs;
  };
  /** The keys that give a fight a board are a declaration of their own, two releases later, so the
   *  cases about the combat seam itself drop them and leave that gate to the block below. */
  const withoutBoard = (doc: Record<string, any>) => {
    if (!doc.combat) return;
    for (const key of ["distance", "ranged", "cover", "opportunity"]) delete doc.combat[key];
    for (const source of doc.combat.attacks ?? []) {
      delete source.reach;
      delete source.range;
    }
    withoutTurnEconomy(doc);
  };
  /** And the keys that say what one turn can do, a release later still, for the same reason. */
  const withoutTurnEconomy = (doc: Record<string, any>) => {
    for (const source of doc.combat?.attacks ?? []) {
      delete source.strikes;
      delete source.strikesCappedBy;
    }
    for (const entry of doc.combat?.conditions ?? []) {
      for (const key of ["saves", "whileSourceInSight", "endsWhenSourceDown"]) delete entry[key];
      entry.effects = (entry.effects ?? []).filter(
        (effect: string) =>
          !effect.startsWith("own-saves-") &&
          effect !== "resist-all" &&
          !effect.startsWith("cannot-target-") &&
          !effect.startsWith("cannot-approach-"),
      );
    }
    for (const catalog of doc.catalogs ?? []) {
      catalog.entries = (catalog.entries ?? []).filter(
        (entry: Record<string, any>) => entry.mechanics?.kind !== "rider",
      );
      for (const entry of catalog.entries) {
        for (const key of ["plus", "free", "gives", "standard", "rider"]) delete entry.mechanics?.[key];
        delete entry.creature?.riders;
        for (const action of entry.creature?.actions ?? []) delete action.damage?.plus;
      }
    }
    withoutCreatureSheets(doc);
  };
  /** And a creature written in the ruleset's own terms, which is later again (1.34), for the same
   *  reason: an older seam is proven on a file that trips nothing newer. */
  const withoutCreatureSheets = (doc: Record<string, any>) => {
    for (const catalog of doc.catalogs ?? []) {
      catalog.entries = (catalog.entries ?? []).filter((entry: Record<string, any>) => !entry.creature?.sheet);
    }
  };
  const combatOnly = variant(emberText, (doc) => {
    delete doc.catalogs;
    withoutBoard(doc);
  });
  assert.match(
    getCapabilityPackageInstallIssue(manifest(25), combatOnly) ?? "",
    /A ruleset with a combat block requires schemaVersion 2 and capabilityApi 1\.26 or newer/,
    "the block lives inside the ruleset file, so the gate reads the file",
  );
  assert.equal(getCapabilityPackageInstallIssue(manifest(26), combatOnly), null);
  assert.equal(
    getCapabilityPackageInstallIssue(
      manifest(26),
      variant(emberText, (doc) => {
        withoutBestiary(doc);
        withoutBoard(doc);
      }),
    ),
    null,
  );

  // The mechanics a fight reads are new keys in the same strict file, inline in the ruleset or in a
  // catalog asset beside it, so both are read the same way.
  const inlineOnly = variant(emberText, (doc) => {
    withoutBestiary(doc);
    delete doc.combat;
  });
  assert.match(
    getCapabilityPackageInstallIssue(manifest(25), inlineOnly) ?? "",
    /catalog mechanics reach a fight requires schemaVersion 2 and capabilityApi 1\.26 or newer/,
  );
  const assetOnly = variant(emberText, (doc) => {
    withoutBestiary(doc);
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

  // ── Capability API 1.28: the keys that give a fight a board ──
  assert.ok(
    supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 28,
    "the host still advertises the positions seam introduced in API 1.28",
  );
  // Every one of them, one at a time, on a ruleset that is otherwise a 1.26 file.
  for (const key of ["distance", "ranged", "cover", "opportunity"] as const) {
    const one = variant(emberText, (doc) => {
      withoutBestiary(doc);
      withoutBoard(doc);
      // ONLY this key, so the refusal is its own and not the cell size's. The gate reads the raw
      // file, so a key may stand here without the `distance` the ruleset's own checks would ask for.
      doc.combat[key] =
        key === "distance"
          ? { label: "paces", perCell: 2 }
          : key === "ranged"
            ? { long: "disadvantage" }
            : key === "cover"
              ? { bonus: 2 }
              : { budget: "act" };
    });
    assert.match(
      getCapabilityPackageInstallIssue(manifest(27), one) ?? "",
      /measured in cells requires schemaVersion 2 and capabilityApi 1\.28 or newer/,
      `"${key}" is a 1.28 declaration`,
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(28), one), null);
  }
  // A weapon list that carries a distance is the same declaration.
  const weaponRange = variant(emberText, (doc) => {
    withoutBestiary(doc);
    withoutBoard(doc);
    doc.combat.attacks[0].reach = { const: 2 };
  });
  assert.match(
    getCapabilityPackageInstallIssue(manifest(27), weaponRange) ?? "",
    /measured in cells requires schemaVersion 2 and capabilityApi 1\.28 or newer/,
  );
  assert.equal(getCapabilityPackageInstallIssue(manifest(28), weaponRange), null);
  // And so is a creature whose range is an ordinary distance with a longer one beyond it, inline or
  // in a catalog file, because it is a new SHAPE for a key an older Engine reads as a number.
  const pairInline = variant(emberText, (doc) => {
    withoutBoard(doc);
    const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.holds === "creatures");
    bestiary.entries[0].creature.actions[0].range = { normal: 4, long: 8 };
  });
  assert.match(
    getCapabilityPackageInstallIssue(manifest(27), pairInline) ?? "",
    /measured in cells requires schemaVersion 2 and capabilityApi 1\.28 or newer/,
  );
  assert.equal(getCapabilityPackageInstallIssue(manifest(28), pairInline), null);
  const pairAsset = variant(emberText, (doc) => {
    withoutBoard(doc);
    withoutBestiary(doc);
    delete doc.catalogs[0].entries;
    doc.catalogs[0].asset = "catalogs/knacks.json";
  });
  const pairEntries = {
    schemaVersion: 1,
    catalog: "knacks",
    entries: [
      {
        id: "road-hound",
        label: "Road hound",
        creature: {
          health: 6,
          defense: 5,
          initiativeModifier: 0,
          tier: "stray",
          actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 1, range: { normal: 4, long: 8 } }],
        },
      },
    ],
  };
  const pairAssets = new Map([["catalogs/knacks.json", pairEntries]]);
  assert.match(
    getCapabilityPackageInstallIssue(manifest(27), pairAsset, pairAssets) ?? "",
    /measured in cells requires schemaVersion 2 and capabilityApi 1\.28 or newer/,
  );
  assert.equal(getCapabilityPackageInstallIssue(manifest(28), pairAsset, pairAssets), null);
}

// ── Slice C5a: what one turn can do ──
//
// Five things a turn could not do before this slice. Every one of them is refused where a ruleset
// names something it does not have, proven on the 5e draft and on Ember Roads, and a fight that
// declares none of them is compared event for event with the same fight without the keys at all.
{
  const withCombat = (edit: (combat: Record<string, any>) => void) =>
    variant(fiveEText, (doc) => edit(doc.combat as Record<string, any>));
  const withEntry = (text: string, edit: (mechanics: Record<string, any>) => void) =>
    variant(text, (doc) => {
      const rows = (doc.catalogs as Array<Record<string, any>>).find((catalog) => catalog.holds !== "creatures")!;
      const entry = rows.entries[0] as Record<string, any>;
      entry.mechanics = entry.mechanics ?? { kind: "utility" };
      edit(entry.mechanics as Record<string, any>);
    });
  const withCreature = (edit: (creature: Record<string, any>) => void) =>
    variant(fiveEText, (doc) => {
      const bestiary = (doc.catalogs as Array<Record<string, any>>).find((catalog) => catalog.holds === "creatures")!;
      edit(bestiary.entries[0].creature as Record<string, any>);
    });

  // ── What the format refuses ──
  assert.match(
    refusal(withCreature((creature) => (creature.actions[0].damage.plus = [{ type: "fire" }]))),
    /A clause names dice, a flat amount, or both/,
  );
  assert.match(
    refusal(withCreature((creature) => (creature.actions[0].damage.plus = [{ dice: "1d6", type: "moonlight" }]))),
    /Unknown damage type "moonlight"/,
  );
  assert.match(
    refusal(
      withCreature((creature) => {
        creature.actions[0].damage.plus = [
          { dice: "1d6", save: { save: "luck_save", difficulty: 12, onSuccess: "half" } },
        ];
      }),
    ),
    /Unknown save "luck_save"/,
  );
  // A clause save with no number of its own, on an action with none either, would be rolled
  // against nothing and everybody would pass it.
  assert.match(
    refusal(
      withCreature((creature) => {
        creature.actions[0].damage.plus = [{ dice: "1d6", save: { save: "con_save", onSuccess: "half" } }];
      }),
    ),
    /This clause's save has no difficulty to be rolled against/,
  );
  assert.match(
    refusal(
      withCreature(
        (creature) => (creature.actions[0].damage.plus = [1, 2, 3, 4].map(() => ({ dice: "1d4", type: "fire" }))),
      ),
    ),
    /at most 3 element/,
  );
  assert.match(
    refusal(withEntry(emberText, (mechanics) => (mechanics.plus = [{ dice: "1d6" }]))),
    /A clause needs an amount beside it/,
  );
  assert.match(
    refusal(
      withEntry(emberText, (mechanics) => {
        mechanics.kind = "heal";
        mechanics.amount = { dice: "1d6" };
        mechanics.plus = [{ dice: "1d4" }];
      }),
    ),
    /A heal carries no damage clauses/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.attacks[0].strikes = { field: "class" }))),
    /Field "class" is not a number/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.attacks[0].strikes = { const: 0 }))),
    /One spend buys at least one strike/,
  );
  // A cap names a boolean column of the list it caps, and says nothing on a list that buys one
  // strike a spend anyway.
  assert.match(
    refusal(
      withCombat((combat) => {
        combat.attacks[0].strikes = { const: 2 };
        combat.attacks[0].strikesCappedBy = { column: "damage" };
      }),
    ),
    /Must name a boolean column/,
  );
  assert.match(
    refusal(
      withCombat((combat) => {
        delete combat.attacks[0].strikes;
        combat.attacks[0].strikesCappedBy = { column: "finesse" };
      }),
    ),
    /this list buys one strike a spend anyway/,
  );
  assert.match(
    refusal(
      withEntry(emberText, (mechanics) => {
        mechanics.free = true;
        mechanics.budget = "act";
      }),
    ),
    /Something free spends no budget, so it names none/,
  );
  assert.match(
    refusal(withEntry(emberText, (mechanics) => (mechanics.gives = [{ budget: "swing", count: 1 }]))),
    /Unknown budget "swing"/,
  );
  assert.match(
    refusal(withEntry(emberText, (mechanics) => (mechanics.standard = { actions: ["dash"], budget: "act" }))),
    /This ruleset does not have the standard action "dash"/,
  );
  // Ember Roads' only budget IS the one a standard action is already taken for, so a permission
  // naming it grants nothing and would offer the same action twice, once at each id.
  assert.match(
    refusal(withEntry(emberText, (mechanics) => (mechanics.standard = { actions: ["dodge"], budget: "act" }))),
    /Every standard action is already taken for "act", so this permission grants nothing/,
  );
  assert.match(
    refusal(withEntry(emberText, (mechanics) => (mechanics.standard = { actions: ["dodge"], budget: "swing" }))),
    /Unknown budget "swing"/,
  );
  const riderEntry = (rider: Record<string, any>, extra: Record<string, any> = {}) =>
    withEntry(fiveEText, (mechanics) => {
      for (const key of Object.keys(mechanics)) delete mechanics[key];
      mechanics.kind = "rider";
      mechanics.rider = { on: "hit", oncePer: "turn", amount: { dice: "1d6" }, ...rider };
      Object.assign(mechanics, extra);
    });
  assert.match(refusal(riderEntry({ sources: ["spells"] })), /"spells" is not one of this ruleset's attack lists/);
  assert.match(refusal(riderEntry({ requires: { column: "shiny" } })), /No attack list this rider reads has a column/);
  assert.match(refusal(riderEntry({ type: "moonlight" })), /Unknown damage type "moonlight"/);
  assert.match(refusal(riderEntry({}, { amount: { dice: "1d4" } })), /A rider is passive/);
  assert.match(
    refusal(
      withEntry(fiveEText, (mechanics) => (mechanics.rider = { on: "hit", oncePer: "turn", amount: { flat: 1 } })),
    ),
    /An entry with a rider is of the kind "rider"/,
  );
  assert.match(
    refusal(
      withCreature((creature) => {
        creature.riders = [
          { id: "sly", name: "Sly", on: "hit", oncePer: "turn", amount: { dice: "1d6" }, actions: ["nothing"] },
        ];
      }),
    ),
    /Unknown action "nothing"/,
  );
  assert.match(
    refusal(
      withCombat((combat) => {
        combat.conditions[0].effects = ["own-saves-disadvantage"];
        combat.conditions[0].saves = ["luck_save"];
      }),
    ),
    /Unknown save "luck_save"/,
  );
  assert.match(
    refusal(withCombat((combat) => (combat.conditions[0].saves = ["dex_save"]))),
    /"saves" narrows own-saves-advantage and own-saves-disadvantage/,
  );

  // ── A blow made of several clauses ──
  //
  // The clauses ride a party member's own ability, because what a clause is FOR is a blow whose
  // parts are answered one at a time, and only an opponent's block carries the hide that answers.
  const clauseEntries = [
    {
      id: "ember-lash",
      label: "Ember Lash",
      rows: [{ list: "spells", values: { name: "Ember Lash", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        attackRoll: true,
        amount: { dice: "1d6" },
        damageType: "piercing",
        plus: [
          { dice: "1d4", type: "fire" },
          { flat: 4, type: "poison", save: { save: "con_save", difficulty: 12, onSuccess: "half" } },
        ],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const caster = (): RulesetCombatantInput => ({
    id: "wren",
    name: "Wren",
    side: "party",
    build: build({
      abilities: { str: 8, dex: 12, con: 12, int: 18, wis: 12, cha: 10 },
      fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int" },
      lists: { spells: clauseEntries.flatMap((entry) => rowsFromCatalogEntry("clauses", entry).map((row) => row.row)) },
    }),
    live: {},
    catalogs: { clauses: clauseEntries },
  });
  const lashAt = (state: RulesetEncounterState) =>
    rulesetCombatOptions(fiveE, state, "wren").find((option) => option.label === "Ember Lash")!.id;
  const clawed = (id: string, hide: Partial<RulesetStatBlock> = {}): RulesetCombatantInput =>
    foe(id, "Clawed thing", {
      health: 90,
      defense: 1,
      initiativeModifier: -5,
      saves: { con_save: 0 },
      actions: [],
      ...hide,
    });
  const biterBlock = (): RulesetStatBlock => ({
    health: 40,
    defense: 1,
    initiativeModifier: 9,
    actions: [
      {
        id: "bite",
        name: "Bite",
        budget: "action",
        toHit: 10,
        damage: {
          count: 1,
          sides: 6,
          flat: 0,
          type: "piercing",
          plus: [
            { count: 1, sides: 4, flat: 0, type: "fire" },
            {
              count: 0,
              sides: 0,
              flat: 4,
              type: "poison",
              save: { save: "con_save", difficulty: 12, onSuccess: "half" },
            },
          ],
        },
      },
    ],
  });
  const biter = (): RulesetCombatantInput => foe("biter", "Biter", biterBlock());

  {
    // Resistant to fire and immune to poison: each clause is answered on its own, and the piercing
    // the blow started with lands in full.
    const state = fight(fiveE, [caster(), clawed("hide", { resist: ["fire"], immune: ["poison"] })], 20, 1);
    assert.equal(currentRulesetActor(state)?.id, "wren");
    const blow = act(fiveE, state, { actorId: "wren", optionId: lashAt(state), targetIds: ["hide"] }, 15, 4, 3, 5);
    assert.deepEqual(
      blow.events.map((event) => event.type),
      ["budget", "attack", "damage", "damage", "save", "damage"],
      "each clause is rolled where it lands, and a clause with a save of its own rolls it first",
    );
    assert.deepEqual(
      eventsOf(blow.events, "damage").map((event) => [event.damageType, event.amount, event.dealt, event.adjust]),
      [
        ["piercing", 4, 4, "none"],
        ["fire", 3, 1, "resist"],
        ["poison", 4, 0, "immune"],
      ],
    );
    assert.equal(eventsOf(blow.events, "damage").at(-1)!.health, 85, "four off, then one, then nothing");
    assert.equal(firstOf(blow.events, "save").success, false);
  }

  {
    // A clause's own save is taken by the TARGET while the action's is not, and halves that clause
    // and nothing else.
    const state = fight(fiveE, [caster(), clawed("hide")], 20, 1);
    const saved = act(fiveE, state, { actorId: "wren", optionId: lashAt(state), targetIds: ["hide"] }, 15, 6, 2, 19);
    assert.deepEqual(
      eventsOf(saved.events, "damage").map((event) => [event.damageType, event.dealt, !!event.saved]),
      [
        ["piercing", 6, false],
        ["fire", 2, false],
        ["poison", 2, true],
      ],
    );
    assert.equal(firstOf(saved.events, "save").success, true);
  }

  {
    // The ACTION's own save-for-half covers the first amount and every clause that asked for no
    // save of its own; a clause with one follows its own roll instead.
    const wide = [
      {
        id: "ash-fall",
        label: "Ash Fall",
        rows: [{ list: "spells", values: { name: "Ash Fall", level: 1, prepared: true } }],
        mechanics: {
          kind: "attack",
          amount: { dice: "1d6" },
          damageType: "piercing",
          save: { save: "dex_save", onSuccess: "half" },
          plus: [
            { dice: "1d4", type: "fire" },
            { flat: 8, type: "poison", save: { save: "con_save", difficulty: 12, onSuccess: "half" } },
          ],
        },
      },
    ] as unknown as RulesetCatalogEntry[];
    const thrower = (): RulesetCombatantInput => ({
      id: "wren",
      name: "Wren",
      side: "party",
      build: build({
        abilities: { str: 8, dex: 12, con: 12, int: 18, wis: 12, cha: 10 },
        fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int" },
        lists: { spells: wide.flatMap((entry) => rowsFromCatalogEntry("wide", entry).map((row) => row.row)) },
      }),
      live: {},
      catalogs: { wide: wide },
    });
    const state = fight(fiveE, [thrower(), clawed("hide")], 20, 1);
    const option = rulesetCombatOptions(fiveE, state, "wren").find((entry) => entry.label === "Ash Fall")!;
    // The target passes the action's save and fails the clause's own.
    const step = act(fiveE, state, { actorId: "wren", optionId: option.id, targetIds: ["hide"] }, 20, 6, 4, 3);
    const saves = eventsOf(step.events, "save");
    assert.deepEqual(
      saves.map((event) => [event.save, event.success]),
      [
        ["dex_save", true],
        ["con_save", false],
      ],
      "the action's save first, then the clause's own",
    );
    assert.deepEqual(
      eventsOf(step.events, "damage").map((event) => [event.damageType, event.amount, !!event.saved]),
      [
        ["piercing", 3, true],
        ["fire", 2, true],
        ["poison", 8, false],
      ],
      "halved by the action's save, except the clause that asked for a save of its own",
    );
  }

  {
    // A critical doubles every clause's dice, by the same rule the ruleset declared for the first.
    const state = fight(fiveE, [caster(), clawed("hide")], 20, 1);
    const crit = act(
      fiveE,
      state,
      { actorId: "wren", optionId: lashAt(state), targetIds: ["hide"] },
      20,
      3,
      4,
      2,
      1,
      5,
    );
    assert.equal(firstOf(crit.events, "attack").outcome, "critical");
    const damages = eventsOf(crit.events, "damage");
    assert.deepEqual(
      damages.map((event) => [event.damageType, event.rolls, event.flat, event.amount]),
      [
        ["piercing", [3, 4], 0, 7],
        ["fire", [2, 1], 0, 3],
        ["poison", [], 4, 4],
      ],
      "a clause with dice throws them again; one made of a flat amount has none to throw",
    );
    assert.ok(damages.every((event) => event.critical));
  }

  {
    // ONE check against concentration, made with the whole blow's damage.
    const state = fight(fiveE, [wizard(), biter()], 1, 20);
    let running = endTurn(fiveE, state, "biter").state;
    const holdFast = rulesetCombatOptions(fiveE, running, "corwin").find((option) => option.label === "Hold Fast")!;
    // The biter shakes the hold off, so it is still the thing that bites back.
    running = act(fiveE, running, { actorId: "corwin", optionId: holdFast.id, targetIds: ["biter"] }, 19).state;
    assert.equal(who(running, "corwin").concentrating?.label, "Hold Fast");
    running = endTurn(fiveE, running, "corwin").state;
    assert.equal(currentRulesetActor(running)?.id, "biter");
    const struck = act(fiveE, running, { actorId: "biter", optionId: "bite", targetIds: ["corwin"] }, 15, 6, 4, 3, 14);
    const saves = eventsOf(struck.events, "save");
    assert.equal(saves.length, 2, "one for the clause, one for the concentration, and no more");
    assert.equal(saves.at(-1)!.save, fiveE.combat!.concentration!.save);
    assert.equal(
      eventsOf(struck.events, "damage").reduce((total, event) => total + event.dealt, 0),
      14,
      "the blow was fourteen all together",
    );
    assert.equal(saves.at(-1)!.difficulty, 10, "half of fourteen is under the floor, so the floor is the number");
    assert.equal(who(struck.state, "corwin").concentrating?.label, "Hold Fast", "and it held");
  }

  {
    // And ONE check for going down: a blow whose clauses finish somebody reports it once.
    const thin = foe("thin", "Thin thing", { health: 8, defense: 1, initiativeModifier: -5, actions: [] });
    const state = fight(fiveE, [caster(), thin], 20, 1);
    const down = act(fiveE, state, { actorId: "wren", optionId: lashAt(state), targetIds: ["thin"] }, 15, 6, 4, 5);
    assert.deepEqual(
      down.events.map((event) => event.type),
      ["budget", "attack", "damage", "damage", "save", "damage", "defeated", "outcome"],
      "three amounts, and one end of the fight for the lot",
    );
  }

  {
    // The whole path, from the shipped file to the fight: the bestiary's own hound, whose bite
    // carries a second clause, read out of the example rather than written here.
    const bestiary = fiveE.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
    const state = createRulesetEncounter({
      definition: fiveE,
      seed: 3,
      bestiary: { creatures: bestiary },
      combatants: [
        {
          id: "hound",
          name: "Cinder Hound",
          side: "enemy",
          creature: { catalogId: "creatures", entryId: "cinder-hound" },
        },
        fighter(),
      ],
      roller: dice(20, 8, 8, 8, 8, 8, 1),
    });
    assert.equal(currentRulesetActor(state)?.id, "hound");
    const bit = act(fiveE, state, { actorId: "hound", optionId: "sear_bite", targetIds: ["brenna"] }, 15, 4, 2);
    assert.deepEqual(
      eventsOf(bit.events, "damage").map((event) => [event.damageType, event.dealt]),
      [
        ["piercing", 5],
        ["fire", 2],
      ],
      "the tooth and the heat are two amounts of one blow",
    );
  }

  // ── A character who can do more with one turn ──
  const feats = fiveE.catalogs!.find((catalog) => catalog.id === "feats")!.entries!;
  const featRows = (ids: string[], list: string) =>
    ids.flatMap((id) =>
      rowsFromCatalogEntry(
        "feats",
        feats.find((entry) => entry.id === id)!,
      )
        .filter((row) => row.list === list)
        .map((row) => row.row),
    );
  const weapon = (name: string, ability: string, damage: string, type: string, finesse: boolean, loading = false) => ({
    name,
    ability,
    proficient: true,
    bonus: 0,
    damage,
    damage_type: type,
    finesse,
    loading,
    reach: 5,
    range: 0,
    long_range: 0,
  });
  const rogueBuild = (ids: string[], strikes: number) =>
    build({
      abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 10, cha: 10 },
      saves: { dex_save: "proficient" },
      fields: { level: 7, ac: 15, speed: 30, hp_max: 44, attacks_per_action: strikes },
      lists: {
        attacks: [
          weapon("Rapier", "dex", "1d8", "piercing", true),
          weapon("Club", "str", "1d4", "bludgeoning", false),
          // One shot a turn however many attacks its wielder has: SRD Loading.
          weapon("Crossbow", "dex", "1d8", "piercing", false, true),
        ],
        features: featRows(ids, "features"),
        counters: featRows(ids, "counters"),
      },
    });
  const rogue = (ids: string[] = [], strikes = 1): RulesetCombatantInput => ({
    id: "vess",
    name: "Vess",
    side: "party",
    build: rogueBuild(ids, strikes),
    live: {},
    catalogs: { feats },
  });
  const sack = (id = "sack"): RulesetCombatantInput =>
    foe(id, "Sack", { health: 300, defense: 1, initiativeModifier: -9, actions: [] });
  const optionFor = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(fiveE, state, "vess").find((option) => option.label === label)!;

  {
    // Three strikes for one spend: the first pays, the rest are free, a different weapon between
    // them is neither refused nor charged, and a fourth asks for a budget again.
    let state = fight(fiveE, [rogue([], 3), sack()], 20, 1);
    assert.equal(who(state, "vess").actions[0]!.strikes, 3, "the sheet's own number, read once");
    // SRD Loading: a crossbow is one shot a turn however many attacks its wielder has, and
    // `strikesCappedBy` is what says so per ROW while the count stays the list's.
    const crossbow = who(state, "vess").actions.find((action) => action.label === "Crossbow")!;
    assert.equal(crossbow.strikes, undefined, "a capped row buys no strikes to keep in hand");
    assert.equal(
      who(state, "vess").actions.find((action) => action.label === "Club")!.strikes,
      3,
      "and the rest of the list is untouched by one row's cap",
    );
    let step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5);
    assert.deepEqual(
      step.events.map((event) => event.type),
      ["budget", "strikes", "attack", "damage"],
    );
    assert.deepEqual(firstOf(step.events, "strikes"), {
      type: "strikes",
      actorId: "vess",
      optionId: "attack:0:0",
      label: "Rapier",
      left: 2,
    });
    state = step.state;
    assert.equal(who(state, "vess").budgets.action, 0);
    assert.equal(who(state, "vess").strikesLeft, 2);

    const club = optionFor(state, "Club");
    assert.equal(club.budget, undefined, "another weapon from the same list costs no budget either");
    assert.equal(club.strikes, 2, "and the menu says how many are in hand");
    step = act(fiveE, state, { actorId: "vess", optionId: club.id, targetIds: ["sack"] }, 18, 3);
    assert.deepEqual(
      step.events.map((event) => event.type),
      ["strikes", "attack", "damage"],
      "nothing is spent on a strike that was already bought",
    );
    state = step.state;
    assert.equal(who(state, "vess").budgets.action, 0, "the budget was spent once, for all of them");
    assert.equal(who(state, "vess").strikesLeft, 1);
    assert.equal(
      rulesetCombatOptions(fiveE, state, "vess").find((option) => option.id === "standard:dodge"),
      undefined,
      "strikes bought swings, not a turn's worth of everything",
    );

    step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 7);
    assert.equal(firstOf(step.events, "strikes").left, 0, "the last of them says so");
    state = step.state;
    assert.equal(who(state, "vess").strikesLeft, undefined);
    assert.deepEqual(act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }).events, [
      { type: "refused", actorId: "vess", optionId: "attack:0:0", reason: "no-budget" },
    ]);

    // Nothing is carried into the next turn.
    state = endTurn(fiveE, endTurn(fiveE, state, "vess").state, "sack").state;
    assert.equal(currentRulesetActor(state)?.id, "vess");
    assert.equal(who(state, "vess").strikesLeft, undefined, "strikes do not outlive the turn that bought them");
    assert.equal(optionFor(state, "Rapier").budget, "action", "so the next turn pays for its own");
  }

  {
    // A list that buys one strike a spend behaves exactly as every list did before this existed.
    const state = fight(fiveE, [rogue([], 1), sack()], 20, 1);
    const step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5);
    assert.deepEqual(
      step.events.map((event) => event.type),
      ["budget", "attack", "damage"],
    );
    assert.equal(who(step.state, "vess").strikesLeft, undefined);
  }

  {
    // Free of the economy, and it hands a budget back, capped so nothing can be banked.
    let state = fight(fiveE, [rogue(["second-effort"]), sack()], 20, 1);
    const surge = optionFor(state, "Second Effort");
    assert.equal(surge.budget, undefined, "something free spends no budget");
    assert.deepEqual(surge.cost, [{ pool: "counters:second effort", label: "Second Effort", amount: 1 }]);
    const step = act(fiveE, state, { actorId: "vess", optionId: surge.id, targetIds: [] });
    assert.deepEqual(
      step.events.map((event) => event.type),
      ["spend", "gives"],
    );
    assert.deepEqual(firstOf(step.events, "gives"), {
      type: "gives",
      actorId: "vess",
      optionId: surge.id,
      label: "Second Effort",
      budget: "action",
      left: 2,
    });
    state = step.state;
    assert.equal(who(state, "vess").budgets.action, 2, "one turn's worth, plus the gift, and no more");
    assert.equal(
      rulesetCombatOptions(fiveE, state, "vess").find((option) => option.label === "Second Effort"),
      undefined,
      "the counter that tracks it is spent, so the sheet would refuse a second use",
    );
    state = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5).state;
    state = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5).state;
    assert.equal(who(state, "vess").budgets.action, 0, "two actions, really");
    state = endTurn(fiveE, endTurn(fiveE, state, "vess").state, "sack").state;
    assert.equal(who(state, "vess").budgets.action, 1, "and a turn gives back what a turn holds");
  }

  {
    // A standard action bought with another budget, offered beside the ordinary ones.
    const state = fight(fiveE, [rogue(["quick-hands"]), sack()], 20, 1);
    const menu = rulesetCombatOptions(fiveE, state, "vess");
    assert.equal(
      menu.find((option) => option.label === "Quick Hands"),
      undefined,
      "a permission is not itself something to take",
    );
    assert.deepEqual(
      menu.filter((option) => option.id.includes("@")).map((option) => [option.id, option.budget]),
      [
        ["standard:dash@bonus", "bonus"],
        ["standard:disengage@bonus", "bonus"],
        ["standard:hide@bonus", "bonus"],
      ],
      "only the three the entry named, and only for the budget it named",
    );
    // Nobody helps themselves, whichever budget the help was bought with: the rule reads the
    // action's NAME, so the budgeted id is held to it exactly as the plain one is. The permission
    // is edited on the PICKED entry, which is what the fight reads, not on the file's own copy.
    {
      const helpful = feats.map((entry) =>
        entry.id === "quick-hands"
          ? { ...entry, mechanics: { ...entry.mechanics!, standard: { actions: ["help"], budget: "bonus" } } }
          : entry,
      ) as typeof feats;
      const withHelp = createRulesetEncounter({
        definition: fiveE,
        seed: 4242,
        combatants: [
          { ...rogue(["quick-hands"]), catalogs: { feats: helpful } },
          { ...rogue(["quick-hands"]), catalogs: { feats: helpful }, id: "mate", name: "Mate" },
          sack(),
        ],
        roller: dice(20, 10, 1),
      });
      for (const id of ["standard:help", "standard:help@bonus"]) {
        const help = rulesetCombatOptions(fiveE, withHelp, "vess").find((option) => option.id === id);
        assert.ok(help, `${id} is on the menu`);
        const targets = rulesetOptionTargets(fiveE, withHelp, "vess", help);
        assert.equal(targets.includes("vess"), false, `${id} is never pointed at the one taking it`);
        assert.ok(targets.includes("mate"), `${id} reaches the ally beside them`);
      }
    }

    // A permission that has run out is off the menu, and resolution has to agree: taking it through
    // the exhausted ability is refused rather than quietly resolved through some other one.
    {
      const spent = structuredClone(state);
      const holder = who(spent, "vess");
      const permission = holder.actions.find((option) => option.standard)!;
      holder.uses[permission.id] = 0;
      permission.uses = { per: "encounter", count: 1 };
      assert.equal(
        rulesetCombatOptions(fiveE, spent, "vess").some((option) => option.id === "standard:dash@bonus"),
        false,
        "an ability with nothing left does not offer what it allows",
      );
      assert.deepEqual(
        act(fiveE, spent, { actorId: "vess", optionId: "standard:dash@bonus", targetIds: [] }).events,
        [{ type: "refused", actorId: "vess", optionId: "standard:dash@bonus", reason: "insufficient" }],
        "and resolution refuses it for the same reason rather than finding another way",
      );
    }

    const step = act(fiveE, state, { actorId: "vess", optionId: "standard:dash@bonus", targetIds: [] });
    assert.deepEqual(
      step.events.map((event) => event.type),
      ["budget", "standard"],
    );
    assert.deepEqual(firstOf(step.events, "budget"), { type: "budget", actorId: "vess", budget: "bonus", left: 0 });
    assert.deepEqual(firstOf(step.events, "standard"), { type: "standard", actorId: "vess", action: "dash" });
    assert.equal(who(step.state, "vess").budgets.action, 1, "the main budget is untouched");
    assert.equal(who(step.state, "vess").flags.dashed, true);
    assert.equal(
      rulesetCombatOptions(fiveE, step.state, "vess").find((option) => option.id === "standard:dash")?.budget,
      "action",
      "the ordinary one is still there, and still spends the main budget",
    );
    assert.deepEqual(act(fiveE, state, { actorId: "vess", optionId: "standard:dash@reaction", targetIds: [] }).events, [
      { type: "refused", actorId: "vess", optionId: "standard:dash@reaction", reason: "unknown-option" },
    ]);
  }

  // ── Riders ──
  {
    let state = fight(fiveE, [rogue(["sly-strike"], 3), fighter(), sack()], 20, 10, 1);
    assert.deepEqual(
      who(state, "vess").riders?.map((rider) => [rider.label, rider.oncePer, rider.amount.count, rider.actions]),
      [["Sly Strike", "turn", 4, ["attack:0:0"]]],
      "the rider grew with the sheet, and only the finesse weapon is on its list",
    );
    // A friend is in the fight and on their feet, so the any-of condition holds.
    let step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5, 1, 1, 1, 1);
    assert.deepEqual(
      step.events.map((event) => event.type),
      ["budget", "strikes", "attack", "damage", "rider", "damage"],
      "the rider is one more amount of the blow that carried it",
    );
    assert.deepEqual(firstOf(step.events, "rider"), {
      type: "rider",
      actorId: "vess",
      targetId: "sack",
      riderId: "rider:1:0",
      label: "Sly Strike",
    });
    const extra = eventsOf(step.events, "damage").at(-1)!;
    assert.deepEqual(
      [extra.rolls, extra.damageType, extra.dealt],
      [[1, 1, 1, 1], "piercing", 4],
      "it takes the blow's own kind of harm",
    );
    state = step.state;

    // And not twice in the same turn, however many strikes are left.
    step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5);
    assert.equal(eventsOf(step.events, "rider").length, 0, "once a turn is once a turn");
    state = step.state;

    // The turn comes round again and so does the rider.
    state = endTurn(fiveE, endTurn(fiveE, endTurn(fiveE, state, "vess").state, "brenna").state, "sack").state;
    assert.equal(currentRulesetActor(state)?.id, "vess");
    step = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5, 2, 2, 2, 2);
    assert.equal(eventsOf(step.events, "rider").length, 1, "a fresh turn is a fresh rider");
  }

  {
    // A weapon the rider does not come off, and a fight with nobody to stand beside the target:
    // either one is enough to keep it out of the blow.
    const withFriend = fight(fiveE, [rogue(["sly-strike"], 3), fighter(), sack()], 20, 10, 1);
    const club = act(fiveE, withFriend, { actorId: "vess", optionId: "attack:0:1", targetIds: ["sack"] }, 18, 3);
    assert.equal(eventsOf(club.events, "rider").length, 0, "the club is not on the rider's own list of rows");
    const alone = fight(fiveE, [rogue(["sly-strike"], 3), sack()], 20, 1);
    const swing = act(fiveE, alone, { actorId: "vess", optionId: "attack:0:0", targetIds: ["sack"] }, 18, 5);
    assert.equal(eventsOf(swing.events, "rider").length, 0, "no advantage, and nobody beside the target");

    // An action that deals nothing never carries one either: a rider is extra damage on a blow, and
    // a blow that struck for nothing has nothing to add to.
    const helper = fight(fiveE, [rogue(["sly-strike"], 3), fighter(), sack()], 20, 10, 1);
    const helped = act(fiveE, helper, { actorId: "vess", optionId: "standard:help", targetIds: ["brenna"] });
    assert.equal(eventsOf(helped.events, "rider").length, 0, "helping an ally is not a hit and carries no rider");
    assert.equal(eventsOf(helped.events, "damage").length, 0, "and it deals nothing, which is the point");
  }

  {
    // A creature carries its own, and a rider that says "round" waits for the round to turn over.
    const packBlock = (): RulesetStatBlock => ({
      health: 30,
      defense: 1,
      initiativeModifier: 9,
      actions: [{ id: "nip", name: "Nip", budget: "action", toHit: 10, damage: { count: 1, sides: 4, flat: 0 } }],
      riders: [{ id: "pack", label: "Pack", on: "hit", oncePer: "round", amount: { count: 0, sides: 0, flat: 3 } }],
    });
    let state = fight(fiveE, [fighter(), foe("pack", "Pack thing", packBlock())], 1, 20);
    let step = act(fiveE, state, { actorId: "pack", optionId: "nip", targetIds: ["brenna"] }, 15, 2);
    assert.deepEqual(
      eventsOf(step.events, "damage").map((event) => event.dealt),
      [2, 3],
      "the pack's own rider is one more amount of the blow",
    );
    state = step.state;
    // A second strike on the same round, on somebody else's turn, does not carry it again.
    state = endTurn(fiveE, state, "pack").state;
    assert.equal(currentRulesetActor(state)?.id, "brenna");
    assert.equal(who(state, "pack").ridersSpent?.length, 1, "a round rider is still spent on the next turn");
    state = endTurn(fiveE, state, "brenna").state;
    assert.equal(who(state, "pack").ridersSpent, undefined, "and fresh when the round turns over");
  }

  // ── The condition vocabulary ──
  {
    // Saves narrowed to the ones the condition is about: the sheet's own Dexterity save is rolled
    // twice and the worse kept, and a Constitution save is rolled once.
    const binderBlock = (): RulesetStatBlock => ({
      health: 30,
      defense: 1,
      initiativeModifier: 9,
      actions: [
        {
          id: "bind",
          name: "Bind",
          budget: "action",
          autoHit: true,
          applies: [{ condition: "restrained", duration: { rounds: 5 } }],
        },
        {
          id: "sweep",
          name: "Sweep",
          budget: "action",
          damage: { count: 1, sides: 4, flat: 0 },
          save: { save: "dex_save", difficulty: 12, onSuccess: "half" },
        },
        {
          id: "fumes",
          name: "Fumes",
          budget: "action",
          damage: { count: 1, sides: 4, flat: 0 },
          save: { save: "con_save", difficulty: 12, onSuccess: "half" },
        },
      ],
    });
    let state = fight(fiveE, [rogue(), foe("binder", "Binder", binderBlock())], 1, 20);
    state = act(fiveE, state, { actorId: "binder", optionId: "bind", targetIds: ["vess"] }).state;
    assert.ok(rulesetCombatConditions(fiveE, who(state, "vess")).includes("restrained"));
    state = endTurn(fiveE, endTurn(fiveE, state, "binder").state, "vess").state;
    const swept = act(fiveE, state, { actorId: "binder", optionId: "sweep", targetIds: ["vess"] }, 18, 4, 3);
    const dexSave = firstOf(swept.events, "save");
    assert.deepEqual(
      [dexSave.save, dexSave.mode, dexSave.rolls, dexSave.kept],
      ["dex_save", "disadvantage", [18, 4], 4],
      "the save the condition names is rolled twice and the worse one kept",
    );
    const fumed = act(fiveE, state, { actorId: "binder", optionId: "fumes", targetIds: ["vess"] }, 18, 3);
    const conSave = firstOf(fumed.events, "save");
    assert.deepEqual(
      [conSave.save, conSave.mode, conSave.rolls],
      ["con_save", undefined, [18]],
      "a save the condition does not name is the one throw it always was",
    );
  }

  {
    // Dodging is the other half of the same action: harder to hit, AND the saves the ruleset names
    // are rolled with advantage while it lasts. The 5e example names its Dexterity save.
    const sweeper = () =>
      foe("binder", "Binder", {
        health: 40,
        defense: 10,
        initiativeModifier: -5,
        actions: [
          {
            id: "sweep",
            name: "Sweep",
            budget: "action",
            damage: { count: 1, sides: 6, flat: 0 },
            save: { save: "dex_save", difficulty: 12, onSuccess: "half" },
          },
        ],
      });
    const before = fight(fiveE, [rogue(), sweeper()], 20, 1);
    // Vess is up first either way: once ending the turn without dodging, once dodging first. The
    // dodge lasts until the start of their own next turn, so the binder's sweep meets it.
    const stoodStill = endTurn(fiveE, before, "vess").state;
    const flat = act(fiveE, stoodStill, { actorId: "binder", optionId: "sweep", targetIds: ["vess"] }, 7, 3);
    assert.deepEqual(
      [firstOf(flat.events, "save").mode, firstOf(flat.events, "save").rolls],
      [undefined, [7]],
      "standing still, the save is the one throw it always was",
    );
    const dodged = endTurn(
      fiveE,
      act(fiveE, before, { actorId: "vess", optionId: "standard:dodge", targetIds: [] }).state,
      "vess",
    ).state;
    const swept = act(fiveE, dodged, { actorId: "binder", optionId: "sweep", targetIds: ["vess"] }, 7, 19, 3);
    const save = firstOf(swept.events, "save");
    assert.deepEqual(
      [save.save, save.mode, save.rolls, save.kept],
      ["dex_save", "advantage", [7, 19], 19],
      "dodging, the named save is rolled twice and the better one kept",
    );
    // And only the saves it names: a ruleset that names none is unchanged by dodging.
    const plain = parsedOrThrow(
      variant(fiveEText, (doc) => delete doc.combat.standardEffects),
      "a ruleset whose dodge says nothing about saves",
    );
    const plainly = fight(plain, [rogue(), sweeper()], 20, 1);
    const stillDodging = endTurn(
      plain,
      act(plain, plainly, { actorId: "vess", optionId: "standard:dodge", targetIds: [] }).state,
      "vess",
    ).state;
    const plainSweep = act(plain, stillDodging, { actorId: "binder", optionId: "sweep", targetIds: ["vess"] }, 7, 3);
    assert.equal(firstOf(plainSweep.events, "save").mode, undefined);
  }

  {
    // Half of every kind of harm, whatever the hide underneath says, and on a sheet-backed
    // character who has no hide at all.
    const tough = parsedOrThrow(
      variant(fiveEText, (doc) => {
        const poisoned = (doc.combat.conditions as Array<Record<string, any>>).find(
          (entry) => entry.condition === "poisoned",
        )!;
        poisoned.effects = ["resist-all"];
      }),
      "a ruleset whose poison is a hide",
    );
    const dousedBlock = (): RulesetStatBlock => ({
      health: 30,
      defense: 1,
      initiativeModifier: 9,
      actions: [
        {
          id: "douse",
          name: "Douse",
          budget: "action",
          autoHit: true,
          applies: [{ condition: "poisoned", duration: { rounds: 5 } }],
        },
        { id: "hit", name: "Hit", budget: "action", toHit: 10, damage: { count: 0, sides: 0, flat: 9 } },
      ],
    });
    let state = fight(tough, [fighter(), foe("douser", "Douser", dousedBlock())], 1, 20);
    const plain = act(tough, state, { actorId: "douser", optionId: "hit", targetIds: ["brenna"] }, 15);
    assert.equal(firstOf(plain.events, "damage").dealt, 9, "nine, before anything said otherwise");
    state = act(tough, state, { actorId: "douser", optionId: "douse", targetIds: ["brenna"] }).state;
    state = endTurn(tough, endTurn(tough, state, "douser").state, "brenna").state;
    const halved = act(tough, state, { actorId: "douser", optionId: "hit", targetIds: ["brenna"] }, 15);
    assert.deepEqual(
      [firstOf(halved.events, "damage").dealt, firstOf(halved.events, "damage").adjust],
      [4, "resist"],
      "and half of it afterwards, on a character with no hide of their own",
    );
  }

  {
    // Whoever put a condition on somebody may be off limits to them, and the condition may end the
    // moment that somebody goes down.
    const charmerBlock = (): RulesetStatBlock => ({
      health: 4,
      defense: 1,
      initiativeModifier: 9,
      actions: [
        {
          id: "gaze",
          name: "Gaze",
          budget: "action",
          autoHit: true,
          applies: [{ condition: "charmed", duration: { rounds: 9 } }],
        },
      ],
    });
    let state = fight(fiveE, [fighter(), rogue(), foe("charmer", "Charmer", charmerBlock())], 5, 1, 20);
    state = act(fiveE, state, { actorId: "charmer", optionId: "gaze", targetIds: ["brenna"] }).state;
    assert.equal(who(state, "brenna").tracked.find((entry) => entry.condition === "charmed")?.source, "charmer");
    state = endTurn(fiveE, state, "charmer").state;
    assert.equal(currentRulesetActor(state)?.id, "brenna");
    const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword")!;
    assert.deepEqual(
      rulesetOptionTargets(fiveE, state, "brenna", sword),
      [],
      "the one opponent in the fight is the one they may not point anything at",
    );
    assert.deepEqual(act(fiveE, state, { actorId: "brenna", optionId: sword.id, targetIds: ["charmer"] }).events, [
      { type: "refused", actorId: "brenna", optionId: sword.id, reason: "bad-target" },
    ]);
    // Their friend has no such trouble, and the charm ends with the charmer.
    state = endTurn(fiveE, state, "brenna").state;
    assert.equal(currentRulesetActor(state)?.id, "vess");
    const done = act(fiveE, state, { actorId: "vess", optionId: "attack:0:0", targetIds: ["charmer"] }, 18, 8);
    assert.ok(eventsOf(done.events, "defeated").some((event) => event.actorId === "charmer"));
    assert.deepEqual(
      eventsOf(done.events, "condition").map((event) => [event.targetId, event.condition, event.active]),
      [["brenna", "charmed", false]],
      "the charm goes with whoever was holding it up",
    );
    assert.ok(!rulesetCombatConditions(fiveE, who(done.state, "brenna")).includes("charmed"));
  }

  // ── Ember Roads: the same rules, in a system shaped nothing like the other one ──
  {
    const knacks = ember.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
    const breath = knacks.find((entry) => entry.id === "second-breath")!;
    const rowsOf = (list: string) =>
      rowsFromCatalogEntry("knacks", breath)
        .filter((row) => row.list === list)
        .map((row) => row.row);
    const walker = (): RulesetCombatantInput => ({
      id: "juno",
      name: "Juno",
      side: "party",
      build: build({
        abilities: { brawn: 2, wits: 1, heart: 1 },
        fields: { calling: "Hauler", toughness: 2 },
        lists: {
          gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }],
          knacks: rowsOf("knacks"),
          tricks: rowsOf("tricks"),
        },
      }),
      live: {},
      catalogs: { knacks },
    });
    const post = (): RulesetCombatantInput =>
      foe("post", "Post", { health: 99, defense: 1, initiativeModifier: -9, actions: [] });

    // One budget, handed back once a scene, in a system whose whole turn is one Action.
    let state = fight(ember, [walker(), post()], 6, 6, 1, 1);
    const breathOption = rulesetCombatOptions(ember, state, "juno").find((option) => option.label === "Second Breath")!;
    assert.equal(breathOption.budget, undefined, "free of the one budget this system has");
    let step = act(ember, state, { actorId: "juno", optionId: breathOption.id, targetIds: [] });
    assert.deepEqual(firstOf(step.events, "gives"), {
      type: "gives",
      actorId: "juno",
      optionId: breathOption.id,
      label: "Second Breath",
      budget: "act",
      left: 2,
    });
    state = step.state;
    state = act(ember, state, { actorId: "juno", optionId: "attack:0:0", targetIds: ["post"] }, 4, 3, 5).state;
    assert.equal(who(state, "juno").budgets.act, 1, "and there is still one left to swing with");

    // A hound out of this ruleset's own bestiary, whose bite carries a second clause.
    const trouble = ember.catalogs!.find((catalog) => catalog.id === "road_trouble")!.entries!;
    const hunted = createRulesetEncounter({
      definition: ember,
      seed: 5,
      bestiary: { road_trouble: trouble },
      combatants: [
        {
          id: "hound",
          name: "Rust Jackal",
          side: "enemy",
          creature: { catalogId: "road_trouble", entryId: "rust-jackal" },
        },
        walker(),
      ],
      roller: dice(6, 6, 3, 3, 3, 1, 1),
    });
    assert.equal(currentRulesetActor(hunted)?.id, "hound");
    const bitten = act(ember, hunted, { actorId: "hound", optionId: "bite", targetIds: ["juno"] }, 6, 6, 4);
    assert.deepEqual(
      eventsOf(bitten.events, "damage").map((event) => [event.damageType, event.dealt]),
      [
        ["cut", 4],
        ["rust", 1],
      ],
      "two kinds of harm, in this ruleset's own words",
    );
  }

  // ── A fight that declares none of it ──
  {
    // The same fight, played the same way, on the example as shipped and on the example with every
    // one of the new keys taken out of it. Nothing here uses any of them, so the two logs have to
    // be the same event for the same event, numbers included.
    const stripped = parsedOrThrow(
      variant(fiveEText, (doc) => {
        for (const source of doc.combat.attacks ?? []) {
          delete source.strikes;
          delete source.strikesCappedBy;
        }
        for (const entry of doc.combat.conditions ?? []) {
          for (const key of ["saves", "whileSourceInSight", "endsWhenSourceDown"]) delete entry[key];
          entry.effects = (entry.effects ?? []).filter(
            (effect: string) =>
              !effect.startsWith("own-saves-") &&
              effect !== "resist-all" &&
              !effect.startsWith("cannot-target-") &&
              !effect.startsWith("cannot-approach-"),
          );
        }
        doc.combat.abilities = (doc.combat.abilities ?? []).filter(
          (source: Record<string, any>) => source.list !== "features",
        );
        doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.id !== "feats");
        for (const catalog of doc.catalogs ?? []) {
          for (const entry of catalog.entries ?? []) {
            for (const action of entry.creature?.actions ?? []) delete action.damage?.plus;
          }
        }
      }),
      "the same ruleset with none of the new keys",
    );
    const play = (definition: RulesetDefinition) => {
      let state = fight(definition, [fighter(), wizard(), snag(), rot()], 20, 14, 5, 3);
      const events: RulesetCombatEvent[] = [...state.opening];
      const step = (choice: RulesetCombatChoice, ...faces: number[]) => {
        const result = act(definition, state, choice, ...faces);
        events.push(...result.events);
        state = result.state;
      };
      step({ actorId: "brenna", optionId: "attack:0:0", targetIds: ["snag"] }, 12, 5);
      step({ actorId: "brenna", optionId: "standard:dodge", targetIds: [] });
      step({ actorId: "brenna", optionId: "end-turn", targetIds: [] });
      const bolt = rulesetCombatOptions(definition, state, "corwin").find((option) => option.label === "Fire Bolt")!;
      step({ actorId: "corwin", optionId: bolt.id, targetIds: ["rot"] }, 15, 4, 6);
      step({ actorId: "corwin", optionId: "end-turn", targetIds: [] });
      step({ actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 18, 6);
      step({ actorId: "snag", optionId: "end-turn", targetIds: [] });
      step({ actorId: "rot", optionId: "bite", targetIds: ["brenna"] }, 18, 5);
      step({ actorId: "rot", optionId: "end-turn", targetIds: [] });
      return { events, cursor: state.cursor };
    };
    const shipped = play(fiveE);
    const without = play(stripped);
    assert.deepEqual(shipped.events, without.events, "a fight that uses none of it is the fight it always was");
    assert.equal(shipped.cursor, without.cursor, "and it threw the same dice, in the same order");
  }

  // ── Capability API 1.29 ──
  {
    assert.ok(
      supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 29,
      "the host supports the turn-economy seam",
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
    const economyIssue = /says what one turn can do requires schemaVersion 2 and capabilityApi 1\.29 or newer/;
    const strikesOnly = variant(emberText, (doc) => {
      doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.holds === "creatures");
      for (const catalog of doc.catalogs) {
        // A creature written as a sheet is 1.34, a gate of its own.
        catalog.entries = (catalog.entries ?? []).filter((entry: Record<string, any>) => !entry.creature?.sheet);
        for (const entry of catalog.entries) {
          for (const action of entry.creature?.actions ?? []) delete action.damage?.plus;
        }
      }
      doc.combat.attacks[0].strikes = { const: 2 };
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(28), strikesOnly) ?? "", economyIssue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(29), strikesOnly), null);
    const conditionOnly = variant(emberText, (doc) => {
      doc.catalogs = [];
      doc.combat.conditions[0].effects = ["resist-all"];
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(28), conditionOnly) ?? "", economyIssue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(29), conditionOnly), null);
    // The part of a dodge its flag does not carry is its own declaration: an Engine that does not
    // know the key refuses the whole file, so a package carrying it has to say 1.29.
    const dodgeOnly = variant(emberText, (doc) => {
      doc.catalogs = [];
      doc.sheet.saves = [{ id: "reflex", label: "Reflex", ability: "brawn" }];
      doc.combat.standardEffects = { dodge: { saves: ["reflex"] } };
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(28), dodgeOnly) ?? "", economyIssue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(29), dodgeOnly), null);
    // And the entries, inline or in the catalog file the install already holds.
    const inline = variant(emberText, (doc) => {
      doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.holds !== "creatures");
      doc.catalogs[0].entries[0].mechanics = { kind: "utility", free: true, gives: [{ budget: "act", count: 1 }] };
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(28), inline) ?? "", economyIssue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(29), inline), null);
    const asAsset = variant(emberText, (doc) => {
      doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.holds !== "creatures");
      delete doc.catalogs[0].entries;
      doc.catalogs[0].asset = "catalogs/knacks.json";
    });
    const assets = new Map([
      [
        "catalogs/knacks.json",
        {
          schemaVersion: 1,
          catalog: "knacks",
          entries: [
            {
              id: "sly",
              label: "Sly",
              rows: [{ list: "knacks", values: { name: "Sly" } }],
              mechanics: { kind: "rider", rider: { on: "hit", oncePer: "turn", amount: { dice: "1d6" } } },
            },
          ],
        },
      ],
    ]);
    assert.match(getCapabilityPackageInstallIssue(manifest(28), asAsset, assets) ?? "", economyIssue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(29), asAsset, assets), null);
  }
}

console.info("game ruleset combat core regressions passed.");

// ── The moment a reaction waits for: aimed at, and hurt ──
{
  /** By name rather than by index: these entries sit at the end of a shared list, and one added in
   *  front of them would otherwise quietly re-point every choice below. */
  const idFor = (state: RulesetEncounterState, actorId: string, label: string) => {
    const action = who(state, actorId).actions.find((entry) => entry.label === label);
    assert.ok(action, `no action called "${label}"`);
    return action.id;
  };
  // Snag swings at the wizard, who holds one thing that answers being aimed at and one that answers
  // being hurt. Neither is ever on his own turn's menu.
  const state = fight(fiveE, [reactiveWizard(), snag(), rot()], 20, 5, 3);
  assert.ok(!labels(fiveE, state, "corwin").includes("Unmake"), "a reaction is on no turn's menu");
  assert.ok(!labels(fiveE, state, "corwin").includes("Sear"), "whichever moment it waits for");

  const swing = { actorId: "snag", optionId: "scimitar", targetIds: ["corwin"] };
  const aimed = act(fiveE, endTurn(fiveE, state, "corwin").state, swing);
  const window = aimed.state.window;
  assert.ok(window, "the swing is held while the one it is aimed at is asked");
  assert.deepEqual(window.trigger, { kind: "aimed", sourceId: "snag", optionId: "scimitar", label: "Scimitar" });
  assert.deepEqual(window.waiting, ["corwin"]);
  assert.equal(eventsOf(aimed.events, "attack").length, 0, "and nothing is rolled until it is answered");
  // Paid for before the asking: the budget is gone whatever the answer turns out to be.
  assert.equal(who(aimed.state, "snag").budgets.action, 0);
  assert.deepEqual(
    rulesetWindowOptions(fiveE, aimed.state, "corwin").map((option) => [option.label, option.targets]),
    [
      ["Unmake", { side: "self", count: 0 }],
      // The one whose holder picks keeps its own targets, and is the only one that asks.
      ["Backlash", { side: "any", count: 1 }],
    ],
    "only the ones that wait for THIS moment, and only the one that picks asks whom to point at",
  );

  // A pool the window did not offer is refused as the wrong pool, exactly as it is on a turn.
  assert.deepEqual(
    act(fiveE, aimed.state, {
      actorId: "corwin",
      optionId: idFor(aimed.state, "corwin", "Unmake"),
      targetIds: [],
      payWith: "slots_1",
      window: window.id,
    }).events,
    [
      {
        type: "refused",
        actorId: "corwin",
        optionId: idFor(aimed.state, "corwin", "Unmake"),
        reason: "bad-pool",
      },
    ],
  );

  // Taking the one that cancels: the swing never happens, and its slot is still gone.
  const stopped = act(fiveE, aimed.state, {
    actorId: "corwin",
    optionId: idFor(aimed.state, "corwin", "Unmake"),
    targetIds: [],
    window: window.id,
  });
  assert.deepEqual(firstOf(stopped.events, "cancelled"), {
    type: "cancelled",
    actorId: "snag",
    optionId: "scimitar",
    label: "Scimitar",
    byId: "corwin",
  });
  assert.equal(eventsOf(stopped.events, "attack").length, 0, "the swing never lands");
  assert.equal(eventsOf(stopped.events, "damage").length, 0);
  assert.equal(stopped.state.window, undefined);
  assert.equal(who(stopped.state, "corwin").budgets.reaction, 0, "and answering cost the reaction");

  // Letting it go by instead: the swing lands, and being hurt is its own moment.
  const through = act(
    fiveE,
    aimed.state,
    {
      actorId: "corwin",
      optionId: RULESET_PASS_OPTION,
      targetIds: [],
      window: window.id,
    },
    18,
    5,
    4,
    6,
  );
  assert.equal(firstOf(through.events, "attack").outcome, "hit", "the held swing resolves after the asking");
  const hurt = through.state.window;
  assert.ok(hurt, "and being hurt opens a moment of its own");
  assert.deepEqual(hurt.trigger, { kind: "harmed", sourceId: "snag", label: "Scimitar" });
  assert.deepEqual(
    rulesetWindowOptions(fiveE, through.state, "corwin").map((option) => option.label),
    ["Sear", "Flinch"],
    "only the ones that wait for being hurt",
  );

  // It is aimed back at whoever did it, without anybody picking.
  const back = act(
    fiveE,
    through.state,
    {
      actorId: "corwin",
      optionId: idFor(through.state, "corwin", "Sear"),
      targetIds: [],
      window: hurt.id,
    },
    3,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
  );
  assert.equal(firstOf(back.events, "damage").targetId, "snag", "the answer lands on whoever hurt them");
  assert.equal(back.state.window, undefined);
  // One window at a time: what the answer itself deals opens no further moment.
  assert.equal(eventsOf(back.events, "window").length, 0, "a reaction is not itself reacted to");

  // Everybody one blow hurt is asked, in the FIGHT's order rather than the order the blow happened
  // to write them down in. Wren acts first and is hurt second, and is asked first all the same.
  {
    const both = (): RulesetCombatantInput => ({ ...reactiveWizard(), id: "wren", name: "Wren" });
    const sweep = foe("sweep", "Sweep", {
      health: 8,
      defense: 12,
      initiativeModifier: 0,
      saves: { dex_save: 1, wis_save: 0 },
      actions: [
        {
          id: "lash",
          name: "Lash",
          budget: "action",
          targetCount: 2,
          toHit: 6,
          damage: { count: 1, sides: 4, flat: 1 },
        },
      ],
    });
    // Rot stands at the back and never acts here: it is only there so taking Sweep out does not end
    // the fight and close the window along with it.
    const many = fight(fiveE, [both(), reactiveWizard(), sweep, rot()], 22, 20, 5, 1);
    assert.deepEqual(many.order, ["wren", "corwin", "sweep", "rot"], "the fight's own order");

    // A friend aiming something at you is not a threat to answer. Wren mends Corwin, who holds
    // something that would call it off, and nobody is asked: had the window opened, an ally played
    // by the Engine could have cancelled its own friend's healing.
    const mended = act(
      fiveE,
      many,
      { actorId: "wren", optionId: idFor(many, "wren", "Mending Light"), targetIds: ["corwin"] },
      5,
    );
    assert.equal(mended.state.window, undefined, "a friend's help opens no window");
    assert.equal(firstOf(mended.events, "heal").targetId, "corwin", "and it simply lands");
    let ready = endTurn(fiveE, many, "wren").state;
    ready = endTurn(fiveE, ready, "corwin").state;
    // Corwin first in the targets, so that is the order the blow names them in.
    const lash = act(fiveE, ready, { actorId: "sweep", optionId: "lash", targetIds: ["corwin", "wren"] });
    assert.equal(lash.state.window?.trigger.kind, "aimed");
    assert.deepEqual(
      lash.state.window?.waiting,
      ["wren", "corwin"],
      "asked in the fight's order, not in the order the blow named them",
    );
    assert.deepEqual(
      firstOf(lash.events, "window").waiting,
      ["wren", "corwin"],
      "and the log says the same order the window really holds",
    );

    // One of the two it is aimed at is put down while it is held. What resumes lands on the fight
    // as it stands THEN, and in this ruleset down is not out, so the blow still swings at both.
    {
      const felling = act(
        fiveE,
        lash.state,
        {
          actorId: "wren",
          optionId: idFor(lash.state, "wren", "Backlash"),
          targetIds: ["corwin"],
          window: lash.state.window!.id,
        },
        4,
        18,
        3,
        3,
        3,
        3,
        3,
        3,
      );
      assert.equal(who(felling.state, "corwin").down, true, "the answer put the other target down");
      // Down is not gone: this ruleset's own dying rule keeps a character on the board, so the held
      // blow still finds them. What the resumed blow reads is the fight as it stands when it lands,
      // which is the point; who is still on it is the ruleset's business, not the window's.
      assert.deepEqual(
        eventsOf(felling.events, "attack")
          .filter((event) => event.actorId === "sweep")
          .map((event) => event.targetId),
        ["corwin", "wren"],
        "and the held blow still swung at both, because neither is out of the fight",
      );
      // Down and with nothing left to answer with, so the window let their moment go by for them
      // rather than waiting on somebody who cannot answer.
      assert.deepEqual(firstOf(felling.events, "pass").actorId, "corwin");
      assert.equal(felling.state.window, undefined, "the window closed once both had been asked");
    }

    // One of the two calls the blow off, and the other is not asked at all: the question was what to
    // do about something that is now not going to happen, and they keep what they were holding.
    {
      const called = act(fiveE, lash.state, {
        actorId: "wren",
        optionId: idFor(lash.state, "wren", "Unmake"),
        targetIds: [],
        window: lash.state.window!.id,
      });
      assert.equal(firstOf(called.events, "cancelled").byId, "wren");
      assert.equal(called.state.window, undefined, "the window closed with the question");
      assert.equal(eventsOf(called.events, "cancelled").length, 1, "and nobody called it off twice");
      assert.equal(eventsOf(called.events, "pass").length, 0, "nobody's moment was let go, it was withdrawn");
      assert.equal(who(called.state, "corwin").budgets.reaction, 1, "the one never asked kept their reaction");
      assert.equal(eventsOf(called.events, "attack").length, 0, "and the blow never swung");
    }

    // Both let the blow through, so being hurt opens a moment for both of them.
    const pass = (from: typeof lash.state, who: string, ...faces: number[]) =>
      act(
        fiveE,
        from,
        { actorId: who, optionId: RULESET_PASS_OPTION, targetIds: [], window: from.window!.id },
        ...faces,
      );
    const landed = pass(pass(lash.state, "wren").state, "corwin", 18, 3, 18, 3);
    assert.equal(landed.state.window?.trigger.kind, "harmed");
    assert.deepEqual(landed.state.window?.waiting, ["wren", "corwin"], "both were hurt, and both are asked");

    // Wren answers first and takes Sweep out with it. Corwin is next, and what Corwin holds that is
    // aimed BACK at Sweep is no longer offered: there is nobody left for it to land on.
    const felled = act(
      fiveE,
      landed.state,
      {
        actorId: "wren",
        optionId: idFor(landed.state, "wren", "Sear"),
        targetIds: [],
        window: landed.state.window!.id,
      },
      1,
      10,
      10,
    );
    assert.equal(who(felled.state, "sweep").defeated, true, "the answer took the source out");
    assert.deepEqual(felled.state.window?.waiting, ["corwin"], "and the window is still asking the other one");
    assert.deepEqual(
      rulesetWindowOptions(fiveE, felled.state, "corwin").map((option) => option.label),
      ["Flinch"],
      "what is aimed back at the source is gone with the source; what its holder does to themselves stays",
    );
  }

  // Free of the economy: still on the moment's menu with the reaction spent, and taking it asks
  // for no budget at all.
  assert.equal(who(back.state, "corwin").budgets.reaction, 0, "the answer above spent it");
  // The next opponent in the order, in the same round: the reaction is still gone, and Corwin's own
  // turn, which would hand it back, has not come round yet.
  const bite = { actorId: "rot", optionId: "bite", targetIds: ["corwin"] };
  const spentOut = act(fiveE, endTurn(fiveE, back.state, "snag").state, bite, 19, 4);
  const nothingLeft = spentOut.state.window;
  assert.ok(nothingLeft, "being hurt still opens the moment");
  assert.deepEqual(
    rulesetWindowOptions(fiveE, spentOut.state, "corwin").map((option) => [option.label, option.budget]),
    [["Flinch", undefined]],
    "and what is left on it is the one that costs no budget",
  );
  const flinched = act(
    fiveE,
    spentOut.state,
    { actorId: "corwin", optionId: idFor(spentOut.state, "corwin", "Flinch"), targetIds: [], window: nothingLeft.id },
    3,
  );
  assert.equal(eventsOf(flinched.events, "budget").length, 0, "nothing was spent that it does not have");
  assert.deepEqual(
    { to: firstOf(flinched.events, "temporary").targetId, from: firstOf(flinched.events, "temporary").sourceId },
    { to: "corwin", from: "corwin" },
    "and it did what it does, to its own holder rather than to whoever hurt them",
  );
  assert.equal(flinched.state.window, undefined);
}
