import assert from "node:assert/strict";
import {
  __setSdkForTesting,
  ClaudeSubscriptionProvider,
} from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";
import {
  assembleEntries,
  buildAssistantPrefillContinuationPrompt,
  selectHistoryBreakpointIndex,
  splitHistoryForResume,
} from "../../packages/server/src/services/llm/providers/claude-subscription/jsonl-entries.js";

const captured: Array<Record<string, unknown>> = [];
const capturedPrompts: unknown[] = [];
const fakeSdk = {
  query: ((args: { options: Record<string, unknown>; prompt: unknown }) => {
    captured.push(args.options);
    capturedPrompts.push(args.prompt);
    return (async function* () {
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } },
      };
      yield {
        type: "result",
        subtype: "success",
        result: "",
        usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        modelUsage: { "claude-opus-5": {} },
        fast_mode_state: "off",
      };
    })();
  }) as never,
};
__setSdkForTesting(fakeSdk);

async function collect(provider: ClaudeSubscriptionProvider, messages: Parameters<typeof provider.chat>[0]) {
  let output = "";
  for await (const chunk of provider.chat(messages, { model: "claude-opus-5", stream: true })) output += chunk;
  return output;
}

const previousResumeFlag = process.env.CLAUDE_SUBSCRIPTION_USE_RESUME;
process.env.CLAUDE_SUBSCRIPTION_USE_RESUME = "false";
try {
  const provider = new ClaudeSubscriptionProvider("", "");
  const lore = {
    role: "system" as const,
    content: "Stable canon",
    providerMetadata: { marinaraFullLoreContext: true },
  };
  await collect(provider, [
    lore,
    { role: "system", content: "Stable instructions" },
    { role: "system", content: "Memory A", providerMetadata: { marinaraRuntimeContext: true } },
    { role: "user", content: "Turn" },
  ]);
  await collect(provider, [
    lore,
    { role: "system", content: "Stable instructions" },
    { role: "system", content: "Memory B", providerMetadata: { marinaraRuntimeContext: true } },
    { role: "user", content: "Turn" },
  ]);

  const firstPrompt = captured[0]?.systemPrompt;
  const secondPrompt = captured[1]?.systemPrompt;
  assert.ok(Array.isArray(firstPrompt));
  assert.ok(Array.isArray(secondPrompt));
  assert.deepEqual(firstPrompt?.slice(0, 3), [
    "Stable canon",
    "Stable instructions",
    "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__",
  ]);
  assert.deepEqual(secondPrompt?.slice(0, 3), firstPrompt?.slice(0, 3));
  assert.deepEqual(firstPrompt.slice(3), ["Memory A"]);
  assert.deepEqual(secondPrompt.slice(3), ["Memory B"]);
  assert.equal(capturedPrompts[0], "User: Turn");
  assert.equal(capturedPrompts[1], "User: Turn");

  captured.length = 0;
  await collect(provider, [
    { role: "system", content: "Ordinary system" },
    { role: "user", content: "Turn" },
  ]);
  assert.equal(captured[0]?.systemPrompt, "Ordinary system");
} finally {
  if (previousResumeFlag === undefined) delete process.env.CLAUDE_SUBSCRIPTION_USE_RESUME;
  else process.env.CLAUDE_SUBSCRIPTION_USE_RESUME = previousResumeFlag;
  __setSdkForTesting(null);
}

const resumePreviousFlag = process.env.CLAUDE_SUBSCRIPTION_USE_RESUME;
const previousCacheEnvironment = Object.fromEntries(
  ["FORCE_PROMPT_CACHING_5M", "ENABLE_PROMPT_CACHING_1H", "ANTHROPIC_API_KEY"].map((key) => [key, process.env[key]]),
);
for (const key of Object.keys(previousCacheEnvironment)) delete process.env[key];
process.env.CLAUDE_SUBSCRIPTION_USE_RESUME = "true";
try {
  captured.length = 0;
  capturedPrompts.length = 0;
  __setSdkForTesting(fakeSdk);
  const provider = new ClaudeSubscriptionProvider("", "");
  await collect(provider, [
    { role: "system", content: "Stable canon", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "user", content: "Earlier turn" },
    { role: "system", content: "Current runtime state", providerMetadata: { marinaraRuntimeContext: true } },
  ]);
  assert.equal(typeof captured[0]?.resume, "string");
  assert.ok(captured[0]?.sessionStore);
  const replayEntries = await (
    captured[0]?.sessionStore as { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
  ).load({ sessionId: String(captured[0]?.resume), projectKey: "synthetic" });
  assert.equal(replayEntries.length, 1);
  assert.deepEqual((replayEntries[0] as { message: { content: unknown } }).message.content, [
    { type: "text", text: "Earlier turn" },
  ]);
  const promptItems: Array<{ message: { content: string | unknown[] } }> = [];
  for await (const item of capturedPrompts[0] as AsyncIterable<{ message: { content: string | unknown[] } }>) {
    promptItems.push(item);
  }
  assert.equal(promptItems.length, 1);
  assert.match(String(promptItems[0]?.message.content), /Current runtime state/);

  const markedHistory = [
    { role: "system" as const, content: "Stable lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "assistant" as const, content: "Stable answer", contextKind: "history" as const },
    { role: "user" as const, content: "Runtime state", contextKind: "injection" as const },
    { role: "user" as const, content: "Current", contextKind: "history" as const },
  ];
  await collect(provider, markedHistory);
  assert.equal((captured.at(-1)?.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, "1");
  const markedReplay = await (
    captured.at(-1)?.sessionStore as { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
  ).load({ sessionId: String(captured.at(-1)?.resume), projectKey: "synthetic" });
  assert.deepEqual((markedReplay[0] as { message: { content: unknown[] } }).message.content, [
    { type: "text", text: "Stable answer", cache_control: { type: "ephemeral", ttl: "1h" } },
  ]);

  const previousForce = process.env.FORCE_PROMPT_CACHING_5M;
  process.env.FORCE_PROMPT_CACHING_5M = "1";
  await collect(provider, markedHistory);
  assert.equal((captured.at(-1)?.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, undefined);
  if (previousForce === undefined) delete process.env.FORCE_PROMPT_CACHING_5M;
  else process.env.FORCE_PROMPT_CACHING_5M = previousForce;
  const forcedReplay = await (
    captured.at(-1)?.sessionStore as { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
  ).load({ sessionId: String(captured.at(-1)?.resume), projectKey: "synthetic" });
  assert.deepEqual((forcedReplay[0] as { message: { content: unknown[] } }).message.content, [
    { type: "text", text: "Stable answer", cache_control: { type: "ephemeral", ttl: "5m" } },
  ]);

  const apiProvider = new ClaudeSubscriptionProvider("", "explicit-api-key");
  await collect(apiProvider, markedHistory);
  assert.equal((captured.at(-1)?.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, undefined);
  const apiReplay = await (
    captured.at(-1)?.sessionStore as { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
  ).load({ sessionId: String(captured.at(-1)?.resume), projectKey: "synthetic" });
  assert.deepEqual((apiReplay[0] as { message: { content: unknown[] } }).message.content, [
    { type: "text", text: "Stable answer" },
  ]);
  process.env.ANTHROPIC_API_KEY = "synthetic-inherited-key";
  await collect(provider, markedHistory);
  assert.equal((captured.at(-1)?.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, undefined);
  const inheritedReplay = await (
    captured.at(-1)?.sessionStore as { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
  ).load({ sessionId: String(captured.at(-1)?.resume), projectKey: "synthetic" });
  assert.deepEqual((inheritedReplay[0] as { message: { content: unknown[] } }).message.content, [
    { type: "text", text: "Stable answer" },
  ]);
  delete process.env.ANTHROPIC_API_KEY;
  // No cache markers: the request is exactly what it was before (string system prompt, string user
  // entries, no history marker, no one-hour caching variable).
  await collect(provider, [
    { role: "system", content: "Plain system" },
    { role: "user", content: "Earlier turn", contextKind: "history" },
    { role: "assistant", content: "Earlier answer", contextKind: "history" },
    { role: "user", content: "Current", contextKind: "history" },
  ]);
  assert.equal(captured.at(-1)?.systemPrompt, "Plain system");
  assert.equal((captured.at(-1)?.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, undefined);
  const plainReplay = await (
    captured.at(-1)?.sessionStore as { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
  ).load({ sessionId: String(captured.at(-1)?.resume), projectKey: "synthetic" });
  assert.equal((plainReplay[0] as { message: { content: unknown } }).message.content, "Earlier turn");
  assert.deepEqual((plainReplay[1] as { message: { content: unknown[] } }).message.content, [
    { type: "text", text: "Earlier answer" },
  ]);
  assert.equal(process.env.ENABLE_PROMPT_CACHING_1H, undefined, "query lifetime does not mutate process settings");
} finally {
  for (const [key, value] of Object.entries(previousCacheEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (resumePreviousFlag === undefined) delete process.env.CLAUDE_SUBSCRIPTION_USE_RESUME;
  else process.env.CLAUDE_SUBSCRIPTION_USE_RESUME = resumePreviousFlag;
  __setSdkForTesting(null);
}

const split = splitHistoryForResume([
  { role: "user", content: "Question" },
  { role: "assistant", content: "Prefill" },
]);
assert.equal(split.shape, "trailing-assistant-continue");
assert.equal(split.history.length, 1);
assert.equal(split.current.content, buildAssistantPrefillContinuationPrompt("Prefill"));

const entries = assembleEntries(
  [
    { role: "user", content: "Question" },
    {
      role: "assistant",
      content: "Tool call",
      tool_calls: [{ id: "tool-1", type: "function", function: { name: "roll", arguments: '{"sides":20}' } }],
    },
    { role: "tool", content: "20", tool_call_id: "tool-1" },
  ],
  {
    sessionId: "session-1",
    cwd: "C:\\scratch",
    version: "0.3.235",
    gitBranch: "main",
    permissionMode: "bypassPermissions",
  },
  "claude-opus-5",
);
// Unmarked requests keep upstream's plain string user entries.
assert.equal((entries[0] as { message: { content: unknown } }).message.content, "Question");
const blockEntries = assembleEntries(
  [{ role: "user", content: "Question" }],
  {
    sessionId: "session-blocks",
    cwd: "C:\\scratch",
    version: "0.3.235",
    gitBranch: "main",
    permissionMode: "bypassPermissions",
  },
  "claude-opus-5",
  { textBlocks: true },
);
assert.deepEqual((blockEntries[0] as { message: { content: unknown } }).message.content, [
  { type: "text", text: "Question" },
]);
assert.equal(entries[1]?.type, "assistant");
assert.equal(
  (entries[1] as { message: { content: Array<{ type?: string; id?: string }> } }).message.content.find(
    (block) => block.type === "tool_use",
  )?.id,
  "tool-1",
);
assert.equal(entries[2]?.type, "user");
assert.equal(
  (entries[2] as { message: { content: Array<{ tool_use_id?: string }> } }).message.content[0]?.tool_use_id,
  "tool-1",
);

const breakpointMessages = [
  { role: "system" as const, content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
  { role: "assistant" as const, content: "Stable answer", contextKind: "history" as const },
  { role: "user" as const, content: "Mutable runtime state", contextKind: "injection" as const },
  { role: "user" as const, content: "Current question", contextKind: "history" as const },
];
const breakpointCopy = JSON.stringify(breakpointMessages);
assert.equal(selectHistoryBreakpointIndex(breakpointMessages), 0);
const markedEntries = assembleEntries(
  breakpointMessages.slice(1, -1),
  {
    sessionId: "session-breakpoint",
    cwd: "C:\\scratch",
    version: "0.3.235",
    gitBranch: "main",
    permissionMode: "bypassPermissions",
  },
  "claude-opus-5",
  { historyBreakpointIndex: 0, historyBreakpointTtl: "1h" },
);
assert.deepEqual((markedEntries[0] as { message: { content: unknown[] } }).message.content, [
  { type: "text", text: "Stable answer", cache_control: { type: "ephemeral", ttl: "1h" } },
]);
assert.equal(markedEntries.filter((entry) => entry.type === "assistant").length, 1);
assert.equal(JSON.stringify(breakpointMessages), breakpointCopy);
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "assistant", content: "Answer", contextKind: "history" },
  ]),
  null,
);
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "system", content: "Dynamic", providerMetadata: { marinaraRuntimeContext: true } },
    ...breakpointMessages.slice(1),
  ]),
  null,
);
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "assistant", content: "Answer", contextKind: "history", images: ["data:image/png;base64,AA=="] },
    ...breakpointMessages.slice(2),
  ]),
  null,
);
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "assistant", content: "Answer", contextKind: "history", files: [{ type: "document", data: "AA==" }] },
    ...breakpointMessages.slice(2),
  ]),
  null,
);
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    {
      role: "assistant",
      content: "Answer",
      contextKind: "history",
      media: [{ kind: "audio", data: "AA==", mimeType: "audio/wav" }],
    },
    ...breakpointMessages.slice(2),
  ]),
  null,
);
assert.equal(
  selectHistoryBreakpointIndex(
    breakpointMessages.map((message, index) =>
      index === breakpointMessages.length - 1 ? { ...message, contextKind: "injection" as const } : message,
    ),
  ),
  null,
);
// A turn may end on an injection placed after the user turn. The marker still goes on the last completed
// assistant turn: without it the next turn wrote the whole history again (61% cached on a 520k-token prompt).
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "assistant", content: "Stable answer", contextKind: "history" },
    { role: "user", content: "Scene state", contextKind: "injection" },
    { role: "user", content: "Current question", contextKind: "history" },
    { role: "user", content: "Recalled memory", contextKind: "injection" },
    { role: "user", content: "Final check", contextKind: "injection" },
  ]),
  0,
  "a tail that ends on an injection keeps the history marker",
);
// A completed user turn in the tail (two user history turns after the candidate) is not a mutable suffix.
assert.equal(
  selectHistoryBreakpointIndex([
    { role: "system", content: "Lore", providerMetadata: { marinaraFullLoreContext: true } },
    { role: "assistant", content: "Stable answer", contextKind: "history" },
    { role: "user", content: "Earlier question", contextKind: "history" },
    { role: "user", content: "Current question", contextKind: "history" },
  ]),
  null,
);

console.log("claude cache prefix regression passed");
