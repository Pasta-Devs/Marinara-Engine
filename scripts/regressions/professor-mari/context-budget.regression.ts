// The context usage gauge's numbers for Professor Mari and for chats: used tokens include every input token and the
// latest reply, the latest request wins, JSON-encoded message metadata is read, and a chat shows a limit only for
// its own selected connection.
import assert from "node:assert/strict";
import type { Message } from "../../../packages/shared/src/types/chat.js";
import {
  formatCompactTokenCount,
  resolveChatContextBudget,
  resolveProfessorMariContextBudget,
} from "../../../packages/client/src/lib/professor-mari-context-budget.js";

const professorMariContextBudget = resolveProfessorMariContextBudget(
  [
    {
      role: "assistant",
      extra: { generationInfo: { tokensPrompt: 12_000, tokensCompletion: 345 } },
    },
  ] as Message[],
  128_000,
);
assert.deepEqual(professorMariContextBudget, {
  usedTokens: 12_345,
  maxTokens: 128_000,
  percentage: (12_345 / 128_000) * 100,
});
assert.equal(formatCompactTokenCount(professorMariContextBudget!.usedTokens), "12.3k");
assert.equal(
  resolveProfessorMariContextBudget(
    [
      {
        role: "assistant",
        extra: {
          generationInfo: {
            tokensPrompt: 3_500,
            tokensCachedPrompt: 75_000,
            tokensCacheWritePrompt: 5_000,
            tokensCompletion: 2_000,
          },
        },
      },
    ] as Message[],
    128_000,
  )?.usedTokens,
  85_500,
  "context usage must include all Anthropic input tokens and the current response",
);
assert.equal(
  resolveProfessorMariContextBudget(
    [
      { role: "assistant", extra: { generationInfo: { usage: { promptTokens: 8_000, completionTokens: 192 } } } },
    ] as Message[],
    32_000,
  )?.usedTokens,
  8_192,
  "legacy Professor Mari usage metadata should keep the context indicator available",
);
assert.equal(resolveProfessorMariContextBudget([], 128_000), null);
for (const tokensContext of [230, 0, null, undefined]) {
  assert.equal(
    resolveProfessorMariContextBudget(
      [
        { role: "assistant", extra: { generationInfo: { tokensPrompt: 100, tokensCompletion: 20 } } },
        {
          role: "assistant",
          extra: {
            generationInfo: {
              tokensPrompt: 300,
              tokensCachedPrompt: 160,
              tokensCompletion: 50,
              requestCount: 2,
              ...(tokensContext !== undefined ? { tokensContext } : {}),
            },
          },
        },
      ] as Message[],
      1000,
    )?.usedTokens ?? null,
    tokensContext ?? null,
    "latest request context wins over billed sums; missing usage must not resurrect an earlier context",
  );
}
assert.equal(
  resolveChatContextBudget(
    [
      {
        role: "assistant",
        extra: JSON.stringify({ generationInfo: { tokensPrompt: 4_000, tokensCompletion: 100 } }),
      },
    ] as Message[],
    "connection-1",
    [{ id: "connection-1", maxContext: 8_000 }] as never,
  )?.usedTokens,
  4_100,
  "chat context usage must parse JSON-encoded message metadata",
);
const contextBudgetConnections = [
  { id: "first", maxContext: 8_000, isDefault: false },
  { id: "default", maxContext: 16_000, isDefault: true },
  { id: "selected", maxContext: 32_000, isDefault: false },
] as never;
const contextBudgetMessages = [
  { role: "assistant", extra: { generationInfo: { tokensPrompt: 1_000, tokensCompletion: 100 } } },
  { role: "user", extra: {} },
  { role: "assistant", extra: { generationInfo: { tokensPrompt: 4_000, tokensCompletion: 100 } } },
] as Message[];
assert.equal(resolveChatContextBudget(contextBudgetMessages, "selected", contextBudgetConnections)?.maxTokens, 32_000);
assert.equal(
  resolveChatContextBudget(contextBudgetMessages, null, contextBudgetConnections),
  null,
  "a chat without a selected connection must not borrow the default connection's context limit",
);
assert.equal(
  resolveChatContextBudget(contextBudgetMessages, "missing", contextBudgetConnections),
  null,
  "a missing selected connection must not borrow another connection's context limit",
);
assert.equal(resolveChatContextBudget(contextBudgetMessages, "__local_sidecar__", [], 24_000)?.maxTokens, 24_000);
assert.equal(
  resolveChatContextBudget(contextBudgetMessages, "selected", contextBudgetConnections)?.usedTokens,
  4_100,
  "chat context usage must use the newest assistant measurement",
);
assert.equal(
  resolveChatContextBudget(
    [{ role: "assistant", extra: { generationInfo: { tokensPrompt: 4_000, tokensCompletion: 100 } } }] as Message[],
    "random",
    [{ id: "a", maxContext: 8_000 }] as never,
  ),
  null,
  "random connection mode must not show a misleading single-connection context budget",
);
