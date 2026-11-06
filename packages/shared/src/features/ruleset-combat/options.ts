// The legal menu. Everything that acts in a ruleset fight - a player, an opponent's own choices, a
// forecast - picks an id from here, so legality is decided in exactly one place and a client never
// computes it.

import { rulesetStepAverageTimes } from "./creatures.js";
import { withOwnRulesetPlanMemo, withRulesetPlanMemo } from "../rulesets/plan-memo.js";
import {
  rulesetCombatIsSymbol,
  rulesetSymbolAttackForecast,
  rulesetSymbolChance,
  rulesetSymbolDice,
  rulesetSymbolSuccessDistribution,
  type RulesetSymbolSpend,
  type RulesetSymbolDice,
} from "./symbols.js";
import { rulesetEntryIcons } from "../rulesets/art-icons.js";
import type {
  RulesetCombat,
  RulesetConditionAttaches,
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
  RULESET_SLIP_OPTION_PREFIX,
  RULESET_LEND_OPTION_PREFIX,
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
  rulesetShotAsLoaded,
  rulesetShotsAvailable,
  rulesetStoredNow,
  rulesetItemChargesLeft,
  rulesetItemSlotPayment,
  rulesetHeldChargesMax,
  RULESET_ITEM_SLOT_PREFIX,
} from "./ammo.js";
import { resolveRulesetValueRef, rulesetAbilityModifier, rulesetHeldItemDoes } from "../rulesets/sheet-math.js";
import { rulesetMaterialFor } from "../rulesets/material.js";
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
import type { RulesetSaveAgainst } from "../rulesets/check-effects.js";
import {
  currentRulesetActor,
  rulesetActedThisRound,
  rulesetCombatFailsSave,
  rulesetCombatHide,
  rulesetImmuneToCondition,
  rulesetSaveMode,
  rulesetActiveConditions,
  rulesetItemSuppressed,
  rulesetSuppressedOn,
  rulesetChosenKind,
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
  rulesetCatalogWhereReads,
  rulesetDefiableConditions,
  rulesetDefiance,
  rulesetDefying,
  rulesetCombatStanding,
  rulesetAllyBeside,
  rulesetCombatHurt,
  rulesetSymbolSpendBudget,
  rulesetSymbolSpendStanding,
  rulesetAbilityNarrowing,
  rulesetCheckAbility,
  rulesetCheckMode,
  rulesetConditionModifiers,
  rulesetDamageInEffect,
  rulesetLairRound,
  rulesetEngulfable,
  rulesetSealed,
  rulesetInsideCorpse,
  rulesetSealedApart,
  rulesetSizeRank,
  type RulesetConditionModifier,
  rulesetConditionEconomy,
  rulesetIsAttack,
  rulesetOnOwnTurn,
  rulesetAttackNamed,
  rulesetItemMatches,
  rulesetAbilityScore,
  rulesetModeAllowances,
  rulesetModeRuleHolds,
  rulesetCallWhereHolds,
  rulesetConditionLeft,
  rulesetIgnoredByCreature,
  rulesetMovesOnly,
  rulesetMovementAllowance,
  rulesetSlipCost,
  rulesetSpeedZero,
  rulesetLightMatches,
  rulesetNearProp,
  rulesetPropNamed,
  rulesetStepTimes,
  rulesetItemCallRoll,
  rulesetNoteFight,
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
  rulesetPathCells,
  rulesetSees,
  rulesetOpportunityAttack,
  rulesetBestWeapon,
  rulesetGapFrom,
  rulesetPositionOf,
  rulesetReachableCells,
  rulesetDistanceTo,
  rulesetZoneCells,
  rulesetFootprint,
  rulesetFootprintsSee,
  rulesetGap,
  rulesetActionReach,
  rulesetUnderwater,
  rulesetUnderwaterSpares,
  rulesetJumpCells,
  rulesetNearestCell,
  rulesetSpanOf,
  rulesetCellSolidFor,
  rulesetFootprintAt,
  rulesetFills,
  rulesetWardedFrom,
  rulesetReachBarred,
  rulesetCellBlocked,
} from "./grid.js";
import { coverTier, elevationAt } from "../tactical-combat/math.js";
import {
  rulesetStandingLayers,
  rulesetStandingProps,
  rulesetStandingSections,
  rulesetStandingZones,
  rulesetZoneSeenBy,
  rulesetZoneMoveCells,
  rulesetZoneTurnCells,
} from "./zones.js";
import {
  rulesetCanSee,
  rulesetSeesTrue,
  rulesetCarriesLight,
  rulesetDaylit,
  rulesetHiddenFrom,
  rulesetHidingTraits,
  rulesetStaysHidden,
  rulesetLightAt,
  rulesetSeesCell,
  rulesetStandsObscured,
} from "./sight.js";
import type {
  RulesetBoardProp,
  RulesetAfterAttack,
  RulesetCombatDamage,
  RulesetCombatAgainst,
  RulesetConditionBonus,
  RulesetCombatAction,
  RulesetUnansweredBecause,
  RulesetCombatAlter,
  RulesetCombatAlterOffer,
  RulesetCombatCell,
  RulesetCombatOption,
  RulesetCombatWindow,
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
  const id = optionId.split("#")[0]!;
  const name = id.startsWith("standard:") ? id.slice("standard:".length) : id;
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

/** Up in the air (1.787): off the ground on the board, or flying where there is none, or able only to
 *  fly. What a creature action's `whileFlying` reads. */
export function rulesetUpInTheAir(state: RulesetEncounterState, actor: RulesetCombatant): boolean {
  if (actor.airborne) return true;
  if ((actor.speeds?.fly ?? 0) > 0 && actor.speed <= 0) return true;
  return rulesetAirborne(state.board?.grid, actor);
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
      options.push(
        ...rulesetDisarmOptions(state, actor, {
          id,
          kind: "standard",
          label: name,
          budget: grant.budget,
          targets: name === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
        }),
      );
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
      options.push(
        ...rulesetDisarmOptions(state, actor, {
          id,
          kind: "standard",
          label: name,
          budget: granted.budget,
          targets: name === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
          ...(paid.cost.length > 0 ? { cost: paid.cost } : {}),
          grantedBy: action.label,
        }),
      );
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
  // A disarm names its trap after a `#` (1.669).
  const id = optionId.split("#")[0]!;
  const at = id.indexOf("@");
  if (at < 0) return null;
  const name = id.slice("standard:".length, at);
  const budget = id.slice(at + 1);
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

/** A standard action as the menu offers it: a disarm (1.669) once for each trap of its foes' its
 *  actor's side sees within a cell of it, named after a `#`, and none where there is none. */
function rulesetDisarmOptions(
  state: RulesetEncounterState | undefined,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
): RulesetCombatOption[] {
  if (option.label !== "disarm") return [option];
  if (!state) return [];
  const at = rulesetPositionOf(actor);
  return rulesetStandingZones(state).flatMap(({ caster, zone, action }) => {
    if (!action.zone?.disarm || caster.side === actor.side) return [];
    if (!rulesetZoneSeenBy(caster, zone, action, actor.side)) return [];
    if (
      positioned(state) &&
      at &&
      !rulesetZoneCells(state, caster, zone).some((cell) => rulesetGapFrom(cell, 1, actor) <= 1)
    )
      return [];
    return [
      {
        ...option,
        id: `${option.id}#${caster.id}/${zone.actionId}`,
        label: zone.label,
        disarms: { casterId: caster.id, actionId: zone.actionId },
      },
    ];
  });
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
        (other) =>
          other.id !== mover.id &&
          !others.includes(other.id) &&
          !other.defeated &&
          // One that fills none of its space (1.600) leaves room in it.
          other.block?.fillsSpace !== false &&
          rulesetFills(other, cell),
      ),
  );
}

/** The cells of every standing zone that keeps this combatant from teleporting (1.467): one that
 *  forbids it, which works on them inside (its kind, and not shrugged off). */
function teleportBarred(definition: RulesetDefinition, state: RulesetEncounterState, actor: RulesetCombatant) {
  const barred = new Set<string>();
  for (const { caster, zone, action } of rulesetStandingZones(state)) {
    const rule = action.zone;
    // One passed with a save (1.603) bars no cell.
    if (rule?.forbids?.teleport !== true || zone.shrugged?.includes(actor.id)) continue;
    const is = zone.insideIs ?? rule.inside?.is;
    if (is && !rulesetTargetIs(definition, actor, is)) continue;
    for (const cell of rulesetZoneCells(state, caster, zone)) barred.add(`${cell.x},${cell.y}`);
  }
  return barred;
}

/**
 * Whether teleporting to `at` would put this combatant into a standing zone that lets nobody
 * teleport into it (1.753): Forbiddance. One they already stand in, even in part, they may teleport
 * within; and out of any of them.
 */
export function rulesetTeleportIntoBarred(
  state: RulesetEncounterState,
  one: RulesetCombatant,
  at: RulesetCombatCell,
): boolean {
  const from = rulesetPositionOf(one);
  const span = rulesetSpanOf(one);
  for (const { caster, zone, action } of rulesetStandingZones(state)) {
    if (action.zone?.forbids?.teleport !== "into") continue;
    const cells = new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`));
    const touches = (where: RulesetCombatCell) =>
      rulesetFootprintAt(where, span).some((cell) => cells.has(`${cell.x},${cell.y}`));
    if (from && touches(from)) continue;
    if (touches(at)) return true;
  }
  return false;
}

/** Whether this combatant stands where it may not teleport from (1.467): Hallow. */
export function rulesetTeleportBarredHere(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  const at = rulesetPositionOf(actor);
  if (!at) return false;
  const barred = teleportBarred(definition, state, actor);
  return rulesetFootprintAt(at, rulesetSpanOf(actor)).some((cell) => barred.has(`${cell.x},${cell.y}`));
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
  // Never out of, into or within ground that forbids it (1.467).
  const barred = teleportBarred(definition, state, actor);
  if (rulesetFootprintAt(from, span).some((cell) => barred.has(`${cell.x},${cell.y}`))) return [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (x === from.x && y === from.y) continue;
      const at = { x, y };
      if (rulesetGapFrom(at, span, actor) > teleport.distance) continue;
      if (rulesetFootprintAt(at, span).some((cell) => barred.has(`${cell.x},${cell.y}`))) continue;
      // Nor into ground nobody may teleport into (1.753).
      if (rulesetTeleportIntoBarred(state, actor, at)) continue;
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

/**
 * Where an action that moves its target may set it down (1.565): every cell the target's corner
 * could stand on, with room for it, within the action's distance of where it stands and within the
 * action's range of its user. Where it stands now is one of them, to be lifted straight up.
 */
export function rulesetMovesTargetCells(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  const from = rulesetPositionOf(target);
  if (!grid || !from || !action.movesTarget) return [];
  const span = rulesetSpanOf(target);
  const range = typeof action.range === "number" ? action.range : action.range?.normal;
  const cells: RulesetCombatCell[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const at = { x, y };
      if (rulesetGapFrom(at, span, target) > action.movesTarget.cells) continue;
      if (range !== undefined && rulesetGapFrom(at, span, actor) > range) continue;
      if (!(x === from.x && y === from.y) && !rulesetRoomAt(state, grid, target, at)) continue;
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
/** Striking with what a spell called up (Spiritual Weapon): this, then the id of the cast. */
export const RULESET_SUMMON_OPTION_PREFIX = "summon:";
/** Turning a line or cone its caster carries to face another way (1.182): this, then the action's id. */
export const RULESET_ZONE_TURN_OPTION_PREFIX = "zone-turn:";
/** Closing a zone its caster holds (1.637): an Eversmoking Bottle stoppered. */
export const RULESET_ZONE_CLOSE_OPTION_PREFIX = "zone-close:";
/** Moving a zone anybody near may move on a check (1.694), its caster's id and its action's after. */
export const RULESET_ZONE_CHECK_OPTION_PREFIX = "zone-check:";
export const RULESET_STAND_OPTION = "move:stand";
/** Climbing out of whoever it was inside, once they have fallen (1.405): a purple worm's corpse. */
export const RULESET_CLIMB_OUT_OPTION = "move:climb-out";
/** Mounting a willing creature of its side (1.496): this, then the mount's id. */
export const RULESET_MOUNT_OPTION_PREFIX = "move:mount:";
/** Getting down off a mount (1.496). */
export const RULESET_DISMOUNT_OPTION = "move:dismount";
/** A long jump in a straight line (1.499), to one of its `cells`. */
export const RULESET_JUMP_OPTION = "move:jump";
/** A careful walk (1.689): at half speed over ground that spares slow walkers, uncaught by it. */
export const RULESET_CAREFUL_OPTION = "move:careful";
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
  const own = actor.actions.find((entry) => entry.id === id);
  if (own) return own;
  // A spell a legendary cast offers (1.284) is aimed as the spell itself: without this its sight,
  // area and target rules went unread (cloud re-test 2026-10-26: a Hold Person bought with points
  // picked an invisible halfling four times and was refused each time).
  const cut = id.indexOf(">");
  if (cut < 0 || !actor.actions.find((entry) => entry.id === id.slice(0, cut))?.casting) return undefined;
  return actor.actions.find((entry) => entry.id === id.slice(cut + 1));
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
  // A sequence with no reach of its own reaches as far as its farthest part: a dragon's Multiattack,
  // whose bite reaches 10 feet. Each part is made only at whom it reaches itself.
  if (action.sequence && action.reach === undefined && !action.range && !action.area) {
    let farthest: RulesetOptionReach | null = null;
    for (const step of action.sequence) {
      const part = actor.actions.find((entry) => entry.id === step.actionId);
      if (!part || part.sequence) continue;
      const reach = rulesetOptionReach(state, actorId, part.id);
      if (reach && (!farthest || reach.max > farthest.max)) farthest = reach;
    }
    if (farthest) return farthest;
  }
  // Breaking free of a hold that names its escape DC is a struggle against the hold itself, which
  // its holder throws nothing for, so it is not limited by how far away they stand (1.175).
  if (action.contest?.from && rulesetEscapeDc(actor, action.contest) !== undefined) return null;
  if (action.area) {
    // An area is aimed at a cell rather than at anybody. With a distance of its own it may be sent
    // that far off. With none, a BURST is centred on the actor, because a ball of fire with no range
    // goes off where it is set down, while a cone or a line is aimed within its own size, because
    // there the cell only says which way it points.
    const carried = action.range?.long ?? action.range?.normal;
    // A box with none sits against its maker (1.177), the cell beside them its near corner. Weapon
    // strikes over an area (1.428) go as far as the weapon carries: Volley.
    const shot = action.strikesWith === "ranged" ? rulesetBestWeapon(actor, "ranged")?.range : undefined;
    const max =
      carried ??
      (shot ? (shot.long ?? shot.normal) : undefined) ??
      (action.area.shape === "burst" ? 0 : action.area.shape === "box" ? 1 : action.area.size);
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
  /** What the ruleset says of fighting under water (1.498). */
  definition?: RulesetDefinition,
): "out-of-reach" | "no-line-of-sight" | null {
  // Help against an opponent beside the helper (1.771) aids a friend wherever they stand: it is the
  // opponent who has to be near, and the option is offered only while one is.
  if (definition?.combat?.standardEffects?.help?.beside && rulesetStandardName(optionId) === "help") return null;
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
  const aimed = rulesetCombatant(state, targetId);
  // Somebody inside another creature is reached at that creature (1.407): a cube's engulfed.
  const holder = aimed?.insideOf !== undefined ? rulesetCombatant(state, aimed.insideOf) : undefined;
  const target = holder && rulesetPositionOf(holder) ? holder : aimed;
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
  // Under water a shot never reaches past its normal range (1.498).
  if (definition && actor && target && underwaterTooFar(definition, state, actor, target, optionId))
    return "out-of-reach";
  // Through a layered wall's standing layer that stops it (1.492): Prismatic Wall's red and orange.
  const own = actor ? actionOf(actor, optionId) : undefined;
  if (own && target && rulesetLayersStop(state, own, from, rulesetPositionOf(target) ?? to)) return "no-line-of-sight";
  // Into, out of or across a zone that blocks spells (1.602): Forcecage.
  if (own && target && rulesetSpellsBlocked(state, own, from, rulesetPositionOf(target) ?? to))
    return "no-line-of-sight";
  // Into, out of or across a storm's stage where no ranged weapon is shot (1.557).
  if (own && target && reach.max > 1 && rulesetStormStops(state, own, from, rulesetPositionOf(target) ?? to))
    return "no-line-of-sight";
  // Into, out of or across a wall that turns shots aside (1.581): Wind Wall.
  if (own && target && reach.max > 1 && rulesetShotsTurned(state, own, from, rulesetPositionOf(target) ?? to))
    return "no-line-of-sight";
  // Into, out of or across a zone that blocks them (1.659): Cube of Force.
  if (own && target && reach.max > 1 && rulesetShotsBlocked(state, own, from, rulesetPositionOf(target) ?? to))
    return "no-line-of-sight";
  // Through a barrier that stops reach (1.595): Antilife Shell, with no reach weapon.
  if (definition && own && actor && target && rulesetReachBarred(definition, state, actor, target, own))
    return "out-of-reach";
  return null;
}

/** Whether a zone that turns shots aside stops this attack between two cells (1.581): one from afar
 *  with a weapon that is not magical, into, out of or across it, unless the zone spares it by label.
 *  5e's Wind Wall, which a giant's hurled Rock goes through. */
export function rulesetShotsTurned(
  state: RulesetEncounterState,
  action: RulesetCombatAction,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): boolean {
  if (action.toHit === undefined || action.area || rulesetIsSpell(action)) return false;
  if ((action.qualities ?? action.damage?.qualities)?.includes("magical")) return false;
  const walls = rulesetStandingZones(state).filter(({ action: made }) => {
    const rule = made.zone?.turnsShots;
    if (!rule) return false;
    const name = (action.label ?? "").trim().toLowerCase();
    return !rule.spares?.some((one) => one.trim().toLowerCase() === name);
  });
  if (walls.length === 0) return false;
  const path = new Set([from, to, ...rulesetPathCells(from, to)].map((cell) => `${cell.x},${cell.y}`));
  return walls.some(({ caster, zone }) =>
    rulesetZoneCells(state, caster, zone).some((cell) => path.has(`${cell.x},${cell.y}`)),
  );
}

/** Whether a zone that blocks `ranged` stops this attack between two cells (1.659): one from afar
 *  with a weapon, magical or not, into, out of or across it. 5e's Cube of Force, whose second face
 *  nonliving matter does not pass. A spell or an area is no weapon's. */
export function rulesetShotsBlocked(
  state: RulesetEncounterState,
  action: RulesetCombatAction,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): boolean {
  if (action.toHit === undefined || action.area || rulesetIsSpell(action)) return false;
  const barriers = rulesetStandingZones(state).filter(({ action: made }) => made.zone?.blocks?.ranged);
  if (barriers.length === 0) return false;
  const path = rulesetPathCells(from, to);
  return barriers.some(({ caster, zone }) => {
    const cells = new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`));
    const inFrom = cells.has(`${from.x},${from.y}`);
    const inTo = cells.has(`${to.x},${to.y}`);
    if (inFrom || inTo) return inFrom !== inTo;
    return path.some((cell) => cells.has(`${cell.x},${cell.y}`));
  });
}

/** Whether a zone's stage stops an attack with a ranged weapon between two cells (1.557): one into,
 *  out of or across it while its stage says `noRanged`. 5e's Storm of Vengeance's gusts and freezing
 *  rain. A spell or an area is no weapon. */
export function rulesetStormStops(
  state: RulesetEncounterState,
  action: RulesetCombatAction,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): boolean {
  if (action.toHit === undefined || action.area || rulesetIsSpell(action)) return false;
  const storms = rulesetStandingZones(state).filter(
    ({ zone, action: made }) => zone.stage !== undefined && !!made.zone?.stages?.[zone.stage]?.noRanged,
  );
  if (storms.length === 0) return false;
  const path = new Set([from, to, ...rulesetPathCells(from, to)].map((cell) => `${cell.x},${cell.y}`));
  return storms.some(({ caster, zone }) =>
    rulesetZoneCells(state, caster, zone).some((cell) => path.has(`${cell.x},${cell.y}`)),
  );
}

/** Whether a zone that blocks spells stops this one between two cells (1.602): cast into, out of or
 *  across it. 5e's Forcecage as a box, or a ring's bars. */
export function rulesetSpellsBlocked(
  state: RulesetEncounterState,
  action: RulesetCombatAction,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): boolean {
  if (!rulesetIsSpell(action)) return false;
  const cages = rulesetStandingZones(state).filter(({ action: made }) => made.zone?.blocks?.spells);
  if (cages.length === 0) return false;
  const path = rulesetPathCells(from, to);
  return cages.some(({ caster, zone }) => {
    const cells = new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`));
    const inFrom = cells.has(`${from.x},${from.y}`);
    const inTo = cells.has(`${to.x},${to.y}`);
    if (inFrom || inTo) return inFrom !== inTo;
    return path.some((cell) => cells.has(`${cell.x},${cell.y}`));
  });
}

/** Whether a layered wall's standing layer stops this between two cells (1.492): an attack from afar,
 *  magical or not, or a spell cast across it. Prismatic Wall's red, orange and indigo layers. */
export function rulesetLayersStop(
  state: RulesetEncounterState,
  action: RulesetCombatAction,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): boolean {
  const walls = rulesetStandingLayers(state);
  if (walls.length === 0) return false;
  const spell = rulesetIsSpell(action);
  const magical = spell || (action.qualities ?? action.damage?.qualities)?.includes("magical") === true;
  const kinds = new Set<string>();
  if (spell) kinds.add("spells");
  if (action.toHit !== undefined && !action.area) kinds.add(magical ? "ranged-magical" : "ranged-nonmagical");
  if (kinds.size === 0) return false;
  const path = new Set(rulesetPathCells(from, to).map((cell) => `${cell.x},${cell.y}`));
  if (path.size === 0) return false;
  return walls.some(
    ({ zone, action: made, cells }) =>
      made.zone!.layers!.rows.slice(zone.layersGone ?? 0).some((row) => row.blocks?.some((kind) => kinds.has(kind))) &&
      cells.some((cell) => path.has(`${cell.x},${cell.y}`)),
  );
}

/**
 * The lasting areas an entry that ends what catalogs' entries put on may be aimed at (1.427): ones
 * an entry of those catalogs left standing, any of whose cells is within its reach. Off a board,
 * every such one.
 */
export function rulesetDispelTargets(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): Array<{ casterId: string; actionId: string; label: string }> {
  const ends = action.endsSpells;
  // Or a layered wall one of whose layers names it (1.491): Passwall at a Prismatic Wall.
  // An item's use is read as the entry it names (1.494): a scroll of Passwall.
  const as = action.endsLayers?.as ?? action.entry;
  const breaks = !!action.endsLayers && as !== undefined;
  if (!ends?.zones && !breaks) return [];
  const reach = positioned(state) && rulesetPositionOf(actor) ? rulesetOptionReach(state, actor.id, action.id) : null;
  return rulesetStandingZones(state).flatMap(({ caster, zone, action: made }) => {
    const named = breaks && !!made.zone?.layers?.rows.some((row) => row.endedBy?.entries?.includes(as!));
    if (!named && (!ends?.zones || made.catalog === undefined || !ends.catalogs.includes(made.catalog))) return [];
    // Not one hidden from them (1.455).
    if (!rulesetZoneSeenBy(caster, zone, made, actor.side)) return [];
    if (reach && !rulesetZoneCells(state, caster, zone).some((cell) => rulesetDistanceTo(cell, actor) <= reach.max)) {
      return [];
    }
    return [{ casterId: caster.id, actionId: zone.actionId, label: zone.label }];
  });
}

/**
 * Conditions an attack may be struck at instead of a creature, to cut them away (1.531): those with
 * `cutFree` on a standing creature it reaches, friend or foe, or on its own maker, when it rolls to hit,
 * deals damage of a type that cuts it, and is no area, contest or sequence. A net on its holder.
 */
export function rulesetCutTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): NonNullable<RulesetCombatOption["cuts"]> {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.cutFree)) return [];
  if (action.toHit === undefined || !action.damage || action.area || action.contest || action.sequence) return [];
  if (action.targets.count < 1) return [];
  const type = action.damage.type?.trim().toLowerCase();
  // Whoever it may reach, friend or foe: a net is cut from an ally.
  const targetIds = rulesetOptionTargets(definition, state, actor.id, {
    id: action.id,
    targets: { ...action.targets, side: "any" },
  });
  const cuts: NonNullable<RulesetCombatOption["cuts"]> = [];
  for (const holder of state.combatants) {
    if (holder.defeated || (holder.id !== actor.id && !targetIds.includes(holder.id))) continue;
    for (const entry of rulesetActiveConditions(definition, combat, holder, state)) {
      const rule = entry.cutFree;
      if (!rule) continue;
      if (rule.damageTypes && !rule.damageTypes.some((one) => one.trim().toLowerCase() === type)) continue;
      const held = holder.tracked.find((one) => one.condition === entry.condition);
      if (!held) continue;
      const label =
        definition.sheet.live.conditions.find((live) => live.id === entry.condition)?.label ?? entry.condition;
      cuts.push({ holderId: holder.id, condition: entry.condition, label, left: held.cutLeft ?? rule.health });
    }
  }
  return cuts;
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
    // A layered wall's cells (1.490), its first standing layer struck at.
    ...rulesetStandingLayers(state).flatMap(({ cells }) => cells),
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
  // A sphere or a cube is not centred inside solid rock or a standing wall: its point is somewhere
  // it could be seen landing. A cone or a line only takes a direction from the cell, and a shape
  // laid around props ignores where it was aimed (1.331).
  if (
    (action.area.shape === "burst" || action.area.shape === "box") &&
    !action.area.aroundProp &&
    rulesetCellBlocked(grid, at.x, at.y)
  )
    return false;
  // A lasting sphere held on its caster (Spirit Guardians) goes wherever they are, so the only
  // place it is aimed is where they stand: there is nothing to place.
  if (
    action.zone?.anchor === "caster" &&
    action.area.shape !== "line" &&
    action.area.shape !== "cone" &&
    action.area.shape !== "wall"
  )
    return rulesetFootprint(actor!).some((cell) => cell.x === at.x && cell.y === at.y);
  // From whichever cell the actor fills (1.194).
  if (rulesetDistanceTo(at, actor) > reach.max) return false;
  // Not cast across a layered wall's layer that stops spells (1.492): Prismatic Wall's indigo.
  if (rulesetLayersStop(state, action, from, at)) return false;
  // Nor into, out of or across a zone that blocks spells (1.602).
  if (rulesetSpellsBlocked(state, action, from, at)) return false;
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
  // Asked once for the whole shape, not once a cell: most fights have no zone that blocks spells.
  const caged =
    rulesetIsSpell(action) && rulesetStandingZones(state).some(({ action: made }) => made.zone?.blocks?.spells);
  for (const aim of [at, ...(lay?.also ?? [])]) {
    for (const cell of one(aim)) {
      // Not over into the far side of a zone that blocks spells (1.602): Forcecage's box.
      if (caged && rulesetSpellsBlocked(state, action, aim, cell)) continue;
      cells.set(`${cell.x},${cell.y}`, cell);
    }
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
      // Passed over where it was spent on them already since the rest that frees it (1.628).
      if (action.oncePerTarget && rulesetUsedOnMeans(state, rulesetUsedOn(actor, action), combatant)) return false;
      if (rulesetSparedFrom(actor, action, combatant)) return false;
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
    // Passed over where it was spent on them already (1.628): the Pipes of Haunting's 24 hours.
    if (action.oncePerTarget && rulesetUsedOnMeans(state, rulesetUsedOn(actor, action), combatant)) return false;
    if (rulesetSparedFrom(actor, action, combatant)) return false;
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
  /** Whose effect a save is against, for the cover a condition of theirs gives (1.588). */
  effectFrom?: string,
  /** Cover up to this the attack ignores (1.705): a Wand of the War Mage's half. */
  ignoresUpTo?: "half" | "three-quarters",
): number {
  const cover = combat.cover;
  if (!cover) return 0;
  // Cover a condition on whoever it comes from gives its target (1.588): the Interposing Hand.
  const held = rulesetCoverFor(combat, state, target, attackerId ?? effectFrom);
  const heldBonus =
    held === "three-quarters" ? (cover.threeQuarters ?? cover.bonus) : held === "half" ? cover.bonus : 0;
  const grid = state.board?.grid;
  const at = rulesetPositionOf(target);
  if (!grid || !at) return heldBonus;
  // Somebody standing in the way is half cover, friend or foe, when the ruleset says so.
  const screens = cover.creatures
    ? new Set(
        state.combatants
          .filter((one) => one.id !== target.id && one.id !== attackerId && rulesetCombatStanding(one))
          // Every cell they fill (1.194).
          .flatMap((one) => rulesetFootprint(one).map((cell) => `${cell.x},${cell.y}`)),
      )
    : undefined;
  // A wall that gives cover (1.555), in its standing cells: the most any of them gives.
  const walls = new Map<string, number>();
  for (const { caster, zone, action } of rulesetStandingZones(state)) {
    const gives = action.zone?.cover;
    if (!gives) continue;
    const broken = new Set(
      (zone.sections ?? [])
        .filter((section) => section.health <= 0)
        .flatMap((section) => section.cells.map((cell) => `${cell.x},${cell.y}`)),
    );
    for (const cell of rulesetZoneCells(state, caster, zone)) {
      const key = `${cell.x},${cell.y}`;
      if (!broken.has(key)) walls.set(key, Math.max(walls.get(key) ?? 0, gives === "three-quarters" ? 2 : 1));
    }
  }
  // Somebody bigger than one cell is as covered as the least covered cell they fill (1.194), from
  // whichever cell of the attacker's is nearest it.
  const order = ["none", "half", "three-quarters", "total"] as const;
  let tier: (typeof order)[number] = "none";
  let ground = false;
  if (from) {
    let best = -1;
    for (const cell of rulesetFootprint(target)) {
      const origin = attackerId ? (rulesetNearestCell(rulesetCombatant(state, attackerId), cell) ?? from) : from;
      let here = order.indexOf(coverTier(grid, origin, cell, screens) as (typeof order)[number]);
      if (walls.size > 0 && here < 3) here = Math.max(here, wallCoverBetween(walls, origin, cell));
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
  if (held && order.indexOf(held) > order.indexOf(tier)) tier = held;
  // Ignored up to what the attack ignores (1.705), the ground's own half with it; never total.
  if (ignoresUpTo && tier !== "total" && order.indexOf(tier) <= order.indexOf(ignoresUpTo)) return 0;
  if (tier === "three-quarters" || tier === "total") return cover.threeQuarters ?? cover.bonus;
  // The ground under the target is half cover against an attack, unless the ruleset says cover is
  // only what stands in the way (1.770).
  return tier === "half" || (against === "attack" && ground && cover.groundUnderTarget !== false) ? cover.bonus : 0;
}

/** The most cover a condition on `fromId` gives `target` against it (1.588): one whose applier is
 *  `target`, or with `who: "caller"` was called by `target`, while that applier stands. */
function rulesetCoverFor(
  combat: RulesetCombat,
  state: RulesetEncounterState,
  target: RulesetCombatant,
  fromId: string | undefined,
): "half" | "three-quarters" | undefined {
  const from = fromId ? rulesetCombatant(state, fromId) : undefined;
  if (!from || !combat.conditions?.some((entry) => entry.coverFor)) return undefined;
  let most: "half" | "three-quarters" | undefined;
  for (const tracked of from.tracked) {
    const rule = combat.conditions.find((entry) => entry.condition === tracked.condition)?.coverFor;
    if (!rule || !tracked.source) continue;
    const applier = rulesetCombatant(state, tracked.source);
    if (!applier || !rulesetCombatStanding(applier)) continue;
    const covered = rule.who === "caller" ? applier.calledBy : applier.id;
    if (covered !== target.id) continue;
    if (rule.tier === "three-quarters" || !most) most = rule.tier;
  }
  return most;
}

/** The most cover a wall's cells give on the line between two cells' middles (1.555), never counting
 *  either end. */
function wallCoverBetween(walls: ReadonlyMap<string, number>, from: RulesetCombatCell, to: RulesetCombatCell): number {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * 8;
  let most = 0;
  for (let step = 1; step < steps; step++) {
    const x = Math.round(from.x + ((to.x - from.x) * step) / steps);
    const y = Math.round(from.y + ((to.y - from.y) * step) / steps);
    if ((x === from.x && y === from.y) || (x === to.x && y === to.y)) continue;
    most = Math.max(most, walls.get(`${x},${y}`) ?? 0);
  }
  return most;
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
): { defense: number; cover: number; guards: RulesetConditionBonus[]; unguarded: number } {
  // What the target's own conditions add. Defense is never rolled, so each is its flat number.
  const modifiers = rulesetConditionModifiers(definition, combat, target, "defense", state).filter(
    // Only against an attacker that has hit them already this turn (1.430): Multiattack Defense.
    ({ modifier }) =>
      (!modifier.afterHitBy ||
        (!!attacker &&
          target.hitBy?.at === `${state.round}:${state.turn}` &&
          target.hitBy.ids.includes(attacker.id))) &&
      // Only against one kind of attack (1.509): Arrow-Catching Shield's ranged ones.
      (!modifier.blow ||
        (!!attacker && !!action && rulesetBlowKind(state, attacker, target, action) === modifier.blow)),
  );
  const guards = modifiers
    .filter(({ modifier }) => modifier.atLeast === undefined)
    .map(({ condition, level, derived, item, modifier }) => ({
      condition,
      ...(level !== undefined ? { level } : {}),
      ...(derived ? { derived } : {}),
      ...(item ? { item } : {}),
      value: modifier.flat ?? 0,
    }));
  // What a dropped item gave it is gone with it (1.266): a shield let fall.
  let lost = 0;
  if (target.heldDefense && target.dropped?.length) {
    for (const index of rulesetDroppedItems(target)) lost += target.heldDefense[index] ?? 0;
  }
  lost += rulesetDroppedHeldDefense(target);
  let defense = target.defense - lost + guards.reduce((total, guard) => total + guard.value, 0);
  // What a weapon's bonus lends it (1.737): a Defender's.
  defense += target.bonusShift?.amount ?? 0;
  // Never below a floor (1.406), said as what it raised it by: Barkskin's 16, Mage Armor's 13 + Dex.
  let floor: { value: number; from: (typeof modifiers)[number] } | undefined;
  for (const one of modifiers) {
    if (one.modifier.atLeast === undefined) continue;
    const value = rulesetHolderValue(definition, target, one.modifier.atLeast);
    if (value !== undefined && (!floor || value > floor.value)) floor = { value, from: one };
  }
  if (floor && floor.value > defense) {
    const { condition, level, derived, item } = floor.from;
    guards.push({
      condition,
      ...(level !== undefined ? { level } : {}),
      ...(derived ? { derived } : {}),
      ...(item ? { item } : {}),
      value: floor.value - defense,
    });
    defense = floor.value;
  }
  const ignored = rulesetAgainstHere(definition, action, target, attacker).some((entry) => entry.ignoresCover);
  const cover = ignored
    ? 0
    : rulesetCoverBonus(
        combat,
        state,
        target,
        rulesetPositionOf(attacker),
        "attack",
        attacker?.id,
        undefined,
        rulesetCoverIgnoredBy(definition, combat, state, attacker, target, action),
      );
  const highGround = combat.elevation?.highGround;
  const above = typeof highGround === "object" && rulesetAbove(state, attacker, target) ? highGround.bonus : 0;
  const raised = guards.reduce((total, guard) => total + guard.value, 0);
  return { defense: defense + cover - above, cover, guards, unguarded: defense - raised + cover - above };
}

/** The most cover an attacker's conditions let this attack ignore (1.705): a Wand of the War Mage's
 *  half on a spell attack, Sharpshooter's three-quarters on a ranged weapon attack. */
function rulesetCoverIgnoredBy(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  attacker: RulesetCombatant | undefined,
  target: RulesetCombatant,
  action: RulesetCombatAction | undefined,
): "half" | "three-quarters" | undefined {
  if (!attacker || !action || !combat.conditions?.some((entry) => entry.coverIgnored)) return undefined;
  let most: "half" | "three-quarters" | undefined;
  for (const entry of rulesetActiveConditions(definition, combat, attacker, state)) {
    const rule = entry.coverIgnored;
    if (!rule) continue;
    if (rule.attacks && rule.attacks !== "any" && rule.attacks !== (rulesetWeaponBlow(action) ? "weapon" : "spell"))
      continue;
    if (rule.blow && rulesetBlowKind(state, attacker, target, action) !== rule.blow) continue;
    if (rule.upTo === "three-quarters" || !most) most = rule.upTo;
  }
  return most;
}

/** A floor under defense (1.406): its number, or what it reads off the holder's sheet; a creature
 *  without one reads a `const` or an `abilityMod` off its block. Undefined where nothing can be read. */
/** A number, or a value read off its holder's sheet (a creature without one reads a `const` or an
 *  `abilityMod` off its block): a defense floor (1.406), or what a modifier adds (1.413). */
export function rulesetHolderValue(
  definition: RulesetDefinition,
  target: RulesetCombatant,
  atLeast: number | RulesetValueRef,
): number | undefined {
  if (typeof atLeast === "number") return atLeast;
  if (target.sheet) {
    const { build, live, items } = target.sheet;
    const value = resolveRulesetValueRef(
      definition,
      build,
      atLeast,
      evaluateRulesetSheetLive(definition, build, live, items, target.abilityConditions),
    );
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }
  if ("const" in atLeast && typeof atLeast.const === "number") return atLeast.const;
  if ("abilityMod" in atLeast && typeof atLeast.abilityMod === "string") {
    const score = target.block?.abilities?.[atLeast.abilityMod];
    return score === undefined ? undefined : rulesetAbilityModifier(definition, score);
  }
  return undefined;
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
  cost: Array<{ pool: string; label: string; amount: number; unit?: string; units?: string }>;
  /** What a worn item's charges are left at once it paid (1.572). */
  itemCharges?: { item: number; now: number };
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
  // Out of a worn item's charges, a charge a level, as the pool it stands for (1.572).
  const slot = rulesetItemSlotPayment(payWith);
  if (slot)
    return rulesetUseUsesFree(combatant, action) ? null : itemSlotCost(definition, combatant, action, slot, payWith!);
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
    if (step.op.op === "spend") {
      // What one of it is called, and more than one (1.378): "1 3rd-level slot".
      const declared = definition.sheet.live.pools.find((pool) => pool.id === (step.op as { pool: string }).pool);
      cost.push({
        pool: step.op.pool,
        label: step.label,
        amount: step.op.amount,
        ...(declared?.unit ? { unit: declared.unit } : {}),
        ...(declared?.units ? { units: declared.units } : {}),
      });
    }
  }
  // A pool the ruleset limits per turn or round cannot pay past what is left of that limit, however
  // much is in it.
  if (!rulesetWithinSpendLimits(combatant, cost)) return null;
  return { steps: plan.steps, live, cost };
}

/** Whether a use is paid for already or never paid out of a pool, so no item's charges pay it. */
function rulesetUseUsesFree(combatant: RulesetCombatant, action: RulesetCombatAction): boolean {
  return rulesetUseIsFree(combatant.id, action.id) || !!action.innate || !combatant.sheet || !action.use?.group;
}

/** A use paid out of a worn item's charges (1.572): the item's charges pay for its group, the pool is
 *  of the family at or above the use's own, and the item holds a charge for each of its levels. */
function itemSlotCost(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
  slot: { item: number; pool: string },
  payWith: string,
): RulesetCombatCost | null {
  const held = combatant.sheet?.items?.[slot.item];
  if (!held?.worn || !action.use?.group || held.item.worn?.paysSlots !== action.use.group) return null;
  const family = rulesetPoolFamily(definition, action.use.group);
  const at = family.indexOf(slot.pool);
  if (at < 0 || at < family.indexOf(action.use.pool ?? "")) return null;
  // Only a pool its holder has some of, and none past the item's most (1.590): the Rod of Absorption.
  const most = held.item.worn.paysSlotsMax;
  if (most !== undefined && at > family.indexOf(most)) return null;
  const own = readRulesetLive(
    definition,
    combatant.sheet!.build,
    combatant.sheet!.live,
    combatant.sheet!.items,
  ).pools.find((pool) => !pool.listId && pool.key === slot.pool);
  if (!own || own.max <= 0) return null;
  const level = rulesetPaidLevel(definition, combatant, action, slot.pool);
  const max = rulesetHeldChargesMax(held);
  const left = rulesetItemChargesLeft(combatant, { max, item: slot.item });
  if (level < 1 || left < level) return null;
  return {
    steps: [],
    live: null,
    cost: [{ pool: payWith, label: held.name ?? held.stack?.ref ?? payWith, amount: level }],
    itemCharges: { item: slot.item, now: left - level },
  };
}

/** The ways a use may be paid out of its user's worn items' charges now (1.572), lowest pool first. */
function itemSlotPayments(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
): string[] {
  const group = action.use?.group;
  if (!group || rulesetUseUsesFree(combatant, action)) return [];
  const family = rulesetPoolFamily(definition, group);
  const from = family.indexOf(action.use?.pool ?? "");
  if (from < 0) return [];
  return (combatant.sheet?.items ?? []).flatMap((held, index) =>
    held.worn && held.item.worn?.paysSlots === group
      ? family
          .slice(from)
          .map((pool) => `${RULESET_ITEM_SLOT_PREFIX}${index}:${pool}`)
          .filter((id) => planRulesetCombatCost(definition, combatant, action, id) !== null)
      : [],
  );
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
  // An item's use casts at its own level (1.730).
  if (action.castLevel !== undefined) return action.castLevel;
  const id = rulesetItemSlotPayment(payWith)?.pool ?? payWith ?? action.use?.pool;
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

/** Whether somebody has put one of these conditions on anybody else still holding it (1.715): who
 *  is grappling. */
export function rulesetImposes(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  conditions: readonly string[],
): boolean {
  return state.combatants.some(
    (one) =>
      one.id !== actor.id &&
      !one.defeated &&
      one.tracked.some((entry) => entry.source === actor.id && conditions.includes(entry.condition)),
  );
}

/** How a cast counts under the bonus-action spell rule (1.710): with the rule's own budget, as what
 *  it still allows, or otherwise; undefined for no spell of its catalogs, or with no rule. */
export function rulesetBonusSpellKind(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: Pick<RulesetCombatant, "sheet">,
  action: RulesetCombatAction,
  budget: string,
): "bonus" | "allowed" | "other" | undefined {
  const rule = combat.casting?.afterBonusSpell;
  if (!rule) return undefined;
  const catalog = action.casts ?? action.catalog;
  if (catalog === undefined || !rule.catalogs.includes(catalog)) return undefined;
  if (budget === rule.budget) return "bonus";
  if (budget === rule.only.budget && rulesetPaidLevel(definition, actor, action) <= rule.only.level) return "allowed";
  return "other";
}

/** Whether the bonus-action spell rule bars this cast now (1.710): on its caster's own turn, any
 *  but what it allows after a spell cast with its budget, and none with its budget after another. */
export function rulesetBonusSpellBarred(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  budget: string,
): boolean {
  const cast = actor.flags.spellsCast;
  if (!cast || !rulesetOnOwnTurn(state, actor)) return false;
  const kind = rulesetBonusSpellKind(definition, combat, actor, action, budget);
  if (kind === undefined) return false;
  return (!!cast.bonus && kind !== "allowed") || (!!cast.other && kind === "bonus");
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
  // Out of an item's charges (1.572): as far up as the pool it stands for.
  payWith = rulesetItemSlotPayment(payWith)?.pool ?? payWith;
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
  const escapeDc = rulesetEscapeDc(actor, contest, target);
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
  if (rulesetCombatIsSymbol(combat)) {
    // A side's dice are its check, and what its conditions and wounds add boost or setback (1.382).
    const bonus = rulesetBonusDice(modifiers);
    return rulesetSymbolSuccessDistribution(
      definition,
      rulesetSymbolDice(definition, {
        dice: check.modifier,
        bonus: bonus.flat + rulesetCombatPenalty(definition, combatant),
        boost: combatant.symbolDice?.boost,
        setback: combatant.symbolDice?.setback,
        mode,
      }),
    );
  }
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
export function rulesetEscapeDc(
  actor: RulesetCombatant,
  contest: RulesetCombatContest,
  /** Whom a contest that pulls (1.407) pulls out: their hold's escape DC, else the contest's own. */
  target?: RulesetCombatant,
): number | undefined {
  if (contest.pulls) {
    const hold = target?.tracked.find((entry) => entry.condition === contest.targetHolds);
    return hold?.escapeDc ?? contest.difficulty;
  }
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

/** The key a creature's action spares by (1.674): its `shared` source, or its maker's name and the
 *  action, with the rest that frees it on a sheet. */
export function rulesetSparedKey(
  actor: Pick<RulesetCombatant, "name">,
  action: Pick<RulesetCombatAction, "id" | "sparedAfter">,
): string {
  const rule = action.sparedAfter!;
  return `spared|${rule.until ?? ""}|${rule.shared ?? `${normalizeCharacterLookupName(actor.name)}/${action.id}`}`;
}

/** Whether a creature's action spares this one now (1.674): in this fight, or on their sheet until the
 *  rest that frees it. */
export function rulesetSparedFrom(
  actor: Pick<RulesetCombatant, "name">,
  action: Pick<RulesetCombatAction, "id" | "sparedAfter">,
  target: RulesetCombatant,
): boolean {
  if (!action.sparedAfter) return false;
  const key = rulesetSparedKey(actor, action);
  if (target.auraSafe?.includes(key)) return true;
  const until = action.sparedAfter.until;
  return !!until && !!target.sheet?.live.usedOn?.[`${until}|${key}`];
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

/** Whether using it harms somebody (1.457): an attack, a harmful entry, one aimed at foes, a grab or
 *  shove (breaking free is not), or an area that deals damage. */
export function rulesetActionHarms(action: RulesetCombatAction): boolean {
  return (
    action.kind === "attack" ||
    !!action.harmful ||
    action.targets.side === "enemy" ||
    (!!action.contest && !action.contest.from) ||
    (!!action.area && !!action.damage)
  );
}

/** Whoever this combatant may not point anything at: the source of a condition on them that says
 *  so. A charm keeps a character from turning on whoever charmed them, in the ruleset's own words. */
/** Those `actor` hangs on to by a condition that `attaches` (1.676), with its rule. */
export function rulesetAttachedHolds(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): Array<{ holder: RulesetCombatant; condition: string; rule: RulesetConditionAttaches }> {
  const rules = definition.combat?.conditions;
  if (!rules?.some((one) => one.attaches)) return [];
  return state.combatants.flatMap((holder) =>
    holder.tracked.flatMap((entry) => {
      if (entry.source !== actor.id || holder.id === actor.id) return [];
      const rule = rules.find((one) => one.condition === entry.condition)?.attaches;
      return rule ? [{ holder, condition: entry.condition, rule }] : [];
    }),
  );
}

/** Whom somebody hanging on may not attack (1.676): anybody, for a stirge's `"none"`, or anybody
 *  but whoever they hang on to, for a cloaker's `"holder"`. */
export function rulesetAttachedOffLimits(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): string[] {
  const holds = rulesetAttachedHolds(definition, state, actor);
  if (!holds.length) return [];
  const none = holds.some((one) => one.rule.sourceAttacks === "none");
  return state.combatants
    .filter((one) => none || !holds.some((hold) => hold.holder.id === one.id))
    .map((one) => one.id);
}

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
  // Nor whoever wears what leaves creatures like them alone (1.619): the Pipes of the Sewers' rats.
  for (const one of state.combatants) if (rulesetIgnoredByCreature(one, actor)) forbidden.add(one.id);
  // A turn the dice made a strike at one creature (1.264): nobody else.
  // Or at the nearest it sees (1.543).
  if ((actor.flags.compelled === "strike" || actor.flags.compelled === "nearest") && actor.flags.compelledTarget) {
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
  // Pulled out (1.407) only from inside somebody, and only with a number to meet.
  if (
    contest?.pulls &&
    (combatant.insideOf === undefined || rulesetEscapeDc(combatant, contest, combatant) === undefined)
  )
    return false;
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
export function rulesetHoldsFor(
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
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
  return live.pools.find((entry) => !entry.listId && entry.key === health.pool)?.sealed ?? 0;
}

/** Whether this one stands above the bottom of a live track, so there is a level to take off. */
function rulesetTrackAboveFloor(definition: RulesetDefinition, combatant: RulesetCombatant, track: string): boolean {
  const declared = definition.sheet.live.tracks.find((entry) => entry.id === track);
  if (!declared) return false;
  if (!combatant.sheet) return (combatant.tracks?.[track] ?? declared.default ?? declared.min) > declared.min;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
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
  /** Whom it could be pointed at but for seeing them, for the reason a screen gives (2026-10-25). */
  ignoreSight = false,
): string[] {
  const actor = rulesetCombatant(state, actorId);
  if (!actor || option.targets.count <= 0) return [];
  // An attack given up for one by what they called (1.488): whom that one's attack may reach.
  if (option.id.startsWith(RULESET_LEND_OPTION_PREFIX)) {
    const lent = rulesetLentAttack(state, actor, option.id);
    if (!lent) return [];
    return rulesetOptionTargets(
      definition,
      state,
      lent.called.id,
      { id: lent.attack.id, targets: lent.attack.targets },
      ignoreRange,
      ignoreSight,
    );
  }
  // An area is aimed at a CELL, so nobody is named: which combatants it catches follows from where
  // it lands, and `rulesetAreaTargets` is the one place that answers it.
  if (positioned(state) && actionOf(actor, option.id)?.area) return [];
  const forbidden = rulesetForbiddenTargets(definition, state, actor);
  // Hanging on to somebody (1.676): a stirge attacks nobody, a cloaker nobody but whoever it holds.
  const attacking = actionOf(actor, option.id);
  if (attacking && (rulesetIsAttack(attacking) || attacking.autoHit)) {
    for (const id of rulesetAttachedOffLimits(definition, state, actor)) forbidden.add(id);
  }
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
  // What follows a charge (1.546) is at the one charged alone.
  const pinned = rulesetOnOwnTurn(state, actor)
    ? actor.flags.followUps?.find((one) => one.id === option.id)?.targetId
    : undefined;
  return (
    state.combatants
      .filter((combatant) => {
        if (pinned !== undefined && combatant.id !== pinned) return false;
        // An image seen for one is aimed at no more (1.568).
        if (combatant.illusion?.seenBy.includes(actor.side)) return false;
        // Nor by one who sees it truly (1.649): Witch Sight.
        if (
          combatant.illusion &&
          combatant.calledBy !== actor.id &&
          rulesetSeesTrue(definition, state, actor, combatant)
        )
          return false;
        // Bringing back the dead is aimed at the dead, and only them (1.176), and so is raising one
        // from a corpse (1.554).
        if (cure?.revives) {
          if (!rulesetCanRevive(state, cure, combatant)) return false;
        } else if (cure?.calls?.atCorpse) {
          if (!rulesetRaisableCorpse(definition, state, cure.calls.atCorpse, combatant)) return false;
        } else if (combatant.defeated) return false;
        if (cure && !rulesetCureReaches(definition, cure, combatant, state)) return false;
        // Only on somebody it holds itself (1.553): a pin on "a creature grappled by you".
        if (
          cure?.contest?.targetHeldBySelf &&
          !combatant.tracked.some((entry) => entry.condition === cure.contest!.targetHolds && entry.source === actor.id)
        )
          return false;
        if (!rulesetTargetHasSenses(definition, state, combatant, needs, actionOf(actor, option.id)?.needsAny))
          return false;
        // Only somebody at no health and still alive (1.311): Consume Life.
        if (cure?.dyingOnly && !(combatant.down && !combatant.defeated)) return false;
        // Only somebody who has taken their turn this round (1.327): the Hour Bell.
        if (cure?.actedOnly && !rulesetActedThisRound(state, combatant.id)) return false;
        // "A creature you can see" (1.178).
        if (cure?.seen && !ignoreSight && !rulesetCanSee(definition, state, actor, combatant)) return false;
        // Only on somebody holding what it names (1.235): grappled by its maker, or restrained.
        if (cure?.targetHolds && !rulesetHoldsFor(definition, combatant, actor.id, cure.targetHolds)) return false;
        // Behind a ward it cannot reach (1.179). One that may be paid higher is offered, and its
        // payment decides when it is used.
        if (cure && !cure.use?.group && rulesetWarded(definition, state, actor, cure, combatant)) return false;
        if (!rulesetTargetTypesAllow(definition, combatant, targetTypes, actor)) return false;
        // No bigger than it holds (1.314).
        if (cure?.targetsUpTo && combat?.sizes) {
          const most = combat.sizes.order.findIndex((size) => size.id === cure.targetsUpTo);
          const size = rulesetSizeRank(combat, combatant);
          if (size !== undefined && size > most) return false;
        }
        // A sphere between them (1.314), but for what breaks it, aimed at the one inside, or a hand
        // reaching into the creature that holds them (1.407).
        if (rulesetSealedApart(definition, state, actor, combatant) && !(contest?.pulls && combatant.insideOf)) {
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
        // Help against an opponent beside the helper offers nobody with none there (1.771).
        if (
          rulesetStandardName(option.id) === "help" &&
          definition.combat?.standardEffects?.help?.beside &&
          positioned(state) &&
          rulesetPositionOf(actor) &&
          !foeAdjacent(state, actor)
        )
          return false;
        // "One creature other than you" (1.256).
        if (cure?.notSelf && combatant.id === actor.id) return false;
        // A repeat never at one that saved against the cast (1.310), or only at whom it was aimed at.
        if (cure?.again?.notSaved && actor.concentrating?.saved?.includes(combatant.id)) return false;
        if (cure?.again?.sameTargets && !actor.concentrating?.targets?.includes(combatant.id)) return false;
        // Kept up only on whom it is still on (1.431).
        if (cure?.sustain && !rulesetSustainedOn(actor, cure.sustain.of, combatant)) return false;
        // Used on them already since the rest that frees it (1.304).
        if (cure?.oncePerTarget && rulesetUsedOnMeans(state, rulesetUsedOn(actor, cure), combatant)) return false;
        // A creature's, spared once used on them (1.674): Frightful Presence.
        if (cure && rulesetSparedFrom(actor, cure, combatant)) return false;
        if (option.targets.side === "self") return combatant.id === actor.id;
        // A strike the dice aimed (1.264) is at whoever they picked, friend or foe.
        if (
          (actor.flags.compelled === "strike" || actor.flags.compelled === "nearest") &&
          option.targets.side === "enemy" &&
          combatant.id !== actor.id
        )
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
          ignoreRange ||
          rulesetTargetRefusal(state, actor.id, option.id, combatant.id, option.range, definition) === null,
      )
      // A strike again (1.428): somebody else, near whom the first was at.
      .filter((combatant) => {
        const again = actionOf(actor, option.id)?.strikeAgain;
        if (!again) return true;
        if (combatant.id === again.targetId) return false;
        const first = rulesetCombatant(state, again.targetId);
        return (
          !positioned(state) || !first || !rulesetPositionOf(first) || rulesetGap(first, combatant) <= again.within
        );
      })
      .map((combatant) => combatant.id)
  );
}

/** Why one it would be pointed at is not offered now (2026-10-25): too far, by how far it is and
 *  how far the option reaches, both in cells; no line to them; or not seen, for one that wants it. */
export interface RulesetTargetBeyond {
  id: string;
  why: "out-of-reach" | "no-line-of-sight" | "unseen";
  cells?: number;
  reach?: number;
}

/**
 * Whom an option would be pointed at on a board but cannot be now, and why (laptop playtest
 * 2026-10-25: Hold Person read "Nobody in reach" at 61 feet with a range of 60, and a foe out of
 * sight simply dropped off the list). Nobody off a board, and nobody for an area.
 */
export function rulesetTargetsBeyond(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  option: { id: string; targets: RulesetCombatAction["targets"]; range?: { normal: number; long?: number } },
  offered: readonly string[],
): RulesetTargetBeyond[] {
  const actor = rulesetCombatant(state, actorId);
  if (!actor || !positioned(state) || option.targets.count <= 0 || option.targets.side === "self") return [];
  const action = actionOf(actor, option.id);
  if (action?.area) return [];
  const reach = rulesetOptionReach(state, actorId, option.id, option.range);
  const have = new Set(offered);
  return rulesetOptionTargets(definition, state, actorId, option, true, true).flatMap((id): RulesetTargetBeyond[] => {
    if (have.has(id) || id === actorId) return [];
    const target = rulesetCombatant(state, id);
    if (!target) return [];
    const cells = rulesetPositionOf(target) ? rulesetCombatantDistance(state, actor, target) : undefined;
    const far = { ...(cells !== undefined ? { cells } : {}), ...(reach ? { reach: reach.max } : {}) };
    if (action?.seen && !rulesetCanSee(definition, state, actor, target)) return [{ id, why: "unseen", ...far }];
    const refused = rulesetTargetRefusal(state, actorId, option.id, id, option.range, definition);
    return refused ? [{ id, why: refused, ...far }] : [];
  });
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

/** How a creature's action with no entry is named as a ward's pick (1.758): `action:<name>`. */
function wardPickOf(action: RulesetCombatAction): string | undefined {
  if (action.entry) return action.entry;
  const name = (action.label ?? "").trim().toLowerCase();
  return name ? `action:${name}` : undefined;
}

/**
 * What a ward picked as it is cast may ward off (1.758): every entry and creature action anybody in
 * the fight has, but the standard ones everybody has, once each, by name. Wish.
 */
export function rulesetWardPicks(state: RulesetEncounterState): Array<{ id: string; label: string }> {
  const picks = new Map<string, string>();
  for (const one of state.combatants) {
    if (one.defeated) continue;
    for (const action of one.actions) {
      // Nor the contests the rules give everybody: a grapple, a shove.
      if (action.standard || action.contest || action.onDeath || action.wardPick) continue;
      const id = wardPickOf(action);
      if (id && !picks.has(id)) picks.set(id, action.label);
    }
  }
  return [...picks]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

/** The one thing each ward picked as it was cast wards this combatant off (1.758), from its fight's
 *  conditions and from its sheet. */
function wardPicksOn(target: RulesetCombatant): string[] {
  const live = target.sheet?.live as RulesetLiveState | undefined;
  const held = new Set(live?.conditions ?? []);
  return [
    ...target.tracked.flatMap((entry) => (entry.wardsOff ? [entry.wardsOff] : [])),
    ...Object.entries(live?.wardsOff ?? {}).flatMap(([condition, pick]) => (held.has(condition) ? [pick] : [])),
  ];
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
  // The one thing a ward picked as it was cast keeps off (1.758), from anybody but themselves: Wish.
  if (actor.id !== target.id) {
    const pick = wardPickOf(action);
    if (pick && wardPicksOn(target).includes(pick)) return true;
  }
  const catalog = action.catalog;
  if (!catalog) return false;
  const wards = rulesetWardsOn(state, target);
  // Its holder's own (1.520), from anybody but themselves: a rakshasa's Limited Magic Immunity.
  let held =
    actor.id !== target.id && definition.combat
      ? rulesetActiveConditions(definition, definition.combat, target, state).flatMap((entry) =>
          entry.wards ? [entry.wards] : [],
        )
      : [];
  if (wards.length === 0 && held.length === 0) return false;
  // Only the entries its filter reads so, or names (1.645): Mind Blank's divination, Wish's one spell.
  const takes = (ward: { where?: { filter: string; equals: string | number }; entries?: string[] }) => {
    if (ward.entries && !(action.entry && ward.entries.includes(action.entry))) return false;
    if (!ward.where) return true;
    // Its own filters, carried from the entry it was made from: a catalog of its own file holds
    // no entries in the definition.
    const ref = action.entry;
    const entry = action.filters
      ? { filters: action.filters }
      : ref
        ? definition.catalogs
            ?.find((one) => one.id === ref.slice(0, ref.indexOf("/")))
            ?.entries?.find((one) => one.id === ref.slice(ref.indexOf("/") + 1))
        : undefined;
    return !!entry && rulesetCatalogWhereReads(entry, ward.where);
  };
  held = held.filter(takes);
  const zoned = wards.filter(({ wards: ward }) => takes(ward));
  if (zoned.length === 0 && held.length === 0) return false;
  const own = new Set(rulesetWardsOn(state, actor).map((ward) => ward.key));
  const paid = rulesetPaidLevel(definition, actor, action, payWith);
  // Its own base level, however it was paid (1.181): Globe of Invulnerability.
  const base = action.innate ? action.innate.baseLevel : rulesetPaidLevel(definition, actor, action);
  if (held.some((ward) => ward.catalogs.includes(catalog) && (ward.by === "base" ? base : paid) <= ward.maxLevel)) {
    return true;
  }
  return zoned.some(({ key, wards: ward, caster, zone }) => {
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

/** The slot level a spell of a creature's trait is cast with now (1.642): the lowest at or above its
 *  own with one left, its coven's where it is a coven spell. Undefined with none left, or for a spell
 *  no slot pays for. */
export function rulesetInnateSlot(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  state?: RulesetEncounterState,
): number | undefined {
  const innate = action.innate;
  if (!innate?.slot || !innate.slots) return undefined;
  for (let level = innate.slot; level <= 9; level++) {
    if (rulesetInnateSlotsLeft(actor, action, level, state) >= 1) return level;
  }
  return undefined;
}

/** How many of one level's slots a creature's trait has left (1.642). */
export function rulesetInnateSlotsLeft(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  level: number,
  state?: RulesetEncounterState,
): number {
  const innate = action.innate;
  const declared = innate?.slots?.[String(level)] ?? 0;
  if (innate?.coven) return state?.covenUses?.[`${innate.coven.id}/slot:${level}`] ?? declared;
  return actor.uses[`slot:${level}`] ?? 0;
}

/** Uses left on this holder, or shared by its coven for this spell (1.123). */
export function rulesetActionUses(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  state?: RulesetEncounterState,
): number {
  const coven = action.innate?.coven;
  const key = rulesetUsesKey(action);
  return coven ? (state?.covenUses?.[`${coven.id}/${key}`] ?? action.uses?.count ?? 0) : (actor.uses[key] ?? 0);
}

/** Where an action's uses are counted: its own id, or the action it shares them with. */
export function rulesetUsesKey(action: RulesetCombatAction): string {
  return action.usesKey ?? action.id;
}

/** Whether its holder's sheet, as it stands, allows the action (1.166). A holder without a sheet, or
 *  a caller without the ruleset, has nothing to read, so nothing holds it back. */
export function rulesetActionUsable(
  definition: RulesetDefinition | undefined,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): boolean {
  if (!rulesetSheetWithin(definition, actor, action.usableWhen)) return false;
  // What a failed chance spends instead (1.441) must be there to spend too.
  if (action.chance?.failUses && definition && actor.sheet && !rulesetFailedChanceLive(definition, actor, action))
    return false;
  return true;
}

/** The live state a failed chance leaves (1.441): `live` as it was before the price, with a use of
 *  the row `failUses` names spent instead. Null when that row cannot pay. */
export function rulesetFailedChanceLive(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  live = actor.sheet?.live,
): { live: RulesetLiveState; cost: Array<{ pool: string; label: string; amount: number }> } | null {
  const failUses = action.chance?.failUses;
  if (!failUses || !actor.sheet || !live) return null;
  const { build, catalogs } = actor.sheet;
  // Only the row named (1.443), as `usesOf` spends it: never its entry's other rows, so a failed
  // Divine Intervention keeps its own row beside the plea it spends.
  const plan = planRulesetUse(definition, build, live, catalogs, { op: "use", name: failUses }, 1, undefined, {
    cost: [],
  });
  if (!plan.ok) return null;
  let after = live;
  const cost: Array<{ pool: string; label: string; amount: number }> = [];
  for (const step of plan.steps) {
    const result = applyRulesetSheetOp(definition, build, after, step.op);
    if (!result.ok) return null;
    after = result.live;
    if (step.op.op === "spend") cost.push({ pool: step.op.pool, label: step.label, amount: step.op.amount });
  }
  return { live: after, cost };
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
    evaluateRulesetSheetLive(definition, build, live, items, combatant.abilityConditions),
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
    evaluateRulesetSheetLive(definition, build, live, items, combatant.abilityConditions),
  );
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

/** Whether the action has uses left, has recharged, and has the coven members it needs nearby, and
 *  (given the ruleset) whether its holder's sheet allows it (1.166). */
/** Whether `actor`'s entry `of` put something on `combatant` that is on them still (1.431), which its
 *  copy on a later turn keeps up: Intimidating Presence's frightened. */
export function rulesetSustainedOn(actor: RulesetCombatant, of: string, combatant: RulesetCombatant): boolean {
  return (
    !combatant.defeated &&
    combatant.tracked.some((entry) => entry.source === actor.id && entry.action?.[0] === of && entry.rounds !== null)
  );
}

/**
 * Where an entry its user pays for off their sheet may be stored instead of done (1.524): an item of
 * their own that stores entries of its catalog, worn or carried, or one an ally beside them holds,
 * or an ally beside them that stores entries itself; each with room left for another entry, and the
 * levels still free there. Whether the level it is paid at fits is checked as it is stored.
 */
export function rulesetStoreTargets(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): NonNullable<RulesetCombatOption["storesIn"]> {
  const catalog = action.catalog;
  if (!catalog || !action.entry || !action.use || action.storedIn || action.innate || !actor.sheet) return [];
  const free =
    (stores: { catalogs: string[]; levels: number; count?: number } | undefined, item?: number) =>
    (holder: RulesetCombatant) => {
      if (!stores?.catalogs.includes(catalog)) return 0;
      const now = rulesetStoredNow(holder, item);
      if (now.length >= (stores.count ?? 20)) return 0;
      return stores.levels - now.reduce((total, one) => total + one.level, 0);
    };
  const places: NonNullable<RulesetCombatOption["storesIn"]> = [];
  for (const holder of state.combatants) {
    const own = holder.id === actor.id;
    if (!rulesetCombatStanding(holder) || (!own && (holder.side !== actor.side || rulesetGap(actor, holder) > 1))) {
      continue;
    }
    (holder.sheet?.items ?? []).forEach((held, index) => {
      const room = free(held.item.stores, index)(holder);
      if (room >= 1) places.push({ holderId: holder.id, item: index, label: held.name ?? held.stack?.ref ?? "", room });
    });
    const room = own ? 0 : free(holder.block?.stores)(holder);
    if (room >= 1) places.push({ holderId: holder.id, label: holder.name, room });
  }
  return places;
}

export function rulesetActionAvailable(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  state?: RulesetEncounterState,
  definition?: RulesetDefinition,
): boolean {
  if (!rulesetActionUsable(definition, actor, action)) return false;
  // Made only as a row another action rolled (1.559).
  if (action.rolledPart) return false;
  // Back under a condition for what is left of it (1.616): only while some is, and not while under it.
  for (const entry of action.applies ?? []) {
    const of = typeof entry.duration === "object" ? entry.duration.remainingOf : undefined;
    if (of === undefined || !state) continue;
    if ((rulesetConditionLeft(state, actor, of) ?? 0) < 1) return false;
    if (actor.tracked.some((one) => one.condition === of || one.condition === entry.condition)) return false;
  }
  // A call only where it says (1.614).
  if (definition && action.calls?.onlyWhere && !rulesetCallWhereHolds(definition, actor, state, action.calls.onlyWhere))
    return false;
  // No more of them than it may hold at once (1.554): a wraith's seven specters.
  const most = action.calls?.atMost;
  if (
    most !== undefined &&
    state &&
    state.combatants.filter((one) => one.calledBy === actor.id && one.calledWith === action.id && !one.defeated)
      .length >= most
  )
    return false;
  // Only with a corpse to raise (1.554).
  if (
    action.calls?.atCorpse &&
    definition &&
    state &&
    !state.combatants.some((one) => rulesetRaisableCorpse(definition, state, action.calls!.atCorpse!, one))
  )
    return false;
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
  // Only while its user holds one of these (1.617): the Pipes of the Sewers while played.
  if (action.userHolds && definition) {
    const held = rulesetCombatConditions(definition, actor);
    if (!action.userHolds.some((id) => held.includes(id))) return false;
  }
  // Nothing but a wall's layer to break (1.491): only while such a wall stands within reach.
  if (action.endsLayers?.only && !(state && rulesetDispelTargets(state, actor, action).length > 0)) return false;
  // Only beside a prop (1.332): Fennick's Hymnal at the Year-Wheel.
  if (action.usableNear && !(state && rulesetNearProp(state, actor, action.usableNear.prop, action.usableNear.within)))
    return false;
  // A light only while they carry one, and for nothing once a turn (1.295). Never where they stand in
  // daylight: nobody lights a torch there, so it is neither lit nor to be put out.
  if (action.switches && "carried" in action.switches) {
    if (!definition || !rulesetCarriesLight(definition, actor, state) || rulesetDaylit(actor, state)) return false;
    if (action.free && actor.flags.lightSwitched) return false;
  }
  // Lent by a call (1.739): only while it stands, and where it is taken first, taken once and then
  // wielded. A goat of terror's horns.
  const lentAt = rulesetActionItemIndex(action);
  const lent = lentAt !== undefined ? actor.sheet?.items?.[lentAt]?.lent : undefined;
  if (lent && lentAt !== undefined) {
    const standing = (state?.combatants ?? [])
      .filter((one) => one.calledBy === actor.id && one.calledWith === lent.by && !one.dismissed && !one.defeated)
      .map((one) => one.id);
    if (!standing.length) return false;
    const taken = actor.lentTaken?.[lentAt];
    const taking = !!action.switches && "take" in action.switches;
    if (lent.takes !== undefined && taking === (taken !== undefined && standing.includes(taken))) return false;
  }
  // A weapon's bonus to defense (1.737): once, before their first attack with it this turn.
  if (
    action.switches &&
    "shift" in action.switches &&
    (actor.bonusShift !== undefined || actor.flags.attackedWith?.includes(action.switches.shift.item))
  )
    return false;
  // Pulling one's blows, switched once a turn (1.720), and switched back once: a misclick is undone.
  if (action.switches && "knockOut" in action.switches && actor.flags.knockOutSwitched === "back") return false;
  // Giving its own user back a pool they do not have is nothing (1.252): a 4th-level slot made by a
  // sorcerer with no 4th-level slots at all.
  if (action.restore && action.targets.side === "self" && actor.sheet && definition) {
    const wanted = action.restore.pool.trim().toLowerCase();
    const pools = readRulesetLive(definition, actor.sheet.build, actor.sheet.live, actor.sheet.items).pools;
    if (!pools.some((pool) => pool.key === action.restore!.pool || pool.label.toLowerCase() === wanted)) return false;
  }
  // Sending away who it called only while some of them are here (1.449).
  if (action.switches && "called" in action.switches) {
    const by = action.switches.called;
    if (
      !state?.combatants.some(
        (one) => one.calledBy === actor.id && one.calledWith === by && !one.dismissed && !one.defeated,
      )
    )
      return false;
  }
  // Made again only while its cast is concentrated on (1.310).
  if (action.again && !rulesetRepeatsHeld(actor, action.again)) return false;
  // Or only once everybody it was last aimed at is down (1.604): Hunter's Mark moved on.
  if (
    action.again?.afterTargetDown &&
    state &&
    (actor.concentrating?.targets ?? []).some((id) => {
      const one = rulesetCombatant(state, id);
      return !!one && rulesetCombatStanding(one);
    })
  )
    return false;
  // Kept up only while what it put on is still on somebody (1.431).
  if (action.sustain && state && !state.combatants.some((one) => rulesetSustainedOn(actor, action.sustain!.of, one)))
    return false;
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
    // Only what it still needs once its user's waivers are counted (1.435).
    if (rulesetNeededComponents(definition, actor, action, state).some((component) => stopped.includes(component)))
      return false;
  }
  // A priced material its user carries (1.790): Identify's pearl, Revivify's diamonds.
  if (
    action.material &&
    (!definition || !rulesetMaterialFor(definition, action.material, actor.sheet?.items, actor.itemsUsed))
  )
    return false;
  // Casting from a catalog, or anything needing concentration, a condition stops (1.438): Rage.
  if (definition?.combat && ((action.catalog ?? action.casts) !== undefined || action.concentration)) {
    const cast = action.catalog ?? action.casts;
    const stopped = rulesetActiveConditions(definition, definition.combat, actor, state).some(
      (entry) =>
        (cast !== undefined && !!entry.forbids?.casts?.includes(cast)) ||
        (!!action.concentration && !!entry.forbids?.concentration),
    );
    if (stopped) return false;
  }
  // An entry a condition stops by name (1.646): Wish, once it is lost.
  if (
    action.entry &&
    definition?.combat?.conditions?.some((one) => one.forbids?.entries) &&
    rulesetActiveConditions(definition, definition.combat, actor, state).some((entry) =>
      entry.forbids?.entries?.includes(action.entry!),
    )
  )
    return false;
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
  // A slot to cast it with (1.642).
  if (action.innate?.slot && rulesetInnateSlot(actor, action, state) === undefined) return false;
  // A weapon with nothing loaded or nothing to shoot, and a clip that is full or has nothing to load.
  if (!rulesetShotsAvailable(actor, action)) return false;
  // Nor once the item is spent for good (1.591): an Efreeti Bottle that lost its magic.
  if (action.itemUse && rulesetItemCallRoll(actor, action.itemUse.item).spent) return false;
  // Nor while the item is a creature (1.613), its uses and its blows: a Staff of the Python.
  const itemAt = action.itemUse?.item ?? (/^item:(\d+)$/.exec(action.id) ? Number(action.id.slice(5)) : undefined);
  if (
    itemAt !== undefined &&
    !!state?.combatants.some(
      (one) =>
        one.calledBy === actor.id &&
        one.calledItem?.item === itemAt &&
        one.calledItem.becomes &&
        !one.dismissed &&
        !one.defeated,
    )
  )
    return false;
  // An item's use is not offered where it is suppressed (1.521): a wand in an antimagic field.
  if (
    action.itemUse &&
    action.kind !== "attack" &&
    rulesetItemSuppressed(rulesetSuppressedOn(state, actor), actor.sheet?.items?.[action.itemUse.item]?.item)
  )
    return false;
  // No item used while a condition forbids it (1.525): Feeblemind's magic items. Weapon blows go on.
  const usedItem = action.itemUse && action.kind !== "attack" ? action.itemUse.item : action.storedIn?.item;
  if (usedItem !== undefined && definition?.combat) {
    const tags = actor.sheet?.items?.[usedItem]?.item.tags ?? [];
    const stopped = rulesetActiveConditions(definition, definition.combat, actor, state).some((entry) => {
      const forbidden = entry.forbids?.items;
      return !!forbidden && (!forbidden.tags || forbidden.tags.some((tag) => tags.includes(tag)));
    });
    if (stopped) return false;
  }
  // Cast from an item that stores it (1.524) only while it is worn, and not where it is suppressed.
  if (action.storedIn?.item !== undefined) {
    const held = actor.sheet?.items?.[action.storedIn.item];
    if (!held?.worn || rulesetItemSuppressed(rulesetSuppressedOn(state, actor), held.item)) return false;
  }
  // What goes off by itself at its moment (1.569) is never taken by hand: Contingency.
  if (
    action.storedIn &&
    (action.storedIn.item !== undefined
      ? actor.sheet?.items?.[action.storedIn.item]?.item.stores?.castsOn
      : actor.block?.stores?.castsOn)
  )
    return false;
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
  return action.sequence.some(
    (step) =>
      !step.skipped &&
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
  /** Whom it is read against, where the moment already says (a strike at one walking away); else
   *  the first it may be pointed at. */
  against?: RulesetCombatant,
): RulesetCombatOption["forecast"] | undefined {
  const forecast: NonNullable<RulesetCombatOption["forecast"]> = {};
  // As the conditions its maker holds make it now (1.501), and as the ammunition it would shoot next
  // makes it (1.657): an Arrow of Slaying's clauses on the shot it rides.
  action = rulesetShotAsLoaded(actor, rulesetWeaponNow(definition, state, actor, action));
  // A symbol fight's attack (1.382): the dice it throws, and at whom, for its harm to read.
  let symbolDice: RulesetSymbolDice | undefined;
  let symbolTarget: RulesetCombatant | undefined;
  if (action.sequence) {
    const byId = new Map(actor.actions.map((entry) => [entry.id, entry]));
    // A part that has no use left, or is waiting for its dice, will not happen, so it is not
    // promised either. Counted strike by strike, the way the sequence will resolve: a part with one
    // use left that is named twice lands once, and a part that recharges lands once and is spent.
    const usesLeft = new Map<string, number>();
    const spent = new Set<string>();
    const total = action.sequence.reduce((sum, step) => {
      const part = byId.get(step.actionId);
      if (step.skipped || !rulesetSequencePartAvailable(actor, part) || spent.has(part.id)) return sum;
      // Read against one target, a part that cannot reach them lands nothing on them: a captain's
      // scimitars at somebody across the field.
      if (against && rulesetPositionOf(against) && rulesetGap(actor, against) > rulesetActionReach(part)) return sum;
      // Rolled for (1.643): what its dice come to on average.
      let strikes = step.dice ? rulesetStepAverageTimes(step) : rulesetStepTimes(actor, step);
      if (part.uses) {
        const key = rulesetUsesKey(part);
        const uses = usesLeft.get(key) ?? actor.uses[key] ?? 0;
        strikes = Math.min(strikes, uses);
        usesLeft.set(key, uses - strikes);
      }
      if (part.recharge && strikes > 0) {
        strikes = 1;
        spent.add(part.id);
      }
      // Against one target, each part as likely to land on them as it is: a dagger thrown far, at
      // disadvantage, counts for less than the same dagger beside them.
      const lands = against ? (hitChanceAgainst(definition, combat, state, actor, part, against) ?? 1) : 1;
      return (
        sum +
        (part.damage
          ? lands *
            strikes *
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
                against ?? firstTarget(definition, state, actor, part) ?? undefined,
              ),
              part.damage,
            )
          : 0)
      );
    }, 0);
    if (total > 0) forecast.averageDamage = Math.round(total * 100) / 100;
    return forecast.averageDamage === undefined ? undefined : forecast;
  }
  const target = against ?? firstTarget(definition, state, actor, action) ?? firstAreaTarget(state, actor, action);
  // A contest's chance is the share it would WIN against the first one it may be taken against.
  if (action.contest) {
    const chance = target ? rulesetContestChance(definition, combat, actor, target, action.contest, state) : null;
    return chance === null ? undefined : { hitChance: Math.round(chance * 1000) / 1000 };
  }
  if (action.toHit !== undefined && target) {
    if (rulesetCombatIsSymbol(combat)) {
      // What a hit is worth in a symbol fight is worked out with its harm, below, from these dice.
      symbolDice = symbolDiceAgainst(definition, combat, state, actor, action, target);
      symbolTarget = target;
    }
    const chance = hitChanceAgainst(definition, combat, state, actor, action, target);
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
    if (symbolDice && symbolTarget) {
      // Over every way the throw may come out (1.382): what its successes add, what each side's
      // spends buy, and the target's soak. `worth` is what the AI weighs a hit at.
      const expected = rulesetSymbolAttackForecast(
        definition,
        combat,
        symbolDice,
        average,
        rulesetSoakOf(
          symbolTarget,
          rulesetTargetDamageKind(definition, combat, symbolTarget, damage.type, damage.qualities).kind,
        ),
        // What the fight leaves unbought, its forecast prices at nothing.
        () => rulesetSymbolSpendBudget(definition, state, actor, symbolTarget!),
      );
      forecast.averageDamage = Math.round(expected.averageDamage * 100) / 100;
      forecast.worth = Math.round(expected.worth * 100) / 100;
    }
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

/** What one option is expected to do against each of the ones it may be pointed at, by their ids:
 *  the same numbers the menu shows for the first, worked out for each, so a player choosing between
 *  targets can compare them. Nothing for a sequence, whose parts each pick their own, nor for an
 *  option this actor does not have. */
export function rulesetForecastsByTarget(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  targetIds: readonly string[],
): Record<string, NonNullable<RulesetCombatOption["forecast"]>> {
  const combat = definition.combat;
  const actor = state.combatants.find((one) => one.id === actorId);
  // A lair option's id carries its prefix; the action behind it is the actor's own.
  const action = actor ? actionOf(actor, optionId) : undefined;
  if (!combat || !actor || !action || action.sequence) return {};
  const forecasts: Record<string, NonNullable<RulesetCombatOption["forecast"]>> = {};
  for (const id of targetIds) {
    const target = state.combatants.find((one) => one.id === id);
    const forecast = target ? forecastFor(definition, combat, state, actor, action, target) : undefined;
    if (forecast) forecasts[id] = forecast;
  }
  return forecasts;
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

/** A weapon's blow as the conditions its maker holds make it now (1.501): Magic Weapon's +1,
 *  Shillelagh's spellcasting ability and d8. The action itself when none changes it. */
export function rulesetWeaponNow(
  definition: RulesetDefinition,
  state: RulesetEncounterState | undefined,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatAction {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.weapon) || !rulesetWeaponBlow(action)) return action;
  let changed: RulesetCombatAction | undefined;
  const words = action.label.toLowerCase().split(/[^a-z0-9']+/);
  const modOf = (ability: string | undefined) => {
    const score = ability === undefined ? undefined : rulesetAbilityScore(definition, actor, ability);
    return score === undefined ? undefined : rulesetAbilityModifier(definition, score);
  };
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    const rule = entry.weapon;
    if (!rule) continue;
    const named =
      !!rule.names?.some((name) => words.includes(name.trim().toLowerCase())) ||
      (!!rule.items && rulesetItemMatches({ tags: action.itemTags }, action.label, rule.items));
    if ((rule.names || rule.items) && !named) continue;
    const next = (changed ??= structuredClone(action));
    if (rule.toHit && next.toHit !== undefined) next.toHit += rule.toHit;
    const ability =
      rule.ability ??
      (() => {
        const read = rule.abilityFrom ? actor.sheet?.build.fields?.[rule.abilityFrom] : undefined;
        return typeof read === "string" && read ? read : undefined;
      })();
    if (ability !== undefined && ability !== next.ability) {
      const now = modOf(next.ability);
      const then = modOf(ability);
      if (now !== undefined && then !== undefined) {
        if (next.toHit !== undefined) next.toHit += then - now;
        if (next.damage && next.damageAddsAbility) next.damage.flat += then - now;
        next.ability = ability;
      }
    }
    if (next.damage) {
      if (rule.die && next.damage.count > 0) {
        next.damage.count = 1;
        next.damage.sides = rule.die;
      } else if (rule.die && (rule.names || rule.items) && next.damage.count === 0 && action.damage) {
        // A named blow of flat damage rolls the die instead of its printed number (1.654), its
        // ability's modifier still added: Alter Self's unarmed strikes, a d6.
        const printed = action.damage.flat - (action.damageAddsAbility ? (modOf(action.ability) ?? 0) : 0);
        next.damage.count = 1;
        next.damage.sides = rule.die;
        next.damage.flat -= printed;
      }
      if (rule.damage) next.damage.flat += rule.damage;
      if (rule.qualities) next.damage.qualities = [...new Set([...(next.damage.qualities ?? []), ...rule.qualities])];
    }
  }
  return changed ?? action;
}

/** Whether a change to attacks narrowed to a kind of blow (1.247) reaches this one: a weapon's or a
 *  spell's, struck in reach or from afar. Nothing narrowed reaches a roll it cannot read. */
/** Whether a target is surprised, or has not yet taken a turn in the fight (1.544). A fight from
 *  before 1.544, past its first round, counts everybody as having acted. */
export function rulesetTargetMoment(
  state: RulesetEncounterState | undefined,
  target: RulesetCombatant | undefined,
  when: "surprised" | "not-yet-acted",
): boolean {
  if (!target) return false;
  if (when === "surprised") return !!target.surprised;
  if (!state) return false;
  const took = state.tookTurn ?? (state.round > 1 ? null : []);
  return !!took && !took.includes(target.id);
}

/** Whether a call may raise its creature from this one's corpse (1.554): dead no longer ago than it
 *  says, of the kind it says, and not raised already. */
export function rulesetRaisableCorpse(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  rule: { withinRounds: number; is?: RulesetTargetIs },
  combatant: RulesetCombatant,
): boolean {
  if (!combatant.defeated || combatant.corpseRaised || combatant.object || combatant.diedRound === undefined)
    return false;
  if (combatant.dismissed || combatant.away) return false;
  if (state.round - combatant.diedRound > rule.withinRounds) return false;
  return !rule.is || rulesetTargetIs(definition, combatant, rule.is);
}

/** Whether `target` holds one of `conditions` that `sourceId` put on them (1.553): grappled by them. */
export function rulesetHeldBy(
  target: RulesetCombatant | undefined,
  sourceId: string,
  conditions: readonly string[],
): boolean {
  return !!target?.tracked.some((entry) => conditions.includes(entry.condition) && entry.source === sourceId);
}

export function rulesetAttackModifierReaches(
  modifier: {
    attacks?: "weapon" | "spell" | "any";
    blow?: "melee" | "ranged";
    atTypesIn?: string[];
    whenTarget?: "surprised" | "not-yet-acted";
    targetHoldsFromSelf?: string[];
    at?: RulesetTargetIs;
  },
  state: RulesetEncounterState | undefined,
  actor: RulesetCombatant,
  target: RulesetCombatant | undefined,
  action: RulesetCombatAction | undefined,
  /** Read for a change narrowed to what the holder's sheet chose (1.429); without it, none reaches. */
  definition?: RulesetDefinition,
): boolean {
  // Only at a target surprised, or not yet acted (1.544): Assassinate.
  if (modifier.whenTarget && !rulesetTargetMoment(state, target, modifier.whenTarget)) return false;
  // Only at somebody it holds itself (1.553): Grappler.
  if (modifier.targetHoldsFromSelf && !rulesetHeldBy(target, actor.id, modifier.targetHoldsFromSelf)) return false;
  // Only at a target that is this (1.726): Demon Armor against demons.
  if (modifier.at && (!definition || !target || !rulesetTargetIs(definition, target, modifier.at))) return false;
  // Only at a target of a kind the holder's sheet chose (1.429): Foe Slayer's favored enemies.
  if (
    modifier.atTypesIn &&
    (!definition || !target || !rulesetChosenKind(definition, actor, modifier.atTypesIn, target))
  )
    return false;
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
  if (!combat || !action.damage) return [];
  // No attack roll (1.471): only a change that says it counts there too.
  const unrolled = action.toHit === undefined || !!action.autoHit || !!action.save;
  const weapon = rulesetWeaponBlow(action);
  const holder = taken ? target : actor;
  if (!holder) return [];
  return rulesetConditionModifiers(definition, combat, holder, taken ? "damage-taken" : "damage", state).filter(
    ({ condition, level, item, modifier }) => {
      // Only a fall's own damage (1.413): Slow Fall.
      if (modifier.falls) return false;
      if (unrolled && !modifier.alsoUnrolled) return false;
      if (modifier.attacks && modifier.attacks !== "any" && modifier.attacks !== (weapon ? "weapon" : "spell"))
        return false;
      if (modifier.blow && modifier.blow !== rulesetBlowKind(state, actor, target ?? actor, action)) return false;
      if (modifier.ability && modifier.ability !== action.ability) return false;
      // At a kind the holder's sheet chose (1.429).
      if (modifier.atTypesIn && (!target || !rulesetChosenKind(definition, actor, modifier.atTypesIn, target)))
        return false;
      // At a target surprised, or not yet acted (1.544): a bugbear's Surprise Attack.
      if (modifier.whenTarget && !rulesetTargetMoment(state, target, modifier.whenTarget)) return false;
      // At somebody it holds itself (1.553): Grappler.
      if (modifier.targetHoldsFromSelf && !rulesetHeldBy(target, actor.id, modifier.targetHoldsFromSelf)) return false;
      // At a target that is this (1.726).
      if (modifier.at && (!target || !rulesetTargetIs(definition, target, modifier.at))) return false;
      return (
        !modifier.fromSource ||
        (!item &&
          level === undefined &&
          holder.tracked.some((one) => one.condition === condition && one.source === actor.id))
      );
    },
  );
}

/** Whether a blow's damage, its own or any clause of it, is of one of these types (1.792), read
 *  without case: a clause with no type of its own is the blow's kind. */
export function rulesetDamageCarries(damage: RulesetCombatDamage, types: readonly string[]): boolean {
  const wanted = new Set(types.map((type) => type.toLowerCase()));
  return [damage.type, ...(damage.plus ?? []).map((clause) => clause.type ?? damage.type)].some(
    (type) => !!type && wanted.has(type.toLowerCase()),
  );
}

/** Own additions and multipliers only: a menu cannot promise a target's mark. */
function modifiedAverage(
  average: number,
  modifiers: RulesetConditionModifier[],
  /** The blow's own damage, whose dice a `diceTimes` throws again (1.197). */
  own?: RulesetCombatDamage,
): number {
  for (const { modifier } of modifiers) {
    // Only on a blow carrying one of its types (1.792), as the blow says it deals them.
    if (modifier.onTypes && !(own && rulesetDamageCarries(own, modifier.onTypes))) continue;
    const dice =
      modifier.diceTimes && own && own.count > 0
        ? { count: own.count * (modifier.diceTimes - 1), sides: own.sides, flat: 0 }
        : modifier.dice
          ? parseRulesetCombatDice(modifier.dice)
          : null;
    average += (modifier.flat ?? 0) + (dice ? (modifier.minus ? -1 : 1) * rulesetAverageDamage(dice) : 0);
  }
  return Math.max(
    0,
    average *
      modifiers.reduce(
        (times, { modifier }) =>
          modifier.onTypes && !(own && rulesetDamageCarries(own, modifier.onTypes))
            ? times
            : times * (modifier.times ?? 1),
        1,
      ),
  );
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

/** As many targets as a sequence's strikes now take (1.550), its heads counted as they stand. */
function perHeadTargets(actor: RulesetCombatant, action: RulesetCombatAction): number {
  return (action.sequence ?? []).reduce((total, step) => {
    // Left out, or made at the one an earlier step hit (1.643): no target of its own.
    if (step.skipped || step.ifHit !== undefined) return total;
    const part = actor.actions.find((one) => one.id === step.actionId);
    const times = step.dice ? step.dice.count * step.dice.sides : rulesetStepTimes(actor, step);
    return total + (part ? Math.max(1, part.targets.count) * times : 0);
  }, 0);
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
  // What its holder does as it dies (1.540) is never chosen.
  if (action.onDeath) return null;
  // Only up in the air (1.787): a wyvern's claws.
  if (action.whileFlying && !rulesetUpInTheAir(state, actor)) return null;
  // Only in a shape it names (1.547): its own, or a form's.
  if (action.inShape) {
    const form = actor.shape?.form;
    const now = form ? `${form.catalogId}/${form.entryId}` : "own";
    if (!action.inShape.includes(now)) return null;
  }
  // A signature action is bought with points at the end of somebody else's turn, so it is never on
  // the actor's own menu. `rulesetSignatureOptions` is where it is offered.
  if (action.signature) return null;
  // Nor a lair action (1.315), but on the turn lent for it.
  if (action.lair && !lairLent) return null;
  // Nor what takes longer to cast than a fight lasts (1.462): it stands as the fight starts or not at all.
  if (action.beforeFight) return null;
  // Nor what only casts other entries (1.474): each of those is on the menu instead. Wish.
  if (action.duplicates) return null;
  // Steering a condition (1.464) only while somebody holds it from its user.
  if (
    action.steers &&
    !state.combatants.some((one) =>
      one.tracked.some((entry) => entry.condition === action.steers && entry.source === actor.id),
    )
  ) {
    return null;
  }
  // A reaction waits for its moment, which is never a turn. `rulesetWindowOptions` is where the
  // moment offers it.
  if (action.reaction && !atItsMoment) return null;
  // Spent when its holder's roll fails, never chosen (1.249).
  if (action.rescue) return null;
  // Nothing that harms, for one who may harm nobody (1.457): Symbol of Hopelessness.
  if (rulesetActionHarms(action) && rulesetCombatEffects(definition, combat, actor, state).has("cannot-harm")) {
    return null;
  }
  // Chosen with what it changes, never on its own (1.253): Metamagic.
  if (action.alters) return null;
  // A sequence whose parts are all gone, or all spent, would spend a budget and do nothing.
  if (!rulesetSequenceCanHappen(actor, action)) return null;
  // Breaking free is only there while something holds on.
  if (action.contest?.from && !rulesetContestHolder(state, actor, action.contest)) return null;
  // Only for one who holds what it asks for (1.578): the Grappler feat's pin.
  if (
    action.contest?.actorHolds &&
    !action.contest.actorHolds.every((id) => rulesetCombatConditions(definition, actor).includes(id))
  )
    return null;
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
  // Not while its user holds somebody so (1.715): an ankheg's Acid Spray, not while grappling.
  if (action.unlessImposing && rulesetImposes(state, actor, action.unlessImposing)) return null;
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
  // One that follows paid from a budget of its own (1.546): a lion's bite after its pounce.
  const free = action.free === true || (!!following && !following.budget) || rulesetFreeStrike(actor, action);
  // Its own budget spent, a condition's grant may pay instead (combat C6d): one weapon attack of a
  // single strike, or an item's use, as Haste's extra action allows. A creature's weapon is an
  // attack roll of its stat block at one target: its bite as much as a fighter's sword. Only on the
  // holder's own turn: the extra action is one of its turn, never a reaction's.
  let budget = following?.budget ?? action.budget;
  // After a bonus action's spell, only a cantrip with an action; and the other way about (1.710).
  if (rulesetBonusSpellBarred(definition, combat, state, actor, action, budget)) return null;
  let oneStrike = false;
  let inReach = false;
  if (!free && (actor.budgets[budget] ?? 0) < 1) {
    if (following?.budget) return null;
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
  const payments = [
    ...rulesetPaymentPools(definition, actor, action),
    ...chargePayments(actor, action),
    ...itemSlotPayments(definition, actor, action),
  ];
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
    targets: action.sequence?.some((step) => step.perHead)
      ? { ...action.targets, count: Math.max(1, perHeadTargets(actor, action)) }
      : action.targets,
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
    ...(action.save
      ? {
          saveAgainst: {
            label: definition.sheet.saves.find((one) => one.id === action.save!.save)?.label ?? action.save.save,
            dc: action.save.difficulty,
            onSuccess: action.save.onSuccess,
          },
        }
      : {}),
    ...(rulesetFreeStrike(actor, action) ? { strikes: actor.strikesLeft } : {}),
    ...(action.heal ? { heals: true } : {}),
    ...(action.concentration ? { concentration: true as const } : {}),
    ...(action.switches && ("conjured" in action.switches || "called" in action.switches)
      ? { dismiss: true as const }
      : action.switches
        ? {
            on:
              "item" in action.switches
                ? rulesetItemOn(actor, action.switches.item)
                : "shift" in action.switches || "take" in action.switches
                  ? false
                  : // Pulling one's blows (1.720) is on while they are pulled; a carried light while lit.
                    "knockOut" in action.switches
                    ? !!actor.knocksOut
                    : !actor.doused,
            ...("knockOut" in action.switches ? { knocksOut: true as const } : {}),
            ...(action.switchLabels ? { switchLabels: action.switchLabels } : {}),
          }
        : {}),
    ...(action.menuGroup ? { menuGroup: action.menuGroup } : {}),
    ...(action.restore ? { restores: action.restore.pool } : {}),
    ...(action.again ? { again: true as const } : {}),
    ...(action.sustain ? { sustain: true as const } : {}),
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
  // The slots left at the level it would be cast with (1.642).
  if (action.innate?.slot) {
    const level = rulesetInnateSlot(actor, action, state);
    option.left = level === undefined ? 0 : rulesetInnateSlotsLeft(actor, action, level, state);
  }
  if (action.ammo) option.ammo = rulesetAmmoLeft(actor, action.ammo.tag);
  if (action.clip) option.loaded = { now: rulesetLoaded(actor, action.clip), max: action.clip.max };
  // What an item has left to use: its stack, its charges, or a use's own (1.519).
  if (action.itemUse && (action.itemUse.consumes || action.itemUse.charges || action.itemUse.ownUses)) {
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
      ...(action.area.ringOnly ? { ringOnly: true as const } : {}),
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
    // What each higher payment adds, so the menu can say it: Fireball's +1d6 a level, a Cloudkill
    // that grows (1.267). Targets are `targetsWith`'s.
    const gains: NonNullable<RulesetCombatOption["payGains"]> = {};
    const step = action.use?.perCostStep ?? action.itemUse?.charges?.step?.amount;
    for (const pool of payments) {
      const steps = rulesetCostSteps(definition, action, pool, actor);
      if (steps <= 0) continue;
      const times = action.use?.stepsEvery ? Math.floor(steps / action.use.stepsEvery) : steps;
      const gain: NonNullable<RulesetCombatOption["payGains"]>[string] = {};
      if (step && times > 0) {
        gain.amount = { count: step.count * times, sides: step.sides, flat: (step.flat ?? 0) * times };
        if (action.heal && !action.damage) gain.heals = true;
      }
      if (action.area?.sizePerCostStep) gain.size = action.area.sizePerCostStep * steps;
      // A pool between its steps (Spiritual Weapon's 3rd level, growing every two) is said to add
      // nothing: kept empty rather than left out, so the menu can say so.
      if (Object.keys(gain).length || step) gains[pool] = gain;
    }
    if (Object.keys(gains).length) option.payGains = gains;
  }
  const forecast = forecastFor(definition, combat, state, actor, action);
  if (forecast) option.forecast = forecast;
  // Wall sections it may strike instead (1.200). Not in a window: what is taken at its moment is
  // aimed where its moment says.
  if (!atItsMoment) {
    const walls = rulesetWallTargets(state, actor, action);
    if (walls.length > 0) option.walls = walls;
    // Lasting areas it may end instead (1.427): Dispel Magic on a Wall of Fire.
    const dispels = rulesetDispelTargets(state, actor, action);
    if (dispels.length > 0) option.dispels = dispels;
    // Conditions it may cut away instead (1.531): a net.
    const cuts = definition ? rulesetCutTargets(definition, state, actor, action) : [];
    if (cuts.length > 0) option.cuts = cuts;
    // What it may be stored in instead (1.524): a Ring of Spell Storing.
    const stores = rulesetStoreTargets(state, actor, action);
    if (stores.length > 0) option.storesIn = stores;
  }
  // Whom a layered wall it leaves may spare, picked as it is cast (1.492): Prismatic Wall.
  const spares = action.zone?.layers?.spares;
  if (spares && typeof spares === "object") {
    const ids = state.combatants.filter((one) => !one.defeated && one.id !== actor.id).map((one) => one.id);
    if (ids.length > 0) option.designates = { count: spares.chosen, ids };
  }
  if (action.variantOf) option.variantOf = action.variantOf;
  if (action.variantName) option.variantName = action.variantName;
  if (
    action.area &&
    !rulesetActionHarms(action) &&
    !action.damage &&
    !action.save &&
    !action.applies?.length &&
    !action.push &&
    !action.pull &&
    !action.zone?.triggers?.length
  )
    option.harmless = true;
  // The kinds its zone may strike, one or more named as it is cast (1.753): Forbiddance.
  if (action.kindsOf?.length) option.kindsOf = action.kindsOf.map((kind) => ({ ...kind }));
  // Or the one entry or creature action in the fight it wards off (1.758): Wish.
  if (action.wardPick) {
    const picks = rulesetWardPicks(state);
    if (picks.length === 0) return null;
    option.kindsOf = picks;
    option.kindsOne = true;
  }
  // What its user may pick to end on each target (1.427): Cleansing Touch's one spell.
  if (action.endsSpells?.chosen) {
    const ends = action.endsSpells;
    const choices: NonNullable<RulesetCombatOption["endsChoices"]> = {};
    for (const id of rulesetOptionTargets(definition, state, actor.id, option)) {
      const held = (rulesetCombatant(state, id)?.tracked ?? []).filter(
        (entry) => entry.catalog !== undefined && ends.catalogs.includes(entry.catalog) && !entry.kept,
      );
      const seen = new Set<string>();
      const list = held.flatMap((entry) => {
        if (seen.has(entry.condition)) return [];
        seen.add(entry.condition);
        const label =
          definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
        return [{ condition: entry.condition, label, ...(entry.level !== undefined ? { level: entry.level } : {}) }];
      });
      if (list.length > 0) choices[id] = list;
    }
    if (Object.keys(choices).length > 0) option.endsChoices = choices;
  }
  // Or which of the conditions it ends (1.442): Greater Restoration's one effect.
  if (action.ends?.chosen && !action.endsSpells?.chosen) {
    const ends = action.ends;
    const choices: NonNullable<RulesetCombatOption["endsChoices"]> = {};
    for (const id of rulesetOptionTargets(definition, state, actor.id, option)) {
      const target = rulesetCombatant(state, id);
      if (!target) continue;
      const held = new Set(rulesetCombatConditions(definition, target));
      const list = ends.conditions
        .filter((condition) => held.has(condition))
        .map((condition) => ({
          condition,
          label: definition.sheet.live.conditions.find((one) => one.id === condition)?.label ?? condition,
        }));
      if (list.length > 0) choices[id] = list;
    }
    if (Object.keys(choices).length > 0) option.endsChoices = choices;
  }
  // Where a teleport may go, and who may go along (1.276). With nowhere to go it is not offered.
  // Or out of the fight altogether, where it may leave it (1.279), the only way it goes off a board.
  // Nor leaving the fight from ground that forbids teleporting (1.467).
  if (
    action.teleport?.leaves &&
    rulesetTeleportBarredHere(definition, state, actor) &&
    !rulesetDoesMoreThanTeleport(action)
  ) {
    return null;
  }
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
  // Where each target may be moved to (1.565): Telekinesis. Off a board nobody is moved.
  if (action.movesTarget && positioned(state)) {
    const cells: Record<string, RulesetCombatCell[]> = {};
    for (const id of definition ? rulesetOptionTargets(definition, state, actor.id, option) : []) {
      const target = rulesetCombatant(state, id);
      const list = target ? rulesetMovesTargetCells(state, actor, action, target) : [];
      if (list.length > 0) cells[id] = list;
    }
    const levels = action.movesTarget.up
      ? Math.floor(action.movesTarget.cells / Math.max(1, state.board?.levelCells ?? 1))
      : 0;
    option.movesTarget = { cells, ...(levels > 0 ? { levels } : {}) };
  }
  // A creature's move taken on its own turn (1.607), when it does nothing else: Aggressive. Picked
  // on the board as a walk is; with nowhere to go it is not offered.
  if (action.move && !action.signature && rulesetMovesOnly(action) && rulesetOnOwnTurn(state, actor)) {
    if (!positioned(state) || !definition) return null;
    const cells = rulesetLegendaryMoveCells(definition, state, actor, action);
    if (cells.length === 0) return null;
    option.cells = cells;
    option.targets = { side: "self", count: 0 };
  }
  // Where an engulf may walk to (1.403), through whoever it takes in: picked on the board as a walk
  // is, aimed at nobody. With nowhere to go it is not offered.
  if (action.engulf && positioned(state)) {
    const cells = rulesetEngulfCells(definition, state, actor, action);
    if (cells.length === 0) return null;
    option.cells = cells;
    option.targets = { side: "self", count: 0 };
  }
  // Where a leap may land on others (1.725): picked on the board as a jump is, aimed at nobody.
  // With nowhere to land it is not offered.
  if (action.leapsOnto && positioned(state)) {
    const perCell = combat.distance?.perCell;
    const cells = perCell
      ? rulesetJumpCells(definition, state, actor.id, Math.ceil(action.leapsOnto.atLeast / perCell))
      : [];
    if (cells.length === 0) return null;
    option.cells = cells;
    option.targets = { side: "self", count: 0 };
  }
  // The weapon's other ways to make this attack, each only while its holder has the shots for it,
  // and each with what it is expected to do. Not in a window: what is taken at its moment is made
  // as it is.
  if (action.modes?.length && !atItsMoment) {
    // A repeat only in the mode its cast was made in (1.692): Telekinesis keeps its grip on what it held.
    const kept = rulesetKeptMode(actor, action);
    const modes = action.modes.flatMap((mode) => {
      if (kept !== undefined && mode.id !== kept) return [];
      const moded = rulesetModedAction(definition, action, mode.id);
      if (!moded || !rulesetShotsAvailable(actor, moded)) return [];
      // One that spends the item's charges only while it has them (1.190).
      if (mode.charges && rulesetItemChargesLeft(actor, mode.charges) < mode.charges.cost) return [];
      // A call only where it says (1.614): Children of the Night's bats away from the sun.
      if (mode.call?.onlyWhere && !rulesetCallWhereHolds(definition, actor, state, mode.call.onlyWhere)) return [];
      const expected = forecastFor(definition, combat, state, actor, moded);
      return [
        {
          id: mode.id,
          label: mode.label,
          targets: moded.targets.count,
          ...(expected ? { forecast: expected } : {}),
          ...(mode.appliesPick !== undefined ? { appliesPick: mode.appliesPick } : {}),
        },
      ];
    });
    if (modes.length > 0) option.modes = modes;
  }
  // A shape change with no form its user may take is not offered (1.392).
  if (action.shapes && !option.modes?.length) return null;
  // A call among options (1.394) with none found offers nothing.
  if (action.callChoice && !option.modes?.length) return null;
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
        cost: one.usesSpentByLevel ? Math.max(1, level) : one.use ? (one.use.count ?? 1) : 0,
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
  // Only the entries its filter reads so (1.414).
  if (alter.entries && !alter.entries.includes(action.entry ?? "")) return false;
  // Only damage to maximize (1.415).
  if (alter.maximizes && !action.damage) return false;
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

/** Whether an alteration that maximizes fits an entry paid at this level (1.415): Overchannel's 1st
 *  through 5th. */
export function rulesetAlterLevelFits(alter: RulesetCombatAlter, level: number): boolean {
  const range = alter.maximizes;
  if (!range) return true;
  return (
    (range.fromLevel === undefined || level >= range.fromLevel) &&
    (range.upToLevel === undefined || level <= range.upToLevel)
  );
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
    if (alter.spares) {
      altered.spares = Math.max(altered.spares ?? 0, alter.spares);
      if (alter.sparesWhole) altered.sparesWhole = true;
      if (alter.sparesByLevel) altered.sparesByLevel = true;
    }
    if (alter.rerolls) altered.rerolls = Math.max(altered.rerolls ?? 0, alter.rerolls);
    if (alter.heightens) altered.heightens = true;
    if (alter.maximizes) altered.maximizes = true;
  }
  // As many more as the level it is paid at (1.414) are counted as it resolves.
  if (spared && altered.spares) altered.spared = altered.sparesByLevel ? [...spared] : spared.slice(0, altered.spares);
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
    if (!rulesetAlterLevelFits(alter, level)) return [];
    // One that moves it to another budget only while that budget is left to spend and may pay for
    // it (cheap-GM playtest 2026-10-26: Quickened asked about on every spell, the bonus action gone).
    if (alter.budget && !budgetLeftFor(definition, state, actor, rulesetAlteredAction(action, [one]), alter.budget.to))
      return [];
    const planned = planRulesetAlterCost(definition, actor, one, action);
    if (!planned) return [];
    // What it really spends: a feature with no uses to count (Sculpt Spells) costs nothing at all.
    const spends = planned.cost.reduce((sum, entry) => sum + entry.amount, 0);
    return [
      {
        id: one.id,
        label: one.label,
        cost: one.usesSpentByLevel
          ? Math.max(1, level)
          : spends > 0
            ? spends
            : one.use && planned.steps.length > 0
              ? (one.use.count ?? 1)
              : 0,
        ...(one.usesSpentByLevel ? { perLevel: true as const } : {}),
        ...(alter.twins ? { twins: true as const } : {}),
        ...(alter.joins ? { joins: true as const } : {}),
        ...(alter.budget ? { budget: alter.budget.to } : {}),
        // As many as the resolver spares: and the level it is paid at, for Sculpt Spells (1.414).
        ...(alter.spares ? { spares: alter.spares + (alter.sparesByLevel ? level : 0) } : {}),
        ...(alter.sparesByLevel ? { sparesByLevel: true as const } : {}),
        ...(alter.heightens ? { heightens: true as const } : {}),
        ...(alter.range ? { ranges: true as const } : {}),
      },
    ];
  });
}

/** Whether the actor has this budget left to spend on the action now, on their own turn: one of it,
 *  and no spell before it this turn that bars it (1.710). Off their turn nothing is spent from it. */
function budgetLeftFor(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  budget: string,
): boolean {
  if (!rulesetOnOwnTurn(state, actor)) return true;
  if ((actor.budgets[budget] ?? 0) < 1) return false;
  return !definition.combat || !rulesetBonusSpellBarred(definition, definition.combat, state, actor, action, budget);
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

/** What an attack's roll against this target is made of: its defense, roll mode, bonus dice and to-hit. */
function attackRollAgainst(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction & { toHit: number },
  target: RulesetCombatant,
) {
  const defense = rulesetDefenseAgainst(definition, combat, state, target, actor, action).defense;
  const mode = rulesetAttackMode(definition, combat, actor, target, { state, optionId: action.id, action });
  const bonus = rulesetBonusDice(
    rulesetConditionModifiers(definition, combat, actor, "attacks", state, undefined, undefined, action.ability).filter(
      ({ modifier }) => rulesetAttackModifierReaches(modifier, state, actor, target, action, definition),
    ),
  );
  // What the weapon adds against what the target is (1.187), as the roll will.
  const toHit = action.toHit + rulesetToHitAgainst(definition, action, target, actor);
  return { defense, mode, bonus, toHit };
}

/** A symbol fight's attack (1.382): the attacker's dice against the target's difficulty dice, exactly
 *  as the throw will be made. None outside a symbol fight, or for anything not rolled to hit. */
function symbolDiceAgainst(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): RulesetSymbolDice | undefined {
  if (action.toHit === undefined || !rulesetCombatIsSymbol(combat)) return undefined;
  const { defense, mode, bonus, toHit } = attackRollAgainst(
    definition,
    combat,
    state,
    actor,
    { ...action, toHit: action.toHit },
    target,
  );
  return rulesetSymbolDice(definition, {
    dice: toHit,
    upgrades: action.upgrades,
    difficulty: defense,
    bonus: bonus.flat + rulesetCombatPenalty(definition, actor),
    boost: actor.symbolDice?.boost,
    setback: actor.symbolDice?.setback,
    mode,
  });
}

/** The chance an attack lands on this target: the same number the roll will be made against (the
 *  target's own defense plus whatever the ground they stand on is worth) and the same roll mode. */
function hitChanceAgainst(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): number | null {
  if (action.toHit === undefined) return null;
  const symbol = symbolDiceAgainst(definition, combat, state, actor, action, target);
  if (symbol) return rulesetSymbolChance(definition, symbol);
  const { defense, mode, bonus, toHit } = attackRollAgainst(
    definition,
    combat,
    state,
    actor,
    { ...action, toHit: action.toHit },
    target,
  );
  return rulesetCombatIsPool(combat)
    ? rulesetPoolChance(
        definition,
        toHit + bonus.flat + rulesetCombatPenalty(definition, actor),
        Math.max(1, defense),
        mode,
        action.target,
      )
    : rulesetHitChance(combat, toHit, defense, mode, bonus, actor.criticalFrom);
}

/** An attack option's chance against each target it may be aimed at, for a player picking one: the
 *  menu's own forecast reads only the first. Empty for anything not rolled to hit. */
export function rulesetHitChances(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  targetIds: readonly string[],
): Record<string, number> {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  const action = actor?.actions.find((one) => one.id === optionId);
  if (!combat || !actor || !action || action.toHit === undefined || action.autoHit || action.contest) return {};
  const chances: Record<string, number> = {};
  for (const id of targetIds) {
    const target = rulesetCombatant(state, id);
    const chance = target ? hitChanceAgainst(definition, combat, state, actor, action, target) : null;
    if (chance !== null) chances[id] = Math.round(chance * 1000) / 1000;
  }
  return chances;
}

/** What an action of a sequence (a Multiattack) is expected to do to this one target: only the
 *  parts that reach them count. Undefined for anything else, whose forecast is the option's own. */
export function rulesetSequenceForecastAgainst(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  targetId: string,
): RulesetCombatOption["forecast"] | undefined {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  const action = actor?.actions.find((one) => one.id === optionId);
  const target = rulesetCombatant(state, targetId);
  if (!combat || !actor || !action?.sequence || !target) return undefined;
  return forecastFor(definition, combat, state, actor, action, target) ?? {};
}

/** A save option's chance each target fails its save, for a player picking one (playtest): the save
 *  as it will be thrown, its own modifier and what its conditions add against the difficulty, rolled
 *  twice where they say so. Nought for one that saves outright or has a Legendary Resistance left,
 *  one for one that fails without rolling. Empty for anything rolled to hit first, with no save, or
 *  in a fight of dice pools, whose saves count successes. */
export function rulesetSaveFailChances(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  optionId: string,
  targetIds: readonly string[],
): Record<string, number> {
  const combat = definition.combat;
  const actor = rulesetCombatant(state, actorId);
  const action = actor?.actions.find((one) => one.id === optionId);
  const save = action?.save;
  if (!combat?.attackRoll || rulesetCombatIsPool(combat) || !actor || !action || !save || action.toHit !== undefined)
    return {};
  // A save has no natural that lands or misses on its own: the total against the difficulty.
  const plain: RulesetCombat = {
    ...combat,
    attackRoll: { ...combat.attackRoll, naturals: { ...combat.attackRoll.naturals, max: "none", min: "none" } },
  };
  const against: RulesetSaveAgainst = {
    conditions: [...(action.applies?.map((one) => one.condition) ?? []), ...(save.against?.conditions ?? [])],
    damage: [
      action.damage?.type,
      ...(action.damage?.plus ?? []).map((one) => one.type),
      ...(save.against?.damage ?? []),
    ].filter((type): type is string => type !== undefined),
    magic: (action.qualities ?? action.damage?.qualities)?.includes("magical") === true,
    ...(save.against?.qualities ? { qualities: save.against.qualities } : {}),
    action: [action.id, action.label, ...(action.recharge?.group ? [action.recharge.group] : [])],
    ...((action.casts ?? action.catalog) ? { catalog: action.casts ?? action.catalog } : {}),
    ...(targetIds.length === 1 ? { alone: true } : {}),
  };
  const chances: Record<string, number> = {};
  for (const id of targetIds) {
    const target = rulesetCombatant(state, id);
    if (!target) continue;
    if (target.object || rulesetCombatFailsSave(definition, combat, target, save.save, state)) {
      chances[id] = 1;
      continue;
    }
    const outright =
      (save.succeeds?.is && rulesetTargetIs(definition, target, save.succeeds.is)) ||
      save.succeeds?.conditionImmune?.some((condition) =>
        rulesetImmuneToCondition(target, condition, definition, state),
      ) ||
      (save.succeeds?.immune?.length &&
        save.succeeds.immune.some((type) =>
          rulesetCombatHide(definition, target, state).immune.some(
            (entry) =>
              (typeof entry === "string" ? entry : entry.type).trim().toLowerCase() === type.trim().toLowerCase(),
          ),
        ));
    const resists = (target.block?.legendaryResistance ?? 0) > (target.legendaryResisted ?? 0);
    if (outright || resists) {
      chances[id] = 0;
      continue;
    }
    const leans = new Set(
      (save.modes ?? []).filter((entry) => rulesetTargetIs(definition, target, entry.is)).map((entry) => entry.mode),
    );
    if (save.advantageIfFought && target.side !== actor.side) leans.add("advantage");
    const lean = leans.size === 1 ? [...leans][0] : undefined;
    const seen = target.id === actor.id || rulesetCanSee(definition, state, target, actor);
    const mode = rulesetSaveMode(definition, combat, target, save.save, state, against, lean, seen);
    const bonus = rulesetBonusDice(
      rulesetConditionModifiers(definition, combat, target, "saves", state, save.save, against),
    );
    const saves = rulesetHitChance(plain, target.saves[save.save] ?? 0, save.difficulty, mode, bonus);
    if (saves !== null) chances[id] = Math.round((1 - saves) * 1000) / 1000;
  }
  return chances;
}

/** What pushed an attack roll up and down, named: a condition's label, or an `@`-name. */
export interface RulesetAttackModeWhy {
  up: string[];
  down: string[];
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
  where?: { state: RulesetEncounterState; optionId: string; action?: RulesetCombatAction; opportunity?: true },
  /** Filled with what pushed the roll each way (playtest): the labels of the conditions that did,
   *  and `@`-names for the rest (`@helped`, `@dodging`, `@longRange`, `@unseen`...), for a log to say. */
  why?: RulesetAttackModeWhy,
): RulesetCombatRollMode {
  if (!rulesetCombatAdvantage(combat)) return "normal";
  const label = (id: string) => definition.sheet.live.conditions.find((one) => one.id === id)?.label ?? id;
  const holding = (who: RulesetCombatant, effect: string) =>
    rulesetActiveConditions(definition, combat, who, where?.state)
      .filter((entry) => entry.effects.includes(effect as never))
      .map((entry) => label(entry.condition));
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
    rulesetHelpCounts(actor, target) ||
    !!distance?.advantage ||
    blindSide ||
    (combat.elevation?.highGround === "advantage" && !!where && rulesetAbove(where.state, actor, target));
  // Only from an attacker who sees them, where every source of it says so (1.655): a Robe of
  // Scintillating Colors.
  const againstWhenSeen =
    !!where &&
    theirs.has("attacks-against-disadvantage") &&
    rulesetActiveConditions(definition, combat, target, where.state)
      .filter((entry) => entry.effects.includes("attacks-against-disadvantage"))
      .every((entry) => entry.whenSeen) &&
    !rulesetCanSee(definition, where.state, actor, target);
  const disadvantage =
    own.has("own-attacks-disadvantage") ||
    (theirs.has("attacks-against-disadvantage") && !againstWhenSeen) ||
    !!target.flags.dodging ||
    !!distance?.disadvantage ||
    blindStrike;
  if (why) {
    if (own.has("own-attacks-advantage")) why.up.push(...holding(actor, "own-attacks-advantage"));
    if (theirs.has("attacks-against-advantage")) why.up.push(...holding(target, "attacks-against-advantage"));
    if (rulesetHelpCounts(actor, target)) why.up.push("@helped");
    if (distance) why.up.push(...distance.why.up);
    if (blindSide) why.up.push("@unseen");
    if (combat.elevation?.highGround === "advantage" && !!where && rulesetAbove(where.state, actor, target))
      why.up.push("@above");
    if (own.has("own-attacks-disadvantage")) why.down.push(...holding(actor, "own-attacks-disadvantage"));
    if (theirs.has("attacks-against-disadvantage") && !againstWhenSeen)
      why.down.push(...holding(target, "attacks-against-disadvantage"));
    if (target.flags.dodging) why.down.push("@dodging");
    if (distance) why.down.push(...distance.why.down);
    if (blindStrike) why.down.push("@blind");
  }
  // Changes that roll attacks twice (1.185): the attacker's own, some only against whoever put them
  // on (Chill Touch), and the target's against attackers of some kind (Protection from Evil and Good).
  const leans = new Set<string>();
  const leanWhy: Record<string, string[]> = { advantage: [], disadvantage: [] };
  // Narrowed to an ability (1.188), only an attack made with it: what it is made with is the action's.
  const ability = blow?.ability;
  for (const entry of rulesetActiveConditions(definition, combat, actor, where?.state)) {
    for (const modifier of entry.modifiers ?? []) {
      if (modifier.to !== "attacks" || !modifier.mode) continue;
      if (!rulesetAbilityNarrowing(modifier, "attacks", ability)) continue;
      if (!rulesetAttackModifierReaches(modifier, where?.state, actor, target, blow, definition)) continue;
      if (
        modifier.atSource &&
        !actor.tracked.some((one) => one.condition === entry.condition && one.source === target.id)
      )
        continue;
      leans.add(modifier.mode);
      (leanWhy[modifier.mode] ??= []).push(label(entry.condition));
    }
  }
  for (const entry of rulesetActiveConditions(definition, combat, target, where?.state)) {
    for (const modifier of entry.modifiers ?? []) {
      if (modifier.to !== "attacks-taken" || !modifier.mode) continue;
      if (modifier.from && !rulesetTargetIs(definition, actor, modifier.from)) continue;
      // Only an attack by whoever put it on (1.502): True Strike.
      if (
        modifier.fromSource &&
        !target.tracked.some((one) => one.condition === entry.condition && one.source === actor.id)
      )
        continue;
      // Opportunity attacks only (1.430): Escape the Horde.
      if (modifier.opportunity && !where?.opportunity) continue;
      leans.add(modifier.mode);
      (leanWhy[modifier.mode] ??= []).push(label(entry.condition));
    }
  }
  for (const entry of against) if (entry.mode) leans.add(entry.mode);
  // At somebody inside a zone that keeps them out (1.452): Magic Circle.
  if (where && rulesetWardedFrom(definition, where.state, target, actor).some((rule) => rule.attacksInto))
    leans.add("disadvantage");
  // Under water (1.498): a swing without a swim speed or one of the weapons named, and a shot within
  // range unless the weapon is one named.
  const underwater = definition.combat?.underwater;
  if (underwater && blow && where && rulesetUnderwater(definition, where.state, actor)) {
    const kind = rulesetBlowKind(where.state, actor, target, blow);
    if (kind === "melee" && underwater.melee && !actor.speeds?.swim) {
      if (!rulesetUnderwaterSpares(underwater.melee.unless, blow)) leans.add(underwater.melee.mode);
    } else if (kind === "ranged" && underwater.ranged?.mode) {
      if (!rulesetUnderwaterSpares(underwater.ranged.unless, blow)) leans.add(underwater.ranged.mode);
    }
  }
  // A creature's own (1.293): sensitivity to sunlight, where it holds.
  for (const rule of actor.block?.attackModes ?? []) {
    if (!rulesetModeRuleHolds(definition, combat, actor, where?.state, rule)) continue;
    // Pack Tactics and Blood Frenzy (1.393): who stands beside the target, and how hurt it is.
    if (rule.allyAdjacent && !rulesetAllyBeside(definition, combat, where?.state, actor, target)) continue;
    if (rule.targetHurt && !rulesetCombatHurt(definition, combat, target)) continue;
    // Ambusher (1.544): at a target surprised, or not yet acted.
    if (rule.whenTarget && !rulesetTargetMoment(where?.state, target, rule.whenTarget)) continue;
    // Grappler (1.553): at somebody it holds itself.
    if (rule.targetHoldsFromSelf && !rulesetHeldBy(target, actor.id, rule.targetHoldsFromSelf)) continue;
    // Melee attacks only (1.402): a sahuagin's Blood Frenzy, never its thrown spear.
    if (
      rule.melee &&
      blow &&
      (where ? rulesetBlowKind(where.state, actor, target, blow) : blow.range ? "ranged" : "melee") !== "melee"
    )
      continue;
    leans.add(rule.mode);
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
  // Nothing gives an attack on them advantage while they can act (1.417): Elusive.
  const elusive = theirs.has("attacks-against-no-advantage") && !theirs.has("cannot-act");
  const up = !elusive && (advantage || leans.has("advantage"));
  const down = disadvantage || leans.has("disadvantage");
  if (why) {
    // What leaned it without a name above: a condition's own modifier, a creature's trait.
    why.up.push(...(leanWhy.advantage ?? []));
    why.down.push(...(leanWhy.disadvantage ?? []));
    if (leans.has("advantage") && !why.up.length) why.up.push("@other");
    if (leans.has("disadvantage") && !why.down.length) why.down.push("@other");
    if (elusive) why.up.length = 0;
    why.up = [...new Set(why.up)];
    why.down = [...new Set(why.down)];
  }
  if (up === down) return "normal";
  return up ? "advantage" : "disadvantage";
}

/** A shot past its weapon's normal range by or at somebody under water (1.498), where the ruleset says
 *  that never reaches. */
function underwaterTooFar(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  optionId: string,
): boolean {
  if (definition.combat?.underwater?.ranged?.pastNormal !== "never") return false;
  const action = actionOf(actor, optionId);
  if (!action || !rulesetIsAttack(action)) return false;
  if (!rulesetUnderwater(definition, state, actor) && !rulesetUnderwater(definition, state, target)) return false;
  const reach = rulesetOptionReach(state, actor.id, optionId);
  if (!reach?.shot) return false;
  const away = rulesetCombatantDistance(state, actor, target);
  return away > (reach.swing ?? 0) && away > reach.normal;
}

/** Whether help given to this attacker counts on an attack at this target: any, unless it was
 *  given against those beside its helper (1.771). */
export function rulesetHelpCounts(actor: RulesetCombatant, target: RulesetCombatant): boolean {
  if (!actor.flags.helped) return false;
  return !actor.flags.helpedAgainst || actor.flags.helpedAgainst.includes(target.id);
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
): { advantage: boolean; disadvantage: boolean; why: { up: string[]; down: string[] } } | null {
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
  const close = adjacent && theirs.has("attacks-against-adjacent-advantage");
  const far = !adjacent && theirs.has("attacks-against-far-disadvantage");
  return {
    advantage: close,
    disadvantage: tooFar || crowded || far,
    why: {
      up: close ? ["@close"] : [],
      down: [...(tooFar ? ["@longRange"] : []), ...(crowded ? ["@crowded"] : []), ...(far ? ["@far"] : [])],
    },
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

/** What a rider weighs (1.641): off their sheet where `combat.mounts.weights.sheet` gives more than 0,
 *  else by their size. Undefined where neither says. */
export function rulesetRiderWeight(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  rider: RulesetCombatant,
): number | undefined {
  const weights = combat.mounts?.weights;
  if (!weights) return undefined;
  if (weights.sheet && rider.sheet) {
    const read = rulesetHolderValue(definition, rider, weights.sheet);
    if (read !== undefined && read > 0) return read;
  }
  return rider.size === undefined ? undefined : weights.bySize[rider.size];
}

/** What a mount that carries by weight bears now (1.641): every rider on it. */
export function rulesetMountLoad(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  mount: RulesetCombatant,
): number {
  return state.combatants
    .filter((one) => one.mountedOn === mount.id)
    .reduce((total, one) => total + (rulesetRiderWeight(definition, combat, one) ?? 0), 0);
}

/** Whom this combatant may mount (1.496): a creature of their side beside them, standing, ridden by
 *  nobody and riding nothing, at least `combat.mounts.larger` sizes bigger; or (1.641) one that
 *  carries by weight, any size, while it bears them too. Never another party member in their own
 *  shape: a friend is no saddle, though one turned into a horse is. */
export function rulesetMountsFor(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatant[] {
  const rule = combat.mounts;
  if (!rule || !rulesetPositionOf(actor) || actor.riddenBy || actor.passengers?.length || actor.insideOf) return [];
  const own = rulesetSizeRank(combat, actor);
  return state.combatants.filter((one) => {
    if (one.id === actor.id || one.side !== actor.side || one.defeated || one.down) return false;
    if (!rulesetCombatStanding(one) || one.mountedOn || one.insideOf) return false;
    if (one.sheet && !one.shape) return false;
    if (!rulesetPositionOf(one) || rulesetGap(actor, one) > 1) return false;
    const carries = one.block?.mountCarries;
    if (carries) {
      const weight = rulesetRiderWeight(definition, combat, actor);
      return (
        weight !== undefined &&
        rulesetMountLoad(definition, combat, state, one) + weight <= (carries.slowedUpTo ?? carries.weight)
      );
    }
    if (one.riddenBy || own === undefined) return false;
    const rank = rulesetSizeRank(combat, one);
    return rank !== undefined && rank - own >= rule.larger;
  });
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
  if (rulesetSpeedZero(definition, combat, actor, state)) return [];
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
  // Riding (1.496): the mount goes where they go, and getting down costs half their speed.
  if (actor.mountedOn) {
    const cost = rulesetStandCost(actor);
    if (left < cost) return [];
    return [
      {
        id: RULESET_DISMOUNT_OPTION,
        kind: "move",
        label: "Dismount",
        targets: { side: "self", count: 0 },
        movementCost: cost,
      },
    ];
  }
  // Inside somebody (1.403): nothing but climbing out once they have fallen (1.405), for what that
  // costs of its walk, prone or not.
  if (actor.insideOf) {
    const corpse = rulesetInsideCorpse(state, actor);
    const perCell = combat.distance?.perCell;
    if (!corpse || !perCell) return [];
    const cost = Math.ceil(corpse.costs / perCell);
    if (left < cost) return [];
    return [
      {
        id: RULESET_CLIMB_OUT_OPTION,
        kind: "move",
        label: "Climb out",
        targets: { side: "self", count: 0 },
        movementCost: cost,
      },
    ];
  }
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
  // A careful walk (1.689), while ground that spares a slow walker is down: caltrops.
  const spared = state.combatants.some((caster) =>
    (caster.zones ?? []).some((zone) => caster.actions.find((one) => one.id === zone.actionId)?.zone?.spareSlowWalkers),
  );
  const carefully = spared ? rulesetReachableCells(definition, state, actor.id, undefined, true) : [];
  if (carefully.length > 0) {
    options.push({
      id: RULESET_CAREFUL_OPTION,
      kind: "move",
      label: "Move carefully",
      targets: { side: "self", count: 0 },
      cells: carefully,
    });
  }
  // A jump (1.499), where there is anywhere to land.
  const jumps = rulesetJumpCells(definition, state, actor.id);
  if (jumps.length > 0) {
    options.push({
      id: RULESET_JUMP_OPTION,
      kind: "move",
      label: "Jump",
      targets: { side: "self", count: 0 },
      cells: jumps,
    });
  }
  // Mounting a willing creature of their side beside them (1.496), for half their speed.
  const cost = rulesetStandCost(actor);
  if (left >= cost) {
    for (const mount of rulesetMountsFor(definition, combat, state, actor)) {
      options.push({
        id: `${RULESET_MOUNT_OPTION_PREFIX}${mount.id}`,
        kind: "move",
        label: `Mount ${mount.name}`,
        mounts: mount.name,
        targets: { side: "self", count: 0 },
        movementCost: cost,
      });
    }
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
  // One planning pass: nothing changes while a menu is worked out, and every sheet on the board is
  // read for every option and target, which worked each one out afresh thousands of times a menu.
  return withRulesetPlanMemo(() => combatOptions(definition, state, actorId));
}

function combatOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  rulesetNoteFight(state);
  const options = commandedOptions(definition, state, actorId);
  // What a command its actor may break at a cost stops is offered too (1.644), marked with the
  // conditions it breaks: 5e's Geas. Not while it is already being broken.
  const actor = rulesetCombatant(state, actorId);
  const combat = definition.combat;
  if (!actor || !combat || rulesetDefiance()) return options;
  const defiable = rulesetDefiableConditions(definition, combat, actor, state);
  if (defiable.length === 0) return options;
  // Read as it stands with them broken, so in a pass of its own: what is on whom changes with it.
  const freed = rulesetDefying(actorId, defiable, () =>
    withOwnRulesetPlanMemo(() => commandedOptions(definition, state, actorId)),
  );
  const normal = new Map(options.map((option) => [option.id, option]));
  // Which of them each is broken by alone, or all of them where it takes more than one.
  let each: Array<[string, RulesetCombatOption[]]> | undefined;
  const brokenBy = (has: (options: RulesetCombatOption[]) => boolean): string[] => {
    each ??= defiable.map((condition) => [
      condition,
      rulesetDefying(actorId, [condition], () =>
        withOwnRulesetPlanMemo(() => commandedOptions(definition, state, actorId)),
      ),
    ]);
    const by = each.flatMap(([condition, list]) => (has(list) ? [condition] : []));
    return by.length > 0 ? by : defiable;
  };
  const key = (cell: RulesetCombatCell) => `${cell.x},${cell.y}`;
  const merged = freed.map((option): RulesetCombatOption => {
    const kept = normal.get(option.id);
    if (!kept) {
      return {
        ...option,
        defies: { conditions: brokenBy((list) => list.some((one) => one.id === option.id)) },
      };
    }
    // A walk to somewhere it may not go (1.644): those cells too, each marked.
    if (option.cells && kept.cells) {
      const had = new Set(kept.cells.map(key));
      const extra = option.cells.filter((cell) => !had.has(key(cell)));
      if (extra.length > 0) {
        const first = extra[0]!;
        return {
          ...kept,
          cells: [...kept.cells, ...extra],
          defies: {
            conditions: brokenBy((list) =>
              list.some((one) => one.id === option.id && !!one.cells?.some((cell) => key(cell) === key(first))),
            ),
            cells: extra.map((cell) => ({ x: cell.x, y: cell.y })),
          },
        };
      }
    }
    return kept;
  });
  const listed = new Set(merged.map((option) => option.id));
  return [...merged, ...options.filter((option) => !listed.has(option.id))];
}

/** The menu as what holds its actor commands it (1.264), every command kept. */
function commandedOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const options = rulesetUncompelledOptions(definition, state, actorId);
  const actor = rulesetCombatant(state, actorId);
  if (!actor || !definition.combat) return options;
  const kept = compelled(definition, definition.combat, state, actor, options);
  // A controlled mount (1.496) moves and takes only the standard actions the ruleset names; mounted
  // this round after its own turn, it waits for the next.
  if (actor.mountControlled && actor.riddenBy) {
    if (actor.mountWaits === state.round) return kept.filter((option) => option.kind === "end-turn");
    const named = definition.combat.mounts?.controlled?.standard ?? [];
    return kept.filter(
      (option) =>
        option.kind === "end-turn" ||
        option.id === RULESET_MOVE_OPTION ||
        option.id === RULESET_JUMP_OPTION ||
        option.id === RULESET_CAREFUL_OPTION ||
        (option.kind === "standard" &&
          option.id.startsWith("standard:") &&
          named.includes(rulesetStandardName(option.id) as never)),
    );
  }
  return kept;
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
  // At the nearest it sees (1.543): walking, and attacks at it, and nothing else.
  if (turn === "nearest") {
    kept = kept.filter((option) => {
      if (option.kind === "end-turn" || option.id === RULESET_MOVE_OPTION) return true;
      if (option.kind !== "attack" && option.kind !== "block") return false;
      const action = actor.actions.find((entry) => entry.id === option.id);
      if (!action || !rulesetIsAttack(action)) return false;
      return rulesetOptionTargets(definition, state, actor.id, option).includes(actor.flags.compelledTarget ?? "");
    });
  }
  // One that frees a turn begun with nowhere to walk (1.266) holds nothing of it then.
  const rules = rulesetActiveConditions(definition, combat, actor, state).flatMap((entry) =>
    entry.behavior?.only && !(entry.behavior.onlyWhenStuck === "any" && actor.flags.stuck)
      ? [{ ...entry.behavior, condition: entry.condition }]
      : [],
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
    // Slipping free (1.486) is breaking free too.
    if (option.slip) return allowed("escape");
    // What the condition itself gives, where it keeps its own actions (1.601): Wind Walk's revert.
    const lent = actor.actions.find((entry) => entry.id === option.id)?.whileHolds;
    if (lent !== undefined) return rules.every((rule) => rule.actions && rule.condition === lent);
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

/** Slipping free of what holds them (1.486), with no check, for some of the turn's walk: each
 *  condition a `slipsFree` holding on them names, put on by nothing of its `unlessCatalogs`. 5e's
 *  Freedom of Movement out of a grapple or a nonmagical restraint. */
function slipOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  if (!combat.conditions?.some((entry) => entry.slipsFree) && !definition.items) return [];
  const out: RulesetCombatOption[] = [];
  const offered = new Set<string>();
  const on = rulesetCombatConditions(definition, actor);
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    const slips = entry.slipsFree;
    if (!slips) continue;
    for (const condition of on) {
      if (offered.has(condition) || !slips.conditions.includes(condition)) continue;
      const magic = actor.tracked.some(
        (one) => one.condition === condition && !!one.catalog && !!slips.unlessCatalogs?.includes(one.catalog),
      );
      if (magic) continue;
      const cells = rulesetSlipCost(definition, combat, actor, state, condition, slips.cost);
      if (cells === null) continue;
      offered.add(condition);
      out.push({
        id: `${RULESET_SLIP_OPTION_PREFIX}${condition}`,
        kind: "standard",
        label: definition.sheet.live.conditions.find((one) => one.id === condition)?.label ?? condition,
        targets: { side: "self", count: 0 },
        ...(cells ? { movementCost: cells } : {}),
        slip: true,
      });
    }
  }
  return out;
}

/** The creature an attack is given up for and the attack it makes (1.488), read off the option's id:
 *  one its maker called, with an attack of its own. */
export function rulesetLentAttack(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  optionId: string,
): { called: RulesetCombatant; attack: RulesetCombatAction } | null {
  if (!optionId.startsWith(RULESET_LEND_OPTION_PREFIX)) return null;
  const rest = optionId.slice(RULESET_LEND_OPTION_PREFIX.length);
  const cut = rest.indexOf(":");
  if (cut < 0) return null;
  const called = rulesetCombatant(state, rest.slice(0, cut));
  if (!called || called.calledBy !== actor.id || called.calledTurned) return null;
  const attack = called.actions.find((entry) => entry.id === rest.slice(cut + 1));
  return attack && rulesetIsAttack(attack) ? { called, attack } : null;
}

/**
 * Giving up one attack of their attack action for a creature they called to make one of its own
 * (1.488), out of the budget a `lendsStrikes` holding on them names, its can't-harm passed by: 5e's
 * Pact of the Chain. Offered while a strike of the attack action is in hand, or the action itself
 * may still be taken; one for each attack of each such creature that has somebody to reach.
 */
function lendOptions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatOption[] {
  if (!combat.conditions?.some((entry) => entry.lendsStrikes)) return [];
  const lends = rulesetActiveConditions(definition, combat, actor, state).find(
    (entry) => entry.lendsStrikes,
  )?.lendsStrikes;
  if (!lends) return [];
  // Their weapons', or a stat block's own attacks.
  const own = actor.actions.filter(
    (entry) => (entry.kind === "attack" || entry.kind === "block") && !entry.catalog && rulesetIsAttack(entry),
  );
  const base = own.find((entry) => entry.strikes !== undefined) ?? own[0];
  if (!base || ((actor.strikesLeft ?? 0) < 1 && (actor.budgets[base.budget] ?? 0) < 1)) return [];
  const out: RulesetCombatOption[] = [];
  for (const called of state.combatants) {
    if (called.calledBy !== actor.id || called.calledTurned || !rulesetCombatStanding(called) || called.defeated)
      continue;
    if ((called.budgets[lends.budget] ?? 0) < 1) continue;
    const effects = rulesetCombatEffects(definition, combat, called, state);
    if (effects.has("cannot-act") || effects.has("cannot-react")) continue;
    for (const attack of called.actions) {
      const struck = attack.kind === "attack" || attack.kind === "block";
      if (!struck || !rulesetIsAttack(attack) || attack.targets.side !== "enemy") continue;
      const option: RulesetCombatOption = {
        id: `${RULESET_LEND_OPTION_PREFIX}${called.id}:${attack.id}`,
        kind: "attack",
        label: `${called.name}: ${attack.label}`,
        targets: { ...attack.targets },
        lend: {
          calledId: called.id,
          actionId: attack.id,
          spends: lends.budget,
          attackBudget: base.budget,
          strikes: base.strikes ?? 1,
        },
      };
      if (rulesetOptionTargets(definition, state, actor.id, option).length > 0) out.push(option);
    }
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
    // Read from its rider's side, and only while ridden (1.735).
    const rider = aura.whileRidden && holder.riddenBy ? rulesetCombatant(state, holder.riddenBy) : undefined;
    if (aura.whileRidden && !rider) continue;
    if (aura.side === ((rider ?? holder).side === actor.side ? "enemies" : "allies")) continue;
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
  // Away and still taking turns (1.313): only the way back, by what ends what keeps them away; or
  // taking it off at will where it is `endable` (1.627): a Robe of Stars' return from the Astral Plane.
  if (actor.away?.turns) {
    const back = actor.away.while
      ? actor.actions.find((one) => one.id === `end-condition:${actor.away!.while}`)
      : undefined;
    const option = back
      ? optionFrom(
          definition,
          combat,
          state,
          actor,
          back,
          false,
          rulesetConditionEconomy(definition, combat, actor, state),
        )
      : null;
    return [...endingOptions(definition, combat, actor), ...(option ? [option] : []), endTurn];
  }
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
    // One that strikes by itself (1.539) is never commanded.
    if (summon.strikesAtTurnStart) continue;
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
    const targets = rulesetOptionTargets(definition, state, actor.id, option);
    if (targets.length === 0) continue;
    // What its strike does, as the spell's own attack does: the same action, struck again.
    const forecast = forecastFor(definition, combat, state, actor, action, rulesetCombatant(state, targets[0]!));
    options.push(forecast && Object.keys(forecast).length > 0 ? { ...option, forecast } : option);
  }
  options.push(...pickUpOptions(actor));
  options.push(...avertOptions(definition, state, actor));
  options.push(...slipOptions(definition, combat, state, actor));
  options.push(...lendOptions(definition, combat, state, actor));
  // Moving a lasting area its caster holds at a point (1.173): picked on the board as a walk is.
  for (const zone of actor.zones ?? []) {
    const move = actor.actions.find((entry) => entry.id === zone.actionId)?.zone?.move;
    // One moved on a check is moved by anybody near, its caster too, below.
    if (!move || move.check || (actor.budgets[move.budget] ?? 0) < 1) continue;
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
  // Moving a zone anybody near may move, on a check (1.694): a Sphere of Annihilation.
  const standingAt = rulesetPositionOf(actor);
  for (const { caster, zone, action } of standingAt ? rulesetStandingZones(state) : []) {
    const move = action.zone?.move;
    if (!move?.check || !zone.at || (actor.budgets[move.budget] ?? 0) < 1) continue;
    if (rulesetCellDistance(standingAt!, zone.at) > move.check.within) continue;
    const cells = rulesetZoneMoveCells(state, zone, rulesetZoneCheckReach(definition, actor, move, zone));
    if (cells.length === 0) continue;
    options.push({
      id: `${RULESET_ZONE_CHECK_OPTION_PREFIX}${caster.id}|${zone.actionId}`,
      kind: "move",
      label: zone.label,
      budget: move.budget,
      targets: { side: "self", count: 0 },
      cells,
    });
  }
  // Closing a zone its caster holds (1.637), once: an Eversmoking Bottle stoppered.
  for (const zone of actor.zones ?? []) {
    const close = actor.actions.find((entry) => entry.id === zone.actionId)?.zone?.close;
    if (!close || zone.closed || (actor.budgets[close.budget] ?? 0) < 1) continue;
    options.push({
      id: `${RULESET_ZONE_CLOSE_OPTION_PREFIX}${zone.actionId}`,
      kind: "standard",
      label: `Close ${zone.label}`,
      budget: close.budget,
      targets: { side: "self", count: 0 },
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
  options.push(...endingOptions(definition, combat, actor, state));
  for (const action of combat.standard ?? []) {
    if ((actor.budgets[budget] ?? 0) < 1) break;
    // Readying for real (1.288): one entry for each option it may ready, and what it waits for.
    if (action === "ready" && combat.readying) {
      options.push(...readyOptions(options, budget));
      continue;
    }
    options.push(
      ...rulesetDisarmOptions(state, actor, {
        id: `standard:${action}`,
        kind: "standard",
        label: action,
        budget,
        // Help is the one that reaches somebody else; the rest are the actor's own stance.
        targets: action === "help" ? { side: "ally", count: 1 } : { side: "self", count: 0 },
        ...(action === "help" && combat.standardEffects?.help?.beside ? { besideOnly: true as const } : {}),
      }),
    );
  }
  options.push(...grantedStandardOptions(definition, combat, actor, state));
  // Hiding where every opponent sees them clearly is no hiding at all (playtest): still allowed by
  // the rules, but marked, so neither a player's menu nor the AI spends an action on a roll that
  // cannot work.
  if (hidingHopeless(definition, actor, state)) {
    for (const option of options)
      if (option.kind === "standard" && rulesetStandardName(option.id) === "hide") option.futile = true;
  }
  options.push(endTurn);
  return options;
}

/** Whether no opponent on the board could lose sight of this combatant whatever it rolled: each
 *  sees it clearly, with nothing larger to slip behind. Never on a fight with no board, nor in a
 *  ruleset that does not hide for real. */
function hidingHopeless(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  state?: RulesetEncounterState,
): boolean {
  if (!definition.combat?.hiding || !state?.board || !rulesetPositionOf(actor)) return false;
  const plain = !!rulesetHidingTraits(definition, actor).starts;
  const foes = state.combatants.filter(
    (one) => one.side !== actor.side && !one.defeated && !one.down && rulesetPositionOf(one),
  );
  if (foes.length === 0) return false;
  return !foes.some((viewer) => rulesetStaysHidden(definition, state, viewer, actor, Number.MAX_SAFE_INTEGER, plain));
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

/** Where an engulf may end (1.403), each with the path it walks: up to its speed, lent for it (or
 *  what is left of its own walk, with `ownMovement`), into the spaces of whoever it takes in. */
export function rulesetEngulfCells(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetReachableCell[] {
  const engulf = action.engulf;
  if (!engulf || !state.board) return [];
  const lent = engulf.ownMovement
    ? { movementLeft: actor.movementLeft ?? 0, ...(actor.modeLeft ? { modeLeft: actor.modeLeft } : {}) }
    : rulesetLentMovement(definition, actor, { share: 1 }, state);
  if (lent.movementLeft < 1) return [];
  return rulesetWithMovement(actor, lent, () =>
    rulesetReachableCells(definition, state, actor.id, (one) => rulesetEngulfable(definition, actor, engulf, one)),
  );
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
  const cells = rulesetWithMovement(actor, lent, () => rulesetReachableCells(definition, state, actor.id));
  if (action.move.toward !== "seen-hostile") return cells;
  // Every step nearer a hostile it can see (1.607): Aggressive. Seeing none, it goes nowhere.
  const foes = state.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && rulesetCanSee(definition, state, actor, one),
  );
  const from = rulesetPositionOf(actor);
  if (foes.length === 0 || !from) return [];
  const span = rulesetSpanOf(actor);
  const nearest = (cell: RulesetCombatCell) => Math.min(...foes.map((foe) => rulesetGapFrom(cell, span, foe)));
  return cells.filter((cell) => {
    let was = nearest(from);
    for (const step of cell.path) {
      const now = nearest(step);
      if (now >= was) return false;
      was = now;
    }
    return true;
  });
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
      // Readying one of a spell's ways folds as the ways themselves do (1.769).
      ...(option.variantOf ? { variantOf: `${RULESET_READY_OPTION_PREFIX}${option.variantOf}@${on}` } : {}),
      ...(option.variantName ? { variantName: option.variantName } : {}),
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
  state?: RulesetEncounterState,
): RulesetCombatOption[] {
  const budget = rulesetStandardBudget(combat);
  if ((actor.budgets[budget] ?? 0) < 1) return [];
  const options: RulesetCombatOption[] = [];
  // Somebody next to them ends it for them (1.518): a creature on fire doused.
  for (const holder of state?.combatants ?? []) {
    if (holder.id === actor.id || !rulesetCombatStanding(holder) || holder.away) continue;
    if (state!.board && (!rulesetPositionOf(holder) || rulesetGap(actor, holder) > 1)) continue;
    for (const entry of holder.tracked) {
      if (entry.checkEnds?.by !== "any") continue;
      const label =
        definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
      options.push({
        id: `checkends:${holder.id}:${entry.condition}`,
        kind: "standard",
        label: `End ${label} on ${holder.name}`,
        budget,
        targets: { side: "self", count: 0 },
        checkEnds: { condition: entry.condition, label, holderId: holder.id },
      });
    }
  }
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
    // Not while a failed try still bars it (1.636): Iron Bands of Binding's day.
    if (entry.checkEnds && !(entry.checkBarredUntil !== undefined && (state?.round ?? 0) < entry.checkBarredUntil)) {
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

/** How many cells a mover may move a zone moved on a check (1.694): its `distanceBy` times their
 *  ability modifier, at least its `atLeast`, else its own distance. */
export function rulesetZoneCheckReach(
  definition: RulesetDefinition,
  mover: RulesetCombatant,
  move: NonNullable<NonNullable<RulesetCombatAction["zone"]>["move"]>,
  /** The zone, for whom it is held by: a talisman's farther reach for one already in control (1.703). */
  zone?: { heldBy?: string },
): number {
  const held = move.check?.holding;
  const by =
    held?.distanceBy && zone?.heldBy === mover.id && rulesetHoldsTagged(mover, held.tags)
      ? held.distanceBy
      : move.check?.distanceBy;
  if (!by || !move.check) return move.distance;
  const score = mover.sheet?.build.abilities?.[by.abilityMod] ?? mover.block?.abilities?.[by.abilityMod];
  const mod = typeof score === "number" ? rulesetAbilityModifier(definition, score) : 0;
  const add = "add" in by && typeof by.add === "number" ? by.add : 0;
  const feet = Math.max(by.atLeast ?? 0, add + by.times * mod);
  return feet > 0 ? Math.max(0, Math.floor(feet / move.check.perCell)) : 0;
}

/** Whether somebody holds something with one of these item tags (1.703): an item of their sheet worn
 *  and not dropped, or a thing a creature holds. */
export function rulesetHoldsTagged(combatant: RulesetCombatant, tags: readonly string[]): boolean {
  const dropped = rulesetDroppedItems(combatant);
  const items = combatant.sheet?.items ?? [];
  if (
    items.some(
      (held, index) =>
        held.worn && !dropped.has(index) && (rulesetHeldItemDoes(held).tags ?? []).some((tag) => tags.includes(tag)),
    )
  )
    return true;
  return (combatant.block?.held ?? []).some((thing) => thing.tags.some((tag) => tags.includes(tag)));
}

/** The mode a repeat is made in (1.692): the one its cast was made in, while its user concentrates
 *  on that cast and the repeat has that mode. Undefined for anything else. */
export function rulesetKeptMode(
  actor: Pick<RulesetCombatant, "concentrating" | "actions">,
  action: RulesetCombatAction | undefined,
): string | undefined {
  const kept = actor.concentrating?.mode;
  if (kept === undefined || !action?.again || !rulesetRepeatsHeld(actor, action.again)) return undefined;
  return action.modes?.some((mode) => mode.id === kept) ? kept : undefined;
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

/** In a `spend` window (1.382): the Engine's own pick for whatever symbols are still unspent. A
 *  spend's own option is `RULESET_SPEND_OPTION_PREFIX` and its id. */
export const RULESET_ENGINE_SPENDS_OPTION = "engine-spends";
export const RULESET_SPEND_OPTION_PREFIX = "spend:";

/** What somebody choosing their own symbol spends (1.382) may take now: one more of each spend they
 *  can still buy, and the Engine's pick for the rest when it would buy anything. Passing keeps what
 *  they have chosen and spends nothing more. */
function spendWindowOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
): RulesetCombatOption[] {
  const trigger = window.trigger;
  const held = window.resume?.kind === "action" ? window.resume.held : undefined;
  if (trigger.kind !== "spend" || !held) return [];
  const standing = rulesetSymbolSpendStanding(definition, state, held, trigger.sourceId, trigger.by, trigger.hit);
  if (!standing) return [];
  const symbols = definition.resolution.kind === "symbol-pool" ? definition.resolution.symbols : [];
  const costOf = (spend: RulesetSymbolSpend) => [
    {
      pool: spend.symbol,
      label: symbols.find((one) => one.id === spend.symbol)?.label ?? spend.symbol,
      amount: spend.cost,
    },
  ];
  const options: RulesetCombatOption[] = standing.choices.map((spend) => ({
    id: `${RULESET_SPEND_OPTION_PREFIX}${spend.id}`,
    kind: "spend",
    label: spend.label,
    targets: { side: "self", count: 0 },
    cost: costOf(spend),
    symbolSpend: { spend: spend.id },
  }));
  if (standing.engine.length > 0) {
    options.unshift({
      id: RULESET_ENGINE_SPENDS_OPTION,
      kind: "spend",
      label: standing.engine
        .map(({ spend, times }) => (times > 1 ? `${spend.label} x${times}` : spend.label))
        .join(", "),
      targets: { side: "self", count: 0 },
      symbolSpend: {
        engine: true,
        picks: standing.engine.map(({ spend, times }) => ({ spend: spend.id, times })),
      },
    });
  }
  return options;
}

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
  // One planning pass, as a turn's menu is.
  return withRulesetPlanMemo(() => windowOptions(definition, state, actorId));
}

function windowOptions(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
): RulesetCombatOption[] {
  const combat = definition.combat;
  const window = state.window;
  if (!combat || !window || window.waiting[0] !== actorId) return [];
  // Points, not a budget, and priced and checked where every other signature option is.
  // At a turn's start (1.805), a lair's actions keep their own count and are not offered.
  if (window.kind === "signature")
    return rulesetSignatureOptions(definition, state, actorId).filter(
      (option) => window.trigger.kind !== "turn-start" || !option.lairOf,
    );
  if (window.kind === "spend") return spendWindowOptions(definition, state, window);

  const actor = rulesetCombatant(state, actorId);
  if (!actor) return [];

  if (window.trigger.kind === "leaves-reach") {
    const opportunity = combat.opportunity;
    // Re-read rather than trusted from when the window opened: an answer before this one may have
    // taken this combatant out, held them still or spent the very budget this would pay with.
    if (!rulesetCombatStanding(actor)) return [];
    const effects = rulesetCombatEffects(definition, combat, actor, state);
    if (effects.has("cannot-act") || effects.has("cannot-react")) return [];
    // Or one of its spare heads' (1.550): a hydra's Reactive Heads.
    if (!opportunity || ((actor.budgets[opportunity.budget] ?? 0) < 1 && !actor.heads?.spare)) return [];
    const mover = rulesetCombatant(state, window.trigger.moverId);
    if (!mover || !rulesetCombatStanding(mover)) return [];
    const strike = rulesetOpportunityAttack(actor);
    if (!strike) return [];
    // What it would do to the one walking away, so a screen can say so and the Engine's own picker
    // weighs the blow as a blow rather than as nothing.
    const forecast = forecastFor(definition, combat, state, actor, strike, mover);
    return [
      {
        id: strike.id,
        kind: strike.kind,
        label: strike.label,
        // Nobody to pick: the strike lands on whoever is walking away, and offering a target would
        // be offering a choice the fight then ignores.
        targets: { side: "self", count: 0 },
        budget: opportunity.budget,
        ...(forecast ? { forecast } : {}),
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
  const cause = rulesetWindowCause(state, trigger);
  // A hit an answer before theirs turned into a miss leaves its maker nothing to add to it (cheap-GM
  // playtest 2026-10-26: Open Hand Technique knocked a captain prone on a hit his Parry had just
  // turned into a miss). The maker is asked last (1.241), so the hit is read as it now stands.
  if (trigger.kind === "hit" && actorId === source && rulesetHeldHitNowMisses(definition, state)) return [];
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

/**
 * On a held hit, whether its roll now misses: checked against the defense its target has now, as the
 * attack is checked again once the window closes. A natural face, and a symbol throw, stand as they
 * were thrown. False with no held hit.
 */
export function rulesetHeldHitNowMisses(definition: RulesetDefinition, state: RulesetEncounterState): boolean {
  const combat = definition.combat;
  const window = state.window;
  const resume = window?.resume?.kind === "action" ? window.resume : undefined;
  const held = resume?.held;
  if (!combat || window?.trigger.kind !== "hit" || !resume || !held || held.roll.natural) return false;
  if (rulesetCombatIsSymbol(combat)) return false;
  const target = rulesetCombatant(state, held.targetId);
  if (!target) return false;
  const attacker = rulesetCombatant(state, resume.actorId);
  const blow = attacker ? actionOf(attacker, resume.optionId) : undefined;
  const defense = rulesetDefenseAgainst(definition, combat, state, target, attacker, blow).defense;
  return held.roll.total < (rulesetCombatIsPool(combat) ? Math.max(1, defense) : defense);
}

/** Which moment a window is, for the reactions that wait for one. A walk and the turn between two
 *  actors are windows of their own kind and wait for nothing. */
export function rulesetWindowMoment(trigger: RulesetWindowTrigger): RulesetReactionMoment | null {
  return trigger.kind === "aimed" ||
    trigger.kind === "hit" ||
    trigger.kind === "harmed" ||
    trigger.kind === "used" ||
    trigger.kind === "falls" ||
    trigger.kind === "turn-start" ||
    trigger.kind === "caught" ||
    trigger.kind === "attacked"
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
  if (!rulesetAgainstMatches(moment.against, cause.catalog, cause.entry, cause.action, cause.qualities)) return false;
  // Only for one who holds such an item (1.564): a shield guardian's amulet.
  if (
    moment.forHolds &&
    !(cause.targetIds ?? []).some((id) => {
      const one = rulesetCombatant(state, id);
      return (one?.sheet?.items ?? []).some((held) => held.item.tags?.some((tag) => moment.forHolds!.includes(tag)));
    })
  )
    return false;
  // Its holder's own hit, or somebody else's (1.241): never both.
  if (moment.on === "hit" && (moment.by === "self") !== (sourceId === holder.id)) return false;
  // Only the one who caught it throws it back (1.416).
  if (moment.on === "caught" && !(cause.targetIds ?? []).includes(holder.id)) return false;
  // Only the ones an attack was made at, and missed if it says so (1.422).
  if (moment.on === "attacked") {
    if (!(cause.targetIds ?? []).includes(holder.id)) return false;
    if (moment.missed && !(cause.missedIds ?? []).includes(holder.id)) return false;
    if (moment.blow && cause.blows?.[holder.id] !== moment.blow) return false;
  }
  if (moment.weapon && !cause.weapon) return false;
  if (moment.names && !(cause.attack !== undefined && rulesetAttackNamed(cause.attack, moment.names))) return false;
  // Only a strike paid for from its budget (1.248): Open Hand Technique, on Flurry of Blows.
  if (moment.budget && cause.budget !== moment.budget) return false;
  // Only a hit with its own item (1.273): charges spent on the staff that struck.
  if (moment.item !== undefined && cause.item !== moment.item) return false;
  if (moment.blow && moment.on !== "attacked" && cause.blow !== moment.blow) return false;
  if (moment.seesSource && !rulesetSees(state, holder, rulesetCombatant(state, sourceId))) return false;
  return true;
}

/** Whether an action was made from a row `rowsWhere` reaches (1.437); without one, every action. */
export function rulesetRowsReach(
  where: { list: string; column: string; is: readonly string[] } | undefined,
  one: RulesetCombatAction,
): boolean {
  if (!where) return true;
  if (one.fromRow?.list !== where.list) return false;
  const value = one.fromRow.values[where.column]?.trim().toLowerCase();
  return value !== undefined && where.is.some((wanted) => wanted.trim().toLowerCase() === value);
}

/** The components using this still needs (1.179), less those its user's conditions and levels waive
 *  (1.435): 5e's Archdruid, verbal and somatic. */
export function rulesetNeededComponents(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  state?: RulesetEncounterState,
): string[] {
  const needs = action.components ?? [];
  if (!needs.length || !definition.combat) return needs;
  // Only for the rows a waiver reaches (1.437): a druid's spells, not a racial one.
  const waived = new Set(
    rulesetActiveConditions(definition, definition.combat, actor, state).flatMap((entry) =>
      rulesetRowsReach(entry.rowsWhere, action) ? (entry.waives ?? []) : [],
    ),
  );
  return waived.size ? needs.filter((component) => !waived.has(component)) : needs;
}

/** What an action carries, its own and its damage's (1.564): what a reaction's `against.qualities`
 *  reads. */
export function rulesetActionQualities(action: RulesetCombatAction | undefined): string[] {
  return [...new Set([...(action?.qualities ?? []), ...(action?.damage?.qualities ?? [])])];
}

/** Whether what caused a moment is something this `against` answers: from one of its catalogs, or
 *  one of its entries by name. Nothing narrows a reaction that names neither. */
function rulesetAgainstMatches(
  against: RulesetReactionAgainst | undefined,
  catalog: string | undefined,
  entry: string | undefined,
  action: string | undefined,
  qualities: readonly string[] = [],
): boolean {
  if (!against) return true;
  return (
    (against.qualities ?? []).some((one) => qualities.includes(one)) ||
    (catalog !== undefined && (against.catalogs ?? []).includes(catalog)) ||
    (entry !== undefined && (against.entries ?? []).includes(entry)) ||
    (action !== undefined && (against.actions ?? []).some((name) => name.toLowerCase() === action.toLowerCase()))
  );
}

/** What a moment's cause carries, read off its trigger, for what answers it to be matched against
 *  (the blow, a weapon's, the budget it was paid from, the item struck with): the same for the menu,
 *  the rules and the picker, so all three agree on whom an answer lands on. */
export function rulesetWindowCause(state: RulesetEncounterState, trigger: RulesetWindowTrigger): RulesetMomentCause {
  const source = "sourceId" in trigger ? trigger.sourceId : "";
  // What the action behind it carries (1.564): Rock Catching's rock.
  const qualities = rulesetActionQualities(
    "optionId" in trigger
      ? rulesetCombatant(state, source)?.actions.find((one) => one.id === trigger.optionId)
      : undefined,
  );
  return {
    ...("targetIds" in trigger ? { targetIds: trigger.targetIds } : {}),
    ...(qualities.length ? { qualities } : {}),
    ...("optionId" in trigger && rulesetCombatant(state, source)?.block && !("catalog" in trigger && trigger.catalog)
      ? { action: trigger.label }
      : {}),
    ...("catalog" in trigger && trigger.catalog ? { catalog: trigger.catalog } : {}),
    ...("entry" in trigger && trigger.entry ? { entry: trigger.entry } : {}),
    ...((trigger.kind === "hit" || trigger.kind === "aimed") && trigger.blow ? { blow: trigger.blow } : {}),
    ...(trigger.kind === "hit" && trigger.weapon ? { weapon: true } : {}),
    ...(trigger.kind === "hit" && !trigger.catalog ? { attack: trigger.label } : {}),
    ...(trigger.kind === "hit" && trigger.budget ? { budget: trigger.budget } : {}),
    ...(trigger.kind === "hit" ? rulesetHitItem(trigger.optionId) : {}),
    ...(trigger.kind === "attacked"
      ? { missedIds: trigger.missedIds, blows: trigger.blows, attackOption: trigger.optionId }
      : {}),
  };
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
  if (
    moment === "turn-start" ||
    moment === "falls" ||
    moment === "used" ||
    moment === "caught" ||
    moment === "attacked"
  )
    return sourceId;
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

/** Whether whoever caused a moment is what a reaction's `sourceIs` says (1.422). */
function sourceIsOf(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  sourceId: string,
  test: RulesetTargetIs,
): boolean {
  const source = rulesetCombatant(state, sourceId);
  return !!source && rulesetTargetIs(definition, source, test);
}

/** Who a missed attack may be sent to instead (1.422): anybody its maker could make it at, other than
 *  its maker and the one it missed, as the menu would let them. */
export function rulesetRedirectTargets(
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  sourceId: string,
  optionId: string | undefined,
): string[] {
  const attacker = rulesetCombatant(state, sourceId);
  const attack = attacker?.actions.find((one) => one.id === optionId);
  if (!attacker || !attack || !rulesetCombatStanding(attacker)) return [];
  return state.combatants
    .filter(
      (one) =>
        one.id !== attacker.id &&
        one.id !== holder.id &&
        !one.defeated &&
        rulesetCombatStanding(one) &&
        (attack.reach === undefined && !attack.range
          ? rulesetCombatantDistance(state, attacker, one) <= 1
          : attack.range
            ? rulesetCombatantDistance(state, attacker, one) <= (attack.range.long ?? attack.range.normal)
            : rulesetCombatantDistance(state, attacker, one) <= (attack.reach ?? 1)),
    )
    .map((one) => one.id);
}

/** Whether a holder has one of a slot free (1.416): a hand to catch a missile in. What it has let
 *  fall takes no slot, and a creature off a stat block keeps its hands its own business. */
function rulesetSlotFree(definition: RulesetDefinition, actor: RulesetCombatant, slot: string): boolean {
  if (!actor.sheet) return true;
  const count = definition.items?.slots?.find((one) => one.id === slot)?.count ?? 0;
  return rulesetSlotUsed(actor, slot) < count;
}

/** How much of a slot a holder's worn items take (1.416): not what it has let fall, nor an item
 *  switched on to hover (1.706), an Animated Shield. `except` leaves one item out. */
export function rulesetSlotUsed(actor: RulesetCombatant, slot: string, except?: number): number {
  const down = new Set((actor.dropped ?? []).map((thing) => thing.key));
  return (actor.sheet?.items ?? []).reduce(
    (sum, held, index) =>
      held.worn &&
      index !== except &&
      !down.has(`item:${index}`) &&
      !(held.item.toggle?.freesSlots && rulesetItemOn(actor, index))
        ? sum + (held.item.slots?.[slot] ?? 0)
        : sum,
    0,
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
  /** Told of each answer to this very moment that is held but cannot be given, and why: for the
   *  log, where an opponent's Counterspell never came. */
  missed?: (action: RulesetCombatAction, because: RulesetUnansweredBecause) => void,
): RulesetCombatAction[] {
  if (!rulesetCombatStanding(actor)) return [];
  const effects = rulesetCombatEffects(definition, combat, actor, state);
  const helpless = effects.has("cannot-act");
  if (helpless && !missed) return [];
  return actor.actions.filter((action) => {
    if (!action.reaction) return false;
    // Its own moment, or any it is also taken at, each read with its own `against`.
    const moments = [action.reaction, ...(action.reaction.also ?? [])];
    const answers = moments.some(
      (one) =>
        one.on === moment &&
        momentAnswers(state, actor, sourceId, one, cause) &&
        // A hand free to catch it in (1.416).
        (!one.freeSlot || rulesetSlotFree(definition, actor, one.freeSlot)) &&
        // Whoever caused it is what it says (1.422): Giant Killer's Large or larger.
        (!one.sourceIs || sourceIsOf(definition, state, sourceId, one.sourceIs)),
    );
    // Choosing what one's own hit does is part of making it, not a reaction to it (1.241).
    if (helpless || (effects.has("cannot-react") && !moments.every((one) => one.by === "self"))) {
      if (answers) missed?.(action, "cannot-react");
      return false;
    }
    if (!answers) return false;
    const target = rulesetReactionTarget(state, actor, action, moment, sourceId, cause);
    if ((moment === "aimed" || moment === "hit") && !target) return false;
    // A strike of its own to make (1.422), and somebody else for a missed attack to go to.
    if (action.strikesWith && !rulesetOpportunityAttack(actor)) return false;
    if (action.redirects && rulesetRedirectTargets(state, actor, sourceId, cause.attackOption).length === 0)
      return false;
    if (optionFrom(definition, combat, state, actor, action, true) === null) {
      // Not said for one its holder does not have ready (laptop 2026-10-25: "held Counterspell, but
      // could not pay for it", again and again, for one who had not prepared it).
      // One whose budget is spent this round says that, not that it could not pay (cloud probe 2026-10-25).
      if (missed && rulesetActionAvailable(actor, action, state, definition))
        missed(action, (actor.budgets[action.budget] ?? 0) < 1 ? "used" : "cost");
      return false;
    }
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
    if (moment === "used") {
      const refused = rulesetTargetRefusal(state, actor.id, action.id, sourceId);
      if (refused !== null) {
        missed?.(action, refused === "no-line-of-sight" ? "sight" : "reach");
        return false;
      }
    }
    if (moment !== "falls" && !rulesetReactionPointsAtSource(action)) return true;
    return rulesetOptionTargets(definition, state, actor.id, action, nearby).includes(sourceId);
  });
}
