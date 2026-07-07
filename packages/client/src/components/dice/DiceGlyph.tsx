import { useId, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import "./dice.css";
import { getDiceShape, getFaceLabel } from "./dice-shapes";
import { getDiceVisualProfile } from "./dice-visual-profiles";

export type DiceGlyphPhase = "idle" | "cast" | "tumble" | "impact" | "settled";
export type DiceGlyphSize = "hero" | "standard" | "compact";

interface DiceGlyphProps {
  sides: number;
  value: number;
  phase: DiceGlyphPhase;
  size?: DiceGlyphSize;
  index?: number;
  emphasized?: boolean;
  hero?: boolean;
  className?: string;
}

const D6_PIPS: Record<number, Array<[number, number]>> = {
  1: [[48, 54]],
  2: [[34, 40], [62, 68]],
  3: [[34, 40], [48, 54], [62, 68]],
  4: [[34, 40], [62, 40], [34, 68], [62, 68]],
  5: [[34, 40], [62, 40], [48, 54], [34, 68], [62, 68]],
  6: [[34, 38], [62, 38], [34, 54], [62, 54], [34, 70], [62, 70]],
};

function renderD6Pips(value: number) {
  return (D6_PIPS[value] ?? D6_PIPS[6]).map(([cx, cy], index) => (
    <circle key={index} className="dice-glyph-pip" cx={cx} cy={cy} r="4.4" />
  ));
}

export function DiceGlyph({ sides, value, phase, size = "standard", index = 0, emphasized = true, hero = false, className }: DiceGlyphProps) {
  const uid = useId();
  const shape = getDiceShape(sides);
  const profile = getDiceVisualProfile(sides, hero);
  const face = getFaceLabel(sides, value);
  const delay = `${index * 62}ms`;
  const restRot = `${((index % 5) - 2) * 7}deg`;
  const restX = `${((index % 3) - 1) * 0.24}rem`;
  const restY = `${((index % 4) - 1.5) * 0.13}rem`;

  return (
    <span
      className={cn(
        "dice-glyph",
        `dice-glyph--${size}`,
        `dice-glyph--${shape.kind}`,
        `dice-glyph--${phase}`,
        `dice-roll-axis--${profile.rollAxis}`,
        `dice-shadow--${profile.shadow}`,
        `dice-silhouette--${profile.silhouette}`,
        `dice-impact--${profile.impact}`,
        className,
      )}
      data-emphasized={emphasized ? "true" : "false"}
      style={{
        "--dice-delay": delay,
        "--dice-rest-rot": restRot,
        "--dice-rest-x": restX,
        "--dice-rest-y": restY,
      } as CSSProperties}
    >
      <span className="dice-glyph-shadow" />
      <svg className="dice-glyph-svg" viewBox="0 0 100 100" role="img" aria-label={`d${sides} showing ${face}`}>
        <defs>
          <radialGradient id={`die-shine-${uid}`} cx="36%" cy="26%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="0.28" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path className="dice-glyph-body" d={shape.body} />
        <path className="dice-glyph-body-shine" d={shape.body} fill={`url(#die-shine-${uid})`} />
        <path className="dice-glyph-highlight" d={shape.highlight} />
        <path className="dice-glyph-shadow-facet" d={shape.shadow} />
        <path className="dice-glyph-face" d={shape.face} />
        {shape.facets.map((path, facetIndex) => (
          <path key={facetIndex} className="dice-glyph-facet" d={path} />
        ))}
        {shape.renderMode === "pips" ? (
          renderD6Pips(value)
        ) : (
          <>
            <text className="dice-glyph-label" x="50" y={shape.labelY} textAnchor="middle">
              {shape.kind === "coin" ? "d2" : `d${sides}`}
            </text>
            <text className={cn("dice-glyph-value", shape.renderMode === "coin" && "dice-glyph-value--coin")} x="50" y={shape.valueY} textAnchor="middle" style={{ fontSize: shape.valueSize }}>
              {face}
            </text>
          </>
        )}
      </svg>
    </span>
  );
}
