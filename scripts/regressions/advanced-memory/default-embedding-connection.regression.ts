import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY } from "../../../packages/shared/src/types/connection.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { resolveMemoryRecallEmbeddingSource } from "../../../packages/server/src/services/memory-recall-embedding.js";
import { createAppSettingsStorage } from "../../../packages/server/src/services/storage/app-settings.storage.js";
import { createConnectionsStorage } from "../../../packages/server/src/services/storage/connections.storage.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-default-embedding-"));
process.env.FILE_STORAGE_DIR = dir;
const db = await createFileNativeDB();

try {
  const connections = createConnectionsStorage(db);
  const settings = createAppSettingsStorage(db);
  const base = {
    provider: "openai" as const,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "test-key",
    model: "gpt-5-mini",
    imagePath: null,
    maxContext: 128_000,
    isDefault: false,
    fallbackForMain: false,
    useForRandom: false,
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
  const plain = await connections.create({ ...base, name: "Plain", embeddingModel: "" });
  const own = await connections.create({ ...base, name: "Own", embeddingModel: "own-embed" });
  const embedder = await connections.create({
    ...base,
    name: "Embedder",
    baseUrl: "http://localhost:5001/v1",
    embeddingModel: "default-embed",
  });
  const borrower = await connections.create({
    ...base,
    name: "Borrower",
    embeddingModel: "",
    embeddingConnectionId: own!.id,
  });
  assert.ok(plain && own && embedder && borrower, "fixture connections are created");

  const labelFor = async (options: Parameters<typeof resolveMemoryRecallEmbeddingSource>[1]) =>
    (await resolveMemoryRecallEmbeddingSource(db, options))?.label ?? null;

  assert.equal(await labelFor({ connectionId: plain.id }), null, "without a default nothing changes");

  await settings.set(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY, embedder.id);
  assert.equal(
    await labelFor({ connectionId: plain.id }),
    "Embedder (default-embed)",
    "a connection without embedding settings uses the default",
  );
  assert.equal(await labelFor({ connectionId: own.id }), "Own (own-embed)", "a connection's own model wins");
  assert.equal(
    await labelFor({ connectionId: borrower.id }),
    "Own (own-embed)",
    "a connection's own Embedding Connection wins",
  );
  assert.equal(
    await labelFor({ connectionId: plain.id, chatMetadata: { embeddingConnectionId: own.id } }),
    "Own (own-embed)",
    "a chat's embedding override wins",
  );
  assert.equal(
    await labelFor({}),
    "Embedder (default-embed)",
    "with no connection and no Main default, the default still applies",
  );
  assert.equal(
    await labelFor({ chatMetadata: { embeddingConnectionId: own.id } }),
    "Own (own-embed)",
    "with no connection, a chat's embedding override still wins over the default",
  );
  assert.equal(
    await labelFor({ connectionId: "random", chatMetadata: { embeddingConnectionId: own.id } }),
    "Own (own-embed)",
    "an empty random pool keeps the chat's embedding override",
  );
  assert.equal(
    (await resolveMemoryRecallEmbeddingSource(db, { connectionId: plain.id }))?.spaceId,
    (await resolveMemoryRecallEmbeddingSource(db, { connectionId: embedder.id }))?.spaceId,
    "the default shares the vector space of its own connection",
  );

  await connections.update(own.id, { useForRandom: true });
  await connections.update(plain.id, { useForRandom: true });
  assert.equal(
    await labelFor({ connectionId: "random" }),
    "Own (own-embed)",
    "a random pool member with its own model is not shadowed by the default",
  );
  await connections.update(own.id, { useForRandom: false });
  assert.equal(
    await labelFor({ connectionId: "random" }),
    "Embedder (default-embed)",
    "a random pool without embeddings uses the default",
  );

  await connections.remove(embedder.id);
  assert.equal(
    await settings.get(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY),
    null,
    "deleting the default connection clears the default",
  );
  assert.equal(await labelFor({ connectionId: plain.id }), null, "and resolution falls back as before");
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}

console.log("Default embedding connection regression checks passed.");
