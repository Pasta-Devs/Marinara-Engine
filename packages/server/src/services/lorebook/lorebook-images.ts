import { constants } from "node:fs";
import { lstat, mkdir, open, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  LOREBOOK_ENTRY_IMAGE_PATH_PATTERN,
  MAX_LOREBOOK_ENTRY_IMAGES,
  type LorebookEntryImage,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../config/runtime-config.js";
import { isAllowedImageBuffer } from "../../utils/security.js";
import { realPathInRealFolder } from "../../utils/app-folder.js";

export const LOREBOOK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LOREBOOK_EXPORT_IMAGE_MAX_BYTES = 64 * 1024 * 1024;
export const lorebookImagesDirectory = () => join(getDataDir(), "lorebooks", "images", "entries");

export function lorebookImageInfo(buffer: Buffer) {
  const info = isAllowedImageBuffer(buffer);
  return buffer.length <= LOREBOOK_IMAGE_MAX_BYTES && info && ["png", "jpg", "webp"].includes(info.ext) ? info : null;
}

export async function saveLorebookImage(buffer: Buffer): Promise<LorebookEntryImage> {
  const info = lorebookImageInfo(buffer);
  if (!info) throw new Error("Reference images must be PNG, JPEG, or WebP and no larger than 5 MB");
  const filename = `${randomUUID()}.${info.ext}`;
  await mkdir(lorebookImagesDirectory(), { recursive: true });
  await writeFile(join(lorebookImagesDirectory(), filename), buffer, { flag: "wx" });
  return { path: `/api/lorebooks/entry-images/${filename}`, caption: "" };
}

/** Only for a newly uploaded file that failed to attach; saved references may be shared by copies. */
export async function discardLorebookImage(image: LorebookEntryImage): Promise<void> {
  if (!LOREBOOK_ENTRY_IMAGE_PATH_PATTERN.test(image.path)) return;
  await unlink(join(lorebookImagesDirectory(), image.path.slice(image.path.lastIndexOf("/") + 1)));
}

/** Strict server-generated paths, bounded reads, and no file symlink traversal. */
export async function readLorebookImageDataUrl(
  path: string,
  exportBudget?: { remainingBytes: number },
): Promise<string | null> {
  if (!LOREBOOK_ENTRY_IMAGE_PATH_PATTERN.test(path)) return null;
  const filename = path.slice(path.lastIndexOf("/") + 1);
  try {
    const directory = lorebookImagesDirectory();
    // The real-path check refuses a file link that leads out of the folder. Like O_NOFOLLOW, it follows a link to the
    // images folder itself (moved to another disk), as before.
    const checkedPath = realPathInRealFolder(directory, join(directory, filename));
    const checked = await lstat(checkedPath, { bigint: true });
    if (!checked.isFile()) return null;
    // Windows has no O_NOFOLLOW (it is undefined there), so the open follows a link swapped in after the check. Only
    // the file that was checked is read: the one opened must be that same file.
    // ponytail: a volume with no file IDs (FAT32, exFAT) reports ino 0 for every file, so there the size and creation
    // time alone tell the files apart. Upgrade path: open with FILE_FLAG_OPEN_REPARSE_POINT through a native helper.
    const file = await open(checkedPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const stat = await file.stat({ bigint: true });
      const sameFile =
        stat.ino === checked.ino &&
        stat.dev === checked.dev &&
        stat.size === checked.size &&
        stat.birthtimeNs === checked.birthtimeNs;
      if (!sameFile) return null;
      if (!stat.isFile() || stat.size > BigInt(LOREBOOK_IMAGE_MAX_BYTES)) return null;
      const buffer = Buffer.alloc(Number(stat.size));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead !== buffer.length) return null;
      const info = lorebookImageInfo(buffer);
      if (!info || !filename.endsWith(`.${info.ext}`)) return null;
      if (exportBudget) {
        // ponytail: reserve at most 64 MiB of valid images per export before base64 encoding,
        // plus this bounded 5 MiB read; stream exports if larger selections are needed.
        if (buffer.length > exportBudget.remainingBytes) {
          throw Object.assign(
            new Error(
              "Reference images exceed the 64 MiB export limit. Export fewer items at a time or use a native profile ZIP.",
            ),
            { statusCode: 413 },
          );
        }
        exportBudget.remainingBytes -= buffer.length;
      }
      return `data:${info.mimeType};base64,${buffer.toString("base64")}`;
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 413) throw error;
    return null;
  }
}

/** Both lorebook export formats carry bytes rather than another installation's paths. */
export async function embedLorebookImages(
  entries: Array<Record<string, unknown>>,
  exportBudget = { remainingBytes: LOREBOOK_EXPORT_IMAGE_MAX_BYTES },
) {
  const portable: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const images: Array<{ dataUrl: string; caption: string }> = [];
    for (const image of (entry.images ?? []) as LorebookEntryImage[]) {
      const dataUrl = await readLorebookImageDataUrl(image.path, exportBudget);
      // A missing file is already lost; skipping it keeps the rest of the export usable.
      if (!dataUrl) {
        logger.warn("[lorebooks] Skipping missing reference image %s for entry %s", image.path, String(entry.name));
        continue;
      }
      images.push({ dataUrl, caption: image.caption });
    }
    portable.push({ ...entry, images });
  }
  return portable;
}

type DecodedLorebookImage = { caption: string } & ({ dataUrl: string } | { path: string });

/** Validate before writing; retain existing data URLs so imports do not hold decoded buffers for every entry. */
export async function decodeLorebookImages(value: unknown, allowLocalPaths = false): Promise<DecodedLorebookImage[]> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_LOREBOOK_ENTRY_IMAGES) throw new Error("Invalid reference images");
  return Promise.all(
    value.map(async (image: unknown): Promise<DecodedLorebookImage> => {
      if (!image || typeof image !== "object") throw new Error("Invalid reference image");
      const { dataUrl, path, caption = "" } = image as Record<string, unknown>;
      if (allowLocalPaths && typeof path === "string" && typeof caption === "string" && caption.length <= 500) {
        if (!(await readLorebookImageDataUrl(path))) throw new Error("Missing local reference image");
        return { path, caption };
      }
      if (typeof caption !== "string" || caption.length > 500 || typeof dataUrl !== "string")
        throw new Error("Invalid reference image");
      if (dataUrl.length > Math.ceil(LOREBOOK_IMAGE_MAX_BYTES / 3) * 4 + 64)
        throw new Error("Reference image too large");
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
      if (!match) throw new Error("Invalid reference image data");
      const buffer = Buffer.from(match[2]!, "base64");
      const info = lorebookImageInfo(buffer);
      if (!info || info.mimeType !== match[1] || buffer.toString("base64") !== match[2])
        throw new Error("Invalid reference image data");
      return { dataUrl, caption };
    }),
  );
}

export async function saveDecodedLorebookImages(decoded: DecodedLorebookImage[]): Promise<LorebookEntryImage[]> {
  const images: LorebookEntryImage[] = [];
  try {
    for (const image of decoded) {
      if ("path" in image) images.push(image);
      else {
        const buffer = Buffer.from(image.dataUrl.slice(image.dataUrl.indexOf(",") + 1), "base64");
        images.push({ ...(await saveLorebookImage(buffer)), caption: image.caption });
      }
    }
  } catch (error) {
    for (const image of images) {
      if (decoded.some((item) => "path" in item && item.path === image.path)) continue;
      await discardLorebookImage(image).catch((cleanupError: unknown) =>
        logger.warn(cleanupError, "Failed to remove a partially saved lorebook image"),
      );
    }
    throw error;
  }
  return images;
}

/** Roll back only newly written import assets; reused local paths may have other owners. */
export async function discardImportedLorebookImages(
  groups: Iterable<LorebookEntryImage[]>,
  decodedGroups: Iterable<DecodedLorebookImage[]>,
): Promise<void> {
  const reused = new Set<string>();
  for (const group of decodedGroups) for (const image of group) if ("path" in image) reused.add(image.path);
  for (const group of groups)
    for (const image of group)
      if (!reused.has(image.path))
        await discardLorebookImage(image).catch((error: unknown) => {
          logger.warn(error, "Failed to remove an unused imported lorebook image");
        });
}

export async function restoreLorebookImages(value: unknown): Promise<LorebookEntryImage[]> {
  return saveDecodedLorebookImages(await decodeLorebookImages(value));
}

/** Keep local character mirrors small; embed bytes only at the export boundary. */
export async function embedCharacterBookImages<T extends Record<string, any>>(
  data: T,
  exportBudget = { remainingBytes: LOREBOOK_EXPORT_IMAGE_MAX_BYTES },
): Promise<T> {
  const book = data.character_book;
  if (!book || !Array.isArray(book.entries)) return data;
  const entries = [];
  for (const entry of book.entries) {
    const images = entry.extensions?.marinaraImages;
    if (!Array.isArray(images) || !images.some((image: any) => typeof image?.path === "string")) {
      entries.push(entry);
      continue;
    }
    const [portable] = await embedLorebookImages([{ ...entry, images }], exportBudget);
    entries.push({ ...entry, extensions: { ...entry.extensions, marinaraImages: portable!.images } });
  }
  return { ...data, character_book: { ...book, entries } };
}
