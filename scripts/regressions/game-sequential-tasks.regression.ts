import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dir = mkdtempSync(join(tmpdir(), "marinara-game-sequential-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { registerSequentialGameTasks, retainSequentialGameTask } =
  await import("../../packages/server/src/services/game/sequential-tasks.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
const delay = () => new Promise<void>((done) => setTimeout(done, 30));
let active = 0;
let peak = 0;
let mediaDone = true;
let releaseMedia = () => {};
await app.register(
  async (scope) => {
    registerSequentialGameTasks(scope, ["/narrate", "/media"]);
    scope.post("/narrate", async () => {
      active++;
      peak = Math.max(peak, active);
      assert.ok(mediaDone, "Narration must wait for background media to finish");
      await delay();
      active--;
      return { ok: true };
    });
    scope.post("/media", async (request) => {
      mediaDone = false;
      retainSequentialGameTask(
        request,
        new Promise<void>((done) => {
          releaseMedia = () => {
            mediaDone = true;
            done();
          };
        }),
      );
      return { queued: true };
    });
    scope.post("/cancel", async () => ({ available: true }));
  },
  { prefix: "/api/game" },
);
try {
  const chat = await chats.create({ name: "Sequential Game", mode: "game", characterIds: [] });
  assert.ok(chat);
  const post = (path: string) => app.inject({ method: "POST", url: `/api/game/${path}`, payload: { chatId: chat.id } });
  for (const sequential of [false, true]) {
    await chats.patchMetadata(chat.id, () => ({ gameSequentialAgents: sequential }));
    peak = 0;
    const results = await Promise.all([post("narrate"), post("narrate"), post("narrate")]);
    assert.ok(results.every((result) => result.statusCode === 200));
    assert.equal(peak, sequential ? 1 : 3, "Only opted-in Game chats serialize concurrent requests");
  }
  const queued = await post("media");
  assert.equal(queued.json().queued, true, "Initial storyboard reply must not wait for rendering");
  let narrated = false;
  const narration = post("narrate").then(() => {
    narrated = true;
  });
  await delay();
  assert.equal(narrated, false);
  assert.equal((await post("cancel")).json().available, true, "Cancellation must bypass the model queue");
  releaseMedia();
  await narration;
  assert.equal(narrated, true);
  console.log("Game opt-in queue, concurrent default, background handoff and cancellation bypass passed.");
} finally {
  releaseMedia();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
