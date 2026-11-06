import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  OpenAIProvider,
  openAIPromptCacheKeyAccepted,
} from "../../packages/server/src/services/llm/providers/openai.provider.js";
import { openCodeSessionHook } from "../../packages/server/src/utils/opencode-session.js";

// Only OpenAI's own endpoints take the key: a compatible endpoint may refuse a field it does not know.
assert.equal(openAIPromptCacheKeyAccepted("openai", "https://api.openai.com/v1"), true);
assert.equal(openAIPromptCacheKeyAccepted("openai-chatgpt", "https://chatgpt.com/backend-api/codex"), true);
assert.equal(openAIPromptCacheKeyAccepted("openai", "https://api.openai.com.proxy.example/v1"), false);
assert.equal(openAIPromptCacheKeyAccepted("openai", "https://proxy.example/v1"), false);
assert.equal(openAIPromptCacheKeyAccepted("custom", "https://api.openai.com/v1"), false);
assert.equal(openAIPromptCacheKeyAccepted("openrouter", "https://openrouter.ai/api/v1"), false);

// Each request body the provider sends; the fixture then fails the request, which is enough.
const bodies: Array<Record<string, unknown>> = [];
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    bodies.push(JSON.parse(raw || "{}"));
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "fixture" } }));
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

/** Runs `fn` inside a request for `chatId`, as the server's hook does. */
function inChat<T>(chatId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = { body: chatId ? { chatId } : {}, params: {}, routeOptions: { url: "/api/generate" } };
    (openCodeSessionHook as unknown as (req: unknown, reply: unknown, done: () => void) => void)(request, {}, () => {
      fn().then(resolve, reject);
    });
  });
}

async function send(provider: OpenAIProvider, model: string, chatId: string | undefined) {
  bodies.length = 0;
  await inChat(chatId, () =>
    provider.chatComplete([{ role: "user", content: "hi" }], { model, stream: false }).catch(() => undefined),
  );
  assert.ok(bodies.length > 0, "a request was sent");
  return bodies[0]!;
}

try {
  const codex = new OpenAIProvider(base, "token", undefined, null, null, "openai-chatgpt");
  const custom = new OpenAIProvider(`${base}/v1`, "key", undefined, null, null, "custom");

  // One chat keeps one key; another chat gets another.
  const first = await send(codex, "gpt-5.5", "chat-a");
  assert.match(String(first.prompt_cache_key), /^marinara-[0-9a-f]{32}$/);
  assert.equal((await send(codex, "gpt-5.5", "chat-a")).prompt_cache_key, first.prompt_cache_key);
  assert.notEqual((await send(codex, "gpt-5.5", "chat-b")).prompt_cache_key, first.prompt_cache_key);
  // The raw chat id never leaves the server.
  assert.ok(!String(first.prompt_cache_key).includes("chat-a"));
  // No chat, no key: a one-off request has nothing to share a cache with.
  assert.equal((await send(codex, "gpt-5.5", undefined)).prompt_cache_key, undefined);
  // A compatible endpoint never gets the field.
  assert.equal((await send(custom, "gpt-4.1", "chat-a")).prompt_cache_key, undefined);
} finally {
  server.close();
}

console.log("OpenAI requests of one chat share a prompt cache key, and only OpenAI's own endpoints get one.");
