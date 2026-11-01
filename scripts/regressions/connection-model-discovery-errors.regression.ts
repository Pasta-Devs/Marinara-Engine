import assert from "node:assert/strict";
import { createServer } from "node:http";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";

const provider = createServer((request, response) => {
  const valid = request.headers.authorization === "Bearer valid-key";
  response.writeHead(valid ? 200 : 401, { "content-type": "application/json" });
  response.end(JSON.stringify(valid ? { data: [{ id: "fixture-model" }] } : { error: "Invalid API key" }));
});
const app = Fastify();
try {
  const db = await createFileNativeDB();
  const storage = createConnectionsStorage(db);
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  for (const apiKey of ["bad-key", "", "valid-key"]) {
    const row = await storage.create({ name: "Discovery", provider: "custom", baseUrl, apiKey, model: "" });
    const result = await app.inject({ method: "GET", url: `/api/connections/${row.id}/models` });
    assert.equal(result.statusCode, apiKey === "valid-key" ? 200 : 401, result.body);
    if (apiKey === "valid-key") assert.equal(result.json().models[0].id, "fixture-model");
    else assert.match(result.json().error, /401.*Invalid API key/);
  }
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  const row = await storage.create({ name: "Offline", provider: "custom", baseUrl, apiKey: "key", model: "" });
  const result = await app.inject({ method: "GET", url: `/api/connections/${row.id}/models` });
  assert.equal(result.statusCode, 502, result.body);
  assert.match(result.json().error, /ECONNREFUSED/);
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
}
console.log("connection model discovery errors regression passed");
