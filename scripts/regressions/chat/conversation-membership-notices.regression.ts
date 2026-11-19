// Adding or removing a character in a started Conversation posts a "joined" or "left" notice in the chat. A Roleplay
// chat, or a Conversation still being set up, gets no notice. Drives the real chats routes on a fresh database in a
// temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-conversation-membership-notices-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });

try {
  const notices = async (chatId: string) =>
    (await chats.listMessages(chatId))
      .filter((message) => message.role === "system")
      .map((message) => {
        const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
        return [extra?.conversationMembershipEvent, extra?.characterId];
      });
  const chatWith = async (mode: "conversation" | "roleplay", started: boolean) => {
    const chat = await chats.create({ name: `${mode} chat`, mode, characterIds: ["char-a", "char-b"] });
    assert(chat);
    if (started) {
      const message = await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: "Hi." });
      assert(message);
    }
    return chat.id;
  };
  const swapB = (chatId: string) =>
    app.inject({ method: "PATCH", url: `/api/chats/${chatId}`, payload: { characterIds: ["char-a", "char-c"] } });

  const conversation = await chatWith("conversation", true);
  const changed = await swapB(conversation);
  assert.equal(changed.statusCode, 200, changed.body);
  assert.deepEqual(
    await notices(conversation),
    [
      ["joined", "char-c"],
      ["left", "char-b"],
    ],
    "a started Conversation posts who joined and who left",
  );

  for (const [label, chatId] of [
    ["a started Roleplay chat", await chatWith("roleplay", true)],
    ["a Conversation still being set up", await chatWith("conversation", false)],
  ] as const) {
    const response = await swapB(chatId);
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(await notices(chatId), [], `${label} gets no membership notice`);
  }
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
