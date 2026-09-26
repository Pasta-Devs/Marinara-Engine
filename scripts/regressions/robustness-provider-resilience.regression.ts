// Provider resilience. By default RateLimitAwareProvider behaves exactly as
// before: only rate limits are retried, on the same un-jittered schedule.
// Opt-in (PROVIDER_RETRY_TRANSIENT_ERRORS): it also retries a small, jittered
// budget of transient failures (refused / unreachable connection, gateway
// 502 / 503) before any output reached the consumer, never on the primary leg
// of a connection that has a fallback. Nothing is replayed after text or
// reasoning was streamed, 504 and socket resets are never retried, a long
// Retry-After is capped at 5 s, and rate limits keep their own larger budget.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";

// Set before the logger loads, so the expected retry warnings stay out of the output.
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
delete process.env.PROVIDER_RETRY_TRANSIENT_ERRORS;

const { BaseLLMProvider, LLMHttpError, isRateLimitError } =
  await import("../../packages/server/src/services/llm/base-provider.js");
const {
  MAX_RATE_LIMIT_RETRIES,
  MAX_TRANSIENT_RETRIES,
  computeRetryDelayMs,
  isTransientProviderError,
  withRateLimitAwareProvider,
} = await import("../../packages/server/src/services/llm/rate-limit-aware-provider.js");

const codeError = (code: string) => Object.assign(new Error(`fetch failed (${code})`), { code });
const wrapped = (code: string) => new Error("LLM transport failed", { cause: codeError(code) });

// 1. Classification.
assert.equal(isTransientProviderError(new LLMHttpError("bad gateway", { status: 502 })), true);
assert.equal(isTransientProviderError(new LLMHttpError("unavailable", { status: 503 })), true);
assert.equal(isRateLimitError(new LLMHttpError("unavailable", { status: 503 })), false, "a bare 503 is no rate limit");
assert.equal(
  isTransientProviderError(new LLMHttpError("gateway timeout", { status: 504 })),
  false,
  "504 may be billed",
);
assert.equal(isTransientProviderError(new LLMHttpError("server error", { status: 500 })), false);
assert.equal(isTransientProviderError(new LLMHttpError("bad request", { status: 400 })), false);
for (const code of ["ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"]) {
  assert.equal(isTransientProviderError(codeError(code)), true, `${code} is connect-phase`);
  assert.equal(isTransientProviderError(wrapped(code)), true, `${code} is found on the cause chain`);
}
for (const code of ["ECONNRESET", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT"]) {
  assert.equal(isTransientProviderError(codeError(code)), false, `${code} may follow a processed request`);
}
const aborted = Object.assign(new Error("aborted", { cause: codeError("ECONNREFUSED") }), { name: "AbortError" });
assert.equal(isTransientProviderError(aborted), false, "an abort is never retried");
assert.equal(MAX_TRANSIENT_RETRIES < MAX_RATE_LIMIT_RETRIES, true, "transient budget is the small one");

// 2. Delays. Rate limits keep the existing schedule exactly: Retry-After
// (capped at 60 s), else 2 s doubling up to 60 s, with no jitter.
for (const random of [() => 0, () => 0.5, () => 1]) {
  assert.equal(computeRetryDelayMs(0, undefined, "rate_limit", random), 2_000, "first 429 wait is unchanged");
  assert.equal(computeRetryDelayMs(1, undefined, "rate_limit", random), 4_000);
  assert.equal(computeRetryDelayMs(20, undefined, "rate_limit", random), 60_000, "backoff is capped");
}
assert.equal(computeRetryDelayMs(0, 120_000, "rate_limit"), 60_000, "Retry-After is capped");
assert.equal(computeRetryDelayMs(0, 7_000, "rate_limit"), 7_000);
// Transient: Retry-After honoured up to 5 s; otherwise equal jitter in [ceiling/2, ceiling], ceiling capped at 5 s.
assert.equal(computeRetryDelayMs(3, 0, "transient"), 0);
assert.equal(computeRetryDelayMs(0, 120_000, "transient"), 5_000, "a long Retry-After cannot hold a transient retry");
assert.equal(
  computeRetryDelayMs(0, undefined, "transient", () => 0),
  500,
);
assert.equal(
  computeRetryDelayMs(0, undefined, "transient", () => 1),
  1_000,
);
assert.equal(
  computeRetryDelayMs(20, undefined, "transient", () => 1),
  5_000,
  "transient backoff is capped",
);

// 3. Behaviour through the decorator.
const OK: ChatCompletionResult = {
  content: "done",
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  finishReason: "stop",
} as ChatCompletionResult;

type Step = "502" | "503" | "504" | "refused" | "reset" | "429" | "ok";

function failure(step: Step): Error | null {
  switch (step) {
    case "502":
      // Retry-After 0 keeps the regression fast; the jittered path is unit-tested above.
      return new LLMHttpError("bad gateway", { status: 502, retryAfterMs: 0 });
    case "503":
      return new LLMHttpError("unavailable", { status: 503 });
    case "504":
      return new LLMHttpError("gateway timeout", { status: 504, retryAfterMs: 0 });
    case "refused":
      return wrapped("ECONNREFUSED");
    case "reset":
      return wrapped("ECONNRESET");
    case "429":
      return new LLMHttpError("rate limited", { status: 429, retryAfterMs: 0 });
    default:
      return null;
  }
}

class ScriptedProvider extends BaseLLMProvider {
  public calls = 0;
  constructor(
    private readonly plan: Step[],
    private readonly streamBeforeFailure = false,
  ) {
    super("", "", 1000, null, null);
  }
  private next(): Step {
    const step = this.plan[Math.min(this.calls, this.plan.length - 1)]!;
    this.calls += 1;
    return step;
  }
  async *chat(): AsyncGenerator<string, void, unknown> {
    const error = failure(this.next());
    if (error && this.streamBeforeFailure) yield "partial ";
    if (error) throw error;
    yield "hello";
  }
  async chatComplete(_messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const error = failure(this.next());
    if (error && this.streamBeforeFailure) await options.onToken?.("partial ");
    if (error) throw error;
    return OK;
  }
  async embed(): Promise<number[][]> {
    const error = failure(this.next());
    if (error) throw error;
    return [[1]];
  }
}

const options = { model: "test" } as ChatOptions;
const collect = async (iterable: AsyncGenerator<string, unknown, unknown>) => {
  let text = "";
  for await (const chunk of iterable) text += chunk;
  return text;
};

// 3a. Default (setting unset): transient failures propagate at once, rate limits are still retried, and the
// wrapped provider receives the caller's own options object.
for (const step of ["502", "503", "refused"] as const) {
  const provider = new ScriptedProvider([step, "ok"]);
  await assert.rejects(() => withRateLimitAwareProvider(provider, `conn-default-${step}`).chatComplete([], options));
  assert.equal(provider.calls, 1, `default: ${step} is attempted exactly once`);
}
{
  const provider = new ScriptedProvider(["refused", "ok"]);
  await assert.rejects(() => withRateLimitAwareProvider(provider, "conn-default-embed").embed(["x"], "embed-model"));
  assert.equal(provider.calls, 1, "default: a refused embedding connection is not retried");
  const stream = new ScriptedProvider(["502", "ok"]);
  await assert.rejects(() => collect(withRateLimitAwareProvider(stream, "conn-default-stream").chat([], options)));
  assert.equal(stream.calls, 1, "default: a stream is not retried on 502");
}
{
  const provider = new ScriptedProvider(["429", "ok"]);
  const result = await withRateLimitAwareProvider(provider, "conn-default-429").chatComplete([], options);
  assert.equal(result.content, "done", "default: a 429 is retried as before");
  assert.equal(provider.calls, 2);
}
{
  let received: ChatOptions | undefined;
  class OptionsProbe extends ScriptedProvider {
    async chatComplete(messages: ChatMessage[], callOptions: ChatOptions): Promise<ChatCompletionResult> {
      received = callOptions;
      return super.chatComplete(messages, callOptions);
    }
  }
  const withToken = { ...options, onToken: () => undefined } as ChatOptions;
  await withRateLimitAwareProvider(new OptionsProbe(["ok"]), "conn-default-options").chatComplete([], withToken);
  assert.equal(received, withToken, "default: the options object is passed through untouched");
}

// 3b. Opt-in.
process.env.PROVIDER_RETRY_TRANSIENT_ERRORS = "true";
{
  // A connection with a fallback never waits out a transient backoff on its primary leg.
  const provider = new ScriptedProvider(["502", "ok"]);
  await assert.rejects(() =>
    withRateLimitAwareProvider(provider, "conn-primary", { transientRetry: false }).chatComplete([], options),
  );
  assert.equal(provider.calls, 1, "the fallback primary leg does not retry transient failures");
  const limited = new ScriptedProvider(["429", "ok"]);
  const result = await withRateLimitAwareProvider(limited, "conn-primary-429", { transientRetry: false }).chatComplete(
    [],
    options,
  );
  assert.equal(result.content, "done", "rate limits on the primary leg are unchanged");
  const fallbackSource = readFileSync(
    join(resolve(import.meta.dirname, "../.."), "packages/server/src/services/llm/connection-fallback-provider.ts"),
    "utf8",
  );
  assert.match(
    fallbackSource,
    /const admittedPrimary = withRateLimitAwareProvider\([^;]*\{ transientRetry: false \},?\s*\);/u,
    "the fallback primary leg is built with transientRetry: false",
  );
  // A primary that already carries its own wrapper (createLLMProvider with a connectionId, or a
  // capability package) still honours the opt-out instead of being returned unchanged.
  const prewrapped = new ScriptedProvider(["502", "ok"]);
  const existing = withRateLimitAwareProvider(prewrapped, "conn-prewrapped");
  const optedOut = withRateLimitAwareProvider(existing, "conn-prewrapped", { transientRetry: false });
  assert.notEqual(optedOut, existing, "an existing wrapper is rebuilt with the retry off");
  await assert.rejects(() => optedOut.chatComplete([], options));
  assert.equal(prewrapped.calls, 1, "a pre-wrapped fallback primary does not retry transient failures");
  assert.equal(
    withRateLimitAwareProvider(optedOut, "conn-prewrapped", { transientRetry: false }),
    optedOut,
    "no new wrapper when the retry is already off",
  );
  assert.equal(withRateLimitAwareProvider(existing, "conn-prewrapped"), existing, "default reuse is unchanged");
  assert.match(
    fallbackSource,
    /primary instanceof RateLimitAwareProvider \? primary\.withoutTransientRetry\(\) : primary/u,
    "an inner wrapper under admission is opted out too",
  );
}
{
  const provider = new ScriptedProvider(["502", "ok"]);
  const result = await withRateLimitAwareProvider(provider, "conn-502").chatComplete([], options);
  assert.equal(result.content, "done", "a gateway blip before output completes the same request");
  assert.equal(provider.calls, 2);
}
{
  const provider = new ScriptedProvider(["502"]);
  await assert.rejects(
    () => withRateLimitAwareProvider(provider, "conn-502-down").chatComplete([], options),
    /bad gateway/,
    "the original error propagates once the budget is spent",
  );
  assert.equal(provider.calls, MAX_TRANSIENT_RETRIES + 1, "initial attempt plus the transient budget");
}
{
  const provider = new ScriptedProvider(["504"]);
  await assert.rejects(() => withRateLimitAwareProvider(provider, "conn-504").chatComplete([], options), /timeout/);
  assert.equal(provider.calls, 1, "504 is attempted exactly once");
}
{
  const provider = new ScriptedProvider(["reset"]);
  await assert.rejects(() => withRateLimitAwareProvider(provider, "conn-reset").chatComplete([], options));
  assert.equal(provider.calls, 1, "a socket reset is attempted exactly once");
}
{
  // Budgets are counted per kind: transient blips do not spend the rate-limit budget.
  const provider = new ScriptedProvider(["502", "429", "502", "429", "ok"]);
  const result = await withRateLimitAwareProvider(provider, "conn-mixed").chatComplete([], options);
  assert.equal(result.content, "done");
  assert.equal(provider.calls, 5);
}
{
  // Text already streamed through onToken is never replayed.
  const provider = new ScriptedProvider(["502", "ok"], true);
  const seen: string[] = [];
  await assert.rejects(() =>
    withRateLimitAwareProvider(provider, "conn-after-output").chatComplete([], {
      ...options,
      onToken: (chunk) => {
        seen.push(chunk);
      },
    }),
  );
  assert.equal(provider.calls, 1, "no retry after output reached the consumer");
  assert.deepEqual(seen, ["partial "]);
}
{
  // The streaming path: retried before the first chunk, never after it.
  const before = new ScriptedProvider(["502", "ok"]);
  assert.equal(await collect(withRateLimitAwareProvider(before, "conn-stream").chat([], options)), "hello");
  assert.equal(before.calls, 2);
  const after = new ScriptedProvider(["502", "ok"], true);
  await assert.rejects(() => collect(withRateLimitAwareProvider(after, "conn-stream-after").chat([], options)));
  assert.equal(after.calls, 1, "a stream that yielded text is not replayed");
}
{
  // A refused connection (no Retry-After: real jittered delay of 0.5 to 1 s).
  const provider = new ScriptedProvider(["refused", "ok"]);
  const started = Date.now();
  const vectors = await withRateLimitAwareProvider(provider, "conn-refused").embed(["x"], "embed-model");
  assert.deepEqual(vectors, [[1]]);
  assert.equal(provider.calls, 2);
  assert.ok(Date.now() - started >= 450, "the transient retry waits its jittered backoff");
}
{
  // An abort during the backoff stops the retry loop.
  const provider = new ScriptedProvider(["503"]);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("user stopped")), 50);
  await assert.rejects(
    () =>
      withRateLimitAwareProvider(provider, "conn-abort").chatComplete([], { ...options, signal: controller.signal }),
    /user stopped/,
  );
  assert.equal(provider.calls, 1, "no further attempt after the abort");
}

console.info("Robustness provider resilience regression passed.");
