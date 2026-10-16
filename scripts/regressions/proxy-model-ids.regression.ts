import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  capabilityModelId,
  findKnownModel,
  impliesProxyThinking,
  isClaudeOpus55Model,
  isGeminiArgonModel,
  isXaiConfigurableReasoningModel,
  isZaiMaxReasoningEffortModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
  supportsXhighReasoningEffort,
} from "../../packages/shared/src/constants/model-lists.js";
import { relevantGenerationParameters } from "../../packages/shared/src/constants/generation-parameter-relevance.js";
import {
  AnthropicProvider,
  supportsAnthropicThinkingDisable,
} from "../../packages/server/src/services/llm/providers/anthropic.provider.js";
import type { APIProvider } from "../../packages/shared/src/types/connection.js";

// Proxy and gateway ids on their native provider must get the catalog model's capabilities, while the request keeps
// the configured id. Ids come from the proxies' public model lists and docs (October 2026): LinkAPI and new-api,
// AiHubMix, Chutes, Poe, CLIProxyAPI, OpenRouter/NanoGPT, Bifrost/LiteLLM and Bedrock/Vertex naming.
// Wire-level fixture; no provider calls or credentials.
const requests: Array<Record<string, any>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      content: [{ type: "text", text: "Hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const anthropic = new AnthropicProvider(`http://127.0.0.1:${address.port}`, "fixture");

try {
  await test("proxy ids resolve to the catalog model they serve", () => {
    const cases: Array<[APIProvider, string, string]> = [
      ["anthropic", "[次]claude-opus-4-6-thinking", "claude-opus-4-6"],
      ["anthropic", "[SP]claude-opus-4-6", "claude-opus-4-6"],
      ["anthropic", "claude-sonnet-4-6-thinking", "claude-sonnet-4-6"],
      ["anthropic", "claude-opus-4-7-r", "claude-opus-4-7"],
      ["anthropic", "【限时】 claude-opus-4-8", "claude-opus-4-8"],
      ["anthropic", "[次]claude-opus-5-5", "claude-opus-5-5"],
      ["anthropic", "anthropic/claude-opus-4-6", "claude-opus-4-6"],
      ["google", "[次]gemini-2.5-pro", "gemini-2.5-pro"],
      ["google", "gemini-3.1-pro-preview-r", "gemini-3.1-pro-preview"],
      ["xai", "[次]grok-4.7", "grok-4.7"],
      ["deepseek", "[SP]deepseek-v4-pro", "deepseek-v4-pro"],
      ["zai", "[次]glm-5.3", "glm-5.3"],
      ["nanogpt", "claude-opus-4-6:thinking", "claude-opus-4-6"],
      ["custom", "[free]deepseek-v4-pro-nothinking", "deepseek-v4-pro"],
      // new-api / one-api forks: budget and effort tails, @-modifiers.
      ["anthropic", "claude-opus-4-6-thinking-8192", "claude-opus-4-6"],
      ["anthropic", "claude-opus-4-6-high", "claude-opus-4-6"],
      ["anthropic", "claude-opus-4-6@thinking:on", "claude-opus-4-6"],
      ["openai", "gpt-5.4-xhigh", "gpt-5.4"],
      // AiHubMix: -think / -nothink, -search, effort tails, Vertex-style @date.
      ["anthropic", "claude-sonnet-4-5-think", "claude-sonnet-4-5"],
      ["google", "gemini-3.1-flash-lite-nothink", "gemini-3.1-flash-lite"],
      ["google", "gemini-3-flash-preview-search", "gemini-3-flash-preview"],
      ["openai", "gpt-5.4-high", "gpt-5.4"],
      ["anthropic", "claude-3-haiku@20240307", "claude-3-haiku-20240307"],
      // Chutes: organisation path, casing, -TEE and a date pin.
      ["custom", "zai-org/GLM-5.1-TEE", "glm-5.1"],
      ["custom", "deepseek-ai/DeepSeek-V4-Flash-0731-TEE", "deepseek-v4-flash"],
      ["custom", "moonshotai/Kimi-K2.6-TEE", "kimi-k2.6"],
      // Poe and OpenRouter: dotted Claude versions.
      ["anthropic", "claude-opus-4.6", "claude-opus-4-6"],
      ["openrouter", "anthropic/claude-sonnet-4.5:thinking", "claude-sonnet-4-5"],
      ["openai", "o3-mini-high", "o3-mini"],
      // CLIProxyAPI: (level|budget) modifiers and provider:// prefixes.
      ["anthropic", "claude-sonnet-4.5(none)", "claude-sonnet-4-5"],
      ["google", "openrouter://gemini-3-flash-preview(high)", "gemini-3-flash-preview"],
      // Claude Code 1M context alias.
      ["claude_subscription", "claude-opus-4-6[1m]", "claude-opus-4-6"],
      // Bifrost / LiteLLM provider paths, including Bedrock and Vertex ids behind them.
      ["anthropic", "bedrock/us.anthropic.claude-opus-4-1-v1:0", "claude-opus-4-1"],
      ["anthropic", "anthropic.claude-3-5-sonnet-20241022-v2:0", "claude-3-5-sonnet-20241022"],
      ["anthropic", "vertex_ai/claude-opus-4-1@20250805", "claude-opus-4-1-20250805"],
      ["xai", "xai/grok-4.20-multi-agent-0309", "grok-4.20-multi-agent"],
      // Date pins.
      ["anthropic", "claude-sonnet-4-5-20250929", "claude-sonnet-4-5-20250929"],
      ["anthropic", "claude-opus-4-1-20250805", "claude-opus-4-1-20250805"],
      ["anthropic", "claude-opus-4-6-20260205", "claude-opus-4-6"],
      ["openai", "gpt-4o-2024-08-06", "gpt-4o-2024-08-06"],
      ["openai", "gpt-5.6-sol-2026-09-30", "gpt-5.6-sol"], // a newer pin than the catalog lists
    ];
    for (const [provider, id, expected] of cases) {
      assert.equal(findKnownModel(provider, id)?.id, expected, `${provider} ${id}`);
      assert.equal(shouldSuppressUnknownModelParameters(provider, id), false, `${provider} ${id}`);
    }
  });

  await test("real ids are not over-normalized", () => {
    // Real catalog ids that end like a proxy suffix match as they are.
    for (const [provider, id] of [
      ["cohere", "command-r"],
      ["openai", "gpt-5.1-codex-max"],
      ["xai", "grok-4-0709"],
      ["xai", "grok-4-fast-reasoning"],
      ["zai", "glm-4-32b-0414-128k"],
    ] as const) {
      assert.equal(findKnownModel(provider, id)?.id, id, id);
    }
    // Real distinct models whose base is not a catalog model stay unknown rather than borrowing another model.
    assert.equal(findKnownModel("custom", "kimi-k2-thinking"), undefined);
    assert.equal(findKnownModel("custom", "grok-4-1-fast-reasoning"), undefined);
    // Dash-joined channel prefixes (AiHubMix `cc-`, `sf-`) cannot be told apart from a model name, so they stay.
    assert.equal(findKnownModel("custom", "cc-kimi-k2.6"), undefined);
    for (const id of ["claude-opus-4-6x", "claude-opus-4-6-thinking-extra", "[次]", "claude-opus-4-6-turbo"]) {
      assert.equal(findKnownModel("anthropic", id), undefined, id);
      assert.equal(shouldSuppressUnknownModelParameters("anthropic", id), true, id);
    }
    assert.equal(findKnownModel("custom", "claude-opus-5.50"), undefined);
    assert.equal(capabilityModelId(" Anthropic/Claude-Opus-4-6 "), "anthropic/claude-opus-4-6");
    assert.equal(capabilityModelId("[次][SP]claude-opus-4-6"), "claude-opus-4-6");
    assert.equal(capabilityModelId("claude-opus-4-6@thinking:on@effort:high"), "claude-opus-4-6");
    assert.equal(capabilityModelId("claude-opus-4-6 (high)"), "claude-opus-4-6");
    assert.equal(capabilityModelId("claude-opus-5-5 [1m]"), "claude-opus-5-5");
    assert.equal(capabilityModelId("claude-opus-5-5 @thinking:high"), "claude-opus-5-5");
    assert.equal(supportsAnthropicThinkingDisable("claude-opus-5[1m]"), true);
    // Crafted 100k-character ids (connections can be imported) must not stall the scans.
    const started = performance.now();
    findKnownModel("custom", "x" + "-1234".repeat(20_000));
    capabilityModelId("x" + ")@".repeat(50_000));
    assert.ok(performance.now() - started < 1000, "long ids resolve quickly");
    assert.equal(capabilityModelId("@cf/meta/llama-3-8b"), "@cf/meta/llama-3-8b");
    for (const id of [
      "claude-opus-4-6-nothinking",
      "claude-opus-4-6-no-thinking",
      "claude-opus-4-6-non-thinking",
      "claude-opus-4-6-nothink",
      "claude-opus-4-6-thinking-0",
      "claude-opus-4-6@thinking:off",
      "claude-sonnet-4.5(none)",
      "claude-sonnet-4-5(free)",
      "claude-sonnet-4-5(none)[free]",
      "claude-opus-4-6()",
      "claude-opus-4-6[1m]",
      "gemini-2.0-flash-thinking-exp",
      "claude-opus-4-6",
      "gpt-5.4",
    ]) {
      assert.equal(impliesProxyThinking(id), false, id);
    }
    for (const id of [
      "[次]claude-opus-4-6-thinking",
      "claude-opus-4-6-thinking-8192",
      "claude-sonnet-4-5-think",
      "claude-opus-4-6-high",
      "claude-opus-4-6@thinking:16000",
      "claude-sonnet-4.5(high)",
      "claude-sonnet-4-5(high)[free]",
      "claude-opus-4-6@thinking:on[1m]",
      "gpt-5.4-high",
      "o3-mini-high",
    ]) {
      assert.equal(impliesProxyThinking(id), true, id);
    }
  });

  await test("capability predicates read through the channel tag", () => {
    assert.equal(supportsXhighReasoningEffort("[次]claude-opus-4-7-thinking"), true);
    assert.equal(supportsXhighReasoningEffort("[次]claude-opus-4-6"), false);
    assert.equal(isClaudeOpus55Model("[SP]claude-opus-5-5-r"), true);
    assert.equal(isClaudeOpus55Model("claude-opus-5-5[1m]"), true);
    assert.equal(isClaudeOpus55Model("claude-opus-5-5@thinking:on"), true);
    assert.equal(isGeminiArgonModel("[次]gemini-4-argon"), true);
    assert.equal(isXaiConfigurableReasoningModel("[次]grok-4.7"), true);
    assert.equal(isZaiMaxReasoningEffortModel("[次]glm-5.3"), true);
    assert.equal(
      resolveProviderReasoningEffort({
        provider: "anthropic",
        model: "[次]claude-opus-4-7-thinking",
        reasoningEffort: "maximum",
      }),
      "max",
    );
    assert.equal(
      resolveProviderReasoningEffort({ provider: "google", model: "[次]gemini-4-argon", reasoningEffort: null }),
      "medium",
    );

    const thinking = relevantGenerationParameters({ provider: "anthropic", model: "[次]claude-opus-4-6-thinking" });
    assert.equal(thinking.has("reasoningEffort"), true);
    assert.equal(thinking.has("temperature"), false);
    const plain = relevantGenerationParameters({
      provider: "anthropic",
      model: "[SP]claude-opus-4-6",
      reasoningEffort: null,
    });
    assert.equal(plain.has("reasoningEffort"), true);
    assert.equal(plain.has("temperature"), true);
    // A GPT-5 effort tail reasons upstream, so temperature is hidden even with effort off; the bare model keeps it.
    const tail = relevantGenerationParameters({ provider: "openai", model: "gpt-5.4-high", reasoningEffort: null });
    assert.equal(tail.has("temperature"), false);
    assert.equal(tail.has("reasoningEffort"), true);
    const bare = relevantGenerationParameters({ provider: "openai", model: "gpt-5.4", reasoningEffort: null });
    assert.equal(bare.has("temperature"), true);
  });

  await test("Anthropic sends effort for a proxy id and keeps the configured id", async () => {
    const model = "[次]claude-opus-4-6-thinking";
    const base = {
      model,
      stream: false,
      maxTokens: 100_000,
      temperature: 0.7,
      topK: 32,
      captureReasoning: true,
    } as const;

    await anthropic.chatComplete([{ role: "user", content: "Hi" }], {
      ...base,
      enableThinking: true,
      reasoningEffort: "high",
    });
    let body = requests.at(-1)!;
    assert.equal(body.model, model);
    assert.deepEqual(body.thinking, { type: "adaptive", display: "summarized" });
    assert.equal(body.output_config.effort, "high");
    assert.equal(body.max_tokens, 32_000, "Opus 4.6 output limit applies");
    for (const sampler of ["temperature", "top_k", "top_p"]) assert.equal(sampler in body, false, sampler);

    // Effort off: the proxy still thinks, so sampling and forced tool choice stay out.
    await anthropic.chatComplete([{ role: "user", content: "Hi" }], {
      ...base,
      tools: [
        { type: "function", function: { name: "lookup", description: "Look up", parameters: { type: "object" } } },
      ],
      toolChoice: "required",
    });
    body = requests.at(-1)!;
    assert.equal(body.model, model);
    assert.equal(body.thinking, undefined);
    assert.deepEqual(body.tool_choice, { type: "auto" });
    for (const sampler of ["temperature", "top_k", "top_p"]) assert.equal(sampler in body, false, sampler);

    // Custom parameters cannot bring a sampler back for a thinking id.
    await anthropic.chatComplete([{ role: "user", content: "Hi" }], {
      ...base,
      customParameters: { temperature: 0.2 },
    });
    body = requests.at(-1)!;
    assert.equal("temperature" in body, false, "custom temperature");

    // A tagged id without a thinking suffix keeps its samplers when effort is off.
    await anthropic.chatComplete([{ role: "user", content: "Hi" }], { ...base, model: "[SP]claude-opus-4-6" });
    body = requests.at(-1)!;
    assert.equal(body.model, "[SP]claude-opus-4-6");
    assert.equal(body.temperature, 0.7);
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
