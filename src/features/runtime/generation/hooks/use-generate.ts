import { useCallback, useMemo } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { retryGenerationAgents, startGeneration } from "../../../../engine/generation/start-generation";
import { backfillConversationSummaries } from "../../../../engine/modes/chat/core/summaries/auto-summary.service";
import {
  EDITABLE_CHARACTER_CARD_FIELDS,
  type AgentResult,
  type CharacterCardFieldUpdate,
  type EditableCharacterCardField,
} from "../../../../engine/contracts/types/agent";
import type { Chat, Message } from "../../../../engine/contracts/types/chat";
import type {
  CharacterStat,
  CustomTrackerField,
  GameState,
  InventoryItem,
  PlayerStats,
  PresentCharacter,
} from "../../../../engine/contracts/types/game-state";
import { chatBackgroundMetadataToUrl } from "../../../../shared/lib/backgrounds";
import { llmApi } from "../../../../shared/api/llm-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { integrationGateway } from "../../../../shared/api/integration-gateway";
import { ApiError } from "../../../../shared/api/api-errors";
import { visualAssetsApi } from "../../../../shared/api/visual-assets-api";
import { requestImagePromptReview } from "../../../../shared/components/ui/ImagePromptReviewHost";
import { useAgentStore, type PendingCardUpdate } from "../../../../shared/stores/agent.store";
import { formatAgentFailuresToast, toAgentFailure, type AgentFailure } from "../../../../shared/lib/agent-failures";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { useGameStateStore } from "../../world-state/index";
import { worldStateApi, type WorldStateTarget } from "../../world-state/index";
import {
  chatKeys,
  sanitizeTimelineMessage,
  sanitizeTimelineMessageRecord,
  timelineMessageProjection,
} from "../../../catalog/chats/index";
import { characterKeys } from "../../../catalog/characters/index";
import { personaKeys } from "../../../catalog/personas/index";
import {
  applyLorebookKeeperUpdate,
  buildPendingLorebookUpdates,
  lorebookKeys,
  lorebookKeeperReviewRequired,
} from "../../../catalog/lorebooks/index";
import {
  applyGenerationReplayToRegenerateInput,
  type GenerationReplayInput,
  type GenerationReplay,
} from "../../../../engine/generation/generation-replay";
import { findPersonaSnapshotForChat } from "../../../../engine/generation/persona-snapshot";
import { readNonNegativeInteger } from "../../../../engine/generation/runtime-records";
import {
  applyQuestUpdatesToPlayerStats,
  parseCustomTrackerField,
  parseInventoryItem,
  parseStat,
} from "../../../../engine/shared/game-state/player-stats";
import type { AgentDebugEntry } from "../../../../engine/contracts/types/agent";
import type { IntegrationGateway } from "../../../../engine/capabilities/integrations";

export type GenerateArgs = GenerationReplayInput & {
  chatId: string;
  connectionId?: string | null;
  message?: string;
  [key: string]: unknown;
};

type StreamEvent = { type: string; data?: unknown };
type QueryClient = ReturnType<typeof useQueryClient>;
type GenerationStreamFactory = (args: GenerateArgs, signal: AbortSignal) => AsyncGenerator<StreamEvent>;
type AgentResultEffectOptions = {
  skipTrackerSync?: boolean;
};
const HAPTIC_COMMAND_INTERVAL_MS = 225;
const TYPEWRITER_MAX_FRAME_MS = 120;
const STREAM_BUFFER_COMMIT_INTERVAL_MS = 45;
const AGENT_DEBUG_FLUSH_DELAY_MS = 80;
const AGENT_DEBUG_FLUSH_CHUNK_SIZE = 8;
const AGENT_DEBUG_FLUSH_CONTINUE_DELAY_MS = 16;
const scheduledChatRefreshTimers = new Map<string, number>();
const queuedAgentDebugEntries: Array<Omit<AgentDebugEntry, "timestamp"> & { timestamp?: number }> = [];
let agentDebugFlushTimer: number | null = null;

function eventCharacters(event: StreamEvent): string[] {
  const value = parseMaybeRecord(event.data).characters;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && !!entry.trim())
    : [];
}

function characterLabel(names: string[], fallback = "Character"): string {
  if (names.length === 1) return names[0]!;
  return names.length > 1 ? names.join(", ") : fallback;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error ?? "Generation failed");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function showGenerationFailureToast(message: string): void {
  toast.error(message || "Generation failed", {
    description: "Your message was kept. Fix the connection or provider issue, then retry.",
    duration: 10_000,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function toolEventName(data: unknown): string {
  return readString(parseMaybeRecord(data).name).trim();
}

function resolveUserTimeZone(): string {
  // Engine has its own live-host fallback in resolvePromptTimeZone, so this is
  // explicit-intent plumbing rather than a load-bearing source of truth.
  // Kept so non-default callers (e.g. remote runtime in future) can override
  // via the `userTimeZone` input field.
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function sortMessagesByCreatedAt(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const createdAtOrder = String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
    if (createdAtOrder !== 0) return createdAtOrder;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

function addPersonaRows(target: unknown[], rows: unknown): void {
  if (Array.isArray(rows)) {
    target.push(...rows.filter(isRecord));
  } else if (isRecord(rows)) {
    target.push(rows);
  }
}

function cachedChatForPersonaSnapshot(queryClient: QueryClient, chatId: string): unknown {
  const detail = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
  if (detail) return detail;
  const list = queryClient.getQueryData<Chat[]>(chatKeys.list());
  return Array.isArray(list) ? list.find((chat) => readString(chat.id).trim() === chatId) : null;
}

function cachedPersonaSnapshot(queryClient: QueryClient, chatId: string) {
  const chat = cachedChatForPersonaSnapshot(queryClient, chatId);
  const chatRecord = isRecord(chat) ? chat : {};
  const personaId = readString(chatRecord.personaId).trim();
  const personas: unknown[] = [];
  addPersonaRows(personas, queryClient.getQueryData(personaKeys.list));
  addPersonaRows(personas, queryClient.getQueryData(personaKeys.summaries));
  addPersonaRows(personas, queryClient.getQueryData(personaKeys.active));
  if (personaId) {
    addPersonaRows(personas, queryClient.getQueryData(personaKeys.detail(personaId)));
    addPersonaRows(personas, queryClient.getQueryData(personaKeys.summaryDetail(personaId)));
  }
  return findPersonaSnapshotForChat(personas, chat);
}

function optimisticUserMessage(queryClient: QueryClient, args: GenerateArgs): Message | null {
  if (args.impersonate === true || readString(args.regenerateMessageId).trim()) return null;
  const content = readString(args.userMessage).trim() || readString(args.message).trim();
  if (!content) return null;
  const attachments = Array.isArray(args.attachments) ? args.attachments : [];
  const personaSnapshot = cachedPersonaSnapshot(queryClient, args.chatId);
  const createdAt = new Date().toISOString();
  return {
    id: `__optimistic_${Date.now()}`,
    chatId: args.chatId,
    role: "user",
    characterId: null,
    content,
    activeSwipeIndex: 0,
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
      personaSnapshot,
      ...(attachments.length ? { attachments } : {}),
    },
    createdAt,
  };
}

async function assertChatCanGenerate(queryClient: QueryClient, chatId: string) {
  let chat = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
  if (!chat) {
    chat = (await storageApi.get("chats", chatId)) as Chat;
  }
  const chatRecord = parseMaybeRecord(chat);
  const mode = readString(chatRecord.mode || chatRecord.chatMode);
  const metadata = parseMaybeRecord(chatRecord.metadata);
  if (mode === "roleplay" && metadata.sceneStatus === "concluded") {
    throw new Error("This scene is concluded. Convert or reopen it before sending new messages.");
  }
}

function insertOptimisticUserMessage(queryClient: QueryClient, args: GenerateArgs) {
  const optimistic = optimisticUserMessage(queryClient, args);
  if (!optimistic) return;
  queryClient.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(args.chatId), (old) => {
    if (!old?.pages?.length) return old;
    const pages = [...old.pages];
    pages[0] = sortMessagesByCreatedAt([...(pages[0] ?? []), optimistic]);
    return { ...old, pages };
  });
}

function savedMessagePayload(value: unknown, chatId: string): Message | null {
  const record = parseMaybeRecord(value);
  const id = readString(record.id).trim();
  const role = readString(record.role).trim();
  const content = readString(record.content);
  const messageChatId = readString(record.chatId).trim() || chatId;
  if (!id || messageChatId !== chatId || !role) return null;
  const timelineRecord = sanitizeTimelineMessageRecord(record);
  return {
    ...(timelineRecord as unknown as Message),
    id,
    chatId: messageChatId,
    role: role as Message["role"],
    content,
    characterId: readString(timelineRecord.characterId).trim() || null,
    activeSwipeIndex:
      typeof timelineRecord.activeSwipeIndex === "number" && Number.isFinite(timelineRecord.activeSwipeIndex)
        ? timelineRecord.activeSwipeIndex
        : 0,
    createdAt: readString(timelineRecord.createdAt).trim() || new Date().toISOString(),
    extra: (timelineRecord.extra ?? {}) as Message["extra"],
  };
}

function isOptimisticMatch(message: Message, saved: Message): boolean {
  return (
    readString(message.id).startsWith("__optimistic_") &&
    message.role === saved.role &&
    readString(message.content).trim() === readString(saved.content).trim()
  );
}

function upsertCachedMessage(
  queryClient: QueryClient,
  chatId: string,
  value: unknown,
  options: { replaceMessageId?: string | null } = {},
): boolean {
  const saved = savedMessagePayload(value, chatId);
  if (!saved) return false;
  const replaceMessageId = readString(options.replaceMessageId).trim();
  queryClient.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
    if (!old?.pages?.length) return old;
    let found = false;
    const pages = old.pages.map((page) =>
      page.map((message) => {
        const shouldReplace =
          message.id === saved.id ||
          (replaceMessageId && message.id === replaceMessageId) ||
          isOptimisticMatch(message, saved);
        if (shouldReplace) {
          found = true;
          return { ...message, ...saved };
        }
        return message;
      }),
    );
    if (!found) {
      pages[0] = sortMessagesByCreatedAt([...(pages[0] ?? []), saved]);
    }
    return { ...old, pages };
  });
  return true;
}

function runDeferredGenerationWork(label: string, task: () => Promise<void> | void): Promise<void> {
  return new Promise((resolve) => {
    const run = () => {
      void Promise.resolve()
        .then(task)
        .catch((error) => console.warn(`[generation] ${label} failed`, error))
        .finally(resolve);
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      idleWindow.requestIdleCallback(run, { timeout: 1_500 });
    } else {
      window.setTimeout(run, 16);
    }
  });
}

function flushQueuedAgentDebugEntries(): void {
  agentDebugFlushTimer = null;
  if (queuedAgentDebugEntries.length === 0) return;
  const entries = queuedAgentDebugEntries.splice(0, AGENT_DEBUG_FLUSH_CHUNK_SIZE);
  useAgentStore.getState().addDebugEntries(entries);
  if (queuedAgentDebugEntries.length > 0) scheduleAgentDebugFlush(AGENT_DEBUG_FLUSH_CONTINUE_DELAY_MS);
}

function scheduleAgentDebugFlush(delayMs = AGENT_DEBUG_FLUSH_DELAY_MS): void {
  if (agentDebugFlushTimer !== null) return;
  agentDebugFlushTimer = window.setTimeout(flushQueuedAgentDebugEntries, delayMs);
}

function enqueueAgentDebugEntry(entry: Omit<AgentDebugEntry, "timestamp"> & { timestamp?: number }): void {
  queuedAgentDebugEntries.push(entry);
  scheduleAgentDebugFlush();
}

function scheduleChatQueryRefresh(queryClient: QueryClient, chatId: string): void {
  const previous = scheduledChatRefreshTimers.get(chatId);
  if (previous) window.clearTimeout(previous);
  const timer = window.setTimeout(() => {
    scheduledChatRefreshTimers.delete(chatId);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
      queryClient.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) }),
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
      queryClient.invalidateQueries({ queryKey: chatKeys.list() }),
    ]).catch((error) => console.warn("[generation] chat cache refresh failed", error));
  }, 75);
  scheduledChatRefreshTimers.set(chatId, timer);
}

function parseMaybeRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
}

function readGenerationReplay(value: unknown): GenerationReplay | null {
  const record = parseMaybeRecord(value);
  const replay = record.generationReplay;
  return isRecord(replay) ? (replay as GenerationReplay) : null;
}

const editableCharacterCardFieldSet = new Set<string>(EDITABLE_CHARACTER_CARD_FIELDS);

function parseCardFieldUpdate(raw: unknown): CharacterCardFieldUpdate | null {
  if (!isRecord(raw)) return null;
  if (raw.action !== "update") return null;
  const characterId = readString(raw.characterId).trim();
  const field = readString(raw.field);
  const oldText = readString(raw.oldText);
  const newText = readString(raw.newText);
  if (!characterId || !editableCharacterCardFieldSet.has(field) || oldText === newText) return null;
  return {
    characterId,
    action: "update",
    field: field as EditableCharacterCardField,
    oldText,
    newText,
    reason: readString(raw.reason),
  };
}

function normalizeIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return normalizeIdList(parsed);
  } catch {
    return [];
  }
}

function parseAgentResult(raw: unknown): AgentResult | null {
  if (!isRecord(raw)) return null;
  const agentType = readString(raw.agentType) || readString(raw.agentId) || "agent";
  const type = (readString(raw.type) || readString(raw.resultType) || agentType) as AgentResult["type"];
  return {
    agentId: readString(raw.agentId) || agentType,
    agentType,
    type,
    data: raw.data,
    tokensUsed: typeof raw.tokensUsed === "number" ? raw.tokensUsed : 0,
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    success: raw.success !== false,
    error: typeof raw.error === "string" ? raw.error : null,
  };
}

function characterNameFromRow(row: Record<string, unknown> | undefined, fallback = "Character"): string {
  const data = parseMaybeRecord(row?.data);
  return readString(data.name).trim() || readString(row?.name).trim() || fallback;
}

function addCharacterRowsById(target: Map<string, Record<string, unknown>>, rows: unknown): void {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const id = readString(row.id).trim();
    if (id && !target.has(id)) target.set(id, row);
  }
}

async function characterNameRowsById(queryClient: QueryClient, characterIds: string[]) {
  const rowsById = new Map<string, Record<string, unknown>>();
  addCharacterRowsById(rowsById, queryClient.getQueryData(characterKeys.list()));
  addCharacterRowsById(rowsById, queryClient.getQueryData(characterKeys.summaries()));

  const missingIds = characterIds.filter((id) => !rowsById.has(id));
  if (missingIds.length === 0) return rowsById;

  const fetchedRows = await Promise.all(
    missingIds.map((id) =>
      storageApi
        .get<Record<string, unknown>>("characters", id, {
          fields: ["id", "data"],
          fieldSelections: { data: ["name"] },
        })
        .catch((error) => {
          console.warn("[generation] character name lookup failed", error);
          return null;
        }),
    ),
  );
  addCharacterRowsById(rowsById, fetchedRows);
  return rowsById;
}

async function buildPendingCardUpdates(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string,
  agentName: string,
  rawData: unknown,
): Promise<PendingCardUpdate[]> {
  const data = parseMaybeRecord(rawData);
  const rawUpdates = Array.isArray(data.updates) ? data.updates : [];
  const updates = rawUpdates.map(parseCardFieldUpdate).filter((update): update is CharacterCardFieldUpdate => !!update);
  if (updates.length === 0) return [];

  let chat = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
  if (!chat) {
    try {
      chat = (await storageApi.get("chats", chatId)) as Chat;
    } catch {
      return [];
    }
  }

  const chatCharacterIds = normalizeIdList((chat as unknown as Record<string, unknown>).characterIds);
  if (chatCharacterIds.length === 0) return [];
  const chatCharacterIdSet = new Set(chatCharacterIds);

  const groupedUpdates = new Map<string, CharacterCardFieldUpdate[]>();
  for (const update of updates) {
    if (!chatCharacterIdSet.has(update.characterId)) continue;
    groupedUpdates.set(update.characterId, [...(groupedUpdates.get(update.characterId) ?? []), update]);
  }
  if (groupedUpdates.size === 0) return [];

  const charactersById = await characterNameRowsById(queryClient, chatCharacterIds);
  const timestamp = Date.now();
  return chatCharacterIds.flatMap((characterId, index) => {
    const grouped = groupedUpdates.get(characterId);
    if (!grouped?.length) return [];
    const row = charactersById.get(characterId);
    return [
      {
        id: `card-update-${characterId}-${timestamp}-${index}`,
        characterId,
        characterName: characterNameFromRow(row),
        updates: grouped,
        agentName,
        timestamp: timestamp + index,
      },
    ];
  });
}

function formatAgentBubble(result: AgentResult, agentName: string): string | null {
  const data = parseMaybeRecord(result.data);
  if (!Object.keys(data).length) return null;

  switch (result.agentType) {
    case "continuity": {
      const issues = Array.isArray(data.issues) ? data.issues : [];
      return (
        issues
          .map((issue) => parseMaybeRecord(issue).description)
          .filter(
            (description): description is string => typeof description === "string" && description.trim().length > 0,
          )
          .join("\n") || null
      );
    }
    case "prompt-reviewer": {
      const issues = Array.isArray(data.issues) ? data.issues : [];
      if (issues.length === 0) return readString(data.summary, "Prompt looks good");
      return (
        issues
          .map((issue) => parseMaybeRecord(issue).description)
          .filter(
            (description): description is string => typeof description === "string" && description.trim().length > 0,
          )
          .join("\n") || null
      );
    }
    case "director":
    case "prose-guardian":
    case "chat-summary":
    case "secret-plot-driver":
      return (
        readString(data.text).trim() || (result.agentType === "secret-plot-driver" ? "Secret plotline active." : null)
      );
    case "quest": {
      const updates = Array.isArray(data.updates) ? data.updates : [];
      return (
        updates
          .map((update) => readString(parseMaybeRecord(update).questName).trim())
          .filter(Boolean)
          .join("\n") || null
      );
    }
    case "expression": {
      const expressions = Array.isArray(data.expressions) ? data.expressions : [];
      return (
        expressions
          .map((entry) => {
            const record = parseMaybeRecord(entry);
            const name = readString(record.characterName).trim();
            const expression = readString(record.expression).trim();
            return name && expression ? `${name}: ${expression}` : "";
          })
          .filter(Boolean)
          .join("\n") || null
      );
    }
    case "world-state": {
      const parts = [data.location, data.time, data.weather].map((part) => readString(part).trim()).filter(Boolean);
      return parts.length ? parts.join(" - ") : null;
    }
    case "character-tracker": {
      const present = Array.isArray(data.presentCharacters) ? data.presentCharacters : [];
      return (
        present
          .map((entry) => readString(parseMaybeRecord(entry).name).trim())
          .filter(Boolean)
          .join(", ") || null
      );
    }
    case "background": {
      const chosen = readString(data.chosen).trim();
      return chosen ? `Background: ${chosen}` : null;
    }
    case "echo-chamber": {
      const reactions = Array.isArray(data.reactions) ? data.reactions : [];
      return (
        reactions
          .map((entry) => {
            const record = parseMaybeRecord(entry);
            const name = readString(record.characterName).trim();
            const reaction = readString(record.reaction).trim();
            return name && reaction ? `${name}: ${reaction}` : "";
          })
          .filter(Boolean)
          .join("\n") || null
      );
    }
    case "spotify": {
      const action = readString(data.action);
      if (action === "none") return readString(data.mood, "Keeping current track");
      if (action === "volume") return `Volume: ${data.volume ?? ""}`.trim();
      const trackNames = Array.isArray(data.trackNames)
        ? data.trackNames.map((track) => readString(track).trim()).filter(Boolean)
        : [readString(data.trackName).trim()].filter(Boolean);
      return trackNames.length ? trackNames.join("\n") : readString(data.mood).trim() || null;
    }
    case "persona-stats": {
      const status = readString(data.status).trim();
      const stats = Array.isArray(data.stats) ? data.stats : [];
      const statLines = stats
        .map((entry) => {
          const record = parseMaybeRecord(entry);
          const name = readString(record.name).trim();
          return name ? `${name}: ${record.value ?? ""}/${record.max ?? 100}` : "";
        })
        .filter(Boolean);
      return [status, ...statLines].filter(Boolean).join(" - ") || null;
    }
    case "illustrator":
      return data.shouldGenerate === true ? readString(data.reason, "Generating scene illustration") : null;
    case "lorebook-keeper": {
      const updates = Array.isArray(data.updates) ? data.updates : [];
      return (
        updates
          .map((entry) => readString(parseMaybeRecord(entry).entryName).trim())
          .filter(Boolean)
          .join("\n") || null
      );
    }
    case "editor": {
      const changes = Array.isArray(data.changes) ? data.changes : [];
      if (changes.length === 0) return "No edits needed";
      return (
        changes
          .map((entry) => readString(parseMaybeRecord(entry).description).trim())
          .filter(Boolean)
          .join("\n") || null
      );
    }
    case "html":
      return readString(data.text, "HTML formatting active");
    default:
      return agentName ? null : null;
  }
}

async function applyBackgroundChoice(chatId: string, chosen: unknown) {
  const metadataValue = readString(chosen).trim();
  const url = chatBackgroundMetadataToUrl(chosen);
  if (url) useUIStore.getState().setChatBackground(url);
  if (metadataValue) {
    await storageApi.patchChatMetadata(chatId, { background: metadataValue }).catch((error) => {
      console.warn("Failed to persist background agent choice", error);
    });
  }
}

function applyQuestUpdates(rawData: unknown) {
  const current = useGameStateStore.getState().current;
  const { playerStats, changed } = applyQuestUpdatesToPlayerStats(
    current?.playerStats,
    parseMaybeRecord(rawData).updates,
  );
  if (!changed) return;

  useGameStateStore.getState().setGameState({
    ...(current ?? ({} as never)),
    playerStats,
  } as never);
}

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
    createdAt: "",
  };
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text.length ? text : null;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function trackerTargetFromMessagePayload(value: unknown): WorldStateTarget | null {
  const record = parseMaybeRecord(value);
  const messageId = readString(record.id).trim();
  if (!messageId) return null;
  const fallbackSwipeIndex = Math.max(0, readNonNegativeInteger(record.swipeCount, 1) - 1);
  return {
    messageId,
    swipeIndex: readNonNegativeInteger(record.activeSwipeIndex, fallbackSwipeIndex),
  };
}

function retryRefreshTargetFromCache(
  queryClient: QueryClient,
  chatId: string,
  options?: Record<string, unknown>,
): WorldStateTarget | null {
  if (options?.lorebookKeeperBackfill === true) return null;
  const cached = queryClient.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
  const messages = cached?.pages.flat() ?? [];
  if (messages.length === 0) return null;
  const requestedId = readString(options?.forMessageId).trim();
  const target = requestedId
    ? messages.find((message) => readString(message.id).trim() === requestedId)
    : [...messages].reverse().find((message) => readString(message.role).trim() === "assistant");
  return target ? trackerTargetFromMessagePayload(target) : null;
}

async function refreshGameStateFromStorage(chatId: string, target?: WorldStateTarget | null) {
  try {
    const state = target ? await worldStateApi.get(chatId, target) : await worldStateApi.get(chatId);
    if (useChatStore.getState().activeChatId === chatId) {
      useGameStateStore.getState().setGameState(state ?? null);
    }
  } catch (error) {
    console.warn("Failed to refresh tracker game state", error);
  }
}

function parsePresentCharacter(value: unknown): PresentCharacter | null {
  const record = parseMaybeRecord(value);
  const name = readString(record.name).trim();
  const characterId = readString(record.characterId).trim() || name;
  if (!name || !characterId) return null;
  const customFields = isRecord(record.customFields)
    ? Object.fromEntries(
        Object.entries(record.customFields)
          .map(([key, fieldValue]) => [key, readString(fieldValue).trim()])
          .filter(([key]) => key.length > 0),
      )
    : {};
  return {
    characterId,
    name,
    emoji: readString(record.emoji).trim() || "*",
    mood: readString(record.mood).trim() || "neutral",
    appearance: readNullableString(record.appearance),
    outfit: readNullableString(record.outfit),
    avatarPath: readNullableString(record.avatarPath),
    customFields,
    stats: Array.isArray(record.stats)
      ? record.stats.map(parseStat).filter((stat): stat is CharacterStat => !!stat)
      : [],
    thoughts: readNullableString(record.thoughts),
  };
}

function gameStatePatchFromAgentResult(result: AgentResult, chatId: string): Record<string, unknown> | null {
  const data = parseMaybeRecord(result.data);
  if (!Object.keys(data).length) return null;

  if (result.agentType === "world-state" || result.type === "game_state_update") {
    const patch: Record<string, unknown> = {};
    for (const field of ["date", "time", "location", "weather", "temperature"] as const) {
      if (Object.prototype.hasOwnProperty.call(data, field)) patch[field] = readNullableString(data[field]);
    }
    return Object.keys(patch).length ? patch : null;
  }

  if (result.agentType === "character-tracker" || result.type === "character_tracker_update") {
    const presentCharacters = Array.isArray(data.presentCharacters)
      ? data.presentCharacters
          .map(parsePresentCharacter)
          .filter((character): character is PresentCharacter => !!character)
      : [];
    return { presentCharacters };
  }

  if (result.agentType === "persona-stats" || result.type === "persona_stats_update") {
    const current = useGameStateStore.getState().current;
    const existingPlayerStats = current?.chatId === chatId ? current.playerStats : null;
    const playerStats: PlayerStats = { ...(existingPlayerStats ?? createEmptyPlayerStats()) };
    if (Object.prototype.hasOwnProperty.call(data, "status")) playerStats.status = readString(data.status).trim();
    if (Array.isArray(data.inventory)) {
      playerStats.inventory = data.inventory.map(parseInventoryItem).filter((item): item is InventoryItem => !!item);
    }
    const patch: Record<string, unknown> = { playerStats };
    if (Array.isArray(data.stats)) {
      patch.personaStats = data.stats.map(parseStat).filter((stat): stat is CharacterStat => !!stat);
    }
    return patch;
  }

  if (result.agentType === "custom-tracker" || result.type === "custom_tracker_update") {
    const current = useGameStateStore.getState().current;
    const existingPlayerStats = current?.chatId === chatId ? current.playerStats : null;
    const playerStats: PlayerStats = { ...(existingPlayerStats ?? createEmptyPlayerStats()) };
    if (Array.isArray(data.fields)) {
      playerStats.customTrackerFields = data.fields
        .map(parseCustomTrackerField)
        .filter((field): field is CustomTrackerField => !!field);
      return { playerStats };
    }
  }

  return null;
}

async function applyTrackerResultToGameState(chatId: string, result: AgentResult) {
  const patch = gameStatePatchFromAgentResult(result, chatId);
  if (!patch) return;

  const store = useGameStateStore.getState();
  const previous = store.current?.chatId === chatId ? store.current : createEmptyGameState(chatId);
  store.setGameState({ ...previous, ...patch } as GameState);

  try {
    const saved = await worldStateApi.patch(chatId, { ...patch, targetVisible: false });
    if (useGameStateStore.getState().current?.chatId === chatId) {
      useGameStateStore.getState().setGameState(saved);
    }
  } catch (error) {
    console.warn("Failed to sync tracker result to game state", error);
  }
}

function applyAssistantAction(rawData: unknown) {
  const data = parseMaybeRecord(rawData);
  const action = readString(data.action);
  if (action === "navigate") {
    const panel = readString(data.panel).trim();
    if (panel) {
      useUIStore.getState().openRightPanel(panel as never);
      const tab = readString(data.tab).trim();
      if (panel === "settings" && tab) useUIStore.getState().setSettingsTab(tab);
      toast(`Opening ${panel}.`);
    }
    return;
  }
  if (action === "data_fetched") {
    const label = readString(data.label).trim();
    toast(label ? `Fetched ${label}.` : "Fetched requested data.");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function applyHapticAgentResult(rawData: unknown) {
  const data = parseMaybeRecord(rawData);
  const rawCommands = Array.isArray(data.commands) ? data.commands : [];
  for (const rawCommand of rawCommands) {
    if (!isRecord(rawCommand)) continue;
    const action = readString(rawCommand.action).trim();
    if (!action) continue;
    try {
      await integrationGateway.haptic.command({
        deviceIndex:
          rawCommand.deviceIndex === "all" || typeof rawCommand.deviceIndex === "number"
            ? rawCommand.deviceIndex
            : "all",
        action,
        ...(typeof rawCommand.intensity === "number" ? { intensity: rawCommand.intensity } : {}),
        ...(typeof rawCommand.duration === "number" ? { duration: rawCommand.duration } : {}),
      });
      await delay(HAPTIC_COMMAND_INTERVAL_MS);
    } catch (error) {
      console.warn("Failed to send haptic agent command", error);
    }
  }
}

async function applyAgentResultEffects(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string,
  rawResult: unknown,
  options: AgentResultEffectOptions = {},
) {
  const result = parseAgentResult(rawResult);
  if (!result) return;
  const agentName =
    readString((rawResult as Record<string, unknown>).agentName).trim() ||
    readString((rawResult as Record<string, unknown>).name).trim() ||
    result.agentType;
  const agentStore = useAgentStore.getState();
  agentStore.addResult(result.agentId || result.agentType, result);

  if (!result.success) {
    agentStore.addFailedAgentFailure(toAgentFailure({ agentType: result.agentType, agentName, error: result.error }));
    return;
  }
  const bubble = formatAgentBubble(result, agentName);
  if (bubble) agentStore.addThoughtBubble(result.agentType, agentName, bubble);

  const data = parseMaybeRecord(result.data);
  if (result.agentType === "echo-chamber") {
    const reactions = Array.isArray(data.reactions) ? data.reactions : [];
    for (const reaction of reactions) {
      const record = parseMaybeRecord(reaction);
      const characterName = readString(record.characterName).trim();
      const text = readString(record.reaction).trim();
      if (characterName && text) agentStore.addEchoMessage(characterName, text);
    }
  }

  if (result.agentType === "cyoa" || result.type === "cyoa_choices") {
    const rawChoices = Array.isArray(data.choices) ? data.choices : [];
    const choices = rawChoices
      .map((choice) => {
        const record = parseMaybeRecord(choice);
        const label = readString(record.label).trim();
        const text = readString(record.text).trim();
        return label && text ? { label, text } : null;
      })
      .filter((choice): choice is { label: string; text: string } => !!choice);
    if (choices.length) agentStore.setCyoaChoices(choices, chatId);
  }

  if (result.type === "character_card_update") {
    const pending = await buildPendingCardUpdates(queryClient, chatId, agentName, result.data);
    for (const entry of pending) agentStore.enqueuePendingCardUpdate(entry);
    if (pending.length) useUIStore.getState().openModal("character-card-update");
  }

  if (result.type === "lorebook_update" || result.agentType === "lorebook-keeper") {
    const pending = await buildPendingLorebookUpdates(queryClient, chatId, agentName, result.data);
    if (pending.length) {
      const chat =
        queryClient.getQueryData<Chat>(chatKeys.detail(chatId)) ??
        ((await storageApi.get<Chat>("chats", chatId).catch(() => null)) as Chat | null);
      if (lorebookKeeperReviewRequired(chat)) {
        for (const entry of pending) agentStore.enqueuePendingLorebookUpdate(entry);
        useUIStore.getState().openModal("lorebook-keeper-review");
      } else {
        let applied = 0;
        for (const entry of pending) {
          await applyLorebookKeeperUpdate(entry);
          applied += 1;
          await queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(entry.lorebookId) });
        }
        await queryClient.invalidateQueries({ queryKey: lorebookKeys.active() });
        if (applied > 0) toast.success(`Lorebook Keeper applied ${applied} ${applied === 1 ? "update" : "updates"}.`);
      }
    }
  }

  if (result.type === "haptic_command" || result.agentType === "haptic") await applyHapticAgentResult(result.data);
  if (result.type === "background_change" || result.agentType === "background") {
    await applyBackgroundChoice(chatId, data.chosen);
  }
  if (result.agentType === "quest") applyQuestUpdates(result.data);
  if (!options.skipTrackerSync) await applyTrackerResultToGameState(chatId, result);
}

export async function runGenerationWithUi(
  queryClient: QueryClient,
  args: GenerateArgs,
  streamFactory: GenerationStreamFactory,
  options: { beforeStart?: (args: GenerateArgs, signal: AbortSignal) => Promise<void> } = {},
): Promise<boolean> {
  const chatId = args.chatId;
  const regenerateMessageId = readString(args.regenerateMessageId).trim() || null;
  await assertChatCanGenerate(queryClient, chatId);
  const chatStore = useChatStore.getState();
  if (chatStore.abortControllers.has(chatId)) {
    console.warn("[generation] Generation already in progress for chat", chatId);
    return false;
  }

  const controller = new AbortController();
  chatStore.setAbortController(chatId, controller);
  chatStore.setStreaming(true, chatId);
  chatStore.setRegenerateMessageId(regenerateMessageId);
  chatStore.setGenerationPhase("Starting generation...");
  chatStore.setStreamBuffer("", chatId);
  chatStore.setThinkingBuffer("", chatId);
  useAgentStore.getState().clearFailedAgentTypes();
  useAgentStore.getState().setProcessing(true);

  let received = "";
  let receivedAnyContent = false;
  let receivedTurnContent = false;
  let receivedThinking = false;
  let visibleStreamText = "";
  let committedStreamText = "";
  let lastStreamBufferCommitAt = 0;
  let thinkingText = "";
  let committedThinkingText = "";
  let lastThinkingBufferCommitAt: number | null = null;
  let pendingReveal = "";
  let typewriterFrame: number | null = null;
  let typewriterActive = false;
  let lastTypewriterPaintAt = 0;
  let typewriterRemainder = 0;
  const revealWaiters = new Set<() => void>();
  const pendingAgentResultEffects: unknown[] = [];
  let agentResultEffectsDrainScheduled = false;

  const cancelTypewriterFrame = () => {
    if (typewriterFrame === null) return;
    window.cancelAnimationFrame(typewriterFrame);
    typewriterFrame = null;
  };

  const resolveRevealWaiters = () => {
    if (pendingReveal.length > 0 || typewriterActive) return;
    for (const resolve of revealWaiters) resolve();
    revealWaiters.clear();
  };

  const resolveAllRevealWaiters = () => {
    for (const resolve of revealWaiters) resolve();
    revealWaiters.clear();
  };

  const commitVisibleStreamBuffer = (force = false, now = performance.now()) => {
    if (visibleStreamText === committedStreamText) return;
    if (!force && lastStreamBufferCommitAt > 0 && now - lastStreamBufferCommitAt < STREAM_BUFFER_COMMIT_INTERVAL_MS) {
      return;
    }
    committedStreamText = visibleStreamText;
    lastStreamBufferCommitAt = now;
    useChatStore.getState().setStreamBuffer(visibleStreamText, chatId);
  };

  const appendVisibleStreamText = (text: string) => {
    if (!text) return;
    visibleStreamText += text;
    commitVisibleStreamBuffer();
    useChatStore.getState().setMariPhase(chatId, "thinking");
  };

  const commitThinkingBuffer = (force = false, now = performance.now()) => {
    if (thinkingText === committedThinkingText) return;
    if (
      !force &&
      lastThinkingBufferCommitAt !== null &&
      now - lastThinkingBufferCommitAt < STREAM_BUFFER_COMMIT_INTERVAL_MS
    ) {
      return;
    }
    committedThinkingText = thinkingText;
    lastThinkingBufferCommitAt = now;
    useChatStore.getState().setThinkingBuffer(thinkingText, chatId);
  };

  const appendThinkingText = (text: string) => {
    if (!text) return;
    thinkingText += text;
    commitThinkingBuffer();
  };

  const typewriterCharsPerSecond = () => {
    const speed = useUIStore.getState().streamingSpeed;
    if (speed >= 100) return Infinity;
    const normalized = Math.max(0, Math.min(1, (speed - 1) / 98));
    return 12 + Math.pow(normalized, 1.65) * 248;
  };

  const revealNextStreamSlice = (now = performance.now()) => {
    typewriterFrame = null;
    if (pendingReveal.length === 0) {
      typewriterActive = false;
      lastTypewriterPaintAt = 0;
      typewriterRemainder = 0;
      resolveRevealWaiters();
      return;
    }

    if (!lastTypewriterPaintAt) lastTypewriterPaintAt = now;
    const elapsedMs = Math.min(TYPEWRITER_MAX_FRAME_MS, Math.max(0, now - lastTypewriterPaintAt));
    lastTypewriterPaintAt = now;

    const charsPerSecond = typewriterCharsPerSecond();
    const size =
      charsPerSecond === Infinity
        ? pendingReveal.length
        : (() => {
            typewriterRemainder += (charsPerSecond * elapsedMs) / 1000;
            const count = Math.min(Math.floor(typewriterRemainder), pendingReveal.length);
            if (count < 1) return 0;
            typewriterRemainder -= count;
            return count;
          })();

    if (size < 1) {
      typewriterFrame = window.requestAnimationFrame(revealNextStreamSlice);
      return;
    }

    const next = pendingReveal.slice(0, size);
    pendingReveal = pendingReveal.slice(size);
    appendVisibleStreamText(next);
    if (pendingReveal.length > 0) {
      typewriterFrame = window.requestAnimationFrame(revealNextStreamSlice);
      return;
    }
    typewriterActive = false;
    lastTypewriterPaintAt = 0;
    typewriterRemainder = 0;
    commitVisibleStreamBuffer(true, now);
    resolveRevealWaiters();
  };

  const scheduleStreamReveal = () => {
    if (typewriterActive || pendingReveal.length === 0) return;
    typewriterActive = true;
    typewriterFrame = window.requestAnimationFrame(revealNextStreamSlice);
  };

  const enqueueVisibleStreamText = (text: string) => {
    if (!text || !useUIStore.getState().enableStreaming) return;
    pendingReveal += text;
    scheduleStreamReveal();
  };

  const flushVisibleStreamText = async () => {
    if (controller.signal.aborted) {
      cancelTypewriterFrame();
      pendingReveal = "";
      typewriterActive = false;
      resolveAllRevealWaiters();
      return;
    }
    if (!useUIStore.getState().enableStreaming) {
      cancelTypewriterFrame();
      pendingReveal = "";
      typewriterActive = false;
      visibleStreamText = received;
      commitVisibleStreamBuffer(true);
      if (visibleStreamText) useChatStore.getState().setMariPhase(chatId, "thinking");
      resolveAllRevealWaiters();
      return;
    }
    if (pendingReveal.length === 0 && !typewriterActive) return;
    await new Promise<void>((resolve) => {
      revealWaiters.add(resolve);
      scheduleStreamReveal();
    });
  };

  const flushLiveGenerationBuffers = async () => {
    commitThinkingBuffer(true);
    await flushVisibleStreamText();
  };

  const resetLiveGenerationBuffers = () => {
    cancelTypewriterFrame();
    received = "";
    receivedTurnContent = false;
    receivedThinking = false;
    visibleStreamText = "";
    committedStreamText = "";
    lastStreamBufferCommitAt = 0;
    thinkingText = "";
    committedThinkingText = "";
    lastThinkingBufferCommitAt = null;
    pendingReveal = "";
    typewriterActive = false;
    lastTypewriterPaintAt = 0;
    typewriterRemainder = 0;
    resolveAllRevealWaiters();
    useChatStore.getState().setStreamBuffer("", chatId);
    useChatStore.getState().setThinkingBuffer("", chatId);
  };

  const ownsChatController = () => useChatStore.getState().abortControllers.get(chatId) === controller;

  const clearChatAvailabilityState = () => {
    const state = useChatStore.getState();
    state.setPerChatTyping(chatId, null);
    state.setPerChatDelayed(chatId, null);
    if (state.activeChatId === chatId) {
      state.setTypingCharacterName(null);
      state.setDelayedCharacterInfo(null);
    }
  };

  const queueAgentResultEffect = (rawResult: unknown) => {
    pendingAgentResultEffects.push(rawResult);
  };

  const drainAgentResultEffects = () => {
    if (pendingAgentResultEffects.length === 0 || agentResultEffectsDrainScheduled) return;
    agentResultEffectsDrainScheduled = true;
    runDeferredGenerationWork("agent result effect", async () => {
      agentResultEffectsDrainScheduled = false;
      if (controller.signal.aborted) {
        pendingAgentResultEffects.length = 0;
        return;
      }
      const rawResult = pendingAgentResultEffects.shift();
      if (rawResult !== undefined) {
        await applyAgentResultEffects(queryClient, chatId, rawResult, { skipTrackerSync: true });
      }
      if (pendingAgentResultEffects.length > 0) drainAgentResultEffects();
    });
  };

  let foregroundGenerationReleased = false;
  let groupTurnActive = false;

  const releaseForegroundGenerationUi = () => {
    if (foregroundGenerationReleased) return;
    const state = useChatStore.getState();
    if (!ownsChatController()) return;
    foregroundGenerationReleased = true;
    state.setAbortController(chatId, null);
    state.setMariPhase(chatId, "idle");
    clearChatAvailabilityState();
    if (state.streamingChatId === chatId) {
      state.setStreaming(false, chatId);
      state.setRegenerateMessageId(null);
      state.setGenerationPhase(null);
      state.setStreamingCharacterId(null);
    }
    if (useChatStore.getState().abortControllers.size === 0) {
      useAgentStore.getState().setProcessing(false);
    }
  };

  const stopGenerationUi = () => {
    cancelTypewriterFrame();
    pendingReveal = "";
    typewriterActive = false;
    commitThinkingBuffer(true);
    resolveAllRevealWaiters();
    releaseForegroundGenerationUi();
  };

  controller.signal.addEventListener("abort", stopGenerationUi, { once: true });

  try {
    insertOptimisticUserMessage(queryClient, args);
    await options.beforeStart?.(args, controller.signal);
    if (controller.signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    for await (const event of streamFactory(args, controller.signal)) {
      if (!foregroundGenerationReleased && !ownsChatController()) break;
      switch (event.type) {
        case "phase":
          if (!foregroundGenerationReleased && typeof event.data === "string") {
            useChatStore.getState().setGenerationPhase(event.data);
          }
          break;
        case "thinking":
          if (!foregroundGenerationReleased && typeof event.data === "string") {
            if (!receivedThinking) {
              receivedThinking = true;
              clearChatAvailabilityState();
              const state = useChatStore.getState();
              if (state.activeChatId === chatId) state.setGenerationPhase("Thinking...");
              state.setMariPhase(chatId, "thinking");
            }
            appendThinkingText(event.data);
          }
          break;
        case "token":
        case "delta":
          if (!foregroundGenerationReleased && typeof event.data === "string") {
            const firstVisibleToken = !receivedTurnContent;
            receivedTurnContent = true;
            receivedAnyContent = true;
            if (firstVisibleToken) {
              clearChatAvailabilityState();
            }
            received += event.data;
            enqueueVisibleStreamText(event.data);
          }
          break;
        case "message":
        case "user_message":
          if (event.data && typeof event.data === "object") {
            if (event.type === "user_message") await flushLiveGenerationBuffers();
            upsertCachedMessage(queryClient, chatId, event.data);
            scheduleChatQueryRefresh(queryClient, chatId);
            if (event.type !== "user_message") releaseForegroundGenerationUi();
            drainAgentResultEffects();
          }
          break;
        case "assistant_message":
          if (event.data && typeof event.data === "object") {
            await flushLiveGenerationBuffers();
            upsertCachedMessage(queryClient, chatId, event.data, { replaceMessageId: regenerateMessageId });
            scheduleChatQueryRefresh(queryClient, chatId);
            const trackerTarget = trackerTargetFromMessagePayload(event.data);
            runDeferredGenerationWork("game state refresh", () => refreshGameStateFromStorage(chatId, trackerTarget));
            if (groupTurnActive) {
              resetLiveGenerationBuffers();
            } else {
              releaseForegroundGenerationUi();
            }
            drainAgentResultEffects();
          }
          break;
        case "group_turn": {
          groupTurnActive = true;
          await flushLiveGenerationBuffers();
          resetLiveGenerationBuffers();
          const data = parseMaybeRecord(event.data);
          const characterId = readString(data.characterId).trim();
          const characterName = readString(data.characterName).trim();
          if (useChatStore.getState().activeChatId === chatId) {
            useChatStore.getState().setStreamingCharacterId(characterId || null);
          }
          if (characterName) {
            const state = useChatStore.getState();
            state.setPerChatTyping(chatId, characterName);
            if (state.activeChatId === chatId) state.setTypingCharacterName(characterName);
          }
          break;
        }
        case "typing": {
          const label = characterLabel(eventCharacters(event));
          const state = useChatStore.getState();
          state.setPerChatTyping(chatId, label);
          state.setPerChatDelayed(chatId, null);
          if (state.activeChatId === chatId) {
            state.setDelayedCharacterInfo(null);
            state.setTypingCharacterName(label);
          }
          break;
        }
        case "delayed": {
          const label = characterLabel(eventCharacters(event));
          const status = readString(parseMaybeRecord(event.data).status, "idle");
          const info = { name: label, status };
          const state = useChatStore.getState();
          state.setPerChatDelayed(chatId, info);
          if (state.activeChatId === chatId) state.setDelayedCharacterInfo(info);
          runDeferredGenerationWork("character status refresh", () =>
            queryClient.invalidateQueries({ queryKey: characterKeys.list() }),
          );
          break;
        }
        case "offline": {
          const label = characterLabel(eventCharacters(event), "Characters");
          const verb = label === "Characters" || label.includes(",") ? "are" : "is";
          toast(`${label} ${verb} offline. They'll respond when they're back online.`);
          clearChatAvailabilityState();
          break;
        }
        case "agent_result":
          queueAgentResultEffect(event.data);
          break;
        case "tool_call": {
          const name = toolEventName(event.data);
          useChatStore.getState().setGenerationPhase(name ? `Running tool: ${name}...` : "Running tool...");
          break;
        }
        case "tool_result": {
          const data = parseMaybeRecord(event.data);
          const name = toolEventName(data);
          const success = data.success !== false;
          useChatStore
            .getState()
            .setGenerationPhase(
              name ? `Tool ${success ? "finished" : "failed"}: ${name}.` : `Tool ${success ? "finished" : "failed"}.`,
            );
          break;
        }
        case "agent_injection_review": {
          const data = parseMaybeRecord(event.data);
          const reviewChatId = readString(data.chatId).trim();
          const injections = Array.isArray(data.injections) ? data.injections : [];
          if (reviewChatId && injections.length > 0) {
            window.dispatchEvent(
              new CustomEvent("marinara:agent-injection-review", {
                detail: { chatId: reviewChatId, injections },
              }),
            );
          }
          break;
        }
        case "cross_post": {
          const data = parseMaybeRecord(event.data);
          const target = readString(data.targetChatName).trim();
          toast(target ? `Message moved to ${target}.` : "Message moved to another chat.");
          scheduleChatQueryRefresh(queryClient, chatId);
          break;
        }
        case "assistant_action":
          applyAssistantAction(event.data);
          scheduleChatQueryRefresh(queryClient, chatId);
          break;
        case "ooc_posted": {
          const data = parseMaybeRecord(event.data);
          const count = typeof data.count === "number" ? data.count : 1;
          const targetChatId = readString(data.chatId).trim();
          const target = readString(data.chatName).trim();
          toast(`${count} message${count === 1 ? "" : "s"} posted${target ? ` to ${target}` : ""}.`);
          scheduleChatQueryRefresh(queryClient, chatId);
          if (targetChatId && targetChatId !== chatId) scheduleChatQueryRefresh(queryClient, targetChatId);
          break;
        }
        case "selfie": {
          toast("Selfie generated.");
          scheduleChatQueryRefresh(queryClient, chatId);
          runDeferredGenerationWork("gallery refresh", () =>
            queryClient.invalidateQueries({ queryKey: ["gallery", "images", chatId] }),
          );
          break;
        }
        case "selfie_error": {
          const data = parseMaybeRecord(event.data);
          toast.error(readString(data.error, "Selfie generation failed."));
          break;
        }
        case "command_error": {
          const data = parseMaybeRecord(event.data);
          const command = readString(data.command).trim();
          toast.error(readString(data.error, command ? `Command "${command}" failed.` : "Command failed."));
          break;
        }
        case "illustration": {
          toast("Illustration generated.");
          scheduleChatQueryRefresh(queryClient, chatId);
          runDeferredGenerationWork("gallery refresh", () =>
            queryClient.invalidateQueries({ queryKey: ["gallery", "images", chatId] }),
          );
          break;
        }
        case "illustration_error": {
          const data = parseMaybeRecord(event.data);
          toast.error(readString(data.error, "Illustration generation failed."));
          break;
        }
        case "scene_created": {
          const data = parseMaybeRecord(event.data);
          const sceneChatId = readString(data.chatId).trim();
          if (sceneChatId) useChatStore.getState().setActiveChatId(sceneChatId);
          toast("Scene created.");
          scheduleChatQueryRefresh(queryClient, sceneChatId || chatId);
          break;
        }
        case "done":
          await flushLiveGenerationBuffers();
          break;
      }
    }
    await flushLiveGenerationBuffers();
    scheduleChatQueryRefresh(queryClient, chatId);
    return receivedAnyContent;
  } catch (error) {
    if (!isAbortError(error)) {
      const message = errorMessage(error);
      showGenerationFailureToast(message);
    }
    throw error;
  } finally {
    controller.signal.removeEventListener("abort", stopGenerationUi);
    const wasAborted = controller.signal.aborted;
    stopGenerationUi();
    scheduleChatQueryRefresh(queryClient, chatId);
    if (wasAborted) {
      pendingAgentResultEffects.length = 0;
    } else {
      drainAgentResultEffects();
    }
  }
}

export function useGenerate() {
  const queryClient = useQueryClient();
  const reviewedIntegrationGateway = useMemo<IntegrationGateway>(
    () => ({
      ...integrationGateway,
      image: {
        generate: async <T = unknown>(input: Record<string, unknown>) => {
          const kind = readString(input.kind).trim();
          const reviewKind = kind === "selfie" || kind === "illustration" ? kind : null;
          if (!reviewKind || !useUIStore.getState().reviewImagePromptsBeforeSend) {
            return integrationGateway.image.generate<T>(input);
          }

          const prompt = readString(input.prompt).trim();
          if (!prompt) return integrationGateway.image.generate<T>(input);

          const id = readString(input.reviewId).trim() || `${reviewKind}-${Date.now()}`;
          const overrides = await requestImagePromptReview([
            {
              id,
              kind: reviewKind,
              title:
                readString(input.reviewTitle).trim() ||
                (reviewKind === "illustration" ? "Scene illustration" : "Conversation selfie"),
              prompt,
              negativePrompt: readString(input.negativePrompt).trim(),
              width: readPositiveNumber(input.width, 512),
              height: readPositiveNumber(input.height, 768),
            },
          ]);
          if (!overrides) {
            throw new Error(
              reviewKind === "illustration" ? "Illustration generation cancelled." : "Selfie generation cancelled.",
            );
          }

          const override = overrides.find((item) => item.id === id) ?? overrides[0];
          return integrationGateway.image.generate<T>({
            ...input,
            prompt: override?.prompt ?? prompt,
            negativePrompt: override?.negativePrompt ?? input.negativePrompt,
          });
        },
      },
    }),
    [],
  );

  const generate = useCallback(
    async (args: GenerateArgs): Promise<boolean> => {
      const adjustedArgs = await (async () => {
        const regenerateMessageId = readString(args.regenerateMessageId).trim();
        const chatId = readString(args.chatId).trim();
        if (!regenerateMessageId || !chatId) return args;

        const cachedMessages = queryClient.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
        const cachedMessage = cachedMessages?.pages
          .flat()
          .find((message) => readString(message.id) === regenerateMessageId);
        const storedMessage =
          cachedMessage ??
          (await storageApi
            .get<Message>("messages", regenerateMessageId, timelineMessageProjection())
            .then((message) => sanitizeTimelineMessage(message))
            .catch(() => null));
        if (!storedMessage || readString(storedMessage.chatId).trim() !== chatId) return args;
        const replay = readGenerationReplay(storedMessage?.extra);
        if (!replay) return args;

        const nextArgs = { ...args };
        applyGenerationReplayToRegenerateInput(nextArgs, replay);
        return nextArgs;
      })();

      return runGenerationWithUi(
        queryClient,
        adjustedArgs,
        (streamArgs, signal) =>
          startGeneration(
            { storage: storageApi, llm: llmApi, integrations: reviewedIntegrationGateway, visuals: visualAssetsApi },
            {
              ...streamArgs,
              userTimeZone: resolveUserTimeZone(),
              imagePromptSettings: {
                includeAppearances: useUIStore.getState().imagePromptIncludeAppearances,
                format: useUIStore.getState().imagePromptFormat,
              },
              hideAutomatedSummarySourceMessages: useUIStore.getState().summaryPopoverSettings.hideSummarizedMessages,
              debugMode: useUIStore.getState().debugMode,
              debugSink: enqueueAgentDebugEntry,
            },
            signal,
          ) as AsyncGenerator<StreamEvent>,
        {
          beforeStart: async (beforeArgs, signal) => {
            if (signal.aborted) return;
            void backfillConversationSummaries(
              { storage: storageApi, llm: llmApi },
              {
                chatId: beforeArgs.chatId,
                connectionId: typeof beforeArgs.connectionId === "string" ? beforeArgs.connectionId : null,
                maxMissingDays: 2,
              },
            ).catch(() => {
              // Summary refresh should never block an otherwise valid generation.
            });
          },
        },
      );
    },
    [queryClient, reviewedIntegrationGateway],
  );

  const retryAgents = useCallback(
    async (chatId: string, agentTypes?: string[], options?: Record<string, unknown>) => {
      try {
        await assertChatCanGenerate(queryClient, chatId);
        const agentStore = useAgentStore.getState();
        agentStore.setProcessing(true);
        if (agentTypes && agentTypes.length > 0) {
          // Targeted retry: clear only the entries for agents we're about to re-run, so
          // prior-turn failures for agents that aren't being retried stay visible. If any
          // of the retried agents fail again, addFailedAgentFailure in applyAgentResultEffects
          // will repopulate them via the result loop below.
          const retrySet = new Set(agentTypes);
          const remaining = agentStore.failedAgentFailures.filter((failure) => !retrySet.has(failure.agentType));
          agentStore.setFailedAgentFailures(remaining);
        } else {
          // Full retry: clear everything; the result loop repopulates anything still failing.
          agentStore.clearFailedAgentTypes();
        }
        const refreshTarget = retryRefreshTargetFromCache(queryClient, chatId, options);
        const { results, events } = await retryGenerationAgents(
          { storage: storageApi, llm: llmApi, integrations: integrationGateway, visuals: visualAssetsApi },
          {
            chatId,
            agentTypes,
            hideAutomatedSummarySourceMessages: useUIStore.getState().summaryPopoverSettings.hideSummarizedMessages,
            imagePromptSettings: {
              includeAppearances: useUIStore.getState().imagePromptIncludeAppearances,
              format: useUIStore.getState().imagePromptFormat,
            },
            options: { ...(options ?? {}), bypassActivation: options?.bypassActivation ?? true },
          },
        );
        const failedRetries: AgentFailure[] = [];
        for (const rawResult of results) {
          const result = parseAgentResult(rawResult);
          if (!result || result.success) continue;
          const raw = isRecord(rawResult) ? rawResult : null;
          const data = parseMaybeRecord(result.data);
          const agentName =
            (raw ? readString(raw.agentName).trim() || readString(raw.name).trim() : "") ||
            readString(data.agentName).trim() ||
            result.agentType;
          failedRetries.push(toAgentFailure({ agentType: result.agentType, agentName, error: result.error }));
        }
        if (failedRetries.length > 0) {
          toast.error(formatAgentFailuresToast(failedRetries), { duration: 10_000 });
        }
        for (const event of events) {
          if (event.type === "illustration") {
            toast("Illustration generated.");
            // The chat-query refresh is fired unconditionally after this loop;
            // here we only need the illustration-specific gallery invalidate.
            runDeferredGenerationWork("gallery refresh", () =>
              queryClient.invalidateQueries({ queryKey: ["gallery", "images", chatId] }),
            );
          } else if (event.type === "illustration_error") {
            const data = parseMaybeRecord(event.data);
            toast.error(readString(data.error, "Illustration generation failed."));
          }
        }
        const deferredTasks = results.map((result) =>
          runDeferredGenerationWork("agent retry result effects", () =>
            applyAgentResultEffects(queryClient, chatId, result),
          ),
        );
        deferredTasks.push(
          runDeferredGenerationWork("agent retry refresh", async () => {
            await refreshGameStateFromStorage(chatId, refreshTarget);
            await queryClient.invalidateQueries({ queryKey: ["agents"] });
          }),
        );
        scheduleChatQueryRefresh(queryClient, chatId);
        await Promise.all(deferredTasks);
      } catch (error) {
        toast.error(errorMessage(error));
        throw error;
      } finally {
        useAgentStore.getState().setProcessing(false);
      }
    },
    [queryClient],
  );

  return { generate, retryAgents };
}
