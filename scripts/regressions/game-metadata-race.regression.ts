// #5076 regression: POST /game/time/advance and POST /game/weather/update must write their metadata
// through the per-chat metadata patch queue (chats.patchMetadata), not via a whole-blob
// chats.updateMetadata that reads the metadata, mutates one key, and writes the ENTIRE blob back
// outside the queue. The whole-blob path silently reverts any concurrent metadata write that lands in
// between — most damagingly a World Maps definition `revision` bump, after which every map move fails
// validation as spatial_transition_stale_definition (a permanent, silent movement lock).
//
// The race itself is timing-dependent, but the *fix* has a deterministic, non-flaky signature: because
// patchMetadata serializes on the per-chat queue, holding that queue open blocks the handler's write.
// The old updateMetadata bypassed the queue entirely, so its write would already be visible while the
// queue is held. We assert the handler is queue-serialized (blocked), which fails on the pre-fix code.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import {
  createChatsStorage,
  withChatMetadataPatchQueue,
} from "../../packages/server/src/services/storage/chats.storage.js";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const createdChatIds: string[] = [];

const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const readMeta = async (chatId: string): Promise<Record<string, unknown>> => {
  const chat = await chats.getById(chatId);
  assert.ok(chat, "seeded chat exists");
  return JSON.parse(chat.metadata) as Record<string, unknown>;
};

async function seedGameChat(): Promise<string> {
  const chat = await chats.create({ name: "Metadata race regression", mode: "game", characterIds: [] });
  assert.ok(chat, "game chat created");
  createdChatIds.push(chat.id);
  // Seed a probe key standing in for an unrelated concurrent metadata owner (e.g. a World Maps
  // definition). Written through the queue like any real writer.
  await chats.patchMetadata(chat.id, { worldMapProbe: "v0" });
  return chat.id;
}

// Hold the chat's metadata queue open, fire `inject`, and assert the handler has NOT yet written
// `key` (it is queued behind the gate). Then release, let a concurrent patch land, and assert the
// concurrent write survives (the handler merged a narrow patch instead of clobbering the blob).
async function assertQueueSerialized(
  chatId: string,
  key: "gameTime" | "gameWeather",
  inject: () => Promise<{ statusCode: number; body: string }>,
) {
  let releaseGate!: () => void;
  const gate = new Promise<void>((resolve) => (releaseGate = resolve));
  const gateHold = withChatMetadataPatchQueue(chatId, async () => {
    await gate;
  });

  // Fire WITHOUT awaiting: the handler reads metadata (unqueued) then must enqueue its write.
  const responsePromise = inject();
  // Ample time for the pre-fix direct write to have landed; the fixed handler stays blocked.
  await tick(50);
  assert.ok(
    !(key in (await readMeta(chatId))),
    `${key}: the handler must serialize its write through the metadata queue (blocked while the queue is held); the old whole-blob updateMetadata bypassed the queue and would have written already`,
  );

  // A concurrent metadata write lands during the (held) window.
  const concurrentPatch = chats.patchMetadata(chatId, { worldMapProbe: "v1" });

  releaseGate();
  await gateHold;
  const res = await responsePromise;
  await concurrentPatch;

  assert.equal(res.statusCode, 200, `${key}: handler should succeed: ${res.statusCode} ${res.body}`);
  const finalMeta = await readMeta(chatId);
  assert.ok(finalMeta[key], `${key}: written after the queue drained`);
  assert.equal(
    finalMeta.worldMapProbe,
    "v1",
    `${key}: the concurrent metadata write survived — the handler merged a narrow patch instead of clobbering the blob`,
  );
}

try {
  // POST /game/time/advance
  {
    const chatId = await seedGameChat();
    await assertQueueSerialized(chatId, "gameTime", () =>
      app.inject({ method: "POST", url: "/api/game/time/advance", payload: { chatId, action: "rest" } }),
    );
  }

  // POST /game/weather/update (the "set" branch is the deterministic write path)
  {
    const chatId = await seedGameChat();
    await assertQueueSerialized(chatId, "gameWeather", () =>
      app.inject({
        method: "POST",
        url: "/api/game/weather/update",
        payload: { chatId, action: "set", type: "rain", location: "forest", season: "summer" },
      }),
    );
  }

  console.log("Game metadata race regression checks passed.");
} finally {
  // Don't leave seeded chats behind across repeated runs.
  for (const id of createdChatIds) await chats.remove(id).catch(() => {});
  await app.close();
  await closeDB();
}
