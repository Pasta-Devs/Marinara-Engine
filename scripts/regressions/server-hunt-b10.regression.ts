import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

// Server hunt batch 10 (routes/chats.routes.ts):
// 1. DELETE /chats/:id of an old scene chat must not clear the origin's pointer to a newer scene,
//    and the origin cleanup goes through the queued patchMetadata.
// 2. Bodyless POST/PATCH calls return 400, not a 500 from destructuring undefined.
// 3. A failure while copying messages into a branch removes the half-built branch and restores
//    the source groupId.
// 4. A concurrent change while combining summaries answers 409 (source assertion: needs an LLM call).
// 5. Manual summary backfill buckets days in the chat's time zone (source assertion: needs an LLM call).
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify");

const root = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b10-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

let db: any = null;
let app: any = null;
try {
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const schema = await import("../../packages/server/src/db/schema/index.js");
  const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
  const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
  db = await createFileNativeDB();
  const at = (minute: number) => new Date(Date.UTC(2026, 8, 1, 12, minute)).toISOString();
  const chatRow = (id: string, metadata: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    id,
    name: id,
    mode: "roleplay",
    characterIds: "[]",
    metadata: JSON.stringify(metadata),
    createdAt: at(0),
    updatedAt: at(0),
    ...extra,
  });
  await db
    .insert(schema.chats)
    .values([
      chatRow("origin", { activeSceneChatId: "scene-b", sceneBusyCharIds: ["char-b"], keepMe: 1 }),
      chatRow("scene-a", { sceneOriginChatId: "origin", sceneStatus: "concluded" }),
      chatRow("scene-b", { sceneOriginChatId: "origin", sceneStatus: "active" }),
      chatRow("branch-src", {}),
    ]);
  await db.insert(schema.messages).values([
    { id: "m1", chatId: "branch-src", role: "user", content: "hello", createdAt: at(1) },
    { id: "m2", chatId: "branch-src", role: "assistant", content: "hi", createdAt: at(2) },
  ]);

  app = Fastify({ logger: false });
  app.decorate("db", db);
  app.setErrorHandler(errorHandler);
  await app.register(chatsRoutes, { prefix: "/api/chats" });
  await app.ready();

  const originMeta = async () => {
    const row = (await db.select().from(schema.chats)).find((chat: any) => chat.id === "origin");
    return JSON.parse(row.metadata);
  };

  // 1. Deleting the old concluded scene leaves the pointer to the running scene alone.
  const delA = await app.inject({ method: "DELETE", url: "/api/chats/scene-a" });
  assert.ok(delA.statusCode < 300, `delete scene-a: ${delA.statusCode} ${delA.body}`);
  let meta = await originMeta();
  assert.equal(meta.activeSceneChatId, "scene-b", "deleting an old scene must not orphan the active scene");
  assert.deepEqual(meta.sceneBusyCharIds, ["char-b"]);
  // Deleting the active scene still clears the pointer and keeps unrelated metadata.
  const delB = await app.inject({ method: "DELETE", url: "/api/chats/scene-b" });
  assert.ok(delB.statusCode < 300, `delete scene-b: ${delB.statusCode} ${delB.body}`);
  meta = await originMeta();
  assert.equal(meta.activeSceneChatId, undefined);
  assert.equal(meta.sceneBusyCharIds, undefined);
  assert.equal(meta.keepMe, 1);

  // 2. Bodyless requests answer 400.
  const bodyless: Array<[string, string]> = [
    ["POST", "/api/chats/origin/connect"],
    ["PATCH", "/api/chats/origin/metadata"],
    ["POST", "/api/chats/origin/messages/bulk-delete"],
    ["PATCH", "/api/chats/branch-src/messages/m1"],
    ["PATCH", "/api/chats/origin/messages/bulk-hidden"],
    ["POST", "/api/chats/branch-src/messages/m1/swipes"],
    ["POST", "/api/chats/branch-src/messages/m1/swipes/bulk"],
    // Review note: active-swipe used to answer 200 null (and notify continuity) with no index.
    ["PUT", "/api/chats/branch-src/messages/m1/active-swipe"],
  ];
  for (const [method, url] of bodyless) {
    const res = await app.inject({ method, url });
    assert.equal(res.statusCode, 400, `${method} ${url} without a body: ${res.statusCode} ${res.body}`);
  }
  for (const index of [-1, 1.5, "0"]) {
    const res = await app.inject({
      method: "PUT",
      url: "/api/chats/branch-src/messages/m1/active-swipe",
      payload: { index },
    });
    assert.equal(res.statusCode, 400, `active-swipe with index ${JSON.stringify(index)}: ${res.statusCode}`);
  }

  // 4 and 5: source assertions (both paths need a live model call).
  const source = readFileSync(
    new URL("../../packages/server/src/routes/chats.routes.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    !source.includes('throw new Error("One or more selected summary entries changed while they were being combined")'),
    "combine conflict must not throw a plain Error (500)",
  );
  assert.match(source, /if \(combineConflict\) \{\s*return reply\s*\.status\(409\)/u);
  const backfill = source.slice(source.indexOf('"/:id/backfill-summaries"'));
  const call = backfill.slice(0, backfill.indexOf("maxMissingDays,\n") + 40);
  assert.match(call, /timeZone: resolveConversationTimeZone\(chatMeta\)/u, "backfill passes the chat time zone");

  console.log("server-hunt-b10 regression passed");
} finally {
  await app?.close?.().catch(() => undefined);
  await db?._fileStore?.close?.().catch(() => undefined);
  rmSync(root, { recursive: true, force: true });
}
