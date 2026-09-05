// ──────────────────────────────────────────────
// Shared on-disk image thumbnailer (backgrounds, gallery + game asset images)
// ──────────────────────────────────────────────
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "fs";
import { open, writeFile } from "fs/promises";
import { createHash, randomUUID } from "crypto";
import { extname, join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";
import { getSharp } from "./sharp-runtime.js";
import { BACKGROUND_THUMBNAIL_WIDTH, CHAT_IMAGE_PREVIEW_WIDTH } from "@marinara-engine/shared";

// Sibling of the image directories, never inside them: the background library listing walks its own dir.
const THUMB_DIR = join(DATA_DIR, "backgrounds-thumbs");

/**
 * Fixed widths only, so `?w=` cannot create arbitrarily many copies of each image.
 * Compact tiles share 320px; mobile inline illustrations use 1024px.
 */
const THUMB_WIDTHS = new Set([BACKGROUND_THUMBNAIL_WIDTH, CHAT_IMAGE_PREVIEW_WIDTH]);

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
 * ponytail: unused previews are not swept. There are two fixed sizes per source/version;
 * add a cache sweep if accumulated gallery previews become a storage burden.
 */
export async function resolveThumbPath(filePath: string, width: number): Promise<string | null> {
  if (!THUMB_WIDTHS.has(width) || !THUMBABLE_EXTS.has(extname(filePath).toLowerCase())) return null;

  try {
    // Inside the try: the source can vanish between the caller's existsSync and this stat.
    const key = createHash("sha1").update(filePath).digest("hex").slice(0, 16);
    const thumbPath = join(THUMB_DIR, `${width}-${statSync(filePath).mtimeMs}-${key}.webp`);
    const sharp = await getSharp();
    const image = sharp(filePath);
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1) return null;
    if (metadata.format === "png") {
      // Sharp does not expose APNG frame counts. acTL must precede the first IDAT.
      // ponytail: inspect only 64 KiB of headers; unusually large metadata keeps the
      // original. Increase this ceiling if those images need previews too.
      const handle = await open(filePath, "r");
      let staticPng = false;
      try {
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(64 * 1024), 0, 64 * 1024, 0);
        for (let offset = 8; offset + 8 <= bytesRead; offset += 12 + buffer.readUInt32BE(offset)) {
          const chunk = buffer.toString("ascii", offset + 4, offset + 8);
          if (chunk === "acTL") return null;
          if (chunk === "IDAT") {
            staticPng = true;
            break;
          }
        }
      } finally {
        await handle.close();
      }
      if (!staticPng) return null;
    }
    if (existsSync(thumbPath)) return thumbPath;

    const buffer = await image.rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
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
