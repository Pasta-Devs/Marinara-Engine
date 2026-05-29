// ──────────────────────────────────────────────
// Game: State Indicator Bar
// ──────────────────────────────────────────────
import { Compass, MessageCircle, Moon, Swords, type LucideIcon } from "lucide-react";
import type { GameActiveState } from "../../../../engine/contracts/types/game";
import { cn } from "../../../../shared/lib/utils";

const GAME_STATE_CONFIG: Record<
  GameActiveState,
  { icon: LucideIcon; label: string; color: string; bg: string }
> = {
  exploration: {
    icon: Compass,
    label: "Exploration",
    color: "text-emerald-300",
    bg: "bg-emerald-500/20",
  },
  dialogue: {
    icon: MessageCircle,
    label: "Dialogue",
    color: "text-sky-300",
    bg: "bg-sky-500/20",
  },
  combat: {
    icon: Swords,
    label: "Combat",
    color: "text-red-300",
    bg: "bg-red-500/20",
  },
  travel_rest: {
    icon: Moon,
    label: "Travel & Rest",
    color: "text-amber-300",
    bg: "bg-amber-500/20",
  },
};

export function getGameStateConfig(state: unknown) {
  if (typeof state !== "string") return null;
  return Object.prototype.hasOwnProperty.call(GAME_STATE_CONFIG, state)
    ? GAME_STATE_CONFIG[state as GameActiveState]
    : null;
}

interface GameStateIndicatorProps {
  state: GameActiveState;
}

export function GameStateIndicator({ state }: GameStateIndicatorProps) {
  const cfg = getGameStateConfig(state);
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "game-state-enter inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-lg backdrop-blur-sm",
        cfg.bg,
        cfg.color,
        state === "combat" && "game-combat-border border",
      )}
    >
      <Icon size={14} />
      <span>{cfg.label}</span>
    </div>
  );
}
