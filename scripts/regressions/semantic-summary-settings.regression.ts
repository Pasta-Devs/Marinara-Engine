import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "marinara-summary-settings-"));
process.env.DATA_DIR = scratch;
process.env.FILE_STORAGE_DIR = join(scratch, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionAccountsStorage } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { resolveMemoryRecallEmbeddingSource } =
  await import("../../packages/server/src/services/memory-recall-embedding.js");
const { embedSummaryDocuments } =
  await import("../../packages/server/src/services/generation/summary-document-embeddings.js");

const db = await createFileNativeDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const requests: Array<{ authorization: string | undefined; tenant: string | undefined }> = [];
const embeddingServer = createServer((request, response) => {
  requests.push({
    authorization: request.headers.authorization,
    tenant: request.headers["x-tenant"] as string | undefined,
  });
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ data: [{ embedding: [1, 0], index: 0 }] }));
});

try {
  await new Promise<void>((resolve) => embeddingServer.listen(0, "127.0.0.1", resolve));
  const address = embeddingServer.address();
  assert.ok(address && typeof address === "object");

  const chat = await chats.create({ name: "Summary settings fixture", mode: "roleplay", characterIds: [] });
  assert.ok(chat);
  const [recentResponse, olderResponse] = await Promise.all([
    app.inject({
      method: "PATCH",
      url: `/api/chats/${chat.id}/metadata`,
      payload: { semanticSummaryRecentCount: 5 },
    }),
    app.inject({
      method: "PATCH",
      url: `/api/chats/${chat.id}/metadata`,
      payload: { semanticSummaryOlderCount: 7 },
    }),
  ]);
  assert.equal(recentResponse.statusCode, 200, recentResponse.body);
  assert.equal(olderResponse.statusCode, 200, olderResponse.body);
  let metadata = JSON.parse((await chats.getById(chat.id))!.metadata);
  assert.equal(metadata.semanticSummaryRecentCount, 5, "overlapping settings PATCHes must preserve the recent count");
  assert.equal(metadata.semanticSummaryOlderCount, 7, "overlapping settings PATCHes must preserve the older count");
  const summaryBeforeInvalidPatch = metadata.summary;

  const invalidResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: {
      semanticSummaryRecentCount: 9,
      semanticSummaryOlderCount: 21,
      summary: "must not be written when the settings patch is invalid",
    },
  });
  assert.equal(invalidResponse.statusCode, 400, invalidResponse.body);
  metadata = JSON.parse((await chats.getById(chat.id))!.metadata);
  assert.equal(metadata.semanticSummaryRecentCount, 5);
  assert.equal(metadata.semanticSummaryOlderCount, 7);
  assert.equal(
    metadata.summary,
    summaryBeforeInvalidPatch,
    "a compound invalid PATCH must not persist unrelated fields",
  );

  const connection = await connections.create({
    name: "Summary embedding fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture-chat-model",
    apiKey: "fixture-key-one",
    embeddingModel: "fixture-embedding-model",
  });
  assert.ok(connection);
  await connections.updateDefaultParameters(connection.id, { customHeaders: { "X-Tenant": "tenant-one" } });

  const resolveSource = () =>
    resolveMemoryRecallEmbeddingSource(db, {
      connectionId: connection.id,
      chatMetadata: { embeddingConnectionId: connection.id },
    });
  const firstSource = await resolveSource();
  assert.ok(firstSource);
  assert.ok(firstSource.cacheIdentity, "configured remote sources need a credential-scoped cache identity");
  assert.doesNotMatch(
    firstSource.cacheIdentity,
    /fixture-key-one|tenant-one/u,
    "cache identities must not expose credentials or routing headers",
  );
  assert.doesNotMatch(
    firstSource.spaceId ?? "",
    /fixture-key-one|tenant-one/u,
    "space IDs must not expose credentials or routing headers",
  );
  await embedSummaryDocuments(["Exact cached summary text"], { embeddingSource: firstSource });
  await embedSummaryDocuments(["Exact cached summary text"], { embeddingSource: firstSource });
  assert.equal(requests.length, 1, "unchanged provider configuration should reuse the warm cached vector");
  assert.equal(requests[0]!.authorization, "Bearer fixture-key-one");
  assert.equal(requests[0]!.tenant, "tenant-one");

  await connections.updateDefaultParameters(connection.id, { customHeaders: { "X-Tenant": "tenant-two" } });
  const secondSource = await resolveSource();
  assert.ok(secondSource);
  assert.equal(
    secondSource.spaceId,
    firstSource.spaceId,
    "request credentials do not redefine persisted vector-space identity",
  );
  assert.notEqual(secondSource.cacheIdentity, firstSource.cacheIdentity);
  await embedSummaryDocuments(["Exact cached summary text"], { embeddingSource: secondSource });
  assert.equal(requests.length, 2, "custom routing header changes must miss the old cache entry");
  assert.equal(requests[1]!.authorization, "Bearer fixture-key-one");
  assert.equal(requests[1]!.tenant, "tenant-two");

  // The Model is linked to a Connection, which holds its key.
  await createConnectionAccountsStorage(db).update((await connections.getById(connection.id))!.accountId!, {
    apiKey: "fixture-key-two",
  });
  const thirdSource = await resolveSource();
  assert.ok(thirdSource);
  assert.equal(thirdSource.spaceId, secondSource.spaceId);
  assert.notEqual(thirdSource.cacheIdentity, secondSource.cacheIdentity);
  await embedSummaryDocuments(["Exact cached summary text"], { embeddingSource: thirdSource });
  assert.equal(
    requests.length,
    3,
    "credential changes must miss the old cache entry even at the same vector dimension",
  );
  assert.equal(requests[2]!.authorization, "Bearer fixture-key-two");
  assert.equal(requests[2]!.tenant, "tenant-two");
} finally {
  await app.close();
  await db._fileStore.close();
  await new Promise<void>((resolve) => embeddingServer.close(() => resolve()));
  rmSync(scratch, { recursive: true, force: true });
}

console.info("Semantic summary settings route and provider-cache regressions passed.");
