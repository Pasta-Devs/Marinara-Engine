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
let closeLatestScene = false;
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
              summary: summaryResponse ?? "ARCHIVED_RECAP: The silver compass promise guided the travelers.",
            })
          : "The character continues the silver compass journey.";
  const response = {
    id: "fixture",
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: content }] }],
    usage: { input_tokens: 40, output_tokens: 20, total_tokens: 60 },
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
          : { choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] },
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
    maxContext: 8192,
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
      maxContextTokens: 8192,
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
        content: `${index === 0 && newScene ? "SCENE_CHANGE " : ""}The silver compass promise continued. ${index}`,
        ...(index === 0 && newScene ? { extra: { isConversationStart: true } } : {}),
      });
  };
  await addFourMessages();
  await chats.updateMessageContent(
    (await chats.listMessages(chat.id))[0]!.id,
    "ARCHIVED_SOURCE_ONLY: The silver compass promise began.",
  );
  calls.length = 0;
  await generate();
  await waitForSceneCheck();
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
    calls.slice(0, 3).map((call) => call.kind),
    ["main", "scene", "summary"],
    "a detected scene ending prepares the archive only after the main reply",
  );
  assert(calls.some((call) => call.kind === "embedding"));
  const archive = (await memory.status(chat.id)).records;
  assert(archive.some((record) => record.kind === "scene" && record.content.includes("ARCHIVED_RECAP")));
  assert(
    archive.filter((record) => record.content).every((record) => record.endIndex <= 5),
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
    /ARCHIVED_RECAP|ARCHIVED_SOURCE_ONLY|LATEST_SWIPE_CACHE_MUST_NOT_WIN/u,
    "a saved recap cannot bypass changed source visibility",
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
      maxContextTokens: 8192,
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
  const constantText = "EXISTING_RANGE_SUMMARY ".repeat(1450); // ~8k, below the configured 10k cap.
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
    "8k of constants under a 10k cap triggers no summary call, regardless of raw-history size",
  );
  assert(JSON.stringify(calls[0]!.messages).includes(constantText.trim()), "the existing constant is included intact");
  assert(!JSON.stringify(calls[0]!.messages).includes("ALREADY_SUMMARIZED_RAW"));
  const beforeConstants = JSON.parse((await chats.getById(constantsChat.id))!.metadata).summaryEntries;
  assert.equal(beforeConstants.length, 1, "no parallel continuity store is populated");
  assert(!(await memory.status(constantsChat.id)).records.some((record) => record.kind === "continuity"));

  // The summary setting is a target with 2,000 tokens of tolerance, independent of raw history.
  const toleranceText = "TOLERATED_CONSTANT ".repeat(2400);
  const toleranceTokens = estimateChatSummaryTokens(toleranceText);
  assert(toleranceTokens > 10_000 && toleranceTokens <= 12_000);
  await chats.patchMetadata(constantsChat.id, {
    summaryEntries: [{ ...beforeConstants[0], content: toleranceText }],
  });
  calls.length = 0;
  assert(!(await generateConstants()).body.includes('"type":"error"'));
  await memory.checkScenesAfterGeneration(constantsChat.id, { blocking: false });
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main"],
    "the 2k allowance does not trigger consolidation",
  );
  assert(JSON.stringify(calls[0]!.messages).includes(toleranceText.trim()));

  const largeConstants = [{ ...beforeConstants[0], content: "CONSTANTS_ONLY_SOURCE ".repeat(2600) }];
  assert(estimateChatSummaryTokens(largeConstants[0].content) > 12_000);
  summaryResponse = `ARCHIVED_RECAP ${toleranceText}`; // Accept a completed result inside the allowance on the first pass.
  await chats.patchMetadata(constantsChat.id, { summaryEntries: largeConstants });
  let releaseHelper!: () => void;
  summaryGate = new Promise<void>((resolve) => {
    releaseHelper = resolve;
  });
  calls.length = 0;
  const beforeCombine = await generateConstants();
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
    /Aim for 10000 tokens, allowing up to 12000 tokens/u,
    "the helper receives the soft target and its allowance",
  );
  assert.doesNotMatch(
    JSON.stringify(combinedRequest.messages),
    /ALREADY_SUMMARIZED_RAW|ongoing scene continues|character continues/iu,
    "consolidation receives only selected summaries",
  );
  try {
    const duringCombine = await Promise.race([
      generateConstants(),
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
  await memory.checkScenesAfterGeneration(constantsChat.id, { blocking: false });
  assert.equal(
    calls.filter((call) => call.kind === "summary").length,
    1,
    "a result within the 2k allowance needs no paid retry",
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
  const partialChat = await chats.create({
    name: "Reuse existing summary ranges",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(partialChat);
  chatIds.push(partialChat.id);
  await chats.patchMetadata(partialChat.id, {
    enableAgents: false,
    summaryMaxTokens: 1024,
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      summaryBudgetTokens: 3000,
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
    content: "EXISTING_RANGE_CORRECTION",
    sourceMode: "range",
    rangeStartIndex: 1,
    rangeEndIndex: 2,
  });
  await chats.patchMetadata(partialChat.id, { summaryEntries: [manual] });
  await memory.initialize(partialChat.id);
  const partialSource = await chats.listMessages(partialChat.id);
  const beforeAddition = await memory.prepare({
    chatId: partialChat.id,
    messages: partialSource,
    audienceCharacterIds: [],
    budgetTokens: 5000,
  });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(partialChat.id);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["summary"],
    "only uncovered scene messages need a new constant",
  );
  assert.equal(calls[0]!.maxTokens, 1024);
  const additionPrompt = JSON.stringify(calls[0]!.messages);
  assert(additionPrompt.includes("UNCOVERED_NEW_EVENT"));
  assert.doesNotMatch(additionPrompt, /ALREADY_COVERED|EXISTING_RANGE_CORRECTION|present day/u);
  const addedEntries = JSON.parse((await chats.getById(partialChat.id))!.metadata).summaryEntries;
  assert.equal(addedEntries.length, 2);
  assert.deepEqual(addedEntries[0], manual, "pre-existing ranged constants remain intact");
  assert.equal(addedEntries[1].rangeStartIndex, 3);
  assert.equal(addedEntries[1].rangeEndIndex, 3);
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
