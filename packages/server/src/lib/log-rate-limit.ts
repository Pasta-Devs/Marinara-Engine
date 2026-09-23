// ──────────────────────────────────────────────
// Rate-limited logging for failures that repeat on a timer
// ──────────────────────────────────────────────
// A poller or per-turn hook that fails the same way every few seconds would
// otherwise bury everything else in the log. logRateLimited writes the first
// occurrence of a key, then at most one line per window, and that line says
// how many repeats were skipped in between.
// ──────────────────────────────────────────────
import { logger } from "./logger.js";

const DEFAULT_WINDOW_MS = 60_000;
const MAX_KEYS = 500;

type Entry = { lastLoggedAt: number; suppressed: number };
const entries = new Map<string, Entry>();

/**
 * Returns the number of repeats skipped since the last line when `key` may
 * log now, or null while it is inside its window.
 */
export function takeRateLimitedSlot(key: string, windowMs = DEFAULT_WINDOW_MS, now = Date.now()): number | null {
  const entry = entries.get(key);
  if (entry && now - entry.lastLoggedAt < windowMs) {
    entry.suppressed += 1;
    return null;
  }
  const suppressed = entry?.suppressed ?? 0;
  entries.delete(key);
  if (entries.size >= MAX_KEYS) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(key, { lastLoggedAt: now, suppressed: 0 });
  return suppressed;
}

/** Test hook: forget every key. */
export function resetRateLimitedLogs(): void {
  entries.clear();
}

/**
 * Logs like `logger[level](errOrFields, message, ...args)`, at most once per
 * `windowMs` for the same `key`. A line written after a quiet window carries
 * `suppressedRepeats` when it skipped any.
 */
export function logRateLimited(
  level: "warn" | "info" | "error",
  key: string,
  errOrFields: unknown,
  message: string,
  ...args: unknown[]
): void {
  const suppressed = takeRateLimitedSlot(key);
  if (suppressed === null) return;
  const fields: Record<string, unknown> =
    errOrFields instanceof Error
      ? { err: errOrFields }
      : errOrFields && typeof errOrFields === "object"
        ? { ...(errOrFields as Record<string, unknown>) }
        : errOrFields === undefined
          ? {}
          : { detail: errOrFields };
  if (suppressed > 0) fields.suppressedRepeats = suppressed;
  logger[level](fields, message, ...args);
}
