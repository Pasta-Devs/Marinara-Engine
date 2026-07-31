import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  findKnownModel,
  isClaudeAdaptiveOnlyNoSamplingModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
} from "../../packages/shared/src/constants/model-lists.js";
import {
  applyGlmThinkingParameters,
  isNativeGlmEndpoint,
} from "../../packages/server/src/services/llm/providers/glm-request-compat.js";
import {
  NOODLE_JSON_OUTPUT_HEADING,
  noodleResponseFormat,
} from "../../packages/server/src/services/noodle/noodle-response-format.js";
import {
  AnthropicProvider,
  supportsAnthropicThinkingDisable,
} from "../../packages/server/src/services/llm/providers/anthropic.provider.js";
import {
  __setSdkForTesting,
  ClaudeSubscriptionProvider,
} from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";
import { resolveGeminiThinkingConfig } from "../../packages/server/src/services/llm/providers/google.provider.js";
import {
  normalizeOpenAIChatCompletionsResponseFormat,
  OpenAIProvider,
} from "../../packages/server/src/services/llm/providers/openai.provider.js";
import {
  isOpenRouterApiUrl,
  OPENROUTER_APP_CATEGORIES,
  OPENROUTER_APP_REFERER,
  OPENROUTER_APP_TITLE,
  requestHeadersWithOpenRouterAttribution,
} from "../../packages/server/src/utils/openrouter-attribution.js";
import {
  ConnectionFallbackProvider,
  type FallbackConnection,
} from "../../packages/server/src/services/llm/connection-fallback-provider.js";
import {
  BaseLLMProvider,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../../packages/server/src/services/llm/base-provider.js";
import {
  createLLMProvider,
  normalizeCohereOpenAIBaseUrl,
} from "../../packages/server/src/services/llm/provider-registry.js";
import {
  runWithGenerationFallbackNotifier,
  type GenerationFallbackNotice,
} from "../../packages/server/src/services/generation/fallback-notification.js";
import { resolveStoredChatOptions } from "../../packages/server/src/services/generation/generation-parameters.js";
import { resolveMainGenerationToolChoice } from "../../packages/server/src/services/generation/tool-resolution-runtime.js";

class RegressionProvider extends BaseLLMProvider {
  calls = 0;
  lastOptions: ChatOptions | null = null;

  constructor(
    private readonly chunks: string[],
    private readonly failure?: Error,
    private readonly usage?: LLMUsage,
  ) {
    super("", "");
  }

  async *chat(_messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    this.calls += 1;
    this.lastOptions = options;
    for (const chunk of this.chunks) yield chunk;
    if (this.failure) throw this.failure;
    return this.usage;
  }
}

class TokenCallbackFailureProvider extends BaseLLMProvider {
  calls = 0;

  constructor() {
    super("", "");
  }

  async *chat(_messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    this.calls += 1;
    await options.onToken?.("visible callback output");
    throw new Error("stream interrupted after callback output");
  }
}

async function collectProviderOutput(provider: BaseLLMProvider, options: ChatOptions): Promise<string> {
  let output = "";
  for await (const chunk of provider.chat([{ role: "user", content: "test" }], options)) output += chunk;
  return output;
}

const gatewaySseBody = [
  ": x-omniroute-cache-hit=false",
  'data: {"choices":[{"delta":{},"finish_reason":null}]}',
  'data: {"choices":[{"message":{"content":"recovered final message"},"finish_reason":"stop"}]}',
  "data: [DONE]",
].join("\n");
const gatewayServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(gatewaySseBody);
});
await new Promise<void>((resolve) => gatewayServer.listen(0, "127.0.0.1", resolve));
try {
  const address = gatewayServer.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://localhost:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "custom",
  );
  assert.equal(
    await collectProviderOutput(provider, { model: "custom-model", stream: true }),
    "recovered final message",
  );
  assert.equal(
    await collectProviderOutput(provider, { model: "custom-model", stream: false }),
    "recovered final message",
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    gatewayServer.close((error) => (error ? reject(error) : resolve())),
  );
}

let customParametersRequestBody: Record<string, unknown> | null = null;
const testToolDefinition = {
  type: "function" as const,
  function: {
    name: "fresh_data",
    description: "Fetch current data",
    parameters: { type: "object", properties: {} },
  },
};
const customParametersServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  customParametersRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "configured" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => customParametersServer.listen(0, "127.0.0.1", resolve));
try {
  const address = customParametersServer.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "custom",
  );
  await provider.chatComplete([{ role: "user", content: "test" }], {
    model: "custom-model",
    stream: false,
    topK: 44,
    minP: 0.12,
    reasoningEffort: "high",
    verbosity: "low",
    enabledParameters: { topK: true, reasoningEffort: true, verbosity: true },
  });
  assert.ok(customParametersRequestBody);
  assert.equal(customParametersRequestBody.top_k, 44);
  assert.equal(customParametersRequestBody.min_p, 0.12);
  assert.equal(customParametersRequestBody.reasoning_effort, "high");
  assert.equal(customParametersRequestBody.verbosity, "low");

  customParametersRequestBody = null;
  await provider.chatComplete([{ role: "user", content: "fetch current data" }], {
    model: "custom-model",
    stream: false,
    tools: [testToolDefinition],
    toolChoice: "required",
  });
  assert.ok(customParametersRequestBody);
  assert.equal(customParametersRequestBody.tool_choice, "required");
  assert.equal(typeof customParametersRequestBody.tool_choice, "string");

  customParametersRequestBody = null;
  await provider.chatComplete([{ role: "user", content: "tool choice default" }], {
    model: "custom-model",
    stream: false,
    tools: [testToolDefinition],
  });
  assert.ok(customParametersRequestBody);
  assert.equal(customParametersRequestBody.tool_choice, "auto");

  customParametersRequestBody = null;
  await provider.chatComplete([{ role: "user", content: "test explicit custom samplers" }], {
    model: "gpt-5.6-local",
    stream: false,
    minP: 0.25,
    reasoningEffort: "high",
    customParameters: {
      min_p: 0.01,
      top_k: 21,
      frequency_penalty: 0.4,
      presence_penalty: -0.2,
      top_n_sigma: 1.5,
      chat_template_kwargs: { enable_thinking: true },
    },
  });
  assert.ok(customParametersRequestBody);
  assert.equal(customParametersRequestBody.min_p, 0.01);
  assert.equal(customParametersRequestBody.top_k, 21);
  assert.equal(customParametersRequestBody.frequency_penalty, 0.4);
  assert.equal(customParametersRequestBody.presence_penalty, -0.2);
  assert.equal(customParametersRequestBody.top_n_sigma, 1.5);
  assert.deepEqual(customParametersRequestBody.chat_template_kwargs, { enable_thinking: true });
  assert.equal("temperature" in customParametersRequestBody, false);
  assert.equal("top_p" in customParametersRequestBody, false);

  customParametersRequestBody = null;
  await provider.chatComplete([{ role: "user", content: "test inferred samplers" }], {
    model: "gpt-5.6-local",
    stream: false,
    temperature: 0.7,
    topP: 0.8,
    topK: 44,
    minP: 0.25,
    frequencyPenalty: 0.5,
    presencePenalty: 0.3,
    reasoningEffort: "high",
    enabledParameters: {
      temperature: true,
      topP: true,
      topK: true,
      frequencyPenalty: true,
      presencePenalty: true,
    },
  });
  assert.ok(customParametersRequestBody);
  for (const key of ["temperature", "top_p", "top_k", "min_p", "frequency_penalty", "presence_penalty"]) {
    assert.equal(key in customParametersRequestBody, false);
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    customParametersServer.close((error) => (error ? reject(error) : resolve())),
  );
}

assert.deepEqual(
  resolveStoredChatOptions(
    JSON.stringify({
      temperature: 0.31,
      topP: 0.82,
      topK: 44,
      minP: 0.12,
      frequencyPenalty: 0.2,
      presencePenalty: -0.1,
      reasoningEffort: "maximum",
      verbosity: "low",
      stopSequences: ["END"],
      enabledParameters: { topK: true, reasoningEffort: true, verbosity: true },
    }),
    "custom",
    "custom-model",
  ),
  {
    temperature: 0.31,
    topP: 0.82,
    topK: 44,
    minP: 0.12,
    frequencyPenalty: 0.2,
    presencePenalty: -0.1,
    reasoningEffort: "high",
    verbosity: "low",
    serviceTier: undefined,
    stop: ["END"],
    customParameters: undefined,
    enabledParameters: { topK: true, reasoningEffort: true, verbosity: true },
  },
);
assert.equal(
  resolveStoredChatOptions(
    JSON.stringify({ reasoningEffort: null, enabledParameters: { reasoningEffort: true } }),
    "openrouter",
    "openai/gpt-5.1",
  ).reasoningEffort,
  "none",
);
assert.equal(
  resolveStoredChatOptions(
    JSON.stringify({ reasoningEffort: null, enabledParameters: { reasoningEffort: false } }),
    "openrouter",
    "openai/gpt-5.1",
  ).reasoningEffort,
  undefined,
);
assert.deepEqual(resolveGeminiThinkingConfig("gemini-2.5-flash", { reasoningEffort: "none" }, 4096), {
  thinkingBudget: 0,
  includeThoughts: false,
});
assert.equal(
  resolveGeminiThinkingConfig("gemini-2.5-pro", { reasoningEffort: "none" }, 4096),
  undefined,
  "Gemini 2.5 Pro does not support disabling thinking",
);
assert.equal(
  resolveGeminiThinkingConfig("gemini-3.5-flash", { reasoningEffort: "none" }, 4096),
  undefined,
  "reasoning-mandatory Gemini 3 models must not receive an unsupported off value",
);
assert.equal(supportsAnthropicThinkingDisable("claude-sonnet-5"), true);
assert.equal(supportsAnthropicThinkingDisable("claude-opus-5"), true);
assert.equal(supportsAnthropicThinkingDisable("claude-fable-5"), false);
assert.equal(isClaudeAdaptiveOnlyNoSamplingModel("claude-opus-5"), true);
const opus5 = findKnownModel("anthropic", "claude-opus-5");
assert.equal(opus5?.context, 1_000_000);
assert.equal(opus5?.maxOutput, 128_000);
const subscriptionOpus5 = findKnownModel("claude_subscription", "claude-opus-5");
assert.equal(subscriptionOpus5?.context, 1_000_000);
assert.equal(subscriptionOpus5?.maxOutput, 128_000);
assert.equal(
  resolveProviderReasoningEffort({
    provider: "anthropic",
    model: "claude-opus-5",
    reasoningEffort: "maximum",
  }),
  "max",
);

// OpenAI Responses always requests a readable reasoning summary when reasoning
// is active. Display/capture flags control what the app does with that summary,
// but must not silently remove it from the provider request.
{
  let responsesReasoningRequestBody: Record<string, unknown> | null = null;
  const responsesReasoningSse = [
    "event: response.reasoning_summary_part.added",
    'data: {"type":"response.reasoning_summary_part.added","part":{"type":"summary_text","text":"Checked the roleplay context."}}',
    "",
    "event: response.output_text.delta",
    'data: {"type":"response.output_text.delta","delta":"Visible reply"}',
    "",
    "event: response.completed",
    'data: {"type":"response.completed","response":{"status":"completed","output":[{"id":"msg_1","type":"message","content":[{"type":"output_text","text":"Visible reply"}]}],"usage":{"input_tokens":12,"output_tokens":7,"total_tokens":19,"output_tokens_details":{"reasoning_tokens":4}}}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const responsesReasoningServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    responsesReasoningRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(responsesReasoningSse);
  });
  await new Promise<void>((resolve) => responsesReasoningServer.listen(0, "127.0.0.1", resolve));
  try {
    const address = responsesReasoningServer.address();
    assert.ok(address && typeof address === "object");
    const provider = new OpenAIProvider(
      `http://127.0.0.1:${address.port}/v1`,
      "test",
      undefined,
      undefined,
      undefined,
      "openai",
    );
    let thinking = "";
    assert.equal(
      await collectProviderOutput(provider, {
        model: "gpt-5.6-sol",
        stream: true,
        reasoningEffort: "xhigh",
        excludePastReasoning: false,
        onThinking: (chunk) => {
          thinking += chunk;
        },
      }),
      "Visible reply",
    );
    assert.equal(thinking, "Checked the roleplay context.");
    assert.ok(responsesReasoningRequestBody);
    assert.deepEqual(responsesReasoningRequestBody.reasoning, {
      effort: "xhigh",
      context: "all_turns",
      summary: "auto",
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      responsesReasoningServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

// Opus 5 uses adaptive thinking, output_config.effort, and rejects legacy
// sampling knobs. Capturing Roleplay reasoning must explicitly request the
// summarized display even though thinking itself is on by default.
{
  const anthropicRequestBodies: Array<Record<string, unknown>> = [];
  const anthropicServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    anthropicRequestBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        content: [
          { type: "thinking", thinking: "Summarized Claude reasoning." },
          { type: "text", text: "Claude reply" },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 6 },
      }),
    );
  });
  await new Promise<void>((resolve) => anthropicServer.listen(0, "127.0.0.1", resolve));
  try {
    const address = anthropicServer.address();
    assert.ok(address && typeof address === "object");
    const provider = new AnthropicProvider(`http://127.0.0.1:${address.port}`, "test");
    let thinking = "";
    assert.equal(
      await collectProviderOutput(provider, {
        model: "claude-opus-5",
        stream: false,
        captureReasoning: true,
        reasoningEffort: "max",
        temperature: 0.7,
        topK: 32,
        onThinking: (chunk) => {
          thinking += chunk;
        },
      }),
      "Claude reply",
    );
    assert.equal(thinking, "Summarized Claude reasoning.");
    const maxEffortBody = anthropicRequestBodies[0];
    assert.ok(maxEffortBody);
    assert.deepEqual(maxEffortBody.thinking, { type: "adaptive", display: "summarized" });
    assert.deepEqual(maxEffortBody.output_config, { effort: "max" });
    assert.equal("temperature" in maxEffortBody, false);
    assert.equal("top_k" in maxEffortBody, false);
    assert.equal("top_p" in maxEffortBody, false);

    await collectProviderOutput(provider, {
      model: "claude-opus-5",
      stream: false,
      captureReasoning: true,
      reasoningEffort: "none",
      temperature: 0.7,
      topK: 32,
    });
    const disabledBody = anthropicRequestBodies[1];
    assert.ok(disabledBody);
    assert.deepEqual(disabledBody.thinking, { type: "disabled" });
    assert.equal("output_config" in disabledBody, false);
    assert.equal("temperature" in disabledBody, false);
    assert.equal("top_k" in disabledBody, false);
    assert.equal("top_p" in disabledBody, false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      anthropicServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

{
  let subscriptionOptions: Record<string, unknown> | null = null;
  __setSdkForTesting({
    query: ((args: { options: Record<string, unknown> }) => {
      subscriptionOptions = args.options;
      return (async function* () {
        yield {
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "text_delta", text: "Subscription reply" } },
        };
        yield {
          type: "result",
          subtype: "success",
          result: "",
          usage: { input_tokens: 9, output_tokens: 5 },
          modelUsage: { "claude-opus-5": {} },
          fast_mode_state: "off",
        };
      })();
    }) as never,
  });
  try {
    const provider = new ClaudeSubscriptionProvider("", "");
    assert.equal(
      await collectProviderOutput(provider, {
        model: "claude-opus-5",
        stream: true,
        captureReasoning: true,
        reasoningEffort: "xhigh",
      }),
      "Subscription reply",
    );
    assert.ok(subscriptionOptions);
    assert.deepEqual(subscriptionOptions.thinking, { type: "adaptive", display: "summarized" });
    assert.equal(subscriptionOptions.effort, "xhigh");
  } finally {
    __setSdkForTesting(null);
  }
}

let openRouterRequestBody: Record<string, unknown> | null = null;
const openRouterServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  openRouterRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "reasoned response" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => openRouterServer.listen(0, "127.0.0.1", resolve));
try {
  const address = openRouterServer.address();
  assert.ok(address && typeof address === "object");
  const provider = createLLMProvider(
    "openrouter",
    `http://127.0.0.1:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    false,
    false,
    JSON.stringify({
      customParameters: {
        connection_only: "inherited",
        nested: { connection: true, shared: "connection" },
      },
    }),
  );
  const resolvedTencentEffort = resolveProviderReasoningEffort({
    provider: "openrouter",
    model: "tencent/hy3:free",
    reasoningEffort: "xhigh",
  });
  assert.equal(resolvedTencentEffort, "high");
  assert.equal(
    await collectProviderOutput(provider, {
      model: "tencent/hy3:free",
      stream: false,
      enableThinking: true,
      reasoningEffort: resolvedTencentEffort,
      customParameters: { awesomesauce: "enabled", nested: { level: 3, shared: "chat" } },
    }),
    "reasoned response",
  );
  const capturedOpenRouterBody = openRouterRequestBody as Record<string, unknown> | null;
  assert.ok(capturedOpenRouterBody);
  assert.deepEqual(capturedOpenRouterBody.reasoning, { effort: "high" });
  assert.equal(capturedOpenRouterBody.connection_only, "inherited");
  assert.equal(capturedOpenRouterBody.awesomesauce, "enabled");
  assert.deepEqual(capturedOpenRouterBody.nested, { connection: true, shared: "chat", level: 3 });

  openRouterRequestBody = null;
  await collectProviderOutput(provider, {
    model: "openai/gpt-5.1",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  const disabledOpenRouterBody = openRouterRequestBody as Record<string, unknown> | null;
  assert.ok(disabledOpenRouterBody);
  assert.deepEqual(disabledOpenRouterBody.reasoning, { effort: "none" });

  openRouterRequestBody = null;
  await collectProviderOutput(provider, {
    model: "google/gemini-3.5-flash",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  const mandatoryOpenRouterBody = openRouterRequestBody as Record<string, unknown> | null;
  assert.ok(mandatoryOpenRouterBody);
  assert.equal(
    "reasoning" in mandatoryOpenRouterBody,
    false,
    "known reasoning-mandatory OpenRouter models must keep their provider default",
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    openRouterServer.close((error) => (error ? reject(error) : resolve())),
  );
}

function assertStrictObjects(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.type === "object") assert.equal(record.additionalProperties, false);
  for (const nested of Object.values(record)) {
    if (Array.isArray(nested)) nested.forEach(assertStrictObjects);
    else assertStrictObjects(nested);
  }
}

assert.match(NOODLE_JSON_OUTPUT_HEADING, /JSON/u);
assert.deepEqual(noodleResponseFormat("gpt-4o", "timeline"), { type: "json_object" });
const solTimelineFormat = noodleResponseFormat("gpt-5.6-sol", "timeline");
assert.equal(solTimelineFormat.type, "json_schema");
assert.equal(solTimelineFormat.name, "noodle_timeline");
assert.equal(solTimelineFormat.strict, true);
assertStrictObjects(solTimelineFormat.schema);
assert.deepEqual(normalizeOpenAIChatCompletionsResponseFormat(solTimelineFormat), {
  type: "json_schema",
  json_schema: {
    name: "noodle_timeline",
    schema: solTimelineFormat.schema,
    strict: true,
  },
});
assert.deepEqual(normalizeOpenAIChatCompletionsResponseFormat({ type: "json_object" }), {
  type: "json_object",
});
const solProfileFormat = noodleResponseFormat("gpt-5.6-sol", "profiles");
assert.equal(solProfileFormat.name, "noodle_profiles");
assertStrictObjects(solProfileFormat.schema);

const glm52 = findKnownModel("custom", "glm-5.2");
assert.equal(glm52?.context, 1_000_000);
assert.equal(glm52?.maxOutput, 128_000);
assert.equal(
  shouldSuppressUnknownModelParameters("custom", "user-defined-model"),
  false,
  "Custom OAI-compatible endpoints must honor the user's parameter switches for unlisted models",
);
assert.equal(
  shouldSuppressUnknownModelParameters("openai", "user-defined-model"),
  true,
  "Provider catalogs should keep their existing unknown-model compatibility guard",
);
assert.equal(isNativeGlmEndpoint("https://api.z.ai/api/paas/v4/"), true);
assert.equal(isNativeGlmEndpoint("https://example.com/v1"), false);

const glm52HighBody: Record<string, unknown> = {};
assert.equal(
  applyGlmThinkingParameters(glm52HighBody, {
    model: "glm-5.2",
    baseUrl: "https://api.z.ai/api/paas/v4/",
    providerKind: "custom",
    enableThinking: true,
    reasoningEffort: "high",
  }),
  true,
);
assert.deepEqual(glm52HighBody.thinking, { type: "enabled" });
assert.equal(glm52HighBody.reasoning_effort, "high");
assert.equal("enable_thinking" in glm52HighBody, false);

const glm52MaxBody: Record<string, unknown> = {};
applyGlmThinkingParameters(glm52MaxBody, {
  model: "glm-5.2",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  providerKind: "custom",
  reasoningEffort: "xhigh",
});
assert.deepEqual(glm52MaxBody, { thinking: { type: "enabled" }, reasoning_effort: "max" });

const glm52DisabledBody: Record<string, unknown> = {};
applyGlmThinkingParameters(glm52DisabledBody, {
  model: "glm-5.2",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  providerKind: "custom",
  enableThinking: false,
  reasoningEffort: "none",
});
assert.deepEqual(glm52DisabledBody, { thinking: { type: "disabled" } });

const legacyGlmBody: Record<string, unknown> = {};
applyGlmThinkingParameters(legacyGlmBody, {
  model: "glm-5",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  providerKind: "custom",
  reasoningEffort: "high",
});
assert.deepEqual(legacyGlmBody, { enable_thinking: true });

const unrelatedCustomBody: Record<string, unknown> = {};
assert.equal(
  applyGlmThinkingParameters(unrelatedCustomBody, {
    model: "glm-5.2",
    baseUrl: "https://example.com/v1",
    providerKind: "custom",
    reasoningEffort: "high",
  }),
  false,
);
assert.deepEqual(unrelatedCustomBody, {});

const attributedHeaders = requestHeadersWithOpenRouterAttribution("https://openrouter.ai/api/v1/models", {
  Authorization: "Bearer test",
});
assert.equal(attributedHeaders?.get("authorization"), "Bearer test");
assert.equal(attributedHeaders?.get("HTTP-Referer"), OPENROUTER_APP_REFERER);
assert.equal(attributedHeaders?.get("X-OpenRouter-Title"), OPENROUTER_APP_TITLE);
assert.equal(attributedHeaders?.get("X-OpenRouter-Categories"), OPENROUTER_APP_CATEGORIES);
const unrelatedHeaders = requestHeadersWithOpenRouterAttribution("https://api.openai.com/v1/models", {
  Authorization: "Bearer test",
});
assert.equal(unrelatedHeaders?.get("HTTP-Referer"), null);
assert.equal(unrelatedHeaders?.get("X-OpenRouter-Title"), null);
assert.equal(unrelatedHeaders?.get("X-OpenRouter-Categories"), null);
assert.equal(isOpenRouterApiUrl("https://openrouter.ai/api/v1"), true);
assert.equal(isOpenRouterApiUrl("https://api.openrouter.ai/v1"), true);
assert.equal(isOpenRouterApiUrl("https://openrouter.ai.example.com/v1"), false);
assert.equal(isOpenRouterApiUrl("not a URL"), false);
assert.equal(resolveMainGenerationToolChoice({ forceToolCall: true }, 0), "required");
assert.equal(resolveMainGenerationToolChoice({ forceToolCall: "true" }, 0), "required");
assert.equal(resolveMainGenerationToolChoice({ forceToolCall: true }, 1), "auto");
assert.equal(resolveMainGenerationToolChoice({ forceToolCall: false }, 0), "auto");
assert.equal(normalizeCohereOpenAIBaseUrl("https://api.cohere.com"), "https://api.cohere.ai/compatibility/v1");
assert.equal(normalizeCohereOpenAIBaseUrl("https://api.cohere.ai/"), "https://api.cohere.ai/compatibility/v1");
assert.equal(normalizeCohereOpenAIBaseUrl("https://api.cohere.com/v1"), "https://api.cohere.ai/compatibility/v1");
assert.equal(normalizeCohereOpenAIBaseUrl("https://api.cohere.ai/v2"), "https://api.cohere.ai/compatibility/v1");
assert.equal(normalizeCohereOpenAIBaseUrl("https://example.com/v1/"), "https://example.com/v1");

const fallbackConnection: FallbackConnection = {
  id: "fallback-connection",
  name: "Fallback",
  provider: "custom",
  baseUrl: "https://fallback.example/v1",
  apiKey: "test",
  model: "fallback-model",
  defaultParameters: JSON.stringify({
    temperature: 0.35,
    maxTokens: 512,
    customParameters: {
      fallback_only: "inherited",
      nested: { fallback: true, shared: "fallback" },
    },
  }),
};
const primaryFailure = new RegressionProvider([], new Error("primary unavailable"));
const successfulFallback = new RegressionProvider(["fallback response"]);
const fallbackProvider = new ConnectionFallbackProvider(primaryFailure, successfulFallback, fallbackConnection, "main");
assert.equal(
  await collectProviderOutput(fallbackProvider, {
    model: "primary-model",
    temperature: 0.9,
    maxTokens: 1024,
    customParameters: { request_only: "preserved", nested: { request: true, shared: "request" } },
  }),
  "fallback response",
);
assert.equal(primaryFailure.calls, 1);
assert.equal(successfulFallback.calls, 1);
assert.equal(successfulFallback.lastOptions?.model, "fallback-model");
assert.equal(successfulFallback.lastOptions?.temperature, 0.35);
assert.equal(successfulFallback.lastOptions?.maxTokens, 512);
assert.deepEqual(successfulFallback.lastOptions?.customParameters, {
  fallback_only: "inherited",
  request_only: "preserved",
  nested: { fallback: true, shared: "request", request: true },
});

let fallbackNotice: GenerationFallbackNotice | null = null;
await runWithGenerationFallbackNotifier(
  (notice) => {
    fallbackNotice = notice;
  },
  () =>
    collectProviderOutput(
      new ConnectionFallbackProvider(
        new RegressionProvider([], new Error("primary unavailable")),
        new RegressionProvider(["notified fallback"]),
        fallbackConnection,
        "main",
      ),
      { model: "primary-model" },
    ),
);
assert.deepEqual(fallbackNotice, {
  category: "main",
  connectionId: "fallback-connection",
  connectionName: "Fallback",
  model: "fallback-model",
});

const emptyStreamFallback = new RegressionProvider(["fallback after empty stream"]);
assert.equal(
  await collectProviderOutput(
    new ConnectionFallbackProvider(new RegressionProvider(["  "]), emptyStreamFallback, fallbackConnection, "main"),
    { model: "primary-model" },
  ),
  "  fallback after empty stream",
);
assert.equal(emptyStreamFallback.calls, 1, "an empty successful stream must activate the fallback");

const emptyCompletionFallback = new RegressionProvider(["fallback after empty completion"]);
const emptyCompletionResult = await new ConnectionFallbackProvider(
  new RegressionProvider([]),
  emptyCompletionFallback,
  fallbackConnection,
  "main",
).chatComplete([{ role: "user", content: "test" }], { model: "primary-model", stream: false });
assert.equal(emptyCompletionResult.content, "fallback after empty completion");
assert.equal(emptyCompletionFallback.calls, 1, "an empty successful completion must activate the fallback");

const whitespaceCompletionFallback = new RegressionProvider(["fallback after whitespace completion"]);
const whitespaceCompletionResult = await new ConnectionFallbackProvider(
  new RegressionProvider([" \n "], undefined, {
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    finishReason: "length",
  }),
  whitespaceCompletionFallback,
  fallbackConnection,
  "main",
).chatComplete([{ role: "user", content: "test" }], { model: "primary-model", stream: false });
assert.equal(whitespaceCompletionResult.content, "fallback after whitespace completion");
assert.equal(whitespaceCompletionFallback.calls, 1, "a whitespace-only completion must activate the fallback");

const partialPrimary = new RegressionProvider(["partial"], new Error("stream interrupted"));
const unusedFallback = new RegressionProvider(["must not be appended"]);
await assert.rejects(
  collectProviderOutput(new ConnectionFallbackProvider(partialPrimary, unusedFallback, fallbackConnection, "main"), {
    model: "primary-model",
  }),
  /stream interrupted/,
);
assert.equal(unusedFallback.calls, 0, "a fallback must not be appended after visible primary output");

const callbackPrimary = new TokenCallbackFailureProvider();
const callbackFallback = new RegressionProvider(["must not replace visible callback output"]);
let callbackOutput = "";
await assert.rejects(
  collectProviderOutput(
    new ConnectionFallbackProvider(callbackPrimary, callbackFallback, fallbackConnection, "main"),
    {
      model: "primary-model",
      onToken: (chunk) => {
        callbackOutput += chunk;
      },
    },
  ),
  /stream interrupted after callback output/,
);
assert.equal(callbackOutput, "visible callback output");
assert.equal(callbackFallback.calls, 0, "a fallback must not replace output already emitted through onToken");

const rejectedNoticeFallback = new RegressionProvider(["fallback survives notification failure"]);
assert.equal(
  await collectProviderOutput(
    new ConnectionFallbackProvider(
      new RegressionProvider([], new Error("primary unavailable")),
      rejectedNoticeFallback,
      fallbackConnection,
      "main",
      async () => {
        throw new Error("toast transport unavailable");
      },
    ),
    { model: "primary-model" },
  ),
  "fallback survives notification failure",
);
assert.equal(rejectedNoticeFallback.calls, 1, "notification failures must not cancel fallback generation");

const abortController = new AbortController();
abortController.abort();
const abortedPrimary = new RegressionProvider([], new Error("cancelled"));
const abortedFallback = new RegressionProvider(["must not run"]);
await assert.rejects(
  collectProviderOutput(new ConnectionFallbackProvider(abortedPrimary, abortedFallback, fallbackConnection, "agents"), {
    model: "primary-model",
    signal: abortController.signal,
  }),
  /cancelled/,
);
assert.equal(abortedFallback.calls, 0, "user cancellation must not trigger a fallback request");

// Issue #4010 — GPT-5.6 (Responses API) streams function-call arguments in
// `response.function_call_arguments.delta` events keyed by `item_id`, not
// `call_id`. Accumulating by call_id left tool arguments empty, so Web Search
// received blank/malformed JSON. Verify the streamed query is reassembled.
{
  let responsesToolRequestBody: Record<string, unknown> | null = null;
  const responsesToolSse = [
    'event: response.output_item.added',
    'data: {"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"web_search","arguments":""}}',
    '',
    'event: response.function_call_arguments.delta',
    'data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","output_index":0,"delta":"{\\"query\\":\\"latest "}',
    '',
    'event: response.function_call_arguments.delta',
    'data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","output_index":0,"delta":"marinara news\\"}"}',
    '',
    'event: response.function_call_arguments.done',
    'data: {"type":"response.function_call_arguments.done","item_id":"fc_1","output_index":0,"arguments":"{\\"query\\":\\"latest marinara news\\"}"}',
    '',
    'event: response.output_item.done',
    'data: {"type":"response.output_item.done","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"web_search"}}',
    '',
    'event: response.completed',
    'data: {"type":"response.completed","response":{"status":"completed"}}',
    '',
    'data: [DONE]',
    '',
  ].join("\n");
  const responsesServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    responsesToolRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(responsesToolSse);
  });
  await new Promise<void>((resolve) => responsesServer.listen(0, "127.0.0.1", resolve));
  try {
    const address = responsesServer.address();
    assert.ok(address && typeof address === "object");
    const provider = new OpenAIProvider(
      `http://127.0.0.1:${address.port}/v1`,
      "test",
      undefined,
      undefined,
      undefined,
      "openai",
      undefined,
      true,
    );
    const result = await provider.chatComplete([{ role: "user", content: "search please" }], {
      model: "gpt-5.6",
      stream: true,
      toolChoice: "required",
      tools: [
        {
          type: "function",
          function: { name: "web_search", description: "Search the web", parameters: { type: "object", properties: { query: { type: "string" } } } },
        },
      ],
    });
    assert.equal(result.toolCalls.length, 1, "GPT-5.6 Responses stream must surface the function call");
    assert.ok(responsesToolRequestBody);
    assert.equal(responsesToolRequestBody.tool_choice, "required");
    assert.equal(typeof responsesToolRequestBody.tool_choice, "string");
    assert.equal(result.toolCalls[0].function.name, "web_search");
    assert.equal(
      result.toolCalls[0].function.arguments,
      '{"query":"latest marinara news"}',
      "streamed function-call arguments must be accumulated by item_id, not dropped",
    );
    assert.equal(result.toolCalls[0].id, "call_1", "the tool call must keep its call_id for function_call_output");
  } finally {
    await new Promise<void>((resolve, reject) => responsesServer.close((error) => (error ? reject(error) : resolve())));
  }
}

// GPT-5.6 may report hidden reasoning tokens while sending the displayable
// reasoning summary only in the final Responses payload. Roleplay persists the
// onThinking callback as `extra.thinking`, so recover that final summary without
// duplicating any summary text that was already streamed.
{
  let responsesReasoningRequestBody: Record<string, unknown> | null = null;
  const streamedThenFinalSse = [
    "event: response.reasoning_summary_text.delta",
    'data: {"type":"response.reasoning_summary_text.delta","delta":"Reviewing "}',
    "",
    "event: response.reasoning_summary_text.done",
    'data: {"type":"response.reasoning_summary_text.done","text":"Reviewing the tools."}',
    "",
    "event: response.reasoning_summary_part.done",
    'data: {"type":"response.reasoning_summary_part.done","part":{"type":"summary_text","text":"Reviewing the tools."}}',
    "",
    "event: response.output_item.done",
    'data: {"type":"response.output_item.done","item":{"id":"rs_2","type":"reasoning","summary":[{"type":"summary_text","text":"Reviewing the tools."}]}}',
    "",
    "event: response.output_text.delta",
    'data: {"type":"response.output_text.delta","delta":"Done."}',
    "",
    "event: response.completed",
    'data: {"type":"response.completed","response":{"status":"completed","output":[{"id":"rs_2","type":"reasoning","summary":[{"type":"summary_text","text":"Reviewing the tools."}]},{"id":"msg_2","type":"message","content":[{"type":"output_text","text":"Done."}]}],"usage":{"input_tokens":10,"output_tokens":8,"total_tokens":18,"output_tokens_details":{"reasoning_tokens":5}}}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const responsesReasoningServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    responsesReasoningRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(streamedThenFinalSse);
  });
  await new Promise<void>((resolve) => responsesReasoningServer.listen(0, "127.0.0.1", resolve));
  try {
    const address = responsesReasoningServer.address();
    assert.ok(address && typeof address === "object");
    const provider = new OpenAIProvider(
      `http://127.0.0.1:${address.port}/v1`,
      "test",
      undefined,
      undefined,
      undefined,
      "openai",
    );

    let streamedThinking = "";
    const completion = await provider.chatComplete([{ role: "user", content: "test" }], {
      model: "gpt-5.6-sol",
      stream: true,
      enableThinking: true,
      captureReasoning: true,
      reasoningEffort: "xhigh",
      onThinking: (chunk) => {
        streamedThinking += chunk;
      },
    });
    assert.equal(completion.content, "Done.");
    assert.equal(
      streamedThinking,
      "Reviewing the tools.",
      "final reasoning items must fill missing streamed text without duplicating it",
    );
    assert.ok(responsesReasoningRequestBody);
    assert.deepEqual(responsesReasoningRequestBody.reasoning, {
      effort: "xhigh",
      summary: "auto",
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      responsesReasoningServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

process.stdout.write("Provider compatibility regression passed.\n");
