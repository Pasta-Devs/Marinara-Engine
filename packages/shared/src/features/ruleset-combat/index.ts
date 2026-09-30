// Ruleset combat: a fight resolved by the ruleset's own numbers.
//
// Pure, deterministic and free of I/O, like the tactical engine beside it: every die comes through
// an injected roller, nothing throws, and the state is a plain object a later slice can persist as
// JSON and read back exactly. It knows nothing about routes, sessions, sheets on disk or React.
//
// A party member reads their numbers from the ruleset sheet through the sheet's own helpers and
// writes every change back through `applyRulesetSheetOp`, so the fight and the sheet keep one
// record: hit points, resources, conditions and what a character is concentrating on are the same
// values during the battle and after it. An opponent is a stat block, written by hand or taken from
// a bestiary catalog, and lives in the encounter. A bestiary creature may carry a sheet in the
// ruleset's own terms, and is then built from it exactly as a party member is; that sheet lives in
// the encounter too and is written back nowhere.
//
// A fight is POSITIONED when the ruleset says what one cell of a board is worth (`combat.distance`)
// and the caller hands `createRulesetEncounter` a board with a cell for everybody. Then, and only
// then, movement, reach, ranges, areas, line of sight, cover and strikes at somebody walking away
// mean something, and every one of them is a number the ruleset itself declared. A fight without a
// board is exactly the fight it was before any of this existed: nothing measures anything.
//
// A fight can be HELD OPEN. A walk that leaves somebody's reach stops where it stands and asks
// them whether to strike; the turn between one actor and the next stops and asks every block with
// points whether to buy one of its own actions. While a window is open nothing else moves: only the
// one combatant it is asking may answer, with an option off `rulesetWindowOptions` or
// `RULESET_PASS_OPTION`, and the fight picks up exactly where it was held once the last of them
// has. The window lives in the state, so a fight saved mid-walk comes back with the same people
// still to ask and the same cells still to walk.
//
// A catalog entry may say WHICH moment it waits for, and then it is offered in the window that
// moment opens: `used` before somebody on the other side uses something it reaches, and `aimed`
// before something lands on its holder, where taking it may `cancel` what was held; `hit` after an
// attack roll has hit them and before its damage, where what they take counts for that attack and
// its roll is checked again; and `harmed` after something has hurt them, where nothing unmakes it.
// A creature's own action may wait for a moment too. What it costs is paid before anybody is
// asked, so a cancelled action is stopped from happening rather than from having been bought.
//
// A condition may change NUMBERS as well as switch effects on: its holder's defense, attack rolls,
// saves, contest checks and speed, each read where the number is used rather than written into the
// combatant. A level of a live track reads exactly like a condition while the track is high enough.
//
// What these slices deliberately leave for the ones after them, with the seams already in place:
//   - a chain of them. The fight keeps ONE window rather than a stack, so nothing opened inside a
//     window opens another: a counter cannot itself be countered, and a reaction that hurts
//     somebody opens no second moment.
//   - three-quarter and total cover, elevation, flying over obstacles, squeezing, hiding and
//     surprise, and movement forced on somebody by an attack.
//   - who an opponent chooses to attack. Everything an enemy could do is on the same menu a player
//     picks from, which is what the enemy's own turn will read.

export * from "./types.js";
export {
  applyRulesetFightItemChanges,
  rulesetAmmoLeft,
  rulesetFightItemChanges,
  rulesetLoaded,
  type RulesetFightItemChange,
} from "./ammo.js";
export {
  rulesetCombatAdvantage,
  rulesetCombatIsPool,
  rulesetCombatPenalty,
  rulesetDamageAverage,
  rulesetDamageTarget,
  rulesetPoolAverage,
  rulesetPoolChance,
  rulesetPoolDie,
  rulesetPoolDistribution,
  rulesetSoakOf,
  throwRulesetCombatPool,
  throwRulesetDamageDice,
  type RulesetCombatPoolThrow,
} from "./pool.js";
export {
  parseRulesetCombatDice,
  rollRulesetDice,
  rulesetAverageAmount,
  rulesetAverageDamage,
  rulesetCombatRoller,
} from "./dice.js";
export {
  fillRulesetSheetChoices,
  holdRulesetCombatant,
  holdRulesetSheetHealth,
  readProposedRulesetSheet,
  restrictRulesetSheetEntries,
} from "./hold.js";
export {
  clampRulesetStatBlock,
  findRulesetCreature,
  findRulesetCreatureEntry,
  isRulesetPlainStatBlock,
  rulesetBestiarySheetCatalogIds,
  rulesetProposedStatBlock,
  rulesetCreatureBlock,
  rulesetStatBlockFromCreature,
  rulesetTierStatBlock,
  RULESET_CLAMP_HEADROOM,
  RULESET_CLAMP_MAX_ACTIONS,
  type RulesetClampedStatBlock,
} from "./creatures.js";
export {
  createRulesetEncounter,
  currentRulesetActor,
  refreshRulesetMovement,
  rulesetActiveConditions,
  rulesetCheckMode,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatDamageKind,
  rulesetCombatFailsSave,
  rulesetCombatHealth,
  rulesetCombatHide,
  rulesetCombatStanding,
  rulesetConditionModifiers,
  rulesetInitiativeModifierNow,
  rulesetImmuneToCondition,
  rulesetInitiativeOrder,
  rulesetMovementAllowance,
  rulesetSaveMode,
  type RulesetActiveCondition,
  type RulesetConditionModifier,
  type RulesetEncounterInput,
} from "./encounter.js";
export {
  rulesetAreaCells,
  rulesetCellBlocked,
  rulesetCellCover,
  rulesetCellDistance,
  rulesetInCells,
  rulesetLineOfSight,
  rulesetOpportunityAttack,
  rulesetPositionOf,
  rulesetReachableCells,
  rulesetPushPath,
  rulesetWalkingDistances,
} from "./grid.js";
export {
  planRulesetCombatCost,
  rulesetActionAvailable,
  rulesetAimCells,
  rulesetAimLegal,
  rulesetAnswerDeflects,
  rulesetAreaTargets,
  rulesetAttackMode,
  rulesetBonusDice,
  rulesetCombatOptions,
  rulesetContestChance,
  rulesetContestCheck,
  rulesetContestHolder,
  rulesetCostSteps,
  rulesetCriticalFromAdjacent,
  rulesetDefenseAgainst,
  rulesetForbiddenTargets,
  rulesetFreeStrike,
  rulesetGrantedStandard,
  rulesetOptionReach,
  rulesetOptionTargets,
  rulesetHitChance,
  rulesetPoolFamily,
  rulesetProneCondition,
  rulesetSignatureOptions,
  rulesetStandCost,
  rulesetStandardBudget,
  rulesetStandardName,
  rulesetTargetRefusal,
  rulesetWithinSpendLimits,
  rulesetReactionPointsAtSource,
  rulesetReactionsAt,
  rulesetWindowMoment,
  rulesetWindowOptions,
  RULESET_MOVE_OPTION,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  type RulesetBonusDice,
  type RulesetCombatCost,
  type RulesetOptionReach,
} from "./options.js";
export {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  liftRulesetCrashes,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
} from "./resolve.js";
