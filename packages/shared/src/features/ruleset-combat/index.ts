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
// a bestiary catalog, and lives in the encounter.
//
// A fight is POSITIONED when the ruleset says what one cell of a board is worth (`combat.distance`)
// and the caller hands `createRulesetEncounter` a board with a cell for everybody. Then, and only
// then, movement, reach, ranges, areas, line of sight, cover and strikes at somebody walking away
// mean something, and every one of them is a number the ruleset itself declared. A fight without a
// board is exactly the fight it was before any of this existed: nothing measures anything.
//
// What these slices deliberately leave for the ones after them, with the seams already in place:
//   - reactions and the WINDOWS they open. A strike at somebody leaving your reach is automatic
//     here and spends the declared budget; choosing whether to take it is a window, so
//     `cannot-react` is read for that strike and a catalog entry marked `reaction` is still left
//     off the menu.
//   - three-quarter and total cover, elevation, flying over obstacles, squeezing, hiding and
//     surprise, and movement forced on somebody by an attack.
//   - the WINDOW a signature action is bought in, between one turn and the next. The points, the
//     options and the spending are here; what opens the window is the slice that builds reactions.
//   - who an opponent chooses to attack. Everything an enemy could do is on the same menu a player
//     picks from, which is what the enemy's own turn will read.

export * from "./types.js";
export {
  parseRulesetCombatDice,
  rollRulesetDice,
  rulesetAverageAmount,
  rulesetAverageDamage,
  rulesetCombatRoller,
} from "./dice.js";
export {
  clampRulesetStatBlock,
  findRulesetCreature,
  findRulesetCreatureEntry,
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatDamageKind,
  rulesetCombatFailsSave,
  rulesetCombatHealth,
  rulesetCombatStanding,
  rulesetMovementAllowance,
  rulesetSaveMode,
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
} from "./grid.js";
export {
  planRulesetCombatCost,
  rulesetActionAvailable,
  rulesetAimCells,
  rulesetAimLegal,
  rulesetAreaTargets,
  rulesetAttackMode,
  rulesetCombatOptions,
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
  RULESET_MOVE_OPTION,
  RULESET_STAND_OPTION,
  type RulesetCombatCost,
  type RulesetOptionReach,
} from "./options.js";
export {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
} from "./resolve.js";
