import type { SkillCheckResult } from "../types/game.js";

export function getSkillCheckOutcomeLabel(
  result: Pick<SkillCheckResult, "success" | "criticalSuccess" | "criticalFailure">,
): string {
  if (result.criticalSuccess) return "Critical success";
  if (result.criticalFailure) return "Critical failure";
  return result.success ? "Success" : "Failure";
}

export function getSkillCheckOutcomeKey(
  result: Pick<SkillCheckResult, "success" | "criticalSuccess" | "criticalFailure">,
): string {
  if (result.criticalSuccess) return "critical_success";
  if (result.criticalFailure) return "critical_failure";
  return result.success ? "success" : "failure";
}

/**
 * Whether the dice literally sum to the total, so a "a + b + c = total"
 * breakdown is a true statement.
 *
 * False for advantage/disadvantage (only one die counts) and for pool systems
 * that count successes rather than add pips. Callers must not render an
 * addition unless this holds — the alternative is a card that asserts
 * arithmetic nobody performed. Deliberately checks the numbers instead of
 * asking which rules system is in play, so systems the engine has never heard
 * of still display honestly.
 */
export function skillCheckDiceSumToTotal(
  result: Pick<SkillCheckResult, "rolls" | "modifier" | "total" | "resolution">,
): boolean {
  return (
    result.resolution === "sum" && result.rolls.reduce((sum, roll) => sum + roll, 0) + result.modifier === result.total
  );
}

export function formatSkillCheckResultSummary(result: SkillCheckResult): string {
  const modifier = result.modifier === 0 ? "" : ` ${result.modifier > 0 ? "+" : ""}${result.modifier}`;
  const rollMode = result.rollMode !== "normal" ? ` (${result.rollMode})` : "";
  // Only claim the dice add up to the total when they actually do; otherwise
  // report the total on its own so the GM reads back what the player saw.
  const arithmetic = skillCheckDiceSumToTotal(result)
    ? `[${result.rolls.join(", ")}]${modifier}${rollMode} = ${result.total}`
    : `[${result.rolls.join(", ")}]${result.resolution === "successes" ? "" : modifier}${rollMode} → ${result.total}${result.resolution === "successes" ? ` ${result.total === 1 ? "success" : "successes"}` : ""}`;
  return `${result.skill} check (DC ${result.dc}): ${arithmetic}. ${getSkillCheckOutcomeLabel(result)}.`;
}

function serializeSkillCheckAttribute(value: string): string {
  return value.replace(/["\r\n]/g, "'").trim();
}

/**
 * The request half of a check tag, with no numbers claimed for it.
 *
 * This is what a resolution failure has to be able to write. When the roll
 * cannot happen — the chat's modifiers will not load, say — the turn still has
 * to be saved, and the one thing that must never be saved is the model's own
 * `rolls=`/`total=`/`result=` on a check nobody rolled: that invention is read
 * back as fact next turn, which is the entire dishonesty the engine took the die
 * away to end. So the numbers are dropped and the ask is kept.
 *
 * Nothing here is invented in their place. Only what the GM declared and this
 * reader vouched for is written back: the skill, the DC, the mode when one was
 * declared, the player's own die when they rolled it, the dice label when the GM
 * wrote one. Re-reading the result yields the same request and the same
 * `isEngineRollableSkillCheckTag` verdict, so the check is still owed a roll and
 * the client's fallback can still ask for one.
 */
export function serializeSparseSkillCheckTag(request: {
  skill: string;
  dc: number;
  advantage?: boolean;
  disadvantage?: boolean;
  preRolledD20?: number;
  declaredDice?: string;
}): string {
  const parts = [`[skill_check: skill="${serializeSkillCheckAttribute(request.skill)}"`, `dc="${request.dc}"`];
  if (request.preRolledD20 != null) parts.push(`rolls="${request.preRolledD20}"`);
  if (request.advantage && !request.disadvantage) parts.push(`mode="advantage"`);
  else if (request.disadvantage && !request.advantage) parts.push(`mode="disadvantage"`);
  if (request.declaredDice) parts.push(`dice="${serializeSkillCheckAttribute(request.declaredDice)}"`);
  return `${parts.join(" ")}]`;
}

export function serializeResolvedSkillCheckTag(result: SkillCheckResult): string {
  return [
    `[skill_check: skill="${serializeSkillCheckAttribute(result.skill)}"`,
    `dc="${result.dc}"`,
    `rolls="${result.rolls.join("|")}"`,
    `used="${result.usedRoll}"`,
    `modifier="${result.modifier}"`,
    `total="${result.total}"`,
    `result="${getSkillCheckOutcomeKey(result)}"`,
    `mode="${result.rollMode}"`,
    `resolution="${result.resolution}"`,
    `dice="${serializeSkillCheckAttribute(result.dice ?? "1d20")}"]`,
  ].join(" ");
}
