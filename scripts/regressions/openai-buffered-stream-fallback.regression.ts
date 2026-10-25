import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTaskProgress } from "../../packages/shared/src/types/agent.js";

const directory = await mkdtemp(join(tmpdir(), "marinara-buffered-stream-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { completeAgentCall } = await import("../../packages/server/src/services/agents/agent-progress.js");
const { createCapabilityLanguageModelHost } =
  await import("../../packages/server/src/services/capability-packages/capability-language-model.service.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema } = await import("../../packages/shared/dist/index.js");
const { LLMHttpError } = await import("../../packages/server/src/services/llm/base-provider.js");

const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as Record<string, unknown>;
  calls.push({ path: request.url!, body });
  const model = String(body.model);
  const reject = (status: number, message: string, plain = false) => {
    response.writeHead(status, { "content-type": plain ? "text/plain" : "application/json" });
    response.end(plain ? message : JSON.stringify({ error: { message } }));
  };
  if (model.startsWith("negative-")) {
    const status = Number(model.split("-")[1]);
    reject(
      status,
      model.endsWith("ambiguous")
        ? "Invalid stream_options buffer size"
        : model.endsWith("generic")
          ? "Invalid context length"
          : "Streaming is not supported",
    );
    return;
  }
  if (model === "always-reject") {
    reject(400, "Streaming is not supported");
    return;
  }
  if (model === "stalled") {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.flushHeaders();
    return;
  }
  if (model === "parse-failure") {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end('data: {"error":{"message":"Streaming is not supported"}}\n\n');
    return;
  }
  if (body.stream && (model.startsWith("buffered-") || model.startsWith("gpt-5."))) {
    reject(
      model === "buffered-422" ? 422 : 400,
      model === "buffered-422" ? "Streaming requests are not supported by this endpoint" : "Please set stream=false",
      model === "buffered-422",
    );
    return;
  }
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    const reasoning = model === "partial-reasoning";
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: reasoning ? { reasoning_content: "Thinking" } : { content: "Answer" } }] })}\n\n`,
    );
    if (model.startsWith("partial-")) {
      response.end('data: {"error":{"message":"Streaming is not supported"}}\n\n');
    } else {
      response.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    }
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  if (request.url?.endsWith("/responses")) {
    response.end(
      JSON.stringify({
        id: "response-fixture",
        status: "completed",
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Answer" }] }],
      }),
    );
  } else {
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Answer",
              ...(model === "buffered-reasoning" ? { reasoning_content: "Thinking" } : {}),
            },
            finish_reason: "stop",
          },
        ],
      }),
    );
  }
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const host = createCapabilityLanguageModelHost(db);
const messages = [{ role: "user" as const, content: "Fixture" }];
const agents: AgentTaskProgress["agents"] = [
  { id: "fixture", type: "world-state", name: "Fixture", phase: "post_processing" },
];
const custom = () => new OpenAIProvider(baseUrl, "fixture-only", undefined, undefined, undefined, "custom");
const since = (index: number) => calls.slice(index).map((call) => call.body.stream === true);

try {
  // Every compatible provider kind shares this boundary; no provider allowlist controls the retry.
  for (const kind of [
    "openai",
    "openrouter",
    "nanogpt",
    "xai",
    "mistral",
    "arli",
    "zai",
    "deepseek",
    "custom",
    "cohere",
  ] as const) {
    const provider = new OpenAIProvider(baseUrl, "fixture-only", undefined, undefined, undefined, kind);
    const before = calls.length;
    const result = await provider.chatComplete(messages, { model: "buffered-400", stream: true, maxTokens: 100 });
    assert.equal(result.content, "Answer");
    assert.deepEqual(since(before), [true, false], `${kind} retries only the rejected streaming request`);
    assert.equal(calls.at(-1)!.body.model, "buffered-400", "retry preserves the selected model");
  }
  {
    const before = calls.length;
    assert.equal((await custom().chatComplete(messages, { model: "buffered-422", stream: true })).content, "Answer");
    assert.deepEqual(since(before), [true, false], "plain upstream 422 rejection permits one buffered retry");
  }
  {
    const before = calls.length;
    const provider = new OpenAIProvider(baseUrl, "fixture-only");
    assert.equal((await provider.chatComplete(messages, { model: "gpt-5.6-sol", stream: true })).content, "Answer");
    assert.deepEqual(since(before), [true, false], "the Responses API shares the same bounded compatibility retry");
    assert.ok(calls.slice(before).every((call) => call.path.endsWith("/responses")));
  }
  {
    const before = calls.length;
    const text: string[] = [];
    const reasoning: string[] = [];
    let observe!: () => void;
    const observed = new Promise<void>((resolve) => {
      observe = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let returned = false;
    const pending = custom()
      .chatComplete(messages, {
        model: "buffered-reasoning",
        stream: true,
        onThinking: (chunk) => {
          reasoning.push(chunk);
        },
        onToken: async (chunk) => {
          text.push(chunk);
          observe();
          await released;
        },
      })
      .then((result) => {
        returned = true;
        return result;
      });
    await Promise.race([observed, pending.then(() => assert.fail("completion returned before its text callback"))]);
    assert.equal(returned, false, "completion must await its existing text callback");
    release();
    assert.equal((await pending).content, "Answer");
    assert.deepEqual(text, ["Answer"], "buffered fallback delivers final text once to a streaming caller");
    assert.deepEqual(reasoning, ["Thinking"], "buffered fallback preserves reasoning delivery without duplication");
    assert.deepEqual(since(before), [true, false]);
  }
  {
    const before = calls.length;
    const failure = new LLMHttpError("Streaming is not supported", { status: 400 });
    let callbacks = 0;
    await assert.rejects(
      custom().chatComplete(messages, {
        model: "buffered-400",
        stream: true,
        onToken: () => {
          callbacks++;
          throw failure;
        },
      }),
      (error) => error === failure,
    );
    assert.equal(callbacks, 1);
    assert.deepEqual(since(before), [true, false], "a buffered text callback failure cannot replay a generation");
  }
  {
    const before = calls.length;
    const controller = new AbortController();
    const reason = new Error("User stopped during buffered fallback text callback");
    let callbacks = 0;
    await assert.rejects(
      custom().chatComplete(messages, {
        model: "buffered-400",
        stream: true,
        signal: controller.signal,
        onToken: async (chunk) => {
          assert.equal(chunk, "Answer");
          callbacks++;
          await Promise.resolve();
          controller.abort(reason);
        },
      }),
      (error) => error === reason,
    );
    assert.equal(callbacks, 1);
    assert.deepEqual(since(before), [true, false], "cancellation during buffered delivery cannot replay a generation");
  }
  {
    const before = calls.length;
    const controller = new AbortController();
    const reason = new Error("User stopped before buffered text delivery");
    let reasoning = 0;
    await assert.rejects(
      custom().chatComplete(messages, {
        model: "buffered-reasoning",
        stream: true,
        signal: controller.signal,
        onThinking: () => {
          reasoning++;
          controller.abort(reason);
        },
        onToken: () => assert.fail("cancelled fallback must not emit final text"),
      }),
      (error) => error === reason,
    );
    assert.equal(reasoning, 1);
    assert.deepEqual(
      since(before),
      [true, false],
      "cancellation before buffered delivery must not replay a generation",
    );
  }
  {
    const before = calls.length;
    const result = await completeAgentCall({}, agents, custom(), messages, {
      model: "buffered-400",
      stream: false,
      onToken: () => assert.fail("quiet agent must not expose transport text"),
      onThinking: () => assert.fail("quiet agent must not expose transport reasoning"),
    });
    assert.equal(result.content, "Answer");
    assert.deepEqual(since(before), [true, false]);
  }
  {
    const saved = await connections.create(
      createConnectionSchema.parse({
        name: "Buffered fixture",
        provider: "custom",
        model: "buffered-400",
        baseUrl,
        apiKey: "fixture-only",
      }),
    );
    assert.ok(saved);
    const model = await host.resolveForRequest({ connectionId: saved.id });
    const before = calls.length;
    assert.equal((await model.chatComplete(messages, { maxTokens: 100 })).content, "Answer");
    assert.deepEqual(since(before), [true, false], "downloadable agent receives only the final buffered response");
  }
  {
    const before = calls.length;
    const text: string[] = [];
    const result = await custom().chatComplete(messages, {
      model: "stream-supported",
      stream: true,
      onToken: (chunk) => {
        text.push(chunk);
      },
    });
    assert.equal(result.content, "Answer");
    assert.deepEqual(text, ["Answer"], "supported streaming keeps its original callback behavior");
    assert.deepEqual(since(before), [true], "supported SSE buys only one generation");
  }
  for (const model of ["gpt-5.5-pro", "gpt-5.6-sol-pro"]) {
    const provider = new OpenAIProvider(baseUrl, "fixture-only");
    const before = calls.length;
    assert.equal((await completeAgentCall({}, agents, provider, messages, { model, stream: false })).content, "Answer");
    assert.deepEqual(since(before), [false], "known Pro normalization stays buffered before the first request");
    const saved = await connections.create(
      createConnectionSchema.parse({ name: model, provider: "openai", model, baseUrl, apiKey: "fixture-only" }),
    );
    assert.ok(saved);
    const capability = await host.resolveForRequest({ connectionId: saved.id });
    const beforeCapability = calls.length;
    assert.equal((await capability.chatComplete(messages)).content, "Answer");
    assert.deepEqual(since(beforeCapability), [false]);
  }
  {
    const before = calls.length;
    const provider = new OpenAIProvider(baseUrl, "fixture-only", undefined, undefined, undefined, "openai-chatgpt");
    await assert.rejects(provider.chatComplete(messages, { model: "buffered-400", stream: true }));
    assert.deepEqual(since(before), [true], "the ChatGPT adapter requires SSE and cannot retry as buffered JSON");
  }

  for (const model of [
    "negative-400-ambiguous",
    "negative-422-ambiguous",
    "negative-400-generic",
    "negative-422-generic",
    "negative-401",
    "negative-429",
    "negative-500",
    "parse-failure",
  ]) {
    const before = calls.length;
    await assert.rejects(custom().chatComplete(messages, { model, stream: true }));
    assert.deepEqual(since(before), [true], `${model} must not buy another generation`);
  }
  {
    const before = calls.length;
    await assert.rejects(custom().chatComplete(messages, { model: "always-reject", stream: true }));
    assert.deepEqual(since(before), [true, false], "a rejected buffered retry must not loop");
  }
  for (const model of ["partial-text", "partial-reasoning"]) {
    const before = calls.length;
    const text: string[] = [];
    const reasoning: string[] = [];
    await assert.rejects(
      custom().chatComplete(messages, {
        model,
        stream: true,
        onToken: (chunk) => {
          text.push(chunk);
        },
        onThinking: (chunk) => {
          reasoning.push(chunk);
        },
      }),
    );
    assert.deepEqual(since(before), [true], "a stream failure after output must not replay a generation");
    assert.equal(text.length + reasoning.length, 1);
  }
  {
    const before = calls.length;
    const signal = AbortSignal.timeout(50);
    await assert.rejects(
      completeAgentCall({}, agents, custom(), messages, { model: "stalled", stream: false, signal }),
    );
    assert.deepEqual(since(before), [true], "timeout must not authorize a buffered retry");
  }
  {
    const provider = custom();
    const controller = new AbortController();
    const reason = new Error("User stopped between rejection and retry");
    // Abort at the exact boundary after a real HTTP rejection has been classified, before its caller retries.
    const boundary = provider as unknown as { completionHttpError: (...args: unknown[]) => Error };
    const classify = boundary.completionHttpError.bind(provider);
    boundary.completionHttpError = (...args) => {
      const error = classify(...args);
      controller.abort(reason);
      return error;
    };
    const before = calls.length;
    await assert.rejects(
      provider.chatComplete(messages, { model: "buffered-400", stream: true, signal: controller.signal }),
      (error) => error === reason,
    );
    assert.deepEqual(
      since(before),
      [true],
      "user cancellation before retry must preserve its reason and request count",
    );
  }
  {
    const before = calls.length;
    const visible = new LLMHttpError("Streaming is not supported", { status: 400 });
    await assert.rejects(
      custom().chatComplete(messages, {
        model: "stream-supported",
        stream: true,
        onToken: () => {
          throw visible;
        },
      }),
      (error) => error === visible,
    );
    assert.deepEqual(since(before), [true], "a caller-thrown HTTP-shaped error is not an upstream rejection");
  }
  console.info(
    "Buffered streaming fallback: agent/capability compatibility, supported SSE, Pro, strict failures, partial output and cancellation passed.",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db._fileStore.close();
  await rm(directory, { recursive: true, force: true });
}
