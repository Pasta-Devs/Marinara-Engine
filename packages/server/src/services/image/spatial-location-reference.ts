import { readFile } from "node:fs/promises";
import type { ResolvedOwnerSpatialProjection } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createGlobalGalleryStorage } from "../storage/global-gallery.storage.js";
import { resolveGalleryImagePath } from "./gallery-image-path.js";

export const SPATIAL_LOCATION_REFERENCE_PROMPT_LINE =
  "Location handling: an attached location reference image is available. Use it to set the scene location.";

export const GLOBAL_GALLERY_SPATIAL_REFERENCE_PREFIX = "global-gallery:";

export function globalGallerySpatialReferenceId(imageId: string): string {
  return `${GLOBAL_GALLERY_SPATIAL_REFERENCE_PREFIX}${imageId.trim()}`;
}

export function parseGlobalGallerySpatialReferenceId(referenceImageId: string): string | null {
  if (!referenceImageId.startsWith(GLOBAL_GALLERY_SPATIAL_REFERENCE_PREFIX)) return null;
  return referenceImageId.slice(GLOBAL_GALLERY_SPATIAL_REFERENCE_PREFIX.length).trim() || null;
}

export async function resolveSpatialLocationReferenceImage(args: {
  db: DB;
  chatId: string;
  projection: ResolvedOwnerSpatialProjection | null;
}): Promise<string | null> {
  const referenceImageId = args.projection?.useReferenceImage ? args.projection.referenceImageId?.trim() : "";
  if (!referenceImageId) return null;

  try {
    if (referenceImageId.startsWith(GLOBAL_GALLERY_SPATIAL_REFERENCE_PREFIX)) {
      const imageId = parseGlobalGallerySpatialReferenceId(referenceImageId);
      if (!imageId) {
        logger.debug("[spatial-reference] Ignoring malformed Global Gallery reference %s", referenceImageId);
        return null;
      }
      const image = await createGlobalGalleryStorage(args.db).getImageById(imageId);
      if (!image) {
        logger.debug("[spatial-reference] Global Gallery image %s is missing", imageId);
        return null;
      }
      const filePath = resolveGalleryImagePath({ chatId: "global", filePath: image.filePath });
      if (!filePath) {
        logger.debug("[spatial-reference] Global Gallery image file %s is missing", imageId);
        return null;
      }
      return (await readFile(filePath)).toString("base64");
    }

    const image = await createGalleryStorage(args.db).getById(referenceImageId);
    if (!image || image.chatId !== args.chatId) {
      logger.debug(
        "[spatial-reference] Ignoring missing or cross-chat gallery image %s for chat %s",
        referenceImageId,
        args.chatId,
      );
      return null;
    }
    const filePath = resolveGalleryImagePath(image);
    if (!filePath) {
      logger.debug("[spatial-reference] Gallery image file %s is missing for chat %s", referenceImageId, args.chatId);
      return null;
    }
    return (await readFile(filePath)).toString("base64");
  } catch (err) {
    logger.warn(err, "[spatial-reference] Failed to read gallery image %s for chat %s", referenceImageId, args.chatId);
    return null;
  }
}

export function mergeSpatialLocationReferenceImages(
  locationReferenceImage: string | null,
  otherReferenceImages: string[],
  maximum: number,
): string[] {
  if (maximum <= 0) return [];
  return (locationReferenceImage ? [locationReferenceImage, ...otherReferenceImages] : otherReferenceImages).slice(
    0,
    maximum,
  );
}
