// #7098: a chat connection keeps the model list it fetched (with the fetch time) and its pinned models.
// Opening the list again answers from the saved copy without asking the provider; Refresh replaces it.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-model-list-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.js");
const { MAX_MODEL_ID_LENGTH, MAX_PINNED_MODELS, parsePinnedModels } =
  await import("../../packages/shared/src/types/connection.js");
const { sanitizeProfileTableRows, quarantineProfileApiConnectionRow } =
  await import("../../packages/server/src/routes/backup.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { createConnectionExportEnvelope, normalizeImportedConnectionEntry } =
  await import("../../packages/client/src/lib/connection-transfer.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

const SECRET = "fixture-secret-key-7098";
const NEW_SECRET = "fixture-rotated-key-7098";
let modelCalls = 0;
let failModels = false;
/** Runs once while the provider is answering /models, before the answer is sent. */
let duringModels: (() => Promise<void>) | null = null;
let catalog = [
  { id: "vendor/alpha", name: "Alpha", context_length: 64000, api_key: SECRET },
  { id: "vendor/beta", name: "Beta" },
  { id: "vendor/alpha", name: "Alpha duplicate" },
];
const provider = createServer(async (req, res) => {
  if (req.url === "/v1/models") {
    modelCalls++;
    const hook = duringModels;
    duringModels = null;
    await hook?.();
    if (failModels) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("upstream down");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: catalog, echoedAuthorization: req.headers.authorization }));
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const address = provider.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}/v1`;

let app: Awaited<ReturnType<typeof Fastify>> | null = null;
try {
  // An old row, written before pinned and saved models existed, still loads with empty values.
  let db = await getDB();
  const legacy = (await createConnectionsStorage(db).create(
    createConnectionSchema.parse({ name: "Legacy row", provider: "custom", baseUrl, apiKey: SECRET, model: "old" }),
  ))!;
  await closeDB();
  // Each row is its own file under tables/api_connections; drop the new fields as an older build wrote it.
  const tableDir = join(process.env.FILE_STORAGE_DIR, "tables", "api_connections");
  const shardFiles = readdirSync(tableDir).filter((file) => file.endsWith(".json"));
  assert.equal(shardFiles.length, 1);
  for (const file of shardFiles) {
    const stripLegacy = (row: Record<string, unknown>) => {
      const { pinnedModels: _pinned, savedModels: _saved, pinned_models: _p, saved_models: _s, ...rest } = row;
      return rest;
    };
    const stored = JSON.parse(readFileSync(join(tableDir, file), "utf8")) as unknown;
    const legacyRows = Array.isArray(stored) ? stored.map(stripLegacy) : stripLegacy(stored as Record<string, unknown>);
    assert.ok(!JSON.stringify(legacyRows).includes("pinned"));
    writeFileSync(join(tableDir, file), JSON.stringify(legacyRows));
  }

  db = await getDB();
  const storage = createConnectionsStorage(db);
  app = Fastify();
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/connections" });
  const reloaded = (await storage.getById(legacy.id))!;
  assert.equal(reloaded.pinnedModels, "[]");
  assert.equal(reloaded.savedModels, null);
  assert.equal(reloaded.model, "old");

  const get = (url: string) => app!.inject({ method: "GET", url });
  const pin = (id: string, model: string, pinned: boolean) =>
    app!.inject({ method: "POST", url: `/connections/${id}/pinned-models`, payload: { model, pinned } });

  // First look fetches from the provider and saves the list with its fetch time.
  const first = await get(`/connections/${legacy.id}/models`);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(modelCalls, 1);
  const firstBody = first.json() as { fetchedAt: string; models: Array<Record<string, unknown>> };
  assert.ok(!Number.isNaN(Date.parse(firstBody.fetchedAt)), "the saved list records when it was fetched");
  assert.deepEqual(
    firstBody.models.map((model) => model.id),
    ["vendor/alpha", "vendor/beta"],
    "duplicate model IDs are saved once",
  );
  assert.equal(firstBody.models[0]!.context, 64000);
  const savedRow = (await storage.getById(legacy.id))!;
  assert.equal(typeof savedRow.savedModels, "string");
  assert.equal(JSON.parse(savedRow.savedModels!).fetchedAt, firstBody.fetchedAt);
  for (const secret of [SECRET, savedRow.apiKeyEncrypted, "api_key", "echoedAuthorization", "Bearer"]) {
    assert.ok(!savedRow.savedModels!.includes(secret), `the saved list never holds ${secret}`);
  }

  // Opening the list again answers from the saved copy, without asking the provider.
  const second = await get(`/connections/${legacy.id}/models`);
  assert.equal(second.statusCode, 200);
  assert.equal(modelCalls, 1, "a saved list is returned without calling the provider again");
  assert.deepEqual(second.json(), firstBody);

  // Connection responses leave the saved list out; it is served from /models only.
  for (const url of ["/connections", `/connections/${legacy.id}`]) {
    const response = await get(url);
    assert.equal(response.statusCode, 200);
    assert.ok(!response.body.includes("savedModels"), `${url} leaves the saved list out`);
    assert.ok(!response.body.includes(SECRET));
  }

  // Refresh asks the provider again and replaces the saved list.
  catalog = [{ id: "vendor/gamma", name: "Gamma", context_length: 32000, api_key: SECRET }];
  const refreshed = await get(`/connections/${legacy.id}/models?refresh=true`);
  assert.equal(refreshed.statusCode, 200, refreshed.body);
  assert.equal(modelCalls, 2);
  assert.deepEqual(
    (refreshed.json() as { models: Array<{ id: string }> }).models.map((model) => model.id),
    ["vendor/gamma"],
  );
  assert.deepEqual(
    JSON.parse((await storage.getById(legacy.id))!.savedModels!).models.map((model: { id: string }) => model.id),
    ["vendor/gamma"],
  );

  // A failed refresh reports the error and keeps the list that was saved before.
  failModels = true;
  const failed = await get(`/connections/${legacy.id}/models?refresh=true`);
  assert.equal(failed.statusCode, 502);
  assert.match((failed.json() as { error: string }).error, /Provider returned 500/u);
  assert.equal(modelCalls, 3);
  failModels = false;
  assert.deepEqual(
    (await get(`/connections/${legacy.id}/models`)).json().models.map((model: { id: string }) => model.id),
    ["vendor/gamma"],
  );
  assert.equal(modelCalls, 3);

  // Pins persist in pin order, never repeat, and can hold a typed ID that is not in the list.
  assert.deepEqual((await pin(legacy.id, "typed/custom-model", true)).json(), {
    pinnedModels: ["typed/custom-model"],
  });
  assert.deepEqual((await pin(legacy.id, "vendor/gamma", true)).json(), {
    pinnedModels: ["typed/custom-model", "vendor/gamma"],
  });
  assert.deepEqual((await pin(legacy.id, "vendor/gamma", true)).json(), {
    pinnedModels: ["typed/custom-model", "vendor/gamma"],
  });
  assert.deepEqual((await pin(legacy.id, "typed/custom-model", false)).json(), { pinnedModels: ["vendor/gamma"] });
  assert.equal((await pin(legacy.id, "  ", true)).statusCode, 400);
  assert.equal((await pin("missing-connection", "vendor/gamma", true)).statusCode, 404);
  const listed = (await get("/connections")).json() as Array<{ id: string; pinnedModels: string }>;
  assert.equal(listed.find((row) => row.id === legacy.id)?.pinnedModels, JSON.stringify(["vendor/gamma"]));

  // Saving the editor with the same address and key keeps the list; a new key or address drops it.
  const sameValues = await app.inject({
    method: "PATCH",
    url: `/connections/${legacy.id}`,
    payload: { baseUrl, provider: "custom", model: "vendor/gamma", maxContext: 32000 },
  });
  assert.equal(sameValues.statusCode, 200, sameValues.body);
  assert.notEqual((await storage.getById(legacy.id))!.savedModels, null);
  assert.equal(JSON.parse((await storage.getById(legacy.id))!.pinnedModels).length, 1, "the editor keeps pins");
  const staleSnapshot = (await storage.getWithKey(legacy.id))!;
  await app.inject({ method: "PATCH", url: `/connections/${legacy.id}`, payload: { apiKey: NEW_SECRET } });
  assert.equal((await storage.getById(legacy.id))!.savedModels, null, "a new API key drops the saved list");
  assert.equal(
    await storage.saveModelListIfUnchanged(staleSnapshot, [{ id: "stale/model", name: "Stale" }]),
    null,
    "a fetch made with the old key is not saved after the key changed",
  );
  assert.equal((await storage.getById(legacy.id))!.savedModels, null);
  await get(`/connections/${legacy.id}/models`);
  assert.equal(modelCalls, 4, "with nothing saved, the next look fetches again");
  await app.inject({ method: "PATCH", url: `/connections/${legacy.id}`, payload: { baseUrl: `${baseUrl}/` } });
  assert.equal((await storage.getById(legacy.id))!.savedModels, null, "a new base URL drops the saved list");
  await app.inject({ method: "PATCH", url: `/connections/${legacy.id}`, payload: { baseUrl } });
  await get(`/connections/${legacy.id}/models`);
  assert.equal(modelCalls, 5);

  // A refresh that finishes after the key changed answers 409 instead of handing out the old key's list.
  duringModels = async () => {
    const changed = await app!.inject({
      method: "PATCH",
      url: `/connections/${legacy.id}`,
      payload: { apiKey: SECRET },
    });
    assert.equal(changed.statusCode, 200, changed.body);
  };
  const raced = await get(`/connections/${legacy.id}/models?refresh=true`);
  assert.equal(raced.statusCode, 409, raced.body);
  assert.match((raced.json() as { error: string }).error, /changed while its models were loading/u);
  assert.equal(modelCalls, 6);
  assert.equal((await storage.getById(legacy.id))!.savedModels, null, "the old key's list is not saved");
  const reloaded409 = await get(`/connections/${legacy.id}/models`);
  assert.equal(reloaded409.statusCode, 200);
  assert.equal(modelCalls, 7, "the next look loads the list for the new key");

  // A different provider drops the saved list too.
  const providerChange = (await storage.duplicate(legacy.id))!;
  assert.ok(providerChange.savedModels);
  await app.inject({ method: "PATCH", url: `/connections/${providerChange.id}`, payload: { provider: "openai" } });
  assert.equal((await storage.getById(providerChange.id))!.savedModels, null, "a new provider drops the saved list");
  await storage.remove(providerChange.id);

  // Pins are capped at 100 per connection and model IDs at 512 characters.
  const limits = (await storage.create(
    createConnectionSchema.parse({ name: "Pin limits", provider: "custom", baseUrl }),
  ))!;
  for (let index = 0; index < MAX_PINNED_MODELS; index++) {
    assert.notEqual(await storage.setModelPinned(limits.id, `pin/${index}`, true), "limit");
  }
  const overLimit = await pin(limits.id, "pin/one-too-many", true);
  assert.equal(overLimit.statusCode, 400);
  assert.match((overLimit.json() as { error: string }).error, /up to 100 models/u);
  assert.equal((await pin(limits.id, "pin/0", true)).statusCode, 200, "re-pinning a pinned model is fine at the cap");
  assert.equal(parsePinnedModels((await storage.getById(limits.id))!.pinnedModels).length, MAX_PINNED_MODELS);
  await pin(limits.id, "pin/0", false);
  assert.equal((await pin(limits.id, "x".repeat(MAX_MODEL_ID_LENGTH + 1), true)).statusCode, 400);
  assert.equal((await pin(limits.id, "x".repeat(MAX_MODEL_ID_LENGTH), true)).statusCode, 200);
  const tooMany = await app.inject({
    method: "PATCH",
    url: `/connections/${limits.id}`,
    payload: { pinnedModels: Array.from({ length: MAX_PINNED_MODELS + 1 }, (_, index) => `many/${index}`) },
  });
  assert.ok(tooMany.statusCode >= 400, "a PATCH cannot store more than 100 pins");
  assert.ok(!(await storage.getById(limits.id))!.pinnedModels.includes("many/"));
  assert.deepEqual(
    parsePinnedModels(JSON.stringify([...Array.from({ length: 150 }, (_, i) => `m/${i}`), "y".repeat(600)])).length,
    MAX_PINNED_MODELS,
    "stored pins read back at most 100, without over-long IDs",
  );
  await storage.remove(limits.id);

  // A copy keeps the same endpoint, so it keeps the saved list and the pins.
  const copy = (await storage.duplicate(legacy.id))!;
  assert.equal(copy.savedModels, (await storage.getById(legacy.id))!.savedModels);
  assert.equal(copy.pinnedModels, JSON.stringify(["vendor/gamma"]));

  // Built-in lists (Claude Subscription) and media connections are answered live and never saved.
  const claude = (await storage.create(
    createConnectionSchema.parse({ name: "Claude Sub", provider: "claude_subscription" }),
  ))!;
  assert.equal((await get(`/connections/${claude.id}/models`)).statusCode, 200);
  assert.equal((await storage.getById(claude.id))!.savedModels, null);
  const image = (await storage.create(
    createConnectionSchema.parse({ name: "Image", provider: "image_generation", baseUrl, imageService: "openai" }),
  ))!;
  await get(`/connections/${image.id}/models`);
  assert.equal((await storage.getById(image.id))!.savedModels, null);

  // Profile backups keep pins and leave the saved list out; an import only reuses the local list for the
  // same endpoint, the way it reuses the local key.
  const row = (await storage.getById(legacy.id))! as unknown as Record<string, unknown>;
  assert.ok(row.savedModels);
  const [exportedRow] = sanitizeProfileTableRows("api_connections", [row]);
  assert.equal(exportedRow!.savedModels, null);
  assert.equal(exportedRow!.pinnedModels, JSON.stringify(["vendor/gamma"]));
  assert.equal(quarantineProfileApiConnectionRow({ ...row }).row.savedModels, null);
  assert.equal(quarantineProfileApiConnectionRow(exportedRow!, row).row.savedModels, row.savedModels);
  assert.equal(
    quarantineProfileApiConnectionRow(exportedRow!, { ...row, baseUrl: "https://elsewhere.example/v1" }).row
      .savedModels,
    null,
  );

  // A connection file export carries the pins, never the saved list, and importing restores the pins.
  const envelope = createConnectionExportEnvelope([row]);
  const exportedJson = JSON.stringify(envelope);
  assert.ok(!exportedJson.includes("savedModels"));
  assert.ok(!exportedJson.includes("fetchedAt"));
  assert.deepEqual(envelope.connections[0]!.pinnedModels, ["vendor/gamma"]);
  assert.deepEqual(normalizeImportedConnectionEntry(envelope.connections[0])!.connection.pinnedModels, [
    "vendor/gamma",
  ]);
  const created = await app.inject({
    method: "POST",
    url: "/connections",
    payload: normalizeImportedConnectionEntry(envelope.connections[0])!.connection,
  });
  assert.equal(created.statusCode, 200, created.body);
  assert.equal(created.json().pinnedModels, JSON.stringify(["vendor/gamma"]));
  assert.ok(!created.body.includes("savedModels"));

  // A deleted connection has no model list.
  await app.inject({ method: "DELETE", url: `/connections/${copy.id}` });
  assert.equal((await get(`/connections/${copy.id}/models`)).statusCode, 404);

  console.info(
    "Connection model lists are saved with their fetch time, reused, refreshed and kept apart from secrets.",
  );
} finally {
  await app?.close();
  await closeDB();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
