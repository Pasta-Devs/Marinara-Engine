import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createPersonaGalleryStorage } from "../storage/persona-gallery.storage.js";
import { resolveStoredGalleryFile, unlinkGalleryFileIfUnreferenced } from "./gallery-file-lifecycle.js";

const LEGACY_COPY_CREATION_WINDOW_MS = 60_000;

type ChatGalleryImage = {
  id: string;
  chatId: string;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
};

type EntityGalleryImage = {
  id: string;
  filePath: string;
  sourceChatImageId: string | null;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type ChatGalleryCascadeDeletionResult = {
  characterCopiesRemoved: number;
  personaCopiesRemoved: number;
  filesRemoved: number;
};

function resolveSafeGalleryPath(galleryRoot: string, relativePath: string): string | null {
  return resolveStoredGalleryFile(relativePath, galleryRoot)?.absolutePath ?? null;
}

function legacyCandidateWindow(source: ChatGalleryImage) {
  const createdAt = Date.parse(source.createdAt);
  if (!Number.isFinite(createdAt)) return null;
  return {
    createdAfter: new Date(createdAt - LEGACY_COPY_CREATION_WINDOW_MS).toISOString(),
    createdBefore: new Date(createdAt + LEGACY_COPY_CREATION_WINDOW_MS).toISOString(),
    prompt: source.prompt,
    provider: source.provider,
    model: source.model,
    width: source.width,
    height: source.height,
  };
}

function matchingLegacyMetadata(source: ChatGalleryImage, candidate: EntityGalleryImage): boolean {
  if (candidate.sourceChatImageId) return false;
  const sourceCreatedAt = Date.parse(source.createdAt);
  const candidateCreatedAt = Date.parse(candidate.createdAt);
  if (
    !Number.isFinite(sourceCreatedAt) ||
    !Number.isFinite(candidateCreatedAt) ||
    Math.abs(sourceCreatedAt - candidateCreatedAt) > LEGACY_COPY_CREATION_WINDOW_MS
  ) {
    return false;
  }
  return (
    candidate.prompt === source.prompt &&
    candidate.provider === source.provider &&
    candidate.model === source.model &&
    candidate.width === source.width &&
    candidate.height === source.height
  );
}

function fileDigest(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function exactFileCopy(sourcePath: string, candidatePath: string, sourceDigest: string): boolean {
  try {
    if (!existsSync(candidatePath) || statSync(candidatePath).size !== statSync(sourcePath).size) return false;
    return fileDigest(candidatePath) === sourceDigest;
  } catch {
    return false;
  }
}

function uniqueRows<T extends { id: string }>(rows: readonly T[]): T[] {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function existingChatGalleryFiles(
  galleryRoot: string,
  image: ChatGalleryImage,
): Array<{ relativePath: string; absolutePath: string }> {
  const filename = basename(image.filePath.replace(/\\/g, "/"));
  const candidates = new Set([image.filePath, `${image.chatId}/${filename}`]);
  return Array.from(candidates).flatMap((candidate) => {
    const resolved = resolveSafeGalleryPath(galleryRoot, candidate);
    return resolved && existsSync(resolved) ? [{ relativePath: candidate, absolutePath: resolved }] : [];
  });
}

function legacyExactCopies(
  galleryRoot: string,
  source: ChatGalleryImage,
  sourcePath: string | undefined,
  candidates: readonly EntityGalleryImage[],
): EntityGalleryImage[] {
  if (!sourcePath) return [];
  let sourceDigest: string;
  try {
    sourceDigest = fileDigest(sourcePath);
  } catch (error) {
    logger.warn(error, "[gallery/delete] Could not fingerprint legacy source image %s", source.id);
    return [];
  }
  return candidates.filter((candidate) => {
    if (!matchingLegacyMetadata(source, candidate)) return false;
    const candidatePath = resolveSafeGalleryPath(galleryRoot, candidate.filePath);
    return candidatePath ? exactFileCopy(sourcePath, candidatePath, sourceDigest) : false;
  });
}

/**
 * Delete an explicit chat-gallery image together with generated character and
 * persona references, plus exact legacy copies. Deleting a whole chat
 * intentionally does not use this path, so entity galleries remain available
 * when chat history is removed.
 */
export async function deleteChatGalleryImageEverywhere(input: {
  db: DB;
  image: ChatGalleryImage;
  /** Test-only filesystem override. */
  galleryRoot?: string;
}): Promise<ChatGalleryCascadeDeletionResult> {
  const galleryRoot = input.galleryRoot ?? join(DATA_DIR, "gallery");
  const characterGallery = createCharacterGalleryStorage(input.db);
  const personaGallery = createPersonaGalleryStorage(input.db);
  const legacyWindow = legacyCandidateWindow(input.image);
  const [linkedCharacterCopies, linkedPersonaCopies, legacyCharacterImages, legacyPersonaImages] = await Promise.all([
    characterGallery.listBySourceChatImageId(input.image.id),
    personaGallery.listBySourceChatImageId(input.image.id),
    legacyWindow ? characterGallery.listLegacyCandidates(legacyWindow) : [],
    legacyWindow ? personaGallery.listLegacyCandidates(legacyWindow) : [],
  ]);

  const chatFiles = existingChatGalleryFiles(galleryRoot, input.image);
  const sourcePath = chatFiles[0]?.absolutePath;
  const characterCopies = uniqueRows([
    ...linkedCharacterCopies,
    ...legacyExactCopies(galleryRoot, input.image, sourcePath, legacyCharacterImages),
  ]);
  const personaCopies = uniqueRows([
    ...linkedPersonaCopies,
    ...legacyExactCopies(galleryRoot, input.image, sourcePath, legacyPersonaImages),
  ]);

  const filePaths = new Set(chatFiles.map((file) => file.relativePath));
  for (const copy of [...characterCopies, ...personaCopies]) {
    const filePath = resolveSafeGalleryPath(galleryRoot, copy.filePath);
    if (filePath) filePaths.add(copy.filePath);
    else if (!filePath)
      logger.warn(
        "[gallery/delete] Skipped unsafe linked gallery path for image %s while deleting chat image %s",
        copy.id,
        input.image.id,
      );
  }

  const filename = basename(input.image.filePath.replace(/\\/g, "/"));
  const fallbackFilePath = `${input.image.chatId}/${filename}`;
  await input.db.transaction(async (tx) => {
    const txGallery = createGalleryStorage(tx);
    const txCharacterGallery = createCharacterGalleryStorage(tx);
    const txPersonaGallery = createPersonaGalleryStorage(tx);
    for (const copy of characterCopies) await txCharacterGallery.remove(copy.id);
    for (const copy of personaCopies) await txPersonaGallery.remove(copy.id);
    await txGallery.removeByChatAndFilePath(input.image.chatId, input.image.filePath);
    if (fallbackFilePath !== input.image.filePath) {
      await txGallery.removeByChatAndFilePath(input.image.chatId, fallbackFilePath);
    }
    await txGallery.remove(input.image.id);
  });

  let filesRemoved = 0;
  for (const filePath of filePaths) {
    if (await unlinkGalleryFileIfUnreferenced({ db: input.db, filePath, galleryRoot })) {
      filesRemoved += 1;
    }
  }

  return {
    characterCopiesRemoved: characterCopies.length,
    personaCopiesRemoved: personaCopies.length,
    filesRemoved,
  };
}
