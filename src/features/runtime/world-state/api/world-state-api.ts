import type { GameState } from "../../../../engine/contracts/types/game-state";
import { storageApi } from "../../../../shared/api/storage-api";
import { trackerSnapshotApi, type TrackerSnapshotTarget } from "../../../../shared/api/tracker-snapshot-api";

export type WorldState = GameState;
export type WorldStatePatch = Record<string, unknown>;
export type WorldStateTarget = Partial<TrackerSnapshotTarget>;
type ResolvedWorldStateTarget = { messageId: string; swipeIndex: number };

const VISIBLE_TARGET_MESSAGE_LIMIT = 200;
const VISIBLE_TARGET_MESSAGE_FIELDS = ["id", "role", "activeSwipeIndex", "swipeIndex", "createdAt"];
const OPERATIONAL_PATCH_KEYS = new Set(["manual", "clearOverrides", "targetVisible"]);
const MANUAL_OVERRIDE_FIELDS = ["date", "time", "location", "weather", "temperature"] as const;

interface WorldStateApi {
  /**
   * Gets the visible world state by default, or a specific tracker snapshot when a target is supplied.
   * Argument handling is centralized here: readTarget identifies target-shaped values, resolveVisibleTarget
   * finds the current assistant swipe, storageApi.get loads the chat fallback, trackerSnapshotApi.get loads
   * native snapshots, and withTarget stamps fallback chat state with the resolved target.
   */
  get(chatId: string, target: WorldStateTarget, init?: RequestInit): Promise<WorldState | null>;
  get(chatId: string, init?: RequestInit): Promise<WorldState | null>;
  patch(chatId: string, patch: WorldStatePatch, init?: RequestInit): Promise<WorldState>;
}

function createEmptyWorldState(chatId: string): WorldState {
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
    createdAt: "",
  };
}

function throwIfAborted(init?: RequestInit) {
  if (init?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

function readTarget(value: unknown): ResolvedWorldStateTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "messageId") || typeof record.messageId !== "string") return null;
  const messageId = record.messageId.trim();
  const rawSwipeIndex = record.swipeIndex;
  const swipeIndex =
    typeof rawSwipeIndex === "number" && Number.isInteger(rawSwipeIndex) && rawSwipeIndex >= 0 ? rawSwipeIndex : 0;
  return { messageId, swipeIndex };
}

function readText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text.length ? text : null;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function removePatchControlFields(patch: WorldStatePatch): WorldStatePatch {
  return Object.fromEntries(
    Object.entries(patch).filter(
      ([key, value]) =>
        key !== "messageId" && key !== "swipeIndex" && !OPERATIONAL_PATCH_KEYS.has(key) && value !== undefined,
    ),
  );
}

function updateManualOverrides(
  current: unknown,
  patch: WorldStatePatch,
  options: { manual: boolean; clearOverrides: boolean },
): Record<string, string> | null {
  if (options.clearOverrides) return null;
  if (!options.manual) {
    return current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, string>)
      : null;
  }
  const next =
    current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, string>) } : {};
  for (const field of MANUAL_OVERRIDE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const text = readText(patch[field]);
    if (text) next[field] = text;
    else delete next[field];
  }
  return Object.keys(next).length ? next : null;
}

function withTarget(state: WorldState, chatId: string, target: ResolvedWorldStateTarget | null): WorldState {
  if (!target) return { ...state, chatId };
  return { ...state, chatId, messageId: target.messageId, swipeIndex: target.swipeIndex };
}

function targetKey(target: ResolvedWorldStateTarget) {
  return `${target.messageId}\u0000${target.swipeIndex}`;
}

function canUseChatGameStateFallback(
  state: WorldState | undefined,
  target: ResolvedWorldStateTarget | null,
  options: {
    activeTargetKeys?: Set<string>;
    hasVisibleTarget?: boolean;
    requestedTarget?: boolean;
  } = {},
) {
  if (!state) return false;
  if (!target) return true;
  const stateTarget = readTarget(state);
  if (!stateTarget?.messageId) return true;
  const exact = stateTarget.messageId === target.messageId && stateTarget.swipeIndex === target.swipeIndex;
  if (options.requestedTarget) return exact;
  if (exact && options.hasVisibleTarget) return true;
  return exact && (options.activeTargetKeys?.has(targetKey(stateTarget)) ?? false);
}

async function visibleTargetContext(chatId: string): Promise<{
  target: ResolvedWorldStateTarget | null;
  activeTargetKeys: Set<string>;
}> {
  const messages = await storageApi.listChatMessages<Record<string, unknown>>(chatId, {
    limit: VISIBLE_TARGET_MESSAGE_LIMIT,
    fields: VISIBLE_TARGET_MESSAGE_FIELDS,
  });
  const activeTargetKeys = new Set<string>();
  let target: ResolvedWorldStateTarget | null = null;
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.id !== "string" || !message.id) continue;
    const swipeIndex =
      typeof message.activeSwipeIndex === "number" &&
      Number.isInteger(message.activeSwipeIndex) &&
      message.activeSwipeIndex >= 0
        ? message.activeSwipeIndex
        : 0;
    const assistantTarget = { messageId: message.id, swipeIndex };
    activeTargetKeys.add(targetKey(assistantTarget));
    target = assistantTarget;
  }
  return { target, activeTargetKeys };
}

async function latestAssistantTarget(chatId: string): Promise<ResolvedWorldStateTarget | null> {
  return (await visibleTargetContext(chatId)).target;
}

async function resolveVisibleTarget(chatId: string, fallback: unknown): Promise<ResolvedWorldStateTarget | null> {
  return (await latestAssistantTarget(chatId).catch(() => null)) ?? readTarget(fallback);
}

async function getWorldState(chatId: string, target: WorldStateTarget, init?: RequestInit): Promise<WorldState | null>;
async function getWorldState(chatId: string, init?: RequestInit): Promise<WorldState | null>;
async function getWorldState(
  chatId: string,
  targetOrInit?: WorldStateTarget | RequestInit,
  maybeInit?: RequestInit,
): Promise<WorldState | null> {
  const requestedTarget = readTarget(targetOrInit);
  const init = requestedTarget ? maybeInit : (targetOrInit as RequestInit | undefined);
  throwIfAborted(init);
  const chat = await storageApi.get<{ gameState?: WorldState }>("chats", chatId);
  throwIfAborted(init);
  const visibleContext = requestedTarget ? null : await visibleTargetContext(chatId).catch(() => null);
  const target = requestedTarget ?? visibleContext?.target ?? readTarget(chat?.gameState);
  throwIfAborted(init);
  if (target) {
    const snapshot = await trackerSnapshotApi.get(chatId, target);
    throwIfAborted(init);
    if (snapshot) return snapshot;
  }
  return canUseChatGameStateFallback(chat?.gameState, target, {
    activeTargetKeys: visibleContext?.activeTargetKeys,
    hasVisibleTarget: !!visibleContext?.target,
    requestedTarget: !!requestedTarget,
  }) && chat?.gameState
    ? withTarget(chat.gameState, chatId, target)
    : null;
}

export const worldStateApi: WorldStateApi = {
  get: getWorldState,
  patch: async (chatId: string, patch: WorldStatePatch, init?: RequestInit) => {
    throwIfAborted(init);
    const requestedTarget = readTarget(patch);
    const statePatch = removePatchControlFields(patch);
    const manual = patch.manual === true;
    const clearOverrides = patch.clearOverrides === true;
    const targetVisible = patch.targetVisible !== false;
    const chat = await storageApi.get<{ gameState?: WorldState }>("chats", chatId);
    throwIfAborted(init);
    const target =
      requestedTarget ??
      (targetVisible ? await resolveVisibleTarget(chatId, chat?.gameState) : null) ??
      (manual ? { messageId: "", swipeIndex: 0 } : null);
    throwIfAborted(init);
    const existingSnapshot = target ? await trackerSnapshotApi.get(chatId, target) : null;
    throwIfAborted(init);
    const latestSnapshot =
      target && !existingSnapshot ? await trackerSnapshotApi.latest(chatId).catch(() => null) : null;
    throwIfAborted(init);
    const existing = existingSnapshot ?? latestSnapshot ?? chat?.gameState ?? createEmptyWorldState(chatId);
    const manualOverrides = updateManualOverrides(
      target ? existingSnapshot?.manualOverrides : existing.manualOverrides,
      statePatch,
      {
        manual,
        clearOverrides,
      },
    );
    const next = withTarget(
      {
        ...existing,
        chatId,
        ...statePatch,
        manualOverrides,
        ...(target && !existingSnapshot ? { id: "", committed: false, createdAt: new Date().toISOString() } : {}),
      } as unknown as WorldState,
      chatId,
      target,
    );
    const saved = target ? await trackerSnapshotApi.save(chatId, next) : null;
    throwIfAborted(init);
    await storageApi.update("chats", chatId, { gameState: saved ?? next });
    return saved ?? next;
  },
};
