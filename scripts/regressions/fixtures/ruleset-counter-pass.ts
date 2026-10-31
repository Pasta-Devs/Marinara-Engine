/**
 * For tests written before an answer could itself be answered (counter-the-counter): a spell taken
 * in a window is held while the other side is asked about it. These pass every such question, so a
 * test about what the answer does reads it as it did, with the same dice.
 */
import {
  applyRulesetCombatChoice,
  RULESET_PASS_OPTION,
  type RulesetCombatRoller,
  type RulesetCombatStep,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

export function letAnswerThrough(
  definition: RulesetDefinition,
  step: RulesetCombatStep,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  let now = step;
  for (let guard = 0; guard < 16 && now.state.window?.resume?.kind === "answer"; guard++) {
    const window = now.state.window;
    const next = applyRulesetCombatChoice(
      definition,
      now.state,
      { actorId: window.waiting[0]!, optionId: RULESET_PASS_OPTION, targetIds: [], window: window.id },
      roller,
    );
    now = { state: next.state, events: [...now.events, ...next.events] };
  }
  return now;
}
