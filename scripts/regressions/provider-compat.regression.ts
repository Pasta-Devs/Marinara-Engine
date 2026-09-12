import assert from "node:assert/strict";
import { createServer } from "node:http";
import { logger } from "../../packages/server/src/lib/logger.js";
import {
  findKnownModel,
  isClaudeAdaptiveOnlyNoSamplingModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
} from "../../packages/shared/src/constants/model-lists.js";
import {
  applyGlmThinkingParameters,
  glm53CustomGatewayReasoningEffort,
  glm53ReasoningEffort,
  isGlm53MandatoryReasoningModel,
  isNativeGlmEndpoint,
} from "../../packages/server/src/services/llm/providers/glm-request-compat.js";
import {
  describeEmptyModelResponse,
  sentOutputBudget,
  GENERIC_EMPTY_RESPONSE_MESSAGE,
} from "../../packages/server/src/services/generation/empty-response-reason.js";
import {
  applyAnthropicToolChoice,
  AnthropicProvider,
  supportsAnthropicThinkingDisable,
} from "../../packages/server/src/services/llm/providers/anthropic.provider.js";
import {
  __setSdkForTesting,
  ClaudeSubscriptionProvider,
} from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";
import {
  applyGoogleFunctionCallingMode,
  GoogleProvider,
  resolveGeminiThinkingConfig,
  resolveGoogleFunctionCallingMode,
} from "../../packages/server/src/services/llm/providers/google.provider.js";
import {
  extractOpenAICompatibleContentBlocks,
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
  prepareAssistantReasoningPrefillMessages,
  withConnectionFallbackProvider,
  type FallbackConnection,
  type GenerationProviderOrigin,
} from "../../packages/server/src/services/llm/connection-fallback-provider.js";
import {
  BaseLLMProvider,
  resolveEmbeddingEndpointUrl,
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
import {
  resolveStoredChatOptions,
  supportsAssistantReasoningPrefill,
} from "../../packages/server/src/services/generation/generation-parameters.js";
import { resolveMainGenerationToolChoice } from "../../packages/server/src/services/generation/tool-resolution-runtime.js";
import {
  appendGenerationTailMessages,
  hasProviderMessagePayload,
  parseStoredGenerationParameters,
  type SimpleMessage,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  generateImage,
  imageAdmissionKey,
  resolveNovelAiStyleReferenceSecondaryStrength,
} from "../../packages/server/src/services/image/image-generation.js";
import { resolveImageCaptioningRuntime } from "../../packages/server/src/services/generation/image-captioning-runtime.js";
import { resolveImageConnectionFallback } from "../../packages/server/src/services/generation/media-connection-fallback.js";
import { resolveConnectionImageQuality } from "../../packages/server/src/services/image/image-generation-defaults.js";
import {
  BACKGROUND_CONNECTION_IDLE_MS,
  ConnectionAttemptRejectedError,
  isConnectionAdmissionFailure,
  resetConnectionAdmissionForTests,
  splitConnectionAttemptAcrossFallback,
  tryBackgroundConnection,
  withConnectionAdmissionProvider,
  type ConnectionAdmissionMode,
} from "../../packages/server/src/services/generation/connection-admission.js";

class RegressionProvider extends BaseLLMProvider {
  calls = 0;
  lastOptions: ChatOptions | null = null;
  lastMessages: ChatMessage[] | null = null;

  constructor(
    private readonly chunks: string[],
    private readonly failure?: Error,
    private readonly usage?: LLMUsage,
  ) {
    super("", "");
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    this.calls += 1;
    this.lastMessages = messages;
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

async function collectProviderOutputForMessages(
  provider: BaseLLMProvider,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<string> {
  let output = "";
  for await (const chunk of provider.chat(messages, options)) output += chunk;
  return output;
}

async function collectProviderUsage(provider: BaseLLMProvider, options: ChatOptions): Promise<LLMUsage | void> {
  const stream = provider.chat([{ role: "user", content: "test" }], options);
  while (true) {
    const result = await stream.next();
    if (result.done) return result.value;
    // Consume the provider stream before reading its returned usage.
  }
}

const gatewaySseBody = [
  ": x-omniroute-cache-hit=false",
  'data: {"choices":[{"delta":{},"finish_reason":null}]}',
  'data: {"choices":[{"message":{"content":"recovered final message"},"finish_reason":"stop"}]}',
  "data: [DONE]",
].join("\n");

const embeddingRequests: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
const embeddingServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  embeddingRequests.push({
    headers: request.headers as Record<string, string>,
    body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>,
  });
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [{ embedding: [0.1, 0.2], index: 0 }] }));
});
await new Promise<void>((resolve) => embeddingServer.listen(0, "127.0.0.1", resolve));
try {
  const address = embeddingServer.address();
  assert.ok(address && typeof address === "object");
  const nanoGpt = new OpenAIProvider(
    `http://localhost:${address.port}/v1`,
    "nano-key",
    undefined,
    undefined,
    undefined,
    "nanogpt",
  );
  await nanoGpt.embed(["test"], "text-embedding-model");
  assert.equal(embeddingRequests[0]?.headers.authorization, "Bearer nano-key");
  assert.equal(embeddingRequests[0]?.headers["x-api-key"], "nano-key");

  const openAi = new OpenAIProvider(`http://localhost:${address.port}/v1`, "openai-key");
  await openAi.embed(["test"], "text-embedding-model");
  assert.equal(embeddingRequests[1]?.headers.authorization, "Bearer openai-key");
  assert.equal(embeddingRequests[1]?.headers["x-api-key"], undefined);
} finally {
  await new Promise<void>((resolve, reject) => embeddingServer.close((error) => (error ? reject(error) : resolve())));
}

let nanoGptRequestBody: Record<string, unknown> | null = null;
const nanoGptServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  nanoGptRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "nano response" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => nanoGptServer.listen(0, "127.0.0.1", resolve));
try {
  const address = nanoGptServer.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "nano-key",
    undefined,
    undefined,
    undefined,
    "nanogpt",
  );
  await collectProviderOutput(provider, {
    model: "some-model",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.equal(nanoGptRequestBody?.reasoning_effort, "none");

  nanoGptRequestBody = null;
  await collectProviderOutput(provider, {
    model: "glm-5.3-flash",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.equal(nanoGptRequestBody?.reasoning_effort, "low");
  assert.equal(nanoGptRequestBody?.enable_thinking, true);

  nanoGptRequestBody = null;
  await collectProviderOutput(provider, {
    model: "z-ai/glm-5.3",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.equal(
    nanoGptRequestBody?.reasoning_effort,
    "low",
    "NanoGPT GLM 5.3 agents get low effort, never a disable (#5765)",
  );
  assert.equal(nanoGptRequestBody?.enable_thinking, true);

  // A generic custom connection on a LOCAL inference host keeps the
  // pre-existing "none" for GLM 5.3 (its chat template can really disable
  // thinking); the remote-gateway substitution is pinned on the pure helper
  // below (#5765). Other models keep "none" everywhere.
  const customGateway = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "custom-key",
    undefined,
    undefined,
    undefined,
    "custom",
  );
  nanoGptRequestBody = null;
  await collectProviderOutput(customGateway, {
    model: "z-ai/glm-5.3",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.equal(nanoGptRequestBody?.reasoning_effort, "none");
  assert.deepEqual(nanoGptRequestBody?.chat_template_kwargs, { enable_thinking: false });
  nanoGptRequestBody = null;
  await collectProviderOutput(customGateway, {
    model: "z-ai/glm-5.3",
    stream: false,
    reasoningEffort: "medium",
    enabledParameters: { reasoningEffort: true },
  });
  assert.equal(
    "reasoning_effort" in (nanoGptRequestBody ?? {}),
    false,
    "local custom GLM 5.3 keeps the generic no-effort body for an active effort",
  );
  nanoGptRequestBody = null;
  await collectProviderOutput(customGateway, {
    model: "some-model",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.equal(nanoGptRequestBody?.reasoning_effort, "none");
} finally {
  await new Promise<void>((resolve, reject) => nanoGptServer.close((error) => (error ? reject(error) : resolve())));
}

assert.equal(resolveNovelAiStyleReferenceSecondaryStrength(1), 0);
assert.equal(resolveNovelAiStyleReferenceSecondaryStrength(0.75), 0.25);
assert.equal(resolveNovelAiStyleReferenceSecondaryStrength(0), 1);
assert.equal(resolveEmbeddingEndpointUrl("https://openrouter.ai/api/v1"), "https://openrouter.ai/api/v1/embeddings");
assert.equal(
  resolveEmbeddingEndpointUrl("https://nano-gpt.com/api/v1/embeddings"),
  "https://nano-gpt.com/api/v1/embeddings",
);
assert.equal(
  resolveEmbeddingEndpointUrl("https://example.com/v1/embeddings/?source=memory"),
  "https://example.com/v1/embeddings?source=memory",
);
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
  await new Promise<void>((resolve, reject) => gatewayServer.close((error) => (error ? reject(error) : resolve())));
}

const openRouterCachingRequestBodies: Array<Record<string, unknown>> = [];
const openRouterCachingServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  openRouterCachingRequestBodies.push(body);
  if (body.stream === true) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end('data: {"choices":[{"delta":{"content":"cached"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "cached" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => openRouterCachingServer.listen(0, "127.0.0.1", resolve));
try {
  const address = openRouterCachingServer.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/openrouter.ai/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "openrouter",
  );
  await provider.chatComplete([{ role: "user", content: "cache Gemini" }], {
    model: "google/gemini-3-pro-preview",
    stream: false,
    enableCaching: true,
  });
  await provider.chatComplete([{ role: "user", content: "do not cache" }], {
    model: "google/gemini-3-pro-preview",
    stream: false,
    enableCaching: false,
  });
  for await (const _chunk of provider.chat([{ role: "user", content: "cache suppressed stream" }], {
    model: "google/gemini-3-pro-preview",
    stream: true,
    enableCaching: true,
    suppressModelParameters: true,
  })) {
    // Consume the full SSE response through [DONE].
  }
  await provider.chatComplete([{ role: "user", content: "cache suppressed complete" }], {
    model: "google/gemini-3-pro-preview",
    stream: false,
    enableCaching: true,
    suppressModelParameters: true,
  });
  assert.deepEqual(openRouterCachingRequestBodies[0]?.cache_control, { type: "ephemeral" });
  assert.equal("cache_control" in (openRouterCachingRequestBodies[1] ?? {}), false);
  assert.deepEqual(openRouterCachingRequestBodies[2]?.cache_control, { type: "ephemeral" });
  assert.deepEqual(openRouterCachingRequestBodies[3]?.cache_control, { type: "ephemeral" });
} finally {
  await new Promise<void>((resolve, reject) =>
    openRouterCachingServer.close((error) => (error ? reject(error) : resolve())),
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
  if (customParametersRequestBody.stream === true) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(['data: {"choices":[{"delta":{"content":"configured"}}]}', "", "data: [DONE]", "", ""].join("\n"));
    return;
  }
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
  assert.equal(
    "reasoning_effort" in customParametersRequestBody,
    false,
    "unknown custom models must not receive inherited reasoning effort",
  );
  assert.equal(customParametersRequestBody.verbosity, "low");

  const buildPrefillMessages = (
    assistantPrefill: string,
    assistantReasoningPrefill: string,
    overrides: Partial<Parameters<typeof appendGenerationTailMessages>[1]> = {},
  ) => {
    const messages: SimpleMessage[] = [{ role: "user", content: "Continue." }];
    appendGenerationTailMessages(messages, {
      assistantPrefill,
      assistantReasoningPrefill,
      supportsAssistantReasoningPrefill: true,
      followUpIteration: 0,
      impersonate: false,
      isGoogleProvider: false,
      regenerateUserMessage: null,
      ...overrides,
    });
    return messages;
  };

  const recoveredPrefills = parseStoredGenerationParameters({
    assistantPrefill: "Visible prefix",
    assistantReasoningPrefill: "Reasoning prefix",
    temperature: "malformed",
  });
  assert.equal(recoveredPrefills?.assistantPrefill, "Visible prefix");
  assert.equal(recoveredPrefills?.assistantReasoningPrefill, "Reasoning prefix");

  customParametersRequestBody = null;
  await provider.chatComplete(buildPrefillMessages("Visible prefix  \n", "Reasoning prefix  \n"), {
    model: "kimi-k3",
    stream: false,
  });
  assert.ok(customParametersRequestBody);
  assert.deepEqual((customParametersRequestBody.messages as unknown[]).at(-1), {
    role: "assistant",
    content: "Visible prefix",
    reasoning_content: "Reasoning prefix",
    partial: true,
  });

  assert.equal(supportsAssistantReasoningPrefill("custom"), true);
  assert.equal(supportsAssistantReasoningPrefill("grok_subscription"), false);
  assert.deepEqual(buildPrefillMessages("", "Unsupported reasoning", { supportsAssistantReasoningPrefill: false }), [
    { role: "user", content: "Continue." },
  ]);
  assert.deepEqual(
    buildPrefillMessages("Visible", "Unsupported reasoning", { supportsAssistantReasoningPrefill: false }),
    [
      { role: "user", content: "Continue." },
      { role: "assistant", content: "Visible" },
    ],
  );

  customParametersRequestBody = null;
  let streamedPrefillOutput = "";
  for await (const chunk of provider.chat(buildPrefillMessages("", "Reasoning only"), {
    model: "kimi-k3",
    stream: true,
  })) {
    streamedPrefillOutput += chunk;
  }
  assert.equal(streamedPrefillOutput, "configured");
  assert.ok(customParametersRequestBody);
  assert.deepEqual((customParametersRequestBody.messages as unknown[]).at(-1), {
    role: "assistant",
    content: "",
    reasoning_content: "Reasoning only",
    partial: true,
  });
  const reasoningOnlyMessages = buildPrefillMessages("", "Reasoning only") as ChatMessage[];
  assert.equal(hasProviderMessagePayload(reasoningOnlyMessages.at(-1)!), true);
  assert.deepEqual(prepareAssistantReasoningPrefillMessages(reasoningOnlyMessages, false), [
    { role: "user", content: "Continue." },
  ]);
  assert.deepEqual(
    prepareAssistantReasoningPrefillMessages(
      [
        {
          role: "assistant",
          content: "",
          providerMetadata: { partial: true, reasoning_content: "Reasoning only", trace_id: "keep-me" },
        },
      ],
      false,
    ),
    [{ role: "assistant", content: "", providerMetadata: { trace_id: "keep-me" } }],
  );

  customParametersRequestBody = null;
  await provider.chatComplete(buildPrefillMessages("Visible only", ""), { model: "kimi-k3", stream: false });
  assert.ok(customParametersRequestBody);
  assert.deepEqual((customParametersRequestBody.messages as unknown[]).at(-1), {
    role: "assistant",
    content: "Visible only",
  });

  assert.deepEqual(buildPrefillMessages("Visible", "Reasoning", { followUpIteration: 1 }), [
    { role: "user", content: "Continue." },
  ]);
  assert.deepEqual(buildPrefillMessages("Visible", "Reasoning", { impersonate: true }), [
    { role: "user", content: "Continue." },
  ]);
  assert.deepEqual(
    buildPrefillMessages("Visible", "Reasoning", {
      isGoogleProvider: true,
      regenerateUserMessage: { role: "user", content: "Regenerate this user turn." },
    }).map((message) => message.role),
    ["user", "assistant", "user"],
  );

  customParametersRequestBody = null;
  await provider.chatComplete([{ role: "user", content: "disable reasoning" }], {
    model: "custom-model",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.ok(customParametersRequestBody);
  assert.equal(customParametersRequestBody.reasoning_effort, "none");

  customParametersRequestBody = null;
  await provider.chatComplete([{ role: "user", content: "provider default reasoning" }], {
    model: "gpt-5.6-local",
    stream: false,
    reasoningEffort: "high",
    enabledParameters: { reasoningEffort: false },
  });
  assert.ok(customParametersRequestBody);
  assert.equal("reasoning_effort" in customParametersRequestBody, false);

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
  assert.equal(customParametersRequestBody.reasoning_effort, "high");
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

// A locally hosted OpenAI-compatible server (llama.cpp / Ollama / vLLM / LM Studio)
// is reached through the "custom" provider kind. Disabling reasoning there has to
// arrive as BOTH reasoning_effort and chat_template_kwargs.enable_thinking:
// llama.cpp only skips the thinking pass for the latter, while reasoning_format
// alone would merely hide the thinking and still pay for the tokens.
let localReasoningRequestBody: Record<string, unknown> | null = null;
const localReasoningServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  localReasoningRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => localReasoningServer.listen(0, "127.0.0.1", resolve));
try {
  const address = localReasoningServer.address();
  assert.ok(address && typeof address === "object");
  const localProvider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "custom",
  );

  await localProvider.chatComplete([{ role: "user", content: "no thinking please" }], {
    model: "Qwen3.8-27B-Uncensored-HauhauCS-Aggressive",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
    customParameters: { chat_template_kwargs: { enable_thinking: true, use_jinja: true } },
  });
  assert.ok(localReasoningRequestBody);
  assert.equal(
    localReasoningRequestBody.reasoning_effort,
    "none",
    "local endpoints must receive an explicit reasoning disable",
  );
  assert.deepEqual(
    localReasoningRequestBody.chat_template_kwargs,
    { enable_thinking: false, use_jinja: true },
    "llama.cpp needs enable_thinking=false to win over custom parameters while preserving sibling options",
  );

  // Graded levels stay gated for off-catalog models: llama.cpp accepts them but
  // treats every non-"none" value identically to sending nothing.
  localReasoningRequestBody = null;
  await localProvider.chatComplete([{ role: "user", content: "think hard" }], {
    model: "Qwen3.8-27B-Uncensored-HauhauCS-Aggressive",
    stream: false,
    reasoningEffort: "high",
    enabledParameters: { reasoningEffort: true },
  });
  assert.ok(localReasoningRequestBody);
  assert.equal("reasoning_effort" in localReasoningRequestBody, false);
  assert.equal("chat_template_kwargs" in localReasoningRequestBody, false);

  // The parameter's own send-switch still wins over everything.
  localReasoningRequestBody = null;
  await localProvider.chatComplete([{ role: "user", content: "provider default" }], {
    model: "Qwen3.8-27B-Uncensored-HauhauCS-Aggressive",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: false },
  });
  assert.ok(localReasoningRequestBody);
  assert.equal("reasoning_effort" in localReasoningRequestBody, false);
  assert.equal("chat_template_kwargs" in localReasoningRequestBody, false);
} finally {
  await new Promise<void>((resolve, reject) =>
    localReasoningServer.close((error) => (error ? reject(error) : resolve())),
  );
}

// The enable_thinking addition is a local-endpoint carve-out. A remote custom
// endpoint keeps the previous behaviour: reasoning_effort only, no template kwargs.
for (const localBaseUrl of [
  "http://host.docker.internal:11434/v1",
  "http://host.containers.internal:11434/v1",
  "http://ollama:11434/v1",
  "http://127.0.0.2:11434/v1",
]) {
  const localHostnameProvider = new OpenAIProvider(localBaseUrl, "test", undefined, undefined, undefined, "custom");
  assert.equal(
    (
      localHostnameProvider as unknown as {
        isLocalInferenceEndpoint(): boolean;
      }
    ).isLocalInferenceEndpoint(),
    true,
    `${localBaseUrl} should be recognized as a local inference endpoint`,
  );
}

const previousTrustedPrivateNetworks = process.env.TRUSTED_PRIVATE_NETWORKS;
process.env.TRUSTED_PRIVATE_NETWORKS = "10.0.0.0/8";
try {
  const privateAddressProvider = new OpenAIProvider(
    "http://192.168.50.2:11434/v1",
    "test",
    undefined,
    undefined,
    undefined,
    "custom",
  );
  assert.equal(
    (
      privateAddressProvider as unknown as {
        isLocalInferenceEndpoint(): boolean;
      }
    ).isLocalInferenceEndpoint(),
    true,
    "inference endpoint detection must not depend on the authentication trust-list override",
  );
} finally {
  if (previousTrustedPrivateNetworks === undefined) delete process.env.TRUSTED_PRIVATE_NETWORKS;
  else process.env.TRUSTED_PRIVATE_NETWORKS = previousTrustedPrivateNetworks;
}

let remoteReasoningRequestBody: Record<string, unknown> | null = null;
const remoteReasoningServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  remoteReasoningRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => remoteReasoningServer.listen(0, "127.0.0.1", resolve));
try {
  const address = remoteReasoningServer.address();
  assert.ok(address && typeof address === "object");
  const remoteProvider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "custom",
  );
  // Force the local check to fail while keeping the loopback transport.
  Object.defineProperty(remoteProvider, "isLocalInferenceEndpoint", { value: () => false });
  await remoteProvider.chatComplete([{ role: "user", content: "no thinking please" }], {
    model: "some-remote-model",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  assert.ok(remoteReasoningRequestBody);
  assert.equal(remoteReasoningRequestBody.reasoning_effort, "none");
  assert.equal(
    "chat_template_kwargs" in remoteReasoningRequestBody,
    false,
    "enable_thinking must stay a local-endpoint carve-out",
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    remoteReasoningServer.close((error) => (error ? reject(error) : resolve())),
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
assert.equal(resolveGoogleFunctionCallingMode("required"), "ANY");
assert.equal(resolveGoogleFunctionCallingMode("auto"), "AUTO");
assert.equal(resolveGoogleFunctionCallingMode(undefined), "AUTO");
const googleRequiredBody: Record<string, unknown> = {
  toolConfig: {
    retrievalConfig: { latitude: 1 },
    functionCallingConfig: { allowedFunctionNames: ["lookup"] },
  },
};
applyGoogleFunctionCallingMode(googleRequiredBody, "required");
assert.deepEqual(googleRequiredBody.toolConfig, {
  retrievalConfig: { latitude: 1 },
  functionCallingConfig: { allowedFunctionNames: ["lookup"], mode: "ANY" },
});

const anthropicAdaptiveRequiredBody: Record<string, unknown> = {
  thinking: { type: "adaptive" },
  tool_choice: { disable_parallel_tool_use: true },
};
assert.equal(
  applyAnthropicToolChoice(anthropicAdaptiveRequiredBody, {
    model: "claude-opus-5",
    toolChoice: "required",
    tools: [testToolDefinition],
  }),
  "applied",
);
assert.deepEqual(anthropicAdaptiveRequiredBody.tool_choice, { disable_parallel_tool_use: true, type: "any" });

const anthropicManualThinkingBody: Record<string, unknown> = { thinking: { type: "enabled", budget_tokens: 2048 } };
assert.equal(
  applyAnthropicToolChoice(anthropicManualThinkingBody, {
    model: "claude-sonnet-4",
    toolChoice: "required",
    tools: [testToolDefinition],
  }),
  "manual-thinking",
);
assert.deepEqual(anthropicManualThinkingBody.tool_choice, { type: "auto" });

const anthropicMythosBody: Record<string, unknown> = { thinking: { type: "adaptive" } };
assert.equal(
  applyAnthropicToolChoice(anthropicMythosBody, {
    model: "claude-mythos-5",
    toolChoice: "required",
    tools: [testToolDefinition],
  }),
  "automatic-only",
);
assert.deepEqual(anthropicMythosBody.tool_choice, { type: "auto" });
const anthropicMythos51Body: Record<string, unknown> = { thinking: { type: "adaptive" } };
assert.equal(
  applyAnthropicToolChoice(anthropicMythos51Body, {
    model: "claude-mythos-5-1",
    toolChoice: "required",
    tools: [testToolDefinition],
  }),
  "automatic-only",
);
assert.deepEqual(anthropicMythos51Body.tool_choice, { type: "auto" });
const anthropicFableBody: Record<string, unknown> = { thinking: { type: "adaptive" } };
assert.equal(
  applyAnthropicToolChoice(anthropicFableBody, {
    model: "claude-fable-5",
    toolChoice: "required",
    tools: [testToolDefinition],
  }),
  "applied",
);
assert.deepEqual(anthropicFableBody.tool_choice, { type: "any" });
const anthropicFable51Body: Record<string, unknown> = { thinking: { type: "adaptive" } };
assert.equal(
  applyAnthropicToolChoice(anthropicFable51Body, {
    model: "claude-fable-5-1",
    toolChoice: "required",
    tools: [testToolDefinition],
  }),
  "automatic-only",
);
assert.deepEqual(anthropicFable51Body.tool_choice, { type: "auto" });
const anthropicAutomaticBody: Record<string, unknown> = {
  tool_choice: { type: "any", disable_parallel_tool_use: true },
};
assert.equal(
  applyAnthropicToolChoice(anthropicAutomaticBody, {
    model: "claude-opus-5",
    toolChoice: "auto",
    tools: [testToolDefinition],
  }),
  "none",
);
assert.deepEqual(anthropicAutomaticBody.tool_choice, { type: "auto", disable_parallel_tool_use: true });
assert.equal(supportsAnthropicThinkingDisable("claude-sonnet-5"), true);
assert.equal(supportsAnthropicThinkingDisable("claude-opus-5"), true);
assert.equal(supportsAnthropicThinkingDisable("claude-fable-5"), false);
assert.equal(isClaudeAdaptiveOnlyNoSamplingModel("claude-opus-5"), true);
assert.equal(isClaudeAdaptiveOnlyNoSamplingModel("claude-fable-5-1"), true);
assert.equal(supportsAnthropicThinkingDisable("claude-fable-5-1"), false);
assert.equal(shouldSuppressUnknownModelParameters("anthropic", "claude-fable-5-1"), false);
const fable51 = findKnownModel("anthropic", "claude-fable-5-1");
assert.equal(fable51?.context, 1_000_000);
assert.equal(fable51?.maxOutput, 128_000);
assert.equal(isClaudeAdaptiveOnlyNoSamplingModel("claude-mythos-5-1"), true);
assert.equal(supportsAnthropicThinkingDisable("claude-mythos-5-1"), false);
assert.equal(shouldSuppressUnknownModelParameters("anthropic", "claude-mythos-5-1"), false);
const mythos51 = findKnownModel("anthropic", "claude-mythos-5-1");
assert.equal(mythos51?.context, 1_000_000);
assert.equal(mythos51?.maxOutput, 128_000);
const opus5 = findKnownModel("anthropic", "claude-opus-5");
assert.equal(opus5?.context, 1_000_000);
assert.equal(opus5?.maxOutput, 128_000);
const subscriptionOpus5 = findKnownModel("claude_subscription", "claude-opus-5");
assert.equal(subscriptionOpus5?.context, 1_000_000);
assert.equal(subscriptionOpus5?.maxOutput, 128_000);
assert.equal(findKnownModel("nanogpt", "deepseek-v4-pro")?.maxOutput, 384_000);
assert.equal(findKnownModel("openrouter", "deepseek/deepseek-v4-flash")?.maxOutput, 384_000);
assert.equal(findKnownModel("openrouter", "xiaomi/mimo-v2.5-pro")?.maxOutput, 128_000);
assert.equal(findKnownModel("custom", "mimo-v2.5-pro")?.context, 1_000_000);
assert.equal(findKnownModel("nanogpt", "glm-5.1")?.maxOutput, 128_000);
assert.equal(findKnownModel("openrouter", "moonshotai/kimi-k2.6")?.maxOutput, 32_768);
assert.equal(findKnownModel("nanogpt", "kimi-k3")?.maxOutput, 131_072);
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
        usage: { input_tokens: 10, output_tokens: 6, cache_read_input_tokens: 500, cache_creation_input_tokens: 100 },
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
    assert.deepEqual(
      await collectProviderUsage(provider, { model: "claude-opus-5", stream: false }),
      {
        promptTokens: 10,
        completionTokens: 6,
        totalTokens: 16,
        cachedPromptTokens: 500,
        cacheWritePromptTokens: 100,
        finishReason: "end_turn",
      },
      "Anthropic non-stream usage must preserve prompt-cache counters",
    );

    const streamingAnthropicServer = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        [
          'data: {"type":"message_start","message":{"usage":{"input_tokens":0,"output_tokens":0,"cache_read_input_tokens":700,"cache_creation_input_tokens":50}}}',
          'data: {"type":"content_block_start","content_block":{"type":"text"}}',
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Cached stream"}}',
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":0}}',
          'data: {"type":"message_stop"}',
          "",
        ].join("\n"),
      );
    });
    await new Promise<void>((resolve) => streamingAnthropicServer.listen(0, "127.0.0.1", resolve));
    try {
      const streamingAddress = streamingAnthropicServer.address();
      assert.ok(streamingAddress && typeof streamingAddress === "object");
      assert.deepEqual(
        await collectProviderUsage(new AnthropicProvider(`http://127.0.0.1:${streamingAddress.port}`, "test"), {
          model: "claude-opus-5",
          stream: true,
        }),
        {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cachedPromptTokens: 700,
          cacheWritePromptTokens: 50,
          finishReason: "end_turn",
        },
        "Anthropic streamed usage must preserve cache-only prompt counters",
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        streamingAnthropicServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
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
    const disabledBody = anthropicRequestBodies[2];
    assert.ok(disabledBody);
    assert.deepEqual(disabledBody.thinking, { type: "disabled" });
    assert.equal("output_config" in disabledBody, false);
    assert.equal("temperature" in disabledBody, false);
    assert.equal("top_k" in disabledBody, false);
    assert.equal("top_p" in disabledBody, false);

    await collectProviderOutput(provider, {
      model: "claude-fable-5-1",
      stream: false,
      maxTokens: 128_000,
      captureReasoning: true,
      reasoningEffort: "max",
    });
    // .at(-1), not a hardcoded index: two branches each appended a request
    // block here with fixed indices and collided on merge - this request is
    // whatever the block above just sent, i.e. always the newest body.
    const fableMaxOutputBody = anthropicRequestBodies.at(-1);
    assert.ok(fableMaxOutputBody);
    assert.equal(fableMaxOutputBody.max_tokens, 128_000);
  } finally {
    await new Promise<void>((resolve, reject) => anthropicServer.close((error) => (error ? reject(error) : resolve())));
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

    assert.equal(
      await collectProviderOutputForMessages(
        provider,
        [
          { role: "system", content: "Keep the caller-owned system prompt." },
          { role: "user", content: "test" },
        ],
        {
          model: "claude-opus-5",
          stream: true,
          customParameters: {
            fallbackModel: "claude-sonnet-4-6",
            maxBudgetUsd: 2,
            tools: { type: "preset", preset: "claude_code" },
            skills: "all",
            maxTurns: 20,
            allowedTools: ["Bash"],
            mcpServers: { unsafe: { command: "/bin/false" } },
            pathToClaudeCodeExecutable: "/bin/false",
            extraArgs: { "dangerously-skip-permissions": null },
            permissionMode: "acceptEdits",
            settingSources: ["user", "project", "local"],
            settings: "/tmp/untrusted-settings.json",
            env: { ENABLE_CLAUDEAI_MCP_SERVERS: "true", UNTRUSTED_VALUE: "present" },
            cwd: "/tmp",
            systemPrompt: { type: "preset", preset: "claude_code" },
          },
        },
      ),
      "Subscription reply",
    );
    assert.ok(subscriptionOptions);
    assert.equal(subscriptionOptions.fallbackModel, "claude-sonnet-4-6");
    assert.equal(subscriptionOptions.maxBudgetUsd, 2);
    assert.deepEqual(subscriptionOptions.tools, []);
    assert.deepEqual(subscriptionOptions.skills, []);
    assert.equal(subscriptionOptions.maxTurns, 1);
    assert.equal("allowedTools" in subscriptionOptions, false);
    assert.equal("mcpServers" in subscriptionOptions, false);
    assert.equal("pathToClaudeCodeExecutable" in subscriptionOptions, false);
    assert.equal("extraArgs" in subscriptionOptions, false);
    assert.equal(subscriptionOptions.permissionMode, "bypassPermissions");
    assert.deepEqual(subscriptionOptions.settingSources, []);
    assert.deepEqual(subscriptionOptions.settings, { fastMode: false });
    assert.equal(subscriptionOptions.cwd, undefined);
    assert.equal(subscriptionOptions.systemPrompt, "Keep the caller-owned system prompt.");
    assert.equal((subscriptionOptions.env as Record<string, unknown>).ENABLE_CLAUDEAI_MCP_SERVERS, "false");
    assert.equal("UNTRUSTED_VALUE" in (subscriptionOptions.env as Record<string, unknown>), false);
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

  openRouterRequestBody = null;
  await collectProviderOutput(provider, {
    model: "z-ai/glm-5.3-flash",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  const mandatoryGlmOpenRouterBody = openRouterRequestBody as Record<string, unknown>;
  assert.ok(mandatoryGlmOpenRouterBody);
  assert.equal(
    "reasoning" in mandatoryGlmOpenRouterBody,
    false,
    "GLM 5.3 Flash must keep OpenRouter's mandatory reasoning default",
  );

  openRouterRequestBody = null;
  await collectProviderOutput(provider, {
    model: "z-ai/glm-5.3",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: true },
  });
  const mandatoryGlm53OpenRouterBody = openRouterRequestBody as Record<string, unknown>;
  assert.ok(mandatoryGlm53OpenRouterBody);
  assert.equal(
    "reasoning" in mandatoryGlm53OpenRouterBody,
    false,
    "GLM 5.3 (non-Flash) must keep OpenRouter's mandatory reasoning default (#5765)",
  );
} finally {
  await new Promise<void>((resolve, reject) => openRouterServer.close((error) => (error ? reject(error) : resolve())));
}

const strictSchemaFormat = {
  type: "json_schema" as const,
  name: "provider_contract",
  strict: true,
  schema: {
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
    additionalProperties: false,
  },
};
assert.deepEqual(normalizeOpenAIChatCompletionsResponseFormat(strictSchemaFormat), {
  type: "json_schema",
  json_schema: {
    name: "provider_contract",
    schema: strictSchemaFormat.schema,
    strict: true,
  },
});
assert.deepEqual(normalizeOpenAIChatCompletionsResponseFormat({ type: "json_object" }), {
  type: "json_object",
});
assert.equal(normalizeOpenAIChatCompletionsResponseFormat(undefined), undefined);
const nestedStrictSchemaFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "nested_provider_contract",
    schema: strictSchemaFormat.schema,
    strict: true,
  },
};
assert.equal(normalizeOpenAIChatCompletionsResponseFormat(nestedStrictSchemaFormat), nestedStrictSchemaFormat);
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

assert.equal(isGlm53MandatoryReasoningModel("z-ai/glm-5.3-flash"), true);
assert.equal(isGlm53MandatoryReasoningModel("z-ai/glm-5.3-flash:free"), true);
assert.equal(isGlm53MandatoryReasoningModel("z-ai/glm-5.3"), true);
assert.equal(isGlm53MandatoryReasoningModel("glm-5.3:free"), true);
assert.equal(isGlm53MandatoryReasoningModel("GLM-5.3"), true);
assert.equal(isGlm53MandatoryReasoningModel("z-ai/glm-5.2"), false);
assert.equal(isGlm53MandatoryReasoningModel("glm-5.30"), false);
assert.equal(glm53ReasoningEffort(undefined), null);
assert.equal(glm53ReasoningEffort("none"), "low");
assert.equal(glm53ReasoningEffort("minimal"), "low");
assert.equal(glm53ReasoningEffort("low"), "low");
assert.equal(glm53ReasoningEffort("medium"), "high");
assert.equal(glm53ReasoningEffort("high"), "high");
assert.equal(glm53ReasoningEffort("xhigh"), "max");
assert.equal(glm53ReasoningEffort("max"), "max");
assert.equal(glm53CustomGatewayReasoningEffort("z-ai/glm-5.3", "https://gateway.example.com/v1", "none"), "low");
assert.equal(glm53CustomGatewayReasoningEffort("glm-5.3", "https://gateway.example.com/v1", "low"), "low");
assert.equal(glm53CustomGatewayReasoningEffort("glm-5.3", "https://gateway.example.com/v1", "medium"), "high");
assert.equal(glm53CustomGatewayReasoningEffort("glm-5.3", "https://gateway.example.com/v1", "high"), "high");
assert.equal(glm53CustomGatewayReasoningEffort("glm-5.3", "https://gateway.example.com/v1", "max"), "max");
assert.equal(
  glm53CustomGatewayReasoningEffort("glm-5.3", "https://gateway.example.com/v1", undefined),
  null,
  "no configured effort stays omitted on remote custom gateways",
);
assert.equal(
  glm53CustomGatewayReasoningEffort("z-ai/glm-5.3", "http://127.0.0.1:8080/v1", "none"),
  null,
  "local inference hosts keep the explicit disable for GLM 5.3",
);
assert.equal(glm53CustomGatewayReasoningEffort("z-ai/glm-5.3", "http://192.168.1.20:11434/v1", "none"), null);
assert.equal(glm53CustomGatewayReasoningEffort("some-model", "https://gateway.example.com/v1", "none"), null);
assert.equal(glm53CustomGatewayReasoningEffort("z-ai/glm-5.2", "https://gateway.example.com/v1", "none"), null);

// Native Z.AI provider (#5963): the shared resolver promotes a Maximum preset
// to "max" for GLM 5.2 / 5.3 instead of lowering it to "high" on the way to
// glm53ReasoningEffort. Only the named provider is promoted -- the resolver has
// no base URL, so a Custom connection to api.z.ai keeps its previous behavior.
assert.equal(resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.3", reasoningEffort: "maximum" }), "max");
assert.equal(
  resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.3-flash", reasoningEffort: "maximum" }),
  "max",
);
assert.equal(resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.2", reasoningEffort: "maximum" }), "max");
assert.equal(resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.1", reasoningEffort: "maximum" }), "high");
assert.equal(resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.3", reasoningEffort: "high" }), "high");
assert.equal(resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.3", reasoningEffort: "low" }), "low");
assert.equal(resolveProviderReasoningEffort({ provider: "zai", model: "glm-5.3", reasoningEffort: undefined }), null);
assert.equal(
  resolveProviderReasoningEffort({ provider: "custom", model: "glm-5.3", reasoningEffort: "maximum" }),
  "high",
  "a Custom connection is not promoted by the resolver",
);
assert.equal(findKnownModel("zai", "glm-5.3")?.context, 1000000);
assert.equal(findKnownModel("zai", "glm-5.3-flash")?.maxOutput, 128000);

const zaiGlm53MaxBody: Record<string, unknown> = {};
applyGlmThinkingParameters(zaiGlm53MaxBody, {
  model: "glm-5.3",
  baseUrl: "https://api.z.ai/api/paas/v4",
  providerKind: "zai",
  reasoningEffort: "max",
});
assert.deepEqual(zaiGlm53MaxBody, { thinking: { type: "enabled" }, reasoning_effort: "max" });

const zaiGlm53DefaultBody: Record<string, unknown> = {};
applyGlmThinkingParameters(zaiGlm53DefaultBody, {
  model: "glm-5.3-flash",
  baseUrl: "https://api.z.ai/api/paas/v4",
  providerKind: "zai",
  reasoningEffort: undefined,
});
assert.deepEqual(
  zaiGlm53DefaultBody,
  { thinking: { type: "enabled" } },
  "no configured effort leaves Z.AI's own default (max) in place",
);

// An empty reply says what the provider reported (#5963).
assert.equal(
  describeEmptyModelResponse({
    finishReason: "length",
    usage: { completionTokens: 8192, completionReasoningTokens: 8190 },
    maxTokens: 8192,
    hadThinking: true,
  }),
  "The model used its whole output budget (8192 of 8192 output tokens, 8190 of them reasoning) before writing any visible text. Raise Max Tokens or lower Reasoning Effort, then try again.",
);
assert.equal(
  describeEmptyModelResponse({ finishReason: "length", hadThinking: false }),
  "The model used its whole output budget before writing any visible text. Raise Max Tokens or lower Reasoning Effort, then try again.",
  "finish_reason alone is enough to name the cap",
);
assert.equal(
  describeEmptyModelResponse({
    finishReason: "stop",
    usage: { completionTokens: 4096, completionReasoningTokens: 4000 },
    maxTokens: 4096,
    hadThinking: true,
  }),
  "The model used its whole output budget (4096 of 4096 output tokens, 4000 of them reasoning) before writing any visible text. Raise Max Tokens or lower Reasoning Effort, then try again.",
  "completion at the cap with hidden thinking is the cap even when finish says stop",
);
assert.equal(
  describeEmptyModelResponse({ finishReason: "sensitive", hadThinking: true }),
  'The provider stopped the reply for content policy (finish reason "sensitive") and returned no text.',
);
assert.equal(
  describeEmptyModelResponse({
    finishReason: "stop",
    usage: { completionTokens: 700, completionReasoningTokens: 700 },
    maxTokens: 8192,
    hadThinking: true,
  }),
  'The model finished reasoning (700 reasoning tokens, finish reason "stop") but returned no visible text. Try again, or lower Reasoning Effort.',
);
assert.equal(
  describeEmptyModelResponse({ finishReason: "stop", hadThinking: false }),
  'The AI returned an empty response (finish reason "stop"). Try sending your message again.',
);
assert.equal(describeEmptyModelResponse({ hadThinking: false }), GENERIC_EMPTY_RESPONSE_MESSAGE);
for (const finishReason of ["sensitive", "model_context_window_exceeded"]) {
  assert.equal(
    describeEmptyModelResponse({ finishReason, hadThinking: true, usage: { completionTokens: 16 }, maxTokens: 16 }),
    describeEmptyModelResponse({ finishReason, hadThinking: false }),
    "explicit provider stop reasons take priority over token-budget inference",
  );
}
// The quoted budget is the one the provider sent: the route's number capped by the
// connection override, as BaseLLMProvider.applyMaxTokensCap does on the way out.
// Seen live 2026-09-11: override 16, route 4096, wire max_tokens=16, message said "16 of 4096".
assert.equal(sentOutputBudget(4096, 16), 16);
assert.equal(sentOutputBudget(4096, null), 4096);
assert.equal(sentOutputBudget(4096, 0), 4096, "a zero override is no override");
assert.equal(sentOutputBudget(undefined, 16), undefined, "no route budget stays unknown");
assert.equal(
  describeEmptyModelResponse({
    finishReason: "length",
    usage: { completionTokens: 16, completionReasoningTokens: 16 },
    maxTokens: sentOutputBudget(4096, 16),
    hadThinking: true,
  }),
  "The model used its whole output budget (16 of 16 output tokens, 16 of them reasoning) before writing any visible text. Raise Max Tokens or lower Reasoning Effort, then try again.",
);

const nanogptMandatoryGlmBody: Record<string, unknown> = {};
applyGlmThinkingParameters(nanogptMandatoryGlmBody, {
  model: "glm-5.3-flash",
  baseUrl: "https://nano-gpt.com/api/v1",
  providerKind: "nanogpt",
  reasoningEffort: "none",
});
assert.deepEqual(
  nanogptMandatoryGlmBody,
  { enable_thinking: true, reasoning_effort: "low" },
  "NanoGPT mandatory-reasoning GLM models must not receive a disable request",
);

const nativeGlm53DisabledBody: Record<string, unknown> = {};
applyGlmThinkingParameters(nativeGlm53DisabledBody, {
  model: "glm-5.3-flash",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  providerKind: "custom",
  reasoningEffort: "none",
});
assert.deepEqual(
  nativeGlm53DisabledBody,
  { thinking: { type: "enabled" }, reasoning_effort: "low" },
  "Native Z.AI GLM 5.3 cannot disable thinking; reasoning off becomes the lightest accepted level (#5765)",
);

const nativeGlm53DefaultBody: Record<string, unknown> = {};
applyGlmThinkingParameters(nativeGlm53DefaultBody, {
  model: "glm-5.3",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  providerKind: "custom",
});
assert.deepEqual(
  nativeGlm53DefaultBody,
  { thinking: { type: "enabled" } },
  "Native Z.AI GLM 5.3 with no effort configured leaves the provider default in place",
);

const nativeGlm53MediumBody: Record<string, unknown> = {};
applyGlmThinkingParameters(nativeGlm53MediumBody, {
  model: "glm-5.3",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  providerKind: "custom",
  reasoningEffort: "medium",
});
assert.deepEqual(
  nativeGlm53MediumBody,
  { thinking: { type: "enabled" }, reasoning_effort: "high" },
  "Native Z.AI GLM 5.3 only accepts low/high/max",
);

const nanogptGlm53Body: Record<string, unknown> = {};
applyGlmThinkingParameters(nanogptGlm53Body, {
  model: "z-ai/glm-5.3",
  baseUrl: "https://nano-gpt.com/api/v1",
  providerKind: "nanogpt",
  reasoningEffort: "none",
});
assert.deepEqual(
  nanogptGlm53Body,
  { enable_thinking: true, reasoning_effort: "low" },
  "NanoGPT GLM 5.3 (non-Flash) must not receive a disable request either (#5765)",
);

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
assert.equal(
  resolveMainGenerationToolChoice({ chatMetadata: { forceToolCall: true }, enableChatTools: true, round: 0 }),
  "required",
);
assert.equal(
  resolveMainGenerationToolChoice({ chatMetadata: { forceToolCall: "true" }, enableChatTools: true, round: 0 }),
  "required",
);
assert.equal(
  resolveMainGenerationToolChoice({ chatMetadata: { forceToolCall: true }, enableChatTools: true, round: 1 }),
  "auto",
);
assert.equal(
  resolveMainGenerationToolChoice({ chatMetadata: { forceToolCall: false }, enableChatTools: true, round: 0 }),
  "auto",
);
// Force To Call is a Function Calling panel setting and the panel hides it while tool use is
// off, so a chat can hold one the user cannot see or clear. It must not reach a tool the
// engine attached on its own.
assert.equal(
  resolveMainGenerationToolChoice({ chatMetadata: { forceToolCall: true }, enableChatTools: false, round: 0 }),
  "auto",
);
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

const fallbackReasoningMessages: ChatMessage[] = [
  { role: "user", content: "Continue." },
  {
    role: "assistant",
    content: "",
    providerMetadata: { reasoning_content: "Fallback reasoning prefix", partial: true },
  },
];
const unsupportedPrimary = new RegressionProvider([], new Error("primary unavailable"));
const supportedReasoningFallback = new RegressionProvider(["fallback response"]);
assert.equal(
  await collectProviderOutputForMessages(
    new ConnectionFallbackProvider(
      unsupportedPrimary,
      supportedReasoningFallback,
      fallbackConnection,
      "main",
      undefined,
      undefined,
      undefined,
      false,
      true,
    ),
    fallbackReasoningMessages,
    { model: "primary-model" },
  ),
  "fallback response",
);
assert.deepEqual(unsupportedPrimary.lastMessages, [{ role: "user", content: "Continue." }]);
assert.deepEqual(supportedReasoningFallback.lastMessages, fallbackReasoningMessages);

const supportedReasoningPrimary = new RegressionProvider([], new Error("primary unavailable"));
const unsupportedFallback = new RegressionProvider(["fallback response"]);
await collectProviderOutputForMessages(
  new ConnectionFallbackProvider(
    supportedReasoningPrimary,
    unsupportedFallback,
    fallbackConnection,
    "main",
    undefined,
    undefined,
    undefined,
    true,
    false,
  ),
  fallbackReasoningMessages,
  { model: "primary-model" },
);
assert.deepEqual(supportedReasoningPrimary.lastMessages, fallbackReasoningMessages);
assert.deepEqual(unsupportedFallback.lastMessages, [{ role: "user", content: "Continue." }]);

resetConnectionAdmissionForTests();
let releasePrimaryCall!: () => void;
const primaryCallHeld = new Promise<void>((resolve) => {
  releasePrimaryCall = resolve;
});
class HeldProvider extends BaseLLMProvider {
  started!: () => void;
  readonly startedPromise = new Promise<void>((resolve) => {
    this.started = resolve;
  });

  constructor(
    private readonly held: Promise<void>,
    private readonly failure?: Error,
  ) {
    super("", "");
  }

  async *chat(): AsyncGenerator<string, LLMUsage | void, unknown> {
    this.started();
    await this.held;
    if (this.failure) throw this.failure;
    yield "held response";
  }
}
const heldPrimary = new HeldProvider(primaryCallHeld, new Error("primary unavailable"));
const admittedPrimary = withConnectionAdmissionProvider(heldPrimary, "primary-connection");
const primaryRun = collectProviderOutput(admittedPrimary, { model: "primary-model" });
await heldPrimary.startedPromise;
assert.equal(tryBackgroundConnection("primary-connection", new Date()).acquired, false);
const unrelatedFallbackAdmission = tryBackgroundConnection("fallback-connection", new Date());
assert.equal(unrelatedFallbackAdmission.acquired, true, "primary work must not occupy the fallback connection");
if (unrelatedFallbackAdmission.acquired) unrelatedFallbackAdmission.release();
releasePrimaryCall();
await assert.rejects(primaryRun, /primary unavailable/);
const releasedPrimaryAdmission = tryBackgroundConnection(
  "primary-connection",
  new Date(Date.now() + BACKGROUND_CONNECTION_IDLE_MS),
);
assert.equal(releasedPrimaryAdmission.acquired, true, "a failed primary call must release its foreground slot");
if (releasedPrimaryAdmission.acquired) releasedPrimaryAdmission.release();

let releaseFallbackCall!: () => void;
const fallbackCallHeld = new Promise<void>((resolve) => {
  releaseFallbackCall = resolve;
});
const heldFallback = new HeldProvider(fallbackCallHeld);
const admittedFallback = withConnectionAdmissionProvider(heldFallback, "fallback-connection");
const fallbackRun = collectProviderOutput(admittedFallback, { model: "fallback-model" });
await heldFallback.startedPromise;
assert.equal(tryBackgroundConnection("fallback-connection", new Date()).acquired, false);
const unrelatedPrimaryAdmission = tryBackgroundConnection("other-primary-connection", new Date());
assert.equal(unrelatedPrimaryAdmission.acquired, true, "fallback work must not occupy a primary connection");
if (unrelatedPrimaryAdmission.acquired) unrelatedPrimaryAdmission.release();
releaseFallbackCall();
assert.equal(await fallbackRun, "held response");
const releasedFallbackAdmission = tryBackgroundConnection(
  "fallback-connection",
  new Date(Date.now() + BACKGROUND_CONNECTION_IDLE_MS),
);
assert.equal(releasedFallbackAdmission.acquired, true, "a completed call must release its foreground slot");
if (releasedFallbackAdmission.acquired) releasedFallbackAdmission.release();

// A consumer that stops reading mid-stream must not strand the primary connection's
// foreground slot: the fallback provider drains the primary manually, so an early return
// has to be forwarded explicitly or background work is locked out until a restart.
resetConnectionAdmissionForTests();
class EndlessProvider extends BaseLLMProvider {
  constructor() {
    super("", "");
  }

  async *chat(): AsyncGenerator<string, LLMUsage | void, unknown> {
    while (true) yield "chunk";
  }
}
const abandonedProvider = new ConnectionFallbackProvider(
  withConnectionAdmissionProvider(new EndlessProvider(), "abandoned-connection"),
  new RegressionProvider(["unused fallback"]),
  fallbackConnection,
  "main",
);
const abandonedStream = abandonedProvider.chat([{ role: "user", content: "hi" }], { model: "abandoned-model" });
assert.equal((await abandonedStream.next()).value, "chunk");
await abandonedStream.return(undefined);
assert.equal(
  tryBackgroundConnection("abandoned-connection", new Date(Date.now() + BACKGROUND_CONNECTION_IDLE_MS)).acquired,
  true,
  "abandoning the stream must release the primary connection's foreground slot",
);

// A background claim hook books one scheduled attempt against a quota. Falling back is a retry
// of that same attempt on another connection, so the hook must not run a second time.
resetConnectionAdmissionForTests();
let claimCount = 0;
let fellBackToSecondConnection = false;
const claimingMode: ConnectionAdmissionMode = {
  kind: "background",
  beforeAttempt: () => {
    claimCount += 1;
    return () => undefined;
  },
};
const doubleClaimProvider = withConnectionFallbackProvider({
  primary: new RegressionProvider([], new Error("primary unavailable")),
  primaryConnectionId: "claim-primary",
  fallbackConnection,
  fallbackBaseUrl: "https://fallback.example",
  category: "main",
  onFallback: async () => {
    fellBackToSecondConnection = true;
  },
  admissionMode: claimingMode,
});
await collectProviderOutput(doubleClaimProvider, { model: "claim-model" }).catch(() => undefined);
assert.equal(claimCount, 1, "falling back must not book a second background claim");
// `claimCount === 1` also holds when the fallback is never wired and the primary simply throws,
// so pin the retry path itself. The fallback here points at an unreachable host, so its own
// request failing is expected — reaching it at all is what this proves.
assert.equal(
  fellBackToSecondConnection,
  true,
  "the claim assertion is only meaningful if the fallback connection was actually reached",
);

// One logical attempt spans the primary and its fallback, so its outcome must be reported once,
// after the chain settles — a successful fallback is a completed attempt, not a failed one.
for (const [label, fallbackProvider, expected] of [
  ["successful fallback", new RegressionProvider(["fallback response"]), "completed"],
  ["total failure", new RegressionProvider([], new Error("fallback unavailable")), "failed"],
] as const) {
  resetConnectionAdmissionForTests();
  const outcomes: string[] = [];
  let bookings = 0;
  const split = splitConnectionAttemptAcrossFallback({
    kind: "background",
    beforeAttempt: () => {
      bookings += 1;
      return (outcome) => {
        outcomes.push(outcome);
      };
    },
  });
  const chained = new ConnectionFallbackProvider(
    withConnectionAdmissionProvider(
      new RegressionProvider([], new Error("primary unavailable")),
      "chain-primary",
      split.primaryMode,
    ),
    withConnectionAdmissionProvider(fallbackProvider, "chain-fallback", split.fallbackMode),
    fallbackConnection,
    "main",
    async () => undefined,
    split.settle,
  );
  await collectProviderOutput(chained, { model: "chain-model" }).catch(() => undefined);
  assert.equal(bookings, 1, `${label}: the logical attempt must be booked exactly once`);
  assert.deepEqual(outcomes, [expected], `${label}: the attempt must be finalized once as ${expected}`);
}

// A consumer that walks away after reading usable tokens still got what the attempt was for, so
// closing the stream early must settle it completed rather than failed.
{
  resetConnectionAdmissionForTests();
  const earlyCloseOutcomes: string[] = [];
  const split = splitConnectionAttemptAcrossFallback({
    kind: "background",
    beforeAttempt: () => (outcome) => {
      earlyCloseOutcomes.push(outcome);
    },
  });
  const earlyCloseChain = new ConnectionFallbackProvider(
    withConnectionAdmissionProvider(
      new RegressionProvider(["first useful chunk", "second chunk"]),
      "early-close-primary",
      split.primaryMode,
    ),
    new RegressionProvider(["unused fallback"]),
    fallbackConnection,
    "main",
    async () => undefined,
    split.settle,
  );
  const earlyCloseStream = earlyCloseChain.chat([{ role: "user", content: "hi" }], { model: "early-close" });
  assert.equal((await earlyCloseStream.next()).value, "first useful chunk");
  await earlyCloseStream.return(undefined);
  assert.deepEqual(
    earlyCloseOutcomes,
    ["completed"],
    "a stream closed after delivering usable output must settle the attempt completed",
  );
  assert.equal(
    tryBackgroundConnection("early-close-primary", new Date(Date.now() + BACKGROUND_CONNECTION_IDLE_MS)).acquired,
    true,
    "closing the chain early must still release the primary's slot",
  );
}

// A stream closed before any usable token is a failed attempt: nothing was delivered. (A stream
// closed before its first `next()` never runs its body at all, so it never books or admits
// anything — this case has to advance once to reach the accounting.)
{
  resetConnectionAdmissionForTests();
  const noOutputOutcomes: string[] = [];
  const split = splitConnectionAttemptAcrossFallback({
    kind: "background",
    beforeAttempt: () => (outcome) => {
      noOutputOutcomes.push(outcome);
    },
  });
  const noOutputChain = new ConnectionFallbackProvider(
    withConnectionAdmissionProvider(
      new RegressionProvider(["   ", "useful but never read"]),
      "no-output-primary",
      split.primaryMode,
    ),
    new RegressionProvider(["unused fallback"]),
    fallbackConnection,
    "main",
    async () => undefined,
    split.settle,
  );
  const noOutputStream = noOutputChain.chat([{ role: "user", content: "hi" }], { model: "no-output" });
  assert.equal((await noOutputStream.next()).value, "   ", "whitespace is not usable output");
  await noOutputStream.return(undefined);
  assert.deepEqual(noOutputOutcomes, ["failed"], "closing before any token must settle the attempt failed");
}

// A leg's own result is not the attempt's result. An empty-but-successful primary is a completed
// leg inside an attempt that delivered nothing, and if the fallback is then refused admission the
// rejection surfaces between legs, where no leg finalizer runs at all. The chain must still be
// recorded failed.
for (const drive of [
  (provider: BaseLLMProvider) => collectProviderOutput(provider, { model: "empty-primary" }),
  (provider: BaseLLMProvider) => provider.chatComplete([{ role: "user", content: "x" }], { model: "empty-primary" }),
]) {
  resetConnectionAdmissionForTests();
  const outcomes: string[] = [];
  const split = splitConnectionAttemptAcrossFallback({
    kind: "background",
    beforeAttempt: () => (outcome) => {
      outcomes.push(outcome);
    },
  });
  const emptyPrimaryChain = new ConnectionFallbackProvider(
    withConnectionAdmissionProvider(new RegressionProvider([""]), "empty-primary-connection", split.primaryMode),
    withConnectionAdmissionProvider(new RegressionProvider(["never reached"]), "busy-fallback-connection", {
      kind: "background",
      beforeAttempt: () => {
        throw new Error("fallback quota exhausted");
      },
    }),
    fallbackConnection,
    "main",
    async () => undefined,
    split.settle,
  );
  await assert.rejects(drive(emptyPrimaryChain), (error) => isConnectionAdmissionFailure(error));
  assert.deepEqual(
    outcomes,
    ["failed"],
    "an empty primary followed by a refused fallback must not be recorded as a completed attempt",
  );
}

// A late accounting failure arrives after the stream's tokens already reached the consumer,
// so it must be logged rather than thrown over a generation that actually succeeded.
resetConnectionAdmissionForTests();
const lateFailureStream = withConnectionAdmissionProvider(
  new RegressionProvider(["usable output"]),
  "late-finalize-connection",
  {
    kind: "background",
    beforeAttempt: () => () => {
      throw new Error("accounting backend unavailable");
    },
  },
).chat([{ role: "user", content: "hi" }], { model: "late-model" });
let streamedOutput = "";
for await (const chunk of lateFailureStream) streamedOutput += chunk;
assert.equal(streamedOutput, "usable output", "a completed stream must survive a finalizer failure");

// RunPod connections share one API base URL and pick the physical endpoint with a separate
// id, so the key has to carry that id or two independent endpoints contend for one slot.
assert.notEqual(
  imageAdmissionKey("https://api.runpod.ai/v2", "runpod_comfyui", "abc123"),
  imageAdmissionKey("https://api.runpod.ai/v2", "runpod_comfyui", "def456"),
  "RunPod endpoints sharing a base URL must not share an admission key",
);
assert.equal(
  imageAdmissionKey("https://api.runpod.ai/v2", "runpod_comfyui", "abc123"),
  imageAdmissionKey("https://api.runpod.ai/v2", "runpod_comfyui", "  abc123  "),
  "endpoint ids must be compared after trimming",
);
// An image fallback is the same logical attempt on another endpoint, so a successful fallback
// must be recorded completed rather than leaving the primary's failure as the attempt's result.
const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const nanoGPTRequests: Array<Record<string, unknown>> = [];
const nanoGPTImageServer = createServer(async (request, response) => {
  if (request.url === "/result.png") {
    response.writeHead(200, { "content-type": "image/png" });
    response.end(Buffer.from(onePixelPng, "base64"));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  nanoGPTRequests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
  const address = nanoGPTImageServer.address();
  assert.ok(address && typeof address === "object");
  response.writeHead(200, { "content-type": "application/json" });
  if (nanoGPTRequests.length === 1) {
    response.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${address.port}/result.png` }] }));
  } else if (nanoGPTRequests.length === 2) {
    response.end(JSON.stringify({ data: [{ b64_json: `data:image/png;base64,${onePixelPng}` }] }));
  } else {
    response.end(JSON.stringify({ data: [{ revised_prompt: "missing output" }] }));
  }
});
await new Promise<void>((resolve) => nanoGPTImageServer.listen(0, "127.0.0.1", resolve));
try {
  const address = nanoGPTImageServer.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const oversizedReferences = [
    Buffer.alloc(1_700_000, 1).toString("base64"),
    Buffer.alloc(1_700_000, 2).toString("base64"),
    Buffer.alloc(1_700_000, 3).toString("base64"),
  ];

  const urlResult = await generateImage("nanogpt", baseUrl, "nanogpt-secret", "nanogpt", {
    prompt: "a moonlit laboratory",
    model: "qwen-image",
    referenceImages: oversizedReferences,
    allowLocalUrls: true,
  });
  assert.equal(urlResult.base64, onePixelPng);
  assert.equal(nanoGPTRequests[0]?.response_format, "url");
  assert.equal(typeof nanoGPTRequests[0]?.imageDataUrl, "string");
  assert.equal(nanoGPTRequests[0]?.imageDataUrls, undefined);
  assert.ok(
    Buffer.byteLength(JSON.stringify(nanoGPTRequests[0]), "utf8") <= 4 * 1024 * 1024,
    "NanoGPT reference requests must stay within the documented 4 MB upload limit",
  );

  const fallbackResult = await generateImage("nanogpt", baseUrl, "nanogpt-secret", "nanogpt", {
    prompt: "a base64 fallback",
    model: "qwen-image",
    allowLocalUrls: true,
  });
  assert.equal(fallbackResult.base64, onePixelPng);
  assert.equal(fallbackResult.mimeType, "image/png");

  await assert.rejects(
    generateImage("nanogpt", baseUrl, "nanogpt-secret", "nanogpt", {
      prompt: "an invalid response",
      model: "qwen-image",
      allowLocalUrls: true,
    }),
    /No image data in NanoGPT response \(fields: revised_prompt\)/u,
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    nanoGPTImageServer.close((error) => (error ? reject(error) : resolve())),
  );
}

let arliRequest:
  | { url: string; authorization: string | undefined; contentType: string | undefined; body: Record<string, unknown> }
  | undefined;
const arliImageServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  arliRequest = {
    url: request.url ?? "",
    authorization: request.headers.authorization,
    contentType: request.headers["content-type"],
    body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>,
  };
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ images: [onePixelPng] }));
});
await new Promise<void>((resolve) => arliImageServer.listen(0, "127.0.0.1", resolve));
try {
  const address = arliImageServer.address();
  assert.ok(address && typeof address === "object");
  const imageResult = await generateImage("arli", `http://127.0.0.1:${address.port}/v1`, "arli-secret", "arli", {
    prompt: "a red laboratory",
    negativePrompt: "blurry",
    model: "Arli/FluxModel",
    width: 768,
    height: 512,
    allowLocalUrls: true,
  });
  assert.equal(imageResult.base64, onePixelPng);
  assert.equal(arliRequest?.url, "/v1/txt2img");
  assert.equal(arliRequest?.authorization, "Bearer arli-secret");
  assert.equal(arliRequest?.contentType, "application/json");
  assert.equal(arliRequest?.body.sd_model_checkpoint, "Arli/FluxModel");
  assert.equal(arliRequest?.body.prompt, "a red laboratory");
  assert.equal(arliRequest?.body.negative_prompt, "blurry");
  assert.equal(arliRequest?.body.width, 768);
  assert.equal(arliRequest?.body.height, 512);

  const imageEditResult = await generateImage("arli", `http://127.0.0.1:${address.port}/v1`, "arli-secret", "arli", {
    prompt: "add blue light",
    model: "Arli/FluxModel",
    referenceImage: `data:image/png;base64,${onePixelPng}`,
    allowLocalUrls: true,
  });
  assert.equal(imageEditResult.base64, onePixelPng);
  assert.equal(arliRequest?.url, "/v1/img2img");
  assert.deepEqual(arliRequest?.body.init_images, [onePixelPng]);
} finally {
  await new Promise<void>((resolve, reject) => arliImageServer.close((error) => (error ? reject(error) : resolve())));
}

assert.equal(resolveConnectionImageQuality({ imageGenerationQuality: "high" }), "high");
assert.equal(resolveConnectionImageQuality({ imageGenerationQuality: "unsupported" }), "auto");
assert.equal(resolveConnectionImageQuality({}), "auto");

const openAIImageRequests: Array<{ contentType: string; body: string }> = [];
const openAIImageServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  openAIImageRequests.push({
    contentType: request.headers["content-type"] ?? "",
    body: Buffer.concat(chunks).toString("utf8"),
  });
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [{ b64_json: onePixelPng }] }));
});
await new Promise<void>((resolve) => openAIImageServer.listen(0, "127.0.0.1", resolve));
try {
  const address = openAIImageServer.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;

  await generateImage("openai", baseUrl, "openai-secret", "openai", {
    prompt: "a careful experiment",
    model: "gpt-image-2",
    quality: "high",
    allowLocalUrls: true,
  });
  const generationBody = JSON.parse(openAIImageRequests[0]?.body ?? "{}") as Record<string, unknown>;
  assert.equal(generationBody.quality, "high", "GPT Image generations must send the connection quality");

  await generateImage("openai", baseUrl, "openai-secret", "openai", {
    prompt: "add cyan lighting",
    model: "gpt-image-2",
    quality: "medium",
    referenceImage: `data:image/png;base64,${onePixelPng}`,
    allowLocalUrls: true,
  });
  assert.match(openAIImageRequests[1]?.contentType ?? "", /^multipart\/form-data;/u);
  assert.match(
    openAIImageRequests[1]?.body ?? "",
    /name="quality"\r\n\r\nmedium/u,
    "GPT Image edits must send the connection quality",
  );

  await generateImage("openai", baseUrl, "openai-secret", "openai", {
    prompt: "a legacy illustration",
    model: "dall-e-3",
    quality: "high",
    allowLocalUrls: true,
  });
  const legacyBody = JSON.parse(openAIImageRequests[2]?.body ?? "{}") as Record<string, unknown>;
  assert.equal(legacyBody.quality, undefined, "non-GPT Image models must not receive GPT Image quality");
} finally {
  await new Promise<void>((resolve, reject) => openAIImageServer.close((error) => (error ? reject(error) : resolve())));
}

const failingImageServer = createServer((_request, response) => {
  response.writeHead(500, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "primary image backend down" }));
});
const resolvedProviderFallback = await resolveImageConnectionFallback(
  {
    getFallbackForImageGeneration: async () => ({
      id: "novelai-fallback",
      name: "NovelAI fallback",
      provider: "novelai",
      model: "nai-diffusion-4-5-full",
      baseUrl: "https://image.novelai.net",
      imageGenerationSource: "novelai",
      imageService: "novelai",
    }),
  },
  "primary-image-connection",
);
assert.equal(resolvedProviderFallback?.imageGenerationSource, "novelai");
assert.equal(resolvedProviderFallback?.imageService, "novelai");
assert.equal(resolvedProviderFallback?.model, "nai-diffusion-4-5-full");
assert.equal(resolvedProviderFallback?.baseUrl, "https://image.novelai.net");
let fallbackImageRequest: Record<string, unknown> | undefined;
const succeedingImageServer = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  fallbackImageRequest = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ images: [onePixelPng] }));
});
await new Promise<void>((resolve) => failingImageServer.listen(0, "127.0.0.1", resolve));
await new Promise<void>((resolve) => succeedingImageServer.listen(0, "127.0.0.1", resolve));
try {
  const failingAddress = failingImageServer.address();
  const succeedingAddress = succeedingImageServer.address();
  assert.ok(failingAddress && typeof failingAddress === "object");
  assert.ok(succeedingAddress && typeof succeedingAddress === "object");
  resetConnectionAdmissionForTests();
  const imageOutcomes: string[] = [];
  let imageBookings = 0;
  const imageResult = await generateImage(
    "openai",
    `http://127.0.0.1:${failingAddress.port}/v1`,
    "primary-key",
    "openai",
    {
      prompt: "a test image",
      model: "test-image-model",
      allowLocalUrls: true,
      onFallback: async () => undefined,
      admissionMode: {
        kind: "background",
        beforeAttempt: () => {
          imageBookings += 1;
          return (outcome) => {
            imageOutcomes.push(outcome);
          };
        },
      },
      fallback: {
        connectionId: "image-fallback-connection",
        connectionName: "Image Fallback",
        provider: "arli",
        source: "arli",
        baseUrl: `http://127.0.0.1:${succeedingAddress.port}/v1`,
        apiKey: "fallback-key",
        serviceHint: "arli",
        model: "Arli/FallbackModel",
        prompt: "a provider-specific fallback laboratory",
        negativePrompt: "fallback blur",
      },
    },
  );
  assert.equal(imageResult.base64, onePixelPng, "the image fallback must supply the returned image");
  assert.equal(imageResult.effectiveConnection?.connectionId, "image-fallback-connection");
  assert.equal(imageResult.effectiveConnection?.provider, "arli");
  assert.equal(imageResult.effectivePrompt, "a provider-specific fallback laboratory");
  assert.equal(imageResult.effectiveNegativePrompt, "fallback blur");
  assert.equal(fallbackImageRequest?.prompt, "a provider-specific fallback laboratory");
  assert.equal(fallbackImageRequest?.negative_prompt, "fallback blur");
  assert.equal(fallbackImageRequest?.sd_model_checkpoint, "Arli/FallbackModel");
  assert.equal(imageBookings, 1, "the image attempt must be booked exactly once across the chain");
  assert.deepEqual(imageOutcomes, ["completed"], "a successful image fallback must be recorded completed");
} finally {
  await new Promise<void>((resolve, reject) =>
    failingImageServer.close((error) => (error ? reject(error) : resolve())),
  );
  await new Promise<void>((resolve, reject) =>
    succeedingImageServer.close((error) => (error ? reject(error) : resolve())),
  );
}

// The origin and the `/v1` form are two spellings of one OpenAI-compatible endpoint; they must
// share an admission slot, while genuinely different hosts must not.
assert.equal(
  imageAdmissionKey("https://images.example.com", "openai"),
  imageAdmissionKey("https://images.example.com/v1", "openai"),
  "OpenAI root and /v1 base URLs must resolve to one admission key",
);
assert.equal(
  imageAdmissionKey("https://images.example.com/v1/images/generations", "openai"),
  imageAdmissionKey("https://images.example.com/v1", "openai"),
  "a full OpenAI endpoint URL must key the same as its /v1 base",
);
assert.notEqual(
  imageAdmissionKey("https://images.example.com/v1", "openai"),
  imageAdmissionKey("https://other.example.com/v1", "openai"),
  "different OpenAI hosts must keep separate admission keys",
);
assert.equal(
  imageAdmissionKey("http://127.0.0.1:8188", "comfyui"),
  "http://127.0.0.1:8188",
  "backends whose base URL is the physical target keep the bare URL as their key",
);
// A stale endpoint id on an imported/copied non-RunPod connection must not split one
// physical endpoint into two admission slots.
assert.equal(
  imageAdmissionKey("http://127.0.0.1:8188", "comfyui", "abc123"),
  imageAdmissionKey("http://127.0.0.1:8188", "comfyui"),
  "non-RunPod backends must ignore a leftover endpoint id",
);
assert.equal(
  imageAdmissionKey("http://127.0.0.1:7860", "automatic1111", "def456"),
  "http://127.0.0.1:7860",
  "A1111 admission keys stay bare regardless of endpoint id",
);

let backgroundAttempts = 0;
const backgroundOutcomes: string[] = [];
const admittedRepeated = withConnectionAdmissionProvider(new RegressionProvider(["ok"]), "background-connection", {
  kind: "background",
  beforeAttempt: () => {
    backgroundAttempts += 1;
    return (outcome) => {
      backgroundOutcomes.push(outcome);
    };
  },
});
await admittedRepeated.chatComplete([{ role: "user", content: "first" }], { model: "model" });
await admittedRepeated.chatComplete([{ role: "user", content: "correction" }], { model: "model" });
assert.equal(backgroundAttempts, 2, "each physical correction/retry call must claim separately");
assert.deepEqual(backgroundOutcomes, ["completed", "completed"]);

const rejectedAttempt = withConnectionAdmissionProvider(new RegressionProvider(["unused"]), "rejected-connection", {
  kind: "background",
  beforeAttempt: () => {
    throw new Error("attempt budget exhausted");
  },
});
await assert.rejects(
  rejectedAttempt.chatComplete([{ role: "user", content: "test" }], { model: "model" }),
  (error) =>
    error instanceof ConnectionAttemptRejectedError &&
    error.cause instanceof Error &&
    /budget exhausted/.test(error.cause.message),
);
// A rejected admission attempt is not a provider failure, so both fallback catch sites must
// rethrow it untouched instead of retrying the same logical attempt on another connection.
for (const drive of [
  (provider: BaseLLMProvider) => collectProviderOutput(provider, { model: "primary-model" }),
  (provider: BaseLLMProvider) => provider.chatComplete([{ role: "user", content: "test" }], { model: "primary-model" }),
]) {
  const skippedFallback = new RegressionProvider(["must not run"]);
  await assert.rejects(
    drive(
      new ConnectionFallbackProvider(
        withConnectionAdmissionProvider(new RegressionProvider(["unused"]), "rejected-primary", {
          kind: "background",
          beforeAttempt: () => {
            throw new Error("attempt budget exhausted");
          },
        }),
        skippedFallback,
        fallbackConnection,
        "main",
      ),
    ),
    (error) =>
      isConnectionAdmissionFailure(error) &&
      error instanceof ConnectionAttemptRejectedError &&
      error.cause instanceof Error &&
      /budget exhausted/.test(error.cause.message),
  );
  assert.equal(skippedFallback.calls, 0, "an admission rejection must not activate the fallback connection");
}

const primaryFailure = new RegressionProvider([], new Error("primary unavailable"));
const successfulFallback = new RegressionProvider(["fallback response"]);
const usedProviderOrigins: GenerationProviderOrigin[] = [];
const fallbackProvider = new ConnectionFallbackProvider(
  primaryFailure,
  successfulFallback,
  fallbackConnection,
  "main",
  undefined,
  undefined,
  (origin) => usedProviderOrigins.push(origin),
);
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
assert.deepEqual(usedProviderOrigins, [{ kind: "fallback", provider: "custom", model: "fallback-model" }]);
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
  collectProviderOutput(new ConnectionFallbackProvider(callbackPrimary, callbackFallback, fallbackConnection, "main"), {
    model: "primary-model",
    onToken: (chunk) => {
      callbackOutput += chunk;
    },
  }),
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
    "event: response.output_item.added",
    'data: {"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"web_search","arguments":""}}',
    "",
    "event: response.function_call_arguments.delta",
    'data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","output_index":0,"delta":"{\\"query\\":\\"latest "}',
    "",
    "event: response.function_call_arguments.delta",
    'data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","output_index":0,"delta":"marinara news\\"}"}',
    "",
    "event: response.function_call_arguments.done",
    'data: {"type":"response.function_call_arguments.done","item_id":"fc_1","output_index":0,"arguments":"{\\"query\\":\\"latest marinara news\\"}"}',
    "",
    "event: response.output_item.done",
    'data: {"type":"response.output_item.done","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"web_search"}}',
    "",
    "event: response.completed",
    'data: {"type":"response.completed","response":{"status":"completed"}}',
    "",
    "data: [DONE]",
    "",
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
          function: {
            name: "web_search",
            description: "Search the web",
            parameters: { type: "object", properties: { query: { type: "string" } } },
          },
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

    responsesReasoningRequestBody = null;
    await provider.chatComplete([{ role: "user", content: "test provider default" }], {
      model: "gpt-5.6-sol",
      stream: true,
      reasoningEffort: "xhigh",
      enabledParameters: { reasoningEffort: false },
    });
    assert.ok(responsesReasoningRequestBody);
    assert.equal(
      "reasoning" in responsesReasoningRequestBody,
      false,
      "disabled Responses reasoning must leave the provider default untouched",
    );
    assert.equal(
      "include" in responsesReasoningRequestBody,
      false,
      "disabled Responses reasoning must not request encrypted reasoning output",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      responsesReasoningServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

// A background refresh captions its prompt images on the same connection it then generates with.
// Booking that captioning call as foreground stamps the connection foreground-active, and the
// refresh's own generation is refused for the whole idle window — every scheduled run, forever,
// while manual (foreground) refreshes keep working. Issue #4642.
{
  const captionServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "a caption" }, finish_reason: "stop" }] }));
  });
  await new Promise<void>((resolve) => captionServer.listen(0, "127.0.0.1", resolve));
  try {
    const address = captionServer.address();
    assert.ok(address && typeof address === "object");
    const captionConnection = {
      id: "noodle-generation-connection",
      provider: "custom",
      apiKey: "test",
      model: "caption-model",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
    };
    // A captioning connection the caller never admitted is separate background work and must
    // stay accounted; only the caller's own connection is exempt.
    const separateCaptionConnection = { ...captionConnection, id: "separate-caption-connection" };
    const connectionsStub = {
      listRandomPool: async () => [],
      getWithKey: async (id: string) =>
        id === captionConnection.id
          ? captionConnection
          : id === separateCaptionConnection.id
            ? separateCaptionConnection
            : null,
      getFallbackForAgents: async () => null,
    };

    for (const [mode, expectedAdmission] of [
      [{ kind: "background" } as ConnectionAdmissionMode, true],
      [{ kind: "foreground" } as ConnectionAdmissionMode, false],
    ] as const) {
      resetConnectionAdmissionForTests();
      const runtime = await resolveImageCaptioningRuntime({
        chatMeta: { imageCaptioningEnabled: true, imageCaptioningConnectionId: captionConnection.id },
        fallbackConnectionId: captionConnection.id,
        connections: connectionsStub,
        admissionMode: mode,
      });
      assert.ok(runtime.provider, "captioning runtime must resolve a provider");
      await runtime.provider.chatComplete([{ role: "user", content: "describe" }], { model: "caption-model" });
      assert.equal(
        tryBackgroundConnection(captionConnection.id, new Date()).acquired,
        expectedAdmission,
        `captioning under ${mode.kind} admission must ${expectedAdmission ? "leave" : "block"} the connection's background slot`,
      );
    }

    resetConnectionAdmissionForTests();
    const separateRuntime = await resolveImageCaptioningRuntime({
      chatMeta: { imageCaptioningEnabled: true, imageCaptioningConnectionId: separateCaptionConnection.id },
      fallbackConnectionId: captionConnection.id,
      connections: connectionsStub,
      admissionMode: { kind: "background" },
    });
    assert.ok(separateRuntime.provider, "captioning runtime must resolve a provider");
    const separateCaption = separateRuntime.provider.chatComplete([{ role: "user", content: "describe" }], {
      model: "caption-model",
    });
    assert.equal(
      tryBackgroundConnection(separateCaptionConnection.id, new Date()).acquired,
      false,
      "captioning on a connection the caller never admitted must still hold its own background slot",
    );
    await separateCaption;
    assert.equal(
      tryBackgroundConnection(captionConnection.id, new Date()).acquired,
      true,
      "captioning elsewhere must not consume the caller's generation connection",
    );
  } finally {
    resetConnectionAdmissionForTests();
    await new Promise<void>((resolve, reject) => captionServer.close((error) => (error ? reject(error) : resolve())));
  }
}

assert.deepEqual(
  extractOpenAICompatibleContentBlocks([
    { type: "thinking", thinking: "Checking the card." },
    { type: "text", text: "I will use the card tool." },
    { type: "tool_use", id: "call-card", name: "read_character", input: { id: "char-1" } },
  ]),
  {
    text: "I will use the card tool.",
    thinking: "Checking the card.",
    anonymousToolCallIds: [],
    toolCalls: [
      {
        id: "call-card",
        type: "function",
        function: { name: "read_character", arguments: '{"id":"char-1"}' },
      },
    ],
  },
  "OpenAI-compatible Anthropic content blocks must preserve tool_use calls",
);

let anonymousContentBlockToolCallIndex = 0;
const nextAnonymousContentBlockToolCallId = () => `content_block_tool_${++anonymousContentBlockToolCallIndex}`;
const firstAnonymousBlocks = extractOpenAICompatibleContentBlocks(
  [{ type: "tool_use", name: "read_character", input: { id: "char-1" } }],
  nextAnonymousContentBlockToolCallId,
);
const secondAnonymousBlocks = extractOpenAICompatibleContentBlocks(
  [
    { type: "tool_use", id: "   ", name: "read_persona", input: { id: "persona-1" } },
    { type: "tool_use", name: "   ", input: {} },
  ],
  nextAnonymousContentBlockToolCallId,
);
assert.deepEqual(
  [...(firstAnonymousBlocks?.toolCalls ?? []), ...(secondAnonymousBlocks?.toolCalls ?? [])].map((call) => call.id),
  ["content_block_tool_1", "content_block_tool_2"],
  "anonymous content-block tool calls must retain unique IDs across streamed chunks",
);

const contentBlockToolSse = [
  `data: ${JSON.stringify({
    choices: [{ delta: { content: [{ type: "tool_use", name: "read_character", input: { id: "char-1" } }] } }],
  })}`,
  "",
  `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          content: [
            { type: "tool_use", name: "read_persona", input: { id: "persona-1" } },
            { type: "tool_use", name: "   ", input: {} },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  })}`,
  "",
  "data: [DONE]",
  "",
].join("\n");
const mixedToolSse = [
  `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "call-native",
              function: { name: "read_character", arguments: '{"id":"char-1"}' },
            },
          ],
        },
      },
    ],
  })}`,
  "",
  `data: ${JSON.stringify({
    choices: [
      {
        delta: { content: [{ type: "tool_use", name: "read_persona", input: { id: "persona-1" } }] },
        finish_reason: "tool_calls",
      },
    ],
  })}`,
  "",
  "data: [DONE]",
  "",
].join("\n");
let streamedToolResponse = contentBlockToolSse;
const contentBlockToolServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(streamedToolResponse);
});
await new Promise<void>((resolve) => contentBlockToolServer.listen(0, "127.0.0.1", resolve));
try {
  const address = contentBlockToolServer.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "test",
    undefined,
    undefined,
    undefined,
    "custom",
    undefined,
    true,
  );
  const result = await provider.chatComplete([{ role: "user", content: "read both cards" }], {
    model: "custom-model",
    stream: true,
    tools: [
      {
        type: "function",
        function: { name: "read_character", description: "Read a character", parameters: { type: "object" } },
      },
      {
        type: "function",
        function: { name: "read_persona", description: "Read a persona", parameters: { type: "object" } },
      },
    ],
  });
  assert.deepEqual(
    result.toolCalls.map((call) => [call.id, call.function.name]),
    [
      ["content_block_tool_1", "read_character"],
      ["content_block_tool_2", "read_persona"],
    ],
    "separate anonymous content-block stream chunks must preserve both tool calls in order",
  );
  streamedToolResponse = mixedToolSse;
  const mixedResult = await provider.chatComplete([{ role: "user", content: "read the character" }], {
    model: "custom-model",
    stream: true,
    tools: [
      {
        type: "function",
        function: { name: "read_character", description: "Read a character", parameters: { type: "object" } },
      },
    ],
  });
  assert.deepEqual(
    mixedResult.toolCalls.map((call) => [call.id, call.function.name]),
    [["call-native", "read_character"]],
    "native streamed tool calls must take precedence over content-block fallbacks regardless of chunk order",
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    contentBlockToolServer.close((error) => (error ? reject(error) : resolve())),
  );
}

// ── Gemini and Anthropic stream while tools are attached ──
// Both adapters used to buffer the whole generation the moment a tool was attached: Gemini
// hardwired the `:generateContent` endpoint, Anthropic hardcoded `stream: false`. The tool
// loop never asked for that — it passes onToken and no `stream` key — so a tools turn showed
// nothing until the round finished. These cases pin the streamed shape of both adapters.
{
  const rollDiceTool = {
    type: "function" as const,
    function: {
      name: "roll_dice",
      description: "Roll dice",
      parameters: { type: "object", properties: { notation: { type: "string" } } },
    },
  };
  const sseFrames = (frames: Array<Record<string, unknown>>) =>
    frames.map((frame) => `data: ${JSON.stringify(frame)}\n`).join("\n");

  // #5904: the official endpoint streams reasoning in both generation paths.
  // Keep the tail withheld until the token sink runs, so buffering cannot pass.
  const originalGoogleFetch = globalThis.fetch;
  try {
    for (const withTools of [false, true]) {
      let streamController: ReadableStreamDefaultController<Uint8Array>;
      const encoder = new TextEncoder();
      const thoughts: string[] = [];
      const tokens: string[] = [];
      let savedParts: unknown[] | undefined;
      globalThis.fetch = async (input) => {
        assert.match(
          String(input),
          /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:streamGenerateContent\?alt=sse$/u,
        );
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
              controller.enqueue(
                encoder.encode(
                  sseFrames([
                    { candidates: [{ content: { parts: [{ text: "Thinking", thought: true }] } }] },
                    { candidates: [{ content: { parts: [{ text: "Answer" }] } }] },
                  ]),
                ),
              );
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      };
      const google = new GoogleProvider("https://generativelanguage.googleapis.com", "test");
      const result = await google.chatComplete([{ role: "user", content: "reason" }], {
        model: "gemini-2.5-flash",
        stream: true,
        reasoningEffort: "high",
        signal: AbortSignal.timeout(3000),
        onResponseParts: (parts) => {
          savedParts = parts;
        },
        ...(withTools ? { tools: [rollDiceTool] } : {}),
        onThinking: (chunk) => {
          thoughts.push(chunk);
        },
        onToken: (chunk) => {
          tokens.push(chunk);
          streamController.enqueue(
            encoder.encode(
              sseFrames([
                {
                  candidates: [
                    {
                      content: {
                        parts: [
                          { thoughtSignature: "thought-signature" },
                          ...(withTools
                            ? [
                                {
                                  functionCall: { name: "roll_dice", args: { notation: "1d20" } },
                                  thoughtSignature: "call-signature",
                                },
                              ]
                            : []),
                        ],
                      },
                      finishReason: "STOP",
                    },
                  ],
                },
              ]),
            ),
          );
          streamController.close();
        },
      });
      assert.deepEqual(thoughts, ["Thinking"]);
      assert.deepEqual(tokens, ["Answer"]);
      assert.equal(result.content, "Answer");
      assert.match(JSON.stringify(result.providerMetadata?.geminiParts ?? savedParts), /thought-signature/u);
      if (withTools) {
        assert.equal(result.toolCalls[0]?.function.name, "roll_dice");
        assert.match(JSON.stringify(result.providerMetadata?.geminiParts), /call-signature/u);
      }
    }
    let cancelled = false;
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                sseFrames([{ candidates: [{ content: { parts: [{ text: "First chunk" }] } }] }]),
              ),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      );
    const iterator = new GoogleProvider("https://generativelanguage.googleapis.com", "test").chat(
      [{ role: "user", content: "reason" }],
      { model: "gemini-2.5-flash", reasoningEffort: "high", stream: true, signal: AbortSignal.timeout(3000) },
    );
    assert.equal((await iterator.next()).value, "First chunk");
    await iterator.return(undefined);
    assert.equal(cancelled, true, "Stopping a thinking stream must release its still-open response body");
  } finally {
    globalThis.fetch = originalGoogleFetch;
  }

  // Explicit debug logs the final serialized provider body, but not auth headers.
  const priorWarn = logger.warn;
  const priorLevel = logger.level;
  const priorDebugAgents = process.env.DEBUG_AGENTS;
  const promptLogs: unknown[][] = [];
  let sentBody: unknown;
  const loggingServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    sentBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "content-type": "text/event-stream" });
    const frames =
      request.url === "/messages"
        ? [
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Done" } },
            { type: "message_stop" },
          ]
        : [{ candidates: [{ content: { parts: [{ text: "Done" }] }, finishReason: "STOP" }] }];
    response.end(sseFrames(frames));
  });
  await new Promise<void>((resolve) => loggingServer.listen(0, "127.0.0.1", resolve));
  try {
    logger.level = "warn";
    logger.warn = ((...args: unknown[]) => {
      promptLogs.push(args);
    }) as typeof logger.warn;
    const address = loggingServer.address();
    if (!address || typeof address === "string") throw new Error("Prompt logging fixture did not bind");
    for (const Provider of [AnthropicProvider, GoogleProvider]) {
      const provider = new Provider(`http://127.0.0.1:${address.port}`, "synthetic-auth-marker");
      for (const debug of ["off", "ui", "agents"]) {
        process.env.DEBUG_AGENTS = debug === "agents" ? "true" : "false";
        promptLogs.length = 0;
        await provider.chatComplete([{ role: "user", content: "Synthetic tool prompt" }], {
          model: Provider === AnthropicProvider ? "claude-sonnet-4-20250514" : "gemini-2.0-flash",
          tools: [rollDiceTool],
          debugMode: debug === "ui",
          customParameters: { temperature: 0.42 },
          onToken: () => {},
        });
        assert.equal(promptLogs.length, debug === "off" ? 0 : 1);
        if (debug !== "off") {
          assert.deepEqual(promptLogs[0]![1], sentBody, "debug logs include final parameter/tool shaping");
          assert.ok(!JSON.stringify(promptLogs).includes("synthetic-auth-marker"), "auth headers are not prompt data");
        }
      }
    }
  } finally {
    logger.warn = priorWarn;
    logger.level = priorLevel;
    if (priorDebugAgents === undefined) delete process.env.DEBUG_AGENTS;
    else process.env.DEBUG_AGENTS = priorDebugAgents;
    await new Promise<void>((resolve) => loggingServer.close(() => resolve()));
  }

  // Keep the upstream body open: errors and cancellation must release it without
  // waiting for the provider/proxy to finish sending the turn.
  for (const providerName of ["Gemini", "Anthropic"] as const) {
    for (const outcome of ["provider-error", "sink-error", "abort"] as const) {
      let upstreamClosed = false;
      let closed!: () => void;
      const closeReceived = new Promise<void>((resolve) => {
        closed = resolve;
      });
      const server = createServer(async (request, response) => {
        for await (const _chunk of request) {
          /* Drain the request before replying. */
        }
        response.on("close", () => {
          upstreamClosed = true;
          closed();
        });
        response.writeHead(200, { "content-type": "text/event-stream" });
        const frames =
          outcome === "provider-error"
            ? [{ type: "error", error: { type: "api_error", message: "upstream failed" } }]
            : providerName === "Gemini"
              ? [
                  {
                    candidates: [
                      {
                        content: {
                          parts: [
                            { functionCall: { name: "roll_dice", args: { notation: "1d20" } } },
                            { text: "Partial turn." },
                          ],
                        },
                      },
                    ],
                  },
                ]
              : [
                  {
                    type: "content_block_start",
                    index: 0,
                    content_block: { type: "tool_use", id: "toolu_abort", name: "roll_dice" },
                  },
                  {
                    type: "content_block_delta",
                    index: 0,
                    delta: { type: "input_json_delta", partial_json: '{"notation":"1d20"}' },
                  },
                  { type: "content_block_start", index: 1, content_block: { type: "text" } },
                  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Partial turn." } },
                ];
        response.write(sseFrames(frames));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const controller = new AbortController();
      let closeTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const address = server.address();
        assert.ok(address && typeof address === "object");
        const baseUrl = `http://127.0.0.1:${address.port}`;
        const provider =
          providerName === "Gemini" ? new GoogleProvider(baseUrl, "test") : new AnthropicProvider(baseUrl, "test");
        const completion = provider.chatComplete([{ role: "user", content: "roll" }], {
          model: providerName === "Gemini" ? "gemini-2.0-flash" : "claude-opus-5",
          tools: [rollDiceTool],
          signal: controller.signal,
          onToken: async () => {
            if (outcome === "sink-error") throw new Error("sink failed");
            controller.abort();
          },
        });
        if (outcome === "abort") {
          const result = await completion;
          assert.equal(
            result.finishReason,
            "abort",
            `${providerName}: stopping a partial tool turn must not report success`,
          );
          assert.equal(result.content, "Partial turn.");
        } else {
          await assert.rejects(completion, outcome === "sink-error" ? /sink failed/ : /upstream failed/);
        }
        await Promise.race([
          closeReceived,
          new Promise<void>((resolve) => {
            closeTimeout = setTimeout(resolve, 1000);
          }),
        ]);
        assert.ok(upstreamClosed, `${providerName}: ${outcome} must cancel the still-open upstream stream`);
      } finally {
        clearTimeout(closeTimeout);
        controller.abort();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      }
    }
  }

  // ── Gemini ──
  let geminiStreamFrames: Array<Record<string, unknown>> = [];
  const geminiBufferedBody = {
    candidates: [
      {
        content: {
          parts: [{ text: "Buffered narration." }, { functionCall: { name: "roll_dice", args: { notation: "1d20" } } }],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3, totalTokenCount: 10 },
  };
  const geminiRequestUrls: string[] = [];
  const geminiRequestBodies: Array<Record<string, unknown>> = [];
  const geminiServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    geminiRequestBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
    const url = request.url ?? "";
    geminiRequestUrls.push(url);
    if (url.includes("streamGenerateContent")) {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(sseFrames(geminiStreamFrames));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(geminiBufferedBody));
  });
  await new Promise<void>((resolve) => geminiServer.listen(0, "127.0.0.1", resolve));
  try {
    const geminiAddress = geminiServer.address();
    assert.ok(geminiAddress && typeof geminiAddress === "object");
    const gemini = new GoogleProvider(`http://127.0.0.1:${geminiAddress.port}`, "test");

    // Prose streams live, then a functionCall arriving in a later frame is collected.
    geminiStreamFrames = [
      { candidates: [{ content: { parts: [{ text: "The die " }] } }] },
      { candidates: [{ content: { parts: [{ text: "leaves your hand." }] } }] },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: { name: "roll_dice", args: { notation: "1d20" } },
                  thoughtSignature: "sig-1",
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 4, totalTokenCount: 15 },
      },
    ];
    let geminiTokens: string[] = [];
    let geminiResult = await gemini.chatComplete([{ role: "user", content: "roll" }], {
      model: "gemini-2.0-flash",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        geminiTokens.push(chunk);
      },
    });
    assert.match(
      geminiRequestUrls.at(-1) ?? "",
      /:streamGenerateContent\?alt=sse$/,
      "a Gemini tools round with a token sink must use the SSE streaming endpoint",
    );
    assert.deepEqual(
      geminiTokens,
      ["The die ", "leaves your hand."],
      "Gemini prose must reach onToken per frame, not once after the whole generation",
    );
    assert.equal(geminiResult.content, "The die leaves your hand.");
    assert.equal(geminiResult.finishReason, "tool_calls");
    assert.deepEqual(
      geminiResult.toolCalls.map((call) => [call.function.name, call.function.arguments]),
      [["roll_dice", '{"notation":"1d20"}']],
      "a functionCall part arriving in its own SSE frame must survive",
    );
    assert.deepEqual(
      geminiResult.providerMetadata?.geminiParts,
      [
        { text: "The die leaves your hand." },
        { functionCall: { name: "roll_dice", args: { notation: "1d20" } }, thoughtSignature: "sig-1" },
      ],
      "the streamed tools round must return replayable parts, signature attached to the call",
    );
    assert.equal(geminiResult.usage?.totalTokens, 15);

    // Round two, assembled exactly as the tool loop assembles it (generate.routes.ts:6549-6554
    // then :6677-6683). The assistant message carries both the stored parts and the tool calls,
    // and formatGoogleContents returns early on the stored parts — so the call id → name map
    // has to be filled before that branch. Gemini pairs a functionResponse to its functionCall
    // by name; a result labelled "tool_result" reads as a reply from a function nobody called.
    geminiStreamFrames = [
      { candidates: [{ content: { parts: [{ text: "You rolled a 17." }] }, finishReason: "STOP" }] },
    ];
    geminiTokens = [];
    await gemini.chatComplete(
      [
        { role: "user", content: "roll" },
        {
          role: "assistant",
          content: geminiResult.content ?? "",
          tool_calls: geminiResult.toolCalls,
          ...(geminiResult.providerMetadata ? { providerMetadata: geminiResult.providerMetadata } : {}),
        },
        { role: "tool", content: '{"total":17}', tool_call_id: geminiResult.toolCalls[0]!.id },
      ],
      {
        model: "gemini-2.0-flash",
        tools: [rollDiceTool],
        onToken: (chunk) => {
          geminiTokens.push(chunk);
        },
      },
    );
    const replayedContents = (geminiRequestBodies.at(-1)?.contents ?? []) as Array<{
      role: string;
      parts: Array<Record<string, unknown>>;
    }>;
    assert.deepEqual(
      replayedContents.at(-2)?.parts,
      geminiResult.providerMetadata?.geminiParts,
      "the assistant turn must replay its stored parts verbatim, thought signatures included",
    );
    assert.deepEqual(
      replayedContents.at(-1)?.parts,
      [{ functionResponse: { name: "roll_dice", response: { total: 17 } } }],
      "a tool result must be named for the function that produced it, never `tool_result`",
    );
    assert.deepEqual(geminiTokens, ["You rolled a 17."], "the round after a tool result streams too");

    // Provider-issued ids must pair each result with its call, even when two calls
    // use the same function. Cover both raw-part replay and the fallback serializer.
    const identifiedParts = ["roll-first", "roll-second"].map((id) => ({
      functionCall: { id, name: "roll_dice", args: { notation: "1d20" } },
      thoughtSignature: `signature-${id}`,
    }));
    geminiStreamFrames = [{ candidates: [{ content: { parts: identifiedParts }, finishReason: "STOP" }] }];
    const identifiedResult = await gemini.chatComplete([{ role: "user", content: "roll twice" }], {
      model: "gemini-2.0-flash",
      tools: [rollDiceTool],
      onToken: () => {},
    });
    geminiStreamFrames = [
      { candidates: [{ content: { parts: [{ text: "Both rolls landed." }] }, finishReason: "STOP" }] },
    ];
    for (const replayMetadata of [true, false]) {
      await gemini.chatComplete(
        [
          { role: "user", content: "roll twice" },
          {
            role: "assistant",
            content: "",
            tool_calls: identifiedResult.toolCalls,
            ...(replayMetadata ? { providerMetadata: identifiedResult.providerMetadata } : {}),
          },
          ...identifiedResult.toolCalls.map(
            (call, index): ChatMessage => ({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ total: 17 + index }),
            }),
          ),
        ],
        { model: "gemini-2.0-flash", tools: [rollDiceTool], onToken: () => {} },
      );
      const contents = geminiRequestBodies.at(-1)!.contents as Array<{ parts: unknown[] }>;
      assert.deepEqual(
        contents[1]!.parts,
        replayMetadata ? identifiedParts : identifiedParts.map(({ functionCall }) => ({ functionCall })),
        "both serialization paths must retain the provider's function-call ids",
      );
      assert.deepEqual(
        contents.slice(2).map(({ parts }) => parts),
        ["roll-first", "roll-second"].map((id, index) => [
          { functionResponse: { id, name: "roll_dice", response: { total: 17 + index } } },
        ]),
        "each functionResponse must include the matching provider-issued id",
      );
    }

    // Two calls in one response with no ids of their own: the synthesized fallback ids are
    // built from a running index, so they must not collide.
    geminiStreamFrames = [
      {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "roll_dice", args: { notation: "1d20" } } },
                { functionCall: { name: "roll_dice", args: { notation: "2d6" } } },
              ],
            },
            finishReason: "STOP",
          },
        ],
      },
    ];
    geminiResult = await gemini.chatComplete([{ role: "user", content: "roll twice" }], {
      model: "gemini-2.0-flash",
      tools: [rollDiceTool],
      onToken: () => {},
    });
    // Asserted on the index suffix rather than plain inequality: the fallback id also carries
    // Date.now(), which would usually differ on its own and let a fixed index pass by luck.
    assert.deepEqual(
      geminiResult.toolCalls.map((call) => call.id.replace(/^gemini_tool_\d+/, "")),
      ["_0", "_1"],
      "id-less parallel functionCall parts must get distinct synthesized ids from the running index",
    );
    assert.deepEqual(
      geminiResult.toolCalls.map((call) => call.function.arguments),
      ['{"notation":"1d20"}', '{"notation":"2d6"}'],
    );

    // A tool-only round carries no prose at all. chat()'s `!responseText` guard, ported as-is,
    // would have ended it: this path clears the guard on tool calls instead.
    geminiStreamFrames = [
      {
        candidates: [
          {
            content: { parts: [{ functionCall: { name: "roll_dice", args: { notation: "2d6" } } }] },
            finishReason: "STOP",
          },
        ],
      },
    ];
    geminiTokens = [];
    geminiResult = await gemini.chatComplete([{ role: "user", content: "roll" }], {
      model: "gemini-2.0-flash",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        geminiTokens.push(chunk);
      },
    });
    assert.equal(geminiResult.content, null, "a text-free Gemini tools round must not be an error");
    assert.deepEqual(geminiTokens, []);
    assert.deepEqual(
      geminiResult.toolCalls.map((call) => call.function.name),
      ["roll_dice"],
    );
    assert.equal(geminiResult.finishReason, "tool_calls");

    // Tools attached, none called: the turn still streams.
    geminiStreamFrames = [
      { candidates: [{ content: { parts: [{ text: "No roll " }] } }] },
      { candidates: [{ content: { parts: [{ text: "needed." }] }, finishReason: "STOP" }] },
    ];
    geminiTokens = [];
    geminiResult = await gemini.chatComplete([{ role: "user", content: "talk" }], {
      model: "gemini-2.0-flash",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        geminiTokens.push(chunk);
      },
    });
    assert.deepEqual(geminiTokens, ["No roll ", "needed."], "an unused tool must not re-buffer the turn");
    assert.equal(geminiResult.content, "No roll needed.");
    assert.deepEqual(geminiResult.toolCalls, []);
    assert.equal(geminiResult.finishReason, "stop");

    // Thinking stays buffered: proxies strip thought parts from SSE but return them whole.
    geminiTokens = [];
    geminiResult = await gemini.chatComplete([{ role: "user", content: "roll" }], {
      model: "gemini-2.5-flash",
      reasoningEffort: "high",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        geminiTokens.push(chunk);
      },
    });
    assert.match(
      geminiRequestUrls.at(-1) ?? "",
      /:generateContent$/,
      "Gemini thinking turns must keep the buffered endpoint even with tools attached",
    );
    assert.deepEqual(
      geminiTokens,
      ["Buffered narration."],
      "the buffered path still delivers its text in one onToken call",
    );
    assert.deepEqual(
      geminiResult.providerMetadata?.geminiParts,
      geminiBufferedBody.candidates[0]!.content.parts,
      "the buffered tools round returns its raw parts for replay too",
    );

    // stream:true without a token sink (the agent tool loop) keeps the buffered path.
    await gemini.chatComplete([{ role: "user", content: "roll" }], {
      model: "gemini-2.0-flash",
      stream: true,
      tools: [rollDiceTool],
    });
    assert.match(
      geminiRequestUrls.at(-1) ?? "",
      /:generateContent$/,
      "a tools call with no onToken must not be switched to streaming",
    );
  } finally {
    await new Promise<void>((resolve, reject) => geminiServer.close((error) => (error ? reject(error) : resolve())));
  }

  // ── Anthropic ──
  let anthropicStreamFrames: Array<Record<string, unknown>> = [];
  // When set, the stub writes only the leading frames, waits, then writes the rest — so a
  // case can prove the provider saw the head before the body finished.
  let anthropicTailGate: { headFrames: number; wait: () => Promise<void> } | null = null;
  const anthropicToolRequestBodies: Array<Record<string, unknown>> = [];
  const anthropicToolServer = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    anthropicToolRequestBodies.push(body);
    if (body.stream !== true) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          content: [
            { type: "text", text: "Buffered narration." },
            { type: "tool_use", id: "toolu_buffered", name: "roll_dice", input: { notation: "1d20" } },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 7, output_tokens: 3 },
        }),
      );
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    if (anthropicTailGate) {
      const gate = anthropicTailGate;
      response.write(sseFrames(anthropicStreamFrames.slice(0, gate.headFrames)));
      await gate.wait();
      response.end(sseFrames(anthropicStreamFrames.slice(gate.headFrames)));
      return;
    }
    // Split the payload mid-line so the reader has to re-join a partial SSE frame.
    const payload = sseFrames(anthropicStreamFrames);
    const split = Math.floor(payload.length / 2);
    response.write(payload.slice(0, split));
    setTimeout(() => response.end(payload.slice(split)), 10);
  });
  await new Promise<void>((resolve) => anthropicToolServer.listen(0, "127.0.0.1", resolve));
  try {
    const anthropicAddress = anthropicToolServer.address();
    assert.ok(anthropicAddress && typeof anthropicAddress === "object");
    const anthropic = new AnthropicProvider(`http://127.0.0.1:${anthropicAddress.port}`, "test");

    // Prose streams live, then tool_use input arrives as input_json_delta fragments that
    // split a JSON key across two frames.
    anthropicStreamFrames = [
      { type: "message_start", message: { usage: { input_tokens: 12, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Rolling" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " for you." } },
      { type: "content_block_stop", index: 0 },
      {
        type: "content_block_start",
        index: 1,
        content_block: { type: "tool_use", id: "toolu_1", name: "roll_dice" },
      },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"notat' } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: 'ion":"1d20"}' } },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 9 } },
      { type: "message_stop" },
    ];
    let anthropicTokens: string[] = [];
    let anthropicResult = await anthropic.chatComplete([{ role: "user", content: "roll" }], {
      model: "claude-opus-5",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        anthropicTokens.push(chunk);
      },
    });
    assert.equal(
      anthropicToolRequestBodies.at(-1)?.stream,
      true,
      "an Anthropic tools round with a token sink must request a stream",
    );
    assert.deepEqual(
      anthropicTokens,
      ["Rolling", " for you."],
      "Anthropic prose must reach onToken per delta, not once after the whole generation",
    );
    assert.equal(anthropicResult.content, "Rolling for you.");
    assert.equal(anthropicResult.finishReason, "tool_calls");
    assert.deepEqual(
      anthropicResult.toolCalls.map((call) => [call.id, call.function.name, call.function.arguments]),
      [["toolu_1", "roll_dice", '{"notation":"1d20"}']],
      "input_json_delta fragments split across frames must reassemble into one argument object",
    );
    assert.deepEqual(anthropicResult.usage, { promptTokens: 12, completionTokens: 9, totalTokens: 21 });

    // Two tool_use blocks open at once, deltas interleaved: accumulation must be index-keyed.
    anthropicStreamFrames = [
      { type: "message_start", message: { usage: { input_tokens: 4, output_tokens: 0 } } },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_a", name: "roll_dice" },
      },
      {
        type: "content_block_start",
        index: 1,
        content_block: { type: "tool_use", id: "toolu_b", name: "roll_dice" },
      },
      {
        type: "content_block_delta",
        index: 1,
        delta: { type: "input_json_delta", partial_json: '{"notation":"2d6"}' },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"notation":"1d20"}' },
      },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 5 } },
      { type: "message_stop" },
    ];
    anthropicTokens = [];
    anthropicResult = await anthropic.chatComplete([{ role: "user", content: "roll twice" }], {
      model: "claude-opus-5",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        anthropicTokens.push(chunk);
      },
    });
    assert.equal(anthropicResult.content, null, "a text-free Anthropic tools round must not be an error");
    assert.deepEqual(anthropicTokens, []);
    assert.deepEqual(
      anthropicResult.toolCalls.map((call) => [call.id, call.function.arguments]),
      [
        ["toolu_a", '{"notation":"1d20"}'],
        ["toolu_b", '{"notation":"2d6"}'],
      ],
      "interleaved parallel tool_use deltas must stay bound to their own content-block index",
    );

    // A tool-only round that never sends a message_delta: the empty-text guard has to clear
    // on the collected tool calls, not lean on a stop_reason arriving to clear it first.
    anthropicStreamFrames = [
      { type: "message_start", message: { usage: { input_tokens: 6, output_tokens: 0 } } },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_c", name: "roll_dice" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"notation":"1d4"}' },
      },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    anthropicResult = await anthropic.chatComplete([{ role: "user", content: "roll" }], {
      model: "claude-opus-5",
      tools: [rollDiceTool],
      onToken: () => {},
    });
    assert.equal(anthropicResult.content, null);
    assert.deepEqual(
      anthropicResult.toolCalls.map((call) => [call.id, call.function.arguments]),
      [["toolu_c", '{"notation":"1d4"}']],
      "a tool call with no stop_reason behind it must be returned, not thrown away as empty",
    );
    assert.equal(anthropicResult.finishReason, "tool_calls");

    // Delivery has to be progressive, not just parsed progressively: safeFetch's buffered
    // mode drains the entire body before the provider reads a byte, so `bufferResponse` must
    // follow `useStream` or the turn arrives in one lump with the SSE parser none the wiser.
    // The stub holds the tail of the stream until the first token lands.
    anthropicStreamFrames = [
      { type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "First." } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " Second." } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } },
      { type: "message_stop" },
    ];
    let firstTokenArrived = false;
    let tailFollowedFirstToken = false;
    let releaseTail = () => {};
    const tailRelease = new Promise<void>((resolve) => {
      releaseTail = resolve;
    });
    anthropicTailGate = {
      headFrames: 3,
      wait: async () => {
        // Bounded, so a buffered read fails this assertion instead of hanging the lane.
        await Promise.race([tailRelease, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
        tailFollowedFirstToken = firstTokenArrived;
      },
    };
    anthropicTokens = [];
    try {
      anthropicResult = await anthropic.chatComplete([{ role: "user", content: "talk" }], {
        model: "claude-opus-5",
        tools: [rollDiceTool],
        onToken: (chunk) => {
          anthropicTokens.push(chunk);
          firstTokenArrived = true;
          releaseTail();
        },
      });
    } finally {
      anthropicTailGate = null;
    }
    assert.ok(
      tailFollowedFirstToken,
      "a streamed tools round must reach onToken before the response body ends — bufferResponse must follow useStream",
    );
    assert.deepEqual(anthropicTokens, ["First.", " Second."]);
    assert.equal(anthropicResult.content, "First. Second.");

    // Tools attached, none called: the turn still streams.
    anthropicStreamFrames = [
      { type: "message_start", message: { usage: { input_tokens: 3, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "No roll " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "needed." } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } },
      { type: "message_stop" },
    ];
    anthropicTokens = [];
    anthropicResult = await anthropic.chatComplete([{ role: "user", content: "talk" }], {
      model: "claude-opus-5",
      tools: [rollDiceTool],
      onToken: (chunk) => {
        anthropicTokens.push(chunk);
      },
    });
    assert.deepEqual(anthropicTokens, ["No roll ", "needed."], "an unused tool must not re-buffer the turn");
    assert.equal(anthropicResult.content, "No roll needed.");
    assert.deepEqual(anthropicResult.toolCalls, []);
    assert.equal(anthropicResult.finishReason, "end_turn");

    // stream:true without a token sink (the agent tool loop) keeps the buffered path.
    anthropicResult = await anthropic.chatComplete([{ role: "user", content: "roll" }], {
      model: "claude-opus-5",
      stream: true,
      tools: [rollDiceTool],
    });
    assert.equal(
      anthropicToolRequestBodies.at(-1)?.stream,
      false,
      "a tools call with no onToken must not be switched to streaming",
    );
    assert.equal(anthropicResult.content, "Buffered narration.");
    assert.deepEqual(
      anthropicResult.toolCalls.map((call) => call.id),
      ["toolu_buffered"],
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      anthropicToolServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

process.stdout.write("Provider compatibility regression passed.\n");
