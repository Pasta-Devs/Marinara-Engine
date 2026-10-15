// Connection accounts: account edits write the cross-type-safe fields through to every linked Model in one
// transaction, a linked Model cannot override them, the gate hides Models of a disabled account, and the
// routes mask secrets. One OpenAI key serves a chat Model and an image Model whose endpoint stays its own.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-accounts-write-through-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { decryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

const KEY = "fixture-openai-key-1234";
const ROTATED = "fixture-openai-rotated-5678";
const IMAGE_URL = "https://api.openai.com/v1/images";

const db = await getDB();
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
await app.register(connectionsRoutes, { prefix: "/connections" });
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
const plainKey = async (id: string) => decryptApiKey((await rowOf(id)).apiKeyEncrypted);
const json = async (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
  return { status: response.statusCode, body: response.body, data: response.body ? JSON.parse(response.body) : null };
};

try {
  // Account + first Model in one call; the response is masked.
  const created = await json("POST", "/accounts", { provider: "openai", apiKey: KEY, model: "gpt-5" });
  assert.equal(created.status, 201, created.body);
  assert(!created.body.includes(KEY));
  assert.equal(created.data.account.apiKeyLast4, "1234");
  assert.equal(created.data.account.hasApiKey, true);
  assert.equal(created.data.account.name, "OpenAI");
  const accountId: string = created.data.account.id;
  const chatId: string = created.data.connectionId;
  assert.equal((await rowOf(chatId)).accountId, accountId);

  // The image row takes the key from the account and keeps its own endpoint.
  const image = await connections.create(
    createConnectionSchema.parse({
      name: "GPT Image",
      provider: "image_generation",
      imageGenerationSource: "openai",
      baseUrl: IMAGE_URL,
      apiKey: "ignored-input-key",
      model: "gpt-image-1",
      accountId,
    }),
  );
  assert(image);
  assert.equal(image.accountId, accountId);
  assert.equal(await plainKey(image.id), KEY);
  assert.equal(image.baseUrl, IMAGE_URL);

  // A key for another host is never copied: the Model stays standalone with its own credentials.
  const foreign = await connections.create(
    createConnectionSchema.parse({
      name: "Foreign",
      provider: "image_generation",
      imageGenerationSource: "stability",
      baseUrl: "https://api.stability.ai/v2beta",
      apiKey: "stability-own-key",
      accountId,
    }),
  );
  assert(foreign);
  assert.equal(foreign.accountId === accountId, false);
  assert.equal(await plainKey(foreign.id), "stability-own-key");

  // Key rotation reaches the chat row and the image row; the image endpoint is untouched.
  const rotated = await json("PATCH", `/accounts/${accountId}`, { apiKey: ROTATED });
  assert.equal(rotated.status, 200, rotated.body);
  assert(!rotated.body.includes(ROTATED));
  assert.equal(rotated.data.modelCount, 2);
  assert.equal(await plainKey(chatId), ROTATED);
  assert.equal(await plainKey(image.id), ROTATED);
  assert.equal((await rowOf(image.id)).baseUrl, IMAGE_URL);
  // An endpoint change goes to the chat row only.
  assert.equal((await json("PATCH", `/accounts/${accountId}`, { baseUrl: "https://api.openai.com/v2" })).status, 200);
  assert.equal((await rowOf(chatId)).baseUrl, "https://api.openai.com/v2");
  assert.equal((await rowOf(image.id)).baseUrl, IMAGE_URL);
  assert.equal((await rowOf(image.id)).accountId, accountId);
  // Usage flags are written through to the rows that support them.
  assert.equal((await json("PATCH", `/accounts/${accountId}`, { treatAsLocalEndpoint: true })).status, 200);
  assert.equal((await rowOf(image.id)).treatAsLocalEndpoint, "true");
  // Moving the endpoint to another host detaches the row that kept its own endpoint, key untouched.
  assert.equal(
    (await json("PATCH", `/accounts/${accountId}`, { baseUrl: "https://llm.example/v1", apiKey: KEY })).status,
    200,
  );
  assert.equal((await rowOf(image.id)).accountId, null);
  assert.equal(await plainKey(image.id), ROTATED);
  assert.equal(await plainKey(chatId), KEY);
  assert.equal((await json("PATCH", `/accounts/${accountId}`, { baseUrl: "https://api.openai.com/v1" })).status, 200);

  // A linked row ignores account-owned fields and keeps its own tuning.
  const patched = await json("PATCH", `/connections/${chatId}`, {
    apiKey: "evil-key",
    baseUrl: "https://evil.example/v1",
    provider: "custom",
    treatAsLocalEndpoint: true,
    maxContext: 4096,
  });
  assert.equal(patched.status, 200, patched.body);
  assert.equal(await plainKey(chatId), KEY);
  assert.equal((await rowOf(chatId)).baseUrl, "https://api.openai.com/v1");
  assert.equal((await rowOf(chatId)).provider, "openai");
  assert.equal((await rowOf(chatId)).treatAsLocalEndpoint, "true", "unchanged: still the account's value");
  assert.equal((await rowOf(chatId)).maxContext, 4096);
  assert.equal((await rowOf(chatId)).accountId, accountId);
  // Re-link the image row for the rest of the run.
  await db.update(apiConnections).set({ accountId }).where(eq(apiConnections.id, image.id));
  await json("PATCH", `/accounts/${accountId}`, { apiKey: KEY, treatAsLocalEndpoint: false });

  // for-model: finds or creates, named after the catalog, clones tuning without roles, source untouched.
  await connections.update(chatId, { isDefault: true, useForRandom: true, enableCaching: true, maxContext: 32000 });
  const sourceBefore = await rowOf(chatId);
  const chatRow = (await connections.getById(chatId))!;
  const saved = await connections.saveModelListIfUnchanged(chatRow, [
    { id: "gpt-5", name: "GPT-5" },
    { id: "gpt-5-mini", name: "GPT-5 mini" },
  ]);
  assert(saved);
  const savedAfter = await rowOf(chatId);
  const pick = await json("POST", `/accounts/${accountId}/for-model`, { model: "gpt-5-mini" });
  assert.equal(pick.status, 200, pick.body);
  const miniId: string = pick.data.connectionId;
  assert.notEqual(miniId, chatId);
  const mini = await rowOf(miniId);
  assert.equal(mini.name, "GPT-5 mini");
  assert.equal(mini.model, "gpt-5-mini");
  assert.equal(mini.accountId, accountId);
  assert.equal(mini.enableCaching, "true");
  assert.equal(mini.maxContext, 32000);
  for (const flag of [
    "isDefault",
    "useForRandom",
    "fallbackForMain",
    "defaultForAgents",
    "fallbackForAgents",
  ] as const) {
    assert.equal(mini[flag], "false", flag);
  }
  assert.equal(await plainKey(miniId), KEY);
  assert.deepEqual(await rowOf(chatId), savedAfter, "the source row is never modified");
  assert.notEqual(sourceBefore.savedModels, savedAfter.savedModels);
  const again = await json("POST", `/accounts/${accountId}/for-model`, { model: "gpt-5-mini", name: "Other" });
  assert.equal(again.data.connectionId, miniId, "idempotent");
  assert.equal((await rowOf(miniId)).name, "GPT-5 mini", "existing names are never touched");
  const concurrent = await Promise.all(
    [1, 2, 3].map(() => json("POST", `/accounts/${accountId}/for-model`, { model: "gpt-5-nano" })),
  );
  assert.equal(new Set(concurrent.map((result) => result.data.connectionId)).size, 1, "double clicks dedupe");

  // Pins and the saved list are shared by Models of the same provider under the account, not by the image row.
  assert.equal(
    (await json("POST", `/connections/${miniId}/pinned-models`, { model: "gpt-5", pinned: true })).status,
    200,
  );
  assert.equal((await rowOf(chatId)).pinnedModels, '["gpt-5"]');
  assert.equal((await rowOf(image.id)).pinnedModels, "[]");
  assert.equal((await rowOf(miniId)).savedModels, savedAfter.savedModels, "a new Model starts with the account's list");
  const fetched = await connections.saveModelListIfUnchanged((await connections.getById(miniId))!, [
    { id: "gpt-5", name: "GPT-5" },
  ]);
  assert(fetched);
  assert.equal((await rowOf(chatId)).savedModels, (await rowOf(miniId)).savedModels);
  assert.notEqual((await rowOf(chatId)).savedModels, savedAfter.savedModels, "the fresh list reached the peer");
  assert.equal((await rowOf(image.id)).savedModels, null);

  const search = await json("GET", "/accounts/catalog-search?q=gpt-5&limit=5");
  assert.equal(search.status, 200);
  assert(Array.isArray(search.data));
  assert(
    search.data.some(
      (hit: { accountId: string; model: string }) => hit.accountId === accountId && hit.model === "gpt-5",
    ),
  );

  // The list never carries a key.
  const list = await json("GET", "/accounts");
  assert(!list.body.includes(KEY) && !list.body.includes("Encrypted"));
  assert.equal(list.data.find((item: { id: string }) => item.id === accountId).modelCount, 4);

  // The gate: a disabled account makes its Models unavailable everywhere a connection is resolved.
  await db
    .update(apiConnections)
    .set({ fallbackForMain: "true", defaultForAgents: "true", fallbackForAgents: "true" })
    .where(eq(apiConnections.id, miniId));
  await db.update(apiConnections).set({ defaultForAgents: "false" }).where(eq(apiConnections.id, chatId));
  await db.update(apiConnections).set({ defaultForAgents: "true" }).where(eq(apiConnections.id, image.id));
  assert((await connections.getWithKey(chatId))?.apiKey === KEY);
  assert((await connections.getDefault())?.id === chatId);
  assert((await connections.getFallbackForMain())?.id === miniId);
  assert((await connections.getDefaultForAgents())?.id === miniId);
  assert((await connections.getFallbackForAgents())?.id === miniId);
  assert((await connections.listRandomPool()).some((row) => row.id === chatId));
  assert((await connections.getDefaultForImageGeneration())?.id === image.id);
  await json("PATCH", `/accounts/${accountId}`, { enabled: false });
  assert.equal(await connections.getWithKey(chatId), null);
  assert.equal(await connections.getWithKey(image.id), null);
  assert.equal(await connections.getManagementToken(chatId), null);
  assert.equal(await connections.getDefault(), null);
  assert.equal(await connections.getFallbackForMain(), null);
  assert.equal(await connections.getDefaultForAgents(), null);
  assert.equal(await connections.getFallbackForAgents(), null);
  assert.equal(await connections.getDefaultForImageGeneration(), null);
  assert.equal((await connections.listRandomPool()).length, 0);
  assert.equal(
    (await json("GET", "/accounts")).data.find((item: { id: string }) => item.id === accountId).state,
    "off",
  );
  await json("PATCH", `/accounts/${accountId}`, { enabled: true });
  assert((await connections.getWithKey(chatId))?.apiKey === KEY);

  // Delete is refused while Models are linked, and the response names them.
  const refused = await json("DELETE", `/accounts/${accountId}`);
  assert.equal(refused.status, 409);
  assert(refused.data.models.length >= 3);
  for (const row of await db.select().from(apiConnections).where(eq(apiConnections.accountId, accountId))) {
    await connections.remove(row.id);
  }
  assert.equal((await json("DELETE", `/accounts/${accountId}`)).status, 204);

  // Duplicate keeps the account link.
  const solo = await json("POST", "/accounts", { provider: "openai", apiKey: "fixture-solo-key-0000", model: "gpt-5" });
  const copy = await connections.duplicate(solo.data.connectionId);
  assert.equal(copy?.accountId, solo.data.account.id);

  console.log("connection-accounts-write-through regression passed");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
