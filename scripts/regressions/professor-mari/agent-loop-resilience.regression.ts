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
// 2. Context overflow on OpenRouter. Models missing from the catalog with no Max
//    Context on the connection got no client-side trimming, so a long run failed with
//    "maximum context length is N tokens". parseContextOverflowError feeds a single
//    retry that learns the real window from the error.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MARI_WITHHELD_REPLY_NOTICE,
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
