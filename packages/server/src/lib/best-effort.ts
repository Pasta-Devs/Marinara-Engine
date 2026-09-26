// ──────────────────────────────────────────────
// Best-effort work: failures that are logged, not thrown
// ──────────────────────────────────────────────
// Replaces bare `.catch(() => {})` and `catch { /* ignore */ }`. The failure
// still reaches the log (at most once a minute per event, chat and stage) and
// the caller keeps going. Use it for work whose failure must not change the
// outcome of the request, such as cleanup after the real work finished.
// ──────────────────────────────────────────────
import { logRateLimited } from "./log-rate-limit.js";
import { logger } from "./logger.js";

export type SuppressedFields = {
  /** What was being done, for example "storage.flush" or "agent.run". */
  event: string;
  stage?: string;
  chatId?: string;
  errorCode?: string;
  /** "debug" for expected cleanup failures; "warn" (the default) for real ones. */
  level?: "warn" | "debug";
} & Record<string, unknown>;

/**
 * The structured line for a swallowed failure. Caller fields come first so `err`, `outcome` and `suppressed`
 * always describe the failure, even when a caller passes fields with the same names.
 */
export function suppressedLogLine(error: unknown, fields: SuppressedFields): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...fields };
  delete rest.level;
  return { ...rest, err: error, outcome: "failed", suppressed: true };
}

/** Logs a failure the caller deliberately swallows (outcome "failed", suppressed true). */
export function logSuppressed(error: unknown, fields: SuppressedFields): void {
  const line = suppressedLogLine(error, fields);
  const level = fields.level;
  if (level === "debug") {
    logger.debug(line, "Suppressed failure");
    return;
  }
  logRateLimited("warn", `${fields.event}:${fields.chatId ?? ""}:${fields.stage ?? ""}`, line, "Suppressed failure");
}

/** Resolves to `fallback` instead of rejecting, and logs the failure through logSuppressed. */
export function orFallback<T, F>(promise: Promise<T>, fallback: F, fields: SuppressedFields): Promise<T | F> {
  return promise.catch((error: unknown) => {
    logSuppressed(error, fields);
    return fallback;
  });
}

/** Runs `work` and returns undefined instead of throwing; the failure is logged through logSuppressed. */
export async function bestEffort<T>(fields: SuppressedFields, work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch (error) {
    logSuppressed(error, fields);
    return undefined;
  }
}
