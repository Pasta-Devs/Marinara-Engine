import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-assigned-chat-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const { handleRoleplayDmCommand } =
  await import("../../packages/server/src/services/generation/roleplay-dm-command-runtime.js");
const { readLocalContextLimit, canRefreshLocalContext } =
  await import("../../packages/server/src/services/llm/local-context-limit.js");
const { withLatestMessageReply } = await import("../../packages/server/src/services/generation/message-reply.js");
let metadata: unknown = { default_generation_settings: { n_ctx: 16384 } };
let metadataPath = "/props";
let metadataHook: (() => Promise<void>) | undefined;
let metadataRedirect: string | undefined;
const prompts: string[] = [];
const provider = createServer(async (req, res) => {
  if (req.method === "GET") {
    assert.equal(req.headers.authorization, "Bearer fixture");
    if (req.url === metadataPath) {
      await metadataHook?.();
      if (metadataRedirect) {
        res.writeHead(302, { location: metadataRedirect }).end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(metadata));
    } else res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = JSON.stringify(body.messages);
  prompts.push(prompt);
  const content = prompt.includes("DIRECTOR_FIXTURE")
    ? JSON.stringify({ direction: "UNEXPECTED_DIRECTOR", text: "UNEXPECTED_DIRECTOR" })
    : prompt.includes("You are Narrative Director maintaining a hidden long-term arc")
      ? JSON.stringify({ overarchingArc: { description: "PLOT_FIXTURE", completed: false } })
      : "A fixture response.";
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
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler((await import("../../packages/server/src/middleware/error-handler.js")).errorHandler);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(connectionsRoutes, { prefix: "/api/connections" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await connections.create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
  });
  const refresh = () => app.inject({ method: "POST", url: "/api/connections/refresh-local-context" });
  assert.deepEqual((await refresh()).json().updated, [connection.id]);
  assert.equal((await connections.getById(connection.id))?.maxContext, 16384);
  assert.deepEqual((await refresh()).json().updated, [], "unchanged capacity is not rewritten");
  metadataPath = "/api/extra/true_max_context_length";
  metadata = { value: 32768 };
  await refresh();
  assert.equal((await connections.getById(connection.id))?.maxContext, 32768, "Kobold loaded context");
  metadataPath = "/v1/model";
  metadata = { parameters: { max_seq_len: 65536 } };
  await refresh();
  assert.equal((await connections.getById(connection.id))?.maxContext, 65536, "Tabby loaded context");
  for (const invalid of [
    { parameters: { max_seq_len: -1 } },
    { parameters: { max_seq_len: 1.5 } },
    { model_name: "128k" },
    null,
  ]) {
    metadata = invalid;
    assert.deepEqual((await refresh()).json().updated, []);
    assert.equal(
      (await connections.getById(connection.id))?.maxContext,
      65536,
      "unsupported/invalid metadata preserves saved value",
    );
  }
  metadata = { parameters: { max_seq_len: 32768 } };
  metadataHook = async () => {
    await connections.update(connection.id, { maxContext: 12288 });
  };
  assert.deepEqual((await refresh()).json().updated, [], "a concurrent settings edit wins");
  assert.equal((await connections.getById(connection.id))?.maxContext, 12288);
  metadataHook = undefined;
  const staleConnection = (await connections.getById(connection.id))!;
  await connections.update(connection.id, { maxContext: 14336 });
  const editedConnection = (await connections.getById(connection.id))!;
  assert.equal(
    await connections.updateContextIfUnchanged({ ...staleConnection, updatedAt: editedConnection.updatedAt }, 4096),
    false,
    "a concurrent save wins even when both snapshots have the same millisecond timestamp",
  );
  assert.equal(
    (await connections.getById(connection.id))?.maxContext,
    14336,
    "stale metadata cannot overwrite a saved setting",
  );

  const extraConnections: string[] = [];
  for (let index = 0; index < 5; index++) {
    extraConnections.push(
      (await connections.create({
        name: `Bounded local fixture ${index}`,
        provider: "custom",
        baseUrl: connection.baseUrl,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 8192,
      }))!.id,
    );
  }
  let inFlight = 0,
    peakInFlight = 0;
  metadataHook = async () => {
    peakInFlight = Math.max(peakInFlight, ++inFlight);
    await new Promise((resolve) => setTimeout(resolve, 20));
    inFlight--;
  };
  assert.equal((await refresh()).json().updated.length, 6);
  assert.ok(peakInFlight > 1 && peakInFlight <= 3, "at most three connections probe metadata concurrently");
  metadataHook = undefined;
  for (const id of extraConnections) await connections.remove(id);
  await connections.update(connection.id, { maxContext: 12288 });

  let redirectedRequests = 0;
  const otherOrigin = createServer((_request, response) => {
    redirectedRequests++;
    response.end("{}");
  });
  try {
    await new Promise<void>((done) => otherOrigin.listen(0, "127.0.0.1", done));
    const target = otherOrigin.address();
    assert.ok(target && typeof target === "object");
    metadataRedirect = `http://127.0.0.1:${target.port}/props`;
    assert.deepEqual((await refresh()).json().updated, []);
    assert.equal(redirectedRequests, 0, "credentials and metadata probes cannot leave the configured origin");
  } finally {
    metadataRedirect = undefined;
    otherOrigin.closeAllConnections();
    await new Promise<void>((done) => otherOrigin.close(() => done()));
  }
  assert.equal(canRefreshLocalContext({ provider: "openai", baseUrl: "https://api.openai.com/v1" }), false);
  assert.equal(canRefreshLocalContext({ provider: "anthropic", baseUrl: "http://localhost:8000" }), false);
  assert.equal(readLocalContextLimit({ default_generation_settings: { n_ctx: "8192" } }, "/props"), 8192);

  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { characterDataSchema } = await import("../../packages/shared/src/schemas/character.schema.js");
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Dottore" }));
  assert.ok(character);
  for (const mode of ["conversation", "roleplay"] as const) {
    const chat = await chats.create({
      name: `Reply fixture ${mode}`,
      mode,
      characterIds: [character.id],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, { enableAgents: false });
    const original = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "The original passage remains.",
    });
    assert.ok(original);
    const replyTo = { messageId: original.id, name: "Dottore", content: "Selected snapshot only." };
    const generate = async (payload: Record<string, unknown>) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, ...payload },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
    };
    await generate({ userMessage: "My reply.", replyTo });
    assert.match(prompts.at(-1)!, /Selected snapshot only/);
    assert.match(prompts.at(-1)!, /The original passage remains/);
    const replied = (await chats.listMessages(chat.id)).find((message) => message.role === "user")!;
    assert.equal(replied.content, "My reply.", "the quote is stored separately from editable content");
    assert.deepEqual(JSON.parse(replied.extra).replyTo, replyTo);
    await generate({});
    assert.match(prompts.at(-1)!, /Selected snapshot only/, "continue preserves the latest user quote");
    await generate({ userMessage: "A later ordinary turn." });
    assert.doesNotMatch(prompts.at(-1)!, /Selected snapshot only/, "older quotes never repeat in context");
    assert.match(prompts.at(-1)!, /My reply/);
    assert.match(prompts.at(-1)!, /The original passage remains/);
    assert.deepEqual(
      JSON.parse((await chats.getMessage(replied.id))!.extra).replyTo,
      replyTo,
      "older quotes remain visible in stored history",
    );
    const invalid = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: "Bad", replyTo: { ...replyTo, content: "x".repeat(16001) } },
    });
    assert.equal(invalid.statusCode, 400);
  }
  assert.equal(
    withLatestMessageReply("safe", { content: "bad" }, true),
    "safe",
    "malformed imported extras are ignored",
  );

  // Install a synthetic optional agent; package-owned definitions stay in Marinara-Agents.
  replaceBuiltInAgentDefinitions([
    {
      id: "director",
      name: "Narrative Director",
      description: "Synthetic Director fixture",
      phase: "pre_generation",
      enabledByDefault: false,
      category: "writer",
      defaultTools: [],
      defaultPromptTemplate: "DIRECTOR_FIXTURE",
      modeAllowlist: ["roleplay"],
    },
  ]);
  const agents = createAgentsStorage(db);
  const director = await agents.create({
    type: "director",
    name: "Narrative Director",
    phase: "pre_generation",
    connectionId: connection.id,
    promptTemplate: "DIRECTOR_FIXTURE",
    settings: { secretPlotEnabled: true },
  });
  assert.ok(director);
  const directorChat = await chats.create({
    name: "Director fixture",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(directorChat);
  await chats.patchMetadata(directorChat.id, {
    enableAgents: true,
    activeAgentIds: ["director"],
    narrativeDirectorSecretPlotEnabled: false,
  });
  const generateDirector = async (payload: Record<string, unknown> = {}) => {
    const before = prompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: directorChat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return prompts.slice(before);
  };
  for (const groupChatMode of ["merged", "individual"]) {
    await chats.patchMetadata(directorChat.id, { groupChatMode });
    for (const narrativeDirectorMode of [undefined, "natural", "random"]) {
      const requests = await generateDirector({ userMessage: "Continue the scene.", narrativeDirectorMode });
      assert.equal(requests.length, 1, "Secret Plot off makes only the main model request");
      const prompt = requests[0]!;
      assert.doesNotMatch(prompt, /UNEXPECTED_DIRECTOR|PLOT_FIXTURE/);
      assert.equal((prompt.match(/<narrative_director>/g) ?? []).length, narrativeDirectorMode ? 1 : 0);
      if (narrativeDirectorMode) {
        assert.match(prompt, /The scene is getting stale/);
        assert.ok(prompt.includes(narrativeDirectorMode === "random" ? "random but plausible" : "forward naturally"));
      }
    }
  }
  const directorMessage = (await chats.listMessages(directorChat.id)).filter((m) => m.role === "assistant").at(-1)!;
  await chats.updateMessageExtra(directorMessage.id, {
    contextInjections: [
      { agentType: "director", text: "UNEXPECTED_CACHED_DIRECTOR" },
      { agentType: "secret-plot-driver", text: "UNEXPECTED_LEGACY_PLOT" },
      { agentType: "custom-fixture", text: "PRESERVED_OTHER_AGENT" },
    ],
  });
  for (const narrativeDirectorMode of [undefined, "natural"]) {
    const requests = await generateDirector({ regenerateMessageId: directorMessage.id, narrativeDirectorMode });
    assert.equal(requests.length, 1);
    assert.doesNotMatch(requests[0]!, /UNEXPECTED_|PLOT_FIXTURE/);
    assert.match(requests[0]!, /PRESERVED_OTHER_AGENT/);
    assert.equal(
      (requests[0]!.match(/<narrative_director>/g) ?? []).length,
      1,
      "regeneration retains the original selected nudge once",
    );
    assert.ok(requests[0]!.includes(narrativeDirectorMode ? "forward naturally" : "random but plausible"));
  }
  assert.doesNotMatch(
    (await generateDirector({ userMessage: "An ordinary next turn." }))[0]!,
    /<narrative_director>|UNEXPECTED_/,
  );
  await chats.patchMetadata(directorChat.id, { narrativeDirectorSecretPlotEnabled: true });
  const plotRequests = await generateDirector({ userMessage: "Start an arc.", narrativeDirectorMode: "random" });
  assert.equal(plotRequests.length, 2, "enabling Secret Plot retains its separate maintenance call");
  assert.match(plotRequests[0]!, /maintaining a hidden long-term arc/);
  assert.match(plotRequests[1]!, /PLOT_FIXTURE/);
  assert.doesNotMatch(plotRequests[1]!, /UNEXPECTED_DIRECTOR/);
  assert.equal((plotRequests[1]!.match(/<narrative_director>/g) ?? []).length, 1);
  await chats.patchMetadata(directorChat.id, { narrativeDirectorSecretPlotEnabled: false });
  const disabledPlotRequests = await generateDirector({
    userMessage: "Only a nudge.",
    narrativeDirectorMode: "natural",
  });
  assert.equal(disabledPlotRequests.length, 1);
  assert.doesNotMatch(disabledPlotRequests[0]!, /PLOT_FIXTURE|UNEXPECTED_DIRECTOR/);
  assert.equal(
    (await agents.getMemory(director.id, directorChat.id)).overarchingArc != null,
    true,
    "turning Secret Plot off preserves its saved arc",
  );
  replaceBuiltInAgentDefinitions([]);

  const source = await chats.create({
    name: "DM source",
    mode: "roleplay",
    characterIds: ["dottore"],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(source);
  const actions: Record<string, unknown>[] = [];
  let failUnread = false;
  const dmStorage = {
    ...chats,
    markAutonomousUnread: async (...args: Parameters<typeof chats.markAutonomousUnread>) => {
      if (failUnread) throw new Error("Synthetic unread write failure");
      return chats.markAutonomousUnread(...args);
    },
  };
  const sendDm = async () =>
    handleRoleplayDmCommand({
      command: {
        type: "dm",
        character: "Dottore",
        message: "A private message.",
        resolvedCharacterId: "dottore",
        resolvedCharacterName: "Dottore",
      },
      chatId: source.id,
      sourceChat: source,
      allChatMessages: [],
      chats: dmStorage as Parameters<typeof handleRoleplayDmCommand>[0]["chats"],
      sendAssistantAction: (action) => actions.push(action),
    });
  await sendDm();
  const dmId = String(actions.at(-1)?.chatId);
  assert.equal(actions.at(-1)?.action, "chat_created");
  const unread = async (id: string) => JSON.parse((await chats.getById(id))!.metadata);
  assert.equal((await unread(dmId)).autonomousUnreadCount, 1);
  await sendDm();
  assert.equal(actions.at(-1)?.chatId, dmId);
  assert.equal((await unread(dmId)).autonomousUnreadCount, 2, "reused DM increments durable badge");
  assert.deepEqual((await unread(dmId)).autonomousUnreadCharacterIds, ["dottore"]);
  await chats.clearAutonomousUnread(dmId);
  assert.equal((await unread(dmId)).autonomousUnreadCount, undefined);
  await chats.update(source.id, { connectedChatId: dmId });
  await sendDm();
  assert.equal(actions.at(-1)?.action, "dm_posted");
  assert.equal((await unread(dmId)).autonomousUnreadCount, 1, "linked conversation also gets a durable badge");

  failUnread = true;
  const linkedMessageCount = (await chats.listMessages(dmId)).length;
  const actionCount = actions.length;
  await sendDm();
  assert.equal(actions.length, actionCount + 1, "a badge failure still emits the linked-DM success event");
  assert.equal((await chats.listMessages(dmId)).length, linkedMessageCount + 1);
  await chats.update(source.id, { connectedChatId: null });
  await chats.patchMetadata(dmId, { dmOriginChatId: null });
  await sendDm();
  const preservedDmId = String(actions.at(-1)?.chatId);
  assert.notEqual(preservedDmId, dmId);
  assert.equal(actions.at(-1)?.action, "chat_created");
  assert.ok(await chats.getById(preservedDmId), "a badge failure never deletes the newly populated DM");
  assert.equal((await chats.listMessages(preservedDmId)).length, 1);
  await sendDm();
  assert.equal(actions.at(-1)?.action, "dm_posted");
  assert.equal((await chats.listMessages(preservedDmId)).length, 2, "reused DMs also survive badge failures");

  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  assert.deepEqual((await refresh()).json().updated, [], "offline backends preserve the saved limit");
  assert.equal((await connections.getById(connection.id))?.maxContext, 12288);
} finally {
  replaceBuiltInAgentDefinitions([]);
  provider.closeAllConnections();
  if (provider.listening) await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Assigned chat sweep: real prompt requests, reply durability, Director nudges/secret plots, DM badges, and local context refresh passed.",
);
