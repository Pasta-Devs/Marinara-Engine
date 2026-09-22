import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
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
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { resolveGenerationTools } =
  await import("../../packages/server/src/services/generation/tool-resolution-runtime.js");
const { planGameToolCalls } = await import("../../packages/server/src/services/generation/game-tool-planning.js");
const { capabilityPackageManager } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
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
let expectedPrefill = "";
let singleUser = false;
let continueTurn = false;
let omitFinishReason = false;
let emptyNarrator = false;
let refusedCommand = "";
let nativeDraft = "";
let nativeRollTotal = 0;
const nativeNotation = "2d2";
const originalRandom = Math.random;
let stateBaseline: { id: string; chatId: string } | undefined;
const originalPlanner = OpenAIProvider.prototype.chatComplete;
OpenAIProvider.prototype.chatComplete = async (messages, options) => {
  if (options.model === "native-narrator") {
    order.push("native-main");
    const tool = messages
      .slice()
      .reverse()
      .find((message) => message.role === "tool");
    if (tool) {
      nativeRollTotal = JSON.parse(tool.content).total;
      return { content: nativeDraft, toolCalls: [], finishReason: "stop" };
    }
    return {
      content: null,
      toolCalls: [
        {
          id: "native-roll",
          type: "function",
          function: { name: "roll_dice", arguments: JSON.stringify({ notation: nativeNotation }) },
        },
      ],
      finishReason: "tool_calls",
    };
  }
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
  assert.equal(messages.at(-1)!.role, "user", "the planning instruction stays in the conversation on every provider");
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
  assert.doesNotMatch(
    JSON.stringify(messages),
    /<available_functions>/,
    "a separately planned narrator cannot emit textual tool calls",
  );
  if (expectedPrefill) {
    assert.equal(messages.at(-1)?.role, "assistant");
    assert.equal(
      messages.at(-1)?.content,
      expectedPrefill.trimEnd(),
      "tool results precede the original assistant prefill",
    );
    assert.match(messages.at(-2)!.content, /separate tool-planning pass/);
  }
  if (singleUser) {
    assert.doesNotMatch(JSON.stringify(messages), /\[USER\]\\n\[USER\]/, "provider formatting happens only once");
    assert.equal(messages.filter((message) => message.content.includes("Try the gate.")).length, 1);
  }
  if (continueTurn) {
    assert.doesNotMatch(messages.at(-1)?.content ?? "", /separate tool-planning pass/);
    assert.match(messages.at(-1)?.content ?? "", /continu/i);
  }
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
  if (outcomeRewrite) {
    assert.match(
      messages.at(-1)!.content,
      /2d[12] = [2-4]/,
      "native/planner roll is present even when not echoed by narration",
    );
    assert.match(messages.at(-1)!.content, /d1 = 1/);
    assert.doesNotMatch(messages.at(-1)!.content, /No dice were rolled/);
    if (nativeDraft) assert.match(messages.at(-1)!.content, new RegExp(`${nativeNotation} = ${nativeRollTotal}`));
    if (nativeDraft.includes("Coincidence")) {
      assert.match(messages.at(-1)!.content, /Coincidence/);
      assert.match(messages.at(-1)!.content, /🎲 2d2 = 2/, "distinct rolls with identical values are not deduplicated");
    }
  }
  if (!emptyNarrator)
    yield refusedCommand ||
      (requestTextRoll && !outcomeRewrite ? "[dice: d1]" : "The gate opens with the recorded result.");
  return {
    promptTokens: 11,
    completionTokens: 5,
    totalTokens: 16,
    cachedPromptTokens: 7,
    cacheWritePromptTokens: 2,
    completionReasoningTokens: 2,
    completionAudioTokens: 1,
    acceptedPredictionTokens: 1,
    rejectedPredictionTokens: 1,
    ...(omitFinishReason ? {} : { finishReason: "stop" }),
  };
}
const originals = [
  ClaudeSubscriptionProvider.prototype.chat,
  GrokSubscriptionProvider.prototype.chat,
  GoogleProvider.prototype.chat,
  OpenAIProvider.prototype.chat,
];
ClaudeSubscriptionProvider.prototype.chat = narrator;
GrokSubscriptionProvider.prototype.chat = narrator;
GoogleProvider.prototype.chat = narrator;
OpenAIProvider.prototype.chat = narrator;
const originalVerbSource = capabilityPackageManager.gmVerbTableSource;
capabilityPackageManager.gmVerbTableSource = async (id) =>
  id === "pixelforge"
    ? Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          verbs: [
            {
              name: "weather",
              description: "Change weather",
              effect: "state",
              metadataKey: "pixelforgeWeather",
              args: [{ name: "word", type: "string", enum: ["fair", "rain"] }],
            },
          ],
        }),
      )
    : originalVerbSource.call(capabilityPackageManager, id);
const db = await getDB();
const chats = createChatsStorage(db);
const states = createGameStateStorage(db);
const connections = createConnectionsStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
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
  let wireFamily: "anthropic" | "google" = "anthropic";
  let outbound: Record<string, any> | undefined;
  const wireServer = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    outbound = JSON.parse(raw);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify(
        wireFamily === "anthropic"
          ? {
              content: [{ type: "text", text: "No tool is needed." }],
              stop_reason: "end_turn",
              usage: { input_tokens: 2, output_tokens: 2 },
            }
          : {
              candidates: [{ content: { parts: [{ text: "No tool is needed." }] }, finishReason: "STOP" }],
              usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2, totalTokenCount: 4 },
            },
      ),
    );
  });
  wireServer.listen(0, "127.0.0.1");
  await once(wireServer, "listening");
  try {
    const address = wireServer.address();
    assert.ok(address && typeof address === "object");
    for (const family of ["anthropic", "google"] as const) {
      wireFamily = family;
      await planGameToolCalls({
        connection: {
          ...plannerWithKey,
          provider: family,
          model: family === "anthropic" ? "claude-sonnet-4-6" : "gemini-2.0-flash",
          defaultParameters: JSON.stringify({ temperature: 0.23, maxTokens: 3072 }),
        },
        baseUrl: `http://127.0.0.1:${address.port}`,
        messages: [
          { role: "system", content: "Narrator: output only scene prose." },
          { role: "user", content: "Try the gate." },
        ],
        tools: [
          {
            type: "function",
            function: { name: "roll_dice", description: "roll", parameters: { type: "object", properties: {} } },
          },
        ],
        forceToolCall: false,
        signal: new AbortController().signal,
        debugMode: false,
        debugLog: () => {},
      });
      assert.ok(outbound);
      assert.equal(family === "anthropic" ? outbound.temperature : outbound.generationConfig?.temperature, 0.23);
      assert.equal(family === "anthropic" ? outbound.max_tokens : outbound.generationConfig?.maxOutputTokens, 3072);
      assert.doesNotMatch(JSON.stringify(outbound.system ?? outbound.systemInstruction), /planning tools/);
      const conversation = outbound.messages ?? outbound.contents;
      assert.equal(conversation.at(-1).role, "user");
      assert.match(
        JSON.stringify(conversation.at(-1)),
        /one planning request/,
        `${family} wire payload keeps the instruction after player input`,
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) => wireServer.close((error) => (error ? reject(error) : resolve())));
  }
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
      assert.equal(extra.generationInfo.requestCount, 1, "the separate planner is not a narrator request");
      assert.equal(extra.generationInfo.tokensContext, provider === "claude_subscription" ? 25 : 16);
      const peekResponse = await app.inject({
        method: "POST",
        url: `/api/chats/${chat.id}/peek-prompt`,
        payload: { messageId: saved.id },
      });
      assert.equal(peekResponse.statusCode, 200, peekResponse.body);
      const peek = peekResponse.json();
      assert.equal(peek.gameToolPlanning.model, "cheap-planner");
      assert.equal(peek.gameToolPlanning.provider, "openai");
      assert.deepEqual(peek.gameToolPlanning.usage, { promptTokens: 7, completionTokens: 3 });
      assert.equal(peek.generationInfo.tokensPrompt, 11, "Peek keeps planner cost separate from the narrator");
      assert.doesNotMatch(JSON.stringify(extra), /PRIVATE PLANNER|private-signature/);
      if (!noCalls) assert.match(response.body, /"diceRollResult":/);
    }
    if (provider === "claude_subscription") {
      requestTextRoll = true;
      emptyPlan = false;
      order.length = 0;
      const rolled = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
      assert.ok(!rolled.body.includes('"type":"error"'), rolled.body);
      const outcomeUsage = JSON.parse((await chats.listMessages(chat.id)).at(-1)!.extra).generationInfo;
      assert.equal(outcomeUsage.requestCount, 2);
      assert.equal(outcomeUsage.tokensContext, 25, "dice follow-up context is one Claude request, including caches");
      assert.equal(outcomeUsage.tokensPrompt, 22);
      assert.equal(outcomeUsage.tokensReasoning, 4);
      assert.equal(outcomeUsage.tokensCompletionAudio, 2);
      assert.equal(outcomeUsage.tokensAcceptedPrediction, 2);
      assert.equal(outcomeUsage.tokensRejectedPrediction, 2);
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

  const dedicatedNarrator = await connections.create({
    name: "Local narrator",
    provider: "claude_subscription",
    model: "narrator",
    apiKey: "synthetic",
    maxContext: 32768,
    treatAsLocalEndpoint: true,
  });
  for (const variant of ["prefill", "single", "no-finish", "empty", "continue"] as const) {
    const chat = (await chats.create({
      name: variant,
      mode: "game",
      characterIds: [],
      connectionId: dedicatedNarrator.id,
      promptPresetId: null,
    }))!;
    expectedPrefill = variant === "prefill" ? "The gate: " : "";
    singleUser = variant === "single";
    continueTurn = variant === "continue";
    omitFinishReason = variant === "no-finish" || variant === "empty";
    emptyNarrator = variant === "empty";
    expectPlan = !continueTurn;
    emptyPlan = false;
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      gameGmToolConnectionId: planner.id,
      chatParameters: { assistantPrefill: expectedPrefill, singleUserMessage: singleUser },
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Try the gate." });
    const continuation = continueTurn
      ? await chats.createMessage({
          chatId: chat.id,
          role: "assistant",
          content: "The previous result is already known. ",
        })
      : null;
    order.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...(continuation ? { continueMessageId: continuation.id } : {}) },
    });
    assert.deepEqual(order, continueTurn ? ["narrator"] : ["planner", "narrator"], response.body);
    if (emptyNarrator) {
      assert.match(response.body, /AI returned an empty response/);
      assert.doesNotMatch(response.body, /finish reason/);
    } else {
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      const saved = (await chats.listMessages(chat.id)).at(-1)!;
      if (omitFinishReason)
        assert.equal(
          JSON.parse(saved.extra).generationInfo.finishReason,
          null,
          "a narrator without a finish reason cannot inherit tool_calls",
        );
      if (continueTurn) assert.equal(saved.id, continuation!.id);
    }
  }
  expectedPrefill = "";
  singleUser = false;
  continueTurn = false;
  omitFinishReason = false;
  emptyNarrator = false;
  expectPlan = false;

  // Actual native tool loop followed by a text roll: both real outcomes reach
  // the rewrite, while a native roll plus unsupported-only text needs no rewrite.
  const nativeConnection = await connections.create({
    name: "Native narrator",
    provider: "openai",
    model: "native-narrator",
    apiKey: "synthetic",
    maxContext: 32768,
  });
  for (nativeDraft of [
    "The attack is resolved. [dice: d1]",
    "The attack is resolved. [dice: 4d6kh3]",
    'The attack is resolved. [skill_check: skill="Coincidence" dc="2" dice="2d2"] [dice: d1]',
  ]) {
    Math.random = nativeDraft.includes("Coincidence") ? () => 0 : originalRandom;
    const chat = (await chats.create({
      name: "Native and text rolls",
      mode: "game",
      characterIds: [],
      connectionId: nativeConnection.id,
      promptPresetId: null,
    }))!;
    await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Attack and roll damage." });
    order.length = 0;
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    assert.deepEqual(
      order,
      nativeDraft.includes("kh3") ? ["native-main", "native-main"] : ["native-main", "native-main", "narrator"],
    );
    const extra = JSON.parse((await chats.listMessages(chat.id)).at(-1)!.extra);
    assert.equal(extra.diceRollResults[0].total, nativeRollTotal);
    assert.equal(extra.diceRollResults.length, nativeDraft.includes("kh3") ? 1 : 2);
    assert.equal(
      extra.gameOutcomeNarrationFailed,
      false,
      "provider assertions must not be swallowed by rewrite recovery",
    );
  }
  Math.random = originalRandom;
  nativeDraft = "";

  const refusalChat = (await chats.create({
    name: "Refused commands",
    mode: "game",
    characterIds: [],
    connectionId: dedicatedNarrator.id,
    promptPresetId: null,
  }))!;
  // Use a normal text-only connection; the package table is the only boundary stub.
  await connections.update(dedicatedNarrator.id, { treatAsLocalEndpoint: false });
  await chats.patchMetadata(refusalChat.id, {
    enableAgents: false,
    enableTools: false,
    gameExperienceId: "pixelforge",
  });
  await chats.createMessage({ chatId: refusalChat.id, role: "user", content: "Change the weather." });
  for (refusedCommand of ['[weather:{"word":"bogus"}]', "[weather:{}]"]) {
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: refusalChat.id } });
    assert.match(response.body, /Game command .*weather.* was refused/);
    assert.match(
      response.body,
      refusedCommand.includes("bogus") ? /not one of fair\|rain/ : /missing required argument/,
    );
    assert.doesNotMatch(response.body, /AI returned an empty response/);
    assert.equal((await chats.listMessages(refusalChat.id)).length, 1);
    assert.equal(JSON.parse((await chats.getById(refusalChat.id))!.metadata).pixelforgeWeather, undefined);
  }
  refusedCommand = "";

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
  await lorebooks.updateEntryEmbedding(unrelated.id, [0.214, Math.sqrt(1 - 0.214 ** 2), 0, 0], "fixture");
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
          assert.ok(["who runs the docks", "subatomic particle beam"].includes(texts[0]!));
          return [
            texts[0] === "subatomic particle beam" ? [0, 0, 0, 1] : [1, 0, 0, 0],
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
  assert.equal(found.length, 1, "Calibrated zero-score entries are not reported as semantic matches");
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
  const missingVector = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Smuggler tunnels",
    content: "who runs the docks at night",
  });
  const noVector = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Secret ledger",
    content: "who runs the docks",
    excludeFromVectorization: true,
  });
  const staleVector = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Docks ledger",
    keys: ["who runs the docks"],
    content: "Exact key with an incompatible vector",
  });
  await lorebooks.updateEntryEmbedding(staleVector.id, [0, 1, 0, 0], "old-model");
  await lorebooks.updateEntry(relevant.id, { keys: ["who runs the docks"] });
  await lorebooks.updateEntryEmbedding(relevant.id, [1, 0, 0, 0], "fixture");
  const globallyDisabled = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Globally disabled",
    content: "who runs the docks",
    enabled: false,
  });
  const outsideBook = await lorebooks.create({ name: "Unattached lore" });
  await lorebooks.createEntry({ lorebookId: outsideBook.id, name: "Outside this chat", content: "who runs the docks" });
  const mixed = await semantic.baseToolExecutionContext.searchLorebook!("who runs the docks");
  assert.deepEqual(
    new Set(mixed.map((row: any) => row.name)),
    new Set(["Elena", "Smuggler tunnels", "Secret ledger", "Docks ledger"]),
  );
  assert.equal(mixed.length, 4, "Literal and semantic matches are combined without duplicates");
  const mixedScoped = await resolveGenerationTools({
    ...args,
    chatMetadata: {
      gameLorebookSearch: true,
      entryStateOverrides: {
        [missingVector.id]: { enabled: false },
        [noVector.id]: { enabled: false },
        [globallyDisabled.id]: { enabled: true },
      },
    },
  });
  assert.deepEqual(
    new Set(
      (await mixedScoped.baseToolExecutionContext.searchLorebook!("who runs the docks")).map((row: any) => row.name),
    ),
    new Set(["Elena", "Docks ledger"]),
  );
  assert.deepEqual(
    await semantic.baseToolExecutionContext.searchLorebook!("subatomic particle beam"),
    [],
    "An unrelated query produces no results",
  );
  assert.deepEqual(
    await semantic.baseToolExecutionContext.searchLorebook!("   "),
    [],
    "Empty queries do not enumerate entries",
  );
  await lorebooks.clearEntryEmbeddings(book.id);
  const queriesBeforeMissingVectors = embeddedQueries;
  const noVectors = await resolveGenerationTools(args);
  await assert.rejects(
    () => noVectors.baseToolExecutionContext.searchLorebook!("who runs the docks"),
    /No vectorized lore entries/,
  );
  assert.equal(
    embeddedQueries,
    queriesBeforeMissingVectors,
    "no vectors means no embedding request or automatic vectorization",
  );
  const textOnly = await resolveGenerationTools({
    ...args,
    agentContext: { ...args.agentContext, chatMode: "roleplay" },
  });
  assert.deepEqual(
    new Set(
      (await textOnly.baseToolExecutionContext.searchLorebook!("who runs the docks")).map((row: any) => row.name),
    ),
    new Set(["Elena", "Smuggler tunnels", "Secret ledger", "Docks ledger"]),
  );
} finally {
  Math.random = originalRandom;
  OpenAIProvider.prototype.chatComplete = originalPlanner;
  [
    ClaudeSubscriptionProvider.prototype.chat,
    GrokSubscriptionProvider.prototype.chat,
    GoogleProvider.prototype.chat,
    OpenAIProvider.prototype.chat,
  ] = originals;
  capabilityPackageManager.gmVerbTableSource = originalVerbSource;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Game tool planning stays provider-isolated; semantic lore searches honor scope, vectors, and their own toggle.",
);
