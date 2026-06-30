// ──────────────────────────────────────────────────────────────────────────
// TEMPORARY render-timing diagnostics for issue #3104
// (severe client freeze on chats that use the world-state / character-tracker
// agents). The goal is to pin which subtree's render eats the main thread on
// affected users' chats, so we can write the correct fix instead of guessing.
//
// Design notes:
// - On startup it logs a one-time "armed" line so anyone can confirm the
//   instrumentation is active WITHOUT needing a laggy chat.
// - By default it only warns on renders/tasks over the threshold, so it is
//   quiet during normal use. Set `localStorage.mariPerfVerbose = "1"` (then
//   reload) to log EVERY render/task — useful for confirming the tool works on
//   a fast install.
// - Uses `console.warn` (NOT `console.log`): production builds strip
//   `console.log` via esbuild but keep `console.warn`/`console.error`, so this
//   still surfaces in the affected users' (built) installs.
// - Zero behavior change: only measures and reports.
//
// Remove this file (and its call sites) once the hot frame is identified.
// ──────────────────────────────────────────────────────────────────────────
import { useLayoutEffect } from "react";

/** A render/commit slower than this (ms) is always reported. Normal renders are <16ms. */
const RENDER_WARN_MS = 250;
/** A main-thread task longer than this (ms) is always reported. */
const TASK_WARN_MS = 250;

/** When `localStorage.mariPerfVerbose === "1"`, log every render/task, not just slow ones. */
function isVerbose(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("mariPerfVerbose") === "1";
  } catch {
    return false;
  }
}

/**
 * Warn when a component's render + commit takes longer than RENDER_WARN_MS
 * (or, in verbose mode, on every render). Call once at the top level of a
 * component body (it is a hook).
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
    const elapsed = Math.round(performance.now() - start);
    if (elapsed > RENDER_WARN_MS) {
      console.warn(`[mari-perf] ${label} render+commit took ${elapsed}ms`);
    } else if (isVerbose()) {
      console.warn(`[mari-perf] (verbose) ${label} render+commit ${elapsed}ms`);
    }
  });
}

let longTaskWarnerInstalled = false;

/**
 * Warn on any main-thread long task over TASK_WARN_MS (every long task in
 * verbose mode). Also logs a one-time "armed" confirmation so the diagnostics
 * are verifiable without needing a laggy chat. Idempotent.
 */
export function installLongTaskWarner(): void {
  if (longTaskWarnerInstalled) return;
  longTaskWarnerInstalled = true;

  // One-time confirmation that the diagnostics are wired up and running, even
  // when nothing is slow — so a tester on a fast install can verify it.
  console.warn(
    `[mari-perf] diagnostics armed — warns on renders/long tasks over ${RENDER_WARN_MS}ms. ` +
      `Run \`localStorage.mariPerfVerbose = "1"\` in the console and reload to log every render (confirms it works without needing lag).`,
  );

  if (typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Math.round(entry.duration);
        if (duration > TASK_WARN_MS) {
          console.warn(`[mari-perf] long task ${duration}ms`);
        } else if (isVerbose()) {
          console.warn(`[mari-perf] (verbose) task ${duration}ms`);
        }
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // "longtask" is not supported in every browser — safe to ignore.
  }
}
