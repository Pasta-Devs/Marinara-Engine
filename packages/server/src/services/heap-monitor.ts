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
export const HEAP_PRESSURE_RECOVERY_PERCENT = 80;
export const HEAP_PRESSURE_CHECK_INTERVAL_MS = 60_000;
export const HEAP_PRESSURE_REMINDER_INTERVAL_MS = 10 * 60_000;

export function captureHeapSnapshot(): HeapSnapshot {
  const stats = getHeapStatistics();
  const heapUsedMB = Math.round(stats.used_heap_size / MB);
  const heapLimitMB = Math.round(stats.heap_size_limit / MB);
  // RSS reads /proc/self/stat on Linux/Android and can throw under fd
  // exhaustion; telemetry must degrade, never fail the caller.
  let rssMB = 0;
  try {
    rssMB = Math.round(process.memoryUsage.rss() / MB);
  } catch {
    // Leave 0: "unknown", still distinguishable from a real reading.
  }
  return {
    heapUsedMB,
    heapLimitMB,
    heapUsedPercent: heapLimitMB > 0 ? Math.min(100, Math.round((heapUsedMB / heapLimitMB) * 100)) : 0,
    rssMB,
  };
}

export interface HeapPressureState {
  underPressure: boolean;
  /** Whether the CURRENT pressure episode has produced a log line yet. */
  announced: boolean;
  /** Monotonic timestamp of the last warn/remind line (0 = never). */
  lastWarnedAt: number;
}

export type HeapPressureAction = "warn" | "remind" | "recovered" | "none";

/**
 * Pure threshold logic with hysteresis: pressure starts at the warn threshold
 * but only clears below the lower recovery threshold, and warn/remind lines
 * are globally rate-limited to one per reminder interval. Under ANY usage
 * oscillation this emits at most one pressure line and one recovery line per
 * reminder interval — a heap saw-toothing across the boundary can never flood
 * the session log. `now` must come from a monotonic clock; a paused clock
 * (Android process freeze) at worst delays a reminder.
 */
export function evaluateHeapPressure(
  state: HeapPressureState,
  heapUsedPercent: number,
  now: number,
): HeapPressureAction {
  const reminderElapsed = state.lastWarnedAt === 0 || now - state.lastWarnedAt >= HEAP_PRESSURE_REMINDER_INTERVAL_MS;
  if (state.underPressure) {
    if (heapUsedPercent < HEAP_PRESSURE_RECOVERY_PERCENT) {
      state.underPressure = false;
      const wasAnnounced = state.announced;
      state.announced = false;
      // A silent episode (re-entry inside the rate-limit window) also ends
      // silently, so flapping cannot emit unmatched recovery lines.
      return wasAnnounced ? "recovered" : "none";
    }
    if (reminderElapsed) {
      state.lastWarnedAt = now;
      const firstLineOfEpisode = !state.announced;
      state.announced = true;
      return firstLineOfEpisode ? "warn" : "remind";
    }
    return "none";
  }
  if (heapUsedPercent >= HEAP_PRESSURE_THRESHOLD_PERCENT) {
    state.underPressure = true;
    if (reminderElapsed) {
      state.lastWarnedAt = now;
      state.announced = true;
      return "warn";
    }
    // Re-crossed shortly after a previous line: stay silent now; the next
    // reminder tick announces the episode if pressure persists.
    state.announced = false;
    return "none";
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

  const state: HeapPressureState = { underPressure: false, announced: false, lastWarnedAt: 0 };
  const timer = setInterval(() => {
    // The tick must never throw: an exception here would reach the process-
    // fatal uncaughtException handler and let the telemetry kill the server
    // it monitors. performance.now() is monotonic, so a backward wall-clock
    // step (Android NTP correction) cannot silence reminders.
    try {
      const snapshot = captureHeapSnapshot();
      const action = evaluateHeapPressure(state, snapshot.heapUsedPercent, performance.now());
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
    } catch (error) {
      logger.debug(error, "[heap] Skipped a heap pressure check");
    }
  }, HEAP_PRESSURE_CHECK_INTERVAL_MS);
  timer.unref?.();

  return {
    stop: () => {
      clearInterval(timer);
    },
  };
}
