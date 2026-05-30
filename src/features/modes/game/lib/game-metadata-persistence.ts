import { toast } from "sonner";
import type { Chat } from "../../../../engine/contracts/types/chat";
import { storageApi } from "../../../../shared/api/storage-api";

type GameMetadataPatch = Record<string, unknown>;
type QueuedGameMetadataPatch = {
  chatId: string;
  patch: GameMetadataPatch;
  revision: number;
};
type PersistOptions = {
  onPersisted?: (chat: Chat) => void;
  onPersistedOnce?: boolean;
};
type PersistedChatHandler = {
  handler: (chat: Chat) => void;
  once: boolean;
};

const PATCH_QUEUE_STORAGE_KEY = "marinara:pending-game-metadata-patches:v1";
const RETRY_DELAY_MS = 5_000;

const pendingPatches = new Map<string, QueuedGameMetadataPatch>();
const durablePatches = new Map<string, QueuedGameMetadataPatch>();
const inFlightPatches = new Map<string, Promise<Chat>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const persistedChatHandlers = new Map<string, Map<(chat: Chat) => void, PersistedChatHandler>>();
const lastFailureToastAt = new Map<string, number>();

let restoredStoredPatches = false;
let nextPatchRevision = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneQueuedPatch(queued: QueuedGameMetadataPatch): QueuedGameMetadataPatch {
  return {
    chatId: queued.chatId,
    patch: { ...queued.patch },
    revision: queued.revision,
  };
}

function getNextPatchRevision() {
  const revision = nextPatchRevision;
  nextPatchRevision += 1;
  return revision;
}

function validateStoredPatchEntry(value: unknown): [string, QueuedGameMetadataPatch] | null {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" || !isRecord(value[1])) {
    return null;
  }

  const queued = value[1];
  if (typeof queued.chatId !== "string" || !isRecord(queued.patch)) return null;

  return [
    value[0],
    {
      chatId: queued.chatId,
      patch: queued.patch,
      revision: typeof queued.revision === "number" ? queued.revision : getNextPatchRevision(),
    },
  ];
}

function persistPendingPatches() {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(durablePatches.entries()).filter(([, queued]) => Object.keys(queued.patch).length > 0);
    if (entries.length === 0) {
      window.localStorage.removeItem(PATCH_QUEUE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PATCH_QUEUE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // The in-memory queue still owns the active write path when localStorage is unavailable.
  }
}

function restorePendingPatchesFromStorage() {
  if (restoredStoredPatches || typeof window === "undefined") return;
  restoredStoredPatches = true;

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY);
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(parsed)) return;
  for (const rawEntry of parsed) {
    const entry = validateStoredPatchEntry(rawEntry);
    if (!entry) continue;
    const [key, queued] = entry;
    const existing = pendingPatches.get(key);
    const restored = {
      chatId: queued.chatId,
      patch: {
        ...(existing?.patch ?? {}),
        ...queued.patch,
      },
      revision: getNextPatchRevision(),
    };
    pendingPatches.set(key, restored);
    durablePatches.set(key, cloneQueuedPatch(restored));
  }
  persistPendingPatches();
}

function reportPersistenceFailure(chatId: string, error: unknown) {
  console.warn("[game-metadata] Failed to persist game metadata; retrying.", { chatId, error });
  const now = Date.now();
  const lastToastAt = lastFailureToastAt.get(chatId);
  if (lastToastAt === undefined || now - lastToastAt > 30_000) {
    lastFailureToastAt.set(chatId, now);
    toast.error("Game progress could not be saved. Marinara will retry automatically.");
  }
}

function scheduleRetry(chatId: string) {
  if (retryTimers.has(chatId)) return;
  retryTimers.set(
    chatId,
    setTimeout(() => {
      retryTimers.delete(chatId);
      void flushPendingGameMetadataPatches(chatId).catch(() => {
        /* failure was already reported and re-queued */
      });
    }, RETRY_DELAY_MS),
  );
}

function retainPersistedHandler(chatId: string, options: PersistOptions) {
  if (!options.onPersisted) return;
  const handlers = persistedChatHandlers.get(chatId) ?? new Map<(chat: Chat) => void, PersistedChatHandler>();
  handlers.set(options.onPersisted, {
    handler: options.onPersisted,
    once: options.onPersistedOnce === true,
  });
  persistedChatHandlers.set(chatId, handlers);
}

function requeuePatch(key: string, queued: QueuedGameMetadataPatch) {
  const existing = pendingPatches.get(key);
  const next = {
    chatId: queued.chatId,
    patch: {
      ...queued.patch,
      ...(existing?.patch ?? {}),
    },
    revision: getNextPatchRevision(),
  };
  pendingPatches.set(key, next);
  durablePatches.set(key, cloneQueuedPatch(next));
  persistPendingPatches();
  scheduleRetry(queued.chatId);
}

export function getPendingGameMetadataPatch(chatId: string): GameMetadataPatch | null {
  restorePendingPatchesFromStorage();
  const queued = pendingPatches.get(chatId) ?? durablePatches.get(chatId);
  return queued ? { ...queued.patch } : null;
}

export function persistGameMetadataPatch(chatId: string, patch: GameMetadataPatch, options: PersistOptions = {}) {
  restorePendingPatchesFromStorage();
  retainPersistedHandler(chatId, options);

  const existing = pendingPatches.get(chatId) ?? durablePatches.get(chatId);
  const queued = {
    chatId,
    patch: {
      ...(existing?.patch ?? {}),
      ...patch,
    },
    revision: getNextPatchRevision(),
  };
  pendingPatches.set(chatId, queued);
  durablePatches.set(chatId, cloneQueuedPatch(queued));
  persistPendingPatches();

  const retryTimer = retryTimers.get(chatId);
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimers.delete(chatId);
  }

  return flushPendingGameMetadataPatches(chatId, options);
}

export async function flushPendingGameMetadataPatches(chatId?: string, options: PersistOptions = {}) {
  restorePendingPatchesFromStorage();
  if (chatId) retainPersistedHandler(chatId, options);

  const errors: unknown[] = [];
  const entries = Array.from(pendingPatches.entries()).filter(([key]) => !chatId || key === chatId);

  for (const [key] of entries) {
    const previousInFlight = inFlightPatches.get(key);
    if (previousInFlight) {
      await previousInFlight.catch(() => {
        /* previous failure was already re-queued */
      });
    }

    const latestQueued = pendingPatches.get(key);
    if (!latestQueued || Object.keys(latestQueued.patch).length === 0) continue;

    const queuedSnapshot = cloneQueuedPatch(latestQueued);
    pendingPatches.delete(key);
    durablePatches.set(key, cloneQueuedPatch(queuedSnapshot));
    persistPendingPatches();

    const request = storageApi
      .patchChatMetadata<Chat>(queuedSnapshot.chatId, queuedSnapshot.patch)
      .then((chat) => {
        const durable = durablePatches.get(key);
        if (durable?.revision === queuedSnapshot.revision) {
          durablePatches.delete(key);
          persistPendingPatches();
        }
        const handlers = persistedChatHandlers.get(queuedSnapshot.chatId);
        for (const [handler, entry] of handlers ?? []) {
          entry.handler(chat);
          if (entry.once) {
            handlers?.delete(handler);
          }
        }
        return chat;
      })
      .catch((error) => {
        requeuePatch(key, queuedSnapshot);
        reportPersistenceFailure(queuedSnapshot.chatId, error);
        throw error;
      })
      .finally(() => {
        if (inFlightPatches.get(key) === request) {
          inFlightPatches.delete(key);
        }
      });

    inFlightPatches.set(key, request);

    try {
      await request;
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to persist ${errors.length} game metadata patch${errors.length === 1 ? "" : "es"}.`);
  }
}

export async function resetGameMetadataPersistenceForTest() {
  for (const timer of retryTimers.values()) clearTimeout(timer);
  retryTimers.clear();
  pendingPatches.clear();
  durablePatches.clear();
  persistedChatHandlers.clear();
  lastFailureToastAt.clear();
  const inFlight = Array.from(inFlightPatches.values());
  inFlightPatches.clear();
  await Promise.allSettled(inFlight);
  restoredStoredPatches = false;
  nextPatchRevision = 1;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PATCH_QUEUE_STORAGE_KEY);
  }
}
