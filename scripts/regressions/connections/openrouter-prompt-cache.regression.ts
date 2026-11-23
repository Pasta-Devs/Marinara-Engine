import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { OpenAIProvider } from "../../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage, ChatOptions } from "../../../packages/server/src/services/llm/base-provider.js";
import { openCodeSessionHook } from "../../../packages/server/src/utils/opencode-session.js";

// What OpenRouter's prompt-caching guide asks of each model family, as the request bodies Marinara sends:
// https://openrouter.ai/docs/guides/best-practices/prompt-caching
const bodies: Array<Record<string, any>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  bodies.push(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [{ message: { content: "Done" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
const openRouter = new OpenAIProvider(base, "test", undefined, null, null, "openrouter");

/** Runs `fn` inside a request for `chatId`, as the server's hook does. */
function inChat<T>(chatId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = { body: chatId ? { chatId } : {}, params: {}, routeOptions: { url: "/api/generate" } };
    (openCodeSessionHook as unknown as (req: unknown, reply: unknown, done: () => void) => void)(request, {}, () => {
      fn().then(resolve, reject);
    });
  });
}

/** The body of one request, sent the buffered way or the streaming way. */
async function send(
  messages: ChatMessage[],
  options: Partial<ChatOptions> & { model: string },
  { provider = openRouter, chatId = undefined as string | undefined, streaming = false } = {},
) {
  bodies.length = 0;
  await inChat(chatId, async () => {
    if (!streaming) return provider.chatComplete(messages, { stream: false, ...options });
    for await (const _ of provider.chat(messages, { stream: true, ...options }));
  });
  assert.equal(bodies.length, 1, "one request was sent");
  return bodies[0]!;
}

const text = (value: string, cache_control?: Record<string, string>) => ({
  type: "text",
  text: value,
  ...(cache_control ? { cache_control } : {}),
});
const marks = (body: Record<string, any>) => JSON.stringify(body.messages).split('"cache_control"').length - 1;
const fiveMinutes = { type: "ephemeral" };
const oneHour = { type: "ephemeral", ttl: "1h" };

const roleplay: ChatMessage[] = [
  { role: "system", content: "Stable rules" },
  { role: "system", content: "Character card" },
  { role: "user", content: "u1" },
  { role: "assistant", content: "a1" },
  { role: "user", content: "", images: ["data:image/png;base64,AAAA"] },
  { role: "assistant", content: "a2" },
  { role: "user", content: "u3" },
];

try {
  await test("Claude: top-level caching plus marks on the system prompt and at the cache depth", async () => {
    for (const streaming of [false, true]) {
      for (const extended of [false, true]) {
        const lifetime = extended ? oneHour : fiveMinutes;
        const body = await send(
          roleplay,
          {
            model: "anthropic/claude-sonnet-4.5",
            enableCaching: true,
            anthropicExtendedCacheTtl: extended,
            cachingAtDepth: 2,
          },
          { streaming },
        );
        assert.deepEqual(body.cache_control, lifetime, "automatic caching covers the newest turn");
        assert.equal(body.messages[0].content, "Stable rules");
        assert.deepEqual(body.messages[1].content, [text("Character card", lifetime)], "the system prompt's end");
        // Two messages back is an image-only turn with no text to mark, so the mark goes one message further back.
        assert.deepEqual(body.messages[3].content, [text("a1", lifetime)], "the history mark at the cache depth");
        assert.equal(marks(body), 2, "with the top-level field, three of Anthropic's four breakpoints");
        assert.equal(body.messages[6].content, "u3");
      }
    }
  });

  await test("Claude: a short chat marks its first message, as the Anthropic provider does", async () => {
    const body = await send(
      [
        { role: "system", content: "Rules" },
        { role: "user", content: "Hello" },
      ],
      { model: "anthropic/claude-opus-5", enableCaching: true },
    );
    assert.deepEqual(body.messages[0].content, [text("Rules", fiveMinutes)]);
    assert.deepEqual(body.messages[1].content, [text("Hello", fiveMinutes)]);
  });

  await test("Gemini: exactly one mark, inside one first system message, and no top-level field", async () => {
    for (const streaming of [false, true]) {
      const body = await send(
        [...roleplay.slice(0, 4), { role: "system", content: "Depth note" }, ...roleplay.slice(4)],
        { model: "google/gemini-3.5-flash", enableCaching: true, anthropicExtendedCacheTtl: true },
        { streaming },
      );
      assert.equal(body.cache_control, undefined, "a second mark makes OpenRouter bill a Gemini prompt twice");
      assert.deepEqual(body.messages[0], {
        role: "system",
        content: [text("Stable rules\n\nCharacter card", fiveMinutes)],
      });
      assert.equal(body.messages[1].content, "u1", "the leading system messages became one");
      assert.equal(marks(body), 1, "Gemini uses only the last mark, so it gets one");
      assert.ok(JSON.stringify(body.messages).includes("Depth note"), "later system text stays in the history");
    }
    // No system prompt, nothing to mark.
    const plain = await send([{ role: "user", content: "Hello" }], {
      model: "google/gemini-3.5-flash",
      enableCaching: true,
    });
    assert.equal(plain.cache_control, undefined);
    assert.equal(plain.messages[0].content, "Hello");
  });

  await test("Qwen: marks on the system prompt and the history, skipping tool rounds, with no top-level field", async () => {
    const body = await send(
      [
        { role: "system", content: "Rules" },
        { role: "user", content: "u1" },
        {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "call-1", type: "function", function: { name: "probe", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "call-1", content: "result" },
        { role: "assistant", content: "a2" },
        { role: "user", content: "u2" },
        { role: "assistant", content: "a3" },
        { role: "user", content: "u3" },
      ],
      { model: "qwen/qwen3-max", enableCaching: true, anthropicExtendedCacheTtl: true },
    );
    assert.equal(body.cache_control, undefined, "Alibaba caches only marked blocks");
    assert.deepEqual(body.messages[0].content, [text("Rules", fiveMinutes)], "5 minutes: Alibaba has no 1-hour cache");
    // Five back from the newest is the tool-call turn; the mark goes to the user text before it.
    assert.deepEqual(body.messages[1].content, [text("u1", fiveMinutes)]);
    assert.equal(marks(body), 2);
  });

  await test("Models that cache on their own keep only the top-level field", async () => {
    const body = await send(roleplay, { model: "deepseek/deepseek-chat", enableCaching: true });
    assert.deepEqual(body.cache_control, fiveMinutes);
    assert.equal(marks(body), 0);
  });

  await test("Caching off sends no cache field and leaves every message as it was", async () => {
    for (const model of [
      "anthropic/claude-sonnet-4.5",
      "google/gemini-3.5-flash",
      "qwen/qwen3-max",
      "deepseek/deepseek-chat",
    ]) {
      const body = await send(roleplay, { model, enableCaching: false, anthropicExtendedCacheTtl: true });
      assert.equal(JSON.stringify(body).includes("cache_control"), false, model);
      assert.equal(body.messages[0].content, "Stable rules", model);
    }
  });

  await test("Each chat's OpenRouter requests share a session id, caching on or off", async () => {
    const options = { model: "google/gemini-3.5-flash", enableCaching: false };
    const first = await send(roleplay, options, { chatId: "chat-a" });
    assert.match(String(first.session_id), /^marinara-[0-9a-f]{32}$/);
    assert.ok(!String(first.session_id).includes("chat-a"), "the chat id never leaves the server");
    assert.equal(first.prompt_cache_key, undefined, "OpenRouter routes by session_id");
    const again = await send(roleplay, { ...options, enableCaching: true }, { chatId: "chat-a", streaming: true });
    assert.equal(again.session_id, first.session_id);
    assert.notEqual((await send(roleplay, options, { chatId: "chat-b" })).session_id, first.session_id);
    assert.equal((await send(roleplay, options)).session_id, undefined, "no chat, no session");
    // Other endpoints never get the field.
    for (const kind of ["custom", "openai"] as const) {
      const provider = new OpenAIProvider(base, "test", undefined, null, null, kind);
      const body = await send(roleplay, { model: "gpt-4.1" }, { provider, chatId: "chat-a" });
      assert.equal(body.session_id, undefined, kind);
    }
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
