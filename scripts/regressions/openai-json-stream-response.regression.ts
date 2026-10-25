import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTaskProgress } from "../../packages/shared/src/types/agent.js";

const directory = await mkdtemp(join(tmpdir(), "marinara-json-stream-"));
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

const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as Record<string, unknown>;
  calls.push({ path: request.url!, body });
  response.writeHead(200, { "Content-Type": "application/JSON; charset=utf-8" });
  if (String(body.model).endsWith("malformed")) return response.end('{"choices":');
  if (String(body.model).endsWith("error"))
    return response.end(JSON.stringify({ status: "failed", error: { message: "Streaming is not supported" } }));
  const tool = Array.isArray(body.tools) && body.tools.length > 0;
  const length = String(body.model).endsWith("length");
  if (request.url?.endsWith("/responses")) {
    response.end(
      JSON.stringify({
        id: "response-fixture",
        status: length ? "incomplete" : "completed",
        ...(length ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
        output: [
          { type: "reasoning", summary: [{ type: "summary_text", text: "Thinking" }] },
          { type: "message", role: "assistant", content: [{ type: "output_text", text: "Answer" }] },
          ...(tool ? [{ type: "function_call", call_id: "tool-fixture", name: "lookup", arguments: "{}" }] : []),
        ],
        usage: { input_tokens: 3, output_tokens: 5, total_tokens: 8 },
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
              reasoning_content: "Thinking",
              ...(tool
                ? {
                    tool_calls: [
                      { id: "tool-fixture", type: "function", function: { name: "lookup", arguments: "{}" } },
                    ],
                  }
                : {}),
            },
            finish_reason: length ? "length" : tool ? "tool_calls" : "stop",
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
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
const tools = [
  {
    type: "function" as const,
    function: { name: "lookup", description: "Fixture", parameters: { type: "object", properties: {} } },
  },
];
const callbackStops: Record<string, boolean> = {};

try {
  for (const kind of ["custom", "openai"] as const) {
    const model = kind === "openai" ? "gpt-6-astra" : "fixture";
    const provider = new OpenAIProvider(
      baseUrl,
      "fixture-only",
      undefined,
      undefined,
      undefined,
      kind,
      undefined,
      true,
    );
    const baseline = await provider.chatComplete(messages, { model, stream: false, tools });
    const before = calls.length;
    const text: string[] = [];
    const reasoning: string[] = [];
    let textDelivered = false;
    const result = await provider.chatComplete(messages, {
      model,
      stream: true,
      tools,
      onThinking: (chunk) => {
        reasoning.push(chunk);
      },
      onToken: async (chunk) => {
        await Promise.resolve();
        text.push(chunk);
        textDelivered = true;
      },
    });
    assert.deepEqual(result, baseline, "actual JSON preserves buffered content, reasoning metadata, usage and tools");
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.finishReason, "tool_calls");
    assert.equal(textDelivered, true, "completion awaits the existing callback");
    assert.deepEqual(text, ["Answer"]);
    assert.deepEqual(reasoning, ["Thinking"]);
    assert.equal(calls.length - before, 1, "an endpoint ignoring stream:true must never buy a second generation");
    assert.equal(calls.at(-1)!.body.stream, true);

    const quietBefore = calls.length;
    const quiet = await completeAgentCall({}, agents, provider, messages, {
      model,
      stream: false,
      onToken: () => assert.fail("quiet agent must not emit text"),
      onThinking: () => assert.fail("quiet agent must not emit reasoning"),
    });
    assert.equal(quiet.content, "Answer");
    assert.equal(calls.length - quietBefore, 1);

    const saved = await connections.create(
      createConnectionSchema.parse({ name: kind, provider: kind, model, baseUrl, apiKey: "fixture-only" }),
    );
    assert.ok(saved);
    const capability = await host.resolveForRequest({ connectionId: saved.id });
    const capabilityBefore = calls.length;
    assert.equal((await capability.chatComplete(messages)).content, "Answer");
    assert.equal(calls.length - capabilityBefore, 1, "downloadable agents accept actual JSON on either API");

    const buffered = await provider.chatComplete(messages, {
      model,
      stream: false,
      onToken: () => assert.fail("explicitly buffered calls retain their previous callback behavior"),
    });
    assert.equal(buffered.content, "Answer");
    assert.equal(
      (await provider.chatComplete(messages, { model: `${model}-length`, stream: true, tools })).finishReason,
      "length",
    );

    for (const suffix of ["malformed", "error"]) {
      const failureBefore = calls.length;
      await assert.rejects(provider.chatComplete(messages, { model: `${model}-${suffix}`, stream: true }));
      assert.equal(calls.length - failureBefore, 1, "JSON parse/API errors cannot replay a generation");
    }
    {
      const controller = new AbortController();
      const reason = new Error("User stopped after JSON arrived");
      const originalText = Response.prototype.text;
      const descriptor = Object.getOwnPropertyDescriptor(Response.prototype, "text");
      assert.ok(descriptor);
      Object.defineProperty(Response.prototype, "text", {
        ...descriptor,
        value: async function (this: Response) {
          const body = await originalText.call(this);
          controller.abort(reason);
          return body;
        },
      });
      const before = calls.length;
      try {
        await assert.rejects(
          provider.chatComplete(messages, {
            model,
            stream: true,
            signal: controller.signal,
            onThinking: () => assert.fail("cancelled JSON must not emit reasoning"),
            onToken: () => assert.fail("cancelled JSON must not emit text"),
          }),
          (error) => error === reason,
        );
      } finally {
        Object.defineProperty(Response.prototype, "text", descriptor);
      }
      assert.equal(calls.length - before, 1, "cancellation after JSON arrives cannot replay a generation");
    }
    const controller = new AbortController();
    const reason = new Error("User stopped before JSON text delivery");
    const cancelBefore = calls.length;
    await assert.rejects(
      provider.chatComplete(messages, {
        model,
        stream: true,
        signal: controller.signal,
        onThinking: () => controller.abort(reason),
        onToken: () => assert.fail("cancellation during reasoning prevents final text delivery"),
      }),
      (error) => error === reason,
    );
    assert.equal(calls.length - cancelBefore, 1);

    const callbackController = new AbortController();
    const callbackReason = new Error("User stopped during JSON text callback");
    const callbackBefore = calls.length;
    let callbackCount = 0;
    let callbackError: unknown;
    await provider
      .chatComplete(messages, {
        model,
        stream: true,
        signal: callbackController.signal,
        onToken: async (chunk) => {
          assert.equal(chunk, "Answer");
          callbackCount++;
          await Promise.resolve();
          callbackController.abort(callbackReason);
        },
      })
      .catch((error: unknown) => {
        callbackError = error;
      });
    callbackStops[kind] = callbackError === callbackReason;
    assert.equal(callbackCount, 1);
    assert.equal(calls.length - callbackBefore, 1, "cancellation during a JSON callback cannot replay a generation");
  }
  assert.deepEqual(
    callbackStops,
    { custom: true, openai: true },
    "JSON callback cancellation preserves the caller reason on both APIs",
  );
  console.info(
    "Actual JSON after stream:true preserves Chat/Responses results and callbacks without replaying requests.",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db._fileStore.close();
  await rm(directory, { recursive: true, force: true });
}
