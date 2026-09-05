import assert from "node:assert/strict";
import { collectPastReasoningMetadata } from "../../packages/server/src/services/generation/generation-parameters.js";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";
import { mergeAdjacentMessages } from "../../packages/server/src/services/prompt/merger.js";

const reasoning = (id: string) => ({ type: "reasoning", id, encrypted_content: `opaque-${id}`, summary: [] });
const history = [
  {
    id: "a",
    role: "assistant",
    extra: JSON.stringify({
      chatCompletionsReasoning: { reasoning_content: "first" },
      encryptedReasoning: [reasoning("rs_a")],
    }),
  },
  { id: "b", role: "user", extra: { thinking: "user text is never assistant reasoning" } },
  {
    id: "c",
    role: "assistant",
    extra: {
      chatCompletionsReasoning: { reasoning_details: [{ type: "reasoning.encrypted", data: "signed" }] },
      encryptedReasoning: [reasoning("rs_c")],
    },
  },
  { id: "d", role: "assistant", extra: {} },
];
const original = JSON.stringify(history);
assert.equal(collectPastReasoningMetadata(history, {}, "openai", "gpt-6-astra").size, 0);
assert.equal(
  collectPastReasoningMetadata(history, { excludePastReasoning: true, pastReasoningLimit: 0 }, "openai", "gpt-6-astra")
    .size,
  0,
);
for (const limit of [undefined, -1, NaN, Infinity, "2", 1, 1.9]) {
  assert.deepEqual(
    [
      ...collectPastReasoningMetadata(
        history,
        { excludePastReasoning: false, pastReasoningLimit: limit },
        "openai",
        "gpt-6-astra",
      ).keys(),
    ],
    ["c"],
  );
}
for (const limit of [0, 2, 10]) {
  assert.deepEqual(
    [
      ...collectPastReasoningMetadata(
        history,
        { excludePastReasoning: false, pastReasoningLimit: limit },
        "openai",
        "gpt-6-astra",
      ).keys(),
    ],
    ["c", "a"],
  );
}
assert.equal(JSON.stringify(history), original, "limiting replay must not delete saved reasoning");
const hiddenHistory = [
  history[0]!,
  {
    id: "hidden",
    role: "assistant",
    extra: { hiddenFromAI: true, chatCompletionsReasoning: { reasoning_content: "not for the AI" } },
  },
];
assert.deepEqual(
  [...collectPastReasoningMetadata(hiddenHistory, { excludePastReasoning: false }, "custom", "local-model").keys()],
  ["a"],
  "hidden messages must neither replay nor consume the visible reasoning allowance",
);
const localHistory = [
  { id: "a", role: "assistant", extra: { thinking: "from custom thinking tags" } },
  { id: "b", role: "assistant", extra: "invalid JSON" },
];
assert.deepEqual(
  collectPastReasoningMetadata(localHistory, { excludePastReasoning: false }, "custom", "local-model").get("a"),
  { reasoning_content: "from custom thinking tags" },
);
assert.equal(
  collectPastReasoningMetadata(localHistory, { excludePastReasoning: false }, "anthropic", "claude").size,
  0,
  "never invent signed native reasoning from plain text",
);
assert.equal(
  collectPastReasoningMetadata(history, { excludePastReasoning: false }, "openrouter", "google/gemini-3-pro").size,
  0,
);
const geminiParts = [{ text: "thought", thought: true, thoughtSignature: "signed" }, { text: "answer" }];
assert.deepEqual(
  collectPastReasoningMetadata(
    [{ id: "g", role: "assistant", extra: { geminiParts } }],
    { excludePastReasoning: false },
    "google",
    "gemini-3-pro",
  ).get("g"),
  { geminiParts },
);

// Exercise the real Responses formatter without contacting a paid provider.
const provider = new OpenAIProvider(
  "https://api.openai.com/v1",
  "synthetic",
  undefined,
  undefined,
  undefined,
  "openai",
) as unknown as {
  buildResponsesBody(messages: ChatMessage[], options: ChatOptions): { input: Array<Record<string, unknown>> };
  parseResponsesResult(result: Record<string, unknown>): { providerMetadata?: Record<string, unknown> };
};
const toolReasoning = reasoning("rs_tool");
assert.deepEqual(
  provider.parseResponsesResult({
    status: "completed",
    output: [
      toolReasoning,
      { type: "function_call", id: "fc_tool", call_id: "fc_tool", name: "lookup", arguments: "{}" },
    ],
  }).providerMetadata,
  { encryptedReasoning: [toolReasoning] },
  "tool-round reasoning must travel with its assistant result, not just the legacy latest-turn callback",
);
const all = collectPastReasoningMetadata(
  history,
  { excludePastReasoning: false, pastReasoningLimit: 0 },
  "openai",
  "gpt-6-astra",
);
const messages: ChatMessage[] = history.map((message) => ({
  role: message.role as "assistant" | "user",
  content: message.id,
  providerMetadata: all.get(message.id),
}));
const options = { model: "gpt-6-astra", reasoningEffort: "medium" } satisfies ChatOptions;
const body = provider.buildResponsesBody(messages, options);
assert.deepEqual(
  body.input.map((item) => item.id ?? item.content),
  ["rs_a", "a", "b", "rs_c", "c", "d"],
);
const withLegacyReplay = provider.buildResponsesBody(messages, {
  ...options,
  encryptedReasoningItems: [reasoning("rs_c")],
});
assert.deepEqual(
  withLegacyReplay.input,
  body.input,
  "the legacy continuity option must not duplicate per-message reasoning",
);
assert.ok(
  provider
    .buildResponsesBody(messages, { ...options, reasoningEffort: "none" })
    .input.every((item) => item.type !== "reasoning"),
);
assert.equal(
  mergeAdjacentMessages(messages as Parameters<typeof mergeAdjacentMessages>[0]).length,
  4,
  "adjacent assistant turns must keep their reasoning boundaries",
);
assert.equal(
  mergeAdjacentMessages([
    { role: "user", content: "one" },
    { role: "user", content: "two" },
  ]).length,
  1,
  "ordinary adjacent merging stays unchanged",
);

console.log("past reasoning history: ok");
