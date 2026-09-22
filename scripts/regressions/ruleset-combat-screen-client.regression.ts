// Ruleset combat, slice C3b: the fight on screen, driven through the REAL exported helpers, the
// REAL example rulesets and the REAL English catalog, so nothing here can agree with a mistake the
// components also make.
//
// What it pins:
//   - Every event a fight can report has a line, and the line reads the ruleset's own words: 5e
//     rolls a d20 against AC and Ember Roads rolls 2d6 against a Guard, out of the same code.
//   - The menu comes out grouped in one order, an option says what it spends in the ruleset's own
//     budget and pool names, and the forecast is the server's numbers rather than a sum done here.
//   - Target picking stays inside the option's own list and its own count, and a heal is offered
//     the allies the server said it may be pointed at.
//   - The one decision that says a fight is the ruleset's own, for every combination of the three
//     things it reads, and the battle bridge standing aside for exactly that fight.
//   - The recap a finished fight hands the Game Master, from a real summary.
//   - Every localization key the changed client code asks for exists.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetAimCells,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetEncounterSummary,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  type Combatant,
  type DirectedRulesetEvent,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
  type RulesetStatBlock,
  type TacticalGrid,
  type TacticalTerrain,
  RULESET_MOVE_OPTION,
  RULESET_STAND_OPTION,
} from "../../packages/shared/src/index.js";
import {
  rulesetCombatEventLine,
  rulesetCombatLogLines,
  rulesetCombatNames,
  rulesetRefusalText,
  rulesetValueLabel,
} from "../../packages/client/src/lib/ruleset-combat-log.js";
import {
  rulesetBoardCells,
  rulesetCellKey,
  rulesetCellSentences,
  rulesetDistanceText,
  rulesetHealthPercent,
  rulesetNothingInReach,
  rulesetOptionHasAim,
  rulesetOptionNeedsAim,
  rulesetOptionNeedsCell,
  rulesetPathTo,
} from "../../packages/client/src/lib/ruleset-combat-board.js";
import {
  RULESET_MENU_KINDS,
  rulesetDefaultTargets,
  rulesetMenuGroups,
  rulesetOptionCostText,
  rulesetOptionForecastText,
  rulesetOptionLabel,
  rulesetOptionNeedsTargets,
  rulesetPickTarget,
  rulesetSendsOnPick,
  type RulesetMenuStep,
} from "../../packages/client/src/lib/ruleset-combat-menu.js";
import {
  isRulesetCombatFight,
  rulesetCombatRecapLines,
  seedRulesetBattleParty,
} from "../../packages/client/src/lib/ruleset-combat-bridge.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;

/** English rendering with i18next's own plural suffix and interpolation, so every assertion below
 *  reads the shipped strings rather than a copy of them. */
function translate(key: string, params: Record<string, unknown> = {}): string {
  const count = params.count;
  const plural = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : key;
  const message = messages[plural] ?? messages[key];
  // A key the screen asks for and the catalog does not hold is the failure this lane exists for,
  // except where the code itself passes a default and means it.
  if (message === undefined) {
    const fallback = params.defaultValue;
    assert.ok(typeof fallback === "string", `en.json is missing ${key}`);
    return fallback;
  }
  return message.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_all, name: string) => String(params[name] ?? ""));
}
type Translator = Parameters<typeof rulesetCombatEventLine>[2];
const t = translate as unknown as Translator;

// ── Every key the changed client code asks for exists ──

const keyPattern = /"((?:game\.combat\.ruleset|game\.ruleset\.(?:setup|import))\.[a-zA-Z0-9_.]+)"/gu;
const sources = [
  "packages/client/src/lib/ruleset-combat-log.ts",
  "packages/client/src/lib/ruleset-combat-menu.ts",
  "packages/client/src/lib/ruleset-combat-board.ts",
  "packages/client/src/components/game/RulesetCombatBoard.tsx",
  "packages/client/src/components/game/RulesetCombatMenu.tsx",
  "packages/client/src/components/game/RulesetCombatStatus.tsx",
  "packages/client/src/components/game/GameSetupRulesChooser.tsx",
  "packages/client/src/components/agents/RulesetImportReviewModal.tsx",
  "packages/client/src/features/chat-settings/sections/CombatStyleSection.tsx",
].map(readSource);
const referenced = new Set<string>();
for (const source of sources) for (const match of source.matchAll(keyPattern)) referenced.add(match[1]!);
for (const key of [
  "game.combat.ruleset.menu.flee",
  "game.combat.ruleset.status.order",
  "game.ruleset.setup.combatOwnRules",
  "game.ruleset.import.combatOwnRules",
  "game.combat.ruleset.preferenceIgnored",
  "game.combat.ruleset.preferencePositions",
  "game.combat.ruleset.board.nothingInReach",
  "game.combat.ruleset.status.movement",
]) {
  assert.ok(referenced.has(key), `the screen no longer asks for ${key}`);
}
for (const key of referenced) {
  const present = key in messages || (`${key}_one` in messages && `${key}_other` in messages);
  assert.ok(present, `en.json is missing ${key}`);
}
// The keys built at runtime from a kind, a reason or a refusal code are spelled out below, so the
// regex above cannot see them. They are checked where they are used, by rendering them.

// ── The example rulesets, parsed exactly as the Engine parses them ──

function parsed(text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `the example must stay usable: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
}
const fiveEText = readSource("docs/development/ruleset-5e-2014.example.json");
const emberText = readSource("docs/examples/rulesets/ember-roads.json");
const fiveE = parsed(fiveEText);
const ember = parsed(emberText);

assert.equal(fiveE.coverage.combat, true, "the 5e example resolves its own fights and says so");
assert.equal(ember.coverage.combat, true, "and so does Ember Roads");

// The ruleset's own word for what an attack is rolled against, which is what the log prints.
assert.equal(rulesetValueLabel(fiveE, fiveE.combat!.defense), "Armor Class");
assert.equal(rulesetValueLabel(ember, ember.combat!.defense), "Guard");
assert.equal(rulesetValueLabel(ember, undefined), "");
assert.equal(rulesetValueLabel(ember, { const: 7 }), "", "a plain number has no name to give");

// ── Fixtures: two fights, one per ruleset ──

/** Dice written down in advance, so every number in a line below was decided, not guessed. */
function dice(...faces: number[]): RulesetCombatRoller {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
}
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

const healEntries = [
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
] as unknown as RulesetCatalogEntry[];
const healRows = healEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));

const brenna: RulesetCombatantInput = {
  id: "brenna",
  name: "Brenna",
  side: "party",
  build: build({
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    saves: { str_save: "proficient", con_save: "proficient" },
    fields: { level: 7, ac: 18, speed: 30, hp_max: 60 },
    lists: {
      attacks: [
        { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
      ],
    },
  }),
  live: {},
  catalogs: {},
};
const corwin: RulesetCombatantInput = {
  id: "corwin",
  name: "Corwin",
  side: "party",
  build: build({
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    saves: { int_save: "proficient", wis_save: "proficient" },
    fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: healRows },
  }),
  live: { pools: { hp: { value: 20 } } },
  catalogs: { spells: healEntries },
};
const lurker = (block: Partial<RulesetStatBlock> = {}): RulesetCombatantInput => ({
  id: "lurker",
  name: "Thorn Lurker",
  side: "enemy",
  block: {
    health: 12,
    defense: 13,
    initiativeModifier: 2,
    saves: { dex_save: 2 },
    actions: [
      {
        id: "thorns",
        name: "Thorns",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "piercing" },
      },
    ],
    ...block,
  },
});

// ── Fixtures for the board ──
//
// A 5e caster whose spell lands as a shape, and an Ember Roads pair, so the same board code is
// proven in feet and in paces.

const fireballEntries = [
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
      range: 150,
      area: { shape: "burst", size: 20 },
      cost: [{ pool: "slots_3", amount: 1 }],
    },
  },
] as unknown as RulesetCatalogEntry[];
const fireballRows = fireballEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));

const corwinWithFireball = (): RulesetCombatantInput => ({
  id: "corwin",
  name: "Corwin",
  side: "party",
  build: build({
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    saves: { int_save: "proficient", wis_save: "proficient" },
    fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int", slots_max_3: 3 },
    lists: { spells: fireballRows },
  }),
  live: {},
  catalogs: { spells: fireballEntries },
});

const juno = (): RulesetCombatantInput => ({
  id: "juno",
  name: "Juno",
  side: "party",
  build: build({
    abilities: { brawn: 3, wits: 0, heart: 0 },
    fields: { toughness: 6 },
    lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
  }),
  live: {},
  catalogs: {},
});

const rustJackal = (): RulesetCombatantInput => ({
  id: "jackal",
  name: "Rust jackal",
  side: "enemy",
  block: {
    health: 10,
    defense: 6,
    initiativeModifier: 1,
    speed: 16,
    actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 1, damage: { count: 1, sides: 4, flat: 1 } }],
  },
});

/** A view of exactly the shape the server sends, for the parts a line or a panel reads. A
 *  positioned fight is projected exactly as `directedRulesetView` projects one: the grid with the
 *  ruleset's own cell size, and everybody's cell and allowance. */
const viewOf = (
  state: RulesetEncounterState,
  events: DirectedRulesetEvent[] = [],
  board?: { definition: RulesetDefinition; actorId?: string },
): DirectedRulesetView => {
  const grid = board ? state.board?.grid : undefined;
  const distance = board?.definition.combat?.distance;
  return {
    ruleset: { ...state.ruleset },
    round: state.round,
    order: [...state.order],
    controller: "manual",
    ...(grid && distance
      ? { grid: { width: grid.width, height: grid.height, tiles: grid.tiles.map((row) => [...row]), distance } }
      : {}),
    ...(board?.actorId ? { actorId: board.actorId } : {}),
    combatants: state.combatants.map((combatant) => ({
      id: combatant.id,
      name: combatant.name,
      side: combatant.side,
      initiative: combatant.initiative,
      // The real numbers wherever the fixture knows the ruleset, as the server's projection reads them.
      health: board?.definition.combat
        ? rulesetCombatHealth(board.definition, board.definition.combat, combatant)
        : { value: 0, max: 0, temp: 0 },
      defense: combatant.defense,
      conditions: [],
      budgets: { ...combatant.budgets },
      down: combatant.down,
      dying: combatant.dying,
      stable: combatant.stable,
      defeated: combatant.defeated,
      ...(typeof combatant.x === "number" && typeof combatant.y === "number" ? { x: combatant.x, y: combatant.y } : {}),
      ...(combatant.movement !== undefined
        ? { movement: combatant.movement, movementLeft: combatant.movementLeft ?? 0 }
        : {}),
    })),
    ...(board?.actorId ? { options: menuOf(board.definition, state, board.actorId) } : {}),
    events: events.map((event, index) => ({ seq: index + 1, event })),
    adjustments: [],
  };
};

/** The menu exactly as the director builds it: every option with the ids it may be pointed at, and,
 *  for a shape, the cells it may be aimed at with everybody each aim would catch. */
const menuOf = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string) =>
  rulesetCombatOptions(definition, state, actorId).map((option) => {
    const aim = option.area ? rulesetAimCells(state, actorId, option.id) : [];
    return {
      ...option,
      targetIds: rulesetOptionTargets(definition, state, actorId, option),
      ...(aim.length > 0 ? { aim } : {}),
    };
  }) satisfies DirectedRulesetOption[];

const line = (definition: RulesetDefinition, state: RulesetEncounterState, event: DirectedRulesetEvent) =>
  rulesetCombatEventLine(event, rulesetCombatNames(definition, viewOf(state), t), t);

// ── A real 5e fight: a d20 against AC, and the arithmetic printed ──

{
  // Brenna 18 initiative, the Lurker 4: she swings first.
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 4242,
    combatants: [brenna, lurker()],
    roller: dice(16, 2),
  });
  const opening = state.opening;
  assert.equal(
    line(fiveE, state, opening.find((event) => event.type === "initiative")!),
    "Initiative: Brenna 18, Thorn Lurker 4.",
  );
  assert.equal(line(fiveE, state, { type: "round", round: 1 }), "Round 1.");
  assert.equal(line(fiveE, state, { type: "turn", actorId: "brenna", round: 1 }), "Brenna takes their turn.");

  const menu = menuOf(fiveE, state, "brenna");
  const sword = menu.find((option) => option.label === "Longsword")!;
  assert.ok(sword, "the sheet's own weapon is on the menu");
  assert.deepEqual(sword.targetIds, ["lurker"], "and it may only be pointed at the other side");

  // A 17 on the die, +5 from Strength and proficiency, against Armor Class 13: a hit for 5 + 4 = 9.
  const swing = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brenna", optionId: sword.id, targetIds: ["lurker"] },
    dice(17, 5),
  );
  const names = rulesetCombatNames(fiveE, viewOf(swing.state), t);
  const printed = rulesetCombatLogLines(
    swing.events.map((event, index) => ({ seq: index + 1, event: event as DirectedRulesetEvent })),
    names,
    t,
  ).map((entry) => entry.text);
  assert.ok(
    printed.includes("Brenna attacks Thorn Lurker with Longsword: 17 + 7 = 24 against Armor Class 13, a hit."),
    `the attack line is not what it should be: ${JSON.stringify(printed)}`,
  );
  assert.ok(
    printed.includes("Thorn Lurker takes 9 slashing damage, and is on 3 of 12."),
    `the damage line is not what it should be: ${JSON.stringify(printed)}`,
  );
  assert.ok(
    !printed.some((line) => line.includes("Action left")),
    `what is left of a budget belongs to the status panel, not the log: ${JSON.stringify(printed)}`,
  );

  // Only the lines that are new are handed back, so a screen prints a fight once.
  const all = swing.events.map((event, index) => ({ seq: index + 1, event: event as DirectedRulesetEvent }));
  assert.deepEqual(rulesetCombatLogLines(all, names, t, all.length), []);
  const everyLine = rulesetCombatLogLines(all, names, t);
  assert.equal(
    rulesetCombatLogLines(all, names, t, everyLine[0]!.seq).length,
    everyLine.length - 1,
    "asking for what came after the first printed line leaves exactly that one out",
  );
}

// ── The same code on Ember Roads: 2d6 against a Guard, and Grit for health ──

{
  const juno: RulesetCombatantInput = {
    id: "juno",
    name: "Juno",
    side: "party",
    build: build({
      abilities: { brawn: 2, wits: 1, heart: 0 },
      fields: { toughness: 2 },
      lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
    }),
    live: {},
    catalogs: {},
  };
  const hound: RulesetCombatantInput = {
    id: "ash",
    name: "Ash-hound",
    side: "enemy",
    block: {
      health: 5,
      defense: 5,
      initiativeModifier: 0,
      actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 1, damage: { count: 1, sides: 4, flat: 1 } }],
    },
  };
  const state = createRulesetEncounter({
    definition: ember,
    seed: 11,
    combatants: [juno, hound],
    roller: dice(5, 4, 2, 1),
  });
  const menu = menuOf(ember, state, "juno");
  const axe = menu.find((option) => option.label === "Road axe")!;
  assert.ok(axe, "the sheet's own gear row is on the menu");
  const swing = applyRulesetCombatChoice(
    ember,
    state,
    { actorId: "juno", optionId: axe.id, targetIds: ["ash"] },
    dice(4, 3, 5),
  );
  const names = rulesetCombatNames(ember, viewOf(swing.state), t);
  const printed = swing.events.flatMap((event) => {
    const text = rulesetCombatEventLine(event as DirectedRulesetEvent, names, t);
    return text ? [text] : [];
  });
  assert.ok(
    printed.includes("Juno attacks Ash-hound with Road axe: 7 (4 + 3) + 2 = 9 against Guard 5, a hit."),
    `Ember Roads is not printed in its own terms: ${JSON.stringify(printed)}`,
  );
  assert.ok(
    printed.includes("Ash-hound takes 7 cut damage, and is on 0 of 5."),
    `the damage line is not what it should be: ${JSON.stringify(printed)}`,
  );
  assert.ok(printed.includes("Ash-hound is out of the fight."), JSON.stringify(printed));
  assert.ok(printed.includes("The fight is won."), JSON.stringify(printed));
  // Ember Roads has one budget and calls it Action: the ruleset's word, not this Engine's. The line
  // exists for a caller that wants it; the screen's own log leaves it to the status panel.
  assert.ok(printed.includes("Juno has 0 Action left."), JSON.stringify(printed));
  const onScreen = rulesetCombatLogLines(
    swing.events.map((event, index) => ({ seq: index + 1, event: event as DirectedRulesetEvent })),
    names,
    t,
  ).map((line) => line.text);
  assert.ok(!onScreen.some((line) => line.includes("Action left")), JSON.stringify(onScreen));

  // ── The recap a finished fight hands the Game Master ──
  const summary = rulesetEncounterSummary(ember, swing.state);
  assert.deepEqual(rulesetCombatRecapLines(ember, summary), [
    "Party on Ember Roads rules: Juno: 8/8 Grit",
    "Sheets: the Ember Roads sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.",
  ]);
}

// ── Every event a fight can report has a line ──

{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 7,
    combatants: [brenna, corwin, lurker()],
    roller: dice(10, 8, 3),
  });
  const say = (event: DirectedRulesetEvent) => line(fiveE, state, event);

  const table: Array<[RulesetCombatEvent["type"] | "director", string | null]> = [
    ["initiative", say({ type: "initiative", entries: [{ actorId: "brenna", roll: [12], modifier: 2, total: 14 }] })],
    ["round", say({ type: "round", round: 3 })],
    ["turn", say({ type: "turn", actorId: "brenna", round: 3 })],
    [
      "attack",
      say({
        type: "attack",
        actorId: "brenna",
        targetId: "lurker",
        optionId: "sword",
        label: "Longsword",
        mode: "advantage",
        rolls: [7, 19],
        kept: 19,
        modifier: 5,
        total: 24,
        defense: 13,
        outcome: "critical",
      }),
    ],
    [
      "save",
      say({
        type: "save",
        actorId: "brenna",
        save: "con_save",
        rolls: [11, 4],
        kept: 4,
        modifier: -1,
        total: 3,
        difficulty: 13,
        success: false,
      }),
    ],
    [
      "damage",
      say({
        type: "damage",
        targetId: "lurker",
        sourceId: "brenna",
        damageType: "fire",
        rolls: [4, 4],
        flat: 0,
        amount: 8,
        dealt: 4,
        adjust: "resist",
        saved: true,
        toTemp: 2,
        health: 8,
        maxHealth: 12,
        critical: true,
      }),
    ],
    ["heal", say({ type: "heal", targetId: "corwin", rolls: [5], flat: 4, amount: 9, health: 29, maxHealth: 38 })],
    ["temporary", say({ type: "temporary", targetId: "brenna", rolls: [3], flat: 2, amount: 5 })],
    ["condition", say({ type: "condition", targetId: "brenna", condition: "prone", active: true, reason: "applied" })],
    ["spend", say({ type: "spend", actorId: "corwin", pool: "slots_1", label: "1st-level slots", amount: 1 })],
    ["budget", say({ type: "budget", actorId: "brenna", budget: "bonus", left: 0 })],
    ["uses", say({ type: "uses", actorId: "lurker", optionId: "thorns", label: "Thorns", left: 1, of: 3 })],
    [
      "recharge",
      say({
        type: "recharge",
        actorId: "lurker",
        optionId: "thorns",
        label: "Thorns",
        rolls: [5],
        kept: 5,
        from: 5,
        back: true,
      }),
    ],
    ["signature", say({ type: "signature", actorId: "lurker", optionId: "wail", label: "Wail", cost: 2, left: 1 })],
    // The three the turn's own economy adds: a strike out of what one spend bought, a budget an
    // ability handed back, and something that added itself to a blow.
    ["strikes", say({ type: "strikes", actorId: "brenna", optionId: "sword", label: "Longsword", left: 1 })],
    [
      "gives",
      say({ type: "gives", actorId: "brenna", optionId: "surge", label: "Second Wind", budget: "action", left: 1 }),
    ],
    ["rider", say({ type: "rider", actorId: "brenna", targetId: "lurker", riderId: "sly", label: "Sly Strike" })],
    [
      "concentration",
      say({ type: "concentration", actorId: "corwin", label: "Bless", state: "ended", reason: "damage" }),
    ],
    ["standard", say({ type: "standard", actorId: "brenna", action: "help", targetId: "corwin" })],
    [
      "dying",
      say({
        type: "dying",
        actorId: "brenna",
        rolls: [12],
        kept: 12,
        difficulty: 10,
        successes: 2,
        failures: 1,
        result: "success",
      }),
    ],
    ["down", say({ type: "down", actorId: "brenna", dying: true })],
    ["defeated", say({ type: "defeated", actorId: "lurker" })],
    ["revived", say({ type: "revived", actorId: "brenna", health: 1 })],
    ["outcome", say({ type: "outcome", outcome: "victory" })],
    ["refused", say({ type: "refused", actorId: "brenna", optionId: "sword", reason: "no-budget" })],
    ["director", say({ type: "director", reason: "ruleset-unavailable", text: "The rules are gone." })],
    // The four a fight on a board adds. The board itself is a later slice; the lines are here so a
    // positioned fight reads as a fight rather than as a gap in the log.
    [
      "move",
      say({
        type: "move",
        actorId: "brenna",
        from: { x: 1, y: 2 },
        to: { x: 4, y: 2 },
        path: [
          { x: 2, y: 2 },
          { x: 3, y: 2 },
          { x: 4, y: 2 },
        ],
        cost: 3,
        left: 3,
      }),
    ],
    [
      "opportunity",
      say({ type: "opportunity", actorId: "lurker", targetId: "brenna", label: "Barbed claw", budget: "reaction" }),
    ],
    ["cover", say({ type: "cover", targetId: "lurker", bonus: 2, defense: 15 })],
    [
      "area",
      say({
        type: "area",
        actorId: "corwin",
        optionId: "fireball",
        label: "Fireball",
        at: { x: 5, y: 3 },
        cells: [
          { x: 4, y: 3 },
          { x: 5, y: 3 },
          { x: 6, y: 3 },
        ],
      }),
    ],
  ];
  const printed = new Map(table);
  for (const [type, text] of table) {
    assert.ok(text && text.length > 0, `a "${type}" event prints nothing`);
  }

  // The exact strings, so rewording one is a decision rather than an accident.
  assert.equal(printed.get("initiative"), "Initiative: Brenna 14.");
  assert.equal(printed.get("round"), "Round 3.");
  assert.equal(printed.get("turn"), "Brenna takes their turn.");
  assert.equal(
    printed.get("attack"),
    "Brenna attacks Thorn Lurker with Longsword: 19 (rolled 7, 19, with advantage) + 5 = 24 against Armor Class 13, a critical hit.",
  );
  assert.equal(printed.get("save"), "Brenna rolls Constitution save: 4 (rolled 11, 4) - 1 = 3 against 13, a failure.");
  assert.equal(
    printed.get("damage"),
    "Thorn Lurker takes 4 fire damage, and is on 8 of 12. A critical hit. Resisted. Halved by the save. 2 of it came off temporary points.",
  );
  assert.equal(printed.get("heal"), "Corwin recovers 9, and is on 29 of 38.");
  assert.equal(printed.get("temporary"), "Brenna gains 5 temporary points.");
  assert.equal(printed.get("condition"), "Brenna is now Prone.");
  assert.equal(printed.get("spend"), "Corwin spends 1 1st-level slots.");
  assert.equal(printed.get("budget"), "Brenna has 0 Bonus action left.");
  assert.equal(printed.get("uses"), "Thorns: 1 of 3 left.");
  assert.equal(printed.get("recharge"), "Thorns is ready again: 5, needing 5.");
  assert.equal(printed.get("signature"), "Thorn Lurker spends 2 on Wail, with 1 left.");
  assert.equal(printed.get("strikes"), "Brenna swings with Longsword, with 1 strike left.");
  assert.equal(printed.get("gives"), "Brenna uses Second Wind and has 1 Action.");
  assert.equal(printed.get("rider"), "Sly Strike catches Thorn Lurker as well.");
  // The last strike of a spend says so rather than promising none left.
  assert.equal(
    line(fiveE, state, { type: "strikes", actorId: "brenna", optionId: "sword", label: "Longsword", left: 0 }),
    "Brenna swings with Longsword, the last of the strikes.",
  );
  assert.equal(printed.get("concentration"), "Corwin loses hold of Bless.");
  assert.equal(printed.get("standard"), "Brenna helps Corwin.");
  assert.equal(printed.get("dying"), "Brenna holds on: 12 against 10. Held 2, slipped 1.");
  assert.equal(printed.get("down"), "Brenna goes down and is fighting to hold on.");
  assert.equal(printed.get("defeated"), "Thorn Lurker is out of the fight.");
  assert.equal(printed.get("revived"), "Brenna is back up on 1.");
  assert.equal(printed.get("outcome"), "The fight is won.");
  assert.equal(printed.get("refused"), "Brenna could not do that: They have nothing left to spend on it this turn.");
  assert.equal(printed.get("director"), "The fight stopped here: The rules are gone.");
  assert.equal(printed.get("move"), "Brenna moves to 4, 2 for 3 and has 3 left.");
  assert.equal(printed.get("opportunity"), "Thorn Lurker strikes at Brenna with Barbed claw as they move away.");
  assert.equal(printed.get("cover"), "Thorn Lurker is under cover, which adds 2 for a defense of 15.");
  assert.equal(printed.get("area"), "Corwin aims Fireball at 5, 3, covering 3 cells.");
  // A walk that went nowhere is getting back up, and a walk cut short says so.
  assert.equal(
    line(fiveE, state, {
      type: "move",
      actorId: "brenna",
      from: { x: 1, y: 2 },
      to: { x: 1, y: 2 },
      path: [],
      cost: 3,
      left: 3,
    }),
    "Brenna gets back up, which costs 3.",
  );
  assert.equal(
    line(fiveE, state, {
      type: "move",
      actorId: "brenna",
      from: { x: 1, y: 2 },
      to: { x: 2, y: 2 },
      path: [{ x: 2, y: 2 }],
      cost: 1,
      left: 5,
      stopped: true,
    }),
    "Brenna is stopped at 2, 2.",
  );

  // A fight that is still going says nothing, so nobody prints "ongoing" at a player.
  assert.equal(line(fiveE, state, { type: "outcome", outcome: "ongoing" }), null);

  // Drift guard: an event type the resolver learns to emit has to be given a line here too. The
  // union is read out of the shared types file, so a new variant fails this lane rather than
  // printing nothing on screen.
  const unionText = readSource("packages/shared/src/features/ruleset-combat/types.ts");
  // Only the union itself: from its declaration to the next exported declaration after it, so a
  // `type: "..."` literal further down the file is never mistaken for an event.
  const unionStart = unionText.indexOf("export type RulesetCombatEvent");
  const unionEnd = unionText.indexOf("\nexport ", unionStart + 1);
  assert.ok(unionStart >= 0 && unionEnd > unionStart, "the event union was not found where it used to be");
  const union = unionText.slice(unionStart, unionEnd);
  const declared = new Set([...union.matchAll(/\btype\??:\s*"([^"]+)"/gu)].map((match) => match[1]!));
  assert.ok(declared.size > 15, "the event union was not found where it used to be");
  for (const type of declared) {
    assert.ok(printed.has(type as RulesetCombatEvent["type"]), `no line is written for a "${type}" event`);
  }
}

// ── The refusal a 400 carries, and the sentence behind an unknown code ──

{
  assert.equal(
    rulesetRefusalText("ruleset_combat_bad-target", "That is not a legal target for this.", t),
    "That is not a legal target for this.",
  );
  assert.equal(
    rulesetRefusalText("ruleset_combat_decision_open", "whatever the server said", t),
    "Answer the open decision first.",
  );
  // A code this Engine does not know keeps the server's own sentence rather than inventing one.
  assert.equal(
    rulesetRefusalText("ruleset_combat_something_new", "The rules refused that.", t),
    "The rules refused that.",
  );
  assert.equal(
    rulesetRefusalText(undefined, "Battle anchor is not in this chat.", t),
    "Battle anchor is not in this chat.",
  );
  assert.equal(rulesetRefusalText("some_other_code", "Chat not found.", t), "Chat not found.");
}

// ── The menu: grouped, priced and forecast out of what the server sent ──

{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 9,
    combatants: [brenna, corwin, lurker()],
    roller: dice(15, 9, 3),
  });
  const menu = menuOf(fiveE, state, "brenna");
  const groups = rulesetMenuGroups(menu);
  assert.deepEqual(
    groups.map((group) => group.kind),
    RULESET_MENU_KINDS.filter((kind) => menu.some((option) => option.kind === kind)),
    "the groups come out in one order, and an empty one is not drawn",
  );
  assert.deepEqual(groups.at(-1)?.kind, "end-turn", "ending the turn is always last");
  assert.equal(groups.at(-1)?.labelKey, "game.combat.ruleset.group.endTurn");
  for (const group of groups) assert.ok(messages[group.labelKey], `en.json is missing ${group.labelKey}`);
  assert.deepEqual(rulesetMenuGroups(undefined), [], "no menu is no groups");
  assert.deepEqual(
    rulesetMenuGroups([{ ...menu[0]!, kind: "nonsense" as never }]),
    [],
    "an option of a kind this Engine does not know is left out rather than drawn without a heading",
  );

  // The ruleset names what it carries; the kind's own closed list of moves, and ending a turn, are
  // this Engine's vocabulary and are the only labels it writes.
  const dodge = menu.find((option) => option.label === "dodge")!;
  assert.ok(dodge, "the kind's own standard actions are on the menu as the resolver named them");
  assert.equal(rulesetOptionLabel(dodge, t), "Dodge");
  assert.equal(rulesetOptionLabel(menu.find((option) => option.kind === "end-turn")!, t), "End turn");
  assert.equal(
    rulesetOptionLabel({ ...dodge, label: "somersault" }, t),
    "somersault",
    "a move this Engine has no word for prints the one the resolver sent",
  );

  const budgetLabel = (id: string) => fiveE.combat!.economy.budgets.find((budget) => budget.id === id)?.label ?? id;
  const sword = menu.find((option) => option.label === "Longsword")!;
  assert.equal(rulesetOptionLabel(sword, t), "Longsword", "a weapon off the sheet keeps the sheet's own name");
  assert.equal(rulesetOptionCostText(sword, budgetLabel, t), "Spends Action");
  // A strike taken out of what one spend already bought carries no budget and says what is left.
  assert.equal(
    rulesetOptionCostText({ ...sword, budget: undefined, strikes: 1 }, budgetLabel, t),
    "Free, 1 strike left",
  );
  const forecast = rulesetOptionForecastText(sword, t);
  assert.match(forecast, /^\d+% to hit, about \d+ damage$/u, `the forecast reads oddly: ${forecast}`);
  assert.equal(
    rulesetOptionForecastText({ ...sword, heals: true }, t),
    forecast.replace(" damage", " healed"),
    "a heal is worded as healing, because both are an amount",
  );
  assert.equal(rulesetOptionForecastText({ ...sword, forecast: undefined }, t), "");

  // What a spell costs is the sheet's own pool name, and how many are left is the server's count.
  // The menu only ever holds the actor on turn's own options, so the wizard is given the initiative
  // in a fight of her own rather than being asked for a menu out of turn.
  const wizardsTurn = createRulesetEncounter({
    definition: fiveE,
    seed: 9,
    combatants: [brenna, corwin, lurker()],
    roller: dice(4, 18, 3),
  });
  assert.equal(wizardsTurn.order[0], "corwin", "the wizard rolled highest and is on turn");
  const heal = menuOf(fiveE, wizardsTurn, "corwin").find((option) => option.label === "Mending Light")!;
  assert.ok(heal, "the wizard's prepared spell is on the menu");
  const healCost = rulesetOptionCostText(heal, budgetLabel, t);
  assert.ok(healCost.startsWith("Spends Action · 1 "), `the cost is not in the sheet's own words: ${healCost}`);
  assert.equal(
    rulesetOptionCostText({ ...heal, left: 2, signature: { cost: 1, points: 3 } }, budgetLabel, t),
    `${healCost} · 1 of 3 points · 2 left`,
  );

  // ── Target picking stays inside the option's own list and count ──
  assert.ok(rulesetOptionNeedsTargets(sword));
  assert.deepEqual(sword.targetIds, ["lurker"], "one enemy is standing, so one id is legal");
  assert.ok(rulesetSendsOnPick(sword), "one target and one allowed is a single tap");
  assert.deepEqual(rulesetPickTarget(sword, [], "lurker"), ["lurker"]);
  assert.deepEqual(rulesetPickTarget(sword, [], "brenna"), [], "an id the option does not list cannot be picked");
  assert.deepEqual(rulesetPickTarget(sword, ["lurker"], "lurker"), [], "picking it again takes it off");

  // A heal is offered the allies the server said it may be pointed at, and never the other side.
  assert.equal(heal.targets.side, "ally");
  assert.deepEqual([...heal.targetIds].sort(), ["brenna", "corwin"]);
  assert.ok(!heal.targetIds.includes("lurker"), "a heal is never offered the enemy");

  // The count is the ceiling, and a pick beyond it changes nothing.
  const two: DirectedRulesetOption = { ...heal, targets: { side: "ally", count: 2 } };
  assert.ok(!rulesetSendsOnPick(two), "something that may take two is confirmed rather than sent on the first tap");
  assert.deepEqual(rulesetPickTarget(two, ["brenna"], "corwin"), ["brenna", "corwin"]);
  assert.deepEqual(rulesetPickTarget(two, ["brenna", "corwin"], "brenna"), ["corwin"]);
  const three: DirectedRulesetOption = { ...heal, targets: { side: "ally", count: 1 } };
  assert.deepEqual(rulesetPickTarget(three, ["brenna"], "corwin"), ["brenna"], "the count is the ceiling");

  // Nothing to point at, and something pointed at the actor, are both sent without a picking step.
  const endTurn = menu.find((option) => option.kind === "end-turn")!;
  assert.ok(!rulesetOptionNeedsTargets(endTurn));
  assert.deepEqual(rulesetDefaultTargets(endTurn), []);
  assert.equal(dodge.targets.side, "self");
  assert.ok(!rulesetOptionNeedsTargets(dodge), "aiming at yourself is not a choice");
  assert.deepEqual(rulesetDefaultTargets(dodge), dodge.targetIds.slice(0, dodge.targets.count));
  assert.deepEqual(rulesetDefaultTargets(sword), [], "something that IS a choice sends nothing until it is made");
}

// ── When a fight is the ruleset's own ──

{
  const both = ember;
  // A bestiary is written in the combat block's own terms, so a ruleset without one ships none.
  const withoutCombat = (doc: Record<string, any>) => {
    delete doc.combat;
    doc.catalogs = (doc.catalogs ?? []).filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
  };
  const battleOnly = parsed(emberText, withoutCombat);
  const combatOnly = parsed(emberText, (doc) => delete doc.battle);
  assert.ok(battleOnly.battle && !battleOnly.combat);
  assert.ok(combatOnly.combat && !combatOnly.battle);

  // All three, and it is the ruleset's fight.
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: both, anchor: "m1" }), true);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: combatOnly, anchor: "m1" }), true);
  // Take any one away and it is one of Marinara's own.
  assert.equal(isRulesetCombatFight({ combatDirector: false, definition: both, anchor: "m1" }), false);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: battleOnly, anchor: "m1" }), false);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: both, anchor: null }), false);
  // A game with no ruleset at all never reaches any of it.
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: null, anchor: "m1" }), false);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: undefined, anchor: undefined }), false);
  // The self-declared flag is not what decides it, either way round.
  const claimsNothing = parsed(emberText, (doc) => (doc.coverage.combat = false));
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: claimsNothing, anchor: "m1" }), true);
  const claimsCombat = parsed(emberText, (doc) => {
    withoutCombat(doc);
    doc.coverage.combat = true;
  });
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: claimsCombat, anchor: "m1" }), false);

  // ── And the battle bridge stands aside for exactly that fight ──
  const cards = [
    {
      name: "Juno",
      rulesetSheet: {
        v: 1,
        build: rulesetSheetBuildSchema.parse({
          abilities: { grit_stat: 2, wits: 1, heart: 0 },
          fields: { grit_max: 8 },
        }),
      },
    },
  ];
  const party: Combatant[] = [
    {
      id: "juno",
      name: "Juno",
      hp: 100,
      maxHp: 100,
      attack: 10,
      defense: 5,
      speed: 5,
      level: 3,
      side: "player",
    },
  ];
  const live = { juno: { pools: { grit: { value: 4 } } } };
  // A ruleset with only a `battle` block still lends the fight the sheet's own share.
  const bridged = seedRulesetBattleParty(battleOnly, cards, live, {}, party, null);
  assert.ok(bridged.party !== party, "the bridge really ran");
  assert.equal(bridged.party[0]!.hp, 67, "four Grit out of six is two thirds of a hundred hit points");
  // The very same call for the fight the ruleset resolves is never made: GameSurface asks the
  // decision above first, and the seeding it would have done is what would disagree with the
  // server's own reading of the same sheet.
  assert.equal(
    isRulesetCombatFight({ combatDirector: true, definition: both, anchor: "m1" }),
    true,
    "so this fight never reaches the bridge",
  );
  // A ruleset with no `battle` block hands back the very array it was given, references included.
  assert.equal(seedRulesetBattleParty(combatOnly, cards, live, {}, party, null).party, party);
}

// ── The recap, from a fight that really ended ──

{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [brenna, corwin, lurker({ health: 4 })],
    roller: dice(18, 9, 2),
  });
  const menu = menuOf(fiveE, state, "brenna");
  const sword = menu.find((option) => option.label === "Longsword")!;
  const over = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brenna", optionId: sword.id, targetIds: ["lurker"] },
    dice(18, 6),
  );
  const summary = rulesetEncounterSummary(fiveE, over.state);
  assert.equal(summary.outcome, "victory");
  const recap = rulesetCombatRecapLines(fiveE, summary);
  assert.deepEqual(recap, [
    "Party on 5e (SRD 5.1) rules: Brenna: 60/60 Hit points; Corwin: 20/38 Hit points",
    "Sheets: the 5e (SRD 5.1) sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.",
  ]);

  // Who is down, dying or stable, and what they are carrying, in the ruleset's own words.
  const hurt = {
    ...summary,
    party: [
      { ...summary.party[0]!, health: 0, down: true, dying: true, stable: false, conditions: ["unconscious"] },
      { ...summary.party[1]!, temp: 4, down: true, dying: true, stable: true, conditions: [] },
    ],
    enemies: [{ id: "lurker", name: "Thorn Lurker", health: 3, maxHealth: 12, defeated: false }],
  };
  assert.deepEqual(rulesetCombatRecapLines(fiveE, hurt), [
    "Party on 5e (SRD 5.1) rules: Brenna: 0/60 Hit points (dying; Unconscious); Corwin: 20/38 Hit points (stable; 4 temporary)",
    "Still standing: Thorn Lurker (3/12)",
    "Sheets: the 5e (SRD 5.1) sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.",
  ]);

  // A condition that OUTLIVES the fight is the Game Master's to end, as it is at a table: the thing
  // that would lift a charm is the spell's own terms or the fiction, never arithmetic, so the recap
  // names who is still carrying one and hands over the command rather than guessing. The condition
  // the dying rule puts on somebody at zero is deliberately not in that list, because it comes off
  // when they are healed or stabilised and the rules already say so.
  const charmed = {
    ...summary,
    party: [
      { ...summary.party[0]!, conditions: ["charmed"] },
      { ...summary.party[1]!, health: 0, down: true, dying: true, stable: false, conditions: ["unconscious"] },
    ],
  };
  const charmedRecap = rulesetCombatRecapLines(fiveE, charmed);
  const still = charmedRecap.find((line) => line.startsWith("Still affected:"));
  assert.ok(still, `the recap must name a lingering condition: ${JSON.stringify(charmedRecap)}`);
  assert.match(still, /Brenna \(Charmed\)/u, still);
  assert.doesNotMatch(still, /Corwin/u, "the dying rule's own condition is not a ruling to make");
  assert.match(still, /op="condition"/u, "and the Game Master is given the command that ends it");
}

// ── The board: everything on it came off the view, and nothing was worked out here ──
//
// Proven on BOTH examples, because nothing on this screen is 5e shaped: 5e measures a cell in feet
// and has strikes at somebody walking away, Ember Roads measures it in paces and has neither those
// nor cover nor long shots, and the same code draws both.

/** One character per cell, the same picture the shared grid lane draws its boards with. */
const TERRAIN: Record<string, TacticalTerrain> = { ".": "plains", ",": "forest", "#": "wall", "~": "water" };
function drawn(...rows: string[]): TacticalGrid {
  const tiles = rows.map((row) => [...row].map((glyph) => TERRAIN[glyph] ?? assert.fail(`no terrain "${glyph}"`)));
  const width = tiles[0]!.length;
  for (const row of tiles) assert.equal(row.length, width, "every row of a drawn board is the same width");
  return { width, height: tiles.length, tiles };
}

{
  // A count of cells in the ruleset's own distance, which is the one number this screen turns into
  // another. Five feet a cell and two paces a cell, out of the files themselves.
  const feet = fiveE.combat!.distance!;
  const paces = ember.combat!.distance!;
  assert.deepEqual(feet, { label: "ft", perCell: 5 });
  assert.deepEqual(paces, { label: "paces", perCell: 2 });
  assert.equal(rulesetDistanceText(6, feet, t), "30 ft");
  assert.equal(rulesetDistanceText(1, feet, t), "5 ft");
  assert.equal(rulesetDistanceText(4, paces, t), "8 paces");
  assert.equal(rulesetDistanceText(0, paces, t), "0 paces");
  // A fight with no board has no unit to say it in, so the count is printed as it stands rather
  // than in a unit this screen picked.
  assert.equal(rulesetDistanceText(3, undefined, t), "3");

  assert.equal(rulesetHealthPercent({ value: 5, max: 10 }), 50);
  assert.equal(rulesetHealthPercent({ value: 0, max: 0 }), 0, "nothing to be a share of is an empty bar");
  assert.equal(rulesetHealthPercent({ value: 99, max: 10 }), 100, "and a bar never runs past its end");
}

// ── 5e, in feet: the squares, the walk, the strike it would be met by, and the target ──
{
  //  0 1 2 3 4 5 6
  // ". . . . . . ."   Brenna at 0,1 walks toward the Lurker at 6,1
  // ". . # # . . ."   two walls in the middle, and forest that costs two to step onto
  // ". , . . . . ."
  const grid = drawn(".......", "..##...", ".,.....");
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 5,
    combatants: [brenna, lurker({ health: 30 })],
    board: { grid, placements: { brenna: { x: 0, y: 1 }, lurker: { x: 6, y: 1 } } },
    roller: dice(16, 2),
  });
  assert.equal(state.order[0], "brenna", "she rolled highest, so the menu below is hers");
  const view = viewOf(state, [], { definition: fiveE, actorId: "brenna" });
  assert.deepEqual(view.grid?.distance, { label: "ft", perCell: 5 });

  // Every square of the board, in reading order, with the terrain and who stands on it. None of it
  // was measured here: the terrain is the grid's and the cells are the combatants' own.
  const plain = rulesetBoardCells(view, null);
  assert.equal(plain.length, 21, "seven by three squares");
  assert.deepEqual(
    plain.map((cell) => rulesetCellKey(cell)).slice(0, 3),
    ["0,0", "1,0", "2,0"],
    "reading order, row by row",
  );
  const at = (cells: typeof plain, x: number, y: number) => cells.find((cell) => cell.x === x && cell.y === y)!;
  assert.equal(at(plain, 2, 1).terrain, "wall");
  assert.equal(at(plain, 2, 1).solid, true, "a wall is drawn solid");
  assert.equal(at(plain, 1, 2).terrain, "forest");
  assert.equal(at(plain, 1, 2).solid, false, "rough ground is not solid, it is just dearer");
  assert.equal(at(plain, 0, 1).occupant?.name, "Brenna");
  assert.equal(at(plain, 6, 1).occupant?.name, "Thorn Lurker");
  assert.equal(at(plain, 3, 0).occupant, undefined);
  // Outside a half-made choice nothing is highlighted: the board is information, not a command.
  assert.ok(plain.every((cell) => !cell.reach && !cell.targetable && !cell.aim));
  // A view with no grid is no board at all, whatever else it carries.
  assert.deepEqual(rulesetBoardCells(viewOf(state), null), []);

  const menu = view.options!;
  const walk = menu.find((option) => option.id === RULESET_MOVE_OPTION)!;
  assert.ok(walk, "a positioned menu offers the walk");
  assert.equal(walk.kind, "move");
  assert.ok(rulesetOptionNeedsCell(walk), "and taking it asks for a square");
  assert.ok(!rulesetOptionNeedsAim(walk));
  assert.equal(rulesetOptionLabel(walk, t), "Move", "the Engine's own word, never the id");
  // The two moves a board adds are told apart by the ids the resolver exports, never by spelling.
  assert.equal(
    rulesetOptionLabel({ ...walk, id: RULESET_STAND_OPTION, movementCost: 3, cells: undefined }, t),
    "Stand up",
  );
  assert.equal(
    rulesetOptionLabel({ ...walk, id: "something-else" }, t),
    walk.label,
    "a move this Engine has no word for prints the one the resolver sent",
  );
  // Getting back up is priced in the ruleset's own distance, and is sent without a square.
  const stand: DirectedRulesetOption = { ...walk, id: RULESET_STAND_OPTION, cells: undefined, movementCost: 3 };
  assert.equal(
    rulesetOptionCostText(stand, () => "", t, view.grid!.distance),
    "Costs 15 ft",
  );
  assert.ok(!rulesetOptionNeedsCell(stand), "it goes nowhere, so nothing is picked on the board");

  // Walking: the cells the server offered, each with its cost and the way it got there.
  const step: RulesetMenuStep = { stage: "move", option: walk, targets: [] };
  const walking = rulesetBoardCells(view, step);
  const offered = new Set(walk.cells!.map((cell) => rulesetCellKey(cell)));
  assert.deepEqual(
    new Set(walking.filter((cell) => cell.reach).map((cell) => rulesetCellKey(cell))),
    offered,
    "exactly the squares the server offered, and no others",
  );
  assert.ok(!at(walking, 2, 1).reach, "a wall is never offered");
  assert.equal(at(walking, 1, 1).reach?.cost, 1, "one square of plains costs one");
  assert.equal(at(walking, 1, 2).reach?.cost, 2, "and the forest beside it costs two");
  // The way there, drawn on hover, is the server's own path and stops at the square asked about.
  const path = rulesetPathTo(step, { x: 3, y: 0 });
  assert.ok(path.length > 0, "a square that was offered carries the way to it");
  assert.deepEqual(path.at(-1), { x: 3, y: 0 }, "and the way ends where it was going");
  assert.deepEqual(rulesetPathTo(step, { x: 2, y: 1 }), [], "a square nobody offered has no way to it");
  assert.deepEqual(rulesetPathTo(null, { x: 1, y: 1 }), [], "and neither has any square without a step");

  // Nobody can be swung at from where she stands, and the board says so out loud rather than
  // offering an attack that can be pointed at nobody.
  const sword = menu.find((option) => option.label === "Longsword")!;
  assert.deepEqual(sword.targetIds, [], "six squares away is further than a sword reaches");
  assert.equal(rulesetNothingInReach(view), true);
  // A fight with no board never says it, and neither does one whose opponents are all down.
  assert.equal(rulesetNothingInReach(viewOf(state)), false);
  assert.equal(
    rulesetNothingInReach({
      ...view,
      combatants: view.combatants.map((combatant) =>
        combatant.side === "enemy" ? { ...combatant, defeated: true } : combatant,
      ),
    }),
    false,
    "with the other side out of the fight there is nothing to be out of reach of",
  );

  // Walk up to it, and the same code says the opposite.
  const closed = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brenna", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } },
    dice(),
  );
  const near = viewOf(closed.state, [], { definition: fiveE, actorId: "brenna" });
  const nearSword = near.options!.find((option) => option.label === "Longsword")!;
  assert.deepEqual(nearSword.targetIds, ["lurker"], "the square next to it is within a sword's reach");
  assert.equal(rulesetNothingInReach(near), false);
  // Choosing it marks the square the target stands on, and nothing else.
  const aiming: RulesetMenuStep = { stage: "target", option: nearSword, targets: [] };
  const targeted = rulesetBoardCells(near, aiming);
  assert.deepEqual(
    targeted.filter((cell) => cell.targetable).map((cell) => rulesetCellKey(cell)),
    ["6,1"],
  );
  assert.equal(at(targeted, 6, 1).occupant?.id, "lurker");

  // What one square says, in whole sentences, out of the shipped English catalog.
  assert.equal(
    rulesetCellSentences(at(plain, 2, 1), view, t).join(" "),
    "Wall. Solid. Nothing can walk into it or see through it.",
  );
  assert.equal(
    rulesetCellSentences(at(plain, 0, 1), view, t).join(" "),
    "Plains. Brenna stands here, health 60 of 60. On turn.",
    "the numbers are the view's own, read off her sheet as the server reads them",
  );
  assert.equal(
    rulesetCellSentences(at(walking, 1, 2), view, t).join(" "),
    "Forest. Can be walked to for 10 ft.",
    "and what it costs is said in the ruleset's own distance",
  );
  assert.equal(
    rulesetCellSentences(at(targeted, 6, 1), near, t).join(" "),
    "Plains. Thorn Lurker stands here, health 30 of 30. Can be chosen as a target.",
  );
  // Stepping back out of its reach is a walk somebody strikes at, and the square says who.
  const back = near.options!.find((option) => option.id === RULESET_MOVE_OPTION);
  assert.ok(back, "a square of movement is left after walking five");
  const risky = rulesetBoardCells(near, { stage: "move", option: back, targets: [] }).find(
    (cell) => (cell.reach?.provokes.length ?? 0) > 0,
  );
  assert.ok(risky, "leaving the reach of a standing opponent is marked on the square");
  assert.match(rulesetCellSentences(risky, near, t).join(" "), /Walking here draws a strike from Thorn Lurker\.$/u);
  // Whoever is up is said out loud, so a screen reader is told where the turn is.
  const onTurn = rulesetBoardCells(near, null).find((cell) => cell.occupant?.id === "brenna")!;
  assert.ok(rulesetCellSentences(onTurn, near, t).includes("On turn."));
}

// ── Ember Roads, in paces: the same code, a different unit, and no strikes at all ──
{
  const grid = drawn("......", "......", "......");
  const state = createRulesetEncounter({
    definition: ember,
    seed: 7,
    combatants: [juno(), rustJackal()],
    board: { grid, placements: { juno: { x: 0, y: 1 }, jackal: { x: 5, y: 1 } } },
    roller: dice(4, 5, 3, 2),
  });
  const actorId = state.order[0]!;
  const view = viewOf(state, [], { definition: ember, actorId });
  assert.deepEqual(view.grid?.distance, { label: "paces", perCell: 2 });
  // Ember Roads gives everybody the same constant movement, so whoever acts first can walk.
  const walk = view.options!.find((option) => option.id === RULESET_MOVE_OPTION);
  assert.ok(walk, "whoever is up on Ember Roads is offered a walk");
  const cells = rulesetBoardCells(view, { stage: "move", option: walk, targets: [] });
  const some = cells.find((cell) => cell.reach);
  assert.ok(some, "and at least one square can be walked to");
  assert.match(
    rulesetCellSentences(some, view, t).join(" "),
    /Can be walked to for \d+ paces\.$/u,
    "Ember Roads walks in paces, and the very same code says so",
  );
  // Ember Roads declares no `opportunity`, so no square on it is ever walked through a swing.
  assert.ok(
    cells.every((cell) => (cell.reach?.provokes.length ?? 0) === 0),
    "a ruleset with no strike at somebody walking away marks no square as provoking one",
  );
}

// ── Aiming a shape: the cells are the server's, and so is everybody they catch ──
{
  const grid = drawn("........", "........", "........");
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 13,
    combatants: [corwinWithFireball(), lurker({ health: 30 }), lurker({ health: 30 })].map((entry, index) =>
      index === 2 ? { ...entry, id: "lurker2", name: "Second Lurker" } : entry,
    ),
    board: {
      grid,
      placements: { corwin: { x: 0, y: 1 }, lurker: { x: 5, y: 1 }, lurker2: { x: 6, y: 1 } },
    },
    roller: dice(18, 3, 2),
  });
  const view = viewOf(state, [], { definition: fiveE, actorId: "corwin" });
  const shape = view.options!.find((option) => !!option.area);
  assert.ok(shape, "the wizard's shaped spell is on the menu");
  assert.ok(rulesetOptionNeedsAim(shape!), "and taking it asks for a square rather than a name");
  assert.ok(!rulesetOptionNeedsCell(shape!));
  assert.deepEqual(shape!.targetIds, [], "a shape names nobody: the cells decide who it catches");
  const step: RulesetMenuStep = { stage: "aim", option: shape!, targets: [] };
  const cells = rulesetBoardCells(view, step);
  const aimable = cells.filter((cell) => cell.aim);
  assert.ok(aimable.length > 0, "there is somewhere to aim it");
  assert.deepEqual(
    new Set(aimable.map((cell) => rulesetCellKey(cell))),
    new Set(shape!.aim!.map((entry) => rulesetCellKey(entry))),
    "exactly the squares the server offered, and no shape invented here",
  );
  const both = aimable.find(
    (cell) => cell.aim!.targetIds.includes("lurker") && cell.aim!.targetIds.includes("lurker2"),
  );
  assert.ok(both, "one aim catches both of them");
  assert.match(
    rulesetCellSentences(both!, view, t).join(" "),
    /Can be aimed at, catching [^.]*Thorn Lurker[^.]*Second Lurker\.$/u,
    "and it names who, in the order the server sent",
  );
  // A friend caught by it is named exactly as an opponent is, because a shape does not care.
  const friendlyFire = aimable.find((cell) => cell.aim!.targetIds.includes("corwin"));
  assert.ok(friendlyFire, "a shape this wide catches the caster's own side too");
  assert.match(
    rulesetCellSentences(friendlyFire!, view, t).join(" "),
    /Can be aimed at, catching [^.]*Corwin[^.]*\.$/u,
    "and the board says so before it is confirmed",
  );
  const alone = aimable.find((cell) => cell.aim!.targetIds.length === 1)!;
  assert.ok(alone, "and an aim at the edge catches one of them");
  // An empty aim still says what it would do, rather than saying nothing.
  assert.match(
    rulesetCellSentences({ ...alone, aim: { targetIds: [] } }, view, t).join(" "),
    /Can be aimed at, catching nobody\.$/u,
  );
  // An id the fight no longer holds is left out rather than printed as a gap.
  assert.match(
    rulesetCellSentences({ ...alone, aim: { targetIds: ["lurker", "ghost"] } }, view, t).join(" "),
    /catching Thorn Lurker\.$/u,
  );
  // A shape with nowhere to land is STILL an aiming step: the server refuses a shape sent with no
  // square, so the step opens, lights nothing up and says so, rather than sending a choice that fails.
  const nowhere = { ...shape!, aim: undefined };
  assert.ok(rulesetOptionNeedsAim(nowhere));
  assert.ok(!rulesetOptionHasAim(nowhere));
  assert.ok(rulesetOptionHasAim(shape!));
  assert.ok(
    rulesetBoardCells(view, { stage: "aim", option: nowhere, targets: [] }).every((cell) => !cell.aim),
    "and no square is offered",
  );
  assert.equal(
    t("game.combat.ruleset.board.aimNobody", { label: "Fireball" }),
    "Fireball would catch nobody from here. Move closer, or go back.",
  );
}

// ── The menu groups, the movement group first ──
{
  assert.deepEqual([...RULESET_MENU_KINDS], ["move", "attack", "ability", "block", "standard", "end-turn"]);
  const grid = drawn(".....", ".....");
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 21,
    combatants: [brenna, lurker({ health: 30 })],
    board: { grid, placements: { brenna: { x: 0, y: 0 }, lurker: { x: 4, y: 1 } } },
    roller: dice(19, 2),
  });
  const groups = rulesetMenuGroups(menuOf(fiveE, state, "brenna"));
  assert.equal(groups[0]?.kind, "move", "where you go comes before what you swing");
  assert.equal(groups[0]?.labelKey, "game.combat.ruleset.group.move");
  assert.ok(messages[groups[0]!.labelKey], "en.json is missing the movement heading");
  assert.equal(groups.at(-1)?.kind, "end-turn", "and ending the turn is still last");
}

// ── The four refusals a board adds, as sentences ──
{
  assert.equal(
    rulesetRefusalText("ruleset_combat_unreachable", "The rules refused that choice.", t),
    "They cannot walk to that square.",
  );
  assert.equal(
    rulesetRefusalText("ruleset_combat_out-of-reach", "The rules refused that choice.", t),
    "That is further off than this reaches.",
  );
  assert.equal(
    rulesetRefusalText("ruleset_combat_no-line-of-sight", "The rules refused that choice.", t),
    "Something solid stands in the way.",
  );
  assert.equal(
    rulesetRefusalText("ruleset_combat_bad-cell", "The rules refused that choice.", t),
    "That is not a square this can be aimed at.",
  );
}

// ── The log says a walk in the ruleset's own distance, on both examples ──
{
  const grid = drawn("......", "......");
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 31,
    combatants: [brenna, lurker({ health: 30 })],
    board: { grid, placements: { brenna: { x: 0, y: 0 }, lurker: { x: 5, y: 1 } } },
    roller: dice(19, 2),
  });
  const feet = rulesetCombatNames(fiveE, viewOf(state, [], { definition: fiveE }), t);
  const walked: DirectedRulesetEvent = {
    type: "move",
    actorId: "brenna",
    from: { x: 0, y: 0 },
    to: { x: 3, y: 0 },
    path: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    cost: 3,
    left: 3,
  };
  assert.equal(
    rulesetCombatEventLine(walked, feet, t),
    "Brenna moves to 3, 0 for 15 ft and has 15 ft left.",
    "three squares is fifteen feet, because that is what the file says a square is worth",
  );
  assert.equal(
    rulesetCombatEventLine({ ...walked, to: { x: 0, y: 0 }, path: [], cost: 3, left: 0 }, feet, t),
    "Brenna gets back up, which costs 15 ft.",
  );

  const emberState = createRulesetEncounter({
    definition: ember,
    seed: 33,
    combatants: [juno(), rustJackal()],
    board: { grid, placements: { juno: { x: 0, y: 0 }, jackal: { x: 5, y: 1 } } },
    roller: dice(4, 5, 3, 2),
  });
  const paces = rulesetCombatNames(ember, viewOf(emberState, [], { definition: ember }), t);
  assert.equal(
    rulesetCombatEventLine({ ...walked, actorId: "juno" }, paces, t),
    "Juno moves to 3, 0 for 6 paces and has 6 paces left.",
    "the very same event, in the unit the other ruleset chose",
  );
  // A fight with no board has no unit to say it in, and the line still prints.
  const flat = rulesetCombatNames(fiveE, viewOf(state), t);
  assert.equal(rulesetCombatEventLine(walked, flat, t), "Brenna moves to 3, 0 for 3 and has 3 left.");
}

console.log("ruleset-combat-screen-client regression passed");
