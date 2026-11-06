import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-create-main-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
let content = '[react: emoji="😂"]';
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  await createConnectionsStorage(db).update(connection.id, { isDefault: "true" });
  const response = await app.inject({
    method: "POST",
    url: "/api/chats/",
    payload: { name: "Fresh", mode: "conversation", characterIds: [] },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().connectionId, null, "A new chat follows Main until a model is picked");
  const { readChatFollowsMain, resolveChatConnectionOrFallback } =
    await import("../../packages/server/src/services/generation/connection-resolution.js");
  const created = (await chats.getById(response.json().id))!;
  assert.equal(readChatFollowsMain(created), true, "A new chat is marked as following Main");
  const notices: unknown[] = [];
  const resolved = await resolveChatConnectionOrFallback(
    createConnectionsStorage(db),
    created.connectionId,
    async (notice) => void notices.push(notice),
    null,
    readChatFollowsMain(created),
  );
  assert.equal(resolved?.id, connection.id);
  assert.equal(notices.length, 0, "Following Main must not announce a deleted Model");

  // Applying a profile without a Model (the Default one, or one built with an empty Model slot), or clearing the
  // Model with a PATCH, keeps the chat on Main by choice; a PATCH after the Model was deleted keeps the notice.
  const inject = async (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => {
    const reply = await app.inject({ method, url, payload: payload as never });
    assert.ok(reply.statusCode < 300, `${method} ${url} -> ${reply.statusCode} ${reply.body}`);
    return reply.json();
  };
  const fallbackReasons = async () => {
    const chat = (await chats.getById(created.id))!;
    const reasons: unknown[] = [];
    await resolveChatConnectionOrFallback(
      createConnectionsStorage(db),
      chat.connectionId,
      async (notice) => void reasons.push(notice.reason),
      null,
      !chat.connectionId && readChatFollowsMain(chat),
    );
    return reasons;
  };
  const assertFollowsMain = async (label: string) => {
    assert.equal(readChatFollowsMain((await chats.getById(created.id))!), true, label);
    assert.deepEqual(await fallbackReasons(), [], `${label}: no deleted-Model notice`);
  };
  const defaultProfile = await inject("GET", "/api/chat-presets/active/conversation");
  assert.equal(defaultProfile.isDefault, true);
  await inject("POST", `/api/chat-presets/${defaultProfile.id}/apply/${created.id}`);
  await assertFollowsMain("the Default profile keeps the chat on Main");
  const withModel = await inject("POST", "/api/chat-presets", {
    name: "With a Model",
    mode: "conversation",
    settings: { connectionId: connection.id },
  });
  await inject("POST", `/api/chat-presets/${withModel.id}/apply/${created.id}`);
  assert.equal((await chats.getById(created.id))!.connectionId, connection.id, "a profile Model is the chat's own");
  await inject("PATCH", `/api/chats/${created.id}`, { connectionId: null });
  await assertFollowsMain("clearing the Model with a PATCH follows Main");
  const second = await createConnectionsStorage(db).create({
    name: "Second fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture-2",
    apiKey: "fixture",
  });
  await inject("PATCH", `/api/chats/${created.id}`, { connectionId: second.id });
  const modelless = await inject("POST", "/api/chat-presets", {
    name: "No Model",
    mode: "conversation",
    settings: { metadata: { contextMessageLimit: 40 } },
  });
  await inject("POST", `/api/chat-presets/${modelless.id}/apply/${created.id}`);
  await assertFollowsMain("a profile without a Model puts the chat back on Main");
  await inject("PATCH", `/api/chats/${created.id}`, { connectionId: second.id });
  await createConnectionsStorage(db).remove(second.id);
  // A stale form that still clears the deleted Model: the chat did not choose Main, so the notice stays.
  await inject("PATCH", `/api/chats/${created.id}`, { connectionId: null });
  assert.deepEqual(await fallbackReasons(), ["deleted"], "a deleted Model is still reported");

  // Deleting a Model moves a chat's catalog pick onto another Model of its Connection. The client's delete refreshes
  // the chat instead of clearing the Model it had cached, so the chat keeps the pick and does not switch to Main.
  const { createConnectionAccountsStorage } =
    await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
  const { readChatModelOverride } = await import("../../packages/shared/src/index.js");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const account = await createConnectionAccountsStorage(db).create({
    name: "Fixture service",
    provider: "custom",
    baseUrl,
    apiKey: "fixture",
  });
  const onAccount = async (model: string) =>
    (await createConnectionsStorage(db).create({
      name: model,
      provider: "custom",
      baseUrl,
      model,
      accountId: account.id,
    }))!;
  const picked = await onAccount("fixture-3");
  const peer = await onAccount("fixture-4");
  await inject("PATCH", `/api/chats/${created.id}`, { connectionId: picked.id });
  await chats.patchMetadata(created.id, { modelOverride: { connectionId: picked.id, model: "fixture-catalog" } });
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
  });
  const requireClient = createRequire(new URL("../../packages/client/package.json", import.meta.url));
  const React = requireClient("react");
  const { renderToStaticMarkup } = requireClient("react-dom/server");
  const { QueryClient, QueryClientProvider } =
    await import("../../packages/client/node_modules/@tanstack/react-query/build/modern/index.js");
  const { useDeleteConnection } = await import("../../packages/client/src/hooks/use-connections.js");
  const { chatKeys } = await import("../../packages/client/src/hooks/use-chats.js");
  const { useChatStore } = await import("../../packages/client/src/stores/chat.store.js");
  const { api } = await import("../../packages/client/src/lib/api-client.js");
  const queryClient = new QueryClient();
  let deleteModel!: ReturnType<typeof useDeleteConnection>;
  function Probe() {
    deleteModel = useDeleteConnection();
    return null;
  }
  renderToStaticMarkup(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Probe)));
  // The client talks to this app; its delete runs what DELETE /connections/:id runs.
  api.get = (async () => []) as typeof api.get;
  api.delete = (async (path: string) =>
    createConnectionsStorage(db).remove(path.split("/").pop()!)) as typeof api.delete;
  api.patch = ((path: string, body: unknown) => inject("PATCH", `/api${path}`, body)) as typeof api.patch;
  useChatStore.setState({ activeChatId: created.id });
  queryClient.setQueryData(chatKeys.detail(created.id), await inject("GET", `/api/chats/${created.id}`));
  await deleteModel.mutateAsync(picked.id);
  const carried = (await chats.getById(created.id))!;
  assert.equal(carried.connectionId, peer.id, "the chat keeps its pick on the Connection's other Model");
  assert.equal(readChatModelOverride(carried)?.model, "fixture-catalog", "the catalog pick is kept");
  assert.equal(readChatFollowsMain(carried), false, "the chat does not switch to Main");
  assert.deepEqual(await fallbackReasons(), [], "the carried pick needs no notice");
  console.log("New chats are created without an explicit connection.");
} finally {
  provider.closeAllConnections();
  provider.close();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
