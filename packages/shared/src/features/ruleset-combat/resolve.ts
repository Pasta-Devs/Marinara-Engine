// Resolving a fight: one choice at a time, and the bookkeeping between turns.
//
// Nothing here throws. A choice the rules do not allow returns the state it was given, untouched,
// and one `refused` event saying why, so a Game Master's fiction can be corrected rather than
// silently accepted. Everything a party member spends, loses or gains goes through
// `applyRulesetSheetOp`, so a fight can never write something the sheet would refuse from the
// player or from the Game Master.

import { rulesetTierAddsProficiency, type RulesetSaveAgainst } from "../rulesets/check-effects.js";
import { rulesetCatalogEntriesByRef } from "../rulesets/scaled-rows.js";
import { rulesetCombatantBehavior, rulesetCombatantMind } from "./mind.js";
import {
  rulesetPoolMaxSuccesses,
  rulesetRowEntryRef,
  rulesetSheetBuildSchema,
  type RulesetAbsorbs,
  type RulesetCatalogItem,
  type RulesetTurns,
  type RulesetBehaviorDrops,
  type RulesetCombat,
  type RulesetCreatureHideEntry,
  type RulesetDefinition,
  type RulesetHangsOn,
  type RulesetConditionHarms,
  type RulesetConditionInside,
  type RulesetInsideRoom,
  type RulesetTargetIs,
  type RulesetValueRef,
  type RulesetMoraleTrigger,
} from "../../schemas/ruleset.schema.js";
import {
  evaluateRulesetSheetLive,
  readRulesetLive,
  rulesetLiveWithDayClock,
  rulesetLiveWithWardsOff,
  rulesetLiveWithDaySave,
  rulesetLiveWithWornFrom,
  rulesetRecoverPicks,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "../rulesets/live-state.js";
import { resolveRulesetValueRef, rulesetAbilityModifier } from "../rulesets/sheet-math.js";
import { rulesetMaterialFor } from "../rulesets/material.js";
import {
  RULESET_PICK_UP_OPTION_PREFIX,
  RULESET_AVERT_OPTION_PREFIX,
  RULESET_SLIP_OPTION_PREFIX,
  RULESET_LEND_OPTION_PREFIX,
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
  rulesetItemOverused,
  rulesetItemUsedSinceRest,
  rulesetItemUseLeft,
  spendRulesetShots,
  rulesetShotsAvailable,
  rulesetStoredNow,
} from "./ammo.js";
import { parseRulesetCombatDice, rollRulesetDice, rulesetCombatRoller, sumOf } from "./dice.js";
import { blocksSight, elevationAt } from "../tactical-combat/math.js";
import {
  rulesetCanSee,
  rulesetHiddenFrom,
  rulesetHidingTraits,
  rulesetLightAt,
  rulesetSeesCell,
  rulesetSenseRanges,
  rulesetSeesTrue,
  rulesetStaysHidden,
} from "./sight.js";
import {
  rulesetCombatAdvantage,
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
  rulesetCombatHurt,
  refreshRulesetMovement,
  rulesetCombatant,
  rulesetCopyDispersed,
  rulesetAbilityScore,
  rulesetActiveConditions,
  rulesetAuraDistance,
  rulesetTargetHasSenses,
  rulesetConditionKin,
  rulesetTargetIs,
  rulesetTargetTypesAllow,
  rulesetCatalogWhereReads,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetDefiance,
  rulesetDefying,
  rulesetMovementAllowance,
  rulesetSpeedZero,
  rulesetSealed,
  rulesetSealedApart,
  rulesetStasis,
  rulesetEngulfable,
  rulesetSizeRank,
  rulesetInsideCorpse,
  rulesetFitCell,
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
  rulesetSuppressedAttack,
  rulesetSuppressedOn,
  rulesetSetAsideBy,
  rulesetItemSuppressed,
  rulesetImmuneToCondition,
  writeRulesetSheet,
  type RulesetCombatHealth,
  type RulesetConditionModifier,
  rulesetAuraReaches,
  rulesetAuraSpreaders,
  rulesetSyncAuras,
  rulesetSyncSizes,
  rulesetSyncAbilities,
  rulesetStoredAction,
  rulesetSyncSpeeds,
  rulesetRegenerations,
  rulesetHangsOn,
  rulesetMovesOnly,
  rulesetLightMatches,
  rulesetModeRuleHolds,
  rulesetConditionLeft,
  rulesetCommandReaches,
  rulesetNoteProvoked,
  rulesetStepTimes,
  rulesetItemCallRoll,
  rulesetNoteFight,
} from "./encounter.js";
import {
  rulesetAreaCells,
  rulesetAroundCells,
  rulesetBlowKind,
  rulesetChargeRun,
  rulesetCellDistance,
  rulesetCellEnterCost,
  rulesetMoveStep,
  rulesetOpportunityAttack,
  rulesetBestWeapon,
  rulesetGapFrom,
  rulesetPositionOf,
  rulesetPathCells,
  rulesetPullPath,
  rulesetSqueezeAt,
  rulesetPushPath,
  rulesetStepLeavesReach,
  rulesetThreateningEnemies,
  rulesetAirborne,
  rulesetCellBlocked,
  rulesetCrowdedStep,
  rulesetDragging,
  rulesetUnderwater,
  rulesetHardLanding,
  rulesetThroughSolid,
  rulesetLevelOf,
  rulesetSlowedCells,
  rulesetSlickCells,
  rulesetSlowedStep,
  rulesetOnlyCrosses,
  rulesetWallShape,
  rulesetDistanceTo,
  rulesetCombatantDistance,
  rulesetFills,
  rulesetFootprint,
  rulesetFootprintAt,
  rulesetBehaviorAnchor,
  rulesetGap,
  rulesetInCells,
  rulesetNearestCell,
  rulesetReachableCells,
  rulesetSpanOf,
  rulesetWalkingDistances,
  rulesetWardedFrom,
  rulesetKeptOutIs,
  rulesetUnhinderedBy,
} from "./grid.js";
import {
  rulesetAttackModifierReaches,
  rulesetTargetMoment,
  rulesetBorrowedTurn,
  rulesetLegendaryMoveCells,
  rulesetLentMovement,
  rulesetDamageModifiers,
  rulesetHolderValue,
  rulesetWeaponBlow,
  rulesetWeaponNow,
  RULESET_MOVE_OPTION,
  RULESET_ZONE_OPTION_PREFIX,
  RULESET_ZONE_TURN_OPTION_PREFIX,
  RULESET_ZONE_CHECK_OPTION_PREFIX,
  RULESET_ZONE_CLOSE_OPTION_PREFIX,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  RULESET_CLIMB_OUT_OPTION,
  RULESET_MOUNT_OPTION_PREFIX,
  RULESET_DISMOUNT_OPTION,
  RULESET_JUMP_OPTION,
  RULESET_CAREFUL_OPTION,
  RULESET_FLY_DOWN_OPTION,
  RULESET_FLY_UP_OPTION,
  rulesetRelightCells,
  RULESET_LAND_OPTION,
  RULESET_TAKE_OFF_OPTION,
  planRulesetCombatCost,
  rulesetChosenUsesMax,
  rulesetAlterFits,
  rulesetAlterLevelFits,
  rulesetAlteredAction,
  planRulesetAlterCost,
  rulesetActionAvailable,
  rulesetSheetWithin,
  rulesetSheetValue,
  rulesetFailedChanceLive,
  rulesetAimLegal,
  rulesetAimedCells,
  rulesetCopiesLegal,
  rulesetWarded,
  type RulesetAreaLay,
  rulesetAreaTargets,
  rulesetActionQualities,
  rulesetAroundTargets,
  rulesetAttackMode,
  type RulesetAttackModeWhy,
  rulesetCombatOptions,
  rulesetUncompelledOptions,
  rulesetContestCheck,
  rulesetHoldsTagged,
  rulesetEscapeDc,
  rulesetHoldsFor,
  rulesetCostSteps,
  rulesetActionUses,
  rulesetInnateSlot,
  rulesetInnateSlotsLeft,
  rulesetPaidLevel,
  rulesetBonusSpellKind,
  rulesetCriticalFromAdjacent,
  rulesetCoverBonus,
  rulesetDefenseAgainst,
  rulesetToHitAgainst,
  rulesetMarkedBy,
  rulesetFreeStrike,
  rulesetUpInTheAir,
  rulesetGrantedStandard,
  rulesetOptionTargets,
  rulesetUsedOn,
  rulesetUsedOnKey,
  rulesetSparedKey,
  rulesetUsedOnMarks,
  rulesetProneCondition,
  rulesetReactionPointsAtSource,
  rulesetReactionTarget,
  rulesetRedirectTargets,
  rulesetHitItem,
  rulesetWindowCause,
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
  rulesetImposes,
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
  rulesetKeptMode,
  rulesetRepeatsHeld,
  rulesetReadiedOption,
  rulesetUseIsFree,
  rulesetWithFreeUse,
  rulesetAimCells,
  rulesetNeededComponents,
  rulesetRowsReach,
  rulesetRaisableCorpse,
  rulesetSlotUsed,
  rulesetTeleportIntoBarred,
  rulesetHelpCounts,
  rulesetUsesKey,
} from "./options.js";
import type {
  RulesetActionResume,
  RulesetBoardProp,
  RulesetFallResume,
  RulesetBlowKind,
  RulesetCombatAction,
  RulesetCombatRays,
  RulesetCombatHealAdd,
  RulesetAttackedRecord,
  RulesetCombatCharge,
  RulesetCombatMove,
  RulesetCombatDamageClause,
  RulesetCombatModeLine,
  RulesetCombatAmount,
  RulesetCombatAroundHit,
  RulesetAllHit,
  RulesetCombatApplies,
  RulesetCombatAttackOutcome,
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
  RulesetCombatAlter,
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
  rulesetStandingLayers,
  rulesetStandingProps,
  rulesetStandingSections,
  rulesetStandingZones,
  rulesetZoneCatches,
  rulesetZoneCells,
  rulesetZoneMiddles,
  rulesetZoneHold,
  rulesetZoneHolds,
  rulesetZoneHoldsOne,
  rulesetZoneDriftCell,
  rulesetZoneOccupants,
  rulesetZoneSideOccupants,
  rulesetSyncZoneWalls,
  rulesetZoneLights,
  rulesetZoneSeenBy,
} from "./zones.js";
import { rulesetChangeGround, rulesetClearGrowth, rulesetGrowthRule, rulesetRunBoardEvents } from "./board-events.js";
import { RULESET_CALL_MAX, RULESET_CALLED_FIGHT_MAX, rulesetCallCreatures, rulesetTurnAfterCalls } from "./calls.js";
import { rulesetFormAllowed, rulesetKeepsAction, rulesetLeaveShape, rulesetTakeShape } from "./shape.js";
import { rulesetDrawAsUsed } from "./in-hand.js";

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
  /** The kinds of harm that landed on each target in the blow being dealt (1.400), "" for none: what
   *  a hang-on at 1 refuses (Undead Fortitude's radiant). Read and cleared as the blow ends. */
  blowTypes: Map<string, Set<string>>;
  /** The kinds of harm each target was subjected to in the blow being dealt, whatever they dealt:
   *  what a creature splits on (1.475) though it is immune to it, as a Black Pudding is to lightning.
   *  Read and cleared as the blow ends. */
  blowSubjected: Map<string, Set<string>>;
  /** What each target's own health was dealt past 0 in the blow being dealt (1.709): what massive
   *  damage reads. Read and cleared as the blow ends. */
  blowOverflow: Map<string, number>;
  /** Source-side harm ends conditions only once the harmful step has finished (1.125). */
  harmEndings: Array<() => void>;
  /** Mounts moved against their will this step (1.496), whose riders may come off. */
  shakenMounts?: Set<string>;
  /** How many of `events` have been read for who was stirred (1.436). */
  stirredAt?: number;
  /** The cell an area was aimed at in this step, which a save against it takes cover from. */
  aimedAt?: RulesetCombatCell;
  /** Each target's one save against the rays striking them (1.468), read by every ray after the
   *  first. */
  raySaves?: Map<string, boolean>;
  /** An entry turned back at its user (1.523), being resolved on them: it turns no further. */
  turning?: true;
  /** Where further copies of the area were set down (1.178). */
  aimedAlso?: RulesetCombatCell[];
  /** A lasting area its endsSpells is aimed at instead of a creature (1.427). */
  dispel?: { casterId: string; actionId: string };
  /** The conditions its user picked for its endsSpells to end (1.427). */
  endsChosen?: ReadonlySet<string>;
  falling?: RulesetFallResume[];
  /** A standing zone is striking on its own, not its caster acting (1.180). */
  byZone?: true;
  /** Whoever a zone's `endsWalk` just stopped (1.689): their walk ends where they stand. */
  walkHalted?: string;
  /** A summons striking by itself as its summoner's turn starts (1.539): never held for an answer. */
  summonStriking?: true;
  /** Where a summons being cast appears, worked out before its maker strikes from there. */
  summonAppears?: RulesetCombatCell;
  /** Whose turn's own start or end is being counted down right now, so a condition left behind in
   *  the middle of a turn can be told from one left behind as the turn begins or ends. */
  ticking?: string;
  /** A strike made inside a window that may still be held where it hits (1.243). */
  nestHit?: true;
  /** An opportunity attack being resolved (1.430), for what is narrowed to those. */
  opportunity?: true;
  /** The budget the action being resolved was paid for from, for an answer to its hit (1.248). */
  strikeBudget?: string;
  /** How many uses its user chose to spend on the action being resolved (1.251). */
  chosenAmount?: number;
  /** How many more of an item's charges its user spends on the action being resolved (1.269). */
  moreCharges?: number;
  /** Who is making a blow that reaps (1.323): whoever it fells on Held Ground is reaped. */
  reaping?: string;
  /** The action being resolved and its maker (1.545), innermost first: what a fall was dealt by. */
  acting?: { actorId: string; action: RulesetCombatAction };
  /** Where the teleport being resolved goes, and who goes along (1.276); nowhere is out of the
   *  fight (1.279). */
  teleport?: { to?: RulesetCombatCell; carries: string[] };
  /** Whoever is casting what was stored in them by itself (1.569), so it cannot set off another. */
  releasing?: Set<string>;
  /** The action being resolved follows its own charge (1.574): the run is spent, so it carries none. */
  uncharged?: true;
  /** The item the action being resolved was used on with no charges left tore for it (1.624): it does
   *  nothing. */
  tore?: true;
  /** Where the action being resolved moves its target to (1.565), and how many levels up. */
  carriesTo?: { x: number; y: number; rises: number };
  /** The catalog the action being resolved was cast out of, and what it puts on (1.278). */
  harming?: { catalog: string; applies: string[] };
  /** The window between turns a legendary cast was bought in (1.284): every window opened while it
   *  resolves holds it, to be asked on from once they have all closed. */
  outer?: RulesetCombatWindow;
  /** Harm to its user an alteration deals once the step is done (1.415): Overchannel. */
  backlash?: Array<{
    actorId: string;
    backlash: NonNullable<RulesetCombatAlter["backlash"]>;
    level: number;
    spentBefore: number;
    label: string;
  }>;
  /** Who just caught a weapon's missile, and its damage, for the moment that opens after (1.416). */
  caught?: {
    targetIds: string[];
    damage: { count: number; sides: number; type?: string };
    /** The shooter's ammunition it was (1.626). */
    missile?: { item: number; recover?: number };
  };
  /** Who the use being resolved attacked, hit or missed (1.422), for the moment once it is over. */
  attacked?: RulesetAttackedRecord;
  /** Answers to an opponent using something held but not given, and why (see `RulesetCombatStep`). */
  unanswered?: NonNullable<RulesetCombatStep["unanswered"]>;
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
  rulesetNoteFight(next);
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
    blowTypes: new Map(),
    blowSubjected: new Map(),
    blowOverflow: new Map(),
    harmEndings: [],
    ...(borrowedOuter ? { outer: borrowedOuter } : {}),
  };
  for (const target of next.combatants) {
    endImmuneConditions(ctx, target);
    holderBound(ctx, target);
  }
  leaveWithCallers(ctx);
  return {
    ctx,
    finish: () => {
      // Stopped time that reached somebody else is over (1.507).
      timeStopReached(ctx);
      // Who a wearer's item kept off them, and whom they have now attacked, harmed or forced to save
      // (1.619): those rats are no longer indifferent.
      for (const event of ctx.events) {
        if (event.type === "attack" || event.type === "contest")
          rulesetNoteProvoked(next, event.actorId, event.targetId);
        else if ((event.type === "damage" || event.type === "save") && event.sourceId) {
          rulesetNoteProvoked(next, event.sourceId, event.type === "damage" ? event.targetId : event.actorId);
        }
      }
      noteStirred(ctx);
      for (const target of next.combatants) {
        endImmuneConditions(ctx, target);
        holderBound(ctx, target);
      }
      // Called creatures a zone sets aside, and back where it no longer does (1.533).
      setAsideCalled(ctx);
      // Riders where their mounts are, or off them (1.496).
      syncMounts(ctx);
      leaveWithCallers(ctx);
      for (const end of ctx.harmEndings.splice(0)) end();
      // What an alteration costs its user's health, once what it changed was cast (1.415).
      for (const one of ctx.backlash?.splice(0) ?? []) {
        backlashOn(ctx, one);
        for (const end of ctx.harmEndings.splice(0)) end();
        noteOutcome(ctx);
      }
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
      // Given ways of moving, or left with their own, as the conditions now held say (1.395): up in
      // the air with no flight left, they fall.
      const heights = new Map(next.combatants.map((one) => [one.id, one.altitude]));
      for (const id of rulesetSyncSpeeds(definition, next)) {
        const one = rulesetCombatant(next, id);
        if (!one) continue;
        // Lifted by what it now holds (1.566): Reverse Gravity.
        const was = heights.get(id);
        if (one.altitude !== undefined && one.altitude > (was ?? -Infinity) && next.board?.grid) {
          const ground = elevationAt(next.board.grid, one.x ?? 0, one.y ?? 0);
          ctx.events.push({ type: "lifted", targetId: id, from: (was ?? ground) - ground, to: one.altitude - ground });
        }
        groundFlier(ctx, one);
      }
      // Their numbers worked out again as the conditions now held change their abilities (1.515).
      rulesetSyncAbilities(definition, next);
      // On the side of whoever controls them, or back on their own (1.577); and a controller whose
      // host died throws to live.
      syncControl(ctx);
      // Off once its source cannot keep it up, or its holder cannot hear them (1.584): Enthrall.
      endUnkeptConditions(ctx);
      // Given way as its holder first sees somebody (1.638): a Philter of Love.
      firstSightings(ctx);
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
      return { state: next, events: ctx.events, ...(ctx.unanswered?.length ? { unanswered: ctx.unanswered } : {}) };
    },
  };
}

/** A condition that comes off through its source (1.584): once they do one of its `effects` or hold
 *  one of its `conditions`, are stopped from using one of its `components`, or its holder lacks one
 *  of its `holderLacks`. 5e's Enthrall, ended by its caster's incapacitation or silence, or by its
 *  holder going deaf. */
function endUnkeptConditions(ctx: RulesetCombatContext): void {
  const rules = new Map(
    (ctx.combat.conditions ?? []).filter((one) => one.endsWhenSource).map((one) => [one.condition, one]),
  );
  if (rules.size === 0) return;
  for (const holder of ctx.state.combatants) {
    for (const entry of [...holder.tracked]) {
      const rule = rules.get(entry.condition)?.endsWhenSource;
      if (!rule || !entry.source) continue;
      const source = rulesetCombatant(ctx.state, entry.source);
      if (!source) continue;
      const theirs = rulesetActiveConditions(ctx.definition, ctx.combat, source, ctx.state);
      const ends =
        (rule.effects && theirs.some((one) => one.effects.some((effect) => rule.effects!.includes(effect)))) ||
        (rule.conditions &&
          rulesetCombatConditions(ctx.definition, source).some((id) => rule.conditions!.includes(id))) ||
        (rule.components &&
          theirs.some((one) => one.forbids?.components?.some((component) => rule.components!.includes(component)))) ||
        (rule.holderLacks && !rulesetTargetHasSenses(ctx.definition, ctx.state, holder, rule.holderLacks)) ||
        // Or its source holding none of these (1.617): a swarm swayed only while its piper plays.
        (rule.lacks && !rulesetCombatConditions(ctx.definition, source).some((id) => rule.lacks!.includes(id)));
      if (ends) removeCondition(ctx, holder, entry.condition, "expired", "endsWhenSource");
    }
  }
}

/** A condition that gives way as its holder first sees another creature (1.638), to what its
 *  `onFirstSeen` puts on, from the nearest of those they see now: a Philter of Love's charm. */
function firstSightings(ctx: RulesetCombatContext): void {
  const rules = new Map(
    (ctx.combat.conditions ?? []).filter((one) => one.onFirstSeen).map((one) => [one.condition, one.onFirstSeen!]),
  );
  if (rules.size === 0) return;
  for (const holder of ctx.state.combatants) {
    if (!rulesetCombatStanding(holder)) continue;
    for (const entry of [...holder.tracked]) {
      const rule = rules.get(entry.condition);
      if (!rule || !holder.tracked.includes(entry)) continue;
      const seen = ctx.state.combatants
        .filter(
          (one) =>
            one.id !== holder.id && rulesetCombatStanding(one) && rulesetCanSee(ctx.definition, ctx.state, holder, one),
        )
        .sort(
          (a, b) =>
            (ctx.state.board ? rulesetCombatantDistance(ctx.state, holder, a) : 0) -
            (ctx.state.board ? rulesetCombatantDistance(ctx.state, holder, b) : 0),
        )[0];
      if (!seen) continue;
      removeCondition(ctx, holder, entry.condition, "spent");
      applyConditionId(ctx, holder, rule.applies.condition, rule.applies, { sourceId: seen.id });
    }
  }
}

/** What its holder keeps only while they can hear whoever put it on (1.618), asked as their turn
 *  starts: lacking the sense, farther than `beyond`, or with that one gone or down. 5e's Pipes of the
 *  Sewers. */
function unheardSources(ctx: RulesetCombatContext, holder: RulesetCombatant): void {
  const perCell = ctx.definition.combat?.distance?.perCell;
  for (const entry of [...holder.tracked]) {
    const rule = ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.endsWhenHolder
      ?.cantHearSource;
    if (!rule || !entry.source || entry.source === holder.id) continue;
    const source = rulesetCombatant(ctx.state, entry.source);
    const unheard =
      !source ||
      source.defeated ||
      !!source.away ||
      !rulesetTargetHasSenses(ctx.definition, ctx.state, holder, [rule.sense]) ||
      (rule.beyond !== undefined &&
        perCell !== undefined &&
        !!ctx.state.board?.grid &&
        rulesetCombatantDistance(ctx.state, holder, source) > rulesetInCells(rule.beyond, perCell));
    if (unheard && holder.tracked.includes(entry))
      removeCondition(ctx, holder, entry.condition, "expired", "cantHearSource");
  }
}

/** What lasts until its source acts again comes off as they take another action (1.599): 5e's
 *  Interposing Hand, until the hand is given a different command. */
function endOnSourceActing(ctx: RulesetCombatContext, source: RulesetCombatant): void {
  const acts = new Set(
    (ctx.combat.conditions ?? []).filter((one) => one.endsWhenSource?.acts).map((one) => one.condition),
  );
  if (acts.size === 0) return;
  for (const holder of ctx.state.combatants) {
    for (const entry of [...holder.tracked]) {
      if (acts.has(entry.condition) && entry.source === source.id)
        removeCondition(ctx, holder, entry.condition, "expired");
    }
  }
}

/** Who holds a condition that `controls` them fights on its source's side while it holds and the
 *  source stands, and on their own again after (1.577): Magic Jar. As a holder of one with
 *  `holderDies` dies, its source throws that save against the difficulty off their own sheet, and dies
 *  on a failure. */
function syncControl(ctx: RulesetCombatContext): void {
  const rules = new Map((ctx.combat.conditions ?? []).map((one) => [one.condition, one]));
  if (![...rules.values()].some((one) => one.controls || one.holderDies)) return;
  for (const one of ctx.state.combatants) {
    // Its host dead, its controller throws.
    if (one.defeated) {
      for (const entry of one.tracked) {
        const rule = rules.get(entry.condition);
        const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
        if (!rule?.holderDies || entry.holderDiedThrown || !source || source.defeated) continue;
        entry.holderDiedThrown = true;
        const ref = rule.holderDies.difficulty;
        const difficulty = source.sheet
          ? resolveRulesetValueRef(
              ctx.definition,
              source.sheet.build,
              ref,
              evaluateRulesetSheetLive(
                ctx.definition,
                source.sheet.build,
                source.sheet.live,
                source.sheet.items,
                source.abilityConditions,
              ),
            )
          : typeof ref === "number"
            ? ref
            : typeof ref === "object" && ref && "const" in ref && typeof ref.const === "number"
              ? ref.const
              : 10;
        const label =
          ctx.definition.sheet.live.conditions.find((known) => known.id === entry.condition)?.label ?? entry.condition;
        if (!rollSave(ctx, source, rule.holderDies.save, Math.round(difficulty))) slay(ctx, source, one.id, label);
      }
    }
    const holding = one.defeated
      ? undefined
      : one.tracked.find((entry) => {
          if (!rules.get(entry.condition)?.controls || !entry.source || entry.source === one.id) return false;
          const source = rulesetCombatant(ctx.state, entry.source);
          // Gone into them (1.696), it controls them from inside: a ghost's Possession.
          return !!source && (!source.defeated || source.away?.possessing === one.id);
        });
    const controller = holding ? rulesetCombatant(ctx.state, holding.source!) : undefined;
    if (controller && controller.side !== one.side) {
      one.ownSide ??= one.side;
      one.side = controller.side;
      ctx.events.push({ type: "controlled", targetId: one.id, sourceId: controller.id, active: true });
    } else if (!controller && one.ownSide !== undefined) {
      const sourceId = one.tracked.find((entry) => rules.get(entry.condition)?.controls)?.source ?? one.id;
      one.side = one.ownSide;
      delete one.ownSide;
      ctx.events.push({ type: "controlled", targetId: one.id, sourceId, active: false });
    }
  }
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
  /** This share of what it deals its maker regains (1.534): Drain Life's half. */
  drainsBack?: number;
  /** The weapon's floor, when it raised `amount` to it. */
  floor?: number;
  /** A resistance to it counts for nothing (1.192): a vorpal sword's slashing. */
  ignoresResistance?: true;
  /** What it takes off health comes back only with a rest (1.193): a sword of wounding's. */
  seals?: true;
  /** Not even with a rest, only something that unseals (1.203): a clay golem's Slam. */
  lasting?: true;
  /** Dealt by this condition, which keeps it off healing while it holds (1.750): Pale tincture. */
  keptBy?: string;
  /** Passed on by a condition (1.407, 1.409), so never passed on again. */
  passedOn?: true;
  /** Neither resistance nor immunity counts against it (1.415): Overchannel's necrotic. */
  unblockable?: true;
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
  // The condition that halved it, where its own hide did not (laptop playtest 2026-10-23: Uncanny
  // Dodge read as plain "Resisted").
  let resistedBy: string | undefined;
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
  } else if (type && !input.unblockable && target.block?.healedBy?.some((one) => one.trim().toLowerCase() === type)) {
    // A type that heals it instead (1.541): none taken, as much given back as the blow was.
    dealHeal(ctx, target, {
      ...(input.sourceId ? { sourceId: input.sourceId } : {}),
      rolls: input.rolls,
      flat: input.flat,
      amount: dealt,
      magical: true,
    });
    dealt = 0;
    adjust = "immune";
  } else {
    const resistant =
      !input.ignoresResistance &&
      !input.unblockable &&
      (!!(type && hide && matches(hide.resist, type, input.qualities)) ||
        rulesetCombatEffects(ctx.definition, ctx.combat, target, ctx.state).has("resist-all") ||
        // Fully under water (1.498): 5e's fire.
        (!!type &&
          !!ctx.combat.underwater?.resist?.some((one) => one.trim().toLowerCase() === type) &&
          rulesetUnderwater(ctx.definition, ctx.state, target)));
    const vulnerable = !!(type && hide && matches(hide.vulnerable, type));
    if (type && hide && !input.unblockable && matches(hide.immune, type, input.qualities)) {
      dealt = 0;
      adjust = "immune";
    } else if (resistant && !vulnerable) {
      dealt = Math.floor(dealt / 2);
      adjust = "resist";
      if (!(type && hide && matches(hide.resist, type, input.qualities)))
        resistedBy = rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).find((one) =>
          one.effects.includes("resist-all"),
        )?.condition;
    } else if (vulnerable && !resistant) {
      dealt *= 2;
      adjust = "vulnerable";
    }
    // Twice as much to an object from whoever deals double to them (1.560): Siege Monster.
    if (target.object && from?.block?.doubleToObjects) dealt *= 2;
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
  // Somebody it holds by a condition that takes a share of what it is dealt (1.407): a rug of
  // smothering's Damage Transfer, half of it onto whom it smothers.
  const sharer = dealt > 0 && !input.passedOn ? harmSharer(ctx, target) : undefined;
  const passed = sharer ? dealt - Math.floor(dealt * (1 - sharer.share)) : 0;
  dealt -= passed;
  const toTemp = Math.min(before.temp, dealt);
  if (dealt > 0 && target.shape?.health) {
    // A form with health of its own takes the blow (1.392); run out, the shape ends and the rest of
    // the blow carries on to their own.
    const form = target.shape.health;
    form.temp -= toTemp;
    const rest = dealt - toTemp;
    const over = Math.max(0, rest - form.value);
    form.value = Math.max(0, form.value - rest);
    if (form.value <= 0) {
      endShape(ctx, target, "damage");
      if (over > 0) {
        // Back in their own form, what is left past their own health (1.709).
        const own = healthOf(ctx, target);
        noteOverflow(ctx, target, over - own.temp - own.value);
        if (target.sheet) {
          if (!deferWound)
            writeHealthLoss(
              ctx,
              target,
              over,
              input.damageType,
              input.seals,
              input.lasting,
              input.pool?.kind,
              input.keptBy,
            );
        } else if (target.health) {
          const fromTemp = Math.min(target.health.temp, over);
          target.health.temp -= fromTemp;
          target.health.value = Math.max(0, target.health.value - (over - fromTemp));
        }
      }
    }
  } else if (dealt > 0) {
    noteOverflow(ctx, target, dealt - toTemp - before.value);
    if (target.sheet) {
      if (!deferWound)
        writeHealthLoss(
          ctx,
          target,
          dealt,
          input.damageType,
          input.seals,
          input.lasting,
          input.pool?.kind,
          input.keptBy,
        );
    } else if (target.health) {
      target.health.temp = before.temp - toTemp;
      const value = Math.max(0, before.value - (dealt - toTemp));
      // What only a rest gives back (1.193): the points it took off, not the buffer.
      if (input.seals || input.keptBy) {
        const sealed = Math.min(before.max, (target.health.sealed ?? 0) + (target.health.value - value));
        // Kept off healing by the condition that dealt it until it ends (1.750).
        const holding = input.keptBy ? target.tracked.find((one) => one.condition === input.keptBy) : undefined;
        if (holding) holding.keptDamage = (holding.keptDamage ?? 0) + sealed - (target.health.sealed ?? 0);
        target.health.sealed = sealed;
      }
      target.health.value = value;
    }
  }
  const after = healthOf(ctx, target);
  if (dealt > 0 && input.sourceId && input.sourceId !== target.id) target.harmedBy = input.sourceId;
  // Counted to whoever dealt it, against the other side only: what it is weighed by.
  const dealer = input.sourceId ? rulesetCombatant(ctx.state, input.sourceId) : undefined;
  const lost = before.value + before.temp - (after.value + after.temp);
  if (dealer && lost > 0 && dealer.side !== target.side)
    dealer.done = { ...dealer.done, dealt: (dealer.done?.dealt ?? 0) + lost };
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
    ...(resistedBy ? { resistedBy } : {}),
    ...(input.saved ? { saved: true } : {}),
    toTemp,
    health: after.value,
    maxHealth: after.max,
    ...(input.critical ? { critical: true } : {}),
    ...(input.pool ? { pool: input.pool } : {}),
    ...(input.floor !== undefined ? { floor: input.floor } : {}),
  });
  if (sharer && passed > 0) {
    const shared = applyDamage(ctx, sharer.holder, {
      ...(input.sourceId ? { sourceId: input.sourceId } : {}),
      label: sharer.label,
      ...(input.damageType ? { damageType: input.damageType } : {}),
      rolls: [],
      flat: passed,
      amount: passed,
      passedOn: true,
    });
    afterBlow(ctx, sharer.holder, shared, false);
  }
  // Whoever bonded to it takes the same (1.409): Warding Bond's caster.
  if (dealt > 0 && !input.passedOn) {
    for (const entry of [...target.tracked]) {
      const rule = ctx.combat.conditions?.find((one) => one.condition === entry.condition);
      const bonded = rule?.copiesHarmToSource && entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
      if (!bonded || bonded.id === target.id || bonded.defeated) continue;
      const copied = applyDamage(ctx, bonded, {
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        label: ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition,
        ...(input.damageType ? { damageType: input.damageType } : {}),
        rolls: [],
        flat: dealt,
        amount: dealt,
        passedOn: true,
      });
      afterBlow(ctx, bonded, copied, false);
    }
  }
  if (dealt > 0) {
    const kinds = ctx.blowTypes.get(target.id) ?? new Set<string>();
    kinds.add(type ?? "");
    ctx.blowTypes.set(target.id, kinds);
  }
  if (type) {
    const subjected = ctx.blowSubjected.get(target.id) ?? new Set<string>();
    subjected.add(type);
    ctx.blowSubjected.set(target.id, subjected);
  }
  ctx.harmEndings.push(endConditionsOnHarm(ctx, target, input.sourceId, dealt, false, damageSaves));
  // Harm its regeneration is stopped by (1.396): fire or acid on a troll, until its next turn starts.
  if (
    type &&
    dealt > 0 &&
    rulesetRegenerations(ctx.definition, ctx.combat, target, ctx.state).some((one) =>
      one.stoppedBy?.some((kind) => kind.trim().toLowerCase() === type),
    )
  )
    target.regenHeld = true;
  // Dealt from inside it (1.405), for what lets those it holds out on blows like it.
  if (dealt > 0 && from && from.insideOf === target.id) {
    const turn = `${ctx.state.round}:${ctx.state.turn}`;
    const hurt = target.insideHurt?.turn === turn ? target.insideHurt : { turn, by: {} };
    hurt.by[from.id] = (hurt.by[from.id] ?? 0) + dealt;
    target.insideHurt = hurt;
  }
  // A head lost to enough of it in one turn (1.550): a hydra's.
  if (dealt > 0) harmHeads(ctx, target, type, dealt, input.sourceId ?? target.id, input.label ?? target.name);
  return dealt;
}

/** A held weapon that dealt damage to a creature that corrodes weapons (1.551): another `step` off its
 *  damage for good, written back to its stack, and destroyed at `destroyedAt`, its blows gone with it.
 *  Ammunition it shot of the same stuff is destroyed instead of won back. */
function corrodeOnHit(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  const rule = target.block?.corrodesWeapons;
  const items = actor.sheet?.items;
  if (!rule || !items || !/^(?:item|offhand):/.test(action.id)) return;
  const index = rulesetActionItemIndex(action);
  const held = index === undefined ? undefined : items[index];
  if (index === undefined || !held || actor.broken?.[index]) return;
  const made = (tags: readonly string[] | undefined) =>
    rule.tags.some((tag) => tags?.includes(tag)) && !(rule.sparesMagical && tags?.includes("magical"));
  // The shot, when it was one (1.551): destroyed rather than won back.
  if (action.ammo && rule.ammunition && actor.lastShot !== undefined) {
    const shot = items[actor.lastShot];
    const back = actor.recoverable?.[actor.lastShot];
    if (shot && made(shot.item.tags) && back) {
      actor.recoverable![actor.lastShot] = Math.max(0, back - (action.ammo.recover ?? 0) * action.ammo.per);
      ctx.events.push({
        type: "corroded",
        actorId: actor.id,
        targetId: target.id,
        label: shot.name ?? action.label,
        penalty: 0,
        ammunition: true,
      });
    }
    return;
  }
  if (action.ammo || !made(held.item.tags)) return;
  const step = rule.step ?? 1;
  const was = actor.corroded?.[index] ?? held.corroded ?? 0;
  const penalty = was + step;
  (actor.corroded ??= {})[index] = penalty;
  const label = held.name ?? action.label;
  if (penalty >= (rule.destroyedAt ?? 5)) {
    (actor.itemsUsed ??= {})[index] = (actor.itemsUsed[index] ?? 0) + 1;
    (actor.broken ??= {})[index] = true;
    actor.actions = actor.actions.filter((one) => rulesetActionItemIndex(one) !== index);
    ctx.events.push({ type: "corroded", actorId: actor.id, targetId: target.id, label, penalty, destroyed: true });
    return;
  }
  for (const one of actor.actions) {
    if (rulesetActionItemIndex(one) !== index || !one.damage) continue;
    one.damage = {
      ...one.damage,
      flat: rulesetCombatIsPool(ctx.combat) ? Math.max(0, one.damage.flat - step) : one.damage.flat - step,
    };
  }
  ctx.events.push({ type: "corroded", actorId: actor.id, targetId: target.id, label, penalty });
}

/** A hydra's heads as damage reaches it (1.550): what stops them growing is remembered until its
 *  turn ends, and the turn's damage reaching `lostAt` kills one, once a turn. With none left it dies,
 *  and with one left it holds what many heads give it no more. */
function harmHeads(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  type: string | undefined,
  dealt: number,
  sourceId: string,
  label: string,
): void {
  const rule = target.block?.heads;
  if (!rule || target.defeated) return;
  const heads = (target.heads ??= { count: rule.count });
  if (type && rule.growthStoppedBy?.some((kind) => kind.trim().toLowerCase() === type)) heads.burned = true;
  const turn = turnStamp(ctx);
  const before = heads.hurt?.turn === turn ? heads.hurt.dealt : 0;
  heads.hurt = { turn, dealt: before + dealt };
  if (before >= rule.lostAt || before + dealt < rule.lostAt || heads.count <= 0) return;
  heads.count -= 1;
  heads.lost = (heads.lost ?? 0) + 1;
  if (heads.spare !== undefined) heads.spare = Math.min(heads.spare, Math.max(0, heads.count - 1));
  ctx.events.push({ type: "headLost", actorId: target.id, left: heads.count });
  if (heads.count === 1) for (const id of rule.whileMany ?? []) removeCondition(ctx, target, id, "spent");
  if (heads.count <= 0) slay(ctx, target, sourceId, label);
}

/** Heads grown back as a hydra's turn ends (1.550): `grows` for each that died since its last turn,
 *  up to its most, with `healsPerHead` for each, unless what stops them reached it since then. */
function regrowHeads(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const rule = actor.block?.heads;
  const heads = actor.heads;
  if (!rule || !heads) return;
  const lost = heads.lost ?? 0;
  const burned = heads.burned;
  delete heads.lost;
  delete heads.burned;
  if (lost === 0 || actor.defeated || heads.count <= 0) return;
  if (burned) {
    ctx.events.push({ type: "headsGrow", actorId: actor.id, grown: 0, heads: heads.count, burned: true });
    return;
  }
  const was = heads.count;
  const grown = Math.max(0, Math.min(lost * (rule.grows ?? 2), (rule.max ?? Infinity) - was));
  if (grown === 0) return;
  heads.count += grown;
  ctx.events.push({ type: "headsGrow", actorId: actor.id, grown, heads: heads.count });
  if (was <= 1 && heads.count > 1) {
    for (const condition of rule.whileMany ?? []) {
      if (!actor.tracked.some((entry) => entry.condition === condition))
        actor.tracked.push({ condition, rounds: null });
    }
  }
  if (rule.healsPerHead) {
    const amount = grown * rule.healsPerHead;
    dealHeal(ctx, actor, { sourceId: actor.id, rolls: [], flat: amount, amount });
  }
}

/** Whom `target` holds by a condition that takes a share of its harm (1.407), and that share. */
function harmSharer(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
): { holder: RulesetCombatant; share: number; label: string } | undefined {
  for (const one of ctx.state.combatants) {
    if (one.id === target.id || one.defeated) continue;
    for (const entry of one.tracked) {
      if (entry.source !== target.id) continue;
      const share = ctx.combat.conditions?.find((rule) => rule.condition === entry.condition)?.takesSourceHarm?.share;
      if (share === undefined) continue;
      const label =
        ctx.definition.sheet.live.conditions.find((c) => c.id === entry.condition)?.label ?? entry.condition;
      return { holder: one, share, label };
    }
  }
  return undefined;
}

/** Damage past a target's own health in the blow being dealt (1.709), summed over its amounts. */
function noteOverflow(ctx: RulesetCombatContext, target: RulesetCombatant, past: number): void {
  if (past <= 0) return;
  ctx.blowOverflow.set(target.id, (ctx.blowOverflow.get(target.id) ?? 0) + past);
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
  const kinds = ctx.blowTypes.get(target.id) ?? new Set<string>();
  ctx.blowTypes.delete(target.id);
  const subjected = ctx.blowSubjected.get(target.id) ?? new Set<string>();
  ctx.blowSubjected.delete(target.id);
  const overflow = ctx.blowOverflow.get(target.id) ?? 0;
  ctx.blowOverflow.delete(target.id);
  if (dealt <= 0) {
    // Split by what it shrugged off (1.475): an ooze immune to the lightning it splits on.
    splitOnHarm(ctx, target, subjected);
    return;
  }
  const wasDown = !!target.down;
  endConditionsOnDamage(ctx, target);
  stopConditionsOnDamage(ctx, target);
  const after = healthOf(ctx, target);
  const out = after.value <= 0 || overwhelmed || wasDown;
  // A blow that leaves somebody standing tests their concentration. One that takes them out does
  // not: going down ends it outright (`dropToZero`), so nothing is rolled for it.
  if (!out) concentrationFromDamage(ctx, target, dealt);
  // Split in two by what harmed it (1.475): a Black Pudding.
  if (!out) splitOnHarm(ctx, target, new Set([...kinds, ...subjected]));
  // What the harm puts on it (1.542): a flesh golem's Aversion of Fire.
  if (!out) harmedInto(ctx, target, kinds);
  // Massive damage (1.709): what is left past 0 at least their most kills one who would lie dying,
  // and so does as much taken while down.
  const massive =
    ctx.combat.dying?.instantDeath === "overflow-at-least-max" &&
    !rulesetDiesAtZero(target) &&
    !target.object &&
    overflow > 0 &&
    overflow >= after.max;
  if (out) {
    if (!wasDown) dropToZero(ctx, target, false, { dealt, critical, kinds, ...(massive ? { massive } : {}) });
    else if (massive && target.dying && !target.defeated) killedOutright(ctx, target);
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
  // What was stored to go off as they are harmed, or go down (1.569): Contingency.
  castStoredOn(ctx, target, "harmed");
  if (out && !wasDown && !target.defeated) castStoredOn(ctx, target, "down");
}

/** The first entry stored in `holder`, or in an item they wear, to be cast by itself at this moment
 *  (1.569), cast for nothing: at them, or at whoever harmed them. Contingency. */
function castStoredOn(ctx: RulesetCombatContext, holder: RulesetCombatant, moment: "harmed" | "down"): void {
  if (holder.defeated || ctx.releasing?.has(holder.id)) return;
  const stores = (action: RulesetCombatAction) => {
    const item = action.storedIn?.item;
    return item !== undefined ? holder.sheet?.items?.[item]?.item.stores : holder.block?.stores;
  };
  const stored = holder.actions.find(
    (action) =>
      action.storedIn &&
      (holder.uses[action.id] ?? 0) > 0 &&
      stores(action)?.castsOn?.on === moment &&
      // From an item only while it is worn.
      (action.storedIn.item === undefined || !!holder.sheet?.items?.[action.storedIn.item]?.worn),
  );
  if (!stored) return;
  const sourceId = ctx.acting?.actorId;
  const source = sourceId !== undefined ? rulesetCombatant(ctx.state, sourceId) : undefined;
  const at = stores(stored)!.castsOn!.at === "source" ? source : holder;
  if (!at || at.defeated) return;
  holder.uses[stored.id] = 0;
  ctx.events.push({ type: "storedCast", actorId: holder.id, label: stored.label, targetId: at.id });
  (ctx.releasing ??= new Set()).add(holder.id);
  try {
    resolveActionBody(ctx, holder, stored, [at]);
  } finally {
    ctx.releasing.delete(holder.id);
  }
}

/** What a condition on whoever was hit does to who hit them, nobody choosing (1.489): Holy Aura's
 *  flash, blinding a fiend or undead that hits its holder in melee unless it saves. What it puts on
 *  is held as the condition is, by the same concentration. With `touched` (1.527), it answers one who
 *  only touched them, by a grapple or a shove, where it says it `touches`: Heated Body. */
function answerHit(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  attacker: RulesetCombatant,
  action: RulesetCombatAction,
  touched = false,
): void {
  if (!ctx.combat.conditions?.some((entry) => entry.whenHit)) return;
  if (attacker.defeated || attacker.id === target.id) return;
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state)) {
    const rule = entry.whenHit;
    if (!rule || attacker.defeated || (touched && !rule.touches)) continue;
    if (!touched && rule.blow && rulesetBlowKind(ctx.state, attacker, target, action) !== rule.blow) continue;
    if (rule.from && !rulesetTargetIs(ctx.definition, attacker, rule.from)) continue;
    // Only a hitter this near (1.508), off a board everybody is.
    const perCell = ctx.definition.combat?.distance?.perCell;
    if (
      rule.within !== undefined &&
      perCell !== undefined &&
      rulesetPositionOf(attacker) &&
      rulesetPositionOf(target) &&
      rulesetGap(attacker, target) > rulesetInCells(rule.within, perCell)
    )
      continue;
    const own = target.tracked.find((one) => one.condition === entry.condition);
    // What it deals the hitter, no save, once the blow is over (1.508): Fire Shield.
    const harm = rule.harms;
    if (harm) {
      const label =
        ctx.definition.sheet.live.conditions.find((live) => live.id === entry.condition)?.label ?? entry.condition;
      ctx.harmEndings.push(() => {
        if (attacker.defeated) return;
        const dice = harm.dice ? parseRulesetCombatDice(harm.dice) : null;
        const rolls = dice ? rollRulesetDice(ctx.roll, dice.count, dice.sides) : [];
        const flat = (dice?.flat ?? 0) + (harm.flat ?? 0);
        const dealt = applyDamage(ctx, attacker, {
          sourceId: target.id,
          label,
          ...(harm.damageType ? { damageType: harm.damageType } : {}),
          rolls,
          flat,
          amount: sumOf(rolls) + flat,
        });
        afterBlow(ctx, attacker, dealt, false);
      });
    }
    if (!rule.applies) continue;
    // Spread by another's aura (1.491): what put the aura's own condition on its holder.
    const held = own?.aura && !own.action ? (auraOrigin(ctx, own) ?? own) : own;
    const source = held?.source ? rulesetCombatant(ctx.state, held.source) : undefined;
    const by = held?.action ? source?.actions.find((one) => one.id === held.action![0]) : undefined;
    const difficulty = rule.save?.difficulty ?? by?.save?.difficulty ?? by?.saveDifficulty ?? 10;
    const sourceId = source?.id ?? target.id;
    if (rule.save && rollSave(ctx, attacker, rule.save.save, difficulty, sourceId)) continue;
    for (const applies of rule.applies) {
      applyConditionId(ctx, attacker, applies.condition, applies, {
        sourceId,
        difficulty,
        ...(held?.action ? { action: held.action } : {}),
        ...(held?.concentration ? { concentration: true } : {}),
        ...(held?.catalog ? { catalog: held.catalog } : {}),
      });
    }
  }
}

/** What a mover's `entering` does to each creature whose space it now fills (1.504), the first time
 *  in a turn: Fire Form's burn and its flames. */
function entersSpaces(ctx: RulesetCombatContext, mover: RulesetCombatant): void {
  if (!ctx.combat.conditions?.some((entry) => entry.entering)) return;
  const rules = rulesetActiveConditions(ctx.definition, ctx.combat, mover, ctx.state).flatMap((entry) =>
    entry.entering ? [{ entry, rule: entry.entering }] : [],
  );
  if (!rules.length) return;
  const turn = `${ctx.state.round}:${ctx.state.turn}`;
  if (mover.entered?.at !== turn) mover.entered = { at: turn, ids: [] };
  const covered = new Set(rulesetFootprint(mover).map((cell) => `${cell.x},${cell.y}`));
  for (const one of ctx.state.combatants) {
    if (one.id === mover.id || one.defeated || one.insideOf || one.mountedOn || !rulesetPositionOf(one)) continue;
    if (mover.entered.ids.includes(one.id)) continue;
    if (!rulesetFootprint(one).some((cell) => covered.has(`${cell.x},${cell.y}`))) continue;
    mover.entered.ids.push(one.id);
    for (const { entry, rule } of rules) {
      const own = mover.tracked.find((tracked) => tracked.condition === entry.condition);
      const harm = rule.harm ? parseRulesetCombatDice(rule.harm.dice ?? "") : null;
      if (rule.harm && (harm || rule.harm.flat !== undefined)) {
        const rolls = harm ? rollRulesetDice(ctx.roll, harm.count, harm.sides) : [];
        const flat = (harm?.flat ?? 0) + (rule.harm.flat ?? 0);
        const dealt = applyDamage(ctx, one, {
          sourceId: mover.id,
          label:
            ctx.definition.sheet.live.conditions.find((live) => live.id === entry.condition)?.label ?? entry.condition,
          ...(rule.harm.damageType ? { damageType: rule.harm.damageType } : {}),
          rolls,
          flat,
          amount: sumOf(rolls) + flat,
        });
        afterBlow(ctx, one, dealt, false);
      }
      for (const applies of rule.applies ?? []) {
        if (one.defeated) break;
        applyConditionId(ctx, one, applies.condition, applies, {
          sourceId: mover.id,
          ...(own?.concentration ? { concentration: true } : {}),
        });
      }
    }
  }
}

/** What the attacker's own conditions put on whoever their hit landed on (1.503): Branding Smite. */
function ownHit(
  ctx: RulesetCombatContext,
  attacker: RulesetCombatant,
  target: RulesetCombatant,
  action: RulesetCombatAction,
): void {
  if (!ctx.combat.conditions?.some((entry) => entry.onHit) || attacker.id === target.id) return;
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, attacker, ctx.state)) {
    const rule = entry.onHit;
    if (!rule || target.defeated) continue;
    if (rule.weapon && !rulesetWeaponBlow(action)) continue;
    if (rule.blow && rulesetBlowKind(ctx.state, attacker, target, action) !== rule.blow) continue;
    // Only a blow of these damage types (1.683): a poison on a slashing or piercing weapon.
    const blowType = action.damage?.type?.trim().toLowerCase();
    if (rule.damageTypes && !rule.damageTypes.some((type) => type.trim().toLowerCase() === blowType)) continue;
    const own = attacker.tracked.find((one) => one.condition === entry.condition);
    // Its save first (1.683): a poison's Constitution save.
    const saved = rule.save ? rollSave(ctx, target, rule.save.save, rule.save.difficulty, attacker.id) : false;
    const thrown = rule.save
      ? [...ctx.events].reverse().find((event) => event.type === "save" && event.actorId === target.id)
      : undefined;
    if (rule.damage && !(saved && rule.save?.onSuccess === "negates")) {
      const dice = rule.damage.dice ? parseRulesetCombatDice(rule.damage.dice) : null;
      const rolls = dice ? rollRulesetDice(ctx.roll, dice.count, dice.sides) : [];
      const flat = (dice?.flat ?? 0) + (rule.damage.flat ?? 0);
      const whole = sumOf(rolls) + flat;
      const dealt = applyDamage(ctx, target, {
        sourceId: attacker.id,
        label:
          ctx.definition.sheet.live.conditions.find((live) => live.id === entry.condition)?.label ?? entry.condition,
        ...(rule.damage.type ? { damageType: rule.damage.type } : {}),
        rolls,
        flat,
        amount: saved ? Math.floor(whole / 2) : whole,
      });
      afterBlow(ctx, target, dealt, false);
    }
    if (saved || target.defeated) continue;
    // Failed badly (1.683): drow poison's unconsciousness on a failure by 5.
    const worse =
      rule.failedBy &&
      thrown?.type === "save" &&
      !thrown.automatic &&
      thrown.difficulty - thrown.total >= rule.failedBy.atLeast
        ? rule.failedBy.applies
        : [];
    for (const applies of [...(rule.applies ?? []), ...worse]) {
      applyConditionId(ctx, target, applies.condition, applies, {
        sourceId: attacker.id,
        ...(rule.save ? { difficulty: rule.save.difficulty } : {}),
        ...(own?.concentration ? { concentration: true } : {}),
        ...(own?.catalog ? { catalog: own.catalog } : {}),
      });
    }
  }
}

/** The condition an aura spread this from (1.491), as its holder holds it: whose it is, the entry
 *  that put it on, and the concentration holding it. Holy Aura's ward, given to each nearby ally. */
function auraOrigin(ctx: RulesetCombatContext, spread: RulesetTrackedCondition): RulesetTrackedCondition | undefined {
  const holder = spread.aura ? rulesetCombatant(ctx.state, spread.aura) : undefined;
  if (!holder) return undefined;
  const rules = (ctx.combat.conditions ?? []).filter((rule) =>
    rule.auras?.some((aura) => aura.conditions?.includes(spread.condition)),
  );
  return holder.tracked.find((one) => !one.aura && rules.some((rule) => rule.condition === one.condition));
}

/** What an action puts on its own user as it is made (1.307), whatever its targets do. */
function applySelf(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  payWith: string | undefined,
  steps: number,
): void {
  // Saved against, with its own save at its own difficulty (1.693): Dust of Sneezing's thrower.
  if (action.appliesSelfSaves && action.save && action.appliesSelf?.length) {
    const save = action.save;
    const against: RulesetSaveAgainst = {
      conditions: [...action.appliesSelf.map((one) => one.condition), ...(save.against?.conditions ?? [])],
      magic: magicalAction(action),
      ...(save.against?.qualities ? { qualities: save.against.qualities } : {}),
      action: [action.id, action.label],
    };
    if (
      savesOutright(ctx, actor, save) ||
      rollSave(ctx, actor, save.save, save.difficulty, undefined, null, against, saveLean(ctx, actor, save.modes))
    )
      return;
  }
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

/** What a creature puts on itself when a blow of one of its types deals it anything (1.542). */
function harmedInto(ctx: RulesetCombatContext, target: RulesetCombatant, kinds: ReadonlySet<string>): void {
  for (const rule of target.block?.whenHarmedBy ?? []) {
    if (!rule.by.some((kind) => kinds.has(kind.trim().toLowerCase()))) continue;
    for (const applies of rule.applies)
      applyConditionId(ctx, target, applies.condition, applies, { sourceId: target.id });
  }
}

/** A creature split in two by the harm a blow dealt it (1.475): a second of it beside it, each with
 *  half the health it had, rounded down, and each one size smaller when the fight has sizes. */
function splitOnHarm(ctx: RulesetCombatContext, target: RulesetCombatant, kinds: ReadonlySet<string>): void {
  const splits = target.block?.splits;
  if (!splits || target.defeated || target.down || target.object) return;
  if (!splits.by.some((kind) => kinds.has(kind.trim().toLowerCase()))) return;
  if ("track" in ctx.combat.health) return;
  const health = healthOf(ctx, target);
  if (health.value < splits.atLeast) return;
  if (ctx.state.combatants.length >= RULESET_CALLED_FIGHT_MAX) return;
  // One size smaller, and never below its smallest.
  const order = ctx.combat.sizes?.order;
  const rank = rulesetSizeRank(ctx.combat, target);
  let smaller: string | undefined;
  if (order && rank !== undefined) {
    const floor = splits.smallest ? order.findIndex((size) => size.id === splits.smallest) : 0;
    if (rank < Math.max(0, floor)) return;
    smaller = order[Math.max(0, rank - 1)]!.id;
  }
  const half = Math.floor(health.value / 2);
  const setHealth = (one: RulesetCombatant) => {
    if (one.sheet) {
      const now = healthOf(ctx, one);
      if (now.value > half) writeHealthLoss(ctx, one, now.value - half, undefined);
    } else if (one.health) one.health.value = Math.min(one.health.value, half);
  };
  setHealth(target);
  const resize = (one: RulesetCombatant) => {
    if (!smaller || !order) return;
    one.size = smaller;
    if (one.baseSize !== undefined) one.baseSize = smaller;
    const cells = order.find((size) => size.id === smaller)?.cells ?? 1;
    if (cells > 1) one.span = cells;
    else delete one.span;
  };
  resize(target);
  // Its twin: the same creature, fresh of what was on it.
  let n = 1;
  while (ctx.state.combatants.some((one) => one.id === `${target.id}-split-${n}`)) n += 1;
  const twin = structuredClone(target);
  twin.id = `${target.id}-split-${n}`;
  twin.name = `${target.name} ${n + 1}`;
  twin.tracked = [];
  twin.flags = {};
  twin.concentrating = null;
  delete twin.zones;
  delete twin.summons;
  const grid = ctx.state.board?.grid;
  const at = rulesetPositionOf(target);
  if (grid && at) {
    const taken = new Set(
      ctx.state.combatants
        .filter((one) => !one.defeated || one.object)
        .flatMap((one) => rulesetFootprint(one))
        .map((cell) => `${cell.x},${cell.y}`),
    );
    const cell = rulesetFitCell(grid, at, rulesetSpanOf(twin), taken);
    if (!cell) return;
    twin.x = cell.x;
    twin.y = cell.y;
  }
  ctx.state.combatants.push(twin);
  // Its turn straight after the one it split from.
  const order2 = ctx.state.order;
  const place = order2.indexOf(target.id) + 1;
  order2.splice(place > 0 ? place : order2.length, 0, twin.id);
  if (place > 0 && place <= ctx.state.turn) ctx.state.turn += 1;
  if (ctx.state.interjected !== undefined && place > 0 && place <= ctx.state.interjected) ctx.state.interjected += 1;
  ctx.events.push({ type: "split", actorId: target.id, ids: [twin.id], health: half });
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
  /** Kept off healing by this condition while it holds (1.750). */
  keptBy?: string,
): void {
  const health = ctx.combat.health;
  if (!("track" in health)) {
    writeRulesetSheet(ctx.definition, target, {
      op: "damage",
      pool: health.pool,
      amount: dealt,
      ...(seals ? { seals } : {}),
      ...(seals && lasting ? { lasting } : {}),
      ...(keptBy ? { keptBy } : {}),
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

/** Whether healing this combatant gets is at its most (1.500): Beacon of Hope. */
function healedMax(ctx: RulesetCombatContext, target: RulesetCombatant): boolean {
  return rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) => entry.healedMax);
}

/** Healing rolled for somebody, at its most where they are healed at it (1.500). */
function rollHealing(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
): { rolls: number[]; flat: number; total: number } {
  return healedMax(ctx, target) ? maxAmount(amount, extra) : rollAmount(ctx, amount, extra);
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
    // A form's own health first (1.392).
    if (target.shape?.health) {
      target.shape.health.value = Math.min(target.shape.health.max, target.shape.health.value + amount);
    }
    // Never past the maximum as it stands, which a level may have halved (1.115).
    else if (target.sheet) writeHealthGain(ctx, target, amount, before);
    // Never past what only a rest gives back (1.193).
    else if (target.health) {
      const cap = Math.max(before.value, before.max - (target.health.sealed ?? 0));
      target.health.value = Math.min(cap, before.value + amount);
    }
  }
  const after = healthOf(ctx, target);
  const healer = input.sourceId ? rulesetCombatant(ctx.state, input.sourceId) : undefined;
  if (healer && after.value > before.value && healer.side === target.side)
    healer.done = { ...healer.done, healed: (healer.done?.healed ?? 0) + after.value - before.value };
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
  // Health regained, from anything or from magic, ends what lasts only until then (1.684): caltrops'
  // slowed walk, an Infernal Wound.
  if (after.value > before.value) {
    for (const condition of rulesetCombatConditions(ctx.definition, target)) {
      const endsWhen = ctx.combat.conditions?.find((one) => one.condition === condition)?.endsWhen;
      if (endsWhen?.includes("healed") || (input.magical && endsWhen?.includes("healed-by-magic")))
        removeCondition(ctx, target, condition, "recovered");
    }
  }
  // Back at full health, what lasts only until then ends (1.543): Berserk.
  if (amount > 0 && after.value >= after.max) {
    for (const condition of rulesetCombatConditions(ctx.definition, target)) {
      if (ctx.combat.conditions?.find((one) => one.condition === condition)?.endsAtFullHealth)
        removeCondition(ctx, target, condition, "recovered");
    }
  }
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
    const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live, target.sheet.items);
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
    const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live, target.sheet.items);
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
  const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live, target.sheet.items);
  return live.pools.find((entry) => !entry.listId && entry.key === health.pool)?.sealed ?? 0;
}

/** Whether what only a rest or an unsealing gives back has taken the whole maximum (1.203). */
function rulesetSealedAway(ctx: RulesetCombatContext, target: RulesetCombatant): boolean {
  if (!target.sheet) return !!target.health && (target.health.sealed ?? 0) >= target.health.max;
  const health = ctx.combat.health;
  if ("track" in health) return false;
  const live = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live, target.sheet.items);
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
  const pools = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live, target.sheet.items).pools;
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

/** Out of the fight at 0 rather than dying (1.394): an opponent, or a creature fighting beside the
 *  party with no sheet of its own, a summoned wolf. */
function rulesetDiesAtZero(target: RulesetCombatant): boolean {
  return target.side === "enemy" || !target.sheet;
}

/** The blow that took them to 0 (1.400): what it dealt, whether it was a critical hit, and the kinds
 *  of harm in it. */
interface RulesetDroppingBlow {
  dealt: number;
  critical: boolean;
  kinds: Set<string>;
  /** Past 0 by at least their most (1.709): only a ward against being slain outright holds. */
  massive?: true;
}

/** A pool on a combatant's own sheet, or undefined with no sheet or no such pool. */
function sheetPool(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  key: string,
): { key: string; value: number; max: number } | undefined {
  if (!target.sheet) return undefined;
  const pools = readRulesetLive(ctx.definition, target.sheet.build, target.sheet.live, target.sheet.items).pools;
  // A declared pool by id, or a list row's by its name (1.404): the half-orc's Relentless Endurance.
  const wanted = key.trim().toLowerCase();
  return (
    pools.find((entry) => !entry.listId && entry.key === key) ??
    pools.find((entry) => entry.listId && entry.label.trim().toLowerCase() === wanted)
  );
}

/** Whether one way of hanging on at 1 works against this blow (1.320, 1.400), paying for it if it
 *  does: its use this fight, its sheet pool, or the save its holder makes. */
function hangsOnNow(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  from: string | null,
  hangs: RulesetHangsOn,
  blow: RulesetDroppingBlow | undefined,
): { left?: number } | null {
  // Terms read off the blow need one: dropped outright by something that is not damage, they do not apply.
  const terms = hangs.save || hangs.notFrom || hangs.notCritical || hangs.dealtAtMost !== undefined;
  if (terms && !blow) return null;
  if (blow && hangs.notCritical && blow.critical) return null;
  if (blow && hangs.notFrom?.some((kind) => blow.kinds.has(kind.trim().toLowerCase()))) return null;
  if (blow && hangs.dealtAtMost !== undefined && blow.dealt > hangs.dealtAtMost) return null;
  // Only while its holder holds one of these (1.404): Relentless Rage, while raging.
  if (
    hangs.whileHolding &&
    !rulesetCombatConditions(ctx.definition, target).some((one) => hangs.whileHolding!.includes(one))
  )
    return null;
  const used = from === null ? (target.hungOn ?? 0) : (target.hungOnBy?.[from] ?? 0);
  if (hangs.uses !== undefined && used >= hangs.uses) return null;
  const spends = hangs.spends !== undefined ? sheetPool(ctx, target, hangs.spends) : undefined;
  if (hangs.spends !== undefined && (spends?.value ?? 0) < 1) return null;
  if (hangs.save) {
    // Times it has worked before: this fight's count, or what has been spent off the tally since a
    // rest last filled it.
    const tally = hangs.save.tally !== undefined ? sheetPool(ctx, target, hangs.save.tally) : undefined;
    const before = tally ? Math.max(0, tally.max - tally.value) : used;
    const difficulty =
      hangs.save.difficulty + (hangs.save.plusDamage ? (blow?.dealt ?? 0) : 0) + (hangs.save.raisedBy ?? 0) * before;
    if (!rollSave(ctx, target, hangs.save.save, difficulty)) return null;
    if (tally && tally.value > 0)
      writeRulesetSheet(ctx.definition, target, { op: "spend", pool: tally.key, amount: 1 });
  }
  if (spends) writeRulesetSheet(ctx.definition, target, { op: "spend", pool: spends.key, amount: 1 });
  if (from === null) target.hungOn = used + 1;
  else target.hungOnBy = { ...target.hungOnBy, [from]: used + 1 };
  return hangs.uses !== undefined ? { left: hangs.uses - used - 1 } : {};
}

/** It takes one of its own action's forms (1.548), as the action would put it on: a vampire's
 *  Misty Escape. Nothing when it has no such action or form now. */
function becomeForm(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  becomes: { action: string; form: string },
): void {
  const action = target.actions.find((one) => one.id === becomes.action);
  const mode = action?.modes?.find(
    (one) => one.form && `${one.form.creature.catalogId}/${one.form.creature.entryId}` === becomes.form,
  );
  const applies = action?.applies?.find(
    (one) => ctx.combat.conditions?.find((rule) => rule.condition === one.condition)?.shape,
  );
  if (!mode?.form || !applies) return;
  applyConditionId(ctx, target, applies.condition, { ...applies, form: mode.form }, { sourceId: target.id });
}

/** Whether a way of hanging on spares its holder what would slay them outright without dealing
 *  damage (1.596), paying for it as hanging on at 1 does: Death Ward against Power Word Kill. */
function wardedOutright(ctx: RulesetCombatContext, target: RulesetCombatant): boolean {
  if (target.defeated) return false;
  for (const { from, hangs } of rulesetHangsOn(ctx.definition, ctx.combat, target, ctx.state)) {
    if (!hangs.outright) continue;
    const held = hangsOnNow(ctx, target, from, hangs, undefined);
    if (!held) continue;
    ctx.events.push({
      type: "hangsOn",
      actorId: target.id,
      outright: true,
      ...(hangs.label ? { label: hangs.label } : {}),
      ...(held.left !== undefined ? { left: held.left } : {}),
    });
    if (hangs.ends && from !== null) removeCondition(ctx, target, from, "spent");
    return true;
  }
  return false;
}

function dropToZero(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  slain = false,
  blow?: RulesetDroppingBlow,
): void {
  // Hanging on at 1 instead (1.320): the Miller's Hourglass, once, with a turn of its own straight
  // after this one. From 1.400 on a save and the blow's own terms too, from a sheet's conditions and
  // levels as well as a block: Undead Fortitude, Relentless, Relentless Endurance, Relentless Rage.
  // A creature that fights with a sheet hangs on in its hit point pool; a wound track has no 1 to hang
  // on at.
  const health = ctx.combat.health;
  const pool = target.sheet && !target.health && !("track" in health) ? health.pool : undefined;
  if (!slain && (target.health || pool)) {
    for (const { from, hangs } of rulesetHangsOn(ctx.definition, ctx.combat, target, ctx.state)) {
      // Massive damage slays outright (1.709): Death Ward holds, Relentless Endurance does not.
      if (blow?.massive && !hangs.outright) continue;
      const held = hangsOnNow(ctx, target, from, hangs, blow);
      if (!held) continue;
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
        ...(held.left !== undefined ? { left: held.left } : {}),
      });
      // Into one of its own forms as it hangs on (1.548): Misty Escape.
      if (hangs.becomes) becomeForm(ctx, target, hangs.becomes);
      // Worked, its condition is over (1.596): Death Ward.
      if (hangs.ends && from !== null) removeCondition(ctx, target, from, "spent");
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
  }
  if (blow?.massive && !slain) {
    killedOutright(ctx, target);
    return;
  }
  // Down, they are themselves again (1.392): a shapechanger dies in its true form.
  if (target.shape) endShape(ctx, target, "damage");
  // Down but not out while it may regenerate (1.396): a troll lies there until its turn starts.
  if (
    !slain &&
    !ctx.state.heldGround &&
    rulesetDiesAtZero(target) &&
    rulesetRegenerations(ctx.definition, ctx.combat, target, ctx.state).some((one) => one.keepsUp)
  ) {
    target.down = true;
    target.regrowing = true;
    endConcentration(ctx, target, "down");
    ctx.events.push({ type: "down", actorId: target.id, dying: false });
    return;
  }
  // A prop is nobody (1.316): nothing feeds on it falling.
  if (!target.object) {
    feedAuras(ctx, target);
    fellsGrant(ctx, target);
    rampage(ctx, target);
  }
  target.down = true;
  // Knocked out instead (1.720): a melee blow its maker pulled.
  if (!slain && knocksOutNow(ctx, target)) {
    knockOut(ctx, target);
    return;
  }
  // Held Ground (1.323): felled, out of the fight but never dying, unless the blow reaps.
  const held = ctx.state.heldGround;
  if (held && !target.object) {
    fell(ctx, target, held);
    return;
  }
  // Defeated before its concentration ends, so what a spell it held leaves behind as it ends (Haste's
  // lethargy) is not put on somebody already out of the fight.
  if (rulesetDiesAtZero(target)) {
    target.defeated = true;
    target.diedRound = ctx.state.round;
    endSummons(ctx, target);
    endZones(ctx, target);
    unconjureAll(ctx, target);
  }
  endConcentration(ctx, target, "down");
  endConditionsFromSource(ctx, target);
  if (rulesetDiesAtZero(target)) {
    ctx.events.push({ type: "defeated", actorId: target.id });
    letGoOfTheFallen(ctx, target);
    dies(ctx, target);
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
/** A foe dropped by whoever harmed them last gives that one temporary points (1.412): Dark One's
 *  Blessing. Points never stack, so the bigger buffer stands. */
function fellsGrant(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const feller = target.harmedBy ? rulesetCombatant(ctx.state, target.harmedBy) : undefined;
  if (!feller || feller.side === target.side || !rulesetCombatStanding(feller)) return;
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, feller, ctx.state)) {
    const ref = entry.fellsGrant?.temporary;
    if (!ref) continue;
    const amount = feller.sheet
      ? resolveRulesetValueRef(
          ctx.definition,
          feller.sheet.build,
          ref,
          evaluateRulesetSheetLive(
            ctx.definition,
            feller.sheet.build,
            feller.sheet.live,
            feller.sheet.items,
            feller.abilityConditions,
          ),
        )
      : (ref.const ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    grantTemporary(ctx, feller, { sourceId: feller.id, rolls: [], flat: amount, amount });
  }
}

/** A creature that drops one to 0 with a melee attack on its own turn rampages on (1.545): its
 *  budget spent, part of its speed to move and its action free once more. A gnoll's Rampage. */
function rampage(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const acting = ctx.acting;
  const feller = acting ? rulesetCombatant(ctx.state, acting.actorId) : undefined;
  const rule = feller?.block?.rampage;
  if (!acting || !feller || !rule || feller.id === target.id || !rulesetCombatStanding(feller)) return;
  if (!rulesetOnOwnTurn(ctx.state, feller) || !rulesetIsAttack(acting.action)) return;
  if (rulesetBlowKind(ctx.state, feller, target, acting.action) !== "melee") return;
  const action = feller.actions.find((one) => one.id === rule.action);
  if (!action || (feller.budgets[rule.budget] ?? 0) < 1) return;
  spendBudget(ctx, feller, rule.budget);
  const allowance = rulesetMovementAllowance(ctx.definition, ctx.combat, feller, ctx.state, undefined, true);
  const cells = Math.floor(allowance * (rule.move ?? 0.5));
  feller.movementLeft = (feller.movementLeft ?? 0) + cells;
  feller.flags.followUps = [...(feller.flags.followUps ?? []).filter((one) => one.id !== action.id), { id: action.id }];
  ctx.events.push({ type: "rampage", actorId: feller.id, label: action.label, cells });
}

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
  if (rulesetDiesAtZero(target)) {
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
  const down = rulesetDiesAtZero(target) ? undefined : ctx.combat.dying?.condition;
  for (const condition of new Set([down, target.reaped ? undefined : held.condition])) {
    if (condition) applyConditionId(ctx, target, condition, { condition, duration: "instant" });
  }
  if (target.reaped) return;
  for (const mark of held.marks ?? []) moveTrack(ctx, target, target, mark.track, mark.by);
}

/** Whether the action being resolved knocks `target` out rather than dropping them (1.720): a melee
 *  attack by somebody pulling their blows, where the ruleset allows it. */
function knocksOutNow(ctx: RulesetCombatContext, target: RulesetCombatant): boolean {
  const acting = ctx.acting;
  if (!ctx.combat.dying?.knockOut || !acting || target.object) return false;
  const feller = rulesetCombatant(ctx.state, acting.actorId);
  if (!feller?.knocksOut || feller.id === target.id || !rulesetIsAttack(acting.action)) return false;
  return rulesetBlowKind(ctx.state, feller, target, acting.action) === "melee";
}

/** Knocked out (1.720): out of the fight, stable, alive. An opponent is beaten without dying; a
 *  character lies stable, to be healed up. */
function knockOut(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const dying = ctx.combat.dying!;
  target.knockedOut = true;
  target.dying = false;
  target.stable = true;
  if (rulesetDiesAtZero(target)) {
    target.defeated = true;
    target.diedRound = ctx.state.round;
    endSummons(ctx, target);
    endZones(ctx, target);
    unconjureAll(ctx, target);
  }
  endConcentration(ctx, target, "down");
  endConditionsFromSource(ctx, target);
  ctx.events.push({ type: "knockedOut", actorId: target.id, sourceId: ctx.acting!.actorId });
  const down = rulesetDiesAtZero(target) ? undefined : dying.condition;
  for (const condition of new Set([down, dying.knockOut!.condition])) {
    if (condition) applyConditionId(ctx, target, condition, { condition, duration: "instant" });
  }
}

/** Items made by a cast (1.721), into its maker's hand: more of the item they were held a place for
 *  as the fight began, written to their bag as it ends. Goodberry. */
function makeItems(ctx: RulesetCombatContext, maker: RulesetCombatant, action: RulesetCombatAction): void {
  const makes = action.makesItems!;
  const held = makes.at !== undefined ? maker.sheet?.items?.[makes.at] : undefined;
  if (!held) return;
  (maker.itemsUsed ??= {})[makes.at!] = (maker.itemsUsed[makes.at!] ?? 0) - makes.count;
  ctx.events.push({ type: "itemsMade", actorId: maker.id, label: held.name ?? makes.ref, count: makes.count });
  // Lasting only so long (1.760), in its maker's turns: Creation's, by its material.
  if (makes.lasting && makes.lasts) {
    const rounds = Math.max(1, Math.ceil((makes.lasts * 60) / (ctx.definition.combat?.roundSeconds ?? 6)));
    const key = String(makes.at);
    maker.madeFor = { ...maker.madeFor, [key]: [...(maker.madeFor?.[key] ?? []), { rounds, count: makes.count }] };
  }
}

/** What was made to last only so long runs out (1.760), counted down at its maker's turn's end, each
 *  making on its own clock: as much of it as is left is gone, what was used first. */
function vanishMade(ctx: RulesetCombatContext, maker: RulesetCombatant): void {
  const next: NonNullable<RulesetCombatant["madeFor"]> = {};
  for (const [key, batches] of Object.entries(maker.madeFor ?? {})) {
    const at = Number(key);
    const held = maker.sheet?.items?.[at];
    const going = batches.filter((batch) => batch.rounds <= 1).reduce((sum, batch) => sum + batch.count, 0);
    const staying = batches
      .filter((batch) => batch.rounds > 1)
      .map((batch) => ({ ...batch, rounds: batch.rounds - 1 }));
    if (staying.length > 0) next[key] = staying;
    if (!held || going < 1) continue;
    // Used up first from what goes first: only so much of it as the rest of it does not account for.
    const left = Math.max(0, held.quantity - (maker.itemsUsed?.[at] ?? 0));
    const kept = staying.reduce((sum, batch) => sum + batch.count, 0);
    const count = Math.min(going, Math.max(0, left - Math.min(left, kept)));
    if (count < 1) continue;
    (maker.itemsUsed ??= {})[at] = (maker.itemsUsed[at] ?? 0) + count;
    ctx.events.push({ type: "itemsVanished", actorId: maker.id, label: held.name ?? held.made ?? "", count });
  }
  if (Object.keys(next).length > 0) maker.madeFor = next;
  else delete maker.madeFor;
}

function trackValue(ctx: RulesetCombatContext, combatant: RulesetCombatant, track: string): number {
  if (!combatant.sheet) return 0;
  const live = readRulesetLive(ctx.definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
  return live.tracks.find((entry) => entry.id === track)?.value ?? 0;
}

/** The top of a track as this combatant's own sheet has it, since a plain track's maximum may be a
 *  value the sheet works out. A combatant with no sheet has no track to fill. */
function trackMax(ctx: RulesetCombatContext, combatant: RulesetCombatant, track: string): number {
  if (!combatant.sheet) return 0;
  const live = readRulesetLive(ctx.definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
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
  delete target.knockedOut;
  target.dying = false;
  target.stable = false;
  const dying = ctx.combat.dying;
  if (dying) {
    clearDyingTracks(ctx, target);
    if (dying.condition) removeCondition(ctx, target, dying.condition, "revived");
  }
  ctx.events.push({ type: "revived", actorId: target.id, health: healthOf(ctx, target).value });
}

/** Failures against death, from a blow while down (`harmed`, said here) or a roll its caller says.
 *  True when they kill. */
function addDeathFailures(ctx: RulesetCombatContext, target: RulesetCombatant, amount: number, harmed = true): boolean {
  const dying = ctx.combat.dying;
  if (!dying) return false;
  writeRulesetSheet(ctx.definition, target, { op: "track", track: dying.failures, by: amount });
  const failures = trackValue(ctx, target, dying.failures);
  const successes = trackValue(ctx, target, dying.successes);
  if (failures < trackMax(ctx, target, dying.failures)) {
    if (!harmed) return false;
    ctx.events.push({
      type: "dying",
      actorId: target.id,
      rolls: [],
      kept: 0,
      difficulty: dying.succeedAt,
      successes,
      failures,
      result: "failure",
      harmed: amount,
    });
    return false;
  }
  target.defeated = true;
  target.diedRound = ctx.state.round;
  endSummons(ctx, target);
  endZones(ctx, target);
  unconjureAll(ctx, target);
  target.dying = false;
  // A roll that kills is said with its roll (laptop playtest 2026-10-25: "does not get up again"
  // at 2 passed and 1 failed, the roll that failed twice never shown).
  if (harmed)
    ctx.events.push({
      type: "dying",
      actorId: target.id,
      rolls: [],
      kept: 0,
      difficulty: dying.succeedAt,
      successes,
      failures,
      result: "dead",
      harmed: amount,
    });
  return true;
}

/** The roll a character makes at the start of their turn while they are down. */
function deathSave(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  // Stable in place of the roll (1.688): a Periapt of Wound Closure.
  if (
    rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state).some((entry) => entry.stabilizesWhenDying)
  ) {
    actor.stable = true;
    clearDyingTracks(ctx, actor);
    ctx.events.push({
      type: "dying",
      actorId: actor.id,
      rolls: [],
      kept: 0,
      difficulty: dying.succeedAt,
      successes: trackValue(ctx, actor, dying.successes),
      failures: trackValue(ctx, actor, dying.failures),
      result: "stable",
    });
    return;
  }
  // Rolled twice where a condition says (1.500): Beacon of Hope; and, as a save, as every save is.
  const leans = new Set(
    rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state).flatMap((entry) =>
      entry.deathSaves ? [entry.deathSaves] : [],
    ),
  );
  const lean = leans.size === 1 ? [...leans][0] : undefined;
  const mode =
    leans.size > 1
      ? "normal"
      : dying.asSave
        ? rulesetSaveMode(ctx.definition, ctx.combat, actor, "", ctx.state, undefined, lean)
        : rulesetCombatAdvantage(ctx.combat)
          ? (lean ?? "normal")
          : "normal";
  const first = rollRulesetDice(ctx.roll, dying.dice.count, dying.dice.sides);
  const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dying.dice.count, dying.dice.sides);
  const rolls = second ? [...first, ...second] : first;
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  // What adds to every save adds to it as a save (1.500): Bless.
  const bonuses = dying.asSave
    ? rollBonuses(ctx, rulesetConditionModifiers(ctx.definition, ctx.combat, actor, "saves", ctx.state, ""), actor)
    : [];
  const total = kept + bonusTotal(bonuses);
  const single = dying.dice.count === 1;
  const top = single && kept === dying.dice.sides;
  const bottom = single && kept === 1;
  const say = (result: "success" | "failure" | "stable" | "dead" | "revived") =>
    ctx.events.push({
      type: "dying",
      actorId: actor.id,
      rolls,
      kept,
      ...(mode === "normal" ? {} : { mode }),
      ...(bonuses.length > 0 ? { bonuses, total } : {}),
      difficulty: dying.succeedAt,
      successes: trackValue(ctx, actor, dying.successes),
      failures: trackValue(ctx, actor, dying.failures),
      result,
    });

  // The roll is said before the revival it brings (laptop playtest 2026-10-23: "back up on 1" with
  // no roll shown).
  if (top && dying.naturals.max === "revive-1") {
    say("revived");
    dealHeal(ctx, actor, { rolls: [], flat: 1, amount: 1 });
    return;
  }
  let failures = 0;
  let successes = 0;
  if (bottom && dying.naturals.min === "two-failures") failures = 2;
  else if (bottom && dying.naturals.min === "one-failure") failures = 1;
  else if (top && dying.naturals.max === "success") successes = 1;
  else if (total >= dying.succeedAt) successes = 1;
  else failures = 1;

  if (failures > 0) {
    say(addDeathFailures(ctx, actor, failures, false) ? "dead" : "failure");
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
/** The rows of an action's rays striking one target (1.468), each logged as it is rolled: a row that
 *  strikes `again` rolls that many more, landing on it again rolled over. */
function rayRows(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  action: RulesetCombatAction,
): RulesetCombatRays["rows"] {
  const rays = action.rays!;
  const dice = parseRulesetCombatDice(rays.dice);
  if (!dice) return [];
  const struck: RulesetCombatRays["rows"] = [];
  const strike = (avoid?: RulesetCombatRays["rows"][number]) => {
    // Rolled over while it lands on the row that sent it, but never for ever.
    for (let tries = 0; tries < 20; tries++) {
      const roll = rollAmount(ctx, dice).total;
      const row = rays.rows.find((one) => roll <= one.atMost) ?? rays.rows[rays.rows.length - 1]!;
      if (avoid && row === avoid) continue;
      ctx.events.push({
        type: "ray",
        actorId: actor.id,
        targetId: target.id,
        label: action.label,
        ray: row.label,
        roll,
      });
      struck.push(row);
      return row;
    }
    return undefined;
  };
  const first = strike();
  if (first?.again) for (let more = 0; more < first.again; more++) strike(first);
  return struck;
}

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
  // A save against a condition is against those it counts as too (1.585): Enthrall's, against charm.
  if (against?.conditions?.length) {
    against = {
      ...against,
      conditions: [...new Set(against.conditions.flatMap((one) => rulesetConditionKin(ctx.definition, one)))],
    };
  }
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
      ? rulesetCoverBonus(ctx.combat, ctx.state, combatant, from, "save", undefined, source?.id)
      : 0;
  if (cover > 0) ctx.events.push({ type: "cover", targetId: combatant.id, bonus: cover, save });
  const modifier = own + cover;
  // What it is against is seen, or it has no source to see (1.417): Danger Sense.
  const seen = !source || source.id === combatant.id || rulesetCanSee(ctx.definition, ctx.state, combatant, source);
  const mode = rulesetSaveMode(ctx.definition, ctx.combat, combatant, save, ctx.state, against, lean, seen);
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
      combatant,
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
  const first = throwOwnDice(ctx, combatant, "saves", dice.count, dice.sides);
  const second = mode === "normal" ? null : throwOwnDice(ctx, combatant, "saves", dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  // What the saver's conditions add, rolled after the save's own dice.
  const bonuses = rollBonuses(
    ctx,
    rulesetConditionModifiers(ctx.definition, ctx.combat, combatant, "saves", ctx.state, save, against),
    combatant,
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
    const rescue = rescueEntry(ctx, combatant, "saves", undefined, undefined, save, against);
    if (rescue?.rescue?.by === "reroll")
      return throwSave(ctx, combatant, save, difficulty, sourceId, from, against, lean, true);
    if (rescue) return true;
  }
  return success;
}

/** The fight's own dice for one of `who`'s own rolls, any face a condition or level of theirs rolls
 *  again (1.408) rolled again once, the new face kept: a halfling's Lucky on a natural 1. */
function throwOwnDice(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  roll: "attacks" | "saves" | "checks",
  count: number,
  sides: number,
): number[] {
  const rolls = rollRulesetDice(ctx.roll, count, sides);
  const again = rulesetActiveConditions(ctx.definition, ctx.combat, who, ctx.state).find(
    (entry) =>
      entry.rerollsFace &&
      (!entry.rerollsFace.rolls || entry.rerollsFace.rolls.includes(roll)) &&
      rolls.includes(entry.rerollsFace.face),
  );
  if (!again) return rolls;
  const face = again.rerollsFace!.face;
  const sheet = ctx.definition.sheet;
  const label =
    [...sheet.live.conditions, ...sheet.derived, ...sheet.live.tracks].find((one) => one.id === again.condition)
      ?.label ?? again.condition;
  return rolls.map((rolled) => {
    if (rolled !== face) return rolled;
    const to = rollRulesetDice(ctx.roll, 1, sides)[0]!;
    ctx.events.push({ type: "rerolled", actorId: who.id, label, face, to });
    return to;
  });
}

/** An item's gate, rolled by its user as a check: the fight's own dice (a pool in a pool fight) with
 *  the sheet's number read as the fight began, what their conditions add to checks (and to the skill
 *  it names), and the lean they give it. Logged as a save is. */
/** Whether a use's chance comes up (1.441): sure while its sheet says so, else one die at or under
 *  what it needs. Failed, `failUses` is spent in place of what it cost. */
function rollsChance(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  unpaid: RulesetLiveState | undefined,
): boolean {
  const chance = action.chance!;
  const needed =
    typeof chance.atMost === "number" ? chance.atMost : (rulesetSheetValue(ctx.definition, actor, chance.atMost) ?? 0);
  const said = {
    type: "chance" as const,
    actorId: actor.id,
    optionId: action.id,
    label: action.label,
    sides: chance.sides,
    needed,
  };
  if (chance.sure && actor.sheet && rulesetSheetWithin(ctx.definition, actor, chance.sure)) {
    ctx.events.push({ ...said, outcome: "sure" });
    return true;
  }
  const roll = ctx.roll(chance.sides);
  const answered = roll <= needed;
  ctx.events.push({ ...said, roll, outcome: answered ? "answered" : "failed" });
  if (answered) return true;
  const instead = chance.failUses ? rulesetFailedChanceLive(ctx.definition, actor, action, unpaid) : null;
  if (instead && actor.sheet) {
    actor.sheet.live = instead.live;
    for (const entry of instead.cost) {
      ctx.events.push({
        type: "spend",
        actorId: actor.id,
        pool: entry.pool,
        label: entry.label,
        amount: entry.amount,
        on: action.label,
      });
    }
  }
  return false;
}

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
    const bonuses = rollBonuses(ctx, modifiers, actor);
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
  const first = throwOwnDice(ctx, actor, "checks", dice.count, dice.sides);
  const second = mode === "normal" ? null : throwOwnDice(ctx, actor, "checks", dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  const bonuses = rollBonuses(ctx, modifiers, actor);
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
function rollBonuses(
  ctx: RulesetCombatContext,
  modifiers: RulesetConditionModifier[],
  /** Whose sheet a value it adds is read off (1.429). */
  holder?: RulesetCombatant,
): RulesetConditionBonus[] {
  return modifiers.map(({ condition, level, derived, item, modifier }) => {
    let value = modifier.flat ?? 0;
    const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
    const rolls = dice ? rollRulesetDice(ctx.roll, dice.count, dice.sides) : undefined;
    if (dice && rolls) value += (modifier.minus ? -1 : 1) * (sumOf(rolls) + dice.flat);
    // A value off the holder's sheet (1.429): Foe Slayer's Wisdom modifier, Natural Explorer's
    // proficiency bonus.
    if (modifier.add && holder)
      value += (modifier.minus ? -1 : 1) * (rulesetHolderValue(ctx.definition, holder, modifier.add) ?? 0);
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
  const rescue = rescues.find(
    (one) =>
      rescueMost(one.modifier) +
        (one.modifier.add ? (rulesetHolderValue(ctx.definition, combatant, one.modifier.add) ?? 0) : 0) >=
        short &&
      // Once on each of its holder's own turns (1.429): Foe Slayer.
      (!one.modifier.oncePer || oncePerTurnLeft(ctx, combatant, one)),
  );
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
  const bonuses = rollBonuses(ctx, [rescue], combatant).map((bonus) => ({ ...bonus, rescue: true as const }));
  // Once a turn, it is that turn's, and the condition stays (1.429).
  if (rescue.modifier.oncePer) {
    spendOncePerTurn(ctx, combatant, onceKey(rescue));
    return bonuses;
  }
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
  /** What the save is against (1.787), for an entry narrowed by its `against`. */
  against?: RulesetSaveAgainst,
): RulesetCombatAction | undefined {
  const found = holder.actions.find(
    (action) =>
      action.rescue?.roll === roll &&
      // Asked for no kind, it is one that settles the roll by itself: a die only adds (1.256), and a
      // d20 counted as 20 only where it would do (1.256).
      (by === undefined ? action.rescue.by === "reroll" || action.rescue.by === "success" : action.rescue.by === by) &&
      // Only the saves it names (1.257): a ring of evasion's Dexterity saves.
      (!action.rescue.saves || (save !== undefined && action.rescue.saves.includes(save))) &&
      // Only against what it names (1.787): a Scarab of Protection's necromancy and undead.
      (!action.rescue.against || rescuesAgainst(action.rescue.against, against)) &&
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

/** Whether a save is against what a rescue's `against` names (1.787), either one enough. */
function rescuesAgainst(
  wanted: NonNullable<RulesetCombatRescue["against"]>,
  against: RulesetSaveAgainst | undefined,
): boolean {
  if (!against) return false;
  if (wanted.where && against.filters && rulesetCatalogWhereReads({ filters: against.filters }, wanted.where))
    return true;
  return !!wanted.fromTypes && !!against.from?.type && wanted.fromTypes.includes(against.from.type);
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
  // Out of a worn item's charges (1.572).
  if (paid.itemCharges) (holder.charges ??= {})[paid.itemCharges.item] = paid.itemCharges.now;
  countRulesetSpend(holder, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({
      type: "spend",
      actorId: holder.id,
      pool: entry.pool,
      label: entry.label,
      amount: entry.amount,
      on: action.label,
    });
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

/** What an attack roll at this target spends of theirs: what ends after any, and what ends after one
 *  by whoever put it on (1.502). */
function attackedConditions(target: RulesetCombatant, attacker: RulesetCombatant): RulesetTrackedCondition[] {
  return target.tracked.filter(
    (entry) =>
      entry.endsAfter === "attacked" || (entry.endsAfter === "attacked-by-source" && entry.source === attacker.id),
  );
}

/** Whether an attack on `target` is turned onto one of its duplicates (1.505), with the defense it is
 *  rolled against then: never by an attacker who can't see them, or who senses them past the trick. */
function divertedToDuplicate(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): { condition: string; defense: number; roll: number; needed: number } | null {
  if (actor.id === target.id) return null;
  const entry = rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).find((one) => one.duplicates);
  const rule = entry?.duplicates;
  if (!entry || !rule) return null;
  const tracked = target.tracked.find((one) => one.condition === entry.condition);
  const left = Math.min(rule.count, tracked?.duplicatesLeft ?? rule.count);
  if (left < 1) return null;
  if (!rulesetCanSee(ctx.definition, ctx.state, actor, target)) return null;
  // Seen truly (1.649): Witch Sight.
  if (rulesetSeesTrue(ctx.definition, ctx.state, actor, target)) return null;
  if (rule.pierced) {
    const ranges = rulesetSenseRanges(ctx.definition, actor, ctx.state);
    const positioned = !!rulesetPositionOf(actor) && !!rulesetPositionOf(target);
    const away = positioned ? rulesetGap(actor, target) : 0;
    if (rule.pierced.some((sense) => (ranges[sense] ?? 0) > 0 && (ranges[sense] ?? 0) >= away)) return null;
  }
  const needed = rule.thresholds[left - 1]!;
  const roll = ctx.roll(rule.sides ?? 20);
  const diverted = roll >= needed;
  ctx.events.push({ type: "duplicate", actorId: actor.id, targetId: target.id, roll, needed, diverted });
  if (!diverted) return null;
  const score = rule.defense.ability ? rulesetAbilityScore(ctx.definition, target, rule.defense.ability) : undefined;
  const mod = typeof score === "number" ? rulesetAbilityModifier(ctx.definition, score) : 0;
  return { condition: entry.condition, defense: rule.defense.flat + mod, roll, needed };
}

/** A duplicate an attack hit is destroyed (1.505), and its condition ends with the last of them. */
function loseDuplicate(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  condition: string,
  { roll, needed }: { roll: number; needed: number },
): void {
  const rule = ctx.combat.conditions?.find((one) => one.condition === condition)?.duplicates;
  const tracked = target.tracked.find((one) => one.condition === condition);
  if (!rule) return;
  const left = Math.max(0, Math.min(rule.count, tracked?.duplicatesLeft ?? rule.count) - 1);
  ctx.events.push({
    type: "duplicate",
    actorId: actor.id,
    targetId: target.id,
    roll,
    needed,
    diverted: true,
    lost: true,
    left,
  });
  if (tracked) tracked.duplicatesLeft = left;
  if (left === 0 && tracked) removeCondition(ctx, target, condition, "spent");
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
    /** The catalog of the entry that put it on (1.424), for what ends a spell's conditions. */
    catalog?: string;
  } = {},
): void {
  const putter = extra.sourceId ? rulesetCombatant(ctx.state, extra.sourceId) : undefined;
  // Nothing anybody does puts a condition on the fallen: a body is not chilled. One only sent away
  // (banished, hurled) is still somebody.
  if (target.defeated && !target.away && putter && putter.id !== target.id) return;
  // Only on a roll (1.646): Wish lost, 33 in 100.
  if (applies.chance !== undefined && ctx.roll(100) > applies.chance) return;
  // Put on by an action that never hinders them (1.704): a web's restraint, on a spider.
  if (extra.action && rulesetUnhinderedBy(target, extra.action)) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "immune" });
    return;
  }
  // Only on a target already holding what it asks, as it stands now (1.407): a kraken's swallow.
  if (applies.targetHolds && !rulesetHoldsFor(ctx.definition, target, extra.sourceId ?? "", applies.targetHolds))
    return;
  if (
    rulesetImmuneToCondition(
      target,
      condition,
      ctx.definition,
      ctx.state,
      putter,
      extra.catalog ?? ctx.harming?.catalog,
    ) ||
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
  // Put on by somebody kept out of where its holder stands (1.452): Magic Circle's "can't be
  // charmed, frightened, or possessed by the creature".
  const giver = extra.sourceId ? rulesetCombatant(ctx.state, extra.sourceId) : undefined;
  if (
    giver &&
    giver.id !== target.id &&
    rulesetWardedFrom(ctx.definition, ctx.state, target, giver).some((rule) => rule.cantGive?.includes(condition))
  ) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "warded" });
    return;
  }
  // Its holder already holding all it has room for (1.405): Whelm's one Large or two Medium.
  const insideRoom = insideRule(ctx, condition)?.room;
  const holding = extra.sourceId ? rulesetCombatant(ctx.state, extra.sourceId) : undefined;
  if (
    insideRoom &&
    holding &&
    target.insideOf !== holding.id &&
    insideUsed(ctx, holding, insideRoom) + insideTakes(ctx, target, insideRoom) > insideRoom.of
  ) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "full" });
    return;
  }
  // A form above what its target may become changes nothing (1.392): Polymorph's "equal or less".
  const shapeRule = ctx.combat.conditions?.find((one) => one.condition === condition)?.shape;
  if (shapeRule && applies.form && !rulesetFormAllowed(ctx.definition, target, applies)) {
    ctx.events.push({ type: "shaped", targetId: target.id, condition, form: applies.form.name, refused: true });
    return;
  }
  // For what is left of another (1.616): Wind Walk's cloud again, or nothing once it has run out.
  const remainingOf = typeof applies.duration === "object" ? applies.duration.remainingOf : undefined;
  const left = remainingOf !== undefined ? rulesetConditionLeft(ctx.state, target, remainingOf) : undefined;
  if (left !== undefined && left < 1) return;
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: true });
  // Paid high enough to have no clock (1.482): Bestow Curse from a 9th-level slot.
  // So many times over, rolled now (1.625): a Potion of Growth's 1d4 hours.
  const times =
    typeof applies.duration === "object" && applies.duration.times
      ? parseRulesetCombatDice(applies.duration.times)
      : null;
  const lasts =
    typeof applies.duration === "object"
      ? times
        ? Math.max(1, Math.min(14400, applies.duration.rounds * rollAmount(ctx, times).total))
        : applies.duration.rounds
      : 0;
  const rounds =
    typeof applies.duration === "object" && !applies.duration.untilDispelled
      ? left !== undefined
        ? Math.min(lasts, left)
        : lasts
      : null;
  if (target.conditionLeft?.[condition]) delete target.conditionLeft[condition];
  // Days, off its applier's sheet (1.663): Quivering Palm's monk level.
  const days = ((ref) => {
    if (ref === undefined) return undefined;
    // Until the next midnight (1.751): the next day that passes on its sheet.
    if (ref === "midnight") return 1;
    // Rolled as it goes on (1.756): Wish's stress, 2d4 days.
    if (typeof ref === "object" && ref && "dice" in ref) {
      const dice = parseRulesetCombatDice(ref.dice);
      return dice ? Math.max(1, Math.min(3650, rollAmount(ctx, dice).total)) : undefined;
    }
    const read = giver?.sheet
      ? rulesetSheetValue(ctx.definition, giver, ref)
      : typeof ref === "number"
        ? ref
        : typeof ref === "object" && ref && "const" in ref && typeof ref.const === "number"
          ? ref.const
          : undefined;
    return read !== undefined && read >= 1 ? Math.min(3650, Math.trunc(read)) : undefined;
  })(applies.lastsDays);
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
    // Where it was put on from (1.457), for a behavior measured from there: Symbol of Fear's glyph.
    ...(rule?.behavior?.from === "point" && ctx.aimedAt ? { at: { x: ctx.aimedAt.x, y: ctx.aimedAt.y } } : {}),
    rounds: rounds !== null && startsNext ? rounds + 1 : rounds,
    ...(days !== undefined ? { days } : {}),
    ...(applies.wardsOff ? { wardsOff: applies.wardsOff } : {}),
    ...(days !== undefined &&
    typeof applies.lastsDays === "object" &&
    "restingCounts" in applies.lastsDays &&
    applies.lastsDays.restingCounts
      ? { restingCounts: applies.lastsDays.restingCounts }
      : {}),
    ...(applies.wornItem ? { wornItem: applies.wornItem } : {}),
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
            ...(applies.endsWhenHolder.castsAtFoes ? { castsAtFoes: true as const } : {}),
            ...(applies.endsWhenHolder.moves ? { moves: true as const } : {}),
            ...(applies.endsWhenHolder.acts ? { acts: true as const } : {}),
            ...(applies.endsWhenHolder.uses ? { uses: [...applies.endsWhenHolder.uses] } : {}),
            ...(applies.endsWhenHolder.downed ? { downed: true as const } : {}),
            ...(applies.endsWhenHolder.gains ? { gains: [...applies.endsWhenHolder.gains] } : {}),
            ...(applies.endsWhenHolder.incapacitated ? { incapacitated: true as const } : {}),
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
    ...(applies.harmsPuller ? { harmsPuller: { ...applies.harmsPuller } } : {}),
    ...(extra.harmsMore ? { harmsMore: { ...extra.harmsMore } } : {}),
    ...(extra.value !== undefined ? { value: extra.value } : {}),
    ...(extra.level !== undefined ? { level: extra.level } : {}),
    ...(extra.steps !== undefined ? { steps: extra.steps } : {}),
    ...(extra.catalog ? { catalog: extra.catalog } : {}),
  });
  ctx.events.push(
    stacks !== undefined
      ? { type: "condition", targetId: target.id, condition, active: true, reason: "stacked", stacks }
      : { type: "condition", targetId: target.id, condition, active: true, reason: "applied" },
  );
  // What it puts on as well (1.765), staying after it ends until it comes off on its own: unconscious's
  // prone, there until its holder stands.
  for (const also of rule?.alsoApplies ?? []) {
    if (also === condition || target.tracked.some((entry) => entry.condition === also)) continue;
    applyConditionId(ctx, target, also, { condition: also, duration: "instant" });
  }
  // Its holder's health maximum raised while it holds, and their health with it (1.473): Aid.
  if (applies.raisesMax) raiseMax(ctx, target, condition, applies.raisesMax, extra.steps ?? 0);
  // The shape it holds (1.392), in place of any other.
  if (shapeRule && applies.form) takeShape(ctx, target, condition, shapeRule, applies.form);
  // Inside whoever put it on (1.403): a gelatinous cube's engulfed, a purple worm's swallowed.
  if (rule?.inside && extra.sourceId && extra.sourceId !== target.id && target.insideOf !== extra.sourceId) {
    takeInside(ctx, target, extra.sourceId);
    // How it climbs out once they have fallen (1.405).
    const corpse = rule.inside === true ? undefined : rule.inside.corpse;
    if (corpse) target.insideCorpse = { ...corpse };
  }
  // What its applier had on them ends now it is on (1.407): the grapple, once swallowed.
  for (const ended of applies.endsOnTarget ?? []) {
    if (ended === condition) continue;
    const held = target.tracked.find(
      (entry) => entry.condition === ended && (extra.sourceId === undefined || entry.source === extra.sourceId),
    );
    if (held) removeCondition(ctx, target, ended, "linked");
  }
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

/** A condition's raise of its holder's health maximum (1.473), rolled as it goes on, and their
 *  health raised by the same. A wound track has no maximum to raise. */
function raiseMax(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  raises: NonNullable<RulesetCombatApplies["raisesMax"]>,
  steps: number,
): void {
  if ("track" in ctx.combat.health) return;
  const dice = raises.dice ? parseRulesetCombatDice(raises.dice) : null;
  const amount = Math.max(
    0,
    (dice ? rollAmount(ctx, dice).total : 0) + (raises.flat ?? 0) + (raises.perStep ?? 0) * Math.max(0, steps),
  );
  if (amount <= 0) return;
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "raise", condition, amount });
  else if (target.health) {
    const tracked = target.tracked.find((entry) => entry.condition === condition);
    if (!tracked) return;
    tracked.raisedMax = amount;
    const now = healthOf(ctx, target);
    target.health.value = Math.min(now.max, now.value + amount);
  } else return;
  ctx.events.push({ type: "raisedMax", targetId: target.id, condition, amount });
}

/** What a condition's `inside` says (1.403, 1.405), `true` read as nothing more. */
function insideRule(ctx: RulesetCombatContext, condition: string): RulesetConditionInside | undefined {
  const inside = ctx.combat.conditions?.find((one) => one.condition === condition)?.inside;
  return inside === undefined ? undefined : inside === true ? {} : inside;
}

/** The places one creature takes inside another (1.405): what `takes` gives its size, else one. */
function insideTakes(ctx: RulesetCombatContext, one: RulesetCombatant, room: RulesetInsideRoom): number {
  const size = ctx.combat.sizes && rulesetSizeRank(ctx.combat, one) !== undefined ? one.size : undefined;
  return (size !== undefined ? room.takes?.[size] : undefined) ?? 1;
}

/** The places those `holder` already holds inside take (1.405). */
function insideUsed(ctx: RulesetCombatContext, holder: RulesetCombatant, room: RulesetInsideRoom): number {
  return ctx.state.combatants
    .filter((one) => one.insideOf === holder.id && !one.defeated)
    .reduce((total, one) => total + insideTakes(ctx, one, room), 0);
}

/** Put prone (1.405): the fight's condition that takes half a walk to stand from. */
function layProne(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const prone = ctx.combat.conditions?.find((one) => one.effects.includes("half-move-to-stand"))?.condition;
  if (!prone || target.defeated || rulesetCombatConditions(ctx.definition, target).includes(prone)) return;
  applyConditionId(ctx, target, prone, { condition: prone, duration: "instant" }, {});
}

/** Lets out of `holder` everybody it holds inside (or `only` them), ending what keeps them there. */
function letOutOf(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  inside: RulesetCombatant,
  reason: "expired" | "contest",
): void {
  for (const entry of [...inside.tracked]) {
    if (entry.source === holder.id && insideRule(ctx, entry.condition))
      removeCondition(ctx, inside, entry.condition, reason);
  }
  if (inside.insideOf === holder.id) letOut(ctx, inside);
}

/**
 * As a turn ends (1.405), whoever was dealt `releasedWhen`'s amount or more in it by somebody they
 * hold inside saves or lets them out, prone where it says so: a behir's 30 damage, DC 14.
 */
function releaseOnHurt(ctx: RulesetCombatContext): void {
  const turn = `${ctx.state.round}:${ctx.state.turn}`;
  for (const holder of ctx.state.combatants) {
    const hurt = holder.insideHurt;
    if (!hurt) continue;
    delete holder.insideHurt;
    if (hurt.turn !== turn || !rulesetCombatStanding(holder)) continue;
    for (const [id, dealt] of Object.entries(hurt.by)) {
      const inside = rulesetCombatant(ctx.state, id);
      if (!inside || inside.insideOf !== holder.id) continue;
      const rule = inside.tracked
        .filter((entry) => entry.source === holder.id)
        .map((entry) => insideRule(ctx, entry.condition)?.releasedWhen)
        .find((one) => one !== undefined && dealt >= one.dealt);
      if (!rule || rollSave(ctx, holder, rule.save.save, rule.save.difficulty)) continue;
      letOutOf(ctx, holder, inside, "expired");
      if (rule.prone) layProne(ctx, inside);
    }
  }
}

/** Nothing keeps `target` inside a holder who has fallen (1.405): it stays there until it climbs
 *  out, and on its own turn has the walk it was kept from to do it with. */
function freeInCorpse(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  if (currentRulesetActor(ctx.state)?.id !== target.id) return;
  const allowance = rulesetMovementAllowance(ctx.definition, ctx.combat, target, ctx.state);
  target.movementLeft = Math.max(target.movementLeft ?? 0, allowance);
}

/** Climbing out of a fallen holder (1.405): what it costs of the walk, set down beside them, prone
 *  where it says so. */
function resolveClimbOut(ctx: RulesetCombatContext, actor: RulesetCombatant, option: RulesetCombatOption): void {
  const corpse = rulesetInsideCorpse(ctx.state, actor);
  const holder = actor.insideOf ? rulesetCombatant(ctx.state, actor.insideOf) : undefined;
  const cost = option.movementCost ?? 0;
  spendRulesetMovement(actor, cost);
  const from = rulesetPositionOf(actor) ? { x: actor.x!, y: actor.y! } : undefined;
  if (holder) letOutOf(ctx, holder, actor, "expired");
  else letOut(ctx, actor);
  if (from) {
    ctx.events.push({
      type: "move",
      actorId: actor.id,
      from,
      to: { x: actor.x!, y: actor.y! },
      path: [],
      cost,
      left: actor.movementLeft ?? 0,
    });
  }
  if (corpse?.prone) layProne(ctx, actor);
}

/** `rider` gets up on `mount` (1.496) for `cost` of their walk. A controlled mount's turn comes
 *  straight after its rider's from now on; one that already had its turn this round waits for the
 *  next. */
function mountOn(ctx: RulesetCombatContext, rider: RulesetCombatant, mount: RulesetCombatant, cost: number): void {
  spendRulesetMovement(rider, cost);
  rider.mountedOn = mount.id;
  // One more on a mount that carries by weight (1.641): carried along, its first rider still steering.
  if (mount.riddenBy) (mount.passengers ??= []).push(rider.id);
  else steeredBy(ctx, mount, rider);
  if (rulesetPositionOf(mount) && rulesetPositionOf(rider)) placeInside(mount, rider);
  ctx.events.push({ type: "mount", riderId: rider.id, mountId: mount.id });
}

/** `rider` steers `mount` (1.496): a controlled mount's turn comes straight after theirs from now on;
 *  one that already had its turn this round waits for the next. */
function steeredBy(ctx: RulesetCombatContext, mount: RulesetCombatant, rider: RulesetCombatant): void {
  mount.riddenBy = rider.id;
  if (ctx.combat.mounts?.controlled && !mount.sheet && !mount.block?.mountIndependent) {
    mount.mountControlled = true;
    const order = ctx.state.order;
    const mountAt = order.indexOf(mount.id);
    const riderAt = order.indexOf(rider.id);
    if (mountAt >= 0 && riderAt >= 0 && mountAt !== riderAt + 1) {
      order.splice(mountAt, 1);
      order.splice(order.indexOf(rider.id) + 1, 0, mount.id);
      if (mountAt < riderAt) {
        ctx.state.turn -= 1;
        mount.mountWaits = ctx.state.round;
      }
    }
  }
}

/** `rider` gets down beside their mount (1.496), or comes off it (`fell`). */
function dismount(ctx: RulesetCombatContext, rider: RulesetCombatant, fell = false): void {
  const mount = rider.mountedOn ? rulesetCombatant(ctx.state, rider.mountedOn) : undefined;
  delete rider.mountedOn;
  if (mount) {
    // A passenger gets down alone (1.641); its rider's going hands it to the next one on it.
    const next = mount.riddenBy === rider.id ? mount.passengers?.[0] : undefined;
    mount.passengers = mount.passengers?.filter((id) => id !== rider.id && id !== next);
    if (!mount.passengers?.length) delete mount.passengers;
    if (mount.riddenBy === rider.id) {
      delete mount.riddenBy;
      delete mount.mountControlled;
      delete mount.mountWaits;
      const taking = next ? rulesetCombatant(ctx.state, next) : undefined;
      if (taking) steeredBy(ctx, mount, taking);
    }
    if (ctx.state.board?.grid && rulesetPositionOf(mount) && rulesetPositionOf(rider)) setDownBeside(ctx, mount, rider);
  }
  ctx.events.push({ type: "mount", riderId: rider.id, mountId: mount?.id ?? "", off: true, ...(fell ? { fell } : {}) });
}

/** Every rider where their mount is, or off it (1.496): a mount gone, down or no longer standing, or
 *  a rider who is, parts them; a mount holding a condition of `fall.when`, or pushed, throws its rider
 *  unless they make the save, and a rider holding one comes off. */
function syncMounts(ctx: RulesetCombatContext): void {
  const fall = ctx.combat.mounts?.fall;
  for (const rider of ctx.state.combatants) {
    if (!rider.mountedOn) continue;
    const mount = rulesetCombatant(ctx.state, rider.mountedOn);
    const gone = (one: RulesetCombatant | undefined) =>
      !one || one.defeated || one.down || !rulesetCombatStanding(one) || !!one.insideOf;
    if (gone(mount) || gone(rider) || (mount!.riddenBy !== rider.id && !mount!.passengers?.includes(rider.id))) {
      dismount(ctx, rider);
      continue;
    }
    const holds = (one: RulesetCombatant) =>
      !!fall?.when?.some((id) => rulesetCombatConditions(ctx.definition, one).includes(id));
    if (fall && holds(rider)) {
      dismount(ctx, rider, true);
      continue;
    }
    // Knocked down under them, they may land on their feet for a reaction instead (1.504).
    if (fall?.landsWith && holds(mount!) && (rider.budgets[fall.landsWith] ?? 0) >= 1) {
      rider.budgets[fall.landsWith]! -= 1;
      dismount(ctx, rider);
      continue;
    }
    if (fall && (holds(mount!) || ctx.shakenMounts?.has(mount!.id))) {
      const kept = rollSave(ctx, rider, fall.save, fall.difficulty);
      dismount(ctx, rider, !kept);
      if (!kept && fall.applies) {
        applyConditionId(ctx, rider, fall.applies, { condition: fall.applies, duration: "instant" }, {});
      }
      continue;
    }
    if (rulesetPositionOf(mount) && rulesetPositionOf(rider)) placeInside(mount!, rider);
  }
  ctx.shakenMounts?.clear();
}

/** `target` is taken inside `holderId` (1.403): off the ground, where its holder is, and carried along
 *  wherever it goes. Nothing reaches in or out but its holder (`rulesetSealedApart`). */
function takeInside(ctx: RulesetCombatContext, target: RulesetCombatant, holderId: string): void {
  const holder = rulesetCombatant(ctx.state, holderId);
  if (!holder) return;
  if (target.insideOf) letOut(ctx, target);
  target.insideOf = holder.id;
  if (rulesetPositionOf(holder) && rulesetPositionOf(target)) placeInside(holder, target);
  ctx.events.push({ type: "inside", targetId: target.id, holderId: holder.id });
}

/** Wherever its holder stands, inside it (1.403): on its first cell, and as high as it is. */
function placeInside(holder: RulesetCombatant, inside: RulesetCombatant): void {
  inside.x = holder.x!;
  inside.y = holder.y!;
  if (holder.altitude !== undefined) inside.altitude = holder.altitude;
  else delete inside.altitude;
}

/** Whether something its holder put on still keeps it inside (1.403). */
function keptInside(ctx: RulesetCombatContext, target: RulesetCombatant): boolean {
  return target.tracked.some(
    (entry) =>
      entry.source === target.insideOf &&
      !!ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.inside,
  );
}

/** Let out of whoever held them inside (1.403): set down on the nearest open cell beside them. */
function letOut(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const holderId = target.insideOf!;
  delete target.insideOf;
  delete target.insideCorpse;
  const holder = rulesetCombatant(ctx.state, holderId);
  const grid = ctx.state.board?.grid;
  if (grid && holder && rulesetPositionOf(holder) && rulesetPositionOf(target)) {
    setDownBeside(ctx, holder, target);
  }
  ctx.events.push({ type: "inside", targetId: target.id, holderId, out: true });
}

/** `target` moved to the nearest cell open to it around `beside` (1.403): out of an engulf's way,
 *  or let out of it. Where there is none, it stays. */
function setDownBeside(
  ctx: RulesetCombatContext,
  beside: RulesetCombatant,
  target: RulesetCombatant,
): RulesetCombatCell | null {
  const grid = ctx.state.board!.grid;
  const taken = new Set<string>();
  for (const one of ctx.state.combatants) {
    if (one.id === target.id || one.insideOf || !rulesetCombatStanding(one) || !rulesetPositionOf(one)) continue;
    for (const cell of rulesetFootprint(one)) taken.add(`${cell.x},${cell.y}`);
  }
  // Beside them, even where they have fallen.
  for (const cell of rulesetFootprint(beside)) taken.add(`${cell.x},${cell.y}`);
  const to = rulesetFitCell(grid, { x: target.x!, y: target.y! }, rulesetSpanOf(target), taken);
  if (!to) return null;
  target.x = to.x;
  target.y = to.y;
  if (beside.altitude !== undefined && target.altitude !== undefined && !rulesetAirborne(grid, target)) {
    delete target.altitude;
  }
  return to;
}

/**
 * An engulf lands (1.403) on whoever its maker entered, or, off a board, the one it was aimed at:
 * each makes its save against it, and on a failure takes what the action does, an `inside`
 * condition among it taking them in. Whoever saves, or finds it already holding all it may, is
 * pushed out of its way.
 */
function engulfLands(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  entered: readonly RulesetCombatant[],
): void {
  const engulf = action.engulf!;
  // As many as it has room for (1.405), or `atMost` of any size.
  const room = engulf.room ?? (engulf.atMost !== undefined ? { of: engulf.atMost } : undefined);
  let used = room ? insideUsed(ctx, actor, room) : 0;
  const taken = entered.filter((one) => {
    if (!rulesetEngulfable(ctx.definition, actor, engulf, one)) return false;
    if (!room) return true;
    const takes = insideTakes(ctx, one, room);
    if (used + takes > room.of) return false;
    used += takes;
    return true;
  });
  if (taken.length > 0) {
    const { engulf: _engulf, ...rest } = action;
    resolveAction(
      ctx,
      actor,
      {
        ...rest,
        save: { save: engulf.save.save, difficulty: engulf.save.difficulty, onSuccess: "negates" },
      },
      taken,
    );
  }
  if (!ctx.state.board?.grid || !rulesetPositionOf(actor)) return;
  const covered = new Set(rulesetFootprint(actor).map((cell) => `${cell.x},${cell.y}`));
  for (const one of entered) {
    if (one.insideOf === actor.id || !rulesetPositionOf(one)) continue;
    if (!rulesetFootprint(one).some((cell) => covered.has(`${cell.x},${cell.y}`))) continue;
    const from = rulesetPositionOf(one)!;
    const to = setDownBeside(ctx, actor, one);
    if (to)
      ctx.events.push({ type: "pushed", actorId: actor.id, targetId: one.id, from, to: { ...to }, path: [{ ...to }] });
  }
}

/**
 * A leap lands (1.725) on whoever stands where it did: each makes the action's save and takes what
 * it does, then is set down out of its space, beside it, riders with their mounts. One who saved with
 * no room to be set down takes the leap's `noRoom` where it is.
 */
function leapLands(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  const covered = new Set(rulesetFootprint(actor).map((cell) => `${cell.x},${cell.y}`));
  const under = (one: RulesetCombatant) =>
    one.id !== actor.id &&
    !one.insideOf &&
    !!rulesetPositionOf(one) &&
    rulesetFootprint(one).some((cell) => covered.has(`${cell.x},${cell.y}`));
  const caught = ctx.state.combatants.filter((one) => rulesetCombatStanding(one) && under(one));
  if (caught.length === 0) return;
  const { leapsOnto: rule, ...rest } = action;
  const from = ctx.events.length;
  resolveAction(ctx, actor, rest, caught);
  const saved = new Set(
    ctx.events
      .slice(from)
      .flatMap((event) =>
        event.type === "save" && event.sourceId === actor.id && event.success ? [event.actorId] : [],
      ),
  );
  const grid = ctx.state.board?.grid;
  if (!grid || !rulesetPositionOf(actor)) return;
  for (const one of caught) {
    if (one.mountedOn || !under(one)) continue;
    const start = rulesetPositionOf(one)!;
    // A cell's step out of its space, beside it.
    const riders = ctx.state.combatants.filter((rider) => rider.mountedOn === one.id).map((rider) => rider.id);
    let to: RulesetCombatCell | undefined;
    for (let y = start.y - 1; y <= start.y + 1 && !to; y++) {
      for (let x = start.x - 1; x <= start.x + 1 && !to; x++) {
        const cell = { x, y };
        if (x < 0 || y < 0 || x + rulesetSpanOf(one) > grid.width || y + rulesetSpanOf(one) > grid.height) continue;
        if (rulesetGapFrom(cell, rulesetSpanOf(one), actor) !== 1) continue;
        if (rulesetRoomAt(ctx.state, grid, one, cell, riders)) to = cell;
      }
    }
    if (to) {
      one.x = to.x;
      one.y = to.y;
      for (const rider of ctx.state.combatants) if (rider.mountedOn === one.id) placeInside(one, rider);
      ctx.events.push({
        type: "pushed",
        actorId: actor.id,
        targetId: one.id,
        from: start,
        to: { ...to },
        path: [{ ...to }],
      });
    } else if (saved.has(one.id) && rule?.noRoom) {
      applyConditionId(ctx, one, rule.noRoom, { condition: rule.noRoom, duration: "instant" }, {});
    }
  }
}

/** An engulf's walk (1.403): up to its maker's speed, lent for it, or on what is left of its own. */
function engulfWalk(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  path: RulesetCombatCell[],
): void {
  const own = action.engulf!.ownMovement;
  const kept = {
    ...(actor.movementLeft !== undefined ? { movementLeft: actor.movementLeft } : {}),
    ...(actor.modeLeft ? { modeLeft: actor.modeLeft } : {}),
  };
  if (!own) {
    const lent = rulesetLentMovement(ctx.definition, actor, { share: 1 }, ctx.state);
    actor.movementLeft = lent.movementLeft;
    if (lent.modeLeft) actor.modeLeft = lent.modeLeft;
    else delete actor.modeLeft;
  }
  walkOn(ctx, actor, {
    kind: "walk",
    actorId: actor.id,
    from: { x: actor.x!, y: actor.y! },
    walked: [],
    path: [...path],
    asked: [],
    spent: 0,
    ...(own ? {} : { legendary: { kept } }),
    engulf: { actionId: action.id, entered: [] },
  });
}

/** `target` takes a form's shape (1.392), giving up one another condition held. */
function takeShape(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  rule: NonNullable<NonNullable<RulesetCombat["conditions"]>[number]["shape"]>,
  form: NonNullable<RulesetCombatApplies["form"]>,
): void {
  const other = target.shape && target.shape.condition !== condition ? target.shape.condition : undefined;
  if (other) {
    leaveShape(ctx, target, "moved");
    removeCondition(ctx, target, other, "moved");
  }
  // And what its holder's own conditions and levels say any shape keeps (1.435): Beast Spells.
  // Narrowed to the rows it reaches (1.437): a druid's spells, not a wizard's.
  const more = rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).flatMap((entry) => {
    if (!entry.shapeKeeps) return [];
    const keeps = new Set(entry.shapeKeeps);
    return target.actions
      .filter((one) => rulesetKeepsAction(keeps, one) && rulesetRowsReach(entry.rowsWhere, one))
      .map((one) => one.id);
  });
  const kept = more.length ? { ...rule, keeps: [...(rule.keeps ?? []), ...more] } : rule;
  const shaped = rulesetTakeShape(ctx.definition, ctx.state, target, condition, kept, form, ctx.roll);
  if (shaped) ctx.events.push({ type: "shaped", targetId: target.id, condition, form: shaped.name });
}

/** `target` is itself again (1.392), saying so. */
function leaveShape(ctx: RulesetCombatContext, target: RulesetCombatant, reason: string): void {
  const left = rulesetLeaveShape(target);
  if (left) {
    ctx.events.push({
      type: "shaped",
      targetId: target.id,
      condition: left.condition,
      form: left.name,
      gone: true,
      reason,
    });
  }
}

/** The shape ends with the condition holding it (1.392), and ends whatever keeps that condition on. */
function endShape(ctx: RulesetCombatContext, target: RulesetCombatant, reason: "damage"): void {
  const held = target.shape?.condition;
  if (held) removeCondition(ctx, target, held, reason);
  if (target.shape) leaveShape(ctx, target, reason);
}

/** What turning an item on or off does beyond the switch (1.706): a hovering shield's slots freed or
 *  taken again, its holder's weapons' dice with them, and how long it stays on. */
function itemSwitched(holder: RulesetCombatant, index: number, on: boolean): void {
  const toggle = holder.sheet?.items?.[index]?.item.toggle;
  if (!toggle) return;
  for (const [id, damage] of Object.entries(holder.slotsFreed?.[index] ?? {})) {
    const action = holder.actions.find((one) => one.id === id);
    if (!action?.damage) continue;
    const [from, to] = on ? [damage.off, damage.on] : [damage.on, damage.off];
    // As a difference, so what else was added to the blow stays.
    action.damage.count += to.count - from.count;
    action.damage.sides = to.sides;
    action.damage.flat += to.flat - from.flat;
    if (to.reroll) action.damage.reroll = to.reroll;
    else delete action.damage.reroll;
  }
  if (on && toggle.rounds) holder.onFor = { ...(holder.onFor ?? {}), [index]: toggle.rounds };
  else if (!on && holder.onFor?.[index] !== undefined) {
    const { [index]: _gone, ...rest } = holder.onFor;
    if (Object.keys(rest).length) holder.onFor = rest;
    else delete holder.onFor;
  }
}

/** An item's switch going off by itself (1.706): its time up, or the fight over. One that freed its
 *  slots falls where there is no room for it now, in the fight. */
function switchOff(ctx: RulesetCombatContext, holder: RulesetCombatant, index: number, fight: boolean): void {
  const held = holder.sheet?.items?.[index];
  if (!held?.item.toggle || !rulesetItemOn(holder, index)) {
    itemSwitched(holder, index, false);
    return;
  }
  holder.on = { ...(holder.on ?? {}), [index]: false };
  const label = holder.actions.find((one) => one.id === `switch:${index}`)?.label ?? held.item.toggle.label;
  ctx.events.push({ type: "switch", actorId: holder.id, optionId: `switch:${index}`, label, on: false });
  itemSwitched(holder, index, false);
  if (!fight || !held.item.toggle.freesSlots) return;
  const counts = new Map((ctx.definition.items?.slots ?? []).map((slot) => [slot.id, slot.count]));
  const full = Object.entries(held.item.slots ?? {}).some(
    ([slot, count]) => count > 0 && rulesetSlotUsed(holder, slot, index) + count > (counts.get(slot) ?? 0),
  );
  if (!full) return;
  const name = held.name ?? label;
  holder.dropped = [...(holder.dropped ?? []), { key: `item:${index}`, label: name }];
  ctx.events.push({ type: "letFall", actorId: holder.id, condition: held.item.toggle.label, labels: [name] });
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
  // Held by its kind too (1.484).
  const heldOff = (condition: string) =>
    held.has(condition) ||
    !!ctx.combat.conditions?.find((one) => one.condition === condition)?.kinds?.some((kind) => held.has(kind)) ||
    // Or one it counts as (1.585).
    rulesetConditionKin(ctx.definition, condition).some((one) => held.has(one));
  const ended = rulesetCombatConditions(ctx.definition, target).filter(
    (condition) => !heldOff(condition) && rulesetImmuneToCondition(target, condition, ctx.definition, ctx.state),
  );
  for (const condition of ended) {
    if (rulesetCombatConditions(ctx.definition, target).includes(condition))
      removeCondition(ctx, target, condition, "immune");
  }
}

/** What its holder's own state ends (1.438): a condition that says its holder going down ends it,
 *  once they are down, and concentration under a condition that forbids it. 5e's Rage. */
function holderBound(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  // Or its holder coming to hold one of these (1.440): unconscious, by a blow or by Sleep.
  const held = new Set(rulesetCombatConditions(ctx.definition, target));
  for (const entry of target.tracked.filter((one) => one.endsWhenHolder?.gains?.some((id) => held.has(id)))) {
    if (target.tracked.includes(entry)) removeCondition(ctx, target, entry.condition, "spent");
  }
  for (const condition of [...held]) {
    const ends = ctx.combat.conditions?.find((rule) => rule.condition === condition)?.endsWhenHolder;
    if (ends?.gains?.some((id) => held.has(id)) && rulesetCombatConditions(ctx.definition, target).includes(condition))
      removeCondition(ctx, target, condition, "spent");
  }
  // Or its holder incapacitated (1.608): a knight's Leadership.
  if (
    (target.tracked.some((one) => one.endsWhenHolder?.incapacitated) ||
      [...held].some(
        (id) => ctx.combat.conditions?.find((rule) => rule.condition === id)?.endsWhenHolder?.incapacitated,
      )) &&
    rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) =>
      entry.effects.includes("cannot-act"),
    )
  ) {
    for (const entry of target.tracked.filter((one) => one.endsWhenHolder?.incapacitated)) {
      if (target.tracked.includes(entry)) removeCondition(ctx, target, entry.condition, "spent");
    }
    for (const condition of rulesetCombatConditions(ctx.definition, target)) {
      const ends = ctx.combat.conditions?.find((rule) => rule.condition === condition)?.endsWhenHolder;
      if (ends?.incapacitated && rulesetCombatConditions(ctx.definition, target).includes(condition))
        removeCondition(ctx, target, condition, "spent");
    }
  }
  if (!rulesetCombatStanding(target)) {
    for (const entry of target.tracked.filter((one) => one.endsWhenHolder?.downed)) {
      if (target.tracked.includes(entry)) removeCondition(ctx, target, entry.condition, "spent");
    }
    for (const condition of rulesetCombatConditions(ctx.definition, target)) {
      const ends = ctx.combat.conditions?.find((rule) => rule.condition === condition)?.endsWhenHolder;
      if (ends?.downed && rulesetCombatConditions(ctx.definition, target).includes(condition))
        removeCondition(ctx, target, condition, "spent");
    }
  }
  sensePresence(ctx, target, false);
  if (
    target.concentrating &&
    rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) => entry.forbids?.concentration)
  )
    endConcentration(ctx, target, "spent");
}

/** Which kinds a presence sense finds within its reach (1.444), said as it comes on and, with
 *  `again`, as its holder's turn starts. Nothing of where, nor how many. */
function sensePresence(ctx: RulesetCombatContext, holder: RulesetCombatant, again: boolean): void {
  const senses = holder.defeated
    ? []
    : rulesetActiveConditions(ctx.definition, ctx.combat, holder, ctx.state).flatMap((entry) =>
        entry.presence ? [{ condition: entry.condition, ...entry.presence }] : [],
      );
  const said = new Set(holder.presenceSaid ?? []);
  const now = new Set(senses.map((one) => one.condition));
  for (const sense of senses) {
    if (said.has(sense.condition) && !again) continue;
    const perCell = ctx.definition.combat?.distance?.perCell;
    const reach = perCell !== undefined ? rulesetInCells(sense.within, perCell) : Infinity;
    const kinds = new Set<string>();
    for (const one of ctx.state.combatants) {
      if (one.id === holder.id || one.defeated || !rulesetTargetIs(ctx.definition, one, sense.of)) continue;
      if (ctx.state.board?.grid && rulesetGap(holder, one) > reach) continue;
      const kind = rulesetCreatureKind(ctx.definition, one);
      for (const id of [kind.type, ...kind.tags]) {
        if (id !== undefined && (sense.of.types?.includes(id) || sense.of.tags?.includes(id))) kinds.add(id);
      }
    }
    const types = ctx.definition.combat?.creatureTypes;
    const labelOf = (id: string) =>
      types?.types.find((one) => one.id === id)?.label ?? types?.tags?.find((one) => one.id === id)?.label ?? id;
    ctx.events.push({
      type: "presence",
      actorId: holder.id,
      condition: sense.condition,
      within: sense.within,
      kinds: [...kinds].map(labelOf).sort(),
    });
  }
  if (now.size > 0) holder.presenceSaid = [...now];
  else delete holder.presenceSaid;
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
function countAttack(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  /** What it was made with, an item's remembered (1.737). */
  action?: Pick<RulesetCombatAction, "id">,
): void {
  if (!rulesetOnOwnTurn(ctx.state, combatant)) return;
  combatant.flags.attacks = (combatant.flags.attacks ?? 0) + 1;
  const item = action ? rulesetActionItemIndex(action) : undefined;
  if (item !== undefined && !combatant.flags.attackedWith?.includes(item))
    (combatant.flags.attackedWith ??= []).push(item);
}

/** A weapon's attacks given back, or less, so much of their bonus to hit and damage (1.737): a
 *  Defender's lent to its wielder's defense. */
function shiftWeaponBonus(combatant: RulesetCombatant, item: number, by: number): void {
  for (const one of combatant.actions) {
    if (one.kind !== "attack" || rulesetActionItemIndex(one) !== item) continue;
    if (one.toHit !== undefined) one.toHit += by;
    if (one.damage) one.damage = { ...one.damage, flat: one.damage.flat + by };
  }
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
    | "dispelled"
    | "freed"
    | "slipped",
  /** What ended it, where that is more than `reason` says (1.632): its source's `endsWhenSource`, or
   *  its holder no longer hearing whoever put it on. Read by `onEnd.when`. */
  cause?: "endsWhenSource" | "cantHearSource",
): void {
  if (target.dazed?.condition === condition) return;
  const removed = target.tracked.find((entry) => entry.condition === condition);
  // Already gone, with what it was put on with (1.202): a loop over a list read before that is not
  // told twice.
  if (!removed && !rulesetCombatConditions(ctx.definition, target).includes(condition)) return;
  target.tracked = target.tracked.filter((entry) => entry.condition !== condition);
  // What it kept off a block's healing, healable again (1.750). A sheet's is given back by its sheet.
  if (removed?.keptDamage && target.health && !target.sheet)
    target.health.sealed = Math.max(0, (target.health.sealed ?? 0) - removed.keptDamage);
  // What was left of it, come off before it ran out (1.616): Wind Walk's cloud, for the way back.
  if (removed?.rounds && removed.rounds > 0 && reason !== "expired")
    (target.conditionLeft ??= {})[condition] = { rounds: removed.rounds, round: ctx.state.round };
  // What lasted only while they held it ends with it, on anybody (1.553): a pin with its grapple.
  for (const one of ctx.state.combatants) {
    for (const entry of [...one.tracked]) {
      if (entry.whileHeld?.holderId !== target.id || entry.whileHeld.condition !== condition) continue;
      if (one.tracked.includes(entry)) removeCondition(ctx, one, entry.condition, "linked");
    }
  }
  // The maximum it raised falls back, and health above it with it (1.473): Heroes' Feast.
  if (removed?.raisedMax && target.health && !target.sheet) {
    target.health.value = Math.min(target.health.value, healthOf(ctx, target).max);
  }
  // The shape it held ends with it (1.392).
  if (target.shape?.condition === condition) leaveShape(ctx, target, reason);
  // Out of the sphere, nobody is carrying them (1.314).
  if (target.carriedBy && !rulesetSealed(ctx.definition, target, ctx.state)) delete target.carriedBy;
  // Out of whoever held them inside (1.403), once nothing of theirs keeps them there: still inside
  // where they have fallen and may be climbed out of (1.405).
  if (target.insideOf && !keptInside(ctx, target)) {
    if (rulesetInsideCorpse(ctx.state, target)) freeInCorpse(ctx, target);
    else letOut(ctx, target);
  }
  // What an aura put on, ended, keeps that aura off them where it says so (1.269).
  if (removed?.auraSafeOnEnd) keepOff(target, removed.auraSafeOnEnd);
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: false });
  // A spell let go of says nothing of the dead it still held: "Paralyzed ends on Bandit 2" after
  // Bandit 2 was killed reads as if it had got up.
  if (!(target.defeated && reason === "concentration"))
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
  // Whoever went into them while they held this (1.696) comes out beside them: a ghost out of the body.
  const possessor = removed?.source !== undefined ? rulesetCombatant(ctx.state, removed.source) : undefined;
  if (possessor?.away?.possessing === target.id && possessor.away.while === condition) {
    const at = rulesetPositionOf(target);
    if (at) {
      possessor.x = at.x;
      possessor.y = at.y;
    }
    bringBack(ctx, possessor, "linked");
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
  const leftBehind = ctx.combat.conditions?.find((entry) => entry.condition === condition)?.onEnd;
  // Only as it ended the ways it names (1.632): Pipes of the Sewers' day unswayed, once unheard.
  const ending = leftBehind?.when && !leftBehind.when.some((way) => way === (cause ?? reason)) ? undefined : leftBehind;
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
    conditionHarm(
      ctx,
      target,
      condition,
      removed?.source,
      { ...ending.harm, ...(ending.harm.save ? { halfOnSave: ending.harm.save } : {}) },
      1,
    );
  }
  // The last of what a concentration held on others, shaken off or ended (Hold Person's one held
  // target saving later, the other having saved at the cast): it holds nobody, so it ends, as one
  // that landed on nobody does at the cast.
  if (removed?.concentration && reason !== "concentration" && removed.source) {
    const holder = rulesetCombatant(ctx.state, removed.source);
    const holding = holder?.concentrating;
    const action =
      holding && removed.action?.includes(holding.actionId)
        ? holder!.actions.find((one) => one.id === holding.actionId)
        : undefined;
    if (action) letGoOfNothing(ctx, holder!, action);
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
      !savesHeldOff(ctx, target, tracked) &&
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
        damagedLean(ctx, target, tracked, onDamage ? undefined : rule?.saveWhenDamaged),
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
/** What damage stops working until its holder's next turn starts (1.514), not ended: a Cloak of
 *  Displacement. */
function stopConditionsOnDamage(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state)) {
    if (entry.suppressedWhenHarmed !== "until-own-turn-start") continue;
    if (!(target.harmStopped ??= []).includes(entry.condition)) target.harmStopped.push(entry.condition);
  }
}

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
  // Let out on what was dealt from inside this turn (1.405).
  if (at === "turn-end") releaseOnHurt(ctx);
  // What they made to last only so long (1.760): Creation's.
  if (at === "turn-end" && actor.madeFor) vanishMade(ctx, actor);
  // A switch that stays on only so long (1.706): an Animated Shield's minute.
  if (at === "turn-end") {
    for (const [key, left] of Object.entries(actor.onFor ?? {})) {
      if (left > 1) actor.onFor = { ...actor.onFor, [key]: left - 1 };
      else switchOff(ctx, actor, Number(key), true);
    }
  }
  // Off as its holder starts a turn unable to hear whoever put it on (1.618): the Pipes of the
  // Sewers' hold on a swarm that can't hear their music.
  if (at === "turn-start") unheardSources(ctx, actor);
  // What this one put on others that runs on their turns.
  for (const holder of ctx.state.combatants) {
    // The fallen are left as they fell: what is on them neither harms, is saved against nor runs out.
    // One only sent away still counts the time until it comes back.
    if (holder.id === actor.id || (holder.defeated && !holder.away)) continue;
    // Held out of time (1.647): nothing else on them runs, but what holds them there.
    const stasis = rulesetStasis(ctx.definition, holder, ctx.state);
    for (const entry of [...holder.tracked]) {
      if (stasis && entry.condition !== stasis) continue;
      // What it harms them with as this one's turn starts or ends (1.403): a gelatinous cube's acid.
      if (entry.source === actor.id) harmFromCondition(ctx, holder, entry, `source-${at}`);
      if (!holder.tracked.includes(entry)) continue;
      // Its save, made as this one's turn starts (1.483): Prismatic Spray's Violet ray.
      if (
        at === "turn-start" &&
        entry.source === actor.id &&
        entry.saveEnds?.at === "source-turn-start" &&
        entry.difficulty !== undefined &&
        !holder.defeated &&
        !savesHeldOff(ctx, holder, entry)
      ) {
        const saved = rollSave(
          ctx,
          holder,
          entry.saveEnds.save,
          entry.difficulty,
          entry.source,
          undefined,
          { conditions: [entry.condition], ...(entry.action ? { action: entry.action } : {}) },
          leanInSight(ctx, holder, entry),
        );
        if (savedAgainst(ctx, holder, entry, saved)) continue;
      }
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
    if (
      entry.saveEnds?.at === at &&
      entry.difficulty !== undefined &&
      !savesHeldOff(ctx, actor, entry) &&
      saveOutOfSight(ctx, actor, entry)
    ) {
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
    // Its time drawn from an item's charges (1.623): gone with the last of them.
    if (drawItemCharge(ctx, actor, entry)) continue;
    entry.rounds -= 1;
    if (entry.rounds <= 0) removeCondition(ctx, actor, entry.condition, "expired");
  }
}

/** A round of a condition kept up by an item's charges (1.623), spent as its clock counts one down:
 *  true once that was the last and it has come off. The Boots of Speed's 10 minutes, kept across
 *  uses. */
function drawItemCharge(ctx: RulesetCombatContext, holder: RulesetCombatant, entry: RulesetTrackedCondition): boolean {
  const user = entry.source ? rulesetCombatant(ctx.state, entry.source) : holder;
  const action = entry.action ? user?.actions.find((one) => one.id === entry.action![0]) : undefined;
  const charges = action?.itemUse?.charges;
  if (!user || !action?.chargesPerRound || !charges) return false;
  const now = Math.max(0, rulesetItemChargesLeft(user, { max: charges.max, item: action.itemUse!.item }) - 1);
  (user.charges ??= {})[action.itemUse!.item] = now;
  if (now > 0) return false;
  removeCondition(ctx, holder, entry.condition, "expired");
  return true;
}

/** What comes off its holder by being far enough from whoever put it on, and out of their sight
 *  where it says so (1.310): Eyebite's panic. Anybody's walk may part them, the putter's own too. */
function endsAway(ctx: RulesetCombatContext, turnEnder?: RulesetCombatant): void {
  const perCell = ctx.definition.combat?.distance?.perCell;
  if (!ctx.state.board?.grid || perCell === undefined) return;
  for (const holder of ctx.state.combatants) {
    for (const entry of holder.tracked.filter((one) => one.endsAway && one.source)) {
      const source = rulesetCombatant(ctx.state, entry.source!);
      // Far OR out of sight (1.433), asked only as its holder ends a turn.
      if (entry.endsAway!.orUnseen) {
        if (turnEnder?.id !== holder.id) continue;
        const far = !source || rulesetGap(holder, source) > rulesetInCells(entry.endsAway!.beyond, perCell);
        if (!far && rulesetCanSee(ctx.definition, ctx.state, holder, source!)) continue;
        if (holder.tracked.includes(entry)) removeCondition(ctx, holder, entry.condition, "spent");
        continue;
      }
      if (source && rulesetGap(holder, source) <= rulesetInCells(entry.endsAway!.beyond, perCell)) continue;
      if (source && entry.endsAway!.unseen && rulesetCanSee(ctx.definition, ctx.state, holder, source)) continue;
      if (holder.tracked.includes(entry)) removeCondition(ctx, holder, entry.condition, "spent");
    }
  }
}

/** Whoever made an attack at a foe, or took damage, in what this step has done so far (1.436). */
function noteStirred(ctx: RulesetCombatContext): void {
  const from = ctx.stirredAt ?? 0;
  ctx.stirredAt = ctx.events.length;
  for (const event of ctx.events.slice(from)) {
    if (event.type === "attack") {
      const actor = rulesetCombatant(ctx.state, event.actorId);
      const target = rulesetCombatant(ctx.state, event.targetId);
      if (actor && target && actor.side !== target.side) actor.stirred = true;
    } else if (event.type === "damage" && (event.dealt > 0 || event.toTemp > 0)) {
      const target = rulesetCombatant(ctx.state, event.targetId);
      if (target) target.stirred = true;
    }
  }
}

/** What ends as its holder ends a turn with nothing done to stir it (1.436): Rage, unless what keeps
 *  it on says otherwise. Whatever they did is forgotten for the next turn. */
function endsIdle(ctx: RulesetCombatContext, leaving: RulesetCombatant): void {
  noteStirred(ctx);
  const stirred = !!leaving.stirred;
  delete leaving.stirred;
  if (stirred) return;
  for (const entry of [...leaving.tracked]) {
    const idle = ctx.combat.conditions?.find((rule) => rule.condition === entry.condition)?.endsIdle;
    if (!idle) continue;
    if (typeof idle === "object") {
      const value = rulesetSheetValue(ctx.definition, leaving, idle.unless.value);
      if (
        value !== undefined &&
        (idle.unless.atLeast === undefined || value >= idle.unless.atLeast) &&
        (idle.unless.atMost === undefined || value <= idle.unless.atMost)
      )
        continue;
    }
    if (leaving.tracked.includes(entry)) removeCondition(ctx, leaving, entry.condition, "spent");
  }
}

/** Whether a save that ends a condition may be rolled now: one rolled only out of its putter's
 *  sight waits while its holder can see them (1.266), Fear's. */
/** Whether a condition's save is kept from being rolled now (1.651): its holder holds one of its
 *  `savesUnless`. Dust of Sneezing and Choking, saved against only while conscious. */
function savesHeldOff(ctx: RulesetCombatContext, holder: RulesetCombatant, entry: RulesetTrackedCondition): boolean {
  const unless = ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.savesUnless;
  if (!unless) return false;
  const held = rulesetActiveConditions(ctx.definition, ctx.combat, holder, ctx.state).map((one) => one.condition);
  return unless.some((id) => held.includes(id));
}

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
/** How a save on damage leans (1.712): the condition's own lean, and the lean of its maker in sight;
 *  the two of them opposite, neither. */
function damagedLean(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetTrackedCondition,
  rule: true | { lean: "advantage" | "disadvantage" } | undefined,
): "advantage" | "disadvantage" | undefined {
  const seen = leanInSight(ctx, holder, entry);
  const own = typeof rule === "object" ? rule.lean : undefined;
  if (!own) return seen;
  return seen && seen !== own ? undefined : own;
}

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
/** What its holder threw off, counted against whoever put it on with what. */
function noteShookOff(holder: RulesetCombatant, entry: RulesetTrackedCondition): void {
  const actionId = entry.action?.[0];
  if (!entry.source || !actionId || entry.source === holder.id) return;
  const key = `${entry.source}/${actionId}`;
  holder.shookOff = { ...holder.shookOff, [key]: (holder.shookOff?.[key] ?? 0) + 1 };
}

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
    noteShookOff(holder, entry);
    return true;
  }
  if (!ends.failures) return false;
  entry.fails = (entry.fails ?? 0) + 1;
  if (entry.fails < ends.failures.count) return false;
  removeCondition(ctx, holder, entry.condition, "worsened");
  // Or out of the fight for good, alive (1.483): Violet's other plane.
  if (ends.failures.dismisses) {
    const label =
      entry.action?.[1] ??
      ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ??
      entry.condition;
    sendAway(ctx, entry.source ?? holder.id, holder, label);
    return true;
  }
  const becomes = ends.failures.becomes!;
  applyConditionId(
    ctx,
    holder,
    becomes,
    { condition: becomes, duration: "instant" },
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
      if (!ends || ends.at === "damaged" || ends.at === "days" || entry.difficulty === undefined) continue;
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

/** What a condition deals its holder as they attack whoever put it on, or their side (1.562), once
 *  while it holds where it says: Geas. */
function harmForDefiance(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
): void {
  if (
    !ctx.combat.conditions?.some((one) => one.harms?.at === "attacks-source" || one.harms?.at === "attacks-source-side")
  )
    return;
  if (!rulesetIsAttack(action) && !action.damage) return;
  for (const entry of [...actor.tracked]) {
    const harms = ctx.combat.conditions.find((one) => one.condition === entry.condition)?.harms;
    if (!harms || (harms.at !== "attacks-source" && harms.at !== "attacks-source-side")) continue;
    if (harms.once && entry.harmedOnce) continue;
    const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
    if (!source) continue;
    const defied = targets.some(
      (one) =>
        one.id !== actor.id &&
        (one.id === source.id || (harms.at === "attacks-source-side" && one.side === source.side)),
    );
    if (!defied || actor.defeated) continue;
    if (harms.once) entry.harmedOnce = true;
    harmFromCondition(ctx, actor, entry, harms.at);
  }
}

/** What a condition deals its holder as they cast from its catalogs (1.646), for each level it was
 *  cast at where it says, and past every resistance where it says: Wish's stress. */
function harmForCasting(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  payWith: string | undefined,
): void {
  const catalog = action.catalog ?? action.casts;
  if (catalog === undefined || !ctx.combat.conditions?.some((one) => one.harms?.at === "casts")) return;
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state)) {
    const harms = entry.harms;
    if (harms?.at !== "casts" || !harms.catalogs?.includes(catalog) || actor.defeated) continue;
    const times = harms.perLevel ? rulesetPaidLevel(ctx.definition, actor, action, payWith) : 1;
    if (times < 1) continue;
    const dice = harms.dice ? parseRulesetCombatDice(harms.dice) : null;
    const rolls = dice ? rollRulesetDice(ctx.roll, dice.count * times, dice.sides) : [];
    const flat = ((dice?.flat ?? 0) + (harms.flat ?? 0)) * times;
    const dealt = applyDamage(ctx, actor, {
      sourceId: actor.id,
      label: ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition,
      ...(harms.type ? { damageType: harms.type } : {}),
      rolls,
      flat,
      amount: sumOf(rolls) + flat,
      ...(harms.unblockable ? { unblockable: true as const } : {}),
    });
    afterBlow(ctx, actor, dealt, false);
  }
}

/** What breaking a condition's command deals its holder (1.644), once the choice that broke it is
 *  done, once while it holds where it says: 5e's Geas. */
function harmForBreaking(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  step: RulesetCombatStep,
  actorId: string,
  conditions: readonly string[],
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const { ctx, finish } = begin(definition, combat, step.state, roller);
  const actor = rulesetCombatant(ctx.state, actorId);
  for (const entry of [...(actor?.tracked ?? [])]) {
    if (!actor || !conditions.includes(entry.condition) || actor.defeated) continue;
    const harms = combat.conditions?.find((one) => one.condition === entry.condition)?.harms;
    if (harms?.at !== "defies" || (harms.once && entry.harmedOnce)) continue;
    if (harms.once) entry.harmedOnce = true;
    harmFromCondition(ctx, actor, entry, "defies");
  }
  const after = finish();
  return { state: after.state, events: [...step.events, ...after.events] };
}

/** A condition's own harm as a turn starts or ends (1.189), from whoever put it on. */
function harmFromCondition(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetTrackedCondition,
  at: RulesetConditionHarms["at"],
): void {
  const harms = ctx.combat.conditions?.find((one) => one.condition === entry.condition)?.harms;
  if (!harms || harms.at !== at || holder.defeated) return;
  // Not while it is held off (1.714): a vampire's running water away from water, sunlight in the dark.
  if (
    at !== "defies" &&
    !rulesetActiveConditions(ctx.definition, ctx.combat, holder, ctx.state).some(
      (one) => one.condition === entry.condition,
    )
  )
    return;
  const dice = harms.dice ? parseRulesetCombatDice(harms.dice) : null;
  // Spared this time by a save (1.403): a shambling mound's engulfed.
  if (harms.save) {
    const difficulty = harms.save.difficulty ?? entry.difficulty;
    if (difficulty !== undefined && rollSave(ctx, holder, harms.save.save, difficulty, entry.source)) {
      // Each save takes some of its dice off for good (1.635), and with none left it is over: a
      // Potion of Poison.
      const drops = harms.save.drops ? parseRulesetCombatDice(harms.save.drops) : null;
      if (drops && dice) {
        entry.harmDropped = (entry.harmDropped ?? 0) + drops.count;
        if (entry.harmDropped >= dice.count && holder.tracked.includes(entry))
          removeCondition(ctx, holder, entry.condition, "save");
      }
      return;
    }
  }
  // What its saves have taken off (1.635).
  const left =
    entry.harmDropped && dice
      ? {
          ...harms,
          dice: `${Math.max(0, dice.count - entry.harmDropped)}d${dice.sides}${dice.flat ? `+${dice.flat}` : ""}`,
        }
      : harms;
  conditionHarm(ctx, holder, entry.condition, entry.source, left, entry.stacks ?? 1, entry.harmsMore);
}

/** What a condition deals its holder, from whoever put it on: as a turn starts or ends (1.189), or
 *  as it ends (1.245). */
function conditionHarm(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  condition: string,
  source: string | undefined,
  harms: {
    dice?: string;
    flat?: number;
    type?: string;
    healedOnlyByRest?: true;
    /** An ending's save for half (1.751), thrown as it is dealt. */
    halfOnSave?: { save: string; difficulty: number };
  },
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
  // Saved against for half (1.751): Midnight tears' DC 17 Constitution.
  if (harms.halfOnSave && rollSave(ctx, holder, harms.halfOnSave.save, harms.halfOnSave.difficulty, source))
    harm.amount = Math.floor(harm.amount / 2);
  const dealt = applyDamage(ctx, holder, {
    ...(source ? { sourceId: source } : {}),
    label,
    ...(harms.type ? { damageType: harms.type } : {}),
    ...harm,
    ...(harms.healedOnlyByRest ? { seals: true as const } : {}),
    // Kept off healing while it holds (1.750): Pale tincture. Dealt as it ends, there is nothing left to
    // keep it.
    ...(holder.tracked.some((one) => one.condition === condition) &&
    ctx.combat.conditions?.some((one) => one.condition === condition && one.keepsDamage)
      ? { keptBy: condition }
      : {}),
  });
  afterBlow(ctx, holder, dealt, false);
  // Let go once it has dealt its most in all (1.676): a stirge full of blood.
  const most = ctx.combat.conditions?.find((one) => one.condition === condition)?.attaches?.endsAfterHarm;
  const entry =
    most !== undefined ? holder.tracked.find((one) => one.condition === condition && one.source === source) : undefined;
  if (entry && most !== undefined) {
    entry.harmedTotal = (entry.harmedTotal ?? 0) + dealt;
    if (entry.harmedTotal >= most) removeCondition(ctx, holder, condition, "spent");
  }
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

/** Each summons of theirs that strikes by itself (1.539), as their turn starts: its entry's attack at
 *  the nearest creature hostile to them within its reach of where it stands (anybody hostile off a
 *  board), never held for an answer. One with nobody near does nothing. */
function summonsStrike(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  for (const summon of actor.summons ?? []) {
    if (!summon.strikesAtTurnStart || summon.rounds <= 0) continue;
    const action = actor.actions.find((entry) => entry.id === summon.actionId);
    if (!action) continue;
    const foes = ctx.state.combatants.filter(
      (one) => one.side !== actor.side && rulesetCombatStanding(one) && !one.defeated && !one.turnless,
    );
    const from = summon.at;
    const near = from
      ? foes
          .flatMap((one) => {
            const at = rulesetPositionOf(one);
            const far = at ? rulesetCellDistance(from, at) : Number.POSITIVE_INFINITY;
            return far <= (summon.reach ?? 1) ? [{ one, far }] : [];
          })
          .sort((a, b) => a.far - b.far)
          .map(({ one }) => one)
      : ctx.state.board
        ? []
        : foes;
    const target = near[0];
    if (!target) continue;
    ctx.events.push({ type: "summon", actorId: actor.id, label: summon.label, outcome: "struck" });
    ctx.summonStriking = true;
    try {
      resolveAction(ctx, actor, action, [target], summon.payWith);
    } finally {
      delete ctx.summonStriking;
    }
  }
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
    // Its caster gone, one that outlasts them stays (1.456).
    if (actionId === undefined && actor.actions.find((entry) => entry.id === zone.actionId)?.zone?.outlasts) {
      return true;
    }
    ended.push(zone);
    return false;
  });
  if (actor.zones.length === 0) delete actor.zones;
  // Off the board before it goes off (1.183), so nothing its blast sets moving can end it twice.
  for (const zone of ended) {
    // Gone off and staying as what it becomes (1.453): back on the board.
    if (detonate(ctx, actor, zone)) {
      actor.zones = [...(actor.zones ?? []), zone];
      continue;
    }
    ctx.events.push({ type: "zone", actorId: actor.id, label: zone.label, outcome: "ended" });
  }
}

/** A burst that widens as it lasts (1.637), by its `spreads` every so many of its caster's turns to its
 *  most, never once closed: one held at a point laid again around where it was put. */
function spreadZone(ctx: RulesetCombatContext, caster: RulesetCombatant, zone: RulesetCombatZone): void {
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  const rule = action?.zone?.spreads;
  if (!rule || !action?.area || zone.closed) return;
  const size = action.area.size + (zone.widened ?? 0);
  if (size >= rule.upTo) return;
  zone.spreadTurns = (zone.spreadTurns ?? 0) + 1;
  if (zone.spreadTurns < rule.every) return;
  zone.spreadTurns = 0;
  zone.widened = Math.min(rule.upTo, size + rule.by) - action.area.size;
  const grid = ctx.state.board?.grid;
  if (zone.anchor === "point" && zone.at && grid) {
    const cells = new Map<string, RulesetCombatCell>();
    for (const middle of [zone.at, ...(zone.also ?? [])]) {
      for (const cell of rulesetAreaCells("burst", action.area.size + zone.widened, middle, middle, grid))
        cells.set(`${cell.x},${cell.y}`, cell);
    }
    zone.cells = [...cells.values()];
  }
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "spread" });
}

/** A zone that goes off as it ends (1.183): the entry's own effect, once, on everybody in it, with
 *  what it has grown by added to its amount. Its caster's, though they may be down by now. Whether it
 *  stays, as what it `becomes` (1.453). */
function detonate(ctx: RulesetCombatContext, caster: RulesetCombatant, zone: RulesetCombatZone): boolean {
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  const rule = action?.zone?.detonates;
  // Once gone off and stayed (1.453), its time running out just ends it.
  if (!action || !rule || zone.became) return false;
  // Set off only by somebody entering it (1.451): its time running out just ends it.
  if (rule.entered && !zone.tripped) return false;
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "detonated" });
  // A spell glyph (1.454): what it stores, cast at whoever set it off, in place of its own effect.
  const stored = zone.stored ? caster.actions.find((entry) => entry.id === zone.stored) : undefined;
  if (stored) {
    castStored(ctx, caster, zone, stored);
    return false;
  }
  const middle = zone.at;
  const ids = !ctx.state.board?.grid
    ? (zone.held ?? [])
    : rule.within !== undefined && middle
      ? // Everybody within its reach of its middle (1.451): Symbol's sphere.
        ctx.state.combatants
          .filter(
            (one) => rulesetZoneCatches(caster, zone, action, one) && rulesetDistanceTo(middle, one) <= rule.within!,
          )
          .map((one) => one.id)
      : rulesetZoneOccupants(ctx.state, caster, zone, action);
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
  // It stays (1.453): a burst of its own around its middle, for its own rounds, striking at its own
  // triggers. Symbol's sphere.
  const becomes = rule.becomes;
  if (!becomes) return false;
  zone.became = true;
  delete zone.tripped;
  zone.rounds = becomes.rounds;
  zone.triggers = [...becomes.triggers];
  const grid = ctx.state.board?.grid;
  if (grid && middle) zone.cells = rulesetAreaCells("burst", becomes.size, middle, middle, grid);
  else zone.held = targets.map((one) => one.id);
  return true;
}

/** An entry stored instead of done (1.524): in a place its option offers, at the level it is paid at,
 *  which must be the first or higher and fit the room left there. Paid for, and its budget spent, as
 *  a cast is; it does nothing now. */
function storeChoice(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const asked = choice.storesIn;
  const place =
    asked && typeof asked === "object"
      ? option.storesIn?.find((one) => one.holderId === asked.holderId && one.item === asked.item)
      : undefined;
  if (!place || choice.targetIds.length > 0) return refusal(state, choice.actorId, "bad-target", option.id);
  if (choice.payWith !== undefined && !(option.payWith ?? []).includes(choice.payWith)) {
    return refusal(state, choice.actorId, "bad-pool", option.id);
  }
  const { ctx, finish } = begin(definition, combat, state, roller);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const holder = rulesetCombatant(ctx.state, place.holderId);
  const action = working.actions.find((entry) => entry.id === option.id);
  if (!holder || !action) return refusal(state, choice.actorId, "bad-target", option.id);
  const level = rulesetPaidLevel(definition, working, action, choice.payWith);
  if (level < 1 || level > place.room) return refusal(state, choice.actorId, "insufficient", option.id);
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith);
  if (!paid) return refusal(state, choice.actorId, "insufficient", option.id);
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  // Out of a worn item's charges (1.572).
  if (paid.itemCharges) (working.charges ??= {})[paid.itemCharges.item] = paid.itemCharges.now;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({
      type: "spend",
      actorId: working.id,
      pool: entry.pool,
      label: entry.label,
      amount: entry.amount,
      // On what, so a cast line names its spell (laptop pass 6 2026-10-26: "spends 1 1st-level slots").
      on: action.label,
    });
  }
  spendAvailability(ctx, working, action);
  if (!storeInto(ctx, working, action, holder, place.item, level)) {
    return refusal(state, choice.actorId, "bad-target", option.id);
  }
  noteOutcome(ctx);
  return finish();
}

/** An entry its caster has paid for, stored in `holder`'s item at `item`, or in `holder` itself when
 *  it is a creature that stores (1.524): to be cast from there once, at `level`, with the caster's
 *  numbers. False when its entry cannot be read. */
function storeInto(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  action: RulesetCombatAction,
  holder: RulesetCombatant,
  item: number | undefined,
  level: number,
): boolean {
  const entry = action.entry
    ? rulesetCatalogEntriesByRef({
        ...Object.fromEntries((ctx.definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
        ...(caster.sheet?.catalogs ?? {}),
      }).get(action.entry)
    : undefined;
  if (!entry || !action.entry) return false;
  const record = {
    entry: action.entry,
    label: entry.label,
    level,
    ...(action.save ? { saveDifficulty: action.save.difficulty } : {}),
    ...(action.toHit !== undefined ? { toHit: action.toHit } : {}),
  };
  const build = holder.sheet?.build ?? holder.block?.sheet ?? rulesetSheetBuildSchema.parse({});
  const evaluated = evaluateRulesetSheetLive(ctx.definition, build, holder.sheet?.live ?? {}, holder.sheet?.items);
  const count = (holder.storedCount ?? 0) + 1;
  const by = item !== undefined ? (holder.sheet?.items?.[item]?.name ?? "") : holder.name;
  const stored = rulesetStoredAction(
    ctx.definition,
    entry,
    record,
    item,
    by,
    `stored:${item ?? "self"}:+${count}`,
    build,
    evaluated,
    ctx.combat.distance?.perCell,
  );
  if (!stored) return false;
  holder.storedCount = count;
  holder.actions.push(stored);
  holder.uses[stored.id] = 1;
  ctx.events.push({ type: "stored", actorId: caster.id, holderId: holder.id, label: action.label, by, level });
  return true;
}

/** A spell glyph's stored entry, cast as it goes off (1.454): at whoever set it off, or, for one with
 *  an area, at everybody it reaches centred on them. Paid for as the glyph was cast, so it costs
 *  nothing now; whatever it would hold its caster's concentration for lasts its full time. */
function castStored(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  stored: RulesetCombatAction,
): void {
  const trigger = zone.trippedBy ? rulesetCombatant(ctx.state, zone.trippedBy) : undefined;
  if (!trigger || !rulesetCombatStanding(trigger)) return;
  const { concentration: _held, zone: _zone, summons: _summons, gives: _gives, ...again } = stored;
  const grid = ctx.state.board?.grid;
  const at = rulesetPositionOf(trigger);
  const area = again.area;
  const cells = grid && at && area ? rulesetAreaCells("burst", area.size, at, at, grid) : undefined;
  const targets = cells
    ? ctx.state.combatants.filter((one) => rulesetCombatStanding(one) && rulesetZoneHoldsOne(cells, one))
    : [trigger];
  const aimed = ctx.aimedAt;
  const aimedAlso = ctx.aimedAlso;
  delete ctx.aimedAlso;
  if (at) ctx.aimedAt = { x: at.x, y: at.y };
  else delete ctx.aimedAt;
  const byZone = ctx.byZone;
  ctx.byZone = true;
  resolveAction(ctx, caster, again, targets, undefined);
  if (byZone) ctx.byZone = byZone;
  else delete ctx.byZone;
  if (aimed) ctx.aimedAt = aimed;
  else delete ctx.aimedAt;
  if (aimedAlso) ctx.aimedAlso = aimedAlso;
}

/** Every obscuring zone a wind reaches, where it is `dispersed`, blown away (1.286): 5e's Gust of
 *  Wind on a Fog Cloud, as the gust appears, moves or turns, and as anybody carrying either moves.
 *  One dispersed only `after` a while (1.289) goes once a wind has reached it that many whole
 *  rounds running: 5e's Stinking Cloud. */
function disperseFogs(ctx: RulesetCombatContext): void {
  if (!ctx.state.board?.grid) return;
  // A wind, or a stage of one that is a wind now (1.580).
  const winds = rulesetStandingZones(ctx.state).filter(
    ({ action, zone }) =>
      action.zone?.disperses || (zone.stage !== undefined && action.zone?.stages?.[zone.stage]?.disperses),
  );
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
  // A wind reaching a layered wall (1.490): the orange layer.
  if (blown.size > 0) {
    for (const { caster, zone, action, cells } of rulesetStandingLayers(ctx.state)) {
      if (cells.some((cell) => blown.has(`${cell.x},${cell.y}`))) {
        wearLayer(ctx, caster, zone, action, { wind: true }, undefined, false);
      }
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
    if (!rulesetZoneLights(zone, action) || !caster.zones?.includes(zone)) continue;
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

/** Whom a layered wall spares (1.490): its caster, or their whole side. */
function layersSpare(
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  layers: NonNullable<RulesetCombatZoneRule["layers"]>,
  one: RulesetCombatant,
): boolean {
  const spares = layers.spares;
  if (!spares) return false;
  if (spares === "allies") return one.side === caster.side;
  // Its caster and those they picked as it was cast (1.492).
  return one.id === caster.id || (typeof spares === "object" && !!zone.spared?.includes(one.id));
}

/** The damage of each type a stand-in took since `from` (1.490), before its lines leave the log. */
function dealtByType(ctx: RulesetCombatContext, from: number, id: string): Map<string, number> {
  const dealt = new Map<string, number>();
  for (const event of ctx.events.slice(from)) {
    if (event.type !== "damage" || event.targetId !== id || !event.damageType) continue;
    const type = event.damageType.trim().toLowerCase();
    dealt.set(type, (dealt.get(type) ?? 0) + event.dealt);
  }
  return dealt;
}

/** What reached a layered wall (1.490): its first standing layer, and only that one, is destroyed
 *  when this is what its `endedBy` names; the wall ends with its last. `tell` says a layer that held. */
function wearLayer(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  by: { damage?: Map<string, number>; entry?: string; wind?: true },
  byId?: string,
  tell = true,
): void {
  const rows = action.zone?.layers?.rows;
  if (!rows || !caster.zones?.includes(zone)) return;
  const row = rows[zone.layersGone ?? 0];
  if (!row) return;
  const ended = row.endedBy;
  const damage = ended?.damage;
  const gone =
    (!!ended?.wind && !!by.wind) ||
    (by.entry !== undefined && !!ended?.entries?.includes(by.entry)) ||
    (!!damage &&
      !!by.damage &&
      damage.types.reduce((total, type) => total + (by.damage!.get(type.trim().toLowerCase()) ?? 0), 0) >=
        damage.atLeast);
  if (!gone && !tell) return;
  ctx.events.push({
    type: "zone",
    actorId: caster.id,
    label: zone.label,
    outcome: gone ? "layer-gone" : "layer-held",
    layer: row.label,
    ...(byId ? { targetId: byId } : {}),
  });
  if (!gone) return;
  zone.layersGone = (zone.layersGone ?? 0) + 1;
  if (zone.layersGone >= rows.length) spendZone(ctx, caster, zone);
}

/** Every layered wall these cells reach, worn by what reached them (1.490). */
function wearLayersAt(
  ctx: RulesetCombatContext,
  cells: RulesetCombatCell[],
  by: { entry?: string; wind?: true },
  byId?: string,
): void {
  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  for (const { caster, zone, action, cells: own } of rulesetStandingLayers(ctx.state)) {
    if (own.some((cell) => keys.has(`${cell.x},${cell.y}`))) wearLayer(ctx, caster, zone, action, by, byId, false);
  }
}

/** Whether somebody stands within a layered wall's flash (1.490). */
function flashNear(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  one: RulesetCombatant,
): boolean {
  const flash = action.zone?.layers?.flash;
  if (!flash || !ctx.state.board?.grid || one.defeated || !rulesetPositionOf(one)) return false;
  return rulesetZoneCells(ctx.state, caster, zone).some((cell) => rulesetDistanceTo(cell, one) <= flash.within);
}

/** A layered wall's flash on somebody near it who sees it (1.490): its save at the entry's own
 *  difficulty, or what it puts on. Prismatic Wall's blinding. */
function flashOne(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  one: RulesetCombatant,
): void {
  const layers = action.zone?.layers;
  const flash = layers?.flash;
  if (!layers || !flash || !rulesetCombatStanding(one) || one.object || layersSpare(caster, zone, layers, one)) return;
  const cells = rulesetZoneCells(ctx.state, caster, zone);
  // Seen as it shines, whatever it hides behind it (1.492): its own murk is no veil over itself.
  const view: RulesetEncounterState = {
    ...ctx.state,
    combatants: ctx.state.combatants.map((other) =>
      other.id === caster.id ? { ...other, zones: (other.zones ?? []).filter((own) => own !== zone) } : other,
    ),
  };
  if (!cells.some((cell) => rulesetSeesCell(ctx.definition, view, one, cell))) return;
  const difficulty = action.save?.difficulty ?? action.saveDifficulty ?? 10;
  if (rollSave(ctx, one, flash.save, difficulty, caster.id)) return;
  for (const applies of flash.applies) {
    applyConditionId(ctx, one, applies.condition, applies, {
      sourceId: caster.id,
      difficulty,
      action: [action.id, action.label],
      ...(action.concentration && caster.concentrating?.actionId === action.id ? { concentration: true } : {}),
      ...(action.catalog ? { catalog: action.catalog } : {}),
    });
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

/** A turn begun under water (1.498): one more of the turns they hold their breath for, then of those
 *  they last without it, and as the next starts they drop to 0. Out of the water, their breath is back.
 *  Whoever breathes only water (1.512) holds it out of the water instead. */
function holdBreath(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const breath = ctx.combat.underwater?.breath;
  if (!breath) return;
  const exempt =
    breath.exempt?.conditions?.some((id) => rulesetCombatConditions(ctx.definition, actor).includes(id)) ||
    (!!breath.exempt?.tags && rulesetTargetIs(ctx.definition, actor, { tags: breath.exempt.tags }));
  const waterOnly = !!breath.waterOnly && rulesetTargetIs(ctx.definition, actor, { tags: breath.waterOnly.tags });
  const under = rulesetUnderwater(ctx.definition, ctx.state, actor);
  // Choking wherever they are (1.651): Dust of Sneezing and Choking.
  const choking = rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state).some(
    (entry) => entry.suffocates,
  );
  if ((!choking && (waterOnly ? under : !under)) || exempt || actor.defeated || actor.down) {
    delete actor.breath;
    return;
  }
  const span = (rule: typeof breath.holds) => {
    const score =
      actor.sheet?.build.abilities?.[rule.perMod?.ability ?? ""] ??
      actor.block?.abilities?.[rule.perMod?.ability ?? ""];
    const mod = rule.perMod && typeof score === "number" ? rulesetAbilityModifier(ctx.definition, score) : 0;
    return Math.max(rule.atLeast ?? 0, rule.rounds + (rule.perMod ? mod * rule.perMod.rounds : 0));
  };
  const now = actor.breath ?? { held: span(breath.holds) };
  if (now.held > 0) {
    now.held -= 1;
    if (now.held === 0) now.lasts = span(breath.then);
  } else if ((now.lasts ?? 0) > 0) now.lasts! -= 1;
  else {
    delete actor.breath;
    ctx.events.push({ type: "breath", actorId: actor.id, held: 0, lasts: 0 });
    dropToNothing(ctx, actor, actor.id, "Out of breath");
    return;
  }
  actor.breath = now;
  ctx.events.push({ type: "breath", actorId: actor.id, held: now.held, lasts: now.lasts ?? 0 });
}

/** Whoever walks into a cell on a tile their `harmedEntering` names takes what it says, with no save
 *  (1.708): a fire elemental's 1 cold for each 5 feet it moves in water. */
function harmedEntering(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const rule = actor.harmedEntering;
  const grid = ctx.state.board?.grid;
  if (!rule || !grid || !rulesetCombatStanding(actor)) return;
  const covered = rulesetFootprint(actor);
  const keys = new Set(covered.map((cell) => `${cell.x},${cell.y}`));
  const on =
    covered.some((cell) => {
      const tile = grid.tiles[cell.y]?.[cell.x];
      return tile !== undefined && rule.terrain.includes(tile);
    }) ||
    (rule.zones.length > 0 &&
      rulesetStandingZones(ctx.state).some(
        ({ caster, zone, action }) =>
          [action.id, action.label].some((name) => rule.zones.includes(name.trim().toLowerCase())) &&
          rulesetZoneCells(ctx.state, caster, zone).some((cell) => keys.has(`${cell.x},${cell.y}`)),
      ));
  if (!on) return;
  const harm = rule.harm;
  const thrown = rulesetCombatIsPool(ctx.combat)
    ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
        throwHarm(ctx, actor, harm, harm.damageType, 0),
      )
    : (() => {
        const rolls = rollRulesetDice(ctx.roll, harm.count, harm.sides);
        return { rolls, flat: harm.flat, amount: sumOf(rolls) + harm.flat };
      })();
  const dealt = applyDamage(ctx, actor, {
    label: "Moving where it is harmed",
    ...(harm.damageType ? { damageType: harm.damageType } : {}),
    ...thrown,
  });
  afterBlow(ctx, actor, dealt, false);
}

/** Whoever walks through solid ground and ends a turn of theirs inside it takes what it says, with
 *  no save (1.495): a ghost's 1d10 force. */
function insideGround(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const harm = actor.passesObjects?.harm;
  const grid = ctx.state.board?.grid;
  if (!harm || !grid || !rulesetCombatStanding(actor)) return;
  if (!rulesetFootprint(actor).some((cell) => rulesetThroughSolid(grid, cell.x, cell.y, actor))) return;
  const thrown = rulesetCombatIsPool(ctx.combat)
    ? (({ rolls, flat, total, pool }) => ({ rolls, flat, amount: total, pool }))(
        throwHarm(ctx, actor, harm, harm.damageType, 0),
      )
    : (() => {
        const rolls = rollRulesetDice(ctx.roll, harm.count, harm.sides);
        return { rolls, flat: harm.flat, amount: sumOf(rolls) + harm.flat };
      })();
  const dealt = applyDamage(ctx, actor, {
    label: "Inside solid ground",
    ...(harm.damageType ? { damageType: harm.damageType } : {}),
    ...thrown,
  });
  afterBlow(ctx, actor, dealt, false);
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
      ? action.around && (action.onDeath || !action.area)
        ? // Left as its maker dies (1.540), or a burst centred on it (1.282): around every cell it
          // fills, as nobody aimed it. A kraken's Ink Cloud, bought between turns.
          rulesetAroundCells(actor, action.around, grid)
        : areaCellsFor(ctx.state, actor, action.id, at, resume.also ? { also: resume.also } : undefined)
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
    // Laid as a ring (1.603), so what it rings is inside it.
    ...(wall && action.area?.ring && (resume.ring === true || action.area.ringOnly) ? { ringed: true as const } : {}),
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
    // Whom it works on inside, chosen as it was cast (1.466).
    ...(rule.inside?.chooses && resume.mode
      ? (() => {
          const kind = action.modes?.find((one) => one.id === resume.mode)?.insideType;
          return kind ? { insideIs: { types: [kind] } } : {};
        })()
      : {}),
    // Whom its caster picked for it to spare (1.492).
    ...(rule.layers?.spares && typeof rule.layers.spares === "object"
      ? { spared: [...(resume.designates ?? [])] }
      : {}),
    // The kinds it strikes and the damage type it deals, named as it was cast (1.753).
    ...(action.kindsOf && resume.kinds?.length ? { strikesIs: chosenKinds(ctx.definition, resume.kinds) } : {}),
    ...(resume.mode
      ? (() => {
          const type = action.modes?.find((one) => one.id === resume.mode)?.damageType;
          return type ? { damageType: type } : {};
        })()
      : {}),
    // What its caster stored in it (1.454).
    ...(rule.detonates?.stores && resume.mode
      ? (() => {
          const stores = action.modes?.find((one) => one.id === resume.mode)?.stores;
          return stores ? { stored: stores } : {};
        })()
      : {}),
  });
  (actor.flags.freshZones ??= []).push(action.id);
  ctx.events.push({ type: "zone", actorId: actor.id, label: action.label, outcome: "appeared" });
  if (rule.blocks?.move && cells && grid) shoveOffWall(ctx, actor, cells, wall?.side ?? []);
  // Its flash on whoever sees it appear near it (1.490).
  const placed = actor.zones.at(-1)!;
  if (rule.layers?.flash?.triggers.includes("appears")) {
    for (const one of [...ctx.state.combatants]) {
      if (flashNear(ctx, actor, placed, action, one)) flashOne(ctx, actor, placed, action, one);
    }
  }
  // Whoever is inside as it is cast throws its save now (1.579), before what it does there goes on:
  // Reverse Gravity's grab at something fixed.
  if (rule.inside?.save?.onCast) {
    for (const id of rulesetZoneOccupants(ctx.state, actor, placed, action)) {
      const one = rulesetCombatant(ctx.state, id);
      if (one) insideSave(ctx, actor, placed, action, one);
    }
  }
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
  /** The zone came onto them, rather than they into it: said so in the log. */
  reached = false,
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
  // Crossed unharmed by whom it spares (1.490).
  const layers = action.zone?.layers;
  if (layers && layersSpare(caster, zone, layers, target)) return;
  const stamp = turnStamp(ctx);
  if (zone.struck?.[target.id] === stamp) return;
  // Only this turn's catches are kept: an older one can never match again.
  zone.struck = {
    ...Object.fromEntries(Object.entries(zone.struck ?? {}).filter(([, when]) => when === stamp)),
    [target.id]: stamp,
  };
  // A layered wall says each layer it strikes with (1.490), below.
  if (!layers) {
    ctx.events.push({
      type: "zone",
      actorId: caster.id,
      label: zone.label,
      outcome: "struck",
      targetId: target.id,
      trigger,
      ...(reached ? { reached: true as const } : {}),
    });
  }
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
  // What it deals at its triggers may be another type than as it appeared (1.198), or the one
  // named as it was cast (1.753).
  const struckType = zone.damageType ?? action.zone?.damageType;
  if (struckType && again.damage) again.damage = { ...again.damage, type: struckType };
  // Only the kinds named as it was cast (1.753), in place of its own.
  if (zone.strikesIs) again.targetTypes = { ...(again.targetTypes ?? {}), is: zone.strikesIs };
  const from = ctx.events.length;
  // The zone acting, not its caster (1.180).
  const byZone = ctx.byZone;
  ctx.byZone = true;
  if (layers) {
    // Each standing layer in turn (1.490), as its row says, each saved against on its own.
    for (const row of layers.rows.slice(zone.layersGone ?? 0)) {
      if (!rulesetCombatStanding(target)) break;
      const derived: RulesetCombatAction = { ...again };
      if (row.damageType && again.damage) derived.damage = { ...again.damage, type: row.damageType };
      else delete derived.damage;
      const applies = (again.applies ?? []).filter((one) => row.applies?.includes(one.condition));
      if (applies.length) derived.applies = applies;
      else delete derived.applies;
      if (row.save && again.save) derived.save = { ...again.save, save: row.save };
      ctx.events.push({
        type: "zone",
        actorId: caster.id,
        label: zone.label,
        outcome: "struck",
        targetId: target.id,
        trigger,
        layer: row.label,
      });
      resolveAction(ctx, caster, derived, [target], zone.payWith);
    }
  } else resolveAction(ctx, caster, again, [target], zone.payWith);
  // Stopped where it caught them walking in, unless they saved (1.689): caltrops.
  if (action.zone?.endsWalk && trigger === "enter") {
    const saved = ctx.events
      .slice(from)
      .some((event) => event.type === "save" && event.actorId === target.id && event.success);
    if (!saved) ctx.walkHalted = target.id;
  }
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

/** A stage that shakes concentration (1.580): whoever starts a turn inside while it lasts rolls the
 *  ruleset's concentration save against the entry's own save difficulty, else 10. */
function stageShakes(
  ctx: RulesetCombatContext,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  const stage = zone.stage !== undefined ? action.zone?.stages?.[zone.stage] : undefined;
  const concentration = ctx.combat.concentration;
  if (!stage?.breaksConcentration || !concentration || !target.concentrating) return;
  const difficulty = action.save?.difficulty ?? action.saveDifficulty ?? 10;
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
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    // Starting a turn near a layered wall (1.490): its flash.
    if (
      trigger === "turn-start" &&
      action.zone?.layers?.flash?.triggers.includes("turn-start") &&
      flashNear(ctx, caster, zone, action, actor)
    ) {
      flashOne(ctx, caster, zone, action, actor);
    }
    const inside = ctx.state.board?.grid
      ? rulesetZoneHoldsOne(rulesetZoneCells(ctx.state, caster, zone), actor)
      : (zone.held ?? []).includes(actor.id);
    // Starting a turn inside, its save to shrug off what it does there (1.460).
    if (inside && trigger === "turn-start") insideSave(ctx, caster, zone, action, actor);
    // And a stage that shakes concentration (1.580): Storm of Vengeance's wind and rain.
    if (inside && trigger === "turn-start") stageShakes(ctx, zone, action, actor);
    if (inside) zoneStrike(ctx, caster, zone, actor, trigger);
    else if (rulesetZoneHoldsOne(zone.sideCells ?? [], actor)) {
      zoneStrike(ctx, caster, zone, actor, trigger, "side");
    }
  }
}

/** The save whoever enters a zone, or starts a turn in it, throws to ignore what it does inside until
 *  they leave (1.460): Hallow's Charisma save. Only one it works on, who has not made it already. */
function insideSave(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  one: RulesetCombatant,
): void {
  const inside = action.zone?.inside;
  if (!inside?.save || zone.shrugged?.includes(one.id) || !rulesetCombatStanding(one)) return;
  const is = zone.insideIs ?? inside.is;
  if (is && !rulesetTargetIs(ctx.definition, one, is)) return;
  const difficulty = action.save?.difficulty ?? action.saveDifficulty;
  if (difficulty === undefined) return;
  if (rollSave(ctx, one, inside.save.save, difficulty, caster.id)) zone.shrugged = [...(zone.shrugged ?? []), one.id];
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
  // Only a creature's own moving catches them in a zone that says so (1.764).
  if (action.zone?.enterOnlyByMoving) return;
  for (const id of rulesetZoneOccupants(ctx.state, caster, zone, action)) {
    if (before.has(id)) continue;
    const target = rulesetCombatant(ctx.state, id);
    if (target) zoneStrike(ctx, caster, zone, target, "enter", "zone", true);
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
  if (action.zone?.enterOnlyByMoving) return;
  for (const id of rulesetZoneOccupants(ctx.state, caster, zone, action)) {
    if (before.has(id)) continue;
    const target = rulesetCombatant(ctx.state, id);
    if (target) zoneStrike(ctx, caster, zone, target, "enter", "zone", true);
  }
}

/** Every zone of this caster's that drifts, moving as their turn starts (1.173). */
/** A caster's zones in stages, as their turn starts (1.557): one turn on, on to the stage that turn
 *  begins where one does, and its strike at whoever is inside, at most its `count` of them, its
 *  caster's foes first and those nearest its middle first. Its ground and its cloud are the stage's. */
function stageZones(ctx: RulesetCombatContext, caster: RulesetCombatant): void {
  for (const zone of [...(caster.zones ?? [])]) {
    const action = caster.actions.find((entry) => entry.id === zone.actionId);
    const stages = action?.zone?.stages;
    if (!action || !stages || !caster.zones?.includes(zone)) continue;
    zone.turns = (zone.turns ?? 1) + 1;
    let at = -1;
    stages.forEach((stage, index) => {
      if (stage.from <= zone.turns!) at = index;
    });
    if (at < 0) continue;
    const stage = stages[at]!;
    const was = zone.stage;
    if (was !== at) {
      zone.stage = at;
      ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "stage", layer: stage.label });
      // Its cloud is the stage's: heavily obscuring while it says so.
      if (stage.obscures) zone.obscures = { pierced: [] };
      else if (was !== undefined && stages[was]?.obscures) delete zone.obscures;
    }
    if (!stage.amount) continue;
    const middle = zone.at ?? rulesetPositionOf(caster);
    const inside = (ctx.state.board?.grid ? rulesetZoneOccupants(ctx.state, caster, zone, action) : (zone.held ?? []))
      .map((id) => rulesetCombatant(ctx.state, id))
      .filter((one): one is RulesetCombatant => !!one && rulesetCombatStanding(one))
      .sort(
        (a, b) =>
          Number(a.side === caster.side) - Number(b.side === caster.side) ||
          (middle ? rulesetDistanceTo(middle, a) - rulesetDistanceTo(middle, b) : 0),
      );
    const struck = stage.count !== undefined ? inside.slice(0, stage.count) : inside;
    if (struck.length === 0) continue;
    const {
      concentration: _held,
      zone: _zone,
      summons: _summons,
      gives: _gives,
      toHit: _toHit,
      applies: _applies,
      ...again
    } = action;
    const difficulty = action.save?.difficulty ?? action.saveDifficulty;
    const derived: RulesetCombatAction = {
      ...again,
      autoHit: true,
      damage: { ...stage.amount, ...(stage.damageType ? { type: stage.damageType } : {}) },
    };
    if (stage.save && difficulty !== undefined)
      derived.save = { save: stage.save, difficulty, onSuccess: stage.onSave === "half" ? "half" : "negates" };
    else delete derived.save;
    const byZone = ctx.byZone;
    ctx.byZone = true;
    for (const target of struck) {
      if (!rulesetCombatStanding(target)) continue;
      ctx.events.push({
        type: "zone",
        actorId: caster.id,
        label: zone.label,
        outcome: "struck",
        targetId: target.id,
        trigger: "turn-start",
      });
      resolveAction(ctx, caster, derived, [target], zone.payWith);
    }
    if (byZone) ctx.byZone = byZone;
    else delete ctx.byZone;
  }
}

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
  const at = ctx.summonAppears ?? summonCell(ctx.state, rulesetCombatant(ctx.state, resume.targetIds[0] ?? ""));
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
  reason: "replaced" | "damage" | "down" | "zone" | "spent" | "dispelled",
): void {
  const held = actor.concentrating;
  if (!held) return;
  actor.concentrating = null;
  // A cast taking rounds (1.461) fails with it, what it cost given back.
  if (actor.casting && held.actionId === castingHeld(actor.casting.optionId)) loseCasting(ctx, actor);
  // A spell held ready by it is lost with it (1.288).
  const readied = actor.readied;
  if (readied?.paid && readied.optionId === held.actionId) {
    delete actor.readied;
    ctx.events.push({ type: "ready", actorId: actor.id, label: readied.label, on: readied.on, outcome: "lost" });
  }
  endSummons(ctx, actor, held.actionId);
  endZones(ctx, actor, held.actionId);
  // Whoever it called (1.394) goes with it, or, broken, turns on its caller's side where it says so
  // (1.538): Conjure Elemental's elemental.
  if (reason === "damage" || reason === "down" || reason === "zone") turnCalled(ctx, actor, held.actionId);
  dismissCalled(ctx, actor, (one) => one.calledWith === held.actionId, "concentration");
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
    if (!legal.has(id))
      return rulesetTargetRefusal(state, actor.id, option.id, id, option.range, definition) ?? "bad-target";
    targets.push(rulesetCombatant(state, id)!);
  }
  // All within so far of each other (1.267): Command's extra creatures.
  const own = actor.actions.find((entry) => entry.id === option.id);
  const within = own?.targetsWithin;
  if (within !== undefined && targets.some((one) => targets.some((other) => rulesetGap(one, other) > within))) {
    return "targets-apart";
  }
  // Each after the first within so far of the first (1.594): Chain Lightning's leaps.
  const first = targets[0];
  const nearFirst = own?.targetsWithinFirst;
  if (first && nearFirst !== undefined && targets.slice(1).some((one) => rulesetGap(first, one) > nearFirst)) {
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
  // The one it replaces, if it lay where it fell, is gone (1.480).
  if (actor.dropped?.length) actor.dropped = actor.dropped.filter((thing) => thing.key !== `conjured:${action.id}`);
  // Named as the entry, not as the mode it was used in: "Pact of the Blade", not "(Longsword)".
  const label = actor.actions.find((one) => one.id === action.id)?.label ?? action.label;
  ctx.events.push({ type: "conjured", actorId: actor.id, optionId: action.id, label, item: made.item });
}

/** Kept off by what ended (1.269), and spared a creature's action (1.674). */
function keepOff(target: RulesetCombatant, key: string): void {
  if (key.startsWith("spared|")) spare(target, key);
  else if (!target.auraSafe?.includes(key)) target.auraSafe = [...(target.auraSafe ?? []), key];
}

/** Spared a creature's action (1.674): for the fight, and on a sheet until the rest its key names. */
function spare(target: RulesetCombatant, key: string): void {
  if (!target.auraSafe?.includes(key)) target.auraSafe = [...(target.auraSafe ?? []), key];
  const until = key.split("|")[1];
  if (!until || !target.sheet) return;
  target.sheet.live = {
    ...target.sheet.live,
    usedOn: { ...target.sheet.live.usedOn, [`${until}|${key}`]: ["spared"] },
  };
}

/** Who succeeded on a save against a cast its maker concentrates on, or against a repeat of it
 *  (1.310): Eyebite never picks them again. */
function noteSaved(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  // Spared it until the rest that frees it (1.431): Intimidating Presence's 24 hours.
  if (action.oncePerTarget?.whenSaved) markUsedOn(state, actor, action, [target], true);
  // A creature's, spared once saved against (1.674).
  if (action.sparedAfter?.whenSaved) spare(target, rulesetSparedKey(actor, action));
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
  // Gone from where it lay, too (1.480).
  if (actor.dropped?.length) actor.dropped = actor.dropped.filter((thing) => thing.key !== `conjured:${actionId}`);
  ctx.events.push({ type: "conjured", actorId: actor.id, optionId: actionId, label: "", item, gone: true });
}

/** A weapon put in hand, let fall and left far off long enough, gone (1.480): a pact weapon more than
 *  5 feet from its maker for a minute. Counted as its maker's turns start. */
function conjuredLeftBehind(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const at = rulesetPositionOf(actor);
  for (const thing of [...(actor.dropped ?? [])]) {
    if (!thing.key.startsWith("conjured:")) continue;
    const id = thing.key.slice("conjured:".length);
    const made = actor.conjured?.[id];
    const vanishes = made ? actor.conjurable?.[`${id}|${made.mode}`]?.vanishes : undefined;
    if (!vanishes) continue;
    const far = !!thing.at && !!at && rulesetGapFrom(thing.at, 1, actor) > vanishes.beyond;
    if (!far) {
      delete thing.farSince;
      continue;
    }
    thing.farSince ??= ctx.state.round;
    if (ctx.state.round - thing.farSince >= vanishes.rounds) unconjure(ctx, actor, id);
  }
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
  /** Marked as they made their save (1.431), for an entry that spares only those. */
  saved = false,
): void {
  if (!action.oncePerTarget || targets.length === 0) return;
  // Only whoever made their save, as they make it (1.431).
  if (action.oncePerTarget.whenSaved && !saved) return;
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
  // Used on with none of its charges left (1.624): a Wind Fan past its once a dawn.
  const use = action.itemUse;
  const overusing =
    !!use?.charges?.overuse && !use.consumes && !use.ownUses && rulesetItemUseLeft(actor, use) < use.charges.cost;
  const shot = spendRulesetShots(actor, action, action.itemUse ? (ctx.moreCharges ?? 0) : 0);
  if (shot) ctx.events.push(shot);
  // A priced material the cast consumes (1.790), out of the bag as the fight left it.
  if (action.material?.consumed) {
    const taken = rulesetMaterialFor(ctx.definition, action.material, actor.sheet?.items, actor.itemsUsed) ?? [];
    for (const { index, count } of taken) (actor.itemsUsed ??= {})[index] = (actor.itemsUsed[index] ?? 0) + count;
  }
  if (overusing) overuseItem(ctx, actor, action);
  // Used again before its user rested (1.744): a Ring of X-ray Vision's exhaustion.
  if (use?.againBeforeRest && !ctx.tore) usedAgainBeforeRest(ctx, actor, action);
  // A chance to backfire as it is used (1.630): a Horn of Blasting.
  if (use?.backfires && !ctx.tore) backfireItem(ctx, actor, action);
  // The last charge spent: an item that may break rolls for it now.
  const broke = shot?.type === "uses" ? breakRulesetItem(actor, action, ctx.roll) : null;
  if (broke) ctx.events.push(broke);
  // A slot of a creature's trait (1.642), its coven's where it is a coven spell.
  const slot = rulesetInnateSlot(actor, action, ctx.state);
  if (slot !== undefined) {
    const left = Math.max(0, rulesetInnateSlotsLeft(actor, action, slot, ctx.state) - 1);
    if (action.innate?.coven) (ctx.state.covenUses ??= {})[`${action.innate.coven.id}/slot:${slot}`] = left;
    else actor.uses[`slot:${slot}`] = left;
  }
  if (action.uses) {
    const left = Math.max(0, rulesetActionUses(actor, action, ctx.state) - 1);
    const key = rulesetUsesKey(action);
    if (action.innate?.coven) (ctx.state.covenUses ??= {})[`${action.innate.coven.id}/${key}`] = left;
    else actor.uses[key] = left;
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

/** An item that costs something used again before a rest (1.744) counts the use on its stack, and
 *  past the first since that rest asks its save of its user: failed, their tracks move and its
 *  conditions go on them. */
function usedAgainBeforeRest(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  const use = action.itemUse!;
  const rule = use.againBeforeRest!;
  const before = rulesetItemUsedSinceRest(actor, use.item);
  (actor.usesLeft ??= {})[`${use.item}:a`] = Math.min(100, before + 1);
  if (before < 1 || rollSave(ctx, actor, rule.save.save, rule.save.difficulty)) return;
  for (const moved of rule.tracks ?? []) moveTrack(ctx, actor, actor, moved.track, moved.by);
  for (const condition of rule.conditions ?? [])
    applyConditionId(ctx, actor, condition, { condition, duration: "until-dispelled" }, { sourceId: actor.id });
}

/** An item used on with no charges left (1.624) counts it, and rolls its d100 against its chance (that
 *  chance again for each such use since they came back, where it is cumulative): at or under it, the
 *  item tears, gone for good, and the use does nothing. */
function overuseItem(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  const use = action.itemUse!;
  const rule = use.charges!.overuse!;
  const count = Math.min(100, rulesetItemOverused(actor, use.item) + 1);
  (actor.usesLeft ??= {})[`${use.item}:o`] = count;
  const chance = Math.min(100, rule.chance * (rule.cumulative ? count : 1));
  const face = ctx.roll(100);
  if (face > chance) return;
  (actor.itemsUsed ??= {})[use.item] = (actor.itemsUsed?.[use.item] ?? 0) + 1;
  (actor.broken ??= {})[use.item] = true;
  ctx.events.push({ type: "broke", actorId: actor.id, optionId: action.id, label: action.label, roll: face });
  ctx.tore = true;
}

/** The item whose use put a condition on, spent for good (1.636) and told: Iron Bands of Binding,
 *  destroyed by a successful escape. Nothing where no item put it on. */
function spendApplyingItem(ctx: RulesetCombatContext, entry: RulesetTrackedCondition): void {
  const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
  const id = entry.action?.[0];
  const use = source?.actions.find((one) => one.id === id)?.itemUse;
  if (!source || !use || source.broken?.[use.item]) return;
  (source.itemsUsed ??= {})[use.item] = (source.itemsUsed?.[use.item] ?? 0) + 1;
  (source.broken ??= {})[use.item] = true;
  ctx.events.push({ type: "itemSpent", actorId: source.id, label: source.sheet?.items?.[use.item]?.name ?? "" });
}

/** An item that may backfire as it is used (1.630) rolls its d100: at or under its chance, it deals
 *  its amount to its user, with `destroys` is gone for good, and with `instead` does nothing besides. */
function backfireItem(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  const use = action.itemUse!;
  const rule = use.backfires!;
  const face = ctx.roll(100);
  if (face > rule.chance) return;
  if (rule.destroys) {
    (actor.itemsUsed ??= {})[use.item] = (actor.itemsUsed?.[use.item] ?? 0) + 1;
    (actor.broken ??= {})[use.item] = true;
  }
  ctx.events.push({
    type: "backfired",
    actorId: actor.id,
    label: action.label,
    roll: face,
    ...(rule.destroys ? { destroyed: true as const } : {}),
  });
  const rolled = rollAmount(ctx, rule.amount);
  const dealt = applyDamage(ctx, actor, {
    sourceId: actor.id,
    label: action.label,
    ...(rule.damageType ? { damageType: rule.damageType } : {}),
    rolls: rolled.rolls,
    flat: rolled.flat,
    amount: rolled.total,
  });
  afterBlow(ctx, actor, dealt, false);
  if (rule.instead) ctx.tore = true;
}

/** A missile caught, kept (1.626): one of its shooter's own ammunition where it was that, which they
 *  no longer win back, else the `otherwise` item. It goes into its catcher's bag: onto a stack of the
 *  same item there, or a new one beside their others, written back as the fight's items are. */
function keepCaught(
  ctx: RulesetCombatContext,
  catcher: RulesetCombatant,
  rule: NonNullable<RulesetCombatAction["keepsCaught"]>,
  trigger: Extract<RulesetWindowTrigger, { kind: "caught" }>,
): void {
  const shooter = rulesetCombatant(ctx.state, trigger.sourceId);
  const shot = trigger.missile !== undefined ? shooter?.sheet?.items?.[trigger.missile.item] : undefined;
  let kept: { item: RulesetCatalogItem; ref?: string; name: string } | undefined;
  if (shot && shooter) {
    kept = {
      item: shot.item,
      ...(shot.stack ? { ref: shot.stack.ref } : {}),
      name: shot.name ?? shot.stack?.ref ?? "",
    };
    const index = trigger.missile!.item;
    const share = trigger.missile!.recover ?? 0;
    if (share > 0 && shooter.recoverable?.[index] !== undefined)
      shooter.recoverable[index] = Math.max(0, shooter.recoverable[index]! - share);
  } else if (typeof rule === "object") {
    const entry = rulesetCatalogEntriesByRef(
      Object.fromEntries((ctx.definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
    ).get(rule.otherwise);
    if (entry?.item) kept = { item: entry.item, ref: rule.otherwise, name: entry.label };
  }
  if (!kept || !catcher.sheet) return;
  const items = catcher.sheet.items ?? [];
  const bagged = items.find((held) => held.stack);
  const holder = bagged?.stack?.holder;
  const same = kept.ref
    ? items.findIndex((held) => held.stack?.ref === kept!.ref && held.stack?.holder === holder)
    : -1;
  const at = same >= 0 ? same : items.length;
  if (same < 0) {
    catcher.sheet.items = [
      ...items,
      {
        item: kept.item,
        quantity: 0,
        worn: false,
        name: kept.name,
        ...(kept.ref && bagged
          ? {
              stack: {
                id: `st-caught-${ctx.state.seed.toString(36)}-${ctx.state.round}-${items.length}`,
                ref: kept.ref,
                ...(holder !== undefined ? { holder } : {}),
              },
            }
          : {}),
      },
    ];
  }
  (catcher.itemsUsed ??= {})[at] = (catcher.itemsUsed?.[at] ?? 0) - 1;
  ctx.events.push({ type: "missileKept", actorId: catcher.id, label: kept.name });
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
  if (optionId === RULESET_MOVE_OPTION || optionId === RULESET_STAND_OPTION || optionId === RULESET_CLIMB_OUT_OPTION) {
    return "unreachable";
  }
  // Turning a zone (1.182): none to turn, or nothing left to turn it with.
  if (optionId.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX)) {
    const actionId = optionId.slice(RULESET_ZONE_TURN_OPTION_PREFIX.length);
    const turn = actor.actions.find((entry) => entry.id === actionId)?.zone?.turn;
    if (turn && actor.zones?.some((zone) => zone.actionId === actionId) && (actor.budgets[turn.budget] ?? 0) < 1) {
      return "no-budget";
    }
    return "unreachable";
  }
  // Closing a zone (1.637): none to close, or nothing left to close it with.
  if (optionId.startsWith(RULESET_ZONE_CLOSE_OPTION_PREFIX)) {
    const actionId = optionId.slice(RULESET_ZONE_CLOSE_OPTION_PREFIX.length);
    const close = actor.actions.find((entry) => entry.id === actionId)?.zone?.close;
    if (close && actor.zones?.some((zone) => zone.actionId === actionId) && (actor.budgets[close.budget] ?? 0) < 1) {
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
  // Slipping free (1.486): nothing it may slip, or too little of the walk left to do it with.
  // An attack given up (1.488): nobody to give it to, or nothing left to give.
  if (optionId.startsWith(RULESET_LEND_OPTION_PREFIX)) return "no-budget";
  if (optionId.startsWith(RULESET_SLIP_OPTION_PREFIX)) {
    const condition = optionId.slice(RULESET_SLIP_OPTION_PREFIX.length);
    return rulesetCombatConditions(definition, actor).includes(condition) ? "unreachable" : "unknown-option";
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
  return withItemDrawn(definition, applyShiftedChoice(definition, state, choice, roller), choice);
}

/**
 * A choice made with a held item drawn as it is used (Capability API 1.808), a blow or a use, puts it
 * in its user's hands once it is made, as a free swap: taken in hand as the In hand row takes it
 * (`rulesetDrawAsUsed`), the fewest weapons in its slots put away, the menu read again from what they
 * hold, and the fight's line for the draw said ahead of the blow. Both are written to the bag as the
 * step is saved. A refused choice draws nothing; nor does one whose item could not be drawn, which the
 * menu never offers.
 */
function withItemDrawn(
  definition: RulesetDefinition,
  step: RulesetCombatStep,
  choice: RulesetCombatChoice,
): RulesetCombatStep {
  if (!/^(?:item|offhand|use):\d/.test(choice.optionId) || step.events.some((event) => event.type === "refused"))
    return step;
  const index = rulesetActionItemIndex({ id: choice.optionId });
  const actor = rulesetCombatant(step.state, choice.actorId);
  const held = index !== undefined ? actor?.sheet?.items?.[index] : undefined;
  if (!actor || index === undefined || !held?.drawOnUse || (actor.drawn?.[index] ?? held.worn)) return step;
  // Its own copy, so the state the step was given is never changed under it.
  const drawing: RulesetCombatant = { ...actor, uses: { ...actor.uses } };
  const drew = rulesetDrawAsUsed(definition, drawing, index);
  if (!drew) return step;
  return {
    ...step,
    events: [drew, ...step.events],
    state: {
      ...step.state,
      combatants: step.state.combatants.map((one) => (one.id === actor.id ? drawing : one)),
    },
  };
}

function applyShiftedChoice(
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
  // At the level it is paid at (1.415): Overchannel only from 1st to 5th.
  const paidLevel = rulesetPaidLevel(definition, actor, own, choice.payWith);
  if (chosen.some((alter) => !rulesetAlterLevelFits(alter.alters!, paidLevel))) {
    return refusal(state, choice.actorId, "bad-alter", choice.optionId);
  }
  // Who it spares (1.254): only with an alteration that spares some, no more than it spares, each
  // once and each of its user's side.
  const spares = choice.spares;
  if (spares !== undefined) {
    // As many more as the level it is paid at, for one that says so (1.414): Sculpt Spells.
    const level = rulesetPaidLevel(definition, actor, own, choice.payWith);
    const most = Math.max(
      0,
      ...chosen.map((alter) => (alter.alters!.spares ?? 0) + (alter.alters!.sparesByLevel ? level : 0)),
    );
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
  // Breaking what a condition commands (1.644): worked out with what it stops lifted, and then
  // harmed for it. A walk breaks it only where it ends at a cell it may not go.
  const defies = option?.defies;
  if (
    defies &&
    !rulesetDefiance() &&
    (!defies.cells || defies.cells.some((cell) => cell.x === choice.to?.x && cell.y === choice.to?.y))
  ) {
    const step = rulesetDefying(actor.id, defies.conditions, () =>
      applyChoice(definition, state, choice, roller, alters, picks),
    );
    if (step.state === state) return step;
    return harmForBreaking(definition, combat, step, actor.id, defies.conditions, roller);
  }
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

  // Slipping free (1.486): the condition comes off, the walk it kept from them comes back, and what
  // slipping costs comes off that.
  if (option.slip && option.id.startsWith(RULESET_SLIP_OPTION_PREFIX)) {
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    const condition = option.id.slice(RULESET_SLIP_OPTION_PREFIX.length);
    const before =
      working.movement !== undefined ? rulesetMovementAllowance(ctx.definition, ctx.combat, working, ctx.state) : 0;
    removeCondition(ctx, working, condition, "slipped");
    if (working.movement !== undefined) {
      const after = rulesetMovementAllowance(ctx.definition, ctx.combat, working, ctx.state);
      if (after > before) {
        working.movementLeft = (working.movementLeft ?? 0) + after - before;
        working.movement = Math.max(working.movement, after);
      }
      spendRulesetMovement(working, option.movementCost ?? 0);
    }
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

  // Closing a zone its caster holds (1.637): ended, or lingering its last rounds.
  if (option.id.startsWith(RULESET_ZONE_CLOSE_OPTION_PREFIX)) {
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    spendBudget(ctx, working, option.budget!);
    const actionId = option.id.slice(RULESET_ZONE_CLOSE_OPTION_PREFIX.length);
    const zone = working.zones!.find((entry) => entry.actionId === actionId)!;
    const lingers = working.actions.find((entry) => entry.id === actionId)?.zone?.close?.lingers;
    ctx.events.push({ type: "zone", actorId: working.id, label: zone.label, outcome: "closed" });
    if (lingers) {
      zone.closed = true;
      zone.rounds = Math.min(zone.rounds, lingers);
    } else endZones(ctx, working, actionId);
    noteOutcome(ctx);
    return finish();
  }

  // Moving a zone anybody near may move (1.694): its check thrown against its difficulty, or against
  // whoever else moved it last; won, it goes to the cell picked and is theirs, failed against the
  // difficulty, it comes at them. A Sphere of Annihilation.
  if (option.id.startsWith(RULESET_ZONE_CHECK_OPTION_PREFIX)) {
    const cell = destinationOf(option, choice.to);
    if (!cell) return refusal(state, choice.actorId, "unreachable", option.id);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const working = rulesetCombatant(ctx.state, actor.id)!;
    spendBudget(ctx, working, option.budget!);
    const [casterId, actionId] = option.id.slice(RULESET_ZONE_CHECK_OPTION_PREFIX.length).split("|");
    const caster = rulesetCombatant(ctx.state, casterId!)!;
    const zone = caster.zones!.find((entry) => entry.actionId === actionId)!;
    const action = caster.actions.find((entry) => entry.id === actionId)!;
    const check = action.zone!.move!.check!;
    const holder =
      zone.heldBy !== undefined && zone.heldBy !== working.id ? rulesetCombatant(ctx.state, zone.heldBy) : undefined;
    const rival = holder && rulesetCombatStanding(holder) ? holder : undefined;
    // Holding a talisman (1.703): what it adds, and advantage.
    const holding = check.holding && rulesetHoldsTagged(working, check.holding.tags) ? check.holding : undefined;
    const adds = holding?.adds ? (rulesetCombatValue(ctx.definition, working, holding.adds) ?? 0) : 0;
    const before = ctx.events.length;
    resolveContest(
      ctx,
      working,
      { ...action, id: option.id, label: zone.label },
      {
        id: option.id,
        attacker: [check.check],
        defender: [check.check],
        ties: "defender",
        ...(rival ? {} : { difficulty: check.difficulty }),
        ...(adds ? { attackerAdds: adds } : {}),
        ...(holding?.advantage ? { attackerAdvantage: true as const } : {}),
      },
      rival ?? working,
    );
    const thrown = ctx.events.slice(before).find((event) => event.type === "contest");
    if (thrown?.type === "contest" && thrown.winner === "actor") {
      zone.heldBy = working.id;
      moveZone(ctx, caster, zone, cell, "moved");
    } else if (!rival && check.failsToward && zone.at) {
      // Drawn at whoever failed, a cell at a time, as far as it says.
      const from = rulesetPositionOf(working);
      const grid = ctx.state.board?.grid;
      if (from && grid) {
        let at = { ...zone.at };
        for (let step = 0; step < check.failsToward && (at.x !== from.x || at.y !== from.y); step++) {
          at = { x: at.x + Math.sign(from.x - at.x), y: at.y + Math.sign(from.y - at.y) };
        }
        moveZone(ctx, caster, zone, at, "moved");
      }
    }
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
    const walks =
      option.id === RULESET_MOVE_OPTION || option.id === RULESET_JUMP_OPTION || option.id === RULESET_CAREFUL_OPTION;
    const cell = walks ? destinationOf(option, choice.to) : null;
    if (walks && !cell) return refusal(state, choice.actorId, "unreachable", option.id);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const walking = rulesetCombatant(ctx.state, actor.id)!;
    if (cell) resolveMove(ctx, walking, cell, option.id === RULESET_JUMP_OPTION, option.id === RULESET_CAREFUL_OPTION);
    else if (option.id === RULESET_FLY_UP_OPTION || option.id === RULESET_FLY_DOWN_OPTION) {
      resolveFly(ctx, walking, option);
    } else if (option.id === RULESET_CLIMB_OUT_OPTION) resolveClimbOut(ctx, walking, option);
    else if (option.id.startsWith(RULESET_MOUNT_OPTION_PREFIX)) {
      const mount = rulesetCombatant(ctx.state, option.id.slice(RULESET_MOUNT_OPTION_PREFIX.length));
      if (mount) mountOn(ctx, walking, mount, option.movementCost ?? 0);
    } else if (option.id === RULESET_DISMOUNT_OPTION) {
      spendRulesetMovement(walking, option.movementCost ?? 0);
      dismount(ctx, walking);
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

  // Stored instead of done (1.524): in one of the places its option offers, paid for as it is cast.
  if (choice.storesIn !== undefined) return storeChoice(definition, combat, state, actor, option, choice, roller);

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
  // A repeat made with none picked is made in the cast's (1.692).
  const keptMode = rulesetKeptMode(
    actor,
    actor.actions.find((entry) => entry.id === option.id),
  );
  const namedIn = actor.actions.find((entry) => entry.id === option.id);
  // A damage type left unnamed (1.753) is the first one offered, as it is set up before a fight: a
  // cast refused for it struck nobody (Ruleset 0.431: Spirit Guardians cast with no type named).
  const modeId =
    choice.mode ??
    keptMode ??
    (namedIn?.damageTypeChoice ? namedIn.modes?.find((entry) => entry.damageType)?.id : undefined);
  const mode = modeId === undefined ? undefined : option.modes?.find((entry) => entry.id === modeId);
  if (choice.mode !== undefined && !mode) return refusal(state, choice.actorId, "unknown-mode", option.id);
  // A creature type is picked as it is used (1.270): no kind, no Antipathy.
  // And so is the weapon put in hand (1.306).
  // How well its user knows where it goes, leaving the fight (1.670).
  if (
    !mode &&
    (namedIn?.kindChoice ||
      namedIn?.damageTypeChoice ||
      namedIn?.conjures ||
      namedIn?.shapes ||
      (namedIn?.teleport?.familiarity && !choice.at))
  ) {
    return refusal(state, choice.actorId, "unknown-mode", option.id);
  }
  if (choice.payWith !== undefined && !(option.payWith ?? []).includes(choice.payWith)) {
    return refusal(state, choice.actorId, "bad-pool", option.id);
  }
  // A call this payment is too low for (1.537): Create Undead's mummies below a 9th-level slot.
  const callNeeds = namedIn?.modes?.find((entry) => entry.id === choice.mode)?.call?.fromStep;
  if (callNeeds && namedIn) {
    const steps = namedIn.innate
      ? Math.max(0, namedIn.innate.level - namedIn.innate.baseLevel)
      : choice.payWith !== undefined
        ? rulesetCostSteps(definition, namedIn, choice.payWith, actor)
        : 0;
    if (steps < callNeeds) return refusal(state, choice.actorId, "unknown-mode", option.id);
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
  // The one thing it wards off (1.758): one its option offered, its first where none is named (a
  // creature's own choice).
  if (option.kindsOne && choice.kinds === undefined && option.kindsOf?.length)
    choice = { ...choice, kinds: [option.kindsOf[0]!.id] };
  if (option.kindsOne && (!Array.isArray(choice.kinds) || choice.kinds.length !== 1)) {
    return refusal(state, choice.actorId, "unknown-mode", option.id);
  }
  // The kinds its zone strikes (1.753): one or more its option offered, none twice.
  if (
    choice.kinds !== undefined &&
    !(
      option.kindsOf &&
      Array.isArray(choice.kinds) &&
      choice.kinds.length > 0 &&
      new Set(choice.kinds).size === choice.kinds.length &&
      choice.kinds.every((id) => option.kindsOf!.some((kind) => kind.id === id))
    )
  ) {
    return refusal(state, choice.actorId, "unknown-mode", option.id);
  }
  // Whom a layered wall spares (1.492): those its option offered, no more than it spares.
  const designated = option.designates;
  if (
    choice.designates !== undefined &&
    !(
      designated &&
      Array.isArray(choice.designates) &&
      new Set(choice.designates).size === choice.designates.length &&
      choice.designates.length <= designated.count &&
      choice.designates.every((id) => designated.ids.includes(id))
    )
  ) {
    return refusal(state, choice.actorId, "bad-target", option.id);
  }
  // A wall's section struck at instead of a creature (1.200).
  if (choice.wall !== undefined) return strikeSection(definition, combat, state, actor, option, choice, roller);
  // A condition struck at to cut it away (1.531): a net.
  if (choice.cut !== undefined) return strikeCut(definition, combat, state, actor, option, choice, roller);
  // A lasting area to end instead of a creature (1.427), one the menu offered; and what to end on a
  // target, picked from what the menu offered for them.
  const dispel =
    choice.dispel !== undefined
      ? option.dispels?.find(
          (one) =>
            typeof choice.dispel === "object" &&
            one.casterId === choice.dispel?.casterId &&
            one.actionId === choice.dispel?.actionId,
        )
      : undefined;
  if (choice.dispel !== undefined && (!dispel || choice.targetIds.length > 0)) {
    return refusal(state, choice.actorId, "bad-target", option.id);
  }
  if (choice.ends !== undefined) {
    const offered = option.endsChoices;
    const own = actor.actions.find((entry) => entry.id === option.id);
    const named = own?.endsSpells?.chosen ? own.endsSpells : own?.ends;
    if (
      !offered ||
      !Array.isArray(choice.ends) ||
      choice.ends.length === 0 ||
      choice.ends.length > (named?.count ?? choice.ends.length) ||
      !choice.ends.every(
        (condition) =>
          typeof condition === "string" &&
          choice.targetIds.some((id) => offered[id]?.some((one) => one.condition === condition)),
      )
    ) {
      return refusal(state, choice.actorId, "bad-target", option.id);
    }
  }
  // Targets, checked against the side and the count the option itself declared, or the count the
  // pool it is paid with lets it take (1.171).
  const paidCount = choice.payWith !== undefined ? option.targetsWith?.[choice.payWith] : undefined;
  const grow = rulesetAreaGrowth(definition, actor, option.id, choice.payWith);
  // A burst centred on its user (1.282) catches whom it reaches, and is pointed at nobody.
  const around = actor.actions.find((entry) => entry.id === option.id && entry.around);
  // Off a board, an area that leaves a zone may be set down on nobody in particular: the Eversmoking
  // Bottle's smoke, poured out where its user stands.
  const laidOnNobody =
    !state.board?.grid &&
    choice.targetIds.length === 0 &&
    actor.actions.some((entry) => entry.id === option.id && !!entry.zone && !!entry.area);
  const targets =
    dispel || laidOnNobody
      ? []
      : around
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
  // Where an engulf walks to (1.403): a cell its option offered.
  const engulfTo = named?.engulf && option.cells ? destinationOf(option, choice.to) : undefined;
  if (named?.engulf && option.cells && !engulfTo) return refusal(state, choice.actorId, "unreachable", option.id);
  // Where a leap lands (1.725): a cell its option offered.
  const leapTo = named?.leapsOnto && option.cells ? destinationOf(option, choice.to) : undefined;
  if (named?.leapsOnto && option.cells && !leapTo) return refusal(state, choice.actorId, "unreachable", option.id);
  // Where a creature's move on its own turn goes (1.607): a cell its option offered.
  const ownMove = named?.move && !named.signature && rulesetMovesOnly(named) && option.cells;
  const moveTo = ownMove ? destinationOf(option, choice.to) : undefined;
  if (ownMove && !moveTo) return refusal(state, choice.actorId, "unreachable", option.id);
  // Where its target is moved to (1.565): a cell its option offered for that target, lifted no more
  // levels than it may be and no farther up or down than it carries.
  const moving = option.movesTarget;
  if (choice.rises !== undefined) {
    const rises = choice.rises;
    if (!moving || !choice.to || !Number.isInteger(rises) || rises < 0 || rises > (moving.levels ?? 0)) {
      return refusal(state, choice.actorId, "bad-cell", option.id);
    }
  }
  let carriesTo: RulesetCombatContext["carriesTo"];
  if (choice.to && moving && named?.movesTarget) {
    const moved = targets[0];
    const to = choice.to;
    const grid = state.board?.grid;
    if (!moved || !grid || !(moving.cells[moved.id] ?? []).some((cell) => cell.x === to.x && cell.y === to.y)) {
      return refusal(state, choice.actorId, "bad-cell", option.id);
    }
    const rises = choice.rises ?? 0;
    const climb = Math.abs(elevationAt(grid, to.x, to.y) + rises - rulesetLevelOf(grid, moved));
    if (climb * Math.max(1, state.board?.levelCells ?? 1) > named.movesTarget.cells) {
      return refusal(state, choice.actorId, "bad-cell", option.id);
    }
    carriesTo = { x: to.x, y: to.y, rises };
  }

  const { ctx, finish } = begin(definition, combat, state, roller);
  if (dispel) ctx.dispel = { casterId: dispel.casterId, actionId: dispel.actionId };
  if (choice.ends?.length) ctx.endsChosen = new Set(choice.ends);
  if (area && choice.at) ctx.aimedAt = { x: choice.at.x, y: choice.at.y };
  if (also) ctx.aimedAlso = also;
  if (carriesTo) ctx.carriesTo = carriesTo;
  if (teleporting) {
    ctx.teleport = {
      ...(choice.at ? { to: { x: choice.at.x, y: choice.at.y } } : {}),
      carries: [...(choice.carries ?? [])],
    };
  }
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);
  // Another action of theirs ends what lasts until they act again (1.599): the Interposing Hand.
  endOnSourceActing(ctx, working);

  // One attack given up for one by what they called (1.488): out of a strike in hand, or the attack
  // action taken now with the rest of its strikes put in hand; the called one pays its own budget.
  if (option.lend) {
    const { calledId, actionId, spends, attackBudget, strikes } = option.lend;
    const called = rulesetCombatant(ctx.state, calledId);
    const attack = called?.actions.find((entry) => entry.id === actionId);
    if (!called || !attack) return refusal(state, choice.actorId, "unknown-option", option.id);
    if ((working.strikesLeft ?? 0) > 0) {
      working.strikesLeft! -= 1;
      if (working.strikesLeft === 0) delete working.strikesLeft;
    } else {
      spendBudget(ctx, working, attackBudget);
      if (strikes > 1) working.strikesLeft = strikes - 1;
    }
    working.flags.attackAction = [...(working.flags.attackAction ?? []), option.label];
    spendBudget(ctx, called, spends);
    endOnSourceActing(ctx, called);
    ctx.events.push({ type: "lent", actorId: working.id, calledId: called.id, label: attack.label });
    spendAvailability(ctx, called, attack);
    resolveAction(ctx, called, attack, workingTargets);
    noteOutcome(ctx);
    return finish();
  }

  // The budget goes first: what a turn may hold is not a matter of how the dice fall.
  const budget = option.budget;
  if (budget) spendBudget(ctx, working, budget);
  // What the bonus-action spell rule reads for the rest of the turn (1.710).
  const cast = working.actions.find((entry) => entry.id === option.id);
  if (cast && budget && rulesetOnOwnTurn(ctx.state, working)) {
    const kind = rulesetBonusSpellKind(ctx.definition, ctx.combat, working, cast, budget);
    if (kind === "bonus") working.flags.spellsCast = { ...working.flags.spellsCast, bonus: true };
    else if (kind === "other") working.flags.spellsCast = { ...working.flags.spellsCast, other: true };
  }

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
    // Their own, or one next to them they end for its holder (1.518), rolled with their own check.
    const holder = option.checkEnds.holderId ? rulesetCombatant(ctx.state, option.checkEnds.holderId) : working;
    const entry = holder?.tracked.find((one) => one.condition === option.checkEnds!.condition);
    const rule = entry?.checkEnds;
    if (holder && entry && rule && (holder === working || rule.by === "any")) {
      const automatic = !!rule.passes && rulesetTargetIs(ctx.definition, working, rule.passes);
      const thrown = automatic ? undefined : throwCheck(ctx, working, rule.check, working.checks?.[rule.check] ?? 0);
      const success = automatic || (thrown !== undefined && thrown.total >= rule.difficulty);
      ctx.events.push({
        type: "checkEnded",
        actorId: working.id,
        ...(holder !== working ? { holderId: holder.id } : {}),
        condition: entry.condition,
        difficulty: rule.difficulty,
        ...(thrown ? { total: thrown.total, rolls: thrown.rolls } : {}),
        success,
        ...(automatic ? { automatic: true as const } : {}),
      });
      if (success) {
        removeCondition(ctx, holder, entry.condition, "save");
        noteShookOff(holder, entry);
        // The spell ends with it: its concentration too, where that is what held it.
        endHoldingConcentration(ctx, entry);
        // And the item that put it on is spent (1.636): Iron Bands of Binding.
        if (rule.spendsItem) spendApplyingItem(ctx, entry);
      } else if (rule.failedRetryAfter && holder === working) {
        // Its holder's own tries barred for a while (1.636).
        entry.checkBarredUntil = ctx.state.round + rule.failedRetryAfter;
      }
    }
    noteOutcome(ctx);
    return finish();
  }

  // The way back at will (1.627): what keeps them away taken off, a Robe of Stars' wearer returning.
  if (working.away?.turns && working.away.while && option.id === `end-condition:${working.away.while}`) {
    endOwnCondition(ctx, working, working.away.while);
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
    if (rulesetIsAttack(action)) countAttack(ctx, working, action);
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
          on: granted.action.label,
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
    // Disarming a trap (1.669).
    if (option.disarms) {
      resolveDisarm(ctx, working, option.disarms);
      noteOutcome(ctx);
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
    } else if (switching?.switches && "take" in switching.switches) {
      // A weapon a call lends taken in hand (1.739), theirs while that one stands.
      const index = switching.switches.take;
      const lent = working.sheet?.items?.[index]?.lent;
      const from = ctx.state.combatants.find(
        (one) => one.calledBy === working.id && one.calledWith === lent?.by && !one.dismissed && !one.defeated,
      );
      if (from) (working.lentTaken ??= {})[index] = from.id;
      ctx.events.push({
        type: "switch",
        actorId: working.id,
        optionId: switching.id,
        label: switching.label,
        on: true,
      });
    } else if (switching?.switches && "shift" in switching.switches) {
      // Some of a weapon's bonus to their defense (1.737), until the start of their next turn.
      const { item, amount } = switching.switches.shift;
      shiftWeaponBonus(working, item, -amount);
      working.bonusShift = { item, amount };
      ctx.events.push({
        type: "switch",
        actorId: working.id,
        optionId: switching.id,
        label: switching.label,
        on: true,
      });
    } else if (switching?.switches && "knockOut" in switching.switches) {
      // Pulling their blows, or no longer (1.720).
      const on = !working.knocksOut;
      if (on) working.knocksOut = true;
      else delete working.knocksOut;
      working.flags.knockOutSwitched = working.flags.knockOutSwitched ? "back" : true;
      ctx.events.push({ type: "switch", actorId: working.id, optionId: switching.id, label: switching.label, on });
    } else if (switching?.switches && "conjured" in switching.switches) {
      // A weapon put in hand, put away for nothing (1.308).
      unconjure(ctx, working, switching.switches.conjured);
    } else if (switching?.switches && "called" in switching.switches) {
      // Those it called sent away as an action (1.449): Summon Demon's dismissal.
      const by = switching.switches.called;
      // Not those ignoring every order (1.665).
      dismissCalled(ctx, working, (one) => one.calledWith === by && !one.calledDisobeys, "dismissed");
    } else if (switching?.switches && "form" in switching.switches) {
      // Into another of its forms (1.575): the item as that form, and what it does then.
      const { item: index, to } = switching.switches.form;
      const formed = working.itemFormed?.[index]?.[to];
      const held = working.sheet?.items?.[index];
      if (!formed || !held || !working.sheet?.items) return refusal(state, choice.actorId, "unknown-option", option.id);
      const { form: _form, ...rest } = held;
      working.sheet.items = working.sheet.items.map((one, at) =>
        at === index ? { ...rest, item: formed.item, ...(to ? { form: to } : {}) } : one,
      );
      working.actions = [
        ...working.actions.filter((one) => rulesetActionItemIndex(one) !== index),
        ...structuredClone(formed.actions),
      ];
      working.itemForms = { ...(working.itemForms ?? {}), [index]: to };
      const forms = held.item.forms!;
      ctx.events.push({
        type: "reformed",
        actorId: working.id,
        label: held.name ?? forms.label,
        form: to ? forms.into[to - 1]!.label : forms.label,
      });
    } else if (switching?.switches && "item" in switching.switches) {
      const on = !rulesetItemOn(working, switching.switches.item);
      working.on = { ...(working.on ?? {}), [switching.switches.item]: on };
      ctx.events.push({ type: "switch", actorId: working.id, optionId: switching.id, label: switching.label, on });
      itemSwitched(working, switching.switches.item, on);
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
  if (striking && !striking.sequence && rulesetIsAttack(striking)) countAttack(ctx, working, striking);
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

  let aimed: RulesetCombatEvent | undefined;
  if (area && choice.at) {
    aimed = {
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
    };
    ctx.events.push(aimed);
  }

  const own = working.actions.find((entry) => entry.id === option.id)!;
  const action = withChosenKinds(
    definition,
    mode ? (rulesetModedAction(definition, own, mode.id) ?? own) : own,
    choice.kinds,
  );
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
  const unpaid = working.sheet?.live;
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith, amount);
  // More of an item's charges (1.269), spent with its own.
  const moreCharges = rulesetChargeSteps(action, choice.payWith);
  if (moreCharges) ctx.moreCharges = moreCharges;
  if (!paid) {
    // The menu said it was affordable, so only a `payWith` the sheet refuses can land here.
    return refusal(state, choice.actorId, "insufficient", option.id);
  }
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  // Out of a worn item's charges (1.572).
  if (paid.itemCharges) (working.charges ??= {})[paid.itemCharges.item] = paid.itemCharges.now;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({
      type: "spend",
      actorId: working.id,
      pool: entry.pool,
      label: entry.label,
      amount: entry.amount,
      // On what, so a cast line names its spell (laptop pass 6 2026-10-26: "spends 1 1st-level slots").
      on: action.label,
    });
  }
  // And what it was altered with (1.253), each at the level it was paid at.
  for (const alter of alters ?? []) {
    // Its counter's uses already spent since it came back, before this one (1.415).
    const spentBefore = alter.alters?.backlash ? counterSpent(definition, working, alter) : 0;
    const price = planRulesetAlterCost(definition, working, alter, action, choice.payWith);
    if (!price) return refusal(state, choice.actorId, "insufficient", option.id);
    if (alter.alters?.backlash) {
      (ctx.backlash ??= []).push({
        backlash: alter.alters.backlash,
        actorId: working.id,
        level: rulesetPaidLevel(definition, working, action, choice.payWith),
        spentBefore,
        label: alter.label,
      });
    }
    if (price.live && working.sheet) working.sheet.live = price.live;
    countRulesetSpend(working, price.cost);
    for (const entry of price.cost) {
      ctx.events.push({
        type: "spend",
        actorId: working.id,
        pool: entry.pool,
        label: entry.label,
        amount: entry.amount,
        on: alter.label,
      });
    }
    spendAvailability(ctx, working, alter);
  }
  // A spell glyph (1.454): the entry stored in it, no higher than the glyph is paid at, paid too.
  const storedId = mode ? own.modes?.find((one) => one.id === mode.id)?.stores : undefined;
  const stored = storedId ? working.actions.find((one) => one.id === storedId) : undefined;
  if (storedId) {
    if (!stored) return refusal(state, choice.actorId, "unknown-mode", option.id);
    const price = planRulesetCombatCost(definition, working, stored);
    if (!price) return refusal(state, choice.actorId, "insufficient", option.id);
    // Each one's level, as the pools it was paid out of say.
    const levelOf = (one: RulesetCombatAction, cost: Array<{ pool: string }>) =>
      Math.max(0, ...cost.map((entry) => rulesetPaidLevel(definition, working, one, entry.pool)));
    const storedLevel = levelOf(stored, price.cost);
    if (storedLevel < 1 || storedLevel > levelOf(action, paid.cost)) {
      return refusal(state, choice.actorId, "unknown-mode", option.id);
    }
    if (price.live && working.sheet) working.sheet.live = price.live;
    countRulesetSpend(working, price.cost);
    for (const entry of price.cost) {
      ctx.events.push({
        type: "spend",
        actorId: working.id,
        pool: entry.pool,
        label: entry.label,
        amount: entry.amount,
        on: stored.label,
      });
    }
    spendAvailability(ctx, working, stored);
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
  // One of a choice (1.787): the rest of it are gone with it.
  if (following)
    working.flags.followUps = working.flags.followUps!.filter(
      (one) => one !== following && (!following.oneOf || one.oneOf !== following.oneOf),
    );
  if (following?.uncharged) ctx.uncharged = true;
  if (!following?.paid) spendAvailability(ctx, working, action);
  markUsedOn(ctx.state, working, action, workingTargets);
  // A creature's, spared once used on them at all (1.674).
  if (action.sparedAfter && !action.sparedAfter.whenSaved && !action.sparedAfter.whenEnds) {
    for (const target of workingTargets) spare(target, rulesetSparedKey(working, action));
  }
  if (action.conjures && mode) conjure(ctx, working, action, mode.id);
  if (action.makesItems) makeItems(ctx, working, action);
  // Those it commands through this action act at their next turn (1.736): a chain devil's chains.
  for (const one of ctx.state.combatants) {
    if (one.calledBy === working.id && one.calledCommand?.action === action.id) one.calledCommand.given = true;
  }
  // Then one spell of its own spellcasting (1.787): a glabrezu's, after its pincers.
  if (!option.followUp && action.castsOne) {
    const spells = working.actions.filter((one) => one.innate && !one.reaction && !one.lair && one.id !== action.id);
    working.flags.followUps = [
      ...(working.flags.followUps ?? []).filter((one) => !spells.some((spell) => spell.id === one.id)),
      ...spells.map((spell) => ({ id: spell.id, oneOf: action.id })),
    ];
  }
  if (!option.followUp && action.followUp) {
    (working.flags.followUps ??= []).push({
      id: action.followUp,
      ...(action.pairedWith?.includes(action.followUp) ? { paid: true as const } : {}),
    });
  }
  // A strike again made (1.428): once a turn. One offered after a weapon attack at one creature, the
  // same weapon at another near them, for nothing: Horde Breaker.
  if (action.strikeAgain) working.flags.struckAgain = true;
  else offerStrikeAgain(ctx, working, action, workingTargets);
  // A chance rolled once it is paid for (1.441): failed, it does nothing, and with `failUses` that
  // row is spent in place of its own.
  if (action.chance && !rollsChance(ctx, working, action, unpaid)) {
    noteOutcome(ctx);
    return finish();
  }
  // An item's gate is rolled once the item is spent: failed, it is used up for nothing, and nobody is
  // asked about a use that never happened.
  if (action.itemUse?.gate && !passesGate(ctx, working, action, action.itemUse.gate)) {
    noteOutcome(ctx);
    return finish();
  }
  // Torn as it was used on with no charges left (1.624), or backfired in place of working (1.630): it
  // did nothing, so nothing was aimed either: only what tore it is told.
  if (ctx.tore) {
    delete ctx.tore;
    if (aimed && ctx.events.includes(aimed)) ctx.events.splice(ctx.events.indexOf(aimed), 1);
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
    // Whoever they laid hands on answers a touch (1.527), won or lost: Heated Body.
    if (workingTargets[0]) answerHit(ctx, workingTargets[0], working, action, true);
    holderActed(ctx, working, action, before);
    noteOutcome(ctx);
    return finish();
  }
  // A creature's move on its own turn (1.607), its turn's own movement kept: Aggressive.
  if (moveTo && action.move) {
    legendaryMove(ctx, working, action.move, moveTo.path);
    noteOutcome(ctx);
    return finish();
  }
  // An engulf (1.403): the walk, and whoever it enters on the way; off a board, the one aimed at.
  if (action.engulf) {
    if (engulfTo) engulfWalk(ctx, working, action, engulfTo.path);
    else engulfLands(ctx, working, action, workingTargets);
    noteOutcome(ctx);
    return finish();
  }
  // A leap (1.725): the jump, and whoever it lands on.
  if (action.leapsOnto && leapTo) {
    walkOn(ctx, working, {
      kind: "walk",
      actorId: working.id,
      from: { x: working.x!, y: working.y! },
      walked: [],
      path: [...leapTo.path],
      asked: [],
      spent: 0,
      jump: true,
      leap: { actionId: action.id },
    });
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
    ...(choice.designates?.length ? { designates: [...choice.designates] } : {}),
    ...(choice.kinds?.length ? { kinds: [...choice.kinds] } : {}),
    // Kept on the resume as well as the context: a window this opens (a Counterspell asked about
    // a Misty Step) closes in another call, which begins afresh.
    ...(ctx.teleport
      ? {
          teleport: {
            ...(ctx.teleport.to ? { to: { ...ctx.teleport.to } } : {}),
            carries: [...ctx.teleport.carries],
          },
        }
      : {}),
    ...(ctx.carriesTo ? { carriesTo: { ...ctx.carriesTo } } : {}),
  };
  // A cast taking rounds (1.461): begun now, and landing as its last round is spent.
  if (action.castingRounds) {
    beginCasting(ctx, working, action, resume, budget);
    noteOutcome(ctx);
    return finish();
  }
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

/** How many of an alteration's counter's uses are spent since it last came back (1.415). */
function counterSpent(definition: RulesetDefinition, holder: RulesetCombatant, alter: RulesetCombatAction): number {
  const name = alter.use?.name;
  if (!holder.sheet || !name) return 0;
  const wanted = `counters:${name.trim().toLowerCase()}`;
  const pool = readRulesetLive(definition, holder.sheet.build, holder.sheet.live, holder.sheet.items).pools.find(
    (one) => one.key === wanted || one.label.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  return pool ? Math.max(0, pool.max - pool.value) : 0;
}

/** An alteration's harm to its user (1.415): past the first `free` uses, `dice` for each level the
 *  entry was paid at, and `grows` more for each use past the first that harms. Overchannel. */
function backlashOn(ctx: RulesetCombatContext, one: NonNullable<RulesetCombatContext["backlash"]>[number]): void {
  const holder = rulesetCombatant(ctx.state, one.actorId);
  const { backlash, level, spentBefore } = one;
  if (!holder || holder.defeated || level <= 0 || spentBefore < backlash.free) return;
  const base = parseRulesetCombatDice(backlash.dice);
  const grows = backlash.grows ? parseRulesetCombatDice(backlash.grows) : null;
  if (!base) return;
  const past = spentBefore - backlash.free;
  const rolled = rollAmount(ctx, { count: base.count * level, sides: base.sides, flat: base.flat * level });
  const more =
    grows && past > 0
      ? rollAmount(ctx, { count: grows.count * level * past, sides: grows.sides, flat: grows.flat * level * past })
      : { rolls: [], flat: 0, total: 0 };
  const dealt = applyDamage(ctx, holder, {
    sourceId: holder.id,
    label: one.label,
    ...(backlash.type ? { damageType: backlash.type } : {}),
    rolls: [...rolled.rolls, ...more.rolls],
    flat: rolled.flat + more.flat,
    amount: rolled.total + more.total,
    ...(backlash.unblockable ? { unblockable: true as const } : {}),
  });
  afterBlow(ctx, holder, dealt, false);
}

/** What a layered wall stands in as for a blow or an area (1.490): struck by anything, taking all of it. */
const LAYERED_STAND_IN = { defense: 0, health: 100000 };

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

const CUT_ID = "cut-free";

/**
 * A blow struck at a condition to cut it away (1.531), paid for as any attack is: the condition stands
 * in as a thing with its `cutFree` defense and what is left of it, for that blow only. Only damage of
 * the types it names wears it down; with none left, it ends on its holder.
 */
function strikeCut(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const asked = choice.cut;
  const offered =
    asked && typeof asked === "object"
      ? option.cuts?.find((one) => one.holderId === asked.holderId && one.condition === asked.condition)
      : undefined;
  const rule = combat.conditions?.find((entry) => entry.condition === offered?.condition)?.cutFree;
  if (!offered || !rule || choice.targetIds.length > 0 || choice.mode !== undefined) {
    return refusal(state, choice.actorId, "bad-target", option.id);
  }
  const own = actor.actions.find((entry) => entry.id === option.id)!;
  const styles = rulesetAttackStyles(combat, actor, own);
  if (choice.style !== undefined && !styles.some((style) => style.id === choice.style)) {
    return refusal(state, choice.actorId, "unknown-style", option.id);
  }
  const style = styles.find((one) => one.id === choice.style) ?? styles[0];
  const { ctx, finish } = begin(definition, combat, state, roller);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const holder = rulesetCombatant(ctx.state, offered.holderId)!;
  const action = working.actions.find((entry) => entry.id === option.id)!;
  if (option.budget) spendBudget(ctx, working, option.budget);
  countAttack(ctx, working, action);
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith);
  if (!paid) return refusal(state, choice.actorId, "insufficient", option.id);
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  // Out of a worn item's charges (1.572).
  if (paid.itemCharges) (working.charges ??= {})[paid.itemCharges.item] = paid.itemCharges.now;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({
      type: "spend",
      actorId: working.id,
      pool: entry.pool,
      label: entry.label,
      amount: entry.amount,
      // On what, so a cast line names its spell (laptop pass 6 2026-10-26: "spends 1 1st-level slots").
      on: action.label,
    });
  }
  spendAvailability(ctx, working, action);
  const held = holder.tracked.filter((one) => one.condition === offered.condition);
  const before = held[0]?.cutLeft ?? rule.health;
  const at = rulesetPositionOf(holder);
  const stand = objectStandIn(CUT_ID, offered.label, working, rule, before, at ?? { x: 0, y: 0 });
  if (!at) {
    delete stand.x;
    delete stand.y;
  }
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
  const byType = dealtByType(ctx, from, CUT_ID);
  const { roll, dealt } = objectBlows(ctx, from, [CUT_ID])[CUT_ID]!;
  const cutting = rule.damageTypes
    ? rule.damageTypes.reduce((total, type) => total + (byType.get(type.trim().toLowerCase()) ?? 0), 0)
    : dealt;
  const outcome = roll?.outcome === "miss" || roll?.outcome === "critical" ? roll.outcome : "hit";
  const left = Math.max(0, before - cutting);
  for (const one of held) one.cutLeft = left;
  ctx.events.push({
    type: "cut",
    actorId: working.id,
    holderId: holder.id,
    label: action.label,
    condition: offered.label,
    outcome,
    dealt: cutting,
    left,
    ...(left <= 0 ? { freed: true as const } : {}),
  });
  if (left <= 0) removeCondition(ctx, holder, offered.condition, "freed");
  noteOutcome(ctx);
  return finish();
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
    rulesetStandingLayers(state).some((one) => at(one.cells)) ||
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
  countAttack(ctx, working, action);
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith);
  if (!paid) return refusal(state, choice.actorId, "insufficient", option.id);
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  // Out of a worn item's charges (1.572).
  if (paid.itemCharges) (working.charges ??= {})[paid.itemCharges.item] = paid.itemCharges.now;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({
      type: "spend",
      actorId: working.id,
      pool: entry.pool,
      label: entry.label,
      amount: entry.amount,
      // On what, so a cast line names its spell (laptop pass 6 2026-10-26: "spends 1 1st-level slots").
      on: action.label,
    });
  }
  spendAvailability(ctx, working, action);
  const standing = rulesetStandingSections(ctx.state).find(({ section }) => at(section.cells));
  const prop = standing ? undefined : rulesetStandingProps(ctx.state).find((one) => at(one.cells));
  // A layered wall (1.490): it stands in for the blow, never broken by it, and what the blow dealt of
  // each type is read against its first standing layer.
  const layered = standing || prop ? undefined : rulesetStandingLayers(ctx.state).find((one) => at(one.cells));
  if (layered) {
    const stand = objectStandIn(
      SECTION_ID,
      layered.zone.label,
      working,
      LAYERED_STAND_IN,
      LAYERED_STAND_IN.health,
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
    const damage = dealtByType(ctx, from, SECTION_ID);
    objectBlows(ctx, from, [SECTION_ID]);
    wearLayer(ctx, layered.caster, layered.zone, layered.action, { damage }, working.id);
    noteOutcome(ctx);
    return finish();
  }
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

/** The concentration a cast taking rounds is held by (1.461), apart from the entry's own. */
function castingHeld(optionId: string): string {
  return `casting:${optionId}`;
}

/** A cast taking rounds begun (1.461): paid for now, concentrated on, and given back if it fails. */
function beginCasting(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
  budget: string | undefined,
): void {
  const paid = ctx.events.flatMap((event) =>
    event.type === "spend" && event.actorId === actor.id ? [{ pool: event.pool, amount: event.amount }] : [],
  );
  startConcentration(ctx, actor, { ...action, id: castingHeld(action.id) });
  const left = action.castingRounds! - 1;
  actor.casting = { ...resume, label: action.label, ...(budget ? { budget } : {}), left, paid };
  ctx.events.push({ type: "casting", actorId: actor.id, label: action.label, outcome: "started", left });
}

/** A cast taking rounds failing (1.461): what it cost given back. */
function loseCasting(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const casting = actor.casting;
  if (!casting) return;
  delete actor.casting;
  for (const { pool, amount } of casting.paid) {
    if (actor.sheet && amount > 0) writeRulesetSheet(ctx.definition, actor, { op: "restore", pool, amount });
  }
  ctx.events.push({ type: "casting", actorId: actor.id, label: casting.label, outcome: "lost" });
}

/** A cast taking rounds carried on as its maker's turn starts (1.461): its budget spent on it again,
 *  and on the last, it lands. One who cannot act, or has no budget to spend, loses it. */
function continueCasting(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const casting = actor.casting;
  if (!casting) return;
  const effects = rulesetCombatEffects(ctx.definition, ctx.combat, actor, ctx.state);
  if (
    !rulesetCombatStanding(actor) ||
    effects.has("cannot-act") ||
    (casting.budget !== undefined && (actor.budgets[casting.budget] ?? 0) < 1)
  ) {
    if (actor.concentrating?.actionId === castingHeld(casting.optionId)) endConcentration(ctx, actor, "spent");
    loseCasting(ctx, actor);
    return;
  }
  if (casting.budget !== undefined) spendBudget(ctx, actor, casting.budget);
  casting.left -= 1;
  if (casting.left > 0) {
    ctx.events.push({
      type: "casting",
      actorId: actor.id,
      label: casting.label,
      outcome: "continued",
      left: casting.left,
    });
    return;
  }
  delete actor.casting;
  // Done casting, its concentration on the casting is over; the entry's own may begin as it lands.
  if (actor.concentrating?.actionId === castingHeld(casting.optionId)) {
    actor.concentrating = null;
    const concentration = ctx.combat.concentration;
    if (concentration) writeRulesetSheet(ctx.definition, actor, { op: "note", field: concentration.text, value: "" });
  }
  const { label, budget: _budget, left: _left, paid: _paid, ...resume } = casting;
  const found = actor.actions.find((entry) => entry.id === resume.optionId);
  const action = found && rulesetResumedAction(actor, found, resume.alters, resume.spares, resume.heightens);
  if (!action) {
    ctx.events.push({ type: "casting", actorId: actor.id, label, outcome: "lost" });
    return;
  }
  ctx.events.push({ type: "casting", actorId: actor.id, label, outcome: "completed" });
  reopenAction(ctx, actor, action, resume);
}

/** A fresh use opens the same moments whether it was held over or a summon strikes again; a summon's
 *  strike is no use of the spell, though, so only its aim is answered (no Counterspell for Spiritual
 *  Weapon's second swing). */
function reopenAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
): void {
  // Used subtly (1.253), nobody sees it being used to answer it.
  const held =
    (!action.altered?.subtle &&
      !resume.summon &&
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
  /** Whom it is made to find (1.567): Enthrall. */
  perceiving?: string,
): RulesetContestSide {
  // What is narrowed to the ability the check is made with counts (1.188): Rage's Strength. And,
  // since 1.290, what is narrowed to the skill it is read off: Stealth in heavy armor.
  const ability = rulesetCheckAbility(ctx.definition, check);
  const skill = rulesetCheckSkill(ctx.definition, check);
  const mode = rulesetCheckMode(ctx.definition, ctx.combat, who, ctx.state, skill, ability, taken, perceiving);
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
    const bonuses = rollBonuses(ctx, checkModifiers(), who);
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
  const first = throwOwnDice(ctx, who, "checks", count, sides);
  const second = mode === "normal" ? null : throwOwnDice(ctx, who, "checks", count, sides);
  const thrown = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  // Floors under the check (1.418): Reliable Talent lifts a single die, Indomitable Might the total.
  const floors = checkFloors(ctx, who, skill, ability);
  const kept = count === 1 && floors.face !== undefined ? Math.max(thrown, floors.face) : thrown;
  const bonuses = rollBonuses(ctx, checkModifiers(), who);
  return {
    check,
    rolls: second ? [...first, ...second] : first,
    modifier,
    total: Math.max(kept + modifier + bonusTotal(bonuses), floors.total ?? -Infinity),
    ...(mode === "normal" ? {} : { mode }),
    ...(bonuses.length > 0 ? { bonuses } : {}),
  };
}

/** The floors under one of this combatant's checks (1.418), off their active conditions and levels:
 *  the highest face and the highest total. A `proficient` one counts only on a skill their sheet adds
 *  their whole proficiency to; a creature off a stat block has none of those. */
function checkFloors(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  skill: string | undefined,
  ability: string | undefined,
): { face?: number; total?: number } {
  const out: { face?: number; total?: number } = {};
  const floors = rulesetActiveConditions(ctx.definition, ctx.combat, who, ctx.state).flatMap((entry) =>
    entry.checkFloor ? [entry.checkFloor] : [],
  );
  if (floors.length === 0) return out;
  const about = (narrowed: readonly string[] | undefined, id: string | undefined) =>
    !narrowed || (id !== undefined && narrowed.includes(id));
  let trained: boolean | undefined;
  const isTrained = () => {
    if (trained !== undefined) return trained;
    const sheet = who.sheet;
    const tier =
      sheet && skill
        ? evaluateRulesetSheetLive(ctx.definition, sheet.build, sheet.live, sheet.items, who.abilityConditions)
            .skillTiers[skill]
        : undefined;
    return (trained = rulesetTierAddsProficiency(ctx.definition, tier));
  };
  for (const floor of floors) {
    if (!about(floor.skills, skill) || !about(floor.abilities, ability)) continue;
    if (floor.proficient && !isTrained()) continue;
    if (floor.face !== undefined) out.face = Math.max(out.face ?? floor.face, floor.face);
    const total = floor.total ? rulesetHolderValue(ctx.definition, who, floor.total) : undefined;
    if (total !== undefined) out.total = Math.max(out.total ?? total, total);
  }
  return out;
}

/** How many more cells a contest's win pushes by (1.587), read off the actor's sheet, or its caller's
 *  where it has none: Arcane Hand's Forceful Hand, its caster's 5 + 5 x modifier feet. */
function contestPushRead(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  contest: NonNullable<RulesetCombatAction["contest"]>,
): number {
  const perCell = ctx.definition.combat?.distance?.perCell;
  if (contest.pushRead === undefined || perCell === undefined) return 0;
  const owner = actor.sheet ? actor : actor.calledBy ? rulesetCombatant(ctx.state, actor.calledBy) : undefined;
  const sheet = owner?.sheet;
  const ref = contest.pushRead;
  const value = sheet
    ? resolveRulesetValueRef(
        ctx.definition,
        sheet.build,
        ref,
        evaluateRulesetSheetLive(ctx.definition, sheet.build, sheet.live, sheet.items, owner!.abilityConditions),
      )
    : typeof ref === "number"
      ? ref
      : typeof ref === "object" && ref && "const" in ref && typeof ref.const === "number"
        ? ref.const
        : 0;
  return Number.isFinite(value) && value > 0 ? rulesetInCells(value, perCell) : 0;
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
  const picked = rulesetContestCheck(actor, contest, "attacker");
  // What it adds to the actor's own check (1.703): a Talisman of the Sphere's.
  const mine = contest.attackerAdds ? { ...picked, modifier: picked.modifier + contest.attackerAdds } : picked;
  // With advantage at one no bigger than it says (1.587): the Forceful Hand at a Medium creature.
  const atMost = contest.advantageAtMostSize
    ? ctx.combat.sizes?.order.findIndex((one) => one.id === contest.advantageAtMostSize)
    : undefined;
  const targetSize = atMost !== undefined && atMost >= 0 ? rulesetSizeRank(ctx.combat, target) : undefined;
  const attacker =
    (targetSize !== undefined && atMost !== undefined && targetSize <= atMost) || contest.attackerAdvantage
      ? throwCheck(ctx, actor, mine.check, mine.modifier, { advantage: true, disadvantage: false })
      : thrown(actor, mine.check, mine.modifier);
  // Breaking free of a hold that names its escape DC (1.103): nobody throws for the holder, and the
  // actor wins on meeting the number.
  const escapeDc = rulesetEscapeDc(actor, contest, target);
  // What keeps the one pulled out inside (1.407), and what it does to whoever pulls.
  const pulledFrom = contest.pulls
    ? target.tracked.find((entry) => entry.condition === contest.targetHolds)
    : undefined;
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
  // Reaching in hurts, win or lose (1.407): the cube's acid on whoever pulls.
  if (pulledFrom?.harmsPuller) {
    conditionHarm(ctx, actor, pulledFrom.condition, pulledFrom.source, pulledFrom.harmsPuller, 1);
  }
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
  // On both, while the target holds what it names (1.553): a pin's restraint.
  if (contest.both) {
    const tie = { holderId: target.id, condition: contest.both.whileTargetHolds };
    for (const condition of contest.both.applies) {
      for (const one of [target, actor]) {
        applyConditionId(ctx, one, condition, { condition, duration: "instant" }, { sourceId: actor.id });
        const put = one.tracked.find((entry) => entry.condition === condition && entry.source === actor.id);
        if (put) put.whileHeld = { ...tie };
      }
    }
  }
  // And farther by what is read off its sheet, or its caller's (1.587): the Forceful Hand.
  const pushed = (contest.push ?? 0) + contestPushRead(ctx, actor, contest);
  if (contest.push !== undefined || pushed > 0) {
    const event = pushTarget(ctx, actor, target, pushed);
    // And after them, into the last cell they left (1.598): the Forceful Hand.
    if (contest.follows && event) followPushed(ctx, actor, target, event);
  }
  // Treated in time (1.193): the DC 10 Medicine check that keeps the dying from dying.
  if (contest.stabilizes && target.dying && !target.stable && !target.defeated) {
    target.stable = true;
    clearDyingTracks(ctx, target);
    ctx.events.push({ type: "stabilized", targetId: target.id, sourceId: actor.id });
  }
}

/** What a blow does to whoever it dropped (1.677): left stable, then what it puts on them. */
function fellByBlow(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  const rule = action.onFell!;
  if (rule.stabilizes && target.dying && !target.stable) {
    target.stable = true;
    clearDyingTracks(ctx, target);
    ctx.events.push({ type: "stabilized", targetId: target.id, sourceId: actor.id });
  }
  for (const applies of rule.applies ?? []) {
    applyConditionId(ctx, target, applies.condition, applies, {
      sourceId: actor.id,
      action: [action.id, action.label],
    });
  }
}

/** Whether `actor` wins the contest an action is decided by against `target` (1.565): Telekinesis. */
function wonContest(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): boolean {
  const contested = action.contested!;
  const before = ctx.events.length;
  resolveContest(ctx, actor, action, { id: action.id, ...contested }, target);
  const thrown = ctx.events.slice(before).find((event) => event.type === "contest");
  return thrown?.type === "contest" && thrown.winner === "actor";
}

/** Somebody set down where an action that moves them was aimed (1.565), with no step between, so
 *  nobody gets a strike at them, and lifted the levels it says; somebody left up in the air with
 *  nothing to keep them there comes down. Telekinesis. */
function carryTarget(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  const to = ctx.carriesTo!;
  delete ctx.carriesTo;
  const grid = ctx.state.board?.grid;
  const from = rulesetPositionOf(target);
  if (!grid || !from) return;
  // Only where there is still room for them.
  if ((to.x !== from.x || to.y !== from.y) && !rulesetRoomAt(ctx.state, grid, target, to)) return;
  target.x = to.x;
  target.y = to.y;
  const level = elevationAt(grid, to.x, to.y) + to.rises;
  if (to.rises > 0) target.altitude = level;
  else delete target.altitude;
  // A mount moved against its will may throw its rider (1.496).
  if (target.riddenBy) (ctx.shakenMounts ??= new Set()).add(target.id);
  ctx.events.push({
    type: "carried",
    actorId: actor.id,
    targetId: target.id,
    label: action.label,
    from,
    to: { x: to.x, y: to.y },
    ...(to.rises > 0 ? { rises: to.rises } : {}),
  });
  groundFlier(ctx, target);
}

/** Somebody pushed `cells` straight away from `actor`, as far as the way allows: by a contest won
 *  (combat C6b) or by an action that lands (1.182). */
function pushTarget(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  cells: number,
  /** The way already worked out (1.631), when it is not straight away from `actor`. */
  path = rulesetPushPath(ctx.state, actor.id, target.id, cells),
): Extract<RulesetCombatEvent, { type: "pushed" }> | undefined {
  const from = rulesetPositionOf(target);
  // Braced against it (1.718): Dwarven Plate, so much less of the way.
  path = bracedPath(ctx, target, path);
  const to = path[path.length - 1];
  if (!from || !to) return undefined;
  target.x = to.x;
  target.y = to.y;
  // A mount moved against its will may throw its rider (1.496).
  if (target.riddenBy) (ctx.shakenMounts ??= new Set()).add(target.id);
  const event: Extract<RulesetCombatEvent, { type: "pushed" }> = {
    type: "pushed",
    actorId: actor.id,
    targetId: target.id,
    from,
    to: { ...to },
    path,
  };
  ctx.events.push(event);
  // Shoved off a step of two levels or more, which is where a push stops: a fall (combat C6b).
  const grid = ctx.state.board?.grid;
  const edge = path.length > 1 ? path[path.length - 2]! : from;
  const levels = grid ? elevationAt(grid, edge.x, edge.y) - elevationAt(grid, to.x, to.y) : 0;
  if (levels >= 2) fall(ctx, actor, target, levels);
  // Whoever hangs on to them is carried along (1.676), into the last cell they passed.
  for (const id of attachedClingers(ctx, target)) {
    const clinger = rulesetCombatant(ctx.state, id);
    if (!clinger || clinger.id === actor.id) continue;
    clinger.x = edge.x;
    clinger.y = edge.y;
  }
  return event;
}

/** The way somebody is moved against their will, less what they brace against it (1.718): a
 *  condition's `pushReducedBy`, paying its budget where it names one. Never while up in the air. */
function bracedPath(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  path: RulesetCombatCell[],
): RulesetCombatCell[] {
  const perCell = ctx.combat.distance?.perCell;
  if (path.length === 0 || !perCell || rulesetAirborne(ctx.state.board?.grid, target)) return path;
  const brace = rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).find(
    (entry) =>
      entry.pushReducedBy &&
      (entry.pushReducedBy.budget === undefined || (target.budgets[entry.pushReducedBy.budget] ?? 0) >= 1),
  );
  const rule = brace?.pushReducedBy;
  if (!brace || !rule) return path;
  const cells = Math.min(path.length, rulesetInCells(rule.by, perCell));
  if (cells < 1) return path;
  if (rule.budget !== undefined) spendBudget(ctx, target, rule.budget);
  const label =
    ctx.definition.sheet.live.conditions.find((one) => one.id === brace.condition)?.label ?? brace.condition;
  ctx.events.push({ type: "pushBraced", actorId: target.id, label, cells });
  return path.slice(0, path.length - cells);
}

/** Where a walk ends (1.681): squeezed into less of themselves between walls, with the ruleset's
 *  condition for it, or back to their whole size once they fit again. */
function settleSqueeze(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const at = rulesetPositionOf(actor);
  if (!at || !ctx.combat.sizes) return;
  const squeeze = rulesetSqueezeAt(ctx.definition, ctx.state, actor, at);
  const condition = ctx.combat.sizes.squeezing?.condition;
  if (squeeze) {
    actor.squeezedFrom ??= rulesetSpanOf(actor);
    actor.span = squeeze.span;
    const held = condition && actor.tracked.some((entry) => entry.condition === condition);
    if (squeeze.condition && !held)
      applyConditionId(
        ctx,
        actor,
        squeeze.condition,
        { condition: squeeze.condition, duration: "instant" } as RulesetCombatApplies,
        { sourceId: actor.id },
      );
    if (!squeeze.condition && held) removeCondition(ctx, actor, condition, "moved");
    return;
  }
  if (actor.squeezedFrom === undefined) return;
  actor.span = actor.squeezedFrom;
  delete actor.squeezedFrom;
  if (condition && actor.tracked.some((entry) => entry.condition === condition)) {
    removeCondition(ctx, actor, condition, "moved");
  }
}

/** Who hangs on to `holder` by a condition that `attaches` (1.676), still standing. */
function attachedClingers(ctx: RulesetCombatContext, holder: RulesetCombatant): string[] {
  const rules = ctx.combat.conditions;
  if (!rules?.some((one) => one.attaches)) return [];
  return holder.tracked.flatMap((entry) => {
    if (!entry.source || entry.source === holder.id) return [];
    if (!rules.some((one) => one.condition === entry.condition && one.attaches)) return [];
    const source = rulesetCombatant(ctx.state, entry.source);
    return source && rulesetCombatStanding(source) && !source.defeated ? [source.id] : [];
  });
}

/** Somebody who saved against an area that pushes them out (1.631), pushed straight away from where it
 *  was aimed (its user, for a burst around them) until no cell they fill is inside it, as far as the
 *  way allows: a Bead of Force's sphere. */
function pushOutOfArea(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): void {
  const grid = ctx.state.board?.grid;
  const centre = ctx.aimedAt ?? rulesetPositionOf(actor);
  if (!grid || !centre || !action.area || target.id === actor.id || !rulesetCombatStanding(target)) return;
  const covered = new Set(areaCellsFor(ctx.state, actor, action.id, centre).map((cell) => `${cell.x},${cell.y}`));
  const span = rulesetSpanOf(target);
  const inside = (at: RulesetCombatCell) =>
    rulesetFootprintAt(at, span).some((cell) => covered.has(`${cell.x},${cell.y}`));
  const start = rulesetPositionOf(target);
  if (!start || !inside(start)) return;
  const path = rulesetPushPath(ctx.state, actor.id, target.id, grid.width + grid.height, centre);
  const out = path.findIndex((cell) => !inside(cell));
  pushTarget(ctx, actor, target, 0, out >= 0 ? path.slice(0, out + 1) : path);
}

/** The pusher moved with the one it pushed (1.598), into the last cell they left on the way, or for
 *  one wider than a cell (or with no room there) the open place beside them nearest where it stands,
 *  unless still beside them or with no room anywhere beside. Drawing no strikes, as a push draws
 *  none. The Arcane Hand, two cells a side, follows a goblin pushed away from it. */
function followPushed(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  pushed: Extract<RulesetCombatEvent, { type: "pushed" }>,
): void {
  const grid = ctx.state.board?.grid;
  const from = rulesetPositionOf(actor);
  if (!grid || !from || target.defeated || rulesetGap(actor, target) <= 1) return;
  const last = pushed.path.length > 1 ? pushed.path[pushed.path.length - 2]! : pushed.from;
  const span = rulesetSpanOf(actor);
  const reach = rulesetSpanOf(target);
  const to = rulesetPositionOf(target)!;
  let into: RulesetCombatCell | undefined;
  let best = Number.POSITIVE_INFINITY;
  // Every place that leaves them beside the target, nearest the pusher, then nearest the last cell left.
  for (let y = to.y - span; y <= to.y + reach; y++) {
    for (let x = to.x - span; x <= to.x + reach; x++) {
      const cell = { x, y };
      if (rulesetGapFrom(cell, span, target) !== 1 || !rulesetRoomAt(ctx.state, grid, actor, cell)) continue;
      const score =
        Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) * 1000 +
        Math.max(Math.abs(x - last.x), Math.abs(y - last.y));
      if (score < best) {
        best = score;
        into = cell;
      }
    }
  }
  if (!into) return;
  const before = zonesAround(ctx);
  actor.x = into.x;
  actor.y = into.y;
  pushed.followed = { from: { ...from }, to: { ...into } };
  zonesEntered(ctx, actor, before);
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

/** What the faller's conditions take off a fall's own damage (1.413), each condition that did spent
 *  by it: Slow Fall's five times the monk's level, put on as the answer to the fall. */
function lessenFall(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  harm: { rolls: number[]; flat: number; amount: number },
  damageType: string | undefined,
): void {
  const lessening = rulesetConditionModifiers(ctx.definition, ctx.combat, target, "damage-taken", ctx.state).filter(
    ({ modifier }) =>
      modifier.falls && (!modifier.damageType || modifier.damageType.toLowerCase() === damageType?.toLowerCase()),
  );
  if (lessening.length === 0) return;
  for (const { modifier } of lessening) {
    const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
    const rolled = rollAmount(ctx, dice ?? { count: 0, sides: 0, flat: 0 });
    const sign = modifier.minus ? -1 : 1;
    const added = modifier.add ? (rulesetHolderValue(ctx.definition, target, modifier.add) ?? 0) : 0;
    harm.flat += (modifier.flat ?? 0) + sign * (rolled.flat + added);
    harm.amount += (modifier.flat ?? 0) + sign * (rolled.total + added);
    harm.rolls.push(...rolled.rolls.map((face) => sign * face));
  }
  harm.amount = Math.max(0, harm.amount);
  const spent = new Set(lessening.flatMap((one) => (one.level === undefined && !one.item ? [one.condition] : [])));
  spendOneUse(
    ctx,
    target,
    target.tracked.filter((entry) => spent.has(entry.condition)),
  );
}

function landFall(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant, levels: number): void {
  ctx.events.push({ type: "fell", targetId: target.id, levels });
  const elevation = ctx.combat.elevation;
  // Safe from any fall, or from one no higher than its `upTo` while none of `unless` holds (1.650).
  const active = rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state);
  const held = new Set(active.map((entry) => entry.condition));
  const height = levels * (elevation?.levelHeight ?? 0);
  const safe = active.some(({ fallsSafely: rule }) =>
    rule === true ? true : !!rule && height <= rule.upTo && !rule.unless?.some((id) => held.has(id)),
  );
  if (safe) return;
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
    lessenFall(ctx, target, harm, falling.type);
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
  // A switch that stays on only so long goes off with the fight (1.706), and its stack with it.
  for (const one of ctx.state.combatants) {
    for (const key of Object.keys(one.onFor ?? {})) switchOff(ctx, one, Number(key), false);
  }
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
 * A hold let go of, by the one holding it, at no cost (playtest re-test 16): whatever it put on these
 * targets that it drags them by (a grapple), ended as freed. A crocodile holding two who are down lets
 * them go to bite the one still standing.
 */
export function rulesetLetGoOfHeld(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
  holderId: string,
  targetIds: readonly string[],
): RulesetCombatStep {
  const combat = definition.combat;
  if (!combat) return { state, events: [] };
  const { ctx, finish } = begin(definition, combat, state, roller);
  const dragged = new Set((combat.conditions ?? []).filter((entry) => !!entry.dragged).map((entry) => entry.condition));
  for (const id of targetIds) {
    const target = rulesetCombatant(ctx.state, id);
    if (!target) continue;
    for (const entry of [...target.tracked])
      if (entry.source === holderId && dragged.has(entry.condition) && target.tracked.includes(entry))
        removeCondition(ctx, target, entry.condition, "freed");
  }
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
    // Taken off the fallen too, but not told: a body does not recover from being dazed.
    if (!combatant.defeated || combatant.away)
      events.push({ type: "condition", targetId: combatant.id, condition, active: false, reason });
    // What was put on to last only as long as it goes with it (1.202), clock or none.
    for (const entry of [...combatant.tracked])
      if (entry.endsWith === condition) lift(combatant, entry.condition, "linked");
  };
  for (const combatant of state.combatants) {
    // A save it is made against as days pass (1.526) goes onto the sheet it stays on: Feeblemind.
    if (combatant.sheet && !combatant.defeated) {
      for (const entry of combatant.tracked) {
        const ends = entry.saveEnds;
        if (ends?.at !== "days" || !ends.days || entry.difficulty === undefined || entry.rounds !== null) continue;
        if (entry.aura || entry.kept || entry.endsAfter || entry.endsWhenHolder || entry.concentration) continue;
        // So many made to end it, and what a failure deals (1.750), kept off healing as it says.
        const keeps = definition.combat?.conditions?.some(
          (one) => one.condition === entry.condition && one.keepsDamage,
        );
        combatant.sheet.live = rulesetLiveWithDaySave(combatant.sheet.live, entry.condition, {
          save: ends.save,
          difficulty: entry.difficulty,
          every: ends.days,
          ...(ends.successes !== undefined ? { successes: ends.successes } : {}),
          ...(ends.harmsOnFail ? { harm: { ...ends.harmsOnFail } } : {}),
          ...(keeps ? { keeps: true as const } : {}),
        });
      }
      // Days it lasts (1.663) go onto the sheet it stays on, to be counted as days pass.
      for (const entry of combatant.tracked) {
        if (entry.days === undefined || entry.rounds !== null) continue;
        if (entry.aura || entry.kept || entry.endsAfter || entry.endsWhenHolder || entry.concentration) continue;
        combatant.sheet.live = rulesetLiveWithDayClock(
          combatant.sheet.live,
          entry.condition,
          entry.days,
          entry.restingCounts,
        );
      }
      // And what it wards off (1.758), as it was picked: Wish's.
      for (const entry of combatant.tracked) {
        if (entry.wardsOff === undefined || entry.rounds !== null) continue;
        if (entry.aura || entry.kept || entry.endsAfter || entry.endsWhenHolder || entry.concentration) continue;
        combatant.sheet.live = rulesetLiveWithWardsOff(combatant.sheet.live, entry.condition, entry.wardsOff);
      }
      // And the worn item that keeps it on (1.664), off once it is taken off.
      for (const entry of combatant.tracked) {
        if (entry.wornItem === undefined || entry.rounds !== null) continue;
        if (entry.aura || entry.kept || entry.endsAfter || entry.endsWhenHolder || entry.concentration) continue;
        combatant.sheet.live = rulesetLiveWithWornFrom(combatant.sheet.live, entry.condition, entry.wornItem);
      }
    }
    const dazed = combatant.dazed;
    delete combatant.dazed;
    if (dazed?.condition) lift(combatant, dazed.condition, "expired");
    // Squeezed between the board's walls (1.681): out of the fight there are none (laptop 2026-10-25:
    // a party member left the fight still Squeezing).
    if (combatant.squeezedFrom !== undefined) {
      combatant.span = combatant.squeezedFrom;
      delete combatant.squeezedFrom;
      const squeezing = definition.combat?.sizes?.squeezing?.condition;
      if (squeezing && combatant.tracked.some((entry) => entry.condition === squeezing))
        lift(combatant, squeezing, "expired");
    }
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
      if (keptPastFight(combatant, entry)) continue;
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

/** A shape of their own they are still in, kept on their sheet as the fight ends (1.801), so it does
 *  not run out with it (laptop 2026-10-25: the card said Wild Shape ran out, the sheet that they were
 *  still a wolf). */
function keptPastFight(combatant: RulesetCombatant, entry: RulesetTrackedCondition): boolean {
  return (
    !!combatant.sheet &&
    !combatant.defeated &&
    combatant.shape?.condition === entry.condition &&
    !entry.concentration &&
    (entry.source === undefined || entry.source === combatant.id)
  );
}

/** The conditions somebody holds once the fight is over: none `liftRulesetFightEffects` takes off as
 *  it ends, a clock's, a use's, a concentration's, an aura's (laptop playtest 2026-10-26: Blessed still
 *  listed on the party once the fight was over), unless what they wear keeps it on them too. */
function rulesetConditionsPastFight(definition: RulesetDefinition, combatant: RulesetCombatant): string[] {
  const ending = new Set(
    combatant.tracked
      .filter(
        (entry) =>
          !keptPastFight(combatant, entry) &&
          (entry.rounds !== null ||
            !!entry.endsAfter ||
            !!entry.endsWhenHolder ||
            !!entry.concentration ||
            !!entry.aura ||
            !!entry.kept),
      )
      .map((entry) => entry.condition),
  );
  if (ending.size === 0) return rulesetCombatConditions(definition, combatant);
  // Its sheet holds what the fight put on it, which comes off with it.
  const sheet = combatant.sheet && {
    ...combatant.sheet,
    live: {
      ...combatant.sheet.live,
      conditions: (combatant.sheet.live.conditions ?? []).filter((id) => !ending.has(id)),
    },
  };
  return rulesetCombatConditions(definition, {
    ...combatant,
    tracked: combatant.tracked.filter((entry) => !ending.has(entry.condition)),
    ...(sheet ? { sheet } : {}),
  });
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
  let step = answerInWindow(definition, combat, state, window, actor, choice, roller);
  // An answer that was itself answered and has now been let through, or stopped, is settled before
  // anybody else is asked: taken as it was chosen, or passed over.
  for (let guard = 0; guard < 32 && step.state.window?.answered; guard++) {
    const settled = settleAnswer(definition, combat, step.state, step.state.window, roller);
    step = { state: settled.state, events: [...step.events, ...settled.events] };
  }
  return step;
}

/** An answer held while the other side was asked about it (counter-the-counter), now that they
 *  have been: taken in the window it answered, paid for already, or passed over when it was stopped. */
function settleAnswer(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const answered = window.answered!;
  const plain = structuredClone(state);
  delete plain.window!.answered;
  const taker = rulesetCombatant(plain, answered.choice.actorId);
  if (answered.cancelled || !taker) {
    const { ctx, finish } = begin(definition, combat, plain, roller);
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }
  const step = takeReaction(definition, combat, plain, plain.window!, taker, answered.choice, roller, true);
  // Refused now (its target gone, say): it was paid for and is simply lost, and the window goes on.
  if (step.state === plain) {
    const { ctx, finish } = begin(definition, combat, plain, roller);
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    const gone = finish();
    return { state: gone.state, events: [...step.events, ...gone.events] };
  }
  return step;
}

function answerInWindow(
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
  /** Paid for already and let through by the other side (counter-the-counter): taken now. */
  cleared = false,
): RulesetCombatStep {
  const trigger = window.trigger;
  if (
    trigger.kind !== "aimed" &&
    trigger.kind !== "hit" &&
    trigger.kind !== "harmed" &&
    trigger.kind !== "used" &&
    trigger.kind !== "falls" &&
    trigger.kind !== "turn-start" &&
    trigger.kind !== "caught" &&
    trigger.kind !== "attacked"
  ) {
    return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  }
  const declared = actor.actions.find((entry) => entry.id === choice.optionId && entry.reaction);
  // Let through after it was paid for, it is no longer on the menu (its budget is spent): it was
  // offered when it was chosen.
  const offered = cleared
    ? { budget: declared?.budget, payWith: choice.payWith !== undefined ? [choice.payWith] : undefined }
    : rulesetWindowOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!declared || !offered) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  // Filled in rather than picked, unless the entry says its holder picks: aimed back at whoever
  // caused the moment, or, for something its holder does to THEMSELVES, at its holder. Bracing
  // yourself is not aimed at anybody, and pointing it at whoever hurt you would hand them what it
  // gives. A falling moment always points at the faller, even when the entry otherwise asks.
  const about = rulesetReactionTarget(
    state,
    actor,
    declared,
    trigger.kind,
    trigger.sourceId,
    rulesetWindowCause(state, trigger),
  );
  const source = rulesetCombatant(state, declared.reaction?.at === "target" ? (about ?? actor.id) : trigger.sourceId);
  let targets: RulesetCombatant[] | RulesetCombatRefusal;
  // Sent to the one its holder picks (1.422): Stand Against the Tide.
  if (declared.redirects) {
    const open =
      trigger.kind === "attacked" ? rulesetRedirectTargets(state, actor, trigger.sourceId, trigger.optionId) : [];
    const picked = choice.targetIds[0];
    targets =
      choice.targetIds.length === 1 && picked && open.includes(picked)
        ? [rulesetCombatant(state, picked)!]
        : "bad-target";
  } else if (trigger.kind === "falls" && declared.targets.count > 1) {
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
  if (!cleared) {
    if (budget !== undefined) {
      if ((taking.budgets[budget] ?? 0) < 1) return refusal(state, choice.actorId, "no-budget", choice.optionId);
      spendBudget(ctx, taking, budget);
    }
    const paid = planRulesetCombatCost(definition, taking, action, choice.payWith);
    if (!paid) return refusal(state, choice.actorId, "insufficient", choice.optionId);
    if (paid.live && taking.sheet) taking.sheet.live = paid.live;
    // Out of a worn item's charges (1.572).
    if (paid.itemCharges) (taking.charges ??= {})[paid.itemCharges.item] = paid.itemCharges.now;
    countRulesetSpend(taking, paid.cost);
    for (const entry of paid.cost) {
      ctx.events.push({
        type: "spend",
        actorId: taking.id,
        pool: entry.pool,
        label: entry.label,
        amount: entry.amount,
        on: action.label,
      });
    }
    spendAvailability(ctx, taking, action);
    // A spell answering is itself something the other side may answer (counter-the-counter): it is
    // held, paid for, while they are asked, and taken once nobody has stopped it. Used subtly
    // (1.253), nobody sees it to answer it.
    if (rulesetIsSpell(action) && !action.altered?.subtle) {
      const answering = ctx.state.window!;
      ctx.state.window = undefined;
      const opened = openMoment(
        ctx,
        {
          kind: "used",
          sourceId: taking.id,
          optionId: action.id,
          label: action.label,
          ...(action.catalog ? { catalog: action.catalog } : {}),
          ...(action.entry ? { entry: action.entry } : {}),
        },
        ctx.state.combatants,
        {
          kind: "answer",
          actorId: taking.id,
          optionId: action.id,
          ...(choice.payWith !== undefined ? { payWith: choice.payWith } : {}),
          choice: structuredClone(choice),
        },
      );
      if (opened) {
        ctx.state.window!.outer = answering;
        noteOutcome(ctx);
        return finish();
      }
      ctx.state.window = answering;
    }
  }
  const cancelSave = action.reaction?.cancelSave;
  if (cancelSave && !rollSave(ctx, taking, cancelSave.save, cancelSave.dc, trigger.sourceId)) {
    // A reaction is acting too (1.308): One with Shadows ends on it, as on one resolved in full.
    stirs(ctx, taking, "acted");
    holderActed(ctx, taking, action, undefined, { targets, from: ctx.events.length });
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }
  // Calling it off happens BEFORE this one's own dice: what was held never lands, so nothing it
  // would have done can change what this reaction is resolved against.
  if (
    action.reaction?.cancels &&
    (ctx.state.window?.resume?.kind === "action" || ctx.state.window?.resume?.kind === "answer") &&
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
      with: action.label,
    });
  }
  // Stepping in to be its target instead (1.509): the one within reach it was aimed at.
  if (action.takesAim && trigger.kind === "aimed" && ctx.state.window?.resume?.kind === "action") {
    const held = ctx.state.window.resume;
    // The one its moment was about: aimed at, on its holder's side and within its reach.
    const instead = about !== taking.id && about && held.targetIds.includes(about) ? about : undefined;
    if (instead && !held.targetIds.includes(taking.id)) {
      held.targetIds = held.targetIds.map((id) => (id === instead ? taking.id : id));
      if (ctx.state.window.trigger.kind === "aimed" && ctx.state.window.trigger.targetIds)
        ctx.state.window.trigger.targetIds = held.targetIds.slice();
      ctx.events.push({
        type: "tookAim",
        actorId: taking.id,
        targetId: instead,
        sourceId: held.actorId,
        label: action.label,
      });
    }
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
    holderActed(ctx, taking, action, undefined, { targets: workingTargets, from: ctx.events.length });
    answered();
    noteOutcome(ctx);
    return finish();
  }
  // Added to its holder's own blow, held where it hit (1.241): rolled as that blow lands. Or only
  // its conditions (1.534).
  if (
    action.addsToBlow &&
    (action.damage || action.onHit?.length) &&
    trigger.kind === "hit" &&
    trigger.sourceId === taking.id &&
    holding?.kind === "action" &&
    holding.held
  ) {
    const steps = choice.payWith ? rulesetCostSteps(definition, action, choice.payWith, taking) : 0;
    // A higher payment's dice, or a charge more's (1.273).
    const stepAmount = action.use?.perCostStep ?? action.itemUse?.charges?.step?.amount;
    const damage = action.damage
      ? (({ alternatives: _alternatives, ...rest }) => rest)(structuredClone(action.damage))
      : undefined;
    (holding.held.adds ??= []).push({
      label: action.label,
      ...(damage ? { damage } : {}),
      ...(action.addsWith?.save ? { save: { ...action.addsWith.save } } : {}),
      ...(action.addsWith?.drain ? { drain: action.addsWith.drain } : {}),
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
    holderActed(ctx, taking, action, undefined, { targets: workingTargets, from: ctx.events.length });
    answered();
    noteOutcome(ctx);
    return finish();
  }
  // Its holder's own best melee strike at whoever caused it (1.422), made as an opportunity attack
  // is: Retaliation, Giant Killer.
  if (action.strikesWith) {
    const strike = rulesetOpportunityAttack(taking);
    const at = workingTargets[0];
    stirs(ctx, taking, "acted");
    holderActed(ctx, taking, action, undefined, { targets: workingTargets, from: ctx.events.length });
    if (strike && at && !at.defeated) {
      ctx.events.push({
        type: "opportunity",
        actorId: taking.id,
        targetId: at.id,
        label: strike.label,
        budget: budget ?? "",
      });
      countAttack(ctx, taking);
      spendAvailability(ctx, taking, strike);
      resolveAction(ctx, taking, strike, [at]);
    }
    answered();
    noteOutcome(ctx);
    return finish();
  }
  // Whoever missed makes that attack again at the one its holder picked (1.422).
  if (action.redirects && trigger.kind === "attacked") {
    const attacker = rulesetCombatant(ctx.state, trigger.sourceId);
    const attack = attacker?.actions.find((one) => one.id === trigger.optionId);
    stirs(ctx, taking, "acted");
    holderActed(ctx, taking, action, undefined, { targets: workingTargets, from: ctx.events.length });
    const at = workingTargets[0];
    if (attacker && attack && at) {
      ctx.events.push({ type: "added", actorId: taking.id, targetId: at.id, label: action.label, to: attack.label });
      resolveAction(ctx, attacker, attack, [at]);
    }
    answered();
    noteOutcome(ctx);
    return finish();
  }
  // Kept (1.626): Gloves of Missile Snaring.
  if (action.keepsCaught && trigger.kind === "caught") keepCaught(ctx, taking, action.keepsCaught, trigger);
  // Thrown back with the caught missile's own dice and kind of harm, its own flat part kept (1.416),
  // or one die of its own where that is the better on average (1.420): Martial Arts' die.
  const caughtDice = (() => {
    if (!action.throwsCaught || trigger.kind !== "caught") return undefined;
    const own = typeof action.throwsCaught === "object" ? action.throwsCaught.sides : 0;
    const { count, sides } = trigger.damage;
    return own > 0 && own + 1 > count * (sides + 1) ? { count: 1, sides: own } : { count, sides };
  })();
  const thrown =
    caughtDice && trigger.kind === "caught" && action.damage
      ? {
          ...action,
          damage: {
            ...structuredClone(action.damage),
            ...caughtDice,
            ...(trigger.damage.type ? { type: trigger.damage.type } : {}),
          },
        }
      : action;
  resolveAction(ctx, taking, thrown, workingTargets, choice.payWith);
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
  held: Pick<RulesetActionResume, "actorId" | "optionId" | "payWith">,
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
    success: false,
  };
  const above = reaction.above;
  if (!above || rulesetCombatIsPool(ctx.combat) || rulesetCombatIsSymbol(ctx.combat)) {
    ctx.events.push(said);
    return false;
  }
  return levelCheck(ctx, answering, action.label, above, level, said);
}

/** A check against `dc` plus a level (1.116), for what reaches past it: Counterspell above its own
 *  level, Dispel Magic past its own (1.424). Said as a counter event, made or not. */
function levelCheck(
  ctx: RulesetCombatContext,
  answering: RulesetCombatant,
  label: string,
  above: { modifier: number; dc: number },
  level: number,
  said: Extract<RulesetCombatEvent, { type: "counter" }>,
): boolean {
  const mode = rulesetCheckMode(ctx.definition, ctx.combat, answering, ctx.state);
  const dice = ctx.combat.attackRoll!.dice;
  const first = throwOwnDice(ctx, answering, "checks", dice.count, dice.sides);
  const second = mode === "normal" ? null : throwOwnDice(ctx, answering, "checks", dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  const bonuses = rollBonuses(
    ctx,
    rulesetConditionModifiers(ctx.definition, ctx.combat, answering, "checks", ctx.state),
    answering,
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
    total -= lowerRoll(ctx, answering, "checks", label, total, (most) => total - most < difficulty);
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
  // An answer the other side was asked about (counter-the-counter): the window it answers is taken
  // back up, and it is taken there, or passed over, next.
  if (resume?.kind === "answer") {
    const answering = window.outer;
    if (answering) {
      ctx.state.window = answering;
      answering.answered = {
        choice: resume.choice,
        ...(resume.cancelled || over ? { cancelled: true as const } : {}),
      };
    }
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
      if (!ctx.state.window && !openTurnStartSignature(ctx, first)) {
        completeDelayed(ctx, first);
        continueCasting(ctx, first);
      }
    }
  } else if (!over && trigger.kind === "between-turns") beginNextTurn(definition, combat, ctx);
  if (!over && trigger.kind === "turn-start") {
    const actor = rulesetCombatant(ctx.state, trigger.sourceId);
    // The reactions at its start answered, the points bought at it are asked for next (1.805).
    if (actor && window.kind === "reaction" && openTurnStartSignature(ctx, actor)) return;
    if (actor) {
      completeDelayed(ctx, actor);
      continueCasting(ctx, actor);
    }
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
  // What stays, as on its maker's own turn: a zone that does nothing as it appears catches nobody
  // now. A kraken's Ink Cloud.
  const zone = !only ? workingAction.zone : undefined;
  if (!only) resolveAction(ctx, working, workingAction, zone && !zone.atCast ? [] : workingTargets);
  if (zone && rulesetCombatStanding(working)) {
    const at = workingAction.around ? rulesetPositionOf(working) : rulesetPositionOf(workingTargets[0]);
    placeZone(ctx, working, workingAction, {
      kind: "action",
      actorId: working.id,
      optionId: workingAction.id,
      targetIds: workingTargets.map((one) => one.id),
      ...(at ? { at: { x: at.x, y: at.y } } : {}),
    });
  }
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
    if (ctx.state.window?.kind === "signature") goOn(definition, combat, ctx);
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
      // Named by the spell it cast, not "Cast a Spell" (laptop 2026-10-26).
      {
        type: "signature",
        actorId: actor.id,
        optionId: choice.optionId,
        label: actor.actions.find((entry) => entry.id === castOf.optionId)?.label ?? action.label,
        cost,
        left,
      },
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

/** The action with what it applies lasting `perStep` rounds more for each step of higher cost it is
 *  paid with (1.447), or its `bySteps` rounds (1.470), and held by no concentration from its
 *  `concentrationBelowStep` up (1.470); or as it is when nothing of it changes. */
function durationsPaid(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  payWith: string | undefined,
): RulesetCombatAction {
  const grows = (entry: RulesetCombatApplies) =>
    typeof entry.duration === "object" && (!!entry.duration.perStep || !!entry.duration.bySteps);
  const picked = action.applies?.some((entry) => entry.paidSteps);
  if (!action.applies?.some(grows) && !action.concentrationBelowStep && !picked) return action;
  const steps = action.innate
    ? Math.max(0, action.innate.level - action.innate.baseLevel)
    : payWith
      ? rulesetCostSteps(ctx.definition, action, payWith, actor)
      : 0;
  // Only what the steps paid put on (1.517): Magic Weapon's +2 from a 4th-level slot.
  if (picked) {
    action = {
      ...action,
      applies: action.applies!.filter(
        ({ paidSteps }) =>
          !paidSteps ||
          ((paidSteps.atLeast === undefined || steps >= paidSteps.atLeast) &&
            (paidSteps.atMost === undefined || steps <= paidSteps.atMost)),
      ),
    };
  }
  if (steps <= 0) return action;
  const roundsPaid = (duration: { rounds: number; perStep?: number; bySteps?: Array<number | "until-dispelled"> }) =>
    duration.bySteps
      ? duration.bySteps[Math.min(steps, duration.bySteps.length) - 1]!
      : Math.min(14400, duration.rounds + (duration.perStep ?? 0) * steps);
  const paid: RulesetCombatAction = {
    ...action,
    ...(action.applies
      ? {
          applies: action.applies.map((entry) =>
            typeof entry.duration === "object" && (entry.duration.perStep || entry.duration.bySteps)
              ? {
                  ...entry,
                  duration: ((paid) =>
                    paid === "until-dispelled"
                      ? { ...entry.duration, untilDispelled: true as const }
                      : { ...entry.duration, rounds: paid })(roundsPaid(entry.duration)),
                }
              : entry,
          ),
        }
      : {}),
  };
  if (action.concentrationBelowStep && steps >= action.concentrationBelowStep) paid.concentration = false;
  return paid;
}

/** Calls an action's creatures into the fight (1.325), as many as its count throws, and says so. */
/** The open cells within `within.distance` of a caller, ones it sees with `seen`, nearest its foes
 *  first and then nearest itself (1.621): where a treant's Animate Trees wakes trees. Nothing off a
 *  board. */
function callCellsWithin(
  ctx: RulesetCombatContext,
  caller: RulesetCombatant,
  within: { distance: number; seen?: true },
): RulesetCombatCell[] | undefined {
  const grid = ctx.state.board?.grid;
  const perCell = ctx.definition.combat?.distance?.perCell;
  if (!grid || perCell === undefined || !rulesetPositionOf(caller)) return undefined;
  const reach = rulesetInCells(within.distance, perCell);
  const foes = ctx.state.combatants.filter(
    (one) => one.side !== caller.side && rulesetCombatStanding(one) && !!rulesetPositionOf(one),
  );
  const taken = new Set(
    ctx.state.combatants
      .filter((one) => !one.defeated || one.object)
      .flatMap((one) => rulesetFootprint(one))
      .map((cell) => `${cell.x},${cell.y}`),
  );
  const cells: Array<{ cell: RulesetCombatCell; foe: number; self: number }> = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const cell = { x, y };
      if (rulesetCellBlocked(grid, x, y) || taken.has(`${x},${y}`)) continue;
      const self = rulesetDistanceTo(cell, caller);
      if (self > reach) continue;
      if (within.seen && !rulesetSeesCell(ctx.definition, ctx.state, caller, cell)) continue;
      const foe = foes.length ? Math.min(...foes.map((one) => rulesetDistanceTo(cell, one))) : 0;
      cells.push({ cell, foe, self });
    }
  }
  cells.sort((a, b) => a.foe - b.foe || a.self - b.self || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
  return cells.map((one) => one.cell);
}

function callCreatures(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  cells?: RulesetCombatCell[],
  /** Steps of higher cost it was paid with (1.402): Conjure Animals at 5th level calls twice as many. */
  steps = 0,
): void {
  if (!action.calls) return;
  // Which call comes is rolled (1.559): a Bag of Tricks' beast, an Efreeti Bottle's efreeti, which may
  // turn on whoever let it out, or grant wishes and leave nobody behind.
  let hostile = false;
  if (action.callsRolled) {
    const rows = action.callsRolled;
    // An item's call that keeps its first roll and counts its uses (1.591): an Efreeti Bottle, the
    // same effect at the next two openings and the efreeti's escape at the fourth.
    const item = action.itemUse?.item;
    const lasting =
      item !== undefined && (action.callsRollKept || action.callsLifetime !== undefined)
        ? { ...rulesetItemCallRoll(actor, item) }
        : undefined;
    const ever = lasting?.ever ?? 0;
    let row: (typeof rows)[number] | undefined;
    if (lasting && action.callsLifetime !== undefined && ever >= action.callsLifetime) {
      row = rows.find((one) => one.pastLifetime);
    } else if (lasting && action.callsRollKept && lasting.kept !== undefined) {
      row = rows.find((one) => one.index === lasting.kept);
    } else {
      row = rollWeighted(
        ctx,
        actor,
        action.label,
        rows.filter((one) => !one.pastLifetime),
      );
      if (lasting && action.callsRollKept && row?.index !== undefined) lasting.kept = row.index;
    }
    if (lasting) lasting.ever = ever + 1;
    // Spent for good once it comes (1.591): the efreeti that attacks, the wishes granted.
    if (row?.spendsItem && item !== undefined) {
      const spent = lasting ?? { ...rulesetItemCallRoll(actor, item) };
      spent.spent = true;
      (actor.callRolls ??= {})[item] = spent;
    } else if (lasting && item !== undefined) (actor.callRolls ??= {})[item] = lasting;
    if (!row?.call) return;
    hostile = !!row.hostile;
    action = { ...action, calls: row.rounds !== undefined ? { ...row.call, rounds: row.rounds } : row.call };
  }
  if (!action.calls) return;
  const per = action.calls.timesPerSteps;
  // And so many more for each step past the steps it needs (1.537): Animate Dead's two.
  const more = action.calls.perStep ? action.calls.perStep * Math.max(0, steps - (action.calls.fromStep ?? 0)) : 0;
  const count = rollAmount(ctx, action.calls.count).total * (per ? 1 + Math.floor(steps / per) : 1) + more;
  // Set down only where it says (1.621): a treant wakes no tree it cannot see.
  const only = !!action.calls.within && cells !== undefined;
  const ids = rulesetCallCreatures(ctx.definition, ctx.state, actor, action, count, ctx.roll, cells, only);
  // Ignoring every order (1.665), on a d100 rolled as they come: the obsidian steed.
  const disobeys =
    !!action.calls.disobeys &&
    ids.length > 0 &&
    rulesetSheetWithin(ctx.definition, actor, action.calls.disobeys.when) &&
    ctx.roll(100) <= action.calls.disobeys.chance;
  // Kept by what called them (1.394): its concentration, and its rounds.
  for (const id of ids) {
    const called = rulesetCombatant(ctx.state, id);
    if (!called) continue;
    called.calledWith = action.id;
    if (action.calls.rounds) called.calledUntil = ctx.state.round + action.calls.rounds;
    if (action.calls.endsWithCaller) called.calledEndsWithCaller = action.calls.endsWithCaller;
    if (action.calls.endsWhenSpent) called.calledEndsWhenSpent = true;
    if (action.calls.hostileOnBreak) called.calledHostileOnBreak = true;
    // Spent with them, or waiting on their departure (1.612): a Ring of Djinni Summoning.
    const item = action.itemUse?.item;
    const held = item !== undefined ? actor.sheet?.items?.[item]?.item : undefined;
    const departure =
      !!held &&
      (!!held.charges?.recharge?.after?.fromDeparture ||
        !!held.moreUses?.some((more) => more.uses?.recharge?.after?.fromDeparture));
    if (item !== undefined && (action.calls.spendsItemOnDeath || departure || action.calls.becomesItem))
      called.calledItem = {
        item,
        ...(action.calls.spendsItemOnDeath ? { spends: true as const } : {}),
        ...(departure ? { departure: true as const } : {}),
        // The item itself, out of its holder's hands while it stands (1.613).
        ...(action.calls.becomesItem ? { becomes: true as const } : {}),
      };
    // Under nobody's control (1.615): Pipes of the Sewers' swarms.
    if (action.calls.wild) called.calledWild = { ...action.calls.wild };
    if (disobeys) {
      called.calledWild = {};
      called.calledDisobeys = true;
    }
    // Held within so far of their caller (1.610): a treant's trees.
    if (action.calls.leash)
      called.calledLeash = rulesetInCells(action.calls.leash, ctx.definition.combat?.distance?.perCell ?? 1);
    // Commanded only within so far of their caller (1.620): the Staff of the Python's snake.
    if (action.calls.commandedWithin)
      called.calledCommandWithin = rulesetInCells(
        action.calls.commandedWithin,
        ctx.definition.combat?.distance?.perCell ?? 1,
      );
    // Commanded by their caller (1.558), the turn they come on free.
    if (action.calls.commandedWith) called.calledCommand = { budget: action.calls.commandedWith, free: true };
    // Or only once their caller has made one of its own actions (1.736): a chain devil's chains.
    if (action.calls.commandedBy) called.calledCommand = { action: action.calls.commandedBy };
    // An image, not a creature (1.568).
    if (action.calls.illusion) called.illusion = { seenBy: [] };
  }
  // Built from their caller (1.558): Arcane Hand's health, attack bonus and modifier.
  const from = action.calls.fromCaller;
  if (from) {
    const most = healthOf(ctx, actor).max;
    const read = (ref: RulesetValueRef | undefined) => {
      if (!ref || !actor.sheet) return undefined;
      const value = resolveRulesetValueRef(
        ctx.definition,
        actor.sheet.build,
        ref,
        evaluateRulesetSheetLive(
          ctx.definition,
          actor.sheet.build,
          actor.sheet.live,
          actor.sheet.items,
          actor.abilityConditions,
        ),
      );
      return Number.isFinite(value) ? Math.trunc(value) : undefined;
    };
    const toHit = read(from.toHit);
    const adds = read(from.adds);
    // Their attacks made as one of their caller's own (1.707): the solar's greatsword, for its sword.
    const own = from.action ? actor.actions.find((one) => one.id === from.action) : undefined;
    for (const id of ids) {
      const called = rulesetCombatant(ctx.state, id);
      if (!called) continue;
      if (from.health && called.health && most > 0) called.health = { value: most, max: most, temp: 0 };
      if (own?.damage && own.toHit !== undefined) {
        for (const one of called.actions) {
          if (one.toHit === undefined || !one.damage) continue;
          one.toHit = own.toHit;
          one.damage = structuredClone(own.damage);
        }
      }
      for (const one of called.actions) {
        if (toHit !== undefined && one.toHit !== undefined) one.toHit = toHit;
        // Not on one that keeps it off (1.586): Arcane Hand's Clenched Fist.
        if (adds && one.damage && one.callerAdds !== false)
          one.damage = { ...one.damage, flat: one.damage.flat + adds };
      }
    }
  }
  // More for each step the call was paid above its base (1.586): Arcane Hand's 2d8 a slot level.
  if (steps > 0) {
    for (const id of ids) {
      const called = rulesetCombatant(ctx.state, id);
      if (!called) continue;
      for (const one of called.actions) {
        const per = one.perCallerStep;
        if (!per || !one.damage) continue;
        const sameSides = per.count === 0 || one.damage.count === 0 || per.sides === one.damage.sides;
        if (!sameSides) continue;
        one.damage = {
          ...one.damage,
          count: one.damage.count + per.count * steps,
          sides: one.damage.count > 0 ? one.damage.sides : per.sides,
          flat: one.damage.flat + per.flat * steps,
        };
      }
    }
  }
  // Those that did not come are said, and why (cloud summons check 2026-10-25: 7 of 8 Draft Horses
  // came, the eighth with no word, the open room left on the board out of its caller's sight).
  const wanted = Math.min(Math.max(0, Math.floor(count)), RULESET_CALL_MAX);
  const short =
    wanted > ids.length
      ? {
          count: wanted - ids.length,
          why:
            ctx.state.combatants.length >= RULESET_CALLED_FIGHT_MAX
              ? ("full" as const)
              : only && action.calls.within?.seen
                ? ("seen" as const)
                : ("room" as const),
          ...(only && action.calls.within && ctx.definition.combat?.distance?.perCell !== undefined
            ? { cells: rulesetInCells(action.calls.within.distance, ctx.definition.combat.distance.perCell) }
            : {}),
        }
      : undefined;
  ctx.events.push({
    type: "called",
    actorId: actor.id,
    label: action.label,
    ids,
    ...(disobeys ? { disobeys } : {}),
    ...(short ? { short } : {}),
  });
  departuresOf(ctx, actor);
  // On their way, there after so many of their caller's turns (1.614): Children of the Night's.
  const arrivesIn = action.calls.arrivesIn ?? action.callsArriveIn;
  if (arrivesIn && ids.length) {
    const turns = rollAmount(ctx, arrivesIn).total;
    if (turns >= 1) {
      for (const id of ids) {
        const called = rulesetCombatant(ctx.state, id);
        if (!called) continue;
        called.defeated = true;
        called.away = { by: actor.id, label: action.label, arriving: turns };
      }
    }
  }
  // Or unless their caller meets a requirement (1.611): a Horn of Valhalla's.
  const unless = action.calls.hostileUnless;
  if (unless && !hostile) {
    const met = actor.sheet
      ? resolveRulesetValueRef(
          ctx.definition,
          actor.sheet.build,
          { derived: unless.derived },
          evaluateRulesetSheetLive(
            ctx.definition,
            actor.sheet.build,
            actor.sheet.live,
            actor.sheet.items,
            actor.abilityConditions,
          ),
        )
      : Number.NaN;
    if (!(met >= unless.atLeast)) hostile = true;
  }
  // Come against whoever called them (1.559): the other side's from the start, never theirs.
  if (hostile && ids.length) {
    for (const id of ids) {
      const called = rulesetCombatant(ctx.state, id);
      if (!called) continue;
      called.side = actor.side === "party" ? "enemy" : "party";
      called.calledTurned = true;
      delete called.calledWith;
      delete called.calledEndsWithCaller;
      delete called.calledCommand;
    }
    ctx.events.push({ type: "turnedOn", actorId: actor.id, ids });
  }
  // What it puts on goes on them (1.479): Antipathy's condition on its object, the kind remembered.
  if (action.appliesToCalled) {
    for (const id of ids) {
      const called = rulesetCombatant(ctx.state, id);
      if (!called) continue;
      for (const applies of action.applies ?? []) {
        applyConditionId(ctx, called, applies.condition, applies, {
          sourceId: actor.id,
          action: [action.id, action.label],
          ...(action.catalog ? { catalog: action.catalog } : {}),
        });
      }
    }
  }
}

/** Health regained as a turn starts (1.396): Regeneration, Survivor. Stopped since its last turn by
 *  the harm it names, it regains nothing this once; down at 0 and regaining nothing, it is out. */
function regenerate(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const regenerations = rulesetRegenerations(ctx.definition, ctx.combat, actor, ctx.state);
  const stopped = !!actor.regenHeld;
  delete actor.regenHeld;
  let gained = 0;
  if (!actor.defeated && regenerations.length && !("track" in ctx.combat.health)) {
    if (stopped) ctx.events.push({ type: "regenerates", actorId: actor.id, amount: 0, stopped: true });
    else {
      for (const one of regenerations) {
        const health = healthOf(ctx, actor);
        if (one.notAtZero && health.value <= 0) continue;
        if (one.atMostHalf && health.value > Math.floor(health.max / 2)) continue;
        if (health.value >= health.max) continue;
        // Not in sunlight or running water (1.555).
        const notIn = one.notIn;
        if (
          notIn &&
          ((notIn.light &&
            rulesetModeRuleHolds(ctx.definition, ctx.combat, actor, ctx.state, {
              mode: "advantage",
              light: notIn.light,
            })) ||
            (notIn.terrain &&
              rulesetModeRuleHolds(ctx.definition, ctx.combat, actor, ctx.state, {
                mode: "advantage",
                terrain: notIn.terrain,
              })))
        )
          continue;
        const dice = one.dice ? parseRulesetCombatDice(one.dice) : null;
        const rolled = rollHealing(ctx, actor, {
          count: dice?.count ?? 0,
          sides: dice?.sides ?? 0,
          flat: (dice?.flat ?? 0) + (one.flat ?? 0),
        });
        const added =
          one.add && actor.sheet
            ? resolveRulesetValueRef(
                ctx.definition,
                actor.sheet.build,
                one.add,
                evaluateRulesetSheetLive(
                  ctx.definition,
                  actor.sheet.build,
                  actor.sheet.live,
                  actor.sheet.items,
                  actor.abilityConditions,
                ),
              )
            : 0;
        const amount = Math.max(0, rolled.total + (Number.isFinite(added) ? added : 0));
        if (amount <= 0) continue;
        const before = healthOf(ctx, actor).value;
        dealHeal(ctx, actor, { sourceId: actor.id, rolls: rolled.rolls, flat: rolled.flat + added, amount });
        gained += healthOf(ctx, actor).value - before;
      }
      if (gained > 0) ctx.events.push({ type: "regenerates", actorId: actor.id, amount: gained });
    }
  }
  if (!actor.regrowing) return;
  delete actor.regrowing;
  if (actor.down && !actor.defeated) {
    // Nothing regained at 0: out for good.
    actor.defeated = true;
    actor.diedRound = ctx.state.round;
    endSummons(ctx, actor);
    endZones(ctx, actor);
    unconjureAll(ctx, actor);
    endConditionsFromSource(ctx, actor);
    ctx.events.push({ type: "defeated", actorId: actor.id });
    dies(ctx, actor);
  }
}

/** What a creature does as it dies (1.540): its own burst around it, on whoever it catches, never
 *  held for an answer. A mephit's Death Burst, a balor's Death Throes. */
function dies(ctx: RulesetCombatContext, dead: RulesetCombatant): void {
  // The item that called it spent for good (1.612): a Ring of Djinni Summoning's djinni.
  const caller = dead.calledBy ? rulesetCombatant(ctx.state, dead.calledBy) : undefined;
  if (caller && dead.calledItem && !dead.dismissed) {
    const { item, spends } = dead.calledItem;
    if (spends && !rulesetItemCallRoll(caller, item).spent) {
      (caller.callRolls ??= {})[item] = { ...rulesetItemCallRoll(caller, item), spent: true };
      const held = caller.sheet?.items?.[item];
      ctx.events.push({ type: "itemSpent", actorId: caller.id, label: held?.name ?? "" });
    }
    departuresOf(ctx, caller);
  }
  const action = dead.actions.find((entry) => entry.onDeath);
  if (!action?.around || dead.dismissed) return;
  // One that leaves an area behind (a smoke mephit's cloud) lays it where it fell, outlasting it.
  if (action.zone) {
    const at = rulesetPositionOf(dead);
    ctx.events.push({ type: "deathBurst", actorId: dead.id, label: action.label });
    if (at) placeZone(ctx, dead, action, { kind: "action", actorId: dead.id, optionId: action.id, targetIds: [], at });
    return;
  }
  const caught = rulesetAroundTargets(ctx.state, dead, action).filter(
    (one) => !one.defeated && !rulesetSealedApart(ctx.definition, ctx.state, dead, one),
  );
  ctx.events.push({ type: "deathBurst", actorId: dead.id, label: action.label });
  const before = ctx.summonStriking;
  ctx.summonStriking = true;
  try {
    resolveAction(ctx, dead, action, caught);
  } finally {
    if (before) ctx.summonStriking = before;
    else delete ctx.summonStriking;
  }
}

/** One row of a table rolled as something is used (1.559), each as likely as its weight: told, and
 *  the row it came up. */
function rollWeighted<Row extends { weight: number; label: string }>(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  label: string,
  rows: readonly Row[],
): Row | undefined {
  const of = rows.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  if (of < 1) return undefined;
  const roll = ctx.roll(of);
  let left = roll;
  const row = rows.find((one) => (left -= Math.max(0, one.weight)) <= 0) ?? rows[rows.length - 1];
  if (row) ctx.events.push({ type: "rolledTable", actorId: actor.id, label, roll, of, result: row.label });
  return row;
}

/** Those bound to their caller (1.446) leave once it is out: a demon's summoned kin. Some also once
 *  it is down or cannot act (1.733): a Feather Token's whip. */
function leaveWithCallers(ctx: RulesetCombatContext): void {
  for (const caller of ctx.state.combatants) {
    if (caller.defeated) {
      dismissCalled(ctx, caller, (one) => !!one.calledEndsWithCaller, "caller");
      continue;
    }
    if (
      ctx.state.combatants.some((one) => one.calledBy === caller.id && one.calledEndsWithCaller === "incapacitated") &&
      (!rulesetCombatStanding(caller) ||
        rulesetActiveConditions(ctx.definition, ctx.combat, caller, ctx.state).some((entry) =>
          entry.effects.includes("cannot-act"),
        ))
    )
      dismissCalled(ctx, caller, (one) => one.calledEndsWithCaller === "incapacitated", "caller");
  }
  // Those that leave once every counted action of theirs is spent (1.742): a Dancing Sword after its
  // fourth attack, back in hand.
  for (const caller of ctx.state.combatants) {
    dismissCalled(
      ctx,
      caller,
      (one) =>
        !!one.calledEndsWhenSpent &&
        one.actions.some((action) => action.uses) &&
        one.actions.every((action) => !action.uses || rulesetActionUses(one, action, ctx.state) < 1),
      "spent",
    );
  }
  // Areas that end as their maker is incapacitated (1.741): an ice devil's Wall of Ice.
  for (const maker of ctx.state.combatants) {
    const ending = (maker.zones ?? []).filter(
      (zone) => maker.actions.find((entry) => entry.id === zone.actionId)?.zone?.endsWithCaller === "incapacitated",
    );
    if (
      !ending.length ||
      (rulesetCombatStanding(maker) &&
        !maker.defeated &&
        !rulesetActiveConditions(ctx.definition, ctx.combat, maker, ctx.state).some((entry) =>
          entry.effects.includes("cannot-act"),
        ))
    )
      continue;
    for (const actionId of new Set(ending.map((zone) => zone.actionId))) endZones(ctx, maker, actionId);
  }
  // And those held within so far of their caller (1.610), once it is farther: a treant's trees.
  for (const caller of ctx.state.combatants) {
    if (caller.defeated || !rulesetPositionOf(caller)) continue;
    dismissCalled(
      ctx,
      caller,
      (one) => one.calledLeash !== undefined && !!rulesetPositionOf(one) && rulesetGap(caller, one) > one.calledLeash,
      "leash",
    );
  }
}

/** Sends away those `caller` called that `which` picks (1.394): off the board and out of the fight. */
/** Called creatures that turn on their caller's side as the concentration holding them breaks (1.538):
 *  on the other side now, no longer held by it nor theirs to dismiss or command, their rounds still
 *  running. */
function turnCalled(ctx: RulesetCombatContext, caller: RulesetCombatant, actionId: string): void {
  const turning = ctx.state.combatants.filter(
    (one) =>
      one.calledBy === caller.id &&
      one.calledWith === actionId &&
      one.calledHostileOnBreak &&
      !one.dismissed &&
      !one.defeated,
  );
  if (!turning.length) return;
  for (const one of turning) {
    one.side = caller.side === "party" ? "enemy" : "party";
    one.calledTurned = true;
    delete one.calledWith;
    delete one.calledEndsWithCaller;
  }
  ctx.events.push({ type: "turnedOn", actorId: caller.id, ids: turning.map((one) => one.id) });
}

function dismissCalled(
  ctx: RulesetCombatContext,
  caller: RulesetCombatant,
  which: (one: RulesetCombatant) => boolean,
  reason: "rounds" | "concentration" | "caller" | "dismissed" | "leash" | "spent",
): void {
  const going = ctx.state.combatants.filter(
    (one) => one.calledBy === caller.id && !one.dismissed && !one.defeated && which(one),
  );
  if (!going.length) return;
  for (const one of going) {
    if (one.concentrating) endConcentration(ctx, one, "spent");
    // Sent away by its caller's choice, a kept call is gone from their sheet too (1.798).
    if (one.calledKept && reason === "dismissed") one.calledKept.gone = true;
    one.dismissed = true;
    one.defeated = true;
    delete one.x;
    delete one.y;
  }
  ctx.events.push({ type: "sentAway", actorId: caller.id, ids: going.map((one) => one.id), reason });
  departuresOf(ctx, caller);
}

/** How long what each of `caller`'s items called still stays (1.612), in rounds, kept on the item
 *  for a wait that starts at their departure: the longest stay of those still standing, or none
 *  once all have left. One without `rounds` stays to the fight's end. */
function departuresOf(ctx: RulesetCombatContext, caller: RulesetCombatant): void {
  const stays = new Map<number, number>();
  for (const one of ctx.state.combatants) {
    if (one.calledBy !== caller.id || !one.calledItem?.departure) continue;
    const item = one.calledItem.item;
    const left =
      one.dismissed || one.defeated
        ? 0
        : one.calledUntil !== undefined
          ? Math.max(0, one.calledUntil - ctx.state.round)
          : 0;
    stays.set(item, Math.max(stays.get(item) ?? 0, left));
  }
  for (const [item, left] of stays) {
    const { outRounds: _was, ...rest } = rulesetItemCallRoll(caller, item);
    (caller.callRolls ??= {})[item] = left > 0 ? { ...rest, outRounds: left } : rest;
  }
}

/**
 * The window before the fight's very first turn (Capability API 1.315), opened when somebody's
 * lair's count comes before everybody's: their lair actions are taken in it, and the first turn
 * goes on as it was handed out once it closes. Anything that turn's start was asking waits behind
 * it. The fight as it was when nobody's lair is due.
 */
/** The kinds a zone strikes (1.753), named as it was cast, as creature types and tags. */
function chosenKinds(definition: RulesetDefinition, kinds: readonly string[]): RulesetTargetIs {
  const types = definition.combat?.creatureTypes?.types ?? [];
  const typed = kinds.filter((id) => types.some((type) => type.id === id));
  const tagged = kinds.filter((id) => !typed.includes(id));
  return { ...(typed.length ? { types: typed } : {}), ...(tagged.length ? { tags: tagged } : {}) };
}

/** An action reaching only the kinds named as it was cast (1.753), where it names them: named none,
 *  it reaches whom its own `targetTypes` say. */
function withChosenKinds<T extends RulesetCombatAction | undefined>(
  definition: RulesetDefinition,
  action: T,
  kinds: readonly string[] | undefined,
): T {
  if (!kinds?.length) return action;
  // The one thing what it puts on wards off (1.758): Wish.
  if (action?.wardPick && action.applies)
    return { ...action, applies: action.applies.map((entry) => ({ ...entry, wardsOff: kinds[0]! })) };
  if (!action?.kindsOf) return action;
  return { ...action, targetTypes: { ...(action.targetTypes ?? {}), is: chosenKinds(definition, kinds) } };
}

/** A zone somebody set up before a fight (1.462): one of their own entries with a zone, by id or
 *  name, set down where they stand (`self`) or between them and their nearest foe (`between`, the
 *  default); for a glyph that stores another entry, that one too, by name. Or any other entry of
 *  theirs (1.465), done as the fight starts `on` whoever it names, by id or name: themselves when
 *  it names nobody. */
export interface RulesetStandingZone {
  casterId: string;
  entry: string;
  at?: "self" | "between";
  stores?: string;
  on?: string[];
  /** The creature type a zone that chooses whom it works on works on (1.466), by id or name; or
   *  that an entry that names one as it is used names (1.487): Antipathy/Sympathy on an object. */
  kind?: string;
  /** The mode an entry is done in (1.487), by id or name: the creature Find Familiar calls. */
  mode?: string;
  /** Cast into something that stores it (1.524), by name: an item of theirs, or of the one `on`
   *  names first, or that creature itself. Paid for off their sheet at its own level. */
  into?: string;
  /** Creature types, by id or name, left out of what a zone keeps out (1.666): Hallow's excluded
   *  kinds. Each must be one it keeps out. */
  spares?: string[];
  /** Whom a zone's inside works on, by a tag they carry (1.666): Hallow's "creatures that follow a
   *  specific deity or leader". */
  tag?: string;
  /** The kinds a zone strikes (1.753), creature types or tags by id or name, as its caster named
   *  them: Forbiddance's. */
  kinds?: string[];
  /** Kept on its caster's sheet from a use outside a fight (1.798), by the entry's name there: paid
   *  for then, so not again, and what it calls is marked as kept for the fight's write-back. */
  kept?: string;
}

/** Where a zone set up before a fight is set down (1.462), on a board. */
function standingCell(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  at: "self" | "between",
  action?: RulesetCombatAction,
): RulesetCombatCell | undefined {
  const own = rulesetPositionOf(caster);
  if (!own || !state.board?.grid) return own ?? undefined;
  const foes = state.combatants
    .filter((one) => one.side !== caster.side && rulesetCombatStanding(one) && rulesetPositionOf(one))
    .sort((a, b) => rulesetGap(caster, a) - rulesetGap(caster, b));
  const foe = foes[0] ? rulesetPositionOf(foes[0]) : undefined;
  const between = foe ? { x: Math.round((own.x + foe.x) / 2), y: Math.round((own.y + foe.y) / 2) } : own;
  const base = at === "self" ? own : between;
  // An area put down where they stand that works on whoever is in it, not only their foes (laptop
  // 2026-10-25: an Entangle set up "at self" held the whole party and nobody else): over their foes
  // instead, wherever it catches the fewest of their own side and then the most foes. One put down
  // between them that catches no foe is moved onto them too (laptop: a cell short of the wolves).
  if (
    !action?.area ||
    action.zone?.anchor === "caster" ||
    // A trap set off by whoever walks in (a glyph) is laid where they stand on purpose.
    !!action.zone?.detonates ||
    !!action.zone?.hidden ||
    // A ward over the ground (Hallow) is meant to stand around them.
    !!action.zone?.inside ||
    !!action.zone?.keepsOut ||
    !!action.zone?.wards ||
    !!action.zone?.forbids ||
    (!action.damage && !action.save && !action.applies?.length) ||
    action.area.friendlyFire === false ||
    action.heal ||
    action.targets.side === "ally" ||
    action.targets.side === "self"
  )
    return base;
  const caught = (cell: RulesetCombatCell) => {
    const cells = new Set(rulesetAimedCells(state, caster.id, action.id, cell).map((one) => `${one.x},${one.y}`));
    const inside = state.combatants.filter(
      (one) =>
        rulesetCombatStanding(one) &&
        !rulesetUnhinderedBy(one, [action.id, action.label]) &&
        rulesetFootprint(one).some((spot) => cells.has(`${spot.x},${spot.y}`)),
    );
    return {
      own: inside.filter((one) => one.side === caster.side).length,
      foes: inside.filter((one) => one.side !== caster.side).length,
    };
  };
  const here = caught(base);
  if (here.own === 0 && (at === "self" || here.foes > 0 || foes.length === 0)) return base;
  // Each of them, nearest first, then their middle, then the cell between.
  const placed = foes.map((one) => rulesetPositionOf(one)!);
  const middle = placed.length
    ? {
        x: Math.round(placed.reduce((sum, cell) => sum + cell.x, 0) / placed.length),
        y: Math.round(placed.reduce((sum, cell) => sum + cell.y, 0) / placed.length),
      }
    : undefined;
  const tried = [...placed, ...(middle ? [middle] : []), ...(between === base ? [] : [between])].map((cell) => ({
    cell,
    ...caught(cell),
  }));
  const best = tried.sort((a, b) => a.own - b.own || b.foes - a.foes)[0];
  return best && (best.own < here.own || (best.own === here.own && best.foes > here.foes)) ? best.cell : base;
}

/**
 * What stands as a fight starts (Capability API 1.462): each zone its caster set up before it, paid
 * for now off their sheet and put down as though just cast, held by their concentration where it
 * needs it. A hidden one is put down unsaid, so its foes learn of it only by finding it. What cannot
 * be set up (no such entry, nothing to pay with, a stored entry it cannot hold) is left out and said.
 */
export function rulesetStandingAtStart(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  standing: readonly RulesetStandingZone[] | undefined,
): { state: RulesetEncounterState; skipped: string[] } {
  const combat = definition.combat;
  if (!combat || !standing?.length) return { state, skipped: [] };
  const { ctx, finish } = begin(definition, combat, state, rulesetCombatRoller(state.seed, state.cursor));
  const skipped: string[] = [];
  const pay = (caster: RulesetCombatant, action: RulesetCombatAction, kept?: string): boolean => {
    // Paid for when it was used outside the fight (1.798).
    if (kept !== undefined) return true;
    const price = planRulesetCombatCost(definition, caster, action);
    if (!price) return false;
    if (price.live && caster.sheet) caster.sheet.live = price.live;
    spendAvailability(ctx, caster, action);
    return true;
  };
  for (const one of standing) {
    const caster = rulesetCombatant(ctx.state, one.casterId);
    if (!caster || !rulesetCombatStanding(caster)) continue;
    const named = (action: RulesetCombatAction, name: string) =>
      action.id === name ||
      action.label.trim().toLowerCase() === name.trim().toLowerCase() ||
      // An item's use by its own name too, as the ruleset wrote it: "Apply the Oil".
      (!!action.itemUse && action.label.trim().toLowerCase().endsWith(`: ${name.trim().toLowerCase()}`));
    // A row of theirs by that name that stands for the same entry as another (Pact of the Chain's
    // "Find Familiar" beside its "Find Familiar (Pact of the Chain)", the one a fight reads): any
    // name of those rows (cloud probe 2026-10-25: the owl kept on the sheet never came).
    const rows = Object.values(caster.sheet?.build.lists ?? {}).flatMap((list) =>
      Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [],
    );
    const cells = (row: Record<string, unknown>) =>
      Object.values(row).filter((value): value is string => typeof value === "string");
    const refs = new Set(
      rows
        .filter((row) => cells(row).some((cell) => cell.trim().toLowerCase() === one.entry.trim().toLowerCase()))
        .map((row) => rulesetRowEntryRef(row))
        .filter((ref): ref is string => typeof ref === "string"),
    );
    const aliases = rows.filter((row) => refs.has(rulesetRowEntryRef(row) as string)).flatMap(cells);
    // The mode it is done in (1.487), by id or name, or the kind it names.
    const lower = (text: string) => text.trim().toLowerCase();
    // Or by the creature it calls or the form it takes, without its count or its kind (class pass
    // 2026-10-24: "Imp" for "Imp ×1", "Warhorse" for "Warhorse, Celestial"), the first such way.
    const bare = (text: string) =>
      lower(text)
        .replace(/\s*×\s*\S+$/, "")
        .replace(/^.*:\s*/, "")
        .split(",")[0]!
        .trim();
    const action =
      caster.actions.find((entry) => !!entry.zone && named(entry, one.entry)) ??
      // Any other entry of theirs (1.465), done as the fight starts.
      caster.actions.find((entry) => named(entry, one.entry)) ??
      caster.actions.find((entry) => aliases.some((alias) => named(entry, alias))) ??
      // What their sheet keeps, through any entry of theirs that calls it or takes its form (cloud
      // batch 2026-10-25: a warlock's plain Find Familiar row, never prepared, beside the Pact's own
      // that the fight reads, and the owl it kept never came).
      (one.kept !== undefined && one.mode
        ? caster.actions.find((entry) =>
            entry.modes?.some((mode) =>
              [mode.call?.name, mode.form?.name].some((name) => name !== undefined && bare(name) === bare(one.mode!)),
            ),
          )
        : undefined);
    if (!action) {
      skipped.push(`${caster.name} has no entry called "${one.entry}", so nothing stands for it.`);
      continue;
    }
    const picked = one.mode
      ? (action.modes?.find((entry) => entry.id === one.mode || lower(entry.label) === lower(one.mode!)) ??
        // Its creature and type without its count (1.798): "Owl, Fey" for "Owl ×1, Fey".
        action.modes?.find((entry) => lower(entry.label).replace(/\s*×\s*[^,\s]+/, "") === lower(one.mode!)) ??
        action.modes?.find((entry) =>
          [entry.label, entry.call?.name, entry.form?.name].some(
            (name) => name !== undefined && bare(name) === bare(one.mode!),
          ),
        ))
      : undefined;
    if (one.mode && !picked) {
      skipped.push(`${caster.name}'s ${action.label} has no "${one.mode}", so it is not done.`);
      continue;
    }
    // Stored before the fight (1.524): in an item, or a creature that stores, as it is named.
    if (one.into) {
      const holder = one.on?.[0]
        ? ctx.state.combatants.find((other) => other.id === one.on![0] || lower(other.name) === lower(one.on![0]!))
        : caster;
      const index = (holder?.sheet?.items ?? []).findIndex(
        (held) =>
          !!held.item.stores &&
          [held.name ?? "", held.stack?.ref ?? ""].some((name) => lower(name) === lower(one.into!)),
      );
      const stores =
        index >= 0
          ? holder!.sheet!.items![index]!.item.stores
          : holder && lower(holder.name) === lower(one.into)
            ? holder.block?.stores
            : undefined;
      const item = index >= 0 ? index : undefined;
      const level = rulesetPaidLevel(definition, caster, action);
      const held = holder && stores ? rulesetStoredNow(holder, item) : [];
      const fits =
        !!holder &&
        !!stores &&
        !!action.catalog &&
        stores.catalogs.includes(action.catalog) &&
        held.length < (stores.count ?? 20) &&
        level >= 1 &&
        level + held.reduce((total, entry) => total + entry.level, 0) <= stores.levels;
      if (!fits) {
        skipped.push(`${caster.name}'s ${action.label} cannot be stored in "${one.into}", so nothing is stored.`);
        continue;
      }
      const before = caster.sheet?.live;
      if (!pay(caster, action) || !storeInto(ctx, caster, action, holder!, item, level)) {
        if (caster.sheet && before !== undefined) caster.sheet.live = before;
        skipped.push(`${caster.name} has nothing left to pay for ${action.label} with, so it is not stored.`);
      }
      continue;
    }
    if (!action.zone) {
      const kindPicked = one.kind
        ? action.modes?.find(
            (entry) =>
              entry.kind !== undefined &&
              (entry.kind === one.kind || lower(entry.label) === lower(one.kind!) || entry.id === one.kind),
          )
        : undefined;
      if (one.kind && !kindPicked) {
        skipped.push(`${caster.name}'s ${action.label} cannot name "${one.kind}", so it is not done.`);
        continue;
      }
      const chosen = picked ?? kindPicked;
      if (!chosen && action.modes?.length) {
        const ways = action.modes
          .slice(0, 6)
          .map((entry) => entry.label)
          .join(", ");
        skipped.push(
          `${caster.name}'s ${action.label} is done one of several ways (${ways}${action.modes.length > 6 ? ", ..." : ""}) and none was named, so it is not done.`,
        );
        continue;
      }
      const done = chosen ? (rulesetModedAction(definition, action, chosen.id) ?? action) : action;
      const side = done.targets.side;
      const named = (one.on ?? [])
        .map((name) =>
          ctx.state.combatants.find(
            (other) => other.id === name || other.name.trim().toLowerCase() === name.trim().toLowerCase(),
          ),
        )
        .filter((other): other is RulesetCombatant => !!other && rulesetCombatStanding(other))
        .filter((other) =>
          side === "self"
            ? other.id === caster.id
            : side === "ally"
              ? other.side === caster.side
              : side === "enemy"
                ? other.side !== caster.side
                : true,
        );
      const targets = (named.length ? named : side === "self" || side === "ally" ? [caster] : []).slice(
        0,
        Math.max(1, done.targets.count),
      );
      if (!targets.length) {
        skipped.push(`${caster.name}'s ${action.label} names nobody it can be done on, so it is not done.`);
        continue;
      }
      const before = caster.sheet?.live;
      if (!pay(caster, action, one.kept)) {
        if (caster.sheet && before !== undefined) caster.sheet.live = before;
        skipped.push(`${caster.name} has nothing left to pay for ${action.label} with, so it is not done.`);
        continue;
      }
      const there = new Set(ctx.state.combatants.map((other) => other.id));
      resolveAction(ctx, caster, done, targets);
      // What it called is the one their sheet keeps (1.798), told apart for the write-back.
      if (one.kept !== undefined)
        for (const other of ctx.state.combatants)
          if (!there.has(other.id) && other.calledBy === caster.id) other.calledKept = { entry: one.kept };
      continue;
    }
    // The kind it works on (1.466), as a mode.
    const kindMode = one.kind
      ? action.modes?.find(
          (entry) =>
            !!entry.insideType &&
            (entry.insideType === one.kind || entry.label.trim().toLowerCase() === one.kind!.trim().toLowerCase()),
        )
      : undefined;
    if (one.kind && !kindMode) {
      skipped.push(`${caster.name}'s ${action.label} cannot be set on "${one.kind}", so it works on everybody.`);
    }
    // A spell glyph's stored entry (1.454), as a mode.
    const mode =
      picked ??
      kindMode ??
      (one.stores
        ? action.modes?.find((entry) => {
            const stored = entry.stores ? caster.actions.find((held) => held.id === entry.stores) : undefined;
            return !!stored && named(stored, one.stores!);
          })
        : undefined);
    if (one.stores && !mode) {
      skipped.push(`${caster.name}'s ${action.label} cannot hold "${one.stores}", so it stands with its own effect.`);
    }
    const stored = mode?.stores ? caster.actions.find((held) => held.id === mode.stores) : undefined;
    if (stored && rulesetPaidLevel(definition, caster, stored) > rulesetPaidLevel(definition, caster, action)) {
      skipped.push(`${caster.name}'s ${action.label} cannot hold "${stored.label}", so nothing stands for it.`);
      continue;
    }
    const before = caster.sheet?.live;
    if (!pay(caster, action) || (stored && !pay(caster, stored))) {
      if (caster.sheet && before !== undefined) caster.sheet.live = before;
      skipped.push(`${caster.name} has nothing left to pay for ${action.label} with, so it does not stand.`);
      continue;
    }
    // The kinds it strikes, as its caster named them (1.753): its own when none were.
    const kinds = (one.kinds ?? []).flatMap((name) => {
      const kind = action.kindsOf?.find((entry) => entry.id === name || lower(entry.label) === lower(name));
      if (kind) return [kind.id];
      skipped.push(`${caster.name}'s ${action.label} cannot be set against "${name}", so it is not.`);
      return [];
    });
    // Its damage type (1.753): the first when none was named, and said.
    const typed = mode ?? (action.damageTypeChoice ? action.modes?.find((entry) => entry.damageType) : undefined);
    if (typed && !mode) {
      skipped.push(`${caster.name}'s ${action.label} was given no damage type, so it deals ${lower(typed.label)}.`);
    }
    const mark = ctx.events.length;
    if (action.concentration) startConcentration(ctx, caster, action);
    const at = standingCell(ctx.state, caster, one.at ?? "between", action);
    placeZone(ctx, caster, action, {
      kind: "action",
      actorId: caster.id,
      optionId: action.id,
      targetIds: [],
      ...(at ? { at } : {}),
      ...(typed ? { mode: typed.id } : {}),
      ...(kinds.length ? { kinds } : {}),
    });
    // Put down before anybody was looking: no blow it strikes as it appears, and a hidden one unsaid.
    if (caster.flags.freshZones) {
      caster.flags.freshZones = caster.flags.freshZones.filter((id) => id !== action.id);
      if (caster.flags.freshZones.length === 0) delete caster.flags.freshZones;
    }
    // What its caster left out of what it keeps out, and whom its inside works on by a tag (1.666).
    const placed = [...(caster.zones ?? [])].reverse().find((zone) => zone.actionId === action.id);
    if (placed && one.spares?.length) {
      const keeps = action.zone?.keepsOut?.is.types ?? [];
      const kinds = definition.combat?.creatureTypes?.types ?? [];
      const spared = one.spares.flatMap((name) => {
        const kind = kinds.find((entry) => entry.id === name || lower(entry.label) === lower(name));
        if (kind && keeps.includes(kind.id)) return [kind.id];
        skipped.push(`${caster.name}'s ${action.label} does not keep "${name}" out, so it cannot leave it out.`);
        return [];
      });
      if (spared.length) placed.keptOutSpares = spared;
    }
    if (placed && one.tag) {
      if (action.zone?.inside) placed.insideIs = { tags: [one.tag] };
      else skipped.push(`${caster.name}'s ${action.label} does nothing inside it, so "${one.tag}" changes nothing.`);
    }
    if (action.zone?.hidden) ctx.events.length = mark;
  }
  const step = finish();
  return { state: { ...step.state, opening: [...step.state.opening, ...step.events] }, skipped };
}

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
      ctx.events.push({
        type: "spend",
        actorId: actor.id,
        pool: entry.pool,
        label: entry.label,
        amount: entry.amount,
        on: action.label,
      });
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
        !heldInTime(ctx, one) &&
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

/** Whether what `holder` readied for an opponent acting could be taken now: a walk always can, and
 *  anything else at somebody it reaches (a readied heal is for a friend). Asking one who could take it at nobody
 *  only logs them letting the moment go, on every action an opponent takes (laptop playtest
 *  2026-10-24: "Goblin Blade 6 may take what they readied" on each of a companion's actions). */
function readiedHasTarget(ctx: RulesetCombatContext, holder: RulesetCombatant): boolean {
  if (holder.readied!.optionId === RULESET_MOVE_OPTION) return true;
  return ctx.state.combatants.some((one) => rulesetCombatStanding(one) && readiedReaches(ctx, holder, one));
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
          !heldInTime(ctx, one) &&
          rulesetCombatStanding(one) &&
          (one.budgets[ctx.combat.readying!.budget] ?? 0) >= 1 &&
          rulesetCanSee(ctx.definition, ctx.state, one, source) &&
          readiedHasTarget(ctx, one),
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
  // Kept up by a condition put on as it was lifted (1.565), before its holder's speeds are synced:
  // Telekinesis.
  if (rulesetActiveConditions(ctx.definition, ctx.combat, flier, ctx.state).some((entry) => entry.hover)) return;
  const grounded =
    !rulesetCombatStanding(flier) ||
    !!rulesetProneCondition(ctx.definition, ctx.combat, flier) ||
    rulesetSpeedZero(ctx.definition, ctx.combat, flier, ctx.state) ||
    // Its flight gone with what gave it (1.395).
    !flier.speeds?.fly;
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
function zonesAround(ctx: RulesetCombatContext): Map<RulesetCombatZone, ZoneOccupancy> {
  const inside = new Map<RulesetCombatZone, ZoneOccupancy>();
  if (!ctx.state.combatants.some((one) => one.zones?.length)) return inside;
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    inside.set(zone, {
      zone: new Set(rulesetZoneOccupants(ctx.state, caster, zone, action)),
      // A wall's side counts apart (1.177): walking onto it catches as the side says.
      side: new Set(rulesetZoneSideOccupants(ctx.state, caster, zone, action)),
      // Who stands within a layered wall's flash (1.490), for whoever moves near it.
      near: new Set(
        action.zone?.layers?.flash?.triggers.includes("enter")
          ? ctx.state.combatants.filter((one) => flashNear(ctx, caster, zone, action, one)).map((one) => one.id)
          : [],
      ),
      // Who it keeps out stands in it already (1.595), for a zone that ends on being carried over one.
      kept: new Set(action.zone?.keepsOut?.endsOnSweep ? sweptKept(ctx, caster, zone, action) : []),
    });
  }
  return inside;
}

/** Who stands in a zone, on its side, and near its flash, before a step. */
interface ZoneOccupancy {
  zone: Set<string>;
  side: Set<string>;
  near: Set<string>;
  kept: Set<string>;
}

/** Those a zone keeps out standing in it now (1.595), but whoever it is around. */
function sweptKept(
  ctx: RulesetCombatContext,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
): string[] {
  const rule = action.zone?.keepsOut;
  if (!rule) return [];
  const cells = rulesetZoneCells(ctx.state, caster, zone);
  const around = zone.on ?? caster.id;
  return ctx.state.combatants
    .filter(
      (one) =>
        one.id !== around &&
        rulesetCombatStanding(one) &&
        rulesetTargetIs(ctx.definition, one, rulesetKeptOutIs(zone, rule)) &&
        rulesetZoneHoldsOne(cells, one),
    )
    .map((one) => one.id);
}

/** After a step, everybody now inside a zone who was not before it: the mover walking in, or those a
 *  zone its caster carries has just reached. Each is caught as `enter` says. */
function zonesEntered(
  ctx: RulesetCombatContext,
  mover: RulesetCombatant,
  before: Map<RulesetCombatZone, ZoneOccupancy>,
  /** Walking carefully (1.689): ground that spares slow walkers lets them by. */
  careful = false,
): void {
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    const was = before.get(zone);
    if (!was) continue;
    // Carried over somebody it keeps out, it ends (1.595): Antilife Shell.
    if (
      action.zone?.keepsOut?.endsOnSweep &&
      (zone.on ?? (zone.anchor === "caster" ? caster.id : undefined)) === mover.id &&
      caster.zones?.includes(zone) &&
      sweptKept(ctx, caster, zone, action).some((id) => !was.kept.has(id))
    ) {
      spendZone(ctx, caster, zone);
      continue;
    }
    // Moving near a layered wall (1.490): its flash.
    if (
      action.zone?.layers?.flash?.triggers.includes("enter") &&
      !was.near.has(mover.id) &&
      flashNear(ctx, caster, zone, action, mover)
    ) {
      flashOne(ctx, caster, zone, action, mover);
    }
    // Out of it again, what they shrugged off works on them once more (1.460); in it anew, its save.
    const insideNow = rulesetZoneHoldsOne(rulesetZoneCells(ctx.state, caster, zone), mover);
    if (zone.shrugged?.includes(mover.id) && !insideNow) {
      zone.shrugged = zone.shrugged.filter((id) => id !== mover.id);
      if (zone.shrugged.length === 0) delete zone.shrugged;
    }
    if (insideNow && !was.zone.has(mover.id) && caster.zones?.includes(zone)) {
      insideSave(ctx, caster, zone, action, mover);
    }
    // Stepping onto hallowed ground (1.459): what those it keeps out put on them comes off.
    const kept = action.zone?.keepsOut;
    if (
      kept?.frees &&
      caster.zones?.includes(zone) &&
      rulesetZoneHoldsOne(rulesetZoneCells(ctx.state, caster, zone), mover)
    ) {
      for (const entry of [...mover.tracked]) {
        if (!kept.frees.includes(entry.condition) || !entry.source) continue;
        const source = rulesetCombatant(ctx.state, entry.source);
        if (source && rulesetTargetIs(ctx.definition, source, rulesetKeptOutIs(zone, kept))) {
          removeCondition(ctx, mover, entry.condition, "freed");
        }
      }
    }
    // Somebody walking into a glyph (1.451): it goes off, with no save of their own.
    const glyph = action.zone?.detonates;
    if (
      glyph?.entered &&
      !zone.became &&
      mover.id !== caster.id &&
      caster.zones?.includes(zone) &&
      !was.zone.has(mover.id) &&
      rulesetZoneHoldsOne(rulesetZoneCells(ctx.state, caster, zone), mover) &&
      rulesetTargetIs(ctx.definition, mover, glyph.by)
    ) {
      zone.tripped = true;
      zone.trippedBy = mover.id;
      spendZone(ctx, caster, zone);
      continue;
    }
    // Stepping onto a bead (1.183): its save, or it goes off.
    if (action.zone?.detonates?.touched && !zone.became && zone.at && rulesetFills(mover, zone.at)) {
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
      // Carried onto somebody, a zone that says so leaves them be (1.764): Spirit Guardians.
      if (id !== mover.id && action.zone?.enterOnlyByMoving) continue;
      // At half speed over caltrops (1.689), let by.
      if (careful && id === mover.id && action.zone?.spareSlowWalkers) continue;
      const target = rulesetCombatant(ctx.state, id);
      if (target) zoneStrike(ctx, caster, zone, target, "enter", "zone", id !== mover.id);
    }
    for (const id of rulesetZoneSideOccupants(ctx.state, caster, zone, action)) {
      if (was.side.has(id) || id !== mover.id) continue;
      zoneStrike(ctx, caster, zone, mover, "enter", "side");
    }
  }
}

function resolveMove(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  destination: { path: RulesetCombatCell[] },
  /** A jump (1.499): a cell of movement a cell, touching nothing on the way but where it lands. */
  jump = false,
  /** Walked carefully (1.689). */
  careful = false,
) {
  walkOn(ctx, actor, {
    kind: "walk",
    actorId: actor.id,
    from: { x: actor.x!, y: actor.y! },
    walked: [],
    path: [...destination.path],
    asked: [],
    spent: 0,
    ...(jump ? { jump: true as const } : {}),
    ...(careful ? { careful: true as const } : {}),
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
  // Whom they drag as they go (1.497), as it stood when the walk began or picked up again.
  const draggingNow = rulesetDragging(ctx.definition, ctx.state, actor);
  // Whoever hangs on to them (1.676) comes along as a dragged one does.
  const clinging = attachedClingers(ctx, actor);
  // Only when somebody has readied something for an opponent coming near (1.288).
  const readying =
    !!ctx.combat.readying && ctx.state.combatants.some((one) => one.readied?.on === "comes" && one.side !== actor.side);
  let spent = resume.spent;
  let stopped = false;
  let halted = false;
  let at = walked.length > 0 ? walked[walked.length - 1]! : resume.from;
  const rest = [...resume.path];
  // Whoever came along on the way, for the walk's own event (re-test 14): a crocodile's prey.
  const broughtAlong: string[] = [];
  const legendary = resume.legendary;
  // An engulf's walk (1.403): whoever it has entered so far.
  const engulfAction = resume.engulf ? actor.actions.find((one) => one.id === resume.engulf!.actionId) : undefined;
  const engulfing =
    resume.engulf && engulfAction?.engulf
      ? { rule: engulfAction.engulf, entered: [...resume.engulf.entered] }
      : undefined;
  // Taken back up after a strike it provoked (1.283): the window it was bought in stands again, so
  // nothing else opens over it while the walk goes on.
  let outer = resume.outer;
  if (outer && !ctx.state.window) ctx.state.window = outer;
  while (rest.length > 0) {
    // Nor does one an answer held still, stunned or grappled on the way (1.243). Nothing holds one
    // that nothing can (1.283).
    if (
      !rulesetCombatStanding(actor) ||
      (!legendary?.untouchable && rulesetSpeedZero(ctx.definition, ctx.combat, actor, ctx.state))
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
      // Nobody it drags or who clings to it: they come along, so it never leaves their reach.
      const threats = threatsLeaving(ctx, actor, at, cell).filter(
        (enemy) => !asked.has(enemy.id) && !draggingNow.ids.includes(enemy.id) && !clinging.includes(enemy.id),
      );
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
            ...(engulfing ? { engulf: { actionId: resume.engulf!.actionId, entered: [...engulfing.entered] } } : {}),
            ...(resume.leap ? { leap: { ...resume.leap } } : {}),
            ...(resume.jump ? { jump: true as const } : {}),
            ...(resume.careful ? { careful: true as const } : {}),
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
    // Through solid ground, and into another's space, as the menu priced them (1.495).
    if (resume.jump) spent += 1;
    else if (grid) {
      const through = rulesetThroughSolid(grid, cell.x, cell.y, actor);
      const step = through ? null : rulesetMoveStep(grid, at, cell, actor, spent, rulesetSlickCells(ctx.state, actor));
      // A step only its flight takes puts it in the air (1.354).
      if (step?.mode === "fly") actor.airborne = true;
      const plain = through ? 2 : (step?.cost ?? rulesetCellEnterCost(grid, cell.x, cell.y));
      const slowedStep = rulesetSlowedStep(
        grid,
        cell,
        plain,
        rulesetSlowedCells(ctx.state, actor, !!resume.careful),
        at,
        actor,
      );
      const crowdedStep = rulesetCrowdedStep(ctx.definition, ctx.state, actor, cell, plain, slowedStep);
      // Squeezed between walls (1.681), as the menu priced it.
      const squeeze = rulesetSqueezeAt(ctx.definition, ctx.state, actor, cell);
      // Dragging somebody they hold (1.497), as the menu priced it.
      spent += (draggingNow.halves ? crowdedStep * 2 : crowdedStep) * (squeeze?.costs ?? 1);
    } else spent += 1;
    walked.push(cell);
    // What a charge reads (1.186): where this turn's walking began, then each cell of it. A
    // legendary move is nobody's turn.
    if (!legendary) {
      if (!actor.trail?.length) actor.trail = [{ ...at }];
      actor.trail.push({ ...cell });
    }
    // Whoever they carry shut in a sphere (1.314) comes along, into the cell they left, and so does
    // whoever they drag (1.497).
    for (const carried of ctx.state.combatants) {
      const sealed = carried.carriedBy === actor.id && rulesetSealed(ctx.definition, carried, ctx.state);
      if (!sealed && !draggingNow.ids.includes(carried.id) && !clinging.includes(carried.id)) continue;
      carried.x = at.x;
      carried.y = at.y;
      if (!broughtAlong.includes(carried.id)) broughtAlong.push(carried.id);
    }
    at = cell;
    actor.x = cell.x;
    actor.y = cell.y;
    // Harmed walking into some ground (1.708): a fire elemental into water.
    harmedEntering(ctx, actor);
    // And whoever they hold inside (1.403), within them still, and whoever rides them (1.496).
    for (const inside of ctx.state.combatants) {
      if (inside.insideOf === actor.id || inside.mountedOn === actor.id) placeInside(actor, inside);
    }
    // Into a creature's space (1.504): what its holder's entering does to them, once a turn each.
    if (!legendary?.untouchable && (!resume.jump || rest.length === 0)) entersSpaces(ctx, actor);
    // Whoever an engulf walks into (1.403), taken in once the walk ends.
    if (engulfing) {
      const covered = new Set(rulesetFootprint(actor).map((one) => `${one.x},${one.y}`));
      for (const one of ctx.state.combatants) {
        if (engulfing.entered.includes(one.id) || !rulesetEngulfable(ctx.definition, actor, engulfing.rule, one))
          continue;
        if (rulesetFootprint(one).some((mine) => covered.has(`${mine.x},${mine.y}`))) engulfing.entered.push(one.id);
      }
    }
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
            ...(engulfing ? { engulf: { actionId: resume.engulf!.actionId, entered: [...engulfing.entered] } } : {}),
            ...(resume.leap ? { leap: { ...resume.leap } } : {}),
            ...(resume.jump ? { jump: true as const } : {}),
            ...(resume.careful ? { careful: true as const } : {}),
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
    // A jump touches the ground only where it lands (1.499).
    if (!legendary?.untouchable && (!resume.jump || rest.length === 0)) {
      zonesEntered(ctx, actor, before, !!resume.careful);
      zoneGround(ctx, actor, cell);
    }
    // Stopped by what they walked into (1.689): caltrops.
    if (ctx.walkHalted === actor.id) {
      halted = true;
      stopped = true;
      break;
    }
  }
  if (!stopped && !rulesetCombatStanding(actor)) stopped = true;
  spendRulesetMovement(actor, spent);
  if (halted) {
    delete ctx.walkHalted;
    actor.movementLeft = 0;
  }
  settleSqueeze(ctx, actor);
  // Stopped on water they could only run across (1.432): it does not hold them up, and they come out
  // on the nearest open ground.
  let ashore: RulesetCombatCell | null = null;
  if (grid && rulesetCombatStanding(actor) && rulesetPositionOf(actor) && rulesetOnlyCrosses(grid, at, actor)) {
    const taken = new Set<string>();
    for (const one of ctx.state.combatants) {
      if (one.id === actor.id || one.insideOf || !rulesetCombatStanding(one) || !rulesetPositionOf(one)) continue;
      for (const cell of rulesetFootprint(one)) taken.add(`${cell.x},${cell.y}`);
    }
    ashore = rulesetFitCell(grid, at, rulesetSpanOf(actor), taken);
    if (ashore) {
      actor.x = ashore.x;
      actor.y = ashore.y;
    }
  }
  // Its own allowance back (1.283): the lent one was for this move only.
  if (legendary) {
    if (legendary.kept.movementLeft === undefined) delete actor.movementLeft;
    else actor.movementLeft = legendary.kept.movementLeft;
    if (legendary.kept.modeLeft === undefined) delete actor.modeLeft;
    else actor.modeLeft = legendary.kept.modeLeft;
  }
  // Slain before its first step (an opportunity attack as it set off): no walk of nothing to tell
  // (re-test 2026-10-24: a zombie slain by Pip's rapier "moved" from its square to its square). One
  // only knocked down is still told it stopped where it was struck.
  if (walked.length > 0 || !actor.defeated)
    ctx.events.push({
      type: "move",
      actorId: actor.id,
      from: resume.from,
      to: { ...at },
      path: walked,
      cost: spent,
      left: actor.movementLeft ?? 0,
      ...(stopped ? { stopped: true } : {}),
      ...(resume.jump ? { jumped: true as const } : {}),
      ...(broughtAlong.length ? { dragged: broughtAlong } : {}),
    });
  if (ashore) ctx.events.push({ type: "ashore", actorId: actor.id, to: { ...ashore } });
  // Landed on hard going (1.499): the check, or its condition. 5e's DC 10 Acrobatics, or prone.
  const landing = ctx.combat.jumping?.hardLanding;
  if (
    resume.jump &&
    landing &&
    grid &&
    rest.length === 0 &&
    rulesetCombatStanding(actor) &&
    rulesetHardLanding(grid, ctx.state, actor, at) &&
    hidingCheck(ctx, actor, landing.check).total < landing.difficulty
  ) {
    applyConditionId(ctx, actor, landing.applies, { condition: landing.applies, duration: "instant" }, {});
  }
  // Landed from a leap (1.725), all the way: whoever stands there.
  const leapAction = resume.leap ? actor.actions.find((one) => one.id === resume.leap!.actionId) : undefined;
  if (leapAction?.leapsOnto && !stopped && rest.length === 0 && rulesetCombatStanding(actor)) {
    leapLands(ctx, actor, leapAction);
  }
  // Whoever an engulf walked into (1.403), once it has stopped.
  if (engulfing && engulfAction && rulesetCombatStanding(actor)) {
    engulfLands(
      ctx,
      actor,
      engulfAction,
      engulfing.entered.flatMap((id) => rulesetCombatant(ctx.state, id) ?? []),
    );
  }
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
  trigger: Extract<
    RulesetWindowTrigger,
    { kind: "aimed" | "harmed" | "used" | "falls" | "turn-start" | "caught" | "attacked" }
  >,
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
    .filter((one) => !heldInTime(ctx, one))
    .filter((one) => moment === "falls" || moment === "turn-start" || one.id !== trigger.sourceId)
    .filter(
      (one) =>
        moment === "turn-start" || moment === "falls" || moment === "harmed" || !source || one.side !== source.side,
    )
    .filter(
      (one) =>
        rulesetReactionsAt(
          ctx.definition,
          ctx.combat,
          ctx.state,
          one,
          moment,
          trigger.sourceId,
          {
            ...("targetIds" in trigger ? { targetIds: trigger.targetIds } : {}),
            ...("optionId" in trigger
              ? {
                  qualities: rulesetActionQualities(source?.actions.find((entry) => entry.id === trigger.optionId)),
                }
              : {}),
            ...(trigger.kind === "falls" && trigger.fallerIds ? { targetIds: trigger.fallerIds } : {}),
            ...(trigger.kind === "aimed" && trigger.blow ? { blow: trigger.blow } : {}),
            ...("optionId" in trigger && source?.block && !("catalog" in trigger && trigger.catalog)
              ? { action: trigger.label }
              : {}),
            ...("catalog" in trigger && trigger.catalog ? { catalog: trigger.catalog } : {}),
            ...("entry" in trigger && trigger.entry ? { entry: trigger.entry } : {}),
            ...(trigger.kind === "attacked"
              ? { missedIds: trigger.missedIds, blows: trigger.blows, attackOption: trigger.optionId }
              : {}),
          },
          moment === "used"
            ? (action, because) => (ctx.unanswered ??= []).push({ actorId: one.id, label: action.label, because })
            : undefined,
        ).length > 0,
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
  // The kind of attack it is (1.509), for an answer only to ranged ones.
  const aimed = actor.actions.find((one) => one.id === resume.optionId);
  const blow =
    aimed && aimed.toHit !== undefined && targets[0] ? rulesetBlowKind(ctx.state, actor, targets[0], aimed) : undefined;
  return openMoment(
    ctx,
    {
      kind: "aimed",
      targetIds: targets.map((one) => one.id),
      sourceId: actor.id,
      optionId: resume.optionId,
      label,
      ...(blow ? { blow } : {}),
      ...(catalog ? { catalog } : {}),
      ...(entry ? { entry } : {}),
    },
    ctx.state.combatants,
    resume,
  );
}

function resumeAction(ctx: RulesetCombatContext, resume: RulesetActionResume): void {
  // A summons strikes from where it is (Spiritual Weapon): its blow is a swing at its own reach,
  // rolled from its own square, so who stands beside it and what covers the target are read from
  // there, and the cast's range is no shot fired past a foe beside its maker. The cast's own blow
  // is struck from where it appears, beside its target.
  const maker = !resume.resolved && !resume.cancelled ? rulesetCombatant(ctx.state, resume.actorId) : undefined;
  const index = maker ? maker.actions.findIndex((entry) => entry.id === resume.optionId) : -1;
  const cast = index >= 0 ? maker!.actions[index]! : undefined;
  const summon = resume.summon ? maker?.summons?.find((one) => one.actionId === resume.optionId) : undefined;
  const appears =
    !resume.summon && cast?.summons && !cast.summons.strikesAtTurnStart && rulesetIsAttack(cast)
      ? summonCell(ctx.state, rulesetCombatant(ctx.state, resume.targetIds[0] ?? ""))
      : undefined;
  const at = summon?.at ?? appears;
  if (!maker || !cast || !at || typeof maker.x !== "number" || typeof maker.y !== "number") {
    resumeActionFrom(ctx, resume);
    return;
  }
  const home = { x: maker.x, y: maker.y };
  const { range: _range, ...swing } = cast;
  const struck: RulesetCombatAction = { ...swing, reach: summon?.reach ?? cast.summons?.reach ?? 1 };
  maker.x = at.x;
  maker.y = at.y;
  maker.actions[index] = struck;
  if (appears) ctx.summonAppears = appears;
  try {
    resumeActionFrom(ctx, resume);
  } finally {
    delete ctx.summonAppears;
    // Only put back what nothing changed while it struck.
    if (maker.actions[index] === struck) maker.actions[index] = cast;
    if (maker.x === at.x && maker.y === at.y) {
      maker.x = home.x;
      maker.y = home.y;
    }
  }
}

function resumeActionFrom(ctx: RulesetCombatContext, resume: RulesetActionResume): void {
  const actor = rulesetCombatant(ctx.state, resume.actorId);
  const found = actor?.actions.find((entry) => entry.id === resume.optionId);
  // A fake does what it truly does (1.79), and a weapon suppressed is a plain one (1.521): made from
  // inside an antimagic zone, or at somebody inside one.
  const asUsed = found && rulesetActionAsUsed(found);
  const hushed =
    asUsed?.itemTags && actor
      ? [actor, ...(resume.targetIds ?? []).flatMap((id) => rulesetCombatant(ctx.state, id) ?? [])]
          .map((one) => rulesetSuppressedOn(ctx.state, one))
          .find((hush) => hush && asUsed.itemTags!.some((tag) => hush.tags.has(tag)))
      : undefined;
  const own = asUsed && hushed ? rulesetSuppressedAttack(asUsed, hushed) : asUsed;
  // Picked up in the mode it was made in, and with what it was altered with (1.253).
  const moded = withChosenKinds(
    ctx.definition,
    own && resume.mode ? (rulesetModedAction(ctx.definition, own, resume.mode) ?? own) : own,
    resume.kinds,
  );
  let action =
    actor && moded ? rulesetResumedAction(actor, moded, resume.alters, resume.spares, resume.heightens) : moded;
  if (!actor || !action) return;
  if (resume.cancelled || !rulesetCombatStanding(actor)) {
    // A spell called off was cast all the same (1.180).
    if (resume.cancelled && !resume.summon)
      holderActed(ctx, actor, action, undefined, { targets: [], from: ctx.events.length });
    endActionConditions(ctx);
    return;
  }
  if (resume.resolved) {
    finishSummon(ctx, actor, action, resume);
    return;
  }
  // A later strike keeps the cast's amount and payment level, but does not start concentration again.
  if (resume.summon) action = { ...action, concentration: false };
  // Lasting longer for each step of higher cost paid (1.447): Primeval Awareness.
  action = durationsPaid(ctx, actor, action, resume.payWith);
  // One of what it puts on, with none picked: the first (1.448).
  if (action.appliesOneOf && action.applies?.length) action = { ...action, applies: [action.applies[0]!] };
  // A saved fight can come back through an import, so only a real cell of this board is taken.
  const grid = ctx.state.board?.grid;
  const at = resume.at;
  const onBoard = (n: number, size: number) => Number.isInteger(n) && n >= 0 && n < size;
  if (grid && at && onBoard(at.x, grid.width) && onBoard(at.y, grid.height)) ctx.aimedAt = { x: at.x, y: at.y };
  const also = grid
    ? (resume.also ?? []).filter((cell) => onBoard(cell.x, grid.width) && onBoard(cell.y, grid.height))
    : [];
  if (ctx.aimedAt && also.length) ctx.aimedAlso = also.map((cell) => ({ x: cell.x, y: cell.y }));
  // Where a teleport goes, or a moved target is set down, as it was chosen before the window. A
  // cell off this board is no cell at all: never read as a teleport out of the fight.
  const goes = resume.teleport?.to;
  if (
    resume.teleport &&
    !ctx.teleport &&
    (!goes || (grid && onBoard(goes.x, grid.width) && onBoard(goes.y, grid.height)))
  ) {
    ctx.teleport = {
      ...(goes ? { to: { x: goes.x, y: goes.y } } : {}),
      carries: [...(resume.teleport.carries ?? [])],
    };
  }
  const carried = resume.carriesTo;
  if (grid && carried && !ctx.carriesTo && onBoard(carried.x, grid.width) && onBoard(carried.y, grid.height)) {
    ctx.carriesTo = { ...carried };
  }
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
              !!target &&
              (!target.defeated ||
                rulesetCanRevive(ctx.state, action, target) ||
                // A corpse to raise from (1.554).
                (!!action.calls?.atCorpse &&
                  rulesetRaisableCorpse(ctx.definition, ctx.state, action.calls.atCorpse, target))),
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
  // Layered walls it reaches (1.490), standing in as props do, never broken by it.
  const walls = !reaches
    ? []
    : rulesetStandingLayers(ctx.state).flatMap((wall) => {
        const cell = wall.cells.find((one) => covered.has(`${one.x},${one.y}`));
        return cell
          ? [
              {
                ...wall,
                stand: objectStandIn(
                  `layers>${wall.caster.id}>${wall.zone.actionId}`,
                  wall.zone.label,
                  actor,
                  LAYERED_STAND_IN,
                  LAYERED_STAND_IN.health,
                  cell,
                ),
              },
            ]
          : [];
      });
  harmedBy(ctx, actor, action, resume, () => {
    const from = ctx.events.length;
    const standing = [...caught.map(({ stand }) => stand), ...walls.map(({ stand }) => stand)];
    ctx.state.combatants.push(...standing);
    const hold = resolveAction(
      ctx,
      actor,
      action,
      [...standing, ...targets],
      resume.payWith,
      resume.held,
      resume.style,
      resume.spend,
    );
    if (standing.length === 0) return hold;
    // Taken off the board again before anybody is asked about being hurt: a prop is nobody.
    const stands = new Set(standing);
    ctx.state.combatants = ctx.state.combatants.filter((one) => !stands.has(one));
    const worn = walls.map((wall) => ({ wall, damage: dealtByType(ctx, from, wall.stand.id) }));
    const blows = objectBlows(
      ctx,
      from,
      standing.map((stand) => stand.id),
    );
    for (const { prop, stand } of caught) {
      const { dealt, struck } = blows[stand.id]!;
      breakProp(ctx, actor, action.label, prop, stand, "area", dealt, struck);
    }
    for (const { wall, damage } of worn) wearLayer(ctx, wall.caster, wall.zone, wall.action, { damage }, actor.id);
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
      action.innate
        ? Math.max(0, action.innate.level - action.innate.baseLevel)
        : resume.payWith
          ? rulesetCostSteps(ctx.definition, action, resume.payWith, actor)
          : 0,
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
  // An entry a layered wall's layer names, reaching it (1.490): Daylight on the indigo.
  if (grid && at && action.area && action.entry && !resume.held && rulesetStandingLayers(ctx.state).length > 0) {
    wearLayersAt(
      ctx,
      areaCellsFor(ctx.state, actor, action.id, at, {
        ...(resume.also ? { also: resume.also } : {}),
        grow: rulesetAreaGrowth(ctx.definition, actor, action.id, resume.payWith),
      }),
      { entry: action.entry },
      actor.id,
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
          qualities: rulesetActionQualities(action),
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
  delete ctx.caught;
  // Whoever it attacked before it was held (1.422), and whoever it attacks now.
  if (resume.held?.attacked) ctx.attacked = structuredClone(resume.held.attacked);
  else delete ctx.attacked;
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
  // A missile caught (1.416), asked of whoever caught it once nobody hurt had anything to answer.
  // Read fresh: resolve() above records it, which the narrowing from the delete before cannot see.
  const caught = ctx.caught as RulesetCombatContext["caught"];
  delete ctx.caught;
  const catching =
    !waiting &&
    !resume.outer &&
    !!caught &&
    rulesetEncounterOutcome(ctx.state) === "ongoing" &&
    openMoment(
      ctx,
      {
        kind: "caught",
        targetIds: caught.targetIds,
        sourceId: actor.id,
        label: action.label,
        ...(action.catalog ? { catalog: action.catalog } : {}),
        ...(action.entry ? { entry: action.entry } : {}),
        damage: caught.damage,
        ...(caught.missile ? { missile: caught.missile } : {}),
      },
      caught.targetIds.map((id) => rulesetCombatant(ctx.state, id)).filter((one): one is RulesetCombatant => !!one),
      action.summons || action.zone ? { ...resume, resolved: true } : undefined,
    );
  // An attack over, hit or missed (1.422), asked of whoever it was made at once nothing else was.
  const attacked = ctx.attacked as RulesetCombatContext["attacked"];
  delete ctx.attacked;
  const attacking =
    !waiting &&
    !catching &&
    !resume.outer &&
    !!attacked &&
    attacked.targetIds.length > 0 &&
    rulesetEncounterOutcome(ctx.state) === "ongoing" &&
    openMoment(
      ctx,
      {
        kind: "attacked",
        targetIds: attacked.targetIds,
        missedIds: attacked.missedIds,
        blows: attacked.blows,
        sourceId: actor.id,
        optionId: action.id,
        label: action.label,
        ...(action.catalog ? { catalog: action.catalog } : {}),
        ...(action.entry ? { entry: action.entry } : {}),
      },
      attacked.targetIds.map((id) => rulesetCombatant(ctx.state, id)).filter((one): one is RulesetCombatant => !!one),
      action.summons || action.zone ? { ...resume, resolved: true } : undefined,
    );
  if (!waiting && !catching && !attacking) finishSummon(ctx, actor, action, resume);
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
    resume: { ...base, held: { ...held, hurt, ...(ctx.attacked ? { attacked: structuredClone(ctx.attacked) } : {}) } },
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
    .filter((threat) => rulesetStepLeavesReach(threat, from, to) && !heldInTime(ctx, threat.combatant))
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
  // A spare head's first (1.550), keeping its own reaction for anything else.
  if (striker.heads?.spare) striker.heads.spare -= 1;
  else spendBudget(ctx, striker, budget);
  countAttack(ctx, striker);
  // A strike made in passing keeps the same books as one made on a turn: a use is a use.
  spendAvailability(ctx, striker, strike);
  // Held where it hits, like any other attack, for what its maker adds to it or anybody's answer to
  // it (1.243): the walk's window waits behind that one.
  ctx.nestHit = true;
  ctx.opportunity = true;
  const hold = resolveAction(ctx, striker, strike, [mover]);
  delete ctx.nestHit;
  delete ctx.opportunity;
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
    searchZones(ctx, actor);
    return;
  } else if (action === "ready") actor.flags.ready = true;
  else if (action === "help" && target) {
    target.flags.helped = true;
    delete target.flags.helpedAgainst;
    // Against whoever is beside its helper, where the ruleset says so (1.771).
    if (ctx.combat.standardEffects?.help?.beside && rulesetPositionOf(actor)) {
      target.flags.helpedAgainst = ctx.state.combatants
        .filter(
          (one) =>
            one.side !== actor.side &&
            rulesetCombatStanding(one) &&
            rulesetCombatantDistance(ctx.state, actor, one) <= 1,
        )
        .map((one) => one.id);
    }
  }
  ctx.events.push({
    type: "standard",
    actorId: actor.id,
    action,
    ...(action === "help" && target ? { targetId: target.id } : {}),
  });
}

/** Help spent by an attack it counted for (1.771: only one at whom it was given). */
function spendHelp(actor: RulesetCombatant, target: RulesetCombatant): void {
  if (!rulesetHelpCounts(actor, target)) return;
  actor.flags.helped = false;
  delete actor.flags.helpedAgainst;
}

/**
 * Disarming a trap (1.669): its check against its difficulty. Made, the trap is gone without going
 * off; failed by its `tripsOnFailBy` or more, it goes off, at whoever tried where entering it sets it
 * off.
 */
function resolveDisarm(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  disarms: NonNullable<RulesetCombatOption["disarms"]>,
): void {
  stirs(ctx, actor, "acted");
  const caster = rulesetCombatant(ctx.state, disarms.casterId);
  const zone = caster?.zones?.find((entry) => entry.actionId === disarms.actionId);
  const action = caster?.actions.find((entry) => entry.id === disarms.actionId);
  const rule = action?.zone?.disarm;
  if (!caster || !zone || !action || !rule) return;
  const check = hidingCheck(ctx, actor, rule.check);
  const difficulty = rule.difficulty ?? action.save?.difficulty ?? action.saveDifficulty ?? 10;
  const made = check.total >= difficulty;
  ctx.events.push({
    type: "zone",
    actorId: caster.id,
    label: zone.label,
    outcome: made ? "disarmed" : "disarm-failed",
    targetId: actor.id,
    check,
  });
  if (made) {
    caster.zones = caster.zones!.filter((entry) => entry !== zone);
    if (caster.zones.length === 0) delete caster.zones;
    if (caster.concentrating?.actionId === zone.actionId) endConcentration(ctx, caster, "spent");
    return;
  }
  if (rule.tripsOnFailBy === undefined || difficulty - check.total < rule.tripsOnFailBy) return;
  if (action.zone?.detonates?.entered) {
    zone.tripped = true;
    zone.trippedBy = actor.id;
  }
  spendZone(ctx, caster, zone);
}

/** A check of the fight's own `checks` thrown on its own (1.287), its number off the combatant. */
function hidingCheck(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  check: string,
  taken?: { advantage: boolean; disadvantage: boolean },
  perceiving?: string,
): RulesetContestSide {
  return throwCheck(ctx, who, check, who.checks?.[check] ?? 0, taken, perceiving);
}

/**
 * Looking for hidden zones as a Search is made (1.455): each check they are found with thrown once,
 * and every one of its foes' its total meets the entry's own save difficulty for is found by the
 * searcher's side.
 */
function searchZones(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const throws = new Map<string, number>();
  for (const { caster, zone, action } of rulesetStandingZones(ctx.state)) {
    const hidden = action.zone?.hidden;
    if (!hidden || rulesetZoneSeenBy(caster, zone, action, actor.side)) continue;
    let total = throws.get(hidden.check);
    if (total === undefined) {
      total = hidingCheck(ctx, actor, hidden.check).total;
      throws.set(hidden.check, total);
    }
    if (total < (action.save?.difficulty ?? action.saveDifficulty ?? 10)) continue;
    zone.foundBy = [...(zone.foundBy ?? []), actor.side];
    ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "found", targetId: actor.id });
  }
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
    const mode = rulesetCheckMode(ctx.definition, ctx.combat, actor, ctx.state, skill, ability, taken, other.id);
    let mine = check;
    if (mode !== plain) {
      const own = throws.get(mode) ?? { ids: [], check: hidingCheck(ctx, actor, perception, taken, other.id) };
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
function givesAway(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
): "attack" | "noise" | undefined {
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
  const needs = rulesetNeededComponents(ctx.definition, actor, action, ctx.state);
  return needs.some((component) => noisy.includes(component)) ? "noise" : undefined;
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
 * A part whose target is defeated by the time it comes round simply does not land. One whose target
 * was standing when the sequence began and has gone down since turns on the nearest other opponent
 * that part reaches, and does not happen with none (re-test 14: a knight's second swing at the
 * fighter its first dropped); a cruel one (combat AI T3) keeps on at them.
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
  // Each strike, with the place of the step it is made for (1.643). A rolled step holds as many
  // places as its dice may come to, so targets are handed out the same however they fall, and only
  // the ones they came to are `live`. A step made after another's hit takes no target of its own.
  const parts: Array<{
    part: RulesetCombatAction;
    step: number;
    live: boolean;
    after?: number;
    /** Its place among a rolled step's strikes. */
    rolled?: number;
  }> = [];
  // How many strikes each rolled step came to, rolled once: a sequence picked up again keeps them.
  const rolls: Record<string, number> = { ...held?.stepRolls };
  (action.sequence ?? []).forEach((step, stepIndex) => {
    const named = byId.get(step.actionId);
    // A part that names another sequence is refused at import, so this is a hand-written block
    // pointing at nothing, and it costs that part rather than the turn. One left out in the mode
    // the sequence is made in (1.643) does not happen either.
    if (!named || named.sequence || step.skipped) return;
    // Only up in the air (1.787): a wyvern's claws.
    if (named.whileFlying && !rulesetUpInTheAir(ctx.state, actor)) return;
    let strikes = rulesetStepTimes(actor, step);
    let places = strikes;
    if (step.dice) {
      places = step.dice.count * step.dice.sides;
      if (rolls[stepIndex] === undefined) {
        rolls[stepIndex] = sumOf(rollRulesetDice(ctx.roll, step.dice.count, step.dice.sides));
        ctx.events.push({
          type: "strikesRolled",
          actorId: actor.id,
          label: named.label,
          dice: `${step.dice.count}d${step.dice.sides}`,
          count: rolls[stepIndex]!,
        });
      }
      strikes = rolls[stepIndex]!;
    }
    for (let time = 0; time < places; time++) {
      parts.push({
        part: named,
        step: stepIndex,
        live: time < strikes,
        ...(step.ifHit !== undefined ? { after: step.ifHit } : {}),
        ...(step.dice ? { rolled: time } : {}),
      });
    }
  });
  const tracks = !!action.sequence?.some((step) => step.dice || step.ifHit !== undefined);
  const wanted = parts.reduce((total, one) => total + (one.after === undefined ? one.part.targets.count : 0), 0);
  const enough = targets.length >= wanted;
  let cursor = 0;
  // The one target every attack in it has hit so far (1.405), false once one has not.
  let allHit: string | false | undefined = action.allHit ? held?.allHit : undefined;
  // The one target every attack of each step hit (1.643), false once one of it has not.
  const hits: Record<string, string | false> = { ...held?.stepHits };
  const tracked = () => (tracks ? { stepHits: { ...hits }, stepRolls: { ...rolls } } : {});
  // Who was down already when it began: whoever chose them chose that.
  const downAtStart = new Set(targets.filter((target) => target.down).map((target) => target.id));
  const reaches = (part: RulesetCombatAction, target: RulesetCombatant) =>
    target.id === actor.id || !rulesetTargetRefusal(ctx.state, actor.id, part.id, target.id, undefined, ctx.definition);
  // Another standing opponent this part reaches, nearest first, for one whose target dropped.
  const another = (part: RulesetCombatAction, fallen: RulesetCombatant, taken: readonly RulesetCombatant[]) => {
    if (fallen.side === actor.side) return undefined;
    return ctx.state.combatants
      .filter(
        (one) =>
          one.side !== actor.side &&
          !one.down &&
          !one.object &&
          rulesetCombatStanding(one) &&
          !taken.some((other) => other.id === one.id) &&
          reaches(part, one),
      )
      .sort(
        (a, b) =>
          (rulesetPositionOf(a) && rulesetPositionOf(actor) ? rulesetGap(actor, a) : 0) -
          (rulesetPositionOf(b) && rulesetPositionOf(actor) ? rulesetGap(actor, b) : 0),
      )[0];
  };
  for (const [index, { part, step, live, after, rolled }] of parts.entries()) {
    const count = after === undefined ? part.targets.count : 0;
    // After an earlier step hit (1.643): at the one it hit, and only then.
    const followed = after === undefined ? undefined : hits[after];
    const offered =
      after === undefined
        ? enough
          ? targets.slice(cursor, cursor + count)
          : // A rolled step's strikes go round the targets given (1.643), as its dice may come to
            // more than anybody could pick ahead.
            rolled !== undefined && count === 1 && targets.length > 1
            ? [targets[rolled % targets.length]!]
            : targets.slice(0, count)
        : followed
          ? [rulesetCombatant(ctx.state, followed)].filter((one): one is RulesetCombatant => !!one)
          : [];
    const aimed = offered.flatMap((target) => {
      if (!target.down || downAtStart.has(target.id) || rulesetCanRevive(ctx.state, part, target) || !part.damage)
        return [target];
      if (actor.temperament === "cruel") return [target];
      const next = another(part, target, offered);
      return next ? [next] : [];
    });
    const chosen = aimed.filter(
      (target) =>
        (!target.defeated || rulesetCanRevive(ctx.state, part, target)) &&
        // Only at whom this part reaches itself: a Multiattack's claws at the foe beside it, its bite
        // farther.
        reaches(part, target),
    );
    cursor += count;
    // A sequence picked up after one of its parts was held starts at that part, which was paid for
    // and has its roll already: every part before it has happened.
    if (held && index < (held.part ?? 0)) continue;
    const resuming = held && index === (held.part ?? 0) ? held : undefined;
    if (!resuming) {
      // A strike its dice did not come to is not made at all (1.643).
      if (!live) continue;
      // One budget for the whole sequence, and each part still keeps its own books: a part that
      // counts its uses spends one, a part that recharges is spent until its dice bring it back, and
      // a part that has none left simply does not happen.
      if (chosen.length === 0 || !rulesetSequencePartAvailable(actor, part)) {
        if (part.toHit !== undefined) {
          allHit = false;
          hits[step] = false;
        }
        continue;
      }
      // A cap on attacks a turn (combat C6d) ends the sequence at the attacks it allows.
      if (part.toHit !== undefined && attacksCapped(ctx, actor)) {
        allHit = false;
        break;
      }
      spendAvailability(ctx, actor, part);
      if (part.toHit !== undefined) countAttack(ctx, actor, part);
    }
    const from = ctx.events.length;
    const hold = resolveAction(ctx, actor, part, chosen, undefined, resuming, styleId);
    if (hold) {
      return { ...hold, part: index, ...(action.allHit && allHit !== undefined ? { allHit } : {}), ...tracked() };
    }
    if (action.allHit && part.toHit !== undefined && allHit !== false) {
      allHit = partHit(ctx.events.slice(from), actor, part, resuming, allHit);
    }
    if (tracks && part.toHit !== undefined && hits[step] !== false) {
      hits[step] = partHit(ctx.events.slice(from), actor, part, resuming, hits[step] || undefined);
    }
  }
  if (action.allHit && typeof allHit === "string") allHitLands(ctx, actor, action, action.allHit, allHit);
  return null;
}

/** Whether one attack part of a sequence hit `so far`'s target, or the first it was made at (1.405):
 *  its target, or false where it missed, hit another, or never came round. */
function partHit(
  events: readonly RulesetCombatEvent[],
  actor: RulesetCombatant,
  part: RulesetCombatAction,
  resuming: RulesetHeldAttack | undefined,
  so: string | undefined,
): string | false {
  const outcomes: { targetId: string; outcome: RulesetCombatAttackOutcome }[] = [];
  if (resuming) {
    // Held as it hit: hit still, unless what was done in answer turned it.
    const recheck = events.filter(
      (event) =>
        event.type === "recheck" &&
        event.actorId === actor.id &&
        event.optionId === part.id &&
        event.targetId === resuming.targetId,
    );
    const last = recheck.at(-1);
    outcomes.push({ targetId: resuming.targetId, outcome: last?.type === "recheck" ? last.outcome : "hit" });
  }
  for (const event of events) {
    if (event.type === "attack" && event.actorId === actor.id && event.optionId === part.id) {
      outcomes.push({ targetId: event.targetId, outcome: event.outcome });
    }
  }
  if (outcomes.length === 0) return false;
  let target = so;
  for (const one of outcomes) {
    if (one.outcome === "miss" || (target !== undefined && one.targetId !== target)) return false;
    target = one.targetId;
  }
  return target ?? false;
}

/** A sequence whose every attack hit the one target (1.405): what it puts on them, then the action it
 *  uses on them, while they are what it asks. A shambling mound's grapple, and its Engulf. */
function allHitLands(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  rule: RulesetAllHit,
  targetId: string,
): void {
  const target = rulesetCombatant(ctx.state, targetId);
  if (!target || target.defeated || !rulesetCombatStanding(actor)) return;
  if (rule.targetIs && !rulesetTargetIs(ctx.definition, target, rule.targetIs)) return;
  for (const applies of rule.applies ?? []) {
    applyConditionId(ctx, target, applies.condition, applies, {
      sourceId: actor.id,
      action: [action.id, action.label],
    });
  }
  const used = rule.uses ? actor.actions.find((one) => one.id === rule.uses) : undefined;
  if (!used || target.defeated) return;
  if (used.engulf) engulfLands(ctx, actor, used, [target]);
  else resolveAction(ctx, actor, used, [target]);
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
  /** Whether the target was hurt before this blow landed (1.393). */
  hurt: boolean,
): RulesetCombatRider | null {
  const spent = actor.ridersSpent ?? [];
  for (const rider of actor.riders ?? []) {
    if (rider.on !== "hit" || spent.includes(rider.id)) continue;
    // Once on each of its holder's own turns (1.393), and never on anybody else's.
    if (rider.oncePer === "own-turn" && !rulesetOnOwnTurn(ctx.state, actor)) continue;
    if (rider.actions && !rider.actions.includes(action.id)) continue;
    // Any-of: one of the things it asked for being true is enough.
    if (
      rider.when?.length &&
      !rider.when.some((when) =>
        when === "advantage"
          ? mode === "advantage"
          : when === "target-hurt"
            ? hurt
            : when === "target-surprised"
              ? rulesetTargetMoment(ctx.state, target, "surprised")
              : when === "target-not-yet-acted"
                ? rulesetTargetMoment(ctx.state, target, "not-yet-acted")
                : allyAdjacent(ctx, actor, target) &&
                  (when !== "ally-adjacent-no-disadvantage" || mode !== "disadvantage"),
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
  /** Whom it was aimed at, and where in the step's events it began, for a cast that ends it only
   *  when it reaches a foe (1.425). Unknown, a cast counts as reaching one. */
  reached?: { targets: readonly RulesetCombatant[]; from: number },
): void {
  if (ctx.byZone) return;
  const attacks = rulesetIsAttack(action);
  const casts = action.catalog ?? action.casts;
  let atFoes: boolean | undefined;
  const reachesFoe = () => (atFoes ??= !reached || castReachesFoe(ctx, actor, reached.targets, reached.from));
  const ended = actor.tracked.filter(
    (entry) =>
      (!before || before.has(entry)) &&
      ((entry.endsWhenHolder?.attacks && attacks) ||
        (casts !== undefined &&
          !!entry.endsWhenHolder?.casts?.includes(casts) &&
          (!entry.endsWhenHolder.castsAtFoes || reachesFoe())) ||
        // One of its holder's own actions or entries by name (1.307): a quasit's Scare.
        !!entry.endsWhenHolder?.uses?.some((used) => used === action.id || used === action.entry)),
  );
  for (const entry of ended) {
    if (actor.tracked.includes(entry)) removeCondition(ctx, actor, entry.condition, "spent");
  }
  // And what its rule says attacking or casting ends, however it was put on (1.426): Tranquility,
  // held from a rest.
  for (const condition of rulesetCombatConditions(ctx.definition, actor)) {
    const ends = ctx.combat.conditions?.find((rule) => rule.condition === condition)?.endsWhenHolder;
    if (!ends) continue;
    // One this very action put on them stays, as above.
    const held = actor.tracked.filter((entry) => entry.condition === condition);
    if (before && held.length > 0 && !held.some((entry) => before.has(entry))) continue;
    if (
      (ends.attacks && attacks) ||
      (casts !== undefined && !!ends.casts?.includes(casts) && (!ends.castsAtFoes || reachesFoe()))
    ) {
      removeCondition(ctx, actor, condition, "spent");
    }
  }
}

/** Whether a cast reached one of its maker's foes (1.425): aimed at one, or one it harmed, put a
 *  condition on or made save as its area or its harm caught them. */
function castReachesFoe(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  targets: readonly RulesetCombatant[],
  from: number,
): boolean {
  const foe = (id: string | undefined) => {
    const one = id === undefined ? undefined : rulesetCombatant(ctx.state, id);
    return !!one && one.id !== actor.id && one.side !== actor.side;
  };
  if (targets.some((one) => foe(one.id))) return true;
  return ctx.events.slice(from).some((event) => {
    if (event.type === "damage" || event.type === "condition") return foe(event.targetId);
    if (event.type === "save") return foe(event.actorId);
    return false;
  });
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
  // Where its events begin, for a cast that ends a condition only when it reaches a foe (1.425).
  const reachedFrom = ctx.events.length;
  // Harmed for acting against who put a condition on (1.562): Geas.
  if (!held) harmForDefiance(ctx, actor, action, targets);
  // Harmed for casting (1.646): Wish's stress.
  if (!held) harmForCasting(ctx, actor, action, payWith);
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
  // Steering a condition it put on (1.464), and nothing else: Compulsion's direction.
  if (action.steers) {
    const at = ctx.aimedAt;
    const steered: string[] = [];
    for (const one of ctx.state.combatants) {
      for (const entry of one.tracked) {
        if (entry.condition !== action.steers || entry.source !== actor.id || !at) continue;
        entry.at = { x: at.x, y: at.y };
        steered.push(one.id);
      }
    }
    ctx.events.push({
      type: "steered",
      actorId: actor.id,
      label: action.label,
      condition: action.steers,
      targetIds: steered,
    });
    return null;
  }
  // A ray rolled for each target, each struck as its rows say (1.468): Prismatic Spray.
  if (action.rays && !ctx.raySaves) {
    ctx.raySaves = new Map();
    try {
      for (const target of targets) {
        for (const row of rayRows(ctx, actor, target, action)) {
          if (row.again) continue;
          const derived: RulesetCombatAction = { ...action };
          delete derived.rays;
          if (row.damageType && action.damage) derived.damage = { ...action.damage, type: row.damageType };
          else delete derived.damage;
          const applies = (action.applies ?? []).filter((one) => row.applies?.includes(one.condition));
          if (applies.length) derived.applies = applies;
          else delete derived.applies;
          resolveAction(ctx, actor, derived, [target], payWith, undefined, styleId, spend);
        }
      }
    } finally {
      delete ctx.raySaves;
    }
    return null;
  }
  // Creatures called beside it (1.325), and nothing else: Jars Burst.
  if (action.calls && !action.area && !action.damage) {
    // Held by its concentration (1.394): Conjure Animals.
    if (action.concentration && !held) startConcentration(ctx, actor, action);
    const steps = action.innate
      ? Math.max(0, action.innate.level - action.innate.baseLevel)
      : payWith
        ? rulesetCostSteps(ctx.definition, action, payWith, actor)
        : 0;
    // Risen from a corpse (1.554): in its space, and the corpse gone.
    const corpse = action.calls.atCorpse
      ? targets.find((one) => rulesetRaisableCorpse(ctx.definition, ctx.state, action.calls!.atCorpse!, one))
      : undefined;
    if (action.calls.atCorpse && !corpse) return null;
    // Or on open cells within so far of their caller, seen (1.621): a treant's trees.
    const cells = corpse
      ? rulesetFootprint(corpse)
      : action.calls.within
        ? callCellsWithin(ctx, actor, action.calls.within)
        : undefined;
    if (corpse) {
      corpse.corpseRaised = true;
      delete corpse.x;
      delete corpse.y;
    }
    callCreatures(ctx, actor, action, cells, steps);
    // And what it puts on its user (1.487): Find Familiar's bond with what it called.
    if (!held) applySelf(ctx, actor, action, payWith, steps);
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
  const giveaway = actor.hiding ? givesAway(ctx, actor, action) : undefined;
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
  if (!result) holderActed(ctx, actor, action, before, { targets, from: reachedFrom });
  if (!result && action.endsCondition) endOwnCondition(ctx, actor, action.endsCondition);
  if (!result && !held) letGoOfNothing(ctx, actor, action);
  return result;
}

/** A concentration spell whose only work is the conditions it puts on others, which landed on
 *  nobody (every target saved Hold Person): there is nothing to hold, so it ends at once rather
 *  than sitting on the caster's token until a hit shakes it loose. */
function letGoOfNothing(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  if (!action.concentration || actor.concentrating?.actionId !== action.id) return;
  if (!action.applies?.length || action.zone || action.sustains || action.repeats || action.again || action.calls)
    return;
  if (action.targets.side === "self") return;
  // Whoever is out of the fight holds nobody: a held bandit killed where it stood. One sent away by
  // the spell itself (Banishment) is still held by it.
  const holds = ctx.state.combatants.some(
    (one) =>
      (!one.defeated || one.away) && one.tracked.some((entry) => entry.concentration && entry.source === actor.id),
  );
  if (!holds) endConcentration(ctx, actor, "spent");
}

/** A combatant taken out of the fight while held: whoever holds it lets go of a spell that now holds
 *  nobody (Hold Person on two, one shaken off and the other killed). */
function letGoOfTheFallen(ctx: RulesetCombatContext, fallen: RulesetCombatant): void {
  for (const holder of ctx.state.combatants) {
    const held = holder.concentrating;
    if (!held || holder.id === fallen.id) continue;
    if (!fallen.tracked.some((entry) => entry.concentration && entry.source === holder.id)) continue;
    const action = holder.actions.find((one) => one.id === held.actionId);
    if (action) letGoOfNothing(ctx, holder, action);
  }
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
    // Kept in a zone that lets nobody out unsaved (1.603), the use spent.
    const from = rulesetPositionOf(actor);
    if (from && teleportHeld(ctx, actor, action, from, null)) return;
    // Out of the fight (1.279), and whoever goes along with it.
    const along = carries
      .map((id) => rulesetCombatant(ctx.state, id))
      .filter((one): one is RulesetCombatant => !!one && rulesetCombatStanding(one) && !one.away)
      .filter((one) => {
        const was = rulesetPositionOf(one);
        return !was || !teleportHeld(ctx, one, action, was, null, actor.id);
      });
    // Where it lands, by its familiarity (1.670): a mishap hurts every traveller and rolls again.
    rollFamiliarity(ctx, actor, action, along);
    if (!actor.defeated) leaveFight(ctx, actor, action);
    for (const one of along) if (!one.defeated) leaveFight(ctx, one, action, actor.id);
    return;
  }
  const grid = ctx.state.board?.grid;
  const from = rulesetPositionOf(actor);
  if (!grid || !from || !rulesetCombatStanding(actor) || !rulesetRoomAt(ctx.state, grid, actor, to)) return;
  // Kept in a zone that lets nobody out unsaved (1.603), the use spent: nobody goes along.
  if (teleportHeld(ctx, actor, action, from, to)) return;
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
    // Each one carried out of such a zone saves for themselves (1.603).
    if (teleportHeld(ctx, one, action, was, rulesetPositionOf(actor), actor.id)) continue;
    let spot: RulesetCombatCell | null = null;
    const here = rulesetPositionOf(actor)!;
    for (let reach = 1; reach <= Math.max(grid.width, grid.height) && !spot; reach++) {
      for (let y = here.y - reach; y <= here.y + reach && !spot; y++) {
        for (let x = here.x - reach; x <= here.x + reach; x++) {
          if (Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) !== reach) continue;
          if (!rulesetRoomAt(ctx.state, grid, one, { x, y })) continue;
          // Never into ground nobody may teleport into (1.753).
          if (rulesetTeleportIntoBarred(ctx.state, one, { x, y })) continue;
          spot = { x, y };
          break;
        }
      }
    }
    if (spot) set(one, spot, was, actor.id);
  }
}

/**
 * A teleport's familiarity rolled as it leaves the fight (1.670): a d100 against the row picked, a
 * mishap first, then a similar area, then off target, the rest on target. A mishap deals its damage
 * to its user and everybody along, and rolls again, twenty times at most.
 */
function rollFamiliarity(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  along: RulesetCombatant[],
): void {
  const rule = action.teleport;
  const row = rule?.familiar !== undefined ? rule.familiarity?.[rule.familiar] : undefined;
  if (!rule || !row) return;
  const dice = rule.mishap ? parseRulesetCombatDice(rule.mishap.dice) : null;
  for (let times = 0; times < 20; times++) {
    const roll = ctx.roll(100);
    const outcome =
      roll <= row.mishap
        ? "mishap"
        : roll <= row.mishap + (row.similar ?? 0)
          ? "similar"
          : roll <= row.mishap + (row.similar ?? 0) + (row.off ?? 0)
            ? "off-target"
            : "on-target";
    ctx.events.push({ type: "teleportRoll", actorId: actor.id, label: action.label, row: row.label, roll, outcome });
    if (outcome !== "mishap") return;
    for (const one of [actor, ...along]) {
      if (one.defeated || !dice) continue;
      const rolls = rollRulesetDice(ctx.roll, dice.count, dice.sides);
      const dealt = applyDamage(ctx, one, {
        sourceId: actor.id,
        label: action.label,
        damageType: rule.mishap!.type,
        rolls,
        flat: dice.flat,
        amount: sumOf(rolls) + dice.flat,
      });
      afterBlow(ctx, one, dealt, false);
    }
  }
}

/**
 * Whether a zone keeps somebody from teleporting out of it (1.603): one whose `forbids.teleport` is
 * a save, works on them, and holds where they stand but not all of where they would land (off the
 * board, when they leave the fight). They throw its save against its caster's difficulty; failed,
 * they stay where they are, said in the log. 5e's Forcecage.
 */
function teleportHeld(
  ctx: RulesetCombatContext,
  one: RulesetCombatant,
  action: RulesetCombatAction,
  from: RulesetCombatCell,
  to: RulesetCombatCell | null,
  by?: string,
): boolean {
  for (const { caster, zone, action: made } of rulesetStandingZones(ctx.state)) {
    const rule = made.zone?.forbids?.teleport;
    if (typeof rule !== "object" || zone.shrugged?.includes(one.id)) continue;
    const is = zone.insideIs ?? made.zone?.inside?.is;
    if (is && !rulesetTargetIs(ctx.definition, one, is)) continue;
    const hold = rulesetZoneHold(ctx.state, caster, zone, made);
    const inside = (cells: RulesetCombatCell[]) => cells.map((cell) => hold.has(`${cell.x},${cell.y}`));
    if (!inside(rulesetFootprintAt(from, rulesetSpanOf(one))).some(Boolean)) continue;
    if (to && inside(rulesetFootprintAt(to, rulesetSpanOf(one))).every(Boolean)) continue;
    const difficulty = made.save?.difficulty ?? made.saveDifficulty;
    // With no difficulty to throw against, there is no save to make.
    if (difficulty !== undefined && rollSave(ctx, one, rule.save, difficulty, caster.id)) continue;
    ctx.events.push({
      type: "teleported",
      actorId: one.id,
      from: { ...from },
      to: to ? { ...to } : { ...from },
      label: action.label,
      ...(by ? { by } : {}),
      heldIn: zone.label,
    });
    return true;
  }
  return false;
}

/** Gone from the fight alive, of its own accord (1.279): a teleport that leaves it. Nothing brings
 *  it back, and what it held up ends as it would for one sent away. */
function leaveFight(ctx: RulesetCombatContext, one: RulesetCombatant, action: RulesetCombatAction, by?: string): void {
  ctx.events.push({ type: "left", actorId: one.id, label: action.label, ...(by ? { by } : {}) });
  outOfFight(ctx, one, { by: by ?? one.id, label: action.label, left: true });
}

/** Out of the fight alive for good: what it held up ends. */
function outOfFight(
  ctx: RulesetCombatContext,
  one: RulesetCombatant,
  away: NonNullable<RulesetCombatant["away"]>,
): void {
  one.defeated = true;
  one.away = away;
  delete one.routed;
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
  // Gone into whom it landed on, its user leaves instead (1.696): a ghost's Possession. What it put
  // on them stays, holding it away.
  if (rule !== true && rule.possesses) {
    if (actor.defeated || actor.id === target.id) return;
    actor.defeated = true;
    actor.away = { by: target.id, label: action.label, while: rule.while, possessing: target.id };
    ctx.events.push({
      type: "dismissed",
      actorId: actor.id,
      targetId: actor.id,
      label: action.label,
      while: rule.while,
    });
    endSummons(ctx, actor);
    endZones(ctx, actor);
    endConcentration(ctx, actor, "spent");
    return;
  }
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
  // Its allies near it along with it (1.685): a nightmare's riders.
  if (rule !== true && rule.carries && target.id === actor.id) carryAway(ctx, actor, action.label, rule.carries);
}

/** Up to `count` allies within `within` cells of `carrier`, nearest first, out of the fight with it
 *  (1.685), each away while it holds `condition` from the carrier and back when the carrier is. */
function carryAway(
  ctx: RulesetCombatContext,
  carrier: RulesetCombatant,
  label: string,
  carries: { count: number; within: number; condition: string },
): void {
  const from = rulesetPositionOf(carrier);
  const gap = (one: RulesetCombatant) => (from && rulesetPositionOf(one) ? rulesetGap(carrier, one) : 0);
  const riders = ctx.state.combatants
    .filter(
      (one) =>
        one.id !== carrier.id &&
        one.side === carrier.side &&
        !one.defeated &&
        !one.away &&
        rulesetCombatStanding(one) &&
        gap(one) <= carries.within,
    )
    .sort((a, b) => gap(a) - gap(b))
    .slice(0, carries.count);
  for (const rider of riders) {
    applyConditionId(
      ctx,
      rider,
      carries.condition,
      { condition: carries.condition, duration: "until-dispelled" } as RulesetCombatApplies,
      { sourceId: carrier.id },
    );
    if (!rider.tracked.some((entry) => entry.condition === carries.condition && entry.source === carrier.id)) continue;
    rider.defeated = true;
    rider.away = { by: carrier.id, label, while: carries.condition, turns: true, carried: true };
    ctx.events.push({ type: "dismissed", actorId: carrier.id, targetId: rider.id, label, while: carries.condition });
    endSummons(ctx, rider);
    endZones(ctx, rider);
    endConcentration(ctx, rider, "spent");
    endConditionsFromSource(ctx, rider);
  }
}

/** Out of the fight for good, alive, by no use of an entry (1.483): a failed save against what
 *  `sourceId` put on it. What it held up ends. */
function sendAway(ctx: RulesetCombatContext, sourceId: string, target: RulesetCombatant, label: string): void {
  if (target.defeated) return;
  target.defeated = true;
  target.away = { by: sourceId, label };
  ctx.events.push({ type: "dismissed", actorId: sourceId, targetId: target.id, label });
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
  placeNearest(ctx, target);
  ctx.events.push({ type: "returned", targetId: target.id });
  // Those it carried away come back with it (1.685).
  for (const rider of ctx.state.combatants) {
    if (rider.away?.carried && rider.away.by === target.id && rider.away.while)
      removeCondition(ctx, rider, rider.away.while, "linked");
  }
}

/** Whoever has stopped time and is taking the turns it gave (1.507), if anybody: the actor. */
function timeStopper(ctx: RulesetCombatContext): RulesetCombatant | undefined {
  const actor = currentRulesetActor(ctx.state);
  return actor?.tracked.some((one) => one.stoppedTurns !== undefined) ? actor : undefined;
}

/** Whether `one` is held still by somebody else's stopped time (1.507): no answer, no readied use. */
function heldInTime(ctx: RulesetCombatContext, one: RulesetCombatant): boolean {
  const stopper = timeStopper(ctx);
  return !!stopper && stopper.id !== one.id;
}

/** As a turn of `leaving`'s ends (1.507): whether they take another straight after, time stopped.
 *  The turns are rolled as the turn it was put on in ends, and it ends after the last of them. */
function timeStoppedTurn(ctx: RulesetCombatContext, leaving: RulesetCombatant): boolean {
  const entry = rulesetActiveConditions(ctx.definition, ctx.combat, leaving, ctx.state).find((one) => one.stopsTime);
  const tracked = entry && leaving.tracked.find((one) => one.condition === entry.condition);
  if (!entry?.stopsTime || !tracked || leaving.defeated || !rulesetCombatStanding(leaving)) return false;
  const label =
    ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
  if (tracked.stoppedTurns === undefined) {
    const dice = entry.stopsTime.dice ? parseRulesetCombatDice(entry.stopsTime.dice) : null;
    const rolls = dice ? rollRulesetDice(ctx.roll, dice.count, dice.sides) : [];
    const turns = Math.max(0, sumOf(rolls) + (dice?.flat ?? 0) + (entry.stopsTime.flat ?? 0));
    // Its own time is the turns it gives, not rounds that never pass.
    tracked.rounds = null;
    tracked.stoppedTurns = turns;
    ctx.events.push({ type: "timeStop", actorId: leaving.id, label, turns });
  }
  if (tracked.stoppedTurns > 0) {
    tracked.stoppedTurns -= 1;
    return true;
  }
  ctx.events.push({ type: "timeStop", actorId: leaving.id, label, ended: "over" });
  removeCondition(ctx, leaving, entry.condition, "spent");
  return false;
}

/** Stopped time ends once its holder reaches somebody else (1.507): attacks them, harms them, has
 *  them save, or puts a condition on them. Read over what a step did, as it finishes. */
function timeStopReached(ctx: RulesetCombatContext): void {
  const stopper = timeStopper(ctx);
  if (!stopper) return;
  const reached = ctx.events.some((event) => {
    if (event.type === "attack") return event.actorId === stopper.id && event.targetId !== stopper.id;
    if (event.type === "damage") return event.sourceId === stopper.id && event.targetId !== stopper.id;
    if (event.type === "save") return event.sourceId === stopper.id && event.actorId !== stopper.id;
    if (event.type === "condition" && event.active && event.reason === "applied" && event.targetId !== stopper.id)
      return !!rulesetCombatant(ctx.state, event.targetId)?.tracked.some(
        (one) => one.condition === event.condition && one.source === stopper.id,
      );
    return false;
  });
  if (!reached) return;
  const tracked = stopper.tracked.find((one) => one.stoppedTurns !== undefined)!;
  const label =
    ctx.definition.sheet.live.conditions.find((one) => one.id === tracked.condition)?.label ?? tracked.condition;
  ctx.events.push({ type: "timeStop", actorId: stopper.id, label, ended: "affected" });
  removeCondition(ctx, stopper, tracked.condition, "spent");
}

/** Called creatures set aside where a zone that suppresses what called them covers them, and back
 *  where it stood once none does (1.533): Antimagic Field's "summoned creatures disappear". Set
 *  aside, they are out of the fight as one sent away is, and nothing they hold up ends. */
function setAsideCalled(ctx: RulesetCombatContext): void {
  for (const one of ctx.state.combatants) {
    if (one.calledFrom === undefined) continue;
    const by = rulesetSetAsideBy(ctx.state, one);
    if (one.away?.setAside) {
      if (by) continue;
      delete one.away;
      one.defeated = false;
      placeNearest(ctx, one);
      ctx.events.push({ type: "returned", targetId: one.id });
      continue;
    }
    if (!by || one.defeated || one.away) continue;
    one.defeated = true;
    one.away = { by: by.caster.id, label: by.label, setAside: true };
    ctx.events.push({ type: "setAside", targetId: one.id, label: by.label });
  }
}

/** Off the board as its turn ends, on its `blinks` die (1.506): Blink. Nothing it holds up ends. */
function blinkAway(ctx: RulesetCombatContext, holder: RulesetCombatant): void {
  if (holder.defeated || !rulesetCombatStanding(holder)) return;
  const entry = rulesetActiveConditions(ctx.definition, ctx.combat, holder, ctx.state).find((one) => one.blinks);
  const rule = entry?.blinks;
  if (!entry || !rule) return;
  const label =
    ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
  const roll = ctx.roll(rule.sides ?? 20);
  const vanished = roll >= rule.atLeast;
  ctx.events.push({ type: "blink", actorId: holder.id, label, roll, needed: rule.atLeast, vanished });
  if (!vanished) return;
  holder.defeated = true;
  holder.away = { by: holder.id, label, blinked: true };
}

/** Those `caller` called that are on their way (1.614) a turn nearer as its turn starts, and those
 *  whose time has come set down where they were to be, or the nearest free place. */
function arriveCalled(ctx: RulesetCombatContext, caller: RulesetCombatant): void {
  const came: string[] = [];
  for (const one of ctx.state.combatants) {
    const away = one.away;
    if (one.calledBy !== caller.id || away?.arriving === undefined || one.dismissed) continue;
    if (away.arriving > 1) {
      away.arriving -= 1;
      continue;
    }
    delete one.away;
    one.defeated = false;
    placeNearest(ctx, one);
    came.push(one.id);
  }
  if (came.length) ctx.events.push({ type: "arrived", actorId: caller.id, ids: came });
}

/** Back from a blink as its turn starts (1.506): where it vanished, or the nearest free place. */
function blinkBack(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  if (!actor.away?.blinked) return;
  delete actor.away;
  actor.defeated = false;
  placeNearest(ctx, actor);
  ctx.events.push({ type: "returned", targetId: actor.id });
}

/** Where it stands, or the nearest free place its size fits (1.236). */
function placeNearest(ctx: RulesetCombatContext, target: RulesetCombatant): void {
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

/** Ammunition spent as its clause reached a target (1.657): an Arrow of Slaying become a plain arrow.
 *  The share of it that would have come back comes back after the fight as its holder's plain
 *  ammunition of the same tag, where they carry any, and otherwise not at all. */
function spendShot(actor: RulesetCombatant, action: RulesetCombatAction, clause: RulesetCombatDamageClause): void {
  const shot = clause.shot;
  if (!shot?.spends || shot.spent || !action.ammo) return;
  shot.spent = true;
  const back = Math.min(actor.recoverable?.[shot.item] ?? 0, action.ammo.recover ?? 0);
  if (back <= 0) return;
  actor.recoverable![shot.item] = actor.recoverable![shot.item]! - back;
  const tag = action.ammo.tag;
  const plain = (actor.sheet?.items ?? []).findIndex((held) => !held.item.ammoRider && held.item.tags?.includes(tag));
  if (plain >= 0) (actor.recoverableInto ??= {})[plain] = (actor.recoverableInto?.[plain] ?? 0) + back;
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

/** That `attacker` hit `target` with an attack in this turn (1.430): Multiattack Defense. */
function noteHitBy(ctx: RulesetCombatContext, target: RulesetCombatant, attacker: RulesetCombatant): void {
  const at = `${ctx.state.round}:${ctx.state.turn}`;
  if (target.hitBy?.at !== at) target.hitBy = { at, ids: [] };
  if (!target.hitBy.ids.includes(attacker.id)) target.hitBy.ids.push(attacker.id);
}

/** What a change once on each of its holder's own turns (1.429) is counted under: its condition, level
 *  or item, and what it changes. */
function onceKey(entry: RulesetConditionModifier): string {
  return `once:${entry.item ? "item" : entry.level !== undefined ? `level${entry.level}` : "condition"}:${entry.condition}`;
}

/** Whether a change once on each of its holder's own turns (1.429) is still to be had: their own turn,
 *  and not had in it. Nothing is spent. */
function oncePerTurnLeft(
  ctx: RulesetCombatContext,
  holder: RulesetCombatant,
  entry: RulesetConditionModifier,
): boolean {
  if (!rulesetOnOwnTurn(ctx.state, holder)) return false;
  const at = `${ctx.state.round}:${ctx.state.turn}`;
  return holder.oncePerTurn?.at !== at || !holder.oncePerTurn.keys.includes(onceKey(entry));
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
  // Only what its user picked (1.442), where they picked.
  const picked = action.ends?.chosen && !action.endsSpells?.chosen ? ctx.endsChosen : undefined;
  for (const condition of ends.conditions) {
    if (left <= 0) break;
    if (picked && !picked.has(condition)) continue;
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
        if (entry.auraSafeOnEnd) keepOff(target, entry.auraSafeOnEnd);
      }
      target.tracked = target.tracked.filter((entry) => !by(entry));
    } else removeCondition(ctx, target, condition, "cured");
    left--;
  }
}

/**
 * What a catalog's entries put on a creature, ended (1.424): the highest level first, as many as
 * `count` says. One within `upTo` (the level it is paid at, or a number) simply ends; one above it
 * ends on a check against `above.dc` plus its level; with neither, every one does. Held by its
 * caster's concentration, the whole of that spell ends with it.
 */
function endSpellsOn(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  paid: number,
): void {
  const ends = action.endsSpells!;
  const reach = ends.upTo === "paid" ? paid : ends.upTo;
  const found = target.tracked
    .filter((entry) => entry.catalog !== undefined && ends.catalogs.includes(entry.catalog) && !entry.kept)
    // Only what its user picked (1.427), where they picked.
    .filter((entry) => !ends.chosen || !ctx.endsChosen || ctx.endsChosen.has(entry.condition))
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  let left = ends.count ?? found.length;
  const done = new Set<RulesetTrackedCondition>();
  for (const entry of found) {
    if (left <= 0) break;
    if (done.has(entry) || !target.tracked.includes(entry)) continue;
    const level = entry.level ?? 0;
    if (reach !== undefined && level > reach) {
      const label =
        ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
      const said = {
        type: "counter" as const,
        actorId: actor.id,
        targetId: target.id,
        label,
        level,
        reach,
        success: false,
      };
      if (!ends.above || rulesetCombatIsPool(ctx.combat)) {
        ctx.events.push(said);
        continue;
      }
      if (!levelCheck(ctx, actor, action.label, ends.above, level, said)) continue;
    }
    left--;
    const source = entry.source ? rulesetCombatant(ctx.state, entry.source) : undefined;
    if (entry.concentration && source?.concentrating) {
      for (const one of ctx.state.combatants.flatMap((who) => who.tracked))
        if (one.concentration && one.source === source.id) done.add(one);
      endConcentration(ctx, source, "dispelled");
    } else removeCondition(ctx, target, entry.condition, "cured");
    done.add(entry);
  }
}

/** A lasting area an endsSpells is aimed at (1.427), ended on the same terms as a condition: within
 *  reach outright, above it on the check. Dispel Magic on a Wall of Fire. */
function endSpellZone(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  paid: number,
): void {
  const ends = action.endsSpells!;
  const aimed = ctx.dispel!;
  const found = rulesetStandingZones(ctx.state).find(
    ({ caster, zone }) => caster.id === aimed.casterId && zone.actionId === aimed.actionId,
  );
  // A layered wall (1.490) loses its first standing layer only to what that layer names.
  if (found?.action.zone?.layers) {
    wearLayer(ctx, found.caster, found.zone, found.action, action.entry ? { entry: action.entry } : {}, actor.id);
    return;
  }
  if (!found || found.action.catalog === undefined || !ends.catalogs.includes(found.action.catalog)) return;
  const { caster, zone } = found;
  const level = rulesetPaidLevel(ctx.definition, caster, found.action, zone.payWith);
  const reach = ends.upTo === "paid" ? paid : ends.upTo;
  if (reach !== undefined && level > reach) {
    const said = {
      type: "counter" as const,
      actorId: actor.id,
      targetId: caster.id,
      label: zone.label,
      level,
      reach,
      success: false,
    };
    if (!ends.above || rulesetCombatIsPool(ctx.combat)) {
      ctx.events.push(said);
      return;
    }
    if (!levelCheck(ctx, actor, action.label, ends.above, level, said)) return;
  }
  ctx.events.push({ type: "zone", actorId: caster.id, label: zone.label, outcome: "dispelled" });
  if (caster.concentrating?.actionId === zone.actionId) endConcentration(ctx, caster, "dispelled");
  else endZones(ctx, caster, zone.actionId);
}

/** After a weapon attack at one creature on its maker's own turn, the same weapon at another within
 *  reach of them, once a turn (1.428): Horde Breaker. Made as an action of its own, offered as a
 *  follow-up for nothing until the turn ends. */
function offerStrikeAgain(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: readonly RulesetCombatant[],
): void {
  if (actor.flags.struckAgain || targets.length !== 1 || !rulesetOnOwnTurn(ctx.state, actor)) return;
  if (!rulesetIsAttack(action) || action.toHit === undefined || action.area || action.catalog || action.casts) return;
  if (action.itemUse || action.sequence || action.targets.count !== 1) return;
  const rule = rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state).find((one) => one.strikesAgain);
  if (!rule?.strikesAgain) return;
  const id = `${action.id}@again`;
  const label = ctx.definition.sheet.live.conditions.find((one) => one.id === rule.condition)?.label ?? rule.condition;
  const { followUp: _followUp, pairedWith: _paired, ...rest } = action;
  actor.actions = actor.actions.filter((one) => !one.strikeAgain);
  actor.actions.push({
    ...structuredClone(rest),
    id,
    label: `${action.label} (${label})`,
    strikeAgain: {
      targetId: targets[0]!.id,
      within: rulesetInCells(rule.strikesAgain.within, ctx.combat.distance?.perCell ?? 1),
    },
  });
  actor.flags.followUps = [...(actor.flags.followUps ?? []).filter((one) => one.id !== id), { id, paid: true }];
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
  dieNow(ctx, target);
}

/** Killed by massive damage (1.709): dead, never dying. Nobody dies on Held Ground: felled. */
function killedOutright(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  if (ctx.state.heldGround) {
    if (!target.down) dropToZero(ctx, target, true);
    return;
  }
  ctx.events.push({ type: "massiveDeath", actorId: target.id });
  dieNow(ctx, target);
}

/** Down and dead at once, never dying: what slaying does once it is told. */
function dieNow(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  if (!target.down) dropToZero(ctx, target, true);
  if (target.defeated) return;
  target.defeated = true;
  target.dying = false;
  target.stable = false;
  target.diedRound = ctx.state.round;
  // Its sheet says so as three failed saves do, so it stays dead once the fight is over (laptop pass 6
  // 2026-10-26: a hero killed outright by massive damage was healed back to 1 after it).
  const failures = ctx.combat.dying?.failures;
  if (failures && target.sheet) {
    const most = trackMax(ctx, target, failures);
    if (most > 0) writeRulesetSheet(ctx.definition, target, { op: "track", track: failures, to: most });
  }
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

/**
 * The targets an attack goes to once whoever draws aim near them has drawn it (1.658): the Shield of
 * Missile Attraction's curse, "you become the target instead". Not a reaction, so nothing is spent and
 * nobody is asked. The nearest such holder to a target takes its place, never its maker, nor one the
 * attack is already aimed at. Only on a board, which says who is near.
 */
function drawnAim(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
): RulesetCombatant[] {
  if (!rulesetIsAttack(action) || action.area || action.around || targets.length === 0) return targets;
  const perCell = ctx.combat.distance?.perCell;
  if (perCell === undefined || !ctx.state.board) return targets;
  const drawers = ctx.state.combatants.flatMap((one) => {
    if (one.id === actor.id || one.defeated || !rulesetPositionOf(one)) return [];
    const rules = rulesetActiveConditions(ctx.definition, ctx.combat, one, ctx.state).flatMap((source) =>
      source.drawsAim ? [{ rule: source.drawsAim, name: source.condition }] : [],
    );
    return rules.length ? [{ one, rules }] : [];
  });
  if (drawers.length === 0) return targets;
  const aimedAt = new Set(targets.map((one) => one.id));
  return targets.map((target) => {
    if (target.id === actor.id || !rulesetPositionOf(target)) return target;
    const drawing = drawers
      .flatMap(({ one, rules }) => {
        if (one.id === target.id || aimedAt.has(one.id)) return [];
        const found = rules.find(
          ({ rule }) =>
            (!rule.blow || rulesetBlowKind(ctx.state, actor, target, action) === rule.blow) &&
            (!rule.weapon || rulesetWeaponBlow(action)) &&
            rulesetGap(target, one) <= rulesetInCells(rule.within, perCell),
        );
        return found ? [{ one, name: found.name }] : [];
      })
      .sort((a, b) => rulesetGap(target, a.one) - rulesetGap(target, b.one))[0];
    if (!drawing) return target;
    aimedAt.add(drawing.one.id);
    ctx.events.push({
      type: "tookAim",
      actorId: drawing.one.id,
      targetId: target.id,
      sourceId: actor.id,
      label: drawing.name,
    });
    return drawing.one;
  });
}

/**
 * The targets an attack or a harmful entry goes to once every sanctuary among them has been tried
 * (1.423): its maker saves against each it is aimed at, an area aside; a failure sends it to the
 * nearest other creature it could be aimed at that is not already one of its targets and holds no
 * sanctuary, or loses it. One that saves is free of a sanctuary that says so, for the fight.
 */
function sanctuaryTargets(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
): RulesetCombatant[] {
  const attack = rulesetIsAttack(action);
  const cast = action.catalog ?? action.casts;
  const harmful =
    attack ||
    !!action.harmful ||
    !!action.damage ||
    !!action.save ||
    (action.kind === "block" && !!action.applies?.length);
  if (!harmful || action.area || action.around || targets.length === 0) return targets;
  const rules = ctx.combat.conditions ?? [];
  // On the holder as tracked, or held on their sheet (1.426): Tranquility, put on by a rest.
  const sanctuaries = (one: RulesetCombatant) =>
    rulesetCombatConditions(ctx.definition, one).flatMap((condition) => {
      const rule = rules.find((candidate) => candidate.condition === condition)?.sanctuary;
      if (!rule) return [];
      const entry = one.tracked.find((candidate) => candidate.condition === condition);
      return [{ condition, entry, rule }];
    });
  if (!targets.some((one) => one.id !== actor.id && sanctuaries(one).length > 0)) return targets;
  const out: RulesetCombatant[] = [];
  for (const target of targets) {
    if (target.id === actor.id) {
      out.push(target);
      continue;
    }
    let kept = true;
    for (const { condition, entry, rule } of sanctuaries(target)) {
      if (rule.from && !rulesetTargetIs(ctx.definition, actor, rule.from)) continue;
      // Only what it stops (1.425): attacks, and harmful entries cast from its catalogs.
      if (
        rule.against &&
        !(rule.against.attacks && attack) &&
        !(cast !== undefined && rule.against.casts?.includes(cast))
      )
        continue;
      const immune = entry ? entry.immune : target.sanctuarySaved?.[condition];
      if (immune?.includes(actor.id)) continue;
      const difficulty =
        entry?.difficulty ?? (rule.difficulty ? rulesetSheetValue(ctx.definition, target, rule.difficulty) : undefined);
      if (difficulty === undefined) continue;
      if (rollSave(ctx, actor, rule.save, Math.trunc(difficulty), target.id)) {
        if (rule.immuneOnSave) {
          if (entry) (entry.immune ??= []).push(actor.id);
          else (target.sanctuarySaved ??= {})[condition] = [...(target.sanctuarySaved?.[condition] ?? []), actor.id];
        }
        continue;
      }
      kept = false;
      break;
    }
    if (kept) {
      out.push(target);
      continue;
    }
    const taken = new Set([...targets, ...out].map((one) => one.id));
    const legal = rulesetOptionTargets(ctx.definition, ctx.state, actor.id, action)
      .filter((id) => !taken.has(id))
      .map((id) => rulesetCombatant(ctx.state, id)!)
      .filter((one) => !!one && sanctuaries(one).length === 0)
      .sort((a, b) => rulesetCombatantDistance(ctx.state, actor, a) - rulesetCombatantDistance(ctx.state, actor, b));
    const instead = legal[0];
    ctx.events.push({
      type: "sanctuary",
      actorId: actor.id,
      holderId: target.id,
      label: action.label,
      ...(instead ? { to: instead.id } : {}),
    });
    if (instead) out.push(instead);
  }
  return out;
}

/** Whether its only target takes this action in (1.522): an entry of a catalog its condition or worn
 *  item absorbs, at that level or lower, from a foe. An item's charges are spent or gained as it says,
 *  and one that spends them takes in nothing it has too few for. Says so, and takes it in. */
function absorbAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  payWith: string | undefined,
): boolean {
  const catalog = action.catalog;
  if (!catalog || target.side === actor.side || target.id === actor.id) return false;
  const paid = rulesetPaidLevel(ctx.definition, actor, action, payWith);
  const base = action.innate ? action.innate.baseLevel : rulesetPaidLevel(ctx.definition, actor, action);
  const takes = (rule: RulesetAbsorbs) =>
    rule.catalogs.includes(catalog) &&
    (rule.by === "base" ? base : paid) <= rule.maxLevel &&
    // Only a seen caster's (1.570), and only with the budget it costs left (1.570).
    (!rule.seen || rulesetCanSee(ctx.definition, ctx.state, target, actor)) &&
    (!rule.spends || (target.budgets[rule.spends] ?? 0) >= 1);
  const level = (rule: RulesetAbsorbs) => (rule.by === "base" ? base : paid);
  const said = (by: string, rule: RulesetAbsorbs, charges?: { now: number; max: number }) => {
    if (rule.spends) target.budgets[rule.spends] = (target.budgets[rule.spends] ?? 0) - 1;
    ctx.events.push({
      type: "absorbed",
      targetId: target.id,
      sourceId: actor.id,
      label: action.label,
      level: level(rule),
      by,
      ...(charges ? { charges } : {}),
    });
    return true;
  };
  // A condition's first (1.522): a creature's, or one a spell gave.
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state)) {
    if (entry.absorbs && takes(entry.absorbs)) {
      const label =
        ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition;
      return said(label, entry.absorbs);
    }
  }
  // Then a worn item's, with its charges; never one an antimagic zone suppresses (1.521).
  const hush = rulesetSuppressedOn(ctx.state, target);
  const items = target.sheet?.items ?? [];
  for (let index = 0; index < items.length; index++) {
    const held = items[index]!;
    const rule = held.worn ? held.item.worn?.absorbs : undefined;
    if (!rule || !takes(rule) || rulesetItemSuppressed(hush, held.item)) continue;
    const name = held.name ?? held.stack?.ref ?? "";
    // Never past what it may take in over its whole existence (1.571), counted for good.
    const ever = target.absorbedEver?.[index] ?? held.absorbedEver ?? 0;
    if (rule.lifetime !== undefined && ever + level(rule) > rule.lifetime) continue;
    const count = () => {
      if (rule.lifetime !== undefined) (target.absorbedEver ??= {})[index] = ever + level(rule);
    };
    if (!rule.charges) {
      count();
      return said(name, rule);
    }
    const most = held.item.charges?.max;
    const read = typeof most === "number" ? most : most ? held.item.stats?.[most.stat] : undefined;
    const max = typeof read === "number" && Number.isFinite(read) ? Math.max(0, Math.trunc(read)) : 0;
    if (max < 1) continue;
    const left = rulesetItemChargesLeft(target, { max, item: index });
    const now = rule.charges === "spends" ? left - level(rule) : Math.min(max, left + level(rule));
    if (now < 0) continue;
    (target.charges ??= {})[index] = now;
    count();
    return said(name, rule, { now, max });
  }
  return false;
}

/** Whether its only target turns a foe's entry back at its user (1.523): a condition's `turns`, or a
 *  worn item's no antimagic zone suppresses, of the entry's catalog and at its level or lower, and
 *  the save they just threw showing its top face. Said as it turns. */
function turnsAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  payWith: string | undefined,
): boolean {
  const catalog = action.catalog;
  if (!catalog || target.side === actor.side || target.id === actor.id || rulesetCombatIsPool(ctx.combat)) {
    return false;
  }
  const dice = ctx.combat.attackRoll?.dice;
  const thrown = [...ctx.events]
    .reverse()
    .find(
      (one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save" && one.actorId === target.id,
    );
  if (!dice || dice.count !== 1 || !thrown || thrown.automatic || thrown.kept !== dice.sides) return false;
  const paid = rulesetPaidLevel(ctx.definition, actor, action, payWith);
  const base = action.innate ? action.innate.baseLevel : rulesetPaidLevel(ctx.definition, actor, action);
  const takes = (rule: RulesetTurns) =>
    rule.catalogs.includes(catalog) && (rule.by === "base" ? base : paid) <= rule.maxLevel;
  const said = (by: string) => {
    ctx.events.push({ type: "turnedBack", targetId: target.id, sourceId: actor.id, label: action.label, by });
    return true;
  };
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state)) {
    if (entry.turns && takes(entry.turns)) {
      return said(
        ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition,
      );
    }
  }
  const hush = rulesetSuppressedOn(ctx.state, target);
  for (const held of target.sheet?.items ?? []) {
    const rule = held.worn ? held.item.worn?.turns : undefined;
    if (rule && takes(rule) && !rulesetItemSuppressed(hush, held.item)) return said(held.name ?? held.stack?.ref ?? "");
  }
  return false;
}

/** Whether a foe's entry aimed at `target` is taken by a carapace of theirs (1.723): one of the entries
 *  it names, of an area shape it names, or a ranged attack roll, of a catalog it takes from. Its die
 *  rolled and said: `back` when it is turned at its maker, `untouched` otherwise. A tarrasque's
 *  Reflective Carapace. */
function reflectsAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
): "back" | "untouched" | null {
  const catalog = action.catalog ?? action.casts;
  if (!catalog || target.side === actor.side || target.id === actor.id) return null;
  for (const entry of rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state)) {
    const rule = entry.reflects;
    if (!rule || !rule.against.catalogs.includes(catalog)) continue;
    const named = !!action.entry && !!rule.against.entries?.includes(action.entry);
    const shaped = !!action.area && !!rule.against.area?.includes(action.area.shape);
    const shot =
      rule.against.attackRoll === "ranged" &&
      action.toHit !== undefined &&
      !action.autoHit &&
      rulesetBlowKind(ctx.state, actor, target, action) === "ranged";
    if (!named && !shaped && !shot) continue;
    const roll = ctx.roll(rule.sides);
    const back = roll >= rule.backFrom;
    ctx.events.push({
      type: "reflected",
      targetId: target.id,
      sourceId: actor.id,
      label: action.label,
      by: ctx.definition.sheet.live.conditions.find((one) => one.id === entry.condition)?.label ?? entry.condition,
      roll,
      back,
    });
    return back ? "back" : "untouched";
  }
  return null;
}

/** The action as it is resolved, its maker and it known to whatever it sets off (1.545). */
function resolveActionBody(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  payWith?: string,
  held?: RulesetHeldAttack,
  styleId?: string,
  spend?: number,
): RulesetHitHold | null {
  const before = ctx.acting;
  const from = ctx.events.length;
  ctx.acting = { actorId: actor.id, action };
  let result: RulesetHitHold | null;
  try {
    result = resolveActionBodyIn(ctx, actor, action, targets, payWith, held, styleId, spend);
  } finally {
    if (before) ctx.acting = before;
    else delete ctx.acting;
  }
  if (!result) chargeThen(ctx, actor, action, from);
  // Named on the saves it forced and the healing it gave, so a log names the spell that did it even
  // where no attack roll did (Sacred Flame, Cure Wounds). An action inside it named its own first.
  for (let index = from; index < ctx.events.length; index++) {
    const event = ctx.events[index]!;
    if ((event.type === "save" || event.type === "heal") && event.sourceId === actor.id && !event.label && action.label)
      ctx.events[index] = { ...event, label: action.label };
  }
  return result;
}

/** What a charge lets follow at the one it struck (1.546), once the blow is done: a lion's bite at a
 *  target its Pounce knocked prone, paid from its bonus action. */
function chargeThen(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  from: number,
): void {
  const then = action.charge?.then;
  if (!then || !rulesetOnOwnTurn(ctx.state, actor)) return;
  const charged = ctx.events
    .slice(from)
    .find(
      (event): event is Extract<RulesetCombatEvent, { type: "charged" }> =>
        event.type === "charged" && event.actorId === actor.id,
    );
  const target = charged ? rulesetCombatant(ctx.state, charged.targetId) : undefined;
  if (!target || target.defeated || !actor.actions.some((one) => one.id === then.action)) return;
  const held = rulesetCombatConditions(ctx.definition, target);
  if (then.targetHolds && !then.targetHolds.every((one) => held.includes(one))) return;
  actor.flags.followUps = [
    ...(actor.flags.followUps ?? []).filter((one) => one.id !== then.action),
    // The charging action again (1.574) carries no charge the second time.
    {
      id: then.action,
      budget: then.budget,
      targetId: target.id,
      ...(then.action === action.id ? { uncharged: true as const } : {}),
    },
  ];
}

function resolveActionBodyIn(
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
  // The ammunition it was shot with (1.657): an Arrow of Slaying's clauses on the blow it rides.
  const rider =
    action.ammo && !action.clip && actor.lastShot !== undefined
      ? action.ammo.riders?.[String(actor.lastShot)]
      : undefined;
  if (rider && action.damage) {
    const shot = { item: actor.lastShot!, ...(rider.spends ? { spends: true as const } : {}) };
    action = {
      ...action,
      damage: {
        ...action.damage,
        plus: [...(action.damage.plus ?? []), ...rider.plus.map((clause) => ({ ...clause, shot }))],
      },
    };
  }
  // And what it adds to the attack roll (1.812): an Arrow +1's +1.
  if (rider?.toHit && action.toHit !== undefined) action = { ...action, toHit: action.toHit + rider.toHit };
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
  // Cast, a summons that strikes by itself only appears (1.539): its strikes come as turns start.
  if (action.summons?.strikesAtTurnStart && !ctx.summonStriking && !held) return null;
  // What it does, rolled for (1.559): a Wand of Wonder's row, at whom it was aimed, centred there
  // with an area, or on its user. A row that does nothing a fight can use is only told.
  // Or by how many times it has been used (1.687): an androsphinx's Roar, louder each time. Its uses
  // are spent as it is made, so the count already holds this one.
  if ((action.rollsAmong || action.byUse) && !held) {
    let part: RulesetCombatAction | undefined;
    if (action.byUse) {
      const used = action.uses ? action.uses.count - rulesetActionUses(actor, action, ctx.state) : 1;
      const step = Math.min(action.byUse.length - 1, Math.max(0, used - 1));
      part = actor.actions.find((one) => one.id === action.byUse![step]);
    } else {
      const row = rollWeighted(ctx, actor, action.label, action.rollsAmong!);
      part = row?.id ? actor.actions.find((one) => one.id === row.id) : undefined;
    }
    if (!part || actor.defeated) return null;
    const aimedOne = targets.find((one) => one.id !== actor.id && !one.defeated) ?? targets[0];
    const at = (aimedOne && rulesetPositionOf(aimedOne)) || ctx.aimedAt;
    const aimed = ctx.aimedAt;
    const aimedAlso = ctx.aimedAlso;
    delete ctx.aimedAlso;
    if (at) ctx.aimedAt = { x: at.x, y: at.y };
    // A burst around its user catches whom it reaches and never its user, as the part on its own
    // would: the Roar's.
    const caught = part.around
      ? rulesetAroundTargets(ctx.state, actor, part).filter(
          (one) => !rulesetSealedApart(ctx.definition, ctx.state, actor, one),
        )
      : part.targets.side === "self"
        ? [actor]
        : part.area && at && ctx.state.board?.grid
          ? rulesetAreaTargets(ctx.state, actor.id, part.id, at).flatMap((id) => rulesetCombatant(ctx.state, id) ?? [])
          : targets;
    try {
      resolveAction(ctx, actor, part, caught, payWith);
    } finally {
      if (aimed) ctx.aimedAt = aimed;
      else delete ctx.aimedAt;
      if (aimedAlso) ctx.aimedAlso = aimedAlso;
    }
    return null;
  }
  // Other uses' effects beside it (1.535), each on whom its burst around its user catches, spending
  // nothing of theirs: Thunder and Lightning's Thunderclap.
  if (action.alongside && !held) {
    for (const id of action.alongside) {
      const part = actor.actions.find((one) => one.id === id);
      if (!part || actor.defeated) continue;
      const caught = rulesetAroundTargets(ctx.state, actor, part).filter(
        (one) => !rulesetSealedApart(ctx.definition, ctx.state, actor, one),
      );
      ctx.events.push({ type: "alongside", actorId: actor.id, label: part.label, to: action.label });
      resolveAction(ctx, actor, part, caught, payWith);
    }
  }
  // What a creature deals with both hands, or bloodied, is read as the blow is made (1.102).
  if (action.damage?.alternatives) {
    action = { ...action, damage: rulesetDamageInEffect(ctx.definition, ctx.combat, actor, action.damage) };
  }
  // As the conditions its maker holds make it now (1.501): Magic Weapon, Shillelagh.
  action = rulesetWeaponNow(ctx.definition, ctx.state, actor, action);
  // Kept off a sanctuary's holder by a failed save (1.423), before anything is rolled at them. A held
  // blow picking up was let through already.
  if (!held) targets = sanctuaryTargets(ctx, actor, action, targets);
  // Drawn to whoever near them draws it (1.658), forced, before anything is rolled at them.
  if (!held) targets = drawnAim(ctx, actor, action, targets);
  // Aimed at a lasting area rather than a creature (1.427): Dispel Magic on a wall.
  if (action.endsSpells && ctx.dispel && !held) {
    endSpellZone(ctx, actor, action, rulesetPaidLevel(ctx.definition, actor, action, payWith));
  } else if (action.endsLayers && ctx.dispel && !held) {
    // At a layered wall one of whose layers names it (1.491): Passwall.
    const aimed = ctx.dispel;
    const found = rulesetStandingZones(ctx.state).find(
      ({ caster, zone }) => caster.id === aimed.casterId && zone.actionId === aimed.actionId,
    );
    const as = action.endsLayers.as ?? action.entry;
    if (found?.action.zone?.layers && as) {
      wearLayer(ctx, found.caster, found.zone, found.action, { entry: as }, actor.id);
    }
  }
  // Its user's weapon at each creature its area catches (1.428), a roll and a shot for each:
  // Whirlwind Attack, Volley. Its own side only when it says "any".
  if (action.strikesWith && !action.reaction && !held) {
    const weapon = rulesetBestWeapon(actor, action.strikesWith);
    for (const target of targets) {
      if (!weapon || target.id === actor.id || target.defeated) continue;
      if (target.side === actor.side && action.targets.side !== "any") continue;
      if (!rulesetShotsAvailable(actor, weapon)) break;
      ctx.events.push({ type: "added", actorId: actor.id, targetId: target.id, label: action.label, to: weapon.label });
      spendAvailability(ctx, actor, weapon);
      resolveAction(ctx, actor, weapon, [target]);
    }
    return null;
  }
  // What it put on them kept up (1.431), its rounds started again as if put on now, and nothing else:
  // Intimidating Presence on a later turn.
  if (action.sustain && !held) {
    // An area's (1.727): everybody still holding what it put on, the area not read again. A harpy's
    // Luring Song.
    const sustained = actor.actions.find((one) => one.id === action.sustain!.of);
    const keeping = sustained?.area || sustained?.around ? ctx.state.combatants : targets;
    for (const target of keeping) {
      for (const entry of target.tracked) {
        if (entry.source !== actor.id || entry.action?.[0] !== action.sustain.of) continue;
        const rounds = action.sustain.rounds[entry.condition];
        if (rounds === undefined) continue;
        // On its putter's clock, kept up in their own turn, the end of this one does not count.
        const startsNext =
          entry.clockOf === "source" && !entry.clock && rulesetOnOwnTurn(ctx.state, actor) && ctx.ticking !== actor.id;
        entry.rounds = startsNext ? rounds + 1 : rounds;
        ctx.events.push({
          type: "sustained",
          actorId: actor.id,
          targetId: target.id,
          condition: entry.condition,
          label: action.label,
        });
      }
    }
    return null;
  }
  // A blow after a straight run at its one target carries the charge (1.186), read again as a held
  // blow picks up, since the run is still the one this turn walked.
  const charging = action.charge && (held ? rulesetCombatant(ctx.state, held.targetId) : targets[0]);
  if (action.charge && charging && !ctx.uncharged && rulesetChargeRun(actor, charging) >= action.charge.atLeast) {
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
    // Whoever the concentration it let go of sent away is caught by nothing now (class re-test
    // 2026-10-24: an Entangle that made a horse sent away by casting it save).
    targets = targets.filter((target) => !target.dismissed);
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
    // And in what mode (1.692): the one picked, else the first, as it is made with none picked.
    const kept = action.inMode ?? action.modes?.[0]?.id;
    if (kept !== undefined) actor.concentrating.mode = kept;
    else delete actor.concentrating.mode;
  }
  // Moved on from those who are down (1.604): what the cast put on them goes, and the new target is
  // the one it waits on next. Hunter's Mark.
  if (!held && action.again?.afterTargetDown && actor.concentrating && rulesetRepeatsHeld(actor, action.again)) {
    const moving = new Set((action.applies ?? []).map((one) => one.condition));
    for (const id of actor.concentrating.targets ?? []) {
      const one = rulesetCombatant(ctx.state, id);
      if (!one) continue;
      for (const entry of [...one.tracked]) {
        if (entry.source === actor.id && moving.has(entry.condition))
          removeCondition(ctx, one, entry.condition, "moved");
      }
    }
    actor.concentrating.targets = targets.map((one) => one.id);
  }
  // What it puts on its own user as it is made (1.307), whatever its targets do: Sunbeam's mote,
  // held by the same concentration and given the level it was cast at.
  if (!held) applySelf(ctx, actor, action, payWith, steps);
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
  // At its most (1.415): Overchannel, every die at its top face.
  const maximized = !!action.altered?.maximizes;
  // One shared roll for everybody it does not roll to hit, as any other.
  let maxedShared: Rolled | null = null;
  const rollDamage =
    maximized && action.damage
      ? () => (perTarget ? maxAmount(action.damage!, extra) : (maxedShared ??= maxAmount(action.damage!, extra)))
      : empowered > 0 && action.damage
        ? () => hitFor(true).sets[0]!
        : once(action.damage, action.damage?.reroll);
  // Added to the first damage roll of the use (1.414): every target of a roll they share, the first
  // of one rolled for each. Empowered Evocation.
  let onceLeft = action.damageOnce ?? 0;
  const whole =
    rollDamage && onceLeft !== 0
      ? () => {
          const rolled = rollDamage();
          if (onceLeft !== 0) {
            rolled.flat += onceLeft;
            rolled.total += onceLeft;
            onceLeft = 0;
          }
          return rolled;
        }
      : rollDamage;
  // Times so many, and split evenly among everybody it catches (1.593): the Wand of Wonder's gems.
  let split: Rolled | null = null;
  const damage =
    whole && (action.damageTimes !== undefined || action.damageDivided)
      ? () => {
          if (split) return split;
          const rolled = whole();
          const among = action.damageDivided ? Math.max(1, targets.length) : 1;
          const total = Math.floor((rolled.total * (action.damageTimes ?? 1)) / among);
          const share = { rolls: [...rolled.rolls], flat: total - sumOf(rolled.rolls), total };
          if (!perTarget) split = share;
          return share;
        }
      : whole;
  // Careful (1.253): up to so many of its user and their allies it catches make its save outright,
  // the ones its user picked (1.254), else in the order it caught them. Heightened: its first target
  // rolls its first save at disadvantage.
  const picked = action.altered?.spared;
  // As many more as the level it is paid at (1.414): Sculpt Spells' 1 + the spell's level.
  const sparing =
    (action.altered?.spares ?? 0) +
    (action.altered?.sparesByLevel ? rulesetPaidLevel(ctx.definition, actor, action, payWith) : 0);
  const careful = new Set(
    action.altered?.spares
      ? targets
          .filter((target) => target.side === actor.side && (!picked || picked.includes(target.id)))
          .slice(0, sparing)
          .map((target) => target.id)
      : [],
  );
  // Picked (1.255), it is theirs whether or not they come first; one it does not catch has nothing.
  const heightened = action.altered?.heightens ? (action.altered.heightened ?? targets[0]?.id) : undefined;
  // One roller per clause, read the same way: an ability that lands on several targets without
  // rolling to hit rolls every clause once and everybody takes those numbers.
  const clauses = (action.damage?.plus ?? []).map((clause, index) =>
    maximized ? () => maxAmount(clause, extra) : empowered > 0 ? () => hitFor(false).sets[index + 1]! : once(clause)!,
  );
  // As many times over as the uses its user chose (1.251): Lay on Hands.
  const times = action.usesChosen ? (ctx.chosenAmount ?? 1) : 1;
  const healing =
    action.heal && times > 1
      ? { ...action.heal, count: action.heal.count * times, flat: action.heal.flat * times }
      : action.heal;
  // At its most (1.415): Supreme Healing.
  const heal = action.healsMax && healing ? () => maxAmount(healing, extra) : once(healing);
  // More to each it heals, and its user's own once when it heals somebody else (1.421), by the
  // level it is paid at: Disciple of Life, Blessed Healer.
  const paidLevel = action.healAdd || action.healsSelf ? rulesetPaidLevel(ctx.definition, actor, action, payWith) : 0;
  const healMore = (adds: RulesetCombatHealAdd[] | undefined) =>
    (adds ?? []).reduce(
      (total, add) => (paidLevel < add.fromLevel ? total : total + add.flat + add.perLevel * paidLevel),
      0,
    );
  const healAdded = healMore(action.healAdd);
  let healsSelf = action.healsSelf ? healMore(action.healsSelf) : 0;
  // One amount shared out among them (1.563): Preserve Life.
  let shareLeft = action.sharesHeal && heal ? heal().total + healAdded : 0;
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
    rulesetTargetTypesAllow(ctx.definition, target, action.targetTypes, actor);
  const spared = sparedByHealth(ctx, actor, action, targets.filter(reaches), extra);
  // Taken in by its only target (1.522), a foe's: a Rod of Absorption, an Ioun Stone of Absorption.
  const only = targets.length === 1 && !action.area ? targets[0]! : undefined;
  const absorbed = only && reaches(only) && absorbAction(ctx, actor, action, only, payWith) ? only.id : undefined;
  // Each of one that may be pointed at the same one again (1.305) that finds its target already
  // dropped by one before it goes at the next of its targets still up, or nowhere (laptop playtest
  // 2026-10-25: Magic Missile darts landing on a downed foe, and one that had surrendered).
  const struck = new Set<string>();
  for (const listed of targets) {
    let target = listed;
    if (action.targets.repeat && struck.has(target.id) && (!rulesetCombatStanding(target) || target.away)) {
      const next = targets.find(
        (one) => one.id !== listed.id && rulesetCombatStanding(one) && !one.away && reaches(one),
      );
      if (!next) continue;
      target = next;
    }
    struck.add(target.id);
    if (!reaches(target) || spared.has(target.id) || target.id === absorbed) continue;
    // An image (1.568): it passes through, and its maker's side sees it for what it is.
    if (target.illusion && target.id !== actor.id && target.calledBy !== actor.id) {
      if (!target.illusion.seenBy.includes(actor.side)) target.illusion.seenBy.push(actor.side);
      ctx.events.push({ type: "seenThrough", actorId: actor.id, targetId: target.id, label: action.label });
      continue;
    }
    // Taken by a carapace (1.723): untouched on its die, and on its top faces turned at its maker.
    if (!ctx.turning && held?.targetId !== target.id) {
      const reflected = reflectsAction(ctx, actor, action, target);
      if (reflected === "back") {
        ctx.turning = true;
        try {
          resolveActionBody(ctx, actor, action, [actor], payWith);
        } finally {
          delete ctx.turning;
        }
      }
      if (reflected) continue;
    }
    // Each target an attack rolls for is a hit of its own, its dice not yet rolled.
    hitNow = null;
    // Killed outright (1.196): nothing else it does matters to the dead.
    if (action.kills) {
      // Unless warded against it (1.596): Death Ward.
      if (!wardedOutright(ctx, target)) slay(ctx, target, actor.id, action.label);
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
      // A hit that was rolled for (1.503): what the attacker's conditions put on whoever it hit, and
      // what lasted until their next weapon hit.
      if (landed) {
        const smites = rulesetWeaponBlow(action) ? oneUseConditions(actor, "own-hit") : [];
        ownHit(ctx, actor, target, action);
        spendOneUse(ctx, actor, smites);
      }
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
        theirs: attackedConditions(target, actor),
      };
      landed = outcome !== "miss";
      if (landed) noteHitBy(ctx, target, actor);
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
      const why: RulesetAttackModeWhy = { up: [], down: [] };
      mode = rulesetAttackMode(
        ctx.definition,
        ctx.combat,
        actor,
        target,
        { state: ctx.state, optionId: action.id, action, ...(ctx.opportunity ? { opportunity: true } : {}) },
        why,
      );
      // What pushed the roll each way, for the log to say why it was rolled twice.
      const modeWhy =
        why.up.length || why.down.length
          ? { ...(why.up.length ? { up: why.up } : {}), ...(why.down.length ? { down: why.down } : {}) }
          : undefined;
      // What the weapon adds against what the target is (1.187).
      const toHit = action.toHit + rulesetToHitAgainst(ctx.definition, action, target, actor);
      // What the ground the target stands on is worth, said out loud before the roll it changed.
      let guarded = rulesetDefenseAgainst(ctx.definition, ctx.combat, ctx.state, target, actor, action);
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
          ).filter(({ modifier }) =>
            rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action, ctx.definition),
          ),
          actor,
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
          ...(modeWhy ? { why: modeWhy } : {}),
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
        spendHelp(actor, target);
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: attackedConditions(target, actor) };
        landed = outcome === "hit";
        if (landed) noteHitBy(ctx, target, actor);
        if (landed) answerHit(ctx, target, actor, action);
        if (landed) extraDice = thrown.successes - needed;
        if (
          landed &&
          (!ctx.state.window || ctx.nestHit) &&
          !ctx.summonStriking &&
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
        // Turned onto a duplicate (1.505): rolled against its defense, and whatever it hits is only it.
        const duplicate = divertedToDuplicate(ctx, actor, target);
        if (duplicate) guarded = { ...guarded, defense: duplicate.defense };
        const first = throwOwnDice(ctx, actor, "attacks", dice.count, dice.sides);
        const second = mode === "normal" ? null : throwOwnDice(ctx, actor, "attacks", dice.count, dice.sides);
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
          ).filter(({ modifier }) =>
            rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action, ctx.definition),
          ),
          actor,
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
              ).filter(({ modifier }) =>
                rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action, ctx.definition),
              ),
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
        // A change on the attacker that makes its hit a critical where it reaches (1.544): Assassinate.
        if (
          outcome === "hit" &&
          rulesetActiveConditions(ctx.definition, ctx.combat, actor, ctx.state).some((entry) =>
            entry.modifiers?.some(
              (modifier) =>
                modifier.to === "attacks" &&
                modifier.critical &&
                rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action, ctx.definition),
            ),
          )
        ) {
          outcome = "critical";
        }
        // Missed, what its maker spends to hit all the same (1.249): Stroke of Luck.
        if (outcome === "miss" && rescueEntry(ctx, actor, "attacks", "success")) outcome = "hit";
        // No critical lands on its holder (1.510): Adamantine Armor.
        if (
          outcome === "critical" &&
          rulesetCombatEffects(ctx.definition, ctx.combat, target, ctx.state).has("criticals-against-normal")
        )
          outcome = "hit";
        ctx.events.push({
          type: "attack",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          mode,
          ...(modeWhy ? { why: modeWhy } : {}),
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
        spendHelp(actor, target);
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: attackedConditions(target, actor) };
        if (duplicate && outcome !== "miss") {
          loseDuplicate(ctx, actor, target, duplicate.condition, duplicate);
          outcome = "miss";
        }
        landed = outcome !== "miss";
        if (landed) noteHitBy(ctx, target, actor);
        if (landed) answerHit(ctx, target, actor, action);
        critical = outcome === "critical";
        // A hit on somebody who holds an answer for being hit stops here, before its damage: the
        // window asks them, and the attack picks up from this roll once they have answered. Nothing
        // opened inside a window opens another, so an attack made inside one is never held, nor a
        // summons' own strike as a turn starts (1.539).
        if (
          landed &&
          (!ctx.state.window || ctx.nestHit) &&
          !ctx.summonStriking &&
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
    // Attacked, hit or missed (1.422), for the moment asked once the use is over.
    if ((held && target.id === held.targetId) || (action.toHit !== undefined && !action.autoHit)) {
      const record = (ctx.attacked ??= { targetIds: [], missedIds: [], blows: {} });
      if (!record.targetIds.includes(target.id)) record.targetIds.push(target.id);
      if (!landed && !record.missedIds.includes(target.id)) record.missedIds.push(target.id);
      record.blows[target.id] = rulesetBlowKind(ctx.state, actor, target, action);
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

    // Won over by a contest of checks instead of a roll or a save (1.565): Telekinesis. Nothing
    // else it does lands on a target it loses to.
    if (action.contested && !action.contested.riders && !wonContest(ctx, actor, action, target)) {
      // What it leaves on a target it lost to (1.618): a swarm the Pipes of the Sewers can't sway
      // for 24 hours.
      for (const one of action.contested.onLose?.applies ?? []) {
        if (target.defeated) break;
        applyConditionId(
          ctx,
          target,
          one.condition,
          { condition: one.condition, duration: { rounds: one.rounds } },
          { sourceId: actor.id },
        );
      }
      spendUsed();
      continue;
    }
    // Won, what it takes from them (1.668): the first such thing they hold, set at its user's feet.
    const takesAway = action.contested?.takes;
    if (takesAway && !target.defeated) {
      const userAt = rulesetPositionOf(actor);
      const taken = rulesetThingsToDrop(target, takesAway)
        .slice(0, 1)
        .map((thing) => ({ ...thing, ...(userAt ? { at: { x: userAt.x, y: userAt.y } } : {}) }));
      if (taken.length) {
        target.dropped = [...(target.dropped ?? []), ...taken];
        ctx.events.push({
          type: "takenAway",
          actorId: actor.id,
          targetId: target.id,
          label: action.label,
          labels: taken.map((thing) => thing.label),
        });
      }
    }

    const against: RulesetSaveAgainst = {
      conditions: [...(action.applies?.map((one) => one.condition) ?? []), ...(action.save?.against?.conditions ?? [])],
      damage: [
        action.damage?.type,
        ...(action.damage?.plus ?? []).map((one) => one.type),
        ...(action.save?.against?.damage ?? []),
      ].filter((type): type is string => type !== undefined),
      magic: magicalAction(action),
      // What its save says it is (1.652): a gas.
      ...(action.save?.against?.qualities ? { qualities: action.save.against.qualities } : {}),
      action: [action.id, action.label, ...(action.recharge?.group ? [action.recharge.group] : [])],
      ...((action.casts ?? action.catalog) ? { catalog: action.casts ?? action.catalog } : {}),
      // Aimed at them alone (1.523).
      ...(target === only ? { alone: true } : {}),
      // What its entry declares (1.787): a necromancy spell, for a Scarab of Protection.
      ...(action.filters ? { filters: action.filters } : {}),
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
      noteSaved(ctx.state, actor, action, target);
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
      // One save against every ray striking them (1.468).
      saved =
        ctx.raySaves?.get(target.id) ??
        rollSave(
          ctx,
          target,
          // The target's choice of two (1.724): the better of them.
          action.save.or && (target.saves[action.save.or] ?? 0) > (target.saves[action.save.save] ?? 0)
            ? action.save.or
            : action.save.save,
          action.save.difficulty,
          actor.id,
          action.save.ignoresCover ? null : saveFromFor(target),
          against,
          (() => {
            let lean = saveLean(ctx, target, action.save.modes);
            // Being fought by its user's side, with advantage (1.582): Charm Person.
            if (action.save.advantageIfFought && target.side !== actor.side) lean = leanWith(lean, "advantage");
            return target.id === heightened ? leanWith(lean, "disadvantage") : lean;
          })(),
        );
      ctx.raySaves?.set(target.id, saved);
      // Turned back at its user on the save's top face (1.523): a Ring of Spell Turning.
      if (target === only && !ctx.turning && turnsAction(ctx, actor, action, target, payWith)) {
        spendUsed();
        ctx.turning = true;
        try {
          resolveActionBody(ctx, actor, action, [actor], payWith);
        } finally {
          delete ctx.turning;
        }
        continue;
      }
      if (saved) noteSaved(ctx.state, actor, action, target);
      // Pushed out of the area for saving (1.631): a Bead of Force.
      if (saved && action.pushesOutSaved) pushOutOfArea(ctx, actor, action, target);
      if (saved && action.save.onSuccess === "negates") {
        spendUsed();
        continue;
      }
      // Failed, it dies (1.311), and its slayer gains what it says: Consume Life.
      // Only one this low as it fails (1.678): a solar's Slaying Longbow, 190 or fewer.
      const slays =
        action.slaysOnFailedSave &&
        (action.slaysHealthAtMost === undefined || healthOf(ctx, target).value <= action.slaysHealthAtMost);
      if (!saved && slays) {
        if (!wardedOutright(ctx, target)) slay(ctx, target, actor.id, action.label);
        if (action.healsOnSlay && target.defeated) {
          const thrown = rollHealing(ctx, actor, action.healsOnSlay);
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
    // What goes on after the blow, won by a contest (1.695): lost, it is as a save made that does
    // nothing to the damage. A merrow's Harpoon.
    // Only on a target that is what it names (1.698): no contest with one too big for the Harpoon,
    // and nothing put on, pushed, pulled or sent away; its damage lands all the same.
    const riderless = !!action.ridersIs && !rulesetTargetIs(ctx.definition, target, action.ridersIs);
    if (action.contested?.riders && !saved && !riderless && !wonContest(ctx, actor, action, target)) saved = true;
    // A save its holder evades with (1.250): nothing on a success, half on a failure.
    const evades =
      action.save?.onSuccess === "half" &&
      rulesetActiveConditions(ctx.definition, ctx.combat, target, ctx.state).some((entry) =>
        entry.evasion?.includes(action.save!.save),
      );
    // Spared whole (1.414): Sculpt Spells' allies take nothing where a success leaves half.
    const sculpted = careful.has(target.id) && !!action.altered?.sparesWhole && action.save?.onSuccess === "half";
    if ((evades || sculpted) && saved) {
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
    const takenModifiers = rulesetDamageModifiers(ctx.definition, ctx.state, actor, action, target, true);
    const modifiers = [
      ...rulesetDamageModifiers(ctx.definition, ctx.state, actor, action, target),
      // A change held back for the attack roll that it hit without, on its damage instead (1.429):
      // Foe Slayer.
      ...(action.toHit !== undefined && !action.autoHit && !action.save
        ? rulesetConditionModifiers(
            ctx.definition,
            ctx.combat,
            actor,
            "attacks",
            ctx.state,
            undefined,
            undefined,
            action.ability,
            true,
          )
            .filter(
              ({ modifier }) =>
                modifier.orDamage &&
                rulesetAttackModifierReaches(modifier, ctx.state, actor, target, action, ctx.definition),
            )
            .map((entry) => ({ ...entry, modifier: { ...entry.modifier, to: "damage" as const } }))
        : []),
      ...takenModifiers,
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
    // What its maker added to the blow drains back (1.534): Drain Life's half.
    let addDrained = 0;
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
      if (part.drainsBack) addDrained += partDealt * part.drainsBack;
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
    // Whether it was hurt as the blow came (1.393), before any of the blow lands: Colossus Slayer.
    const hurtBefore = rulesetCombatHurt(ctx.definition, ctx.combat, target);
    // Whether they were down already (1.677), so a blow that drops them is told from one that lands
    // on somebody lying there.
    const downBefore = !!target.down;
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
        spendShot(actor, action, clause);
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
      // At its most against what it names (1.185): Blight on a plant. Another amount instead against
      // what it names (1.629): a Horn of Blasting's 10d6 to glass.
      const rolled =
        action.maxAgainst && rulesetTargetIs(ctx.definition, target, action.maxAgainst)
          ? maxAmount(
              action.amountAgainst && rulesetTargetIs(ctx.definition, target, action.amountAgainst.is)
                ? action.amountAgainst.amount
                : action.damage,
              extra,
            )
          : action.amountAgainst && rulesetTargetIs(ctx.definition, target, action.amountAgainst.is)
            ? rollAmount(ctx, action.amountAgainst.amount, extra, action.damage.reroll)
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
        spendShot(actor, action, clause);
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
    const rider = action.damage && !spends ? firingRider(ctx, actor, action, target, mode, hurtBefore) : null;
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
      // Only its conditions (1.534), or kept off by a made save of its own: Drain Life's.
      if (!add.damage) continue;
      if (add.save && rollSave(ctx, target, add.save.save, add.save.difficulty, actor.id, undefined, against)) continue;
      const addDamage = add.damage;
      const amounts = [
        { amount: addDamage as RulesetCombatAmount, type: addDamage.type, extra: add.extra },
        ...(addDamage.plus ?? [])
          .filter(
            (clause) =>
              clauseReaches(ctx, actor, target, action, clause) &&
              (!clause.onCritical || critical) &&
              (clause.whileOn === undefined || rulesetItemOn(actor, clause.whileOn)),
          )
          .map((clause) => ({ amount: clause as RulesetCombatAmount, type: clause.type ?? addDamage.type })),
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
          ...(add.drain ? { drainsBack: add.drain } : {}),
        });
      }
    }
    // Whether something its target holds took some of it away (1.416): a missile so lessened to
    // nothing is caught.
    let lessened = false;
    // What the blow itself deals as it lands (1.792), before anything is added: oil wants fire.
    const carried = new Set(parts.flatMap((part) => (part.damageType ? [part.damageType.toLowerCase()] : [])));
    // Conditions a change spends once it adds (1.792), with whoever holds them.
    const spentOnUse: { holder: RulesetCombatant; condition: string }[] = [];
    if (parts.length) {
      for (const one of modifiers) {
        const { modifier } = one;
        if (modifier.onTypes && !modifier.onTypes.some((type) => carried.has(type.toLowerCase()))) continue;
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
        if (!dice && modifier.flat === undefined && modifier.add === undefined) continue;
        // Once on each of its holder's own turns (1.429), spent by the first blow it adds to.
        if (modifier.oncePer && !takenModifiers.includes(one)) {
          if (!oncePerTurnLeft(ctx, actor, one)) continue;
          spendOncePerTurn(ctx, actor, onceKey(one));
        }
        if (modifier.minus && takenModifiers.includes(one)) lessened = true;
        if (modifier.spentOnUse && one.level === undefined && !one.item && !one.derived)
          spentOnUse.push({ holder: takenModifiers.includes(one) ? target : actor, condition: one.condition });
        const amount = dice ?? { count: 0, sides: 0, flat: 0 };
        const rolled = rollAmount(ctx, amount);
        const bonus = critical && !onCritical ? criticalExtra(ctx, amount) : { rolls: [], flat: 0 };
        const sign = modifier.minus ? -1 : 1;
        // A value off its holder's sheet (1.413): Deflect Missiles' Dexterity modifier + monk level.
        const added = modifier.add
          ? (rulesetHolderValue(ctx.definition, takenModifiers.includes(one) ? target : actor, modifier.add) ?? 0)
          : 0;
        const flat = (modifier.flat ?? 0) + sign * (rolled.flat + bonus.flat + added);
        const addition = (modifier.flat ?? 0) + sign * (rolled.total + sumOf(bonus.rolls) + bonus.flat + added);
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
      const times = modifiers.reduce(
        (value, { modifier }) =>
          modifier.onTypes && !modifier.onTypes.some((type) => carried.has(type.toLowerCase()))
            ? value
            : value * (modifier.times ?? 1),
        1,
      );
      // Round the scaled TOTAL down once, carrying a fraction across clauses in their written order.
      let total = 0;
      for (const part of parts) {
        const previous = Math.floor(total);
        total += Math.max(0, part.amount) * times;
        landNow({ ...part, amount: Math.floor(total) - previous });
      }
      for (const { holder, condition } of spentOnUse) {
        if (holder.tracked.some((entry) => entry.condition === condition))
          removeCondition(ctx, holder, condition, "spent");
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
    // Dust at 0 (1.787): whoever its damage leaves at 0 dies outright, never dying. One that hung on
    // at 1 is not down; a thing is broken as it was.
    if (action.fellsKill && dealt > 0 && target.down && !target.defeated && !target.object)
      slay(ctx, target, actor.id, action.label);
    // Dropped by this blow (1.677): a giant spider's poison leaves them stable, poisoned and paralyzed.
    if (action.onFell && !downBefore && target.down && !target.defeated) fellByBlow(ctx, actor, action, target);
    // A weapon that hit it corroded (1.551): a rust monster's Rust Metal.
    if (dealt > 0) corrodeOnHit(ctx, actor, action, target);
    // Caught (1.416): a weapon's missile its target took all of away, to be thrown back with the
    // missile's own damage.
    if (before && lessened && dealt === 0 && action.damage && rulesetWeaponBlow(action) && !target.defeated) {
      ctx.caught ??= {
        targetIds: [],
        damage: {
          count: action.damage.count,
          sides: action.damage.sides,
          ...(action.damage.type ? { type: action.damage.type } : {}),
        },
        // The ammunition it was (1.626), for a catch that keeps it.
        ...(action.ammo && actor.lastShot !== undefined
          ? {
              missile: {
                item: actor.lastShot,
                ...(action.ammo.recover ? { recover: action.ammo.recover } : {}),
              },
            }
          : {}),
      };
      ctx.caught.targetIds.push(target.id);
    }
    // One hit, including its clauses, never accumulated wounds from previous hits.
    const levels = ctx.combat.damageKinds?.marks === "per-blow" ? Math.min(1, dealt) : dealt;
    // Nobody felled by the hit is dazed by it.
    if (before && daze && dazeOver !== undefined && levels > 0 && levels > dazeOver && !target.defeated) {
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
    const drainBack = (action.drain ? Math.floor(drainDealt * (action.drain.share ?? 1)) : 0) + Math.floor(addDrained);
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
          // Some rounds at most beside a save that ends it, and on its maker's turns (1.534).
          duration: entry.rounds
            ? { rounds: entry.rounds, ...(entry.of ? { of: entry.of } : {}) }
            : entry.saveEnds
              ? "until-save"
              : "instant",
          ...(entry.saveEnds ? { saveEnds: { save: entry.saveEnds.save, at: entry.saveEnds.at } } : {}),
          // Ended by its holder's own check (1.511): breaking out of a net.
          ...(entry.checkEnds ? { checkEnds: { ...entry.checkEnds } } : {}),
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
      const rolled = rollHealing(ctx, target, action.revives.amount);
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
    // What a catalog's entries put on them, ended (1.424): Dispel Magic, Cleansing Touch.
    if (action.endsSpells)
      endSpellsOn(ctx, actor, action, target, rulesetPaidLevel(ctx.definition, actor, action, payWith));
    if (heal && action.sharesHeal) {
      // As much as is left, up to their maximum or half of it.
      const now = healthOf(ctx, target);
      const most = action.sharesHeal === "half" ? Math.floor(now.max / 2) : now.max;
      const given = Math.max(0, Math.min(shareLeft, most - now.value));
      shareLeft -= given;
      if (given > 0)
        dealHeal(ctx, target, {
          sourceId: actor.id,
          rolls: [],
          flat: given,
          amount: given,
          magical: magicalAction(action),
        });
    } else if (heal && action.healsAll) {
      // All they are missing (1.757): Wish.
      const now = healthOf(ctx, target);
      const given = Math.max(0, now.max - now.value);
      dealHeal(ctx, target, {
        sourceId: actor.id,
        rolls: [],
        flat: given,
        amount: given,
        magical: magicalAction(action),
      });
    } else if (heal) {
      const rolled = healing && !action.healsMax && healedMax(ctx, target) ? maxAmount(healing, extra) : heal();
      dealHeal(ctx, target, {
        sourceId: actor.id,
        rolls: rolled.rolls,
        flat: rolled.flat + healAdded,
        amount: rolled.total + healAdded,
        magical: magicalAction(action),
      });
      if (healsSelf > 0 && target.id !== actor.id) {
        dealHeal(ctx, actor, { sourceId: actor.id, rolls: [], flat: healsSelf, amount: healsSelf, magical: true });
        healsSelf = 0;
      }
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
    // Spent pools given back by itself (1.656): a Pearl of Power's slot.
    if (action.recovers && target.sheet) {
      for (const pool of rulesetRecoverPicks(ctx.definition, target.sheet.build, target.sheet.live, action.recovers))
        restorePool(ctx, target, pool, { sourceId: actor.id, rolls: [], flat: 1, amount: 1 });
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
      // Its health as it lands (1.450), read once: Divine Word's tiers, and its kill at the lowest.
      const healthNow = healthOf(ctx, target).value;
      const dies =
        action.killsAtMost !== undefined &&
        target.id !== actor.id &&
        !target.defeated &&
        healthNow <= action.killsAtMost;
      // Warded against it (1.596), nothing of it takes: Death Ward against Divine Word.
      const warded = dies && wardedOutright(ctx, target);
      const slain = dies && !warded;
      if (slain) slay(ctx, target, actor.id, action.label);
      // Failed by enough, something worse goes on instead (1.592): a Wand of Wonder's petrifying.
      const failedBy = action.save?.failedBy;
      const missed = failedBy
        ? [...ctx.events].reverse().find((event) => event.type === "save" && event.actorId === target.id)
        : undefined;
      // Or with a total that low (1.673): a sprite's arrow.
      const worse =
        failedBy &&
        missed?.type === "save" &&
        !missed.automatic &&
        !missed.success &&
        ((failedBy.atLeast !== undefined && missed.difficulty - missed.total >= failedBy.atLeast) ||
          (failedBy.resultAtMost !== undefined && missed.total <= failedBy.resultAtMost));
      const putting = worse ? failedBy.applies : (action.applies ?? []);
      // Not while its applier already holds what it names on somebody (1.740), nor what ends with it:
      // a chain devil already grappling, and the restraint of its grapple.
      const imposing = new Set(
        putting
          .filter((one) => one.unlessImposing && rulesetImposes(ctx.state, actor, one.unlessImposing))
          .map((one) => one.condition),
      );
      for (let grew = imposing.size > 0; grew;) {
        grew = false;
        for (const one of putting) {
          if (one.endsWith !== undefined && imposing.has(one.endsWith) && !imposing.has(one.condition)) {
            imposing.add(one.condition);
            grew = true;
          }
        }
      }
      // Not on whoever it catches where it goes on what it calls (1.479).
      for (const applies of slain || warded || riderless || action.appliesToCalled ? [] : putting) {
        if (imposing.has(applies.condition)) continue;
        // Read off whoever applies it, as it applies (1.167): Rage's bonus by barbarian level.
        if (!rulesetSheetWithin(ctx.definition, actor, applies.when)) continue;
        if (!rulesetTargetIs(ctx.definition, target, applies.targetIs)) continue;
        if (applies.targetHealthAtMost !== undefined && healthNow > applies.targetHealthAtMost) continue;
        // Only by an attack rolled with advantage (1.676): a cloaker's bite on the head.
        if (applies.withAdvantage) {
          const swing = [...ctx.events]
            .reverse()
            .find((event) => event.type === "attack" && event.actorId === actor.id && event.targetId === target.id);
          if (swing?.type !== "attack" || swing.mode !== "advantage") continue;
        }
        // Destroyed in its place, at or below the tier its applier reaches (1.266): Destroy Undead.
        if (destroyedByTier(ctx, actor, target, applies)) {
          if (!wardedOutright(ctx, target)) slay(ctx, target, actor.id, action.label);
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
          // What put it on, for an entry that ends what a catalog's entries put on (1.424).
          ...(action.catalog ? { catalog: action.catalog } : {}),
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
        // Spared once what it put on ends (1.674): a dragon's Frightful Presence.
        if (action.sparedAfter?.whenEnds) {
          const on = target.tracked.find((entry) => entry.condition === applies.condition && entry.source === actor.id);
          if (on) on.auraSafeOnEnd = rulesetSparedKey(actor, action);
        }
      }
      // Pushed away from its maker (1.182), once whatever else it does has landed, and farther for
      // each charge more spent on it (1.271): a Ring of the Ram's.
      const pushedMore = (ctx.moreCharges ?? 0) * (action.itemUse?.charges?.step?.push ?? 0);
      const pushBy = action.push !== undefined || pushedMore > 0 ? (action.push ?? 0) + pushedMore : undefined;
      if (pushBy !== undefined && !riderless && target.id !== actor.id && rulesetCombatStanding(target)) {
        pushTarget(ctx, actor, target, pushBy);
      }
      // Pulled toward its maker (1.675), stopping beside them: a balor's whip, Thorn Whip.
      if (action.pull !== undefined && !riderless && target.id !== actor.id && rulesetCombatStanding(target)) {
        const pulled = pushTarget(ctx, actor, target, 0, rulesetPullPath(ctx.state, actor.id, target.id, action.pull));
        if (pulled) pulled.pulled = true;
      }
      // Drawn toward its maker on their own budget (1.326): Whisper a Name.
      if (action.draws && target.id !== actor.id && rulesetCombatStanding(target)) {
        drawTarget(ctx, actor, target, action.draws.spends);
      }
      // Moved where its user picked (1.565), once what holds it there has gone on: Telekinesis.
      if (action.movesTarget && ctx.carriesTo && !target.defeated) carryTarget(ctx, actor, action, target);
      // Sent out of the fight (1.236), last of all; its user too where they still take their turns
      // away (1.627), as a Robe of Stars takes its wearer to the Astral Plane.
      if (
        action.dismisses &&
        (target.id !== actor.id || (typeof action.dismisses === "object" && !!action.dismisses.turns)) &&
        !slain &&
        !riderless &&
        rulesetTargetIs(ctx.definition, target, action.dismissesIs)
      )
        dismiss(ctx, actor, action, target);
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
function canTakeTurn(ctx: RulesetCombatContext, combatant: RulesetCombatant): boolean {
  // Held out of time (1.647): no turn at all.
  if (rulesetStasis(ctx.definition, combatant, ctx.state)) return false;
  // Away and still taking turns (1.313), to find the way out of a maze, or to come back from a
  // blink (1.506) as one starts.
  if (combatant.defeated) return !!(combatant.away?.blinked || (combatant.away?.turns && combatant.away.while));
  return !combatant.down || (combatant.dying && !combatant.stable) || !!combatant.regrowing;
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
  // Walked with what movement is left as they end the turn (1.472), having acted: Compulsion. A walk
  // held open by somebody's reach waits for its answers, and ending the turn again goes on.
  if (
    leaving &&
    !leaving.flags.walkedAfter &&
    rulesetCombatStanding(leaving) &&
    !leaving.defeated &&
    !rulesetCombatEffects(definition, combat, leaving, ctx.state).has("cannot-act")
  ) {
    const active = rulesetActiveConditions(definition, combat, leaving, ctx.state);
    if (active.some((entry) => entry.behavior?.walks === "after")) {
      leaving.flags.walkedAfter = true;
      if (walkCompelled(ctx, leaving, active, "after") && ctx.state.window) return finish();
    }
  }
  // Time stopped (1.507), read before the turn's own conditions run out: another turn straight after.
  const again = !!leaving && timeStoppedTurn(ctx, leaving);
  if (leaving) {
    // Ending a turn in a zone comes before the turn's own conditions run out (1.172).
    zonesAtTurn(ctx, leaving, "turn-end");
    // Ending a turn inside solid ground (1.495): Incorporeal Movement.
    insideGround(ctx, leaving);
    endsAway(ctx, leaving);
    endsIdle(ctx, leaving);
    tickConditions(ctx, leaving, "turn-end");
    // Heads grown back as its turn ends (1.550): a hydra's.
    regrowHeads(ctx, leaving);
    // Off the board until their next turn, on their blink's die (1.506).
    blinkAway(ctx, leaving);
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
      // Widening as it lasts (1.637), until closed: an Eversmoking Bottle's smoke.
      spreadZone(ctx, leaving, zone);
      if (leaving.flags.freshZones?.includes(zone.actionId)) continue;
      zone.rounds -= 1;
      if (zone.rounds <= 0) endZones(ctx, leaving, zone.actionId);
    }
    // Strikes a spend bought are for the turn it was spent on. Nothing is carried over.
    delete leaving.strikesLeft;
    // Time stopped (1.507): their next turn straight after, nobody else's, and no window between.
    if (again) {
      beginNextTurn(definition, combat, ctx, true);
      return finish();
    }
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
  const next = nextTurnActor(ctx);
  const unknown = next?.wraps && (ctx.combat.initiative.each === "round" || !!ctx.combat.initiative.resource);
  const nextActorId = unknown ? "" : (next?.combatant.id ?? "");
  openWindow(ctx, { kind: "signature", trigger: { kind: "between-turns", nextActorId }, waiting });
  return true;
}

/** Signature actions bought as a foe's turn starts (Capability API 1.805), where the ruleset's
 *  `combat.signatureAtTurnStart` allows it: a boss answering the hero about to act, as well as
 *  between turns. Only the points' own actions are offered, not a lair's, which keep their count. */
function openTurnStartSignature(ctx: RulesetCombatContext, actor: RulesetCombatant): boolean {
  if (!ctx.combat.signatureAtTurnStart || !rulesetCombatStanding(actor)) return false;
  if (rulesetEncounterOutcome(ctx.state) !== "ongoing") return false;
  const waiting = [...new Set(ctx.state.order)].filter((id) => {
    const holder = rulesetCombatant(ctx.state, id);
    return (
      !!holder &&
      holder.side !== actor.side &&
      rulesetSignatureOptions(ctx.definition, ctx.state, id).some((option) => !option.lairOf)
    );
  });
  if (waiting.length === 0) return false;
  openWindow(ctx, {
    kind: "signature",
    trigger: { kind: "turn-start", sourceId: actor.id, label: actor.name },
    waiting,
  });
  return true;
}

/** Who acts next, read without moving the fight, and whether their turn begins a new round: the
 *  window between two turns says whose turn it is holding up. */
function nextTurnActor(ctx: RulesetCombatContext): { combatant: RulesetCombatant; wraps: boolean } | null {
  const state = ctx.state;
  let turn = state.turn;
  let wraps = false;
  for (let step = 0; step < state.order.length; step++) {
    if (turn + 1 >= state.order.length) wraps = true;
    turn = turn + 1 >= state.order.length ? 0 : turn + 1;
    const candidate = rulesetCombatant(state, state.order[turn]!);
    if (candidate && canTakeTurn(ctx, candidate) && !candidate.dazed) return { combatant: candidate, wraps };
  }
  return null;
}

/** The next turn, from a fight whose last one has already ended. Split out of `advanceRulesetTurn`
 *  so the window between the two can hold it: the turn-end books are closed either way, and this
 *  runs once, after the window rather than before it. */
function beginNextTurn(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  ctx: RulesetCombatContext,
  /** The same actor again, time stopped (1.507): no step along the order and no new round. */
  again = false,
): void {
  // A turn put in after another (1.320), the Hourglass's, is taken once and leaves the order again.
  // Taken, or passed over by somebody who could not take it.
  if (!again && ctx.state.interjected !== undefined && ctx.state.turn >= ctx.state.interjected) {
    ctx.state.order.splice(ctx.state.interjected, 1);
    ctx.state.turn -= 1;
    delete ctx.state.interjected;
  }
  let turn = ctx.state.turn;
  let round = ctx.state.round;
  let fresh = false;
  for (let step = 0; step < (again ? 0 : ctx.state.order.length); step++) {
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
    if (candidate && canTakeTurn(ctx, candidate)) break;
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
    // What outlasts a caster who takes no turns any more counts down as the round ends (1.456).
    for (const caster of ctx.state.combatants) {
      if (!caster.defeated || canTakeTurn(ctx, caster)) continue;
      for (const zone of [...(caster.zones ?? [])]) {
        zone.rounds -= 1;
        if (zone.rounds <= 0) endZones(ctx, caster, zone.actionId);
      }
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
        return !!candidate && canTakeTurn(ctx, candidate);
      });
      ctx.state.turn = Math.max(0, first);
    }
  }
  // A rider fires once in its period. "turn" is fresh at the start of every turn, whosever it is,
  // so a strike made while somebody else is acting can still carry one; "round" waits for the round
  // to turn over. Everybody's, because a rider fires on its holder's blow, not on their turn.
  for (const combatant of ctx.state.combatants) clearSpentRiders(combatant, fresh);
  // What some have back as every turn starts, anybody's (1.549): a marilith's reaction.
  for (const combatant of ctx.state.combatants) {
    for (const id of combatant.block?.refillsEveryTurn ?? []) {
      const budget = combat.economy.budgets.find((one) => one.id === id);
      if (budget) combatant.budgets[id] = Math.max(combatant.budgets[id] ?? 0, budget.count);
    }
  }

  const actor = currentRulesetActor(ctx.state);
  if (actor) {
    // Back from a blink before anything of the turn (1.506).
    blinkBack(ctx, actor);
    // What it called on their way come a turn nearer, and arrive (1.614).
    arriveCalled(ctx, actor);
    refreshRulesetBudgets(combat, actor.budgets, "turn");
    refreshSpendLimits(actor, "turn");
    // A spare reaction for each head beyond one (1.550), for opportunity attacks only.
    if (actor.heads && actor.block?.heads?.opportunityReactions) actor.heads.spare = Math.max(0, actor.heads.count - 1);
    // A stance lasts until the actor's next turn, and that turn is now. Help was given to somebody
    // else and is spent by their own next attack, so it survives this.
    actor.flags = actor.flags.helped
      ? { helped: true, ...(actor.flags.helpedAgainst ? { helpedAgainst: actor.flags.helpedAgainst } : {}) }
      : {};
    // A weapon's bonus lent to their defense comes back to it (1.737).
    if (actor.bonusShift) {
      shiftWeaponBonus(actor, actor.bonusShift.item, actor.bonusShift.amount);
      delete actor.bonusShift;
    }
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
    // And at all this fight (1.544).
    if (!ctx.state.tookTurn?.includes(actor.id)) (ctx.state.tookTurn ??= []).push(actor.id);
    refreshRulesetSignature(actor);
    rollRulesetRecharges(ctx, actor);
    // What it regains as its turn starts (1.396), and a troll down at 0 that cannot is out.
    regenerate(ctx, actor);
    // What damage stopped works again (1.514).
    delete actor.harmStopped;
    // Holding their breath under water, or out of it (1.498).
    holdBreath(ctx, actor);
    // A pact weapon left lying far off long enough is gone (1.480).
    if (actor.dropped?.length) conjuredLeftBehind(ctx, actor);
    // What it senses the presence of (1.444), said again each turn.
    sensePresence(ctx, actor, true);
    // Whoever it called for a while (1.394) leaves as its time comes round.
    dismissCalled(ctx, actor, (one) => one.calledUntil !== undefined && round >= one.calledUntil, "rounds");
    // What its items called stays a round less (1.612).
    departuresOf(ctx, actor);
    recoverFromCrash(ctx, actor);
    // Its own drifting zones move first (1.173), then starting a turn in a zone (1.172), before
    // the turn's own conditions tick.
    driftZones(ctx, actor);
    // Its zones in stages on to their next turn, and what each does now (1.557).
    stageZones(ctx, actor);
    burnAtTurn(ctx, actor);
    zonesAtTurn(ctx, actor, "turn-start");
    tickConditions(ctx, actor, "turn-start");
    // After the clocks, so what an aura's save puts on "until the start of its next turn" lasts it.
    if (!actor.defeated) aurasAtTurn(ctx, actor);
    // What strikes by itself for them as their turn starts (1.539): a Faithful Hound's bite.
    if (!actor.defeated) summonsStrike(ctx, actor);
    // Before the walk and the budgets are read, so one a roll brings back up stands and acts on
    // this turn (laptop playtest 2026-10-23: back up on 1, still prone, with no walk to stand with).
    if (actor.dying && !actor.stable && !actor.defeated) deathSave(ctx, actor);
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
    // Out of their caller's command (1.620): too far, or the caller unable to act. They act on their
    // own this turn, and the caller pays nothing for it.
    if (actor.calledCommandWithin !== undefined) {
      if (rulesetCommandReaches(definition, ctx.state, actor)) delete actor.calledOnOwn;
      else actor.calledOnOwn = true;
    }
    // Commanded by their caller (1.558): the caller pays for this turn, or it passes.
    const command = actor.calledCommand;
    if (command && !actor.defeated && !actor.calledTurned && !actor.calledOnOwn) {
      const caller = actor.calledBy ? rulesetCombatant(ctx.state, actor.calledBy) : undefined;
      // Through one of its caller's actions (1.736): only once the caller has made it.
      const given = command.action !== undefined ? command.given === true : undefined;
      if (command.action !== undefined) delete command.given;
      if (given === true || (given === undefined && command.free)) delete command.free;
      else if (
        given === undefined &&
        command.budget !== undefined &&
        caller &&
        rulesetCombatStanding(caller) &&
        (caller.budgets[command.budget] ?? 0) >= 1
      ) {
        caller.budgets[command.budget] = (caller.budgets[command.budget] ?? 0) - 1;
      } else {
        tickConditions(ctx, actor, "turn-end");
        ctx.events.push({ type: "skip", actorId: actor.id, reason: "uncommanded" });
        if (rulesetEncounterOutcome(ctx.state) === "ongoing") {
          beginNextTurn(definition, combat, ctx);
          return;
        }
      }
    }
    // Under nobody's control (1.615), unless tamed: it walks toward its caller, and that is its turn.
    const wild = actor.calledWild;
    if (
      wild &&
      !actor.defeated &&
      !(wild.tamedWhile && rulesetCombatConditions(definition, actor).includes(wild.tamedWhile))
    ) {
      const caller = actor.calledBy ? rulesetCombatant(ctx.state, actor.calledBy) : undefined;
      const budget = combat.economy.budgets.find((one) => (actor.budgets[one.id] ?? 0) >= 1)?.id;
      if (caller && rulesetPositionOf(caller) && budget) drawTarget(ctx, caller, actor, budget);
      tickConditions(ctx, actor, "turn-end");
      ctx.events.push({ type: "skip", actorId: actor.id, reason: "wild" });
      if (rulesetEncounterOutcome(ctx.state) === "ongoing") {
        beginNextTurn(definition, combat, ctx);
        return;
      }
    }
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
    // Whether it loses heart, or gets away now that it has (1.762): out, the turn goes with it.
    if (moraleTurn(ctx, actor) && rulesetEncounterOutcome(ctx.state) === "ongoing") {
      beginNextTurn(definition, combat, ctx);
      return;
    }
    // What its low health may set off as its turn starts (1.543): Berserk.
    rollAtTurnStart(ctx, actor);
    // What a condition's table makes of this turn (1.264), once nothing else is left to change it.
    compelTurn(ctx, actor);
    // What a delay held over is completed before anything else is done this turn.
    openMoment(ctx, { kind: "turn-start", sourceId: actor.id, label: actor.name }, ctx.state.combatants);
    if (!ctx.state.window && !openTurnStartSignature(ctx, actor)) {
      completeDelayed(ctx, actor);
      // A cast taking rounds carried on (1.461).
      continueCasting(ctx, actor);
    }
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

/** Walked the way the first condition that `walks` them now moves, as far as they can (1.464), as
 *  their turn starts (`true`) or as they end it (`"after"`, 1.472). Whether they were walked. */
function walkCompelled(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  active: ReturnType<typeof rulesetActiveConditions>,
  when: true | "after",
): boolean {
  for (const entry of active) {
    const moves = entry.behavior?.moves;
    if (entry.behavior?.walks !== when || !moves) continue;
    const from = rulesetBehaviorAnchor(ctx.state, actor, entry.condition, entry.behavior);
    const at = rulesetPositionOf(actor);
    if (!from || !at) continue;
    const gapAt = (cell: { x: number; y: number }) => rulesetGap({ ...actor, x: cell.x, y: cell.y } as never, from);
    let best: ReturnType<typeof rulesetReachableCells>[number] | undefined;
    let bestGap = rulesetGap(actor, from);
    for (const cell of rulesetReachableCells(ctx.definition, ctx.state, actor.id)) {
      const gap = gapAt(cell);
      if (moves === "away" ? gap > bestGap : gap < bestGap) {
        best = cell;
        bestGap = gap;
      }
    }
    if (!best) return false;
    resolveMove(ctx, actor, best);
    return true;
  }
  return false;
}

/** A creature's low-health roll as its turn starts (1.543): a golem's Berserk, a 6 on a d6 at 40
 *  hit points or fewer. Not rolled once it holds all of what it puts on. */
function rollAtTurnStart(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  if (!rulesetCombatStanding(actor) || actor.defeated) return;
  for (const rule of actor.block?.rollsAtTurnStart ?? []) {
    if (healthOf(ctx, actor).value > rule.healthAtMost) continue;
    const held = rulesetCombatConditions(ctx.definition, actor);
    if (rule.applies.every((one) => held.includes(one.condition))) continue;
    const dice = parseRulesetCombatDice(rule.dice);
    if (!dice) continue;
    const roll = rollAmount(ctx, dice).total;
    const conditions = rule.applies.map((one) => one.condition);
    ctx.events.push({ type: "turnRoll", actorId: actor.id, roll, atLeast: rule.atLeast, conditions });
    if (roll < rule.atLeast) continue;
    for (const applies of rule.applies)
      applyConditionId(ctx, actor, applies.condition, applies, { sourceId: actor.id });
  }
}

/**
 * Whether a combatant with a stat block loses heart as its turn starts (1.762). Each of
 * `combat.morale.on` that has happened and not yet been checked for it is checked now, in the order
 * the ruleset names them, and the first that breaks it decides: it gives up where its mind is among
 * `surrenders` and an opponent is beside it (or there is no board), else it runs. One already running
 * is out once a turn of its starts at the board's edge. True when it is out of the fight.
 */
function moraleTurn(ctx: RulesetCombatContext, actor: RulesetCombatant): boolean {
  if (!actor.block || actor.calledBy !== undefined || actor.object || actor.defeated) return false;
  // The party's own nerve is its players' to play, whoever runs a turn of theirs (Kenhito AI K4: a
  // player's own fighter rolled morale, and so did the companions beside him).
  if (actor.side === "party") return false;
  if (!rulesetCombatStanding(actor)) return false;
  if (actor.routed) {
    if (!rulesetAtBoardEdge(ctx.state, actor)) return false;
    ctx.events.push({ type: "fled", actorId: actor.id });
    outOfFight(ctx, actor, { by: actor.id, label: "Fled", left: true });
    return true;
  }
  const morale = ctx.combat.morale;
  if (!morale) return false;
  const mind = rulesetCombatantMind(ctx.definition, actor) ?? "tactical";
  if (mind === "mindless") return false;
  // A fanatic never loses heart (combat AI T2): as the Engine plays it, else as its own data says.
  const temperament = actor.temperament ?? rulesetCombatantBehavior(ctx.definition, actor)?.temperament;
  if (temperament === "fanatical" || temperament === "mindless") return false;
  if (morale.unlessImmune && rulesetImmuneToCondition(actor, morale.unlessImmune, ctx.definition, ctx.state))
    return false;
  const side = ctx.state.combatants.filter(
    (one) => one.side === actor.side && one.calledBy === undefined && !one.object,
  );
  // Fallen for good: down, slain, or gone off alive. Not one only sent away for a while.
  const fallen = side.filter(
    (one) => one.down || (one.defeated && (!one.away || !!one.away.left || !!one.away.surrendered)),
  );
  const happened = (trigger: RulesetMoraleTrigger): boolean => {
    if (trigger === "first-fall") return fallen.length > 0;
    if (trigger === "half-down") {
      if (side.length <= 1 || fallen.length * 2 < side.length) return false;
      // With no losses on the other side (1.775), as the Dungeon Master's Guide has it.
      return (
        !morale.halfDownUnanswered ||
        !ctx.state.combatants.some(
          (one) =>
            one.side !== actor.side &&
            one.calledBy === undefined &&
            !one.object &&
            (one.down || (one.defeated && (!one.away || !!one.away.left || !!one.away.surrendered))),
        )
      );
    }
    // Caught unaware (1.775): a turn it starts surprised.
    if (trigger === "surprised") return !!actor.surprised;
    // No way to harm the other side at all (1.775), as the Dungeon Master's Guide means it: nothing
    // it has could hurt or hold anybody of theirs, wherever they stand (its weapons and its magic
    // gone, a grapple or a shove all it has left), or every one of them is up in the air out of
    // reach of a creature that can neither fly nor shoot. Out of reach of a walk is not helpless.
    if (trigger === "helpless") {
      const harms = actor.actions.filter(
        (action) =>
          !action.whileHolds &&
          (!!action.damage || !!action.applies?.length) &&
          (action.targets.side === "enemy" || action.targets.side === "any") &&
          rulesetActionAvailable(actor, action, ctx.state, ctx.definition),
      );
      if (harms.length === 0) return true;
      const grid = ctx.state.board?.grid;
      const foes = ctx.state.combatants.filter(
        (one) => one.side !== actor.side && !one.object && rulesetCombatStanding(one),
      );
      return (
        !!grid &&
        !actor.speeds?.fly &&
        !harms.some((action) => !!action.range) &&
        foes.length > 0 &&
        foes.every((one) => rulesetAirborne(grid, one))
      );
    }
    if (trigger === "leader-down")
      return fallen.some((one) => one.id !== actor.id && (one.block?.leader || one.leader));
    const health = rulesetCombatHealth(ctx.definition, ctx.combat, actor);
    // A steadfast one (a boss) is shaken only when badly hurt, at half the line (cloud AI fights
    // 2026-10-25: bosses gave up at 31 of 72 and 40 of 85).
    return health.value < health.max * (morale.hurtBelow ?? 0.5) * (actor.steadfast ? 0.5 : 1);
  };
  for (const trigger of morale.on) {
    if (actor.moraleChecked?.includes(trigger) || !happened(trigger)) continue;
    // A disciplined one is not shaken by the first of its side to fall (combat AI T1).
    if (trigger === "first-fall" && temperament === "disciplined") continue;
    // Nor is a steadfast one by any of its side's losses.
    if (actor.steadfast && (trigger === "first-fall" || trigger === "half-down" || trigger === "leader-down")) continue;
    actor.moraleChecked = [...(actor.moraleChecked ?? []), trigger];
    const check = morale.check;
    // Said before the roll, so the save that follows has a reason (re-test 14).
    if ("save" in check || (actor.block.morale ?? check.score) !== undefined)
      ctx.events.push({ type: "moraleCheck", actorId: actor.id, trigger });
    let roll: number | undefined;
    let score: number | undefined;
    let held: boolean;
    if ("roll" in check) {
      score = actor.block.morale ?? check.score;
      const dice = parseRulesetCombatDice(check.roll);
      // With no morale score, nothing to break: it fights on.
      if (score === undefined || !dice) continue;
      roll = rollAmount(ctx, dice).total;
      held = roll <= score;
    } else held = throwSave(ctx, actor, check.save, check.difficulty);
    const pinned =
      !ctx.state.board?.grid ||
      ctx.state.combatants.some(
        (one) =>
          one.side !== actor.side &&
          rulesetCombatStanding(one) &&
          !!rulesetPositionOf(one) &&
          !!rulesetPositionOf(actor) &&
          rulesetGap(one, actor) <= 1,
      );
    // Of a kind that never gives itself up (1.785): it flees whatever its mind.
    const kind = rulesetCreatureKind(ctx.definition, actor).type;
    const yields = morale.surrenders?.includes(mind) && !(kind !== undefined && morale.neverSurrender?.includes(kind));
    const outcome = held ? "held" : yields && pinned ? "surrender" : "flee";
    ctx.events.push({
      type: "morale",
      actorId: actor.id,
      trigger,
      outcome,
      ...(roll !== undefined ? { roll } : {}),
      ...(score !== undefined ? { score } : {}),
    });
    if (outcome === "held") continue;
    if (outcome === "surrender") {
      outOfFight(ctx, actor, { by: actor.id, label: "Surrendered", surrendered: true });
      return true;
    }
    actor.routed = true;
    if (!rulesetAtBoardEdge(ctx.state, actor)) return false;
    ctx.events.push({ type: "fled", actorId: actor.id });
    outOfFight(ctx, actor, { by: actor.id, label: "Fled", left: true });
    return true;
  }
  return false;
}

/** Whether a combatant fills a cell on the board's edge, or there is no board to cross (1.762). */
export function rulesetAtBoardEdge(state: RulesetEncounterState, combatant: RulesetCombatant): boolean {
  const grid = state.board?.grid;
  if (!grid || !rulesetPositionOf(combatant)) return true;
  // On a shaped board (2026-10-24) its edge is its outline as well: beside a square off the map.
  const outside = (grid as { outside?: boolean[][] }).outside;
  return rulesetFootprint(combatant).some(
    (cell) =>
      cell.x <= 0 ||
      cell.y <= 0 ||
      cell.x >= grid.width - 1 ||
      cell.y >= grid.height - 1 ||
      (!!outside && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => outside[cell.y + dy]?.[cell.x + dx] === true))),
  );
}

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
  // Walked the way it moves as far as it can (1.464): Compulsion.
  walkCompelled(ctx, actor, active, true);
  // A save as the turn starts, or a budget wasted for it (1.463): Bestow Curse.
  for (const entry of active) {
    const wastes = entry.behavior?.wastes;
    if (!wastes) continue;
    const tracked = actor.tracked.find((one) => one.condition === entry.condition);
    if (tracked?.difficulty === undefined) continue;
    if (rollSave(ctx, actor, wastes.save, tracked.difficulty, tracked.source)) continue;
    actor.budgets[wastes.budget] = 0;
    const label = ctx.combat.economy.budgets.find((budget) => budget.id === wastes.budget)?.label ?? wastes.budget;
    ctx.events.push({ type: "wasted", actorId: actor.id, condition: entry.condition, budget: wastes.budget, label });
  }
  // A turn that starts with nowhere to walk is its own where a condition says so (1.266): Fear.
  if (active.some((entry) => entry.behavior?.onlyWhenStuck === "any")) {
    actor.flags.stuck = rulesetReachableCells(ctx.definition, ctx.state, actor.id).length === 0;
  }
  // At the nearest creature it sees, walked to it first (1.543): Berserk.
  const nearest = active.find((entry) => entry.behavior?.nearest);
  if (nearest) {
    const seen = ctx.state.combatants
      .filter(
        (one) =>
          one.id !== actor.id &&
          !one.defeated &&
          rulesetPositionOf(one) &&
          rulesetCanSee(ctx.definition, ctx.state, actor, one),
      )
      .sort((a, b) => rulesetGap(actor, a) - rulesetGap(actor, b) || (a.id < b.id ? -1 : 1));
    const target = seen[0];
    if (target) {
      actor.flags.compelled = "nearest";
      actor.flags.compelledTarget = target.id;
      ctx.events.push({ type: "goesAt", actorId: actor.id, condition: nearest.condition, targetId: target.id });
      if (rulesetGap(actor, target) > 1) {
        let best: ReturnType<typeof rulesetReachableCells>[number] | undefined;
        let bestGap = rulesetGap(actor, target);
        for (const cell of rulesetReachableCells(ctx.definition, ctx.state, actor.id)) {
          const gap = rulesetGapFrom(cell, rulesetSpanOf(actor), target);
          if (gap >= 1 && gap < bestGap) {
            best = cell;
            bestGap = gap;
          }
        }
        if (best) resolveMove(ctx, actor, best);
      }
      return;
    }
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
  // Down at 0 while it may regenerate (1.396), a troll is not out of it yet.
  // An object called to take no turns (1.479) keeps no side standing.
  // Blinked away (1.506), back as their next turn starts, they are still in it.
  // Set aside by a zone (1.533), it is still in it too.
  // Nor one under nobody's control (1.615).
  // Gone of its own accord and back when it likes (1.627), a Robe of Stars' wearer is still in it.
  const out = (combatant: RulesetCombatant) =>
    combatant.turnless ||
    !!combatant.calledWild ||
    (!rulesetCombatStanding(combatant) &&
      !combatant.regrowing &&
      !combatant.away?.blinked &&
      !combatant.away?.setAside &&
      !(combatant.away?.turns && combatant.away.by === combatant.id));
  if (enemies.length > 0 && enemies.every(out)) return "victory";
  // Nor a party member still rolling to live (laptop pass 8 2026-10-26: "The party has fallen" as the
  // last hero dropped, with no dying save thrown): a natural 20 gets them up, and a party all stable
  // or dead has fallen.
  if (party.length > 0 && party.every(out) && !party.some((one) => one.dying && !one.stable && !one.defeated)) {
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
    // How many have begun a turn, so a fight left in its first round after somebody acted is not
    // told as one that never began.
    turns: state.tookTurn?.length ?? 0,
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
          ...(combatant.defeated ? { dead: true as const } : {}),
          conditions: rulesetConditionsPastFight(definition, combatant),
          ...(combatant.away?.left ? { left: true as const } : {}),
          ...(combatant.calledBy !== undefined && !combatant.calledKept ? { called: true as const } : {}),
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
          ...(combatant.knockedOut ? { knockedOut: true as const } : {}),
          ...(combatant.away?.surrendered ? { surrendered: true as const } : {}),
        };
      }),
    ...(state.board?.broken?.length ? { broken: [...state.board.broken] } : {}),
  };
}
