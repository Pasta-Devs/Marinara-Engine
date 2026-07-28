// ──────────────────────────────────────────────
// Shared on-disk image thumbnailer (chat backgrounds + game asset images)
// ──────────────────────────────────────────────
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "fs";
import { writeFile } from "fs/promises";
import { createHash, randomUUID } from "crypto";
import { extname, join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";
import { getSharp } from "./sharp-runtime.js";
import { BACKGROUND_THUMBNAIL_WIDTH } from "@marinara-engine/shared";

// Sibling of the image directories, never inside them: the background library listing walks its own dir.
const THUMB_DIR = join(DATA_DIR, "backgrounds-thumbs");

/**
 * Widths the thumbnailer will honour, so `?w=` can't be used to fill the disk. One entry on
 * purpose: the sidebar row banner and the settings picker tile both fit inside 320px even at
 * 3x, so they share a single cached file. Add a width here when something needs a bigger one.
 */
const THUMB_WIDTHS = new Set([BACKGROUND_THUMBNAIL_WIDTH]);

/**
 * Extensions worth handing to sharp. Anything else (animated GIF, SVG, audio, video — the game
 * asset route serves the whole directory) is rejected up front rather than re-failing a decode on
 * every request, because misses are not cached the way successes are.
 */
const THUMBABLE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tiff", ".tif", ".bmp"]);

/** Parse a `?w=` query value into a supported width, or null when the original should be served. */
export function parseThumbnailWidth(value: unknown): number | null {
  const width = Number(value);
  return Number.isFinite(width) && THUMB_WIDTHS.has(width) ? width : null;
}

/**
 * Downscaled copy of an image, cached on disk. Returns null whenever the original
 * should be served instead: unsupported width, animated source, or no `sharp` on this
 * platform (it is an optional native dep — see services/image/sharp-runtime).
 *
 * Cache key includes the source path and mtime so replacing a file serves the new image
 * immediately and two sources with the same basename never collide.
 * ponytail: superseded thumbs are never swept; they are a few KB each and bounded by
 * how often someone re-uploads over a filename. Add a sweep if that stops being true.
 */
export async function resolveThumbPath(filePath: string, width: number): Promise<string | null> {
  if (!THUMB_WIDTHS.has(width) || !THUMBABLE_EXTS.has(extname(filePath).toLowerCase())) return null;

  try {
    // Inside the try: the source can vanish between the caller's existsSync and this stat.
    const key = createHash("sha1").update(filePath).digest("hex").slice(0, 16);
    const thumbPath = join(THUMB_DIR, `${width}-${statSync(filePath).mtimeMs}-${key}.webp`);
    if (existsSync(thumbPath)) return thumbPath;

    const sharp = await getSharp();
    const buffer = await sharp(filePath).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true });
    const temporaryPath = `${thumbPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, buffer);
      try {
        renameSync(temporaryPath, thumbPath);
      } catch (error) {
        // On Windows, a concurrent winner may make rename fail because the target now exists.
        if (!existsSync(thumbPath)) throw error;
      }
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
    return thumbPath;
  } catch (error) {
    logger.warn(error instanceof Error ? error : new Error(String(error)), "Image thumbnail failed for %s", filePath);
    return null;
  }
}
