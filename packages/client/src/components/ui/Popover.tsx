// ──────────────────────────────────────────────
// Popover — a layer anchored to an element, plus shared menu rows
//
// Anchored below or above its anchor, it flips when there is no room and stays inside the window. It renders into
// the anchor's own document, so a popover opened in a popped-out window (`DetachedWindow`) shows there. Escape,
// outside presses and back close it through `useDismiss`, topmost layer first.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useDismiss, type DismissOptions } from "../../hooks/use-dismiss";

/** Above a modal (z 10000), so a popover opened inside a dialog shows. */
export const POPOVER_Z_INDEX = 10001;

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the popover sits next to. Also its opener, unless `dismiss.openerRef` names another. */
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Preferred side; it flips when the other side has more room. Default "bottom". */
  side?: "top" | "bottom";
  /** Edge of the anchor the popover lines up with. Default "start". */
  align?: "start" | "center" | "end";
  /** Space between anchor and popover, in px. Default 6. */
  gap?: number;
  /** At least as wide as the anchor. */
  matchAnchorWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  role?: "menu" | "dialog" | "listbox";
  "aria-label"?: string;
  /** Overrides for `useDismiss`, such as `{ outsideClick: false }`. */
  dismiss?: DismissOptions;
}

const WINDOW_PADDING = 8;

interface Placement {
  top: number;
  left: number;
  maxHeight: number;
  minWidth?: number;
}

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  side = "bottom",
  align = "start",
  gap = 6,
  matchAnchorWidth = false,
  className,
  style,
  role,
  "aria-label": ariaLabel,
  dismiss,
}: PopoverProps) {
  // The outer layer is placed and clamped to the room beside the anchor; the panel inside keeps the caller's
  // classes, so a caller's own max-h-* still applies and the panel scrolls within whichever limit is smaller.
  const ref = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  // The anchor's document, read after commit: the anchor may attach in the same render that opens the popover.
  const [body, setBody] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setBody(open ? (anchorRef.current?.ownerDocument.body ?? null) : null);
  }, [open, anchorRef]);
  const mounted = open && !!body;
  useDismiss(ref, mounted, onClose, { openerRef: anchorRef, ...dismiss });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    const view = anchor?.ownerDocument.defaultView;
    if (!anchor || !panel || !view) return;
    const a = anchor.getBoundingClientRect();
    // The visible part of the window: on a phone, pinch zoom and the keyboard shrink it.
    const visual = view.visualViewport;
    const viewTop = visual?.offsetTop ?? 0;
    const viewLeft = visual?.offsetLeft ?? 0;
    const viewBottom = viewTop + (visual?.height ?? view.innerHeight);
    const viewRight = viewLeft + (visual?.width ?? view.innerWidth);

    const minWidth = matchAnchorWidth ? Math.min(a.width, viewRight - viewLeft - WINDOW_PADDING * 2) : undefined;
    const width = Math.max(panel.offsetWidth, minWidth ?? 0);
    // Its natural height, capped by the caller's own max-height (the panel carries no inline one).
    const ownMax = Number.parseFloat(view.getComputedStyle(panel).maxHeight);
    const height = Math.min(
      panel.scrollHeight + (panel.offsetHeight - panel.clientHeight),
      Number.isFinite(ownMax) ? ownMax : Infinity,
    );

    const below = viewBottom - a.bottom - gap - WINDOW_PADDING;
    const above = a.top - viewTop - gap - WINDOW_PADDING;
    const useTop = side === "top" ? height <= above || above > below : height > below && above > below;
    const top = Math.max(
      viewTop + WINDOW_PADDING,
      Math.min(
        useTop ? a.top - gap - Math.min(height, Math.max(0, above)) : a.bottom + gap,
        viewBottom - WINDOW_PADDING,
      ),
    );
    // The room left below the clamped top, so an anchor scrolled out of view can't stretch the panel past the edge.
    const room = Math.max(0, Math.min(useTop ? above : below, viewBottom - WINDOW_PADDING - top));

    const preferredLeft =
      align === "end" ? a.right - width : align === "center" ? a.left + a.width / 2 - width / 2 : a.left;
    // A panel wider than the zoomed-in view is clamped to the whole page instead, so panning reaches its far edge
    // rather than dragging the panel along.
    const fitsView = width <= viewRight - viewLeft - WINDOW_PADDING * 2;
    const minLeft = fitsView ? viewLeft : 0;
    const maxRight = fitsView ? viewRight : view.innerWidth;
    const left = Math.max(minLeft + WINDOW_PADDING, Math.min(preferredLeft, maxRight - WINDOW_PADDING - width));

    setPlacement((current) =>
      current &&
      current.top === top &&
      current.left === left &&
      current.maxHeight === room &&
      current.minWidth === minWidth
        ? current
        : { top, left, maxHeight: room, minWidth },
    );
  }, [anchorRef, side, align, gap, matchAnchorWidth]);

  // Measured before paint, then kept in place while the page scrolls, the window resizes or the content changes.
  useLayoutEffect(() => {
    if (!mounted) {
      setPlacement(null);
      return;
    }
    place();
    const view = anchorRef.current?.ownerDocument.defaultView;
    if (!view) return;
    let frame = 0;
    const schedule = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(place);
    };
    view.addEventListener("resize", schedule);
    view.addEventListener("scroll", schedule, true);
    view.visualViewport?.addEventListener("resize", schedule);
    view.visualViewport?.addEventListener("scroll", schedule);
    const observer = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(schedule) : null;
    if (panelRef.current) observer?.observe(panelRef.current);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    return () => {
      view.cancelAnimationFrame(frame);
      view.removeEventListener("resize", schedule);
      view.removeEventListener("scroll", schedule, true);
      view.visualViewport?.removeEventListener("resize", schedule);
      view.visualViewport?.removeEventListener("scroll", schedule);
      observer?.disconnect();
    };
  }, [mounted, place, anchorRef]);

  // Closing with focus inside (Escape, or a row that closes it) hands focus back to the anchor. A press elsewhere
  // already moved focus where the user wanted it, so it is left there.
  useEffect(() => {
    if (!mounted) return;
    const layer = ref.current;
    const anchor = anchorRef.current;
    return () => {
      const active = anchor?.ownerDocument.activeElement;
      if (anchor?.isConnected && (!active || active === anchor.ownerDocument.body || layer?.contains(active))) {
        anchor.focus({ preventScroll: true });
      }
    };
  }, [mounted, anchorRef]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      data-component="Popover"
      className="fixed flex flex-col"
      style={{
        zIndex: POPOVER_Z_INDEX,
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        maxHeight: placement?.maxHeight,
        // Hidden until measured, so it never paints at the corner first.
        visibility: placement ? undefined : "hidden",
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-label={ariaLabel}
        className={cn(
          "min-h-0 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl animate-fade-in-up",
          className,
        )}
        style={{ ...style, minWidth: placement?.minWidth ?? style?.minWidth }}
      >
        {children}
      </div>
    </div>,
    body,
  );
}

// ── Menu rows ──

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Muted second line, such as the Connection a Model belongs to. */
  hint?: string;
  /** Marks the current choice when the menu picks one value. */
  checked?: boolean;
  /** An on/off setting: `checked` is its state, not the menu's one choice. */
  toggle?: boolean;
}

/**
 * Arrow keys, Home and End move between a menu's enabled buttons (wrapping); Enter and Space are the buttons' own.
 * Put it on the element that holds the buttons.
 */
export function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
  moveMenuFocus(event.currentTarget, event);
}

/** `handleMenuKeyDown` for a listener outside the menu, such as a window listener while focus is still on the page. */
export function moveMenuFocus(
  menu: HTMLElement,
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "preventDefault" | "stopPropagation">,
) {
  const move = ({ ArrowDown: 1, ArrowUp: -1, Home: 0, End: 0 } as Record<string, number | undefined>)[event.key];
  if (move === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
  const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  if (buttons.length === 0) return;
  const active = menu.ownerDocument.activeElement;
  const at = buttons.findIndex((button) => button === active);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : at < 0
          ? move > 0
            ? 0
            : buttons.length - 1
          : (at + move + buttons.length) % buttons.length;
  event.preventDefault();
  event.stopPropagation();
  const row = buttons[next];
  if (!row) return;
  row.focus({ preventScroll: true });
  // preventScroll keeps the page still (a page scroll closes a ContextMenu); scroll only the menu to the row.
  const box = menu.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  if (rowBox.top < box.top) menu.scrollTop -= box.top - rowBox.top;
  else if (rowBox.bottom > box.bottom) menu.scrollTop += rowBox.bottom - box.bottom;
}

/** The rows of a menu: icon, label, optional hint and check. `sheet` gives phone-sized rows. */
export function MenuItems({
  items,
  onClose,
  sheet = false,
  destructiveTone = "destructive",
}: {
  items: MenuItem[];
  onClose: () => void;
  sheet?: boolean;
  destructiveTone?: "destructive" | "accent";
}) {
  return (
    <>
      {items.map((item, i) => (
        <button
          key={`${item.label}-${i}`}
          type="button"
          role={item.toggle ? "menuitemcheckbox" : item.checked === undefined ? "menuitem" : "menuitemradio"}
          aria-checked={item.checked}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-2 text-left transition-colors outline-none focus-visible:bg-[var(--accent)]",
            sheet ? "min-h-12 rounded-lg px-3 text-sm" : "px-3 py-1.5 text-xs",
            item.disabled
              ? "cursor-not-allowed text-[var(--muted-foreground)] opacity-50"
              : item.destructive
                ? destructiveTone === "accent"
                  ? "text-[var(--primary)] hover:bg-[var(--primary)]/10"
                  : "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                : "text-[var(--foreground)] hover:bg-[var(--accent)]",
          )}
        >
          {item.icon && <span className="shrink-0 text-[var(--muted-foreground)]">{item.icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{item.label}</span>
            {item.hint && (
              <span
                className={`block truncate ${sheet ? "text-[13px]" : "text-[0.625rem]"} text-[var(--muted-foreground)]`}
              >
                {item.hint}
              </span>
            )}
          </span>
          {item.checked && <Check size="0.75rem" className="shrink-0 text-[var(--primary)]" />}
        </button>
      ))}
    </>
  );
}
