// ──────────────────────────────────────────────
// Game: Lock + drag helpers for HUD panels
//
// Each panel (widget cards, map) uses `useDraggablePanel`
// to persist a lock flag and {x,y} offset. State is scoped
// by chatId so positions don't bleed across games.
// `PanelLockButton` renders the lock toggle in headers.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

const STORAGE_PREFIX = "marinara-game-panel:";
const MIN_VISIBLE_PANEL_PX = 96;

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

function clampOffsetToViewport(value: number, axis: "x" | "y") {
  if (typeof window === "undefined") return value;
  const viewportSize = axis === "x" ? window.innerWidth : window.innerHeight;
  const limit = Math.max(0, viewportSize - MIN_VISIBLE_PANEL_PX);
  return Math.max(-limit, Math.min(limit, value));
}

function clampPanelState(state: PanelState): PanelState {
  return {
    ...state,
    x: clampOffsetToViewport(state.x, "x"),
    y: clampOffsetToViewport(state.y, "y"),
  };
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
  const seed = clampPanelState(seedRef.current);

  const [locked, setLocked] = useState(seed.locked);
  const x = useMotionValue(seed.x);
  const y = useMotionValue(seed.y);

  const clampAndPersist = useCallback(() => {
    const next = clampPanelState({ locked, x: x.get(), y: y.get() });
    if (next.x !== x.get()) x.set(next.x);
    if (next.y !== y.get()) y.set(next.y);
    writePanelState(key, next);
  }, [key, locked, x, y]);

  useEffect(() => {
    clampAndPersist();
    if (typeof window === "undefined") return;
    window.addEventListener("resize", clampAndPersist);
    return () => window.removeEventListener("resize", clampAndPersist);
  }, [clampAndPersist]);

  const toggleLocked = useCallback(() => {
    setLocked((prev) => {
      const next = !prev;
      writePanelState(key, clampPanelState({ locked: next, x: x.get(), y: y.get() }));
      return next;
    });
  }, [key, x, y]);

  const handleDragEnd = useCallback(() => {
    clampAndPersist();
  }, [clampAndPersist]);

  const resetPosition = useCallback(() => {
    x.set(0);
    y.set(0);
    writePanelState(key, { locked, x: 0, y: 0 });
  }, [key, locked, x, y]);

  return { locked, toggleLocked, resetPosition, x, y, handleDragEnd };
}

interface PanelLockButtonProps {
  locked: boolean;
  onToggle: () => void;
  onReset?: () => void;
  /** Icon size in px. Matches the adjacent collapse indicator. */
  size?: number;
  className?: string;
}

/** Small lock toggle styled to match collapse/chevron buttons in HUD panels. */
export function PanelLockButton({ locked, onToggle, onReset, size = 10, className }: PanelLockButtonProps) {
  const { t: localizeUi } = useUiTranslation();
  const title = onReset
    ? locked
      ? "Unlock to move. Double-click or press R to reset position"
      : "Lock in place. Double-click or press R to reset position"
    : locked
      ? "Unlock to move"
      : "Lock in place";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onDoubleClick={(event) => {
        if (!onReset) return;
        event.stopPropagation();
        onReset();
      }}
      onKeyDown={(event) => {
        if (!onReset || event.key.toLowerCase() !== "r") return;
        event.preventDefault();
        event.stopPropagation();
        onReset();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title={title}
      aria-label={
        locked ? localizeUi("ui.game.panellockbutton.unlockPanel") : localizeUi("ui.game.panellockbutton.lockPanel")
      }
      aria-pressed={!locked}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)]",
        "transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)]",
        className,
      )}
    >
      {locked ? <Lock size={size} /> : <Unlock size={size} />}
    </button>
  );
}
