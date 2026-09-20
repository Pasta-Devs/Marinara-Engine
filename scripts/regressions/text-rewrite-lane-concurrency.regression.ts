import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Proves the fix for the placeholder ("Rewrite agents are working!") staying up until
// EVERY post-processing agent finishes, even ones (trackers, lorebook-keeper, custom
// tracker-type agents) that never touch the message text. The rewrite lane must now be
// kicked off concurrently with those agents, so its `text_rewrite` SSE event can arrive
// before a deliberately slow non-text agent's `agent_result` — something the old
// sequential (rewrite-lane-runs-after-everything-else) code could never produce. The
// generation-complete signal (`done`) must still wait for the slow agent.
const dir = mkdtempSync(join(tmpdir(), "marinara-text-rewrite-concurrency-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");

const SLOW_AGENT_DELAY_MS = 250;
const SLOW_AGENT_TYPE = "slow-non-text-fixture";
const REWRITE_AGENT_TYPE = "custom-rewrite-fixture";
const REWRITTEN_TEXT = "The story continues, freshly rewritten.";

const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = body.messages.map((message: { content: unknown }) => JSON.stringify(message.content)).join("\n");

  let content: string;
  if (prompt.includes("SLOW_NON_TEXT_FIXTURE")) {
    // Stands in for a tracker, lorebook-keeper, or custom tracker-type ("director_event")
    // agent — none of which mutate the visible message, but all of which used to gate
    // its display.
    await new Promise((resolve) => setTimeout(resolve, SLOW_AGENT_DELAY_MS));
    content = "{}";
  } else if (prompt.includes("REWRITE_LANE_FIXTURE")) {
    content = JSON.stringify({
      editNeeded: true,
      editedText: REWRITTEN_TEXT,
      changes: [{ description: "Fixture rewrite." }],
    });
  } else {
    content = "The story continues.";
  }

  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});

const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });

  await agents.create({
    type: SLOW_AGENT_TYPE,
    name: "Slow non-text fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "SLOW_NON_TEXT_FIXTURE Return JSON.",
    settings: {},
  });
  await agents.create({
    type: REWRITE_AGENT_TYPE,
    name: "Rewrite lane fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "REWRITE_LANE_FIXTURE Rewrite the response.",
    settings: { resultType: "text_rewrite" },
  });

  const chat = await chats.create({
    name: "Rewrite lane concurrency",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  await chats.patchMetadata(chat.id, {
    enableAgents: true,
    activeAgentIds: [SLOW_AGENT_TYPE, REWRITE_AGENT_TYPE],
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Begin." });

  const response = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.ok(!response.body.includes('"type":"error"'), response.body);

  const events = response.body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; data?: unknown });

  const textRewriteIndex = events.findIndex((event) => event.type === "text_rewrite");
  const slowAgentResultIndex = events.findIndex(
    (event) =>
      event.type === "agent_result" &&
      (event.data as { agentType?: string } | undefined)?.agentType === SLOW_AGENT_TYPE,
  );
  const doneIndex = events.findIndex((event) => event.type === "done");

  assert.ok(textRewriteIndex >= 0, "The text_rewrite event must fire");
  assert.ok(slowAgentResultIndex >= 0, "The slow non-text agent must report its result");
  assert.ok(doneIndex >= 0, "The done event must fire");

  assert.ok(
    textRewriteIndex < slowAgentResultIndex,
    "text_rewrite must fire before the slow non-text agent's result — the rewrite lane must not wait on it",
  );
  assert.ok(
    doneIndex > slowAgentResultIndex && doneIndex > textRewriteIndex,
    "done (which unblocks a new generation) must still wait for every post-processing agent, including the slow one",
  );

  const savedAssistant = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant");
  assert.equal(savedAssistant?.content, REWRITTEN_TEXT, "The rewrite lane's edit must be persisted");

  console.log("Text rewrite lane concurrency regression passed.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
