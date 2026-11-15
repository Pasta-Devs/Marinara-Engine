import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-exclusivity-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const require = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage, withChatMetadataPatchQueue } =
  await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createAdvancedMemoryService } = await import("../../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRoutes } = await import("../../../packages/server/src/routes/advanced-memory.routes.js");
const { chatsRoutes } = await import("../../../packages/server/src/routes/chats.routes.js");
const { advancedMemoryRecords } = await import("../../../packages/server/src/db/schema/advanced-memory.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../../packages/shared/src/types/advanced-memory.ts");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const app = require("fastify")();
app.decorate("db", db);
await app.register(advancedMemoryRoutes, { prefix: "/api/chats" });
await app.register(chatsRoutes, { prefix: "/api/chats" });

try {
  const chat = await chats.create({ name: "Recall modes", mode: "roleplay", characterIds: ["alice"] });
  assert(chat);
  await chats.createMessagesBatch(chat.id, [{ role: "user", content: "Keep the original transcript." }]);
  const source = await chats.listMessages(chat.id);
  const timestamp = new Date().toISOString();
  await db.insert(advancedMemoryRecords).values({
    id: "preserved-archive",
    chatId: chat.id,
    sceneId: "preserved-scene",
    kind: "scene",
    status: "closed",
    startMessageId: source[0]!.id,
    endMessageId: source[0]!.id,
    messageIds: JSON.stringify([source[0]!.id]),
    audienceCharacterIds: "[]",
    content: "Keep the prepared memory.",
    title: "Original scene",
    sourceFingerprint: "fixture",
    dependencies: "[]",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const archive = await db.select().from(advancedMemoryRecords);
  const settings = { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true, knowledgeStarts: { alice: null } };
  const metadata = async () => JSON.parse((await chats.getById(chat.id))!.metadata as string);
  const patch = async (body: Record<string, unknown>, path = "metadata") => {
    const response = await app.inject({ method: "PATCH", url: `/api/chats/${chat.id}/${path}`, payload: body });
    assert.equal(response.statusCode, 200, response.body);
    return metadata();
  };

  // Whole-blob restore represents old saved chats that predate the exclusivity rule.
  const legacy = { enableMemoryRecall: true, advancedMemory: settings, unrelated: "preserve" };
  await chats.updateMetadata(chat.id, legacy);
  await patch({ unrelated: "edited" });
  assert.equal((await metadata()).enableMemoryRecall, true, "unrelated saves do not silently rewrite old settings");
  assert.deepEqual((await metadata()).advancedMemory, settings);
  await chats.patchMetadata(chat.id, (current) => ({ ...current, unrelated: "edited again" }));
  assert.equal((await metadata()).enableMemoryRecall, true, "unrelated updaters may carry unchanged legacy flags");
  assert.deepEqual((await metadata()).advancedMemory, settings);

  let saved = await patch({ enabled: true }, "advanced-memory/settings");
  assert.equal(saved.enableMemoryRecall, false, "explicitly re-enabling Advanced reconciles conflicting legacy flags");
  assert.deepEqual(saved.advancedMemory, settings);
  assert.equal(saved.unrelated, "edited again");

  saved = await patch({ enableMemoryRecall: true });
  assert.equal(saved.enableMemoryRecall, true);
  assert.deepEqual(saved.advancedMemory, { ...settings, enabled: false }, "normal recall preserves Advanced options");
  assert.equal(
    saved.metadataWriteOrdinals.enableMemoryRecall,
    saved.metadataWriteOrdinals.advancedMemory,
    "both mode changes belong to the same atomic metadata write",
  );

  saved = await patch({ enabled: true }, "advanced-memory/settings");
  assert.equal(saved.enableMemoryRecall, false);
  assert.equal(saved.advancedMemory.enabled, true);
  saved = await patch({ enabled: false }, "advanced-memory/settings");
  assert.equal(saved.enableMemoryRecall, false, "disabling a mode does not automatically enable the other");
  assert.equal(saved.advancedMemory.enabled, false);

  await chats.updateMetadata(chat.id, { advancedMemory: { ...settings, enabled: false } });
  saved = await patch({ enabled: true }, "advanced-memory/settings");
  assert.equal(saved.enableMemoryRecall, false, "Advanced also disables implicit scene-default normal recall");

  await chats.updateMetadata(chat.id, legacy);
  saved = await patch({ enableMemoryRecall: true });
  assert.equal(
    saved.advancedMemory.enabled,
    false,
    "explicit normal enable wins even when its legacy flag was already true",
  );

  saved = await patch({ enableMemoryRecall: true, advancedMemory: settings });
  assert.equal(saved.enableMemoryRecall, false, "an ambiguous bulk save retains the existing Advanced precedence");
  assert.equal(saved.advancedMemory.enabled, true);

  await chats.patchMetadataWithCharacterIds(chat.id, () => ({
    metadata: { enableMemoryRecall: true },
    characterIds: ["alice"],
  }));
  assert.equal(
    (await metadata()).advancedMemory.enabled,
    false,
    "the combined metadata save shares the same invariant",
  );
  const callerPatch = { advancedMemory: settings };
  await chats.patchMetadata(chat.id, callerPatch);
  assert.deepEqual(callerPatch, { advancedMemory: settings }, "normalization never mutates the caller's patch");
  await Promise.all([
    chats.patchMetadata(chat.id, { advancedMemory: settings }),
    chats.patchMetadata(chat.id, { enableMemoryRecall: true }),
  ]);
  saved = await metadata();
  assert.equal(saved.enableMemoryRecall, true, "queued normal enable takes effect last");
  assert.equal(saved.advancedMemory.enabled, false);
  await Promise.all([
    chats.patchMetadata(chat.id, { enableMemoryRecall: true }),
    chats.patchMetadata(chat.id, { advancedMemory: settings }),
  ]);
  saved = await metadata();
  assert.equal(saved.enableMemoryRecall, false, "queued Advanced enable takes effect last");
  assert.equal(saved.advancedMemory.enabled, true);

  let releaseQueue!: () => void;
  let signalQueue!: () => void;
  const queueEntered = new Promise<void>((resolve) => (signalQueue = resolve));
  const holdQueue = withChatMetadataPatchQueue(chat.id, async () => {
    signalQueue();
    await new Promise<void>((resolve) => (releaseQueue = resolve));
  });
  await queueEntered;
  const normalSave = chats.patchMetadata(chat.id, { enableMemoryRecall: true });
  const delayedSettings = createAdvancedMemoryService(db).updateSettings(chat.id, { retrieveMaxScenes: 2 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseQueue();
  await Promise.all([holdQueue, normalSave, delayedSettings]);
  saved = await metadata();
  assert.equal(saved.enableMemoryRecall, true, "a delayed options save must preserve a newer normal mode choice");
  assert.equal(saved.advancedMemory.enabled, false);
  assert.equal(saved.advancedMemory.retrieveMaxScenes, 2, "the independent option still saves");

  await chats.updateMetadata(chat.id, {
    enableMemoryRecall: false,
    advancedMemory: { ...settings, knowledgeStarts: { alice: "deleted-message" } },
  });
  saved = await patch({ enabled: false }, "advanced-memory/settings");
  assert.equal(saved.advancedMemory.enabled, false, "stale knowledge anchors cannot block recovery by disabling");
  assert.deepEqual(saved.advancedMemory.knowledgeStarts, { alice: "deleted-message" });
  const invalidEnable = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/advanced-memory/settings`,
    payload: { enabled: true },
  });
  assert.equal(invalidEnable.statusCode, 400, "re-enabling still validates missing knowledge anchors");
  await chats.updateMetadata(chat.id, {
    enableMemoryRecall: false,
    advancedMemory: { ...settings, narratorCharacterId: "removed-character" },
  });
  saved = await patch({ enabled: false }, "advanced-memory/settings");
  assert.equal(saved.advancedMemory.enabled, false, "a removed narrator cannot prevent disabling Advanced Memory");
  const invalidNarrator = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/advanced-memory/settings`,
    payload: { enabled: true },
  });
  assert.equal(invalidNarrator.statusCode, 400, "re-enabling still validates the narrator");
  assert.deepEqual(await chats.listMessages(chat.id), source, "mode switches preserve the transcript");
  assert.deepEqual(await db.select().from(advancedMemoryRecords), archive, "mode switches preserve prepared memory");

  const anchorChat = await chats.create({
    name: "Queued anchor validation",
    mode: "roleplay",
    characterIds: ["alice"],
  });
  assert(anchorChat);
  await chats.createMessagesBatch(anchorChat.id, [{ role: "user", content: "This anchor will be removed." }]);
  const [anchor] = await chats.listMessages(anchorChat.id);
  assert(anchor);
  let releaseAnchorQueue!: () => void;
  let signalAnchorQueue!: () => void;
  const anchorQueueEntered = new Promise<void>((resolve) => (signalAnchorQueue = resolve));
  const heldAnchorQueue = withChatMetadataPatchQueue(anchorChat.id, async () => {
    signalAnchorQueue();
    await new Promise<void>((resolve) => (releaseAnchorQueue = resolve));
  });
  await anchorQueueEntered;
  const queuedEnable = createAdvancedMemoryService(db).updateSettings(anchorChat.id, {
    enabled: true,
    knowledgeStarts: { alice: anchor.id },
  });
  const rejectedDeletedAnchor = assert.rejects(queuedEnable, /message that no longer exists/u);
  try {
    // Let the old pre-queue context read finish, while the metadata writer stays blocked.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await chats.removeMessages([anchor.id], anchorChat.id);
  } finally {
    releaseAnchorQueue();
  }
  await Promise.all([heldAnchorQueue, rejectedDeletedAnchor]);
  assert.equal((await createAdvancedMemoryService(db).status(anchorChat.id)).settings.enabled, false);
  console.info("Memory Recall mode exclusivity and disable recovery passed.");
} finally {
  await app.close();
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
