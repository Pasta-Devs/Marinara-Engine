// Guards prompt survival when a connection's stored max_tokens eats most of the context window.
//
// Single-shot prompts (Noodle refreshes, summarizers) carry no messages marked contextKind
// "history", so the trimmer has nothing it may safely drop. It used to delete the prompt body
// anyway and send only the trailing instruction, which reaches the model as a request with no
// content to work from — and no error anywhere.
import assert from "node:assert/strict";
import { fitMessagesToContext } from "../../packages/server/src/services/llm/base-provider.js";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";

const filler = (approximateTokens: number) => "word ".repeat(approximateTokens);

// Shaped like a Noodle timeline refresh: system rules, the context body, then the JSON format
// instruction. Nothing is annotated as history, because none of it is history.
const singleShotPrompt: ChatMessage[] = [
  { role: "system", content: filler(1000) },
  { role: "user", content: `# Active Noodle Accounts\n# Character Profiles\n${filler(3000)}` },
  { role: "user", content: `# JSON Output Format\n${filler(350)}` },
];

// A stored max_tokens of 32768 against a 36864 context window leaves an input budget far smaller
// than the prompt — the exact shape of the reported failure.
const squeezed = fitMessagesToContext(singleShotPrompt, { maxContext: 36864, maxTokens: 32768 });

// The prompt body must survive.
assert.equal(squeezed.messages.length, 3, "no message may be dropped from a single-shot prompt");
assert.match(squeezed.messages[1]!.content ?? "", /# Character Profiles/);

// The output budget yields instead, and must stay usable rather than collapsing to the floor.
assert.ok(
  squeezed.maxTokens !== undefined && squeezed.maxTokens < 32768,
  "max_tokens should be reduced to make room for the prompt",
);
assert.ok(squeezed.maxTokens! > 1000, `max_tokens collapsed to ${squeezed.maxTokens}`);

// A comfortable window changes nothing.
const roomy = fitMessagesToContext(singleShotPrompt, { maxContext: 98304, maxTokens: 32768 });
assert.equal(roomy.trimmed, false);
assert.equal(roomy.messages.length, 3);
assert.equal(roomy.maxTokens, 32768);

// Conversations still trim their history: that content is explicitly marked as expendable.
const conversation: ChatMessage[] = [
  { role: "system", content: filler(500) },
  { role: "user", content: `oldest turn ${filler(3000)}`, contextKind: "history" },
  { role: "assistant", content: `reply ${filler(3000)}`, contextKind: "history" },
  { role: "user", content: filler(200) },
];
const trimmedChat = fitMessagesToContext(conversation, { maxContext: 8192, maxTokens: 1024 });
assert.ok(trimmedChat.trimmed, "an oversized conversation should still trim history");
assert.ok(
  trimmedChat.messages.length < conversation.length,
  "history messages should still be removable when annotated",
);

// With no context window configured nothing is touched at all.
const unbounded = fitMessagesToContext(singleShotPrompt, { maxTokens: 32768 });
assert.equal(unbounded.trimmed, false);
assert.equal(unbounded.messages.length, 3);

process.stdout.write("Context fit regression passed.\n");
