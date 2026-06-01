import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { TrackerPanelIcon } from "../../../../shared/components/ui/TrackerPanelIcon";
import { cn } from "../../../../shared/lib/utils";
import type { HudPosition } from "../../../../shared/stores/ui.store";

/** Common mobile HUD button sizing used by strip buttons. */
export const MOBILE_HUD_BTN =
  "flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md px-2 py-1.5 transition-all hover:bg-[var(--card)] dark:border-foreground/10 dark:bg-black/40 dark:hover:bg-black/60 cursor-pointer select-none";

export const WIDGET =
  "group flex w-10 h-10 max-md:w-auto max-md:h-auto max-md:px-2 max-md:py-1.5 flex-col items-center justify-center gap-0.5 max-md:gap-0 rounded-xl max-md:rounded-lg border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md transition-all hover:bg-[var(--card)] dark:border-foreground/15 dark:bg-black/40 dark:hover:bg-black/60 cursor-pointer select-none overflow-hidden";

export function DeferredHUDPanelFallback({ label }: { label: string }) {
  return <div className="px-3 py-4 text-center text-[0.625rem] text-[var(--muted-foreground)]/60">{label}</div>;
}

export function TrackerPanelToggleButton({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      data-tracker-panel-toggle="roleplay-hud"
      onClick={onToggle}
      className={cn(WIDGET, "text-pink-200/75 hover:border-[var(--primary)]/40 hover:text-[var(--primary)]")}
      title="Show Tracker Panel"
      aria-label="Show Tracker Panel"
    >
      <TrackerPanelIcon size="1.25rem" strokeWidth={1.95} className="shrink-0" />
      <span className="sr-only">Tracker Panel</span>
    </button>
  );
}

type WidgetPopoverPlacement = "bottom" | "right" | "left";

function getWidgetPopoverPlacement(layout: HudPosition): WidgetPopoverPlacement {
  return layout === "left" ? "right" : layout === "right" ? "left" : "bottom";
}

export function getWidgetPreviewFontSize(label: string, min = 3.5, max = 6, widthFactor = 60) {
  const longestWord = label.split(/\s+/).reduce((longest, word) => Math.max(longest, word.length), 0);
  return Math.max(min, Math.min(max, widthFactor / Math.max(longestWord, 1)));
}

export function useCyclingWidgetIndex(itemCount: number, intervalMs = 3000) {
  const [cycleIdx, setCycleIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (itemCount <= 1) return;
    const timer = setInterval(() => {
      setCycleIdx((prev) => (prev + 1) % itemCount);
      setAnimKey((prev) => prev + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, itemCount]);

  useEffect(() => {
    if (cycleIdx >= itemCount) setCycleIdx(0);
  }, [cycleIdx, itemCount]);

  return {
    animKey,
    cycleIdx: itemCount > 0 ? Math.min(cycleIdx, itemCount - 1) : 0,
  };
}

export function useWidgetPopoverController(layout: HudPosition) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  return {
    buttonRef,
    close,
    open,
    placement: getWidgetPopoverPlacement(layout),
    setOpen,
    toggle,
  };
}

/** Shared popover wrapper used by tracker widgets. Renders via portal to escape overflow clipping. */
export function WidgetPopover({
  open,
  onClose,
  anchorRef,
  placement = "bottom",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: WidgetPopoverPlacement;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePosition = useCallback(() => {
    if (!anchorRef.current) return null;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = ref.current?.offsetWidth ?? 288;
    const popoverHeight = ref.current?.offsetHeight ?? 200;
    let top: number;
    let left: number;

    if (placement === "right") {
      left = rect.right + 4;
      left = Math.min(Math.max(left, 8), Math.max(8, window.innerWidth - popoverWidth - 8));
      top = rect.top;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popoverHeight - 8);
      }
    } else if (placement === "left") {
      left = rect.left - popoverWidth - 4;
      top = rect.top;
      if (left < 8) left = 8;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popoverHeight - 8);
      }
    } else {
      top = rect.bottom + 4;
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        left = Math.round((window.innerWidth - popoverWidth) / 2);
      } else {
        left = rect.left;
        if (left + popoverWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - popoverWidth - 8);
        }
      }
    }
    return { top, left };
  }, [anchorRef, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    setPos(computePosition());
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const update = () => setPos(computePosition());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !anchorRef.current?.contains(target)) {
        requestAnimationFrame(() => onClose());
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      style={pos ? { position: "fixed", top: pos.top, left: pos.left } : { position: "fixed", top: -9999, left: -9999 }}
      className={cn(
        "z-[9999] max-w-[calc(100vw-1rem)] animate-message-in rounded-xl border border-[var(--border)] bg-[var(--popover)] backdrop-blur-xl shadow-xl dark:border-foreground/10 dark:bg-black/80",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
