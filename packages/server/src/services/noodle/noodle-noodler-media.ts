import { existsSync, rmSync, unlinkSync } from "fs";
import { join } from "path";
import type { NoodlerManagedPost } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { stageImageToDisk } from "../image/image-generation.js";

// NoodleR-owned media lives under the gallery data dir but in a namespace whose
// path contains a slash, so the public gallery serve routes (which reject slashes in the
// chatId segment) can never reach it. Only the access-checked media endpoint serves it.
const GALLERY_DIR = join(DATA_DIR, "gallery");
// Renaming this orphans NoodleR media already on disk in existing installations. Accepted
// while NoodleR is in alpha; if that stops being true, migrate rather than rename again.
export const NOODLER_MEDIA_PREFIX = "noodler-media/";

export type NoodlerPostMediaUpload = {
  buffer: Buffer;
  extension: string;
};

/** Access-checked serving URL for a NoodleR post's generated image. */
export function noodlerPostMediaUrl(postId: string): string {
  return `/api/noodle/noodler/posts/${encodeURIComponent(postId)}/media`;
}

const NOODLER_MEDIA_URL_PREFIX = "/api/noodle/noodler/posts/";

/**
 * Bind a stored NoodleR media URL to the persona it is being served to. The media route
 * gates on the persona, so audience-facing projections must carry it; unrelated (uploaded
 * or external) image URLs are returned untouched.
 */
export function noodlerPostMediaUrlForPersona(imageUrl: string | null, personaId: string): string | null {
  if (!imageUrl?.startsWith(NOODLER_MEDIA_URL_PREFIX)) return imageUrl;
  return `${imageUrl}?personaId=${encodeURIComponent(personaId)}`;
}

/**
 * Promote uploaded NoodleR media and persist its stable post-owned references as one
 * compensating operation. A null result means the target disappeared before persistence.
 */
export async function persistNoodlerPostWithUploadedMedia<T>(
  accountId: string,
  postId: string,
  upload: NoodlerPostMediaUpload,
  persist: (media: { imageUrl: string; noodlerMediaPath: string }) => Promise<T | null>,
): Promise<T | null> {
  const stagedMedia = stageImageToDisk(
    `${NOODLER_MEDIA_PREFIX}${accountId}`,
    upload.buffer.toString("base64"),
    upload.extension,
  );
  try {
    stagedMedia.promote();
    const result = await persist({
      imageUrl: noodlerPostMediaUrl(postId),
      noodlerMediaPath: stagedMedia.filePath,
    });
    if (result === null) stagedMedia.compensate();
    return result;
  } catch (error) {
    stagedMedia.compensate();
    throw error;
  }
}

export function readNoodlerMediaPath(post: Pick<NoodlerManagedPost, "metadata">): string | null {
  const value = (post.metadata as Record<string, unknown> | null | undefined)?.noodlerMediaPath;
  return typeof value === "string" && value.startsWith(NOODLER_MEDIA_PREFIX) ? value : null;
}

/** Resolve a stored relative NoodleR-media path to an absolute path inside the gallery dir. */
export function resolveNoodlerMediaAbsolutePath(relativePath: string): string | null {
  if (!relativePath.startsWith(NOODLER_MEDIA_PREFIX)) return null;
  try {
    return assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, relativePath));
  } catch {
    return null;
  }
}

/** Best-effort removal of an owned NoodleR-media file when its post is deleted. */
export function unlinkNoodlerMedia(relativePath: string | null): void {
  if (!relativePath) return;
  const absolute = resolveNoodlerMediaAbsolutePath(relativePath);
  if (!absolute) return;
  try {
    if (existsSync(absolute)) unlinkSync(absolute);
  } catch (error) {
    logger.warn(error, "[noodler] Failed to remove NoodleR media file %s", relativePath);
  }
}

/** Best-effort removal of a creator's whole owned NoodleR media namespace on account deletion. */
export function removeNoodlerAccountMedia(accountId: string): void {
  const dir = resolveNoodlerMediaAbsolutePath(`${NOODLER_MEDIA_PREFIX}${accountId}`);
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn(error, "[noodler] Failed to remove NoodleR media dir for account %s", accountId);
  }
}
