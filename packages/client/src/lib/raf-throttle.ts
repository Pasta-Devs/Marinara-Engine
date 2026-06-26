// ──────────────────────────────────────────────
// requestAnimationFrame coalescer
// ──────────────────────────────────────────────
//
// Coalesces rapid `call(value)` invocations so the wrapped `apply` runs at most
// once per animation frame, always with the most recently supplied value. Used
// to cap how often an expensive consumer reacts to a fast-changing source — e.g.
// re-rendering (and re-parsing the markdown of) a streamed message on every token
// floods the main thread, while the user only perceives ~60fps anyway (#2878).
//
// The scheduler is injectable so the coalescing logic can be unit-tested with a
// manual clock instead of a real animation frame.

export interface RafThrottle<T> {
  /** Record the latest value and ensure a flush is scheduled for the next frame. */
  call: (value: T) => void;
  /** Apply the pending value immediately (if any) and clear the scheduled frame. */
  flush: () => void;
  /** Drop any pending value and cancel the scheduled frame without applying. */
  cancel: () => void;
}

export function rafThrottle<T>(
  apply: (value: T) => void,
  schedule: (cb: () => void) => number = requestAnimationFrame,
  cancelScheduled: (handle: number) => void = cancelAnimationFrame,
): RafThrottle<T> {
  let handle: number | null = null;
  let pending = false;
  let latest: T;

  const run = () => {
    handle = null;
    if (!pending) return;
    pending = false;
    apply(latest);
  };

  return {
    call(value: T) {
      latest = value;
      pending = true;
      if (handle === null) handle = schedule(run);
    },
    flush() {
      if (handle !== null) {
        cancelScheduled(handle);
        handle = null;
      }
      if (pending) {
        pending = false;
        apply(latest);
      }
    },
    cancel() {
      if (handle !== null) {
        cancelScheduled(handle);
        handle = null;
      }
      pending = false;
    },
  };
}
