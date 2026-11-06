import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { skillCheckLightKeptIndices, skillCheckSymbolText, type SkillCheckResult } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { AnimatedDiceRoll } from "./AnimatedDiceRoll";
import { skillCheckTone, TONE_ACCENT } from "./dice-tone";
import { useTranslation as useUiTranslation } from "react-i18next";

interface AnimatedSkillCheckResultProps {
  result: SkillCheckResult;
  accentColor?: string;
  animate?: boolean;
  onDismiss?: () => void;
  className?: string;
}

function resultLabel(result: SkillCheckResult, localizeUi: (key: string) => string): string {
  // The ruleset's own band, in its own words (1.135); the tone below still says success or failure.
  if (result.outcome) return result.outcome.toUpperCase();
  if (result.symbols) {
    return localizeUi(
      result.success
        ? "ui.dice.animatedskillcheckresult.symbolSuccess"
        : "ui.dice.animatedskillcheckresult.symbolFailure",
    );
  }
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
  const label = resultLabel(result, localizeUi);
  const tone = skillCheckTone(result);
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
          {/* Who rolled, when the check names a party member: a party of four cannot tell otherwise. */}
          {result.who ? localizeUi("ui.dice.rolledBy", { name: result.who }) : ""}
          {result.skill} {localizeUi("ui.agents.customagentrepositoriesmodal.check")}
        </span>
        <span>
          {localizeUi(
            result.symbols ? "ui.dice.animatedskillcheckresult.difficultyDice" : "ui.dice.animatedskillcheckresult.dc",
          )}{" "}
          {result.dc}
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
      {/* What the sheet itself added or took, beside any wound: a player cannot tell the two apart
          from the dice alone. */}
      {result.adjust !== undefined && result.adjust !== 0 && (
        <div className="skill-check-roll-meta">
          <span>
            {localizeUi(
              result.resolution === "successes"
                ? "ui.dice.animatedskillcheckresult.adjustDice"
                : "ui.dice.animatedskillcheckresult.adjust",
              { value: result.adjust > 0 ? `+${result.adjust}` : `${result.adjust}` },
            )}
          </span>
        </div>
      )}
      {/* What the character's conditions and worn or carried items did, and which ones: a player
          cannot tell a creaking coat from a bad roll otherwise. */}
      {result.effects !== undefined && result.effects !== 0 && (
        <div className="skill-check-roll-meta">
          <span>
            {localizeUi(
              result.resolution === "successes"
                ? "ui.dice.animatedskillcheckresult.effectsDice"
                : "ui.dice.animatedskillcheckresult.effects",
              { value: result.effects > 0 ? `+${result.effects}` : `${result.effects}` },
            )}
          </span>
        </div>
      )}
      {result.from !== undefined && result.from.length > 0 && (
        <div className="skill-check-roll-meta">
          <span>
            {localizeUi(
              result.automatic
                ? "ui.dice.animatedskillcheckresult.automatic"
                : "ui.dice.animatedskillcheckresult.changedBy",
              { names: result.from.join(", ") },
            )}
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
      {result.symbols ? (
        <div className="relative flex flex-wrap gap-2 py-2 pr-6">
          {(result.symbolFaces ?? []).map((face, index) => (
            <span
              key={index}
              className="max-w-full break-words rounded border border-[var(--border)] px-2 py-1 text-sm"
            >
              {result.thrown?.[index]} ({result.rolls[index]}):{" "}
              {face.map((id) => result.symbolLabels?.[id] ?? id).join(", ") ||
                localizeUi("ui.dice.animatedskillcheckresult.blankFace")}
            </span>
          ))}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="dice-roll-dismiss"
              aria-label={localizeUi("ui.dice.animateddiceroll.dismissDiceRollResult")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
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
          highlightIndices={skillCheckLightKeptIndices(result)}
          highlightValue={
            result.rollMode !== "normal" || result.highest === 1 || result.zeroDice ? result.usedRoll : undefined
          }
          resolution={result.resolution}
          threshold={result.threshold}
          compare={result.compare}
          faceValues={result.faces}
        />
      )}
      <div className="skill-check-roll-result">
        <span>
          {/* A pool counts successes, so it says how many it got and how many it owed. Nothing is
              added up and no single die was kept, which is why neither wording below fits it. */}
          {result.symbols
            ? skillCheckSymbolText(result) || localizeUi("ui.dice.animatedskillcheckresult.noSymbols")
            : result.resolution === "successes"
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
      {/* A face the ruleset marks as rolled unmodified, which its tables read apart from the total. */}
      {result.unmodified !== undefined && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.unmodified", { face: result.unmodified })}</span>
        </div>
      )}
      {/* A roll read against the sheet's number (1.139): the card's DC is the number it had to stay under. */}
      {result.against && (
        <div className="skill-check-roll-meta">
          <span>
            {localizeUi(
              result.against === "at-most"
                ? "ui.dice.animatedskillcheckresult.againstAtMost"
                : "ui.dice.animatedskillcheckresult.againstAtLeast",
              { target: result.dc },
            )}
          </span>
        </div>
      )}
      {/* A keep-the-highest check (1.138) with no dice, and dark dice that beat every other one. */}
      {result.zeroDice && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.zeroDice")}</span>
        </div>
      )}
      {result.darkHighest && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.darkHighest", { label: result.darkLabel ?? "" })}</span>
        </div>
      )}
      {/* Dice that landed exactly on the target, which the ruleset names (Lasers & Feelings' insight). */}
      {result.exact !== undefined && result.exact > 0 && (
        <div className="skill-check-roll-meta">
          <span>
            {localizeUi("ui.dice.animatedskillcheckresult.exact", {
              count: result.exact,
              label: result.exactLabel ?? "",
            })}
          </span>
        </div>
      )}
      {/* Beside the outcome, never in place of it: the check still succeeded or failed as it says. */}
      {result.complication && (
        <div className="skill-check-roll-meta">
          <span>{localizeUi("ui.dice.animatedskillcheckresult.complication")}</span>
        </div>
      )}
    </div>
  );
}
