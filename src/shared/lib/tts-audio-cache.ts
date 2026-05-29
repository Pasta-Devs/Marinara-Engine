// ──────────────────────────────────────────────
// Persistent TTS audio cache
// ──────────────────────────────────────────────

const DB_NAME = "marinara-tts-audio-cache";
const DB_VERSION = 1;
const STORE_NAME = "voiceLines";
const MAX_MEMORY_ENTRIES = 150;

type CachedVoiceLine = {
  key: string;
  blob: Blob;
  createdAt: number;
  lastUsedAt: number;
  size: number;
};

const memoryCache = new Map<string, Blob>();
const inFlight = new Map<string, Promise<Blob>>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function rememberInMemory(key: string, blob: Blob) {
  memoryCache.delete(key);
  memoryCache.set(key, blob);
  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
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
    void (async () => {
      try {
        const writeTx = db.transaction(STORE_NAME, "readwrite");
        writeTx.objectStore(STORE_NAME).put({ ...record, lastUsedAt: Date.now() });
        await transactionDone(writeTx);
      } catch {
        // Best-effort recency update only.
      }
    })();

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
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      key,
      blob,
      createdAt: now,
      lastUsedAt: now,
      size: blob.size,
    } satisfies CachedVoiceLine);
    await transactionDone(tx);
  } catch {
    // Memory cache still protects this runtime even if IndexedDB is unavailable.
  }
}

async function getCachedTTSAudioBlob(key: string): Promise<Blob | null> {
  const memoryHit = memoryCache.get(key);
  if (memoryHit) {
    rememberInMemory(key, memoryHit);
    return memoryHit;
  }

  const persisted = await getPersistentBlob(key);
  if (persisted) rememberInMemory(key, persisted);
  return persisted;
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
        await putPersistentBlob(key, cached);
      }
      return cached;
    }
  }

  for (const cacheKey of keys) {
    const pending = inFlight.get(cacheKey);
    if (pending) {
      const blob = await pending;
      rememberInMemory(key, blob);
      await putPersistentBlob(key, blob);
      return blob;
    }
  }

  const promise = (async () => {
    for (const cacheKey of keys) {
      const secondLook = await getCachedTTSAudioBlob(cacheKey);
      if (secondLook) {
        if (cacheKey !== key) {
          rememberInMemory(key, secondLook);
          await putPersistentBlob(key, secondLook);
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
