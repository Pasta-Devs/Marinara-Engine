// ──────────────────────────────────────────────
// Per-connection outbound rate limit registry
// ──────────────────────────────────────────────
// A connection's `maxRequestsPerMinute` is a property of the proxy behind it, so the throttle
// must apply wherever that connection is used — not only Professor Mari. Rather than thread the
// value through every createLLMProvider() call site, we keep it in a small module-level map keyed
// by connection id (mirroring connection-admission's state map) that the connections storage layer
// keeps in sync, and that the RateLimitAwareProvider decorator reads at request time.

const limits = new Map<string, number>();

/** Record (or clear, for null/0/invalid) a connection's requests-per-minute cap. */
export function setConnectionRateLimit(connectionId: string, maxRequestsPerMinute: number | null | undefined): void {
  if (typeof maxRequestsPerMinute === "number" && Number.isFinite(maxRequestsPerMinute) && maxRequestsPerMinute > 0) {
    limits.set(connectionId, Math.floor(maxRequestsPerMinute));
  } else {
    limits.delete(connectionId);
  }
}

/** The connection's requests-per-minute cap, or null when unthrottled. */
export function getConnectionRateLimit(connectionId: string): number | null {
  return limits.get(connectionId) ?? null;
}

export function clearConnectionRateLimit(connectionId: string): void {
  limits.delete(connectionId);
}

export function resetConnectionRateLimitsForTests(): void {
  limits.clear();
}
