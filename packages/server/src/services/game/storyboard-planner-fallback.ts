import { extractLeadingThinkingBlocks } from "@marinara-engine/shared";
import { parseGameJsonish } from "./jsonish.js";

export const STORYBOARD_FALLBACK_BEAT_MAX_CHARS = 2000;

/** Retry unusable local structured output once without spending the budget on hidden reasoning. */
export async function completeStoryboardPlan(args: {
  generate: (withoutReasoning: boolean) => Promise<{ content: string | null }>;
  retryWithoutReasoning: boolean;
  customThinkingTags?: unknown;
}): Promise<unknown> {
  for (let attempt = 0; attempt < (args.retryWithoutReasoning ? 2 : 1); attempt++) {
    const result = await args.generate(attempt > 0);
    const content = extractLeadingThinkingBlocks(result.content || "", args.customThinkingTags).content;
    try {
      const plan = parseGameJsonish(content);
      if (storyboardPlanHasRenderableKeyframe(plan)) return plan;
    } catch {
      // Malformed/empty model output is retryable; transport failures and cancellation are not.
    }
  }
  throw new Error("Storyboard Illustrator returned no usable keyframes");
}

const STORYBOARD_REVIEW_PLAN_KIND = "marinara-storyboard-review-plan-v1";
const STORYBOARD_PLANNER_ERROR_MAX_CHARS = 1200;

export interface StoryboardReviewPlanEnvelope {
  kind: typeof STORYBOARD_REVIEW_PLAN_KIND;
  plan: unknown;
  plannerError: string | null;
  usedFallbackPlanner: boolean;
}

export function compactStoryboardTextAtWordBoundary(value: unknown, maxChars: number): string {
  if (maxChars <= 0) return "";
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return ".".repeat(maxChars);

  const contentLimit = maxChars - 3;
  const candidate = text.slice(0, contentLimit + 1);
  const wordBoundary = candidate.lastIndexOf(" ");
  const cutoff = wordBoundary > 0 ? wordBoundary : contentLimit;
  return `${candidate.slice(0, cutoff).trimEnd()}...`;
}

export function compactStoryboardFallbackBeat(value: unknown): string {
  return compactStoryboardTextAtWordBoundary(value, STORYBOARD_FALLBACK_BEAT_MAX_CHARS);
}

export function storyboardPlanHasRenderableKeyframe(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keyframes = (value as Record<string, unknown>).keyframes;
  if (!Array.isArray(keyframes)) return false;
  return keyframes.some((rawFrame) => {
    if (!rawFrame || typeof rawFrame !== "object" || Array.isArray(rawFrame)) return false;
    const frame = rawFrame as Record<string, unknown>;
    return [frame.narrationBeat, frame.imagePrompt, frame.mangaPanelPrompt].some(
      (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
    );
  });
}

export function formatStoryboardFallbackSectionText(content: string, speaker?: string | null): string {
  const cleanContent = content.trim();
  const cleanSpeaker = speaker?.trim() ?? "";
  if (!cleanSpeaker) return cleanContent;
  const escapedSpeaker = cleanSpeaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixPattern = new RegExp(`^${escapedSpeaker}\\s*:\\s*`, "iu");
  let body = cleanContent;
  while (body) {
    const existingPrefix = body.match(prefixPattern);
    if (!existingPrefix) break;
    body = body.slice(existingPrefix[0].length).trim();
  }
  return body ? `${cleanSpeaker}: ${body}` : `${cleanSpeaker}:`;
}

export function createStoryboardReviewPlanEnvelope(args: {
  plan: unknown;
  plannerError: string | null;
  usedFallbackPlanner: boolean;
}): StoryboardReviewPlanEnvelope {
  return {
    kind: STORYBOARD_REVIEW_PLAN_KIND,
    plan: args.plan,
    plannerError: args.plannerError,
    usedFallbackPlanner: args.usedFallbackPlanner,
  };
}

export function resolveStoryboardReviewPlanEnvelope(value: unknown): {
  plan: unknown;
  plannerError: string | null;
  usedFallbackPlanner: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { plan: value, plannerError: null, usedFallbackPlanner: false };
  }

  const record = value as Record<string, unknown>;
  if (record.kind !== STORYBOARD_REVIEW_PLAN_KIND || !("plan" in record)) {
    return { plan: value, plannerError: null, usedFallbackPlanner: false };
  }

  const plannerError =
    typeof record.plannerError === "string"
      ? record.plannerError.trim().slice(0, STORYBOARD_PLANNER_ERROR_MAX_CHARS) || null
      : null;
  return {
    plan: record.plan,
    plannerError,
    usedFallbackPlanner: record.usedFallbackPlanner === true || plannerError != null,
  };
}
