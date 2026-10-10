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
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
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
let summaryReply: ((prompt: string) => string) | undefined;
let summaryFinishReason = "stop";
let closeLatestScene = false;
let mainInputTokens = 40;
let mainOutputTokens = 20;
let mainToolCall = false;
const decisionRequests: Array<{ state: Record<string, any>; questions: Record<string, { instructions: string }> }> = [];
const sceneDecision = (transcript: Array<{ messageNumber: number; content: string; alreadyChecked?: boolean }>) => ({
  ends: closeLatestScene
    ? [{ messageNumber: transcript.at(-1)!.messageNumber }]
    : transcript
        .filter((message) => !message.alreadyChecked && message.content.startsWith("SCENE_CHANGE"))
        .map((message) => ({ messageNumber: message.messageNumber - 1 })),
});
let finishStream: (() => void) | undefined;
let streamFinished = false;
let streamGate: Promise<void> | undefined;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url?.endsWith("/systemone")) {
    decisionRequests.push(body);
    calls.push({ kind: "decision", messages: [] });
    const lastId = body.state.transcript?.at(-1)?.messageId;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        answers: Object.fromEntries(
          Object.keys(body.questions).map((id) => [
            id,
            {
              type: "noul",
              noul: body.state.memories || (closeLatestScene && id === lastId) ? 0.99 : 0.01,
            },
          ]),
        ),
      }),
    );
    return;
  }
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
              summary:
                summaryReply?.(prompt) ??
                summaryResponse ??
                "ARCHIVED_RECAP: The silver compass promise guided the travelers.",
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
await app.register(chatsRoutes, { prefix: "/api/chats" });
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
  const nextTranscript: Array<{ messageNumber: number; alreadyChecked?: boolean }> = JSON.parse(
    calls.find((call) => call.kind === "scene")!.messages[1]!.content,
  );
  assert.deepEqual(
    nextTranscript.filter((message) => message.alreadyChecked).map((message) => message.messageNumber),
    [5],
    "the message the last check ended on is shown, so a scene can end right there (#7371)",
  );
  assert.deepEqual(
    nextTranscript.filter((message) => !message.alreadyChecked).map((message) => message.messageNumber),
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
  // #6977: a tracker with its own request keeps to its own task; the scene check gets a request of its own.
  await createAgentsStorage(db).update(tracker.id, {
    settings: { ...trackerSettings, runInterval: 1, batchWithOtherAgents: false },
  });
  const ownRequestChat = await chats.create({
    name: "Tracker with its own request",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(ownRequestChat);
  chatIds.push(ownRequestChat.id);
  await chats.patchMetadata(ownRequestChat.id, {
    enableAgents: true,
    activeAgentIds: [tracker.type],
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 16_384,
      helperConnectionId: connection.id,
    },
  });
  await memory.initialize(ownRequestChat.id);
  await chats.createMessagesBatch(
    ownRequestChat.id,
    Array.from({ length: 4 }, (_, index) => ({ role: "user" as const, content: `Own request event ${index + 1}.` })),
  );
  calls.length = 0;
  const ownRequestReply = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: ownRequestChat.id, forCharacterId: character.id, streaming: true },
  });
  assert(!ownRequestReply.body.includes('"type":"error"'), ownRequestReply.body);
  const ownRequestSource = await chats.listMessages(ownRequestChat.id);
  await waitFor(async () => {
    const state = JSON.parse((await chats.getById(ownRequestChat.id))!.metadata).advancedMemoryState;
    return state.status === "ready" && state.sceneCheckMessageId === ownRequestSource.at(-1)!.id;
  });
  await memory.checkScenesAfterGeneration(ownRequestChat.id);
  assert.doesNotMatch(
    JSON.stringify(calls.find((call) => call.kind === "tracker")!.messages),
    /__scene_check/u,
    "a tracker with its own request carries only its own task",
  );
  assert.equal(calls.filter((call) => call.kind === "scene").length, 1, "the scene check runs in its own request");
  await createAgentsStorage(db).update(tracker.id, { settings: { ...trackerSettings, runInterval: 1 } });
  const decisionConnection = await createConnectionsStorage(db).create({
    name: "Dedicated memory decisions",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: "jev-fixture",
    apiKey: "",
  });
  await memory.updateSettings(batchChat.id, {
    decisionEnabled: true,
    decisionConnectionId: decisionConnection.id,
    sceneCheckInterval: 1,
    retrieveMinMessages: 0,
    retrieveMaxMessages: 0,
  });
  await chats.createMessage({
    chatId: batchChat.id,
    role: "user",
    content: "Remember the silver compass?",
    extra: { isConversationStart: true },
  });
  calls.length = 0;
  const jevReply = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: batchChat.id, forCharacterId: character.id, streaming: true },
  });
  assert(!jevReply.body.includes('"type":"error"'), jevReply.body);
  await memory.checkScenesAfterGeneration(batchChat.id);
  assert(
    decisionRequests.some((request) => request.state.memories),
    "recall uses the selected Jev connection",
  );
  assert(
    decisionRequests.some((request) => request.state.transcript),
    "scene changes get a separate Jev request",
  );
  for (const request of decisionRequests.filter((request) => request.state.transcript)) {
    assert(Object.values(request.questions).every((question) => question.instructions.includes("cut to a new scene")));
    assert.doesNotMatch(JSON.stringify(request), /TRACKER_SCENE_FIXTURE/u);
  }
  assert.doesNotMatch(JSON.stringify(calls.find((call) => call.kind === "tracker")!.messages), /__scene_check/u);
  assert.equal(calls.filter((call) => call.kind === "scene").length, 0);
  assert(
    calls.some((call) => call.kind === "summary"),
    "summaries still use the summary model",
  );
  const savedJev = await memory.status(batchChat.id);
  assert(savedJev.latestReceipt?.decisionRecall?.results.some((row) => row.selected));
  assert(savedJev.job.decisionSceneCheck?.results.some((row) => row.selected));
  await chats.patchMetadata(batchChat.id, (metadata) => ({
    summary: "An automatically refreshed continuity summary.",
    advancedMemoryState: {
      ...(metadata.advancedMemoryState as Record<string, unknown>),
      resetRevision: "diagnostic-policy-change",
    },
  }));
  assert.equal(
    (await memory.status(batchChat.id)).latestReceipt,
    undefined,
    "the old preparation policy is no longer reusable",
  );
  const callsBeforeInspection = calls.length;
  const inspectedJev = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: batchChat.id, forCharacterId: character.id, returnPrompt: true, decisionDebug: "inspect" },
  });
  assert.equal(inspectedJev.statusCode, 200, inspectedJev.body);
  const savedDiagnostics = inspectedJev.json().prompt.decisionDebug.advancedMemory;
  assert.deepEqual(savedDiagnostics.recall, savedJev.latestReceipt!.decisionRecall);
  assert.deepEqual(savedDiagnostics.sceneCheck, savedJev.job.decisionSceneCheck);
  assert.equal(calls.length, callsBeforeInspection, "viewing saved memory decisions cannot call any provider");
  // #7264: characters who reply one by one recall alone, so the inspector shows only the inspected
  // character's own saved recall. A newcomer with nothing to recall never shows someone else's.
  const newcomer = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Cyno" }));
  assert.ok(newcomer);
  const turnsChat = await chats.create({
    name: "Recall reports by character",
    mode: "roleplay",
    characterIds: [character.id, newcomer.id],
    connectionId: connection.id,
  });
  assert(turnsChat);
  chatIds.push(turnsChat.id);
  const joined = await chats.createMessage({
    chatId: turnsChat.id,
    role: "user",
    content: "Cyno arrives at the camp.",
    extra: { isConversationStart: true },
  });
  assert(joined);
  await chats.patchMetadata(turnsChat.id, {
    enableAgents: false,
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 16_384,
      decisionEnabled: true,
      decisionConnectionId: decisionConnection.id,
      knowledgeStarts: { [character.id]: null, [newcomer.id]: joined.id },
      knowledgeConfirmed: true,
    },
  });
  const ownRecall = savedJev.latestReceipt!.decisionRecall!;
  await chats.createMessage({
    chatId: turnsChat.id,
    role: "assistant",
    characterId: character.id,
    content: "Dottore remembers the silver compass.",
    extra: { advancedMemoryReceipt: { reasons: ["decision-recall"], decisionRecall: ownRecall } },
  });
  await chats.createMessage({
    chatId: turnsChat.id,
    role: "assistant",
    characterId: newcomer.id,
    content: "Cyno studies the camp.",
    extra: { advancedMemoryReceipt: { reasons: ["no-recall-candidates"] } },
  });
  const inspectRecall = async (forCharacterId: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: turnsChat.id, forCharacterId, returnPrompt: true, decisionDebug: "inspect" },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json().prompt.decisionDebug.advancedMemory?.recall;
  };
  assert.equal(await inspectRecall(newcomer.id), undefined, "Cyno is not shown Dottore's recalled scenes");
  assert.deepEqual(await inspectRecall(character.id), ownRecall, "Dottore still sees his own recall");
  // {{prompt}} opens Peek Prompt with no reply selected: the latest reply's saved prompt names its character.
  const turns = await chats.listMessages(turnsChat.id);
  const cynoPrepared = await memory.prepare({
    chatId: turnsChat.id,
    messages: turns.slice(0, -1),
    audienceCharacterIds: [newcomer.id],
    budgetTokens: 8000,
    readOnly: true,
  });
  await chats.updateMessageExtra(turns.at(-1)!.id, {
    advancedMemoryReceipt: cynoPrepared.receipt,
    cachedPrompt: [{ role: "user", content: "Cyno's saved request" }],
  });
  const latestPeek = await app.inject({ method: "POST", url: `/api/chats/${turnsChat.id}/peek-prompt`, payload: {} });
  assert.equal(latestPeek.statusCode, 200, latestPeek.body);
  assert.equal(latestPeek.json().source, "cached", latestPeek.body);
  assert.equal(latestPeek.json().characterId, newcomer.id, "Peek Prompt names whose saved prompt it shows");
  assert.equal(calls.length, callsBeforeInspection, "inspecting either character calls no provider");
  // An inactive character's preview falls back to an active one, but recall stays the inspected character's own.
  await chats.patchMetadata(turnsChat.id, { inactiveCharacterIds: [newcomer.id] });
  assert.equal(await inspectRecall(newcomer.id), undefined, "an inactive Cyno is not shown Dottore's recall either");
  assert.equal(calls.length, callsBeforeInspection, "inspecting an inactive character calls no provider");
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
  // Entries with no text for a character add nothing to that character's share, as they add nothing to recall.
  const maukieFill = "MAUKIE_ONLY ".repeat(2326);
  const maukieShare = estimateChatSummaryTokens(`${maukieFill}\n\nMAUKIE_TAIL`);
  assert(maukieShare <= 7000 && maukieShare + 20 > 7000, "Maukie's entries sit just under the 7k share");
  await chats.patchMetadata(privateChat.id, {
    summaryEntries: [
      createChatSummaryEntry({
        content: `{{#if char == "Maukie"}}${maukieFill}{{/if}}`,
        enabled: true,
        rangeStartIndex: 1,
        rangeEndIndex: 1,
      }),
      // 40 entries joined by blank lines would add 20 estimated tokens.
      ...Array.from({ length: 40 }, () =>
        createChatSummaryEntry({
          content: '{{#if char == "Pantalone"}}PANTALONE_NOTE{{/if}}',
          enabled: true,
          rangeStartIndex: 2,
          rangeEndIndex: 2,
        }),
      ),
      createChatSummaryEntry({
        content: '{{#if char == "Maukie"}}MAUKIE_TAIL{{/if}}',
        enabled: true,
        rangeStartIndex: 1,
        rangeEndIndex: 1,
      }),
    ],
  });
  await memory.checkScenesAfterGeneration(privateChat.id, { blocking: false });
  assert.deepEqual(calls, [], "another character's entries do not push Maukie over his share");
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

  // #7270: compaction combines Advanced Memory's own summaries with private character sections,
  // keeping each section for exactly the characters who knew it.
  const combineChat = await chats.create({
    name: "Combine private summaries",
    mode: "roleplay",
    characterIds: [privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(combineChat);
  chatIds.push(combineChat.id);
  for (const content of ["A shared walk.", "A second shared event.", "The next shared scene."])
    await chats.createMessage({
      chatId: combineChat.id,
      role: "user",
      content,
      ...(content.startsWith("The next") ? { extra: { isConversationStart: true } } : {}),
    });
  const combineSource = await chats.listMessages(combineChat.id);
  const forBoth = '{{#if char == "Maukie" || "Pantalone"}}';
  const maukieSecret = '{{#if char == "Maukie"}}MAUKIE_SECRET hid the key.{{/if}}';
  const recap = (id: string, index: number, content: string) =>
    createChatSummaryEntry({
      id,
      origin: "automated",
      title: `Messages #${index + 1}–#${index + 1}`,
      sourceMode: "range",
      content,
      enabled: true,
      messageIds: [combineSource[index]!.id],
      messageCount: 1,
      rangeStartIndex: index + 1,
      rangeEndIndex: index + 1,
    });
  const privateRecap = recap("private-recap", 0, `${forBoth}${"SHARED_WALK ".repeat(300)}${maukieSecret}{{/if}}`);
  const sharedRecap = recap("shared-recap", 1, `${forBoth}${"SHARED_TWO ".repeat(300)}{{/if}}`);
  await chats.patchMetadata(combineChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: 1000,
      sceneCheckInterval: 100,
      knowledgeStarts: { [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: [privateRecap, sharedRecap],
  });
  const combineEntries = async () =>
    JSON.parse((await chats.getById(combineChat.id))!.metadata).summaryEntries as Array<
      ReturnType<typeof createChatSummaryEntry>
    >;
  const recallFor = async (id: string) =>
    (
      await memory.prepare({
        chatId: combineChat.id,
        messages: combineSource,
        audienceCharacterIds: [id],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  summaryResponse = `COMBINED_WALK. ${maukieSecret}`;
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["summary"],
    "one Helper call combines every summary both characters read, including the one with a private section",
  );
  const [combineSystem, combineInput] = calls[0]!.messages;
  assert.match(combineSystem!.content, /Condense the ordered summaries below into one summary/u);
  assert.match(combineSystem!.content, /exactly its original condition/u);
  assert(combineInput!.content.includes(maukieSecret), "the private section reaches the Helper with its condition");
  assert.match(combineInput!.content, /SHARED_WALK[\s\S]*SHARED_TWO/u, "summaries stay in chat order");
  const privateCombined = await combineEntries();
  assert.deepEqual(
    privateCombined.filter((entry) => !entry.enabled).map((entry) => entry.id),
    [privateRecap.id, sharedRecap.id],
    "the combined summaries become inactive together",
  );
  const privateResult = privateCombined.find((entry) => entry.enabled)!;
  assert.equal(privateResult.origin, "automated");
  assert.equal(privateResult.title, "Messages #1–#2");
  assert.deepEqual(privateResult.messageIds, [combineSource[0]!.id, combineSource[1]!.id]);
  assert.match(await recallFor(privateA.id), /COMBINED_WALK[\s\S]*MAUKIE_SECRET/u);
  const pantaloneRecall = await recallFor(privateB.id);
  assert.match(pantaloneRecall, /COMBINED_WALK/u);
  assert.doesNotMatch(pantaloneRecall, /MAUKIE_SECRET/u, "Pantalone still never reads Maukie's private section");
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.deepEqual(calls, [], "combined summaries within the share need no further calls");

  // A result that would show Maukie's secret to Pantalone is not saved; the plain summary is still shortened.
  // This one keeps a Maukie section but copies the secret into the text both characters read.
  summaryReply = (prompt) =>
    prompt.includes("MAUKIE_SECRET")
      ? `COMBINED_WALK. MAUKIE_SECRET hid the key. {{#if char == "Maukie"}}Maukie kept quiet.{{/if}}`
      : "PLAIN_COMPACTED";
  await chats.patchMetadata(combineChat.id, { summaryEntries: [privateRecap, sharedRecap] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.equal(calls.length, 2);
  assert.match(JSON.stringify(calls[0]!.messages), /MAUKIE_SECRET/u);
  assert.doesNotMatch(
    JSON.stringify(calls[1]!.messages),
    /MAUKIE_SECRET|SHARED_WALK|exactly its original condition/u,
    "the plain summary is shortened on its own, as before",
  );
  const leakEntries = await combineEntries();
  assert.deepEqual(
    leakEntries[0],
    privateRecap,
    "a result that copies a private sentence into shared text is not saved",
  );
  assert.equal(leakEntries.find((entry) => entry.id === sharedRecap.id)!.enabled, false);
  assert(leakEntries.some((entry) => entry.enabled && entry.content.includes("PLAIN_COMPACTED")));
  assert.doesNotMatch(await recallFor(privateB.id), /MAUKIE_SECRET/u);

  // A result that drops the private section is rejected too, and the rejected attempt is kept,
  // so unchanged summaries do not pay for it again.
  summaryReply = () => "COMBINED_WALK. MAUKIE_SECRET hid the key.";
  await chats.patchMetadata(combineChat.id, { summaryEntries: [privateRecap] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.equal(calls.length, 1, "a rejected combination is not requested again for the same summaries");
  assert.deepEqual(await combineEntries(), [privateRecap]);

  // A result that is only shorter because it left out a condition is not saved, so it is not paid for on every reply.
  const walkRecap = recap("walk-recap", 0, privateRecap.content);
  summaryReply = () => `${"SHARED_WALK ".repeat(300)}${maukieSecret}`;
  await chats.patchMetadata(combineChat.id, { summaryEntries: [walkRecap] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.equal(calls.length, 1, "a combination that shortens nothing is requested once");
  assert.deepEqual(await combineEntries(), [walkRecap], "a combination that shortens nothing is not saved");

  // A private section may repeat a sentence both characters already read; keeping it shared is no leak.
  const innRecap = recap(
    "inn-recap",
    0,
    `${forBoth}They returned to the inn. ${"SHARED_WALK ".repeat(300)}{{#if char == "Maukie"}}MAUKIE_SECRET hid the key. They returned to the inn.{{/if}}{{/if}}`,
  );
  summaryReply = () => `They returned to the inn. COMBINED_WALK. ${maukieSecret}`;
  await chats.patchMetadata(combineChat.id, { summaryEntries: [innRecap] });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.match(
    (await combineEntries()).find((entry) => entry.enabled)!.content,
    /COMBINED_WALK/u,
    "a sentence that was already shared does not block the combination",
  );
  // Nor does one the shared text writes with curly quote marks and apostrophes.
  const curlyRecap = recap(
    "curly-recap",
    0,
    `${forBoth}“They returned to Maukie’s inn.” ${"SHARED_WALK ".repeat(300)}{{#if char == "Maukie"}}MAUKIE_SECRET hid the key. They returned to Maukie's inn.{{/if}}{{/if}}`,
  );
  summaryReply = () => `They returned to Maukie's inn. COMBINED_CURLY. ${maukieSecret}`;
  await chats.patchMetadata(combineChat.id, { summaryEntries: [curlyRecap] });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.match(
    (await combineEntries()).find((entry) => entry.enabled)!.content,
    /COMBINED_CURLY/u,
    "a shared sentence with other quote marks and apostrophes does not block the combination",
  );

  // A summary edited by hand keeps its text; only the plain summary is shortened.
  summaryReply = undefined;
  const editedRecap = {
    ...privateRecap,
    content: privateRecap.content.replace("hid", "buried"),
    updatedAt: new Date(Date.parse(privateRecap.createdAt) + 1000).toISOString(),
  };
  await chats.patchMetadata(combineChat.id, { summaryEntries: [editedRecap, sharedRecap] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(calls[0]!.messages), /MAUKIE_SECRET/u);
  assert.deepEqual((await combineEntries())[0], editedRecap, "an edited summary is never rewritten");

  // Merged group chats combine them too, instead of skipping every summary with a character condition.
  summaryResponse = `COMBINED_WALK. ${maukieSecret}`;
  await chats.patchMetadata(combineChat.id, { groupChatMode: "shared", summaryEntries: [privateRecap, sharedRecap] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert(calls[0]!.messages[1]!.content.includes(maukieSecret));
  const mergedCombined = await combineEntries();
  assert.equal(mergedCombined.filter((entry) => entry.enabled).length, 1);
  assert(mergedCombined.find((entry) => entry.enabled)!.content.includes(maukieSecret));
  summaryResponse = undefined;

  // A private sentence in Chinese or Japanese, which have no spaces, is caught when copied into shared text too.
  const cjkRecap = recap(
    "cjk-recap",
    0,
    `${forBoth}${"SHARED_WALK ".repeat(300)}{{#if char == "Maukie"}}毛奇把钥匙藏在了钟楼里。{{/if}}{{/if}}`,
  );
  summaryReply = (prompt) =>
    prompt.includes("钟楼")
      ? 'COMBINED_WALK. 毛奇把钥匙藏在了钟楼里。 {{#if char == "Maukie"}}毛奇保持沉默。{{/if}}'
      : "PLAIN_COMPACTED";
  await chats.patchMetadata(combineChat.id, { groupChatMode: "individual", summaryEntries: [cjkRecap, sharedRecap] });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.deepEqual((await combineEntries())[0], cjkRecap, "a copied private sentence without spaces is not saved");
  assert.doesNotMatch(await recallFor(privateB.id), /钟楼/u);
  // So is one whose full stops split it into pieces under four words: a decimal or an abbreviation.
  for (const [index, secret] of ["Meet at 3.5 now.", "Mr. Fox hid it."].entries()) {
    const pieceRecap = recap(
      `piece-recap-${index}`,
      0,
      `${forBoth}${"SHARED_WALK ".repeat(300)}{{#if char == "Maukie"}}${secret}{{/if}}{{/if}}`,
    );
    summaryReply = (prompt) =>
      prompt.includes(secret)
        ? `COMBINED_WALK. ${secret} {{#if char == "Maukie"}}Maukie kept quiet.{{/if}}`
        : "PLAIN_COMPACTED";
    await chats.patchMetadata(combineChat.id, { summaryEntries: [pieceRecap, sharedRecap] });
    await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
    assert.deepEqual((await combineEntries())[0], pieceRecap, `copied "${secret}" is not saved`);
    assert(!(await recallFor(privateB.id)).includes(secret));
  }
  // So is one copied without its quote marks, from a list without full stops, with a plain apostrophe or
  // with a part for Maukie in the middle. A long run of "!" in a private section is still checked quickly.
  for (const [index, [secret, copy, found]] of [
    ['"Maukie hid the key in the attic."', "Maukie hid the key in the attic.", "hid the key"],
    ["- Maukie hid the key in the attic\n- Maukie fears the butler", "Maukie fears the butler.", "butler"],
    ["Maukie’s key is in the attic.", "Maukie's key is in the attic.", "key is in"],
    [
      "Maukie hid the key in the attic.",
      'Maukie {{#if char == "Maukie"}}quietly {{/if}}hid the key in the attic.',
      "hid the key",
    ],
    [`Maukie hid the key in the attic${"!".repeat(1000)}`, "Maukie hid the key in the attic.", "hid the key"],
  ].entries()) {
    const copyRecap = recap(
      `copy-recap-${index}`,
      0,
      `${forBoth}${"SHARED_WALK ".repeat(300)}{{#if char == "Maukie"}}${secret}{{/if}}{{/if}}`,
    );
    summaryReply = (prompt) =>
      prompt.includes("SHARED_WALK")
        ? `COMBINED_WALK. ${copy} {{#if char == "Maukie"}}Maukie kept quiet.{{/if}}`
        : "PLAIN_COMPACTED";
    await chats.patchMetadata(combineChat.id, { summaryEntries: [copyRecap, sharedRecap] });
    const started = Date.now();
    await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
    assert(Date.now() - started < 5000, `checking "${copy}" takes under five seconds`);
    assert.deepEqual((await combineEntries())[0], copyRecap, `copied "${copy}" is not saved`);
    assert(!(await recallFor(privateB.id)).includes(found));
  }
  // Shared text that only reuses words from those sentences is still saved.
  const piecesRecap = recap(
    "pieces-recap",
    0,
    `${forBoth}${"SHARED_WALK ".repeat(300)}{{#if char == "Maukie"}}Meet at 3.5 now. Mr. Fox hid it.{{/if}}{{/if}}`,
  );
  summaryReply = (prompt) =>
    prompt.includes("Mr. Fox hid it.")
      ? 'COMBINED_WALK. Mr. Fox met them at 3.5 now. {{#if char == "Maukie"}}Meet at 3.5 now. Mr. Fox hid it.{{/if}}'
      : "PLAIN_COMPACTED";
  await chats.patchMetadata(combineChat.id, { summaryEntries: [piecesRecap, sharedRecap] });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.deepEqual(
    (await combineEntries()).filter((entry) => !entry.enabled).map((entry) => entry.id),
    [piecesRecap.id, sharedRecap.id],
    "a harmless shared sentence is saved",
  );
  const piecesRecall = await recallFor(privateB.id);
  assert.match(piecesRecall, /Mr\. Fox met them at 3\.5 now\./u);
  assert.doesNotMatch(piecesRecall, /Meet at 3\.5 now|hid it/u);
  // Text next to another macro counts as read by everyone.
  summaryReply = (prompt) =>
    prompt.includes("MAUKIE_SECRET")
      ? 'COMBINED_WALK. {{#if char == "Maukie"}}Maukie kept quiet.{{/if}} {{foo}} MAUKIE_SECRET hid the key.'
      : "PLAIN_COMPACTED";
  await chats.patchMetadata(combineChat.id, {
    summaryEntries: [privateRecap, recap("macro-recap", 1, `${forBoth}${"SHARED_TWO ".repeat(300)}{{foo}}{{/if}}`)],
  });
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.deepEqual((await combineEntries())[0], privateRecap, "a private sentence next to another macro is not saved");
  assert.doesNotMatch(await recallFor(privateB.id), /MAUKIE_SECRET/u);

  // A summary keeps one message range for all its readers, shown with that range's story dates, so in a
  // merged chat a summary only Maukie reads is not combined with one Pantalone also reads.
  const rangeChat = await chats.create({
    name: "Merged private range",
    mode: "roleplay",
    characterIds: [privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(rangeChat);
  chatIds.push(rangeChat.id);
  await chats.createMessage({
    chatId: rangeChat.id,
    role: "user",
    content: "Date: NIGHT_OF_THE_HEIST\nMaukie slips away alone.",
    extra: { hiddenFromAICharacterIds: [privateB.id] },
  });
  await chats.createMessage({ chatId: rangeChat.id, role: "user", content: "Date: MORNING_AFTER\nA shared walk." });
  await chats.createMessage({
    chatId: rangeChat.id,
    role: "user",
    content: "The next shared scene.",
    extra: { isConversationStart: true },
  });
  const rangeSource = await chats.listMessages(rangeChat.id);
  const rangeRecap = (id: string, index: number, content: string) =>
    createChatSummaryEntry({
      id,
      origin: "automated",
      title: `Messages #${index + 1}–#${index + 1}`,
      sourceMode: "range",
      content,
      enabled: true,
      messageIds: [rangeSource[index]!.id],
      messageCount: 1,
      rangeStartIndex: index + 1,
      rangeEndIndex: index + 1,
    });
  await chats.patchMetadata(rangeChat.id, {
    groupChatMode: "shared",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: 1000,
      sceneCheckInterval: 100,
      knowledgeStarts: { [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: [
      rangeRecap("maukie-only", 0, `{{#if char == "Maukie"}}${"MAUKIE_ALONE ".repeat(300)}{{/if}}`),
      rangeRecap("both-read", 1, `${forBoth}${"SHARED_TWO ".repeat(300)}{{/if}}`),
    ],
  });
  summaryReply = (prompt) =>
    `${prompt.includes("SHARED_TWO") ? "SHARED_SHORT. " : ""}${
      prompt.includes("MAUKIE_ALONE") ? '{{#if char == "Maukie"}}MAUKIE_SHORT.{{/if}}' : ""
    }`;
  calls.length = 0;
  await memory.checkScenesAfterGeneration(rangeChat.id, { blocking: false });
  assert.equal(calls.length, 2, "each group of readers is shortened on its own");
  const rangeFor = async (id: string) =>
    (
      await memory.prepare({
        chatId: rangeChat.id,
        messages: rangeSource,
        audienceCharacterIds: [id],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  const maukieRange = await rangeFor(privateA.id);
  for (const text of ["NIGHT_OF_THE_HEIST", "MAUKIE_SHORT", "SHARED_SHORT"]) assert(maukieRange.includes(text), text);
  const pantaloneRange = await rangeFor(privateB.id);
  assert.match(pantaloneRange, /SHARED_SHORT/u);
  assert.doesNotMatch(
    pantaloneRange,
    /NIGHT_OF_THE_HEIST|Messages #1/u,
    "Pantalone never gets the range or story date of a message hidden from him",
  );
  summaryReply = undefined;
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
