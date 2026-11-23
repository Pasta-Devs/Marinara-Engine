import { resolveImageBackend } from "../constants/model-lists.js";
import type { ImageEditMode } from "../types/generation-integration.js";
import { isNativeNovelAiUrl } from "./novelai.js";

/** The resolved connection shape used by image generation, rather than a database row. */
export interface ImageEditTarget {
  source: string;
  baseUrl: string;
  serviceHint: string;
  model?: string;
}

export interface ImageEditCapabilities {
  img2img: boolean;
  inpainting: boolean;
  noise: boolean;
  reuseSeed: boolean;
}

/** Explicit canvas editing support, distinct from accepting a likeness/reference picture. */
export function resolveImageEditCapabilities(target: ImageEditTarget): ImageEditCapabilities {
  const backend = resolveImageBackend(target.source, target.baseUrl, target.serviceHint, target.model);
  const nativeNovelAi = backend === "novelai" && isNativeNovelAiUrl(target.baseUrl);
  const automatic1111 = backend === "automatic1111";
  const drawThings = target.serviceHint.trim().toLowerCase() === "drawthings";
  return {
    img2img: nativeNovelAi || automatic1111,
    inpainting: nativeNovelAi || (automatic1111 && !drawThings),
    noise: nativeNovelAi,
    reuseSeed: nativeNovelAi,
  };
}

/** Shared admission checks for routes, generation and fallback selection. No filesystem or provider calls. */
export function imageEditValidationError(
  target: ImageEditTarget,
  input: { editMode?: ImageEditMode; maskImage?: string; noise?: number; reuseSeed?: boolean; seedOverride?: number },
): string | null {
  const capabilities = resolveImageEditCapabilities(target);
  if (input.maskImage && input.editMode !== "infill") return "A mask image is only valid for inpainting edits.";
  if (input.editMode === "img2img" && !capabilities.img2img) {
    return "This image connection does not support image-to-image edits.";
  }
  if (input.editMode === "infill") {
    if (!capabilities.inpainting) return "This image connection does not support inpainting edits.";
    if (!input.maskImage?.trim()) return "Inpainting requires a painted mask.";
  }
  if (input.editMode && input.noise !== undefined && !capabilities.noise) {
    return "This image connection does not support an edit noise setting.";
  }
  if ((input.reuseSeed || input.seedOverride !== undefined) && !capabilities.reuseSeed) {
    return "Reusing the original seed requires a native NovelAI connection.";
  }
  return null;
}
