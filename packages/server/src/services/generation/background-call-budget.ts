import { logger } from "../../lib/logger.js";
import { getFeatureNumber, isFeatureEnabled } from "../features/feature-settings.js";

/**
 * Global ceiling on automatic (unattended) model calls per rolling hour.
 *
 * Per-chat backoff and the per-connection quarantine in connection-admission stop one broken
 * chat or one broken connection from looping, but they do not bound the total: many healthy
 * looking chats can still add up to a paid-call storm. This budget is the last line: once the
 * rolling hour is spent, automatic workers are refused locally (no request is sent) until the
 * oldest call ages out. Interactive requests never consume or check it.
 *
 * Counted: provider calls admitted in background mode (connection-admission) and the turns the
 * server-side autonomous scheduler starts.
 *
 * Settings > Advanced > Features "Background call cap" (backgroundCallCap, default off: no cap)
 * and its number (backgroundCallsPerHour, default 600). MARINARA_BACKGROUND_CALLS_PER_HOUR wins
 * when set: a positive integer sets the cap, "0" or "off" disables it, anything else falls back
 * to the default.
 */
export const DEFAULT_BACKGROUND_CALLS_PER_HOUR = 600;
export const BACKGROUND_CALL_BUDGET_WINDOW_MS = 60 * 60 * 1000;
export const BACKGROUND_CALL_BUDGET_EXCEEDED = "BACKGROUND_CALL_BUDGET_EXCEEDED";

type BudgetEntry = { at: number; source: string };

const entries: BudgetEntry[] = [];
let exhaustedSince: number | null = null;
let refusedSinceExhausted = 0;
let limitOverride: number | null = null;

export function backgroundCallsPerHourLimit(): number {
  if (limitOverride !== null) return limitOverride;
  const raw = process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR?.trim().toLowerCase();
  if (!raw) return isFeatureEnabled("backgroundCallCap") ? getFeatureNumber("backgroundCallsPerHour") : 0;
  if (raw === "0" || raw === "off" || raw === "false" || raw === "disabled") return 0;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BACKGROUND_CALLS_PER_HOUR;
}

function prune(now: number): void {
  const cutoff = now - BACKGROUND_CALL_BUDGET_WINDOW_MS;
  let drop = 0;
  while (drop < entries.length && entries[drop]!.at <= cutoff) drop += 1;
  if (drop) entries.splice(0, drop);
}

function countsBySource(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) counts[entry.source] = (counts[entry.source] ?? 0) + 1;
  return counts;
}

export type BackgroundCallBudgetDecision =
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; retryAfterMs: number };

/** Book one automatic model call, or refuse it when the rolling hour is already spent. */
export function tryConsumeBackgroundCall(source: string, now = Date.now()): BackgroundCallBudgetDecision {
  const limit = backgroundCallsPerHourLimit();
  if (limit <= 0) return { allowed: true, used: 0, limit: 0 };
  prune(now);
  if (entries.length >= limit) {
    const retryAfterMs = Math.max(1, entries[0]!.at + BACKGROUND_CALL_BUDGET_WINDOW_MS - now);
    refusedSinceExhausted += 1;
    if (exhaustedSince === null) {
      exhaustedSince = now;
      logger.warn(
        { limit, source, retryAfterMs, bySource: countsBySource() },
        "[background-budget] Automatic model calls hit the hourly cap (%d/hour); background workers are paused for about %d minutes. No request was sent. Raise Calls per hour under Background call cap in Settings > Advanced > Features (or MARINARA_BACKGROUND_CALLS_PER_HOUR) if this volume is expected.",
        limit,
        Math.ceil(retryAfterMs / 60_000),
      );
    } else {
      logger.debug({ limit, source, retryAfterMs }, "[background-budget] automatic model call refused");
    }
    return { allowed: false, used: entries.length, limit, retryAfterMs };
  }
  if (exhaustedSince !== null) {
    logger.info(
      { limit, refused: refusedSinceExhausted, pausedMs: now - exhaustedSince },
      "[background-budget] Automatic model calls resumed after the hourly cap",
    );
    exhaustedSince = null;
    refusedSinceExhausted = 0;
  }
  entries.push({ at: now, source });
  return { allowed: true, used: entries.length, limit };
}

export class BackgroundCallBudgetExceededError extends Error {
  readonly code = BACKGROUND_CALL_BUDGET_EXCEEDED;
  constructor(
    readonly source: string,
    readonly limit: number,
    readonly retryAfterMs: number,
  ) {
    super(
      `No request was sent to the provider. Automatic model calls reached the hourly cap (${limit}/hour); retry in about ${Math.ceil(retryAfterMs / 60_000)} minutes.`,
    );
    this.name = "BackgroundCallBudgetExceededError";
  }
}

/** Book one automatic call or throw BackgroundCallBudgetExceededError. */
export function consumeBackgroundCallOrThrow(source: string, now = Date.now()): void {
  const decision = tryConsumeBackgroundCall(source, now);
  if (!decision.allowed) throw new BackgroundCallBudgetExceededError(source, decision.limit, decision.retryAfterMs);
}

export function isBackgroundCallBudgetExceeded(error: unknown): error is BackgroundCallBudgetExceededError {
  return error instanceof BackgroundCallBudgetExceededError;
}

export function backgroundCallBudgetSnapshot(now = Date.now()): {
  used: number;
  limit: number;
  exhausted: boolean;
  bySource: Record<string, number>;
} {
  prune(now);
  const limit = backgroundCallsPerHourLimit();
  return { used: entries.length, limit, exhausted: limit > 0 && entries.length >= limit, bySource: countsBySource() };
}

/** Tests only: clear the window and optionally pin the cap without touching process.env. */
export function resetBackgroundCallBudgetForTests(limit: number | null = null): void {
  entries.length = 0;
  exhaustedSince = null;
  refusedSinceExhausted = 0;
  limitOverride = limit;
}
