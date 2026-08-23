// ──────────────────────────────────────────────
// Rate-limit-aware provider decorator
// ──────────────────────────────────────────────
// Two behaviours, both keyed by connection id so they cover every caller of a connection
// (Professor Mari's rapid tool-call loop, normal chat generation, embeddings, …):
//
//   • Proactive throttle — when the connection has a `maxRequestsPerMinute` cap, requests are
//     paced so a burst (e.g. Mari's up-to-13 back-to-back rounds) cannot exceed it. Off by
//     default (no cap configured → no pacing).
//   • Reactive pause/resume — always on. A provider 429 / 529 is caught, the request pauses
//     (honouring `Retry-After` when present, else capped exponential backoff), then the SAME
//     request is retried so the task completes instead of aborting. Bounded and abort-aware.
//
// Mirrors the ConnectionAdmissionProvider decorator shape and installs alongside it.
import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "./base-provider.js";
import { BaseLLMProvider, isRateLimitError } from "./base-provider.js";
import { getConnectionRateLimit } from "./connection-rate-limit-registry.js";
import { logger } from "../../lib/logger.js";

export const MAX_RATE_LIMIT_RETRIES = 6;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 60_000;

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

export class RateLimitAwareProvider extends BaseLLMProvider {
  constructor(
    readonly provider: BaseLLMProvider,
    private readonly connectionId: string,
  ) {
    super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
  }

  private pauseForRetry(context: RetryContext, attempt: number, retryAfterMs: number | undefined): Promise<void> {
    const delayMs = backoffMs(attempt, retryAfterMs);
    logger.warn(
      "Rate limited on connection %s (attempt %d/%d); pausing %dms before resuming",
      this.connectionId,
      attempt + 1,
      MAX_RATE_LIMIT_RETRIES,
      delayMs,
    );
    context.onRateLimitPause?.({ attempt: attempt + 1, delayMs, reason: "rate_limit" });
    return abortableDelay(delayMs, context.signal);
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    for (let attempt = 0; ; attempt += 1) {
      // Reserve a throttle slot per attempt, since each retry is a fresh outbound request. When
      // unthrottled this returns undefined synchronously, so the first attempt still starts the
      // wrapped provider in the same microtask (keeping admission-slot acquisition synchronous).
      const throttleWait = reserveThrottleSlot(this.connectionId, options);
      if (throttleWait) await throttleWait;
      let yieldedAny = false;
      const iterator = this.provider.chat(messages, options);
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
        // pre-first-token rate limit is retryable; anything else propagates.
        if (yieldedAny || !isRateLimitError(error) || attempt >= MAX_RATE_LIMIT_RETRIES || options.signal?.aborted) {
          throw error;
        }
        await this.pauseForRetry(options, attempt, error.retryAfterMs);
      } finally {
        // Close the wrapped generator so its slot-releasing finally runs even when the consumer
        // abandons this stream early (break/return/abort) while we are suspended at a yield, or
        // before we retry with a fresh iterator. Mirrors the gen.return() guards elsewhere.
        await iterator.return(undefined).catch(() => {});
      }
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    for (let attempt = 0; ; attempt += 1) {
      const throttleWait = reserveThrottleSlot(this.connectionId, options);
      if (throttleWait) await throttleWait;
      try {
        return await this.provider.chatComplete(messages, options);
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= MAX_RATE_LIMIT_RETRIES || options.signal?.aborted) {
          throw error;
        }
        await this.pauseForRetry(options, attempt, error.retryAfterMs);
      }
    }
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    const context: RetryContext = { signal };
    for (let attempt = 0; ; attempt += 1) {
      const throttleWait = reserveThrottleSlot(this.connectionId, context);
      if (throttleWait) await throttleWait;
      try {
        return await this.provider.embed(texts, model, signal);
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= MAX_RATE_LIMIT_RETRIES || signal?.aborted) {
          throw error;
        }
        await this.pauseForRetry(context, attempt, error.retryAfterMs);
      }
    }
  }
}

export function withRateLimitAwareProvider(provider: BaseLLMProvider, connectionId: string): BaseLLMProvider {
  // Idempotent: never nest two retry layers (which would multiply retries), since the decorator is
  // installed both in createLLMProvider and around the connection-fallback legs.
  if (provider instanceof RateLimitAwareProvider) return provider;
  return new RateLimitAwareProvider(provider, connectionId);
}
