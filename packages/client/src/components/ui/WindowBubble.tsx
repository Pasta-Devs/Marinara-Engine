// ──────────────────────────────────────────────
// Window bubble: a small button the user places anywhere
//
// A minimized window shows as one on a computer; on a phone every control window,
// popped-out drawer and the Tracker Panel do. It drags with the pointer (a short
// press opens it instead), snaps into line with the other bubbles but never onto
// one, moves with the arrow keys and stays inside its bounds. A bubble with a banner (a
// tracker's live summary) is as wide as that summary. Themes style `.mari-window-bubble`.
// ──────────────────────────────────────────────
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  WINDOW_BUBBLE_SIZE_PX,
  WINDOW_KEYBOARD_LARGE_STEP_PX,
  WINDOW_KEYBOARD_STEP_PX,
  clampWindowBubble,
  dropWindowBubble,
  getBannerPoint,
  placeWindowBubbles,
  type BubbleSize,
  type FloatingWindowId,
  type WindowBounds,
  type WindowPoint,
} from "../../lib/floating-window-layout";
import type { SnapGuide } from "../../lib/window-bubble-snap";

/** A press that moves less than this (px) opens the bubble instead of dragging it; touch gets more room. */
const DRAG_START_PX = { mouse: 4, touch: 10 } as const;

// Mounted bubbles share only their temporary screen positions. Saved chat layouts stay untouched.
const mountedBubbles = new Map<string, { point: WindowPoint; bounds: WindowBounds; size: BubbleSize }>();
const placementListeners = new Set<() => void>();
let bubblePlacements = new Map<string, WindowPoint>();
const readBubblePlacements = () => bubblePlacements;
const subscribeBubblePlacements = (listener: () => void) => {
  placementListeners.add(listener);
  return () => placementListeners.delete(listener);
};
function updateBubblePlacements() {
  const next = placeWindowBubbles(mountedBubbles);
  if (
    next.size === bubblePlacements.size &&
    [...next].every(([id, point]) => {
      const current = bubblePlacements.get(id);
      return current?.x === point.x && current.y === point.y;
    })
  ) {
    return;
  }
  bubblePlacements = next;
  placementListeners.forEach((listener) => listener());
}

type BubbleDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  start: WindowPoint;
  threshold: number;
  moved: boolean;
  /** The other bubbles on screen, measured once when the drag starts. */
  others: { x: number; y: number; width: number; height: number }[];
};

export interface WindowBubbleProps {
  id: FloatingWindowId;
  /** Where it sits (its top-left corner, viewport pixels); clamped to `bounds` here. */
  point: WindowPoint;
  bounds: WindowBounds;
  /** Its size before it is measured (px). */
  size?: number;
  /** Lets default rows and attached hints follow the size chosen by the theme or display setting. */
  onSizeChange?: (size: number) => void;
  /** An attached menu follows the temporary on-screen position, including clamping and dragging. */
  onPositionChange?: (point: WindowPoint) => void;
  icon: ReactNode;
  /** A live summary shown instead of the icon, on a bubble as wide as it needs (World State's date and time, say). */
  banner?: ReactNode;
  /** Names the window it opens. */
  label: string;
  /** Replaces the "Open {label}" name and its drag hint (a button that toggles its window, say). */
  ariaLabel?: string;
  tooltip?: string;
  /** Set for a button that toggles its window: whether the window is open. */
  expanded?: boolean;
  /** The window's lock also keeps its button in place; opening it still works. */
  locked?: boolean;
  /** The id of text that describes the button (a status shown on it). */
  describedBy?: string;
  zIndex: number;
  attributes?: Record<`data-${string}`, string | boolean | undefined>;
  /** The button, so its window can move focus to it. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
  onMove: (point: WindowPoint) => void;
  onOpen: (bubble: HTMLButtonElement) => void;
  /** Drawn on top of the icon (a status dot, say). */
  children?: ReactNode;
}

export function WindowBubble({
  id,
  point,
  bounds,
  size = WINDOW_BUBBLE_SIZE_PX,
  onSizeChange,
  onPositionChange,
  icon,
  banner,
  label,
  ariaLabel,
  tooltip,
  expanded,
  locked = false,
  describedBy,
  zIndex,
  attributes,
  buttonRef,
  onMove,
  onOpen,
  children,
}: WindowBubbleProps) {
  const { t } = useTranslation();
  const ownRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = buttonRef ?? ownRef;
  const dragRef = useRef<BubbleDrag | null>(null);
  const frameRef = useRef(0);
  const suppressClickRef = useRef(false);
  /** A touch press already settled on release; its click, if one still comes, must not repeat it. */
  const touchHandledRef = useRef(false);
  const [live, setLive] = useState<{ point: WindowPoint; guides: SnapGuide[] } | null>(null);
  const [renderedWidth, setRenderedWidth] = useState(size);
  const [renderedHeight, setRenderedHeight] = useState(size);
  const renderedSize = { width: renderedWidth, height: renderedHeight };
  const hasBanner = Boolean(banner);
  // A banner's text (what it shows, for screen readers) describes the button; its name stays "Open …".
  const bannerId = `mari-window-bubble-banner-${useId().replace(/:/gu, "")}`;
  const origin = hasBanner ? getBannerPoint(point, renderedSize) : point;
  const placements = useSyncExternalStore(subscribeBubblePlacements, readBubblePlacements, readBubblePlacements);
  const placed = clampWindowBubble(live?.point ?? placements.get(id) ?? origin, bounds, renderedSize);

  useLayoutEffect(() => {
    onPositionChange?.({ x: placed.x, y: placed.y });
  }, [onPositionChange, placed.x, placed.y]);

  useLayoutEffect(() => {
    mountedBubbles.set(id, {
      // A banner grows with its summary, so it is the one to give way when it grows into a neighbour.
      point: { x: origin.x, y: origin.y, automatic: hasBanner || point.automatic ? true : undefined },
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      size: { width: renderedWidth, height: renderedHeight },
    });
    updateBubblePlacements();
  }, [
    id,
    origin.x,
    origin.y,
    point.automatic,
    hasBanner,
    bounds.left,
    bounds.top,
    bounds.right,
    bounds.bottom,
    renderedWidth,
    renderedHeight,
  ]);
  useLayoutEffect(
    () => () => {
      mountedBubbles.delete(id);
      updateBubblePlacements();
    },
    [id],
  );

  useLayoutEffect(() => {
    const element = bubbleRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const side = Math.max(rect.width, rect.height) || size;
      // A banner keeps its own width; every other bubble counts as the square it is drawn as. Rows of
      // bubbles are laid out by their height, so that is the size a banner reports.
      setRenderedWidth(hasBanner ? rect.width || side : side);
      setRenderedHeight(hasBanner ? rect.height || side : side);
      onSizeChange?.(hasBanner ? rect.height || size : side);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [bubbleRef, hasBanner, onSizeChange, size]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const measuredSize = () => renderedSize;

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    touchHandledRef.current = false;
    if (locked || event.button !== 0 || dragRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const others = Array.from(document.querySelectorAll<HTMLElement>(".mari-window-bubble"))
      .filter(
        (element) =>
          element !== event.currentTarget &&
          !element.closest("[data-chat-tools-menu]") &&
          element.getClientRects().length > 0,
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      });
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: placed,
      threshold: event.pointerType === "mouse" ? DRAG_START_PX.mouse : DRAG_START_PX.touch,
      moved: false,
      others,
    };
  };

  /** Where the bubble lands for this pointer position; Alt places it freely, without snapping. */
  const readDrop = (drag: BubbleDrag, event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = measuredSize();
    const raw = clampWindowBubble(
      { x: drag.start.x + event.clientX - drag.startX, y: drag.start.y + event.clientY - drag.startY },
      bounds,
      current,
    );
    if (event.altKey) return { point: raw, guides: [] };
    return dropWindowBubble(raw, drag.others, bounds, current);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (locked || !drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance < drag.threshold) return;
    drag.moved = true;
    const next = readDrop(drag, event);
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => setLive(next));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    cancelAnimationFrame(frameRef.current);
    setLive(null);
    if (event.type === "pointercancel") return;
    if (event.pointerType === "touch") {
      // Touch is settled here, not by the browser's click: Chromium sends no click for a tap made
      // just after a flick (it reads it as stopping a fling), and a drag must not click.
      touchHandledRef.current = true;
      if (!drag.moved) onOpen(event.currentTarget);
      else if (!locked) onMove(readDrop(drag, event).point);
      return;
    }
    if (locked || !drag.moved) return;
    // The click that ends a mouse drag must not open the window too.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    onMove(readDrop(drag, event).point);
  };

  // Cancelling touchend stops the browser's own click for a touch press already settled above.
  const handleTouchEnd = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (!touchHandledRef.current || !event.cancelable) return;
    event.preventDefault();
    touchHandledRef.current = false;
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(event.currentTarget);
  };

  // Arrow keys move the bubble (no snapping); Enter and Space open it.
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    // A key press is never the click of an earlier tap.
    touchHandledRef.current = false;
    const step = event.shiftKey ? WINDOW_KEYBOARD_LARGE_STEP_PX : WINDOW_KEYBOARD_STEP_PX;
    const delta =
      event.key === "ArrowLeft"
        ? { dx: -step, dy: 0 }
        : event.key === "ArrowRight"
          ? { dx: step, dy: 0 }
          : event.key === "ArrowUp"
            ? { dx: 0, dy: -step }
            : event.key === "ArrowDown"
              ? { dx: 0, dy: step }
              : null;
    if (!delta) return;
    event.preventDefault();
    if (locked) return;
    onMove(clampWindowBubble({ x: placed.x + delta.dx, y: placed.y + delta.dy }, bounds, measuredSize()));
  };

  return (
    <>
      <button
        ref={bubbleRef}
        type="button"
        data-window={id}
        data-minimized="true"
        data-dragging={live ? "true" : undefined}
        data-banner={hasBanner ? "true" : undefined}
        {...attributes}
        data-locked={locked ? "true" : "false"}
        className="mari-window-bubble fixed"
        style={{ left: placed.x, top: placed.y, zIndex }}
        aria-label={ariaLabel ?? t("window.bubble.label", { title: label })}
        aria-expanded={expanded}
        aria-describedby={describedBy ?? (hasBanner ? bannerId : undefined)}
        title={
          locked
            ? t("window.bubble.lockedHint", { title: label })
            : (tooltip ?? t("window.bubble.hint", { title: label }))
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span className="mari-window-bubble__paint pointer-events-none" aria-hidden="true" />
        {hasBanner ? (
          <span id={bannerId} className="mari-window-bubble__banner">
            {banner}
          </span>
        ) : (
          <span className="mari-window-bubble__icon">{icon}</span>
        )}
        {children}
      </button>
      {live?.guides.map((guide) => (
        <div
          key={`${guide.axis}:${guide.at}`}
          aria-hidden="true"
          data-axis={guide.axis}
          className="mari-window-snap-guide"
          style={
            guide.axis === "x"
              ? { left: guide.at, top: guide.from, width: 1, height: guide.to - guide.from, zIndex }
              : { left: guide.from, top: guide.at, width: guide.to - guide.from, height: 1, zIndex }
          }
        />
      ))}
    </>
  );
}
