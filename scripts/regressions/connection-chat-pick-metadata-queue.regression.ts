// Moving a Model to another service and removing an unstarred Model rewrite chats' model picks. A chat metadata patch
// that read the chat before that rewrite must not write its stale copy over it: the rewrite waits for the patch.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-pick-queue-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, chats } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { readChatModelOverride } = await import("../../packages/shared/src/index.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const connections = createConnectionsStorage(db);
const chatStore = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
const chatOf = async (id: string) => (await db.select().from(chats).where(eq(chats.id, id)))[0]!;
const addAccount = async (payload: Record<string, unknown>) => {
  const created = await app.inject({ method: "POST", url: "/accounts", payload: { model: "", ...payload } });
  assert.equal(created.statusCode, 201, created.body);
  return { id: created.json().account.id as string, row: created.json().connectionId as string };
};
const addChat = async (id: string, connectionId: string, metadata: Record<string, unknown>) => {
  const stamp = new Date().toISOString();
  await db.insert(chats).values({
    id,
    name: id,
    mode: "conversation",
    connectionId,
    metadata: JSON.stringify(metadata),
    createdAt: stamp,
    updatedAt: stamp,
  } as never);
};
/** Runs `rewrite` while a metadata patch of the chat has read it and not yet written. */
const duringPatch = async (chatId: string, rewrite: () => Promise<unknown>) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let read!: () => void;
  const hasRead = new Promise<void>((resolve) => (read = resolve));
  const patch = chatStore.patchMetadata(chatId, async () => {
    read();
    await gate;
    return { note: "kept" };
  });
  await hasRead;
  const rewritten = rewrite();
  // Unheld, the rewrite commits here; held, it waits for the patch.
  await Promise.race([rewritten, new Promise((resolve) => setTimeout(resolve, 300))]);
  release();
  await patch;
  return rewritten;
};

try {
  const anthropic = await addAccount({ provider: "anthropic", apiKey: "fixture-anthropic-key-8888" });
  const router = await addAccount({ provider: "openrouter", apiKey: "fixture-router-key-9999" });
  assert(
    await connections.saveModelListIfUnchanged(await rowOf(router.row), [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
    ]),
  );
  const create = async (model: string) =>
    (await connections.create({ name: model, provider: "anthropic", model, accountId: anthropic.id } as never))!;

  // A move to another service turns the chat's pick of the old model into the new one.
  const traveller = await create("claude-sonnet-4-5");
  await addChat("chat-move", traveller.id, {
    modelOverride: { connectionId: traveller.id, model: "claude-sonnet-4-5" },
  });
  const moved = await duringPatch("chat-move", () =>
    connections.moveToAccount(traveller.id, router.id, "anthropic/claude-sonnet-4.5"),
  );
  assert.equal(typeof moved, "object", `the move succeeds: ${String(moved)}`);
  const afterMove = await chatOf("chat-move");
  assert.equal(readChatModelOverride(afterMove)?.model, "anthropic/claude-sonnet-4.5", "the rewritten pick stays");
  assert.equal(JSON.parse(afterMove.metadata).note, "kept", "the patch is kept as well");

  // Removing an unstarred Model moves the chat's pick onto another Model of its Connection.
  const unstarred = await create("claude-opus-4-1");
  const carrier = await create("claude-haiku-4-5");
  await addChat("chat-remove", unstarred.id, {});
  await duringPatch("chat-remove", () => connections.remove(unstarred.id, true));
  const afterRemove = await chatOf("chat-remove");
  assert.equal(afterRemove.connectionId, carrier.id);
  assert.equal(readChatModelOverride(afterRemove)?.model, "claude-opus-4-1", "the chat keeps the removed Model's pick");
  assert.equal(JSON.parse(afterRemove.metadata).note, "kept");
  console.log("connection-chat-pick-metadata-queue: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
