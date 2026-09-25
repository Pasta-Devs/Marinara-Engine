import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-game-lore-"));
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
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");

type WireMessage = { role: string; content: string };
const requests: WireMessage[][] = [];
const provider = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  requests.push(body.messages);
  const content = "The lantern is steady.";
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local lore placement fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  const chat = (await chats.create({
    name: "Game lore placement",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  }))!;
  const books = await Promise.all([
    lorebooks.create({ name: "Manually attached lore" }),
    lorebooks.create({ name: "Game world lore", chatId: chat.id, generatedBy: "agent" }),
    lorebooks.create({
      name: "Game keeper lore",
      chatId: chat.id,
      generatedBy: "agent",
      sourceAgentId: "game-lorebook-keeper",
    }),
  ]);
  const entries = [
    { book: 0, content: "MANUAL_BEFORE: <canon>\nA & B keep their words.\n</canon>", position: 0 },
    { book: 1, content: "GAME_AFTER: The city sleeps.", position: 1 },
    { book: 2, content: "KEEPER_BEFORE: Last session remains canon.", position: 0 },
    { book: 0, content: "MANUAL_DEPTH_TWO", position: 2, depth: 2, role: "system" as const },
    { book: 1, content: "GAME_DEPTH_ONE", position: 2, depth: 1, role: "user" as const },
    { book: 2, content: "KEEPER_DEPTH_ZERO", position: 2, depth: 0, role: "assistant" as const },
    { book: 0, content: "UNPLACED_OUTLET", position: 7, outletName: "unused" },
  ];
  for (const [order, entry] of entries.entries()) {
    const { book, ...fields } = entry;
    await lorebooks.createEntry({
      lorebookId: books[book]!.id,
      name: entry.content.split(":")[0]!,
      constant: true,
      order,
      ...fields,
    });
  }
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    gameSystemPrompt: "GM_INSTRUCTIONS_MARKER",
    gameLorebookKeeperEnabled: true,
    gameLorebookKeeperLorebookId: books[2]!.id,
    // Chat-bound books also explicitly attached must still appear only once.
    activeLorebookIds: books.map((book) => book.id),
  });
  for (let index = 1; index <= 5; index++) {
    await chats.createMessage({
      chatId: chat.id,
      role: index % 2 ? "user" : "assistant",
      content: `HISTORY_${index}`,
    });
  }
  let regenerateMessageId: string | undefined;
  for (const strictRoleFormatting of [false, true]) {
    await chats.patchMetadata(chat.id, { chatParameters: { strictRoleFormatting } });
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, streaming: true, regenerateMessageId },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    const messages = requests.at(-1)!;
    const text = messages.map((message) => message.content).join("\n");
    for (const entry of entries.filter((entry) => entry.position !== 7)) {
      assert.equal(text.split(entry.content).length - 1, 1, `Keep ${entry.content} verbatim, exactly once`);
    }
    assert.ok(!text.includes("UNPLACED_OUTLET"), "Named outlets are not injected automatically");
    const containing = (content: string) => messages.find((message) => message.content.includes(content))!;
    // Default strict formatting folds mid-history system content into the prior
    // user turn; disabling it preserves the author's exact message role.
    assert.equal(containing("MANUAL_DEPTH_TWO").role, strictRoleFormatting ? "user" : "system");
    assert.equal(containing("GAME_DEPTH_ONE").role, "user");
    assert.equal(containing("KEEPER_DEPTH_ZERO").role, "assistant");
    const order = ["HISTORY_3", "MANUAL_DEPTH_TWO", "HISTORY_4", "GAME_DEPTH_ONE", "HISTORY_5", "KEEPER_DEPTH_ZERO"];
    for (let index = 1; index < order.length; index++) {
      assert.ok(text.indexOf(order[index - 1]!) < text.indexOf(order[index]!), "Depth stays relative to chat history");
    }
    const system = containing("GM_INSTRUCTIONS_MARKER");
    assert.equal(system.role, "system");
    assert.ok(system.content.indexOf("MANUAL_BEFORE") < system.content.indexOf("GM_INSTRUCTIONS_MARKER"));
    assert.ok(system.content.indexOf("KEEPER_BEFORE") < system.content.indexOf("GM_INSTRUCTIONS_MARKER"));
    assert.ok(system.content.indexOf("GAME_AFTER") > system.content.indexOf("GM_INSTRUCTIONS_MARKER"));
    regenerateMessageId = (await chats.listMessages(chat.id)).at(-1)!.id;
  }
  assert.equal(requests.length, 2, "One narrator call per normal generation/regeneration");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Game lore preserves before/after placement, depth roles, and one-copy inclusion across book sources.");
