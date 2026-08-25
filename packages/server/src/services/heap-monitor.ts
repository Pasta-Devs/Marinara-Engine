// ──────────────────────────────────────────────
// Heap Monitor — near-limit memory telemetry
// ──────────────────────────────────────────────
// Large profiles are fully heap-resident in the file-backed store, so a server
// whose live set approaches --max-old-space-size degrades into a permanent
// full-GC regime long before V8 aborts (#5506). Nothing surfaced that state:
// diagnostics carried no memory fields and the persistent session logs could
// not distinguish "GC storm at the ceiling" from "process frozen by Android".
// This module logs the configured limit at startup, warns when heap usage
// crosses a pressure threshold (with recovery + spaced reminders, never a
// per-minute spam), and exposes a snapshot for /api/health and Support
// Diagnostics.
import { getHeapStatistics } from "node:v8";
import { logger } from "../lib/logger.js";

export interface HeapSnapshot {
  /** Live JS heap in MB (V8 used_heap_size). */
  heapUsedMB: number;
  /** Old-space ceiling in MB (V8 heap_size_limit; tracks --max-old-space-size). */
  heapLimitMB: number;
  /** heapUsedMB / heapLimitMB as a rounded 0-100 percentage. */
  heapUsedPercent: number;
  /** Whole-process resident set size in MB (what the OS kill heuristics see). */
  rssMB: number;
}

const MB = 1024 * 1024;
export const HEAP_PRESSURE_THRESHOLD_PERCENT = 85;
export const HEAP_PRESSURE_CHECK_INTERVAL_MS = 60_000;
export const HEAP_PRESSURE_REMINDER_INTERVAL_MS = 10 * 60_000;

export function captureHeapSnapshot(): HeapSnapshot {
  const stats = getHeapStatistics();
  const heapUsedMB = Math.round(stats.used_heap_size / MB);
  const heapLimitMB = Math.round(stats.heap_size_limit / MB);
  return {
    heapUsedMB,
    heapLimitMB,
    heapUsedPercent: heapLimitMB > 0 ? Math.min(100, Math.round((heapUsedMB / heapLimitMB) * 100)) : 0,
    rssMB: Math.round(process.memoryUsage.rss() / MB),
  };
}

export interface HeapPressureState {
  underPressure: boolean;
  lastWarnedAt: number;
}

export type HeapPressureAction = "warn" | "remind" | "recovered" | "none";

/**
 * Pure threshold logic: warn once on crossing into pressure, remind at most
 * every reminder interval while it persists, and log recovery once on the way
 * back down. A wall-clock jump (Android process freeze) at worst issues one
 * late reminder — it can never kill or spam anything.
 */
export function evaluateHeapPressure(
  state: HeapPressureState,
  heapUsedPercent: number,
  now: number,
): HeapPressureAction {
  if (heapUsedPercent >= HEAP_PRESSURE_THRESHOLD_PERCENT) {
    if (!state.underPressure) {
      state.underPressure = true;
      state.lastWarnedAt = now;
      return "warn";
    }
    if (now - state.lastWarnedAt >= HEAP_PRESSURE_REMINDER_INTERVAL_MS) {
      state.lastWarnedAt = now;
      return "remind";
    }
    return "none";
  }
  if (state.underPressure) {
    state.underPressure = false;
    return "recovered";
  }
  return "none";
}

function logPressure(snapshot: HeapSnapshot): void {
  logger.warn(
    '[heap] Memory pressure: %dMB of the %dMB Node heap limit in use (%d%%), RSS %dMB. If the server becomes slow or unresponsive, restart it with a larger heap, e.g. NODE_OPTIONS="--max-old-space-size=2048" — see docs/TROUBLESHOOTING.md.',
    snapshot.heapUsedMB,
    snapshot.heapLimitMB,
    snapshot.heapUsedPercent,
    snapshot.rssMB,
  );
}

/**
 * Start the periodic pressure check. The interval is unref'd so it never keeps
 * the process alive, and each tick is a couple of cheap V8 calls.
 */
export function startHeapMonitor(): { stop: () => void } {
  const startup = captureHeapSnapshot();
  logger.info(
    "[heap] Node heap limit %dMB (heap %dMB in use, RSS %dMB)",
    startup.heapLimitMB,
    startup.heapUsedMB,
    startup.rssMB,
  );

  const state: HeapPressureState = { underPressure: false, lastWarnedAt: 0 };
  const timer = setInterval(() => {
    const snapshot = captureHeapSnapshot();
    const action = evaluateHeapPressure(state, snapshot.heapUsedPercent, Date.now());
    if (action === "warn" || action === "remind") {
      logPressure(snapshot);
    } else if (action === "recovered") {
      logger.info(
        "[heap] Memory pressure cleared: %dMB of %dMB in use (%d%%)",
        snapshot.heapUsedMB,
        snapshot.heapLimitMB,
        snapshot.heapUsedPercent,
      );
    }
  }, HEAP_PRESSURE_CHECK_INTERVAL_MS);
  timer.unref?.();

  return {
    stop: () => {
      clearInterval(timer);
    },
  };
}
