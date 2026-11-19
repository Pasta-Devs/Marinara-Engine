// Conversation applies display regex scripts with each message's depth in the transcript (#4237-#4240): stored,
// regenerating and streaming messages alike, and message parts too. Reads component source until a test can drive it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../../../packages/client/src/components/chat/${path}`, import.meta.url), "utf8");
const conversationMessageSource = read("ConversationMessage.tsx");
const conversationViewSource = read("ConversationView.tsx");
assert.match(
  conversationMessageSource,
  /applyToAIOutput\(message\.content,[\s\S]{0,240}depth: messageDepth/u,
  "Conversation messages must apply display regex scripts with their transcript depth",
);
assert.match(
  conversationMessageSource,
  /applyToAIOutput\(part,[\s\S]{0,240}depth: messageDepth/u,
  "Conversation message parts must not bypass display regex scripts",
);
assert.match(
  conversationViewSource,
  /const messageDepth = Math\.max\(0, totalMessageCount - 1 - item\.index\);/u,
  "Conversation regex depth must be derived for every rendered transcript item",
);
assert.ok(
  (conversationViewSource.match(/messageDepth=\{messageDepth\}/gu)?.length ?? 0) >= 2,
  "Stored and regenerating Conversation messages must share their transcript depth",
);
assert.match(
  conversationViewSource,
  /liveStreamMessage[\s\S]{0,900}messageDepth=\{0\}/u,
  "A live Conversation stream must apply depth-scoped regex as the newest message",
);
