import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import type { ResolveGenerationToolsArgs } from "../../packages/server/src/services/generation/tool-resolution-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-game-tools-"));
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
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { resolveGenerationTools } =
  await import("../../packages/server/src/services/generation/tool-resolution-runtime.js");
const { planGameToolCalls } = await import("../../packages/server/src/services/generation/game-tool-planning.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { GoogleProvider } = await import("../../packages/server/src/services/llm/providers/google.provider.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
const { GrokSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/grok-subscription.provider.js");

const order: string[] = [];
let expectPlan = true;
let emptyPlan = false;
let rejectPlan = false;
let requestTextRoll = false;
let planStateChange = false;
let stateBaseline: { id: string; chatId: string } | undefined;
const originalPlanner = OpenAIProvider.prototype.chatComplete;
OpenAIProvider.prototype.chatComplete = async (messages, options) => {
  order.push("planner");
  assert.equal(options.model, "cheap-planner");
  assert.equal(options.maxContext, 8192);
  assert.ok((options.maxTokens ?? Infinity) <= 2048);
  assert.equal(options.encryptedReasoningItems, undefined);
  assert.equal(options.onEncryptedReasoning, undefined);
  assert.ok(messages.every((message) => !message.providerMetadata && !message.tool_calls && !message.tool_call_id));
  assert.deepEqual(
    options.tools?.map((tool) => tool.function.name),
    planStateChange ? ["roll_dice", "update_game_state"] : ["roll_dice"],
  );
  assert.match(messages.at(-1)!.content, /one planning request/);
  if (rejectPlan) throw new Error("Planner connection refused the request");
  return {
    content: "PRIVATE PLANNER PROSE",
    toolCalls: emptyPlan
      ? []
      : [
          {
            id: "real-roll",
            type: "function",
            function: { name: "roll_dice", arguments: JSON.stringify({ notation: "2d2" }) },
          },
          ...(planStateChange
            ? [
                {
                  id: "state-write",
                  type: "function" as const,
                  function: {
                    name: "update_game_state",
                    arguments: JSON.stringify({ type: "time_advance", value: "13:00" }),
                  },
                },
              ]
            : []),
          {
            id: "forbidden",
            type: "function",
            function: { name: "web_search", arguments: JSON.stringify({ query: "must never execute" }) },
          },
        ],
    usage: { promptTokens: 7, completionTokens: 3, totalTokens: 10 },
    providerMetadata: { geminiParts: [{ text: "PRIVATE PLANNER SIGNATURE", thoughtSignature: "private" }] },
    finishReason: "tool_calls",
  };
};
async function* narrator(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  order.push("narrator");
  assert.equal(options.tools, undefined);
  assert.doesNotMatch(JSON.stringify(messages), /PRIVATE PLANNER/);
  assert.ok(messages.every((message) => !message.tool_calls && !message.tool_call_id && message.role !== "tool"));
  if (expectPlan && !emptyPlan) {
    const context = messages.map((message) => message.content).join("\n");
    assert.match(context, /"total":[2-4]/);
    assert.match(context, /Tool not allowed in this context: web_search/);
  }
  if (planStateChange) {
    assert.match(messages.at(-1)!.content, /"pending":true/);
    assert.match(messages.at(-1)!.content, /"applied":false/);
    assert.equal((await states.getById(stateBaseline!.id, stateBaseline!.chatId))?.time, "12:00");
  }
  const outcomeRewrite = messages.at(-1)?.content.includes("The engine has now rolled the requested dice:");
  yield requestTextRoll && !outcomeRewrite ? "[dice: d1]" : "The gate opens with the recorded result.";
  return { promptTokens: 11, completionTokens: 5, totalTokens: 16, finishReason: "stop" };
}
const originals = [
  ClaudeSubscriptionProvider.prototype.chat,
  GrokSubscriptionProvider.prototype.chat,
  GoogleProvider.prototype.chat,
];
ClaudeSubscriptionProvider.prototype.chat = narrator;
GrokSubscriptionProvider.prototype.chat = narrator;
GoogleProvider.prototype.chat = narrator;
const db = await getDB();
const chats = createChatsStorage(db);
const states = createGameStateStorage(db);
const connections = createConnectionsStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const planner = await connections.create({
    name: "Planner",
    provider: "openai",
    model: "cheap-planner",
    apiKey: "synthetic",
    maxContext: 8192,
  });
  const plannerWithKey = (await connections.getWithKey(planner.id))!;
  await planGameToolCalls({
    connection: plannerWithKey,
    baseUrl: "https://fixture.invalid/v1",
    messages: [
      {
        role: "assistant",
        content: "Earlier narration",
        providerMetadata: { geminiParts: [{ thoughtSignature: "old-private-signature" }] },
      },
    ],
    tools: [{ type: "function", function: { name: "roll_dice", description: "roll", parameters: {} } }],
    forceToolCall: false,
    signal: new AbortController().signal,
    debugMode: false,
    debugLog: () => {},
  });
  for (const provider of ["claude_subscription", "grok_subscription", "google"] as const) {
    const connection = await connections.create({
      name: "Narrator",
      provider,
      model: "narrator",
      apiKey: "synthetic",
      maxContext: 32768,
    });
    const chat = (await chats.create({
      name: "Tool plan",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    }))!;
    await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, gameGmToolConnectionId: planner.id });
    for (const noCalls of [false, true]) {
      emptyPlan = noCalls;
      expectPlan = true;
      order.length = 0;
      await chats.createMessage({ chatId: chat.id, role: "user", content: "Try the gate." });
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, streaming: true },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      assert.deepEqual(order, ["planner", "narrator"]);
      const saved = (await chats.listMessages(chat.id)).at(-1)!;
      assert.equal(saved.content, "The gate opens with the recorded result.");
      const extra = JSON.parse(saved.extra);
      assert.equal(extra.gameToolPlanning.model, "cheap-planner");
      assert.equal(extra.gameToolPlanning.usage.totalTokens, 10);
      assert.equal(extra.generationInfo.tokensPrompt, 11, "planner usage cannot be charged to the narrator model");
      assert.doesNotMatch(JSON.stringify(extra), /PRIVATE PLANNER|private-signature/);
      if (!noCalls) assert.match(response.body, /"diceRollResult":/);
    }
    if (provider === "claude_subscription") {
      requestTextRoll = true;
      emptyPlan = false;
      order.length = 0;
      const rolled = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
      assert.ok(!rolled.body.includes('"type":"error"'), rolled.body);
      assert.deepEqual(order, ["planner", "narrator", "narrator"]);
      const message = (await chats.listMessages(chat.id)).at(-1)!;
      assert.match(
        message.content,
        /The gate opens with the recorded result/,
        "the outcome rewrite keeps the separate planner's results",
      );
      requestTextRoll = false;
      planStateChange = true;
      stateBaseline = (await states.updateByMessage(
        message.id,
        message.activeSwipeIndex,
        chat.id,
        { time: "12:00" },
        undefined,
        { baseSnapshot: null },
      ))!;
      await chats.patchMetadata(chat.id, { enableTools: true, activeToolIds: ["update_game_state"] });
      const written = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
      assert.ok(!written.body.includes('"type":"error"'), written.body);
      const saved = (await chats.listMessages(chat.id)).at(-1)!;
      assert.equal(
        (await states.getByChatAndMessage(chat.id, saved.id, saved.activeSwipeIndex))?.time,
        "13:00",
        "a separate planner's update is stored on the saved narration",
      );
      assert.equal((await states.getById(stateBaseline.id, chat.id))?.time, "12:00");
      planStateChange = false;
      await chats.patchMetadata(chat.id, { enableTools: false });
    }
    if (provider !== "google") {
      expectPlan = false;
      order.length = 0;
      await chats.patchMetadata(chat.id, { gameGmToolConnectionId: null, enableTools: true });
      const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      assert.deepEqual(order, ["narrator"], "subscriptions bypass the native-tool loop without losing text generation");
    }
    order.length = 0;
    await chats.patchMetadata(chat.id, { gameGmToolConnectionId: "missing-connection" });
    const missing = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.match(missing.body, /selected Game tool connection is unavailable/);
    assert.deepEqual(order, [], "an invalid override fails before either paid call");
    await chats.patchMetadata(chat.id, { gameGmToolConnectionId: planner.id, enableTools: false });
    rejectPlan = true;
    const failed = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.match(failed.body, /Planner connection refused/);
    assert.deepEqual(order, ["planner"], "a failed planner cannot silently turn into narration without tool results");
    rejectPlan = false;
  }

  const book = await lorebooks.create({
    name: "Harbor",
    isGlobal: true,
    scope: { mode: "all" },
    excludeFromVectorization: false,
  });
  const unrelated = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Other",
    content: "A mountain",
    keys: [],
  });
  const relevant = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Elena",
    content: "Harbor master",
    keys: [],
  });
  await lorebooks.updateEntryEmbedding(unrelated.id, [0, 1, 0, 0], "fixture");
  await lorebooks.updateEntryEmbedding(relevant.id, [1, 0, 0, 0], "fixture");
  let embeddedQueries = 0;
  const args = {
    requestBody: {},
    chatId: "semantic-chat",
    chatMetadata: { gameLorebookSearch: true },
    chats,
    agentsStore: {},
    customToolsStore: { listEnabled: async () => [] },
    lorebooksStore: lorebooks,
    resolvedAgents: [],
    enabledConfigs: [],
    promptCharacterIds: [],
    personaId: null,
    activeLorebookIds: [],
    excludedLorebookIds: [],
    excludedSourceAgentIds: [],
    gameState: null,
    gameSpotifyMusicEnabled: false,
    agentContext: { chatMode: "game", characters: [], recentMessages: [], memory: {} },
    emitMetadataPatch: () => {},
    autoAttachToolNames: ["roll_dice"],
    lorebookEmbeddingOptions: {
      embeddingSource: {
        spaceId: "fixture",
        label: "Synthetic query vectors",
        embed: async (texts: string[]) => {
          embeddedQueries++;
          assert.equal(texts[0], "who runs the docks");
          return [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
          ];
        },
      },
    },
  } as unknown as ResolveGenerationToolsArgs;
  const semantic = await resolveGenerationTools(args);
  assert.equal(semantic.enableChatTools, false);
  assert.deepEqual(semantic.toolDefs?.map((tool) => tool.function.name).sort(), ["roll_dice", "search_lorebook"]);
  const found = await semantic.baseToolExecutionContext.searchLorebook!("who runs the docks");
  assert.equal(found[0].name, "Elena", "meaning finds the relevant entry despite no literal query match");
  assert.equal(embeddedQueries, 1);
  const disabled = await resolveGenerationTools({
    ...args,
    chatMetadata: { enableTools: true, gameLorebookSearch: false },
  });
  assert.ok(!disabled.chatResolvedToolNames.has("search_lorebook"));
  const unsupported = await resolveGenerationTools({ ...args, nativeToolsAvailable: false });
  assert.equal(unsupported.toolsAttached, false);
  assert.equal(unsupported.toolDefs, undefined);
  const scoped = await resolveGenerationTools({
    ...args,
    chatMetadata: { gameLorebookSearch: true, entryStateOverrides: { [relevant.id]: { enabled: false } } },
  });
  assert.ok(
    !(await scoped.baseToolExecutionContext.searchLorebook!("who runs the docks")).some(
      (entry: any) => entry.name === "Elena",
    ),
  );
  await lorebooks.clearEntryEmbeddings(book.id);
  const noVectors = await resolveGenerationTools(args);
  await assert.rejects(
    () => noVectors.baseToolExecutionContext.searchLorebook!("who runs the docks"),
    /No vectorized lore entries/,
  );
  assert.equal(embeddedQueries, 2, "no vectors means no embedding request or automatic vectorization");
} finally {
  OpenAIProvider.prototype.chatComplete = originalPlanner;
  [ClaudeSubscriptionProvider.prototype.chat, GrokSubscriptionProvider.prototype.chat, GoogleProvider.prototype.chat] =
    originals;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Game tool planning stays provider-isolated; semantic lore searches honor scope, vectors, and their own toggle.",
);
