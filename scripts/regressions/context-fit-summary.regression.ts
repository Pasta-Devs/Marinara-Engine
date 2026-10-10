// Guards that fitMessagesForModelAccess surfaces what a context fit cut, so the generate route
// and the dry-run route can save/report generationInfo.contextFit instead of discarding the fit
// result (slice 60, R1). Both routes call this one function, so it is the shared root to test.
import assert from "node:assert/strict";
import { fitMessagesForModelAccess } from "../../packages/server/src/services/generation/model-access-policy.js";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";
import type { ModelAccessPolicy } from "../../packages/server/src/services/generation/model-access-policy.js";

const filler = (approximateWords: number) => "word ".repeat(approximateWords);

const policyWithContext = (effectiveMaxContext: number): ModelAccessPolicy => ({
  suppressModelParameters: false,
  effectiveMaxContext,
  connectionMaxContext: effectiveMaxContext,
});

// A long conversation squeezed into a small window: several oldest turns must be dropped.
const longConversation: ChatMessage[] = [
  { role: "system", content: filler(50) },
  ...Array.from({ length: 10 }, (_, i): ChatMessage => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `turn ${i} ${filler(300)}`,
    contextKind: "history",
  })),
  { role: "user", content: filler(50) },
];

const squeezed = fitMessagesForModelAccess({
  messages: longConversation,
  policy: policyWithContext(1200),
  maxTokens: 256,
});

assert.equal(squeezed.contextFit.trimmed, true, "a squeezed conversation must report trimmed");
assert.ok(squeezed.contextFit.droppedHistory > 0, "at least one history message must count as dropped");
assert.ok(
  squeezed.contextFit.tokensAfter <= squeezed.contextFit.tokensBefore,
  "tokensAfter must never exceed tokensBefore",
);
assert.ok(squeezed.contextFit.inputBudget > 0, "a bounded context must report a positive input budget");
assert.ok(
  squeezed.contextFit.replyBudgetTo <= squeezed.contextFit.replyBudgetFrom,
  "the reply budget may only shrink to make room, never grow",
);

// A single oversized system message with no history-tagged content exercises "nothing removable
// is history": the fitter may still truncate it to fit, but that is not a dropped history message.
const systemOnly: ChatMessage[] = [{ role: "system", content: filler(4000) }];
const systemSqueeze = fitMessagesForModelAccess({
  messages: systemOnly,
  policy: policyWithContext(512),
  maxTokens: 64,
});
assert.equal(
  systemSqueeze.contextFit.droppedHistory,
  0,
  'content with no contextKind "history" tag must never count as dropped history',
);

// A roomy window changes nothing: both routes must see trimmed: false with no history dropped.
const roomy = fitMessagesForModelAccess({
  messages: longConversation,
  policy: policyWithContext(98304),
  maxTokens: 256,
});
assert.equal(roomy.contextFit.trimmed, false, "a roomy context must not report trimmed");
assert.equal(roomy.contextFit.droppedHistory, 0, "nothing should be dropped when everything fits");
assert.equal(roomy.contextFit.tokensAfter, roomy.contextFit.tokensBefore);

process.stdout.write("Context fit summary regression passed.\n");
