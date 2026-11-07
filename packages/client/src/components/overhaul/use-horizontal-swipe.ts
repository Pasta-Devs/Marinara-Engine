// ──────────────────────────────────────────────
// UI overhaul, phones: one horizontal swipe for every swipe gesture
//
// The top-bar title (previous/next tab) and the chat-list rows (Pin, Rename,
// Delete) share these thresholds, so every swipe in the app feels the same.
// Vertical scrolling always wins on a diagonal drag; touches that start at a
// screen edge are left to the browser's own back/forward gesture.
// ──────────────────────────────────────────────
import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";

export type SwipeDirection = "left" | "right";

/** Sideways travel before a drag counts as a swipe at all. */
export const SWIPE_START_PX = 24;
/** Sideways travel that commits a swipe on release. */
export const SWIPE_COMMIT_PX = 60;
/** A flick this fast commits a shorter swipe. */
export const SWIPE_FLICK_PX_PER_MS = 0.4;
/** Touches that start this close to either screen edge belong to the browser. */
export const SWIPE_EDGE_PX = 20;
/** Horizontal wins only when it is this much larger than the vertical travel. */
export const SWIPE_AXIS_RATIO = 1.5;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Drag = {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  axis: "x" | null;
  dx: number;
  el: HTMLElement;
};

export function useHorizontalSwipe({
  enabled,
  onSwipe,
  canSwipe,
  follow = true,
  maxFollow = 96,
  restOffset = 0,
  onDragChange,
  onDrag,
  moveTarget,
}: {
  enabled: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** A direction that cannot go anywhere rubber-bands and never commits. */
  canSwipe?: (direction: SwipeDirection) => boolean;
  /** Move the element with the finger while dragging. */
  follow?: boolean;
  maxFollow?: number;
  /** Where the element rests (px), e.g. a row whose actions are open sits at -tray width. */
  restOffset?: number;
  /** Told when a sideways drag starts and ends (e.g. to show what sits under a sliding row). */
  onDragChange?: (dragging: boolean) => void;
  /** Told the shown offset while dragging (null once it settles), for visuals the element itself can't carry. */
  onDrag?: (offset: number | null) => void;
  /** Moves this element instead of the one holding the handlers (e.g. a title inside a clipping box). */
  moveTarget?: (el: HTMLElement) => HTMLElement | null;
}) {
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  if (!enabled) return {};

  const place = (holder: HTMLElement, x: number, animate: boolean) => {
    onDrag?.(animate ? null : x);
    if (!follow) return;
    const el = moveTarget?.(holder) ?? holder;
    el.style.transition = animate && !prefersReducedMotion() ? "transform 180ms ease" : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
  };

  const finish = (event: ReactPointerEvent<HTMLElement>, released: boolean) => {
    const current = drag.current;
    drag.current = null;
    if (!current || current.pointerId !== event.pointerId || current.axis !== "x") return;
    swallowClick.current = true;
    onDragChange?.(false);
    const direction: SwipeDirection = current.dx < 0 ? "left" : "right";
    const distance = Math.abs(current.dx);
    const speed = distance / Math.max(1, event.timeStamp - current.time);
    const commit =
      released &&
      (canSwipe?.(direction) ?? true) &&
      (distance >= SWIPE_COMMIT_PX || (distance >= SWIPE_START_PX && speed >= SWIPE_FLICK_PX_PER_MS));
    // Clearing the inline offset hands the element back to its class, which may now say "open".
    place(current.el, 0, true);
    if (!commit) return;
    navigator.vibrate?.(10);
    onSwipe(direction);
  };

  return {
    "data-ovm-swipe": "true",
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      swallowClick.current = false;
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      if (event.clientX < SWIPE_EDGE_PX || event.clientX > window.innerWidth - SWIPE_EDGE_PX) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        axis: null,
        dx: 0,
        el: event.currentTarget,
      };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.axis) {
        if (Math.abs(dx) > SWIPE_START_PX && Math.abs(dx) > SWIPE_AXIS_RATIO * Math.abs(dy)) {
          current.axis = "x";
          current.time = event.timeStamp;
          onDragChange?.(true);
        } else if (Math.abs(dy) > SWIPE_START_PX) {
          drag.current = null;
          return;
        } else return;
      }
      current.dx = dx;
      const direction: SwipeDirection = dx < 0 ? "left" : "right";
      const free = canSwipe?.(direction) ?? true;
      const shown = Math.max(-maxFollow, Math.min(maxFollow, free ? dx : dx * 0.25));
      if (!prefersReducedMotion()) place(current.el, restOffset + shown, false);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, false),
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
