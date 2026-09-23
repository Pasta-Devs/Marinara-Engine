import assert from "node:assert/strict";
import {
  addGenerationUsage,
  getRequestContextTokens,
  getRequestInputTokens,
} from "../../packages/server/src/services/generation/generation-text-utils.js";
import type { LLMUsage } from "../../packages/shared/src/types/generation-integration.js";

// Tool continuations reuse the prompt. Three requests can exceed 65k in billed
// input even though every individual outgoing prompt remains below that limit.
const rounds: LLMUsage[] = [44000, 44500, 45000].map((promptTokens) => ({
  promptTokens,
  completionTokens: 1000,
  totalTokens: promptTokens + 1000,
}));
const billed = rounds.reduce<LLMUsage | undefined>(addGenerationUsage, undefined);
assert.equal(billed?.promptTokens, 133500);
assert.equal(billed?.completionTokens, 3000);
assert.equal(getRequestInputTokens(rounds.at(-1), "anthropic"), 45000);
assert.equal(getRequestContextTokens(rounds.at(-1), "anthropic"), 46000);
assert(rounds.every((round) => getRequestInputTokens(round, "anthropic")! < 65000));

const cached: LLMUsage = {
  promptTokens: 1000,
  completionTokens: 8192,
  totalTokens: 9192,
  cachedPromptTokens: 40000,
  cacheWritePromptTokens: 4000,
};
for (const provider of ["anthropic", "claude_subscription"]) {
  assert.equal(getRequestInputTokens(cached, provider), 45000);
  assert.equal(getRequestContextTokens(cached, provider), 53192);
}
for (const provider of ["openai", "openrouter", "custom", "google"]) {
  const inclusive = { ...cached, promptTokens: 45000, totalTokens: 53192 };
  assert.equal(getRequestInputTokens(inclusive, provider), 45000, `${provider} already includes cached input`);
}
assert.equal(getRequestInputTokens(undefined, "anthropic"), null);
assert.equal(getRequestInputTokens({ promptTokens: 0, completionTokens: 5, totalTokens: 5 }, "anthropic"), 0);
for (const invalid of [NaN, Infinity, -1]) {
  assert.equal(getRequestInputTokens({ ...cached, promptTokens: invalid }, "anthropic"), null);
}

process.stdout.write("Generation usage regression passed.\n");
