const MAX_REVIEWED_ILLUSTRATOR_PROMPT_LENGTH = 200_000;

export type IllustratorPromptReviewOverride = {
  /** A typed /illustrate prompt omits scene and character references. */
  subjectOnly?: boolean;
  resultData: Record<string, unknown>;
  prompt: string;
  negativePrompt?: string;
};

/** Validate and normalize a client-supplied Illustrator review resume payload. */
export function parseIllustratorPromptReviewOverride(value: unknown): IllustratorPromptReviewOverride | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.subjectOnly !== undefined && typeof input.subjectOnly !== "boolean") return null;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const negativePrompt = typeof input.negativePrompt === "string" ? input.negativePrompt.trim() : undefined;
  const resultData = input.resultData;
  if (!prompt || prompt.length > MAX_REVIEWED_ILLUSTRATOR_PROMPT_LENGTH) return null;
  if (negativePrompt && negativePrompt.length > MAX_REVIEWED_ILLUSTRATOR_PROMPT_LENGTH) return null;
  if (!resultData || typeof resultData !== "object" || Array.isArray(resultData)) return null;
  return {
    resultData: resultData as Record<string, unknown>,
    prompt,
    ...(input.subjectOnly === true ? { subjectOnly: true } : {}),
    ...(negativePrompt ? { negativePrompt } : {}),
  };
}

/** Select the compiled Illustrator prompt or the user's reviewed one-off override. */
export function resolveIllustratorPromptSubmission(args: {
  generatedPrompt: string;
  generatedNegativePrompt: string;
  reviewOverride?: Pick<IllustratorPromptReviewOverride, "prompt" | "negativePrompt"> | null;
}): { prompt: string; negativePrompt: string } {
  if (args.reviewOverride) {
    return {
      prompt: args.reviewOverride.prompt.trim(),
      negativePrompt: args.reviewOverride.negativePrompt?.trim() ?? "",
    };
  }
  return {
    prompt: args.generatedPrompt,
    negativePrompt: args.generatedNegativePrompt,
  };
}
