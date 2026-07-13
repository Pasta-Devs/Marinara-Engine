import type { HumanOSReviewerDeclaration, HumanOSReviewDecision, HumanOSOrderedReviewResult } from "./humanos-ordered-review.js";
import { runHumanOSOrderedReview } from "./humanos-ordered-review.js";

export interface HumanOSCandidateRow {
  id: string;
  content: string;
}

export interface HumanOSCandidatePublicationResult {
  review: HumanOSOrderedReviewResult;
  messageId: string;
  canonical: boolean;
}

/**
 * Server-owned publication boundary for a fresh HumanOS assistant turn.
 * The candidate exists only in audit storage until stage 5.6 completes.
 */
export async function reviewAndPublishHumanOSCandidate(args: {
  chatId: string;
  characterId?: string | null;
  candidate: string;
  turnId: string;
  reviewers: HumanOSReviewerDeclaration[];
  createCandidate: (input: {
    chatId: string;
    characterId?: string | null;
    content: string;
    turnId: string;
  }) => Promise<HumanOSCandidateRow>;
  promoteCandidate: (
    messageId: string,
    turnId: string,
    approvedContent: string,
  ) => Promise<{ status: string }>;
  rejectCandidate: (messageId: string, turnId: string, reason: string) => Promise<{ status: string }>;
  execute: (reviewer: HumanOSReviewerDeclaration, latestCandidate: string) => Promise<HumanOSReviewDecision>;
  isAborted?: () => boolean;
}): Promise<HumanOSCandidatePublicationResult> {
  const candidateRow = await args.createCandidate({
    chatId: args.chatId,
    characterId: args.characterId,
    content: args.candidate,
    turnId: args.turnId,
  });

  let promotionStatus: string | null = null;
  let review: HumanOSOrderedReviewResult;
  try {
    review = await runHumanOSOrderedReview({
      candidate: args.candidate,
      reviewers: args.reviewers,
      execute: args.execute,
      isAborted: args.isAborted,
      publishCanonical: async (text) => {
        const promoted = await args.promoteCandidate(candidateRow.id, args.turnId, text);
        promotionStatus = promoted.status;
        if (promoted.status !== "promoted") {
          throw new Error(`HumanOS candidate promotion failed: ${promoted.status}`);
        }
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "HumanOS review execution failed";
    await args.rejectCandidate(candidateRow.id, args.turnId, reason);
    throw error;
  }

  if (review.status !== "canonical") {
    const reason =
      review.correctionNotice ??
      review.records.at(-1)?.diagnostic ??
      `HumanOS review ended with status ${review.status}`;
    await args.rejectCandidate(candidateRow.id, args.turnId, reason);
  }

  return {
    review,
    messageId: candidateRow.id,
    canonical: review.status === "canonical" && promotionStatus === "promoted",
  };
}
