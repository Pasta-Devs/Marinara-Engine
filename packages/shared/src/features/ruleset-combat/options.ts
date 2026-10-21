// The legal menu. Everything that acts in a ruleset fight - a player, an opponent's own choices, a
// forecast - picks an id from here, so legality is decided in exactly one place and a client never
// computes it.

import { rulesetEntryIcons } from "../rulesets/art-icons.js";
import type {
  RulesetCombat,
  RulesetDefinition,
  RulesetTargetIs,
  RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import {
  applyRulesetSheetOp,
  evaluateRulesetSheetLive,
  planRulesetUse,
  readRulesetLive,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "../rulesets/live-state.js";
import {
  RULESET_PICK_UP_OPTION_PREFIX,
  RULESET_AVERT_OPTION_PREFIX,
  RULESET_CHARGE_STEP_PREFIX,
  rulesetChargeSteps,
  rulesetActionDropped,
  rulesetActionItemIndex,
  rulesetAmmoLeft,
  rulesetDroppedItems,
  rulesetDroppedHeldDefense,
  rulesetItemOn,
  rulesetItemUseLeft,
  rulesetLoaded,
  rulesetModedAction,
  rulesetShotsAvailable,
  rulesetItemChargesLeft,
} from "./ammo.js";
import { resolveRulesetValueRef } from "../rulesets/sheet-math.js";
import { normalizeCharacterLookupName } from "../../utils/character-lookup-name.js";
import { parseRulesetCombatDice, rulesetAverageDamage } from "./dice.js";
import {
  rulesetCombatAdvantage,
  rulesetCombatIsPool,
  rulesetCombatPenalty,
  rulesetDamageAverage,
  rulesetPoolChance,
  rulesetPoolDistribution,
  rulesetSoakOf,
} from "./pool.js";
import {
  currentRulesetActor,
  rulesetActedThisRound,
  rulesetActiveConditions,
  rulesetWardsOn,
  rulesetTargetHasSenses,
  rulesetTargetIs,
  rulesetTargetTypesAllow,
  rulesetAuraSpreaders,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetTargetDamageKind,
  rulesetDamageMinimum,
  rulesetCombatEffects,
  rulesetCombatStanding,
  rulesetAbilityNarrowing,
  rulesetCheckAbility,
  rulesetCheckMode,
  rulesetConditionModifiers,
  rulesetDamageInEffect,
  rulesetLairRound,
  rulesetSealed,
  rulesetSealedApart,
  rulesetSizeRank,
  type RulesetConditionModifier,
  rulesetConditionEconomy,
  rulesetIsAttack,
  rulesetOnOwnTurn,
  rulesetAttackNamed,
  rulesetItemMatches,
  rulesetModeAllowances,
  rulesetModeRuleHolds,
  rulesetMovesOnly,
  rulesetMovementAllowance,
  rulesetLightMatches,
  rulesetNearProp,
  rulesetPropNamed,
} from "./encounter.js";
import {
  rulesetAirborne,
  rulesetBlowKind,
  rulesetAreaCells,
  rulesetWallShape,
  rulesetCellCover,
  rulesetCellDistance,
  rulesetCombatantDistance,
  rulesetLevelOf,
  rulesetLineOfSight,
  rulesetSees,
  rulesetOpportunityAttack,
  rulesetGapFrom,
  rulesetPositionOf,
  rulesetReachableCells,
  rulesetDistanceTo,
  rulesetFootprint,
  rulesetFootprintsSee,
  rulesetGap,
  rulesetNearestCell,
  rulesetSpanOf,
  rulesetCellSolidFor,
  rulesetFootprintAt,
  rulesetFills,
} from "./grid.js";
import { coverTier, elevationAt } from "../tactical-combat/math.js";
import { rulesetStandingProps, rulesetStandingSections, rulesetZoneMoveCells, rulesetZoneTurnCells } from "./zones.js";
import {
  rulesetCanSee,
  rulesetCarriesLight,
  rulesetHiddenFrom,
  rulesetHidingTraits,
  rulesetLightAt,
  rulesetSeesCell,
  rulesetStandsObscured,
} from "./sight.js";
import type {
  RulesetBoardProp,
  RulesetAfterAttack,
  RulesetCombatAmount,
  RulesetCombatAgainst,
  RulesetConditionBonus,
  RulesetCombatAction,
  RulesetCombatAlter,
  RulesetCombatAlterOffer,
  RulesetCombatCell,
  RulesetCombatOption,
  RulesetCombatRollMode,
  RulesetCombatContest,
  RulesetCombatant,
  RulesetTrackedCondition,
  RulesetEncounterState,
  RulesetMomentCause,
  RulesetReactionAgainst,
  RulesetReactionAlso,
  RulesetReactionMoment,
  RulesetSheetBounds,
  RulesetWindowTrigger,
  RulesetCombatMove,
  RulesetMoveMode,
  RulesetReachableCell,
} from "./types.js";

/** The budget a standard action spends: the first one the economy declares, which is the main one. */
export function rulesetStandardBudget(combat: RulesetCombat): string {
  return combat.economy.budgets[0]!.id;
}

/** The standard action one option id names. An ability that lets its holder buy one with another
 *  budget writes that budget after an `@`, which no standard action's own name may hold. */
export function rulesetStandardName(optionId: string): string {
  const name = optionId.startsWith("standard:") ? optionId.slice("standard:".length) : optionId;
  const at = name.indexOf("@");
  return at < 0 ? name : name.slice(0, at);
}

/** Whether this action would be taken out of strikes already in hand rather than out of a budget. */
/** Whether its holder has taken the attack action this turn: with anything, or with one of `names`
 *  (1.242). */
export function rulesetTookAttackAction(actor: RulesetCombatant, after: RulesetAfterAttack): boolean {
  const made = actor.flags.attackAction ?? [];
  if (after === true) return made.length > 0;
  return made.some(
    (label) =>
      (after.names !== undefined && rulesetAttackNamed(label, after.names)) ||
      // Or a held weapon that is these (1.246), read off the attack made with it.
      (after.items !== undefined &&
        actor.actions.some(
          (action) =>
            action.label === label &&
            (action.id.startsWith("item:") || action.id.startsWith("offhand:")) &&
            rulesetItemMatches({ tags: action.itemTags ?? [] }, label, after.items!),
        )),
  );
}

export function rulesetFreeStrike(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  return action.strikes !== undefined && (actor.strikesLeft ?? 0) > 0;
}

/** Whether taking this action itself would do anything at all. An entry that only says which
 *  standard actions its holder may buy with another budget is a PERMISSION, not something to take:
 *  what it grants is on the menu as `standard:<id>@<budget>`, and the entry itself is not. */
function actionDoesSomething(action: RulesetCombatAction): boolean {
  // A way of hiding that is its holder's own (1.292) is a permission too.
  if (!action.standard && !action.hiding) return true;
  return !!(
    action.damage ||
    action.heal ||
    action.temporary ||
    action.applies?.length ||
    action.gives ||
    action.sequence ||
    action.concentration
  );
}

/**
 * The standard actions an ability lets its holder buy with a budget other than the main one, priced
 * by the ability that grants them. The granting ability's own price is paid when one is taken, so a
 * grant nobody can pay for is not offered at all.
 */
function grantedStandardOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  state?: RulesetEncounterState,
): RulesetCombatOption[] {
  const declared = new Set<string>(combat.standard ?? []);
  const options: RulesetCombatOption[] = [];
  const seen = new Set<string>();
  // What a condition lets a budget it grants be spent on (combat C6d, Haste's extra action): the
  // standard actions it names, at no price of its own.
  for (const grant of rulesetConditionEconomy(definition, combat, actor, state).grants) {
    if (!grant.standard || (actor.budgets[grant.budget] ?? 0) < 1) continue;
    for (const name of grant.standard) {
      if (!declared.has(name)) continue;
      const id = `standard:${name}@${grant.budget}`;
      if (seen.has(id)) continue;
      seen.add(id);
      options.push({
        id,
        kind: "standard",
        label: name,
        budget: grant.budget,
        targets: name === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
      });
    }
  }
  for (const action of actor.actions) {
    const granted = action.standard;
    if (!granted || (actor.budgets[granted.budget] ?? 0) < 1) continue;
    // Only out of sight, where it says so (1.291): Shadow Stealth.
    if (!grantHolds(definition, action, actor, state)) continue;
    if (!rulesetActionAvailable(actor, action, state, definition)) continue;
    const paid = planRulesetCombatCost(definition, actor, action);
    if (!paid) continue;
    for (const name of granted.actions) {
      if (!declared.has(name)) continue;
      const id = `standard:${name}@${granted.budget}`;
      if (seen.has(id)) continue;
      seen.add(id);
      options.push({
        id,
        kind: "standard",
        label: name,
        budget: granted.budget,
        targets: name === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
        ...(paid.cost.length > 0 ? { cost: paid.cost } : {}),
      });
    }
  }
  return options;
}

/** Whether a permission holds now (1.291): one given only while its holder stands obscured. */
function grantHolds(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  actor: RulesetCombatant,
  state?: RulesetEncounterState,
): boolean {
  return action.standard?.while !== "obscured" || (!!state && rulesetStandsObscured(state, actor, definition));
}

/** The ability behind a `standard:<id>@<budget>` option, when one of the actor's own granted it.
 *  Null for an ordinary standard action, which no ability had to allow. */
export function rulesetGrantedStandard(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  optionId: string,
  state?: RulesetEncounterState,
): { action: RulesetCombatAction; name: string; budget: string } | null {
  if (!optionId.startsWith("standard:")) return null;
  const at = optionId.indexOf("@");
  if (at < 0) return null;
  const name = optionId.slice("standard:".length, at);
  const budget = optionId.slice(at + 1);
  // The SAME ability the menu offered it under: one that has run out of uses, is waiting on its
  // dice, or cannot pay its own price is not on the menu, so it must not be what resolution picks
  // either, or a character with two permissions could take one through the other's exhausted half.
  const action = actor.actions.find(
    (entry) =>
      entry.standard?.budget === budget &&
      entry.standard.actions.includes(name) &&
      grantHolds(definition, entry, actor, state) &&
      rulesetActionAvailable(actor, entry, state, definition) &&
      !!planRulesetCombatCost(definition, actor, entry),
  );
  return action ? { action, name, budget } : null;
}

/** The one thing a fight with no board answers about distance: nothing at all. */
function positioned(state: RulesetEncounterState): boolean {
  return !!state.board?.grid;
}

/** Whether an action with a teleport does anything besides (1.276), off a board where it cannot go. */
function rulesetDoesMoreThanTeleport(action: RulesetCombatAction): boolean {
  return !!(
    action.damage ||
    action.heal ||
    action.temporary ||
    action.applies?.length ||
    action.ends ||
    action.restore ||
    action.gives ||
    action.standard ||
    action.sequence
  );
}

/** Whether somebody `span` cells a side may stand with their corner here, nobody else in the way. */
export function rulesetRoomAt(
  state: RulesetEncounterState,
  grid: NonNullable<NonNullable<RulesetEncounterState["board"]>["grid"]>,
  mover: RulesetCombatant,
  at: RulesetCombatCell,
  others: readonly string[] = [],
): boolean {
  return rulesetFootprintAt(at, rulesetSpanOf(mover)).every(
    (cell) =>
      !rulesetCellSolidFor(grid, cell.x, cell.y, mover) &&
      !state.combatants.some(
        (other) => other.id !== mover.id && !others.includes(other.id) && !other.defeated && rulesetFills(other, cell),
      ),
  );
}

/**
 * Where a teleport may go (1.276): every cell its user's corner may stand on within its distance of
 * where they stand now, nearest cell to nearest cell, with room for all of them and nobody there,
 * and, where it says `seen`, a cell of it they can see. Never where they already are.
 */
export function rulesetTeleportCells(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  teleport: NonNullable<RulesetCombatAction["teleport"]>,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  const from = rulesetPositionOf(actor);
  if (!grid || !from) return [];
  const span = rulesetSpanOf(actor);
  const cells: RulesetCombatCell[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (x === from.x && y === from.y) continue;
      const at = { x, y };
      if (rulesetGapFrom(at, span, actor) > teleport.distance) continue;
      if (!rulesetRoomAt(state, grid, actor, at)) continue;
      if (
        teleport.seen &&
        !rulesetFootprintAt(at, span).some((cell) => rulesetSeesCell(definition, state, actor, cell))
      ) {
        continue;
      }
      cells.push(at);
    }
  }
  return cells;
}

/** Who may go along on a teleport (1.276): standing creatures of its user's side, no bigger than
 *  they are, within its `carriesWithin` of them (touching when it says nothing), never held off the
 *  board. None for one that carries nobody. */
export function rulesetTeleportPassengers(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  teleport: NonNullable<RulesetCombatAction["teleport"]>,
  /** Given, `carriesSeen` keeps to those its user sees (1.279). */
  definition?: RulesetDefinition,
): string[] {
  // Off a board only leaving goes anywhere (1.279), and nothing measures who stands near.
  const board = !!state.board?.grid && !!rulesetPositionOf(actor);
  if (!teleport.carries || (!board && !teleport.leaves)) return [];
  const within = teleport.carriesWithin ?? 1;
  return state.combatants
    .filter(
      (one) =>
        one.id !== actor.id &&
        one.side === actor.side &&
        rulesetCombatStanding(one) &&
        !one.away &&
        (!board || (!!rulesetPositionOf(one) && rulesetGap(actor, one) <= within)) &&
        rulesetSpanOf(one) <= rulesetSpanOf(actor) &&
        (!teleport.carriesSeen || !definition || rulesetCanSee(definition, state, actor, one)),
    )
    .map((one) => one.id);
}

/** How many cells one aim scan may look at: the area of the largest board a saved fight may hold. */
const RULESET_AIM_SCAN_CEILING = 64 * 64;

/** The two ids a positioned fight adds to the menu beside the actor's own actions. Written with a
 *  colon, which no sheet id or stat block action id may hold, so a creature that really has an
 *  action called "move" or "stand" can never be mistaken for walking. The same trick the standard
 *  actions use (`standard:dodge`). */
export const RULESET_MOVE_OPTION = "move:walk";
/** Moving a lasting area (1.173): this, then the id of the action that left it. */
export const RULESET_ZONE_OPTION_PREFIX = "zone:";
/** Turning a line or cone its caster carries to face another way (1.182): this, then the action's id. */
export const RULESET_ZONE_TURN_OPTION_PREFIX = "zone-turn:";
export const RULESET_STAND_OPTION = "move:stand";
/** A flier going up a level, or down one, where it stands (1.114). */
export const RULESET_FLY_UP_OPTION = "move:fly-up";
/** Lighting a prop again (1.332), followed by its id. */
export const RULESET_RELIGHT_OPTION_PREFIX = "relight:";

/** Every cell a prop that may be lit again lights (1.332): within its `squares` of it. */
export function rulesetRelightCells(state: RulesetEncounterState, prop: RulesetBoardProp): RulesetCombatCell[] {
  const grid = state.board?.grid;
  if (!grid || !prop.relight) return [];
  const cells: RulesetCombatCell[] = [];
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++)
      if (prop.cells.some((cell) => rulesetCellDistance(cell, { x, y }) <= prop.relight!.squares)) cells.push({ x, y });
  return cells;
}
export const RULESET_FLY_DOWN_OPTION = "move:fly-down";
/** Into the air or back onto the ground where it stands (1.354): free, as part of moving. */
export const RULESET_TAKE_OFF_OPTION = "move:take-off";
export const RULESET_LAND_OPTION = "move:land";
/** How high above the ground under it a flier may go, in levels. A board's own heights are a handful
 *  of levels, so this is well above anything worth being out of reach over. */
export const RULESET_FLY_CEILING = 20;

/** What one option may be pointed at, in cells. `sight` is whether something solid between the two
 *  of them stops it. Null when this fight measures nothing. */
export interface RulesetOptionReach {
  /** The furthest it may be pointed at all. */
  max: number;
  /** The distance beyond which a ruleset that declared `ranged` makes it harder. */
  normal: number;
  /** Whether it is a shot rather than a swing, which is what the ranged rules read. */
  shot: boolean;
  /** How far it still SWINGS, for something that both swings and is thrown: inside this it is a
   *  swing whatever `shot` says, and the ranged rules do not read it. Zero for a pure shot. */
  swing: number;
}

/** The actor's own action behind an option id, when the option is one of theirs. */
function actionOf(actor: RulesetCombatant, optionId: string): RulesetCombatAction | undefined {
  // A lair action as its window offers it (1.315) is aimed as the action itself: without this an area
  // lair action had nowhere to be aimed, and an opponent the Engine runs let every one go by.
  const id = optionId.startsWith(RULESET_LAIR_OPTION_PREFIX)
    ? optionId.slice(RULESET_LAIR_OPTION_PREFIX.length)
    : optionId;
  return actor.actions.find((entry) => entry.id === id);
}

/**
 * How far this option reaches, in cells.
 *
 * An action that says nothing reaches the next cell, which is the smallest step a board has: the
 * generic actions that touch somebody else read the same way. An action that carries rather than
 * swings reaches its long distance when the ruleset gave it one, and the ordinary distance is what
 * `combat.ranged` measures "too far" against.
 */
export function rulesetOptionReach(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  /** A weapon mode's own reach (1.190), in place of the weapon's. */
  range?: { normal: number; long?: number },
): RulesetOptionReach | null {
  if (!positioned(state)) return null;
  const actor = rulesetCombatant(state, actorId);
  if (!actor) return null;
  const found = actionOf(actor, optionId);
  const action = found && range ? { ...found, range } : found;
  if (!action) return { max: 1, normal: 1, shot: false, swing: 1 };
  // Breaking free of a hold that names its escape DC is a struggle against the hold itself, which
  // its holder throws nothing for, so it is not limited by how far away they stand (1.175).
  if (action.contest?.from && rulesetEscapeDc(actor, action.contest) !== undefined) return null;
  if (action.area) {
    // An area is aimed at a cell rather than at anybody. With a distance of its own it may be sent
    // that far off. With none, a BURST is centred on the actor, because a ball of fire with no range
    // goes off where it is set down, while a cone or a line is aimed within its own size, because
    // there the cell only says which way it points.
    const carried = action.range?.long ?? action.range?.normal;
    // A box with none sits against its maker (1.177), the cell beside them its near corner.
    const max = carried ?? (action.area.shape === "burst" ? 0 : action.area.shape === "box" ? 1 : action.area.size);
    // Only a shape with a distance of its own is SHOT: one that comes off the actor, a breath or a
    // burst set down where they stand, is not made harder by a foe at their elbow.
    return { max, normal: action.range?.normal ?? max, shot: !!action.range, swing: 0 };
  }
  if (action.range) {
    // Something that carries a reach AS WELL is a thrown weapon: a swing in hand, a shot beyond.
    const swing = action.reach !== undefined ? Math.max(1, action.reach) : 0;
    return {
      max: Math.max(action.range.long ?? action.range.normal, swing),
      normal: action.range.normal,
      shot: true,
      swing,
    };
  }
  const reach = Math.max(1, action.reach ?? 1);
  return { max: reach, normal: reach, shot: false, swing: reach };
}

/** Why this combatant cannot be pointed at from where the actor stands, or null when they can.
 *  Anything more than one cell away needs an unbroken line: this slice has no shooting round
 *  corners and no reaching over a wall. */
export function rulesetTargetRefusal(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  targetId: string,
  /** A weapon mode's own reach (1.190). */
  range?: { normal: number; long?: number },
): "out-of-reach" | "no-line-of-sight" | null {
  const summon = optionId.startsWith("summon:")
    ? rulesetCombatant(state, actorId)?.summons?.find((entry) => `summon:${entry.actionId}` === optionId)
    : undefined;
  if (summon) {
    const target = rulesetCombatant(state, targetId);
    if (!positioned(state) || !summon.at || !rulesetPositionOf(target)) return null;
    // To the nearest cell they fill (1.194).
    return rulesetDistanceTo(summon.at, target) > (summon.move ?? 0) + (summon.reach ?? 1) ? "out-of-reach" : null;
  }
  const reach = rulesetOptionReach(state, actorId, optionId, range);
  if (!reach) return null;
  const from = rulesetPositionOf(rulesetCombatant(state, actorId));
  const to = rulesetPositionOf(rulesetCombatant(state, targetId));
  const grid = state.board?.grid;
  if (!from || !to || !grid) return null;
  if (actorId === targetId) return null;
  const target = rulesetCombatant(state, targetId);
  // Height counts where somebody is up in the air (1.114).
  const away = target ? rulesetCombatantDistance(state, rulesetCombatant(state, actorId)!, target) : 0;
  // A shot carries further down from higher ground when the ruleset says so (combat C6b).
  const further =
    reach.shot && target && rulesetAbove(state, rulesetCombatant(state, actorId), target)
      ? (state.board?.rangeBonus ?? 0)
      : 0;
  if (away > reach.max + further) return "out-of-reach";
  // Any cell of one to any cell of the other (1.194).
  const actor = rulesetCombatant(state, actorId);
  if (rulesetGap(actor, target) > 1 && !rulesetFootprintsSee(grid, actor, target)) return "no-line-of-sight";
  return null;
}

/**
 * The cells of standing wall sections, and of props (1.316), an attack may be pointed at instead of a
 * creature (1.200):
 * one aimed at a single foe or anybody, dealing damage, not an area, a contest or a sequence, with the
 * section within its reach and seen from where its maker stands.
 */
export function rulesetWallTargets(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  if (!grid || !rulesetPositionOf(actor)) return [];
  if (action.toHit === undefined || !action.damage || action.area || action.contest || action.sequence) return [];
  if (action.targets.count < 1 || (action.targets.side !== "enemy" && action.targets.side !== "any")) return [];
  // And what stands on the board that may be broken (1.316).
  const cells = [
    ...rulesetStandingSections(state).flatMap(({ section }) => section.cells),
    ...rulesetStandingProps(state).flatMap((prop) => prop.cells),
    // Growth an edge that cuts may cut back (1.318).
    ...(cutsGrowth(state, action)
      ? Object.entries(grid.ground ?? {}).flatMap(([at, here]) => {
          if (!here.growth) return [];
          const [x, y] = at.split(",").map(Number);
          return [{ x: x!, y: y! }];
        })
      : []),
  ];
  if (cells.length === 0) return [];
  const reach = rulesetOptionReach(state, actor.id, action.id);
  if (!reach) return [];
  return cells
    .filter(
      (cell) =>
        rulesetDistanceTo(cell, actor) <= reach.max &&
        rulesetFootprint(actor).some(
          (from) => rulesetCellDistance(from, cell) <= 1 || rulesetLineOfSight(grid, from, cell),
        ),
    )
    .map((cell) => ({ x: cell.x, y: cell.y }));
}

/** Whether an action's damage is of a kind that cuts growth back (1.318): slashing, unless the board
 *  says otherwise. */
function cutsGrowth(state: RulesetEncounterState, action: RulesetCombatAction): boolean {
  if (!state.board?.grid.ground) return false;
  const cut = state.board.growth?.cutBy ?? ["slashing"];
  const types = [action.damage?.type, ...(action.damage?.plus ?? []).map((clause) => clause.type)];
  return types.some((type) => !!type && cut.includes(type.trim().toLowerCase()));
}

/** Whether an area option may be aimed at this cell: on the board, within the distance it carries,
 *  and with nothing solid in the way. Aiming at an empty patch of ground is perfectly legal and
 *  simply catches nobody. */
export function rulesetAimLegal(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  at: RulesetCombatCell,
): boolean {
  const grid = state.board?.grid;
  const actor = rulesetCombatant(state, actorId);
  const action = actor ? actionOf(actor, optionId) : undefined;
  const from = rulesetPositionOf(actor);
  const reach = rulesetOptionReach(state, actorId, optionId);
  if (!grid || !action?.area || !from || !reach) return false;
  if (!Number.isInteger(at.x) || !Number.isInteger(at.y)) return false;
  if (at.x < 0 || at.y < 0 || at.x >= grid.width || at.y >= grid.height) return false;
  // From whichever cell the actor fills (1.194).
  if (rulesetDistanceTo(at, actor) > reach.max) return false;
  return rulesetFootprint(actor).some((cell) => rulesetLineOfSight(grid, cell, at));
}

/** Where an area option may be aimed, and who each aim would catch. Empty for anything that is not
 *  an area, and for every fight without a board. */
export function rulesetAimCells(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  /** Stop after this many aims. A forecast only needs to know that ONE exists and whom it catches,
   *  and scanning the rest of the board for it on every menu read is work nobody sees. */
  limit = Infinity,
  /** Only aims that catch somebody, even for something worth setting down on nobody. */
  occupiedOnly = false,
): Array<{ x: number; y: number; targetIds: string[] }> {
  const grid = state.board?.grid;
  const from = rulesetPositionOf(rulesetCombatant(state, actorId));
  const reach = rulesetOptionReach(state, actorId, optionId);
  if (!grid || !from || !reach) return [];
  const aims: Array<{ x: number; y: number; targetIds: string[] }> = [];
  // Scanned over the BOARD, never over the range: a ruleset may declare a range of ten thousand
  // units, and a loop that long would be a way to stall a server with one catalog entry.
  const box = (around: RulesetCombatCell, radius: number) => ({
    top: Math.max(0, around.y - radius),
    bottom: Math.min(grid.height - 1, around.y + radius),
    left: Math.max(0, around.x - radius),
    right: Math.min(grid.width - 1, around.x + radius),
  });
  // A BALL only ever catches somebody standing within its own radius of where it lands, so the cells
  // worth looking at are the ones around the people on the board, not every cell it could be thrown
  // to: a long throw over a wide board is otherwise thousands of cells, every one of them drawing
  // its whole shape. A cone and a line reach out from the ACTOR, so a cell next to them can catch
  // somebody at the far end, and for those the cells to look at are the ones the aim may be sent to.
  const action = actionOf(rulesetCombatant(state, actorId)!, optionId);
  const shape = action?.area;
  // Something that stays (a zone, a wall) or is set down several times is worth putting down where
  // nobody stands yet (1.178): a wall across a corridor, a cube beside the one on the foe.
  const anywhere = !occupiedOnly && (!!action?.zone || !!shape?.copies);
  const boxes =
    shape?.shape === "burst" && !anywhere
      ? state.combatants
          // Anybody still in the fight, on their feet or on the ground: a shape that MENDS is set
          // down on the ally who fell, and that cell has to be offered.
          .filter((combatant) => !combatant.defeated && rulesetPositionOf(combatant))
          // Around every cell they fill (1.194): from the top-left one, as far again as they are big.
          .map((combatant) => {
            const box_ = box(rulesetPositionOf(combatant)!, shape.size);
            const more = rulesetSpanOf(combatant) - 1;
            return {
              ...box_,
              bottom: Math.min(grid.height - 1, box_.bottom + more),
              right: Math.min(grid.width - 1, box_.right + more),
            };
          })
      : [
          (() => {
            const box_ = box(from, reach.max);
            const more = rulesetSpanOf(rulesetCombatant(state, actorId)) - 1;
            return {
              ...box_,
              bottom: Math.min(grid.height - 1, box_.bottom + more),
              right: Math.min(grid.width - 1, box_.right + more),
            };
          })(),
        ];
  // And a ceiling on the cells looked at, whatever `limit` says: the largest board a save may hold
  // is 64 by 64, so nothing legitimate is cut short, and nothing else can make this loop long.
  let looked = 0;
  const seen = new Set<string>();
  for (const bounds of boxes) {
    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        const key = `${x},${y}`;
        // Two people standing close together share cells, and a cell is both looked at and offered
        // once: a cell seen twice must not spend the ceiling, or a crowd could use it up before the
        // cells further out are ever reached.
        if (seen.has(key)) continue;
        seen.add(key);
        if (++looked > RULESET_AIM_SCAN_CEILING) return aims;
        const at = { x, y };
        if (!rulesetAimLegal(state, actorId, optionId, at)) continue;
        const targetIds = rulesetAreaTargets(state, actorId, optionId, at);
        // A cell the shape would catch nobody from is still somewhere it may be aimed, but it is not
        // worth carrying to a screen or to a picker.
        if (targetIds.length > 0 || anywhere) aims.push({ x, y, targetIds });
        if (aims.length >= limit) return aims;
      }
    }
  }
  return aims;
}

/** How an area is laid from the cell it is aimed at: which way a wall runs or whether it is a ring
 *  (1.177), and the cells further copies are set down on (1.178). */
export interface RulesetAreaLay {
  toward?: RulesetCombatCell;
  ring?: boolean;
  also?: readonly RulesetCombatCell[];
  /** Cells more of size, for a higher cost it was paid with (1.267). */
  grow?: number;
}

/** The cells an area aimed at `at` covers, every copy of it included, each cell once. */
export function rulesetAimedCells(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  at: RulesetCombatCell,
  lay?: RulesetAreaLay,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  const actor = rulesetCombatant(state, actorId);
  const action = actor ? actionOf(actor, optionId) : undefined;
  const from = rulesetPositionOf(actor);
  if (!grid || !actor || !action?.area || !from) return [];
  const area = action.area;
  // Around the props with its label (1.331), wherever it was aimed: every cell within its size of
  // one, behind them too.
  if (area.aroundProp) {
    const named = area.aroundProp;
    const props = (state.board?.props ?? [])
      .filter((prop) => prop.health > 0 && rulesetPropNamed(prop, named))
      .flatMap((prop) => prop.cells);
    const reach = Math.max(1, Math.round(area.size));
    const cells: RulesetCombatCell[] = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (props.some((cell) => rulesetCellDistance(cell, { x, y }) <= reach)) cells.push({ x, y });
      }
    }
    return cells;
  }
  // Laid from whichever cell the actor fills nearest the aim (1.194).
  const one = (aim: RulesetCombatCell) => {
    const origin = rulesetNearestCell(actor, aim) ?? from;
    return area.shape === "wall"
      ? rulesetWallShape(grid, area, aim, origin, lay?.toward, undefined, lay?.ring).cells
      : rulesetAreaCells(area.shape, area.size + (lay?.grow ?? 0), origin, aim, grid, area.width);
  };
  const cells = new Map<string, RulesetCombatCell>();
  for (const aim of [at, ...(lay?.also ?? [])]) {
    for (const cell of one(aim)) cells.set(`${cell.x},${cell.y}`, cell);
  }
  return [...cells.values()];
}

/**
 * Whether further copies of an area may be set down where `also` says (1.178): as many as its
 * `copies` allows, each on a cell it may be aimed at, none twice, and each one's cells touching the
 * cells of those set down before it, as Fire Storm's cubes each touch another.
 */
export function rulesetCopiesLegal(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  at: RulesetCombatCell,
  also: readonly RulesetCombatCell[],
): boolean {
  const actor = rulesetCombatant(state, actorId);
  const area = actor ? actionOf(actor, optionId)?.area : undefined;
  if (!area?.copies || also.length > area.copies - 1) return false;
  const aims = new Set([`${at.x},${at.y}`]);
  let placed = rulesetAimedCells(state, actorId, optionId, at);
  for (const aim of also) {
    if (!rulesetAimLegal(state, actorId, optionId, aim)) return false;
    const key = `${aim.x},${aim.y}`;
    if (aims.has(key)) return false;
    aims.add(key);
    const cells = rulesetAimedCells(state, actorId, optionId, aim);
    // Near enough another's middle (1.301), or touching the cells of those before it.
    if (area.copiesWithin !== undefined) {
      const near = [at, ...also.slice(0, also.indexOf(aim))];
      if (!near.some((other) => rulesetCellDistance(aim, other) <= area.copiesWithin!)) return false;
    } else if (!cells.some((cell) => placed.some((other) => rulesetCellDistance(cell, other) <= 1))) return false;
    placed = [...placed, ...cells];
  }
  return true;
}

/** Everybody standing in the cells an area aimed at this one would cover. Friend and foe alike,
 *  unless the entry said its own side is left out. */
export function rulesetAreaTargets(
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  at: RulesetCombatCell,
  /** How it is laid from `at` (1.177, 1.178): which way a wall runs, a ring, further copies. */
  lay?: RulesetAreaLay,
): string[] {
  const actor = rulesetCombatant(state, actorId);
  const action = actor ? actionOf(actor, optionId) : undefined;
  if (!actor || !action?.area) return [];
  const covered = new Set(rulesetAimedCells(state, actorId, optionId, at, lay).map((cell) => `${cell.x},${cell.y}`));
  return state.combatants
    .filter((combatant) => {
      if (combatant.defeated) return false;
      if (action.area?.friendlyFire === false && combatant.side === actor.side) return false;
      // Something that MENDS lands only on whom its author pointed it at. A blast catches everybody
      // in its cells because fire does not ask; a healing word that also closed the enemy's wounds
      // would be the rules being read by a machine rather than by a table.
      if (action.heal) {
        const sameSide = combatant.side === actor.side;
        if (action.targets.side === "self" && combatant.id !== actor.id) return false;
        if (action.targets.side === "ally" && !sameSide) return false;
        if (action.targets.side === "enemy" && sameSide) return false;
      }
      // Caught by any cell they fill (1.194).
      return rulesetFootprint(combatant).some((cell) => covered.has(`${cell.x},${cell.y}`));
    })
    .map((combatant) => combatant.id);
}

/** Everybody a burst centred on its user catches (1.282): within its size of them on a board, and
 *  seen from where they stand unless it goes through walls; off a board, everybody. Never its user,
 *  and never its user's own side when it spares them. A mending one, only whom it mends. */
export function rulesetAroundTargets(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatant[] {
  const around = action.around;
  if (!around) return [];
  const grid = state.board?.grid;
  return state.combatants.filter((combatant) => {
    if (combatant.id === actor.id || combatant.defeated) return false;
    const sameSide = combatant.side === actor.side;
    if (around.friendlyFire === false && sameSide) return false;
    if (action.heal && !sameSide) return false;
    if (!grid) return true;
    if (!rulesetPositionOf(actor) || !rulesetPositionOf(combatant)) return false;
    if (rulesetGap(actor, combatant) > around.size) return false;
    return !!around.throughWalls || rulesetFootprintsSee(grid, actor, combatant);
  });
}

/**
 * What cover adds for this combatant against something coming from `from` (combat C6a-2): half
 * cover's bonus, or three-quarters' when the ruleset has one, graded by corner lines from `from`.
 * Against an attack, ground worth something as cover under the target is at least half, as it was
 * before cover had degrees; a save is helped only by what lies between it and the effect, since cover
 * counts against an effect from its other side. Nothing without a board, a position or a cover rule.
 */
export function rulesetCoverBonus(
  combat: RulesetCombat,
  state: RulesetEncounterState,
  target: RulesetCombatant,
  from: RulesetCombatCell | null,
  against: "attack" | "save" = "attack",
  /** Who it comes from, whose own cells never screen it (1.194). */
  attackerId?: string,
): number {
  const cover = combat.cover;
  const grid = state.board?.grid;
  const at = rulesetPositionOf(target);
  if (!cover || !grid || !at) return 0;
  // Somebody standing in the way is half cover, friend or foe, when the ruleset says so.
  const screens = cover.creatures
    ? new Set(
        state.combatants
          .filter((one) => one.id !== target.id && one.id !== attackerId && rulesetCombatStanding(one))
          // Every cell they fill (1.194).
          .flatMap((one) => rulesetFootprint(one).map((cell) => `${cell.x},${cell.y}`)),
      )
    : undefined;
  // Somebody bigger than one cell is as covered as the least covered cell they fill (1.194), from
  // whichever cell of the attacker's is nearest it.
  const order = ["none", "half", "three-quarters", "total"] as const;
  let tier: (typeof order)[number] = "none";
  let ground = false;
  if (from) {
    let best = -1;
    for (const cell of rulesetFootprint(target)) {
      const origin = attackerId ? (rulesetNearestCell(rulesetCombatant(state, attackerId), cell) ?? from) : from;
      const here = order.indexOf(coverTier(grid, origin, cell, screens) as (typeof order)[number]);
      const groundHere = rulesetCellCover(grid, cell) > 0;
      if (best < 0 || here < best || (here === best && ground && !groundHere)) {
        best = here;
        ground = groundHere;
      }
    }
    tier = order[Math.max(0, best)]!;
  } else {
    ground = rulesetCellCover(grid, at) > 0;
  }
  if (tier === "three-quarters" || tier === "total") return cover.threeQuarters ?? cover.bonus;
  return tier === "half" || (against === "attack" && ground) ? cover.bonus : 0;
}

/** Whether one combatant stands on higher ground than another (combat C6b). Never without a board. */
export function rulesetAbove(
  state: RulesetEncounterState,
  actor: RulesetCombatant | undefined,
  target: RulesetCombatant,
): boolean {
  const grid = state.board?.grid;
  const from = rulesetPositionOf(actor);
  const at = rulesetPositionOf(target);
  // A flier is as high as it flies (1.114).
  return !!grid && !!actor && !!from && !!at && rulesetLevelOf(grid, actor) > rulesetLevelOf(grid, target);
}

/**
 * What an attack against this combatant is rolled against: their own defense, plus the cover between
 * them and the one attacking, when the ruleset says cover adds anything, less what striking down from
 * higher ground is worth when the ruleset gives it a number (combat C6b).
 *
 * One answer, so a forecast and the roll that follows it can never disagree about the number.
 */
export function rulesetDefenseAgainst(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  target: RulesetCombatant,
  attacker: RulesetCombatant | undefined,
  /** The blow itself, where one weapon ignores cover against this target (1.189). */
  action?: RulesetCombatAction,
): { defense: number; cover: number; guards: RulesetConditionBonus[] } {
  // What the target's own conditions add. Defense is never rolled, so each is its flat number.
  const guards = rulesetConditionModifiers(definition, combat, target, "defense", state).map(
    ({ condition, level, derived, item, modifier }) => ({
      condition,
      ...(level !== undefined ? { level } : {}),
      ...(derived ? { derived } : {}),
      ...(item ? { item } : {}),
      value: modifier.flat ?? 0,
    }),
  );
  // What a dropped item gave it is gone with it (1.266): a shield let fall.
  let lost = 0;
  if (target.heldDefense && target.dropped?.length) {
    for (const index of rulesetDroppedItems(target)) lost += target.heldDefense[index] ?? 0;
  }
  lost += rulesetDroppedHeldDefense(target);
  const defense = target.defense - lost + guards.reduce((total, guard) => total + guard.value, 0);
  const ignored = rulesetAgainstHere(definition, action, target, attacker).some((entry) => entry.ignoresCover);
  const cover = ignored
    ? 0
    : rulesetCoverBonus(combat, state, target, rulesetPositionOf(attacker), "attack", attacker?.id);
  const highGround = combat.elevation?.highGround;
  const above = typeof highGround === "object" && rulesetAbove(state, attacker, target) ? highGround.bonus : 0;
  return { defense: defense + cover - above, cover, guards };
}

/** What conditions add to one roll, as a forecast reads it: the flat part, and every die with the
 *  sign it is added with. */
export interface RulesetBonusDice {
  flat: number;
  dice: Array<{ count: number; sides: number; sign: 1 | -1 }>;
}

export function rulesetBonusDice(modifiers: readonly RulesetConditionModifier[]): RulesetBonusDice {
  const bonus: RulesetBonusDice = { flat: 0, dice: [] };
  for (const { modifier } of modifiers) {
    bonus.flat += modifier.flat ?? 0;
    const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
    if (!dice) continue;
    const sign = modifier.minus ? -1 : 1;
    if (dice.count > 0) bonus.dice.push({ count: dice.count, sides: dice.sides, sign });
    bonus.flat += sign * dice.flat;
  }
  return bonus;
}

/** How likely each amount the bonus comes to is, as [amount, share] pairs. Null past the size a
 *  forecast works out exactly. */
function bonusDistribution(bonus: RulesetBonusDice | undefined): Array<[number, number]> | null {
  let shares = new Map<number, number>([[bonus?.flat ?? 0, 1]]);
  for (const die of bonus?.dice ?? []) {
    const faces = diceDistribution(die.count, die.sides);
    if (!faces) return null;
    const next = new Map<number, number>();
    for (const [amount, share] of shares) {
      for (let total = 0; total < faces.length; total++) {
        const chance = faces[total]!;
        if (chance === 0) continue;
        const key = amount + die.sign * total;
        next.set(key, (next.get(key) ?? 0) + share * chance);
      }
    }
    shares = next;
  }
  return [...shares];
}

export interface RulesetCombatCost {
  steps: Array<{ op: RulesetSheetOp; label: string }>;
  /** The live state the price leaves behind, or null when there was nothing on a sheet to pay. */
  live: RulesetLiveState | null;
  cost: Array<{ pool: string; label: string; amount: number }>;
}

/**
 * What an ability costs this member right now, or null when they cannot pay it. The price itself is
 * the sheet's own `use` command (`planRulesetUse`), applied to a working copy: the menu therefore
 * offers exactly what the sheet would accept, and nothing is spent by asking.
 *
 * `payWith` is the upcast, under the `use` command's own rule: one price, paid out of another pool
 * of the same family.
 */
export function planRulesetCombatCost(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
  payWith?: string,
  /** How many uses, where its user chooses (1.251). */
  count?: number,
): RulesetCombatCost | null {
  const free: RulesetCombatCost = { steps: [], live: null, cost: [] };
  // More of an item's charges is the item's to spend (1.269), never a pool's.
  if (rulesetChargeSteps(action, payWith) !== null) payWith = undefined;
  // Paid already, as it was readied (1.288).
  if (rulesetUseIsFree(combatant.id, action.id)) return free;
  // An opponent's actions cost nothing off a sheet: their block is the only bookkeeping there is.
  if (action.innate || !combatant.sheet) return payWith ? null : free;
  const { build, catalogs } = combatant.sheet;
  if (!action.use) return payWith ? null : free;
  const plan = planRulesetUse(
    definition,
    build,
    combatant.sheet.live,
    catalogs,
    { op: "use", name: action.use.name, ...(payWith ? { pool: payWith } : {}) },
    count ?? action.use.count,
    action.restore?.pool,
    action.use.usesOf,
  );
  if (!plan.ok) return null;
  let live = combatant.sheet.live;
  const cost: RulesetCombatCost["cost"] = [];
  for (const step of plan.steps) {
    const result = applyRulesetSheetOp(definition, build, live, step.op);
    if (!result.ok) return null;
    live = result.live;
    if (step.op.op === "spend") cost.push({ pool: step.op.pool, label: step.label, amount: step.op.amount });
  }
  // A pool the ruleset limits per turn or round cannot pay past what is left of that limit, however
  // much is in it.
  if (!rulesetWithinSpendLimits(combatant, cost)) return null;
  return { steps: plan.steps, live, cost };
}

/** The most uses its user may choose to spend on it right now (1.251): Lay on Hands' points left.
 *  Zero when it cannot be paid at all. */
export function rulesetChosenUsesMax(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
): number {
  // Whatever pays for some uses pays for fewer, so the most is found by halving the range.
  let low = 0;
  let high = 1000;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (planRulesetCombatCost(definition, combatant, action, undefined, mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Whether paying this would stay inside every limit on what the combatant may spend this turn or
 *  round. A pool nothing limits is free to spend however it may. */
export function rulesetWithinSpendLimits(
  combatant: RulesetCombatant,
  cost: ReadonlyArray<{ pool: string; amount: number }>,
): boolean {
  if (!combatant.limits) return true;
  const paying = new Map<string, number>();
  for (const entry of cost) paying.set(entry.pool, (paying.get(entry.pool) ?? 0) + entry.amount);
  for (const [pool, amount] of paying) {
    const limit = combatant.limits[pool];
    if (limit && limit.spent + amount > limit.max) return false;
  }
  return true;
}

/** Count what a payment spent against the combatant's limits, once it has been made. */
export function countRulesetSpend(
  combatant: RulesetCombatant,
  cost: ReadonlyArray<{ pool: string; amount: number }>,
): void {
  for (const entry of cost) {
    const limit = combatant.limits?.[entry.pool];
    if (limit) limit.spent += entry.amount;
  }
}

/** The pools of one family, in the order the ruleset declared them. The order is the ladder a
 *  higher payment climbs, which is what makes "one step up" a number. */
export function rulesetPoolFamily(definition: RulesetDefinition, group: string | undefined): string[] {
  if (!group) return [];
  return definition.sheet.live.pools.filter((pool) => pool.group === group).map((pool) => pool.id);
}

/**
 * The level of what an action was paid with (Capability API 1.116): the pool's own `level` when it
 * says one, read off its holder's sheet, else its place in its group, the first pool being 1. A
 * pool in no group, and an action that costs nothing, is level 0: a cantrip.
 */
export function rulesetPaidLevel(
  definition: RulesetDefinition,
  combatant: Pick<RulesetCombatant, "sheet">,
  action: RulesetCombatAction,
  payWith?: string,
): number {
  if (action.innate) return action.innate.level;
  const id = payWith ?? action.use?.pool;
  if (!id) return 0;
  const pool = definition.sheet.live.pools.find((entry) => entry.id === id);
  if (pool?.level) {
    return combatant.sheet
      ? Math.max(0, Math.trunc(resolveRulesetValueRef(definition, combatant.sheet.build, pool.level)))
      : 0;
  }
  const family = rulesetPoolFamily(definition, pool?.group ?? action.use?.group);
  const at = family.indexOf(id);
  return at < 0 ? 0 : at + 1;
}

/** How many steps up the family a payment is, or 0 when it is not a climb at all. A pool of
 *  another group that pays for this one (`pays`, 1.171) climbs as far as its level is above the
 *  action's, read off the payer's sheet. */
export function rulesetCostSteps(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  payWith: string,
  combatant?: Pick<RulesetCombatant, "sheet">,
): number {
  // More of an item's charges (1.269): a step each.
  const charged = rulesetChargeSteps(action, payWith);
  if (charged !== null) return charged;
  const family = rulesetPoolFamily(definition, action.use?.group);
  const from = family.indexOf(action.use?.pool ?? "");
  const to = family.indexOf(payWith);
  // Past its most, paying more adds nothing (1.241).
  const most = action.use?.stepsMax ?? Infinity;
  if (to < 0 && from >= 0 && combatant && rulesetPoolPaysFor(definition, payWith, action.use?.group)) {
    return Math.min(
      most,
      Math.max(
        0,
        rulesetPaidLevel(definition, combatant, action, payWith) - rulesetPaidLevel(definition, combatant, action),
      ),
    );
  }
  return from >= 0 && to > from ? Math.min(most, to - from) : 0;
}

/** The more charges an item's use may be paid with now (1.269): one to as many as its step allows
 *  and the item still holds beyond the use's own. */
function chargePayments(actor: RulesetCombatant, action: RulesetCombatAction): string[] {
  const charges = action.itemUse?.charges;
  if (!charges?.step) return [];
  const spare = rulesetItemUseLeft(actor, action.itemUse!) - charges.cost;
  return Array.from(
    { length: Math.max(0, Math.min(charges.step.max, spare)) },
    (_, index) => `${RULESET_CHARGE_STEP_PREFIX}${index + 1}`,
  );
}

/** Whether a pool of another group may pay for this group's costs (1.171). */
export function rulesetPoolPaysFor(definition: RulesetDefinition, pool: string, group: string | undefined): boolean {
  if (!group) return false;
  return definition.sheet.live.pools.find((entry) => entry.id === pool)?.pays?.includes(group) === true;
}

/**
 * The other pools that could pay for an action right now: the higher pools of its own family, in
 * the order the ruleset declared them, then the pools of other groups that pay for it (`pays`,
 * 1.171) at a level no lower than its own. Each is one the sheet would accept the price from.
 */
export function rulesetPaymentPools(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
): string[] {
  const group = action.use?.group;
  const family = rulesetPoolFamily(definition, group);
  const from = family.indexOf(action.use?.pool ?? "");
  if (from < 0) return [];
  const base = rulesetPaidLevel(definition, combatant, action);
  const others = definition.sheet.live.pools
    .filter((pool) => pool.group !== group && pool.pays?.includes(group!))
    .filter((pool) => rulesetPaidLevel(definition, combatant, action, pool.id) >= base)
    .map((pool) => pool.id);
  return [...family.slice(from + 1), ...others].filter(
    (pool) => planRulesetCombatCost(definition, combatant, action, pool) !== null,
  );
}

/** How many targets an action takes when paid for this way: one more for each step of a higher cost
 *  by its `targetsPerCostStep` (1.171), up to 20. */
export function rulesetPaidTargetCount(
  definition: RulesetDefinition,
  combatant: Pick<RulesetCombatant, "sheet">,
  action: RulesetCombatAction,
  payWith: string | undefined,
): number {
  const per = action.use?.targetsPerStep ?? action.itemUse?.charges?.step?.targets;
  if (!per || payWith === undefined || action.targets.count <= 0) return action.targets.count;
  return Math.min(20, action.targets.count + per * rulesetCostSteps(definition, action, payWith, combatant));
}

// ── Forecasts ──

/** How much of the dice a sum leaves above a number, computed exactly for the dice a fight rolls
 *  and skipped for a handful too large to count, so a forecast never costs a turn its time. */
function chanceAtLeast(count: number, sides: number, need: number): number | null {
  // Certain either way whatever the dice, so no distribution is needed to say so.
  if (need <= count) return 1;
  if (need > count * sides) return 0;
  const distribution = diceDistribution(count, sides);
  if (!distribution) return null;
  return distribution.slice(need).reduce((total, share) => total + share, 0);
}

/** How likely each total of these dice is, indexed by the total. Null past the size a forecast works
 *  out exactly, which no ruleset's attack dice come near. */
function diceDistribution(count: number, sides: number): number[] | null {
  if (count * sides > 400) return null;
  let distribution = [1];
  for (let die = 0; die < count; die++) {
    const next = new Array<number>(distribution.length + sides).fill(0);
    for (let sum = 0; sum < distribution.length; sum++) {
      const share = distribution[sum]!;
      if (share === 0) continue;
      for (let facing = 1; facing <= sides; facing++) next[sum + facing] = next[sum + facing]! + share / sides;
    }
    distribution = next;
  }
  return distribution;
}

/** The check one side of a contest rolls: the best of the ones the contest lets that side use, and
 *  its id, the first of equal ones. What a combatant does not have reads as zero. */
export function rulesetContestCheck(
  combatant: RulesetCombatant,
  contest: RulesetCombatContest,
  side: "attacker" | "defender",
): { check: string; modifier: number } {
  // A hold that names the checks that break it (1.175) is broken with those.
  const named =
    side === "attacker" && contest.from
      ? combatant.tracked.find((entry) => entry.condition === contest.from)?.escapeChecks
      : undefined;
  const checks = named ?? contest[side];
  let best = { check: checks[0]!, modifier: combatant.checks?.[checks[0]!] ?? 0 };
  for (const check of checks.slice(1)) {
    const modifier = combatant.checks?.[check] ?? 0;
    if (modifier > best.modifier) best = { check, modifier };
  }
  return best;
}

/** The share of contests the actor would win against this target: both sides throw the fight's own
 *  attack dice, twice with one kept where a condition says so, and add their check and whatever their
 *  conditions add; the higher total wins, and a tie goes where the contest says. */
export function rulesetContestChance(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  contest: RulesetCombatContest,
  state?: RulesetEncounterState,
): number | null {
  const mine = contestTotals(definition, combat, actor, rulesetContestCheck(actor, contest, "attacker"), state);
  // Breaking free of a hold that names its escape DC is a roll against that number, which the
  // actor meets to win (1.103).
  const escapeDc = rulesetEscapeDc(actor, contest);
  if (mine && escapeDc !== undefined) {
    return mine.reduce((win, [total, chance]) => (total >= escapeDc ? win + chance : win), 0);
  }
  const theirs = contestTotals(definition, combat, target, rulesetContestCheck(target, contest, "defender"), state);
  if (!mine || !theirs) return null;
  let win = 0;
  for (const [attacker, pMine] of mine) {
    for (const [defender, pTheirs] of theirs) {
      const margin = attacker - defender;
      if (margin > 0 || (margin === 0 && contest.ties === "attacker")) win += pMine * pTheirs;
    }
  }
  return win;
}

/** How likely each total one side of a contest reaches is. */
function contestTotals(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  check: { check?: string; modifier: number },
  state: RulesetEncounterState | undefined,
): Array<[number, number]> | null {
  // What is narrowed to the ability the check is made with counts (1.188).
  const ability = rulesetCheckAbility(definition, check.check);
  const modifiers = rulesetConditionModifiers(
    definition,
    combat,
    combatant,
    "checks",
    state,
    undefined,
    undefined,
    ability,
  );
  const mode = rulesetCheckMode(definition, combat, combatant, state, undefined, ability);
  if (rulesetCombatIsPool(combat)) {
    // A side's pool is its check, what its conditions add as dice, and its wound penalty.
    const bonus = rulesetBonusDice(modifiers);
    const dice = check.modifier + bonus.flat + rulesetCombatPenalty(definition, combatant);
    return rulesetPoolDistribution(definition, dice, mode);
  }
  const { count, sides } = combat.attackRoll!.dice;
  const thrown = keptDistribution(count, sides, mode);
  const bonus = bonusDistribution(rulesetBonusDice(modifiers));
  if (!thrown || !bonus) return null;
  const totals = new Map<number, number>();
  for (let sum = 0; sum < thrown.length; sum++) {
    const share = thrown[sum]!;
    if (share === 0) continue;
    for (const [amount, chance] of bonus) {
      const key = sum + check.modifier + amount;
      totals.set(key, (totals.get(key) ?? 0) + share * chance);
    }
  }
  return [...totals];
}

/** The dice's own distribution, or that of the better or worse of two throws of them. */
function keptDistribution(count: number, sides: number, mode: RulesetCombatRollMode): number[] | null {
  const single = diceDistribution(count, sides);
  if (!single || mode === "normal") return single;
  const kept = new Array<number>(single.length).fill(0);
  let below = 0;
  for (let sum = 0; sum < single.length; sum++) {
    const atMost = below + single[sum]!;
    // The better of two is at most `sum` exactly when both are; the worse is at least `sum` exactly
    // when both are.
    kept[sum] = mode === "advantage" ? atMost ** 2 - below ** 2 : (1 - below) ** 2 - (1 - atMost) ** 2;
    below = atMost;
  }
  return kept;
}

/** What breaking free is rolled against, when what holds the actor names it (1.103). Only a summed
 *  fight has one: the schema refuses it in a pool fight. */
export function rulesetEscapeDc(actor: RulesetCombatant, contest: RulesetCombatContest): number | undefined {
  if (!contest.from) return contest.difficulty;
  return actor.tracked.find((entry) => entry.condition === contest.from)?.escapeDc;
}

/** Whoever holds this actor by the condition a breaking-free contest names, when they are still in
 *  the fight to be broken free from. */
export function rulesetContestHolder(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  contest: RulesetCombatContest,
): RulesetCombatant | undefined {
  if (!contest.from) return undefined;
  const hold = actor.tracked.find((entry) => entry.condition === contest.from);
  // Only a hold that names an escape DC is broken by an `escapable` contest (1.175).
  if (contest.escapable && hold?.escapeDc === undefined) return undefined;
  const source = hold?.source;
  const holder = source === undefined ? undefined : rulesetCombatant(state, source);
  return holder && !holder.defeated ? holder : undefined;
}

/** The share of attack rolls that would land. Exact, because the extreme faces of a single die can
 *  decide a roll on their own and a forecast that ignored them would disagree with the resolution. */
export function rulesetHitChance(
  combat: RulesetCombat,
  toHit: number,
  defense: number,
  mode: RulesetCombatRollMode = "normal",
  /** What the attacker's conditions add on top of the dice, rolled once whichever throw is kept. */
  bonus?: RulesetBonusDice,
  /** The lowest natural face that is a critical for this attacker (1.81), which always lands. */
  criticalFrom?: number,
): number | null {
  if (bonus && (bonus.flat !== 0 || bonus.dice.length > 0)) {
    const shares = bonusDistribution(bonus);
    if (!shares) return null;
    let chance = 0;
    for (const [amount, share] of shares) {
      const one = rulesetHitChance(combat, toHit + amount, defense, mode, undefined, criticalFrom);
      if (one === null) return null;
      chance += share * one;
    }
    return chance;
  }
  // A pool fight's chance is `rulesetPoolChance`'s, which needs the ruleset's own die to count.
  if (!combat.attackRoll) return null;
  const { dice, naturals } = combat.attackRoll;
  let single: number | null = null;
  if (dice.count === 1) {
    let hits = 0;
    const landsFrom =
      naturals.max === "critical" ? Math.max(2, Math.min(dice.sides, criticalFrom ?? dice.sides)) : dice.sides;
    for (let facing = 1; facing <= dice.sides; facing++) {
      if (facing >= landsFrom && naturals.max !== "none") hits += 1;
      else if (facing === 1 && naturals.min === "miss") continue;
      else if (facing + toHit >= defense) hits += 1;
    }
    single = hits / dice.sides;
  } else {
    single = chanceAtLeast(dice.count, dice.sides, defense - toHit);
  }
  if (single === null) return null;
  // Two independent sets, one of them kept: the good one lands unless both would miss.
  if (mode === "advantage") return 1 - (1 - single) ** 2;
  if (mode === "disadvantage") return single ** 2;
  return single;
}

// ── The menu ──

/** Whether the actor's own conditions stop them doing anything at all. */
function blocked(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  return rulesetCombatEffects(definition, combat, actor, state).has("cannot-act");
}

/** Whom an entry used once a creature until a rest (1.304) went to already: names, as a fight
 *  outlives its combatants' ids, kept on a sheet's live state so they last until that rest, and on
 *  the combatant for one without a sheet. */
export function rulesetUsedOn(
  actor: RulesetCombatant,
  action: Pick<RulesetCombatAction, "id" | "entry" | "oncePerTarget">,
): string[] {
  if (!action.oncePerTarget) return [];
  const key = rulesetUsedOnKey(action);
  return (actor.sheet ? actor.sheet.live.usedOn?.[key] : actor.usedOn?.[key]) ?? [];
}

/** Keyed by the entry it was built from, which outlasts the fight's action ids. */
export function rulesetUsedOnKey(action: Pick<RulesetCombatAction, "id" | "entry" | "oncePerTarget">): string {
  return `${action.oncePerTarget!.until}|${action.entry ?? action.id}`;
}

export function rulesetUsedOnName(combatant: Pick<RulesetCombatant, "name">): string {
  return normalizeCharacterLookupName(combatant.name);
}

/** Whether a name is borne by nobody else in this fight (1.308): only then does it say who is meant. */
function usedOnNameUnique(state: RulesetEncounterState, combatant: RulesetCombatant): boolean {
  const name = rulesetUsedOnName(combatant);
  return !state.combatants.some((other) => other.id !== combatant.id && rulesetUsedOnName(other) === name);
}

/** How a combatant is written down as used on (1.308): by name and id, so a second creature of the
 *  same name is not taken for the first, and by name alone too while nobody else in the fight bears
 *  it, which is what a later fight knows them by. */
export function rulesetUsedOnMarks(state: RulesetEncounterState, combatant: RulesetCombatant): string[] {
  const name = rulesetUsedOnName(combatant);
  const own = `${name}#${combatant.id}`.slice(0, 200);
  return usedOnNameUnique(state, combatant) ? [own, name] : [own];
}

/** Whether a list of marks means this combatant (1.308): by its name and id, or by a name only it
 *  bears in this fight. Two of one name in a fight are told apart, and neither is taken for one met
 *  under that name before. */
export function rulesetUsedOnMeans(
  state: RulesetEncounterState,
  used: readonly string[],
  combatant: RulesetCombatant,
): boolean {
  const name = rulesetUsedOnName(combatant);
  if (used.includes(`${name}#${combatant.id}`.slice(0, 200))) return true;
  return used.includes(name) && usedOnNameUnique(state, combatant);
}

/** Whoever this combatant may not point anything at: the source of a condition on them that says
 *  so. A charm keeps a character from turning on whoever charmed them, in the ruleset's own words. */
export function rulesetForbiddenTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): Set<string> {
  const combat = definition.combat;
  const forbidden = new Set<string>();
  if (!combat) return forbidden;
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    const source = actor.tracked.find((tracked) => tracked.condition === entry.condition)?.source;
    if (source && entry.effects.includes("cannot-target-source")) forbidden.add(source);
    // Nor anybody on their side (1.278), unless it is the holder's own: a friend is not kept off.
    const by =
      source && entry.effects.includes("cannot-target-source-side") ? rulesetCombatant(state, source) : undefined;
    if (by && by.side !== actor.side) {
      for (const one of state.combatants) if (one.side === by.side) forbidden.add(one.id);
    }
  }
  // A turn the dice made a strike at one creature (1.264): nobody else.
  if (actor.flags.compelled === "strike" && actor.flags.compelledTarget) {
    for (const one of state.combatants) if (one.id !== actor.flags.compelledTarget) forbidden.add(one.id);
  }
  return forbidden;
}

/**
 * Who this option may legally be pointed at RIGHT NOW, in the order the combatants were handed in.
 *
 * One place decides it: the resolver checks a choice against this list, and a caller that draws a
 * menu sends the same list on, so a client never works out legality of its own.
 *
 * A combatant who is down can still be healed and can still be hit while they are down. Only one
 * the fight is over for is off the table.
 */
/** Whether a revive may be aimed at this one: dead, and not for longer than it reaches back (1.176).
 *  Somebody a condition took out was never killed, and no round of death is on them to measure. */
export function rulesetCanRevive(
  state: RulesetEncounterState,
  action: Pick<RulesetCombatAction, "revives">,
  combatant: RulesetCombatant,
): boolean {
  if (!action.revives || !combatant.defeated || combatant.diedRound === undefined) return false;
  return state.round - combatant.diedRound <= action.revives.withinRounds;
}

/** Whether an action that does nothing but cure has something to cure on this one (1.176): a
 *  condition it ends that they hold, or a dying they can be steadied from. One that also heals or
 *  harms or puts something on is aimed as that says. */
function rulesetCureReaches(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): boolean {
  // A contest that treats somebody (1.193) is taken only on whoever has what it treats.
  const contest = action.contest;
  if (contest?.targetHolds && !combatant.tracked.some((entry) => entry.condition === contest.targetHolds)) return false;
  if (contest?.targetDying && !(combatant.dying && !combatant.stable && !combatant.defeated)) return false;
  // A track moved down or sealed health given back cures too (1.201); one moved up harms.
  const lowers = action.tracks?.filter((entry) => entry.by < 0) ?? [];
  if (!action.ends && !action.stabilizes && !lowers.length && !action.unseals) return true;
  if (action.damage || action.heal || action.temporary || action.restore || action.applies?.length) return true;
  if (action.tracks?.some((entry) => entry.by > 0)) return true;
  if (action.unseals && rulesetSealedHealth(definition, combatant) > 0) return true;
  if (lowers.some((entry) => rulesetTrackAboveFloor(definition, combatant, entry.track))) return true;
  if (action.revives || action.save || action.contest || action.summons || action.zone) return true;
  if (action.stabilizes && combatant.dying && !combatant.stable && !combatant.defeated) return true;
  const ends = new Set(action.ends?.conditions ?? []);
  return combatant.tracked.some(
    (entry) => ends.has(entry.condition) && rulesetPutOnBy(definition, state, entry, action.ends?.from),
  );
}

/** Whether a creature that is `from` put this on (1.236); anything does without a test. One whose
 *  maker is not in the fight was put on by nobody it can name. */
export function rulesetPutOnBy(
  definition: RulesetDefinition,
  state: RulesetEncounterState | undefined,
  entry: RulesetTrackedCondition,
  from: RulesetTargetIs | undefined,
): boolean {
  if (!from) return true;
  const source = entry.source && state ? rulesetCombatant(state, entry.source) : undefined;
  return !!source && rulesetTargetIs(definition, source, from);
}

/** Whether this one holds a condition an action names (1.235): one of `conditions` from anybody, or
 *  one of `fromSelf` that the actor put on them. */
function rulesetHoldsFor(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  actorId: string,
  holds: NonNullable<RulesetCombatAction["targetHolds"]>,
): boolean {
  const held = rulesetCombatConditions(definition, combatant);
  if (holds.conditions?.some((condition) => held.includes(condition))) return true;
  return !!holds.fromSelf?.some((condition) =>
    combatant.tracked.some((entry) => entry.condition === condition && entry.source === actorId),
  );
}

/** What only a rest would give back to this one (1.193). */
function rulesetSealedHealth(definition: RulesetDefinition, combatant: RulesetCombatant): number {
  if (!combatant.sheet) return combatant.health?.sealed ?? 0;
  const health = definition.combat?.health;
  if (!health || "track" in health) return 0;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  return live.pools.find((entry) => !entry.listId && entry.key === health.pool)?.sealed ?? 0;
}

/** Whether this one stands above the bottom of a live track, so there is a level to take off. */
function rulesetTrackAboveFloor(definition: RulesetDefinition, combatant: RulesetCombatant, track: string): boolean {
  const declared = definition.sheet.live.tracks.find((entry) => entry.id === track);
  if (!declared) return false;
  if (!combatant.sheet) return (combatant.tracks?.[track] ?? declared.default ?? declared.min) > declared.min;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  const now = live.tracks.find((entry) => entry.id === track);
  return !!now && now.value > now.min;
}

export function rulesetOptionTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  /** `range` is a weapon mode's own (1.190). */
  option: { id: string; targets: RulesetCombatAction["targets"]; range?: { normal: number; long?: number } },
  ignoreRange = false,
): string[] {
  const actor = rulesetCombatant(state, actorId);
  if (!actor || option.targets.count <= 0) return [];
  // An area is aimed at a CELL, so nobody is named: which combatants it catches follows from where
  // it lands, and `rulesetAreaTargets` is the one place that answers it.
  if (positioned(state) && actionOf(actor, option.id)?.area) return [];
  const forbidden = rulesetForbiddenTargets(definition, state, actor);
  const needs = actionOf(actor, option.id)?.needs;
  const targetTypes = actionOf(actor, option.id)?.targetTypes;
  const cure = actionOf(actor, option.id);
  // Breaking free is aimed at whoever is holding on, and at nobody else.
  const contest = actionOf(actor, option.id)?.contest;
  const holder = contest?.from ? rulesetContestHolder(state, actor, contest)?.id : undefined;
  // A grab or a shove is not taken against somebody too much bigger (1.103). Whoever's size nothing
  // says is never too big.
  const combat = definition.combat;
  const actorSize = contest?.maxSizeAbove !== undefined && combat ? rulesetSizeRank(combat, actor) : undefined;
  const tooBig = (combatant: RulesetCombatant) => {
    if (actorSize === undefined || !combat) return false;
    const size = rulesetSizeRank(combat, combatant);
    return size !== undefined && size - actorSize > contest!.maxSizeAbove!;
  };
  return (
    state.combatants
      .filter((combatant) => {
        // Bringing back the dead is aimed at the dead, and only them (1.176).
        if (cure?.revives) {
          if (!rulesetCanRevive(state, cure, combatant)) return false;
        } else if (combatant.defeated) return false;
        if (cure && !rulesetCureReaches(definition, cure, combatant, state)) return false;
        if (!rulesetTargetHasSenses(definition, state, combatant, needs, actionOf(actor, option.id)?.needsAny))
          return false;
        // Only somebody at no health and still alive (1.311): Consume Life.
        if (cure?.dyingOnly && !(combatant.down && !combatant.defeated)) return false;
        // Only somebody who has taken their turn this round (1.327): the Hour Bell.
        if (cure?.actedOnly && !rulesetActedThisRound(state, combatant.id)) return false;
        // "A creature you can see" (1.178).
        if (cure?.seen && !rulesetCanSee(definition, state, actor, combatant)) return false;
        // Only on somebody holding what it names (1.235): grappled by its maker, or restrained.
        if (cure?.targetHolds && !rulesetHoldsFor(definition, combatant, actor.id, cure.targetHolds)) return false;
        // Behind a ward it cannot reach (1.179). One that may be paid higher is offered, and its
        // payment decides when it is used.
        if (cure && !cure.use?.group && rulesetWarded(definition, state, actor, cure, combatant)) return false;
        if (!rulesetTargetTypesAllow(definition, combatant, targetTypes)) return false;
        // No bigger than it holds (1.314).
        if (cure?.targetsUpTo && combat?.sizes) {
          const most = combat.sizes.order.findIndex((size) => size.id === cure.targetsUpTo);
          const size = rulesetSizeRank(combat, combatant);
          if (size !== undefined && size > most) return false;
        }
        // A sphere between them (1.314), but for what breaks it, aimed at the one inside.
        if (rulesetSealedApart(definition, state, actor, combatant)) {
          const sealed = rulesetSealed(definition, combatant, state);
          if (!(sealed && cure?.entry && sealed.brokenBy?.includes(cure.entry))) return false;
        }
        if (option.id.startsWith("summon:") && !rulesetCombatStanding(combatant)) return false;
        // Breaking free is aimed at whoever holds on, on either side: a web an ally spun catches
        // friends too, and the hold is what is broken, not the one who made it.
        if (contest?.from) return combatant.id === holder && !forbidden.has(combatant.id);
        if (tooBig(combatant)) return false;
        // Whoever put a condition on this actor that says they may not be pointed at.
        if (forbidden.has(combatant.id)) return false;
        // Nor anybody hidden from them (1.287): where they are is not known.
        if (rulesetHiddenFrom(actor, combatant)) return false;
        // Helping yourself is not help.
        // Read the NAME rather than the id: the same standard action is also offered bought with
        // another budget, as `standard:help@bonus`, and nobody helps themselves whichever they took.
        if (rulesetStandardName(option.id) === "help" && combatant.id === actor.id) return false;
        // "One creature other than you" (1.256).
        if (cure?.notSelf && combatant.id === actor.id) return false;
        // A repeat never at one that saved against the cast (1.310), or only at whom it was aimed at.
        if (cure?.again?.notSaved && actor.concentrating?.saved?.includes(combatant.id)) return false;
        if (cure?.again?.sameTargets && !actor.concentrating?.targets?.includes(combatant.id)) return false;
        // Used on them already since the rest that frees it (1.304).
        if (cure?.oncePerTarget && rulesetUsedOnMeans(state, rulesetUsedOn(actor, cure), combatant)) return false;
        if (option.targets.side === "self") return combatant.id === actor.id;
        // A strike the dice aimed (1.264) is at whoever they picked, friend or foe.
        if (actor.flags.compelled === "strike" && option.targets.side === "enemy" && combatant.id !== actor.id)
          return true;
        if (option.targets.side === "ally") return combatant.side === actor.side;
        if (option.targets.side === "enemy") return combatant.side !== actor.side;
        // An area named off a board (1.192) catches either side, but never the one who made it.
        if (cure?.area && combatant.id === actor.id) return false;
        return true;
      })
      // And then how far away they are, which is nothing at all in a fight without a board.
      .filter(
        (combatant) =>
          ignoreRange || rulesetTargetRefusal(state, actor.id, option.id, combatant.id, option.range) === null,
      )
      .map((combatant) => combatant.id)
  );
}

function firstTarget(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
) {
  const id = rulesetOptionTargets(definition, state, actor.id, { id: action.id, targets: action.targets })[0];
  return id === undefined ? undefined : rulesetCombatant(state, id);
}

/** An area names nobody, so a forecast reads the first combatant any legal aim would catch. Without
 *  it a shape that only ever lands on cells would promise no chance to hit at all. */
function firstAreaTarget(state: RulesetEncounterState, actor: RulesetCombatant, action: RulesetCombatAction) {
  if (!action.area || !positioned(state)) return undefined;
  const id = rulesetAimCells(state, actor.id, action.id, 1, true)[0]?.targetIds[0];
  return id === undefined ? undefined : rulesetCombatant(state, id);
}

/**
 * Whether a ward keeps this action off this target (1.179): the target stands in a zone that wards
 * off the action's catalog at its level or lower, and its maker stands outside that zone. Read at
 * the level it is paid at; without a payment, at its own.
 */
export function rulesetWarded(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  payWith?: string,
): boolean {
  const catalog = action.catalog;
  if (!catalog) return false;
  const wards = rulesetWardsOn(state, target);
  if (wards.length === 0) return false;
  const own = new Set(rulesetWardsOn(state, actor).map((ward) => ward.key));
  const paid = rulesetPaidLevel(definition, actor, action, payWith);
  // Its own base level, however it was paid (1.181): Globe of Invulnerability.
  const base = action.innate ? action.innate.baseLevel : rulesetPaidLevel(definition, actor, action);
  return wards.some(({ key, wards: ward, caster, zone }) => {
    if (own.has(key) || !ward.catalogs.includes(catalog)) return false;
    // Raised for each step the ward's own cast was paid above its base (1.181).
    const cast = caster.actions.find((entry) => entry.id === zone.actionId);
    const steps =
      !ward.maxLevelPerCostStep || !cast
        ? 0
        : cast.innate
          ? Math.max(0, cast.innate.level - cast.innate.baseLevel)
          : zone.payWith
            ? rulesetCostSteps(definition, cast, zone.payWith, caster)
            : 0;
    return (ward.by === "base" ? base : paid) <= ward.maxLevel + steps * (ward.maxLevelPerCostStep ?? 0);
  });
}

/** Uses left on this holder, or shared by its coven for this spell (1.123). */
export function rulesetActionUses(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  state?: RulesetEncounterState,
): number {
  const coven = action.innate?.coven;
  return coven
    ? (state?.covenUses?.[`${coven.id}/${action.id}`] ?? action.uses?.count ?? 0)
    : (actor.uses[action.id] ?? 0);
}

/** Whether its holder's sheet, as it stands, allows the action (1.166). A holder without a sheet, or
 *  a caller without the ruleset, has nothing to read, so nothing holds it back. */
export function rulesetActionUsable(
  definition: RulesetDefinition | undefined,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): boolean {
  return rulesetSheetWithin(definition, actor, action.usableWhen);
}

/** Whether a value off the combatant's sheet, live state and items stands within the bounds: an
 *  action's `usableWhen` (1.166), one of its conditions' `when` (1.167). No bounds, no sheet or no
 *  ruleset to read it with holds nothing back. */
export function rulesetSheetWithin(
  definition: RulesetDefinition | undefined,
  combatant: RulesetCombatant,
  bounds: RulesetSheetBounds | undefined,
): boolean {
  if (!bounds || !definition || !combatant.sheet) return true;
  const { build, live, items } = combatant.sheet;
  const value = resolveRulesetValueRef(
    definition,
    build,
    bounds.value,
    evaluateRulesetSheetLive(definition, build, live, items),
  );
  return (
    (bounds.atLeast === undefined || value >= bounds.atLeast) && (bounds.atMost === undefined || value <= bounds.atMost)
  );
}

/** A number off a combatant's own sheet as it stands now (1.274), whole, or undefined for one with
 *  no sheet to read. */
export function rulesetSheetValue(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  ref: RulesetValueRef,
): number | undefined {
  if (!combatant.sheet) return undefined;
  const { build, live, items } = combatant.sheet;
  const value = resolveRulesetValueRef(
    definition,
    build,
    ref,
    evaluateRulesetSheetLive(definition, build, live, items),
  );
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

/** Whether the action has uses left, has recharged, and has the coven members it needs nearby, and
 *  (given the ruleset) whether its holder's sheet allows it (1.166). */
export function rulesetActionAvailable(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  state?: RulesetEncounterState,
  definition?: RulesetDefinition,
): boolean {
  if (!rulesetActionUsable(definition, actor, action)) return false;
  // A strike made before a teleport (1.280) has what both of them have left.
  if (
    action.pairedWith?.some((id) => {
      const part = actor.actions.find((one) => one.id === id);
      return !part || !rulesetActionAvailable(actor, part, state, definition);
    })
  )
    return false;
  // What it is made with lies where it was dropped (1.266).
  if (rulesetActionDropped(actor, action)) return false;
  // Only in the light it says, where they stand (1.303): One with Shadows in dim light or darkness.
  if (action.usableIn) {
    const at = rulesetPositionOf(actor);
    if (!definition || !state || !at) return false;
    if (!action.usableIn.light.includes(rulesetLightAt(definition, state, at))) return false;
  }
  // Only beside a prop (1.332): Fennick's Hymnal at the Year-Wheel.
  if (action.usableNear && !(state && rulesetNearProp(state, actor, action.usableNear.prop, action.usableNear.within)))
    return false;
  // A light only while they carry one, and for nothing once a turn (1.295).
  if (action.switches && "carried" in action.switches) {
    if (!definition || !rulesetCarriesLight(definition, actor, state)) return false;
    if (action.free && actor.flags.lightSwitched) return false;
  }
  // Giving its own user back a pool they do not have is nothing (1.252): a 4th-level slot made by a
  // sorcerer with no 4th-level slots at all.
  if (action.restore && action.targets.side === "self" && actor.sheet && definition) {
    const wanted = action.restore.pool.trim().toLowerCase();
    const pools = readRulesetLive(definition, actor.sheet.build, actor.sheet.live).pools;
    if (!pools.some((pool) => pool.key === action.restore!.pool || pool.label.toLowerCase() === wanted)) return false;
  }
  // Made again only while its cast is concentrated on (1.310).
  if (action.again && !rulesetRepeatsHeld(actor, action.again)) return false;
  // Given by a condition, only while its user holds it (1.236).
  if (action.whileHolds) {
    const held = definition
      ? rulesetCombatConditions(definition, actor)
      : actor.tracked.map((entry) => entry.condition);
    if (!held.includes(action.whileHolds)) return false;
  }
  // A component something stops (1.179): Silence around its holder, a gag on them.
  if (action.components?.length && definition?.combat) {
    const stopped = rulesetActiveConditions(definition, definition.combat, actor, state).flatMap(
      (entry) => entry.forbids?.components ?? [],
    );
    if (action.components.some((component) => stopped.includes(component))) return false;
  }
  if (action.innate?.coven) {
    const coven = action.innate.coven;
    if (!state || !coven) return false;
    const from = rulesetPositionOf(actor);
    const members = state.combatants.filter((member) => {
      if (
        member.side !== actor.side ||
        !rulesetCombatStanding(member) ||
        member.block?.spellcasting?.coven?.id !== coven.id
      )
        return false;
      if (!state.board) return true;
      const to = rulesetPositionOf(member);
      return !!from && !!to && rulesetGap(actor, member) <= coven.within;
    });
    if (members.length < coven.size) return false;
  }
  if (action.uses && rulesetActionUses(actor, action, state) < 1) return false;
  // A weapon with nothing loaded or nothing to shoot, and a clip that is full or has nothing to load.
  if (!rulesetShotsAvailable(actor, action)) return false;
  // A weapon in the off hand follows an attack made this turn with another off-hand weapon.
  if (action.offHandOf !== undefined && (actor.flags.offHand ?? action.offHandOf) === action.offHandOf) return false;
  return !actor.spent.includes(action.id);
}

/** Whether a part of a sequence can happen at all: a real action of this block, not a sequence
 *  itself, not one that is bought with points, and not one that is used up or waiting for its dice.
 *  The menu, the forecast and the resolution all ask this one question. */
export function rulesetSequencePartAvailable(
  actor: RulesetCombatant,
  part: RulesetCombatAction | undefined,
): part is RulesetCombatAction {
  return !!part && !part.sequence && !part.signature && rulesetActionAvailable(actor, part);
}

/** A sequence with no part left that can happen would be paid for and do nothing. */
export function rulesetSequenceCanHappen(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  if (!action.sequence) return true;
  return action.sequence.some((step) =>
    rulesetSequencePartAvailable(
      actor,
      actor.actions.find((entry) => entry.id === step.actionId),
    ),
  );
}

/** What an action is expected to do. A sequence forecasts the SUM of its parts and no single chance
 *  to hit, because each part rolls its own against whoever it was pointed at. */
function forecastFor(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatOption["forecast"] | undefined {
  const forecast: NonNullable<RulesetCombatOption["forecast"]> = {};
  if (action.sequence) {
    const byId = new Map(actor.actions.map((entry) => [entry.id, entry]));
    // A part that has no use left, or is waiting for its dice, will not happen, so it is not
    // promised either. Counted strike by strike, the way the sequence will resolve: a part with one
    // use left that is named twice lands once, and a part that recharges lands once and is spent.
    const usesLeft = new Map<string, number>();
    const spent = new Set<string>();
    const total = action.sequence.reduce((sum, step) => {
      const part = byId.get(step.actionId);
      if (!rulesetSequencePartAvailable(actor, part) || spent.has(part.id)) return sum;
      let strikes = step.times;
      if (part.uses) {
        const uses = usesLeft.get(part.id) ?? actor.uses[part.id] ?? 0;
        strikes = Math.min(strikes, uses);
        usesLeft.set(part.id, uses - strikes);
      }
      if (part.recharge && strikes > 0) {
        strikes = 1;
        spent.add(part.id);
      }
      return (
        sum +
        (part.damage
          ? strikes *
            modifiedAverage(
              averageHarm(
                definition,
                combat,
                rulesetDamageInEffect(definition, combat, actor, part.damage),
                undefined,
                actor,
              ),
              rulesetDamageModifiers(
                definition,
                state,
                actor,
                part,
                firstTarget(definition, state, actor, part) ?? undefined,
              ),
              part.damage,
            )
          : 0)
      );
    }, 0);
    if (total > 0) forecast.averageDamage = Math.round(total * 100) / 100;
    return forecast.averageDamage === undefined ? undefined : forecast;
  }
  const target = firstTarget(definition, state, actor, action) ?? firstAreaTarget(state, actor, action);
  // A contest's chance is the share it would WIN against the first one it may be taken against.
  if (action.contest) {
    const chance = target ? rulesetContestChance(definition, combat, actor, target, action.contest, state) : null;
    return chance === null ? undefined : { hitChance: Math.round(chance * 1000) / 1000 };
  }
  if (action.toHit !== undefined && target) {
    // The same number the roll will be made against: the target's own defense plus whatever the
    // ground they stand on is worth, and the same roll mode the distance between them asks for.
    const defense = rulesetDefenseAgainst(definition, combat, state, target, actor, action).defense;
    const mode = rulesetAttackMode(definition, combat, actor, target, { state, optionId: action.id, action });
    const bonus = rulesetBonusDice(
      rulesetConditionModifiers(
        definition,
        combat,
        actor,
        "attacks",
        state,
        undefined,
        undefined,
        action.ability,
      ).filter(({ modifier }) => rulesetAttackModifierReaches(modifier, state, actor, target, action)),
    );
    // What the weapon adds against what the target is (1.187), as the roll will.
    const toHit = action.toHit + rulesetToHitAgainst(definition, action, target, actor);
    const chance = rulesetCombatIsPool(combat)
      ? rulesetPoolChance(
          definition,
          toHit + bonus.flat + rulesetCombatPenalty(definition, actor),
          Math.max(1, defense),
          mode,
          action.target,
        )
      : rulesetHitChance(combat, toHit, defense, mode, bonus, actor.criticalFrom);
    if (chance !== null) forecast.hitChance = Math.round(chance * 1000) / 1000;
  }
  // The whole blow, clauses and all. A clause with a save of its own is counted in full: a forecast
  // says what a blow would do, not what a die nobody has thrown might take off it. A pool fight's
  // harm is what its dice are worth after what the first target soaks; healing is an amount.
  if (action.damage) {
    const damage = rulesetDamageInEffect(definition, combat, actor, action.damage);
    const average = averageHarm(
      definition,
      combat,
      damage,
      target ?? undefined,
      actor,
      rulesetDamageMinimum(definition, actor, damage),
    );
    forecast.averageDamage = Math.round(average * 100) / 100;
  } else if (action.heal) forecast.averageDamage = Math.round(rulesetAverageDamage(action.heal) * 100) / 100;
  if (action.innate && action.use?.perCostStep && forecast.averageDamage !== undefined) {
    const steps = Math.max(0, action.innate.level - action.innate.baseLevel);
    if (action.damage && rulesetCombatIsPool(combat)) {
      const damage = rulesetDamageInEffect(definition, combat, actor, action.damage);
      const scaled = {
        ...damage,
        count: damage.count + action.use.perCostStep.count * steps,
        flat: damage.flat + action.use.perCostStep.flat * steps,
      };
      forecast.averageDamage =
        Math.round(
          averageHarm(
            definition,
            combat,
            scaled,
            target ?? undefined,
            actor,
            rulesetDamageMinimum(definition, actor, scaled),
          ) * 100,
        ) / 100;
    } else forecast.averageDamage += rulesetAverageDamage(action.use.perCostStep) * steps;
  }
  if (action.damage && forecast.averageDamage !== undefined) {
    forecast.averageDamage =
      Math.round(
        modifiedAverage(
          forecast.averageDamage,
          rulesetDamageModifiers(definition, state, actor, action, target ?? undefined),
          action.damage,
        ) * 100,
      ) / 100;
  }
  return forecast.hitChance !== undefined || forecast.averageDamage !== undefined ? forecast : undefined;
}

/** Modifiers that belong to THIS attack hit (Capability API 1.133). Rows and held weapons are
 *  attacks; a single-target stat-block roll is a creature's weapon. Catalog abilities and item
 *  uses are spell/other attacks. A save or an automatic hit never carries these additions. */
/** Whether an action is a weapon's blow rather than a spell's or an item's: an attack, or a stat
 *  block's single-target action, from no catalog (1.241). */
export function rulesetWeaponBlow(action: RulesetCombatAction): boolean {
  return (
    (action.kind === "attack" || (action.kind === "block" && action.targets.count === 1)) &&
    !action.catalog &&
    !action.itemUse
  );
}

/** Whether a change to attacks narrowed to a kind of blow (1.247) reaches this one: a weapon's or a
 *  spell's, struck in reach or from afar. Nothing narrowed reaches a roll it cannot read. */
export function rulesetAttackModifierReaches(
  modifier: { attacks?: "weapon" | "spell" | "any"; blow?: "melee" | "ranged" },
  state: RulesetEncounterState | undefined,
  actor: RulesetCombatant,
  target: RulesetCombatant | undefined,
  action: RulesetCombatAction | undefined,
): boolean {
  if (modifier.attacks && modifier.attacks !== "any") {
    if (!action || modifier.attacks !== (rulesetWeaponBlow(action) ? "weapon" : "spell")) return false;
  }
  if (modifier.blow) {
    if (!action || !state || modifier.blow !== rulesetBlowKind(state, actor, target ?? actor, action)) return false;
  }
  return true;
}

export function rulesetDamageModifiers(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target?: RulesetCombatant,
  taken = false,
): RulesetConditionModifier[] {
  const combat = definition.combat;
  if (!combat || !action.damage || action.toHit === undefined || action.autoHit || action.save) return [];
  const weapon = rulesetWeaponBlow(action);
  const holder = taken ? target : actor;
  if (!holder) return [];
  return rulesetConditionModifiers(definition, combat, holder, taken ? "damage-taken" : "damage", state).filter(
    ({ condition, level, item, modifier }) => {
      if (modifier.attacks && modifier.attacks !== "any" && modifier.attacks !== (weapon ? "weapon" : "spell"))
        return false;
      if (modifier.blow && modifier.blow !== rulesetBlowKind(state, actor, target ?? actor, action)) return false;
      if (modifier.ability && modifier.ability !== action.ability) return false;
      return (
        !modifier.fromSource ||
        (!item &&
          level === undefined &&
          holder.tracked.some((one) => one.condition === condition && one.source === actor.id))
      );
    },
  );
}

/** Own additions and multipliers only: a menu cannot promise a target's mark. */
function modifiedAverage(
  average: number,
  modifiers: RulesetConditionModifier[],
  /** The blow's own damage, whose dice a `diceTimes` throws again (1.197). */
  own?: RulesetCombatAmount,
): number {
  for (const { modifier } of modifiers) {
    const dice =
      modifier.diceTimes && own && own.count > 0
        ? { count: own.count * (modifier.diceTimes - 1), sides: own.sides, flat: 0 }
        : modifier.dice
          ? parseRulesetCombatDice(modifier.dice)
          : null;
    average += (modifier.flat ?? 0) + (dice ? (modifier.minus ? -1 : 1) * rulesetAverageDamage(dice) : 0);
  }
  return Math.max(0, average * modifiers.reduce((times, { modifier }) => times * (modifier.times ?? 1), 1));
}

/** What a weapon adds to hit against this target, by what it is (1.187): a mace of smiting's +2 more
 *  against a construct. Every entry that matches adds. */
export function rulesetToHitAgainst(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  actor?: RulesetCombatant,
): number {
  return rulesetAgainstHere(definition, action, target, actor).reduce((sum, entry) => sum + (entry.toHit ?? 0), 0);
}

/** The entries of a weapon's `against` this target meets: what it is (1.187), and a condition the
 *  wielder put on it (1.189), an oathbow's sworn enemy. Both, where an entry names both. */
export function rulesetAgainstHere(
  definition: RulesetDefinition,
  action: RulesetCombatAction | undefined,
  target: RulesetCombatant,
  actor: RulesetCombatant | undefined,
): RulesetCombatAgainst[] {
  return (action?.against ?? []).filter(
    (entry) =>
      (!entry.is || rulesetTargetIs(definition, target, entry.is)) &&
      (entry.marked === undefined || (!!actor && rulesetMarkedBy(target, entry.marked, actor.id))),
  );
}

/** Whether this combatant carries this condition, put on by this source (1.189). */
export function rulesetMarkedBy(combatant: RulesetCombatant, condition: string, sourceId: string): boolean {
  return combatant.tracked.some((entry) => entry.condition === condition && entry.source === sourceId);
}

/** What one blow's harm is worth on average. A sum is its dice and flat part; in a pool fight each
 *  amount is its dice counted against the damage target, its automatic successes, and less what the
 *  target soaks of its kind, thrown or taken off the dice. Never below nothing. */
function averageHarm(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  damage: NonNullable<RulesetCombatAction["damage"]>,
  target?: RulesetCombatant,
  actor?: RulesetCombatant,
  minimum = 0,
): number {
  // A clause dealt only to some targets counts against one it would reach, and never unaimed (1.168).
  // One of an item's switch counts only while the item is on (1.170).
  // One kept off some targets (1.187) counts against one it would still reach.
  const reaches = (clause: {
    targetIs?: RulesetTargetIs;
    not?: RulesetTargetIs;
    onCritical?: true;
    whileOn?: number;
    marked?: string;
  }) =>
    !clause.onCritical &&
    // One dealt only to a target the maker marked (1.189) counts against one they did.
    (clause.marked === undefined || (!!target && !!actor && rulesetMarkedBy(target, clause.marked, actor.id))) &&
    (clause.whileOn === undefined || (!!actor && rulesetItemOn(actor, clause.whileOn))) &&
    (!clause.targetIs || (!!target && rulesetTargetIs(definition, target, clause.targetIs))) &&
    (!clause.not || (!!target && !rulesetTargetIs(definition, target, clause.not)));
  if (!rulesetCombatIsPool(combat)) {
    return rulesetAverageDamage({
      ...damage,
      ...(damage.plus
        ? {
            plus: damage.plus.filter(reaches).map(({ targetIs: _, onCritical: __, whileOn: ___, ...clause }) => clause),
          }
        : {}),
    });
  }
  const one = (amount: { count: number; flat: number }, type: string | undefined, floor = 0) => {
    const kind = target ? rulesetTargetDamageKind(definition, combat, target, type, damage.qualities).kind : undefined;
    // Soak is taken only the way the ruleset says; a fight whose pool block says nothing takes none.
    const rule = combat.pool?.soak;
    const soak = target && rule ? rulesetSoakOf(target, kind) : 0;
    const roll = rule?.roll ?? true;
    const dice = Math.max(floor, roll ? amount.count : Math.max(0, amount.count - soak));
    // Automatic successes are never fewer than none, as the fight counts them.
    const thrown = rulesetDamageAverage(definition, combat, dice) + Math.max(0, amount.flat);
    return Math.max(0, thrown - (roll ? rulesetDamageAverage(definition, combat, soak) : 0));
  };
  return (
    one(damage, damage.type, minimum) +
    (damage.plus ?? []).filter(reaches).reduce((sum, clause) => sum + one(clause, clause.type ?? damage.type), 0)
  );
}

function optionFrom(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  /** The window is asking, so a reaction whose moment this is belongs on the list after all. */
  atItsMoment = false,
  /** What the actor's conditions do to the economy, worked out once for a whole menu. */
  economy = rulesetConditionEconomy(definition, combat, actor, state),
): RulesetCombatOption | null {
  // A signature action is bought with points at the end of somebody else's turn, so it is never on
  // the actor's own menu. `rulesetSignatureOptions` is where it is offered.
  if (action.signature) return null;
  // Nor a lair action (1.315), but on the turn lent for it.
  if (action.lair && !lairLent) return null;
  // A reaction waits for its moment, which is never a turn. `rulesetWindowOptions` is where the
  // moment offers it.
  if (action.reaction && !atItsMoment) return null;
  // Spent when its holder's roll fails, never chosen (1.249).
  if (action.rescue) return null;
  // Chosen with what it changes, never on its own (1.253): Metamagic.
  if (action.alters) return null;
  // A sequence whose parts are all gone, or all spent, would spend a budget and do nothing.
  if (!rulesetSequenceCanHappen(actor, action)) return null;
  // Breaking free is only there while something holds on.
  if (action.contest?.from && !rulesetContestHolder(state, actor, action.contest)) return null;
  if (!actionDoesSomething(action)) return null;
  // A teleport and nothing else (1.276) goes nowhere without a board.
  if (action.teleport && !positioned(state) && !action.teleport.leaves && !rulesetDoesMoreThanTeleport(action))
    return null;
  // Nor, then, the strike made before one (1.280).
  if (
    action.pairedWith &&
    !positioned(state) &&
    action.pairedWith.some((id) => {
      const port = actor.actions.find((one) => one.id === id)?.teleport;
      return port && !port.leaves;
    })
  )
    return null;
  // Only once the attack action has been taken this turn (1.242): Flurry of Blows.
  if (action.afterAttack && !rulesetTookAttackAction(actor, action.afterAttack)) return null;
  // Only on its holder's own turn before they have attacked in it (1.247): Reckless Attack.
  if (action.beforeAttack && (!rulesetOnOwnTurn(state, actor) || (actor.flags.attacks ?? 0) > 0)) return null;
  // A cap on attacks a turn (combat C6d, as Slow's): one that has made them all makes no more, however
  // many strikes an action would give. It is a cap on the holder's own turn, as Slow's is.
  if (
    rulesetIsAttack(action) &&
    economy.attacksPerTurn !== undefined &&
    rulesetOnOwnTurn(state, actor) &&
    (actor.flags.attacks ?? 0) >= economy.attacksPerTurn
  ) {
    return null;
  }
  // Free of the economy, or paid for out of strikes a spend already bought. Either way no budget is
  // asked for, and the option says so by carrying none.
  // The other half of an action made this turn (1.280): a blink dog's bite after its teleport.
  const following = rulesetOnOwnTurn(state, actor)
    ? actor.flags.followUps?.find((one) => one.id === action.id)
    : undefined;
  const free = action.free === true || !!following || rulesetFreeStrike(actor, action);
  // Its own budget spent, a condition's grant may pay instead (combat C6d): one weapon attack of a
  // single strike, or an item's use, as Haste's extra action allows. A creature's weapon is an
  // attack roll of its stat block at one target: its bite as much as a fighter's sword. Only on the
  // holder's own turn: the extra action is one of its turn, never a reaction's.
  let budget = action.budget;
  let oneStrike = false;
  let inReach = false;
  if (!free && (actor.budgets[budget] ?? 0) < 1) {
    if (atItsMoment) return null;
    const weapon =
      (action.kind === "attack" || (action.kind === "block" && action.targets.count === 1)) &&
      action.toHit !== undefined &&
      !action.catalog &&
      !action.itemUse;
    const tags = action.itemUse ? (actor.sheet?.items?.[action.itemUse.item]?.item.tags ?? []) : [];
    const grant = economy.grants.find(
      (entry) =>
        (actor.budgets[entry.budget] ?? 0) >= 1 &&
        !action.sequence &&
        ((entry.attacks === true &&
          weapon &&
          (!entry.melee || !action.range || action.reach !== undefined) &&
          // Only the attacks it names, and only after the attack action (1.242): Martial Arts.
          (!entry.names || rulesetAttackNamed(action.label, entry.names)) &&
          (!entry.afterAttack || rulesetTookAttackAction(actor, entry.afterAttack))) ||
          (!!action.itemUse &&
            (entry.items === true || (!!entry.items && entry.items.tags.some((tag) => tags.includes(tag)))))),
    );
    if (!grant) return null;
    budget = grant.budget;
    oneStrike = grant.attacks === true && weapon;
    inReach = oneStrike && grant.melee === true && !!action.range;
  }
  if (!following?.paid && !rulesetActionAvailable(actor, action, state, definition)) return null;
  // Its own price, or, with that pool empty, a higher one that pays for it: a 1st-level spell is
  // still cast with a 2nd-level slot, or a warlock's pact slot (1.171).
  const paid = planRulesetCombatCost(definition, actor, action);
  const payments = [...rulesetPaymentPools(definition, actor, action), ...chargePayments(actor, action)];
  if (!paid && payments.length === 0) return null;
  const icons = rulesetEntryIcons(definition, action.entry ?? (action.id.includes("/") ? action.id : undefined));
  const option: RulesetCombatOption = {
    id: action.id,
    kind: action.kind,
    label: action.label,
    ...(icons.length ? { icons } : {}),
    ...(free ? {} : { budget }),
    ...(following ? { followUp: true as const } : {}),
    ...(oneStrike ? { oneStrike: true as const } : {}),
    // A melee grant's thrown weapon is swung (1.239): its reach is all it has.
    ...(inReach ? { range: { normal: 0 } } : {}),
    targets: action.targets,
    ...(action.reaction?.cancelSave
      ? {
          cancelSave: {
            ...action.reaction.cancelSave,
            label:
              definition.sheet.saves.find((one) => one.id === action.reaction!.cancelSave!.save)?.label ??
              action.reaction.cancelSave.save,
          },
        }
      : {}),
    ...(rulesetFreeStrike(actor, action) ? { strikes: actor.strikesLeft } : {}),
    ...(action.heal ? { heals: true } : {}),
    ...(action.switches && "conjured" in action.switches
      ? { dismiss: true as const }
      : action.switches
        ? { on: "item" in action.switches ? rulesetItemOn(actor, action.switches.item) : !actor.doused }
        : {}),
    ...(action.restore ? { restores: action.restore.pool } : {}),
    ...(action.again ? { again: true as const } : {}),
  };
  if (paid && paid.cost.length > 0) option.cost = paid.cost;
  // As many uses as its user chooses (1.251).
  if (action.usesChosen) option.amount = { max: rulesetChosenUsesMax(definition, actor, action) };
  if (!paid) {
    option.upcastOnly = true;
    // What the cheapest of the ways it can still be paid costs, so the menu has a price to show.
    const cheapest = planRulesetCombatCost(definition, actor, action, payments[0]);
    if (cheapest && cheapest.cost.length > 0) option.cost = cheapest.cost;
  }
  if (action.uses) option.left = rulesetActionUses(actor, action, state);
  if (action.ammo) option.ammo = rulesetAmmoLeft(actor, action.ammo.tag);
  if (action.clip) option.loaded = { now: rulesetLoaded(actor, action.clip), max: action.clip.max };
  // What an item has left to use: its stack, or its charges.
  if (action.itemUse && (action.itemUse.consumes || action.itemUse.charges)) {
    option.left = rulesetItemUseLeft(actor, action.itemUse);
  }
  if (action.offHandOf !== undefined) option.offHand = true;
  // A shape, in cells, so a screen can draw the template before the choice is made and a picker can
  // weigh it. Only in a positioned fight: without a board an area is still resolved by target ids.
  if (action.area && positioned(state)) {
    const reach = rulesetOptionReach(state, actor.id, action.id);
    option.area = {
      shape: action.area.shape,
      size: action.area.size,
      ...(action.area.width !== undefined ? { width: action.area.width } : {}),
      // How a wall may be laid (1.177) and how many times it may be set down (1.178).
      ...(action.area.ring !== undefined ? { ring: action.area.ring } : {}),
      ...(action.zone?.side ? { sided: true as const } : {}),
      ...(action.area.copies !== undefined ? { copies: action.area.copies } : {}),
      range: reach?.max ?? action.area.size,
    };
  }
  // Which higher pools of the same family could pay instead, so the menu offers the upcast rather
  // than a player discovering it.
  if (payments.length > 0) {
    option.payWith = payments;
    // A use that takes more targets the more it is paid says how many each way takes (1.171).
    if ((action.use?.targetsPerStep || action.itemUse?.charges?.step?.targets) && action.targets.count > 0) {
      option.targetsWith = Object.fromEntries(
        payments.map((pool) => [pool, rulesetPaidTargetCount(definition, actor, action, pool)]),
      );
    }
  }
  const forecast = forecastFor(definition, combat, state, actor, action);
  if (forecast) option.forecast = forecast;
  // Wall sections it may strike instead (1.200). Not in a window: what is taken at its moment is
  // aimed where its moment says.
  if (!atItsMoment) {
    const walls = rulesetWallTargets(state, actor, action);
    if (walls.length > 0) option.walls = walls;
  }
  // Where a teleport may go, and who may go along (1.276). With nowhere to go it is not offered.
  // Or out of the fight altogether, where it may leave it (1.279), the only way it goes off a board.
  if (action.teleport && (positioned(state) || action.teleport.leaves)) {
    const cells = positioned(state) ? rulesetTeleportCells(definition, state, actor, action.teleport) : [];
    if (cells.length === 0 && !action.teleport.leaves) return null;
    const ids = rulesetTeleportPassengers(state, actor, action.teleport, definition);
    option.teleport = {
      cells,
      ...(ids.length > 0 ? { carries: { count: action.teleport.carries!, ids } } : {}),
      ...(action.teleport.leaves ? { leaves: true as const } : {}),
    };
  }
  // The weapon's other ways to make this attack, each only while its holder has the shots for it,
  // and each with what it is expected to do. Not in a window: what is taken at its moment is made
  // as it is.
  if (action.modes?.length && !atItsMoment) {
    const modes = action.modes.flatMap((mode) => {
      const moded = rulesetModedAction(definition, action, mode.id);
      if (!moded || !rulesetShotsAvailable(actor, moded)) return [];
      // One that spends the item's charges only while it has them (1.190).
      if (mode.charges && rulesetItemChargesLeft(actor, mode.charges) < mode.charges.cost) return [];
      const expected = forecastFor(definition, combat, state, actor, moded);
      return [
        { id: mode.id, label: mode.label, targets: moded.targets.count, ...(expected ? { forecast: expected } : {}) },
      ];
    });
    if (modes.length > 0) option.modes = modes;
  }
  // Where initiative is a number attacks move, the ways this attack may be made, each with what it
  // would do: a style that takes would take what its damage dice are worth off the target's number,
  // one that spends throws the actor's own number at their health.
  // Not in a window: what is taken at its moment is made in the first style, so there is no choice.
  const styles = atItsMoment ? [] : rulesetAttackStyles(combat, actor, action);
  if (styles.length > 0) {
    // A spending blow below the first target's hardness does nothing to them. An area names nobody,
    // so it is the first combatant any legal aim would catch, as the forecast reads.
    const aimed = firstTarget(definition, state, actor, action) ?? firstAreaTarget(state, actor, action);
    const turned = aimed?.hardness !== undefined && actor.initiative < aimed.hardness;
    option.styles = styles.map((style) => {
      const hit = forecast?.hitChance !== undefined ? { hitChance: forecast.hitChance } : {};
      const spent = turned ? 0 : Math.round(rulesetDamageAverage(definition, combat, actor.initiative) * 100) / 100;
      const worth = style.takes
        ? { ...hit, ...(forecast?.averageDamage !== undefined ? { shift: forecast.averageDamage } : {}) }
        : { ...hit, averageDamage: spent };
      return { id: style.id, label: style.label, forecast: worth };
    });
  }
  // What it may be used with (1.253): Metamagic its user can pay for now.
  if (!atItsMoment) {
    const alters = rulesetAlterOffers(definition, state, actor, action);
    if (alters.length > 0) option.alters = alters;
  }
  return option;
}

/** An action its user cannot take as it is but can with one alteration (1.253): a spell Quickened
 *  once the action is spent, or Subtle under Silence. */
function alterNeededOption(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  economy: ReturnType<typeof rulesetConditionEconomy>,
): RulesetCombatOption | null {
  if (!action.catalog || action.alters) return null;
  for (const one of actor.actions) {
    const alter = one.alters;
    if (!alter || (!alter.budget && !alter.drops) || !rulesetAlterFits(alter, action)) continue;
    if (
      !rulesetActionAvailable(actor, one, state, definition) ||
      !planRulesetAlterCost(definition, actor, one, action)
    ) {
      continue;
    }
    const option = optionFrom(definition, combat, state, actor, rulesetAlteredAction(action, [one]), false, economy);
    if (!option) continue;
    option.alterNeeded = one.id;
    const offers = option.alters ?? [];
    if (!offers.some((offer) => offer.id === one.id)) {
      const level = rulesetPaidLevel(definition, actor, action);
      offers.unshift({
        id: one.id,
        label: one.label,
        cost: one.usesSpentByLevel ? Math.max(1, level) : (one.use?.count ?? 1),
        ...(alter.budget ? { budget: alter.budget.to } : {}),
      });
    }
    option.alters = offers;
    return option;
  }
  return null;
}

/** A day, the longest an alteration stretches anything (1.253). */
const ALTER_LASTS_MOST = 14400;

/** Whether an altering action may change this one (1.253): every change it makes has something
 *  to change. */
export function rulesetAlterFits(alter: RulesetCombatAlter, action: RulesetCombatAction): boolean {
  if (!action.catalog || !alter.catalogs.includes(action.catalog) || action.alters || action.reaction) return false;
  const own = action.targets.side === "self" && !action.area;
  if (alter.spares !== undefined && !(alter.spares > 0 && action.save)) return false;
  if (alter.range && !(action.range || (alter.range.touch !== undefined && action.reach !== undefined && !own))) {
    return false;
  }
  if (alter.rerolls !== undefined && !(alter.rerolls > 0 && (action.damage?.count ?? 0) > 0)) return false;
  if (
    alter.lasts !== undefined &&
    !(
      action.applies?.some((entry) => typeof entry.duration === "object" && entry.duration.rounds >= 10) ||
      (action.summons?.rounds ?? 0) >= 10
    )
  ) {
    return false;
  }
  if (alter.heightens && !action.save) return false;
  if (alter.budget && action.budget !== alter.budget.from) return false;
  if (alter.drops && !action.components?.some((component) => alter.drops!.includes(component))) return false;
  if (
    alter.twins &&
    !(
      action.targets.count === 1 &&
      !own &&
      action.targets.side !== "self" &&
      !action.area &&
      !action.use?.targetsPerStep
    )
  ) {
    return false;
  }
  return true;
}

/** The action as its alterations change it (1.253). What they leave for it to do as it resolves is
 *  its `altered`. */
export function rulesetAlteredAction(
  action: RulesetCombatAction,
  alters: RulesetCombatAction[],
  /** Who of its user's side it spares (1.254), and who it heightens (1.255), where they were picked. */
  picks: { spared?: string[]; heightened?: string } = {},
): RulesetCombatAction {
  const { spared, heightened } = picks;
  let out: RulesetCombatAction = { ...action };
  const altered: NonNullable<RulesetCombatAction["altered"]> = { ...(action.altered ?? {}) };
  for (const one of alters) {
    const alter = one.alters;
    if (!alter) continue;
    if (alter.range) {
      if (out.range) {
        out.range = {
          normal: out.range.normal * alter.range.times,
          ...(out.range.long !== undefined ? { long: out.range.long * alter.range.times } : {}),
        };
      } else if (alter.range.touch !== undefined) out.range = { normal: alter.range.touch };
    }
    if (alter.lasts !== undefined) {
      const times = alter.lasts;
      out.applies = out.applies?.map((entry) =>
        typeof entry.duration === "object"
          ? {
              ...entry,
              duration: { ...entry.duration, rounds: Math.min(ALTER_LASTS_MOST, entry.duration.rounds * times) },
            }
          : entry,
      );
      if (out.summons) out.summons = { ...out.summons, rounds: Math.min(ALTER_LASTS_MOST, out.summons.rounds * times) };
    }
    if (alter.budget) out.budget = alter.budget.to;
    if (alter.drops) {
      out.components = (out.components ?? []).filter((component) => !alter.drops!.includes(component));
      altered.subtle = true;
    }
    if (alter.twins) out.targets = { ...out.targets, count: out.targets.count + 1 };
    if (alter.spares) altered.spares = Math.max(altered.spares ?? 0, alter.spares);
    if (alter.rerolls) altered.rerolls = Math.max(altered.rerolls ?? 0, alter.rerolls);
    if (alter.heightens) altered.heightens = true;
  }
  if (spared && altered.spares) altered.spared = spared.slice(0, altered.spares);
  if (heightened !== undefined && altered.heightens) altered.heightened = heightened;
  if (Object.keys(altered).length > 0) out = { ...out, altered };
  out.alteredWith = [...(action.alteredWith ?? []), ...alters.map((one) => one.id)];
  return out;
}

/** What an altering action costs on this action paid this way (1.253), or null when it cannot be
 *  paid. */
export function planRulesetAlterCost(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  alter: RulesetCombatAction,
  action: RulesetCombatAction,
  payWith?: string,
): RulesetCombatCost | null {
  const level = rulesetPaidLevel(definition, actor, action, payWith);
  return planRulesetCombatCost(
    definition,
    actor,
    alter,
    undefined,
    alter.usesSpentByLevel ? Math.max(1, level) : undefined,
  );
}

/** The alterations this action may be used with now (1.253): ones that fit it and can be paid for
 *  at its own level. */
export function rulesetAlterOffers(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatAlterOffer[] {
  if (!action.catalog) return [];
  const level = rulesetPaidLevel(definition, actor, action);
  return actor.actions.flatMap((one) => {
    const alter = one.alters;
    if (!alter || !rulesetAlterFits(alter, action) || !rulesetActionAvailable(actor, one, state, definition)) return [];
    if (!planRulesetAlterCost(definition, actor, one, action)) return [];
    return [
      {
        id: one.id,
        label: one.label,
        cost: one.usesSpentByLevel ? Math.max(1, level) : (one.use?.count ?? 1),
        ...(one.usesSpentByLevel ? { perLevel: true as const } : {}),
        ...(alter.twins ? { twins: true as const } : {}),
        ...(alter.joins ? { joins: true as const } : {}),
        ...(alter.budget ? { budget: alter.budget.to } : {}),
        ...(alter.spares ? { spares: alter.spares } : {}),
        ...(alter.heightens ? { heightens: true as const } : {}),
      },
    ];
  });
}

/** One of the ways an attack may be made where initiative is a number attacks move. */
export type RulesetInitiativeStyle = NonNullable<RulesetCombat["initiative"]["resource"]>["styles"][number];

/** Whether an action is an attack a style applies to: one that rolls to hit and does harm, or an
 *  action made of other actions, whose parts are all made in its style. A reaction is taken at its
 *  moment in the first style, like anything else made out of a turn. */
export function rulesetActionTakesStyle(action: RulesetCombatAction): boolean {
  if (action.contest) return false;
  return !!action.sequence || (action.toHit !== undefined && !action.autoHit && !!action.damage);
}

/** The styles this actor may make this attack in now. A style that spends needs a number above the
 *  crash line to spend, so a crashed actor is offered only the ones that take; and a number is spent
 *  on one blow, so an action made of several only ever takes. */
export function rulesetAttackStyles(
  combat: RulesetCombat,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetInitiativeStyle[] {
  const resource = combat.initiative.resource;
  if (!resource || !rulesetActionTakesStyle(action)) return [];
  const line = resource.crash?.at ?? 0;
  return resource.styles.filter((style) => !style.spends || (!action.sequence && actor.initiative > line));
}

/** How this attack is rolled: the actor's own conditions and their target's, the help an ally gave
 *  and a dodging target, with advantage and disadvantage cancelling each other out. A ruleset that
 *  does not roll twice at all keeps its single roll whatever the fiction says. */
export function rulesetAttackMode(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  /** Where the two of them stand, which is what the distance rules read. Left out by a fight with
   *  no board, and then none of them says anything. */
  where?: { state: RulesetEncounterState; optionId: string; action?: RulesetCombatAction },
): RulesetCombatRollMode {
  if (!rulesetCombatAdvantage(combat)) return "normal";
  const own = rulesetCombatEffects(definition, combat, actor, where?.state);
  const theirs = rulesetCombatEffects(definition, combat, target, where?.state);
  // What the weapon does differently against this target (1.189): an oathbow at its sworn enemy.
  const blow = where ? (where.action ?? actionOf(actor, where.optionId)) : undefined;
  const against = rulesetAgainstHere(definition, blow, target, actor);
  const farIsFine = against.some((entry) => entry.ignoresLongRange);
  const distance = where
    ? distanceModes(combat, where.state, where.optionId, actor, target, theirs, farIsFine, blow?.range)
    : null;
  // Not seeing (1.178): striking at somebody you cannot see is harder, at somebody who cannot see
  // you easier.
  const unseen = combat.sight?.unseenAttacks && where;
  // Unless not seeing is nothing to its attacks (1.309): Feral Senses.
  const blindStrike =
    !!unseen &&
    !rulesetHidingTraits(definition, actor).unseenStrikes &&
    !rulesetCanSee(definition, where.state, actor, target);
  const blindSide = !!unseen && !rulesetCanSee(definition, where.state, target, actor);
  const advantage =
    own.has("own-attacks-advantage") ||
    theirs.has("attacks-against-advantage") ||
    !!actor.flags.helped ||
    !!distance?.advantage ||
    blindSide ||
    (combat.elevation?.highGround === "advantage" && !!where && rulesetAbove(where.state, actor, target));
  const disadvantage =
    own.has("own-attacks-disadvantage") ||
    theirs.has("attacks-against-disadvantage") ||
    !!target.flags.dodging ||
    !!distance?.disadvantage ||
    blindStrike;
  // Changes that roll attacks twice (1.185): the attacker's own, some only against whoever put them
  // on (Chill Touch), and the target's against attackers of some kind (Protection from Evil and Good).
  const leans = new Set<string>();
  // Narrowed to an ability (1.188), only an attack made with it: what it is made with is the action's.
  const ability = blow?.ability;
  for (const entry of rulesetActiveConditions(definition, combat, actor, where?.state)) {
    for (const modifier of entry.modifiers ?? []) {
      if (modifier.to !== "attacks" || !modifier.mode) continue;
      if (!rulesetAbilityNarrowing(modifier, "attacks", ability)) continue;
      if (!rulesetAttackModifierReaches(modifier, where?.state, actor, target, blow)) continue;
      if (
        modifier.atSource &&
        !actor.tracked.some((one) => one.condition === entry.condition && one.source === target.id)
      )
        continue;
      leans.add(modifier.mode);
    }
  }
  for (const entry of rulesetActiveConditions(definition, combat, target, where?.state)) {
    for (const modifier of entry.modifiers ?? []) {
      if (modifier.to !== "attacks-taken" || !modifier.mode) continue;
      if (modifier.from && !rulesetTargetIs(definition, actor, modifier.from)) continue;
      leans.add(modifier.mode);
    }
  }
  for (const entry of against) if (entry.mode) leans.add(entry.mode);
  // A creature's own (1.293): sensitivity to sunlight, where it holds.
  for (const rule of actor.block?.attackModes ?? []) {
    if (rulesetModeRuleHolds(definition, combat, actor, where?.state, rule)) leans.add(rule.mode);
  }
  // Another weapon's mark still standing (1.192): an oathbow's disadvantage with every other weapon
  // while its sworn enemy lives.
  if (blow?.kind === "attack" && where) {
    for (const other of actor.actions) {
      const rule = other.othersWhileMarked;
      if (!rule || blow.id === `item:${rule.item}` || blow.offHandOf === rule.item) continue;
      if (rule.ranged && !blow.range) continue;
      const marked = where.state.combatants.some(
        (one) => !one.defeated && rulesetMarkedBy(one, rule.condition, actor.id),
      );
      if (marked) leans.add(rule.mode);
    }
  }
  const up = advantage || leans.has("advantage");
  const down = disadvantage || leans.has("disadvantage");
  if (up === down) return "normal";
  return up ? "advantage" : "disadvantage";
}

/** Whether the actor is next to somebody on the other side, which is what a ruleset that says
 *  shooting beside a foe is harder measures. */
function foeAdjacent(state: RulesetEncounterState, actor: RulesetCombatant): boolean {
  return state.combatants.some((combatant) => {
    if (combatant.side === actor.side || !rulesetCombatStanding(combatant)) return false;
    const cell = rulesetPositionOf(combatant);
    if (!cell) return false;
    // Beside any cell either fills (1.194); a foe far below (or above) is not beside them (1.114).
    return rulesetCombatantDistance(state, actor, combatant) <= 1;
  });
}

/** What the distance between these two says about the roll: the ruleset's own ranged rules, and the
 *  three condition effects that only mean something once somebody has a position. */
function distanceModes(
  combat: RulesetCombat,
  state: RulesetEncounterState,
  optionId: string,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  theirs: ReadonlySet<string>,
  /** Long range costs nothing (1.189). */
  farIsFine = false,
  /** The reach the blow is made at, a weapon mode's own (1.190). */
  range?: { normal: number; long?: number },
): { advantage: boolean; disadvantage: boolean } | null {
  const from = rulesetPositionOf(actor);
  const to = rulesetPositionOf(target);
  if (!positioned(state) || !from || !to) return null;
  const away = rulesetCombatantDistance(state, actor, target);
  const adjacent = away <= 1;
  const reach = rulesetOptionReach(state, actor.id, optionId, range);
  const ranged = combat.ranged;
  // A thrown weapon used in hand is a swing, so neither ranged rule reads it there.
  const thrown = !!reach?.shot && away > (reach?.swing ?? 0);
  const tooFar = !farIsFine && !!ranged && ranged.long === "disadvantage" && thrown && away > reach!.normal;
  const crowded = !!ranged && ranged.adjacentFoe === "disadvantage" && thrown && foeAdjacent(state, actor);
  return {
    advantage: adjacent && theirs.has("attacks-against-adjacent-advantage"),
    disadvantage: tooFar || crowded || (!adjacent && theirs.has("attacks-against-far-disadvantage")),
  };
}

/** Whether a hit on this target from where the actor stands is a critical whatever the dice said:
 *  the third distance condition effect. */
export function rulesetCriticalFromAdjacent(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): boolean {
  const from = rulesetPositionOf(actor);
  const to = rulesetPositionOf(target);
  if (!positioned(state) || !from || !to || rulesetCombatantDistance(state, actor, target) > 1) return false;
  return rulesetCombatEffects(definition, combat, target, state).has("attacks-from-adjacent-critical");
}

/** What getting back up costs, in cells: half the whole allowance, rounded up, so half of one is
 *  still the whole of it rather than nothing. */
export function rulesetStandCost(combatant: RulesetCombatant): number {
  return Math.max(1, Math.ceil((combatant.movement ?? 0) / 2));
}

/** Which of the actor's conditions is the one holding them down. */
export function rulesetProneCondition(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
): string | null {
  const active = new Set(rulesetCombatConditions(definition, actor));
  const entry = (combat.conditions ?? []).find(
    (candidate) => active.has(candidate.condition) && candidate.effects.includes("half-move-to-stand"),
  );
  return entry?.condition ?? null;
}

/**
 * Walking, and getting back up. A fight with no board has neither.
 *
 * Getting up comes FIRST: while a condition holds somebody down, half their allowance is what it
 * costs to clear it, and nothing else about movement is offered until they have.
 */
function movementOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  if (!positioned(state) || !rulesetPositionOf(actor)) return [];
  // A condition that pins somebody takes their movement away the moment it lands, not at the start
  // of their next turn.
  if (rulesetCombatEffects(definition, combat, actor, state).has("speed-zero")) return [];
  // Held where it stands by the light it is in (1.319): Lantern-Shy in bright light.
  const still = actor.block?.stillIn;
  if (
    still &&
    rulesetFootprint(actor).some((cell) => {
      const light = rulesetLightAt(definition, state, cell);
      return still.some((wanted) => rulesetLightMatches(light, wanted));
    })
  ) {
    return [];
  }
  const left = Math.max(0, Math.floor(actor.movementLeft ?? 0));
  const prone = rulesetProneCondition(definition, combat, actor);
  if (prone) {
    const cost = rulesetStandCost(actor);
    if (left < cost) return [];
    return [
      {
        id: RULESET_STAND_OPTION,
        kind: "move",
        label: "Stand up",
        targets: { side: "self", count: 0 },
        movementCost: cost,
      },
    ];
  }
  // Taking off and landing where it stands (1.354), free: a flier on the ground, or one in the air at
  // the ground's own height that has a walk to come down to.
  const lift: RulesetCombatOption[] = [];
  if (actor.speeds?.fly && typeof actor.x === "number" && !rulesetAirborne(state.board?.grid, actor)) {
    const move = (id: string, label: string): RulesetCombatOption => ({
      id,
      kind: "move",
      label,
      targets: { side: "self", count: 0 },
      movementCost: 0,
    });
    if (!actor.airborne) lift.push(move(RULESET_TAKE_OFF_OPTION, "Take off"));
    else if (actor.speed > 0) lift.push(move(RULESET_LAND_OPTION, "Land"));
  }
  if (left < 1) return lift;
  const options: RulesetCombatOption[] = [...lift];
  const cells = rulesetReachableCells(definition, state, actor.id);
  if (cells.length > 0) {
    options.push({ id: RULESET_MOVE_OPTION, kind: "move", label: "Move", targets: { side: "self", count: 0 }, cells });
  }
  // Up or down a level where it stands (1.114): a flier, on a board with levels, paying what a level
  // is worth out of what is left of its flight.
  const grid = state.board?.grid;
  const levelCells = state.board?.levelCells;
  const flight = actor.modeLeft?.fly ?? 0;
  if (grid && levelCells && actor.speeds?.fly && flight >= levelCells && left >= levelCells) {
    const ground = elevationAt(grid, actor.x!, actor.y!);
    const level = rulesetLevelOf(grid, actor);
    const fly = (id: string, label: string): RulesetCombatOption => ({
      id,
      kind: "move",
      label,
      targets: { side: "self", count: 0 },
      movementCost: levelCells,
    });
    if (level < ground + RULESET_FLY_CEILING) options.push(fly(RULESET_FLY_UP_OPTION, "Fly up"));
    if (rulesetAirborne(grid, actor)) options.push(fly(RULESET_FLY_DOWN_OPTION, "Fly down"));
  }
  return options;
}

/**
 * Everything the actor whose turn it is may legally do. An actor who is down, held by a condition
 * or simply not the one on turn is offered nothing but the end of their turn, and an ability whose
 * price the sheet would refuse is left out rather than offered and then refused.
 */
export function rulesetCombatOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const options = rulesetUncompelledOptions(definition, state, actorId);
  const actor = rulesetCombatant(state, actorId);
  return actor && definition.combat ? compelled(definition, definition.combat, state, actor, options) : options;
}

/**
 * What a condition that decides its holder's turn leaves of the menu (1.264): a turn the table
 * said does nothing, or was walked away, is only ended; one that must strike keeps the melee
 * attacks at the creature the dice picked; `only` keeps walking, breaking free and the standard
 * actions named, and `onlyWhenStuck` those it names while there is nowhere to walk. Which way they
 * may walk is the cells' own business (`rulesetReachableCells`).
 */
function compelled(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  options: RulesetCombatOption[],
): RulesetCombatOption[] {
  const turn = actor.flags.compelled;
  if (turn === "nothing" || turn === "wandered") return options.filter((option) => option.kind === "end-turn");
  let kept = options;
  if (turn === "strike") {
    kept = kept.filter((option) => {
      if (option.kind === "end-turn") return true;
      if (option.kind !== "attack" && option.kind !== "block") return false;
      const action = actor.actions.find((entry) => entry.id === option.id);
      if (!action || !rulesetIsAttack(action) || (action.range && action.reach === undefined)) return false;
      return rulesetOptionTargets(definition, state, actor.id, option).includes(actor.flags.compelledTarget ?? "");
    });
  }
  // One that frees a turn begun with nowhere to walk (1.266) holds nothing of it then.
  const rules = rulesetActiveConditions(definition, combat, actor, state).flatMap((entry) =>
    entry.behavior?.only && !(entry.behavior.onlyWhenStuck === "any" && actor.flags.stuck) ? [entry.behavior] : [],
  );
  if (!rules.length) return kept;
  const walks = kept.some((option) => option.id === RULESET_MOVE_OPTION && (option.cells?.length ?? 0) > 0);
  const allowed = (name: string) =>
    rules.every(
      (rule) =>
        rule.only!.includes(name as never) ||
        (!walks && Array.isArray(rule.onlyWhenStuck) && rule.onlyWhenStuck.includes(name as never)),
    );
  return kept.filter((option) => {
    if (option.kind === "end-turn") return true;
    if (option.kind === "move") return option.id.startsWith("move:") && allowed("move");
    if (option.kind === "standard" && option.id.startsWith("standard:")) {
      return allowed(rulesetStandardName(option.id));
    }
    if (option.kind === "contest") {
      const action = actor.actions.find((entry) => entry.id === option.id);
      return !!action?.contest?.from && allowed("escape");
    }
    return false;
  });
}

/** Picking up what they dropped (1.266), from where it fell or beside it: once a turn for nothing,
 *  or for the budget the condition that dropped it named. */
function pickUpOptions(actor: RulesetCombatant): RulesetCombatOption[] {
  const out: RulesetCombatOption[] = [];
  for (const thing of actor.dropped ?? []) {
    if (thing.at && rulesetPositionOf(actor) && rulesetGapFrom(thing.at, 1, actor) > 1) continue;
    if (thing.pickUp ? (actor.budgets[thing.pickUp] ?? 0) < 1 : actor.flags.pickedUp) continue;
    out.push({
      id: `${RULESET_PICK_UP_OPTION_PREFIX}${thing.key}`,
      kind: "item",
      label: thing.label,
      ...(thing.pickUp ? { budget: thing.pickUp } : {}),
      targets: { side: "self", count: 0 },
      pickUp: true,
    });
  }
  return out;
}

/** Averting the eyes from each holder of a gaze that may be averted (1.268), and looking at whoever
 *  they keep them from again. Free, and as often as they like. */
function avertOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  const out: RulesetCombatOption[] = [];
  const away = new Set(actor.averted ?? []);
  for (const holderId of away) {
    const holder = rulesetCombatant(state, holderId);
    if (!holder || holder.defeated) continue;
    out.push({
      id: `${RULESET_AVERT_OPTION_PREFIX}${holderId}`,
      kind: "standard",
      label: holder.name,
      targets: { side: "self", count: 0 },
      avert: { holderId, back: true },
    });
  }
  const offered = new Set<string>();
  for (const { holder, aura } of rulesetAuraSpreaders(definition, state)) {
    if (!aura.save?.avert || holder.id === actor.id || holder.defeated) continue;
    if (away.has(holder.id) || offered.has(holder.id)) continue;
    if (aura.side === (holder.side === actor.side ? "enemies" : "allies")) continue;
    offered.add(holder.id);
    out.push({
      id: `${RULESET_AVERT_OPTION_PREFIX}${holder.id}`,
      kind: "standard",
      label: holder.name,
      targets: { side: "self", count: 0 },
      avert: { holderId: holder.id },
    });
  }
  return out;
}

/** The menu as it would be with no condition deciding the turn (1.264). */
export function rulesetUncompelledOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  if (!combat || !actor || currentRulesetActor(state)?.id !== actorId) return [];
  const endTurn: RulesetCombatOption = {
    id: "end-turn",
    kind: "end-turn",
    label: "End turn",
    targets: { side: "self", count: 0 },
  };
  // Away and still taking turns (1.313): only the way back, by what ends what keeps them away.
  if (actor.away?.turns) return [...endingOptions(definition, combat, actor), endTurn];
  if (!rulesetCombatStanding(actor) || blocked(definition, combat, state, actor)) return [endTurn];

  const options: RulesetCombatOption[] = [];
  const economy = rulesetConditionEconomy(definition, combat, actor, state);
  // Caught unaware (1.237): this first turn is only ended, unless it is shaken off by what shakes it.
  if (actor.surprised) {
    for (const id of actor.surpriseOut ?? []) {
      const action = actor.actions.find((entry) => entry.id === id);
      const option = action && optionFrom(definition, combat, state, actor, action, false, economy);
      if (option) options.push(option);
    }
    return [...options, endTurn];
  }
  options.push(...movementOptions(definition, combat, state, actor));
  for (const action of actor.actions) {
    const option =
      optionFrom(definition, combat, state, actor, action, false, economy) ??
      alterNeededOption(definition, combat, state, actor, action, economy);
    if (option) options.push(option);
  }
  for (const summon of actor.summons ?? []) {
    if (summon.rounds <= 0 || (actor.budgets[summon.budget] ?? 0) < 1) continue;
    const action = actor.actions.find((entry) => entry.id === summon.actionId);
    if (!action) continue;
    if (
      rulesetIsAttack(action) &&
      economy.attacksPerTurn !== undefined &&
      (actor.flags.attacks ?? 0) >= economy.attacksPerTurn
    )
      continue;
    const option: RulesetCombatOption = {
      id: `summon:${summon.actionId}`,
      kind: "attack",
      label: summon.label,
      budget: summon.budget,
      targets: { side: "enemy", count: 1 },
    };
    if (rulesetOptionTargets(definition, state, actor.id, option).length > 0) options.push(option);
  }
  options.push(...pickUpOptions(actor));
  options.push(...avertOptions(definition, state, actor));
  // Moving a lasting area its caster holds at a point (1.173): picked on the board as a walk is.
  for (const zone of actor.zones ?? []) {
    const move = actor.actions.find((entry) => entry.id === zone.actionId)?.zone?.move;
    if (!move || (actor.budgets[move.budget] ?? 0) < 1) continue;
    // Rammed into somebody, it has stopped for the turn (1.175).
    if (zone.rammed === `${state.round}:${state.turn}`) continue;
    const cells = rulesetZoneMoveCells(state, zone, move.distance);
    if (cells.length === 0) continue;
    options.push({
      id: `${RULESET_ZONE_OPTION_PREFIX}${zone.actionId}`,
      kind: "move",
      label: zone.label,
      budget: move.budget,
      targets: { side: "self", count: 0 },
      cells,
    });
  }
  // Turning a line or cone its caster carries (1.182): picked on the board as the cell it now faces.
  for (const zone of actor.zones ?? []) {
    const turn = actor.actions.find((entry) => entry.id === zone.actionId)?.zone?.turn;
    if (!turn || (actor.budgets[turn.budget] ?? 0) < 1) continue;
    const cells = rulesetZoneTurnCells(state, actor, zone);
    if (cells.length === 0) continue;
    options.push({
      id: `${RULESET_ZONE_TURN_OPTION_PREFIX}${zone.actionId}`,
      kind: "move",
      label: zone.label,
      budget: turn.budget,
      targets: { side: "self", count: 0 },
      cells,
    });
  }
  for (const holder of state.combatants) {
    if (holder.side !== actor.side || holder.defeated) continue;
    for (const condition of rulesetCombatConditions(definition, holder)) {
      const shake = combat.conditions?.find((entry) => entry.condition === condition)?.shakeOff;
      if (!shake || (actor.budgets[shake.budget] ?? 0) < 1) continue;
      // Its holder tears free of it themselves where it says so (1.320): the Seed Hopper.
      if (holder.id === actor.id) {
        if (!shake.self) continue;
        const label = definition.sheet.live.conditions.find((entry) => entry.id === condition)?.label ?? condition;
        options.push({
          id: `shake:${condition}@${holder.id}`,
          kind: "standard",
          label: `Tear free of ${label}`,
          budget: shake.budget,
          targets: { side: "self", count: 0 },
          shakeOff: { holderId: holder.id, condition, name: holder.name, label },
        });
        continue;
      }
      const reach = shake.reach === undefined ? 1 : shake.reach / (combat.distance?.perCell ?? 1);
      if (positioned(state) && rulesetCombatantDistance(state, actor, holder) > reach) continue;
      const label = definition.sheet.live.conditions.find((entry) => entry.id === condition)?.label ?? condition;
      options.push({
        id: `shake:${condition}@${holder.id}`,
        kind: "standard",
        label: `Shake ${holder.name} out of ${label}`,
        budget: shake.budget,
        targets: { side: "self", count: 0 },
        shakeOff: { holderId: holder.id, condition, name: holder.name, label },
      });
    }
  }
  // Lighting a prop again (1.332): somebody beside it, while anywhere it lights is not lit so.
  for (const prop of state.board?.props ?? []) {
    const relight = prop.relight;
    if (!relight || prop.health <= 0 || (actor.budgets[relight.budget] ?? 0) < 1) continue;
    if (!rulesetNearProp(state, actor, prop.id, 1)) continue;
    if (rulesetRelightCells(state, prop).every((cell) => rulesetLightAt(definition, state, cell) === relight.light))
      continue;
    options.push({
      id: `${RULESET_RELIGHT_OPTION_PREFIX}${prop.id}`,
      kind: "standard",
      label: `Light ${prop.label} again`,
      budget: relight.budget,
      targets: { side: "self", count: 0 },
      relights: { propId: prop.id, label: prop.label },
    });
  }
  // A sphere (1.314): rolled by the one shut in it, picked up or put down by somebody next to it.
  if (positioned(state)) {
    const own = rulesetSealed(definition, actor, state);
    if (own?.rolls && (actor.budgets[own.rolls.budget] ?? 0) >= 1) {
      const label =
        definition.sheet.live.conditions.find((entry) => entry.id === own.condition)?.label ?? own.condition;
      options.push({
        id: "sphere:roll",
        kind: "standard",
        label: `Roll ${label}`,
        budget: own.rolls.budget,
        targets: { side: "self", count: 0 },
        rollsSealed: { condition: own.condition, label },
      });
    }
    for (const held of state.combatants) {
      if (held.id === actor.id || held.defeated) continue;
      const sealed = rulesetSealed(definition, held, state);
      if (!sealed?.lifted) continue;
      if (held.carriedBy === actor.id) {
        options.push({
          id: `sphere:down@${held.id}`,
          kind: "standard",
          label: `Put down ${held.name}`,
          targets: { side: "self", count: 0 },
          lifts: { holderId: held.id, name: held.name, down: true },
        });
        continue;
      }
      // Already carried by somebody still standing.
      const bearer = held.carriedBy ? rulesetCombatant(state, held.carriedBy) : undefined;
      if (bearer && rulesetCombatStanding(bearer)) continue;
      if ((actor.budgets[sealed.lifted.budget] ?? 0) < 1) continue;
      if (rulesetCombatantDistance(state, actor, held) > 1) continue;
      options.push({
        id: `sphere:lift@${held.id}`,
        kind: "standard",
        label: `Pick up ${held.name}`,
        budget: sealed.lifted.budget,
        targets: { side: "self", count: 0 },
        lifts: { holderId: held.id, name: held.name },
      });
    }
  }
  const budget = rulesetStandardBudget(combat);
  options.push(...endingOptions(definition, combat, actor));
  for (const action of combat.standard ?? []) {
    if ((actor.budgets[budget] ?? 0) < 1) break;
    // Readying for real (1.288): one entry for each option it may ready, and what it waits for.
    if (action === "ready" && combat.readying) {
      options.push(...readyOptions(options, budget));
      continue;
    }
    options.push({
      id: `standard:${action}`,
      kind: "standard",
      label: action,
      budget,
      // Help is the one that reaches somebody else; the rest are the actor's own stance.
      targets: action === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
    });
  }
  options.push(...grantedStandardOptions(definition, combat, actor, state));
  options.push(endTurn);
  return options;
}

/** What a legendary move lends its maker to walk with (1.283): a share of its turn's allowance,
 *  each way of moving alike, or a distance on every way it moves. Nothing for one held in place,
 *  unless nothing holds it. */
export function rulesetLentMovement(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  move: RulesetCombatMove,
  state?: RulesetEncounterState,
): { movementLeft: number; modeLeft?: Partial<Record<RulesetMoveMode, number>> } {
  const combat = definition.combat;
  if (!combat) return { movementLeft: 0 };
  // Measured as nothing held it, for one nothing holds (Whirlwind of Sand).
  const loose = move.untouchable ? { ...actor, tracked: [], flags: { ...actor.flags } } : actor;
  // One way of moving only (1.285): its share read off that speed, every other way at nothing.
  if (move.speed) {
    const modes = rulesetModeAllowances(definition, combat, loose, state);
    const own =
      move.speed === "walk"
        ? (modes?.walk ?? rulesetMovementAllowance(definition, combat, loose, state, loose.speed))
        : (modes?.[move.speed] ?? 0);
    const cells = own <= 0 ? 0 : move.distance !== undefined ? move.distance : Math.floor((move.share ?? 1) * own);
    return {
      movementLeft: cells,
      modeLeft: {
        ...Object.fromEntries(Object.keys(modes ?? { walk: 0 }).map((mode) => [mode, 0])),
        [move.speed]: cells,
      },
    };
  }
  if (move.distance !== undefined) {
    // A distance is still walked: one held still, or with no speed at all, goes nowhere.
    if (rulesetMovementAllowance(definition, combat, loose, state) <= 0) return { movementLeft: 0 };
    const modes = rulesetModeAllowances(definition, combat, loose, state);
    return {
      movementLeft: move.distance,
      ...(modes
        ? {
            modeLeft: Object.fromEntries(
              Object.entries(modes).map(([mode, cells]) => [mode, (cells ?? 0) > 0 ? move.distance! : 0]),
            ),
          }
        : {}),
    };
  }
  const share = move.share ?? 1;
  const modes = rulesetModeAllowances(definition, combat, loose, state);
  return {
    movementLeft: Math.floor(share * rulesetMovementAllowance(definition, combat, loose, state)),
    ...(modes
      ? {
          modeLeft: Object.fromEntries(
            Object.entries(modes).map(([mode, cells]) => [mode, Math.floor(share * (cells ?? 0))]),
          ),
        }
      : {}),
  };
}

/** Runs `read` with the actor's allowance set to `lent`, and puts its own back afterwards. */
export function rulesetWithMovement<T>(
  actor: RulesetCombatant,
  lent: { movementLeft?: number; modeLeft?: Partial<Record<RulesetMoveMode, number>> },
  read: () => T,
): T {
  const kept = { movementLeft: actor.movementLeft, modeLeft: actor.modeLeft };
  actor.movementLeft = lent.movementLeft;
  if (lent.modeLeft) actor.modeLeft = lent.modeLeft;
  else delete actor.modeLeft;
  try {
    return read();
  } finally {
    if (kept.movementLeft === undefined) delete actor.movementLeft;
    else actor.movementLeft = kept.movementLeft;
    if (kept.modeLeft === undefined) delete actor.modeLeft;
    else actor.modeLeft = kept.modeLeft;
  }
}

/** Where a legendary move may end (1.283), each with the path it walks: on a board only. */
export function rulesetLegendaryMoveCells(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetReachableCell[] {
  if (!action.move || !state.board) return [];
  const lent = rulesetLentMovement(definition, actor, action.move, state);
  if (lent.movementLeft < 1) return [];
  return rulesetWithMovement(actor, lent, () => rulesetReachableCells(definition, state, actor.id));
}

/**
 * What this combatant could buy with its own points RIGHT NOW. A signature action is spent at the
 * end of somebody else's turn, so the actor whose turn it is has none to offer, and the points are
 * given back at the start of its own turn.
 *
 * The window between one turn and the next asks everybody this offers anything to, and its menu is
 * exactly this list (see `rulesetWindowOptions`).
 */
export function rulesetSignatureOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  const points = actor?.signature?.points;
  // Its lair's actions first (1.315), on the lair's own count, whosever turn has just ended.
  const lair = rulesetLairOptions(definition, state, actorId);
  if (!combat || !actor || points === undefined) return lair;
  if (currentRulesetActor(state)?.id === actorId) return lair;
  if (!rulesetCombatStanding(actor) || actor.surprised || blocked(definition, combat, state, actor)) return lair;
  const options: RulesetCombatOption[] = [...lair];
  for (const action of actor.actions) {
    if (!action.signature || action.signature.cost > points) continue;
    if (!rulesetActionAvailable(actor, action, state, definition) || !rulesetSequenceCanHappen(actor, action)) continue;
    // A cast (1.284) offers each spell its maker could cast on its own turn, aimed as it would be.
    if (action.casting) {
      options.push(...rulesetSignatureCasts(definition, state, actor, action, points));
      continue;
    }
    const option: RulesetCombatOption = {
      id: action.id,
      kind: action.kind,
      label: action.label,
      targets: action.targets,
      ...(action.heal ? { heals: true } : {}),
      signature: { cost: action.signature.cost, points },
    };
    // A move (1.283) offers where it may end, and is not offered with nowhere to go. One that
    // follows what its action does (1.285) is offered all the same, and simply goes nowhere.
    if (action.move) {
      const cells = rulesetLegendaryMoveCells(definition, state, actor, action);
      const only = rulesetMovesOnly(action);
      if (only && cells.length === 0) continue;
      if (cells.length > 0) option.cells = cells;
      if (!only) option.moveAfter = true;
    }
    if (action.uses) option.left = rulesetActionUses(actor, action, state);
    const forecast = forecastFor(definition, combat, state, actor, action);
    if (forecast) option.forecast = forecast;
    options.push(option);
  }
  return options;
}

/** Set while a lair's turn is lent (1.315), the only menu its lair actions are on. */
let lairLent = false;

/** The menu as a turn lent for a lair action shows it (1.315): its lair actions on it. */
export function rulesetLentLairTurn<T>(read: () => T): T {
  const was = lairLent;
  lairLent = true;
  try {
    return read();
  } finally {
    lairLent = was;
  }
}

/**
 * The lair actions this combatant may take right now (Capability API 1.315): on its lair's count,
 * once a round, not the one it took the round before, each aimed as it would be on its own turn with the budget
 * it is taken with lent for it. None while it is down or cannot act.
 */
export function rulesetLairOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  const round = actor?.lair ? rulesetLairRound(definition, state, actor) : null;
  if (!combat || !actor?.lair || round === null) return [];
  // Down, it takes none; held from acting, its lent turn's menu offers none.
  if (!rulesetCombatStanding(actor)) return [];
  // Not the one it took the round before; only the one it must take next, when one is (1.327).
  const last = actor.lair.last?.round === round - 1 ? actor.lair.last.id : undefined;
  const next = actor.lair.next;
  const wanted = next === undefined ? [] : typeof next === "string" ? [next] : next;
  const forced = wanted.filter((id) => actor.actions.some((action) => action.lair && action.id === id));
  const lairs = actor.actions.filter(
    (action) => action.lair && (forced.length ? forced.includes(action.id) : action.id !== last),
  );
  const options: RulesetCombatOption[] = [];
  for (const budget of new Set(lairs.map((action) => action.budget))) {
    const view = rulesetBorrowedTurn(state, actor.id, budget);
    for (const option of rulesetLentLairTurn(() => rulesetCombatOptions(definition, view, actor.id))) {
      const own = lairs.find((action) => action.id === option.id);
      if (!own || option.budget !== budget) continue;
      const { budget: _budget, ...rest } = option;
      options.push({ ...rest, id: `${RULESET_LAIR_OPTION_PREFIX}${option.id}`, lairOf: option.id });
    }
  }
  return options;
}

/** What a lair action's option id starts with (1.315), before the option it takes. */
export const RULESET_LAIR_OPTION_PREFIX = "lair>";

/**
 * The fight as its maker's own turn would show it, for a legendary cast (1.284): no window open,
 * its turn, and one of the budget the cast is made with, whatever its own turn left.
 */
export function rulesetBorrowedTurn(
  state: RulesetEncounterState,
  actorId: string,
  budget: string,
): RulesetEncounterState {
  const { window: _window, ...rest } = state;
  return {
    ...rest,
    turn: Math.max(0, state.order.indexOf(actorId)),
    combatants: state.combatants.map((combatant) =>
      combatant.id === actorId
        ? { ...combatant, budgets: { ...combatant.budgets, [budget]: Math.max(1, combatant.budgets[budget] ?? 0) } }
        : combatant,
    ),
  };
}

/**
 * What the Ready action may ready (1.288): each option on the menu taken with the same budget (an
 * attack, a spell, an item's use), and walking, each waiting for an opponent to come where it can
 * reach them or for one to use something.
 */
function readyOptions(menu: RulesetCombatOption[], budget: string): RulesetCombatOption[] {
  const readiable = menu.filter(
    (option) =>
      (option.budget === budget &&
        ["attack", "ability", "block", "contest", "item"].includes(option.kind) &&
        !option.followUp &&
        !option.signature) ||
      (option.id === RULESET_MOVE_OPTION && (option.cells?.length ?? 0) > 0),
  );
  return readiable.flatMap((option) =>
    (["comes", "acts"] as const).map((on) => ({
      id: `${RULESET_READY_OPTION_PREFIX}${option.id}@${on}`,
      kind: "standard" as const,
      label: "ready",
      budget,
      targets: { side: "self" as const, count: 0 },
      ...(option.cost ? { cost: option.cost } : {}),
      ...(option.payWith ? { payWith: option.payWith } : {}),
      ...(option.upcastOnly ? { upcastOnly: true as const } : {}),
      ready: { optionId: option.id, label: option.label, on },
    })),
  );
}

/** What a ready entry's id starts with (1.288): `ready:<option>@<comes|acts>`. */
export const RULESET_READY_OPTION_PREFIX = "ready:";

/** The id a readied option is taken with, in the window its moment opens (1.288). */
export const RULESET_READIED_OPTION = "readied";

/** An action whose cost was paid already (1.288): a spell readied with concentration, now released.
 *  Set only around the step that releases it. */
let freeUse: { actorId: string; actionId: string } | undefined;

/** Runs `step` with this combatant's use of this action costing nothing off its sheet (1.288). */
export function rulesetWithFreeUse<T>(actorId: string, actionId: string, step: () => T): T {
  const before = freeUse;
  freeUse = { actorId, actionId };
  try {
    return step();
  } finally {
    freeUse = before;
  }
}

/** Whether this use is the one already paid for (1.288). */
export function rulesetUseIsFree(actorId: string, actionId: string): boolean {
  return freeUse?.actorId === actorId && freeUse.actionId === actionId;
}

/**
 * The option a readied action is taken with (1.288), as its holder's own menu would show it were
 * it their turn and its budget theirs: aimed, and paid with, as on a turn. A readied walk is a
 * walk of their whole speed, its own allowance kept.
 */
export function rulesetReadiedOption(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatOption | undefined {
  const readied = actor.readied;
  const readying = definition.combat?.readying;
  if (!readied || !readying) return undefined;
  if (readied.optionId === RULESET_MOVE_OPTION) {
    const cells = rulesetLegendaryMoveCells(definition, state, actor, {
      move: { share: 1 },
    } as RulesetCombatAction);
    if (cells.length === 0) return undefined;
    return {
      id: RULESET_READIED_OPTION,
      kind: "move",
      label: readied.label,
      budget: readying.budget,
      targets: { side: "self", count: 0 },
      cells,
      readied: true,
    };
  }
  const own = actor.actions.find((entry) => entry.id === readied.optionId);
  if (!own) return undefined;
  const view = rulesetBorrowedTurn(state, actor.id, own.budget);
  const find = () => rulesetCombatOptions(definition, view, actor.id).find((option) => option.id === readied.optionId);
  const option = readied.paid ? rulesetWithFreeUse(actor.id, own.id, find) : find();
  if (!option) return undefined;
  return { ...option, id: RULESET_READIED_OPTION, budget: readying.budget, readied: true };
}

/** What its holder may spend the standard budget on to end a condition: a save (1.264), 5e's
 *  Irresistible Dance, or a check (1.313), Maze's way out. */
function endingOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  const budget = rulesetStandardBudget(combat);
  if ((actor.budgets[budget] ?? 0) < 1) return [];
  const options: RulesetCombatOption[] = [];
  for (const entry of actor.tracked) {
    const label = definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
    if (entry.saveEnds?.at === "action" && entry.difficulty !== undefined) {
      options.push({
        id: `resave:${entry.condition}`,
        kind: "standard",
        label: `Try to end ${label}`,
        budget,
        targets: { side: "self", count: 0 },
        resave: { condition: entry.condition, label },
      });
    }
    if (entry.checkEnds) {
      options.push({
        id: `checkends:${entry.condition}`,
        kind: "standard",
        label: `Try to end ${label}`,
        budget,
        targets: { side: "self", count: 0 },
        checkEnds: { condition: entry.condition, label },
      });
    }
  }
  return options;
}

/** Whether what its user concentrates on is the cast a repeat makes again (1.310), or one of the
 *  same casting's choices (1.313): Eyebite's three. */
export function rulesetRepeatsHeld(
  actor: Pick<RulesetCombatant, "concentrating" | "actions">,
  again: NonNullable<RulesetCombatAction["again"]>,
): boolean {
  const held = actor.concentrating?.actionId;
  if (held === undefined) return false;
  if (held === again.of) return true;
  if (again.group === undefined) return false;
  return actor.actions.find((one) => one.id === held)?.repeats?.group === again.group;
}

/** Whether an action of a combatant's is one of its spells (1.284): cast out of a catalog, never an
 *  item's use, what a condition lends, or something bought with points. */
export function rulesetIsSpell(action: RulesetCombatAction): boolean {
  return !!action.catalog && action.kind !== "item" && !action.whileHolds && !action.signature && !action.again;
}

/** Each spell a legendary cast offers (1.284): the option its maker's own turn would show for it,
 *  bought with points instead of the budget, and only cantrips where it says so. */
function rulesetSignatureCasts(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  points: number,
): RulesetCombatOption[] {
  const view = rulesetBorrowedTurn(state, actor.id, action.budget);
  return rulesetCombatOptions(definition, view, actor.id).flatMap((spell) => {
    const own = actor.actions.find((entry) => entry.id === spell.id);
    if (!own || !rulesetIsSpell(own) || spell.budget !== action.budget) return [];
    if (action.casting!.cantripsOnly && rulesetPaidLevel(definition, actor, own) !== 0) return [];
    const { budget: _budget, ...rest } = spell;
    return [
      {
        ...rest,
        id: `${action.id}>${spell.id}`,
        label: `${action.label}: ${spell.label}`,
        signature: { cost: action.signature!.cost, points },
        castOf: { actionId: action.id, optionId: spell.id },
      },
    ];
  });
}

/** Letting a window go by. Not an action and not on any turn's menu: the one id a window always
 *  takes, so passing is a choice the fight records rather than a timeout. */
export const RULESET_PASS_OPTION = "pass";

/**
 * The menu of the one combatant a window is asking. Everybody else gets nothing, because a window
 * asks one at a time: the answer spends a budget or points, and two answers at once would spend
 * them against a fight that had already moved.
 *
 * Passing is always legal and is not listed here: it is `RULESET_PASS_OPTION`, which needs no
 * legality of its own.
 */
export function rulesetWindowOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const window = state.window;
  if (!combat || !window || window.waiting[0] !== actorId) return [];
  // Points, not a budget, and priced and checked where every other signature option is.
  if (window.kind === "signature") return rulesetSignatureOptions(definition, state, actorId);

  const actor = rulesetCombatant(state, actorId);
  if (!actor) return [];

  if (window.trigger.kind === "leaves-reach") {
    const opportunity = combat.opportunity;
    // Re-read rather than trusted from when the window opened: an answer before this one may have
    // taken this combatant out, held them still or spent the very budget this would pay with.
    if (!rulesetCombatStanding(actor)) return [];
    const effects = rulesetCombatEffects(definition, combat, actor, state);
    if (effects.has("cannot-act") || effects.has("cannot-react")) return [];
    if (!opportunity || (actor.budgets[opportunity.budget] ?? 0) < 1) return [];
    const mover = rulesetCombatant(state, window.trigger.moverId);
    if (!mover || !rulesetCombatStanding(mover)) return [];
    const strike = rulesetOpportunityAttack(actor);
    if (!strike) return [];
    return [
      {
        id: strike.id,
        kind: strike.kind,
        label: strike.label,
        // Nobody to pick: the strike lands on whoever is walking away, and offering a target would
        // be offering a choice the fight then ignores.
        targets: { side: "self", count: 0 },
        budget: opportunity.budget,
      },
    ];
  }

  // What it readied, now that it has happened (1.288).
  if (window.trigger.kind === "readied") {
    if (!rulesetCombatStanding(actor) || !combat.readying) return [];
    const effects = rulesetCombatEffects(definition, combat, actor, state);
    if (effects.has("cannot-act") || effects.has("cannot-react")) return [];
    if ((actor.budgets[combat.readying.budget] ?? 0) < 1) return [];
    const option = rulesetReadiedOption(definition, state, actor);
    return option ? [option] : [];
  }

  // A moment the Engine noticed, and everything this one holds that waits for exactly it.
  const moment = rulesetWindowMoment(window.trigger);
  if (!moment) return [];
  const source = "sourceId" in window.trigger ? window.trigger.sourceId : "";
  const trigger = window.trigger;
  const cause: RulesetMomentCause = {
    ...("targetIds" in trigger ? { targetIds: trigger.targetIds } : {}),
    ...("optionId" in trigger && rulesetCombatant(state, source)?.block && !("catalog" in trigger && trigger.catalog)
      ? { action: trigger.label }
      : {}),
    ...("catalog" in trigger && trigger.catalog ? { catalog: trigger.catalog } : {}),
    ...("entry" in trigger && trigger.entry ? { entry: trigger.entry } : {}),
    ...(trigger.kind === "hit" && trigger.blow ? { blow: trigger.blow } : {}),
    ...(trigger.kind === "hit" && trigger.weapon ? { weapon: true } : {}),
    ...(trigger.kind === "hit" && !trigger.catalog ? { attack: trigger.label } : {}),
    ...(trigger.kind === "hit" && trigger.budget ? { budget: trigger.budget } : {}),
    ...(trigger.kind === "hit" ? rulesetHitItem(trigger.optionId) : {}),
  };
  // A hit's maker answers it once with each thing they hold (1.241).
  const taken = trigger.kind === "hit" && actorId === source ? (window.taken ?? []) : [];
  return rulesetReactionsAt(definition, combat, state, actor, moment, source, cause)
    .filter((action) => !taken.includes(action.id))
    .map((action) => {
      const option = optionFrom(definition, combat, state, actor, action, true)!;
      // Nobody to pick unless the entry says its holder picks: it is aimed back at whoever caused
      // the moment, or, for something its holder does to themselves, at its holder.
      if (moment === "falls" && action.targets.count > 1) return option;
      return moment === "falls" || action.reaction?.at === "target" || rulesetReactionPointsAtSource(action)
        ? { ...option, targets: { side: "self", count: 0 } }
        : option;
    });
}

/** The item a hit was struck with (1.273), as a moment's cause carries it: none for a blow that is
 *  no item's. */
export function rulesetHitItem(optionId: string): { item?: number } {
  const item = rulesetActionItemIndex({ id: optionId });
  return item !== undefined ? { item } : {};
}

/** Whether what is taken at a moment is aimed back at whoever caused it. False for one its holder
 *  picks targets for, and for one they do to themselves. */
export function rulesetReactionPointsAtSource(action: RulesetCombatAction): boolean {
  return !!action.reaction && action.reaction.at === "source" && action.targets.side !== "self";
}

/**
 * On a held hit, whether taking this answer would turn the hit into a miss: the defense its holder
 * would have once what it puts on them has landed, against the roll that hit. Null when the answer
 * changes no defense of theirs at all, which is how anything other than a guard is weighed.
 */
export function rulesetAnswerDeflects(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  optionId: string,
): boolean | null {
  const combat = definition.combat;
  const window = state.window;
  const held = window?.resume?.kind === "action" ? window.resume.held : undefined;
  if (!combat || window?.trigger.kind !== "hit" || !held) return null;
  const action = actor.actions.find((entry) => entry.id === optionId);
  if (!action || (action.reaction?.at !== "target" && (action.targets.side !== "self" || held.targetId !== actor.id)))
    return null;
  const target = rulesetCombatant(state, held.targetId);
  if (!target) return null;
  const applied = new Set((action.applies ?? []).map((entry) => entry.condition));
  const active = new Set(rulesetCombatConditions(definition, target));
  const gain = (combat.conditions ?? [])
    .filter((entry) => applied.has(entry.condition) && !active.has(entry.condition))
    .flatMap((entry) => entry.modifiers ?? [])
    .reduce((total, modifier) => total + (modifier.to === "defense" ? (modifier.flat ?? 0) : 0), 0);
  if (gain === 0) return null;
  if (held.roll.natural) return false;
  const attacker = window.resume?.kind === "action" ? rulesetCombatant(state, window.resume.actorId) : undefined;
  const blow = attacker && window.resume?.kind === "action" ? actionOf(attacker, window.resume.optionId) : undefined;
  return held.roll.total < rulesetDefenseAgainst(definition, combat, state, target, attacker, blow).defense + gain;
}

/** Which moment a window is, for the reactions that wait for one. A walk and the turn between two
 *  actors are windows of their own kind and wait for nothing. */
export function rulesetWindowMoment(trigger: RulesetWindowTrigger): RulesetReactionMoment | null {
  return trigger.kind === "aimed" ||
    trigger.kind === "hit" ||
    trigger.kind === "harmed" ||
    trigger.kind === "used" ||
    trigger.kind === "falls" ||
    trigger.kind === "turn-start"
    ? trigger.kind
    : null;
}

/**
 * Everything this combatant holds that waits for exactly this moment and could be taken right now.
 *
 * Read BEFORE a window opens, to decide whether there is anybody worth asking, and again while it
 * is open, to build the menu. One reading either way, so a window is never opened for a menu that
 * turns out to be empty.
 */
/** Whether one of a reaction's moments answers what caused it: its `against`, the kind of blow it
 *  names (1.118), and whether its holder has to see whoever caused it (1.118). */
function momentAnswers(
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  sourceId: string,
  moment: RulesetReactionAlso,
  cause: RulesetMomentCause,
): boolean {
  if (!rulesetAgainstMatches(moment.against, cause.catalog, cause.entry, cause.action)) return false;
  // Its holder's own hit, or somebody else's (1.241): never both.
  if (moment.on === "hit" && (moment.by === "self") !== (sourceId === holder.id)) return false;
  if (moment.weapon && !cause.weapon) return false;
  if (moment.names && !(cause.attack !== undefined && rulesetAttackNamed(cause.attack, moment.names))) return false;
  // Only a strike paid for from its budget (1.248): Open Hand Technique, on Flurry of Blows.
  if (moment.budget && cause.budget !== moment.budget) return false;
  // Only a hit with its own item (1.273): charges spent on the staff that struck.
  if (moment.item !== undefined && cause.item !== moment.item) return false;
  if (moment.blow && cause.blow !== moment.blow) return false;
  if (moment.seesSource && !rulesetSees(state, holder, rulesetCombatant(state, sourceId))) return false;
  return true;
}

/** Whether what caused a moment is something this `against` answers: from one of its catalogs, or
 *  one of its entries by name. Nothing narrows a reaction that names neither. */
function rulesetAgainstMatches(
  against: RulesetReactionAgainst | undefined,
  catalog: string | undefined,
  entry: string | undefined,
  action: string | undefined,
): boolean {
  if (!against) return true;
  return (
    (catalog !== undefined && (against.catalogs ?? []).includes(catalog)) ||
    (entry !== undefined && (against.entries ?? []).includes(entry)) ||
    (action !== undefined && (against.actions ?? []).some((name) => name.toLowerCase() === action.toLowerCase()))
  );
}

/** The creature an aimed or hit moment is about, including a nearby ally (1.131). */
export function rulesetReactionTarget(
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  action: RulesetCombatAction,
  moment: RulesetReactionMoment,
  sourceId: string,
  cause: RulesetMomentCause,
): string | undefined {
  if (moment === "turn-start" || moment === "falls" || moment === "used") return sourceId;
  return [action.reaction!, ...(action.reaction?.also ?? [])].flatMap((one) => {
    if (one.on !== moment || !momentAnswers(state, holder, sourceId, one, cause)) return [];
    // Its holder's own blow is about whoever it hit (1.241).
    if (one.by === "self") return (cause.targetIds ?? []).filter((id) => id !== holder.id);
    return (cause.targetIds ?? [holder.id]).filter((id) => {
      if (!one.for || one.for === "self") return id === holder.id;
      const target = rulesetCombatant(state, id);
      return (
        !!target &&
        target.side === holder.side &&
        (one.for !== "ally" || id !== holder.id) &&
        rulesetCombatantDistance(state, holder, target) <= (one.within ?? 0)
      );
    });
  })[0];
}

/** Eligible fallers of this event, nearest first; other events never enter this choice (1.131). */
export function rulesetFallTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): string[] {
  const trigger = state.window?.trigger;
  if (trigger?.kind !== "falls") return [];
  const legal = rulesetOptionTargets(definition, state, actor.id, action);
  return (trigger.fallerIds ?? [trigger.sourceId])
    .filter((id) => legal.includes(id))
    .sort(
      (a, b) =>
        rulesetCombatantDistance(state, actor, rulesetCombatant(state, a)!) -
        rulesetCombatantDistance(state, actor, rulesetCombatant(state, b)!),
    );
}

export function rulesetReactionsAt(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  moment: RulesetReactionMoment,
  /** Whoever caused the moment. One aimed back at them needs them still to BE a target: an answer
   *  before this one may have taken them out, and nothing is offered that the rules would refuse. */
  sourceId: string,
  /** The catalog and entry behind what caused the moment, when there is one (a reaction that answers
   *  only some answers nothing without them), and for a hit, the kind of blow (1.118). */
  cause: RulesetMomentCause = {},
): RulesetCombatAction[] {
  if (!rulesetCombatStanding(actor)) return [];
  const effects = rulesetCombatEffects(definition, combat, actor, state);
  if (effects.has("cannot-act")) return [];
  return actor.actions.filter((action) => {
    if (!action.reaction) return false;
    // Its own moment, or any it is also taken at, each read with its own `against`.
    const moments = [action.reaction, ...(action.reaction.also ?? [])];
    // Choosing what one's own hit does is part of making it, not a reaction to it (1.241).
    if (effects.has("cannot-react") && !moments.every((one) => one.by === "self")) return false;
    if (!moments.some((one) => one.on === moment && momentAnswers(state, actor, sourceId, one, cause))) return false;
    const target = rulesetReactionTarget(state, actor, action, moment, sourceId, cause);
    if ((moment === "aimed" || moment === "hit") && !target) return false;
    if (optionFrom(definition, combat, state, actor, action, true) === null) return false;
    // A bystander's distance is to the creature it protects. An explicit range still limits the
    // answer, but an omitted range does not invent a melee reach to a distant attacker.
    const nearby =
      (moment === "aimed" || moment === "hit") &&
      !!target &&
      (target !== actor.id ||
        moments.some(
          (one) => one.on === moment && one.for === "any" && momentAnswers(state, actor, sourceId, one, cause),
        )) &&
      !action.range &&
      action.reach === undefined;
    if (moment === "turn-start") {
      const source = rulesetCombatant(state, sourceId);
      if (
        !source ||
        (action.targets.side === "enemy" || action.harmful ? source.side === actor.side : source.side !== actor.side)
      )
        return false;
      return rulesetOptionTargets(definition, state, actor.id, action).includes(sourceId);
    }
    if (action.reaction.at === "target" && target && moment !== "falls")
      return rulesetOptionTargets(definition, state, actor.id, action, nearby).includes(target);
    if (moment === "falls" && cause.targetIds && action.targets.count > 1) {
      const legal = rulesetOptionTargets(definition, state, actor.id, action);
      return cause.targetIds.some((id) => legal.includes(id));
    }
    if (
      moment === "falls" &&
      state.window?.trigger.kind === "falls" &&
      state.window.trigger.sourceId === sourceId &&
      action.targets.count > 1
    )
      return rulesetFallTargets(definition, state, actor, action).length > 0;
    // Somebody using something is answered only from where the answer reaches them, whether or not
    // it is aimed back at them: a counter that simply calls it off still has to reach it.
    if (moment === "used" && rulesetTargetRefusal(state, actor.id, action.id, sourceId) !== null) return false;
    if (moment !== "falls" && !rulesetReactionPointsAtSource(action)) return true;
    return rulesetOptionTargets(definition, state, actor.id, action, nearby).includes(sourceId);
  });
}
