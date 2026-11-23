// ──────────────────────────────────────────────
// ContextMenu — small portal-rendered right-click menu
//
// Anchored at a point rather than an element (see `Popover` for that). Rows, keys and dismissal are shared with
// `Popover`: `MenuItems`, `moveMenuFocus` and `useDismiss`.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { useDismiss } from "../../hooks/use-dismiss";
import { BOTTOM_SHEET_CLASS } from "./neutral-surface-styles";
import { MenuItems, moveMenuFocus, POPOVER_Z_INDEX, type MenuItem } from "./Popover";

export type ContextMenuItem = MenuItem;

interface ContextMenuProps {
  /** Page-relative coordinates (e.clientX / e.clientY) where the menu should anchor. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Visual treatment for destructive items. Defaults to the semantic destructive color. */
  destructiveTone?: "destructive" | "accent";
  /** Opened from the keyboard: focus the first item, and return focus when the menu closes. */
  autoFocus?: boolean;
  /** "end" puts the menu's right edge at x, so a button near the right edge opens it leftward. */
  align?: "start" | "end";
}

// The button under the last left press, so a menu knows which button opened it.
let lastPressedButton: Element | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPressedButton = e.button === 0 && e.target instanceof Element ? e.target.closest("button") : null;
    },
    true,
  );
  // A keyboard click (detail 0) has no pointerdown, so its own button is the opener.
  document.addEventListener(
    "click",
    (e) => {
      if (e.detail === 0 && e.target instanceof Element) lastPressedButton = e.target.closest("button");
    },
    true,
  );
}

/** Right-click menu anchored at (x, y). Auto-flips when it would clip the viewport. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
  destructiveTone = "destructive",
  autoFocus = false,
  align = "start",
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const opener = useRef(lastPressedButton);
  const [pos, setPos] = useState({ left: x, top: y });
  // On a touch phone the menu is an action sheet: rows a thumb can hit, no hunting near the finger.
  const [sheet] = useState(() => window.matchMedia("(max-width: 639px) and (pointer: coarse)").matches);

  // Escape, a press outside, back, and a press on the opener (which only closes).
  useDismiss(ref, true, onClose, { openerRef: opener });

  // Flip / clamp the menu so it always stays inside the viewport. A layout effect, so it never paints at the
  // unadjusted spot first.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = align === "end" ? x - rect.width : x;
    let top = y;
    if (left + rect.width > window.innerWidth - 4) left = window.innerWidth - rect.width - 4;
    if (top + rect.height > window.innerHeight - 4) top = window.innerHeight - rect.height - 4;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    setPos({ left, top });
  }, [x, y, align]);

  // Keyboard users land inside the menu, and return to where they were when it closes.
  useEffect(() => {
    if (!autoFocus) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menu = ref.current;
    (
      menu?.querySelector<HTMLButtonElement>('button[aria-checked="true"]:not(:disabled)') ??
      menu?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    )?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, [autoFocus]);

  // Arrow keys reach the menu even while focus is still on the page, except from a text field. A point-anchored
  // menu can't follow the page, so scrolling the page behind it or resizing the window closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const menu = ref.current;
      const active = document.activeElement;
      if (!menu) return;
      const typing =
        active instanceof HTMLElement &&
        !menu.contains(active) &&
        active.matches("input, textarea, select, [contenteditable]");
      if (!typing) moveMenuFocus(menu, e);
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const raf = requestAnimationFrame(() => {
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onClose);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <>
      {/* Catches the outside tap: the outside-press handler closes the menu and the tap lands here, not on the page. */}
      {sheet && <div aria-hidden="true" className="fixed inset-0 bg-black/55" style={{ zIndex: POPOVER_Z_INDEX }} />}
      <div
        ref={ref}
        role="menu"
        style={
          sheet
            ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: POPOVER_Z_INDEX }
            : { position: "fixed", left: pos.left, top: pos.top, zIndex: POPOVER_Z_INDEX }
        }
        className={
          sheet
            ? cn(
                "mari-context-menu max-h-[80dvh] overflow-y-auto border border-[var(--border)] bg-[var(--card)] px-2 shadow-xl backdrop-blur-xl animate-fade-in-up",
                BOTTOM_SHEET_CLASS,
              )
            : "mari-context-menu max-h-[calc(var(--mari-visual-viewport-height,100dvh)-0.5rem)] min-w-[12rem] max-w-[min(20rem,calc(100vw-0.5rem))] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl animate-fade-in-up"
        }
        onContextMenu={(e) => e.preventDefault()}
      >
        <MenuItems items={items} onClose={onClose} sheet={sheet} destructiveTone={destructiveTone} />
      </div>
    </>,
    document.body,
  );
}
