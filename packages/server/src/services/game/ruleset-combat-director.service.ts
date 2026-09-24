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
  generateTacticalBattlefield,
  holdRulesetCombatant,
  holdRulesetSheetHealth,
  normalizeCharacterLookupName,
  normalizeGameDifficulty,
  normalizeTacticalEnvironment,
  normalizeTacticalFormation,
  placeSpawns,
  readRulesetLive,
  rulesetAimCells,
  rulesetCellDistance,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCostSteps,
  rulesetAverageAmount,
  planRulesetCombatCost,
  rulesetCombatRoller,
  rulesetCombatStanding,
  rulesetProposedCreatureSchema,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
  rulesetOptionTargets,
  rulesetReactionPointsAtSource,
  rulesetPositionOf,
  rulesetSheetBuildsByName,
  readProposedRulesetSheet,
  RULESET_PROPOSED_SHEET_REPLACES,
  rulesetProposedStatBlock,
  rulesetTierStatBlock,
  rulesetWindowMoment,
  rulesetWindowOptions,
  RULESET_MOVE_OPTION,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  type CombatAiCandidate,
  type Combatant,
  type CombatDecisionOption,
  type DirectedCommand,
  type DirectedRulesetCombatant,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatOption,
  type RulesetCombatant,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetLiveState,
  type RulesetLiveStates,
  type TacticalBattlefieldBrief,
  type TacticalGrid,
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
  /** The chat's own party cards, which is where a sheet build lives. */
  cards: unknown;
  playerName: string | null;
  /** The stored live sheet state of the whole game. */
  live: RulesetLiveStates | null;
  /** The catalogs the party's own rows came from, so the fight knows what an ability costs. */
  partyCatalogs: RulesetCatalogEntriesById;
  /** Every catalog of this ruleset that holds creatures. */
  bestiary: RulesetCatalogEntriesById;
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
  /** Invented opponents written as sheets, and the tier each is held to once it is built. */
  const heldToTier = new Map<string, NonNullable<typeof combat.threat>["tiers"][number]>();
  const builds = rulesetSheetBuildsByName(input.cards, input.playerName);
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
      });
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
      const tiers = combat.threat?.tiers ?? [];
      const wanted = opponent.tier ?? proposed.data.tier;
      const tier = tiers.find((entry) => entry.id === wanted) ?? tiers[0];
      const held = tier ? holdRulesetSheetHealth(definition, read.sheet, tier) : { sheet: read.sheet, adjusted: [] };
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
  const encounter = createRulesetEncounter({
    definition,
    seed: input.seed,
    combatants,
    bestiary: input.bestiary,
    ...(board ? { board } : {}),
  });
  for (const [id, tier] of heldToTier) {
    const built = rulesetCombatant(encounter, id);
    if (!built) continue;
    for (const line of holdRulesetCombatant(definition, built, tier)) adjustments.push(`${built.name}: ${line}`);
  }
  const fight: RulesetFightState = {
    encounter,
    eventSeq: 0,
    events: [],
    controllers: {},
    bosses: input.enemies.filter((opponent) => opponent.boss).map((opponent) => opponent.id),
    adjustments: adjustments.slice(0, RULESET_ADJUSTMENT_LIMIT),
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
  | { grid: TacticalGrid; placements: Record<string, { x: number; y: number }>; battlefield?: unknown }
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
  const generated = generateTacticalBattlefield(
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
  const placements: Record<string, { x: number; y: number }> = {};
  for (const stand of stands) placements[stand.id] = { x: stand.x, y: stand.y };
  return { grid, placements, battlefield: generated.battlefield };
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
  // A party member is the player's to play unless they handed them over.
  if (combatant.side === "party") return fight.controllers[combatant.id] === "ai" ? "ai" : "manual";
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
  if (!state.outcome && outcome !== "ongoing") state.outcome = outcome;
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
    unit.hp = combatant.defeated ? 0 : Math.min(unit.maxHp, Math.max(0, Math.floor(health.value)));
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
): Array<{ id: string; label: string; rounds?: number }> {
  const declared = new Map(definition.sheet.live.conditions.map((entry) => [entry.id, entry.label]));
  const tracked = new Map(combatant.tracked.map((entry) => [entry.condition, entry.rounds]));
  return rulesetCombatConditions(definition, combatant).map((id) => {
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
  const max = (track: string) => definition.sheet.live.tracks.find((entry) => entry.id === track)?.max ?? 0;
  return {
    successes: value(dying.successes),
    failures: value(dying.failures),
    successesMax: max(dying.successes),
    failuresMax: max(dying.failures),
  };
}

function projectCombatant(definition: RulesetDefinition, combatant: RulesetCombatant): DirectedRulesetCombatant {
  const combat = definition.combat!;
  const health = rulesetCombatHealth(definition, combat, combatant);
  const deathTrack = deathTrackOf(definition, combatant);
  return {
    id: combatant.id,
    name: combatant.name,
    side: combatant.side,
    initiative: combatant.initiative,
    health,
    defense: combatant.defense,
    conditions: conditionsOf(definition, combatant),
    budgets: { ...combatant.budgets },
    down: combatant.down,
    dying: combatant.dying,
    stable: combatant.stable,
    defeated: combatant.defeated,
    ...(deathTrack ? { deathTrack } : {}),
    ...(combatant.concentrating ? { concentrating: combatant.concentrating.label } : {}),
    ...(combatant.block?.tier ? { tier: combatant.block.tier } : {}),
    ...(combatant.block?.traits?.length ? { traits: combatant.block.traits.map((trait) => ({ ...trait })) } : {}),
    ...(typeof combatant.x === "number" && typeof combatant.y === "number" ? { x: combatant.x, y: combatant.y } : {}),
    ...(combatant.movement !== undefined
      ? { movement: combatant.movement, movementLeft: combatant.movementLeft ?? 0 }
      : {}),
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
    const aim = option.area ? rulesetAimCells(encounter, actorId, option.id, RULESET_AIM_LIMIT) : [];
    return {
      ...option,
      targetIds: rulesetOptionTargets(definition, encounter, actorId, option),
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
            distance: { ...distance },
          },
        }
      : {}),
    ...(actor && !over ? { actorId: actor.id } : {}),
    controller,
    combatants: encounter.combatants.map((combatant) => projectCombatant(definition, combatant)),
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
            ...(rulesetWindowMoment(held.window.trigger) ? { moment: rulesetWindowMoment(held.window.trigger)! } : {}),
            ...("label" in held.window.trigger ? { label: held.window.trigger.label } : {}),
            controller: held.controller,
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
function rulesetWalkableCells(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): NonNullable<RulesetCombatOption["cells"]> {
  const actor = rulesetCombatant(encounter, actorId);
  const walk = rulesetCombatOptions(definition, encounter, actorId).find((option) => option.id === RULESET_MOVE_OPTION);
  const cells = walk?.cells ?? [];
  if (!actor || cells.length === 0) return [];
  const foes = encounter.combatants
    .filter((combatant) => combatant.side !== actor.side && rulesetCombatStanding(combatant))
    .map((combatant) => rulesetPositionOf(combatant))
    .filter((cell): cell is { x: number; y: number } => !!cell);
  const away = (cell: { x: number; y: number }) =>
    foes.reduce((closest, foe) => Math.min(closest, rulesetCellDistance(cell, foe)), Infinity);
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

/** The pool an answer is paid from, left out entirely when it is the option's own. */
const paying = (payWith: string | undefined) => (payWith === undefined ? {} : { payWith });

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
function priced(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  menu?: RulesetCombatOption[],
): Array<{ option: RulesetCombatOption; payWith?: string; price: number }> {
  const out: Array<{ option: RulesetCombatOption; payWith?: string; price: number }> = [];
  for (const option of menu ?? rulesetCombatOptions(definition, encounter, actor.id)) {
    const base = (option.cost ?? []).reduce((total, entry) => total + entry.amount, 0) + (option.signature?.cost ?? 0);
    out.push({ option, price: base });
    const action = actor.actions.find((entry) => entry.id === option.id);
    if (!action?.use?.perCostStep) continue;
    for (const pool of option.payWith ?? []) {
      const steps = rulesetCostSteps(definition, action, pool);
      if (steps < 1) continue;
      const paid = planRulesetCombatCost(definition, actor, action, pool);
      if (!paid) continue;
      const extra = steps * rulesetAverageAmount(action.use.perCostStep);
      const forecast = option.forecast ? { ...option.forecast } : undefined;
      if (forecast?.averageDamage !== undefined) {
        forecast.averageDamage = Math.round((forecast.averageDamage + extra) * 100) / 100;
      }
      out.push({
        option: {
          ...option,
          // Named for the pool it spends, so a Game Master reading the menu can tell the two apart.
          label: `${option.label} (${paid.cost[0]?.label ?? pool})`,
          cost: paid.cost.map((entry) => ({ pool: entry.pool, label: entry.label, amount: entry.amount })),
          ...(forecast ? { forecast } : {}),
        },
        payWith: pool,
        price: paid.cost.reduce((total, entry) => total + entry.amount, 0) + steps,
      });
    }
  }
  return out;
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
  if (trigger.kind !== "aimed" && trigger.kind !== "harmed") return undefined;
  const action = actor.actions.find((entry) => entry.id === option.id);
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
  for (const { option, payWith, price } of priced(definition, encounter, actor, menu)) {
    // Walking is not a candidate of its own: it is what a candidate does before it acts, and a turn
    // with nothing to act on closes the distance instead (see `rulesetClosingMove`).
    if (option.kind === "move") continue;
    // From another cell, only what the actor would do THERE is worth enumerating: everything it
    // could do without moving is already on the list.
    if (standing && option.targets.count <= 0 && !option.area) continue;
    if (option.kind === "end-turn") {
      candidates.push({ action: { choice: { actorId, optionId: option.id, targetIds: [] }, option }, hold: true });
      continue;
    }
    // In a window, an option that asks for nobody may still land on somebody: whoever is walking
    // away, or whoever caused the moment. It is weighed by what it would do to THEM, and its answer
    // still names nobody, because the rules fill that target in.
    const lands = menu ? rulesetWindowTargetOf(encounter, actor, option) : undefined;
    if (option.targets.count <= 0 && !lands) {
      // Holding the thing it is already holding would end it and start it again for the same price.
      if (actor.concentrating?.actionId === option.id) continue;
      candidates.push({
        action: { choice: { actorId, optionId: option.id, targetIds: [], ...paying(payWith) }, option },
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
      candidates.push(...areaCandidates(definition, combat, encounter, actor, option, standing, payWith, price));
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
          choice: { actorId, optionId: option.id, targetIds: lands ? [] : [targetId], ...paying(payWith) },
          option,
          targetId,
        },
        targetId,
        cost: price,
      };
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
        if (!lands) candidate.action.choice.targetIds = [targetId, ...others.map((other) => other.id)];
        candidate.damage = Math.min(2, (average / pool) * (1 + others.length)) * chance;
        if (average >= pool) candidate.finish = chance;
      } else if (ally) candidate.support = 0.4;
      else candidate.setup = 0.4;
      candidates.push(candidate);
    }
  }
  if (standing) for (const candidate of candidates) candidate.action.to = { ...standing };
  return candidates;
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
  /** The pool this way of paying spends, and what that way costs. */
  payWith: string | undefined,
  price: number,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const average = option.forecast?.averageDamage ?? 0;
  const chance = option.forecast?.hitChance ?? 1;
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
    const friends = caught.filter((target) => target.side === actor.side);
    const candidate: CombatAiCandidate<RulesetCandidate> = {
      action: {
        choice: {
          actorId: actor.id,
          optionId: option.id,
          targetIds: [],
          at: { x: aim.x, y: aim.y },
          ...paying(payWith),
        },
        option,
        ...(foes[0] ? { targetId: foes[0].id } : {}),
        ...(standing ? { to: { ...standing } } : {}),
      },
      ...(foes[0] ? { targetId: foes[0].id } : {}),
      cost: price,
    };
    if (option.heals) {
      const helped = friends.filter((target) => {
        const health = rulesetCombatHealth(definition, combat, target);
        return target.down || health.value < health.max;
      });
      if (helped.length === 0) continue;
      candidate.healing = helped.reduce((total, target) => {
        const health = rulesetCombatHealth(definition, combat, target);
        return total + Math.min(1, average / Math.max(1, health.max)) + (target.down ? 1 : 0);
      }, 0);
    } else if (average > 0) {
      if (foes.length === 0) continue;
      const share = foes.reduce((total, target) => {
        const health = rulesetCombatHealth(definition, combat, target);
        return total + average / Math.max(1, health.value + health.temp);
      }, 0);
      const hurt = friends.reduce((total, target) => {
        const health = rulesetCombatHealth(definition, combat, target);
        return total + average / Math.max(1, health.value + health.temp);
      }, 0);
      candidate.damage = Math.max(0, Math.min(2, share - hurt)) * chance;
      if (candidate.damage <= 0) continue;
    } else if (foes.length > 0) candidate.setup = 0.4;
    else candidate.support = 0.4;
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * The walk a turn with nothing in reach takes: the reachable cell that ends up nearest an opponent,
 * cheapest first, and never one that would be struck at on the way when a quieter cell gets as
 * close. Null when nothing is worth walking to, which is what keeps a cornered creature from
 * shuffling on the spot for the rest of the fight.
 */
function rulesetClosingMove(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): RulesetCandidate | null {
  const actor = rulesetCombatant(encounter, actorId);
  const from = rulesetPositionOf(actor);
  if (!actor || !from || !encounter.board?.grid) return null;
  const foes = encounter.combatants
    .filter((combatant) => combatant.side !== actor.side && rulesetCombatStanding(combatant))
    .map((combatant) => rulesetPositionOf(combatant))
    .filter((cell): cell is { x: number; y: number } => !!cell);
  if (foes.length === 0) return null;
  const nearest = (cell: { x: number; y: number }) =>
    foes.reduce((closest, foe) => Math.min(closest, rulesetCellDistance(cell, foe)), Infinity);
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
    ? rulesetCandidatesFrom(definition, encounter, actorId, null, menu)
    : rulesetCandidates(definition, encounter, actorId);
  if (candidates.length === 0) return null;
  const unit = [...state.party, ...state.enemies].find((entry) => entry.id === actorId);
  if (!unit) return candidates[0]!.action;
  unit.tactics ??= assignCombatTactics(unit, state.seed);
  return chooseCombatCandidate(unit, candidates, encounter.round, normalizeGameDifficulty(state.difficulty));
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
    const picked = menu.length > 0 ? pickRulesetChoice(definition, state, fight.encounter, asking, menu) : null;
    const choice: RulesetCombatChoice = picked?.choice
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
      ...(command.to ? { to: command.to } : {}),
      ...(command.at ? { at: command.at } : {}),
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
          ...(chosen.at ? { at: { ...chosen.at } } : {}),
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
    "bad-target": "That is not a legal target for this.",
    "no-budget": "They have nothing left to spend on it this turn.",
    insufficient: "They cannot pay for it.",
    "bad-pool": "That is not a pool this can be paid from.",
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
