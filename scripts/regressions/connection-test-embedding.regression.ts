// Connections > Test embedding (#8663): the test resolves its source the way semantic search does, so it calls the
// Embedding endpoint URL and the Embedding Connection's model, key and address, never the chat address alone; a
// connection with no embedding settings gets a plain error (the app-wide default does not stand in for it); a
// working source reports its vector size; and a failing one reports the provider error without echoing the key.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY } from "../../packages/shared/src/types/connection.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";

const previousDirectory = process.env.FILE_STORAGE_DIR;
const directory = mkdtempSync(join(tmpdir(), "marinara-test-embedding-"));
process.env.FILE_STORAGE_DIR = directory;

type Hit = { path: string; authorization?: string; model?: string };
const hits: Hit[] = [];
const provider = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const parsed = body ? (JSON.parse(body) as { model?: string }) : {};
    hits.push({ path: request.url ?? "", authorization: request.headers.authorization, model: parsed.model });
    if (request.url?.startsWith("/fail/")) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "embedding backend is down" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }));
  });
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/api/connections" });
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const address = provider.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const create = async (fields: Record<string, unknown>) => {
  const row = await storage.create({ provider: "openai", model: "gpt-5-mini", ...fields } as never);
  assert.ok(row, `fixture ${String(fields.name)} is created`);
  return row;
};
const testEmbedding = async (id: string) => {
  hits.length = 0;
  const response = await app.inject({ method: "POST", url: `/api/connections/${id}/test-embedding`, payload: {} });
  assert.equal(response.statusCode, 200, response.body);
  return response.json() as {
    success: boolean;
    message: string;
    latencyMs: number;
    dimensions?: number;
    model?: string;
    endpoint?: string;
  };
};

try {
  // The Embedding endpoint URL is the address the test calls, not the chat Base URL.
  const own = await create({
    name: "Own endpoint",
    baseUrl: `${origin}/chat/v1`,
    apiKey: "own-key",
    embeddingModel: "own-embed",
    embeddingBaseUrl: `${origin}/embed/v1`,
  });
  const ownResult = await testEmbedding(own.id);
  assert.deepEqual(hits, [{ path: "/embed/v1/embeddings", authorization: "Bearer own-key", model: "own-embed" }]);
  assert.equal(ownResult.success, true, ownResult.message);
  assert.equal(ownResult.dimensions, 3, "success reports the vector size");
  assert.equal(ownResult.message, "3 dimensions");
  assert.equal(ownResult.model, "own-embed");
  assert.equal(ownResult.endpoint, `${origin}/embed/v1`);
  assert.equal(typeof ownResult.latencyMs, "number");

  // An Embedding Connection lends its model, key and address.
  const lender = await create({
    name: "Lender",
    baseUrl: `${origin}/lender/v1`,
    apiKey: "lender-key",
    embeddingModel: "lender-embed",
  });
  const borrower = await create({
    name: "Borrower",
    baseUrl: `${origin}/borrower/v1`,
    apiKey: "borrower-key",
    embeddingModel: "",
    embeddingConnectionId: lender.id,
  });
  const borrowed = await testEmbedding(borrower.id);
  assert.deepEqual(hits, [
    { path: "/lender/v1/embeddings", authorization: "Bearer lender-key", model: "lender-embed" },
  ]);
  assert.equal(borrowed.success, true, borrowed.message);
  assert.equal(borrowed.dimensions, 3);
  assert.equal(borrowed.model, "lender-embed");
  assert.equal(borrowed.endpoint, `${origin}/lender/v1`);

  // Nothing set: a plain error, and the app-wide default does not answer for this connection.
  await createAppSettingsStorage(db).set(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY, lender.id);
  const plain = await create({ name: "Plain", baseUrl: `${origin}/plain/v1`, apiKey: "plain-key" });
  const unset = await testEmbedding(plain.id);
  assert.deepEqual(unset, { success: false, message: "No embedding model set.", latencyMs: 0 });
  assert.deepEqual(hits, [], "nothing is called without an embedding model");
  // A model with no address says the endpoint is missing, not the model.
  const nowhere = await create({ name: "Nowhere", provider: "custom", baseUrl: "", embeddingModel: "lost-embed" });
  const noEndpoint = await testEmbedding(nowhere.id);
  assert.equal(noEndpoint.success, false);
  assert.match(noEndpoint.message, /No embedding endpoint set/u);
  assert.deepEqual(hits, [], "nothing is called without an endpoint");

  // A failing endpoint reports the provider error, never the key.
  const failing = await create({
    name: "Failing",
    baseUrl: `${origin}/chat/v1`,
    apiKey: "failing-secret-key",
    embeddingModel: "fail-embed",
    embeddingBaseUrl: `${origin}/fail/v1`,
  });
  const failed = await testEmbedding(failing.id);
  assert.equal(hits[0]?.path, "/fail/v1/embeddings");
  assert.equal(failed.success, false);
  assert.match(failed.message, /Embedding request failed \(500\)/u);
  assert.equal(failed.dimensions, undefined);
  assert.ok(!JSON.stringify(failed).includes("failing-secret-key"), "the API key is never echoed");

  const missing = await app.inject({ method: "POST", url: "/api/connections/missing/test-embedding", payload: {} });
  assert.equal(missing.statusCode, 404);
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.log("connection test embedding regression passed");
