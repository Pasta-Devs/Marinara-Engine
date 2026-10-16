// Connection accounts, decision 30: the star is a saved model's only state. The upgrade stars every saved model once
// (a later unstar stays unstarred); unstarring tells whether the model may go; the removal re-checks the keep reasons
// (role, own settings, use by a feature, the last chat Model) and a chat that used the model keeps it as its pick.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-connection-model-stars-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { apiConnections, chats } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { starSavedModels } = await import("../../packages/server/src/services/connections/model-stars.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { CHAT_MODEL_OVERRIDE_KEY, FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY, parsePinnedModels } =
  await import("../../packages/shared/src/index.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
const json = async (method: "GET" | "POST" | "DELETE", url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
  return { status: response.statusCode, body: response.body, data: response.body ? JSON.parse(response.body) : null };
};
const rowOf = async (id: string) => (await db.select().from(apiConnections).where(eq(apiConnections.id, id)))[0];
const stars = async (id: string) => parsePinnedModels((await rowOf(id))!.pinnedModels);
const save = async (accountId: string, model: string) => {
  const saved = await json("POST", `/accounts/${accountId}/for-model`, { model });
  assert.ok(saved.status === 200 || saved.status === 201, saved.body);
  return saved.data.connectionId as string;
};

try {
  const created = await json("POST", "/accounts", { provider: "openai", apiKey: "fixture-key-1111", model: "gpt-a" });
  assert.equal(created.status, 201, created.body);
  const account = created.data.account.id as string;
  const a = created.data.connectionId as string;
  const b = await save(account, "gpt-b");
  const c = await save(account, "gpt-c");
  assert.deepEqual(await stars(a), [], "saving a model does not star it on the server");

  // ── Upgrade: every saved model gets a star, once ──
  assert.equal(await starSavedModels(db), 3);
  for (const id of [a, b, c]) assert.deepEqual(await stars(id), ["gpt-a", "gpt-b", "gpt-c"], "stars are shared");
  assert.equal(await starSavedModels(db), 0, "the second run does nothing");

  // ── Unstar: removable when nothing keeps it ──
  const unstarB = await json("POST", `/accounts/${account}/models/${b}/unstar`);
  assert.equal(unstarB.status, 200, unstarB.body);
  assert.equal(unstarB.data.removable, true);
  assert.deepEqual(await stars(a), ["gpt-a", "gpt-c"]);
  assert.equal(await starSavedModels(db), 0, "an unstar after the upgrade stays");
  assert.deepEqual(await stars(b), ["gpt-a", "gpt-c"]);
  // A model saved later takes the shared stars; an empty list of its own would wipe them on its first star.
  const d = await save(account, "gpt-d");
  assert.deepEqual(await stars(d), ["gpt-a", "gpt-c"], "a new Model takes the shared stars");
  assert.equal((await json("DELETE", `/accounts/${account}/models/${d}`)).status, 204);

  // A chat that uses the model keeps it as its catalog pick on a sibling Model.
  await db.insert(chats).values({ id: "chat-b", name: "B", mode: "conversation", connectionId: b });
  const removeB = await json("DELETE", `/accounts/${account}/models/${b}`);
  assert.equal(removeB.status, 204, removeB.body);
  assert.equal(await rowOf(b), undefined, "the unstarred model is gone");
  const [chat] = await db.select().from(chats).where(eq(chats.id, "chat-b"));
  assert.ok(chat!.connectionId === a || chat!.connectionId === c, "the chat moved to a sibling Model");
  const override = JSON.parse(chat!.metadata)[CHAT_MODEL_OVERRIDE_KEY];
  assert.equal(override.model, "gpt-b", "the chat still answers with the model it used");
  assert.equal(override.connectionId, chat!.connectionId);

  // ── Keep reasons ──
  // A starred model is never removed, even when asked.
  assert.equal((await json("DELETE", `/accounts/${account}/models/${c}`)).data.reason, "starred");
  // A role keeps it.
  await db.update(apiConnections).set({ isDefault: "true" }).where(eq(apiConnections.id, c));
  assert.equal((await json("POST", `/accounts/${account}/models/${c}/unstar`)).data.removable, false);
  assert.equal((await json("DELETE", `/accounts/${account}/models/${c}`)).data.reason, "role");
  await db.update(apiConnections).set({ isDefault: "false" }).where(eq(apiConnections.id, c));
  // Settings of its own keep it.
  await db.update(apiConnections).set({ name: "My GPT" }).where(eq(apiConnections.id, c));
  assert.equal((await json("DELETE", `/accounts/${account}/models/${c}`)).data.reason, "settings");
  await db.update(apiConnections).set({ name: "gpt-c" }).where(eq(apiConnections.id, c));
  // A Model that borrows its key (a Decision connection) keeps it.
  await db.update(apiConnections).set({ credentialsFromConnectionId: c }).where(eq(apiConnections.id, a));
  assert.equal((await json("DELETE", `/accounts/${account}/models/${c}`)).data.reason, "in_use");
  await db.update(apiConnections).set({ credentialsFromConnectionId: null }).where(eq(apiConnections.id, a));
  // A feature that uses it keeps it.
  await createAppSettingsStorage(db).set(
    FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY,
    JSON.stringify({ mariConnectionId: c }),
  );
  assert.equal((await json("DELETE", `/accounts/${account}/models/${c}`)).data.reason, "in_use");
  await createAppSettingsStorage(db).set(FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY, "{}");
  assert.equal((await json("DELETE", `/accounts/${account}/models/${c}`)).status, 204, "nothing keeps it any more");
  // The last chat Model carries the Connection's catalog and stars; it stays.
  assert.equal((await json("POST", `/accounts/${account}/models/${a}/unstar`)).data.removable, false);
  assert.equal((await json("DELETE", `/accounts/${account}/models/${a}`)).data.reason, "last");
  assert.equal((await json("DELETE", `/accounts/${account}/models/missing`)).status, 404);

  console.log("connection-model-stars regression passed");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
