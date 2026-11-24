// ──────────────────────────────────────────────
// Whether a Connection's server answered lately. A model list fetch that gets no answer at all (address not found,
// refused, timed out) marks the Connection unreachable until a fetch succeeds again. The Connections page shows it,
// and repeat fetches wait a little (30 s, doubling, at most 15 min) instead of filling the log with the same failure.
// Kept per server address: a new address (a tunnel's new name) starts clean. In memory only: a restart forgets it,
// and the next fetch finds out again.
// ──────────────────────────────────────────────

export type UnreachableReason = "not_found" | "refused" | "timeout" | "unreachable";

export interface Unreachable {
  reason: UnreachableReason;
  /** When the first failure of this run happened (ISO). */
  since: string;
  /** The error the fetch gave, for the reply while fetches wait. */
  error: string;
}

const FIRST_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;

type Entry = Unreachable & { failures: number; until: number; origin: string };

/** The server an address is on; a new address (a tunnel's new name) is a new server with a clean slate. */
function originOf(address: string | null | undefined): string {
  try {
    return new URL(address?.trim() ?? "").origin;
  } catch {
    return "";
  }
}
const entries = new Map<string, Entry>();

/** The key a Connection's reachability is kept under: its account, or the Model itself when it has none. */
export function reachabilityKey(conn: { id?: string | null; accountId?: string | null }): string | null {
  return conn.accountId || conn.id || null;
}

/** The kind of failure from a fetch error's code (Node puts DNS and socket codes on the error or its cause). */
export function unreachableReasonOf(error: unknown): UnreachableReason {
  const codeOf = (value: unknown) =>
    value && typeof value === "object" && typeof (value as { code?: unknown }).code === "string"
      ? (value as { code: string }).code
      : "";
  const code = codeOf(error) || codeOf(error instanceof Error ? error.cause : undefined);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_NONAME") return "not_found";
  if (code === "ECONNREFUSED" || code === "ECONNRESET") return "refused";
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ABORT_ERR") return "timeout";
  return "unreachable";
}

/** Notes a failed fetch. `first` is true for the first failure of a run, the one worth a warning in the log. */
export function noteUnreachable(
  key: string,
  reason: UnreachableReason,
  error: string,
  address: string | null | undefined,
  now = Date.now(),
): { first: boolean } {
  const origin = originOf(address);
  const stored = entries.get(key);
  const previous = stored && stored.origin === origin ? stored : undefined;
  const failures = (previous?.failures ?? 0) + 1;
  entries.set(key, {
    reason,
    error,
    since: previous?.since ?? new Date(now).toISOString(),
    failures,
    origin,
    until: now + Math.min(MAX_WAIT_MS, FIRST_WAIT_MS * 2 ** (failures - 1)),
  });
  return { first: !previous };
}

/** A fetch got an answer: the Connection is reachable again. */
export function noteReachable(key: string | null) {
  if (key) entries.delete(key);
}

/** The stored failure while repeat fetches should wait, else null. */
export function waitingUnreachable(
  key: string | null,
  address: string | null | undefined,
  now = Date.now(),
): Unreachable | null {
  const entry = key ? entries.get(key) : undefined;
  return entry && entry.origin === originOf(address) && entry.until > now ? entry : null;
}

/** What the Connections page shows: the failure, however long ago it began, until a fetch succeeds. */
export function unreachableOf(key: string | null, address: string | null | undefined): Unreachable | null {
  const entry = key ? entries.get(key) : undefined;
  return entry && entry.origin === originOf(address)
    ? { reason: entry.reason, since: entry.since, error: entry.error }
    : null;
}

/** For tests. */
export function resetReachability() {
  entries.clear();
}
