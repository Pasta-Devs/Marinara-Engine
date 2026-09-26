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
  // A complication is alongside the outcome, never instead of it, so the outcome is still said first.
  const complication = result.complication ? " Something went wrong on the side." : "";
  return `${result.skill} check (DC ${result.dc}): ${arithmetic}. ${getSkillCheckOutcomeLabel(result)}.${complication}`;
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
/**
 * Attributes appended after everything a check tag has always carried.
 *
 * Both are optional and both render nothing when absent, so every shipped call site
 * writes the same bytes it has always written and no already-saved transcript changes
 * how it reads. `threshold=` used to be spliced onto the end of a finished tag by the
 * one caller that needed it; it is written here now so the two spellings cannot drift.
 */
export interface SkillCheckTagExtras {
  /** Per-die threshold for a success pool, when the GM declared a usable one. */
  threshold?: number;
  /** `pool="d20:1"` — the slot the engine actually spent, never the one the model claimed. */
  pool?: string;
  /** `who="Name"` — the party member a ruleset game rolled for. Written only by that path. */
  who?: string;
  /** `with="Ability"` — the ability a ruleset check rolled with instead of the skill's own. */
  with?: string;
  /** `bonus="+2"` — dice a pool ruleset added or took for this check. Written only by that path. */
  bonus?: number;
  /** `spend="willpower:1"` — what the check actually paid, never what the model asked to pay. */
  spend?: string;
  /** `auto="2"` — successes a spend added that nobody rolled, so a reader can tell them apart. */
  auto?: number;
  /** `use="Potence"` — the catalog entry the check actually applied, never one it could not. */
  use?: string;
  /** `rerolled="3"` — how many dice a bought re-throw replaced. */
  rerolled?: number;
  /** The wound penalty already applied by the Engine. */
  penalty?: number;
  /** `difficulty="Grim"` — the ladder step a sparse ask named. Only ever the ask: a rolled record
   *  says the numbers the step stood for instead. */
  difficulty?: string;
  /** `explode="9"` / `double="9"` — the face a pool check moved the rule to, or the ask for it. */
  explode?: number;
  double?: number;
  /** `complication="true"` — the roll went wrong on the side without botching outright. */
  complication?: boolean;
  /** `adjust="-2"` — what the sheet itself added to or took off the check. */
  adjust?: number;
  /** `reroll="rote"` — the standing re-throw the check applied, or the ask for one. */
  reroll?: string;
  /** `reason="untrained"` — the Engine did not roll the check, because the character cannot attempt
   *  it untrained. Only ever on an ask. */
  reason?: "untrained";
}

function serializeSkillCheckExtras(extras: SkillCheckTagExtras | undefined): string {
  if (!extras) return "";
  const parts: string[] = [];
  if (extras.threshold != null && Number.isFinite(extras.threshold)) parts.push(`threshold="${extras.threshold}"`);
  if (extras.pool) parts.push(`pool="${serializeSkillCheckAttribute(extras.pool)}"`);
  if (extras.who) parts.push(`who="${serializeSkillCheckAttribute(extras.who)}"`);
  // Appended after everything a tag has always carried, so no shipped call site changes its bytes.
  if (extras.with) parts.push(`with="${serializeSkillCheckAttribute(extras.with)}"`);
  if (extras.bonus != null && Number.isFinite(extras.bonus)) {
    parts.push(`bonus="${extras.bonus > 0 ? "+" : ""}${extras.bonus}"`);
  }
  if (extras.spend) parts.push(`spend="${serializeSkillCheckAttribute(extras.spend)}"`);
  if (extras.auto != null && Number.isFinite(extras.auto) && extras.auto > 0) parts.push(`auto="${extras.auto}"`);
  if (extras.use) parts.push(`use="${serializeSkillCheckAttribute(extras.use)}"`);
  if (extras.rerolled != null && Number.isFinite(extras.rerolled) && extras.rerolled > 0) {
    parts.push(`rerolled="${extras.rerolled}"`);
  }
  if (extras.penalty != null && Number.isFinite(extras.penalty) && extras.penalty < 0) {
    parts.push(`penalty="${extras.penalty}"`);
  }
  if (extras.difficulty) parts.push(`difficulty="${serializeSkillCheckAttribute(extras.difficulty)}"`);
  if (extras.explode != null && Number.isFinite(extras.explode)) parts.push(`explode="${extras.explode}"`);
  if (extras.double != null && Number.isFinite(extras.double)) parts.push(`double="${extras.double}"`);
  if (extras.complication) parts.push(`complication="true"`);
  if (extras.adjust != null && Number.isFinite(extras.adjust) && extras.adjust !== 0) {
    parts.push(`adjust="${extras.adjust > 0 ? "+" : ""}${extras.adjust}"`);
  }
  if (extras.reroll) parts.push(`reroll="${serializeSkillCheckAttribute(extras.reroll)}"`);
  if (extras.reason) parts.push(`reason="${extras.reason}"`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function serializeSparseSkillCheckTag(
  request: {
    skill: string;
    /** Absent on an ask that named its difficulty with `difficulty=` instead; see the extras. */
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
    preRolledD20?: number;
    declaredDice?: string;
    declaredResolution?: string;
  },
  extras?: SkillCheckTagExtras,
): string {
  const parts = [`[skill_check: skill="${serializeSkillCheckAttribute(request.skill)}"`];
  if (request.dc != null && Number.isFinite(request.dc)) parts.push(`dc="${request.dc}"`);
  if (request.preRolledD20 != null) parts.push(`rolls="${request.preRolledD20}"`);
  if (request.advantage && !request.disadvantage) parts.push(`mode="advantage"`);
  else if (request.disadvantage && !request.advantage) parts.push(`mode="disadvantage"`);
  if (request.declaredDice) parts.push(`dice="${serializeSkillCheckAttribute(request.declaredDice)}"`);
  if (request.declaredResolution)
    parts.push(`resolution="${serializeSkillCheckAttribute(request.declaredResolution)}"`);
  return `${parts.join(" ")}${serializeSkillCheckExtras(extras)}]`;
}

export function serializeResolvedSkillCheckTag(result: SkillCheckResult, extras?: SkillCheckTagExtras): string {
  // A result that carries its own `who` or per-die threshold writes them without the caller
  // repeating itself. An explicit extra still wins: a caller that passes one is the path that
  // measured it, and the legacy pool path has always passed its own.
  const merged: SkillCheckTagExtras = {
    ...(result.threshold != null ? { threshold: result.threshold } : {}),
    ...(result.who ? { who: result.who } : {}),
    ...(result.withAbility ? { with: result.withAbility } : {}),
    ...(result.bonusDice ? { bonus: result.bonusDice } : {}),
    ...(result.spent ? { spend: `${result.spent.pool}:${result.spent.amount}` } : {}),
    ...(result.autoSuccesses ? { auto: result.autoSuccesses } : {}),
    ...(result.used ? { use: result.used } : {}),
    ...(result.rerolled ? { rerolled: result.rerolled } : {}),
    ...(result.penalty != null ? { penalty: result.penalty } : {}),
    ...(result.explodeFrom != null ? { explode: result.explodeFrom } : {}),
    ...(result.doubleFrom != null ? { double: result.doubleFrom } : {}),
    ...(result.complication ? { complication: true } : {}),
    ...(result.adjust ? { adjust: result.adjust } : {}),
    ...(result.reroll ? { reroll: result.reroll } : {}),
    // An extra a caller left undefined is absent, not an instruction to erase what the result says.
    ...Object.fromEntries(Object.entries(extras ?? {}).filter(([, value]) => value !== undefined)),
  };
  return `${[
    `[skill_check: skill="${serializeSkillCheckAttribute(result.skill)}"`,
    `dc="${result.dc}"`,
    `rolls="${result.rolls.join("|")}"`,
    `used="${result.usedRoll}"`,
    `modifier="${result.modifier}"`,
    `total="${result.total}"`,
    `result="${getSkillCheckOutcomeKey(result)}"`,
    `mode="${result.rollMode}"`,
    `resolution="${result.resolution}"`,
    `dice="${serializeSkillCheckAttribute(result.dice ?? "1d20")}"`,
  ].join(" ")}${serializeSkillCheckExtras(merged)}]`;
}
