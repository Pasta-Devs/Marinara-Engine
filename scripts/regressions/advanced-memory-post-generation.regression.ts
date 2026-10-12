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
const { estimateTextTokens, measureContextBudget } =
  await import("../../packages/server/src/services/llm/base-provider.js");
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
  tools?: unknown[];
}> = [];
let summaryGate: Promise<void> | undefined;
let summaryResponse: string | undefined;
let summaryReply: ((prompt: string) => string) | undefined;
let summaryFinishReason = "stop";
let closeLatestScene = false;
let mainInputTokens = 40;
let mainOutputTokens = 20;
let mainToolCall = false;
// A follow-up reports mainFollowupInputTokens; the first request reports mainInputTokens (or no usage).
let mainFollowupInputTokens: number | undefined;
let mainFirstUsage = true;
// The first reply asks for a roll in text instead of a native tool call, and can be padded.
let mainTextRoll = false;
let mainFirstReplyPadding = "";
// Streamed main replies send usage only on their last chunk, after a pause, as OpenAI-compatible
// providers do. Counts streams the client closed before that chunk.
let mainStreamUsageLast = false;
let mainStreamsCutBeforeUsage = 0;
// How many roll follow-ups ask for another roll. Each later follow-up reports 100 more input tokens.
let mainFollowupRolls = 0;
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
    tools: body.tools,
  });
  if (kind === "summary" && summaryGate) await summaryGate;
  // A tool round or roll follow-up resends the outgoing prompt with the first reply and the result.
  const followup =
    kind === "main" &&
    (messages.some((message: { role: string }) => message.role === "tool") ||
      prompt.includes("The engine resolved your roll request"));
  const firstMainReply = kind === "main" && !followup;
  const resolvedRolls = prompt.split("The engine resolved your roll request").length - 1;
  const inputTokens = followup
    ? (mainFollowupInputTokens ?? mainInputTokens) + 100 * Math.max(0, resolvedRolls - 1)
    : mainInputTokens;
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
          : firstMainReply
            ? mainFirstReplyPadding +
              (mainTextRoll
                ? 'The guard lunges. [roll: notation="1d1", reason="dodge"]'
                : "The character continues the silver compass journey.")
            : followup && mainTextRoll && resolvedRolls <= mainFollowupRolls
              ? 'The guard swings again. [roll: notation="1d1", reason="parry"]'
              : "The character continues the silver compass journey.";
  const response = {
    id: "fixture",
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: content }] }],
    usage: {
      input_tokens: inputTokens,
      output_tokens: mainOutputTokens,
      total_tokens: inputTokens + mainOutputTokens,
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
    const usageLast = !responses && kind === "main" && mainStreamUsageLast;
    if (usageLast) {
      // The route cuts a reply at its roll by closing the stream. Wait for that close, with a fixed
      // fallback in case it never comes, rather than a fixed sleep a slow runner could outlast.
      let closed = false;
      if (content.includes("[roll:") && !res.destroyed)
        await new Promise<void>((resolve) => {
          const fallback = setTimeout(resolve, 5_000);
          res.once("close", () => {
            closed = true;
            clearTimeout(fallback);
            resolve();
          });
        });
      if (closed || res.destroyed) mainStreamsCutBeforeUsage++;
    }
    res.end(
      responses
        ? `data: ${JSON.stringify({ type: "response.completed", response })}\n\n`
        : `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n${
            usageLast
              ? `data: ${JSON.stringify({
                  choices: [],
                  usage: {
                    prompt_tokens: inputTokens,
                    completion_tokens: mainOutputTokens,
                    total_tokens: inputTokens + mainOutputTokens,
                  },
                })}\n\n`
              : ""
          }data: [DONE]\n\n`,
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
              ...(firstMainReply && !mainFirstUsage
                ? {}
                : {
                    usage: {
                      prompt_tokens: inputTokens,
                      completion_tokens: mainOutputTokens,
                      total_tokens: inputTokens + mainOutputTokens,
                    },
                  }),
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
  mainInputTokens = 64999;
  await generateUsage();
  assert.equal(
    (await memory.status(actualUsageChat.id)).job.contextStarts,
    undefined,
    "input one token under the threshold still fits",
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

  // Only the outgoing prompt counts (#7455). A roll or tool follow-up resends it with the
  // model's own reply and the result, so it never cuts and never fails on the cap.
  const followupSettings = {
    ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
    enabled: true,
    maxContextTokens: 65_000,
    sceneCheckInterval: 100,
  };
  const createFollowupChat = async (name: string, connectionId = connection.id) => {
    const created = await chats.create({
      name,
      mode: "roleplay",
      characterIds: [character.id],
      connectionId,
    });
    assert(created);
    chatIds.push(created.id);
    await chats.patchMetadata(created.id, {
      enableAgents: false,
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { roll: true },
      advancedMemory: followupSettings,
    });
    await chats.createMessagesBatch(
      created.id,
      Array.from({ length: 9 }, (_, index) => ({
        role: "user" as const,
        content: `${index === 4 ? "SCENE_CHANGE " : ""}The silver compass journey continues.`,
      })),
    );
    await memory.initialize(created.id);
    return created;
  };
  const followupChat = await createFollowupChat("Follow-up input cutoff");
  const followupSource = await chats.listMessages(followupChat.id);
  const generateFollowup = (chatId = followupChat.id, streaming = false) =>
    app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, forCharacterId: character.id, streaming },
    });
  const sentFollowups = (since: number) =>
    calls
      .slice(since)
      .filter(
        (call) =>
          call.kind === "main" &&
          (call.messages.some((message) => message.role === "tool") ||
            JSON.stringify(call.messages).includes("The engine resolved your roll request") ||
            // The last tool round's follow-up retells the results as text (toolRoundsAsText).
            JSON.stringify(call.messages).includes("The engine ran the tools you called")),
      ).length;
  const expectFollowupWithoutCutoff = async (label: string) => {
    const before = calls.length;
    const result = await generateFollowup();
    assert.equal(result.statusCode, 200, result.body);
    assert.ok(!result.body.includes('"type":"error"'), `${label}: ${result.body}`);
    assert.equal(sentFollowups(before), 1, `${label}: the follow-up was sent`);
    const info = JSON.parse((await chats.listMessages(followupChat.id)).at(-1)!.extra).generationInfo;
    assert.equal(info.tokensLastRequestInput, 66_600, `${label}: the follow-up reported input over the cap`);
    assert.equal((await memory.status(followupChat.id)).job.contextStarts, undefined, label);
  };
  mainInputTokens = 64_000;
  mainFollowupInputTokens = 66_600;
  mainTextRoll = true;
  await expectFollowupWithoutCutoff("a roll follow-up over the cap does not cut when the outgoing prompt fit");
  mainTextRoll = false;
  mainToolCall = true;
  await expectFollowupWithoutCutoff("a native tool round over the cap does not cut when the outgoing prompt fit");
  mainFirstUsage = false;
  await expectFollowupWithoutCutoff("a follow-up never stands in for a first request that reported no usage");
  mainFirstUsage = true;

  // The model's own window, not the cap, bounds a follow-up before it is sent.
  mainInputTokens = 40;
  mainFollowupInputTokens = undefined;
  await chats.patchMetadata(followupChat.id, { advancedMemory: { ...followupSettings, maxContextTokens: 1_500 } });
  mainFirstReplyPadding = "The guard circles slowly. ".repeat(3000); // ~19,500 tokens: past the 16,384 window.
  const oversizedBefore = calls.length;
  const oversizedFollowup = await generateFollowup();
  assert.match(
    oversizedFollowup.body,
    /"type":"error"[^\n]*exceeds the model's context window/u,
    "a follow-up past the model's own window still fails clearly",
  );
  assert.equal(sentFollowups(oversizedBefore), 0, "the oversized follow-up is never sent");
  mainFirstReplyPadding = "The guard circles slowly. ".repeat(400); // ~2,600 tokens: past the cap, inside the window.
  const roomyBefore = calls.length;
  const roomyFollowup = await generateFollowup();
  assert.equal(roomyFollowup.statusCode, 200, roomyFollowup.body);
  assert.ok(
    !roomyFollowup.body.includes('"type":"error"'),
    `a follow-up past the cap but inside the model's window is sent: ${roomyFollowup.body}`,
  );
  assert.equal(sentFollowups(roomyBefore), 1, "the follow-up past the cap reached the model");
  assert.equal((await memory.status(followupChat.id)).job.contextStarts, undefined);

  // A follow-up reserves room only for the tool definitions it sends. The final follow-up of the
  // last allowed tool round sends none, so one that fits the window only without them is sent,
  // while a tool round of the same size, which sends them, fails before it is sent.
  const reservePadding = "The guard circles slowly. ";
  // Without an output override, each request carries the reply reserve its fit used.
  const reserveConnection = await createConnectionsStorage(db).create({
    name: "Tool reserve fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 16_384,
    embeddingModel: "fixture-embedding",
  });
  const generateWithToolRounds = async (repeats: number, maxToolRounds?: string) => {
    const reserveChat = await createFollowupChat("Follow-up tool reserve", reserveConnection.id);
    await chats.patchMetadata(reserveChat.id, { advancedMemory: { ...followupSettings, maxContextTokens: 1_500 } });
    mainFirstReplyPadding = reservePadding.repeat(repeats);
    const previousMaxToolRounds = process.env.MAX_TOOL_ROUNDS;
    if (maxToolRounds) process.env.MAX_TOOL_ROUNDS = maxToolRounds;
    const before = calls.length;
    try {
      const result = await generateFollowup(reserveChat.id);
      assert.equal(result.statusCode, 200, result.body);
      return { body: result.body, before, main: calls.slice(before).filter((call) => call.kind === "main") };
    } finally {
      if (previousMaxToolRounds === undefined) delete process.env.MAX_TOOL_ROUNDS;
      else process.env.MAX_TOOL_ROUNDS = previousMaxToolRounds;
    }
  };
  const windowFit = (call: (typeof calls)[number], tools?: unknown[]) =>
    measureContextBudget(call.messages as Parameters<typeof measureContextBudget>[0], {
      maxContext: 16_384,
      maxTokens: call.maxTokens,
      tools: tools as Parameters<typeof measureContextBudget>[1]["tools"],
    });
  // Place the follow-up halfway into the room the tool definitions take, measured on a small one.
  const reserveSample = await generateWithToolRounds(0, "1");
  assert.ok(!reserveSample.body.includes('"type":"error"'), reserveSample.body);
  const [sampleOutgoing, sampleFinal] = reserveSample.main;
  assert.ok(sampleOutgoing?.tools?.length, "the outgoing request sends the responder's tools");
  assert.ok(sampleFinal && sentFollowups(reserveSample.before) === 1, "the final follow-up was sent");
  assert.equal(sampleFinal.tools, undefined, "the final follow-up sends no tools");
  const toolReserve =
    windowFit(sampleFinal, sampleOutgoing.tools).reservedTokens - windowFit(sampleFinal).reservedTokens;
  const tokensPerRepeat = estimateTextTokens(reservePadding.repeat(1000)) / 1000;
  const reserveRepeats = Math.round(
    (windowFit(sampleFinal).inputBudget - toolReserve / 2 - windowFit(sampleFinal).estimatedTokens) / tokensPerRepeat,
  );
  const finalWithoutTools = await generateWithToolRounds(reserveRepeats, "1");
  assert.ok(
    !finalWithoutTools.body.includes('"type":"error"'),
    `a final follow-up that sends no tools reserves no room for them: ${finalWithoutTools.body}`,
  );
  assert.equal(sentFollowups(finalWithoutTools.before), 1, "the final follow-up without tools reached the model");
  const sentFinal = finalWithoutTools.main.at(-1)!;
  assert.equal(sentFinal.tools, undefined, "the final follow-up past the tool reserve sends no tools");
  assert.ok(
    windowFit(sentFinal).fits && !windowFit(sentFinal, sampleOutgoing.tools).fits,
    "the follow-up fits the model's window only without the tool definitions",
  );
  const roundWithTools = await generateWithToolRounds(reserveRepeats);
  assert.match(
    roundWithTools.body,
    /"type":"error"[^\n]*exceeds the model's context window/u,
    "a tool round of the same size still reserves room for the tools it sends",
  );
  assert.equal(sentFollowups(roundWithTools.before), 0, "the tool round past the window is never sent");
  mainFirstReplyPadding = "";
  mainToolCall = false;

  // Reaching the cap exactly cuts (one token under is checked above).
  await chats.patchMetadata(followupChat.id, { advancedMemory: followupSettings });
  mainInputTokens = 65_000;
  const exactResult = await generateFollowup();
  assert.equal(exactResult.statusCode, 200, exactResult.body);
  assert.deepEqual(
    (await memory.status(followupChat.id)).job.contextStarts?.map((start) => [
      start.messageId,
      start.audienceCharacterIds,
    ]),
    [[followupSource[4]!.id, []]],
    "an outgoing prompt that reaches the cap exactly resets everyone to the latest scene",
  );

  // A streamed reply is cut where it asks for a roll, before an OpenAI-compatible provider sends
  // the outgoing prompt's usage on its last chunk. The roll follow-up's input, less a ceiling on
  // what the follow-up added, then stands for that prompt: it never cuts early, but still cuts.
  const streamedRollChat = await createFollowupChat("Streamed roll cutoff");
  const streamedRollSource = await chats.listMessages(streamedRollChat.id);
  mainStreamUsageLast = true;
  mainTextRoll = true;
  const streamRoll = async (outgoingInput: number, followupInput: number, chat = streamedRollChat, rolls = 1) => {
    mainInputTokens = outgoingInput;
    mainFollowupInputTokens = followupInput;
    mainFollowupRolls = rolls - 1;
    const before = calls.length;
    const cutBefore = mainStreamsCutBeforeUsage;
    const result = await generateFollowup(chat.id, true);
    assert.equal(result.statusCode, 200, result.body);
    assert.ok(!result.body.includes('"type":"error"'), result.body);
    assert.equal(sentFollowups(before), rolls, "the streamed roll follow-up was sent");
    assert.equal(mainStreamsCutBeforeUsage - cutBefore, rolls, "the reply was cut at its roll before usage arrived");
    return (await memory.status(chat.id)).job.contextStarts?.map((start) => [
      start.messageId,
      start.audienceCharacterIds,
    ]);
  };
  assert.equal(
    await streamRoll(64_999, 65_099),
    undefined,
    "a streamed roll follow-up past the cap does not cut when what it added explains the difference",
  );
  assert.deepEqual(
    await streamRoll(66_000, 66_100),
    [[streamedRollSource[4]!.id, []]],
    "a streamed roll whose outgoing prompt passed the cap still resets everyone to the latest scene",
  );
  // A reply that rolls twice is cut at both rolls, so neither stream reports usage. The first
  // request that does, less everything added since the outgoing prompt, still stands for it.
  const twoRollChat = await createFollowupChat("Two streamed rolls cutoff");
  const twoRollSource = await chats.listMessages(twoRollChat.id);
  assert.equal(
    await streamRoll(64_999, 65_099, twoRollChat, 2),
    undefined,
    "a reply cut at two rolls does not cut when what the follow-ups added explains the difference",
  );
  assert.deepEqual(
    await streamRoll(66_000, 66_100, twoRollChat, 2),
    [[twoRollSource[4]!.id, []]],
    "a reply cut at two rolls whose outgoing prompt passed the cap still resets everyone to the latest scene",
  );
  mainFollowupRolls = 0;
  mainStreamUsageLast = false;
  mainTextRoll = false;
  mainFollowupInputTokens = undefined;
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
  // A summary with {{char}} that only one character reads is still combined, as that character reads it.
  await chats.patchMetadata(constantsChat.id, {
    summaryEntries: [{ ...beforeConstants[0], content: `{{char}} ${"CHAR_CONSTANT ".repeat(3000)}` }],
  });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(constantsChat.id, { blocking: false });
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["summary"],
  );
  assert.match(JSON.stringify(calls[0]!.messages), /Dottore CHAR_CONSTANT/u);

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
  // #7454: a summary written by hand with a section per character goes to the Helper too, with its conditions.
  // This answer drops those sections, so it is not saved; retried in halves, the other summary is shortened alone.
  assert.equal(calls.length, 3);
  assert.match(calls[0]!.messages[1]!.content, /\{\{#if char == "Maukie"\}\}MAUKIE_SECTION[\s\S]*STABLE_CONSTANT/u);
  assert.match(JSON.stringify(calls[2]!.messages), /STABLE_CONSTANT/u);
  assert.doesNotMatch(JSON.stringify(calls[2]!.messages), /MAUKIE_SECTION|PANTALONE_SECTION/u);
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
  assert.equal(calls.length, 3);
  assert.match(
    calls[0]!.messages[1]!.content,
    /\{\{#if char == "Maukie"\}\}MAUKIE_SECTION[\s\S]*\{\{#if char == "Pantalone"\}\}PANTALONE_SECTION/u,
    "shared-mode compaction must not resolve a mixed-POV template as only the first character",
  );
  assert.doesNotMatch(JSON.stringify(calls[2]!.messages), /MAUKIE_SECTION|PANTALONE_SECTION/u);
  assert.deepEqual(
    JSON.parse((await chats.getById(macroChat.id))!.metadata).summaryEntries.find(
      (entry: { id: string }) => entry.id === template.id,
    ),
    template,
    "all existing POV sections and their conditions remain saved",
  );
  await chats.patchMetadata(macroChat.id, { groupChatMode: "individual" });

  // Its {{char}} keeps it out of combining (#7454), so it still fills most of each view.
  const tightTemplate = {
    ...template,
    content: `{{#if char == "Maukie"}}${"A".repeat(6803 * 4)}{{/if}}\n{{#if char == "Pantalone"}}${"B".repeat(6803 * 4)}{{/if}}\n{{char}} remembers.`,
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
  assert.doesNotMatch(JSON.stringify(calls[0]!.messages), /AAAA|BBBB/u);
  assert.equal(calls[0]!.maxTokens, 12_000, "compaction preserves a larger Chat Summary output allowance");
  assert.doesNotMatch(calls[0]!.messages[0]!.content, /196 tokens/u);
  // The target is the summary's proportional share of the budget, not the little room the template leaves.
  const askedTokens = Number(/Aim for approximately (\d+) tokens/u.exec(calls[0]!.messages[0]!.content)?.[1]);
  assert(askedTokens > 1000, `no tiny compaction target (#6512): ${askedTokens}`);
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

  // #7454: a scene with a message hidden from Pantalone becomes one constant for everyone who reads its recap,
  // not a copy per reader, so the narrator, who reads every section, gets the scene once. Pantalone's prompt
  // still shows only the range and text he may read.
  const whisperChat = await chats.create({
    name: "Whispered scene, one constant",
    mode: "roleplay",
    characterIds: [character.id, privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(whisperChat);
  chatIds.push(whisperChat.id);
  await chats.patchMetadata(whisperChat.id, {
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
  await chats.createMessage({ chatId: whisperChat.id, role: "user", content: "Date: DAY_OF_STROLL\nA shared stroll." });
  await chats.createMessage({
    chatId: whisperChat.id,
    role: "user",
    content: "Date: NIGHT_OF_WHISPER\nMaukie whispers the plan.",
    extra: { hiddenFromAICharacterIds: [privateB.id] },
  });
  await chats.createMessage({
    chatId: whisperChat.id,
    role: "user",
    content: "SCENE_CHANGE present day",
    extra: { isConversationStart: true },
  });
  summaryReply = () => 'They took a SHARED_STROLL. {{#if char == "Maukie"}}Maukie heard the WHISPERED_PLAN.{{/if}}';
  await memory.initialize(whisperChat.id);
  await memory.checkScenesAfterGeneration(whisperChat.id, { blocking: false });
  summaryReply = undefined;
  const whisperEntries = (
    JSON.parse((await chats.getById(whisperChat.id))!.metadata).summaryEntries as Array<
      ReturnType<typeof createChatSummaryEntry>
    >
  ).filter((entry) => entry.enabled);
  const whisperSource = await chats.listMessages(whisperChat.id);
  assert.equal(whisperEntries.length, 1, "readers who get the same recap share one constant");
  assert.deepEqual(whisperEntries[0]!.messageIds, [whisperSource[0]!.id, whisperSource[1]!.id]);
  const whisperPrompt = async (id: string) =>
    (
      await memory.prepare({
        chatId: whisperChat.id,
        messages: whisperSource,
        audienceCharacterIds: [id],
        budgetTokens: 12_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  const narratorWhisper = await whisperPrompt(character.id);
  assert.equal(narratorWhisper.match(/SHARED_STROLL/gu)?.length, 1, "the narrator reads the scene once");
  assert.equal(narratorWhisper.match(/WHISPERED_PLAN/gu)?.length, 1);
  assert.match(await whisperPrompt(privateA.id), /DAY_OF_STROLL → NIGHT_OF_WHISPER[\s\S]*WHISPERED_PLAN/u);
  const pantaloneWhisper = await whisperPrompt(privateB.id);
  assert.match(pantaloneWhisper, /^Messages #1–#1; [^\n]*: DAY_OF_STROLL\.\nThey took a SHARED_STROLL\.\s*$/u);
  assert.doesNotMatch(
    pantaloneWhisper,
    /NIGHT_OF_WHISPER|WHISPERED_PLAN|Messages #1–#2/u,
    "Pantalone gets neither the hidden message's range and date nor Maukie's section",
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
  // #7454: a rejected answer is retried in halves, in chat order: the private summary alone, rejected again
  // and kept, then the plain one.
  assert.equal(calls.length, 3);
  assert.match(JSON.stringify(calls[0]!.messages), /MAUKIE_SECRET[\s\S]*SHARED_TWO/u);
  assert.match(JSON.stringify(calls[1]!.messages), /MAUKIE_SECRET/u);
  assert.doesNotMatch(
    JSON.stringify(calls[2]!.messages),
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

  // #7454: a summary written or edited by hand with a private section is combined too, its sections kept.
  // The original is never rewritten: it stays as an inactive version that can be turned back on.
  summaryReply = undefined;
  const editedRecap = {
    ...privateRecap,
    origin: "manual" as const,
    content: privateRecap.content.replace("hid", "buried"),
    updatedAt: new Date(Date.parse(privateRecap.createdAt) + 1000).toISOString(),
  };
  const buriedSecret = '{{#if char == "Maukie"}}MAUKIE_SECRET buried the key.{{/if}}';
  summaryResponse = `COMBINED_EDIT. ${buriedSecret}`;
  await chats.patchMetadata(combineChat.id, { summaryEntries: [editedRecap, sharedRecap] });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(combineChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert(calls[0]!.messages[1]!.content.includes(buriedSecret), "the edited section reaches the Helper as written");
  const editedEntries = await combineEntries();
  assert.deepEqual(
    editedEntries.filter((entry) => !entry.enabled).map((entry) => entry.id),
    [editedRecap.id, sharedRecap.id],
    "a hand-edited summary is combined when over the share",
  );
  assert.equal(
    editedEntries.find((entry) => entry.id === editedRecap.id)!.content,
    editedRecap.content,
    "an edited summary is never rewritten",
  );
  assert(editedEntries.find((entry) => entry.enabled)!.content.includes(buriedSecret));
  assert.doesNotMatch(await recallFor(privateB.id), /MAUKIE_SECRET/u);
  summaryResponse = undefined;

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
  // So is one copied without its quote marks, from a list without full stops, with a plain apostrophe,
  // with a part for Maukie in the middle, or shortened around a private phrase (#7454). A long run of "!" in a
  // private section is still checked quickly.
  for (const [index, [secret, copy, found]] of [
    [
      "Maukie secretly hid the brass key under the floorboards.",
      "Maukie hid the brass key under the floor.",
      "brass key",
    ],
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

  // A summary only Maukie reads is combined with one Pantalone also reads (#7454). Each reader's prompt shows
  // the range and story dates of only the messages that reader can see, so the combined summary never shows
  // Pantalone the number or date of a message hidden from him.
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
  assert.equal(calls.length, 1, "summaries different characters read are combined in one call");
  const rangeEntries = JSON.parse((await chats.getById(rangeChat.id))!.metadata).summaryEntries as Array<
    ReturnType<typeof createChatSummaryEntry>
  >;
  assert.deepEqual(
    rangeEntries.filter((entry) => entry.enabled).map((entry) => entry.messageIds),
    [[rangeSource[0]!.id, rangeSource[1]!.id]],
  );
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
  for (const mode of ["shared", "individual"]) {
    await chats.patchMetadata(rangeChat.id, { groupChatMode: mode });
    const pantaloneRange = await rangeFor(privateB.id);
    assert.match(
      pantaloneRange,
      /^Messages #2–#2; source timeframe \(summary corrections take precedence\): MORNING_AFTER\.\nSHARED_SHORT\.$/u,
      mode,
    );
    assert.doesNotMatch(
      pantaloneRange,
      /NIGHT_OF_THE_HEIST|Messages #1/u,
      "Pantalone never gets the range or story date of a message hidden from him",
    );
    assert.match(
      await rangeFor(privateA.id),
      /^Messages #1–#2; source timeframe [^:]*: NIGHT_OF_THE_HEIST → MORNING_AFTER\./u,
    );
  }
  // A merged prompt for both shows the range and dates of the messages both of them can see above the text
  // both read, so the shared events don't seem to start on the night only Maukie knows of.
  await chats.patchMetadata(rangeChat.id, { groupChatMode: "shared" });
  const bothRange =
    (
      await memory.prepare({
        chatId: rangeChat.id,
        messages: rangeSource,
        audienceCharacterIds: [privateA.id, privateB.id],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  assert.match(
    bothRange,
    /^Messages #2–#2; [^\n]*: MORNING_AFTER\.\nSHARED_SHORT\. \[Known only to Maukie: MAUKIE_SHORT\.\]$/u,
  );
  assert.doesNotMatch(bothRange, /NIGHT_OF_THE_HEIST|Messages #1/u);
  // A summary only Maukie reads keeps its range and date there, next to the mark that it is his.
  await chats.patchMetadata(rangeChat.id, {
    summaryEntries: [rangeRecap("maukie-alone", 0, '{{#if char == "Maukie"}}MAUKIE_ALONE.{{/if}}')],
  });
  assert.match(
    (
      await memory.prepare({
        chatId: rangeChat.id,
        messages: rangeSource,
        audienceCharacterIds: [privateA.id, privateB.id],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "",
    /^Messages #1–#1; [^\n]*: NIGHT_OF_THE_HEIST\.\n\[Known only to Maukie: MAUKIE_ALONE\.\]$/u,
  );
  summaryReply = undefined;

  // #7454, as in a one-by-one chat with a narrator and four characters: every summary has its own readers, some
  // leave the narrator out, and two were written or edited by hand with private sections. The narrator reads all
  // of them, so its view is over the share. One call combines them all and brings it under; the next reply calls
  // nothing. This Helper keeps every condition and shortens each run of filler.
  const keepSections = (prompt: string) =>
    (JSON.parse(prompt).at(-1).content as string).replace(/(?:FILL_\w+ )+/gu, "SHORT ");
  const powers = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Powers That Be" }));
  assert(powers);
  const canonChat = await chats.create({
    name: "Narrator canon",
    mode: "roleplay",
    characterIds: [powers.id, character.id, privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(canonChat);
  chatIds.push(canonChat.id);
  for (let index = 1; index <= 5; index++)
    await chats.createMessage({ chatId: canonChat.id, role: "user", content: `Scene ${index}.` });
  await chats.createMessage({
    chatId: canonChat.id,
    role: "user",
    content: "The next scene.",
    extra: { isConversationStart: true },
  });
  const canonSource = await chats.listMessages(canonChat.id);
  const fill = (name: string, count = 150) => `FILL_${name} `.repeat(count);
  const canonEntry = (index: number, content: string, extra: Record<string, unknown> = {}) =>
    createChatSummaryEntry({
      id: `canon-${index}`,
      origin: "automated",
      title: `Messages #${index + 1}–#${index + 1}`,
      sourceMode: "range",
      content,
      enabled: true,
      messageIds: [canonSource[index]!.id],
      messageCount: 1,
      rangeStartIndex: index + 1,
      rangeEndIndex: index + 1,
      ...extra,
    });
  const arcSecret = '{{#if char == "Maukie"}}ARC_SECRET Maukie keeps the brass key hidden.{{/if}}';
  const canonEntries = [
    canonEntry(0, `{{#if char == "Maukie" || "Pantalone"}}${fill("A")}{{/if}}`),
    canonEntry(1, `{{#if char == "Maukie"}}${fill("B")}{{/if}}`),
    canonEntry(2, `{{#if char == "Dottore" || "Pantalone" || "Powers That Be"}}${fill("C")}{{/if}}`),
    canonEntry(3, `{{#if char == "Maukie" || "Pantalone" || "Dottore"}}${fill("D")}${arcSecret}{{/if}}`, {
      origin: "manual",
      title: "Arc One",
    }),
    canonEntry(4, `{{#if char == "Pantalone"}}${fill("E")}{{/if}}`, {
      title: "Combined summary",
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    }),
  ];
  const canonBudget = 1430;
  const canonTrigger = Math.floor(canonBudget * 0.7);
  await chats.patchMetadata(canonChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: canonBudget,
      sceneCheckInterval: 100,
      narratorCharacterId: powers.id,
      knowledgeStarts: { [character.id]: null, [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: canonEntries,
  });
  const canonView = async (id: string) =>
    (
      await memory.prepare({
        chatId: canonChat.id,
        messages: canonSource,
        audienceCharacterIds: [id],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  const narratorBefore = await canonView(powers.id);
  assert(estimateChatSummaryTokens(narratorBefore) > canonTrigger, "the narrator's view starts over the share");
  for (const name of ["A", "B", "C", "D", "E"]) assert(narratorBefore.includes(`FILL_${name}`), name);
  summaryReply = keepSections;
  calls.length = 0;
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 1, "one call combines summaries different characters read");
  const canonAfter = JSON.parse((await chats.getById(canonChat.id))!.metadata).summaryEntries as Array<
    ReturnType<typeof createChatSummaryEntry>
  >;
  assert.equal(canonAfter.filter((entry) => entry.enabled).length, 1);
  assert.deepEqual(
    canonAfter.filter((entry) => !entry.enabled),
    canonEntries.map((entry) => ({ ...entry, enabled: false, updatedAt: canonAfter[1]!.updatedAt })),
    "the originals, including the hand-written ones, stay unchanged as inactive versions",
  );
  const narratorAfter = await canonView(powers.id);
  assert(
    estimateChatSummaryTokens(narratorAfter) <= canonTrigger,
    "one pass brings the narrator's view under the share",
  );
  assert.match(narratorAfter, /^Messages #1–#5;[^\n]*\nSHORT[\s\S]*ARC_SECRET/u);
  assert.match(await canonView(privateA.id), /ARC_SECRET/u);
  for (const id of [character.id, privateB.id]) assert.doesNotMatch(await canonView(id), /ARC_SECRET/u);
  calls.length = 0;
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.deepEqual(calls, [], "the next reply, with no new summaries, calls nothing");

  // Summaries that can't be combined and already fill a view are not shortened again on every reply.
  const unmergeable = [
    canonEntry(0, `${fill("F", 700)}{{char}} remembers.`),
    canonEntry(1, `{{#if char == "Maukie"}}${fill("G")}{{/if}}`),
  ];
  await chats.patchMetadata(canonChat.id, { summaryEntries: unmergeable });
  for (let pass = 0; pass < 2; pass++) await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.deepEqual(calls, [], "no view has room to win back");
  assert.deepEqual(JSON.parse((await chats.getById(canonChat.id))!.metadata).summaryEntries, unmergeable);

  // An answer that adds or drops the narrator in a condition changes no reader, so it is saved.
  const mapSecret = "HIDE_A Maukie hid the map in the cellar.";
  const ledgerSecret = "HIDE_B Pantalone sold the old ledger.";
  const twoReaders = [
    canonEntry(0, `{{#if char == "Maukie" || "Powers That Be"}}${fill("H", 400)}${mapSecret}{{/if}}`),
    canonEntry(1, `{{#if char == "Pantalone"}}${fill("I", 400)}${ledgerSecret}{{/if}}`),
  ];
  summaryReply = () =>
    `{{#if char == "Maukie"}}SHORT ${mapSecret}{{/if}} {{#if char == "Pantalone" || "Powers That Be"}}SHORT ${ledgerSecret}{{/if}}`;
  await chats.patchMetadata(canonChat.id, { summaryEntries: twoReaders });
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  const slipEntries = JSON.parse((await chats.getById(canonChat.id))!.metadata).summaryEntries as Array<{
    enabled: boolean;
  }>;
  assert.equal(slipEntries.filter((entry) => entry.enabled).length, 1, "a narrator slip is not a rejection");
  for (const [id, own, other] of [
    [privateA.id, mapSecret, ledgerSecret],
    [privateB.id, ledgerSecret, mapSecret],
  ]) {
    const view = await canonView(id!);
    assert(view.includes(own!) && !view.includes(other!));
  }
  const narratorSlip = await canonView(powers.id);
  assert(narratorSlip.includes(mapSecret) && narratorSlip.includes(ledgerSecret), "the narrator reads both");
  // One that drops a reader's section is not saved; the halves are tried on their own.
  summaryReply = (prompt) =>
    prompt.includes("HIDE_A") && prompt.includes("HIDE_B")
      ? `{{#if char == "Maukie"}}SHORT ${mapSecret}{{/if}}`
      : `SHORT ${prompt.includes("HIDE_A") ? mapSecret : ledgerSecret}`;
  await chats.patchMetadata(canonChat.id, { summaryEntries: twoReaders });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 3);
  assert.match(JSON.stringify(calls[1]!.messages), /HIDE_A/u);
  assert.doesNotMatch(JSON.stringify(calls[1]!.messages), /HIDE_B/u);
  assert.match(JSON.stringify(calls[2]!.messages), /HIDE_B/u);
  const halvesEntries = JSON.parse((await chats.getById(canonChat.id))!.metadata).summaryEntries as Array<{
    enabled: boolean;
    content: string;
  }>;
  assert.equal(halvesEntries.filter((entry) => entry.enabled && entry.content.includes("SHORT")).length, 2);
  assert.doesNotMatch(await canonView(privateB.id), /HIDE_A/u);
  assert.doesNotMatch(await canonView(privateA.id), /HIDE_B/u);

  // A summary only a character who left the chat reads is never rewritten for the narrator alone, so it is
  // still theirs when they come back; the narrator still reads it.
  const departed = canonEntry(0, `{{#if char == "Cyno"}}${fill("J", 300)}CYNO_SECRET Cyno hid the relic.{{/if}}`);
  summaryReply = keepSections;
  await chats.patchMetadata(canonChat.id, {
    summaryEntries: [departed, canonEntry(1, `{{#if char == "Maukie" || "Pantalone"}}${fill("K", 400)}{{/if}}`)],
  });
  calls.length = 0;
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(calls), /CYNO_SECRET/u, "the departed character's summary is not sent");
  assert.deepEqual(
    JSON.parse((await chats.getById(canonChat.id))!.metadata).summaryEntries.find(
      (entry: { id: string }) => entry.id === departed.id,
    ),
    departed,
    "the departed character's summary stays as it is",
  );
  assert.match(await canonView(powers.id), /CYNO_SECRET/u);

  // A combined answer that drops every condition is retried with the summaries each set of characters reads,
  // which combine on their own, rather than halving down to single summaries.
  await chats.patchMetadata(canonChat.id, {
    summaryEntries: [0, 1, 2, 3].map((index) =>
      canonEntry(index, `{{#if char == "${index % 2 ? "Pantalone" : "Maukie"}"}}${fill(`L${index}`)}{{/if}}`),
    ),
  });
  summaryReply = () => "PLAIN_SHORT.";
  calls.length = 0;
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 3, "one combined call, then one per set of readers");
  const setEntries = JSON.parse((await chats.getById(canonChat.id))!.metadata).summaryEntries as Array<
    ReturnType<typeof createChatSummaryEntry>
  >;
  assert.deepEqual(
    setEntries
      .filter((entry) => entry.enabled)
      .map((entry) => JSON.stringify(entry.messageIds))
      .sort(),
    [
      [canonSource[0]!.id, canonSource[2]!.id],
      [canonSource[1]!.id, canonSource[3]!.id],
    ]
      .map((ids) => JSON.stringify(ids))
      .sort(),
  );
  for (const id of [privateA.id, privateB.id])
    assert.equal((await canonView(id)).split("PLAIN_SHORT").length, 2, "each reads their own once");

  // The target counts text as the views do, without conditions, so an answer of exactly that size brings the
  // narrator under the share in one pass, even when the inputs carry many more conditions than the answer.
  await chats.patchMetadata(canonChat.id, {
    summaryEntries: Array.from({ length: 5 }, (_, index) =>
      canonEntry(index, `{{#if char == "${index % 2 ? "Pantalone" : "Maukie"}"}}${fill(`N${index}`, 125)}{{/if}}`),
    ),
  });
  summaryReply = (prompt) => {
    const target = Math.min(5000, Number(/Aim for approximately (\d+) tokens/u.exec(prompt)?.[1]) || 0);
    let pad = "PAD ";
    const answer = () => `{{#if char == "Maukie"}}${pad}{{/if}}{{#if char == "Pantalone"}}${pad}{{/if}}`;
    while (estimateChatSummaryTokens(answer()) < target) pad += "PAD ";
    return answer();
  };
  calls.length = 0;
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 1);
  await memory.checkScenesAfterGeneration(canonChat.id, { blocking: false });
  assert.equal(calls.length, 1, "the narrator is under the share after the first answer");

  // A summary is combined only once its messages are archived for every character: a combined summary leaves
  // a reader's prompt while any message it covers is live for them, which would hide their older summaries.
  const startsChat = await chats.create({
    name: "Personal starts",
    mode: "roleplay",
    characterIds: [privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(startsChat);
  chatIds.push(startsChat.id);
  for (const [index, startFor] of [[], [], [privateB.id], [], [privateA.id], []].entries())
    await chats.createMessage({
      chatId: startsChat.id,
      role: "user",
      content: `Moment ${index + 1}.`,
      ...(startFor.length ? { extra: { conversationStartForCharacterIds: startFor } } : {}),
    });
  const startsSource = await chats.listMessages(startsChat.id);
  const startsEntry = (id: string, index: number, content: string) =>
    createChatSummaryEntry({
      id,
      origin: "automated",
      sourceMode: "range",
      content,
      enabled: true,
      messageIds: [startsSource[index]!.id],
      rangeStartIndex: index + 1,
      rangeEndIndex: index + 1,
    });
  await chats.patchMetadata(startsChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: canonBudget,
      sceneCheckInterval: 100,
      knowledgeStarts: { [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: [
      startsEntry("pantalone-old", 0, `{{#if char == "Pantalone"}}${fill("P", 700)}PANTALONE_OLD.{{/if}}`),
      startsEntry("maukie-four", 3, `{{#if char == "Maukie"}}${fill("M", 700)}{{/if}}`),
    ],
  });
  const startsView = async (id: string) =>
    (
      await memory.prepare({
        chatId: startsChat.id,
        messages: startsSource,
        audienceCharacterIds: [id],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  assert.match(await startsView(privateB.id), /PANTALONE_OLD/u);
  summaryReply = keepSections;
  calls.length = 0;
  await memory.checkScenesAfterGeneration(startsChat.id, { blocking: false });
  assert.equal(calls.length, 1, "only Pantalone's summary is shortened");
  const startsEntries = JSON.parse((await chats.getById(startsChat.id))!.metadata).summaryEntries as Array<
    ReturnType<typeof createChatSummaryEntry>
  >;
  assert(
    startsEntries.every((entry) => !entry.enabled || (entry.messageIds ?? []).length === 1),
    "message #4 is still live for Pantalone, so Maukie's summary of it is not combined",
  );
  assert.match(await startsView(privateB.id), /PANTALONE_OLD/u, "Pantalone keeps his older summary");

  // A merged chat measures what its shared prompt carries, not the first character's view, and a combined
  // summary is for the characters who read its sources, not for everyone in the chat.
  const mergedCanon = await chats.create({
    name: "Merged canon",
    mode: "roleplay",
    characterIds: [character.id, privateA.id, privateB.id],
    connectionId: connection.id,
  });
  assert(mergedCanon);
  chatIds.push(mergedCanon.id);
  for (const content of ["Scene one.", "Scene two."])
    await chats.createMessage({ chatId: mergedCanon.id, role: "user", content });
  await chats.createMessage({
    chatId: mergedCanon.id,
    role: "user",
    content: "The next scene.",
    extra: { isConversationStart: true },
  });
  const mergedSource = await chats.listMessages(mergedCanon.id);
  await chats.patchMetadata(mergedCanon.id, {
    groupChatMode: "merged",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      summaryBudgetTokens: canonBudget,
      sceneCheckInterval: 100,
      knowledgeStarts: { [character.id]: null, [privateA.id]: null, [privateB.id]: null },
    },
    summaryEntries: mergedSource.slice(0, 2).map((message, index) =>
      createChatSummaryEntry({
        id: `merged-canon-${index}`,
        origin: "automated",
        sourceMode: "range",
        content: `{{#if char == "Maukie" || "Pantalone"}}${fill(`M${index}`, 300)}{{/if}}`,
        enabled: true,
        messageIds: [message.id],
        rangeStartIndex: index + 1,
        rangeEndIndex: index + 1,
      }),
    ),
  });
  const mergedView = async (ids: string[]) =>
    (
      await memory.prepare({
        chatId: mergedCanon.id,
        messages: mergedSource,
        audienceCharacterIds: ids,
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  const everyone = [character.id, privateA.id, privateB.id];
  assert.equal(await mergedView([character.id]), "", "Dottore, the first character, reads none of it");
  assert(estimateChatSummaryTokens(await mergedView(everyone)) > canonTrigger);
  summaryReply = () => "MERGED_PLAIN";
  calls.length = 0;
  await memory.checkScenesAfterGeneration(mergedCanon.id, { blocking: false });
  assert.equal(calls.length, 1, "the shared prompt's constants are over the share");
  assert(estimateChatSummaryTokens(await mergedView(everyone)) <= canonTrigger);
  assert.match(await mergedView(everyone), /\[Known only to (?:Maukie, Pantalone|Pantalone, Maukie): MERGED_PLAIN\]/u);
  assert.equal(await mergedView([character.id]), "", "Dottore still reads nothing");
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
