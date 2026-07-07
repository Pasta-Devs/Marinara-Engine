import type { CSSProperties } from "react";
import type { SkillCheckResult } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { AnimatedDiceRoll } from "./AnimatedDiceRoll";

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
  "success": "oklch(0.72 0.16 158)",
  "failure": "oklch(0.68 0.18 20)",
  "critical-failure": "oklch(0.60 0.22 20)",
};

function resultLabel(result: SkillCheckResult): string {
  if (result.criticalSuccess) return "CRITICAL SUCCESS";
  if (result.criticalFailure) return "CRITICAL FAILURE";
  return result.success ? "SUCCESS" : "FAILURE";
}

export function AnimatedSkillCheckResult({ result, accentColor, animate = false, onDismiss, className }: AnimatedSkillCheckResultProps) {
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
    <div className={cn("skill-check-roll", `skill-check-roll--${tone}`, animate && "is-animating", className)} style={style}>
      <div className="skill-check-roll-meta">
        <span>{result.skill} Check</span>
        <span>DC {result.dc}{rollMode}</span>
      </div>
      <AnimatedDiceRoll
        notation={`${result.rolls.length}d20`}
        rolls={result.rolls}
        modifier={result.modifier}
        total={result.total}
        accentColor={resolvedAccent}
        mode="game"
        animate={animate}
        onDismiss={onDismiss}
        hero
        highlightValue={result.rollMode !== "normal" ? result.usedRoll : undefined}
      />
      <div className="skill-check-roll-result">
        <span>{result.rollMode !== "normal" ? `Using ${result.usedRoll}` : `Rolled ${result.usedRoll}`}</span>
        <strong>{label}</strong>
      </div>
    </div>
  );
}
