import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-command-swipe-"));
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
let content = '[react: emoji="😂"]';
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
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
    name: "Command-only regenerate",
    mode: "conversation",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false });
  const generate = async (regenerateMessageId?: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, regenerateMessageId },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
  };
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Begin." });
  const original = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Original reply." });
  assert.ok(original);
  for (const expectedSwipe of [1, 2]) {
    await generate(original.id);
    const messages = await chats.listMessages(chat.id);
    assert.equal(messages.length, 2, "A command-only regenerate must not append a new message");
    const message = await chats.getMessage(original.id);
    assert.equal(message?.activeSwipeIndex, expectedSwipe);
    assert.equal(message?.content, "");
    const extra = JSON.parse(message!.extra);
    assert.equal(extra.commandOnly, true);
    assert.equal(extra.hiddenFromUser, true);
    const swipes = await chats.getSwipes(original.id);
    assert.equal(swipes.length, expectedSwipe + 1);
    assert.equal(JSON.parse(swipes[expectedSwipe].extra).commandOnly, true);
  }
  await chats.setActiveSwipe(original.id, 0);
  assert.equal((await chats.getMessage(original.id))?.content, "Original reply.");
  assert.notEqual(JSON.parse((await chats.getMessage(original.id))!.extra).hiddenFromUser, true);
  await chats.setActiveSwipe(original.id, 2);
  content = "A visible new reply.";
  await generate(original.id);
  const visible = await chats.getMessage(original.id);
  assert.equal(visible?.content, content);
  assert.notEqual(JSON.parse(visible!.extra).hiddenFromUser, true, "Anchor visibility must not hide a new prose swipe");
  assert.notEqual(JSON.parse(visible!.extra).hiddenFromAI, true);
  await chats.setActiveSwipe(original.id, 2);
  assert.equal(JSON.parse((await chats.getMessage(original.id))!.extra).commandOnly, true);
  const manuallyHidden = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Private note." });
  assert.ok(manuallyHidden);
  await chats.updateMessageExtra(manuallyHidden.id, { hiddenFromUser: true, hiddenFromAI: true });
  await chats.addSwipe(manuallyHidden.id, "Another private note.");
  const hiddenExtra = JSON.parse((await chats.getMessage(manuallyHidden.id))!.extra);
  assert.equal(
    hiddenExtra.hiddenFromUser,
    true,
    "Explicitly hidden ordinary messages keep their visibility on regeneration",
  );
  assert.equal(hiddenExtra.hiddenFromAI, true);
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Command-only regeneration preserves message identity, swipe history, and visibility.");
