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
  resolveGeminiThinkingConfig,
  resolveGoogleFunctionCallingMode,
} from "../../packages/server/src/services/llm/providers/google.provider.js";
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

const gatewaySseBody = [
  ": x-omniroute-cache-hit=false",
  'data: {"choices":[{"delta":{},"finish_reason":null}]}',
  'data: {"choices":[{"message":{"content":"recovered final message"},"finish_reason":"stop"}]}',
  "data: [DONE]",
].join("\n");

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
  openRouterCachingRequestBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
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
  assert.deepEqual(openRouterCachingRequestBodies[0]?.cache_control, { type: "ephemeral" });
  assert.equal("cache_control" in (openRouterCachingRequestBodies[1] ?? {}), false);
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
  "mythos",
);
assert.deepEqual(anthropicMythosBody.tool_choice, { type: "auto" });
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

process.stdout.write("Provider compatibility regression passed.\n");
