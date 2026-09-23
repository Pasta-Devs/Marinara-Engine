// ──────────────────────────────────────────────
// Rate-limit-aware provider decorator
// ──────────────────────────────────────────────
// Three behaviours, all keyed by connection id so they cover every caller of a connection
// (Professor Mari's rapid tool-call loop, normal chat generation, embeddings, …):
//
//   • Proactive throttle — when the connection has a `maxRequestsPerMinute` cap, requests are
//     paced so a burst (e.g. Mari's up-to-13 back-to-back rounds) cannot exceed it. Off by
//     default (no cap configured → no pacing).
//   • Reactive pause/resume — always on. A provider 429 / 529 is caught, the request pauses
//     (honouring `Retry-After` when present, else capped exponential backoff), then the SAME
//     request is retried so the task completes instead of aborting. Bounded and abort-aware.
//   • Transient retry: opt-in (PROVIDER_RETRY_TRANSIENT_ERRORS). A refused / unreachable
//     connection or a gateway 502 / 503 is retried at most MAX_TRANSIENT_RETRIES times with short
//     jittered backoff, only before any text or reasoning reached the consumer, and never on the
//     primary leg of a connection that has a fallback (the fallback is the faster recovery).
//
// Mirrors the ConnectionAdmissionProvider decorator shape and installs alongside it.
import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "./base-provider.js";
import { BaseLLMProvider, LLMHttpError, isRateLimitError } from "./base-provider.js";
import { getConnectionRateLimit } from "./connection-rate-limit-registry.js";
import { isProviderTransientRetryEnabled } from "../../config/runtime-config.js";
import { logger } from "../../lib/logger.js";

export const MAX_RATE_LIMIT_RETRIES = 6;
/** Transient transport / gateway failures get a much smaller budget than rate limits. */
export const MAX_TRANSIENT_RETRIES = 2;
const BACKOFF_BASE_MS = 2_000;
const TRANSIENT_BACKOFF_BASE_MS = 1_000;
/**
 * A transient retry never waits longer than this, even when a gateway sends a longer Retry-After:
 * past a few seconds the caller (or the user) is better served by the error.
 */
const TRANSIENT_BACKOFF_CAP_MS = 5_000;
const BACKOFF_CAP_MS = 60_000;

/**
 * Connect-phase failure codes: the connection could not be opened, so the request body was never
 * sent and the upstream cannot have processed (or billed) it. Always safe to retry.
 *
 * Socket resets (ECONNRESET, EPIPE) are deliberately absent: without knowing how long the failed
 * attempt ran, a reset cannot be told apart from one that dropped a request the upstream already
 * worked on. Header/body timeouts are absent for the same reason.
 */
const CONNECT_PHASE_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function transientNetworkErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { name?: unknown; code?: unknown; cause?: unknown };
    if (candidate.name === "AbortError" || candidate.name === "TimeoutError") return undefined;
    if (typeof candidate.code === "string" && CONNECT_PHASE_ERROR_CODES.has(candidate.code)) return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

/**
 * True when an error is a transient transport or gateway failure that is safe to retry a small,
 * bounded number of times before any token reached the consumer: a refused / unreachable
 * connection, or an HTTP 502 / 503 from a gateway. Rate limits (429 / 529 / 503 with Retry-After)
 * are classified by `isRateLimitError` and keep their own larger budget. 504 is excluded because
 * the upstream model may already have produced (and billed) the answer behind the gateway timeout.
 */
export function isTransientProviderError(error: unknown): boolean {
  if (error instanceof LLMHttpError) return error.status === 502 || error.status === 503;
  return transientNetworkErrorCode(error) !== undefined;
}

type RetryKind = "rate_limit" | "transient";
type RetryCounts = Record<RetryKind, number>;

/** Classify a failed attempt, or null when it must propagate. Rate limits take precedence. */
function classifyRetry(error: unknown): RetryKind | null {
  if (isRateLimitError(error)) return "rate_limit";
  if (isTransientProviderError(error)) return "transient";
  return null;
}

type RateLimitPauseInfo = { attempt: number; delayMs: number; reason: "rate_limit" | "throttle" };
type RetryContext = { signal?: AbortSignal; onRateLimitPause?: (info: RateLimitPauseInfo) => void };

// Per-connection pacing cursor: the earliest wall-clock time the next request may start. Reserving
// a slot pushes the cursor forward by the min interval so concurrent requests queue fairly.
const nextAllowedAt = new Map<string, number>();

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new Error("Aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function backoffMs(attempt: number, retryAfterMs: number | undefined): number {
  if (typeof retryAfterMs === "number" && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, BACKOFF_CAP_MS);
  }
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
}

/**
 * Delay before retry number `attempt + 1`. Rate limits keep the existing schedule exactly
 * (Retry-After, else 2 s doubling up to 60 s). A transient retry honours Retry-After up to
 * TRANSIENT_BACKOFF_CAP_MS, else waits 1 s doubling (same cap) with equal jitter (half fixed,
 * half random) so many requests failing on one outage do not retry in lockstep.
 */
export function computeRetryDelayMs(
  attempt: number,
  retryAfterMs: number | undefined,
  kind: RetryKind = "rate_limit",
  random: () => number = Math.random,
): number {
  if (kind === "rate_limit") return backoffMs(attempt, retryAfterMs);
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, TRANSIENT_BACKOFF_CAP_MS);
  }
  const ceiling = Math.min(TRANSIENT_BACKOFF_BASE_MS * 2 ** attempt, TRANSIENT_BACKOFF_CAP_MS);
  const jitter = Math.min(Math.max(random(), 0), 1);
  return Math.round(ceiling / 2 + (ceiling / 2) * jitter);
}

function retryAfterOf(error: unknown): number | undefined {
  return error instanceof LLMHttpError ? error.retryAfterMs : undefined;
}

/**
 * Reserve this request's proactive-throttle slot. Returns the pacing delay to await when the
 * connection is over its cap, or `undefined` when no wait is needed. Returning `undefined`
 * synchronously (the common, unthrottled path) is deliberate: it lets the caller invoke the wrapped
 * provider in the SAME microtask, so the inner admission slot is still acquired synchronously —
 * awaiting an already-resolved value here would yield a tick and briefly open the concurrency gate.
 */
function reserveThrottleSlot(connectionId: string, context: RetryContext): Promise<void> | undefined {
  const maxRpm = getConnectionRateLimit(connectionId);
  if (!maxRpm || maxRpm <= 0) return undefined;
  const minIntervalMs = Math.ceil(60_000 / maxRpm);
  const now = Date.now();
  const earliest = Math.max(now, nextAllowedAt.get(connectionId) ?? 0);
  const reserved = earliest + minIntervalMs;
  nextAllowedAt.set(connectionId, reserved);
  const waitMs = earliest - now;
  if (waitMs <= 0) return undefined;
  context.onRateLimitPause?.({ attempt: 0, delayMs: waitMs, reason: "throttle" });
  return abortableDelay(waitMs, context.signal).catch((error) => {
    // Aborted mid-wait: hand our reservation back if we are still the tail so a cancelled
    // request does not inject phantom pacing delay into the requests queued behind it.
    if (nextAllowedAt.get(connectionId) === reserved) {
      nextAllowedAt.set(connectionId, earliest);
    }
    throw error;
  });
}

/**
 * Wrap the streaming callbacks of `options` so the retry loop can tell whether this attempt already
 * pushed text to the user. `chatComplete` streams through `onToken`, and both paths stream
 * reasoning through `onThinking`, so a failure after that must not trigger a replay that would
 * show the user the same text twice (and pay for it twice). When neither callback is set the
 * original options object is returned unchanged. Only used while transient retry is enabled, so
 * the default path hands the wrapped provider the caller's options object as before.
 */
function trackStreamedOutput(options: ChatOptions): { options: ChatOptions; emitted: () => boolean } {
  const { onToken, onThinking } = options;
  if (!onToken && !onThinking) return { options, emitted: () => false };
  let emitted = false;
  const tracked: ChatOptions = { ...options };
  if (onToken) {
    tracked.onToken = (chunk) => {
      if (chunk) emitted = true;
      return onToken(chunk);
    };
  }
  if (onThinking) {
    tracked.onThinking = (chunk) => {
      if (chunk) emitted = true;
      onThinking(chunk);
    };
  }
  return { options: tracked, emitted: () => emitted };
}

export interface RateLimitAwareProviderOptions {
  /**
   * false turns the transient retry off for this wrapper even when PROVIDER_RETRY_TRANSIENT_ERRORS
   * is on. The connection-fallback primary leg passes false: when a fallback exists, switching to
   * it is faster than waiting out a backoff on a connection that just failed. Default true.
   */
  transientRetry?: boolean;
}

export class RateLimitAwareProvider extends BaseLLMProvider {
  private readonly transientRetryAllowed: boolean;

  constructor(
    readonly provider: BaseLLMProvider,
    private readonly connectionId: string,
    options: RateLimitAwareProviderOptions = {},
  ) {
    super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
    this.transientRetryAllowed = options.transientRetry !== false;
  }

  /**
   * This wrapper with the transient retry turned off, keeping its connection id and inner provider.
   * Returns itself when the retry is already off. Used when an existing wrapper is reused for the
   * primary leg of a connection with a fallback.
   */
  withoutTransientRetry(): RateLimitAwareProvider {
    if (!this.transientRetryAllowed) return this;
    return new RateLimitAwareProvider(this.provider, this.connectionId, { transientRetry: false });
  }

  /** Transient retry applies to this request: the setting is on and this wrapper allows it. Read per request. */
  private transientRetryActive(): boolean {
    return this.transientRetryAllowed && isProviderTransientRetryEnabled();
  }

  /**
   * Decide whether a failed attempt may be retried. Returns the retry kind, or null when the error
   * must propagate: not retryable, aborted, or the budget for that kind is spent. Budgets are
   * counted per kind so a transient blip cannot consume the rate-limit budget and vice versa.
   * `transientAllowed` is false when transient retry is off or output already reached the user;
   * rate limits keep exactly the conditions they had before.
   */
  private nextRetry(
    error: unknown,
    counts: RetryCounts,
    signal: AbortSignal | undefined,
    transientAllowed: boolean,
  ): RetryKind | null {
    if (signal?.aborted) return null;
    const kind = classifyRetry(error);
    if (!kind) return null;
    if (kind === "transient" && !transientAllowed) return null;
    const budget = kind === "rate_limit" ? MAX_RATE_LIMIT_RETRIES : MAX_TRANSIENT_RETRIES;
    return counts[kind] < budget ? kind : null;
  }

  private pauseForRetry(context: RetryContext, kind: RetryKind, counts: RetryCounts, error: unknown): Promise<void> {
    const kindAttempt = counts[kind];
    counts[kind] += 1;
    const retryAfterMs = retryAfterOf(error);
    const delayMs = computeRetryDelayMs(kindAttempt, retryAfterMs, kind);
    if (kind === "rate_limit") {
      logger.warn(
        "Rate limited on connection %s (attempt %d/%d); pausing %dms before resuming",
        this.connectionId,
        kindAttempt + 1,
        MAX_RATE_LIMIT_RETRIES,
        delayMs,
      );
      context.onRateLimitPause?.({ attempt: kindAttempt + 1, delayMs, reason: "rate_limit" });
    } else {
      // Not surfaced through onRateLimitPause: callers treat that callback as "provider quota
      // exhausted", which a short transient retry is not.
      logger.warn(
        {
          connectionId: this.connectionId,
          httpStatus: error instanceof LLMHttpError ? error.status : undefined,
          errorCode: transientNetworkErrorCode(error),
          retryAfterMs,
        },
        "Transient provider failure on connection %s (attempt %d/%d); retrying in %dms",
        this.connectionId,
        kindAttempt + 1,
        MAX_TRANSIENT_RETRIES,
        delayMs,
      );
    }
    return abortableDelay(delayMs, context.signal);
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const counts: RetryCounts = { rate_limit: 0, transient: 0 };
    for (;;) {
      // Reserve a throttle slot per attempt, since each retry is a fresh outbound request. When
      // unthrottled this returns undefined synchronously, so the first attempt still starts the
      // wrapped provider in the same microtask (keeping admission-slot acquisition synchronous).
      const throttleWait = reserveThrottleSlot(this.connectionId, options);
      if (throttleWait) await throttleWait;
      let yieldedAny = false;
      const transient = this.transientRetryActive();
      const tracked = transient ? trackStreamedOutput(options) : { options, emitted: () => false };
      const iterator = this.provider.chat(messages, tracked.options);
      try {
        let step = await iterator.next();
        while (!step.done) {
          yieldedAny = true;
          yield step.value;
          step = await iterator.next();
        }
        return step.value;
      } catch (error) {
        // Once tokens have reached the consumer the stream cannot be replayed, so only a
        // pre-first-token failure is retryable; anything else propagates. A transient retry also
        // requires that no reasoning was streamed through onThinking.
        const kind = yieldedAny ? null : this.nextRetry(error, counts, options.signal, transient && !tracked.emitted());
        if (!kind) throw error;
        await this.pauseForRetry(options, kind, counts, error);
      } finally {
        // Close the wrapped generator so its slot-releasing finally runs even when the consumer
        // abandons this stream early (break/return/abort) while we are suspended at a yield, or
        // before we retry with a fresh iterator. Mirrors the gen.return() guards elsewhere.
        await iterator.return(undefined).catch(() => {});
      }
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const counts: RetryCounts = { rate_limit: 0, transient: 0 };
    for (;;) {
      const throttleWait = reserveThrottleSlot(this.connectionId, options);
      if (throttleWait) await throttleWait;
      const transient = this.transientRetryActive();
      const tracked = transient ? trackStreamedOutput(options) : { options, emitted: () => false };
      try {
        return await this.provider.chatComplete(messages, tracked.options);
      } catch (error) {
        // Rate limits keep their existing rule. A transient retry never replays output that
        // already streamed through onToken / onThinking.
        const kind = this.nextRetry(error, counts, options.signal, transient && !tracked.emitted());
        if (!kind) throw error;
        await this.pauseForRetry(options, kind, counts, error);
      }
    }
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    const context: RetryContext = { signal };
    const counts: RetryCounts = { rate_limit: 0, transient: 0 };
    for (;;) {
      const throttleWait = reserveThrottleSlot(this.connectionId, context);
      if (throttleWait) await throttleWait;
      try {
        return await this.provider.embed(texts, model, signal);
      } catch (error) {
        const kind = this.nextRetry(error, counts, signal, this.transientRetryActive());
        if (!kind) throw error;
        await this.pauseForRetry(context, kind, counts, error);
      }
    }
  }
}

export function withRateLimitAwareProvider(
  provider: BaseLLMProvider,
  connectionId: string,
  options?: RateLimitAwareProviderOptions,
): BaseLLMProvider {
  // Idempotent: never nest two retry layers (which would multiply retries), since the decorator is
  // installed both in createLLMProvider and around the connection-fallback legs. An existing wrapper
  // still honours transientRetry: false, so the caller's opt-out is never silently dropped.
  if (provider instanceof RateLimitAwareProvider) {
    return options?.transientRetry === false ? provider.withoutTransientRetry() : provider;
  }
  return new RateLimitAwareProvider(provider, connectionId, options);
}
