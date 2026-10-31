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
  gameInventoryNameKey,
  applyRulesetSheetOp,
  capRulesetCasterSheet,
  holdRulesetCasterSpellDamage,
  raiseRulesetCasterPools,
  raiseRulesetSheetAbilities,
  RULESET_INVENTED_CASTER_MOST,
  rulesetBudgetLevel,
  rulesetBudgetedTiers,
  rulesetEncounterBudget,
  type GameDifficulty,
  rulesetActionAvailable,
  rulesetSealedApart,
  parseRulesetCombatDice,
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  rulesetCombatIsSymbol,
  assignCombatTactics,
  combatMindWithHint,
  chooseRankedCombatCandidate,
  rankCombatCandidates,
  clampRulesetStatBlock,
  createRulesetEncounter,
  currentRulesetActor,
  deterministicRng,
  dieRollerFrom,
  findRulesetCreature,
  findRulesetCreatureEntry,
  rulesetSaidCreatureType,
  fillRulesetSheetChoices,
  generateTacticalBattlefield,
  validateTacticalBattlefieldBrief,
  defaultBattlefieldSize,
  TACTICAL_BATTLEFIELD_SIZES,
  madeTacticalBattlefield,
  foothillElevation,
  holdRulesetCombatant,
  holdRulesetLegendary,
  holdRulesetSheetHealth,
  settleRulesetFledFight,
  rulesetLetGoOfHeld,
  rulesetReleaseHeldGround,
  type RulesetHeldGroundRelease,
  normalizeCharacterLookupName,
  normalizeGameDifficulty,
  normalizeTacticalEnvironment,
  normalizeTacticalFormation,
  placeSpawns,
  readRulesetLive,
  rulesetHitChances,
  rulesetSaveFailChances,
  rulesetSequenceForecastAgainst,
  rulesetAimCells,
  rulesetAnswerDeflects,
  rulesetItemSlotPayment,
  rulesetBlowKind,
  rulesetCombatant,
  rulesetCombatEffects,
  rulesetCreatureKind,
  rulesetActiveConditions,
  rulesetItemEffectFacts,
  rulesetCombatConditions,
  rulesetZoneConditions,
  rulesetCombatHealth,
  rulesetDefenseAgainst,
  rulesetForecastsByTarget,
  rulesetConditionIcons,
  rulesetCombatHide,
  rulesetRegenerations,
  rulesetTargetIs,
  rulesetTargetTypesAllow,
  rulesetCombatOptions,
  rulesetCostSteps,
  rulesetAverageAmount,
  rulesetAverageDamage,
  rulesetImmuneToCondition,
  rulesetAreaTargets,
  rulesetAimedCells,
  rulesetCombatIsPool,
  rulesetPoolChance,
  rulesetDamageAverage,
  planRulesetCombatCost,
  rulesetActionUses,
  rulesetInnateSlot,
  rulesetInnateSlotsLeft,
  rulesetUsesKey,
  rulesetCombatRoller,
  rulesetCombatStanding,
  rulesetHiddenFrom,
  rulesetStandardName,
  rulesetStandardBudget,
  rulesetContestChance,
  rulesetProposedCreatureSchema,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
  rulesetOpportunityAttack,
  rulesetOptionTargets,
  rulesetTargetsBeyond,
  rulesetCombatantDistance,
  rulesetAroundTargets,
  rulesetReactionPointsAtSource,
  rulesetReactionTarget,
  rulesetWeaponBlow,
  rulesetCriticalFromAdjacent,
  rulesetAttackNamed,
  rulesetSheetWithin,
  rulesetWindowCause,
  rulesetFallTargets,
  rulesetPositionOf,
  rulesetLightAt,
  rulesetWalkingDistances,
  rulesetFootprint,
  rulesetFootprintAt,
  rulesetNearestCell,
  rulesetPathCells,
  rulesetCellBlocked,
  rulesetSees,
  rulesetSpanOf,
  rulesetSqueezeAt,
  rulesetBehaviorAnchor,
  rulesetGapFrom,
  rulesetDragging,
  rulesetPushPath,
  rulesetActionReach,
  rulesetGap,
  rulesetAtBoardEdge,
  rulesetDistanceTo,
  rulesetInCells,
  rulesetCombatantBehavior,
  rulesetCombatantRole,
  rulesetActionIsSpell,
  rulesetCombatantMind,
  rulesetCombatantForesees,
  rulesetStartPlacements,
  rulesetWaterStarts,
  rulesetDeployCells,
  type CombatStartPlace,
  rulesetAirborne,
  RULESET_FLY_UP_OPTION,
  shiftCombatTemperament,
  withRulesetPlanMemo,
  withoutRulesetPlanMemo,
  rulesetSheetBuildsByName,
  rulesetSheetDead,
  rulesetCardCreaturesByName,
  readProposedRulesetSheet,
  planRulesetUse,
  rulesetProposedSheetWithEntries,
  restrictRulesetSheetEntries,
  RULESET_PROPOSED_SHEET_REPLACES,
  rulesetProposedStatBlock,
  rulesetTierStatBlock,
  rulesetWrittenArea,
  rulesetWrittenAreaAction,
  rulesetSheetBuildSchema,
  rulesetBestiaryReaction,
  rulesetBestiaryActionNamed,
  rulesetUnpricedLegendary,
  rulesetTierPointCaps,
  rulesetActionAverage,
  rulesetWindowMoment,
  rulesetZonesShown,
  rulesetBoardShading,
  rulesetOpenLairWindow,
  rulesetStandingAtStart,
  rulesetKeptCalls,
  rulesetKeptForm,
  type RulesetStandingZone,
  rulesetWindowOptions,
  rulesetAreaCells,
  rulesetZoneCatches,
  rulesetZoneCells,
  RULESET_LAIR_OPTION_PREFIX,
  RULESET_MOVE_OPTION,
  RULESET_MOUNT_OPTION_PREFIX,
  RULESET_ZONE_OPTION_PREFIX,
  RULESET_ZONE_TURN_OPTION_PREFIX,
  RULESET_PASS_OPTION,
  RULESET_SHAPE_REVERT_ID,
  RULESET_ENGINE_SPENDS_OPTION,
  RULESET_STAND_OPTION,
  RULESET_CLIMB_OUT_OPTION,
  type CombatAiCandidate,
  type CombatAiScoreParts,
  type Combatant,
  type CombatDecisionOption,
  type DirectedCommand,
  type DirectedRulesetEvent,
  type DirectedRulesetReason,
  type DirectedRulesetCallout,
  type DirectedRulesetCalloutWay,
  type DirectedRulesetCombatant,
  type DirectedRulesetOption,
  type DirectedRulesetPlayer,
  rulesetPaidLevel,
  type DirectedRulesetView,
  type RulesetBoardLight,
  type RulesetCatalogEntriesById,
  type RulesetCombatAction,
  type RulesetCombatCondition,
  type RulesetCombatApplies,
  type RulesetCombatChoice,
  type RulesetWindowTrigger,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetCombatOption,
  type RulesetCombatant,
  type RulesetCombatantInput,
  type RulesetStatBlock,
  type RulesetStatBlockAction,
  type RulesetCombatBehavior,
  type RulesetDefinition,
  type RulesetTargetPreference,
  type RulesetEncounterState,
  type RulesetHeldGround,
  type RulesetLiveState,
  type RulesetLiveStates,
  type TacticalBattlefieldBrief,
  type TacticalMadeBattlefield,
  type TacticalGrid,
  type CombatMind,
  type CombatOrders,
  type CombatTactics,
  type RulesetSheetItem,
  type RulesetCarriedInput,
  type RulesetCreature,
  type RulesetItemBook,
  type RulesetItemBookEntry,
  rollRulesetCreatureInventory,
  rulesetRolledAmount,
  rulesetCarriedLeft,
  rulesetActionItemIndex,
  rulesetChooseAmmo,
  rulesetDrawInHand,
  rulesetInHand,
  rulesetCombatantFlying,
  withRulesetSheetEvaluationCache,
  type RulesetSheetBuild,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { combatDirectorView, type CombatDirectorState } from "./combat-director.service.js";

/** How many events a session keeps. A screen prints the tail and asks for nothing older, so the
 *  ledger row stays small however long a fight runs.
 *  ponytail: a fixed window. A fight that needs its whole history on screen wants the events in
 *  their own paged store, which is the upgrade path. Enough for a long fight whole (laptop playtest
 *  2026-10-25: a ten-round fight kept only its last seven rounds at 200). */
export const RULESET_COMBAT_EVENT_LIMIT = 600;
/** How many of the AI's reasons a session keeps beside them, newest first. */
export const RULESET_COMBAT_REASON_LIMIT = 60;

/** How many lines the opponents' own build is allowed to leave behind. */
const RULESET_ADJUSTMENT_LIMIT = 60;

/** The same name, without case or the space around it: a kept shape's form as stored and in a fight. */
const sameRulesetName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** How many actions one turn of an actor nobody controls may take before the turn is ended anyway.
 *  Budgets already bound it; this is the belt beside the braces. */
const RULESET_TURN_ACTION_LIMIT = 12;

/** The fight itself, as the director's ledger stores it. Plain JSON by design: it is persisted, read
 *  back and resolved from exactly as it was left. */
export interface RulesetFightState {
  encounter: RulesetEncounterState;
  /** One per event ever produced, so a client prints only what it has not seen. */
  eventSeq: number;
  events: Array<{ seq: number; event: DirectedRulesetEvent }>;
  /** Who plays each party member. An opponent is never in here. */
  controllers: Record<string, "manual" | "ai">;
  /** The party member the player plays as their own character, or plays in their dead one's place. */
  lead?: string;
  /** A shared room's fight (2026-10-26): the room player whose own character each party member is, by
   *  combatant id. Only that player commands it; the host commands every other party member. Kept up
   *  to date with the room by the route, so a player who leaves hands theirs back to the host. */
  players?: Record<string, DirectedRulesetPlayer>;
  /** The set-ups already called out (`<target>:<way>`), so each is said once while it stands. */
  calledOut?: string[];
  /** The player chooses what their own symbol throws buy (1.382): every party member they play is
   *  asked, and the Engine picks for everybody else. */
  chooseSpends?: boolean;
  /** The opponents the client marked as bosses, which is what routes a turn to the Game Master. */
  bosses: string[];
  /** The named and the brilliant opponents (combat AI P9), whose turns go to the Game Master too in a
   *  game that asks it to play them. */
  thinkers?: string[];
  /** Every clamp and every fallback the opponents were built with, in plain words. */
  adjustments: string[];
  /** The loot table each opponent built from the bestiary carries, by combatant id: what a win rolls. */
  lootTables?: Record<string, string>;
  /** What the turn being played has done so far, kept while a window it opened waits on a person:
   *  the rest of the turn picks up from here rather than from its start (re-test 11: an archer that
   *  shot, waited on Elara's Shield, then walked in as though it never had). */
  turnSoFar?: {
    actorId: string;
    round: number;
    turn: number;
    shotFromAfar: "stay" | "kite" | false;
    defended: boolean;
    /** Whether it has struck up close this turn (combat AI A4), and may get out again after. */
    struckClose?: boolean;
  }; /** What the fight looked like when a round last began, and how many rounds in a row it has looked
   *  just the same (K8): a fight nothing can change any more is called off. */
  stall?: { key: string; round: number; rounds: number; seq: number };
  /** Before the first turn, while the player sets their own down (2026-10-24, Alyssa): the cells
   *  they may stand on, and who of the party the Game Master already placed, which stay where the
   *  story put them. Gone once the player begins the fight. */
  deploy?: { cells: Array<{ x: number; y: number }>; placed: string[] };
  /** What each opponent was made from, by combatant id: what one that gets away comes back as. */
  made?: Record<string, RulesetReturningFoe>;
  /** The keys of those kept from before that came back here under other words: forgotten under them
   *  once the fight ends, as each is kept again by the name it fought under here. */
  returnedFrom?: string[];
  /** The coins the Game Master gave each opponent, by combatant id (laptop playtest 2026-10-25: a
   *  thief's stolen 9 gp, "no item called gold pieces"): they drop with it when it is beaten. */
  purses?: Record<string, Array<{ ref: string; name: string; count: number }>>;
}

/** An opponent as it was made for a fight, kept for when it gets away and comes back (laptop playtest
 *  2026-10-25: a Cult Mage that fled at CR 3 with 32 health came back at CR 4 with 65). */
export interface RulesetReturningFoe {
  name: string;
  creature?: string;
  tier?: string;
  proposed?: unknown;
  attacks?: RulesetFightOpponent["attacks"];
  /** The most health it had, where its dice threw it (a block with no sheet): thrown once, kept. */
  health?: number;
  /** The health it got away without (laptop playtest 2026-10-25: Kallian fled at 21 of 32 and came
   *  back whole): it comes back still missing it. */
  taken?: number;
  /** The temperament it fought with (cloud re-test 2026-10-25: a returning Ilse was opportunistic,
   *  then disciplined, then reckless). */
  temperament?: string;
  /** A named one of the story, or a boss (2026-10-25): it comes back by its name whatever else is
   *  called so. One that is not comes back only as the one of its name in a fight. */
  named?: true;
  /** The coins it had on it, which it takes along when it gets away. */
  coins?: Array<{ ref: string; name: string; count: number }>;
  /** What its sheet's pools other than health were at as the fight ended (2026-10-25): spell slots
   *  spent stay spent until it rests, as its class's do. */
  pools?: Record<string, unknown>;
  /** The slots a block caster had left, by level (2026-10-25), until a long rest gives them back. */
  slotsLeft?: Record<string, number>;
  /** The game clock in minutes as it got away (2026-10-25), against which its rests are counted. */
  clock?: number;
}

/** A proposal with its sheet as the fight built it, where it had one. */
function rulesetProposedAsBuilt(proposed: unknown, combatant: RulesetCombatant | undefined): unknown {
  const kept = structuredClone(proposed);
  if (!combatant?.sheet || !kept || typeof kept !== "object" || Array.isArray(kept)) return kept;
  const sheet = (kept as { sheet?: unknown }).sheet;
  if (!sheet || typeof sheet !== "object") return kept;
  return { ...kept, sheet: structuredClone(combatant.sheet.build) };
}

/** The key a returning opponent is kept and found under: its name, any case and spacing. */
export function rulesetReturningFoeKey(name: string): string {
  // Less what the Game Master writes after it in brackets (laptop playtest 2026-10-25: the Cult Thug
  // that got away came back as "Cult Thug (Wounded)").
  return normalizeCharacterLookupName(name.replace(/\s*[([][^()[\]]*[)\]]\s*$/, "") || name);
}

/** Whether a fight's opponent is one kept from before under other words (laptop playtest 2026-10-25:
 *  "Cult Thug (Highwayman)" got away and came back as "Highwayman Thug"): every word of one name, its
 *  bracketed ones too, is among the other's, and the shorter has two words or more. */
export function rulesetReturningFoeReworded(kept: string, name: string): boolean {
  const words = (text: string) =>
    new Set(
      normalizeCharacterLookupName(text)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 0 && !["the", "a", "an", "of"].includes(word)),
    );
  const one = words(kept);
  const other = words(name);
  const [few, many] = one.size <= other.size ? [one, other] : [other, one];
  return few.size >= 2 && [...few].every((word) => many.has(word));
}

/** Whether a name carries a bracketed word after it, as a Game Master marks one it means: "(Wounded)". */
export function rulesetReturningFoeMarked(name: string): boolean {
  return /\s*[([][^()[\]]*[)\]]\s*$/.test(name) && rulesetReturningFoeKey(name) !== normalizeCharacterLookupName(name);
}

/** The opponents of a finished fight that got away alive or were still standing as it ended, as they
 *  were made, and the names of those beaten for good: the first come back as they were, the second
 *  are forgotten. Called ones and ones that gave up are neither. */
export function rulesetFightReturningFoes(
  definition: RulesetDefinition,
  fight: RulesetFightState,
  /** The temperament each was fought with, by id, kept so it comes back the same. */
  temperamentOf?: (id: string) => string | undefined,
): {
  fled: RulesetReturningFoe[];
  beaten: string[];
} {
  const fled: RulesetReturningFoe[] = [];
  const beaten: string[] = [];
  for (const one of fight.encounter.combatants) {
    if (one.side !== "enemy" || one.calledBy !== undefined || one.object) continue;
    const made = fight.made?.[one.id];
    if (!made) continue;
    // One that got away, or was still standing as the fight ended (it won: laptop playtest 2026-10-25,
    // a War-mage that beat the party came back rebuilt at 40 health from 65), is the same one next time.
    const standing = !one.away && !one.down && !one.defeated;
    if ((one.away?.left && !one.away.surrendered) || standing) {
      const health = definition.combat ? rulesetCombatHealth(definition, definition.combat, one) : undefined;
      const taken = health ? Math.max(0, Math.round(health.max - health.value)) : 0;
      const coins = fight.purses?.[one.id];
      const healthPool = definition.combat && "pool" in definition.combat.health ? definition.combat.health.pool : null;
      const livePools = (one.sheet?.live as { pools?: Record<string, unknown> } | undefined)?.pools;
      const pools = livePools
        ? Object.fromEntries(Object.entries(livePools).filter(([key]) => key !== healthPool))
        : undefined;
      const slotsLeft = one.sheet
        ? undefined
        : Object.fromEntries(
            Object.entries(one.uses ?? {}).flatMap(([key, left]) =>
              key.startsWith("slot:") && typeof left === "number" ? [[key.slice(5), left] as const] : [],
            ),
          );
      const temperament = temperamentOf?.(one.id);
      fled.push({
        ...made,
        ...(temperament ? { temperament } : {}),
        ...(!one.sheet && one.health ? { health: one.health.max } : {}),
        ...(taken > 0 ? { taken } : {}),
        ...(coins?.length ? { coins } : {}),
        ...(pools && Object.keys(pools).length ? { pools } : {}),
        ...(slotsLeft && Object.keys(slotsLeft).length ? { slotsLeft } : {}),
      });
    } else if (one.down || (one.defeated && !one.away)) beaten.push(made.name);
  }
  return { fled, beaten };
}

/** Whether a rest is a short one, by its id or name (2026-10-25); any other is taken for a night's. */
function rulesetShortRest(rest: { id: string; label?: string }): boolean {
  return /\bshort\b/.test(`${rest.id} ${rest.label ?? ""}`.toLowerCase());
}

/** The rests that passed between two readings of the game clock (2026-10-25): a short one once an
 *  hour has, any other once 8 hours have, the short ones first. */
export function rulesetRestsBetween(definition: RulesetDefinition, from?: number, to?: number): string[] {
  if (from === undefined || to === undefined || !(to > from)) return [];
  const elapsed = to - from;
  const rests = definition.rests ?? [];
  return [
    ...rests.filter((rest) => rulesetShortRest(rest) && elapsed >= 60),
    ...rests.filter((rest) => !rulesetShortRest(rest) && elapsed >= 480),
  ].map((rest) => rest.id);
}

/** An opponent that comes back as it left (2026-10-25): still missing the health it got away without,
 *  never down for it, with the spell slots and other pools it spent still spent, until the rests that
 *  passed since give them back as its class's would. A block caster's slots, and its health, come back
 *  only with a night's rest. */
export function rulesetBringBackFoe(
  definition: RulesetDefinition,
  one: RulesetCombatant,
  back: RulesetReturningFoe,
  clock?: number,
): void {
  const combat = definition.combat;
  if (!one.sheet && one.health && back.health) one.health = { value: back.health, max: back.health, temp: 0 };
  const rests = rulesetRestsBetween(definition, back.clock, clock);
  const longRest = rests.some((id) => {
    const rest = definition.rests?.find((r) => r.id === id);
    return !!rest && !rulesetShortRest(rest);
  });
  if (one.sheet) {
    if (back.pools && Object.keys(back.pools).length) {
      const live = (one.sheet.live ?? {}) as { pools?: Record<string, unknown> };
      one.sheet.live = { ...live, pools: { ...(live.pools ?? {}), ...back.pools } } as never;
    }
  } else if (back.slotsLeft && !longRest) {
    for (const [level, left] of Object.entries(back.slotsLeft)) {
      if (one.uses[`slot:${level}`] !== undefined)
        one.uses[`slot:${level}`] = Math.min(one.uses[`slot:${level}`]!, left);
    }
  }
  if (combat && back.taken && !(longRest && !one.sheet)) {
    const health = rulesetCombatHealth(definition, combat, one);
    const taken = Math.min(back.taken, Math.max(0, health.max - 1));
    if (taken > 0 && !one.sheet && one.health) one.health = { ...one.health, value: one.health.max - taken };
    else if (taken > 0 && one.sheet && "pool" in combat.health) {
      const hurt = applyRulesetSheetOp(definition, one.sheet.build, one.sheet.live as never, {
        op: "damage",
        pool: combat.health.pool,
        amount: taken,
      });
      if (hurt.ok) one.sheet.live = hurt.live;
    }
  }
  if (one.sheet)
    for (const rest of rests) {
      const rested = applyRulesetSheetOp(definition, one.sheet.build, one.sheet.live as never, { op: "rest", rest });
      if (rested.ok) one.sheet.live = rested.live;
    }
}

export type RulesetCommandResult = { ok: true } | { ok: false; error: string; code: string };

const refuse = (error: string, code: string): RulesetCommandResult => ({ ok: false, error, code });

/** The fight begun, once the party is set down (2026-10-24): whose turn it is, said now. */
export function rulesetBeginFight(fight: RulesetFightState): void {
  if (!fight.deploy) return;
  delete fight.deploy;
  const actor = currentRulesetActor(fight.encounter);
  if (actor) record(fight, [{ type: "turn", actorId: actor.id, round: fight.encounter.round }]);
}

/** Who of the party the player sets down before the first turn (2026-10-24): each they play whom
 *  the story did not place. Nobody once the fight has begun. */
export function rulesetDeployers(state: CombatDirectorState, fight: RulesetFightState): string[] {
  if (!fight.deploy) return [];
  return fight.encounter.combatants
    .filter(
      (one) =>
        one.side === "party" &&
        !one.object &&
        rulesetPositionOf(one) &&
        !fight.deploy!.placed.includes(one.id) &&
        rulesetController(state, fight, one) === "manual",
    )
    .map((one) => one.id);
}

/** Where the fight stands, once a command has been applied: who is waited on, or that it is over. */
export function rulesetDirectorStage(state: CombatDirectorState): CombatDirectorState["stage"] {
  const fight = fightOf(state);
  if (!fight) return state.stage;
  if (state.outcome) return "finished";
  if (fight.deploy) return "deploy";
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
  const fight = fightOf(state);
  if (fight) {
    // Who picks their own spends follows who the player plays, as that changes.
    const asked = fight.chooseSpends
      ? fight.encounter.combatants
          .filter((combatant) => combatant.side === "party" && rulesetController(state, fight, combatant) === "manual")
          .map((combatant) => combatant.id)
      : [];
    if (asked.length > 0) fight.encounter.askSpends = asked;
    else delete fight.encounter.askSpends;
    // With nobody left for the player to set down (each handed to the Engine), the fight begins.
    if (fight.deploy && rulesetDeployers(state, fight).length === 0) rulesetBeginFight(fight);
    // A window waiting on somebody comes before any Game Master's decision for anybody else: one left
    // open over it hides the question from the player asked, and the fight stands still (laptop
    // playtest 2026-10-25: Mara's Hellish Rebuke under Grak's decision). It is asked again after.
    const waiting = fight.encounter.window?.waiting[0];
    if (waiting && state.window && state.window.actorId !== waiting) {
      logger.warn(
        "[game/combat:ruleset] A decision for %s was open over window %s waiting on %s; it is put away",
        state.window.actorId,
        fight.encounter.window!.id,
        waiting,
      );
      closeWindow(state);
    }
  }
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
  /** A named individual of the story rather than a nameless foe (combat AI P9), as the Game Master
   *  wrote it: one the Game Master may play itself, as it plays a boss. */
  named?: boolean;
  /** Its mind where the story changes what its own data says (a dominated creature). */
  mind?: CombatMind;
  /** Its side follows it, by the story (combat AI E2): a bandit chief nobody's bestiary marks. */
  leader?: boolean;
  /** Where it begins (2026-10-24), as the Game Master placed it; its formation's place when unsaid. */
  start?: CombatStartPlace;
  /** How it fights: the same competence and temperament its choices in the fight are made with,
   *  which is also what fills an invented sheet's open choices. Assigned here when not given. */
  tactics?: Pick<CombatTactics, "proficiency" | "adjective">;
  /** How a story fight has it (1.363): its Legendary Resistance and health, when it is a bestiary's. */
  adjust?: { legendaryResistance?: number; maxHp?: number; calls?: Array<{ action: string; creature: string }> };
  /** What the Game Master gave it to have on it (1.795), one line an item by its name or reference:
   *  in place of what its bestiary entry rolls for, and none at all when empty. */
  items?: string[];
  /** Coins it comes back with, from an earlier fight it got away from. */
  coins?: Array<{ ref: string; name: string; count: number }>;
  /** What an invented one is, by the ruleset's creature type id: a humanoid cultist. */
  creatureType?: string;
  /** The attacks the Game Master wrote for it in the Engine's own terms, by name, and whether each is
   *  a reaction: what names an invented one's strikes, and which bestiary reactions it borrows. */
  attacks?: Array<{
    name: string;
    reaction?: string;
    kind?: "heal" | "buff" | "debuff";
    /** Written as a spell: looked for among this ruleset's entries as a heal or a buff is. */
    spell?: true;
    /** What it costs out of a boss's points between turns, as the Game Master wrote it. */
    legendary?: number;
    /** Marked as reaching more than one (an area, or every foe), and what was written of it: a breath,
     *  a cone or a line is built as a save against an area. */
    area?: true;
    description?: string;
  }>;
  /** A boss's points to spend between turns, as the Game Master wrote it. */
  points?: number;
  /** The share of its health it still has, above 0 and below 1, where the story hurt it before the
   *  fight (the Game Master's `hp` under its `maxHp`): it begins with that share of what it is built with. */
  hurt?: number;
}

export interface RulesetFightSeed {
  definition: RulesetDefinition;
  seed: number;
  /** `start`: where the story put a party member (2026-10-24), which they do not choose for themselves. */
  party: Array<{ id: string; name: string; start?: CombatStartPlace }>;
  /** Whether the player sets their own down before the first turn (2026-10-24): the game's fights
   *  ask it; a fight built to be read at once (a test, a preview) starts where it was laid. */
  deploy?: boolean;
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
  /** The game's whole party, when it keeps a list the Engine can read: a card with a sheet the setup
   *  left out of `party` joins the fight, unless its member has left the party (`away`) or never
   *  fights (`sitsOut`), each by name. `idFor` is the id a joining member fights under. Left out (a
   *  test, a preview), the fight's party is `party` as it was sent. */
  roster?: { away: string[]; sitsOut: string[]; idFor: (name: string) => string };
  /** Every companion the player does not play themselves is the Engine's from the start (Alyssa
   *  2026-10-26: "companions should default to AI in solo games"). */
  companionsOnTheirOwn?: boolean;
  /** A shared room's players (2026-10-26), by their character's name as a lookup key: whose own
   *  character each party member is. One that is not the host's is never the host's stand-in nor one
   *  of the host's companions. */
  players?: Record<string, DirectedRulesetPlayer>;
  /** Who plays the character of a room player other than the host as the fight begins: that player,
   *  or the Engine. */
  othersPlay?: "manual" | "ai";
  /** Room players not connected as the fight starts, by participant id: theirs fight on their own
   *  (2026-10-27), each taken back with a controller switch once its player is there. */
  absent?: string[];
  /** The stored live sheet state of the whole game. */
  live: RulesetLiveStates | null;
  /** What each party member holds, by name, when the ruleset's sheet reads items. */
  items?: (name: string) => RulesetSheetItem[];
  /** Whose bag each party member's items are in, by name (1.721): null for the player's own. */
  holders?: (name: string) => string | null;
  /** The ruleset's items (1.795), for what its opponents have on them: none read without it. */
  itemBook?: Pick<RulesetItemBook, "entries" | "coins" | "itemOf"> & Partial<Pick<RulesetItemBook, "itemNamed">>;
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
  /** What was set up before the fight (1.462), standing as it begins. */
  standing?: RulesetStandingZone[];
  /** The scene's time of day as the game tracks it (1.291), which sets the light outdoors. */
  time?: string | null;
  /** The game's difficulty, for the ruleset's encounter budget (1.803): invented opponents are brought
   *  down a rung while the fight is over it. `kept` are opponents never moved (those that come back).
   *  Left out (a story's fight, a test), nothing is moved. */
  budget?: { difficulty: GameDifficulty; kept?: string[] };
}

export type RulesetFightSeedResult =
  /** `standIn`: the party member the player plays while their own character is dead (Alyssa 2026-10-26). */
  { ok: true; fight: RulesetFightState; standIn?: string } | { ok: false; error: string };

/**
 * The fight's party: the members the setup sent, then every other card of the game's party with a
 * sheet, in the cards' order (cheap-GM playtest 2026-10-26: combat:init listed one of three heroes,
 * and one fought alone). A member who left the party, or never fights, is said to stay out; one dead
 * on their sheet joins the list and is left out as the dead are. The card a sheetless member will
 * fight as (`standIn`) is theirs, not a second member. Only with a `roster`.
 */
function rulesetFightWholeParty(
  input: RulesetFightSeed,
  builds: ReadonlyMap<string, RulesetSheetBuild>,
  creatures: ReadonlyMap<string, unknown>,
  standIn: string | undefined,
  adjustments: string[],
): RulesetFightSeed["party"] {
  const roster = input.roster;
  if (!roster) return input.party;
  const party = [...input.party];
  const key = normalizeCharacterLookupName;
  const listed = new Set(party.map((member) => key(member.name)));
  const takenBy =
    standIn && party.some((member) => !builds.has(key(member.name)) && !creatures.has(key(member.name)))
      ? key(standIn)
      : undefined;
  const away = new Set(roster.away.map(key));
  const sitsOut = new Set(roster.sitsOut.map(key));
  const ids = new Set(party.map((member) => member.id));
  for (const card of Array.isArray(input.cards) ? (input.cards as Array<{ name?: unknown }>) : []) {
    const name = typeof card?.name === "string" ? card.name.trim() : "";
    const at = key(name);
    if (!name || !builds.has(at) || listed.has(at) || at === takenBy) continue;
    listed.add(at);
    if (away.has(at)) {
      adjustments.push(`${name} has left the party and stays out of the fight.`);
      continue;
    }
    if (sitsOut.has(at)) {
      adjustments.push(`${name} does not fight and stays out of the fight.`);
      continue;
    }
    const base = roster.idFor(name).trim() || `party-${at.replace(/[^a-z0-9]+/g, "-")}`;
    let id = base;
    for (let nth = 2; ids.has(id); nth++) id = `${base}-${nth}`;
    ids.add(id);
    party.push({ id, name });
    if (!rulesetSheetDead(input.definition, builds.get(at)!, input.live?.[at], input.items?.(name)))
      adjustments.push(`${name} was left out of the fight's party and joins it.`);
  }
  return party;
}

/** Words in a strike's name that say nothing of which weapon it is ("Spear Attack" is a spear). */
const RULESET_PLAIN_STRIKE_WORDS = new Set(["attack", "strike", "melee", "ranged", "weapon", "basic", "hit"]);

/** The words a strike's name says its weapon is, each without a plural's s: "Claws" and "Claw" are one. */
function rulesetStrikeWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3)
    .map((word) => word.replace(/s$/, ""))
    .filter((word) => !RULESET_PLAIN_STRIKE_WORDS.has(word));
}

/**
 * A foe asked for as a bestiary creature, as its writer described it (cheap-GM playtest 2026-10-26:
 * spearmen asked for as the SRD Bandit fought with its scimitar and light crossbow). One written with
 * strikes, none of them a weapon the creature has, and not called by the creature's own name, is built
 * at the creature's tier under the strikes it was written with, as the creature's kind. Null keeps it
 * the bestiary's creature.
 */
function rulesetFoeAsWritten(
  bestiary: RulesetCatalogEntriesById,
  opponent: RulesetFightOpponent,
): { opponent: RulesetFightOpponent; creature: string; weapons: string[] } | null {
  if (!opponent.creature) return null;
  const found = findRulesetCreature(bestiary, opponent.creature);
  const creature = found?.entry.creature;
  if (!found || !creature?.tier || creature.sheet) return null;
  const written = (opponent.attacks ?? []).filter(
    (one) => !one.reaction && !one.kind && !one.spell && rulesetStrikeWords(one.name).length > 0,
  );
  if (written.length === 0) return null;
  const own = new Set(
    creature.actions.filter((action) => !action.reaction).flatMap((one) => rulesetStrikeWords(one.name)),
  );
  if (written.some((one) => rulesetStrikeWords(one.name).some((word) => own.has(word)))) return null;
  // Called by the creature's name ("Bandit 2"), it is that creature, whatever it was said to swing.
  const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  if (plain(opponent.name.replace(/\s*#?\d+$/, "")) === plain(found.entry.label)) return null;
  const { creature: _creature, ...rest } = opponent;
  return {
    opponent: {
      ...rest,
      tier: opponent.tier ?? creature.tier,
      ...((opponent.creatureType ?? creature.type) ? { creatureType: opponent.creatureType ?? creature.type } : {}),
    },
    creature: found.entry.label,
    weapons: written.map((one) => one.name),
  };
}

/**
 * An invented opponent's actions, each its writer said lands in an area built as the bestiary's breaths
 * are, and said (laptop playtest 2026-10-26: an invented young red dragon's Rot Breath rolled to hit one
 * hero, every round for five rounds). The same list when none is.
 */
function rulesetWrittenAreas<
  T extends { name: string; damage?: unknown; area?: unknown; save?: unknown; signature?: unknown },
>(
  definition: RulesetDefinition,
  bestiary: RulesetCatalogEntriesById,
  opponent: RulesetFightOpponent,
  actions: T[],
  tierId: string | undefined,
  adjustments: string[],
): T[] {
  const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  let changed = false;
  const built = actions.map((action) => {
    // What its points buy is bought after, from what this leaves.
    if (action.signature) return action;
    const written = opponent.attacks?.find(
      (one) => !one.reaction && !one.kind && plain(one.name) === plain(action.name),
    );
    const said = rulesetWrittenArea({
      name: action.name,
      ...(written?.description ? { description: written.description } : {}),
      ...(written?.area ? { area: true } : {}),
    });
    const area = said ? rulesetWrittenAreaAction(definition, bestiary, action, said, tierId) : null;
    if (!area) return action;
    changed = true;
    adjustments.push(
      `${opponent.name}: "${action.name}" was written as a breath or an area, so it lands in an area against a save and comes back on a recharge.`,
    );
    return area;
  });
  return changed ? built : actions;
}

/** The walk most of a bestiary's creatures have, or none when no creature in it says a speed. */
function rulesetUsualBestiarySpeed(bestiary: RulesetCatalogEntriesById): number | undefined {
  const counts = new Map<number, number>();
  for (const entries of Object.values(bestiary))
    for (const entry of entries) {
      const speed = entry.creature?.speed;
      if (typeof speed === "number" && speed > 0) counts.set(speed, (counts.get(speed) ?? 0) + 1);
    }
  let best: { speed: number; count: number } | undefined;
  for (const [speed, count] of counts) if (!best || count > best.count) best = { speed, count };
  return best?.speed;
}

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
  /** What each bestiary opponent may have on it (1.795), by combatant id. */
  const inventories = new Map<string, NonNullable<RulesetCreature["inventory"]>>();
  /** Invented opponents written as sheets, and the tier each is held to once it is built. */
  const heldToTier = new Map<string, NonNullable<typeof combat.threat>["tiers"][number]>();
  const builds = rulesetSheetBuildsByName(definition, input.cards, input.playerName);
  const creatures = rulesetCardCreaturesByName(input.cards);
  const combatants: RulesetCombatantInput[] = [];
  // With no persona the first character card plays as the player: a member the setup named for a
  // player with no sheet ("User") is that card, where the party does not already hold it.
  const named = new Set(input.party.map((member) => normalizeCharacterLookupName(member.name)));
  const firstCard = input.playerName
    ? undefined
    : (Array.isArray(input.cards) ? (input.cards as Array<{ name?: unknown }>) : [])
        .map((card) => (typeof card.name === "string" ? card.name.trim() : ""))
        .find((name) => name && builds.has(normalizeCharacterLookupName(name)));
  let standIn = firstCard && !named.has(normalizeCharacterLookupName(firstCard)) ? firstCard : undefined;
  const leadKey = normalizeCharacterLookupName(input.playerName ?? firstCard ?? "");
  let deadLead: string | undefined;
  const party = rulesetFightWholeParty(input, builds, creatures, standIn, adjustments);
  // A member the setup invented, with neither a sheet nor a creature, stays out of the fight
  // (2026-10-23 playtest), and the fight's numbers are only ever a sheet's.
  for (const listed of party) {
    let member = listed;
    if (
      standIn &&
      !builds.has(normalizeCharacterLookupName(member.name)) &&
      !creatures.has(normalizeCharacterLookupName(member.name))
    ) {
      adjustments.push(`${member.name} fights as ${standIn}, the character the player plays.`);
      member = { ...member, name: standIn };
      standIn = undefined;
    }
    const key = normalizeCharacterLookupName(member.name);
    const build = builds.get(key);
    // A member who is a bestiary creature (a copy of one, 5e's Simulacrum) fights as that creature.
    const creature = build ? undefined : creatures.get(key);
    if (creature) {
      combatants.push({ id: member.id, name: member.name, side: "party", creature, live: input.live?.[key] ?? {} });
      continue;
    }
    if (!build) {
      adjustments.push(`${member.name} has no ruleset sheet and stays out of the fight.`);
      continue;
    }
    // Nor one dead on their sheet, who neither fights nor counts toward the party's budget (laptop
    // pass 6 2026-10-26: a dead hero placed on the board, down, every blow on him a critical).
    if (rulesetSheetDead(definition, build, input.live?.[key], input.items?.(member.name))) {
      adjustments.push(`${member.name} is dead and stays out of the fight.`);
      if (leadKey && key === leadKey) deadLead = member.name;
      continue;
    }
    combatants.push({
      id: member.id,
      name: member.name,
      side: "party",
      build,
      live: input.live?.[key],
      catalogs: input.partyCatalogs,
      ...(input.items ? { items: input.items(member.name) } : {}),
      ...(input.holders ? { holder: input.holders(member.name) } : {}),
    });
  }
  // A fight with nobody on the party's side has nobody to play it for (Kenhito prep K3: it failed
  // later on a raw validation error), so it is refused here, in words.
  if (input.party.length === 0) return { ok: false, error: "This fight has nobody on the party's side." };
  if (!combatants.some((one) => one.side === "party")) {
    if (adjustments.some((line) => line.endsWith(" is dead and stays out of the fight.")))
      return { ok: false, error: "Everyone in this party who could fight is dead, so there is nobody to fight it." };
    return { ok: false, error: "Nobody in this party has a ruleset sheet, so this fight cannot read their numbers." };
  }

  // An opponent built off the threat scale, or proposed without one, gets the walk most of the
  // bestiary has: with none it could never leave its cell, and readied all fight (laptop playtest
  // 2026-10-24: tier-built ogres and orcs, eleven squares off on a large board).
  const usualSpeed = rulesetUsualBestiarySpeed(input.bestiary);
  const withUsualSpeed = <T extends RulesetStatBlock>(block: T): T =>
    block.speed !== undefined || block.speeds || usualSpeed === undefined ? block : { ...block, speed: usualSpeed };
  // What an invented one is: what the Game Master said, over any type its proposed block was written
  // with (laptop 2026-10-26: husks described as undead fought as humanoids), else what a character is
  // (laptop party A: Hold Person had nobody to hold among a cult it made up).
  const kinds = combat.creatureTypes;
  const typed = <T extends RulesetStatBlock>(block: T, said?: string): T => {
    if (!kinds) return block;
    const named = rulesetSaidCreatureType(definition, said);
    if (named !== undefined) return block.type === named ? block : { ...block, type: named };
    if (block.type !== undefined) return block;
    const type = kindNamedIn(opponentName) ?? kinds.default;
    return type === undefined ? block : { ...block, type };
  };
  // Else the type of the bestiary creature its name says it is ("Rotting Zombie 2" is a Zombie).
  let opponentName = "";
  const kindNamedIn = (name: string): string | undefined => {
    const words = ` ${name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
    let best: { length: number; type: string } | undefined;
    for (const entries of Object.values(input.bestiary))
      for (const entry of entries) {
        const label = entry.label
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim();
        const type = entry.creature?.type;
        // A one-word name also fits a word that ends in it, as a boss borrows its legendary actions
        // (laptop 2026-10-26: an Archlich with a Lich's was a Humanoid).
        const fits =
          words.includes(` ${label} `) ||
          (label.length >= 4 && !label.includes(" ") && words.split(" ").some((word) => word.endsWith(label)));
        if (type && label && fits && label.length > (best?.length ?? 0)) best = { length: label.length, type };
      }
    return best?.type;
  };
  // The encounter budget (1.803): an invented opponent is brought down a rung at a time, the one worth
  // the most first, while the fight is worth more than the party's budget at the game's difficulty (one
  // step higher with a boss in it). A bestiary creature is counted as it is (laptop party B, 2026-10-25:
  // four CR 3 winter wolves and an invented CR 8 against a level 5 party, wiped in seven rounds).
  const budget = input.budget
    ? rulesetEncounterBudget(
        definition,
        combatants.flatMap((one) =>
          one.side === "party" && "build" in one && one.build && combat.threat?.budget
            ? [rulesetBudgetLevel(combat.threat.budget, one.build.fields)]
            : [],
        ),
        input.budget.difficulty,
      )
    : null;
  // A foe asked for as a bestiary creature fights with the weapons it was described with, at that
  // creature's tier, where the creature has none of them (cheap-GM playtest 2026-10-26: spearmen fought
  // as SRD Bandits with crossbows).
  let enemies = input.enemies.map((opponent) => {
    const written = combat.threat?.tiers?.length ? rulesetFoeAsWritten(input.bestiary, opponent) : null;
    if (!written) return opponent;
    const tier = combat.threat!.tiers.find((one) => one.id === written.opponent.tier)?.label ?? written.opponent.tier;
    adjustments.push(
      `${opponent.name} was written with ${written.weapons.join(", ")}, which the ${written.creature} of the bestiary has none of, so it was built at ${tier} instead.`,
    );
    return written.opponent;
  });
  // An opponent in no bestiary and given no tier is never built at the scale's bottom (laptop pass 11
  // 2026-10-26: "Giant Crocodile [cr_5]" missed, then fought as a 7-health CR 0): the tier a tag beside
  // its name says, else the highest tier written for anyone else in the fight (cloud re-test 2026-10-26:
  // two untiered crocodiles outranked their CR 2 chief), else the top of the scale, for the budget below
  // to bring down to what this party can face.
  const untiered = new Set<string>();
  const scaleIds = combat.threat?.tiers?.map((tier) => tier.id) ?? [];
  const writtenTiers = enemies.flatMap((opponent) => {
    const proposedTier = (opponent.proposed as { tier?: unknown } | undefined)?.tier;
    const own =
      opponent.tier ??
      (typeof proposedTier === "string" ? proposedTier : undefined) ??
      findRulesetCreature(input.bestiary, opponent.creature ?? opponent.name)?.entry.creature?.tier;
    const at = own ? scaleIds.indexOf(own) : -1;
    return at >= 0 ? [at] : [];
  });
  const ceiling = scaleIds[writtenTiers.length ? Math.max(...writtenTiers) : scaleIds.length - 1];
  if (scaleIds.length > 0)
    enemies = enemies.map((opponent) => {
      const proposedTier = (opponent.proposed as { tier?: unknown } | undefined)?.tier;
      if (opponent.tier || typeof proposedTier === "string") return opponent;
      if (findRulesetCreature(input.bestiary, opponent.creature ?? opponent.name)) return opponent;
      if (opponent.creature && findRulesetCreature(input.bestiary, opponent.name)) return opponent;
      const tagged = [opponent.creature, opponent.name]
        .flatMap((text) => [...(text ?? "").matchAll(/\[([^\]]+)\]/gu)].map((match) => match[1]!.trim()))
        .find((tag) => scaleIds.includes(tag));
      if (tagged) return { ...opponent, tier: tagged };
      if (!budget || !input.budget) return opponent;
      untiered.add(opponent.id);
      return { ...opponent, tier: ceiling! };
    });
  // A boss has no more legendary points than the bestiary gives anything of its tier or below, and
  // none where it gives nothing that low any (room playtest 2026-10-30: an invented CR 1/2 elemental
  // with legendary actions 3 of 3; Alyssa: balance is strict, or the CR system means nothing). Read
  // again after the budget, for a foe it brought down. A bestiary with no legendary creature at all
  // says nothing about where they start, and holds nothing.
  const pointsCaps = rulesetTierPointCaps(definition, input.bestiary);
  const holdBossPoints = (list: typeof enemies) =>
    list.map((opponent) => {
      if (!pointsCaps) return opponent;
      const proposed =
        opponent.proposed && typeof opponent.proposed === "object"
          ? (opponent.proposed as { tier?: unknown; signaturePoints?: unknown; actions?: unknown })
          : undefined;
      const own = typeof proposed?.signaturePoints === "number" ? proposed.signaturePoints : 0;
      const asked = Math.max(opponent.points ?? 0, own);
      if (asked <= 0) return opponent;
      const found = findRulesetCreature(input.bestiary, opponent.creature ?? opponent.name);
      // A bestiary creature is built at its own tier, whatever tier was written beside it.
      const tierId =
        found?.entry.creature?.tier ??
        opponent.tier ??
        (typeof proposed?.tier === "string" ? proposed.tier : undefined);
      // A bestiary creature's own legendary actions are its stat block's, and stay.
      if (found && (found.entry.creature?.signaturePoints ?? 0) > 0 && !opponent.boss) return opponent;
      const cap = tierId ? (pointsCaps.get(tierId) ?? 0) : 0;
      if (asked <= cap) return opponent;
      const label = combat.threat?.tiers.find((tier) => tier.id === tierId)?.label ?? tierId ?? "its tier";
      adjustments.push(
        cap > 0
          ? `${opponent.name} may have at most ${cap} legendary points at ${label}, what this ruleset's creatures of that tier have, so it was given ${cap}, not ${asked}.`
          : `${opponent.name} has no legendary actions at ${label}: no creature of this ruleset that low has any.`,
      );
      const held =
        proposed && own > cap
          ? {
              proposed: {
                ...proposed,
                signaturePoints: cap,
                ...(cap === 0 && Array.isArray(proposed.actions)
                  ? {
                      actions: (proposed.actions as Array<{ signature?: unknown }>).filter(
                        (action) => !action || typeof action !== "object" || !action.signature,
                      ),
                    }
                  : {}),
              },
            }
          : {};
      return {
        ...opponent,
        ...held,
        ...(opponent.points !== undefined ? { points: Math.min(opponent.points, cap) } : {}),
      };
    });
  enemies = holdBossPoints(enemies);
  if (budget && input.budget) {
    const keep = new Set(input.budget.kept ?? []);
    const foes = enemies.map((opponent) => {
      const found = opponent.creature
        ? findRulesetCreature(input.bestiary, opponent.creature)
        : findRulesetCreature(input.bestiary, opponent.name);
      // A bestiary creature made a boss with points it has no legendary actions of its own for buys
      // some with them (see below), and those count as an invented boss's do (Alyssa 2026-10-30: a CR
      // 1/2 elemental with legendary actions 3/3; balance is strict, or the CR system means nothing).
      if (found) {
        const bought =
          opponent.boss && !(found.entry.creature?.actions ?? []).some((action) => action.signature)
            ? Math.min(6, opponent.points ?? 0)
            : 0;
        return { tier: found.entry.creature?.tier, kept: true, ...(bought > 0 ? { times: 1 + bought / 3 } : {}) };
      }
      const proposedTier = (opponent.proposed as { tier?: unknown } | undefined)?.tier;
      // An invented boss's legendary points are turns its tier does not count (laptop interim
      // 2026-10-26: an invented CR 8 lich with 3 points, "4100, within High 4400", wiped a party in
      // three rounds): each third of them counts it once more, up to three times. A bestiary's tier counts
      // its own.
      const signature = (opponent.proposed as { signaturePoints?: unknown } | undefined)?.signaturePoints;
      const points = opponent.boss
        ? Math.min(6, opponent.points ?? (typeof signature === "number" && signature > 0 ? signature : 0))
        : 0;
      return {
        tier: opponent.tier ?? (typeof proposedTier === "string" ? proposedTier : undefined),
        kept: keep.has(opponent.id),
        ...(points > 0 ? { times: 1 + points / 3 } : {}),
      };
    });
    const bossed = enemies.some((opponent) => opponent.boss);
    const allowed = bossed ? budget.bossWorth : budget.worth;
    const stepLabel = (bossed ? budget.bossStep : budget.step).label;
    const moved = rulesetBudgetedTiers(definition, foes, allowed, budget.members);
    const scale = combat.threat?.tiers ?? [];
    const label = (id: string | undefined) => scale.find((tier) => tier.id === id)?.label ?? id;
    enemies = enemies.map((opponent, index) => {
      const tier = moved.tiers[index];
      if (untiered.has(opponent.id)) {
        adjustments.push(
          `${opponent.name} was given no tier, so it was built at ${label(tier ?? foes[index]!.tier)}, what this party's ${stepLabel} budget allows.`,
        );
        if (tier === foes[index]!.tier || tier === undefined) return opponent;
        return { ...opponent, tier };
      }
      if (tier === foes[index]!.tier || tier === undefined) return opponent;
      adjustments.push(
        `${opponent.name} was brought down from ${label(foes[index]!.tier)} to ${label(tier)}: the fight was worth more than this party's ${stepLabel} budget.`,
      );
      const proposed =
        opponent.proposed && typeof opponent.proposed === "object" ? { ...opponent.proposed, tier } : opponent.proposed;
      return { ...opponent, tier, ...(proposed !== undefined ? { proposed } : {}) };
    });
    if (moved.worth.after > allowed)
      adjustments.push(
        `This fight is worth ${moved.worth.after}, more than this party's ${stepLabel} budget of ${allowed}, with nothing left to bring down.`,
      );
    // Said when nothing was brought down too, so a fight left as it was reads as weighed (laptop
    // playtest 2026-10-25: three invented CR 3 foes, no word of the budget anywhere), and after a step
    // down, what it is worth now (laptop level-4 pass 2026-10-26: a boss brought from CR 5 to 3, and no
    // word of what the fight came to).
    else
      adjustments.push(
        `This fight is worth ${moved.worth.after}, within this party's ${stepLabel} budget of ${allowed}.`,
      );
  }
  if (budget && input.budget) enemies = holdBossPoints(enemies);
  // A tier's tag beside a name is said without it (cloud re-test 2026-10-26: "Hollow Sentinel [cr_5]").
  const untagged = (text: string) => text.replace(/\s*\[[^\]]*\]\s*/gu, " ").trim() || text;
  for (const opponent of enemies) {
    opponentName = opponent.name;
    // By the reference the Game Master named, then by the opponent's own name, and no further: a
    // fight built on a near miss is worse than one the Engine says it could not build.
    const named = opponent.creature ? findRulesetCreature(input.bestiary, opponent.creature) : null;
    const found = named ?? findRulesetCreature(input.bestiary, opponent.name);
    if (opponent.creature && !named) {
      adjustments.push(
        found
          ? `No bestiary holds "${untagged(opponent.creature)}", so ${opponent.name} was looked up by name.`
          : `No bestiary of this ruleset holds "${untagged(opponent.creature)}".`,
      );
    }
    if (found) {
      // A bestiary creature made a boss with points it has no legendary actions to spend on buys its own
      // with them, as an invented boss does (cloud re-test 2026-10-26: a bestiary ogre and a young red
      // dragon marked boss fought with none).
      const own = found.entry.creature?.actions ?? [];
      const legendary =
        opponent.boss && (opponent.points ?? 0) > 0 && !own.some((action) => action.signature)
          ? rulesetUnpricedLegendary(definition, input.bestiary, {
              name: opponent.name,
              points: Math.min(20, opponent.points!),
              budget: rulesetStandardBudget(combat),
              casts: !!found.entry.creature?.spellcasting,
              actions: own,
            })
          : null;
      // One with its own says what they are, as an invented boss's are said (laptop 2026-10-26: a Lich
      // with 3 points and no word of what they buy).
      const signature = own.filter((action) => action.signature && !action.lair);
      const ownPoints = found.entry.creature?.signaturePoints ?? 0;
      if (!legendary && signature.length > 0 && ownPoints > 0)
        adjustments.push(
          `${opponent.name} may spend ${ownPoints} points between turns on ${signature.map((one) => one.name).join(", ")}.`,
        );
      if (legendary?.actions.length) {
        adjustments.push(
          legendary.from
            ? `${opponent.name} had nothing priced out of its points, so it has the legendary actions of the ${legendary.from}.`
            : `${opponent.name} had nothing priced out of its points, so it buys its own actions with them.`,
        );
        adjustments.push(
          `${opponent.name} may spend ${Math.min(20, opponent.points!)} points between turns on ${legendary.actions.map((one) => one.name).join(", ")}.`,
        );
      }
      // A creature that only stands in for what the Game Master said it is fights as that (laptop
      // 2026-10-26: a "skeletal husk" built on a humanoid was held by Hold Person and never turned).
      const stated = kinds ? rulesetSaidCreatureType(definition, opponent.creatureType) : undefined;
      const retyped = stated !== undefined && stated !== found.entry.creature?.type ? stated : undefined;
      if (retyped)
        adjustments.push(
          `${opponent.name} was said to be ${kinds!.types.find((one) => one.id === retyped)?.label ?? retyped}, so it fights as one, on the numbers of the ${found.entry.label}.`,
        );
      combatants.push({
        id: opponent.id,
        name: opponent.name,
        side: "enemy",
        creature: { catalogId: found.catalogId, entryId: found.entry.id },
        ...(opponent.adjust || legendary?.actions.length || retyped
          ? {
              adjust: {
                ...(retyped ? { type: retyped } : {}),
                ...(legendary?.actions.length
                  ? { legendary: { points: Math.min(20, opponent.points!), actions: legendary.actions as never } }
                  : {}),
                ...(opponent.adjust?.legendaryResistance !== undefined
                  ? { legendaryResistance: opponent.adjust.legendaryResistance }
                  : {}),
                ...(opponent.adjust?.maxHp !== undefined ? { health: opponent.adjust.maxHp } : {}),
                ...(opponent.adjust?.calls?.length
                  ? { calls: opponent.adjust.calls.map((call) => ({ ...call })) }
                  : {}),
              },
            }
          : {}),
      });
      if (found.entry.creature?.loot) lootTables[opponent.id] = found.entry.creature.loot;
      if (found.entry.creature?.inventory) inventories.set(opponent.id, found.entry.creature.inventory);
      continue;
    }
    let proposed = opponent.proposed === undefined ? null : rulesetProposedCreatureSchema.safeParse(opponent.proposed);
    // One written with no sheet and spells or features by name beside its attacks ("Cure Wounds",
    // "Wild Shape (Bear)") is given a sheet of those entries, and built as an invented caster is: the
    // class that pays for them, its tier's numbers, its attacks as written (laptop pass 5 2026-10-26:
    // a Cult Healer, Druid and Enchanter built from a tier's numbers alone cast nothing). What this
    // ruleset has no entry for is said, and left off.
    // So is one written with numbers and no sheet (laptop pass 6 2026-10-26: an Archmage given health,
    // defense and saves, with Ray of Frost, Chill Touch and Blight as its spells, only swung its staff),
    // which keeps the numbers it was written with.
    const numbersOnly = proposed?.success && !proposed.data.sheet ? proposed.data : undefined;
    if ((!proposed || numbersOnly) && definition.combat?.threat?.tiers?.length) {
      const named = (opponent.attacks ?? [])
        .filter((attack) => (attack.kind || attack.spell) && !attack.reaction)
        .map((one) => one.name);
      let sheet: RulesetSheetBuild = rulesetSheetBuildSchema.parse({});
      // A name its points buy below, lent by a creature of this ruleset, is given there (cloud re-test
      // 2026-10-26: "no entry called Frightening Gaze" said beside "may spend points on ... Frightening Gaze").
      const boughtLater = (name: string) =>
        !!opponent.boss &&
        (opponent.points ?? 0) > 0 &&
        (opponent.attacks ?? []).some(
          (one) => one.name === name && !one.reaction && !one.spell && (one.legendary ?? 0) > 0,
        ) &&
        !!rulesetBestiaryActionNamed(definition, input.bestiary, name);
      const missing: string[] = [];
      for (const name of named) {
        const plain = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
        const tries = plain && plain !== name ? [name, plain] : [name];
        const found = tries
          .map((one) => rulesetProposedSheetWithEntries(definition, sheet, [one], input.bestiary))
          .find((one) => one.missing.length === 0);
        if (found) sheet = found.sheet;
        else missing.push(name);
      }
      if (Object.values(sheet.lists ?? {}).some((rows) => rows.length > 0)) {
        // A spell it has no entry for is the writer's own word for a strike, as its weapons are.
        const struck = (one: NonNullable<RulesetFightOpponent["attacks"]>[number]) =>
          !one.reaction && !one.kind && (!one.spell || missing.includes(one.name));
        const weapons = (opponent.attacks ?? []).filter(struck).map((one) => one.name);
        const unknown = missing.filter((name) => !weapons.includes(name));
        const given = named.filter((name) => !missing.includes(name));
        if (numbersOnly) {
          // Its strikes are the ones written in its numbers, so a spell with no entry is no strike here.
          for (const name of missing.filter((one) => !boughtLater(one)))
            adjustments.push(`${opponent.name}: this ruleset has no entry called "${name}", so it was not given.`);
          adjustments.push(`${opponent.name} was given a sheet for ${given.join(", ")}.`);
          // A spell also written among its numbers is cast from its entry, with that entry's save and
          // area, not thrown as the attack written beside it (laptop pass 7 2026-10-26: an Archlich's
          // Cone of Cold rolled to hit).
          const cast = new Set(
            given.flatMap((name) =>
              [name, name.replace(/\s*\([^)]*\)\s*$/, "").trim()].map((one) => one.toLowerCase()),
            ),
          );
          const kept = numbersOnly.actions.filter(
            (action) => action.signature || !cast.has(action.name.trim().toLowerCase()),
          );
          const actions = kept.length > 0 ? kept : numbersOnly.actions;
          proposed = { success: true, data: { ...numbersOnly, actions, sheet } } as unknown as typeof proposed;
        }
        const tiered = numbersOnly ? null : rulesetTierStatBlock(definition, opponent.tier, weapons);
        if (tiered) {
          for (const name of unknown.filter((one) => !boughtLater(one)))
            adjustments.push(`${opponent.name}: this ruleset has no entry called "${name}", so it was not given.`);
          adjustments.push(`${opponent.name} was given a sheet for ${given.join(", ")}, at ${tiered.tier.label}.`);
          proposed = {
            success: true,
            data: { tier: tiered.tier.id, actions: tiered.block.actions, sheet },
          } as unknown as typeof proposed;
        }
      }
    }
    // A boss written with no numbers is built from its tier's here, so what its points buy goes on the
    // same block (laptop level-4 pass 2026-10-26: a Big Grakka given 3 points had nothing to spend them on).
    // So is one whose proposed block cannot be read (cheap-GM playtest 2026-10-26: a boss "given 3 points
    // but nothing priced out of them" was built from its tier further down, with nothing to buy).
    if (!proposed?.success && opponent.boss && (opponent.points ?? 0) > 0) {
      if (proposed)
        adjustments.push(`The proposed stat block for ${opponent.name} could not be read, so its tier was used.`);
      const built = rulesetTierStatBlock(
        definition,
        opponent.tier,
        (opponent.attacks ?? []).filter((one) => !one.reaction && !one.kind).map((one) => one.name),
      );
      if (built) {
        if (opponent.tier && built.tier.id !== opponent.tier)
          adjustments.push(
            `The tier "${opponent.tier}" is not on this ruleset's scale, so ${built.tier.label} was used.`,
          );
        adjustments.push(`${opponent.name} was built from the numbers of ${built.tier.label}.`);
        const { health, defense, initiativeModifier, actions } = built.block;
        proposed = {
          success: true,
          data: { tier: built.tier.id, health, defense, initiativeModifier, actions },
        } as unknown as typeof proposed;
      }
    }
    // What its writer said lands in an area is a save against one, back on a recharge, before anything
    // is bought with its points.
    if (proposed?.success) {
      const actions = rulesetWrittenAreas(
        definition,
        input.bestiary,
        opponent,
        proposed.data.actions,
        opponent.tier ?? proposed.data.tier,
        adjustments,
      );
      if (actions !== proposed.data.actions)
        proposed = { success: true, data: { ...proposed.data, actions } } as unknown as typeof proposed;
    }
    // What a boss's writer gave a price out of its points is bought with them between turns, as a
    // bestiary's legendary actions are (laptop pass 6 2026-10-26: a legendary Archmage's Ray of Frost
    // and Chill Touch at a cost of 1 were never cast): its spells as a lich's Cantrip, at the least any of
    // them was priced, and a strike as itself. Never a spell of a slot between turns (laptop Archlich
    // fight 2026-10-26: a CR 4 boss cast Finger of Death and upcast Fireballs as legendary actions).
    const pricedOut = (opponent.attacks ?? []).filter((one) => !one.reaction && (one.legendary ?? 0) > 0);
    if (proposed?.success && opponent.boss && (opponent.points ?? 0) > 0 && pricedOut.length > 0) {
      const points = Math.min(20, opponent.points!);
      const data = proposed.data;
      type Bought = (typeof data.actions)[number];
      const bought: Bought[] = [];
      const cost = (one: (typeof pricedOut)[number]) => Math.min(points, one.legendary!);
      // A spell only where it is one: a "debuff" its writer named is no spell (laptop level-4 pass
      // 2026-10-26: Varkas the Wyvern-Knight's Terrifying Glare was bought as a Cantrip).
      const spells = pricedOut.filter((one) => one.spell);
      if (spells.length > 0)
        bought.push({
          id: "legendary_cantrip",
          name: "Cantrip",
          budget: rulesetStandardBudget(combat),
          casting: { cantripsOnly: true },
          signature: { cost: Math.min(...spells.map(cost)) },
        } as Bought);
      // A strike or a skill as itself: its own action of that name, else a creature's of this ruleset by
      // that name, else (a strike) its best attack under that name (laptop level-4 pass 2026-10-26:
      // Varkas's Lance Thrust and Wing Buffet, each priced, were never bought).
      const strikes = data.actions.filter(
        (action) =>
          !action.signature &&
          !action.reaction &&
          !action.casting &&
          (action.toHit !== undefined || action.autoHit || !!action.damage),
      );
      const best = strikes.reduce<(typeof strikes)[number] | undefined>(
        (top, action) => (!top || rulesetActionAverage(action) > rulesetActionAverage(top) ? action : top),
        undefined,
      );
      const slug = (name: string) =>
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || "strike";
      for (const one of pricedOut.filter((attack) => !spells.includes(attack))) {
        const own = data.actions.find((action) => action.name.toLowerCase() === one.name.toLowerCase());
        const lent = own ? null : rulesetBestiaryActionNamed(definition, input.bestiary, one.name);
        // A boss built on a sheet strikes with the sheet's weapons, none of them an action to buy: then a
        // strike of its tier's numbers, under the name its writer gave it.
        const strike =
          own || one.kind
            ? null
            : best
              ? { ...best, name: one.name }
              : rulesetTierStatBlock(definition, opponent.tier ?? data.tier, [one.name])?.block.actions[0];
        const made = own && !own.signature ? own : lent ? { ...lent, name: one.name } : (strike ?? null);
        if (!made) {
          adjustments.push(`${opponent.name}: this ruleset has nothing called "${one.name}" to buy with its points.`);
          continue;
        }
        const id = `legendary_${own ? own.id : slug(one.name)}`;
        if (bought.some((action) => action.id === id) || data.actions.some((action) => action.id === id)) continue;
        bought.push({ ...structuredClone(made), id, signature: { cost: cost(one) } } as Bought);
      }
      if (bought.length > 0) {
        proposed = {
          success: true,
          data: { ...data, signaturePoints: data.signaturePoints ?? points, actions: [...data.actions, ...bought] },
        } as unknown as typeof proposed;
        adjustments.push(
          `${opponent.name} may spend ${points} points between turns on ${bought.map((one) => one.name).join(", ")}.`,
        );
      }
    }
    // A boss given points and nothing priced out of them still buys something with them (laptop level-4
    // pass 2026-10-26: a Lich Morrigast asked for as the SRD lich, a Pale Master and a Big Grakka each
    // fought with none): the legendary actions of the creature its name names, else its own.
    if (
      proposed?.success &&
      opponent.boss &&
      (opponent.points ?? 0) > 0 &&
      !proposed.data.actions.some((action) => action.signature)
    ) {
      const points = Math.min(20, opponent.points!);
      const data = proposed.data;
      const casts =
        !!data.spellcasting ||
        (opponent.attacks ?? []).some((one) => one.spell) ||
        Object.values(data.sheet?.lists ?? {}).some((rows) => rows.length > 0);
      // A boss built on a sheet has no strike of its own among its actions: its tier's, to buy.
      const strikes = data.actions.some(
        (action) => !action.signature && !action.reaction && (action.toHit !== undefined || !!action.damage),
      );
      const tierStrikes = strikes
        ? []
        : (rulesetTierStatBlock(
            definition,
            opponent.tier ?? data.tier,
            (opponent.attacks ?? []).filter((one) => !one.reaction && !one.kind && !one.spell).map((one) => one.name),
          )?.block.actions ?? []);
      const unpriced = rulesetUnpricedLegendary(definition, input.bestiary, {
        name: opponent.name,
        points,
        budget: rulesetStandardBudget(combat),
        casts,
        actions: [...data.actions, ...(tierStrikes as unknown as typeof data.actions)],
      });
      if (unpriced.actions.length > 0) {
        proposed = {
          success: true,
          data: {
            ...data,
            signaturePoints: data.signaturePoints ?? points,
            actions: [...data.actions, ...unpriced.actions],
          },
        } as unknown as typeof proposed;
        adjustments.push(
          unpriced.from
            ? `${opponent.name} had nothing priced out of its points, so it has the legendary actions of the ${unpriced.from}.`
            : `${opponent.name} had nothing priced out of its points, so it buys its own actions with them.`,
        );
        adjustments.push(
          `${opponent.name} may spend ${points} points between turns on ${unpriced.actions.map((one) => one.name).join(", ")}.`,
        );
      }
    }
    // A boss given points and nothing to spend them on is said to have no legendary actions, so a
    // fight that has none reads as weighed (laptop pass 7 2026-10-26: an Archlich brought down from CR 17
    // to CR 4 fought without them, and nothing said why).
    if (
      opponent.boss &&
      (opponent.points ?? 0) > 0 &&
      !(proposed?.success && proposed.data.actions.some((action) => action.signature))
    )
      adjustments.push(
        `${opponent.name} was given ${opponent.points} points but nothing priced out of them, so it has no legendary actions.`,
      );
    // An invented one's reactions, written as the Engine's own attacks (laptop playtest 2026-10-25: a
    // duelist's "Parry" never fired), are each the reaction this ruleset's bestiary has by that name;
    // one it has nowhere is said, since nothing in the fight could take it.
    // Put on its sheet already as the entry of that name (a Counterspell that is a spell here).
    const onSheet = new Set<string>();
    const withReactions = <T extends RulesetStatBlock>(block: T): T => {
      const has = new Set(block.actions.flatMap((one) => [one.id, one.name.toLowerCase()]));
      const lent: RulesetStatBlockAction[] = [];
      const cast: string[] = [];
      for (const attack of opponent.attacks ?? []) {
        if ((!attack.reaction && !attack.kind) || has.has(attack.name.toLowerCase())) continue;
        const reaction = rulesetBestiaryReaction(definition, input.bestiary, attack.name);
        if (!reaction || has.has(reaction.id)) {
          if (reaction || !attack.reaction || onSheet.has(attack.name.toLowerCase())) continue;
          // One this ruleset has as an entry that answers (a Counterspell that is a spell here),
          // on a block with no sheet to write it on: cast as its own, once this fight (laptop
          // playtest 2026-10-25: an invented Cult Mage's Counterspell never countered).
          // Its sheet's own when it could pay for it there; one it could not (laptop playtest
          // 2026-10-25: a Cult Mage's sheet with no slots "held Counterspell, but could not pay for
          // it") is left off the sheet, and comes here.
          const entry = rulesetAnsweringEntryRef(input.bestiary, attack.name);
          if (entry && !cast.includes(entry)) {
            cast.push(entry);
            has.add(attack.name.toLowerCase());
            adjustments.push(
              `${opponent.name}: "${attack.name}" is this ruleset's own, so it may be cast once this fight.`,
            );
          } else if (!entry)
            adjustments.push(`${opponent.name}: this ruleset has no reaction called "${attack.name}".`);
          continue;
        }
        has.add(reaction.id).add(attack.name.toLowerCase());
        lent.push(reaction);
      }
      if (lent.length === 0 && cast.length === 0) return block;
      const casting = block.spellcasting;
      return {
        ...block,
        actions: [...block.actions, ...lent],
        ...(cast.length > 0
          ? {
              spellcasting: {
                ...casting,
                spells: [
                  ...(casting?.spells ?? []),
                  ...cast
                    .filter((ref) => !casting?.spells.some((spell) => spell.entry === ref))
                    .map((ref) => ({ entry: ref, uses: { per: "encounter" as const, count: 1 } })),
                ],
              },
            }
          : {}),
      };
    };
    // A creature invented for this fight in the ruleset's own terms: a mage with slots and spells.
    // Read leniently, held to its tier the way a plain invention is, and held again once it is built.
    if (proposed?.success && proposed.data.sheet) {
      const said = (line: string) => adjustments.push(`${opponent.name}: ${line}`);
      const beside = RULESET_PROPOSED_SHEET_REPLACES.filter(
        (key) => (opponent.proposed as Record<string, unknown> | undefined)?.[key] !== undefined,
      );
      if (beside.length > 0)
        said(`its sheet says its ${beside.join(", ")}, so the numbers written beside it were not used.`);
      // A reaction its writer named that this ruleset has as one of its entries rather than a
      // bestiary's (laptop playtest 2026-10-25: a cult mage's Counterspell, a spell in the SRD, never
      // countered) goes on its sheet as that entry, which the fight then casts as it casts any.
      const reactionNames = (opponent.attacks ?? [])
        .filter((attack) => attack.reaction && !rulesetBestiaryReaction(definition, input.bestiary, attack.name))
        .map((attack) => attack.name);
      // So does every other attack its writer named that this ruleset has as one of its entries (laptop
      // playtest 2026-10-25: a cult priest's Mace and a druid's Quarterstaff, written beside its sheet
      // rather than in it, which it then fought without). A name it has nowhere is the writer's own
      // word for one of the sheet's attacks.
      const attackNames = (opponent.attacks ?? []).filter((attack) => !attack.reaction).map((attack) => attack.name);
      const armed = rulesetProposedSheetWithEntries(definition, proposed.data.sheet, attackNames, input.bestiary).sheet;
      const placed = rulesetProposedSheetWithEntries(definition, armed, reactionNames, input.bestiary);
      const trial = readProposedRulesetSheet(definition, placed.sheet, input.bestiary).sheet;
      // Whether a fresh sheet could pay for it, at its own price or out of a bigger pool of the family.
      const paysWith = (name: string, pool?: string) => {
        const plan = planRulesetUse(definition, trial, {}, input.bestiary, {
          op: "use",
          name,
          ...(pool ? { pool } : {}),
        });
        if (!plan.ok) return false;
        let live: unknown = {};
        for (const step of plan.steps) {
          const result = applyRulesetSheetOp(definition, trial, live, step.op);
          if (!result.ok) return false;
          live = result.live;
        }
        return true;
      };
      const pays = (name: string) =>
        paysWith(name) ||
        definition.sheet.live.pools.some((pool) => pool.group !== undefined && paysWith(name, pool.id));
      const unpaid = reactionNames.filter((name) => !placed.missing.includes(name) && !pays(name));
      const named =
        unpaid.length > 0
          ? rulesetProposedSheetWithEntries(
              definition,
              armed,
              reactionNames.filter((name) => !unpaid.includes(name)),
              input.bestiary,
            )
          : placed;
      for (const name of reactionNames)
        if (!named.missing.includes(name) && !unpaid.includes(name)) onSheet.add(name.toLowerCase());
      const read = readProposedRulesetSheet(definition, named.sheet, input.bestiary);
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
      // Every invented caster casts only what its sheet can pay for, and keeps a few spells for its one
      // role; a legendary one (a boss with legendary actions or Legendary Resistance) keeps them all.
      const legendary =
        opponent.boss &&
        (proposed.data.signaturePoints !== undefined || proposed.data.legendaryResistance !== undefined);
      const tiers = combat.threat?.tiers ?? [];
      const wanted = opponent.tier ?? proposed.data.tier;
      const tier = tiers.find((entry) => entry.id === wanted) ?? tiers[0];
      // Held to its tier's damage first, so no class level is raised to pay for a spell that goes.
      if (tier) {
        const damage = holdRulesetCasterSpellDamage(sheet, input.bestiary, tier);
        damage.adjusted.forEach(said);
        sheet = damage.sheet;
      }
      // Sent with no pools its spells are paid out of (no class level), it is given the one that pays.
      const pooled = raiseRulesetCasterPools(definition, sheet, input.bestiary);
      pooled.adjusted.forEach(said);
      sheet = pooled.sheet;
      const capped = capRulesetCasterSheet(
        definition,
        sheet,
        input.bestiary,
        legendary ? Number.POSITIVE_INFINITY : RULESET_INVENTED_CASTER_MOST,
      );
      capped.adjusted.forEach(said);
      sheet = capped.sheet;
      // Written with no scores, the ability it casts with is raised to its tier (2026-10-25).
      if (tier) {
        const raised = raiseRulesetSheetAbilities(definition, sheet, tier);
        raised.adjusted.forEach(said);
        sheet = raised.sheet;
      }
      const held = tier
        ? holdRulesetSheetHealth(
            definition,
            sheet,
            tier,
            typeof proposed.data.health === "number" ? proposed.data.health : undefined,
          )
        : { sheet, adjusted: [] };
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
        block: typed(
          withReactions({ ...extras, sheet: held.sheet, ...(tier ? { tier: tier.id } : {}) }),
          opponent.creatureType,
        ),
      });
      if (tier) heldToTier.set(opponent.id, tier);
      continue;
    }
    if (proposed?.success) {
      const block = rulesetProposedStatBlock(definition, proposed.data);
      if (block) {
        const clamped = clampRulesetStatBlock(definition, block, opponent.tier ?? proposed.data.tier);
        for (const line of clamped.adjusted) adjustments.push(`${opponent.name}: ${line}`);
        combatants.push({
          id: opponent.id,
          name: opponent.name,
          side: "enemy",
          block: typed(withUsualSpeed(withReactions(clamped.block)), opponent.creatureType),
        });
        continue;
      }
    }
    if (proposed && !proposed.success) {
      adjustments.push(`The proposed stat block for ${opponent.name} could not be read, so its tier was used.`);
    }
    const built = rulesetTierStatBlock(
      definition,
      opponent.tier,
      (opponent.attacks ?? []).filter((one) => !one.reaction && !one.kind).map((one) => one.name),
    );
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
    const actions = rulesetWrittenAreas(
      definition,
      input.bestiary,
      opponent,
      built.block.actions,
      built.tier.id,
      adjustments,
    );
    combatants.push({
      id: opponent.id,
      name: opponent.name,
      side: "enemy",
      block: typed(withUsualSpeed(withReactions({ ...built.block, actions })), opponent.creatureType),
    });
  }

  // What each opponent has on it as it begins (1.795): what the Game Master gave it, else what its
  // bestiary entry rolls for, by the fight's own seed so the same fight has the same.
  const purses: Record<string, Array<{ ref: string; name: string; count: number }>> = {};
  if (input.itemBook) {
    const book = input.itemBook;
    input.enemies.forEach((opponent, index) => {
      const entry = combatants.find((one) => one.id === opponent.id);
      if (!entry || "build" in entry) return;
      const rng = deterministicRng(input.seed >>> 0, RULESET_CARRIED_CURSOR + index);
      const roll = dieRollerFrom(rng);
      const lines = inventories.get(opponent.id);
      const coins = new Map<string, { ref: string; name: string; count: number }>();
      const had = opponent.items
        ? rulesetGivenItems(
            book,
            opponent.items,
            (name) =>
              adjustments.push(`${opponent.name}: the ruleset has no item called "${name}", so it was not given.`),
            coins,
            (coin) => rulesetUsualPurse(definition, coin, roll),
          )
        : lines
          ? rollRulesetCreatureInventory(definition, book, lines, roll)
          : [];
      const carried = had.flatMap((drop) => {
        const item = book.itemOf(drop.item)?.entry.item;
        return item ? [{ held: { item, quantity: drop.count, worn: false, name: drop.name }, ref: drop.item }] : [];
      });
      if (carried.length > 0) (entry as { carried?: RulesetCarriedInput[] }).carried = carried;
      // Coins, its own (the Game Master's) and one that comes back with what it took along.
      for (const kept of opponent.coins ?? [])
        coins.set(kept.ref, { ...kept, count: (coins.get(kept.ref)?.count ?? 0) + kept.count });
      if (coins.size > 0) purses[opponent.id] = [...coins.values()];
    });
  }

  const board = buildRulesetBoard(input, combatants);
  if (board && "error" in board) return { ok: false, error: board.error };
  const encounterOn = (on: typeof board) =>
    createRulesetEncounter({
      definition,
      seed: input.seed,
      combatants,
      bestiary: input.bestiary,
      ...(on ? { board: on } : {}),
      ...(input.surprised?.length ? { surprised: input.surprised } : {}),
      ...(input.inLair?.length ? { inLair: input.inLair } : {}),
      ...(input.heldGround ? { heldGround: input.heldGround } : {}),
    });
  let encounter = encounterOn(board);
  // One facing a blast that thinks ahead deploys apart by its size (combat AI S1a): the same board,
  // laid again.
  const spread = board ? rulesetDeploySpread(definition, encounter) : {};
  let laid = board;
  if (Object.keys(spread).length > 0) {
    const spaced = rulesetSpacedBoard(input, combatants, spread);
    if (spaced) encounter = encounterOn((laid = spaced));
  }
  // Where everybody begins (2026-10-24, Alyssa): whoever the Game Master started somewhere there, and
  // the rest of the party by what each does (a caster back, a fighter forward), for the player to
  // move as they please before the first turn.
  let deploy: RulesetFightState["deploy"];
  if (laid) {
    const places: Record<string, CombatStartPlace> = Object.fromEntries(
      [...input.party, ...input.enemies].flatMap((one) => (one.start ? [[one.id, one.start]] : [])),
    );
    const roles = Object.fromEntries(
      encounter.combatants
        .filter((one) => one.side === "party" && !one.object && !places[one.id])
        .map((one) => [one.id, rulesetCombatantRole(one, definition, encounter)]),
    );
    // One already spaced against a blast stands where that put it, not back or forward by its role,
    // which closed the gap the blast needs (re-test D5: the party began 3 apart against a 5).
    // So does an opponent the Game Master started nowhere in particular, an archer or a caster back out
    // of reach (laptop level-4 pass 2026-10-26: two goblin archers began beside the wizard).
    const foeRoles = Object.fromEntries(
      encounter.combatants
        .filter((one) => one.side === "enemy" && !one.object && !places[one.id] && one.calledBy === undefined)
        .map((one) => [one.id, rulesetCombatantRole(one, definition, encounter)] as const)
        .filter(([, role]) => ["marksman", "spellcaster", "supporter", "controller"].includes(role)),
    );
    const nudged = Object.fromEntries(
      Object.entries({ ...roles, ...foeRoles }).filter(([id]) => spread[id] === undefined),
    );
    // Of a kind by its bestiary entry, else its name without a count ("Zombie 2" is a Zombie).
    const stands = combatants.map((one) => ({
      id: one.id,
      side: one.side,
      group:
        "creature" in one && one.creature
          ? `${one.creature.catalogId}/${one.creature.entryId}`
          : one.name.replace(/\s*#?\d+$/, "").toLowerCase(),
    }));
    const placements = rulesetWaterStarts(
      laid.grid,
      rulesetStartPlacements(laid.grid, laid.placements, stands, places, nudged),
      encounter.combatants
        .filter((one) => !one.object)
        .map((one) => ({
          id: one.id,
          side: one.side,
          walk: one.block?.speed ?? 0,
          swim: one.speeds?.swim,
          fly: one.speeds?.fly,
          span: rulesetSpanOf(one),
        })),
    );
    // What the water start read, for each opponent that swims (laptop 2026-10-30: asked for, to see
    // why a large one stayed ashore).
    for (const one of encounter.combatants)
      if (one.side !== "party" && one.speeds?.swim)
        logger.info(
          "[game/combat:ruleset] Water start: %s walks %s, swims %s, %s wide, from %s to %s",
          one.name,
          one.block?.speed ?? 0,
          one.speeds.swim,
          rulesetSpanOf(one),
          JSON.stringify(laid.placements[one.id]),
          JSON.stringify(placements[one.id]),
        );
    if (JSON.stringify(placements) !== JSON.stringify(laid.placements))
      encounter = encounterOn((laid = { ...laid, placements }));
    // A Game Master who placed the whole party placed nobody in particular (laptop party A: everyone
    // "front" or "hidden"): the player still sets them down, from where it put them.
    const members = encounter.combatants.filter((one) => one.side === "party" && !one.object).map((one) => one.id);
    const everyone = Object.keys(roles).length === 0 && members.length > 1;
    const deployers = everyone ? members : Object.keys(roles);
    const cells =
      input.deploy && deployers.length > 0 ? rulesetDeployCells(laid.grid, placements, stands, deployers) : [];
    if (cells.length > 0)
      deploy = { cells, placed: everyone ? [] : party.flatMap((one) => (places[one.id] ? [one.id] : [])) };
    // Hemmed in, with no open cell clear of the opponents, it begins as placed, and says so (laptop
    // playtest 2026-10-25: a surrounded party went straight to round 1 with nothing said).
    else if (input.deploy && deployers.length > 0)
      adjustments.push("No room to set the party down clear of the opponents, so the fight begins where it stands.");
  }
  // The mind the Game Master gave an opponent is the one the rules read too, its morale among them
  // (laptop v3b 2026-10-26: a husk written mindless lost heart and surrendered).
  for (const opponent of enemies) {
    const built = opponent.mind ? rulesetCombatant(encounter, opponent.id) : undefined;
    if (built?.block) built.block.mind = opponent.mind;
  }
  for (const [id, tier] of heldToTier) {
    const built = rulesetCombatant(encounter, id);
    if (!built) continue;
    for (const line of holdRulesetCombatant(definition, built, tier)) adjustments.push(`${built.name}: ${line}`);
  }
  // Every other invented opponent with points has what they buy held to its tier too, however its
  // block was built (laptop v3b 2026-10-26: an Archlich from a proposed block, brought down to CR 3,
  // kept a full Disrupt Life on every hero, five times).
  for (const opponent of enemies) {
    if (heldToTier.has(opponent.id)) continue;
    const entry = combatants.find((one) => one.id === opponent.id);
    if (!entry || !("block" in entry) || !entry.block) continue;
    const tierId = (entry.block as { tier?: string }).tier ?? opponent.tier;
    const tier = combat.threat?.tiers.find((one) => one.id === tierId);
    const built = tier ? rulesetCombatant(encounter, opponent.id) : undefined;
    if (!built?.signature?.max) continue;
    for (const line of holdRulesetLegendary(definition, built, tier!)) adjustments.push(`${built.name}: ${line}`);
  }
  // And a bestiary creature's, where the points were the Game Master's and not its own: what they buy
  // stays inside its own tier with its turn (Alyssa 2026-10-30: a CR 1/2 elemental fought with
  // legendary actions 3/3).
  for (const opponent of enemies) {
    const entry = combatants.find((one) => one.id === opponent.id);
    if (!entry || !("creature" in entry) || !entry.creature || !entry.adjust?.legendary) continue;
    const tierId = findRulesetCreatureEntry(input.bestiary ?? {}, entry.creature)?.creature?.tier;
    const tier = combat.threat?.tiers.find((one) => one.id === tierId);
    const built = tier ? rulesetCombatant(encounter, opponent.id) : undefined;
    if (!built?.signature?.max) continue;
    for (const line of holdRulesetLegendary(definition, built, tier!)) adjustments.push(`${built.name}: ${line}`);
  }
  // What a boss may spend its points on is said as it is left after the hold (laptop 2026-10-26: the
  // line named Disrupt Life before the next one took it away).
  for (const opponent of enemies) {
    const built = rulesetCombatant(encounter, opponent.id);
    if (!built?.signature) continue;
    const lead = `${opponent.name} may spend `;
    const at = adjustments.findIndex((line) => line.startsWith(lead) && line.includes(" points between turns on "));
    if (at < 0) continue;
    const [head, listed] = adjustments[at]!.slice(0, -1).split(" points between turns on ") as [string, string];
    const kept = new Set(
      built.actions.filter((action) => action.signature).map((action) => action.label.trim().toLowerCase()),
    );
    // Nothing left to buy, no line; names the board reads under other labels are left as written.
    if (kept.size === 0) {
      adjustments.splice(at, 1);
      continue;
    }
    const names = listed.split(", ");
    const left = names.filter((name) => kept.has(name.trim().toLowerCase()));
    if (left.length === 0 || left.length === names.length) continue;
    adjustments[at] = `${head} points between turns on ${left.join(", ")}.`;
  }
  // What a member's sheet keeps from a use outside a fight comes along on its own, paid for then
  // (1.798): their familiar. The Game Master's own listing of the same entry is left out for it.
  // And the shape one keeps them in (1.801): a druid who went into the fight a wolf starts it one.
  const kept = encounter.combatants.flatMap((one) => {
    if (one.side !== "party" || !one.sheet) return [];
    const stored = input.live?.[normalizeCharacterLookupName(one.name)];
    const shaped = rulesetKeptForm(stored);
    return [
      ...rulesetKeptCalls(stored).map((call) => ({
        casterId: one.id,
        entry: call.entry,
        ...(call.as ? { mode: call.as } : {}),
        kept: call.entry,
      })),
      ...(shaped ? [{ casterId: one.id, entry: shaped.entry, mode: shaped.as, kept: shaped.entry }] : []),
    ];
  });
  // A member's change of their own shape is never set up by the fight's listing: only the shape their
  // sheet keeps starts a fight, as the form it names (laptop 2026-10-26: a druid listed as a Swarm of
  // Spiders came into a fight in it with nothing in the story that turned him).
  const ownShape = (one: { casterId: string; entry: string }) => {
    const caster = rulesetCombatant(encounter, one.casterId);
    if (!caster || caster.side !== "party" || !caster.sheet) return undefined;
    return caster.actions.find(
      (action) =>
        (action.id === one.entry || sameRulesetName(action.label, one.entry)) &&
        action.targets.side === "self" &&
        !!action.modes?.some((mode) => mode.form),
    );
  };
  const standing = [
    ...(input.standing ?? []).filter((one) => {
      if (
        kept.some(
          (call) =>
            call.casterId === one.casterId && call.entry.trim().toLowerCase() === one.entry.trim().toLowerCase(),
        )
      )
        return false;
      const shape = ownShape(one);
      if (!shape) return true;
      adjustments.push(
        `${rulesetCombatant(encounter, one.casterId)!.name}'s ${shape.label} changes their own shape, which only their sheet keeps, so it is not done.`,
      );
      return false;
    }),
    ...kept,
  ];
  // What was set up before it stands as it begins (1.462).
  if (standing.length) {
    const stood = rulesetStandingAtStart(definition, encounter, standing);
    encounter = stood.state;
    adjustments.push(...stood.skipped);
    // A kept shape comes in with what its form had left of its own health when last it fought.
    for (const one of encounter.combatants) {
      const shaped =
        one.side === "party" && one.sheet
          ? rulesetKeptForm(input.live?.[normalizeCharacterLookupName(one.name)])
          : undefined;
      if (!shaped || !one.shape?.health || !sameRulesetName(one.shape.name, shaped.as)) continue;
      // Its whole health as first rolled, not rolled again each fight (cloud probes 2026-10-25).
      if (shaped.max !== undefined) one.shape.health.max = shaped.max;
      if (shaped.health === undefined) continue;
      one.shape.health.value = Math.max(1, Math.min(one.shape.health.max, shaped.health));
    }
  }
  // What the story took off an opponent before the fight stays off it (cheap-GM playtest 2026-10-26:
  // a foe hurt in the narration came onto the board whole): the share of its health the Game Master
  // left it, never under 1. One whose health lives on a sheet keeps it as the sheet has it.
  for (const opponent of input.enemies) {
    const share = opponent.hurt;
    if (share === undefined || !(share > 0 && share < 1)) continue;
    const one = rulesetCombatant(encounter, opponent.id);
    if (!one || one.side !== "enemy" || one.sheet || !one.health) continue;
    one.health.value = Math.max(1, Math.min(one.health.value, Math.round(one.health.max * share)));
    adjustments.push(
      `${opponent.name} begins hurt, at ${one.health.value} of ${one.health.max} health, as the story left it.`,
    );
  }
  // A shape's condition on a member who starts the fight in no shape holds them in nothing: it is
  // taken off, sheet and all (laptop 2026-10-25: a bare Wild Shape on a druid's token after the wolf
  // was dismissed).
  const shapes = new Set(
    (definition.combat?.conditions ?? []).flatMap((entry) => (entry.shape ? [entry.condition] : [])),
  );
  for (const one of encounter.combatants) {
    if (one.side !== "party" || !one.sheet || one.shape || shapes.size === 0) continue;
    const live = one.sheet.live as RulesetLiveState | undefined;
    // A kept form that could not be taken here is still theirs, and so is what holds them in it.
    if (live?.shaped) continue;
    const stray = [
      ...new Set([
        ...(live?.conditions ?? []).filter((id) => shapes.has(id)),
        ...one.tracked.filter((entry) => shapes.has(entry.condition)).map((entry) => entry.condition),
      ]),
    ];
    if (!stray.length) continue;
    one.tracked = one.tracked.filter((entry) => !shapes.has(entry.condition));
    for (const condition of stray) {
      const off = applyRulesetSheetOp(definition, one.sheet.build, one.sheet.live as never, {
        op: "condition",
        condition,
        active: false,
      });
      if (off.ok) one.sheet.live = off.live;
    }
  }
  // A lair whose count comes before everybody's acts before the first turn (1.315).
  encounter = rulesetOpenLairWindow(definition, encounter);
  // Whom its side follows by the story (combat AI E2): its fall shakes the rest as a stat block's
  // leader's does.
  for (const opponent of input.enemies) {
    const one = opponent.leader ? encounter.combatants.find((combatant) => combatant.id === opponent.id) : undefined;
    if (one) one.leader = true;
    // A boss is not shaken by its own side's losses (laptop playtest 2026-10-24: a war-chief at 110
    // of 121 surrendered once half its warband was down); being hurt still tells on it.
    const boss = opponent.boss ? encounter.combatants.find((combatant) => combatant.id === opponent.id) : undefined;
    if (boss) boss.steadfast = true;
  }
  const fight: RulesetFightState = {
    encounter,
    eventSeq: 0,
    events: [],
    controllers: {},
    bosses: input.enemies.filter((opponent) => opponent.boss).map((opponent) => opponent.id),
    ...rulesetThinkersOf(input.definition, encounter, input.enemies),
    adjustments: adjustments.slice(0, RULESET_ADJUSTMENT_LIMIT),
    ...(Object.keys(lootTables).length > 0 ? { lootTables } : {}),
    ...(Object.keys(purses).length > 0 ? { purses } : {}),
    ...(deploy ? { deploy } : {}),
    // As it was fought, its tier brought down by the budget included.
    made: Object.fromEntries(
      enemies.map((opponent) => [
        opponent.id,
        {
          name: opponent.name,
          ...(opponent.named || opponent.boss ? { named: true as const } : {}),
          ...(opponent.creature !== undefined ? { creature: opponent.creature } : {}),
          ...(opponent.tier !== undefined ? { tier: opponent.tier } : {}),
          // An invented one's sheet as it was filled in, so it comes back with the same spells (cloud
          // re-test 2026-10-25: a returning Ilse drew a new spell list each time).
          ...(opponent.proposed !== undefined
            ? { proposed: rulesetProposedAsBuilt(opponent.proposed, rulesetCombatant(encounter, opponent.id)) }
            : {}),
          ...(opponent.attacks?.length ? { attacks: structuredClone(opponent.attacks) } : {}),
        },
      ]),
    ),
  };
  // Whose turn it is is said once the player begins it, not while they set the party down (re-test
  // 2026-10-24: "Brom takes their turn" was logged before Begin).
  record(fight, deploy ? encounter.opening.filter((event) => event.type !== "turn") : encounter.opening);
  for (const line of fight.adjustments) logger.info("[game/combat:ruleset] %s", line);
  // The player's own character dead, they play the first of the party still standing until that one
  // lives again (Alyssa 2026-10-26: "1 and 3 together"), whoever they gave the Engine before.
  // So too when the party sent to the fight leaves them out, dead or not (laptop Party A 2026-10-26: a
  // dead Aldric no longer in the party list, and nobody played by the player, so the ambush played
  // itself out to the party's fall).
  const leadName = (input.playerName ?? firstCard ?? "").trim();
  const leadBuild = leadKey ? builds.get(leadKey) : undefined;
  const leadMissing =
    !deadLead &&
    !!leadBuild &&
    !party.some((member) => normalizeCharacterLookupName(member.name) === leadKey) &&
    !combatants.some((one) => one.side === "party" && normalizeCharacterLookupName(one.name) === leadKey);
  const leadDeadAway =
    leadMissing && rulesetSheetDead(definition, leadBuild!, input.live?.[leadKey], input.items?.(leadName));
  // Another room player's own character is theirs to play, never the host's stand-in (2026-10-26).
  const players: Record<string, DirectedRulesetPlayer> = {};
  for (const one of combatants) {
    const key = normalizeCharacterLookupName(one.name);
    const player = one.side === "party" ? input.players?.[key] : undefined;
    // One member by that name, never a guess between two.
    const named = combatants.filter(
      (other) => other.side === "party" && normalizeCharacterLookupName(other.name) === key,
    );
    if (player && named.length === 1) players[one.id] = { ...player };
  }
  const others = new Set(Object.keys(players).filter((id) => !players[id]!.host));
  const standInId =
    deadLead || leadMissing ? combatants.find((one) => one.side === "party" && !others.has(one.id))?.id : undefined;
  if (standInId) {
    const name = combatants.find((one) => one.id === standInId)!.name;
    const lead = deadLead ?? leadName;
    fight.adjustments.push(
      deadLead || leadDeadAway
        ? `${lead} is dead, so the player plays ${name} until ${lead} lives again.`
        : `${lead} is not in this fight, so the player plays ${name}.`,
    );
  }
  // Who the player plays: their own character, else the one in its place, else the first of the party.
  const partyIds = combatants.filter((one) => one.side === "party" && !others.has(one.id)).map((one) => one.id);
  const leadId =
    standInId ??
    combatants.find((one) => one.side === "party" && leadKey && normalizeCharacterLookupName(one.name) === leadKey)
      ?.id ??
    partyIds[0];
  if (leadId) fight.lead = leadId;
  if (input.companionsOnTheirOwn)
    for (const id of partyIds)
      if (id !== leadId && party.some((member) => member.id === id)) fight.controllers[id] = "ai";
  // Each room player's own character is theirs (2026-10-26), whoever else is at the table.
  if (Object.keys(players).length > 0) {
    fight.players = players;
    const absent = new Set(input.absent ?? []);
    for (const id of others)
      fight.controllers[id] = absent.has(players[id]!.participantId) ? "ai" : (input.othersPlay ?? "manual");
  }
  return { ok: true, fight, ...(standInId ? { standIn: standInId } : {}) };
}

/** Where the dice for what opponents have on them (1.795) start, apart from the board's and the fight's. */
const RULESET_CARRIED_CURSOR = 17840;

/** How many of a coin a purse the Game Master gave with no count holds (laptop playtest 2026-10-26:
 *  "Pouch, gold pieces"): what the ruleset's own loot tables drop of that coin, the first line that
 *  names it rolled, else 2d6 of it, a few days' wages. */
function rulesetUsualPurse(
  definition: RulesetDefinition,
  coin: { entry: { id: string } },
  roll: (sides: number) => number,
): number {
  const line = (definition.items?.lootTables ?? [])
    .flatMap((table) => table.entries)
    .find((entry) => entry.coins === coin.entry.id);
  return Math.max(1, line ? rulesetRolledAmount(line.count, roll) : roll(6) + roll(6));
}

/** What a purse is carried in, and the words it is said with ("a small leather pouch"): alone on a
 *  line, with nothing the ruleset has in it, it is nothing to give. */
const RULESET_PURSES = new Set(["pouch", "purse", "bag", "sack", "satchel", "wallet", "coffer", "chest", "box"]);
const RULESET_PURSE_SAID = new Set([
  "a",
  "an",
  "the",
  "one",
  "small",
  "fat",
  "heavy",
  "leather",
  "belt",
  "coin",
  "money",
]);
/** And what a line says around a coin's name that leaves it a purse of that coin: a count, or the
 *  container it is in ("a pouch of 30 gold", "Pouch, gold pieces", "gold pieces x30"). */
const RULESET_PURSE_WORDS = new Set([
  ...RULESET_PURSE_SAID,
  "of",
  "with",
  "and",
  "in",
  "x",
  "containing",
  "holding",
  "full",
  "some",
  "few",
  "handful",
  "worth",
]);

/** The items the Game Master gave an opponent (1.795), each line one of the ruleset's by its reference
 *  or its name, any case: lines naming one item are added together, and one naming none is told. A
 *  line that is coins in a purse is that many of the coin, and a purse alone is passed over. */
function rulesetGivenItems(
  book: Pick<RulesetItemBook, "entries" | "coins"> & Partial<Pick<RulesetItemBook, "itemNamed">>,
  lines: readonly string[],
  unknown: (name: string) => void,
  coins?: Map<string, { ref: string; name: string; count: number }>,
  /** How many of a coin a line that gives no count holds. Absent, one. */
  purse?: (coin: RulesetItemBookEntry) => number,
): Array<{ item: string; name: string; count: number }> {
  const had = new Map<string, { item: string; name: string; count: number }>();
  // A coin by its name, one or many, any case ("9 gold pieces", "a silver piece"), with how many.
  const one = (text: string) => gameInventoryNameKey(text).replace(/ies$/, "y").replace(/s$/, "");
  for (const line of lines) {
    const wanted = line.trim();
    if (!wanted) continue;
    const counted = /^(\d+)\s*x?\s+(.+)$/i.exec(wanted);
    const said = wanted.replace(/^(a|an|one)\s+/i, "");
    const coinName = one(counted ? counted[2]! : said);
    const coin = coins
      ? book.coins.find((entry) => one(entry.name) === coinName || one(entry.entry.id) === coinName)
      : undefined;
    if (coin && coins) {
      // One said as one ("a silver piece"); with no count at all, a purse of it ("gold pieces").
      const single = said !== wanted || gameInventoryNameKey(said) === gameInventoryNameKey(coin.coin?.one ?? "");
      const count = counted ? Math.min(1000000, Number(counted[1])) : single ? 1 : (purse?.(coin) ?? 1);
      if (count > 0)
        coins.set(coin.item, { ref: coin.item, name: coin.name, count: (coins.get(coin.item)?.count ?? 0) + count });
      continue;
    }
    // By its ref or its name as written, else with a count before or after it ("2 Javelins",
    // "Javelin x2", "Javelins (3)"), and by the book's own lookup, its other names and its words in
    // another order ("Heavy Crossbow" for Crossbow, heavy: laptop playtest 2026-10-25).
    const named = (text: string) => {
      const key = text.toLowerCase();
      const exact =
        book.entries.find((entry) => entry.item === text) ??
        book.entries.find((entry) => !entry.coin && entry.name.trim().toLowerCase() === key);
      if (exact) return exact;
      const looked = book.itemNamed?.(text);
      return looked && !looked.coin ? looked : undefined;
    };
    const after = /^(.+?)\s*(?:[x×]\s*(\d+)|\(\s*[x×]?\s*(\d+)\s*\))$/i.exec(wanted);
    const counts: Array<[string, number]> = [[wanted, 1]];
    if (counted) counts.push([counted[2]!, Number(counted[1])]);
    if (after) counts.push([after[1]!, Number(after[2] ?? after[3])]);
    let found: ReturnType<typeof named>;
    let many = 1;
    for (const [text, count] of counts) {
      found = named(text.trim());
      if (found) {
        many = Math.max(1, Math.min(100, count));
        break;
      }
    }
    if (!found) {
      // Coins in a purse, or a purse alone, by the words around them.
      const purseOf = rulesetPurseLine(book.coins, wanted);
      if (purseOf && coins && purseOf !== "empty") {
        const count = Math.min(1000000, purseOf.count ?? purse?.(purseOf.coin) ?? 1);
        const before = coins.get(purseOf.coin.item)?.count ?? 0;
        if (count > 0)
          coins.set(purseOf.coin.item, { ref: purseOf.coin.item, name: purseOf.coin.name, count: before + count });
      } else if (purseOf !== "empty") unknown(wanted);
      continue;
    }
    const before = had.get(found.item);
    had.set(found.item, { item: found.item, name: found.name, count: (before?.count ?? 0) + many });
  }
  return [...had.values()];
}

/**
 * A line that is coins wherever it names them ("12 gp", "a pouch of 30 gold", "Pouch, gold pieces"):
 * one of the ruleset's coins by its id, its name for one or many, or the first word of a name no other
 * coin's starts with ("gold" for gold pieces), with a count before or after it, and nothing else but
 * the words a purse is said in. `count` is absent where the line gives none ("gold pieces"), and one
 * for a coin said as one ("a gold piece"). "empty" for a purse with no coin named ("Pouch"); null for
 * anything else.
 */
function rulesetPurseLine(
  coins: readonly RulesetItemBookEntry[],
  line: string,
): { coin: RulesetItemBookEntry; count?: number } | "empty" | null {
  const one = (word: string) => word.replace(/ies$/, "y").replace(/s$/, "");
  const words = line
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/(\d)(\p{L})|(\p{L})(\d)/gu, (_, digit, letter, before, after) =>
      digit ? `${digit} ${letter}` : `${before} ${after}`,
    )
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  const firsts = coins.map((coin) => one(coin.name.toLowerCase().split(/\s+/)[0] ?? ""));
  const names = coins.flatMap((coin, index) => {
    const said = [coin.entry.id, coin.name, coin.coin?.one ?? ""].filter(Boolean);
    const spelled = said.map((name) =>
      name
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .map(one),
    );
    // The first word alone, where it says no other coin: "gold", never "pieces".
    const first = firsts[index]!;
    if (first && spelled.some((name) => name.length > 1) && firsts.filter((word) => word === first).length === 1)
      spelled.push([first]);
    return spelled.map((name) => ({ coin, name }));
  });
  // The longest name found anywhere in the line.
  let found: { coin: RulesetItemBookEntry; at: number; length: number } | undefined;
  for (const { coin, name } of names) {
    for (let at = 0; at + name.length <= words.length; at++) {
      if (!name.every((word, index) => one(words[at + index]!) === word)) continue;
      if (!found || name.length > found.length) found = { coin, at, length: name.length };
    }
  }
  const rest = found ? [...words.slice(0, found.at), ...words.slice(found.at + found.length)] : words;
  const numbers = rest.filter((word) => /^\d+$/.test(word));
  const others = rest.filter((word) => !/^\d+$/.test(word));
  if (!found)
    return numbers.length === 0 &&
      others.some((word) => RULESET_PURSES.has(one(word))) &&
      others.every((word) => RULESET_PURSE_SAID.has(one(word)) || RULESET_PURSES.has(one(word)))
      ? "empty"
      : null;
  if (others.some((word) => !RULESET_PURSE_WORDS.has(one(word)) && !RULESET_PURSES.has(one(word)))) return null;
  if (numbers.length > 1) return null;
  if (numbers.length === 1) return { coin: found.coin, count: Number(numbers[0]) };
  // "a gold piece", "one gold": one of it, said as one.
  const before = words[found.at - 1];
  const named = words.slice(found.at, found.at + found.length);
  const single = named[named.length - 1] === one(named[named.length - 1]!);
  return before && ["a", "an", "one"].includes(before) && single
    ? { coin: found.coin, count: 1 }
    : { coin: found.coin };
}

/**
 * What the Game Master is told of an opponent it plays (combat AI P9): how it thinks and fights (its
 * mind, temperament, role and its own data's `behavior`), the other side ranked by the danger each
 * poses, and the standing orders the party gave its companions. Nothing a player could not read off
 * the fight; no die that has not been thrown.
 */
export function rulesetGmBrief(definition: RulesetDefinition, state: CombatDirectorState, actorId: string) {
  const fight = fightOf(state);
  const combat = definition.combat;
  const actor = fight ? rulesetCombatant(fight.encounter, actorId) : undefined;
  if (!fight || !combat || !actor) return {};
  // A state built for a single question may carry no units at all.
  const party = state.party ?? [];
  const unit = [...party, ...(state.enemies ?? [])].find((one) => one.id === actorId);
  const behavior = rulesetCombatantBehavior(definition, actor);
  const mind = combatMindWithHint(unit?.aiHints?.mind, rulesetCombatantMind(definition, actor));
  const temperament = unit?.aiHints?.temperament ?? behavior?.temperament ?? unit?.tactics?.adjective;
  const role = behavior?.role ?? unit?.tactics?.role;
  const threats = fight.encounter.combatants
    .filter((one) => one.side !== actor.side && rulesetCombatStanding(one))
    .map((one) => ({
      id: one.id,
      name: one.name,
      threat: Math.round(rulesetThreat(definition, combat, fight.encounter, one) * 100) / 100,
    }))
    .sort((a, b) => b.threat - a.threat);
  const companionOrders = Object.fromEntries(party.filter((one) => one.orders).map((one) => [one.id, one.orders!]));
  return {
    profile: {
      ...(mind ? { mind } : {}),
      ...(temperament ? { temperament } : {}),
      ...(role ? { role } : {}),
      ...(unit?.tactics?.proficiency ? { proficiency: unit.tactics.proficiency } : {}),
      ...(behavior ? { behavior } : {}),
    },
    threats,
    ...(Object.keys(companionOrders).length > 0 ? { companionOrders } : {}),
  };
}

/** The opponents the Game Master may play beside its bosses (combat AI P9): every named one, and
 *  every one whose mind is a genius's, by the story or else by its own data. */
function rulesetThinkersOf(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  enemies: readonly RulesetFightOpponent[],
): { thinkers?: string[] } {
  const thinkers = enemies
    .filter((opponent) => {
      if (opponent.boss) return false;
      if (opponent.named) return true;
      const combatant = rulesetCombatant(encounter, opponent.id);
      const own = combatant ? rulesetCombatantMind(definition, combatant) : undefined;
      return combatMindWithHint(opponent.mind, own) === "genius";
    })
    .map((opponent) => opponent.id);
  return thinkers.length > 0 ? { thinkers } : {};
}

/**
 * The board laid again with those that think ahead kept apart (combat AI S1a), and where the fight's
 * board was left to the Engine and the one its head count gives has no room for the gaps, the next
 * size up that has, up to the vast one (2026-10-24, Alyssa: a fireball took up most of the board).
 * A size the Game Master or the player named, or a board made by hand, stays as it is.
 */
function rulesetSpacedBoard(
  input: RulesetFightSeed,
  combatants: readonly RulesetCombatantInput[],
  spread: Record<string, number>,
) {
  const brief = validateTacticalBattlefieldBrief(input.battlefield);
  const lay = (battlefield: RulesetFightSeed["battlefield"]) => {
    const board = buildRulesetBoard({ ...input, battlefield }, combatants, spread);
    return board && !("error" in board) ? board : null;
  };
  const fits = (board: NonNullable<ReturnType<typeof lay>>) =>
    combatants.every((one, i) =>
      combatants.slice(i + 1).every((other) => {
        const needs = Math.max(spread[one.id] ?? 0, spread[other.id] ?? 0);
        const a = board.placements[one.id];
        const b = board.placements[other.id];
        return (
          one.side !== other.side ||
          needs < 2 ||
          !a ||
          !b ||
          Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= needs
        );
      }),
    );
  const first = lay(input.battlefield);
  if (input.made || !brief.ok || brief.brief?.size || !first || fits(first)) return first;
  const from = TACTICAL_BATTLEFIELD_SIZES.indexOf(defaultBattlefieldSize(combatants.length));
  for (const size of TACTICAL_BATTLEFIELD_SIZES.slice(from + 1, TACTICAL_BATTLEFIELD_SIZES.indexOf("vast") + 1)) {
    const bigger = lay({ ...(brief.brief ?? {}), size });
    if (bigger && fits(bigger)) return bigger;
  }
  return first;
}

/**
 * How far from the rest of its side each one deploys, by id (combat AI S1a): one past the size of the
 * largest area that harms the other side holds at the start, as the crowding term reads it (a burst
 * all around its centre, a cone or a line a third of its length), so an opening blast at it catches
 * it alone, and exactly that far, no farther. Only one that thinks ahead (2026-10-24, Alyssa: a
 * zombie stays bunched beside the cultist who spreads, a goblin only sometimes thinks of it); none
 * where the other side holds no such area.
 */
export function rulesetDeploySpread(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
): Record<string, number> {
  const blast: { party?: number; enemy?: number } = {};
  for (const foe of encounter.combatants) {
    const facing = foe.side === "party" ? "enemy" : "party";
    for (const action of foe.actions) {
      if (!action.area || !action.damage || rulesetSafeAverage(action.damage) <= 0) continue;
      if (!rulesetActionAvailable(foe, action, encounter, definition)) continue;
      const across = action.area.shape === "burst" ? action.area.size : Math.max(1, Math.floor(action.area.size / 3));
      blast[facing] = Math.max(blast[facing] ?? 0, across + 1);
    }
  }
  const spread: Record<string, number> = {};
  for (const one of encounter.combatants) {
    const gap = blast[one.side];
    if (!gap || one.object || !rulesetCombatantForesees(definition, one, encounter.seed)) continue;
    // A pack hunter starts with its pack, blast or no blast: it fights by standing together (laptop
    // playtest 2026-10-24: wolves spread five apart).
    if (rulesetCombatantBehavior(definition, one)?.pack) continue;
    spread[one.id] = gap;
  }
  return spread;
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
  spread: Record<string, number> = {},
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
    ...(spread[entry.id] ? { spread: spread[entry.id] } : {}),
    x: 0,
    y: 0,
  }));
  // The same cursor the tactical style reserves for setup, from the same seed, so the two styles
  // generate the same board for the same fight.
  let rng = deterministicRng(input.seed >>> 0, 0);
  const terrain = normalizeTacticalEnvironment(input.environment ?? undefined);
  let generated = input.made
    ? madeTacticalBattlefield(input.made)
    : generateTacticalBattlefield(stands.length, rng, terrain, input.battlefield);
  // Features the Game Master asked for that cannot all stand together (two of different terrain
  // laid on the same side, laptop playtest 2026-10-25) keep those that can, the first said first,
  // rather than leaving the fight unstartable.
  const asked = input.made ? undefined : validateTacticalBattlefieldBrief(input.battlefield);
  if (!generated.ok && asked?.ok && asked.brief?.features?.length) {
    const { features, ...rest } = asked.brief;
    const kept: typeof features = [];
    for (const feature of features) {
      const brief = { ...rest, features: [...kept, feature] };
      if (generateTacticalBattlefield(stands.length, deterministicRng(input.seed >>> 0, 0), terrain, brief).ok)
        kept.push(feature);
    }
    rng = deterministicRng(input.seed >>> 0, 0);
    generated = generateTacticalBattlefield(
      stands.length,
      rng,
      terrain,
      kept.length > 0 ? { ...rest, features: kept } : rest,
    );
    if (generated.ok)
      logger.info(
        "[game/combat:ruleset] Battlefield features left out so the rest could stand: %s",
        features
          .filter((feature) => !kept.includes(feature))
          .map((feature) => `${feature.terrain} ${feature.placement} ${feature.shape}`)
          .join(", "),
      );
  }
  if (!generated.ok) return { error: generated.error };
  const { grid } = generated;
  if (
    !placeSpawns(
      grid,
      stands,
      normalizeTacticalFormation(input.formation ?? undefined),
      rng,
      generated.protectedTiles,
      true,
    )
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

function record(fight: RulesetFightState, events: readonly DirectedRulesetEvent[]): void {
  for (const event of events) fight.events.push({ seq: ++fight.eventSeq, event });
  fight.events = trimRulesetFightEvents(fight.events);
}

/**
 * The fight's events cut back: its own to `RULESET_COMBAT_EVENT_LIMIT`, and the AI's reasons (only
 * ever shown with Debug on) to `RULESET_COMBAT_REASON_LIMIT` beside them, oldest first each. A
 * reason never costs a player an event of the fight, and a long fight still keeps its newest reasons
 * (laptop playtest 2026-10-23: past 200 events every new reason was cut as soon as it was written).
 */
export function trimRulesetFightEvents<T extends { event: { type: string } }>(events: T[]): T[] {
  const reasons = events.filter((entry) => entry.event.type === "reasoning").length;
  let reasonsOver = reasons - RULESET_COMBAT_REASON_LIMIT;
  let eventsOver = events.length - reasons - RULESET_COMBAT_EVENT_LIMIT;
  if (reasonsOver <= 0 && eventsOver <= 0) return events;
  const eventsCut = eventsOver > 0;
  const kept = events.filter((entry) =>
    entry.event.type === "reasoning" ? !(reasonsOver-- > 0) : !(eventsOver-- > 0),
  );
  // A reason older than the oldest event kept is about a turn no longer shown (laptop playtest
  // 2026-10-25: rounds 1 to 3 survived only as "Why..." lines).
  const first = kept.findIndex((entry) => entry.event.type !== "reasoning");
  const cut = eventsCut ? first : 0;
  return cut > 0 ? kept.slice(cut) : kept;
}

/** The player's companions in a fight: every party member they play but the one that is their own,
 *  leaving out whoever was called to the party's side. */
export function rulesetCompanionIds(state: CombatDirectorState, fight: RulesetFightState): string[] {
  const lead = fight.lead ?? state.party[0]?.id;
  return state.party.flatMap((unit) => {
    const combatant = rulesetCombatant(fight.encounter, unit.id);
    // Another room player's own character is not one of the host's companions (2026-10-26).
    return combatant &&
      combatant.side === "party" &&
      !combatant.calledBy &&
      unit.id !== lead &&
      !rulesetUnitPlayer(fight, unit.id)
      ? [unit.id]
      : [];
  });
}

/** Who commands a party member of a shared room's fight (2026-10-26): the host, or one other player. */
export interface RulesetFightCommander {
  host: boolean;
  participantId?: string;
}

/** The host of the room, which is who sends every command through the Engine's own routes. */
export const RULESET_ROOM_HOST: RulesetFightCommander = { host: true };

/** The room player whose own character this party member is, or who called it to the party's side;
 *  undefined for a member no player plays, and outside a room. */
export function rulesetUnitPlayer(fight: RulesetFightState, unitId: string): DirectedRulesetPlayer | undefined {
  if (!fight.players) return undefined;
  let combatant = rulesetCombatant(fight.encounter, unitId);
  // A called creature is its caller's, and a caller may have been called too: bounded, never a loop.
  for (let hops = 0; combatant?.calledBy && hops < 8; hops++)
    combatant = rulesetCombatant(fight.encounter, combatant.calledBy);
  return combatant ? fight.players[combatant.id] : undefined;
}

/** Whether this commander may command this party member: its own player only, and the host every
 *  member no other player plays. Outside a room the one player commands everybody. */
export function rulesetMayCommand(fight: RulesetFightState, unitId: string, commander: RulesetFightCommander): boolean {
  if (!fight.players || Object.keys(fight.players).length === 0) return commander.host;
  const player = rulesetUnitPlayer(fight, unitId);
  if (!player) return commander.host;
  return player.host ? commander.host : !commander.host && player.participantId === commander.participantId;
}

/** The party member a command acts for: the one asked or on turn for a choice, the one named for a
 *  placement, a controller or orders. Null for a command about the whole fight. */
export function rulesetCommandUnit(
  state: CombatDirectorState,
  fight: RulesetFightState,
  command: DirectedCommand,
): string | null {
  switch (command.type) {
    case "ruleset":
      return fight.encounter.window?.waiting[0] ?? currentRulesetActor(fight.encounter)?.id ?? null;
    case "choose":
      return state.window?.actorId ?? null;
    case "deploy":
    case "control":
    case "orders":
    case "draw":
    case "ammo":
      return command.unitId;
    default:
      return null;
  }
}

/** A shared room's fight takes a command for a party member only from the player who owns it, and a
 *  command about the whole fight (begin, continue, flee, every companion at once) only from the host
 *  (2026-10-26). Null when it may be sent; nothing is checked outside a room. */
export function rulesetCommandRefusal(
  state: CombatDirectorState,
  fight: RulesetFightState,
  command: DirectedCommand,
  commander: RulesetFightCommander,
): Extract<RulesetCommandResult, { ok: false }> | null {
  if (!fight.players || Object.keys(fight.players).length === 0) return null;
  const unitId = rulesetCommandUnit(state, fight, command);
  if (unitId === null) {
    if (commander.host) return null;
    return {
      ok: false,
      error: "Only the room's host decides that for the whole fight.",
      code: "ruleset_combat_host_only",
    };
  }
  const combatant = rulesetCombatant(fight.encounter, unitId);
  // Only a party member has a player; whatever else is named is left for the resolver to refuse.
  if (!combatant || combatant.side !== "party" || rulesetMayCommand(fight, unitId, commander)) return null;
  const player = rulesetUnitPlayer(fight, unitId);
  return {
    ok: false,
    error: player ? `${combatant.name} is ${player.name}'s to play.` : `${combatant.name} is the host's to play.`,
    code: "ruleset_combat_not_yours",
  };
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
    // Out of their caller's command (1.620), they act on their own, whoever took them.
    if (combatant.calledOnOwn) return "ai";
    return chosen === "ai" || (combatant.calledBy && chosen !== "manual") ? "ai" : "manual";
  }
  if (!state.gm) return "ai";
  if (fight.bosses.includes(combatant.id) || state.gmAll) return "gm";
  return state.gmNamed && fight.thinkers?.includes(combatant.id) ? "gm" : "ai";
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
    if (combatant.side !== "party") continue;
    // A member who is a bestiary creature with no sheet keeps the conditions it came in holding,
    // while it still holds them, and its health in the health pool's place.
    if (combatant.cardLive && !combatant.sheet) {
      const conditions = combatant.cardLive.conditions.filter((condition) =>
        combatant.tracked.some((entry) => entry.condition === condition),
      );
      const pool = combatant.cardLive.pool;
      live[normalizeCharacterLookupName(combatant.name)] = {
        ...(conditions.length ? { conditions } : {}),
        ...(pool !== undefined && combatant.health
          ? { pools: { [pool]: { value: combatant.defeated ? 0 : Math.max(0, combatant.health.value) } } }
          : {}),
      };
      continue;
    }
    if (!combatant.sheet) continue;
    let state = combatant.sheet.live as RulesetLiveState;
    // A kept call killed or dismissed in the fight is gone from its caller's sheet (1.798).
    if (state?.called) {
      const lost = Object.keys(state.called).filter((entry) =>
        fight.encounter.combatants.some(
          (one) =>
            one.calledBy === combatant.id &&
            one.calledKept?.entry === entry &&
            (one.calledKept.gone || (one.defeated && !one.dismissed)),
        ),
      );
      if (lost.length) {
        const called = Object.fromEntries(Object.entries(state.called).filter(([entry]) => !lost.includes(entry)));
        state = { ...state, called };
        if (!Object.keys(called).length) delete state.called;
      }
    }
    // So is a kept shape that ended in it (1.801), and one still held keeps its form's health and the
    // condition holding it, which the fight's end took off; a shape they took in the fight by an
    // entry of their own and still hold as it ends is kept from then on.
    const shape = combatant.shape;
    const entry = shape
      ? [...(shape.was.actions ?? []), ...combatant.actions].find((action) =>
          action.modes?.some(
            (mode) =>
              mode.form?.creature.catalogId === shape.form.catalogId &&
              mode.form.creature.entryId === shape.form.entryId,
          ),
        )
      : undefined;
    // The one it kept, or another they took in the fight by an entry of their own in its place.
    const same = !!shape && !!state?.shaped && sameRulesetName(state.shaped.as, shape.name);
    const held = shape && !combatant.defeated && (same || !!entry);
    if (held) {
      const conditions = state?.conditions ?? [];
      state = {
        ...state,
        ...(conditions.includes(shape.condition) ? {} : { conditions: [...conditions, shape.condition] }),
        shaped: {
          entry: same ? state!.shaped!.entry : entry!.label,
          as: same ? state!.shaped!.as : shape.name,
          ...(shape.health ? { health: Math.max(0, shape.health.value), max: shape.health.max } : {}),
        },
      };
    } else if (state?.shaped) {
      state = { ...state };
      delete state.shaped;
    }
    // Left down and stable, they start the next fight so; anything else starts it as its health says.
    const stable = combatant.down && combatant.stable && !combatant.defeated;
    if (stable && !state?.stable) state = { ...state, stable: true };
    else if (!stable && state?.stable) {
      state = { ...state };
      delete state.stable;
    }
    live[normalizeCharacterLookupName(combatant.name)] = state;
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
    rulesetReadRole(definition, unit, combatant, fight.encounter);
    // Its data's temperament from the start, so what happens before its first choice (a shift, a
    // proud one's flight) reads it too (combat AI T5).
    const own = rulesetCombatantBehavior(definition, combatant)?.temperament;
    if (unit.tactics && unit.tactics.mind !== "mindless" && own && !unit.aiHints?.temperament && !unit.tactics.shifted)
      unit.tactics.adjective = own;
    // The ground a territorial one keeps: where it stood when it first did (combat AI T4).
    const at = rulesetPositionOf(combatant);
    if (unit.tactics && rulesetTerritorial(definition, combatant, unit.tactics) && !unit.tactics.home && at)
      unit.tactics.home = { x: at.x, y: at.y };
    // The temperament it is played with, for the rules' morale (combat AI T1, T2).
    const temperament =
      unit.tactics?.mind === "mindless"
        ? undefined
        : unit.tactics?.shifted
          ? unit.tactics.adjective
          : (unit.aiHints?.temperament ??
            rulesetCombatantBehavior(definition, combatant)?.temperament ??
            unit.tactics?.adjective);
    // Cruel only where the game allows it (combat AI T3): otherwise it plays as an opportunist.
    if (temperament) combatant.temperament = temperament === "cruel" && !state.cruel ? "opportunistic" : temperament;
    else delete combatant.temperament;
    // Who plays a party member, as the fight has it: what the party panel shows.
    if (combatant.side === "party")
      unit.controller = rulesetController(state, fight, combatant) === "ai" ? "ai" : "manual";
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

/** What a fighter is for, read once off what its ruleset sheet or block can do (a priest supports, a
 *  mage casts), or as its own data says (1.763). The ruleset is what it fights with, so a game card's
 *  class or skills say nothing here. */
function rulesetReadRole(
  definition: RulesetDefinition,
  unit: Combatant,
  combatant: RulesetCombatant,
  encounter: RulesetEncounterState,
): void {
  if (!unit.tactics || unit.tactics.roleRead) return;
  const role =
    rulesetCombatantBehavior(definition, combatant)?.role ?? rulesetCombatantRole(combatant, definition, encounter);
  // Its temperament drawn again with what it is for (combat AI A3): a priest leans supportive and a
  // goblin opportunistic, which a guess from its Engine class never gave them. A temperament the
  // story or its data names still wins. Not an opponent invented with a sheet: its open choices were
  // filled by the temperament it was given, and it fights with that one.
  if (
    role !== unit.tactics.role &&
    unit.tactics.mind !== "mindless" &&
    !(combatant.sheet && combatant.side === "enemy")
  ) {
    const { seed, mind } = unit.tactics;
    unit.tactics.adjective =
      unit.aiHints?.temperament ?? assignCombatTactics({ ...unit, tactics: undefined }, seed, mind, role).adjective;
  }
  unit.tactics.role = role;
  unit.tactics.roleRead = true;
}

function conditionsOf(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Array<{ id: string; label: string; rounds?: number; trait?: true; icons?: string[] }> {
  const declared = new Map(definition.sheet.live.conditions.map((entry) => [entry.id, entry.label]));
  const tracked = new Map(combatant.tracked.map((entry) => [entry.condition, entry.rounds]));
  // And what a zone they stand in puts on them while they stay (1.179).
  const zoned = state ? rulesetZoneConditions(state, combatant, definition) : [];
  const ids = new Set([...rulesetCombatConditions(definition, combatant), ...zoned]);
  // What the fight, a zone or their own sheet put on them; the rest only what they are or carry
  // keeps on them all fight (a race's Lucky, a worn item's), which is a trait, not news.
  const put = new Set([
    ...combatant.tracked.filter((entry) => !entry.kept).map((entry) => entry.condition),
    ...zoned,
    ...(combatant.sheet
      ? readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items)
          .conditions.filter((condition) => condition.active)
          .map((condition) => condition.id)
      : []),
  ]);
  return [...ids].map((id) => {
    const rounds = tracked.get(id);
    const icons = rulesetConditionIcons(definition, id);
    return {
      id,
      label: declared.get(id) ?? id,
      ...(typeof rounds === "number" ? { rounds } : {}),
      ...(put.has(id) ? {} : { trait: true as const }),
      ...(icons.length ? { icons } : {}),
    };
  });
}

/** What a standard action left a combatant doing until their next turn, for the fight's badges. */
function stancesOf(combatant: RulesetCombatant): DirectedRulesetCombatant["stances"] {
  const stances: NonNullable<DirectedRulesetCombatant["stances"]> = [];
  if (combatant.flags.dodging) stances.push("dodging");
  if (combatant.hiding?.from.length) stances.push("hidden");
  if (combatant.flags.disengaged) stances.push("disengaged");
  if (combatant.readied) stances.push("readied");
  return stances.length ? stances : undefined;
}

function deathTrackOf(definition: RulesetDefinition, combatant: RulesetCombatant) {
  const dying = definition.combat?.dying;
  // Only the party rolls against death; an opponent at zero is out, sheet or no sheet.
  if (!dying || combatant.side !== "party" || !combatant.sheet) return undefined;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
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
  // What one of it is called, for a player paying with it (1.378): "a 2nd-level slot".
  const unitOf = (id: string) => {
    const declared = definition.sheet.live.pools.find((pool) => pool.id === id);
    return declared?.unit ? { unit: declared.unit } : {};
  };
  // The ruleset may name them itself, in its own order (1.375).
  const named = definition.combat?.display?.pools;
  if (named) {
    const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
    const pools = named.flatMap((id) =>
      live.pools
        .filter((pool) => pool.key === id && !pool.listId && pool.max > 0)
        .map((pool) => ({ id: pool.key, label: pool.label, value: pool.value, max: pool.max, ...unitOf(pool.key) })),
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
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
  const pools = live.pools
    .filter((pool) => !pool.listId && pool.max > 0 && spent.has(pool.key))
    .map((pool) => ({ id: pool.key, label: pool.label, value: pool.value, max: pool.max, ...unitOf(pool.key) }));
  return pools.length ? pools : undefined;
}
/** What is done by praying whatever the ruleset marks (1.786): a Channel Divinity, a turning, a prayer. */
const PRAYED_BY_NAME =
  /\b(?:channel divinity|turn(?:s|ing)? (?:the )?(?:undead|faithless|unholy)|divine intervention|pray(?:s|ers?|ing)?|worship)\b/i;

/** The ids of what a combatant casts by praying (1.786), in a ruleset with `combat.poses` only. */
function rulesetPrayedOptions(definition: RulesetDefinition, combatant: RulesetCombatant): string[] {
  if (!definition.combat?.poses) return [];
  return combatant.actions
    .filter((action) => action.divine || PRAYED_BY_NAME.test(action.label))
    .map((action) => action.id);
}

/** Who has prayed since their own turn last began (1.786): a "prayed" of theirs after their last "turn". */
function rulesetPraying(fight: RulesetFightState): Set<string> {
  const praying = new Set<string>();
  for (const { event } of fight.events) {
    if (event.type === "turn") praying.delete(event.actorId);
    else if (event.type === "prayed") praying.add(event.actorId);
  }
  return praying;
}

function projectCombatant(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state: RulesetEncounterState,
  /** Whose turn it is, when one is taking it. */
  attacker: RulesetCombatant | undefined,
  /** Who has prayed since their turn began (1.786). */
  praying?: ReadonlySet<string>,
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
  // Sneaking (1.786): hidden by Hide or by one of the ruleset's hiding conditions. Only the party's own
  // are told, which says nothing of an opponent the screen should not know.
  const sneaking =
    !!combat.poses &&
    combatant.side === "party" &&
    (!!combatant.hiding ||
      !!combatant.flags.hidden ||
      (combat.poses.hidden ?? []).some((id) => rulesetCombatConditions(definition, combatant).includes(id)));
  const posed = [
    ...(sneaking && !combatant.hiding?.from.length ? (["hidden"] as const) : []),
    ...(praying?.has(combatant.id) ? (["praying"] as const) : []),
  ];
  const stances = posed.length ? [...(stancesOf(combatant) ?? []), ...posed] : stancesOf(combatant);
  return {
    id: combatant.id,
    name: combatant.name,
    side: combatant.side,
    ...(combatant.creature ? { creature: { ...combatant.creature } } : {}),
    initiative: combatant.initiative,
    health,
    // What an attack is rolled against now, with what its conditions add (a Shield's +5), what a
    // dropped shield took away and the cover of the ground it stands on. Against a foe whose turn it
    // is, the cover and high ground between them too: the number the log will say. With no such foe,
    // only what holds against a blow from anywhere.
    ...((against) => ({ defense: against.defense, ...(against.cover > 0 ? { cover: against.cover } : {}) }))(
      rulesetDefenseAgainst(
        definition,
        combat,
        state,
        combatant,
        attacker && attacker.side !== combatant.side ? attacker : undefined,
      ),
    ),
    conditions: conditionsOf(definition, combatant, state),
    ...(stances ? { stances } : {}),
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
    ...(combatant.away?.surrendered ? { surrendered: true as const } : {}),
    ...(combatant.away?.left ? { left: true as const } : {}),
    ...(combatant.surprised ? { surprised: true as const } : {}),
    ...(combatant.carried?.length
      ? { carrying: rulesetCarriedLeft(combatant).map((one) => ({ name: one.name, count: one.count })) }
      : {}),
    // A party member's hands, for the In hand row (2026-10-26).
    ...((hands) => (hands ? { hands } : {}))(
      combatant.side === "party" ? rulesetInHand(definition, combatant) : undefined,
    ),
    ...(deathTrack ? { deathTrack } : {}),
    ...(combatant.signature && combatant.signature.max > 0 && !combatant.defeated
      ? { legendary: { points: combatant.signature.points, max: combatant.signature.max } }
      : {}),
    ...((pools) => (pools ? { pools } : {}))(spentPoolsOf(definition, combatant)),
    ...(saveModifiers.length ? { saveModifiers } : {}),
    ...(() => {
      // Its creature type and tags, by their labels (1.168).
      const kinds = combat.creatureTypes;
      const kind = rulesetCreatureKind(definition, combatant);
      if (!kinds || (kind.type === undefined && !kind.tags.length)) return {};
      const type = kinds.types.find((one) => one.id === kind.type)?.label;
      // A creature's card names its own tags, and its alignment in its own words beside them: the
      // tags its alignment names ("Evil", "Neutral") are for the rules to read, not a list to print.
      const alignment = combatant.block?.alignment?.trim();
      const shown = combatant.block
        ? kind.tags.filter((tag) => (combatant.block!.tags ?? []).includes(tag))
        : kind.tags;
      const tags = shown.map((tag) => kinds.tags?.find((one) => one.id === tag)?.label ?? tag);
      return {
        kind: { ...(type ? { type } : {}), ...(tags.length ? { tags } : {}), ...(alignment ? { alignment } : {}) },
      };
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
    // Drawn praying as it casts these, and sneaking while hidden (1.786): never read by the rules. Only
    // the party's own are told hidden, which says nothing of an opponent the screen should not know.
    ...(() => {
      const prays = rulesetPrayedOptions(definition, combatant);
      return prays.length ? { prays } : {};
    })(),
    ...(sneaking ? { hidden: true as const } : {}),
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
  const asked = rulesetCombatant(encounter, actorId);
  // A guard that cannot turn this hit aside (Shield against a roll it does not beat, or a natural
  // 20) is not offered: taking it would only spend it.
  const menu = inWindow
    ? rulesetWindowOptions(definition, encounter, actorId).filter(
        (option) => !asked || rulesetAnswerDeflects(definition, encounter, asked, option.id) !== false,
      )
    : rulesetCombatOptions(definition, encounter, actorId).filter((option) => !option.futile);
  const offered = menu.map((option) => {
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
    // Paying out of a higher pool is offered only where it gains something (more dice, more
    // targets, a level that stops or ends more) or where only a higher pool can pay now: Misty Step
    // and Shield are cast as they are.
    const grows = !!action && rulesetPaidLevelMatters(action);
    const payWith = option.payWith && (grows || option.upcastOnly) ? option.payWith : undefined;
    const { payWith: _offered, ...rest } = option;
    const targetIds = fallers ?? rulesetOptionTargets(definition, encounter, actorId, option);
    // The odds for each target a player may pick, where there is more than one to pick between.
    const hitChances =
      targetIds.length > 1 && option.forecast?.hitChance !== undefined
        ? rulesetHitChances(definition, encounter, actorId, option.id, targetIds)
        : undefined;
    // The whole forecast for each one it may be pointed at, where there is a choice between them.
    const forecastFor =
      targetIds.length > 1 && option.forecast && !option.area
        ? rulesetForecastsByTarget(definition, encounter, actorId, option.id, targetIds)
        : undefined;
    // And the chance each fails the save, for one that calls for a save: Hold Person's.
    const saveChances =
      targetIds.length > 0 && action?.save && option.forecast?.hitChance === undefined
        ? rulesetSaveFailChances(definition, encounter, actorId, option.id, targetIds)
        : undefined;
    // How far each one is, and whom it cannot reach or see now and why (laptop 2026-10-25).
    const positioned = !!encounter.board && !!actor && option.targets.count > 0 && !option.area;
    const distances = positioned
      ? Object.fromEntries(
          targetIds.flatMap((id) => {
            const target = rulesetCombatant(encounter, id);
            return target && id !== actorId && rulesetPositionOf(target)
              ? [[id, rulesetCombatantDistance(encounter, actor!, target)] as const]
              : [];
          }),
        )
      : undefined;
    const beyond =
      positioned && !fallers ? rulesetTargetsBeyond(definition, encounter, actorId, option, targetIds) : [];
    // What each way of paying is worth in levels, for an alteration that counts them (Sculpt Spells).
    const levels =
      payWith && actor && action && option.alters?.some((offer) => offer.sparesByLevel)
        ? {
            base: rulesetPaidLevel(definition, actor, action),
            pay: Object.fromEntries(payWith.map((pool) => [pool, rulesetPaidLevel(definition, actor, action, pool)])),
          }
        : undefined;
    const answer =
      inWindow && encounter.window?.trigger.kind === "hit" && option.kind !== "end-turn"
        ? heldHitAnswer(definition, encounter, actorId, option, targetIds, encounter.window.trigger)
        : undefined;
    const raisesDefense =
      answer?.to !== undefined ? { to: answer.to, ...(answer.misses ? { misses: answer.misses } : {}) } : undefined;
    return {
      ...rest,
      ...(payWith ? { payWith, payLabels: rulesetPoolLabels(definition, payWith) } : {}),
      ...(levels ? { levels } : {}),
      targetIds,
      ...(forecastFor && Object.keys(forecastFor).length > 0 ? { forecastFor } : {}),
      ...(raisesDefense ? { raisesDefense } : {}),
      ...(answer?.halvesTo !== undefined ? { halvesTo: answer.halvesTo } : {}),
      ...(aim.length > 0 ? { aim } : {}),
      ...(hitChances && Object.keys(hitChances).length > 0 ? { hitChances } : {}),
      ...(saveChances && Object.keys(saveChances).length > 0 ? { saveChances } : {}),
      ...(distances && Object.keys(distances).length > 0 ? { distances } : {}),
      ...(beyond.length > 0 ? { beyond } : {}),
    };
  });
  // Treating somebody with nobody to treat is no choice: pulling a friend out of a cube nobody is
  // in, or first aid with nobody dying, is left off rather than offered all fight. Readying one of
  // them is left off with it: there is nobody to wait to treat either.
  return offered.filter((option) => {
    const id = option.ready?.optionId ?? option.id;
    const contest = asked?.actions.find((one) => one.id === id)?.contest;
    if (!(contest?.pulls || contest?.targetHolds || contest?.targetDying)) return true;
    return (option.ready ? offered.find((one) => one.id === id) : option)?.targetIds.length ? true : false;
  });
}

/** Whether paying for an action out of a higher pool changes anything it does: more dice or targets
 *  or a bigger shape, a level that stops (Counterspell) or ends (Dispel Magic) more, a held spell
 *  harder to end, healing that grows with its level. */
function rulesetPaidLevelMatters(action: RulesetCombatAction): boolean {
  return (
    !!action.use?.perCostStep ||
    !!action.use?.targetsPerStep ||
    !!action.area?.sizePerCostStep ||
    action.reaction?.upTo === "paid" ||
    !!action.endsSpells ||
    !!action.ends ||
    !!action.concentration ||
    !!action.healAdd?.length ||
    !!action.healsSelf?.length ||
    !!action.altered?.sparesByLevel
  );
}

/** What the sheet calls each pool, by id ("3rd-level slots" for `slots_3`), for a menu to show. */
function rulesetPoolLabels(definition: RulesetDefinition, pools: string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const pool of pools) {
    const id = rulesetItemSlotPayment(pool)?.pool ?? pool;
    const label = definition.sheet.live.pools.find((one) => one.id === id)?.label;
    if (label) labels[id] = label;
  }
  return labels;
}

/** What a window holds while it is answered, where that is something being used (1.116): the level
 *  it was paid at and where an area of it was aimed, for a prompt that says what it would stop. */
function rulesetHeldUse(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  window: NonNullable<RulesetEncounterState["window"]>,
):
  | {
      level: number;
      at?: { x: number; y: number };
      targetIds?: string[];
      cells?: Array<{ x: number; y: number }>;
    }
  | undefined {
  const resume = window.resume;
  if (
    (resume?.kind !== "action" && resume?.kind !== "answer") ||
    (window.trigger.kind !== "used" && window.trigger.kind !== "aimed")
  )
    return undefined;
  const caster = rulesetCombatant(encounter, resume.actorId);
  const action = caster?.actions.find((entry) => entry.id === resume.optionId);
  if (!caster || !action) return undefined;
  // Whom it would catch and where, so the one asked sees what they would stop: the ones it was aimed
  // at, everybody its area takes in, and that area on the board. An answer is aimed at whoever cast
  // what it answers.
  const lay =
    resume.kind === "action"
      ? {
          ...(resume.toward ? { toward: resume.toward } : {}),
          ...(resume.ring ? { ring: true } : {}),
          ...(resume.also ? { also: resume.also } : {}),
        }
      : undefined;
  const at = resume.kind === "action" ? resume.at : undefined;
  const targetIds = [
    ...new Set([
      ...(resume.kind === "action" ? resume.targetIds : []),
      ...(window.trigger.kind === "aimed" ? (window.trigger.targetIds ?? []) : []),
      ...(at ? rulesetAreaTargets(encounter, caster.id, action.id, at, lay) : []),
    ]),
  ];
  const cells = at ? rulesetAimedCells(encounter, caster.id, action.id, at, lay) : [];
  return {
    level: rulesetPaidLevel(definition, caster, action, resume.payWith),
    ...(at ? { at: { ...at } } : {}),
    ...(targetIds.length ? { targetIds } : {}),
    ...(cells.length ? { cells: cells.map((cell) => ({ x: cell.x, y: cell.y })) } : {}),
  };
}

/** Each answer that stops what is held only up to its own level (1.116), with whether it does so
 *  outright or the check it needs: what a player weighs before spending a Counterspell. */
function rulesetCounterOdds(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  window: NonNullable<RulesetEncounterState["window"]>,
  answeringId: string,
  options: DirectedRulesetOption[],
): DirectedRulesetOption[] {
  const held = rulesetHeldUse(definition, encounter, window);
  const answering = rulesetCombatant(encounter, answeringId);
  if (!held || !answering) return options;
  return options.map((option) => {
    const action = answering.actions.find((entry) => entry.id === option.id);
    if (action?.reaction?.upTo !== "paid") return option;
    const reach = rulesetPaidLevel(definition, answering, action);
    if (held.level <= reach) return { ...option, counter: { sure: true, level: reach } };
    const above = action.reaction.above;
    return {
      ...option,
      counter: { level: reach, ...(above ? { dc: above.dc + held.level, modifier: above.modifier } : {}) },
    };
  });
}

type HeldHit = Extract<NonNullable<RulesetEncounterState["window"]>["trigger"], { kind: "hit" }>;

/** What taking one answer to a held hit does to the defense it is checked against: the answer is
 *  taken on a copy of the fight with every die at its middle, and the defense read again. Nothing
 *  when it does not raise it (a counter-strike, or a reaction aimed elsewhere). */
function heldHitAnswer(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  option: RulesetCombatOption,
  targetIds: string[],
  hit: HeldHit,
): { to?: number; misses?: true; halvesTo?: number } | undefined {
  const combat = definition.combat;
  if (!combat) return undefined;
  const struckId = hit.targetIds?.[0] ?? actorId;
  const before = rulesetCombatant(encounter, struckId);
  const resisted = (one: RulesetCombatant) =>
    rulesetCombatEffects(definition, combat, one, encounter).has("resist-all");
  // The one struck leads, when the answer may go to them: a reaction shielding an ally.
  // Named by nobody (a window weighed as a whole): on its holder when it is one they take on
  // themselves, else on the one struck. Sent at nobody, a Parry was put on the attacker and read as
  // turning nothing (cloud AI fights 2026-10-25).
  const named = targetIds.length > 0 ? targetIds : option.targets.side === "self" ? [actorId] : [struckId];
  const aimed = named.includes(struckId) ? [struckId, ...named.filter((id) => id !== struckId)] : named;
  try {
    // In no planning pass at all: the view's pass remembers each sheet as it stands, and this answer
    // changes what the struck one holds, then reads it again within the same step.
    const step = withoutRulesetPlanMemo(() =>
      applyRulesetCombatChoice(
        definition,
        encounter,
        { actorId, optionId: option.id, targetIds: aimed.slice(0, Math.max(0, option.targets.count)) },
        (sides) => Math.ceil(sides / 2),
      ),
    );
    const struck = rulesetCombatant(step.state, struckId);
    const source = rulesetCombatant(step.state, hit.sourceId);
    if (!struck) return undefined;
    const heldId = hit.optionId.startsWith(RULESET_LAIR_OPTION_PREFIX)
      ? hit.optionId.slice(RULESET_LAIR_OPTION_PREFIX.length)
      : hit.optionId;
    const action = source?.actions.find((one) => one.id === heldId);
    // The hit looked at again once the answer is up says what it came to: a Parry's +3 is gone again
    // by the time the step ends, so the defense read after it is the old one (cloud AI fights
    // 2026-10-25: "letGo" on a Longsword 24 against 16, which Parry's 19 could never turn).
    const rechecked = step.events.find(
      (event): event is Extract<RulesetCombatEvent, { type: "recheck" }> =>
        event.type === "recheck" && event.targetId === struckId && event.actorId === hit.sourceId,
    );
    const to = Math.max(
      rulesetDefenseAgainst(definition, combat, step.state, struck, source, action).defense,
      rechecked?.defense ?? -Infinity,
    );
    const missed = rechecked ? rechecked.outcome === "miss" : hit.total < to;
    if (to > hit.defense) return { to, ...(missed ? { misses: true as const } : {}) };
    // One that halves the hit's harm instead (Uncanny Dodge) says about what it comes to (laptop
    // playtest 2026-10-23), as a raised defense says whether the hit misses.
    if (before && !resisted(before) && rulesetCombatEffects(definition, combat, struck, step.state).has("resist-all")) {
      const stakes = heldHitStakes(definition, encounter, hit, actorId);
      if (stakes !== undefined) return { halvesTo: Math.floor(stakes / 2) };
    }
    return undefined;
  } catch (error) {
    logger.debug(error, "[game/combat:ruleset] could not preview %s's answer %s to a held hit", actorId, option.id);
    return undefined;
  }
}

/** About how much a held hit's damage comes to against the one it hit. */
function heldHitStakes(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  hit: HeldHit,
  /** The one being asked, who was hit where the hit names nobody else. */
  askedId: string,
): number | undefined {
  const struckId = hit.targetIds?.[0] ?? askedId;
  const damage = rulesetForecastsByTarget(definition, encounter, hit.sourceId, hit.optionId, [struckId])[struckId]
    ?.averageDamage;
  return damage !== undefined && Math.round(damage) > 0 ? Math.round(damage) : undefined;
}

/** What spells called up that strike from a square of their own, standing on the board. */
function rulesetSummonsShown(
  encounter: RulesetEncounterState,
): Array<{ casterId: string; label: string; x: number; y: number }> {
  return encounter.combatants.flatMap((caster) =>
    rulesetCombatStanding(caster)
      ? (caster.summons ?? []).flatMap((summon) =>
          summon.at && summon.rounds > 0
            ? [{ casterId: caster.id, label: summon.label, x: summon.at.x, y: summon.at.y }]
            : [],
        )
      : [],
  );
}
/** Whether the party may give itself up (combat AI T6): every opponent still standing is one the
 *  Engine plays as honourable. */
function rulesetPartyMayYield(state: CombatDirectorState, encounter: RulesetEncounterState): boolean {
  const standing = encounter.combatants.filter(
    (one) => one.side !== "party" && !one.object && one.calledBy === undefined && rulesetCombatStanding(one),
  );
  return (
    standing.length > 0 &&
    standing.every((one) => state.enemies?.find((unit) => unit.id === one.id)?.tactics?.adjective === "honourable")
  );
}
/** Who keeps the party from giving itself up, when honour is in the fight at all (laptop 2026-10-30:
 *  the button went away as the captain turned methodical, with nothing on screen saying why). The
 *  standing opponents who are not honourable now, once one standing is or was. */
function rulesetYieldRefusedBy(state: CombatDirectorState, encounter: RulesetEncounterState): string[] {
  const standing = encounter.combatants
    .filter((one) => one.side !== "party" && !one.object && one.calledBy === undefined && rulesetCombatStanding(one))
    .map((one) => ({ one, tactics: state.enemies?.find((unit) => unit.id === one.id)?.tactics }));
  const honour = standing.some(
    ({ tactics }) => tactics?.adjective === "honourable" || tactics?.shiftedFrom === "honourable",
  );
  return honour ? standing.filter(({ tactics }) => tactics?.adjective !== "honourable").map(({ one }) => one.name) : [];
}

/** The fight as a screen reads it. A projection: no sheet build, no live blob and no catalogs.
 *  Nothing changes while it is drawn, so every fighter's sheet is worked out once for it, however
 *  many options, targets and forecasts read it. */
export function directedRulesetView(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  viewer: RulesetFightCommander = RULESET_ROOM_HOST,
): DirectedRulesetView | undefined {
  return withRulesetPlanMemo(() => rulesetViewOf(definition, state, viewer));
}

function rulesetViewOf(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  viewer: RulesetFightCommander,
): DirectedRulesetView | undefined {
  const fight = fightOf(state);
  if (!fight || !definition.combat) return undefined;
  // In a shared room (2026-10-26) the menu, and who is set down, are the viewer's own only.
  const theirs = (id: string) => rulesetMayCommand(fight, id, viewer);
  const room = !!fight.players && Object.keys(fight.players).length > 0;
  const partyIds = fight.encounter.combatants.filter((one) => one.side === "party").map((one) => one.id);
  const encounter = fight.encounter;
  const praying = rulesetPraying(fight);
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
  // What the party's companions set up that still stands, for the player's turn (Alyssa 2026-10-24).
  const callouts = over ? [] : rulesetCallouts(definition, state, fight);
  return {
    ruleset: { ...encounter.ruleset },
    round: encounter.round,
    ...(!over && rulesetPartyMayYield(state, encounter) ? { canYield: true as const } : {}),
    ...(() => {
      const refusedBy = over ? [] : rulesetYieldRefusedBy(state, encounter);
      return refusedBy.length > 0 ? { yieldRefusedBy: refusedBy.slice(0, 8) } : {};
    })(),
    order: [...encounter.order],
    ...(grid && distance
      ? {
          grid: {
            width: grid.width,
            height: grid.height,
            tiles: grid.tiles.map((row) => [...row]),
            ...(grid.elevation ? { elevation: grid.elevation.map((row) => [...row]) } : {}),
            ...(grid.walls ? { walls: { ...grid.walls } } : {}),
            ...(grid.outside ? { outside: grid.outside.map((row) => [...row]) } : {}),
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
    // Nobody is on turn while the party is set down (re-test 2026-10-24: the turn order marked the
    // first in initiative "On turn" before Begin).
    ...(actor && !over && !fight.deploy ? { actorId: actor.id } : {}),
    // Who the player sets down before the first turn, and where they may (2026-10-24).
    ...(fight.deploy && !over
      ? {
          deploy: {
            ids: rulesetDeployers(state, fight).filter(theirs),
            cells: fight.deploy.cells.map((cell) => ({ x: cell.x, y: cell.y })),
          },
        }
      : {}),
    controller,
    ...(fight.lead ? { lead: fight.lead } : {}),
    ...(room
      ? {
          players: Object.fromEntries(
            partyIds.flatMap((id) => {
              const player = rulesetUnitPlayer(fight, id);
              return player ? [[id, { ...player }] as const] : [];
            }),
          ),
          yours: partyIds.filter(theirs),
        }
      : {}),
    ...(callouts.length ? { callouts } : {}),
    combatants: encounter.combatants.map((combatant) =>
      projectCombatant(definition, combatant, encounter, actor && !over ? actor : undefined, praying),
    ),
    // The areas spells left standing (1.172), drawn on the board and listed beside it.
    ...(rulesetZonesShown(encounter).length > 0 ? { zones: rulesetZonesShown(encounter) } : {}),
    // What spells called up, where it strikes from: a Spiritual Weapon's square.
    ...(grid && rulesetSummonsShown(encounter).length > 0 ? { summons: rulesetSummonsShown(encounter) } : {}),
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
            ...(held.window.trigger.kind === "spend"
              ? { spend: { by: held.window.trigger.by, hit: held.window.trigger.hit } }
              : {}),
            actorId: held.actorId,
            waiting: Math.max(0, held.window.waiting.length - 1),
            ...(held.window.trigger.kind === "leaves-reach" ? { moverId: held.window.trigger.moverId } : {}),
            ...(held.window.trigger.kind === "readied" ? { readied: held.window.trigger.on } : {}),
            ...("sourceId" in held.window.trigger ? { sourceId: held.window.trigger.sourceId } : {}),
            ...("targetIds" in held.window.trigger ? { targetIds: held.window.trigger.targetIds } : {}),
            ...(rulesetWindowMoment(held.window.trigger) ? { moment: rulesetWindowMoment(held.window.trigger)! } : {}),
            ...("label" in held.window.trigger ? { label: held.window.trigger.label } : {}),
            ...(held.window.trigger.kind === "hit"
              ? ((hit, stakes) => ({
                  total: hit.total,
                  defense: hit.defense,
                  ...(stakes !== undefined ? { stakes } : {}),
                }))(held.window.trigger, heldHitStakes(definition, encounter, held.window.trigger, held.actorId))
              : {}),
            // What is held, with whom it would catch and the cells its area covers, laid as it was aimed:
            // what a board tints while the ones it would catch decide whether to answer.
            ...((what) =>
              what
                ? {
                    held: what,
                    ...(what.targetIds ? { targetIds: what.targetIds } : {}),
                    ...(grid && what.cells ? { cells: what.cells } : {}),
                  }
                : {})(rulesetHeldUse(definition, encounter, held.window)),
            controller: held.controller,
          },
          ...(held.controller === "manual" && !state.window && theirs(held.actorId)
            ? {
                options: rulesetCounterOdds(
                  definition,
                  encounter,
                  held.window,
                  held.actorId,
                  rulesetMenu(definition, encounter, held.actorId, true),
                ),
              }
            : {}),
        }
      : actor && !over && controller === "manual" && !state.window && theirs(actor.id)
        ? { options: rulesetMenu(definition, encounter, actor.id) }
        : {}),
    ...(rulesetCombatIsSymbol(definition.combat) ? { spends: { choose: !!fight.chooseSpends } } : {}),
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
  /** A dodge, a getaway or a hide taken in place of an attack (1.761): made where it stands, and a
   *  getaway walks off to `to` once it is taken. */
  defensive?: "dodge" | "disengage" | "hide";
  /** Where the actor walks to before doing it, on a board. The move is its own step, resolved
   *  through the same menu a player's would be. */
  to?: { x: number; y: number };
  /** What a closing walk costs of the movement left, so a sprint is taken only when it is short. */
  walked?: number;
  /** The harm it is expected to do, before any of it is weighed against health: a blow's average
   *  times its chance to land. */
  expected?: number;
  /** Whom of the other side it would likely drop, for orders that spare them. */
  drops?: string[];
  /** An end of its turn because every blow it had would kill, under orders to spare (laptop
   *  2026-10-25: such a turn read "nothing worth the price"). */
  spares?: true;
  /** A blow that might kill, taken under orders to spare because it is the last of its side up. */
  spareYields?: true;
  /** Why it is worth more against its target than its forecast says (I1), for its reasons. */
  edge?: RulesetBlowEdge;
  /** A limited use thrown at worse than even odds: whom it would like to hit adds nothing to it. */
  poorOdds?: true;
  /** A closing walk that stopped apart from its own side under an opponent's blast (S1c). */
  spread?: true;
  /** What of its `damage` is the harm it keeps its target from doing, by taking its turns away (a
   *  stun, a hold): the reason it gives is that, not the harm it deals. */
  denies?: number;
  /** What of its `damage` is the harm a friend gains in the fight by what it puts on them (a
   *  blessing, a rage): the reason it gives is the help. */
  boosts?: number;
  /** What of its `damage` is what its side can make of it next (a hold before a smite): the reason
   *  it gives is the set-up, and its companions call it out. */
  combo?: number;
}

/** How many cells a turn is weighed from. The board is small and a turn is short, so this is a
 *  ceiling on the enumeration rather than a rule anybody can feel.
 *  ponytail: the cheapest cells, cut at a fixed number. The upgrade path is to rank them by what
 *  they open up before cutting, which needs a scoring pass this slice does not have. */
const RULESET_MOVE_CANDIDATE_CELLS = 48;
/** How long the picker may spend weighing places to walk to before it settles for those it weighed.
 *  On every board the Engine draws it is done long before; this is what keeps a huge imported board
 *  or a creature with a hundred options from holding the server while it thinks. */
const RULESET_MOVE_PLAN_MS = 2000;

/** The largest board on which a shape is also aimed from the cells an actor could walk to. The
 *  generator's own largest board is 14 by 10; this is a few times that. */
const RULESET_AREA_WALK_BOARD_CELLS = 400;

/** What one strike on the way is worth against doing the thing at all: enough that a creature will
 *  not walk through three people's reach for a marginally better target, and not so much that it
 *  will stand still rather than take one hit to reach the only enemy it can fight. */
const RULESET_PROVOKE_PENALTY = 0.25;
/** How close to its hardest blow one must come for a mind's lean to count on it (re-test 13). */
const RULESET_FOCUS_ALIKE = 0.97;

/**
 * Everything the actor could do, scored the way every other combat AI in the Engine is scored.
 * The menu is the only source of legality, so the picker can never choose something a player could
 * not, and the option's own forecast is the only thing it is allowed to know about the dice.
 */
/** Whether a choice's bolt along a line (1.190) would run through somebody on its wielder's own side:
 *  from where it is thrown, nearest cell to nearest cell, as the bolt itself is laid. */
function rulesetLineCatchesFriend(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidate: CombatAiCandidate<RulesetCandidate>,
): boolean {
  const mode = candidate.action.choice.mode;
  if (mode === undefined || !encounter.board?.grid) return false;
  const line = actor.actions
    .find((one) => one.id === candidate.action.option.id)
    ?.modes?.find((one) => one.id === mode)?.line;
  const targetId = candidate.action.choice.targetIds[0] ?? candidate.targetId;
  const target = targetId ? rulesetCombatant(encounter, targetId) : undefined;
  const standing = candidate.action.to ?? rulesetPositionOf(actor);
  if (!line || !target || !standing) return false;
  const from = rulesetNearestCell({ ...actor, x: standing.x, y: standing.y }, rulesetPositionOf(target));
  const to = rulesetNearestCell(target, from);
  if (!from || !to) return false;
  const cells = new Set(rulesetPathCells(from, to).map((cell) => `${cell.x},${cell.y}`));
  return encounter.combatants.some(
    (one) =>
      one.id !== actor.id &&
      one.id !== target.id &&
      one.side === actor.side &&
      !one.defeated &&
      rulesetFootprint(one).some((at) => cells.has(`${at.x},${at.y}`)),
  );
}

function rulesetCandidates(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** The Game Master's window is shown everything; the Engine's own picker is not (see the end). */
  everything = false,
  /** Who it is (1.761): a careful, cowardly or patient one keeps its dodge, getaway and hide. */
  tactics?: CombatTactics,
  /** A companion's standing orders: one told to hold its ground weighs nowhere else to stand. */
  orders?: CombatOrders,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const worth = (candidate: CombatAiCandidate<RulesetCandidate>) => (candidate.damage ?? 0) + (candidate.healing ?? 0);
  const here = rulesetCandidatesFrom(definition, encounter, actorId, null);
  const moved = orders?.posture === "hold" ? [] : rulesetCandidatesAfterMoving(definition, encounter, actorId);
  // Standing still is preferred when it can already do its best from where it is: a candidate that
  // walks first has to be strictly better than every one that does not, not merely as good. A
  // treatment of a friend down that hangs on a check is not that best: it is weighed against the
  // walk to a blow once both are in hand (laptop 2026-10-26: Garrick's first aid beside him, 9 against
  // DC 10, cut every walk to the Archlich his move would have reached; see `weighRulesetDowned`).
  const staying = here.reduce(
    (most, candidate) => (rulesetChecksOnDowned(encounter, candidate) ? most : Math.max(most, worth(candidate))),
    0,
  );
  // One that stands by its friends or fights beside them (1.761) also weighs walking to an opponent it
  // cannot reach from here, where it is worth anything: whoever is on a friend.
  const roams = tactics?.adjective === "protective" || tactics?.adjective === "coordinated";
  const reachable = new Set(here.map((candidate) => candidate.targetId));
  // Standing in burning oil or a Cloud of Daggers: a step out of it that does as much is weighed too,
  // so the danger it stands in can tell them apart.
  const actor = rulesetCombatant(encounter, actorId);
  const home = rulesetPositionOf(actor);
  const burning = actor && home ? rulesetZoneHarmAt(encounter, actor, home) : 0;
  // Where staying would likely finish it at its next turn's start, any step out is weighed, whatever
  // it does from there (playtest 2026-10-23: cultists that stayed in Spirit Guardians to die).
  const deadly = !!actor && !!home && rulesetZoneKillsAt(definition, encounter, actor, home);
  // A thrower standing in an opponent's reach weighs the same throw from a step out of it (I1b).
  const reachedHere = !!actor && !!home && rulesetFoeReachesCell(definition, encounter, actor, home);
  const clear = (candidate: CombatAiCandidate<RulesetCandidate>) =>
    reachedHere &&
    !!actor &&
    !!candidate.action.to &&
    worth(candidate) > 0 &&
    worth(candidate) >= staying &&
    rulesetThrowsFrom(encounter, actor, candidate, candidate.action.to) &&
    !rulesetFoeReachesCell(definition, encounter, actor, candidate.action.to);
  const cooler = (candidate: CombatAiCandidate<RulesetCandidate>) =>
    burning > 0 &&
    !!actor &&
    !!candidate.action.to &&
    (worth(candidate) >= staying || deadly) &&
    rulesetZoneHarmAt(encounter, actor, candidate.action.to) < burning;
  const candidates = [
    ...here,
    ...moved.filter(
      (candidate) =>
        worth(candidate) > staying ||
        cooler(candidate) ||
        clear(candidate) ||
        (roams && worth(candidate) > 0 && candidate.targetId !== undefined && !reachable.has(candidate.targetId)),
    ),
  ];
  // And where staying would likely finish it, it does not stay when it can get out: the scoring
  // weighs danger by what is at stake on the turn, which a scratch of a blow makes nearly nothing.
  if (deadly && actor) {
    const out = candidates.filter((candidate) =>
      candidate.action.to
        ? !rulesetZoneKillsAt(definition, encounter, actor, candidate.action.to)
        : rulesetDefensiveName(candidate.action.option) === "disengage",
    );
    if (out.length) candidates.splice(0, candidates.length, ...out);
  }
  // Somebody who can hurt an opponent or help a friend does that. The scoring weighs a blow by the
  // share of the target's health it takes, so against a sturdy target a careful creature would score
  // a standard action (dodging, say) above every attack it has and stand there all fight. A standard
  // action or an empty turn is what is left when there is nothing better, never a rival. Judged over
  // the WHOLE list, walks included, so a creature that has to take a step first still takes it.
  if (everything) return candidates;
  // A free trait taken before an attack (1.606) is taken as the attack is made, never in its place.
  const own = candidates.filter((candidate) => {
    const action = actor?.actions.find((one) => one.id === candidate.action.option.id);
    if (action?.free && action.beforeAttack) return false;
    // Told to hold its ground: a dash or a getaway goes nowhere it may go, so it is a wasted turn.
    if (orders?.posture === "hold" && candidate.action.option.kind === "standard") {
      const name = rulesetStandardName(candidate.action.option.id);
      if (name === "dash" || name === "disengage") return false;
    }
    return true;
  });
  // What comes off as its holder ends a turn having struck nobody (1.436, 5e's Rage) is wasted when
  // nothing it could do this turn harms an opponent: the use is spent and it ends with the turn
  // (cloud AI fights 2026-10-25: a Frenzy entered for a one-cell step, an Exhaustion for nothing).
  if (actor && !actor.stirred) {
    const strikes = [...here, ...moved].some((candidate) => {
      const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
      return (candidate.damage ?? 0) > 0 && !!target && target.side !== actor.side;
    });
    const idle = new Set(
      (definition.combat?.conditions ?? []).filter((rule) => rule.endsIdle).map((rule) => rule.condition),
    );
    if (!strikes && idle.size > 0)
      for (let index = own.length - 1; index >= 0; index--) {
        const option = own[index]!.action.option;
        const action = actor.actions.find((one) => one.id === option.id);
        const puts = [...(action?.applies ?? []), ...(action?.appliesSelf ?? [])];
        const onSelf = option.targets.side === "self" || (action?.appliesSelf ?? []).length > 0;
        if (
          onSelf &&
          puts.some(
            (one) => idle.has(one.condition) && !actor.tracked.some((entry) => entry.condition === one.condition),
          )
        )
          own.splice(index, 1);
      }
  }
  // Nor is it entered again while it holds: the use is spent for nothing (laptop playtest 2026-10-25:
  // Ulfgar raged again in round 4 while raging, struck nobody, and the rage ended with the turn).
  if (actor) {
    const idle = new Set(
      (definition.combat?.conditions ?? []).filter((rule) => rule.endsIdle).map((rule) => rule.condition),
    );
    const holds = actor.tracked.filter((entry) => idle.has(entry.condition)).map((entry) => entry.condition);
    if (holds.length > 0)
      for (let index = own.length - 1; index >= 0; index--) {
        const option = own[index]!.action.option;
        const action = actor.actions.find((one) => one.id === option.id);
        const puts = [...(action?.applies ?? []), ...(action?.appliesSelf ?? [])];
        const onSelf = option.targets.side === "self" || (action?.appliesSelf ?? []).length > 0;
        if (onSelf && puts.some((one) => holds.includes(one.condition))) own.splice(index, 1);
      }
  }
  // A bolt along a line (1.190) catches whoever stands between its wielder and the target, friend or
  // foe: one that would run through a friend is not thrown that way (cloud AI fights 2026-10-25: a
  // Javelin of Lightning's bolt through Vex and the called horses).
  if (actor)
    for (let index = own.length - 1; index >= 0; index--)
      if (rulesetLineCatchesFriend(encounter, actor, own[index]!)) own.splice(index, 1);
  // Helping is aiding a friend against an opponent beside its helper: with none beside it, nothing
  // comes of it (a wolf helping from across the field, a companion helping a friend nobody is near).
  const beside = (cell: { x: number; y: number } | null | undefined) =>
    !!actor &&
    !!cell &&
    encounter.combatants.some(
      (one) =>
        one.side !== actor.side &&
        rulesetCombatStanding(one) &&
        !!rulesetPositionOf(one) &&
        rulesetGapFrom(cell, rulesetSpanOf(actor), one) <= 1,
    );
  for (let index = own.length - 1; index >= 0; index--) {
    const candidate = own[index]!;
    if (candidate.action.option.kind !== "standard" || rulesetStandardName(candidate.action.option.id) !== "help")
      continue;
    if (actor && rulesetPositionOf(actor) && !beside(candidate.action.to ?? rulesetPositionOf(actor)))
      own.splice(index, 1);
  }
  const keeps = !!actor && rulesetKeepsDefensive(definition, encounter, actor, tactics, orders);
  // Nothing to hurt or help from anywhere it can get to this turn: a dodge, a getaway or a hide only
  // for one that keeps to them (and not past two turns of it). Anybody else goes looking for the
  // fight, which a defensive pick would stop it doing, so healthy wolves would hide all fight. A
  // limited use at poor odds is no reason to give up ending the turn: it is weighed against keeping it.
  if (!own.some((candidate) => worth(candidate) > 0 && !candidate.action.poorOdds))
    return keeps
      ? own
      : own.filter(
          (candidate) =>
            rulesetDefensiveName(candidate.action.option) === undefined ||
            (!!actor && rulesetKeepsGrantedDefensive(definition, encounter, actor, tactics, candidate.action.option)),
        );
  return own.filter(
    (candidate) =>
      (!candidate.hold && candidate.action.option.kind !== "standard") ||
      (keeps && rulesetDefensiveName(candidate.action.option) !== undefined),
  );
}

/** The standard actions a creature may take in place of an attack to keep itself whole (1.761). */
function rulesetDefensiveName(option: RulesetCombatOption): RulesetCandidate["defensive"] {
  if (option.kind !== "standard") return undefined;
  const name = rulesetStandardName(option.id);
  return name === "dodge" || name === "disengage" || name === "hide" ? name : undefined;
}

/** Whether a dodge or getaway an ability of its own grants on another budget (a monk's Patient
 *  Defense and Step of the Wind, a rogue's Cunning Action) is weighed with nothing better left to do
 *  this turn: by anybody but a mindless or reckless one, hurt and standing where a turn of blows
 *  would take a good share of what it has left (class re-test 2026-10-24: never once used). */
function rulesetKeepsGrantedDefensive(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics | undefined,
  option: RulesetCombatOption,
): boolean {
  if (!option.grantedBy || rulesetDefensiveName(option) === undefined || !definition.combat) return false;
  if (!tactics || tactics.mind === "mindless" || tactics.adjective === "reckless" || tactics.adjective === "fanatical")
    return false;
  if ((tactics.wary ?? 0) >= 2) return false;
  const health = rulesetCombatHealth(definition, definition.combat, actor);
  if (health.value >= health.max * 0.75) return false;
  const home = rulesetPositionOf(actor);
  return !home || rulesetDangerAt(definition, encounter, actor, home) >= 0.3;
}

/** Whether a creature weighs dodging, getting away or hiding against its attacks (1.761): a careful,
 *  cowardly or patient one once it has lost a quarter and stands where a turn of blows would take a
 *  good share of what it has left, any of them and an animal once it is down to half, and one told to
 *  keep back wherever it is in danger. Never a mindless one, and never a whole one: a creature at full
 *  health fights on rather than dodging all fight. */
/** The health a combatant has to lose before it is in danger: a form with health of its own (1.392)
 *  stands in front of its holder's, which is still there once the form is spent (cloud batch
 *  2026-10-25: a druid's Wolf at 2 of its 5 hid and dodged, with all of the druid's 38 behind it). */
function rulesetHealthToSpend(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  actor: RulesetCombatant,
): ReturnType<typeof rulesetCombatHealth> {
  const health = rulesetCombatHealth(definition, combat, actor);
  if (!actor.shape?.health) return health;
  const own = rulesetCombatHealth(definition, combat, { ...actor, shape: undefined });
  return { value: health.value + own.value, max: health.max + own.max, temp: health.temp + own.temp };
}

function rulesetKeepsDefensive(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics | undefined,
  orders?: CombatOrders,
): boolean {
  if (!tactics || tactics.mind === "mindless" || !definition.combat) return false;
  // Told to get out of the fight, or to keep out of harm's way.
  if (orders?.posture === "retreat") return true;
  // Two turns of it in a row and nothing has changed: it fights again, or the fight never ends.
  if ((tactics.wary ?? 0) >= 2) return false;
  const careful =
    orders?.posture === "back" ||
    tactics.adjective === "cautious" ||
    tactics.adjective === "cowardly" ||
    tactics.adjective === "patient";
  if (!careful && tactics.mind !== "instinct") return false;
  const health = rulesetHealthToSpend(definition, definition.combat, actor);
  if (health.value < health.max * 0.5) return true;
  // An animal minds itself once it is hurt, not before: a wolf beside its prey bites rather than
  // dodging because the prey could hit back.
  if (!careful) return false;
  // Kept out of harm's way by its player: wherever a turn of blows would take a good share of it.
  const home = rulesetPositionOf(actor);
  const endangered = !!home && rulesetDangerAt(definition, encounter, actor, home) >= 0.3;
  if (orders?.posture === "back") return endangered;
  // A careful creature is careful sooner, once it has lost a quarter, but a whole one fights: an orc
  // at full health beside a hurt rogue swings rather than dodging half the fight (playtest).
  return health.value < health.max * 0.75 && endangered;
}

/**
 * The harm a combatant would stand in at a cell (1.761), as a share of what it has left: for every
 * opponent still standing, the worst of its blows that could reach it there next turn, in full from
 * where it is and at half from a walk away. What the cautious weigh against standing there.
 */
/** What budgets handed over for this turn (Action Surge, Flurry of Blows) buy now, as the average
 *  harm of the best blow they pay for times how many: nothing unless the turn's own of each is
 *  already spent, and something paid from it reaches a standing opponent from here or from where
 *  the movement left takes it. A blow its menu pays from the budget counts, as well as one written
 *  with it (class pass 2026-10-24: Flurry's unarmed strikes, the strike's own budget the action). */
function rulesetGiftStrikes(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  gives: Array<{ budget: string; count?: number }>,
  /** Whom its orders or its ground keep it near: it walks nowhere off that to strike. */
  leash?: RulesetLeash,
): number {
  const here = rulesetPositionOf(actor);
  const span = rulesetSpanOf(actor);
  // Where it could still stand this turn, walked the way the board lets it: a foe across a pit is
  // not in reach for being near in a straight line.
  let stands: Array<{ x: number; y: number }> | undefined;
  const reaches = (foe: RulesetCombatant, reach: number) => {
    if (!here) return true;
    if (rulesetGapFrom(here, span, foe) <= reach) return true;
    // Nor is one it would have to leave its charge to reach (laptop 2026-10-26: a guarding fighter
    // spent his Action Surge on a foe off his leash, and never struck with it).
    stands ??= rulesetWalkableCells(definition, encounter, actor.id).filter(
      (cell) => !leash || rulesetGapFrom(cell, span, leash.charge) <= leash.within,
    );
    return stands.some((cell) => rulesetGapFrom(cell, span, foe) <= reach);
  };
  // Only what its menu would offer with the budget in hand: a handaxe in its pack is not a blow.
  const offered = (budget: string) => {
    const before = actor.budgets[budget];
    actor.budgets[budget] = 1;
    try {
      return new Map(rulesetCombatOptions(definition, encounter, actor.id).map((option) => [option.id, option]));
    } finally {
      if (before === undefined) delete actor.budgets[budget];
      else actor.budgets[budget] = before;
    }
  };
  let best = 0;
  for (const gift of gives) {
    if ((actor.budgets[gift.budget] ?? 0) > 0) continue;
    const menu = offered(gift.budget);
    for (const action of actor.actions) {
      const option = menu.get(action.id);
      const paid =
        (option?.budget ?? action.budget) === gift.budget ||
        (actor.strikeGrants ?? []).some(
          (grant) => grant.budget === gift.budget && (!grant.names || rulesetAttackNamed(action.label, grant.names)),
        );
      if (!option || !paid || !(action.damage || action.sequence)) continue;
      const reached = encounter.combatants.some(
        (foe) =>
          foe.side !== actor.side &&
          rulesetCombatStanding(foe) &&
          !foe.down &&
          reaches(foe, rulesetActionReach(action)),
      );
      if (!reached) continue;
      // A Multiattack's parts are not read here: it counts as a blow bought, worth at least a little.
      const average = Math.max(0.01, rulesetSafeAverage(action.damage) * Math.max(1, action.strikes ?? 1));
      best = Math.max(best, average * Math.max(1, gift.count ?? 1));
    }
  }
  return best;
}

/** The side standing against this one: of the first opponent still standing. */
function rulesetOtherSide(encounter: RulesetEncounterState, actor: RulesetCombatant): string {
  return (
    encounter.combatants.find((one) => one.side !== actor.side && rulesetCombatStanding(one))?.side ??
    (actor.side === "party" ? "enemy" : "party")
  );
}

/** The health a side stands up with, on average across its standing members. */
function rulesetSideHealthMean(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  side: string,
): number {
  const pools = encounter.combatants
    .filter((one) => one.side === side && rulesetCombatStanding(one))
    .map((one) => {
      const health = rulesetCombatHealth(definition, combat, one);
      return Math.max(1, health.value + health.temp);
    });
  return pools.length ? pools.reduce((sum, pool) => sum + pool, 0) / pools.length : 1;
}

function rulesetDangerAt(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
  /** Staying there to fight, not getting away: a walk away is no safer than beside it. */
  fights = false,
): number {
  const combat = definition.combat;
  if (!combat) return 0;
  const perCell = combat.distance?.perCell;
  const health = rulesetHealthToSpend(definition, combat, actor);
  const pool = Math.max(1, health.value + health.temp);
  const span = rulesetSpanOf(actor);
  let harm = 0;
  for (const foe of encounter.combatants) {
    if (foe.side === actor.side || !rulesetCombatStanding(foe) || !rulesetPositionOf(foe)) continue;
    const gap = rulesetGapFrom(cell, span, foe);
    const walks = perCell ? rulesetInCells(foe.speed, perCell) : 6;
    let worst = 0;
    for (const action of foe.actions) {
      // Only what it could use: a Sunbeam's line while it holds the spell, not before.
      if (!rulesetActionAvailable(foe, action, encounter, definition)) continue;
      // A block of blows (a Multiattack) as every blow of it lands, from as close as its shortest
      // reach (I1b re-test 2026-10-23: two trolls read as one claw each, so a thrower walked up to
      // them and was felled before its next turn).
      const blows = action.sequence?.length
        ? action.sequence.flatMap((step) => {
            const blow = foe.actions.find((one) => one.id === step.actionId);
            return blow?.damage ? [{ blow, times: step.times ?? 1 }] : [];
          })
        : action.damage
          ? [{ blow: action, times: 1 }]
          : [];
      if (blows.length === 0) continue;
      const average = blows.reduce((sum, { blow, times }) => sum + rulesetSafeAverage(blow.damage!) * times, 0);
      const reach = Math.min(
        ...blows.map(({ blow }) => (blow.range ? (blow.range.long ?? blow.range.normal) : (blow.reach ?? 1))),
      );
      // One a walk away comes on its own turn all the same, so standing a square off it is
      // nearly as dangerous as standing beside it; only the far end of its walk is much safer, to
      // one getting away. To one staying to fight there, anywhere it can walk to and strike is as
      // dangerous as beside it, and no reason to throw from afar instead: a captain walking six
      // squares off a knight who walks six squares back makes nothing safer by it (re-test 14).
      // Only a little less, so between two cells that do alike it takes the further.
      const out = (gap - reach) / Math.max(1, walks);
      const at =
        gap <= reach ? 1 : gap > reach + walks ? 0 : fights ? 1 - 0.1 * out ** 2 : Math.max(0, 1 - 1.1 * out ** 3);
      worst = Math.max(worst, average * at);
    }
    harm += worst;
  }
  harm += rulesetZoneHarmAt(encounter, actor, cell);
  harm += rulesetCrowdHarmAt(definition, encounter, actor, cell);
  return Math.min(3, harm / pool);
}

/** Whether an opponent standing now could strike this cell without taking a step: within the reach
 *  of a blow it has that is not thrown or shot. */
function rulesetFoeReachesCell(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
): boolean {
  const span = rulesetSpanOf(actor);
  return encounter.combatants.some((foe) => {
    if (foe.side === actor.side || !rulesetCombatStanding(foe) || !rulesetPositionOf(foe)) return false;
    const reach = Math.max(
      0,
      ...foe.actions
        .filter(
          (action) => !!action.damage && !action.range && rulesetActionAvailable(foe, action, encounter, definition),
        )
        .map((action) => action.reach ?? 1),
    );
    return reach > 0 && rulesetGapFrom(cell, span, foe) <= reach;
  });
}

/** Whether a candidate is a blow thrown or shot from where it would stand, its target out of the
 *  reach it would have in hand. */
function rulesetThrowsFrom(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidate: CombatAiCandidate<RulesetCandidate>,
  cell: { x: number; y: number },
): boolean {
  const action = actor.actions.find((one) => one.id === candidate.action.option.id);
  const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
  if (!action?.range || !action.damage || !target || !rulesetPositionOf(target)) return false;
  return rulesetGapFrom(cell, rulesetSpanOf(actor), target) > Math.max(1, action.reach ?? 0);
}

/**
 * What standing bunched with its own side adds where an opponent holds a blast it could still use
 * (S1): an area is worth more to its maker the more it catches, so each friend within its size of the
 * cell makes it likelier to land there, a share of its average for each, up to all of it. Any area
 * that harms, whatever the ruleset calls it: a dragon's breath, a fireball, a grenade. Only to one
 * that thinks ahead (S1b, `rulesetCombatantForesees`): a wolf or a zombie closes in as it would
 * anyway, and a goblin only in a fight it thinks of it.
 */
function rulesetCrowdHarmAt(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
): number {
  if (!rulesetCombatantForesees(definition, actor, encounter.seed)) return 0;
  const perCell = definition.combat?.distance?.perCell;
  const span = rulesetSpanOf(actor);
  const friends = encounter.combatants.filter(
    (one) =>
      one.side === actor.side &&
      one.id !== actor.id &&
      !one.object &&
      rulesetCombatStanding(one) &&
      !!rulesetPositionOf(one),
  );
  if (friends.length === 0) return 0;
  let harm = 0;
  for (const foe of encounter.combatants) {
    if (foe.side === actor.side || !rulesetCombatStanding(foe) || !rulesetPositionOf(foe)) continue;
    const gap = rulesetGapFrom(cell, span, foe);
    const walks = perCell ? rulesetInCells(foe.speed, perCell) : 6;
    let worst = 0;
    for (const action of foe.actions) {
      if (!action.area || !action.damage) continue;
      if (!rulesetActionAvailable(foe, action, encounter, definition)) continue;
      if (gap > (action.range?.long ?? action.range?.normal ?? action.area.size) + walks) continue;
      // A burst catches all around its centre; a cone or a line only along one way, so less of it.
      const across = action.area.shape === "burst" ? action.area.size : Math.max(1, Math.floor(action.area.size / 3));
      const caught = friends.filter((one) => rulesetGapFrom(cell, span, one) <= across).length;
      worst = Math.max(worst, rulesetSafeAverage(action.damage) * Math.min(1, 0.3 * caught));
    }
    harm += worst;
  }
  return harm;
}

/**
 * How far from its own side one that thinks ahead keeps while an opponent in reach of it still holds
 * an area that harms (S1a-walk, re-test 2026-10-24): the largest such area's size and one more, as it
 * deployed, so a walk does not undo the spacing it started with. None, 0, for one that does not
 * think of it or with no such area left against it.
 */
function rulesetBlastSpacing(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
): number {
  if (!rulesetCombatantForesees(definition, actor, encounter.seed)) return 0;
  const perCell = definition.combat?.distance?.perCell;
  const span = rulesetSpanOf(actor);
  let needs = 0;
  for (const foe of encounter.combatants) {
    if (foe.side === actor.side || !rulesetCombatStanding(foe) || !rulesetPositionOf(foe)) continue;
    const gap = rulesetGapFrom(cell, span, foe);
    const walks = perCell ? rulesetInCells(foe.speed, perCell) : 6;
    for (const action of foe.actions) {
      if (!action.area || !action.damage) continue;
      if (!rulesetActionAvailable(foe, action, encounter, definition)) continue;
      if (gap > (action.range?.long ?? action.range?.normal ?? action.area.size) + walks) continue;
      const across = action.area.shape === "burst" ? action.area.size : Math.max(1, Math.floor(action.area.size / 3));
      needs = Math.max(needs, across + 1);
    }
  }
  return needs;
}

/** Whether a cell is nearer one of its own side than the spacing it keeps under a blast. */
function rulesetTooCloseUnderBlast(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
): boolean {
  const needs = rulesetBlastSpacing(definition, encounter, actor, cell);
  if (needs < 2) return false;
  const span = rulesetSpanOf(actor);
  return encounter.combatants.some(
    (one) =>
      one.side === actor.side &&
      one.id !== actor.id &&
      !one.object &&
      rulesetCombatStanding(one) &&
      !!rulesetPositionOf(one) &&
      rulesetGapFrom(cell, span, one) < needs,
  );
}

/** The harm a zone at a cell does whoever starts or ends a turn in it, whoever left it (1.761):
 *  burning oil, a Cloud of Daggers, its own side's Spirit Guardians aside (it spares them). */
function rulesetZoneHarmAt(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
  /** Only the areas its own side made. */
  ownSide = false,
): number {
  const filled = rulesetFootprintAt(cell, rulesetSpanOf(actor));
  const from = rulesetPositionOf(actor);
  const standsOn = from ? rulesetFootprintAt(from, rulesetSpanOf(actor)) : [];
  let harm = 0;
  for (const caster of encounter.combatants) {
    if (ownSide && caster.side !== actor.side) continue;
    for (const zone of caster.zones ?? []) {
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      if (!action?.damage) continue;
      const cells = rulesetZoneCells(encounter, caster, zone);
      const covers = (at: ReadonlyArray<{ x: number; y: number }>) =>
        at.some((one) => cells.some((cell) => cell.x === one.x && cell.y === one.y));
      if (!covers(filled)) continue;
      // Struck where it stays, or on the way in by one that strikes whoever enters (a teleport into
      // an aura as much as a walk).
      const strikes = zone.triggers.some(
        (when) => when === "turn-start" || when === "turn-end" || (when === "enter" && !covers(standsOn)),
      );
      if (!strikes) continue;
      if (!rulesetZoneCatches(caster, zone, action, actor)) continue;
      harm += rulesetSafeAverage(action.damage);
    }
  }
  return harm;
}

/** What the lasting areas it would walk INTO on its way strike it for (I3 re-test 2026-10-24: a rogue
 *  that walked through his own burning oil to reach a ghoul): each area once, leaving out one it
 *  already stands in and one it ends in, which `rulesetZoneHarmAt` counts where it lands. */
function rulesetPathZoneHarm(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  path: ReadonlyArray<{ x: number; y: number }>,
  /** Only the areas its own side made. */
  ownSide = false,
): number {
  const from = rulesetPositionOf(actor);
  if (!from || path.length < 2) return 0;
  const span = rulesetSpanOf(actor);
  const end = path[path.length - 1]!;
  const footprints = (cell: { x: number; y: number }) => rulesetFootprintAt(cell, span);
  let harm = 0;
  for (const caster of encounter.combatants) {
    if (ownSide && caster.side !== actor.side) continue;
    for (const zone of caster.zones ?? []) {
      if (!zone.triggers.includes("enter")) continue;
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      if (!action?.damage || !rulesetZoneCatches(caster, zone, action, actor)) continue;
      const cells = rulesetZoneCells(encounter, caster, zone);
      const covers = (cell: { x: number; y: number }) =>
        footprints(cell).some((one) => cells.some((there) => there.x === one.x && there.y === one.y));
      if (covers(from) || covers(end)) continue;
      if (path.slice(0, -1).some(covers)) harm += rulesetSafeAverage(action.damage);
    }
  }
  return harm;
}

/** What the blows drawn by leaving these opponents' reach come to, each its best strike's average. */
function rulesetPartingHarm(encounter: RulesetEncounterState, provokers: readonly string[]): number {
  return provokers.reduce((sum, id) => {
    const foe = rulesetCombatant(encounter, id);
    const blow = foe && rulesetCombatStanding(foe) ? rulesetOpportunityAttack(foe) : null;
    return sum + (blow?.damage ? rulesetSafeAverage(blow.damage) : 0);
  }, 0);
}

/** Whether a lasting area or aura there would likely finish it (playtest: a mage at 4 health that Misty
 *  Stepped into Spirit Guardians): no cell to step or teleport to, whatever it would gain there. */
function rulesetZoneKillsAt(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: { x: number; y: number },
): boolean {
  const combat = definition.combat;
  if (!combat) return false;
  const harm = rulesetZoneHarmAt(encounter, actor, cell);
  if (harm <= 0) return false;
  const health = rulesetCombatHealth(definition, combat, actor);
  return harm >= health.value + health.temp;
}

/** The cell furthest from every opponent a combatant may walk to (1.761), its danger breaking ties:
 *  where a getaway goes. Null when no cell is further than where it stands. */
function rulesetRetreatCell(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** Opponents it takes along (a hungry one's prey, dragged): no reason to get away from them. */
  bringing: readonly string[] = [],
): { x: number; y: number } | null {
  const actor = rulesetCombatant(encounter, actorId);
  const from = rulesetPositionOf(actor);
  if (!actor || !from || !encounter.board?.grid) return null;
  const foes = encounter.combatants.filter(
    (one) =>
      one.side !== actor.side && rulesetCombatStanding(one) && rulesetPositionOf(one) && !bringing.includes(one.id),
  );
  if (foes.length === 0) return null;
  const span = rulesetSpanOf(actor);
  const nearest = (cell: { x: number; y: number }) => Math.min(...foes.map((foe) => rulesetGapFrom(cell, span, foe)));
  let best: { cell: { x: number; y: number }; away: number; danger: number } | null = null;
  const here = nearest(from);
  for (const cell of rulesetWalkableCells(definition, encounter, actorId)) {
    const away = nearest(cell);
    if (away <= here) continue;
    const danger = rulesetDangerAt(definition, encounter, actor, cell);
    // Never into a gap it has to squeeze into (re-test 14 and 15: a crocodile that dragged its prey
    // into a corner gap, or a gap between rocks, and bit at a disadvantage for twelve rounds).
    if (span > 1 && rulesetSqueezeAt(definition, encounter, actor, cell)) continue;
    if (!best || away > best.away || (away === best.away && danger < best.danger))
      best = { cell: { x: cell.x, y: cell.y }, away, danger };
  }
  return best?.cell ?? null;
}

/**
 * The rest of what a creature weighs beside harm and help (1.761), onto each candidate: the danger it
 * would stand in (`risk`), less for a dodge or a hide, and a getaway's from the cell it would run to;
 * standing up for a friend an opponent is on (`protection`), more for one who is hurt or who it
 * guards; and going at whoever its own side is already on (`coordination`).
 */
function weighRulesetTeam(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
  orders?: CombatOrders,
): void {
  const combat = definition.combat;
  if (!combat) return;
  const home = rulesetPositionOf(actor);
  const dangers = new Map<string, number>();
  const danger = (cell: { x: number; y: number }, fights = true) => {
    const key = `${cell.x},${cell.y},${fights}`;
    if (!dangers.has(key)) dangers.set(key, rulesetDangerAt(definition, encounter, actor, cell, fights));
    return dangers.get(key)!;
  };
  const reached = new Map<string, boolean>();
  const reaches = (cell: { x: number; y: number }) => {
    const key = `${cell.x},${cell.y}`;
    if (!reached.has(key)) reached.set(key, rulesetFoeReachesCell(definition, encounter, actor, cell));
    return reached.get(key)!;
  };
  const allies = encounter.combatants.filter(
    (one) => one.side === actor.side && one.id !== actor.id && rulesetCombatStanding(one),
  );
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  const near = (a: RulesetCombatant, b: RulesetCombatant) =>
    !!rulesetPositionOf(a) && !!rulesetPositionOf(b) && rulesetGap(a, b) <= 1;
  const hurt = (one: RulesetCombatant) => {
    const health = rulesetCombatHealth(definition, combat, one);
    return health.value < health.max * 0.5;
  };
  const threatened = allies.filter((ally) => foes.some((foe) => near(ally, foe)));
  const units = new Map([...state.party, ...state.enemies].map((unit) => [unit.id, unit]));
  const focus = new Set(allies.map((ally) => units.get(ally.id)?.tactics?.targetId).filter(Boolean));
  // Only one that means to keep itself whole takes these in place of closing in: anybody else's
  // standard action is what is left when nothing is in reach, and it walks instead.
  const keeps = rulesetKeepsDefensive(definition, encounter, actor, units.get(actor.id)?.tactics, orders);
  const role = units.get(actor.id)?.tactics?.role;
  // Getting away from nobody gets it nothing: with no opponent beside it, Disengage is left out (a
  // goblin's Nimble Escape spent eight times out in the open), and so it is with no walk left to
  // get away on.
  if (!foes.some((foe) => near(actor, foe)) || (actor.movement !== undefined && (actor.movementLeft ?? 0) < 1)) {
    const kept = candidates.filter((candidate) => rulesetDefensiveName(candidate.action.option) !== "disengage");
    if (kept.length > 0) candidates.splice(0, candidates.length, ...kept);
  }
  // Hidden already, hiding again gets it nothing (laptop playtest 2026-10-23: a rogue hid twice in a
  // turn, the second with its bonus action).
  if (actor.hiding) {
    const kept = candidates.filter((candidate) => rulesetDefensiveName(candidate.action.option) !== "hide");
    if (kept.length > 0) candidates.splice(0, candidates.length, ...kept);
  }
  // Nor dodging when it dodges already (laptop party A: a monk's Patient Defense, then the Dodge).
  if (actor.flags.dodging) {
    const kept = candidates.filter((candidate) => rulesetDefensiveName(candidate.action.option) !== "dodge");
    if (kept.length > 0) candidates.splice(0, candidates.length, ...kept);
  }
  for (const candidate of candidates) {
    const defensive =
      keeps ||
      rulesetKeepsGrantedDefensive(definition, encounter, actor, units.get(actor.id)?.tactics, candidate.action.option)
        ? rulesetDefensiveName(candidate.action.option)
        : undefined;
    if (defensive) {
      candidate.action.defensive = defensive;
      candidate.hold = true;
      candidate.setup = 0;
    }
    if (home) {
      if (defensive === "disengage") {
        const away = rulesetRetreatCell(definition, encounter, actor.id);
        candidate.risk = away ? danger(away, false) : danger(home, false);
        if (away) candidate.action.to = away;
      } else {
        const cell = candidate.action.to ?? home;
        // Hiding is worth something only out of an opponent's reach: next to one, it is seen.
        const seen = foes.some((foe) => near(actor, foe));
        candidate.risk = danger(cell) * (defensive === "dodge" ? 0.7 : defensive === "hide" && !seen ? 0.6 : 1);
        // Walking in among its own side under a blast it kept clear of, to strike or cast, is as bad
        // as taking a full blow (re-test 2026-10-24: Elara walked to 3 from Pip to cast a Fire Bolt
        // with the mage's Fireball unspent). Standing where it already is costs nothing more.
        if (
          candidate.action.to &&
          rulesetTooCloseUnderBlast(definition, encounter, actor, cell) &&
          !rulesetTooCloseUnderBlast(definition, encounter, actor, home)
        )
          candidate.risk += 1;
        // And what it walks through to get there: burning oil on the way is harm all the same. A walk
        // carries the cells it crosses (from `rulesetWalkableCells`).
        const path = (candidate.action.to as { path?: Array<{ x: number; y: number }> } | undefined)?.path;
        if (path?.length) {
          const crossed = rulesetPathZoneHarm(encounter, actor, path);
          if (crossed > 0) {
            const own = rulesetCombatHealth(definition, combat, actor);
            candidate.risk += Math.min(3, crossed / Math.max(1, own.value + own.temp));
          }
        }
        // And the blows it draws leaving somebody's reach on the way, weighed as that harm against the
        // health it has left: a scratch to one who is whole, its end to one nearly down (cheap-GM
        // playtest 2026-10-26: a companion at 5 health walked out of melee and was struck twice), so it
        // walks out through them only when nothing it could do from where it stands is worth as much.
        const provokers = (candidate.action.to as { provokes?: readonly string[] } | undefined)?.provokes;
        if (!defensive && provokers?.length) {
          const parting = rulesetPartingHarm(encounter, provokers);
          if (parting > 0) {
            const own = rulesetCombatHealth(definition, combat, actor);
            candidate.risk += Math.min(3, parting / Math.max(1, own.value + own.temp));
          }
        }
        // A throw or a shot made from inside an opponent's reach (I1b re-test 2026-10-24: a thrower
        // that threw 10 of 12 times from within a troll's reach): there it strikes without spending
        // its walk, and stepping away later draws its blow, so the same throw from out of reach is
        // safer than "a walk away" reads.
        if (!defensive && rulesetThrowsFrom(encounter, actor, candidate, cell) && reaches(cell)) candidate.risk *= 1.25;
        // Mending itself lowers the danger it stands in as much as the health it gains: what could
        // fell it at 2 health is a quarter of that at 9 (re-test 2026-10-24: a cleric at 2 of 27 kept
        // her potion back for later in Spirit Guardians).
        const self =
          candidate.targetId === actor.id || (!candidate.targetId && candidate.action.option.targets.side === "self");
        if (!defensive && self && (candidate.healing ?? 0) > 0) {
          const own = rulesetCombatHealth(definition, combat, actor);
          const pool = Math.max(1, own.value + own.temp);
          candidate.risk *= pool / (pool + candidate.healing! * Math.max(1, own.max));
        }
      }
    }
    // Where it ends up (combat AI A1): beside a friend an opponent is on, which a bulwark stands up
    // for, and beside a hurt one, which a supporter keeps close to.
    const lands = candidate.action.to;
    const beside = (ally: RulesetCombatant) => {
      const at = rulesetPositionOf(ally);
      return !!lands && !!at && Math.max(Math.abs(at.x - lands.x), Math.abs(at.y - lands.y)) <= 1;
    };
    const covers = lands ? threatened.filter(beside).length : 0;
    if (role === "supporter" && lands && allies.some((ally) => hurt(ally) && beside(ally)))
      candidate.support = (candidate.support ?? 0) + 0.15;
    // Standing up for a friend is worth less the more it would cost the one doing it: where the
    // opponents could fell it in a turn, half as much (I1b re-test 2026-10-24: a frail rogue that
    // walked into two trolls' reach to stand up for the fighter, and was felled).
    const shielding = (worth: number) => (home ? worth / (1 + danger(lands ?? home)) : worth);
    const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
    if (!target || target.side === actor.side) {
      if (covers > 0) candidate.protection = shielding(Math.min(1, 0.3 * covers));
      continue;
    }
    const guarding = threatened.filter((ally) => near(ally, target));
    if (guarding.length > 0 || covers > 0)
      candidate.protection = shielding(
        Math.min(1, guarding.reduce((sum, ally) => sum + 0.5 + (hurt(ally) ? 0.3 : 0), 0) + 0.3 * covers),
      );
    const engaged = allies.filter((ally) => near(ally, target)).length;
    // From across the target from a friend already on it (combat AI A1): a flank, a skirmisher's.
    const there = rulesetPositionOf(target);
    const flanks =
      !!lands &&
      !!there &&
      allies.some((ally) => {
        const at = rulesetPositionOf(ally);
        return (
          !!at &&
          near(ally, target) &&
          Math.sign(at.x - there.x) === -Math.sign(lands.x - there.x) &&
          Math.sign(at.y - there.y) === -Math.sign(lands.y - there.y)
        );
      });
    const together = Math.min(1, 0.35 * engaged + (focus.has(target.id) ? 0.3 : 0) + (flanks ? 0.3 : 0));
    if (together > 0) candidate.coordination = together;
  }
}

/** What a mindless creature does (1.761): whoever it went for, while they stand, else whoever is
 *  nearest, and nothing between turns but strike at one walking away. */
function mindlessCandidates(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
  menu: boolean,
): Array<CombatAiCandidate<RulesetCandidate>> {
  if (menu) {
    if (encounter.window?.trigger.kind === "leaves-reach") return candidates;
    const pass = candidates.filter((candidate) => candidate.hold);
    return pass.length > 0 ? pass : candidates;
  }
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  const kept = foes.find((one) => one.id === tactics.targetId);
  const target = kept ?? [...foes].sort((a, b) => rulesetGap(actor, a) - rulesetGap(actor, b))[0];
  if (!target) return candidates;
  const at = candidates.filter((candidate) => candidate.targetId === target.id && (candidate.damage ?? 0) > 0);
  return at.length > 0 ? at : candidates;
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
  // Open ground before a gap it would squeeze into, as near (re-test 17).
  const squeezes = new Map<string, number>();
  const squeezed = (cell: { x: number; y: number }) => {
    if (span <= 1 && !actor.squeezedFrom) return 0;
    const key = `${cell.x},${cell.y}`;
    if (!squeezes.has(key)) squeezes.set(key, rulesetSqueezeAt(definition, encounter, actor, cell) ? 1 : 0);
    return squeezes.get(key)!;
  };
  // Never through a lasting area its own side laid that harms whoever enters it, nor into one, for
  // anything it would do from there (re-test 2026-10-24: a rogue that stepped into his own burning
  // oil to scatter caltrops, or to stab an ogre, at 7 health). One already standing in one may still
  // walk out of it.
  const from = rulesetPositionOf(actor);
  const inOwn = !!from && rulesetZoneHarmAt(encounter, actor, from, true) > 0;
  const open = inOwn
    ? cells
    : cells.filter(
        (cell) =>
          rulesetPathZoneHarm(encounter, actor, cell.path, true) === 0 &&
          rulesetZoneHarmAt(encounter, actor, cell, true) === 0,
      );
  // A stable sort over an already deterministic list, so the same fight always picks the same cell.
  return [...open].sort(
    (left, right) => away(left) - away(right) || squeezed(left) - squeezed(right) || left.cost - right.cost,
  );
}

/** What blows from a squeeze gap are worth against the same from open ground: about what a
 *  disadvantage takes off a middling chance to hit. */
const RULESET_SQUEEZED_BLOWS = 0.6;

function rulesetCandidatesAfterMoving(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const actor = rulesetCombatant(encounter, actorId);
  if (!encounter.board?.grid || !actor || typeof actor.x !== "number" || typeof actor.y !== "number") return [];
  const cells = rulesetWalkableCells(definition, encounter, actorId).slice(0, RULESET_MOVE_CANDIDATE_CELLS);
  if (cells.length === 0) return [];
  const home = {
    x: actor.x,
    y: actor.y,
    movementLeft: actor.movementLeft,
    span: actor.span,
    squeezedFrom: actor.squeezedFrom,
  };
  const span = rulesetSpanOf(actor);
  const candidates: Array<CombatAiCandidate<RulesetCandidate>> = [];
  const deadline = Date.now() + RULESET_MOVE_PLAN_MS;
  for (const cell of cells) {
    // The places nearest an opponent come first, so what a long think leaves out mattered least.
    if (Date.now() > deadline) break;
    // Squeezed into a gap there, it fills less of itself, and reaches only from what it fills (cloud
    // AI fights 2026-10-25: a Draft Horse walked to strike a bandit from beside the water, squeezed
    // to one cell on arriving, could no longer reach him, and readied a Shove instead).
    const squeeze = span > 1 || actor.squeezedFrom ? rulesetSqueezeAt(definition, encounter, actor, cell) : undefined;
    // Standing the actor in the cell, as much of itself as fits there, for exactly as long as the
    // menu is read from it. Nothing else is touched, and everything is put straight back, so the
    // fight is the one it was. The allowance is emptied for the pass because a candidate that walks
    // here has spent it getting here, and the picker never chains a second walk onto one.
    actor.x = cell.x;
    actor.y = cell.y;
    actor.movementLeft = 0;
    if (squeeze) {
      actor.squeezedFrom = home.squeezedFrom ?? span;
      actor.span = squeeze.span;
    } else if (home.squeezedFrom !== undefined) {
      actor.span = home.squeezedFrom;
      delete actor.squeezedFrom;
    }
    let from: Array<CombatAiCandidate<RulesetCandidate>> = [];
    try {
      from = rulesetCandidatesFrom(definition, encounter, actorId, cell);
    } finally {
      actor.x = home.x;
      actor.y = home.y;
      actor.movementLeft = home.movementLeft;
      if (home.span === undefined) delete actor.span;
      else actor.span = home.span;
      if (home.squeezedFrom === undefined) delete actor.squeezedFrom;
      else actor.squeezedFrom = home.squeezedFrom;
    }
    // A blow it walks into may break what it holds as well (laptop party A: a warlock walked out of
    // reach and lost her Hypnotic Pattern to the parting blow): about half the time it is lost.
    const holding =
      actor.concentrating && definition.combat && cell.provokes.length > 0
        ? 0.5 * Math.min(1, rulesetHeldWorth(definition, definition.combat, encounter, actor))
        : 0;
    const penalty = cell.provokes.length * (RULESET_PROVOKE_PENALTY + holding);
    // Blows from a gap it squeezes into are at a disadvantage the menu read here does not know of
    // yet; blows from open ground, once squeezed, are out of the one it has (re-test 17: a
    // crocodile biting from a gap for fifty rounds with open ground beside Brom).
    const scale = squeeze ? RULESET_SQUEEZED_BLOWS : actor.squeezedFrom ? 1 / RULESET_SQUEEZED_BLOWS : 1;
    for (const candidate of from) {
      if (candidate.damage !== undefined) candidate.damage = Math.max(0, candidate.damage * scale - penalty);
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

/** How far the fight leans its actor's way, as what keeping a one-off item is worth: 0 for an even
 *  fight or a worse one, up to 0.75 when the other side's health is next to nothing beside its own. */
function rulesetFightEase(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): number {
  const combat = definition.combat;
  if (!combat) return 0;
  const total = (mine: boolean) =>
    encounter.combatants
      .filter((one) => (one.side === actor.side) === mine && !one.object && rulesetCombatStanding(one))
      .reduce((sum, one) => {
        const health = rulesetCombatHealth(definition, combat, one);
        return sum + Math.max(0, health.value + health.temp);
      }, 0);
  const own = total(true);
  const theirs = total(false);
  if (own + theirs <= 0) return 0;
  return Math.max(0, own / (own + theirs) - 0.5) * 1.5;
}

/** What something it puts on itself costs it once it is over, a level of a track for each (5e's
 *  Frenzy, a level of exhaustion as the rage ends): half a use's worth, and dearer the easier the
 *  fight looks (class re-test 2026-10-24). */
function rulesetAfterPrice(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  spare: number,
): number {
  if (option.targets.side !== "self") return 0;
  const action = actor.actions.find((one) => one.id === option.id);
  let levels = 0;
  for (const applied of action?.applies ?? []) {
    if (!rulesetSheetWithin(definition, actor, applied.when)) continue;
    const rule = definition.combat?.conditions?.find((one) => one.condition === applied.condition);
    for (const track of rule?.onEnd?.tracks ?? []) levels += Math.max(0, track.by);
  }
  return levels * (0.5 + spare);
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
  const share = rulesetPoolShare(definition, actor);
  const spare = rulesetFightEase(definition, encounter, actor);
  for (const option of menu ?? rulesetCombatOptions(definition, encounter, actor.id)) {
    const base =
      (option.cost ?? []).reduce((total, entry) => total + share(entry.pool, entry.amount), 0) +
      rulesetSignaturePrice(encounter, actor, option) +
      // An item used up by using it (a flask of oil, a vial of acid) is not thrown for nothing, and
      // dearer the easier the fight looks (class re-test 2026-10-24: a one-off Potion of
      // Invisibility drunk in round one against every orc band).
      (actor.actions.find((action) => action.id === option.id)?.itemUse?.consumes ? 0.25 + spare : 0) +
      rulesetAfterPrice(definition, actor, option, spare);
    // One that only a higher pool can pay for now (1.171) is never taken at its own price.
    const ways: PricedOption[] = [
      ...(option.upcastOnly ? [] : [{ option, price: base }]),
      ...biggerWays(definition, actor, option, share),
    ];
    // Modes first, so each mode is then made in every style, forecast as that style does.
    out.push(...ways.flatMap(modedWays).flatMap((way) => styledWays(definition, way)));
  }
  return out;
}

/**
 * What a signature action's points cost (a legendary action): nothing once there are no more moments
 * left before its own turn than points to spend in them, since what is not spent by then is lost; a
 * fifth of a point each before that, so the last point is not spent on nothing early in the round.
 * (Cloud batch 2026-10-26: a point priced as a whole foe's health let a legendary priest pass 110 of
 * 151 moments with Sacred Flame on offer.)
 */
function rulesetSignaturePrice(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
): number {
  const signature = option.signature;
  if (!signature) return 0;
  const order = encounter.order;
  const own = order.indexOf(actor.id);
  let left = 0;
  if (own >= 0 && order.length > 0) {
    // The moment at the end of this turn, and one at the end of every other turn before its own.
    for (let step = 0; step < order.length; step++) {
      const id = order[(encounter.turn + step) % order.length]!;
      if (id === actor.id) break;
      const one = rulesetCombatant(encounter, id);
      if (one && !one.defeated) left += 1;
    }
  }
  return left <= signature.points ? 0 : signature.cost * 0.2;
}

/**
 * What spending `amount` of one pool costs its spender. The fewer left, the dearer each one, so the
 * last is kept for when it matters (half again its price) and a full pool is spent freely. The party
 * carries what it keeps into the next fight, so each one is dear to it; an opponent has only this
 * fight to spend it in, so to it each one is the share of the pool it is (laptop playtest 2026-10-25:
 * a druid with four of its smallest pool never spent one, each priced as much as a whole foe's
 * health, and cast its free blast all fight). A pool with no maximum to read, or an actor with no
 * sheet, prices it at its amount.
 */
function rulesetPoolShare(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
): (pool: string, amount: number) => number {
  const pools = actor.sheet
    ? new Map(
        readRulesetLive(definition, actor.sheet.build, actor.sheet.live, actor.sheet.items).pools.map((pool) => [
          pool.key,
          pool,
        ]),
      )
    : undefined;
  return (key, amount) => {
    const pool = pools?.get(key);
    const scale = actor.side === "enemy" && pool && Number.isFinite(pool.max) && pool.max > 0 ? pool.max : 1;
    return (amount / scale) * (1 + 0.5 / Math.max(1, pool?.value ?? Infinity));
  };
}

/** The bigger ways of paying for one option: once per pool it could be paid from, each with its
 *  own label, cost and forecast. None for something that grows no bigger. */
function biggerWays(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  share: (pool: string, amount: number) => number,
): PricedOption[] {
  const action = actor.actions.find((entry) => entry.id === option.id);
  // What grows paid bigger, or what can only be paid out of another pool now (1.171).
  const grows = !!action?.use?.perCostStep || !!action?.use?.targetsPerStep;
  if (!action || (!grows && !option.upcastOnly)) return [];
  // A heal is paid from the least pool that pays for it, whose few points more are seldom worth a
  // bigger one (cloud caster re-test 2026-10-26: Healing Word from 8th, 5th and 4th level slots with
  // 2nd and 3rd left, and from a 2nd with a 1st left).
  if (option.heals && !option.upcastOnly) return [];
  const ways: PricedOption[] = [];
  for (const pool of option.payWith ?? []) {
    const steps = rulesetCostSteps(definition, action, pool, actor);
    if (steps < 1 && !option.upcastOnly) continue;
    // What it grows by comes every so many steps (cloud pass 2026-10-25: a Spiritual Weapon out of a
    // 3rd-level slot, which adds nothing until the 4th): a pool that reaches no new step adds nothing.
    const grown = action.use?.stepsEvery ? Math.floor(steps / action.use.stepsEvery) : steps;
    if (grown < 1 && !action.use?.targetsPerStep && !option.upcastOnly) continue;
    const paid = planRulesetCombatCost(definition, actor, action, pool);
    if (!paid) continue;
    const extra = action.use?.perCostStep ? grown * rulesetAverageAmount(action.use.perCostStep) : 0;
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
      // An opponent's each step above its own rung a little dearer again, on its share of the pool,
      // so the small one is still cast when it does; what grows no bigger, much dearer, so a big slot
      // goes on it only when nothing else would buy more (cloud caster bosses 2026-10-26: Misty Step
      // out of 4th and 5th-level slots, round after round).
      price:
        actor.side === "enemy"
          ? paid.cost.reduce((total, entry) => total + share(entry.pool, entry.amount), 0) *
            (1 + (grows ? 0.25 : 1) * steps)
          : paid.cost.reduce((total, entry) => total + entry.amount, 0) + (grows ? 1 : 3) * steps,
    });
    // What grows no bigger is paid from the least pool that can pay for it, and no other (laptop
    // 2026-10-25: an Entangle out of a 3rd-level slot with a 2nd-level one left), and so is a heal.
    if (!grows || option.heals) break;
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
    trigger.kind !== "turn-start" &&
    trigger.kind !== "caught" &&
    trigger.kind !== "attacked"
  ) {
    return undefined;
  }
  const action = actor.actions.find((entry) => entry.id === option.id);
  if (action?.reaction?.at === "target")
    return rulesetReactionTarget(
      encounter,
      actor,
      action,
      trigger.kind,
      trigger.sourceId,
      rulesetWindowCause(encounter, trigger),
    );
  // A Counterspell lands on the cast, whatever its own targets say: a creature's is written as one
  // it casts on itself, and weighed as that it was a slot spent for nothing.
  return action &&
    (rulesetReactionPointsAtSource(action) || (action.reaction?.cancels && action.reaction.at === "source"))
    ? trigger.sourceId
    : undefined;
}

/** How many rounds a cast may take and still be weighed in a fight (see `rulesetCandidatesFrom`). */
const RULESET_LONG_CAST_ROUNDS = 3;

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
    // Nothing can come of it from here: a Hide in the open.
    if (option.futile) continue;
    // Waiting to treat somebody (pulling a friend out of a cube, first aid) is the Game Master's to
    // ready, never the picker's: it would stand there all fight for a turn nobody needs.
    if (option.ready) {
      const contest = actor.actions.find((one) => one.id === option.ready?.optionId)?.contest;
      if (contest?.pulls || contest?.targetHolds || contest?.targetDying) continue;
    }
    // Cast again while what it left still stands, it only puts back what is there and spends another
    // slot on it: a Spiritual Weapon strikes again instead, and a standing zone stays where it is.
    if (
      !menu &&
      (actor.summons?.some((one) => one.actionId === (option.castOf?.optionId ?? option.id)) ||
        actor.zones?.some((one) => one.actionId === (option.castOf?.optionId ?? option.id)))
    )
      continue;
    // Nor an area it holds up still standing, whatever the menu offers (laptop 2026-10-25: a second,
    // bigger Entangle cast while the first held).
    if (
      actor.concentrating?.actionId === (option.castOf?.optionId ?? option.id) &&
      actor.zones?.some((one) => one.actionId === (option.castOf?.optionId ?? option.id))
    )
      continue;
    // A cast that takes many rounds (1.461) is begun before a fight, not in one: the fight is often
    // over before it lands (re-test 2026-10-24: Animate Dead opening fights with its 10 rounds).
    if (
      (actor.actions.find((entry) => entry.id === (option.castOf?.optionId ?? option.id))?.castingRounds ?? 0) >=
      RULESET_LONG_CAST_ROUNDS
    )
      continue;
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
    // A legendary move (1.283) the same way, by where it would take them, and a creature's move on
    // its own turn (1.607): an orc's Aggressive.
    if (
      option.cells &&
      !option.moveAfter &&
      (option.signature || actor.actions.find((one) => one.id === (option.castOf?.optionId ?? option.id))?.move)
    ) {
      const moved = standing ? null : legendaryMoveCandidate(definition, combat, encounter, actor, option, price);
      if (moved) candidates.push(moved);
      continue;
    }
    // Walking is not a candidate of its own: it is what a candidate does before it acts, and a turn
    // with nothing to act on closes the distance instead (see `rulesetClosingMove`).
    if (option.kind === "move") continue;
    // Averting the eyes is settled as the turn starts (see `playRulesetTurn`), and so is slipping free.
    if (option.avert || option.slip) continue;
    // An attack given up for a called creature's (1.488) is its player's own call: the Engine keeps
    // its own attacks.
    if (option.lend) continue;
    // Putting away a weapon put in hand (1.308) is its player's own call: the Engine keeps it.
    if (option.dismiss) continue;
    // So is turning something off, or a light, pulling blows or an item's form: flicked every turn
    // for a guessed worth, it only filled the log. Orders that want blows pulled pull them (P7). An
    // item turned on (a flame tongue lit) is still weighed, once. A lantern only where it is dark
    // enough to want one: lit in daylight it is a turn spent on nothing.
    if (option.on !== undefined) {
      const switches = actor.actions.find((entry) => entry.id === (option.castOf?.optionId ?? option.id))?.switches;
      if (option.on || !switches || !("item" in switches)) continue;
      const item = actor.sheet?.items?.[switches.item]?.item;
      const at = rulesetPositionOf(actor);
      const light = at ? rulesetLightAt(definition, encounter, at) : "bright";
      if ((item?.carried?.light || item?.toggle?.offLight) && (light === "bright" || light === "sunlight")) continue;
    }
    // From another cell, only what the actor would do THERE is worth enumerating: everything it
    // could do without moving is already on the list.
    if (standing && option.targets.count <= 0 && !option.area) continue;
    if (option.kind === "end-turn") {
      candidates.push({ action: { choice: { actorId, optionId: option.id, targetIds: [] }, option }, hold: true });
      continue;
    }
    // A weapon put in hand (1.306), once, before it fights: the one that hits hardest of those it
    // may make or bind. With one in hand already it is never taken again.
    const conjuring = actor.actions.find((entry) => entry.id === (option.castOf?.optionId ?? option.id));
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
      const contest = actor.actions.find((entry) => entry.id === (option.castOf?.optionId ?? option.id))?.contest;
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
        // A shove with nowhere to send them (cornered, or held in place) does nothing (re-test 16).
        const shoves =
          !ally &&
          contest.push !== undefined &&
          !!encounter.board &&
          rulesetPushPath(encounter, actorId, targetId, Math.max(1, contest.push)).length > 0;
        // What it puts on them, read as any condition is and never more than a modest setup: a shove
        // down is worth little to a lone shover, whose target stands up before it could use it.
        const read = holds
          ? rulesetEffectWorth(
              definition,
              combat,
              encounter,
              actor,
              // What a won contest puts on lasts until it is ended (escaping a grapple, standing up).
              {
                applies: (contest.applies ?? []).map((entry) => ({ duration: "until-dispelled", ...entry })),
              } as RulesetCombatAction,
              target,
            )
          : undefined;
        // Somebody it holds already is set up as much as wrestling them will: its blows are what is
        // left (re-test 16, a crocodile shoving the cleric in its jaws a hundred times).
        const mine = !ally && rulesetDragging(definition, encounter, actor).ids.includes(targetId);
        const worth = frees ? 1 : mine ? 0 : holds ? Math.min(0.3, read ?? 0.3) : shoves ? 0.15 : 0;
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
    const fallingAction = actor.actions.find((entry) => entry.id === (option.castOf?.optionId ?? option.id));
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
      if (weighCaught(definition, combat, encounter, actor, option, caught, candidate)) candidates.push(candidate);
      continue;
    }
    const lands = menu ? rulesetWindowTargetOf(encounter, actor, option) : undefined;
    if (option.targets.count <= 0 && !lands) {
      // Holding the thing it is already holding would end it and start it again for the same price.
      if (actor.concentrating?.actionId === (option.castOf?.optionId ?? option.id)) continue;
      const self: CombatAiCandidate<RulesetCandidate> = {
        action: { choice: { actorId, optionId: option.id, targetIds: [], ...paying(way) }, option },
        cost: price,
      };
      if (option.heals && option.targets.side === "self") {
        // Mending itself (Second Wind) is worth what it is missing, and nothing when whole.
        const health = rulesetCombatHealth(definition, combat, actor);
        const worth = rulesetHealingWorth(option.forecast?.averageDamage ?? 0, health);
        if (worth <= 0) continue;
        self.healing = worth;
      } else if (fallingAction?.gives?.length) {
        // A budget handed to itself for this turn (Action Surge) is worth only a blow it can buy:
        // once the turn's own is spent, with something that reaches an opponent from here.
        const bought = rulesetGiftStrikes(definition, encounter, actor, fallingAction.gives);
        if (bought <= 0) continue;
        self.support = 1;
        // And the harm those blows do, as likely to land as a blow mostly is.
        self.damage = Math.min(
          2,
          (bought * 0.65) /
            Math.max(1, rulesetSideHealthMean(definition, combat, encounter, rulesetOtherSide(encounter, actor))),
        );
      } else {
        // What it puts on itself, where that can be read; else the old modest guess.
        const own =
          option.targets.side === "self"
            ? rulesetEffectWorth(definition, combat, encounter, actor, fallingAction, actor)
            : undefined;
        // And what it gains in the fight by it: its blows' harm, the harm kept off it.
        const boost =
          option.targets.side === "self"
            ? rulesetBoostWorth(definition, combat, encounter, actor, fallingAction, actor)
            : 0;
        // Creatures called in, or a form taken, weighed by what the mode brings.
        const mode = way.mode ? fallingAction?.modes?.find((one) => one.id === way.mode) : undefined;
        const call = mode?.call ?? fallingAction?.calls;
        const form = mode?.form;
        if (call || form) {
          const brings = call
            ? rulesetCalledWorth(definition, combat, encounter, actor, call)
            : rulesetFormWorth(definition, combat, encounter, actor, form!);
          if (brings <= 0) continue;
          self.damage = brings;
          candidates.push(self);
          continue;
        }
        if (own === 0 && boost <= 0 && option.kind !== "standard") continue;
        self.setup = option.kind === "standard" ? 0.05 : (own ?? 0.4);
        if (boost > 0) {
          self.damage = boost;
          self.action.boosts = boost;
        }
      }
      candidates.push(self);
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
    const sequenced = !!actor.actions.find((entry) => entry.id === (option.castOf?.optionId ?? option.id))?.sequence;
    const spreads = option.targets.count > 1 && !sequenced;
    for (const targetId of legal) {
      const target = rulesetCombatant(encounter, targetId);
      if (!target) continue;
      // Ammunition kept for what it is for (1.657): an Arrow of Undead Slaying is shot only at one of
      // its kind (laptop handoff 2026-10-30: Nyx shot five at humans with twelve Arrows +1 left; the
      // forecast weighs no save-gated clause, so the two tied and chance picked).
      if (way.mode?.startsWith("shot:")) {
        const stack = actor.sheet?.items?.[Number(way.mode.slice("shot:".length))]?.item;
        const kept = stack?.ammoRider?.plus.filter((clause) => clause.targetIs || clause.not || clause.marked);
        if (
          kept?.length &&
          !kept.some(
            (clause) =>
              (!clause.targetIs || rulesetTargetIs(definition, target, clause.targetIs)) &&
              !(clause.not && rulesetTargetIs(definition, target, clause.not)),
          )
        )
          continue;
      }
      // Whose side the TARGET is on, not whose side the option was written for: an author may let a
      // blast reach either side, and a fight where the Engine drops one on its own party is worse
      // than one where it never does.
      const ally = target.side === actor.side;
      // Out of what its health pool or ceiling reaches (Sleep, Power Word Stun): nothing done to them.
      if (rulesetPoolReaches(definition, combat, actor, fallingAction, [target], way.payWith).length === 0) continue;
      const health = rulesetCombatHealth(definition, combat, target);
      // What joins a blow of its own still to land (a smite) is weighed against what that blow leaves
      // of them: the smite that finishes is worth finishing with (class pass 2026-10-24).
      const pool = Math.max(
        1,
        health.value + health.temp - (lands ? rulesetPendingBlow(encounter, actor, fallingAction) : 0),
      );
      // A symbol fight's forecast hangs on who is aimed at (1.382): their soak, their side's allies,
      // the conditions they already have.
      const aimed =
        !sequenced && option.forecast?.worth !== undefined
          ? (rulesetForecastsByTarget(definition, encounter, actorId, option.id, [targetId])[targetId] ??
            option.forecast)
          : undefined;
      // As likely to land on this one as it is: a dagger thrown far, at disadvantage, against the
      // one beside it. A Multiattack counts each part's own chance in what it is worth, below. A
      // mode or a style has its own forecast, which is kept.
      const chance = aimed
        ? (aimed.hitChance ?? 1)
        : sequenced
          ? 1
          : option.forecast?.hitChance !== undefined && way.mode === undefined && way.style === undefined
            ? (rulesetHitChances(definition, encounter, actorId, option.id, [targetId])[targetId] ??
              option.forecast.hitChance)
            : 1;
      // A Multiattack is worth only the parts that reach this one: a captain's scimitars do nothing
      // to somebody it could only throw a dagger at.
      const forecast =
        (
          aimed ??
          (sequenced
            ? rulesetSequenceForecastAgainst(definition, encounter, actorId, option.id, targetId)
            : option.forecast)
        )?.averageDamage ?? 0;
      // As the target's own hide takes it, on the other side only: a weakness found, a regeneration
      // stopped, an immunity not wasted on (I1).
      const against =
        !ally && !sequenced && fallingAction?.damage
          ? rulesetAverageAgainst(definition, combat, encounter, target, fallingAction, forecast)
          : undefined;
      // A blow that will be a critical counts its dice twice (Alyssa 2026-10-24: a held foe struck from
      // beside it), and so does what joins a hit already a critical (a smite on a natural 20).
      const doubled =
        !ally && fallingAction?.damage
          ? fallingAction.addsToBlow
            ? lands && rulesetHeldCritical(encounter)
            : rulesetWeaponBlow(fallingAction) &&
              rulesetCriticalFromAdjacent(definition, combat, encounter, actor, target)
          : false;
      const dice =
        doubled && fallingAction?.damage ? (fallingAction.damage.count * (fallingAction.damage.sides + 1)) / 2 : 0;
      // What joins a blow past what drops them is spent for nothing: a bigger slot for a smite only
      // as far as the margin a roll may need.
      const joined = (against ? against.worth : forecast) + dice;
      const average = fallingAction?.addsToBlow && lands ? Math.min(joined, pool * 1.25) : joined;
      const candidate: CombatAiCandidate<RulesetCandidate> = {
        action: {
          choice: { actorId, optionId: option.id, targetIds: lands ? [] : [targetId], ...paying(way) },
          option,
          targetId,
          ...(against?.edge ? { edge: against.edge } : {}),
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
        // Healing that stops at half their health (Preserve Life) is worth only what it gives below
        // that (re-test 2026-10-23: a Channel Divinity spent on 2 health).
        const capped =
          fallingAction?.sharesHeal === "half"
            ? { value: health.value, max: Math.max(health.value, Math.floor(health.max / 2)) }
            : health;
        if (capped.value >= capped.max && !target.down) continue;
        // As many uses as it may choose (Lay on Hands' points), as the resolver spends them: enough to
        // heal them fully, or all it has (class re-test 2026-10-24: weighed as healing 1 and never used).
        const uses = option.amount
          ? Math.max(1, Math.min(option.amount.max, Math.ceil((capped.max - capped.value) / Math.max(1, average))))
          : 1;
        candidate.healing =
          rulesetHealingWorth(average * uses, capped) * (capped.max / Math.max(1, health.max)) + (target.down ? 1 : 0);
        // A limited heal (a potion, a slot, a use a day) waits until a friend is below half (I2 re-test
        // 2026-10-23: potions drunk at 26 of 38): above that it is worth a fifth, taken only when
        // nothing better is on offer.
        const limited = price > 0 || !!fallingAction?.uses || !!fallingAction?.itemUse;
        // Barely scratched it is not given at all, even with nothing else to do (laptop playtest
        // 2026-10-24: a potion drunk at 34 of 44).
        if (limited && !target.down && health.value > health.max * 0.75) continue;
        // A creature somebody called into the fight is not worth a slot or a potion (laptop playtest
        // 2026-10-25: Wren spent two 1st level slots healing the Draft Horses she had conjured).
        if (limited && target.calledBy !== undefined) continue;
        // One it cannot get back this fight (a potion, a use a day) is never given above half, where a
        // fifth of its worth still won with little else on offer (laptop 2026-10-26: a potion fed to
        // Corin at 21 of 31 with nobody down, "worth the limited use it spends", in place of a blow).
        if ((fallingAction?.itemUse || fallingAction?.uses) && !target.down && health.value > health.max / 2) continue;
        if (limited && !target.down && health.value > health.max / 2) candidate.healing *= 0.2;
      } else if (average > 0) {
        // Never its own side, and never somebody who is already down: the rules let a blow land on
        // them, and a table where every opponent finishes off the dying is not one anybody plays
        // at. A human may still choose it; nothing the Engine enumerates for itself or for a Game
        // Master's boss includes it, but a cruel one's where the game allows it (combat AI T3).
        if (ally || (target.down && (actor.temperament !== "cruel" || target.defeated))) continue;
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
        // Weighed against what its side stands up with as well as what the target has: a scratch on
        // the frail one is still a scratch, and a full Multiattack on the one beside it is worth more
        // than a dagger thrown far at disadvantage. Nobody counts as frailer than its side's mean, so
        // two daggers thrown at long range at the wizard do not beat the Multiattack on the fighter
        // two steps away (re-test 12). By what it does, not by who takes it (re-test 13): the knight's
        // greater health makes a Multiattack on him worth no less than the same harm on the wizard.
        // Finishing one off is weighed by its own health, though never as frailer than three quarters
        // of its side's mean.
        const mean = rulesetSideHealthMean(definition, combat, encounter, target.side);
        const weighed = average >= pool ? Math.max(pool, mean * 0.75) : mean;
        // A symbol fight's hit is weighed with what either side's spends buy (1.382). Harm past what
        // drops them, with a margin for a low roll, is spent for nothing (laptop playtest 2026-10-24:
        // a Guiding Bolt cast from a 3rd-level slot at a wolf the 1st-level one would drop, four
        // 1st-level slots still free).
        const worth = aimed?.worth ?? Math.min(average, Math.max(pool * 1.25, mean * 0.75));
        // A limited use (a flask, a slot, a use a day) thrown at worse than even odds is weighed
        // against keeping it for a fair throw: below even, its chance counts twice over (re-test
        // 2026-10-24: flasks thrown at disadvantage from beside a troll, 5 of 16 landing).
        const odds = rulesetFairOdds(candidate, price, fallingAction, chance);
        candidate.damage =
          Math.min(2, (worth / weighed) * (1 + others.length + again) * rulesetZoneRepeats(fallingAction)) *
          chance *
          odds;
        candidate.action.expected = average * chance * (1 + others.length + again);
        if (average >= pool) candidate.finish = chance;
        // Everybody it could drop, the others it spreads to included: by its average, and by the most
        // its dice can roll where the blow is not one pulled to knock out (re-test 2026-10-23: a Sacred
        // Flame of 2d8 on a thug at 11 killed under orders to spare), every dart it takes counted
        // (round 2: three Magic Missile darts on a captain at 10).
        // In a dice pool the most is every die a success, as the ruleset throws it (K7: a ghoul under
        // orders to spare shot a 4-dice pistol at one with 4 health left).
        const most = rulesetCombatIsPool(combat)
          ? Math.max(average, rulesetPoolDamageMost(fallingAction?.damage))
          : average * rulesetDamageCeiling(fallingAction?.damage);
        const dropped = [target, ...others].filter((one) => {
          const left = rulesetCombatHealth(definition, combat, one);
          return most * (one === target ? 1 + again : 1) >= Math.max(1, left.value + left.temp);
        });
        if (dropped.length) candidate.action.drops = dropped.map((one) => one.id);
        // What it puts on them as well (a stunning blow), and the spell it may break by hurting
        // whoever holds one up.
        // What a hit puts on them (a net's, 1.169) counts as what it applies does.
        const struck = rulesetWithOnHit(fallingAction, average);
        const rider = rulesetEffectWorth(definition, combat, encounter, actor, struck, target) ?? 0;
        // Worth as much as the save it forces is likely to fail (re-test 9): a dagger's scratch on a
        // caster who shrugs off any concentration save is no reason to throw it past a Multiattack.
        const breaks = target.concentrating ? 0.3 * rulesetConcentrationFails(combat, target, average) : 0;
        if (rider + breaks > 0) candidate.setup = (rider + breaks) * chance * odds;
        const denied = rulesetDeniedHarm(definition, combat, encounter, actor, struck, target) * chance * odds;
        const lingers = rulesetLingeringHarm(definition, combat, encounter, actor, struck, target) * chance * odds;
        if (lingers > 0) candidate.damage = (candidate.damage ?? 0) + lingers;
        if (denied > 0) {
          candidate.damage = (candidate.damage ?? 0) + denied;
          candidate.action.denies = denied;
        }
        const combo = rulesetFollowUpWorth(definition, combat, encounter, actor, struck, target) * chance * odds;
        if (combo > 0) {
          candidate.damage = (candidate.damage ?? 0) + combo;
          candidate.action.combo = combo;
        }
      } else if (ally) {
        // Steadying is for the dying only, and does nothing else (cloud caster batch 2026-10-26: a
        // legendary priest's Cantrip picked Spare the Dying on itself 144 times, each refused).
        if (
          fallingAction?.stabilizes &&
          !fallingAction.heal &&
          !fallingAction.applies?.length &&
          !(target.dying && !target.stable)
        )
          continue;
        // Giving back a pool that is already full, or one somebody without a sheet does not have,
        // gives nothing.
        if (option.restores && !rulesetPoolHasRoom(definition, target, option.restores)) continue;
        // A budget handed over for this turn (Action Surge) is worth only a blow it can buy: taken
        // once the turn's own is spent, with something that reaches an opponent from where it can
        // still walk to. Never a Dash with it, and never a surge it then stands about with.
        if (fallingAction?.gives?.length) {
          if (rulesetGiftStrikes(definition, encounter, actor, fallingAction.gives) <= 0) continue;
          candidate.support = 1;
        } else if (way.mode && fallingAction?.modes?.find((one) => one.id === way.mode)?.form) {
          // A form put on a friend or taken (Wild Shape, Polymorph on an ally), by what it brings them.
          const form = fallingAction.modes.find((one) => one.id === way.mode)!.form!;
          const brings = rulesetFormWorth(definition, combat, encounter, target, form);
          if (brings <= 0) continue;
          candidate.damage = brings;
        } else {
          // What it does for them, read off what it puts on them: nothing, for what they already have.
          const helps = rulesetEffectWorth(definition, combat, encounter, actor, fallingAction, target);
          // What it gains them in the fight, and as many more of its side as it may take (Bless's
          // three), those it gains most first.
          const boost = rulesetBoostWorth(definition, combat, encounter, actor, fallingAction, target);
          // Next to nothing in a fight is not worth a turn's action, nor holding a spell up for
          // (re-test 2026-10-23: Guidance cast nine times while Spirit Guardians waited), unless what
          // it gains them is read some other way (unseen, a Potion of Invisibility).
          if (boost <= 0 && (helps === 0 || (helps !== undefined && helps < RULESET_TRIFLING_HELP))) continue;
          candidate.support = helps ?? 0.4;
          if (boost > 0) {
            const others = spreads
              ? legal
                  .filter((id) => id !== targetId)
                  .map((id) => {
                    const other = rulesetCombatant(encounter, id);
                    return {
                      id,
                      gain:
                        other && other.side === actor.side
                          ? rulesetBoostWorth(definition, combat, encounter, actor, fallingAction, other)
                          : 0,
                    };
                  })
                  .filter((other) => other.gain > 0)
                  .sort((a, b) => b.gain - a.gain)
                  .slice(0, option.targets.count - 1)
              : [];
            if (!lands && others.length)
              candidate.action.choice.targetIds = [targetId, ...others.map((other) => other.id)];
            const gained = others.reduce((sum, other) => sum + other.gain, boost);
            candidate.damage = gained;
            candidate.action.boosts = gained;
          }
        }
      } else if (
        menu &&
        fallingAction?.reaction?.cancels &&
        (encounter.window?.trigger.kind === "aimed" || encounter.window?.trigger.kind === "used")
      ) {
        // Stopping what is coming (Counterspell) is worth what it would have done, weighed as the harm
        // it saves rather than by temperament: a cantrip is let through, a Fireball at the party is
        // stopped by anybody who can. The first quarter is what a reaction is worth, a tenth more
        // for each level of the slot it spends, however little the spender minds the price, and
        // more again for each level that slot stands above the cast it stops: a 3rd-level slot is
        // thrown at a Fire Bolt only to keep its spender alive. That is its whole price, so none is
        // added.
        const level = rulesetPaidLevel(definition, actor, fallingAction, way.payWith);
        const stoppedLevel = rulesetStoppedLevel(definition, encounter);
        // A slot is never spent on a cantrip but to keep its spender alive (re-test round 2: a
        // 3rd-level Counterspell on a cult fanatic's Sacred Flame), nor a stat block's answer of only
        // so many uses or one that has to recharge (laptop 2026-10-25: a battle-mage's on a Fire Bolt).
        const dear = level > 0 || !!fallingAction.uses || !!fallingAction.recharge;
        if (dear && stoppedLevel === 0 && !rulesetStoppedDropsSpender(definition, combat, encounter, actor)) continue;
        const above = Math.max(0, level - stoppedLevel);
        const saved =
          Math.max(0, rulesetStoppedWorth(definition, combat, encounter, actor) - 0.25 - 0.1 * level - 0.15 * above) *
          chance;
        if (saved <= 0) continue;
        candidate.damage = saved;
        candidate.cost = 0;
      } else if (option.forecast?.averageDamage !== undefined) {
        // A blow that does no harm (an unarmed strike for 0) is worth only what it puts on them.
        if (ally || target.down) continue;
        const struck = rulesetWithOnHit(fallingAction, 0);
        const rider = rulesetEffectWorth(definition, combat, encounter, actor, struck, target) ?? 0;
        if (rider <= 0 && !rulesetLingeringHarm(definition, combat, encounter, actor, struck, target)) continue;
        const odds = rulesetFairOdds(candidate, price, fallingAction, chance);
        candidate.setup = rider * chance * odds;
        const denied = rulesetDeniedHarm(definition, combat, encounter, actor, struck, target) * chance * odds;
        const lingers = rulesetLingeringHarm(definition, combat, encounter, actor, struck, target) * chance * odds;
        if (lingers > 0) candidate.damage = (candidate.damage ?? 0) + lingers;
        const combo = rulesetFollowUpWorth(definition, combat, encounter, actor, struck, target) * chance * odds;
        if (denied + combo > 0) {
          candidate.damage = (candidate.damage ?? 0) + denied + combo;
          if (denied > 0) candidate.action.denies = denied;
          if (combo > 0) candidate.action.combo = combo;
          // What holding them is worth is counted there, not twice.
          if (candidate.setup) candidate.setup *= 0.5;
        }
      } else {
        // What it does to them, read off what it puts on them: nothing, for what they already have
        // or cannot take. As likely as it is to land, and a limited use kept for fair odds as a blow
        // is (re-test 2026-10-24: oil thrown at disadvantage beside trolls, only to set up a fire).
        const holds = rulesetEffectWorth(definition, combat, encounter, actor, fallingAction, target);
        if (holds === 0 && !rulesetLingeringHarm(definition, combat, encounter, actor, fallingAction, target)) continue;
        const odds = ally ? 1 : chance * rulesetFairOdds(candidate, price, fallingAction, chance);
        candidate.setup = (holds ?? 0.4) * odds;
        const denied = rulesetDeniedHarm(definition, combat, encounter, actor, fallingAction, target) * odds;
        const lingers = rulesetLingeringHarm(definition, combat, encounter, actor, fallingAction, target) * odds;
        if (lingers > 0) candidate.damage = (candidate.damage ?? 0) + lingers;
        const combo = rulesetFollowUpWorth(definition, combat, encounter, actor, fallingAction, target) * odds;
        if (denied + combo > 0) {
          candidate.damage = (candidate.damage ?? 0) + denied + combo;
          if (denied > 0) candidate.action.denies = denied;
          if (combo > 0) candidate.action.combo = combo;
          // What holding them is worth is counted there, not twice.
          if (candidate.setup) candidate.setup *= 0.5;
        }
      }
      candidates.push(candidate);
    }
  }
  // Twinned (1.253): a single-target one sent at a second target as well, for what its alteration
  // costs, worth what it would be on each (class re-test 2026-10-24: Twinned Spell never used). The
  // two are paired from the candidates already weighed here, so both are legal from where it stands.
  if (!menu) candidates.push(...twinnedCandidates(encounter, actor, candidates));
  // Starting another held spell lets go of the one it holds up: as dear as what that one is worth,
  // so Guidance or Shield of Faith held does not keep Spirit Guardians in the book (re-test
  // 2026-10-23), and an Entangle does not send away the eight creatures a summons holds (class
  // re-test 2026-10-24). Whatever way it is weighed: a shape, a blow, something on itself.
  if (actor.concentrating) {
    const letGo = rulesetHeldWorth(definition, combat, encounter, actor);
    // What its own side gains from a new hold is gained by those still there: creatures the old one
    // keeps go with it (cloud AI fights 2026-10-25: Draft Horses sent away for a Hold Person).
    const held = actor.concentrating.actionId;
    const friends = encounter.combatants.filter(
      (one) => one.id !== actor.id && one.side === actor.side && rulesetCombatStanding(one),
    );
    const leaving = friends.filter((one) => one.calledBy === actor.id && one.calledWith === held && !one.dismissed);
    const staying = friends.length > 0 ? (friends.length - leaving.length) / friends.length : 1;
    for (const candidate of candidates) {
      const id = candidate.action.option.castOf?.optionId ?? candidate.action.option.id;
      const holds = actor.actions.find((one) => one.id === id)?.concentration;
      if (holds && candidate.setup) candidate.setup *= staying;
      // Weighed as the harm it gives up, not as a price: a caster's prices count for less than
      // what it does, and eight creatures went for a Hold Person (cloud class re-test round 2).
      // Cast again, the same one lets go of itself as well: what it holds now is given up for what
      // it would hold, so a Bless on the same three is worth nothing more (cloud batch 2026-10-25).
      if (holds) candidate.damage = (candidate.damage ?? 0) - letGo;
    }
    // The same held spell cast again while it still holds a foe is not cast (cloud caster re-test
    // 2026-10-25: an Enchanter cast Hypnotic Pattern over its own pattern in five rounds of seven,
    // aimed at one it already held). What it holds would go, and it already holds them.
    // Nor is another held spell, which would let them go just the same (cloud caster re-test
    // 2026-10-26: a restrained Enchanter cast Greater Invisibility over a Hypnotic Pattern still
    // holding two of the party).
    if (rulesetHeldFoes(encounter, actor).length > 0)
      for (let index = candidates.length - 1; index >= 0; index--) {
        const id = candidates[index]!.action.option.castOf?.optionId ?? candidates[index]!.action.option.id;
        if (id === held || actor.actions.find((one) => one.id === id)?.concentration) candidates.splice(index, 1);
      }
    // Holding help on its own side (a Bless), it is not cast again while it holds anyone, nor let go
    // for other help on its own side, which does no more (cloud caster bosses 2026-10-26: a priest's
    // legendary Guidance cast on itself three times a round, and over the Bless it had just cast). A
    // held spell that harms or holds a foe may still be worth more, as weighed above.
    else if (rulesetHeldFriends(encounter, actor).length > 0)
      for (let index = candidates.length - 1; index >= 0; index--) {
        const candidate = candidates[index]!;
        const id = candidate.action.option.castOf?.optionId ?? candidate.action.option.id;
        const action = actor.actions.find((one) => one.id === id);
        const targets = candidate.action.choice.targetIds;
        const helps =
          !action?.damage &&
          !action?.zone &&
          (targets.length === 0 || targets.every((one) => rulesetCombatant(encounter, one)?.side === actor.side));
        if (id === held || (action?.concentration && helps)) candidates.splice(index, 1);
      }
  }
  // What a target threw off before, cast at it again by the same one, is worth half as much again
  // for each time (laptop pass 5 2026-10-26: Hold Person cast four times at one who saved each time,
  // a slot each).
  for (const candidate of candidates) {
    const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
    const times =
      target?.shookOff?.[`${actor.id}/${candidate.action.option.castOf?.optionId ?? candidate.action.option.id}`] ?? 0;
    if (times === 0) continue;
    const kept = 0.5 ** times;
    if (candidate.setup) candidate.setup *= kept;
    if ((candidate.damage ?? 0) > 0 && !candidate.action.option.forecast?.averageDamage) candidate.damage! *= kept;
  }
  // Turning back gives up the form while it holds: what it was paid for and what health it has left
  // between its holder and harm (cloud probes 2026-10-25: a druid's kept Wolf let go on its first turn
  // to cast). Worth little once the form is nearly spent.
  if (actor.shape) {
    const health = actor.shape.health;
    const left = health ? health.value / Math.max(1, health.max) : 0.5;
    for (const candidate of candidates)
      if (candidate.action.option.id === RULESET_SHAPE_REVERT_ID)
        candidate.damage = (candidate.damage ?? 0) - (0.4 + left);
  }
  // Every foe sealed away (a Resilient Sphere): nothing done to its own side changes the fight until
  // one comes out, so nothing is paid for on it but mending (cloud batch 2026-10-25: a buff cast
  // again and again on a party nobody could reach).
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && !one.down);
  if (foes.length > 0 && foes.every((one) => rulesetSealedApart(definition, encounter, actor, one))) {
    const own = (id: string) => rulesetCombatant(encounter, id)?.side === actor.side;
    for (let index = candidates.length - 1; index >= 0; index--) {
      const { cost, healing, action } = candidates[index]!;
      const targets = action.choice.targetIds;
      if ((cost ?? 0) > 0 && !(healing && healing > 0) && targets.length > 0 && targets.every(own))
        candidates.splice(index, 1);
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

/** The single-target candidates that a twinning alteration on offer could send at a second target
 *  too, each paired with the best other of the same way of using it on somebody of the same side. */
function twinnedCandidates(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const gains = (candidate: CombatAiCandidate<RulesetCandidate>) =>
    (candidate.damage ?? 0) + (candidate.healing ?? 0) + (candidate.support ?? 0) + (candidate.setup ?? 0);
  const groups = new Map<string, Array<CombatAiCandidate<RulesetCandidate>>>();
  for (const candidate of candidates) {
    const { choice, option } = candidate.action;
    const offer = option.alters?.find((one) => one.twins);
    if (!offer || option.targets.count !== 1 || choice.targetIds.length !== 1 || choice.alters?.length) continue;
    if (!candidate.targetId || gains(candidate) <= 0) continue;
    const target = rulesetCombatant(encounter, candidate.targetId);
    if (!target) continue;
    const key = JSON.stringify([
      option.id,
      choice.payWith ?? null,
      choice.mode ?? null,
      choice.style ?? null,
      target.side === actor.side,
    ]);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(candidate);
  }
  const out: Array<CombatAiCandidate<RulesetCandidate>> = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => gains(b) - gains(a));
    for (const first of sorted) {
      const second = sorted.find((one) => one.targetId !== first.targetId);
      if (!second) continue;
      const offer = first.action.option.alters!.find((one) => one.twins)!;
      const add = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0));
      const twinned: CombatAiCandidate<RulesetCandidate> = {
        ...first,
        action: {
          ...first.action,
          choice: {
            ...first.action.choice,
            targetIds: [first.targetId!, second.targetId!],
            alters: [offer.id],
          },
          ...(add(first.action.denies, second.action.denies) !== undefined
            ? { denies: add(first.action.denies, second.action.denies) }
            : {}),
          ...(add(first.action.combo, second.action.combo) !== undefined
            ? { combo: add(first.action.combo, second.action.combo) }
            : {}),
          ...(first.action.drops || second.action.drops
            ? { drops: [...new Set([...(first.action.drops ?? []), ...(second.action.drops ?? [])])] }
            : {}),
        },
        cost: (first.cost ?? 0) + offer.cost,
      };
      for (const part of ["damage", "healing", "support", "setup"] as const) {
        const sum = add(first[part], second[part]);
        if (sum !== undefined) twinned[part] = sum;
      }
      out.push(twinned);
    }
  }
  return out;
}

/** What each effect of a condition is worth on an opponent (`foe`) or a friend (`friend`), as a share
 *  of a turn of theirs: taking a turn away entirely is worth a whole one. */
const RULESET_EFFECT_WORTH: Partial<Record<string, { foe?: number; friend?: number }>> = {
  "cannot-act": { foe: 1 },
  "cannot-harm": { foe: 0.8 },
  "cannot-target-source-side": { foe: 0.5 },
  "cannot-target-source": { foe: 0.25 },
  "speed-zero": { foe: 0.25 },
  "own-attacks-disadvantage": { foe: 0.35 },
  "attacks-against-advantage": { foe: 0.35 },
  "attacks-against-adjacent-advantage": { foe: 0.15 },
  "attacks-from-adjacent-critical": { foe: 0.2 },
  "cannot-approach-source": { foe: 0.15 },
  "cannot-react": { foe: 0.1 },
  "cannot-heal": { foe: 0.1 },
  "own-saves-disadvantage": { foe: 0.15 },
  "own-checks-disadvantage": { foe: 0.05 },
  "own-attacks-advantage": { friend: 0.35 },
  "attacks-against-disadvantage": { friend: 0.35 },
  "attacks-against-no-advantage": { friend: 0.1 },
  "resist-all": { friend: 0.4 },
  "own-saves-advantage": { friend: 0.15 },
  "own-checks-advantage": { friend: 0.05 },
};

/** How much of a turn's worth of blows the actor's side gets in at a target before the target's own
 *  next turn: a half for each friend who acts first, at most one. The actor's own action is the one
 *  being weighed. */
function rulesetBlowsBeforeTurn(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): number {
  const order = encounter.order;
  const at = order.indexOf(actor.id);
  const until = order.indexOf(target.id);
  if (at < 0 || until < 0) return 0.5;
  let friends = 0;
  for (let step = 1; step < order.length; step++) {
    const id = order[(at + step) % order.length]!;
    if (id === target.id) break;
    const one = rulesetCombatant(encounter, id);
    if (one && one.side === actor.side && rulesetCombatStanding(one)) friends++;
  }
  return Math.min(1, friends * 0.5);
}

/** Why a blow is worth more against this one than its forecast says (I1): a damage type it is
 *  vulnerable to, one that stops it regenerating, or a clause dealt only to what it is. */
type RulesetBlowEdge = { way: "vulnerable" | "stops" | "suits"; damageType: string };

/**
 * A blow's average as its target's own hide takes it (I1), part by part: nothing to a type it is
 * immune to, half to one it resists, double to one it is vulnerable to. A clause dealt only to what
 * the target is (re-test 2026-10-23: holy water's radiant on undead) counts, as the menu's forecast,
 * which reads only its first target, does not. And where one of the blow's types, or of the harm a
 * condition it puts on deals (alchemist's fire), stops it regenerating, what it would have regained
 * besides, whatever the ruleset calls them. The menu's forecast leaves a target's hide out (it
 * cannot promise what the player has not found out); the Engine's own side reads it.
 */
function rulesetAverageAgainst(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  target: RulesetCombatant,
  action: RulesetCombatAction,
  average: number,
): { worth: number; edge?: RulesetBlowEdge } {
  const damage = action.damage;
  if (!damage || rulesetCombatIsPool(combat)) return { worth: average };
  const hide = rulesetCombatHide(definition, target, encounter);
  const listed = (list: ReadonlyArray<string | { type: string; except: string[] }>, type: string) =>
    list.some((entry) => (typeof entry === "string" ? entry : entry.type).trim().toLowerCase() === type);
  const types = new Set<string>();
  let edge: RulesetBlowEdge | undefined;
  // What a part is worth as this one takes it.
  const taken = (written: string | undefined, amount: number) => {
    const type = written?.trim().toLowerCase();
    if (!type) return amount;
    types.add(type);
    const resists = listed(hide.resist, type);
    const vulnerable = listed(hide.vulnerable, type);
    if (vulnerable && !resists) edge ??= { way: "vulnerable", damageType: type };
    return amount * (listed(hide.immune, type) ? 0 : resists && !vulnerable ? 0.5 : vulnerable && !resists ? 2 : 1);
  };
  const live = (clause: NonNullable<typeof damage.plus>[number]) => !clause.onCritical && clause.whileOn === undefined;
  // What the forecast counts: the first amount and every clause dealt to anybody, scaled as it is.
  const parts = [
    { type: damage.type, average: rulesetSafeAverage({ ...damage, plus: undefined }) },
    ...(damage.plus ?? [])
      .filter((clause) => live(clause) && !clause.targetIs)
      .map((clause) => ({
        type: clause.type ?? damage.type,
        average: rulesetSafeAverage({ count: clause.count, sides: clause.sides, flat: clause.flat }),
      })),
  ].filter((part) => part.average > 0);
  const whole = parts.reduce((sum, part) => sum + part.average, 0);
  let worth = 0;
  if (whole > 0 && average > 0) {
    const got = parts.reduce((sum, part) => sum + taken(part.type, part.average), 0);
    worth = average * (got / whole);
  } else worth = Math.max(0, average);
  // What is dealt only to what this one is, on top.
  for (const clause of damage.plus ?? []) {
    if (!live(clause) || !clause.targetIs || !rulesetTargetIs(definition, target, clause.targetIs)) continue;
    if (clause.not && rulesetTargetIs(definition, target, clause.not)) continue;
    const type = clause.type ?? damage.type;
    const added = taken(type, rulesetSafeAverage({ count: clause.count, sides: clause.sides, flat: clause.flat }));
    if (added <= 0) continue;
    worth += added;
    if (type && edge?.way !== "vulnerable") edge = { way: "suits", damageType: type.trim().toLowerCase() };
  }
  // The types of what the conditions it puts on harm with, which reach a regeneration as well.
  const harmTypes = new Set<string>();
  for (const applied of action.applies ?? []) {
    const type = combat.conditions?.find((entry) => entry.condition === applied.condition)?.harms?.type;
    if (type?.trim()) harmTypes.add(type.trim().toLowerCase());
  }
  if (worth <= 0 && harmTypes.size === 0) return { worth, ...(edge ? { edge } : {}) };
  for (const regenerates of rulesetRegenerations(definition, combat, target, encounter)) {
    const stopper = regenerates.stoppedBy
      ?.map((type) => type.trim().toLowerCase())
      .find((type) => (worth > 0 && types.has(type)) || harmTypes.has(type));
    if (!stopper) continue;
    const dice = regenerates.dice ? parseRulesetCombatDice(regenerates.dice) : null;
    const regained = (regenerates.flat ?? 0) + (dice ? rulesetSafeAverage(dice) : 0);
    if (regained <= 0) continue;
    worth += regained;
    edge = { way: "stops", damageType: stopper };
    break;
  }
  return { worth, ...(edge ? { edge } : {}) };
}

/** An amount's average, nothing for one that has none or is written loosely. */
function rulesetSafeAverage(amount: RulesetCombatAction["damage"]): number {
  const average = amount ? rulesetAverageAmount(amount) : 0;
  return Number.isFinite(average) ? average : 0;
}

/** The share of a target's turns a thing put on them lasts for: a moment, a few rounds, until they
 *  shake it off, or for good. */
function rulesetDurationWorth(duration: RulesetCombatApplies["duration"]): number {
  if (duration === "instant" || duration === "this-action") return 0.3;
  if (duration === "until-save") return 0.75;
  if (duration === "until-dispelled") return 1;
  if (duration.untilDispelled) return 1;
  return Math.min(1, 0.35 + 0.25 * duration.rounds);
}

/** The chance a target fails a save, read the way the save will be thrown: its own modifier against
 *  the difficulty on a d20, or on dice pools its save's pool short of the successes the difficulty
 *  asks for (combat AI E4), by the pool's own odds. */
function rulesetFailChance(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  target: RulesetCombatant,
  save: { save: string; difficulty: number },
): number {
  const own = target.saves[save.save] ?? 0;
  if (rulesetCombatIsPool(combat))
    return Math.max(
      0.05,
      Math.min(0.95, 1 - rulesetPoolChance(definition, Math.max(0, own), Math.max(1, save.difficulty))),
    );
  return Math.max(0.05, Math.min(0.95, (save.difficulty - 1 - own) / 20));
}

/** How dangerous a combatant is to the other side, against what that side has left: 0.5 for one
 *  that barely scratches, up to 1.5 for one whose best blow takes a whole fighter's health. */
function rulesetThreat(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  one: RulesetCombatant,
): number {
  const best = Math.max(0, ...one.actions.map((action) => rulesetSafeAverage(action.damage)));
  const others = encounter.combatants.filter((other) => other.side !== one.side && rulesetCombatStanding(other));
  if (others.length === 0) return 1;
  const pools = others.map((other) => {
    const health = rulesetCombatHealth(definition, combat, other);
    return Math.max(1, health.value + health.temp);
  });
  const mean = pools.reduce((sum, pool) => sum + pool, 0) / pools.length;
  // And what it has shown this fight: the harm it has dealt and the health it has given back a round,
  // the spell it holds, and how many of the other side it holds down.
  const shown = Math.min(0.4, ((one.done?.dealt ?? 0) + (one.done?.healed ?? 0)) / Math.max(1, encounter.round) / mean);
  const holding = others.filter((other) => other.tracked.some((entry) => entry.source === one.id)).length;
  const control = Math.min(0.3, 0.15 * holding) + (one.concentrating ? 0.1 : 0);
  return 0.5 + Math.min(1, best / mean) + shown + control;
}

/** Whether anybody standing against this side deals this damage type with one of their actions. */
function rulesetSideDeals(encounter: RulesetEncounterState, side: string, damageType: string): boolean {
  const wanted = damageType.trim().toLowerCase();
  return encounter.combatants.some(
    (one) =>
      one.side !== side &&
      rulesetCombatStanding(one) &&
      one.actions.some((action) =>
        [action.damage?.type, ...(action.damage?.plus ?? []).map((clause) => clause.type)].some(
          (type) => type?.trim().toLowerCase() === wanted,
        ),
      ),
  );
}

/**
 * What an action is worth by what it puts on a target, read off the ruleset's own conditions: what
 * their effects and behaviours do, how long they last, the chance it lands, and how much the target
 * matters. An opponent is worth more held down the more dangerous it is; a friend is helped by what
 * helps. Nothing for a condition the target already holds or cannot take. Undefined when the action
 * puts nothing readable on anybody, so its caller keeps its own guess.
 */
export function rulesetEffectWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
  target: RulesetCombatant,
  /** Weighed as harm whoever it lands on: what a blast does to its maker's own side. */
  asHarm = false,
): number | undefined {
  if (!action) return undefined;
  const foe = asHarm || target.side !== actor.side;
  // Nothing put on an opponent already down holds them any further (cloud re-test 2026-10-26: a
  // legendary Frightening Gaze spent twice on an unconscious hero).
  if (foe && !asHarm && target.down && (action.dismisses || action.applies?.length)) return 0;
  let worth: number | undefined;
  // Sent out of the fight (1.236): its turns are gone while it is away.
  if (action.dismisses && foe) worth = 1;
  if (!action.applies?.length)
    return worth === undefined ? undefined : worth * rulesetThreat(definition, combat, encounter, target);
  const held = new Set(rulesetCombatConditions(definition, target));
  for (const applied of action.applies) {
    worth ??= 0;
    if (held.has(applied.condition)) continue;
    // One its user's sheet does not put on, or one that goes with a condition the target holds (5e's
    // Rage's damage, Mindless Rage beside raging), comes of nothing new (laptop playtest 2026-10-25:
    // Ulfgar raged again while raging, for a Mindless Rage his level never gives).
    if (!rulesetSheetWithin(definition, actor, applied.when)) continue;
    if (applied.endsWith !== undefined && held.has(applied.endsWith)) continue;
    if (rulesetImmuneToCondition(target, applied.condition, definition, encounter, actor)) continue;
    const rule = combat.conditions?.find((one) => one.condition === applied.condition);
    let each = 0;
    // One they get up from on their own turn (prone): gone before they act, so it is worth only the
    // move it costs them and the blows their side takes before then (re-test 10: a lone sentinel
    // shoving the fighter down every turn and never striking).
    const standsUp = foe && !!rule?.effects?.includes("half-move-to-stand");
    const before = standsUp ? rulesetBlowsBeforeTurn(encounter, actor, target) : 1;
    for (const effect of rule?.effects ?? []) {
      const one = (foe ? RULESET_EFFECT_WORTH[effect]?.foe : RULESET_EFFECT_WORTH[effect]?.friend) ?? 0;
      each += standsUp ? (effect === "own-attacks-disadvantage" ? 0 : one * before) : one;
    }
    if (standsUp) each += 0.1;
    // What it makes them do (1.264, 1.543): run, wander, strike whoever is nearest, waste a turn.
    const behavior = rule?.behavior;
    if (foe && behavior) {
      if (behavior.table || behavior.only) each += 0.6;
      else if (behavior.moves === "away" || behavior.nearest) each += 0.5;
      else if (behavior.wastes) each += 0.4;
      else each += 0.15;
    }
    // A number added or taken off, whichever way it points, is worth a little; more damage of one
    // type taken only when somebody on the other side deals that type (lamp oil wants a fire), and
    // one that counts only on blows of some types (1.792) only when somebody deals one of them.
    // Only those that point its way: a defense lowered (Slow's) helps no friend, and a bonus no foe
    // (class re-test 2026-10-24: Slow cast over the party as support).
    const lifts = (modifier: { to: string; flat?: number; times?: number; dice?: string; mode?: string }) => {
      const up =
        (modifier.flat ?? 0) > 0 || (modifier.times ?? 1) > 1 || !!modifier.dice || modifier.mode === "advantage";
      const down = (modifier.flat ?? 0) < 0 || (modifier.times ?? 1) < 1 || modifier.mode === "disadvantage";
      if (!up && !down) return undefined;
      return modifier.to === "damage-taken" ? !up : up;
    };
    const counted = (rule?.modifiers ?? []).filter(
      (modifier) =>
        lifts(modifier) !== (foe ? true : false) &&
        (modifier.to !== "damage-taken" ||
          (modifier.onTypes
            ? modifier.onTypes.some((type) => rulesetSideDeals(encounter, target.side, type))
            : !modifier.damageType ||
              (modifier.flat ?? 0) <= 0 ||
              rulesetSideDeals(encounter, target.side, modifier.damageType))),
    );
    // One that only touches ability checks is nothing in a fight (re-test 2026-10-23: a cleric spent
    // six actions on Guidance; cloud caster bosses 2026-10-26: a priest's legendary actions on it);
    // one spent the first time it adds (1.792) is worth half.
    each += Math.min(
      0.3,
      counted.reduce(
        (sum, modifier) => sum + (modifier.to === "checks" ? 0 : 0.1) * (modifier.spentOnUse ? 0.5 : 1),
        0,
      ),
    );
    // An aura it gives off to its own side (5e's Leadership): what it puts on each friend in reach.
    if (!foe) {
      const perCell = combat.distance?.perCell;
      for (const aura of rule?.auras ?? []) {
        if (aura.side === "enemies") continue;
        const reach = perCell ? rulesetInCells(aura.distance, perCell) : Infinity;
        const friends = encounter.combatants.filter(
          (one) =>
            one.side === target.side &&
            !one.object &&
            rulesetCombatStanding(one) &&
            (aura.self || one.id !== target.id) &&
            (!rulesetPositionOf(one) || !rulesetPositionOf(target) || rulesetGap(one, target) <= reach),
        ).length;
        for (const id of aura.conditions ?? []) {
          const given = combat.conditions?.find((one) => one.condition === id);
          const effects = (given?.effects ?? []).reduce(
            (sum, effect) => sum + (RULESET_EFFECT_WORTH[effect]?.friend ?? 0),
            0,
          );
          each += (Math.min(0.3, (given?.modifiers?.length ?? 0) * 0.1) + effects) * friends;
        }
      }
    }
    if (rulesetBreaksOnHarm(rule)) each *= 0.6;
    // Ended by its holder's next attack (a Potion of Invisibility): one turn of it, whatever it says
    // (cloud class re-test round 2: drunk on the first turn beside its foes).
    const once = !foe && !!applied.endsWhenHolder?.attacks;
    worth += Math.min(1.2, each) * rulesetDurationWorth(once ? { rounds: 1 } : rulesetLasting(action, applied));
  }
  if (worth === undefined) return undefined;
  const lands = action.save && foe ? rulesetFailChance(definition, combat, target, action.save) : 1;
  return worth * lands * (foe ? rulesetThreat(definition, combat, encounter, target) : 1);
}

/** Whether the hit a window holds is a critical, for what joins it (a smite's dice doubled). */
function rulesetHeldCritical(encounter: RulesetEncounterState): boolean {
  const resume = encounter.window?.resume;
  return resume?.kind === "action" && !!resume.held?.roll.critical;
}

/** The average of its own blow a window holds, for what joins that blow (`addsToBlow`): nothing for
 *  anything else, or for a blow its menu cannot read. */
function rulesetPendingBlow(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
): number {
  const trigger = encounter.window?.trigger;
  if (!action?.addsToBlow || trigger?.kind !== "hit" || trigger.sourceId !== actor.id) return 0;
  return rulesetSafeAverage(actor.actions.find((one) => one.id === trigger.optionId)?.damage);
}

/** How long what an action puts on lasts, for weighing it: one that ends with another put on with it
 *  (1.202) and says nothing of its own lasts as that one does, as Hideous Laughter's incapacitated
 *  lasts its laughing (laptop 2026-10-25: a Counterspell let it go at its own caster as worth nothing). */
function rulesetLasting(action: RulesetCombatAction, applied: RulesetCombatApplies): RulesetCombatApplies["duration"] {
  if (!applied.endsWith || (applied.duration !== "instant" && applied.duration !== "this-action"))
    return applied.duration;
  const linked = action.applies?.find((one) => one !== applied && one.condition === applied.endsWith);
  return linked && linked.duration !== "instant" && linked.duration !== "this-action"
    ? linked.duration
    : applied.duration;
}

/** How many of a target's turns a condition put on it takes, for what it keeps them from doing. */
function rulesetTurnsTaken(duration: RulesetCombatApplies["duration"]): number {
  if (duration === "instant" || duration === "this-action") return 0;
  if (duration === "until-save") return 1.5;
  if (duration === "until-dispelled" || duration.untilDispelled) return 2;
  return Math.min(2, duration.rounds);
}

/** An action with what its hit puts on the one hit (`onHit`, 1.169) among what it applies, those whose
 *  harm needed is no more than `average`: a net's netted, a poisoned blade's poisoned. */
function rulesetWithOnHit(action: RulesetCombatAction | undefined, average: number): RulesetCombatAction | undefined {
  const struck = (action?.onHit ?? []).filter((one) => one.atLeast <= average);
  if (!action || struck.length === 0) return action;
  return {
    ...action,
    applies: [
      ...(action.applies ?? []),
      ...struck.map(
        (one) =>
          ({
            condition: one.condition,
            // One its holder may spend a turn's action to get out of lasts about that turn.
            duration: one.rounds
              ? { rounds: one.rounds }
              : one.saveEnds
                ? "until-save"
                : one.checkEnds
                  ? { rounds: 1 }
                  : "until-dispelled",
            ...(one.checkEnds ? { checkEnds: one.checkEnds } : {}),
          }) as RulesetCombatApplies,
      ),
    ],
    ...(!action.save && struck[0]?.save ? { save: struck[0].save } : {}),
  } as RulesetCombatAction;
}

/**
 * The harm what this puts on an opponent does them as their turns come round (class pass 2026-10-24:
 * alchemist's fire never thrown, its blow doing nothing up front), over the turns it is weighed for,
 * against their health, as likely as its save is to fail. Weighed as harm.
 */
/** How many rounds' harm a lasting area that harms whoever is in it each turn is worth as it is laid
 *  (laptop playtest 2026-10-25: a druid's Moonbeam weighed as one round's harm, and never cast): the
 *  rounds it is likely held for, each counted at less than a full round, since they may walk out of
 *  it or the spell may break. One for anything else. */
function rulesetZoneRepeats(action: RulesetCombatAction | undefined): number {
  const zone = action?.zone;
  if (!zone || zone.rounds <= 1 || !zone.triggers.some((one) => one === "turn-start" || one === "turn-end")) return 1;
  return Math.max(1, Math.min(RULESET_HELD_ROUNDS, zone.rounds) * 0.7);
}

function rulesetLingeringHarm(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
  target: RulesetCombatant,
): number {
  if (!action?.applies?.length || target.side === actor.side || target.down) return 0;
  const held = new Set(rulesetCombatConditions(definition, target));
  let harmed = 0;
  for (const applied of action.applies) {
    if (held.has(applied.condition)) continue;
    if (rulesetImmuneToCondition(target, applied.condition, definition, encounter, actor)) continue;
    const harm = combat.conditions?.find((one) => one.condition === applied.condition)?.harms;
    if (!harm || (harm.at !== "turn-start" && harm.at !== "turn-end")) continue;
    const dice = harm.dice ? parseRulesetCombatDice(harm.dice) : null;
    const amount = (dice ? rulesetSafeAverage(dice) : 0) + (harm.flat ?? 0);
    const turns =
      applied.checkEnds || applied.saveEnds ? 1.5 : Math.max(1, rulesetTurnsTaken(rulesetLasting(action, applied)));
    harmed += amount * turns;
  }
  if (harmed <= 0) return 0;
  const health = rulesetCombatHealth(definition, combat, target);
  const lands = action.save ? rulesetFailChance(definition, combat, target, action.save) : 1;
  return Math.min(1, harmed / Math.max(1, health.value + health.temp)) * lands;
}

/** Whether a condition ends at the first harm or blow at its holder: an effect that says so, or its
 *  own `endsWhen` (5e's Turned, ended by any damage). */
function rulesetBreaksOnHarm(rule: RulesetCombatCondition | undefined): boolean {
  return (
    !!rule?.effects?.includes("ends-on-damage") ||
    !!rule?.endsWhen?.some((one) => one === "damaged" || one === "harmed-by-source-side" || one === "attacked")
  );
}

/**
 * The harm an opponent is kept from doing by what this puts on it (class pass 2026-10-24: 28
 * Stunning Strikes and every Hold Person let go, weighed only as a small setup): its turns taken
 * away, read off the conditions' own effects, times its best blow against its other side's health,
 * as likely as the save is to fail. Weighed as harm saved, as stopping a cast is. Nothing for a
 * friend, for what it holds or cannot take, or for an opponent that does no harm.
 */
function rulesetDeniedHarm(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
  target: RulesetCombatant,
  /** One of its own side caught in it: the blows its side loses, against the other side's health. */
  own = false,
): number {
  if (!action?.applies?.length || (target.side === actor.side) !== own || target.down) return 0;
  const best = Math.max(0, ...target.actions.map((one) => rulesetSafeAverage(one.damage)));
  if (best <= 0) return 0;
  const held = new Set(rulesetCombatConditions(definition, target));
  let turns = 0;
  for (const applied of action.applies) {
    if (held.has(applied.condition) || !rulesetSheetWithin(definition, actor, applied.when)) continue;
    if (rulesetImmuneToCondition(target, applied.condition, definition, encounter, actor)) continue;
    const rule = combat.conditions?.find((one) => one.condition === applied.condition);
    const effects = rule?.effects ?? [];
    // A turn kept to walking and the standard actions (Turn Undead's, Fear's) harms nobody either,
    // less surely where one with nowhere to walk has its turn back (class re-test 2026-10-24: Turn
    // the Unholy never used on three zombies).
    const kept = rule?.behavior?.only ? (rule.behavior.onlyWhenStuck === "any" ? 0.6 : 0.8) : 0;
    const share = effects.includes("cannot-act") ? 1 : Math.max(effects.includes("cannot-harm") ? 0.8 : 0, kept);
    if (share <= 0) continue;
    const taken = share * rulesetTurnsTaken(rulesetLasting(action, applied)) * (rulesetBreaksOnHarm(rule) ? 0.6 : 1);
    turns = Math.max(turns, taken);
  }
  if (turns <= 0) return 0;
  const lands = action.save ? rulesetFailChance(definition, combat, target, action.save) : 1;
  const against = own ? encounter.combatants.find((one) => one.side !== actor.side && !one.object)?.side : undefined;
  const mean = rulesetSideHealthMean(definition, combat, encounter, against ?? actor.side);
  return Math.min(1.5, (turns * best) / Math.max(1, mean)) * lands;
}

/** The dice of the best blow a combatant can make every turn, as an average: what a critical
 *  doubles. */
function rulesetEveryTurnDice(one: RulesetCombatant): number {
  let best = 0;
  let dice = 0;
  for (const action of one.actions) {
    if (action.use || action.uses || action.itemUse || action.whileHolds || !action.damage) continue;
    const strikes = Math.max(1, action.strikes ?? 1);
    const average = rulesetSafeAverage(action.damage) * strikes;
    if (average <= best) continue;
    best = average;
    dice = ((action.damage.count * (action.damage.sides + 1)) / 2) * strikes;
  }
  return dice;
}

/** What one of its side adds to a blow it lands of its own (a smite), at the most it may pay. */
function rulesetBlowAddition(one: RulesetCombatant): number {
  return Math.max(
    0,
    ...one.actions.filter((action) => action.addsToBlow).map((action) => rulesetSafeAverage(action.damage)),
  );
}

/**
 * What its side can make of what this puts on an opponent, the classic set-ups (Alyssa 2026-10-24:
 * Hold Person before a paladin's smites): every blow from beside it a critical, its dice and a smite's
 * doubled; advantage against it, for each of its side able to get at it. Counted for each of its side
 * near enough to strike it next, its maker included, over the turns it holds, as likely as it is to
 * land, against the target's own health. Read off the conditions' own effects, never a name.
 */
function rulesetFollowUpWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
  target: RulesetCombatant,
): number {
  if (!action?.applies?.length || target.side === actor.side || target.down) return 0;
  const held = new Set(rulesetCombatConditions(definition, target));
  const now = rulesetCombatEffects(definition, combat, target, encounter);
  let crits = false;
  let advantage = false;
  let turns = 0;
  for (const applied of action.applies) {
    if (held.has(applied.condition) || !rulesetSheetWithin(definition, actor, applied.when)) continue;
    if (rulesetImmuneToCondition(target, applied.condition, definition, encounter, actor)) continue;
    const rule = combat.conditions?.find((one) => one.condition === applied.condition);
    const effects = rule?.effects ?? [];
    const critical = effects.includes("attacks-from-adjacent-critical") && !now.has("attacks-from-adjacent-critical");
    const easier = effects.includes("attacks-against-advantage") && !now.has("attacks-against-advantage");
    if (!critical && !easier) continue;
    crits ||= critical;
    advantage ||= easier;
    turns = Math.max(turns, rulesetTurnsTaken(rulesetLasting(action, applied)) * (rulesetBreaksOnHarm(rule) ? 0.3 : 1));
  }
  if (turns <= 0) return 0;
  const near = (one: RulesetCombatant) =>
    !rulesetPositionOf(one) || !rulesetPositionOf(target) || rulesetGap(one, target) <= 7;
  let extra = 0;
  for (const one of encounter.combatants) {
    if (one.side !== actor.side || one.object || !rulesetCombatStanding(one) || !near(one)) continue;
    if (crits) extra += rulesetEveryTurnDice(one) + rulesetBlowAddition(one);
    if (advantage) extra += 0.2 * rulesetEveryTurnBlow(one);
  }
  if (extra <= 0) return 0;
  const health = rulesetCombatHealth(definition, combat, target);
  const pool = Math.max(
    health.value + health.temp,
    0.75 * rulesetSideHealthMean(definition, combat, encounter, target.side),
  );
  const lands = action.save ? rulesetFailChance(definition, combat, target, action.save) : 1;
  // Never more than the whole of it: past what drops it, a crit is harm with nowhere to go.
  return Math.min(1, (extra * turns) / Math.max(1, pool)) * lands;
}

/** The best a combatant does with the blows it can make every turn, as an average: never one it
 *  has only while it holds something up (a Flame Blade not drawn). */
function rulesetEveryTurnBlow(one: RulesetCombatant): number {
  return Math.max(
    0,
    ...one.actions
      .filter((action) => !action.use && !action.uses && !action.itemUse && !action.whileHolds)
      .map((action) => rulesetSafeAverage(action.damage) * Math.max(1, action.strikes ?? 1)),
  );
}

/** How many strikes its best every-turn blow is made of. */
function rulesetEveryTurnStrikes(one: RulesetCombatant): number {
  let best = 0;
  let strikes = 1;
  for (const action of one.actions) {
    if (action.use || action.uses || action.itemUse || action.whileHolds) continue;
    const average = rulesetSafeAverage(action.damage) * Math.max(1, action.strikes ?? 1);
    if (average > best) {
      best = average;
      strikes = Math.max(1, action.strikes ?? 1);
    }
  }
  return strikes;
}

/** A modifier's amount as an average: its flat number, its dice, or a modest 2 for one read off a
 *  sheet the picker does not work out. */
function rulesetModifierAverage(modifier: { flat?: number; dice?: string; add?: unknown }): number {
  const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
  const amount = (modifier.flat ?? 0) + (dice ? rulesetSafeAverage(dice) : 0);
  return amount !== 0 ? amount : modifier.add !== undefined ? 2 : 0;
}

/** How many of its holder's turns something put on a friend is weighed for: two at most, as the
 *  fight may be over by then. */
function rulesetTurnsHeld(duration: RulesetCombatApplies["duration"]): number {
  if (duration === "instant" || duration === "this-action") return 1;
  if (duration === "until-save") return 1.5;
  if (duration === "until-dispelled" || duration.untilDispelled) return 2;
  return Math.min(2, Math.max(1, duration.rounds));
}

/**
 * What a friend gains in the fight from what this puts on them (class pass 2026-10-24: Bless, Shield
 * of Faith, Rage and Reckless Attack never taken, weighed only as a small help), read off the
 * conditions' own modifiers and effects: the harm its blows add while it lasts, a bonus or advantage
 * to hit counted on its every-turn blow, against the other side's health; and the harm it keeps off
 * them, a defense raised, advantage against them taken away, damage resisted, against its own side's,
 * as likely to be what is struck as any of its side. Less what it lays them open to (Reckless
 * Attack's). Weighed as harm, as the harm stopping a cast saves is. Nothing for what they hold.
 */
function rulesetBoostWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
  target: RulesetCombatant,
): number {
  if (!action?.applies?.length || target.side !== actor.side || target.down) return 0;
  const foes = encounter.combatants.filter(
    (one) => one.side !== target.side && rulesetCombatStanding(one) && !one.object,
  );
  if (foes.length === 0) return 0;
  const own = rulesetEveryTurnBlow(target);
  const theirs = foes.reduce((sum, one) => sum + rulesetEveryTurnBlow(one), 0) / foes.length;
  const side = encounter.combatants.filter(
    (one) => one.side === target.side && rulesetCombatStanding(one) && !one.object,
  );
  // As likely to be what one of them strikes as anybody of its side, every one of them a turn.
  const struck = (foes.length / Math.max(1, side.length)) * theirs;
  const foeMean = rulesetSideHealthMean(definition, combat, encounter, foes[0]!.side);
  const ownMean = rulesetSideHealthMean(definition, combat, encounter, target.side);
  const held = new Set(rulesetCombatConditions(definition, target));
  // Whether any foe could strike them by its next turn: within its walk and a step.
  const perCell = combat.distance?.perCell ?? 1;
  const near = foes.some(
    (one) =>
      !rulesetPositionOf(one) ||
      !rulesetPositionOf(target) ||
      rulesetGap(one, target) <= Math.max(1, Math.floor(one.speed / perCell)) + 1,
  );
  let worth = 0;
  for (const applied of action.applies) {
    // Only what its maker's sheet puts on: one rage's damage for its level, not all three.
    if (held.has(applied.condition) || !rulesetSheetWithin(definition, actor, applied.when)) continue;
    const rule = combat.conditions?.find((one) => one.condition === applied.condition);
    if (!rule) continue;
    let adds = 0;
    let keeps = 0;
    for (const modifier of rule.modifiers ?? []) {
      if (modifier.to === "damage") adds += rulesetModifierAverage(modifier);
      else if (modifier.to === "attacks")
        adds += (modifier.mode === "advantage" ? 0.2 : rulesetModifierAverage(modifier) / 20) * own;
      else if (modifier.to === "defense") keeps += (rulesetModifierAverage(modifier) / 20) * struck;
    }
    // A blow more each turn (a frenzy's).
    if (rule.grants?.attacks) adds += rulesetEveryTurnBlow(target) / Math.max(1, rulesetEveryTurnStrikes(target));
    const effects = rule.effects ?? [];
    // Not seen (a Potion of Invisibility): its first blow at advantage, and blows at it at a
    // disadvantage, for as long as it holds; once only, where its next attack ends it.
    const once = !!applied.endsWhenHolder?.attacks;
    if (rule.unseen) {
      adds += 0.2 * own;
      keeps += 0.2 * struck;
    }
    if (effects.includes("own-attacks-advantage")) adds += 0.2 * own;
    if (effects.includes("attacks-against-disadvantage")) keeps += 0.2 * struck;
    if (effects.includes("attacks-against-advantage")) keeps -= 0.2 * struck;
    if (effects.includes("resist-all")) keeps += 0.5 * struck;
    else if (rule.resist?.length) {
      const types = new Set(
        rule.resist.map((type) => (typeof type === "string" ? type : type.type).trim().toLowerCase()),
      );
      const dealt = foes.some((one) =>
        one.actions.some((entry) => !!entry.damage?.type && types.has(entry.damage.type.trim().toLowerCase())),
      );
      if (dealt) keeps += 0.5 * struck;
    }
    // Ended by their next attack (a Potion of Invisibility), it lasts their one blow and the foes'
    // turns before it, whatever it says (cloud class re-test round 2: drunk on the first turn).
    const turns = once ? 1 : rulesetTurnsHeld(rulesetLasting(action, applied));
    // Kept off only once a foe can get at them: a turn of it goes by first with none in a walk.
    const kept = Math.max(0, turns - (near ? 0 : 1));
    worth += (turns * adds) / Math.max(1, foeMean) + (kept * keeps) / Math.max(1, ownMean);
    // What it leaves on them once it ends, a track raised (a frenzy's exhaustion), counts against it.
    worth -= 0.25 * (rule.onEnd?.tracks ?? []).reduce((sum, track) => sum + Math.max(0, track.by ?? 0), 0);
  }
  return Math.max(-1, Math.min(1.5, worth));
}

/** The best one blow of a stat block does, as an average. */
function rulesetBlockBlow(block: RulesetStatBlock): number {
  return Math.max(0, ...block.actions.map((action) => rulesetSafeAverage(action.damage)));
}

/**
 * What calling creatures into the fight is worth (class pass 2026-10-24: Conjure Animals never cast):
 * the harm their blows add over the turns weighed, as likely to land as a blow mostly is, against the
 * other side's health; and the blows their bodies take for their side, against its own. Read off the
 * creatures the mode calls, so a pack of wolves weighs what it is and a lone pony next to nothing.
 */
function rulesetCalledWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  call: NonNullable<RulesetCombatAction["calls"]>,
): number {
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  if (foes.length === 0) return 0;
  const count = Math.max(1, rulesetSafeAverage(call.count));
  const foeMean = rulesetSideHealthMean(definition, combat, encounter, foes[0]!.side);
  const ownMean = rulesetSideHealthMean(definition, combat, encounter, actor.side);
  // Those that arrive later or take no turns of their own strike less, or not at all.
  const turns = call.turnless ? 0 : Math.min(2, call.rounds ?? 2);
  const harm = (turns * count * rulesetBlockBlow(call.block) * 0.6) / Math.max(1, foeMean);
  const bodies = (0.25 * count * (call.block.health ?? ownMean)) / Math.max(1, ownMean);
  // Eased toward 2, so a bigger pack still reads bigger past what would drop one foe.
  return 2 * (1 - Math.exp(-(harm + Math.min(0.5, bodies)) / 2));
}

/**
 * What taking a form is worth to its taker (class pass 2026-10-24: Wild Shape never taken): its
 * health to lose before its own, more the more it is hurt, and the harm its blows add over its own,
 * less the spells it gives up casting while it lasts.
 */
function rulesetFormWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  form: { block: RulesetStatBlock },
): number {
  if (actor.shape) return 0;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  if (foes.length === 0) return 0;
  // A form that only swims is no form for dry ground (laptop pass 6 2026-10-26: a druid became a
  // Swarm of Quippers on land): taken only where the board has water.
  if (
    !form.block.speed &&
    form.block.speeds?.swim &&
    !encounter.board?.grid?.tiles.some((row) => row.includes("water"))
  )
    return 0;
  const health = rulesetCombatHealth(definition, combat, actor);
  const hurt = 1 - health.value / Math.max(1, health.max);
  const foeMean = rulesetSideHealthMean(definition, combat, encounter, foes[0]!.side);
  const gained = Math.max(0, rulesetBlockBlow(form.block) - rulesetEveryTurnBlow(actor));
  // Health it loses before its own, as good as as much healing once it is hurt (laptop pass 6
  // 2026-10-26: a druid 4 with Wild Shape on offer every turn of six never took it).
  const body = Math.min(1, (form.block.health ?? 0) / Math.max(1, health.max)) * (0.4 + 0.6 * hurt);
  // A caster with a harmful spell it can still pay for keeps casting it instead; out of slots, the
  // form is what it has left.
  const pools = actor.sheet
    ? readRulesetLive(definition, actor.sheet.build, actor.sheet.live, actor.sheet.items).pools.map((pool) => pool.key)
    : [];
  const casts = actor.actions.some(
    (action) =>
      !!action.use &&
      !!action.damage &&
      (!actor.sheet ||
        [undefined, ...pools].some((pool) => planRulesetCombatCost(definition, actor, action, pool) !== null)),
  )
    ? 0.4
    : 0;
  // Water the body it has cannot cross (laptop 2026-10-30: two water fights, and the druid took the
  // Warhorse every time): a form that swims reaches a foe in it, gets the druid out of it, and has
  // more board to work with the more of it is water.
  const tiles = encounter.board?.grid?.tiles;
  const wet = (one: RulesetCombatant) => {
    const cell = rulesetPositionOf(one);
    return !!cell && tiles?.[cell.y]?.[cell.x] === "water";
  };
  const cells = tiles?.reduce((count, row) => count + row.length, 0) ?? 0;
  const water = tiles?.reduce((count, row) => count + row.filter((tile) => tile === "water").length, 0) ?? 0;
  const reach =
    form.block.speeds?.swim && !actor.speeds?.swim && !actor.speeds?.fly && cells > 0
      ? (wet(actor) || foes.some(wet) ? 0.4 : 0) + 0.4 * (water / cells)
      : 0;
  return Math.min(1.5, (2 * 0.6 * gained) / Math.max(1, foeMean) + body + reach - casts);
}

/** What stopping a cast or a blow aimed at this side is worth (an answer that cancels, 5e's
 *  Counterspell): the harm it would do to whom it is aimed at here, what it would put on them, or the
 *  healing it would give the other side. A modest guess when the thing itself cannot be read. */
export function rulesetStoppedWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): number {
  const trigger = encounter.window?.trigger;
  if (!trigger || (trigger.kind !== "aimed" && trigger.kind !== "used")) return 0.4;
  // Stopping an answer (a Counterspell at our own cast) is worth what that answer would have stopped:
  // what our cast does to its side, read from where its caster stands.
  const answering = encounter.window?.resume?.kind === "answer" ? encounter.window.outer : undefined;
  const counterer = rulesetCombatant(encounter, trigger.sourceId);
  if (answering && counterer) {
    return rulesetStoppedWorth(definition, combat, { ...encounter, window: answering }, counterer);
  }
  const stopped = rulesetStoppedCast(encounter);
  if (!stopped) return 0.4;
  const { source, action } = stopped;
  // Only who it can reach: a cast from inside a sphere of force lands on nobody outside it, and is
  // not worth a slot to stop (cloud batch 2026-10-26: a Counterspell spent on one).
  const aimedAt = stopped.aimedAt.filter((one) => !rulesetSealedApart(definition, encounter, source, one));
  const mine = aimedAt.filter((one) => one.side === actor.side);
  let worth = 0;
  const average = rulesetSafeAverage(action.damage);
  for (const one of mine) {
    const health = rulesetCombatHealth(definition, combat, one);
    // Its own life, or itself held down (Hold Person on the one who could stop it), is the rest of
    // its fight lost, and weighs half again as much.
    const self = one.id === actor.id ? 1.5 : 1;
    const pool = Math.max(1, health.value + health.temp);
    if (average > 0) worth += Math.min(1, average / pool) * (average >= pool ? self : 1);
    worth += (rulesetEffectWorth(definition, combat, encounter, source, action, one) ?? 0) * self;
  }
  // Healing or helping their own side is worth stopping too.
  for (const one of aimedAt.filter((other) => other.side === source.side)) {
    const health = rulesetCombatHealth(definition, combat, one);
    if (action.heal) worth += Math.min(1, (health.max - health.value) / Math.max(1, health.max));
    worth += (rulesetEffectWorth(definition, combat, encounter, source, action, one) ?? 0) * 0.5;
  }
  if (action.summons || action.calls) worth += 0.6;
  // Something it could read and found small is worth that little; only what says nothing gets a guess.
  const read = average > 0 || !!action.heal || !!action.applies?.length || !!action.summons || !!action.calls;
  return Math.min(2, read ? worth : 0.4);
}

/** The cast or blow an answer would stop, and whom it is aimed at: as the moment says, else as the
 *  held use says, its area's catch included. */
function rulesetStoppedCast(
  encounter: RulesetEncounterState,
): { source: RulesetCombatant; action: RulesetCombatAction; aimedAt: RulesetCombatant[] } | undefined {
  const trigger = encounter.window?.trigger;
  if (!trigger || (trigger.kind !== "aimed" && trigger.kind !== "used")) return undefined;
  const source = rulesetCombatant(encounter, trigger.sourceId);
  const action = source?.actions.find((one) => one.id === trigger.optionId);
  if (!source || !action) return undefined;
  const resume = encounter.window?.resume;
  const held = resume?.kind === "action" && resume.actorId === source.id ? resume : undefined;
  const ids = new Set([
    ...(trigger.kind === "aimed" ? (trigger.targetIds ?? []) : []),
    ...(held?.targetIds ?? []),
    ...(held?.at ? rulesetAreaTargets(encounter, source.id, held.optionId, held.at) : []),
  ]);
  const aimedAt = [...ids]
    .map((id) => rulesetCombatant(encounter, id))
    .filter((one): one is RulesetCombatant => !!one && !one.defeated);
  return { source, action, aimedAt };
}

/** Whether what an answer would stop could drop its spender, by the most its dice can roll. */
function rulesetStoppedDropsSpender(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  const stopped = rulesetStoppedCast(encounter);
  if (!stopped || !stopped.aimedAt.some((one) => one.id === actor.id)) return false;
  const most = rulesetSafeAverage(stopped.action.damage) * rulesetDamageCeiling(stopped.action.damage);
  const health = rulesetCombatHealth(definition, combat, actor);
  return most > 0 && most >= Math.max(1, health.value + health.temp);
}

/** The level of the cast an answer would stop (Counterspell's target): what its caster paid for it,
 *  0 for a cantrip. An answer at our own cast is that answer's level. */
function rulesetStoppedLevel(definition: RulesetDefinition, encounter: RulesetEncounterState): number {
  const trigger = encounter.window?.trigger;
  if (!trigger || (trigger.kind !== "aimed" && trigger.kind !== "used")) return 0;
  const source = rulesetCombatant(encounter, trigger.sourceId);
  const action = source?.actions.find((one) => one.id === trigger.optionId);
  if (!source || !action) return 0;
  const resume = encounter.window?.resume;
  const payWith =
    (resume?.kind === "action" || resume?.kind === "answer") && resume.actorId === source.id
      ? resume.payWith
      : undefined;
  return rulesetPaidLevel(definition, source, action, payWith);
}

/** What healing is worth to one: only what they are missing counts, and less the less they miss, so
 *  a Second Wind is kept for when it matters rather than spent on a scratch. */
function rulesetHealingWorth(average: number, health: { value: number; max: number }): number {
  const max = Math.max(1, health.max);
  const missing = Math.max(0, health.max - health.value);
  // A scratch is no reason to spend a turn or a potion on mending (I2: healing given at 85%).
  if (missing < max * 0.25) return 0;
  return (Math.min(average, missing) / max) * Math.min(1, (2 * missing) / max);
}

/** Whether a pool of this fighter's sheet has room for more. */
function rulesetPoolHasRoom(definition: RulesetDefinition, fighter: RulesetCombatant, pool: string): boolean {
  if (!fighter.sheet) return false;
  const now = readRulesetLive(definition, fighter.sheet.build, fighter.sheet.live, fighter.sheet.items).pools.find(
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
  way: { payWith?: string; style?: string; mode?: string; option?: RulesetCombatOption },
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
  // An alteration that spares its own side for nothing (Sculpt Spells), taken whenever the aim would
  // catch a friend it can spare (re-test 2026-10-23: an Evoker's Fireball hit the fighter for 23).
  const action = actor.actions.find((one) => one.id === option.id);
  const sculpt = option.alters?.find(
    (offer) => offer.cost === 0 && !offer.budget && ((offer.spares ?? 0) > 0 || offer.sparesByLevel),
  );
  const spareable = sculpt
    ? (sculpt.spares ?? 0) +
      (sculpt.sparesByLevel && action ? rulesetPaidLevel(definition, actor, action, way.payWith) : 0)
    : 0;
  for (const aim of aims) {
    const all = aim.targetIds
      .map((id) => rulesetCombatant(encounter, id))
      .filter((target): target is RulesetCombatant => !!target);
    const mine = all.filter((target) => target.side === actor.side);
    const spared = sculpt && mine.length > 0 && mine.length <= spareable ? mine.map((one) => one.id) : [];
    const caught = spared.length ? all.filter((target) => !spared.includes(target.id)) : all;
    const foes = caught.filter((target) => target.side !== actor.side && !target.down);
    const candidate: CombatAiCandidate<RulesetCandidate> = {
      action: {
        choice: {
          actorId: actor.id,
          optionId: option.id,
          targetIds: [],
          at: { x: aim.x, y: aim.y },
          ...paying(way),
          ...(spared.length
            ? { alters: [...(way.option?.alterNeeded ? [way.option.alterNeeded] : []), sculpt!.id], spares: spared }
            : {}),
        },
        option,
        ...(foes[0] ? { targetId: foes[0].id } : {}),
        ...(standing ? { to: { ...standing } } : {}),
      },
      ...(foes[0] ? { targetId: foes[0].id } : {}),
      cost: price,
    };
    if (!weighCaught(definition, combat, encounter, actor, option, caught, candidate)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * Who of those caught a health pool or a health ceiling reaches (re-test 10): Sleep's 5d8 shared out
 * least health first while its average lasts, Power Word Stun only at or under its number. Everybody
 * caught, for anything else. A Sleep that can put nobody down is worth nothing, so it never spends a
 * slot held back for Shield.
 */
function rulesetPoolReaches(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  actor: RulesetCombatant,
  action: RulesetCombatAction | undefined,
  caught: RulesetCombatant[],
  payWith: string | undefined,
): RulesetCombatant[] {
  if (!action || (!action.healthPool && action.healthAtMost === undefined)) return caught;
  const healthOf = (target: RulesetCombatant) => rulesetCombatHealth(definition, combat, target).value;
  const under =
    action.healthAtMost !== undefined ? caught.filter((target) => healthOf(target) <= action.healthAtMost!) : caught;
  if (!action.healthPool) return under;
  const step = action.use?.perCostStep;
  const steps = step && payWith ? rulesetCostSteps(definition, action, payWith, actor) : 0;
  let left =
    rulesetAverageAmount(action.healthPool) +
    (step ? Math.floor(steps / (action.use?.stepsEvery ?? 1)) * rulesetAverageAmount(step) : 0);
  const reached: RulesetCombatant[] = [];
  for (const target of [...under].sort((a, b) => healthOf(a) - healthOf(b))) {
    const health = healthOf(target);
    if (health > left) continue;
    left -= health;
    reached.push(target);
  }
  return reached;
}

/** What a shape is worth by whom it catches (an aimed one, or one centred on its maker, 1.282): the
 *  harm to the other side less the harm to its own, healing for its own, or a setup or a support.
 *  False when it is worth nothing. */
function weighCaught(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  option: RulesetCombatOption,
  caught: RulesetCombatant[],
  candidate: CombatAiCandidate<RulesetCandidate>,
): boolean {
  const average = option.forecast?.averageDamage ?? 0;
  const chance = option.forecast?.hitChance ?? 1;
  // What its conditions are worth on each it catches, read off the ruleset (see `rulesetEffectWorth`).
  const action = actor.actions.find((one) => one.id === option.id);
  caught = rulesetPoolReaches(definition, combat, actor, action, caught, candidate.action.choice.payWith);
  // Only who it may take, by what they are (class re-test 2026-10-24: Turn the Unholy weighed as
  // turning the paladin and the monk it was read out around, so it was never used on the undead).
  caught = caught.filter((target) => rulesetTargetTypesAllow(definition, target, action?.targetTypes, actor));
  // Nor anyone sealed off from it, or anyone at all when it is the one sealed in (cloud batch
  // 2026-10-26: a mage in a Bead of Force's sphere cast Fireball twice at a party it could not reach).
  caught = caught.filter((target) => !rulesetSealedApart(definition, encounter, actor, target));
  // A hazard that strikes only whoever walks into it (caltrops) does nothing as it is laid to the
  // other side already standing there: they are not walking in (I3 re-test 2026-10-23: caltrops
  // laid on a wolf's own square).
  const onEntryOnly =
    !!action?.zone && action.zone.atCast === false && action.zone.triggers.every((trigger) => trigger === "enter");
  const foes = onEntryOnly ? [] : caught.filter((target) => target.side !== actor.side && !target.down);
  let friends = caught.filter((target) => target.side === actor.side);
  // Never one that lands on a friend standing in it, whatever it would take from the other side
  // (laptop 2026-10-25: Hypnotic Pattern over the fighter at grips with the Alpha, and Call Lightning
  // on the square beside him): a tactician aims it elsewhere or uses something else.
  const struck = onEntryOnly
    ? []
    : friends.filter((target) => target.id !== actor.id && !target.down && rulesetCombatStanding(target));
  if (!option.heals && option.targets.side !== "ally" && option.targets.side !== "self" && struck.length > 0) {
    if (average > 0) return false;
    if (
      struck.some((target) => {
        const harm = rulesetEffectWorth(definition, combat, encounter, actor, action, target, true);
        return (
          harm === undefined ||
          harm > 0 ||
          rulesetDeniedHarm(definition, combat, encounter, actor, action, target, true) > 0
        );
      })
    )
      return false;
  }
  // A hazard that stays (lamp oil set alight, ball bearings) catches whoever walks into it later, and
  // its own side is who is fighting beside it (re-test 2026-10-23: the party burnt and tripped on
  // its own rogue's): a friend within a step of where it lands counts as caught.
  // One that leaves its own side out (Spirit Guardians) or goes where its maker goes catches no friend.
  // A friend's turn in it counts twice what a foe's does: they walk where the fight is, and a turn
  // of the party's lost is worse than one of theirs (re-test 2026-10-23: Web and ball bearings).
  const at = candidate.action.choice.at;
  let friendWeight = 1;
  // And the other side's within a step of it, who walk into it on their way (I3: caltrops and ball
  // bearings left in the pack): each counts at half of one caught where it lands.
  let walkers: RulesetCombatant[] = [];
  let nearOnly = new Set<string>();
  if (
    at &&
    action?.zone &&
    action.zone.rounds > 0 &&
    action.zone.triggers.length > 0 &&
    action.zone.anchor !== "caster" &&
    action.area?.friendlyFire !== false &&
    !option.heals
  ) {
    friendWeight = 2;
    // Never on a square one of its own side stands on, itself included: they burn in it before they
    // can step out (re-test 2026-10-24: burning oil poured on the fighter's square to reach a wolf).
    if (friends.length > 0) return false;
    const perCell = definition.combat?.distance?.perCell ?? 1;
    // An action's area is in cells already, as its range is.
    const reach = (action.area?.size ?? 1) + 1;
    const near = encounter.combatants.filter(
      (one) =>
        one.side === actor.side &&
        rulesetCombatStanding(one) &&
        !friends.includes(one) &&
        !!rulesetPositionOf(one) &&
        rulesetGapFrom(at, 1, one) <= reach,
    );
    // One beside it only walks in if it walks that way, so it counts at half of one caught where it
    // lands, as a foe beside it does; and its maker, who knows where it lies, not at all (I3 re-test
    // 2026-10-23: caltrops in a charging pack's way weighed as if the rogue would tread on them).
    nearOnly = new Set(near.map((one) => one.id));
    // Never beside a friend at grips with somebody: it steps where the fight goes, into it (re-test
    // 2026-10-24: burning oil poured a cell from the fighter brawling the ghouls, who walked in).
    if (
      near.some(
        (one) =>
          one.id !== actor.id &&
          encounter.combatants.some(
            (other) =>
              other.side !== actor.side &&
              !other.object &&
              rulesetCombatStanding(other) &&
              !!rulesetPositionOf(other) &&
              rulesetGap(one, other) <= 1,
          ),
      )
    )
      return false;
    friends = [...friends, ...near.filter((one) => one.id !== actor.id)];
    // And those of the other side who would cross it on their way to whoever of its side is nearest,
    // within a turn's walk (I3 re-test 2026-10-23: caltrops never laid before a charging wolf pack).
    const standing = encounter.combatants.filter(
      (one) => one.side === actor.side && rulesetCombatStanding(one) && !!rulesetPositionOf(one),
    );
    const onTheirWay = (one: RulesetCombatant) => {
      const to = standing.reduce<RulesetCombatant | undefined>(
        (best, friend) => (!best || rulesetGap(one, friend) < rulesetGap(one, best) ? friend : best),
        undefined,
      );
      if (!to) return false;
      const apart = rulesetGap(one, to);
      // Already at grips, it walks nowhere.
      if (apart <= 1) return false;
      const there = rulesetGapFrom(at, 1, one);
      const walks = rulesetInCells(one.speed, perCell);
      return there <= walks && there + rulesetGapFrom(at, 1, to) <= apart;
    };
    // One that shoots or casts at its nearest opponent from where it stands walks nowhere (AI pass
    // 2026-10-24: oil and caltrops laid round two mages eleven squares off).
    const shoots = (one: RulesetCombatant) => {
      const to = standing.reduce<RulesetCombatant | undefined>(
        (best, friend) => (!best || rulesetGap(one, friend) < rulesetGap(one, best) ? friend : best),
        undefined,
      );
      return (
        !!to &&
        one.actions.some(
          (blow) =>
            !!blow.damage &&
            !!blow.range &&
            !blow.reach &&
            blow.range.normal >= rulesetGap(one, to) &&
            rulesetActionAvailable(one, blow, encounter, definition),
        )
      );
    };
    walkers = encounter.combatants.filter(
      (one) =>
        one.side !== actor.side &&
        !one.object &&
        !one.down &&
        rulesetCombatStanding(one) &&
        !caught.includes(one) &&
        !!rulesetPositionOf(one) &&
        !shoots(one) &&
        (rulesetGapFrom(at, 1, one) <= reach || onTheirWay(one)),
    );
    // Its own side walks the same ground: a friend nearer it than any of those walkers, on its way to
    // the nearest of the other side, crosses it first (re-test 2026-10-23: caltrops and burning oil
    // laid four squares before the party, where the party stepped on them and the wolves never did).
    const first = Math.min(Infinity, ...walkers.map((one) => rulesetGapFrom(at, 1, one)));
    const others = encounter.combatants.filter(
      (one) => one.side !== actor.side && rulesetCombatStanding(one) && !!rulesetPositionOf(one),
    );
    const crossing = standing.filter((friend) => {
      if (friend.id === actor.id || friends.includes(friend)) return false;
      const to = others.reduce<RulesetCombatant | undefined>(
        (best, one) => (!best || rulesetGap(friend, one) < rulesetGap(friend, best) ? one : best),
        undefined,
      );
      if (!to) return false;
      const apart = rulesetGap(friend, to);
      // At grips already, or with the other side coming to it within a turn, it walks nowhere.
      if (apart <= 1 || rulesetInCells(to.speed, perCell) + 1 >= apart) return false;
      const there = rulesetGapFrom(at, 1, friend);
      return (
        there <= first && there <= rulesetInCells(friend.speed, perCell) && there + rulesetGapFrom(at, 1, to) <= apart
      );
    });
    for (const friend of crossing) nearOnly.add(friend.id);
    friends = [...friends, ...crossing];
  }
  const worthOn = (target: RulesetCombatant) =>
    rulesetEffectWorth(definition, combat, encounter, actor, action, target);
  const riders = (who: RulesetCombatant[]) => who.reduce((sum, target) => sum + (worthOn(target) ?? 0), 0);
  // What it does to its own side caught in it, weighed as the harm it is.
  const beside = (target: RulesetCombatant) => (nearOnly.has(target.id) ? 0.5 : 1);
  const harms = (who: RulesetCombatant[]) =>
    friendWeight *
    who.reduce(
      (sum, target) =>
        sum + beside(target) * (rulesetEffectWorth(definition, combat, encounter, actor, action, target, true) ?? 0),
      0,
    );
  if (option.heals) {
    const helped = friends.filter((target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return target.down || health.value < health.max;
    });
    if (helped.length === 0) return false;
    candidate.healing = helped.reduce((total, target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return total + rulesetHealingWorth(average, health) + (target.down ? 1 : 0);
    }, 0);
  } else if (average > 0) {
    if (foes.length === 0 && walkers.length === 0) return false;
    // Never a blast that catches its own maker: one whose area spares it never has it among those
    // caught, so here it would take the blow it throws (cheap-GM playtest 2026-10-26: a bard's
    // Shatter caught herself). A tactician aims it elsewhere or does something else.
    if (caught.some((target) => target.id === actor.id && !target.down)) return false;
    // Each foe counts for at most what dropping it is worth, weighed against what its side stands up
    // with as a blow is: a cleric at 3 health is not worth a Fireball over its own two mages.
    const share = [...foes, ...walkers].reduce((total, target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      const pool = Math.max(
        1,
        health.value + health.temp,
        0.75 * rulesetSideHealthMean(definition, combat, encounter, target.side),
      );
      return total + (walkers.includes(target) ? 0.5 : 1) * Math.min(1, average / pool);
    }, 0);
    // Never one that would likely drop somebody of its own side either: a mage's Fireball over the
    // other mage. A friend it only grazes counts against it three times over, and its own hide four times.
    if (
      caught.some(
        (target) =>
          target.side === actor.side &&
          target.id !== actor.id &&
          rulesetCombatStanding(target) &&
          average * chance >= rulesetCombatHealth(definition, combat, target).value,
      )
    )
      return false;
    const hurt = friends.reduce((total, target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return (
        total + (beside(target) * (target.id === actor.id ? 4 : 3) * average) / Math.max(1, health.value + health.temp)
      );
    }, 0);
    // What it puts on those it catches as well, less what it puts on its own (a burst that stuns).
    const rider = riders(foes) + 0.5 * riders(walkers) - harms(friends);
    // And worth at least twice what it costs its own: a blast that only just outweighs burning a
    // friend is one no tactician throws. A lasting hazard's worth is mostly what it puts on those
    // who walk in (caltrops that stop them), so that counts beside the harm.
    if (hurt > 0 && share + (walkers.length ? Math.max(0, rider) : 0) < 2 * hurt) return false;
    candidate.damage = Math.max(0, Math.min(2, (share - hurt) * rulesetZoneRepeats(action))) * chance;
    if (candidate.damage <= 0 && !(walkers.length && rider > 0)) return false;
    // Whom of the other side it could drop, for orders that spare them: by the most it can do, as a
    // single blow is weighed (K6 re-test 2026-10-24: a duellist under orders to spare killed an
    // archer with an area blast).
    const most = rulesetCombatIsPool(combat)
      ? Math.max(average, rulesetPoolDamageMost(action?.damage))
      : average * rulesetDamageCeiling(action?.damage);
    const dropped = foes.filter((target) => {
      const health = rulesetCombatHealth(definition, combat, target);
      return most >= Math.max(1, health.value + health.temp);
    });
    if (dropped.length) candidate.action.drops = dropped.map((target) => target.id);
    if (rider > 0) candidate.setup = Math.min(2, rider) * chance;
  } else if (foes.length > 0 || walkers.length > 0) {
    // What it puts on them, less what it puts on its own side: a Hypnotic Pattern over the party
    // and not over its own.
    const read = [...foes, ...walkers].some((target) => worthOn(target) !== undefined);
    // What it does that the Engine cannot weigh (a withering blow's initiative, a pool's points) it
    // does to a friend as much as to a foe (K5: Exalted's withering areas over the thrower's own): each
    // friend caught takes off what a foe adds.
    // Its maker caught counts as a friend caught, and each friend caught twice what a foe does: a
    // withering volley over its own archer, or a soldier of its own beside two foes, takes from its
    // own side what it gives it (AI pass 2026-10-24: Exalted fire-arrow volleys, 8 in 64 over their own).
    const own = friends.filter((target) => !target.down).length;
    const unread = foes.length + 0.5 * walkers.length - 2 * friendWeight * own;
    const worth = read
      ? riders(foes) + 0.5 * riders(walkers) - harms(friends)
      : unread / Math.max(1, foes.length + walkers.length);
    if (worth <= 0) return false;
    candidate.setup = read ? Math.min(2, worth) : 0.4 * worth;
    // The turns it takes from them are counted as a single target's are (a Hold Person's): the blows
    // they would have struck (class re-test 2026-10-24: Turn the Unholy never used on three zombies).
    const denied =
      foes.reduce((sum, target) => sum + rulesetDeniedHarm(definition, combat, encounter, actor, action, target), 0) +
      0.5 *
        walkers.reduce(
          (sum, target) => sum + rulesetDeniedHarm(definition, combat, encounter, actor, action, target),
          0,
        );
    // Less the turns it takes from its own caught in it, each twice a foe's (laptop party A: a
    // Hypnotic Pattern over the party's fighter, who failed and stood helpless).
    const lost =
      2 *
      friendWeight *
      friends.reduce(
        (sum, target) =>
          sum + beside(target) * rulesetDeniedHarm(definition, combat, encounter, actor, action, target, true),
        0,
      );
    if (read && denied > 0 && denied <= lost) return false;
    if (read && denied > 0) {
      candidate.damage = Math.min(2, denied - lost);
      candidate.action.denies = candidate.damage;
      candidate.setup *= 0.5;
    }
  } else {
    // Something meant for the other side that would catch only its own: ball bearings under a friend.
    if (option.targets.side === "enemy") return false;
    // Nor anybody at all: ball bearings thrown on an empty floor beside a friend, who then walks on
    // them. What is worth laying for nobody yet is weighed as a zone, never here.
    if (friends.length === 0) return false;
    // And nothing that would harm the friends it catches: ball bearings under them, any side's.
    if (harms(friends) > 0 && riders(friends) <= 0) return false;
    if (option.restores && !friends.some((friend) => rulesetPoolHasRoom(definition, friend, option.restores!))) {
      return false;
    }
    const read = friends.some((target) => worthOn(target) !== undefined);
    // What it does unread is support only where it is meant for its own side (K5: a withering area
    // thrown over two friends and no foe, logged as support).
    if (!read && option.targets.side !== "ally" && !option.restores) return false;
    const worth = riders(friends);
    if (read && worth <= 0) return false;
    candidate.support = read ? Math.min(2, worth) : 0.4;
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
  const picked = repositionCell(
    definition,
    combat,
    encounter,
    actor,
    cells,
    // Paid for out of a pool, or out of uses it has only so many of.
    !!option.cost?.length || !!actor.actions.find((one) => one.id === option.id)?.uses,
  );
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
  /** Paid for (a spell's slot, a use of a few a day): it closes in by it only where its walk would not get it there. */
  paid = false,
): { best: { x: number; y: number }; worth: number } | null {
  const span = rulesetSpanOf(actor);
  const foes = encounter.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && !one.away && !!rulesetPositionOf(one),
  );
  if (foes.length === 0 || !rulesetPositionOf(actor)) return null;
  // Never into a lasting area or aura that would finish it.
  cells = cells.filter((cell) => !rulesetZoneKillsAt(definition, encounter, actor, cell));
  if (cells.length === 0) return null;
  const nearest = (at: { x: number; y: number }) => Math.min(...foes.map((foe) => rulesetGapFrom(at, span, foe)));
  const here = rulesetPositionOf(actor)!;
  const health = rulesetCombatHealth(definition, combat, actor);
  const reaches = actor.actions
    .filter((action) => action.kind !== "reload" && action.damage && action.reach !== undefined && !action.range)
    .map((action) => action.reach!);
  let best: { x: number; y: number } | null = null;
  let worth = 0;
  // How far outside the reach of whoever reaches furthest toward it a cell is: 0 or less is in it. A
  // dragon's bite reaches two squares (AI pass 2026-10-24: a Misty Step that landed two squares from
  // a young dragon, in its reach, and the walk on was bitten).
  const clearOf = (at: { x: number; y: number }) =>
    Math.min(
      ...foes.map((foe) => rulesetGapFrom(at, span, foe) - Math.max(1, rulesetOpportunityAttack(foe)?.reach ?? 1)),
    );
  if (clearOf(here) <= 0 && health.max > 0 && health.value * 2 <= health.max) {
    // Fleeing: the cell clearest of every enemy's reach, then farthest from them, and only if it gets
    // clear of them all.
    for (const cell of cells)
      if (!best || clearOf(cell) > clearOf(best) || (clearOf(cell) === clearOf(best) && nearest(cell) > nearest(best)))
        best = cell;
    if (best && clearOf(best) > 0) worth = 0.6;
  } else if (
    reaches.length > 0 &&
    nearest(here) > Math.max(...reaches) &&
    // A slot spent where its own walk would do (cheap-GM playtest 2026-10-26: Misty Step cast with
    // nobody near and nobody threatening) is a slot wasted: paid for, it closes in only past its walk.
    (!paid ||
      nearest(here) >
        Math.max(...reaches) +
          (actor.movementLeft ??
            (definition.combat?.distance?.perCell
              ? rulesetInCells(actor.speed, definition.combat.distance.perCell)
              : 6)))
  ) {
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
  /** Guarding or protecting somebody (P7): only cells within `within` of them, and back toward them
   *  first when it has strayed further. */
  leash?: RulesetLeash,
  /** Toward this opponent only, not the nearest. */
  toward?: string,
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
  const span = rulesetSpanOf(actor);
  const strayed = !!leash && rulesetGapFrom(from, span, leash.charge) > leash.within;
  const foes = strayed
    ? rulesetFootprint(leash!.charge)
    : encounter.combatants
        .filter(
          (combatant) =>
            combatant.side !== actor.side &&
            rulesetCombatStanding(combatant) &&
            (toward === undefined || combatant.id === toward),
        )
        // Every cell an opponent fills (1.194).
        .flatMap((combatant) => rulesetFootprint(combatant));
  if (foes.length === 0) return null;
  const walking = rulesetWalkingDistances(encounter.board.grid, foes, actor);
  // Somebody bigger than one cell is as near as the nearest cell they would fill (1.194).
  const nearest = (cell: { x: number; y: number }) =>
    Math.min(...rulesetFootprintAt(cell, span).map((one) => walking.get(`${one.x},${one.y}`) ?? Infinity));
  const already = nearest(from);
  // Bunched with its own side under an opponent's blast (S1): as good as a couple of cells further
  // off at worst, so it closes in spread out rather than in a clump.
  const combat = definition.combat;
  const health = combat ? rulesetCombatHealth(definition, combat, actor) : undefined;
  const pool = Math.max(1, (health?.value ?? 1) + (health?.temp ?? 0));
  const crowded = (cell: { x: number; y: number }) =>
    Math.min(2, (2 * rulesetCrowdHarmAt(definition, encounter, actor, cell)) / pool);
  type Stop = { cell: { x: number; y: number; cost: number; provokes: string[] }; away: number } | null;
  let best: Stop = null;
  // Where it would stop with nobody to keep apart from, to tell when keeping apart moved it.
  let plain: Stop = null;
  // Every cell it may walk to, not a sample of them: closing the distance is one comparison a cell.
  for (const cell of rulesetWalkableCells(definition, encounter, actorId)) {
    const closer = nearest(cell);
    if (closer >= already) continue;
    if (leash && !strayed && rulesetGapFrom(cell, span, leash.charge) > leash.within) continue;
    // Never through a lasting area its own side laid that harms whoever enters it, nor into one, just
    // to get closer: whoever is beyond it comes through it instead (AI pass 2026-10-24: a rogue
    // sprinted through his own burning oil and caltrops). An opponent's it may still brave.
    if (
      rulesetPathZoneHarm(encounter, actor, cell.path, true) > 0 ||
      rulesetZoneHarmAt(encounter, actor, cell, true) > 0
    )
      continue;
    // Nor out through blows that would likely drop it on the way (cheap-GM playtest 2026-10-26: a
    // companion at 5 health walked out of melee toward another foe and was struck down): it stays
    // and does what it can where it stands.
    if (combat && cell.provokes.length > 0 && rulesetPartingHarm(encounter, cell.provokes) >= pool) continue;
    const beats = (than: Stop, away: number) =>
      !than ||
      away < than.away ||
      (away === than.away &&
        (cell.provokes.length < than.cell.provokes.length ||
          (cell.provokes.length === than.cell.provokes.length && cell.cost < than.cell.cost)));
    // Inside the spacing it deployed with, from its own side under a blast, only when no cell that
    // keeps it gets any closer (S1a-walk): Pip dashed beside Brom, and the first blast caught three.
    const away = closer + (rulesetTooCloseUnderBlast(definition, encounter, actor, cell) ? 1000 : crowded(cell));
    if (beats(best, away)) best = { cell, away };
    if (beats(plain, closer)) plain = { cell, away: closer };
  }
  if (!best) return null;
  return {
    choice: { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: best.cell.x, y: best.cell.y } },
    option: { id: RULESET_MOVE_OPTION, kind: "move", label: "Move", targets: { side: "self", count: 0 } },
    to: { x: best.cell.x, y: best.cell.y },
    walked: best.cell.cost,
    // It stopped somewhere else than the nearest for keeping apart from its own side (S1c).
    ...(plain && (plain.cell.x !== best.cell.x || plain.cell.y !== best.cell.y) ? { spread: true as const } : {}),
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
    // From whoever put it on, or the point it was put on from (1.457).
    const source = rulesetBehaviorAnchor(encounter, actor, entry.condition, entry.behavior);
    if (source) return { source, moves };
  }
  return null;
}

/** The choice the picker would make, or null when the actor has nothing at all to pick from. */
export function pickRulesetChoice(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  /** A window's own menu, when the pick is an answer to one rather than a turn. */
  menu?: RulesetCombatOption[],
): RulesetCandidate | null {
  return pickRulesetRanked(definition, state, encounter, actorId, menu)?.candidate.action ?? null;
}

/** A pick with how it was scored, for the reasons the debug log gives after it. */
interface RulesetRankedPick {
  candidate: CombatAiCandidate<RulesetCandidate>;
  parts: CombatAiScoreParts;
  /** An item's healing it weighed and kept for later, for the debug log (laptop playtest 2026-10-23:
   *  a bloodied fighter's potion never showed as weighed). */
  keptBack?: { label: string; targetId?: string };
}

/** The pick with how it was scored, for the reasons the debug log gives after it. */
function pickRulesetRanked(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  menu?: RulesetCombatOption[],
  /** Choices already tried this turn that could not be carried out (`rulesetChoiceKey`). */
  skip?: ReadonlySet<string>,
): RulesetRankedPick | null {
  // Every sheet, health and condition read while weighing is worked out once for the whole pick.
  return withRulesetPlanMemo(() => pickChoice(definition, state, encounter, actorId, menu, skip));
}

/** One choice as a key, to tell a choice already tried this turn from another. */
function rulesetChoiceKey(choice: RulesetCombatChoice): string {
  return JSON.stringify([choice.optionId, choice.targetIds, choice.to ?? null, choice.at ?? null]);
}

function pickChoice(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  menu?: RulesetCombatOption[],
  skip?: ReadonlySet<string>,
): RulesetRankedPick | null {
  const weighed = weighChoices(definition, state, encounter, actorId, menu, skip);
  if (!weighed || "only" in weighed) return weighed?.only ? { candidate: { action: weighed.only }, parts: {} } : null;
  const { unit, actor, candidates, orders, behavior, opening } = weighed;
  const ranked = chooseRankedCombatCandidate(
    unit,
    candidates,
    encounter.round,
    normalizeGameDifficulty(state.difficulty),
    orders,
  );
  const chosen = ranked.candidate.action;
  const kept =
    (ranked.candidate.healing ?? 0) > 0
      ? undefined
      : candidates.find(
          (one) =>
            one !== ranked.candidate &&
            (one.healing ?? 0) > 0 &&
            !!actor.actions.find((action) => action.id === one.action.option.id)?.itemUse,
        );
  if (opening && behavior!.opens!.some((id) => rulesetOpensWith(actor, chosen, id))) unit.tactics!.opened = true;
  // Counted only on its own turn's choice, not on a reaction's. Walking, dashing or waiting is not
  // fighting, so only a blow or a spell lets it grow careful again, and then for one turn at most:
  // otherwise a beast with nobody in reach hides, walks a step and hides again all fight.
  if (!menu && chosen) {
    if (rulesetDefensiveName(chosen.option)) unit.tactics!.wary = (unit.tactics!.wary ?? 0) + 1;
    else if (chosen.option.kind !== "move" && chosen.option.kind !== "end-turn" && chosen.option.kind !== "standard")
      unit.tactics!.wary = Math.min(unit.tactics!.wary ?? 0, 1);
  }
  return kept
    ? {
        ...ranked,
        keptBack: { label: kept.action.option.label, ...(kept.targetId ? { targetId: kept.targetId } : {}) },
      }
    : ranked;
}

/** How small a part of a pick's score is too small to give as a reason. */
const RULESET_REASON_FLOOR = 0.05;

/**
 * Why a pick was made, read back from its own scoring (debug log): the parts that weighed most,
 * largest first, at most three, then the walk it took to get where it acted from. Nothing here is
 * asked of a model, and nothing names a ruleset's own spells or attacks.
 */
function rulesetPickReasons(
  candidate: CombatAiCandidate<RulesetCandidate>,
  parts: CombatAiScoreParts,
  walked?: number,
  /** The fight, to tell a target of the other side: what helps or heals is never about that one. */
  encounter?: RulesetEncounterState,
  /** The rules, to tell a turn it could not use (paralysed) from one it chose to let go. */
  definition?: RulesetDefinition,
): DirectedRulesetReason[] {
  const targetId = candidate.targetId;
  const actor = encounter ? rulesetCombatant(encounter, candidate.action.choice.actorId) : undefined;
  const target = encounter && targetId ? rulesetCombatant(encounter, targetId) : undefined;
  // A blow's help or healing is for its own side, never the one it strikes (re-test 2026-10-23: a
  // troll's Multiattack logged "support@Pip").
  const foe = !!actor && !!target && target.side !== actor.side;
  // A roll it has to make where it lies (one against death) is no choice, and says no why.
  if (actor && !rulesetCombatStanding(actor)) return [];
  // Held helpless, its turn ends with nothing done: not for the risk of doing anything (cloud AI
  // fights 2026-10-25: a paralysed gladiator boss logged "risk").
  if (
    actor &&
    encounter &&
    definition?.combat &&
    candidate.action.option.kind === "end-turn" &&
    rulesetCombatEffects(definition, definition.combat, actor, encounter).has("cannot-act")
  )
    return [{ why: "cannotAct" }];
  const ranked = (Object.entries(parts) as Array<[keyof CombatAiScoreParts, number]>).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  );
  const said = ranked.filter(([, part]) => Math.abs(part) >= RULESET_REASON_FLOOR).slice(0, 3);
  // A step taken for a small gain still says it: the largest gain is its reason, however small
  // (re-test 2026-10-24: a zombie's slam on the fighter with nothing said).
  if (said.length === 0 && candidate.action.option.kind !== "end-turn") {
    const gain = ranked.find(([, part]) => part > 0);
    if (gain) said.push(gain);
    else if ((candidate.damage ?? 0) > 0 || candidate.action.option.kind === "attack") said.push(["damage", 0]);
  }
  const reasons = said.map(([why]): DirectedRulesetReason => {
    // Most of its worth is the harm it keeps them from doing: that is why, not a blow.
    if (why === "damage" && (candidate.action.combo ?? 0) * 2 >= (candidate.damage ?? 0) && targetId)
      return { why: "setup", targetId };
    if (why === "damage" && (candidate.action.denies ?? 0) * 2 >= (candidate.damage ?? 0) && targetId)
      return { why: "takesTurn", targetId };
    if (why === "damage" && (candidate.action.boosts ?? 0) * 2 >= (candidate.damage ?? 0))
      return { why: "support", ...(targetId ? { targetId } : {}) };
    // Harm it does by turning itself into something (a druid's Wild Shape) is no blow on itself
    // (laptop playtest 2026-10-25: "solid damage to Blighted Druid").
    if (why === "damage" && actor && targetId === actor.id) return { why: "support", targetId };
    if (why === "damage") {
      const damage = candidate.damage ?? 0;
      return {
        why,
        ...(targetId ? { targetId } : {}),
        strength: damage >= 0.5 ? "heavy" : damage >= 0.2 ? "solid" : "some",
        ...(candidate.action.edge ? { edge: { ...candidate.action.edge } } : {}),
      };
    }
    if (why === "risk" || why === "cost") return { why };
    if (foe && (why === "healing" || why === "support" || why === "protection")) return { why };
    // Its own side's one is not one it wants down: the friend it picked is the one most in need
    // (laptop playtest 2026-10-23: "heals Isolde; Isolde is the one its side most wants down").
    if (why === "focus" && target && actor && !foe) return { why: "mostInNeed", ...(targetId ? { targetId } : {}) };
    return { why, ...(targetId ? { targetId } : {}) };
  });
  // The help it gives, weighed both as help and as what it gains them, is said once.
  const once = reasons.filter(
    (reason, index) => reasons.findIndex((other) => JSON.stringify(other) === JSON.stringify(reason)) === index,
  );
  reasons.splice(0, reasons.length, ...once);
  if (candidate.action.spareYields) reasons.unshift({ why: "spareYields" });
  if (walked) reasons.push({ why: "walked", cells: walked });
  // Surprised, it could only end its turn: not a choice (laptop playtest 2026-10-25: "nothing it could
  // do was worth the price").
  // Whatever else its parts said (laptop playtest 2026-10-25: a surprised High Priest's first turn
  // read "worth the danger it puts itself in").
  if (candidate.action.option.kind === "end-turn" && actor?.surprised) return [{ why: "cannotAct" }];
  if (reasons.length === 0 && candidate.action.option.kind === "end-turn")
    reasons.push({ why: candidate.action.spares ? "sparing" : "nothingWorth" });
  return reasons;
}

/**
 * An answer that harms nobody itself, to something about to happen or a hit about to land, is worth
 * what it stops, which the score reads as the harm or the healing kept: said as what it is (laptop
 * playtest 2026-10-23: a Shield logged as healing its target, a Counterspell as some damage to the
 * caster). One that stops what opened the window (a Counterspell, its reaction `cancels`) says so;
 * any other (a Shield, an Uncanny Dodge) wards it off (re-test 2026-10-24: a Counterspell, aimed at
 * its own caster in the SRD, said it warded). What it risked or spent is still said.
 */
export function rulesetWindowReasons(
  trigger: RulesetWindowTrigger,
  candidate: CombatAiCandidate<RulesetCandidate>,
  reasons: DirectedRulesetReason[],
  cancels = false,
): DirectedRulesetReason[] {
  if (trigger.kind !== "aimed" && trigger.kind !== "used" && trigger.kind !== "hit") return reasons;
  // Its own hit's answer (a smite, a stun) wards nothing off: it is said as what it does.
  if (trigger.kind === "hit" && trigger.sourceId === candidate.action.choice?.actorId) return reasons;
  const option = candidate.action.option;
  if ((option.forecast?.averageDamage ?? 0) > 0 || option.heals) return reasons;
  const kept = reasons.filter((reason) => reason.why === "risk" || reason.why === "cost");
  const wards = trigger.kind === "hit" || !cancels;
  return [...kept, wards ? { why: "wards" } : { why: "stops", targetId: trigger.sourceId }];
}

/** The reasons for a step just taken, on the log after it. Nothing when there is nothing to say. */
function recordReasons(fight: RulesetFightState, actorId: string, reasons: DirectedRulesetReason[]): void {
  if (reasons.length) record(fight, [{ type: "reasoning", actorId, reasons }]);
}

/**
 * What the Engine's own tactics would do with this unit's turn, best first (the Game Master's
 * suggestions): its candidates weighed and scored exactly as its own pick weighs them, with what
 * each part of the score came from. Nothing on the unit changes. Empty for one with nobody to play it.
 */
export function rankRulesetChoices(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  count: number,
  menu?: RulesetCombatOption[],
): Array<{ candidate: CombatAiCandidate<RulesetCandidate>; score: number; parts: CombatAiScoreParts }> {
  return withRulesetPlanMemo(() => {
    const weighed = weighChoices(definition, state, encounter, actorId, menu);
    if (!weighed || "only" in weighed) return [];
    const tactics = structuredClone(weighed.unit.tactics);
    try {
      return rankCombatCandidates(
        weighed.unit,
        weighed.candidates,
        encounter.round,
        normalizeGameDifficulty(state.difficulty),
        weighed.orders,
      ).slice(0, count);
    } finally {
      weighed.unit.tactics = tactics;
    }
  });
}

/** The catalog entry (`catalog/entry`) named `name` that answers a moment (a reaction such as 5e's
 *  Counterspell or Shield), outside the bestiaries, or undefined. */
function rulesetAnsweringEntryRef(catalogs: RulesetCatalogEntriesById, name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    const entry = entries.find(
      (one) => !one.creature && !!one.mechanics?.reaction && one.label.trim().toLowerCase() === wanted,
    );
    if (entry) return `${catalogId}/${entry.id}`;
  }
  return undefined;
}

/** A unit for a combatant the Engine keeps none for, read afresh from the fight at each pick. */
function rulesetPassingUnit(actor: RulesetCombatant): CombatDirectorState["party"][number] {
  return {
    id: actor.id,
    name: actor.name,
    side: actor.side === "party" ? "player" : "enemy",
    hp: 1,
    maxHp: 1,
    attack: 0,
    defense: 0,
    speed: 0,
    level: 1,
  };
}

/** The party members an opponent eases off (laptop pass 6 2026-10-26): at a casual or a normal table,
 *  those held open to criticals while half the party or more is so held or down and somebody of it
 *  still stands free. A cruel one too (laptop interim 2026-10-26: the SRD's cruel ghouls critted a
 *  held hero down while her friend stood free, and the party of two fell). */
function rulesetSparedHelpless(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): Set<string> {
  const none = new Set<string>();
  if (actor.side !== "enemy") return none;
  const difficulty = normalizeGameDifficulty(state.difficulty);
  if (difficulty !== "casual" && difficulty !== "normal") return none;
  const party = encounter.combatants.filter((one) => one.side === "party" && one.calledBy === undefined);
  const standing = party.filter((one) => rulesetCombatStanding(one) && !one.down);
  const held = standing.filter((one) => rulesetSetUpWay(definition, encounter, one) === "critical");
  if (held.length === 0 || held.length === standing.length) return none;
  return held.length + (party.length - standing.length) >= party.length / 2 ? new Set(held.map((one) => one.id)) : none;
}

/** What a shot of ammunition with clauses of its own counts for, of its forecast (2026-10-26). */
const RULESET_SPECIAL_SHOT_KEPT = 0.9;

/** The candidates of a pick, weighed by everything the unit is and was told; `only` where there is
 *  nothing to weigh. */
function weighChoices(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  menu?: RulesetCombatOption[],
  skip?: ReadonlySet<string>,
):
  | { only: RulesetCandidate }
  | {
      unit: CombatDirectorState["party"][number];
      actor: RulesetCombatant;
      candidates: Array<CombatAiCandidate<RulesetCandidate>>;
      orders: CombatOrders | undefined;
      behavior: ReturnType<typeof rulesetCombatantBehavior> | undefined;
      opening: boolean;
    }
  | null {
  const actor = rulesetCombatant(encounter, actorId);
  // One that came into the fight after it began (a summons) has no unit of the Engine's own: it is
  // weighed with one made for this pick, not handed the first thing it could do (cloud AI fights
  // 2026-10-25: Draft Horses called by Conjure Animals idled two cells from the Gladiator).
  const unit =
    [...state.party, ...state.enemies].find((entry) => entry.id === actorId) ??
    (actor ? rulesetPassingUnit(actor) : undefined);
  // Its mind as its own data says (1.761), unless the Game Master said otherwise for this fight: a
  // profile made before that was read is made again with it.
  if (unit && actor) {
    // How hurt it is, as the fight has it now: what a coward or a hurt animal weighs.
    if (definition.combat) {
      const health = rulesetCombatHealth(definition, definition.combat, actor);
      unit.maxHp = Math.max(1, Math.floor(health.max));
      unit.hp = Math.min(unit.maxHp, Math.max(0, Math.floor(health.value)));
    }
    const mind = rulesetCombatantMind(definition, actor);
    const hinted = unit.aiHints?.mind ?? (unit.aiHints?.temperament === "mindless" ? "mindless" : undefined);
    const wanted = combatMindWithHint(hinted, mind);
    if (!unit.tactics || (wanted !== undefined && unit.tactics.mind !== wanted)) {
      // The ground it keeps stays where it was (combat AI T4).
      const home = unit.tactics?.home;
      delete unit.tactics;
      unit.tactics = assignCombatTactics(unit, state.seed, mind);
      if (home) unit.tactics.home = home;
    }
    rulesetReadRole(definition, unit, actor, encounter);
    // How its own data says it goes about a fight (1.763): its temperament, unless the Game Master
    // gave it one for this fight, and its role.
    const behavior = rulesetCombatantBehavior(definition, actor);
    if (behavior && unit.tactics.mind !== "mindless") {
      if (behavior.temperament && !unit.aiHints?.temperament && !unit.tactics.shifted)
        unit.tactics.adjective = behavior.temperament;
      if (behavior.role) unit.tactics.role = behavior.role;
    }
  }
  const ordered = unit && actor ? rulesetOrdersFor(definition, encounter, actor, unit) : undefined;
  // Retreating with nobody beside it, it has already got away: it helps from afar as `back` does
  // rather than dodging nobody (re-test 2026-10-23: two turns of Dodge with foes 4 and 9 squares off).
  const orders =
    ordered?.posture === "retreat" &&
    actor &&
    !encounter.combatants.some(
      (foe) =>
        foe.side !== actor.side &&
        rulesetCombatStanding(foe) &&
        !!rulesetPositionOf(foe) &&
        !!rulesetPositionOf(actor) &&
        rulesetGap(foe, actor) <= 1,
    )
      ? { ...ordered, posture: "back" as const }
      : ordered;
  let candidates = menu
    ? rulesetCandidatesFrom(definition, encounter, actorId, null, brokenLairMenu(definition, encounter, actorId, menu))
    : rulesetCandidates(definition, encounter, actorId, false, unit?.tactics, orders);
  if (skip?.size) candidates = candidates.filter((candidate) => !skip.has(rulesetChoiceKey(candidate.action.choice)));
  if (candidates.length === 0) return null;
  if (!unit || !actor) return { only: candidates[0]!.action };
  // A mindless bodyguard weighs nothing but the blow, so its order narrows what it does instead: it
  // strikes whoever is on its charge when it can, before going at the nearest.
  if (unit.tactics!.mind === "mindless" && orders?.protectId && actor.side !== "party") {
    const charge = rulesetCombatant(encounter, orders.protectId);
    const onCharge = candidates.filter((candidate) => {
      const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
      return !!charge && !!target && target.side !== actor.side && rulesetGap(target, charge) <= 1;
    });
    if (onCharge.length > 0) candidates = onCharge;
  }
  if (unit.tactics!.mind === "mindless")
    candidates = mindlessCandidates(encounter, actor, unit.tactics!, candidates, !!menu);
  weighRulesetTeam(definition, state, encounter, actor, candidates, orders);
  if (orders) weighRulesetOrders(definition, state, encounter, actor, orders, candidates);
  weighRulesetDowned(definition, state, encounter, actor, candidates);
  if (!menu && actor.side === "party") weighRulesetBlasters(definition, state, encounter, actor, candidates);
  // An honourable one (combat AI T6) strikes nobody running from it, beaten or down, and fights
  // whoever is fighting it, one on one.
  if (unit.tactics!.adjective === "honourable") {
    const fair = candidates.filter((candidate) => {
      const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
      return !target || target.side === actor.side || !(target.routed || target.down || target.away?.surrendered);
    });
    if (fair.length > 0) candidates.splice(0, candidates.length, ...fair);
    for (const candidate of candidates) {
      const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
      if (!target || target.side === actor.side || (!candidate.damage && !candidate.setup)) continue;
      // Most of all the one that last hurt it, and whoever stands up to it beside it.
      const beside = !!rulesetPositionOf(target) && !!rulesetPositionOf(actor) && rulesetGap(actor, target) <= 1;
      candidate.focus = (candidate.focus ?? 0) + (actor.harmedBy === target.id ? 0.6 : 0) + (beside ? 0.3 : 0);
    }
  }
  // A hungry one (combat AI T8) keeps at the one prey it has chosen: with it in hand, by biting it
  // (re-test 16, a hundred shoves at a cornered Mira).
  if (unit.tactics!.adjective === "hungry" && unit.tactics!.targetId) {
    const held = rulesetDragging(definition, encounter, actor).ids.includes(unit.tactics!.targetId);
    for (const candidate of candidates)
      if (
        candidate.targetId === unit.tactics!.targetId &&
        ((candidate.damage ?? 0) > 0 || (!held && (candidate.setup ?? 0) > 0))
      )
        candidate.focus = (candidate.focus ?? 0) + 0.6;
  }
  // At an easy or a usual table, a party half held helpless or down is not finished off through those
  // held (laptop pass 6 2026-10-26: a Moderate fight's ghoul paralysis and a Hold Person wiped the
  // party, every blow on the held a critical): while one of them still stands free, a blow on the
  // held counts for less than the best blow on the free (half, with none in reach), and is not
  // followed through. A cruel one, and a hard table, still take it.
  // One who heals, its blows next to nothing, does not walk up to throw them (cloud neutral pass
  // 2026-10-26: a Call of Cthulhu Doctor out of First Aid crossed the board 25 times to punch for 1d3 at
  // one in four, into revolver range): it keeps back, and dodges or waits there instead.
  if (actor.actions.some((action) => action.heal)) {
    const kept = candidates.filter(
      (one) => !(one.action.to && (one.damage ?? 0) > 0 && one.damage! < RULESET_FEEBLE_BLOW && !(one.healing ?? 0)),
    );
    if (kept.length < candidates.length) rulesetKeptBack.add(actor.id);
    candidates.splice(0, candidates.length, ...kept);
  }
  const spared = rulesetSparedHelpless(definition, state, encounter, actor);
  if (spared.size > 0) {
    const free = Math.max(
      0,
      ...candidates
        .filter(
          (one) =>
            one.targetId && !spared.has(one.targetId) && rulesetCombatant(encounter, one.targetId)?.side !== actor.side,
        )
        .map((one) => one.damage ?? 0),
    );
    // With none of the free in reach, it goes for the nearest of them where it can walk there rather
    // than strike the held at all; else its blows on the held count half.
    const loose =
      free > 0 || (actor.movementLeft ?? 0) < 1
        ? undefined
        : encounter.combatants
            .filter((one) => one.side === "party" && !one.down && rulesetCombatStanding(one) && !spared.has(one.id))
            .sort((a, b) => rulesetGap(actor, a) - rulesetGap(actor, b))
            .find((one) => !!rulesetClosingMove(definition, encounter, actor.id, undefined, one.id));
    if (loose) {
      const kept = candidates.filter((one) => !(one.targetId && spared.has(one.targetId) && (one.damage ?? 0) > 0));
      candidates.splice(0, candidates.length, ...kept);
      rulesetTowardFree.set(actor.id, loose.id);
    }
    for (const candidate of candidates)
      if (candidate.targetId && spared.has(candidate.targetId) && (candidate.damage ?? 0) > 0)
        candidate.damage = free > 0 ? Math.min(candidate.damage!, free * 0.9) : candidate.damage! * 0.5;
  }
  // What its side has set up is followed through (Alyssa 2026-10-24): a blow at an opponent held open
  // to it, every blow from beside it a critical (a paladin's smites on a held foe) or at advantage,
  // the called-out one first. The dice a critical doubles are counted in the blow itself.
  if (unit.tactics!.mind !== "mindless")
    for (const candidate of candidates) {
      const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
      if (!target || target.side === actor.side || !(candidate.damage ?? 0) || spared.has(target.id)) continue;
      const way = rulesetSetUpWay(definition, encounter, target);
      if (way) candidate.focus = (candidate.focus ?? 0) + (way === "critical" ? 0.25 : 0.1);
    }
  // A territorial one walks nowhere off its ground, but back onto it (combat AI T4).
  const territory = rulesetTerritoryLeash(definition, encounter, actor, unit);
  if (territory) {
    const gap = rulesetGap(actor, territory.charge);
    const kept = candidates.filter((candidate) => {
      const to = candidate.action.to;
      if (!to) return true;
      const after = rulesetGapFrom(to, rulesetSpanOf(actor), territory.charge);
      return after <= territory.within || after < gap;
    });
    candidates.splice(0, candidates.length, ...kept);
  }
  // A budget handed over for this turn (Action Surge) is spent only on a blow it can walk to without
  // leaving whom it keeps near (laptop 2026-10-26: Garrick surged, then had nothing his leash let him
  // strike, and the extra action went on a potion and nothing).
  const leash = (orders ? rulesetLeashOf(state, encounter, actor, orders) : undefined) ?? territory;
  if (leash) {
    const kept = candidates.filter((candidate) => {
      const gives = actor.actions.find(
        (one) => one.id === (candidate.action.option.castOf?.optionId ?? candidate.action.option.id),
      )?.gives;
      return !gives?.length || rulesetGiftStrikes(definition, encounter, actor, gives, leash) > 0;
    });
    candidates.splice(0, candidates.length, ...kept);
  }
  // Everything it had would take it off its leash: nothing to do but get back to its charge.
  if (candidates.length === 0) return null;
  const behavior = unit.tactics!.mind === "mindless" ? undefined : rulesetCombatantBehavior(definition, actor);
  const opening = !menu && !!behavior?.opens && !unit.tactics!.opened && encounter.round <= 2;
  // Whom it goes for, by its own data or else by what it is. Only on its turn: an answer goes where
  // the moment points, and a Counterspell is not taken for liking the look of its caster.
  if (behavior && !menu) weighRulesetBehavior(definition, encounter, actor, behavior, candidates, opening);
  if (!menu && !behavior?.targets?.length)
    weighRulesetMindFocus(definition, encounter, actor, unit.tactics!, candidates);
  if (!menu) weighRulesetPickedUp(definition, encounter, actor, unit.tactics!, candidates);
  if (!menu) weighRulesetReserve(definition, encounter, actor, unit.tactics!, candidates);
  if (!menu) weighRulesetPrepare(definition, encounter, actor, unit.tactics!, candidates);
  if (!menu && unit.tactics!.mind !== "mindless")
    weighRulesetLeadership(definition, state, encounter, actor, candidates);
  // Whom it most wants down, and joining its side's attack on them, are reasons to pick a blow at
  // them, never reasons to spend a limited use at poor odds on them (re-test 2026-10-24: Fast Hands
  // flasks thrown at disadvantage from beside a troll, 14 of 16, carried by the fight being there).
  for (const candidate of candidates)
    if (candidate.action.poorOdds) {
      if ((candidate.focus ?? 0) > 0) candidate.focus = 0;
      if ((candidate.coordination ?? 0) > 0) candidate.coordination = 0;
    }
  // Ammunition with clauses of its own (1.657) is kept for what they reach (2026-10-26): a shot of it
  // counts for a little less than its forecast, so one no better than a plain shot is not taken.
  for (const candidate of candidates) {
    const mode = candidate.action.choice.mode;
    const action = mode ? actor.actions.find((one) => one.id === candidate.action.choice.optionId) : undefined;
    const from = action?.modes?.find((one) => one.id === mode)?.ammoFrom;
    if (from !== undefined && action?.ammo?.riders?.[String(from)] && (candidate.damage ?? 0) > 0)
      candidate.damage = candidate.damage! * RULESET_SPECIAL_SHOT_KEPT;
  }
  return { unit, actor, candidates, orders, behavior, opening };
}

/** What a condition on an opponent opens for the side against it, read off its effects. */
function rulesetSetUpWay(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  target: RulesetCombatant,
): DirectedRulesetCalloutWay | undefined {
  if (!definition.combat || !rulesetCombatStanding(target)) return undefined;
  const effects = rulesetCombatEffects(definition, definition.combat, target, encounter);
  return effects.has("attacks-from-adjacent-critical")
    ? "critical"
    : effects.has("attacks-against-advantage")
      ? "advantage"
      : undefined;
}

/** The set-ups the party's companions put on opponents that still stand, each once: an opponent held
 *  open to its side by something one of them put on it. */
function rulesetCallouts(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
): DirectedRulesetCallout[] {
  const out: DirectedRulesetCallout[] = [];
  for (const target of fight.encounter.combatants) {
    if (target.side === "party" || target.object) continue;
    const way = rulesetSetUpWay(definition, fight.encounter, target);
    if (!way) continue;
    const by = target.tracked
      .map((entry) => (entry.source ? rulesetCombatant(fight.encounter, entry.source) : undefined))
      .find((one) => one?.side === "party" && rulesetController(state, fight, one) === "ai");
    if (by) out.push({ by: by.id, targetId: target.id, way });
  }
  return out;
}

/**
 * A companion the Engine plays says what it has just set up for its side (Alyssa 2026-10-24): an
 * opponent it put something on that opens it, every blow from beside it a critical or advantage
 * against it. Once for each opponent and what it opens, until that is gone again.
 */
function callOutSetUps(definition: RulesetDefinition, fight: RulesetFightState, actorId: string): void {
  const actor = rulesetCombatant(fight.encounter, actorId);
  if (!actor || actor.side !== "party") return;
  const called = new Set(fight.calledOut ?? []);
  const standing = new Set<string>();
  for (const target of fight.encounter.combatants) {
    if (target.side === actor.side || target.object) continue;
    const way = rulesetSetUpWay(definition, fight.encounter, target);
    if (!way) continue;
    const key = `${target.id}:${way}`;
    standing.add(key);
    if (called.has(key) || !target.tracked.some((entry) => entry.source === actorId)) continue;
    called.add(key);
    record(fight, [{ type: "callout", actorId, targetId: target.id, way }]);
  }
  // What is gone may be called out again once it is back.
  fight.calledOut = [...called].filter((key) => standing.has(key));
}

/** Whether a combatant leads its side: its stat block's `leader`, or the story's (E2). */
function rulesetLeads(one: RulesetCombatant): boolean {
  return !!(one.leader || one.block?.leader);
}

/**
 * A leader and its side (combat AI A6): on its first turns a leader opens with what helps several of
 * its side at once (a Leadership, a Bless, a battle cry), and an opponent goes at whoever its own
 * side's leader last went at, as companions told to follow do.
 */
function weighRulesetLeadership(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  // For several of its side at once: more than one target, or a shape, on friends; or a condition
  // on itself whose aura reaches its friends (5e's Leadership, following the knight for a minute).
  const sideWide = (option: RulesetCombatOption) =>
    (option.targets.side === "ally" || option.targets.side === "any") && (option.targets.count >= 2 || !!option.area);
  const leadsFriends = (option: RulesetCombatOption) =>
    !!actor.actions
      .find((action) => action.id === option.id)
      ?.applies?.some((applied) =>
        definition.combat?.conditions
          ?.find((rule) => rule.condition === applied.condition)
          ?.auras?.some((aura) => aura.side === "allies" || aura.side === "all"),
      );
  if (rulesetLeads(actor) && encounter.round <= 2) {
    for (const candidate of candidates) {
      const option = candidate.action.option;
      if (((candidate.support ?? 0) > 0 && sideWide(option)) || leadsFriends(option))
        candidate.focus = (candidate.focus ?? 0) + 1;
    }
    return;
  }
  if (actor.side === "party") return;
  const disciplined =
    [...state.party, ...state.enemies].find((one) => one.id === actor.id)?.tactics?.adjective === "disciplined";
  const leader = encounter.combatants.find(
    (one) => one.side === actor.side && one.id !== actor.id && rulesetLeads(one) && rulesetCombatStanding(one),
  );
  if (!leader) return;
  let marked: string | undefined;
  for (const { event } of [...(fightOf(state)?.events ?? [])].reverse()) {
    const by = "sourceId" in event ? event.sourceId : "actorId" in event ? event.actorId : undefined;
    const at = "targetId" in event ? event.targetId : undefined;
    if (by !== leader.id || typeof at !== "string") continue;
    const target = rulesetCombatant(encounter, at);
    if (target && target.side !== actor.side && rulesetCombatStanding(target)) {
      marked = target.id;
      break;
    }
  }
  if (!marked) return;
  for (const candidate of candidates)
    if (candidate.targetId === marked && ((candidate.damage ?? 0) > 0 || (candidate.setup ?? 0) > 0))
      // A disciplined one carries out its leader's choice (combat AI T1).
      candidate.focus = (candidate.focus ?? 0) + (disciplined ? 0.6 : 0.3);
}

/**
 * Turns the temperament of a creature the Engine plays as its `shifts` say (combat AI T7): the
 * story's, else its own data's. Bloodied below half its health, one of its side or its leader down,
 * or cornered: below a quarter, an opponent beside it and no cell to run to.
 */
function shiftRulesetTemperament(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): { to: string; on: string } | undefined {
  const combat = definition.combat;
  const unit = [...state.party, ...state.enemies].find((one) => one.id === actor.id);
  // One that is down or out has no temper left to turn (playtest: "is out of the fight", then "is
  // cornered and turns reckless").
  if (!combat || !unit?.tactics || !rulesetCombatStanding(actor)) return undefined;
  const shifts = unit.aiHints?.shifts ?? rulesetCombatantBehavior(definition, actor)?.shifts;
  const health = rulesetCombatHealth(definition, combat, actor);
  const ours = encounter.combatants.filter(
    (one) => one.side === actor.side && one.id !== actor.id && one.calledBy === undefined && !one.object,
  );
  const fallen = ours.filter(
    (one) => one.down || (one.defeated && (!one.away || !!one.away.left || !!one.away.surrendered)),
  );
  const happened = (trigger: string): boolean =>
    trigger === "bloodied"
      ? health.value < health.max / 2
      : trigger === "ally-down"
        ? fallen.length > 0
        : trigger === "leader-down"
          ? fallen.some(rulesetLeads)
          : health.value < health.max / 4 &&
            encounter.combatants.some(
              (one) =>
                one.side !== actor.side &&
                rulesetCombatStanding(one) &&
                !!rulesetPositionOf(one) &&
                !!rulesetPositionOf(actor) &&
                rulesetGap(one, actor) <= 1,
            ) &&
            !rulesetRetreatCell(definition, encounter, actor.id);
  // What turned it, for the log (re-test 14): the first of its shifts that has happened.
  let on: string | undefined;
  const turned = shiftCombatTemperament(unit.tactics, shifts, (trigger) => {
    const now = happened(trigger);
    if (now) on ??= trigger;
    return now;
  });
  if (!turned) return undefined;
  actor.temperament = turned;
  return { to: turned, on: on! };
}

/**
 * Its side rallied (combat AI A6): as a leader the Engine plays starts its turn, each of its side
 * running from the fight within six squares of it (thirty feet in 5e) stops, and checks its nerve
 * again as its own next turn starts, on what broke it. Only in a ruleset with `combat.morale`.
 */
function rallyRulesetSide(definition: RulesetDefinition, encounter: RulesetEncounterState, leader: RulesetCombatant) {
  if (!definition.combat?.morale || !rulesetLeads(leader) || !rulesetCombatStanding(leader)) return;
  if (!rulesetPositionOf(leader)) return;
  for (const one of encounter.combatants) {
    if (one.side !== leader.side || one.id === leader.id || !one.routed || !rulesetCombatStanding(one)) continue;
    if (!rulesetPositionOf(one) || rulesetGap(leader, one) > 6) continue;
    delete one.routed;
    one.moraleChecked = (one.moraleChecked ?? []).slice(0, -1);
  }
}

/**
 * A companion's standing orders (P7): its player's, else its default, guarding the leader. None for
 * anybody else. Its best is kept for when it matters by its price alone, dearer the fewer it has
 * left: told to conserve by default as well, a companion let every smite, stun and blessing go by
 * (class pass 2026-10-24), so conserving is its player's order to give.
 */
function rulesetOrdersFor(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  unit: { orders?: CombatOrders },
): CombatOrders | undefined {
  if (actor.side !== "party") return rulesetBodyguardOrders(definition, encounter, actor);
  if (unit.orders) return unit.orders;
  return { posture: "guard" };
}

/**
 * Whom a bodyguard (a `behavior.guards`, combat AI A5, 1.777) stands up for: the nearest friend still
 * standing of the kinds it names (its side's leader, a caster, one who heals others), as a companion
 * told to protect them: a standing order, so a mindless one (a Shield Guardian, a zombie) keeps it
 * too. None once nobody of those kinds is left.
 */
function rulesetBodyguardOrders(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): CombatOrders | undefined {
  const guards = rulesetCombatantBehavior(definition, actor)?.guards;
  if (!guards || !rulesetPositionOf(actor)) return undefined;
  const actions = (one: RulesetCombatant) => one.actions.filter((action) => !action.whileHolds);
  const kept = (one: RulesetCombatant) =>
    guards.some((kind) =>
      kind === "leader"
        ? !!(one.leader || one.block?.leader)
        : kind === "casters"
          ? actions(one).some(rulesetActionIsSpell)
          : actions(one).some((action) => action.heal && action.targets.side !== "self"),
    );
  const charges = encounter.combatants.filter(
    (one) =>
      one.side === actor.side &&
      one.id !== actor.id &&
      !one.object &&
      rulesetCombatStanding(one) &&
      !!rulesetPositionOf(one) &&
      kept(one),
  );
  if (charges.length === 0) return undefined;
  const charge = charges.reduce((best, one) => (rulesetGap(actor, one) < rulesetGap(actor, best) ? one : best));
  return { posture: "protect", protectId: charge.id };
}

/** The chance a concentration save forced by this much damage fails, on a d20 against the ruleset's
 *  difficulty: one for a ruleset with no such save, where any harm breaks it. */
function rulesetConcentrationFails(
  combat: NonNullable<RulesetDefinition["combat"]>,
  target: RulesetCombatant,
  damage: number,
): number {
  const concentration = combat.concentration;
  if (!concentration) return 1;
  const difficulty = Math.max(concentration.floor, Math.floor(damage * concentration.fromDamage));
  const modifier = target.saves[concentration.save] ?? 0;
  return Math.min(1, Math.max(0, (difficulty - 1 - modifier) / 20));
}

/** How far a companion guarding or protecting somebody strays from them (P7), in squares. */
const RULESET_LEASH = 3;

/** How far it strays under its orders: three squares from whoever it guards or protects, but beside
 *  the leader it follows until they strike (re-test 2026-10-23: a rogue on follow walked up beside
 *  the leader, then Dashed three squares on into the orcs before the leader had struck anyone). */
function rulesetLeashWithin(orders: CombatOrders): number {
  return orders.posture === "follow" ? 1 : RULESET_LEASH;
}

/** Whether an actor could shoot somebody of the other side from where it stands: one in range of a
 *  ranged blow it has and in its sight. Out of sight, staying put is a turn thrown away (re-test
 *  2026-10-23: a wizard stood three turns behind a wall while her friends bled out). */
function rulesetHasShot(definition: RulesetDefinition, encounter: RulesetEncounterState, actorId: string): boolean {
  const actor = rulesetCombatant(encounter, actorId);
  if (!actor || !rulesetPositionOf(actor)) return false;
  const reach = Math.max(
    0,
    ...actor.actions
      .filter(
        (one) => one.range && !one.reach && one.damage && rulesetActionAvailable(actor, one, encounter, definition),
      )
      .map((one) => one.range!.long ?? one.range!.normal),
  );
  if (reach <= 1) return false;
  return encounter.combatants.some(
    (foe) =>
      foe.side !== actor.side &&
      rulesetCombatStanding(foe) &&
      !!rulesetPositionOf(foe) &&
      rulesetGap(actor, foe) <= reach &&
      rulesetSees(encounter, actor, foe),
  );
}

/** The roles that fight from afar, and so never walk in once somebody is already in their range. */
const RULESET_KEEPS_RANGE = new Set(["spellcaster", "marksman", "controller", "supporter"]);
interface RulesetLeash {
  charge: RulesetCombatant;
  within: number;
}

/** Whether it keeps its ground (combat AI T4): territorial, or a mindless one whose data says so, as
 *  a golem set to guard a place by its maker keeps to it with no temperament of its own. */
function rulesetTerritorial(definition: RulesetDefinition, actor: RulesetCombatant, tactics: CombatTactics): boolean {
  if (tactics.adjective === "territorial") return true;
  return tactics.mind === "mindless" && rulesetCombatantBehavior(definition, actor)?.temperament === "territorial";
}

/**
 * The ground a territorial one keeps (combat AI T4): within its `behavior.territory` squares (6
 * unless it says) of where it began, as a leash on that spot. None once whoever last hurt it stands
 * off that ground, struck from afar: then it goes after them.
 */
function rulesetTerritoryLeash(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  unit: Combatant,
): RulesetLeash | undefined {
  const home = unit.tactics?.home;
  if (!home || !rulesetTerritorial(definition, actor, unit.tactics!)) return undefined;
  const within = rulesetCombatantBehavior(definition, actor)?.territory ?? 6;
  const charge = { ...actor, x: home.x, y: home.y } as RulesetCombatant;
  const harm = actor.harmedBy ? rulesetCombatant(encounter, actor.harmedBy) : undefined;
  if (
    harm &&
    harm.side !== actor.side &&
    rulesetCombatStanding(harm) &&
    rulesetPositionOf(harm) &&
    rulesetGap(harm, charge) > within
  )
    return undefined;
  return { charge, within };
}

/** Whom a companion's orders keep it near (P7): the leader it guards or the friend it protects,
 *  standing and somebody else. None for any other orders. */
function rulesetLeashOf(
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  orders: CombatOrders,
): RulesetLeash | undefined {
  const charge = rulesetChargeOf(state, encounter, actor, orders);
  return charge && charge.id !== actor.id && rulesetCombatStanding(charge) && rulesetPositionOf(charge)
    ? { charge, within: rulesetLeashWithin(orders) }
    : undefined;
}

/**
 * Whom a guarding companion stays near (playtest re-test 9): the leader while nobody is fighting or
 * the leader is, else the nearest friend with an opponent beside them, so a guard whose leader hangs
 * back goes to the friend fighting alone instead of standing idle at the leader's side.
 */
/** Whom a companion's orders keep it beside: the friend it protects, the one it guards, and the leader
 *  it follows until the leader has gone at somebody (re-test 2026-10-23: a rogue on follow dashed ten
 *  squares into three orcs before the leader had struck anyone). */
function rulesetChargeOf(
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  orders: CombatOrders,
): RulesetCombatant | undefined {
  if (orders.posture === "protect") return rulesetCombatant(encounter, orders.protectId!);
  if (orders.posture === "guard") return rulesetGuardCharge(state, encounter, actor);
  if (orders.posture === "follow" && !rulesetFollowedTarget(state, encounter, actor))
    return rulesetPartyLeader(state, encounter);
  return undefined;
}

/** Whoever the party's leader went at last, still standing, for a companion that follows them. */
function rulesetFollowedTarget(
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): string | undefined {
  const leader = rulesetPartyLeader(state, encounter);
  if (!leader || leader.id === actor.id) return undefined;
  for (const { event } of [...(fightOf(state)?.events ?? [])].reverse()) {
    const by = "sourceId" in event ? event.sourceId : "actorId" in event ? event.actorId : undefined;
    const at = "targetId" in event ? event.targetId : undefined;
    if (by !== leader.id || typeof at !== "string") continue;
    const target = rulesetCombatant(encounter, at);
    if (target && target.side !== actor.side && rulesetCombatStanding(target)) return target.id;
  }
  return undefined;
}

function rulesetGuardCharge(
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatant | undefined {
  const leader = rulesetPartyLeader(state, encounter);
  const engaged = (one: RulesetCombatant) =>
    !!rulesetPositionOf(one) &&
    encounter.combatants.some(
      (foe) =>
        foe.side !== one.side &&
        !foe.object &&
        rulesetCombatStanding(foe) &&
        !!rulesetPositionOf(foe) &&
        rulesetGap(one, foe) <= 1,
    );
  if (!leader || leader.id === actor.id || engaged(leader) || !rulesetPositionOf(actor)) return leader;
  const fighting = encounter.combatants.filter(
    (one) => one.side === actor.side && one.id !== actor.id && rulesetCombatStanding(one) && engaged(one),
  );
  if (!fighting.length) return leader;
  return fighting.reduce((best, one) => (rulesetGap(actor, one) < rulesetGap(actor, best) ? one : best));
}

/** The party's leader: the first of it its player plays and still standing, else the first standing. */
function rulesetPartyLeader(
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
): RulesetCombatant | undefined {
  const fight = fightOf(state);
  const standing = encounter.combatants.filter((one) => one.side === "party" && rulesetCombatStanding(one));
  return (fight ? standing.find((one) => rulesetController(state, fight, one) === "manual") : undefined) ?? standing[0];
}

/**
 * What a companion's orders say it goes for (P7), onto each candidate: whoever the leader is
 * attacking (`follow`), an opponent beside the one it guards or protects, and help for that one
 * (fighting on its own, `free`, it has no charge and no leash and picks as an opponent does);
 * never finishing anybody with a blow that would kill rather than knock out (`spare`); and nowhere
 * to walk to while it holds its ground. The weights its orders change are `chooseCombatCandidate`'s.
 */
function weighRulesetOrders(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  orders: CombatOrders,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  const charge = rulesetChargeOf(state, encounter, actor, orders);
  const guarded = charge && charge.id !== actor.id && rulesetCombatStanding(charge) ? charge : undefined;
  const strength = orders.posture === "protect" ? 1 : 0.3;
  // Whoever is on the one it protects comes before whoever is on itself (re-test 2026-10-23: a rogue
  // protecting the wizard stabbed the orc beside him while an ogre clubbed her from 27 to 5).
  const pressing =
    orders.posture === "protect" && guarded
      ? encounter.combatants.some(
          (foe) =>
            foe.side !== actor.side &&
            rulesetCombatStanding(foe) &&
            !!rulesetPositionOf(foe) &&
            !!rulesetPositionOf(guarded) &&
            rulesetGap(foe, guarded) <= 1,
        )
      : false;
  const near = (a: RulesetCombatant, b: RulesetCombatant) =>
    !!rulesetPositionOf(a) && !!rulesetPositionOf(b) && rulesetGap(a, b) <= 1;
  // Whoever the leader went at last, still standing.
  const followed = orders.posture === "follow" ? rulesetFollowedTarget(state, encounter, actor) : undefined;
  // Guarding or protecting somebody keeps it on a leash: nothing is worth walking more than three
  // squares from them for, so it never runs off across the board after the first foe it sees. With
  // nothing left, its turn walks back toward them (see `walkTowardsTrouble`).
  if (guarded) {
    const gap = rulesetGap(actor, guarded);
    // Already off it, it does nothing where it stands but harm or help: no hiding, dodging, readying
    // or waiting out there, so its turn goes to walking back.
    const within = rulesetLeashWithin(orders);
    const strayed = gap > within;
    const kept = candidates.filter((candidate) => {
      const to = candidate.action.to;
      if (to) {
        // A walk to strike ends on the leash: off it, closer than before is still running off after
        // a foe (re-test 14, a cultist eight squares out walking to six to stab a rogue). It walks
        // back instead.
        const after = rulesetGapFrom(to, rulesetSpanOf(actor), guarded);
        return after <= within;
      }
      return (
        !strayed ||
        (candidate.damage ?? 0) > 0 ||
        (candidate.healing ?? 0) > 0 ||
        (candidate.support ?? 0) > 0 ||
        // Setting somebody up, not merely itself (a Ready or a Dash on the spot).
        ((candidate.setup ?? 0) > 0 && !!candidate.targetId)
      );
    });
    candidates.splice(0, candidates.length, ...kept);
  }
  for (const candidate of candidates) {
    const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
    const harms = !!target && target.side !== actor.side && ((candidate.damage ?? 0) > 0 || (candidate.setup ?? 0) > 0);
    let focus = 0;
    if (harms && target!.id === followed) focus += 0.6;
    if (harms && guarded && near(target!, guarded)) focus += strength;
    else if (harms && pressing) focus -= 0.5;
    if (
      !harms &&
      guarded &&
      target?.id === guarded.id &&
      ((candidate.healing ?? 0) > 0 || (candidate.support ?? 0) > 0)
    )
      focus += strength * 0.7;
    if (focus !== 0) candidate.focus = (candidate.focus ?? 0) + focus;
  }
  // Retreating is getting away (re-test 2026-10-23: a wizard on retreat Dodged in a corner five turns
  // of seven, an ogre beside her, Misty Step in hand): with an opponent beside it, a getaway or a
  // step through space comes first; with none near, it keeps helping from afar as `back` does rather
  // than dodging nobody.
  if (orders.posture === "retreat") {
    const pressed = encounter.combatants.some(
      (foe) =>
        foe.side !== actor.side &&
        rulesetCombatStanding(foe) &&
        !!rulesetPositionOf(foe) &&
        !!rulesetPositionOf(actor) &&
        rulesetGap(foe, actor) <= 1,
    );
    for (const candidate of candidates) {
      const defensive = rulesetDefensiveName(candidate.action.option);
      const action = actor.actions.find((one) => one.id === candidate.action.option.id);
      const away = defensive === "disengage" || (!!action?.teleport && candidate.action.option.targets.side === "self");
      if (pressed && away) candidate.focus = (candidate.focus ?? 0) + 1;
      if (!pressed && defensive === "dodge") {
        candidate.hold = false;
        candidate.focus = (candidate.focus ?? 0) - 0.5;
      }
    }
  }
  // A blow, a spell, an area or an aura that would kill (re-test 2026-10-23: a Fire Bolt, a Fireball
  // and Spirit Guardians all killed under spare): only one in melee by somebody pulling their blows
  // knocks out instead. Any of the rest is never taken while something that kills nobody is there: a
  // knockout, a healthier target, a hold or a Dodge. With nothing else, it is worth no harm.
  // The last of its side still up gives way (cloud AI fights 2026-10-25: a sparing Professor, the
  // last investigator standing, stood ten rounds while a Cultist shot him dead).
  const lastUp = !encounter.combatants.some(
    (one) => one.id !== actor.id && one.side === actor.side && rulesetCombatStanding(one),
  );
  if (orders.spare && lastUp)
    for (const candidate of candidates)
      if ((candidate.finish ?? 0) > 0 || candidate.action.drops?.length)
        candidate.action = { ...candidate.action, spareYields: true };
  if (orders.spare && !lastUp) {
    const kills = (candidate: CombatAiCandidate<RulesetCandidate>) => {
      const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
      const harms =
        !!target && target.side !== actor.side && ((candidate.damage ?? 0) > 0 || (candidate.setup ?? 0) > 0);
      if (!(harms && (candidate.finish ?? 0) > 0) && !candidate.action.drops?.length) return false;
      const action = actor.actions.find((one) => one.id === candidate.action.option.id);
      const knocksOut =
        !!actor.knocksOut &&
        !action?.range &&
        !action?.area &&
        !action?.around &&
        (candidate.action.drops?.length ?? 1) <= 1;
      return !knocksOut;
    };
    const kind = candidates.filter((candidate) => !kills(candidate));
    if (kind.length > 0 && kind.length < candidates.length) {
      // Its turn ended with a blow that would kill left out says so (cloud re-test 2026-10-25: a
      // sparing Professor's plain end of turn read "nothing worth the price").
      for (const candidate of kind)
        if (candidate.action.option.kind === "end-turn") candidate.action = { ...candidate.action, spares: true };
      candidates.splice(0, candidates.length, ...kind);
    } else if (kind.length === 0) {
      // Everything it could do kills: it ends its turn rather than finish anybody off.
      const end = rulesetCombatOptions(definition, encounter, actor.id).find((option) => option.kind === "end-turn");
      if (end)
        candidates.splice(0, candidates.length, {
          action: { choice: { actorId: actor.id, optionId: end.id, targetIds: [] }, option: end, spares: true },
          hold: true,
        });
      else
        for (const candidate of candidates) {
          candidate.damage = 0;
          candidate.finish = 0;
        }
    }
  }
}

/** How far above its average a blow's dice can roll: its most over its average, 1 for a blow of no
 *  dice (or one the forecast reads some other way). */
function rulesetDamageCeiling(damage: RulesetCombatAction["damage"] | undefined): number {
  if (!damage || !("sides" in damage)) return 1;
  const average = rulesetAverageDamage(damage);
  if (average <= 0) return 1;
  const most =
    damage.count * damage.sides +
    damage.flat +
    (damage.plus ?? [])
      .filter((one) => !one.targetIs && !one.onCritical && one.whileOn === undefined)
      .reduce((sum, one) => sum + one.count * one.sides + one.flat, 0);
  return Math.max(1, most / average);
}

/** What a limited use (a flask, a slot, a use a day) aimed at worse than even odds is worth of what
 *  it would be at even odds: below even, its chance counts twice over, the candidate is marked so
 *  whom its side wants down adds nothing to it, and keeping the use for a fair throw costs it the
 *  more the poorer the odds (re-test 2026-10-24: flasks thrown at disadvantage beside a troll). */
function rulesetFairOdds(
  candidate: CombatAiCandidate<RulesetCandidate>,
  price: number,
  action: RulesetCombatAction | undefined,
  chance: number,
): number {
  const limited = price > 0 || !!action?.uses || !!action?.itemUse;
  const odds = limited && chance < 0.5 ? chance / 0.5 : 1;
  if (odds < 1) {
    candidate.action.poorOdds = true;
    candidate.cost = (candidate.cost ?? 0) + 0.25 * (1 - odds);
  }
  return odds;
}

/** The most a blow's harm comes to in a `dice-pool` fight: each of its dice a success, its flat part
 *  as the automatic successes it is, and its clauses dealt to anyone the same way. */
function rulesetPoolDamageMost(damage: RulesetCombatAction["damage"] | undefined): number {
  if (!damage || !("sides" in damage)) return 0;
  return (
    damage.count +
    damage.flat +
    (damage.plus ?? [])
      .filter((one) => !one.targetIs && !one.onCritical && one.whileOn === undefined)
      .reduce((sum, one) => sum + one.count + one.flat, 0)
  );
}

/** Help worth less than this is not worth a turn: an ability check's die in a fight. */
const RULESET_TRIFLING_HELP = 0.05;
/** A blow worth less than this is not walked up to by one who heals: a punch for a few points at long
 *  odds. */
const RULESET_FEEBLE_BLOW = 0.1;
/** Who, on the pick just made, left a feeble blow it would have walked up for: it stays where it is
 *  rather than walking towards the fight. Read and cleared around each pick of a turn. */
const rulesetKeptBack = new Set<string>();
/** Who, on the pick just made, left the held for one of the party still free (laptop interim
 *  2026-10-26), and whom: it walks there. Read and cleared around each pick of a turn. */
const rulesetTowardFree = new Map<string, string>();

/** One who heals with no heal it can give now that anybody needs, whose every blow is feeble against
 *  every foe (cloud neutral pass 2026-10-26: a Doctor out of First Aid walking across the board to
 *  punch): it keeps back rather than walking towards the fight. */
function rulesetFeebleHealer(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  const combat = definition.combat;
  if (!combat || !actor.actions.some((action) => action.heal)) return false;
  const needed = encounter.combatants.some((one) => {
    if (one.side !== actor.side || one.defeated) return false;
    const health = rulesetCombatHealth(definition, combat, one);
    return one.down || health.value < health.max;
  });
  if (needed && rulesetCombatOptions(definition, encounter, actor.id).some((option) => option.heals)) return false;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && !one.defeated && !one.down);
  for (const action of actor.actions) {
    if (!action.damage || action.heal) continue;
    const forecasts = rulesetForecastsByTarget(
      definition,
      encounter,
      actor.id,
      action.id,
      foes.map((one) => one.id),
    );
    for (const foe of foes) {
      const forecast = forecasts[foe.id];
      if (!forecast?.averageDamage) continue;
      const health = rulesetCombatHealth(definition, combat, foe);
      const worth = (forecast.averageDamage / Math.max(1, health.value + health.temp)) * (forecast.hitChance ?? 1);
      if (worth >= RULESET_FEEBLE_BLOW) return false;
    }
  }
  return true;
}

/** What letting go of the spell an actor holds up costs it: what holding it does, up to 0.4 for one
 *  that harms (a zone, a blow held up) or whose worth cannot be read. */
/** How many rounds ahead what a summons held up would still do is counted when letting it go. */
const RULESET_HELD_ROUNDS = 3;

/** The foes still standing that carry what the spell its holder holds up put on them. */
function rulesetHeldFoes(encounter: RulesetEncounterState, actor: RulesetCombatant): RulesetCombatant[] {
  const held = actor.concentrating;
  if (!held) return [];
  return encounter.combatants.filter(
    (one) =>
      one.side !== actor.side &&
      rulesetCombatStanding(one) &&
      one.tracked.some(
        (entry) => entry.source === actor.id && entry.concentration && entry.action?.includes(held.actionId),
      ),
  );
}

/** Those on its own side, itself among them, still standing and carrying what its held spell put on
 *  them. */
function rulesetHeldFriends(encounter: RulesetEncounterState, actor: RulesetCombatant): RulesetCombatant[] {
  const held = actor.concentrating;
  if (!held) return [];
  return encounter.combatants.filter(
    (one) =>
      one.side === actor.side &&
      rulesetCombatStanding(one) &&
      one.tracked.some(
        (entry) => entry.source === actor.id && entry.concentration && entry.action?.includes(held.actionId),
      ),
  );
}

function rulesetHeldWorth(
  definition: RulesetDefinition,
  combat: NonNullable<RulesetDefinition["combat"]>,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): number {
  const held = actor.concentrating;
  if (!held) return 0;
  // Creatures it holds here, by the harm they still bring (class re-test 2026-10-24).
  const called = encounter.combatants.filter(
    (one) => one.calledBy === actor.id && one.calledWith === held.actionId && !one.dismissed && !one.defeated,
  );
  if (called.length > 0) {
    const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
    if (foes.length === 0) return 0;
    const foeMean = rulesetSideHealthMean(definition, combat, encounter, foes[0]!.side);
    const harm = called.reduce((sum, one) => sum + rulesetEveryTurnBlow(one) * 0.6, 0);
    // A round's harm for each of the next few rounds they would go on fighting (cloud AI fights
    // 2026-10-25: five Draft Horses sent away for a Hold Person on the Assassin, who saved).
    return RULESET_HELD_ROUNDS * 2 * (1 - Math.exp(-harm / Math.max(1, foeMean)));
  }
  const action = actor.actions.find((one) => one.id === held.actionId);
  // A lasting area of its own that harms, by the harm it does each round to those it catches now
  // (laptop playtest 2026-10-24: Spirit Guardians around three goblins let go for a Bless), as a
  // summons is; never less than the 0.4 it was, since those not in it yet may walk in.
  const zones = (actor.zones ?? []).filter((zone) => zone.actionId === held.actionId);
  if (action?.damage && zones.length > 0) {
    const foes = encounter.combatants.filter(
      (one) => one.side !== actor.side && rulesetCombatStanding(one) && !!rulesetPositionOf(one),
    );
    if (foes.length === 0) return 0;
    let harm = 0;
    // One its holder may move onto a foe (Moonbeam) still harms the one it can be moved onto, though
    // nobody stands in it now (laptop playtest 2026-10-25: Wren let her Moonbeam go in round 2 to
    // cast Conjure Animals, both 3rd-level slots gone).
    const perCell = combat.distance?.perCell;
    const moves = action.zone?.move;
    let movable = 0;
    for (const zone of zones) {
      const cells = new Set(rulesetZoneCells(encounter, actor, zone).map((cell) => `${cell.x},${cell.y}`));
      for (const foe of foes) {
        const inside = rulesetFootprint(foe).some((cell) => cells.has(`${cell.x},${cell.y}`));
        if (inside && rulesetZoneCatches(actor, zone, action, foe)) harm += rulesetSafeAverage(action.damage);
        else if (
          moves &&
          zone.at &&
          perCell &&
          rulesetZoneCatches(actor, zone, action, foe) &&
          rulesetDistanceTo(zone.at, foe) <= rulesetInCells(moves.distance, perCell)
        )
          movable = rulesetSafeAverage(action.damage) * 0.7;
      }
    }
    harm = Math.max(harm, movable);
    const foeMean = rulesetSideHealthMean(definition, combat, encounter, foes[0]!.side);
    return Math.max(0.4, 2 * (1 - Math.exp(-harm / Math.max(1, foeMean))));
  }
  if (!action || action.damage || action.zone || action.heal) return 0.4;
  // Whom it holds now: whoever carries what it put on them, else whom a repeat was aimed at, else
  // its caster. A held spell keeps no list of its targets unless it repeats, so a Hold Person on the
  // boss read as one on the caster herself, let go to hold a bandit (cloud AI fights 2026-10-25).
  const holding = encounter.combatants
    .filter((one) =>
      one.tracked.some(
        (entry) => entry.source === actor.id && entry.concentration && entry.action?.includes(held.actionId),
      ),
    )
    .map((one) => one.id);
  const on = (holding.length > 0 ? holding : (held.targets ?? [actor.id]))
    .map((id) => rulesetCombatant(encounter, id))
    .filter((one): one is RulesetCombatant => !!one && rulesetCombatStanding(one));
  if (on.length === 0) return 0;
  // Read as though not yet put on them, so what they hold counts.
  const puts = new Set((action.applies ?? []).map((applied) => applied.condition));
  const worthOn = (list: RulesetCombatant[]) =>
    list.reduce((sum, one) => {
      const bare: RulesetCombatant = { ...one, tracked: one.tracked.filter((entry) => !puts.has(entry.condition)) };
      return sum + (rulesetEffectWorth(definition, combat, encounter, actor, action, bare) ?? 0.4);
    }, 0);
  // Help on its own side is worth little to keep (Shield of Faith is no reason to keep Spirit
  // Guardians in the book); foes it holds are worth all they would do freed (laptop 2026-10-25: a
  // Hypnotic Pattern on two wolves let go to hold the duelist alone).
  const foes = on.filter((one) => one.side !== actor.side);
  const friends = on.filter((one) => one.side === actor.side);
  return worthOn(foes) + (friends.length > 0 ? Math.min(0.4, worthOn(friends)) : 0);
}

/** What getting a friend back on their feet is worth over anything else it could do. */
const RULESET_DOWNED_FOCUS = 2;

/**
 * A friend down and dying comes first (re-test 2026-10-23: a cleric with Healing Word in hand cast
 * Sacred Flame and swung Spiritual Weapon while the wizard failed a death save): whatever heals one
 * is all it does while it can, whatever its orders (round 2: under no orders, Bless and then Spirit
 * Guardians outranked lifting a rogue three death saves from dying).
 */
function weighRulesetDowned(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  let raises = candidates.filter((candidate) => {
    if ((candidate.healing ?? 0) <= 0) return false;
    const ids = candidate.targetId ? [candidate.targetId] : candidate.action.choice.targetIds;
    return ids.some((id) => {
      const one = rulesetCombatant(encounter, id);
      return !!one && one.side === actor.side && one.down && !one.defeated;
    });
  });
  // A treatment that hangs on a check (first aid) is weighed as its chance of working, and against the
  // blow it gives up (laptop 2026-10-26: Garrick walked 15 ft to steady a dying friend at 9 against DC
  // 10, failed, and ended beside the Archlich with no action left, where his walk would have reached it
  // to strike): with a blow on an opponent in reach, it comes first only when it is likely to work, and
  // not at all while a friend still standing could heal them with a heal of their own.
  const blows = candidates.filter((candidate) => {
    const foe = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : undefined;
    return !!foe && foe.side !== actor.side && !foe.down && (candidate.damage ?? 0) > 0;
  });
  if (blows.length > 0 && raises.length > 0 && raises.every((one) => rulesetChecksOnDowned(encounter, one))) {
    const bosses = new Set(fightOf(state)?.bosses ?? []);
    const healer = encounter.combatants.some(
      (one) =>
        one.id !== actor.id && one.side === actor.side && !one.down && rulesetFreeHealer(definition, encounter, one),
    );
    // Its odds against the DC, which the treatment's healing already is; a blow on a boss raises the bar.
    const bar = blows.some((one) => bosses.has(one.targetId!)) ? RULESET_AID_OVER_BOSS : RULESET_AID_OVER_BLOW;
    const likely = healer ? [] : raises.filter((one) => (one.healing ?? 0) >= bar);
    if (likely.length === 0) {
      const dropped = new Set(raises);
      candidates.splice(0, candidates.length, ...candidates.filter((one) => !dropped.has(one)));
      return;
    }
    raises = likely;
  }
  if (raises.length === 0) return;
  for (const candidate of raises) candidate.focus = (candidate.focus ?? 0) + RULESET_DOWNED_FOCUS;
  candidates.splice(0, candidates.length, ...raises);
}

/** Whether a pick treats a friend who is down with a check that may fail (first aid), rather than a
 *  heal that lifts them: its healing is its chance of working. */
function rulesetChecksOnDowned(
  encounter: RulesetEncounterState,
  candidate: CombatAiCandidate<RulesetCandidate>,
): boolean {
  if (candidate.action.option.kind !== "contest" || !candidate.targetId || !((candidate.healing ?? 0) > 0))
    return false;
  const actor = rulesetCombatant(encounter, candidate.action.choice.actorId);
  const target = rulesetCombatant(encounter, candidate.targetId);
  return !!actor && !!target && target.side === actor.side && target.down && !target.defeated;
}

/** How likely a treatment that hangs on a check must be to work to come before a blow in reach, and
 *  before a blow on a boss (laptop 2026-10-26). */
const RULESET_AID_OVER_BLOW = 0.6;
const RULESET_AID_OVER_BOSS = 0.75;

/** What harming an opponent who drops areas on its side is worth over anything else it could do,
 *  once one has landed; half that for one who only holds one. */
const RULESET_BLASTER_FOCUS = 0.8;

/**
 * A companion goes after whoever is dropping areas on its side (re-test round 2: a cult mage threw a
 * Fireball into the party every round and ended both fights untouched, while the wizard and the
 * cleric shot its cultists): a blow, a hold or an area that catches them comes first. Read from the
 * areas that landed this fight and from what each opponent still holds that harms an area.
 */
function weighRulesetBlasters(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  const landed = new Set<string>();
  for (const { event } of fightOf(state)?.events ?? []) if (event.type === "area") landed.add(event.actorId);
  const blasters = new Map<string, number>();
  for (const foe of encounter.combatants) {
    if (foe.side === actor.side || !rulesetCombatStanding(foe)) continue;
    const holds = foe.actions.some(
      (action) =>
        !!(action.area || action.zone) && !!action.damage && rulesetActionAvailable(foe, action, encounter, definition),
    );
    if (landed.has(foe.id) && holds) blasters.set(foe.id, RULESET_BLASTER_FOCUS);
    else if (holds) blasters.set(foe.id, RULESET_BLASTER_FOCUS / 2);
  }
  if (blasters.size === 0) return;
  for (const candidate of candidates) {
    if ((candidate.damage ?? 0) <= 0 && (candidate.setup ?? 0) <= 0) continue;
    const { choice, option } = candidate.action;
    const caught = choice.at ? rulesetAreaTargets(encounter, actor.id, option.id, choice.at) : [];
    const ids = new Set([...(candidate.targetId ? [candidate.targetId] : []), ...choice.targetIds, ...caught]);
    const by = Math.max(0, ...[...ids].map((id) => blasters.get(id) ?? 0));
    if (by > 0) candidate.focus = (candidate.focus ?? 0) + by;
  }
}

/** Whether a pick is the action or spell an `opens` names: its own id, or the catalog entry it was
 *  made from (`fireball`, or `spells/fireball`). */
function rulesetOpensWith(actor: RulesetCombatant, candidate: RulesetCandidate, id: string): boolean {
  if (candidate.option.id === id) return true;
  const entry = actor.actions.find((action) => action.id === candidate.option.id)?.entry;
  return entry !== undefined && (entry === id || entry.endsWith(`/${id}`));
}

/** What a tactician keeps back for an answer (combat AI P8): the price of a turn that would spend
 *  what its last Counterspell or Shield needs. */
const RULESET_RESERVE_PRICE = 0.3;

/**
 * A tactician or a genius keeps what its answers need (combat AI P8): a turn that would spend the last
 * slot, use or pool a reaction it holds could still be paid from costs that much more, so a mage casts
 * its cantrip and keeps the 3rd-level slot for the Counterspell unless the spell is worth giving it
 * up. Nothing to keep when no answer can be paid now.
 */
function weighRulesetReserve(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  if (tactics.mind !== "tactical" && tactics.mind !== "genius") return;
  const answers = actor.actions.filter((action) => action.reaction && !action.innate?.coven);
  if (answers.length === 0) return;
  const pools = actor.sheet
    ? readRulesetLive(definition, actor.sheet.build, actor.sheet.live, actor.sheet.items).pools.map((pool) => pool.key)
    : [];
  // Whether one of its answers can be paid by this holder, as its slots, uses and sheet stand.
  const answerable = (holder: RulesetCombatant) =>
    answers.some((answer) => {
      if (answer.innate?.slot) return rulesetInnateSlot(holder, answer, encounter) !== undefined;
      if (answer.uses && rulesetActionUses(holder, answer, encounter) < 1) return false;
      if (!answer.use || !holder.sheet) return !!answer.uses;
      return [undefined, ...pools].some((pool) => planRulesetCombatCost(definition, holder, answer, pool) !== null);
    });
  if (!answerable(actor)) return;
  const spent = new Map<string, boolean>();
  for (const candidate of candidates) {
    const action = actor.actions.find((one) => one.id === candidate.action.option.id);
    if (!action || action.reaction) continue;
    const payWith = candidate.action.choice.payWith;
    const key = `${action.id}\u0000${payWith ?? ""}`;
    let drains = spent.get(key);
    if (drains === undefined) {
      // The holder as this would leave it: a slot, a use or the pool it is paid from spent.
      const after: RulesetCombatant = { ...actor, uses: { ...actor.uses } };
      const slot = action.innate?.slot ? rulesetInnateSlot(actor, action, encounter) : undefined;
      if (slot !== undefined) after.uses[`slot:${slot}`] = rulesetInnateSlotsLeft(actor, action, slot, encounter) - 1;
      if (action.uses) after.uses[rulesetUsesKey(action)] = rulesetActionUses(actor, action, encounter) - 1;
      if (action.use && actor.sheet) {
        const paid = planRulesetCombatCost(definition, actor, action, payWith);
        if (paid?.live) after.sheet = { ...actor.sheet, live: paid.live };
      }
      drains = !answerable(after);
      spent.set(key, drains);
    }
    if (drains) candidate.cost = (candidate.cost ?? 0) + RULESET_RESERVE_PRICE;
  }
}

/** What a blow on one an opposing healer would pick back up is worth to a tactician and a genius, against
 *  the same blow on the healer (Alyssa 2026-10-26). */
const RULESET_PICKED_UP = { tactical: 0.8, genius: 0.7 } as const;

/** Whether this one could heal somebody now: free to act, with a heal it can still pay for. */
function rulesetFreeHealer(definition: RulesetDefinition, encounter: RulesetEncounterState, one: RulesetCombatant) {
  if (one.down || !rulesetCombatStanding(one) || rulesetSetUpWay(definition, encounter, one) === "critical")
    return false;
  const pools = one.sheet
    ? readRulesetLive(definition, one.sheet.build, one.sheet.live, one.sheet.items).pools.map((pool) => pool.key)
    : [];
  return one.actions.some((action) => {
    if (!action.heal || action.reaction) return false;
    const healed = rulesetAverageAmount(action.heal);
    if (!Number.isFinite(healed) || healed <= 0) return false;
    if (action.innate?.slot) return rulesetInnateSlot(one, action, encounter) !== undefined;
    if (action.uses && rulesetActionUses(one, action, encounter) < 1) return false;
    if (!action.use || !one.sheet) return true;
    return [undefined, ...pools].some((pool) => planRulesetCombatCost(definition, one, action, pool) !== null);
  });
}

/**
 * A tactician or a genius goes for the healer first (Alyssa 2026-10-26: "No point in focusing Ulfgar if
 * a Cleric is just going to Healing Word him every round and pick him right back up"): while an
 * opponent free to act could heal the others, and a blow at that healer is on its menu, its blows at
 * anybody else count for less, the harm being undone at the healer's next turn.
 */
function weighRulesetPickedUp(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  if (tactics.mind !== "tactical" && tactics.mind !== "genius") return;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  if (foes.length < 2) return;
  const healers = new Set(foes.filter((one) => rulesetFreeHealer(definition, encounter, one)).map((one) => one.id));
  if (healers.size === 0) return;
  const harms = (candidate: CombatAiCandidate<RulesetCandidate>) =>
    candidate.targetId !== undefined &&
    foes.some((one) => one.id === candidate.targetId) &&
    (candidate.damage ?? 0) > 0 &&
    !((candidate.healing ?? 0) > 0);
  if (!candidates.some((candidate) => harms(candidate) && healers.has(candidate.targetId!))) return;
  const by = RULESET_PICKED_UP[tactics.mind];
  for (const candidate of candidates)
    if (harms(candidate) && !healers.has(candidate.targetId!)) candidate.damage = candidate.damage! * by;
}

/** What a tactician gives a lasting help to its own side while the fight is still coming (combat AI P8). */
const RULESET_PREPARE_FOCUS = 0.35;

/**
 * A tactician or a genius readies itself while the fight is still far (combat AI P8): with no
 * opponent able to walk up and strike it before its next turn, a help that lasts (Shield of Faith,
 * Mage Armor, Greater Invisibility) on itself or a friend is worth more than a chip shot from afar.
 * Never one that would end what it already holds, and never once an opponent is close.
 */
function weighRulesetPrepare(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  if (tactics.mind !== "tactical" && tactics.mind !== "genius") return;
  if (!encounter.board?.grid || !rulesetPositionOf(actor)) return;
  const perCell = definition.combat?.distance?.perCell;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  if (foes.length === 0) return;
  // Close when any opponent could walk up and strike it, or any friend of it already stands beside one.
  const close = foes.some((foe) => {
    if (!rulesetPositionOf(foe)) return true;
    const walks = perCell ? rulesetInCells(foe.speed, perCell) : 6;
    const reach = Math.max(1, ...foe.actions.filter((one) => one.damage && !one.range).map((one) => one.reach ?? 1));
    if (rulesetGap(actor, foe) <= walks + reach) return true;
    return encounter.combatants.some(
      (friend) =>
        friend.side === actor.side &&
        rulesetCombatStanding(friend) &&
        rulesetPositionOf(friend) &&
        rulesetGap(friend, foe) <= 1,
    );
  });
  if (close) return;
  for (const candidate of candidates) {
    const helps = (candidate.setup ?? 0) + (candidate.support ?? 0);
    // What it gains its holder in the fight (a boost) is still a help, not a blow.
    const harms = (candidate.damage ?? 0) - (candidate.action.boosts ?? 0) > 1e-9;
    if (helps <= 0 || (candidate.healing ?? 0) > 0 || harms) continue;
    const option = candidate.action.option;
    if (option.kind === "standard" || option.kind === "move") continue;
    const target = candidate.targetId ? rulesetCombatant(encounter, candidate.targetId) : actor;
    if (!target || target.side !== actor.side) continue;
    const action = actor.actions.find((one) => one.id === option.id);
    if (!action?.applies?.length) continue;
    if (action.concentration && actor.concentrating) continue;
    // Only what lasts into the fight: a moment's help is spent before anybody arrives.
    if (!action.applies.some((applied) => rulesetDurationWorth(rulesetLasting(action, applied)) >= 0.85)) continue;
    candidate.focus = (candidate.focus ?? 0) + RULESET_PREPARE_FOCUS;
  }
}

/**
 * Whom a creature goes for by what it is (combat AI P6), onto each candidate as `focus`, where its
 * own data names nobody: an animal the nearest and the weakest, a cunning one the weakest and then the
 * most dangerous, a tactician and a genius whoever is doing its side the most harm (its blows, the
 * health it gives back, the spell it holds and who of its side it holds down). A mindless one is
 * played apart.
 */
function weighRulesetMindFocus(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  tactics: CombatTactics,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
): void {
  const combat = definition.combat;
  if (!combat || tactics.mind === undefined || tactics.mind === "mindless") return;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  if (foes.length < 2) return;
  const lowest = (score: (one: RulesetCombatant) => number) => {
    const scored = foes.map((one) => ({ one, score: score(one) }));
    const best = Math.min(...scored.map((entry) => entry.score));
    // Nobody stands out when they are all alike.
    if (scored.every((entry) => entry.score === best)) return new Set<string>();
    return new Set(scored.filter((entry) => entry.score === best).map((entry) => entry.one.id));
  };
  const at = rulesetPositionOf(actor);
  const nearest = () =>
    at ? lowest((one) => (rulesetPositionOf(one) ? rulesetGap(actor, one) : Infinity)) : new Set<string>();
  const weakest = () =>
    lowest((one) => {
      const health = rulesetCombatHealth(definition, combat, one);
      return health.value + health.temp;
    });
  const dangerous = () => lowest((one) => -rulesetThreat(definition, combat, encounter, one));
  const leanings: Array<[Set<string>, number]> =
    tactics.mind === "instinct"
      ? [
          [nearest(), 0.15],
          [weakest(), 0.15],
        ]
      : tactics.mind === "cunning"
        ? [
            [weakest(), 0.15],
            [dangerous(), 0.1],
          ]
        : [[dangerous(), tactics.mind === "genius" ? 0.25 : 0.2]];
  const worth = (candidate: CombatAiCandidate<RulesetCandidate>) => (candidate.damage ?? 0) + (candidate.setup ?? 0);
  const best = Math.max(0, ...candidates.map(worth));
  const hardest = Math.max(0, ...candidates.map((candidate) => candidate.action.expected ?? 0));
  for (const candidate of candidates) {
    const target = candidate.targetId;
    // Only something done to an opponent: a heal or a help is aimed by need.
    if (target === undefined || ((candidate.damage ?? 0) <= 0 && (candidate.setup ?? 0) <= 0)) continue;
    let focus = 0;
    for (const [ids, by] of leanings) if (ids.has(target)) focus += by;
    // Shrunk by how far short of its best this falls: liking the look of a target never makes a token
    // blow (a long-range dagger at a healer) beat stepping in for a full Multiattack.
    if (best > 0) focus *= Math.min(1, worth(candidate) / best);
    // Nor a blow that does much less harm than its hardest, whoever takes it: two daggers thrown at
    // disadvantage at a wizard do some six tenths of a Multiattack on the knight beside it, and win
    // nothing by its liking (re-test 10). Full only for its hardest, none below 85 hundredths: two
    // daggers worth nine tenths of a Multiattack on the fighter two steps off no longer walk it away
    // from him (re-test 12). Nor at all for a blow weaker than its hardest (re-test 13): the lean picks
    // between blows that hurt alike, and never lets two daggers worth 94 hundredths of a Multiattack
    // win over it.
    const expected = candidate.action.expected;
    if (expected !== undefined && hardest > 0 && expected < hardest * RULESET_FOCUS_ALIKE) focus = 0;
    if (focus > 0) candidate.focus = (candidate.focus ?? 0) + focus;
  }
}

/**
 * What a creature's own data says it goes for (1.763), onto each candidate as `focus`: whom it goes
 * for first (`targets`, the first named most), a friend's opponent for a `pack` hunter, and on its
 * first turns the opener it names, ahead of anything else worth doing.
 */
function weighRulesetBehavior(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
  behavior: RulesetCombatBehavior,
  candidates: Array<CombatAiCandidate<RulesetCandidate>>,
  opening: boolean,
): void {
  const combat = definition.combat;
  if (!combat) return;
  const foes = encounter.combatants.filter((one) => one.side !== actor.side && rulesetCombatStanding(one));
  const allies = encounter.combatants.filter(
    (one) => one.side === actor.side && one.id !== actor.id && rulesetCombatStanding(one),
  );
  const at = rulesetPositionOf(actor);
  const near = (a: RulesetCombatant, b: RulesetCombatant) =>
    !!rulesetPositionOf(a) && !!rulesetPositionOf(b) && rulesetGap(a, b) <= 1;
  const health = (one: RulesetCombatant) => rulesetCombatHealth(definition, combat, one);
  const lowest = (score: (one: RulesetCombatant) => number) => {
    const scored = foes.map((one) => ({ one, score: score(one) }));
    const best = Math.min(...scored.map((entry) => entry.score));
    return new Set(scored.filter((entry) => entry.score === best).map((entry) => entry.one.id));
  };
  const preferred = (preference: RulesetTargetPreference): Set<string> => {
    switch (preference) {
      case "nearest":
        return at ? lowest((one) => (rulesetPositionOf(one) ? rulesetGap(actor, one) : Infinity)) : new Set();
      case "weakest":
        return lowest((one) => health(one).value + health(one).temp);
      case "strongest":
        return lowest((one) => -rulesetThreat(definition, combat, encounter, one));
      case "wounded":
        return new Set(foes.filter((one) => health(one).value < health(one).max * 0.5).map((one) => one.id));
      case "casters":
        return new Set(foes.filter((one) => one.actions.some(rulesetActionIsSpell)).map((one) => one.id));
      case "healers":
        return new Set(foes.filter((one) => one.actions.some((action) => action.heal)).map((one) => one.id));
      case "attacker":
        return new Set(actor.harmedBy && foes.some((one) => one.id === actor.harmedBy) ? [actor.harmedBy] : []);
      case "concentrating":
        return new Set(foes.filter((one) => one.concentrating).map((one) => one.id));
      case "leader":
        return new Set(foes.filter((one) => one.leader || one.block?.leader).map((one) => one.id));
    }
  };
  const ranked = (behavior.targets ?? []).map(preferred);
  const hunted = behavior.pack
    ? new Set(foes.filter((foe) => allies.some((ally) => near(ally, foe))).map((one) => one.id))
    : new Set<string>();
  // Its opener: the first named that it can do and that is worth doing.
  const opener = opening
    ? behavior.opens!.find((id) => candidates.some((one) => rulesetOpensWith(actor, one.action, id)))
    : undefined;
  for (const candidate of candidates) {
    let focus = 0;
    const target = candidate.targetId;
    // Only something done to an opponent: a heal or a help is aimed by need, never by preference.
    const harms =
      target !== undefined &&
      foes.some((one) => one.id === target) &&
      ((candidate.damage ?? 0) > 0 || (candidate.setup ?? 0) > 0);
    if (harms) {
      ranked.forEach((ids, place) => {
        if (ids.has(target!)) focus += Math.max(0.1, 0.4 - 0.1 * place);
      });
      if (hunted.has(target!)) focus += 0.25;
    }
    if (opener !== undefined && rulesetOpensWith(actor, candidate.action, opener)) focus += 1;
    if (focus > 0) candidate.focus = (candidate.focus ?? 0) + focus;
  }
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
  // Cast by praying (1.786): read before the step, which may spend what it was.
  const user = rulesetCombatant(fight.encounter, choice.actorId);
  const prayed =
    user && rulesetPrayedOptions(definition, user).includes(choice.optionId)
      ? user.actions.find((action) => action.id === choice.optionId)
      : undefined;
  const step = applyRulesetCombatChoice(definition, fight.encounter, choice, rollerFor(fight));
  const refused = step.events.find((event) => event.type === "refused") ?? null;
  // A refusal changes nothing and bumps nothing: the state it was given is the state it hands back.
  if (refused) return { refused };
  absorb(
    definition,
    state,
    fight,
    prayed
      ? {
          ...step,
          events: [
            { type: "prayed", actorId: choice.actorId, optionId: prayed.id, label: prayed.label },
            ...step.events,
          ],
        }
      : step,
  );
  return { refused: null };
}

/** A step's events into the fight, and the books that follow from them. A round can turn over on an
 *  ordinary turn or inside a window that was holding one up, and the Game Master gets its calls back
 *  either way, so the reading is here rather than at one of the two places a turn can end. */
function absorb(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  step: Pick<RulesetCombatStep, "state" | "unanswered"> & { events: readonly RulesetCombatEvent[] },
): void {
  const before = fight.encounter.window;
  fight.encounter = step.state;
  record(fight, step.events);
  // Every window opened, let go or closed is said in the server's log: a fight standing on one that
  // nobody was shown is otherwise untraceable (laptop playtest 2026-10-25).
  const passed = new Set<string>();
  for (const event of step.events) {
    if (event.type === "window")
      logger.info(
        "[game/combat:ruleset] Window %s (%s%s%s) opened, waiting on %s",
        event.window,
        event.kind,
        event.moment
          ? ` on ${event.moment}`
          : event.readied
            ? ` readied, ${event.readied}`
            : event.moverId
              ? ` as ${event.moverId} moves`
              : "",
        event.label ? `: ${event.label}` : "",
        event.waiting.join(", "),
      );
    else if (event.type === "pass") {
      passed.add(event.window);
      logger.info("[game/combat:ruleset] %s let window %s go by", event.actorId, event.window);
    }
  }
  if (before && before.id !== fight.encounter.window?.id && !passed.has(before.id))
    logger.info("[game/combat:ruleset] Window %s closed, answered or ended", before.id);
  for (const one of step.unanswered ?? []) {
    // Why a reaction could not answer is said once a round, not at every window after it (cloud
    // probes 2026-10-25: a Mage logged "used", and then out of reach or sight, up to four a round).
    if (rulesetSaidThisRound(fight, one.actorId, one.label, one.because)) continue;
    recordReasons(fight, one.actorId, [{ why: "couldNotAnswer", label: one.label, because: one.because }]);
  }
  if (step.events.some((event) => event.type === "round")) state.gmCalls = 0;
  syncRulesetCombatants(definition, state);
}

/** Whether this round's log already says why this one's `label` could not answer. */
function rulesetSaidThisRound(
  fight: RulesetFightState,
  actorId: string,
  label: string,
  because: Extract<DirectedRulesetReason, { why: "couldNotAnswer" }>["because"],
): boolean {
  for (let index = fight.events.length - 1; index >= 0; index--) {
    const event = fight.events[index]!.event;
    if (event.type === "round") return false;
    if (
      event.type === "reasoning" &&
      event.actorId === actorId &&
      event.reasons.some(
        (reason) => reason.why === "couldNotAnswer" && reason.because === because && reason.label === label,
      )
    )
      return true;
  }
  return false;
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
    if (controller === "manual") {
      // Asked with nothing worth taking (a Shield that would not stop the hit): let go for them,
      // rather than holding the fight on a prompt with only "Let it go by" on it.
      if (rulesetMenu(definition, fight.encounter, asking, true).length > 0) return;
      applyChoiceOnly(definition, state, fight, {
        actorId: asking,
        optionId: RULESET_PASS_OPTION,
        targetIds: [],
        window: window.id,
      });
      continue;
    }
    // A chooser of their own spends handed to the Engine mid-throw (1.395) gets the Engine's pick.
    if (window.kind === "spend") {
      const engine = rulesetWindowOptions(definition, fight.encounter, asking).some(
        (option) => option.id === RULESET_ENGINE_SPENDS_OPTION,
      );
      applyChoiceOnly(definition, state, fight, {
        actorId: asking,
        optionId: engine ? RULESET_ENGINE_SPENDS_OPTION : RULESET_PASS_OPTION,
        targetIds: [],
        window: window.id,
      });
      continue;
    }
    if (controller === "gm" && openRulesetWindowDecision(definition, state, fight, asking)) return;
    const menu = rulesetWindowOptions(definition, fight.encounter, asking);
    // Somebody hidden from it, and a Detect to look for them with (1.287).
    const looking = searchOption(definition, fight.encounter, asking, menu, false);
    const ranked = looking
      ? null
      : menu.length > 0
        ? pickRulesetRanked(definition, state, fight.encounter, asking, menu)
        : null;
    const picked = ranked?.candidate.action;
    // A hit no answer on the menu could turn (a Parry's +3 against a hit beating the defense by ten)
    // is let go without a word: there was nothing to weigh (cloud AI fights 2026-10-24).
    const trigger = window.trigger;
    const unturnable =
      trigger.kind === "hit" &&
      !looking &&
      (!picked?.choice || picked.choice.optionId === RULESET_PASS_OPTION) &&
      menu
        .filter((option) => option.id !== RULESET_PASS_OPTION)
        .every((option) => {
          const answer = heldHitAnswer(definition, fight.encounter, asking, option, trigger.targetIds ?? [], trigger);
          return answer?.to !== undefined && !answer.misses;
        });
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
    } else if (ranked && choice.optionId === RULESET_PASS_OPTION) {
      // Weighed and let go: said, so a pass reads as a choice rather than the menu going unread. A
      // moment with nothing to answer it with but letting it go says nothing.
      if (!unturnable && menu.some((option) => option.id !== RULESET_PASS_OPTION))
        recordReasons(fight, asking, [{ why: "letGo" }]);
    } else if (ranked) {
      callOutSetUps(definition, fight, asking);
      recordReasons(
        fight,
        asking,
        rulesetWindowReasons(
          window.trigger,
          ranked.candidate,
          rulesetPickReasons(ranked.candidate, ranked.parts, undefined, fight.encounter, definition),
          rulesetCombatant(fight.encounter, asking)?.actions.find((one) => one.id === choice.optionId)?.reaction
            ?.cancels === true,
        ),
      );
    }
  }
}

/** How many whole rounds a fight may go on with nothing in it changing before it breaks off (K8):
 *  nobody hurt or healed, nobody moved, downed or gone, and no blow reaching anybody's health. Ten,
 *  so a run of misses never ends a fight that is still being fought. */
const RULESET_STALL_ROUNDS = 10;

/** What a round could change that can still end the fight, and only that: health, where each
 *  stands, who is down or gone. Conditions, areas and a ruleset's own counters are left out, as
 *  they can turn over for ever with nobody nearer the end (K6 re-test: a duellist ordered to spare
 *  shifting initiative and crashing the last ape for 74 rounds). */
function rulesetStallKey(definition: RulesetDefinition, encounter: RulesetEncounterState): string {
  const combat = definition.combat!;
  return JSON.stringify(
    encounter.combatants.map((combatant) => [
      combatant.id,
      // Off its sheet for one that has one, as every other reading of it is.
      rulesetCombatHealth(definition, combat, combatant).value,
      rulesetCombatHealth(definition, combat, combatant).temp,
      combatant.x,
      combatant.y,
      combatant.down,
      combatant.dying,
      combatant.defeated,
      !!combatant.away,
    ]),
  );
}

/** Called as each turn begins: a fight that has looked the same for ten rounds breaks off, both
 *  sides still standing, and says so (K1, K6, K8: a board nobody could cross, orders to spare that
 *  no blow could honour, a hill both sides stood on for fifty rounds). */
function rulesetStalled(definition: RulesetDefinition, state: CombatDirectorState, fight: RulesetFightState): boolean {
  const round = fight.encounter.round;
  const key = rulesetStallKey(definition, fight.encounter);
  const stall = fight.stall;
  // A blow that reached somebody's health, soaked to nothing or not, is the fight still being fought:
  // a pool fight where every hit is taken by a hide counts as going on (pool fight seed 10).
  const struck = !!stall && fight.events.some((entry) => entry.seq > stall.seq && entry.event.type === "damage");
  if (!stall || stall.key !== key || struck) {
    fight.stall = { key, round, rounds: 0, seq: fight.eventSeq };
    return false;
  }
  if (round <= stall.round) return false;
  stall.round = round;
  stall.rounds += 1;
  stall.seq = fight.eventSeq;
  if (stall.rounds < RULESET_STALL_ROUNDS) return false;
  state.outcome = "flee";
  state.stalled = true;
  // What only meant something inside it comes off, as every other ending takes it (laptop playtest
  // 2026-10-26: Blessed still listed once the fight was over).
  fight.encounter = settleRulesetFledFight(definition, fight.encounter, rollerFor(fight)).state;
  record(fight, [{ type: "outcome", outcome: "fled", stalled: true }]);
  return true;
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
  if (rulesetStalled(definition, state, fight)) return;
  // A player's member on the ground and dying has rolled against death as the turn began and has
  // nothing else to do: the turn ends by itself rather than waiting on a click that decides nothing.
  const next = currentRulesetActor(fight.encounter);
  if (
    next &&
    next.dying &&
    !next.stable &&
    rulesetEncounterOutcome(fight.encounter) === "ongoing" &&
    !fight.encounter.window &&
    rulesetController(state, fight, next) === "manual" &&
    rulesetCombatOptions(definition, fight.encounter, next.id).every((option) => option.kind === "end-turn")
  )
    advanceTurn(definition, state, fight);
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
  // Out of a fallen holder first (1.405), where it was inside one: nothing else is offered in there.
  const climb = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.id === RULESET_CLIMB_OUT_OPTION,
  );
  if (climb) applyChoice(definition, state, fight, { actorId, optionId: climb.id, targetIds: [] });
  const stand = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.id === RULESET_STAND_OPTION,
  );
  if (stand) applyChoice(definition, state, fight, { actorId, optionId: stand.id, targetIds: [] });
  // And picks up what it dropped (1.266), with the turn's free pick-up.
  const pickUp = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.pickUp && !option.budget,
  );
  if (pickUp) applyChoice(definition, state, fight, { actorId, optionId: pickUp.id, targetIds: [] });
  // Slips free of whatever holds it that it may (1.486): staying held never helps it.
  for (let tries = 0; tries < 12; tries += 1) {
    const slip = rulesetCombatOptions(definition, fight.encounter, actorId).find((option) => option.slip);
    if (!slip) break;
    applyChoice(definition, state, fight, { actorId, optionId: slip.id, targetIds: [] });
  }
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
  if (actor && rulesetDrivenFrom(definition, fight.encounter, actor)) {
    if (walkTowardsTrouble(definition, state, fight, actorId, undefined, undefined, false))
      recordReasons(fight, actorId, [{ why: "driven" }]);
  }
  // A leader steadies those of its side running near it (combat AI A6).
  if (actor && !actor.routed) rallyRulesetSide(definition, fight.encounter, actor);
  // Its temperament turned by what has happened (combat AI T7).
  const turned = actor ? shiftRulesetTemperament(definition, state, fight.encounter, actor) : undefined;
  if (turned) record(fight, [{ type: "temperamentShift", actorId, ...turned }]);
  // Broken (1.762): its whole turn is getting away.
  if (actor?.routed) {
    // With no way left to the edge it fights on, as cornered things do (laptop re-test 2026-10-24: a
    // bugbear in a cavern with no way out dashed on the spot for fifteen turns).
    if (rulesetHasWayOut(definition, fight.encounter, actor)) {
      // Its why before it runs, so the getaway reads as the broken morale it is (D4).
      recordReasons(fight, actorId, [{ why: "routed" }]);
      runForTheEdge(definition, state, fight, actorId);
      advanceTurn(definition, state, fight);
      return;
    }
    recordReasons(fight, actorId, [{ why: "cornered" }]);
  }
  // Lying in wait (1.763): it hides where it can and keeps still until its prey comes to it.
  if (actor && rulesetLiesInWait(definition, state, fight.encounter, actor)) {
    const hide = rulesetCombatOptions(definition, fight.encounter, actorId).find(
      (option) => option.kind === "standard" && rulesetStandardName(option.id) === "hide",
    );
    if (hide && !actor.hiding) applyChoice(definition, state, fight, { actorId, optionId: hide.id, targetIds: [] });
    recordReasons(fight, actorId, [{ why: "liesInWait" }]);
    advanceTurn(definition, state, fight);
    return;
  }
  // Everybody it could fight is hidden from it (1.287): it looks for them first.
  const looking = searchOption(
    definition,
    fight.encounter,
    actorId,
    rulesetCombatOptions(definition, fight.encounter, actorId),
    true,
  );
  if (looking) applyChoice(definition, state, fight, { actorId, optionId: looking.id, targetIds: [] });
  // A companion's orders (P7): pulling its blows when told to spare, falling back when told to
  // retreat, and never walking into the fight when told to hold or to retreat.
  const unit = [...state.party, ...state.enemies].find((one) => one.id === actorId);
  const orders = actor && unit ? rulesetOrdersFor(definition, fight.encounter, actor, unit) : undefined;
  if (orders?.spare && actor && !actor.knocksOut) {
    const pull = rulesetCombatOptions(definition, fight.encounter, actorId).find((option) => {
      const action = actor.actions.find((one) => one.id === option.id);
      return !!action?.switches && "knockOut" in action.switches;
    });
    if (pull) applyChoice(definition, state, fight, { actorId, optionId: pull.id, targetIds: [] });
  }
  if (orders?.posture === "retreat" && actor) {
    const now = rulesetCombatant(fight.encounter, actorId)!;
    const beside = fight.encounter.combatants.some(
      (one) =>
        one.side !== now.side && rulesetCombatStanding(one) && rulesetPositionOf(one) && rulesetGap(now, one) <= 1,
    );
    const away = beside ? null : rulesetRetreatCell(definition, fight.encounter, actorId);
    if (away)
      applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: away });
  }
  const stays = orders?.posture === "hold" || orders?.posture === "retreat";
  // One that can harm nobody (a familiar) does what it can from where it is, or walks up to help, and
  // never wades in with nothing to do there (laptop party A 2026-10-25: an owl charged and died).
  const harmless =
    !!actor &&
    !!definition.combat &&
    rulesetCombatEffects(definition, definition.combat, actor, fight.encounter).has("cannot-harm");
  // A proud legend near its end takes to the sky and fights from there (combat AI T5).
  const aloof = !stays && retreatAloft(definition, state, fight, actorId);
  letGoOfTheDown(definition, state, fight, actorId);
  if (!stays) mountUp(definition, state, fight, actorId);
  // A hungry one with its prey in hand drags it off, away from the rest (combat AI T8).
  const feeding = !stays && dragOffPrey(definition, state, fight, actorId);
  const ordered = actor && orders ? rulesetLeashOf(state, fight.encounter, actor, orders) : undefined;
  const territory =
    !ordered && actor && unit ? rulesetTerritoryLeash(definition, fight.encounter, actor, unit) : undefined;
  const leash = ordered ?? territory;
  // What it had done before this turn's choices, so a territorial one that does nothing says why.
  const seqBefore = fight.eventSeq;
  // Picked up where it was left when a window it opened was answered by a person.
  const earlier =
    fight.turnSoFar?.actorId === actorId &&
    fight.turnSoFar.round === fight.encounter.round &&
    fight.turnSoFar.turn === fight.encounter.turn
      ? fight.turnSoFar
      : undefined;
  // A weapon it carries taken in hand, or other ammunition picked, where that does clearly better
  // (2026-10-26): once, as the turn begins, never again on a turn picked up after a window.
  if (!earlier) takeBetterInHand(definition, state, fight, actorId);
  // A caster or archer caught beside an opponent gets clear before it shoots (re-test 9).
  if (!stays) getClearToShoot(definition, state, fight, actorId);
  // A companion steps up to where it can reach whoever is dropping areas on the party.
  const pressing = !stays && pressRulesetBlaster(definition, state, fight, actorId, orders);
  // Once it has dodged, got away or hidden (1.761), it does not walk back into the fight this turn.
  let defended = earlier?.defended ?? false;
  // Whether its last blow was thrown from afar (combat AI P8), and whether it keeps its distance after.
  let shotFromAfar: "stay" | "kite" | false = earlier?.shotFromAfar ?? false;
  // Whether it has struck up close (combat AI A4): a skirmisher, or a careful one, gets out after.
  let struckClose = earlier?.struckClose ?? false;
  const remember = () => {
    fight.turnSoFar = {
      actorId,
      round: fight.encounter.round,
      turn: fight.encounter.turn,
      shotFromAfar,
      defended,
      ...(struckClose ? { struckClose } : {}),
    };
  };
  // What it picked and could not carry out this turn: it picks again without it, rather than ending a
  // turn it did nothing with (laptop playtest 2026-10-23: two turns of nothing, with no reason).
  const tried = new Set<string>();
  // Whether it ended a turn rather than kill under a spare order: said as that, however the turn ends.
  let spared = false;
  for (let action = 0; action < RULESET_TURN_ACTION_LIMIT; action++) {
    if (rulesetEncounterOutcome(fight.encounter) !== "ongoing") break;
    remember();
    // Waiting on a person's answer: the rest of the turn waits with it.
    if (fight.encounter.window) return;
    // Back on its feet since the turn began (a roll against death): it stands before anything else.
    const standUp = rulesetCombatOptions(definition, fight.encounter, actorId).find(
      (option) => option.id === RULESET_STAND_OPTION,
    );
    if (standUp) applyChoice(definition, state, fight, { actorId, optionId: standUp.id, targetIds: [] });
    rulesetKeptBack.delete(actorId);
    rulesetTowardFree.delete(actorId);
    const ranked = pickRulesetRanked(definition, state, fight.encounter, actorId, undefined, tried);
    const keptBack =
      rulesetKeptBack.delete(actorId) || (!!actor && rulesetFeebleHealer(definition, fight.encounter, actor));
    const towardFree = rulesetTowardFree.get(actorId);
    rulesetTowardFree.delete(actorId);
    const picked = ranked?.candidate.action ?? null;
    const idle = !picked || picked.option.kind === "end-turn";
    if (idle && ranked?.candidate.action.spares) spared = true;
    if (idle) {
      // Standing where a lasting area strikes it, it gets out first.
      if (!stays && stepOutOfHarm(definition, state, fight, actorId)) continue;
      // A shot thrown, it steps back where nobody can walk up and strike it, still in range for the
      // next; and with somebody still in its range it does not walk in to meet them.
      if (!stays && keepAloft(definition, state, fight, actorId)) continue;
      if (shotFromAfar && !stays && keepRulesetRange(definition, state, fight, actorId, shotFromAfar === "kite")) break;
      if (struckClose && !shotFromAfar && !defended && !stays && hitAndRun(definition, state, fight, actorId)) break;
      // A caster or archer with somebody already in its range stays where it can shoot from rather
      // than walking in to a melee (re-test 2026-10-23: a wizard on guard drifted up to her fighter
      // after casting and was clubbed down).
      if (
        !struckClose &&
        !stays &&
        RULESET_KEEPS_RANGE.has(unit?.tactics?.role ?? "") &&
        rulesetHasShot(definition, fight.encounter, actorId) &&
        keepRulesetRange(definition, state, fight, actorId, false)
      )
        break;
      if (towardFree && !stays && walkTowardsTrouble(definition, state, fight, actorId, leash, towardFree, false))
        continue;
      if (defended || stays || aloof || feeding || keptBack) break;
      if (harmless) {
        if (action === 0) recordReasons(fight, actorId, [{ why: "harmless" }]);
        break;
      }
      // Nothing to do yet with the one dropping areas on the party out of reach: it heads for them.
      if (pressing && walkTowardsTrouble(definition, state, fight, actorId, undefined, pressing)) continue;
      if (!walkTowardsTrouble(definition, state, fight, actorId, leash)) {
        // Ending a turn it did nothing with says why; ending one it already spent says nothing new.
        // Held back by whom it stays beside, it says so, not that nothing was worth it (laptop
        // playtest 2026-10-24: a guarding fighter's "nothing worth the price" with the fight eleven
        // squares off and his leader behind him).
        if (
          action === 0 &&
          ordered &&
          (!picked || picked.option.kind === "end-turn") &&
          rulesetClosingMove(definition, fight.encounter, actorId)
        )
          recordReasons(fight, actorId, [{ why: "guarding", targetId: ordered.charge.id }]);
        else if (ranked && picked && action === 0)
          recordReasons(
            fight,
            actorId,
            rulesetPickReasons(ranked.candidate, ranked.parts, undefined, fight.encounter, definition),
          );
        break;
      }
      continue;
    }
    if (picked.defensive) defended = true;
    // A standard action is only ever picked when nothing it has can hurt or help anybody from
    // anywhere it can get to. On a board that means it is out of reach, and the action is worth
    // more as a sprint towards the fight than as a dodge nobody is swinging at; the standard is
    // what is left once there is nowhere better to stand.
    // Never once it has shot from afar this turn (re-test 12): it keeps the range it shot from.
    if (
      picked.option.kind === "standard" &&
      !picked.defensive &&
      !stays &&
      !shotFromAfar &&
      !harmless &&
      !keptBack &&
      walkTowardsTrouble(definition, state, fight, actorId, leash, towardFree, !towardFree)
    )
      continue;
    // A sprint with nowhere to go is a turn spent on the spot.
    if (picked.option.kind === "standard" && rulesetStandardName(picked.option.id) === "dash") break;
    // Held at the end of its leash, a companion does not search for nobody or ready itself against
    // opponents far off (playtest re-test 9): it waits beside the one it guards.
    if (
      leash &&
      picked.option.kind === "standard" &&
      !picked.defensive &&
      (picked.option.ready || rulesetStandardName(picked.option.id) === "search")
    )
      break;
    // A getaway is taken where it stands, and then it runs (1.761).
    if (picked.defensive === "disengage") {
      if (applyChoice(definition, state, fight, picked.choice).refused) break;
      recordReasons(
        fight,
        actorId,
        rulesetPickReasons(ranked!.candidate, ranked!.parts, undefined, fight.encounter, definition),
      );
      const away = rulesetRetreatCell(definition, fight.encounter, actorId);
      if (away)
        applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: away });
      continue;
    }
    const fromHere =
      !!picked.to &&
      !picked.defensive &&
      rulesetShootsFromHere(definition, state, fight.encounter, actorId, picked.choice, picked.to);
    const from = rulesetPositionOf(rulesetCombatant(fight.encounter, actorId));
    if (picked.to && !picked.defensive && !fromHere && !stepBefore(definition, state, fight, actorId, picked.to)) {
      tried.add(rulesetChoiceKey(picked.choice));
      // Dropped on the way (a blow as it left somebody's reach): the walk still says what it was
      // for, as it would have had it got there (re-test 2026-10-24).
      const fell = rulesetCombatant(fight.encounter, actorId);
      if (!fell || !rulesetCombatStanding(fell)) {
        const at = rulesetPositionOf(fell);
        const walked = from && at ? Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) : undefined;
        recordReasons(
          fight,
          actorId,
          rulesetPickReasons(ranked!.candidate, ranked!.parts, walked, fight.encounter, definition),
        );
      }
      continue;
    }
    // Reckless first (1.606), as it is about to make a melee weapon attack.
    takeBeforeMelee(definition, state, fight, actorId, picked.choice);
    const afar = rulesetShotFromAfar(definition, state, fight.encounter, actorId, picked.choice);
    // A refusal here would be an Engine bug rather than a player's mistake, so the turn ends
    // instead of asking again with the same state and looping.
    if (applyChoice(definition, state, fight, picked.choice).refused) {
      // Refused from where it stood after all: it takes the walk it was picked with, and shoots.
      if (
        !fromHere ||
        !stepBefore(definition, state, fight, actorId, picked.to!) ||
        applyChoice(definition, state, fight, picked.choice).refused
      ) {
        tried.add(rulesetChoiceKey(picked.choice));
        continue;
      }
    }
    const at = rulesetPositionOf(rulesetCombatant(fight.encounter, actorId));
    const walked = from && at ? Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) : undefined;
    recordReasons(fight, actorId, [
      ...rulesetPickReasons(ranked!.candidate, ranked!.parts, walked, fight.encounter, definition),
      ...(ranked!.keptBack ? [{ why: "keptBack" as const, ...ranked!.keptBack }] : []),
    ]);
    callOutSetUps(definition, fight, actorId);
    // Kept through what it does after the shot that is no blow of its own (a goblin's Hide), so
    // the rest of its walk still keeps its distance (re-test 9); a blow up close ends it.
    const blow = !!rulesetCombatant(fight.encounter, actorId)?.actions.find((one) => one.id === picked.choice.optionId)
      ?.damage;
    if (afar || blow) shotFromAfar = afar;
    if (blow && !afar) struckClose = true;
  }
  delete fight.turnSoFar;
  // A turn it did nothing with always says why (laptop playtest 2026-10-23).
  const silent =
    !earlier &&
    !fight.encounter.window &&
    rulesetEncounterOutcome(fight.encounter) === "ongoing" &&
    !fight.events.some((one) => one.seq > seqBefore && "actorId" in one.event && one.event.actorId === actorId);
  // Keeping to its ground with nobody on it (combat AI T4): said, so it is no frozen token (re-test 14).
  if (silent && territory) record(fight, [{ type: "holdsGround", actorId }]);
  else if (silent && rulesetCombatStanding(rulesetCombatant(fight.encounter, actorId)!))
    recordReasons(fight, actorId, [
      // Held helpless (paralysed, stunned), or caught unaware: not a choice it made (cloud AI fights
      // 2026-10-24; laptop playtest 2026-10-25, a surprised Serath "nothing worth the price").
      rulesetCombatant(fight.encounter, actorId)!.surprised ||
      (definition.combat &&
        rulesetCombatEffects(
          definition,
          definition.combat,
          rulesetCombatant(fight.encounter, actorId)!,
          fight.encounter,
        ).has("cannot-act"))
        ? { why: "cannotAct" }
        : tried.size > 0
          ? { why: "noWay" }
          : stays
            ? { why: "holding" }
            : harmless
              ? { why: "harmless" }
              : spared
                ? { why: "sparing" }
                : ordered && rulesetClosingMove(definition, fight.encounter, actorId)
                  ? { why: "guarding", targetId: ordered.charge.id }
                  : { why: "nothingWorth" },
    ]);
  advanceTurn(definition, state, fight);
}

/** Whether this choice is a blow thrown from afar (combat AI P8): one with a range and no reach of its
 *  own (a bow or a spell; a thrown dagger is a melee weapon thrown, and its thrower walks in after it),
 *  at somebody not beside it. A tactician or a genius then steps back (`kite`); anybody else who thinks at all stays
 *  where it threw from (`stay`) rather than walk into the reach it just kept out of. */
function rulesetShotFromAfar(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  choice: RulesetCombatChoice,
): "stay" | "kite" | false {
  const mind = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics?.mind;
  if (mind === undefined || mind === "mindless") return false;
  const actor = rulesetCombatant(encounter, actorId);
  const action = actor?.actions.find((one) => one.id === choice.optionId);
  const target = choice.targetIds[0] ? rulesetCombatant(encounter, choice.targetIds[0]) : undefined;
  // An area thrown at a spot away from it (a Fireball) is a shot from afar too (re-test 2026-10-23:
  // read as a blow up close, it walked the wizard in after it).
  if (actor && action && !target && choice.at && action.range && !action.reach && action.damage) {
    if (!rulesetPositionOf(actor) || rulesetGapFrom(choice.at, 1, actor) <= 1) return false;
    return mind === "tactical" || mind === "genius" ? "kite" : "stay";
  }
  if (!actor || !action || !target || target.side === actor.side) return false;
  // A block (a scout's Multiattack) shoots only when every blow of it does.
  const blows = action.sequence?.length
    ? action.sequence.map((step) => actor.actions.find((one) => one.id === step.actionId))
    : [action];
  if (!blows.every((blow) => !!blow?.range && !blow.reach && !!blow.damage)) return false;
  if (!rulesetPositionOf(actor) || !rulesetPositionOf(target) || rulesetGap(actor, target) <= 1) return false;
  // One far better up close (a knight's greatsword against its crossbow) shoots only while it cannot
  // reach, and walks in after it (playtest re-test 15): keeping its distance is for those it serves.
  // Each blow as often as it is made: a scout's two Longbow shots against its two Shortswords
  // (re-test 17).
  const melee = (part: RulesetCombatAction | undefined) => !!part?.damage && (!part.range || !!part.reach);
  const ranged = (part: RulesetCombatAction | undefined) => !!part?.damage && !!part.range && !part.reach;
  const average = (one: RulesetCombatAction, kind: (part: RulesetCombatAction | undefined) => boolean): number =>
    one.sequence?.length
      ? one.sequence.reduce((sum, step) => {
          const part = actor.actions.find((each) => each.id === step.actionId);
          return kind(part) ? sum + rulesetAverageDamage(part!.damage!) * (step.times ?? 1) : sum;
        }, 0)
      : kind(one)
        ? rulesetAverageDamage(one.damage!)
        : 0;
  // Only what it may take now: a Flame Blade it has not called up is no blade (re-test 16).
  const usable = new Set(rulesetCombatOptions(definition, encounter, actorId).map((one) => one.id));
  const now = actor.actions.filter((one) => usable.has(one.id));
  const close = Math.max(0, ...now.map((one) => average(one, melee)));
  const shot = Math.max(average(action, ranged), ...now.map((one) => average(one, ranged)));
  if (close > shot * 1.5) return false;
  return mind === "tactical" || mind === "genius" ? "kite" : "stay";
}

/**
 * Whether a shot from afar is better thrown from where it stands than after the walk it was picked
 * with (playtest re-test 9): a thinking archer with its target already in normal range does not
 * walk toward the other side first, only away from it.
 */
function rulesetShootsFromHere(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  choice: RulesetCombatChoice,
  to: { x: number; y: number },
): boolean {
  if (!rulesetShotFromAfar(definition, state, encounter, actorId, choice)) return false;
  const actor = rulesetCombatant(encounter, actorId)!;
  const action = actor.actions.find((one) => one.id === choice.optionId)!;
  const blows = action.sequence?.length
    ? action.sequence.map((step) => actor.actions.find((one) => one.id === step.actionId)!)
    : [action];
  const normal = Math.min(...blows.map((blow) => blow.range!.normal));
  const home = rulesetPositionOf(actor)!;
  const span = rulesetSpanOf(actor);
  const targets = choice.targetIds.map((id) => rulesetCombatant(encounter, id));
  if (targets.some((target) => !target || !rulesetPositionOf(target) || rulesetGapFrom(home, span, target) > normal))
    return false;
  const foes = encounter.combatants.filter(
    (one) => one.side !== actor.side && !one.object && rulesetCombatStanding(one) && rulesetPositionOf(one),
  );
  const nearest = (cell: { x: number; y: number }) => Math.min(...foes.map((foe) => rulesetGapFrom(cell, span, foe)));
  if (nearest(to) >= nearest(home)) return false;
  // In range is not in sight: a hill or a wood between them leaves the walk to a clear line
  // (re-test 10), so the shot must be one it may take at them from here.
  const option = rulesetCombatOptions(definition, encounter, actorId).find((one) => one.id === choice.optionId);
  const legal = option ? new Set(rulesetOptionTargets(definition, encounter, actorId, option)) : new Set<string>();
  return choice.targetIds.every((id) => legal.has(id));
}

/**
 * Getting clear before it shoots (playtest re-test 9): one that thinks, standing beside an opponent
 * while its blows from afar do more than its blows up close (a mage's Fire Bolt against its
 * quarterstaff), first teleports where nobody is beside it and an opponent is in the normal range of
 * one of them, by a teleport another budget pays for (Misty Step). Walking off would be struck on the
 * way, and shooting from there is at a disadvantage in most rulesets. True when it moved.
 */
/** How much more the best the Engine's own tactics could do after taking a weapon in hand, or with
 *  other ammunition first, must be worth than the best they can do as they are before it is done: a
 *  share of that best, and at least `RULESET_IN_HAND_FLOOR`, so two near-equal blows never swap. */
const RULESET_IN_HAND_MARGIN = 0.2;
const RULESET_IN_HAND_FLOOR = 0.002;

/** Whether `after` is clearly worth more than `now`, as `RULESET_IN_HAND_MARGIN` has it. */
function rulesetClearlyBetter(after: number | undefined, now: number | undefined): boolean {
  if (after === undefined) return false;
  const base = now ?? 0;
  return after >= base + Math.max(RULESET_IN_HAND_FLOOR, Math.abs(base) * RULESET_IN_HAND_MARGIN);
}

/** The most the best of a turn is worth as the Engine's own tactics weigh it, of the candidates
 *  `wanted` keeps: each scored exactly as its own pick scores it, without the wavering that pick adds,
 *  which is drawn afresh for every list and would tell two copies of the fight apart by chance alone.
 *  Undefined with nothing to do. */
function rulesetBestWorth(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  wanted: (actor: RulesetCombatant, candidate: CombatAiCandidate<RulesetCandidate>) => boolean = () => true,
): { worth: number } | undefined {
  const actor = rulesetCombatant(encounter, actorId);
  if (!actor) return undefined;
  let best: { worth: number } | undefined;
  for (const one of rankRulesetChoices(definition, state, encounter, actorId, Number.MAX_SAFE_INTEGER)) {
    if (!wanted(actor, one.candidate)) continue;
    const worth = Object.values(one.parts).reduce((sum, part) => sum + (part ?? 0), 0);
    if (!best || worth > best.worth) best = { worth };
  }
  return best;
}

/** Whether a candidate is a blow that does harm; with `item`, one of the item at that place, and with
 *  `plain`, made in none of its modes. */
function rulesetBlowOf(
  actor: RulesetCombatant,
  candidate: CombatAiCandidate<RulesetCandidate>,
  item?: number,
  plain = false,
): boolean {
  const action = actor.actions.find((one) => one.id === candidate.action.choice.optionId);
  if (!action?.damage || !((candidate.damage ?? 0) > 0)) return false;
  return (item === undefined || rulesetActionItemIndex(action) === item) && (!plain || !candidate.action.choice.mode);
}

/**
 * The fighter takes a weapon it carries in hand, with the turn's one free interaction (2026-10-26),
 * where the best it could do with it beats the best it can do as it is by a clear margin, each read
 * by the Engine's own tactics on a copy of the fight: a bow drawn with nobody in the sword's reach, the
 * sword drawn back with an opponent beside the bow. Then each weapon in hand that shoots from the bag
 * shoots first the stack its best plain shot does most with, the plain ammunition unless another
 * does clearly better (an Arrow of Slaying only at what it slays). Never in a fight's window, and a
 * draw refused is never asked again: this is done once, as its turn begins.
 */
function takeBetterInHand(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const mind = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics?.mind;
  if (!actor?.sheet?.items || mind === "mindless" || fight.encounter.window) return;
  if (!rulesetCombatStanding(actor) || actor.surprised) return;
  const hands = rulesetInHand(definition, actor);
  if (!hands) return;
  const weapons = hands.free
    ? hands.carried.filter((one) => !one.blockedBy && !!actor.sheet!.items![one.item]?.item.attack)
    : [];
  if (weapons.length) {
    // Its best blow as it stands, against its best blow with what it took in hand.
    const now = rulesetBestWorth(definition, state, fight.encounter, actorId, (fighter, candidate) =>
      rulesetBlowOf(fighter, candidate),
    )?.worth;
    let best: { item: number; worth: number } | undefined;
    for (const one of weapons) {
      const trial = structuredClone(fight.encounter);
      if (!rulesetDrawInHand(definition, rulesetCombatant(trial, actorId)!, one.item).ok) continue;
      const after = rulesetBestWorth(definition, state, trial, actorId, (fighter, candidate) =>
        rulesetBlowOf(fighter, candidate, one.item),
      )?.worth;
      if (after !== undefined && rulesetClearlyBetter(after, now) && after > (best?.worth ?? -Infinity))
        best = { item: one.item, worth: after };
    }
    const drawn = best ? rulesetDrawInHand(definition, actor, best.item) : undefined;
    if (drawn?.ok) {
      record(fight, [drawn.event]);
      syncRulesetCombatants(definition, state);
    }
  }
  for (const weapon of rulesetInHand(definition, actor)?.ammo ?? []) {
    if (weapon.stacks.length < 2) continue;
    const worths = weapon.stacks.map((stack) => {
      const trial = structuredClone(fight.encounter);
      rulesetChooseAmmo(rulesetCombatant(trial, actorId)!, weapon.weapon, stack.item);
      return {
        item: stack.item,
        worth: rulesetBestWorth(definition, state, trial, actorId, (fighter, candidate) =>
          rulesetBlowOf(fighter, candidate, weapon.weapon, true),
        )?.worth,
      };
    });
    // The bag's own order first: plain ammunition, unless another stack does clearly better.
    const plain = worths[0]!;
    const better = worths
      .slice(1)
      .filter((one) => rulesetClearlyBetter(one.worth, plain.worth))
      .sort((a, b) => b.worth! - a.worth!)[0];
    const pick = (better ?? plain).item;
    if (pick !== weapon.first) rulesetChooseAmmo(actor, weapon.weapon, pick);
  }
}

/**
 * A companion out of reach of an opponent who has dropped an area on the party steps up to where it
 * can reach them (re-test round 3: a cult mage twelve squares back in the dusk threw a Fireball every
 * round and took no companion's blow in two lost fights): before it acts, to the safest cell this
 * turn's walk reaches from which it sees them within its longest blow's range. Returns whom it is
 * after while they are still out of its reach, for its idle turn to walk toward. Never under orders
 * that keep it at somebody's side (protect, or follow before the leader strikes), to hold or retreat.
 */
function pressRulesetBlaster(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
  orders: CombatOrders | undefined,
): string | undefined {
  const encounter = fight.encounter;
  const actor = rulesetCombatant(encounter, actorId);
  const home = rulesetPositionOf(actor);
  if (!actor || !home || actor.side !== "party" || !encounter.board?.grid) return undefined;
  if (
    orders?.posture === "protect" ||
    (orders?.posture === "follow" && rulesetChargeOf(state, encounter, actor, orders))
  )
    return undefined;
  const landed = new Set<string>();
  for (const { event } of fight.events) if (event.type === "area") landed.add(event.actorId);
  const blasters = encounter.combatants.filter(
    (foe) => foe.side !== actor.side && landed.has(foe.id) && rulesetCombatStanding(foe) && !!rulesetPositionOf(foe),
  );
  if (blasters.length === 0) return undefined;
  const options = rulesetCombatOptions(definition, encounter, actorId);
  const blows = options.flatMap((option) => {
    const action = actor.actions.find((one) => one.id === option.id);
    return action?.damage && !action.area && option.targets.side !== "ally" && option.targets.count > 0
      ? [{ option, action }]
      : [];
  });
  if (blows.length === 0) return undefined;
  // Already able to strike one of them from here.
  if (
    blows.some(({ option }) =>
      blasters.some((foe) => rulesetOptionTargets(definition, encounter, actorId, option).includes(foe.id)),
    )
  )
    return undefined;
  const reach = Math.max(1, ...blows.map(({ action }) => (action.reach ? 1 : (action.range?.normal ?? 1))));
  const span = rulesetSpanOf(actor);
  const blaster = blasters.reduce((best, foe) => (rulesetGap(actor, foe) < rulesetGap(actor, best) ? foe : best));
  let best: { cell: { x: number; y: number }; provokes: number; danger: number; cost: number } | null = null;
  for (const cell of rulesetWalkableCells(definition, encounter, actorId)) {
    if (rulesetGapFrom(cell, span, blaster) > reach) continue;
    if (!rulesetSees(encounter, { ...actor, x: cell.x, y: cell.y } as RulesetCombatant, blaster)) continue;
    const entry = {
      cell,
      provokes: cell.provokes.length,
      danger: rulesetDangerAt(definition, encounter, actor, cell),
      cost: cell.cost,
    };
    if (
      !best ||
      entry.provokes < best.provokes ||
      (entry.provokes === best.provokes &&
        (entry.danger < best.danger || (entry.danger === best.danger && entry.cost < best.cost)))
    )
      best = entry;
  }
  if (best) {
    applyChoice(definition, state, fight, {
      actorId,
      optionId: RULESET_MOVE_OPTION,
      targetIds: [],
      to: { x: best.cell.x, y: best.cell.y },
    });
    return undefined;
  }
  return blaster.id;
}

function getClearToShoot(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const encounter = fight.encounter;
  const mind = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics?.mind;
  if (mind === undefined || mind === "mindless") return false;
  const actor = rulesetCombatant(encounter, actorId);
  const home = rulesetPositionOf(actor);
  if (!actor || !home || !encounter.board?.grid) return false;
  const foes = encounter.combatants.filter(
    (one) => one.side !== actor.side && !one.object && rulesetCombatStanding(one) && rulesetPositionOf(one),
  );
  const span = rulesetSpanOf(actor);
  if (foes.every((foe) => rulesetGapFrom(home, span, foe) > 1)) return false;
  // Clear of every reach, not only of the cells beside them: a dragon's bite reaches two squares,
  // so a Misty Step to the second was a step still in its reach, and the walk on was struck (AI pass
  // 2026-10-24).
  const reachOf = (foe: RulesetCombatant) => Math.max(1, rulesetOpportunityAttack(foe)?.reach ?? 1);
  const options = rulesetCombatOptions(definition, encounter, actorId);
  const blows = options.flatMap((option) => {
    const action = actor.actions.find((one) => one.id === option.id);
    return action?.damage &&
      option.targets.side !== "ally" &&
      rulesetOptionTargets(definition, encounter, actorId, option).length > 0
      ? [{ option, action, average: rulesetAverageDamage(action.damage) }]
      : [];
  });
  const ranged = blows.filter((blow) => !!blow.action.range && !blow.action.reach);
  const close = Math.max(0, ...blows.filter((blow) => !ranged.includes(blow)).map((blow) => blow.average));
  const shots = ranged.filter((blow) => blow.average > close);
  if (shots.length === 0) return false;
  const clear = (cell: { x: number; y: number }) =>
    foes.every((foe) => rulesetGapFrom(cell, span, foe) > reachOf(foe)) &&
    shots.some((shot) => foes.some((foe) => rulesetGapFrom(cell, span, foe) <= shot.action.range!.normal));
  for (const option of options) {
    if (!option.teleport?.cells.length || option.targets.side === "enemy") continue;
    // Paid out of what a shot is not, so the shot is still there after it.
    if (option.budget && shots.every((shot) => shot.option.budget === option.budget)) continue;
    let best: { cell: { x: number; y: number }; danger: number } | null = null;
    for (const cell of option.teleport.cells) {
      if (!clear(cell) || rulesetZoneKillsAt(definition, encounter, actor, cell)) continue;
      const danger = rulesetDangerAt(definition, encounter, actor, cell);
      if (!best || danger < best.danger) best = { cell: { x: cell.x, y: cell.y }, danger };
    }
    if (
      best &&
      !applyChoice(definition, state, fight, { actorId, optionId: option.id, targetIds: [], at: best.cell }).refused
    )
      return true;
  }
  return false;
}

/**
 * Keeping its distance (combat AI P8): for one that kites, the safest cell it may still walk to
 * without being struck on the way, from which an opponent stays in range of one of its blows from
 * afar (in its normal range, where it has somebody there now), taken when it is safer than where it
 * stands. True when it has somebody in range, moved or not: then it stays rather than walk
 * in to meet them.
 */
function keepRulesetRange(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
  kites: boolean,
): boolean {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const home = rulesetPositionOf(actor);
  if (!actor || !home || !fight.encounter.board?.grid) return false;
  const ranged = actor.actions.filter(
    (one) => one.range && !one.reach && one.damage && rulesetActionAvailable(actor, one, fight.encounter, definition),
  );
  const normal = Math.max(0, ...ranged.map((one) => one.range!.normal));
  const long = Math.max(normal, ...ranged.map((one) => one.range!.long ?? one.range!.normal));
  if (long <= 1) return false;
  const foes = fight.encounter.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && rulesetPositionOf(one),
  );
  const span = rulesetSpanOf(actor);
  const within = (cell: { x: number; y: number }, reach: number) =>
    foes.some((foe) => rulesetGapFrom(cell, span, foe) <= reach);
  if (!within(home, long)) return false;
  if (!kites || (actor.movement !== undefined && (actor.movementLeft ?? 0) < 1)) return true;
  const reach = normal > 1 && within(home, normal) ? normal : long;
  const inRange = (cell: { x: number; y: number }) => within(cell, reach);
  // The danger first, then the furthest from the nearest opponent: the edge of a walk reads as no
  // danger, and a step beyond it is safer still.
  const nearest = (cell: { x: number; y: number }) => Math.min(...foes.map((foe) => rulesetGapFrom(cell, span, foe)));
  let best: { cell: { x: number; y: number }; danger: number; away: number } | null = null;
  const here = rulesetDangerAt(definition, fight.encounter, actor, home);
  const gap = nearest(home);
  for (const cell of rulesetWalkableCells(definition, fight.encounter, actorId)) {
    // Back or across, never in: a cell nearer the other side that reads as safer (woods between, a
    // foe slowed by the ground) is still a walk into them after the shot (re-test 10).
    if (cell.provokes.length > 0 || !inRange(cell) || nearest(cell) < gap) continue;
    const danger = rulesetDangerAt(definition, fight.encounter, actor, cell);
    // Any real step down counts: much of the danger may be spells that reach it anywhere.
    if (!best ? danger > here - 0.03 : danger > best.danger) continue;
    const away = nearest(cell);
    if (best && danger === best.danger && away <= best.away) continue;
    best = { cell: { x: cell.x, y: cell.y }, danger, away };
  }
  if (best)
    applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: best.cell });
  return true;
}

/**
 * In and out again (combat AI A4): a skirmisher, or a cautious or cowardly one, that has struck up
 * close and has walk left gets away from whoever it struck rather than standing there for the
 * answer. With a Disengage it can still take (a goblin's Nimble Escape) it goes to its getaway cell;
 * without one, only to a cell it can reach without drawing a blow, beside nobody. Never a mindless
 * one. Whether it got out.
 */
function hitAndRun(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const tactics = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics;
  if (!actor || !tactics || tactics.mind === "mindless" || !fight.encounter.board?.grid) return false;
  if (tactics.role !== "skirmisher" && tactics.adjective !== "cautious" && tactics.adjective !== "cowardly")
    return false;
  if (actor.movement !== undefined && (actor.movementLeft ?? 0) < 1) return false;
  const foes = fight.encounter.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && rulesetPositionOf(one),
  );
  if (!foes.some((foe) => rulesetGap(actor, foe) <= 1)) return false;
  const disengage = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => rulesetDefensiveName(option) === "disengage",
  );
  if (disengage && !applyChoice(definition, state, fight, { actorId, optionId: disengage.id, targetIds: [] }).refused) {
    const away = rulesetRetreatCell(definition, fight.encounter, actorId);
    if (away)
      applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: away });
    return true;
  }
  const span = rulesetSpanOf(actor);
  let best: { cell: { x: number; y: number }; danger: number } | null = null;
  for (const cell of rulesetWalkableCells(definition, fight.encounter, actorId)) {
    if (cell.provokes.length > 0 || foes.some((foe) => rulesetGapFrom(cell, span, foe) <= 1)) continue;
    const danger = rulesetDangerAt(definition, fight.encounter, actor, cell);
    if (!best || danger < best.danger) best = { cell: { x: cell.x, y: cell.y }, danger };
  }
  if (!best) return false;
  applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: best.cell });
  return true;
}

/**
 * Up out of reach (combat AI A7): a flier with something to shoot with, on the ground at the end of
 * what it does and with an opponent about who cannot fly, takes to the air where the board has
 * levels, so those who cannot fly cannot walk up and strike it. Not a bruiser, which wants to be in
 * among them, nor a reckless one, nor a mindless one. Whether it went up.
 */
/**
 * A hungry one (combat AI T8) holding its prey where it can drag them: off, away from everybody
 * else, prey and all. Whether it has its prey, so it stays with them rather than walking at anybody.
 */
/**
 * Letting go of those it holds who are down while an opponent still stands (playtest re-test 16): a
 * crocodile with two downed in its jaws could bite nobody and readied all fight. A hold costs nothing
 * to let go of. A cruel one the game allows to strike the fallen keeps hold of them.
 */
function letGoOfTheDown(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const tactics = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics;
  if (!actor || !fight.encounter.board || (state.cruel && tactics?.adjective === "cruel")) return;
  const foe = (one: RulesetCombatant) => one.side !== actor.side && !one.object;
  const down = rulesetDragging(definition, fight.encounter, actor).ids.filter((id) => {
    const one = rulesetCombatant(fight.encounter, id);
    return !!one && foe(one) && (one.down || !rulesetCombatStanding(one));
  });
  if (down.length === 0) return;
  if (!fight.encounter.combatants.some((one) => foe(one) && rulesetCombatStanding(one) && !!rulesetPositionOf(one)))
    return;
  absorb(definition, state, fight, rulesetLetGoOfHeld(definition, fight.encounter, rollerFor(fight), actorId, down));
}

function dragOffPrey(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const tactics = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics;
  if (!actor || tactics?.adjective !== "hungry" || !fight.encounter.board?.grid) return false;
  // Only prey still fighting it: one lying down is no longer worth hauling off, and dragging it on
  // round after round kept a fight going for twenty-five rounds (re-test 15).
  const prey = rulesetDragging(definition, fight.encounter, actor).ids.filter((id) => {
    const one = rulesetCombatant(fight.encounter, id);
    return !!one && one.side !== actor.side && !one.down && rulesetCombatStanding(one);
  });
  if (prey.length === 0) return false;
  tactics.targetId = prey[0];
  // Already where none of the rest can walk up to it this turn: it stays and feeds there, rather
  // than going round in circles as they shift about.
  const perCell = definition.combat?.distance?.perCell;
  const rest = fight.encounter.combatants.filter(
    (one) =>
      one.side !== actor.side && !prey.includes(one.id) && rulesetCombatStanding(one) && !!rulesetPositionOf(one),
  );
  const safe = rest.every((one) => rulesetGap(actor, one) > (perCell ? rulesetInCells(one.speed, perCell) : 6) + 1);
  if (safe) return true;
  const away = rulesetRetreatCell(definition, fight.encounter, actorId, prey);
  if (away) applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: away });
  return true;
}

/**
 * An arrogant legend (combat AI T5) with a fly speed, below a quarter of its health: up into the sky
 * if it is not there already. Whether it is aloft, so it does not come down to walk at anybody.
 */
function retreatAloft(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const tactics = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics;
  const grid = fight.encounter.board?.grid;
  const combat = definition.combat;
  if (!actor || !tactics || !grid || !combat || !actor.speeds?.fly) return false;
  if (tactics.adjective !== "arrogant" && tactics.shiftedFrom !== "arrogant") return false;
  const legendary =
    actor.signature !== undefined ||
    (actor.block?.legendaryResistance ?? 0) > 0 ||
    actor.actions.some((one) => one.signature !== undefined);
  const health = rulesetCombatHealth(definition, combat, actor);
  if (!legendary || health.value >= health.max / 4) return false;
  if (rulesetAirborne(grid, actor)) return true;
  const up = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.id === RULESET_FLY_UP_OPTION,
  );
  return !!up && !applyChoice(definition, state, fight, { actorId, optionId: up.id, targetIds: [] }).refused;
}

function keepAloft(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const tactics = [...state.party, ...state.enemies].find((one) => one.id === actorId)?.tactics;
  const grid = fight.encounter.board?.grid;
  if (!actor || !tactics || !grid || !actor.speeds?.fly || rulesetAirborne(grid, actor)) return false;
  if (tactics.mind === "mindless" || tactics.role === "bruiser" || tactics.adjective === "reckless") return false;
  const shoots = actor.actions.some(
    (one) => one.range && !one.reach && one.damage && rulesetActionAvailable(actor, one, fight.encounter, definition),
  );
  if (!shoots) return false;
  const grounded = fight.encounter.combatants.some(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && !!rulesetPositionOf(one) && !one.speeds?.fly,
  );
  if (!grounded) return false;
  const up = rulesetCombatOptions(definition, fight.encounter, actorId).find(
    (option) => option.id === RULESET_FLY_UP_OPTION,
  );
  if (!up) return false;
  return !applyChoice(definition, state, fight, { actorId, optionId: up.id, targetIds: [] }).refused;
}

/**
 * Whether an ambusher (a `behavior.ambush`, 1.763) still lies in wait: until an opponent stands where
 * it could strike them this turn, walking first, or it has been hurt. Once it springs it never waits
 * again. Never a mindless one, and never one the Game Master or a player decides for.
 */
function rulesetLiesInWait(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  const combat = definition.combat;
  const unit = [...state.party, ...state.enemies].find((one) => one.id === actor.id);
  if (!combat || !unit?.tactics || unit.tactics.sprung || unit.tactics.mind === "mindless") return false;
  if (!rulesetCombatantBehavior(definition, actor)?.ambush) return false;
  const at = rulesetPositionOf(actor);
  const health = rulesetCombatHealth(definition, combat, actor);
  const perCell = combat.distance?.perCell;
  const walks = perCell ? rulesetInCells(actor.speed, perCell) : 6;
  const reach = Math.max(
    1,
    ...actor.actions
      .filter((action) => action.damage || action.applies?.length)
      .map((action) => (action.range ? (action.range.long ?? action.range.normal) : (action.reach ?? 1))),
  );
  const prey =
    !at ||
    encounter.combatants.some(
      (one) =>
        one.side !== actor.side &&
        rulesetCombatStanding(one) &&
        !!rulesetPositionOf(one) &&
        rulesetGapFrom(at, rulesetSpanOf(actor), one) <= reach + walks,
    );
  if (prey || actor.harmedBy !== undefined || health.value < health.max) {
    unit.tactics.sprung = true;
    return false;
  }
  return true;
}

/**
 * A broken creature's turn (1.762): it gets away from an opponent beside it, else dashes, and runs
 * for the nearest edge of the board, where it is out of the fight as its next turn starts.
 */
function runForTheEdge(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  const standard = (name: string) =>
    rulesetCombatOptions(definition, fight.encounter, actorId).find(
      (option) => option.kind === "standard" && rulesetStandardName(option.id) === name,
    );
  const actor = rulesetCombatant(fight.encounter, actorId);
  if (!actor) return;
  const beside = fight.encounter.combatants.some(
    (one) =>
      one.side !== actor.side &&
      rulesetCombatStanding(one) &&
      !!rulesetPositionOf(one) &&
      !!rulesetPositionOf(actor) &&
      rulesetGap(one, actor) <= 1,
  );
  const first = (beside ? standard("disengage") : undefined) ?? standard("dash");
  if (first) applyChoice(definition, state, fight, { actorId, optionId: first.id, targetIds: [] });
  for (let leg = 0; leg < 2; leg++) {
    const now = rulesetCombatant(fight.encounter, actorId);
    if (!now || rulesetAtBoardEdge(fight.encounter, now)) break;
    const to = rulesetEdgeCell(definition, fight.encounter, actorId);
    if (!to) break;
    if (applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to }).refused)
      break;
  }
}

/** Every cell of the board's edge a running creature leaves by (1.762): its sides, and on a shaped
 *  board (2026-10-24) its outline too, the cells beside one off the map. */
function rulesetExitCells(grid: TacticalGrid): Array<{ x: number; y: number }> {
  const outside = grid.outside;
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      if (outside?.[y]?.[x]) continue;
      const side = x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
      const rim = !!outside && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => outside[y + dy]?.[x + dx] === true));
      if (side || rim) cells.push({ x, y });
    }
  return cells;
}

/** How far each cell walks to the board's edge, for one running: nothing on it, and a walk ending
 *  beside it one step more, so that a creature next to the edge still has a step to take. */
function rulesetExitDistances(encounter: RulesetEncounterState, actor: RulesetCombatant): Map<string, number> {
  const grid = encounter.board!.grid;
  const exits = rulesetExitCells(grid);
  const on = new Set(exits.map((cell) => `${cell.x},${cell.y}`));
  const walked = rulesetWalkingDistances(grid, exits, actor);
  return new Map([...walked].map(([key, cost]) => [key, on.has(key) ? 0 : cost + 1]));
}

/** Whether a running creature has any way left to the edge: at it already, or a walk that gets there. */
function rulesetHasWayOut(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): boolean {
  if (!encounter.board?.grid || !rulesetPositionOf(actor) || rulesetAtBoardEdge(encounter, actor)) return true;
  const distances = rulesetExitDistances(encounter, actor);
  return rulesetFootprint(actor).some((cell) => Number.isFinite(distances.get(`${cell.x},${cell.y}`) ?? Infinity))
    ? rulesetEdgeCell(definition, encounter, actor.id) !== null
    : false;
}

/** The cell a running creature may walk to nearest the board's edge by the walk (1.762), furthest
 *  from its opponents among those as near: null when none is nearer the edge than where it stands.
 *  The way round counts, not the line: out of a cavern is back along its passage. */
function rulesetEdgeCell(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): { x: number; y: number } | null {
  const actor = rulesetCombatant(encounter, actorId);
  const from = rulesetPositionOf(actor);
  const grid = encounter.board?.grid;
  if (!actor || !from || !grid) return null;
  const span = rulesetSpanOf(actor);
  const distances = rulesetExitDistances(encounter, actor);
  const edge = (cell: { x: number; y: number }) =>
    Math.min(...rulesetFootprintAt(cell, span).map((one) => distances.get(`${one.x},${one.y}`) ?? Infinity));
  const foes = encounter.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && rulesetPositionOf(one),
  );
  const away = (cell: { x: number; y: number }) =>
    foes.length === 0 ? 0 : Math.min(...foes.map((foe) => rulesetGapFrom(cell, span, foe)));
  let best: { cell: { x: number; y: number }; edge: number; away: number } | null = null;
  const here = edge(from);
  for (const cell of rulesetWalkableCells(definition, encounter, actorId)) {
    const near = edge(cell);
    if (!Number.isFinite(near) || near >= here) continue;
    const far = away(cell);
    if (!best || near < best.edge || (near === best.edge && far > best.away))
      best = { cell: { x: cell.x, y: cell.y }, edge: near, away: far };
  }
  return best?.cell ?? null;
}

/**
 * Up on a steed it called (class pass 2026-10-24: a Find Steed warhorse never ridden), at the start of
 * its turn, when the steed is faster than it is and no opponent is within a walk of it: it rides to
 * the fight instead of trudging there. Never on somebody else's beast, and never once a foe is close
 * enough to walk to, since a controlled mount gives up its own blows.
 */
function mountUp(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  const encounter = fight.encounter;
  const actor = rulesetCombatant(encounter, actorId);
  if (!actor || actor.mountedOn || !rulesetPositionOf(actor)) return;
  const option = rulesetCombatOptions(definition, encounter, actorId).find((one) => {
    if (!one.id.startsWith(RULESET_MOUNT_OPTION_PREFIX)) return false;
    const mount = rulesetCombatant(encounter, one.id.slice(RULESET_MOUNT_OPTION_PREFIX.length));
    return mount?.calledBy === actorId && mount.speed > actor.speed;
  });
  if (!option) return;
  const span = rulesetSpanOf(actor);
  const foes = encounter.combatants.filter(
    (one) => one.side !== actor.side && rulesetCombatStanding(one) && rulesetPositionOf(one),
  );
  if (foes.length === 0) return;
  const cells = [rulesetPositionOf(actor)!, ...rulesetWalkableCells(definition, encounter, actorId)];
  if (cells.some((cell) => foes.some((foe) => rulesetGapFrom(cell, span, foe) <= 1))) return;
  applyChoice(definition, state, fight, { actorId, optionId: option.id, targetIds: [] });
}

/**
 * A free trait of its own taken before its first attack of the turn (1.606), when what it is about
 * to do is a melee weapon attack: a berserker's or a minotaur's Reckless, landing on itself.
 */
function takeBeforeMelee(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
  choice: RulesetCombatChoice,
): void {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const blow = actor?.actions.find((one) => one.id === choice.optionId);
  const target = choice.targetIds[0] ? rulesetCombatant(fight.encounter, choice.targetIds[0]) : undefined;
  if (!actor || !blow || !target || blow.toHit === undefined || blow.catalog || blow.area) return;
  if ((actor.flags.attacks ?? 0) > 0) return;
  if (rulesetBlowKind(fight.encounter, actor, target, blow) !== "melee") return;
  for (const option of rulesetCombatOptions(definition, fight.encounter, actorId)) {
    const own = actor.actions.find((one) => one.id === option.id);
    if (!own?.free || !own.beforeAttack || own.targets.side !== "self") continue;
    // Only where it gains more than it lays it open to: no Reckless Attack for one about to drop
    // among several foes. One the picker cannot read is taken, as it always was.
    const gain = definition.combat
      ? rulesetBoostWorth(definition, definition.combat, fight.encounter, actor, own, actor)
      : 0;
    if (gain < 0) continue;
    applyChoice(definition, state, fight, { actorId, optionId: option.id, targetIds: [actorId] });
  }
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

/**
 * Out of a lasting area or aura that strikes it where it stands (re-test 2026-10-24: a cleric at 8
 * health stood up in Spirit Guardians and ended her turn there, one step from its edge): with nothing
 * worth doing, it steps to the cell it can reach that the areas strike least, an opportunity blow
 * drawn counting against a cell, and the danger there breaking ties. False when no cell is better.
 */
function stepOutOfHarm(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const actor = rulesetCombatant(fight.encounter, actorId);
  const home = rulesetPositionOf(actor);
  if (!actor || !home || !fight.encounter.board?.grid) return false;
  const here = rulesetZoneHarmAt(fight.encounter, actor, home);
  if (here <= 0) return false;
  let best: { cell: { x: number; y: number }; harm: number; provokes: number; danger: number } | null = null;
  for (const cell of rulesetWalkableCells(definition, fight.encounter, actorId)) {
    const harm = rulesetZoneHarmAt(fight.encounter, actor, cell);
    if (harm >= here) continue;
    const provokes = cell.provokes.length;
    const danger = rulesetDangerAt(definition, fight.encounter, actor, cell);
    if (
      !best ||
      harm < best.harm ||
      (harm === best.harm && (provokes < best.provokes || (provokes === best.provokes && danger < best.danger)))
    )
      best = { cell: { x: cell.x, y: cell.y }, harm, provokes, danger };
  }
  if (!best) return false;
  if (
    applyChoice(definition, state, fight, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to: best.cell })
      .refused
  )
    return false;
  recordReasons(fight, actorId, [{ why: "leavesHarm" }]);
  return true;
}

/** Nothing in reach: close the distance, sprinting first when the ruleset has a sprint and the
 *  actor has nothing else to spend its turn on. False when there is nowhere better to stand, which
 *  is what ends the turn rather than shuffling on the spot. */
function walkTowardsTrouble(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
  leash?: RulesetLeash,
  /** Toward this one only, not the nearest opponent. */
  toward?: string,
  /** Whether to say why on the debug log: it closed on the nearest opponent, or on `toward`. */
  explain = true,
): boolean {
  if (!fight.encounter.board?.grid) return false;
  const actor = rulesetCombatant(fight.encounter, actorId);
  if (!actor || (actor.movementLeft ?? 0) < 1) return false;
  const closing = rulesetClosingMove(definition, fight.encounter, actorId, leash, toward);
  if (!closing) return false;
  const walked = (sprinted: boolean): boolean => {
    if (explain) {
      const after = rulesetCombatant(fight.encounter, actorId);
      const nearest = toward ?? (after ? rulesetApproachedOpponent(fight.encounter, after)?.id : undefined);
      recordReasons(fight, actorId, [
        toward
          ? { why: "pressCaster", targetId: toward }
          : { why: "approach", ...(nearest ? { targetId: nearest } : {}), ...(sprinted ? { sprinted: true } : {}) },
        ...(closing.spread ? [{ why: "spread" as const }] : []),
      ]);
    }
    return true;
  };
  // A walk that stops with movement to spare (at the end of a guard's leash, or already beside the
  // opponent) gains nothing from a sprint, which would only be the turn's action thrown away.
  const sprint =
    (definition.combat?.standard ?? []).includes("dash") &&
    !actor.flags.dashed &&
    (closing.walked === undefined || closing.walked >= (actor.movementLeft ?? 0));
  if (sprint) {
    // On another budget where an ability of its own grants one (a monk's Step of the Wind, a rogue's
    // Cunning Action), so the turn's action is left for whoever the walk reaches (class re-test
    // 2026-10-24: never once used).
    const granted = rulesetCombatOptions(definition, fight.encounter, actorId).find(
      (option) => option.kind === "standard" && !!option.grantedBy && rulesetStandardName(option.id) === "dash",
    );
    const sprinted = applyChoice(definition, state, fight, {
      actorId,
      optionId: granted?.id ?? "standard:dash",
      targetIds: [],
    });
    // A sprint the rules refused costs nothing: the walk below happens either way.
    if (!sprinted.refused) {
      const again = rulesetClosingMove(definition, fight.encounter, actorId, leash, toward);
      if (again && !applyChoice(definition, state, fight, again.choice).refused) return walked(true);
      // The longer walk would not go: the one it had before the sprint, and if not even that, it
      // says so rather than spend its turns sprinting on the spot (laptop playtest 2026-10-23: a
      // boss "dashes" every round and never left her corner).
      if (!applyChoice(definition, state, fight, closing.choice).refused) return walked(true);
      if (explain) recordReasons(fight, actorId, [{ why: "noWay" }]);
      logger.warn(
        "[game/combat:ruleset] %s sprinted and could not walk to %o",
        actorId,
        again?.choice.to ?? closing.choice.to ?? null,
      );
      return false;
    }
  }
  return !applyChoice(definition, state, fight, closing.choice).refused && walked(false);
}

/**
 * The opponent its walk closed on, for a reason that names whom it walked toward: the one nearest by
 * the walk still left to reach any cell they fill, which is how the closing move chose its cell, so a
 * wall between them or a big foe's reach counts as it did there.
 */
function rulesetApproachedOpponent(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant,
): RulesetCombatant | undefined {
  const grid = encounter.board?.grid;
  if (!grid || !rulesetPositionOf(actor)) return undefined;
  const mine = rulesetFootprint(actor);
  let best: { one: RulesetCombatant; gap: number } | undefined;
  for (const one of encounter.combatants) {
    if (one.side === actor.side || !rulesetPositionOf(one) || !rulesetCombatStanding(one)) continue;
    const walking = rulesetWalkingDistances(grid, rulesetFootprint(one), actor);
    const gap = Math.min(...mine.map((cell) => walking.get(`${cell.x},${cell.y}`) ?? Infinity));
    if (gap < (best?.gap ?? Infinity)) best = { one, gap };
  }
  return best?.one;
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
  /** Told whether anything on the list is worth doing this turn (see below). */
  worthy?: (any: boolean) => void,
): CombatDecisionOption[] {
  const actor = rulesetCombatant(encounter, actorId);
  // Never a walk that ends where somebody stands (laptop playtest 2026-10-25: a war-chief offered only
  // walks onto his own archer's cell, and the fight stood on his turn).
  const candidates = (
    menu
      ? rulesetCandidatesFrom(definition, encounter, actorId, null, menu)
      : withRulesetPlanMemo(() => rulesetCandidates(definition, encounter, actorId, true))
  ).filter((candidate) => !candidate.action.to || !rulesetCellTakenFor(encounter, actor, candidate.action.to));
  const worth = (candidate: (typeof candidates)[number]) =>
    (candidate.damage ?? 0) + (candidate.healing ?? 0) + (candidate.support ?? 0) + (candidate.setup ?? 0);
  const ending = candidates.filter((candidate) => candidate.action.option.kind === "end-turn");
  const rest = candidates
    .filter((candidate) => candidate.action.option.kind !== "end-turn")
    .sort((a, b) => worth(b) - worth(a))
    .slice(0, Math.max(0, RULESET_WINDOW_CANDIDATE_LIMIT - ending.length));
  // Readying, hiding or dodging is no reason not to walk toward the fight: only a blow, a spell or
  // anything else of its own that does somebody some good from where it can get to this turn.
  worthy?.(
    candidates.some(
      (candidate) => worth(candidate) > 0 && !["standard", "move", "end-turn"].includes(candidate.action.option.kind),
    ),
  );
  return [...rest, ...ending].map((candidate, index) => decisionOptionOf(candidate, actorId, String(index)));
}

/** Whether a Game Master's decision open now is one a window waiting on somebody else stands over:
 *  it is put away rather than asked (see `settled`). */
export function rulesetDecisionUnderWindow(state: CombatDirectorState): boolean {
  const waiting = state.rulesetFight?.encounter.window?.waiting[0];
  return !!waiting && !!state.window && state.window.actorId !== waiting;
}

/** Whether a walk ending at `cell` would stand `actor` where somebody else is: anybody still in the
 *  fight, up or down, or a prisoner, who fills one of the cells it would fill. */
export function rulesetCellTakenFor(
  encounter: RulesetEncounterState,
  actor: RulesetCombatant | undefined,
  cell: { x: number; y: number },
): boolean {
  if (!actor) return false;
  const lands = new Set(rulesetFootprintAt(cell, rulesetSpanOf(actor)).map((at) => `${at.x},${at.y}`));
  return encounter.combatants.some(
    (other) =>
      other.id !== actor.id &&
      (!other.defeated || !!other.away?.surrendered) &&
      !other.insideOf &&
      !other.mountedOn &&
      rulesetFootprint(other).some((at) => lands.has(`${at.x},${at.y}`)),
  );
}

/** One candidate as a Game Master's decision offers it. */
function decisionOptionOf(
  candidate: CombatAiCandidate<RulesetCandidate>,
  actorId: string,
  id: string,
): CombatDecisionOption {
  return {
    id,
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
  };
}

/**
 * The Engine's own top picks for a Game Master's turn (re-test 9 follow-up): its tactics' best three,
 * each marked on the decision's option with a short reason, and added to the options where the
 * shortlist left it out. The Game Master still chooses; this is what this Engine would have done.
 */
function suggestRulesetOptions(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
  options: CombatDecisionOption[],
  /** A window's own menu, when the decision is an answer to one rather than a whole turn. */
  menu?: RulesetCombatOption[],
): CombatDecisionOption[] {
  const ranked = rankRulesetChoices(definition, state, encounter, actorId, RULESET_SUGGESTION_COUNT, menu);
  const same = (option: CombatDecisionOption, candidate: CombatAiCandidate<RulesetCandidate>) => {
    const made = decisionOptionOf(candidate, actorId, option.id);
    return (
      JSON.stringify({ ...made, kind: undefined }) ===
      JSON.stringify({ ...option, kind: undefined, suggested: undefined })
    );
  };
  const out = options.map((option) => ({ ...option }));
  ranked.forEach(({ candidate, parts }, rank) => {
    let option = out.find((one) => same(one, candidate));
    if (!option) {
      option = decisionOptionOf(candidate, actorId, String(out.length));
      out.push(option);
    }
    option.suggested = { rank: rank + 1, reason: rulesetSuggestionReason(encounter, candidate, parts) };
  });
  return out;
}

/** A blow's edge on its target, in a few words for a Game Master. */
const RULESET_EDGE_SAID: Record<RulesetBlowEdge["way"], (type: string, target: string) => string> = {
  vulnerable: (type, target) => `${target} takes double from ${type}`,
  stops: (type, target) => `${type} stops ${target} regenerating`,
  suits: (type, target) => `its extra ${type} is dealt to what ${target} is`,
};

/** How many of the Engine's own picks a Game Master is shown. */
const RULESET_SUGGESTION_COUNT = 3;

/** Why the Engine would pick this, in a few words: the biggest parts of its score, largest first. */
function rulesetSuggestionReason(
  encounter: RulesetEncounterState,
  candidate: CombatAiCandidate<RulesetCandidate>,
  parts: CombatAiScoreParts,
): string {
  const nameOf = (id: string | undefined) => (id ? (rulesetCombatant(encounter, id)?.name ?? id) : "");
  const target = nameOf(candidate.targetId);
  const option = candidate.action.option;
  const actorSide = rulesetCombatant(encounter, candidate.action.choice.actorId)?.side;
  const friend =
    !!candidate.targetId &&
    actorSide !== undefined &&
    rulesetCombatant(encounter, candidate.targetId)?.side === actorSide;
  const said: Record<keyof CombatAiScoreParts, () => string> = {
    damage: () => {
      const edge = candidate.action.edge;
      const average = option.forecast?.averageDamage;
      const chance = option.forecast?.hitChance;
      return `${(candidate.damage ?? 0) >= 0.5 ? "heavy" : (candidate.damage ?? 0) >= 0.2 ? "solid" : "some"} damage${
        target ? ` to ${target}` : ""
      }${average !== undefined ? ` (about ${Math.round(average)} damage${chance !== undefined ? `, ${Math.round(chance * 100)}% to hit` : ""})` : ""}${
        edge ? `, ${RULESET_EDGE_SAID[edge.way](edge.damageType, target || "its target")}` : ""
      }`;
    },
    finish: () => `likely takes ${target || "its target"} out of the fight`,
    healing: () => `heals ${target || "a friend"}`,
    support: () => `helps ${target || "its side"}`,
    setup: () => `sets up what comes next (a condition, a broken concentration, a better position)`,
    risk: () => "puts itself in danger",
    cost: () =>
      `spends ${option.cost?.length ? option.cost.map((one) => `${one.amount} ${one.label}`).join(", ") : "a limited use"}`,
    protection: () => "stands up for a friend under attack",
    coordination: () => `joins its side's attack${target ? ` on ${target}` : ""}`,
    focus: () =>
      friend
        ? `${target} is the one of its side most in need`
        : `${target || "its target"} is the one it most wants down`,
  };
  const reasons = (Object.entries(parts) as Array<[keyof CombatAiScoreParts, number]>)
    .filter(([, part]) => Math.abs(part) >= 0.05)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([key]) => said[key]());
  if (candidate.action.to) reasons.push(`after walking to ${candidate.action.to.x},${candidate.action.to.y}`);
  if (reasons.length) return reasons.join("; ");
  return option.kind === "end-turn" ? "nothing offered is worth what it costs right now" : "the best of what is left";
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
  const shortlist = windowOptions(definition, fight.encounter, actorId, menu);
  if (shortlist.length <= 1) return false;
  const options = suggestRulesetOptions(definition, state, fight.encounter, actorId, shortlist, menu);
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
  /** The first decision of its turn, before it has done anything: told whether it walked first, and
   *  then its turn is settled here when there is nothing left to ask. */
  turnStart?: { walked?: boolean },
): boolean {
  // Never over a window still waiting on somebody: their question comes first.
  if (fight.encounter.window) return false;
  const seen = { worthy: true };
  let shortlist = windowOptions(definition, fight.encounter, actorId, undefined, (worthy) => (seen.worthy = worthy));
  // Nobody in its reach and nothing it could do from anywhere it can walk to: it closes on the
  // nearest opponent first, sprinting if the walk needs it, as the Engine's own opponents do, and is
  // asked what to do from there (laptop playtest 2026-10-24: a war-chief offered only readying,
  // hiding and dodging readied three rounds running against a party seven squares off).
  if (turnStart && !seen.worthy) {
    const actor = rulesetCombatant(fight.encounter, actorId);
    const unit = state.enemies.find((one) => one.id === actorId);
    const leash = actor && unit ? rulesetTerritoryLeash(definition, fight.encounter, actor, unit) : undefined;
    if (walkTowardsTrouble(definition, state, fight, actorId, leash)) {
      turnStart.walked = true;
      if (rulesetEncounterOutcome(fight.encounter) !== "ongoing" || fight.encounter.window) return false;
      if (currentRulesetActor(fight.encounter)?.id !== actorId) return false;
      shortlist = windowOptions(definition, fight.encounter, actorId);
      // The walk was all it had left: its turn ends there.
      if (shortlist.length <= 1) {
        advanceTurn(definition, state, fight);
        return false;
      }
    }
  }
  // Nothing but the end of the turn left: there is no decision worth a model call.
  if (shortlist.length <= 1) return false;
  const options = suggestRulesetOptions(definition, state, fight.encounter, actorId, shortlist);
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
  // What it did opened a window (a blow that hurt somebody who may answer): that is answered first,
  // and a decision of its own opened over it would hide the question from the player who is asked
  // (laptop playtest 2026-10-25: Mara's Hellish Rebuke never drew, and the fight stood on Grak).
  if (fight.encounter.window) {
    answerRulesetWindows(definition, state, fight);
    if (fight.encounter.window) return;
  }
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

  // Setting the party down before the first turn (2026-10-24): only that, the way out and who plays
  // whom while it lasts.
  if (command.type === "deploy" || command.type === "deployed") {
    if (!fight.deploy) return refuse("The fight has already begun.", "ruleset_combat_deployed");
    if (command.type === "deployed") {
      rulesetBeginFight(fight);
      return settled(state);
    }
    const one = rulesetCombatant(fight.encounter, command.unitId);
    if (!one || !rulesetDeployers(state, fight).includes(one.id))
      return refuse(
        "Only a party member you play, whom the story has not placed, is set down by you.",
        "ruleset_combat_unknown-actor",
      );
    const to = command.to;
    if (!fight.deploy.cells.some((cell) => cell.x === to.x && cell.y === to.y))
      return refuse("That square is not where your side lines up.", "ruleset_combat_bad_cell");
    const grid = fight.encounter.board!.grid;
    const others = new Set(
      fight.encounter.combatants
        .filter((other) => other.id !== one.id && rulesetPositionOf(other))
        .flatMap((other) => rulesetFootprint(other))
        .map((cell) => `${cell.x},${cell.y}`),
    );
    if (
      rulesetFootprintAt(to, rulesetSpanOf(one)).some(
        (cell) => rulesetCellBlocked(grid, cell.x, cell.y) || others.has(`${cell.x},${cell.y}`),
      )
    )
      return refuse("Somebody or something is already there.", "ruleset_combat_bad_cell");
    one.x = to.x;
    one.y = to.y;
    return settled(state);
  }
  if (
    fight.deploy &&
    command.type !== "flee" &&
    command.type !== "control" &&
    command.type !== "controlCompanions" &&
    command.type !== "orders" &&
    command.type !== "spends" &&
    command.type !== "ammo"
  )
    return refuse("Set the party down and begin the fight first.", "ruleset_combat_deploying");

  if (command.type === "flee") {
    state.outcome = "flee";
    fight.encounter = settleRulesetFledFight(definition, fight.encounter, rollerFor(fight)).state;
    return settled(state);
  }

  // Given up to opponents who are all honourable (combat AI T6): they take the party alive.
  if (command.type === "yield") {
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    if (!rulesetPartyMayYield(state, fight.encounter))
      return refuse("Only honourable opponents accept a surrender.", "ruleset_combat_no_yield");
    state.outcome = "defeat";
    state.yielded = true;
    // What only meant something inside it comes off, as every other ending takes it.
    fight.encounter = settleRulesetFledFight(definition, fight.encounter, rollerFor(fight)).state;
    // Said in the fight's own log, so a surrender never reads as a wipe (re-test 14).
    record(fight, [{ type: "outcome", outcome: "defeat", yielded: true }]);
    return settled(state);
  }

  if (command.type === "spends") {
    if (!rulesetCombatIsSymbol(definition.combat)) {
      return refuse("Only a fight in symbol dice has spends to choose.", "ruleset_combat_no_spends");
    }
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    if (command.choose) fight.chooseSpends = true;
    else delete fight.chooseSpends;
    return settled(state);
  }

  if (command.type === "control") {
    const combatant = rulesetCombatant(fight.encounter, command.unitId);
    if (!combatant || combatant.side !== "party") {
      return refuse("Only a party member has a controller.", "ruleset_combat_unknown-actor");
    }
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    fight.controllers[combatant.id] = command.controller;
    // The party panel reads the unit's own controller: said at once, not at the next turn.
    syncRulesetCombatants(definition, state);
    return settled(state);
  }

  if (command.type === "controlCompanions") {
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    for (const id of rulesetCompanionIds(state, fight)) fight.controllers[id] = command.controller;
    syncRulesetCombatants(definition, state);
    return settled(state);
  }

  if (command.type === "orders") {
    const unit = state.party.find((one) => one.id === command.unitId);
    const combatant = rulesetCombatant(fight.encounter, command.unitId);
    if (!unit || !combatant || combatant.side !== "party")
      return refuse("Only a companion takes orders.", "ruleset_combat_unknown-actor");
    const charge = command.orders?.protectId;
    if (charge !== undefined) {
      const one = rulesetCombatant(fight.encounter, charge);
      if (!one || one.side !== "party" || one.id === combatant.id)
        return refuse("A companion protects somebody else of the party.", "ruleset_combat_unknown-actor");
    }
    if (command.orders) unit.orders = command.orders;
    else delete unit.orders;
    return settled(state);
  }

  // Which stack a weapon shoots first (2026-10-26): the fighter's own choice at any time, costing nothing.
  if (command.type === "ammo") {
    const combatant = rulesetCombatant(fight.encounter, command.unitId);
    if (!combatant || combatant.side !== "party")
      return refuse("Only a party member chooses their ammunition.", "ruleset_combat_unknown-actor");
    if (!rulesetChooseAmmo(combatant, command.weapon, command.stack))
      return refuse("That weapon cannot shoot that.", "ruleset_combat_no_ammo");
    return settled(state);
  }

  const actor = currentRulesetActor(fight.encounter);
  if (!actor) return refuse("Nobody is on turn.", "ruleset_combat_unknown-actor");
  const controller = rulesetController(state, fight, actor);

  // A carried weapon or shield taken in hand on its holder's own turn (2026-10-26), for the turn's one
  // free interaction: the fewest weapons in its way are put away, and the menu is read again.
  if (command.type === "draw") {
    if (state.window || fight.encounter.window)
      return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    if (command.unitId !== actor.id || controller !== "manual")
      return refuse("This turn is not yours to play.", "ruleset_combat_not-your-turn");
    if (!rulesetCombatStanding(actor) || actor.surprised)
      return refuse("They cannot act right now.", "ruleset_combat_cannot-act");
    const drawn = rulesetDrawInHand(definition, actor, command.item);
    if (!drawn.ok) {
      const name = actor.sheet?.items?.[command.item]?.name ?? "That";
      if (drawn.reason === "slots-full")
        return refuse(
          drawn.by.length
            ? `${name} cannot be taken in hand: its slots are held by ${drawn.by.join(", ")}.`
            : `${name} cannot be taken in hand: there are too few of the slots it takes.`,
          "ruleset_combat_slots_full",
        );
      if (drawn.reason === "interaction-spent")
        return refuse(
          "The turn's free interaction with an object is already spent.",
          "ruleset_combat_interaction_spent",
        );
      return refuse("That is nothing they carry to take in hand.", "ruleset_combat_not_carried");
    }
    record(fight, [drawn.event]);
    syncRulesetCombatants(definition, state);
    return settled(state);
  }

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
      ...(command.dispel ? { dispel: command.dispel } : {}),
      ...(command.cut ? { cut: command.cut } : {}),
      ...(command.storesIn ? { storesIn: command.storesIn } : {}),
      ...(command.ends?.length ? { ends: command.ends } : {}),
      ...(command.carries?.length ? { carries: command.carries } : {}),
      ...(command.designates?.length ? { designates: command.designates } : {}),
      ...(command.kinds?.length ? { kinds: command.kinds } : {}),
      ...(command.amount !== undefined ? { amount: command.amount } : {}),
      ...(command.rises !== undefined ? { rises: command.rises } : {}),
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
    // Its debug log says the Game Master chose, and which of the Engine's suggestions it took, so a
    // turn it played is not one with no why (laptop playtest 2026-10-24).
    const first = open.options.find((option) => option.suggested?.rank === 1);
    // The same choice as the first, written twice (laptop level-4 pass 2026-10-26: "chose it over the
    // Engine's first choice, Maul Smash on Garrick Thorne", 21 times, for that very Maul Smash): taken as it.
    const same =
      !!first &&
      !!chosen &&
      (first === chosen ||
        (first.label === chosen.label && first.targetId === chosen.targetId && first.kind === chosen.kind));
    const gmPick: DirectedRulesetReason[] = chosen
      ? [
          {
            why: "gmPick",
            ...(same ? { rank: 1 } : chosen.suggested ? { rank: chosen.suggested.rank } : {}),
            ...(first && !same && first.label
              ? {
                  over: {
                    label: first.label,
                    ...(first.targetId ? { targetId: first.targetId } : {}),
                    // Said as such, not as "End turn" (laptop pass 6 2026-10-26).
                    ...(first.kind === "wait" ? { ends: true as const } : {}),
                  },
                }
              : {}),
          },
        ]
      : [];
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
      recordReasons(fight, actorId, gmPick);
      answerRulesetWindows(definition, state, fight);
      return settled(state);
    }
    // A pick that walks onto somebody now (the board moved under the question) is the local
    // picker's to answer instead, said in the log, so the turn is played rather than lost.
    const blocked =
      !!chosen?.to && rulesetCellTakenFor(fight.encounter, rulesetCombatant(fight.encounter, actorId), chosen.to);
    if (blocked) {
      logger.warn(
        "[game/combat:ruleset] A %s decision for %s walked onto an occupied cell (%d,%d); the Engine's own pick plays it",
        source,
        actorId,
        chosen!.to!.x,
        chosen!.to!.y,
      );
    }
    const picked = chosen && !blocked ? null : pickRulesetChoice(definition, state, fight.encounter, actorId);
    const walkTo = chosen && !blocked ? chosen.to : picked?.to;
    const choice: RulesetCombatChoice | null =
      chosen && !blocked
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
      logger.warn(
        "[game/combat:ruleset] A %s decision for %s could not walk to (%d,%d) and the turn was ended",
        source,
        actorId,
        walkTo.x,
        walkTo.y,
      );
      // A blow on the way may have opened a window: it is answered, and the turn ends once it closes.
      answerRulesetWindows(definition, state, fight);
      if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
      return settled(state);
    }
    // The menu's own "end turn" IS the end of the turn, exactly as the local picker reads it. Asking
    // again would reopen the same window with the same list, and the fight would stand on this actor
    // for as long as the answer stayed the same.
    if (!choice || choice.optionId === "end-turn") {
      recordReasons(fight, actorId, gmPick);
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
    recordReasons(fight, actorId, gmPick);
    continueBossTurn(definition, state, fight, actorId);
    return settled(state);
  }

  // `continue`: one whole turn of whoever the player is not playing. A decision still open waits for
  // its answer, unless a window waiting on somebody else stands over it, which puts it away.
  if (state.window) return settled(state);
  // A window comes first: the turn behind it is standing still, and everybody in it who is not a
  // person's to play answers here. One that is theirs is left for them to answer.
  if (fight.encounter.window) {
    answerRulesetWindows(definition, state, fight);
    // Still standing means it is somebody's own to answer, and no amount of asking again moves it.
    return settled(state);
  }
  if (controller === "manual") return settled(state);
  if (controller === "gm") {
    const start: { walked?: boolean } = {};
    if (openRulesetWindow(definition, state, fight, actor.id, start)) return { ok: true };
    // It walked toward the fight and then had nothing to ask about, or the walk ended its turn.
    if (start.walked) return settled(state);
  }
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
    "targets-apart": "The ones picked stand too far from each other, or from the first one picked, for this.",
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
