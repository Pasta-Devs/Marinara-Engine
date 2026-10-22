// ──────────────────────────────────────────────
// Game: the director's third style, a fight the ruleset resolves itself
// ──────────────────────────────────────────────
// The same ledger as the other two styles: one storage row, one revision, one request-id guard and
// one per-chat queue. Only what happens inside a step is different, and all of it goes through the
// pure resolver in `@marinara-engine/shared`: the menu decides legality, the dice come from the
// session's own seed and cursor, and everything a party member spends or loses is written through
// the sheet's own rules.
//
// Everything here is pure over `(definition, state)` so a regression can drive a whole fight with
// no database and no network. The two things that are not pure, reading the ruleset and writing the
// party's live sheet state back, live in the route.

import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  assignCombatTactics,
  chooseCombatCandidate,
  clampRulesetStatBlock,
  createRulesetEncounter,
  currentRulesetActor,
  deterministicRng,
  findRulesetCreature,
  fillRulesetSheetChoices,
  generateTacticalBattlefield,
  madeTacticalBattlefield,
  foothillElevation,
  holdRulesetCombatant,
  holdRulesetSheetHealth,
  settleRulesetFledFight,
  rulesetReleaseHeldGround,
  type RulesetHeldGroundRelease,
  normalizeCharacterLookupName,
  normalizeGameDifficulty,
  normalizeTacticalEnvironment,
  normalizeTacticalFormation,
  placeSpawns,
  readRulesetLive,
  rulesetAimedCells,
  rulesetAreaGrowth,
  rulesetAimCells,
  rulesetAnswerDeflects,
  rulesetCombatant,
  rulesetCreatureKind,
  rulesetActiveConditions,
  rulesetItemEffectFacts,
  rulesetCombatConditions,
  rulesetZoneConditions,
  rulesetCombatHealth,
  rulesetCombatHide,
  rulesetCombatOptions,
  rulesetCostSteps,
  rulesetAverageAmount,
  rulesetDamageAverage,
  planRulesetCombatCost,
  rulesetCombatRoller,
  rulesetCombatStanding,
  rulesetHiddenFrom,
  rulesetStandardName,
  rulesetContestChance,
  rulesetProposedCreatureSchema,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
  rulesetOptionTargets,
  rulesetAroundTargets,
  rulesetReactionPointsAtSource,
  rulesetReactionTarget,
  rulesetFallTargets,
  rulesetPositionOf,
  rulesetWalkingDistances,
  rulesetFootprint,
  rulesetFootprintAt,
  rulesetSpanOf,
  rulesetGapFrom,
  rulesetSheetBuildsByName,
  readProposedRulesetSheet,
  restrictRulesetSheetEntries,
  RULESET_PROPOSED_SHEET_REPLACES,
  rulesetProposedStatBlock,
  rulesetTierStatBlock,
  rulesetWindowMoment,
  rulesetZonesShown,
  rulesetBoardShading,
  rulesetOpenLairWindow,
  rulesetWindowOptions,
  rulesetAreaCells,
  rulesetZoneCatches,
  rulesetZoneCells,
  RULESET_MOVE_OPTION,
  RULESET_ZONE_OPTION_PREFIX,
  RULESET_ZONE_TURN_OPTION_PREFIX,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  type CombatAiCandidate,
  type Combatant,
  type CombatDecisionOption,
  type DirectedCommand,
  type DirectedRulesetCombatant,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type RulesetBoardLight,
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatOption,
  type RulesetCombatant,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetHeldGround,
  type RulesetLiveState,
  type RulesetLiveStates,
  type TacticalBattlefieldBrief,
  type TacticalMadeBattlefield,
  type TacticalGrid,
  type CombatTactics,
  type RulesetSheetItem,
  rulesetCombatantFlying,
  withRulesetSheetEvaluationCache,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { combatDirectorView, type CombatDirectorState } from "./combat-director.service.js";

/** How many events a session keeps. A screen prints the tail and asks for nothing older, so the
 *  ledger row stays small however long a fight runs.
 *  ponytail: a fixed window. A fight that needs its whole history on screen wants the events in
 *  their own paged store, which is the upgrade path. */
export const RULESET_COMBAT_EVENT_LIMIT = 200;

/** How many lines the opponents' own build is allowed to leave behind. */
const RULESET_ADJUSTMENT_LIMIT = 60;

/** How many actions one turn of an actor nobody controls may take before the turn is ended anyway.
 *  Budgets already bound it; this is the belt beside the braces. */
const RULESET_TURN_ACTION_LIMIT = 12;

/** The fight itself, as the director's ledger stores it. Plain JSON by design: it is persisted, read
 *  back and resolved from exactly as it was left. */
export interface RulesetFightState {
  encounter: RulesetEncounterState;
  /** One per event ever produced, so a client prints only what it has not seen. */
  eventSeq: number;
  events: Array<{ seq: number; event: RulesetCombatEvent }>;
  /** Who plays each party member. An opponent is never in here. */
  controllers: Record<string, "manual" | "ai">;
  /** The opponents the client marked as bosses, which is what routes a turn to the Game Master. */
  bosses: string[];
  /** Every clamp and every fallback the opponents were built with, in plain words. */
  adjustments: string[];
  /** The loot table each opponent built from the bestiary carries, by combatant id: what a win rolls. */
  lootTables?: Record<string, string>;
}

export type RulesetCommandResult = { ok: true } | { ok: false; error: string; code: string };

const refuse = (error: string, code: string): RulesetCommandResult => ({ ok: false, error, code });

/** Where the fight stands, once a command has been applied: who is waited on, or that it is over. */
export function rulesetDirectorStage(state: CombatDirectorState): CombatDirectorState["stage"] {
  const fight = fightOf(state);
  if (!fight) return state.stage;
  if (state.outcome) return "finished";
  if (state.window) return "decision";
  // A window the fight is holding open is waited on exactly as a turn is, and by whoever it is
  // asking rather than whoever is on turn. Reading only the turn here would leave a client whose
  // own party member is being asked seeing an opponent's turn and sending `continue` at it.
  const asked = fight.encounter.window?.waiting[0];
  const waiting = asked ? rulesetCombatant(fight.encounter, asked) : currentRulesetActor(fight.encounter);
  return waiting && rulesetController(state, fight, waiting) === "manual" ? "action" : "select";
}

/** Where a command leaves the session. The director's own view is built once here, because that is
 *  what keeps the Engine's `party`, `enemies` and `CombatSummary` in step with the fight, and a
 *  fight that has ended has no decision open and nobody on turn. */
function settled(state: CombatDirectorState): RulesetCommandResult {
  combatDirectorView(state);
  if (state.outcome) {
    state.window = undefined;
    state.choices = [];
  }
  state.stage = rulesetDirectorStage(state);
  return { ok: true };
}

// ── Building the fight ──

export interface RulesetFightOpponent {
  id: string;
  name: string;
  /** A bestiary reference (`<catalogId>/<entryId>`) or a name, as the Game Master wrote it. */
  creature?: string;
  tier?: string;
  /** A stat block the Game Master proposed, in the shared creature form. Clamped onto the scale. */
  proposed?: unknown;
  boss?: boolean;
  /** How it fights: the same competence and temperament its choices in the fight are made with,
   *  which is also what fills an invented sheet's open choices. Assigned here when not given. */
  tactics?: Pick<CombatTactics, "proficiency" | "adjective">;
  /** How a story fight has it (1.363): its Legendary Resistance and health, when it is a bestiary's. */
  adjust?: { legendaryResistance?: number; maxHp?: number; calls?: Array<{ action: string; creature: string }> };
}

export interface RulesetFightSeed {
  definition: RulesetDefinition;
  seed: number;
  party: Array<{ id: string; name: string }>;
  enemies: RulesetFightOpponent[];
  /** Whether this fight is fought on a board. The ruleset still has to say what a cell is worth:
   *  one that does not stays theatre of the mind whatever the game asked for. */
  positioned?: boolean;
  /** What the tactical style's own generator is handed, unchanged: this fight has no second
   *  generator, no second terrain table and no board sizes of its own. */
  environment?: string | null;
  formation?: string | null;
  battlefield?: TacticalBattlefieldBrief;
  /** A board painted for the fight's place (worldgen W9g), fought on as painted: the brief is not used. */
  made?: TacticalMadeBattlefield;
  /** The board pack it is drawn with (1.333), by library id: this one, else the painted board's. */
  pack?: string;
  /** The chat's own party cards, which is where a sheet build lives. */
  cards: unknown;
  playerName: string | null;
  /** The stored live sheet state of the whole game. */
  live: RulesetLiveStates | null;
  /** What each party member holds, by name, when the ruleset's sheet reads items. */
  items?: (name: string) => RulesetSheetItem[];
  /** The catalogs the party's own rows came from, so the fight knows what an ability costs. */
  partyCatalogs: RulesetCatalogEntriesById;
  /** Every catalog of this ruleset that holds creatures. */
  bestiary: RulesetCatalogEntriesById;
  /** Who is caught unaware as it begins (1.237), by id, as the Game Master set the scene. */
  surprised?: string[];
  /** Who fights in its own lair (1.315), by id: its lair actions are taken on its lair's count. */
  inLair?: string[];
  /** Held Ground (1.323): whoever reaches no health in this fight is felled instead. The story's
   *  region rule decides it; the fight only keeps it. */
  heldGround?: RulesetHeldGround;
  /** The scene's time of day as the game tracks it (1.291), which sets the light outdoors. */
  time?: string | null;
}

export type RulesetFightSeedResult = { ok: true; fight: RulesetFightState } | { ok: false; error: string };

/**
 * A fight, ready for its first turn, or a plain sentence saying why it could not be built.
 *
 * The server decides what the fight is resolved by and what everybody's numbers are: a party
 * member's come off their own sheet, and an opponent's off a bestiary, off a clamped proposal or
 * off the ruleset's own threat scale, in that order. A client-sent sheet is never read.
 */
export function createRulesetFight(input: RulesetFightSeed): RulesetFightSeedResult {
  const { definition } = input;
  const combat = definition.combat;
  if (!combat) return { ok: false, error: "This game's ruleset does not resolve its own fights." };

  const adjustments: string[] = [];
  const lootTables: Record<string, string> = {};
  /** Invented opponents written as sheets, and the tier each is held to once it is built. */
  const heldToTier = new Map<string, NonNullable<typeof combat.threat>["tiers"][number]>();
  const builds = rulesetSheetBuildsByName(definition, input.cards, input.playerName);
  const combatants: RulesetCombatantInput[] = [];
  for (const member of input.party) {
    const key = normalizeCharacterLookupName(member.name);
    const build = builds.get(key);
    if (!build) {
      return { ok: false, error: `${member.name} has no ruleset sheet, so this fight cannot read their numbers.` };
    }
    combatants.push({
      id: member.id,
      name: member.name,
      side: "party",
      build,
      live: input.live?.[key],
      catalogs: input.partyCatalogs,
      ...(input.items ? { items: input.items(member.name) } : {}),
    });
  }

  for (const opponent of input.enemies) {
    // By the reference the Game Master named, then by the opponent's own name, and no further: a
    // fight built on a near miss is worse than one the Engine says it could not build.
    const named = opponent.creature ? findRulesetCreature(input.bestiary, opponent.creature) : null;
    const found = named ?? findRulesetCreature(input.bestiary, opponent.name);
    if (opponent.creature && !named) {
      adjustments.push(
        found
          ? `No bestiary holds "${opponent.creature}", so ${opponent.name} was looked up by name.`
          : `No bestiary of this ruleset holds "${opponent.creature}".`,
      );
    }
    if (found) {
      combatants.push({
        id: opponent.id,
        name: opponent.name,
        side: "enemy",
        creature: { catalogId: found.catalogId, entryId: found.entry.id },
        ...(opponent.adjust
          ? {
              adjust: {
                ...(opponent.adjust.legendaryResistance !== undefined
                  ? { legendaryResistance: opponent.adjust.legendaryResistance }
                  : {}),
                ...(opponent.adjust.maxHp !== undefined ? { health: opponent.adjust.maxHp } : {}),
                ...(opponent.adjust.calls?.length ? { calls: opponent.adjust.calls.map((call) => ({ ...call })) } : {}),
              },
            }
          : {}),
      });
      if (found.entry.creature?.loot) lootTables[opponent.id] = found.entry.creature.loot;
      continue;
    }
    const proposed =
      opponent.proposed === undefined ? null : rulesetProposedCreatureSchema.safeParse(opponent.proposed);
    // A creature invented for this fight in the ruleset's own terms: a mage with slots and spells.
    // Read leniently, held to its tier the way a plain invention is, and held again once it is built.
    if (proposed?.success && proposed.data.sheet) {
      const said = (line: string) => adjustments.push(`${opponent.name}: ${line}`);
      const beside = RULESET_PROPOSED_SHEET_REPLACES.filter(
        (key) => (opponent.proposed as Record<string, unknown>)[key] !== undefined,
      );
      if (beside.length > 0)
        said(`its sheet says its ${beside.join(", ")}, so the numbers written beside it were not used.`);
      const read = readProposedRulesetSheet(definition, proposed.data.sheet, input.bestiary);
      read.adjusted.forEach(said);
      // A boss is the Game Master's to write in full, as the exception it may be. Anything else keeps
      // only what the ruleset opens to its sheet (a Sorcerer's spells, not every spell) and has the
      // choices it left open filled by its temperament and competence, without another model call.
      let sheet = read.sheet;
      if (!opponent.boss) {
        const open = restrictRulesetSheetEntries(definition, sheet, input.bestiary);
        open.adjusted.forEach(said);
        const tactics =
          opponent.tactics ??
          assignCombatTactics(
            { id: opponent.id, hp: 1, maxHp: 1, attack: 0, defense: 0, speed: 0, level: 1 },
            input.seed,
          );
        const filled = fillRulesetSheetChoices(
          definition,
          open.sheet,
          input.bestiary,
          tactics,
          `choices:${input.seed}:${opponent.id}`,
        );
        filled.adjusted.forEach(said);
        sheet = filled.sheet;
      }
      const tiers = combat.threat?.tiers ?? [];
      const wanted = opponent.tier ?? proposed.data.tier;
      const tier = tiers.find((entry) => entry.id === wanted) ?? tiers[0];
      const held = tier ? holdRulesetSheetHealth(definition, sheet, tier) : { sheet, adjusted: [] };
      held.adjusted.forEach(said);
      // What the entry adds beside the sheet (its own actions, riders, the damage it shrugs off) is
      // held by the plain clamp, on a block that borrows the tier's own numbers for the ones the
      // sheet will give, so only the lines about those parts are said.
      const { sheet: _sheet, ...parts } = proposed.data;
      const plain = rulesetProposedStatBlock(definition, {
        ...parts,
        health: tier?.health[0] ?? 1,
        defense: 0,
        initiativeModifier: 0,
      });
      const clamped = plain ? clampRulesetStatBlock(definition, plain, wanted) : null;
      clamped?.adjusted.forEach(said);
      const {
        health: _health,
        healthDice: _dice,
        defense: _defense,
        initiativeModifier: _initiative,
        ...extras
      } = clamped?.block ?? { actions: [] };
      combatants.push({
        id: opponent.id,
        name: opponent.name,
        side: "enemy",
        block: { ...extras, sheet: held.sheet, ...(tier ? { tier: tier.id } : {}) },
      });
      if (tier) heldToTier.set(opponent.id, tier);
      continue;
    }
    if (proposed?.success) {
      const block = rulesetProposedStatBlock(definition, proposed.data);
      if (block) {
        const clamped = clampRulesetStatBlock(definition, block, opponent.tier ?? proposed.data.tier);
        for (const line of clamped.adjusted) adjustments.push(`${opponent.name}: ${line}`);
        combatants.push({ id: opponent.id, name: opponent.name, side: "enemy", block: clamped.block });
        continue;
      }
    }
    if (proposed && !proposed.success) {
      adjustments.push(`The proposed stat block for ${opponent.name} could not be read, so its tier was used.`);
    }
    const built = rulesetTierStatBlock(definition, opponent.tier, opponent.name);
    if (!built) {
      return {
        ok: false,
        error: `${opponent.name} is in no bestiary of this ruleset, carries no stat block, and the ruleset declares no threat tiers to build one from.`,
      };
    }
    if (opponent.tier && built.tier.id !== opponent.tier) {
      adjustments.push(`The tier "${opponent.tier}" is not on this ruleset's scale, so ${built.tier.label} was used.`);
    }
    adjustments.push(`${opponent.name} was built from the numbers of ${built.tier.label}.`);
    combatants.push({ id: opponent.id, name: opponent.name, side: "enemy", block: built.block });
  }

  const board = buildRulesetBoard(input, combatants);
  if (board && "error" in board) return { ok: false, error: board.error };
  let encounter = createRulesetEncounter({
    definition,
    seed: input.seed,
    combatants,
    bestiary: input.bestiary,
    ...(board ? { board } : {}),
    ...(input.surprised?.length ? { surprised: input.surprised } : {}),
    ...(input.inLair?.length ? { inLair: input.inLair } : {}),
    ...(input.heldGround ? { heldGround: input.heldGround } : {}),
  });
  for (const [id, tier] of heldToTier) {
    const built = rulesetCombatant(encounter, id);
    if (!built) continue;
    for (const line of holdRulesetCombatant(definition, built, tier)) adjustments.push(`${built.name}: ${line}`);
  }
  // A lair whose count comes before everybody's acts before the first turn (1.315).
  encounter = rulesetOpenLairWindow(definition, encounter);
  const fight: RulesetFightState = {
    encounter,
    eventSeq: 0,
    events: [],
    controllers: {},
    bosses: input.enemies.filter((opponent) => opponent.boss).map((opponent) => opponent.id),
    adjustments: adjustments.slice(0, RULESET_ADJUSTMENT_LIMIT),
    ...(Object.keys(lootTables).length > 0 ? { lootTables } : {}),
  };
  record(fight, encounter.opening);
  for (const line of fight.adjustments) logger.info("[game/combat:ruleset] %s", line);
  return { ok: true, fight };
}

/**
 * The board, from the tactical style's OWN path: its generator, its terrain, its board sizes, its
 * formations and the same bounded brief the Game Master may propose. Nothing here draws a grid.
 *
 * The units it places are stand-ins. A ruleset fight has no tactical units at all, because the
 * tactical engine's stats and arithmetic are the Engine's own and this fight runs on the ruleset's;
 * what placement reads off a unit is its side, whether it anchors the group and the tile it lands
 * on, and a stand-in carries exactly that.
 *
 * Null is a fight that stays theatre of the mind: the game did not ask for a board, or the ruleset
 * says nothing about what a cell is worth.
 */
function buildRulesetBoard(
  input: RulesetFightSeed,
  combatants: readonly RulesetCombatantInput[],
):
  | {
      grid: TacticalGrid;
      placements: Record<string, { x: number; y: number }>;
      battlefield?: unknown;
      light?: RulesetBoardLight;
      environment?: string;
      props?: NonNullable<TacticalMadeBattlefield["props"]>;
      events?: NonNullable<TacticalMadeBattlefield["events"]>;
      ground?: Record<string, { growth?: true; season?: string }>;
      lightRule?: NonNullable<TacticalMadeBattlefield["lightRule"]>;
    }
  | { error: string }
  | null {
  if (!input.positioned || !input.definition.combat?.distance) return null;
  const bosses = new Set(input.enemies.filter((opponent) => opponent.boss).map((opponent) => opponent.id));
  const stands = combatants.map((entry) => ({
    id: entry.id,
    side: entry.side,
    ...(bosses.has(entry.id) ? { isBoss: true } : {}),
    x: 0,
    y: 0,
  }));
  // The same cursor the tactical style reserves for setup, from the same seed, so the two styles
  // generate the same board for the same fight.
  const rng = deterministicRng(input.seed >>> 0, 0);
  const generated = input.made
    ? madeTacticalBattlefield(input.made)
    : generateTacticalBattlefield(
        stands.length,
        rng,
        normalizeTacticalEnvironment(input.environment ?? undefined),
        input.battlefield,
      );
  if (!generated.ok) return { error: generated.error };
  const { grid } = generated;
  if (
    !placeSpawns(grid, stands, normalizeTacticalFormation(input.formation ?? undefined), rng, generated.protectedTiles)
  )
    return { error: "Battlefield features prevent a connected deployment." };
  // A generated board's foothills, read off the tiles as deployment left them (combat C6b).
  if (!input.made) {
    const elevation = foothillElevation(grid);
    if (elevation) grid.elevation = elevation;
  }
  const placements: Record<string, { x: number; y: number }> = {};
  for (const stand of stands) placements[stand.id] = { x: stand.x, y: stand.y };
  // The light it is fought in and the kind of place it is (1.291): what keen eyes, a sensitivity
  // to light, camouflage and hiding in shadows read.
  const environment = input.environment ? normalizeTacticalEnvironment(input.environment) : undefined;
  const light = rulesetBoardLightFor(input.time, environment);
  return {
    grid,
    placements,
    battlefield: generated.battlefield,
    ...(light ? { light } : {}),
    ...(environment ? { environment } : {}),
    // The art it is drawn with (1.333).
    ...((input.pack ?? input.made?.pack) ? { pack: (input.pack ?? input.made?.pack)! } : {}),
    // What its painter stood on it that may be broken (1.316).
    ...(input.made?.props?.length ? { props: input.made.props } : {}),
    // What it does each round, and the growth and seasons on its cells (1.318).
    ...(input.made?.events?.length ? { events: input.made.events } : {}),
    ...(madeGround(input.made) ? { ground: madeGround(input.made)! } : {}),
    // What standing in its light does (1.319).
    ...(input.made?.lightRule ? { lightRule: input.made.lightRule } : {}),
  };
}

/** The growth and seasons a painted board's cells start with (1.318), or null. */
function madeGround(
  made: TacticalMadeBattlefield | undefined,
): Record<string, { growth?: true; season?: string }> | null {
  const ground: Record<string, { growth?: true; season?: string }> = {};
  for (const cell of made?.growth ?? []) ground[`${cell.x},${cell.y}`] = { growth: true };
  for (const [at, season] of Object.entries(made?.seasons ?? {})) ground[at] = { ...ground[at], season };
  return Object.keys(ground).length ? ground : null;
}

/** Places a fight's light comes from its own lamps rather than the sky. */
const INDOOR_ENVIRONMENTS = new Set(["dungeon", "cave", "castle", "mansion", "spaceship"]);
/** Places with no lamps of their own (1.294): dark whatever the hour, lit only by what is carried. */
const DARK_ENVIRONMENTS = new Set(["dungeon", "cave"]);

/**
 * The light a fight is fought in (1.291), off the scene's time of day: outdoors, the sun by day,
 * dim light at dawn and dusk, darkness at night; indoors, or when the time says nothing it
 * understands, bright light that is not the sun's (nothing said). A clock reading ("14:30",
 * "7pm") is read by its hour. A cave or a dungeon is dark at any hour (1.294).
 */
export function rulesetBoardLightFor(
  time: string | null | undefined,
  environment: string | undefined,
): RulesetBoardLight | undefined {
  if (environment && DARK_ENVIRONMENTS.has(environment)) return "dark";
  if (!time || (environment && INDOOR_ENVIRONMENTS.has(environment))) return undefined;
  const text = time.trim().toLowerCase();
  const clock = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(text);
  if (clock) {
    let hour = Number(clock[1]);
    if (clock[3] === "pm" && hour < 12) hour += 12;
    if (clock[3] === "am" && hour === 12) hour = 0;
    if (hour > 23) return undefined;
    if (hour >= 7 && hour < 18) return "sunlight";
    if (hour === 6 || hour === 18 || hour === 19) return "dim";
    return "dark";
  }
  if (/\b(midnight|night)\b/.test(text)) return "dark";
  if (/\b(dawn|dusk|twilight|sunrise|sunset|evening)\b/.test(text)) return "dim";
  if (/\b(morning|noon|midday|day|daytime|afternoon)\b/.test(text)) return "sunlight";
  return undefined;
}

// ── Reading the fight ──

const fightOf = (state: CombatDirectorState): RulesetFightState | null =>
  state.style === "ruleset" ? (state.rulesetFight ?? null) : null;

function record(fight: RulesetFightState, events: readonly RulesetCombatEvent[]): void {
  for (const event of events) fight.events.push({ seq: ++fight.eventSeq, event });
  if (fight.events.length > RULESET_COMBAT_EVENT_LIMIT) {
    fight.events = fight.events.slice(-RULESET_COMBAT_EVENT_LIMIT);
  }
}

/** Who plays this combatant: the player, the Engine's own picker, or the Game Master. */
export function rulesetController(
  state: CombatDirectorState,
  fight: RulesetFightState,
  combatant: RulesetCombatant | undefined,
): "manual" | "ai" | "gm" {
  if (!combatant) return "ai";
  // A party member is the player's to play unless they handed them over. Whoever was called to the
  // party's side (1.325) is the Engine's unless the player took them.
  if (combatant.side === "party") {
    const chosen = fight.controllers[combatant.id];
    return chosen === "ai" || (combatant.calledBy && chosen !== "manual") ? "ai" : "manual";
  }
  return state.gm && fight.bosses.includes(combatant.id) ? "gm" : "ai";
}

/** The dice this fight throws next: the session's own seed, from the cursor the last step left. */
const rollerFor = (fight: RulesetFightState) => rulesetCombatRoller(fight.encounter.seed, fight.encounter.cursor);

/** The party's live sheet state, keyed the way the game stores it, so the caller can write it back
 *  where the sheet reads it. */
export function rulesetFightLiveStates(fight: RulesetFightState): RulesetLiveStates {
  const live: RulesetLiveStates = {};
  for (const combatant of fight.encounter.combatants) {
    // The PARTY, and only the party. An opponent may carry a sheet too, but it exists for the fight
    // alone: writing it back would store it as a character's, keyed by the opponent's name, and a
    // character who happened to share that name would have their sheet overwritten.
    if (combatant.side !== "party" || !combatant.sheet) continue;
    live[normalizeCharacterLookupName(combatant.name)] = combatant.sheet.live as RulesetLiveState;
  }
  return live;
}

/**
 * The Engine's own `party` and `enemies` arrays, kept in step with the fight after every step: the
 * client's recap, the journal and the outcome the director reads all go through them, so they are
 * never allowed to drift from what the ruleset says.
 */
export function syncRulesetCombatants(definition: RulesetDefinition, state: CombatDirectorState): void {
  const fight = fightOf(state);
  const combat = definition.combat;
  if (!fight || !combat) return;
  // The ruleset decides who won, not the Engine's own hit points. They agree, because the numbers
  // below are the same numbers, but the ruleset is the one that is read.
  const outcome = rulesetEncounterOutcome(fight.encounter);
  // A party gone from the fight alive (1.279) got away, as fleeing does.
  if (!state.outcome && outcome !== "ongoing") state.outcome = outcome === "fled" ? "flee" : outcome;
  // The Engine's own round is the ruleset's round here, so the shell's header and the recap's
  // "after N rounds" report the fight that was actually fought rather than staying on round one.
  state.round = fight.encounter.round;
  const units = new Map<string, Combatant>();
  for (const unit of [...state.party, ...state.enemies]) units.set(unit.id, unit);
  for (const combatant of fight.encounter.combatants) {
    const unit = units.get(combatant.id);
    if (!unit) continue;
    const health = rulesetCombatHealth(definition, combat, combatant);
    unit.maxHp = Math.max(1, Math.floor(health.max));
    // Somebody away from the fight is not dead: what they had stays theirs.
    unit.hp = combatant.defeated && !combatant.away ? 0 : Math.min(unit.maxHp, Math.max(0, Math.floor(health.value)));
    unit.statusEffects = conditionsOf(definition, combatant).map((condition) => ({
      name: condition.label,
      modifier: 0,
      stat: "hp" as const,
      turnsLeft: Math.min(100, Math.max(0, condition.rounds ?? 0)),
    }));
  }
}

function conditionsOf(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Array<{ id: string; label: string; rounds?: number }> {
  const declared = new Map(definition.sheet.live.conditions.map((entry) => [entry.id, entry.label]));
  const tracked = new Map(combatant.tracked.map((entry) => [entry.condition, entry.rounds]));
  // And what a zone they stand in puts on them while they stay (1.179).
  const ids = new Set([
    ...rulesetCombatConditions(definition, combatant),
    ...(state ? rulesetZoneConditions(state, combatant) : []),
  ]);
  return [...ids].map((id) => {
    const rounds = tracked.get(id);
    return {
      id,
      label: declared.get(id) ?? id,
      ...(typeof rounds === "number" ? { rounds } : {}),
    };
  });
}

function deathTrackOf(definition: RulesetDefinition, combatant: RulesetCombatant) {
  const dying = definition.combat?.dying;
  // Only the party rolls against death; an opponent at zero is out, sheet or no sheet.
  if (!dying || combatant.side !== "party" || !combatant.sheet) return undefined;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  const value = (track: string) => live.tracks.find((entry) => entry.id === track)?.value ?? 0;
  // The member's own top, since a plain track's maximum may be a value their sheet works out.
  const max = (track: string) => live.tracks.find((entry) => entry.id === track)?.max ?? 0;
  return {
    successes: value(dying.successes),
    failures: value(dying.failures),
    successesMax: max(dying.successes),
    failuresMax: max(dying.failures),
  };
}

/** What a party member has left of the pools their actions spend (spell slots, ki, sorcery points),
 *  for the fight's own HUD: a player should not have to open the sheet mid-fight to count slots. */
function spentPoolsOf(definition: RulesetDefinition, combatant: RulesetCombatant) {
  if (combatant.side !== "party" || !combatant.sheet) return undefined;
  // The ruleset may name them itself, in its own order (1.375).
  const named = definition.combat?.display?.pools;
  if (named) {
    const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
    const pools = named.flatMap((id) =>
      live.pools
        .filter((pool) => pool.key === id && !pool.listId && pool.max > 0)
        .map((pool) => ({ id: pool.key, label: pool.label, value: pool.value, max: pool.max })),
    );
    return pools.length ? pools : undefined;
  }
  const spent = new Set<string>();
  const groups = new Set<string>();
  for (const action of combatant.actions) {
    if (action.use?.pool) spent.add(action.use.pool);
    if (action.use?.group) groups.add(action.use.group);
  }
  for (const pool of definition.sheet.live.pools) {
    if ((pool.group && groups.has(pool.group)) || pool.pays?.some((group) => groups.has(group))) spent.add(pool.id);
  }
  if (spent.size === 0) return undefined;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  const pools = live.pools
    .filter((pool) => !pool.listId && pool.max > 0 && spent.has(pool.key))
    .map((pool) => ({ id: pool.key, label: pool.label, value: pool.value, max: pool.max }));
  return pools.length ? pools : undefined;
}

/** The cells an area held in a window covers, laid as it was aimed: what a board tints while the ones
 *  it would catch decide whether to answer. */
function heldAreaCells(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  window: NonNullable<RulesetEncounterState["window"]>,
) {
  const resume = window.resume;
  if (resume?.kind !== "action" || !resume.at) return undefined;
  if (window.trigger.kind !== "aimed" && window.trigger.kind !== "used") return undefined;
  const actor = encounter.combatants.find((combatant) => combatant.id === resume.actorId);
  // Grown for the higher cost it was paid with (1.267), as it will land.
  const grow = actor ? rulesetAreaGrowth(definition, actor, resume.optionId, resume.payWith) : 0;
  const cells = rulesetAimedCells(encounter, resume.actorId, resume.optionId, resume.at, {
    ...(grow ? { grow } : {}),
    ...(resume.toward ? { toward: resume.toward } : {}),
    ...(resume.ring ? { ring: true } : {}),
    ...(resume.also ? { also: resume.also } : {}),
  });
  return cells.length ? cells.map((cell) => ({ x: cell.x, y: cell.y })) : undefined;
}

function projectCombatant(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state: RulesetEncounterState,
): DirectedRulesetCombatant {
  const combat = definition.combat!;
  const health = rulesetCombatHealth(definition, combat, combatant);
  const deathTrack = deathTrackOf(definition, combatant);
  const active = rulesetActiveConditions(definition, combat, combatant, state);
  const saveModifiers = active.flatMap((source) =>
    rulesetItemEffectFacts(definition, {
      modifiers: source.modifiers?.filter((one) => one.against),
      saves: source.saves,
    }),
  );
  return {
    id: combatant.id,
    name: combatant.name,
    side: combatant.side,
    ...(combatant.creature ? { creature: { ...combatant.creature } } : {}),
    initiative: combatant.initiative,
    health,
    defense: combatant.defense,
    conditions: conditionsOf(definition, combatant, state),
    hides: rulesetCombatHide(definition, combatant, state),
    damageModifiers: active.flatMap((source) => {
      const modifiers = source.modifiers?.filter((one) => one.to === "damage" || one.to === "damage-taken");
      if (!modifiers?.length) return [];
      const name = source.item
        ? source.condition
        : (definition.sheet.live.conditions.find((one) => one.id === source.condition)?.label ?? source.condition);
      return [{ name, facts: rulesetItemEffectFacts(definition, { modifiers }) }];
    }),
    budgets: { ...combatant.budgets },
    down: combatant.down,
    dying: combatant.dying,
    stable: combatant.stable,
    defeated: combatant.defeated,
    ...(combatant.away ? { away: true as const } : {}),
    ...(combatant.away?.left ? { left: true as const } : {}),
    ...(combatant.surprised ? { surprised: true as const } : {}),
    ...(deathTrack ? { deathTrack } : {}),
    ...(saveModifiers.length ? { saveModifiers } : {}),
    ...(() => {
      // Its creature type and tags, by their labels (1.168).
      const kinds = combat.creatureTypes;
      const kind = rulesetCreatureKind(definition, combatant);
      if (!kinds || (kind.type === undefined && !kind.tags.length)) return {};
      const type = kinds.types.find((one) => one.id === kind.type)?.label;
      const tags = kind.tags.map((tag) => kinds.tags?.find((one) => one.id === tag)?.label ?? tag);
      return { kind: { ...(type ? { type } : {}), ...(tags.length ? { tags } : {}) } };
    })(),
    ...(combatant.concentrating ? { concentrating: combatant.concentrating.label } : {}),
    ...((pools) => (pools ? { pools } : {}))(spentPoolsOf(definition, combatant)),
    ...(combatant.block?.tier ? { tier: combatant.block.tier } : {}),
    ...(combatant.block?.traits?.length ? { traits: combatant.block.traits.map((trait) => ({ ...trait })) } : {}),
    ...(typeof combatant.x === "number" && typeof combatant.y === "number" ? { x: combatant.x, y: combatant.y } : {}),
    ...(combatant.movement !== undefined
      ? { movement: combatant.movement, movementLeft: combatant.movementLeft ?? 0 }
      : {}),
    ...(combatant.altitude !== undefined ? { altitude: combatant.altitude } : {}),
    ...(combatant.span !== undefined ? { span: combatant.span } : {}),
    // Drawn in its flying art (1.352): never read by the rules.
    ...(rulesetCombatantFlying(state.board?.grid, combatant) ? { flying: true as const } : {}),
  };
}

/** How many cells one area option may be offered aimed at. A board is at most 14 by 10 and a shape
 *  reaches a handful of cells, so this is the belt beside the braces: the payload a screen is sent
 *  stays small however far a ruleset says something carries.
 *  ponytail: the nearest legal aims, cut at a fixed number. The upgrade path is to send the shape
 *  and let the board work the cells out, which is what slice C4b may prefer once it draws one. */
const RULESET_AIM_LIMIT = 120;

/** Every option of the legal menu, with the combatants each one may be pointed at right now, and,
 *  for a shape, the cells it may be aimed at and who each aim would catch. */
export function rulesetMenu(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** The open window's menu rather than this actor's turn: what they may spend out of turn. */
  inWindow = false,
): DirectedRulesetOption[] {
  const menu = inWindow
    ? rulesetWindowOptions(definition, encounter, actorId)
    : rulesetCombatOptions(definition, encounter, actorId);
  return menu.map((option) => {
    // A teleport is aimed as a shape is (1.276): at a cell it may go to, catching nobody.
    const aim = option.area
      ? rulesetAimCells(encounter, actorId, option.id, RULESET_AIM_LIMIT)
      : (option.teleport?.cells.map((cell) => ({ x: cell.x, y: cell.y, targetIds: [] as string[] })) ?? []);
    const actor = rulesetCombatant(encounter, actorId);
    const action = actor?.actions.find((one) => one.id === option.id);
    const fallers =
      inWindow && encounter.window?.trigger.kind === "falls" && option.targets.count > 1 && actor && action
        ? rulesetFallTargets(definition, encounter, actor, action)
        : undefined;
    return {
      ...option,
      targetIds: fallers ?? rulesetOptionTargets(definition, encounter, actorId, option),
      ...(aim.length > 0 ? { aim } : {}),
    };
  });
}

/** The fight as a screen reads it. A projection: no sheet build, no live blob and no catalogs. */
export function directedRulesetView(
  definition: RulesetDefinition,
  state: CombatDirectorState,
): DirectedRulesetView | undefined {
  const fight = fightOf(state);
  if (!fight || !definition.combat) return undefined;
  const encounter = fight.encounter;
  const actor = currentRulesetActor(encounter);
  const controller = rulesetController(state, fight, actor);
  const over = !!state.outcome || rulesetEncounterOutcome(encounter) !== "ongoing";
  const asking = encounter.window?.waiting[0];
  const held =
    encounter.window && asking
      ? {
          window: encounter.window,
          actorId: asking,
          controller: rulesetController(state, fight, rulesetCombatant(encounter, asking)),
        }
      : null;
  const distance = definition.combat.distance;
  const grid = encounter.board?.grid;
  const made = encounter.board?.battlefield?.kind === "hand-made" ? encounter.board.battlefield : null;
  // Light and fog drawn on the board: only cells that are not bright and clear.
  const shading = grid && distance ? rulesetBoardShading(definition, encounter) : null;
  const shaded = shading
    ? {
        ...(Object.keys(shading.light).length > 0
          ? { light: shading.light as Record<string, "sunlight" | "dim" | "dark"> }
          : {}),
        ...(Object.keys(shading.fog).length > 0 ? { fog: shading.fog } : {}),
      }
    : {};
  return {
    ruleset: { ...encounter.ruleset },
    round: encounter.round,
    order: [...encounter.order],
    ...(grid && distance
      ? {
          grid: {
            width: grid.width,
            height: grid.height,
            tiles: grid.tiles.map((row) => [...row]),
            ...(grid.elevation ? { elevation: grid.elevation.map((row) => [...row]) } : {}),
            ...(grid.walls ? { walls: { ...grid.walls } } : {}),
            // Growth and seasons on its cells (1.318); light and fog come with the shading.
            ...(grid.ground && Object.values(grid.ground).some((here) => here.growth || here.season)
              ? {
                  ground: Object.fromEntries(
                    Object.entries(grid.ground).flatMap(([at, here]) =>
                      here.growth || here.season
                        ? [
                            [
                              at,
                              {
                                ...(here.growth ? { growth: true as const } : {}),
                                ...(here.season ? { season: here.season } : {}),
                              },
                            ],
                          ]
                        : [],
                    ),
                  ),
                }
              : {}),
            distance: { ...distance },
            ...(made ? { scene: made.scene } : {}),
            // The board pack it is drawn with (1.333), and its environment's when it names none.
            ...(encounter.board?.pack ? { pack: encounter.board.pack } : {}),
            ...(encounter.board?.environment ? { environment: encounter.board.environment } : {}),
            ...shaded,
          },
        }
      : {}),
    ...(actor && !over ? { actorId: actor.id } : {}),
    controller,
    combatants: encounter.combatants.map((combatant) => projectCombatant(definition, combatant, encounter)),
    // The areas spells left standing (1.172), drawn on the board and listed beside it.
    ...(rulesetZonesShown(encounter).length > 0 ? { zones: rulesetZonesShown(encounter) } : {}),
    // What stands on the board that may be broken (1.316), broken ones too.
    ...(grid && distance && encounter.board?.props?.length
      ? {
          props: encounter.board.props.map((prop) => ({
            id: prop.id,
            label: prop.label,
            cells: prop.cells.map((cell) => ({ x: cell.x, y: cell.y })),
            health: prop.health,
            max: prop.max,
            ...(prop.art ? { art: prop.art } : {}),
          })),
        }
      : {}),
    // A window is answered by the one it asks, so while it is open the menu on screen is THEIRS.
    // The actor's own turn is standing still behind it and has nothing to offer until it closes.
    ...(held && !over
      ? {
          window: {
            id: held.window.id,
            kind: held.window.kind,
            actorId: held.actorId,
            waiting: Math.max(0, held.window.waiting.length - 1),
            ...(held.window.trigger.kind === "leaves-reach" ? { moverId: held.window.trigger.moverId } : {}),
            ...("sourceId" in held.window.trigger ? { sourceId: held.window.trigger.sourceId } : {}),
            ...("targetIds" in held.window.trigger ? { targetIds: held.window.trigger.targetIds } : {}),
            ...(rulesetWindowMoment(held.window.trigger) ? { moment: rulesetWindowMoment(held.window.trigger)! } : {}),
            ...("label" in held.window.trigger ? { label: held.window.trigger.label } : {}),
            ...(held.window.trigger.kind === "hit"
              ? { total: held.window.trigger.total, defense: held.window.trigger.defense }
              : {}),
            controller: held.controller,
            ...((cells) => (cells ? { cells } : {}))(
              grid ? heldAreaCells(definition, encounter, held.window) : undefined,
            ),
          },
          ...(held.controller === "manual" && !state.window
            ? { options: rulesetMenu(definition, encounter, held.actorId, true) }
            : {}),
        }
      : actor && !over && controller === "manual" && !state.window
        ? { options: rulesetMenu(definition, encounter, actor.id) }
        : {}),
    events: fight.events.map((entry) => ({ seq: entry.seq, event: entry.event })),
    ...(over ? { summary: rulesetEncounterSummary(definition, encounter) } : {}),
    adjustments: [...fight.adjustments],
  };
}

// ── Choosing, for everybody no human plays ──

interface RulesetCandidate {
  choice: RulesetCombatChoice;
  option: RulesetCombatOption;
  targetId?: string;
  /** Where the actor walks to before doing it, on a board. The move is its own step, resolved
   *  through the same menu a player's would be. */
  to?: { x: number; y: number };
}

/** How many cells a turn is weighed from. The board is small and a turn is short, so this is a
 *  ceiling on the enumeration rather than a rule anybody can feel.
 *  ponytail: the cheapest cells, cut at a fixed number. The upgrade path is to rank them by what
 *  they open up before cutting, which needs a scoring pass this slice does not have. */
const RULESET_MOVE_CANDIDATE_CELLS = 48;

/** The largest board on which a shape is also aimed from the cells an actor could walk to. The
 *  generator's own largest board is 14 by 10; this is a few times that. */
const RULESET_AREA_WALK_BOARD_CELLS = 400;

/** What one strike on the way is worth against doing the thing at all: enough that a creature will
 *  not walk through three people's reach for a marginally better target, and not so much that it
 *  will stand still rather than take one hit to reach the only enemy it can fight. */
const RULESET_PROVOKE_PENALTY = 0.25;

/**
 * Everything the actor could do, scored the way every other combat AI in the Engine is scored.
 * The menu is the only source of legality, so the picker can never choose something a player could
 * not, and the option's own forecast is the only thing it is allowed to know about the dice.
 */
function rulesetCandidates(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** The Game Master's window is shown everything; the Engine's own picker is not (see the end). */
  everything = false,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const worth = (candidate: CombatAiCandidate<RulesetCandidate>) => (candidate.damage ?? 0) + (candidate.healing ?? 0);
  const here = rulesetCandidatesFrom(definition, encounter, actorId, null);
  const moved = rulesetCandidatesAfterMoving(definition, encounter, actorId);
  // Standing still is preferred when it can already do its best from where it is: a candidate that
  // walks first has to be strictly better than every one that does not, not merely as good.
  const staying = here.reduce((most, candidate) => Math.max(most, worth(candidate)), 0);
  const candidates = [...here, ...moved.filter((candidate) => worth(candidate) > staying)];
  // Somebody who can hurt an opponent or help a friend does that. The scoring weighs a blow by the
  // share of the target's health it takes, so against a sturdy target a careful creature would score
  // a standard action (dodging, say) above every attack it has and stand there all fight. A standard
  // action or an empty turn is what is left when there is nothing better, never a rival. Judged over
  // the WHOLE list, walks included, so a creature that has to take a step first still takes it.
  if (everything || !candidates.some((candidate) => worth(candidate) > 0)) return candidates;
  return candidates.filter((candidate) => !candidate.hold && candidate.action.option.kind !== "standard");
}

/**
 * Everything the actor could do from the cells it can walk to, each candidate carrying the walk
 * that gets it there. The walk's own price is the strikes it would be met with on the way, taken
 * off the candidate's score, so a creature will not dance through three people's reach for a
 * slightly better target.
 */
/**
 * The cells the actor may walk to, exactly as its own menu offers them, nearest an opponent first.
 *
 * Read off the MENU, never worked out again here: the menu is where a creature that cannot move,
 * or that has to stand up before it walks, is told so, and a picker with its own idea of where it
 * can go would choose a walk the rules then refuse and lose its turn to the refusal.
 *
 * Nearest an opponent first, because that is where the cells worth scoring are: a creature that can
 * cover eight cells has hundreds to choose from, and the ones next to it are the ones it least wants.
 */
export function rulesetWalkableCells(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): NonNullable<RulesetCombatOption["cells"]> {
  const actor = rulesetCombatant(encounter, actorId);
  const walk = rulesetCombatOptions(definition, encounter, actorId).find((option) => option.id === RULESET_MOVE_OPTION);
  const cells = walk?.cells ?? [];
  if (!actor || cells.length === 0) return [];
  const foes = encounter.combatants.filter(
    (combatant) => combatant.side !== actor.side && rulesetCombatStanding(combatant) && rulesetPositionOf(combatant),
  );
  // Footprint to footprint (1.194).
  const span = rulesetSpanOf(actor);
  const away = (cell: { x: number; y: number }) =>
    foes.reduce((closest, foe) => Math.min(closest, rulesetGapFrom(cell, span, foe)), Infinity);
  // A stable sort over an already deterministic list, so the same fight always picks the same cell.
  return [...cells].sort((left, right) => away(left) - away(right) || left.cost - right.cost);
}

function rulesetCandidatesAfterMoving(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const actor = rulesetCombatant(encounter, actorId);
  if (!encounter.board?.grid || !actor || typeof actor.x !== "number" || typeof actor.y !== "number") return [];
  const cells = rulesetWalkableCells(definition, encounter, actorId).slice(0, RULESET_MOVE_CANDIDATE_CELLS);
  if (cells.length === 0) return [];
  const home = { x: actor.x, y: actor.y, movementLeft: actor.movementLeft };
  const candidates: Array<CombatAiCandidate<RulesetCandidate>> = [];
  for (const cell of cells) {
    // Standing the actor in the cell for exactly as long as the menu is read from it. Nothing else
    // is touched, and everything is put straight back, so the fight is the one it was. The
    // allowance is emptied for the pass because a candidate that walks here has spent it getting
    // here, and the picker never chains a second walk onto one.
    actor.x = cell.x;
    actor.y = cell.y;
    actor.movementLeft = 0;
    let from: Array<CombatAiCandidate<RulesetCandidate>> = [];
    try {
      from = rulesetCandidatesFrom(definition, encounter, actorId, cell);
    } finally {
      actor.x = home.x;
      actor.y = home.y;
      actor.movementLeft = home.movementLeft;
    }
    const penalty = cell.provokes.length * RULESET_PROVOKE_PENALTY;
    for (const candidate of from) {
      if (candidate.damage !== undefined) candidate.damage = Math.max(0, candidate.damage - penalty);
      if (candidate.healing !== undefined) candidate.healing = Math.max(0, candidate.healing - penalty);
      candidates.push(candidate);
    }
  }
  return candidates;
}

/** What a window's answer of "nothing" is called when the Game Master is the one answering. Plain
 *  text like the resolver's own "Move" and "Stand up": it is written for the model that reads the
 *  menu, and the client draws its own words over the same choice. */
const RULESET_PASS_LABEL = "Let the moment go by";

/** The pool an answer is paid from and the initiative style it is made in, each left out entirely
 *  when it is the option's own. */
const paying = (way: { payWith?: string; style?: string; mode?: string; option?: RulesetCombatOption }) => ({
  ...(way.payWith === undefined ? {} : { payWith: way.payWith }),
  ...(way.style === undefined ? {} : { style: way.style }),
  ...(way.mode === undefined ? {} : { mode: way.mode }),
  // One castable now only with an alteration (1.253) is cast with it: Quickened once the action is spent.
  ...(way.option?.alterNeeded ? { alters: [way.option.alterNeeded] } : {}),
});

/** One way of doing something off the menu: the option, the pool it is paid from and the style it
 *  is made in when those are not the option's own, and what that way costs. A style that takes also
 *  says what it is expected to take off a target and what its maker gains on top. */
interface PricedOption {
  option: RulesetCombatOption;
  payWith?: string;
  style?: string;
  mode?: string;
  takes?: { shift: number; gain: number };
  price: number;
}

/**
 * Every option on a menu, and every BIGGER way of paying for one, each with what that costs.
 *
 * A player is offered the pools an ability could be paid from and picks one. A party member the
 * Engine plays was not: the picker only ever saw the base cost, so a character handed to the Engine
 * never cast a spell that grows any bigger, on a turn or in a window. Each way of paying is its own
 * candidate now, so casting it bigger is weighed against casting it at all.
 *
 * Only somebody with a SHEET has pools to pay out of. A plain stat block's actions cost nothing off
 * any pool (see `planRulesetCombatCost`), so an opponent without a sheet, a Game Master's invented
 * one included, has no bigger way of paying to be offered. A bestiary creature that carries a sheet
 * does, and is offered them exactly as a party member is, whoever is deciding for it.
 *
 * The price counts the steps as well as the amount, because one pool of a higher rung is worth more
 * than one of a lower: without that the bigger version reads as free and nothing would ever cast
 * the small one.
 */
export function priced(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  menu?: RulesetCombatOption[],
): PricedOption[] {
  const out: PricedOption[] = [];
  for (const option of menu ?? rulesetCombatOptions(definition, encounter, actor.id)) {
    const base = (option.cost ?? []).reduce((total, entry) => total + entry.amount, 0) + (option.signature?.cost ?? 0);
    // One that only a higher pool can pay for now (1.171) is never taken at its own price.
    const ways: PricedOption[] = [
      ...(option.upcastOnly ? [] : [{ option, price: base }]),
      ...biggerWays(definition, actor, option),
    ];
    // Modes first, so each mode is then made in every style, forecast as that style does.
    out.push(...ways.flatMap(modedWays).flatMap((way) => styledWays(definition, way)));
  }
  return out;
}

/** The bigger ways of paying for one option: once per pool it could be paid from, each with its
 *  own label, cost and forecast. None for something that grows no bigger. */
function biggerWays(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
): PricedOption[] {
  const action = actor.actions.find((entry) => entry.id === option.id);
  // What grows paid bigger, or what can only be paid out of another pool now (1.171).
  const grows = !!action?.use?.perCostStep || !!action?.use?.targetsPerStep;
  if (!action || (!grows && !option.upcastOnly)) return [];
  const ways: PricedOption[] = [];
  for (const pool of option.payWith ?? []) {
    const steps = rulesetCostSteps(definition, action, pool, actor);
    if (steps < 1 && !option.upcastOnly) continue;
    const paid = planRulesetCombatCost(definition, actor, action, pool);
    if (!paid) continue;
    const extra = action.use?.perCostStep ? steps * rulesetAverageAmount(action.use.perCostStep) : 0;
    const forecast = option.forecast ? { ...option.forecast } : undefined;
    if (forecast?.averageDamage !== undefined) {
      forecast.averageDamage = Math.round((forecast.averageDamage + extra) * 100) / 100;
    }
    ways.push({
      option: {
        ...option,
        // Named for the pool it spends, so a Game Master reading the menu can tell the two apart.
        label: `${option.label} (${paid.cost[0]?.label ?? pool})`,
        cost: paid.cost.map((entry) => ({ pool: entry.pool, label: entry.label, amount: entry.amount })),
        ...(forecast ? { forecast } : {}),
        // As many targets as this pool lets it take (1.171).
        ...(option.targetsWith?.[pool] !== undefined
          ? { targets: { ...option.targets, count: option.targetsWith[pool]! } }
          : {}),
      },
      payWith: pool,
      price: paid.cost.reduce((total, entry) => total + entry.amount, 0) + steps,
    });
  }
  return ways;
}

/**
 * Every way of paying, once per initiative style the attack may be made in, where initiative is a
 * number attacks move. A style that spends forecasts the harm its maker's number would do; one that
 * takes forecasts no harm at all and carries what it would take instead, which the picker weighs as
 * what those dice would be worth to spend later.
 */
function styledWays(definition: RulesetDefinition, way: PricedOption): PricedOption[] {
  const styles = way.option.styles;
  const resource = definition.combat?.initiative.resource;
  if (!styles?.length || !resource) return [way];
  const option = { ...way.option };
  delete option.styles;
  return styles.map((style) => {
    const takes = resource.styles.find((entry) => entry.id === style.id)?.takes;
    const hitChance = way.option.forecast?.hitChance ?? style.forecast?.hitChance;
    const averageDamage = takes ? 0 : (style.forecast?.averageDamage ?? 0);
    return {
      ...way,
      option: {
        ...option,
        // Named for its style as well, so a Game Master reading the menu can tell them apart.
        label: `${option.label}, ${style.label}`,
        forecast: { ...(hitChance !== undefined ? { hitChance } : {}), averageDamage },
      },
      style: style.id,
      ...(takes ? { takes: { shift: way.option.forecast?.averageDamage ?? 0, gain: takes.gain } } : {}),
    };
  });
}

/**
 * Every way of paying, once more for each mode the weapon may be used in now, named for it and
 * forecast as it would do. Only a mode aimed at one target: the picker aims every candidate at one,
 * and a mode for several would pay for shots it never takes.
 * ponytail: a party member the Engine plays never looses a volley at several; weighing a candidate
 * per group of targets is the upgrade.
 */
function modedWays(way: PricedOption): PricedOption[] {
  const modes = way.option.modes;
  if (!modes?.length) return [way];
  const option = { ...way.option };
  delete option.modes;
  return [
    { ...way, option },
    ...modes
      .filter((mode) => mode.targets <= 1)
      .map((mode) => ({
        ...way,
        option: {
          ...option,
          // Named for its mode as well, so a Game Master reading the menu can tell them apart.
          label: `${option.label} (${mode.label})`,
          ...(mode.forecast ? { forecast: { ...mode.forecast } } : {}),
        },
        mode: mode.id,
      })),
  ];
}

/** Whom a window option really lands on when the option itself asks for nobody: the one walking
 *  away from a reach, or whoever caused a moment, for a reaction pointed back at them. Undefined for
 *  something its holder does to themselves, which is weighed as what it is. */
export function rulesetWindowTargetOf(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
): string | undefined {
  const trigger = encounter.window?.trigger;
  if (!trigger || option.targets.count > 0 || option.id === RULESET_PASS_OPTION) return undefined;
  if (trigger.kind === "leaves-reach") return trigger.moverId;
  if (trigger.kind === "falls") return trigger.sourceId;
  if (
    trigger.kind !== "aimed" &&
    trigger.kind !== "hit" &&
    trigger.kind !== "harmed" &&
    trigger.kind !== "used" &&
    trigger.kind !== "turn-start"
  ) {
    return undefined;
  }
  const action = actor.actions.find((entry) => entry.id === option.id);
  if (action?.reaction?.at === "target")
    return rulesetReactionTarget(encounter, actor, action, trigger.kind, trigger.sourceId, {
      ...("targetIds" in trigger ? { targetIds: trigger.targetIds } : {}),
      ...("optionId" in trigger &&
      rulesetCombatant(encounter, trigger.sourceId)?.block &&
      !("catalog" in trigger && trigger.catalog)
        ? { action: trigger.label }
        : {}),
      ...("catalog" in trigger ? { catalog: trigger.catalog } : {}),
      ...("entry" in trigger ? { entry: trigger.entry } : {}),
      ...(trigger.kind === "hit" ? { blow: trigger.blow } : {}),
    });
  return action && rulesetReactionPointsAtSource(action) ? trigger.sourceId : undefined;
}

function rulesetCandidatesFrom(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** The cell the actor is standing in for this pass, or null for the one they are really in. */
  standing: { x: number; y: number } | null,
  /** The menu to score. A turn's by default; a window hands in its own, so what an opponent takes
   *  out of turn is weighed by exactly the same scoring as what it takes on one. */
  menu?: RulesetCombatOption[],
): Array<CombatAiCandidate<RulesetCandidate>> {
  const combat = definition.combat;
  const actor = rulesetCombatant(encounter, actorId);
  if (!combat || !actor) return [];
  const candidates: Array<CombatAiCandidate<RulesetCandidate>> = [];
  // A window's menu may always be declined. Without this the picker would spend a reaction every
  // time one was on offer, and availability alone should never force a spend: letting the moment go
  // by is weighed exactly as ending a turn is.
  if (menu) {
    const letGo: RulesetCombatOption = {
      id: RULESET_PASS_OPTION,
      kind: "end-turn",
      label: RULESET_PASS_LABEL,
      targets: { side: "self", count: 0 },
    };
    candidates.push({ action: { choice: { actorId, optionId: letGo.id, targetIds: [] }, option: letGo }, hold: true });
  }
  for (const way of priced(definition, encounter, actor, menu)) {
    const { option, price } = way;
    // Turning a line or cone the actor carries (1.182) is weighed the same way, before any walk.
    if (option.id.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX)) {
      const turned = standing ? null : zoneTurnCandidate(encounter, actor, option, price);
      if (turned) candidates.push(turned);
      continue;
    }
    // Moving a lasting area (1.173) is weighed from where the actor stands, by whom it would catch.
    if (option.id.startsWith(RULESET_ZONE_OPTION_PREFIX)) {
      const moved = standing ? null : zoneMoveCandidate(encounter, actor, option, price);
      if (moved) candidates.push(moved);
      continue;
    }
    // A teleport (1.276) is weighed from where the actor stands, by where it would take them.
    if (option.teleport) {
      const gone = standing ? null : teleportCandidate(definition, combat, encounter, actor, option, way, price);
      if (gone) candidates.push(gone);
      continue;
    }
    // A legendary move (1.283) the same way, by where it would take them.
    if (option.signature && option.cells && !option.moveAfter) {
      const moved = standing ? null : legendaryMoveCandidate(definition, combat, encounter, actor, option, price);
      if (moved) candidates.push(moved);
      continue;
    }
    // Walking is not a candidate of its own: it is what a candidate does before it acts, and a turn
    // with nothing to act on closes the distance instead (see `rulesetClosingMove`).
    if (option.kind === "move") continue;
    // Averting the eyes is settled as the turn starts (see `playRulesetTurn`).
    if (option.avert) continue;
    // Putting away a weapon put in hand (1.308) is its player's own call: the Engine keeps it.
    if (option.dismiss) continue;
    // From another cell, only what the actor would do THERE is worth enumerating: everything it
    // could do without moving is already on the list.
    if (standing && option.targets.count <= 0 && !option.area) continue;
    if (option.kind === "end-turn") {
      candidates.push({ action: { choice: { actorId, optionId: option.id, targetIds: [] }, option }, hold: true });
      continue;
    }
    // A weapon put in hand (1.306), once, before it fights: the one that hits hardest of those it
    // may make or bind. With one in hand already it is never taken again.
    const conjuring = actor.actions.find((entry) => entry.id === option.id);
    if (conjuring?.conjures) {
      if (standing || actor.conjured?.[option.id]) continue;
      const average = (mode: string) =>
        Math.max(
          0,
          ...(actor.conjurable?.[`${option.id}|${mode}`]?.actions ?? []).map((one) =>
            one.damage ? (one.damage.count * (one.damage.sides + 1)) / 2 + one.damage.flat : 0,
          ),
        );
      // The action's own modes: each way weighed here is one of them, with the others taken off.
      const best = [...(conjuring.modes ?? [])].sort((a, b) => average(b.id) - average(a.id))[0];
      // Each mode is a way of its own: only the best is weighed.
      if (!best || average(best.id) <= 0 || way.mode !== best.id) continue;
      candidates.push({
        action: { choice: { actorId, optionId: option.id, targetIds: [], ...paying(way) }, option },
        setup: 0.6,
        cost: price,
      });
      continue;
    }
    // A guard taken after being hit is worth the blow it turns aside, and nothing at all when the
    // roll beats it anyway: spending it then would only waste it. Read before any other weighing,
    // since a guard aimed at its own holder would otherwise be scored as help for a friend.
    const deflects = menu ? rulesetAnswerDeflects(definition, encounter, actor, option.id) : null;
    if (deflects === false) continue;
    if (deflects) {
      candidates.push({
        action: { choice: { actorId, optionId: option.id, targetIds: [], ...paying(way) }, option },
        healing: 1,
        cost: price,
      });
      continue;
    }
    // A contest is weighed by what winning it would do, times the chance of winning against THAT
    // target, and kept modest: a grab or a shove sets something up, and an opponent that wrestled
    // instead of fighting would be played badly. Breaking free is worth most, and only while held.
    if (option.kind === "contest") {
      const contest = actor.actions.find((entry) => entry.id === option.id)?.contest;
      if (!contest) continue;
      for (const targetId of rulesetOptionTargets(definition, encounter, actorId, option)) {
        const target = rulesetCombatant(encounter, targetId);
        if (!target) continue;
        // Treating somebody (1.193): steadying a friend who is dying, or ending what holds a friend.
        const ally = target.side === actor.side;
        const steadies = ally && !!contest.stabilizes && target.dying && !target.stable && !target.defeated;
        if (target.down && !steadies) continue;
        const chance = rulesetContestChance(definition, combat, actor, target, contest, encounter) ?? 0.5;
        const held = new Set(rulesetCombatConditions(definition, actor));
        const theirs = new Set(rulesetCombatConditions(definition, target));
        const frees = (contest.ends ?? []).some((entry) => entry.on === "actor" && held.has(entry.condition));
        const treats =
          ally && (contest.ends ?? []).some((entry) => entry.on === "target" && theirs.has(entry.condition));
        const holds = !ally && (contest.applies ?? []).some((entry) => !theirs.has(entry.condition));
        const shoves = !ally && contest.push !== undefined && !!encounter.board;
        const worth = frees ? 1 : holds ? 0.3 : shoves ? 0.15 : 0;
        // A treatment is weighed as the heal it stands in for.
        const care = steadies ? 1 : treats ? 0.5 : 0;
        if (worth <= 0 && care <= 0) continue;
        candidates.push({
          action: {
            choice: { actorId, optionId: option.id, targetIds: [targetId], ...paying(way) },
            option,
            targetId,
          },
          targetId,
          ...(care > 0 ? { healing: care * chance } : { setup: worth * chance }),
          cost: price,
        });
      }
      continue;
    }
    // In a window, an option that asks for nobody may still land on somebody: whoever is walking
    // away, or whoever caused the moment. It is weighed by what it would do to THEM, and its answer
    // still names nobody, because the rules fill that target in.
    const fallingAction = actor.actions.find((entry) => entry.id === option.id);
    if (menu && encounter.window?.trigger.kind === "falls" && option.targets.count > 1 && fallingAction) {
      const targetIds = rulesetFallTargets(definition, encounter, actor, fallingAction).slice(0, option.targets.count);
      candidates.push({
        action: { choice: { actorId, optionId: option.id, targetIds, ...paying(way) }, option },
        setup: targetIds.length,
        cost: price,
      });
      continue;
    }
    // A burst centred on the actor (1.282) is worth whom it catches from where it stands: the other
    // side for it, its own against it, or the other way round for one that mends.
    const aroundAction = fallingAction?.around ? fallingAction : undefined;
    if (aroundAction) {
      if (standing) continue;
      const caught = rulesetAroundTargets(encounter, actor, aroundAction);
      // Harm that catches nobody of the other side is not worth its price, whoever it does catch.
      if (!aroundAction.heal && !caught.some((one) => one.side !== actor.side && !one.down)) continue;
      const candidate: CombatAiCandidate<RulesetCandidate> = {
        action: { choice: { actorId, optionId: option.id, targetIds: [], ...paying(way) }, option },
        cost: price,
      };
      if (weighCaught(definition, combat, actor, option, caught, candidate)) candidates.push(candidate);
      continue;
    }
    const lands = menu ? rulesetWindowTargetOf(encounter, actor, option) : undefined;
    if (option.targets.count <= 0 && !lands) {
      // Holding the thing it is already holding would end it and start it again for the same price.
      if (actor.concentrating?.actionId === option.id) continue;
      candidates.push({
        action: { choice: { actorId, optionId: option.id, targetIds: [], ...paying(way) }, option },
        setup: option.kind === "standard" ? 0.05 : 0.4,
        cost: price,
      });
      continue;
    }
    // A shape lands on a cell, so the aims are the candidates: each one is worth what it catches,
    // and the actor's own side counts against it.
    if (option.area) {
      // Aiming a shape is the one thing here whose cost grows with the BOARD, and it is asked again
      // from every cell the actor might walk to. On the boards this Engine draws that is nothing; on
      // a far larger one that arrived through an import, a shape is only aimed from where the actor
      // really stands, which costs a creature a cleverer walk and never costs the server a turn.
      const grid = encounter.board?.grid;
      if (standing && grid && grid.width * grid.height > RULESET_AREA_WALK_BOARD_CELLS) continue;
      candidates.push(...areaCandidates(definition, combat, encounter, actor, option, standing, way, price));
      continue;
    }
    const legal = lands ? [lands] : rulesetOptionTargets(definition, encounter, actorId, option);
    // An action made of other actions sends all of them at one opponent. Anything else that may
    // take several targets takes as many as it is allowed: a breath that could catch three people
    // and is pointed at one is an opponent played badly, not an opponent played kindly.
    const spreads = option.targets.count > 1 && !actor.actions.find((entry) => entry.id === option.id)?.sequence;
    for (const targetId of legal) {
      const target = rulesetCombatant(encounter, targetId);
      if (!target) continue;
      // Whose side the TARGET is on, not whose side the option was written for: an author may let a
      // blast reach either side, and a fight where the Engine drops one on its own party is worse
      // than one where it never does.
      const ally = target.side === actor.side;
      const health = rulesetCombatHealth(definition, combat, target);
      const pool = Math.max(1, health.value + health.temp);
      const chance = option.forecast?.hitChance ?? 1;
      const average = option.forecast?.averageDamage ?? 0;
      const candidate: CombatAiCandidate<RulesetCandidate> = {
        action: {
          choice: { actorId, optionId: option.id, targetIds: lands ? [] : [targetId], ...paying(way) },
          option,
          targetId,
        },
        targetId,
        cost: price,
      };
      if (way.takes) {
        // A blow that takes is weighed a turn ahead, against spending now and spending again from
        // the base: taking and then spending throws the number plus what was taken and gained,
        // which beats that only when the taking is worth more than the base. A crash it would cause
        // adds its bonus. Never on its own side or on somebody already down, and worth a little as
        // a setup either way, since a crashed maker has nothing else to attack with.
        if (ally || target.down) continue;
        const resource = combat.initiative.resource;
        const crash = resource?.crash;
        const crashes = !!crash && target.initiative > crash.at && target.initiative - way.takes.shift <= crash.at;
        const gained = chance * (way.takes.shift + way.takes.gain + (crashes ? crash.bonus : 0));
        const ahead = Math.max(0, actor.initiative + gained - (resource?.base ?? 0));
        candidate.damage = Math.min(2, (rulesetDamageAverage(definition, combat, ahead) / pool) * chance);
        candidate.setup = Math.min(1, gained / 6);
        candidates.push(candidate);
        continue;
      }
      if (option.heals) {
        // Never on the other side, and never on somebody with nothing to gain by it.
        if (!ally || (health.value >= health.max && !target.down)) continue;
        candidate.healing = Math.min(1, average / Math.max(1, health.max)) + (target.down ? 1 : 0);
      } else if (average > 0) {
        // Never its own side, and never somebody who is already down: the rules let a blow land on
        // them, and a table where every opponent finishes off the dying is not one anybody plays
        // at. A human may still choose it; nothing the Engine enumerates for itself or for a Game
        // Master's boss includes it.
        if (ally || target.down) continue;
        const others = spreads
          ? legal
              .filter((id) => id !== targetId)
              .map((id) => rulesetCombatant(encounter, id))
              .filter((other): other is RulesetCombatant => !!other && other.side !== actor.side && !other.down)
              .slice(0, option.targets.count - 1)
          : [];
        // What is left of one that may be pointed at the same one again (1.305) goes at this one:
        // eldritch blast's every beam.
        const again = option.targets.repeat ? Math.max(0, option.targets.count - 1 - others.length) : 0;
        if (!lands)
          candidate.action.choice.targetIds = [
            targetId,
            ...others.map((other) => other.id),
            ...Array.from({ length: again }, () => targetId),
          ];
        candidate.damage = Math.min(2, (average / pool) * (1 + others.length + again)) * chance;
        if (average >= pool) candidate.finish = chance;
      } else if (ally) {
        // Giving back a pool that is already full, or one somebody without a sheet does not have,
        // gives nothing.
        if (option.restores && !rulesetPoolHasRoom(definition, target, option.restores)) continue;
        candidate.support = 0.4;
      } else candidate.setup = 0.4;
      candidates.push(candidate);
    }
  }
  // A legendary action that moves after what it does (1.285): on to where a teleport would go, or
  // nowhere when nowhere is worth it.
  for (const candidate of standing ? [] : candidates) {
    const { option, choice } = candidate.action;
    if (!option.moveAfter || !option.cells?.length || choice.to) continue;
    const picked = repositionCell(definition, combat, encounter, actor, option.cells);
    if (picked) choice.to = { x: picked.best.x, y: picked.best.y };
  }
  if (standing) for (const candidate of candidates) candidate.action.to = { ...standing };
  return candidates;
}

/** Whether a pool of this fighter's sheet has room for more. */
function rulesetPoolHasRoom(definition: RulesetDefinition, fighter: RulesetCombatant, pool: string): boolean {
  if (!fighter.sheet) return false;
  const now = readRulesetLive(definition, fighter.sheet.build, fighter.sheet.live).pools.find(
    (entry) => entry.key === pool,
  );
  return !!now && now.value < now.max;
}

/**
 * One candidate per cell a shape may be aimed at, worth what it would catch.
 *
 * Its own side counts AGAINST it, so a creature does not drop a blast on its friends to reach one
 * more enemy, and an aim that would catch nobody but friends is left off the list entirely.
 */
function areaCandidates(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  standing: { x: number; y: number } | null,
  /** The pool this way of paying spends and the style it is made in, and what that way costs. */
  way: { payWith?: string; style?: string; mode?: string },
  price: number,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const candidates: Array<CombatAiCandidate<RulesetCandidate>> = [];
  // The same bound the view keeps, and the aims that catch the most people first, so what is left
  // out on a very large board is what mattered least. The sort is stable, so equal aims keep the
  // board's own order and the picker stays deterministic.
  // The scan itself is bounded too, at a few times what is kept: on the boards this Engine draws
  // that is every aim there is, and on a very large imported one it is enough to rank from without
  // the ranking becoming the cost.
  const aims = [...rulesetAimCells(encounter, actor.id, option.id, RULESET_AIM_LIMIT * 4)]
    .sort((left, right) => right.targetIds.length - left.targetIds.length)
    .slice(0, RULESET_AIM_LIMIT);
  for (const aim of aims) {
    const caught = aim.targetIds
      .map((id) => rulesetCombatant(encounter, id))
      .filter((target): target is RulesetCombatant => !!target);
    const foes = caught.filter((target) => target.side !== actor.side && !target.down);
    const candidate: CombatAiCandidate<RulesetCandidate> = {
      action: {
        choice: {
          actorId: actor.id,
          optionId: option.id,
          targetIds: [],
          at: { x: aim.x, y: aim.y },
          ...paying(way),
        },
        option,
        ...(foes[0] ? { targetId: foes[0].id } : {}),
        ...(standing ? { to: { ...standing } } : {}),
      },
      ...(foes[0] ? { targetId: foes[0].id } : {}),
      cost: price,
    };
    if (!weighCaught(definition, combat, actor, option, caught, candidate)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

/** What a shape is worth by whom it catches (an aimed one, or one centred on its maker, 1.282): the
 *  harm to the other side less the harm to its own, healing for its own, or a setup or a support.
 *  False when it is worth nothing. */
function weighCaught(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  caught: RulesetCombatant[],
  candidate: CombatAiCandidate<RulesetCandidate>,
): boolean {
  const average = option.forecast?.averageDamage ?? 0;
  const chance = option.forecast?.hitChance ?? 1;
  const foes = caught.filter((target) => target.side !== actor.side && !target.down);
  const friends = caught.filter((target) => target.side === actor.side);
  if (option.heals) {
    const helped = friends.filter((target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return target.down || health.value < health.max;
    });
    if (helped.length === 0) return false;
    candidate.healing = helped.reduce((total, target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return total + Math.min(1, average / Math.max(1, health.max)) + (target.down ? 1 : 0);
    }, 0);
  } else if (average > 0) {
    if (foes.length === 0) return false;
    const share = foes.reduce((total, target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return total + average / Math.max(1, health.value + health.temp);
    }, 0);
    const hurt = friends.reduce((total, target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return total + average / Math.max(1, health.value + health.temp);
    }, 0);
    candidate.damage = Math.max(0, Math.min(2, share - hurt)) * chance;
    if (candidate.damage <= 0) return false;
  } else if (foes.length > 0) candidate.setup = 0.4;
  else {
    if (option.restores && !friends.some((friend) => rulesetPoolHasRoom(definition, friend, option.restores!))) {
      return false;
    }
    candidate.support = 0.4;
  }
  return true;
}

/**
 * Where to move a lasting area its actor holds (1.173): the cell that would catch the most standing
 * opponents less friends, and only when that beats where it stands now. Ties keep the menu's own
 * order, so the picker stays deterministic.
 */
function zoneMoveCandidate(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  price: number,
): CombatAiCandidate<RulesetCandidate> | null {
  const actionId = option.id.slice(RULESET_ZONE_OPTION_PREFIX.length);
  const zone = actor.zones?.find((entry) => entry.actionId === actionId);
  const action = actor.actions.find((entry) => entry.id === actionId);
  const grid = encounter.board?.grid;
  if (!zone?.at || !action?.area || !grid) return null;
  const worth = (at: { x: number; y: number }) => {
    const cells = new Set(rulesetAreaCells("burst", action.area!.size, at, at, grid).map((c) => `${c.x},${c.y}`));
    let total = 0;
    for (const one of encounter.combatants) {
      if (typeof one.x !== "number" || typeof one.y !== "number" || one.down) continue;
      // Caught by any cell they fill (1.194).
      const inside = rulesetFootprint(one).some((cell) => cells.has(`${cell.x},${cell.y}`));
      if (!inside || !rulesetZoneCatches(actor, zone, action, one)) continue;
      total += one.side === actor.side ? -1 : 1;
    }
    return total;
  };
  const now = worth(zone.at);
  let best: { cell: { x: number; y: number }; gain: number } | null = null;
  for (const cell of option.cells ?? []) {
    const gain = worth(cell) - now;
    if (gain > 0 && (!best || gain > best.gain)) best = { cell, gain };
  }
  if (!best) return null;
  return {
    action: {
      choice: { actorId: actor.id, optionId: option.id, targetIds: [], to: { x: best.cell.x, y: best.cell.y } },
      option,
    },
    setup: Math.min(1, 0.4 * best.gain),
    cost: price,
  };
}

/**
 * Where an opponent teleports to (1.276), if anywhere: away from the enemies beside it when it is
 * hurt badly enough (half its health or less), as far from the nearest of them as it can get, or,
 * when it fights in reach and has nobody in reach, next to the nearest enemy. Otherwise nowhere:
 * spending it to stand somewhere else for nothing is an opponent played badly.
 */
function teleportCandidate(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  way: { payWith?: string; style?: string; mode?: string },
  price: number,
): CombatAiCandidate<RulesetCandidate> | null {
  const cells = option.teleport?.cells ?? [];
  // Out of the fight (1.279), when it is going badly: at a quarter of its health or less, with
  // whoever may go along.
  if (option.teleport?.leaves) {
    const health = rulesetCombatHealth(definition, combat, actor);
    const threatened = encounter.combatants.some(
      (one) => one.side !== actor.side && rulesetCombatStanding(one) && !one.away,
    );
    if (threatened && health.max > 0 && health.value * 4 <= health.max) {
      const carries = option.teleport.carries
        ? option.teleport.carries.ids.slice(0, option.teleport.carries.count)
        : [];
      return {
        action: {
          choice: {
            actorId: actor.id,
            optionId: option.id,
            targetIds: [],
            ...(carries.length ? { carries } : {}),
            ...paying(way),
          },
          option,
        },
        setup: 0.7,
        cost: price,
      };
    }
  }
  const picked = repositionCell(definition, combat, encounter, actor, cells);
  if (!picked) return null;
  const { best, worth } = picked;
  return {
    action: {
      choice: { actorId: actor.id, optionId: option.id, targetIds: [], at: { x: best.x, y: best.y }, ...paying(way) },
      option,
    },
    setup: worth,
    cost: price,
  };
}

/** A legendary move (1.283), weighed as a teleport is: away when hurt and beside an enemy, or into
 *  reach of one when none is. */
function legendaryMoveCandidate(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  price: number,
): CombatAiCandidate<RulesetCandidate> | null {
  const picked = repositionCell(definition, combat, encounter, actor, option.cells ?? []);
  if (!picked) return null;
  return {
    action: {
      choice: { actorId: actor.id, optionId: option.id, targetIds: [], to: { x: picked.best.x, y: picked.best.y } },
      option,
    },
    setup: picked.worth,
    cost: price,
  };
}

/** Where to go among `cells`, and what it is worth: the cell farthest from every enemy when hurt and
 *  beside one, so long as it gets clear; else the nearest one that puts an enemy in reach when none
 *  is. Null when neither is worth it. */
function repositionCell(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cells: ReadonlyArray<{ x: number; y: number }>,
): { best: { x: number; y: number }; worth: number } | null {
  const span = rulesetSpanOf(actor);
  const foes = encounter.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && !one.away && !!rulesetPositionOf(one),
  );
  if (cells.length === 0 || foes.length === 0 || !rulesetPositionOf(actor)) return null;
  const nearest = (at: { x: number; y: number }) => Math.min(...foes.map((foe) => rulesetGapFrom(at, span, foe)));
  const here = rulesetPositionOf(actor)!;
  const health = rulesetCombatHealth(definition, combat, actor);
  const reaches = actor.actions
    .filter((action) => action.kind !== "reload" && action.damage && action.reach !== undefined && !action.range)
    .map((action) => action.reach!);
  let best: { x: number; y: number } | null = null;
  let worth = 0;
  if (nearest(here) <= 1 && health.max > 0 && health.value * 2 <= health.max) {
    // Fleeing: the cell farthest from every enemy, and only if it gets clear of them.
    for (const cell of cells) if (!best || nearest(cell) > nearest(best)) best = cell;
    if (best && nearest(best) > 1) worth = 0.6;
  } else if (reaches.length > 0 && nearest(here) > Math.max(...reaches)) {
    // Closing: the cell nearest an enemy that puts one in reach.
    const reach = Math.max(...reaches);
    for (const cell of cells) {
      if (nearest(cell) > reach) continue;
      if (!best || nearest(cell) < nearest(best)) best = cell;
    }
    if (best) worth = 0.5;
  }
  if (!best || worth <= 0) return null;
  return { best, worth };
}

/**
 * Which way to turn a line or cone its actor carries (1.182): the facing that would catch the most
 * standing opponents less friends, and only when that beats the way it faces now.
 */
function zoneTurnCandidate(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  price: number,
): CombatAiCandidate<RulesetCandidate> | null {
  const actionId = option.id.slice(RULESET_ZONE_TURN_OPTION_PREFIX.length);
  const zone = actor.zones?.find((entry) => entry.actionId === actionId);
  const action = actor.actions.find((entry) => entry.id === actionId);
  if (!zone?.facing || !action || typeof actor.x !== "number" || typeof actor.y !== "number") return null;
  const worth = (facing: { dx: number; dy: number }) => {
    const cells = new Set(rulesetZoneCells(encounter, actor, { ...zone, facing }).map((cell) => `${cell.x},${cell.y}`));
    let total = 0;
    for (const one of encounter.combatants) {
      if (typeof one.x !== "number" || typeof one.y !== "number" || one.down) continue;
      // Caught by any cell they fill (1.194).
      const inside = rulesetFootprint(one).some((cell) => cells.has(`${cell.x},${cell.y}`));
      if (!inside || !rulesetZoneCatches(actor, zone, action, one)) continue;
      total += one.side === actor.side ? -1 : 1;
    }
    return total;
  };
  const now = worth(zone.facing);
  let best: { cell: { x: number; y: number }; gain: number } | null = null;
  for (const cell of option.cells ?? []) {
    const gain = worth({ dx: cell.x - actor.x, dy: cell.y - actor.y }) - now;
    if (gain > 0 && (!best || gain > best.gain)) best = { cell, gain };
  }
  if (!best) return null;
  return {
    action: {
      choice: { actorId: actor.id, optionId: option.id, targetIds: [], to: { x: best.cell.x, y: best.cell.y } },
      option,
    },
    setup: Math.min(1, 0.4 * best.gain),
    cost: price,
  };
}

/**
 * The walk a turn with nothing in reach takes: the reachable cell that ends up nearest an opponent,
 * cheapest first, and never one that would be struck at on the way when a quieter cell gets as
 * close. Nearest is measured by the walk still left to get there, not in a straight line: a wall
 * between two fighters makes every straight-line-closer cell solid, and both would stand and look
 * at each other for the rest of the fight. Null when nothing is worth walking to, which is what
 * keeps a cornered creature from shuffling on the spot for the rest of the fight.
 */
export function rulesetClosingMove(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): RulesetCandidate | null {
  const actor = rulesetCombatant(encounter, actorId);
  const from = rulesetPositionOf(actor);
  if (!actor || !from || !encounter.board?.grid) return null;
  // Driven away from, or toward, whoever put a condition on (1.264): as far off, or as near, as the
  // walk goes. The cells offered already only go that way.
  const driven = rulesetDrivenFrom(definition, encounter, actor);
  if (driven) {
    let best: { cell: { x: number; y: number }; gap: number } | null = null;
    for (const cell of rulesetWalkableCells(definition, encounter, actorId)) {
      const gap = rulesetGapFrom(cell, rulesetSpanOf(actor), driven.source);
      if (!best || (driven.moves === "away" ? gap > best.gap : gap < best.gap)) best = { cell, gap };
    }
    if (!best) return null;
    return {
      choice: { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: best.cell.x, y: best.cell.y } },
      option: { id: RULESET_MOVE_OPTION, kind: "move", label: "Move", targets: { side: "self", count: 0 } },
      to: { x: best.cell.x, y: best.cell.y },
    };
  }
  const foes = encounter.combatants
    .filter((combatant) => combatant.side !== actor.side && rulesetCombatStanding(combatant))
    // Every cell an opponent fills (1.194).
    .flatMap((combatant) => rulesetFootprint(combatant));
  if (foes.length === 0) return null;
  const walking = rulesetWalkingDistances(encounter.board.grid, foes, actor);
  // Somebody bigger than one cell is as near as the nearest cell they would fill (1.194).
  const span = rulesetSpanOf(actor);
  const nearest = (cell: { x: number; y: number }) =>
    Math.min(...rulesetFootprintAt(cell, span).map((one) => walking.get(`${one.x},${one.y}`) ?? Infinity));
  const already = nearest(from);
  let best: { cell: { x: number; y: number; cost: number; provokes: string[] }; away: number } | null = null;
  // Every cell it may walk to, not a sample of them: closing the distance is one comparison a cell.
  for (const cell of rulesetWalkableCells(definition, encounter, actorId)) {
    const away = nearest(cell);
    if (away >= already) continue;
    const better =
      !best ||
      away < best.away ||
      (away === best.away &&
        (cell.provokes.length < best.cell.provokes.length ||
          (cell.provokes.length === best.cell.provokes.length && cell.cost < best.cell.cost)));
    if (better) best = { cell, away };
  }
  if (!best) return null;
  return {
    choice: { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: best.cell.x, y: best.cell.y } },
    option: { id: RULESET_MOVE_OPTION, kind: "move", label: "Move", targets: { side: "self", count: 0 } },
    to: { x: best.cell.x, y: best.cell.y },
  };
}

/** Whoever a condition on this actor drives them away from or toward (1.264), standing on the board. */
function rulesetDrivenFrom(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): { source: RulesetCombatant; moves: "away" | "toward" } | null {
  if (!definition.combat) return null;
  for (const entry of rulesetActiveConditions(definition, definition.combat, actor, encounter)) {
    const moves = entry.behavior?.moves;
    if (!moves) continue;
    const sourceId = actor.tracked.find((tracked) => tracked.condition === entry.condition)?.source;
    const source = sourceId ? rulesetCombatant(encounter, sourceId) : undefined;
    if (source && source.id !== actor.id && rulesetPositionOf(source) && rulesetCombatStanding(source)) {
      return { source, moves };
    }
  }
  return null;
}

/** The choice the picker would make, or null when the actor has nothing at all to pick from. */
function pickRulesetChoice(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  /** A window's own menu, when the pick is an answer to one rather than a turn. */
  menu?: RulesetCombatOption[],
): RulesetCandidate | null {
  const candidates = menu
    ? rulesetCandidatesFrom(definition, encounter, actorId, null, brokenLairMenu(definition, encounter, actorId, menu))
    : rulesetCandidates(definition, encounter, actorId);
  if (candidates.length === 0) return null;
  const unit = [...state.party, ...state.enemies].find((entry) => entry.id === actorId);
  if (!unit) return candidates[0]!.action;
  unit.tactics ??= assignCombatTactics(unit, state.seed);
  return chooseCombatCandidate(unit, candidates, encounter.round, normalizeGameDifficulty(state.difficulty));
}

/**
 * A concentration broken into one of a list of lair actions (1.336): the one taken is whichever would
 * catch the most foes, the shelves leaning onto the side of the room the party stands in. The others
 * leave the menu; equal ones, and letting the moment go, stay for the usual picker to weigh.
 */
function brokenLairMenu(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  menu: RulesetCombatOption[],
): RulesetCombatOption[] {
  const actor = rulesetCombatant(encounter, actorId);
  const lairs = menu.filter((option) => option.lairOf);
  if (!actor || !Array.isArray(actor.lair?.next) || lairs.length < 2) return menu;
  const foes = (ids: string[]) =>
    new Set(
      ids.filter((id) => {
        const one = rulesetCombatant(encounter, id);
        return !!one && one.side !== actor.side && !one.down;
      }),
    ).size;
  const catches = new Map(
    lairs.map((option) => {
      const aims = rulesetAimCells(encounter, actorId, option.id);
      let best = 0;
      for (const candidate of rulesetCandidatesFrom(definition, encounter, actorId, null, [option])) {
        const { at, targetIds } = candidate.action.choice;
        const caught = at ? (aims.find((aim) => aim.x === at.x && aim.y === at.y)?.targetIds ?? []) : targetIds;
        best = Math.max(best, foes(caught));
      }
      return [option.id, best] as const;
    }),
  );
  const most = Math.max(...catches.values());
  return menu.filter((option) => !option.lairOf || catches.get(option.id) === most);
}

// ── One step ──

/** One choice, and then the window it may have opened, answered by everybody in it the player is
 *  not playing. Every caller that acts for somebody wants both: a walk that provokes a strike must
 *  come back with the strike already made, or the fight would stand still waiting for an opponent
 *  to decide something it decides itself. */
function applyChoice(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  choice: RulesetCombatChoice,
): { refused: RulesetCombatEvent | null } {
  const step = applyChoiceOnly(definition, state, fight, choice);
  if (!step.refused) answerRulesetWindows(definition, state, fight);
  return step;
}

/** The choice alone. Answering a window is itself a choice, so the loop that drives one uses this
 *  rather than the pair above. */
function applyChoiceOnly(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  choice: RulesetCombatChoice,
): { refused: RulesetCombatEvent | null } {
  const step = applyRulesetCombatChoice(definition, fight.encounter, choice, rollerFor(fight));
  const refused = step.events.find((event) => event.type === "refused") ?? null;
  // A refusal changes nothing and bumps nothing: the state it was given is the state it hands back.
  if (refused) return { refused };
  absorb(definition, state, fight, step);
  return { refused: null };
}

/** A step's events into the fight, and the books that follow from them. A round can turn over on an
 *  ordinary turn or inside a window that was holding one up, and the Game Master gets its calls back
 *  either way, so the reading is here rather than at one of the two places a turn can end. */
function absorb(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  step: { state: RulesetEncounterState; events: readonly RulesetCombatEvent[] },
): void {
  fight.encounter = step.state;
  record(fight, step.events);
  if (step.events.some((event) => event.type === "round")) state.gmCalls = 0;
  syncRulesetCombatants(definition, state);
}

/** How many answers one window may take before the fight is let go. A window asks each waiting
 *  combatant once, so this is only ever reached by a bug; it is here so a fight can never hang. */
const RULESET_WINDOW_ANSWER_LIMIT = 24;

/**
 * The open window, answered by everybody in it who is not a person's to play.
 *
 * A fight never waits on an opponent: the same picker that plays its turn picks in its window, out
 * of the window's own menu, and passes when there is nothing there worth spending. A Game Master's
 * boss is asked through the Game Master's own decision, exactly as it is asked on its turn. The
 * window is left standing only when the one being asked is somebody's to play, and that is what the
 * client draws a React or Pass on.
 */
function answerRulesetWindows(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
): void {
  for (let answer = 0; answer < RULESET_WINDOW_ANSWER_LIMIT; answer++) {
    const window = fight.encounter.window;
    const asking = window?.waiting[0];
    if (!window || !asking) return;
    const combatant = rulesetCombatant(fight.encounter, asking);
    const controller = rulesetController(state, fight, combatant);
    if (controller === "manual") return;
    if (controller === "gm" && openRulesetWindowDecision(definition, state, fight, asking)) return;
    const menu = rulesetWindowOptions(definition, fight.encounter, asking);
    // Somebody hidden from it, and a Detect to look for them with (1.287).
    const looking = searchOption(definition, fight.encounter, asking, menu, false);
    const picked = looking
      ? null
      : menu.length > 0
        ? pickRulesetChoice(definition, state, fight.encounter, asking, menu)
        : null;
    const choice: RulesetCombatChoice = looking
      ? { actorId: asking, optionId: looking.id, targetIds: [], window: window.id }
      : picked?.choice
        ? { ...picked.choice, window: window.id }
        : { actorId: asking, optionId: RULESET_PASS_OPTION, targetIds: [], window: window.id };
    // A refusal inside a window would ask the same question again with the same state, so the
    // moment is let go instead and the fight moves on. It is an Engine bug rather than anybody's
    // choice, so it is said out loud: a refusal is never recorded, and this pass would otherwise
    // look exactly like the picker deciding to let it go.
    if (applyChoiceOnly(definition, state, fight, choice).refused) {
      logger.warn(
        "[game/combat:ruleset] The picker's answer to window %s for %s was refused by the rules and the moment was let go",
        window.id,
        asking,
      );
      applyChoiceOnly(definition, state, fight, {
        actorId: asking,
        optionId: RULESET_PASS_OPTION,
        targetIds: [],
        window: window.id,
      });
    }
  }
}

function advanceTurn(definition: RulesetDefinition, state: CombatDirectorState, fight: RulesetFightState): void {
  // A fight that is over has no next turn, and saying so a second time would print the outcome twice.
  if (rulesetEncounterOutcome(fight.encounter) !== "ongoing") return;
  // A window is holding this turn open, and the turn it is holding up begins when the window
  // closes. Asking for it here would be refused by the rules and write that refusal into the log.
  if (fight.encounter.window) return;
  const step = advanceRulesetTurn(definition, fight.encounter, rollerFor(fight));
  absorb(definition, state, fight, step);
  answerRulesetWindows(definition, state, fight);
}

/**
 * One whole turn of an actor no human plays: every action it takes, and then the end of its turn.
 *
 * On a board, a candidate may be "walk here, then do this", and the walk is its own step through the
 * same menu a player's would be, so the strikes it is met with on the way land exactly as they would
 * for anybody. With nothing to do at all, it closes the distance instead, and takes the ruleset's
 * own sprint first when the ruleset has one.
 */
function playRulesetTurn(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  // Somebody on the ground gets up before anything else, when the rules offer it. Fighting from
  // the floor is worse in every ruleset that has a floor, walking is not offered until they are up,
  // and a creature that never stood would lie where it fell for the rest of the fight.
  const stand = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.id === RULESET_STAND_OPTION,
  );
  if (stand) applyChoice(definition, state, fight, { actorId, optionId: stand.id, targetIds: [] });
  // And picks up what it dropped (1.266), with the turn's free pick-up.
  const pickUp = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.pickUp && !option.budget,
  );
  if (pickUp) applyChoice(definition, state, fight, { actorId, optionId: pickUp.id, targetIds: [] });
  // A gaze it may keep its eyes from (1.268): kept from while anybody else is left to fight, looked
  // at again once its holder is all that is left.
  for (const option of rulesetCombatOptions(definition, fight.encounter, actorId)) {
    if (!option.avert) continue;
    const self = rulesetCombatant(fight.encounter, actorId);
    const others = fight.encounter.combatants.some(
      (one) => !one.defeated && one.side !== self?.side && one.id !== option.avert!.holderId,
    );
    if (option.avert.back ? !others : others)
      applyChoice(definition, state, fight, { actorId, optionId: option.id, targetIds: [] });
  }
  // Driven away or toward somebody (1.264), the walk comes first, sprinting where it may.
  const actor = rulesetCombatant(fight.encounter, actorId);
  if (actor && rulesetDrivenFrom(definition, fight.encounter, actor))
    walkTowardsTrouble(definition, state, fight, actorId);
  // Everybody it could fight is hidden from it (1.287): it looks for them first.
  const looking = searchOption(
    definition,
    fight.encounter,
    actorId,
    rulesetCombatOptions(definition, fight.encounter, actorId),
    true,
  );
  if (looking) applyChoice(definition, state, fight, { actorId, optionId: looking.id, targetIds: [] });
  for (let action = 0; action < RULESET_TURN_ACTION_LIMIT; action++) {
    if (rulesetEncounterOutcome(fight.encounter) !== "ongoing") break;
    const picked = pickRulesetChoice(definition, state, fight.encounter, actorId);
    const idle = !picked || picked.option.kind === "end-turn";
    if (idle) {
      if (!walkTowardsTrouble(definition, state, fight, actorId)) break;
      continue;
    }
    // A standard action is only ever picked when nothing it has can hurt or help anybody from
    // anywhere it can get to. On a board that means it is out of reach, and the action is worth
    // more as a sprint towards the fight than as a dodge nobody is swinging at; the standard is
    // what is left once there is nowhere better to stand.
    if (picked.option.kind === "standard" && walkTowardsTrouble(definition, state, fight, actorId)) continue;
    if (picked.to && !stepBefore(definition, state, fight, actorId, picked.to)) break;
    // A refusal here would be an Engine bug rather than a player's mistake, so the turn ends
    // instead of asking again with the same state and looping.
    if (applyChoice(definition, state, fight, picked.choice).refused) break;
  }
  advanceTurn(definition, state, fight);
}

/**
 * The option that looks for whoever hides from this actor (1.287), when it should: on its turn the
 * Search, once every opponent still standing is hidden from it; between turns a Detect, once any is.
 */
function searchOption(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  menu: RulesetCombatOption[],
  everyone: boolean,
): RulesetCombatOption | undefined {
  const actor = rulesetCombatant(encounter, actorId);
  if (!actor || !definition.combat?.hiding) return undefined;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  const hidden = foes.filter((one) => rulesetHiddenFrom(actor, one));
  if (hidden.length === 0 || (everyone && hidden.length < foes.length)) return undefined;
  return menu.find((option) =>
    option.signature
      ? !everyone && !!actor.actions.find((action) => action.id === option.id)?.search
      : everyone && option.kind === "standard" && rulesetStandardName(option.id) === "search",
  );
}

/** The walk a candidate does before it acts, refused exactly as a player's would be. */
function stepBefore(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
  to: { x: number; y: number },
): boolean {
  const moved = applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to });
  if (moved.refused) return false;
  // A strike on the way may have dropped it, or left it short of where it meant to be, and then the
  // thing it meant to do from there is no longer the thing it can do.
  const after = rulesetCombatant(fight.encounter, actorId);
  return !!after && rulesetCombatStanding(after) && after.x === to.x && after.y === to.y;
}

/** Nothing in reach: close the distance, sprinting first when the ruleset has a sprint and the
 *  actor has nothing else to spend its turn on. False when there is nowhere better to stand, which
 *  is what ends the turn rather than shuffling on the spot. */
function walkTowardsTrouble(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  if (!fight.encounter.board?.grid) return false;
  const actor = rulesetCombatant(fight.encounter, actorId);
  if (!actor || (actor.movementLeft ?? 0) < 1) return false;
  const closing = rulesetClosingMove(definition, fight.encounter, actorId);
  if (!closing) return false;
  const sprint = (definition.combat?.standard ?? []).includes("dash") && !actor.flags.dashed;
  if (sprint) {
    const sprinted = applyChoice(definition, state, fight, {
      actorId,
      optionId: "standard:dash",
      targetIds: [],
    });
    // A sprint the rules refused costs nothing: the walk below happens either way.
    if (!sprinted.refused) {
      const again = rulesetClosingMove(definition, fight.encounter, actorId);
      return !!again && !applyChoice(definition, state, fight, again.choice).refused;
    }
  }
  return !applyChoice(definition, state, fight, closing.choice).refused;
}

// ── The Game Master's window ──

const windowKind = (kind: RulesetCombatOption["kind"]): CombatDecisionOption["kind"] =>
  kind === "ability"
    ? "skill"
    : kind === "standard"
      ? "defend"
      : kind === "end-turn"
        ? "wait"
        : kind === "move"
          ? "move"
          : "attack";

/** How many candidates one boss decision may hold. A positioned turn enumerates every cell the
 *  opponent could walk to against every option from there, which is a list no model should be asked
 *  to read: the best by the picker's own score, and the end of the turn beside them.
 *  ponytail: a fixed number, cut by score. The upgrade path is to group them by what they do rather
 *  than by what they score, which needs a summariser this slice does not have. */
const RULESET_WINDOW_CANDIDATE_LIMIT = 24;

/** One `CombatDecisionOption` per candidate, carrying the ruleset's own id, targets and label so the
 *  answer the Game Master picks resolves straight back through the menu. A positioned candidate may
 *  be "walk here, then do this", and carries the cell it walks to and the cell a shape is aimed at. */
function windowOptions(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** A window's own menu, when the decision is an answer to one rather than a whole turn. */
  menu?: RulesetCombatOption[],
): CombatDecisionOption[] {
  const candidates = menu
    ? rulesetCandidatesFrom(definition, encounter, actorId, null, menu)
    : rulesetCandidates(definition, encounter, actorId, true);
  const worth = (candidate: (typeof candidates)[number]) =>
    (candidate.damage ?? 0) + (candidate.healing ?? 0) + (candidate.support ?? 0) + (candidate.setup ?? 0);
  const ending = candidates.filter((candidate) => candidate.action.option.kind === "end-turn");
  const rest = candidates
    .filter((candidate) => candidate.action.option.kind !== "end-turn")
    .sort((a, b) => worth(b) - worth(a))
    .slice(0, Math.max(0, RULESET_WINDOW_CANDIDATE_LIMIT - ending.length));
  return [...rest, ...ending].map((candidate, index) => ({
    id: String(index),
    kind: windowKind(candidate.action.option.kind),
    actorId,
    ...(candidate.action.targetId ? { targetId: candidate.action.targetId } : {}),
    mpCost: 0,
    legendaryCost: 0,
    optionId: candidate.action.option.id,
    targetIds: [...candidate.action.choice.targetIds],
    label: candidate.action.option.label,
    ...(candidate.action.to ? { to: { ...candidate.action.to } } : {}),
    ...(candidate.action.choice.at ? { at: { ...candidate.action.choice.at } } : {}),
    // Which pool this way of paying spends. Two entries of the same ability differ only by this and
    // by the label that names it, so dropping it would offer a choice and then ignore it. A boss
    // whose bestiary entry carries a sheet pays out of its own pools, and is cast as big as it chose.
    ...(candidate.action.choice.payWith !== undefined ? { payWith: candidate.action.choice.payWith } : {}),
    ...(candidate.action.choice.style !== undefined ? { style: candidate.action.choice.style } : {}),
    ...(candidate.action.choice.mode !== undefined ? { mode: candidate.action.choice.mode } : {}),
    // A zone moved or turned keeps where it goes, and an option that needs an alteration keeps it:
    // without them the rules refuse the choice and the boss loses its turn.
    ...(candidate.action.choice.to &&
    (candidate.action.option.id.startsWith(RULESET_ZONE_OPTION_PREFIX) ||
      candidate.action.option.id.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX))
      ? { zoneTo: { ...candidate.action.choice.to } }
      : {}),
    ...(candidate.action.choice.alters?.length ? { alters: [...candidate.action.choice.alters] } : {}),
  }));
}

/**
 * The Game Master's decision over a ruleset WINDOW's menu rather than a turn's. Its boss is asked
 * whether to spend out of turn exactly as it is asked what to do on one, and letting the moment go
 * by is one of the answers rather than a timeout.
 *
 * False when there is nothing to ask about, and the caller lets the moment go by without spending a
 * model call on a menu with only a pass on it.
 */
function openRulesetWindowDecision(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  // A decision is already standing: the fight waits on that one rather than stacking another.
  if (state.window) return true;
  const menu = rulesetWindowOptions(definition, fight.encounter, actorId);
  if (menu.length === 0) return false;
  // Letting the moment go by is one of the candidates, so it is one of the answers.
  const options = windowOptions(definition, fight.encounter, actorId, menu);
  if (options.length <= 1) return false;
  state.choices = options;
  state.window = {
    id: `${state.id}:${++state.serial}`,
    kind: "ordinary",
    actorId,
    controller: "gm",
    options,
  };
  state.stage = "decision";
  return true;
}

function openRulesetWindow(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const options = windowOptions(definition, fight.encounter, actorId);
  // Nothing but the end of the turn left: there is no decision worth a model call.
  if (options.length <= 1) return false;
  state.choices = options;
  state.window = {
    id: `${state.id}:${++state.serial}`,
    kind: "ordinary",
    actorId,
    controller: "gm",
    options,
  };
  state.stage = "decision";
  return true;
}

function closeWindow(state: CombatDirectorState): void {
  state.window = undefined;
  state.choices = [];
}

/** After an opponent the Game Master plays has acted: another decision while it still has one, and
 *  otherwise the end of its turn. */
function continueBossTurn(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  if (
    rulesetEncounterOutcome(fight.encounter) === "ongoing" &&
    currentRulesetActor(fight.encounter)?.id === actorId &&
    openRulesetWindow(definition, state, fight, actorId)
  ) {
    return;
  }
  if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
}

/**
 * Held Ground let go in a running fight (1.330), as the story says the year has turned: the felled
 * die (or go down), the marks come due, and the log tells the Game Master. Refused when the battle
 * is not a ruleset's, is over, or is not on Held Ground.
 */
export function releaseRulesetHeldGround(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  release: RulesetHeldGroundRelease = {},
): RulesetCommandResult {
  const fight = fightOf(state);
  if (!fight) return refuse("This battle is not resolved by a ruleset.", "ruleset_combat_not_a_ruleset_fight");
  if (!definition.combat)
    return refuse("This game's ruleset no longer resolves its own fights.", "ruleset_combat_no_block");
  if (state.outcome) return refuse("Battle already finished.", "ruleset_combat_encounter-over");
  if (!fight.encounter.heldGround) return refuse("This battle is not on Held Ground.", "ruleset_combat_not_held");
  absorb(definition, state, fight, rulesetReleaseHeldGround(definition, fight.encounter, rollerFor(fight), release));
  return settled(state);
}

// ── Commands ──
// ── Commands ──

/**
 * One command against a ruleset fight. Never throws: a refusal changes nothing, bumps nothing and
 * comes back with the resolver's own reason in a stable code, so a client can say why.
 *
 * `source` is who the answer came from, exactly as the other styles record it.
 */
export function commandRulesetCombatDirector(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  command: DirectedCommand,
  source: "gm" | "ai" | "manual" | "fallback" = "manual",
): RulesetCommandResult {
  // The option and picker loops read the same sheets thousands of times in one command, and no build
  // is written to during it: the fight's creation and the creature-sheet hold run outside it.
  return withRulesetSheetEvaluationCache(() => runRulesetCommand(definition, state, command, source));
}

function runRulesetCommand(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  command: DirectedCommand,
  source: "gm" | "ai" | "manual" | "fallback",
): RulesetCommandResult {
  const fight = fightOf(state);
  if (!fight) return refuse("This battle is not resolved by a ruleset.", "ruleset_combat_not_a_ruleset_fight");
  if (!definition.combat)
    return refuse("This game's ruleset no longer resolves its own fights.", "ruleset_combat_no_block");
  if (state.outcome) return refuse("Battle already finished.", "ruleset_combat_encounter-over");

  if (command.type === "begin" || command.type === "classic" || command.type === "tactical") {
    return refuse("Action does not match this combat mode.", "ruleset_combat_wrong_style");
  }

  if (command.type === "flee") {
    state.outcome = "flee";
    fight.encounter = settleRulesetFledFight(definition, fight.encounter, rollerFor(fight)).state;
    return settled(state);
  }

  if (command.type === "control") {
    const combatant = rulesetCombatant(fight.encounter, command.unitId);
    if (!combatant || combatant.side !== "party") {
      return refuse("Only a party member has a controller.", "ruleset_combat_unknown-actor");
    }
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    fight.controllers[combatant.id] = command.controller;
    return settled(state);
  }

  const actor = currentRulesetActor(fight.encounter);
  if (!actor) return refuse("Nobody is on turn.", "ruleset_combat_unknown-actor");
  const controller = rulesetController(state, fight, actor);

  if (command.type === "ruleset") {
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    // While a window holds the fight open the command belongs to whoever it is asking, not to the
    // actor whose turn is standing still behind it.
    const held = fight.encounter.window;
    const acting = held ? rulesetCombatant(fight.encounter, held.waiting[0] ?? "") : actor;
    if (!acting) return refuse("Nobody is being asked.", "ruleset_combat_unknown-actor");
    if (rulesetController(state, fight, acting) !== "manual") {
      return refuse(
        held ? "This window is not yours to answer." : "This turn is not yours to play.",
        "ruleset_combat_not-your-turn",
      );
    }
    const step = applyChoice(definition, state, fight, {
      actorId: acting.id,
      optionId: command.optionId,
      targetIds: command.targetIds,
      ...(held ? { window: held.id } : {}),
      ...(command.payWith !== undefined ? { payWith: command.payWith } : {}),
      ...(command.style !== undefined ? { style: command.style } : {}),
      ...(command.mode !== undefined ? { mode: command.mode } : {}),
      ...(command.to ? { to: command.to } : {}),
      ...(command.at ? { at: command.at } : {}),
      ...(command.toward ? { toward: command.toward } : {}),
      ...(command.side ? { side: command.side } : {}),
      ...(command.ring !== undefined ? { ring: command.ring } : {}),
      ...(command.also?.length ? { also: command.also } : {}),
      ...(command.wall ? { wall: command.wall } : {}),
      ...(command.carries?.length ? { carries: command.carries } : {}),
      ...(command.amount !== undefined ? { amount: command.amount } : {}),
      ...(command.alters?.length ? { alters: command.alters } : {}),
      ...(command.spares ? { spares: command.spares } : {}),
      ...(command.heightens ? { heightens: command.heightens } : {}),
    });
    if (step.refused && step.refused.type === "refused") {
      return refuse(rulesetRefusalMessage(step.refused.reason), `ruleset_combat_${step.refused.reason}`);
    }
    return settled(state);
  }

  if (command.type === "choose" || command.type === "fallback") {
    const open = state.window;
    if (!open) return refuse("No decision is pending.", "ruleset_combat_no_decision");
    const chosen =
      command.type === "choose" ? open.options.find((option) => option.id === command.candidateId) : undefined;
    if (command.type === "choose" && !chosen) {
      return refuse("Unknown decision option.", "ruleset_combat_unknown-option");
    }
    const actorId = open.actorId;
    closeWindow(state);
    // A decision opened over a ruleset WINDOW is answered into that window, not onto a turn: the
    // one being asked is not the one acting, and there is no turn of theirs to go on with.
    const held = fight.encounter.window;
    if (held && held.waiting[0] === actorId) {
      const menu = rulesetWindowOptions(definition, fight.encounter, actorId);
      const answer =
        chosen && chosen.optionId && chosen.optionId !== RULESET_PASS_OPTION
          ? {
              actorId,
              optionId: chosen.optionId,
              targetIds: [...(chosen.targetIds ?? [])],
              // Everything the picked option came with. An area is aimed at a CELL, and dropping
              // it would have the rules refuse the answer and the moment let go instead. The pool
              // is carried for the same reason: a boss with a sheet pays out of one.
              ...(chosen.at ? { at: { ...chosen.at } } : {}),
              ...(chosen.payWith !== undefined ? { payWith: chosen.payWith } : {}),
              ...(chosen.zoneTo ? { to: { ...chosen.zoneTo } } : {}),
              ...(chosen.alters?.length ? { alters: [...chosen.alters] } : {}),
            }
          : chosen
            ? null
            : // Nothing usable came back, so the local picker answers instead, exactly as it does
              // for a turn: the model call is spent either way.
              (pickRulesetChoice(definition, state, fight.encounter, actorId, menu)?.choice ?? null);
      const letGo = { actorId, optionId: RULESET_PASS_OPTION, targetIds: [], window: held.id };
      if (!answer || applyChoiceOnly(definition, state, fight, { ...answer, window: held.id }).refused) {
        applyChoiceOnly(definition, state, fight, letGo);
      }
      answerRulesetWindows(definition, state, fight);
      return settled(state);
    }
    const picked = chosen ? null : pickRulesetChoice(definition, state, fight.encounter, actorId);
    const walkTo = chosen ? chosen.to : picked?.to;
    const choice: RulesetCombatChoice | null = chosen
      ? {
          actorId,
          optionId: chosen.optionId ?? "end-turn",
          targetIds: [...(chosen.targetIds ?? [])],
          ...(chosen.payWith !== undefined ? { payWith: chosen.payWith } : {}),
          ...(chosen.style !== undefined ? { style: chosen.style } : {}),
          ...(chosen.mode !== undefined ? { mode: chosen.mode } : {}),
          ...(chosen.at ? { at: { ...chosen.at } } : {}),
          ...(chosen.zoneTo ? { to: { ...chosen.zoneTo } } : {}),
          ...(chosen.alters?.length ? { alters: [...chosen.alters] } : {}),
        }
      : // The local picker is the fallback, so a Game Master that answered nothing usable costs the
        // fight nothing but the model call.
        (picked?.choice ?? null);
    // A candidate that walks first walks first, exactly as the local picker's would: one step, one
    // refusal of its own, and the strikes on the way land before the thing it walked to do.
    if (choice && walkTo && !stepBefore(definition, state, fight, actorId, walkTo)) {
      if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
      return settled(state);
    }
    // The menu's own "end turn" IS the end of the turn, exactly as the local picker reads it. Asking
    // again would reopen the same window with the same list, and the fight would stand on this actor
    // for as long as the answer stayed the same.
    if (!choice || choice.optionId === "end-turn") {
      if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
      return settled(state);
    }
    const step = applyChoice(definition, state, fight, choice);
    if (step.refused) {
      logger.warn(
        "[game/combat:ruleset] A %s decision for %s was refused by the rules and the turn was ended",
        source,
        actorId,
      );
      if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
      return settled(state);
    }
    continueBossTurn(definition, state, fight, actorId);
    return settled(state);
  }

  // `continue`: one whole turn of whoever the player is not playing.
  if (state.window) return { ok: true };
  // A window comes first: the turn behind it is standing still, and everybody in it who is not a
  // person's to play answers here. One that is theirs is left for them to answer.
  if (fight.encounter.window) {
    answerRulesetWindows(definition, state, fight);
    // Still standing means it is somebody's own to answer, and no amount of asking again moves it.
    return settled(state);
  }
  if (controller === "manual") return settled(state);
  if (controller === "gm" && openRulesetWindow(definition, state, fight, actor.id)) return { ok: true };
  playRulesetTurn(definition, state, fight, actor.id);
  return settled(state);
}

/** The resolver's own reason, in a sentence a player can read. The code beside it is what a client
 *  keys off; this is only what it says when it has nothing better. */
function rulesetRefusalMessage(reason: string): string {
  const said: Record<string, string> = {
    "encounter-over": "This fight is already over.",
    "unknown-actor": "That combatant is not in this fight.",
    "not-your-turn": "It is not their turn.",
    "unknown-option": "That is not on the menu.",
    "cannot-act": "They cannot act right now.",
    down: "They are down.",
    surprised: "They are surprised: this first turn can only be ended.",
    "bad-target": "That is not a legal target for this.",
    "no-budget": "They have nothing left to spend on it this turn.",
    insufficient: "They cannot pay for it.",
    "bad-pool": "That is not a pool this can be paid from.",
    "unknown-style": "That attack cannot be made that way right now.",
    "unknown-mode": "That weapon cannot be used that way right now.",
    "bad-alter": "It cannot be changed that way right now.",
    compelled: "Something on them decides what this turn may hold.",
    dropped: "What it is made with lies where it was dropped.",
    "targets-apart": "The ones picked stand too far from each other for this.",
    "unknown-creature": "That opponent is not in any bestiary this game can read.",
    "no-health": "That opponent's sheet gives it no health, so it was left out of the fight.",
    unreachable: "They cannot walk to that square.",
    "out-of-reach": "That is further off than this reaches.",
    "no-line-of-sight": "Something solid stands in the way.",
    "bad-cell": "That is not a square this can be aimed at.",
    "window-open": "The fight is waiting on somebody else's answer first.",
    "stale-window": "That moment has already passed.",
  };
  return said[reason] ?? "The rules refused that choice.";
}
