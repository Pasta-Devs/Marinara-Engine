import type { ImageGenResult } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getSharp } from "./sharp-runtime.js";

let saveAsWebp = false;
let webpQuality = 95;

/** Mirror the synced UI preference, including startup, profile restore and settings removal. */
export function applyGeneratedImageFormatUiSettingsValue(value: string | null): void {
  let settings: Record<string, unknown> = {};
  try {
    const parsed: unknown = value ? JSON.parse(value) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) settings = parsed as Record<string, unknown>;
  } catch {
    // An absent or invalid preference keeps the original provider output.
  }
  saveAsWebp = settings.saveGeneratedImagesAsWebp === true;
  const quality = settings.generatedImageWebpQuality;
  webpQuality =
    typeof quality === "number" && Number.isFinite(quality) ? Math.max(1, Math.min(100, Math.round(quality))) : 95;
}

export async function loadGeneratedImageFormatUiSettings(storage: { get(key: string): Promise<string | null> }) {
  applyGeneratedImageFormatUiSettingsValue(await storage.get("ui"));
}

/** Convert once before callers save the image, so file contents, MIME type and extension agree. */
export async function formatGeneratedImageForStorage(result: ImageGenResult): Promise<ImageGenResult> {
  if (!saveAsWebp || (result.mimeType !== "image/png" && result.mimeType !== "image/jpeg")) return result;
  try {
    const input = Buffer.from(result.base64, "base64");
    // Some sharp builds decode only the first APNG frame. Leave animated PNGs intact.
    if (result.mimeType === "image/png") {
      for (let offset = 8; offset + 12 <= input.length;) {
        const type = input.toString("ascii", offset + 4, offset + 8);
        if (type === "acTL") return result;
        if (type === "IDAT") break;
        offset += 12 + input.readUInt32BE(offset);
      }
    }
    const sharp = await getSharp();
    const image = sharp(input);
    const buffer = await image.keepMetadata().webp({ quality: webpQuality, alphaQuality: 100 }).toBuffer();
    return { ...result, base64: buffer.toString("base64"), mimeType: "image/webp", ext: "webp" };
  } catch (error) {
    // A local encoding problem must never discard a paid result or trigger another provider generation.
    logger.warn(error, "[image-gen] WebP conversion unavailable; keeping the original generated image");
    return result;
  }
}
