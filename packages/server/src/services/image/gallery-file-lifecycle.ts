import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { DB } from "../../db/connection.js";
import { and, eq } from "../../db/file-query.js";
import { decodeShardKey, encodeShardKey, isLazyUnitTable, isShardDataFileName } from "../../db/file-backed-store.js";
import { characterImages, chatImages, chats, globalImages, personaImages } from "../../db/schema/index.js";
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

/**
 * Every filePath recorded in one chat_images shard file, read without loading
 * the unit. Returns null when the file cannot be ruled out — unreadable,
 * non-array root, or any row whose filePath cannot be read (the serializer
 * writes camelCase; the loader also accepts dbName form, so both spellings
 * are checked before giving up on a row). Target-independent so results are
 * cacheable across calls.
 */
function peekShardFilePaths(shardFilePath: string): ReadonlySet<string> | null {
  try {
    const parsed = JSON.parse(readFileSync(shardFilePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return null;
    const paths = new Set<string>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") return null;
      const candidate = row as { filePath?: unknown; file_path?: unknown };
      const rowPath =
        typeof candidate.filePath === "string"
          ? candidate.filePath
          : typeof candidate.file_path === "string"
            ? candidate.file_path
            : null;
      if (rowPath === null) return null;
      paths.add(rowPath);
    }
    return paths;
  } catch {
    return null;
  }
}

/**
 * Memo of the disk pass. The chats.storage deletion flows call the reference
 * check once or twice per image, and re-reading every cold shard per call is
 * a real event-loop cost on image-heavy installs — so peek results are kept
 * across calls and reused while nothing could have changed them: a shard
 * file on disk only changes through a flush of dirty state, dirtying bumps
 * the table's write generation first, and eviction (the only way a resident
 * unit's answer moves from memory to disk) changes the resident set. Same
 * generation + same resident set ⇒ every non-resident shard file is
 * byte-identical to when it was peeked.
 */
let diskScanCache: {
  /** One process can host stores with different roots (test harnesses do). */
  storageRootDir: string;
  tableGeneration: number;
  residentFingerprint: string;
  byShard: Map<string, ReadonlySet<string> | null>;
} | null = null;

function residentFingerprint(units: ReadonlySet<string>): string {
  return [...units].sort().join("\0");
}

/**
 * The chat_images half of the reference check. The question is cross-chat by
 * design ("does ANY chat still reference this physical file?"), so the naive
 * filePath query cannot be scoped and permanently converted the whole table
 * to fully resident on the first image deletion (#5613). Instead: every
 * non-resident unit's shard file is read directly off disk (sound because a
 * non-resident unit can hold no unflushed state — #5616's invariant), a
 * shard the peek cannot interpret is handed to the real loader by key
 * (recovered from the filename, or by matching the encoding over the eager
 * chats table when the filename is the hash form), and everything resident
 * is answered LAST by one scan over the store's in-memory rows — which sees
 * every row regardless of its chatId shape (null and malformed owner keys
 * live in the pinned UNASSIGNED unit, unreachable by any per-key query) and
 * makes memory authoritative in both directions: an unflushed new row
 * counts, an unflushed delete does not resurrect through its stale shard
 * file. Running the memory scan last also makes mid-call interleavings safe:
 * anything a concurrent request writes or leases during this function's
 * awaits lands in memory and is seen. Only a shard that is unreadable AND
 * unattributable to any unit is assumed referenced, and only after the rest
 * of the sweep found nothing — the safe direction, since a false positive
 * keeps a file on disk while a false negative would delete a file another
 * chat still shows.
 */
async function chatImagesReferenceFile(db: DB, filePath: string): Promise<boolean> {
  const store = db._fileStore;
  if (!isLazyUnitTable("chat_images") || store.getFullyResidentLazyTables().has("chat_images")) {
    // Eager mode or an already-leased table: every row is in memory, so the
    // plain query is complete and leases nothing new.
    const rows = await db.select({ id: chatImages.id }).from(chatImages).where(eq(chatImages.filePath, filePath));
    return rows.length > 0;
  }

  // A sweep is only sound if no unit LEFT residency while it ran: the disk
  // pass skips resident units' shards on the promise that the memory scan
  // will answer for them, and a flush-tail eviction interleaving with an
  // awaited handoff would break that promise (the unit's rows leave memory
  // after its shard was skipped). Additions mid-sweep are safe — the memory
  // scan runs last and sees them. Today's storage awaits resolve without
  // yielding to timers, so the retry is a guard rail for future async steps
  // rather than a live path; if residency will not hold still, fall back to
  // the safe answer.
  for (let attempt = 0; attempt < 3; attempt++) {
    const verdict = await sweepChatImagesOnce(db, filePath);
    if (verdict !== null) return verdict;
  }
  logger.warn(
    "[image-gallery] residency kept changing during the reference sweep; treating %s as still referenced",
    filePath,
  );
  return true;
}

/**
 * One full sweep. Returns true/false when the sweep is conclusive, or null
 * when a unit left residency mid-sweep and the result cannot be trusted.
 */
async function sweepChatImagesOnce(db: DB, filePath: string): Promise<boolean | null> {
  const store = db._fileStore;
  const startResident = store.getResidentChatUnits();
  const tableGeneration = store.getTableWriteGeneration("chat_images");
  const fingerprint = residentFingerprint(startResident);
  if (
    diskScanCache === null ||
    diskScanCache.storageRootDir !== store.rootDir ||
    diskScanCache.tableGeneration !== tableGeneration ||
    diskScanCache.residentFingerprint !== fingerprint
  ) {
    diskScanCache = {
      storageRootDir: store.rootDir,
      tableGeneration,
      residentFingerprint: fingerprint,
      byShard: new Map(),
    };
  }
  const { byShard } = diskScanCache;

  // Disk pass first, so any loader handoff below happens before the memory
  // scan reads the final resident state (a handoff can pull misfiled stray
  // rows into their owning units, which the memory scan must then see).
  const residentShardNames = new Set([...startResident].map((unitKey) => `${encodeShardKey(unitKey)}.json`));
  const handoffKeys = new Set<string>();
  let unattributableShard: string | null = null;
  let chatIdsByShardName: Map<string, string> | null = null;
  const shardDir = join(store.rootDir, "tables", "chat_images");
  if (existsSync(shardDir)) {
    // Sorted so scan order — and therefore which unit a handoff touches first
    // — is deterministic across filesystems.
    for (const entry of readdirSync(shardDir).sort()) {
      let shardName = entry;
      let peeked: ReadonlySet<string> | null;
      if (entry.endsWith(".json.bak")) {
        // A lone .bak is an interrupted flush; only the loader can arbitrate
        // what the rows are. A .bak whose main file exists is ignorable —
        // the main file is canonical whenever it is readable.
        shardName = entry.slice(0, -".bak".length);
        if (!isShardDataFileName(shardName) || existsSync(join(shardDir, shardName))) continue;
        peeked = null;
      } else if (!isShardDataFileName(entry)) {
        // Dotfiles, .tmp, .corrupt and other artifacts are invisible to the
        // store's own discovery and must be invisible here too.
        continue;
      } else {
        if (residentShardNames.has(shardName)) continue; // the memory scan answers for these
        const cached = byShard.get(shardName);
        peeked = cached !== undefined ? cached : peekShardFilePaths(join(shardDir, entry));
        if (cached === undefined) byShard.set(shardName, peeked);
      }
      if (peeked !== null) {
        if (peeked.has(filePath)) return true;
        continue;
      }
      if (residentShardNames.has(shardName)) continue;
      // Untrusted shard: find its unit so the real loader can arbitrate. The
      // filename decode must round-trip — a non-canonical percent form would
      // otherwise hand the loader a key whose canonical file is a DIFFERENT
      // shard, silently skipping the untrusted one.
      const decoded = decodeShardKey(shardName.slice(0, -".json".length));
      if (decoded !== null && `${encodeShardKey(decoded)}.json` === shardName) {
        handoffKeys.add(decoded);
        continue;
      }
      // Hash-form or non-canonical name: the filename cannot name the unit,
      // but the eager chats table can — match the encoding over known ids.
      if (chatIdsByShardName === null) {
        const chatRows = await db.select({ id: chats.id }).from(chats);
        chatIdsByShardName = new Map(chatRows.map((row) => [`${encodeShardKey(row.id)}.json`, row.id]));
      }
      const matched = chatIdsByShardName.get(shardName);
      if (matched !== undefined) {
        handoffKeys.add(matched);
        continue;
      }
      unattributableShard = entry;
    }
  }

  // Loader handoffs: load exactly the untrusted units through the full
  // recovery ladder, one at a time, stopping at the first hit so one corrupt
  // shard does not drag every other untrusted shard into memory.
  for (const unitKey of handoffKeys) {
    const recovered = await db
      .select({ id: chatImages.id })
      .from(chatImages)
      .where(and(eq(chatImages.chatId, unitKey), eq(chatImages.filePath, filePath)))
      .limit(1);
    if (recovered.length > 0) return true;
  }

  // Memory scan, last: one pass over every in-memory row — the resident
  // units, the handoff loads, stray rows pinned during those loads, and the
  // UNASSIGNED unit's rows whatever their chatId shape.
  for (const row of store.getResidentLazyRows("chat_images")) {
    if (row.filePath === filePath || row.file_path === filePath) return true;
  }

  // Soundness gate: a negative answer is only conclusive if every unit whose
  // shard the disk pass skipped is still resident, so the memory scan really
  // did answer for it. (Handoffs only ADD residency; eviction is the only
  // remover, and it can run at a flush tail during the awaits above.)
  const endResident = store.getResidentChatUnits();
  for (const unitKey of startResident) {
    if (!endResident.has(unitKey)) return null;
  }

  if (unattributableShard !== null) {
    // An unreadable shard no unit claims: nothing else references the path,
    // so the conservative answer decides. The worst case is an orphan file
    // kept on disk until the shard is repaired or removed.
    logger.warn(
      "[image-gallery] chat_images shard %s is unreadable and matches no known chat; treating %s as still referenced",
      unattributableShard,
      filePath,
    );
    return true;
  }
  return false;
}

/** Check every gallery metadata table for a live reference to one file path. */
export async function galleryFileHasReferences(db: DB, filePath: string): Promise<boolean> {
  if (await chatImagesReferenceFile(db, filePath)) return true;

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
