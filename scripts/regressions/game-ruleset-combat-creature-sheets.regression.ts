/**
 * Creatures written in the ruleset's OWN terms (#6610): a bestiary entry may carry a `sheet`.
 *
 * What is pinned here:
 *   - One place for every number. A creature with a sheet gives none of `health`, `defense`,
 *     `initiativeModifier`, `speed`, `abilities` or `saves` beside it; one without a sheet gives the
 *     three a fight cannot do without, and at least one action.
 *   - Every id on the sheet is one the ruleset declares, and a picked row names a catalog that really
 *     feeds its list.
 *   - Built exactly as a party member is: defense, saves, initiative, speed, health and every attack
 *     and ability on its lists, on the 5e draft AND on Ember Roads, which has three abilities, no
 *     saving throws and health called Grit.
 *   - It pays out of its own pools, and is offered the bigger ways of paying, by the Engine's picker
 *     and in a Game Master's decision alike.
 *   - On a wound track its health IS the track, and its own resistances soften a blow before it
 *     marks one.
 *   - It is an opponent all the same: out at zero rather than dying, no death track on screen, none
 *     of its sheet sent to a screen, and never written back as anybody's sheet, even a party
 *     member's who shares its name.
 *   - A sheet that adds up to no health is left out of the fight with a reason of its own.
 *   - An invented enemy that is not a boss keeps only the entries its ruleset opens to its sheet (the
 *     spell list by class), and the choices it left open are filled by its temperament and
 *     competence, only with what it can pay for, the same way every time. A boss is written in full.
 *   - A Game Master's invention may be a sheet too, so an invented mage has slots and spells: read
 *     leniently (what the ruleset lacks is dropped by name, a row named after a catalog entry IS that
 *     entry), health held into the tier's band through the one field it is read off, and defense,
 *     to-hit, save difficulties and the best round (the biggest affordable payment included) held
 *     on the built combatant.
 *   - The catalogs a bestiary's sheets read are found by id, and a bestiary with no sheets asks for
 *     nothing more.
 *   - Capability API 1.34, inline and in a catalog file.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  normalizeCharacterLookupName,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  planRulesetCombatCost,
  readRulesetLive,
  resolveRulesetLayers,
  rulesetBestiarySheetCatalogIds,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetLayerOptionKey,
  rulesetProposedCreatureSchema,
  rulesetSheetBuildSchema,
  type CombatTactics,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatant,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import {
  createCombatDirector,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  commandRulesetCombatDirector,
  createRulesetFight,
  directedRulesetView,
  rulesetDirectorStage,
  rulesetFightLiveStates,
  syncRulesetCombatants,
  type RulesetFightOpponent,
} from "../../packages/server/src/services/game/ruleset-combat-director.service.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";

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
/** Everything a document is refused with, as one line, or "" when it imports. */
const issuesOf = (document: unknown): string => {
  const parsed = parseRulesetDefinition(document);
  return parsed.ok ? "" : parsed.issues.join("; ");
};
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

/** Dice written down in advance. Running out is a failure, so an extra roll nobody expected is
 *  caught where it happens rather than showing up as a wrong number later. */
function dice(...faces: number[]): RulesetCombatRoller {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
}

const who = (state: RulesetEncounterState, id: string): RulesetCombatant => {
  const combatant = rulesetCombatant(state, id);
  assert.ok(combatant, `no combatant "${id}"`);
  return combatant;
};
type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
const eventsOf = <T extends RulesetCombatEvent["type"]>(events: readonly RulesetCombatEvent[], type: T) =>
  events.filter((event): event is EventOf<T> => event.type === type);

const fiveE = parsedOrThrow(variant(fiveEText), "the 5e example");
const ember = parsedOrThrow(variant(emberText), "the Ember Roads example");

const creatureEntry = (definition: RulesetDefinition, catalogId: string, entryId: string): RulesetCatalogEntry => {
  const entry = definition.catalogs
    ?.find((catalog) => catalog.id === catalogId)
    ?.entries?.find((candidate) => candidate.id === entryId);
  assert.ok(entry?.creature, `the ruleset must ship the creature "${entryId}"`);
  return entry;
};
/** Every bestiary a ruleset ships inline. */
const bestiariesOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries(
    (definition.catalogs ?? [])
      .filter((catalog) => catalog.holds === "creatures")
      .map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
/** The bestiaries AND the catalogs their sheets read, which is what the route loads for a fight. */
const fightCatalogs = (definition: RulesetDefinition): RulesetCatalogEntriesById => {
  const bestiary = bestiariesOf(definition);
  const inline = (id: string) => definition.catalogs?.find((catalog) => catalog.id === id)?.entries ?? [];
  return {
    ...bestiary,
    ...Object.fromEntries(rulesetBestiarySheetCatalogIds(definition, bestiary).map((id) => [id, inline(id)])),
  };
};
/** The sheet a creature carries, as the party-member path reads one. */
const sheetOf = (entry: RulesetCatalogEntry): RulesetSheetBuild => build(entry.creature!.sheet!);

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
const travellerBuild = () =>
  build({
    abilities: { brawn: 2, wits: 1, heart: 1 },
    skills: { scrap: "trained" },
    fields: { calling: "Hauler", toughness: 2 },
    lists: { gear: [{ name: "Road axe", notes: "Heavy", swing: "brawn", damage: "1d6", harm: "cut" }] },
  });
const card = (name: string, sheet: RulesetSheetBuild) => ({ name, rulesetSheet: { v: 1, build: sheet } });

// ── Starting a fight the way the route does ──

const engineUnit = (id: string, name: string, side: Combatant["side"]): Combatant => ({
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
function started(input: {
  definition: RulesetDefinition;
  cards: unknown;
  party: Array<{ id: string; name: string }>;
  enemies: RulesetFightOpponent[];
  seed?: number;
  gm?: boolean;
}): CombatDirectorState {
  const built = createRulesetFight({
    definition: input.definition,
    seed: input.seed ?? 7,
    party: input.party,
    enemies: input.enemies,
    cards: input.cards,
    playerName: null,
    live: null,
    partyCatalogs: {},
    // Every inline catalog, as the route loads whatever an invented sheet may name or be filled from.
    bestiary: {
      ...Object.fromEntries((input.definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
      ...fightCatalogs(input.definition),
    },
  });
  assert.ok(built.ok, `the fight was supposed to start: ${built.ok ? "" : built.error}`);
  const state = createCombatDirector({
    id: "fight",
    anchor: "anchor",
    style: "ruleset",
    party: input.party.map((member) => engineUnit(member.id, member.name, "player")),
    enemies: input.enemies.map((enemy) => engineUnit(enemy.id, enemy.name, "enemy")),
    gm: input.gm ?? false,
    difficulty: "normal",
    seed: input.seed ?? 7,
  });
  state.rulesetFight = built.fight;
  syncRulesetCombatants(input.definition, state);
  state.stage = rulesetDirectorStage(state);
  return state;
}

// ── One place for every number: a sheet, or the numbers, never both ──
{
  const withSergeant = (edit: (creature: Record<string, any>) => void) =>
    variant(fiveEText, (doc) => {
      const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.id === "creatures");
      edit(bestiary.entries.find((entry: Record<string, any>) => entry.id === "toll-sergeant").creature);
    });
  // The shipped creature has a sheet and no actions beside it, and that is a whole creature: its
  // sheet's own lists are what it does.
  assert.equal(issuesOf(withSergeant(() => {})), "");
  assert.equal(creatureEntry(fiveE, "creatures", "toll-sergeant").creature!.actions.length, 0);

  // Anything the sheet says, said a second time beside it, is refused by name.
  const twice: Array<[string, unknown]> = [
    ["health", 40],
    ["defense", 15],
    ["initiativeModifier", 2],
    ["speed", 30],
    ["abilities", { str: 16 }],
    ["saves", { str_save: 5 }],
  ];
  for (const [key, value] of twice) {
    assert.match(
      issuesOf(withSergeant((creature) => (creature[key] = value))),
      new RegExp(`creature\\.${key}: A creature with a sheet takes its ${key} from the sheet`),
      `${key} has one place it comes from`,
    );
  }

  // Without a sheet, the three numbers a fight cannot do without, and something to do.
  const plain = (creature: Record<string, any>) => {
    delete creature.sheet;
    Object.assign(creature, {
      health: 30,
      defense: 14,
      initiativeModifier: 1,
      actions: [{ id: "jab", name: "Jab", budget: "action", toHit: 4, damage: { dice: "1d6", type: "piercing" } }],
    });
  };
  assert.equal(issuesOf(withSergeant(plain)), "", "the plain block is exactly as it always was");
  for (const key of ["health", "defense", "initiativeModifier"]) {
    assert.match(
      issuesOf(
        withSergeant((creature) => {
          plain(creature);
          delete creature[key];
        }),
      ),
      new RegExp(`creature\\.${key}: A creature without a sheet needs its ${key}`),
    );
  }
  assert.match(
    issuesOf(
      withSergeant((creature) => {
        plain(creature);
        creature.actions = [];
      }),
    ),
    /creature\.actions: A creature without a sheet needs at least one action/,
  );

  // ── Every id on the sheet is one the ruleset declares ──
  const refused = (edit: (creature: Record<string, any>) => void, pattern: RegExp) =>
    assert.match(issuesOf(withSergeant(edit)), pattern);
  refused(
    (creature) => (creature.sheet.abilities.luck = 3),
    /creature\.sheet\.abilities\.luck: Unknown ability "luck"/,
  );
  refused(
    (creature) => (creature.sheet.skills.piloting = "proficient"),
    /creature\.sheet\.skills\.piloting: Unknown skill "piloting"/,
  );
  refused(
    (creature) => (creature.sheet.saves.luck_save = "proficient"),
    /creature\.sheet\.saves\.luck_save: Unknown save "luck_save"/,
  );
  refused(
    (creature) => (creature.sheet.skills.athletics = "mastery"),
    /creature\.sheet\.skills\.athletics: Unknown proficiency tier "mastery"/,
  );
  refused((creature) => (creature.sheet.fields.rank = 3), /creature\.sheet\.fields: Unknown field "rank"/);
  refused(
    (creature) => (creature.sheet.bonuses = { str: 2 }),
    /creature\.sheet\.bonuses\.str: Unknown skill or save "str"/,
  );
  refused((creature) => (creature.sheet.lists.pets = []), /creature\.sheet\.lists\.pets: Unknown list "pets"/);
  refused(
    (creature) => (creature.sheet.lists.attacks[0].weight = 3),
    /creature\.sheet\.lists\.attacks\.0: Unknown column "weight"/,
  );
  // ── And every value is one that field, score or column can hold ──
  refused(
    (creature) => (creature.sheet.fields.hp_max = 0),
    /creature\.sheet\.fields: Field "hp_max" is outside 1 to 999/,
  );
  refused(
    (creature) => (creature.sheet.fields.level = "five"),
    /creature\.sheet\.fields: Field "level" takes a number/,
  );
  refused(
    (creature) => (creature.sheet.abilities.str = 31),
    /creature\.sheet\.abilities\.str: Ability "str" takes a whole number from 1 to 30/,
  );
  refused(
    (creature) => (creature.sheet.abilities.str = 12.5),
    /creature\.sheet\.abilities\.str: Ability "str" takes a whole number from 1 to 30/,
  );
  refused(
    (creature) => (creature.sheet.bonuses = { athletics: 41 }),
    /creature\.sheet\.bonuses\.athletics: Bonus "athletics" takes a whole number from -20 to 40/,
  );
  refused(
    (creature) => (creature.sheet.bonuses = { athletics: 1.5 }),
    /creature\.sheet\.bonuses\.athletics: Bonus "athletics" takes a whole number from -20 to 40/,
  );
  // 5e offers only "none" and "proficient" for a save, so a tier it knows is still refused there.
  refused(
    (creature) => (creature.sheet.saves.str_save = "expertise"),
    /creature\.sheet\.saves\.str_save: This ruleset does not offer "expertise" for saves/,
  );
  refused(
    (creature) =>
      (creature.sheet.lists.attacks = Array.from({ length: 21 }, (_, index) => ({ name: `Blade ${index}` }))),
    /creature\.sheet\.lists\.attacks: "attacks" holds at most 20 rows/,
  );
  refused(
    (creature) => (creature.sheet.lists.attacks[0].proficient = "yes"),
    /creature\.sheet\.lists\.attacks\.0: Column "proficient" takes true or false/,
  );
  // Live state is the fight's to keep, not the bestiary's to write.
  refused(
    (creature) => (creature.sheet.live = { pools: {} }),
    /creature\.sheet: Unrecognized key\(s\) in object: 'live'/,
  );
  // And a bonus is on a skill or a save, exactly as a character's is.
  assert.equal(issuesOf(withSergeant((creature) => (creature.sheet.bonuses = { athletics: 2, str_save: 1 }))), "");
}

// ── A picked row names a catalog that really feeds its list ──
{
  const withWarden = (edit: (creature: Record<string, any>, doc: Record<string, any>) => void) =>
    variant(emberText, (doc) => {
      const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.id === "road_trouble");
      edit(bestiary.entries.find((entry: Record<string, any>) => entry.id === "toll-warden").creature, doc);
    });
  const knack = (creature: Record<string, any>) => creature.sheet.lists.knacks[0];
  assert.equal(issuesOf(withWarden(() => {})), "", "the shipped warden's knack is one the knacks catalog has");
  const refused = (edit: (creature: Record<string, any>) => void, pattern: RegExp, why: string) =>
    assert.match(issuesOf(withWarden(edit)), pattern, why);
  refused(
    (creature) => (knack(creature)._catalog = "knacks/no-such-knack"),
    /knacks\.0\._catalog: Catalog "knacks" has no entry "no-such-knack"/,
    "an entry the inline catalog does not hold",
  );
  refused(
    (creature) => (knack(creature)._catalog = "road_trouble/rust-jackal"),
    /knacks\.0\._catalog: No catalog "road_trouble" feeds the list "knacks"/,
    "a bestiary is not a catalog of rows",
  );
  refused(
    (creature) => (knack(creature)._catalog = "nowhere/anything"),
    /No catalog "nowhere" feeds the list "knacks"/,
    "a catalog nobody declared",
  );
  refused(
    (creature) => (creature.sheet.lists.gear[0]._catalog = "knacks/hold-the-line"),
    /gear\.0\._catalog: No catalog "knacks" feeds the list "gear"/,
    "a catalog that feeds other lists than this one",
  );
  refused(
    (creature) => (knack(creature)._catalog = "hold-the-line"),
    /"hold-the-line" is not a <catalog>\/<entry> reference/,
    "a reference without its catalog",
  );
  refused((creature) => (knack(creature)._catalog = 3), /"3" is not a <catalog>\/<entry> reference/, "a number");
  // A catalog kept in its own file is read when the fight loads it, not here, so its entries are
  // not something the ruleset file can be held to.
  assert.equal(
    issuesOf(
      withWarden((creature, doc) => {
        knack(creature)._catalog = "knacks/only-in-the-file";
        doc.catalogs[0].asset = "catalogs/knacks.json";
        delete doc.catalogs[0].entries;
      }),
    ),
    "",
  );
}

// ── Built exactly as a party member is, on both rulesets ──
for (const setup of [
  { what: "5e", definition: fiveE, catalogId: "creatures", entryId: "toll-sergeant" },
  { what: "Ember Roads", definition: ember, catalogId: "road_trouble", entryId: "toll-warden" },
]) {
  const { definition } = setup;
  const combat = definition.combat!;
  const entry = creatureEntry(definition, setup.catalogId, setup.entryId);
  const catalogs = fightCatalogs(definition);
  const state = createRulesetEncounter({
    definition,
    seed: 5,
    combatants: [
      // The same sheet on a party member, read by the party member's own path.
      { id: "twin", name: "Twin", side: "party", build: sheetOf(entry), catalogs },
      { id: "foe", name: entry.label, side: "enemy", creature: { catalogId: setup.catalogId, entryId: setup.entryId } },
    ],
    bestiary: catalogs,
  });
  const twin = who(state, "twin");
  const foe = who(state, "foe");
  assert.ok(foe.sheet, `${setup.what}: it fights with its sheet`);
  assert.equal(foe.defense, twin.defense, `${setup.what}: defense is the sheet's`);
  assert.deepEqual(foe.saves, twin.saves, `${setup.what}: and so is every save`);
  assert.equal(foe.initiativeModifier, twin.initiativeModifier, `${setup.what}: and initiative`);
  assert.equal(foe.speed, twin.speed, `${setup.what}: and how far it walks`);
  assert.deepEqual(
    rulesetCombatHealth(definition, combat, foe),
    rulesetCombatHealth(definition, combat, twin),
    `${setup.what}: and health`,
  );
  assert.deepEqual(foe.actions, twin.actions, `${setup.what}: the same lists, read by the same code`);
  assert.ok(foe.actions.length > 0, `${setup.what}: and there is something on them`);
  // What the entry adds beside the sheet is kept.
  assert.equal(foe.block?.tier, entry.creature!.tier);
  assert.deepEqual(foe.block?.traits, entry.creature!.traits);
}

// The numbers themselves, so the comparison above is not two wrong answers agreeing.
{
  const catalogs = fightCatalogs(fiveE);
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 5,
    combatants: [
      {
        id: "sergeant",
        name: "Toll Sergeant",
        side: "enemy",
        creature: { catalogId: "creatures", entryId: "toll-sergeant" },
      },
    ],
    bestiary: catalogs,
  });
  const sergeant = who(state, "sergeant");
  assert.equal(sergeant.defense, 17, "its Armor Class field");
  assert.deepEqual(rulesetCombatHealth(fiveE, fiveE.combat!, sergeant), { value: 80, max: 80, temp: 0 });
  assert.equal(sergeant.saves.str_save, 6, "+3 from Strength and +3 proficiency at level 5");
  assert.equal(sergeant.saves.dex_save, 1, "a save it is not proficient in is its ability alone");
  assert.equal(sergeant.initiativeModifier, 1, "Dexterity, by the ruleset's own initiative formula");
  const halberd = sergeant.actions.find((action) => action.label === "Halberd");
  assert.equal(halberd?.toHit, 6);

  const warden = who(
    createRulesetEncounter({
      definition: ember,
      seed: 5,
      combatants: [
        {
          id: "warden",
          name: "Toll Warden",
          side: "enemy",
          creature: { catalogId: "road_trouble", entryId: "toll-warden" },
        },
      ],
      bestiary: fightCatalogs(ember),
    }),
    "warden",
  );
  assert.deepEqual(
    rulesetCombatHealth(ember, ember.combat!, warden),
    { value: 9, max: 9, temp: 0 },
    "Grit: 4, its Toughness of 3 and its Brawn of 2",
  );
  assert.equal(warden.defense, 7, "Guard: 6 and its Wits of 1");
  assert.deepEqual(
    warden.actions.map((action) => action.label).sort(),
    ["Hold the Line", "Toll hook"],
    "the gear it swings and the knack it picked, nothing else",
  );
}

// ── What the entry adds beside the sheet is kept: its own actions, its points, its hide ──
{
  const armed = parsedOrThrow(
    variant(fiveEText, (doc) => {
      const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.id === "creatures");
      Object.assign(bestiary.entries.find((entry: Record<string, any>) => entry.id === "toll-sergeant").creature, {
        signaturePoints: 1,
        resist: ["fire"],
        actions: [
          {
            id: "hook_the_runner",
            name: "Hook the runner",
            budget: "action",
            toHit: 6,
            damage: { dice: "1d6", flat: 3, type: "piercing" },
            reach: 10,
            signature: { cost: 1 },
          },
        ],
      });
    }),
    "the sergeant with a signature action of its own",
  );
  const sergeant = who(
    createRulesetEncounter({
      definition: armed,
      seed: 5,
      combatants: [
        {
          id: "sergeant",
          name: "Toll Sergeant",
          side: "enemy",
          creature: { catalogId: "creatures", entryId: "toll-sergeant" },
        },
      ],
      bestiary: fightCatalogs(armed),
    }),
    "sergeant",
  );
  assert.deepEqual(
    sergeant.actions.map((action) => action.label).sort(),
    ["Halberd", "Heavy crossbow", "Hook the runner"],
    "the sheet's attacks, and the block's own action beside them",
  );
  assert.deepEqual(sergeant.signature, { points: 1, max: 1 }, "with the points to buy it");
  assert.deepEqual(sergeant.block?.resist, ["fire"], "and the hide a blow is read against");
}

// ── It pays out of its own pools ──
{
  const catalogs = fightCatalogs(ember);
  const warden = (id: string) => ({
    id,
    name: `Warden ${id}`,
    side: "enemy" as const,
    creature: { catalogId: "road_trouble", entryId: "toll-warden" },
  });
  let state = createRulesetEncounter({
    definition: ember,
    seed: 5,
    combatants: [{ id: "juno", name: "Juno", side: "party", build: travellerBuild() }, warden("w1"), warden("w2")],
    bestiary: catalogs,
    roller: dice(1, 1, 6, 6, 5, 5),
  });
  assert.equal(state.order[0], "w1", "the first warden won initiative");
  const hold = rulesetCombatOptions(ember, state, "w1").find((option) => option.label === "Hold the Line");
  assert.ok(hold, "its knack is on its menu");
  assert.deepEqual(
    hold.cost?.map((entry) => [entry.pool, entry.amount]),
    [["luck", 1]],
    "priced in the ruleset's own pool",
  );
  const result = applyRulesetCombatChoice(
    ember,
    state,
    { actorId: "w1", optionId: hold.id, targetIds: ["w2"] },
    dice(),
  );
  assert.ok(!result.refused, `the rules took it: ${result.refused?.reason ?? ""}`);
  state = result.state;
  assert.deepEqual(
    eventsOf(result.events, "spend").map((event) => [event.actorId, event.pool, event.amount]),
    [["w1", "luck", 1]],
  );
  const sheet = who(state, "w1").sheet!;
  const luck = readRulesetLive(ember, sheet.build, sheet.live).pools.find((pool) => pool.key === "luck");
  assert.equal(luck?.value, 2, "out of its OWN Luck, which started full");
}

/** The 5e draft with a spell catalog and a caster in its bestiary. */
const spellbook = parsedOrThrow(
  variant(fiveEText, (doc) => {
    doc.id = "5e-spellbook";
    /** A spell of this little list: which classes it is open to, its rung, and what it does. */
    const spell = (
      id: string,
      label: string,
      classes: string[],
      level: number,
      mechanics: Record<string, unknown>,
    ) => ({
      id,
      label,
      filters: { classes },
      rows: [{ list: "spells", values: { name: label, level, prepared: false } }],
      mechanics: { ...mechanics, ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}) },
    });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      // Open by the sheet's class, exactly as the 5e package's spell list is.
      filters: [{ id: "classes", label: "Class", type: "tags", startFrom: { field: "class" } }],
      entries: [
        // Written at its own rung and bigger out of a higher one, which is what `perCostStep` says.
        spell("ember-lance", "Ember Lance", ["Sorcerer", "Wizard"], 2, {
          kind: "attack",
          attackRoll: true,
          amount: { dice: "2d6" },
          damageType: "fire",
          perCostStep: { dice: "2d6" },
        }),
        spell("frost-mote", "Frost Mote", ["Sorcerer", "Wizard"], 0, {
          kind: "attack",
          attackRoll: true,
          amount: { dice: "1d8" },
          damageType: "cold",
        }),
        spell("spark-lash", "Spark Lash", ["Sorcerer"], 1, {
          kind: "attack",
          attackRoll: true,
          amount: { dice: "2d6" },
          damageType: "lightning",
        }),
        spell("warding-word", "Warding Word", ["Sorcerer", "Cleric"], 1, {
          kind: "buff",
          targets: "ally",
          temporary: { dice: "1d6", flat: 2 },
        }),
        spell("kindle-heart", "Kindle Heart", ["Sorcerer"], 1, {
          kind: "heal",
          targets: "ally",
          amount: { dice: "1d6", flat: 2 },
        }),
        spell("binding-glare", "Binding Glare", ["Sorcerer"], 1, {
          kind: "debuff",
          save: { save: "wis_save", onSuccess: "negates" },
          applies: [{ condition: "restrained", duration: { rounds: 1 } }],
        }),
        spell("hex-counter", "Hex Counter", ["Sorcerer"], 1, {
          kind: "utility",
          reaction: { on: "aimed", cancels: true },
          budget: "reaction",
        }),
        spell("mending-touch", "Mending Touch", ["Cleric"], 1, {
          kind: "heal",
          targets: "ally",
          amount: { dice: "1d8", flat: 2 },
        }),
      ],
    });
    doc.catalogs
      .find((catalog: Record<string, any>) => catalog.id === "creatures")
      .entries.push({
        id: "cinder-adept",
        label: "Cinder Adept",
        summary: "A hedge-caster who learned one spell very well.",
        creature: {
          tier: "cr_2",
          sheet: {
            abilities: { str: 8, dex: 14, con: 12, int: 17, wis: 12, cha: 10 },
            saves: { int_save: "proficient", wis_save: "proficient" },
            fields: {
              level: 5,
              ac: 12,
              speed: 30,
              hp_max: 40,
              spellcasting_ability: "int",
              slots_max_2: 2,
              slots_max_3: 1,
            },
            lists: { spells: [{ name: "Ember Lance", level: 2, prepared: true, _catalog: "spells/ember-lance" }] },
          },
        },
      });
  }),
  "a 5e variant with a spell catalog and a caster in its bestiary",
);

// ── And is offered the bigger ways of paying, whoever decides for it ──
{
  assert.deepEqual(rulesetBestiarySheetCatalogIds(spellbook, bestiariesOf(spellbook)), ["spells"]);

  // On the resolver itself: the bigger slot is offered, spent from its own sheet, and buys the dice.
  let state = createRulesetEncounter({
    definition: spellbook,
    seed: 5,
    combatants: [
      { id: "brenna", name: "Brenna", side: "party", build: fighterBuild() },
      {
        id: "adept",
        name: "Cinder Adept",
        side: "enemy",
        creature: { catalogId: "creatures", entryId: "cinder-adept" },
      },
    ],
    bestiary: fightCatalogs(spellbook),
    roller: dice(1, 20),
  });
  assert.equal(state.order[0], "adept");
  const lance = rulesetCombatOptions(spellbook, state, "adept").find((option) => option.label === "Ember Lance");
  assert.ok(lance, "its spell is on its menu");
  assert.ok(lance.payWith?.includes("slots_3"), `a bigger slot is one way to pay: ${lance.payWith?.join(", ")}`);
  const cast = applyRulesetCombatChoice(
    spellbook,
    state,
    { actorId: "adept", optionId: lance.id, targetIds: ["brenna"], payWith: "slots_3" },
    dice(19, 3, 3, 3, 3),
  );
  assert.ok(!cast.refused, `the rules took it: ${cast.refused?.reason ?? ""}`);
  state = cast.state;
  assert.deepEqual(
    eventsOf(cast.events, "spend").map((event) => [event.actorId, event.pool]),
    [["adept", "slots_3"]],
  );
  assert.equal(eventsOf(cast.events, "damage")[0]?.rolls.length, 4, "one rung up buys two more dice");
  const pools = (() => {
    const sheet = who(state, "adept").sheet!;
    return new Map(readRulesetLive(spellbook, sheet.build, sheet.live).pools.map((pool) => [pool.key, pool.value]));
  })();
  assert.equal(pools.get("slots_3"), 0, "the slot came off its own sheet");
  assert.equal(pools.get("slots_2"), 2, "and only that one");

  // The Engine's own picker weighs the bigger way as a candidate of its own.
  const spent = new Set<string>();
  for (let seed = 1; seed <= 30 && !spent.has("slots_3"); seed++) {
    const fight = started({
      definition: spellbook,
      cards: [card("Brenna", fighterBuild())],
      party: [{ id: "brenna", name: "Brenna" }],
      enemies: [{ id: "adept", name: "Cinder Adept", creature: "creatures/cinder-adept" }],
      seed,
    });
    commandRulesetCombatDirector(spellbook, fight, { type: "control", unitId: "brenna", controller: "ai" });
    for (let turn = 0; turn < 8 && !fight.outcome; turn++) {
      assert.ok(commandRulesetCombatDirector(spellbook, fight, { type: "continue" }).ok);
    }
    for (const { event } of fight.rulesetFight!.events) {
      if (event.type === "spend" && event.actorId === "adept") spent.add(event.pool);
    }
  }
  assert.ok(spent.has("slots_3"), `the Engine never paid for it out of a bigger slot: ${[...spent].join(", ")}`);

  // And a Game Master deciding for it is offered the same choice, and has it honoured.
  const boss = started({
    definition: spellbook,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [{ id: "adept", name: "Cinder Adept", creature: "creatures/cinder-adept", boss: true }],
    gm: true,
    seed: 11,
  });
  commandRulesetCombatDirector(spellbook, boss, { type: "control", unitId: "brenna", controller: "ai" });
  for (let guard = 0; guard < 6 && !boss.window; guard++) {
    assert.ok(commandRulesetCombatDirector(spellbook, boss, { type: "continue" }).ok);
  }
  assert.equal(boss.window?.actorId, "adept", "the boss's turn is a decision");
  const bigger = boss.window!.options.find((option) => option.payWith === "slots_3");
  assert.ok(bigger, "casting it bigger is one of the answers");
  const before = boss.rulesetFight!.events.length;
  assert.ok(commandRulesetCombatDirector(spellbook, boss, { type: "choose", candidateId: bigger.id }).ok);
  const after = boss.rulesetFight!.events.slice(before).map((entry) => entry.event);
  assert.ok(
    after.some((event) => event.type === "spend" && event.actorId === "adept" && event.pool === "slots_3"),
    "and it is cast that big, not at its base",
  );
}

// ── On a wound track, its health is the track, and its hide is read before a mark ──
{
  /** Ember Roads with its health moved off the Grit pool and onto a wound track, as the wound-track
   *  lane builds it. */
  const wounded = (edit: (doc: Record<string, any>) => void = () => {}) =>
    parsedOrThrow(
      variant(emberText, (doc) => {
        delete doc.layers;
        doc.id = "ember-roads-wounds";
        doc.sheet.live.tracks = [
          ...(doc.sheet.live.tracks ?? []),
          {
            id: "harm",
            label: "Harm",
            min: 0,
            max: 3,
            levels: [
              { label: "Winded", penalty: 0 },
              { label: "Bloodied", penalty: -1 },
              { label: "Broken", penalty: -4 },
            ],
            kinds: [
              { id: "bruise", label: "B", severity: 0 },
              { id: "cut", label: "C", severity: 1 },
            ],
          },
        ];
        doc.combat.health = { track: "harm" };
        doc.combat.damageTypes = ["cut", "burn", "crush", "coldfire", "rust"];
        doc.combat.damageKinds = { default: "bruise", byType: { cut: "cut" }, marks: "per-blow" };
        for (const catalog of doc.catalogs ?? []) {
          for (const entry of catalog.entries ?? []) {
            if (entry.mechanics?.temporary) delete entry.mechanics.temporary;
          }
        }
        edit(doc);
      }),
      "Ember Roads on a wound track",
    );
  const swingAt = (definition: RulesetDefinition) => {
    const state = createRulesetEncounter({
      definition,
      seed: 5,
      combatants: [
        { id: "juno", name: "Juno", side: "party", build: travellerBuild() },
        {
          id: "warden",
          name: "Toll Warden",
          side: "enemy",
          creature: { catalogId: "road_trouble", entryId: "toll-warden" },
        },
      ],
      bestiary: fightCatalogs(definition),
      roller: dice(6, 6, 1, 1),
    });
    assert.equal(state.order[0], "juno");
    assert.deepEqual(
      rulesetCombatHealth(definition, definition.combat!, who(state, "warden")),
      { value: 3, max: 3, temp: 0 },
      "an unmarked track of three is three levels left",
    );
    const axe = rulesetCombatOptions(definition, state, "juno").find((option) => option.label === "Road axe");
    assert.ok(axe, "Juno can swing");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "juno", optionId: axe.id, targetIds: ["warden"] },
      dice(6, 6, 4),
    );
  };
  const marks = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    const sheet = who(state, "warden").sheet!;
    return readRulesetLive(definition, sheet.build, sheet.live).tracks.find((track) => track.id === "harm")!.wound!
      .marks;
  };

  const tracked = wounded();
  const hit = swingAt(tracked);
  assert.deepEqual(
    marks(tracked, hit.state),
    ["cut"],
    "the blow marked the opponent's own track, by the ruleset's rule",
  );
  assert.equal(rulesetCombatHealth(tracked, tracked.combat!, who(hit.state, "warden")).value, 2);

  const hardened = wounded((doc) => {
    const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.id === "road_trouble");
    bestiary.entries.find((entry: Record<string, any>) => entry.id === "toll-warden").creature.immune = ["cut"];
  });
  const shrugged = swingAt(hardened);
  assert.equal(eventsOf(shrugged.events, "damage")[0]?.adjust, "immune");
  assert.deepEqual(marks(hardened, shrugged.state), [], "an immune opponent takes no mark");

  // An invented sheet on a track: the track's length is the ruleset's own, so health is not held.
  const invented = started({
    definition: tracked,
    cards: [card("Juno", travellerBuild())],
    party: [{ id: "juno", name: "Juno" }],
    enemies: [
      {
        id: "brute",
        name: "Road Brute",
        tier: "stray",
        proposed: { tier: "stray", sheet: { abilities: { brawn: 3 }, fields: { toughness: 6 } } },
      },
    ],
  }).rulesetFight!;
  assert.deepEqual(rulesetCombatHealth(tracked, tracked.combat!, who(invented.encounter, "brute")), {
    value: 3,
    max: 3,
    temp: 0,
  });
  assert.ok(!invented.adjustments.some((line) => /Health/.test(line)), invented.adjustments.join("; "));
  assert.equal(who(invented.encounter, "brute").sheet!.build.fields.toughness, 6, "and nothing was moved to try");
}

// ── Out at zero, as an opponent is, and never rolled against death ──
{
  const frail = build({
    ...sheetOf(creatureEntry(fiveE, "creatures", "toll-sergeant")),
    fields: { level: 5, ac: 10, hp_max: 1 },
  });
  let state = createRulesetEncounter({
    definition: fiveE,
    seed: 1,
    combatants: [
      { id: "brenna", name: "Brenna", side: "party", build: fighterBuild() },
      { id: "frail", name: "Frail", side: "enemy", block: { sheet: frail, actions: [] } },
    ],
    roller: dice(20, 1),
  });
  const sword = rulesetCombatOptions(fiveE, state, "brenna").find((option) => option.label === "Longsword");
  assert.ok(sword);
  state = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brenna", optionId: sword.id, targetIds: ["frail"] },
    dice(15, 5),
  ).state;
  const out = who(state, "frail");
  assert.equal(out.defeated, true, "at zero it is out");
  assert.equal(out.dying, false, "and not dying, whatever the ruleset says about the party");
}

// ── A screen sees what an opponent always showed, and none of its sheet ──
{
  const state = started({
    definition: fiveE,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [{ id: "sergeant", name: "Toll Sergeant" }],
  });
  const projected = directedRulesetView(fiveE, state);
  assert.ok(projected);
  const sergeant = projected.combatants.find((combatant) => combatant.id === "sergeant")!;
  assert.equal(sergeant.health.max, 80);
  assert.equal(sergeant.defense, 17);
  assert.equal(sergeant.tier, "cr_5");
  assert.equal(sergeant.deathTrack, undefined, "an opponent never rolls against death, sheet or no sheet");
  const text = JSON.stringify(projected);
  for (const leak of ["hp_max", "attacks_per_action", '"build"', '"live"']) {
    assert.ok(!text.includes(leak), `the view carries ${leak}`);
  }
}

// ── Never written back, not even over a party member of the same name ──
{
  const state = started({
    definition: fiveE,
    cards: [card("Toll Sergeant", fighterBuild()), card("Brenna", fighterBuild())],
    party: [
      { id: "namesake", name: "Toll Sergeant" },
      { id: "brenna", name: "Brenna" },
    ],
    enemies: [{ id: "sergeant", name: "Toll Sergeant", creature: "creatures/toll-sergeant" }],
  });
  const fight = state.rulesetFight!;
  assert.ok(rulesetCombatant(fight.encounter, "sergeant")?.sheet, "the opponent fights with a sheet");
  const live = rulesetFightLiveStates(fight);
  assert.deepEqual(
    Object.keys(live).sort(),
    ["Brenna", "Toll Sergeant"].map(normalizeCharacterLookupName).sort(),
    "the party, and only the party",
  );
  assert.equal(
    live[normalizeCharacterLookupName("Toll Sergeant")],
    rulesetCombatant(fight.encounter, "namesake")!.sheet!.live,
    "and the party member's own sheet, not the opponent who shares the name",
  );
}

// ── A sheet that adds up to no health is left out, and says why ──
{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 2,
    combatants: [
      { id: "brenna", name: "Brenna", side: "party", build: fighterBuild() },
      // Below what the ruleset lets a field hold, which a bestiary is refused for at import (above);
      // this is the hand-built block that never went through one.
      {
        id: "hollow",
        name: "Hollow",
        side: "enemy",
        block: { sheet: build({ fields: { level: 1, ac: 10, hp_max: 0 } }), actions: [] },
      },
      // And a hand-built block that has neither a sheet nor the numbers a fight needs.
      { id: "blank", name: "Blank", side: "enemy", block: { actions: [] } },
    ],
  });
  assert.equal(rulesetCombatant(state, "hollow"), undefined);
  assert.equal(rulesetCombatant(state, "blank"), undefined);
  const refusals = eventsOf(state.opening, "refused").map((event) => [event.actorId, event.reason]);
  assert.deepEqual(refusals, [
    ["hollow", "no-health"],
    ["blank", "unknown-creature"],
  ]);
}

// ── A Game Master's invention may be a sheet: read leniently, and held to its tier ──
{
  const plainProposal = {
    tier: "cr_1",
    health: 20,
    defense: 12,
    initiativeModifier: 1,
    actions: [{ id: "jab", name: "Jab", budget: "action", toHit: 4, damage: { dice: "1d6", type: "piercing" } }],
  };
  assert.ok(rulesetProposedCreatureSchema.safeParse(plainProposal).success, "the plain proposal reads as ever");
  assert.ok(
    !rulesetProposedCreatureSchema.safeParse({ tier: "cr_1", actions: plainProposal.actions }).success,
    "without a sheet, the numbers a fight needs are still needed",
  );
  // A sheet AND numbers beside it: the model meant the creature, and the sheet says it in the
  // ruleset's terms, so the numbers go rather than the whole proposal.
  const both = rulesetProposedCreatureSchema.safeParse({ ...plainProposal, sheet: { fields: { hp_max: 30 } } });
  assert.ok(both.success, "a proposal carrying a sheet is read");
  assert.equal(both.data.health, undefined);
  assert.equal(both.data.defense, undefined);
  assert.deepEqual(both.data.sheet?.fields, { hp_max: 30 });

  // An invented caster: a mage the Game Master wrote on the ruleset's own sheet, overdone on purpose.
  const hexer = {
    tier: "cr_2",
    health: 99,
    sheet: {
      abilities: { int: 20, luck: 3 },
      saves: { int_save: "proficient", wis_save: "expertise" },
      fields: {
        class: "Sorcerer",
        level: 5,
        ac: 25,
        hp_max: 200,
        spellcasting_ability: "int",
        slots_max_2: 2,
        slots_max_3: 1,
      },
      lists: {
        spells: [
          { name: "ember lance", prepared: true },
          { name: "Wall of Nothing", prepared: true },
        ],
      },
    },
  };
  const fight = started({
    definition: spellbook,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [{ id: "hexer", name: "Hedge Hexer", tier: "cr_2", proposed: hexer }],
  }).rulesetFight!;
  const said = fight.adjustments.join("\n");
  const tier = spellbook.combat!.threat!.tiers.find((entry) => entry.id === "cr_2")!;
  const built = who(fight.encounter, "hexer");
  assert.ok(built.sheet, "an invented caster fights with its sheet");

  // Read leniently: what the ruleset does not have is dropped by name, and said.
  assert.match(said, /Hedge Hexer: its sheet says its health, so the numbers written beside it were not used\./);
  assert.match(said, /Hedge Hexer: "luck" is not on this ruleset's sheet, so dropped\./);
  assert.match(said, /Hedge Hexer: "expertise" is not offered for wis_save, so it was left at the ruleset's default\./);
  assert.match(
    said,
    /Hedge Hexer: "Wall of Nothing" is in no catalog of this ruleset, so it does nothing in a fight\./,
  );
  // A row named after a catalog entry IS that entry, under the entry's own name.
  const lance = built.actions.find((action) => action.label === "Ember Lance");
  assert.ok(lance, `the spell named in lower case is the catalog's Ember Lance: ${built.actions.map((a) => a.label)}`);
  assert.equal(built.sheet!.build.lists.spells?.[0]?._catalog, "spells/ember-lance");
  assert.equal(built.sheet!.build.lists.spells?.[0]?.level, 2, "and carries the entry's own values");

  // Held to its tier: health through the field it is read off, and the rest on the built combatant.
  assert.deepEqual(rulesetCombatHealth(spellbook, spellbook.combat!, built), { value: 67, max: 67, temp: 0 });
  assert.match(said, /Health 200 was pulled into the 27 to 67 of CR 2 through its Hit point maximum, and is now 67\./);
  assert.equal(built.defense, tier.defense + 2);
  assert.match(said, /Defense 25 was lowered to 15\./);
  assert.equal(lance.toHit, tier.toHit + 2, "a spell attack is held like any other to-hit");
  assert.match(said, /"Ember Lance" now hits at 7 instead of 8\./);
  // The best round counts the biggest slot it can afford, and what the bigger slot buys gives way first.
  const biggest =
    (lance.damage!.count * (lance.damage!.sides + 1)) / 2 +
    lance.damage!.flat +
    (lance.use?.perCostStep
      ? (lance.use.perCostStep.count * (lance.use.perCostStep.sides + 1)) / 2 + lance.use.perCostStep.flat
      : 0);
  assert.ok(biggest <= tier.damagePerRound[1], `its best round averages ${biggest}`);
  assert.match(said, /What a bigger payment buys was scaled down to fit the tier\./);
  assert.deepEqual(
    { count: lance.damage!.count, sides: lance.damage!.sides },
    { count: 2, sides: 6 },
    "the spell as written still fits, so only its growth was shaved",
  );
  assert.ok(planRulesetCombatCost(spellbook, built, lance, "slots_3"), "and it may still pay out of the bigger slot");

  // On Ember Roads, whose health adds its Toughness to a constant and its Brawn: the one field in
  // the sum is the one moved.
  const roadFight = started({
    definition: ember,
    cards: [card("Juno", travellerBuild())],
    party: [{ id: "juno", name: "Juno" }],
    enemies: [
      {
        id: "brute",
        name: "Road Brute",
        tier: "stray",
        proposed: { tier: "stray", sheet: { abilities: { brawn: 3 }, fields: { toughness: 6 } } },
      },
    ],
  }).rulesetFight!;
  assert.deepEqual(rulesetCombatHealth(ember, ember.combat!, who(roadFight.encounter, "brute")), {
    value: 8,
    max: 8,
    temp: 0,
  });
  assert.match(
    roadFight.adjustments.join("\n"),
    /Road Brute: Health 13 was pulled into the 3 to 8 of Stray trouble through its Toughness, and is now 8\./,
  );

  // Strikes bought by one spend wait in hand and may go to ANY striking row, so a round is one spend
  // on a light row and the rest on the heaviest. A weak dagger looks harmless struck three times, and
  // only the mixed round (one dagger, then two greataxe swings) shows what the tier has to hold.
  const duelFight = started({
    definition: fiveE,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [
      {
        id: "duelist",
        name: "Road Duelist",
        tier: "cr_3",
        proposed: {
          tier: "cr_3",
          sheet: {
            abilities: { str: 16, dex: 10 },
            fields: { level: 5, hp_max: 60, ac: 14, attacks_per_action: 3 },
            lists: {
              attacks: [
                { name: "Dagger", ability: "dex", proficient: true, damage: "1d4", damage_type: "piercing" },
                { name: "Greataxe", ability: "str", proficient: true, damage: "1d12", damage_type: "slashing" },
              ],
            },
          },
        },
      },
    ],
  }).rulesetFight!;
  const duelist = who(duelFight.encounter, "duelist");
  const striking = duelist.actions.filter((action) => action.strikes !== undefined);
  assert.deepEqual(
    striking.map((action) => action.label).sort(),
    ["Dagger", "Greataxe"],
    "both of its weapons take strikes out of one hand",
  );
  const average = (action: (typeof striking)[number]) =>
    (action.damage!.count * (action.damage!.sides + 1)) / 2 + action.damage!.flat;
  const heaviest = Math.max(...striking.map(average));
  const cr3 = fiveE.combat!.threat!.tiers.find((entry) => entry.id === "cr_3")!;
  for (const action of striking) {
    const round = average(action) + (action.strikes! - 1) * heaviest;
    assert.ok(
      round <= cr3.damagePerRound[1],
      `"${action.label}" and the rest of its strikes on the heaviest row average ${round}`,
    );
  }

  // An entry that writes two rows (a feature and the counter that tracks its uses) brings both when
  // it is named, or the feature could never be used.
  const effortFight = started({
    definition: fiveE,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [
      {
        id: "veteran",
        name: "Road Veteran",
        tier: "cr_1",
        proposed: {
          tier: "cr_1",
          sheet: { fields: { level: 3, hp_max: 30 }, lists: { features: [{ name: "second effort" }] } },
        },
      },
    ],
  }).rulesetFight!;
  const effortSheet = who(effortFight.encounter, "veteran").sheet!.build;
  assert.deepEqual(
    effortSheet.lists.counters?.map((row) => [row.name, row.max, row._catalog]),
    [["Second Effort", 1, "feats/second-effort"]],
    "the counter came with the feature",
  );
  // A row past its list's limit is not kept, so it brings no counter and is named in no line.
  const features = fiveE.sheet.lists.find((list) => list.id === "features")!;
  const featureLimit = features.maxItems;
  const crowdedFight = started({
    definition: fiveE,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [
      {
        id: "crowded",
        name: "Road Crowd",
        tier: "cr_1",
        proposed: {
          tier: "cr_1",
          sheet: {
            fields: { level: 3, hp_max: 30 },
            lists: {
              features: [
                ...Array.from({ length: featureLimit }, (_, index) => ({ name: `Knack ${index}`, text: "A habit." })),
                { name: "second effort" },
              ],
            },
          },
        },
      },
    ],
  }).rulesetFight!;
  const crowdedSheet = who(crowdedFight.encounter, "crowded").sheet!.build;
  assert.equal(crowdedSheet.lists.features?.length, featureLimit);
  assert.equal(crowdedSheet.lists.counters, undefined, "the feature past the limit brought no counter");
  assert.ok(
    crowdedFight.adjustments.includes(
      `Road Crowd: Only the first ${featureLimit} rows of ${features.label} were kept.`,
    ),
    crowdedFight.adjustments.join("; "),
  );

  // A rider the round counts is shaved like any other amount on it, or a heavy one would leave the
  // round over the cap with the weapon already at its least.
  const venomFight = started({
    definition: fiveE,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [
      {
        id: "stinger",
        name: "Road Stinger",
        tier: "cr_1",
        proposed: {
          tier: "cr_1",
          riders: [{ id: "venom", name: "Venom", on: "hit", oncePer: "turn", amount: { dice: "6d6" } }],
          sheet: {
            abilities: { dex: 10 },
            fields: { level: 3, hp_max: 30, ac: 12 },
            lists: {
              attacks: [{ name: "Dagger", ability: "dex", proficient: true, damage: "1d4", damage_type: "piercing" }],
            },
          },
        },
      },
    ],
  }).rulesetFight!;
  const cr1 = fiveE.combat!.threat!.tiers.find((entry) => entry.id === "cr_1")!;
  const stinger = who(venomFight.encounter, "stinger");
  const dagger = stinger.actions.find((action) => action.label === "Dagger")!;
  const venom = stinger.riders?.find((rider) => rider.label === "Venom");
  assert.ok(venom, "its rider is carried");
  const averageOf = (amount: { count: number; sides: number; flat: number }) =>
    (amount.count * (amount.sides + 1)) / 2 + amount.flat;
  const stingerRound = averageOf(dagger.damage!) + averageOf(venom.amount);
  assert.ok(stingerRound <= cr1.damagePerRound[1], `the dagger and its venom average ${stingerRound}`);
  assert.match(
    venomFight.adjustments.join("\n"),
    /Road Stinger: The damage was scaled down until the best round averages/,
  );

  // A health formula with no single field in it is left as written, and says so.
  const stepped = parsedOrThrow(
    variant(fiveEText, (doc) => {
      doc.sheet.live.pools.find((pool: Record<string, any>) => pool.id === "hp").max = { derived: "proficiency_bonus" };
    }),
    "the 5e draft with health read off a step table",
  );
  const steppedFight = started({
    definition: stepped,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [
      { id: "odd", name: "Odd One", tier: "cr_2", proposed: { tier: "cr_2", sheet: { fields: { level: 5 } } } },
    ],
  }).rulesetFight!;
  assert.match(
    steppedFight.adjustments.join("\n"),
    /Odd One: Health 3 is outside the 27 to 67 of CR 2, and it is not read off one field of the sheet, so it was left as written\./,
  );

  // And the plain proposal is read and clamped exactly as before.
  const plainFight = started({
    definition: fiveE,
    cards: [card("Brenna", fighterBuild())],
    party: [{ id: "brenna", name: "Brenna" }],
    enemies: [{ id: "new", name: "Something New", tier: "cr_1", proposed: plainProposal }],
  }).rulesetFight!;
  assert.equal(rulesetCombatant(plainFight.encounter, "new")?.sheet, undefined);
  assert.ok(!plainFight.adjustments.some((line) => /could not be read/.test(line)));
}

// ── An invented enemy keeps only what its ruleset opens to it, and the rest is filled by how it fights ──
{
  /** An invented Sorcerer's proposal, with fields and named spells on top of a plain one. */
  const sorcerer = (fields: Record<string, unknown> = {}, spells: Array<Record<string, unknown>> = []) => ({
    tier: "cr_2",
    sheet: {
      abilities: { cha: 16 },
      fields: {
        class: "Sorcerer",
        level: 5,
        hp_max: 40,
        spellcasting_ability: "cha",
        slots_max_1: 4,
        slots_max_2: 2,
        ...fields,
      },
      lists: { spells },
    },
  });
  /** A spellbook fight against one invented caster, as the route would build it. */
  const fightOf = (proposed: unknown, extra: Partial<RulesetFightOpponent> = {}, seed = 7) =>
    started({
      definition: spellbook,
      cards: [card("Brenna", fighterBuild())],
      party: [{ id: "brenna", name: "Brenna" }],
      enemies: [{ id: "caster", name: "Road Caster", tier: "cr_2", proposed, ...extra }],
      seed,
    }).rulesetFight!;
  const rowsOf = (fight: ReturnType<typeof fightOf>) => who(fight.encounter, "caster").sheet!.build.lists.spells ?? [];
  const spellsOf = (fight: ReturnType<typeof fightOf>) => rowsOf(fight).map((row) => String(row.name));
  const firstRung = ["Spark Lash", "Warding Word", "Kindle Heart", "Binding Glare", "Hex Counter"];

  // Only what the ruleset opens to a Sorcerer: a Cleric's spell named for it is dropped, and said.
  const named = fightOf(sorcerer({}, [{ name: "Mending Touch" }, { name: "Spark Lash" }]));
  assert.match(
    named.adjustments.join("\n"),
    /Road Caster: "Mending Touch" is not open to a sheet with Class Sorcerer in this ruleset, so dropped\./,
  );
  assert.ok(!spellsOf(named).includes("Mending Touch"));
  // A spell it names is one it has ready, without being told so.
  assert.equal(rowsOf(named).find((row) => row.name === "Spark Lash")?.prepared, true);
  // A caster that names no class has nothing open to it in a list organised by class.
  const classless = fightOf(sorcerer({ class: "" }, [{ name: "Spark Lash" }]));
  assert.match(
    classless.adjustments.join("\n"),
    /Road Caster: "Spark Lash" is not open to a sheet with no Class in this ruleset, so dropped\./,
  );
  assert.deepEqual(spellsOf(classless), []);

  // The choices it left open are filled: only with its class's spells, only what it can pay for.
  const veteran = { proficiency: "veteran", adjective: "disciplined" } as const;
  const filled = fightOf(sorcerer(), { tactics: veteran });
  const names = spellsOf(filled);
  assert.match(filled.adjustments.join("\n"), /Road Caster: Filled in for a veteran, disciplined creature: /);
  assert.equal(names.filter((name) => firstRung.includes(name)).length, 2, `two of its first rung: ${names}`);
  assert.ok(names.includes("Ember Lance"), "its one second-rung spell");
  assert.ok(names.includes("Frost Mote"), "and what it can cast at will");
  assert.ok(!names.includes("Mending Touch"), "never a spell its class does not have");
  assert.ok(
    rowsOf(filled).every((row) => row.prepared === true),
    "and every one of them ready",
  );
  assert.deepEqual(spellsOf(fightOf(sorcerer(), { tactics: veteran })), names, "the same fight fills the same way");
  assert.ok(
    who(filled.encounter, "caster").actions.some((action) => action.label === "Ember Lance"),
    "and the fight offers what was filled in",
  );
  const lowSlots = fightOf(sorcerer({ slots_max_2: 0 }), { tactics: veteran });
  assert.ok(!spellsOf(lowSlots).includes("Ember Lance"), "nothing it could never pay for");
  // What it named counts toward a rung: a novice that named one first-rung spell gets no other.
  const novice = fightOf(sorcerer({}, [{ name: "Spark Lash" }]), {
    tactics: { proficiency: "novice", adjective: "disciplined" },
  });
  assert.deepEqual(
    spellsOf(novice).filter((name) => firstRung.includes(name)),
    ["Spark Lash"],
  );

  // Temperament and competence tilt the draw, over many fights.
  /** How often each kind of first-rung spell is filled in over sixty fights, for one temperament. */
  const tally = (tactics: { proficiency: CombatTactics["proficiency"]; adjective: CombatTactics["adjective"] }) => {
    const out = { support: 0, harm: 0, meta: 0, picks: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const picked = spellsOf(fightOf(sorcerer(), { tactics }, seed)).filter((name) => firstRung.includes(name));
      out.picks += picked.length;
      out.support += picked.filter((name) => name === "Warding Word" || name === "Kindle Heart").length;
      out.harm += picked.filter((name) => name === "Spark Lash").length;
      out.meta += picked.filter((name) => name === "Hex Counter").length;
    }
    return out;
  };
  const protective = tally({ proficiency: "veteran", adjective: "protective" });
  const reckless = tally({ proficiency: "veteran", adjective: "reckless" });
  // Margins, not a bare "more": without any leaning the two come out level, and luck alone must not pass.
  assert.ok(
    protective.support >= 1.4 * reckless.support,
    `protective ${protective.support}, reckless ${reckless.support}`,
  );
  assert.ok(reckless.harm >= 3 * protective.harm, `reckless ${reckless.harm}, protective ${protective.harm}`);
  const master = tally({ proficiency: "master", adjective: "disciplined" });
  const green = tally({ proficiency: "novice", adjective: "disciplined" });
  assert.ok(
    master.meta / master.picks >= (2 * green.meta) / green.picks,
    `a master carries what bends the turn more often: ${master.meta}/${master.picks} against ${green.meta}/${green.picks}`,
  );

  // A boss is the Game Master's to write in full: the Cleric's spell stays, and nothing is filled in.
  const boss = fightOf(sorcerer({}, [{ name: "Mending Touch" }]), { boss: true, tactics: veteran });
  assert.deepEqual(spellsOf(boss), ["Mending Touch"]);
  assert.ok(!boss.adjustments.some((line) => /Filled in|not open/.test(line)), boss.adjustments.join("; "));
}

// ── A layer that narrows a field never costs a creature written with the value it took out ──
{
  /** The 5e draft with a layer that takes "cha" out, and the Toll Sergeant written with `value`. */
  const narrowed = (value: string) =>
    variant(fiveEText, (doc) => {
      doc.layers = [
        { id: "no_charm", label: "No charm", fields: [{ id: "spellcasting_ability", removeValues: ["cha"] }] },
      ];
      const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.id === "creatures");
      const sergeant = bestiary.entries.find((entry: Record<string, any>) => entry.id === "toll-sergeant");
      sergeant.creature.sheet.fields.spellcasting_ability = value;
    });
  const base = parsedOrThrow(narrowed("cha"), "the 5e draft with a layer and a creature that uses what it removes");
  const layered = resolveRulesetLayers(base, { [rulesetLayerOptionKey("no_charm")]: true });
  assert.deepEqual(
    layered.applied.map((layer) => layer.id),
    ["no_charm"],
    "the layer still applies: it narrows what a player may pick, not what a creature was written as",
  );
  // The same creatures read from a file against the game's layered definition are kept, which is
  // what the game's catalog loader asks for.
  const file = {
    schemaVersion: 1,
    catalog: "creatures",
    entries: narrowed("cha").catalogs.find((catalog: Record<string, any>) => catalog.id === "creatures").entries,
  };
  assert.ok(parseRulesetCatalogFile(layered.definition, "creatures", file, true).ok);
  assert.ok(
    !parseRulesetCatalogFile(layered.definition, "creatures", file).ok,
    "held to the narrowed values it would be refused, which is why the loader says the definition is layered",
  );
  // Only a value a layer really took out is let through: a typo is still refused under a layer.
  const typo = {
    ...file,
    entries: narrowed("chr").catalogs.find((catalog: Record<string, any>) => catalog.id === "creatures").entries,
  };
  const refusedTypo = parseRulesetCatalogFile(layered.definition, "creatures", typo, true);
  assert.ok(!refusedTypo.ok, "a value no layer removed is not the field's own");
  assert.match(refusedTypo.issues.join("; "), /Field "spellcasting_ability" takes one of its declared values/);
  // Without a layer, a creature is still held to the field's values.
  assert.match(
    issuesOf(narrowed("chr")),
    /creature\.sheet\.fields: Field "spellcasting_ability" takes one of its declared values/,
  );
}

// ── The catalogs a bestiary's sheets read, and nothing more ──
{
  assert.deepEqual(rulesetBestiarySheetCatalogIds(ember, bestiariesOf(ember)), ["knacks"]);
  assert.deepEqual(
    rulesetBestiarySheetCatalogIds(fiveE, bestiariesOf(fiveE)),
    [],
    "a sheet whose rows name no catalog needs nothing more",
  );
  assert.deepEqual(
    rulesetBestiarySheetCatalogIds(ember, { ...bestiariesOf(ember), knacks: [] }),
    [],
    "one already in hand is not asked for twice",
  );
  const withoutSheets = Object.fromEntries(
    Object.entries(bestiariesOf(ember)).map(([id, entries]) => [id, entries.filter((entry) => !entry.creature?.sheet)]),
  );
  assert.deepEqual(rulesetBestiarySheetCatalogIds(ember, withoutSheets), []);
}

// ── Capability API 1.34 ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-sheets-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;
try {
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
      contributions: { assets: { paths: ["ruleset.json", "catalogs/road_trouble.json"] } },
    }) as any;
  const sheetIssue = /creatures carry a sheet of their own requires schemaVersion 2 and capabilityApi 1\.34 or newer/;
  // An Engine before 1.34 refuses the whole strict catalog over the one key, so the file says so.
  assert.match(getCapabilityPackageInstallIssue(manifest(33), variant(emberText)) ?? "", sheetIssue);
  assert.equal(getCapabilityPackageInstallIssue(manifest(34), variant(emberText)), null);
  // Without its sheet-written creature it installs on what it needed before.
  const plain = variant(emberText, (doc) => {
    for (const catalog of doc.catalogs) {
      catalog.entries = catalog.entries?.filter((entry: Record<string, any>) => !entry.creature?.sheet);
    }
  });
  assert.equal(getCapabilityPackageInstallIssue(manifest(33), plain), null);
  // And the entries may sit in the catalog file instead, which the gate reads too.
  const asAsset = variant(emberText, (doc) => {
    const bestiary = doc.catalogs.find((catalog: Record<string, any>) => catalog.id === "road_trouble");
    bestiary.asset = "catalogs/road_trouble.json";
    delete bestiary.entries;
  });
  const entries = variant(emberText).catalogs.find((catalog: Record<string, any>) => catalog.id === "road_trouble")
    .entries as unknown[];
  const assets = new Map<string, unknown>([
    ["catalogs/road_trouble.json", { schemaVersion: 1, catalog: "road_trouble", entries }],
  ]);
  assert.match(getCapabilityPackageInstallIssue(manifest(33), asAsset, assets) ?? "", sheetIssue);
  assert.equal(getCapabilityPackageInstallIssue(manifest(34), asAsset, assets), null);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}

console.info("game ruleset creature sheet regressions passed.");
