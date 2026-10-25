// Resolving a fight: one choice at a time, and the bookkeeping between turns.
//
// Nothing here throws. A choice the rules do not allow returns the state it was given, untouched,
// and one `refused` event saying why, so a Game Master's fiction can be corrected rather than
// silently accepted. Everything a party member spends, loses or gains goes through
// `applyRulesetSheetOp`, so a fight can never write something the sheet would refuse from the
// player or from the Game Master.

import type { RulesetSaveAgainst } from "../rulesets/check-effects.js";
import {
  rulesetPoolMaxSuccesses,
  type RulesetBehaviorDrops,
  type RulesetCombat,
  type RulesetCreatureHideEntry,
  type RulesetDefinition,
} from "../../schemas/ruleset.schema.js";
import { readRulesetLive, type RulesetSheetOp } from "../rulesets/live-state.js";
import {
  RULESET_PICK_UP_OPTION_PREFIX,
  RULESET_AVERT_OPTION_PREFIX,
  rulesetChargeSteps,
  breakRulesetItem,
  recoverRulesetAmmo,
  rulesetActionDropped,
  rulesetActionItemIndex,
  rulesetThingsToDrop,
  reloadRulesetClip,
  rulesetItemOn,
  rulesetModedAction,
  rulesetItemChargesLeft,
  spendRulesetShots,
} from "./ammo.js";
import { parseRulesetCombatDice, rollRulesetDice, sumOf } from "./dice.js";
import { blocksSight, elevationAt } from "../tactical-combat/math.js";
import { rulesetCanSee, rulesetHiddenFrom, rulesetHidingTraits, rulesetLightAt, rulesetStaysHidden } from "./sight.js";
import {
  rulesetCombatIsPool,
  rulesetCombatPenalty,
  rulesetSoakOf,
  throwRulesetCombatPool,
  throwRulesetDamageDice,
  type RulesetCombatPoolThrow,
} from "./pool.js";
import {
  pickRulesetSymbolSpends,
  rulesetChosenSymbolSpends,
  rulesetCombatIsSymbol,
  rulesetSymbolNeeded,
  rulesetSymbolSuccessHarm,
  throwRulesetSymbolPool,
  type RulesetSymbolSpendPick,
  type RulesetSymbolThrow,
} from "./symbols.js";
import {
  currentRulesetActor,
  refreshRulesetBudgets,
  rulesetConditionEconomy,
  rulesetIsAttack,
  rulesetOnOwnTurn,
  refreshRulesetMovement,
  rulesetCombatant,
  rulesetCopyDispersed,
  rulesetActiveConditions,
  rulesetAuraDistance,
  rulesetTargetHasSenses,
  rulesetTargetIs,
  rulesetTargetTypesAllow,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetMovementAllowance,
  rulesetSealed,
  rulesetSealedApart,
  rulesetLairRound,
  rulesetCombatFailsSave,
  rulesetCombatDamageKind,
  rulesetCombatValue,
  rulesetDamageMinimum,
  rulesetTargetDamageKind,
  rulesetCombatHealth,
  rulesetCombatStanding,
  rulesetSymbolSpendHolder,
  rulesetSymbolSpendBudget,
  rulesetSymbolSpendStanding,
  rulesetDamageInEffect,
  rulesetCheckMode,
  rulesetInitiativeModifierNow,
  rulesetInitiativeOrder,
  rulesetPoolInitiative,
  throwInitiativeDice,
  rulesetInitiativeTwice,
  rulesetThrowInitiativeAgain,
  rulesetConditionModifiers,
  grantRulesetMovement,
  spendRulesetMovement,
  rulesetSaveMode,
  rulesetCreatureKind,
  rulesetCombatHide,
  rulesetCheckAbility,
  rulesetCheckSkill,
  rulesetCheckTakenModes,
  rulesetActionAsUsed,
  rulesetImmuneToCondition,
  writeRulesetSheet,
  type RulesetCombatHealth,
  type RulesetConditionModifier,
  rulesetAuraReaches,
  rulesetAuraSpreaders,
  rulesetSyncAuras,
  rulesetSyncSizes,
  rulesetMovesOnly,
  rulesetLightMatches,
} from "./encounter.js";
import {
  rulesetAreaCells,
  rulesetBlowKind,
  rulesetChargeRun,
  rulesetCellDistance,
  rulesetCellEnterCost,
  rulesetMoveStep,
  rulesetOpportunityAttack,
  rulesetGapFrom,
  rulesetPositionOf,
  rulesetPathCells,
  rulesetPushPath,
  rulesetStepLeavesReach,
  rulesetThreateningEnemies,
  rulesetAirborne,
  rulesetCellBlocked,
  rulesetLevelOf,
  rulesetSlowedCells,
  rulesetSlowedStep,
  rulesetWallShape,
  rulesetDistanceTo,
  rulesetFills,
  rulesetFootprint,
  rulesetFootprintAt,
  rulesetGap,
  rulesetInCells,
  rulesetNearestCell,
  rulesetReachableCells,
  rulesetSpanOf,
  rulesetWalkingDistances,
} from "./grid.js";
import {
  rulesetAttackModifierReaches,
  rulesetBorrowedTurn,
  rulesetLegendaryMoveCells,
  rulesetLentMovement,
  rulesetDamageModifiers,
  rulesetWeaponBlow,
  RULESET_MOVE_OPTION,
  RULESET_ZONE_OPTION_PREFIX,
  RULESET_ZONE_TURN_OPTION_PREFIX,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  RULESET_FLY_DOWN_OPTION,
  RULESET_FLY_UP_OPTION,
  rulesetRelightCells,
  RULESET_LAND_OPTION,
  RULESET_TAKE_OFF_OPTION,
  planRulesetCombatCost,
  rulesetChosenUsesMax,
  rulesetAlterFits,
  rulesetAlteredAction,
  planRulesetAlterCost,
  rulesetActionAvailable,
  rulesetSheetWithin,
  rulesetSheetValue,
  rulesetAimLegal,
  rulesetAimedCells,
  rulesetCopiesLegal,
  rulesetWarded,
  type RulesetAreaLay,
  rulesetAreaTargets,
  rulesetAroundTargets,
  rulesetAttackMode,
  rulesetCombatOptions,
  rulesetUncompelledOptions,
  rulesetContestCheck,
  rulesetEscapeDc,
  rulesetCostSteps,
  rulesetActionUses,
  rulesetPaidLevel,
  rulesetCriticalFromAdjacent,
  rulesetCoverBonus,
  rulesetDefenseAgainst,
  rulesetToHitAgainst,
  rulesetMarkedBy,
  rulesetFreeStrike,
  rulesetGrantedStandard,
  rulesetOptionTargets,
  rulesetUsedOn,
  rulesetUsedOnKey,
  rulesetUsedOnMarks,
  rulesetProneCondition,
  rulesetReactionPointsAtSource,
  rulesetReactionTarget,
  rulesetHitItem,
  rulesetFallTargets,
  rulesetReactionsAt,
  rulesetSequenceCanHappen,
  rulesetSequencePartAvailable,
  rulesetSignatureOptions,
  rulesetLentLairTurn,
  rulesetStandCost,
  rulesetStandardBudget,
  rulesetStandardName,
  rulesetTargetRefusal,
  rulesetWindowMoment,
  rulesetWindowOptions,
  countRulesetSpend,
  rulesetActionTakesStyle,
  rulesetAttackStyles,
  type RulesetInitiativeStyle,
  rulesetCanRevive,
  rulesetPutOnBy,
  rulesetRoomAt,
  rulesetIsSpell,
  rulesetRepeatsHeld,
  rulesetReadiedOption,
  rulesetUseIsFree,
  rulesetWithFreeUse,
  rulesetAimCells,
} from "./options.js";
import type {
  RulesetActionResume,
  RulesetBoardProp,
  RulesetFallResume,
  RulesetBlowKind,
  RulesetCombatAction,
  RulesetCombatCharge,
  RulesetCombatMove,
  RulesetCombatDamageClause,
  RulesetCombatModeLine,
  RulesetCombatAmount,
  RulesetCombatAroundHit,
  RulesetCombatApplies,
  RulesetCombatCell,
  RulesetReachableCell,
  RulesetCombatChoice,
  RulesetCombatEvent,
  RulesetCombatOption,
  RulesetCombatPoolRoll,
  RulesetCombatRefusal,
  RulesetCombatRescue,
  RulesetCombatRider,
  RulesetCombatSaveRider,
  RulesetCombatRollMode,
  RulesetCombatRoller,
  RulesetCombatStep,
  RulesetCombatWindow,
  RulesetCombatZone,
  RulesetCombatZoneRule,
  RulesetCombatant,
  RulesetConditionBonus,
  RulesetConditionEnding,
  RulesetContestSide,
  RulesetSearchApart,
  RulesetEncounterOutcome,
  RulesetEncounterState,
  RulesetEncounterSummary,
  RulesetHeldAttack,
  RulesetHeldGround,
  RulesetTrackedCondition,
  RulesetWalkResume,
  RulesetWindowResume,
  RulesetWindowTrigger,
} from "./types.js";
import {
  rulesetStandingProps,
  rulesetStandingSections,
  rulesetStandingZones,
  rulesetZoneCatches,
  rulesetZoneCells,
  rulesetZoneMiddles,
  rulesetZoneHolds,
  rulesetZoneHoldsOne,
  rulesetZoneDriftCell,
  rulesetZoneOccupants,
  rulesetZoneSideOccupants,
  rulesetSyncZoneWalls,
} from "./zones.js";
import { rulesetChangeGround, rulesetClearGrowth, rulesetGrowthRule, rulesetRunBoardEvents } from "./board-events.js";
import { rulesetCallCreatures, rulesetTurnAfterCalls } from "./calls.js";

/** Everything one step of the fight needs: the rules, the state it is changing, its dice and the
 *  events it has produced so far. */
interface RulesetCombatContext {
  definition: RulesetDefinition;
  combat: RulesetCombat;
  state: RulesetEncounterState;
  roll: RulesetCombatRoller;
  events: RulesetCombatEvent[];
  /** Whoever gave themselves away while hiding (1.287), and how: found out once the step is done,
   *  so the blow itself is still made unseen. */
  giveaways?: Map<string, "attack" | "noise">;
  /** Whoever used something in this step (1.288), for what was readied for an opponent acting. */
  acted?: Set<string>;
  /** Combatants a blow could find no box for on a wound track that refuses when full. In the
   *  systems that keep such a track that is what being taken out IS, so the blow puts them down;
   *  without it a fight on one could never end. Read, and cleared, when the blow is finished. */
  overwhelmed: Set<string>;
  /** Source-side harm ends conditions only once the harmful step has finished (1.125). */
  harmEndings: Array<() => void>;
  /** The cell an area was aimed at in this step, which a save against it takes cover from. */
  aimedAt?: RulesetCombatCell;
  /** Where further copies of the area were set down (1.178). */
  aimedAlso?: RulesetCombatCell[];
  falling?: RulesetFallResume[];
  /** A standing zone is striking on its own, not its caster acting (1.180). */
  byZone?: true;
  /** Whose turn's own start or end is being counted down right now, so a condition left behind in
   *  the middle of a turn can be told from one left behind as the turn begins or ends. */
  ticking?: string;
  /** A strike made inside a window that may still be held where it hits (1.243). */
  nestHit?: true;
  /** The budget the action being resolved was paid for from, for an answer to its hit (1.248). */
  strikeBudget?: string;
  /** How many uses its user chose to spend on the action being resolved (1.251). */
  chosenAmount?: number;
  /** How many more of an item's charges its user spends on the action being resolved (1.269). */
  moreCharges?: number;
  /** Who is making a blow that reaps (1.323): whoever it fells on Held Ground is reaped. */
  reaping?: string;
  /** Where the teleport being resolved goes, and who goes along (1.276); nowhere is out of the
   *  fight (1.279). */
  teleport?: { to?: RulesetCombatCell; carries: string[] };
  /** The catalog the action being resolved was cast out of, and what it puts on (1.278). */
  harming?: { catalog: string; applies: string[] };
  /** The window between turns a legendary cast was bought in (1.284): every window opened while it
   *  resolves holds it, to be asked on from once they have all closed. */
  outer?: RulesetCombatWindow;
}

/** Set while a legendary cast (1.284) resolves as its maker's turn would, so each step begun inside
 *  it knows the window it was bought in. */
let borrowedOuter: RulesetCombatWindow | undefined;

/** A working copy, plus a roller that counts its dice so the state's cursor stays exact. */
function begin(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
): { ctx: RulesetCombatContext; finish: () => RulesetCombatStep } {
  const next = structuredClone(state);
  let rolls = 0;
  const ctx: RulesetCombatContext = {
    definition,
    combat,
    state: next,
    roll: (sides) => {
      rolls += 1;
      return roller(sides);
    },
    events: [],
    overwhelmed: new Set(),
    harmEndings: [],
    ...(borrowedOuter ? { outer: borrowedOuter } : {}),
  };
  for (const target of next.combatants) endImmuneConditions(ctx, target);
  return {
    ctx,
    finish: () => {
      for (const target of next.combatants) endImmuneConditions(ctx, target);
      for (const end of ctx.harmEndings.splice(0)) end();
      let landed = false;
      while (!next.window && next.pendingFalls?.length) {
        const held = next.pendingFalls.shift()!;
        const actor = rulesetCombatant(next, held.actorId);
        const target = rulesetCombatant(next, held.targetId);
        if (held.others) fallTogether(ctx, [{ ...held, others: undefined }, ...held.others]);
        else if (actor && target) fall(ctx, actor, target, held.levels);
        for (const end of ctx.harmEndings.splice(0)) end();
        landed = true;
      }
      if (next.pendingFalls?.length === 0) delete next.pendingFalls;
      if (landed) noteOutcome(ctx);
      if (!next.window) endActionConditions(ctx);
      // Fog a wind now reaches is blown away (1.286).
      disperseFogs(ctx);
      // Magical darkness a light meets is dispelled (1.297).
      dispelDarkness(ctx);
      // Whoever gave themselves away, or is now seen clearly, is hidden no longer (1.287).
      syncHiding(ctx);
      // What was readied for an opponent using something, asked about now (1.288).
      readiedActs(ctx);
      // The cells standing walls close, as the zones now standing say (1.177).
      rulesetSyncZoneWalls(next);
      // Grown or shrunk as the conditions now held say (1.195).
      for (const change of rulesetSyncSizes(definition, next)) ctx.events.push({ type: "resized", ...change });
      // Spread, or taken back, by auras as everybody now stands (1.263).
      for (const change of rulesetSyncAuras(definition, next)) {
        ctx.events.push({
          type: "condition",
          targetId: change.targetId,
          condition: change.condition,
          active: change.active,
          reason: change.active ? "aura" : "parted",
        });
      }
      next.cursor = state.cursor + rolls;
      return { state: next, events: ctx.events };
    },
  };
}

/** Whether a list of damage types holds this one. An entry that names what gets through it does not
 *  hold a blow carrying any of that. */
function matches(
  list: readonly RulesetCreatureHideEntry[] | undefined,
  type: string,
  qualities: readonly string[] = [],
): boolean {
  return !!list?.some((entry) =>
    typeof entry === "string"
      ? entry.trim().toLowerCase() === type
      : entry.type.trim().toLowerCase() === type && !entry.except.some((tag) => qualities.includes(tag)),
  );
}

/** Whether a target passes this save without rolling (1.181): immune to one of the damage types or
 *  conditions it names, or what it says it is. */
function savesOutright(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  save: NonNullable<RulesetCombatAction["save"]>,
): boolean {
  const succeeds = save.succeeds;
  if (!succeeds) return false;
  if (succeeds.is && rulesetTargetIs(ctx.definition, target, succeeds.is)) return true;
  if (
    succeeds.conditionImmune?.some((condition) =>
      rulesetImmuneToCondition(target, condition, ctx.definition, ctx.state),
    )
  )
    return true;
  if (!succeeds.immune?.length) return false;
  const immune = rulesetCombatHide(ctx.definition, target, ctx.state).immune;
  return succeeds.immune.some((type) => matches(immune, type.trim().toLowerCase()));
}

// ── Health ──

function healthOf(ctx: RulesetCombatContext, combatant: RulesetCombatant) {
  return rulesetCombatHealth(ctx.definition, ctx.combat, combatant);
}

/** One amount rolled: the dice as they fell, the flat part, and the total. `extra` is what a higher
 *  payment adds, rolled as its own dice so a step of another die size is still exact. */
function rollAmount(
  ctx: RulesetCombatContext,
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
  /** The amount's own dice at or below this are thrown again once, the new face standing (1.98). */
  rerollUpTo?: number,
): { rolls: number[]; flat: number; total: number } {
  const rolls = rerollLow(ctx, rollRulesetDice(ctx.roll, amount.count, amount.sides), amount.sides, rerollUpTo);
  let flat = amount.flat;
  if (extra && extra.times > 0) {
    rolls.push(...rollRulesetDice(ctx.roll, extra.amount.count * extra.times, extra.amount.sides));
    flat += extra.amount.flat * extra.times;
  }
  return { rolls, flat, total: sumOf(rolls) + flat };
}

/** An amount at its most (1.185): every die, and every extra one a higher payment adds, at its top
 *  face. */
function maxAmount(
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
): { rolls: number[]; flat: number; total: number } {
  const rolls: number[] = Array(amount.count).fill(amount.sides);
  let flat = amount.flat;
  if (extra && extra.times > 0) {
    rolls.push(...Array(extra.amount.count * extra.times).fill(extra.amount.sides));
    flat += extra.amount.flat * extra.times;
  }
  return { rolls, flat, total: sumOf(rolls) + flat };
}

/** Which way a save's own modes lean for this target (1.185), the two cancelling as they do anywhere. */
function saveLean(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  modes: RulesetCombatSaveRider["modes"],
): "advantage" | "disadvantage" | undefined {
  const leans = new Set(
    (modes ?? []).filter((entry) => rulesetTargetIs(ctx.definition, target, entry.is)).map((entry) => entry.mode),
  );
  return leans.size === 1 ? [...leans][0] : undefined;
}

/** Two leans on one roll: either alone, or none where they meet (1.253). */
function leanWith(
  lean: "advantage" | "disadvantage" | undefined,
  more: "advantage" | "disadvantage",
): "advantage" | "disadvantage" | undefined {
  return lean === undefined || lean === more ? more : undefined;
}

/** Faces at or below `upTo` thrown again once, each new face standing whatever it is: 5e's Great Weapon
 *  Fighting ("you can reroll the die and must use the new roll"). */
function rerollLow(ctx: RulesetCombatContext, rolls: number[], sides: number, upTo: number | undefined): number[] {
  if (!upTo || upTo < 1) return rolls;
  return rolls.map((face) => (face <= upTo ? rollRulesetDice(ctx.roll, 1, sides)[0]! : face));
}

/**
 * One amount of harm in a `dice-pool` fight: its dice (and the extra dice a hit earned, and what a
 * higher payment adds) thrown against the damage target, its flat part added as automatic successes,
 * and what the target soaks of its kind taken off. Soak that is thrown is thrown the same way and
 * takes one off for each success; soak that is not comes off the dice before they are thrown. Either
 * way nothing goes below zero, and automatic successes are soaked like any other.
 */
function throwHarm(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  amount: RulesetCombatAmount,
  damageType: string | undefined,
  extraDice: number,
  extra?: { amount: RulesetCombatAmount; times: number },
  /** Whether the target's soak is taken off at all. A spending blow's harm is never soaked. */
  withSoak = true,
  attack?: { minimum?: number; qualities?: readonly string[] },
): {
  rolls: number[];
  flat: number;
  total: number;
  pool: NonNullable<RulesetDamageInput["pool"]>;
} {
  const mapped = rulesetTargetDamageKind(ctx.definition, ctx.combat, target, damageType, attack?.qualities);
  const kind = mapped.kind;
  const soak = withSoak ? rulesetSoakOf(target, kind) : 0;
  const rule = ctx.combat.pool?.soak;
  let dice = amount.count + extraDice + (extra && extra.times > 0 ? extra.amount.count * extra.times : 0);
  const flat = amount.flat + (extra && extra.times > 0 ? extra.amount.flat * extra.times : 0);
  let soaked: { value: number; rolls?: number[]; taken: number } | undefined;
  if (rule && !rule.roll && soak > 0) {
    const taken = Math.min(Math.max(0, dice), soak);
    dice -= taken;
    soaked = { value: soak, taken };
  }
  const minimum = withSoak ? attack?.minimum : undefined;
  if (minimum !== undefined) dice = Math.max(dice, minimum);
  const thrown = throwRulesetDamageDice(ctx.definition, ctx.combat, ctx.roll, dice);
  const counted = thrown.successes + Math.max(0, flat);
  let total = counted;
  // Nothing to take off is nothing to throw for.
  if (rule?.roll && soak > 0 && total > 0) {
    const soakThrow = throwRulesetDamageDice(ctx.definition, ctx.combat, ctx.roll, soak);
    const taken = Math.min(total, soakThrow.successes);
    total -= taken;
    soaked = { value: soak, rolls: soakThrow.rolls, taken };
  }
  return {
    rolls: thrown.rolls,
    flat: Math.max(0, flat),
    total,
    pool: {
      target: thrown.target,
      successes: counted,
      ...(soaked ? { soak: soaked } : {}),
      ...(minimum !== undefined ? { minimum } : {}),
      ...(mapped.remappedFrom !== undefined ? mapped : {}),
    },
  };
}

/** What a critical hit adds, by the rule the ruleset declared: the same dice thrown again, or their
 *  highest faces added once. */
function criticalExtra(
  ctx: RulesetCombatContext,
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
  /** As `rollAmount`'s: the amount's own dice thrown again for the critical are rerolled the same way. */
  rerollUpTo?: number,
): { rolls: number[]; flat: number } {
  const rule = ctx.combat.attackRoll?.critical ?? "none";
  const dice: Array<{ count: number; sides: number }> = [{ count: amount.count, sides: amount.sides }];
  if (extra && extra.times > 0) {
    dice.push({ count: extra.amount.count * extra.times, sides: extra.amount.sides });
  }
  if (rule === "double-dice") {
    return {
      rolls: dice.flatMap((entry, index) =>
        index === 0
          ? rerollLow(ctx, rollRulesetDice(ctx.roll, entry.count, entry.sides), entry.sides, rerollUpTo)
          : rollRulesetDice(ctx.roll, entry.count, entry.sides),
      ),
      flat: 0,
    };
  }
  if (rule === "max-dice") {
    return { rolls: [], flat: dice.reduce((total, entry) => total + entry.count * entry.sides, 0) };
  }
  return { rolls: [], flat: 0 };
}

interface RulesetDamageInput {
  sourceId?: string;
  label?: string;
  damageType?: string;
  /** What the blow carries past a resistance's exception: the tags of the weapon item it came from. */
  qualities?: readonly string[];
  /** The entry it came from (`<catalog>/<entry>`), which a condition may keep off entirely (1.117). */
  entry?: string;
  rolls: number[];
  flat: number;
  amount: number;
  saved?: boolean;
  critical?: boolean;
  /** Under `dice-pool`: what the damage dice counted, and what soak took off before `amount`. */
  pool?: Extract<RulesetCombatEvent, { type: "damage" }>["pool"];
  /** What it deals its maker gains as temporary points (1.187). */
  drains?: true;
  /** The weapon's floor, when it raised `amount` to it. */
  floor?: number;
  /** A resistance to it counts for nothing (1.192): a vorpal sword's slashing. */
  ignoresResistance?: true;
  /** What it takes off health comes back only with a rest (1.193): a sword of wounding's. */
  seals?: true;
  /** Not even with a rest, only something that unseals (1.203): a clay golem's Slam. */
  lasting?: true;
  /** It never takes the target below this much health (1.235): Harm's 1. */
  leavesAtLeast?: number;
}

/**
 * ONE amount off a target, with their own hide read first: immune takes none, resistant takes half
 * rounded down and vulnerable takes double. Temporary points go first, which is the sheet's own rule.
 *
 * A blow may be several of these, one for the first amount and one for every clause beside it, so
 * what follows a blow (the conditions damage ends, concentration, going down) is `afterBlow`'s, and
 * is done once for the lot.
 */
function applyDamage(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: RulesetDamageInput,
  deferWound = false,
  damageSaves?: Set<RulesetTrackedCondition>,
): number {
  const before = healthOf(ctx, target);
  const type = input.damageType?.trim().toLowerCase();
  // Fire reaching somebody standing in a web sets it alight (1.183).
  // Any cell they fill (1.194).
  const standing = rulesetFootprint(target);
  if (type && standing.length > 0) igniteZones(ctx, [type], standing);
  let dealt = Math.max(0, Math.floor(input.amount));
  let adjust: "none" | "resist" | "vulnerable" | "immune" = "none";
  // A creature's own hide, and what the target's items keep off.
  const hide = type ? rulesetCombatHide(ctx.definition, target, ctx.state) : undefined;
  // A condition that keeps this very entry off (1.117) does, whatever kind of harm it is.
  const entry = input.entry;
  const from = input.sourceId ? rulesetCombatant(ctx.state, input.sourceId) : undefined;
  // Nothing passes a sphere (1.314), in or out.
  if (from && rulesetSealedApart(ctx.definition, ctx.state, from, target)) {
    dealt = 0;
    adjust = "immune";
  } else if (
    entry &&
    rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((one) =>
      one.noDamageFrom?.includes(entry),
    )
  ) {
    dealt = 0;
    adjust = "immune";
  } else {
    const resistant =
      !input.ignoresResistance &&
      (!!(type && hide && matches(hide.resist, type, input.qualities)) ||
        rulesetCombatEffects(ctx.definition, ctx.combat, target, ctx.state).has("resist-all"));
    const vulnerable = !!(type && hide && matches(hide.vulnerable, type));
    if (type && hide && matches(hide.immune, type, input.qualities)) {
      dealt = 0;
      adjust = "immune";
    } else if (resistant && !vulnerable) {
      dealt = Math.floor(dealt / 2);
      adjust = "resist";
    } else if (vulnerable && !resistant) {
      dealt *= 2;
      adjust = "vulnerable";
    }
  }
  // Its roll, as it is made, has dice taken off by the other side where that keeps one of them
  // standing who it would take down (1.257): Cutting Words.
  const source = input.sourceId ? rulesetCombatant(ctx.state, input.sourceId) : undefined;
  if (
    source &&
    input.rolls.length > 0 &&
    dealt > 0 &&
    input.leavesAtLeast === undefined &&
    !target.down &&
    rulesetCombatStanding(target)
  ) {
    const scaled = (amount: number) => {
      const at = Math.max(0, Math.floor(amount));
      return adjust === "immune" ? 0 : adjust === "resist" ? Math.floor(at / 2) : adjust === "vulnerable" ? at * 2 : at;
    };
    const left = before.value + before.temp;
    const by = lowerRoll(
      ctx,
      source,
      "damage",
      input.label ?? "",
      Math.max(0, Math.floor(input.amount)),
      (most, holder) => holder.side === target.side && left - dealt <= 0 && left - scaled(input.amount - most) > 0,
    );
    if (by > 0) dealt = scaled(input.amount - by);
  }
  // Never below the floor it leaves (1.235), what the buffer soaks counted.
  if (input.leavesAtLeast !== undefined) {
    dealt = Math.max(0, Math.min(dealt, before.value + before.temp - input.leavesAtLeast));
  }
  const toTemp = Math.min(before.temp, dealt);
  if (dealt > 0) {
    if (target.sheet) {
      if (!deferWound)
        writeHealthLoss(ctx, target, dealt, input.damageType, input.seals, input.lasting, input.pool?.kind);
    } else if (target.health) {
      target.health.temp = before.temp - toTemp;
      const value = Math.max(0, before.value - (dealt - toTemp));
      // What only a rest gives back (1.193): the points it took off, not the buffer.
      if (input.seals) {
        target.health.sealed = Math.min(before.max, (target.health.sealed ?? 0) + (target.health.value - value));
      }
      target.health.value = value;
    }
  }
  const after = healthOf(ctx, target);
  ctx.events.push({
    type: "damage",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.damageType ? { damageType: input.damageType } : {}),
    rolls: input.rolls,
    flat: input.flat,
    amount: Math.max(0, Math.floor(input.amount)),
    dealt,
    adjust,
    ...(input.saved ? { saved: true } : {}),
    toTemp,
    health: after.value,
    maxHealth: after.max,
    ...(input.critical ? { critical: true } : {}),
    ...(input.pool ? { pool: input.pool } : {}),
    ...(input.floor !== undefined ? { floor: input.floor } : {}),
  });
  ctx.harmEndings.push(endConditionsOnHarm(ctx, target, input.sourceId, dealt, false, damageSaves));
  return dealt;
}

/**
 * What a whole blow does once every amount on it has landed: the conditions any damage ends, ONE
 * check against concentration for the summed damage, and one check for going down.
 *
 * Whether the target was already down is read off the combatant here, before this changes it. Going
 * down only ever happens in this function, so every clause of one blow reads the same answer and a
 * second clause cannot be read as a second blow at somebody who is already on the ground; and
 * somebody a blow took out with boxes still clear counts as down though their health is not zero.
 */
function afterBlow(ctx: RulesetCombatContext, target: RulesetCombatant, dealt: number, critical: boolean): void {
  const overwhelmed = ctx.overwhelmed.delete(target.id);
  if (dealt <= 0) return;
  const wasDown = !!target.down;
  endConditionsOnDamage(ctx, target);
  const after = healthOf(ctx, target);
  const out = after.value <= 0 || overwhelmed || wasDown;
  // A blow that leaves somebody standing tests their concentration. One that takes them out does
  // not: going down ends it outright (`dropToZero`), so nothing is rolled for it.
  if (!out) concentrationFromDamage(ctx, target, dealt);
  if (out) {
    if (!wasDown) dropToZero(ctx, target);
    else if (target.dying && !target.defeated) {
      // Already down: a blow while down costs the rule's own number of failures.
      const rule = critical ? ctx.combat.dying?.criticalWhileDown : ctx.combat.dying?.damageWhileDown;
      // A stable member who is hurt is no longer stable: the count starts again with this blow.
      if (rule && rule !== "none") target.stable = false;
      if (rule === "one-failure") addDeathFailures(ctx, target, 1);
      else if (rule === "two-failures") addDeathFailures(ctx, target, 2);
    }
  }
  groundFlier(ctx, target);
}

/**
 * What a landing blow does to the sheet's health, whichever shape it takes.
 *
 * A POOL loses the points, temporary buffer first, exactly as it always has.
 *
 * A WOUND TRACK is marked by the rule its ruleset declared in `combat.damageKinds.marks`, because
 * the two honest answers are opposite ones. Where a damage roll counts health levels, a blow for
 * three ticks three boxes (`per-point`), which is how the tracked systems are played and the whole
 * reason soaking a blow down matters. Where a blow simply lands or does not, it ticks one box
 * however hard it hit (`per-blow`). Either way the rolled amount still decides whether the blow
 * lands AT ALL, so a miss and a blow softened to nothing mark nothing. Which KIND it marks is the
 * same block's own answer, never a guess.
 *
 * Resistances, vulnerabilities and immunities are not in the picture here: they are read off the
 * block before this is reached (see `applyDamage`), so a creature whose entry carries both a sheet
 * and a hide has the blow softened first and marked after, and one it is immune to marks nothing.
 */
function writeHealthLoss(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  dealt: number,
  damageType: string | undefined,
  /** What it takes comes back only with a rest (1.193). A wound track has no such points. */
  seals?: true,
  /** Not even with a rest (1.203). */
  lasting?: true,
  kind?: string,
): void {
  const health = ctx.combat.health;
  if (!("track" in health)) {
    writeRulesetSheet(ctx.definition, target, {
      op: "damage",
      pool: health.pool,
      amount: dealt,
      ...(seals ? { seals } : {}),
      ...(seals && lasting ? { lasting } : {}),
    });
    return;
  }
  // A plain track that fills up (1.383) takes the points, held at its maximum.
  const declared = ctx.definition.sheet.live.tracks.find((track) => track.id === health.track);
  if (!declared?.kinds) {
    const by = Math.floor(dealt);
    if (by > 0) writeRulesetSheet(ctx.definition, target, { op: "track", track: health.track, by });
    return;
  }
  // On an indexed track a blow names the box it lands on rather than how many it fills: its damage
  // under `per-point`, the first box under `per-blow`.
  const perPoint = ctx.combat.damageKinds?.marks === "per-point" ? Math.max(1, Math.floor(dealt)) : 1;
  const indexed = declared.fill === "indexed";
  markWound(ctx, target, {
    op: "damage",
    track: health.track,
    kind: kind ?? rulesetCombatDamageKind(ctx.combat, damageType),
    ...(indexed ? { amount: 1, box: perPoint } : { amount: perPoint }),
  });
}

/** A mark a fight writes. The fight's own kinds are the track's (checked at import) and its amounts
 *  are whole and positive, so the one refusal left is a track with no box free for it. */
function markWound(ctx: RulesetCombatContext, target: RulesetCombatant, op: RulesetSheetOp): void {
  if (!writeRulesetSheet(ctx.definition, target, op)) ctx.overwhelmed.add(target.id);
}

/** And the other way: a pool gets the points back, as does a plain track that fills up (1.383), a
 *  wound track has ONE mark cleared, lightest first, by the same rule the player's own sheet clears one. It names no kind, because a heal that
 *  named one would clear only that kind. */
function writeHealthGain(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  amount: number,
  /** Health as the fight reads it, whose maximum a level may have halved (1.115). */
  before?: RulesetCombatHealth,
): void {
  const health = ctx.combat.health;
  if (!("track" in health)) {
    const room = before ? Math.max(0, before.max - before.value) : amount;
    if (Math.min(amount, room) > 0) {
      // The fight has already said whether this heal lands (1.261).
      writeRulesetSheet(ctx.definition, target, {
        op: "restore",
        pool: health.pool,
        amount: Math.min(amount, room),
        magical: true,
      });
    }
    return;
  }
  // A plain track that fills up (1.383) gives the points back, never below its floor.
  if (!ctx.definition.sheet.live.tracks.find((track) => track.id === health.track)?.kinds) {
    writeRulesetSheet(ctx.definition, target, { op: "track", track: health.track, by: -amount });
    return;
  }
  writeRulesetSheet(ctx.definition, target, {
    op: "damage",
    track: health.track,
    kind: "",
    amount: -1,
  });
}

/** Whether an action is magic (1.134), for a save against magic or a heal only magic gives (1.261). */
function magicalAction(action: RulesetCombatAction): boolean {
  return (action.qualities ?? action.damage?.qualities)?.includes("magical") === true;
}

function dealHeal(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number; magical?: boolean },
): void {
  const before = healthOf(ctx, target);
  // A condition that keeps every heal off (1.191), or every heal but a magical one (1.261), leaves
  // the roll in the log and gives back nothing.
  const effects = rulesetCombatEffects(ctx.definition, ctx.combat, target, ctx.state);
  const blocked = effects.has("cannot-heal") || (!input.magical && effects.has("cannot-heal-nonmagical"));
  const amount = blocked ? 0 : Math.max(0, Math.floor(input.amount));
  if (amount > 0) {
    // Never past the maximum as it stands, which a level may have halved (1.115).
    if (target.sheet) writeHealthGain(ctx, target, amount, before);
    // Never past what only a rest gives back (1.193).
    else if (target.health) {
      const cap = Math.max(before.value, before.max - (target.health.sealed ?? 0));
      target.health.value = Math.min(cap, before.value + amount);
    }
  }
  const after = healthOf(ctx, target);
  ctx.events.push({
    type: "heal",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    rolls: input.rolls,
    flat: input.flat,
    amount,
    health: after.value,
    maxHealth: after.max,
    ...(blocked ? { blocked: true as const } : {}),
  });
  // Back up when the heal gave them something back: from nothing, or, for somebody taken out with
  // boxes still clear, a mark cleared.
  if (target.down && !target.defeated && after.value > 0 && after.value > before.value) revive(ctx, target);
}

/** What only a rest gives back (1.193), given back now (1.201): the maximum whole again, and the
 *  health they have left where it was. */
function unsealHealth(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant): void {
  let amount = 0;
  if (target.sheet) {
    const health = ctx.combat.health;
    if ("track" in health) return;
    const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live);
    const pool = live.pools.find((entry) => !entry.listId && entry.key === health.pool);
    if (!pool || pool.sealed <= 0) return;
    amount = pool.sealed;
    if (!writeRulesetSheet(ctx.definition, target, { op: "restore", pool: pool.key, amount: 0, unseals: true })) return;
  } else if (target.health?.sealed) {
    amount = target.health.sealed;
    delete target.health.sealed;
  }
  if (amount <= 0) return;
  ctx.events.push({
    type: "unsealed",
    targetId: target.id,
    sourceId: actor.id,
    amount,
    maxHealth: healthOf(ctx, target).max,
  });
}

/** A live track moved by levels (1.201), held to its bounds: a sheet's through the sheet's own rules,
 *  anybody else's on the combatant. Raised past what halves their maximum, the health they hold is
 *  held to it; raised to a level that defeats, they are slain. Nothing is put on somebody immune. */
function moveTrack(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  track: string,
  by: number,
): void {
  const declared = ctx.definition.sheet.live.tracks.find((entry) => entry.id === track);
  if (!declared || declared.kinds) return;
  if (by > 0 && rulesetImmuneToCondition(target, track, ctx.definition)) return;
  const start = declared.default ?? declared.min;
  const from = target.sheet ? trackValue(ctx, target, track) : (target.tracks?.[track] ?? start);
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "track", track, by });
  else {
    const top = typeof declared.max === "number" ? declared.max : 1000;
    (target.tracks ??= {})[track] = Math.min(top, Math.max(declared.min, from + by));
  }
  const to = target.sheet ? trackValue(ctx, target, track) : target.tracks![track]!;
  if (to === from) return;
  ctx.events.push({ type: "track", targetId: target.id, sourceId: actor.id, track, label: declared.label, from, to });
  // Held to a maximum a level may have halved, as the fight's opening holds it (1.115).
  const health = healthOf(ctx, target);
  if (target.health && target.health.value > health.max) target.health.value = health.max;
  else if (target.sheet && !("track" in ctx.combat.health)) {
    const key = ctx.combat.health.pool;
    const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live);
    const pool = live.pools.find((entry) => !entry.listId && entry.key === key);
    if (pool && pool.value > health.max) {
      writeRulesetSheet(ctx.definition, target, { op: "spend", pool: key, amount: pool.value - health.max });
    }
  }
  if (
    !target.defeated &&
    rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) => entry.defeats)
  ) {
    slay(ctx, target, actor.id, declared.label);
  }
}

/** The first of a cure's parts this target has something for (1.204), in the order its modes list
 *  them: a condition it holds, a track above its floor (or any track it raises), sealed health. */
function firstCure(
  ctx: RulesetCombatContext,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): NonNullable<NonNullable<RulesetCombatAction["modes"]>[number]["cure"]> | undefined {
  const holds = new Set(rulesetCombatConditions(ctx.definition, target));
  for (const mode of action.modes ?? []) {
    const cure = mode.cure;
    if (!cure) continue;
    if (
      cure.ends !== undefined &&
      holds.has(cure.ends) &&
      (!action.ends?.from ||
        target.tracked.some(
          (entry) =>
            entry.condition === cure.ends && rulesetPutOnBy(ctx.definition, ctx.state, entry, action.ends?.from),
        ))
    )
      return cure;
    if (cure.track) {
      if (cure.track.by > 0) return cure;
      const declared = ctx.definition.sheet.live.tracks.find((entry) => entry.id === cure.track!.track);
      const floor = declared?.min ?? 0;
      const now = target.sheet
        ? trackValue(ctx, target, cure.track.track)
        : (target.tracks?.[cure.track.track] ?? declared?.default ?? floor);
      if (now > floor) return cure;
    }
    if (cure.unseals && sealedOf(ctx, target) > 0) return cure;
  }
  return undefined;
}

/** What only a rest or an unsealing gives back, as this combatant holds it (1.193). */
function sealedOf(ctx: RulesetCombatContext, target: RulesetCombatant): number {
  if (!target.sheet) return target.health?.sealed ?? 0;
  const health = ctx.combat.health;
  if ("track" in health) return 0;
  const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live);
  return live.pools.find((entry) => !entry.listId && entry.key === health.pool)?.sealed ?? 0;
}

/** Whether what only a rest or an unsealing gives back has taken the whole maximum (1.203). */
function rulesetSealedAway(ctx: RulesetCombatContext, target: RulesetCombatant): boolean {
  if (!target.sheet) return !!target.health && (target.health.sealed ?? 0) >= target.health.max;
  const health = ctx.combat.health;
  if ("track" in health) return false;
  const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live);
  const pool = live.pools.find((entry) => !entry.listId && entry.key === health.pool);
  return !!pool && pool.max > 0 && pool.sealed >= pool.max;
}

/** Temporary points never stack: the bigger buffer is the one that stands. */
function grantTemporary(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number },
): void {
  const amount = Math.max(0, Math.floor(input.amount));
  const before = healthOf(ctx, target);
  // A wound track carries no buffer, and there is nothing sensible a temporary point could be on
  // one, so a ruleset whose health is a track is refused a `temporary` at IMPORT. This branch is
  // what makes that refusal honest at runtime too: nothing is written and nothing is invented.
  const health = ctx.combat.health;
  if (amount > before.temp && !("track" in health)) {
    if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "temp", pool: health.pool, amount });
    else if (target.health) target.health.temp = amount;
  }
  ctx.events.push({
    type: "temporary",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    rolls: input.rolls,
    flat: input.flat,
    amount,
  });
}

/** Some of a pool given back, on a sheet: a creature's block has no pools, so it takes nothing. */
function restorePool(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  pool: string,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number },
  /** Past the pool's maximum (1.252). */
  overMax?: true,
): void {
  if (!target.sheet) return;
  const amount = Math.max(0, Math.floor(input.amount));
  if (amount > 0) {
    writeRulesetSheet(ctx.definition, target, { op: "restore", pool, amount, ...(overMax ? { overMax } : {}) });
  }
  // A list row's pool is named by its row (1.252), as the sheet's own command finds it.
  const pools = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live).pools;
  const wanted = pool.trim().toLowerCase();
  const now =
    pools.find((entry) => entry.key === pool) ??
    pools.find((entry) => !entry.listId && entry.label.toLowerCase() === wanted) ??
    pools.find((entry) => entry.listId && entry.label.toLowerCase() === wanted);
  if (!now) return;
  ctx.events.push({
    type: "restored",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    pool: now.label,
    rolls: input.rolls,
    flat: input.flat,
    amount,
    value: now.value,
    max: now.max,
  });
}

// ── Going down, and coming back ──

/** The conditions this one was holding up by still being on their feet. A charm ends when whoever
 *  cast it goes down, if the ruleset said so, wherever it landed. */
function endConditionsFromSource(ctx: RulesetCombatContext, source: RulesetCombatant): void {
  const ending = new Set(
    (ctx.combat.conditions ?? []).filter((entry) => entry.endsWhenSourceDown).map((entry) => entry.condition),
  );
  if (ending.size === 0) return;
  for (const combatant of ctx.state.combatants) {
    for (const entry of [...combatant.tracked]) {
      if (entry.source === source.id && ending.has(entry.condition)) {
        removeCondition(ctx, combatant, entry.condition, "expired");
      }
    }
  }
}

function dropToZero(ctx: RulesetCombatContext, target: RulesetCombatant, slain = false): void {
  // Hanging on at 1 instead (1.320): the Miller's Hourglass, once, with a turn of its own straight
  // after this one.
  const hangs = target.block?.hangsOn;
  // A creature that fights with a sheet hangs on in its hit point pool; a wound track has no 1 to hang
  // on at.
  const health = ctx.combat.health;
  const pool = target.sheet && !target.health && !("track" in health) ? health.pool : undefined;
  if (hangs && !slain && (target.health || pool) && (target.hungOn ?? 0) < hangs.uses) {
    target.hungOn = (target.hungOn ?? 0) + 1;
    if (target.health) target.health.value = 1;
    else {
      const now = healthOf(ctx, target).value;
      if (now < 1)
        writeRulesetSheet(ctx.definition, target, { op: "restore", pool: pool!, amount: 1 - now, magical: true });
    }
    ctx.events.push({
      type: "hangsOn",
      actorId: target.id,
      ...(hangs.label ? { label: hangs.label } : {}),
      left: hangs.uses - target.hungOn,
    });
    if (hangs.extraTurn) {
      const at = ctx.state.turn + 1;
      ctx.state.order.splice(at, 0, target.id);
      ctx.state.interjected = at;
      ctx.events.push({
        type: "extraTurn",
        actorId: target.id,
        initiative: target.initiative,
        label: hangs.label ?? "",
      });
    }
    return;
  }
  // A prop is nobody (1.316): nothing feeds on it falling.
  if (!target.object) feedAuras(ctx, target);
  target.down = true;
  // Held Ground (1.323): felled, out of the fight but never dying, unless the blow reaps.
  const held = ctx.state.heldGround;
  if (held && !target.object) {
    fell(ctx, target, held);
    return;
  }
  // Defeated before its concentration ends, so what a spell it held leaves behind as it ends (Haste's
  // lethargy) is not put on somebody already out of the fight.
  if (target.side === "enemy") {
    target.defeated = true;
    target.diedRound = ctx.state.round;
    endSummons(ctx, target);
    endZones(ctx, target);
    unconjureAll(ctx, target);
  }
  endConcentration(ctx, target, "down");
  endConditionsFromSource(ctx, target);
  if (target.side === "enemy") {
    ctx.events.push({ type: "defeated", actorId: target.id });
    return;
  }
  const dying = ctx.combat.dying;
  target.dying = !!dying;
  target.stable = false;
  if (dying?.condition)
    applyConditionId(ctx, target, dying.condition, { condition: dying.condition, duration: "instant" });
  ctx.events.push({ type: "down", actorId: target.id, dying: !!dying });
}

/** Whoever holds an aura that feeds (1.331) and reaches somebody now falling regains what it says:
 *  The Owed's Collector. Read before the one falling is out of the fight, so the aura still reaches
 *  them. */
function feedAuras(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const feeding = (ctx.combat.conditions ?? []).filter((entry) => entry.auras?.some((aura) => aura.feeds));
  if (feeding.length === 0) return;
  for (const holder of ctx.state.combatants) {
    if (holder.id === target.id || !rulesetCombatStanding(holder)) continue;
    const held = new Set(rulesetCombatConditions(ctx.definition, holder));
    let gain = 0;
    for (const entry of feeding) {
      if (!held.has(entry.condition)) continue;
      for (const aura of entry.auras ?? []) {
        if (aura.feeds && rulesetAuraReaches(ctx.definition, ctx.state, holder, aura, target, entry.condition))
          gain += aura.feeds;
      }
    }
    if (gain > 0) dealHeal(ctx, holder, { sourceId: holder.id, rolls: [], flat: gain, amount: gain, magical: true });
  }
}

/** Felled on Held Ground (1.323): out of the fight, stable and never dying, with its condition and a
 *  mark on its sheet; reaped instead where the blow that felled it reaps. */
function fell(ctx: RulesetCombatContext, target: RulesetCombatant, held: RulesetHeldGround): void {
  target.felled = true;
  target.dying = false;
  target.stable = true;
  // An opponent is out of the fight; a character lies stable where they fell, to be healed up.
  if (target.side === "enemy") {
    target.defeated = true;
    target.diedRound = ctx.state.round;
    endSummons(ctx, target);
    endZones(ctx, target);
    unconjureAll(ctx, target);
  }
  endConcentration(ctx, target, "down");
  endConditionsFromSource(ctx, target);
  ctx.events.push({ type: "felled", actorId: target.id, ...(held.label ? { label: held.label } : {}) });
  // Reaped as it falls, it stays down: a character so, for good.
  if (ctx.reaping) {
    target.reaped = true;
    ctx.events.push({ type: "reaped", actorId: target.id, sourceId: ctx.reaping });
    if (!target.defeated) {
      target.defeated = true;
      target.stable = false;
      target.diedRound = ctx.state.round;
    }
  }
  const down = target.side === "enemy" ? undefined : ctx.combat.dying?.condition;
  for (const condition of new Set([down, target.reaped ? undefined : held.condition])) {
    if (condition) applyConditionId(ctx, target, condition, { condition, duration: "instant" });
  }
  if (target.reaped) return;
  for (const mark of held.marks ?? []) moveTrack(ctx, target, target, mark.track, mark.by);
}

function trackValue(ctx: RulesetCombatContext, combatant: RulesetCombatant, track: string): number {
  if (!combatant.sheet) return 0;
  const live = readRulesetLive(ctx.definition, combatant.sheet.build, combatant.sheet.live);
  return live.tracks.find((entry) => entry.id === track)?.value ?? 0;
}

/** The top of a track as this combatant's own sheet has it, since a plain track's maximum may be a
 *  value the sheet works out. A combatant with no sheet has no track to fill. */
function trackMax(ctx: RulesetCombatContext, combatant: RulesetCombatant, track: string): number {
  if (!combatant.sheet) return 0;
  const live = readRulesetLive(ctx.definition, combatant.sheet.build, combatant.sheet.live);
  return live.tracks.find((entry) => entry.id === track)?.max ?? 0;
}

/** Back on their feet: the fight's own bookkeeping is cleared, and so are the tracks the rules
 *  counted the rolls on. */
/** Both counts back to where they start. Reviving does it, and so does becoming stable: the count
 *  is over once it is decided, and a stable member who is hurt again starts a fresh one. */
function clearDyingTracks(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  for (const track of [dying.successes, dying.failures]) {
    const declared = ctx.definition.sheet.live.tracks.find((entry) => entry.id === track);
    writeRulesetSheet(ctx.definition, target, { op: "track", track, to: declared?.default ?? declared?.min ?? 0 });
  }
}

function revive(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  target.down = false;
  delete target.felled;
  target.dying = false;
  target.stable = false;
  const dying = ctx.combat.dying;
  if (dying) {
    clearDyingTracks(ctx, target);
    if (dying.condition) removeCondition(ctx, target, dying.condition, "revived");
  }
  ctx.events.push({ type: "revived", actorId: target.id, health: healthOf(ctx, target).value });
}

function addDeathFailures(ctx: RulesetCombatContext, target: RulesetCombatant, amount: number): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  writeRulesetSheet(ctx.definition, target, { op: "track", track: dying.failures, by: amount });
  const failures = trackValue(ctx, target, dying.failures);
  const successes = trackValue(ctx, target, dying.successes);
  if (failures < trackMax(ctx, target, dying.failures)) return;
  target.defeated = true;
  target.diedRound = ctx.state.round;
  endSummons(ctx, target);
  endZones(ctx, target);
  unconjureAll(ctx, target);
  target.dying = false;
  ctx.events.push({
    type: "dying",
    actorId: target.id,
    rolls: [],
    kept: 0,
    difficulty: dying.succeedAt,
    successes,
    failures,
    result: "dead",
  });
}

/** The roll a character makes at the start of their turn while they are down. */
function deathSave(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  const rolls = rollRulesetDice(ctx.roll, dying.dice.count, dying.dice.sides);
  const kept = sumOf(rolls);
  const single = dying.dice.count === 1;
  const top = single && kept === dying.dice.sides;
  const bottom = single && kept === 1;
  const say = (result: "success" | "failure" | "stable" | "dead" | "revived") =>
    ctx.events.push({
      type: "dying",
      actorId: actor.id,
      rolls,
      kept,
      difficulty: dying.succeedAt,
      successes: trackValue(ctx, actor, dying.successes),
      failures: trackValue(ctx, actor, dying.failures),
      result,
    });

  if (top && dying.naturals.max === "revive-1") {
    dealHeal(ctx, actor, { rolls: [], flat: 1, amount: 1 });
    say("revived");
    return;
  }
  let failures = 0;
  let successes = 0;
  if (bottom && dying.naturals.min === "two-failures") failures = 2;
  else if (bottom && dying.naturals.min === "one-failure") failures = 1;
  else if (top && dying.naturals.max === "success") successes = 1;
  else if (kept >= dying.succeedAt) successes = 1;
  else failures = 1;

  if (failures > 0) {
    const before = actor.defeated;
    addDeathFailures(ctx, actor, failures);
    if (!before && actor.defeated) return;
    say("failure");
    return;
  }
  writeRulesetSheet(ctx.definition, actor, { op: "track", track: dying.successes, by: successes });
  if (trackValue(ctx, actor, dying.successes) >= trackMax(ctx, actor, dying.successes)) {
    actor.stable = true;
    say("stable");
    clearDyingTracks(ctx, actor);
    return;
  }
  say("success");
}

// ── Saves ──

/** A save, and a creature's legendary resistance (Capability API 1.317) turning a failure into a
 *  success while it has uses left: 5e's "If the dragon fails a saving throw, it can choose to succeed
 *  instead." A creature run by the Engine always chooses to. */
function rollSave(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  save: string,
  difficulty: number,
  sourceId?: string,
  from?: RulesetCombatCell | null,
  against?: RulesetSaveAgainst,
  lean?: "advantage" | "disadvantage",
): boolean {
  if (throwSave(ctx, combatant, save, difficulty, sourceId, from, against, lean)) return true;
  const uses = combatant.block?.legendaryResistance;
  const spent = combatant.legendaryResisted ?? 0;
  if (!uses || spent >= uses || combatant.object || !rulesetCombatStanding(combatant)) return false;
  combatant.legendaryResisted = spent + 1;
  ctx.events.push({ type: "legendaryResistance", actorId: combatant.id, save, left: uses - spent - 1 });
  return true;
}

function throwSave(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  save: string,
  difficulty: number,
  sourceId?: string,
  /** Where an action's own save comes from, which cover is read against. Never for a save that ends
   *  a condition or keeps concentration: nothing is coming at them. */
  from?: RulesetCombatCell | null,
  against?: RulesetSaveAgainst,
  /** The save's own word on who rolls it twice (1.185). */
  lean?: "advantage" | "disadvantage",
  /** Already rolled again once (1.249): the new roll stands. */
  rerolled = false,
): boolean {
  const own = combatant.saves[save] ?? 0;
  // Whatever it is against, it is against what its source is (1.185): Dragon Scale Mail's dragons.
  const source = sourceId ? rulesetCombatant(ctx.state, sourceId) : undefined;
  if (source) against = { ...against, from: rulesetCreatureKind(ctx.definition, source) };
  // A condition that fails this save takes the roll away entirely, rather than rolling and ignoring
  // the dice, so a log never shows a number that decided nothing. A thing (1.316) has no save to make.
  if (combatant.object || rulesetCombatFailsSave(ctx.definition, ctx.combat, combatant, save, ctx.state)) {
    ctx.events.push({
      type: "save",
      actorId: combatant.id,
      ...(sourceId ? { sourceId } : {}),
      save,
      rolls: [],
      kept: 0,
      modifier: own,
      total: 0,
      difficulty,
      success: false,
      automatic: true,
    });
    spendConditions(ctx, combatant, "own-save");
    return false;
  }
  // Cover helps the saves the ruleset names, said before the roll it changes (combat C6a-2).
  const cover =
    from && ctx.combat.cover?.saves?.includes(save)
      ? rulesetCoverBonus(ctx.combat, ctx.state, combatant, from, "save")
      : 0;
  if (cover > 0) ctx.events.push({ type: "cover", targetId: combatant.id, bonus: cover, save });
  const modifier = own + cover;
  const mode = rulesetSaveMode(ctx.definition, ctx.combat, combatant, save, ctx.state, against, lean);
  if (rulesetCombatIsSymbol(ctx.combat)) {
    // The save's number is its dice, its difficulty the dice thrown against them, and cover and
    // what conditions add are boost or setback dice (1.382).
    const bonuses = rollBonuses(
      ctx,
      rulesetConditionModifiers(ctx.definition, ctx.combat, combatant, "saves", ctx.state, save, against),
    );
    const thrown = throwSymbols(ctx, combatant, own, cover + bonusTotal(bonuses), mode, { difficulty });
    const success = thrown.successes >= rulesetSymbolNeeded(ctx.definition);
    ctx.events.push({
      type: "save",
      actorId: combatant.id,
      ...(sourceId ? { sourceId } : {}),
      save,
      ...(mode === "normal" ? {} : { mode }),
      rolls: thrown.rolls,
      kept: thrown.successes,
      modifier,
      ...(bonuses.length > 0 ? { bonuses } : {}),
      total: thrown.successes,
      difficulty,
      success,
      pool: symbolRecord(thrown),
    });
    spendConditions(ctx, combatant, "own-save");
    return success;
  }
  if (rulesetCombatIsPool(ctx.combat)) {
    // The save's number is its pool, and its difficulty the successes it needs, never fewer than one.
    const bonuses = rollBonuses(
      ctx,
      rulesetConditionModifiers(ctx.definition, ctx.combat, combatant, "saves", ctx.state, save, against),
    );
    const needed = Math.max(1, difficulty);
    const thrown = throwPool(ctx, combatant, modifier + bonusTotal(bonuses), mode);
    const success = !thrown.botch && thrown.successes >= needed;
    ctx.events.push({
      type: "save",
      actorId: combatant.id,
      ...(sourceId ? { sourceId } : {}),
      save,
      ...(mode === "normal" ? {} : { mode }),
      rolls: thrown.rolls,
      kept: thrown.successes,
      modifier,
      ...(bonuses.length > 0 ? { bonuses } : {}),
      total: thrown.successes,
      difficulty: needed,
      success,
      pool: poolRecord(thrown),
    });
    spendConditions(ctx, combatant, "own-save");
    return success;
  }
  // Rolled twice and one kept when a condition says so, exactly as an attack is. A roll that leans
  // no way says nothing about how it was made, so a fight with no such condition logs what it
  // always logged.
  const dice = ctx.combat.attackRoll!.dice;
  const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  // What the saver's conditions add, rolled after the save's own dice.
  const bonuses = rollBonuses(
    ctx,
    rulesetConditionModifiers(ctx.definition, ctx.combat, combatant, "saves", ctx.state, save, against),
  );
  // Short of it, what is held back until then (1.249): Bardic Inspiration, Resistance.
  bonuses.push(
    ...rescueBonuses(
      ctx,
      combatant,
      "saves",
      rulesetConditionModifiers(
        ctx.definition,
        ctx.combat,
        combatant,
        "saves",
        ctx.state,
        save,
        against,
        undefined,
        true,
      ),
      difficulty - (kept + modifier + bonusTotal(bonuses)),
      save,
    ),
  );
  const total = kept + modifier + bonusTotal(bonuses);
  const success = total >= difficulty;
  ctx.events.push({
    type: "save",
    actorId: combatant.id,
    ...(sourceId ? { sourceId } : {}),
    save,
    ...(mode === "normal" ? {} : { mode }),
    rolls: second ? [...first, ...second] : first,
    kept,
    modifier,
    ...(bonuses.length > 0 ? { bonuses } : {}),
    total,
    difficulty,
    success,
  });
  spendConditions(ctx, combatant, "own-save");
  // Failed, what its holder spends to roll again or succeed all the same (1.249): Indomitable.
  if (!success && !rerolled) {
    const rescue = rescueEntry(ctx, combatant, "saves", undefined, undefined, save);
    if (rescue?.rescue?.by === "reroll")
      return throwSave(ctx, combatant, save, difficulty, sourceId, from, against, lean, true);
    if (rescue) return true;
  }
  return success;
}

/** An item's gate, rolled by its user as a check: the fight's own dice (a pool in a pool fight) with
 *  the sheet's number read as the fight began, what their conditions add to checks (and to the skill
 *  it names), and the lean they give it. Logged as a save is. */
function passesGate(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  gate: NonNullable<NonNullable<RulesetCombatAction["itemUse"]>["gate"]>,
): boolean {
  const ability = gate.ability;
  const mode = rulesetCheckMode(ctx.definition, ctx.combat, actor, ctx.state, gate.skill, ability);
  const modifiers = rulesetConditionModifiers(
    ctx.definition,
    ctx.combat,
    actor,
    "checks",
    ctx.state,
    gate.skill,
    undefined,
    ability,
  );
  const said = {
    type: "gate" as const,
    actorId: actor.id,
    optionId: action.id,
    label: action.label,
    check: gate.check,
    ...(mode === "normal" ? {} : { mode }),
    modifier: gate.modifier,
  };
  if (rulesetCombatIsSymbol(ctx.combat)) {
    // The check's number is its dice and its difficulty the dice against them (1.382).
    const bonuses = rollBonuses(ctx, modifiers);
    const thrown = throwSymbols(ctx, actor, gate.modifier, bonusTotal(bonuses), mode, {
      difficulty: gate.difficulty,
    });
    const success = thrown.successes >= rulesetSymbolNeeded(ctx.definition);
    ctx.events.push({
      ...said,
      rolls: thrown.rolls,
      kept: thrown.successes,
      ...(bonuses.length > 0 ? { bonuses } : {}),
      total: thrown.successes,
      difficulty: gate.difficulty,
      success,
      pool: symbolRecord(thrown),
    });
    return success;
  }
  if (rulesetCombatIsPool(ctx.combat)) {
    // The check's number is its pool, and its difficulty the successes it needs: never fewer than
    // one, nor more than the ruleset's pool can count, as the Use button holds it.
    const bonuses = rollBonuses(ctx, modifiers);
    const resolution = ctx.definition.resolution;
    const most = resolution.kind === "dice-pool" ? rulesetPoolMaxSuccesses(resolution) : Infinity;
    const needed = Math.min(most, Math.max(1, gate.difficulty));
    const thrown = throwPool(ctx, actor, gate.modifier + bonusTotal(bonuses), mode);
    const success = !thrown.botch && thrown.successes >= needed;
    ctx.events.push({
      ...said,
      rolls: thrown.rolls,
      kept: thrown.successes,
      ...(bonuses.length > 0 ? { bonuses } : {}),
      total: thrown.successes,
      difficulty: needed,
      success,
      pool: poolRecord(thrown),
    });
    return success;
  }
  const dice = ctx.combat.attackRoll!.dice;
  const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  const bonuses = rollBonuses(ctx, modifiers);
  bonuses.push(
    ...rescueBonuses(
      ctx,
      actor,
      "checks",
      rulesetConditionModifiers(
        ctx.definition,
        ctx.combat,
        actor,
        "checks",
        ctx.state,
        gate.skill,
        undefined,
        ability,
        true,
      ),
      gate.difficulty - (kept + gate.modifier + bonusTotal(bonuses)),
    ),
  );
  let total = kept + gate.modifier + bonusTotal(bonuses);
  // Made, dice off it from the other side where that could fail it (1.257): Cutting Words.
  if (total >= gate.difficulty) {
    total -= lowerRoll(ctx, actor, "checks", action.label, total, (most) => total - most < gate.difficulty);
  }
  // Failed, what its holder spends to succeed all the same (1.249): Stroke of Luck.
  const success =
    total >= gate.difficulty ||
    !!rescueEntry(ctx, actor, "checks", "success") ||
    // Its d20 counted as a 20 where that makes it (1.256): Stroke of Luck.
    (!rulesetCombatIsPool(ctx.combat) &&
      !rulesetCombatIsSymbol(ctx.combat) &&
      !!rescueEntry(ctx, actor, "checks", "twenty", () => total - kept + 20 >= gate.difficulty));
  ctx.events.push({
    ...said,
    rolls: second ? [...first, ...second] : first,
    kept,
    ...(bonuses.length > 0 ? { bonuses } : {}),
    total,
    difficulty: gate.difficulty,
    success,
  });
  return success;
}

/** A pool thrown to act, with the thrower's wound penalty in it: what a `dice-pool` fight throws for
 *  an attack, a save and a side of a contest. The penalty is dice off the pool, under the ruleset's
 *  own floor, exactly as it is on a check. */
function throwPool(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  dice: number,
  mode: RulesetCombatRollMode,
  /** A weapon's own per-die target. */
  threshold?: number,
): RulesetCombatPoolThrow & { penalty: number } {
  const penalty = rulesetCombatPenalty(ctx.definition, who);
  return { ...throwRulesetCombatPool(ctx.definition, ctx.roll, dice + penalty, mode, threshold), penalty };
}

/** What an event says about one pool it threw. */
function poolRecord(thrown: RulesetCombatPoolThrow & { penalty: number }): RulesetCombatPoolRoll {
  return {
    dice: thrown.dice,
    target: thrown.target,
    ...(thrown.penalty < 0 ? { penalty: thrown.penalty } : {}),
    ...(thrown.botch ? { botch: true } : {}),
  };
}

/** A `symbol-pool` fight's throw (1.382) for an attack, a save, a check or a side of a contest: the
 *  thrower's own dice, what their conditions add as boost or setback dice, their wound penalty as
 *  setback, and the boost and setback a spend left for their next roll, which this one uses up. */
function throwSymbols(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  dice: number,
  bonus: number,
  mode: RulesetCombatRollMode,
  against: { upgrades?: number; difficulty?: number } = {},
): RulesetSymbolThrow & { penalty: number } {
  const penalty = rulesetCombatPenalty(ctx.definition, who);
  const waiting = who.symbolDice;
  delete who.symbolDice;
  return {
    ...throwRulesetSymbolPool(ctx.definition, ctx.roll, {
      dice,
      ...(against.upgrades ? { upgrades: against.upgrades } : {}),
      difficulty: Math.max(0, against.difficulty ?? 0),
      bonus: bonus + penalty,
      ...(waiting?.boost ? { boost: waiting.boost } : {}),
      ...(waiting?.setback ? { setback: waiting.setback } : {}),
      mode,
    }),
    penalty,
  };
}

/** What an event says about one symbol throw. */
function symbolRecord(thrown: RulesetSymbolThrow & { penalty: number }): RulesetCombatPoolRoll {
  return {
    dice: thrown.dice,
    target: 0,
    ...(thrown.penalty < 0 ? { penalty: thrown.penalty } : {}),
    symbols: { ...thrown.symbols },
    ...(thrown.upgrades ? { upgrades: thrown.upgrades } : {}),
    difficulty: thrown.difficulty,
    ...(thrown.boost ? { boost: thrown.boost } : {}),
    ...(thrown.setback ? { setback: thrown.setback } : {}),
  };
}

/** Each side buys what the symbols an attack's roll left can buy (1.382): the attacker first, with
 *  the symbols that favour them, and then their target, with the ones that favour the target. What a
 *  spend does to the hit itself (harm, a critical) is handed back for the blow; everything else
 *  happens now and says so. What nobody spends stays on the roll for the story. */
function spendSymbols(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  symbols: Readonly<Record<string, number>>,
  hit: boolean,
  /** What a side that chose for itself (1.382) chose. The Engine picks for a side not here. */
  chosen: NonNullable<RulesetHeldAttack["roll"]["spends"]> = {},
): { damage: number; critical: boolean } {
  const out = { damage: 0, critical: false };
  const whom = (on: "attacker" | "target" | "attacker-ally" | "target-ally") =>
    rulesetSymbolSpendHolder(ctx.state, actor, target, on);
  const apply = (picks: RulesetSymbolSpendPick[], chooser: RulesetCombatant) => {
    for (const { spend, times } of picks) {
      const dice = spend.boost ?? spend.setback;
      const diceOn = dice ? whom(dice.on) : undefined;
      ctx.events.push({
        type: "symbol-spend",
        actorId: chooser.id,
        rollerId: actor.id,
        targetId: target.id,
        spendId: spend.id,
        label: spend.label,
        symbol: spend.symbol,
        cost: spend.cost,
        times,
        ...(diceOn ? { onId: diceOn.id } : {}),
        ...(spend.boost && diceOn ? { boost: spend.boost.dice * times } : {}),
        ...(spend.setback && diceOn ? { setback: spend.setback.dice * times } : {}),
        ...(spend.critical ? { critical: true as const } : {}),
      });
      if (spend.damage) out.damage += spend.damage * times;
      if (spend.critical) out.critical = true;
      for (const [rule, key] of [
        [spend.boost, "boost"],
        [spend.setback, "setback"],
      ] as const) {
        const on = rule ? whom(rule.on) : undefined;
        if (!rule || !on || on.defeated) continue;
        const waiting = (on.symbolDice ??= {});
        waiting[key] = (waiting[key] ?? 0) + rule.dice * times;
      }
      if (spend.condition) {
        const on = whom(spend.condition.on);
        if (on && !on.defeated) {
          applyConditionId(
            ctx,
            on,
            spend.condition.id,
            {
              condition: spend.condition.id,
              duration: spend.condition.rounds ? { rounds: spend.condition.rounds } : "instant",
            },
            { sourceId: chooser.id },
          );
        }
      }
      if (spend.track) {
        const on = whom(spend.track.on);
        if (on && !on.defeated) moveTrack(ctx, chooser, on, spend.track.id, spend.track.by * times);
      }
    }
  };
  // One budget for the throw, the attacker buying first: a spend that would not land, or whose room
  // an earlier one took, goes unbought, and its symbols stay on the roll. The forecast buys the same.
  const budget = rulesetSymbolSpendBudget(ctx.definition, ctx.state, actor, target);
  const pick = (by: "attacker" | "target") =>
    chosen[by]
      ? rulesetChosenSymbolSpends(ctx.combat, symbols, hit, by, chosen[by], budget)
      : pickRulesetSymbolSpends(ctx.combat, symbols, hit, by, budget);
  apply(pick("attacker"), actor);
  if (!target.defeated) apply(pick("target"), target);
  return out;
}

/** Which side of a symbol throw is asked what it buys (1.382), if either: one whose chooser picks
 *  their own spends, has not been asked about this throw yet, and has something to buy. The
 *  attacker is asked first, as their spends are bought first. Nobody is asked inside another window,
 *  where a throw cannot be held, or once the fight is over. */
function spendAsked(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  symbols: Readonly<Record<string, number>>,
  hit: boolean,
  chosen: NonNullable<RulesetHeldAttack["roll"]["spends"]>,
): "attacker" | "target" | undefined {
  const asking = ctx.state.askSpends;
  if (!asking?.length || (ctx.state.window && !ctx.nestHit) || hasFallingAnswer(ctx)) return undefined;
  if (rulesetEncounterOutcome(ctx.state) !== "ongoing") return undefined;
  const held: RulesetHeldAttack = {
    targetId: target.id,
    rest: [],
    roll: {
      mode: "normal",
      total: 0,
      defense: 0,
      critical: false,
      natural: false,
      symbols: { ...symbols },
      spends: chosen,
    },
    mine: [],
    hurt: [],
  };
  for (const [by, chooser] of [
    ["attacker", actor],
    ["target", target],
  ] as const) {
    if (chosen[by] || !asking.includes(chooser.id) || chooser.defeated) continue;
    const standing = rulesetSymbolSpendStanding(ctx.definition, ctx.state, held, actor.id, by, hit);
    if (standing && standing.choices.length > 0) return by;
  }
  return undefined;
}

/** What conditions add to one roll, each rolled now: a flat number as it is, dice thrown (and taken
 *  away where the modifier says `minus`). */
function rollBonuses(ctx: RulesetCombatContext, modifiers: RulesetConditionModifier[]): RulesetConditionBonus[] {
  return modifiers.map(({ condition, level, derived, item, modifier }) => {
    let value = modifier.flat ?? 0;
    const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
    const rolls = dice ? rollRulesetDice(ctx.roll, dice.count, dice.sides) : undefined;
    if (dice && rolls) value += (modifier.minus ? -1 : 1) * (sumOf(rolls) + dice.flat);
    return {
      condition,
      ...(level !== undefined ? { level } : {}),
      ...(derived ? { derived } : {}),
      ...(item ? { item } : {}),
      value,
      ...(rolls ? { rolls } : {}),
    };
  });
}

/** The most a change could add: its flat part and every die at its highest. */
function rescueMost(modifier: RulesetConditionModifier["modifier"]): number {
  const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
  return (modifier.flat ?? 0) + (dice ? dice.count * dice.sides + dice.flat : 0);
}

/** A change held back until a roll fell `short` (1.249): the first whose most could make up the
 *  difference, rolled and added, and the condition it came from spent. Nothing when none could:
 *  nobody spends an inspiration die that cannot turn the roll. */
function rescueBonuses(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  roll: "attacks" | "saves" | "checks",
  rescues: RulesetConditionModifier[],
  short: number,
  /** The save it is, for an entry narrowed to some (1.257). */
  save?: string,
): RulesetConditionBonus[] {
  if (short <= 0) return [];
  const rescue = rescues.find(({ modifier }) => rescueMost(modifier) >= short);
  if (!rescue) {
    // None given them, a die of their own from one of their entries (1.256): Peerless Skill, Dark
    // One's Own Luck. Only one whose most could make up the difference is spent.
    const own = rescueEntry(
      ctx,
      combatant,
      roll,
      "die",
      (action) => {
        const amount = action.rescue?.amount;
        return !!amount && amount.count * amount.sides + amount.flat >= short;
      },
      save,
    );
    const amount = own?.rescue?.amount;
    if (!own || !amount) return [];
    const rolls = rollRulesetDice(ctx.roll, amount.count, amount.sides);
    return [{ condition: own.label, entry: true, value: sumOf(rolls) + amount.flat, rolls, rescue: true }];
  }
  const bonuses = rollBonuses(ctx, [rescue]).map((bonus) => ({ ...bonus, rescue: true as const }));
  // A level's or an item's stays: only a condition put on the holder is spent.
  if (rescue.level === undefined && !rescue.item && !rescue.derived) {
    if (combatant.tracked.some((entry) => entry.condition === rescue.condition)) {
      removeCondition(ctx, combatant, rescue.condition, "spent");
    }
  }
  return bonuses;
}

/** How many uses heal this target fully, at what one use heals on average, never more than `most`
 *  and never fewer than one (1.251). */
function chosenUsesToFill(
  ctx: RulesetCombatContext,
  action: RulesetCombatAction,
  target: RulesetCombatant | undefined,
  most: number,
): number {
  const heal = action.heal;
  if (!heal || !target) return Math.min(1, most);
  const health = healthOf(ctx, target);
  const missing = Math.max(0, health.max - health.value);
  const each = Math.max(1, (heal.count * (heal.sides + 1)) / 2 + heal.flat);
  return Math.max(1, Math.min(most, Math.ceil(missing / each)));
}

/** What its holder spends when their own roll of this kind has failed (1.249): the first such entry
 *  still to be had and paid for, paid for now. None when they hold none left. */
function rescueEntry(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  roll: "attacks" | "saves" | "checks",
  by?: RulesetCombatRescue["by"],
  /** Only one this would be worth spending (1.256). */
  worth?: (action: RulesetCombatAction) => boolean,
  /** The save it is, for an entry narrowed to some (1.257). */
  save?: string,
): RulesetCombatAction | undefined {
  const found = holder.actions.find(
    (action) =>
      action.rescue?.roll === roll &&
      // Asked for no kind, it is one that settles the roll by itself: a die only adds (1.256), and a
      // d20 counted as 20 only where it would do (1.256).
      (by === undefined ? action.rescue.by === "reroll" || action.rescue.by === "success" : action.rescue.by === by) &&
      // Only the saves it names (1.257): a ring of evasion's Dexterity saves.
      (!action.rescue.saves || (save !== undefined && action.rescue.saves.includes(save))) &&
      // With the budget it takes still to be had (1.257): a ring of evasion's reaction.
      (!action.rescue.budget || canSpendAnswer(ctx, holder, action.rescue.budget)) &&
      (!worth || worth(action)) &&
      rulesetActionAvailable(holder, action, ctx.state, ctx.definition) &&
      !!planRulesetCombatCost(ctx.definition, holder, action),
  );
  if (!found) return undefined;
  payAnswer(ctx, holder, found, found.rescue!.budget);
  ctx.events.push({
    type: "rescued",
    actorId: holder.id,
    optionId: found.id,
    label: found.label,
    by: found.rescue!.by,
  });
  return found;
}

/** Whether a holder may spend `budget` on something they answer with off their turn (1.257): one
 *  left, and nothing holding them from acting or answering. */
function canSpendAnswer(ctx: RulesetCombatContext, holder: RulesetCombatant, budget: string): boolean {
  if ((holder.budgets[budget] ?? 0) < 1) return false;
  const effects = rulesetCombatEffects(ctx.definition, ctx.combat, holder, ctx.state);
  return !effects.has("cannot-act") && !effects.has("cannot-react");
}

/** What an entry spent as an answer costs: its price, its uses, and its budget where it takes one. */
function payAnswer(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  action: RulesetCombatAction,
  budget?: string,
): void {
  const paid = planRulesetCombatCost(ctx.definition, holder, action)!;
  if (paid.live && holder.sheet) holder.sheet.live = paid.live;
  countRulesetSpend(holder, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: holder.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  if (budget !== undefined) spendBudget(ctx, holder, budget);
  spendAvailability(ctx, holder, action);
}

/**
 * Dice off an ability check or a damage roll somebody else has just made (1.257): Cutting Words.
 * Spent by the first on the other side holding an answer that takes them and reaches the roller,
 * with its budget, uses and price to be had, where `worth` says its most could turn the roll: a
 * check that would succeed, or damage that would take one of its user's side down. How much it took
 * off, or nothing.
 */
function lowerRoll(
  ctx: RulesetCombatContext,
  roller: RulesetCombatant,
  roll: "checks" | "damage",
  to: string,
  total: number,
  worth: (most: number, holder: RulesetCombatant) => boolean,
): number {
  // A pool has no single number to take dice off, nor has a symbol throw.
  if (rulesetCombatIsPool(ctx.combat) || rulesetCombatIsSymbol(ctx.combat)) return 0;
  for (const holder of ctx.state.combatants) {
    if (holder.side === roller.side || !rulesetCombatStanding(holder)) continue;
    const action = holder.actions.find((one) => {
      const lowers = one.lowersRoll;
      return (
        !!lowers?.also?.includes(roll) &&
        worth(lowers.count * lowers.sides + lowers.flat, holder) &&
        (one.free || canSpendAnswer(ctx, holder, one.budget)) &&
        rulesetActionAvailable(holder, one, ctx.state, ctx.definition) &&
        !!planRulesetCombatCost(ctx.definition, holder, one) &&
        rulesetOptionTargets(ctx.definition, ctx.state, holder.id, one).includes(roller.id)
      );
    });
    if (!action) continue;
    payAnswer(ctx, holder, action, action.free ? undefined : action.budget);
    const lowers = action.lowersRoll!;
    const rolls = rollRulesetDice(ctx.roll, lowers.count, lowers.sides);
    const by = sumOf(rolls) + lowers.flat;
    ctx.events.push({
      type: "lowered",
      actorId: holder.id,
      targetId: roller.id,
      label: action.label,
      to,
      roll,
      rolls,
      by,
      total: total - by,
    });
    return by;
  }
  return 0;
}

function bonusTotal(bonuses: readonly RulesetConditionBonus[]): number {
  return bonuses.reduce((total, bonus) => total + bonus.value, 0);
}

/** Conditions that last one use, taken off once it has happened to their holder. */
function spendConditions(ctx: RulesetCombatContext, combatant: RulesetCombatant, ending: RulesetConditionEnding): void {
  spendOneUse(ctx, combatant, oneUseConditions(combatant, ending));
}

function oneUseConditions(combatant: RulesetCombatant, ending: RulesetConditionEnding): RulesetTrackedCondition[] {
  return combatant.tracked.filter((entry) => entry.endsAfter === ending);
}

/** Takes off exactly these, if they are still on. One the same blow put on afresh is a new one, not
 *  the one that was used, so it stays. */
function spendOneUse(ctx: RulesetCombatContext, combatant: RulesetCombatant, used: RulesetTrackedCondition[]): void {
  for (const entry of used) {
    if (combatant.tracked.includes(entry)) removeCondition(ctx, combatant, entry.condition, "spent");
  }
}

// ── Conditions ──

function applyConditionId(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  applies: RulesetCombatApplies,
  extra: {
    sourceId?: string;
    difficulty?: number;
    concentration?: boolean;
    action?: readonly string[];
    /** What it harms with on top of the condition's own (1.255). */
    harmsMore?: RulesetCombatAmount;
    /** The number its applier gave it (1.274). */
    value?: number;
    /** The level of the spell that put it on (1.299). */
    level?: number;
    /** The steps above its base cost that spell was paid at (1.300). */
    steps?: number;
  } = {},
): void {
  const putter = extra.sourceId ? rulesetCombatant(ctx.state, extra.sourceId) : undefined;
  if (
    rulesetImmuneToCondition(target, condition, ctx.definition, ctx.state, putter) ||
    // Nothing reaches through a sphere (1.314): a zone's, or a harm's.
    (!!putter && rulesetSealedApart(ctx.definition, ctx.state, putter, target))
  ) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "immune" });
    return;
  }
  // One of its kind at a time (1.256): a second Bardic Inspiration die does not go on.
  const group = ctx.combat.conditions?.find((one) => one.condition === condition)?.oneAtATime;
  if (
    group !== undefined &&
    target.tracked.some(
      (entry) => ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.oneAtATime === group,
    )
  ) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "already" });
    return;
  }
  // Its source holding as many with it as it may (1.320): the Owed's Grasps, two at most.
  if (
    applies.heldAtMost !== undefined &&
    extra.sourceId &&
    ctx.state.combatants.filter(
      (other) =>
        other.id !== target.id &&
        !other.defeated &&
        other.tracked.some((entry) => entry.condition === condition && entry.source === extra.sourceId),
    ).length >= applies.heldAtMost
  ) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "full" });
    return;
  }
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: true });
  const rounds = typeof applies.duration === "object" ? applies.duration.rounds : null;
  const clock = typeof applies.duration === "object" ? applies.duration.at : undefined;
  // On its source's clock (1.119), counted from their NEXT turn: put on in the middle of their own
  // turn, the end of this one is not "the end of your next turn".
  const sourced = typeof applies.duration === "object" && applies.duration.of === "source" && !!extra.sourceId;
  const source = sourced ? rulesetCombatant(ctx.state, extra.sourceId!) : undefined;
  const startsNext = !!source && !clock && rulesetOnOwnTurn(ctx.state, source) && ctx.ticking !== source.id;
  const rule = ctx.combat.conditions?.find((one) => one.condition === condition);
  // One holder at a time from one source (1.189): an oathbow's sworn enemy leaves the last one.
  if (rule?.onePerSource && extra.sourceId) {
    for (const other of ctx.state.combatants) {
      if (other.id === target.id || !rulesetMarkedBy(other, condition, extra.sourceId)) continue;
      removeCondition(ctx, other, condition, "moved");
    }
  }
  // Put on again while it holds, one that stacks counts one more (1.189), up to its most.
  const before = target.tracked.find((entry) => entry.condition === condition);
  const stacks = rule?.stacks && before ? Math.min(rule.stacks, (before.stacks ?? 1) + 1) : undefined;
  target.tracked = target.tracked.filter((entry) => entry.condition !== condition);
  target.tracked.push({
    condition,
    rounds: rounds !== null && startsNext ? rounds + 1 : rounds,
    ...(clock ? { clock } : {}),
    ...(applies.duration === "this-action" ? { thisAction: true as const } : {}),
    ...(sourced ? { clockOf: "source" as const } : {}),
    // Or until its putter's lair count (1.327).
    ...(typeof applies.duration === "object" && applies.duration.untilLair && extra.sourceId
      ? { untilLair: true as const }
      : {}),
    ...(applies.endsAfter ? { endsAfter: applies.endsAfter } : {}),
    ...(applies.endsWhenHolder
      ? {
          endsWhenHolder: {
            ...(applies.endsWhenHolder.attacks ? { attacks: true as const } : {}),
            ...(applies.endsWhenHolder.casts ? { casts: [...applies.endsWhenHolder.casts] } : {}),
            ...(applies.endsWhenHolder.moves ? { moves: true as const } : {}),
            ...(applies.endsWhenHolder.acts ? { acts: true as const } : {}),
            ...(applies.endsWhenHolder.uses ? { uses: [...applies.endsWhenHolder.uses] } : {}),
          },
        }
      : {}),
    ...(applies.endsAway ? { endsAway: { ...applies.endsAway } } : {}),
    ...(applies.checkEnds ? { checkEnds: structuredClone(applies.checkEnds) } : {}),
    ...(applies.saveEnds ? { saveEnds: applies.saveEnds } : {}),
    ...(applies.kind ? { kind: applies.kind } : {}),
    ...(extra.difficulty !== undefined ? { difficulty: extra.difficulty } : {}),
    ...(extra.sourceId ? { source: extra.sourceId } : {}),
    ...(extra.action ? { action: [...extra.action] } : {}),
    ...(extra.concentration ? { concentration: true } : {}),
    // The applier's own save difficulty where it said "save" (1.174); with none, the holder's side
    // of the contest is rolled as usual.
    ...(typeof applies.escapeDc === "number"
      ? { escapeDc: applies.escapeDc }
      : applies.escapeDc === "save" && extra.difficulty !== undefined
        ? { escapeDc: extra.difficulty }
        : {}),
    // The checks that break it go with the number they are rolled against (1.175).
    ...(applies.escapeChecks &&
    (typeof applies.escapeDc === "number" || (applies.escapeDc === "save" && extra.difficulty !== undefined))
      ? { escapeChecks: [...applies.escapeChecks] }
      : {}),
    ...(stacks !== undefined ? { stacks } : {}),
    ...(applies.endsWith ? { endsWith: applies.endsWith } : {}),
    ...(extra.harmsMore ? { harmsMore: { ...extra.harmsMore } } : {}),
    ...(extra.value !== undefined ? { value: extra.value } : {}),
    ...(extra.level !== undefined ? { level: extra.level } : {}),
    ...(extra.steps !== undefined ? { steps: extra.steps } : {}),
  });
  ctx.events.push(
    stacks !== undefined
      ? { type: "condition", targetId: target.id, condition, active: true, reason: "stacked", stacks }
      : { type: "condition", targetId: target.id, condition, active: true, reason: "applied" },
  );
  endImmuneConditions(ctx, target);
  groundFlier(ctx, target);
  // What it makes its holder let fall at once (1.266): Fear.
  if (rule?.behavior?.drops?.at === "applied") letFall(ctx, target, condition, rule.behavior.drops);
  // Put on during its holder's own turn, a condition that takes budgets away takes them from this
  // turn too (1.179): 5e's Stinking Cloud, failed as the turn begins or walked into later. The turn
  // after is read afresh from the conditions as they stand then.
  if (rulesetOnOwnTurn(ctx.state, target)) {
    const entry = ctx.combat.conditions?.find((one) => one.condition === condition);
    for (const change of entry?.budgets ?? []) {
      if (change.flat >= 0 || target.budgets[change.budget] === undefined) continue;
      target.budgets[change.budget] = Math.max(0, target.budgets[change.budget]! + change.flat);
    }
  }
}

/** What a condition makes its holder let fall (1.266): it lies where they stand. */
function letFall(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  condition: string,
  drops: RulesetBehaviorDrops,
): void {
  const things = rulesetThingsToDrop(holder, drops);
  if (!things.length) return;
  holder.dropped = [...(holder.dropped ?? []), ...things];
  ctx.events.push({ type: "letFall", actorId: holder.id, condition, labels: things.map((thing) => thing.label) });
}

/** A newly gained immunity ends a condition already on its holder (Capability API 1.132). */
function endImmuneConditions(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  // One its holder's own condition holds off is suspended, not cured (1.278): a fright already on
  // when a rage that is immune to it begins comes back when the rage ends.
  const held = new Set(
    rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).flatMap((entry) => entry.suppresses ?? []),
  );
  const ended = rulesetCombatConditions(ctx.definition, target).filter(
    (condition) => !held.has(condition) && rulesetImmuneToCondition(target, condition, ctx.definition, ctx.state),
  );
  for (const condition of ended) {
    if (rulesetCombatConditions(ctx.definition, target).includes(condition))
      removeCondition(ctx, target, condition, "immune");
  }
}

/**
 * One of a budget spent, said out loud. Two budgets a condition makes exclusive (combat C6d, as Slow
 * makes the action and the bonus action) are one choice a turn: spending either empties the other.
 */
function spendBudget(ctx: RulesetCombatContext, combatant: RulesetCombatant, budget: string): void {
  combatant.budgets[budget] = Math.max(0, (combatant.budgets[budget] ?? 0) - 1);
  ctx.events.push({ type: "budget", actorId: combatant.id, budget, left: combatant.budgets[budget]! });
  for (const [one, two] of rulesetConditionEconomy(ctx.definition, ctx.combat, combatant, ctx.state).exclusive) {
    const other = one === budget ? two : two === budget ? one : undefined;
    if (other === undefined || (combatant.budgets[other] ?? 0) < 1) continue;
    combatant.budgets[other] = 0;
    ctx.events.push({ type: "budget", actorId: combatant.id, budget: other, left: 0 });
  }
}

/** An attack made on the attacker's own turn, which is the only place a cap on attacks a turn (as
 *  Slow's "during its turn") counts it. A reaction on somebody else's turn is not counted. */
function countAttack(ctx: RulesetCombatContext, combatant: RulesetCombatant): void {
  if (!rulesetOnOwnTurn(ctx.state, combatant)) return;
  combatant.flags.attacks = (combatant.flags.attacks ?? 0) + 1;
}

/** Whether a condition's cap on attacks a turn has been reached (combat C6d). */
function attacksCapped(ctx: RulesetCombatContext, combatant: RulesetCombatant): boolean {
  if (!rulesetOnOwnTurn(ctx.state, combatant)) return false;
  const cap = rulesetConditionEconomy(ctx.definition, ctx.combat, combatant, ctx.state).attacksPerTurn;
  return cap !== undefined && (combatant.flags.attacks ?? 0) >= cap;
}

function removeCondition(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  reason:
    | "save"
    | "expired"
    | "damage"
    | "concentration"
    | "revived"
    | "contest"
    | "spent"
    | "recovered"
    | "harmed"
    | "shaken"
    | "immune"
    | "cured"
    | "moved"
    | "linked"
    | "worsened"
    | "dispelled",
): void {
  if (target.dazed?.condition === condition) return;
  const removed = target.tracked.find((entry) => entry.condition === condition);
  // Already gone, with what it was put on with (1.202): a loop over a list read before that is not
  // told twice.
  if (!removed && !rulesetCombatConditions(ctx.definition, target).includes(condition)) return;
  target.tracked = target.tracked.filter((entry) => entry.condition !== condition);
  // Out of the sphere, nobody is carrying them (1.314).
  if (target.carriedBy && !rulesetSealed(ctx.definition, target, ctx.state)) delete target.carriedBy;
  // What an aura put on, ended, keeps that aura off them where it says so (1.269).
  if (removed?.auraSafeOnEnd && !target.auraSafe?.includes(removed.auraSafeOnEnd)) {
    target.auraSafe = [...(target.auraSafe ?? []), removed.auraSafeOnEnd];
  }
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: false });
  ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason });
  // What is left of the temporary points it gave is lost with it (1.274): Heroism's. Points the
  // holder has more of than it gave came from something else, and stay.
  const temporary = ctx.combat.conditions?.find((one) => one.condition === condition)?.temporary;
  if (temporary?.lostWhenEnds && removed?.gaveTemp && !("track" in ctx.combat.health)) {
    const left = healthOf(ctx, target).temp;
    if (left > 0 && left <= removed.gaveTemp) {
      if (target.sheet)
        writeRulesetSheet(ctx.definition, target, { op: "temp", pool: ctx.combat.health.pool, amount: 0 });
      else if (target.health) target.health.temp = 0;
      ctx.events.push({ type: "temporary", targetId: target.id, rolls: [], flat: 0, amount: left, lost: true });
    }
  }
  // Away only while it held this (1.236), it comes back, or stays gone.
  if (target.away?.while === condition && (!removed || removed.source === target.away.by)) {
    bringBack(ctx, target, reason);
  }
  // What was put on with it to last only as long as it ends with it (1.202): put on by the same
  // source with the same use, whatever took this one off.
  const sameUse = (entry: RulesetTrackedCondition) =>
    !removed ||
    (entry.source === removed.source && (entry.action ?? []).join("\n") === (removed.action ?? []).join("\n"));
  for (const entry of [...target.tracked]) {
    if (entry.endsWith !== condition || !sameUse(entry)) continue;
    if (target.tracked.includes(entry)) removeCondition(ctx, target, entry.condition, "linked");
  }
  // Run out on its clock, it turns into what it `expires` into (1.261): an onset run its course.
  const expires = ctx.combat.conditions?.find((entry) => entry.condition === condition)?.expires;
  if (reason === "expired" && expires && !target.defeated) {
    applyConditionId(
      ctx,
      target,
      expires.becomes,
      { condition: expires.becomes, duration: "instant" },
      removed?.source ? { sourceId: removed.source } : {},
    );
  }
  // What it leaves behind when it ends (combat C6d), as Haste's lethargy is. Putting it on again
  // replaces it without ending it, so that never comes here.
  const ending = ctx.combat.conditions?.find((entry) => entry.condition === condition)?.onEnd;
  // Its tracks moved as it ends (1.239), by nobody else's doing: Frenzy's exhaustion.
  if (ending?.tracks && !target.defeated) {
    for (const moved of ending.tracks) moveTrack(ctx, target, target, moved.track, moved.by);
  }
  // What it deals as it ends (1.245), from whoever put it on, to a holder it does not spare.
  if (
    ending?.harm &&
    !target.defeated &&
    !(ending.harm.unless && rulesetTargetIs(ctx.definition, target, ending.harm.unless))
  ) {
    conditionHarm(ctx, target, condition, removed?.source, ending.harm, 1);
  }
  if (ending?.applies && !target.defeated) {
    // Ended in the middle of its holder's own turn (their own concentration broken, say), the clock
    // starts with the NEXT turn: "until after its next turn" is never the rest of this one. Ended as
    // a turn begins or ends, the next turn to count is already the right one.
    const midTurn = rulesetOnOwnTurn(ctx.state, target) && ctx.ticking !== target.id;
    for (const applied of ending.applies) {
      applyConditionId(ctx, target, applied.condition, applied);
      const left = target.tracked.find((entry) => entry.condition === applied.condition);
      if (midTurn && left && left.rounds !== null && !left.clock) left.rounds += 1;
    }
  }
}

/** Damage ends or tests a condition now; source-side harm waits until the whole step lands (1.125).
 *  Keep the tracked instance, so a condition applied by this very action is not ended in its place. */
function endConditionsOnHarm(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  sourceId: string | undefined,
  dealt = 0,
  harmful = false,
  damageSaves?: Set<RulesetTrackedCondition>,
  /** An attack roll is about to be made at them (1.278). */
  attacked = false,
): () => void {
  const endings: RulesetTrackedCondition[] = [];
  // Harmed by what was cast out of a catalog (1.278), but not by a casting that puts the very same
  // condition on again: that one is refreshed, not ended.
  const harmFrom = (dealt > 0 || harmful) && ctx.harming ? ctx.harming : undefined;
  const actor = rulesetCombatant(ctx.state, sourceId ?? "");
  const brought: Array<{ applied: RulesetCombatApplies; source?: string }> = [];
  for (const condition of rulesetCombatConditions(ctx.definition, target)) {
    const rule = ctx.combat.conditions?.find((entry) => entry.condition === condition);
    const tracked = target.tracked.find((entry) => entry.condition === condition);
    // What taking damage brings on while it holds (1.261): Slimy Doom's stun.
    if (dealt > 0 && rule?.onDamaged) {
      for (const applied of rule.onDamaged.applies) {
        brought.push({
          applied: applied as RulesetCombatApplies,
          ...(tracked?.source ? { source: tracked.source } : {}),
        });
      }
    }
    if (dealt > 0 && rule?.endsWhen?.includes("damaged")) {
      removeCondition(ctx, target, condition, "damage");
      continue;
    }
    const onDamage = tracked?.saveEnds?.at === "damaged";
    if (
      dealt > 0 &&
      (onDamage || rule?.saveWhenDamaged) &&
      tracked?.saveEnds &&
      tracked.difficulty !== undefined &&
      !(onDamage && damageSaves?.has(tracked)) &&
      // Only on harm from whoever put it on, where it says so (1.274): Sympathy's.
      !(onDamage && tracked.saveEnds.bySource && sourceId !== tracked.source) &&
      saveOutOfSight(ctx, target, tracked)
    ) {
      if (onDamage) damageSaves?.add(tracked);
      const saved = rollSave(
        ctx,
        target,
        tracked.saveEnds.save,
        tracked.difficulty,
        tracked.source,
        undefined,
        { conditions: [condition], ...(tracked.action ? { action: tracked.action } : {}) },
        leanInSight(ctx, target, tracked),
      );
      if (savedAgainst(ctx, target, tracked, saved)) continue;
    }
    if (!tracked) continue;
    if (
      (attacked && rule?.endsWhen?.includes("attacked")) ||
      (harmFrom && rule?.endsWhenHarmedFrom?.includes(harmFrom.catalog) && !harmFrom.applies.includes(condition))
    ) {
      endings.push(tracked);
      continue;
    }
    if (!(dealt > 0 || harmful) || !rule?.endsWhen?.includes("harmed-by-source-side") || !actor) continue;
    const source = rulesetCombatant(ctx.state, tracked.source ?? "");
    if (source && source.side === actor.side) endings.push(tracked);
  }
  // Seen happening to a friend (1.278): damage to one of their own side they see.
  const witnessed: Array<{ holder: RulesetCombatant; entry: RulesetTrackedCondition }> = [];
  if (dealt > 0) {
    for (const holder of ctx.state.combatants) {
      if (holder.id === target.id || holder.side !== target.side || holder.defeated) continue;
      for (const condition of rulesetCombatConditions(ctx.definition, holder)) {
        const rule = ctx.combat.conditions?.find((entry) => entry.condition === condition);
        const entry = holder.tracked.find((one) => one.condition === condition);
        if (
          entry &&
          rule?.endsWhen?.includes("ally-harmed-in-sight") &&
          rulesetCanSee(ctx.definition, ctx.state, holder, target)
        ) {
          witnessed.push({ holder, entry });
        }
      }
    }
  }
  if (brought.length > 0) {
    // Taken in the middle of their own turn, "until the end of its next turn" is the next one.
    const midTurn = rulesetOnOwnTurn(ctx.state, target) && ctx.ticking !== target.id;
    for (const { applied, source } of brought) {
      applyConditionId(ctx, target, applied.condition, applied, source ? { sourceId: source } : {});
      const left = target.tracked.find((entry) => entry.condition === applied.condition);
      if (midTurn && left && left.rounds !== null && !left.clock) left.rounds += 1;
    }
  }
  return () => {
    for (const entry of endings) {
      if (target.tracked.includes(entry)) removeCondition(ctx, target, entry.condition, "harmed");
    }
    for (const { holder, entry } of witnessed) {
      if (holder.tracked.includes(entry)) removeCondition(ctx, holder, entry.condition, "harmed");
    }
  };
}

/** Conditions the ruleset says any damage ends. */
function endConditionsOnDamage(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const ending = new Set(
    (ctx.combat.conditions ?? [])
      .filter((entry) => entry.effects.includes("ends-on-damage"))
      .map((entry) => entry.condition),
  );
  if (ending.size === 0) return;
  for (const condition of rulesetCombatConditions(ctx.definition, target)) {
    if (ending.has(condition)) removeCondition(ctx, target, condition, "damage");
  }
}

/** The saves that repeat, and the clocks that run out. Both belong to the affected combatant's own
 *  turn, so a condition lasts the same time whoever put it on. */
function tickConditions(ctx: RulesetCombatContext, actor: RulesetCombatant, at: "turn-start" | "turn-end"): void {
  ctx.ticking = actor.id;
  try {
    tickConditionsNow(ctx, actor, at);
  } finally {
    delete ctx.ticking;
  }
}

/** Whether a condition's rounds are counted on somebody else's turns (1.119): its source's, while they
 *  are still in the fight. One whose source has gone counts on its holder's turns again. */
function ticksOnSource(ctx: RulesetCombatContext, holder: RulesetCombatant, entry: RulesetTrackedCondition): boolean {
  if (entry.clockOf !== "source" || entry.source === undefined || entry.source === holder.id) return false;
  const source = rulesetCombatant(ctx.state, entry.source);
  return !!source && !source.defeated;
}

function tickConditionsNow(ctx: RulesetCombatContext, actor: RulesetCombatant, at: "turn-start" | "turn-end"): void {
  // What this one put on others that runs on their turns.
  for (const holder of ctx.state.combatants) {
    if (holder.id === actor.id) continue;
    for (const entry of [...holder.tracked]) {
      if (entry.source !== actor.id || !ticksOnSource(ctx, holder, entry)) continue;
      if (entry.rounds === null || at !== (entry.clock ?? "turn-end")) continue;
      entry.rounds -= 1;
      if (entry.rounds <= 0) removeCondition(ctx, holder, entry.condition, "expired");
    }
  }
  for (const entry of [...actor.tracked]) {
    // What it harms its holder with now (1.189), once for each time it is on, before the save that
    // may end it: a sword of wounding's wounds.
    harmFromCondition(ctx, actor, entry, at);
    // What it gives its holder now (1.274): Heroism's temporary points.
    temporaryFromCondition(ctx, actor, entry, at);
    // Killed by it, nothing more is rolled; ended by it (a hurt that breaks a spell), it is gone.
    if (actor.defeated) return;
    if (!actor.tracked.includes(entry)) continue;
    // A save with nothing to be rolled against is not rolled: the condition runs on its clock.
    if (entry.saveEnds?.at === at && entry.difficulty !== undefined && saveOutOfSight(ctx, actor, entry)) {
      const saved = rollSave(
        ctx,
        actor,
        entry.saveEnds.save,
        entry.difficulty,
        entry.source,
        undefined,
        // Still a save against the action that put it on (1.191).
        { conditions: [entry.condition], ...(entry.action ? { action: entry.action } : {}) },
        leanInSight(ctx, actor, entry),
      );
      if (savedAgainst(ctx, actor, entry, saved)) continue;
    }
    // A clock counts the holder's turns down as each one ends, or, where it says so, as each begins.
    if (entry.rounds === null || at !== (entry.clock ?? "turn-end") || ticksOnSource(ctx, actor, entry)) continue;
    entry.rounds -= 1;
    if (entry.rounds <= 0) removeCondition(ctx, actor, entry.condition, "expired");
  }
}

/** What comes off its holder by being far enough from whoever put it on, and out of their sight
 *  where it says so (1.310): Eyebite's panic. Anybody's walk may part them, the putter's own too. */
function endsAway(ctx: RulesetCombatContext): void {
  const perCell = ctx.definition.combat?.distance?.perCell;
  if (!ctx.state.board?.grid || perCell === undefined) return;
  for (const holder of ctx.state.combatants) {
    for (const entry of holder.tracked.filter((one) => one.endsAway && one.source)) {
      const source = rulesetCombatant(ctx.state, entry.source!);
      if (source && rulesetGap(holder, source) <= rulesetInCells(entry.endsAway!.beyond, perCell)) continue;
      if (source && entry.endsAway!.unseen && rulesetCanSee(ctx.definition, ctx.state, holder, source)) continue;
      if (holder.tracked.includes(entry)) removeCondition(ctx, holder, entry.condition, "spent");
    }
  }
}

/** Whether a save that ends a condition may be rolled now: one rolled only out of its putter's
 *  sight waits while its holder can see them (1.266), Fear's. */
function saveOutOfSight(ctx: RulesetCombatContext, holder: RulesetCombatant, entry: RulesetTrackedCondition): boolean {
  const ends = entry.saveEnds;
  if (!ends?.unseen && ends?.beyond === undefined) return true;
  const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
  if (!source || !rulesetCombatStanding(source)) return true;
  if (ends.unseen && rulesetCanSee(ctx.definition, ctx.state, holder, source)) return false;
  // Only farther off than it says (1.270): Antipathy's "more than 60 feet away".
  const perCell = ctx.definition.combat?.distance?.perCell;
  if (ends.beyond !== undefined && ctx.state.board?.grid && perCell !== undefined) {
    if (rulesetGap(holder, source) <= rulesetInCells(ends.beyond, perCell)) return false;
  }
  return true;
}

/** The lean a save that ends a condition is rolled with while its holder can see whoever put it on
 *  (1.268): a sea hag's Horrific Appearance, with disadvantage while she is in sight. */
function leanInSight(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetTrackedCondition,
): "advantage" | "disadvantage" | undefined {
  const lean = entry.saveEnds?.seenLean;
  if (!lean) return undefined;
  const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
  if (!source || !rulesetCombatStanding(source)) return undefined;
  return rulesetCanSee(ctx.definition, ctx.state, holder, source) ? lean : undefined;
}

/**
 * One save made against a condition that a save ends. A success ends it, or counts towards the
 * `successes` it takes (1.258); a failure counts towards `failures`, which puts on what it `becomes`
 * in its place, with no clock, once there are enough (Contagion's disease). Whether it is gone.
 */
function savedAgainst(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetTrackedCondition,
  success: boolean,
): boolean {
  const ends = entry.saveEnds!;
  if (success) {
    entry.passes = (entry.passes ?? 0) + 1;
    if (ends.successes !== undefined && entry.passes < ends.successes) return false;
    removeCondition(ctx, holder, entry.condition, "save");
    return true;
  }
  if (!ends.failures) return false;
  entry.fails = (entry.fails ?? 0) + 1;
  if (entry.fails < ends.failures.count) return false;
  removeCondition(ctx, holder, entry.condition, "worsened");
  applyConditionId(
    ctx,
    holder,
    ends.failures.becomes,
    { condition: ends.failures.becomes, duration: "instant" },
    entry.source ? { sourceId: entry.source } : {},
  );
  return true;
}

/** The most turns a counted save is rolled out over once a fight is over: one that ends only on
 *  successes, from somebody who keeps failing, would otherwise never stop. */
const COUNTED_SAVES_AFTER_FIGHT_MAX = 50;

/**
 * Counted saves still to make as the fight ends (1.260). The holder's turns go on after it, so
 * what they count to is settled now, one turn's save at a time, as it would have been: Contagion
 * shaken off, or its disease set in. A save made only on damage waits for damage.
 */
function rollOutCountedSaves(ctx: RulesetCombatContext): void {
  for (const holder of ctx.state.combatants) {
    if (holder.defeated) continue;
    for (const entry of [...holder.tracked]) {
      const ends = entry.saveEnds;
      if (!ends || ends.at === "damaged" || entry.difficulty === undefined) continue;
      if (ends.successes === undefined && ends.failures === undefined) continue;
      for (let turn = 0; turn < COUNTED_SAVES_AFTER_FIGHT_MAX && holder.tracked.includes(entry); turn += 1) {
        const saved = rollSave(ctx, holder, ends.save, entry.difficulty, entry.source, undefined, {
          conditions: [entry.condition],
          ...(entry.action ? { action: entry.action } : {}),
        });
        if (savedAgainst(ctx, holder, entry, saved)) break;
      }
    }
  }
}

/** A condition's growth per step of a higher cost, over so many steps (1.255). */
function harmsPerSteps(per: { dice?: string; flat?: number }, steps: number): RulesetCombatAmount {
  const dice = per.dice ? parseRulesetCombatDice(per.dice) : null;
  return {
    count: (dice?.count ?? 0) * steps,
    sides: dice?.sides ?? 0,
    flat: ((dice?.flat ?? 0) + (per.flat ?? 0)) * steps,
  };
}

/** A condition's own temporary points as a turn starts or ends (1.274), with the value its applier
 *  gave it; remembered where they are what the holder now has, to be lost as it ends. */
function temporaryFromCondition(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetTrackedCondition,
  at: "turn-start" | "turn-end",
): void {
  const given = ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.temporary;
  if (!given || given.at !== at || holder.defeated || "track" in ctx.combat.health) return;
  const dice = given.dice ? parseRulesetCombatDice(given.dice) : null;
  const rolled = rollAmount(ctx, {
    count: dice?.count ?? 0,
    sides: dice?.sides ?? 0,
    flat: (dice?.flat ?? 0) + (given.flat ?? 0),
  });
  const amount = Math.max(0, rolled.total + (given.value ? (entry.value ?? 0) : 0));
  const before = healthOf(ctx, holder).temp;
  grantTemporary(ctx, holder, {
    ...(entry.source ? { sourceId: entry.source } : {}),
    rolls: rolled.rolls,
    flat: rolled.flat + (given.value ? (entry.value ?? 0) : 0),
    amount,
  });
  if (amount > before) entry.gaveTemp = amount;
}

/** A condition's own harm as a turn starts or ends (1.189), from whoever put it on. */
function harmFromCondition(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetTrackedCondition,
  at: "turn-start" | "turn-end",
): void {
  const harms = ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.harms;
  if (!harms || harms.at !== at || holder.defeated) return;
  conditionHarm(ctx, holder, entry.condition, entry.source, harms, entry.stacks ?? 1, entry.harmsMore);
}

/** What a condition deals its holder, from whoever put it on: as a turn starts or ends (1.189), or
 *  as it ends (1.245). */
function conditionHarm(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  condition: string,
  source: string | undefined,
  harms: { dice?: string; flat?: number; type?: string; healedOnlyByRest?: true },
  times: number,
  /** On top of its own, from the higher cost it was put on with (1.255), as many times over. */
  more?: RulesetCombatAmount,
): void {
  const dice = harms.dice ? parseRulesetCombatDice(harms.dice) : null;
  const amount = {
    count: (dice?.count ?? 0) * times,
    sides: dice?.sides ?? 0,
    flat: ((dice?.flat ?? 0) + (harms.flat ?? 0) + (more?.flat ?? 0)) * times,
  };
  // Dice of the same size are one throw; dice of another size are thrown beside them.
  const sameSides = !!more && (more.sides === amount.sides || amount.count === 0);
  if (more && sameSides) {
    amount.count += more.count * times;
    amount.sides = more.count > 0 ? more.sides : amount.sides;
  }
  const beside = more && !sameSides && more.count > 0 ? { count: more.count * times, sides: more.sides } : null;
  const harm = rulesetCombatIsPool(ctx.combat)
    ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
        // A pool throws a number of dice, whatever their size.
        throwHarm(ctx, holder, { ...amount, count: amount.count + (beside?.count ?? 0) }, harms.type, 0),
      )
    : (() => {
        const rolls = [
          ...rollRulesetDice(ctx.roll, amount.count, amount.sides),
          ...(beside ? rollRulesetDice(ctx.roll, beside.count, beside.sides) : []),
        ];
        return { rolls, flat: amount.flat, amount: sumOf(rolls) + amount.flat };
      })();
  const label = ctx.definition.sheet.live.conditions.find((one) => one.id === condition)?.label ?? condition;
  const dealt = applyDamage(ctx, holder, {
    ...(source ? { sourceId: source } : {}),
    label,
    ...(harms.type ? { damageType: harms.type } : {}),
    ...harm,
    ...(harms.healedOnlyByRest ? { seals: true as const } : {}),
  });
  afterBlow(ctx, holder, dealt, false);
}

/** A free cell beside the target, preferring the one nearest the weapon's previous cell. */
function summonCell(
  state: RulesetEncounterState,
  target: RulesetCombatant | undefined,
  from?: RulesetCombatCell,
): RulesetCombatCell | undefined {
  const at = rulesetPositionOf(target);
  const grid = state.board?.grid;
  if (!at || !grid) return at ?? undefined;
  const cells: RulesetCombatCell[] = [];
  // Around every cell they fill (1.194).
  const span = rulesetSpanOf(target);
  for (let y = at.y - 1; y <= at.y + span; y++) {
    for (let x = at.x - 1; x <= at.x + span; x++) {
      if (rulesetFills(target, { x, y }) || rulesetCellBlocked(grid, x, y)) continue;
      if (state.combatants.some((one) => !one.defeated && rulesetFills(one, { x, y }))) continue;
      cells.push({ x, y });
    }
  }
  if (from) cells.sort((a, b) => rulesetCellDistance(from, a) - rulesetCellDistance(from, b));
  return cells[0] ?? at;
}

/** Each ending is said once, including replacement and losing the concentration that holds it. */
function endSummons(ctx: RulesetCombatContext, actor: RulesetCombatant, actionId?: string): void {
  if (!actor.summons) return;
  actor.summons = actor.summons.filter((summon) => {
    if (actionId !== undefined && summon.actionId !== actionId) return true;
    ctx.events.push({ type: "summon", actorId: actor.id, label: summon.label, outcome: "ended" });
    return false;
  });
  if (actor.summons.length === 0) delete actor.summons;
}

/** Each ending of a zone is said once, as a summon's is (1.172). */
function endZones(ctx: RulesetCombatContext, actor: RulesetCombatant, actionId?: string): void {
  if (!actor.zones) return;
  const ended: RulesetCombatZone[] = [];
  actor.zones = actor.zones.filter((zone) => {
    if (actionId !== undefined && zone.actionId !== actionId) return true;
    ended.push(zone);
    return false;
  });
  if (actor.zones.length === 0) delete actor.zones;
  // Off the board before it goes off (1.183), so nothing its blast sets moving can end it twice.
  for (const zone of ended) {
    detonate(ctx, actor, zone);
    ctx.events.push({ type: "zone", actorId: actor.id, label: zone.label, outcome: "ended" });
  }
}

/** A zone that goes off as it ends (1.183): the entry's own effect, once, on everybody in it, with
 *  what it has grown by added to its amount. Its caster's, though they may be down by now. */
function detonate(ctx: RulesetCombatContext, caster: RulesetCombatant, zone: RulesetCombatZone): void {
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  const rule = action?.zone?.detonates;
  if (!action || !rule) return;
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "detonated" });
  const ids = ctx.state.board?.grid ? rulesetZoneOccupants(ctx.state, caster, zone, action) : (zone.held ?? []);
  const targets = ids
    .map((id) => rulesetCombatant(ctx.state, id))
    .filter((target): target is RulesetCombatant => !!target && rulesetCombatStanding(target));
  const { concentration: _held, zone: _zone, summons: _summons, gives: _gives, ...again } = action;
  const times = zone.grown ?? 0;
  if (rule.grows && times > 0 && again.damage) {
    again.damage = {
      ...again.damage,
      count: again.damage.count + rule.grows.count * times,
      flat: again.damage.flat + rule.grows.flat * times,
    };
  }
  const aimed = ctx.aimedAt;
  const aimedAlso = ctx.aimedAlso;
  delete ctx.aimedAlso;
  if (zone.at) ctx.aimedAt = { x: zone.at.x, y: zone.at.y };
  else delete ctx.aimedAt;
  const byZone = ctx.byZone;
  ctx.byZone = true;
  resolveAction(ctx, caster, again, targets, zone.payWith);
  if (byZone) ctx.byZone = byZone;
  else delete ctx.byZone;
  if (aimed) ctx.aimedAt = aimed;
  else delete ctx.aimedAt;
  if (aimedAlso) ctx.aimedAlso = aimedAlso;
  if (again.damage && ctx.state.board?.grid) {
    igniteZones(
      ctx,
      [again.damage.type, ...(again.damage.plus ?? []).map((clause) => clause.type)],
      rulesetZoneCells(ctx.state, caster, zone),
    );
  }
}

/** Every obscuring zone a wind reaches, where it is `dispersed`, blown away (1.286): 5e's Gust of
 *  Wind on a Fog Cloud, as the gust appears, moves or turns, and as anybody carrying either moves.
 *  One dispersed only `after` a while (1.289) goes once a wind has reached it that many whole
 *  rounds running: 5e's Stinking Cloud. */
function disperseFogs(ctx: RulesetCombatContext): void {
  if (!ctx.state.board?.grid) return;
  const winds = rulesetStandingZones(ctx.state).filter(({ action }) => action.zone?.disperses);
  const blown = new Set(
    winds.flatMap(({ caster, zone }) => rulesetZoneCells(ctx.state, caster, zone).map((cell) => `${cell.x},${cell.y}`)),
  );
  const now = turnStamp(ctx);
  for (const caster of ctx.state.combatants) {
    for (const zone of [...(caster.zones ?? [])]) {
      const rule = zone.obscures ?? caster.actions.find((entry) => entry.id === zone.actionId)?.zone?.obscures;
      if (!rule?.dispersed || !caster.zones?.includes(zone) || winds.some((wind) => wind.zone === zone)) continue;
      if (!rulesetZoneCells(ctx.state, caster, zone).some((cell) => blown.has(`${cell.x},${cell.y}`))) {
        delete zone.blown;
        continue;
      }
      if (rule.dispersed !== true) {
        zone.blown ??= now;
        if (wholeRoundsSince(ctx, zone.blown) < rule.dispersed.after) continue;
      }
      ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "dispersed" });
      spendZone(ctx, caster, zone);
    }
  }
}

/** Every magical darkness a zone that `dispelsDark` meets, at its level or lower, dispelled (1.297):
 *  5e's Daylight on a Darkness of 3rd level or lower, as it appears or moves. */
function dispelDarkness(ctx: RulesetCombatContext): void {
  if (!ctx.state.board?.grid) return;
  const key = (cell: RulesetCombatCell) => `${cell.x},${cell.y}`;
  const away = (a: RulesetCombatCell, b: RulesetCombatCell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const lights = rulesetStandingZones(ctx.state).filter(({ action }) => action.zone?.dispelsDark);
  for (const { caster, zone, action } of lights.length ? rulesetStandingZones(ctx.state) : []) {
    const rule = zone.obscures ?? action.zone?.obscures;
    if (!rule?.darkness || !caster.zones?.includes(zone)) continue;
    const level = rulesetPaidLevel(ctx.definition, caster, action, zone.payWith);
    const dark = new Set(rulesetZoneCells(ctx.state, caster, zone).map(key));
    const met = lights.some((light) => {
      const dispels = light.action.zone!.dispelsDark!;
      if (level > dispels.upTo || !light.caster.zones?.includes(light.zone)) return false;
      // Only as near its middle as it says (1.299): Daylight's bright sphere, not its dim light.
      const middle = zoneMiddle(ctx, light.caster, light.zone);
      return rulesetZoneCells(ctx.state, light.caster, light.zone).some(
        (cell) =>
          dark.has(key(cell)) &&
          (dispels.within === undefined || middle.some((from) => away(from, cell) <= dispels.within!)),
      );
    });
    if (!met) continue;
    ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "dispelled" });
    spendZone(ctx, caster, zone);
  }
  // Magical darkness puts out the light a spell of its level or lower made (1.299): 5e's Darkness.
  const darks = rulesetStandingZones(ctx.state).flatMap(({ caster, zone, action }) =>
    action.zone?.dispelsLight && (zone.obscures ?? action.zone.obscures)?.darkness
      ? [{ upTo: action.zone.dispelsLight.upTo, cells: new Set(rulesetZoneCells(ctx.state, caster, zone).map(key)) }]
      : [],
  );
  if (darks.length === 0) return;
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    if (!action.zone?.lights || !caster.zones?.includes(zone)) continue;
    const level = rulesetPaidLevel(ctx.definition, caster, action, zone.payWith);
    const cells = rulesetZoneCells(ctx.state, caster, zone);
    if (!darks.some((dark) => level <= dark.upTo && cells.some((cell) => dark.cells.has(key(cell))))) continue;
    ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "dispelled" });
    spendZone(ctx, caster, zone);
  }
  // A condition's light, as far as it reaches from its holder.
  const perCell = ctx.combat.distance?.perCell ?? 1;
  for (const holder of ctx.state.combatants) {
    if (holder.defeated || !rulesetPositionOf(holder)) continue;
    for (const entry of [...holder.tracked]) {
      if (entry.level === undefined || !holder.tracked.includes(entry)) continue;
      const light = ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.light;
      if (!light) continue;
      const reach = rulesetInCells(light.bright + light.dim, perCell);
      const from = rulesetFootprint(holder);
      const met = darks.some(
        (dark) =>
          entry.level! <= dark.upTo &&
          [...dark.cells].some((cell) => {
            const [x, y] = cell.split(",").map(Number) as [number, number];
            return from.some((at) => away(at, { x, y }) <= reach);
          }),
      );
      if (!met) continue;
      // The spell is over: its concentration with it, where that is what holds it.
      const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
      if (entry.concentration && source?.concentrating && entry.action?.includes(source.concentrating.actionId)) {
        endConcentration(ctx, source, "spent");
      }
      removeCondition(ctx, holder, entry.condition, "dispelled");
    }
  }
}

/** Where a zone's light and reach are measured from (1.297): the point it was put at, or its caster. */
function zoneMiddle(ctx: RulesetCombatContext, caster: RulesetCombatant, zone: RulesetCombatZone): RulesetCombatCell[] {
  return rulesetZoneMiddles(ctx.state, caster, zone);
}

/** How many whole rounds have passed since a turn stamped "round:turn": one once the same turn of
 *  the next round has come. */
function wholeRoundsSince(ctx: RulesetCombatContext, stamp: string): number {
  const [round, turn] = stamp.split(":").map(Number) as [number, number];
  return ctx.state.round - round - (ctx.state.turn < turn ? 1 : 0);
}

/** A spell's zone used up (1.183), gone off or burned away: the spell is over, and the concentration
 *  holding it with it. */
function spendZone(ctx: RulesetCombatContext, caster: RulesetCombatant, zone: RulesetCombatZone): void {
  if (caster.concentrating?.actionId === zone.actionId) endConcentration(ctx, caster, "spent");
  else endZones(ctx, caster, zone.actionId);
}

/** Damage of these types reaching these cells (1.183): every zone that burns by one of them and
 *  covers one of the cells is set alight. */
function igniteZones(ctx: RulesetCombatContext, types: Array<string | undefined>, cells: RulesetCombatCell[]): void {
  const lower = new Set(types.flatMap((type) => (type ? [type.trim().toLowerCase()] : [])));
  if (lower.size === 0 || cells.length === 0) return;
  // Growth it reaches is burnt away (1.318).
  const grid = ctx.state.board?.grid;
  if (grid?.ground && rulesetGrowthRule(ctx.state).burnedBy.some((type) => lower.has(type))) {
    const burnt = rulesetClearGrowth(grid, cells);
    if (burnt > 0) ctx.events.push({ type: "growth", cells: burnt, by: "burnt" });
  }
  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    const burns = action.zone?.burns;
    if (!burns || zone.burning || !burns.by.some((type) => lower.has(type.trim().toLowerCase()))) continue;
    if (!rulesetZoneCells(ctx.state, caster, zone).some((cell) => keys.has(`${cell.x},${cell.y}`))) continue;
    zone.burning = true;
    ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "burning" });
  }
}

/** A turn starting by a burning zone (1.183): its own caster's, and it has burned away; anybody else's
 *  inside it, and they are burned, with no save. */
function burnAtTurn(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    const burns = action.zone?.burns;
    if (!zone.burning || !burns) continue;
    if (caster.id === actor.id) {
      spendZone(ctx, caster, zone);
      continue;
    }
    if (!burns.amount || !rulesetCombatStanding(actor)) continue;
    const inside = ctx.state.board?.grid
      ? rulesetZoneHoldsOne(rulesetZoneCells(ctx.state, caster, zone), actor)
      : (zone.held ?? []).includes(actor.id);
    if (!inside) continue;
    const amount = burns.amount;
    const harm = rulesetCombatIsPool(ctx.combat)
      ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
          throwHarm(ctx, actor, amount, burns.damageType, 0),
        )
      : (() => {
          const rolls = rollRulesetDice(ctx.roll, amount.count, amount.sides);
          return { rolls, flat: amount.flat, amount: sumOf(rolls) + amount.flat };
        })();
    const dealt = applyDamage(ctx, actor, {
      sourceId: caster.id,
      label: zone.label,
      ...(burns.damageType ? { damageType: burns.damageType } : {}),
      ...harm,
    });
    afterBlow(ctx, actor, dealt, false);
  }
}

/** A cast that stays leaves its area once the last reaction has been answered (1.172): the cells it
 *  covered where it was aimed, or a burst around its caster that goes where they go. Off a board it
 *  holds whom it was cast on. Whoever the cast itself caught counts as caught this turn. */
function placeZone(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
): void {
  const rule = action.zone!;
  if (action.concentration && actor.concentrating?.actionId !== action.id) return;
  endZones(ctx, actor, action.id);
  const grid = ctx.state.board?.grid;
  const at = resume.at;
  // From the cell its maker fills nearest where it was aimed (1.194).
  const from = rulesetNearestCell(actor, at ?? null);
  // A wall (1.177): its cells run the way it was aimed, and its side is the one chosen.
  const wall =
    grid && at && from && action.area?.shape === "wall"
      ? rulesetWallShape(
          grid,
          action.area,
          at,
          from,
          resume.toward,
          rule.side ? { distance: rule.side.distance, which: resume.side ?? "far" } : undefined,
          resume.ring === true,
          rule.sections?.every,
        )
      : undefined;
  const cells = wall
    ? wall.cells
    : grid && at && rule.anchor === "point"
      ? areaCellsFor(ctx.state, actor, action.id, at, resume.also ? { also: resume.also } : undefined)
      : undefined;
  const stamp = turnStamp(ctx);
  const caught = rule.atCast ? resume.targetIds : [];
  // Put on what somebody standing there holds (1.301): carried with them.
  const holder =
    rule.carried && at && grid
      ? ctx.state.combatants.find(
          (one) => !one.defeated && rulesetFills(one, at) && (rule.carried === "any" || one.id === actor.id),
        )
      : undefined;
  // Copies set down with it (1.301), moved with it.
  const also = rule.anchor === "point" && at && resume.also?.length ? resume.also.map((cell) => ({ ...cell })) : [];
  // A line or cone its caster carries points the way it was cast (1.182).
  const shape = action.area?.shape;
  const facing =
    rule.anchor === "caster" && (shape === "line" || shape === "cone") && at && from
      ? { dx: Math.sign(at.x - from.x), dy: Math.sign(at.y - from.y) }
      : undefined;
  (actor.zones ??= []).push({
    actionId: action.id,
    label: action.label,
    rounds: rule.rounds,
    anchor: rule.anchor,
    triggers: [...rule.triggers],
    // Until its maker's next lair count (1.324).
    ...(rule.untilLair ? { untilLair: true as const } : {}),
    ...(at && rule.anchor === "point" ? { at: { x: at.x, y: at.y } } : {}),
    ...(also.length ? { also } : {}),
    ...(holder ? { on: holder.id } : {}),
    ...(facing && (facing.dx || facing.dy) ? { facing } : {}),
    ...(cells ? { cells } : {}),
    ...(wall?.side.length ? { sideCells: wall.side } : {}),
    // Each section at its full health (1.200).
    ...(wall?.sections && rule.sections
      ? { sections: wall.sections.map((cells) => ({ cells, health: rule.sections!.health })) }
      : {}),
    ...(!grid ? { held: [...resume.targetIds] } : {}),
    ...(resume.payWith !== undefined ? { payWith: resume.payWith } : {}),
    ...(caught.length ? { struck: Object.fromEntries(caught.map((id) => [id, stamp])) } : {}),
  });
  (actor.flags.freshZones ??= []).push(action.id);
  ctx.events.push({ type: "zone", actorId: actor.id, label: action.label, outcome: "appeared" });
  if (rule.blocks?.move && cells && grid) shoveOffWall(ctx, actor, cells, wall?.side ?? []);
  // Whoever the cast caught is caught by the storm too (1.174), as it appears.
  for (const id of caught) {
    const target = rulesetCombatant(ctx.state, id);
    if (target && rulesetCombatStanding(target)) zoneShakes(ctx, action, target);
  }
}

/**
 * Whoever stands where a wall that blocks movement goes up is put off it (1.177): to the nearest open
 * cell, on the wall's chosen side when one is as near, as 5e's Wall of Force and Wall of Stone push a
 * creature to one side. Nobody is left standing inside something nobody may stand in.
 */
function shoveOffWall(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  cells: RulesetCombatCell[],
  side: RulesetCombatCell[],
): void {
  const grid = ctx.state.board!.grid;
  const wall = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const preferred = new Set(side.map((cell) => `${cell.x},${cell.y}`));
  for (const one of ctx.state.combatants) {
    const at = rulesetPositionOf(one);
    // Any cell they fill (1.194), and wherever they go, all of them clear of it.
    const span = rulesetSpanOf(one);
    if (one.defeated || !at || !rulesetFootprint(one).some((cell) => wall.has(`${cell.x},${cell.y}`))) continue;
    let best: RulesetCombatCell | null = null;
    for (let reach = 1; reach <= Math.max(grid.width, grid.height) && !best; reach++) {
      let fallback: RulesetCombatCell | null = null;
      for (let y = at.y - reach; y <= at.y + reach && !best; y++) {
        for (let x = at.x - reach; x <= at.x + reach; x++) {
          if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== reach) continue;
          const key = `${x},${y}`;
          const clear = rulesetFootprintAt({ x, y }, span).every(
            (cell) =>
              !wall.has(`${cell.x},${cell.y}`) &&
              !rulesetCellBlocked(grid, cell.x, cell.y) &&
              !ctx.state.combatants.some((other) => other !== one && !other.defeated && rulesetFills(other, cell)),
          );
          if (!clear) continue;
          if (preferred.size === 0 || preferred.has(key)) {
            best = { x, y };
            break;
          }
          fallback ??= { x, y };
        }
      }
      best ??= fallback;
    }
    if (!best) continue;
    one.x = best.x;
    one.y = best.y;
    ctx.events.push({
      type: "zone",
      actorId: caster.id,
      label: caster.zones?.at(-1)?.label ?? "",
      outcome: "shoved",
      targetId: one.id,
      to: { ...best },
    });
  }
}

/** The turn a zone counts its catches by: once a turn, whoever's turn it is. */
function turnStamp(ctx: RulesetCombatContext): string {
  return `${ctx.state.round}:${ctx.state.turn}`;
}

/**
 * A zone catching somebody at one of its triggers (1.172): the entry's own effect again, against
 * them alone, at the level it was cast with, as if from the zone's centre. Once a turn whatever the
 * trigger, so walking in and then ending the turn there is caught once. It starts no concentration,
 * hands out no budgets and leaves no new zone: it is the same spell going on.
 */
function zoneStrike(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  target: RulesetCombatant,
  trigger: RulesetCombatZoneRule["triggers"][number] | "ram",
  /** Caught on a wall's chosen side (1.177), by the side's own triggers. */
  region: "zone" | "side" = "zone",
): void {
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  // Standing where a section broke (1.200): what is left there catches as it says, in place of the wall.
  const broken = action?.zone?.sections?.broken;
  const inBroken =
    region === "zone" &&
    !!broken &&
    (zone.sections ?? []).some((section) => section.health <= 0 && rulesetZoneHoldsOne(section.cells, target));
  const triggers = inBroken
    ? broken!.triggers
    : region === "side"
      ? (action?.zone?.side?.triggers ?? [])
      : zone.triggers;
  // A ram is no trigger of its own: being rammed always catches, whatever moving in would do (1.175).
  if ((trigger !== "ram" && !triggers.includes(trigger)) || !rulesetCombatStanding(target)) return;
  if (!action || !rulesetZoneCatches(caster, zone, action, target)) return;
  const stamp = turnStamp(ctx);
  if (zone.struck?.[target.id] === stamp) return;
  // Only this turn's catches are kept: an older one can never match again.
  zone.struck = {
    ...Object.fromEntries(Object.entries(zone.struck ?? {}).filter(([, when]) => when === stamp)),
    [target.id]: stamp,
  };
  ctx.events.push({
    type: "zone",
    actorId: caster.id,
    label: zone.label,
    outcome: "struck",
    targetId: target.id,
    trigger,
  });
  if (inBroken) {
    brokenStrike(ctx, caster, zone, action, broken!, target);
    return;
  }
  const aimed = ctx.aimedAt;
  const aimedAlso = ctx.aimedAlso;
  delete ctx.aimedAlso;
  const centre = zone.at ?? rulesetPositionOf(caster);
  if (centre) ctx.aimedAt = { x: centre.x, y: centre.y };
  else delete ctx.aimedAt;
  zoneShakes(ctx, action, target);
  // Already held by it (1.175): what it does to a creature it holds, with no save, in its place.
  const held = action.zone?.whileHeld;
  if (
    held &&
    trigger === "turn-start" &&
    target.tracked.some((entry) => entry.condition === held.condition && entry.source === caster.id)
  ) {
    const from = ctx.events.length;
    const harm = rulesetCombatIsPool(ctx.combat)
      ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
          throwHarm(ctx, target, held.amount, held.damageType, 0),
        )
      : (() => {
          const rolls = rollRulesetDice(ctx.roll, held.amount.count, held.amount.sides);
          return { rolls, flat: held.amount.flat, amount: sumOf(rolls) + held.amount.flat };
        })();
    const dealt = applyDamage(ctx, target, {
      sourceId: caster.id,
      label: zone.label,
      ...(held.damageType ? { damageType: held.damageType } : {}),
      ...harm,
    });
    afterBlow(ctx, target, dealt, false);
    if (action.zone?.damageCap !== undefined) zoneDealt(ctx, caster, zone, action.zone.damageCap, from);
    if (aimed) ctx.aimedAt = aimed;
    else delete ctx.aimedAt;
    if (aimedAlso) ctx.aimedAlso = aimedAlso;
    return;
  }
  const { concentration: _held, zone: _zone, summons: _summons, gives: _gives, ...again } = action;
  // What it deals at its triggers may be another type than as it appeared (1.198).
  const struckType = action.zone?.damageType;
  if (struckType && again.damage) again.damage = { ...again.damage, type: struckType };
  const from = ctx.events.length;
  // The zone acting, not its caster (1.180).
  const byZone = ctx.byZone;
  ctx.byZone = true;
  resolveAction(ctx, caster, again, [target], zone.payWith);
  if (byZone) ctx.byZone = byZone;
  else delete ctx.byZone;
  if (aimed) ctx.aimedAt = aimed;
  else delete ctx.aimedAt;
  if (aimedAlso) ctx.aimedAlso = aimedAlso;
  if (action.zone?.damageCap !== undefined) zoneDealt(ctx, caster, zone, action.zone.damageCap, from);
}

/** What a wall's broken section does to whoever it catches (1.200): its amount of its type, saved
 *  against with its save at the entry's own difficulty, half or none of it on a success. */
function brokenStrike(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  broken: NonNullable<NonNullable<NonNullable<RulesetCombatAction["zone"]>["sections"]>["broken"]>,
  target: RulesetCombatant,
): void {
  const difficulty = action.save?.difficulty ?? action.saveDifficulty;
  const saved =
    broken.save !== undefined && difficulty !== undefined
      ? rollSave(ctx, target, broken.save, difficulty, caster.id)
      : false;
  if (saved && broken.onSave !== "half") return;
  const from = ctx.events.length;
  // Its own step, once for each the cast was paid above its base (1.201), as the entry's is.
  const steps = !broken.perCostStep
    ? 0
    : action.innate
      ? Math.max(0, action.innate.level - action.innate.baseLevel)
      : zone.payWith
        ? rulesetCostSteps(ctx.definition, action, zone.payWith, caster)
        : 0;
  const extra = broken.perCostStep && steps > 0 ? { amount: broken.perCostStep, times: steps } : undefined;
  const harm = rulesetCombatIsPool(ctx.combat)
    ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
        throwHarm(ctx, target, broken.amount, broken.damageType, 0, extra),
      )
    : (({ rolls, flat, total }) => ({ rolls, flat, amount: total }))(rollAmount(ctx, broken.amount, extra));
  const dealt = applyDamage(ctx, target, {
    sourceId: caster.id,
    label: zone.label,
    ...(broken.damageType ? { damageType: broken.damageType } : {}),
    ...harm,
    ...(saved ? { amount: Math.floor(harm.amount / 2) } : {}),
  });
  afterBlow(ctx, target, dealt, false);
  if (action.zone?.damageCap !== undefined) zoneDealt(ctx, caster, zone, action.zone.damageCap, from);
}

/** A storm that shakes concentration (1.174): whoever it catches while concentrating rolls the
 *  ruleset's concentration save against the entry's own save difficulty, before what it does. */
function zoneShakes(ctx: RulesetCombatContext, action: RulesetCombatAction, target: RulesetCombatant): void {
  const difficulty = action.save?.difficulty ?? action.saveDifficulty;
  const concentration = ctx.combat.concentration;
  if (!action.zone?.breaksConcentration || !concentration || !target.concentrating || difficulty === undefined) return;
  if (rollSave(ctx, target, concentration.save, difficulty)) {
    ctx.events.push({ type: "concentration", actorId: target.id, label: target.concentrating.label, state: "kept" });
  } else endConcentration(ctx, target, "zone");
}

/** A zone that ends once it has dealt so much (1.174): what its own damage events since `from` took
 *  off, added to what it had dealt, and the zone gone once that reaches the cap. */
function zoneDealt(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  cap: number,
  from: number,
): void {
  const dealt = ctx.events
    .slice(from)
    .reduce((total, one) => (one.type === "damage" && one.sourceId === caster.id ? total + one.dealt : total), 0);
  zone.dealt = (zone.dealt ?? 0) + dealt;
  if (zone.dealt < cap || !caster.zones?.includes(zone)) return;
  caster.zones = caster.zones.filter((one) => one !== zone);
  if (caster.zones.length === 0) delete caster.zones;
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "ended" });
}

/** Everybody a zone catches at the start or end of their turn: those standing in it on a board, or
 *  those it holds off one. */
function zonesAtTurn(ctx: RulesetCombatContext, actor: RulesetCombatant, trigger: "turn-start" | "turn-end"): void {
  for (const { caster, zone } of rulesetStandingZones(ctx.state)) {
    const inside = ctx.state.board?.grid
      ? rulesetZoneHoldsOne(rulesetZoneCells(ctx.state, caster, zone), actor)
      : (zone.held ?? []).includes(actor.id);
    if (inside) zoneStrike(ctx, caster, zone, actor, trigger);
    else if (rulesetZoneHoldsOne(zone.sideCells ?? [], actor)) {
      zoneStrike(ctx, caster, zone, actor, trigger, "side");
    }
  }
}

/**
 * A zone held at a point moving (1.173), moved on its caster's turn or drifting as it starts: the
 * same burst centred on the new cell. Whoever it now covers and did not before is caught as
 * `enter` says, as if they had walked in.
 */
function moveZone(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  to: RulesetCombatCell,
  outcome: "moved" | "drifted",
): void {
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  const grid = ctx.state.board?.grid;
  if (!action?.area || !grid) return;
  const before = new Set(rulesetZoneOccupants(ctx.state, caster, zone, action));
  const place = (at: RulesetCombatCell) => {
    // Its copies go with it, the same way (1.301), so far as the board reaches.
    const dx = at.x - (zone.at?.x ?? at.x);
    const dy = at.y - (zone.at?.y ?? at.y);
    if (zone.also) {
      zone.also = zone.also
        .map((cell) => ({ x: cell.x + dx, y: cell.y + dy }))
        .filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height);
    }
    zone.at = { x: at.x, y: at.y };
    const cells = new Map<string, RulesetCombatCell>();
    for (const middle of [zone.at, ...(zone.also ?? [])]) {
      for (const cell of rulesetAreaCells("burst", action.area!.size, middle, middle, grid))
        cells.set(`${cell.x},${cell.y}`, cell);
    }
    zone.cells = [...cells.values()];
  };
  // Rammed (1.175): it goes a cell at a time, straight for where it was sent, and stops on the
  // first cell that reaches somebody new; they are caught by that, not by moving in.
  if (outcome === "moved" && action.zone?.move?.ram) {
    let at = zone.at ?? to;
    let hit: string[] = [];
    while ((at.x !== to.x || at.y !== to.y) && hit.length === 0) {
      at = { x: at.x + Math.sign(to.x - at.x), y: at.y + Math.sign(to.y - at.y) };
      place(at);
      hit = rulesetZoneOccupants(ctx.state, caster, zone, action).filter((id) => !before.has(id));
    }
    place(at);
    ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome, to: { ...zone.at! } });
    if (hit.length === 0) return;
    zone.rammed = turnStamp(ctx);
    for (const id of hit) {
      const target = rulesetCombatant(ctx.state, id);
      if (target) zoneStrike(ctx, caster, zone, target, "ram");
    }
    return;
  }
  place(to);
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome, to: { ...zone.at! } });
  for (const id of rulesetZoneOccupants(ctx.state, caster, zone, action)) {
    if (before.has(id)) continue;
    const target = rulesetCombatant(ctx.state, id);
    if (target) zoneStrike(ctx, caster, zone, target, "enter");
  }
}

/** A line or cone its caster carries, turned to face `toward` (1.182). Whoever it now covers that it
 *  did not is caught as moving into it. */
function turnZone(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  toward: RulesetCombatCell,
): void {
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  const at = rulesetPositionOf(caster);
  if (!action || !at) return;
  const before = new Set(rulesetZoneOccupants(ctx.state, caster, zone, action));
  zone.facing = { dx: Math.sign(toward.x - at.x), dy: Math.sign(toward.y - at.y) };
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "turned" });
  for (const id of rulesetZoneOccupants(ctx.state, caster, zone, action)) {
    if (before.has(id)) continue;
    const target = rulesetCombatant(ctx.state, id);
    if (target) zoneStrike(ctx, caster, zone, target, "enter");
  }
}

/** Every zone of this caster's that drifts, moving as their turn starts (1.173). */
function driftZones(ctx: RulesetCombatContext, caster: RulesetCombatant): void {
  for (const zone of [...(caster.zones ?? [])]) {
    const drift = caster.actions.find((entry) => entry.id === zone.actionId)?.zone?.drift;
    if (!drift || !caster.zones?.includes(zone)) continue;
    const to = rulesetZoneDriftCell(ctx.state, caster, zone, drift);
    if (to) moveZone(ctx, caster, zone, to, "drifted");
  }
}

/**
 * Ground that hurts to cross (1.173): every `every` cells a mover walks inside a zone that catches
 * them, its amount, with no save and no roll to hit. Counted per zone and per mover, so a walk that
 * leaves and comes back goes on counting where it left off.
 */
function zoneGround(ctx: RulesetCombatContext, mover: RulesetCombatant, cell: RulesetCombatCell): void {
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    const ground = action.zone?.perDistance;
    if (!ground || !rulesetCombatStanding(mover) || !rulesetZoneCatches(caster, zone, action, mover)) continue;
    const from = ctx.events.length;
    // Any cell the mover fills from there (1.194).
    const cells = rulesetZoneCells(ctx.state, caster, zone);
    if (!rulesetFootprintAt(cell, rulesetSpanOf(mover)).some((one) => rulesetZoneHolds(cells, one))) continue;
    const walked = (zone.walked?.[mover.id] ?? 0) + 1;
    const times = Math.floor(walked / ground.every);
    zone.walked = { ...zone.walked, [mover.id]: walked - times * ground.every };
    for (let time = 0; time < times && rulesetCombatStanding(mover); time++) {
      ctx.events.push({
        type: "zone",
        actorId: caster.id,
        label: zone.label,
        outcome: "struck",
        targetId: mover.id,
        trigger: "moving",
      });
      const harm = rulesetCombatIsPool(ctx.combat)
        ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
            throwHarm(ctx, mover, ground.amount, ground.damageType, 0),
          )
        : (() => {
            const rolls = rollRulesetDice(ctx.roll, ground.amount.count, ground.amount.sides);
            return { rolls, flat: ground.amount.flat, amount: sumOf(rolls) + ground.amount.flat };
          })();
      const dealt = applyDamage(ctx, mover, {
        sourceId: caster.id,
        label: zone.label,
        ...(ground.damageType ? { damageType: ground.damageType } : {}),
        ...harm,
      });
      afterBlow(ctx, mover, dealt, false);
    }
    if (action.zone?.damageCap !== undefined) zoneDealt(ctx, caster, zone, action.zone.damageCap, from);
  }
}

/** A cast leaves its weapon only after the last reaction has been answered. */
function finishSummon(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
): void {
  if ((!action.summons && !action.zone) || resume.cancelled || actor.defeated) return;
  if (action.zone && !resume.summon) {
    placeZone(ctx, actor, action, resume);
    return;
  }
  if (!action.summons) return;
  if (resume.summon) {
    ctx.events.push({ type: "summon", actorId: actor.id, label: action.label, outcome: "struck" });
    return;
  }
  if (action.concentration && actor.concentrating?.actionId !== action.id) return;
  endSummons(ctx, actor, action.id);
  const at = summonCell(ctx.state, rulesetCombatant(ctx.state, resume.targetIds[0] ?? ""));
  (actor.summons ??= []).push({
    actionId: action.id,
    label: action.label,
    ...action.summons,
    ...(at ? { at } : {}),
    ...(resume.payWith !== undefined ? { payWith: resume.payWith } : {}),
  });
  (actor.flags.freshSummons ??= []).push(action.id);
  ctx.events.push({ type: "summon", actorId: actor.id, label: action.label, outcome: "appeared" });
}

// ── Concentration ──

function endConcentration(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  reason: "replaced" | "damage" | "down" | "zone" | "spent",
): void {
  const held = actor.concentrating;
  if (!held) return;
  actor.concentrating = null;
  // A spell held ready by it is lost with it (1.288).
  const readied = actor.readied;
  if (readied?.paid && readied.optionId === held.actionId) {
    delete actor.readied;
    ctx.events.push({ type: "ready", actorId: actor.id, label: readied.label, on: readied.on, outcome: "lost" });
  }
  endSummons(ctx, actor, held.actionId);
  endZones(ctx, actor, held.actionId);
  // Broken, it makes its lair's next action this one (1.327), or one of these (1.336): the Litany of Keeping.
  const next = actor.actions.find((action) => action.id === held.actionId)?.brokenNextLair;
  if (next && actor.lair && (reason === "damage" || reason === "down" || reason === "zone"))
    actor.lair.next = typeof next === "string" ? next : [...next];
  const concentration = ctx.combat.concentration;
  if (concentration) writeRulesetSheet(ctx.definition, actor, { op: "note", field: concentration.text, value: "" });
  // Whatever the concentration was holding up goes with it, wherever it landed.
  for (const combatant of ctx.state.combatants) {
    for (const entry of [...combatant.tracked]) {
      if (entry.concentration && entry.source === actor.id) {
        removeCondition(ctx, combatant, entry.condition, "concentration");
      }
    }
  }
  ctx.events.push({ type: "concentration", actorId: actor.id, label: held.label, state: "ended", reason });
}

/** The concentration that held this condition, ended with it: the spell is over (1.313, 1.314). */
function endHoldingConcentration(ctx: RulesetCombatContext, entry: RulesetTrackedCondition): void {
  const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
  if (entry.concentration && source?.concentrating && entry.action?.includes(source.concentrating.actionId)) {
    endConcentration(ctx, source, "spent");
  }
}

function startConcentration(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  if (actor.concentrating) endConcentration(ctx, actor, "replaced");
  actor.concentrating = { actionId: action.id, label: action.label };
  const concentration = ctx.combat.concentration;
  if (concentration) {
    writeRulesetSheet(ctx.definition, actor, { op: "note", field: concentration.text, value: action.label });
  }
  ctx.events.push({ type: "concentration", actorId: actor.id, label: action.label, state: "started" });
}

function concentrationFromDamage(ctx: RulesetCombatContext, target: RulesetCombatant, dealt: number): void {
  const concentration = ctx.combat.concentration;
  if (!concentration || !target.concentrating) return;
  const difficulty = Math.max(concentration.floor, Math.floor(dealt * concentration.fromDamage));
  if (rollSave(ctx, target, concentration.save, difficulty)) {
    ctx.events.push({ type: "concentration", actorId: target.id, label: target.concentrating.label, state: "kept" });
    return;
  }
  endConcentration(ctx, target, "damage");
}

// ── One choice ──

function refusal(
  state: RulesetEncounterState,
  actorId: string,
  reason: RulesetCombatRefusal,
  optionId?: string,
): RulesetCombatStep {
  return { state, events: [{ type: "refused", actorId, ...(optionId ? { optionId } : {}), reason }] };
}

/** Who a choice may be pointed at, checked against the very list `rulesetOptionTargets` offers, so
 *  the menu and the resolution can never disagree. `null` is a refusal: one target too many, one of
 *  the wrong side, or one the fight is over for. */
/** A weapon mode's own reach (1.190), where it has one. */
function modeRange(
  actor: RulesetCombatant,
  optionId: string,
  modeId: string,
): { range?: { normal: number; long?: number } } {
  const range = actor.actions.find((entry) => entry.id === optionId)?.modes?.find((one) => one.id === modeId)?.range;
  return range ? { range } : {};
}

function pickTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  option: { id: string; targets: RulesetCombatAction["targets"]; range?: { normal: number; long?: number } },
  targetIds: readonly string[],
): RulesetCombatant[] | RulesetCombatRefusal {
  // One that lands on its user, taken on their turn as much as in a reaction, lands on them.
  if (option.targets.count <= 0) return option.targets.side === "self" ? [actor] : [];
  // The same one more than once, each its own attack (1.305): eldritch blast's beams.
  const ids = option.targets.repeat ? [...targetIds] : [...new Set(targetIds)];
  if (ids.length < 1 || ids.length > option.targets.count) return "bad-target";
  const legal = new Set(rulesetOptionTargets(definition, state, actor.id, option));
  const targets: RulesetCombatant[] = [];
  for (const id of ids) {
    // A target the rules would allow if only it were closer is told exactly that, rather than being
    // lumped in with one of the wrong side or one the fight is over for.
    if (!legal.has(id)) return rulesetTargetRefusal(state, actor.id, option.id, id, option.range) ?? "bad-target";
    targets.push(rulesetCombatant(state, id)!);
  }
  // All within so far of each other (1.267): Command's extra creatures.
  const within = actor.actions.find((entry) => entry.id === option.id)?.targetsWithin;
  if (within !== undefined && targets.some((one) => targets.some((other) => rulesetGap(one, other) > within))) {
    return "targets-apart";
  }
  return targets;
}

/** A weapon put in hand (1.306): the one before it goes, a bound one back to what it was, and this
 *  mode's attacks take their place. */
function conjure(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction, mode: string): void {
  const made = actor.conjurable?.[`${action.id}|${mode}`];
  if (!made) return;
  const before = actor.conjured?.[action.id];
  const bound = before ? actor.conjurable?.[`${action.id}|${before.mode}`]?.bound : undefined;
  actor.actions = actor.actions.filter(
    (one) =>
      !one.id.startsWith(`conjured:${action.id}:`) && (bound === undefined || rulesetActionItemIndex(one) !== bound),
  );
  if (bound !== undefined && before?.was) actor.actions.push(...structuredClone(before.was));
  let was: RulesetCombatAction[] | undefined;
  if (made.bound !== undefined) {
    was = actor.actions.filter((one) => rulesetActionItemIndex(one) === made.bound);
    actor.actions = actor.actions.filter((one) => rulesetActionItemIndex(one) !== made.bound);
  }
  actor.actions.push(...structuredClone(made.actions));
  // Put away again for nothing (1.308): "if you dismiss the weapon (no action required)".
  actor.actions.push({
    id: `conjured:${action.id}:dismiss`,
    kind: "switch",
    label: made.item,
    budget: action.budget,
    free: true,
    targets: { side: "self", count: 0 },
    switches: { conjured: action.id },
  });
  actor.conjured = { ...actor.conjured, [action.id]: { mode, ...(was ? { was } : {}) } };
  // Named as the entry, not as the mode it was used in: "Pact of the Blade", not "(Longsword)".
  const label = actor.actions.find((one) => one.id === action.id)?.label ?? action.label;
  ctx.events.push({ type: "conjured", actorId: actor.id, optionId: action.id, label, item: made.item });
}

/** Who succeeded on a save against a cast its maker concentrates on, or against a repeat of it
 *  (1.310): Eyebite never picks them again. */
function noteSaved(actor: RulesetCombatant, action: RulesetCombatAction, target: RulesetCombatant): void {
  const held = actor.concentrating;
  if (!held || (held.actionId !== action.id && !(action.again && rulesetRepeatsHeld(actor, action.again)))) return;
  if (!held.saved?.includes(target.id)) held.saved = [...(held.saved ?? []), target.id];
}

/** A weapon put in hand gone again (1.308): dismissed, or its maker dead. A bound weapon is what it
 *  was before. */
function unconjure(ctx: RulesetCombatContext, actor: RulesetCombatant, actionId: string): void {
  const made = actor.conjured?.[actionId];
  if (!made) return;
  const bound = actor.conjurable?.[`${actionId}|${made.mode}`]?.bound;
  const item = actor.conjurable?.[`${actionId}|${made.mode}`]?.item ?? "";
  actor.actions = actor.actions.filter(
    (one) =>
      !one.id.startsWith(`conjured:${actionId}:`) && (bound === undefined || rulesetActionItemIndex(one) !== bound),
  );
  if (bound !== undefined && made.was) actor.actions.push(...structuredClone(made.was));
  delete actor.conjured![actionId];
  ctx.events.push({ type: "conjured", actorId: actor.id, optionId: actionId, label: "", item, gone: true });
}

/** Everything its maker put in hand gone with them (1.308). */
function unconjureAll(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  for (const id of Object.keys(actor.conjured ?? {})) unconjure(ctx, actor, id);
}

/** Who an entry used once a creature until a rest (1.304) was used on now, written where
 *  `rulesetUsedOn` reads it. */
function markUsedOn(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
): void {
  if (!action.oncePerTarget || targets.length === 0) return;
  const key = rulesetUsedOnKey(action);
  const marks = targets.flatMap((target) => rulesetUsedOnMarks(state, target));
  const names = [...new Set([...rulesetUsedOn(actor, action), ...marks])].slice(-60);
  if (actor.sheet) actor.sheet.live = { ...actor.sheet.live, usedOn: { ...actor.sheet.live.usedOn, [key]: names } };
  else actor.usedOn = { ...actor.usedOn, [key]: names };
}

/** What using an action costs the actor in its own bookkeeping: one of its uses, and, for an action
 *  that recharges, its availability until the dice bring it back. */
function spendAvailability(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  // Paid already, as it was readied (1.288).
  if (rulesetUseIsFree(actor.id, action.id)) return;
  const shot = spendRulesetShots(actor, action, action.itemUse ? (ctx.moreCharges ?? 0) : 0);
  if (shot) ctx.events.push(shot);
  // The last charge spent: an item that may break rolls for it now.
  const broke = shot?.type === "uses" ? breakRulesetItem(actor, action, ctx.roll) : null;
  if (broke) ctx.events.push(broke);
  if (action.uses) {
    const left = Math.max(0, rulesetActionUses(actor, action, ctx.state) - 1);
    if (action.innate?.coven) (ctx.state.covenUses ??= {})[`${action.innate.coven.id}/${action.id}`] = left;
    else actor.uses[action.id] = left;
    ctx.events.push({
      type: "uses",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      left,
      of: action.uses.count,
    });
  }
  if (action.recharge && !actor.spent.includes(action.id)) actor.spent.push(action.id);
  // A strike before a teleport (1.280) spends what both of them would.
  for (const id of action.pairedWith ?? []) {
    const part = actor.actions.find((one) => one.id === id);
    if (part) spendAvailability(ctx, actor, part);
  }
  // The rest of its recharge group goes with it (1.186): one breath spends the other.
  const group = action.recharge?.group;
  if (group) {
    for (const other of actor.actions) {
      if (other.recharge?.group === group && !actor.spent.includes(other.id)) actor.spent.push(other.id);
    }
  }
}

/** Why an option the caller named is not on the menu, as precisely as the rules can say. */
function whyNotOffered(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  optionId: string,
): RulesetCombatRefusal {
  // Caught unaware (1.237): the first turn is only ended.
  if (actor.surprised) return "surprised";
  // The two a positioned fight adds. Off the menu, they are movement that cannot be paid for.
  if (optionId === RULESET_MOVE_OPTION || optionId === RULESET_STAND_OPTION) return "unreachable";
  // Turning a zone (1.182): none to turn, or nothing left to turn it with.
  if (optionId.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX)) {
    const actionId = optionId.slice(RULESET_ZONE_TURN_OPTION_PREFIX.length);
    const turn = actor.actions.find((entry) => entry.id === actionId)?.zone?.turn;
    if (turn && actor.zones?.some((zone) => zone.actionId === actionId) && (actor.budgets[turn.budget] ?? 0) < 1) {
      return "no-budget";
    }
    return "unreachable";
  }
  // Moving a zone (1.173): none to move, or nothing left to move it with.
  if (optionId.startsWith(RULESET_ZONE_OPTION_PREFIX)) {
    const actionId = optionId.slice(RULESET_ZONE_OPTION_PREFIX.length);
    const move = actor.actions.find((entry) => entry.id === actionId)?.zone?.move;
    if (move && actor.zones?.some((zone) => zone.actionId === actionId) && (actor.budgets[move.budget] ?? 0) < 1) {
      return "no-budget";
    }
    return "unreachable";
  }
  // Picking up (1.266): out of reach, or nothing left to pick it up with.
  if (optionId.startsWith(RULESET_PICK_UP_OPTION_PREFIX)) {
    const thing = actor.dropped?.find((one) => one.key === optionId.slice(RULESET_PICK_UP_OPTION_PREFIX.length));
    if (!thing) return "unknown-option";
    if (thing.at && rulesetPositionOf(actor) && rulesetGapFrom(thing.at, 1, actor) > 1) return "unreachable";
    return "no-budget";
  }
  const action = actor.actions.find((entry) => entry.id === optionId);
  if (action) {
    // What it is made with lies where it was dropped (1.266).
    if (rulesetActionDropped(actor, action)) return "dropped";
    // Something free, or a strike out of what a spend already bought, never fell short of a budget.
    if (action.free || rulesetFreeStrike(actor, action)) return "insufficient";
    if ((actor.budgets[action.budget] ?? 0) < 1) return "no-budget";
    return "insufficient";
  }
  if (optionId.startsWith("standard:")) {
    const granted = rulesetGrantedStandard(definition, actor, optionId);
    const standard = rulesetStandardName(optionId);
    if ((combat.standard ?? []).some((entry) => entry === standard)) {
      const budget = granted ? granted.budget : rulesetStandardBudget(combat);
      if (optionId.includes("@") && !granted) {
        const at = optionId.slice(optionId.indexOf("@") + 1);
        // A condition's grant (combat C6d, Haste's extra action) whose budget is spent for the turn.
        const conditionGrant = rulesetConditionEconomy(definition, combat, actor).grants.some(
          (grant) => grant.budget === at && (grant.standard as readonly string[] | undefined)?.includes(standard),
        );
        if (conditionGrant) return "no-budget";
        // Told apart, because they are different answers: an ability that grants this really is on
        // the sheet but has nothing left or cannot pay, versus no such permission at all.
        const spent = actor.actions.some(
          (entry) => entry.standard?.budget === at && entry.standard.actions.includes(standard),
        );
        return spent ? "insufficient" : "unknown-option";
      }
      return (actor.budgets[budget] ?? 0) < 1 ? "no-budget" : "unknown-option";
    }
  }
  return "unknown-option";
}

/**
 * One choice from the menu, resolved. Never throws: an illegal choice comes back with the state it
 * was given and one `refused` event.
 *
 * The dice are injected, so the same state, the same choice and the same rolls always produce the
 * same events. `payWith` pays the price out of a higher pool of the same family, under the rule the
 * sheet's own `use` command already follows.
 */
/** Whether a choice is being taken with its user's save difficulties already moved (1.328). */
let shiftingSaves = false;

export function applyRulesetCombatChoice(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  // What its user makes others save against, lowered or raised by what they hold (1.328): the
  // Miller's Un-age, a spell save DC 2 lower. Set on their actions for this step only.
  // Only the outermost choice moves them: a lair action, a legendary cast or a readied action taken
  // within it is already reading the moved difficulties.
  const actor = shiftingSaves ? undefined : rulesetCombatant(state, choice.actorId);
  const by = actor ? rulesetSaveDifficultyShift(definition, actor, state) : 0;
  if (!actor || by === 0) return applyAlteredChoice(definition, state, choice, roller);
  const moved = new Set(actor.actions.map((action) => action.id));
  const view = withRulesetActions(state, actor.id, (actions) => shiftedDifficulties(actions, by));
  shiftingSaves = true;
  let step: RulesetCombatStep;
  try {
    step = applyAlteredChoice(definition, view, choice, roller);
  } finally {
    shiftingSaves = false;
  }
  if (step.state === view) return { ...step, state };
  // Moved back are only the actions that were moved: one made during the step keeps its own.
  return {
    ...step,
    state: withRulesetActions(step.state, actor.id, (actions) =>
      actions.map((action) => (moved.has(action.id) ? shiftedDifficulties([action], -by)[0]! : action)),
    ),
  };
}

/** How much what a combatant holds (a condition, an item, a level) moves the difficulty of the saves
 *  they call for (1.328). */
export function rulesetSaveDifficultyShift(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): number {
  const combat = definition.combat;
  if (!combat) return 0;
  return rulesetConditionModifiers(definition, combat, combatant, "save-difficulty", state).reduce(
    (total, entry) => total + (entry.modifier.flat ?? 0),
    0,
  );
}

/** The fight with one combatant's actions changed (1.328). */
function withRulesetActions(
  state: RulesetEncounterState,
  actorId: string,
  change: (actions: RulesetCombatAction[]) => RulesetCombatAction[],
): RulesetEncounterState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) =>
      combatant.id === actorId ? { ...combatant, actions: change(combatant.actions) } : combatant,
    ),
  };
}

/** Actions with every save they call for moved `by`: a save's own difficulty, wherever it is written
 *  on them, and a save difficulty given for saves that end what they put on. Never a check's, and
 *  never inside a stat block they call up (1.325), whose creatures are their own. */
function shiftedDifficulties(actions: RulesetCombatAction[], by: number): RulesetCombatAction[] {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    const record = value as Record<string, unknown>;
    for (const [key, entry] of Object.entries(record)) {
      if (key === "block") out[key] = entry;
      else if (key === "saveDifficulty" && typeof entry === "number") out[key] = entry + by;
      else if (key === "difficulty" && typeof entry === "number" && typeof record.save === "string")
        out[key] = entry + by;
      else out[key] = walk(entry);
    }
    return out;
  };
  return actions.map((action) => walk(action) as RulesetCombatAction);
}

function applyAlteredChoice(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  if (choice.alters === undefined || (Array.isArray(choice.alters) && choice.alters.length === 0)) {
    // Who it spares or heightens is for an alteration that does (1.254, 1.255), which it is not used with.
    if (choice.spares !== undefined || choice.heightens !== undefined) {
      return refusal(state, choice.actorId, "bad-alter", choice.optionId);
    }
    const { alters: _none, ...plain } = choice;
    return applyChoice(definition, state, plain, roller);
  }
  // Used with alterations (1.253): the choice is checked and resolved against the action as they
  // change it, set in its user's hands for this step only, and the action is given back after.
  const actor = rulesetCombatant(state, choice.actorId);
  const own = actor?.actions.find((entry) => entry.id === choice.optionId);
  const ids = Array.isArray(choice.alters) ? choice.alters : [];
  if (!actor || !own || choice.window !== undefined || ids.length === 0 || new Set(ids).size !== ids.length) {
    return refusal(state, choice.actorId, "bad-alter", choice.optionId);
  }
  const alters = ids.map((id) => actor.actions.find((entry) => entry.id === id));
  if (
    alters.some(
      (alter) =>
        !alter?.alters ||
        !rulesetAlterFits(alter.alters, own) ||
        !rulesetActionAvailable(actor, alter, state, definition),
    ) ||
    alters.filter((alter) => !alter!.alters!.joins).length > 1
  ) {
    return refusal(state, choice.actorId, "bad-alter", choice.optionId);
  }
  const chosen = alters as RulesetCombatAction[];
  // Who it spares (1.254): only with an alteration that spares some, no more than it spares, each
  // once and each of its user's side.
  const spares = choice.spares;
  if (spares !== undefined) {
    const most = Math.max(0, ...chosen.map((alter) => alter.alters!.spares ?? 0));
    // None at all is a choice too: it spares nobody.
    const ids = Array.isArray(spares) ? spares : [null];
    if (
      most === 0 ||
      ids.length > most ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== "string" || rulesetCombatant(state, id)?.side !== actor.side)
    ) {
      return refusal(state, choice.actorId, "bad-alter", choice.optionId);
    }
  }
  // Who it heightens (1.255): only with an alteration that heightens, one combatant other than its
  // user, and one of those it is pointed at where it is pointed at some.
  const heightens = choice.heightens;
  if (
    heightens !== undefined &&
    (!chosen.some((alter) => alter.alters!.heightens) ||
      typeof heightens !== "string" ||
      heightens === actor.id ||
      !rulesetCombatant(state, heightens) ||
      (choice.targetIds.length > 0 && !choice.targetIds.includes(heightens)))
  ) {
    return refusal(state, choice.actorId, "bad-alter", choice.optionId);
  }
  const picks = { ...(spares ? { spared: spares } : {}), ...(heightens ? { heightened: heightens } : {}) };
  const view = withRulesetAction(state, actor.id, rulesetAlteredAction(own, chosen, picks));
  const { alters: _ids, spares: _spared, heightens: _heightened, ...plain } = choice;
  const step = applyChoice(definition, view, plain, roller, chosen, picks);
  // Refused, nothing moved: the fight as it was handed in.
  if (step.state === view) return { ...step, state };
  return { ...step, state: withRulesetAction(step.state, actor.id, own) };
}

/** The fight with one of a combatant's actions in place of the one of its id (1.253). */
function withRulesetAction(
  state: RulesetEncounterState,
  actorId: string,
  action: RulesetCombatAction,
): RulesetEncounterState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) =>
      combatant.id === actorId
        ? {
            ...combatant,
            actions: combatant.actions.map((entry) => (entry.id === action.id ? action : entry)),
          }
        : combatant,
    ),
  };
}

/** An action as it was used, with the alterations it was used with (1.253). */
function rulesetResumedAction(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  alters: string[] | undefined,
  spares?: string[],
  heightens?: string,
): RulesetCombatAction {
  // Already set on it, as it is while the step that used it runs.
  if (!alters?.length || action.alteredWith) return action;
  const found = alters.flatMap((id) => {
    const alter = actor.actions.find((entry) => entry.id === id);
    return alter?.alters ? [alter] : [];
  });
  return rulesetAlteredAction(action, found, {
    ...(spares ? { spared: spares } : {}),
    ...(heightens ? { heightened: heightens } : {}),
  });
}

function applyChoice(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
  /** The alterations it is used with, already set on the action (1.253), to pay for now. */
  alters?: RulesetCombatAction[],
  /** Who of its user's side they spare (1.254) and who they heightened (1.255), already set on the
   *  action. */
  picks: { spared?: string[]; heightened?: string } = {},
): RulesetCombatStep {
  const combat = definition.combat;
  if (!combat) return refusal(state, choice.actorId, "encounter-over", choice.optionId);
  if (rulesetEncounterOutcome(state) !== "ongoing") {
    return refusal(state, choice.actorId, "encounter-over", choice.optionId);
  }
  const actor = rulesetCombatant(state, choice.actorId);
  if (!actor) return refusal(state, choice.actorId, "unknown-actor", choice.optionId);
  // A window holds the whole fight: while one is open the only thing that moves it is the answer of
  // the one combatant it is asking, and every other choice is refused rather than queued.
  if (state.window) return applyInWindow(definition, combat, state, state.window, actor, choice, roller);
  // An answer to a window that has already closed is NOT a turn's choice. Letting it fall through
  // would spend on a turn what was written for a moment the fight has moved past, which is the one
  // thing the window's id is carried to prevent.
  if (choice.window !== undefined) return refusal(state, choice.actorId, "stale-window", choice.optionId);
  // Points, not a budget, and bought between one turn and the next rather than on anybody's: a
  // signature action off its own window is refused here, so nothing buys one mid-turn.
  const signature = actor.actions.find((entry) => entry.id === choice.optionId && entry.signature);
  if (signature) return refusal(state, choice.actorId, "not-your-turn", choice.optionId);
  if (currentRulesetActor(state)?.id !== actor.id)
    return refusal(state, choice.actorId, "not-your-turn", choice.optionId);
  // Ending a turn is always allowed, down or not: a character lying at zero still has a turn, and
  // it is the one their roll against death happens on.
  if (choice.optionId === "end-turn") return advanceRulesetTurn(definition, state, roller);
  // Away and still taking turns (1.313), it may try the way back.
  if (!rulesetCombatStanding(actor) && !actor.away?.turns)
    return refusal(state, choice.actorId, "down", choice.optionId);

  const option = rulesetCombatOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!option) {
    if (rulesetCombatEffects(definition, combat, actor, state).has("cannot-act")) {
      return refusal(state, choice.actorId, "cannot-act", choice.optionId);
    }
    // Something a condition decides this turn may not hold (1.264).
    if (rulesetUncompelledOptions(definition, state, actor.id).some((entry) => entry.id === choice.optionId)) {
      return refusal(state, choice.actorId, "compelled", choice.optionId);
    }
    return refusal(state, choice.actorId, whyNotOffered(definition, combat, actor, choice.optionId), choice.optionId);
  }
  // Offered only with an alteration that makes it usable now (1.253).
  if (option.alterNeeded && !alters?.some((alter) => alter.id === option.alterNeeded)) {
    return refusal(state, choice.actorId, "bad-alter", choice.optionId);
  }

  // Turning a line or cone its caster carries (1.182): to face a cell the menu offered.
  if (option.id.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX)) {
    const cell = destinationOf(option, choice.to);
    if (!cell) return refusal(state, choice.actorId, "unreachable", option.id);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    spendBudget(ctx, working, option.budget!);
    const actionId = option.id.slice(RULESET_ZONE_TURN_OPTION_PREFIX.length);
    const zone = working.zones!.find((entry) => entry.actionId === actionId)!;
    turnZone(ctx, working, zone, cell);
    noteOutcome(ctx);
    return finish();
  }

  // Averting the eyes from a gaze, or looking again (1.268): free.
  if (option.avert && option.id.startsWith(RULESET_AVERT_OPTION_PREFIX)) {
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    const { holderId, back } = option.avert;
    const kept = (working.averted ?? []).filter((id) => id !== holderId);
    if (!back) kept.push(holderId);
    if (kept.length) working.averted = kept;
    else delete working.averted;
    ctx.events.push({ type: "averted", actorId: working.id, holderId, ...(back ? { back: true as const } : {}) });
    noteOutcome(ctx);
    return finish();
  }

  // Picking up what was dropped (1.266): for the budget it named, else the turn's free pick-up.
  if (option.pickUp && option.id.startsWith(RULESET_PICK_UP_OPTION_PREFIX)) {
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    if (option.budget) spendBudget(ctx, working, option.budget);
    else working.flags.pickedUp = true;
    const key = option.id.slice(RULESET_PICK_UP_OPTION_PREFIX.length);
    working.dropped = (working.dropped ?? []).filter((thing) => thing.key !== key);
    if (!working.dropped.length) delete working.dropped;
    ctx.events.push({ type: "pickedUp", actorId: working.id, label: option.label });
    noteOutcome(ctx);
    return finish();
  }

  // Moving a zone its caster holds (1.173): to a cell the menu offered, for the budget it named.
  if (option.id.startsWith(RULESET_ZONE_OPTION_PREFIX)) {
    const cell = destinationOf(option, choice.to);
    if (!cell) return refusal(state, choice.actorId, "unreachable", option.id);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    spendBudget(ctx, working, option.budget!);
    const actionId = option.id.slice(RULESET_ZONE_OPTION_PREFIX.length);
    const zone = working.zones!.find((entry) => entry.actionId === actionId)!;
    moveZone(ctx, working, zone, cell, "moved");
    noteOutcome(ctx);
    return finish();
  }

  // Walking, and getting back up: a positioned fight's own two options. Neither spends a budget.
  if (option.kind === "move") {
    const cell = option.id === RULESET_MOVE_OPTION ? destinationOf(option, choice.to) : null;
    if (option.id === RULESET_MOVE_OPTION && !cell) return refusal(state, choice.actorId, "unreachable", option.id);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const walking = rulesetCombatant(ctx.state, actor.id)!;
    if (cell) resolveMove(ctx, walking, cell);
    else if (option.id === RULESET_FLY_UP_OPTION || option.id === RULESET_FLY_DOWN_OPTION) {
      resolveFly(ctx, walking, option);
    } else if (option.id === RULESET_TAKE_OFF_OPTION || option.id === RULESET_LAND_OPTION) {
      // Into the air or down onto the ground where it stands (1.354), for nothing.
      if (option.id === RULESET_TAKE_OFF_OPTION) walking.airborne = true;
      else delete walking.airborne;
      ctx.events.push({ type: "lift", actorId: walking.id, up: option.id === RULESET_TAKE_OFF_OPTION });
    } else resolveStand(ctx, walking, option);
    const ended = rulesetEncounterOutcome(ctx.state);
    if (ended !== "ongoing") pushOutcome(ctx, ended);
    return finish();
  }

  // An area lands on a CELL, and everybody standing in the shape is caught by it. Its own
  // `targetCount` says nothing here: the shape decides how many it reaches.
  const area = positionedArea(state, actor, option);
  if (area && !(choice.at && rulesetAimLegal(state, actor.id, option.id, choice.at))) {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  // Which way a wall runs and which side it faces (1.177): a cell of the board, and one of two words.
  const grid = state.board?.grid;
  if (
    choice.toward !== undefined &&
    !(
      area &&
      grid &&
      Number.isInteger(choice.toward.x) &&
      Number.isInteger(choice.toward.y) &&
      choice.toward.x >= 0 &&
      choice.toward.y >= 0 &&
      choice.toward.x < grid.width &&
      choice.toward.y < grid.height
    )
  ) {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  if (choice.side !== undefined && choice.side !== "near" && choice.side !== "far") {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  // Further copies (1.178): only where the area allows them, each legal and touching the rest.
  if (
    choice.also !== undefined &&
    !(
      area &&
      choice.at &&
      Array.isArray(choice.also) &&
      choice.also.every(
        (cell) => !!cell && typeof cell === "object" && Number.isInteger(cell.x) && Number.isInteger(cell.y),
      ) &&
      rulesetCopiesLegal(state, actor.id, option.id, choice.at, choice.also)
    )
  ) {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  const also = area && choice.also?.length ? choice.also.map((cell) => ({ x: cell.x, y: cell.y })) : undefined;
  // Laid as a ring only where its area says it may be.
  if (
    choice.ring !== undefined &&
    (typeof choice.ring !== "boolean" ||
      (choice.ring && !actor.actions.find((entry) => entry.id === option.id)?.area?.ring))
  ) {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  // A weapon's mode is one the option offers now, and aims at as many as the mode says.
  const mode = choice.mode === undefined ? undefined : option.modes?.find((entry) => entry.id === choice.mode);
  if (choice.mode !== undefined && !mode) return refusal(state, choice.actorId, "unknown-mode", option.id);
  // A creature type is picked as it is used (1.270): no kind, no Antipathy.
  // And so is the weapon put in hand (1.306).
  const namedIn = actor.actions.find((entry) => entry.id === option.id);
  if (!mode && (namedIn?.kindChoice || namedIn?.conjures)) {
    return refusal(state, choice.actorId, "unknown-mode", option.id);
  }
  if (choice.payWith !== undefined && !(option.payWith ?? []).includes(choice.payWith)) {
    return refusal(state, choice.actorId, "bad-pool", option.id);
  }
  // Where a teleport goes and who goes along (1.276): only what its option offers.
  const teleporting = option.teleport;
  // No cell is out of the fight, where it may leave it (1.279).
  if (
    teleporting &&
    !(choice.at
      ? teleporting.cells.some((cell) => cell.x === choice.at!.x && cell.y === choice.at!.y)
      : teleporting.leaves)
  ) {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  if (
    choice.carries !== undefined &&
    !(
      teleporting &&
      Array.isArray(choice.carries) &&
      new Set(choice.carries).size === choice.carries.length &&
      choice.carries.length <= (teleporting.carries?.count ?? 0) &&
      choice.carries.every((id) => teleporting.carries!.ids.includes(id))
    )
  ) {
    return refusal(state, choice.actorId, "bad-target", option.id);
  }
  // A wall's section struck at instead of a creature (1.200).
  if (choice.wall !== undefined) return strikeSection(definition, combat, state, actor, option, choice, roller);
  // Targets, checked against the side and the count the option itself declared, or the count the
  // pool it is paid with lets it take (1.171).
  const paidCount = choice.payWith !== undefined ? option.targetsWith?.[choice.payWith] : undefined;
  const grow = rulesetAreaGrowth(definition, actor, option.id, choice.payWith);
  // A burst centred on its user (1.282) catches whom it reaches, and is pointed at nobody.
  const around = actor.actions.find((entry) => entry.id === option.id && entry.around);
  const targets = around
    ? rulesetAroundTargets(state, actor, around).filter((one) => !rulesetSealedApart(definition, state, actor, one))
    : area
      ? rulesetAreaTargets(state, actor.id, option.id, choice.at!, {
          toward: choice.toward,
          ring: choice.ring,
          also,
          ...(grow ? { grow } : {}),
        })
          .map((id) => rulesetCombatant(state, id)!)
          // A sphere keeps an area out, and in (1.314).
          .filter((one) => !rulesetSealedApart(definition, state, actor, one))
      : pickTargets(
          definition,
          state,
          actor,
          mode
            ? {
                id: option.id,
                targets: { ...option.targets, count: mode.targets },
                // A mode's own reach (1.190): a javelin of lightning's bolt.
                ...modeRange(actor, option.id, mode.id),
              }
            : paidCount !== undefined
              ? { id: option.id, targets: { ...option.targets, count: paidCount } }
              : option,
          choice.targetIds,
        );
  if (!Array.isArray(targets)) return refusal(state, choice.actorId, targets, option.id);
  // A target named behind a ward this payment does not get through (1.179).
  const named = actor.actions.find((entry) => entry.id === option.id);
  if (
    !area &&
    named &&
    targets.some((target) => rulesetWarded(definition, state, actor, named, target, choice.payWith))
  ) {
    return refusal(state, choice.actorId, "bad-target", option.id);
  }

  const { ctx, finish } = begin(definition, combat, state, roller);
  if (area && choice.at) ctx.aimedAt = { x: choice.at.x, y: choice.at.y };
  if (also) ctx.aimedAlso = also;
  if (teleporting) {
    ctx.teleport = {
      ...(choice.at ? { to: { x: choice.at.x, y: choice.at.y } } : {}),
      carries: [...(choice.carries ?? [])],
    };
  }
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);

  // The budget goes first: what a turn may hold is not a matter of how the dice fall.
  const budget = option.budget;
  if (budget) spendBudget(ctx, working, budget);

  // What breaks a sphere, aimed at the one inside (1.314), breaks it and does nothing else to them:
  // Disintegrate on a Resilient Sphere.
  const breaking = working.actions.find((entry) => entry.id === option.id)?.entry;
  for (const target of [...workingTargets]) {
    const sealed = breaking ? rulesetSealed(definition, target, ctx.state) : undefined;
    if (!sealed?.brokenBy?.includes(breaking!)) continue;
    const held = target.tracked.find((entry) => entry.condition === sealed.condition);
    removeCondition(ctx, target, sealed.condition, "dispelled");
    if (held) endHoldingConcentration(ctx, held);
    workingTargets.splice(workingTargets.indexOf(target), 1);
  }

  // A save spent an action on (1.264): Irresistible Dance.
  if (option.resave) {
    const entry = working.tracked.find((one) => one.condition === option.resave!.condition);
    if (entry?.saveEnds && entry.difficulty !== undefined && saveOutOfSight(ctx, working, entry)) {
      const saved = rollSave(
        ctx,
        working,
        entry.saveEnds.save,
        entry.difficulty,
        entry.source,
        undefined,
        { conditions: [entry.condition], ...(entry.action ? { action: entry.action } : {}) },
        leanInSight(ctx, working, entry),
      );
      savedAgainst(ctx, working, entry, saved);
    }
    noteOutcome(ctx);
    return finish();
  }

  // A check that ends what it holds (1.313): Maze's way out.
  if (option.checkEnds) {
    const entry = working.tracked.find((one) => one.condition === option.checkEnds!.condition);
    const rule = entry?.checkEnds;
    if (entry && rule) {
      const automatic = !!rule.passes && rulesetTargetIs(ctx.definition, working, rule.passes);
      const thrown = automatic ? undefined : throwCheck(ctx, working, rule.check, working.checks?.[rule.check] ?? 0);
      const success = automatic || (thrown !== undefined && thrown.total >= rule.difficulty);
      ctx.events.push({
        type: "checkEnded",
        actorId: working.id,
        condition: entry.condition,
        difficulty: rule.difficulty,
        ...(thrown ? { total: thrown.total, rolls: thrown.rolls } : {}),
        success,
        ...(automatic ? { automatic: true as const } : {}),
      });
      if (success) {
        removeCondition(ctx, working, entry.condition, "save");
        // The spell ends with it: its concentration too, where that is what held it.
        endHoldingConcentration(ctx, entry);
      }
    }
    noteOutcome(ctx);
    return finish();
  }

  // Rolling the sphere one is shut in (1.314): its share of their speed, to walk.
  if (option.rollsSealed) {
    const sealed = rulesetSealed(definition, working, ctx.state);
    if (sealed?.rolls) {
      const allowance = rulesetMovementAllowance(definition, combat, working, ctx.state, undefined, true);
      const cells = Math.floor(allowance * sealed.rolls.share);
      working.movementLeft = (working.movementLeft ?? 0) + cells;
      delete working.carriedBy;
      ctx.events.push({ type: "sphere", actorId: working.id, how: "rolled", cells });
    }
    noteOutcome(ctx);
    return finish();
  }
  // Picking a sphere up, or putting it down (1.314).
  if (option.lifts) {
    const held = rulesetCombatant(ctx.state, option.lifts.holderId)!;
    if (option.lifts.down) delete held.carriedBy;
    else held.carriedBy = working.id;
    ctx.events.push({
      type: "sphere",
      actorId: working.id,
      how: option.lifts.down ? "put-down" : "lifted",
      targetId: held.id,
    });
    noteOutcome(ctx);
    return finish();
  }

  // A prop lit again (1.332): the bonfire after Bonfire Gutters.
  if (option.relights) {
    const prop = ctx.state.board?.props?.find((one) => one.id === option.relights!.propId);
    if (prop?.relight) {
      const cells = rulesetRelightCells(ctx.state, prop);
      rulesetChangeGround(ctx.state, cells, { light: prop.relight.light });
      ctx.events.push({ type: "relit", actorId: working.id, propId: prop.id, label: prop.label, cells: cells.length });
    }
    noteOutcome(ctx);
    return finish();
  }
  if (option.shakeOff) {
    const holder = rulesetCombatant(ctx.state, option.shakeOff.holderId)!;
    removeCondition(ctx, holder, option.shakeOff.condition, "shaken");
    noteOutcome(ctx);
    return finish();
  }

  if (option.id.startsWith("summon:")) {
    const summon = working.summons!.find((entry) => `summon:${entry.actionId}` === option.id)!;
    const action = working.actions.find((entry) => entry.id === summon.actionId)!;
    summon.at = summonCell(ctx.state, workingTargets[0], summon.at);
    if (rulesetIsAttack(action)) countAttack(ctx, working);
    reopenAction(ctx, working, action, {
      kind: "action",
      actorId: working.id,
      optionId: action.id,
      targetIds: workingTargets.map((target) => target.id),
      ...(summon.payWith !== undefined ? { payWith: summon.payWith } : {}),
      summon: true,
    });
    noteOutcome(ctx);
    return finish();
  }

  if (option.kind === "standard") {
    // A standard action an ability allowed is paid for as that ability is: the budget it named,
    // just spent, and whatever the ability itself costs off the sheet.
    const granted = rulesetGrantedStandard(definition, working, option.id, ctx.state);
    if (granted) {
      const price = planRulesetCombatCost(definition, working, granted.action);
      if (!price) return refusal(state, choice.actorId, "insufficient", option.id);
      if (price.live && working.sheet) working.sheet.live = price.live;
      countRulesetSpend(working, price.cost);
      for (const entry of price.cost) {
        ctx.events.push({
          type: "spend",
          actorId: working.id,
          pool: entry.pool,
          label: entry.label,
          amount: entry.amount,
        });
      }
      spendAvailability(ctx, working, granted.action);
    }
    // Readying something for real (1.288).
    if (option.ready) {
      if (!readyAction(ctx, working, option.ready, choice.payWith)) {
        return refusal(state, choice.actorId, "insufficient", option.id);
      }
      return finish();
    }
    resolveStandard(ctx, working, rulesetStandardName(option.id), workingTargets[0]);
    return finish();
  }

  // A switch turns its item on or off and does nothing else (1.170).
  if (option.kind === "switch") {
    const switching = working.actions.find((entry) => entry.id === option.id);
    if (switching?.switches && "carried" in switching.switches) {
      // The light they carry, put out or lit again (1.295): the hiding it gave away is asked again.
      const on = !!working.doused;
      if (on) delete working.doused;
      else working.doused = true;
      if (switching.free) working.flags.lightSwitched = true;
      ctx.events.push({ type: "switch", actorId: working.id, optionId: switching.id, label: switching.label, on });
    } else if (switching?.switches && "conjured" in switching.switches) {
      // A weapon put in hand, put away for nothing (1.308).
      unconjure(ctx, working, switching.switches.conjured);
    } else if (switching?.switches && "item" in switching.switches) {
      const on = !rulesetItemOn(working, switching.switches.item);
      working.on = { ...(working.on ?? {}), [switching.switches.item]: on };
      ctx.events.push({ type: "switch", actorId: working.id, optionId: switching.id, label: switching.label, on });
    }
    return finish();
  }

  // A reload fills the clip and does nothing else: no target, no roll, no window.
  if (option.kind === "reload") {
    const reloading = working.actions.find((entry) => entry.id === option.id);
    const reloaded = reloading ? reloadRulesetClip(working, reloading) : null;
    if (reloaded) ctx.events.push(reloaded);
    return finish();
  }

  // Strikes: one spend of a source that declares them buys several, and the rest wait in hand until
  // the turn ends. Taking one with any in hand spends no budget at all, which is why this reads
  // what the option said rather than the budget it would otherwise have named.
  const striking = working.actions.find((entry) => entry.id === option.id);
  const inHand = working.strikesLeft ?? 0;
  // A spend that buys ONE strike is the spend every fight has always made, so it puts nothing in
  // hand and says nothing: a ruleset whose list declares one strike a spend reads as it always did.
  // An attack a condition's grant paid for is one strike (combat C6d), and puts none in hand.
  if (striking && !striking.sequence && rulesetIsAttack(striking)) countAttack(ctx, working);
  // The attack action, taken with a weapon's own budget or a strike it already bought (1.242): what
  // a grant or an entry that comes only after it reads.
  if (
    striking?.kind === "attack" &&
    !striking.catalog &&
    (option.budget === undefined || option.budget === striking.budget)
  ) {
    working.flags.attackAction = [...(working.flags.attackAction ?? []), striking.label];
  }
  if (striking?.strikes !== undefined && !option.oneStrike && (inHand > 0 || striking.strikes > 1)) {
    const left = inHand > 0 ? inHand - 1 : striking.strikes - 1;
    if (left > 0) working.strikesLeft = left;
    else delete working.strikesLeft;
    ctx.events.push({ type: "strikes", actorId: working.id, optionId: striking.id, label: striking.label, left });
  }

  if (area && choice.at) {
    ctx.events.push({
      type: "area",
      actorId: working.id,
      optionId: option.id,
      label: option.label,
      at: { ...choice.at },
      cells: areaCellsFor(ctx.state, working, option.id, choice.at, {
        toward: choice.toward,
        ring: choice.ring,
        also,
        ...(grow ? { grow } : {}),
      }),
    });
  }

  const own = working.actions.find((entry) => entry.id === option.id)!;
  const action = mode ? (rulesetModedAction(definition, own, mode.id) ?? own) : own;
  // Where initiative is a number attacks move, the style it is made in: the one asked for, which has
  // to be one this attack is offered in, or the first when none was asked for.
  const offeredStyles = rulesetAttackStyles(combat, working, action);
  if (choice.style !== undefined && !offeredStyles.some((style) => style.id === choice.style)) {
    return refusal(state, choice.actorId, "unknown-style", option.id);
  }
  const chosenStyle = offeredStyles.find((style) => style.id === choice.style) ?? offeredStyles[0];
  const styleId = chosenStyle?.id;
  // A spending blow throws the number its maker has as they make it, whatever a window does to it.
  const spend = chosenStyle?.spends ? working.initiative : undefined;
  // As many uses as its user chose (1.251), one up to what is left; left out, what heals the first
  // target fully.
  let amount: number | undefined;
  if (action.usesChosen) {
    const most = rulesetChosenUsesMax(definition, working, action);
    amount = choice.amount ?? chosenUsesToFill(ctx, action, workingTargets[0], most);
    if (!Number.isInteger(amount) || amount < 1 || amount > most) {
      return refusal(state, choice.actorId, "insufficient", option.id);
    }
  }
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith, amount);
  // More of an item's charges (1.269), spent with its own.
  const moreCharges = rulesetChargeSteps(action, choice.payWith);
  if (moreCharges) ctx.moreCharges = moreCharges;
  if (!paid) {
    // The menu said it was affordable, so only a `payWith` the sheet refuses can land here.
    return refusal(state, choice.actorId, "insufficient", option.id);
  }
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: working.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  // And what it was altered with (1.253), each at the level it was paid at.
  for (const alter of alters ?? []) {
    const price = planRulesetAlterCost(definition, working, alter, action, choice.payWith);
    if (!price) return refusal(state, choice.actorId, "insufficient", option.id);
    if (price.live && working.sheet) working.sheet.live = price.live;
    countRulesetSpend(working, price.cost);
    for (const entry of price.cost) {
      ctx.events.push({
        type: "spend",
        actorId: working.id,
        pool: entry.pool,
        label: entry.label,
        amount: entry.amount,
      });
    }
    spendAvailability(ctx, working, alter);
  }
  if (alters?.length) {
    ctx.events.push({
      type: "altered",
      actorId: working.id,
      optionId: action.id,
      label: action.label,
      alters: alters.map((alter) => alter.label),
    });
  }
  // The other half of an action made this turn (1.280), once, and already paid for when the strike
  // came first. Made as the first half, it lets the other follow.
  const following = option.followUp ? working.flags.followUps?.find((one) => one.id === action.id) : undefined;
  if (following) working.flags.followUps = working.flags.followUps!.filter((one) => one !== following);
  if (!following?.paid) spendAvailability(ctx, working, action);
  markUsedOn(ctx.state, working, action, workingTargets);
  if (action.conjures && mode) conjure(ctx, working, action, mode.id);
  if (!option.followUp && action.followUp) {
    (working.flags.followUps ??= []).push({
      id: action.followUp,
      ...(action.pairedWith?.includes(action.followUp) ? { paid: true as const } : {}),
    });
  }
  // An item's gate is rolled once the item is spent: failed, it is used up for nothing, and nobody is
  // asked about a use that never happened.
  if (action.itemUse?.gate && !passesGate(ctx, working, action, action.itemUse.gate)) {
    noteOutcome(ctx);
    return finish();
  }
  // A fake, spent, is found out (1.79); one whose true item has no use did nothing.
  const fake = action.itemUse?.fake;
  if (fake) {
    ctx.events.push({
      type: "fake",
      actorId: working.id,
      optionId: action.id,
      label: action.label,
      truly: fake.name,
      ...(fake.dud ? { dud: true as const } : {}),
    });
    if (fake.dud) {
      noteOutcome(ctx);
      return finish();
    }
  }
  // A weapon's mode spends the item's charges, and its bolt goes off on the way (1.190).
  const modeRule = mode ? own.modes?.find((entry) => entry.id === mode.id) : undefined;
  if (modeRule?.charges) {
    const left = Math.max(0, rulesetItemChargesLeft(working, modeRule.charges) - modeRule.charges.cost);
    (working.charges ??= {})[modeRule.charges.item] = left;
    ctx.events.push({
      type: "uses",
      actorId: working.id,
      optionId: action.id,
      label: action.label,
      left,
      of: modeRule.charges.max,
    });
  }
  if (modeRule?.line && workingTargets[0]) boltAlong(ctx, working, workingTargets[0], modeRule.line, action.label);
  // An attack with an off-hand weapon lets another one strike on the off-hand budget this turn.
  if (action.pairs !== undefined) working.flags.offHand = action.pairs;
  // A contest is settled between the two of them on the spot. A fall it causes can be held.
  if (action.contest) {
    const before = new Set(working.tracked);
    // A grab or a shove gives a hider away as an attack does (1.287).
    if (working.hiding) (ctx.giveaways ??= new Map()).set(working.id, "attack");
    resolveContest(ctx, working, action, action.contest, workingTargets[0]!);
    holderActed(ctx, working, action, before);
    noteOutcome(ctx);
    return finish();
  }
  // Paid for, and then held for everybody it is aimed at who has something that answers being
  // aimed at. What it cost is spent either way: an answer that calls it off stops it from
  // happening, not from having been bought.
  const resume: RulesetActionResume = {
    kind: "action",
    actorId: working.id,
    optionId: action.id,
    targetIds: workingTargets.map((target) => target.id),
    ...(ctx.aimedAt ? { at: ctx.aimedAt } : {}),
    ...(area && choice.toward ? { toward: { x: choice.toward.x, y: choice.toward.y } } : {}),
    ...(area && choice.side ? { side: choice.side } : {}),
    ...(area && choice.ring ? { ring: true as const } : {}),
    ...(also ? { also: also.map((cell) => ({ ...cell })) } : {}),
    ...(choice.payWith !== undefined ? { payWith: choice.payWith } : {}),
    ...(styleId ? { style: styleId } : {}),
    ...(mode ? { mode: mode.id } : {}),
    ...(spend !== undefined ? { spend } : {}),
    ...(budget ? { budget } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(alters?.length ? { alters: alters.map((alter) => alter.id) } : {}),
    ...(alters?.length && picks.spared ? { spares: [...picks.spared] } : {}),
    ...(alters?.length && picks.heightened ? { heightens: picks.heightened } : {}),
  };
  // A condition that slows what its holder uses (1.120) may hold it over to their next turn.
  if (budget && delayRoll(ctx, working, action, budget)) {
    working.delayed = { ...resume, label: action.label, budget };
    noteOutcome(ctx);
    return finish();
  }
  // A paid use opens its moments before anything lands.
  reopenAction(ctx, working, action, resume);
  noteOutcome(ctx);
  return finish();
}

/** Who stands in for a wall's section while a blow is struck at it (1.200). */
const SECTION_ID = "wall-section";

/** A wall's section or a prop (1.200, 1.316) standing in as a creature for one blow or one area: its
 *  defense, its health, what it shrugs off or suffers double, on the side against whoever strikes it. */
function objectStandIn(
  id: string,
  name: string,
  striker: RulesetCombatant,
  rule: { defense: number; health: number; resist?: string[]; vulnerable?: string[]; immune?: string[] },
  health: number,
  cell: RulesetCombatCell,
): RulesetCombatant {
  return {
    id,
    name,
    side: striker.side === "party" ? "enemy" : "party",
    initiative: 0,
    initiativeRoll: [],
    initiativeModifier: 0,
    budgets: {},
    actions: [],
    uses: {},
    spent: [],
    tracked: [],
    concentrating: null,
    flags: {},
    down: false,
    dying: false,
    stable: false,
    defeated: false,
    defense: rule.defense,
    speed: 0,
    saves: {},
    block: {
      health: rule.health,
      defense: rule.defense,
      initiativeModifier: 0,
      speed: 0,
      actions: [],
      ...(rule.resist ? { resist: [...rule.resist] } : {}),
      ...(rule.vulnerable ? { vulnerable: [...rule.vulnerable] } : {}),
      ...(rule.immune ? { immune: [...rule.immune] } : {}),
    },
    health: { value: health, max: rule.health, temp: 0 },
    x: cell.x,
    y: cell.y,
    object: true,
  };
}

/** What happened to stand-ins since `from` (1.200, 1.316), taken out of the log: each one's attack roll,
 *  the damage it was dealt, and whether anything reached it at all. The rest of the log stays. */
function objectBlows(
  ctx: RulesetCombatContext,
  from: number,
  ids: string[],
): Record<string, { roll?: Extract<RulesetCombatEvent, { type: "attack" }>; dealt: number; struck: boolean }> {
  const set = new Set(ids);
  const about = (event: RulesetCombatEvent) =>
    ("targetId" in event && set.has(event.targetId ?? "")) || ("actorId" in event && set.has(event.actorId ?? ""));
  const said = ctx.events.splice(from);
  ctx.events.push(...said.filter((event) => !about(event)));
  return Object.fromEntries(
    ids.map((id) => {
      const roll = said.find(
        (event): event is Extract<RulesetCombatEvent, { type: "attack" }> =>
          event.type === "attack" && event.targetId === id,
      );
      const damage = said.filter((event) => event.type === "damage" && event.targetId === id);
      const dealt = damage.reduce((total, event) => total + (event.type === "damage" ? event.dealt : 0), 0);
      return [id, { ...(roll ? { roll } : {}), dealt, struck: roll ? roll.outcome !== "miss" : damage.length > 0 }];
    }),
  );
}

/** What a blow or an area did to a prop (1.316), written back and told: a fragile one anything reaches
 *  is broken outright. Broken, its label goes on the board's list and it stops closing its cells. */
function breakProp(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  label: string,
  prop: RulesetBoardProp,
  stand: RulesetCombatant,
  outcome: "hit" | "miss" | "critical" | "area",
  dealt: number,
  struck: boolean,
): void {
  const left = prop.fragile && struck ? 0 : Math.max(0, stand.health!.value);
  prop.health = left;
  if (left <= 0) {
    const board = ctx.state.board!;
    board.broken = [...(board.broken ?? []), prop.label];
  }
  ctx.events.push({
    type: "prop",
    actorId: actor.id,
    label,
    prop: prop.label,
    outcome,
    dealt,
    health: left,
    ...(left <= 0 ? { broken: true as const } : {}),
  });
}

/**
 * A blow struck at a wall's section (1.200), paid for as any attack is. The section stands in as a
 * creature with its defense, its health and what it shrugs off or suffers double, for that blow only;
 * the attack is made at it as at anybody, and what it took is written back to the section. Nobody's
 * answers are asked: a wall is not anybody. At 0 it is broken and stops closing its cells.
 */
function strikeSection(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const cell = choice.wall;
  const offered =
    !!cell && typeof cell === "object" && option.walls?.some((one) => one.x === cell.x && one.y === cell.y);
  if (!cell || !offered || choice.mode !== undefined) return refusal(state, choice.actorId, "bad-target", option.id);
  const at = (cells: RulesetCombatCell[]) => cells.some((one) => one.x === cell.x && one.y === cell.y);
  const found =
    rulesetStandingSections(state).some(({ section }) => at(section.cells)) ||
    rulesetStandingProps(state).some((prop) => at(prop.cells)) ||
    !!state.board?.grid.ground?.[`${cell.x},${cell.y}`]?.growth;
  if (!found) return refusal(state, choice.actorId, "bad-target", option.id);
  const own = actor.actions.find((entry) => entry.id === option.id)!;
  const styles = rulesetAttackStyles(combat, actor, own);
  if (choice.style !== undefined && !styles.some((style) => style.id === choice.style)) {
    return refusal(state, choice.actorId, "unknown-style", option.id);
  }
  const style = styles.find((one) => one.id === choice.style) ?? styles[0];
  const { ctx, finish } = begin(definition, combat, state, roller);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const action = working.actions.find((entry) => entry.id === option.id)!;
  if (option.budget) spendBudget(ctx, working, option.budget);
  countAttack(ctx, working);
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith);
  if (!paid) return refusal(state, choice.actorId, "insufficient", option.id);
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: working.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  spendAvailability(ctx, working, action);
  const standing = rulesetStandingSections(ctx.state).find(({ section }) => at(section.cells));
  const prop = standing ? undefined : rulesetStandingProps(ctx.state).find((one) => at(one.cells));
  // Growth, cut back (1.318): no roll, the square cleared.
  if (!standing && !prop) {
    const cut = rulesetClearGrowth(ctx.state.board!.grid, [cell]);
    ctx.events.push({ type: "growth", actorId: working.id, label: action.label, cells: cut, by: "cut" });
    noteOutcome(ctx);
    return finish();
  }
  const rule = standing ? standing.action.zone!.sections! : { ...prop!, health: prop!.max };
  const stand = objectStandIn(
    SECTION_ID,
    standing ? standing.zone.label : prop!.label,
    working,
    rule,
    standing ? standing.section.health : prop!.health,
    cell,
  );
  const from = ctx.events.length;
  ctx.state.combatants.push(stand);
  resolveAction(
    ctx,
    working,
    action,
    [stand],
    choice.payWith,
    undefined,
    style?.id,
    style?.spends ? working.initiative : undefined,
  );
  ctx.state.combatants = ctx.state.combatants.filter((one) => one !== stand);
  // What the blow did to the section is told as one line of its own; the rest stays as it was.
  const { roll, dealt, struck } = objectBlows(ctx, from, [SECTION_ID])[SECTION_ID]!;
  const outcome = roll?.outcome === "miss" || roll?.outcome === "critical" ? roll.outcome : "hit";
  if (prop) {
    breakProp(ctx, working, action.label, prop, stand, outcome, dealt, struck);
    noteOutcome(ctx);
    return finish();
  }
  const left = Math.max(0, stand.health!.value);
  standing!.section.health = left;
  ctx.events.push({
    type: "section",
    actorId: working.id,
    label: action.label,
    wall: standing!.zone.label,
    outcome,
    dealt,
    health: left,
    ...(left <= 0 ? { broken: true as const } : {}),
  });
  noteOutcome(ctx);
  return finish();
}

/** A bolt from the wielder to the target (1.190): everybody standing on the cells between them saves
 *  against it, and takes all, half or none of it. Off a board nobody stands between. */
function boltAlong(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  line: RulesetCombatModeLine,
  label: string,
): void {
  // Nearest cell to nearest cell (1.194).
  const from = rulesetNearestCell(actor, rulesetPositionOf(target));
  const to = rulesetNearestCell(target, from);
  if (!from || !to || !ctx.state.board?.grid) return;
  const cells = new Set(rulesetPathCells(from, to).map((cell) => `${cell.x},${cell.y}`));
  const caught = ctx.state.combatants.filter((one) => {
    // Neither end of the run is on it: the wielder and the target stand on its ends.
    if (one.id === actor.id || one.id === target.id) return false;
    return !one.defeated && rulesetFootprint(one).some((at) => cells.has(`${at.x},${at.y}`));
  });
  for (const one of caught) {
    const saved = rollSave(ctx, one, line.save.save, line.save.difficulty, actor.id, from);
    if (saved && line.save.onSuccess === "none") continue;
    const harm = rulesetCombatIsPool(ctx.combat)
      ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
          throwHarm(ctx, one, line.amount, line.type, 0),
        )
      : (() => {
          const rolls = rollRulesetDice(ctx.roll, line.amount.count, line.amount.sides);
          return { rolls, flat: line.amount.flat, amount: sumOf(rolls) + line.amount.flat };
        })();
    const dealt = applyDamage(ctx, one, {
      sourceId: actor.id,
      label,
      ...(line.type ? { damageType: line.type } : {}),
      ...harm,
      ...(saved ? { amount: Math.floor(harm.amount / 2) } : {}),
    });
    afterBlow(ctx, one, dealt, false);
  }
}

/** Whether a condition on this actor holds what they just used over to their next turn (1.120): an
 *  action out of one of its catalogs, paid with its budget, and a die at or above its number. Said
 *  either way, so the log shows the roll. */
function delayRoll(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  budget: string,
): boolean {
  const catalog = action.catalog;
  if (!catalog) return false;
  const delays = rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state)
    .map((entry) => entry.delays)
    .find((one) => one?.budget === budget && one.catalogs.includes(catalog));
  if (!delays) return false;
  const roll = ctx.roll(delays.chance.sides);
  const held = roll >= delays.chance.atLeast;
  ctx.events.push({
    type: "delay",
    actorId: actor.id,
    label: action.label,
    outcome: held ? "held" : "now",
    roll,
    needed: delays.chance.atLeast,
  });
  return held;
}

/** What a delay held over, as its maker's turn begins (1.120): completed with the budget it waits
 *  for, which goes on as it would have when made, or lost when they cannot act or have none. */
function completeDelayed(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const delayed = actor.delayed;
  if (!delayed) return;
  delete actor.delayed;
  const { label, budget, ...resume } = delayed;
  const found = actor.actions.find((entry) => entry.id === resume.optionId);
  const action = found && rulesetResumedAction(actor, found, resume.alters, resume.spares, resume.heightens);
  const effects = rulesetCombatEffects(ctx.definition, ctx.combat, actor, ctx.state);
  if (!action || !rulesetCombatStanding(actor) || effects.has("cannot-act") || (actor.budgets[budget] ?? 0) < 1) {
    ctx.events.push({ type: "delay", actorId: actor.id, label, outcome: "lost" });
    return;
  }
  spendBudget(ctx, actor, budget);
  ctx.events.push({ type: "delay", actorId: actor.id, label, outcome: "completed" });
  reopenAction(ctx, actor, action, resume);
}

/** A fresh use opens the same moments whether it was held over or a summon strikes again. */
function reopenAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
): void {
  // Used subtly (1.253), nobody sees it being used to answer it.
  const held =
    (!action.altered?.subtle &&
      openMoment(
        ctx,
        {
          kind: "used",
          sourceId: actor.id,
          optionId: action.id,
          label: action.label,
          ...(action.catalog ? { catalog: action.catalog } : {}),
          ...(action.entry ? { entry: action.entry } : {}),
        },
        ctx.state.combatants,
        resume,
      )) ||
    openAimed(ctx, resume, action.label, action.catalog, action.entry);
  if (!held) resumeAction(ctx, resume);
}

/**
 * One signature action, bought with the actor's own points. It spends no budget and takes no turn:
 * it is what a creature does while somebody else is acting, which is why the actor whose turn it is
 * has none to spend. The window between two turns is where it is offered (`openSignatureWindow`);
 * the price, the refusals and the resolution are all here.
 */
/**
 * One contest: both sides throw the fight's own attack dice and add the best check they may use here;
 * the higher total wins and a tie goes where the contest says. Winning ends, applies and
 * pushes what the contest names, in that order, with the winner as the source of what it applies, so
 * a hold ends when the holder goes down. Losing does nothing at all, which is what a failed grab is.
 */
/** One side of a contest, or a check of its own (1.287: Stealth, Perception), thrown as its
 *  maker's conditions say: twice with one kept, and whatever they add rolled after the dice. */
function throwCheck(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  check: string,
  modifier: number,
  /** What whoever it is made against puts on it (1.290): a Cloak of Elvenkind on a Search. */
  taken?: { advantage: boolean; disadvantage: boolean },
): RulesetContestSide {
  // What is narrowed to the ability the check is made with counts (1.188): Rage's Strength. And,
  // since 1.290, what is narrowed to the skill it is read off: Stealth in heavy armor.
  const ability = rulesetCheckAbility(ctx.definition, check);
  const skill = rulesetCheckSkill(ctx.definition, check);
  const mode = rulesetCheckMode(ctx.definition, ctx.combat, who, ctx.state, skill, ability, taken);
  const checkModifiers = () =>
    rulesetConditionModifiers(ctx.definition, ctx.combat, who, "checks", ctx.state, skill, undefined, ability);
  if (rulesetCombatIsSymbol(ctx.combat)) {
    // Each side throws its own dice and the more net successes wins (1.382).
    const bonuses = rollBonuses(ctx, checkModifiers());
    const thrown = throwSymbols(ctx, who, modifier, bonusTotal(bonuses), mode);
    return {
      check,
      rolls: thrown.rolls,
      modifier,
      total: thrown.successes,
      ...(mode === "normal" ? {} : { mode }),
      ...(bonuses.length > 0 ? { bonuses } : {}),
      pool: symbolRecord(thrown),
    };
  }
  if (rulesetCombatIsPool(ctx.combat)) {
    const bonuses = rollBonuses(ctx, checkModifiers());
    const pool = throwPool(ctx, who, modifier + bonusTotal(bonuses), mode);
    return {
      check,
      rolls: pool.rolls,
      modifier,
      total: pool.botch ? 0 : pool.successes,
      ...(mode === "normal" ? {} : { mode }),
      ...(bonuses.length > 0 ? { bonuses } : {}),
      pool: poolRecord(pool),
    };
  }
  const { count, sides } = ctx.combat.attackRoll!.dice;
  const first = rollRulesetDice(ctx.roll, count, sides);
  const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, count, sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  const bonuses = rollBonuses(ctx, checkModifiers());
  return {
    check,
    rolls: second ? [...first, ...second] : first,
    modifier,
    total: kept + modifier + bonusTotal(bonuses),
    ...(mode === "normal" ? {} : { mode }),
    ...(bonuses.length > 0 ? { bonuses } : {}),
  };
}

function resolveContest(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  contest: NonNullable<RulesetCombatAction["contest"]>,
  target: RulesetCombatant,
): void {
  // Each side thrown as its own conditions say: twice with one kept, and whatever they add rolled
  // after the dice. A side nothing leans or adds to is written exactly as it always was. In a pool
  // fight each side throws its check as a pool and the one with more net successes wins.
  const thrown = (who: RulesetCombatant, check: string, modifier: number) => throwCheck(ctx, who, check, modifier);
  const mine = rulesetContestCheck(actor, contest, "attacker");
  const attacker = thrown(actor, mine.check, mine.modifier);
  // Breaking free of a hold that names its escape DC (1.103): nobody throws for the holder, and the
  // actor wins on meeting the number.
  const escapeDc = rulesetEscapeDc(actor, contest);
  const theirs = escapeDc === undefined ? rulesetContestCheck(target, contest, "defender") : null;
  const defender = theirs
    ? thrown(target, theirs.check, theirs.modifier)
    : { check: "", rolls: [], modifier: escapeDc!, total: escapeDc! };
  // The side falling short adds what it holds back until then (1.249), on the fight's own dice only.
  const actorTies = escapeDc !== undefined || contest.ties === "attacker";
  const rescue = (who: RulesetCombatant, side: RulesetContestSide, short: number) => {
    if (side.pool || side.rolls.length === 0 || short <= 0) return;
    const ability = rulesetCheckAbility(ctx.definition, side.check);
    const added = rescueBonuses(
      ctx,
      who,
      "checks",
      rulesetConditionModifiers(
        ctx.definition,
        ctx.combat,
        who,
        "checks",
        ctx.state,
        undefined,
        undefined,
        ability,
        true,
      ),
      short,
    );
    if (added.length === 0) return;
    side.bonuses = [...(side.bonuses ?? []), ...added];
    side.total += bonusTotal(added);
  };
  rescue(actor, attacker, defender.total - attacker.total + (actorTies ? 0 : 1));
  if (theirs) rescue(target, defender, attacker.total - defender.total + (actorTies ? 1 : 0));
  const actorWins = () => attacker.total > defender.total || (attacker.total === defender.total && actorTies);
  // The winning side's check, as it is made, has dice taken off by the other side where that could
  // turn it (1.257): Cutting Words. A fixed number is nobody's roll.
  const lowered = (who: RulesetCombatant, side: RulesetContestSide, still: (total: number) => boolean) => {
    if (side.pool || side.rolls.length === 0) return;
    const by = lowerRoll(ctx, who, "checks", action.label, side.total, (most) => !still(side.total - most));
    side.total -= by;
  };
  if (actorWins())
    lowered(actor, attacker, (total) => total > defender.total || (total === defender.total && actorTies));
  else if (theirs)
    lowered(target, defender, (total) => total > attacker.total || (total === attacker.total && !actorTies));
  let winner: "actor" | "target" = actorWins() ? "actor" : "target";
  // The side that lost spends what turns a failed check into a success (1.249): Stroke of Luck.
  if (winner === "target" && rescueEntry(ctx, actor, "checks", "success")) winner = "actor";
  else if (winner === "actor" && theirs && rescueEntry(ctx, target, "checks", "success")) winner = "target";
  // Or counts its d20 as a 20, where that wins it (1.256): Stroke of Luck. A pool has no d20.
  const asTwenty = (who: RulesetCombatant, side: RulesetContestSide, wins: (total: number) => boolean) => {
    if (side.pool || side.rolls.length === 0 || rulesetCombatIsPool(ctx.combat) || rulesetCombatIsSymbol(ctx.combat))
      return false;
    const kept = side.total - side.modifier - bonusTotal(side.bonuses ?? []);
    const total = side.total - kept + 20;
    if (!rescueEntry(ctx, who, "checks", "twenty", () => wins(total))) return false;
    side.total = total;
    return true;
  };
  if (
    winner === "target" &&
    asTwenty(actor, attacker, (total) => total > defender.total || (total === defender.total && actorTies))
  ) {
    winner = "actor";
  } else if (
    winner === "actor" &&
    theirs &&
    asTwenty(target, defender, (total) => total > attacker.total || (total === attacker.total && !actorTies))
  ) {
    winner = "target";
  }
  ctx.events.push({
    type: "contest",
    actorId: actor.id,
    targetId: target.id,
    optionId: action.id,
    label: action.label,
    attacker,
    defender,
    // A fixed number nobody holds (1.193) is the contest's own difficulty, not an escape.
    ...(escapeDc !== undefined ? (contest.from ? { escapeDc } : { difficulty: escapeDc }) : {}),
    winner,
  });
  if (winner !== "actor") return;
  for (const entry of contest.ends ?? []) {
    const on = entry.on === "actor" ? actor : target;
    if (rulesetCombatConditions(ctx.definition, on).includes(entry.condition)) {
      removeCondition(ctx, on, entry.condition, "contest");
    }
  }
  for (const entry of contest.applies ?? []) {
    applyConditionId(
      ctx,
      target,
      entry.condition,
      { condition: entry.condition, duration: entry.rounds !== undefined ? { rounds: entry.rounds } : "instant" },
      { sourceId: actor.id },
    );
  }
  if (contest.push !== undefined) pushTarget(ctx, actor, target, contest.push);
  // Treated in time (1.193): the DC 10 Medicine check that keeps the dying from dying.
  if (contest.stabilizes && target.dying && !target.stable && !target.defeated) {
    target.stable = true;
    clearDyingTracks(ctx, target);
    ctx.events.push({ type: "stabilized", targetId: target.id, sourceId: actor.id });
  }
}

/** Somebody pushed `cells` straight away from `actor`, as far as the way allows: by a contest won
 *  (combat C6b) or by an action that lands (1.182). */
function pushTarget(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant, cells: number): void {
  const path = rulesetPushPath(ctx.state, actor.id, target.id, cells);
  const from = rulesetPositionOf(target);
  const to = path[path.length - 1];
  if (!from || !to) return;
  target.x = to.x;
  target.y = to.y;
  ctx.events.push({ type: "pushed", actorId: actor.id, targetId: target.id, from, to: { ...to }, path });
  // Shoved off a step of two levels or more, which is where a push stops: a fall (combat C6b).
  const grid = ctx.state.board?.grid;
  const edge = path.length > 1 ? path[path.length - 2]! : from;
  const levels = grid ? elevationAt(grid, edge.x, edge.y) - elevationAt(grid, to.x, to.y) : 0;
  if (levels >= 2) fall(ctx, actor, target, levels);
}

/** Somebody spending `spends` to walk up to their speed toward `actor` (1.326), by the shortest
 *  open way to the cell that brings them nearest, drawing no strikes: The Owed's Whisper a Name.
 *  Nothing is spent by somebody who has none of it left, or who could come no nearer. */
function drawTarget(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  spends: string,
): void {
  const grid = ctx.state.board?.grid;
  const from = rulesetPositionOf(target);
  if (!grid || !from || (target.budgets[spends] ?? 0) < 1) return;
  const left = target.movementLeft;
  target.movementLeft = rulesetMovementAllowance(ctx.definition, ctx.combat, target);
  const ways = rulesetReachableCells(ctx.definition, ctx.state, target.id);
  if (left === undefined) delete target.movementLeft;
  else target.movementLeft = left;
  const near = rulesetWalkingDistances(grid, rulesetFootprint(actor));
  const distance = (cell: RulesetCombatCell) => near.get(`${cell.x},${cell.y}`) ?? Number.POSITIVE_INFINITY;
  // Nearest by the walk, then as the crow flies, then the cheaper way there.
  const centre = rulesetPositionOf(actor)!;
  const crow = (cell: RulesetCombatCell) => (cell.x - centre.x) ** 2 + (cell.y - centre.y) ** 2;
  let best: RulesetReachableCell | undefined;
  for (const way of ways) {
    if (
      !best ||
      distance(way) < distance(best) ||
      (distance(way) === distance(best) &&
        (crow(way) < crow(best) || (crow(way) === crow(best) && way.cost < best.cost)))
    ) {
      best = way;
    }
  }
  if (!best || distance(best) >= distance(from)) return;
  target.budgets[spends] = (target.budgets[spends] ?? 0) - 1;
  target.x = best.x;
  target.y = best.y;
  ctx.events.push({
    type: "drawn",
    actorId: actor.id,
    targetId: target.id,
    from,
    to: { x: best.x, y: best.y },
    path: best.path.map((cell) => ({ x: cell.x, y: cell.y })),
  });
}

/**
 * A fall of `levels` levels (combat C6b), by the ruleset's `elevation.falling`: its dice for every `per`
 * of the drop, at most `max` of them, of its type, and its prone condition after. A ruleset that says
 * nothing about falling only notes it.
 */
function fall(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant, levels: number): void {
  if (target.object) return;
  const resume = { kind: "fall" as const, actorId: actor.id, targetId: target.id, levels };
  if (ctx.falling) {
    ctx.falling.push(resume);
    return;
  }
  // An area can ground several fliers while its first fall is held. Each gets its own moment.
  if (ctx.state.window) {
    const answers = ctx.state.combatants.some(
      (one) => rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, one, "falls", target.id).length > 0,
    );
    if (answers) (ctx.state.pendingFalls ??= []).push(resume);
    else landFall(ctx, actor, target, levels);
    return;
  }
  if (openMoment(ctx, { kind: "falls", sourceId: target.id, label: "fall", levels }, ctx.state.combatants, resume)) {
    return;
  }
  landFall(ctx, actor, target, levels);
}

/** One blow or effect may drop several creatures; an answer never borrows a later event's fallers. */
function fallTogether(ctx: RulesetCombatContext, falling: RulesetFallResume[]): void {
  const first = falling[0];
  const targetIds = falling.map((one) => one.targetId);
  const several =
    falling.length > 1 &&
    ctx.state.combatants.some((one) =>
      rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, one, "falls", first!.targetId, { targetIds }).some(
        (answer) => answer.targets.count > 1,
      ),
    );
  if (first && several) {
    const resume = { ...first, others: falling.slice(1) };
    if (ctx.state.window) {
      (ctx.state.pendingFalls ??= []).push(resume);
      return;
    }
    if (
      openMoment(
        ctx,
        { kind: "falls", sourceId: first.targetId, label: "fall", levels: first.levels, fallerIds: targetIds },
        ctx.state.combatants,
        resume,
      )
    )
      return;
  }
  for (const one of falling) {
    const maker = rulesetCombatant(ctx.state, one.actorId);
    const target = rulesetCombatant(ctx.state, one.targetId);
    if (maker && target) fall(ctx, maker, target, one.levels);
  }
}

/** A fall waiting for its moment keeps a later hit from replacing that window. */
function hasFallingAnswer(ctx: RulesetCombatContext): boolean {
  return !!ctx.falling?.some((fall) =>
    ctx.state.combatants.some(
      (one) => rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, one, "falls", fall.targetId).length > 0,
    ),
  );
}

function landFall(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant, levels: number): void {
  ctx.events.push({ type: "fell", targetId: target.id, levels });
  if (rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) => entry.fallsSafely)) return;
  const elevation = ctx.combat.elevation;
  const falling = elevation?.falling;
  if (!elevation || !falling) return;
  const count = Math.min(falling.max, Math.floor((levels * elevation.levelHeight) / falling.per) * falling.dice.count);
  if (count > 0) {
    // Thrown as the system throws harm: a pool's successes, soak taken off, or else the dice added up.
    const harm = rulesetCombatIsPool(ctx.combat)
      ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
          throwHarm(ctx, target, { count, sides: falling.dice.sides, flat: 0 }, falling.type, 0),
        )
      : (() => {
          const rolls = rollRulesetDice(ctx.roll, count, falling.dice.sides);
          return { rolls, flat: 0, amount: sumOf(rolls) };
        })();
    const dealt = applyDamage(ctx, target, {
      sourceId: actor.id,
      label: "fall",
      ...(falling.type ? { damageType: falling.type } : {}),
      ...harm,
    });
    // As any blow is followed: going down, concentration, what damage ends.
    afterBlow(ctx, target, dealt, false);
  }
  if (falling.prone && rulesetCombatStanding(target)) {
    applyConditionId(
      ctx,
      target,
      falling.prone,
      { condition: falling.prone, duration: "instant" },
      { sourceId: actor.id },
    );
  }
}

/** The outcome, said once. The window path ends a fight in more than one place, and a log that
 *  said so twice would read as two endings. */
function noteOutcome(ctx: RulesetCombatContext): void {
  const outcome = rulesetEncounterOutcome(ctx.state);
  if (outcome === "ongoing") return;
  if (ctx.events[ctx.events.length - 1]?.type === "outcome") return;
  pushOutcome(ctx, outcome);
}

/** The fight is over: whatever it lifts as it ends, then the outcome. Every way a fight ends says so
 *  through here, so none of them leaves anybody crashed. */
function pushOutcome(ctx: RulesetCombatContext, outcome: Exclude<RulesetEncounterOutcome, "ongoing">): void {
  rollOutCountedSaves(ctx);
  ctx.events.push(...liftRulesetFightEffects(ctx.definition, ctx.state));
  // Only a party that won holds the field long enough to pick up what it shot.
  if (outcome === "victory") ctx.events.push(...recoverRulesetAmmo(ctx.state));
  ctx.events.push({ type: "outcome", outcome });
}

/** How Held Ground lets go in a running fight (1.330). */
export interface RulesetHeldGroundRelease {
  /** What becomes of the felled: they die (the default), or a character goes down as anywhere else,
   *  dying by the ruleset's own rule. */
  felled?: "die" | "down";
  /** What comes due: each mark on `track` (Held Ground's first marked track when not said) costs one
   *  of the ruleset's dying saves, `bonus` added to each, and the marks are spent. */
  owing?: { track?: string; bonus?: number };
}

/**
 * Held Ground let go in the middle of a fight (1.330): the year turns. From here whoever reaches no
 * health dies or goes down as anywhere else; the felled die (or go down, dying); and each character's
 * marks come due, one dying save a mark, rolled until they run out or the count is decided. The
 * Held Autumn's last roll. A fight not on Held Ground is handed back as it was.
 */
export function rulesetReleaseHeldGround(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
  release: RulesetHeldGroundRelease = {},
): RulesetCombatStep {
  const combat = definition.combat;
  const held = state.heldGround;
  if (!combat || !held || rulesetEncounterOutcome(state) !== "ongoing") return { state, events: [] };
  const { ctx, finish } = begin(definition, combat, state, roller);
  delete ctx.state.heldGround;
  const died: string[] = [];
  const down: string[] = [];
  for (const target of ctx.state.combatants) {
    if (!target.felled || target.reaped || target.object) continue;
    if (release.felled === "down" && target.side !== "enemy") {
      // Down as anywhere else: dying, the count from nothing.
      delete target.felled;
      target.down = true;
      target.stable = false;
      target.dying = !!combat.dying;
      clearDyingTracks(ctx, target);
      down.push(target.id);
      continue;
    }
    if (!target.defeated) {
      target.defeated = true;
      target.diedRound = ctx.state.round;
    }
    target.dying = false;
    target.stable = false;
    died.push(target.id);
  }
  ctx.events.push({
    type: "heldGroundReleased",
    ...(held.label ? { label: held.label } : {}),
    died,
    ...(down.length ? { down } : {}),
  });
  const dying = combat.dying;
  const track = release.owing ? (release.owing.track ?? held.marks?.[0]?.track) : undefined;
  if (dying && track) {
    const bonus = Math.trunc(release.owing?.bonus ?? 0);
    for (const target of ctx.state.combatants) {
      if (target.side === "enemy" || !target.sheet || target.defeated) continue;
      const marks = trackValue(ctx, target, track);
      if (marks <= 0) continue;
      const wasDying = target.dying;
      const rolls: number[] = [];
      let result: "dead" | "safe" = "safe";
      for (let mark = 0; mark < marks; mark++) {
        const thrown = rollRulesetDice(ctx.roll, dying.dice.count, dying.dice.sides);
        const kept = sumOf(thrown);
        rolls.push(kept);
        const single = dying.dice.count === 1;
        const top = single && kept === dying.dice.sides;
        const bottom = single && kept === 1;
        let failures = 0;
        if (bottom && dying.naturals.min === "two-failures") failures = 2;
        else if (bottom && dying.naturals.min === "one-failure") failures = 1;
        else if (!(top && dying.naturals.max !== "none") && kept + bonus < dying.succeedAt) failures = 1;
        if (failures > 0) {
          writeRulesetSheet(ctx.definition, target, { op: "track", track: dying.failures, by: failures });
          if (trackValue(ctx, target, dying.failures) >= trackMax(ctx, target, dying.failures)) {
            result = "dead";
            break;
          }
        } else {
          writeRulesetSheet(ctx.definition, target, { op: "track", track: dying.successes, by: 1 });
          if (trackValue(ctx, target, dying.successes) >= trackMax(ctx, target, dying.successes)) break;
        }
      }
      const successes = trackValue(ctx, target, dying.successes);
      const failures = trackValue(ctx, target, dying.failures);
      moveTrack(ctx, target, target, track, -marks);
      if (result === "dead") {
        target.defeated = true;
        target.dying = false;
        target.stable = false;
        target.diedRound = ctx.state.round;
        endSummons(ctx, target);
        endZones(ctx, target);
        unconjureAll(ctx, target);
        endConcentration(ctx, target, "down");
      } else if (!wasDying) clearDyingTracks(ctx, target);
      else if (successes >= trackMax(ctx, target, dying.successes)) {
        // Down and dying, and the count decided: stable.
        target.stable = true;
        clearDyingTracks(ctx, target);
      }
      ctx.events.push({ type: "owing", actorId: target.id, rolls, bonus, successes, failures, result });
    }
  }
  noteOutcome(ctx);
  return finish();
}

/**
 * A fight the party walked away from (1.260): counted saves still to make are rolled out, as
 * `pushOutcome` does for every other ending, then what only meant something inside it comes off.
 * Returns the state it leaves, with its cursor past the dice it rolled.
 */
export function settleRulesetFledFight(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const combat = definition.combat;
  if (!combat) return { state, events: liftRulesetFightEffects(definition, state) };
  const { ctx, finish } = begin(definition, combat, state, roller);
  rollOutCountedSaves(ctx);
  ctx.events.push(...liftRulesetFightEffects(definition, ctx.state));
  return finish();
}

/**
 * What only meant something inside the fight comes off once it is over, however it ended, because
 * left on a sheet it would outlast the fight it belonged to:
 * - nobody is crashed: the number attacks move means nothing outside a fight;
 * - a condition the fight put on with a clock, one that ends after a use, and one somebody's
 *   concentration holds (Bless, Haste, the lethargy Haste leaves): the fight's rounds stop counting,
 *   so nothing would ever take it off. What one leaves behind as it ends (`onEnd`) is not put on,
 *   since the fight it belonged to is over, and the concentration that held it ends with it.
 * A condition with no clock (a fall's prone, a dying one) stays: it ends as it always did. Returns
 * what came off, for a log that is still being written.
 */
export function liftRulesetFightEffects(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): RulesetCombatEvent[] {
  const crash = definition.combat?.initiative.resource?.crash?.condition;
  const concentration = definition.combat?.concentration;
  const events: RulesetCombatEvent[] = [];
  const lift = (combatant: RulesetCombatant, condition: string, reason: "recovered" | "expired" | "linked") => {
    if (!combatant.tracked.some((entry) => entry.condition === condition) && reason === "linked") return;
    combatant.tracked = combatant.tracked.filter((entry) => entry.condition !== condition);
    if (combatant.sheet) writeRulesetSheet(definition, combatant, { op: "condition", condition, active: false });
    events.push({ type: "condition", targetId: combatant.id, condition, active: false, reason });
    // What was put on to last only as long as it goes with it (1.202), clock or none.
    for (const entry of [...combatant.tracked])
      if (entry.endsWith === condition) lift(combatant, entry.condition, "linked");
  };
  for (const combatant of state.combatants) {
    const dazed = combatant.dazed;
    delete combatant.dazed;
    if (dazed?.condition) lift(combatant, dazed.condition, "expired");
    // What an aura spread or the fight kept on (1.263) was never on a sheet, so it simply goes.
    if (combatant.tracked.some((entry) => entry.aura || entry.kept)) {
      combatant.tracked = combatant.tracked.filter((entry) => !entry.aura && !entry.kept);
    }
    if (combatant.crashedTurns !== undefined) {
      delete combatant.crashedTurns;
      if (crash && rulesetCombatConditions(definition, combatant).includes(crash)) lift(combatant, crash, "recovered");
    }
    for (const entry of [...combatant.tracked]) {
      if (!combatant.tracked.includes(entry)) continue;
      if (entry.rounds !== null || entry.endsAfter || entry.endsWhenHolder || entry.concentration) {
        lift(combatant, entry.condition, "expired");
        // A clock the fight's end lets run out turns into what it `expires` into (1.261).
        const becomes =
          entry.rounds !== null
            ? definition.combat?.conditions?.find((one) => one.condition === entry.condition)?.expires?.becomes
            : undefined;
        if (
          becomes &&
          !combatant.defeated &&
          !rulesetImmuneToCondition(combatant, becomes, definition, state) &&
          !combatant.tracked.some((one) => one.condition === becomes)
        ) {
          combatant.tracked.push({
            condition: becomes,
            rounds: null,
            ...(entry.source ? { source: entry.source } : {}),
          });
          if (combatant.sheet)
            writeRulesetSheet(definition, combatant, { op: "condition", condition: becomes, active: true });
          events.push({
            type: "condition",
            targetId: combatant.id,
            condition: becomes,
            active: true,
            reason: "applied",
          });
        }
      }
    }
    if (combatant.concentrating) {
      combatant.concentrating = null;
      if (concentration && combatant.sheet) {
        writeRulesetSheet(definition, combatant, { op: "note", field: concentration.text, value: "" });
      }
    }
  }
  return events;
}

/**
 * One answer to the open window, from the one combatant it is asking. Anybody else is refused: a
 * window is not a free-for-all, and an answer that arrived while somebody else was still being
 * asked would spend a budget against a fight that had already moved.
 */
function applyInWindow(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  // An answer that names a window is checked against the open one. One that names none is taken as
  // meant for whatever is open, which is how a caller that never saves an answer may stay simple.
  if (choice.window !== undefined && choice.window !== window.id) {
    return refusal(state, choice.actorId, "stale-window", choice.optionId);
  }
  if (window.waiting[0] !== actor.id) return refusal(state, choice.actorId, "window-open", choice.optionId);

  if (choice.optionId === RULESET_PASS_OPTION) {
    const { ctx, finish } = begin(definition, combat, state, roller);
    ctx.events.push({ type: "pass", actorId: actor.id, window: window.id });
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }

  const option = rulesetWindowOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!option) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  if (window.kind === "spend" && option.symbolSpend) {
    return chooseSymbolSpend(definition, combat, state, actor, option.symbolSpend, roller);
  }
  // A lair action (1.315), resolved as its maker's own turn would resolve it.
  if (window.kind === "signature" && option.lairOf) {
    return takeLairAction(definition, combat, state, window, actor, option.lairOf, choice, roller);
  }
  // A spell cast with points (1.284), resolved as its maker's own turn would resolve it.
  if (window.kind === "signature" && option.castOf) {
    return castWithPoints(definition, combat, state, window, actor, option.castOf, choice, roller);
  }
  if (window.kind === "signature") {
    const action = actor.actions.find((entry) => entry.id === choice.optionId && entry.signature);
    if (!action) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
    return applySignature(definition, combat, state, actor, action, choice, roller);
  }

  const trigger = window.trigger;
  // What its holder readied, now that it has happened (1.288).
  if (trigger.kind === "readied" && option.readied) {
    return releaseReadied(definition, combat, state, window, actor, choice, roller);
  }
  // A strike at somebody walking away, taken rather than made for them. It costs and resolves
  // exactly as the automatic one did: the same budget, the same books, the same dice.
  if (trigger.kind === "leaves-reach") {
    const { ctx, finish } = begin(definition, combat, state, roller);
    const striker = rulesetCombatant(ctx.state, actor.id)!;
    const mover = rulesetCombatant(ctx.state, trigger.moverId);
    if (!mover || !opportunityStrike(ctx, striker, mover, combat.opportunity!.budget)) goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }
  if (trigger.kind === "between-turns") return refusal(state, choice.actorId, "unknown-option", choice.optionId);

  // A reaction taken at its own moment. It is an ordinary action, paid for and resolved exactly as
  // it would be on a turn; the only thing the moment adds is whom it is aimed at, and whether
  // taking it calls off what the window was holding.
  return takeReaction(definition, combat, state, window, actor, choice, roller);
}

/** One choice of what a symbol throw buys (1.382): one more of a spend, asked again while there is
 *  more to buy, or the Engine's pick for the rest, which ends the asking. Nothing is spent until the
 *  window closes: the throw is then spent as it was chosen, exactly as the Engine's pick would be. */
function chooseSymbolSpend(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  choice: NonNullable<RulesetCombatOption["symbolSpend"]>,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const { ctx, finish } = begin(definition, combat, state, roller);
  const open = ctx.state.window!;
  const held = open.resume?.kind === "action" ? open.resume.held : undefined;
  if (open.trigger.kind !== "spend" || !held) return refusal(state, actor.id, "unknown-option", RULESET_PASS_OPTION);
  const list = ((held.roll.spends ??= {})[open.trigger.by] ??= []);
  const add = (spend: string, times: number) => {
    const known = list.find((one) => one.spend === spend);
    if (known) known.times += times;
    else list.push({ spend, times });
  };
  if (choice.engine) {
    for (const pick of choice.picks ?? []) add(pick.spend, pick.times);
  } else if (choice.spend) {
    add(choice.spend, 1);
    if (rulesetWindowOptions(definition, ctx.state, actor.id).some((one) => one.symbolSpend?.spend)) {
      noteOutcome(ctx);
      return finish();
    }
  }
  goOn(definition, combat, ctx);
  noteOutcome(ctx);
  return finish();
}

/** One reaction, taken at the moment it waits for. */
function takeReaction(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const trigger = window.trigger;
  if (
    trigger.kind !== "aimed" &&
    trigger.kind !== "hit" &&
    trigger.kind !== "harmed" &&
    trigger.kind !== "used" &&
    trigger.kind !== "falls" &&
    trigger.kind !== "turn-start"
  ) {
    return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  }
  const declared = actor.actions.find((entry) => entry.id === choice.optionId && entry.reaction);
  const offered = rulesetWindowOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!declared || !offered) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  // Filled in rather than picked, unless the entry says its holder picks: aimed back at whoever
  // caused the moment, or, for something its holder does to THEMSELVES, at its holder. Bracing
  // yourself is not aimed at anybody, and pointing it at whoever hurt you would hand them what it
  // gives. A falling moment always points at the faller, even when the entry otherwise asks.
  const about = rulesetReactionTarget(state, actor, declared, trigger.kind, trigger.sourceId, {
    ...("targetIds" in trigger ? { targetIds: trigger.targetIds } : {}),
    ...("catalog" in trigger ? { catalog: trigger.catalog } : {}),
    ...("entry" in trigger ? { entry: trigger.entry } : {}),
    ...("optionId" in trigger &&
    rulesetCombatant(state, trigger.sourceId)?.block &&
    !("catalog" in trigger && trigger.catalog)
      ? { action: trigger.label }
      : {}),
    ...(trigger.kind === "hit" ? { blow: trigger.blow } : {}),
    ...(trigger.kind === "hit" && trigger.weapon ? { weapon: true } : {}),
    ...(trigger.kind === "hit" && !trigger.catalog ? { attack: trigger.label } : {}),
    ...(trigger.kind === "hit" && trigger.budget ? { budget: trigger.budget } : {}),
    ...(trigger.kind === "hit" ? rulesetHitItem(trigger.optionId) : {}),
  });
  const source = rulesetCombatant(state, declared.reaction?.at === "target" ? (about ?? actor.id) : trigger.sourceId);
  let targets: RulesetCombatant[] | RulesetCombatRefusal;
  if (trigger.kind === "falls" && declared.targets.count > 1) {
    const fallers = rulesetFallTargets(definition, state, actor, declared);
    const picked = choice.targetIds.length ? choice.targetIds : fallers.slice(0, declared.targets.count);
    targets =
      picked.length > 0 &&
      picked.length <= declared.targets.count &&
      new Set(picked).size === picked.length &&
      picked.every((id) => fallers.includes(id))
        ? picked.map((id) => rulesetCombatant(state, id)!)
        : "bad-target";
  } else if (declared.reaction?.at === "target") {
    targets = source ? [source] : "bad-target";
  } else if (trigger.kind !== "falls" && !rulesetReactionPointsAtSource(declared)) {
    targets =
      declared.targets.side === "self" ? [actor] : pickTargets(definition, state, actor, declared, choice.targetIds);
  } else {
    // The menu just checked the source, its side, range and the moment's own narrowing.
    targets = source ? [source] : "bad-target";
  }
  if (!Array.isArray(targets)) return refusal(state, choice.actorId, targets, choice.optionId);

  // The menu is the only source of legality here as well: a pool it did not offer is refused as the
  // wrong pool, and before anything is spent rather than after.
  if (choice.payWith !== undefined && !(offered.payWith ?? []).includes(choice.payWith)) {
    return refusal(state, choice.actorId, "bad-pool", choice.optionId);
  }

  const { ctx, finish } = begin(definition, combat, state, roller);
  const taking = rulesetCombatant(ctx.state, actor.id)!;
  // More of an item's charges (1.273), spent on its own hit.
  const moreCharges = rulesetChargeSteps(declared, choice.payWith);
  if (moreCharges) ctx.moreCharges = moreCharges;
  const action = taking.actions.find((entry) => entry.id === declared.id)!;
  // The OPTION says whether a budget is spent, exactly as it does on a turn: an entry marked free
  // carries none, and reading the action's own budget would refuse it for want of something it
  // never asked for.
  const budget = offered.budget;
  if (budget !== undefined) {
    if ((taking.budgets[budget] ?? 0) < 1) return refusal(state, choice.actorId, "no-budget", choice.optionId);
    spendBudget(ctx, taking, budget);
  }
  const paid = planRulesetCombatCost(definition, taking, action, choice.payWith);
  if (!paid) return refusal(state, choice.actorId, "insufficient", choice.optionId);
  if (paid.live && taking.sheet) taking.sheet.live = paid.live;
  countRulesetSpend(taking, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: taking.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  spendAvailability(ctx, taking, action);
  const cancelSave = action.reaction?.cancelSave;
  if (cancelSave && !rollSave(ctx, taking, cancelSave.save, cancelSave.dc, trigger.sourceId)) {
    // A reaction is acting too (1.308): One with Shadows ends on it, as on one resolved in full.
    stirs(ctx, taking, "acted");
    holderActed(ctx, taking, action);
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }
  // Calling it off happens BEFORE this one's own dice: what was held never lands, so nothing it
  // would have done can change what this reaction is resolved against.
  if (
    action.reaction?.cancels &&
    ctx.state.window?.resume?.kind === "action" &&
    reachesHeld(ctx, taking, action, choice.payWith, ctx.state.window.resume)
  ) {
    const stopped = ctx.state.window.resume;
    stopped.cancelled = true;
    // Nobody else is asked: the question was what to do about something that is now not going to
    // happen. Withdrawing it is not the same as everybody passing, so no moment is let go either;
    // the rest simply keep what they were holding.
    ctx.state.window.waiting = [];
    ctx.events.push({
      type: "cancelled",
      actorId: stopped.actorId,
      optionId: stopped.optionId,
      label: trigger.kind === "aimed" || trigger.kind === "used" ? trigger.label : action.label,
      byId: taking.id,
    });
  }
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);
  // A hit's own maker is asked again while they hold more for it (1.241); a pass lets it go on.
  const answered = () => {
    const open = ctx.state.window;
    if (trigger.kind === "hit" && trigger.sourceId === taking.id && open?.waiting[0] === taking.id) {
      (open.taken ??= []).push(action.id);
      // The rest of its answers sharing a name with this one are spent with it (1.248).
      const group = action.reaction?.oneOf;
      if (group) {
        for (const other of taking.actions)
          if (other.reaction?.oneOf === group && !open.taken.includes(other.id)) open.taken.push(other.id);
      }
      if (
        rulesetEncounterOutcome(ctx.state) === "ongoing" &&
        rulesetWindowOptions(definition, ctx.state, taking.id).length > 0
      )
        return;
    }
    goOn(definition, combat, ctx);
  };
  const holding = ctx.state.window?.resume;
  // Taken off somebody else's roll that hit, before it is checked again (1.250): Cutting Words.
  if (action.lowersRoll && trigger.kind === "hit" && holding?.kind === "action" && holding.held) {
    const lowers = action.lowersRoll;
    const rolls = rollRulesetDice(ctx.roll, lowers.count, lowers.sides);
    const by = sumOf(rolls) + lowers.flat;
    const roll = holding.held.roll;
    roll.total -= by;
    roll.lowered = (roll.lowered ?? 0) + by;
    ctx.events.push({
      type: "lowered",
      actorId: taking.id,
      targetId: trigger.sourceId,
      label: action.label,
      to: trigger.label,
      rolls,
      by,
      total: roll.total,
    });
    // A reaction is acting too (1.308): One with Shadows ends on it, as on one resolved in full.
    stirs(ctx, taking, "acted");
    holderActed(ctx, taking, action);
    answered();
    noteOutcome(ctx);
    return finish();
  }
  // Added to its holder's own blow, held where it hit (1.241): rolled as that blow lands.
  if (
    action.addsToBlow &&
    action.damage &&
    trigger.kind === "hit" &&
    trigger.sourceId === taking.id &&
    holding?.kind === "action" &&
    holding.held
  ) {
    const steps = choice.payWith ? rulesetCostSteps(definition, action, choice.payWith, taking) : 0;
    // A higher payment's dice, or a charge more's (1.273).
    const stepAmount = action.use?.perCostStep ?? action.itemUse?.charges?.step?.amount;
    const { alternatives: _alternatives, ...damage } = structuredClone(action.damage);
    (holding.held.adds ??= []).push({
      label: action.label,
      damage,
      ...(stepAmount && steps > 0 ? { extra: { amount: { ...stepAmount }, times: steps } } : {}),
      ...(action.onHit?.length ? { onHit: structuredClone(action.onHit) } : {}),
    });
    ctx.events.push({
      type: "added",
      actorId: taking.id,
      targetId: holding.held.targetId,
      label: action.label,
      to: trigger.label,
    });
    // A reaction is acting too (1.308): One with Shadows ends on it, as on one resolved in full.
    stirs(ctx, taking, "acted");
    holderActed(ctx, taking, action);
    answered();
    noteOutcome(ctx);
    return finish();
  }
  resolveAction(ctx, taking, action, workingTargets, choice.payWith);
  answered();
  noteOutcome(ctx);
  return finish();
}

/**
 * Whether an answer that cancels reaches what it answers (1.116). One with no `upTo` stops anything.
 * One that stops only what was paid no higher up its family than itself stops that outright; above
 * it, its check against `above.dc` plus the level stops it, and without a check nothing does. A
 * check is the fight's own dice, leaning and added to as its conditions say of checks.
 */
function reachesHeld(
  ctx: RulesetCombatContext,
  answering: RulesetCombatant,
  action: RulesetCombatAction,
  payWith: string | undefined,
  held: RulesetActionResume,
): boolean {
  const reaction = action.reaction!;
  if (reaction.upTo !== "paid") return true;
  const caster = rulesetCombatant(ctx.state, held.actorId);
  const theirs = caster?.actions.find((entry) => entry.id === held.optionId);
  if (!caster || !theirs) return true;
  const level = rulesetPaidLevel(ctx.definition, caster, theirs, held.payWith);
  const reach = rulesetPaidLevel(ctx.definition, answering, action, payWith);
  if (level <= reach) return true;
  const said = {
    type: "counter" as const,
    actorId: answering.id,
    targetId: caster.id,
    label: theirs.label,
    level,
    reach,
  };
  const above = reaction.above;
  if (!above || rulesetCombatIsPool(ctx.combat) || rulesetCombatIsSymbol(ctx.combat)) {
    ctx.events.push({ ...said, success: false });
    return false;
  }
  const mode = rulesetCheckMode(ctx.definition, ctx.combat, answering, ctx.state);
  const dice = ctx.combat.attackRoll!.dice;
  const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  const bonuses = rollBonuses(
    ctx,
    rulesetConditionModifiers(ctx.definition, ctx.combat, answering, "checks", ctx.state),
  );
  const difficulty = above.dc + level;
  bonuses.push(
    ...rescueBonuses(
      ctx,
      answering,
      "checks",
      rulesetConditionModifiers(
        ctx.definition,
        ctx.combat,
        answering,
        "checks",
        ctx.state,
        undefined,
        undefined,
        undefined,
        true,
      ),
      difficulty - (kept + above.modifier + bonusTotal(bonuses)),
    ),
  );
  let total = kept + above.modifier + bonusTotal(bonuses);
  // Made, dice off it from the caster's side where that could fail it (1.257): Cutting Words.
  if (total >= difficulty) {
    total -= lowerRoll(ctx, answering, "checks", action.label, total, (most) => total - most < difficulty);
  }
  const success =
    total >= difficulty ||
    !!rescueEntry(ctx, answering, "checks", "success") ||
    (!rulesetCombatIsPool(ctx.combat) &&
      !!rescueEntry(ctx, answering, "checks", "twenty", () => total - kept + 20 >= difficulty));
  ctx.events.push({
    ...said,
    ...(mode === "normal" ? {} : { mode }),
    rolls: second ? [...first, ...second] : first,
    kept,
    modifier: above.modifier,
    ...(bonuses.length > 0 ? { bonuses } : {}),
    total,
    difficulty,
    success,
  });
  return success;
}

/**
 * The window, one answer further on. The one who just answered drops off the front, and so does
 * anybody left with nothing to answer with: a window that asked them anyway would hold the fight
 * open for a menu with only a pass on it.
 *
 * When the last of them has answered the window closes and the fight picks up exactly where it was
 * held: the rest of the walk, or the turn that had not yet begun.
 */
function goOn(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  ctx: RulesetCombatContext,
  /** False for a window taken back up with its answer already let go (1.243). */
  shift = true,
): void {
  const window = ctx.state.window;
  if (!window) return;
  if (shift) window.waiting.shift();
  while (window.waiting.length > 0 && rulesetWindowOptions(definition, ctx.state, window.waiting[0]!).length === 0) {
    ctx.events.push({ type: "pass", actorId: window.waiting[0]!, window: window.id });
    window.waiting.shift();
  }
  const over = rulesetEncounterOutcome(ctx.state) !== "ongoing";
  if (window.waiting.length > 0 && !over) return;
  ctx.state.window = undefined;
  // Held inside a legendary cast (1.284): whatever it led to holds the same window, and once it all
  // has closed the window the cast was bought in is asked on from where it was.
  const carried = window.outer;
  if (!carried) {
    windowClosed(definition, combat, ctx, window, over);
    return;
  }
  const before = ctx.outer;
  ctx.outer = carried;
  try {
    windowClosed(definition, combat, ctx, window, over);
  } finally {
    if (before) ctx.outer = before;
    else delete ctx.outer;
  }
  if (!ctx.state.window) {
    ctx.state.window = carried;
    goOn(definition, combat, ctx, false);
  }
}

/** What a window was holding, picked up now it has closed. */
function windowClosed(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  ctx: RulesetCombatContext,
  window: RulesetCombatWindow,
  over: boolean,
): void {
  const { resume, trigger } = window;
  // A walk is finished even when the last blow ended the fight: its own event says where the walker
  // really stopped, and a fight that ended mid-step would otherwise never say they never left.
  if (resume && (resume.kind === "walk" || rulesetLegacyWalk(resume))) {
    const walker = rulesetCombatant(ctx.state, resume.actorId);
    if (walker) walkOn(ctx, walker, { ...resume, kind: "walk" } as RulesetWalkResume);
    return;
  }
  if (resume?.kind === "fall") {
    const actor = rulesetCombatant(ctx.state, resume.actorId);
    const target = rulesetCombatant(ctx.state, resume.targetId);
    if (actor && target) landFall(ctx, actor, target, resume.levels);
    for (const other of resume.others ?? []) {
      const maker = rulesetCombatant(ctx.state, other.actorId);
      const faller = rulesetCombatant(ctx.state, other.targetId);
      if (maker && faller) landFall(ctx, maker, faller, other.levels);
    }
    return;
  }
  if (resume?.kind === "action") {
    if (over && !resume.resolved) endActionConditions(ctx);
    // A use nobody stopped is aimed next: the ones it is aimed at get their own say before it lands.
    else if (
      trigger.kind === "used" &&
      !resume.cancelled &&
      openAimed(ctx, resume, trigger.label, trigger.catalog, trigger.entry)
    )
      return;
    else resumeAction(ctx, resume);
    // A strike made in passing has landed: the walk's window is asked on from where it was (1.243).
    if (resume.outer && !ctx.state.window) {
      ctx.state.window = resume.outer;
      goOn(definition, combat, ctx, false);
    }
    return;
  }
  // Before the very first turn (1.315), that turn goes on as it was handed out: only what its start
  // asks is asked now.
  if (!over && trigger.kind === "between-turns" && trigger.opening) {
    const first = currentRulesetActor(ctx.state);
    if (first) {
      if (!ctx.state.acted?.includes(first.id)) (ctx.state.acted ??= []).push(first.id);
      openMoment(ctx, { kind: "turn-start", sourceId: first.id, label: first.name }, ctx.state.combatants);
      if (!ctx.state.window) completeDelayed(ctx, first);
    }
  } else if (!over && trigger.kind === "between-turns") beginNextTurn(definition, combat, ctx);
  if (!over && trigger.kind === "turn-start") {
    const actor = rulesetCombatant(ctx.state, trigger.sourceId);
    if (actor) completeDelayed(ctx, actor);
  }
}

function applySignature(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const cost = action.signature?.cost ?? 0;
  const points = actor.signature?.points;
  if (currentRulesetActor(state)?.id === actor.id) {
    return refusal(state, choice.actorId, "not-your-turn", action.id);
  }
  if (!rulesetCombatStanding(actor)) return refusal(state, choice.actorId, "down", action.id);
  if (rulesetCombatEffects(definition, combat, actor, state).has("cannot-act")) {
    return refusal(state, choice.actorId, "cannot-act", action.id);
  }
  // Nothing is paid for a sequence whose parts are all spent: it would buy nothing.
  if (
    points === undefined ||
    points < cost ||
    !rulesetActionAvailable(actor, action, state, definition) ||
    !rulesetSequenceCanHappen(actor, action)
  ) {
    return refusal(state, choice.actorId, "insufficient", action.id);
  }
  // A move (1.283): only to a cell the menu offered. One that follows what its action does (1.285)
  // may go nowhere.
  const only = rulesetMovesOnly(action);
  const destination =
    action.move && (only || choice.to)
      ? rulesetLegendaryMoveCells(definition, state, actor, action).find(
          (cell) => cell.x === choice.to?.x && cell.y === choice.to?.y,
        )
      : undefined;
  if (action.move && (only || choice.to) && !destination) {
    return refusal(state, choice.actorId, "unreachable", action.id);
  }
  // A burst centred on it (1.282): a mummy lord's Channel Negative Energy.
  const targets = only
    ? []
    : action.around
      ? rulesetAroundTargets(state, actor, action).filter((one) => !rulesetSealedApart(definition, state, actor, one))
      : pickTargets(definition, state, actor, action, choice.targetIds);
  if (!Array.isArray(targets)) return refusal(state, choice.actorId, targets, action.id);

  const { ctx, finish } = begin(definition, combat, state, roller);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);
  const left = Math.max(0, (working.signature?.points ?? 0) - cost);
  if (working.signature) working.signature.points = left;
  ctx.events.push({ type: "signature", actorId: working.id, optionId: action.id, label: action.label, cost, left });
  const workingAction = working.actions.find((entry) => entry.id === action.id)!;
  spendAvailability(ctx, working, workingAction);
  if (!only) resolveAction(ctx, working, workingAction, workingTargets);
  // Then the move (1.285), where it may still go: what it did may have changed the board.
  const path =
    workingAction.move && destination
      ? only
        ? destination.path
        : rulesetCombatStanding(working) && rulesetEncounterOutcome(ctx.state) === "ongoing"
          ? rulesetLegendaryMoveCells(definition, ctx.state, working, workingAction).find(
              (cell) => cell.x === destination.x && cell.y === destination.y,
            )?.path
          : undefined
      : undefined;
  if (workingAction.move && path) {
    legendaryMove(ctx, working, workingAction.move, path);
    // Held behind a strike it provoked: the walk asks the window on once it ends.
    if (ctx.state.window?.trigger.kind === "between-turns") goOn(definition, combat, ctx);
  } else goOn(definition, combat, ctx);
  noteOutcome(ctx);
  return finish();
}

/**
 * A legendary cast (1.284): the spell is chosen, aimed and resolved exactly as on its maker's own
 * turn (`rulesetBorrowedTurn`), slots and uses paid as they always are, and the points paid for the
 * cast instead of the budget. Its maker's own turn keeps every budget it had. Anything the spell
 * opens (a Counterspell, a Shield, somebody hurt by it) holds the window the cast was bought in,
 * which is asked on from once all of it has closed.
 */
function castWithPoints(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  castOf: { actionId: string; optionId: string },
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const action = actor.actions.find((entry) => entry.id === castOf.actionId && entry.casting && entry.signature);
  if (!action) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  const cost = action.signature!.cost;
  const outer = structuredClone(window);
  outer.waiting.shift();
  const view = rulesetBorrowedTurn(state, actor.id, action.budget);
  const { window: _window, ...plain } = choice;
  let cast: RulesetCombatStep;
  borrowedOuter = outer;
  try {
    cast = applyRulesetCombatChoice(definition, view, { ...plain, optionId: castOf.optionId }, roller);
  } finally {
    borrowedOuter = undefined;
  }
  // Refused, nothing moved: the fight as it was handed in, and the refusal said of the cast.
  if (cast.state === view) {
    return {
      state,
      events: cast.events.map((event) => (event.type === "refused" ? { ...event, optionId: choice.optionId } : event)),
    };
  }
  const { ctx, finish } = begin(definition, combat, cast.state, roller);
  // Back to the turn it really is, with the budgets that turn left.
  ctx.state.turn = rulesetTurnAfterCalls(state, ctx.state);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  working.budgets = { ...actor.budgets };
  const left = Math.max(0, (actor.signature?.points ?? 0) - cost);
  if (working.signature) working.signature.points = left;
  spendAvailability(
    ctx,
    working,
    working.actions.find((entry) => entry.id === action.id)!,
  );
  // Nothing it opened is still open: the window it was bought in goes on.
  if (!ctx.state.window) {
    ctx.state.window = outer;
    goOn(definition, combat, ctx, false);
  }
  // The cast's own step already said so, if it ended the fight.
  if (!cast.events.some((event) => event.type === "outcome")) noteOutcome(ctx);
  const after = finish();
  return {
    state: after.state,
    events: [
      { type: "signature", actorId: actor.id, optionId: choice.optionId, label: action.label, cost, left },
      ...cast.events,
      ...after.events,
    ],
  };
}

/**
 * A lair action (1.315): chosen, aimed and resolved exactly as on its maker's own turn, with the
 * budget it is taken with lent for it, and nothing of its maker's own turn spent. It is this
 * round's, and the next round's may not be the same one. Anything it opens holds the window it was
 * taken in, which is asked on from once all of it has closed.
 */
function takeLairAction(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  optionId: string,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const action = actor.actions.find((entry) => entry.id === optionId && entry.lair);
  const round = rulesetLairRound(definition, state, actor);
  if (!action || round === null) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  const outer = structuredClone(window);
  outer.waiting.shift();
  const view = rulesetBorrowedTurn(state, actor.id, action.budget);
  const { window: _window, ...plain } = choice;
  let taken: RulesetCombatStep;
  borrowedOuter = outer;
  try {
    taken = rulesetLentLairTurn(() =>
      applyRulesetCombatChoice(definition, view, { ...plain, optionId: action.id }, roller),
    );
  } finally {
    borrowedOuter = undefined;
  }
  if (taken.state === view) {
    return {
      state,
      events: taken.events.map((event) => (event.type === "refused" ? { ...event, optionId: choice.optionId } : event)),
    };
  }
  const { ctx, finish } = begin(definition, combat, taken.state, roller);
  // Back to the turn it really is, with the budgets that turn left.
  ctx.state.turn = rulesetTurnAfterCalls(state, ctx.state);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  working.budgets = { ...actor.budgets };
  if (working.lair) {
    working.lair.last = { round, id: action.id };
    delete working.lair.next;
  }
  if (!ctx.state.window) {
    ctx.state.window = outer;
    goOn(definition, combat, ctx, false);
  }
  if (!taken.events.some((event) => event.type === "outcome")) noteOutcome(ctx);
  const after = finish();
  return {
    state: after.state,
    events: [
      { type: "lair", actorId: actor.id, optionId: action.id, label: action.label },
      ...taken.events,
      ...after.events,
    ],
  };
}

/** Calls an action's creatures into the fight (1.325), as many as its count throws, and says so. */
function callCreatures(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  cells?: RulesetCombatCell[],
): void {
  if (!action.calls) return;
  const count = rollAmount(ctx, action.calls.count).total;
  const ids = rulesetCallCreatures(ctx.definition, ctx.state, actor, action, count, ctx.roll, cells);
  ctx.events.push({ type: "called", actorId: actor.id, label: action.label, ids });
}

/**
 * The window before the fight's very first turn (Capability API 1.315), opened when somebody's
 * lair's count comes before everybody's: their lair actions are taken in it, and the first turn
 * goes on as it was handed out once it closes. Anything that turn's start was asking waits behind
 * it. The fight as it was when nobody's lair is due.
 */
export function rulesetOpenLairWindow(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): RulesetEncounterState {
  const combat = definition.combat;
  const first = currentRulesetActor(state);
  if (!combat || !first || state.round !== 1 || !state.combatants.some((one) => one.lair)) return state;
  if (state.window && state.window.trigger.kind !== "turn-start") return state;
  const next = structuredClone(state);
  next.window = {
    id: `w${(next.windows ?? 0) + 1}`,
    kind: "signature",
    trigger: { kind: "between-turns", nextActorId: first.id, opening: true },
    waiting: [],
  };
  // Nobody's turn has begun yet (1.327): the first one's begins as this window closes.
  next.acted = [];
  const waiting = [...new Set(next.order)].filter((id) =>
    rulesetSignatureOptions(definition, next, id).some((option) => option.lairOf),
  );
  if (waiting.length === 0) return state;
  next.windows = (next.windows ?? 0) + 1;
  next.window.waiting = waiting;
  // Said as the fight opens, the turn-start window it holds back no longer.
  next.opening = [
    ...(next.opening ?? []).filter((event) => event.type !== "window"),
    { type: "window", window: next.window.id, kind: "signature", waiting: [...waiting] },
  ];
  return next;
}

/**
 * Readying (1.288): what it readies and what for. A spell, where the ruleset holds readied spells
 * by concentration, is paid for now (with `payWith`, as the menu offered) and held: its holder's
 * concentration is now on it. False when it cannot be paid.
 */
function readyAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  ready: NonNullable<RulesetCombatOption["ready"]>,
  payWith?: string,
): boolean {
  const action = actor.actions.find((entry) => entry.id === ready.optionId);
  let paid = false;
  if (action && ctx.combat.readying?.concentrates && rulesetIsSpell(action)) {
    const price = planRulesetCombatCost(ctx.definition, actor, action, payWith);
    if (!price) return false;
    if (price.live && actor.sheet) actor.sheet.live = price.live;
    countRulesetSpend(actor, price.cost);
    for (const entry of price.cost) {
      ctx.events.push({ type: "spend", actorId: actor.id, pool: entry.pool, label: entry.label, amount: entry.amount });
    }
    spendAvailability(ctx, actor, action);
    startConcentration(ctx, actor, action);
    paid = true;
  }
  actor.readied = {
    optionId: ready.optionId,
    label: ready.label,
    on: ready.on,
    ...(paid ? { paid: true as const } : {}),
    ...(paid && payWith ? { payWith } : {}),
  };
  ctx.events.push({ type: "ready", actorId: actor.id, label: ready.label, on: ready.on, outcome: "readied" });
  return true;
}

/**
 * What was readied, taken now (1.288) with the ruleset's readying budget: resolved as its holder's
 * own turn would resolve it, a spell held by concentration already paid for, a walk on an allowance
 * of its whole speed. The window it was taken in then goes on, and a walk it interrupted with it.
 */
function releaseReadied(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const readied = actor.readied!;
  const budget = combat.readying!.budget;
  const released = {
    type: "ready" as const,
    actorId: actor.id,
    label: readied.label,
    on: readied.on,
    outcome: "released" as const,
  };
  if (readied.optionId === RULESET_MOVE_OPTION) {
    const option = rulesetReadiedOption(definition, state, actor);
    const to = option?.cells?.find((cell) => cell.x === choice.to?.x && cell.y === choice.to?.y);
    if (!to) return refusal(state, choice.actorId, "unreachable", choice.optionId);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    spendBudget(ctx, working, budget);
    delete working.readied;
    ctx.events.push(released);
    legendaryMove(ctx, working, { share: 1 }, to.path);
    // Held behind a strike it provoked: the walk asks the window on once it ends.
    if (ctx.state.window?.id === window.id) goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }
  const own = actor.actions.find((entry) => entry.id === readied.optionId);
  if (!own) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  const outer = structuredClone(window);
  outer.waiting.shift();
  const view = rulesetBorrowedTurn(state, actor.id, own.budget);
  // A held spell lets go of what held it as it goes off: what it starts it starts afresh.
  if (readied.paid) {
    view.combatants = view.combatants.map((one) => (one.id === actor.id ? { ...one, concentrating: null } : one));
  }
  const { window: _window, ...plain } = choice;
  const taken = { ...plain, optionId: readied.optionId, ...(readied.payWith ? { payWith: readied.payWith } : {}) };
  let step: RulesetCombatStep;
  borrowedOuter = outer;
  try {
    const run = () => applyRulesetCombatChoice(definition, view, taken, roller);
    step = readied.paid ? rulesetWithFreeUse(actor.id, own.id, run) : run();
  } finally {
    borrowedOuter = undefined;
  }
  if (step.state === view) {
    return {
      state,
      events: step.events.map((event) => (event.type === "refused" ? { ...event, optionId: choice.optionId } : event)),
    };
  }
  const { ctx, finish } = begin(definition, combat, step.state, roller);
  // Back to the turn it really is, with the budgets that turn left, less the one it was taken with.
  ctx.state.turn = rulesetTurnAfterCalls(state, ctx.state);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  working.budgets = { ...actor.budgets };
  spendBudget(ctx, working, budget);
  delete working.readied;
  if (!ctx.state.window) {
    ctx.state.window = outer;
    goOn(definition, combat, ctx, false);
  }
  if (!step.events.some((event) => event.type === "outcome")) noteOutcome(ctx);
  const after = finish();
  return { state: after.state, events: [released, ...step.events, ...after.events] };
}

/**
 * Whoever readied something for an opponent coming where it reaches them (1.288), and whom this
 * mover now comes within reach of. `reached` is who could reach them before the step.
 */
function readiedReaching(ctx: RulesetCombatContext, mover: RulesetCombatant, asked: Set<string>): string[] {
  return ctx.state.combatants
    .filter(
      (one) =>
        one.readied?.on === "comes" &&
        one.side !== mover.side &&
        !asked.has(one.id) &&
        rulesetCombatStanding(one) &&
        readiedReaches(ctx, one, mover),
    )
    .map((one) => one.id);
}

/** Whether what `holder` readied could be taken at `mover` where they stand now (1.288): aimed at
 *  them, an area that would catch them, or, for a walk, them coming next to its holder. */
function readiedReaches(ctx: RulesetCombatContext, holder: RulesetCombatant, mover: RulesetCombatant): boolean {
  const readied = holder.readied!;
  if (!rulesetCanSee(ctx.definition, ctx.state, holder, mover)) return false;
  if (readied.optionId === RULESET_MOVE_OPTION) return rulesetGap(holder, mover) <= 1;
  const own = holder.actions.find((entry) => entry.id === readied.optionId);
  if (!own) return false;
  const view = rulesetBorrowedTurn(ctx.state, holder.id, own.budget);
  const find = () => rulesetCombatOptions(ctx.definition, view, holder.id).find((one) => one.id === own.id);
  const option = readied.paid ? rulesetWithFreeUse(holder.id, own.id, find) : find();
  if (!option) return false;
  if (own.area && view.board) {
    return rulesetAimCells(view, holder.id, own.id, Infinity, true).some((aim) => aim.targetIds.includes(mover.id));
  }
  return rulesetOptionTargets(ctx.definition, view, holder.id, option).includes(mover.id);
}

/**
 * After a step in which somebody used something (1.288): everybody who readied something for an
 * opponent acting, and saw this one do it, is asked whether they take it now.
 */
function readiedActs(ctx: RulesetCombatContext): void {
  if (!ctx.combat.readying || ctx.state.window || !ctx.acted?.size) return;
  if (rulesetEncounterOutcome(ctx.state) !== "ongoing") return;
  for (const id of ctx.acted) {
    const source = rulesetCombatant(ctx.state, id);
    if (!source) continue;
    const waiting = ctx.state.combatants
      .filter(
        (one) =>
          one.readied?.on === "acts" &&
          one.side !== source.side &&
          one.id !== source.id &&
          rulesetCombatStanding(one) &&
          (one.budgets[ctx.combat.readying!.budget] ?? 0) >= 1 &&
          rulesetCanSee(ctx.definition, ctx.state, one, source),
      )
      .map((one) => one.id);
    if (waiting.length === 0) continue;
    openWindow(ctx, { kind: "reaction", trigger: { kind: "readied", sourceId: id, on: "acts" }, waiting });
    break;
  }
  ctx.acted.clear();
}

/**
 * A legendary move (1.283): its maker walks the path on an allowance lent for it alone, a share of
 * its speed or a distance, and keeps its own. One that provokes nothing (a vampire's) is struck at
 * by nobody; one nothing can harm or hold (a mummy lord's Whirlwind of Sand) is first let go of by
 * whatever held it still, then struck by nobody and caught by no zone on the way.
 */
function legendaryMove(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  move: RulesetCombatMove,
  path: RulesetCombatCell[],
): void {
  const kept = {
    ...(actor.movementLeft !== undefined ? { movementLeft: actor.movementLeft } : {}),
    ...(actor.modeLeft ? { modeLeft: actor.modeLeft } : {}),
  };
  const lent = rulesetLentMovement(ctx.definition, actor, move, ctx.state);
  if (move.untouchable) {
    for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state)) {
      if (entry.effects.includes("speed-zero")) removeCondition(ctx, actor, entry.condition, "moved");
    }
  }
  actor.movementLeft = lent.movementLeft;
  if (lent.modeLeft) actor.modeLeft = lent.modeLeft;
  else delete actor.modeLeft;
  walkOn(ctx, actor, {
    kind: "walk",
    actorId: actor.id,
    from: { x: actor.x!, y: actor.y! },
    walked: [],
    path: [...path],
    asked: [],
    spent: 0,
    legendary: {
      kept,
      ...(move.noOpportunity ? { noOpportunity: true as const } : {}),
      ...(move.untouchable ? { untouchable: true as const } : {}),
    },
  });
}

// ── The board ──

/** Whether this option lands as a shape on the ground rather than on combatants named by id. */
function positionedArea(state: RulesetEncounterState, actor: RulesetCombatant, option: RulesetCombatOption): boolean {
  return !!state.board?.grid && !!actor.actions.find((entry) => entry.id === option.id)?.area;
}

/** How many cells an area grows by for the higher cost it was paid with (1.267): Confusion. */
export function rulesetAreaGrowth(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  optionId: string,
  payWith: string | undefined,
): number {
  const action = actor.actions.find((entry) => entry.id === optionId);
  const per = action?.area?.sizePerCostStep;
  if (!action || !per || payWith === undefined) return 0;
  return per * rulesetCostSteps(definition, action, payWith, actor);
}

/** The cells the shape covered, read off the same menu rule that offered it. */
function areaCellsFor(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  optionId: string,
  at: RulesetCombatCell,
  lay?: RulesetAreaLay,
): RulesetCombatCell[] {
  return rulesetAimedCells(state, actor.id, optionId, at, lay);
}

/** The cell the menu offered, or null when the choice named one it did not. The menu is the only
 *  thing that decides where a move may go, exactly as it is for everything else. */
function destinationOf(option: RulesetCombatOption, to: RulesetCombatCell | undefined) {
  if (!to) return null;
  return option.cells?.find((cell) => cell.x === to.x && cell.y === to.y) ?? null;
}

/** A flier going up or down a level where it stands (1.114), for what a level is worth in cells. Down
 *  to the ground under it, it is on the ground. */
function resolveFly(ctx: RulesetCombatContext, actor: RulesetCombatant, option: RulesetCombatOption): void {
  const grid = ctx.state.board!.grid;
  const cost = option.movementCost ?? ctx.state.board?.levelCells ?? 1;
  const from = rulesetLevelOf(grid, actor);
  const to = from + (option.id === RULESET_FLY_UP_OPTION ? 1 : -1);
  spendRulesetMovement(actor, cost);
  if (to > elevationAt(grid, actor.x!, actor.y!)) {
    actor.altitude = to;
    actor.airborne = true;
  } else delete actor.altitude;
  ctx.events.push({ type: "flew", actorId: actor.id, from, to, cost, left: actor.movementLeft ?? 0 });
}

/**
 * A flier that cannot stay up comes down (1.114): one up in the air that is knocked prone, held still
 * or taken down falls the levels to the ground under it, unless it hovers. What the fall does is the
 * ruleset's `elevation.falling`, as a fall off a ledge is.
 */
function groundFlier(ctx: RulesetCombatContext, flier: RulesetCombatant): void {
  const grid = ctx.state.board?.grid;
  if (!grid || flier.hover || !(flier.airborne || rulesetAirborne(grid, flier))) return;
  const grounded =
    !rulesetCombatStanding(flier) ||
    !!rulesetProneCondition(ctx.definition, ctx.combat, flier) ||
    rulesetCombatEffects(ctx.definition, ctx.combat, flier, ctx.state).has("speed-zero");
  if (!grounded) return;
  // Out of the air (1.354); from up above the ground, a fall too.
  delete flier.airborne;
  if (!rulesetAirborne(grid, flier)) return;
  const levels = rulesetLevelOf(grid, flier) - elevationAt(grid, flier.x!, flier.y!);
  // Down first, so whatever the fall itself does finds it on the ground.
  delete flier.altitude;
  fall(ctx, flier, flier, levels);
}

/**
 * Getting back up: half the allowance, and the condition that held them down is gone.
 *
 * It clears the condition on the sheet as well as in the fight, because a party member's conditions
 * are the sheet's own and lying down is one of them.
 */
function resolveStand(ctx: RulesetCombatContext, actor: RulesetCombatant, option: RulesetCombatOption): void {
  const cost = option.movementCost ?? rulesetStandCost(actor);
  spendRulesetMovement(actor, cost);
  const condition = rulesetProneCondition(ctx.definition, ctx.combat, actor);
  if (condition) removeCondition(ctx, actor, condition, "expired");
  // Movement spent and nowhere gone: the condition lifting is its own event, and this is the price
  // of it, said in the same words every other spent cell is said in.
  const at = { x: actor.x!, y: actor.y! };
  ctx.events.push({
    type: "move",
    actorId: actor.id,
    from: at,
    to: { ...at },
    path: [],
    cost,
    left: actor.movementLeft ?? 0,
  });
}

/**
 * One walk, cell by cell.
 *
 * A standing enemy whose reach the mover leaves strikes BEFORE they go, with its best melee attack
 * and out of the budget the ruleset says such a strike costs. A strike that drops the mover ends
 * the walk where they fell, which is why the path is walked rather than jumped.
 *
 * The strikes are their own events and the walk's own event comes last, carrying the cells that
 * were really crossed rather than the ones that were meant to be.
 */
/** Who stands in which zone, before a step. Nothing is worked out in a fight with no zones. */
function zonesAround(ctx: RulesetCombatContext): Map<RulesetCombatZone, { zone: Set<string>; side: Set<string> }> {
  const inside = new Map<RulesetCombatZone, { zone: Set<string>; side: Set<string> }>();
  if (!ctx.state.combatants.some((one) => one.zones?.length)) return inside;
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    inside.set(zone, {
      zone: new Set(rulesetZoneOccupants(ctx.state, caster, zone, action)),
      // A wall's side counts apart (1.177): walking onto it catches as the side says.
      side: new Set(rulesetZoneSideOccupants(ctx.state, caster, zone, action)),
    });
  }
  return inside;
}

/** After a step, everybody now inside a zone who was not before it: the mover walking in, or those a
 *  zone its caster carries has just reached. Each is caught as `enter` says. */
function zonesEntered(
  ctx: RulesetCombatContext,
  mover: RulesetCombatant,
  before: Map<RulesetCombatZone, { zone: Set<string>; side: Set<string> }>,
): void {
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    const was = before.get(zone);
    if (!was) continue;
    // Stepping onto a bead (1.183): its save, or it goes off.
    if (action.zone?.detonates?.touched && zone.at && rulesetFills(mover, zone.at)) {
      if (!caster.zones?.includes(zone)) continue;
      const save = action.save;
      if (!save || !rollSave(ctx, mover, save.save, save.difficulty, caster.id, null, save.against)) {
        spendZone(ctx, caster, zone);
        continue;
      }
    }
    for (const id of rulesetZoneOccupants(ctx.state, caster, zone, action)) {
      if (was.zone.has(id)) continue;
      // Only the mover walks in, and only the mover's own zone moves onto anybody.
      if (id !== mover.id && caster.id !== mover.id) continue;
      const target = rulesetCombatant(ctx.state, id);
      if (target) zoneStrike(ctx, caster, zone, target, "enter");
    }
    for (const id of rulesetZoneSideOccupants(ctx.state, caster, zone, action)) {
      if (was.side.has(id) || id !== mover.id) continue;
      zoneStrike(ctx, caster, zone, mover, "enter", "side");
    }
  }
}

function resolveMove(ctx: RulesetCombatContext, actor: RulesetCombatant, destination: { path: RulesetCombatCell[] }) {
  walkOn(ctx, actor, {
    kind: "walk",
    actorId: actor.id,
    from: { x: actor.x!, y: actor.y! },
    walked: [],
    path: [...destination.path],
    asked: [],
    spent: 0,
  });
}

/**
 * A walk, from wherever it left off. Every step is checked for whose reach it leaves, and the first
 * step that leaves somebody's HOLDS THE WALK OPEN: the fight stops where it stands, the window
 * names everybody that step provoked, and the rest of the path waits in the window until they have
 * all answered. `walkOn` is then called again with what the window kept.
 *
 * One chance each for the whole walk, struck or passed, however many times the path leaves the same
 * reach: that is what the menu promised when it listed whom this walk provokes, and a budget of two
 * is two walks, not two strikes at one passer-by.
 *
 * The walk's own event comes last and carries the cells that were really crossed rather than the
 * ones that were meant to be, so a walk cut short by a blow says where it really ended.
 */
function walkOn(ctx: RulesetCombatContext, actor: RulesetCombatant, resume: RulesetWalkResume): void {
  const opportunity = ctx.combat.opportunity;
  const grid = ctx.state.board?.grid;
  const walked = [...resume.walked];
  const asked = new Set(resume.asked);
  const readyAsked = new Set(resume.readyAsked ?? []);
  // Only when somebody has readied something for an opponent coming near (1.288).
  const readying =
    !!ctx.combat.readying && ctx.state.combatants.some((one) => one.readied?.on === "comes" && one.side !== actor.side);
  let spent = resume.spent;
  let stopped = false;
  let at = walked.length > 0 ? walked[walked.length - 1]! : resume.from;
  const rest = [...resume.path];
  const legendary = resume.legendary;
  // Taken back up after a strike it provoked (1.283): the window it was bought in stands again, so
  // nothing else opens over it while the walk goes on.
  let outer = resume.outer;
  if (outer && !ctx.state.window) ctx.state.window = outer;
  while (rest.length > 0) {
    // Nor does one an answer held still, stunned or grappled on the way (1.243). Nothing holds one
    // that nothing can (1.283).
    if (
      !rulesetCombatStanding(actor) ||
      (!legendary?.untouchable && rulesetCombatEffects(ctx.definition, ctx.combat, actor, ctx.state).has("speed-zero"))
    ) {
      stopped = true;
      break;
    }
    const cell = rest[0]!;
    // Nobody is asked once the fight is over: the walk simply finishes on the cells it has left.
    if (
      opportunity &&
      !actor.flags.disengaged &&
      !legendary?.noOpportunity &&
      !legendary?.untouchable &&
      rulesetEncounterOutcome(ctx.state) === "ongoing"
    ) {
      const threats = threatsLeaving(ctx, actor, at, cell).filter((enemy) => !asked.has(enemy.id));
      if (threats.length > 0) {
        for (const enemy of threats) asked.add(enemy.id);
        // A legendary move holds the window it was bought in behind the strike (1.283), its maker
        // already off the front of it.
        if (legendary && ctx.state.window) {
          if (ctx.state.window !== outer) {
            outer = ctx.state.window;
            outer.waiting.shift();
          }
          ctx.state.window = undefined;
        }
        openWindow(ctx, {
          kind: "reaction",
          trigger: { kind: "leaves-reach", moverId: actor.id, from: { ...at }, to: { ...cell } },
          waiting: threats.map((enemy) => enemy.id),
          resume: {
            kind: "walk",
            actorId: actor.id,
            from: resume.from,
            walked,
            path: rest,
            asked: [...asked],
            ...(readyAsked.size ? { readyAsked: [...readyAsked] } : {}),
            spent,
            ...(legendary ? { legendary } : {}),
            ...(outer ? { outer } : {}),
          },
        });
        return;
      }
    }
    rest.shift();
    const before = zonesAround(ctx);
    // Who could already reach them, before this step (1.288).
    const reachedBefore = readying ? new Set(readiedReaching(ctx, actor, readyAsked)) : undefined;
    // What the menu showed for the same step: entering the cell, and climbing up to it (combat C6b). The
    // path came from that menu, so a cliff is never on it; a saved one that has one costs a plain step.
    // With other ways of moving (1.113) the same choice the menu made, on what this walk has spent.
    // Ground a lasting area makes hard going costs what the menu priced it at (1.173).
    const step = grid ? rulesetMoveStep(grid, at, cell, actor, spent) : null;
    // A step only its flight takes puts it in the air (1.354).
    if (step?.mode === "fly") actor.airborne = true;
    spent += grid
      ? rulesetSlowedStep(
          grid,
          cell,
          step?.cost ?? rulesetCellEnterCost(grid, cell.x, cell.y),
          rulesetSlowedCells(ctx.state, actor),
          at,
        )
      : 1;
    walked.push(cell);
    // What a charge reads (1.186): where this turn's walking began, then each cell of it. A
    // legendary move is nobody's turn.
    if (!legendary) {
      if (!actor.trail?.length) actor.trail = [{ ...at }];
      actor.trail.push({ ...cell });
    }
    // Whoever they carry shut in a sphere (1.314) comes along, into the cell they left.
    for (const carried of ctx.state.combatants) {
      if (carried.carriedBy !== actor.id || !rulesetSealed(ctx.definition, carried, ctx.state)) continue;
      carried.x = at.x;
      carried.y = at.y;
    }
    at = cell;
    actor.x = cell.x;
    actor.y = cell.y;
    // Seen on the way, out in the open (1.287), even where the walk ends back in hiding; and no
    // longer still (1.292).
    stirs(ctx, actor, "moved");
    chimes(ctx, actor);
    recheckHiding(ctx, actor);
    endsAway(ctx);
    // Come where something readied for it reaches it (1.288): taken now, the rest of the walk after.
    const readied = reachedBefore
      ? readiedReaching(ctx, actor, readyAsked).filter(
          (id) =>
            !reachedBefore.has(id) && (rulesetCombatant(ctx.state, id)!.budgets[ctx.combat.readying!.budget] ?? 0) >= 1,
        )
      : [];
    if (readied.length > 0 && rulesetEncounterOutcome(ctx.state) === "ongoing") {
      for (const id of readied) readyAsked.add(id);
      if (legendary && ctx.state.window) {
        if (ctx.state.window !== outer) {
          outer = ctx.state.window;
          outer.waiting.shift();
        }
        ctx.state.window = undefined;
      }
      if (!ctx.state.window) {
        openWindow(ctx, {
          kind: "reaction",
          trigger: { kind: "readied", sourceId: actor.id, on: "comes" },
          waiting: readied,
          resume: {
            kind: "walk",
            actorId: actor.id,
            from: resume.from,
            walked,
            path: rest,
            asked: [...asked],
            readyAsked: [...readyAsked],
            spent,
            ...(legendary ? { legendary } : {}),
            ...(outer ? { outer } : {}),
          },
        });
        return;
      }
    }
    // A flier that came onto ground as high as it flew, or higher, is standing on it (1.114), and
    // goes on from there as anybody on the ground does.
    if (actor.altitude !== undefined && !rulesetAirborne(grid, actor)) delete actor.altitude;
    // Into a zone, or a zone carried onto somebody (1.172), and ground that hurts to cross (1.173).
    // Nothing harms one that nothing can (1.283).
    if (!legendary?.untouchable) {
      zonesEntered(ctx, actor, before);
      zoneGround(ctx, actor, cell);
    }
  }
  if (!stopped && !rulesetCombatStanding(actor)) stopped = true;
  spendRulesetMovement(actor, spent);
  // Its own allowance back (1.283): the lent one was for this move only.
  if (legendary) {
    if (legendary.kept.movementLeft === undefined) delete actor.movementLeft;
    else actor.movementLeft = legendary.kept.movementLeft;
    if (legendary.kept.modeLeft === undefined) delete actor.modeLeft;
    else actor.modeLeft = legendary.kept.modeLeft;
  }
  ctx.events.push({
    type: "move",
    actorId: actor.id,
    from: resume.from,
    to: { ...at },
    path: walked,
    cost: spent,
    left: actor.movementLeft ?? 0,
    ...(stopped ? { stopped: true } : {}),
  });
  // Held behind a strike it provoked (1.283): the window it was bought in is asked on from there.
  if (resume.outer && ctx.state.window === resume.outer) goOn(ctx.definition, ctx.combat, ctx, false);
}

/**
 * The window a moment opens, for everybody who holds something that waits for exactly it.
 *
 * Nobody is asked when nobody could take anything: a window opened for a menu with only a pass on
 * it would hold the fight up to say nothing. Nor does one open INSIDE another, because the fight
 * keeps one window rather than a stack, so a reaction cannot itself be reacted to.
 *
 * ponytail: one window at a time, no nesting. The upgrade path is the bounded stack the combat
 * handoff describes, which needs a parent id on every window and a revalidation pass after each
 * answer; a chain of counters is what it buys, and nothing else here wants it yet.
 */
function openMoment(
  ctx: RulesetCombatContext,
  trigger: Extract<RulesetWindowTrigger, { kind: "aimed" | "harmed" | "used" | "falls" | "turn-start" }>,
  candidates: readonly RulesetCombatant[],
  resume?: RulesetWindowResume,
): boolean {
  if (ctx.state.window) return false;
  const moment = rulesetWindowMoment(trigger);
  if (!moment) return false;
  // Being aimed at is about what somebody MEANS to do to you, and a friend healing you or handing
  // you something is not a threat to answer: only the other side opens that moment, and the same
  // for somebody using something at all. Being hurt is a fact about you whoever did it, so it opens
  // for anybody, and a reaction pointed back at the source is still kept off a friend by the same
  // legality every other target goes through. A fall may be answered by either side or the faller,
  // with the answer's own target side deciding whom it can catch.
  const source = rulesetCombatant(ctx.state, trigger.sourceId);
  const waiting = candidates
    .filter((one) => moment === "falls" || moment === "turn-start" || one.id !== trigger.sourceId)
    .filter(
      (one) =>
        moment === "turn-start" || moment === "falls" || moment === "harmed" || !source || one.side !== source.side,
    )
    .filter(
      (one) =>
        rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, one, moment, trigger.sourceId, {
          ...("targetIds" in trigger ? { targetIds: trigger.targetIds } : {}),
          ...(trigger.kind === "falls" && trigger.fallerIds ? { targetIds: trigger.fallerIds } : {}),
          ...("optionId" in trigger && source?.block && !("catalog" in trigger && trigger.catalog)
            ? { action: trigger.label }
            : {}),
          ...("catalog" in trigger && trigger.catalog ? { catalog: trigger.catalog } : {}),
          ...("entry" in trigger && trigger.entry ? { entry: trigger.entry } : {}),
        }).length > 0,
    )
    .map((one) => one.id);
  if (waiting.length === 0) return false;
  openWindow(ctx, { kind: "reaction", trigger, waiting, ...(resume ? { resume } : {}) });
  return true;
}

/** What a window was holding, once everybody in it has answered. It resolves from the state as it
 *  stands NOW rather than as it stood then: an answer may have taken a target out, and the fight
 *  that resumes is the fight the window left behind. */
/** The moment for the ones something held is aimed at, holding it once more. False when nobody there
 *  has anything to answer it with, and then it simply goes ahead. */
function openAimed(
  ctx: RulesetCombatContext,
  resume: RulesetActionResume,
  label: string,
  catalog: string | undefined,
  entry: string | undefined,
): boolean {
  const actor = rulesetCombatant(ctx.state, resume.actorId);
  if (!actor || !rulesetCombatStanding(actor)) return false;
  const targets = resume.targetIds
    .map((id) => rulesetCombatant(ctx.state, id))
    .filter((target): target is RulesetCombatant => !!target && !target.defeated);
  return openMoment(
    ctx,
    {
      kind: "aimed",
      targetIds: targets.map((one) => one.id),
      sourceId: actor.id,
      optionId: resume.optionId,
      label,
      ...(catalog ? { catalog } : {}),
      ...(entry ? { entry } : {}),
    },
    ctx.state.combatants,
    resume,
  );
}

function resumeAction(ctx: RulesetCombatContext, resume: RulesetActionResume): void {
  const actor = rulesetCombatant(ctx.state, resume.actorId);
  const found = actor?.actions.find((entry) => entry.id === resume.optionId);
  // A fake does what it truly does (1.79).
  const own = found && rulesetActionAsUsed(found);
  // Picked up in the mode it was made in, and with what it was altered with (1.253).
  const moded = own && resume.mode ? (rulesetModedAction(ctx.definition, own, resume.mode) ?? own) : own;
  let action =
    actor && moded ? rulesetResumedAction(actor, moded, resume.alters, resume.spares, resume.heightens) : moded;
  if (!actor || !action) return;
  if (resume.cancelled || !rulesetCombatStanding(actor)) {
    // A spell called off was cast all the same (1.180).
    if (resume.cancelled && !resume.summon) holderActed(ctx, actor, action);
    endActionConditions(ctx);
    return;
  }
  if (resume.resolved) {
    finishSummon(ctx, actor, action, resume);
    return;
  }
  // A later strike keeps the cast's amount and payment level, but does not start concentration again.
  if (resume.summon) action = { ...action, concentration: false };
  // A saved fight can come back through an import, so only a real cell of this board is taken.
  const grid = ctx.state.board?.grid;
  const at = resume.at;
  const onBoard = (n: number, size: number) => Number.isInteger(n) && n >= 0 && n < size;
  if (grid && at && onBoard(at.x, grid.width) && onBoard(at.y, grid.height)) ctx.aimedAt = { x: at.x, y: at.y };
  const also = grid
    ? (resume.also ?? []).filter((cell) => onBoard(cell.x, grid.width) && onBoard(cell.y, grid.height))
    : [];
  if (ctx.aimedAt && also.length) ctx.aimedAlso = also.map((cell) => ({ x: cell.x, y: cell.y }));
  // What resumes lands on the fight as it stands NOW rather than as it stood when it was aimed, so
  // anybody the fight is already over for is left out, the same way a sequence leaves them out. A
  // ruleset with a dying rule keeps a character on the board at zero, so this is about an opponent
  // taken out by an answer: a creature's own reaction can do that now.
  // A zone that does nothing as it appears (1.172) catches nobody now: only its triggers do.
  const targets =
    action.zone && !action.zone.atCast
      ? []
      : resume.targetIds
          .map((id) => rulesetCombatant(ctx.state, id))
          .filter(
            (target): target is RulesetCombatant =>
              !!target && (!target.defeated || rulesetCanRevive(ctx.state, action, target)),
          );
  // Props its area covers (1.316) take it as anybody caught does, from the same roll, first: nothing
  // answers for a prop, so none of it waits on a window.
  const reaches =
    grid &&
    ctx.aimedAt &&
    action.area &&
    action.damage &&
    !action.zone?.detonates &&
    !resume.held &&
    !(action.zone && !action.zone.atCast);
  const areaOf = (state: RulesetEncounterState) =>
    new Set(
      areaCellsFor(state, actor, action.id, ctx.aimedAt!, {
        ...(resume.also ? { also: resume.also } : {}),
        grow: rulesetAreaGrowth(ctx.definition, actor, action.id, resume.payWith),
      }).map((cell) => `${cell.x},${cell.y}`),
    );
  const covered = reaches ? areaOf(ctx.state) : new Set<string>();
  const caught = !reaches
    ? []
    : rulesetStandingProps(ctx.state).flatMap((prop) => {
        // A prop that closes its cells is reached as though it did not: what stops the area is
        // what stands between, not the prop itself.
        const reach = prop.blocks
          ? (() => {
              const board = ctx.state.board!;
              const without: RulesetEncounterState = {
                ...ctx.state,
                board: {
                  ...board,
                  grid: { ...board.grid },
                  props: board.props!.map((one) => (one === prop ? { ...one, health: 0 } : one)),
                },
              };
              rulesetSyncZoneWalls(without);
              return areaOf(without);
            })()
          : covered;
        const cell = prop.cells.find((one) => reach.has(`${one.x},${one.y}`));
        return cell
          ? [
              {
                prop,
                stand: objectStandIn(
                  `prop>${prop.id}`,
                  prop.label,
                  actor,
                  { ...prop, health: prop.max },
                  prop.health,
                  cell,
                ),
              },
            ]
          : [];
      });
  harmedBy(ctx, actor, action, resume, () => {
    const from = ctx.events.length;
    ctx.state.combatants.push(...caught.map(({ stand }) => stand));
    const hold = resolveAction(
      ctx,
      actor,
      action,
      [...caught.map(({ stand }) => stand), ...targets],
      resume.payWith,
      resume.held,
      resume.style,
      resume.spend,
    );
    if (caught.length === 0) return hold;
    // Taken off the board again before anybody is asked about being hurt: a prop is nobody.
    const stands = new Set(caught.map(({ stand }) => stand));
    ctx.state.combatants = ctx.state.combatants.filter((one) => !stands.has(one));
    const blows = objectBlows(
      ctx,
      from,
      caught.map(({ stand }) => stand.id),
    );
    for (const { prop, stand } of caught) {
      const { dealt, struck } = blows[stand.id]!;
      breakProp(ctx, actor, action.label, prop, stand, "area", dealt, struck);
    }
    return hold;
  });
  // Growth cleared where it lands (1.318): pruning shears.
  if (grid && at && action.area && action.clears === "growth" && !resume.held) {
    const cleared = rulesetClearGrowth(
      grid,
      areaCellsFor(ctx.state, actor, action.id, at, {
        ...(resume.also ? { also: resume.also } : {}),
        grow: rulesetAreaGrowth(ctx.definition, actor, action.id, resume.payWith),
      }),
    );
    ctx.events.push({ type: "growth", actorId: actor.id, label: action.label, cells: cleared, by: "cleared" });
  }
  // The ground it changes (1.324): a bonfire guttering, the ice cracking.
  if (grid && at && action.area && action.ground && !resume.held) {
    const cells = areaCellsFor(ctx.state, actor, action.id, at, {
      ...(resume.also ? { also: resume.also } : {}),
      grow: rulesetAreaGrowth(ctx.definition, actor, action.id, resume.payWith),
    });
    const moved = rulesetChangeGround(ctx.state, cells, action.ground, action.ground.occupants);
    ctx.events.push({
      type: "boardEvent",
      id: action.id,
      label: action.label,
      ...(action.ground.tell ? { tell: action.ground.tell } : {}),
      cells: cells.length,
      ...(moved.length ? { moved } : {}),
    });
  }
  // Creatures called into the area (1.325): Shelves Lean's specters among the fallen jars.
  if (action.area && action.calls && !resume.held) {
    callCreatures(
      ctx,
      actor,
      action,
      grid && at
        ? areaCellsFor(ctx.state, actor, action.id, at, {
            ...(resume.also ? { also: resume.also } : {}),
            grow: rulesetAreaGrowth(ctx.definition, actor, action.id, resume.payWith),
          })
        : undefined,
    );
  }
  // Fire landing on a web with nobody in it sets it alight all the same (1.183).
  if (grid && at && action.area && action.damage && !action.zone?.detonates) {
    igniteZones(
      ctx,
      [action.damage.type, ...(action.damage.plus ?? []).map((clause) => clause.type)],
      areaCellsFor(ctx.state, actor, action.id, at, {
        ...(resume.also ? { also: resume.also } : {}),
        grow: rulesetAreaGrowth(ctx.definition, actor, action.id, resume.payWith),
      }),
    );
  }
}

/** Everybody who can answer this hit, including its target's nearby protectors (1.131). */
function hitAnswers(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  action: RulesetCombatAction,
): string[] {
  // A wall's section is nobody to answer for (1.200).
  if (target.object) return [];
  return ctx.state.combatants
    .filter(
      (one) =>
        rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, one, "hit", actor.id, {
          targetIds: [target.id],
          ...(!action.catalog && actor.block ? { action: action.label } : {}),
          ...(action.catalog ? { catalog: action.catalog } : {}),
          ...(action.entry ? { entry: action.entry } : {}),
          blow: rulesetBlowKind(ctx.state, actor, target, action),
          ...(rulesetWeaponBlow(action) ? { weapon: true } : {}),
          ...(!action.catalog ? { attack: action.label } : {}),
          ...(ctx.strikeBudget ? { budget: ctx.strikeBudget } : {}),
          ...rulesetHitItem(action.id),
        }).length > 0,
    )
    .map((one) => one.id);
}

/** The action is over, including when an answer called it off (1.131). */
function endActionConditions(ctx: RulesetCombatContext): void {
  for (const holder of ctx.state.combatants)
    for (const entry of [...holder.tracked])
      if (entry.thisAction) removeCondition(ctx, holder, entry.condition, "expired");
}

/** An action, and then the window for everybody it hurt who has something that answers being hurt.
 *  Read off the damage the action itself wrote, so nothing inside the resolver has to know that a
 *  window exists.
 *
 *  An attack may come back HELD instead: one of its rolls hit somebody who holds an answer for being
 *  hit. Then the window for that opens instead, holding the action exactly where it stopped along
 *  with whoever it had already hurt, and being hurt is asked about once it has finished. */
function harmedBy(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
  resolve: () => RulesetHitHold | null,
): void {
  const before = ctx.events.length;
  // What its strike was paid for from, read by every answer to its hits (1.248).
  const paidFrom = ctx.strikeBudget;
  if (resume.budget) ctx.strikeBudget = resume.budget;
  else delete ctx.strikeBudget;
  // The uses its user chose, read as it heals (1.251).
  if (resume.amount) ctx.chosenAmount = resume.amount;
  else delete ctx.chosenAmount;
  // A blow that reaps (1.323), held or resumed alike.
  const reaping = ctx.reaping;
  if (action.reaps) ctx.reaping = actor.id;
  else delete ctx.reaping;
  let hold: RulesetHitHold | null;
  try {
    hold = resolve();
  } finally {
    if (reaping) ctx.reaping = reaping;
    else delete ctx.reaping;
  }
  const hurt = new Set([
    ...(resume.held?.hurt ?? []),
    ...ctx.events
      .slice(before)
      .filter((event) => event.type === "damage" && event.dealt > 0)
      .map((event) => (event as Extract<RulesetCombatEvent, { type: "damage" }>).targetId),
  ]);
  if (hold) {
    openHitWindow(ctx, actor, action, resume, hold, [...hurt]);
    if (paidFrom) ctx.strikeBudget = paidFrom;
    else delete ctx.strikeBudget;
    return;
  }
  if (paidFrom) ctx.strikeBudget = paidFrom;
  else delete ctx.strikeBudget;
  endActionConditions(ctx);
  // A strike made in passing asks nobody about being hurt, held or not (1.243).
  const waiting =
    !resume.outer &&
    rulesetEncounterOutcome(ctx.state) === "ongoing" &&
    hurt.size > 0 &&
    openMoment(
      ctx,
      {
        kind: "harmed",
        sourceId: actor.id,
        label: action.label,
        ...(action.catalog ? { catalog: action.catalog } : {}),
        ...(action.entry ? { entry: action.entry } : {}),
      },
      [...hurt].map((id) => rulesetCombatant(ctx.state, id)).filter((one): one is RulesetCombatant => !!one),
      action.summons || action.zone ? { ...resume, resolved: true } : undefined,
    );
  if (!waiting) finishSummon(ctx, actor, action, resume);
}

/** The window for an attack held where one of its rolls hit, picked up from that roll once everybody
 *  it asks has answered. */
function openHitWindow(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
  hold: RulesetHitHold,
  hurt: string[],
): void {
  const { label, optionId, catalog, entry, blow, asks, hit, ...held } = hold;
  const { held: _previous, ...base } = resume;
  // Held for somebody to choose their spends (1.382): they alone are asked, and the throw is spent
  // as they chose once they are done.
  if (asks) {
    openWindow(ctx, {
      kind: "spend",
      trigger: {
        kind: "spend",
        targetIds: [held.targetId],
        sourceId: actor.id,
        optionId,
        label,
        by: asks,
        hit: !!hit,
      },
      waiting: [asks === "attacker" ? actor.id : held.targetId],
      resume: { ...base, held: { ...held, hurt } },
    });
    return;
  }
  const striking = actor.actions.find((one) => one.id === optionId) ?? action;
  openWindow(ctx, {
    kind: "reaction",
    trigger: {
      kind: "hit",
      targetIds: [held.targetId],
      sourceId: actor.id,
      optionId,
      label,
      ...(catalog ? { catalog } : {}),
      ...(entry ? { entry } : {}),
      ...(blow ? { blow } : {}),
      // A weapon's blow, for an answer that adds to one (1.241).
      ...(rulesetWeaponBlow(striking) ? { weapon: true as const } : {}),
      ...(resume.budget ? { budget: resume.budget } : {}),
      total: held.roll.total,
      defense: held.roll.defense,
    },
    waiting: hitAnswers(ctx, actor, rulesetCombatant(ctx.state, held.targetId)!, striking),
    resume: { ...base, held: { ...held, hurt } },
  });
}

/** A walk held open by an Engine from before a resume said what kind it was. The walk was the only
 *  thing a window could hold then, so a resume with no kind is one, and a fight saved in the middle
 *  of one is finished rather than left standing on the step it was asked about. */
function rulesetLegacyWalk(resume: RulesetWindowResume): boolean {
  return (resume as { kind?: unknown }).kind === undefined;
}

/** Hold the fight open. The id is one up from every window this fight has opened, so an answer
 *  written for a window that has already closed is refused rather than spent on its successor. */
function openWindow(ctx: RulesetCombatContext, window: Omit<RulesetCombatWindow, "id">): void {
  // Old self-only windows keep their original saved shape. A bystander may itself be one of an
  // area's targets, so being on that list does not make its answer a self answer.
  const trigger = window.trigger;
  if (
    (trigger.kind === "aimed" || trigger.kind === "hit") &&
    trigger.targetIds &&
    window.waiting.every(
      (id) =>
        trigger.targetIds!.includes(id) &&
        !rulesetCombatant(ctx.state, id)?.actions.some(
          (action) =>
            action.reaction &&
            [action.reaction, ...(action.reaction.also ?? [])].some(
              (moment) => moment.on === trigger.kind && moment.for && moment.for !== "self",
            ),
        ),
    )
  ) {
    delete trigger.targetIds;
  }
  const serial = (ctx.state.windows ?? 0) + 1;
  ctx.state.windows = serial;
  // In the fight's OWN order, whatever order they were gathered in. Who is asked first decides who
  // answers with the most still on the board, so it is the fight's order rather than the order a
  // walk met them in or the order their damage happened to be written.
  const order = (id: string) => {
    const at = ctx.state.order.indexOf(id);
    return at < 0 ? ctx.state.order.length : at;
  };
  // A hit's own maker is asked last (1.241): what they add to it is chosen once it still lands.
  const last = (id: string) => (trigger.kind === "hit" && id === trigger.sourceId ? 1 : 0);
  const waiting = [...window.waiting].sort((left, right) => last(left) - last(right) || order(left) - order(right));
  // Opened inside a legendary cast (1.284): it holds the window the cast was bought in.
  ctx.state.window = {
    id: `w${serial}`,
    ...window,
    waiting,
    ...(ctx.outer && !window.outer ? { outer: ctx.outer } : {}),
  };
  const moment = rulesetWindowMoment(window.trigger);
  ctx.events.push({
    type: "window",
    window: ctx.state.window.id,
    kind: window.kind,
    // The order the window really holds, not the order it was handed: the two would otherwise
    // disagree about who is asked first, and the log is what a reader believes.
    waiting: [...waiting],
    ...(window.trigger.kind === "leaves-reach" ? { moverId: window.trigger.moverId } : {}),
    ...(moment ? { moment } : {}),
    ...(window.trigger.kind === "readied" ? { readied: window.trigger.on } : {}),
    ...("targetIds" in window.trigger && window.trigger.targetIds ? { targetIds: window.trigger.targetIds } : {}),
    ...("label" in window.trigger ? { label: window.trigger.label } : {}),
    ...("sourceId" in window.trigger ? { sourceId: window.trigger.sourceId } : {}),
    ...(window.trigger.kind === "hit" ? { total: window.trigger.total, defense: window.trigger.defense } : {}),
  });
}

/** Everybody whose reach this one step leaves, in the order the fight holds them. Re-read at every
 *  step, because a strike on the way may have spent somebody's budget or taken them out. */
function threatsLeaving(
  ctx: RulesetCombatContext,
  mover: RulesetCombatant,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): RulesetCombatant[] {
  // The same two questions the menu asked when it listed whom a walk provokes, asked again at every
  // step because a strike on the way can change who is still standing and who still has the budget.
  return rulesetThreateningEnemies(ctx.definition, ctx.combat, ctx.state, mover)
    .filter((threat) => rulesetStepLeavesReach(threat, from, to))
    .map((threat) => threat.combatant);
}

/** One strike at somebody walking away. It spends the declared budget and then resolves exactly as
 *  the same attack would on the striker's own turn, dice and all. True when it was held where it
 *  hit, with the walk's window, its striker answered, waiting behind the hit's. */
function opportunityStrike(
  ctx: RulesetCombatContext,
  striker: RulesetCombatant,
  mover: RulesetCombatant,
  budget: string,
): boolean {
  const strike = rulesetOpportunityAttack(striker);
  if (!strike) return false;
  ctx.events.push({ type: "opportunity", actorId: striker.id, targetId: mover.id, label: strike.label, budget });
  spendBudget(ctx, striker, budget);
  countAttack(ctx, striker);
  // A strike made in passing keeps the same books as one made on a turn: a use is a use.
  spendAvailability(ctx, striker, strike);
  // Held where it hits, like any other attack, for what its maker adds to it or anybody's answer to
  // it (1.243): the walk's window waits behind that one.
  ctx.nestHit = true;
  const hold = resolveAction(ctx, striker, strike, [mover]);
  delete ctx.nestHit;
  if (!hold) return false;
  const outer = ctx.state.window!;
  outer.waiting.shift();
  ctx.state.window = undefined;
  const resume: RulesetActionResume = {
    kind: "action",
    actorId: striker.id,
    optionId: strike.id,
    targetIds: [mover.id],
    outer,
  };
  openHitWindow(ctx, striker, strike, resume, hold, []);
  return true;
}

function resolveStandard(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: string,
  target: RulesetCombatant | undefined,
): void {
  // Hide and Ready are accepted and do nothing yet: one needs sight lines and the other a trigger
  // window, and both arrive with the slices that build them.
  // Anything else it does gives up what standing still was worth (1.292).
  if (action !== "hide") stirs(ctx, actor, "acted");
  if (action === "dodge") actor.flags.dodging = true;
  else if (action === "dash") {
    actor.flags.dashed = true;
    // The same allowance again, in a fight that has cells to spend it on.
    if (actor.movement !== undefined) grantRulesetMovement(ctx.definition, ctx.combat, actor, ctx.state);
  } else if (action === "disengage") actor.flags.disengaged = true;
  else if (action === "hide" && ctx.combat.hiding) {
    // Hiding for real (1.287): a Stealth check, hidden from each opponent it beats unseen.
    // A thief who has moved no more than half their speed hides with advantage, and a ranger
    // standing still adds what that is worth (1.292).
    const traits = rulesetHidingTraits(ctx.definition, actor);
    const slow =
      traits.slow &&
      actor.movement !== undefined &&
      actor.movement - (actor.movementLeft ?? 0) <= Math.floor(actor.movement / 2);
    const check = hidingCheck(
      ctx,
      actor,
      ctx.combat.hiding.stealth,
      slow ? { advantage: true, disadvantage: false } : undefined,
    );
    // Standing still is worth something only where what it needs holds (1.309): camouflage made
    // beforehand, and a wall or a tree to press against.
    const still = traits.still && stillHolds(ctx, actor, traits.stillWhile) ? traits.still : 0;
    if (still) check.total += still;
    // Something that begins the fight hidden in plain sight hides that way again (1.292).
    const plain = !!traits.starts;
    const from = ctx.state.combatants
      .filter((viewer) => rulesetStaysHidden(ctx.definition, ctx.state, viewer, actor, check.total, plain))
      .map((viewer) => viewer.id);
    if (from.length > 0) {
      actor.hiding = {
        total: check.total,
        from,
        ...(still ? { still } : {}),
        ...(plain ? { plain: true as const } : {}),
      };
    } else delete actor.hiding;
    ctx.events.push({ type: "standard", actorId: actor.id, action, check, from });
    return;
  } else if (action === "hide") actor.flags.hidden = true;
  else if (action === "search" && ctx.combat.hiding) {
    const { check, found, apart } = search(ctx, actor);
    ctx.events.push({ type: "standard", actorId: actor.id, action, check, found, ...(apart ? { apart } : {}) });
    return;
  } else if (action === "ready") actor.flags.ready = true;
  else if (action === "help" && target) target.flags.helped = true;
  ctx.events.push({
    type: "standard",
    actorId: actor.id,
    action,
    ...(action === "help" && target ? { targetId: target.id } : {}),
  });
}

/** A check of the fight's own `checks` thrown on its own (1.287), its number off the combatant. */
function hidingCheck(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  check: string,
  taken?: { advantage: boolean; disadvantage: boolean },
): RulesetContestSide {
  return throwCheck(ctx, who, check, who.checks?.[check] ?? 0, taken);
}

/**
 * Looking for whoever hides (1.287): a Perception check, and every opponent hidden from the searcher
 * whose Stealth total it meets is found by them.
 */
function search(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
): { check: RulesetContestSide; found: string[]; apart?: RulesetSearchApart[] } {
  const perception = ctx.combat.hiding!.perception;
  const check = hidingCheck(ctx, actor, perception);
  // Whoever makes looking for them harder or easier (1.290) is looked for with a throw of its own,
  // where that changes how it is thrown.
  const skill = rulesetCheckSkill(ctx.definition, perception);
  const ability = rulesetCheckAbility(ctx.definition, perception);
  const plain = check.mode ?? "normal";
  const throws = new Map<string, RulesetSearchApart>();
  const found: string[] = [];
  for (const other of ctx.state.combatants) {
    if (!rulesetHiddenFrom(actor, other)) continue;
    const taken = rulesetCheckTakenModes(ctx.definition, ctx.combat, other, ctx.state, skill);
    const mode = rulesetCheckMode(ctx.definition, ctx.combat, actor, ctx.state, skill, ability, taken);
    let mine = check;
    if (mode !== plain) {
      const own = throws.get(mode) ?? { ids: [], check: hidingCheck(ctx, actor, perception, taken) };
      own.ids.push(other.id);
      throws.set(mode, own);
      mine = own.check;
    }
    if (mine.total < other.hiding!.total) continue;
    found.push(other.id);
    loseHiding(other, [actor.id]);
  }
  return { check, found, ...(throws.size > 0 ? { apart: [...throws.values()] } : {}) };
}

/**
 * A board's light rule as a round ends (1.319): everybody standing wholly in one of its lights counts
 * one more round end there, and on every `rounds`th their tracks move and its conditions go on them.
 * Out of it, even in one cell's shade, the count starts again.
 */
function lightRuleAtRoundEnd(ctx: RulesetCombatContext): void {
  const board = ctx.state.board;
  const rule = board?.lightRule;
  if (!board || !rule) return;
  const exposed: Record<string, number> = {};
  for (const combatant of ctx.state.combatants) {
    if (combatant.defeated || !rulesetPositionOf(combatant)) continue;
    if (rule.spares && rulesetTargetIs(ctx.definition, combatant, rule.spares)) continue;
    const lights = rulesetFootprint(combatant).map((cell) => rulesetLightAt(ctx.definition, ctx.state, cell));
    if (!lights.every((light) => rule.in.some((wanted) => rulesetLightMatches(light, wanted)))) continue;
    const count = (board.exposed?.[combatant.id] ?? 0) + 1;
    if (count < rule.rounds) {
      exposed[combatant.id] = count;
      continue;
    }
    const caught: Extract<RulesetCombatEvent, { type: "lightRule" }> = {
      type: "lightRule",
      actorId: combatant.id,
      ...(rule.label ? { label: rule.label } : {}),
      light: lights[0]!,
      rounds: rule.rounds,
    };
    ctx.events.push(caught);
    // A made save escapes it this time (1.321): Noonfield's Constitution save, a straw hat's advantage.
    if (rule.save) {
      const from = ctx.events.length;
      const saved = rollSave(ctx, combatant, rule.save.save, rule.save.difficulty, undefined, null, rule.save.against);
      // Said with it, as it went (its total, legendary resistance or not).
      const thrown = ctx.events
        .slice(from)
        .find(
          (event): event is Extract<RulesetCombatEvent, { type: "save" }> =>
            event.type === "save" && event.actorId === combatant.id,
        );
      caught.save = { total: thrown?.total ?? 0, saved };
      if (saved) continue;
    }
    for (const moved of rule.tracks ?? []) {
      if (combatant.defeated) continue;
      // No further than its most (1.321): exhaustion 3 at most.
      let by = moved.by;
      if (moved.upTo !== undefined) {
        const declared = ctx.definition.sheet.live.tracks.find((entry) => entry.id === moved.track);
        const start = declared?.default ?? declared?.min ?? 0;
        const now = combatant.sheet
          ? trackValue(ctx, combatant, moved.track)
          : (combatant.tracks?.[moved.track] ?? start);
        by = by > 0 ? Math.min(by, moved.upTo - now) : Math.max(by, moved.upTo - now);
        if ((moved.by > 0 && by <= 0) || (moved.by < 0 && by >= 0)) continue;
      }
      moveTrack(ctx, combatant, combatant, moved.track, by);
    }
    for (const condition of rule.applies ?? []) {
      if (!combatant.defeated) applyConditionId(ctx, combatant, condition, { condition, duration: "instant" });
    }
  }
  if (Object.keys(exposed).length) board.exposed = exposed;
  else delete board.exposed;
}

/**
 * A hider moving or acting (1.292): what standing still added to its total is gone, and somebody
 * hidden in plain sight that moves is hidden no more. Whether the smaller total still hides it is
 * asked as every step ends, and on every cell of a walk.
 */
function stirs(ctx: RulesetCombatContext, actor: RulesetCombatant, how: "moved" | "acted"): void {
  // What moving, or doing anything at all, takes off them (1.303): One with Shadows.
  for (const entry of actor.tracked.filter((one) =>
    how === "moved" ? one.endsWhenHolder?.moves : one.endsWhenHolder?.acts,
  )) {
    if (actor.tracked.includes(entry)) removeCondition(ctx, actor, entry.condition, "spent");
  }
  // And what its rule says moving or acting ends, however it was put on (1.311): camouflage.
  for (const condition of rulesetCombatConditions(ctx.definition, actor)) {
    const ends = ctx.combat.conditions?.find((rule) => rule.condition === condition)?.endsWhenHolder;
    if (how === "moved" ? ends?.moves : ends?.acts) removeCondition(ctx, actor, condition, "spent");
  }
  const hiding = actor.hiding;
  if (!hiding) return;
  if (hiding.plain && how === "moved") {
    ctx.events.push({ type: "revealed", actorId: actor.id, byIds: [...hiding.from], reason: "moved" });
    delete actor.hiding;
    return;
  }
  if (hiding.still) {
    hiding.total -= hiding.still;
    delete hiding.still;
  }
}

/** A hider moving near something that `alerts` (1.319): a Wind-Chime held by an opponent rings,
 *  and they are hidden from nobody. */
function chimes(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const hiding = actor.hiding;
  const perCell = ctx.combat.distance?.perCell;
  if (!hiding || perCell === undefined) return;
  const holder = ctx.state.combatants.find((one) => {
    if (one.id === actor.id || one.side === actor.side || one.defeated || !rulesetPositionOf(one)) return false;
    const reach = Math.max(
      0,
      ...rulesetActiveConditions(ctx.definition, ctx.combat, one, ctx.state).map((source) => source.alerts ?? 0),
    );
    return reach > 0 && rulesetGap(actor, one) <= rulesetInCells(reach, perCell);
  });
  if (!holder) return;
  ctx.events.push({
    type: "revealed",
    actorId: actor.id,
    byIds: [...hiding.from],
    reason: "alerted",
    alertedBy: holder.id,
  });
  delete actor.hiding;
}

/** What Hide in Plain Sight needs (1.309): the condition its camouflage is, and something solid
 *  beside its holder that blocks sight. */
function stillHolds(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  rule: { holds?: string; wall?: true } | undefined,
): boolean {
  if (!rule) return true;
  if (rule.holds !== undefined && !rulesetCombatConditions(ctx.definition, actor).includes(rule.holds)) return false;
  if (rule.wall) {
    const grid = ctx.state.board?.grid;
    if (!grid) return false;
    const own = rulesetFootprint(actor);
    const mine = new Set(own.map((cell) => `${cell.x},${cell.y}`));
    const beside = own.some((cell) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const x = cell.x + dx!;
        const y = cell.y + dy!;
        if (mine.has(`${x},${y}`) || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
        return blocksSight(grid, x, y);
      }),
    );
    if (!beside) return false;
  }
  return true;
}

/** No longer hidden from these opponents (1.287), and no longer hiding once that is nobody. */
function loseHiding(hider: RulesetCombatant, byIds: string[]): void {
  if (!hider.hiding) return;
  const from = hider.hiding.from.filter((id) => !byIds.includes(id));
  if (from.length > 0) hider.hiding.from = from;
  else delete hider.hiding;
}

/**
 * Whether using this action gives its hiding user away (1.287): an attack, anything harming somebody
 * or asking them to save, or anything needing one of the ruleset's `noisy` components (5e's verbal).
 * A fog set down in silence is no giveaway.
 */
function givesAway(ctx: RulesetCombatContext, action: RulesetCombatAction): "attack" | "noise" | undefined {
  if (
    action.toHit !== undefined ||
    action.autoHit ||
    action.sequence ||
    action.contest ||
    action.damage ||
    action.save
  ) {
    return "attack";
  }
  const noisy = ctx.combat.hiding?.noisy ?? [];
  return action.components?.some((component) => noisy.includes(component)) ? "noise" : undefined;
}

/**
 * After every step (1.287): whoever gave themselves away is hidden from nobody, and each opponent
 * that now sees somebody clearly, or whose passive Perception now beats their total, finds them.
 */
function syncHiding(ctx: RulesetCombatContext): void {
  if (!ctx.combat.hiding) return;
  for (const [id, reason] of ctx.giveaways ?? []) {
    const hider = rulesetCombatant(ctx.state, id);
    if (!hider?.hiding) continue;
    ctx.events.push({ type: "revealed", actorId: id, byIds: [...hider.hiding.from], reason });
    delete hider.hiding;
  }
  ctx.giveaways?.clear();
  for (const hider of ctx.state.combatants) recheckHiding(ctx, hider);
}

/** Each opponent a hider is hidden from that now sees them clearly, or whose passive Perception now
 *  beats their total, finds them (1.287): after a step, and on every cell of a walk. */
function recheckHiding(ctx: RulesetCombatContext, hider: RulesetCombatant): void {
  if (!ctx.combat.hiding || !hider.hiding) return;
  // Nobody down is hiding any more.
  if (hider.defeated) {
    delete hider.hiding;
    return;
  }
  const total = hider.hiding.total;
  const seen = hider.hiding.from.filter((id) => {
    const viewer = rulesetCombatant(ctx.state, id);
    // Somebody gone from the fight for good finds nothing, and is dropped; somebody down is not
    // looking, and keeps not knowing.
    if (!viewer) return true;
    if (viewer.defeated) return false;
    return !rulesetStaysHidden(ctx.definition, ctx.state, viewer, hider, total);
  });
  if (seen.length === 0) return;
  const byIds = seen.filter((id) => rulesetCombatant(ctx.state, id));
  if (byIds.length > 0) ctx.events.push({ type: "revealed", actorId: hider.id, byIds, reason: "seen" });
  loseHiding(hider, seen);
}

/**
 * A sequence: the other actions it names, in order, for the one budget that was already spent.
 *
 * Targets are handed out in order when there are enough for every part, and otherwise every part
 * takes the ones at the front of the list, so a single id sends the whole sequence at one opponent.
 * A part whose target is already down by the time it comes round simply does not land: nothing here
 * picks a new one, because choosing is the caller's job.
 */
function resolveSequence(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  held?: RulesetHeldAttack,
  /** The initiative style the whole sequence is made in: every part in it. */
  styleId?: string,
): RulesetHitHold | null {
  const byId = new Map(actor.actions.map((entry) => [entry.id, entry]));
  const parts: RulesetCombatAction[] = [];
  for (const step of action.sequence ?? []) {
    const named = byId.get(step.actionId);
    // A part that names another sequence is refused at import, so this is a hand-written block
    // pointing at nothing, and it costs that part rather than the turn.
    if (!named || named.sequence) continue;
    for (let time = 0; time < step.times; time++) parts.push(named);
  }
  const wanted = parts.reduce((total, part) => total + part.targets.count, 0);
  const enough = targets.length >= wanted;
  let cursor = 0;
  for (const [index, part] of parts.entries()) {
    const count = part.targets.count;
    const chosen = (enough ? targets.slice(cursor, cursor + count) : targets.slice(0, count)).filter(
      (target) => !target.defeated || rulesetCanRevive(ctx.state, part, target),
    );
    cursor += count;
    // A sequence picked up after one of its parts was held starts at that part, which was paid for
    // and has its roll already: every part before it has happened.
    if (held && index < (held.part ?? 0)) continue;
    const resuming = held && index === (held.part ?? 0) ? held : undefined;
    if (!resuming) {
      // One budget for the whole sequence, and each part still keeps its own books: a part that
      // counts its uses spends one, a part that recharges is spent until its dice bring it back, and
      // a part that has none left simply does not happen.
      if (chosen.length === 0 || !rulesetSequencePartAvailable(actor, part)) continue;
      // A cap on attacks a turn (combat C6d) ends the sequence at the attacks it allows.
      if (part.toHit !== undefined && attacksCapped(ctx, actor)) break;
      spendAvailability(ctx, actor, part);
      if (part.toHit !== undefined) countAttack(ctx, actor);
    }
    const hold = resolveAction(ctx, actor, part, chosen, undefined, resuming, styleId);
    if (hold) return { ...hold, part: index };
  }
  return null;
}

/**
 * Budgets handed to somebody the moment they use the thing that hands them over.
 *
 * Capped where they land, at what a turn holds plus the gift, so a budget saved up over three turns
 * and then spent all at once is not a thing this can be used to do.
 */
function grantBudgets(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  for (const gift of action.gives ?? []) {
    const declared = ctx.combat.economy.budgets.find((budget) => budget.id === gift.budget);
    // A budget the economy no longer declares is a catalog read by a later ruleset: it hands over
    // nothing rather than inventing a budget nothing else in the fight knows about.
    if (!declared) continue;
    // What a turn holds is what the actor's conditions make of it (combat C6d), so a condition that
    // raises the budget does not swallow the gift.
    const change = rulesetConditionEconomy(ctx.definition, ctx.combat, actor, ctx.state).budgets.get(gift.budget) ?? 0;
    const turn = Math.max(0, declared.count + change);
    const left = Math.min((actor.budgets[gift.budget] ?? 0) + gift.count, turn + gift.count);
    actor.budgets[gift.budget] = left;
    ctx.events.push({
      type: "gives",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      budget: gift.budget,
      left,
    });
  }
}

/** Whether an ally of this one could help with a blow at that target: standing, able to act, and,
 *  on a board, within one cell of the target. Without a board there is no distance to read, so any
 *  ally still on their feet is beside them as far as the fight is concerned. */
function allyAdjacent(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant): boolean {
  const at = rulesetPositionOf(target);
  const positioned = !!ctx.state.board?.grid && !!at;
  return ctx.state.combatants.some((combatant) => {
    if (combatant.id === actor.id || combatant.side !== actor.side) return false;
    if (!rulesetCombatStanding(combatant)) return false;
    if (rulesetCombatEffects(ctx.definition, ctx.combat, combatant, ctx.state).has("cannot-act")) return false;
    if (!positioned) return true;
    // Beside any cell the target fills (1.194).
    return !!rulesetPositionOf(combatant) && rulesetGap(combatant, target) <= 1;
  });
}

/**
 * The rider that adds itself to this blow, or null.
 *
 * The FIRST qualifying hit of the period takes it: a rider fires once, automatically, and choosing
 * when to spend it is a window, which is a later slice. Marked as fired here, because the blow it
 * joins is the one it fired on.
 */
function firingRider(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  mode: RulesetCombatRollMode,
): RulesetCombatRider | null {
  const spent = actor.ridersSpent ?? [];
  for (const rider of actor.riders ?? []) {
    if (rider.on !== "hit" || spent.includes(rider.id)) continue;
    if (rider.actions && !rider.actions.includes(action.id)) continue;
    // Any-of: one of the things it asked for being true is enough.
    if (
      rider.when?.length &&
      !rider.when.some((when) =>
        when === "advantage"
          ? mode === "advantage"
          : allyAdjacent(ctx, actor, target) && (when !== "ally-adjacent-no-disadvantage" || mode !== "disadvantage"),
      )
    ) {
      continue;
    }
    actor.ridersSpent = [...spent, rider.id];
    return rider;
  }
  return null;
}

/**
 * What its holder just finished doing takes these conditions off (1.180): an attack, or casting from
 * a catalog one names, a scroll's spell included. Whatever the attack or the spell rolled had them
 * still. What a standing zone does on its own is not its caster acting.
 */
function holderActed(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  /** What they held before it: one it put on them itself (Invisibility cast on oneself) stays. */
  before?: ReadonlySet<RulesetTrackedCondition>,
): void {
  if (ctx.byZone) return;
  const attacks = rulesetIsAttack(action);
  const casts = action.catalog ?? action.casts;
  const ended = actor.tracked.filter(
    (entry) =>
      (!before || before.has(entry)) &&
      ((entry.endsWhenHolder?.attacks && attacks) ||
        (casts !== undefined && !!entry.endsWhenHolder?.casts?.includes(casts)) ||
        // One of its holder's own actions or entries by name (1.307): a quasit's Scare.
        !!entry.endsWhenHolder?.uses?.some((used) => used === action.id || used === action.entry)),
  );
  for (const entry of ended) {
    if (actor.tracked.includes(entry)) removeCondition(ctx, actor, entry.condition, "spent");
  }
}

function resolveAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  payWith?: string,
  /** Picking up an attack held after one of its rolls hit: that roll, then the targets after it. */
  held?: RulesetHeldAttack,
  /** The initiative style it was chosen in. An attack made out of a turn, in a window, is made in the
   *  first style its maker may use. */
  styleId?: string,
  /** The number a spending blow throws, read as it was made. */
  spend?: number,
): RulesetHitHold | null {
  // What shakes surprise off, taken first (1.237): the rest of the turn is a turn like any other.
  if (actor.surprised && actor.surpriseOut?.includes(action.id)) endSurprise(ctx, actor, action.label);
  // Its light lit or put out (1.296), and nothing else: what it shows is asked as the step ends.
  if (action.sheds !== undefined) {
    actor.shedding = action.sheds === "out" ? "out" : { ...action.sheds };
    ctx.events.push({
      type: "switch",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      on: action.sheds !== "out",
    });
    return null;
  }
  // Creatures called beside it (1.325), and nothing else: Jars Burst.
  if (action.calls && !action.area && !action.damage) {
    callCreatures(ctx, actor, action);
    return null;
  }
  // A legendary Detect (1.287): the looking, and nothing else.
  if (action.search) {
    if (ctx.combat.hiding) {
      const { check, found, apart } = search(ctx, actor);
      ctx.events.push({
        type: "search",
        actorId: actor.id,
        label: action.label,
        check,
        found,
        ...(apart ? { apart } : {}),
      });
    }
    return null;
  }
  // Somebody using something, for what was readied for it (1.288).
  if (ctx.combat.readying) (ctx.acted ??= new Set()).add(actor.id);
  // Hiding, and giving it away (1.287): found out once the step is done.
  stirs(ctx, actor, "acted");
  const giveaway = actor.hiding ? givesAway(ctx, action) : undefined;
  if (giveaway) (ctx.giveaways ??= new Map()).set(actor.id, giveaway);
  const before = new Set(actor.tracked);
  // What it was cast out of, for a condition that harm from there ends (1.278).
  const harming = ctx.harming;
  const from = action.catalog ?? action.casts;
  if (from) ctx.harming = { catalog: from, applies: (action.applies ?? []).map((one) => one.condition) };
  else delete ctx.harming;
  let result: RulesetHitHold | null;
  try {
    result = resolveActionFalling(ctx, actor, action, targets, payWith, held, styleId, spend);
  } finally {
    if (harming) ctx.harming = harming;
    else delete ctx.harming;
  }
  // Gone once the rest is done (1.276).
  if (!result && action.teleport && ctx.teleport) teleport(ctx, actor, action);
  // Finished, rather than held for an answer to one of its rolls (1.180).
  if (!result) holderActed(ctx, actor, action, before);
  if (!result && action.endsCondition) endOwnCondition(ctx, actor, action.endsCondition);
  return result;
}

/**
 * A teleport (1.276): its user is set down on the cell chosen, with no step between, so nobody gets a
 * strike at them leaving, and whoever went along lands as near them as there is room, nearest first.
 * A zone they land in catches them as walking in would. Somebody who could not stand there any more,
 * or who has been taken out since it was chosen, stays where they are.
 */
function teleport(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  const { to, carries } = ctx.teleport!;
  delete ctx.teleport;
  if (!to) {
    if (!action.teleport?.leaves || !rulesetCombatStanding(actor)) return;
    // Out of the fight (1.279), and whoever goes along with it.
    const along = carries
      .map((id) => rulesetCombatant(ctx.state, id))
      .filter((one): one is RulesetCombatant => !!one && rulesetCombatStanding(one) && !one.away);
    leaveFight(ctx, actor, action);
    for (const one of along) leaveFight(ctx, one, action, actor.id);
    return;
  }
  const grid = ctx.state.board?.grid;
  const from = rulesetPositionOf(actor);
  if (!grid || !from || !rulesetCombatStanding(actor) || !rulesetRoomAt(ctx.state, grid, actor, to)) return;
  // A cloud where it left and where it lands (1.279), until the end of its next turn.
  if (action.teleport?.smoke) {
    const cells = new Map<string, RulesetCombatCell>();
    for (const cell of [...rulesetFootprint(actor), ...rulesetFootprintAt(to, rulesetSpanOf(actor))])
      cells.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
    (actor.zones ??= []).push({
      actionId: action.id,
      label: action.label,
      rounds: 1,
      anchor: "point",
      triggers: [],
      at: { ...to },
      cells: [...cells.values()],
      obscures: {
        pierced: [...(action.teleport.smoke.pierced ?? [])],
        ...(action.teleport.smoke.light ? { light: true as const } : {}),
        ...(action.teleport.smoke.dispersed
          ? { dispersed: rulesetCopyDispersed(action.teleport.smoke.dispersed) }
          : {}),
      },
    });
    (actor.flags.freshZones ??= []).push(action.id);
  }
  const set = (one: RulesetCombatant, at: RulesetCombatCell, was: RulesetCombatCell, by?: string) => {
    const before = zonesAround(ctx);
    one.x = at.x;
    one.y = at.y;
    if (one.altitude !== undefined && !rulesetAirborne(grid, one)) delete one.altitude;
    ctx.events.push({
      type: "teleported",
      actorId: one.id,
      from: { ...was },
      to: { ...at },
      label: action.label,
      ...(by ? { by } : {}),
    });
    zonesEntered(ctx, one, before);
  };
  set(actor, to, from);
  for (const id of carries) {
    const one = rulesetCombatant(ctx.state, id);
    const was = rulesetPositionOf(one);
    if (!one || !was || !rulesetCombatStanding(one) || !rulesetCombatStanding(actor)) continue;
    let spot: RulesetCombatCell | null = null;
    const here = rulesetPositionOf(actor)!;
    for (let reach = 1; reach <= Math.max(grid.width, grid.height) && !spot; reach++) {
      for (let y = here.y - reach; y <= here.y + reach && !spot; y++) {
        for (let x = here.x - reach; x <= here.x + reach; x++) {
          if (Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) !== reach) continue;
          if (!rulesetRoomAt(ctx.state, grid, one, { x, y })) continue;
          spot = { x, y };
          break;
        }
      }
    }
    if (spot) set(one, spot, was, actor.id);
  }
}

/** Gone from the fight alive, of its own accord (1.279): a teleport that leaves it. Nothing brings
 *  it back, and what it held up ends as it would for one sent away. */
function leaveFight(ctx: RulesetCombatContext, one: RulesetCombatant, action: RulesetCombatAction, by?: string): void {
  one.defeated = true;
  one.away = { by: by ?? one.id, label: action.label, left: true };
  ctx.events.push({ type: "left", actorId: one.id, label: action.label, ...(by ? { by } : {}) });
  endSummons(ctx, one);
  endZones(ctx, one);
  endConcentration(ctx, one, "spent");
  endConditionsFromSource(ctx, one);
}

/** Out of the fight, alive (1.236): for good, or while it holds what the same use put on it, whose
 *  clock then runs on its sender's turns since it takes none of its own. What it held up ends. */
function dismiss(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  const rule = action.dismisses;
  if (!rule || target.defeated) return;
  const held =
    rule === true
      ? undefined
      : target.tracked.find((entry) => entry.condition === rule.while && entry.source === actor.id);
  // Kept off what it is away under, it stays.
  if (rule !== true && !held) return;
  if (held && held.rounds !== null) held.clockOf = "source";
  target.defeated = true;
  target.away = {
    by: actor.id,
    label: action.label,
    ...(rule !== true
      ? {
          while: rule.while,
          ...(rule.gone ? { gone: structuredClone(rule.gone) } : {}),
          // Still taking its turns away (1.313): Maze.
          ...(rule.turns ? { turns: true as const } : {}),
        }
      : {}),
  };
  ctx.events.push({
    type: "dismissed",
    actorId: actor.id,
    targetId: target.id,
    label: action.label,
    ...(rule !== true ? { while: rule.while } : {}),
  });
  endSummons(ctx, target);
  endZones(ctx, target);
  endConcentration(ctx, target, "spent");
  endConditionsFromSource(ctx, target);
}

/** Back from being sent away, when what kept it there ends (1.236): where it was, or the nearest
 *  free place its size fits. One that is `gone` stays away if its time ran out. */
function bringBack(ctx: RulesetCombatContext, target: RulesetCombatant, reason: string): void {
  const away = target.away;
  if (!away?.while) return;
  if (reason === "expired" && away.gone && rulesetTargetIs(ctx.definition, target, away.gone)) {
    delete away.while;
    ctx.events.push({ type: "returned", targetId: target.id, gone: true });
    return;
  }
  delete target.away;
  target.defeated = false;
  const at = rulesetPositionOf(target);
  const grid = ctx.state.board?.grid;
  if (at && grid) {
    const span = rulesetSpanOf(target);
    const fits = (x: number, y: number) =>
      rulesetFootprintAt({ x, y }, span).every(
        (cell) =>
          !rulesetCellBlocked(grid, cell.x, cell.y) &&
          !ctx.state.combatants.some((other) => other !== target && !other.defeated && rulesetFills(other, cell)),
      );
    let best: RulesetCombatCell | null = fits(at.x, at.y) ? at : null;
    for (let reach = 1; reach <= Math.max(grid.width, grid.height) && !best; reach++) {
      for (let y = at.y - reach; y <= at.y + reach && !best; y++) {
        for (let x = at.x - reach; x <= at.x + reach; x++) {
          if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== reach || !fits(x, y)) continue;
          best = { x, y };
          break;
        }
      }
    }
    if (best) {
      target.x = best.x;
      target.y = best.y;
    }
  }
  ctx.events.push({ type: "returned", targetId: target.id });
}

/** No longer surprised (1.237): the first turn is over, or something shook it off. */
function endSurprise(ctx: RulesetCombatContext, actor: RulesetCombatant, label?: string): void {
  if (!actor.surprised) return;
  delete actor.surprised;
  delete actor.surpriseOut;
  ctx.events.push({ type: "surpriseOver", actorId: actor.id, ...(label ? { label } : {}) });
}

/** A use that ends the condition that gave it (1.236): with the concentration holding it, when that
 *  is its user's own, so the spell is over and not only its mark. */
function endOwnCondition(ctx: RulesetCombatContext, actor: RulesetCombatant, condition: string): void {
  const held = actor.tracked.find((entry) => entry.condition === condition);
  if (held?.concentration && held.source === actor.id && actor.concentrating) {
    endConcentration(ctx, actor, "spent");
  }
  removeCondition(ctx, actor, condition, "spent");
}

function resolveActionFalling(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  payWith?: string,
  held?: RulesetHeldAttack,
  styleId?: string,
  spend?: number,
): RulesetHitHold | null {
  // A sequence's blows are separate events. Ordinary single-faller entries keep their old path.
  if (
    ctx.falling ||
    action.sequence ||
    !ctx.state.combatants.some((one) =>
      one.actions.some(
        (answer) =>
          answer.targets.count > 1 &&
          answer.reaction &&
          [answer.reaction, ...(answer.reaction.also ?? [])].some((moment) => moment.on === "falls"),
      ),
    )
  )
    return resolveActionBody(ctx, actor, action, targets, payWith, held, styleId, spend);
  ctx.falling = [];
  const result = resolveActionBody(ctx, actor, action, targets, payWith, held, styleId, spend);
  const falling = ctx.falling;
  delete ctx.falling;
  fallTogether(ctx, falling);
  return result;
}

/** Whether a clause of a blow reaches this target: one that is what it names and not what it is kept
 *  off (1.187), on a blow struck the way it says (1.187). */
function clauseReaches(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  action: RulesetCombatAction,
  clause: RulesetCombatDamageClause,
): boolean {
  if (!rulesetTargetIs(ctx.definition, target, clause.targetIs)) return false;
  if (clause.not && rulesetTargetIs(ctx.definition, target, clause.not)) return false;
  // Only on a target the maker marked (1.189): an oathbow's sworn enemy.
  if (clause.marked !== undefined && !rulesetMarkedBy(target, clause.marked, actor.id)) return false;
  return !clause.blow || rulesetBlowKind(ctx.state, actor, target, action) === clause.blow;
}

/** Whether something its maker may do once a turn is still to be done in this one, noting it done
 *  when it is (1.187). Any turn counts, the maker's own or anybody else's. */
function spendOncePerTurn(ctx: RulesetCombatContext, actor: RulesetCombatant, key: string): boolean {
  const at = `${ctx.state.round}:${ctx.state.turn}`;
  if (actor.oncePerTurn?.at !== at) actor.oncePerTurn = { at, keys: [] };
  if (actor.oncePerTurn.keys.includes(key)) return false;
  actor.oncePerTurn.keys.push(key);
  return true;
}

/** A blow that slays (1.187): somebody it may kill, left at its health or less, dies outright on a
 *  failed save where it asks one, and the item spends what slaying costs it. One immune to a kind of
 *  harm it names is spared, and one with too few charges left is never asked. */
function slayOnHit(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  entry: NonNullable<RulesetCombatAction["slay"]>[number],
  critical: boolean,
): void {
  if (target.defeated || (entry.when === "critical" && !critical)) return;
  if (!rulesetTargetIs(ctx.definition, target, entry.is)) return;
  if (entry.not && rulesetTargetIs(ctx.definition, target, entry.not)) return;
  if (entry.immuneTo?.length) {
    // Immune as the blow finds them: what it carries past an exception counts.
    const hide = rulesetCombatHide(ctx.definition, target, ctx.state);
    const qualities = action.damage?.qualities;
    if (entry.immuneTo.some((type) => matches(hide.immune, type.trim().toLowerCase(), qualities))) return;
  }
  if (entry.healthAtMost !== undefined && healthOf(ctx, target).value > entry.healthAtMost) return;
  const charges = entry.charges;
  const left = charges
    ? (actor.charges?.[charges.item] ?? actor.sheet?.items?.[charges.item]?.charges ?? charges.max)
    : 0;
  if (charges && left < charges.cost) return;
  if (entry.save && rollSave(ctx, target, entry.save.save, entry.save.difficulty, actor.id)) {
    // Spared, it takes what a made save leaves instead (1.192): a mace of disruption's fright.
    for (const applies of entry.saved ?? []) {
      applyConditionId(ctx, target, applies.condition, applies, {
        sourceId: actor.id,
        difficulty: entry.save.difficulty,
        action: [action.id, action.label],
      });
    }
    return;
  }
  slay(ctx, target, actor.id, action.label);
  if (charges) {
    const now = Math.max(0, Math.min(charges.max, left) - charges.cost);
    (actor.charges ??= {})[charges.item] = now;
    ctx.events.push({
      type: "uses",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      left: now,
      of: charges.max,
    });
  }
}

/**
 * Who an action's health pool or health ceiling leaves alone (1.196). A pool is rolled once, then
 * shared out from the least health left upward: each is affected only while their health is no more
 * than what remains, which they use up, and the rest are passed over, as 5e's Sleep takes the weakest
 * first. A ceiling passes over anybody with more health than it.
 */
function sparedByHealth(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  extra?: { amount: RulesetCombatAmount; times: number },
): Set<string> {
  const spared = new Set<string>();
  if (action.healthAtMost !== undefined) {
    for (const target of targets) if (healthOf(ctx, target).value > action.healthAtMost) spared.add(target.id);
  }
  if (action.healthPool) {
    const rolled = rollAmount(ctx, action.healthPool, extra);
    let left = rolled.total;
    const affected: string[] = [];
    // Who it passes over uses none of it (1.199).
    const skips = action.healthPoolSkips;
    const passedOver = (target: RulesetCombatant) =>
      (!!skips?.conditions &&
        rulesetCombatConditions(ctx.definition, target).some((condition) => skips.conditions!.includes(condition))) ||
      (!!skips?.unseeing && !rulesetCanSee(ctx.definition, ctx.state, target, actor));
    // A stable sort, so those with as much health as each other are taken in the order picked.
    for (const target of [...targets].sort((a, b) => healthOf(ctx, a).value - healthOf(ctx, b).value)) {
      if (spared.has(target.id)) continue;
      if (passedOver(target)) {
        spared.add(target.id);
        continue;
      }
      const health = healthOf(ctx, target).value;
      if (health > left) {
        spared.add(target.id);
        continue;
      }
      left -= health;
      affected.push(target.id);
    }
    ctx.events.push({
      type: "healthPool",
      actorId: actor.id,
      label: action.label,
      rolls: rolled.rolls,
      total: rolled.total,
      affected,
    });
  }
  return spared;
}

/** Killed outright (1.187): no health left, and dead rather than dying, whichever side they are on. */
/** What an action ends on its target: up to `count` of `conditions`, only as put on by `from`. */
function endConditionsOf(
  ctx: RulesetCombatContext,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  ends: { conditions: string[]; count?: number },
  /** The level it was paid at, for a condition only a cure of some level ends (1.261). */
  level: number,
): void {
  let left = ends.count ?? ends.conditions.length;
  for (const condition of ends.conditions) {
    if (left <= 0) break;
    // Only a cure of its catalogs, at its level or higher, ends it (1.261).
    const only = ctx.combat.conditions?.find((entry) => entry.condition === condition)?.curedOnlyBy;
    if (only && (level < only.minLevel || (only.catalogs && !only.catalogs.includes(action.catalog ?? "")))) continue;
    // Only what a creature that is `from` put on (1.236); the same held from another stays on.
    const by = (entry: RulesetTrackedCondition) =>
      entry.condition === condition && rulesetPutOnBy(ctx.definition, ctx.state, entry, action.ends?.from);
    if (!target.tracked.some(by)) continue;
    if (target.tracked.some((entry) => entry.condition === condition && !by(entry))) {
      for (const entry of target.tracked.filter(by)) {
        // Cured, what an aura put on keeps that aura off them where it says so (1.269).
        if (entry.auraSafeOnEnd && !target.auraSafe?.includes(entry.auraSafeOnEnd))
          target.auraSafe = [...(target.auraSafe ?? []), entry.auraSafeOnEnd];
      }
      target.tracked = target.tracked.filter((entry) => !by(entry));
    } else removeCondition(ctx, target, condition, "cured");
    left--;
  }
}

/** Every point of health, temporary ones too, gone at once. */
function emptyHealth(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const before = healthOf(ctx, target);
  if (target.sheet) {
    if (!("track" in ctx.combat.health) && before.value + before.temp > 0) {
      writeHealthLoss(ctx, target, before.value + before.temp, undefined);
    }
  } else if (target.health) {
    target.health.temp = 0;
    target.health.value = 0;
  }
}

/** Down to 0 health at once (1.245), to fall as a blow that took it all would leave them: a creature
 *  is out, a character dying where the ruleset has a dying rule. */
function dropToNothing(ctx: RulesetCombatContext, target: RulesetCombatant, sourceId: string, label: string): void {
  if (target.defeated) return;
  emptyHealth(ctx, target);
  ctx.events.push({ type: "dropped", actorId: sourceId, targetId: target.id, label });
  if (!target.down) dropToZero(ctx, target);
}

/** Whether a creature's threat tier is at or below the highest of `destroysUpTo` its applier's
 *  sheet reaches (1.266). A character, or a creature with no tier, never is. */
function destroyedByTier(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  applies: RulesetCombatApplies,
): boolean {
  const tiers = ctx.combat.threat?.tiers;
  if (!applies.destroysUpTo || !tiers || target.sheet || !target.block?.tier) return false;
  const at = tiers.findIndex((tier) => tier.id === target.block!.tier);
  if (at < 0) return false;
  const reached = applies.destroysUpTo
    .filter((row) => rulesetSheetWithin(ctx.definition, actor, row.when))
    .map((row) => tiers.findIndex((tier) => tier.id === row.tier));
  return reached.length > 0 && at <= Math.max(...reached);
}

/** Everybody within its reach of the one a blow hit, that one too and its maker where it reaches
 *  them, saves or takes its condition (1.312): a Hammer of Thunderbolts' clap. Off a board, only
 *  the one hit. */
function clapAround(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  hit: RulesetCombatant,
  around: RulesetCombatAroundHit,
  against: RulesetSaveAgainst,
): void {
  const caught = ctx.state.board?.grid
    ? ctx.state.combatants.filter(
        (one) => rulesetCombatStanding(one) && (one.id === hit.id || rulesetGap(hit, one) <= around.within),
      )
    : [hit];
  for (const one of caught) {
    if (!rulesetCombatStanding(one)) continue;
    if (
      rollSave(ctx, one, around.save.save, around.save.difficulty, actor.id, undefined, {
        ...against,
        conditions: [...(against.conditions ?? []), around.condition],
      })
    )
      continue;
    applyConditionId(
      ctx,
      one,
      around.condition,
      {
        condition: around.condition,
        duration: around.rounds ? { rounds: around.rounds, ...(around.of ? { of: around.of } : {}) } : "instant",
      },
      { sourceId: actor.id, action: against.action },
    );
  }
}

function slay(ctx: RulesetCombatContext, target: RulesetCombatant, sourceId: string, label: string): void {
  emptyHealth(ctx, target);
  // Nobody dies on Held Ground (1.323): felled, not slain.
  if (ctx.state.heldGround && !target.object) {
    if (!target.down) dropToZero(ctx, target, true);
    return;
  }
  ctx.events.push({ type: "slain", actorId: sourceId, targetId: target.id, label });
  if (!target.down) dropToZero(ctx, target, true);
  if (target.defeated) return;
  target.defeated = true;
  target.dying = false;
  target.stable = false;
  target.diedRound = ctx.state.round;
  endSummons(ctx, target);
  endZones(ctx, target);
  unconjureAll(ctx, target);
}

/** An action with its charge added to it (1.186): the clauses after its own, the charge's save as one
 *  that keeps the blow's damage whole, and the push and conditions that follow a failed one. */
function chargedAction(action: RulesetCombatAction, charge: RulesetCombatCharge): RulesetCombatAction {
  return {
    ...action,
    ...(action.damage && charge.plus
      ? { damage: { ...action.damage, plus: [...(action.damage.plus ?? []), ...charge.plus] } }
      : {}),
    ...(charge.save ? { save: { ...charge.save, onSuccess: "none" as const } } : {}),
    ...(charge.push !== undefined ? { push: charge.push } : {}),
    ...(charge.applies ? { applies: [...(action.applies ?? []), ...charge.applies] } : {}),
  };
}

function resolveActionBody(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  payWith?: string,
  /** Picking up an attack held after one of its rolls hit: that roll, then the targets after it. */
  held?: RulesetHeldAttack,
  /** The initiative style it was chosen in. An attack made out of a turn, in a window, is made in the
   *  first style its maker may use. */
  styleId?: string,
  /** The number a spending blow throws, read as it was made. */
  spend?: number,
): RulesetHitHold | null {
  if (action.sequence) {
    return resolveSequence(
      ctx,
      actor,
      action,
      targets,
      held,
      styleId ?? rulesetAttackStyles(ctx.combat, actor, action)[0]?.id,
    );
  }
  // What a creature deals with both hands, or bloodied, is read as the blow is made (1.102).
  if (action.damage?.alternatives) {
    action = { ...action, damage: rulesetDamageInEffect(ctx.definition, ctx.combat, actor, action.damage) };
  }
  // A blow after a straight run at its one target carries the charge (1.186), read again as a held
  // blow picks up, since the run is still the one this turn walked.
  const charging = action.charge && (held ? rulesetCombatant(ctx.state, held.targetId) : targets[0]);
  if (action.charge && charging && rulesetChargeRun(actor, charging) >= action.charge.atLeast) {
    if (!held) ctx.events.push({ type: "charged", actorId: actor.id, targetId: charging.id, label: action.label });
    action = chargedAction(action, action.charge);
  }
  const style = attackStyle(ctx, actor, action, styleId);
  if (held) {
    // Everything before the held roll has happened, what the use gives its user included.
    targets = [held.targetId, ...held.rest]
      .map((id) => rulesetCombatant(ctx.state, id))
      .filter(
        (target): target is RulesetCombatant =>
          !!target && (!target.defeated || rulesetCanRevive(ctx.state, action, target)),
      );
    // The one it hit is gone before the blow could land: what the roll used is spent all the same.
    if (targets[0]?.id !== held.targetId) {
      spendOneUse(
        ctx,
        actor,
        actor.tracked.filter((entry) => entry.endsAfter === "own-attack" && held.mine.includes(entry.condition)),
      );
    }
  } else {
    if (action.gives) grantBudgets(ctx, actor, action);
    if (action.concentration) startConcentration(ctx, actor, action);
  }
  const steps = action.innate
    ? Math.max(0, action.innate.level - action.innate.baseLevel)
    : payWith
      ? rulesetCostSteps(ctx.definition, action, payWith, actor)
      : 0;
  // What a repeat is made at, and whom (1.310), kept with the concentration it holds.
  if (!held && action.repeats && actor.concentrating?.actionId === action.id) {
    actor.concentrating.steps = steps;
    if (rulesetIsSpell(action)) actor.concentrating.level = rulesetPaidLevel(ctx.definition, actor, action, payWith);
    actor.concentrating.targets = targets.map((one) => one.id);
  }
  // What it puts on its own user as it is made (1.307), whatever its targets do: Sunbeam's mote,
  // held by the same concentration and given the level it was cast at.
  if (!held) {
    for (const applies of action.appliesSelf ?? []) {
      if (!rulesetSheetWithin(ctx.definition, actor, applies.when)) continue;
      const value = applies.value ? rulesetSheetValue(ctx.definition, actor, applies.value) : undefined;
      applyConditionId(ctx, actor, applies.condition, applies, {
        ...(value !== undefined ? { value } : {}),
        ...(rulesetIsSpell(action) ? { level: rulesetPaidLevel(ctx.definition, actor, action, payWith) } : {}),
        ...(rulesetIsSpell(action) && steps > 0 ? { steps } : {}),
        sourceId: actor.id,
        action: [action.id, action.label],
        ...(action.concentration ? { concentration: true } : {}),
      });
    }
  }
  // The standard actions taken with it (1.313): Expeditious Retreat's Dash as it is cast.
  if (!held) for (const taken of action.takes ?? []) resolveStandard(ctx, actor, taken, undefined);
  // A higher cost's more, or more charges' (1.269); once for every so many steps (1.300).
  const per = action.use?.perCostStep ?? action.itemUse?.charges?.step?.amount;
  const every = action.use?.stepsEvery ?? 1;
  // What a condition gives grows by the cost that condition was put on with (1.300).
  const heldSteps = action.heldSteps
    ? Math.min(
        action.heldSteps.max ?? Infinity,
        Math.floor(
          // A repeat, by what its cast was paid at (1.310).
          ((action.again
            ? actor.concentrating?.steps
            : actor.tracked.find((entry) => entry.condition === action.whileHolds)?.steps) ?? 0) /
            (action.heldSteps.every ?? 1),
        ),
      )
    : 0;
  const extra = action.heldSteps
    ? heldSteps > 0
      ? { amount: action.heldSteps.amount, times: heldSteps }
      : undefined
    : per && Math.floor(steps / every) > 0
      ? { amount: per, times: Math.floor(steps / every) }
      : undefined;
  // Where the action's own saves take cover from: a burst from where it landed, anything else (a cone,
  // a line, a spell aimed at somebody) from its maker.
  // Set down somewhere rather than coming off its maker: a burst, a box or a wall (1.177).
  const setDown = !!action.area && action.area.shape !== "cone" && action.area.shape !== "line";
  // Copies set down at once (1.178): each target takes cover from the nearest of them.
  const aims = ctx.aimedAt ? [ctx.aimedAt, ...(ctx.aimedAlso ?? [])] : [];
  const saveFromFor = (target: RulesetCombatant) => {
    // From the actor's cell nearest them (1.194).
    if (!setDown || aims.length === 0) return rulesetNearestCell(actor, rulesetPositionOf(target));
    const cell = rulesetPositionOf(target);
    if (!cell || aims.length === 1) return aims[0]!;
    return aims.reduce((best, aim) => (rulesetDistanceTo(aim, target) < rulesetDistanceTo(best, target) ? aim : best));
  };

  // An ability that asks for no attack roll (an area everyone saves against, darts that simply hit)
  // rolls its dice ONCE and every target takes that number. One that rolls to hit each target rolls
  // its dice again for each hit, because each of those is its own attack. Either way nothing is
  // rolled until a target actually needs it, so a use that misses everything costs no dice at all.
  type Rolled = { rolls: number[]; flat: number; total: number };
  const perTarget = action.toHit !== undefined && !action.autoHit;
  const once = (amount: RulesetCombatAmount | undefined, rerollUpTo?: number) => {
    let rolled: Rolled | null = null;
    if (!amount) return null;
    return perTarget
      ? () => rollAmount(ctx, amount, extra, rerollUpTo)
      : () => (rolled ??= rollAmount(ctx, amount, extra, rerollUpTo));
  };
  // Empowered (1.253): up to so many of its damage dice that rolled low thrown again, the lowest of
  // ALL its dice first (1.254): the blow's own, every clause's, and on a critical hit the extra ones.
  // Its dice are therefore rolled together, once per hit for an attack and once for everybody else.
  const empowered = action.altered?.rerolls ?? 0;
  /** One hit's dice, the blow's own first and then each clause's: null for one not rolled. */
  type Hit = { sets: Array<Rolled | null>; left: number };
  let hitNow: Hit | null = null;
  let hitShared: Hit | null = null;
  const sidesOf = (amount: RulesetCombatAmount, index: number) =>
    index < amount.count ? amount.sides : (extra?.amount.sides ?? amount.sides);
  const rollHit = (withBlow: boolean): Hit => {
    const amounts = [withBlow ? action.damage : undefined, ...(action.damage?.plus ?? [])];
    const sets = amounts.map((amount, index) =>
      amount ? rollAmount(ctx, amount, extra, index === 0 ? action.damage?.reroll : undefined) : null,
    );
    const low = sets
      .flatMap((set, at) =>
        set ? set.rolls.map((face, index) => ({ at, index, face, sides: sidesOf(amounts[at]!, index) })) : [],
      )
      .filter((die) => die.face < (die.sides + 1) / 2)
      .sort((a, b) => a.face - b.face || a.at - b.at || a.index - b.index)
      .slice(0, empowered);
    for (const die of low) {
      const set = sets[die.at]!;
      set.rolls[die.index] = rollRulesetDice(ctx.roll, 1, die.sides)[0]!;
      set.total = sumOf(set.rolls) + set.flat;
    }
    return { sets, left: empowered - low.length };
  };
  const hitFor = (withBlow: boolean): Hit =>
    perTarget ? (withBlow || !hitNow ? (hitNow = rollHit(withBlow)) : hitNow) : (hitShared ??= rollHit(true));
  /** A critical hit's extra dice thrown again with what Empowered has left on this hit. */
  const empowerCritical = (bonus: { rolls: number[]; flat: number }, amount: RulesetCombatAmount) => {
    const hit = empowered > 0 ? (perTarget ? hitNow : hitShared) : null;
    if (!hit || hit.left <= 0 || bonus.rolls.length === 0) return bonus;
    const low = bonus.rolls
      .map((face, index) => ({ index, face, sides: sidesOf(amount, index) }))
      .filter((die) => die.face < (die.sides + 1) / 2)
      .sort((a, b) => a.face - b.face || a.index - b.index)
      .slice(0, hit.left);
    hit.left -= low.length;
    const rolls = [...bonus.rolls];
    for (const die of low) rolls[die.index] = rollRulesetDice(ctx.roll, 1, die.sides)[0]!;
    return { ...bonus, rolls };
  };
  const damage =
    empowered > 0 && action.damage ? () => hitFor(true).sets[0]! : once(action.damage, action.damage?.reroll);
  // Careful (1.253): up to so many of its user and their allies it catches make its save outright,
  // the ones its user picked (1.254), else in the order it caught them. Heightened: its first target
  // rolls its first save at disadvantage.
  const picked = action.altered?.spared;
  const careful = new Set(
    action.altered?.spares
      ? targets
          .filter((target) => target.side === actor.side && (!picked || picked.includes(target.id)))
          .slice(0, action.altered.spares)
          .map((target) => target.id)
      : [],
  );
  // Picked (1.255), it is theirs whether or not they come first; one it does not catch has nothing.
  const heightened = action.altered?.heightens ? (action.altered.heightened ?? targets[0]?.id) : undefined;
  // One roller per clause, read the same way: an ability that lands on several targets without
  // rolling to hit rolls every clause once and everybody takes those numbers.
  const clauses = (action.damage?.plus ?? []).map((clause, index) =>
    empowered > 0 ? () => hitFor(false).sets[index + 1]! : once(clause)!,
  );
  // As many times over as the uses its user chose (1.251): Lay on Hands.
  const times = action.usesChosen ? (ctx.chosenAmount ?? 1) : 1;
  const heal = once(
    action.heal && times > 1
      ? { ...action.heal, count: action.heal.count * times, flat: action.heal.flat * times }
      : action.heal,
  );
  const temporary = once(action.temporary);
  const restore = once(action.restore?.amount);

  const pooled = rulesetCombatIsPool(ctx.combat);
  const symbolic = rulesetCombatIsSymbol(ctx.combat);
  // A spending attack throws the number its maker has as the blow lands, and whether anything landed
  // decides, once every target has been tried, whether the number resets or a miss costs some of it.
  const spends = style?.spends ? { number: spend ?? actor.initiative, landed: false } : null;
  const reaches = (target: RulesetCombatant) =>
    rulesetTargetHasSenses(ctx.definition, ctx.state, target, action.needs, action.needsAny) &&
    // Behind a ward this does not get through (1.179), at the level it was paid at.
    !rulesetWarded(ctx.definition, ctx.state, actor, action, target, payWith) &&
    // An area or a list catches only who the action may take, by what they are (1.168).
    rulesetTargetTypesAllow(ctx.definition, target, action.targetTypes);
  const spared = sparedByHealth(ctx, actor, action, targets.filter(reaches), extra);
  for (const target of targets) {
    if (!reaches(target) || spared.has(target.id)) continue;
    // Each target an attack rolls for is a hit of its own, its dice not yet rolled.
    hitNow = null;
    // Killed outright (1.196): nothing else it does matters to the dead.
    if (action.kills) {
      slay(ctx, target, actor.id, action.label);
      continue;
    }
    const endHarm = endConditionsOnHarm(
      ctx,
      target,
      actor.id,
      0,
      !!(
        action.harmful ||
        action.kind === "attack" ||
        (action.kind === "block" && (action.damage || action.save || action.applies?.length))
      ),
      undefined,
      rulesetIsAttack(action) && !action.autoHit,
    );
    let landed = true;
    let critical = false;
    // Under `dice-pool`, the successes a hit had past the ones it needed: each is one more damage die.
    let extraDice = 0;
    // Under `symbol-pool` (1.382), what the hit's successes and its maker's spends add to its harm.
    let symbolHarm = 0;
    // What lasted one attack, on either side of it: noted when the roll is made and spent once this
    // blow is over, landed or not, so it counts for the blow's damage as well as its roll.
    let used: { mine: RulesetTrackedCondition[]; theirs: RulesetTrackedCondition[] } | null = null;
    const spendUsed = () => {
      endHarm();
      for (const end of ctx.harmEndings.splice(0)) end();
      if (!used) return;
      spendOneUse(ctx, actor, used.mine);
      spendOneUse(ctx, target, used.theirs);
    };
    // How the roll finally leaned, which is one of the things a rider may ask about. An action
    // nobody rolls for leaned no way at all.
    let mode: RulesetCombatRollMode = "normal";
    if (held && target.id === held.targetId) {
      // The roll was made before the one it hit was asked. It is not made again: it is checked
      // against their defense as it stands now, which is what an answer at this moment changes. A
      // natural face decided it whatever the defense.
      const roll = held.roll;
      const guarded = rulesetDefenseAgainst(ctx.definition, ctx.combat, ctx.state, target, actor, action);
      const landsAt = roll.critical ? "critical" : "hit";
      // A pool's successes meet what the defense now asks, never fewer than one. A symbol throw's
      // difficulty dice were thrown with it, so what it landed with stands.
      const needed = symbolic ? roll.defense : pooled ? Math.max(1, guarded.defense) : guarded.defense;
      const outcome =
        roll.natural || (symbolic ? roll.total >= rulesetSymbolNeeded(ctx.definition) : roll.total >= needed)
          ? landsAt
          : "miss";
      if (pooled && outcome !== "miss") extraDice = roll.total - needed;
      // Picked up after its maker chose their spends (1.382), it was checked already.
      if ((needed !== roll.defense || roll.lowered) && !roll.spends) {
        ctx.events.push({
          type: "recheck",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          total: roll.total,
          defense: needed,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards } : {}),
          ...(guarded.guards.length > 0 && needed === guarded.defense ? { unguarded: guarded.unguarded } : {}),
          outcome,
        });
      }
      mode = roll.mode;
      // The attacker's are the ones the roll used; the target's are read now, so one they put on as
      // their answer counts for this attack and is spent by it.
      used = {
        mine: actor.tracked.filter((entry) => entry.endsAfter === "own-attack" && held.mine.includes(entry.condition)),
        theirs: oneUseConditions(target, "attacked"),
      };
      landed = outcome !== "miss";
      critical = outcome === "critical";
      if (symbolic && roll.symbols) {
        // Held again for whoever picks their own spends and has not yet (1.382).
        const asks = spendAsked(ctx, actor, target, roll.symbols, landed, roll.spends ?? {});
        if (asks) {
          return {
            ...held,
            roll: { ...roll, spends: { ...roll.spends, [asks]: [] } },
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
            ...(action.entry ? { entry: action.entry } : {}),
            blow: rulesetBlowKind(ctx.state, actor, target, action),
            asks,
            hit: landed,
          };
        }
        const bought = spendSymbols(ctx, actor, target, roll.symbols, landed, roll.spends);
        if (landed) symbolHarm = rulesetSymbolSuccessHarm(ctx.definition, ctx.combat, roll.total) + bought.damage;
        if (landed && bought.critical) critical = true;
      }
    } else if (action.toHit !== undefined && !action.autoHit) {
      mode = rulesetAttackMode(ctx.definition, ctx.combat, actor, target, {
        state: ctx.state,
        optionId: action.id,
        action,
      });
      // What the weapon adds against what the target is (1.187).
      const toHit = action.toHit + rulesetToHitAgainst(ctx.definition, action, target, actor);
      // What the ground the target stands on is worth, said out loud before the roll it changed.
      const guarded = rulesetDefenseAgainst(ctx.definition, ctx.combat, ctx.state, target, actor, action);
      if (guarded.cover > 0) {
        ctx.events.push({ type: "cover", targetId: target.id, bonus: guarded.cover, defense: guarded.defense });
      }
      if (symbolic) {
        // The to-hit number is the attacker's dice (some upgraded), the defense the difficulty dice
        // thrown against them, and what conditions add boost or setback dice (1.382). Net successes
        // land it; what is left over is spent, by either side, before its harm is dealt.
        const bonuses = rollBonuses(
          ctx,
          rulesetConditionModifiers(
            ctx.definition,
            ctx.combat,
            actor,
            "attacks",
            ctx.state,
            undefined,
            undefined,
            action.ability,
          ).filter(({ modifier }) => rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action)),
        );
        const thrown = throwSymbols(ctx, actor, toHit, bonusTotal(bonuses), mode, {
          ...(action.upgrades ? { upgrades: action.upgrades } : {}),
          difficulty: guarded.defense,
        });
        const outcome = thrown.successes >= rulesetSymbolNeeded(ctx.definition) ? "hit" : "miss";
        ctx.events.push({
          type: "attack",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          mode,
          rolls: thrown.rolls,
          kept: thrown.successes,
          modifier: toHit,
          ...(bonuses.length > 0 ? { bonuses } : {}),
          total: thrown.successes,
          defense: thrown.difficulty,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards } : {}),
          outcome,
          pool: symbolRecord(thrown),
        });
        actor.flags.helped = false;
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: oneUseConditions(target, "attacked") };
        landed = outcome === "hit";
        if (
          landed &&
          (!ctx.state.window || ctx.nestHit) &&
          !hasFallingAnswer(ctx) &&
          rulesetEncounterOutcome(ctx.state) === "ongoing" &&
          hitAnswers(ctx, actor, target, action).length > 0
        ) {
          // Asked before anything is spent, so an answer that turns the blow aside spends nothing.
          return {
            targetId: target.id,
            rest: targets.slice(targets.indexOf(target) + 1).map((one) => one.id),
            roll: {
              mode,
              total: thrown.successes,
              defense: thrown.difficulty,
              critical: false,
              natural: false,
              symbols: { ...thrown.symbols },
            },
            mine: used.mine.map((entry) => entry.condition),
            hurt: [],
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
            ...(action.entry ? { entry: action.entry } : {}),
            blow: rulesetBlowKind(ctx.state, actor, target, action),
          };
        }
        // Held for whoever picks their own spends (1.382), before anything is spent.
        const asks = spendAsked(ctx, actor, target, thrown.symbols, landed, {});
        if (asks) {
          return {
            targetId: target.id,
            rest: targets.slice(targets.indexOf(target) + 1).map((one) => one.id),
            roll: {
              mode,
              total: thrown.successes,
              defense: thrown.difficulty,
              critical: false,
              natural: false,
              symbols: { ...thrown.symbols },
              spends: { [asks]: [] },
            },
            mine: used.mine.map((entry) => entry.condition),
            hurt: [],
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
            ...(action.entry ? { entry: action.entry } : {}),
            blow: rulesetBlowKind(ctx.state, actor, target, action),
            asks,
            hit: landed,
          };
        }
        const bought = spendSymbols(ctx, actor, target, thrown.symbols, landed);
        if (landed) {
          symbolHarm = rulesetSymbolSuccessHarm(ctx.definition, ctx.combat, thrown.successes) + bought.damage;
          critical = bought.critical;
        }
      } else if (pooled) {
        // The to-hit number is the pool, what the attacker's conditions add is dice, and the
        // defense is the successes it needs, never fewer than one. A botch misses whatever it
        // counted, and there are no criticals: what a strong hit is worth is its extra successes.
        const bonuses = rollBonuses(
          ctx,
          rulesetConditionModifiers(
            ctx.definition,
            ctx.combat,
            actor,
            "attacks",
            ctx.state,
            undefined,
            undefined,
            action.ability,
          ).filter(({ modifier }) => rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action)),
        );
        const thrown = throwPool(ctx, actor, toHit + bonusTotal(bonuses), mode, action.target);
        const needed = Math.max(1, guarded.defense);
        const outcome = !thrown.botch && thrown.successes >= needed ? "hit" : "miss";
        ctx.events.push({
          type: "attack",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          mode,
          rolls: thrown.rolls,
          kept: thrown.successes,
          modifier: toHit,
          ...(bonuses.length > 0 ? { bonuses } : {}),
          total: thrown.successes,
          defense: needed,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards } : {}),
          ...(guarded.guards.length > 0 && needed === guarded.defense ? { unguarded: guarded.unguarded } : {}),
          outcome,
          pool: poolRecord(thrown),
          ...(style ? { style: style.id } : {}),
        });
        actor.flags.helped = false;
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: oneUseConditions(target, "attacked") };
        landed = outcome === "hit";
        if (landed) extraDice = thrown.successes - needed;
        if (
          landed &&
          (!ctx.state.window || ctx.nestHit) &&
          !hasFallingAnswer(ctx) &&
          rulesetEncounterOutcome(ctx.state) === "ongoing" &&
          hitAnswers(ctx, actor, target, action).length > 0
        ) {
          return {
            targetId: target.id,
            rest: targets.slice(targets.indexOf(target) + 1).map((one) => one.id),
            roll: { mode, total: thrown.successes, defense: needed, critical: false, natural: false },
            mine: used.mine.map((entry) => entry.condition),
            hurt: [],
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
            ...(action.entry ? { entry: action.entry } : {}),
            blow: rulesetBlowKind(ctx.state, actor, target, action),
          };
        }
      } else {
        const dice = ctx.combat.attackRoll!.dice;
        const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
        const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
        const kept = second
          ? mode === "advantage"
            ? Math.max(sumOf(first), sumOf(second))
            : Math.min(sumOf(first), sumOf(second))
          : sumOf(first);
        const naturals = ctx.combat.attackRoll!.naturals;
        const single = dice.count === 1;
        // What the attacker's conditions add, rolled after the attack's own dice.
        const bonuses = rollBonuses(
          ctx,
          rulesetConditionModifiers(
            ctx.definition,
            ctx.combat,
            actor,
            "attacks",
            ctx.state,
            undefined,
            undefined,
            action.ability,
          ).filter(({ modifier }) => rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action)),
        );
        // Short of it, what is held back until then (1.249), never for a natural miss.
        if (!(single && kept === 1 && naturals.min === "miss")) {
          bonuses.push(
            ...rescueBonuses(
              ctx,
              actor,
              "attacks",
              rulesetConditionModifiers(
                ctx.definition,
                ctx.combat,
                actor,
                "attacks",
                ctx.state,
                undefined,
                undefined,
                action.ability,
                true,
              ).filter(({ modifier }) => rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action)),
              guarded.defense - (kept + toHit + bonusTotal(bonuses)),
            ),
          );
        }
        const total = kept + toHit + bonusTotal(bonuses);
        let outcome: "hit" | "miss" | "critical" = total >= guarded.defense ? "hit" : "miss";
        // A critical range the attacker's sheet reads (1.81) widens a critical face down to it.
        const criticalFrom =
          naturals.max === "critical"
            ? Math.max(2, Math.min(dice.sides, actor.criticalFrom ?? dice.sides))
            : dice.sides;
        if (single && kept >= criticalFrom && naturals.max !== "none") {
          outcome = naturals.max === "critical" ? "critical" : "hit";
        } else if (single && kept === 1 && naturals.min === "miss") outcome = "miss";
        // A condition that says a blow from the next cell always tells is read last, so a hit that
        // landed becomes the critical the ruleset promised.
        if (outcome === "hit" && rulesetCriticalFromAdjacent(ctx.definition, ctx.combat, ctx.state, actor, target)) {
          outcome = "critical";
        }
        // Missed, what its maker spends to hit all the same (1.249): Stroke of Luck.
        if (outcome === "miss" && rescueEntry(ctx, actor, "attacks", "success")) outcome = "hit";
        ctx.events.push({
          type: "attack",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          mode,
          rolls: second ? [...first, ...second] : first,
          kept,
          modifier: toHit,
          ...(bonuses.length > 0 ? { bonuses } : {}),
          total,
          defense: guarded.defense,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards, unguarded: guarded.unguarded } : {}),
          outcome,
        });
        // Help is spent by the attack it was given for, landed or not.
        actor.flags.helped = false;
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: oneUseConditions(target, "attacked") };
        landed = outcome !== "miss";
        critical = outcome === "critical";
        // A hit on somebody who holds an answer for being hit stops here, before its damage: the
        // window asks them, and the attack picks up from this roll once they have answered. Nothing
        // opened inside a window opens another, so an attack made inside one is never held.
        if (
          landed &&
          (!ctx.state.window || ctx.nestHit) &&
          !hasFallingAnswer(ctx) &&
          rulesetEncounterOutcome(ctx.state) === "ongoing" &&
          hitAnswers(ctx, actor, target, action).length > 0
        ) {
          return {
            targetId: target.id,
            rest: targets.slice(targets.indexOf(target) + 1).map((one) => one.id),
            roll: {
              mode,
              total,
              defense: guarded.defense,
              critical,
              natural: single && kept >= criticalFrom && naturals.max !== "none",
            },
            mine: used.mine.map((entry) => entry.condition),
            hurt: [],
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
            ...(action.entry ? { entry: action.entry } : {}),
            blow: rulesetBlowKind(ctx.state, actor, target, action),
          };
        }
      }
    }
    if (!landed) {
      // Half its damage on a miss, and nothing else it does on a hit (1.255): Acid Arrow.
      if (action.halfOnMiss && action.damage && damage) {
        const blow = action.damage;
        const missed = [
          { rolled: damage(), type: blow.type },
          ...(blow.plus ?? []).flatMap((clause, index) =>
            clause.onCritical ||
            (clause.whileOn !== undefined && !rulesetItemOn(actor, clause.whileOn)) ||
            !clauseReaches(ctx, actor, target, action, clause)
              ? []
              : [{ rolled: clauses[index]!(), type: clause.type ?? blow.type }],
          ),
        ];
        for (const part of missed) {
          if (target.defeated) break;
          const dealt = applyDamage(ctx, target, {
            sourceId: actor.id,
            label: action.label,
            ...(part.type ? { damageType: part.type } : {}),
            rolls: part.rolled.rolls,
            flat: part.rolled.flat,
            amount: Math.floor(part.rolled.total / 2),
            saved: true,
          });
          afterBlow(ctx, target, dealt, false);
        }
      }
      spendUsed();
      continue;
    }

    const against: RulesetSaveAgainst = {
      conditions: [...(action.applies?.map((one) => one.condition) ?? []), ...(action.save?.against?.conditions ?? [])],
      damage: [
        action.damage?.type,
        ...(action.damage?.plus ?? []).map((one) => one.type),
        ...(action.save?.against?.damage ?? []),
      ].filter((type): type is string => type !== undefined),
      magic: magicalAction(action),
      action: [action.id, action.label, ...(action.recharge?.group ? [action.recharge.group] : [])],
      ...((action.casts ?? action.catalog) ? { catalog: action.casts ?? action.catalog } : {}),
    };
    let saved = false;
    if (action.save && (careful.has(target.id) || savesOutright(ctx, target, action.save))) {
      // Nothing to roll (1.181): immune to what it is, or not the kind of creature it works on.
      ctx.events.push({
        type: "save",
        actorId: target.id,
        sourceId: actor.id,
        save: action.save.save,
        rolls: [],
        kept: 0,
        modifier: target.saves[action.save.save] ?? 0,
        total: 0,
        difficulty: action.save.difficulty,
        success: true,
        automatic: true,
      });
      saved = true;
      noteSaved(actor, action, target);
    } else if (action.save?.alliesMayFail && target.side === actor.side) {
      // A friend lets it in (1.278): failed, nothing rolled.
      ctx.events.push({
        type: "save",
        actorId: target.id,
        sourceId: actor.id,
        save: action.save.save,
        rolls: [],
        kept: 0,
        modifier: target.saves[action.save.save] ?? 0,
        total: 0,
        difficulty: action.save.difficulty,
        success: false,
        automatic: true,
      });
    } else if (action.save) {
      saved = rollSave(
        ctx,
        target,
        action.save.save,
        action.save.difficulty,
        actor.id,
        action.save.ignoresCover ? null : saveFromFor(target),
        against,
        target.id === heightened
          ? leanWith(saveLean(ctx, target, action.save.modes), "disadvantage")
          : saveLean(ctx, target, action.save.modes),
      );
      if (saved) noteSaved(actor, action, target);
      if (saved && action.save.onSuccess === "negates") {
        spendUsed();
        continue;
      }
      // Failed, it dies (1.311), and its slayer gains what it says: Consume Life.
      if (!saved && action.slaysOnFailedSave) {
        slay(ctx, target, actor.id, action.label);
        if (action.healsOnSlay && target.defeated) {
          const thrown = rollAmount(ctx, action.healsOnSlay);
          dealHeal(ctx, actor, { sourceId: actor.id, rolls: thrown.rolls, flat: thrown.flat, amount: thrown.total });
        }
        spendUsed();
        continue;
      }
      // Failed, it takes every point instead (1.245): Quivering Palm.
      if (!saved && action.dropsOnFailedSave) {
        dropToNothing(ctx, target, actor.id, action.label);
        // What it ends, it ends all the same: the vibrations are spent on a dying character too.
        if (action.ends)
          endConditionsOf(ctx, action, target, action.ends, rulesetPaidLevel(ctx.definition, actor, action, payWith));
        spendUsed();
        continue;
      }
    }
    // A save its holder evades with (1.250): nothing on a success, half on a failure.
    const evades =
      action.save?.onSuccess === "half" &&
      rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) =>
        entry.evasion?.includes(action.save!.save),
      );
    if (evades && saved) {
      ctx.events.push({ type: "evaded", targetId: target.id, label: action.label });
      spendUsed();
      continue;
    }
    const halved = (saved || evades) && action.save?.onSuccess === "half";

    // Everything this blow is made of: the first amount, and every clause beside it. Rolled and
    // typed one at a time, taken off one at a time, and finished ONCE at the end: the health the
    // target had before the FIRST of them is what decides whether the blow put them down.
    const daze = ctx.combat.daze;
    const dazeOver = daze ? rulesetCombatValue(ctx.definition, target, daze.over) : undefined;
    const attack = action.damage
      ? {
          minimum: rulesetDamageMinimum(ctx.definition, actor, action.damage),
          qualities: action.damage.qualities,
        }
      : undefined;
    let before: { value: number } | null = null;
    let dealt = 0;
    const health = ctx.combat.health;
    // A blow marks once at its end where the track counts blows, and where it fills by box, since
    // a hit's box is named by the whole blow rather than by each clause of it.
    const declaredTrack =
      target.sheet && "track" in health
        ? ctx.definition.sheet.live.tracks.find((track) => track.id === health.track)
        : undefined;
    const woundTrack =
      declaredTrack && (ctx.combat.damageKinds?.marks === "per-blow" || declaredTrack.fill === "indexed")
        ? declaredTrack
        : undefined;
    let woundKind: { id: string; severity: number } | undefined;
    const blowEventStart = ctx.events.length;
    // A blow made in a style that takes lands on the target's number instead of their health: each
    // part of it takes its successes off, and the whole blow is settled once every part has landed.
    const takes = style?.takes ? { from: target.initiative, taken: 0 } : null;
    // A damage-only save is tested once for this holder and blow, including clauses and riders (1.129).
    const damageSaves = new Set<RulesetTrackedCondition>();
    const modifiers = [
      ...rulesetDamageModifiers(ctx.definition, ctx.state, actor, action, target),
      ...rulesetDamageModifiers(ctx.definition, ctx.state, actor, action, target, true),
    ];
    const parts: RulesetDamageInput[] = [];
    // What the blow's draining clauses dealt, which its maker gains as temporary points (1.187).
    let drained = 0;
    // Whether the target failed its save against the blow lowering its maximum (1.203), rolled as
    // the first part lands, so what it takes is what the maximum loses.
    let sapped: boolean | undefined;
    // What of it lowered the maximum (1.235): its maker regains it with `heals`.
    let sappedDealt = 0;
    // What of it its maker drains back (1.281): Psychic Drain's all, Vampiric Touch's half.
    let drainDealt = 0;
    const landNow = (part: RulesetDamageInput) => {
      if (takes) {
        const amount = Math.max(0, Math.floor(part.amount));
        takes.taken += amount;
        shiftInitiative(ctx, target, -amount, "taken", {
          sourceId: actor.id,
          ...(part.label ? { label: part.label } : {}),
          rolls: part.rolls,
          flat: part.flat,
          ...(part.pool ? { pool: part.pool } : {}),
        });
        return;
      }
      before ??= healthOf(ctx, target);
      const sap = action.reducesMax;
      if (sap && sapped === undefined && !("track" in ctx.combat.health)) {
        // Its own save (1.203), the entry's failed (1.235), or no save at all.
        sapped =
          sap.save !== undefined && sap.difficulty !== undefined
            ? !rollSave(ctx, target, sap.save, sap.difficulty, actor.id, undefined, against)
            : sap.onFailedSave
              ? !saved
              : true;
      }
      // Only the damage of its type, when it names one (1.235).
      const saps =
        !!sapped && (!sap?.damageType || sap.damageType.trim().toLowerCase() === part.damageType?.trim().toLowerCase());
      // Every part of the blow carries what the weapon does past a resistance.
      const qualities = action.damage?.qualities;
      // A weapon that ignores resistance to its own kind of harm (1.192) does so for every part of
      // the blow of that kind.
      const ignores =
        !!action.ignoresResistance &&
        !!part.damageType &&
        part.damageType.trim().toLowerCase() === action.damage?.type?.trim().toLowerCase();
      const partDealt = applyDamage(
        ctx,
        target,
        {
          ...part,
          ...(qualities ? { qualities } : {}),
          ...(action.entry ? { entry: action.entry } : {}),
          ...(ignores ? { ignoresResistance: true as const } : {}),
          ...(action.healedOnlyByRest || saps ? { seals: true as const } : {}),
          ...(saps && sap?.lasting ? { lasting: true as const } : {}),
          ...(action.leavesAtLeast !== undefined ? { leavesAtLeast: action.leavesAtLeast } : {}),
        },
        !!woundTrack,
        damageSaves,
      );
      dealt += partDealt;
      if (saps) sappedDealt += partDealt;
      if (part.drains) drained += partDealt;
      const drain = action.drain;
      if (
        drain &&
        (!drain.damageType || drain.damageType.trim().toLowerCase() === part.damageType?.trim().toLowerCase())
      )
        drainDealt += partDealt;
      // A compound hit marks once, using the most severe kind that actually landed.
      if (woundTrack && partDealt > 0) {
        const kind = woundTrack.kinds?.find(
          (entry) => entry.id === (part.pool?.kind ?? rulesetCombatDamageKind(ctx.combat, part.damageType)),
        );
        if (kind && (!woundKind || kind.severity > woundKind.severity)) woundKind = kind;
      }
    };
    // Keep the old path unchanged unless this hit actually has damage modifiers. A modified blow
    // collects its amounts so additions happen once and times changes the whole hit before hide.
    const land = (part: RulesetDamageInput) => (modifiers.length ? parts.push(part) : landNow(part));
    if (pooled && action.damage && spends && target.hardness !== undefined && spends.number < target.hardness) {
      // A number below the target's hardness lands and does nothing: the maker's number still goes
      // back to the base, as it does for any spending blow that landed.
      spends.landed = true;
      ctx.events.push({
        type: "hardness",
        targetId: target.id,
        sourceId: actor.id,
        label: action.label,
        hardness: target.hardness,
        dice: Math.max(0, spends.number),
      });
    } else if (pooled && action.damage && spends) {
      // The maker's own number, thrown as damage dice: nothing the weapon adds, nothing the hit had
      // past its needed successes, and no soak.
      spends.landed = true;
      const thrown = throwHarm(
        ctx,
        target,
        { count: Math.max(0, spends.number), sides: 0, flat: 0 },
        action.damage.type,
        0,
        undefined,
        false,
        attack,
      );
      land({
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: thrown.rolls,
        flat: 0,
        amount: halved ? Math.floor(thrown.total / 2) : thrown.total,
        ...(halved ? { saved: true } : {}),
        pool: thrown.pool,
      });
    } else if (pooled && action.damage) {
      // Every target's damage is thrown for them, because what the hit added past its needed
      // successes and what they soak are theirs. The first amount carries the extra dice; each
      // clause and a rider is its own pool of its own kind.
      const first = throwHarm(ctx, target, action.damage, action.damage.type, extraDice, extra, true, attack);
      // Never less than the weapon's floor, whatever was soaked.
      const firstTotal = Math.max(first.total, action.damage.floor ?? 0);
      land({
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: first.rolls,
        flat: first.flat,
        amount: halved ? Math.floor(firstTotal / 2) : firstTotal,
        ...(firstTotal > first.total ? { floor: firstTotal } : {}),
        ...(halved ? { saved: true } : {}),
        pool: first.pool,
      });
      (action.damage.plus ?? []).forEach((clause) => {
        // Dealt only to a target that is what it names (1.168), and a save-for-half blow is never a
        // critical one (1.169).
        if (!clauseReaches(ctx, actor, target, action, clause) || clause.onCritical) return;
        if (clause.whileOn !== undefined && !rulesetItemOn(actor, clause.whileOn)) return;
        const own = clause.save
          ? rollSave(ctx, target, clause.save.save, clause.save.difficulty, actor.id, saveFromFor(target), against)
          : false;
        if (own && clause.save?.onSuccess === "none") return;
        const clauseHalved = clause.save ? own : halved;
        const type = clause.type ?? action.damage?.type;
        const thrown = throwHarm(ctx, target, clause, type, 0, undefined, true, { qualities: attack?.qualities });
        land({
          sourceId: actor.id,
          label: action.label,
          ...(type ? { damageType: type } : {}),
          rolls: thrown.rolls,
          flat: thrown.flat,
          amount: clauseHalved ? Math.floor(thrown.total / 2) : thrown.total,
          ...(clauseHalved ? { saved: true } : {}),
          pool: thrown.pool,
          ...(clause.tempHp ? { drains: true as const } : {}),
        });
      });
    } else if (damage && action.damage) {
      // At its most against what it names (1.185): Blight on a plant.
      const rolled =
        action.maxAgainst && rulesetTargetIs(ctx.definition, target, action.maxAgainst)
          ? maxAmount(action.damage, extra)
          : damage();
      const bonus = critical
        ? empowerCritical(criticalExtra(ctx, action.damage, extra, action.damage.reroll), action.damage)
        : { rolls: [], flat: 0 };
      // A symbol fight's hit adds what its successes and spends bought, and the target soaks it as a
      // number off the whole blow (1.382), never below none.
      const soaked = symbolic ? rulesetSoakOf(target, rulesetCombatDamageKind(ctx.combat, action.damage.type)) : 0;
      const thrown = Math.max(0, rolled.total + sumOf(bonus.rolls) + bonus.flat + symbolHarm - soaked);
      // Never less than the weapon's floor.
      const total = Math.max(thrown, action.damage.floor ?? 0);
      land({
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: [...rolled.rolls, ...bonus.rolls],
        flat: rolled.flat + bonus.flat + symbolHarm - soaked,
        amount: halved ? Math.floor(total / 2) : total,
        ...(total > thrown ? { floor: total } : {}),
        ...(halved ? { saved: true } : {}),
        ...(critical ? { critical: true } : {}),
      });
      (action.damage.plus ?? []).forEach((clause, index) => {
        if (!clauseReaches(ctx, actor, target, action, clause)) return;
        // Only a critical hit carries a clause that says so (1.169), and only an item switched on one
        // dealt while it is (1.170).
        if (clause.onCritical && !critical) return;
        if (clause.whileOn !== undefined && !rulesetItemOn(actor, clause.whileOn)) return;
        // A clause with a save of its own asks the TARGET for it, whatever the action already asked.
        const own = clause.save
          ? rollSave(ctx, target, clause.save.save, clause.save.difficulty, actor.id, saveFromFor(target), against)
          : false;
        if (own && clause.save?.onSuccess === "none") return;
        // Halved by its own save when it has one, and by the action's save-for-half when it does not.
        const clauseHalved = clause.save ? own : halved;
        const rolledClause = clauses[index]!();
        const clauseBonus = critical ? empowerCritical(criticalExtra(ctx, clause), clause) : { rolls: [], flat: 0 };
        const clauseTotal = rolledClause.total + sumOf(clauseBonus.rolls) + clauseBonus.flat;
        land({
          sourceId: actor.id,
          label: action.label,
          // A clause with no type of its own is the blow's own kind of harm.
          ...((clause.type ?? action.damage?.type) ? { damageType: clause.type ?? action.damage?.type } : {}),
          rolls: [...rolledClause.rolls, ...clauseBonus.rolls],
          flat: rolledClause.flat + clauseBonus.flat,
          amount: clauseHalved ? Math.floor(clauseTotal / 2) : clauseTotal,
          ...(clauseHalved ? { saved: true } : {}),
          ...(critical ? { critical: true } : {}),
          ...(clause.tempHp ? { drains: true as const } : {}),
        });
      });
    }
    // And whatever adds itself to a hit without anybody choosing it: one more clause of this blow,
    // doubled by a critical exactly as the rest of it is. Only a blow that DEALS something can carry
    // one, because a rider is extra damage on a hit and an action with none never struck for any.
    const rider = action.damage && !spends ? firingRider(ctx, actor, action, target, mode) : null;
    if (rider) {
      ctx.events.push({ type: "rider", actorId: actor.id, targetId: target.id, riderId: rider.id, label: rider.label });
      const type = rider.type ?? action.damage?.type;
      const rolled: { rolls: number[]; flat: number; total: number; pool?: RulesetDamageInput["pool"] } = pooled
        ? throwHarm(ctx, target, rider.amount, type, 0, undefined, true, { qualities: attack?.qualities })
        : rollAmount(ctx, rider.amount);
      const bonus = critical ? criticalExtra(ctx, rider.amount) : { rolls: [], flat: 0 };
      const total = rolled.total + sumOf(bonus.rolls) + bonus.flat;
      land({
        sourceId: actor.id,
        label: rider.label,
        ...((rider.type ?? action.damage?.type) ? { damageType: rider.type ?? action.damage?.type } : {}),
        rolls: [...rolled.rolls, ...bonus.rolls],
        flat: rolled.flat + bonus.flat,
        amount: halved ? Math.floor(total / 2) : total,
        ...(halved ? { saved: true } : {}),
        ...(critical ? { critical: true } : {}),
        ...(rolled.pool ? { pool: rolled.pool } : {}),
      });
    }
    // What its maker added to the blow while it was held (1.241): each amount rolled with what its
    // higher payment adds, doubled by a critical, and each clause only on a target it reaches.
    const adds = held && target.id === held.targetId && !spends ? (held.adds ?? []) : [];
    for (const add of adds) {
      const amounts = [
        { amount: add.damage as RulesetCombatAmount, type: add.damage.type, extra: add.extra },
        ...(add.damage.plus ?? [])
          .filter(
            (clause) =>
              clauseReaches(ctx, actor, target, action, clause) &&
              (!clause.onCritical || critical) &&
              (clause.whileOn === undefined || rulesetItemOn(actor, clause.whileOn)),
          )
          .map((clause) => ({ amount: clause as RulesetCombatAmount, type: clause.type ?? add.damage.type })),
      ];
      for (const one of amounts) {
        const extraOf = "extra" in one ? one.extra : undefined;
        const rolled: { rolls: number[]; flat: number; total: number; pool?: RulesetDamageInput["pool"] } = pooled
          ? throwHarm(ctx, target, one.amount, one.type, 0, extraOf)
          : rollAmount(ctx, one.amount, extraOf);
        const bonus = critical ? criticalExtra(ctx, one.amount, extraOf) : { rolls: [], flat: 0 };
        const total = rolled.total + sumOf(bonus.rolls) + bonus.flat;
        land({
          sourceId: actor.id,
          label: add.label,
          ...(one.type ? { damageType: one.type } : {}),
          rolls: [...rolled.rolls, ...bonus.rolls],
          flat: rolled.flat + bonus.flat,
          amount: halved ? Math.floor(total / 2) : total,
          ...(halved ? { saved: true } : {}),
          ...(critical ? { critical: true } : {}),
          ...(rolled.pool ? { pool: rolled.pool } : {}),
        });
      }
    }
    if (parts.length) {
      for (const { modifier } of modifiers) {
        // The blow's own dice again, as many more times as it says (1.197), its flat part left be.
        const own = action.damage;
        // On a critical only, more of the blow's own dice, not doubled (1.247): Brutal Critical.
        const onCritical = modifier.criticalDice !== undefined;
        if (onCritical && (!critical || !own || own.count <= 0)) continue;
        const dice = onCritical
          ? { count: modifier.criticalDice!, sides: own!.sides, flat: 0 }
          : modifier.diceTimes && own && own.count > 0
            ? { count: own.count * (modifier.diceTimes - 1), sides: own.sides, flat: 0 }
            : modifier.dice
              ? parseRulesetCombatDice(modifier.dice)
              : null;
        if (!dice && modifier.flat === undefined) continue;
        const amount = dice ?? { count: 0, sides: 0, flat: 0 };
        const rolled = rollAmount(ctx, amount);
        const bonus = critical && !onCritical ? criticalExtra(ctx, amount) : { rolls: [], flat: 0 };
        const sign = modifier.minus ? -1 : 1;
        const flat = (modifier.flat ?? 0) + sign * (rolled.flat + bonus.flat);
        const addition = (modifier.flat ?? 0) + sign * (rolled.total + sumOf(bonus.rolls) + bonus.flat);
        const damageType = modifier.damageType ?? action.damage?.type;
        const matching = parts.find((part) => part.damageType?.toLowerCase() === damageType?.toLowerCase());
        if (matching) {
          matching.amount += addition;
          matching.flat += flat;
          matching.rolls.push(...rolled.rolls.map((face) => sign * face), ...bonus.rolls.map((face) => sign * face));
        } else
          parts.push({
            sourceId: actor.id,
            label: action.label,
            damageType,
            rolls: [...rolled.rolls, ...bonus.rolls].map((face) => sign * face),
            flat,
            amount: addition,
            ...(critical ? { critical: true } : {}),
          });
      }
      const times = modifiers.reduce((value, { modifier }) => value * (modifier.times ?? 1), 1);
      // Round the scaled TOTAL down once, carrying a fraction across clauses in their written order.
      let total = 0;
      for (const part of parts) {
        const previous = Math.floor(total);
        total += Math.max(0, part.amount) * times;
        landNow({ ...part, amount: Math.floor(total) - previous });
      }
    }
    if (woundKind && woundTrack && "track" in health) {
      const box = ctx.combat.damageKinds?.marks === "per-point" ? Math.max(1, Math.floor(dealt)) : 1;
      markWound(ctx, target, {
        op: "damage",
        track: health.track,
        kind: woundKind.id,
        amount: 1,
        ...(woundTrack.fill === "indexed" ? { box } : {}),
      });
      const remaining = healthOf(ctx, target).value;
      for (const event of ctx.events.slice(blowEventStart)) {
        if (event.type === "damage" && event.targetId === target.id) event.health = remaining;
      }
    }
    if (before) afterBlow(ctx, target, dealt, critical);
    // One hit, including its clauses, never accumulated wounds from previous hits.
    const levels = ctx.combat.damageKinds?.marks === "per-blow" ? Math.min(1, dealt) : dealt;
    if (before && daze && dazeOver !== undefined && levels > 0 && levels > dazeOver) {
      // A second hit before the skipped turn adds no second skip, so it is not told again.
      const newlyDazed = target.dazed === undefined;
      target.dazed ??= {};
      const condition = daze.condition;
      if (
        condition &&
        !rulesetCombatConditions(ctx.definition, target).includes(condition) &&
        !rulesetImmuneToCondition(target, condition, ctx.definition)
      ) {
        applyConditionId(ctx, target, condition, { condition, duration: "instant" }, { sourceId: actor.id });
        target.dazed.condition = condition;
      }
      if (newlyDazed) {
        ctx.events.push({
          type: "daze",
          targetId: target.id,
          sourceId: actor.id,
          damage: levels,
          over: dazeOver,
          ...(condition ? { condition } : {}),
          ...(daze.text ? { text: daze.text } : {}),
        });
      }
    }
    // Its maximum lowered to nothing (1.203), it dies.
    if (sappedDealt > 0 && !target.defeated && rulesetSealedAway(ctx, target)) {
      slay(ctx, target, actor.id, action.label);
    }
    // What it lowered, its maker regains (1.235): a vampire's Bite.
    if (sappedDealt > 0 && action.reducesMax?.heals) {
      dealHeal(ctx, actor, { sourceId: actor.id, rolls: [], flat: sappedDealt, amount: sappedDealt });
    }
    // What it dealt, its maker regains (1.281), with nothing taken off the target's maximum.
    const drainBack = action.drain ? Math.floor(drainDealt * (action.drain.share ?? 1)) : 0;
    if (drainBack > 0) dealHeal(ctx, actor, { sourceId: actor.id, rolls: [], flat: drainBack, amount: drainBack });
    if (drained > 0) grantTemporary(ctx, actor, { sourceId: actor.id, rolls: [], flat: drained, amount: drained });
    // A blow that slays (1.187) kills somebody it left low enough, after what it dealt.
    if (dealt > 0) for (const entry of action.slay ?? []) slayOnHit(ctx, actor, action, target, entry, critical);
    // A blow that dealt enough harm puts the weapon's conditions on the one it hit, after what the
    // blow itself ended, as an action's own conditions are, so one that ends on damage stays on.
    // And those of what its maker added to it while it was held (1.273): a Staff of Withering's.
    const conditionsOnHit = [
      ...(action.onHit ?? []).map((entry, at) => ({ entry, key: `${action.id}:${at}` })),
      ...adds.flatMap((add, addAt) => (add.onHit ?? []).map((entry, at) => ({ entry, key: `add:${addAt}:${at}` }))),
    ];
    for (const { entry, key } of conditionsOnHit) {
      if (dealt < entry.atLeast) continue;
      // Only on a target that is what it names, and once a turn where it says so (1.187).
      if (!rulesetTargetIs(ctx.definition, target, entry.targetIs)) continue;
      if (entry.oncePerTurn && !spendOncePerTurn(ctx, actor, key)) continue;
      // A save against it keeps it off (1.169), and it is a save against that condition.
      if (
        entry.save &&
        rollSave(ctx, target, entry.save.save, entry.save.difficulty, actor.id, undefined, {
          ...against,
          conditions: [...(against.conditions ?? []), entry.condition],
        })
      )
        continue;
      applyConditionId(
        ctx,
        target,
        entry.condition,
        {
          condition: entry.condition,
          duration: entry.saveEnds ? "until-save" : entry.rounds ? { rounds: entry.rounds } : "instant",
          ...(entry.saveEnds ? { saveEnds: { save: entry.saveEnds.save, at: entry.saveEnds.at } } : {}),
        },
        {
          sourceId: actor.id,
          action: against.action,
          ...(entry.saveEnds ? { difficulty: entry.saveEnds.difficulty } : {}),
        },
      );
    }
    // A hit in a mode that claps around whoever it hit (1.312): a Hammer of Thunderbolts hurled.
    if (action.aroundHit) clapAround(ctx, actor, target, action.aroundHit, against);
    // What a taking blow took goes to its maker, with what landing one is worth on top; and taking
    // somebody down to the line crashes them, which is worth the crash's own bonus.
    if (takes) {
      shiftInitiative(ctx, actor, takes.taken + (style?.takes?.gain ?? 0), "gained", { sourceId: target.id });
      const line = ctx.combat.initiative.resource?.crash;
      if (line && takes.from > line.at && target.initiative <= line.at) {
        settleCrash(ctx, target, actor.id);
        if (line.bonus > 0) shiftInitiative(ctx, actor, line.bonus, "crash", { sourceId: target.id });
      }
    }
    // Cures (1.176): brought back from the dead first, so whatever else the action gives lands on
    // somebody alive; then steadied; then the conditions it ends, in the order the entry named them.
    if (action.revives && rulesetCanRevive(ctx.state, action, target)) {
      target.defeated = false;
      delete target.diedRound;
      target.down = true;
      target.dying = false;
      target.stable = false;
      const rolled = rollAmount(ctx, action.revives.amount);
      dealHeal(ctx, target, {
        sourceId: actor.id,
        rolls: rolled.rolls,
        flat: rolled.flat,
        amount: Math.max(1, rolled.total),
        magical: magicalAction(action),
      });
    }
    if (action.stabilizes && target.dying && !target.stable && !target.defeated) {
      target.stable = true;
      clearDyingTracks(ctx, target);
      ctx.events.push({ type: "stabilized", targetId: target.id, sourceId: actor.id });
    }
    // One cure of several (1.204): unpicked, the first this target has something for.
    const picked = action.cureOneOf ? firstCure(ctx, action, target) : undefined;
    const cureEnds = action.cureOneOf
      ? picked?.ends !== undefined
        ? { conditions: [picked.ends], count: 1 }
        : undefined
      : action.ends;
    const cureTracks = action.cureOneOf ? (picked?.track ? [picked.track] : undefined) : action.tracks;
    const cureUnseals = action.cureOneOf ? picked?.unseals : action.unseals;
    if (cureEnds)
      endConditionsOf(ctx, action, target, cureEnds, rulesetPaidLevel(ctx.definition, actor, action, payWith));
    if (heal) {
      const rolled = heal();
      dealHeal(ctx, target, {
        sourceId: actor.id,
        rolls: rolled.rolls,
        flat: rolled.flat,
        amount: rolled.total,
        magical: magicalAction(action),
      });
    }
    if (temporary) {
      const rolled = temporary();
      grantTemporary(ctx, target, {
        sourceId: actor.id,
        rolls: rolled.rolls,
        flat: rolled.flat,
        amount: rolled.total,
      });
    }
    if (restore && action.restore) {
      const rolled = restore();
      restorePool(
        ctx,
        target,
        action.restore.pool,
        { sourceId: actor.id, rolls: rolled.rolls, flat: rolled.flat, amount: rolled.total },
        action.restore.overMax,
      );
    }
    if (!saved) {
      // Tracks moved and sealed health given back (1.201), before the conditions it puts on.
      for (const entry of cureTracks ?? []) moveTrack(ctx, actor, target, entry.track, entry.by);
      if (cureUnseals) unsealHealth(ctx, actor, target);
      for (const applies of action.applies ?? []) {
        // Read off whoever applies it, as it applies (1.167): Rage's bonus by barbarian level.
        if (!rulesetSheetWithin(ctx.definition, actor, applies.when)) continue;
        if (!rulesetTargetIs(ctx.definition, target, applies.targetIs)) continue;
        // Destroyed in its place, at or below the tier its applier reaches (1.266): Destroy Undead.
        if (destroyedByTier(ctx, actor, target, applies)) {
          slay(ctx, target, actor.id, action.label);
          break;
        }
        // A number off its applier's sheet, fixed as it goes on (1.274): Heroism's modifier.
        const value = applies.value ? rulesetSheetValue(ctx.definition, actor, applies.value) : undefined;
        applyConditionId(ctx, target, applies.condition, applies, {
          ...(value !== undefined ? { value } : {}),
          // A spell's, the level it was cast at (1.299): what magical darkness puts its light out by.
          ...(rulesetIsSpell(action)
            ? { level: rulesetPaidLevel(ctx.definition, actor, action, payWith) }
            : action.again && actor.concentrating?.level !== undefined
              ? { level: actor.concentrating.level }
              : {}),
          // And how far above its base cost (1.300): what an action the condition gives grows by.
          ...(rulesetIsSpell(action) && steps > 0 ? { steps } : {}),
          // What it harms with grows with the higher cost it was put on with (1.255): Acid Arrow.
          ...(applies.harmsPerCostStep && steps > 0
            ? { harmsMore: harmsPerSteps(applies.harmsPerCostStep, steps) }
            : {}),
          sourceId: actor.id,
          action: against.action,
          // The action's own save when it has one, otherwise what its source says saves are rolled
          // against. Never zero by default: that would let everybody shake a condition off.
          ...(action.save
            ? { difficulty: action.save.difficulty }
            : action.saveDifficulty !== undefined
              ? { difficulty: action.saveDifficulty }
              : {}),
          ...(action.concentration ? { concentration: true } : {}),
        });
      }
      // Pushed away from its maker (1.182), once whatever else it does has landed, and farther for
      // each charge more spent on it (1.271): a Ring of the Ram's.
      const pushedMore = (ctx.moreCharges ?? 0) * (action.itemUse?.charges?.step?.push ?? 0);
      const pushBy = action.push !== undefined || pushedMore > 0 ? (action.push ?? 0) + pushedMore : undefined;
      if (pushBy !== undefined && target.id !== actor.id && rulesetCombatStanding(target)) {
        pushTarget(ctx, actor, target, pushBy);
      }
      // Drawn toward its maker on their own budget (1.326): Whisper a Name.
      if (action.draws && target.id !== actor.id && rulesetCombatStanding(target)) {
        drawTarget(ctx, actor, target, action.draws.spends);
      }
      // Sent out of the fight (1.236), last of all.
      if (action.dismisses && target.id !== actor.id) dismiss(ctx, actor, action, target);
    }
    spendUsed();
  }
  // A spending blow that landed spends the whole number, back to the base; one that landed on nobody
  // costs what a miss costs at the number it was made with, which may crash its own maker.
  if (spends && action.toHit !== undefined) {
    const resource = ctx.combat.initiative.resource!;
    if (spends.landed) shiftInitiative(ctx, actor, resource.base - actor.initiative, "spent");
    else {
      const lose = stepValue(style?.spends?.onMiss, spends.number);
      if (lose > 0) shiftInitiative(ctx, actor, -lose, "missed");
    }
  }
  return null;
}

/** The style an attack is made in: the one it was chosen or held in, whatever has happened to its
 *  maker's number since, or, for one made out of a turn, the first its maker may use now. None for
 *  something that is not an attack. */
function attackStyle(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  styleId: string | undefined,
): RulesetInitiativeStyle | undefined {
  if (!rulesetActionTakesStyle(action)) return undefined;
  if (styleId === undefined) return rulesetAttackStyles(ctx.combat, actor, action)[0];
  return ctx.combat.initiative.resource?.styles.find((style) => style.id === styleId);
}

/** A number that attacks move, changed and said so. Crossing the crash line either way is settled
 *  here; the bonus for crashing somebody is the attacker's, and is settled where they did it. */
function shiftInitiative(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  amount: number,
  reason: Extract<RulesetCombatEvent, { type: "shift" }>["reason"],
  extra: Partial<
    Omit<Extract<RulesetCombatEvent, { type: "shift" }>, "type" | "actorId" | "amount" | "total" | "reason">
  > = {},
): void {
  combatant.initiative += amount;
  ctx.events.push({ type: "shift", actorId: combatant.id, amount, total: combatant.initiative, reason, ...extra });
  if (reason !== "taken") settleCrash(ctx, combatant);
}

/** Whether a combatant is crashed, kept in step with their number: crossing to the line or below puts
 *  the ruleset's crash condition on them (from whoever did it, when somebody did), and rising above it
 *  takes it off. `crashedTurns` is what counts their turns towards recovering. */
function settleCrash(ctx: RulesetCombatContext, combatant: RulesetCombatant, sourceId?: string): void {
  const crash = ctx.combat.initiative.resource?.crash;
  if (!crash) return;
  const crashed = combatant.initiative <= crash.at;
  if (crashed && combatant.crashedTurns === undefined) {
    combatant.crashedTurns = 0;
    if (crash.condition) {
      applyConditionId(
        ctx,
        combatant,
        crash.condition,
        { condition: crash.condition, duration: "instant" },
        {
          ...(sourceId ? { sourceId } : {}),
        },
      );
    }
  } else if (!crashed && combatant.crashedTurns !== undefined) {
    delete combatant.crashedTurns;
    if (crash.condition && rulesetCombatConditions(ctx.definition, combatant).includes(crash.condition)) {
      removeCondition(ctx, combatant, crash.condition, "recovered");
    }
  }
}

/** What a step table says at a number: the value of the last step at or below it, and nothing below
 *  the first. */
function stepValue(table: ReadonlyArray<readonly [number, number]> | undefined, at: number): number {
  let value = 0;
  for (const [threshold, step] of table ?? []) if (at >= threshold) value = step;
  return value;
}

/** Where an attack stopped: the held attack's own record, and what its window says about it. */
type RulesetHitHold = RulesetHeldAttack & {
  label: string;
  optionId: string;
  catalog?: string;
  entry?: string;
  blow?: RulesetBlowKind;
  /** Held for a side to choose what its symbols buy (1.382) rather than for answers to the hit. */
  asks?: "attacker" | "target";
  /** Whether that throw landed. */
  hit?: boolean;
};

// ── Between turns ──

/** The riders whose period has come round again. One that says "round" survives until the round
 *  turns over; one that says "turn" is fresh at the start of every turn there is. */
function clearSpentRiders(combatant: RulesetCombatant, freshRound: boolean): void {
  if (!combatant.ridersSpent?.length) return;
  const period = new Map((combatant.riders ?? []).map((rider) => [rider.id, rider.oncePer]));
  const kept = combatant.ridersSpent.filter((id) => !freshRound && period.get(id) === "round");
  if (kept.length > 0) combatant.ridersSpent = kept;
  else delete combatant.ridersSpent;
}

/** The points a signature action is bought with, back to full at the start of their own turn: they
 *  are what this combatant can spend before their next one comes round. */
function refreshRulesetSignature(actor: RulesetCombatant): void {
  if (actor.signature) actor.signature.points = actor.signature.max;
}

/** The roll an action that recharges makes at the start of its owner's turn. `from` or higher on
 *  its own dice brings it back; anything else leaves it spent and says what it rolled. */
function rollRulesetRecharges(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  // A recharge group rolls once (1.186), its first spent action rolling for all of them.
  const rolled = new Set<string>();
  for (const id of [...actor.spent]) {
    const action = actor.actions.find((entry) => entry.id === id);
    const group = action?.recharge?.group;
    if (group) {
      if (rolled.has(group)) continue;
      rolled.add(group);
    }
    // Nothing on this block recharges it any more, so it is simply available again rather than
    // spent forever by a block that changed under it.
    if (!action?.recharge) {
      actor.spent = actor.spent.filter((entry) => entry !== id);
      continue;
    }
    const rolls = rollRulesetDice(ctx.roll, action.recharge.dice.count, action.recharge.dice.sides);
    const kept = sumOf(rolls);
    const back = kept >= action.recharge.from;
    const members = group
      ? actor.actions.filter((entry) => entry.recharge?.group === group && actor.spent.includes(entry.id))
      : [action];
    if (back) actor.spent = actor.spent.filter((entry) => !members.some((member) => member.id === entry));
    ctx.events.push({
      type: "recharge",
      actorId: actor.id,
      optionId: id,
      label: members.map((member) => member.label).join(", "),
      rolls,
      kept,
      from: action.recharge.from,
      back,
    });
  }
}

/** Who is next to act: anybody the fight is not over for. A member who is down with nothing left to
 *  roll is stepped over until somebody brings them back. */
function canTakeTurn(combatant: RulesetCombatant): boolean {
  // Away and still taking turns (1.313), to find the way out of a maze.
  if (combatant.defeated) return !!(combatant.away?.turns && combatant.away.while);
  return !combatant.down || (combatant.dying && !combatant.stable);
}

/**
 * The end of one turn and the start of the next: the saves a condition repeats, the clocks it runs
 * on, the budgets a turn or a round gives back, the next actor in the order, and the roll a
 * character makes at the start of their turn while they are down.
 */
export function advanceRulesetTurn(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const combat = definition.combat;
  if (!combat) return { state, events: [] };
  const outcome = rulesetEncounterOutcome(state);
  if (outcome !== "ongoing") return { state, events: [{ type: "outcome", outcome }] };

  if (state.window) return refusal(state, currentRulesetActor(state)?.id ?? "", "window-open", "end-turn");
  const { ctx, finish } = begin(definition, combat, state, roller);
  const leaving = currentRulesetActor(ctx.state);
  if (leaving) {
    // Ending a turn in a zone comes before the turn's own conditions run out (1.172).
    zonesAtTurn(ctx, leaving, "turn-end");
    endsAway(ctx);
    tickConditions(ctx, leaving, "turn-end");
    // The first turn, spent surprised, is over (1.237).
    endSurprise(ctx, leaving);
    for (const summon of [...(leaving.summons ?? [])]) {
      if (leaving.flags.freshSummons?.includes(summon.actionId)) continue;
      summon.rounds -= 1;
      if (summon.rounds <= 0) endSummons(ctx, leaving, summon.actionId);
    }
    for (const zone of [...(leaving.zones ?? [])]) {
      // A bead grows as each of its caster's turns ends, the one it was cast on too (1.183).
      if (leaving.actions.find((entry) => entry.id === zone.actionId)?.zone?.detonates?.grows) {
        zone.grown = (zone.grown ?? 0) + 1;
      }
      if (leaving.flags.freshZones?.includes(zone.actionId)) continue;
      zone.rounds -= 1;
      if (zone.rounds <= 0) endZones(ctx, leaving, zone.actionId);
    }
    // Strikes a spend bought are for the turn it was spent on. Nothing is carried over.
    delete leaving.strikesLeft;
  }
  // The window BETWEEN two turns: one turn has ended and the next has not begun, which is when a
  // block spends its own points on one of its own actions. The turn begins once they have all
  // answered, so buying one never costs the next actor part of their turn.
  if (openSignatureWindow(ctx)) return finish();
  beginNextTurn(definition, combat, ctx);
  return finish();
}

/** Everybody who could buy a signature action right now, in the fight's own order, and the window
 *  that asks them. Nobody is asked when nobody can afford anything: an empty window would hold the
 *  fight open for an answer with nothing in it. */
function openSignatureWindow(ctx: RulesetCombatContext): boolean {
  // What lasts until the next lair action ends as its maker's lair count comes round (1.324).
  for (const maker of ctx.state.combatants) {
    if (!maker.lair || rulesetLairRound(ctx.definition, ctx.state, maker) === null) continue;
    // And what it put on anybody until then (1.327): the Hour Bell's.
    for (const holder of ctx.state.combatants) {
      for (const entry of [...holder.tracked]) {
        if (entry.untilLair && entry.source === maker.id) removeCondition(ctx, holder, entry.condition, "expired");
      }
    }
    if (!maker.zones?.some((zone) => zone.untilLair)) continue;
    // Its count is due and not yet taken this round, so whatever lasts until it ends now.
    for (const actionId of new Set(maker.zones.filter((zone) => zone.untilLair).map((zone) => zone.actionId)))
      endZones(ctx, maker, actionId);
  }
  const waiting = [...new Set(ctx.state.order)].filter(
    (id) => rulesetSignatureOptions(ctx.definition, ctx.state, id).length > 0,
  );
  if (waiting.length === 0) return false;
  // A round that throws initiative again has no next actor until it has been thrown, and that is
  // done once the window has closed, so a window at the end of a round names nobody rather than
  // whoever the old order would have put first.
  const next = nextTurnActor(ctx.state);
  const unknown = next?.wraps && (ctx.combat.initiative.each === "round" || !!ctx.combat.initiative.resource);
  const nextActorId = unknown ? "" : (next?.combatant.id ?? "");
  openWindow(ctx, { kind: "signature", trigger: { kind: "between-turns", nextActorId }, waiting });
  return true;
}

/** Who acts next, read without moving the fight, and whether their turn begins a new round: the
 *  window between two turns says whose turn it is holding up. */
function nextTurnActor(state: RulesetEncounterState): { combatant: RulesetCombatant; wraps: boolean } | null {
  let turn = state.turn;
  let wraps = false;
  for (let step = 0; step < state.order.length; step++) {
    if (turn + 1 >= state.order.length) wraps = true;
    turn = turn + 1 >= state.order.length ? 0 : turn + 1;
    const candidate = rulesetCombatant(state, state.order[turn]!);
    if (candidate && canTakeTurn(candidate) && !candidate.dazed) return { combatant: candidate, wraps };
  }
  return null;
}

/** The next turn, from a fight whose last one has already ended. Split out of `advanceRulesetTurn`
 *  so the window between the two can hold it: the turn-end books are closed either way, and this
 *  runs once, after the window rather than before it. */
function beginNextTurn(definition: RulesetDefinition, combat: RulesetCombat, ctx: RulesetCombatContext): void {
  // A turn put in after another (1.320), the Hourglass's, is taken once and leaves the order again.
  // Taken, or passed over by somebody who could not take it.
  if (ctx.state.interjected !== undefined && ctx.state.turn >= ctx.state.interjected) {
    ctx.state.order.splice(ctx.state.interjected, 1);
    ctx.state.turn -= 1;
    delete ctx.state.interjected;
  }
  let turn = ctx.state.turn;
  let round = ctx.state.round;
  let fresh = false;
  for (let step = 0; step < ctx.state.order.length; step++) {
    turn += 1;
    if (turn >= ctx.state.order.length) {
      // Passed over on the way round (1.320): out of the order before the next round.
      if (ctx.state.interjected !== undefined) {
        ctx.state.order.splice(ctx.state.interjected, 1);
        delete ctx.state.interjected;
      }
      turn = 0;
      round += 1;
      fresh = true;
      // A second turn was for the first round only (1.238).
      ctx.state.order = [...new Set(ctx.state.order)];
    }
    const candidate = rulesetCombatant(ctx.state, ctx.state.order[turn]!);
    if (candidate && canTakeTurn(candidate)) break;
  }
  ctx.state.turn = turn;
  ctx.state.round = round;
  // Who has begun a turn this round (1.327), afresh as it turns over.
  if (fresh) ctx.state.acted = [];
  if (fresh) {
    for (const combatant of ctx.state.combatants) {
      refreshRulesetBudgets(combat, combatant.budgets, "round");
      refreshSpendLimits(combatant, "round");
    }
    // What standing in the board's light does as the round ends (1.319): Noonfield's.
    lightRuleAtRoundEnd(ctx);
    // What the board does as the round ends, and as the next begins (1.318).
    ctx.events.push(...rulesetRunBoardEvents(ctx.state, "round-end", round - 1));
    ctx.events.push({ type: "round", round });
    ctx.events.push(...rulesetRunBoardEvents(ctx.state, "round-start", round));
    // A first round in which they took no turn (down, held) still ends their surprise (1.237).
    for (const combatant of ctx.state.combatants) endSurprise(ctx, combatant);
    // A ruleset whose initiative is thrown every round throws it again now, and the round starts at
    // whoever is first in the new order and can take a turn.
    if (combat.initiative.each === "round" || combat.initiative.resource) {
      // A number attacks move is not thrown again: the order simply follows it as it now stands.
      if (combat.initiative.resource) reorderByInitiative(ctx);
      else rethrowInitiative(definition, combat, ctx);
      const first = ctx.state.order.findIndex((id) => {
        const candidate = rulesetCombatant(ctx.state, id);
        return !!candidate && canTakeTurn(candidate);
      });
      ctx.state.turn = Math.max(0, first);
    }
  }
  // A rider fires once in its period. "turn" is fresh at the start of every turn, whosever it is,
  // so a strike made while somebody else is acting can still carry one; "round" waits for the round
  // to turn over. Everybody's, because a rider fires on its holder's blow, not on their turn.
  for (const combatant of ctx.state.combatants) clearSpentRiders(combatant, fresh);

  const actor = currentRulesetActor(ctx.state);
  if (actor) {
    refreshRulesetBudgets(combat, actor.budgets, "turn");
    refreshSpendLimits(actor, "turn");
    // A stance lasts until the actor's next turn, and that turn is now. Help was given to somebody
    // else and is spent by their own next attack, so it survives this.
    actor.flags = actor.flags.helped ? { helped: true } : {};
    // What it readied waits no longer (1.288): a spell held for it is spent all the same.
    const readied = actor.readied;
    if (readied) {
      delete actor.readied;
      ctx.events.push({ type: "ready", actorId: actor.id, label: readied.label, on: readied.on, outcome: "expired" });
      if (readied.paid && actor.concentrating?.actionId === readied.optionId) endConcentration(ctx, actor, "spent");
    }
    refreshRulesetMovement(definition, combat, actor, ctx.state);
    delete actor.trail;
    if (!actor.dazed) ctx.events.push({ type: "turn", actorId: actor.id, round });
    if (!ctx.state.acted?.includes(actor.id)) (ctx.state.acted ??= []).push(actor.id);
    refreshRulesetSignature(actor);
    rollRulesetRecharges(ctx, actor);
    recoverFromCrash(ctx, actor);
    // Its own drifting zones move first (1.173), then starting a turn in a zone (1.172), before
    // the turn's own conditions tick.
    driftZones(ctx, actor);
    burnAtTurn(ctx, actor);
    zonesAtTurn(ctx, actor, "turn-start");
    tickConditions(ctx, actor, "turn-start");
    // After the clocks, so what an aura's save puts on "until the start of its next turn" lasts it.
    if (!actor.defeated) aurasAtTurn(ctx, actor);
    // A condition that ended as the turn began no longer holds this turn's walk: nothing has been
    // spent yet, so the allowance is simply read again.
    refreshRulesetMovement(definition, combat, actor, ctx.state);
    // And its budgets, as the conditions it holds now change them (combat C6d).
    refreshRulesetBudgets(
      combat,
      actor.budgets,
      "turn",
      rulesetConditionEconomy(definition, combat, actor, ctx.state).budgets,
    );
    if (actor.dying && !actor.stable && !actor.defeated) deathSave(ctx, actor);
    if (actor.dazed) {
      const dazed = actor.dazed;
      tickConditions(ctx, actor, "turn-end");
      delete actor.dazed;
      if (dazed.condition) removeCondition(ctx, actor, dazed.condition, "expired");
      ctx.events.push({ type: "skip", actorId: actor.id, reason: "daze" });
      if (rulesetEncounterOutcome(ctx.state) === "ongoing") {
        beginNextTurn(definition, combat, ctx);
        return;
      }
    }
    // What a condition's table makes of this turn (1.264), once nothing else is left to change it.
    compelTurn(ctx, actor);
    // What a delay held over is completed before anything else is done this turn.
    openMoment(ctx, { kind: "turn-start", sourceId: actor.id, label: actor.name }, ctx.state.combatants);
    if (!ctx.state.window) completeDelayed(ctx, actor);
  }
  const after = rulesetEncounterOutcome(ctx.state);
  if (after !== "ongoing") pushOutcome(ctx, after);
}

/**
 * Auras as a turn starts (1.265): what the actor's own auras harm everybody they reach with (a
 * balor's Fire Aura), and then the save each aura reaching the actor asks of them (a pit fiend's
 * Fear Aura), a failure putting on what it applies from its holder, a success with
 * `immuneOnSuccess` keeping that holder's aura off them for the rest of the fight.
 */
function aurasAtTurn(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const spreading = rulesetAuraSpreaders(ctx.definition, ctx.state);
  // Its own auras grow as its turn starts (1.320): Frost Debt. Who it now reaches it spreads to as
  // this step ends, as every aura does.
  for (const { holder, aura, condition } of spreading) {
    if (holder.id !== actor.id || !aura.grows) continue;
    const before = rulesetAuraDistance(holder, aura, condition);
    if (before >= aura.grows.upTo) continue;
    holder.auraGrown = { ...holder.auraGrown, [condition]: (holder.auraGrown?.[condition] ?? 0) + 1 };
    ctx.events.push({
      type: "auraGrows",
      actorId: holder.id,
      condition,
      distance: rulesetAuraDistance(holder, aura, condition),
    });
  }
  for (const { holder, aura, condition } of spreading) {
    if (!aura.harms) continue;
    // As the turn of whoever it reaches starts (1.320), or its holder's own.
    if (aura.harms.on === "their-turn") {
      if (!actor.defeated && rulesetAuraReaches(ctx.definition, ctx.state, holder, aura, actor, condition)) {
        conditionHarm(ctx, actor, condition, holder.id, aura.harms, 1);
      }
      continue;
    }
    if (holder.id !== actor.id) continue;
    for (const target of [...ctx.state.combatants]) {
      if (target.defeated || !rulesetAuraReaches(ctx.definition, ctx.state, holder, aura, target, condition)) continue;
      conditionHarm(ctx, target, condition, holder.id, aura.harms, 1);
    }
  }
  for (const { holder, aura, condition } of spreading) {
    const save = aura.save;
    if (!save || actor.defeated) continue;
    const key = `${holder.id}/${condition}`;
    if (actor.auraSafe?.includes(key) || !rulesetAuraReaches(ctx.definition, ctx.state, holder, aura, actor, condition))
      continue;
    if (
      save.seen &&
      !(
        rulesetCanSee(ctx.definition, ctx.state, holder, actor) &&
        rulesetCanSee(ctx.definition, ctx.state, actor, holder)
      )
    )
      continue;
    // The save difficulty of whatever put the aura on its holder, where it says so (1.274).
    const difficulty =
      (save.appliedDifficulty
        ? holder.tracked.find((entry) => entry.condition === condition)?.difficulty
        : undefined) ?? save.difficulty;
    const saved = rollSave(ctx, actor, save.save, difficulty, holder.id, undefined, {
      conditions: save.applies.map((applied) => applied.condition),
    });
    if (saved) {
      if (save.immuneOnSuccess) actor.auraSafe = [...(actor.auraSafe ?? []), key];
      continue;
    }
    // Failed by enough, something worse goes on instead (1.268): a medusa's petrifying.
    const rolled = [...ctx.events].reverse().find((event) => event.type === "save" && event.actorId === actor.id);
    const missedBy = rolled?.type === "save" ? rolled.difficulty - rolled.total : 0;
    const applies = save.failedBy && missedBy >= save.failedBy.atLeast ? save.failedBy.applies : save.applies;
    for (const applied of applies) {
      applyConditionId(ctx, actor, applied.condition, applied as RulesetCombatApplies, {
        sourceId: holder.id,
        difficulty,
      });
      // Once it ends, however it ends, that aura stays off them (1.269): a sea hag's.
      const on = actor.tracked.find((entry) => entry.condition === applied.condition && entry.source === holder.id);
      if (save.immuneWhenEnds && on) on.auraSafeOnEnd = key;
    }
  }
}

/** The ways a turn's wander may go, as a d8 picks them: north, then round clockwise. */
const WANDER_WAYS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/**
 * A condition's table rolled as its holder's turn starts (1.264): 5e's Confusion. The first table
 * among what they hold decides the turn. `wander` walks as far as their speed goes one way a d8
 * picks, straight on until something stops them, and the turn is then only ended; `strike` picks a
 * creature in the reach of one of their melee attacks, friend or foe, and nobody else may be struck
 * this turn, or makes it `nothing` with nobody there.
 */
function compelTurn(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  if (!rulesetCombatStanding(actor) || actor.defeated) return;
  if (rulesetCombatEffects(ctx.definition, ctx.combat, actor, ctx.state).has("cannot-act")) return;
  const active = rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state);
  // What it lets fall as its turn starts (1.266): Command's "drop".
  for (const entry of active) {
    if (entry.behavior?.drops?.at === "turn-start") letFall(ctx, actor, entry.condition, entry.behavior.drops);
  }
  // A turn that starts with nowhere to walk is its own where a condition says so (1.266): Fear.
  if (active.some((entry) => entry.behavior?.onlyWhenStuck === "any")) {
    actor.flags.stuck = rulesetReachableCells(ctx.definition, ctx.state, actor.id).length === 0;
  }
  const rule = active.find((entry) => entry.behavior?.table);
  const table = rule?.behavior?.table;
  if (!rule || !table) return;
  const dice = parseRulesetCombatDice(table.dice);
  if (!dice) return;
  const roll = rollAmount(ctx, dice).total;
  let does = table.rows.find((row) => roll <= row.atMost)?.does ?? "normal";
  let targetId: string | undefined;
  if (does === "strike") {
    actor.flags.compelled = "strike";
    const reach = new Set<string>();
    for (const option of rulesetUncompelledOptions(ctx.definition, ctx.state, actor.id)) {
      if (option.kind !== "attack" && option.kind !== "block") continue;
      const action = actor.actions.find((entry) => entry.id === option.id);
      if (!action || !rulesetIsAttack(action) || (action.range && action.reach === undefined)) continue;
      for (const id of rulesetOptionTargets(ctx.definition, ctx.state, actor.id, option)) {
        if (id !== actor.id && rulesetBlowKind(ctx.state, actor, rulesetCombatant(ctx.state, id)!, action) === "melee")
          reach.add(id);
      }
    }
    const within = [...reach].sort();
    if (within.length) targetId = within[rollRulesetDice(ctx.roll, 1, within.length)[0]! - 1];
    if (targetId) actor.flags.compelledTarget = targetId;
    else {
      does = "nothing";
      delete actor.flags.compelled;
    }
  }
  ctx.events.push({
    type: "compelled",
    actorId: actor.id,
    condition: rule.condition,
    roll,
    does,
    ...(targetId ? { targetId } : {}),
  });
  if (does === "nothing") actor.flags.compelled = "nothing";
  if (does !== "wander") return;
  actor.flags.compelled = "wander";
  const from = rulesetPositionOf(actor);
  if (from) {
    const [dx, dy] = WANDER_WAYS[rollRulesetDice(ctx.roll, 1, 8)[0]! - 1]!;
    const cells = new Map(
      rulesetReachableCells(ctx.definition, ctx.state, actor.id).map((cell) => [`${cell.x},${cell.y}`, cell]),
    );
    let last: (typeof cells extends Map<string, infer C> ? C : never) | undefined;
    for (let step = 1; ; step++) {
      const cell = cells.get(`${from.x + dx * step},${from.y + dy * step}`);
      if (!cell) {
        // Somebody standing in the way is walked past, as a walk does, when there is room beyond.
        if (!cells.has(`${from.x + dx * (step + 1)},${from.y + dy * (step + 1)}`)) break;
        continue;
      }
      last = cell;
    }
    if (last) resolveMove(ctx, actor, last);
  }
  actor.flags.compelled = "wandered";
}

/** What a combatant may spend of a limited pool starts again with the period the limit is counted in. */
function refreshSpendLimits(combatant: RulesetCombatant, per: "turn" | "round"): void {
  for (const limit of Object.values(combatant.limits ?? {})) if (limit.per === per) limit.spent = 0;
}

/** A crashed combatant's own turn begins: one more towards recovering, and at the ruleset's count the
 *  number goes back to the base before they act. */
function recoverFromCrash(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const crash = ctx.combat.initiative.resource?.crash;
  if (actor.crashedTurns === undefined || !crash?.recoverAfter) return;
  actor.crashedTurns += 1;
  if (actor.crashedTurns < crash.recoverAfter) return;
  shiftInitiative(ctx, actor, ctx.combat.initiative.resource!.base - actor.initiative, "recovered");
}

/** The order sorted again by everybody's number as it stands, which is how a round begins where
 *  initiative is a number attacks move. */
function reorderByInitiative(ctx: RulesetCombatContext): void {
  ctx.state.order = rulesetInitiativeOrder(ctx.state.combatants);
  pushInitiativeOrder(ctx);
}

/** The order as it now stands, said once, for everybody still in the fight. */
function pushInitiativeOrder(ctx: RulesetCombatContext): void {
  ctx.events.push({
    type: "initiative",
    entries: [...new Set(ctx.state.order)].flatMap((id) => {
      const combatant = rulesetCombatant(ctx.state, id);
      return combatant && !combatant.defeated
        ? [
            {
              actorId: id,
              roll: combatant.initiativeRoll,
              modifier: combatant.initiativeModifier,
              total: combatant.initiative,
              ...rulesetInitiativeTwice(combatant),
            },
          ]
        : [];
    }),
  });
}

/** Initiative thrown again for everybody still in the fight, with each one's modifier as it stands
 *  now, and the order sorted by the same rules it opened with. Somebody the fight is over for keeps
 *  their old number and simply never takes a turn. */
function rethrowInitiative(definition: RulesetDefinition, combat: RulesetCombat, ctx: RulesetCombatContext): void {
  for (const combatant of ctx.state.combatants) {
    if (combatant.defeated) continue;
    const now = rulesetInitiativeModifierNow(definition, combat, combatant);
    const thrown = combat.initiative.pool
      ? rulesetPoolInitiative(definition, combat, ctx.roll, now)
      : (() => {
          const faces = throwInitiativeDice(combat, ctx.roll);
          return { roll: faces, modifier: now, total: sumOf(faces) + now };
        })();
    combatant.initiativeRoll = thrown.roll;
    combatant.initiativeModifier = thrown.modifier;
    combatant.initiative = thrown.total;
    // Thrown twice where the sheet or the conditions held now say so (1.240).
    rulesetThrowInitiativeAgain(definition, combat, combatant, ctx.roll, ctx.state);
  }
  ctx.state.order = rulesetInitiativeOrder(ctx.state.combatants);
  pushInitiativeOrder(ctx);
}

/** Who won, if anybody has yet. A fight is over for a side when nobody on it is still standing;
 *  victory is read first, so a last blow that takes both sides down is still a win. */
export function rulesetEncounterOutcome(state: RulesetEncounterState): RulesetEncounterOutcome {
  // An action may finish the other side while a fall it caused is still waiting for an answer.
  if (state.window?.resume?.kind === "fall" || state.pendingFalls?.length) return "ongoing";
  const enemies = state.combatants.filter((combatant) => combatant.side === "enemy");
  const party = state.combatants.filter((combatant) => combatant.side === "party");
  if (enemies.length > 0 && enemies.every((combatant) => !rulesetCombatStanding(combatant))) return "victory";
  if (party.length > 0 && party.every((combatant) => !rulesetCombatStanding(combatant))) {
    // Out of it with somebody gone alive (1.279): the party got away, it did not fall.
    return party.some((combatant) => combatant.away?.left) ? "fled" : "defeat";
  }
  return "ongoing";
}

/** The fight as it stands, in the ruleset's own numbers. */
export function rulesetEncounterSummary(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): RulesetEncounterSummary {
  const combat = definition.combat;
  const health = (combatant: RulesetCombatant) =>
    combat ? rulesetCombatHealth(definition, combat, combatant) : { value: 0, max: 0, temp: 0 };
  return {
    outcome: rulesetEncounterOutcome(state),
    rounds: state.round,
    party: state.combatants
      .filter((combatant) => combatant.side === "party")
      .map((combatant) => {
        const now = health(combatant);
        return {
          id: combatant.id,
          name: combatant.name,
          health: now.value,
          maxHealth: now.max,
          temp: now.temp,
          down: combatant.down,
          dying: combatant.dying,
          stable: combatant.stable,
          conditions: rulesetCombatConditions(definition, combatant),
          ...(combatant.away?.left ? { left: true as const } : {}),
        };
      }),
    enemies: state.combatants
      .filter((combatant) => combatant.side === "enemy")
      .map((combatant) => {
        const now = health(combatant);
        return {
          id: combatant.id,
          name: combatant.name,
          health: now.value,
          maxHealth: now.max,
          defeated: combatant.defeated,
          ...(combatant.away?.left ? { left: true as const } : {}),
        };
      }),
    ...(state.board?.broken?.length ? { broken: [...state.board.broken] } : {}),
  };
}
