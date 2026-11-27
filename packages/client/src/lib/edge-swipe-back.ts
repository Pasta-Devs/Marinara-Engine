// ──────────────────────────────────────────────
// Left-edge swipe back for the installed iPhone / iPad app
//
// Safari's own left-edge swipe goes back through the Engine (back-navigation.ts
// keeps one history entry per open layer). An app added to the Home Screen runs
// without Safari's chrome and has no back swipe at all, so there the same swipe is
// ours: a finger that starts at the left edge (the right edge in right-to-left
// languages) and moves inward pulls out a round arrow; let go past the line and it
// steps back once, exactly like Safari's swipe would. Nothing happens when there is
// nothing to go back to.
//
// Only in the installed app (`navigator.standalone`). Android has its own back
// gesture, and in a browser the edge belongs to the browser.
// ──────────────────────────────────────────────
import { getBackLayerStack } from "./back-navigation";

/** Touches must start this close to the edge (matches use-horizontal-swipe's SWIPE_EDGE_PX). */
export const EDGE_START_PX = 20;
/** Inward travel that counts on release. */
export const EDGE_COMMIT_PX = 72;
/** A flick this fast commits a shorter swipe (px/ms), once past EDGE_FLICK_MIN_PX. */
const EDGE_FLICK_PX_PER_MS = 0.5;
const EDGE_FLICK_MIN_PX = 32;
/** Sideways must beat vertical by this much before the swipe is taken. */
const EDGE_AXIS_RATIO = 1.2;
/** The arrow travels at most this far in from the edge. */
const ARROW_TRAVEL_PX = 56;

/** The installed iPhone / iPad app (added to the Home Screen). */
export function isInstalledIosApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Pure: whether a release at `dx` inward after `ms` steps back (exported for the regression script). */
export function edgeSwipeCommits(dx: number, ms: number): boolean {
  if (dx >= EDGE_COMMIT_PX) return true;
  return dx >= EDGE_FLICK_MIN_PX && ms > 0 && dx / ms >= EDGE_FLICK_PX_PER_MS;
}

type Drag = { id: number; x: number; y: number; time: number; taken: boolean; fromRight: boolean };

/** Installs the swipe. Returns the cleanup (a no-op outside the installed app). */
export function installEdgeSwipeBack(force = false): () => void {
  if (!force && !isInstalledIosApp()) return () => {};
  let drag: Drag | null = null;
  let arrow: HTMLDivElement | null = null;

  const showArrow = (dx: number, y: number, fromRight: boolean) => {
    if (!arrow) {
      arrow = document.createElement("div");
      arrow.className = "edge-back-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
      document.body.appendChild(arrow);
    }
    const travel = Math.min(ARROW_TRAVEL_PX, dx * 0.6);
    arrow.dataset.side = fromRight ? "right" : "left";
    arrow.dataset.armed = dx >= EDGE_COMMIT_PX ? "true" : "false";
    arrow.style.top = `${y}px`;
    arrow.style.setProperty("--edge-back-x", `${fromRight ? -travel : travel}px`);
    arrow.style.opacity = String(Math.min(1, dx / 40));
  };
  const hideArrow = () => {
    const el = arrow;
    arrow = null;
    if (!el) return;
    el.style.opacity = "0";
    window.setTimeout(() => el.remove(), 160);
  };

  const onStart = (event: TouchEvent) => {
    drag = null;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0]!;
    const rtl = document.documentElement.dir === "rtl";
    const fromRight = rtl;
    const fromEdge = fromRight ? window.innerWidth - touch.clientX : touch.clientX;
    if (fromEdge > EDGE_START_PX) return;
    // Nothing open to step back from (Home, nothing over it): leave the touch alone.
    if (getBackLayerStack().length === 0) return;
    drag = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp, taken: false, fromRight };
  };
  const onMove = (event: TouchEvent) => {
    if (!drag) return;
    const touch = Array.from(event.touches).find((entry) => entry.identifier === drag!.id);
    if (!touch) return;
    const dx = drag.fromRight ? drag.x - touch.clientX : touch.clientX - drag.x;
    const dy = Math.abs(touch.clientY - drag.y);
    if (!drag.taken) {
      if (dy > 12 && dy * EDGE_AXIS_RATIO > dx) {
        drag = null;
        return;
      }
      if (dx < 10) return;
      drag.taken = true;
    }
    // Ours now: the page under the finger must not scroll or swipe as well.
    if (event.cancelable) event.preventDefault();
    showArrow(Math.max(0, dx), touch.clientY, drag.fromRight);
  };
  const onEnd = (event: TouchEvent) => {
    const current = drag;
    drag = null;
    if (!current?.taken) return;
    const touch = Array.from(event.changedTouches).find((entry) => entry.identifier === current.id);
    hideArrow();
    if (!touch || event.type === "touchcancel") return;
    const dx = current.fromRight ? current.x - touch.clientX : touch.clientX - current.x;
    if (edgeSwipeCommits(dx, event.timeStamp - current.time)) window.history.back();
  };

  document.addEventListener("touchstart", onStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onMove, { passive: false, capture: true });
  document.addEventListener("touchend", onEnd, { capture: true });
  document.addEventListener("touchcancel", onEnd, { capture: true });
  return () => {
    hideArrow();
    document.removeEventListener("touchstart", onStart, { capture: true });
    document.removeEventListener("touchmove", onMove, { capture: true });
    document.removeEventListener("touchend", onEnd, { capture: true });
    document.removeEventListener("touchcancel", onEnd, { capture: true });
  };
}
