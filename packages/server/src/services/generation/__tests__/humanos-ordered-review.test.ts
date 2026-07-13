import assert from "node:assert/strict";
import test from "node:test";
import {
  HUMANOS_REVIEW_STAGES,
  HumanOSReviewConfigurationError,
  humanOSReviewDecisionFromAgentResult,
  humanOSReviewerDeclaration,
  isHumanOSOrderedReviewAgent,
  runHumanOSOrderedReview,
  type HumanOSReviewerDeclaration,
} from "../humanos-ordered-review.js";

function reviewers(overrides: Partial<Record<(typeof HUMANOS_REVIEW_STAGES)[number], Partial<HumanOSReviewerDeclaration>>> = {}) {
  return HUMANOS_REVIEW_STAGES.map((stage) => ({
    key: `review-${stage}`,
    stage,
    failureMode: stage === "5.2" || stage === "5.6" ? "REQUIRED" as const : "DEGRADABLE" as const,
    ...overrides[stage],
  }));
}

test("ordered review runs 5.1-5.6 sequentially against the latest accepted candidate", async () => {
  const seen: string[] = [];
  let published = "";
  const outcome = await runHumanOSOrderedReview({
    candidate: "A",
    reviewers: reviewers(),
    execute: async (reviewer, latest) => {
      seen.push(`${reviewer.stage}:${latest}`);
      return reviewer.stage === "5.3" ? { verdict: "surgical_edit", editedText: `${latest}B` } : { verdict: "pass" };
    },
    publishCanonical: (text) => { published = text; },
  });
  assert.equal(outcome.status, "canonical");
  assert.equal(outcome.text, "AB");
  assert.equal(published, "AB");
  assert.deepEqual(seen, ["5.1:A", "5.2:A", "5.3:A", "5.4:AB", "5.5:AB", "5.6:AB"]);
});

test("required failure blocks later review and canonical publication", async () => {
  const seen: string[] = [];
  let published = false;
  const outcome = await runHumanOSOrderedReview({
    candidate: "candidate",
    reviewers: reviewers(),
    execute: async (reviewer) => {
      seen.push(reviewer.stage);
      if (reviewer.stage === "5.2") throw new Error("agency validator unavailable");
      return { verdict: "pass" };
    },
    publishCanonical: () => { published = true; },
  });
  assert.equal(outcome.status, "failed");
  assert.deepEqual(seen, ["5.1", "5.2"]);
  assert.equal(published, false);
});

test("degradable failure permits later reviewers and records degradation", async () => {
  const outcome = await runHumanOSOrderedReview({
    candidate: "candidate",
    reviewers: reviewers(),
    execute: async (reviewer) => {
      if (reviewer.stage === "5.3") throw new Error("continuity unavailable");
      return { verdict: "pass" };
    },
  });
  assert.equal(outcome.status, "canonical");
  assert.equal(outcome.records.find((record) => record.stage === "5.3")?.disposition, "degraded");
  assert.equal(outcome.records.length, 6);
});

test("material narrative correction rejects to composer without publishing", async () => {
  let published = false;
  const outcome = await runHumanOSOrderedReview({
    candidate: "candidate",
    reviewers: reviewers(),
    execute: async (reviewer) => reviewer.stage === "5.4"
      ? { verdict: "reject_to_composer", correctionNotice: "Recompose without inventing the player's decision." }
      : { verdict: "pass" },
    publishCanonical: () => { published = true; },
  });
  assert.equal(outcome.status, "rejected");
  assert.match(outcome.correctionNotice ?? "", /player's decision/);
  assert.equal(published, false);
  assert.equal(outcome.records.length, 4);
});

test("protected markup loss fails a required surgical reviewer", async () => {
  const outcome = await runHumanOSOrderedReview({
    candidate: "<scene>Keep me</scene>",
    reviewers: reviewers({ "5.2": { failureMode: "REQUIRED" } }),
    execute: async (reviewer) => reviewer.stage === "5.2"
      ? { verdict: "surgical_edit", editedText: "Keep me" }
      : { verdict: "pass" },
  });
  assert.equal(outcome.status, "failed");
  assert.match(outcome.records.at(-1)?.diagnostic ?? "", /protected markup/);
});

test("ordered-review agent declarations and result adapters fail closed", () => {
  const agent = { type: "agency", phase: "post_processing", settings: { pipelineStage: "ordered_review", reviewOrder: 2, pipelineKey: "agency", failureMode: "REQUIRED" } } as any;
  assert.equal(isHumanOSOrderedReviewAgent(agent), true);
  assert.deepEqual(humanOSReviewerDeclaration(agent), { key: "agency", stage: "5.2", failureMode: "REQUIRED" });
  assert.deepEqual(humanOSReviewDecisionFromAgentResult({ success: true, type: "continuity_check", data: { verdict: "pass" } } as any), { verdict: "pass", editedText: undefined, diagnostic: undefined, correctionNotice: undefined });
  assert.deepEqual(humanOSReviewDecisionFromAgentResult({ success: true, type: "text_rewrite", data: { editNeeded: true, editedText: "fixed" } } as any), { verdict: "surgical_edit", editedText: "fixed", diagnostic: undefined });
  assert.throws(() => humanOSReviewDecisionFromAgentResult({ success: true, type: "continuity_check", data: { verdict: "rewrite_everything" } } as any), /invalid verdict/);
  assert.throws(() => humanOSReviewerDeclaration({ ...agent, settings: { ...agent.settings, reviewOrder: 9 } }), /Invalid HumanOS review stage/);
});

test("complete chain rejects missing or duplicate stages before execution", async () => {
  let executions = 0;
  await assert.rejects(
    runHumanOSOrderedReview({ candidate: "x", reviewers: reviewers().slice(0, 5), execute: async () => { executions++; return { verdict: "pass" }; } }),
    HumanOSReviewConfigurationError,
  );
  const duplicate = reviewers();
  duplicate[5] = { ...duplicate[5]!, stage: "5.5" };
  await assert.rejects(
    runHumanOSOrderedReview({ candidate: "x", reviewers: duplicate, execute: async () => { executions++; return { verdict: "pass" }; } }),
    HumanOSReviewConfigurationError,
  );
  assert.equal(executions, 0);
});
