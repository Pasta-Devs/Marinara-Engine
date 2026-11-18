import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AnthropicProvider } from "../../../packages/server/src/services/llm/providers/anthropic.provider.js";
import { runNamedCases } from "../fixtures/named-cases.js";

const ev = (type: string, payload: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
const textStream = [
  ": keep-alive\r\n\r\n",
  ev("message_start", { message: { usage: { input_tokens: 7, output_tokens: 1 } } }).replace(/\n/g, "\r\n"),
  ev("ping", {}),
  ev("content_block_start", { index: 0, content_block: { type: "text" } }),
  ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Hel" } }),
  ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "lo é" } }),
  ev("message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } }),
  ev("message_stop", {}),
];
const toolStream = [
  ev("message_start", { message: { usage: { input_tokens: 5, output_tokens: 1 } } }),
  ev("content_block_start", { index: 0, content_block: { type: "thinking" } }),
  ev("content_block_delta", { index: 0, delta: { type: "thinking_delta", thinking: "Hmm" } }),
  ev("content_block_delta", { index: 0, delta: { type: "signature_delta", signature: "sig" } }),
  ev("content_block_start", { index: 1, content_block: { type: "tool_use", id: "t1", name: "read" } }),
  ev("content_block_delta", { index: 1, delta: { type: "input_json_delta", partial_json: '{"path"' } }),
  ev("content_block_delta", { index: 1, delta: { type: "input_json_delta", partial_json: ':"a.txt"}' } }),
  ev("message_delta", { delta: { stop_reason: "tool_use" }, usage: { output_tokens: 9 } }),
  ev("message_stop", {}),
];
const errorStream = [ev("error", { error: { type: "overloaded_error", message: "Overloaded" } })];

/** Serves chunks as separate writes; splits the first payload mid-line and the "é" mid-character. */
async function withServer(chunks: string[], run: (provider: AnthropicProvider) => Promise<void>, status = 200) {
  const server = createServer((req, res) => {
    req.resume();
    res.writeHead(status, { "content-type": status === 200 ? "text/event-stream" : "application/json" });
    if (status !== 200) return void res.end(JSON.stringify({ error: { message: "bad key" } }));
    const bytes = Buffer.from(chunks.join(""));
    const e = bytes.indexOf(Buffer.from("é"));
    const cut = e < 0 ? 80 : e + 1;
    res.write(bytes.subarray(0, 40));
    res.write(bytes.subarray(40, cut));
    res.end(bytes.subarray(cut));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run(new AnthropicProvider(`http://127.0.0.1:${address.port}/v1`, "key"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const msgs = [{ role: "user" as const, content: "Hi" }];
const tools = [{ type: "function" as const, function: { name: "read", description: "", parameters: {} } }];

await runNamedCases([
  {
    name: "anthropic chat streams text through split chunks, CRLF and keep-alives",
    run: () =>
      withServer(textStream, async (provider) => {
        let got = "";
        const gen = provider.chat(msgs, { model: "claude-sonnet-4-5-20250929", stream: true });
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            assert.equal(r.value?.completionTokens, 4);
            assert.equal(r.value?.finishReason, "end_turn");
            break;
          }
          got += r.value;
        }
        assert.equal(got, "Hello é");
      }),
  },
  {
    name: "anthropic chatComplete with tools collects thinking and tool calls",
    run: () =>
      withServer(toolStream, async (provider) => {
        let thinking = "";
        const r = await provider.chatComplete(msgs, {
          model: "claude-sonnet-4-5-20250929",
          stream: true,
          tools,
          onThinking: (t) => (thinking += t),
        });
        assert.equal(thinking, "Hmm");
        assert.equal(r.toolCalls[0]?.function.name, "read");
        assert.equal(r.toolCalls[0]?.function.arguments, '{"path":"a.txt"}');
        assert.equal(r.usage?.completionTokens, 9);
      }),
  },
  {
    name: "anthropic stream error event throws its message",
    run: () =>
      withServer(errorStream, async (provider) => {
        await assert.rejects(
          provider.chatComplete(msgs, { model: "claude-sonnet-4-5-20250929", tools, stream: true }),
          /Anthropic stream error: overloaded_error: Overloaded/,
        );
      }),
  },
  {
    name: "anthropic HTTP error status surfaces to the caller",
    run: () =>
      withServer(
        [],
        async (provider) => {
          await assert.rejects(
            provider.chatComplete(msgs, { model: "claude-sonnet-4-5-20250929", tools, stream: true }),
            /bad key|400/,
          );
        },
        400,
      ),
  },
]);
