import type { HumanOSOrderedReviewResult } from "./humanos-ordered-review.js";

export const MAX_HUMANOS_RECOMPOSITIONS = 2;

export interface HumanOSRecompositionRequest {
  rejectedCandidate: string;
  correctionNotice: string;
  /** Zero-based rejected review attempt that requested this recomposition. */
  rejectedAttempt: number;
  /** One-based recomposition number, bounded by maxRecompositions. */
  recomposition: number;
}

export interface HumanOSRecompositionAttempt {
  attempt: number;
  candidate: string;
  review: HumanOSOrderedReviewResult;
}

export interface BoundedHumanOSRecompositionResult {
  status: HumanOSOrderedReviewResult["status"];
  text: string;
  review: HumanOSOrderedReviewResult;
  attempts: HumanOSRecompositionAttempt[];
  recompositions: number;
}

/**
 * Bounded Phase 4 → Phase 5 loop.
 *
 * Every replacement draft is stored through a caller-owned compare-and-set
 * before review restarts at stage 5.1. Only an explicit reject_to_composer
 * verdict may request recomposition; execution failures and aborts remain
 * terminal. Publication stays inside the supplied review callback, so this
 * controller never grants canonical authority itself.
 */
export async function runBoundedHumanOSRecomposition(args: {
  initialCandidate: string;
  maxRecompositions?: number;
  review: (candidate: string, attempt: number) => Promise<HumanOSOrderedReviewResult>;
  recompose: (request: HumanOSRecompositionRequest) => Promise<string>;
  replaceCandidateDraft: (input: {
    expectedCandidate: string;
    replacementCandidate: string;
    recomposition: number;
  }) => Promise<{ status: string }>;
  isAborted?: () => boolean;
}): Promise<BoundedHumanOSRecompositionResult> {
  const configuredMax = args.maxRecompositions ?? 1;
  const maxRecompositions = Math.max(0, Math.min(MAX_HUMANOS_RECOMPOSITIONS, Math.trunc(configuredMax)));
  let candidate = args.initialCandidate;
  const attempts: HumanOSRecompositionAttempt[] = [];
  let recompositions = 0;

  while (true) {
    if (args.isAborted?.()) {
      const review: HumanOSOrderedReviewResult = {
        status: "aborted",
        text: candidate,
        records: [],
        correctionNotice: null,
        canonicalContentHash: null,
      };
      attempts.push({ attempt: attempts.length, candidate, review });
      return { status: review.status, text: candidate, review, attempts, recompositions };
    }

    const attempt = attempts.length;
    const review = await args.review(candidate, attempt);
    attempts.push({ attempt, candidate, review });
    if (review.status !== "rejected" || recompositions >= maxRecompositions) {
      return { status: review.status, text: review.text, review, attempts, recompositions };
    }

    const correctionNotice = review.correctionNotice?.trim() ?? "";
    if (!correctionNotice) {
      throw new Error("HumanOS recomposition requires a correction notice");
    }
    if (args.isAborted?.()) {
      const aborted: HumanOSOrderedReviewResult = {
        status: "aborted",
        text: candidate,
        records: review.records,
        correctionNotice: null,
        canonicalContentHash: null,
      };
      return { status: aborted.status, text: candidate, review: aborted, attempts, recompositions };
    }

    const nextRecomposition = recompositions + 1;
    const replacementCandidate = (
      await args.recompose({
        rejectedCandidate: review.text,
        correctionNotice,
        rejectedAttempt: attempt,
        recomposition: nextRecomposition,
      })
    ).trim();
    if (!replacementCandidate) {
      throw new Error("HumanOS recomposition returned an empty candidate");
    }

    const replaced = await args.replaceCandidateDraft({
      expectedCandidate: candidate,
      replacementCandidate,
      recomposition: nextRecomposition,
    });
    if (replaced.status !== "updated") {
      throw new Error(`HumanOS candidate draft replacement failed: ${replaced.status}`);
    }

    candidate = replacementCandidate;
    recompositions = nextRecomposition;
  }
}
