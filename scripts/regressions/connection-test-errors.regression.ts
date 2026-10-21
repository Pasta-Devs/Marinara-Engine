// Connection Test failures keep their real cause. A private host the server guard refuses
// must surface the guard's message (flag name included), not a bare "network"; and a
// speech row's Test must send the row's key the same way the voice path does.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { connectionAccountsRoutes } from "../../packages/server/src/routes/connection-accounts.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";

const previousDirectory = process.env.FILE_STORAGE_DIR;
const directory = mkdtempSync(join(tmpdir(), "marinara-test-errors-"));
process.env.FILE_STORAGE_DIR = directory;
delete process.env.PROVIDER_LOCAL_URLS_ENABLED;
delete process.env.TTS_LOCAL_URLS_ENABLED;

const authorizations: Array<string | undefined> = [];
const provider = createServer((request, response) => {
  authorizations.push(request.headers.authorization);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [] }));
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/api/connections" });
await app.register(connectionAccountsRoutes, { prefix: "/api/connection-accounts" });
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const address = provider.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}/v1`;

try {
  // Guard refuses a private (non-loopback) host: the decision Test reports why.
  const decision = await storage.create({
    name: "Private decision",
    provider: "decision",
    baseUrl: "http://10.255.255.1/v1",
    apiKey: "k",
    model: "m",
    decisionSource: "openai_compatible",
  });
  const refused = await app.inject({ method: "POST", url: `/api/connections/${decision.id}/test` });
  const refusedBody = refused.json();
  assert.equal(refusedBody.success, false, refused.body);
  assert.match(String(refusedBody.errorCode ?? refusedBody.message), /Refused to fetch .*PROVIDER_LOCAL_URLS_ENABLED/);

  // A speech row's Test sends its key as a Bearer header, as /tts/speak does.
  process.env.TTS_LOCAL_URLS_ENABLED = "true";
  const audio = await storage.create({
    name: "Voice",
    provider: "audio",
    baseUrl,
    apiKey: "audio-key",
    model: "",
    audioSource: "openai",
  });
  const tested = await app.inject({ method: "POST", url: `/api/connections/${audio.id}/test` });
  assert.equal(tested.json().success, true, tested.body);
  assert.deepEqual(authorizations, ["Bearer audio-key"]);

  // The Add window's case: the row is linked to an account, its own key is empty.
  const account = await app.inject({
    method: "POST",
    url: "/api/connection-accounts",
    payload: { name: "Shared", provider: "custom", baseUrl, apiKey: "account-key", model: "m" },
  });
  assert.equal(account.statusCode, 201, account.body);
  const linked = await storage.create({
    name: "Linked voice",
    provider: "audio",
    baseUrl,
    apiKey: "",
    model: "",
    audioSource: "openai",
    accountId: account.json().account.id,
  });
  authorizations.length = 0;
  const linkedTest = await app.inject({ method: "POST", url: `/api/connections/${linked.id}/test` });
  assert.equal(linkedTest.json().success, true, linkedTest.body);
  assert.deepEqual(authorizations, ["Bearer account-key"]);
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.log("connection test errors regression passed");
