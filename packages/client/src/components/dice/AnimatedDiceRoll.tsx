import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { skillCheckDiceSumToTotal, skillCheckSymbolText, type DiceRollResult } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { DiceGlyph, type DiceGlyphPhase, type DiceGlyphSize } from "./DiceGlyph";
import { getFaceLabel } from "./dice-shapes";
import { parseDiceSides, TONE_ACCENT, type Tone } from "./dice-tone";
import { useTranslation as useUiTranslation } from "react-i18next";

type DiceRollMode = "chat" | "game" | "compact";

interface AnimatedDiceRollProps extends DiceRollResult {
  accentColor?: string;
  /** Tints the card by outcome when no explicit accent is given. */
  tone?: Tone;
  mode?: DiceRollMode;
  animate?: boolean;
  onDismiss?: () => void;
  hero?: boolean;
  highlightValue?: number;
  /** Explicit kept dice, including an empty selection when none count. */
  highlightIndices?: number[];
  resolution?: "sum" | "successes";
  /** The per-die target a success pool counted with. Given, the dice that reached it are marked as
   *  the ones that counted and the rest are dimmed. Absent, every die reads as it always has. */
  threshold?: number;
  /** Which way a pool counted against its target: a die under it, or over it. Absent, a die counts
   *  at the target or more. */
  compare?: "below" | "above";
  /** What each face of the die is worth, lowest first, where it is not its own number (Fate's
   *  `[-1, 0, 1]`). Given, each die shows its worth and the breakdown adds the worths. */
  faceValues?: number[];
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

export function shouldAnimateDiceRollMessage(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs < 10_000;
}

/** Whether a card throws its dice on this run of its effect, given the run before it. A new roll is
 *  thrown when animation is on. A roll that already lay still stays still when animation comes back
 *  on, as when Show Dice Rolls as Text is turned off. */
export function diceThrowStarts(
  previous: { rollKey: string; shouldAnimate: boolean } | null,
  rollKey: string,
  shouldAnimate: boolean,
): boolean {
  return shouldAnimate && !(previous?.rollKey === rollKey && !previous.shouldAnimate);
}

export function AnimatedDiceRoll({
  notation,
  rolls,
  modifier,
  total,
  dc,
  accentColor,
  tone,
  mode = "chat",
  animate = false,
  onDismiss,
  hero,
  highlightValue,
  highlightIndices,
  kept,
  resolution = "sum",
  threshold,
  compare,
  faceValues,
  label,
  success,
  thrown,
  symbolFaces,
  symbols,
  symbolLabels,
}: AnimatedDiceRollProps) {
  const { t: localizeUi } = useUiTranslation();
  const sides = parseDiceSides(notation);
  const reducedMotion = useReducedMotion();
  // Settings → Appearance → App can show the roll as one short line of text: the same header and
  // result as the card, without the dice or their animation.
  const asText = useUIStore((state) => state.diceRollsAsText);
  const shouldAnimate = animate && !reducedMotion && !asText;
  const rollKey = `${notation}:${rolls.join(",")}:${modifier}:${total}`;
  const isHero = rolls.length === 1 && hero !== false;
  const isLargePool = rolls.length >= 10;
  const glyphSize: DiceGlyphSize = isHero ? "hero" : isLargePool || mode === "compact" ? "compact" : "standard";
  const [phase, setPhase] = useState<DiceGlyphPhase>(shouldAnimate ? "cast" : "settled");
  const [displayValues, setDisplayValues] = useState(rolls);
  const lastRun = useRef<{ rollKey: string; shouldAnimate: boolean } | null>(null);

  useEffect(() => {
    const throws = diceThrowStarts(lastRun.current, rollKey, shouldAnimate);
    lastRun.current = { rollKey, shouldAnimate };
    if (!throws) {
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
    const impactTimer = window.setTimeout(
      () => {
        window.clearInterval(interval);
        setDisplayValues(rolls);
        setPhase("impact");
      },
      Math.min(980, 620 + rolls.length * 46),
    );
    const settledTimer = window.setTimeout(() => setPhase("settled"), Math.min(1180, 820 + rolls.length * 48));

    return () => {
      window.clearTimeout(castTimer);
      window.clearInterval(interval);
      window.clearTimeout(impactTimer);
      window.clearTimeout(settledTimer);
    };
  }, [rollKey, rolls, shouldAnimate, sides]);

  const resolvedAccent = accentColor ?? (tone ? TONE_ACCENT[tone] : undefined);
  const style = resolvedAccent ? ({ "--dice-accent": resolvedAccent } as CSSProperties) : undefined;
  const modifierText = modifier !== 0 ? `${modifier > 0 ? "+" : ""}${modifier}` : "";
  // What a face adds, where the die's faces are worth other numbers.
  const worthOf = (face: number) => faceValues?.[face - 1] ?? face;
  // A pool that kept some of its dice (`4d6kh3`) adds only those, and dims the rest.
  const counted = kept ? kept.map((index) => rolls[index]!) : rolls;
  const emphasizedIndices = highlightIndices ?? kept;
  const sumsToTotal =
    resolution === "sum" && skillCheckDiceSumToTotal({ rolls: counted.map(worthOf), modifier, total, resolution });
  // A face's worth as text, where the die's faces are not their own numbers: Fate's dice read -, blank, +.
  const faceText = (face: number): string | undefined => {
    const worth = faceValues?.[face - 1];
    if (worth === undefined) return undefined;
    const fate = faceValues!.every((value) => value >= -1 && value <= 1);
    if (fate) return worth > 0 ? "+" : worth < 0 ? "−" : " ";
    return worth > 0 ? `+${worth}` : String(worth);
  };
  const rollText = useMemo(
    () => rolls.map((roll) => faceText(roll) ?? getFaceLabel(sides, roll)).join(", "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rolls, sides, faceValues],
  );
  const totalVisible = phase === "impact" || phase === "settled";
  // A pool that reported the target it counted with marks the dice that reached it.
  const countedFrom = resolution === "successes" && threshold != null ? threshold : null;
  // A symbol-pool ruleset's dice by name: each die reads as its symbols, not a number. They are words
  // already, so a roll shown as text keeps them, smaller.
  const symbolDice =
    symbols && thrown && symbolFaces ? (
      <div className={cn("flex flex-wrap", asText ? "gap-1" : "gap-2 py-2")}>
        {symbolFaces.map((face, index) => (
          <span
            key={index}
            className={cn(
              "max-w-full break-words rounded border border-[var(--border)]",
              asText ? "px-1.5 text-xs" : "px-2 py-1 text-sm",
            )}
          >
            {thrown[index]} ({rolls[index]}):{" "}
            {face.map((id) => symbolLabels?.[id] ?? id).join(", ") ||
              localizeUi("ui.dice.animatedskillcheckresult.blankFace")}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "dice-roll-card",
        "dice-tray",
        `dice-roll-card--${mode}`,
        asText && "dice-roll-card--text",
        !asText && isHero && "dice-tray--hero",
        !asText && isLargePool && "dice-tray--pool",
        shouldAnimate && "is-animated",
        phase === "settled" && "is-settled",
        phase === "impact" && "is-impacting",
      )}
      style={style}
    >
      <div className="dice-roll-header">
        <span className="dice-roll-header-mark" aria-hidden="true">
          ✦
        </span>
        <span>
          {/* Who rolled, or why, when the roll said: a party's rolls otherwise all look alike. */}
          {label ? localizeUi("ui.dice.rolledBy", { name: label }) : ""}
          {notation}
          {dc !== undefined && (
            <>
              {" "}
              · {localizeUi("ui.dice.animatedskillcheckresult.dc")} {dc}
            </>
          )}
        </span>
      </div>

      {!asText && (
        <div
          className="dice-stage"
          aria-label={localizeUi("ui.dice.animateddiceroll.rolledValue1Value2", { value1: notation, value2: rollText })}
        >
          {symbolDice}
          {!symbols &&
            rolls.map((roll, index) => {
              const shown = displayValues[index] ?? roll;
              const emphasized =
                emphasizedIndices !== undefined
                  ? emphasizedIndices.includes(index)
                  : countedFrom == null
                    ? highlightValue == null || roll === highlightValue
                    : compare === "below"
                      ? roll < countedFrom
                      : compare === "above"
                        ? roll > countedFrom
                        : roll >= countedFrom;
              return (
                <DiceGlyph
                  key={`${index}-${roll}`}
                  sides={sides}
                  value={shown}
                  faceText={faceText(shown)}
                  phase={phase}
                  size={glyphSize}
                  index={index}
                  emphasized={emphasized}
                  hero={isHero}
                />
              );
            })}
        </div>
      )}
      {asText && symbolDice}

      {/* Which dice counted is shown by dimming the ones that did not, which is a picture. The rule
          behind it is said in words here so it reaches a screen reader too. A roll shown as text has
          no dimmed dice, so there the rule is on screen. */}
      {countedFrom != null && (
        <span className={asText ? "dice-roll-breakdown" : "sr-only"}>
          {localizeUi(
            compare === "below"
              ? "ui.dice.animateddiceroll.countedBelow"
              : compare === "above"
                ? "ui.dice.animateddiceroll.countedAbove"
                : "ui.dice.animateddiceroll.countedFrom",
            { value: countedFrom },
          )}
        </span>
      )}

      {symbols ? (
        <div className="dice-roll-footer">
          <span className="dice-roll-breakdown">
            {skillCheckSymbolText({ symbols, symbolLabels }) ||
              localizeUi("ui.dice.animatedskillcheckresult.noSymbols")}
          </span>
          <span className={cn("dice-roll-total", totalVisible && "is-visible")}>
            {" → "}
            {localizeUi(
              success
                ? "ui.dice.animatedskillcheckresult.symbolSuccess"
                : "ui.dice.animatedskillcheckresult.symbolFailure",
            )}
          </span>
        </div>
      ) : (
        <div className="dice-roll-footer">
          <span className="dice-roll-breakdown">
            {/* Only show the addition when the dice genuinely add up to the total.
              They do not under advantage/disadvantage (one die is discarded) or
              in pool systems that count successes, and printing "4 + 1 + 9 = 1"
              makes correct results look like broken arithmetic. */}
            {sumsToTotal ? (
              <>
                {/* The card dims the dice a pool dropped (`2d20kh1`). A roll shown as text has no dice to
                    dim, so it lists them all and strikes out the dropped ones, as a roll message does. */}
                {asText && kept
                  ? rolls.map((face, index) => (
                      <Fragment key={index}>
                        {index > 0 && " + "}
                        {kept.includes(index) ? worthOf(face) : <s>{worthOf(face)}</s>}
                      </Fragment>
                    ))
                  : counted.map(worthOf).join(" + ")}
                {modifierText && ` ${modifierText}`}
              </>
            ) : (
              <>
                {rolls.map(worthOf).join(" · ")}
                {resolution === "sum" && modifierText && ` ${modifierText}`}
              </>
            )}
          </span>
          <span className={cn("dice-roll-total", totalVisible && "is-visible")}>
            {sumsToTotal ? " = " : " → "}
            {/* The success string carries the count itself ("1 success"), so the bare number is not repeated. */}
            {resolution === "successes" ? localizeUi("ui.dice.animateddiceroll.successCount", { count: total }) : total}
          </span>
        </div>
      )}

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
  );
}
