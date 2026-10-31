// Per-chat model picks (decisions 25/26): PUT /chats/:id/model stores a catalog pick on the chat without saving a
// Model, maps a model the library already holds to that saved Model, fills the catalog's name and limits and keeps
// the chat's last two choices. Generation runs the pick on the chat's Model with neutral tuning; setting the chat's
// Model another way drops the pick; deleting the Model moves the pick to a peer Model of the same Connection, or
// the chat falls back to Main and the notice says the Model was deleted. "Use default" (decision 27) clears the
// chat's own pick: it follows Main without a notice until the next pick. Also: a key rotation that leaves a Model
// with a foreign embeddings host behind does not bring it back as a second Connection at the next start, and
// "Make it my Main model" keeps the fallback flag.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-chat-model-override-"));
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
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionAccountsStorage, linkConnectionAccounts } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { applyChatModelOverride, readChatModelOverride } =
  await import("../../packages/server/src/services/generation/connection-resolution.js");
const { apiConnections, connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { GENERATION_FALLBACK_HEADER } =
  await import("../../packages/server/src/services/generation/fallback-notification.js");

const servedModels: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  servedModels.push(body.model);
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Hello." } }] })}\n\n`);
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});

const db = await getDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const accounts = createConnectionAccountsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(connectionAccountsRoutes, { prefix: "/api/connection-accounts" });
await app.ready();

const noticeOf = (response: { headers: Record<string, unknown>; body: string }) => {
  const raw = response.headers[GENERATION_FALLBACK_HEADER.toLowerCase()];
  if (typeof raw === "string") return JSON.parse(decodeURIComponent(raw));
  const line = response.body.split("\n").find((entry) => entry.startsWith("data: ") && entry.includes("fallback_used"));
  return line ? JSON.parse(line.slice(6)).data : null;
};
const chatOf = async (id: string) => {
  const chat = (await chats.getById(id))!;
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  return {
    connectionId: chat.connectionId,
    override: metadata.modelOverride ?? null,
    recent: metadata.recentModels,
    followsMain: metadata.followsMainModel ?? false,
  };
};
const setModel = (chatId: string, payload: Record<string, unknown>) =>
  app.inject({ method: "PUT", url: `/api/chats/${chatId}/model`, payload });
const generate = async (chatId: string, connectionId?: string) => {
  const response = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId, streaming: true, ...(connectionId ? { connectionId } : {}) },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert(!response.body.includes('"type":"error"'), response.body.slice(0, 600));
  return { served: servedModels.splice(0), notice: noticeOf(response) };
};
const rowOf = async (id: string) => (await connections.getById(id))!;

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
  const main = await makeAccount("main", "main-model");
  await connections.update(main.connectionId, { isDefault: true });
  assert(
    await connections.saveModelListIfUnchanged(await rowOf(primary.connectionId), [
      { id: "primary-model", name: "Primary" },
      { id: "catalog-model", name: "Catalog Model", context: 32000, maxOutput: 4000 },
    ]),
  );

  const alice = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Alice" }));
  assert(alice);
  const chat = await chats.create({
    name: "Picks",
    mode: "conversation",
    characterIds: [alice.id],
    connectionId: primary.connectionId,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Hi there." });
  const rowCount = async () => (await db.select().from(apiConnections)).length;
  const rowsBefore = await rowCount();

  // A catalog pick: stored on the chat with the catalog's name and limits; no Model is saved.
  let response = await setModel(chat.id, { connectionId: primary.connectionId, model: "catalog-model" });
  assert.equal(response.statusCode, 200, response.body);
  let state = await chatOf(chat.id);
  const catalogPick = {
    connectionId: primary.connectionId,
    model: "catalog-model",
    name: "Catalog Model",
    maxContext: 32000,
    maxTokensOverride: 4000,
  };
  assert.deepEqual(state.override, catalogPick, "name and limits come from the catalog");
  assert.deepEqual(state.recent, [{ connectionId: primary.connectionId }]);
  assert.equal(await rowCount(), rowsBefore, "a pick saves no Model");
  assert.deepEqual(await generate(chat.id), { served: ["catalog-model"], notice: null });
  // A Random pick that lands on the chat's Model runs that Model, not this chat's catalog pick.
  await connections.update(primary.connectionId, { useForRandom: true });
  assert.deepEqual((await generate(chat.id, "random")).served, ["primary-model"]);
  await connections.update(primary.connectionId, { useForRandom: false });

  // The chat's Model's own id is no pick: the override goes and the pick moves to Recent.
  response = await setModel(chat.id, { connectionId: primary.connectionId, model: "primary-model" });
  assert.equal(response.statusCode, 200, response.body);
  state = await chatOf(chat.id);
  assert.equal(state.override, null);
  assert.deepEqual(state.recent, [catalogPick], "the current choice is never in Recent");
  assert.deepEqual((await generate(chat.id)).served, ["primary-model"]);

  // A model the library holds points the chat at that saved Model. Recent keeps two choices, newest first.
  const saved = await app.inject({
    method: "POST",
    url: `/api/connection-accounts/${primary.accountId}/for-model`,
    payload: { model: "saved-model" },
  });
  assert.equal(saved.statusCode, 201, saved.body);
  const savedId: string = saved.json().connectionId;
  response = await setModel(chat.id, { connectionId: primary.connectionId, model: "saved-model" });
  assert.equal(response.statusCode, 200, response.body);
  state = await chatOf(chat.id);
  assert.deepEqual(
    { connectionId: state.connectionId, override: state.override, recent: state.recent },
    { connectionId: savedId, override: null, recent: [{ connectionId: primary.connectionId }, catalogPick] },
  );
  assert.equal((await setModel(chat.id, { connectionId: "no-such-model" })).statusCode, 404);

  // Setting the chat's Model another way drops the pick; a pick bound to another Model is ignored.
  await setModel(chat.id, { connectionId: primary.connectionId, model: "catalog-model" });
  response = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}`,
    payload: { connectionId: main.connectionId },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal((await chatOf(chat.id)).override, null);
  assert.equal(
    readChatModelOverride({ connectionId: main.connectionId, metadata: { modelOverride: catalogPick } }),
    null,
    "a stale pick is ignored",
  );

  // The pick runs with neutral tuning and never changes another (fallback) Model.
  const tunedRow = {
    id: "row",
    name: "Tuned",
    model: "tuned-model",
    enableCaching: "true",
    promptPresetId: "preset",
    defaultParameters: "{}",
    claudeFastMode: "true",
    maxContext: 9,
    maxTokensOverride: 9,
  };
  const applied = applyChatModelOverride(tunedRow, { connectionId: "row", model: "picked" });
  assert.deepEqual(
    { ...applied },
    {
      ...tunedRow,
      name: "picked",
      model: "picked",
      enableCaching: "false",
      promptPresetId: null,
      defaultParameters: null,
      claudeFastMode: "false",
      anthropicExtendedCacheTtl: "false",
      cachingAtDepth: 5,
      openrouterProvider: null,
      maxStateTokens: null,
      maxContext: 128000,
      maxTokensOverride: null,
    },
  );
  assert.equal(
    applyChatModelOverride({ ...tunedRow, id: "other" }, { connectionId: "row", model: "x" }).model,
    "tuned-model",
  );

  // Deleting the Model a pick runs on moves the pick to a peer Model of the same Connection.
  await setModel(chat.id, { connectionId: primary.connectionId, model: "catalog-model" });
  await connections.remove(primary.connectionId);
  state = await chatOf(chat.id);
  assert.equal(state.connectionId, savedId);
  assert.deepEqual(state.override, { ...catalogPick, connectionId: savedId });
  assert.deepEqual((await generate(chat.id)).served, ["catalog-model"]);

  // With no peer left the chat has no Model: generation uses Main and the notice says why.
  await connections.remove(savedId);
  assert.equal((await chatOf(chat.id)).connectionId, null);
  const fallback = await generate(chat.id);
  assert.deepEqual(fallback.served, ["main-model"]);
  assert.deepEqual(
    { reason: fallback.notice?.reason, connectionId: fallback.notice?.connectionId },
    { reason: "deleted", connectionId: main.connectionId },
  );

  // "Use default" (decision 27): the chat drops its own pick and follows Main, as an unset chat did, without a notice.
  assert.equal((await setModel(chat.id, { connectionId: main.connectionId })).statusCode, 200);
  // An empty id is not the default: the body is rejected (400 behind the app's error handler) and nothing changes.
  assert.notEqual((await setModel(chat.id, { connectionId: "" })).statusCode, 200);
  assert.equal((await chatOf(chat.id)).connectionId, main.connectionId);
  const followed = await setModel(chat.id, { connectionId: null });
  assert.equal(followed.statusCode, 200, followed.body);
  state = await chatOf(chat.id);
  assert.equal(state.connectionId, null);
  assert.equal(state.override, null);
  assert.equal(state.followsMain, true);
  assert.deepEqual(state.recent[0], { connectionId: main.connectionId }, "the last pick stays in Recent");
  const viaMain = await generate(chat.id);
  assert.deepEqual(viaMain.served, ["main-model"]);
  assert.equal(viaMain.notice, null, "following Main is a choice, not a fallback");
  // Any later pick ends it.
  assert.equal((await setModel(chat.id, { connectionId: main.connectionId })).statusCode, 200);
  assert.equal((await chatOf(chat.id)).followsMain, false);

  // "Make it my Main model" keeps the fallback flag (the fallback wrapper skips itself as a fallback).
  const spare = await makeAccount("spare", "spare-model");
  await connections.update(spare.connectionId, { fallbackForMain: true });
  await connections.update(spare.connectionId, { isDefault: true });
  const spareRow = await rowOf(spare.connectionId);
  assert.deepEqual(
    { isDefault: spareRow.isDefault, fallbackForMain: spareRow.fallbackForMain },
    {
      isDefault: "true",
      fallbackForMain: "true",
    },
  );

  // Key rotation: a Model whose embeddings host is on another origin keeps its own key and leaves the Connection.
  // The next start must not turn it into a second card for the same Connection.
  const rotate = await makeAccount("rotate", "rotate-model");
  const second = await app.inject({
    method: "POST",
    url: `/api/connection-accounts/${rotate.accountId}/for-model`,
    payload: { model: "embedding-model" },
  });
  const embeddingId: string = second.json().connectionId;
  await connections.update(embeddingId, { embeddingBaseUrl: "https://embeddings.example/v1" });
  await accounts.update(rotate.accountId, { apiKey: "key-rotated" });
  const accountCount = async () => (await db.select().from(connectionAccounts)).length;
  const before = await accountCount();
  await linkConnectionAccounts(db);
  await linkConnectionAccounts(db);
  assert.equal(await accountCount(), before, "no extra Connection after the next start");
  assert.equal((await rowOf(embeddingId)).accountId ?? null, null, "the foreign-embedding Model stays standalone");
  assert.equal((await rowOf(rotate.connectionId)).accountId, rotate.accountId);

  console.log("Chat model override regression passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
