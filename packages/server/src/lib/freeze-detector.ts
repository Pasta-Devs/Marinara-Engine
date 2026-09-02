// ──────────────────────────────────────────────
// Freeze detector (#5655)
// ──────────────────────────────────────────────
// When Android freezes a backgrounded Termux process (cached-app freezer,
// vendor app-sleep), every timer simply stops and resumes later — an idle
// server at the default log level records nothing, so support threads cannot
// distinguish "host froze the server" from "server crashed" from "network
// problem". This detector turns a freeze into positive, timestamped log
// evidence: an unref'd tick measures its own lateness, and a tick arriving
// far beyond its interval means the process stopped running — usually an OS
// suspension (Android freezer, laptop sleep), though a severe app-internal
// stall (a minutes-long synchronous flush under GC thrash, the #4730
// pathology) reads the same way, which is why the warning hedges and points
// at the memory figures. The same pattern already proved itself at watchdog
// scale in the extension sandbox (shouldGrantSandboxResumeGrace).

import { logger } from "./logger.js";

export const FREEZE_DETECTOR_INTERVAL_MS = 60_000;
/** A tick this many times later than scheduled counts as a suspension. */
export const FREEZE_GAP_FACTOR = 2;

export type FreezeRecord = {
  /** When the post-freeze tick ran (i.e. when the process thawed). */
  detectedAt: string;
  /** Total gap between consecutive ticks, in milliseconds. */
  gapMs: number;
  /** Estimated suspension length (gap minus the scheduled interval). */
  suspendedMs: number;
};

/**
 * Pure classifier so regressions can pin the threshold without timers:
 * returns the estimated suspension when the gap crosses the threshold,
 * null for an on-time tick.
 */
export function classifyTickGap(
  now: number,
  lastTickAt: number,
  intervalMs: number = FREEZE_DETECTOR_INTERVAL_MS,
): number | null {
  const gap = now - lastTickAt;
  if (gap <= intervalMs * FREEZE_GAP_FACTOR) return null;
  return gap - intervalMs;
}

let timer: NodeJS.Timeout | null = null;
let lastTickAt = 0;
let lastFreeze: FreezeRecord | null = null;

export function startFreezeDetector(intervalMs: number = FREEZE_DETECTOR_INTERVAL_MS) {
  if (timer) return;
  lastTickAt = Date.now();
  timer = setInterval(() => {
    const now = Date.now();
    const suspendedMs = classifyTickGap(now, lastTickAt, intervalMs);
    if (suspendedMs !== null) {
      lastFreeze = { detectedAt: new Date(now).toISOString(), gapMs: now - lastTickAt, suspendedMs };
      logger.warn(
        "Process was suspended for ~%d s (timer gap %d ms). Either the host OS froze or slept the server, or the server itself stalled that long — on Android/Termux check the wake lock and battery exemptions, and compare the memory figures in /api/health.",
        Math.round(suspendedMs / 1000),
        now - lastTickAt,
      );
    }
    lastTickAt = now;
  }, intervalMs);
  // The detector must never keep the process alive on its own.
  timer.unref();
}

export function stopFreezeDetector() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Most recent detected suspension, for /health and support diagnostics. */
export function getLastFreeze(): FreezeRecord | null {
  return lastFreeze;
}
