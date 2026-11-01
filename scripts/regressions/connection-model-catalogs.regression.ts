// Precached catalogs: one model list per Connection and provider (not a copy per Model), richer per-model metadata
// (pricing, modalities, free, deprecation), the cost badge and Connection billing, and the background refresh rules.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-model-catalogs-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createConnectionsStorage, readAccountCatalogs } =
  await import("../../packages/server/src/services/storage/connections.storage.js");
const { linkConnectionAccounts, moveCatalogsToAccounts } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const {
  CATALOG_FRESH_MS,
  CATALOG_REFRESH_INTERVAL_MS,
  catalogBackoffMs,
  catalogRefreshSkipReason,
  dueCatalogRows,
  readCatalogModelMetadata,
  startModelCatalogRefresh,
} = await import("../../packages/server/src/services/connections/model-catalog.js");
const { connectionBilling, modelCost, PROVIDERS } = await import("../../packages/shared/src/index.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

// ── Metadata parse (fixtures shaped like the real lists, no network) ──
const nano = readCatalogModelMetadata("nanogpt", {
  id: "deepseek-chat",
  pricing: { prompt: 0.28, completion: 0.42, currency: "USD", unit: "per_million_tokens" },
  capabilities: { vision: true, reasoning: false },
  subscription: { included: true, inputTokenMultiplier: 2 },
});
assert.deepEqual(nano, { pricing: { prompt: 0.28, completion: 0.42 }, inputModalities: ["text", "image"] });
assert.deepEqual(readCatalogModelMetadata("nanogpt", { id: "free-one", pricing: { prompt: 0, completion: 0 } }), {
  pricing: { prompt: 0, completion: 0 },
  free: true,
});
assert.deepEqual(
  readCatalogModelMetadata("nanogpt", { id: "eur", pricing: { prompt: 1, completion: 2, currency: "EUR" } }),
  {},
  "a non-USD price is left out",
);
const router = readCatalogModelMetadata("openrouter", {
  id: "anthropic/claude-sonnet-5.5",
  pricing: { prompt: "0.000003", completion: "0.000015", image: "0.0048" },
  architecture: { input_modalities: ["text", "image", "file"], output_modalities: ["text"] },
  expiration_date: "2026-12-31",
});
assert.deepEqual(router, {
  pricing: { prompt: 3, completion: 15 },
  inputModalities: ["text", "image", "file"],
  outputModalities: ["text"],
  deprecated: true,
  retiresAt: "2026-12-31",
});
assert.equal(
  readCatalogModelMetadata("openrouter", { id: "meta/llama:free", pricing: { prompt: "0", completion: "0" } }).free,
  true,
);
assert.equal(readCatalogModelMetadata("openrouter", { id: "x/y:free" }).free, true, "the :free id alone is free");
assert.deepEqual(
  readCatalogModelMetadata("openrouter", { id: "openrouter/auto", pricing: { prompt: "-1", completion: "-1" } }),
  {},
  "a variable-price router has no price",
);
assert.deepEqual(
  readCatalogModelMetadata("anthropic", {
    id: "claude-old",
    lifecycle: { status: "deprecated", deprecated_at: "2026-05-01T00:00:00Z", retires_at: "2026-11-01T00:00:00Z" },
  }),
  { deprecated: true, retiresAt: "2026-11-01T00:00:00Z" },
);
assert.deepEqual(readCatalogModelMetadata("mistral", { id: "mistral-old", deprecation: "2026-10-30T12:00:00Z" }), {
  deprecated: true,
  retiresAt: "2026-10-30T12:00:00Z",
});
assert.deepEqual(readCatalogModelMetadata("custom", { id: "plain", deprecation: null }), {});

// ── Cost badge and Connection billing ──
assert.equal(PROVIDERS.arli.billing, "plan");
assert.equal(connectionBilling({ provider: "arli" }), "plan");
assert.equal(connectionBilling({ provider: "claude_subscription" }), "plan");
assert.equal(connectionBilling({ provider: "openai" }), null);
assert.equal(connectionBilling({ provider: "image_generation", imageGenerationSource: "horde" }), "free");
assert.equal(
  connectionBilling({ provider: "image_generation", baseUrl: "https://image.pollinations.ai", model: "" }),
  "free",
);
assert.equal(connectionBilling({ provider: "image_generation", imageGenerationSource: "openai" }), null);
assert.equal(modelCost({ subscriptionIncluded: true, inputTokenMultiplier: 2 }, null), "multiplier:2");
assert.equal(modelCost({ subscriptionIncluded: true, inputTokenMultiplier: 1 }, null), "included");
assert.equal(modelCost({ subscriptionIncluded: true }, null, true), "included", "active plan keeps the badge");
assert.equal(modelCost({ subscriptionIncluded: true }, null, false), null, "no active plan, no Plan badge");
assert.equal(modelCost({ subscriptionIncluded: true, pricing: { prompt: 5 } }, null, false), "paid", "no plan: own price shows");
assert.equal(modelCost({ subscriptionIncluded: true }, null, null), "included", "unknown plan state is unchanged");
assert.equal(modelCost({ subscriptionIncluded: true, pricing: { prompt: 5 } }, null), "included", "plan wins");
assert.equal(modelCost({ subscriptionIncluded: false, pricing: { prompt: 0.1 } }, null), "paid");
assert.equal(modelCost({ free: true, pricing: { prompt: 0, completion: 0 } }, null), "free");
assert.equal(modelCost({ pricing: { prompt: 3, completion: 15 } }, null), "paid");
assert.equal(modelCost({}, "free"), "free", "a free service makes every model free");
assert.equal(modelCost({}, "plan"), null, "a plan Connection says Plan once, not per model");
assert.equal(modelCost({ pricing: { prompt: 0 } }, null), null, "no completion price: unknown, not free");

// ── Background refresh rules ──
const NOW = Date.parse("2026-10-19T12:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const baseRow = {
  id: "r1",
  provider: "openai",
  baseUrl: "",
  accountId: null as string | null,
  treatAsLocalEndpoint: "false",
  profileImportReviewRequired: "false",
  savedModels: null as string | null,
  updatedAt: iso(0),
};
const row = (patch: Partial<typeof baseRow>) => ({ ...baseRow, ...patch }) as never;
const list = (msAgo: number) => JSON.stringify({ fetchedAt: iso(msAgo), models: [{ id: "m", name: "m" }] });
const okAccount = {
  id: "acc",
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKeyEncrypted: "",
  enabled: "true",
  profileImportReviewRequired: "false",
  treatAsLocalEndpoint: "true",
  modelCatalogs: null as string | null,
};
assert.equal(catalogRefreshSkipReason(row({}), null, NOW), null, "no list yet: due");
assert.equal(catalogRefreshSkipReason(row({ savedModels: list(CATALOG_FRESH_MS - 60_000) }), null, NOW), "fresh");
assert.equal(catalogRefreshSkipReason(row({ savedModels: list(CATALOG_FRESH_MS + 60_000) }), null, NOW), null);
assert.equal(catalogRefreshSkipReason(row({ provider: "claude_subscription" }), null, NOW), "no_list");
assert.equal(catalogRefreshSkipReason(row({ provider: "openai_chatgpt" }), null, NOW), "no_list", "local CLI");
assert.equal(catalogRefreshSkipReason(row({ provider: "image_generation" }), null, NOW), "no_list");
assert.equal(catalogRefreshSkipReason(row({ baseUrl: "http://127.0.0.1:1234/v1" }), null, NOW), "local");
assert.equal(catalogRefreshSkipReason(row({ baseUrl: "http://lmstudio.local/v1" }), null, NOW), "local");
assert.equal(catalogRefreshSkipReason(row({ treatAsLocalEndpoint: "true" }), null, NOW), "local");
assert.equal(catalogRefreshSkipReason(row({ profileImportReviewRequired: "true" }), null, NOW), "blocked");
assert.equal(
  catalogRefreshSkipReason(row({ accountId: "acc" }), { ...okAccount, enabled: "false" } as never, NOW),
  "blocked",
  "a disabled Connection is left alone",
);
assert.equal(catalogRefreshSkipReason(row({}), null, NOW, NOW + 1), "backoff");
assert.equal(
  catalogRefreshSkipReason(
    row({ accountId: "acc" }),
    { ...okAccount, modelCatalogs: JSON.stringify({ openai: JSON.parse(list(60_000)) }) } as never,
    NOW,
  ),
  "fresh",
  "the Connection's catalog decides",
);
assert.equal(catalogBackoffMs(1), CATALOG_REFRESH_INTERVAL_MS);
assert.equal(catalogBackoffMs(2), 2 * CATALOG_REFRESH_INTERVAL_MS);
assert.equal(catalogBackoffMs(20), 7 * CATALOG_REFRESH_INTERVAL_MS, "at most a week");
const due = dueCatalogRows(
  [
    row({ id: "a-old", accountId: "acc", updatedAt: iso(5000) }),
    row({ id: "a-new", accountId: "acc", updatedAt: iso(1000) }),
    row({ id: "solo", updatedAt: iso(2000) }),
    row({ id: "local", baseUrl: "http://localhost:11434/v1" }),
    row({ id: "fresh", savedModels: list(1000) }),
  ],
  [okAccount as never],
  NOW,
);
assert.deepEqual(
  due.map((entry: { id: string }) => entry.id),
  ["a-new", "solo"],
  "one Model per catalog, newest first; local and fresh lists skipped",
);
process.env.MODEL_CATALOG_REFRESH = "false";
const stop = startModelCatalogRefresh(null as never);
stop();
delete process.env.MODEL_CATALOG_REFRESH;

// ── Storage: one catalog per Connection, migration dedupes old copies ──
let modelCalls = 0;
const provider = createServer((req, res) => {
  if (req.url === "/v1/models") {
    modelCalls++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: [
          {
            id: "vendor/paid",
            name: "Paid",
            context_length: 128000,
            pricing: { prompt: "0.000002", completion: "0.000008" },
            architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
          },
          { id: "vendor/thing:free", name: "Free", pricing: { prompt: "0", completion: "0" } },
          { id: "vendor/unknown", name: "Unknown" },
        ],
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const address = provider.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}/v1`;

const db = await getDB();
const app = Fastify();
try {
  const storage = createConnectionsStorage(db);
  const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
  const accountOf = async (id: string) =>
    (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, id)))[0]!;
  const key = "fixture-catalog-key-1111";
  const a = (await storage.create({ name: "A", provider: "custom", baseUrl, apiKey: key, model: "x" } as never))!;
  const b = (await storage.create({ name: "B", provider: "custom", baseUrl, apiKey: key, model: "y" } as never))!;
  const solo = (await storage.create({
    name: "Solo",
    provider: "custom",
    baseUrl,
    apiKey: "fixture-other-key-2222",
    model: "z",
  } as never))!;
  const accountId = (await rowOf(a.id)).accountId!;
  assert.equal((await rowOf(b.id)).accountId, accountId, "one key, one Connection");

  // The old layout: every Model of the Connection carried its own copy (here an older and a newer one).
  const older = { fetchedAt: "2026-10-01T00:00:00.000Z", models: [{ id: "old", name: "Old" }] };
  const newer = { fetchedAt: "2026-10-02T00:00:00.000Z", models: [{ id: "new", name: "New", context: 9 }] };
  await db
    .update(apiConnections)
    .set({ savedModels: JSON.stringify(older) })
    .where(eq(apiConnections.id, a.id));
  await db
    .update(apiConnections)
    .set({ savedModels: JSON.stringify(newer) })
    .where(eq(apiConnections.id, b.id));
  await db.update(apiConnections).set({ savedModels: null, accountId: null }).where(eq(apiConnections.id, solo.id));
  await db
    .update(apiConnections)
    .set({ savedModels: JSON.stringify(older) })
    .where(eq(apiConnections.id, solo.id));
  await linkConnectionAccounts(db);
  const soloAfter = await rowOf(solo.id);
  // Linking may give the solo row its own Connection; either way it reads its list.
  assert.deepEqual(await storage.readCatalog(soloAfter), older, "a single Model keeps its list");
  assert.equal((await rowOf(a.id)).savedModels, null, "no copy left on the rows");
  assert.equal((await rowOf(b.id)).savedModels, null);
  assert.deepEqual(readAccountCatalogs(await accountOf(accountId)), { custom: newer }, "the newest list wins, once");
  assert.deepEqual(await storage.readCatalog(await rowOf(a.id)), newer, "every Model reads the Connection's list");
  assert.equal(await moveCatalogsToAccounts(db), 0, "idempotent");

  // Fetch through the route: one save on the Connection, served from cache with fetchedAt, costs and billing.
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/connections" });
  const fetched = await app.inject({ method: "GET", url: `/connections/${a.id}/models?refresh=true` });
  assert.equal(fetched.statusCode, 200, fetched.body);
  const body = fetched.json() as { fetchedAt: string; billing: null; models: Array<Record<string, unknown>> };
  assert.ok(Number.isFinite(Date.parse(body.fetchedAt)));
  assert.equal(body.billing, null);
  assert.deepEqual(body.models[0], {
    id: "vendor/paid",
    name: "Paid",
    context: 128000,
    pricing: { prompt: 2, completion: 8 },
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    cost: "paid",
  });
  assert.equal(body.models[1]!.free, true);
  assert.equal(body.models[1]!.cost, "free");
  assert.equal(body.models[2]!.cost, undefined, "unknown cost is left out");
  assert.equal((await rowOf(a.id)).savedModels, null);
  assert.equal((await accountOf(accountId)).modelCatalogs!.split('"vendor/paid"').length - 1, 1, "kept once");
  const cached = await app.inject({ method: "GET", url: `/connections/${b.id}/models` });
  assert.equal(modelCalls, 1, "the peer answers from the Connection's cache");
  assert.deepEqual(cached.json(), body);

  // A new key empties the Connection's lists.
  const { createConnectionAccountsStorage } =
    await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
  await createConnectionAccountsStorage(db).update(accountId, { apiKey: "fixture-rotated-3333" } as never);
  assert.equal((await accountOf(accountId)).modelCatalogs, null);
  assert.equal(await storage.readCatalog(await rowOf(a.id)), null);

  console.info("connection-model-catalogs regression passed");
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
