import type { Dirent } from "node:fs";
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import type { DB } from "../../db/connection.js";
import { inArray } from "../../db/file-query.js";
import { encodeShardKey, isLazyUnitTable, isShardDataFileName } from "../../db/file-backed-store.js";
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
const STORED_AVATAR_EXTENSIONS = new Set([".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
export const ABANDONED_AVATAR_MIN_AGE_MS = 10 * 60 * 1_000;
let avatarLifecycleQueue = Promise.resolve();

export interface AbandonedAvatarFileSummary {
  files: number;
  bytes: number;
}

type AbandonedAvatarFile = {
  filePath: string;
  bytes: number;
};

const IDENTITY_HISTORY_TABLES = ["messages", "message_swipes", "message_trash"] as const;
type FrozenAvatarReferenceScan = {
  files: Set<string>;
  generations: ReadonlyMap<string, number>;
};

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

/** Remove an avatar file created before its database reference could be saved. */
export async function removeUnattachedAvatarFile(
  target: { filePath: string } | { avatarPath: string | null | undefined },
): Promise<void> {
  const filePath = "filePath" in target ? target.filePath : resolveStoredAvatarFile(target.avatarPath);
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn(error, "Could not remove unattached avatar file %s", filePath);
    }
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

/**
 * Read cold identity history without leasing lazy chat tables. Resident rows are authoritative,
 * including unflushed inserts/deletes; cold units cannot have unflushed writes. Capture
 * committed resident references in a short transaction, then read cold shards outside it.
 * The caller must validate the sampled generations under the final avatar lock and count/unlink transaction.
 * An unreadable shard/metadata makes cleanup inconclusive, so retain every candidate file.
 */
async function frozenIdentityAvatarFiles(
  db: DB,
  avatarRoot: string,
  candidates: ReadonlySet<string>,
): Promise<FrozenAvatarReferenceScan | null> {
  const startedAt = performance.now();
  const files = new Set<string>();
  if (candidates.size === 0) return { files, generations: new Map() };
  const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid identity metadata");
    return value as Record<string, unknown>;
  };
  const readExtra = (value: unknown) => {
    const extra = record(typeof value === "string" ? JSON.parse(value) : (value ?? {}));
    if (extra.personaSnapshot == null) return;
    const avatarUrl = record(extra.personaSnapshot).avatarUrl;
    if (avatarUrl == null) return;
    if (typeof avatarUrl !== "string") throw new Error("Invalid frozen avatar URL");
    const filePath = resolveStoredAvatarFile(avatarUrl, avatarRoot);
    if (filePath && candidates.has(filePath)) files.add(filePath);
  };
  const readRow = (table: string, value: unknown) => {
    const row = record(value);
    if (table !== "message_trash") {
      readExtra(row.extra);
      return;
    }
    const snapshot = record(typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot);
    readExtra(record(snapshot.message).extra);
    if (snapshot.swipes != null && !Array.isArray(snapshot.swipes)) throw new Error("Invalid trashed swipes");
    for (const swipe of (snapshot.swipes ?? []) as unknown[]) readExtra(record(swipe).extra);
  };

  try {
    const store = db._fileStore;
    const snapshot = await db.transaction(async () => {
      for (const filePath of await referencedAvatarFiles(db, avatarRoot)) {
        if (candidates.has(filePath)) files.add(filePath);
      }
      const residentNames = new Set([...store.getResidentChatUnits()].map((key) => `${encodeShardKey(key)}.json`));
      const fullyResident = store.getFullyResidentLazyTables();
      // No awaits while sampling resident rows: eviction afterward cannot hide captured refs.
      for (const table of IDENTITY_HISTORY_TABLES) {
        if (files.size === candidates.size) break;
        for (const row of store.getResidentLazyRows(table)) {
          readRow(table, row);
          if (files.size === candidates.size) break;
        }
      }
      const generations = new Map(
        IDENTITY_HISTORY_TABLES.map((table) => [table, store.getTableWriteGeneration(table)]),
      );
      return { residentNames, fullyResident, generations };
    });
    const result = { files, generations: snapshot.generations };
    if (files.size === candidates.size) return result;
    for (const table of IDENTITY_HISTORY_TABLES) {
      if (isLazyUnitTable(table) && !snapshot.fullyResident.has(table)) {
        const shardDir = join(store.rootDir, "tables", table);
        let entries: string[];
        try {
          entries = await readdir(shardDir);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          entries = [];
        }
        // Include lone backups after interrupted flushes; a valid primary is canonical.
        const names = new Set(entries.filter(isShardDataFileName));
        for (const entry of entries) {
          if (entry.endsWith(".json.bak") && isShardDataFileName(entry.slice(0, -4))) names.add(entry.slice(0, -4));
        }
        for (const name of names) {
          if (snapshot.residentNames.has(name)) continue;
          const path = join(shardDir, name);
          const rows = JSON.parse(await readFile(entries.includes(name) ? path : `${path}.bak`, "utf8")) as unknown;
          if (!Array.isArray(rows)) throw new Error("Invalid identity history shard");
          for (const row of rows) {
            readRow(table, row);
            if (files.size === candidates.size) return result;
          }
        }
      }
    }
    return result;
  } catch (error) {
    logger.warn(error, "Could not inspect frozen identity history; retaining avatar files");
    return null;
  } finally {
    logger.debug(
      "Inspected %d frozen avatar candidates in %d ms",
      candidates.size,
      Math.round(performance.now() - startedAt),
    );
  }
}

/** Call inside the final avatar lifecycle lock and DB transaction, after cold I/O. */
async function excludeFrozenAvatarFiles(
  db: DB,
  avatarRoot: string,
  files: AbandonedAvatarFile[],
  scan: FrozenAvatarReferenceScan | null,
): Promise<AbandonedAvatarFile[]> {
  if (files.length === 0 || scan === null) return [];
  const current = await referencedAvatarFiles(db, avatarRoot);
  if (!frozenIdentityHistoryUnchanged(db, scan)) {
    // ponytail: concurrent history edits retain candidates until the next cleanup;
    // add a bounded rescan if busy profiles need immediate reclamation.
    logger.debug("Frozen identity history changed during inspection; retaining avatar files");
    return [];
  }
  return files.filter((file) => !scan.files.has(file.filePath) && !current.has(file.filePath));
}

function frozenIdentityHistoryUnchanged(db: DB, scan: FrozenAvatarReferenceScan | null): boolean {
  return (
    scan !== null &&
    [...scan.generations].every(([table, generation]) => db._fileStore.getTableWriteGeneration(table) === generation)
  );
}

async function abandonedAvatarFilesUnlocked(input: {
  avatarRoot: string;
  minimumAgeMs: number;
  nowMs: number;
}): Promise<AbandonedAvatarFile[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(input.avatarRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const abandoned: AbandonedAvatarFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !STORED_AVATAR_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    const filePath = assertInsideDir(input.avatarRoot, join(input.avatarRoot, entry.name));
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile() || input.nowMs - fileStat.mtimeMs < input.minimumAgeMs) continue;
      abandoned.push({ filePath, bytes: fileStat.size });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(error, "Could not inspect possible abandoned avatar file %s", filePath);
      }
    }
  }
  return abandoned;
}

function summarizeAbandonedAvatarFiles(files: readonly AbandonedAvatarFile[]): AbandonedAvatarFileSummary {
  return {
    files: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
  };
}

/** Find old, direct avatar image files that have no current or historical database reference. */
export async function scanAbandonedAvatarFiles(input: {
  db: DB;
  /** Test-only filesystem override. */
  avatarRoot?: string;
  /** Test-only clock override. */
  nowMs?: number;
  /** Test-only age override. */
  minimumAgeMs?: number;
}): Promise<AbandonedAvatarFileSummary> {
  const avatarRoot = input.avatarRoot ?? join(DATA_DIR, "avatars");
  const abandoned = await abandonedAvatarFilesUnlocked({
    avatarRoot,
    minimumAgeMs: input.minimumAgeMs ?? ABANDONED_AVATAR_MIN_AGE_MS,
    nowMs: input.nowMs ?? Date.now(),
  });
  const frozen = await frozenIdentityAvatarFiles(input.db, avatarRoot, new Set(abandoned.map((file) => file.filePath)));
  return withAvatarFileLifecycleLock(() =>
    input.db.transaction(async () => {
      const files = await excludeFrozenAvatarFiles(input.db, avatarRoot, abandoned, frozen);
      return summarizeAbandonedAvatarFiles(frozenIdentityHistoryUnchanged(input.db, frozen) ? files : []);
    }),
  );
}

/** Re-scan and delete old, direct avatar image files that remain unreferenced. */
export async function deleteAbandonedAvatarFiles(input: {
  db: DB;
  /** Test-only filesystem override. */
  avatarRoot?: string;
  /** Test-only clock override. */
  nowMs?: number;
  /** Test-only age override. */
  minimumAgeMs?: number;
}): Promise<AbandonedAvatarFileSummary> {
  const avatarRoot = input.avatarRoot ?? join(DATA_DIR, "avatars");
  const abandoned = await abandonedAvatarFilesUnlocked({
    avatarRoot,
    minimumAgeMs: input.minimumAgeMs ?? ABANDONED_AVATAR_MIN_AGE_MS,
    nowMs: input.nowMs ?? Date.now(),
  });
  const frozen = await frozenIdentityAvatarFiles(input.db, avatarRoot, new Set(abandoned.map((file) => file.filePath)));
  return withAvatarFileLifecycleLock(() =>
    input.db.transaction(async () => {
      const deleted: AbandonedAvatarFile[] = [];
      for (const file of await excludeFrozenAvatarFiles(input.db, avatarRoot, abandoned, frozen)) {
        if (!frozenIdentityHistoryUnchanged(input.db, frozen)) break;
        try {
          await unlink(file.filePath);
          deleted.push(file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            logger.warn(error, "Could not remove abandoned avatar file %s", file.filePath);
          }
        }
      }
      return summarizeAbandonedAvatarFiles(deleted);
    }),
  );
}

/** Remove local avatar files after their final database reference has been deleted. */
export async function unlinkAvatarFilesIfUnreferenced(input: {
  db: DB;
  avatarPaths: readonly string[];
  /** Test-only filesystem override. */
  avatarRoot?: string;
}): Promise<number> {
  const avatarRoot = input.avatarRoot ?? join(DATA_DIR, "avatars");
  const candidates = new Set<string>();
  for (const avatarPath of input.avatarPaths) {
    const filePath = resolveStoredAvatarFile(avatarPath, avatarRoot);
    if (filePath) candidates.add(filePath);
  }
  if (candidates.size === 0) return 0;
  const frozen = await frozenIdentityAvatarFiles(input.db, avatarRoot, candidates);
  const files = [...candidates].map((filePath) => ({ filePath, bytes: 0 }));
  // Validate after cold I/O, then keep the reference decision and unlink in one write turn.
  return withAvatarFileLifecycleLock(() =>
    input.db.transaction(async () => {
      let deleted = 0;
      for (const { filePath } of await excludeFrozenAvatarFiles(input.db, avatarRoot, files, frozen)) {
        if (!frozenIdentityHistoryUnchanged(input.db, frozen)) break;
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
    }),
  );
}

/** Hold reference capture and mutation together, then stage cleanup without holding the lock over cold I/O. */
export async function mutateAvatarReferencesAndCleanup<T>(input: {
  db: DB;
  collectAvatarPaths: () => Promise<string[]>;
  mutateReferences: () => Promise<T>;
  cleanupFiles?: boolean;
  /** Test-only filesystem override. */
  avatarRoot?: string;
}): Promise<{ result: T; filesDeleted: number }> {
  const shouldCleanup = input.cleanupFiles !== false;
  const { result, avatarPaths } = await withAvatarFileLifecycleLock(async () => {
    const avatarPaths = shouldCleanup ? await input.collectAvatarPaths() : [];
    const result = await input.mutateReferences();
    return { result, avatarPaths };
  });
  const filesDeleted = shouldCleanup
    ? await unlinkAvatarFilesIfUnreferenced({
        db: input.db,
        avatarPaths,
        avatarRoot: input.avatarRoot ?? join(DATA_DIR, "avatars"),
      })
    : 0;
  return { result, filesDeleted };
}
