import { isToAPIsMediaUrl, resolveImageBackend } from "../constants/model-lists.js";
import type { ImageGenerationQuality } from "../types/connection.js";
import type { ImageAnimation } from "../types/generation-integration.js";

/** GPT Image 2.5, and 2.6, which keeps 2.5's sizes, quality levels and alpha. */
export function isOpenAIGptImage25Model(model?: string | null): boolean {
  return /^gpt-image-2\.[56]-(?:flare|sunburst)(?:$|-)/i.test(model?.trim() ?? "");
}

/** Whether the model returns a looping GIF for `output_format: "gif"`. An `openai/` (OpenRouter) id does not. */
export function supportsOpenAIAnimatedGif(model?: string | null): boolean {
  return /^gpt-image-2\.6-(?:flare|sunburst)(?:$|-)/i.test(model?.trim() ?? "");
}

/**
 * Whether an image connection, given as the server's generateImage receives it, returns a looping GIF for `animation`:
 * GPT Image 2.6 on the OpenAI backend, not ChatGPT (Codex login), OpenRouter, NanoGPT or ToAPIs. generateImage refuses
 * every other GIF request, so a client gate asks this too, with a connection row mapped as the routes map it:
 * `source = row.imageGenerationSource || row.model`, `serviceHint = row.imageService || source`.
 */
export function imageConnectionMakesAnimatedGif(connection: {
  source: string;
  baseUrl: string;
  serviceHint: string;
  model?: string;
}): boolean {
  return (
    resolveImageBackend(connection.source, connection.baseUrl, connection.serviceHint, connection.model) === "openai" &&
    !isToAPIsMediaUrl(connection.baseUrl) &&
    supportsOpenAIAnimatedGif(connection.model)
  );
}

// OpenAI takes 2 to 64 frames but doesn't publish a GIF request's pixel budget. At most 12 frames of the
// smallest frame size stay under the documented 8,294,400 px whether or not the per-image floor applies per frame.
export const OPENAI_GIF_MAX_FRAMES = 12;
export const OPENAI_GIF_DEFAULT_FRAMES = 9;
export const OPENAI_GIF_DEFAULT_FRAME_MS = 200;

const finiteOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** The frames a GIF request sends: 2 to 12 frames (default 9) of 20 to 2000 ms in steps of 10 (default 200). */
export function resolveOpenAIGifAnimation(animation: ImageAnimation): { frameCount: number; frameDurationMs: number } {
  const frameCount = Math.round(finiteOr(animation.frameCount, OPENAI_GIF_DEFAULT_FRAMES));
  const frameDurationMs = Math.round(finiteOr(animation.frameDurationMs, OPENAI_GIF_DEFAULT_FRAME_MS) / 10) * 10;
  return {
    frameCount: Math.min(OPENAI_GIF_MAX_FRAMES, Math.max(2, frameCount)),
    frameDurationMs: Math.min(2000, Math.max(20, frameDurationMs)),
  };
}

export function isOpenAIGptImage2Model(model?: string | null): boolean {
  return /^gpt-image-2(?:$|-)/i.test(model?.trim() ?? "");
}

export function isOpenAIGptImageModel(model?: string | null): boolean {
  return isOpenAIGptImage25Model(model) || /^gpt-image-(?:1|1\.5|2)(?:$|-)/i.test(model?.trim() ?? "");
}

export function supportsOpenAIImageCustomSize(model?: string | null): boolean {
  return isOpenAIGptImage2Model(model) || isOpenAIGptImage25Model(model);
}

export function supportsOpenAITransparentBackground(model?: string | null): boolean {
  // GPT Image 2 lacks native alpha; 2.5 restores it for PNG/WebP output.
  return isOpenAIGptImage25Model(model) || /^gpt-image-(?:1|1\.5)(?:$|-)/i.test(model?.trim() ?? "");
}

export function resolveOpenAIImageQuality(value: unknown, model?: string | null): ImageGenerationQuality {
  if (value === "low" || value === "medium" || value === "high") return value;
  // OpenRouter uses the same IDs with an OpenAI namespace.
  if ((value === "xhigh" || value === "max") && isOpenAIGptImage25Model(model?.trim().replace(/^openai\//i, "")))
    return value;
  return "auto";
}
