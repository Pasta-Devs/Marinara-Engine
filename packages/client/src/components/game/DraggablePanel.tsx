// ──────────────────────────────────────────────
// Game: Lock + drag helpers for HUD panels
//
// Each panel (widget cards, map) uses `useDraggablePanel`
// to persist a lock flag and {x,y} offset. State is scoped
// by chatId so positions don't bleed across games.
// `PanelLockButton` renders the lock toggle in headers.
// ──────────────────────────────────────────────
import { useCallback, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { cn } from "../../lib/utils";

const STORAGE_PREFIX = "marinara-game-panel:";

interface PanelState {
  locked: boolean;
  x: number;
  y: number;
}

function storageKey(scopeId: string, panelId: string): string {
  return `${STORAGE_PREFIX}${scopeId}:${panelId}`;
}

function readPanelState(key: string): PanelState {
  if (typeof window === "undefined") return { locked: true, x: 0, y: 0 };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { locked: true, x: 0, y: 0 };
    const parsed = JSON.parse(raw) as Partial<PanelState>;
    return {
      locked: parsed.locked !== false,
      x: Number.isFinite(parsed.x) ? (parsed.x as number) : 0,
      y: Number.isFinite(parsed.y) ? (parsed.y as number) : 0,
    };
  } catch {
    return { locked: true, x: 0, y: 0 };
  }
}

function writePanelState(key: string, state: PanelState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // quota / unavailable — best-effort only
  }
}

/**
 * Returns motion values + lock state for a draggable HUD panel, persisted per
 * chat so positions don't bleed across games. Reads from localStorage
 * synchronously on first render to avoid a hydration-flicker where a moved
 * panel paints at origin before snapping back.
 */
export function useDraggablePanel(scopeId: string, panelId: string) {
  const key = storageKey(scopeId, panelId);

  // Synchronous first-render hydration via a ref-captured seed.
  const seedRef = useRef<PanelState | null>(null);
  if (seedRef.current === null) {
    seedRef.current = readPanelState(key);
  }
  const seed = seedRef.current;

  const [locked, setLocked] = useState(seed.locked);
  const x = useMotionValue(seed.x);
  const y = useMotionValue(seed.y);

  const toggleLocked = useCallback(() => {
    setLocked((prev) => {
      const next = !prev;
      writePanelState(key, { locked: next, x: x.get(), y: y.get() });
      return next;
    });
  }, [key, x, y]);

  const handleDragEnd = useCallback(() => {
    writePanelState(key, { locked, x: x.get(), y: y.get() });
  }, [key, locked, x, y]);

  return { locked, toggleLocked, x, y, handleDragEnd };
}

interface PanelLockButtonProps {
  locked: boolean;
  onToggle: () => void;
  /** Icon size in px. Matches the adjacent collapse indicator. */
  size?: number;
  className?: string;
}

/** Small lock toggle styled to match collapse/chevron buttons in HUD panels. */
export function PanelLockButton({ locked, onToggle, size = 10, className }: PanelLockButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title={locked ? "Unlock to move" : "Lock in place"}
      aria-label={locked ? "Unlock panel" : "Lock panel"}
      aria-pressed={!locked}
      className={cn(
        "flex shrink-0 items-center justify-center text-white/30 transition-colors hover:text-white/70",
        className,
      )}
    >
      {locked ? <Lock size={size} /> : <Unlock size={size} />}
    </button>
  );
}
