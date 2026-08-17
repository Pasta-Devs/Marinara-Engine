import assert from "node:assert/strict";
import {
  BaseLLMProvider,
  LLMHttpError,
  isRateLimitError,
  parseRetryAfterMs,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import {
  MAX_RATE_LIMIT_RETRIES,
  withRateLimitAwareProvider,
} from "../../packages/server/src/services/llm/rate-limit-aware-provider.js";
import {
  clearConnectionRateLimit,
  getConnectionRateLimit,
  resetConnectionRateLimitsForTests,
  setConnectionRateLimit,
} from "../../packages/server/src/services/llm/connection-rate-limit-registry.js";

// ── parseRetryAfterMs ─────────────────────────────────────────────
assert.equal(parseRetryAfterMs("12"), 12_000, "delta-seconds parse to ms");
assert.equal(parseRetryAfterMs("0"), 0, "zero seconds is a valid immediate retry");
assert.equal(parseRetryAfterMs(null), undefined, "absent header yields undefined");
assert.equal(parseRetryAfterMs("not-a-date"), undefined, "unparseable header yields undefined");
assert.equal(
  parseRetryAfterMs("Wed, 21 Oct 1999 07:28:00 GMT"),
  0,
  "a past HTTP-date clamps to 0, never negative",
);

// ── isRateLimitError classification ───────────────────────────────
assert.equal(isRateLimitError(new LLMHttpError("x", { status: 429 })), true, "429 is retryable");
assert.equal(isRateLimitError(new LLMHttpError("x", { status: 529 })), true, "529 overloaded is retryable");
assert.equal(
  isRateLimitError(new LLMHttpError("x", { status: 503, retryAfterMs: 30_000 })),
  true,
  "503 WITH Retry-After is retryable",
);
assert.equal(
  isRateLimitError(new LLMHttpError("x", { status: 503 })),
  false,
  "bare 503 (likely a real outage) is not retryable",
);
assert.equal(isRateLimitError(new LLMHttpError("x", { status: 400 })), false, "400 is not retryable");
assert.equal(isRateLimitError(new Error("plain")), false, "a plain Error is never a rate limit");

// ── registry ──────────────────────────────────────────────────────
resetConnectionRateLimitsForTests();
setConnectionRateLimit("conn-a", 5);
assert.equal(getConnectionRateLimit("conn-a"), 5, "a positive cap is recorded");
setConnectionRateLimit("conn-a", null);
assert.equal(getConnectionRateLimit("conn-a"), null, "null clears the cap (unlimited)");
setConnectionRateLimit("conn-a", 0);
assert.equal(getConnectionRateLimit("conn-a"), null, "0 is treated as unlimited");
setConnectionRateLimit("conn-a", 7);
clearConnectionRateLimit("conn-a");
assert.equal(getConnectionRateLimit("conn-a"), null, "clear removes the cap");

// ── reactive retry behaviour ──────────────────────────────────────
const OK: ChatCompletionResult = {
  content: "done",
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  finishReason: "stop",
} as ChatCompletionResult;

class ScriptedProvider extends BaseLLMProvider {
  public calls = 0;
  constructor(private readonly plan: Array<"429" | "400" | "ok">) {
    super("", "", 1000, null, null);
  }
  // eslint-disable-next-line require-yield
  async *chat(): AsyncGenerator<string, void, unknown> {
    return;
  }
  async chatComplete(_messages: ChatMessage[], _options: ChatOptions): Promise<ChatCompletionResult> {
    const step = this.plan[Math.min(this.calls, this.plan.length - 1)];
    this.calls += 1;
    if (step === "429") throw new LLMHttpError("rate limited", { status: 429, retryAfterMs: 0 });
    if (step === "400") throw new LLMHttpError("bad request", { status: 400 });
    return OK;
  }
  async embed(): Promise<number[][]> {
    return [];
  }
}

const options = { model: "test" } as ChatOptions;

// Retries a 429 (retryAfterMs 0 -> instant) and completes the SAME request.
const retried = new ScriptedProvider(["429", "429", "ok"]);
const retriedResult = await withRateLimitAwareProvider(retried, "conn-retry").chatComplete([], options);
assert.equal(retriedResult.content, "done", "the request completes after the rate limit clears");
assert.equal(retried.calls, 3, "it retried twice then succeeded on the third attempt");

// A non-rate-limit error propagates immediately with no retry.
const nonRetryable = new ScriptedProvider(["400"]);
await assert.rejects(
  () => withRateLimitAwareProvider(nonRetryable, "conn-400").chatComplete([], options),
  /bad request/,
  "a 400 must not be retried",
);
assert.equal(nonRetryable.calls, 1, "non-retryable errors are attempted exactly once");

// Persistent 429s are bounded by MAX_RATE_LIMIT_RETRIES.
const exhausted = new ScriptedProvider(["429"]);
await assert.rejects(
  () => withRateLimitAwareProvider(exhausted, "conn-exhaust").chatComplete([], options),
  /rate limited/,
  "an unrecoverable rate limit eventually surfaces",
);
assert.equal(
  exhausted.calls,
  MAX_RATE_LIMIT_RETRIES + 1,
  "it makes the initial attempt plus exactly MAX_RATE_LIMIT_RETRIES retries",
);

// The decorator factory is idempotent (never nests two retry layers).
const base = new ScriptedProvider(["ok"]);
const once = withRateLimitAwareProvider(base, "conn-idem");
assert.equal(withRateLimitAwareProvider(once, "conn-idem"), once, "re-wrapping returns the same instance");

console.log("rate-limit-aware provider regression: OK");
