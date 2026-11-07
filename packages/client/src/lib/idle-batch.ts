// ──────────────────────────────────────────────
// After-paint work, batched
//
// Opening a chat defers work nobody sees yet (hover buttons, older rows) until
// the browser has painted the first view. Every caller queued in the same frame
// runs in one idle callback, so React applies their updates in one render.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

const queue = new Set<() => void>();
let scheduled = false;

function flush() {
  scheduled = false;
  const callbacks = [...queue];
  queue.clear();
  for (const callback of callbacks) callback();
}

/** Runs `callback` once the next frame has painted and the browser is idle. Returns a cancel function. */
export function onNextIdle(callback: () => void): () => void {
  queue.add(callback);
  if (!scheduled) {
    scheduled = true;
    // The frame first, so the deferred work never delays the view it was deferred for.
    requestAnimationFrame(() => {
      const idle = (window as IdleWindow).requestIdleCallback;
      if (idle) idle(flush, { timeout: 250 });
      else window.setTimeout(flush, 50);
    });
  }
  return () => {
    queue.delete(callback);
  };
}

/** False on the first render (unless `now`), true from the first idle moment after it. */
export function useArmedAfterPaint(now = false): boolean {
  const [armed, setArmed] = useState(now);
  useEffect(() => {
    if (armed) return;
    if (now) {
      setArmed(true);
      return;
    }
    return onNextIdle(() => setArmed(true));
  }, [armed, now]);
  return armed || now;
}
