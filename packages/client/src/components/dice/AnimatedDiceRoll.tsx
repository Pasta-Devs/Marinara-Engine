import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import type { DiceRollResult } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { DiceGlyph, type DiceGlyphPhase, type DiceGlyphSize } from "./DiceGlyph";
import { getFaceLabel } from "./dice-shapes";

type DiceRollMode = "chat" | "game" | "compact";

interface AnimatedDiceRollProps extends DiceRollResult {
  accentColor?: string;
  mode?: DiceRollMode;
  animate?: boolean;
  onDismiss?: () => void;
  hero?: boolean;
  highlightValue?: number;
}

function parseDiceSides(notation: string): number {
  const match = notation.trim().match(/^(?:\d+)?d(\d+)/i);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

function randomFace(sides: number): number {
  const safeSides = Math.max(1, sides || 20);
  return Math.floor(Math.random() * safeSides) + 1;
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReducedMotion(query.matches);
    const handleChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

export function isDiceRollResult(value: unknown): value is DiceRollResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiceRollResult>;
  return (
    typeof candidate.notation === "string" &&
    Array.isArray(candidate.rolls) &&
    candidate.rolls.every((roll) => Number.isFinite(roll)) &&
    Number.isFinite(candidate.modifier) &&
    Number.isFinite(candidate.total)
  );
}

export function shouldAnimateDiceRollMessage(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs < 10_000;
}

export function AnimatedDiceRoll({
  notation,
  rolls,
  modifier,
  total,
  accentColor,
  mode = "chat",
  animate = false,
  onDismiss,
  hero,
  highlightValue,
}: AnimatedDiceRollProps) {
  const sides = parseDiceSides(notation);
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const rollKey = `${notation}:${rolls.join(",")}:${modifier}:${total}`;
  const isHero = rolls.length === 1 && hero !== false;
  const isLargePool = rolls.length >= 10;
  const glyphSize: DiceGlyphSize = isHero ? "hero" : isLargePool || mode === "compact" ? "compact" : "standard";
  const [phase, setPhase] = useState<DiceGlyphPhase>(shouldAnimate ? "cast" : "settled");
  const [displayValues, setDisplayValues] = useState(rolls);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayValues(rolls);
      setPhase("settled");
      return;
    }

    setPhase("cast");
    setDisplayValues(rolls.map(() => randomFace(sides)));

    const castTimer = window.setTimeout(() => setPhase("tumble"), 130);
    const interval = window.setInterval(() => {
      setDisplayValues(rolls.map(() => randomFace(sides)));
    }, 72);
    const impactTimer = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplayValues(rolls);
      setPhase("impact");
    }, Math.min(980, 620 + rolls.length * 46));
    const settledTimer = window.setTimeout(() => setPhase("settled"), Math.min(1180, 820 + rolls.length * 48));

    return () => {
      window.clearTimeout(castTimer);
      window.clearInterval(interval);
      window.clearTimeout(impactTimer);
      window.clearTimeout(settledTimer);
    };
  }, [rollKey, rolls, shouldAnimate, sides]);

  const style = accentColor ? ({ "--dice-accent": accentColor } as CSSProperties) : undefined;
  const modifierText = modifier !== 0 ? `${modifier > 0 ? "+" : ""}${modifier}` : "";
  const rollText = useMemo(() => rolls.map((roll) => getFaceLabel(sides, roll)).join(", "), [rolls, sides]);
  const totalVisible = phase === "impact" || phase === "settled";

  return (
    <div
      className={cn(
        "dice-roll-card",
        "dice-tray",
        `dice-roll-card--${mode}`,
        isHero && "dice-tray--hero",
        isLargePool && "dice-tray--pool",
        shouldAnimate && "is-animated",
        phase === "settled" && "is-settled",
        phase === "impact" && "is-impacting",
      )}
      style={style}
    >
      <div className="dice-roll-header">
        <span className="dice-roll-header-mark" aria-hidden="true">✦</span>
        <span>{notation}</span>
      </div>

      <div className="dice-stage" aria-label={`Rolled ${notation}: ${rollText}`}>
        {rolls.map((roll, index) => {
          const shown = displayValues[index] ?? roll;
          const emphasized = highlightValue == null || roll === highlightValue;
          return (
            <DiceGlyph
              key={`${index}-${roll}`}
              sides={sides}
              value={shown}
              phase={phase}
              size={glyphSize}
              index={index}
              emphasized={emphasized}
              hero={isHero}
            />
          );
        })}
      </div>

      <div className="dice-roll-footer">
        <span className="dice-roll-breakdown">
          {rolls.join(" + ")}{modifierText && ` ${modifierText}`}
        </span>
        <span className={cn("dice-roll-total", totalVisible && "is-visible")}> = {total}</span>
      </div>

      {onDismiss && (
        <button type="button" onClick={onDismiss} className="dice-roll-dismiss" aria-label="Dismiss dice roll result">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
