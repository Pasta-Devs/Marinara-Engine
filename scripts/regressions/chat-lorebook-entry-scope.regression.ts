import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-chat-lore-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const db = await getDB();
const chats = createChatsStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  const book = await lorebooks.create({ name: "Shared lore" });
  const entry = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Dockmaster",
    content: "Runs the docks",
    keys: ["dock"],
  });
  const other = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Innkeeper",
    content: "Runs the inn",
    keys: ["inn"],
  });
  const a = await chats.create({ name: "First game", mode: "game", characterIds: [] });
  const b = await chats.create({ name: "Second game", mode: "game", characterIds: [] });
  assert.ok(a && b && entry && other);
  await chats.patchMetadata(a.id, {
    entryStateOverrides: { [entry.id]: { ephemeral: 3 }, [other.id]: { enabled: false, ephemeral: 2 } },
  });
  const patch = (entryId: string, enabled: unknown, chatId = a.id) =>
    app.inject({ method: "PATCH", url: `/api/chats/${chatId}/lorebook-entries/${entryId}`, payload: { enabled } });
  const disabled = await patch(entry.id, false);
  assert.equal(disabled.statusCode, 200, disabled.body);
  const overrides = () => chats.getById(a.id).then((chat) => JSON.parse(chat!.metadata).entryStateOverrides);
  assert.deepEqual(await overrides(), {
    [entry.id]: { ephemeral: 3, enabled: false },
    [other.id]: { ephemeral: 2, enabled: false },
  });
  assert.equal((await lorebooks.getEntry(entry.id))?.enabled, true, "global entry remains enabled");
  assert.equal(
    JSON.parse((await chats.getById(b.id))!.metadata).entryStateOverrides,
    undefined,
    "second chat is untouched",
  );
  assert.equal((await patch(entry.id, true)).statusCode, 200);
  assert.deepEqual((await overrides())[entry.id], { ephemeral: 3, enabled: true });
  await Promise.all([patch(entry.id, false), patch(other.id, true)]);
  assert.deepEqual(await overrides(), {
    [entry.id]: { ephemeral: 3, enabled: false },
    [other.id]: { ephemeral: 2, enabled: true },
  });
  assert.equal((await patch("missing", true)).statusCode, 404);
  assert.equal((await patch(entry.id, true, "missing")).statusCode, 404);
  assert.equal((await patch(entry.id, "false")).statusCode, 400);
  await lorebooks.updateEntry(entry.id, { enabled: false });
  assert.equal((await patch(entry.id, true)).statusCode, 409, "a chat cannot enable a globally disabled entry");
  assert.equal((await lorebooks.getEntry(entry.id))?.enabled, false);
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Chat lorebook toggles preserve global entries, other chats, and ephemeral state.");
