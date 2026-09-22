/**
 * Ruleset combat, slice C2: bestiary catalogs, the actions a creature carries and the threat clamp.
 *
 * What is pinned here:
 *   - A catalog holds rows OR creatures, never a mix, and an entry carries rows OR a creature,
 *     never both and never neither. A catalog of creatures declares no feeds, needs a combat block,
 *     and is never offered by the sheet editor's picker.
 *   - Every name a creature carries is one the ruleset already has: a budget, a save, a condition,
 *     a damage type, a threat tier, and, for a sequence, another action of the same block that is
 *     not itself a sequence.
 *   - Health written as dice is thrown once, when the encounter is created, and the average is what
 *     a forecast reads.
 *   - A sequence spends ONE budget and resolves each part with its own roll and its own target.
 *   - Limited uses run out, a recharge comes back on the right face and not on a lower one, and a
 *     signature action is priced in the creature's own points and refused when they are short.
 *   - An opponent nobody wrote is clamped onto the ruleset's scale, and says in plain words what it
 *     changed; one already in scale comes back untouched.
 *   - The FORMAT is not shaped around one game system: every rule is proven on the 5e draft and on
 *     Ember Roads, which has no saving throws, no declared damage types and one budget.
 *   - Bestiaries are Capability API 1.27, inline and in a catalog file.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  currentRulesetActor,
  findRulesetCreature,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  rulesetSignatureOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
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
  type RulesetStatBlockAction,
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

const catalogOf = (definition: RulesetDefinition, id: string): RulesetCatalogHeader => {
  const catalog = definition.catalogs?.find((entry) => entry.id === id);
  assert.ok(catalog, `the example must ship the catalog "${id}"`);
  return catalog;
};
const bestiaryOf = (definition: RulesetDefinition, id: string): RulesetCatalogEntriesById => ({
  [id]: catalogOf(definition, id).entries ?? [],
});
const entryOf = (definition: RulesetDefinition, catalogId: string, entryId: string): RulesetCatalogEntry => {
  const entry = catalogOf(definition, catalogId).entries?.find((candidate) => candidate.id === entryId);
  assert.ok(entry, `the example must ship the creature "${entryId}"`);
  return entry;
};

const fiveBestiary = bestiaryOf(fiveE, "creatures");
const emberBestiary = bestiaryOf(ember, "road_trouble");

const fight = (
  definition: RulesetDefinition,
  combatants: RulesetCombatantInput[],
  bestiary: RulesetCatalogEntriesById,
  ...faces: number[]
): RulesetEncounterState =>
  createRulesetEncounter({ definition, seed: 909, combatants, bestiary, roller: dice(...faces) });
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
/** A party member's own live state, which is where a fight writes everything it costs them. */
const track = (definition: RulesetDefinition, state: RulesetEncounterState, id: string, trackId: string) => {
  const sheet = who(state, id).sheet!;
  return readRulesetLive(definition, sheet.build, sheet.live).tracks.find((entry) => entry.id === trackId)!.value;
};

// ── The catalog header: what it holds, and what it feeds ──
{
  const beasts = catalogOf(fiveE, "creatures");
  assert.equal(beasts.holds, "creatures");
  assert.equal(beasts.feeds, undefined, "a bestiary writes no rows, so it feeds no list");
  assert.equal(beasts.entries!.length, 4);
  const roads = catalogOf(ember, "road_trouble");
  assert.equal(roads.holds, "creatures");
  assert.equal(roads.entries!.length, 3);
  // A catalog written before this release reads exactly as it did: rows, and the lists it feeds.
  assert.equal(catalogOf(ember, "knacks").holds, "rows");
  assert.deepEqual(catalogOf(ember, "knacks").feeds, ["knacks", "tricks"]);

  const withCatalogs = (text: string, edit: (catalogs: Record<string, any>[]) => void) =>
    variant(text, (doc) => edit(doc.catalogs as Record<string, any>[]));
  const beastly = (edit: (creature: Record<string, any>) => void, entry = 0) =>
    withCatalogs(fiveEText, (catalogs) => edit(catalogs[0]!.entries[entry].creature));

  // Rows and creatures never mix, in the header or inside one entry.
  assert.match(
    refusal(withCatalogs(fiveEText, (catalogs) => (catalogs[0]!.feeds = ["spells"]))),
    /catalogs\.0\.feeds: A catalog of creatures writes no rows, so it feeds no list/,
  );
  assert.match(
    refusal(withCatalogs(emberText, (catalogs) => delete catalogs[0]!.feeds)),
    /catalogs\.0\.feeds: A catalog of rows names the lists it "feeds"/,
  );
  assert.match(
    refusal(
      withCatalogs(
        fiveEText,
        (catalogs) => (catalogs[0]!.entries[0].rows = [{ list: "spells", values: { name: "Thorn Lurker" } }]),
      ),
    ),
    /An entry has exactly one of "rows" or "creature"/,
    "both is refused",
  );
  assert.match(
    refusal(withCatalogs(fiveEText, (catalogs) => delete catalogs[0]!.entries[0].creature)),
    /An entry has exactly one of "rows" or "creature"/,
    "and so is neither",
  );
  assert.match(
    refusal(withCatalogs(fiveEText, (catalogs) => (catalogs[0]!.entries[0].mechanics = { kind: "attack" }))),
    /catalogs\.0\.entries\.0\.mechanics: A creature says what it does in its own actions/,
  );
  // A mixed catalog: the header says one thing and an entry says the other.
  assert.match(
    refusal(
      withCatalogs(fiveEText, (catalogs) =>
        catalogs[0]!.entries.push({
          id: "a-row",
          label: "A row",
          rows: [{ list: "spells", values: { name: "A row" } }],
        }),
      ),
    ),
    /Catalog "creatures" holds creatures, so every entry carries one/,
  );
  assert.match(
    refusal(
      withCatalogs(emberText, (catalogs) => {
        catalogs[0]!.entries.push({ ...catalogs[1]!.entries[0] });
      }),
    ),
    /Catalog "knacks" holds rows, so an entry cannot carry a creature/,
  );
  // And a bestiary in a ruleset with no fight to read it.
  assert.match(
    refusal(variant(fiveEText, (doc) => delete doc.combat)),
    /catalogs\.0\.holds: A catalog of creatures needs a combat block/,
  );

  // Every name a creature carries is checked against the ruleset that ships it.
  assert.match(refusal(beastly((creature) => (creature.tier = "cr_20"))), /Unknown threat tier "cr_20"/);
  assert.match(refusal(beastly((creature) => (creature.actions[0].budget = "swing"))), /Unknown budget "swing"/);
  assert.match(refusal(beastly((creature) => (creature.saves = { luck_save: 3 }))), /Unknown save "luck_save"/);
  assert.match(refusal(beastly((creature) => (creature.abilities = { grit: 3 }))), /Unknown ability "grit"/);
  assert.match(refusal(beastly((creature) => (creature.conditionImmunities = ["hexed"]))), /Unknown condition "hexed"/);
  assert.match(
    refusal(beastly((creature) => (creature.actions[0].damage.type = "starfire"))),
    /Unknown damage type "starfire"/,
  );
  assert.match(refusal(beastly((creature) => (creature.resist = ["starfire"]))), /Unknown damage type "starfire"/);
  assert.match(
    refusal(beastly((creature) => (creature.actions[1].applies[0].condition = "hexed"))),
    /Unknown condition "hexed"/,
  );
  assert.match(
    refusal(beastly((creature) => (creature.actions[1].applies[0].saveEnds.save = "luck_save"))),
    /Unknown save "luck_save"/,
  );
  assert.match(
    refusal(beastly((creature) => (creature.actions[0].id = creature.actions[1].id))),
    /Duplicate action id/,
  );

  // Numbers nothing could ever reach are refused where they are written, not found out mid-fight.
  for (const dice of ["0d6", "1d0", "1d1", "02d6"]) {
    assert.match(
      refusal(beastly((creature) => (creature.actions[0].damage.dice = dice))),
      /at least one die, of at least two sides/,
      `${dice} is not dice anybody can throw`,
    );
  }
  assert.match(
    refusal(beastly((creature) => (creature.actions[0].recharge = { dice: { count: 1, sides: 6 }, from: 7 }))),
    /roll 6 at most, so the action would never come back/,
  );
  assert.match(
    refusal(
      beastly((creature) => {
        creature.signaturePoints = 1;
        creature.actions[0].signature = { cost: 2 };
      }),
    ),
    /costs 2 and the creature only ever has 1/,
  );

  // A sequence is paid for with a budget on the creature's own turn, and a signature action with
  // points on somebody else's. One inside the other would be neither.
  assert.match(
    refusal(
      beastly((creature) => {
        creature.signaturePoints = 2;
        creature.actions[0].signature = { cost: 1 };
      }),
    ),
    /is bought with points, so a sequence cannot name it/,
  );

  // A sequence names another action of the same block, and never another sequence.
  assert.match(
    refusal(beastly((creature) => (creature.actions[2].sequence[0].action = "a_stranger"))),
    /Unknown action "a_stranger"/,
  );
  assert.match(
    refusal(beastly((creature) => (creature.actions[2].sequence[0].action = "claw_and_snare"))),
    /A sequence cannot name itself/,
  );
  assert.match(
    refusal(
      beastly((creature) => {
        creature.actions.push({
          id: "again",
          name: "Again",
          budget: "action",
          sequence: [{ action: "claw_and_snare", times: 1 }],
        });
      }),
    ),
    /"claw_and_snare" is a sequence, and a sequence cannot name another/,
  );
  assert.match(
    refusal(beastly((creature) => (creature.actions[2].damage = { dice: "1d6" }))),
    /A sequence resolves the actions it names, so it carries nothing of its own/,
  );

  // A save needs something to be rolled against, on a stat block as much as on a sheet.
  assert.match(
    refusal(beastly((creature) => delete creature.actions[1].saveDifficulty)),
    /A condition that ends on a save needs a difficulty/,
  );
  assert.match(
    refusal(
      beastly((creature) => (creature.actions[1].save = { save: "dex_save", difficulty: 12, onSuccess: "none" })),
    ),
    /that save's difficulty is what a save-ends uses/,
  );
  // Points are what a signature action is bought with, so a block without them cannot carry one.
  assert.match(
    refusal(beastly((creature) => delete creature.signaturePoints, 3)),
    /An action bought with points needs signaturePoints/,
  );

  // Ember Roads declares no damage types at all, so a type there is free text and nothing to check
  // against, while its conditions and budgets are still its own.
  const roadly = (edit: (creature: Record<string, any>) => void, entry = 0) =>
    withCatalogs(emberText, (catalogs) => edit(catalogs[1]!.entries[entry].creature));
  assert.ok(parseRulesetDefinition(roadly((creature) => (creature.actions[0].damage.type = "starfire"))).ok);
  assert.match(refusal(roadly((creature) => (creature.tier = "boss"))), /Unknown threat tier "boss"/);
  assert.match(refusal(roadly((creature) => (creature.actions[0].budget = "action"))), /Unknown budget "action"/);
  assert.match(
    refusal(roadly((creature) => (creature.actions[1].applies[0].condition = "burning"))),
    /Unknown condition "burning"/,
  );
  assert.match(
    refusal(roadly((creature) => (creature.actions[2].sequence[0].action = "pounce"), 1)),
    /Unknown action "pounce"/,
  );
}

// ── A bestiary in a catalog FILE goes through exactly the same checks ──
{
  const header = catalogOf(fiveE, "creatures");
  const asFile = (entries: unknown[]) => ({ schemaVersion: 1, catalog: "creatures", entries });
  const shipped = header.entries!;
  const onDisk = parseRulesetCatalogFile(fiveE, "creatures", asFile(structuredClone(shipped)));
  assert.ok(onDisk.ok, `the shipped entries must read as a file too: ${onDisk.ok ? "" : onDisk.issues.join("; ")}`);
  const broken = structuredClone(shipped) as any[];
  broken[0]!.creature.tier = "cr_20";
  const refused = parseRulesetCatalogFile(fiveE, "creatures", asFile(broken));
  assert.ok(!refused.ok);
  assert.match(refused.issues.join("; "), /entries\.0\.creature\.tier: Unknown threat tier "cr_20"/);
}

// ── A bestiary entry as a stat block, and finding one by name ──
{
  const lurker = rulesetCreatureBlock(fiveE, entryOf(fiveE, "creatures", "thorn-lurker"))!;
  assert.ok(lurker);
  assert.deepEqual(lurker.healthDice, { count: 3, sides: 8, flat: 3 }, "3d8+3, thrown when the fight starts");
  assert.equal(lurker.health, 16, "and the average, which is what a forecast reads");
  assert.deepEqual(
    lurker.actions.map((action) => action.id),
    ["barbed_claw", "snare_vine", "claw_and_snare"],
  );
  assert.deepEqual(lurker.actions[0]!.damage, { count: 1, sides: 4, flat: 1, type: "piercing" });
  assert.deepEqual(lurker.actions[2]!.sequence, [
    { action: "barbed_claw", times: 1 },
    { action: "snare_vine", times: 1 },
  ]);
  assert.equal(lurker.tier, "cr_1_2");
  assert.deepEqual(
    lurker.traits!.map((trait) => trait.name),
    ["Thicket-born"],
  );

  const moth = rulesetCreatureBlock(ember, entryOf(ember, "road_trouble", "cinder-moth"))!;
  assert.equal(moth.health, 6, "a plain number needs no dice");
  assert.equal(moth.healthDice, undefined);
  assert.deepEqual(moth.actions[1]!.recharge, { dice: { count: 1, sides: 6 }, from: 5 });

  // A ruleset whose economy no longer prices an action leaves that action behind, and a sequence
  // that named it goes with it rather than spending a budget on nothing.
  const narrowed = parsedOrThrow(
    variant(emberText, (doc) => {
      doc.catalogs[1].entries[1].creature.actions[0].budget = "act";
      doc.catalogs[1].entries[1].creature.actions[1].budget = "act";
    }),
    "the 2d6 example",
  );
  const jackal = rulesetCreatureBlock(narrowed, entryOf(narrowed, "road_trouble", "rust-jackal"))!;
  assert.equal(jackal.actions.length, 3);
  const lost = { ...structuredClone(entryOf(ember, "road_trouble", "rust-jackal")) } as any;
  lost.creature.actions[0].budget = "gone";
  lost.creature.actions[1].budget = "gone";
  const stripped = rulesetCreatureBlock(ember, lost)!;
  assert.deepEqual(
    stripped.actions.map((action) => action.id),
    [],
    "the two strikes and the sequence that named them all go",
  );

  // A ruleset with no fight at all has nothing to read a creature as.
  const noCombat = parsedOrThrow(
    variant(emberText, (doc) => {
      delete doc.combat;
      doc.catalogs = [doc.catalogs[0]];
    }),
    "a ruleset without a combat block",
  );
  assert.equal(rulesetCreatureBlock(noCombat, entryOf(ember, "road_trouble", "cinder-moth")), null);
  assert.equal(rulesetCreatureBlock(fiveE, undefined), null);

  // Found by the exact reference, by a label whose case and punctuation do not matter, by id, and
  // then not at all.
  assert.equal(findRulesetCreature(fiveBestiary, "creatures/grave-piper")?.entry.id, "grave-piper");
  assert.equal(findRulesetCreature(fiveBestiary, "Grave Piper")?.entry.id, "grave-piper");
  assert.equal(findRulesetCreature(fiveBestiary, "  grave piper  ")?.entry.id, "grave-piper");
  assert.equal(findRulesetCreature(fiveBestiary, "GRAVE-PIPER")?.entry.id, "grave-piper");
  assert.equal(findRulesetCreature(fiveBestiary, "hollow-sentinel")?.catalogId, "creatures");
  assert.equal(findRulesetCreature(fiveBestiary, "creatures/nobody"), null);
  assert.equal(findRulesetCreature(fiveBestiary, "A Grave Piper"), null, "never fuzzy beyond that");
  assert.equal(findRulesetCreature(fiveBestiary, ""), null);
  assert.equal(findRulesetCreature(emberBestiary, "Glass Wader")?.entry.id, "glass-wader");
  assert.equal(findRulesetCreature(emberBestiary, "Grave Piper"), null, "each ruleset has its own bestiary");
}

// ── The party, and the opponents they meet ──

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
const fighter = (live: unknown = {}): RulesetCombatantInput => ({
  id: "brenna",
  name: "Brenna",
  side: "party",
  build: fighterBuild(),
  live,
  catalogs: {},
});
const creature = (id: string, name: string, entryId: string, catalogId = "creatures"): RulesetCombatantInput => ({
  id,
  name,
  side: "enemy",
  creature: { catalogId, entryId },
});

const travellerBuild = () =>
  build({
    abilities: { brawn: 2, wits: 1, heart: 1 },
    fields: { calling: "Hauler", toughness: 2 },
    lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
  });
const traveller = (live: unknown = {}): RulesetCombatantInput => ({
  id: "juno",
  name: "Juno",
  side: "party",
  build: travellerBuild(),
  live,
  catalogs: {},
});

// ── Health dice are thrown when the fight is created ──
{
  // One initiative die each, and then the lurker's 3d8+3 as the fight builds it.
  const state = fight(
    fiveE,
    [fighter(), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    4,
    9,
    6,
    7,
    2,
  );
  assert.deepEqual(state.order, ["lurker", "brenna"]);
  assert.deepEqual(who(state, "lurker").health, { value: 18, max: 18, temp: 0 }, "6 + 7 + 2 and the flat 3");
  assert.equal(who(state, "lurker").block!.health, 16, "the block still carries the average");
  assert.equal(state.cursor, 5, "two initiative dice and three of health");

  // The same seed and the same dice build the same opponent, every time.
  const again = fight(
    fiveE,
    [fighter(), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    4,
    9,
    6,
    7,
    2,
  );
  assert.deepEqual(again, state);

  // A reference the handed-in catalogs do not hold leaves that opponent out and says so, rather
  // than walking a creature with no numbers into the fight.
  const missing = fight(
    fiveE,
    [fighter(), creature("ghost", "Ghost", "nobody"), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    4,
    9,
    6,
    7,
    2,
  );
  assert.deepEqual(missing.opening[0], { type: "refused", actorId: "ghost", reason: "unknown-creature" });
  assert.deepEqual(missing.order, ["lurker", "brenna"]);

  // Ember Roads throws two dice for initiative and three for the jackal's Grit.
  const road = fight(
    ember,
    [traveller(), creature("jack", "Rust Jackal", "rust-jackal", "road_trouble")],
    emberBestiary,
    4,
    3,
    2,
    2,
    5,
    4,
    3,
  );
  assert.deepEqual(who(road, "jack").health, { value: 12, max: 12, temp: 0 }, "5 + 4 + 3 on three six-sided dice");
  assert.equal(who(road, "jack").block!.health, 10, "3d6 averages ten and a half, and the block keeps the floor");
}

// ── A sequence: one budget, a roll for each strike, and a target for each ──
{
  let state = fight(
    fiveE,
    [fighter(), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    18,
    5,
    8,
    8,
    8,
  );
  assert.deepEqual(state.order, ["brenna", "lurker"]);
  state = endTurn(fiveE, state, "brenna").state;
  assert.equal(currentRulesetActor(state)?.id, "lurker");

  const menu = rulesetCombatOptions(fiveE, state, "lurker");
  assert.deepEqual(
    menu.filter((option) => option.kind === "block").map((option) => option.label),
    ["Barbed claw", "Snare vine", "Claw and snare"],
    "the parts stay on the menu beside the sequence that spends them",
  );
  const both = menu.find((option) => option.id === "claw_and_snare")!;
  assert.deepEqual(both.targets, { side: "enemy", count: 2 }, "one target for each part, or fewer");
  assert.deepEqual(both.forecast, { averageDamage: 7 }, "the sum of its parts, and no single chance to hit");
  assert.equal(both.budget, "action");

  // Both strikes at the one opponent there is: one budget, two attack rolls, two damage rolls.
  const swung = act(
    fiveE,
    state,
    { actorId: "lurker", optionId: "claw_and_snare", targetIds: ["brenna"] },
    16,
    3,
    15,
    2,
  );
  assert.deepEqual(
    swung.events.map((event) => event.type),
    ["budget", "attack", "damage", "attack", "damage", "condition"],
  );
  assert.equal(firstOf(swung.events, "budget").left, 0, "one action for the pair");
  assert.deepEqual(
    eventsOf(swung.events, "attack").map((event) => [event.optionId, event.rolls, event.total, event.outcome]),
    [
      ["barbed_claw", [16], 20, "hit"],
      ["snare_vine", [15], 19, "hit"],
    ],
  );
  assert.deepEqual(
    eventsOf(swung.events, "damage").map((event) => [event.damageType, event.rolls, event.dealt]),
    [
      ["piercing", [3], 4],
      ["slashing", [2], 3],
    ],
  );
  assert.deepEqual(who(swung.state, "brenna").tracked, [
    {
      condition: "restrained",
      rounds: null,
      saveEnds: { save: "str_save", at: "turn-end" },
      difficulty: 12,
      source: "lurker",
    },
  ]);
  assert.deepEqual(labels(fiveE, swung.state, "lurker"), ["End turn"], "the budget is gone");

  // The vine's own difficulty is what the repeated save is rolled against, because the action has
  // no save of its own to borrow one from.
  const loose = endTurn(fiveE, endTurn(fiveE, swung.state, "lurker").state, "brenna", 9);
  const held = firstOf(loose.events, "save");
  assert.deepEqual([held.save, held.difficulty, held.modifier, held.success], ["str_save", 12, 7, true]);
  assert.deepEqual(who(loose.state, "brenna").tracked, []);

  // Somebody who drops to the first strike is still there for the second: being down is not being
  // out, and the fight treats a sequence exactly as it treats any other action.
  const frail = fight(
    fiveE,
    [fighter({ pools: { hp: { value: 4 } } }), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    3,
    19,
    8,
    8,
    8,
  );
  // The second strike is rolled twice, because a fighter lying unconscious is easier to hit: the
  // conditions a sequence's own first part applied are read by its second.
  const felled = act(
    fiveE,
    frail,
    { actorId: "lurker", optionId: "claw_and_snare", targetIds: ["brenna"] },
    18,
    4,
    17,
    3,
    2,
  );
  assert.deepEqual(firstOf(felled.events, "down"), { type: "down", actorId: "brenna", dying: true });
  assert.deepEqual(
    eventsOf(felled.events, "attack").map((event) => [event.optionId, event.mode, event.rolls]),
    [
      ["barbed_claw", "normal", [18]],
      ["snare_vine", "advantage", [17, 3]],
    ],
  );
  assert.equal(
    track(fiveE, felled.state, "brenna", "death_save_failures"),
    1,
    "and the blow while down costs what the dying rule says it costs",
  );

  // A part whose target the fight is already over for is skipped: nothing here picks a new one.
  const dying = fight(
    fiveE,
    [
      fighter({ pools: { hp: { value: 0 } }, tracks: { death_save_failures: 2 } }),
      { ...fighter(), id: "kael", name: "Kael" },
      creature("lurker", "Thorn Lurker", "thorn-lurker"),
    ],
    fiveBestiary,
    3,
    2,
    19,
    8,
    8,
    8,
  );
  assert.equal(who(dying, "brenna").dying, true);
  const last = act(fiveE, dying, { actorId: "lurker", optionId: "claw_and_snare", targetIds: ["brenna"] }, 18, 12, 4);
  assert.equal(firstOf(last.events, "dying").result, "dead", "the third failure, from a blow while down");
  assert.equal(eventsOf(last.events, "attack").length, 1, "the vine has nobody left to reach");
}

// ── A part of a sequence keeps its own books: one budget, and still one use ──
{
  const spitter: RulesetCombatantInput = {
    id: "spitter",
    name: "Spitter",
    side: "enemy",
    block: {
      health: 30,
      defense: 12,
      initiativeModifier: 0,
      actions: [
        {
          id: "spit",
          name: "Spit",
          budget: "action",
          toHit: 10,
          damage: { count: 1, sides: 4, flat: 0 },
          uses: { per: "encounter", count: 1 },
        },
        { id: "bite", name: "Bite", budget: "action", toHit: 10, damage: { count: 1, sides: 4, flat: 0 } },
        {
          id: "spit_and_bite",
          name: "Spit and bite",
          budget: "action",
          sequence: [
            { action: "spit", times: 1 },
            { action: "bite", times: 1 },
          ],
        },
      ],
    },
  };
  let state = fight(fiveE, [fighter(), spitter], fiveBestiary, 18, 5);
  state = endTurn(fiveE, state, "brenna").state;
  const first = act(
    fiveE,
    state,
    { actorId: "spitter", optionId: "spit_and_bite", targetIds: ["brenna"] },
    16,
    3,
    16,
    3,
  );
  assert.equal(first.events.filter((event) => event.type === "attack").length, 2, "both parts strike the first time");
  const counted = first.events.find((event) => event.type === "uses");
  assert.ok(
    counted && counted.type === "uses" && counted.optionId === "spit" && counted.left === 0,
    "the part's one use is spent",
  );
  assert.equal(who(first.state, "spitter").uses.spit, 0);

  // Round two: the sequence is still one action, and the part with nothing left does not happen.
  state = endTurn(fiveE, first.state, "spitter").state;
  state = endTurn(fiveE, state, "brenna").state;
  assert.deepEqual(
    rulesetCombatOptions(fiveE, state, "spitter").find((option) => option.id === "spit_and_bite")?.forecast,
    { averageDamage: 2.5 },
    "and the menu promises only the part that will still happen",
  );
  const second = act(fiveE, state, { actorId: "spitter", optionId: "spit_and_bite", targetIds: ["brenna"] }, 16, 3);
  const strikes = second.events.filter((event) => event.type === "attack");
  assert.deepEqual(
    strikes.map((event) => (event.type === "attack" ? event.optionId : "")),
    ["bite"],
    "a sequence never hands a part a use it no longer has",
  );
}

// ── A one-use part named twice is promised once, and lands once ──
{
  const twice: RulesetCombatantInput = {
    id: "twice",
    name: "Twice",
    side: "enemy",
    block: {
      health: 30,
      defense: 12,
      initiativeModifier: 0,
      actions: [
        {
          id: "spit",
          name: "Spit",
          budget: "action",
          toHit: 10,
          damage: { count: 1, sides: 4, flat: 0 },
          uses: { per: "encounter", count: 1 },
        },
        { id: "double_spit", name: "Double spit", budget: "action", sequence: [{ action: "spit", times: 2 }] },
      ],
    },
  };
  let state = fight(fiveE, [fighter(), twice], fiveBestiary, 18, 5);
  state = endTurn(fiveE, state, "brenna").state;
  assert.deepEqual(
    rulesetCombatOptions(fiveE, state, "twice").find((option) => option.id === "double_spit")?.forecast,
    { averageDamage: 2.5 },
    "the forecast counts strike by strike, the way the sequence resolves",
  );
  const spat = act(fiveE, state, { actorId: "twice", optionId: "double_spit", targetIds: ["brenna"] }, 16, 3);
  assert.equal(spat.events.filter((event) => event.type === "attack").length, 1, "and one strike is what happens");
}

// ── A signature sequence whose parts are all spent is not sold ──
{
  const lasher: RulesetCombatantInput = {
    id: "lasher",
    name: "Lasher",
    side: "enemy",
    block: {
      health: 30,
      defense: 12,
      initiativeModifier: 0,
      signaturePoints: 2,
      actions: [
        { id: "bite", name: "Bite", budget: "action", toHit: 10, damage: { count: 1, sides: 4, flat: 0 } },
        {
          id: "sting",
          name: "Sting",
          budget: "action",
          toHit: 10,
          damage: { count: 1, sides: 4, flat: 0 },
          uses: { per: "encounter", count: 1 },
        },
        {
          id: "lash_out",
          name: "Lash out",
          budget: "action",
          sequence: [{ action: "sting", times: 1 }],
          signature: { cost: 1 },
        },
      ],
    },
  };
  // Brenna acts first, so it is her turn and the lasher may buy something.
  const state = fight(fiveE, [fighter(), lasher], fiveBestiary, 18, 5);
  assert.deepEqual(
    rulesetSignatureOptions(fiveE, state, "lasher").map((option) => option.id),
    ["lash_out"],
  );
  const bought = act(fiveE, state, { actorId: "lasher", optionId: "lash_out", targetIds: ["brenna"] }, 16, 3);
  assert.equal(who(bought.state, "lasher").signature!.points, 1, "one point bought one sting");
  assert.deepEqual(rulesetSignatureOptions(fiveE, bought.state, "lasher"), [], "with the sting spent, nothing is sold");
  const again = act(fiveE, bought.state, { actorId: "lasher", optionId: "lash_out", targetIds: ["brenna"] });
  assert.ok(
    again.events.some((event) => event.type === "refused"),
    "and asking for it anyway is refused",
  );
  assert.equal(who(again.state, "lasher").signature!.points, 1, "without a point being taken for nothing");
}

// ── A sequence with a target for each part, on Ember Roads ──
{
  const state = fight(
    ember,
    [
      traveller(),
      creature("jack", "Rust Jackal", "rust-jackal", "road_trouble"),
      creature("moth", "Cinder Moth", "cinder-moth", "road_trouble"),
    ],
    emberBestiary,
    2,
    1,
    6,
    6,
    5,
    5,
    4,
    3,
    2,
  );
  assert.equal(currentRulesetActor(state)?.id, "jack");
  const menu = rulesetCombatOptions(ember, state, "jack");
  const both = menu.find((option) => option.id === "snap_and_worry")!;
  assert.deepEqual(both.targets, { side: "enemy", count: 2 });
  assert.deepEqual(both.forecast, { averageDamage: 7 });

  // One id for a two-part sequence sends every part at the same target.
  const one = act(ember, state, { actorId: "jack", optionId: "snap_and_worry", targetIds: ["juno"] }, 4, 3, 4, 4, 2, 3);
  assert.deepEqual(
    eventsOf(one.events, "attack").map((event) => [event.optionId, event.targetId]),
    [
      ["bite", "juno"],
      ["worry", "juno"],
    ],
  );
  assert.equal(eventsOf(one.events, "budget").length, 1);

  // There is nobody else on the other side here, so a second id is one target too many for the
  // side it names, and the whole choice is refused rather than half resolved.
  assert.deepEqual(
    act(ember, state, { actorId: "jack", optionId: "snap_and_worry", targetIds: ["juno", "moth"] }).events,
    [{ type: "refused", actorId: "jack", optionId: "snap_and_worry", reason: "bad-target" }],
  );
}

// ── Limited uses run out ──
{
  let state = fight(
    fiveE,
    [fighter(), creature("piper", "Grave Piper", "grave-piper")],
    fiveBestiary,
    4,
    17,
    6,
    6,
    6,
    6,
    6,
    6,
  );
  assert.equal(currentRulesetActor(state)?.id, "piper");
  const note = rulesetCombatOptions(fiveE, state, "piper").find((option) => option.id === "wailing_note")!;
  assert.equal(note.left, 3, "three a day, and the menu says so");

  for (const left of [2, 1, 0]) {
    const played = act(fiveE, state, { actorId: "piper", optionId: "wailing_note", targetIds: ["brenna"] }, 9, 2, 2);
    assert.deepEqual(firstOf(played.events, "uses"), {
      type: "uses",
      actorId: "piper",
      optionId: "wailing_note",
      label: "Wailing note",
      left,
      of: 3,
    });
    state = endTurn(fiveE, played.state, "piper").state;
    // Brenna shakes the note off at the end of her own turn, so the next round starts clean.
    state = endTurn(fiveE, state, "brenna", 20).state;
  }
  assert.equal(who(state, "piper").uses.wailing_note, 0);
  assert.ok(!labels(fiveE, state, "piper").includes("Wailing note"), "nothing left of it to offer");
  assert.deepEqual(act(fiveE, state, { actorId: "piper", optionId: "wailing_note", targetIds: ["brenna"] }).events, [
    { type: "refused", actorId: "piper", optionId: "wailing_note", reason: "insufficient" },
  ]);
  assert.ok(labels(fiveE, state, "piper").includes("Bone rap"), "what it does for free is still there");
}

// ── A recharge comes back on its own face, and not on a lower one ──
{
  let state = fight(
    fiveE,
    [fighter(), creature("hound", "Cinder Hound", "cinder-hound")],
    fiveBestiary,
    4,
    17,
    5,
    5,
    5,
    5,
    5,
  );
  assert.equal(currentRulesetActor(state)?.id, "hound");
  assert.ok(labels(fiveE, state, "hound").includes("Ember breath"), "it starts the fight available");
  assert.deepEqual(who(state, "hound").spent, []);

  const breathed = act(fiveE, state, { actorId: "hound", optionId: "ember_breath", targetIds: ["brenna"] }, 5, 4, 6);
  const saved = firstOf(breathed.events, "save");
  assert.deepEqual([saved.save, saved.difficulty, saved.total, saved.success], ["dex_save", 12, 7, false]);
  assert.deepEqual(firstOf(breathed.events, "damage").dealt, 10, "2d6 of fire, and it did not save");
  assert.deepEqual(who(breathed.state, "hound").spent, ["ember_breath"]);
  assert.ok(!labels(fiveE, breathed.state, "hound").includes("Ember breath"));

  // A 4 leaves it spent; a 5 brings it back, and says what it rolled either way.
  state = endTurn(fiveE, breathed.state, "hound").state;
  const short = endTurn(fiveE, state, "brenna", 4);
  assert.deepEqual(firstOf(short.events, "recharge"), {
    type: "recharge",
    actorId: "hound",
    optionId: "ember_breath",
    label: "Ember breath",
    rolls: [4],
    kept: 4,
    from: 5,
    back: false,
  });
  assert.deepEqual(who(short.state, "hound").spent, ["ember_breath"]);
  assert.ok(!labels(fiveE, short.state, "hound").includes("Ember breath"));

  const back = endTurn(fiveE, state, "brenna", 5);
  assert.equal(firstOf(back.events, "recharge").back, true);
  assert.deepEqual(who(back.state, "hound").spent, []);
  assert.ok(labels(fiveE, back.state, "hound").includes("Ember breath"));

  // The same rule on the other example, where the moth's ash has to build up again.
  let road = fight(
    ember,
    [traveller(), creature("moth", "Cinder Moth", "cinder-moth", "road_trouble")],
    emberBestiary,
    2,
    2,
    5,
    5,
  );
  assert.equal(currentRulesetActor(road)?.id, "moth");
  const bloom = act(ember, road, { actorId: "moth", optionId: "ash_bloom", targetIds: ["juno"] }, 3);
  assert.equal(eventsOf(bloom.events, "attack").length, 0, "it simply lands");
  assert.deepEqual(firstOf(bloom.events, "damage").dealt, 3);
  assert.deepEqual(firstOf(bloom.events, "condition").condition, "shaken");
  road = endTurn(ember, bloom.state, "moth").state;
  const rolled = endTurn(ember, road, "juno", 6);
  assert.deepEqual(firstOf(rolled.events, "recharge").rolls, [6]);
  assert.equal(firstOf(rolled.events, "recharge").back, true);
}

// ── Points of its own: priced, spent, and refused when they are short ──
{
  let state = fight(
    fiveE,
    [fighter(), creature("sentinel", "Hollow Sentinel", "hollow-sentinel")],
    fiveBestiary,
    18,
    3,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
  );
  assert.equal(currentRulesetActor(state)?.id, "brenna");
  assert.deepEqual(who(state, "sentinel").signature, { points: 2, max: 2 });
  assert.ok(
    !rulesetCombatOptions(fiveE, state, "sentinel").some((option) => option.id === "watchful_strike"),
    "it is never on the turn menu",
  );

  const waiting = rulesetSignatureOptions(fiveE, state, "sentinel");
  assert.deepEqual(
    waiting.map((option) => [option.id, option.signature, option.budget]),
    [["watchful_strike", { cost: 1, points: 2 }, undefined]],
  );
  assert.deepEqual(waiting[0]!.forecast, { hitChance: 0.4, averageDamage: 6.5 }, "+5 against a defense of 18");

  const struck = act(fiveE, state, { actorId: "sentinel", optionId: "watchful_strike", targetIds: ["brenna"] }, 16, 5);
  assert.deepEqual(firstOf(struck.events, "signature"), {
    type: "signature",
    actorId: "sentinel",
    optionId: "watchful_strike",
    label: "Watchful strike",
    cost: 1,
    left: 1,
  });
  assert.equal(eventsOf(struck.events, "budget").length, 0, "points, not a budget");
  assert.equal(firstOf(struck.events, "attack").outcome, "hit");
  assert.deepEqual(who(struck.state, "sentinel").budgets, { action: 1, bonus: 1, reaction: 1 });

  // A second one empties the points, and a third is refused.
  const again = act(
    fiveE,
    struck.state,
    { actorId: "sentinel", optionId: "watchful_strike", targetIds: ["brenna"] },
    16,
    5,
  );
  assert.equal(firstOf(again.events, "signature").left, 0);
  assert.deepEqual(rulesetSignatureOptions(fiveE, again.state, "sentinel"), [], "nothing left to buy with");
  assert.deepEqual(
    act(fiveE, again.state, { actorId: "sentinel", optionId: "watchful_strike", targetIds: ["brenna"] }).events,
    [{ type: "refused", actorId: "sentinel", optionId: "watchful_strike", reason: "insufficient" }],
  );

  // The points come back at the start of its own turn, and it has none to spend on that turn.
  state = endTurn(fiveE, again.state, "brenna").state;
  assert.equal(currentRulesetActor(state)?.id, "sentinel");
  assert.deepEqual(who(state, "sentinel").signature, { points: 2, max: 2 });
  assert.deepEqual(rulesetSignatureOptions(fiveE, state, "sentinel"), [], "not while it is acting itself");
  assert.deepEqual(
    act(fiveE, state, { actorId: "sentinel", optionId: "watchful_strike", targetIds: ["brenna"] }).events,
    [{ type: "refused", actorId: "sentinel", optionId: "watchful_strike", reason: "not-your-turn" }],
  );

  // And the same on the other example, where the wader lashes out of the glass.
  const road = fight(
    ember,
    [traveller(), creature("wader", "Glass Wader", "glass-wader", "road_trouble")],
    emberBestiary,
    6,
    6,
    1,
    1,
    5,
    5,
    5,
    5,
  );
  assert.equal(currentRulesetActor(road)?.id, "juno");
  const lash = rulesetSignatureOptions(ember, road, "wader");
  assert.deepEqual(
    lash.map((option) => [option.id, option.signature]),
    [["glass_lash", { cost: 1, points: 2 }]],
  );
  const cut = act(ember, road, { actorId: "wader", optionId: "glass_lash", targetIds: ["juno"] }, 5, 4, 6);
  assert.equal(firstOf(cut.events, "signature").left, 1);
  assert.deepEqual(firstOf(cut.events, "damage").dealt, 6);
}

// ── The clamp: an absurd proposal pulled onto each rung of the scale ──
{
  /** The heaviest round a block can put together, counted here rather than read off the clamp, so
   *  the scale is checked against arithmetic the regression did itself. */
  const roundAverage = (block: RulesetStatBlock): number => {
    const byId = new Map(block.actions.map((action, index) => [action.id ?? `block:${index}`, action]));
    const average = (action: RulesetStatBlockAction | undefined) =>
      action?.damage ? (action.damage.count * (action.damage.sides + 1)) / 2 + action.damage.flat : 0;
    return Math.max(
      0,
      ...block.actions.map((action) =>
        action.sequence
          ? action.sequence.reduce((total, step) => total + step.times * average(byId.get(step.action)), 0)
          : average(action),
      ),
    );
  };

  const absurd = (): RulesetStatBlock => ({
    health: 4000,
    defense: 40,
    initiativeModifier: 30,
    saves: { dex_save: 9, luck_save: 4 },
    abilities: { str: 30, grit: 9 },
    resist: ["fire", "starfire"],
    immune: ["starfire"],
    conditionImmunities: ["prone", "hexed"],
    tier: "cr_1",
    actions: [
      {
        id: "smash",
        name: "Smash",
        budget: "action",
        toHit: 19,
        damage: { count: 12, sides: 12, flat: 30, type: "bludgeoning" },
      },
      {
        id: "gaze",
        name: "Gaze",
        budget: "somehow",
        save: { save: "wis_save", difficulty: 30, onSuccess: "negates" },
        applies: [{ condition: "paralyzed", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } }],
      },
      {
        id: "hex",
        name: "Hex",
        budget: "action",
        saveDifficulty: 30,
        applies: [{ condition: "hexed", duration: "instant" }],
      },
      { id: "flurry", name: "Flurry", budget: "action", sequence: [{ action: "smash", times: 3 }] },
      { id: "ghost", name: "Ghost", budget: "action", sequence: [{ action: "nobody", times: 1 }] },
      { id: "spare1", name: "Spare one", budget: "action", damage: { count: 1, sides: 4, flat: 0 } },
      { id: "spare2", name: "Spare two", budget: "action", damage: { count: 1, sides: 4, flat: 0 } },
    ],
  });

  const low = clampRulesetStatBlock(fiveE, absurd(), "cr_0");
  const tier0 = fiveE.combat!.threat!.tiers[0]!;
  assert.equal(low.block.tier, "cr_0");
  assert.equal(low.block.health, tier0.health[1], "pulled to the top of the band it belongs in");
  assert.equal(low.block.defense, tier0.defense + 2);
  assert.deepEqual(
    low.block.actions.map((action) => action.id),
    ["smash", "gaze", "hex", "flurry", "spare1"],
    "six of the seven survive, and then the sequence that named nothing goes with them",
  );
  assert.deepEqual(low.block.saves, { dex_save: 9 }, "a save this ruleset does not have is dropped");
  assert.deepEqual(low.block.abilities, { str: 30 });
  assert.deepEqual(low.block.resist, ["fire"]);
  assert.equal(low.block.immune, undefined, "and a list with nothing left in it goes entirely");
  assert.deepEqual(low.block.conditionImmunities, ["prone"]);
  const smash = low.block.actions.find((action) => action.id === "smash")!;
  assert.equal(smash.toHit, tier0.toHit + 2);
  assert.equal(low.block.actions.find((action) => action.id === "gaze")!.budget, "action");
  assert.equal(low.block.actions.find((action) => action.id === "gaze")!.save!.difficulty, tier0.saveDifficulty + 2);
  assert.equal(low.block.actions.find((action) => action.id === "hex")!.applies, undefined);
  assert.ok(!low.block.actions.some((action) => action.id === "ghost"), "a sequence that named nothing goes");
  assert.ok(
    roundAverage(low.block) <= tier0.damagePerRound[1],
    `the best round averages ${roundAverage(low.block)}, over the ${tier0.damagePerRound[1]} of CR 0`,
  );
  assert.ok(smash.damage!.count >= 1 && smash.damage!.sides >= 2, "and never scaled away to nothing");
  assert.ok(
    [12, 10, 8, 6, 4, 3, 2].includes(smash.damage!.sides),
    `a d12 shrinks along dice a table owns, never to a d${smash.damage!.sides}`,
  );
  assert.deepEqual(
    low.block.actions.find((action) => action.id === "flurry")!.sequence,
    [{ action: "smash", times: 1 }],
    "a creature at the bottom of the scale does not strike three times",
  );
  assert.ok(
    low.adjusted.some((line) => /Health 4000 was pulled into the 1 to 13 of CR 0/.test(line)),
    low.adjusted.join(" | "),
  );
  assert.ok(low.adjusted.some((line) => /Defense 40 was lowered to 14\./.test(line)));
  assert.ok(low.adjusted.some((line) => /Only the first 6 of 7 actions were kept\./.test(line)));
  assert.ok(low.adjusted.some((line) => /spent a budget this ruleset does not have, so it spends action/.test(line)));
  assert.ok(low.adjusted.some((line) => /best round averages/.test(line)));

  // Every rung, and each one pulls the same proposal somewhere different.
  for (const tier of fiveE.combat!.threat!.tiers) {
    const pulled = clampRulesetStatBlock(fiveE, absurd(), tier.id);
    assert.equal(pulled.block.tier, tier.id);
    assert.ok(pulled.block.health >= tier.health[0] && pulled.block.health <= tier.health[1]);
    assert.ok(pulled.block.defense <= tier.defense + 2);
    for (const action of pulled.block.actions) {
      assert.ok((action.toHit ?? -100) <= tier.toHit + 2, `${action.name} hits too well for ${tier.label}`);
      assert.ok((action.save?.difficulty ?? 0) <= tier.saveDifficulty + 2);
      assert.ok((action.saveDifficulty ?? 0) <= tier.saveDifficulty + 2);
    }
    assert.ok(
      roundAverage(pulled.block) <= tier.damagePerRound[1],
      `${tier.label}: the best round is ${roundAverage(pulled.block)}`,
    );
    assert.ok(pulled.block.actions.every((action) => (action.damage?.count ?? 1) >= 1));
  }

  // A tier nobody declared falls to the bottom of the scale and says so.
  const unknown = clampRulesetStatBlock(fiveE, absurd(), "cr_30");
  assert.equal(unknown.block.tier, "cr_0");
  assert.ok(unknown.adjusted[0]!.startsWith('The tier "cr_30" is not on this ruleset\'s scale'), unknown.adjusted[0]);

  // A rider carries a damage type of its own, and a fight matches resistance by name, so it is held
  // to the same declared names the first amount of a blow and its clauses are.
  {
    const riderly: RulesetStatBlock = {
      health: 20,
      defense: 13,
      initiativeModifier: 2,
      tier: "cr_1",
      actions: [
        {
          id: "bite",
          name: "Bite",
          budget: "action",
          toHit: 4,
          damage: { count: 1, sides: 6, flat: 1, type: "piercing" },
        },
      ],
      riders: [
        {
          id: "ember",
          label: "Ember",
          on: "hit",
          oncePer: "turn",
          amount: { count: 1, sides: 4, flat: 0 },
          type: "starfire",
        },
        {
          id: "cinder",
          label: "Cinder",
          on: "hit",
          oncePer: "round",
          amount: { count: 1, sides: 4, flat: 0 },
          type: "fire",
        },
      ],
    };
    const held = clampRulesetStatBlock(fiveE, riderly, "cr_1");
    assert.equal(held.block.riders![0]!.type, undefined, "a type this ruleset does not have is dropped from a rider");
    assert.equal(held.block.riders![1]!.type, "fire", "and one it does have is left alone");
    assert.ok(
      held.adjusted.some((line) =>
        /The damage type "starfire" is not one this ruleset has, so "Ember" deals untyped damage\./.test(line),
      ),
      held.adjusted.join(" | "),
    );
  }

  // A block already in scale is left exactly as it was.
  const hound = rulesetCreatureBlock(fiveE, entryOf(fiveE, "creatures", "cinder-hound"))!;
  const kept = clampRulesetStatBlock(fiveE, hound, "cr_1");
  assert.deepEqual(kept.adjusted, []);
  assert.deepEqual(kept.block, hound);
  const lurker = rulesetCreatureBlock(fiveE, entryOf(fiveE, "creatures", "thorn-lurker"))!;
  assert.deepEqual(clampRulesetStatBlock(fiveE, lurker, "cr_1_2"), { block: lurker, adjusted: [] });

  // The same on a ruleset with no declared damage types, no saves at all and one budget.
  const roadAbsurd: RulesetStatBlock = {
    health: 900,
    defense: 20,
    initiativeModifier: 9,
    tier: "stray",
    conditionImmunities: ["shaken", "cursed"],
    actions: [
      {
        id: "maul",
        name: "Maul",
        budget: "act",
        toHit: 12,
        damage: { count: 9, sides: 10, flat: 12, type: "starfire" },
      },
      { id: "hex", name: "Hex", budget: "act", applies: [{ condition: "shaken", duration: { rounds: 2 } }] },
    ],
  };
  const stray = ember.combat!.threat!.tiers[0]!;
  const pulled = clampRulesetStatBlock(ember, roadAbsurd, "stray");
  assert.equal(pulled.block.health, stray.health[1]);
  assert.equal(pulled.block.defense, stray.defense + 2);
  assert.equal(pulled.block.actions[0]!.toHit, stray.toHit + 2);
  assert.deepEqual(pulled.block.conditionImmunities, ["shaken"]);
  assert.equal(pulled.block.actions[0]!.damage!.type, "starfire", "no declared types means nothing to check against");
  assert.ok(roundAverage(pulled.block) <= stray.damagePerRound[1]);
  for (const tier of ember.combat!.threat!.tiers) {
    const onRung = clampRulesetStatBlock(ember, structuredClone(roadAbsurd), tier.id);
    assert.ok(roundAverage(onRung.block) <= tier.damagePerRound[1], tier.label);
    assert.ok(onRung.block.health >= tier.health[0] && onRung.block.health <= tier.health[1]);
  }

  // A ruleset with no scale has nothing to pull anything onto, and says that rather than guessing.
  const scaleless = parsedOrThrow(
    variant(emberText, (doc) => {
      delete doc.combat.threat;
      doc.catalogs = [doc.catalogs[0]];
    }),
    "a ruleset with no threat scale",
  );
  const untouched = clampRulesetStatBlock(scaleless, roadAbsurd, "stray");
  assert.deepEqual(untouched.block, roadAbsurd);
  assert.deepEqual(untouched.adjusted, [
    "This ruleset declares no threat scale, so the opponent was used as it was proposed.",
  ]);
}

// ── The LISTED form of a ruleset, which is what a client holds ──
{
  // The listing leaves every inline entry out and puts a count in its place, so a bestiary reaches
  // the client as a header alone. Everything the client calls has to keep working on that.
  const listed = {
    ...fiveE,
    catalogs: fiveE.catalogs!.map(({ entries, ...header }) =>
      entries ? { ...header, entryCount: entries.length } : header,
    ),
  } as unknown as RulesetDefinition;
  const summary = listed.catalogs!.find((catalog) => catalog.id === "creatures")!;
  assert.deepEqual(
    { ...summary },
    { id: "creatures", label: "Creatures", holds: "creatures", filters: summary.filters, entryCount: 4 },
  );
  assert.equal((summary as { entries?: unknown }).entries, undefined);

  // A fight built from the listed definition, with the entries fetched separately, is the same
  // fight: the definition says how to resolve, the catalogs say who is in it.
  const faces = [18, 5, 8, 8, 8];
  const fromListed = fight(
    listed,
    [fighter(), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    ...faces,
  );
  const fromFull = fight(
    fiveE,
    [fighter(), creature("lurker", "Thorn Lurker", "thorn-lurker")],
    fiveBestiary,
    ...faces,
  );
  assert.deepEqual(
    { ...fromListed, ruleset: fromFull.ruleset },
    fromFull,
    "the listed form resolves a fight exactly as the whole file does",
  );
  assert.equal(rulesetCreatureBlock(listed, entryOf(fiveE, "creatures", "thorn-lurker"))!.health, 16);
  assert.deepEqual(
    clampRulesetStatBlock(listed, structuredClone(who(fromFull, "lurker").block!), "cr_1_2").adjusted,
    [],
  );
  assert.deepEqual(rulesetCombatOptions(listed, fromListed, currentRulesetActor(fromListed)!.id).length, 8);
}

// ── The sheet editor's picker never offers a bestiary ──
{
  // The editor offers a catalog on every list it feeds, and a bestiary feeds none, so this is the
  // whole of it: no list on either sheet is ever offered one.
  for (const definition of [fiveE, ember]) {
    for (const list of definition.sheet.lists) {
      const offered = (definition.catalogs ?? []).filter((catalog) => catalog.feeds?.includes(list.id));
      assert.ok(
        offered.every((catalog) => catalog.holds === "rows"),
        `${definition.id}: the picker would offer a bestiary on "${list.id}"`,
      );
    }
  }
  const { rulesetBattleCatalogIds } = await import("../../packages/client/src/lib/ruleset-combat-bridge.js");
  assert.deepEqual(rulesetBattleCatalogIds(ember), ["knacks"], "and the bridge asks for none of it either");
  // The editor fetches the catalogs a sheet's own rows point at, and no row ever points at a
  // creature, so a bestiary is never fetched for a character sheet either.
  const { rulesetCatalogIdsForBuild } = await import("../../packages/shared/src/index.js");
  assert.deepEqual(rulesetCatalogIdsForBuild(fiveE, fighterBuild()), []);
  // A bestiary entry writes nothing onto a sheet, which is what makes all of that hold.
  const { rowsFromCatalogEntry } = await import("../../packages/shared/src/index.js");
  assert.deepEqual(rowsFromCatalogEntry("creatures", entryOf(fiveE, "creatures", "grave-piper")), []);
}

// ── Capability API 1.27, read from the ruleset's own bytes ──
{
  assert.ok(
    supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 27,
    "the host still advertises the bestiary seam introduced in API 1.27",
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
      contributions: { assets: { paths: ["ruleset.json", "catalogs/road_trouble.json"] } },
    }) as any;

  const bestiaryIssue = /catalog of creatures requires schemaVersion 2 and capabilityApi 1\.27 or newer/;
  /** The keys that give a fight a board are their own declaration, one release later, so the cases
   *  about the bestiary seam drop them and leave that gate to the core regression. */
  const withoutBoard = (doc: Record<string, any>) => {
    if (!doc.combat) return doc;
    for (const key of ["distance", "ranged", "cover", "opportunity"]) delete doc.combat[key];
    for (const source of doc.combat.attacks ?? []) {
      delete source.reach;
      delete source.range;
    }
    // And the keys that say what one turn can do, a release later still: a case about the bestiary
    // gate has to leave the gate above it nothing to fire on.
    for (const source of doc.combat?.attacks ?? []) {
      delete source.strikes;
      delete source.strikesCappedBy;
    }
    delete doc.combat?.standardEffects;
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
        for (const action of entry.creature?.actions ?? []) {
          delete action.damage?.plus;
          if (action.range && typeof action.range === "object") action.range = action.range.normal;
          delete action.area;
        }
      }
    }
    return doc;
  };
  const flat = (text: string) => variant(text, withoutBoard);
  assert.match(getCapabilityPackageInstallIssue(manifest(26), flat(emberText)) ?? "", bestiaryIssue);
  assert.equal(getCapabilityPackageInstallIssue(manifest(27), flat(emberText)), null);
  assert.match(getCapabilityPackageInstallIssue(manifest(26), flat(fiveEText)) ?? "", bestiaryIssue);
  assert.equal(getCapabilityPackageInstallIssue(manifest(27), flat(fiveEText)), null);

  // The entries may sit in the catalog file instead, and the gate reads those bytes too.
  const asAsset = variant(emberText, (doc) => {
    withoutBoard(doc);
    doc.catalogs[1].asset = "catalogs/road_trouble.json";
    delete doc.catalogs[1].entries;
  });
  const entries = flat(emberText).catalogs[1].entries as unknown[];
  const assets = new Map<string, unknown>([
    ["catalogs/road_trouble.json", { schemaVersion: 1, catalog: "road_trouble", entries }],
  ]);
  // Even with the header's own `holds` gone, an entry carrying a creature is the same declaration.
  const headerless = structuredClone(asAsset);
  delete headerless.catalogs[1].holds;
  assert.match(getCapabilityPackageInstallIssue(manifest(26), headerless, assets) ?? "", bestiaryIssue);
  assert.match(getCapabilityPackageInstallIssue(manifest(26), asAsset, assets) ?? "", bestiaryIssue);
  assert.equal(getCapabilityPackageInstallIssue(manifest(27), asAsset, assets), null);

  // A ruleset with no bestiary installs on the declaration it always needed.
  const without = variant(emberText, (doc) => {
    withoutBoard(doc);
    doc.catalogs = [doc.catalogs[0]];
  });
  assert.equal(getCapabilityPackageInstallIssue(manifest(26), without), null);
}

console.info("game ruleset combat creature regressions passed.");
