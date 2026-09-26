/**
 * Ruleset combat, slice C3a: the director's third style, driven with no database and no network.
 *
 * What is pinned here:
 *   - ONE ledger. The ruleset fight is a style of the existing director session, and the Engine's
 *     own `party` and `enemies` arrays are kept in step with it after every step, because the
 *     recap, the journal and the client's end-of-battle path read them.
 *   - The server decides what everybody's numbers are. A party member's come off their own sheet,
 *     and one without a sheet is refused by name rather than given Engine numbers. An opponent's
 *     come off a bestiary, off a clamped proposal or off the ruleset's own threat scale, in that
 *     order, and every adjustment is said out loud.
 *   - A refusal changes nothing at all and carries the resolver's own reason in a stable code.
 *   - `continue` resolves exactly one turn of whoever the player is not playing, and stops.
 *   - The picker never spends the same budget twice, never stalls and always ends the turn.
 *   - The view is a PROJECTION: no sheet build, no live blob, no catalogs, no seed.
 *   - The state is plain JSON: a fight carried through a round trip mid-battle continues on the
 *     same dice.
 *   - Nothing is shaped around one game system: every case is proven on the 5e draft AND on Ember
 *     Roads, which rolls two six-sided dice, has one thing to do a turn and no saving throws.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  currentRulesetActor,
  parseRulesetDefinition,
  planRulesetCombatCost,
  rowsFromCatalogEntry,
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatRoller,
  rulesetCombatStanding,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  type RulesetCatalogEntriesById,
  type RulesetLiveStates,
  type RulesetCatalogEntry,
  type RulesetDefinition,
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
  rulesetWindowTargetOf,
  syncRulesetCombatants,
  type RulesetFightOpponent,
} from "../../packages/server/src/services/game/ruleset-combat-director.service.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
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
const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");
const fiveE = parsedOrThrow(variant(fiveEText), "the 5e example");
const ember = parsedOrThrow(variant(emberText), "the 2d6 example");
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
const card = (name: string, sheet: RulesetSheetBuild | null) => ({
  name,
  ...(sheet ? { rulesetSheet: { v: 1, build: sheet } } : {}),
});

// ── The party, on both rulesets ──

const spellEntries = [
  {
    id: "fire-bolt",
    label: "Fire Bolt",
    rows: [{ list: "spells", values: { name: "Fire Bolt", level: 0, prepared: false } }],
    mechanics: { kind: "attack", attackRoll: true, amount: { dice: "1d10" }, damageType: "fire" },
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
    // Written at its lowest rung and bigger out of a higher one, which is what `perCostStep` says.
    id: "ember-lance",
    label: "Ember Lance",
    rows: [{ list: "spells", values: { name: "Ember Lance", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      attackRoll: true,
      amount: { dice: "2d6" },
      damageType: "fire",
      cost: [{ pool: "slots_2", amount: 1 }],
      perCostStep: { dice: "2d6" },
    },
  },
] as unknown as RulesetCatalogEntry[];
const spellRows = spellEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));
const spellCatalogs: RulesetCatalogEntriesById = { spells: spellEntries };

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
    },
    lists: { spells: spellRows },
  });
const fiveECards = [card("Brenna", fighterBuild()), card("Corwin", wizardBuild()), card("Tam", null)];

const emberKnacks = ember.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
const emberRowsFor = (list: string, ids: string[]) =>
  ids.flatMap((id) =>
    rowsFromCatalogEntry("knacks", emberKnacks.find((entry) => entry.id === id)!)
      .filter((row) => row.list === list)
      .map((row) => row.row),
  );
const emberPicked = ["road-sense", "last-ember", "coldfire-toss", "hold-the-line"];
const travellerBuild = () =>
  build({
    abilities: { brawn: 2, wits: 1, heart: 1 },
    skills: { scrap: "trained" },
    fields: { calling: "Hauler", toughness: 2 },
    lists: {
      gear: [{ name: "Road axe", notes: "Heavy, and it knows it", swing: "brawn", damage: "1d6", harm: "cut" }],
      knacks: emberRowsFor("knacks", emberPicked),
      tricks: emberRowsFor("tricks", emberPicked),
    },
  });
const pellBuild = () =>
  build({ abilities: { brawn: 1, wits: 2, heart: 0 }, fields: { calling: "Scout", toughness: 1 }, lists: {} });
const emberCards = [card("Juno", travellerBuild()), card("Pell", pellBuild()), card("Wick", null)];
const emberCatalogs: RulesetCatalogEntriesById = { knacks: emberKnacks };

/** Every bestiary of a ruleset, exactly as the route loads them. */
const bestiaryOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries(
    (definition.catalogs ?? [])
      .filter((catalog) => catalog.holds === "creatures")
      .map((catalog) => [catalog.id, catalog.entries ?? []]),
  );

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

interface StartInput {
  definition: RulesetDefinition;
  cards: unknown;
  partyCatalogs: RulesetCatalogEntriesById;
  party: Array<{ id: string; name: string }>;
  enemies: RulesetFightOpponent[];
  seed?: number;
  gm?: boolean;
  live?: RulesetLiveStates | null;
  /** Whether this fight is fought on a board, which is what the game's Tactical preference asks
   *  for. The ruleset still has to say what a cell is worth. */
  positioned?: boolean;
}
type Started = { ok: true; state: CombatDirectorState } | { ok: false; error: string };

function start(input: StartInput): Started {
  const built = createRulesetFight({
    definition: input.definition,
    seed: input.seed ?? 7,
    ...(input.positioned ? { positioned: true } : {}),
    party: input.party,
    enemies: input.enemies,
    cards: input.cards,
    playerName: null,
    live: input.live ?? null,
    partyCatalogs: input.partyCatalogs,
    bestiary: bestiaryOf(input.definition),
  });
  if (!built.ok) return built;
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
  return { ok: true, state };
}
const started = (input: StartInput): CombatDirectorState => {
  const result = start(input);
  assert.ok(result.ok, `the fight was supposed to start: ${result.ok ? "" : result.error}`);
  return result.state;
};
const refusedStart = (input: StartInput): string => {
  const result = start(input);
  assert.ok(!result.ok, "this fight was supposed to be refused");
  return result.error;
};
const view = (definition: RulesetDefinition, state: CombatDirectorState) => {
  const projected = directedRulesetView(definition, state);
  assert.ok(projected, "a ruleset fight always projects a view");
  return projected;
};
const unitOf = (state: CombatDirectorState, id: string) =>
  [...state.party, ...state.enemies].find((unit) => unit.id === id)!;

const fiveEParty = [
  { id: "brenna", name: "Brenna" },
  { id: "corwin", name: "Corwin" },
];
const emberParty = [
  { id: "juno", name: "Juno" },
  { id: "pell", name: "Pell" },
];

// ── The party comes off the sheets, and a member without one is refused by name ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
  });
  const projected = view(fiveE, state);
  assert.equal(projected.ruleset.id, "5e-2014");
  assert.equal(projected.combatants.find((c) => c.id === "brenna")!.health.max, 60, "the sheet's own maximum, not 30");
  assert.equal(projected.combatants.find((c) => c.id === "brenna")!.defense, 18);
  assert.equal(unitOf(state, "brenna").maxHp, 60, "the Engine's own party array is kept in step");
  assert.equal(unitOf(state, "brenna").hp, 60);

  assert.match(
    refusedStart({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: [...fiveEParty, { id: "tam", name: "Tam" }],
      enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    }),
    /^Tam has no ruleset sheet/,
  );

  const rough = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "moth", name: "Cinder Moth" }],
  });
  assert.equal(view(ember, rough).ruleset.id, "ember-roads");
  assert.match(
    refusedStart({
      definition: ember,
      cards: emberCards,
      partyCatalogs: emberCatalogs,
      party: [...emberParty, { id: "wick", name: "Wick" }],
      enemies: [{ id: "moth", name: "Cinder Moth" }],
    }),
    /^Wick has no ruleset sheet/,
  );
}

// ── Where an opponent's numbers come from: a bestiary, a proposal, a tier ──
{
  const byReference = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Something", creature: "creatures/thorn-lurker" }],
  });
  const byName = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Thorn Lurker" }],
  });
  const lurker = (state: CombatDirectorState) => rulesetCombatant(state.rulesetFight!.encounter, "a")!;
  assert.equal(lurker(byReference).defense, lurker(byName).defense, "a reference and a name find the same creature");
  assert.ok(lurker(byName).actions.length > 0);
  assert.deepEqual(byName.rulesetFight!.adjustments, [], "a creature that was written needs no adjusting");

  const clamped = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [
      {
        id: "a",
        name: "Invented Horror",
        tier: "cr_1_4",
        proposed: {
          health: 900,
          defense: 40,
          initiativeModifier: 9,
          tier: "cr_1_4",
          resist: ["fire", "narrative"],
          actions: [
            {
              id: "rend",
              name: "Rend",
              budget: "action",
              toHit: 40,
              damage: { dice: "20d12", flat: 30, type: "slashing" },
            },
          ],
        },
      },
    ],
  });
  const horror = rulesetCombatant(clamped.rulesetFight!.encounter, "a")!;
  assert.equal(horror.health!.max, 22, "health was pulled to the top of the CR 1/4 band");
  assert.equal(horror.defense, 14, "defense is the tier's own, plus the headroom one rung allows");
  assert.ok(
    clamped.rulesetFight!.adjustments.some((line) => line.startsWith("Invented Horror: ")),
    "every clamp says what it changed, named after the opponent it changed",
  );
  assert.ok(
    clamped.rulesetFight!.adjustments.some((line) => /damage type/i.test(line)),
    "a damage type this ruleset does not have is dropped and said out loud",
  );

  const tiered = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Nameless Thing", tier: "cr_2" }],
  });
  const thing = rulesetCombatant(tiered.rulesetFight!.encounter, "a")!;
  assert.equal(thing.block!.tier, "cr_2");
  // The ruleset's contests are everybody's, so they are not what a tier gave it.
  assert.equal(
    thing.actions.filter((action) => action.kind !== "contest").length,
    1,
    "a tier gives one attack and nothing else",
  );
  assert.ok(
    tiered.rulesetFight!.adjustments.some((line) => line.includes("was built from the numbers of")),
    "an opponent nobody wrote says where its numbers came from",
  );
  const unknownTier = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "a", name: "Road thing", tier: "apocalypse" }],
  });
  assert.equal(rulesetCombatant(unknownTier.rulesetFight!.encounter, "a")!.block!.tier, "stray", "the bottom rung");
  assert.ok(unknownTier.rulesetFight!.adjustments.some((line) => line.includes("apocalypse")));

  // A ruleset with no threat scale and nothing written has nothing to build an opponent out of.
  const scaleless = parsedOrThrow(
    variant(fiveEText, (doc) => {
      delete (doc.combat as Record<string, unknown>).threat;
      delete doc.catalogs;
    }),
    "a ruleset with no threat scale",
  );
  assert.match(
    refusedStart({
      definition: scaleless,
      cards: fiveECards,
      partyCatalogs: {},
      party: fiveEParty,
      enemies: [{ id: "a", name: "Nameless Thing" }],
    }),
    /declares no threat tiers/,
  );
}

// ── One accepted choice, and one refusal that changes nothing ──
for (const setup of [
  {
    what: "5e",
    definition: fiveE,
    cards: fiveECards,
    catalogs: spellCatalogs,
    party: fiveEParty,
    enemy: { id: "lurker", name: "Thorn Lurker" } as RulesetFightOpponent,
  },
  {
    what: "Ember Roads",
    definition: ember,
    cards: emberCards,
    catalogs: emberCatalogs,
    party: emberParty,
    enemy: { id: "moth", name: "Cinder Moth" } as RulesetFightOpponent,
  },
]) {
  const { definition, what } = setup;
  // A seed whose initiative puts a party member first, found by trying a few.
  let state = started({
    definition,
    cards: setup.cards,
    partyCatalogs: setup.catalogs,
    party: setup.party,
    enemies: [setup.enemy],
  });
  for (let seed = 1; seed < 60 && view(definition, state).controller !== "manual"; seed++) {
    state = started({
      definition,
      cards: setup.cards,
      partyCatalogs: setup.catalogs,
      party: setup.party,
      enemies: [setup.enemy],
      seed,
    });
  }
  assert.equal(view(definition, state).controller, "manual", `${what}: a party member opens the fight`);
  assert.equal(state.stage, "action");

  // A window the fight is holding open is waited on exactly as a turn is, and by whoever it asks.
  // Reading only the turn would leave a client whose own party member is being asked seeing an
  // opponent's turn and sending `continue` at it forever.
  {
    const held = JSON.parse(JSON.stringify(state)) as typeof state;
    const fight = held.rulesetFight!;
    const asked = view(definition, held).actorId!;
    fight.encounter.turn = fight.encounter.order.findIndex((id) => id !== asked);
    fight.encounter.window = {
      id: "w1",
      kind: "reaction",
      trigger: {
        kind: "leaves-reach",
        moverId: setup.enemy.id,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      },
      waiting: [asked],
    };
    assert.equal(
      rulesetDirectorStage(held),
      "action",
      `${what}: the fight waits on the one being asked, not on whoever is on turn`,
    );
    const carried = JSON.stringify(fight.encounter.window);
    const went = commandRulesetCombatDirector(definition, held, { type: "continue" });
    assert.equal(went.ok, true);
    assert.equal(
      JSON.stringify(held.rulesetFight!.encounter.window),
      carried,
      `${what}: and asking again moves nothing, because the answer is theirs to give`,
    );
  }

  const before = view(definition, state);
  const actorId = before.actorId!;
  assert.ok(before.options?.length, `${what}: a human on turn is offered a menu`);
  const attack = before.options!.find((option) => option.targetIds.includes(setup.enemy.id));
  assert.ok(attack, `${what}: something on the menu can be pointed at the opponent`);

  // A refusal changes nothing at all.
  const frozen = JSON.stringify(state.rulesetFight);
  const badTarget = commandRulesetCombatDirector(definition, state, {
    type: "ruleset",
    optionId: attack.id,
    targetIds: [actorId],
  });
  assert.ok(!badTarget.ok && badTarget.code === "ruleset_combat_bad-target", `${what}: ${JSON.stringify(badTarget)}`);
  assert.equal(JSON.stringify(state.rulesetFight), frozen, `${what}: a refusal leaves the fight untouched`);
  const unknown = commandRulesetCombatDirector(definition, state, {
    type: "ruleset",
    optionId: "nothing-like-this",
    targetIds: [setup.enemy.id],
  });
  assert.ok(!unknown.ok && unknown.code === "ruleset_combat_unknown-option");
  assert.equal(JSON.stringify(state.rulesetFight), frozen);
  // The other two styles' commands are not this style's.
  for (const wrong of [
    { type: "begin", unitId: actorId },
    { type: "classic", action: { type: "defend" } },
  ] as const) {
    const answered = commandRulesetCombatDirector(definition, state, wrong as never);
    assert.ok(!answered.ok && answered.code === "ruleset_combat_wrong_style", `${what}: ${wrong.type} is refused`);
  }

  const seqBefore = state.rulesetFight!.eventSeq;
  const accepted = commandRulesetCombatDirector(definition, state, {
    type: "ruleset",
    optionId: attack.id,
    targetIds: [setup.enemy.id],
  });
  assert.ok(accepted.ok, `${what}: a legal choice is accepted`);
  assert.ok(state.rulesetFight!.eventSeq > seqBefore, `${what}: the step left events behind`);
  const after = view(definition, state);
  const opponent = after.combatants.find((c) => c.id === setup.enemy.id)!;
  assert.equal(unitOf(state, setup.enemy.id).hp, opponent.health.value, `${what}: party and enemies stay in step`);
  assert.equal(unitOf(state, setup.enemy.id).maxHp, opponent.health.max);
  assert.ok(
    after.events.every((entry, index) => index === 0 || entry.seq > after.events[index - 1]!.seq),
    `${what}: the running number only goes up`,
  );

  // The projection is a projection.
  const printed = JSON.stringify(after);
  for (const leak of ['"build"', '"catalogs"', '"live"', '"seed"', '"cursor"', '"sheet"']) {
    assert.ok(!printed.includes(leak), `${what}: the view leaks ${leak}`);
  }
}

// ── `continue` resolves one turn and stops at the human ──
{
  const opponents: RulesetFightOpponent[] = [
    { id: "lurker", name: "Thorn Lurker" },
    { id: "hound", name: "Cinder Hound" },
  ];
  const opening = (seed: number) =>
    started({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: fiveEParty,
      enemies: opponents,
      seed,
    });
  // A seed whose initiative puts an opponent first, found by trying a few.
  let state = opening(1);
  for (let seed = 2; seed < 60 && view(fiveE, state).controller === "manual"; seed++) state = opening(seed);
  assert.notEqual(view(fiveE, state).controller, "manual", "an opponent opens this fight");
  assert.equal(rulesetDirectorStage(state), "select");
  let turns = 0;
  while (view(fiveE, state).controller !== "manual" && !state.outcome && turns < 20) {
    const order = state.rulesetFight!.encounter.order;
    const before = state.rulesetFight!.encounter;
    const actorBefore = order[before.turn];
    assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
    turns++;
    assert.notEqual(
      state.rulesetFight!.encounter.order[state.rulesetFight!.encounter.turn],
      actorBefore,
      "one continue resolves exactly one turn and moves on",
    );
  }
  assert.ok(turns > 0, "somebody the player does not play acted first");
  assert.equal(view(fiveE, state).controller, "manual", "and it stopped at the human");
  assert.equal(rulesetDirectorStage(state), "action");
}

// ── A party member handed to the Engine is played by the same picker ──
{
  const state = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "moth", name: "Cinder Moth" }],
    seed: 11,
  });
  for (const member of emberParty) {
    assert.ok(commandRulesetCombatDirector(ember, state, { type: "control", unitId: member.id, controller: "ai" }).ok);
  }
  assert.deepEqual(state.rulesetFight!.controllers, { juno: "ai", pell: "ai" });
  assert.notEqual(view(ember, state).controller, "manual", "nobody is waiting for the player now");
  assert.equal(view(ember, state).options, undefined, "and no menu is sent for a turn the player does not play");
  let guard = 0;
  while (!state.outcome && guard++ < 200) {
    assert.ok(commandRulesetCombatDirector(ember, state, { type: "continue" }).ok);
  }
  assert.ok(state.outcome, "a fight nobody plays still finishes");
  assert.ok(
    commandRulesetCombatDirector(ember, state, { type: "control", unitId: "juno", controller: "manual" }).ok === false,
    "and nothing moves after it is over",
  );
}

// ── The picker never double spends, never stalls and always ends the turn ──
for (const setup of [
  {
    what: "5e",
    definition: fiveE,
    cards: fiveECards,
    catalogs: spellCatalogs,
    party: fiveEParty,
    enemy: "Thorn Lurker",
  },
  {
    what: "Ember Roads",
    definition: ember,
    cards: emberCards,
    catalogs: emberCatalogs,
    party: emberParty,
    enemy: "Cinder Moth",
  },
]) {
  let resolved = 0;
  /** Which pools the picker actually paid out of, over the whole sweep. */
  const spentPools = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const state = started({
      definition: setup.definition,
      cards: setup.cards,
      partyCatalogs: setup.catalogs,
      party: setup.party,
      enemies: [
        { id: "a", name: setup.enemy },
        { id: "b", name: setup.enemy },
      ],
      seed,
    });
    for (const member of setup.party) {
      commandRulesetCombatDirector(setup.definition, state, { type: "control", unitId: member.id, controller: "ai" });
    }
    for (let turn = 0; turn < 8 && !state.outcome; turn++) {
      const before = state.rulesetFight!.encounter;
      const actor = before.order[before.turn]!;
      const spent = { ...rulesetCombatant(before, actor)!.budgets };
      assert.ok(commandRulesetCombatDirector(setup.definition, state, { type: "continue" }).ok);
      resolved++;
      const events = state.rulesetFight!.events.slice(-40).map((entry) => entry.event);
      for (const event of events) if (event.type === "spend") spentPools.add(event.pool);
      assert.ok(
        !events.some((event) => event.type === "refused"),
        `${setup.what} seed ${seed}: the picker chose something the rules refused`,
      );
      for (const [budget, left] of Object.entries(spent)) {
        const now = rulesetCombatant(state.rulesetFight!.encounter, actor)?.budgets[budget];
        if (now === undefined) continue;
        assert.ok(now <= left, `${setup.what}: a budget went up mid-turn`);
      }
      const now = state.rulesetFight!.encounter;
      assert.ok(!!state.outcome || now.order[now.turn] !== actor, `${setup.what} seed ${seed}: the turn never ended`);
    }
  }
  assert.ok(resolved >= 100, `${setup.what}: ${resolved} seeded turns were resolved`);
  // Paying out of a BIGGER pool is a candidate of its own, so the picker weighs casting something
  // bigger against casting it at all. Only the 5e draft has a pool family to climb.
  //
  // The party's two paid spells are written one rung apart and only one of them grows, so each pool
  // names exactly one thing: `slots_1` is Mending Light, `slots_2` is Ember Lance as written, and
  // `slots_3` can only be Ember Lance cast out of a bigger slot.
  if (setup.what === "5e") {
    assert.ok(
      spentPools.has("slots_3"),
      `${setup.what}: nothing was ever paid for out of a higher pool, it spent ${[...spentPools].join(", ")}`,
    );
    // An opponent built from a plain stat block has nothing to climb. A block's actions cost nothing
    // off any pool, so there is no bigger way for it to pay, whoever plays it, the Engine or a Game
    // Master. (One whose bestiary entry carries a sheet does; that is pinned in the creatures lane.)
    {
      const encounter = started({
        definition: setup.definition,
        cards: setup.cards,
        partyCatalogs: setup.catalogs,
        party: setup.party,
        enemies: [{ id: "a", name: setup.enemy }],
        seed: 1,
      }).rulesetFight!.encounter;
      const opponent = rulesetCombatant(encounter, "a")!;
      for (const action of opponent.actions) {
        for (const pool of ["slots_1", "slots_2", "slots_3"]) {
          assert.equal(
            planRulesetCombatCost(setup.definition, opponent, action, pool),
            null,
            `${setup.what}: an opponent's ${action.label} cannot be paid out of ${pool}`,
          );
        }
      }
    }
    // And the base way of paying is still there beside it: the bigger ways are candidates ADDED to
    // it, not candidates that replaced it. (What the extra rungs are worth against what they buy is
    // the picker's own weighing, and is not pinned here: with the price taken out entirely this
    // sweep still casts it as written somewhere, because a caster out of third-level slots has
    // nothing else to spend.)
    assert.ok(
      spentPools.has("slots_2"),
      `${setup.what}: the base way of paying vanished, it spent only ${[...spentPools].join(", ")}`,
    );
  }
}

// ── The picker leaves the dying alone, and points an ability at everybody it may take ──
{
  let blows = 0;
  let widest = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = started({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: fiveEParty,
      enemies: [
        { id: "a", name: "Grave Piper" },
        { id: "b", name: "Thorn Lurker" },
      ],
      seed,
    });
    for (const member of fiveEParty) {
      commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: member.id, controller: "ai" });
    }
    for (let turn = 0; turn < 30 && !state.outcome; turn++) {
      const before = state.rulesetFight!.encounter;
      const actor = rulesetCombatant(before, before.order[before.turn]!)!;
      const downBefore = new Set(before.combatants.filter((entry) => entry.down).map((entry) => entry.id));
      const seen = state.rulesetFight!.eventSeq;
      assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
      if (actor.side !== "enemy") continue;
      const fresh = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
      for (const event of fresh) {
        if (event.type !== "attack" && event.type !== "damage") continue;
        blows++;
        assert.ok(
          !downBefore.has(event.targetId),
          `seed ${seed}: ${actor.name} went for ${event.targetId}, who was already down`,
        );
      }
      const saved = new Set(
        fresh.flatMap((event) => (event.type === "save" && event.sourceId === actor.id ? [event.actorId] : [])),
      );
      widest = Math.max(widest, saved.size);
    }
  }
  assert.ok(blows > 50, `${blows} blows from opponents were looked at`);
  assert.equal(widest, 2, "an ability that may take three people took both members of a party of two");
}

// ── Whatever its temperament, an opponent that can strike does not stand there dodging ──
{
  const temperaments = [
    "reckless",
    "cautious",
    "opportunistic",
    "protective",
    "supportive",
    "disciplined",
    "cowardly",
    "patient",
    "methodical",
    "coordinated",
  ] as const;
  for (const adjective of temperaments) {
    const state = started({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: [fiveEParty[0]!],
      // The sturdiest creature the example ships against a fighter: a blow takes a small share of
      // either one's health, which is exactly where a standard action used to outscore every attack.
      enemies: [{ id: "sentinel", name: "Hollow Sentinel" }],
      seed: 11,
    });
    unitOf(state, "sentinel").tactics = {
      version: 1,
      seed: 11,
      category: "other",
      proficiency: "master",
      role: "bulwark",
      adjective,
    };
    commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: "brenna", controller: "ai" });
    let struck = 0;
    let stood = 0;
    for (let turn = 0; turn < 12 && !state.outcome; turn++) {
      const before = state.rulesetFight!.encounter;
      const actor = before.order[before.turn]!;
      const seen = state.rulesetFight!.eventSeq;
      assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
      if (actor !== "sentinel") continue;
      const fresh = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
      if (fresh.some((event) => event.type === "attack" && event.actorId === "sentinel")) struck++;
      if (fresh.some((event) => event.type === "standard")) stood++;
    }
    assert.ok(struck > 0, `a ${adjective} sentinel attacks`);
    assert.equal(stood, 0, `a ${adjective} sentinel with a blow to land never spends its turn on a standard action`);
  }
}

// ── A Game Master that answers "end turn" ends the turn ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: [fiveEParty[0]!],
    enemies: [{ id: "sentinel", name: "Hollow Sentinel", boss: true }],
    gm: true,
    seed: 11,
  });
  commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: "brenna", controller: "ai" });
  // Walk to the boss's turn: its window opens instead of the Engine playing it.
  for (let guard = 0; guard < 6 && !state.window; guard++) {
    assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
  }
  assert.equal(state.window?.actorId, "sentinel", "the boss's turn is a decision");
  const rest = state.window!.options.find((option) => option.optionId === "end-turn");
  assert.ok(rest, "ending the turn is one of the things a Game Master may choose");
  assert.ok(state.window!.options.length > 1, "beside everything else the boss could do");
  const round = state.rulesetFight!.encounter.round;
  assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "choose", candidateId: rest!.id }).ok);
  const after = state.rulesetFight!.encounter;
  assert.ok(
    state.window?.actorId !== "sentinel" || after.round > round,
    "the same window is not opened again for the same turn",
  );
  assert.notEqual(after.order[after.turn], "sentinel", "and the turn has moved on");
}

// ── A finished fight says so once ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Thorn Lurker" }],
    seed: 3,
  });
  for (const member of fiveEParty) {
    commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: member.id, controller: "ai" });
  }
  for (let turn = 0; turn < 200 && !state.outcome; turn++) {
    assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
  }
  assert.ok(state.outcome, "the fight ends");
  assert.equal(
    state.rulesetFight!.events.filter((entry) => entry.event.type === "outcome").length,
    1,
    "and its log says how exactly once",
  );
}

// ── Victory, defeat, and the Engine's own summary ──
{
  const win = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "moth", name: "Cinder Moth" }],
    seed: 5,
  });
  for (const member of emberParty) {
    commandRulesetCombatDirector(ember, win, { type: "control", unitId: member.id, controller: "ai" });
  }
  let guard = 0;
  while (!win.outcome && guard++ < 400) commandRulesetCombatDirector(ember, win, { type: "continue" });
  assert.ok(win.outcome === "victory" || win.outcome === "defeat", `the fight ended: ${win.outcome}`);
  assert.equal(win.stage, "finished");
  assert.ok(win.summary, "the Engine's own summary is filled from the fight");
  assert.equal(win.summary!.outcome, win.outcome);
  assert.equal(win.summary!.party.length, 2);
  assert.equal(win.summary!.enemies.length, 1);
  const ended = view(ember, win);
  assert.ok(ended.summary, "and the ruleset's own summary rides beside it");
  assert.equal(ended.summary!.outcome, win.outcome === "victory" ? "victory" : "defeat");
  assert.equal(ended.options, undefined, "a finished fight offers nothing");
  assert.equal(
    win.summary!.enemies[0]!.defeated,
    ended.summary!.enemies[0]!.defeated,
    "both summaries agree about the opponent",
  );

  // Running away is the director's own ending, and it still fills a summary.
  const fled = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
  });
  assert.ok(commandRulesetCombatDirector(fiveE, fled, { type: "flee" }).ok);
  assert.equal(fled.outcome, "flee");
  assert.equal(fled.summary!.outcome, "flee");
  assert.equal(rulesetDirectorStage(fled), "finished");
}

// ── Plain JSON, and dice that pick up where they were left ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    seed: 21,
  });
  for (const member of fiveEParty) {
    commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: member.id, controller: "ai" });
  }
  for (let turn = 0; turn < 3 && !state.outcome; turn++) {
    commandRulesetCombatDirector(fiveE, state, { type: "continue" });
  }
  const cursor = state.rulesetFight!.encounter.cursor;
  assert.ok(cursor > 0, "the fight has thrown dice");
  const reloaded = JSON.parse(JSON.stringify(state)) as CombatDirectorState;
  assert.deepEqual(reloaded.rulesetFight, state.rulesetFight, "a round trip changes nothing");
  const continuedHere = structuredClone(state);
  commandRulesetCombatDirector(fiveE, continuedHere, { type: "continue" });
  commandRulesetCombatDirector(fiveE, reloaded, { type: "continue" });
  assert.deepEqual(
    reloaded.rulesetFight!.events.map((entry) => entry.event),
    continuedHere.rulesetFight!.events.map((entry) => entry.event),
    "and the same dice come next",
  );
  // The cursor is what makes that true: rolling from zero would not agree.
  // Eight dice from each, because one d20 agrees by chance one time in twenty.
  const eight = (from: number) => {
    const roll = rulesetCombatRoller(state.rulesetFight!.encounter.seed, from);
    return Array.from({ length: 8 }, () => roll(20));
  };
  assert.notDeepEqual(eight(0), eight(cursor), "the dice after the cursor are not the dice the fight opened with");
  assert.deepEqual(eight(cursor), eight(cursor), "and the same cursor always gives the same dice");

  // The live sheet state the route writes back is keyed the way the game stores it.
  const live = rulesetFightLiveStates(state.rulesetFight!);
  assert.deepEqual(Object.keys(live).sort(), ["brenna", "corwin"]);
}

// ── A fight on a board, from the same path the tactical style takes ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    positioned: true,
  });
  const projected = view(fiveE, state);
  const grid = projected.grid;
  assert.ok(grid, "a positioned fight sends its board");
  assert.equal(grid.tiles.length, grid.height);
  for (const row of grid.tiles) assert.equal(row.length, grid.width);
  assert.deepEqual(grid.distance, { label: "ft", perCell: 5 }, "and what one cell of it is worth");
  // The board sizes are the tactical style's own; nothing here has a generator of its own.
  assert.ok(grid.width >= 12 && grid.width <= 14 && grid.height >= 8 && grid.height <= 10);
  for (const combatant of projected.combatants) {
    assert.equal(typeof combatant.x, "number", `${combatant.id} stands somewhere`);
    assert.ok(combatant.x! >= 0 && combatant.x! < grid.width);
    assert.ok(combatant.y! >= 0 && combatant.y! < grid.height);
    // The party's own Speed field is thirty feet, which is six squares; an opponent's is whatever
    // its own block says, in the same unit.
    if (combatant.side === "party") assert.equal(combatant.movement, 6, "thirty feet at five a square");
    else assert.ok(combatant.movement! >= 1, "and an opponent walks what its block says");
    assert.equal(combatant.movementLeft, combatant.movement);
  }
  const cells = new Set(projected.combatants.map((combatant) => `${combatant.x},${combatant.y}`));
  assert.equal(cells.size, projected.combatants.length, "and no two of them in the same cell");

  // The menu the actor on turn is sent carries somewhere to walk.
  const move = projected.options!.find((option) => option.id === RULESET_MOVE_OPTION);
  assert.ok(move, "a positioned menu offers the walk");
  assert.equal(move.kind, "move");
  assert.ok(move.cells!.length > 0);
  for (const cell of move.cells!) {
    assert.ok(cell.cost >= 1 && cell.cost <= 6, "nothing beyond the allowance is offered");
    assert.ok(!cells.has(`${cell.x},${cell.y}`), "and nowhere anybody is standing");
  }

  // A walk the menu offered is taken, and the view says where they ended up.
  const step = move.cells![0]!;
  const actorId = projected.actorId!;
  assert.ok(
    commandRulesetCombatDirector(fiveE, state, {
      type: "ruleset",
      optionId: RULESET_MOVE_OPTION,
      targetIds: [],
      to: { x: step.x, y: step.y },
    }).ok,
  );
  const walked = view(fiveE, state);
  const mover = walked.combatants.find((combatant) => combatant.id === actorId)!;
  assert.equal(mover.x, step.x);
  assert.equal(mover.y, step.y);
  assert.equal(mover.movementLeft, 6 - step.cost);

  // A cell the menu did not offer is refused with its own code, and changes nothing.
  const before = JSON.stringify(state.rulesetFight);
  const refused = commandRulesetCombatDirector(fiveE, state, {
    type: "ruleset",
    optionId: RULESET_MOVE_OPTION,
    targetIds: [],
    to: { x: 63, y: 63 },
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.ok ? "" : refused.code, "ruleset_combat_unreachable");
  assert.equal(JSON.stringify(state.rulesetFight), before, "a refusal changes nothing at all");

  // And so is a target further away than the weapon reaches.
  const actor = rulesetCombatant(state.rulesetFight!.encounter, actorId)!;
  const foe = state.rulesetFight!.encounter.combatants.find((combatant) => combatant.side !== actor.side)!;
  const away = Math.max(Math.abs(actor.x! - foe.x!), Math.abs(actor.y! - foe.y!));
  if (away > 1) {
    const swing = view(fiveE, state).options!.find((option) => option.kind === "attack");
    if (swing) {
      const outOfReach = commandRulesetCombatDirector(fiveE, state, {
        type: "ruleset",
        optionId: swing.id,
        targetIds: [foe.id],
      });
      assert.equal(outOfReach.ok, false);
      assert.equal(outOfReach.ok ? "" : outOfReach.code, "ruleset_combat_out-of-reach");
    }
  }

  // The same fight without the board is the one it always was.
  const flat = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
  });
  const flatView = view(fiveE, flat);
  assert.equal(flatView.grid, undefined);
  for (const combatant of flatView.combatants) {
    assert.equal(combatant.x, undefined);
    assert.equal(combatant.movementLeft, undefined);
  }
  assert.equal(
    flatView.options!.some((option) => option.kind === "move"),
    false,
  );
  // A ruleset that never says what a cell is worth ignores the request for a board.
  const silent = parsedOrThrow(
    variant(fiveEText, (doc) => {
      for (const key of ["distance", "ranged", "cover", "opportunity"]) delete doc.combat[key];
      for (const source of doc.combat.attacks ?? []) {
        delete source.reach;
        delete source.range;
      }
      // A push is measured in cells too, so the contest that only pushes goes with them.
      doc.combat.contests = doc.combat.contests.filter((contest: { onWin: { push?: number } }) => !contest.onWin.push);
    }),
    "a 5e draft that says nothing about cells",
  );
  const asked = started({
    definition: silent,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    positioned: true,
  });
  assert.equal(view(silent, asked).grid, undefined, "asking for a board does not conjure a cell size");
}

// ── The picker closes the distance, strikes, and always ends its turn ──
{
  /** Everybody played by the Engine, so `continue` resolves a whole turn at a time. */
  const handOver = (definition: RulesetDefinition, state: CombatDirectorState, party: Array<{ id: string }>) => {
    for (const member of party) {
      commandRulesetCombatDirector(definition, state, { type: "control", unitId: member.id, controller: "ai" });
    }
  };
  const runToTheEnd = (
    definition: RulesetDefinition,
    state: CombatDirectorState,
    party: Array<{ id: string }>,
    what: string,
  ) => {
    handOver(definition, state, party);
    let turns = 0;
    const seen: number[] = [];
    while (!state.outcome && turns < 400) {
      const round = state.rulesetFight!.encounter.round;
      const before = state.rulesetFight!.eventSeq;
      commandRulesetCombatDirector(definition, state, { type: "continue" });
      // One walk, one strike from anybody: the strikes a walk draws are logged before its `move`
      // event, so nobody may appear twice between two of those.
      const strikers = new Set<string>();
      for (const { seq, event } of state.rulesetFight!.events) {
        if (seq <= before) continue;
        if (event.type === "move") strikers.clear();
        if (event.type !== "opportunity") continue;
        assert.ok(!strikers.has(event.actorId), `${what}: ${event.actorId} struck twice at one passer-by`);
        strikers.add(event.actorId);
      }
      seen.push(round);
      turns++;
    }
    assert.ok(state.outcome, `${what} was supposed to finish, and stood on round ${seen.at(-1)} after ${turns} turns`);
    assert.ok(
      state.rulesetFight!.encounter.round <= 40,
      `${what} finished, but took ${state.rulesetFight!.encounter.round} rounds`,
    );
    return state;
  };

  // ── The picker walks where its own menu lets it, and as far as it needs to ──
  {
    /** An open field with the two of them eleven cells apart (or five), whatever board was drawn. */
    const field = (far: boolean) => {
      const state = started({
        definition: fiveE,
        cards: fiveECards,
        partyCatalogs: spellCatalogs,
        party: [fiveEParty[0]!],
        enemies: [{ id: "hound", name: "Cinder Hound" }],
        seed: 19,
        positioned: true,
      });
      const encounter = state.rulesetFight!.encounter;
      const grid = encounter.board!.grid;
      grid.tiles = grid.tiles.map((row) => row.map(() => "plains" as (typeof row)[number]));
      const brenna = rulesetCombatant(encounter, "brenna")!;
      const hound = rulesetCombatant(encounter, "hound")!;
      Object.assign(brenna, { x: 0, y: 0 });
      Object.assign(hound, { x: far ? 11 : 5, y: 0 });
      return { state, encounter: () => state.rulesetFight!.encounter };
    };
    /** Plays up to and including the hound's next turn, and hands back what that turn logged. */
    const houndsTurn = (state: CombatDirectorState) => {
      for (let guard = 0; guard < 4; guard++) {
        const now = state.rulesetFight!.encounter;
        const actor = now.order[now.turn]!;
        const seen = state.rulesetFight!.eventSeq;
        if (actor === "brenna") {
          assert.ok(
            commandRulesetCombatDirector(fiveE, state, { type: "ruleset", optionId: "end-turn", targetIds: [] }).ok,
          );
          continue;
        }
        assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
        return state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
      }
      throw new Error("the hound never came up");
    };

    // Eleven cells away on open ground, with eight cells of movement: the only cells it can hurt the
    // fighter from are the farthest it can walk to, nowhere near the cheapest, and it still finds them.
    const far = field(true);
    const closing = houndsTurn(far.state);
    assert.ok(
      closing.some((event) => event.type === "move" && event.actorId === "hound"),
      "the hound crossed the field",
    );
    // With its bite or with its breath, whichever the picker liked better from where it could get
    // to: either way the fighter was hurt or made to save on THIS turn.
    const hurt = (events: typeof closing) =>
      events.some(
        (event) =>
          (event.type === "attack" && event.actorId === "hound") ||
          (event.type === "save" && event.sourceId === "hound") ||
          (event.type === "damage" && event.sourceId === "hound"),
      );
    assert.ok(hurt(closing), "and used what it has on the same turn, instead of stopping three cells out");
    assert.ok(!closing.some((event) => event.type === "refused"), "nothing it chose was refused");

    // Knocked down five cells from the fighter: its menu offers standing up and no walk. It stands
    // (half its movement), walks with the rest and breathes, rather than choosing a walk the rules
    // refuse and losing the turn to the refusal, or lying where it fell for the rest of the fight.
    const down = field(false);
    rulesetCombatant(down.encounter(), "hound")!.tracked.push({ condition: "prone", rounds: null });
    const rising = houndsTurn(down.state);
    assert.ok(!rising.some((event) => event.type === "refused"), "a prone hound is never refused a walk");
    assert.ok(
      !rulesetCombatant(down.encounter(), "hound")!.tracked.some((entry) => entry.condition === "prone"),
      "it got up",
    );
    assert.ok(hurt(rising), "and still fought on the same turn");
  }

  // ── With nobody it can reach this turn, it sprints closer rather than spending its action idly ──
  for (const seed of [2, 5, 8, 13, 21, 34]) {
    const state = started({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: [fiveEParty[0]!],
      enemies: [{ id: "lurker", name: "Thorn Lurker" }],
      seed,
      positioned: true,
    });
    const encounter = state.rulesetFight!.encounter;
    const grid = encounter.board!.grid;
    grid.tiles = grid.tiles.map((row) => row.map(() => "plains" as (typeof row)[number]));
    Object.assign(rulesetCombatant(encounter, "brenna")!, { x: 0, y: 0 });
    Object.assign(rulesetCombatant(encounter, "lurker")!, { x: grid.width - 1, y: 0 });
    const allowance = rulesetCombatant(encounter, "lurker")!.movement!;
    assert.ok(grid.width - 1 > allowance * 2 + 1, "the field is wider than a sprint, so nothing is in reach this turn");
    for (let guard = 0; guard < 4; guard++) {
      const now = state.rulesetFight!.encounter;
      if (now.order[now.turn] === "lurker") break;
      assert.ok(
        commandRulesetCombatDirector(fiveE, state, { type: "ruleset", optionId: "end-turn", targetIds: [] }).ok,
      );
    }
    const seen = state.rulesetFight!.eventSeq;
    assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
    const turn = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
    const standards = turn.flatMap((event) =>
      event.type === "standard" && event.actorId === "lurker" ? [event.action] : [],
    );
    assert.deepEqual(
      standards,
      ["dash"],
      `seed ${seed}: the only standard action of a creature out of reach is the sprint`,
    );
    const walked = turn.reduce(
      (sum, event) => sum + (event.type === "move" && event.actorId === "lurker" ? event.cost : 0),
      0,
    );
    assert.equal(walked, allowance * 2, `seed ${seed}: and it walked its allowance twice over`);
  }

  // Seeded fights to the end, on both rulesets, on a board and off it.
  for (const seed of [3, 11, 29, 47, 101]) {
    runToTheEnd(
      fiveE,
      started({
        definition: fiveE,
        cards: fiveECards,
        partyCatalogs: spellCatalogs,
        party: fiveEParty,
        enemies: [
          { id: "lurker", name: "Thorn Lurker" },
          { id: "hound", name: "Cinder Hound" },
        ],
        seed,
        positioned: true,
      }),
      fiveEParty,
      `a positioned 5e fight on seed ${seed}`,
    );
  }
  for (const seed of [5, 13, 31]) {
    runToTheEnd(
      ember,
      started({
        definition: ember,
        cards: emberCards,
        partyCatalogs: emberCatalogs,
        party: emberParty,
        enemies: [
          { id: "moth", name: "Cinder Moth" },
          { id: "jackal", name: "Rust Jackal" },
        ],
        seed,
        positioned: true,
      }),
      emberParty,
      `a positioned Ember Roads fight on seed ${seed}`,
    );
  }

  // A ridge between them (#6678): two cells apart in a straight line, with every cell that is closer
  // in a straight line solid, and a way round to the south. Walked by the straight line, both stood
  // and looked at each other for the rest of the fight; walked by the route, it ends.
  {
    // Only an axe, as in the browser case that found it: nothing thrown, so walking is the only way
    // to close the gap.
    const axeOnly = build({
      abilities: { brawn: 3, wits: 0, heart: 0 },
      fields: { toughness: 6 },
      lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
    });
    const state = started({
      definition: ember,
      cards: [card("Juno", axeOnly)],
      partyCatalogs: {},
      party: [emberParty[0]!],
      enemies: [{ id: "moth", name: "Cinder Moth" }],
      seed: 1,
      positioned: true,
    });
    const encounter = state.rulesetFight!.encounter;
    const grid = encounter.board!.grid;
    const drawn = [
      "...m........",
      "...m........",
      "...mww......",
      ".....w......",
      "...www......",
      "............",
      "............",
      "............",
    ];
    const terrain = { ".": "plains", m: "mountain", w: "water" } as const;
    grid.width = 12;
    grid.height = 8;
    grid.tiles = drawn.map((row) => [...row].map((cell) => terrain[cell as keyof typeof terrain]));
    Object.assign(rulesetCombatant(encounter, "juno")!, { x: 2, y: 2 });
    Object.assign(rulesetCombatant(encounter, "moth")!, { x: 4, y: 0 });
    for (const [id, foe] of [
      ["juno", { x: 4, y: 0 }],
      ["moth", { x: 2, y: 2 }],
    ] as const) {
      const actor = rulesetCombatant(encounter, id)!;
      actor.movementLeft = actor.movement;
      assert.ok(
        !rulesetReachableCells(ember, encounter, id).some(
          (cell) => Math.max(Math.abs(cell.x - foe.x), Math.abs(cell.y - foe.y)) < 2,
        ),
        `${id} can reach no cell that is closer in a straight line, which is the board this case is about`,
      );
    }
    runToTheEnd(ember, state, [emberParty[0]!], "a fight across a ridge");
  }

  // Nobody ends a turn with movement left and an attack they could have reached: the picker walks
  // to the trouble rather than standing in the open.
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    seed: 19,
    positioned: true,
  });
  handOver(fiveE, state, fiveEParty);
  for (let turn = 0; turn < 12 && !state.outcome; turn++) {
    const before = state.rulesetFight!.encounter;
    const actorId = currentRulesetActor(before)?.id;
    commandRulesetCombatDirector(fiveE, state, { type: "continue" });
    if (!actorId) continue;
    const after = rulesetCombatant(state.rulesetFight!.encounter, actorId);
    if (!after || !rulesetCombatStanding(after)) continue;
    // Their turn is over: whatever they could still have reached, they did not stand and watch.
    const idle = (after.movementLeft ?? 0) > 0 && (after.budgets.action ?? 0) > 0;
    if (!idle) continue;
    const reachable = rulesetReachableCells(fiveE, state.rulesetFight!.encounter, actorId);
    const foes = state.rulesetFight!.encounter.combatants.filter(
      (combatant) => combatant.side !== after.side && rulesetCombatStanding(combatant),
    );
    const couldHaveStruck = reachable.some((cell) =>
      foes.some((foe) => Math.max(Math.abs(cell.x - foe.x!), Math.abs(cell.y - foe.y!)) <= 1),
    );
    assert.equal(
      couldHaveStruck,
      false,
      `${actorId} ended its turn with movement and an action left while somebody was within a step of a strike`,
    );
  }
}

console.log(
  "Ruleset combat director: sheets, bestiaries, clamps, tiers, refusals, one turn per continue, the picker, the board, summaries and a JSON round trip passed.",
);

// ── The picker weighs a contest like anything else, and the rules never refuse the one it picks ──
{
  let taken = 0;
  let won = 0;
  let actions = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const state = started({
      definition: ember,
      cards: emberCards,
      partyCatalogs: emberCatalogs,
      party: emberParty,
      enemies: [
        { id: "moth", name: "Cinder Moth" },
        { id: "jackal", name: "Rust Jackal" },
      ],
      seed,
      positioned: true,
    });
    for (const member of emberParty) {
      commandRulesetCombatDirector(ember, state, { type: "control", unitId: member.id, controller: "ai" });
    }
    for (let turn = 0; turn < 60 && !state.outcome; turn++) {
      assert.ok(commandRulesetCombatDirector(ember, state, { type: "continue" }).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    assert.ok(!events.some((event) => event.type === "refused"), `seed ${seed}: the rules refused a pick`);
    for (const event of events) {
      if (event.type === "attack" || event.type === "contest") actions++;
      if (event.type !== "contest") continue;
      taken++;
      if (event.winner === "actor") won++;
    }
  }
  // A contest is a setup, and kept modest: taken now and then across sixty fights, never the whole plan
  // (about one action in fifteen when this was written, held under one in four).
  assert.ok(taken > 0, "nobody the Engine plays ever tried a contest");
  assert.ok(won > 0, "and none of them ever came off");
  assert.ok(taken * 4 < actions, `contests became the plan rather than a part of it: ${taken} of ${actions} actions`);
}

// ── A party member the Engine plays answers its own windows, and may let one go ──
{
  // Sear waits for its holder to be hurt and is pointed back at whoever did it. It lives in this
  // fight alone: a party member the PLAYER plays who holds it is asked, and the fight waits, which
  // is right, and would hold up every other case in this file that is not about reactions.
  const sear = {
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
  } as unknown as RulesetCatalogEntry;
  const searRows = rowsFromCatalogEntry("spells", sear).map((row) => row.row);
  const base = wizardBuild();
  const reactive = { ...base, lists: { ...base.lists, spells: [...(base.lists?.spells ?? []), ...searRows] } };
  const moments = { opened: 0, taken: 0, letGo: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const state = started({
      definition: fiveE,
      cards: [card("Corwin", reactive)],
      partyCatalogs: { spells: [...spellEntries, sear] },
      party: [{ id: "corwin", name: "Corwin" }],
      enemies: [
        { id: "a", name: "Thorn Lurker" },
        { id: "b", name: "Thorn Lurker" },
      ],
      seed,
    });
    commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: "corwin", controller: "ai" });
    for (let turn = 0; turn < 10 && !state.outcome; turn++) {
      const before = state.rulesetFight!.events.length;
      assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
      assert.equal(
        state.rulesetFight!.encounter.window,
        undefined,
        `seed ${seed}: nobody the Engine plays leaves a window open`,
      );
      const events = state.rulesetFight!.events.slice(before).map((entry) => entry.event);
      assert.ok(!events.some((event) => event.type === "refused"), `seed ${seed}: an answer the rules refused`);
      for (const event of events) {
        if (event.type === "window" && event.moment === "harmed") moments.opened++;
        if (event.type === "pass") moments.letGo++;
        if (event.type === "budget" && event.budget === "reaction" && event.actorId === "corwin") moments.taken++;
      }
    }
  }
  // Whom an option that asks for nobody really lands on, which is what it is weighed against: the
  // one who hurt its holder, for a reaction pointed back at them, and the one walking away, for a
  // strike at a passer-by. Held open by hand here, so the answer is read rather than guessed at.
  {
    const state = started({
      definition: fiveE,
      cards: [card("Corwin", reactive)],
      partyCatalogs: { spells: [...spellEntries, sear] },
      party: [{ id: "corwin", name: "Corwin" }],
      enemies: [{ id: "a", name: "Thorn Lurker" }],
      seed: 1,
    });
    const held = structuredClone(state.rulesetFight!.encounter);
    held.window = {
      id: "w1",
      kind: "reaction",
      trigger: { kind: "harmed", sourceId: "a", label: "Bite" },
      waiting: ["corwin"],
    };
    const corwin = rulesetCombatant(held, "corwin")!;
    const answer = rulesetWindowOptions(fiveE, held, "corwin").find((option) => option.label === "Sear");
    assert.ok(answer, "Sear is offered at the moment it waits for");
    assert.deepEqual(answer.targets, { side: "self", count: 0 }, "and asks nobody whom to point at");
    assert.equal(rulesetWindowTargetOf(held, corwin, answer), "a", "because it lands on whoever hurt its holder");
    held.window = {
      ...held.window,
      trigger: { kind: "leaves-reach", moverId: "a", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
    };
    assert.equal(rulesetWindowTargetOf(held, corwin, answer), "a", "a strike at a passer-by lands on the passer-by");
    held.window = { ...held.window, trigger: { kind: "between-turns", nextActorId: "a" } };
    assert.equal(rulesetWindowTargetOf(held, corwin, answer), undefined, "and a pause between turns points at nobody");
  }

  assert.ok(moments.opened > 0, "being hurt opened windows for a party member the Engine plays");
  assert.ok(moments.taken > 0, "and the Engine answered them, pointed back at whoever did it");
  // Availability alone never forces a spend: letting the moment go by is a candidate like any other,
  // weighed the way ending a turn is, and over forty seeded fights the picker does choose it.
  assert.ok(moments.letGo > 0, "and at least once it let the moment go by");
  assert.equal(
    moments.taken + moments.letGo,
    moments.opened,
    "every window answered exactly once, one way or the other",
  );
}
