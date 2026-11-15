import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createConnectionSchema } from "../../../packages/shared/src/schemas/connection.schema.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { lorebooksRoutes } from "../../../packages/server/src/routes/lorebooks.routes.js";
import { resolveMemoryRecallEmbeddingSource } from "../../../packages/server/src/services/memory-recall-embedding.js";
import { createConnectionsStorage } from "../../../packages/server/src/services/storage/connections.storage.js";

// Run through scripts/run-regressions.mjs for isolated storage. Exercise the real
// route and HTTP embedding adapter against a provider that accepts at most ten texts.
const batches: string[][] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const { input } = JSON.parse(Buffer.concat(chunks).toString()) as { input: string[] };
  batches.push(input);
  response.writeHead(input.length > 10 ? 413 : 200, { "content-type": "application/json" });
  response.end(
    JSON.stringify(
      input.length > 10
        ? { error: { message: "Too many texts for this embedding provider" } }
        : { data: input.map((text, index) => ({ index, embedding: [Number(text.match(/Entry (\d+)/)?.[1]), 1] })) },
    ),
  );
});
// A second provider standing in for a connection's Embedding Connection override (#7628).
const overrideBatches: string[][] = [];
const overrideProvider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const { input } = JSON.parse(Buffer.concat(chunks).toString()) as { input: string[] };
  overrideBatches.push(input);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [index, 2] })) }));
});
const db = await createFileNativeDB();
const Fastify = createRequire(new URL("../../../packages/server/package.json", import.meta.url))("fastify");
const app = Fastify();
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  await new Promise<void>((resolve) => overrideProvider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  const overrideAddress = overrideProvider.address();
  assert.ok(address && typeof address === "object");
  assert.ok(overrideAddress && typeof overrideAddress === "object");
  const connections = createConnectionsStorage(db);
  const connection = await connections.create(
    createConnectionSchema.parse({
      name: "Small embedding provider",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "fixture",
      model: "fixture",
      embeddingModel: "fixture",
      treatAsLocalEndpoint: true,
    }),
  );
  app.decorate("db", db);
  await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  const request = async (method: string, url: string, payload?: unknown) => {
    const response = await app.inject({ method, url, payload });
    assert.equal(response.statusCode, 200, `${method} ${url}: ${response.body}`);
    return response.json();
  };
  const book = await request("POST", "/api/lorebooks", { name: "Batch proof", excludeFromVectorization: false });
  await request("POST", `/api/lorebooks/${book.id}/entries/bulk`, {
    entries: Array.from({ length: 22 }, (_, index) => ({
      name: `Entry ${index}`,
      content: `Entry ${index} content`,
      order: index,
      excludeFromVectorization: index === 21,
    })),
  });
  const payload = { connectionId: connection.id, model: "fixture" };
  assert.deepEqual(await request("POST", `/api/lorebooks/${book.id}/vectorize`, payload), {
    vectorized: 21,
    total: 22,
    skipped: 1,
  });
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [10, 10, 1],
  );
  const entries = await request("GET", `/api/lorebooks/${book.id}/entries`);
  for (const entry of entries) {
    if (entry.excludeFromVectorization) {
      assert.ok(!entry.embedding?.length, "excluded entries stay unvectorized");
    } else {
      assert.deepEqual(entry.embedding, [Number(entry.name.slice("Entry ".length)), 1], "vectors match their entries");
      assert.ok(entry.embeddingSpaceId);
    }
  }
  assert.deepEqual(await request("POST", `/api/lorebooks/${book.id}/vectorize`, { ...payload, onlyMissing: true }), {
    vectorized: 0,
    total: 22,
    skipped: 22,
  });
  assert.equal(batches.length, 3, "only-missing skips already embedded entries");

  // A connection with an Embedding Connection override vectorizes through that override,
  // the same source chat-time semantic matching uses for its queries.
  const overrideConnection = await connections.create(
    createConnectionSchema.parse({
      name: "Embedding override",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${overrideAddress.port}/v1`,
      apiKey: "override",
      model: "fixture",
      treatAsLocalEndpoint: true,
    }),
  );
  const chatConnection = await connections.create(
    createConnectionSchema.parse({
      name: "Chat connection",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "fixture",
      model: "fixture",
      embeddingModel: "fixture",
      embeddingConnectionId: overrideConnection.id,
      treatAsLocalEndpoint: true,
    }),
  );
  const overrideBook = await request("POST", "/api/lorebooks", { name: "Override proof", excludeFromVectorization: false });
  await request("POST", `/api/lorebooks/${overrideBook.id}/entries/bulk`, {
    entries: [{ name: "Entry 0", content: "Entry 0 content", order: 0 }],
  });
  const batchesBeforeOverride = batches.length;
  assert.deepEqual(
    await request("POST", `/api/lorebooks/${overrideBook.id}/vectorize`, { connectionId: chatConnection.id }),
    { vectorized: 1, total: 1, skipped: 0 },
    "the server resolves the embedding model, so the client need not send one",
  );
  assert.equal(batches.length, batchesBeforeOverride, "the chat connection's own endpoint is not used");
  assert.equal(overrideBatches.length, 1, "the Embedding Connection override is used");
  const [overrideEntry] = await request("GET", `/api/lorebooks/${overrideBook.id}/entries`);
  const querySource = await resolveMemoryRecallEmbeddingSource(db, { connectionId: chatConnection.id });
  assert.ok(querySource?.spaceId);
  assert.equal(overrideEntry.embeddingSpaceId, querySource.spaceId, "entries and chat-time queries share one space");

  // A connection with no embedding model anywhere is refused rather than embedding with a client-sent guess.
  const noModelResponse = await app.inject({
    method: "POST",
    url: `/api/lorebooks/${overrideBook.id}/vectorize`,
    payload: { connectionId: overrideConnection.id, model: "fixture" },
  });
  assert.equal(noModelResponse.statusCode, 400, noModelResponse.body);
} finally {
  await app.close();
  await db._fileStore.close();
  await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  await new Promise<void>((resolve, reject) => overrideProvider.close((error) => (error ? reject(error) : resolve())));
}
