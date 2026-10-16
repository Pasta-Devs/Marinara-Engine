// Resolvers around connection accounts: a chat whose Model is blocked by its account generates through the main
// fallback and says so (real generate + dry-run routes); the Professor Mari resolver honours the account gate and the
// global feature setting; the feature-model PUT merges fields and nulls unknown ids; deleting a Model sweeps the
// setting; the admin "connections" reset clears accounts and the setting.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-connection-account-resolvers-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
// The stub runs on 127.0.0.1; nothing leaves the machine.
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
const { adminRoutes } = await import("../../packages/server/src/routes/admin.routes.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionAccountsStorage } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { ProfessorMariWorkspaceService } =
  await import("../../packages/server/src/services/professor-mari/workspace-agent.service.js");
const { connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY, LOCAL_SIDECAR_CONNECTION_ID } =
  await import("../../packages/shared/dist/index.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { GENERATION_FALLBACK_HEADER } =
  await import("../../packages/server/src/services/generation/fallback-notification.js");

const servedModels: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  servedModels.push(body.model);
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Hello." } }] })}\n\n`);
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: "Hello." } }] }));
  }
});

const db = await getDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const accounts = createConnectionAccountsStorage(db);
const settings = createAppSettingsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });
await app.register(adminRoutes, { prefix: "/api/admin" });
await app.register(connectionAccountsRoutes, { prefix: "/api/connection-accounts" });
await app.ready();

// The notice rides a header before the stream starts and a `fallback_used` event after.
const noticeOf = (response: { headers: Record<string, unknown>; body: string }) => {
  const raw = response.headers[GENERATION_FALLBACK_HEADER.toLowerCase()];
  if (typeof raw === "string") return JSON.parse(decodeURIComponent(raw));
  const line = response.body.split("\n").find((entry) => entry.startsWith("data: ") && entry.includes("fallback_used"));
  return line ? JSON.parse(line.slice(6)).data : null;
};
const putFeatureModels = (payload: unknown) =>
  app.inject({ method: "PUT", url: "/api/app-settings/feature-model-connections", payload: payload as object });
const getFeatureModels = async () =>
  (await app.inject({ method: "GET", url: "/api/app-settings/feature-model-connections" })).json();

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;

  const makeAccount = async (name: string, model: string) => {
    const created = await app.inject({
      method: "POST",
      url: "/api/connection-accounts",
      payload: { name, provider: "openai", baseUrl, apiKey: `key-${name}`, model },
    });
    assert.equal(created.statusCode, 201, created.body);
    return { accountId: created.json().account.id as string, connectionId: created.json().connectionId as string };
  };
  const primary = await makeAccount("primary", "primary-model");
  const backup = await makeAccount("backup", "backup-model");
  await connections.update(backup.connectionId, { fallbackForMain: true });

  const alice = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Alice" }));
  assert(alice);
  const chat = await chats.create({
    name: "Blocked",
    mode: "conversation",
    characterIds: [alice.id],
    connectionId: primary.connectionId,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Hi there." });

  // Account on: the chat's own Model answers and no notice is sent.
  let response = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, streaming: true },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(servedModels.splice(0), ["primary-model"], response.body.slice(0, 600));
  assert.equal(noticeOf(response), null);

  // Account off: the Model still exists, so the main fallback answers and the notice names it.
  await accounts.update(primary.accountId, { enabled: false });
  response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id, streaming: true } });
  assert.equal(response.statusCode, 200, response.body);
  assert(!response.body.includes('"type":"error"'), response.body);
  assert.deepEqual(servedModels.splice(0), ["backup-model"]);
  const notice = noticeOf(response);
  assert.deepEqual(
    { category: notice?.category, connectionId: notice?.connectionId, model: notice?.model },
    { category: "main", connectionId: backup.connectionId, model: "backup-model" },
  );

  // Dry run takes the same path.
  response = await app.inject({ method: "POST", url: "/api/generate/dryRun", payload: { chatId: chat.id } });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(servedModels.splice(0), ["backup-model"]);
  assert.equal(noticeOf(response)?.connectionId, backup.connectionId);

  // A Model that does not exist is still an error, and so is a blocked one with no fallback.
  const ghost = await chats.create({
    name: "Ghost",
    mode: "conversation",
    characterIds: [alice.id],
    connectionId: "no-such-model",
  });
  assert(ghost);
  await chats.createMessage({ chatId: ghost.id, role: "user", content: "Hi." });
  response = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: ghost.id, streaming: true },
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(servedModels, []);
  await connections.update(backup.connectionId, { fallbackForMain: false });
  response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id, streaming: true } });
  assert.equal(response.statusCode, 400, "a blocked Model with no main fallback is not silently rerouted");
  assert.deepEqual(servedModels, []);

  // Feature-model setting: defaults, partial merge, unknown ids stored as null without blocking the others.
  assert.deepEqual(await getFeatureModels(), {
    mariConnectionId: null,
    omnibarAsideConnectionId: LOCAL_SIDECAR_CONNECTION_ID,
    impersonateConnectionId: null,
  });
  const stale = await putFeatureModels({
    mariConnectionId: "no-such-model",
    impersonateConnectionId: primary.connectionId,
  });
  assert.equal(stale.statusCode, 200, stale.body);
  assert.deepEqual(stale.json(), {
    mariConnectionId: null,
    omnibarAsideConnectionId: LOCAL_SIDECAR_CONNECTION_ID,
    impersonateConnectionId: primary.connectionId,
  });
  // This bare app has no error handler, so a schema failure is a 500 here and a 400 in the server.
  assert.notEqual((await putFeatureModels({ mariConnectionId: "" })).statusCode, 200, "empty ids are rejected");
  const merged = await putFeatureModels({ mariConnectionId: backup.connectionId });
  assert.equal(merged.statusCode, 200, merged.body);
  const chosen = {
    mariConnectionId: backup.connectionId,
    omnibarAsideConnectionId: LOCAL_SIDECAR_CONNECTION_ID,
    impersonateConnectionId: primary.connectionId,
  };
  assert.deepEqual(merged.json(), chosen, "one field changes, the others stay");
  assert.deepEqual(await getFeatureModels(), chosen);

  // Mari resolver: request id, then the setting, then the defaults; blocked Models are skipped.
  const mari = new ProfessorMariWorkspaceService({ db } as never) as unknown as {
    resolveConnection(id?: string | null, feature?: "mari" | "aside"): Promise<{ id: string; apiKey: string } | null>;
  };
  assert.equal((await mari.resolveConnection(undefined))?.id, backup.connectionId, "the setting picks Mari's Model");
  assert.equal((await mari.resolveConnection(undefined))?.apiKey, "key-backup", "the key is decrypted");
  assert.equal((await mari.resolveConnection(null, "aside"))?.id, LOCAL_SIDECAR_CONNECTION_ID, "the aside setting");
  assert.equal((await mari.resolveConnection(backup.connectionId))?.id, backup.connectionId);
  await accounts.update(backup.accountId, { enabled: false });
  await accounts.update(primary.accountId, { enabled: true });
  await connections.update(primary.connectionId, { defaultForAgents: true });
  assert.equal(
    (await mari.resolveConnection(backup.connectionId))?.id,
    primary.connectionId,
    "a blocked request id and setting fall through to the agents default",
  );
  await accounts.update(primary.accountId, { enabled: false });
  assert.equal((await mari.resolveConnection(undefined))?.id ?? null, null, "nothing usable and no sidecar model");
  await accounts.update(backup.accountId, { enabled: true });
  await accounts.update(primary.accountId, { enabled: true });

  // Deleting a Model clears it from the setting; the others stay.
  await connections.remove(backup.connectionId);
  assert.deepEqual(await getFeatureModels(), {
    mariConnectionId: null,
    omnibarAsideConnectionId: LOCAL_SIDECAR_CONNECTION_ID,
    impersonateConnectionId: primary.connectionId,
  });
  await connections.remove(primary.connectionId);
  assert.equal((await getFeatureModels()).impersonateConnectionId, null);

  // Admin reset of connections clears accounts and the setting.
  await putFeatureModels({ ...chosen, mariConnectionId: null, impersonateConnectionId: null });
  assert((await db.select().from(connectionAccounts)).length >= 2);
  const reset = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    payload: { confirm: true, scopes: ["connections"] },
  });
  assert.equal(reset.statusCode, 200, reset.body);
  assert.deepEqual(await db.select().from(connectionAccounts), []);
  assert.equal(await settings.get(FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY), null);

  console.log("Connection account resolvers regression passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
