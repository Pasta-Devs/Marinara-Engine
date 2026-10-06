import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Agent and package calls send the generation parameters saved on their connection, resolved like the main chat's
// (#7131). Every provider points at a local stub that records the exact request bodies and headers.
const dir = mkdtempSync(join(tmpdir(), "marinara-agent-params-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.CODEX_HOME = dir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
writeFileSync(
  join(dir, "auth.json"),
  JSON.stringify({
    auth_mode: "chatgpt",
    last_refresh: new Date().toISOString(),
    tokens: { access_token: `test.${Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString("base64url")}.sig` },
  }),
);

type Captured = { path: string; headers: Record<string, string | string[] | undefined>; body: Record<string, any> };
const requests: Captured[] = [];
let reply = '{"weather":"rain"}';
/** Replies for requests whose prompt carries a marker, checked before `reply`. */
const markerReplies = new Map<string, string>();
/** Scripted Claude turns (content blocks), one per /messages request while any are queued. */
let anthropicTurns: Array<Array<Record<string, unknown>>> = [];

const sse = (events: unknown[]) => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
const anthropicSse = (blocks: Array<Record<string, unknown>>) =>
  [
    { type: "message_start", message: { usage: { input_tokens: 1 } } },
    ...blocks.flatMap((block, index) => {
      const start =
        block.type === "thinking"
          ? { type: "thinking", thinking: "" }
          : block.type === "tool_use"
            ? { type: "tool_use", id: block.id, name: block.name, input: {} }
            : { type: "text", text: "" };
      const delta =
        block.type === "thinking"
          ? [
              { type: "thinking_delta", thinking: block.thinking },
              { type: "signature_delta", signature: block.signature },
            ]
          : block.type === "tool_use"
            ? [{ type: "input_json_delta", partial_json: JSON.stringify(block.input) }]
            : [{ type: "text_delta", text: block.text }];
      return [
        { type: "content_block_start", index, content_block: start },
        ...delta.map((entry) => ({ type: "content_block_delta", index, delta: entry })),
        { type: "content_block_stop", index },
      ];
    }),
    {
      type: "message_delta",
      delta: { stop_reason: blocks.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn" },
      usage: { output_tokens: 1 },
    },
    { type: "message_stop" },
  ]
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const path = request.url ?? "";
  requests.push({ path, headers: request.headers, body });
  const prompt = JSON.stringify(body);
  const content = [...markerReplies].find(([marker]) => prompt.includes(marker))?.[1] ?? reply;
  const streaming = body.stream === true || path.includes("alt=sse") || path.endsWith("/responses");
  response.writeHead(200, { "content-type": streaming ? "text/event-stream" : "application/json" });
  const scriptedTurn = path.endsWith("/messages") ? anthropicTurns.shift() : undefined;
  if (scriptedTurn) {
    response.end(
      streaming
        ? anthropicSse(scriptedTurn)
        : JSON.stringify({
            id: "msg",
            type: "message",
            role: "assistant",
            content: scriptedTurn,
            stop_reason: scriptedTurn.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
    );
  } else if (path.endsWith("/messages")) {
    response.end(
      streaming
        ? [
            `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } })}\n\n`,
            `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`,
            `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: content } })}\n\n`,
            `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
            `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } })}\n\n`,
            `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
          ].join("")
        : JSON.stringify({
            id: "msg",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: content }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
    );
  } else if (path.includes("generateContent")) {
    const candidate = {
      candidates: [{ content: { role: "model", parts: [{ text: content }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    };
    response.end(streaming ? sse([candidate]) : JSON.stringify(candidate));
  } else if (path.endsWith("/responses")) {
    response.end(
      sse([
        { type: "response.output_text.delta", delta: content },
        { type: "response.completed", response: { status: "completed", output: [] } },
      ]),
    );
  } else {
    response.end(
      streaming
        ? `${sse([
            { choices: [{ index: 0, delta: { content }, finish_reason: null }] },
            { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
          ])}data: [DONE]\n\n`
        : JSON.stringify({
            choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
    );
  }
});

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createCapabilityLanguageModelHost } =
  await import("../../packages/server/src/services/capability-packages/capability-language-model.service.js");
const { executeAgent, executeAgentBatch } = await import("../../packages/server/src/services/agents/agent-executor.js");
const { resolveAgentPipelineAgents } =
  await import("../../packages/server/src/services/generation/agent-resolution.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { ConnectionFallbackProvider } =
  await import("../../packages/server/src/services/llm/connection-fallback-provider.js");
const { writeManualIllustratorPromptPlan } =
  await import("../../packages/server/src/services/generation/illustrator-manual-prompt-generation.js");
const retryRoute = await import("../../packages/server/src/routes/generate/retry-agents-route.js");
const { CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY } = await import("../../packages/shared/dist/index.js");
type AgentContext = import("../../packages/shared/src/types/agent.js").AgentContext;
type ResolvedAgent = import("../../packages/server/src/services/agents/agent-pipeline.js").ResolvedAgent;
type PipelineArgs = Parameters<typeof resolveAgentPipelineAgents>[0];

/** A window where the Illustrator writer's prompt plus its own 1000 tokens fit, but not 3000 with thinking room. */
const SMALL_CONTEXT = 2_600;
const managedParameterDefinitions = [{ id: "top-a", name: "Top A", requestKey: "top_a", min: 0, max: 1 }];
const ALL_SWITCHES_ON = {
  temperature: true,
  maxTokens: true,
  topP: true,
  topK: true,
  frequencyPenalty: true,
  presencePenalty: true,
  reasoningEffort: true,
  verbosity: true,
};
/** A connection with "Use custom defaults" on and every sampler deliberately tuned. */
const tuned = (overrides: Record<string, unknown> = {}) => ({
  temperature: 0.3,
  topP: 0.8,
  topK: 40,
  minP: 0.05,
  frequencyPenalty: 0.4,
  presencePenalty: 0.2,
  reasoningEffort: "high",
  verbosity: "low",
  maxTokens: 8192,
  stopSequences: ["\n\nUser:"],
  assistantPrefill: "Sure",
  customParameters: { fixture_param: "yes" },
  customHeaders: { "X-Fixture": "agent" },
  managedCustomParameters: { "top-a": { enabled: true, value: 0.25 } },
  enabledParameters: ALL_SWITCHES_ON,
  ...overrides,
});
const withoutReasoning = (overrides: Record<string, unknown> = {}) => {
  const { reasoningEffort: _unset, ...rest } = tuned(overrides);
  return rest;
};

const context: AgentContext = {
  chatId: "agent-connection-parameters",
  chatMode: "roleplay",
  recentMessages: [],
  characters: [],
  persona: null,
  memory: {},
  writableLorebookIds: null,
  chatSummary: null,
  streaming: false,
};

const agentConfig = (type: string, resultType: string, connectionId: string | null = "agent-connection") => ({
  id: type,
  type,
  name: type,
  phase: "post_processing",
  promptTemplate: `${type} AGENT_FIXTURE prompt`,
  connectionId,
  settings: { resultType, contextSize: 2, maxTokens: 1000 },
  enabled: "true",
});

let base = "";
const resolveAgents = async (args: {
  provider: string;
  model: string;
  defaultParameters: unknown;
  agents: Array<ReturnType<typeof agentConfig>>;
  chat?: Partial<PipelineArgs>;
  maxContext?: number;
}) => {
  const connection = {
    id: "agent-connection",
    name: `${args.provider} fixture`,
    provider: args.provider,
    baseUrl: args.provider === "google" ? `${base}/v1beta` : `${base}/v1`,
    apiKey: "fixture-key",
    model: args.model,
    maxContext: args.maxContext ?? 200_000,
    defaultParameters: JSON.stringify(args.defaultParameters),
    maxParallelJobs: 1,
  };
  const { resolvedAgents } = await resolveAgentPipelineAgents({
    connections: {
      getDefaultForAgents: async () => null,
      getFallbackForAgents: async () => null,
      getWithKey: async (id: string) => (id === connection.id ? connection : null),
    },
    configuredAgents: args.agents,
    chatId: "agent-connection-parameters",
    chatEnableAgents: true,
    hasPerChatAgentList: false,
    perChatAgentSet: new Set<string>(),
    agentPromptTemplateSelections: {},
    chatProvider: new OpenAIProvider(`${base}/v1`, "chat-key"),
    chatConnectionId: "chat-connection",
    chatModel: "chat-model",
    chatCustomParameters: {},
    chatSuppressModelParameters: false,
    chatMaxOutputTokens: null,
    chatMaxParallelJobs: 1,
    chatEnableCaching: false,
    chatAnthropicExtendedCacheTtl: false,
    chatCachingAtDepth: 5,
    managedParameterDefinitions,
    resolveBaseUrl: (conn) => conn.baseUrl ?? "",
    ...args.chat,
  } as PipelineArgs);
  return resolvedAgents;
};
const run = async (agent: ResolvedAgent) => {
  const before = requests.length;
  const result = await executeAgent(agent, context, agent.provider, agent.model);
  assert.equal(result.success, true, `${agent.type} should succeed: ${result.error}`);
  assert.equal(requests.length, before + 1, `${agent.type} makes one request`);
  return { ...requests.at(-1)!, result };
};
const noopTools = {
  tools: [
    {
      type: "function" as const,
      function: { name: "lookup", description: "Look up a fact.", parameters: { type: "object", properties: {} } },
    },
  ],
  executeToolCall: async () => "fact",
};
/** Every request since `before`, checked for the tuned connection's samplers. */
const assertTunedSamplers = (before: number, label: string) => {
  const sent = requests.slice(before);
  assert.ok(sent.length > 0, `${label} made a request`);
  for (const { body } of sent) {
    assert.equal(body.top_p, 0.8, `${label}: Top P`);
    assert.equal(body.top_a, 0.25, `${label}: managed custom parameter (Top A)`);
    assert.equal(body.fixture_param, "yes", `${label}: connection custom parameter`);
  }
  return sent.map(({ body }) => body);
};

let db: Awaited<ReturnType<typeof getDB>> | null = null;
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  // ── OpenAI-compatible (custom endpoint): JSON and text agents send the tuned connection ─────────────────────────
  {
    const [jsonAgent, textAgent] = await resolveAgents({
      provider: "custom",
      model: "fixture-model",
      defaultParameters: tuned(),
      agents: [agentConfig("json-fixture", "game_state_update"), agentConfig("text-fixture", "context_injection")],
    });
    // A local model given a level may answer with its thinking inline; text agents keep only the answer.
    markerReplies.set("text-fixture AGENT_FIXTURE", "<think>plan</think>Context note.");
    for (const agent of [jsonAgent!, textAgent!]) {
      const { body, headers, result } = await run(agent);
      if (agent === textAgent) {
        assert.deepEqual(result.data, { text: "Context note." }, "text agents strip a leading <think> block");
      }
      assert.equal(body.temperature, 0.3, `${agent.type}: connection temperature`);
      assert.equal(body.top_p, 0.8, `${agent.type}: Top P`);
      assert.equal(body.top_k, 40, `${agent.type}: Top K`);
      assert.equal(body.min_p, 0.05, `${agent.type}: Min P`);
      assert.equal(body.frequency_penalty, 0.4, `${agent.type}: frequency penalty`);
      assert.equal(body.presence_penalty, 0.2, `${agent.type}: presence penalty`);
      assert.equal(body.top_a, 0.25, `${agent.type}: managed custom parameter (Top A)`);
      assert.equal(body.fixture_param, "yes", `${agent.type}: connection custom parameter`);
      assert.equal(headers["x-fixture"], "agent", `${agent.type}: connection custom header`);
      // A generic endpoint only takes a level for models it knows reason, exactly like the main chat. What matters
      // here is that the JSON agent no longer forces "none" over the level the user chose.
      assert.equal("reasoning_effort" in body, false, `${agent.type}: no forced none over the user's level`);
      assert.equal(body.max_tokens, 1000 + 2000, `${agent.type}: its own 1000 tokens plus thinking room`);
      assert.equal("stop" in body, false, `${agent.type}: roleplay stop sequences never reach agents`);
    }
    markerReplies.clear();
  }

  // ── OpenAI reasoning model: the level is sent and the completion budget leaves room for it ─────────────────────
  {
    const [jsonAgent, textAgent] = await resolveAgents({
      provider: "openai",
      model: "o4-mini",
      defaultParameters: tuned(),
      agents: [agentConfig("openai-json", "game_state_update"), agentConfig("openai-text", "context_injection")],
    });
    for (const agent of [jsonAgent!, textAgent!]) {
      const { body } = await run(agent);
      assert.equal(body.reasoning_effort, "high", `${agent.type}: the user's reasoning level wins`);
      assert.equal(body.max_completion_tokens, 3000, `${agent.type}: reasoning counts inside the completion budget`);
    }
  }

  // ── Default/unset reasoning keeps today's behaviour: JSON agents ask for none, text agents send nothing ─────────
  {
    const [jsonAgent, textAgent] = await resolveAgents({
      provider: "custom",
      model: "fixture-model",
      defaultParameters: withoutReasoning(),
      agents: [agentConfig("json-unset", "game_state_update"), agentConfig("text-unset", "context_injection")],
    });
    const jsonBody = (await run(jsonAgent!)).body;
    assert.equal(jsonBody.reasoning_effort, "none", "JSON agents still turn reasoning off when no level is saved");
    assert.equal(jsonBody.max_tokens, 1000, "no thinking room without a level");
    assert.equal(jsonBody.top_p, 0.8, "the other saved samplers still apply");
    const textBody = (await run(textAgent!)).body;
    assert.equal("reasoning_effort" in textBody, false, "text agents leave reasoning to the provider when unset");
    assert.equal(textBody.max_tokens, 1000);
  }

  // ── Send switches off: nothing behind a switched-off parameter is sent ───────────────────────────────────────────
  {
    const [jsonAgent] = await resolveAgents({
      provider: "custom",
      model: "fixture-model",
      defaultParameters: tuned({
        enabledParameters: {
          temperature: false,
          maxTokens: true,
          topP: false,
          topK: false,
          frequencyPenalty: false,
          presencePenalty: false,
          reasoningEffort: false,
          verbosity: false,
        },
      }),
      agents: [agentConfig("json-switches-off", "game_state_update")],
    });
    const { body } = await run(jsonAgent!);
    for (const field of [
      "temperature",
      "top_p",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "reasoning_effort",
    ]) {
      assert.equal(field in body, false, `switched-off ${field} is not sent`);
    }
    assert.equal(body.max_tokens, 1000, "no thinking room when reasoning is switched off");
  }

  // ── OpenRouter: unified reasoning object, Top K never sent ──────────────────────────────────────────────────────
  {
    const [agent] = await resolveAgents({
      provider: "openrouter",
      model: "deepseek/deepseek-r1",
      defaultParameters: tuned({ serviceTier: "flex" }),
      agents: [agentConfig("openrouter-json", "game_state_update")],
    });
    const { body } = await run(agent!);
    assert.deepEqual(body.reasoning?.effort, "high", "OpenRouter gets the user's level");
    assert.equal(body.top_p, 0.8);
    assert.equal(body.frequency_penalty, 0.4);
    assert.equal("top_k" in body, false, "OpenRouter never takes Top K");
    // The provider only sends a tier to openrouter.ai itself, which a local stub cannot be.
    assert.equal(agent!.generation?.serviceTier, "flex", "the saved OpenRouter service tier reaches the agent call");
    assert.equal(body.max_tokens ?? body.max_completion_tokens, 3000, "thinking room on top of the agent's budget");
  }

  // ── Anthropic: thinking turns on with a valid budget below max_tokens; sampling that thinking rejects is dropped ─
  {
    const [legacy] = await resolveAgents({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      defaultParameters: tuned(),
      agents: [agentConfig("anthropic-legacy", "game_state_update")],
    });
    const { body } = await run(legacy!);
    assert.equal(body.thinking?.type, "enabled", "the saved level turns Claude thinking on");
    assert.ok(body.thinking.budget_tokens >= 1024 && body.thinking.budget_tokens < body.max_tokens);
    assert.equal(body.max_tokens, 1000 + body.thinking.budget_tokens, "the answer keeps its own 1000 tokens");
    assert.equal("temperature" in body, false, "thinking rejects temperature");
    assert.equal("top_k" in body, false, "thinking rejects top_k");

    const [adaptive] = await resolveAgents({
      provider: "anthropic",
      model: "claude-opus-4-6",
      defaultParameters: tuned(),
      agents: [agentConfig("anthropic-adaptive", "game_state_update")],
    });
    const adaptiveBody = (await run(adaptive!)).body;
    assert.equal(adaptiveBody.thinking?.type, "adaptive");
    assert.equal(adaptiveBody.output_config?.effort, "high");
    assert.equal(adaptiveBody.max_tokens, 1000 + 2000, "adaptive headroom is added once, by the provider");

    const [unset] = await resolveAgents({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      defaultParameters: withoutReasoning(),
      agents: [agentConfig("anthropic-unset", "game_state_update")],
    });
    const unsetBody = (await run(unset!)).body;
    assert.equal("thinking" in unsetBody, false, "no thinking without a saved level");
    assert.equal(unsetBody.top_k, 40, "Top K still applies when Claude is not thinking");
    assert.equal(unsetBody.max_tokens, 1000);
  }

  // ── Claude manual thinking stays within the model's output limit; the budget gives way first ──────────────────
  {
    const types = ["opus-a", "opus-b", "opus-c", "opus-d"];
    const batch = await resolveAgents({
      provider: "anthropic",
      model: "claude-opus-4-1",
      defaultParameters: tuned(),
      agents: types.map((type) => ({
        ...agentConfig(type, "game_state_update"),
        settings: { resultType: "game_state_update", contextSize: 2, maxTokens: 4096 },
      })),
    });
    reply = JSON.stringify(Object.fromEntries(types.map((type) => [type, { weather: "rain" }])));
    const before = requests.length;
    await executeAgentBatch(batch, context, batch[0]!.provider, batch[0]!.model);
    const { body } = requests[before]!;
    assert.equal(body.max_tokens, 32_000, "four 4096-token agents plus thinking stay within Opus 4.1's 32000 limit");
    assert.equal(body.thinking?.budget_tokens, 32_000 - 4 * 4096, "thinking gives way so every answer keeps its room");
    reply = '{"weather":"rain"}';

    // Below the limit nothing changes: Claude Sonnet 4 takes 64000 output tokens, so a 16000-token agent keeps its
    // full 16000-token thinking budget.
    const [sonnet] = await resolveAgents({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      defaultParameters: tuned(),
      agents: [
        {
          ...agentConfig("sonnet-large", "context_injection"),
          settings: { resultType: "context_injection", maxTokens: 16_000 },
        },
      ],
    });
    const sonnetBody = (await run(sonnet!)).body;
    assert.equal(sonnetBody.max_tokens, 32_000);
    assert.equal(sonnetBody.thinking?.budget_tokens, 16_000);
  }

  // ── Claude tool rounds send the thinking blocks back, so the next round may keep thinking ──────────────────────
  {
    const [toolAgent] = await resolveAgents({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      defaultParameters: tuned(),
      agents: [agentConfig("anthropic-tools", "context_injection")],
    });
    const thinking = { type: "thinking", thinking: "plan", signature: "sig-abc" };
    anthropicTurns = [
      [thinking, { type: "tool_use", id: "call-1", name: "lookup", input: {} }],
      [{ type: "text", text: "Context note." }],
    ];
    const before = requests.length;
    const result = await executeAgent(toolAgent!, context, toolAgent!.provider, toolAgent!.model, noopTools);
    assert.equal(result.success, true, `tool agent: ${result.error}`);
    const second = requests[before + 1]?.body;
    assert.equal(second?.thinking?.type, "enabled", "round two still thinks");
    const assistant = second.messages.find((message: { role: string }) => message.role === "assistant");
    assert.deepEqual(assistant.content[0], thinking, "round two starts with the signed thinking block");
    assert.equal(assistant.content[1]?.type, "tool_use");

    // Streamed tool rounds (the main chat's) keep the signed block too.
    anthropicTurns = [[thinking, { type: "tool_use", id: "call-2", name: "lookup", input: {} }]];
    const streamed = await toolAgent!.provider.chatComplete([{ role: "user", content: "stream" }], {
      model: toolAgent!.model,
      maxTokens: 1000,
      tools: noopTools.tools,
      enableThinking: true,
      reasoningEffort: "high",
      stream: true,
      onToken: () => {},
    });
    assert.equal(requests.at(-1)!.body.stream, true, "the round streamed");
    assert.deepEqual(streamed.providerMetadata?.anthropicThinking, [thinking], "a streamed round returns its thinking");
    anthropicTurns = [];
  }

  // ── Gemini 3: thinking level plus room for it inside maxOutputTokens ────────────────────────────────────────────
  {
    const [agent] = await resolveAgents({
      provider: "google",
      model: "gemini-3-pro-preview",
      defaultParameters: tuned(),
      agents: [agentConfig("gemini-json", "game_state_update")],
    });
    const { body } = await run(agent!);
    const config = body.generationConfig ?? {};
    assert.equal(config.thinkingConfig?.thinkingLevel, "high");
    assert.equal(config.maxOutputTokens, 3000, "Gemini 3 counts thinking inside maxOutputTokens");
    assert.equal(config.topP, 0.8);
    assert.equal(config.topK, 40);
    assert.equal(config.temperature, 0.3);
  }

  // ── Agents on the chat's own connection (Codex): the chat connection's saved level is sent ──────────────────────
  {
    const codex = new OpenAIProvider(base, "codex-token", undefined, null, null, "openai-chatgpt");
    const codexAgents = (defaultParameters: unknown) =>
      resolveAgents({
        provider: "custom",
        model: "unused",
        defaultParameters: {},
        agents: [agentConfig("codex-json", "game_state_update", null)],
        chat: {
          chatProvider: codex,
          chatModel: "gpt-5.5",
          chatConnectionProvider: "openai_chatgpt",
          chatDefaultParameters: defaultParameters,
        } as Partial<PipelineArgs>,
      });
    const [chosen] = await codexAgents({ reasoningEffort: "medium" });
    assert.deepEqual(
      (await run(chosen!)).body.reasoning,
      { effort: "medium" },
      "Codex takes the chat connection level",
    );
    const [codexDefault] = await codexAgents({ reasoningEffort: null });
    assert.equal("reasoning" in (await run(codexDefault!)).body, false, "Codex Default keeps the model's own level");
  }

  // ── Tool rounds, Beholder lanes and the Illustrator's prompt writer send the connection's parameters too ───────
  {
    const lanes = "[worn]\nWorn.\n[wounds]\nWounds.\n[holding]\nHolding.\n[species]\nSpecies.\n[flags]\nFlags.";
    const resolveSideAgents = (defaultParameters: unknown) =>
      resolveAgents({
        provider: "custom",
        model: "fixture-model",
        defaultParameters,
        agents: [
          agentConfig("tool-json", "game_state_update"),
          { ...agentConfig("beholder", "beholder_update"), promptTemplate: lanes },
          agentConfig("illustrator", "image_prompt"),
        ],
      });
    const runSideAgents = async (defaultParameters: unknown) => {
      const [toolAgent, beholder, illustrator] = await resolveSideAgents(defaultParameters);
      let before = requests.length;
      assert.equal(
        (await executeAgent(toolAgent!, context, toolAgent!.provider, toolAgent!.model, noopTools)).success,
        true,
      );
      const [toolBody] = assertTunedSamplers(before, "tool round");
      assert.ok(toolBody?.tools?.length, "the tool round carries the tools");
      reply = '{"changed":false}';
      before = requests.length;
      await executeAgent(beholder!, context, beholder!.provider, beholder!.model);
      const laneBodies = assertTunedSamplers(before, "Beholder lane");
      assert.ok(laneBodies.length >= 5, "each Beholder lane makes its own request");
      reply = '{"prompt":"A lighthouse at dusk."}';
      before = requests.length;
      const plan = await writeManualIllustratorPromptPlan({ illustratorAgent: illustrator!, context });
      assert.equal(plan.plan.prompt, "A lighthouse at dusk.");
      const [illustratorBody] = assertTunedSamplers(before, "Illustrator prompt writer");
      reply = '{"weather":"rain"}';
      return { toolBody: toolBody!, laneBodies, illustratorBody: illustratorBody! };
    };

    const chosen = await runSideAgents(tuned());
    for (const body of [chosen.toolBody, ...chosen.laneBodies, chosen.illustratorBody]) {
      assert.notEqual(body.reasoning_effort, "none", "a chosen level is never replaced by none");
      assert.equal(body.max_tokens, 3000, "each call gets thinking room");
    }
    const unset = await runSideAgents(withoutReasoning());
    assert.equal(
      unset.toolBody.reasoning_effort,
      "none",
      "a JSON tool agent still asks for none when nothing is saved",
    );
    for (const body of [...unset.laneBodies, unset.illustratorBody]) {
      assert.equal("reasoning_effort" in body, false, "lanes and the prompt writer leave reasoning alone when unset");
      assert.equal(body.max_tokens, 1000, "and add no thinking room");
    }

    // Thinking room only takes context the prompt leaves free: the writer's own 1000 tokens still fit in a small
    // window, where its 3000 with room would not and the writer used to refuse the request.
    const [smallIllustrator] = await resolveAgents({
      provider: "custom",
      model: "fixture-model",
      defaultParameters: tuned(),
      agents: [agentConfig("illustrator", "image_prompt")],
      maxContext: SMALL_CONTEXT,
    });
    reply = '{"prompt":"A lighthouse at dusk."}';
    const before = requests.length;
    await writeManualIllustratorPromptPlan({ illustratorAgent: smallIllustrator!, context });
    const smallBody = requests[before]!.body;
    assert.ok(
      smallBody.max_tokens > 1000 && smallBody.max_tokens < 3000,
      `room shrinks to fit: ${smallBody.max_tokens}`,
    );

    // A larger primary must leave the same prompt intact if the smaller fallback takes over.
    const primary = new OpenAIProvider(`${base}/v1`, "fixture-key", 200_000);
    primary.chatComplete = async () => {
      throw new Error("Primary unavailable");
    };
    const fallbackConnection = {
      id: "small-fallback",
      provider: "custom",
      baseUrl: `${base}/v1`,
      apiKey: "fixture-key",
      model: "fixture-model",
      maxContext: SMALL_CONTEXT,
    };
    const fallbackAgent = {
      ...smallIllustrator!,
      provider: new ConnectionFallbackProvider(
        primary,
        smallIllustrator!.provider,
        fallbackConnection,
        "agents",
        () => {},
      ),
    };
    await writeManualIllustratorPromptPlan({ illustratorAgent: fallbackAgent, context });
    const fallbackBody = requests.at(-1)!.body;
    assert.deepEqual(fallbackBody.messages, smallBody.messages, "fallback thinking room never truncates the prompt");
    assert.equal(fallbackBody.max_tokens, smallBody.max_tokens, "thinking room respects the smaller fallback");

    for (const [primaryContext, fallbackContext, expected] of [
      [200_000, SMALL_CONTEXT, SMALL_CONTEXT],
      [SMALL_CONTEXT, 200_000, SMALL_CONTEXT],
      [undefined, SMALL_CONTEXT, SMALL_CONTEXT],
      [SMALL_CONTEXT, undefined, SMALL_CONTEXT],
      [undefined, undefined, null],
    ] as const) {
      const provider = new ConnectionFallbackProvider(
        new OpenAIProvider(base, "fixture-key", primaryContext),
        new OpenAIProvider(base, "fixture-key", fallbackContext),
        fallbackConnection,
        "agents",
      );
      assert.equal(provider.maxContextValue, expected, "known context limits survive fallback wrapping");
    }
    reply = '{"weather":"rain"}';
  }

  // ── A Reasoning Effort the model does not take is not a setting: no thinking room, JSON agents still ask for none ─
  {
    const [agent] = await resolveAgents({
      provider: "openai",
      model: "gpt-4.1-mini",
      defaultParameters: tuned(),
      agents: [agentConfig("non-reasoning-json", "game_state_update")],
    });
    assert.equal(agent!.generation?.reasoning, undefined, "Reasoning Effort is hidden for gpt-4.1-mini");
    assert.equal((await run(agent!)).body.max_tokens, 1000, "no thinking room for a model that does not reason");
  }

  // ── GPT-5: the saved Verbosity reaches agents ──────────────────────────────────────────────────────────────────
  {
    const [agent] = await resolveAgents({
      provider: "openai",
      model: "gpt-5.1",
      defaultParameters: tuned(),
      agents: [agentConfig("gpt5-text", "context_injection")],
    });
    const { body } = await run(agent!);
    assert.equal(body.verbosity ?? body.text?.verbosity, "low", "the saved verbosity is sent");
    assert.equal(body.reasoning_effort ?? body.reasoning?.effort, "high");
  }

  // ── Batches: only agents with identical effective parameters share a request ──────────────────────────────────
  {
    reply = JSON.stringify({ "batch-a": { weather: "rain" }, "batch-b": { weather: "sun" } });
    const batchAgents = (reasoningEffort: string, types: string[]) =>
      resolveAgents({
        provider: "openai",
        model: "o4-mini",
        defaultParameters: tuned({ reasoningEffort }),
        agents: types.map((type) => agentConfig(type, "game_state_update")),
      });
    const [a, b] = await batchAgents("high", ["batch-a", "batch-b"]);
    let before = requests.length;
    await executeAgentBatch([a!, b!], context, a!.provider, a!.model);
    assert.equal(requests.length, before + 1, "matching parameters share one request");
    const shared = requests.at(-1)!.body;
    assert.equal(shared.reasoning_effort, "high", "the batch keeps the user's level instead of forcing none");
    assert.equal(shared.max_completion_tokens, 2000 + 4000, "both budgets plus thinking room");

    const [other] = await batchAgents("low", ["batch-b"]);
    before = requests.length;
    await executeAgentBatch([a!, other!], context, a!.provider, a!.model);
    assert.equal(requests.length, before + 2, "different saved parameters split the batch");
    assert.deepEqual(
      requests.slice(before).map((entry) => entry.body.reasoning_effort),
      ["high", "low"],
      "each split request keeps its own parameters",
    );
    reply = '{"weather":"rain"}';
  }

  // ── Retry route: retried agents resolve their connection the same way ─────────────────────────────────────────
  {
    assert.equal(typeof retryRoute.resolveRetryAgents, "function", "the retry resolver is reachable");
    const stored = {
      id: "retry-connection",
      name: "Retry fixture",
      provider: "custom",
      baseUrl: `${base}/v1`,
      apiKey: "fixture-key",
      model: "fixture-model",
      maxContext: 200_000,
      defaultParameters: JSON.stringify(tuned()),
      maxParallelJobs: 1,
    };
    const resolveRetry = (connectionId: string | null) =>
      retryRoute.resolveRetryAgents({
        agentTypes: ["retry-fixture"],
        chat: {
          mode: "roleplay",
          connectionId: "retry-connection",
          metadata: JSON.stringify({ enableAgents: true, activeAgentIds: ["retry-fixture"] }),
        },
        conns: {
          getDefaultForAgents: async () => null,
          getFallbackForAgents: async () => null,
          getWithKey: async (id: string) => (id === stored.id ? stored : null),
          listRandomPool: async () => [],
        } as any,
        agentsStore: { list: async () => [agentConfig("retry-fixture", "game_state_update", connectionId)] } as any,
        allowExternalAgentImports: true,
        managedParameterDefinitions,
      });
    for (const connectionId of ["retry-connection", null]) {
      const { resolvedAgents } = await resolveRetry(connectionId);
      assert.equal(resolvedAgents.length, 1);
      const { body } = await run(resolvedAgents[0]!.resolved as ResolvedAgent);
      const label = connectionId ? "explicit connection" : "chat connection";
      assert.equal("reasoning_effort" in body, false, `retry (${label}) does not force none over the user's level`);
      assert.equal(body.top_p, 0.8, `retry (${label}) sends Top P`);
      assert.equal(body.top_a, 0.25, `retry (${label}) sends managed parameters`);
      assert.equal(body.max_tokens, 3000, `retry (${label}) leaves thinking room`);
    }
  }

  db = await getDB();
  const connections = createConnectionsStorage(db);
  await createAppSettingsStorage(db).set(
    CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY,
    JSON.stringify(managedParameterDefinitions),
  );

  // ── Capability host: headers, custom/managed parameters and the precedence rule ────────────────────────────────
  {
    const host = createCapabilityLanguageModelHost(db);
    const tunedConnection = await connections.create({
      name: "Package tuned",
      provider: "custom",
      baseUrl: `${base}/v1`,
      model: "fixture-model",
      apiKey: "fixture",
    });
    await connections.updateDefaultParameters(tunedConnection.id, tuned());
    const packageRequest = { temperature: 0.2, maxTokens: 1000, reasoningEffort: "none" as const };
    const tunedModel = await host.resolve(tunedConnection.id);
    await tunedModel.chatComplete([{ role: "user", content: "package" }], packageRequest);
    const tunedCall = requests.at(-1)!;
    assert.equal(tunedCall.headers["x-fixture"], "agent", "package calls carry the connection's custom headers");
    assert.equal(tunedCall.body.fixture_param, "yes", "package calls carry the connection's custom parameters");
    assert.equal(tunedCall.body.top_a, 0.25, "package calls carry managed custom parameters");
    assert.equal(tunedCall.body.temperature, 0.3, "a saved, switched-on temperature wins over the package's");
    assert.equal(tunedCall.body.top_p, 0.8);
    // The saved level replaced the package's none; this endpoint's model takes no level, as in the main chat.
    assert.equal("reasoning_effort" in tunedCall.body, false, "the user's saved level wins over the package's none");
    assert.equal(tunedCall.body.max_tokens, 3000, "the raised level gets thinking room");

    const reasoningConnection = await connections.create({
      name: "Package reasoning",
      provider: "openai",
      baseUrl: `${base}/v1`,
      model: "o4-mini",
      apiKey: "fixture",
    });
    await connections.updateDefaultParameters(reasoningConnection.id, tuned());
    const reasoningModel = await host.resolve(reasoningConnection.id);
    await reasoningModel.chatComplete([{ role: "user", content: "package" }], {
      maxTokens: 1000,
      reasoningEffort: "low",
    });
    const reasoningBody = requests.at(-1)!.body;
    assert.equal(reasoningBody.reasoning_effort, "high", "the user's saved level wins over the package's low");
    assert.equal(reasoningBody.max_completion_tokens, 3000, "the raised level gets thinking room");

    const plainConnection = await connections.create({
      name: "Package plain",
      provider: "custom",
      baseUrl: `${base}/v1`,
      model: "fixture-model",
      apiKey: "fixture",
    });
    const plainModel = await host.resolve(plainConnection.id);
    await plainModel.chatComplete([{ role: "user", content: "package" }], packageRequest);
    const plainBody = requests.at(-1)!.body;
    assert.equal(plainBody.temperature, 0.2, "with nothing saved the package's temperature stands");
    assert.equal(plainBody.reasoning_effort, "none", "with nothing saved the package's explicit none stands");
    assert.equal(plainBody.max_tokens, 1000);

    const switchedOffConnection = await connections.create({
      name: "Package defaults",
      provider: "custom",
      baseUrl: `${base}/v1`,
      model: "fixture-model",
      apiKey: "fixture",
    });
    await connections.updateDefaultParameters(
      switchedOffConnection.id,
      withoutReasoning({
        enabledParameters: { ...ALL_SWITCHES_ON, temperature: false, topP: false },
      }),
    );
    const switchedOffModel = await host.resolve(switchedOffConnection.id);
    await switchedOffModel.chatComplete([{ role: "user", content: "package" }], {
      temperature: 0.2,
      maxTokens: 1000,
      reasoningEffort: "low",
    });
    const switchedOffBody = requests.at(-1)!.body;
    assert.equal(switchedOffBody.temperature, 0.2, "a switched-off connection temperature leaves the package's");
    assert.equal("top_p" in switchedOffBody, false, "a switched-off Top P is not sent");
    assert.equal(switchedOffBody.max_tokens, 1000);

    const unsetReasoningConnection = await connections.create({
      name: "Package unset reasoning",
      provider: "openai",
      baseUrl: `${base}/v1`,
      model: "o4-mini",
      apiKey: "fixture",
    });
    await connections.updateDefaultParameters(unsetReasoningConnection.id, withoutReasoning());
    const unsetReasoningModel = await host.resolve(unsetReasoningConnection.id);
    await unsetReasoningModel.chatComplete([{ role: "user", content: "package" }], {
      maxTokens: 1000,
      reasoningEffort: "low",
    });
    const unsetReasoningBody = requests.at(-1)!.body;
    assert.equal(unsetReasoningBody.reasoning_effort, "low", "with no saved level the package's own level stands");
    assert.equal(unsetReasoningBody.max_completion_tokens, 1000, "and its own budget is left alone");

    const packageCall = async (
      connection: Record<string, unknown>,
      defaultParameters: unknown,
      request: Parameters<Awaited<ReturnType<typeof host.resolve>>["chatComplete"]>[1],
    ) => {
      const created = await connections.create({ apiKey: "fixture", baseUrl: `${base}/v1`, ...connection } as any);
      await connections.updateDefaultParameters(created.id, defaultParameters);
      await (await host.resolve(created.id)).chatComplete([{ role: "user", content: "package" }], request);
      return requests.at(-1)!.body;
    };

    // Every Send switch off: nothing behind one is sent. Reasoning Effort and Max Tokens start on, so off is
    // deliberate and wins over the package's own request too.
    const allOff = Object.fromEntries(Object.keys(ALL_SWITCHES_ON).map((key) => [key, false]));
    const offBody = await packageCall(
      { name: "Package all off", provider: "custom", model: "fixture-model" },
      tuned({ enabledParameters: allOff }),
      { maxTokens: 1000, reasoningEffort: "low" },
    );
    for (const field of ["top_p", "top_k", "frequency_penalty", "presence_penalty", "reasoning_effort", "max_tokens"]) {
      assert.equal(field in offBody, false, `a switched-off ${field} is not sent on package calls`);
    }
    const reasoningOffBody = await packageCall(
      { name: "Package reasoning off", provider: "openai", model: "o4-mini" },
      tuned({ enabledParameters: { ...ALL_SWITCHES_ON, reasoningEffort: false, maxTokens: false } }),
      { maxTokens: 1000, reasoningEffort: "low" },
    );
    assert.equal("reasoning_effort" in reasoningOffBody, false, "a switched-off Reasoning Effort drops the package's");
    assert.equal("max_completion_tokens" in reasoningOffBody, false, "a switched-off Max Tokens drops the package's");

    // GPT-5: the saved Verbosity wins over the package's; switched off, it is not sent from the connection.
    const verbosityBody = await packageCall({ name: "Package GPT-5", provider: "openai", model: "gpt-5.1" }, tuned(), {
      maxTokens: 1000,
      verbosity: "high",
    });
    assert.equal(verbosityBody.verbosity ?? verbosityBody.text?.verbosity, "low");
    const verbosityOffBody = await packageCall(
      { name: "Package GPT-5 verbosity off", provider: "openai", model: "gpt-5.1" },
      tuned({ enabledParameters: { ...ALL_SWITCHES_ON, verbosity: false } }),
      { maxTokens: 1000 },
    );
    assert.equal(verbosityOffBody.verbosity ?? verbosityOffBody.text?.verbosity, undefined);

    // The added room stays within the model's output limit, but never cuts what the package asked for.
    const nearLimitBody = await packageCall(
      { name: "Package near limit", provider: "openai", model: "o4-mini" },
      tuned(),
      {
        maxTokens: 99_000,
      },
    );
    assert.equal(nearLimitBody.max_completion_tokens, 100_000, "thinking room is capped at o4-mini's 100000 limit");
  }

  // ── Main route: agents on the chat's connection send what the main chat sends for that connection ────────────
  {
    const chats = createChatsStorage(db);
    const agents = createAgentsStorage(db);
    const lorebooks = createLorebooksStorage(db);
    const app = Fastify();
    app.decorate("db", db);
    app.decorate("activeGenerations", new Map());
    await app.register(generateRoutes, { prefix: "/api/generate" });
    try {
      const lorebook = await lorebooks.create({ name: "Agent parameters lore", description: "Fixture" });
      await lorebooks.createEntry({
        lorebookId: lorebook.id,
        name: "Gate",
        content: "The gate is locked.",
        keys: ["gate"],
      });
      const chatAgent = (type: string, marker: string, phase: string, settings: Record<string, unknown>) =>
        agents.create({
          type,
          name: type,
          phase,
          connectionId: null,
          promptTemplate: `AGENT_FIXTURE ${marker}`,
          settings: { maxTokens: 1000, ...settings },
        });
      // Each one reaches the chat connection through a different call site in the route.
      const fixtureAgents = {
        CHAT_FIXTURE: await chatAgent("chat-connection-fixture", "CHAT_FIXTURE", "pre_generation", {
          resultType: "context_injection",
        }),
        ACTIVITY_FIXTURE: await chatAgent("activity-fixture", "ACTIVITY_FIXTURE", "pre_generation", {
          resultType: "character_activity_update",
          customCapabilities: { manage_chat_characters: true },
        }),
        KR_FIXTURE: await chatAgent("knowledge-retrieval", "KR_FIXTURE", "pre_generation", {
          resultType: "context_injection",
          sourceLorebookIds: [lorebook.id],
        }),
        ROUTER_FIXTURE: await chatAgent("knowledge-router", "ROUTER_FIXTURE", "pre_generation", {
          resultType: "context_injection",
          sourceLorebookIds: [lorebook.id],
        }),
        RETRY_FIXTURE: await chatAgent("retry-route-fixture", "RETRY_FIXTURE", "post_processing", {
          resultType: "context_injection",
        }),
      };
      markerReplies.set("ACTIVITY_FIXTURE", '{"activeCharacterIds":[]}');
      markerReplies.set("ROUTER_FIXTURE", '{"entryIds":[]}');
      reply = "Agent context.";
      const isAgent = (entry: Captured) => JSON.stringify(entry.body).includes("AGENT_FIXTURE");
      const generate = async (connectionParameters: unknown, chatParameters?: unknown) => {
        const chatConnection = await connections.create({
          name: "Chat connection",
          provider: "openrouter",
          baseUrl: `${base}/v1`,
          model: "deepseek/deepseek-r1",
          apiKey: "fixture",
        });
        await connections.updateDefaultParameters(chatConnection.id, connectionParameters);
        const chat = await chats.create({
          name: "Agent parameters",
          mode: "roleplay",
          characterIds: [],
          connectionId: chatConnection.id,
          promptPresetId: null,
        });
        assert.ok(chat);
        await chats.patchMetadata(chat.id, {
          enableAgents: true,
          activeAgentIds: Object.values(fixtureAgents).map((agent) => agent!.type),
          ...(chatParameters ? { chatParameters } : {}),
        });
        await chats.createMessage({ chatId: chat.id, role: "user", content: "Open the gate." });
        const before = requests.length;
        const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
        assert.equal(response.statusCode, 200, response.body);
        const turn = requests.slice(before);
        const mainBody = turn.find((entry) => !isAgent(entry))?.body;
        assert.ok(mainBody, "the main reply ran");
        const agentBody = (marker: string) => {
          const body = turn.find((entry) => JSON.stringify(entry.body).includes(marker))?.body;
          assert.ok(body, `${marker} ran on the chat connection`);
          return body;
        };
        return { chat, mainBody, agentBody };
      };

      const { chat, mainBody, agentBody } = await generate(tuned());
      for (const marker of ["CHAT_FIXTURE", "ACTIVITY_FIXTURE", "KR_FIXTURE", "ROUTER_FIXTURE"]) {
        const body = agentBody(marker);
        for (const field of ["top_p", "frequency_penalty", "presence_penalty", "reasoning", "top_a", "fixture_param"]) {
          assert.notEqual(mainBody[field], undefined, `the main chat sends ${field}`);
          assert.deepEqual(body[field], mainBody[field], `${marker} sends the chat connection's ${field}`);
        }
      }

      // Retrying an agent on the chat's connection goes through the retry route, which loads Top A's definition.
      const before = requests.length;
      const retried = await app.inject({
        method: "POST",
        url: "/api/generate/retry-agents",
        payload: { chatId: chat.id, agentTypes: [fixtureAgents.RETRY_FIXTURE!.type] },
      });
      assert.equal(retried.statusCode, 200, retried.body);
      const retryBody = requests
        .slice(before)
        .find((entry) => JSON.stringify(entry.body).includes("RETRY_FIXTURE"))?.body;
      assert.ok(retryBody, "the retried agent ran");
      assert.equal(retryBody.top_a, 0.25, "the retry route loads managed parameter definitions");
      assert.equal(retryBody.top_p, 0.8);

      // A value switched off on the connection stays unsent from agents, even when the chat switches its own on.
      const switchedOff = await generate(tuned({ enabledParameters: { ...ALL_SWITCHES_ON, topP: false } }), {
        topP: 0.5,
        enabledParameters: { topP: true },
      });
      assert.equal(switchedOff.mainBody.top_p, 0.5, "the main reply sends the chat's Top P");
      assert.equal("top_p" in switchedOff.agentBody("CHAT_FIXTURE"), false, "the agent sends no Top P");
    } finally {
      markerReplies.clear();
      await app.close();
    }
  }

  console.log("agent-connection-parameters regression passed");
} finally {
  server.close();
  if (db) await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
