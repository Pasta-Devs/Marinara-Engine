// ──────────────────────────────────────────────
// Persistent TTS audio cache
// ──────────────────────────────────────────────
import { isIosWebKitBrowser } from "./generation-stream-policy";

const DB_NAME = "marinara-tts-audio-cache";
const DB_VERSION = 2;
const STORE_NAME = "voiceLines";
const META_STORE_NAME = "voiceLineMeta";
const MAX_MEMORY_ENTRIES = 150;
// #5889: iOS WebKit deliberately has no persistent tier, so the memory tier
// is the ONLY tier there - and 150 entries with no byte bound can hold
// hundreds of MB of live blobs in the web-content process. The count cap
// stays; the byte cap is what actually protects Safari.
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const MAX_PERSISTENT_ENTRIES = 750;
const MAX_PERSISTENT_BYTES = 100 * 1024 * 1024;
const PERSISTENT_PRUNE_THROTTLE_MS = 30_000;

type CachedVoiceLine = {
  key: string;
  blob: Blob;
  createdAt: number;
  lastUsedAt: number;
  size: number;
};

type CachedVoiceLineMeta = Omit<CachedVoiceLine, "blob">;
export type CachedTTSAudioMeta = CachedVoiceLineMeta;
export type CachedTTSAudioExportEntry = CachedVoiceLineMeta & {
  blob: Blob;
};

const memoryCache = new Map<string, Blob>();
let memoryCacheBytes = 0;
const inFlight = new Map<string, Promise<Blob>>();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let lastPersistentPruneAt = 0;

export function shouldUsePersistentTTSAudioCache(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return !isIosWebKitBrowser(userAgent, platform, maxTouchPoints);
}

// One voice line is stored under its primary key AND alias keys, all sharing
// the same physical Blob - the byte budget must count each Blob once, or
// aliases would book a 10MB line as 30MB and evict real audio early. The
// reference scans are bounded by MAX_MEMORY_ENTRIES.
function blobReferencedByAnotherKey(key: string, blob: Blob): boolean {
  for (const [otherKey, otherBlob] of memoryCache) {
    if (otherKey !== key && otherBlob === blob) return true;
  }
  return false;
}

function dropFromMemory(key: string) {
  const existing = memoryCache.get(key);
  memoryCache.delete(key);
  if (existing && !blobReferencedByAnotherKey(key, existing)) memoryCacheBytes -= existing.size;
}

function rememberInMemory(key: string, blob: Blob) {
  dropFromMemory(key);
  // A single blob over the whole-tier budget must never enter the cache -
  // it would evict everything else and still bust the cap.
  if (blob.size > MAX_MEMORY_BYTES) return;
  if (!blobReferencedByAnotherKey(key, blob)) memoryCacheBytes += blob.size;
  memoryCache.set(key, blob);
  while (memoryCache.size > MAX_MEMORY_ENTRIES || memoryCacheBytes > MAX_MEMORY_BYTES) {
    const oldest = memoryCache.keys().next().value;
    if (!oldest) break;
    dropFromMemory(oldest);
  }
}

/** The production memory read: a hit refreshes Map recency, making the tier LRU. */
function readFromMemory(key: string): Blob | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  rememberInMemory(key, hit);
  return hit;
}

/** Test seams for the regression lane; production code never calls these. */
export function __rememberTTSAudioInMemoryForTests(key: string, blob: Blob) {
  rememberInMemory(key, blob);
}
export function __readTTSAudioFromMemoryForTests(key: string): Blob | null {
  return readFromMemory(key);
}
export function __ttsMemoryCacheStatsForTests(): { entries: number; bytes: number } {
  return { entries: memoryCache.size, bytes: memoryCacheBytes };
}
export function __resetTTSMemoryCacheForTests() {
  memoryCache.clear();
  memoryCacheBytes = 0;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (
    typeof navigator !== "undefined" &&
    !shouldUsePersistentTTSAudioCache(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  ) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "key" });

      if (store && !store.indexNames.contains("lastUsedAt")) {
        store.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
      }
      const metaStore = db.objectStoreNames.contains(META_STORE_NAME)
        ? request.transaction?.objectStore(META_STORE_NAME)
        : db.createObjectStore(META_STORE_NAME, { keyPath: "key" });
      if (metaStore && !metaStore.indexNames.contains("lastUsedAt")) {
        metaStore.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      resolve(null);
    };
    request.onblocked = () => {
      dbPromise = null;
      resolve(null);
    };
  });

  return dbPromise;
}

function hasMetadataStore(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains(META_STORE_NAME);
}

async function touchPersistentBlobMeta(db: IDBDatabase, record: CachedVoiceLine): Promise<void> {
  if (!hasMetadataStore(db)) return;

  const now = Date.now();
  const tx = db.transaction(META_STORE_NAME, "readwrite");
  tx.objectStore(META_STORE_NAME).put({
    key: record.key,
    createdAt: record.createdAt || now,
    lastUsedAt: now,
    size: record.size || record.blob.size,
  } satisfies CachedVoiceLineMeta);
  await transactionDone(tx);
}

async function prunePersistentCache(db: IDBDatabase): Promise<void> {
  if (!hasMetadataStore(db)) return;

  const now = Date.now();
  if (now - lastPersistentPruneAt < PERSISTENT_PRUNE_THROTTLE_MS) return;
  lastPersistentPruneAt = now;

  const readTx = db.transaction(META_STORE_NAME, "readonly");
  const metas = await requestToPromise<CachedVoiceLineMeta[]>(readTx.objectStore(META_STORE_NAME).getAll());
  await transactionDone(readTx);

  const totalBytes = metas.reduce((sum, meta) => sum + Math.max(0, meta.size || 0), 0);
  const excessEntries = Math.max(0, metas.length - MAX_PERSISTENT_ENTRIES);
  const excessBytes = Math.max(0, totalBytes - MAX_PERSISTENT_BYTES);
  if (excessEntries === 0 && excessBytes === 0) return;

  const byOldest = [...metas].sort((a, b) => (a.lastUsedAt || a.createdAt) - (b.lastUsedAt || b.createdAt));
  const keysToDelete = new Set<string>();
  let bytesFreed = 0;
  for (const meta of byOldest) {
    if (keysToDelete.size >= excessEntries && bytesFreed >= excessBytes) break;
    keysToDelete.add(meta.key);
    bytesFreed += Math.max(0, meta.size || 0);
  }
  if (keysToDelete.size === 0) return;

  const deleteTx = db.transaction([STORE_NAME, META_STORE_NAME], "readwrite");
  const blobStore = deleteTx.objectStore(STORE_NAME);
  const metaStore = deleteTx.objectStore(META_STORE_NAME);
  for (const key of keysToDelete) {
    blobStore.delete(key);
    metaStore.delete(key);
    dropFromMemory(key);
  }
  await transactionDone(deleteTx);
}

async function getPersistentBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;

  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const record = await requestToPromise<CachedVoiceLine | undefined>(store.get(key));
    if (!record?.blob) return null;

    void transactionDone(tx).catch(() => {});
    void touchPersistentBlobMeta(db, record).catch(() => {});

    return record.blob;
  } catch {
    return null;
  }
}

async function putPersistentBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    const now = Date.now();
    const record = {
      key,
      blob,
      createdAt: now,
      lastUsedAt: now,
      size: blob.size,
    } satisfies CachedVoiceLine;
    const tx = db.transaction(hasMetadataStore(db) ? [STORE_NAME, META_STORE_NAME] : STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    if (hasMetadataStore(db)) {
      tx.objectStore(META_STORE_NAME).put({
        key,
        createdAt: now,
        lastUsedAt: now,
        size: blob.size,
      } satisfies CachedVoiceLineMeta);
    }
    await transactionDone(tx);
    void prunePersistentCache(db).catch(() => {});
  } catch {
    // Memory cache still protects this runtime even if IndexedDB is unavailable.
  }
}

export async function getCachedTTSAudioBlob(key: string): Promise<Blob | null> {
  const memoryHit = readFromMemory(key);
  if (memoryHit) return memoryHit;

  const persisted = await getPersistentBlob(key);
  if (persisted) rememberInMemory(key, persisted);
  return persisted;
}

export async function listCachedTTSAudioMeta(): Promise<CachedTTSAudioMeta[]> {
  const db = await openDb();
  if (!db || !hasMetadataStore(db)) return [];

  try {
    const tx = db.transaction(META_STORE_NAME, "readonly");
    const metas = await requestToPromise<CachedVoiceLineMeta[]>(tx.objectStore(META_STORE_NAME).getAll());
    await transactionDone(tx);
    return metas.sort((left, right) => (right.lastUsedAt || right.createdAt) - (left.lastUsedAt || left.createdAt));
  } catch {
    return [];
  }
}

export async function listCachedTTSAudioEntries(): Promise<CachedTTSAudioExportEntry[]> {
  const db = await openDb();
  if (!db) return [];

  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const records = await requestToPromise<CachedVoiceLine[]>(tx.objectStore(STORE_NAME).getAll());
    await transactionDone(tx);
    return records
      .filter((record) => record.blob instanceof Blob)
      .map((record) => ({
        key: record.key,
        blob: record.blob,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        size: record.size || record.blob.size,
      }))
      .sort((left, right) => (right.lastUsedAt || right.createdAt) - (left.lastUsedAt || left.createdAt));
  } catch {
    return [];
  }
}

export async function getOrCreateCachedTTSAudioBlob(
  key: string,
  create: () => Promise<Blob>,
  aliases: string[] = [],
): Promise<Blob> {
  const keys = [...new Set([key, ...aliases].filter(Boolean))];

  for (const cacheKey of keys) {
    const cached = await getCachedTTSAudioBlob(cacheKey);
    if (cached) {
      if (cacheKey !== key) {
        rememberInMemory(key, cached);
      }
      return cached;
    }
  }

  for (const cacheKey of keys) {
    const pending = inFlight.get(cacheKey);
    if (pending) {
      const blob = await pending;
      rememberInMemory(key, blob);
      return blob;
    }
  }

  const promise = (async () => {
    for (const cacheKey of keys) {
      const secondLook = await getCachedTTSAudioBlob(cacheKey);
      if (secondLook) {
        if (cacheKey !== key) {
          rememberInMemory(key, secondLook);
        }
        return secondLook;
      }
    }

    const blob = await create();
    for (const cacheKey of keys) {
      rememberInMemory(cacheKey, blob);
      await putPersistentBlob(cacheKey, blob);
    }
    return blob;
  })().finally(() => {
    for (const cacheKey of keys) {
      inFlight.delete(cacheKey);
    }
  });

  for (const cacheKey of keys) {
    inFlight.set(cacheKey, promise);
  }
  return promise;
}
