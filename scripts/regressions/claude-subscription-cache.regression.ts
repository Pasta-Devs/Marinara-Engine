import assert from "node:assert/strict";
import { logger } from "../../packages/server/src/lib/logger.js";
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
} finally {
  logger.debug = originalDebug;
  __setSdkForTesting(null);
}
console.log("Claude subscription cache regression passed");
