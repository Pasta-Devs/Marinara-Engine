import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The draft cleanup's discard (`/chats/:id/discard-unfinished-setup`): it checks and deletes in one transaction,
// never removes a draft kept for later or marked as having choices unless the player discards it on purpose, and
// counts trashed messages, memories and linked chats as something to keep.
const dir = mkdtempSync(join(tmpdir(), "marinara-unfinished-setup-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { chats: table, memoryChunks } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createMessageTrashStorage } =
  await import("../../packages/server/src/services/storage/message-trash.storage.js");
const db = await getDB();
const storage = createChatsStorage(db);

async function draft(mode: "conversation" | "roleplay" | "game" = "roleplay", metadata: Record<string, unknown> = {}) {
  const chat = await storage.create({ name: "New setup", mode, characterIds: [] });
  assert(chat);
  await db
    .update(table)
    .set({ metadata: JSON.stringify({ setupPending: true, ...metadata }) })
    .where(eq(table.id, chat.id));
  return chat.id;
}
const auto = { explicit: false };
const explicit = { explicit: true };

try {
  for (const mode of ["conversation", "roleplay", "game"] as const) {
    const id = await draft(mode);
    assert.equal(await storage.removeUnfinishedSetupChat(id, auto), "deleted", `${mode}: untouched draft removed`);
    assert.equal(await storage.getById(id), null);
    assert.equal(await storage.removeUnfinishedSetupChat(id, auto), "none", "repeat is harmless");
  }

  // Greetings don't count in a chat; anything in a game in setup does.
  const greeted = await draft();
  await storage.createMessage({ chatId: greeted, role: "assistant", content: "Hello" });
  assert.equal(await storage.removeUnfinishedSetupChat(greeted, auto), "deleted", "a greeting is not player input");
  const written = await draft();
  await storage.createMessage({ chatId: written, role: "user", content: "Hi" });
  assert.equal(await storage.removeUnfinishedSetupChat(written, auto), "kept");
  assert(await storage.getById(written));

  // Kept for later: never removed by cleanup, only by the player's own Discard.
  const later = await draft("roleplay", { setupPending: null, setupUnfinished: true });
  assert.equal(await storage.removeUnfinishedSetupChat(later, auto), "none", "kept-for-later survives cleanup");
  assert(await storage.getById(later));
  assert.equal(await storage.removeUnfinishedSetupChat(later, explicit), "deleted", "explicit discard removes it");

  // Marked as having choices (another window or device can't compare it): same rule.
  const chosen = await draft("roleplay", { setupHasInput: true });
  assert.equal(await storage.removeUnfinishedSetupChat(chosen, auto), "none");
  assert(await storage.getById(chosen));
  assert.equal(await storage.removeUnfinishedSetupChat(chosen, explicit), "deleted");

  // Not a draft at all.
  const plain = await storage.create({ name: "Chat", mode: "roleplay", characterIds: [] });
  assert(plain);
  assert.equal(await storage.removeUnfinishedSetupChat(plain.id, explicit), "none");
  assert(await storage.getById(plain.id));

  // A game that was built is kept.
  const built = await draft("game", { gameSessionStatus: "active" });
  assert.equal(await storage.removeUnfinishedSetupChat(built, explicit), "kept");

  // Durable content besides messages.
  const trashed = await draft();
  const message = await storage.createMessage({ chatId: trashed, role: "user", content: "Restorable" });
  assert(message);
  await createMessageTrashStorage(db).trashMessages(trashed, [message.id]);
  await storage.removeMessage(message.id);
  assert.equal(await storage.removeUnfinishedSetupChat(trashed, auto), "kept", "trashed messages are kept");
  const remembered = await draft();
  await db.insert(memoryChunks).values({
    id: "memory-1",
    chatId: remembered,
    content: "Imported memory",
    messageCount: 1,
    firstMessageAt: "2026-01-01T00:00:00.000Z",
    lastMessageAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(await storage.removeUnfinishedSetupChat(remembered, auto), "kept", "memories are kept");
  const linked = await draft();
  await db.update(table).set({ connectedChatId: "partner" }).where(eq(table.id, linked));
  assert.equal(await storage.removeUnfinishedSetupChat(linked, auto), "kept", "a linked chat is kept");

  // A message saved while the discard waits is seen, never deleted with the chat.
  const race = await draft();
  let started!: () => void;
  const saving = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = db.transaction(async () => {
    started();
    await gate;
    await storage.createMessage({ chatId: race, role: "user", content: "Saved before discard" });
  });
  await saving;
  const discard = storage.removeUnfinishedSetupChat(race, auto);
  release();
  await write;
  assert.equal(await discard, "kept", "queued discard sees the committed message");
  assert(await storage.getById(race));
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("unfinished-setup-discard regression passed");
