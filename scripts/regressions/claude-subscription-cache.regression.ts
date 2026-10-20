import assert from "node:assert/strict";
import { logger } from "../../packages/server/src/lib/logger.js";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";
import {
  __setSdkForTesting,
  ClaudeSubscriptionProvider,
} from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";

const originalDebug = logger.debug;
let logged: Record<string, unknown> | undefined;
let sdkOptions: Record<string, unknown> = {};
let usage: Record<string, unknown> = {};
logger.debug = ((data: Record<string, unknown>, message: string) => {
  if (message === "[claude-subscription] prompt-cache usage") logged = data;
}) as typeof logger.debug;
__setSdkForTesting({
  query: ((args: { options: Record<string, unknown> }) => {
    sdkOptions = args.options;
    return (async function* () {
      yield { type: "result", subtype: "success", result: "Cached reply", usage };
    })();
  }) as never,
});
try {
  const provider = new ClaudeSubscriptionProvider("", "");
  for (const [fiveMinute, oneHour, writes, expectedCost] of [
    [100, 0, 100, 245],
    [0, 100, 100, 320],
    [60, 40, 100, 275],
    [undefined, undefined, 100, null],
    [0, 40, 100, null],
    [undefined, undefined, 0, 120],
  ] as const) {
    usage = {
      input_tokens: 100,
      output_tokens: 12,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: writes,
      ...(fiveMinute === undefined
        ? {}
        : {
            cache_creation: { ephemeral_5m_input_tokens: fiveMinute, ephemeral_1h_input_tokens: oneHour },
          }),
    };
    logged = undefined;
    const result = await provider.chatComplete([{ role: "user", content: "Hello" }], {
      model: "claude-opus-5",
      anthropicExtendedCacheTtl: true,
    });
    assert.equal(result.content, "Cached reply");
    assert.deepEqual(sdkOptions.settings, { fastMode: false, promptCacheTtl: "1h" });
    assert.deepEqual(sdkOptions.settingSources, [], "cache settings must not load user/project tools or hooks");
    assert.ok(logged);
    assert.equal(logged.cacheWrite5mTokens, fiveMinute ?? 0);
    assert.equal(logged.cacheWrite1hTokens, oneHour ?? 0);
    assert.equal(logged.cacheWriteTokens, writes);
    assert.equal(logged.effectiveInputCostEquiv, expectedCost, "use reported TTL buckets, never assume five minutes");
    assert.equal(logged.savedTokenEquiv, expectedCost === null ? null : 300 + writes - expectedCost);
    if (expectedCost === null) assert.equal(logged.verdict, "unknown-cache-ttl");
  }
  await provider.chatComplete([{ role: "user", content: "Hello" }], { model: "claude-opus-5" });
  assert.deepEqual(sdkOptions.settings, { fastMode: false }, "off preserves Claude's account-dependent default TTL");

  // With the 1-hour cache on, the resumed history carries one cache marker, on the newest reply
  // that isn't the last history entry: that entry holds the moving </chat_history> close.
  const history: ChatMessage[] = [
    { role: "system" as const, content: "System" },
    { role: "user" as const, content: "<chat_history>\nOne" },
    { role: "assistant" as const, content: "Reply one" },
    { role: "user" as const, content: "Two" },
    { role: "assistant" as const, content: "Reply two" },
    { role: "user" as const, content: "Three" },
    { role: "assistant" as const, content: "Reply three\n</chat_history>" },
    { role: "user" as const, content: "<context>per turn</context>\n<last_message>\nFour\n</last_message>" },
  ];
  const markedBlocks = async (messages: typeof history, extended: boolean) => {
    await provider.chatComplete(messages, { model: "claude-opus-5", anthropicExtendedCacheTtl: extended });
    const store = sdkOptions.sessionStore as { load(key: { sessionId: string }): Promise<unknown[] | null> };
    const entries = (await store.load({ sessionId: sdkOptions.resume as string })) as {
      message: { content: string | { text?: string; name?: string; cache_control?: unknown }[] };
    }[];
    return entries.flatMap((entry) =>
      Array.isArray(entry.message.content)
        ? entry.message.content
            .filter((block) => block.cache_control)
            .map((block) => [block.text ?? block.name, block.cache_control])
        : [],
    );
  };
  assert.deepEqual(
    await markedBlocks(history, true),
    [["Reply two", { type: "ephemeral", ttl: "1h" }]],
    "one 1h history marker, before the moving wrapper close",
  );
  assert.deepEqual(await markedBlocks(history, false), [], "no history marker without the 1-hour cache");
  // A reply made only of tool calls is marked on its last tool call.
  const toolOnly: typeof history = [
    ...history.slice(0, 4),
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "roll_dice", arguments: "{}" } }],
    },
    { role: "tool", content: "4", tool_call_id: "call_1" },
    ...history.slice(6),
  ];
  assert.deepEqual(
    await markedBlocks(toolOnly, true),
    [["roll_dice", { type: "ephemeral", ttl: "1h" }]],
    "a tool-only reply keeps the history marker",
  );
  const replyWith = (reply: ChatMessage): ChatMessage[] => [...history.slice(0, 4), reply, ...history.slice(5)];
  assert.deepEqual(
    await markedBlocks(
      replyWith({
        role: "assistant",
        content: "I'll roll.",
        tool_calls: [{ id: "call_2", type: "function", function: { name: "roll_dice", arguments: "{}" } }],
      }),
      true,
    ),
    [["roll_dice", { type: "ephemeral", ttl: "1h" }]],
    "a text-and-tool reply is marked on its final tool call",
  );
  assert.deepEqual(
    await markedBlocks(replyWith({ role: "assistant", content: "" }), true),
    [["Reply one", { type: "ephemeral", ttl: "1h" }]],
    "an empty reply passes the marker to the reply before it",
  );
} finally {
  logger.debug = originalDebug;
  __setSdkForTesting(null);
}
console.log("Claude subscription cache regression passed");
