import { existsSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { characterImages, chatImages, globalImages, personaImages } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";

export type StoredGalleryFile = {
  absolutePath: string;
  directory: string;
  filename: string;
};

const galleryLifecycleQueues = new Map<string, Promise<void>>();

function normalizedGalleryPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/** Decode one URL path segment while rejecting separators and traversal names. */
export function decodeSafePathSegment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return decoded &&
      !decoded.includes("/") &&
      !decoded.includes("\\") &&
      !decoded.includes("\0") &&
      decoded !== "." &&
      decoded !== ".."
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function galleryFileLifecycleKey(filePath: string, galleryRoot?: string): string {
  return `${resolve(galleryRoot ?? join(DATA_DIR, "gallery"))}\0${normalizedGalleryPath(filePath)}`;
}

/** Return the filename portion of a platform-neutral stored gallery path. */
export function storedGalleryFilename(filePath: string): string {
  return basename(normalizedGalleryPath(filePath));
}

/** Resolve a stored gallery-relative path without permitting root escape. */
export function resolveStoredGalleryFile(
  filePath: string,
  galleryRoot = join(DATA_DIR, "gallery"),
): StoredGalleryFile | null {
  if (!filePath || filePath.includes("\0")) return null;
  try {
    const absolutePath = assertInsideDir(galleryRoot, join(galleryRoot, normalizedGalleryPath(filePath)));
    return {
      absolutePath,
      directory: dirname(absolutePath),
      filename: basename(absolutePath),
    };
  } catch {
    return null;
  }
}

/**
 * Prefer an owner-local gallery file while supporting canonical shared files
 * referenced by owner-scoped URLs.
 */
export function resolveOwnedGalleryPath(galleryRoot: string, ownerRoot: string, filename: string): string {
  const ownedPath = assertInsideDir(ownerRoot, join(ownerRoot, filename));
  if (existsSync(ownedPath)) return ownedPath;
  const sharedRoot = assertInsideDir(galleryRoot, join(galleryRoot, "shared"));
  const sharedPath = assertInsideDir(sharedRoot, join(sharedRoot, filename));
  return existsSync(sharedPath) ? sharedPath : ownedPath;
}

/** Find the metadata row represented by an owner-scoped filename URL. */
export function findGalleryRowByFilename<T extends { filePath: string }>(
  rows: readonly T[],
  filename: string,
): T | null {
  return rows.find((row) => storedGalleryFilename(row.filePath) === filename) ?? null;
}

/** Check every gallery metadata table for a live reference to one file path. */
export async function galleryFileHasReferences(db: DB, filePath: string): Promise<boolean> {
  const chatReference = await db
    .select({ id: chatImages.id })
    .from(chatImages)
    .where(eq(chatImages.filePath, filePath));
  if (chatReference.length > 0) return true;

  const characterReference = await db
    .select({ id: characterImages.id })
    .from(characterImages)
    .where(eq(characterImages.filePath, filePath));
  if (characterReference.length > 0) return true;

  const personaReference = await db
    .select({ id: personaImages.id })
    .from(personaImages)
    .where(eq(personaImages.filePath, filePath));
  if (personaReference.length > 0) return true;

  const globalReference = await db
    .select({ id: globalImages.id })
    .from(globalImages)
    .where(eq(globalImages.filePath, filePath));
  return globalReference.length > 0;
}

/**
 * Serialize reference creation and final-release cleanup for one physical
 * gallery path. The optional root keeps isolated regression files independent.
 */
export async function withGalleryFileLifecycleLock<T>(
  filePath: string,
  operation: () => Promise<T> | T,
  galleryRoot?: string,
  signal?: AbortSignal,
): Promise<T> {
  return withGalleryLifecycleLock(`file\0${galleryFileLifecycleKey(filePath, galleryRoot)}`, operation, signal);
}

async function waitForGalleryLifecycleTurn(previous: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await previous.catch(() => undefined);
    return;
  }

  signal.throwIfAborted();
  let rejectAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason ?? new DOMException("This operation was aborted", "AbortError"));
    signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try {
    if (signal.aborted) rejectAbort();
    await Promise.race([previous.catch(() => undefined), aborted]);
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener("abort", rejectAbort);
  }
}

async function withGalleryLifecycleLock<T>(
  key: string,
  operation: () => Promise<T> | T,
  signal?: AbortSignal,
): Promise<T> {
  const previous = galleryLifecycleQueues.get(key) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolveCurrent) => {
    releaseCurrent = resolveCurrent;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  galleryLifecycleQueues.set(key, tail);
  void tail.then(() => {
    if (galleryLifecycleQueues.get(key) === tail) galleryLifecycleQueues.delete(key);
  });

  try {
    await waitForGalleryLifecycleTurn(previous, signal);
    return await operation();
  } finally {
    releaseCurrent();
  }
}

/**
 * Serialize durable-reference creation and metadata deletion for Global Gallery
 * image ids. Sorting makes multi-image writes acquire locks deterministically.
 */
export async function withGlobalGalleryImageLifecycleLocks<T>(
  imageIds: readonly string[],
  operation: () => Promise<T> | T,
): Promise<T> {
  const ids = Array.from(new Set(imageIds.filter((imageId) => imageId.length > 0))).sort();
  const acquire = (index: number): Promise<T> => {
    const imageId = ids[index];
    return imageId === undefined
      ? Promise.resolve(operation())
      : withGalleryLifecycleLock(`global-image\0${imageId}`, () => acquire(index + 1));
  };
  return acquire(0);
}

/**
 * Remove the physical file only after every gallery has released its metadata
 * reference. Invalid paths and cleanup failures leave at worst an orphan file,
 * never a broken live reference.
 */
export async function unlinkGalleryFileIfUnreferenced(input: {
  db: DB;
  filePath: string;
  /** Test-only filesystem override. */
  galleryRoot?: string;
}): Promise<boolean> {
  return withGalleryFileLifecycleLock(
    input.filePath,
    async () => {
      if (await galleryFileHasReferences(input.db, input.filePath)) return false;

      const storedFile = resolveStoredGalleryFile(input.filePath, input.galleryRoot);
      if (!storedFile) {
        logger.warn("[image-gallery] Skipped cleanup for unsafe gallery path %s", input.filePath);
        return false;
      }

      try {
        unlinkSync(storedFile.absolutePath);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        logger.warn(error, "[image-gallery] Could not remove unreferenced gallery file %s", input.filePath);
        return false;
      }
    },
    input.galleryRoot,
  );
}
