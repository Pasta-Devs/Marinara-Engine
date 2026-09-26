// ──────────────────────────────────────────────
// NanoGPT quota reading helpers
// ──────────────────────────────────────────────
//
// Pure display math, kept out of the widget so it can be proven without
// rendering. Quota semantics that these must respect (see NanoGPT's docs):
//   * `percentUsed` is a FRACTION (0.25 = 25%), and it MAY EXCEED 1.
//   * A null counter means "not reported" — not zero.
//   * `degraded: true` with null counters means "unknown" — never a full or
//     empty allowance.

/** One quota window as the usage endpoint reports it. */
export interface QuotaWindowLike {
  used: number | null;
  remaining: number | null;
  percentUsed: number | null;
}

/** Convert the API's fraction to a clamped 0-100 display percentage. */
export function quotaPercentForDisplay(percentUsed: number | null | undefined): number | null {
  if (typeof percentUsed !== "number" || !Number.isFinite(percentUsed)) return null;
  return Math.min(100, Math.max(0, percentUsed * 100));
}

/**
 * Prefer the reported limit: remaining can be zero when usage exceeds it.
 * Older payloads can fall back to used + remaining until the quota is exceeded.
 */
export function quotaTotalForDisplay(window: QuotaWindowLike | null | undefined, limit?: number | null): number | null {
  if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) return limit;
  if (!window || window.used === null || window.remaining === null) return null;
  if (window.percentUsed !== null && window.percentUsed > 1) return null;
  if (!Number.isFinite(window.used) || !Number.isFinite(window.remaining)) return null;
  const total = window.used + window.remaining;
  return Number.isFinite(total) ? total : null;
}
