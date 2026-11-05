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

// Optional shared (account-level) budget. Row limits above stay keyed by row id; the account scope
// `account:<id>` is an additional limit. The storage layer (`withDecryptedKey`) calls
// `setConnectionBudgetScope(rowId, accountId)` when a row belongs to an account, and
// `setAccountRateLimit` / `setAccountParallelLimit` (account-budget.ts) for the account caps.
const budgetScopes = new Map<string, string>();
const accountLimits = new Map<string, number>();

/** Attach a row to an account's shared budget (null/empty detaches it). */
export function setConnectionBudgetScope(connectionId: string, accountId: string | null | undefined): void {
  if (accountId) budgetScopes.set(connectionId, `account:${accountId}`);
  else budgetScopes.delete(connectionId);
}

/** The row's shared scope (`account:<id>`), or null when it has none. */
export function getConnectionBudgetScope(connectionId: string): string | null {
  return budgetScopes.get(connectionId) ?? null;
}

/** Record (or clear) an account's shared requests-per-minute cap. */
export function setAccountRateLimit(accountId: string, maxRequestsPerMinute: number | null | undefined): void {
  const scope = `account:${accountId}`;
  if (typeof maxRequestsPerMinute === "number" && Number.isFinite(maxRequestsPerMinute) && maxRequestsPerMinute > 0) {
    accountLimits.set(scope, Math.floor(maxRequestsPerMinute));
  } else {
    accountLimits.delete(scope);
  }
}

/** The shared requests-per-minute cap of an `account:<id>` scope, or null. */
export function getAccountScopeRateLimit(scope: string): number | null {
  return accountLimits.get(scope) ?? null;
}

export function resetConnectionRateLimitsForTests(): void {
  limits.clear();
  budgetScopes.clear();
  accountLimits.clear();
}
