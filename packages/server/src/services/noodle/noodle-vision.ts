import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";
import { decodeSafePathSegment, resolveOwnedGalleryPath } from "../image/gallery-file-lifecycle.js";
import type { NoodlePromptImageCandidate } from "./noodle-prompt.js";

export const NOODLE_VISION_MAX_IMAGES = 8;
const NOODLE_VISION_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const NOODLE_VISION_MAX_DIMENSION = 1568;

export interface NoodleVisionAttachment extends NoodlePromptImageCandidate {
  dataUrl: string;
}

export function resolveNoodleImagePath(imageUrl: string): string | null {
  if (!imageUrl.startsWith("/")) return null;
  let pathname: string;
  try {
    pathname = new URL(imageUrl, "http://marinara.local").pathname;
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return null;
  const galleryRoot = join(DATA_DIR, "gallery");

  if (parts[1] === "global-gallery" && parts[2] === "file") {
    const filename = decodeSafePathSegment(parts[3]);
    if (!filename) return null;
    const root = join(galleryRoot, "global");
    return assertInsideDir(root, join(root, filename));
  }
  if (parts[1] === "gallery" && parts[2] === "file") {
    const chatId = decodeSafePathSegment(parts[3]);
    const filename = decodeSafePathSegment(parts[4]);
    if (!chatId || !filename) return null;
    const root = join(galleryRoot, chatId);
    return resolveOwnedGalleryPath(galleryRoot, root, filename);
  }
  if (parts[1] === "characters" && parts[2] === "personas" && parts[4] === "gallery" && parts[5] === "file") {
    const personaId = decodeSafePathSegment(parts[3]);
    const filename = decodeSafePathSegment(parts[6]);
    if (!personaId || !filename) return null;
    const root = join(galleryRoot, "personas", personaId);
    return resolveOwnedGalleryPath(galleryRoot, root, filename);
  }
  if (parts[1] === "characters" && parts[3] === "gallery" && parts[4] === "file") {
    const characterId = decodeSafePathSegment(parts[2]);
    const filename = decodeSafePathSegment(parts[5]);
    if (!characterId || !filename) return null;
    const root = join(galleryRoot, "characters", characterId);
    return resolveOwnedGalleryPath(galleryRoot, root, filename);
  }
  return null;
}

function decodeImageDataUrl(imageUrl: string): { buffer: Buffer; expectedExt: string } | null {
  const match = imageUrl.match(/^data:image\/(png|jpe?g|webp|gif|avif);base64,([\s\S]+)$/i);
  if (!match?.[1] || !match[2]) return null;
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (buffer.length > NOODLE_VISION_MAX_SOURCE_BYTES) return null;
  const subtype = match[1].toLowerCase();
  return { buffer, expectedExt: `.${subtype === "jpeg" ? "jpg" : subtype}` };
}

async function optimizeNoodleVisionImage(buffer: Buffer, expectedExt?: string): Promise<string | null> {
  if (!isAllowedImageBuffer(buffer, expectedExt)) return null;
  try {
    const sharp = (await import("sharp")).default;
    const optimized = await sharp(buffer, { animated: false, limitInputPixels: 268_402_689 })
      .rotate()
      .resize({
        width: NOODLE_VISION_MAX_DIMENSION,
        height: NOODLE_VISION_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${optimized.toString("base64")}`;
  } catch (error) {
    logger.warn(error, "[noodle/vision] Failed to optimize a timeline image");
    return null;
  }
}

async function readNoodleVisionImage(imageUrl: string): Promise<string | null> {
  const dataUrlImage = decodeImageDataUrl(imageUrl);
  if (dataUrlImage) return optimizeNoodleVisionImage(dataUrlImage.buffer, dataUrlImage.expectedExt);

  const filePath = resolveNoodleImagePath(imageUrl);
  if (!filePath) return null;
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size > NOODLE_VISION_MAX_SOURCE_BYTES) return null;
  return optimizeNoodleVisionImage(await readFile(filePath), extname(filePath));
}

export async function prepareNoodleVisionAttachments(
  candidates: NoodlePromptImageCandidate[],
): Promise<NoodleVisionAttachment[]> {
  const ordered = candidates
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const attachments: NoodleVisionAttachment[] = [];
  const seenKeys = new Set<string>();

  for (const candidate of ordered) {
    if (attachments.length >= NOODLE_VISION_MAX_IMAGES) break;
    if (seenKeys.has(candidate.key)) continue;
    seenKeys.add(candidate.key);
    try {
      const dataUrl = await readNoodleVisionImage(candidate.imageUrl);
      if (dataUrl) attachments.push({ ...candidate, dataUrl });
    } catch (error) {
      logger.warn(error, "[noodle/vision] Could not attach timeline image %s", candidate.key);
    }
  }
  return attachments;
}

export function formatNoodleVisionManifest(attachments: NoodleVisionAttachment[]): string {
  if (attachments.length === 0) return "";
  return [
    "# Attached Noodle Images",
    "The image inputs are attached in the same order as this list. Use each key to associate pixels with the correct post or reply.",
    ...attachments.map((attachment, index) =>
      attachment.interactionId
        ? `- image ${index + 1}: ${attachment.key}, reply ${attachment.interactionId} on post ${attachment.postId}`
        : `- image ${index + 1}: ${attachment.key}, post ${attachment.postId}`,
    ),
  ].join("\n");
}

export function isUnsupportedNoodleVisionInputError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /(?:image|vision|multimodal|image_url).{0,100}(?:not supported|unsupported|does not support|invalid content type)/i.test(
      message,
    ) ||
    /(?:not supported|unsupported|does not support|invalid content type).{0,100}(?:image|vision|multimodal|image_url)/i.test(
      message,
    ) ||
    /no (?:available )?endpoints? found.{0,80}(?:image|vision|multimodal|image_url)/i.test(message) ||
    /(?:expected|must be).{0,60}(?:content|message).{0,60}(?:string|text)|(?:expected|must be).{0,60}(?:string|text).{0,60}(?:content|message)|(?:content|message).{0,60}(?:expected|must be).{0,60}(?:string|text)/i.test(message)
  );
}
