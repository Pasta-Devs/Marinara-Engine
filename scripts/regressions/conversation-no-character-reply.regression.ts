import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A Conversation chat with no character never answered (playtest 2026-10-26): the presence check
// found nobody online, ended the request with a bare "done" and never called the model. With no
// character there is no presence to wait on, so the message is answered.
const dir = mkdtempSync(join(tmpdir(), "marinara-convo-no-character-"));
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
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");

const reply = "Hello there, friend.";
let calls = 0;
const provider = createServer(async (req, res) => {
  for await (const _chunk of req) void _chunk;
  calls++;
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: reply }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
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
  const chat = await chats.create({
    name: "Nobody here",
    mode: "conversation",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false });
  const response = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, connectionId: null, userMessage: "Is anyone there?" },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.ok(!response.body.includes('"type":"error"'), response.body);
  assert.equal(calls, 1, "the model is asked once");
  const messages = await chats.listMessages(chat.id);
  assert.deepEqual(
    messages.map((message: { role: string; content: string }) => [message.role, message.content]),
    [
      ["user", "Is anyone there?"],
      ["assistant", reply],
    ],
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("A Conversation chat with no character answers the player.");
