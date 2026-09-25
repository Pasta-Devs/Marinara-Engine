import assert from "node:assert/strict";
import {
  dispatchCapabilityConversationAction,
  parseCapabilityConversationCommands,
  registerCapabilityConversationCommand,
  stripCapabilityConversationCommands,
} from "../../packages/server/src/services/capability-packages/capability-command-registry.service.js";
import { engineEventOwner, visibleTo } from "../../packages/server/src/services/capability-packages/capability-roleplay-events.service.js";

// Audience filter: public always shows; user-only never reaches a model; a private event shows only when
// every character the turn can write is in its audience (so a group turn cannot leak it).
assert.equal(visibleTo("public", []), true);
assert.equal(visibleTo("user-only", ["a"]), false);
assert.equal(visibleTo({ characterIds: ["a"] }, ["a"]), true);
assert.equal(visibleTo({ characterIds: ["a"] }, ["a", "b"]), false);
assert.equal(visibleTo({ characterIds: ["a"] }, []), false);

// Event storage is scoped per chat, so a read for chat A can never surface chat B's events, and the
// idempotency check on write never scans across chats either.
assert.equal(engineEventOwner("chat-a"), "__engine__:chat-a");
assert.notEqual(engineEventOwner("chat-a"), engineEventOwner("chat-b"));

let handled = 0;
const release = registerCapabilityConversationCommand({
  commandType: "phone",
  tags: ["phone"],
  maxPayloadChars: 80,
  validatePayload: (payload) => payload?.includes("send_message") ?? false,
  handler: () => {
    handled += 1;
  },
});

try {
  const [command] = parseCapabilityConversationCommands(
    'Before it goes, [phone:{"action":"send_message","body":"on my way"}]',
  );
  assert.deepEqual(command, {
    type: "capability",
    commandType: "phone",
    payload: '{"action":"send_message","body":"on my way"}',
  });

  const [oversized] = parseCapabilityConversationCommands(`[phone:${"x".repeat(81)}]`);
  assert.equal(oversized?.payload, null);

  // validatePayload rejects anything that is not the declared action.
  const [rejected] = parseCapabilityConversationCommands('[phone:{"action":"delete_all"}]');
  assert.equal(rejected?.payload, null);

  // A JSON payload that itself contains `]` is captured whole (not truncated at the first bracket),
  // and stripping removes the whole tag rather than leaving a `}]` tail in the visible prose.
  const bracketed = '[phone:{"action":"send_message","body":"a]b"}]';
  assert.equal(parseCapabilityConversationCommands(bracketed)[0]?.payload, '{"action":"send_message","body":"a]b"}');
  assert.equal(stripCapabilityConversationCommands(`hi ${bracketed} bye`).trim(), "hi  bye".trim());

  // The dispatch key is an in-flight LOCK, not a ledger: it is released in a `finally`, so a second
  // dispatch of the same action after the first completes runs the handler AGAIN — `handled` is 2
  // below, not 1. What the second call returns false for is the CLAIM, which is the only durable
  // record, and it fails after the handler has already run. Hence the registration contract: handlers
  // must be idempotent. Nothing here makes regeneration safe.
  const action = {
    type: "capability" as const,
    commandType: "phone",
    payload: '{"action":"send_message"}',
    chatId: "c1",
    sourceMessageId: "m1",
    swipeIndex: 0,
    branchChatId: "c1",
    characterId: "char1",
  };
  assert.equal(await dispatchCapabilityConversationAction(action), true);
  assert.equal(await dispatchCapabilityConversationAction(action, async () => false), false);
  assert.equal(handled, 2);

  const failedAction = { ...action, commandType: "failing-phone", sourceMessageId: "m2" };
  const releaseFailure = registerCapabilityConversationCommand({
    commandType: "failing-phone",
    tags: ["failing-phone"],
    handler: () => {
      throw new Error("temporary failure");
    },
  });
  await assert.rejects(() => dispatchCapabilityConversationAction(failedAction));
  releaseFailure();

  let retried = 0;
  const releaseRetry = registerCapabilityConversationCommand({
    commandType: "failing-phone",
    tags: ["failing-phone"],
    handler: () => {
      retried += 1;
    },
  });
  try {
    assert.equal(await dispatchCapabilityConversationAction(failedAction), true);
    assert.equal(retried, 1);
  } finally {
    releaseRetry();
  }

  console.log("Capability conversation action regression passed.");
} finally {
  release();
}
