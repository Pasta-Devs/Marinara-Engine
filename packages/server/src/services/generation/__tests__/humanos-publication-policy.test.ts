import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedAgent } from "../../agents/agent-pipeline.js";
import {
  assertHumanOSPublicationModeSupported,
  resolveHumanOSPublicationPolicy,
} from "../humanos-publication-policy.js";

function agent(order: number, overrides: Partial<ResolvedAgent> = {}): ResolvedAgent {
  return {
    id: `review-${order}`,
    type: `review-${order}`,
    name: `Review ${order}`,
    phase: "post_processing",
    promptTemplate: "review",
    connectionId: null,
    provider: {} as ResolvedAgent["provider"],
    model: "test",
    settings: {
      pipelineStage: "ordered_review",
      reviewOrder: order,
      pipelineKey: `review-${order}`,
      failureMode: order === 3 || order === 4 ? "DEGRADABLE" : "REQUIRED",
    },
    ...overrides,
  };
}

test("partitions a complete ordered-review roster from trackers and legacy agents", () => {
  const tracker = agent(1, {
    id: "runtime",
    type: "runtime",
    settings: { pipelineStage: "post_canonical_tracking", pipelineKey: "runtime" },
  });
  const legacy = agent(1, { id: "legacy", type: "legacy", phase: "parallel", settings: {} });
  const policy = resolveHumanOSPublicationPolicy([...Array.from({ length: 6 }, (_, i) => agent(i + 1)), tracker, legacy]);
  assert.equal(policy.enabled, true);
  assert.equal(policy.reviewers.length, 6);
  assert.deepEqual(policy.declarations.map((entry) => entry.stage), ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"]);
  assert.deepEqual(policy.postCanonicalTrackers.map((entry) => entry.id), ["runtime"]);
  assert.deepEqual(policy.legacyAgents.map((entry) => entry.id), ["legacy"]);
});

test("fails closed for incomplete or duplicate review rosters", () => {
  assert.throws(() => resolveHumanOSPublicationPolicy([agent(1)]), /incomplete/i);
  assert.throws(() => resolveHumanOSPublicationPolicy([...Array.from({ length: 5 }, (_, i) => agent(i + 1)), agent(5)]), /duplicated/i);
});

test("rejects unsupported publication modes", () => {
  assert.doesNotThrow(() => assertHumanOSPublicationModeSupported({ responseCount: 1 }));
  assert.throws(() => assertHumanOSPublicationModeSupported({ regenerateMessageId: "m" }), /regeneration/i);
  assert.throws(() => assertHumanOSPublicationModeSupported({ continueMessageId: "m" }), /continuation/i);
  assert.throws(() => assertHumanOSPublicationModeSupported({ impersonate: true }), /impersonation/i);
  assert.throws(() => assertHumanOSPublicationModeSupported({ individualGroupGeneration: true }), /group/i);
  assert.throws(() => assertHumanOSPublicationModeSupported({ responseCount: 2 }), /exactly one/i);
});
