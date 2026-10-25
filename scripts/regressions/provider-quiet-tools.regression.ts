import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "marinara-quiet-tools-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const { AnthropicProvider } = await import("../../packages/server/src/services/llm/providers/anthropic.provider.js");
const { GoogleProvider } = await import("../../packages/server/src/services/llm/providers/google.provider.js");

const requests: boolean[] = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as Record<string, unknown>;
  const anthropic = request.url?.startsWith("/anthropic/");
  const stream = anthropic ? body.stream === true : request.url?.includes(":streamGenerateContent") === true;
  requests.push(stream);
  response.writeHead(200, { "Content-Type": stream ? "text/event-stream" : "application/json" });
  const send = (data: unknown) => response.write(`data: ${JSON.stringify(data)}\n\n`);
  if (anthropic) {
    if (!stream) {
      response.end(
        JSON.stringify({
          content: [
            { type: "text", text: "quiet fixture" },
            { type: "tool_use", id: "fixture-call", name: "read", input: { value: 1 } },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 9, output_tokens: 4 },
        }),
      );
      return;
    }
    send({ type: "message_start", message: { usage: { input_tokens: 9, output_tokens: 0 } } });
    send({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    send({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "quiet fixture" } });
    send({ type: "content_block_stop", index: 0 });
    send({
      type: "content_block_start",
      index: 1,
      content_block: { type: "tool_use", id: "fixture-call", name: "read" },
    });
    send({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"value":' } });
    send({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "1}" } });
    send({ type: "content_block_stop", index: 1 });
    send({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 4 } });
    send({ type: "message_stop" });
  } else {
    const data = {
      candidates: [
        {
          content: { parts: [{ text: "quiet fixture" }, { functionCall: { name: "read", args: { value: 1 } } }] },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4, totalTokenCount: 13 },
    };
    if (stream) send(data);
    else response.write(JSON.stringify(data));
  }
  response.end();
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const tools = [{ type: "function" as const, function: { name: "read", description: "", parameters: {} } }];
  for (const [provider, model] of [
    [new AnthropicProvider(`${base}/anthropic/v1`, "fixture"), "claude-sonnet-4-20250514"],
    [new GoogleProvider(`${base}/google/v1beta`, "fixture"), "gemini-2.5-flash"],
  ] as const) {
    for (const mode of ["quiet-stream", "explicit-buffer", "implicit-stream", "implicit-buffer"] as const) {
      let displayed = "";
      const result = await provider.chatComplete([{ role: "user", content: "Return text and call read." }], {
        model,
        tools,
        enabledParameters: { reasoningEffort: false },
        ...(mode === "quiet-stream" ? { stream: true } : mode === "explicit-buffer" ? { stream: false } : {}),
        ...(mode === "explicit-buffer" || mode === "implicit-stream"
          ? {
              onToken: (chunk: string) => {
                displayed += chunk;
              },
            }
          : {}),
      });
      assert.equal(
        requests.at(-1),
        mode === "quiet-stream" || mode === "implicit-stream",
        `${model}/${mode}: explicit streaming works without a token sink; false and implicit defaults are preserved`,
      );
      assert.equal(result.content, "quiet fixture");
      assert.equal(result.toolCalls.length, 1, `${model}/${mode}: the full completion retains its tool call`);
      assert.equal(result.toolCalls[0]?.function.name, "read");
      assert.deepEqual(JSON.parse(result.toolCalls[0]!.function.arguments), { value: 1 });
      assert.equal(result.finishReason, "tool_calls");
      assert.equal(result.usage?.promptTokens, 9);
      assert.equal(result.usage?.completionTokens, 4);
      assert.equal(result.usage?.totalTokens, 13);
      assert.equal(displayed, mode === "explicit-buffer" || mode === "implicit-stream" ? "quiet fixture" : "");
    }
  }
  console.info("8 actual HTTP tool completions preserve quiet streaming, explicit buffering, and implicit defaults.");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
