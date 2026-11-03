import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Capability API 1.814: a package marks where the stable part of its prompt ends (`cacheBreakpoint`), and the
// Engine caches it on Anthropic whatever the connection's prompt-caching switch says, for the connection's cache
// time. A call without a marker is sent exactly as before. Every connection points at a local stub that records the
// request bodies and reports cache usage like Anthropic does.
const dir = mkdtempSync(join(tmpdir(), "marinara-package-prompt-cache-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";

const requests: Array<{ path: string; body: Record<string, any> }> = [];
const event = (data: Record<string, unknown>) => `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
const sse = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const path = request.url ?? "";
  requests.push({ path, body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") });
  response.writeHead(200, { "content-type": "text/event-stream" });
  if (path.endsWith("/messages")) {
    response.end(
      [
        event({
          type: "message_start",
          message: { usage: { input_tokens: 7, cache_read_input_tokens: 1200, cache_creation_input_tokens: 300 } },
        }),
        event({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
        event({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } }),
        event({ type: "content_block_stop", index: 0 }),
        event({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } }),
        event({ type: "message_stop" }),
      ].join(""),
    );
    return;
  }
  response.end(
    `${sse({ choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }] })}${sse({
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 },
    })}data: [DONE]\n\n`,
  );
});

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCapabilityLanguageModelHost } =
  await import("../../packages/server/src/services/capability-packages/capability-language-model.service.js");
const { AnthropicProvider } = await import("../../packages/server/src/services/llm/providers/anthropic.provider.js");
type PackageMessage = import("../../packages/shared/src/types/capability-runtime.js").CapabilityLanguageModelMessage;

/** Where cache_control lands: `system:<i>` for system blocks, `<message>.<block>` for message blocks, with its TTL. */
function breakpoints(body: Record<string, any>): string[] {
  const found: string[] = [];
  const ttl = (block: Record<string, any>) => `${block.cache_control.type}/${block.cache_control.ttl ?? "5m"}`;
  if (Array.isArray(body.system)) {
    body.system.forEach((block: Record<string, any>, index: number) => {
      if (block.cache_control) found.push(`system:${index} ${ttl(block)}`);
    });
  }
  body.messages.forEach((message: Record<string, any>, index: number) => {
    if (!Array.isArray(message.content)) return;
    message.content.forEach((block: Record<string, any>, blockIndex: number) => {
      if (block.cache_control) found.push(`${index}.${blockIndex} ${ttl(block)}`);
    });
  });
  return found;
}

let db: Awaited<ReturnType<typeof getDB>> | null = null;
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  db = await getDB();
  const connections = createConnectionsStorage(db);
  const host = createCapabilityLanguageModelHost(db);
  const anthropic = (name: string, settings: { enableCaching?: boolean; anthropicExtendedCacheTtl?: boolean }) =>
    connections.create({
      name,
      provider: "anthropic",
      baseUrl: `${base}/v1`,
      model: "claude-sonnet-4-5",
      apiKey: "fixture-key",
      ...settings,
    });
  const lastBody = () => requests.at(-1)!.body;

  const stable: PackageMessage[] = [
    { role: "system", content: "Rules of the story." },
    { role: "system", content: "Character sheets.", cacheBreakpoint: true },
    { role: "system", content: "Today's weather changes every call." },
    { role: "user", content: "Chapter one." },
    { role: "assistant", content: "It began." },
    // Merged into one user turn with the next message: the breakpoint must stay on this message's own block.
    { role: "user", content: "The story so far.", cacheBreakpoint: true },
    { role: "user", content: "What happens next?" },
  ];

  // ── Caching off on the connection: a marked package call is still cached, exactly where it was marked ──
  {
    const model = await host.resolve((await anthropic("Caching off", {})).id);
    const result = await model.chatComplete(stable);
    const body = lastBody();
    assert.deepEqual(
      breakpoints(body),
      ["system:1 ephemeral/5m", "2.0 ephemeral/5m"],
      "the marked system message and the marked user message carry cache_control, with the default 5-minute TTL",
    );
    assert.deepEqual(
      body.system.map((block: { text: string }) => block.text),
      ["Rules of the story.", "Character sheets.", "Today's weather changes every call."],
    );
    assert.deepEqual(
      body.messages[2].content.map((block: { text: string }) => block.text),
      ["The story so far.", "What happens next?"],
      "the merged user turn keeps the marked message as its own block",
    );
    assert.equal(JSON.stringify(body).includes("cacheBreakpoint"), false, "the marker itself is never sent");
    assert.equal(result.content, "ok");
    assert.equal(result.usage?.cachedPromptTokens, 1200, "cache reads reach the package");
    assert.equal(result.usage?.cacheWritePromptTokens, 300, "cache writes reach the package");

    // A call without a marker is sent as before: no cache_control anywhere, the system prompt one string.
    await model.chatComplete(stable.map(({ cacheBreakpoint: _marker, ...message }) => message));
    const plain = lastBody();
    assert.equal(JSON.stringify(plain).includes("cache_control"), false, "an unmarked call sends no cache_control");
    assert.equal(typeof plain.system, "string");
  }

  // ── The connection's extended cache time sets the TTL; marked calls replace its own breakpoints ──
  {
    const model = await host.resolve(
      (await anthropic("Caching on, 1 hour", { enableCaching: true, anthropicExtendedCacheTtl: true })).id,
    );
    await model.chatComplete(stable);
    assert.deepEqual(
      breakpoints(lastBody()),
      ["system:1 ephemeral/1h", "2.0 ephemeral/1h"],
      "only the marked blocks cache, for the connection's 1-hour TTL",
    );
  }

  // ── A call's own cache time (1.815) overrides the connection's, both ways; an unmarked call still sends none ──
  {
    const fiveMinutes = await host.resolve((await anthropic("Caching off, call asks 1 hour", {})).id);
    await fiveMinutes.chatComplete(stable, { cacheTtl: "1h" });
    assert.deepEqual(
      breakpoints(lastBody()),
      ["system:1 ephemeral/1h", "2.0 ephemeral/1h"],
      "the call's 1-hour TTL on a 5-minute connection",
    );
    await fiveMinutes.chatComplete(
      stable.map(({ cacheBreakpoint: _marker, ...message }) => message),
      { cacheTtl: "1h" },
    );
    assert.equal(JSON.stringify(lastBody()).includes("cache_control"), false, "no marker, no cache, whatever the TTL");
    const hour = await host.resolve(
      (await anthropic("1 hour, call asks 5 minutes", { anthropicExtendedCacheTtl: true })).id,
    );
    await hour.chatComplete(stable, { cacheTtl: "5m" });
    assert.deepEqual(
      breakpoints(lastBody()),
      ["system:1 ephemeral/5m", "2.0 ephemeral/5m"],
      "the call's 5-minute TTL on a 1-hour connection",
    );
    await hour.chatComplete(stable);
    assert.deepEqual(
      breakpoints(lastBody()),
      ["system:1 ephemeral/1h", "2.0 ephemeral/1h"],
      "left out, the connection's 1 hour applies",
    );
  }

  // ── More than four markers: the last four count, system blocks first ──
  {
    const model = await host.resolve((await anthropic("Many markers", {})).id);
    await model.chatComplete([
      { role: "system", content: "A", cacheBreakpoint: true },
      { role: "system", content: "B", cacheBreakpoint: true },
      { role: "user", content: "C", cacheBreakpoint: true },
      { role: "assistant", content: "D", cacheBreakpoint: true },
      { role: "user", content: "E", cacheBreakpoint: true },
      { role: "user", content: "F" },
    ]);
    assert.deepEqual(breakpoints(lastBody()), [
      "system:1 ephemeral/5m",
      "0.0 ephemeral/5m",
      "1.0 ephemeral/5m",
      "2.0 ephemeral/5m",
    ]);
  }

  // ── An empty marked message (a story with nothing so far yet) caches the prefix before it ──
  {
    const emptyMarkers: PackageMessage[] = [
      { role: "system", content: "Long stable instructions." },
      { role: "system", content: "", cacheBreakpoint: true },
      { role: "user", content: "Chapter one." },
      { role: "assistant", content: "It began." },
      { role: "user", content: "   ", cacheBreakpoint: true },
      { role: "user", content: "What happens next?" },
    ];
    const expected = ["system:0 ephemeral/5m", "1.0 ephemeral/5m"];
    const model = await host.resolve((await anthropic("Empty markers", {})).id);
    await model.chatComplete(emptyMarkers);
    assert.deepEqual(breakpoints(lastBody()), expected, "each empty marker moves to the message before it");

    const provider = new AnthropicProvider(`${base}/v1`, "fixture-key");
    const tools = [{ type: "function" as const, function: { name: "roll", description: "Roll", parameters: {} } }];
    await provider.chatComplete(emptyMarkers, { model: "claude-sonnet-4-5", stream: true, tools });
    assert.deepEqual(breakpoints(lastBody()), expected, "the tool-round path moves them the same way");

    // With the connection's caching on, the moved marker still replaces its own breakpoints.
    const onlyEmptySystemMarker = emptyMarkers.filter((message) => message.content !== "   ");
    await provider.chatComplete(onlyEmptySystemMarker, {
      model: "claude-sonnet-4-5",
      stream: true,
      enableCaching: true,
    });
    assert.deepEqual(breakpoints(lastBody()), ["system:0 ephemeral/5m"]);

    // Nothing before an empty marker: the call is cached as an unmarked one, by the connection's own breakpoints.
    await provider.chatComplete(
      [
        { role: "system", content: "", cacheBreakpoint: true },
        { role: "user", content: "Hi." },
      ],
      { model: "claude-sonnet-4-5", stream: true, enableCaching: true },
    );
    assert.deepEqual(breakpoints(lastBody()), ["0.0 ephemeral/5m"]);
  }

  // ── The tool-round path marks the same blocks ──
  {
    const tools = [{ type: "function" as const, function: { name: "roll", description: "Roll", parameters: {} } }];
    await new AnthropicProvider(`${base}/v1`, "fixture-key").chatComplete(stable, {
      model: "claude-sonnet-4-5",
      stream: true,
      tools,
    });
    assert.ok(lastBody().tools, "the tool path ran");
    assert.deepEqual(breakpoints(lastBody()), ["system:1 ephemeral/5m", "2.0 ephemeral/5m"]);
  }

  // ── OpenAI-compatible routes (OpenRouter) cache prefixes without markers: the marker is a no-op there ──
  {
    const openRouter = await connections.create({
      name: "OpenRouter",
      provider: "openrouter",
      baseUrl: `${base}/v1`,
      model: "anthropic/claude-sonnet-4.5",
      apiKey: "fixture-key",
    });
    const model = await host.resolve(openRouter.id);
    const result = await model.chatComplete(stable);
    const body = lastBody();
    assert.equal(requests.at(-1)!.path.endsWith("/chat/completions"), true);
    assert.equal(JSON.stringify(body).includes("cacheBreakpoint"), false, "the marker is not sent");
    assert.equal(JSON.stringify(body).includes("cache_control"), false, "nothing is cached that was not before");
    assert.equal(result.content, "ok");
  }

  console.log("capability-language-model-prompt-cache regression passed");
} finally {
  server.close();
  if (db) await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
