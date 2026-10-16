// Connection accounts, decisions 27/28: an automatic name gets the key's last 4 when another Connection of the same
// service exists (a typed name stays as typed; two custom hosts are already apart); "Move to connection…" moves a
// Model to another Connection of the same service, takes its key and catalog, keeps the Model's id and respects the
// review gate; the catalog search ranks starred, then saved, then prefix matches, then the rest, before the limit.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-accounts-names-move-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, connectionAccounts } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { decryptApiKey, encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { linkConnectionAccounts } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { rankModelMatch, withKeyTail } = await import("../../packages/shared/src/index.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
await app.register(connectionsRoutes, { prefix: "/connections" });
const json = async (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
  return { status: response.statusCode, body: response.body, data: response.body ? JSON.parse(response.body) : null };
};
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0]!;
const addAccount = async (payload: Record<string, unknown>) => {
  const created = await json("POST", "/accounts", { model: "", ...payload });
  assert.equal(created.status, 201, created.body);
  return {
    id: created.data.account.id as string,
    name: created.data.account.name as string,
    row: created.data.connectionId as string,
  };
};

try {
  // ── The rank (pure) ──
  assert.equal(withKeyTail("OpenAI", "sk-test-a1b2"), "OpenAI · …a1b2");
  assert.equal(withKeyTail("OpenAI", "short"), "OpenAI", "a short key would be mostly revealed");
  assert.equal(rankModelMatch("sonnet", { id: "anthropic/claude-sonnet-4" }), 2, "a word of the id starts with it");
  assert.equal(rankModelMatch("claude-son", { id: "anthropic/claude-sonnet-4" }), 2, "the id after its vendor");
  assert.equal(rankModelMatch("onnet", { id: "anthropic/claude-sonnet-4" }), 3);
  assert.equal(rankModelMatch("gpt", { id: "x/y", name: "Big GPT" }), 2, "a word of the name");
  assert.equal(rankModelMatch("zzz", { id: "anthropic/claude-sonnet-4" }), -1);
  assert.equal(rankModelMatch("son", { id: "anthropic/claude-sonnet-4" }, { saved: true }), 1);
  assert.equal(rankModelMatch("onnet", { id: "anthropic/claude-sonnet-4" }, { starred: true, saved: true }), 0);
  assert.equal(rankModelMatch("zzz", { id: "anthropic/claude-sonnet-4" }, { starred: true }), -1, "no match stays out");

  // ── Distinct automatic names at creation ──
  const first = await addAccount({ provider: "openai", apiKey: "fixture-openai-key-1111" });
  assert.equal(first.name, "OpenAI", "the only Connection of its service keeps the plain name");
  const second = await addAccount({ provider: "openai", apiKey: "fixture-openai-key-2222" });
  assert.equal(second.name, "OpenAI · …2222");
  const typed = await addAccount({ provider: "openai", apiKey: "fixture-openai-key-3333", name: "Work key" });
  assert.equal(typed.name, "Work key", "a typed name is never changed");
  assert.equal((await json("GET", "/accounts")).data.find((a: { id: string }) => a.id === first.id).name, "OpenAI");
  const hostA = await addAccount({
    provider: "custom",
    baseUrl: "https://a.example/v1",
    apiKey: "fixture-custom-aaaa",
  });
  const hostB = await addAccount({
    provider: "custom",
    baseUrl: "https://b.example/v1",
    apiKey: "fixture-custom-bbbb",
  });
  assert.equal(hostA.name, "Custom · a.example");
  assert.equal(hostB.name, "Custom · b.example", "two hosts are already apart");
  const hostA2 = await addAccount({
    provider: "custom",
    baseUrl: "https://a.example/v1",
    apiKey: "fixture-custom-cccc",
  });
  assert.equal(hostA2.name, "Custom · a.example · …cccc");

  // ── Distinct automatic names at migration (startup linking): only the accounts it creates are named ──
  // Raw rows, as an older build left them: no account yet.
  const stamp = new Date().toISOString();
  for (const [id, provider, key] of [
    ["legacy-router-1", "openrouter", "fixture-router-key-4444"],
    ["legacy-router-2", "openrouter", "fixture-router-key-5555"],
    ["legacy-xai", "xai", "fixture-xai-key-6666"],
  ] as const) {
    await db.insert(apiConnections).values({
      id,
      name: id,
      provider,
      model: "m",
      apiKeyEncrypted: encryptApiKey(key),
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  const nameOf = async (rowName: string) => {
    const row = (await db.select().from(apiConnections).where(eq(apiConnections.name, rowName)))[0]!;
    const account = (await db.select().from(connectionAccounts).where(eq(connectionAccounts.id, row.accountId!)))[0]!;
    return account.name;
  };
  await linkConnectionAccounts(db);
  assert.equal(await nameOf("legacy-router-1"), "OpenRouter · …4444");
  assert.equal(await nameOf("legacy-router-2"), "OpenRouter · …5555");
  assert.equal(await nameOf("legacy-xai"), "xAI / Grok", "a single Connection of its service keeps the plain name");

  // ── Move to connection ──
  const model = await connections.create({
    name: "Mover",
    provider: "openai",
    model: "gpt-move",
    accountId: first.id,
  } as never);
  assert(model);
  await connections.setModelPinned(second.row, "starred-on-second", true);
  assert(await connections.saveModelListIfUnchanged(await rowOf(second.row), [{ id: "from-second", name: "Second" }]));
  const moved = await json("POST", `/connections/${model.id}/move`, { accountId: second.id });
  assert.equal(moved.status, 200, moved.body);
  assert(!moved.body.includes("fixture-openai-key"), "the response is masked");
  const after = await rowOf(model.id);
  assert.equal(after.accountId, second.id);
  assert.equal(
    decryptApiKey(after.apiKeyEncrypted),
    "fixture-openai-key-2222",
    "the key comes from the new Connection",
  );
  assert.deepEqual(JSON.parse(after.pinnedModels), ["starred-on-second"], "its favorites apply");
  assert.match(after.savedModels ?? "", /from-second/u, "its catalog applies");
  assert.equal((await connections.getWithKey(model.id))?.id, model.id, "the id stays, so references keep working");
  assert.deepEqual(await linkConnectionAccounts(db), { created: 0, linked: 0, detached: 0 }, "the link is consistent");

  // Another service, the same Connection, an unknown one, a bad body: refused.
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: hostA.id })).status, 400);
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: second.id })).status, 400);
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: "nope" })).status, 404);
  assert.equal((await json("POST", `/connections/${model.id}/move`, {})).status, 400);
  assert.equal((await json("POST", `/connections/nope/move`, { accountId: second.id })).status, 404);

  // The review gate: an imported Model under review cannot take a trusted key by moving.
  await db.update(apiConnections).set({ profileImportReviewRequired: "true" }).where(eq(apiConnections.id, model.id));
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: first.id })).status, 409);
  assert.equal((await rowOf(model.id)).accountId, second.id);
  await db.update(apiConnections).set({ profileImportReviewRequired: "false" }).where(eq(apiConnections.id, model.id));
  // A Connection that is off blocks the Model that moves into it.
  await json("PATCH", `/accounts/${first.id}`, { enabled: false });
  assert.equal((await json("POST", `/connections/${model.id}/move`, { accountId: first.id })).status, 200);
  assert.equal(await connections.getWithKey(model.id), null);
  await json("PATCH", `/accounts/${first.id}`, { enabled: true });

  // ── Catalog search order: starred, saved, prefix, substring; ranked before the limit ──
  const catalogRow = await rowOf(hostB.row);
  assert(
    await connections.saveModelListIfUnchanged(catalogRow, [
      { id: "v/zalpha", name: "Inside" },
      { id: "v/alpha-one", name: "Prefix" },
      { id: "v/alpha-saved", name: "Saved" },
      { id: "v/zz-alphastar", name: "Starred" },
      { id: "v/unrelated", name: "Other" },
    ]),
  );
  await connections.create({
    name: "Saved",
    provider: "custom",
    baseUrl: "https://b.example/v1",
    model: "v/alpha-saved",
    accountId: hostB.id,
  } as never);
  await connections.setModelPinned(hostB.row, "v/zz-alphastar", true);
  const search = async (limit: number) =>
    (await json("GET", `/accounts/catalog-search?q=alpha&limit=${limit}`)).data
      .filter((hit: { accountId: string }) => hit.accountId === hostB.id)
      .map((hit: { model: string }) => hit.model);
  assert.deepEqual(await search(30), ["v/zz-alphastar", "v/alpha-saved", "v/alpha-one", "v/zalpha"]);
  assert.deepEqual(await search(2), ["v/zz-alphastar", "v/alpha-saved"], "the limit cuts after ranking");
  console.log("connection-accounts-names-move-search: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
