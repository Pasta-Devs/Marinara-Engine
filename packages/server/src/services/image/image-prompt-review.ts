import type { ImageGenerationDefaultsProfile } from "@marinara-engine/shared";

import { resolveImageGenerationService, type ImageDefaultsConnection } from "./image-generation-defaults.js";
import { resolveNovelAiRequestSize } from "./image-generation.js";

export type ReviewedImagePromptSubmission = {
  prompt: string;
  negativePrompt: string;
};

type ImagePromptReviewConnection = Pick<
  ImageDefaultsConnection,
  "baseUrl" | "model" | "imageGenerationSource" | "imageService"
>;

/** Resolve the dimensions shown before an image request using the same native NovelAI sizing rule as generation. */
export function resolveImagePromptReviewSize(args: {
  connection: ImagePromptReviewConnection;
  prompt: string;
  width: number;
  height: number;
  imageDefaults?: ImageGenerationDefaultsProfile | null;
}): { width: number; height: number } {
  const requestedSize = { width: args.width, height: args.height };
  const isNativeNovelAi =
    resolveImageGenerationService(args.connection) === "novelai" &&
    (args.connection.baseUrl ?? "").toLowerCase().includes("novelai.net");
  if (!isNativeNovelAi) return requestedSize;

  return resolveNovelAiRequestSize({
    prompt: args.prompt,
    width: args.width,
    height: args.height,
    model: args.connection.model ?? undefined,
    imageDefaults: args.imageDefaults,
  });
}

/**
 * Apply a reviewed positive prompt while retaining the compiled negative prompt
 * unless the review payload explicitly supplies a replacement, including an
 * empty string that intentionally clears it.
 */
export function resolveReviewedImagePromptSubmission(args: {
  generatedPrompt: string;
  generatedNegativePrompt: string;
  promptOverride?: string;
  negativePromptOverride?: string;
}): ReviewedImagePromptSubmission {
  const promptOverride = args.promptOverride?.trim();
  const negativePrompt =
    promptOverride && args.negativePromptOverride !== undefined
      ? args.negativePromptOverride.trim()
      : args.generatedNegativePrompt;
  return {
    prompt: promptOverride || args.generatedPrompt,
    negativePrompt,
  };
}
