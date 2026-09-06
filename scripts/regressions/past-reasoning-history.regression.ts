import assert from "node:assert/strict";
import {
  collectPastReasoningMetadata,
  limitPastReasoningMetadata,
} from "../../packages/server/src/services/generation/generation-parameters.js";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";
import { mergeAdjacentMessages } from "../../packages/server/src/services/prompt/merger.js";
import { assemblePrompt } from "../../packages/server/src/services/prompt/assembler.js";
import { filterPromptMessagesForCharacterAudience } from "../../packages/server/src/services/generation/prompt-message-scope.js";
import { fitMessagesToContext } from "../../packages/server/src/services/llm/base-provider.js";

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
assert.deepEqual(
  [
    ...collectPastReasoningMetadata(
      [
        { id: "signed", role: "assistant", extra: { geminiParts } },
        { id: "plain", role: "assistant", extra: { geminiParts: [{ text: "ordinary answer" }] } },
      ],
      { excludePastReasoning: false },
      "google",
      "gemini-3-pro",
    ).keys(),
  ],
  ["signed"],
  "Plain Gemini response parts do not consume a reasoning block",
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
const reasoningOnly = {
  role: "assistant" as const,
  content: "",
  contextKind: "history" as const,
  providerMetadata: { encryptedReasoning: [reasoning("rs_empty")] },
};
assert.deepEqual(
  mergeAdjacentMessages([
    { role: "assistant", content: "Before" },
    { role: "user", content: "   " },
    reasoningOnly,
    { role: "assistant", content: "After" },
  ]),
  [{ role: "assistant", content: "Before" }, reasoningOnly, { role: "assistant", content: "After" }],
  "Reasoning-only assistant turns survive merging; truly empty messages are still skipped",
);
assert.deepEqual(
  provider.buildResponsesBody(mergeAdjacentMessages([reasoningOnly]), options).input,
  reasoningOnly.providerMetadata.encryptedReasoning,
  "A reasoning-only turn must reach the native Responses input",
);

const scopedHistory = [
  {
    role: "assistant" as const,
    contextKind: "history" as const,
    content: "visible",
    providerMetadata: { reasoning_content: "visible thought" },
  },
  {
    role: "assistant" as const,
    contextKind: "history" as const,
    content: "hidden for Ada",
    hiddenFromAICharacterIds: ["ada"],
    providerMetadata: { reasoning_content: "other character thought" },
  },
];
const beforeLimit = JSON.stringify(scopedHistory);
const targetHistory = filterPromptMessagesForCharacterAudience(scopedHistory, ["ada"]);
assert.equal(
  limitPastReasoningMetadata(targetHistory, { excludePastReasoning: false })[0]?.providerMetadata?.reasoning_content,
  "visible thought",
);
const limited = limitPastReasoningMetadata(scopedHistory, { excludePastReasoning: false });
assert.equal(limited[0]?.providerMetadata, undefined);
assert.equal(limited[1]?.providerMetadata?.reasoning_content, "other character thought");
assert.equal(
  JSON.stringify(scopedHistory),
  beforeLimit,
  "Limit enforcement must not mutate stored or other-character history",
);
assert.equal(
  limitPastReasoningMetadata(scopedHistory, { excludePastReasoning: false, pastReasoningLimit: 0 }).filter(
    (message) => message.providerMetadata,
  ).length,
  2,
);
assert.equal(limitPastReasoningMetadata(scopedHistory, {}).filter((message) => message.providerMetadata).length, 0);
const prefill = { role: "assistant", content: "", providerMetadata: { partial: true, reasoning_content: "prefill" } };
const currentToolRound = { role: "assistant", content: "", providerMetadata: { encryptedReasoning: [toolReasoning] } };
const withCurrentTurn = limitPastReasoningMetadata([...scopedHistory, prefill, currentToolRound], {
  excludePastReasoning: false,
});
assert.deepEqual(
  withCurrentTurn.slice(-2),
  [prefill, currentToolRound],
  "Prefill and current tool rounds are not past history",
);

const assembled = await assemblePrompt({
  db: undefined as never,
  preset: {
    id: "reasoning",
    name: "Reasoning",
    sectionOrder: '["history"]',
    groupOrder: "[]",
    wrapFormat: "none",
    parameters: JSON.stringify({ strictRoleFormatting: true }),
    variableGroups: "[]",
    variableValues: "{}",
  },
  sections: [
    {
      id: "history",
      presetId: "reasoning",
      identifier: "chatHistory",
      name: "Chat History",
      content: "",
      role: "system",
      enabled: "true",
      isMarker: "true",
      groupId: null,
      markerConfig: JSON.stringify({ type: "chat_history" }),
      injectionPosition: "ordered",
      injectionDepth: 0,
      injectionOrder: 0,
      forbidOverrides: "false",
    },
  ],
  groups: [],
  choiceBlocks: [],
  chatChoices: {},
  chatId: "reasoning",
  characterIds: [],
  personaName: "User",
  personaDescription: "",
  chatMessages: scopedHistory.map(({ role, content, providerMetadata }) => ({ role, content, providerMetadata })),
});
assert.deepEqual(
  assembled.messages.filter((message) => message.role === "assistant").map((message) => message.providerMetadata),
  scopedHistory.map((message) => message.providerMetadata),
  "Strict role formatting must retain each reasoning block's original assistant boundary",
);

for (const key of ["reasoning_content", "reasoning"]) {
  const largeThinking: ChatMessage[] = [
    { role: "system", content: "Instructions." },
    {
      role: "assistant",
      content: "Short answer",
      contextKind: "history",
      providerMetadata: { [key]: "thinking ".repeat(10_000) },
    },
    { role: "user", content: "Next turn." },
  ];
  const fit = fitMessagesToContext(largeThinking, { maxContext: 4096, maxTokens: 512 });
  assert.ok(fit.trimmed, "Plaintext thinking must count fully toward the local context budget");
  assert.equal(
    fit.messages.some((message) => message.providerMetadata?.[key]),
    false,
  );
  assert.equal(
    largeThinking[1]?.providerMetadata?.[key],
    "thinking ".repeat(10_000),
    "Context fitting must not erase saved thinking",
  );
}

for (const providerMetadata of [
  { reasoning_details: [{ type: "reasoning.text", text: "thinking ".repeat(10_000) }] },
  { geminiParts: [{ thought: true, text: "thinking ".repeat(10_000), thoughtSignature: "signed" }] },
  { encryptedReasoning: [{ ...reasoning("rs_large"), encrypted_content: "opaque ".repeat(10_000) }] },
]) {
  const largeHistory: ChatMessage = { role: "assistant", content: "", contextKind: "history", providerMetadata };
  const saved = JSON.stringify(largeHistory);
  const budget = { maxContext: 4096, maxTokens: 512 };
  const fit = fitMessagesToContext([largeHistory, { role: "user", content: "Next turn." }], budget);
  assert.ok(fit.trimmed, "Structured replay payloads must not hide behind the opaque metadata cap");
  assert.ok(fit.estimatedTokensBefore > fit.inputBudget!);
  assert.ok(fit.estimatedTokensAfter <= fit.inputBudget!);
  assert.equal(
    fit.messages.some((message) => message.providerMetadata),
    false,
  );
  const untrimmable = fitMessagesToContext([largeHistory], budget);
  assert.ok(
    untrimmable.estimatedTokensAfter > untrimmable.inputBudget!,
    "A retained final reasoning-only turn must not be falsely reported as under budget",
  );
  assert.equal(JSON.stringify(largeHistory), saved, "Budget estimates never mutate signed replay payloads");
}

console.log("past reasoning history: ok");
