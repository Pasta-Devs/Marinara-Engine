/**
 * ChatGPT cache key (part of the cache-friendly prompt layout, Settings > Advanced > Features, off by default).
 *
 * With the switch on, a ChatGPT request that carries the full-lore prefix sends only that prefix as
 * `instructions`, a `prompt_cache_key` and a `session-id` header derived from the chat id, so a chat's turns
 * reach the same cache. With the switch off, or without the prefix, the request is exactly as before.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-chatgpt-cache-"));
const { resetFeatureSettingsForTests } =
  await import("../../packages/server/src/services/features/feature-settings.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { OpenAIChatGPTProvider } =
  await import("../../packages/server/src/services/llm/providers/openai-chatgpt.provider.js");
const { resolveOpenAIChatGPTCacheSession } =
  await import("../../packages/server/src/services/llm/providers/openai-chatgpt-cache.js");
type ChatMessage = import("../../packages/server/src/services/llm/base-provider.js").ChatMessage;

const lore: ChatMessage = {
  role: "system",
  content: "<lore>\nThe harbour bell rings at noon.\n</lore>",
  contextKind: "prompt",
  providerMetadata: { marinaraFullLoreContext: true, marinaraCacheScope: "chat-a" },
};
const rules = (weather: string): ChatMessage => ({ role: "system", content: `Rules. Weather: ${weather}` });
const latest: ChatMessage = { role: "user", content: "Ring the bell.", contextKind: "history" };

const requests: Array<Record<string, any>> = [];
const headers: Array<Record<string, string>> = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  requests.push(JSON.parse(raw));
  headers.push(
    Object.fromEntries(
      Object.entries(request.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
  );
  response.writeHead(200, { "Content-Type": "text/event-stream" });
  response.end(
    'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output_text":"OK","usage":{"input_tokens":2000,"output_tokens":1,"input_tokens_details":{"cached_tokens":1500}}}}\n\n',
  );
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const previousCodexHome = process.env.CODEX_HOME;
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const provider = new OpenAIProvider(baseUrl, "test", undefined, undefined, undefined, "openai-chatgpt");

  // Isolated fake Codex login for the real ChatGPT delegate; never read a user's auth.
  writeFileSync(
    join(dir, "auth.json"),
    JSON.stringify({
      tokens: { access_token: "synthetic-test-token", account_id: "synthetic-account" },
      last_refresh: new Date().toISOString(),
    }),
  );
  const chatgpt = new OpenAIChatGPTProvider("", "") as unknown as {
    delegate(messages: ChatMessage[]): Promise<InstanceType<typeof OpenAIProvider>>;
  };
  const throughDelegate = async (messages: ChatMessage[]) => {
    process.env.CODEX_HOME = dir;
    const delegated = await chatgpt.delegate(messages);
    (delegated as unknown as { baseUrl: string }).baseUrl = baseUrl;
    await delegated.chatComplete(messages, { model: "gpt-5.6-sol" });
    return { body: requests.at(-1)!, header: headers.at(-1)! };
  };

  // ── Off: no key and no header, even for a marked request (the layout never marks one while off) ──
  resetFeatureSettingsForTests();
  assert.equal(resolveOpenAIChatGPTCacheSession([lore, latest]), undefined);
  await provider.chatComplete([lore, rules("Sunny"), latest], { model: "gpt-5.6-sol" });
  const offBody = requests.at(-1)!;
  assert.equal(offBody.prompt_cache_key, undefined, "off: no prompt_cache_key");
  const offDelegate = await throughDelegate([lore, rules("Sunny"), latest]);
  assert.equal(offDelegate.header["session-id"], undefined, "off: no session-id header");
  assert.deepEqual(offDelegate.body, offBody, "off: the delegate sends the same body");

  // ── On ──
  resetFeatureSettingsForTests({ cacheFriendlyPromptLayout: true });
  for (const weather of ["Sunny", "Rainy"]) {
    const result = await provider.chatComplete([lore, rules(weather), latest], { model: "gpt-5.6-sol" });
    assert.equal(result.usage?.cachedPromptTokens, 1500);
  }
  const [sunny, rainy] = requests.slice(-2);
  assert.equal(sunny!.instructions, lore.content, "on: only the lore is in instructions");
  assert.equal(rainy!.instructions, sunny!.instructions, "on: the changing rules do not touch the prefix");
  assert.match(rainy!.input[0].content, /Rainy/u);
  assert.equal(rainy!.input[0].role, "system");
  assert.match(sunny!.prompt_cache_key, /^me-lore-[a-f0-9]{40}$/u);
  assert.equal(rainy!.prompt_cache_key, sunny!.prompt_cache_key);
  assert.equal(sunny!.prompt_cache_options, undefined, "unsupported cache fields never reach ChatGPT");
  await provider.chatComplete([{ ...lore, content: "Edited lore" }, latest], { model: "gpt-5.6-sol" });
  assert.equal(requests.at(-1)!.prompt_cache_key, sunny!.prompt_cache_key, "the chat id keeps the key after an edit");
  await provider.chatComplete([{ role: "system", content: "Ordinary instructions" }, latest], { model: "gpt-5.6-sol" });
  assert.equal(requests.at(-1)!.prompt_cache_key, undefined, "on: a request without the lore prefix is unchanged");
  assert.equal(requests.at(-1)!.instructions, "Ordinary instructions");

  const session = resolveOpenAIChatGPTCacheSession([lore, latest]);
  assert.match(session!, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/u);
  const onDelegate = await throughDelegate([lore, rules("Sunny"), latest]);
  assert.equal(onDelegate.header["session-id"], session, "on: the delegate sends the session-id header");
  assert.equal(onDelegate.header.session_id, undefined, "never the underscore spelling");
  const other = { ...lore, providerMetadata: { ...lore.providerMetadata, marinaraCacheScope: "chat-b" } };
  assert.notEqual(resolveOpenAIChatGPTCacheSession([other, latest]), session, "other chats get another session");
  const unscoped = { ...lore, providerMetadata: { marinaraFullLoreContext: true } };
  assert.notEqual(
    resolveOpenAIChatGPTCacheSession([unscoped]),
    resolveOpenAIChatGPTCacheSession([{ ...unscoped, content: "Edited lore" }]),
    "without a chat id the key follows the lore text",
  );
  const plainDelegate = await throughDelegate([{ role: "system", content: "Ordinary instructions" }, latest]);
  assert.equal(plainDelegate.header["session-id"], undefined);
} finally {
  resetFeatureSettingsForTests();
  if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = previousCodexHome;
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(dir, { recursive: true, force: true });
}

console.log("chatgpt-cache-key regression passed");
