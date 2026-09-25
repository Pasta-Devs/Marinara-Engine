import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { AnthropicProvider } from "../../packages/server/src/services/llm/providers/anthropic.provider.js";
import { GoogleProvider } from "../../packages/server/src/services/llm/providers/google.provider.js";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import { getRequestContextTokens } from "../../packages/server/src/services/generation/generation-text-utils.js";
import type {
  BaseLLMProvider,
  ChatMessage,
  ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";

const requests: Array<Record<string, any>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push(body);
  const google = request.url?.includes("generateContent") || request.url?.includes("streamGenerateContent");
  const anthropic = request.url?.startsWith("/anthropic/");
  const payload = google
    ? {
        candidates: [{ content: { parts: [{ text: "Done" }] }, finishReason: "STOP" }],
        usageMetadata: {
          promptTokenCount: 100,
          cachedContentTokenCount: 60,
          candidatesTokenCount: 10,
          thoughtsTokenCount: 5,
          totalTokenCount: 115,
        },
      }
    : anthropic
      ? {
          content: [{ type: "text", text: "Done" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 60, cache_creation_input_tokens: 5 },
        }
      : {
          choices: [{ message: { content: "Done" }, finish_reason: "stop" }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 10,
            total_tokens: 110,
            prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 5 },
          },
        };
  if (request.url?.includes("streamGenerateContent")) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(`data: ${JSON.stringify(payload)}\n\n`);
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const tool = {
  type: "function" as const,
  function: { name: "probe", description: "Probe", parameters: { type: "object", properties: {} } },
};
async function chatUsage(provider: BaseLLMProvider, messages: ChatMessage[], options: ChatOptions) {
  const stream = provider.chat(messages, options);
  let next = await stream.next();
  while (!next.done) next = await stream.next();
  return next.value;
}

try {
  await test("OpenRouter caching follows provider identity through proxy hosts", async () => {
    for (const kind of ["openrouter", "custom", "openai"] as const) {
      const provider = new OpenAIProvider(`${baseUrl}/proxy/v1`, "test", undefined, undefined, undefined, kind);
      for (const enableCaching of [true, false]) {
        const result = await provider.chatComplete([{ role: "user", content: "Hello" }], {
          model: "anthropic/claude-opus-5",
          stream: false,
          enableCaching,
        });
        assert.equal(getRequestContextTokens(result.usage, kind), 110, "compatible prompt counts include cached input");
        assert.deepEqual(
          requests.at(-1)?.cache_control,
          kind === "openrouter" && enableCaching ? { type: "ephemeral" } : undefined,
        );
      }
    }
  });

  await test("Gemini cache usage is retained across direct/Vertex, chat/tools and buffered/streaming paths", async () => {
    for (const kind of ["google", "google_vertex"] as const) {
      const provider = new GoogleProvider(`${baseUrl}/google`, "test", undefined, undefined, undefined, kind);
      for (const stream of [false, true]) {
        const options = { model: "gemini-2.5-flash", stream, onToken: () => {} };
        const plain = await chatUsage(provider, [{ role: "user", content: "Hello" }], options);
        const completed = await provider.chatComplete([{ role: "user", content: "Hello" }], {
          ...options,
          tools: [tool],
        });
        for (const usage of [plain, completed.usage]) {
          assert.equal(usage?.cachedPromptTokens, 60);
          assert.equal(usage?.promptTokens, 100, "cached tokens remain part of the full prompt count");
          assert.equal(usage?.totalTokens, 115);
          assert.equal(usage?.completionReasoningTokens, 5);
          assert.equal(
            getRequestContextTokens(usage || undefined, kind),
            115,
            "Gemini total includes cache and reasoning once",
          );
        }
      }
    }
  });

  await test("Anthropic keeps depth instructions at their history position on both request paths", async () => {
    const provider = new AnthropicProvider(`${baseUrl}/anthropic`, "test");
    for (const model of ["claude-opus-5", "claude-sonnet-4-20250514"]) {
      for (const tools of [undefined, [tool]]) {
        for (const validSlot of [true, false]) {
          const history: ChatMessage[] = [
            { role: "system", content: "Stable system" },
            { role: "user", content: "Earlier user" },
            ...(validSlot ? [] : [{ role: "assistant" as const, content: "Earlier assistant" }]),
            { role: "system", content: "Depth instruction & literal <leaf>" },
            { role: "assistant", content: "Later assistant" },
            { role: "user", content: "Latest user" },
          ];
          const before = JSON.stringify(history);
          const result = await provider.chatComplete(history, { model, stream: false, enableCaching: true, tools });
          assert.equal(
            getRequestContextTokens(result.usage, "anthropic"),
            175,
            "native Claude adds separately reported cache input",
          );
          const body = requests.at(-1)!;
          assert.equal(JSON.stringify(history), before, "provider serialization leaves caller messages unchanged");
          assert.equal(JSON.stringify(body.system).includes("Depth instruction"), false);
          assert.ok(JSON.stringify(body.system).includes("Stable system"));
          const text = JSON.stringify(body.messages);
          assert.ok(text.indexOf("Earlier user") < text.indexOf("Depth instruction"));
          assert.ok(text.indexOf("Depth instruction") < text.indexOf("Later assistant"));
          assert.ok(text.includes("Depth instruction & literal <leaf>"));
          const depth = body.messages.find((message: any) =>
            JSON.stringify(message.content).includes("Depth instruction"),
          );
          assert.equal(depth.role, validSlot && model === "claude-opus-5" ? "system" : "user");
        }
      }
    }
  });
  await test("Anthropic retains empty tool results paired with their tool calls", async () => {
    const provider = new AnthropicProvider(`${baseUrl}/anthropic`, "test");
    for (const content of ["", " \n "]) {
      await provider.chatComplete(
        [
          { role: "user", content: "Run the probe." },
          {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "probe-1", type: "function", function: { name: "probe", arguments: "{}" } }],
          },
          { role: "tool", tool_call_id: "probe-1", content },
        ],
        { model: "claude-opus-5", stream: false, tools: [tool] },
      );
      const messages = requests.at(-1)!.messages;
      assert.equal(messages[1].content[0].type, "tool_use");
      assert.equal(messages[1].content[0].id, "probe-1");
      assert.equal(messages[2]?.role, "user", "An empty tool result must still follow its assistant tool call");
      assert.deepEqual(messages[2].content, [{ type: "tool_result", tool_use_id: "probe-1", content: content || " " }]);
    }
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
