// ──────────────────────────────────────────────
// Pull to refresh for a scrolling list on touch screens (the Chats list)
//
// At the top of the list, pull down: a round arrow follows the finger, turns once
// it is far enough, and on release the list reloads while it spins. Sideways drags
// (a chat row's swipe actions) and scrolling up are left alone. The list's own
// scroll position is never moved by the pull.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type RefObject } from "react";

/** Downward travel (after the resistance below) that reloads on release. */
export const PULL_REFRESH_COMMIT_PX = 64;
/** The finger moves this much for each pixel the arrow moves: the pull feels heavier than a scroll. */
const PULL_RESISTANCE = 2;
/** The arrow comes down at most this far. */
const PULL_MAX_PX = 96;
/** Spin at least this long, so a fast reload still reads as one. */
const MIN_SPIN_MS = 450;

/** Pure: how far the arrow sits for a finger `dy` below where it started (exported for the regression script). */
export function pullRefreshDistance(dy: number): number {
  return Math.max(0, Math.min(PULL_MAX_PX, dy / PULL_RESISTANCE));
}

export type PullRefreshState = { distance: number; armed: boolean; refreshing: boolean };

export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  { enabled, onRefresh }: { enabled: boolean; onRefresh: () => Promise<unknown> },
): PullRefreshState {
  const [state, setState] = useState<PullRefreshState>({ distance: 0, armed: false, refreshing: false });
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let start: { id: number; x: number; y: number } | null = null;
    let pulling = false;
    let distance = 0;
    let frame = 0;
    const paint = (next: number) => {
      distance = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setState((current) =>
          current.refreshing ? current : { distance: next, armed: next >= PULL_REFRESH_COMMIT_PX, refreshing: false },
        ),
      );
    };
    const onStart = (event: TouchEvent) => {
      start = null;
      pulling = false;
      if (busy.current || event.touches.length !== 1 || el.scrollTop > 0) return;
      const touch = event.touches[0]!;
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = Array.from(event.touches).find((entry) => entry.identifier === start!.id);
      if (!touch) return;
      const dy = touch.clientY - start.y;
      const dx = Math.abs(touch.clientX - start.x);
      if (!pulling) {
        if (dy < 0 || dx > Math.abs(dy) || el.scrollTop > 0) {
          if (Math.abs(dy) > 8 || dx > 8) start = null;
          return;
        }
        if (dy < 10) return;
        pulling = true;
      }
      // Ours now: Safari must not rubber-band the list (or the page) under the arrow.
      if (event.cancelable) event.preventDefault();
      paint(pullRefreshDistance(dy));
    };
    const onEnd = () => {
      const wasPulling = pulling;
      start = null;
      pulling = false;
      if (!wasPulling) return;
      cancelAnimationFrame(frame);
      if (distance < PULL_REFRESH_COMMIT_PX) {
        setState({ distance: 0, armed: false, refreshing: false });
        return;
      }
      busy.current = true;
      setState({ distance: PULL_REFRESH_COMMIT_PX, armed: true, refreshing: true });
      const began = performance.now();
      void Promise.resolve()
        .then(() => refresh.current())
        .catch(() => undefined)
        .then(
          () => new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_SPIN_MS - (performance.now() - began)))),
        )
        .then(() => {
          busy.current = false;
          setState({ distance: 0, armed: false, refreshing: false });
        });
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, ref]);

  return state;
}
