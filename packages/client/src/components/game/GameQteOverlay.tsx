// ──────────────────────────────────────────────
// Game: Quick-Time Event Overlay
//
// Timed choice overlay for combat/chase scenes.
// GM emits [qte: action1 | action2, timer: 5s]
// Picking fast gives a bonus modifier; timing out sends a penalty.
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../../lib/utils";

interface QteAction {
  label: string;
}

interface GameQteOverlayProps {
  actions: QteAction[];
  timerSeconds: number;
  onSelect: (action: string, timeRemaining: number) => void;
  onTimeout: () => void;
}

export function GameQteOverlay({ actions, timerSeconds, onSelect, onTimeout }: GameQteOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [selected, setSelected] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const startTime = useRef(0);
  const resolved = useRef(false);

  useEffect(() => {
    startTime.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const remaining = Math.max(0, timerSeconds - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !resolved.current) {
        resolved.current = true;
        clearInterval(interval);
        onTimeout();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [timerSeconds, onTimeout]);

  const handleSelect = useCallback(
    (action: string, index: number) => {
      if (resolved.current) return;
      resolved.current = true;
      setSelected(index);
      setFlash(true);

      const remaining = Math.max(0, timerSeconds - (Date.now() - startTime.current) / 1000);
      setTimeout(() => {
        onSelect(action, remaining);
      }, 400);
    },
    [timerSeconds, onSelect],
  );

  const progress = (timeLeft / timerSeconds) * 100;
  const isUrgent = timeLeft < timerSeconds * 0.3;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Dramatic overlay */}
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-[2px] transition-colors duration-300",
          isUrgent ? "bg-red-950/75" : "bg-black/75",
          flash && "bg-white/30",
        )}
      />

      {/* Screen edge pulse */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 border-4 transition-all duration-200",
          isUrgent ? "animate-pulse border-red-500/60" : "border-amber-400/30",
        )}
      />

      <div className="relative z-10 w-full max-w-lg rounded-lg border border-white/20 bg-black/80 px-5 py-5 shadow-2xl shadow-black/60 ring-1 ring-amber-300/30 backdrop-blur-md">
        {/* Timer bar */}
        <div className="mb-4 overflow-hidden rounded-full bg-white/20 ring-1 ring-white/15">
          <div
            className={cn("h-2 rounded-full transition-all duration-100", isUrgent ? "bg-red-500" : "bg-amber-400")}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Timer text */}
        <div className="mb-3 text-center">
          <span
            className={cn(
              "font-mono text-2xl font-bold tabular-nums",
              isUrgent ? "text-red-400 animate-pulse" : "text-amber-300",
            )}
          >
            {timeLeft.toFixed(1)}s
          </span>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/60">React quickly!</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleSelect(action.label, i)}
              disabled={selected !== null}
              className={cn(
                "relative overflow-hidden rounded-xl border-2 px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-150",
                selected === i
                  ? "scale-110 border-[var(--primary)] bg-[var(--primary)]/30 text-white ring-4 ring-[var(--primary)]/40"
                  : selected !== null
                    ? "scale-90 border-white/5 bg-white/5 text-white/20 opacity-30"
                    : "border-amber-300/50 bg-white/15 text-white shadow-lg shadow-black/30 hover:scale-105 hover:border-amber-300 hover:bg-amber-400/25 active:scale-95",
              )}
            >
              {action.label}

              {/* Key hint */}
              <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[0.5rem] font-mono text-white/50">
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        {/* Bonus indicator */}
        {selected !== null && timeLeft > 0 && (
          <div className="mt-3 text-center">
            <span className="text-xs font-semibold text-emerald-400">Quick reflexes! +{Math.ceil(timeLeft)} bonus</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tag Parser ──

/** Parse [qte: action1 | action2, timer: 5s] from narration content. */
export function parseQteTag(content: string): { actions: string[]; timer: number; cleanContent: string } | null {
  const regex = /\[qte:\s*(.+?),\s*timer:\s*(\d+)s?\]/i;
  const match = content.match(regex);
  if (!match) return null;

  const actionsRaw = match[1]!;
  const timer = parseInt(match[2]!, 10);

  const actions = actionsRaw
    .split("|")
    .map((a) => a.trim().replace(/^["']|["']$/g, ""))
    .filter((a) => a.length > 0);

  if (actions.length === 0 || isNaN(timer)) return null;

  const cleanContent = content.replace(regex, "").trim();
  return { actions, timer, cleanContent };
}
