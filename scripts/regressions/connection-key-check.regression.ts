// A wrong key must fail the test for providers whose /models list is public.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { buildKeyCheck, connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";

assert.deepEqual(buildKeyCheck("nanogpt", "https://nano-gpt.com/api/v1"), {
  url: "https://nano-gpt.com/api/check-balance",
  method: "POST",
});
assert.equal(buildKeyCheck("openrouter", "https://openrouter.ai/api/v1/")?.url, "https://openrouter.ai/api/v1/key");
assert.equal(buildKeyCheck("openai", "https://api.openai.com/v1"), null);

const previousDirectory = process.env.FILE_STORAGE_DIR;
const directory = mkdtempSync(join(tmpdir(), "marinara-test-key-check-"));
process.env.FILE_STORAGE_DIR = directory;
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";

const hits: string[] = [];
const provider = createServer((request, response) => {
  hits.push(`${request.method} ${request.url}`);
  const ok = request.url === "/v1/models" || request.headers.authorization === "Bearer good";
  response.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
  response.end(JSON.stringify(ok ? { data: [] } : { error: "bad key" }));
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
const baseUrl = `http://127.0.0.1:${address.port}/v1`;

try {
  const test = async (apiKey: string) => {
    const row = await storage.create({ name: "OR", provider: "openrouter", baseUrl, apiKey, model: "m" });
    return (await app.inject({ method: "POST", url: `/api/connections/${row.id}/test` })).json();
  };
  const bad = await test("fake");
  assert.equal(bad.success, false, JSON.stringify(bad));
  assert.match(bad.message, /401/);
  assert.equal((await test("good")).success, true);
  assert.ok(hits.includes("GET /v1/key"), hits.join());
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.log("connection key check regression passed");
