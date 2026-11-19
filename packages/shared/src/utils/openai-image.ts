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

/** A Model's "Transparent backgrounds" setting: null is Automatic. */
export type ImageTransparencySetting = "supported" | "unsupported" | null | undefined;

/**
 * Whether an image connection draws see-through pictures, so a sprite or sticker can ask for one instead of a flat
 * colour Marinara removes afterwards. The Model's own setting wins; Automatic says yes only for the models known to
 * return alpha: GPT Image 1, 1.5, 2.5 and 2.6 on OpenAI (not ToAPIs), OpenRouter and ChatGPT (Codex login), and NovelAI V5
 * on NovelAI's own host.
 * GPT Image 2 has no alpha. The connection is given as the routes map a row (see imageConnectionMakesAnimatedGif).
 */
export function imageConnectionMakesTransparentPicture(connection: {
  source: string;
  baseUrl: string;
  serviceHint: string;
  model?: string;
  imageTransparency?: ImageTransparencySetting;
}): boolean {
  if (connection.imageTransparency === "supported") return true;
  if (connection.imageTransparency === "unsupported") return false;
  const backend = resolveImageBackend(connection.source, connection.baseUrl, connection.serviceHint, connection.model);
  const model = (connection.model ?? "").trim().replace(/^openai\//i, "");
  if (backend === "openai") return !isToAPIsMediaUrl(connection.baseUrl) && supportsOpenAITransparentBackground(model);
  if (backend === "openrouter" || backend === "codex_chatgpt") return supportsOpenAITransparentBackground(model);
  if (backend === "novelai") return novelAiDrawsTransparency(connection.baseUrl, model);
  return false;
}

/** NovelAI V5 (diffusion 5, full or curated) on NovelAI's own host draws real alpha when asked with tags. */
export function isNovelAiV5ImageModel(model?: string | null): boolean {
  return /^nai-diffusion-5(?:-(?:curated|full))?$/i.test(model?.trim() ?? "");
}

function novelAiDrawsTransparency(baseUrl: string, model: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase().replace(/\.$/, "");
    return (host === "novelai.net" || host.endsWith(".novelai.net")) && isNovelAiV5ImageModel(model);
  } catch {
    return false;
  }
}

/**
 * Whether a see-through request to this connection is written as tags rather than a sentence. NovelAI reads
 * comma-separated tags: it needs "transparent background, alpha transparency" and no flat-colour fallback, since a
 * named backdrop colour is a tag it would paint.
 */
export function imageConnectionAsksTransparencyWithTags(connection: {
  source: string;
  baseUrl: string;
  serviceHint: string;
  model?: string;
}): boolean {
  return (
    resolveImageBackend(connection.source, connection.baseUrl, connection.serviceHint, connection.model) === "novelai"
  );
}

/** The tags that ask NovelAI V5 for a see-through picture. */
export const NOVELAI_TRANSPARENCY_TAGS = "transparent background, alpha transparency";

export function resolveOpenAIImageQuality(value: unknown, model?: string | null): ImageGenerationQuality {
  if (value === "low" || value === "medium" || value === "high") return value;
  // OpenRouter uses the same IDs with an OpenAI namespace.
  if ((value === "xhigh" || value === "max") && isOpenAIGptImage25Model(model?.trim().replace(/^openai\//i, "")))
    return value;
  return "auto";
}
