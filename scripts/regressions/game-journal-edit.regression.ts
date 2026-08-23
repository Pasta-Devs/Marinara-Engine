import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

const chat = await chats.create({ name: "Journal edit regression", mode: "game", characterIds: [] });
assert.ok(chat);

try {
  await chats.patchMetadata(chat.id, {
    gameJournal: {
      entries: [
        {
          timestamp: "2026-08-20T00:00:00.000Z",
          type: "event",
          title: "Old title",
          content: "Old content",
          sourceMessageId: "message-1",
        },
        {
          timestamp: "2026-08-20T01:00:00.000Z",
          type: "event",
          title: "Later title",
          content: "Later content",
          sourceMessageId: "message-2",
        },
      ],
      quests: [],
      locations: [],
      npcLog: [],
      inventoryLog: [],
    },
  });

  const response = await app.inject({
    method: "PUT",
    url: `/api/game/${chat.id}/journal/entries/0`,
    payload: { title: "Corrected title", content: "Corrected content" },
  });
  assert.equal(response.statusCode, 200, response.body);
  const entry = response.json().journal.entries[0];
  assert.equal(entry.title, "Corrected title");
  assert.equal(entry.content, "Corrected content");
  assert.equal(entry.sourceMessageId, "message-1", "editing text must preserve journal ownership metadata");

  const missing = await app.inject({
    method: "PUT",
    url: `/api/game/${chat.id}/journal/entries/2`,
    payload: { title: "Missing", content: "Missing" },
  });
  assert.equal(missing.statusCode, 404);

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/game/${chat.id}/journal/entries/0`,
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.deepEqual(
    deleted.json().journal.entries.map((remaining: { title: string; sourceMessageId?: string }) => ({
      title: remaining.title,
      sourceMessageId: remaining.sourceMessageId,
    })),
    [{ title: "Later title", sourceMessageId: "message-2" }],
  );

  const deletedLast = await app.inject({
    method: "DELETE",
    url: `/api/game/${chat.id}/journal/entries/0`,
  });
  assert.equal(deletedLast.statusCode, 200, deletedLast.body);
  assert.equal(deletedLast.json().journal.entries.length, 0);

  const missingDelete = await app.inject({
    method: "DELETE",
    url: `/api/game/${chat.id}/journal/entries/0`,
  });
  assert.equal(missingDelete.statusCode, 404);

  console.info("Game journal edit/delete regression passed.");
} finally {
  await chats.remove(chat.id).catch(() => {});
  await app.close();
  await closeDB();
}
