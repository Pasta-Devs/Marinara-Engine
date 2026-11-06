import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// One user action sends each prompt once. Gemini and Anthropic get exactly one request for a send, a regenerate, a
// continue and an impersonation, in a Roleplay group (streamed, reasoning on) and a Conversation (buffered, reasoning
// off). A character-activity agent whose prompt fails reaches the reply's fallback once, and a rate limit is retried
// once per connection, not inside another retry: its provider used to get the fallback and retry layers twice.
// Routing keeps the reply's fallback when only that one is set.
const dir = mkdtempSync(join(tmpdir(), "marinara-provider-requests-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
// The fake provider runs on 127.0.0.1; nothing leaves the machine.
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { MAX_RATE_LIMIT_RETRIES } = await import("../../packages/server/src/services/llm/rate-limit-aware-provider.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const ROUTER = "ROUTER_PROMPT_FIXTURE";
const requests: Array<{ path: string; hash: string; router: boolean }> = [];
/** The status the fake answers a request with; 200 is a reply. */
let status: (path: string, router: boolean) => number = () => 200;

function anthropicSse(text: string) {
  return [
    { type: "message_start", message: { id: "m", type: "message", role: "assistant", content: [], usage: {} } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
    { type: "message_stop" },
  ]
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
}

// Speaks Gemini generateContent / streamGenerateContent and Anthropic Messages, streamed and buffered.
const fake = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString();
  const path = request.url ?? "";
  const router = raw.includes(ROUTER);
  requests.push({ path, hash: createHash("sha256").update(raw).digest("hex"), router });
  const code = status(path, router);
  if (code !== 200) {
    response.writeHead(code, { "content-type": "application/json", "retry-after": "0" });
    response.end(JSON.stringify({ error: { message: "refused" } }));
    return;
  }
  const text = router ? JSON.stringify({ activeCharacterIds: [] }) : "A reply.";
  const gemini = { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] };
  if (path.includes(":streamGenerateContent")) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(`data: ${JSON.stringify(gemini)}\n\n`);
  } else if (path.includes(":generateContent")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(gemini));
  } else if (JSON.parse(raw).stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(anthropicSse(text));
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn", usage: {} }),
    );
  }
});

const db = await getDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => fake.listen(0, "127.0.0.1", done));
  const address = fake.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const characters = createCharactersStorage(db);
  const alice = await characters.create(characterDataSchema.parse({ name: "Alice" }));
  const bob = await characters.create(characterDataSchema.parse({ name: "Bob" }));
  assert(alice && bob);
  const generate = async (payload: Record<string, unknown>, label: string) => {
    requests.length = 0;
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload });
    assert.equal(response.statusCode, 200, `${label}: ${response.body}`);
    assert(!response.body.includes('"type":"error"'), `${label}: ${response.body}`);
    return response.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type: string; data?: any });
  };

  const providers = [
    ["google", "google", "gemini-2.5-flash"],
    ["anthropic", "anthropic/v1", "claude-sonnet-4-5"],
  ] as const;
  for (const [provider, path, model] of providers) {
    for (const [mode, streaming, reasoning] of [
      ["roleplay", true, true],
      ["conversation", false, false],
    ] as const) {
      const connection = await connections.create({
        name: `${model} ${mode}`,
        provider,
        baseUrl: `${base}/${path}`,
        model,
        apiKey: "fixture",
        maxContext: 32768,
      });
      assert(connection);
      await connections.updateDefaultParameters(connection.id, {
        reasoningEffort: reasoning ? "medium" : null,
        showThoughts: reasoning,
      });
      // Conversation has no impersonation.
      for (const action of ["send", "regenerate", "continue", ...(mode === "roleplay" ? ["impersonate"] : [])]) {
        const label = `${provider} ${mode} ${action}`;
        const chat = await chats.create({
          name: label,
          mode,
          characterIds: [alice.id, bob.id],
          connectionId: connection.id,
        });
        assert(chat);
        await chats.createMessage({ chatId: chat.id, role: "user", content: "Hello." });
        const last = await chats.createMessage({
          chatId: chat.id,
          role: "assistant",
          characterId: alice.id,
          content: "Hi there.",
        });
        assert(last);
        await generate(
          {
            chatId: chat.id,
            streaming,
            ...(action === "send" ? { userMessage: "How are you?" } : {}),
            ...(action === "regenerate" ? { regenerateMessageId: last.id } : {}),
            ...(action === "continue" ? { continueMessageId: last.id } : {}),
            ...(action === "impersonate" ? { impersonate: true } : {}),
          },
          label,
        );
        assert.equal(requests.length, 1, `${label} sends one request: ${JSON.stringify(requests)}`);
      }
    }
  }

  // A character-activity agent on the chat's connection, with a fallback for the reply and maybe for agents.
  await createAgentsStorage(db).create({
    type: "routing-fixture",
    name: "Routing fixture",
    phase: "pre_generation",
    connectionId: null,
    promptTemplate: ROUTER,
    settings: { resultType: "character_activity_update" },
  });
  for (const [provider, path, model] of providers) {
    const primary = await connections.create({
      name: `${provider} primary`,
      provider,
      baseUrl: `${base}/primary/${path}`,
      model,
      apiKey: "fixture",
      maxContext: 32768,
    });
    const fallback = await connections.create({
      name: `${provider} fallback`,
      provider,
      baseUrl: `${base}/fallback/${path}`,
      model,
      apiKey: "fixture",
      maxContext: 32768,
    });
    assert(primary && fallback);
    const chat = await chats.create({
      name: `${provider} routing`,
      mode: "roleplay",
      characterIds: [alice.id, bob.id],
      connectionId: primary.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: ["routing-fixture"] });
    const leg = (requestPath: string) => (requestPath.startsWith("/primary/") ? "primary" : "fallback");
    const routingRequests = () => {
      const counts = { primary: 0, fallback: 0 };
      for (const request of requests) if (request.router) counts[leg(request.path)] += 1;
      return counts;
    };

    // The same connection as both fallbacks, and the reply's fallback alone (the common setup).
    for (const fallbackForAgents of [true, false]) {
      const setup = `${provider} ${fallbackForAgents ? "main and agents" : "main only"} fallback`;
      await connections.update(fallback.id, { fallbackForMain: true, fallbackForAgents });

      // The primary refuses everything: routing answers on the reply's fallback and says which connection failed.
      status = (requestPath) => (leg(requestPath) === "primary" ? 500 : 200);
      const events = await generate({ chatId: chat.id, userMessage: "Who?", streaming: true }, `${setup} answered`);
      assert.deepEqual(routingRequests(), { primary: 1, fallback: 1 }, `${setup}: routing falls back once`);
      const routed = events.find(
        (event) => event.type === "agent_result" && event.data.agentType === "routing-fixture",
      );
      assert.equal(routed?.data.success, true, `${setup}: routing answers on the fallback: ${JSON.stringify(routed)}`);
      const notice = events.find((event) => event.type === "fallback_used")?.data;
      assert.equal(notice?.category, "main", `${setup}: routing uses the reply's fallback: ${JSON.stringify(notice)}`);
      assert.equal(notice?.failed?.connectionName, primary.name, `${setup}: the notice names the failed connection`);

      // The fallback refuses the routing prompt too: the reply still comes from the fallback, and each prompt
      // reaches each connection once.
      status = (requestPath, router) => (leg(requestPath) === "primary" || router ? 500 : 200);
      await generate({ chatId: chat.id, userMessage: "Who answers?", streaming: true }, `${setup} refused`);
      const sent = new Map<string, number>();
      for (const request of requests) {
        const key = `${leg(request.path)} ${request.hash}`;
        sent.set(key, (sent.get(key) ?? 0) + 1);
      }
      assert.deepEqual(routingRequests(), { primary: 1, fallback: 1 }, `${setup}: the routing prompt goes once each`);
      for (const [key, count] of sent) assert.equal(count, 1, `${setup}: ${key} was sent ${count} times`);

      // A rate limit on both: one retry budget per connection, not one inside the other.
      status = (_requestPath, router) => (router ? 429 : 200);
      await generate({ chatId: chat.id, userMessage: "Who answers now?", streaming: true }, `${setup} 429`);
      assert.deepEqual(
        routingRequests(),
        { primary: MAX_RATE_LIMIT_RETRIES + 1, fallback: MAX_RATE_LIMIT_RETRIES + 1 },
        `${setup}: rate-limit retries are not multiplied`,
      );
      status = () => 200;
    }
    await connections.update(fallback.id, { fallbackForMain: false, fallbackForAgents: false });
  }
  console.log("Provider requests per action regression passed.");
} finally {
  await app.close();
  fake.closeAllConnections();
  await new Promise<void>((done) => fake.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
