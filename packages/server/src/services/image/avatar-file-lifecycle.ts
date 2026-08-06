import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { DB } from "../../db/connection.js";
import { inArray } from "../../db/file-query.js";
import {
  characterCardVersions,
  characterGroups,
  characters,
  personaCardVersions,
  personas,
} from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";

const LOCAL_AVATAR_PREFIX = "/api/avatars/file/";
let avatarLifecycleQueue = Promise.resolve();

/** Serialize avatar-reference mutations with final-reference file cleanup. */
export async function withAvatarFileLifecycleLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const previous = avatarLifecycleQueue;
  let release!: () => void;
  avatarLifecycleQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

/** Resolve a stored app avatar URL without permitting nested paths or root escape. */
export function resolveStoredAvatarFile(
  avatarPath: string | null | undefined,
  avatarRoot = join(DATA_DIR, "avatars"),
): string | null {
  if (!avatarPath?.startsWith(LOCAL_AVATAR_PREFIX)) return null;

  const encodedFilename = avatarPath.slice(LOCAL_AVATAR_PREFIX.length).split(/[?#]/u, 1)[0];
  if (!encodedFilename) return null;

  try {
    const filename = decodeURIComponent(encodedFilename);
    if (
      !filename ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("\0") ||
      filename === "." ||
      filename === ".."
    ) {
      return null;
    }
    return assertInsideDir(avatarRoot, join(avatarRoot, filename));
  } catch {
    return null;
  }
}

function avatarPaths(rows: Array<{ avatarPath: string | null }>) {
  return rows.flatMap((row) => (row.avatarPath ? [row.avatarPath] : []));
}

/** Capture every current and historical avatar owned by the selected characters. */
export async function collectCharacterAvatarPaths(db: DB, characterIds: readonly string[]): Promise<string[]> {
  const ids = Array.from(new Set(characterIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const [current, versions] = await Promise.all([
    db.select({ avatarPath: characters.avatarPath }).from(characters).where(inArray(characters.id, ids)),
    db
      .select({ avatarPath: characterCardVersions.avatarPath })
      .from(characterCardVersions)
      .where(inArray(characterCardVersions.characterId, ids)),
  ]);
  return Array.from(new Set([...avatarPaths(current), ...avatarPaths(versions)]));
}

/** Capture every current and historical avatar owned by the selected personas. */
export async function collectPersonaAvatarPaths(db: DB, personaIds: readonly string[]): Promise<string[]> {
  const ids = Array.from(new Set(personaIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const [current, versions] = await Promise.all([
    db.select({ avatarPath: personas.avatarPath }).from(personas).where(inArray(personas.id, ids)),
    db
      .select({ avatarPath: personaCardVersions.avatarPath })
      .from(personaCardVersions)
      .where(inArray(personaCardVersions.personaId, ids)),
  ]);
  return Array.from(new Set([...avatarPaths(current), ...avatarPaths(versions)]));
}

async function referencedAvatarFiles(db: DB, avatarRoot: string): Promise<Set<string>> {
  const [characterRows, characterVersionRows, personaRows, personaVersionRows, groupRows] = await Promise.all([
    db.select({ avatarPath: characters.avatarPath }).from(characters),
    db.select({ avatarPath: characterCardVersions.avatarPath }).from(characterCardVersions),
    db.select({ avatarPath: personas.avatarPath }).from(personas),
    db.select({ avatarPath: personaCardVersions.avatarPath }).from(personaCardVersions),
    db.select({ avatarPath: characterGroups.avatarPath }).from(characterGroups),
  ]);

  const referenced = new Set<string>();
  for (const avatarPath of avatarPaths([
    ...characterRows,
    ...characterVersionRows,
    ...personaRows,
    ...personaVersionRows,
    ...groupRows,
  ])) {
    const filePath = resolveStoredAvatarFile(avatarPath, avatarRoot);
    if (filePath) referenced.add(filePath);
  }
  return referenced;
}

/** Remove local avatar files after their final database reference has been deleted. */
async function unlinkAvatarFilesIfUnreferencedUnlocked(input: {
  db: DB;
  avatarPaths: readonly string[];
  avatarRoot: string;
}): Promise<number> {
  const avatarRoot = input.avatarRoot;
  const referenced = await referencedAvatarFiles(input.db, avatarRoot);
  const candidates = new Set<string>();
  for (const avatarPath of input.avatarPaths) {
    const filePath = resolveStoredAvatarFile(avatarPath, avatarRoot);
    if (filePath) candidates.add(filePath);
  }

  let deleted = 0;
  for (const filePath of candidates) {
    if (referenced.has(filePath)) continue;
    try {
      await unlink(filePath);
      deleted++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(error, "Could not remove unreferenced avatar file %s", filePath);
      }
    }
  }
  return deleted;
}

/** Remove local avatar files after their final database reference has been deleted. */
export async function unlinkAvatarFilesIfUnreferenced(input: {
  db: DB;
  avatarPaths: readonly string[];
  /** Test-only filesystem override. */
  avatarRoot?: string;
}): Promise<number> {
  return withAvatarFileLifecycleLock(() =>
    unlinkAvatarFilesIfUnreferencedUnlocked({
      ...input,
      avatarRoot: input.avatarRoot ?? join(DATA_DIR, "avatars"),
    }),
  );
}

/** Hold the lifecycle lock from reference capture through mutation and cleanup. */
export async function mutateAvatarReferencesAndCleanup<T>(input: {
  db: DB;
  collectAvatarPaths: () => Promise<string[]>;
  mutateReferences: () => Promise<T>;
  cleanupFiles?: boolean;
  /** Test-only filesystem override. */
  avatarRoot?: string;
}): Promise<{ result: T; filesDeleted: number }> {
  return withAvatarFileLifecycleLock(async () => {
    const avatarPaths = await input.collectAvatarPaths();
    const result = await input.mutateReferences();
    const filesDeleted =
      input.cleanupFiles === false
        ? 0
        : await unlinkAvatarFilesIfUnreferencedUnlocked({
            db: input.db,
            avatarPaths,
            avatarRoot: input.avatarRoot ?? join(DATA_DIR, "avatars"),
          });
    return { result, filesDeleted };
  });
}
