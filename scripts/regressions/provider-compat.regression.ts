import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  findKnownModel,
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

class RegressionProvider extends BaseLLMProvider {
  calls = 0;
  lastOptions: ChatOptions | null = null;

  constructor(
    private readonly chunks: string[],
    private readonly failure?: Error,
  ) {
    super("", "");
  }

  async *chat(_messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    this.calls += 1;
    this.lastOptions = options;
    for (const chunk of this.chunks) yield chunk;
    if (this.failure) throw this.failure;
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
    `http://127.0.0.1:${address.port}/v1`,
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

process.stdout.write("Provider compatibility regression passed.\n");
