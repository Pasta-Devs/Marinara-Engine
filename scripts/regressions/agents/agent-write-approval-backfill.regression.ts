import assert from "node:assert/strict";
import {
  agentResultMatchesVisibleSwipe,
  shouldQueueAgentWriteApproval,
} from "../../../packages/client/src/lib/agent-result-ownership.js";

// A backfill targets a reply far above the loaded page (#9695).
const loadedPage = [{ id: "recent-reply", activeSwipeIndex: 0 }];
const backfillResult = { messageId: "day-one-reply", swipeIndex: 0 };
const ownsVisibleSwipe = agentResultMatchesVisibleSwipe(loadedPage, backfillResult);
assert.equal(ownsVisibleSwipe, false, "precondition: the backfill target is not on screen");

assert.equal(
  shouldQueueAgentWriteApproval({ isActiveChat: true, ownsVisibleSwipe, backfill: true }),
  true,
  "a backfill proposal for an off-screen reply still reaches the approval queue",
);
assert.equal(
  shouldQueueAgentWriteApproval({ isActiveChat: true, ownsVisibleSwipe, backfill: false }),
  false,
  "an ordinary retry for a reply that is not shown keeps the visible-swipe guard",
);
assert.equal(
  shouldQueueAgentWriteApproval({ isActiveChat: true, ownsVisibleSwipe: true, backfill: false }),
  true,
  "an ordinary retry on the visible swipe queues as before",
);
assert.equal(
  shouldQueueAgentWriteApproval({ isActiveChat: false, ownsVisibleSwipe, backfill: true }),
  false,
  "a backfill for a chat that is no longer open does not open the popup over another chat",
);

console.log("agent-write-approval-backfill regression passed");
