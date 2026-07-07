// ──────────────────────────────────────────────
// Game: Dice Roll Result Display
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import type { DiceRollResult } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { AnimatedDiceRoll } from "../dice/AnimatedDiceRoll";

interface GameDiceResultProps {
  result: DiceRollResult;
  onDismiss: () => void;
}

export function GameDiceResult({ result, onDismiss }: GameDiceResultProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(false);
    // Trigger animation on next frame so the transition plays
    const raf = requestAnimationFrame(() => setAnimate(true));
    const timer = setTimeout(() => onDismiss(), 5000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // onDismiss is stable (useCallback with stable deps) — safe to exclude
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div
      className={cn(
        "pointer-events-auto mx-auto mb-2 flex w-full max-w-md justify-center transition-all duration-300",
        animate ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      <AnimatedDiceRoll {...result} mode="game" animate onDismiss={onDismiss} />
    </div>
  );
}
