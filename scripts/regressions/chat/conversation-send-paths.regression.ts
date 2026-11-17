// Conversation sends: a failed post with a presence delay or Post only rolls back and restores the draft, and
// Character Exchanges generate for the first exchange character. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const foregroundAutonomousSource = readFileSync(
  new URL("../../../packages/client/src/hooks/use-autonomous-messaging.ts", import.meta.url),
  "utf8",
);
assert.match(
  foregroundAutonomousSource,
  /triggerAutonomousGeneration\(exchange\.characterIds\[0\]!\)/u,
  "Character Exchanges should start a separate targeted Individual generation",
);
const conversationInputSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ConversationInput.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  conversationInputSource.match(/createDurableMessageWithRollback\(\{/gu)?.length,
  2,
  "presence-delay and post-only persistence should share the rollback helper",
);
