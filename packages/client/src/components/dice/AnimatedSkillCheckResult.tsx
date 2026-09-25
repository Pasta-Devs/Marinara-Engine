import type { CSSProperties } from "react";
import type { SkillCheckResult } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { AnimatedDiceRoll } from "./AnimatedDiceRoll";
import { useTranslation as useUiTranslation } from "react-i18next";

interface AnimatedSkillCheckResultProps {
  result: SkillCheckResult;
  accentColor?: string;
  animate?: boolean;
  onDismiss?: () => void;
  className?: string;
}

type Tone = "critical-success" | "success" | "failure" | "critical-failure";

const TONE_ACCENT: Record<Tone, string> = {
  "critical-success": "oklch(0.82 0.15 86)",
  success: "oklch(0.72 0.16 158)",
  failure: "oklch(0.68 0.18 20)",
  "critical-failure": "oklch(0.60 0.22 20)",
};

function resultLabel(result: SkillCheckResult): string {
  if (result.criticalSuccess) return "CRITICAL SUCCESS";
  if (result.criticalFailure) return "CRITICAL FAILURE";
  return result.success ? "SUCCESS" : "FAILURE";
}

export function AnimatedSkillCheckResult({
  result,
  accentColor,
  animate = false,
  onDismiss,
  className,
}: AnimatedSkillCheckResultProps) {
  const { t: localizeUi } = useUiTranslation();
  const label = resultLabel(result);
  const tone = result.criticalSuccess
    ? "critical-success"
    : result.criticalFailure
      ? "critical-failure"
      : result.success
        ? "success"
        : "failure";
  const rollMode = result.rollMode !== "normal" ? ` · ${result.rollMode}` : "";
  const resolvedAccent = accentColor ?? TONE_ACCENT[tone];
  const style = resolvedAccent ? ({ "--dice-accent": resolvedAccent } as CSSProperties) : undefined;

  return (
    <div
      className={cn("skill-check-roll", `skill-check-roll--${tone}`, animate && "is-animating", className)}
      style={style}
    >
      <div className="skill-check-roll-meta">
        <span>
          {result.skill} {localizeUi("ui.agents.customagentrepositoriesmodal.check")}
        </span>
        <span>
          {localizeUi("ui.dice.animatedskillcheckresult.dc")} {result.dc}
          {rollMode}
        </span>
      </div>
      {/* Why the pool was smaller, or the sum lower, than the sheet says. A wounded character can
          otherwise only guess at where the missing dice went. */}
      {result.penalty !== undefined && result.penalty !== 0 && (
        <div className="skill-check-roll-meta">
          <span>
            {result.resolution === "successes"
              ? localizeUi("ui.dice.animatedskillcheckresult.woundPenaltyDice", { count: -result.penalty })
              : localizeUi("ui.dice.animatedskillcheckresult.woundPenalty", { penalty: result.penalty })}
          </span>
        </div>
      )}
      {/* A face the check moved off the ruleset's own, so extra dice or doubled faces are explained. */}
      {result.explodeFrom !== undefined && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.explodeFrom", { face: result.explodeFrom })}</span>
        </div>
      )}
      {result.doubleFrom !== undefined && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.doubleFrom", { face: result.doubleFrom })}</span>
        </div>
      )}
      <AnimatedDiceRoll
        notation={result.dice ?? `${result.rolls.length}d20`}
        rolls={result.rolls}
        modifier={result.modifier}
        total={result.total}
        accentColor={resolvedAccent}
        mode="game"
        animate={animate}
        onDismiss={onDismiss}
        hero
        highlightValue={result.rollMode !== "normal" ? result.usedRoll : undefined}
        resolution={result.resolution}
        threshold={result.threshold}
      />
      <div className="skill-check-roll-result">
        <span>
          {/* A pool counts successes, so it says how many it got and how many it owed. Nothing is
              added up and no single die was kept, which is why neither wording below fits it. */}
          {result.resolution === "successes"
            ? localizeUi("ui.dice.animatedskillcheckresult.successesNeeded", {
                count: result.total,
                needed: result.dc,
              })
            : result.rollMode !== "normal"
              ? localizeUi("ui.dice.animatedskillcheckresult.usingValue1", { value1: result.usedRoll })
              : result.resolution === "sum" &&
                  result.rolls.length === 1 &&
                  result.usedRoll === result.rolls[0] &&
                  result.total === result.usedRoll + result.modifier
                ? localizeUi("ui.dice.animatedskillcheckresult.rolledValue1", { value1: result.usedRoll })
                : localizeUi("ui.dice.animatedskillcheckresult.resultValue1", { value1: result.total })}
        </span>
        <strong>{label}</strong>
      </div>
      {/* Beside the outcome, never in place of it: the check still succeeded or failed as it says. */}
      {result.complication && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.complication")}</span>
        </div>
      )}
    </div>
  );
}
