import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const dir = mkdtempSync(join(tmpdir(), "marinara-scene-post-generation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS, characterDataSchema, replaceBuiltInAgentDefinitions } =
  await import("../../packages/shared/dist/index.js");
const calls: Array<{ kind: string; messages: Array<{ role: string; content: string }> }> = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url?.endsWith("/embeddings")) {
    const input = Array.isArray(body.input) ? body.input : [body.input];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: input.map((_: unknown, index: number) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const prompt = JSON.stringify(body.messages);
  const kind = prompt.includes("TRACKER_SCENE_FIXTURE")
    ? "tracker"
    : prompt.includes("Identify scene transitions")
      ? "scene"
      : prompt.includes("Summarize only the supplied eligible source material")
        ? "summary"
        : "main";
  calls.push({ kind, messages: body.messages });
  const content =
    kind === "tracker"
      ? JSON.stringify({
          values: { weather: "clear" },
          ...(prompt.includes("__scene_check") ? { __scene_check: { starts: [] } } : {}),
        })
      : kind === "scene"
        ? '{"starts":[]}'
        : kind === "summary"
          ? '{"summary":"They continue their journey."}'
          : "The character continues the journey.";
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
const memory = createAdvancedMemoryService(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
const chatIds: string[] = [];
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Scene fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 8192,
    maxTokensOverride: 1024,
    embeddingModel: "fixture-embedding",
  });
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Dottore" }));
  assert.ok(character);
  const createChat = async () => {
    const chat = await chats.create({
      name: "Scene cadence",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    chatIds.push(chat.id);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      authorNote: "UNRELATED_AUTHOR_NOTE",
      advancedMemory: {
        ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
        enabled: true,
        maxContextTokens: 8192,
        helperConnectionId: connection.id,
      },
    });
    await memory.initialize(chat.id);
    return chat;
  };
  const generate = async (chatId: string, regenerateMessageId?: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, forCharacterId: character.id, regenerateMessageId },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
  };
  const waitFor = async (predicate: () => Promise<boolean>) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await predicate()) return;
      await delay(25);
    }
    assert.fail("Post-generation scene maintenance did not finish");
  };
  const waitForSceneCheck = async (chatId: string) => {
    const last = (await chats.listMessages(chatId)).at(-1)!;
    await waitFor(async () => {
      const saved = await chats.getById(chatId);
      return JSON.parse(saved!.metadata).advancedMemoryState?.sceneCheckMessageId === last.id;
    });
    await memory.maintain(chatId);
  };
  const chat = await createChat();
  for (let index = 0; index < 4; index++) {
    await chats.createMessage({
      chatId: chat.id,
      role: index % 2 ? "assistant" : "user",
      characterId: index % 2 ? character.id : null,
      content: `VISIBLE_SOURCE_${index}`,
    });
  }
  const before = calls.length;
  await generate(chat.id);
  await waitFor(async () => calls.slice(before).some((call) => call.kind === "scene"));
  await waitForSceneCheck(chat.id);
  assert.equal(calls[before]!.kind, "main", "No scene helper may run before the main generation");
  const sceneCalls = calls.slice(before).filter((call) => call.kind === "scene");
  assert.equal(sceneCalls.length, 1, "The fifth persisted message triggers exactly one standalone decision");
  const scenePrompt = JSON.stringify(sceneCalls[0]!.messages);
  assert.ok(!scenePrompt.includes("UNRELATED_AUTHOR_NOTE"));
  const window = JSON.parse(sceneCalls[0]!.messages.find((message) => message.role === "user")!.content);
  assert.equal(window.length, 5);
  assert.deepEqual(
    window.map((message: { messageId: string }) => message.messageId),
    (await chats.listMessages(chat.id)).map((message) => message.id),
  );
  assert.ok(
    window.at(-1).content.includes("continues the journey"),
    "The just-saved assistant response is included once",
  );
  const afterCheck = calls.length;
  await generate(chat.id);
  await memory.maintain(chat.id);
  assert.ok(
    !calls.slice(afterCheck).some((call) => call.kind === "scene"),
    "One new message is below the five-message cadence",
  );

  replaceBuiltInAgentDefinitions([
    {
      id: "custom-tracker",
      name: "Tracker fixture",
      description: "Local regression fixture",
      category: "tracker",
      phase: "post_processing",
      enabledByDefault: false,
      defaultPromptTemplate: "TRACKER_SCENE_FIXTURE Return JSON values.",
    },
  ]);
  const tracker = await createAgentsStorage(db).create({
    type: "custom-tracker",
    name: "Tracker fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "TRACKER_SCENE_FIXTURE Return JSON values.",
    settings: { resultType: "custom_tracker_update", maxTokens: 1024, contextSize: 5 },
  });
  assert.ok(tracker);
  await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: [tracker.type] });
  const beforeTracker = calls.length;
  await generate(chat.id);
  await waitForSceneCheck(chat.id);
  const trackerCalls = calls.slice(beforeTracker);
  assert.deepEqual(
    trackerCalls.map((call) => call.kind),
    ["main", "tracker"],
    "Scene detection rides the tracker request even before five new messages, without another call",
  );
  assert.ok(JSON.stringify(trackerCalls[1]!.messages).includes("__scene_check"));
  const trackedMessage = (await chats.listMessages(chat.id)).at(-1)!;
  const beforeSwipe = calls.length;
  await generate(chat.id, trackedMessage.id);
  await memory.maintain(chat.id);
  assert.deepEqual(
    calls.slice(beforeSwipe).map((call) => call.kind),
    ["main", "tracker"],
    "A swipe uses its existing tracker request without a pre-generation scene call",
  );

  const customTracker = await createAgentsStorage(db).create({
    type: "custom-scene-tracker",
    name: "Custom tracker",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "TRACKER_SCENE_FIXTURE Return JSON values.",
    settings: {
      resultType: "custom_tracker_update",
      customCapabilities: { edit_trackers: true },
      contextSources: { chatHistory: true },
      maxTokens: 1024,
    },
  });
  assert.ok(customTracker);
  await chats.patchMetadata(chat.id, {
    activeAgentIds: [customTracker.type],
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      helperConnectionId: connection.id,
      knowledgeStarts: { [character.id]: null },
    },
  });
  await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "HIDDEN_SCENE_SECRET",
    extra: { hiddenFromAICharacterIds: [character.id] },
  });
  const beforeCustom = calls.length;
  await generate(chat.id);
  await waitForSceneCheck(chat.id);
  assert.deepEqual(
    calls.slice(beforeCustom).map((call) => call.kind),
    ["scene", "main", "tracker"],
    "changed knowledge settings reclassify history once, then authorized trackers share later scene decisions",
  );
  assert.ok(
    !JSON.stringify(calls.slice(beforeCustom).filter((call) => call.kind !== "scene")).includes("HIDDEN_SCENE_SECRET"),
    "The shared tracker request cannot receive the responding character's hidden history through the scene helper",
  );

  const cadenceChat = await createChat();
  const customSettings = JSON.parse(customTracker.settings);
  await createAgentsStorage(db).update(customTracker.id, { settings: { ...customSettings, runInterval: 10 } });
  await chats.patchMetadata(cadenceChat.id, { enableAgents: true, activeAgentIds: [customTracker.type] });
  await generate(cadenceChat.id);
  await waitForSceneCheck(cadenceChat.id);
  const trackerAnchor = (await chats.listMessages(cadenceChat.id)).at(-1)!;
  const addFourMessages = async (chatId: string) => {
    for (let index = 0; index < 4; index++) {
      await chats.createMessage({ chatId, role: index % 2 ? "assistant" : "user", content: `Journey ${index}` });
    }
  };
  const waitForMaintenance = async (chatId: string) => {
    const last = (await chats.listMessages(chatId)).at(-1)!;
    await waitFor(async () => {
      const saved = await chats.getById(chatId);
      return JSON.parse(saved!.metadata).advancedMemoryState?.processedMessageId === last.id;
    });
  };
  await addFourMessages(cadenceChat.id);
  const beforeCadenceWait = calls.length;
  await generate(cadenceChat.id);
  await waitForMaintenance(cadenceChat.id);
  assert.deepEqual(
    calls.slice(beforeCadenceWait).map((call) => call.kind),
    ["main"],
    "An automatic tracker with a ten-message interval must not cause a separate scene call at five messages",
  );
  assert.equal(
    JSON.parse((await chats.getById(cadenceChat.id))!.metadata).advancedMemoryState.sceneCheckMessageId,
    trackerAnchor.id,
    "Archive maintenance must not advance the scene-check cursor while its tracker is waiting",
  );
  await addFourMessages(cadenceChat.id);
  const beforeCadenceDue = calls.length;
  await generate(cadenceChat.id);
  await waitForSceneCheck(cadenceChat.id);
  assert.deepEqual(
    calls.slice(beforeCadenceDue).map((call) => call.kind),
    ["main", "tracker"],
    "The scene check runs inside the tracker call when its ten-message interval is due",
  );

  await createAgentsStorage(db).update(customTracker.id, {
    settings: { ...customSettings, activationKeywords: ["SCENE_KEYWORD"], activationScanDepth: 1 },
  });
  await addFourMessages(cadenceChat.id);
  const beforeKeywordWait = calls.length;
  await generate(cadenceChat.id);
  await waitForMaintenance(cadenceChat.id);
  assert.deepEqual(
    calls.slice(beforeKeywordWait).map((call) => call.kind),
    ["main"],
    "A configured automatic tracker waits for its activation keywords without a standalone replacement",
  );

  for (const manualSettings of [{ manualTrackers: true }, { manualTrackerAgentTypes: { [tracker.type]: true } }]) {
    const manualChat = await createChat();
    await chats.patchMetadata(manualChat.id, {
      enableAgents: true,
      activeAgentIds: [tracker.type],
      ...manualSettings,
    });
    await addFourMessages(manualChat.id);
    const beforeManual = calls.length;
    await generate(manualChat.id);
    await waitForSceneCheck(manualChat.id);
    assert.deepEqual(
      calls.slice(beforeManual).map((call) => call.kind),
      ["main", "scene"],
      "Manual-only trackers leave the standalone scene cadence available",
    );
  }

  const disabledChat = await createChat();
  await chats.patchMetadata(disabledChat.id, { activeAgentIds: [tracker.type] });
  await addFourMessages(disabledChat.id);
  const beforeDisabled = calls.length;
  await generate(disabledChat.id);
  await waitForSceneCheck(disabledChat.id);
  assert.deepEqual(
    calls.slice(beforeDisabled).map((call) => call.kind),
    ["main", "scene"],
    "The disabled Agents switch must not suppress standalone scene checks",
  );

  const hiddenWindowChat = await createChat();
  await chats.patchMetadata(hiddenWindowChat.id, {
    enableAgents: true,
    activeAgentIds: [tracker.type],
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      helperConnectionId: connection.id,
      sceneCheckInterval: 1,
      knowledgeStarts: { [character.id]: null },
    },
  });
  await chats.createMessage({ chatId: hiddenWindowChat.id, role: "user", content: "A visible earlier request." });
  const hiddenReply = await chats.createMessage({
    chatId: hiddenWindowChat.id,
    role: "assistant",
    characterId: character.id,
    content: "A hidden previous response.",
    extra: { hiddenFromAICharacterIds: [character.id] },
  });
  assert.ok(hiddenReply);
  const beforeHiddenWindow = calls.length;
  await generate(hiddenWindowChat.id, hiddenReply.id);
  await waitForMaintenance(hiddenWindowChat.id);
  const hiddenWindowCalls = calls.slice(beforeHiddenWindow);
  assert.deepEqual(
    hiddenWindowCalls.map((call) => call.kind),
    ["main", "tracker"],
    "An empty character-visible scene window neither adds a helper call nor skips its tracker",
  );
  assert.ok(
    !JSON.stringify(hiddenWindowCalls[1]!.messages).includes("__scene_check"),
    "An empty character-visible window must not be claimed as a tracker scene check",
  );
  assert.equal(
    JSON.parse((await chats.getById(hiddenWindowChat.id))!.metadata).advancedMemoryState.sceneCheckMessageId,
    null,
    "An unevaluated empty window must not advance the scene cursor",
  );
  const hiddenWindowRequest = await memory.getSceneCheck(hiddenWindowChat.id, { force: true });
  assert.ok(hiddenWindowRequest);
  assert.equal(
    await memory.commitSceneCheck(hiddenWindowChat.id, { ...hiddenWindowRequest, messages: [] }, { starts: [] }),
    false,
    "The service also rejects an empty scene payload without accepting its empty decision",
  );
} finally {
  for (const chatId of chatIds) {
    await memory.cancel(chatId);
    await memory.maintain(chatId).catch(() => undefined);
  }
  replaceBuiltInAgentDefinitions([]);
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Scene decisions run after persisted generation at the message cadence or within the existing tracker request.",
);
