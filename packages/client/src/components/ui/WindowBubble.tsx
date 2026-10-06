// ──────────────────────────────────────────────
// Window bubble: a small button the user places anywhere
//
// A minimized window shows as one on a computer; on a phone every control window,
// popped-out drawer and the Tracker Panel do. It drags with the pointer (a short
// press opens it instead), snaps into line with the other bubbles, moves with the
// arrow keys and stays inside its bounds. Themes style `.mari-window-bubble`.
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import {
  WINDOW_BUBBLE_SIZE_PX,
  WINDOW_KEYBOARD_LARGE_STEP_PX,
  WINDOW_KEYBOARD_STEP_PX,
  clampWindowBubble,
  placeWindowBubbles,
  type FloatingWindowId,
  type WindowBounds,
  type WindowPoint,
} from "../../lib/floating-window-layout";
import { snapBubble, type SnapGuide } from "../../lib/window-bubble-snap";

/** A press that moves less than this (px) opens the bubble instead of dragging it; touch gets more room. */
const DRAG_START_PX = { mouse: 4, touch: 10 } as const;

// Mounted bubbles share only their temporary screen positions. Saved chat layouts stay untouched.
const mountedBubbles = new Map<string, { point: WindowPoint; bounds: WindowBounds; size: number }>();
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
  const [live, setLive] = useState<{ point: WindowPoint; guides: SnapGuide[] } | null>(null);
  const [renderedSize, setRenderedSize] = useState(size);
  const placements = useSyncExternalStore(subscribeBubblePlacements, readBubblePlacements, readBubblePlacements);
  const placed = clampWindowBubble(live?.point ?? placements.get(id) ?? point, bounds, renderedSize);

  useLayoutEffect(() => {
    onPositionChange?.({ x: placed.x, y: placed.y });
  }, [onPositionChange, placed.x, placed.y]);

  useLayoutEffect(() => {
    mountedBubbles.set(id, {
      point: { x: point.x, y: point.y, automatic: point.automatic },
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      size: renderedSize,
    });
    updateBubblePlacements();
  }, [id, point.x, point.y, point.automatic, bounds.left, bounds.top, bounds.right, bounds.bottom, renderedSize]);
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
      const next = Math.max(rect.width, rect.height) || size;
      setRenderedSize(next);
      onSizeChange?.(next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [bubbleRef, onSizeChange, size]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const measuredSize = () => renderedSize;

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
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
    const snapped = snapBubble({ ...raw, width: current, height: current }, drag.others);
    return { point: clampWindowBubble(snapped, bounds, current), guides: snapped.guides };
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
    if (locked || !drag.moved || event.type === "pointercancel") return;
    // The click that ends a drag must not open the window too.
    suppressClickRef.current = true;
    // Touch drags may end without a click; do not swallow the next deliberate tap.
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    onMove(readDrop(drag, event).point);
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(event.currentTarget);
  };

  // Arrow keys move the bubble (no snapping); Enter and Space open it.
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
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
        {...attributes}
        data-locked={locked ? "true" : "false"}
        className="mari-window-bubble fixed"
        style={{ left: placed.x, top: placed.y, zIndex }}
        aria-label={ariaLabel ?? t("window.bubble.label", { title: label })}
        aria-expanded={expanded}
        aria-describedby={describedBy}
        title={
          locked
            ? t("window.bubble.lockedHint", { title: label })
            : (tooltip ?? t("window.bubble.hint", { title: label }))
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span className="mari-window-bubble__paint pointer-events-none" aria-hidden="true" />
        <span className="mari-window-bubble__icon">{icon}</span>
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
