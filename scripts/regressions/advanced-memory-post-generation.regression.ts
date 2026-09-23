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
const {
  DEFAULT_ADVANCED_MEMORY_SETTINGS,
  characterDataSchema,
  replaceBuiltInAgentDefinitions,
  createChatSummaryEntry,
  estimateChatSummaryTokens,
} = await import("../../packages/shared/dist/index.js");
const calls: Array<{
  kind: string;
  messages: Array<{ role: string; content: string }>;
  streaming?: boolean;
  path?: string;
  maxTokens?: number;
}> = [];
let summaryGate: Promise<void> | undefined;
let summaryResponse: string | undefined;
let summaryFinishReason = "stop";
let closeLatestScene = false;
let mainInputTokens = 40;
let mainOutputTokens = 20;
let mainToolCall = false;
const sceneDecision = (transcript: Array<{ messageNumber: number; content: string }>) => ({
  ends: closeLatestScene
    ? [{ messageNumber: transcript.at(-1)!.messageNumber }]
    : transcript
        .filter((message) => message.content.startsWith("SCENE_CHANGE"))
        .map((message) => ({ messageNumber: message.messageNumber - 1 })),
});
let finishStream: (() => void) | undefined;
let streamFinished = false;
let streamGate: Promise<void> | undefined;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url?.endsWith("/embeddings")) {
    calls.push({ kind: "embedding", messages: [] });
    const input = Array.isArray(body.input) ? body.input : [body.input];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: input.map((_: unknown, index: number) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const responses = req.url?.endsWith("/responses");
  const messages = body.messages ?? [
    ...(body.instructions ? [{ role: "system", content: body.instructions }] : []),
    ...body.input.map((message: { role: string; content: string | Array<{ text: string }> }) => ({
      role: message.role,
      content:
        typeof message.content === "string" ? message.content : message.content.map((part) => part.text).join("\n"),
    })),
  ];
  const prompt = JSON.stringify(messages);
  const kind = prompt.includes("TRACKER_SCENE_FIXTURE")
    ? "tracker"
    : prompt.includes("Identify scene transitions")
      ? "scene"
      : prompt.includes("Summarize only the supplied eligible source material")
        ? "summary"
        : "main";
  calls.push({
    kind,
    messages,
    streaming: body.stream,
    path: req.url,
    maxTokens: body.max_output_tokens ?? body.max_completion_tokens ?? body.max_tokens,
  });
  if (kind === "summary" && summaryGate) await summaryGate;
  const bundledSceneCheck = messages.find((message: { content: string }) => message.content.includes("Transcript:\n"));
  const content =
    kind === "tracker"
      ? JSON.stringify({
          values: { weather: "clear" },
          ...(bundledSceneCheck
            ? {
                __scene_check: sceneDecision(
                  JSON.parse(bundledSceneCheck.content.split("Transcript:\n")[1].split("\n\nKeep")[0]),
                ),
              }
            : {}),
        })
      : kind === "scene"
        ? JSON.stringify(
            messages[0].content.includes('"ends"')
              ? sceneDecision(JSON.parse(messages[1].content))
              : {
                  starts: JSON.parse(messages[1].content)
                    .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
                    .map((message: { messageId: string }) => ({ messageId: message.messageId })),
                },
          )
        : kind === "summary"
          ? JSON.stringify({
              audience: "all",
              summary: summaryResponse ?? "ARCHIVED_RECAP: The silver compass promise guided the travelers.",
            })
          : "The character continues the silver compass journey.";
  const response = {
    id: "fixture",
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: content }] }],
    usage: {
      input_tokens: mainInputTokens,
      output_tokens: mainOutputTokens,
      total_tokens: mainInputTokens + mainOutputTokens,
    },
  };
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(
      `data: ${JSON.stringify(
        responses
          ? { type: "response.output_text.delta", delta: content }
          : { choices: [{ index: 0, delta: { content }, finish_reason: null }] },
      )}\n\n`,
    );
    if (kind === "main" && streamGate) {
      await streamGate;
      streamFinished = true;
    }
    res.end(
      responses
        ? `data: ${JSON.stringify({ type: "response.completed", response })}\n\n`
        : `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify(
        responses
          ? response
          : {
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content,
                    ...(kind === "main" &&
                    mainToolCall &&
                    !messages.some((message: { role: string }) => message.role === "tool")
                      ? {
                          tool_calls: [
                            {
                              id: "usage-roll",
                              type: "function",
                              function: { name: "roll_dice", arguments: '{"notation":"1d1"}' },
                            },
                          ],
                        }
                      : {}),
                  },
                  finish_reason: kind === "summary" ? summaryFinishReason : "stop",
                },
              ],
              usage: {
                prompt_tokens: mainInputTokens,
                completion_tokens: mainOutputTokens,
                total_tokens: mainInputTokens + mainOutputTokens,
              },
            },
      ),
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
    maxContext: 16_384,
    maxTokensOverride: 1024,
    embeddingModel: "fixture-embedding",
  });
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Dottore" }));
  assert.ok(character);
  const chat = await chats.create({
    name: "Scene cadence",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(chat);
  chatIds.push(chat.id);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    authorNote: "UNRELATED_AUTHOR_NOTE",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 16_384,
      helperConnectionId: connection.id,
    },
  });
  await memory.initialize(chat.id);
  const generate = async (extra: Record<string, unknown> = {}) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId: character.id, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return response;
  };
  const waitFor = async (predicate: () => Promise<boolean>) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await predicate()) return;
      await delay(25);
    }
    assert.fail("Post-generation scene check did not finish");
  };
  const waitForSceneCheck = async () => {
    const last = (await chats.listMessages(chat.id)).at(-1)!;
    await waitFor(async () => {
      const state = JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState;
      return state.sceneCheckMessageId === last.id && state.status === "ready";
    });
  };
  const addFourMessages = async (newScene = false) => {
    for (let index = 0; index < 4; index++)
      await chats.createMessage({
        chatId: chat.id,
        role: index % 2 ? "assistant" : "user",
        content: `${index === 1 && newScene ? "SCENE_CHANGE " : ""}The silver compass promise continued. ${index}`,
        ...(index === 1 && newScene ? { extra: { isConversationStart: true } } : {}),
      });
  };
  await addFourMessages();
  await chats.updateMessageContent(
    (await chats.listMessages(chat.id))[0]!.id,
    "ARCHIVED_SOURCE_ONLY: The silver compass promise began.",
  );
  const checkpointBeforeReindex = JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState
    .sceneCheckMessageId;
  await memory.reindex(chat.id);
  assert.equal(
    JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState.sceneCheckMessageId,
    checkpointBeforeReindex,
    "reindexing vectors preserves the four accumulated messages toward the scene-check interval",
  );
  calls.length = 0;
  const checkedResponse = await generate();
  await waitForSceneCheck();
  assert.match(
    checkedResponse.body,
    /"type":"advanced_memory_status"[^\n]*"stage":"classifying"/u,
    "the live generation stream delivers standalone scene-check activity",
  );
  assert.match(
    checkedResponse.body,
    /"type":"advanced_memory_status"[^\n]*"status":"ready"/u,
    "the live generation stream stays open for scene-check completion",
  );
  assert.match(checkedResponse.body, /"type":"agent_progress"[^\n]*"type":"advanced-recall"[^\n]*"stage":"waiting"/u);
  assert.match(checkedResponse.body, /"type":"agent_progress"[^\n]*"type":"advanced-recall"[^\n]*"stage":"received"/u);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main", "scene"],
    "an ongoing scene is checked after the fifth saved turn without summarizing or indexing",
  );
  const sceneCall = calls.find((call) => call.kind === "scene")!;
  assert(!JSON.stringify(sceneCall.messages).includes("UNRELATED_AUTHOR_NOTE"));
  const window = JSON.parse(sceneCall.messages[1]!.content);
  assert.equal(window.length, 5);
  assert.deepEqual(
    window.map((message: { messageNumber: number }) => message.messageNumber),
    [1, 2, 3, 4, 5],
  );
  assert.match(sceneCall.messages[0]!.content, /"ends":\[\{"messageNumber":42\}\]/u);
  assert(window.at(-1).content.includes("continues the silver compass"), "the check includes the just-saved reply");
  assert(!(await memory.status(chat.id)).records.some((record) => record.content));

  await addFourMessages(true);
  calls.length = 0;
  await generate();
  await waitForSceneCheck();
  assert.deepEqual(
    JSON.parse(calls.find((call) => call.kind === "scene")!.messages[1]!.content).map(
      (message: { messageNumber: number }) => message.messageNumber,
    ),
    [6, 7, 8, 9, 10],
    "subsequent checks inspect exactly the configured number of latest messages",
  );
  assert.deepEqual(
    calls.slice(0, 3).map((call) => call.kind),
    ["main", "scene", "summary"],
    "a detected scene ending prepares the archive only after the main reply",
  );
  assert(calls.some((call) => call.kind === "embedding"));
  const archive = (await memory.status(chat.id)).records;
  assert(archive.some((record) => record.kind === "scene" && record.content.includes("ARCHIVED_RECAP")));
  assert(
    archive.filter((record) => record.content).every((record) => record.endIndex <= 6),
    "only the closed scene is summarized and indexed",
  );

  // The provider waits for the HTTP client to receive a token before finishing.
  // A buffering server would time out rather than satisfy this handshake.
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  for (const [provider, model] of [
    ["custom", "fixture"],
    ["openai", "gpt-6-astra"],
  ] as const) {
    await createConnectionsStorage(db).update(connection.id, { provider, model });
    streamGate = new Promise<void>((resolve) => {
      finishStream = resolve;
    });
    streamFinished = false;
    calls.length = 0;
    const streamed = await fetch(`${url}/api/generate/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId: chat.id, forCharacterId: character.id, streaming: true }),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(streamed.status, 200);
    const reader = streamed.body!.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let tokenSeen = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
      if (!tokenSeen && body.includes('"type":"token"')) {
        assert.equal(streamFinished, false, "the main reply is streamed before provider completion");
        tokenSeen = true;
        finishStream!();
      }
    }
    streamGate = undefined;
    assert(tokenSeen, body);
    assert(!body.includes('"type":"error"'), body);
    const mainCall = calls.find((call) => call.kind === "main")!;
    assert.equal(mainCall.streaming, true);
    assert.equal(mainCall.path, provider === "openai" ? "/v1/responses" : "/v1/chat/completions");
    assert(JSON.stringify(calls.find((call) => call.kind === "main")!.messages).includes("ARCHIVED_RECAP"));
    assert(
      !calls.some((call) => ["scene", "summary"].includes(call.kind)),
      "routine recall does not prepare the archive",
    );
  }
  await createConnectionsStorage(db).update(connection.id, { provider: "custom", model: "fixture" });

  const swipeTarget = (await chats.listMessages(chat.id)).at(-1)!;
  for (let swipe = 0; swipe < 3; swipe++) {
    calls.length = 0;
    const regenerated = await generate({ regenerateMessageId: swipeTarget.id });
    assert.deepEqual(
      calls.map((call) => call.kind),
      ["main"],
      "unchanged swipes reuse their original memory without retrieval or helper calls",
    );
    assert.doesNotMatch(regenerated.body, /"stage":"compacting"/u);
    assert(JSON.stringify(calls[0]!.messages).includes("ARCHIVED_RECAP"));
    assert(!JSON.stringify(calls[0]!.messages).includes("LATEST_SWIPE_CACHE_MUST_NOT_WIN"));
    if (swipe === 0) {
      const active = await chats.getMessage(swipeTarget.id);
      const changedSnapshot = JSON.parse(active!.extra).advancedMemorySnapshot;
      changedSnapshot.prepared.recalledMessages = "LATEST_SWIPE_CACHE_MUST_NOT_WIN";
      await chats.updateMessageExtra(swipeTarget.id, { advancedMemorySnapshot: changedSnapshot });
    }
  }
  for (const swipe of await chats.getSwipes(swipeTarget.id))
    await chats.updateMessageExtraForSwipe(swipeTarget.id, swipe.index, { advancedMemorySnapshot: null });
  calls.length = 0;
  await generate({ regenerateMessageId: swipeTarget.id });
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["embedding", "main"],
    "legacy replies prepare their first snapshot once",
  );
  calls.length = 0;
  await generate({ regenerateMessageId: swipeTarget.id });
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main"],
    "later legacy swipes reuse the first available snapshot",
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
    type: "recall-tracker-fixture",
    name: "Tracker fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "TRACKER_SCENE_FIXTURE Return JSON values.",
    settings: {
      resultType: "custom_tracker_update",
      maxTokens: 1024,
      contextSize: 5,
      customCapabilities: { edit_main_prompt: true, edit_trackers: true },
      contextSources: { chatHistory: true },
    },
  });
  assert(tracker);
  await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: [tracker.type] });
  calls.length = 0;
  await generate();
  assert.deepEqual(
    calls.filter((call) => call.kind !== "embedding").map((call) => call.kind),
    ["main", "tracker"],
    "trackers do not force an out-of-cadence scene check",
  );
  const trackerPrompt = JSON.stringify(calls.find((call) => call.kind === "tracker")!.messages);
  assert.doesNotMatch(
    trackerPrompt,
    /ARCHIVED_RECAP|Included below are recalled|__scene_check|__MARINARA_ADVANCED_MEMORY_/u,
    "out-of-cadence agent prompts receive neither Advanced Recall output nor a scene-check request",
  );
  const beforeRetry = JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState;
  calls.length = 0;
  const retry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: [tracker.type] },
  });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["tracker"],
    "manual agent reruns make no recall, summary, embedding or scene-check calls",
  );
  assert.doesNotMatch(JSON.stringify(calls), /ARCHIVED_RECAP|Included below are recalled|__MARINARA_ADVANCED_MEMORY_/u);
  assert.deepEqual(JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState, beforeRetry);

  calls.length = 0;
  const auxiliary = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: chat.id, forCharacterId: character.id },
  });
  assert.equal(auxiliary.statusCode, 200, auxiliary.body);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main"],
    "auxiliary generation makes only its requested model call",
  );
  assert.doesNotMatch(JSON.stringify(calls), /ARCHIVED_RECAP|Included below are recalled|__MARINARA_ADVANCED_MEMORY_/u);

  assert.doesNotMatch(
    JSON.stringify(calls),
    /ARCHIVED_SOURCE_ONLY/u,
    "auxiliary generations still respect the shared context start",
  );

  const trackerSettings = JSON.parse(tracker.settings);
  await createAgentsStorage(db).update(tracker.id, { settings: { ...trackerSettings, runInterval: 100 } });
  await addFourMessages();
  calls.length = 0;
  await generate();
  await waitForSceneCheck();
  assert.deepEqual(
    calls.filter((call) => call.kind !== "embedding").map((call) => call.kind),
    ["main", "scene"],
    "the scene interval is independent of an agent's interval",
  );
  assert(
    !(await memory.status(chat.id)).records.some((record) => record.kind === "excerpt" && record.startIndex > 5),
    "an ongoing scene is still not indexed",
  );
  assert.equal((await memory.status(chat.id)).job.blocking, false, "post-generation work remains background activity");

  await chats.updateMessageExtra((await chats.listMessages(chat.id))[0]!.id, { hiddenFromAI: true });
  calls.length = 0;
  const revised = await generate({ regenerateMessageId: swipeTarget.id });
  assert.doesNotMatch(revised.body, /reused-swipe-memory/u, "a visibility change invalidates the old swipe memory");
  assert.doesNotMatch(
    JSON.stringify(calls.find((call) => call.kind === "main")!.messages),
    /ARCHIVED_SOURCE_ONLY|LATEST_SWIPE_CACHE_MUST_NOT_WIN/u,
    "recalled raw messages cannot bypass changed source visibility",
  );
  assert.match(
    JSON.stringify(calls.find((call) => call.kind === "main")!.messages),
    /ARCHIVED_RECAP/u,
    "an enabled Chat Summary remains governed by its character condition",
  );
  await memory.checkScenesAfterGeneration(chat.id);
  const batchChat = await chats.create({
    name: "Numbered tracker scene endings",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(batchChat);
  chatIds.push(batchChat.id);
  await createAgentsStorage(db).update(tracker.id, { settings: { ...trackerSettings, runInterval: 1 } });
  await chats.patchMetadata(batchChat.id, {
    enableAgents: true,
    activeAgentIds: [tracker.type],
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 16_384,
      helperConnectionId: connection.id,
    },
  });
  await memory.initialize(batchChat.id);
  closeLatestScene = true;
  for (let scene = 0; scene < 2; scene++) {
    await chats.createMessagesBatch(
      batchChat.id,
      Array.from({ length: 4 }, (_, index) => ({
        role: "user" as const,
        content: `Scene ${scene + 1} event ${index + 1}.`,
      })),
    );
    calls.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: batchChat.id, forCharacterId: character.id, streaming: true },
    });
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.match(
      response.body,
      /"type":"advanced_memory_status"[^\n]*"stage":"classifying"/u,
      "a bundled check has its own visible Advanced Recall activity",
    );
    assert.match(response.body, /"type":"advanced_memory_status"[^\n]*"status":"ready"/u);
    assert.match(
      response.body,
      /"type":"agent_progress"[^\n]*"name":"Tracker fixture"[^\n]*"type":"advanced-recall"/u,
      "the shared tracker call lists Advanced Recall as a participating post-processing agent",
    );
    const source = await chats.listMessages(batchChat.id);
    await waitFor(async () => {
      const state = JSON.parse((await chats.getById(batchChat.id))!.metadata).advancedMemoryState;
      return state.status === "ready" && state.sceneCheckMessageId === source.at(-1)!.id;
    });
    // Join background maintenance before inspecting its completed archive.
    await memory.checkScenesAfterGeneration(batchChat.id);
    assert.deepEqual(
      calls.slice(0, 2).map((call) => call.kind),
      ["main", "tracker"],
    );
    assert.equal(
      calls.filter((call) => call.kind === "scene").length,
      0,
      "the tracker result avoids a second scene-helper call",
    );
    assert.equal(calls.filter((call) => call.kind === "summary").length, 1, "only the newly ended scene is summarized");
    const trackerCall = calls.find((call) => call.kind === "tracker")!;
    assert.match(JSON.stringify(trackerCall.messages), /__scene_check/u);
    assert.doesNotMatch(JSON.stringify(trackerCall.messages), /ARCHIVED_RECAP|Included below are recalled/u);
    const recaps = (await memory.status(batchChat.id)).records.filter(
      (record) => record.kind === "scene" && record.content,
    );
    assert.deepEqual(
      recaps.map((record) => [record.startIndex, record.endIndex, record.status]),
      scene === 0
        ? [[1, 5, "closed"]]
        : [
            [1, 5, "closed"],
            [6, 10, "closed"],
          ],
    );
    assert(
      recaps.every((record) => record.embeddingStatus === "vectorized"),
      "ended scenes are indexed after the main reply",
    );
    const prepared = await memory.prepare({
      chatId: batchChat.id,
      messages: source,
      audienceCharacterIds: [],
      audienceMode: "owner",
      budgetTokens: 8000,
      readOnly: true,
    });
    assert.equal(prepared.recalledScenes, null, "closed scenes still in the live context are excluded from retrieval");
  }
  closeLatestScene = false;

  const actualUsageChat = await chats.create({
    name: "Actual input cutoff",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(actualUsageChat);
  chatIds.push(actualUsageChat.id);
  await chats.patchMetadata(actualUsageChat.id, {
    enableAgents: false,
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { roll: true },
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 65_000,
      sceneCheckInterval: 100,
    },
  });
  await chats.createMessagesBatch(
    actualUsageChat.id,
    Array.from({ length: 9 }, (_, index) => ({
      role: "user" as const,
      content: `${index === 4 ? "SCENE_CHANGE " : ""}The silver compass journey continues.`,
    })),
  );
  await memory.initialize(actualUsageChat.id);
  const usageSource = await chats.listMessages(actualUsageChat.id);
  const generateUsage = async (extra: Record<string, unknown> = {}) => {
    const result = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: actualUsageChat.id, forCharacterId: character.id, streaming: false, ...extra },
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.ok(!result.body.includes('"type":"error"'), result.body);
    return result;
  };
  mainInputTokens = 45000;
  mainOutputTokens = 32768;
  mainToolCall = true;
  await generateUsage();
  let latestUsageReply = (await chats.listMessages(actualUsageChat.id)).at(-1)!;
  assert.equal(
    JSON.parse(latestUsageReply.extra).generationInfo.tokensPrompt,
    90000,
    "fixture has two billed tool requests",
  );
  assert.equal(
    (await memory.status(actualUsageChat.id)).job.contextStarts,
    undefined,
    "neither tool-turn totals nor output may trigger a cutoff",
  );
  mainToolCall = false;
  mainInputTokens = 65000;
  await generateUsage();
  assert.equal(
    (await memory.status(actualUsageChat.id)).job.contextStarts,
    undefined,
    "input at the threshold still fits",
  );
  mainInputTokens = 65001;
  latestUsageReply = (await chats.listMessages(actualUsageChat.id)).at(-1)!;
  await generateUsage({ regenerateMessageId: latestUsageReply.id });
  assert.equal(
    (await memory.status(actualUsageChat.id)).job.contextStarts,
    undefined,
    "swipes do not move the live cutoff",
  );
  await chats.updateMessageExtra(usageSource[6]!.id, { conversationStartForCharacterIds: [character.id] });
  const actualReset = await generateUsage();
  const resetState = (await memory.status(actualUsageChat.id)).job;
  assert.deepEqual(
    resetState.contextStarts?.map((start) => [start.messageId, start.audienceCharacterIds]),
    [[usageSource[4]!.id, []]],
    "actual input over 65k resets everyone to the latest scene despite a small estimate and a later personal POV flag",
  );
  assert.match(
    actualReset.body,
    /"type":"advanced_memory_status"[^\n]*"contextStarts"/u,
    "the shared cutoff is published to the live UI",
  );
  const usageConstants = JSON.parse((await chats.getById(actualUsageChat.id))!.metadata).summaryEntries;
  assert(
    usageConstants.some(
      (entry: { rangeStartIndex: number; rangeEndIndex: number; enabled: boolean }) =>
        entry.enabled && entry.rangeStartIndex === 1 && entry.rangeEndIndex === 4,
    ),
    "the cutoff reuses the closed scene recap in Chat Summaries",
  );
  mainInputTokens = 40;
  mainOutputTokens = 20;

  const constantsChat = await chats.create({
    name: "Existing ranged constants",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(constantsChat);
  chatIds.push(constantsChat.id);
  await createConnectionsStorage(db).update(connection.id, {
    provider: "openai",
    model: "gpt-6-astra",
    maxContext: 65_000,
    maxTokensOverride: 256,
  });
  const constantText = "EXISTING_RANGE_SUMMARY ".repeat(1000); // Below the 7k constant share of a 10k memory budget.
  await chats.patchMetadata(constantsChat.id, {
    enableAgents: false,
    summaryMaxTokens: 12_000,
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 65_000,
      summaryBudgetTokens: 10_000,
      sceneCheckInterval: 100,
    },
  });
  const older = await chats.createMessage({
    chatId: constantsChat.id,
    role: "user",
    content: "ALREADY_SUMMARIZED_RAW ".repeat(5000),
  });
  assert(older);
  await chats.createMessage({
    chatId: constantsChat.id,
    role: "user",
    content: "The ongoing scene continues.",
    extra: { isConversationStart: true },
  });
  await chats.patchMetadata(constantsChat.id, {
    summaryEntries: [
      createChatSummaryEntry({
        id: "existing-ranged-summary",
        content: constantText,
        enabled: true,
        origin: "manual",
        rangeStartIndex: 1,
        rangeEndIndex: 1,
      }),
    ],
  });
  // Ready archive, no closed scene. Generation must neither recompress constants nor call a helper.
  await memory.initialize(constantsChat.id);
  calls.length = 0;
  const generateConstants = () =>
    app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: constantsChat.id, forCharacterId: character.id, streaming: true },
    });
  const firstConstants = await generateConstants();
  assert(!firstConstants.body.includes('"type":"error"'), firstConstants.body);
  assert.doesNotMatch(firstConstants.body, /"stage":"compacting"/u);
  await memory.checkScenesAfterGeneration(constantsChat.id, { blocking: false });
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main"],
    "constants under 70% of the memory budget trigger no summary call, regardless of raw-history size",
  );
  assert(JSON.stringify(calls[0]!.messages).includes(constantText.trim()), "the existing constant is included intact");
  assert(!JSON.stringify(calls[0]!.messages).includes("ALREADY_SUMMARIZED_RAW"));
  const beforeConstants = JSON.parse((await chats.getById(constantsChat.id))!.metadata).summaryEntries;
  assert.equal(beforeConstants.length, 1, "no parallel continuity store is populated");
  assert(!(await memory.status(constantsChat.id)).records.some((record) => record.kind === "continuity"));

  const liveConstant = createChatSummaryEntry({
    id: "live-range-summary",
    content: "STILL_LIVE_SUMMARY ".repeat(2000),
    enabled: true,
    origin: "manual",
    rangeStartIndex: 2,
    rangeEndIndex: 2,
  });
  await chats.patchMetadata(constantsChat.id, { summaryEntries: [...beforeConstants, liveConstant] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(constantsChat.id);
  assert.equal(calls.length, 0, "live-range constants do not consume the archived constant budget");
  assert.deepEqual(
    JSON.parse((await chats.getById(constantsChat.id))!.metadata).summaryEntries,
    [...beforeConstants, liveConstant],
    "compaction cannot merge an archived constant into a still-live range",
  );
  await chats.patchMetadata(constantsChat.id, { summaryEntries: beforeConstants });

  // The 70% share follows each user's budget; it is not fixed at 7k or 10k.
  for (const summaryBudgetTokens of [8000, 20_000]) {
    const content = "BUDGET_CONSTANT ".repeat(Math.floor((summaryBudgetTokens * 0.75 * 4) / 16));
    assert(estimateChatSummaryTokens(content) > summaryBudgetTokens * 0.7);
    assert(estimateChatSummaryTokens(content) < summaryBudgetTokens);
    await memory.updateSettings(constantsChat.id, { summaryBudgetTokens });
    await chats.patchMetadata(constantsChat.id, { summaryEntries: [{ ...beforeConstants[0], content }, liveConstant] });
    calls.length = 0;
    assert(!(await generateConstants()).body.includes('"type":"error"'));
    await memory.checkScenesAfterGeneration(constantsChat.id, { blocking: false });
    assert.deepEqual(
      calls.map((call) => call.kind),
      ["main", "summary"],
    );
    const combine = calls[1]!;
    assert(combine.messages[0]!.content.includes(`approximately ${Math.floor(summaryBudgetTokens * 0.7)} tokens`));
    assert(JSON.stringify(calls[0]!.messages).includes(content.trim()), "the crossing reply keeps its constants");
    assert.doesNotMatch(JSON.stringify(combine.messages), /STILL_LIVE_SUMMARY/u);
    const afterCombine = JSON.parse((await chats.getById(constantsChat.id))!.metadata).summaryEntries;
    assert.deepEqual(
      afterCombine.find((entry: { id: string }) => entry.id === liveConstant.id),
      liveConstant,
    );
    assert.equal(afterCombine.find((entry: { origin: string }) => entry.origin === "automated").rangeEndIndex, 1);
  }
  await memory.updateSettings(constantsChat.id, { summaryBudgetTokens: 10_000 });

  const largeConstants = [{ ...beforeConstants[0], content: "CONSTANTS_ONLY_SOURCE ".repeat(1500) }];
  assert(estimateChatSummaryTokens(largeConstants[0].content) > 7000);
  assert(estimateChatSummaryTokens(largeConstants[0].content) < 10_000);
  summaryResponse = `ARCHIVED_RECAP ${"COMPACTED_CONSTANT ".repeat(1450)}`;
  assert(estimateChatSummaryTokens(summaryResponse) <= 7000);
  await chats.patchMetadata(constantsChat.id, { summaryEntries: largeConstants });
  let releaseHelper!: () => void;
  summaryGate = new Promise<void>((resolve) => {
    releaseHelper = resolve;
  });
  calls.length = 0;
  const pendingReaders: ReadableStreamDefaultReader<Uint8Array>[] = [];
  const generateConstantsUntilDone = async () => {
    const response = await fetch(`${url}/api/generate/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId: constantsChat.id, forCharacterId: character.id, streaming: true }),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    const reader = response.body!.getReader();
    pendingReaders.push(reader);
    const decoder = new TextDecoder();
    let body = "";
    while (!body.includes('"type":"done"')) {
      const chunk = await reader.read();
      assert(!chunk.done, "the generation stream must send done before closing");
      body += decoder.decode(chunk.value, { stream: true });
    }
    return { body };
  };
  const beforeCombine = await generateConstantsUntilDone();
  assert(!beforeCombine.body.includes('"type":"error"'), beforeCombine.body);
  await waitFor(async () => calls.some((call) => call.kind === "summary"));
  assert.equal(calls[0]!.kind, "main", "constant consolidation follows the main reply");
  const combinedRequest = calls.find((call) => call.kind === "summary")!;
  assert.equal(
    combinedRequest.maxTokens,
    12_000,
    "Chat Summary output size overrides the helper connection's 256-token setting",
  );
  assert(JSON.stringify(combinedRequest.messages).includes("CONSTANTS_ONLY_SOURCE"));
  assert.match(
    combinedRequest.messages[0]!.content,
    /approximately 7000 tokens/u,
    "the helper receives the 70% allocation, not the combined memory allowance",
  );
  assert.doesNotMatch(
    JSON.stringify(combinedRequest.messages),
    /ALREADY_SUMMARIZED_RAW|ongoing scene continues|character continues/iu,
    "consolidation receives only selected summaries",
  );
  try {
    let summaryProgress = beforeCombine.body;
    const progressDecoder = new TextDecoder();
    while (!/"type":"agent_progress"[^\n]*"type":"advanced-recall"[^\n]*"stage":"waiting"/u.test(summaryProgress)) {
      const chunk = await pendingReaders[0]!.read();
      assert(!chunk.done, "summary activity must reach the Agents menu while the helper is still running");
      summaryProgress += progressDecoder.decode(chunk.value, { stream: true });
    }
    const duringCombine = await Promise.race([
      generateConstantsUntilDone(),
      delay(3000).then(() => {
        throw new Error("Main generation waited for the background helper");
      }),
    ]);
    assert(!duringCombine.body.includes('"type":"error"'), duringCombine.body);
    assert.equal(
      calls.filter((call) => call.kind === "main").length,
      2,
      "a held background helper cannot block another reply",
    );
  } finally {
    releaseHelper();
    summaryGate = undefined;
  }
  for (const [index, reader] of pendingReaders.entries()) {
    const decoder = new TextDecoder();
    let tail = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      tail += decoder.decode(chunk.value, { stream: true });
    }
    assert.match(
      tail,
      /"type":"advanced_memory_status"[^\n]*"status":"ready"/u,
      "background completion reaches the UI after the main reply is already done",
    );
    if (index === 0)
      assert.match(tail, /"type":"agent_progress"[^\n]*"type":"advanced-recall"[^\n]*"stage":"received"/u);
  }
  await memory.checkScenesAfterGeneration(constantsChat.id, { blocking: false });
  assert.equal(
    calls.filter((call) => call.kind === "summary").length,
    1,
    "a result within the constant share needs no paid retry",
  );
  summaryResponse = undefined;
  const combinedEntries = JSON.parse((await chats.getById(constantsChat.id))!.metadata).summaryEntries;
  assert.equal(combinedEntries.filter((entry: { enabled: boolean }) => entry.enabled).length, 1);
  assert.equal(
    combinedEntries.find((entry: { id: string }) => entry.id === "existing-ranged-summary").enabled,
    false,
    "combining disables its old source instead of leaving both active",
  );
  assert(combinedEntries.find((entry: { enabled: boolean }) => entry.enabled).content.includes("ARCHIVED_RECAP"));
  assert(
    !(await memory.status(constantsChat.id)).records.some((record) => record.kind === "continuity"),
    "new constants live only in Chat Summaries",
  );
  for (const ranged of [true, false]) {
    const liveChat = await chats.create({
      name: "Live constant compaction",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: connection.id,
    });
    assert(liveChat);
    chatIds.push(liveChat.id);
    const liveSource = await chats.createMessage({
      chatId: liveChat.id,
      role: "user",
      content: "LIVE_RAW_NOT_COMPACTION_INPUT",
      extra: ranged ? { hiddenFromAI: true } : {},
    });
    assert(liveSource);
    await chats.createMessage({
      chatId: liveChat.id,
      role: "user",
      content: "HIDDEN_RAW",
      extra: { hiddenFromAI: true },
    });
    await chats.patchMetadata(liveChat.id, {
      advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true, sceneCheckInterval: 100 },
      macroVariables: { memory: "LIVE_CONSTANT_TO_COMBINE ".repeat(600) },
      summaryEntries: [
        createChatSummaryEntry({
          content: ranged ? "LIVE_CONSTANT_TO_COMBINE ".repeat(600) : "{{getvar::memory}}",
          enabled: true,
          ...(ranged
            ? { rangeStartIndex: 1, rangeEndIndex: 1, messageIds: [liveSource.id], hiddenMessageIds: [liveSource.id] }
            : {}),
        }),
        createChatSummaryEntry({
          id: "hidden-constant",
          content: `{{#if char == "Other character"}}${"HIDDEN_CONSTANT ".repeat(900)}{{/if}}`,
          enabled: true,
          rangeStartIndex: 2,
          rangeEndIndex: 2,
        }),
      ],
    });
    calls.length = 0;
    await memory.checkScenesAfterGeneration(liveChat.id, { blocking: false });
    assert.deepEqual(
      calls.map((call) => call.kind),
      ["summary"],
      "compaction covers hidden source ranges and legacy constants according to their character conditions",
    );
    assert.doesNotMatch(JSON.stringify(calls[0]!.messages), /LIVE_RAW_NOT_COMPACTION_INPUT|HIDDEN_CONSTANT/u);
    const active = JSON.parse((await chats.getById(liveChat.id))!.metadata).summaryEntries.find(
      (entry: { enabled: boolean }) => entry.enabled,
    );
    assert.equal(active.rangeStartIndex, ranged ? 1 : undefined, "legacy summaries acquire no invented coverage");
  }
  const privateCharacters = await Promise.all(
    ["Maukie", "Pantalone"].map((name) => createCharactersStorage(db).create(characterDataSchema.parse({ name }))),
  );
  const [privateA, privateB] = privateCharacters;
  assert(privateA && privateB);
  const privateChat = await chats.create({
    name: "Per-character constant budgets",
    mode: "roleplay",
    characterIds: [privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(privateChat);
  chatIds.push(privateChat.id);
  for (const hiddenFrom of [privateB.id, privateA.id]) {
    await chats.createMessage({
      chatId: privateChat.id,
      role: "user",
      content: "A private event.",
      extra: { hiddenFromAICharacterIds: [hiddenFrom] },
    });
  }
  await chats.createMessage({
    chatId: privateChat.id,
    role: "user",
    content: "The next shared scene.",
    extra: { isConversationStart: true },
  });
  const privateEntries = ["PRIVATE_A_CONSTANT ", "PRIVATE_B_CONSTANT "].map((content, index) =>
    createChatSummaryEntry({
      id: `private-${index}`,
      content: `{{#if char == "${index === 0 ? "Maukie" : "Pantalone"}"}}${content.repeat(1100)}{{/if}}`,
      enabled: true,
      rangeStartIndex: index + 1,
      rangeEndIndex: index + 1,
    }),
  );
  await chats.patchMetadata(privateChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: 10_000,
      sceneCheckInterval: 100,
      knowledgeStarts: { [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: privateEntries,
  });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(privateChat.id, { blocking: false });
  assert.deepEqual(calls, [], "separate 5k character constants do not jointly exceed a 7k per-view share");
  await chats.patchMetadata(privateChat.id, {
    summaryEntries: [
      { ...privateEntries[0], content: `{{#if char == "Maukie"}}${"PRIVATE_A_CONSTANT ".repeat(1700)}{{/if}}` },
      privateEntries[1],
    ],
  });
  await memory.checkScenesAfterGeneration(privateChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.kind, "summary");
  assert.match(JSON.stringify(calls[0]!.messages), /PRIVATE_A_CONSTANT/u);
  assert.doesNotMatch(JSON.stringify(calls[0]!.messages), /PRIVATE_B_CONSTANT/u);
  const privateAfter = JSON.parse((await chats.getById(privateChat.id))!.metadata).summaryEntries;
  assert.deepEqual(
    privateAfter.find((entry: { id: string }) => entry.id === "private-1"),
    privateEntries[1],
  );
  const compactedPrivate = privateAfter.find((entry: { id: string }) => !entry.id.startsWith("private-"));
  assert.match(compactedPrivate.content, /^\{\{#if char == "Maukie"\}\}/u);
  for (const [id, expected, excluded] of [
    [privateA.id, "ARCHIVED_RECAP", "PRIVATE_B_CONSTANT"],
    [privateB.id, "PRIVATE_B_CONSTANT", "ARCHIVED_RECAP"],
  ]) {
    const prepared = await memory.prepare({
      chatId: privateChat.id,
      messages: await chats.listMessages(privateChat.id),
      audienceCharacterIds: [id!],
      budgetTokens: 50_000,
      readOnly: true,
    });
    assert(prepared.chatSummary?.includes(expected!));
    assert(!prepared.chatSummary?.includes(excluded!));
  }

  const macroChat = await chats.create({
    name: "Audience-dependent constant templates",
    mode: "roleplay",
    characterIds: [privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(macroChat);
  chatIds.push(macroChat.id);
  await chats.createMessage({ chatId: macroChat.id, role: "user", content: "A shared event." });
  await chats.createMessage({
    chatId: macroChat.id,
    role: "user",
    content: "The next shared scene.",
    extra: { isConversationStart: true },
  });
  const template = createChatSummaryEntry({
    id: "character-template",
    content: `{{#if char == "Maukie"}}${"MAUKIE_SECTION ".repeat(150)}{{/if}}\n{{#if char == "Pantalone"}}${"PANTALONE_SECTION ".repeat(150)}{{/if}}`,
    enabled: true,
    rangeStartIndex: 1,
    rangeEndIndex: 1,
  });
  await chats.patchMetadata(macroChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      sceneCheckInterval: 100,
      knowledgeStarts: { [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: [
      template,
      createChatSummaryEntry({
        id: "ordinary-constant",
        content: "STABLE_CONSTANT ".repeat(550),
        enabled: true,
        rangeStartIndex: 1,
        rangeEndIndex: 1,
      }),
    ],
  });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(macroChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert.match(JSON.stringify(calls[0]!.messages), /STABLE_CONSTANT/u);
  assert.doesNotMatch(JSON.stringify(calls[0]!.messages), /MAUKIE_SECTION|PANTALONE_SECTION/u);
  const macroAfter = JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries;
  assert.deepEqual(
    macroAfter.find((entry: { id: string }) => entry.id === template.id),
    template,
  );
  for (const [id, expected, excluded] of [
    [privateA.id, "MAUKIE_SECTION", "PANTALONE_SECTION"],
    [privateB.id, "PANTALONE_SECTION", "MAUKIE_SECTION"],
  ]) {
    const prepared = await memory.prepare({
      chatId: macroChat.id,
      messages: await chats.listMessages(macroChat.id),
      audienceCharacterIds: [id!],
      budgetTokens: 50_000,
      readOnly: true,
    });
    assert(prepared.chatSummary!.includes(expected!));
    assert(!prepared.chatSummary!.includes(excluded!));
  }

  await chats.patchMetadata(macroChat.id, {
    groupChatMode: "shared",
    summaryEntries: [
      template,
      createChatSummaryEntry({
        content: "STABLE_CONSTANT ".repeat(1100),
        enabled: true,
        rangeStartIndex: 1,
        rangeEndIndex: 1,
      }),
    ],
  });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(macroChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(
    JSON.stringify(calls[0]!.messages),
    /MAUKIE_SECTION|PANTALONE_SECTION/u,
    "shared-mode compaction must not resolve a mixed-POV template as only the first character",
  );
  assert.deepEqual(
    JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries.find(
      (entry: { id: string }) => entry.id === template.id,
    ),
    template,
    "all existing POV sections and their conditions remain saved",
  );
  await chats.patchMetadata(macroChat.id, { groupChatMode: "individual" });

  const tightTemplate = {
    ...template,
    content: `{{#if char == "Maukie"}}${"A".repeat(6803 * 4)}{{/if}}\n{{#if char == "Pantalone"}}${"B".repeat(6803 * 4)}{{/if}}`,
  };
  const longConstant = createChatSummaryEntry({
    id: "two-thousand-word-constant",
    content: "Word ".repeat(2000).trim(),
    enabled: true,
    rangeStartIndex: 1,
    rangeEndIndex: 1,
  });
  await chats.patchMetadata(macroChat.id, {
    summaryMaxTokens: 12_000,
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: 10_000,
      sceneCheckInterval: 100,
      knowledgeStarts: { [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: [tightTemplate, longConstant],
  });
  summaryResponse = "R".repeat(2400 * 4);
  calls.length = 0;
  await memory.checkScenesAfterGeneration(macroChat.id, { blocking: false });
  assert.equal(calls.length, 1, "a valid shorter recap is kept without retries to force a tiny group target");
  assert.equal(calls[0]!.maxTokens, 12_000, "compaction preserves a larger Chat Summary output allowance");
  assert.doesNotMatch(calls[0]!.messages[0]!.content, /196 tokens/u);
  const softBudgetAfter = JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries;
  assert.deepEqual(
    softBudgetAfter.find((entry: { id: string }) => entry.id === tightTemplate.id),
    tightTemplate,
  );
  assert(
    softBudgetAfter.some(
      (entry: { content: string; enabled: boolean }) => entry.enabled && entry.content.includes(summaryResponse!),
    ),
  );
  assert.equal((await memory.status(macroChat.id)).job.status, "ready");

  // A helper can ignore the length guidance. Keep the existing entries and reuse
  // the completed attempt instead of paying again for unchanged inputs.
  await chats.patchMetadata(macroChat.id, { summaryEntries: [tightTemplate, longConstant] });
  summaryResponse = longConstant.content;
  calls.length = 0;
  await memory.checkScenesAfterGeneration(macroChat.id, { blocking: false });
  assert.deepEqual(JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries, [
    tightTemplate,
    longConstant,
  ]);
  await memory.checkScenesAfterGeneration(macroChat.id, { blocking: false });
  assert.equal(calls.length, 1, "unchanged constants reuse a completed non-shrinking attempt");
  summaryResponse = undefined;

  // A failed provider result can contain text. It must never become an active
  // replacement or deactivate the originals, even on repeated Resume attempts.
  await createConnectionsStorage(db).update(connection.id, { provider: "custom", model: "fixture" });
  const failureEntries = [
    { ...longConstant, id: "failed-replacement-source", content: "EXISTING_CONSTANT ".repeat(2000) },
  ];
  await chats.patchMetadata(macroChat.id, { summaryEntries: failureEntries });
  for (const reason of ["length", "error", "abort", "tool_calls", "content_filter"]) {
    summaryFinishReason = reason;
    await assert.rejects(memory.checkScenesAfterGeneration(macroChat.id), /summary model.*(limit|complete)/u);
    assert.deepEqual(
      JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries,
      failureEntries,
      `a ${reason} result neither adds a constant nor disables its originals`,
    );
  }
  summaryFinishReason = "stop";
  await memory.initialize(macroChat.id);
  const replacementEntries = JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries;
  assert.equal(replacementEntries.filter((entry: { enabled: boolean }) => entry.enabled).length, 1);
  assert.equal(replacementEntries.find((entry: { id: string }) => entry.id === failureEntries[0]!.id).enabled, false);
  assert.equal(replacementEntries.find((entry: { enabled: boolean }) => entry.enabled).title, "Messages #1–#1");

  const partialChat = await chats.create({
    name: "Reuse existing summary ranges",
    mode: "roleplay",
    characterIds: [character.id, privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(partialChat);
  chatIds.push(partialChat.id);
  await chats.patchMetadata(partialChat.id, {
    enableAgents: false,
    groupChatMode: "individual",
    summaryMaxTokens: 1024,
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 16_384,
      summaryBudgetTokens: 3000,
      narratorCharacterId: character.id,
      knowledgeStarts: { [character.id]: null, [privateA.id]: null, [privateB.id]: null },
    },
  });
  for (const content of ["ALREADY_COVERED_A", "ALREADY_COVERED_B", "UNCOVERED_NEW_EVENT", "SCENE_CHANGE present day"]) {
    await chats.createMessage({
      chatId: partialChat.id,
      role: "user",
      content,
      ...(content.startsWith("SCENE_CHANGE") ? { extra: { isConversationStart: true } } : {}),
    });
  }
  const manual = createChatSummaryEntry({
    id: "kept-range",
    origin: "manual",
    enabled: true,
    content: '{{#if char == "Dottore"}}EXISTING_RANGE_CORRECTION{{/if}}',
    sourceMode: "range",
    rangeStartIndex: 1,
    rangeEndIndex: 2,
  });
  await chats.patchMetadata(partialChat.id, { summaryEntries: [manual] });
  await memory.initialize(partialChat.id);
  const maukieManual = createChatSummaryEntry({
    ...manual,
    id: "maukie-kept-range",
    content: '{{#if char == "Maukie"}}MAUKIE_RANGE_CORRECTION{{/if}}',
    rangeEndIndex: 1,
  });
  await chats.patchMetadata(partialChat.id, { summaryEntries: [manual, maukieManual] });
  const partialSource = await chats.listMessages(partialChat.id);
  const beforeAddition = await memory.prepare({
    chatId: partialChat.id,
    messages: partialSource,
    audienceCharacterIds: [character.id],
    budgetTokens: 5000,
  });
  calls.length = 0;
  summaryFinishReason = "error";
  await assert.rejects(memory.checkScenesAfterGeneration(partialChat.id), /summary model.*complete/u);
  assert.deepEqual(
    JSON.parse((await chats.getById(partialChat.id))!.metadata).summaryEntries,
    [manual, maukieManual],
    "a failed new-range summary is not added to Chat Summaries",
  );
  summaryFinishReason = "stop";
  calls.length = 0;
  await memory.checkScenesAfterGeneration(partialChat.id);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["summary", "summary"],
    "only uncovered scene messages need a new constant",
  );
  for (const call of calls) {
    assert.equal(call.maxTokens, 8196, "new constants also have reasoning room independently of recap length");
    const additionPrompt = JSON.stringify(call.messages);
    assert(additionPrompt.includes("UNCOVERED_NEW_EVENT"));
    assert.doesNotMatch(additionPrompt, /ALREADY_COVERED_A|RANGE_CORRECTION|present day/u);
  }
  assert.equal(
    calls.filter((call) => JSON.stringify(call.messages).includes("ALREADY_COVERED_B")).length,
    1,
    "Maukie still needs the second message; Dottore's existing range already covers it",
  );
  const addedEntries = JSON.parse((await chats.getById(partialChat.id))!.metadata).summaryEntries;
  assert.equal(addedEntries.length, 5);
  assert.deepEqual(addedEntries[0], manual, "pre-existing ranged constants remain intact");
  assert.deepEqual(addedEntries[1], maukieManual);
  for (const [name, start] of [
    ["Dottore", 3],
    ["Maukie", 2],
    ["Pantalone", 1],
  ] as const) {
    const added = addedEntries
      .slice(2)
      .find((entry: { content: string }) => entry.content.startsWith(`{{#if char == "${name}"}}`));
    assert(added, `new ${name} constant has its own character condition`);
    assert.equal(added.rangeStartIndex, start, "another character's summary cannot suppress uncovered history");
    assert.equal(added.rangeEndIndex, 3);
    assert.equal(added.title, `Messages #${start}–#3`);
  }
  await memory.validatePrepared(partialChat.id, partialSource, beforeAddition.receipt);
  const beforeRepeat = calls.length;
  await memory.checkScenesAfterGeneration(partialChat.id);
  assert.equal(calls.length, beforeRepeat, "completed constant ranges are not generated again");
  await chats.patchMetadata(partialChat.id, {
    summaryEntries: addedEntries.map((entry: { id: string; enabled: boolean }) =>
      entry.id === manual.id ? { ...entry, enabled: false } : entry,
    ),
  });
  await assert.rejects(
    memory.validatePrepared(partialChat.id, partialSource, beforeAddition.receipt),
    /summary corrections changed/u,
    "manual activation changes still invalidate a saved swipe",
  );
} finally {
  finishStream?.();
  for (const chatId of chatIds) await memory.cancel(chatId);
  replaceBuiltInAgentDefinitions([]);
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Main Roleplay streaming, agent isolation and post-generation scene-end archiving passed.\n");
