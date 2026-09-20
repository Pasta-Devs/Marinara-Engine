import assert from "node:assert/strict";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../../packages/server/src/services/llm/base-provider.js";
import { getDiagnosticContext, withDiagnosticContext } from "../../packages/server/src/lib/diagnostics.js";
import { withDiagnosticProvider } from "../../packages/server/src/services/llm/diagnostic-provider.js";
import { logger } from "../../packages/server/src/lib/logger.js";
await new Promise((resolve) => setImmediate(resolve)); // Allow initial .env level reconciliation before observing logs.
const records: Array<Record<string, unknown>> = [];
const originals = { info: logger.info, warn: logger.warn, error: logger.error };
for (const level of ["info", "warn", "error"] as const) {
  logger[level] = ((first: unknown, ...rest: unknown[]) => {
    if (first && typeof first === "object") records.push(first as Record<string, unknown>);
    Reflect.apply(originals[level], logger, [first, ...rest]);
  }) as typeof logger.info;
}

class FakeProvider extends BaseLLMProvider {
  returnCount = 0;
  completionContext: string | undefined;
  embedContext: string | undefined;
  streamContexts: Array<{ requestId?: string; operationId?: string }> = [];
  constructor(private readonly failure?: Error) {
    super("", "", 4096);
  }
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, LLMUsage> {
    try {
      this.streamContexts.push(getDiagnosticContext());
      yield "one";
      yield "two";
      return { promptTokens: 1, completionTokens: 2, totalTokens: 3, finishReason: "stop" };
    } finally {
      this.returnCount++;
    }
  }
  override chatComplete(_messages: ChatMessage[], _options: ChatOptions): Promise<ChatCompletionResult> {
    this.completionContext = getDiagnosticContext().operation;
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve({ content: "complete", toolCalls: [], finishReason: "stop" });
  }
  override embed(_texts: string[], _model: string): Promise<number[][]> {
    this.embedContext = getDiagnosticContext().operation;
    return Promise.resolve([[1, 2]]);
  }
}

class ResultProvider extends BaseLLMProvider {
  constructor(private readonly finishReason: "error" | "abort") {
    super("", "");
  }
  async *chat(): AsyncGenerator<string, LLMUsage> {
    return { promptTokens: 1, completionTokens: 0, totalTokens: 1, finishReason: this.finishReason };
  }
  override chatComplete(): Promise<ChatCompletionResult> {
    return Promise.resolve({ content: "", toolCalls: [], finishReason: this.finishReason });
  }
}

const fake = new FakeProvider();
const decorated = withDiagnosticProvider(fake, "fake-provider", "conn-1");
assert.equal(decorated.maxContextValue, 4096);
assert.deepEqual(await decorated.embed(["x"], "model"), [[1, 2]]);
assert.equal(fake.embedContext, "llm.provider");
const completion = await decorated.chatComplete([], { model: "model" });
assert.equal(completion.content, "complete");
assert.equal(fake.completionContext, "llm.provider");
for (const finishReason of ["error", "abort"] as const) {
  const result = await withDiagnosticProvider(new ResultProvider(finishReason), "result-provider").chatComplete([], {
    model: "model",
  });
  assert.equal(result.finishReason, finishReason);
}

const stream = decorated.chat([], { model: "model" });
assert.deepEqual(await stream.next(), { done: false, value: "one" });
assert.deepEqual(await stream.next(), { done: false, value: "two" });
const usage = await stream.next();
assert.equal(usage.done, true);
assert.equal((usage.value as LLMUsage).totalTokens, 3);

const early = decorated.chat([], { model: "model" });
assert.equal((await early.next()).value, "one");
await early.return();
assert.equal(fake.returnCount, 2, "early return must close the underlying generator");
const thrown = decorated.chat([], { model: "model" });
await thrown.next();
const thrownError = new Error("caller throw");
await assert.rejects(thrown.throw(thrownError), (error) => error === thrownError);
assert.equal(fake.returnCount, 3, "throw must preserve error and close underlying generator");

const original = new Error("same failure");
await assert.rejects(
  () =>
    withDiagnosticProvider(new FakeProvider(original), "fake-provider", "conn-2").chatComplete([], { model: "model" }),
  (error) => error === original,
);

const contexts = await Promise.all(
  ["left", "right"].map((caller) =>
    withDiagnosticContext({ requestId: caller }, async () => {
      const iterator = decorated.chat([], { model: caller });
      await iterator.next();
      const current = getDiagnosticContext();
      await iterator.return();
      return { caller, requestId: current.requestId };
    }),
  ),
);
assert.deepEqual(contexts.map(({ requestId }) => requestId).sort(), ["left", "right"]);
assert.equal(getDiagnosticContext().requestId, undefined);
const parallel = fake.streamContexts.filter((context) => context.requestId === "left" || context.requestId === "right");
assert.equal(parallel.length, 2);
assert.notEqual(parallel[0]!.operationId, parallel[1]!.operationId);
assert.ok(parallel.every((context) => context.operationId));
assert.ok(records.some((record) => record.finishReason === "error" && record.stage === "partial-stream"));
assert.ok(records.some((record) => record.finishReason === "abort" && record.stage === "cancelled"));
assert.ok(
  !records.some((record) => ["error", "abort"].includes(String(record.finishReason)) && record.stage === "success"),
);
Object.assign(logger, originals);

console.log("diagnostic-provider regression: ok");
