import assert from "node:assert/strict";
import { logger } from "../../../packages/server/src/lib/logger.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { chats, memoryChunks, messages } from "../../../packages/server/src/db/schema/index.js";
import { resolveMemoryRecallEmbeddingSource } from "../../../packages/server/src/services/memory-recall-embedding.js";
import {
  chunkAndEmbedMessages,
  embedMemoryRecallTexts,
  rebuildMemoryChunks,
} from "../../../packages/server/src/services/memory-recall.js";
import { createConnectionsStorage } from "../../../packages/server/src/services/storage/connections.storage.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-memory-revectorize-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();

try {
  const warnings: unknown[][] = [];
  const priorWarn = logger.warn;
  logger.warn = ((...args: unknown[]) => warnings.push(args)) as typeof logger.warn;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.deepEqual(await embedMemoryRecallTexts(["query"], { localEmbedder: async () => null }), []);
    }
    assert.equal(warnings.length, 1, "an unavailable local embedder warns only once");
    assert.match(String(warnings[0]![0]), /No embedder configured/);
    assert.deepEqual(await embedMemoryRecallTexts(["query"], { localEmbedder: async () => [] }), []);
    assert.equal(warnings.length, 2, "a malformed non-null result still reports its vector count");
    assert.match(String(warnings[1]![0]), /incomplete embedding results/);
  } finally {
    logger.warn = priorWarn;
  }
  const embeddingCalls: string[][] = [];
  const ordered = await embedMemoryRecallTexts(["א".repeat(70_000), "é".repeat(60_000), "third"], {
    embeddingSource: {
      spaceId: "test:batching",
      label: "batching",
      async embed(texts) {
        embeddingCalls.push(texts);
        return texts.map((text) => [text.length]);
      },
    },
  });
  assert.equal(embeddingCalls.length, 2, "large multilingual input is split into bounded provider requests");
  assert.ok(embeddingCalls.every((texts) => texts.reduce((total, text) => total + text.length, 0) <= 100_000));
  assert.deepEqual(
    ordered.map((vector) => vector[0]),
    [70_000, 60_000, 5],
    "vectors are flattened back into input order across embedding batches",
  );
  const countCalls: number[] = [];
  await embedMemoryRecallTexts(
    Array.from({ length: 65 }, (_, index) => `text-${index}`),
    {
      embeddingSource: {
        spaceId: "test:count-batching",
        label: "count-batching",
        async embed(texts) {
          countCalls.push(texts.length);
          return texts.map(() => [1]);
        },
      },
    },
  );
  assert.deepEqual(countCalls, [64, 1], "provider batches also respect the item-count limit");
  const responseAbortController = new AbortController();
  await assert.rejects(
    embedMemoryRecallTexts(["final response"], {
      signal: responseAbortController.signal,
      embeddingSource: {
        spaceId: "test:abort-final-response",
        label: "abort-final-response",
        async embed() {
          responseAbortController.abort(new DOMException("test abort", "AbortError"));
          return [[1]];
        },
      },
    }),
    /test abort/,
    "a cancellation delivered with the final provider response rejects returned vectors",
  );

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

  for (let index = 5; index < 35; index += 1) {
    await db.insert(messages).values({
      id: `large-message-${index}`,
      chatId: "chat-memory",
      role: "user",
      content: `Large multilingual memory ${index} ${"א".repeat(20_000)}`,
      createdAt: `2026-08-10T10:${String(index).padStart(2, "0")}:00.000Z`,
    });
  }
  let failedBatch = false;
  await assert.rejects(
    rebuildMemoryChunks(
      db,
      "chat-memory",
      { userName: "User", characterNames: {} },
      {
        embeddingSource: {
          spaceId: "test:failed-revectorize",
          label: "failed-revectorize",
          async embed(texts) {
            if (failedBatch) return null;
            failedBatch = true;
            return texts.map(() => Array.from({ length: 768 }, () => 0.75));
          },
        },
      },
    ),
    /Memory rebuild failed/,
  );
  const preserved = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  assert.equal(preserved.length, 1, "partial re-vectorization preserves the previous index");
  assert.equal(JSON.parse(preserved[0]!.embedding ?? "[]").length, 768);
  assert.equal(preserved[0]!.embeddingSpaceId, "test:new-768:plain-v1");

  const originalRows = preserved.map(({ id, content, embedding, embeddingSpaceId }) => ({
    id,
    content,
    embedding,
    embeddingSpaceId,
  }));
  const controller = new AbortController();
  await assert.rejects(
    rebuildMemoryChunks(
      db,
      "chat-memory",
      { userName: "User", characterNames: {} },
      {
        signal: controller.signal,
        embeddingSource: {
          spaceId: "test:abort-final",
          label: "abort-final",
          async embed(texts) {
            controller.abort(new DOMException("test abort", "AbortError"));
            return texts.map(() => Array.from({ length: 768 }, () => 0.25));
          },
        },
      },
    ),
    /abort/i,
  );
  const afterAbort = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  assert.deepEqual(
    afterAbort.map(({ id, content, embedding, embeddingSpaceId }) => ({ id, content, embedding, embeddingSpaceId })),
    originalRows,
    "aborting during the final provider call leaves the prior native index intact",
  );

  const transactionFailingDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction") return Reflect.get(target, property, receiver);
      return (work: (tx: typeof db) => Promise<unknown>) =>
        target.transaction((tx) =>
          work(
            new Proxy(tx, {
              get(txTarget, txProperty, txReceiver) {
                if (txProperty === "insert")
                  return () => ({
                    values: async () => {
                      throw new Error("injected insert failure");
                    },
                  });
                return Reflect.get(txTarget, txProperty, txReceiver);
              },
            }) as typeof db,
          ),
        );
    },
  });
  await assert.rejects(
    rebuildMemoryChunks(
      transactionFailingDb,
      "chat-memory",
      { userName: "User", characterNames: {} },
      {
        embeddingSource: {
          spaceId: "test:insert-failure",
          label: "insert-failure",
          async embed(texts) {
            return texts.map(() => Array.from({ length: 768 }, () => 0.5));
          },
        },
      },
    ),
    /injected insert failure/,
  );
  const afterInsertFailure = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  assert.deepEqual(
    afterInsertFailure.map(({ id, content, embedding, embeddingSpaceId }) => ({
      id,
      content,
      embedding,
      embeddingSpaceId,
    })),
    originalRows,
    "a replacement insert failure rolls back deletion of the old index",
  );

  await db.insert(memoryChunks).values({
    id: "imported-memory",
    chatId: "chat-memory",
    sourceChatId: "source-chat",
    content: "Imported memory survives native rebuild",
    embedding: JSON.stringify(Array.from({ length: 768 }, () => 0.1)),
    embeddingSpaceId: "test:imported",
    messageCount: 1,
    firstMessageAt: "2026-08-10T10:00:00.000Z",
    lastMessageAt: "2026-08-10T10:00:00.000Z",
    createdAt: "2026-08-10T10:00:00.000Z",
  });
  const emptyRebuildCount = await rebuildMemoryChunks(
    db,
    "chat-memory",
    { userName: "User", characterNames: {} },
    {
      readBehindMessageCount: 100,
      embeddingSource: {
        spaceId: "test:empty",
        label: "empty",
        async embed() {
          throw new Error("must not embed an empty rebuild");
        },
      },
    },
  );
  assert.equal(emptyRebuildCount, 0, "an empty native rebuild reports zero rebuilt native rows");
  const afterEmptyRebuild = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  assert.deepEqual(
    afterEmptyRebuild.map((row) => row.id),
    ["imported-memory"],
    "empty rebuild preserves imported rows",
  );

  await rebuildMemoryChunks(
    db,
    "chat-memory",
    { userName: "User", characterNames: {} },
    {
      embeddingSource: {
        spaceId: "test:restore-native",
        label: "restore-native",
        async embed(texts) {
          return texts.map(() => Array.from({ length: 768 }, () => 0.75));
        },
      },
    },
  );
  const beforeWriteAbort = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  const writeAbortController = new AbortController();
  const abortingInsertDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction") return Reflect.get(target, property, receiver);
      return (work: (tx: typeof db) => Promise<unknown>) =>
        target.transaction((tx) =>
          work(
            new Proxy(tx, {
              get(txTarget, txProperty, txReceiver) {
                if (txProperty !== "insert") return Reflect.get(txTarget, txProperty, txReceiver);
                return (table: typeof memoryChunks) => {
                  const builder = txTarget.insert(table);
                  return {
                    values: async (rows: Array<typeof memoryChunks.$inferInsert>) => {
                      const result = await builder.values(rows);
                      writeAbortController.abort(new DOMException("abort during transaction write", "AbortError"));
                      return result;
                    },
                  };
                };
              },
            }) as typeof db,
          ),
        );
    },
  });
  await assert.rejects(
    rebuildMemoryChunks(
      abortingInsertDb,
      "chat-memory",
      { userName: "User", characterNames: {} },
      {
        signal: writeAbortController.signal,
        embeddingSource: {
          spaceId: "test:abort-write",
          label: "abort-write",
          async embed(texts) {
            return texts.map(() => Array.from({ length: 768 }, () => 0.5));
          },
        },
      },
    ),
    /abort during transaction write/,
  );
  const afterWriteAbort = await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, "chat-memory"));
  assert.deepEqual(
    afterWriteAbort,
    beforeWriteAbort,
    "aborting during replacement insert rolls back native deletion and preserves imported rows",
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
