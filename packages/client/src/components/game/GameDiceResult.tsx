// ──────────────────────────────────────────────
// Game: Dice Roll Result Display
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import type { DiceRollResult } from "@marinara-engine/shared";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

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
      <div className="relative flex w-full items-center gap-3 rounded-xl bg-black/80 px-4 py-2.5 pr-10 shadow-lg shadow-black/30 backdrop-blur-sm ring-1 ring-white/10 sm:px-5 sm:py-3">
        <span className="game-dice-animate text-xl sm:text-2xl">🎲</span>
        <div className="min-w-0">
          <div className="text-xs font-mono text-white/60">{result.notation}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs text-white/40">
              [{result.rolls.join(", ")}]
              {result.modifier !== 0 && ` ${result.modifier > 0 ? "+" : ""}${result.modifier}`}
            </span>
            <span className="text-lg font-bold text-white">= {result.total}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss dice roll result"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
