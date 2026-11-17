import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A Model's own address uses its Connection's key, so it may only point at the server the row requests from.
// The check judges the row the update will store, and an address move leaves no own address on the old server.
const dir = mkdtempSync(join(tmpdir(), "marinara-own-address-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { connectionsRoutes } = await import("../../../packages/server/src/routes/connections.routes.js");
const { connectionAccountsRoutes } = await import("../../../packages/server/src/routes/connection-accounts.routes.js");
const { errorHandler } = await import("../../../packages/server/src/middleware/error-handler.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");

const app = Fastify();
try {
  const db = await getDB();
  app.decorate("db", db);
  app.setErrorHandler(errorHandler);
  await app.register(connectionsRoutes, { prefix: "/connections" });
  await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
  const storage = createConnectionsStorage(db);

  const proxy = "http://127.0.0.1:9/proxy/google-ai";
  const created = await app.inject({
    method: "POST",
    url: "/accounts",
    payload: { provider: "custom", baseUrl: proxy, apiKey: "sk-fixture", model: "gemini-fixture" },
  });
  assert.ok([200, 201].includes(created.statusCode), created.body);
  const accountId = created.json().account.id as string;
  const row = await app.inject({
    method: "POST",
    url: "/connections",
    payload: { name: "GLM", provider: "custom", model: "glm-fixture", accountId, baseUrl: proxy },
  });
  assert.ok([200, 201].includes(row.statusCode), row.body);
  const id = row.json().id as string;
  const patch = (payload: Record<string, unknown>) =>
    app.inject({ method: "PATCH", url: `/connections/${id}`, payload });
  const stored = async () => (await storage.getById(id))!;

  // Same server: saved, and requests use it with the Connection's key.
  const same = await patch({ modelBaseUrl: "http://127.0.0.1:9/proxy/openai" });
  assert.equal(same.statusCode, 200, same.body);
  assert.equal((await stored()).modelBaseUrl, "http://127.0.0.1:9/proxy/openai");
  assert.equal((await storage.getWithKey(id))?.baseUrl, "http://127.0.0.1:9/proxy/openai");

  // Another server: refused, nothing changes.
  const other = await patch({ modelBaseUrl: "http://elsewhere.example/v1" });
  assert.equal(other.statusCode, 400, other.body);
  assert.equal((await stored()).modelBaseUrl, "http://127.0.0.1:9/proxy/openai");

  // A linked Model's address is its Connection's: an address in the same PATCH is ignored, so the pair is
  // judged on the Connection's server and an own address elsewhere is still refused.
  const linkedMove = await patch({ baseUrl: "http://10.0.0.5:8080/v1", modelBaseUrl: "http://10.0.0.5:8080/openai" });
  assert.equal(linkedMove.statusCode, 400, linkedMove.body);
  assert.equal((await stored()).baseUrl, proxy);

  // A Model with its own address (no Connection): judged on the row the update will store.
  const loose = await app.inject({
    method: "POST",
    url: "/connections",
    payload: { name: "Loose", provider: "custom", model: "loose", baseUrl: proxy, apiKey: "sk-loose" },
  });
  assert.ok([200, 201].includes(loose.statusCode), loose.body);
  const looseId = loose.json().id as string;
  const patchLoose = (payload: Record<string, unknown>) =>
    app.inject({ method: "PATCH", url: `/connections/${looseId}`, payload });
  const looseRow = async () => (await storage.getById(looseId))!;
  const detached = await patchLoose({ accountId: null });
  assert.equal(detached.statusCode, 200, detached.body);
  assert.equal((await looseRow()).accountId, null);
  const both = await patchLoose({
    baseUrl: "http://10.0.0.5:8080/proxy/google-ai",
    modelBaseUrl: "http://10.0.0.5:8080/openai",
  });
  assert.equal(both.statusCode, 200, both.body);
  assert.equal((await looseRow()).modelBaseUrl, "http://10.0.0.5:8080/openai");
  const mismatch = await patchLoose({
    baseUrl: "http://10.0.0.6:8080/v1",
    modelBaseUrl: "http://10.0.0.5:8080/openai",
  });
  assert.equal(mismatch.statusCode, 400, mismatch.body);
  assert.equal((await looseRow()).baseUrl, "http://10.0.0.5:8080/proxy/google-ai");
  // Only the address moved: the own address it left behind is cleared in the same write.
  const moved = await patchLoose({ baseUrl: "http://10.0.0.6:8080/v1" });
  assert.equal(moved.statusCode, 200, moved.body);
  assert.equal((await looseRow()).modelBaseUrl, "");
  assert.equal((await storage.getWithKey(looseId))?.baseUrl, "http://10.0.0.6:8080/v1");

  // A Connection's address edit that moves its Models to another server drops their own addresses too.
  assert.equal((await stored()).modelBaseUrl, "http://127.0.0.1:9/proxy/openai");
  const samePath = await app.inject({
    method: "PATCH",
    url: `/accounts/${accountId}`,
    payload: { baseUrl: "http://127.0.0.1:9/proxy/v2/google-ai" },
  });
  assert.equal(samePath.statusCode, 200, samePath.body);
  assert.equal((await stored()).modelBaseUrl, "http://127.0.0.1:9/proxy/openai", "same server keeps it");
  const newServer = await app.inject({
    method: "PATCH",
    url: `/accounts/${accountId}`,
    payload: { baseUrl: "http://10.0.0.7:8080/google-ai" },
  });
  assert.equal(newServer.statusCode, 200, newServer.body);
  assert.equal((await stored()).baseUrl, "http://10.0.0.7:8080/google-ai");
  assert.equal((await stored()).modelBaseUrl, "");
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("model own address regression passed");
