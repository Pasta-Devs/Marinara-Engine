import assert from "node:assert/strict";
import test from "node:test";
import { MAX_HUMANOS_RECOMPOSITIONS, runBoundedHumanOSRecomposition } from "../humanos-recomposition.js";
import type { HumanOSOrderedReviewResult } from "../humanos-ordered-review.js";

function result(
  status: HumanOSOrderedReviewResult["status"],
  text: string,
  correctionNotice: string | null = null,
): HumanOSOrderedReviewResult {
  return {
    status,
    text,
    records: [],
    correctionNotice,
    canonicalContentHash: status === "canonical" ? `hash:${text}` : null,
  };
}

test("bounded recomposition replaces one hidden draft and restarts review from stage 5.1", async () => {
  const events: string[] = [];
  const outcome = await runBoundedHumanOSRecomposition({
    initialCandidate: "draft-0",
    maxRecompositions: 1,
    review: async (candidate, attempt) => {
      for (const stage of ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"]) {
        events.push(`review:${attempt}:${stage}:${candidate}`);
        if (attempt === 0 && stage === "5.2") {
          return result("rejected", candidate, "Do not decide for the player.");
        }
      }
      return result("canonical", candidate);
    },
    recompose: async ({ rejectedCandidate, correctionNotice, recomposition }) => {
      events.push(`recompose:${recomposition}:${rejectedCandidate}:${correctionNotice}`);
      return "draft-1";
    },
    replaceCandidateDraft: async ({ expectedCandidate, replacementCandidate, recomposition }) => {
      events.push(`replace:${recomposition}:${expectedCandidate}->${replacementCandidate}`);
      return { status: "updated" };
    },
  });

  assert.equal(outcome.status, "canonical");
  assert.equal(outcome.text, "draft-1");
  assert.equal(outcome.recompositions, 1);
  assert.equal(outcome.attempts.length, 2);
  assert.deepEqual(events, [
    "review:0:5.1:draft-0",
    "review:0:5.2:draft-0",
    "recompose:1:draft-0:Do not decide for the player.",
    "replace:1:draft-0->draft-1",
    "review:1:5.1:draft-1",
    "review:1:5.2:draft-1",
    "review:1:5.3:draft-1",
    "review:1:5.4:draft-1",
    "review:1:5.5:draft-1",
    "review:1:5.6:draft-1",
  ]);
});

test("bounded recomposition stops rejected after the strict retry budget", async () => {
  let recompositions = 0;
  const outcome = await runBoundedHumanOSRecomposition({
    initialCandidate: "draft-0",
    maxRecompositions: 99,
    review: async (candidate) => result("rejected", candidate, "Still unsafe"),
    recompose: async () => `draft-${++recompositions}`,
    replaceCandidateDraft: async () => ({ status: "updated" }),
  });

  assert.equal(outcome.status, "rejected");
  assert.equal(outcome.recompositions, MAX_HUMANOS_RECOMPOSITIONS);
  assert.equal(outcome.attempts.length, MAX_HUMANOS_RECOMPOSITIONS + 1);
  assert.equal(recompositions, MAX_HUMANOS_RECOMPOSITIONS);
});

test("failed review is terminal and never invokes recomposition", async () => {
  let recomposeCalled = false;
  const outcome = await runBoundedHumanOSRecomposition({
    initialCandidate: "draft",
    review: async (candidate) => result("failed", candidate),
    recompose: async () => {
      recomposeCalled = true;
      return "replacement";
    },
    replaceCandidateDraft: async () => ({ status: "updated" }),
  });
  assert.equal(outcome.status, "failed");
  assert.equal(recomposeCalled, false);
});

test("recomposition fails closed on missing notices, empty drafts, and storage conflicts", async () => {
  const base = {
    initialCandidate: "draft",
    review: async (candidate: string) => result("rejected", candidate, "Fix it"),
    recompose: async () => "replacement",
    replaceCandidateDraft: async () => ({ status: "updated" }),
  };

  await assert.rejects(
    runBoundedHumanOSRecomposition({
      ...base,
      review: async (candidate) => result("rejected", candidate),
    }),
    /requires a correction notice/,
  );
  await assert.rejects(runBoundedHumanOSRecomposition({ ...base, recompose: async () => "  " }), /empty candidate/);
  await assert.rejects(
    runBoundedHumanOSRecomposition({
      ...base,
      replaceCandidateDraft: async () => ({ status: "content_conflict" }),
    }),
    /draft replacement failed: content_conflict/,
  );
});
