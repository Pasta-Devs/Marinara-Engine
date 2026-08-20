import assert from "node:assert/strict";
import type { Model, ProviderListResponse } from "@opencode-ai/sdk/v2";
import { MODEL_LISTS } from "../../packages/shared/src/constants/model-lists.js";
import {
  isLocalAuthProvider,
  localAuthProviderBaseUrl,
  PROVIDERS,
} from "../../packages/shared/src/constants/providers.js";
import { createLLMProvider } from "../../packages/server/src/services/llm/provider-registry.js";
import {
  buildOpenCodeParts,
  buildOpenCodePrompt,
  createOpenCodeReadyScanner,
  fetchOpenCodeModels,
  flattenOpenCodeModels,
  OpenCodeProvider,
  parseOpenCodeModelSlug,
  type OpenCodeGenerationInput,
  type OpenCodeProviderRuntime,
} from "../../packages/server/src/services/llm/providers/opencode.provider.js";
import type { LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";

assert.deepEqual(parseOpenCodeModelSlug("anthropic/claude-sonnet"), {
  providerID: "anthropic",
  modelID: "claude-sonnet",
});
assert.deepEqual(parseOpenCodeModelSlug("openrouter/anthropic/claude-sonnet"), {
  providerID: "openrouter",
  modelID: "anthropic/claude-sonnet",
});
assert.equal(parseOpenCodeModelSlug("claude-sonnet"), null);
assert.equal(parseOpenCodeModelSlug("/claude-sonnet"), null);
assert.equal(parseOpenCodeModelSlug("anthropic/"), null);

const scanReadyOutput = createOpenCodeReadyScanner();
assert.equal(scanReadyOutput(`${"startup noise".repeat(300)}\nopencode server listening on http://127.0.0.`), null);
assert.equal(scanReadyOutput("1:43210\nignored trailing output"), "http://127.0.0.1:43210");

const promptMessages = [
  { role: "system" as const, content: "Stay in character." },
  {
    role: "assistant" as const,
    content: "",
    tool_calls: [
      {
        id: "call-1",
        type: "function" as const,
        function: { name: "lookup", arguments: '{"name":"Mina"}' },
      },
    ],
  },
  { role: "tool" as const, content: "Found Mina", tool_call_id: "call-1" },
  { role: "user" as const, content: "Continue." },
];
const prompt = buildOpenCodePrompt(promptMessages);
assert.match(prompt, /<System>\nStay in character\.\n<\/System>/);
assert.match(prompt, /Assistant tool calls/);
assert.match(prompt, /Tool call id: call-1/);
assert.match(prompt, /<User>\nContinue\.\n<\/User>/);

const parts = buildOpenCodeParts(
  [
    {
      role: "user",
      content: "Describe these.",
      images: ["data:image/png;base64,aW1hZ2U="],
      files: [{ type: "text/plain", data: "ZmlsZQ==", filename: "notes.txt" }],
      media: [{ kind: "audio", data: "YXVkaW8=", mimeType: "audio/wav", filename: "voice.wav" }],
    },
  ],
  "attachment prompt",
);
assert.deepEqual(parts[0], { type: "text", text: "attachment prompt" });
assert.equal(parts.length, 4);
assert.equal(parts[1]?.type, "file");
assert.equal(parts[1]?.type === "file" ? parts[1].mime : "", "image/png");
assert.equal(parts[1]?.type === "file" ? parts[1].url : "", "data:image/png;base64,aW1hZ2U=");
assert.equal(parts[2]?.type === "file" ? parts[2].url : "", "data:text/plain;base64,ZmlsZQ==");
assert.equal(parts[3]?.type === "file" ? parts[3].filename : "", "voice.wav");

const modelFixtureDefaults = {
  api: { id: "chat", url: "https://provider.example/v1", npm: "@ai-sdk/openai-compatible" },
  capabilities: {
    temperature: true,
    reasoning: false,
    attachment: true,
    toolcall: true,
    input: { text: true, audio: false, image: true, video: false, pdf: false },
    output: { text: true, audio: false, image: false, video: false, pdf: false },
    interleaved: false,
  },
  cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
  status: "active",
  options: {},
  headers: {},
  release_date: "2026-08-20",
} satisfies Omit<Model, "id" | "providerID" | "name" | "limit">;

const providerList = {
  connected: ["anthropic", "openrouter"],
  default: {},
  all: [
    {
      id: "anthropic",
      name: "Anthropic",
      source: "config",
      env: [],
      options: {},
      models: {
        sonnet: {
          ...modelFixtureDefaults,
          id: "sonnet",
          providerID: "anthropic",
          name: "Claude Sonnet",
          limit: { context: 200_000, output: 64_000 },
        },
      },
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      source: "config",
      env: [],
      options: {},
      models: {
        nested: {
          ...modelFixtureDefaults,
          id: "anthropic/claude-opus",
          providerID: "openrouter",
          name: "Claude Opus",
          limit: { context: 1_000_000, output: 128_000 },
        },
      },
    },
    {
      id: "google",
      name: "Google",
      source: "config",
      env: [],
      options: {},
      models: {
        gemini: {
          ...modelFixtureDefaults,
          id: "gemini-pro",
          providerID: "google",
          name: "Gemini Pro",
          limit: { context: 1_000_000, output: 64_000 },
        },
      },
    },
  ],
} satisfies ProviderListResponse;
assert.deepEqual(flattenOpenCodeModels(providerList), [
  { id: "openrouter/anthropic/claude-opus", name: "Claude Opus", context: 1_000_000, maxOutput: 128_000 },
  { id: "anthropic/sonnet", name: "Claude Sonnet", context: 200_000, maxOutput: 64_000 },
]);

let generationInput: OpenCodeGenerationInput | null = null;
const runtime: OpenCodeProviderRuntime = {
  async listModels() {
    return flattenOpenCodeModels(providerList);
  },
  async generate(input) {
    generationInput = input;
    return {
      text: "OpenCode response",
      promptTokens: 12,
      completionTokens: 4,
      reasoningTokens: 2,
      cachedPromptTokens: 3,
      cacheWritePromptTokens: 1,
      finishReason: "stop",
    };
  },
};

assert.equal((await fetchOpenCodeModels(runtime)).length, 2);
const provider = new OpenCodeProvider("", "", 200_000, null, null, runtime);
const generator = provider.chat([{ role: "user", content: "Hello" }], {
  model: "anthropic/sonnet",
  maxTokens: 64,
  stream: false,
});
const first = await generator.next();
assert.deepEqual(first, { value: "OpenCode response", done: false });
const done = await generator.next();
assert.equal(done.done, true);
const usage = done.value as LLMUsage;
assert.deepEqual(usage, {
  promptTokens: 12,
  completionTokens: 4,
  totalTokens: 16,
  completionReasoningTokens: 2,
  cachedPromptTokens: 3,
  cacheWritePromptTokens: 1,
  finishReason: "stop",
});
assert.equal(generationInput?.model, "anthropic/sonnet");
assert.match(generationInput?.prompt ?? "", /<User>\nHello\n<\/User>/);

await assert.rejects(async () => {
  const invalid = provider.chat([{ role: "user", content: "Hello" }], { model: "sonnet" });
  await invalid.next();
}, /provider\/model format/);

assert.ok(createLLMProvider("opencode", "", "") instanceof OpenCodeProvider);
assert.equal(isLocalAuthProvider("opencode"), true);
assert.equal(localAuthProviderBaseUrl("opencode"), "opencode://local");
assert.equal(PROVIDERS.opencode.name, "OpenCode");
assert.deepEqual(MODEL_LISTS.opencode, []);

console.log("OpenCode provider regression passed");
