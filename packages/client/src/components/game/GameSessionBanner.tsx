// ──────────────────────────────────────────────
// Game: Session Banner (top bar with session controls)
// ──────────────────────────────────────────────
import { Play, Square, History } from "lucide-react";

interface GameSessionBannerProps {
  sessionNumber: number;
  sessionStatus: string;
  gameName: string;
  onConcludeSession: () => void;
  onStartNewSession: () => void;
  onViewHistory: () => void;
}

export function GameSessionBanner({
  sessionNumber,
  sessionStatus,
  gameName,
  onConcludeSession,
  onStartNewSession,
  onViewHistory,
}: GameSessionBannerProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--foreground)]">{gameName}</span>
        <span className="text-xs text-[var(--muted-foreground)]">— Session {sessionNumber}</span>
      </div>

      <div className="relative flex items-center gap-1">
        <button
          onClick={onViewHistory}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
        >
          <History size={14} />
          History
        </button>

        {sessionStatus !== "concluded" ? (
          <button
            onClick={onConcludeSession}
            className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <Square size={12} />
            End Session
          </button>
        ) : (
          <button
            onClick={onStartNewSession}
            className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 transition-colors"
          >
            <Play size={12} />
            New Session
          </button>
        )}
      </div>
    </div>
  );
}
