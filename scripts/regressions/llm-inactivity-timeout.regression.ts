import assert from "node:assert/strict";
import { AsyncResource } from "node:async_hooks";
import { getEventListeners } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "marinara-llm-idle-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.AGENT_CALL_TIMEOUT_MS = "10000";
process.env.LOG_LEVEL = "silent";
const { withLlmInactivityTimeout, markLlmRequestActivity } =
  await import("../../packages/server/src/services/llm/base-provider.js");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function observe<T>(promise: Promise<T>) {
  const result: { state: "pending" | "fulfilled" | "rejected"; value?: T; error?: unknown } = { state: "pending" };
  void promise.then(
    (value) => {
      result.state = "fulfilled";
      result.value = value;
    },
    (error: unknown) => {
      result.state = "rejected";
      result.error = error;
    },
  );
  return result;
}
async function flush() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}

// Node24 MockTimers exposes refresh(), but does not move its deadline. Model native Timeout.refresh
// explicitly, so these proofs exercise silence rather than accidentally imposing a total deadline.
class Clock {
  now = 0;
  pending = new Map<Timer, number>();
  set = ((callback: () => void, delay = 0) => new Timer(this, callback, delay)) as unknown as typeof setTimeout;
  clear = ((timer: Timer | undefined) => {
    timer?.clear();
  }) as unknown as typeof clearTimeout;
  async advance(milliseconds: number) {
    const until = this.now + milliseconds;
    for (;;) {
      const first = [...this.pending.entries()].sort((left, right) => left[1] - right[1])[0];
      if (!first || first[1] > until) break;
      const [timer, at] = first;
      this.now = at;
      this.pending.delete(timer);
      timer.callback();
      await flush();
    }
    this.now = until;
    await flush();
  }
}
class Timer {
  referenced = true;
  cleared = false;
  constructor(
    readonly clock: Clock,
    readonly callback: () => void,
    readonly delay: number,
  ) {
    this.refresh();
  }
  refresh() {
    if (!this.cleared) this.clock.pending.set(this, this.clock.now + this.delay);
    return this;
  }
  unref() {
    this.referenced = false;
    return this;
  }
  ref() {
    this.referenced = true;
    return this;
  }
  hasRef() {
    return this.referenced;
  }
  clear() {
    this.cleared = true;
    this.clock.pending.delete(this);
  }
}
const nativeSetTimeout = globalThis.setTimeout,
  nativeClearTimeout = globalThis.clearTimeout;
const clock = new Clock();
let cases = 0;
const clean = () => assert.equal(clock.pending.size, 0, "finished scopes release their timer");
const reject = (probe: ReturnType<typeof observe>, name: string) => {
  assert.equal(probe.state, "rejected");
  assert(probe.error instanceof Error);
  assert.equal(probe.error.name, name);
};
function controlled(timeout = 100, parent?: AbortSignal) {
  const finish = deferred<string>();
  const scope: { signal?: AbortSignal; activity?: () => void } = {};
  const result = observe(
    withLlmInactivityTimeout(
      timeout,
      async (signal) => {
        scope.signal = signal;
        scope.activity = AsyncResource.bind(() => markLlmRequestActivity());
        return finish.promise;
      },
      parent,
    ),
  );
  return { finish, scope, result };
}

try {
  globalThis.setTimeout = clock.set;
  globalThis.clearTimeout = clock.clear;
  try {
    {
      const call = controlled();
      await flush();
      assert.equal([...clock.pending.keys()][0]?.hasRef(), false);
      await clock.advance(99);
      assert.equal(call.result.state, "pending");
      await clock.advance(1);
      reject(call.result, "TimeoutError");
      assert.equal(call.scope.signal?.aborted, true);
      clean();
      cases++;
    }
    {
      const call = controlled();
      await flush();
      for (let index = 0; index < 5; index++) {
        await clock.advance(70);
        call.scope.activity!();
        assert.equal(call.result.state, "pending", "real activity may exceed the total budget");
      }
      call.finish.resolve("complete");
      await flush();
      assert.equal(call.result.value, "complete");
      assert.equal(getEventListeners(call.scope.signal!, "abort").length, 0);
      call.scope.activity!();
      await clock.advance(500);
      clean();
      cases++;
    }
    {
      const call = controlled();
      await flush();
      await clock.advance(70);
      call.scope.activity!();
      await clock.advance(99);
      assert.equal(call.result.state, "pending");
      await clock.advance(1);
      reject(call.result, "TimeoutError");
      clean();
      cases++;
    }
    {
      const parent = new AbortController(),
        reason = new DOMException("fixture user cancellation", "AbortError");
      const call = controlled(100, parent.signal);
      await flush();
      parent.abort(reason);
      await flush();
      reject(call.result, "AbortError");
      assert.equal(call.result.error, reason);
      assert.equal(call.scope.signal?.reason, reason);
      assert.equal(getEventListeners(call.scope.signal!, "abort").length, 0);
      assert.equal(getEventListeners(parent.signal, "abort").length, 0);
      clean();
      cases++;
    }
    {
      const parent = new AbortController();
      parent.abort(new DOMException("already cancelled", "AbortError"));
      let called = false;
      const result = observe(
        withLlmInactivityTimeout(
          100,
          async () => {
            called = true;
            return "unexpected";
          },
          parent.signal,
        ),
      );
      await flush();
      reject(result, "AbortError");
      assert.equal(called, false);
      clean();
      cases++;
    }
    {
      const parent = new AbortController();
      const reason = new DOMException("cancelled before deferred dispatch", "AbortError");
      let started = false;
      const pending = withLlmInactivityTimeout(
        100,
        async () => {
          started = true;
          return "unexpected";
        },
        parent.signal,
      );
      parent.abort(reason);
      const result = observe(pending);
      await flush();
      reject(result, "AbortError");
      assert.equal(result.error, reason, "immediate cancellation preserves the caller's exact reason");
      assert.equal(started, false, "cancellation before the operation microtask cannot start a provider");
      assert.equal(getEventListeners(parent.signal, "abort").length, 0);
      clean();
      cases++;
    }
    {
      let returnedPartial = false;
      const result = observe(
        withLlmInactivityTimeout(
          100,
          (signal) =>
            new Promise<string>((resolve) => {
              signal.addEventListener(
                "abort",
                () => {
                  returnedPartial = true;
                  resolve('{"partial":');
                },
                { once: true },
              );
            }),
        ),
      );
      await flush();
      await clock.advance(100);
      assert.equal(returnedPartial, true);
      reject(result, "TimeoutError");
      clean();
      cases++;
    }
    {
      const call = controlled();
      await flush();
      await clock.advance(100);
      reject(call.result, "TimeoutError");
      call.finish.resolve("late ignored-abort completion");
      await flush();
      reject(call.result, "TimeoutError");
      clean();
      cases++;
    }
    {
      const error = new Error("fixture provider failure");
      let signal: AbortSignal | undefined;
      const result = observe(
        withLlmInactivityTimeout(100, async (value) => {
          signal = value;
          throw error;
        }),
      );
      await flush();
      assert.equal(result.error, error);
      assert.equal(getEventListeners(signal!, "abort").length, 0);
      clean();
      cases++;
    }
    {
      const active = controlled(),
        quiet = controlled();
      await flush();
      await clock.advance(80);
      active.scope.activity!();
      await clock.advance(30);
      reject(quiet.result, "TimeoutError");
      assert.equal(active.result.state, "pending");
      quiet.scope.activity!();
      await clock.advance(69);
      assert.equal(active.result.state, "pending");
      await clock.advance(1);
      reject(active.result, "TimeoutError");
      clean();
      cases++;
    }
    {
      let child: ReturnType<typeof controlled> | undefined;
      const outerDone = deferred<string>();
      const outer = observe(
        withLlmInactivityTimeout(100, async () => {
          child = controlled(1000);
          return outerDone.promise;
        }),
      );
      await flush();
      await clock.advance(80);
      child!.scope.activity!();
      await clock.advance(80);
      assert.equal(outer.state, "pending", "nested provider progress reaches its waiting ancestor");
      outerDone.resolve("outer");
      child!.finish.resolve("inner");
      await flush();
      assert.equal(outer.value, "outer");
      clean();
      cases++;
    }
    {
      let child: ReturnType<typeof controlled> | undefined, outerActivity: (() => void) | undefined;
      const outerDone = deferred<string>();
      const outer = observe(
        withLlmInactivityTimeout(200, async () => {
          outerActivity = AsyncResource.bind(() => markLlmRequestActivity());
          child = controlled(60);
          return outerDone.promise;
        }),
      );
      await flush();
      await clock.advance(40);
      outerActivity!();
      await clock.advance(21);
      reject(child!.result, "TimeoutError");
      assert.equal(outer.state, "pending", "parent-only activity does not extend a silent child");
      child!.scope.activity!();
      await clock.advance(179);
      reject(outer, "TimeoutError");
      outerDone.resolve("late outer completion");
      await flush();
      clean();
      cases++;
    }
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
  }

  // The real facade must request SSE, consume thinking/keepalive data without displaying tokens,
  // and return a completed structured response after more than AGENT_CALL_TIMEOUT_MS in total.
  const requests: Record<string, unknown>[] = [];
  const cancellationReady = deferred<void>(),
    cancellationClosed = deferred<void>();
  let silentClosed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const event = (response: ServerResponse, type: string, data: Record<string, unknown>) =>
    response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw) as Record<string, unknown>;
    requests.push(body);
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.flushHeaders();
    const ownTimers = new Set<ReturnType<typeof setTimeout>>();
    const after = (milliseconds: number, callback: () => void) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        ownTimers.delete(timer);
        callback();
      }, milliseconds);
      timers.add(timer);
      ownTimers.add(timer);
    };
    response.on("close", () => {
      for (const timer of ownTimers) {
        clearTimeout(timer);
        timers.delete(timer);
      }
      ownTimers.clear();
    });
    if (raw.includes("silent_fixture")) {
      response.on("close", () => {
        silentClosed = true;
      });
      return;
    }
    if (request.url?.endsWith("/chat/completions")) {
      const send = (delta: Record<string, unknown>, finishReason: string | null = null) =>
        response.write(
          `data: ${JSON.stringify({ id: "openai-fixture", choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`,
        );
      send({ role: "assistant" });
      after(500, () => send({ reasoning_content: "synthetic reasoning" }));
      after(5500, () => response.write(": OpenAI-compatible keepalive before content\n\n"));
      after(11_000, () => {
        for (const content of ['{"chapter":', '2,"title":"Compatible"}']) send({ content });
        send({}, "stop");
        response.write(
          `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 17, total_tokens: 28, prompt_tokens_details: { cached_tokens: 3 } } })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
      });
      return;
    }
    event(response, "message_start", {
      message: {
        id: "fixture",
        type: "message",
        role: "assistant",
        model: "fixture",
        content: [],
        usage: { input_tokens: 7, output_tokens: 0, cache_read_input_tokens: 2 },
      },
    });
    if (raw.includes("cancel_fixture")) {
      event(response, "content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      event(response, "content_block_delta", { index: 0, delta: { type: "text_delta", text: '{"partial":' } });
      cancellationReady.resolve();
      response.on("close", () => cancellationClosed.resolve());
      return;
    }
    event(response, "content_block_start", { index: 0, content_block: { type: "thinking", thinking: "" } });
    after(500, () =>
      event(response, "content_block_delta", {
        index: 0,
        delta: { type: "thinking_delta", thinking: "synthetic reasoning" },
      }),
    );
    after(5500, () => response.write(": fixture keepalive before any content\n\n"));
    after(11_000, () => {
      event(response, "content_block_stop", { index: 0 });
      event(response, "content_block_start", { index: 1, content_block: { type: "text", text: "" } });
      for (const text of ['{"chapter":', '1,"title":"Synthetic"}'])
        event(response, "content_block_delta", { index: 1, delta: { type: "text_delta", text } });
      event(response, "content_block_stop", { index: 1 });
      event(response, "message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 13 } });
      event(response, "message_stop", {});
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createConnectionsStorage } =
    await import("../../packages/server/src/services/storage/connections.storage.js");
  const { createConnectionSchema } = await import("../../packages/shared/src/index.js");
  const { createCapabilityLanguageModelHost } =
    await import("../../packages/server/src/services/capability-packages/capability-language-model.service.js");
  const db = await createFileNativeDB();
  try {
    const row = await createConnectionsStorage(db).create(
      createConnectionSchema.parse({
        name: "Synthetic idle-timeout fixture",
        provider: "anthropic",
        model: "claude-opus-5-5",
        baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        apiKey: "fixture-only",
      }),
    );
    const model = await createCapabilityLanguageModelHost(db).resolveForRequest({ connectionId: row.id });
    const compatibleRow = await createConnectionsStorage(db).create(
      createConnectionSchema.parse({
        name: "Synthetic compatible stream",
        provider: "openai",
        model: "gpt-4.1-mini",
        baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        apiKey: "fixture-only",
      }),
    );
    const silentRow = await createConnectionsStorage(db).create(
      createConnectionSchema.parse({
        name: "Independent silent stream",
        provider: "openai",
        model: "gpt-4.1-mini",
        baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        apiKey: "fixture-only",
      }),
    );
    const compatible = await createCapabilityLanguageModelHost(db).resolveForRequest({
      connectionId: compatibleRow.id,
    });
    const silent = await createCapabilityLanguageModelHost(db).resolveForRequest({ connectionId: silentRow.id });
    const started = Date.now();
    const quiet = silent.chatComplete([{ role: "user", content: "silent_fixture" }]);
    const quietRejected = assert.rejects(quiet, { name: "TimeoutError" });
    let quietGuard: ReturnType<typeof setTimeout> | undefined;
    let completed, compatibleCompleted;
    try {
      [completed, compatibleCompleted] = await Promise.all([
        model.chatComplete([{ role: "user", content: "Return a synthetic chapter JSON object." }], {
          maxTokens: 18500,
        }),
        compatible.chatComplete([{ role: "user", content: "Return compatible fixture JSON." }]),
        Promise.race([
          quietRejected,
          new Promise<never>((_resolve, reject) => {
            quietGuard = setTimeout(
              () => reject(new Error("other streams kept an unrelated silent request alive")),
              12_000,
            );
          }),
        ]),
      ]);
    } finally {
      clearTimeout(quietGuard);
    }
    assert(Date.now() - started >= 10_000, "the completed request exceeds the configured total duration");
    assert(
      requests.every((body) => body.stream === true),
      "the facade internally streams every connection without an onToken sink",
    );
    assert.deepEqual(JSON.parse(completed.content!), { chapter: 1, title: "Synthetic" });
    assert.equal(completed.usage?.promptTokens, 7);
    assert.equal(completed.usage?.completionTokens, 13);
    assert.equal(completed.usage?.totalTokens, 20);
    assert.equal(completed.usage?.cachedPromptTokens, 2);
    assert.deepEqual(JSON.parse(compatibleCompleted.content!), { chapter: 2, title: "Compatible" });
    assert.equal(compatibleCompleted.usage?.promptTokens, 11);
    assert.equal(compatibleCompleted.usage?.completionTokens, 17);
    assert.equal(compatibleCompleted.usage?.totalTokens, 28);
    assert.equal(compatibleCompleted.usage?.cachedPromptTokens, 3);
    assert.equal(
      silentClosed,
      true,
      "an independently silent facade request aborts its actual socket while siblings progress",
    );
    const abort = new AbortController(),
      reason = new DOMException("fixture user stop", "AbortError");
    const cancelled = model.chatComplete([{ role: "user", content: "cancel_fixture" }], { signal: abort.signal });
    const rejected = assert.rejects(cancelled, (error) => error === reason);
    await cancellationReady.promise;
    abort.abort(reason);
    await rejected;
    let guard: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        cancellationClosed.promise,
        new Promise<never>((_resolve, reject) => {
          guard = setTimeout(() => reject(new Error("cancelled provider socket stayed open")), 2000);
        }),
      ]);
    } finally {
      clearTimeout(guard);
    }
    assert.equal(requests.at(-1)?.stream, true);
    cases += 3;
  } finally {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db._fileStore.close();
  }
  console.info(
    `${cases} LLM inactivity cases passed, including concurrent >10s Anthropic and OpenAI-compatible capability streams.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
