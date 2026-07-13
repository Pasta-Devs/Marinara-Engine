import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { isPostCanonicalTrackingAgent } from "../agents/agent-pipeline.js";
import {
  HUMANOS_REVIEW_STAGES,
  humanOSReviewerDeclaration,
  isHumanOSOrderedReviewAgent,
  type HumanOSReviewerDeclaration,
} from "./humanos-ordered-review.js";

export interface HumanOSPublicationPolicy {
  enabled: boolean;
  reviewers: ResolvedAgent[];
  declarations: HumanOSReviewerDeclaration[];
  postCanonicalTrackers: ResolvedAgent[];
  legacyAgents: ResolvedAgent[];
}

export function resolveHumanOSPublicationPolicy(agents: ResolvedAgent[]): HumanOSPublicationPolicy {
  const reviewers = agents.filter(isHumanOSOrderedReviewAgent);
  if (reviewers.length === 0) {
    return { enabled: false, reviewers: [], declarations: [], postCanonicalTrackers: [], legacyAgents: agents };
  }

  const declarations = reviewers.map(humanOSReviewerDeclaration);
  const stages = new Set(declarations.map((entry) => entry.stage));
  const keys = new Set(declarations.map((entry) => entry.key));
  if (declarations.length !== HUMANOS_REVIEW_STAGES.length || stages.size !== HUMANOS_REVIEW_STAGES.length) {
    const missing = HUMANOS_REVIEW_STAGES.filter((stage) => !stages.has(stage));
    throw new Error(`HumanOS ordered review roster is incomplete or duplicated${missing.length ? `; missing ${missing.join(", ")}` : ""}`);
  }
  if (keys.size !== declarations.length) throw new Error("HumanOS ordered review roster contains duplicate pipeline keys");

  const reviewerIds = new Set(reviewers.map((agent) => agent.id));
  const postCanonicalTrackers = agents.filter(
    (agent) => !reviewerIds.has(agent.id) && isPostCanonicalTrackingAgent(agent),
  );
  const trackerIds = new Set(postCanonicalTrackers.map((agent) => agent.id));
  const legacyAgents = agents.filter((agent) => !reviewerIds.has(agent.id) && !trackerIds.has(agent.id));

  return { enabled: true, reviewers, declarations, postCanonicalTrackers, legacyAgents };
}

export function assertHumanOSPublicationModeSupported(input: {
  regenerateMessageId?: string | null;
  continueMessageId?: string | null;
  impersonate?: boolean;
  individualGroupGeneration?: boolean;
  responseCount?: number;
}): void {
  if (input.regenerateMessageId) throw new Error("HumanOS reviewed publication does not yet support regeneration");
  if (input.continueMessageId) throw new Error("HumanOS reviewed publication does not yet support continuation");
  if (input.impersonate) throw new Error("HumanOS reviewed publication does not support impersonation");
  if (input.individualGroupGeneration) {
    throw new Error("HumanOS reviewed publication does not yet support individual group generation");
  }
  if (input.responseCount !== undefined && input.responseCount !== 1) {
    throw new Error("HumanOS reviewed publication requires exactly one assistant response");
  }
}
