import { useCallback, useEffect } from "react";
import type { GameState, PlayerStats } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { useGameStateStore } from "../stores/game-state.store";

export type GameStatePatchField =
  | "date"
  | "time"
  | "location"
  | "weather"
  | "temperature"
  | "presentCharacters"
  | "playerStats"
  | "personaStats"
  | "fieldLocks";

type GameStatePatch = Partial<Record<GameStatePatchField, unknown>>;
type GameStatePatchTarget = {
  messageId?: string;
  swipeIndex?: number;
};
type QueuedGameStatePatch = {
  chatId: string;
  target: GameStatePatchTarget;
  fields: GameStatePatch;
  revision: number;
};
type InFlightGameStatePatch = {
  chatId: string;
  controller: AbortController;
  promise: Promise<void>;
  canceled: boolean;
};

const PATCH_DEBOUNCE_MS = 500;
const PATCH_QUEUE_STORAGE_KEY = "marinara:pending-game-state-patches:v1";
const pendingPatches = new Map<string, QueuedGameStatePatch>();
const durablePatches = new Map<string, QueuedGameStatePatch>();
const patchTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightPatches = new Map<string, InFlightGameStatePatch>();
let beforeUnloadListeners = 0;
let restoredStoredPatches = false;
let nextPatchRevision = 1;

function createEmptyPlayerStats(): PlayerStats {
  return {
    stats: [],
    attributes: null,
    skills: {},
    inventory: [],
    activeQuests: [],
    status: "",
  };
}

function createEmptyGameState(chatId: string): GameState {
  return {
    id: "",
    chatId,
    messageId: "",
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: null,
    createdAt: "",
  };
}

function getCurrentGameStateForChat(chatId: string) {
  const current = useGameStateStore.getState().current;
  return current?.chatId === chatId ? current : null;
}

function getPatchTarget(state: GameState | null): GameStatePatchTarget {
  if (!state) return {};
  return {
    messageId: state.messageId || undefined,
    swipeIndex:
      typeof state.swipeIndex === "number" && Number.isInteger(state.swipeIndex) && state.swipeIndex >= 0
        ? state.swipeIndex
        : undefined,
  };
}

function getPatchKey(chatId: string, target: GameStatePatchTarget) {
  return `${chatId}\u0000${target.messageId ?? ""}\u0000${target.swipeIndex ?? ""}`;
}

function getNextPatchRevision() {
  const revision = nextPatchRevision;
  nextPatchRevision += 1;
  return revision;
}

function cloneQueuedPatch(queued: QueuedGameStatePatch): QueuedGameStatePatch {
  return {
    chatId: queued.chatId,
    target: { ...queued.target },
    fields: { ...queued.fields },
    revision: queued.revision,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateStoredPatchEntry(value: unknown): [string, QueuedGameStatePatch] | null {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" || !isRecord(value[1])) {
    return null;
  }

  const queued = value[1];
  if (typeof queued.chatId !== "string" || !isRecord(queued.fields)) return null;
  const target = isRecord(queued.target) ? queued.target : {};
  const messageId = typeof target.messageId === "string" ? target.messageId : undefined;
  const swipeIndex =
    typeof target.swipeIndex === "number" && Number.isInteger(target.swipeIndex) && target.swipeIndex >= 0
      ? target.swipeIndex
      : undefined;

  return [
    value[0],
    {
      chatId: queued.chatId,
      target: { messageId, swipeIndex },
      fields: queued.fields,
      revision: typeof queued.revision === "number" ? queued.revision : getNextPatchRevision(),
    },
  ];
}

function persistPendingPatches() {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(durablePatches.entries()).filter(([, queued]) => Object.keys(queued.fields).length > 0);
    if (entries.length === 0) {
      window.localStorage.removeItem(PATCH_QUEUE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PATCH_QUEUE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best effort only. The active in-memory queue remains authoritative.
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
      target: queued.target,
      fields: {
        ...(existing?.fields ?? {}),
        ...queued.fields,
      },
      revision: getNextPatchRevision(),
    };
    pendingPatches.set(key, restored);
    durablePatches.set(key, cloneQueuedPatch(restored));
  }
  persistPendingPatches();
}

function requeuePatch(key: string, queued: QueuedGameStatePatch) {
  const existing = pendingPatches.get(key);
  const next = {
    chatId: queued.chatId,
    target: queued.target,
    fields: {
      ...queued.fields,
      ...(existing?.fields ?? {}),
    },
    revision: getNextPatchRevision(),
  };
  pendingPatches.set(key, next);
  durablePatches.set(key, cloneQueuedPatch(next));
  persistPendingPatches();
}

function buildPayload(queued: QueuedGameStatePatch) {
  const payload: GameStatePatch & GameStatePatchTarget = { ...queued.fields };
  if (queued.target.messageId) {
    payload.messageId = queued.target.messageId;
  }
  if (queued.target.swipeIndex !== undefined) {
    payload.swipeIndex = queued.target.swipeIndex;
  }

  return payload;
}

function queuePatch(chatId: string, field: GameStatePatchField, value: unknown) {
  const target = getPatchTarget(getCurrentGameStateForChat(chatId));
  const key = getPatchKey(chatId, target);
  const existingDurable = durablePatches.get(key);
  const queued = pendingPatches.get(key) ?? {
    chatId,
    target,
    fields: { ...(existingDurable?.fields ?? {}) },
    revision: getNextPatchRevision(),
  };
  queued.fields[field] = value;
  queued.revision = getNextPatchRevision();
  pendingPatches.set(key, queued);
  durablePatches.set(key, cloneQueuedPatch(queued));
  persistPendingPatches();

  const existingTimer = patchTimers.get(key);
  if (existingTimer) clearTimeout(existingTimer);

  patchTimers.set(
    key,
    setTimeout(() => {
      void flushGameStatePatch(chatId).catch((error) => {
        console.warn("Failed to flush game-state patch", error);
      });
    }, PATCH_DEBOUNCE_MS),
  );
}

export async function flushGameStatePatch(chatId?: string) {
  const errors: unknown[] = [];
  const entries = Array.from(pendingPatches.entries()).filter(([, queued]) => !chatId || queued.chatId === chatId);

  for (const [key, queued] of entries) {
    const timer = patchTimers.get(key);
    if (timer) clearTimeout(timer);
    patchTimers.delete(key);

    if (Object.keys(queued.fields).length === 0) continue;
    const queuedSnapshot: QueuedGameStatePatch = {
      chatId: queued.chatId,
      target: { ...queued.target },
      fields: { ...queued.fields },
      revision: queued.revision,
    };
    pendingPatches.delete(key);
    durablePatches.set(key, cloneQueuedPatch(queuedSnapshot));
    persistPendingPatches();

    const payload = buildPayload(queuedSnapshot);
    const previousInFlight = inFlightPatches.get(key);
    if (previousInFlight) {
      try {
        await previousInFlight.promise;
      } catch (error) {
        if (!previousInFlight.canceled) {
          requeuePatch(key, queuedSnapshot);
          errors.push(error);
          continue;
        }
        // Superseded/discarded writes should not block the queued replacement.
      }
    }

    const controller = new AbortController();
    const inFlightEntry: InFlightGameStatePatch = {
      chatId: queuedSnapshot.chatId,
      controller,
      promise: Promise.resolve(),
      canceled: false,
    };
    const request: Promise<void> = api
      .patch(`/chats/${queuedSnapshot.chatId}/game-state`, { ...payload, manual: true }, { signal: controller.signal })
      .then(() => undefined)
      .catch((error) => {
        if (!inFlightEntry.canceled) {
          requeuePatch(key, queuedSnapshot);
        }
        throw error;
      })
      .finally(() => {
        if (inFlightPatches.get(key)?.promise === request) {
          inFlightPatches.delete(key);
        }
      });
    inFlightEntry.promise = request;
    inFlightPatches.set(key, inFlightEntry);

    try {
      await request;
      const durable = durablePatches.get(key);
      if (durable?.revision === queuedSnapshot.revision) {
        durablePatches.delete(key);
        persistPendingPatches();
      }
    } catch (error) {
      if (!inFlightEntry.canceled) errors.push(error);
    }
  }

  const inFlightResults = await Promise.allSettled(
    Array.from(inFlightPatches.values())
      .filter((entry) => !chatId || entry.chatId === chatId)
      .map((entry) => entry.promise),
  );
  for (const result of inFlightResults) {
    if (result.status === "rejected") errors.push(result.reason);
  }

  if (errors.length > 0) {
    throw new Error(`Failed to flush ${errors.length} game-state patch${errors.length === 1 ? "" : "es"}.`);
  }
}

export function discardPendingGameStatePatch(chatId?: string) {
  const keys = new Set([
    ...Array.from(pendingPatches.entries())
      .filter(([, queued]) => !chatId || queued.chatId === chatId)
      .map(([key]) => key),
    ...Array.from(durablePatches.entries())
      .filter(([, queued]) => !chatId || queued.chatId === chatId)
      .map(([key]) => key),
  ]);

  for (const key of keys) {
    const timer = patchTimers.get(key);
    if (timer) clearTimeout(timer);
    patchTimers.delete(key);
    pendingPatches.delete(key);
    durablePatches.delete(key);
  }
  persistPendingPatches();

  const inFlightKeys = Array.from(inFlightPatches.entries())
    .filter(([, entry]) => !chatId || entry.chatId === chatId)
    .map(([key]) => key);
  for (const key of inFlightKeys) {
    const entry = inFlightPatches.get(key);
    if (!entry) continue;
    entry.canceled = true;
    entry.controller.abort();
    inFlightPatches.delete(key);
  }

  if (!chatId) {
    restoredStoredPatches = false;
    nextPatchRevision = 1;
  }
}

function flushGameStatePatchOnUnload() {
  for (const [key, queued] of pendingPatches.entries()) {
    const timer = patchTimers.get(key);
    if (timer) clearTimeout(timer);
    patchTimers.delete(key);

    if (Object.keys(queued.fields).length === 0) continue;
    const queuedSnapshot = cloneQueuedPatch(queued);
    durablePatches.set(key, queuedSnapshot);
    const payload = buildPayload(queued);
    void api
      .patch(`/chats/${queued.chatId}/game-state`, { ...payload, manual: true }, { keepalive: true })
      .then(() => {
        if (pendingPatches.get(key)?.revision === queuedSnapshot.revision) {
          pendingPatches.delete(key);
        }
        if (durablePatches.get(key)?.revision === queuedSnapshot.revision) {
          durablePatches.delete(key);
          persistPendingPatches();
        }
      })
      .catch(() => {});
  }
  persistPendingPatches();
}

function retainBeforeUnloadFlush() {
  restorePendingPatchesFromStorage();
  if (pendingPatches.size > 0) {
    void flushGameStatePatch().catch((error) => {
      console.warn("Failed to flush restored game-state patches", error);
    });
  }

  if (beforeUnloadListeners === 0) {
    window.addEventListener("beforeunload", flushGameStatePatchOnUnload);
  }
  beforeUnloadListeners += 1;

  return () => {
    beforeUnloadListeners = Math.max(0, beforeUnloadListeners - 1);
    if (beforeUnloadListeners === 0) {
      window.removeEventListener("beforeunload", flushGameStatePatchOnUnload);
    }
  };
}

export function patchGameStateField(chatId: string, field: GameStatePatchField, value: unknown) {
  const store = useGameStateStore.getState();
  if (store.isRefreshing) return;
  const prev = getCurrentGameStateForChat(chatId);
  const nextState = { ...(prev ?? createEmptyGameState(chatId)), [field]: value } as GameState;
  store.setGameState(nextState);
  queuePatch(chatId, field, value);
}

export function patchPlayerStatsField(chatId: string, field: keyof PlayerStats, value: unknown) {
  const current = getCurrentGameStateForChat(chatId)?.playerStats ?? createEmptyPlayerStats();
  patchGameStateField(chatId, "playerStats", { ...current, [field]: value });
}

export function useGameStatePatcher(chatId: string | null, registrationId?: string) {
  const registerFlushPatch = useGameStateStore((s) => s.registerFlushPatch);

  const patchField = useCallback(
    (field: GameStatePatchField, value: unknown) => {
      if (!chatId) return;
      patchGameStateField(chatId, field, value);
    },
    [chatId],
  );

  const patchPlayerStats = useCallback(
    (field: keyof PlayerStats, value: unknown) => {
      if (!chatId) return;
      patchPlayerStatsField(chatId, field, value);
    },
    [chatId],
  );

  const flushPatch = useCallback(async () => {
    if (!chatId) return;
    await flushGameStatePatch(chatId);
  }, [chatId]);

  useEffect(() => retainBeforeUnloadFlush(), []);

  useEffect(() => {
    if (!registrationId) return;
    const unregister = registerFlushPatch(registrationId, flushPatch);
    return () => {
      unregister();
      void flushPatch().catch((error) => {
        console.warn("Failed to flush game-state patch on cleanup", error);
      });
    };
  }, [flushPatch, registerFlushPatch, registrationId]);

  return { patchField, patchPlayerStats, flushPatch };
}
