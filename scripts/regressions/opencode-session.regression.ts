import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { createRequire } from "node:module";
import { APP_VERSION } from "../../packages/shared/src/constants/defaults.js";
import { openCodeSessionHook } from "../../packages/server/src/utils/opencode-session.js";
import { safeFetch } from "../../packages/server/src/utils/security.js";
import { createLLMProvider } from "../../packages/server/src/services/llm/provider-registry.js";

const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireFromServer("fastify");
const originalFetch = globalThis.fetch;
const originalLookup = dns.lookup;
const captured: Array<{ url: string; headers: Headers; prompt?: string }> = [];
const app = Fastify();
app.addHook("preHandler", openCodeSessionHook);
const provider = createLLMProvider(
  "custom",
  "https://opencode.ai/zen/go/v1",
  "fixture",
  null,
  null,
  null,
  false,
  false,
  {
    customHeaders: { "x-fixture": "preserved", "X-OpenCode-Session": "old-static-value" },
  },
);
const generate = async (request: { body?: unknown }) => {
  const body = request.body as { marker?: string; stream?: boolean } | undefined;
  const marker = body?.marker ?? "fixture";
  const messages = [{ role: "user" as const, content: marker }];
  for (let attempt = 0; attempt < 2; attempt++) {
    if (body?.stream) {
      let text = "";
      for await (const token of provider.chat(messages, { model: "fixture", stream: true })) text += token;
      assert.equal(text, "Ready.");
    } else {
      assert.equal((await provider.chatComplete(messages, { model: "fixture", stream: false })).content, "Ready.");
    }
  }
  return { ok: true };
};
app.post("/api/generate", generate);
app.post("/api/chats/:id/generate-summary", generate);
app.post("/api/agents/:chatId/retry", generate);
app.post("/api/translate", generate);
app.post("/api/scene/conclude", generate);
app.post("/api/connections/:id/test", generate);
try {
  // No DNS or paid provider traffic: capture the real provider -> safeFetch request.
  dns.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as typeof dns.lookup;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    captured.push({ url, headers: new Headers(init?.headers), prompt: body.messages?.[0]?.content });
    if (url.endsWith("/redirect")) {
      return new Response(null, { status: 307, headers: { location: "https://elsewhere.example/v1/final" } });
    }
    if (url.endsWith("/redirect-same")) {
      return new Response(null, { status: 307, headers: { location: "/zen/go/v1/final" } });
    }
    if (url.endsWith("/redirect-docs")) {
      return new Response(null, { status: 307, headers: { location: "/docs/go" } });
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    return body.stream
      ? new Response('data: {"choices":[{"delta":{"content":"Ready."},"finish_reason":null}]}\n\ndata: [DONE]\n\n', {
          headers: { "content-type": "text/event-stream" },
        })
      : Response.json({ choices: [{ message: { content: "Ready." }, finish_reason: "stop" }] });
  };
  const send = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    assert.equal(response.statusCode, 200, response.body);
  };
  await Promise.all([
    send("/api/generate", { chatId: "chat-a", marker: "a", stream: true }),
    send("/api/generate", { chatId: "chat-b", marker: "b" }),
  ]);
  const sessions = (marker: string) =>
    captured.filter((entry) => entry.prompt === marker).map((entry) => entry.headers.get("x-opencode-session"));
  const sessionA = sessions("a")[0];
  const sessionB = sessions("b")[0];
  assert.ok(sessionA && sessionB);
  assert.notEqual(sessionA, "old-static-value", "automatic chat identity replaces a fixed connection header");
  assert.notEqual(sessionA, sessionB, "concurrent chats must not share a session");
  assert.deepEqual(sessions("a"), [sessionA, sessionA]);
  assert.deepEqual(sessions("b"), [sessionB, sessionB]);
  await send("/api/generate", { chatId: "chat-a", marker: "resume" });
  await send("/api/chats/chat-a/generate-summary", { chatId: "wrong-body-id", marker: "summary" });
  await send("/api/agents/chat-a/retry", { marker: "agent" });
  await send("/api/translate", { chatId: "chat-a", marker: "translation" });
  await send("/api/scene/conclude", { sceneChatId: "chat-a", marker: "scene" });
  for (const marker of ["resume", "summary", "agent", "translation", "scene"])
    assert.deepEqual(sessions(marker), [sessionA, sessionA]);
  await send("/api/connections/shared-connection/test", { marker: "test-one" });
  await send("/api/connections/shared-connection/test", { marker: "test-two" });
  assert.notEqual(sessions("test-one")[0], sessions("test-two")[0], "a connection ID is not a conversation");
  for (const { headers } of captured) {
    assert.equal(headers.get("user-agent"), `Marinara-Engine/${APP_VERSION}`);
    assert.equal(headers.get("x-fixture"), "preserved");
    assert.equal(headers.get("authorization"), "Bearer fixture");
  }
  captured.length = 0;
  await safeFetch("https://opencode.ai/zen/go/v1/redirect-same");
  assert.ok(captured[0]!.headers.get("x-opencode-session"));
  assert.equal(captured[0]!.headers.get("x-opencode-session"), captured[1]!.headers.get("x-opencode-session"));
  captured.length = 0;
  await safeFetch("https://opencode.ai/zen/go/v1/redirect", {
    headers: { "x-opencode-session": "explicit", Authorization: "Bearer fixture" },
  });
  assert.equal(captured[1]!.headers.get("x-opencode-session"), null);
  assert.equal(captured[1]!.headers.get("authorization"), null);
  assert.equal(captured[1]!.headers.get("user-agent"), null);
  captured.length = 0;
  await safeFetch("https://opencode.ai/zen/go/v1/redirect-docs", {
    headers: { "x-opencode-session": "old-static-value" },
  });
  assert.ok(captured[0]!.headers.get("x-opencode-session"));
  assert.equal(
    captured[1]!.headers.get("x-opencode-session"),
    null,
    "API session headers do not follow a redirect to docs",
  );
  captured.length = 0;
  await safeFetch("https://proxy.example/v1", { headers: { "x-opencode-session": "configured-proxy-session" } });
  assert.equal(captured[0]!.headers.get("x-opencode-session"), "configured-proxy-session");
  for (const url of ["https://opencode.ai/zen/v1/responses", "https://api.opencode.ai/zen/go/v1/models"]) {
    captured.length = 0;
    await safeFetch(url);
    assert.ok(captured[0]!.headers.get("x-opencode-session"), url);
    assert.equal(captured[0]!.headers.get("user-agent"), `Marinara-Engine/${APP_VERSION}`);
  }
  for (const url of [
    "https://opencode.ai.example.com/zen/go/v1",
    "https://opencode.ai/docs/go",
    "https://api.openai.com/v1",
    "https://openrouter.ai/api/v1",
  ]) {
    captured.length = 0;
    await safeFetch(url);
    assert.equal(captured[0]!.headers.get("x-opencode-session"), null, url);
  }
  console.info(
    "OpenCode session headers: concurrent chats, resume, auxiliary calls, streaming, retries and redirects passed.",
  );
} finally {
  globalThis.fetch = originalFetch;
  dns.lookup = originalLookup;
  await app.close();
}
