// ──────────────────────────────────────────────────────────────────────────
// TEMPORARY render-timing diagnostics for issue #3104
// (severe client freeze on chats that use the world-state / character-tracker
// agents). The goal is to pin which subtree's render eats the main thread on
// affected users' chats, so we can write the correct fix instead of guessing.
//
// Design notes:
// - Self-gating: nothing is logged unless a render/commit or task exceeds the
//   threshold, so this is silent during normal use.
// - Uses `console.warn` (NOT `console.log`): production builds strip
//   `console.log` via esbuild but keep `console.warn`/`console.error`, so this
//   still surfaces in the affected users' (built) installs.
// - Zero behavior change: only measures and reports.
//
// Remove this file (and its call sites) once the hot frame is identified.
// ──────────────────────────────────────────────────────────────────────────
import { useLayoutEffect } from "react";

/** A render/commit slower than this (ms) is reported. Normal renders are <16ms. */
const RENDER_WARN_MS = 250;
/** A main-thread task longer than this (ms) is reported. */
const TASK_WARN_MS = 250;

/**
 * Warn when a component's render + commit takes longer than RENDER_WARN_MS.
 * Call once at the top level of a component body (it is a hook).
 *
 * `start` is captured fresh on every render; the layout effect (no deps → runs
 * after every commit) measures from this render's start to the commit, which is
 * a good proxy for "how long did rendering this subtree take this update".
 */
export function useRenderTimer(label: string): void {
  // Intentional render-phase clock read: measuring render+commit duration
  // requires the render-start timestamp. This is measurement-only and does not
  // affect render output, so the purity heuristic is a false positive here.
  // eslint-disable-next-line react-hooks/purity
  const start = performance.now();
  useLayoutEffect(() => {
    const elapsed = performance.now() - start;
    if (elapsed > RENDER_WARN_MS) {
      console.warn(`[mari-perf] ${label} render+commit took ${Math.round(elapsed)}ms`);
    }
  });
}

let longTaskWarnerInstalled = false;

/** Warn on any main-thread long task over TASK_WARN_MS. Idempotent. */
export function installLongTaskWarner(): void {
  if (longTaskWarnerInstalled || typeof PerformanceObserver === "undefined") return;
  longTaskWarnerInstalled = true;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > TASK_WARN_MS) {
          console.warn(`[mari-perf] long task ${Math.round(entry.duration)}ms`);
        }
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // "longtask" is not supported in every browser — safe to ignore.
  }
}
