import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { chats, memoryChunks, messages } from "../../packages/server/src/db/schema/index.js";
import { resolveMemoryRecallEmbeddingSource } from "../../packages/server/src/services/memory-recall-embedding.js";
import { chunkAndEmbedMessages, rebuildMemoryChunks } from "../../packages/server/src/services/memory-recall.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-memory-revectorize-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();

try {
  await db.insert(chats).values({ id: "chat-memory", name: "Memory", mode: "conversation" });
  for (let index = 0; index < 5; index += 1) {
    await db.insert(messages).values({
      id: `message-${index}`,
      chatId: "chat-memory",
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Memory turn ${index}`,
      createdAt: `2026-08-10T10:00:0${index}.000Z`,
    });
  }

  let releaseOldEmbedding!: () => void;
  const oldEmbeddingReleased = new Promise<void>((resolve) => {
    releaseOldEmbedding = resolve;
  });
  let notifyOldEmbeddingStarted!: () => void;
  const oldEmbeddingStarted = new Promise<void>((resolve) => {
    notifyOldEmbeddingStarted = resolve;
  });
  let newEmbeddingStarted = false;

  const backgroundChunk = chunkAndEmbedMessages(
    db,
    "chat-memory",
    { userName: "User", characterNames: {} },
    {
      embeddingSource: {
        spaceId: "test:old-384:plain-v1",
        label: "old-384",
        async embed(texts) {
          notifyOldEmbeddingStarted();
          await oldEmbeddingReleased;
          return texts.map(() => Array.from({ length: 384 }, () => 0.25));
        },
      },
    },
  );
  await oldEmbeddingStarted;

  const rebuild = rebuildMemoryChunks(
    db,
    "chat-memory",
    { userName: "User", characterNames: {} },
    {
      embeddingSource: {
        spaceId: "test:new-768:plain-v1",
        label: "new-768",
        async embed(texts) {
          newEmbeddingStarted = true;
          return texts.map(() => Array.from({ length: 768 }, () => 0.5));
        },
      },
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(newEmbeddingStarted, false, "re-vectorization waits for in-flight background chunking on the same chat");
  releaseOldEmbedding();
  await Promise.all([backgroundChunk, rebuild]);

  const stored = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  assert.equal(stored.length, 1, "re-vectorization replaces the prior native chunk exactly once");
  assert.equal(JSON.parse(stored[0]!.embedding ?? "[]").length, 768, "only vectors from the new model remain");
  assert.equal(
    stored[0]!.embeddingSpaceId,
    "test:new-768:plain-v1",
    "rebuilt memory chunks persist the active provider/model/profile identity",
  );

  const connections = createConnectionsStorage(db);
  const connectionDefaults = {
    provider: "openai" as const,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "test-key",
    model: "gpt-5-mini",
    imagePath: null,
    maxContext: 128_000,
    isDefault: false,
    fallbackForMain: false,
    useForRandom: true,
    defaultForAgents: false,
    fallbackForAgents: false,
    enableCaching: false,
    anthropicExtendedCacheTtl: false,
    cachingAtDepth: 5,
    embeddingBaseUrl: "",
    embeddingConnectionId: null,
    openrouterProvider: null,
    imageGenerationSource: null,
    comfyuiWorkflow: null,
    imageService: null,
    imageEndpointId: null,
    imagePromptInstructions: null,
    imageGenerationQuality: "auto" as const,
    videoGenerationSource: null,
    videoService: null,
    promptPresetId: null,
    maxTokensOverride: null,
    maxParallelJobs: 1,
    treatAsLocalEndpoint: false,
    claudeFastMode: false,
  };
  await connections.create({ ...connectionDefaults, name: "Random without embeddings", embeddingModel: "" });
  const firstEligible = await connections.create({
    ...connectionDefaults,
    name: "Random embeddings A",
    embeddingModel: "text-embedding-3-small",
  });
  const secondEligible = await connections.create({
    ...connectionDefaults,
    name: "Random embeddings B",
    embeddingModel: "text-embedding-3-small",
  });
  assert.ok(firstEligible && secondEligible, "the deterministic random-pool fixture creates two eligible sources");
  const expectedSource = [firstEligible, secondEligible].sort((a, b) => a.id.localeCompare(b.id))[0]!;

  const randomPoolSource = await resolveMemoryRecallEmbeddingSource(db, { connectionId: "random" });
  assert.match(
    randomPoolSource?.label ?? "",
    new RegExp(`${expectedSource.name} \\(text-embedding-3-small\\)`, "u"),
    "random chats deterministically resolve the first embedding-capable pool member by ID",
  );
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}

console.log("Memory Recall re-vectorization regression checks passed.");
