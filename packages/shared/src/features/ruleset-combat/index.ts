// Ruleset combat: a fight resolved by the ruleset's own numbers.
//
// Pure, deterministic and free of I/O, like the tactical engine beside it: every die comes through
// an injected roller, nothing throws, and the state is a plain object a later slice can persist as
// JSON and read back exactly. It knows nothing about routes, sessions, sheets on disk or React.
//
// A party member reads their numbers from the ruleset sheet through the sheet's own helpers and
// writes every change back through `applyRulesetSheetOp`, so the fight and the sheet keep one
// record: hit points, resources, conditions and what a character is concentrating on are the same
// values during the battle and after it. An opponent is a stat block, and lives in the encounter.
//
// What this slice deliberately leaves for the ones after it, with the seams already in place:
//   - positions, distance, reach, ranges and movement. `economy.movement`, a block's `reach` and
//     `range`, and the condition effects that read distance are carried and not read.
//   - reactions and the windows they open, so `cannot-react` is carried and not read, and a catalog
//     entry marked `reaction` is left off the menu.
//   - bestiary stat blocks, multiattack, recharge and the threat tier clamp: `combat.threat` is
//     validated here and read there, and blocks are written by hand until then.
//   - who an opponent chooses to attack. Everything an enemy could do is on the same menu a player
//     picks from, which is what the enemy's own turn will read.

export * from "./types.js";
export {
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetCombatDice,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatHealth,
  rulesetCombatRoller,
  rulesetCombatStanding,
  type RulesetEncounterInput,
} from "./encounter.js";
export {
  planRulesetCombatCost,
  rulesetAttackMode,
  rulesetAverageAmount,
  rulesetCombatOptions,
  rulesetCostSteps,
  rulesetHitChance,
  rulesetPoolFamily,
  rulesetStandardBudget,
  type RulesetCombatCost,
} from "./options.js";
export {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
} from "./resolve.js";
