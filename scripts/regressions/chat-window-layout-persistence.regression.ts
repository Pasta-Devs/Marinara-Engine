// Moving windows or dismissing their hint must not make an old chat the most recently updated chat.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-window-layout-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });

try {
  const chats = createChatsStorage(db);
  const originalTime = "2020-01-01T00:00:00.000Z";
  const chat = await chats.create(
    {
      name: "Old chat",
      mode: "roleplay",
      characterIds: [],
      personaId: null,
      promptPresetId: null,
      connectionId: null,
      groupId: null,
    },
    { createdAt: originalTime, updatedAt: originalTime },
  );
  assert.ok(chat);
  const layout = {
    version: 1,
    windows: { "chat-settings": { x: 20, y: 80, width: 400, height: 500, pinned: true, locked: false } },
  };
  const patch = (metadata: Record<string, unknown>) =>
    app.inject({ method: "PATCH", url: `/api/chats/${chat.id}/metadata`, payload: metadata });

  for (const windowLayout of [layout, { ...layout, detached: ["drawer:chat-settings:chat-name"] }, null]) {
    const response = await patch({ windowLayout });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().updatedAt, originalTime, "saving or resetting a layout preserves response recency");
    const stored = await chats.getById(chat.id);
    assert.equal(stored?.updatedAt, originalTime, "saving or resetting a layout preserves stored recency");
    assert.deepEqual(JSON.parse(stored!.metadata).windowLayout, windowLayout, "the view change still persists");
  }

  for (const viewUpdate of [
    { chatSettingsHintDismissed: true },
    { chatSettingsHintDismissed: false },
    { windowLayout: layout, chatSettingsHintDismissed: true },
  ]) {
    const response = await patch(viewUpdate);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().updatedAt, originalTime, "hint and layout preferences preserve response recency");
    const stored = await chats.getById(chat.id);
    assert.equal(stored?.updatedAt, originalTime, "hint and layout preferences preserve stored recency");
    const metadata = JSON.parse(stored!.metadata);
    for (const [key, value] of Object.entries(viewUpdate)) assert.deepEqual(metadata[key], value);
  }

  const mixed = await patch({
    windowLayout: layout,
    chatSettingsHintDismissed: false,
    authorNote: "The scene moves to the garden.",
  });
  assert.equal(mixed.statusCode, 200);
  assert.notEqual(mixed.json().updatedAt, originalTime, "a patch changing chat content still updates recency");
  assert.equal((await chats.getById(chat.id))?.updatedAt, mixed.json().updatedAt);
  console.info("Chat window layout persistence regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
