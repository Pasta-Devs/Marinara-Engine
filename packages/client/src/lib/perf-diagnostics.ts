// ──────────────────────────────────────────────────────────────────────────
// Render-timing diagnostics — an opt-in performance troubleshooting tool.
//
// Originally added to pin issue #3104 (severe client freeze on chats using the
// world-state / character-tracker agents), but kept as a permanent, low-overhead
// diagnostic for future "the app froze / lagged" reports.
//
// Behavior:
// - On startup it logs a one-time "armed" line so it's discoverable and you can
//   confirm it's active without needing a slow render.
// - By default it only warns on renders / long tasks over the threshold, so it's
//   quiet during normal use. Set `localStorage.mariPerfVerbose = "1"` (then
//   reload) to log EVERY render/task; set it to "0" (or remove it) to stop.
// - Uses `console.warn` (NOT `console.log`): production builds strip
//   `console.log` via esbuild but keep `console.warn`/`console.error`, so this
//   still surfaces in built installs (which is where the lag reports come from).
// - Zero behavior change: it only measures and reports.
// ──────────────────────────────────────────────────────────────────────────
import { useLayoutEffect } from "react";

/** A render/commit slower than this (ms) is always reported. Normal renders are <16ms. */
const RENDER_WARN_MS = 250;
/** A main-thread task longer than this (ms) is always reported. */
const TASK_WARN_MS = 250;

/** Verbose mode logs every render/task. Enabled by `mariPerfVerbose === "1"`; any other value (e.g. "0") or absence disables it. */
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
 * are discoverable and verifiable without needing a slow render. Idempotent.
 */
export function installLongTaskWarner(): void {
  if (longTaskWarnerInstalled) return;
  longTaskWarnerInstalled = true;

  // One-time confirmation that the diagnostics are wired up and running, even
  // when nothing is slow — so it's discoverable and verifiable on any install.
  console.warn(
    `[mari-perf] diagnostics armed — warns on renders/long tasks over ${RENDER_WARN_MS}ms. ` +
      `Run \`localStorage.mariPerfVerbose = "1"\` in the console and reload to log every render. ` +
      `Replace the "1" with "0" to disable.`,
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
