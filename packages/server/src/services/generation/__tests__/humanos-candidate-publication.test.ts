import assert from "node:assert/strict";
import test from "node:test";
import { reviewAndPublishHumanOSCandidate } from "../humanos-candidate-publication.js";
import type { HumanOSReviewerDeclaration } from "../humanos-ordered-review.js";

const reviewers: HumanOSReviewerDeclaration[] = [
  { key: "format", stage: "5.1", failureMode: "REQUIRED" },
  { key: "agency", stage: "5.2", failureMode: "REQUIRED" },
  { key: "continuity", stage: "5.3", failureMode: "DEGRADABLE" },
  { key: "character", stage: "5.4", failureMode: "DEGRADABLE" },
  { key: "editor", stage: "5.5", failureMode: "REQUIRED" },
  { key: "final", stage: "5.6", failureMode: "REQUIRED" },
];

function harness() {
  const events: string[] = [];
  return {
    events,
    createCandidate: async () => {
      events.push("candidate");
      return { id: "message-1", content: "draft" };
    },
    promoteCandidate: async (_messageId: string, _turnId: string, text: string) => {
      events.push(`promote:${text}`);
      return { status: "promoted" };
    },
    rejectCandidate: async (_messageId: string, _turnId: string, reason: string) => {
      events.push(`reject:${reason}`);
      return { status: "rejected" };
    },
  };
}

test("candidate promotes only after all six ordered reviewers accept latest text", async () => {
  const h = harness();
  const result = await reviewAndPublishHumanOSCandidate({
    chatId: "chat-1",
    candidate: "draft",
    turnId: "turn-1",
    reviewers,
    ...h,
    execute: async (reviewer, latest) => {
      h.events.push(`${reviewer.stage}:${latest}`);
      return reviewer.stage === "5.5" ? { verdict: "surgical_edit", editedText: "edited" } : { verdict: "pass" };
    },
  });
  assert.equal(result.canonical, true);
  assert.equal(result.review.text, "edited");
  assert.deepEqual(h.events, [
    "candidate",
    "5.1:draft",
    "5.2:draft",
    "5.3:draft",
    "5.4:draft",
    "5.5:draft",
    "5.6:edited",
    "promote:edited",
  ]);
});

test("review rejection marks the candidate rejected and never promotes", async () => {
  const h = harness();
  const result = await reviewAndPublishHumanOSCandidate({
    chatId: "chat-1",
    candidate: "draft",
    turnId: "turn-2",
    reviewers,
    ...h,
    execute: async (reviewer) =>
      reviewer.stage === "5.2"
        ? { verdict: "reject_to_composer", correctionNotice: "restore user agency" }
        : { verdict: "pass" },
  });
  assert.equal(result.canonical, false);
  assert.equal(result.review.status, "rejected");
  assert.equal(h.events.some((event) => event.startsWith("promote:")), false);
  assert.equal(h.events.at(-1), "reject:restore user agency");
});

test("promotion conflict rejects the candidate and fails closed", async () => {
  const h = harness();
  await assert.rejects(
    reviewAndPublishHumanOSCandidate({
      chatId: "chat-1",
      candidate: "draft",
      turnId: "turn-3",
      reviewers,
      ...h,
      promoteCandidate: async () => ({ status: "turn_conflict" }),
      execute: async () => ({ verdict: "pass" }),
    }),
    /promotion failed: turn_conflict/,
  );
  assert.equal(h.events.some((event) => event.startsWith("reject:")), true);
});
