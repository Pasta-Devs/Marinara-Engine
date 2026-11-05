// Guards two Professor Mari workspace-loop failure modes.
//
// 1. Withheld replies. The completion-claim audit and the "no commands, no stop"
//    path both discard a frame's `say` before it reaches the user, but the frame
//    stays in Mari's history. Without being told, she assumed the user saw it and
//    ended runs with "I checked ... the original plan I made is still there",
//    referencing a plan the user never saw. Repair prompts now carry
//    MARI_WITHHELD_REPLY_NOTICE, and the protocol says hidden reasoning is never shown.
//    Separately, only the final round's say is saved as her answer, so a plan written
//    in an earlier round ends up in the step timeline; the protocol now says to repeat it.
//
// 2. OpenRouter limits. A connection's Max Tokens is often copied from the model's whole
//    window (943,718 for a 1M Kimi K3.1 Pro), and Mari used it as her per-reply budget.
//    OpenRouter reserves credits for every requested output token, so the call failed with
//    402 "can only afford N" before she could act (Gemini 4 Argon managed one step before
//    the growing prompt pushed it over). Mari now caps her budget at MARI_MAX_OUTPUT_TOKENS
//    and retries a 402 or context-overflow rejection with limits learned from the error.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MARI_MAX_OUTPUT_TOKENS,
  MARI_WITHHELD_REPLY_NOTICE,
  mariMaxOutputTokens,
  nextOptionsAfterLimitError,
  parseAffordableMaxTokens,
  parseContextOverflowError,
  workspaceCommandProtocolPrompt,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

// ── Context overflow parsing ──
{
  const openRouter = new Error(
    "OpenRouter error 400: This endpoint's maximum context length is 262144 tokens. However, you requested about 270512 tokens (262320 of text input, 8192 in the output). Please reduce the length of either one.",
  );
  assert.deepEqual(parseContextOverflowError(openRouter), { limit: 262_144 });

  const commaFormatted = new Error("error 400: maximum context length is 131,072 tokens");
  assert.deepEqual(parseContextOverflowError(commaFormatted), { limit: 131_072 });

  const unstated = new Error("error 400: The requested context is too long for this model.");
  assert.deepEqual(parseContextOverflowError(unstated), { limit: null });

  const openAiCode = new Error('error 400: {"code":"context_length_exceeded"}');
  assert.deepEqual(parseContextOverflowError(openAiCode), { limit: null });

  // Unrelated failures must not trigger the retry.
  assert.equal(parseContextOverflowError(new Error("error 429: rate limited")), null);
  assert.equal(parseContextOverflowError(new Error("error 400: invalid response_format")), null);
  assert.equal(parseContextOverflowError(undefined), null);
}

// ── OpenRouter credit limit (402) ──
{
  const credit = new Error(
    "OpenRouter API error 402: This request requires more credits, or fewer max_tokens. You requested up to 929637 tokens, but can only afford 176108. To increase, visit https://openrouter.ai/settings/keys",
  );
  assert.equal(parseAffordableMaxTokens(credit), 176_108);
  assert.equal(parseAffordableMaxTokens(new Error("error 400: bad request")), null);
  // A credit rejection is not mistaken for a context overflow.
  assert.equal(parseContextOverflowError(credit), null);

  // Retry under the affordable budget, with headroom (the reported uncapped request).
  assert.deepEqual(nextOptionsAfterLimitError(credit, { maxTokens: 929_637, maxContext: 1_048_576 }), {
    reason: "Credit limit",
    maxTokens: 158_497,
  });
  // ...which is pointless when the request already asks for less: surface the error.
  assert.equal(nextOptionsAfterLimitError(new Error("402: can only afford 20000"), { maxTokens: 16_000 }), null);
  assert.deepEqual(nextOptionsAfterLimitError(new Error("402: can only afford 20000"), { maxTokens: 32_768 }), {
    reason: "Credit limit",
    maxTokens: 18_000,
  });
  // Too few credits for a usable reply: surface the 402 instead of looping.
  assert.equal(nextOptionsAfterLimitError(new Error("402: can only afford 900"), { maxTokens: 32_768 }), null);
  // Context overflow: use the stated window, or tighten the configured one.
  assert.deepEqual(
    nextOptionsAfterLimitError(new Error("maximum context length is 262144 tokens"), { maxContext: 1_048_576 }),
    { reason: "Context overflow", maxContext: 262_144 },
  );
  assert.deepEqual(nextOptionsAfterLimitError(new Error("context is too long"), { maxContext: 100_000 }), {
    reason: "Context overflow",
    maxContext: 75_000,
  });
  assert.equal(nextOptionsAfterLimitError(new Error("error 500: upstream"), { maxTokens: 32_768 }), null);
}

// ── Output budget cap ──
{
  const connection = (fields: Record<string, unknown>) =>
    ({
      id: "c",
      name: "c",
      provider: "openrouter",
      model: "moonshotai/kimi-k3.1-pro",
      defaultParameters: null,
      ...fields,
    }) as unknown as Parameters<typeof mariMaxOutputTokens>[0];
  // The reported connection: Max Tokens copied from the 1M window.
  assert.equal(mariMaxOutputTokens(connection({ maxTokensOverride: 943_718 })), MARI_MAX_OUTPUT_TOKENS);
  assert.equal(
    mariMaxOutputTokens(connection({ defaultParameters: JSON.stringify({ maxTokens: 500_000 }) })),
    MARI_MAX_OUTPUT_TOKENS,
  );
  // Smaller limits are untouched.
  assert.equal(mariMaxOutputTokens(connection({ maxTokensOverride: 65_536 })), MARI_MAX_OUTPUT_TOKENS);
  assert.equal(mariMaxOutputTokens(connection({ maxTokensOverride: 4_096 })), 4_096);
  assert.equal(mariMaxOutputTokens(connection({})), 8_192);
}

// ── Withheld-reply guidance ──
{
  assert.match(MARI_WITHHELD_REPLY_NOTICE, /did NOT see/u);
  assert.match(MARI_WITHHELD_REPLY_NOTICE, /original plan is still there/u);

  const protocol = workspaceCommandProtocolPrompt();
  assert.match(protocol, /hidden reasoning\/thinking is NEVER shown/u);
  // Only the final round's say is saved as the answer (earlier rounds collapse
  // into the timeline), so the protocol must tell Mari to repeat the plan there.
  assert.match(protocol, /Only your final `say`/u);

  // Both silent-discard repair paths (claim audit, and no-commands-without-stop)
  // must attach the notice.
  const source = readFileSync(
    fileURLToPath(
      new URL("../../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
    ),
    "utf8",
  );
  const uses = source.match(/\$\{MARI_WITHHELD_REPLY_NOTICE\}/gu) ?? [];
  assert.ok(uses.length >= 2, `expected the notice in both repair prompts, found ${uses.length}`);
}

console.log("professor-mari agent-loop resilience regressions passed");
