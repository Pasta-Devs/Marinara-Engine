// ──────────────────────────────────────────────
// React Query: Chat hooks
// ──────────────────────────────────────────────
import { useCallback } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, isRequestTimeoutError, requestTimeoutSignal } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { useAgentStore } from "../stores/agent.store";
import { useGameStateStore } from "../stores/game-state.store";
import { useEncounterStore } from "../stores/encounter.store";
import { useUIStore } from "../stores/ui.store";
import { clearBrowserRuntimeCaches } from "../lib/browser-runtime";
import { shouldRefetchMessagesOnReconnect } from "../lib/message-page-cache";
import { normalizeHydratedMessage } from "../lib/message-hydration";
import { isMessageHidden } from "../lib/message-visibility";
import { copyLocalSpriteVisualSettings } from "../components/chat/local-sprite-visual-settings";
import { lorebookKeys } from "./use-lorebooks";
import { achievementKeys, trackAchievementEvent } from "./use-achievements";
import type {
  Chat,
  ChatMemoryChunk,
  ChatMemoryRecallExportPayload,
  ChatMemoryRecallImportResult,
  ChatSummaryEntry,
  ConversationNote,
  ExportEnvelope,
  Message,
  MessageSwipe,
  DaySummaryEntry,
  WeekSummaryEntry,
  HomeFeedSnapshot,
} from "@marinara-engine/shared";

import { useRollingBackfillStore } from "../stores/backfill.store";
import { homeFeedKeys } from "./use-home-feed";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
  messageCount: (chatId: string) => [...chatKeys.all, "messageCount", chatId] as const,
  messagePeek: (chatId: string) => [...chatKeys.all, "messagePeek", chatId] as const,
  memories: (chatId: string) => [...chatKeys.all, "memories", chatId] as const,
  notes: (chatId: string) => [...chatKeys.all, "notes", chatId] as const,
  group: (groupId: string) => [...chatKeys.all, "group", groupId] as const,
};

const RECENT_MESSAGE_CONTENT_EDIT_TTL_MS = 5 * 60 * 1000;
const MESSAGE_CONTENT_UPDATE_RETRY_DELAY_MS = 300;
const chatMetadataMutationVersions = new Map<string, number>();
const chatMetadataFieldVersions = new Map<string, Map<string, number>>();

interface RecentMessageContentEdit {
  chatId: string;
  content: string;
  activeSwipeIndex: number | null;
  updatedAt: number;
  revision: number;
}

const recentMessageContentEdits = new Map<string, RecentMessageContentEdit>();
let recentMessageContentEditRevision = 0;
const messageContentUpdateQueues = new Map<string, Promise<void>>();

function shouldRetryMessageContentUpdate(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError;
}

async function patchMessageContent(chatId: string | null, messageId: string, content: string) {
  try {
    return await api.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content });
  } catch (error) {
    if (!shouldRetryMessageContentUpdate(error)) throw error;
    // Keep the retry inside the queued operation so a newer edit cannot be
    // persisted first and then overwritten by this older content.
    await new Promise((resolve) => setTimeout(resolve, MESSAGE_CONTENT_UPDATE_RETRY_DELAY_MS));
    return api.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content });
  }
}

function enqueueMessageContentUpdate(chatId: string | null, messageId: string, content: string) {
  const queueKey = `${chatId ?? ""}:${messageId}`;
  const previous = messageContentUpdateQueues.get(queueKey) ?? Promise.resolve();
  const request = previous.catch(() => undefined).then(() => patchMessageContent(chatId, messageId, content));
  const settled = request.then(
    () => undefined,
    () => undefined,
  );
  messageContentUpdateQueues.set(queueKey, settled);
  void settled.finally(() => {
    if (messageContentUpdateQueues.get(queueKey) === settled) {
      messageContentUpdateQueues.delete(queueKey);
    }
  });
  return request;
}

function pruneRecentMessageContentEdits(now = Date.now()) {
  for (const [messageId, edit] of recentMessageContentEdits) {
    if (now - edit.updatedAt > RECENT_MESSAGE_CONTENT_EDIT_TTL_MS) {
      recentMessageContentEdits.delete(messageId);
    }
  }
}

function findCachedMessage(data: InfiniteData<Message[]> | undefined, messageId: string): Message | null {
  if (!data?.pages) return null;
  for (const page of data.pages) {
    const found = page.find((message) => message.id === messageId);
    if (found) return found;
  }
  return null;
}

export function rememberRecentMessageContentEdit(
  chatId: string,
  messageId: string,
  content: string,
  activeSwipeIndex?: number | null,
) {
  pruneRecentMessageContentEdits();
  const revision = ++recentMessageContentEditRevision;
  recentMessageContentEdits.set(messageId, {
    chatId,
    content,
    activeSwipeIndex: activeSwipeIndex ?? null,
    updatedAt: Date.now(),
    revision,
  });
  return revision;
}

function confirmRecentMessageContentEdit(
  chatId: string,
  messageId: string,
  revision: number,
  content: string,
  activeSwipeIndex?: number | null,
) {
  const edit = recentMessageContentEdits.get(messageId);
  if (!edit || edit.chatId !== chatId || edit.revision !== revision) return false;
  recentMessageContentEdits.set(messageId, {
    ...edit,
    content,
    activeSwipeIndex: activeSwipeIndex ?? edit.activeSwipeIndex,
    updatedAt: Date.now(),
  });
  return true;
}

export function forgetRecentMessageContentEdit(chatId: string, messageId: string, revision?: number) {
  const edit = recentMessageContentEdits.get(messageId);
  if (edit?.chatId !== chatId || (revision !== undefined && edit.revision !== revision)) return false;
  recentMessageContentEdits.delete(messageId);
  return true;
}

export function preserveRecentMessageContentEdit(chatId: string, message: Message): Message {
  pruneRecentMessageContentEdits();
  const normalizedMessage = normalizeHydratedMessage(message);
  const edit = recentMessageContentEdits.get(normalizedMessage.id);
  if (!edit || edit.chatId !== chatId) return normalizedMessage;
  if (edit.activeSwipeIndex !== null && edit.activeSwipeIndex !== normalizedMessage.activeSwipeIndex) {
    return normalizedMessage;
  }
  if (normalizedMessage.content === edit.content) return normalizedMessage;
  return { ...normalizedMessage, content: edit.content };
}

export function applyRecentMessageContentEditsToData(
  chatId: string,
  data: InfiniteData<Message[]> | undefined,
): InfiniteData<Message[]> | undefined {
  if (!data?.pages || recentMessageContentEdits.size === 0) return data;
  let changed = false;
  const pages = data.pages.map((page) =>
    page.map((message) => {
      const next = preserveRecentMessageContentEdit(chatId, message);
      if (next !== message) changed = true;
      return next;
    }),
  );
  return changed ? { ...data, pages } : data;
}

export type ExpungeScope =
  | "chats"
  | "characters"
  | "personas"
  | "lorebooks"
  | "presets"
  | "connections"
  | "automation"
  | "media";

export interface ConversationSummaryBackfillResult {
  generatedDays: string[];
  consolidatedWeeks: string[];
  failedDays: Array<{ date: string; error: string }>;
  failedWeeks: Array<{ weekKey: string; error: string }>;
  missingDayCount: number;
  processedDayCount: number;
  remainingMissingDayCount: number;
}

async function resetClientAfterExpunge(qc: ReturnType<typeof useQueryClient>) {
  await clearBrowserRuntimeCaches();
  useChatStore.getState().reset();
  useAgentStore.getState().reset();
  useGameStateStore.getState().reset();
  useEncounterStore.getState().reset();
  const ui = useUIStore.getState();
  ui.closeModal();
  ui.closeAllDetails();
  ui.closeRightPanel();
  ui.closeBotBrowser();
  ui.setChatBackground(null);
  qc.clear();
}

export function useChats(options: { enabled?: boolean; refetchOnMount?: boolean | "always" } = {}) {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api.get<Chat[]>("/chats"),
    enabled: options.enabled ?? true,
    placeholderData: (previousData) => previousData,
    staleTime: 10_000,
    refetchOnMount: options.refetchOnMount ?? "always",
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      const status = error instanceof ApiError ? error.status : 0;
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
      return failureCount < 10;
    },
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 5_000),
  });
}

// A frozen host accepts the TCP connection but never answers, so without a
// deadline the chat-open fetch pends forever and the "Opening chat..." spinner
// never resolves to an error state (#5657).
const CHAT_OPEN_TIMEOUT_MS = 15_000;

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: ({ signal }) =>
      api.get<Chat>(`/chats/${id}`, { signal: requestTimeoutSignal(CHAT_OPEN_TIMEOUT_MS, signal) }),
    enabled: !!id,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // A timeout means the server is unreachable/frozen; retrying just multiplies
      // the wait before the explicit unreachable state can render.
      if (isRequestTimeoutError(error)) return false;
      const status = error instanceof ApiError ? error.status : 0;
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
      return failureCount < 3;
    },
  });
}

export function useChatMessages(chatId: string | null, pageSize: number = 0, enabled = true) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(chatId ?? ""),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams();
      if (pageSize > 0) params.set("limit", String(pageSize));
      if (pageParam) params.set("before", pageParam);
      const qs = params.toString();
      return api
        .get<Message[]>(`/chats/${chatId}/messages${qs ? `?${qs}` : ""}`, { signal })
        .then((messages) =>
          chatId ? messages.map((message) => preserveRecentMessageContentEdit(chatId, message)) : messages,
        );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (pageSize <= 0 || lastPage.length < pageSize) return undefined;
      const oldestLoaded = lastPage[0];
      if (!oldestLoaded) return undefined;
      return `${oldestLoaded.createdAt}|${encodeURIComponent(oldestLoaded.id)}`;
    },
    enabled: !!chatId && enabled,
    // #4703: a reconnect refetch re-drains every loaded page back-to-back, so
    // a scrolled-back chat on a flaky mobile connection re-downloads its whole
    // loaded history per network flap. Allow it only while the cache is
    // shallow; deep caches still resync via the stale-gated refetchOnMount,
    // the post-generation refresh, and explicit invalidations.
    refetchOnReconnect: (query) => shouldRefetchMessagesOnReconnect(query.state.data?.pages.length ?? 0),
  });
}

/**
 * Newest messages of a chat as one flat window, for read-only consumers
 * (sidebar hover peek, the Director secret-plot panel).
 *
 * Deliberately does NOT share `chatKeys.messages` — that key ignores page size, so writing
 * a short slice into it would leave ChatArea's paginated view starting from a truncated
 * cache the next time that chat is opened. The reverse direction is just as important
 * (#4721): merely OBSERVING the shared key with a different pageSize overwrites the
 * transcript query's option closures (queryFn limit, getNextPageParam), because React
 * Query keeps one options set per key and the last observer wins. Read-only windows
 * belong here, keyed by their limit.
 */
export function useChatMessagePeek(chatId: string | null, limit = 4, enabled = false) {
  return useQuery({
    queryKey: [...chatKeys.messagePeek(chatId ?? ""), limit],
    queryFn: ({ signal }) =>
      api
        .get<Message[]>(`/chats/${chatId}/messages?limit=${limit}`, { signal })
        .then((messages) => messages.map(normalizeHydratedMessage)),
    enabled: !!chatId && enabled,
    staleTime: 15_000,
  });
}

export function useChatMessageCount(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messageCount(chatId ?? ""),
    queryFn: () => api.get<{ count: number }>(`/chats/${chatId}/message-count`),
    enabled: !!chatId,
    staleTime: 30_000,
  });
}

export function useChatMemories(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: chatKeys.memories(chatId ?? ""),
    queryFn: () => api.get<ChatMemoryChunk[]>(`/chats/${chatId}/memories`),
    enabled: !!chatId && enabled,
    staleTime: 10_000,
  });
}

export function useDeleteChatMemory(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => api.delete(`/chats/${chatId}/memories/${memoryId}`),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useClearChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/chats/${chatId}/memories`),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useRefreshChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ rebuilt: number }>(`/chats/${chatId}/memories/refresh`),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useExportChatMemories(chatId: string | null) {
  return useMutation({
    mutationFn: () => {
      if (!chatId) throw new Error("Chat ID is required");
      return api.download(`/chats/${chatId}/memories/export`, "memory-recall.marinara.json");
    },
  });
}

export function useImportChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      envelope,
      replace = false,
    }: {
      envelope: ExportEnvelope<ChatMemoryRecallExportPayload>;
      replace?: boolean;
    }) => {
      if (!chatId) throw new Error("Chat ID is required");
      const query = replace ? "?replace=true" : "";
      return api.post<ChatMemoryRecallImportResult>(`/chats/${chatId}/memories/import${query}`, envelope);
    },
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useChatNotes(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.notes(chatId ?? ""),
    queryFn: () => api.get<ConversationNote[]>(`/chats/${chatId}/notes`),
    enabled: !!chatId,
    staleTime: 10_000,
  });
}

export function useDeleteChatNote(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api.delete(`/chats/${chatId}/notes/${noteId}`),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.notes(chatId) });
    },
  });
}

export function useClearChatNotes(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/chats/${chatId}/notes`),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.notes(chatId) });
    },
  });
}

export function useChatGroup(groupId: string | null) {
  return useQuery({
    queryKey: chatKeys.group(groupId ?? ""),
    queryFn: () => api.get<Chat[]>(`/chats/group/${groupId}`),
    enabled: !!groupId,
  });
}

type DeleteChatInput = string | { id: string; groupId?: string | null; force?: boolean };

function getDeleteChatId(input: DeleteChatInput) {
  return typeof input === "string" ? input : input.id;
}

function getDeleteChatGroupId(input: DeleteChatInput) {
  return typeof input === "string" ? null : (input.groupId ?? null);
}

function getDeleteChatForce(input: DeleteChatInput) {
  return typeof input === "string" ? false : input.force === true;
}

function chatMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function upsertCachedChat(rows: Chat[] | undefined, chat: Chat): Chat[] | undefined {
  if (!rows) return rows;
  const existingIndex = rows.findIndex((row) => row.id === chat.id);
  if (existingIndex === -1) return [chat, ...rows];
  return rows.map((row) => (row.id === chat.id ? chat : row));
}

function removeChatsFromHomeFeed(snapshot: HomeFeedSnapshot | undefined, ids: ReadonlySet<string>) {
  if (!snapshot) return snapshot;
  const recentChats = snapshot.recentChats.filter(({ chat }) => !ids.has(chat.id));
  return recentChats.length === snapshot.recentChats.length ? snapshot : { ...snapshot, recentChats };
}

function normalizeChatMetadataValue(raw: unknown): Chat["metadata"] {
  if (!raw) return {} as Chat["metadata"];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Chat["metadata"])
        : ({} as Chat["metadata"]);
    } catch {
      return {} as Chat["metadata"];
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Chat["metadata"]) : ({} as Chat["metadata"]);
}

function normalizeChatForCache(chat: Chat): Chat {
  return { ...chat, metadata: normalizeChatMetadataValue((chat as { metadata?: unknown }).metadata) };
}

function nextChatMetadataMutationVersion(chatId: string, keys: string[]) {
  const version = (chatMetadataMutationVersions.get(chatId) ?? 0) + 1;
  chatMetadataMutationVersions.set(chatId, version);
  let fieldVersions = chatMetadataFieldVersions.get(chatId);
  if (!fieldVersions) {
    fieldVersions = new Map();
    chatMetadataFieldVersions.set(chatId, fieldVersions);
  }
  for (const key of keys) fieldVersions.set(key, version);
  return version;
}

function shouldAcceptMetadataField(chatId: string, key: string, version: number) {
  return (chatMetadataFieldVersions.get(chatId)?.get(key) ?? 0) <= version;
}

function mergeMetadataForVersion(
  chatId: string,
  base: unknown,
  incoming: unknown,
  version: number,
  keys?: string[],
): Chat["metadata"] {
  const baseRecord = normalizeChatMetadataValue(base) as Record<string, unknown>;
  const incomingRecord = normalizeChatMetadataValue(incoming) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...baseRecord };
  const incomingKeys = keys ?? Object.keys(incomingRecord);
  for (const key of incomingKeys) {
    if (!shouldAcceptMetadataField(chatId, key, version)) continue;
    if (Object.prototype.hasOwnProperty.call(incomingRecord, key)) {
      next[key] = incomingRecord[key];
    } else {
      delete next[key];
    }
  }
  return next as Chat["metadata"];
}

/**
 * Version snapshot to take BEFORE issuing a request whose response will be
 * written back through {@link guardServerChatSnapshot}: any metadata field
 * the user edits after this moment outranks that response.
 */
export function captureChatMetadataVersion(chatId: string) {
  return chatMetadataMutationVersions.get(chatId) ?? 0;
}

/**
 * Prepare a SERVER SNAPSHOT for a cache write without letting it revert
 * newer local metadata edits (#5641). The per-field version guard used to
 * live only inside useUpdateChatMetadata; every other mutation wrote its
 * response chat back raw, so a response produced before a metadata PATCH but
 * consumed after it replaced the whole chat — momentarily (or, with no
 * refetch pending, until reload) flipping recently-edited fields back and
 * unmounting the settings sections they gate. Non-metadata fields stay
 * server-authoritative, matching these writers' previous behavior. A field
 * the server response OMITS keeps its cached value until the next refetch —
 * the callers that need deletion semantics already invalidate the detail
 * query alongside their write.
 */
export function guardServerChatSnapshot(qc: QueryClient, chat: Chat, versionAtRequest: number): Chat {
  const cached = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
  const chatStore = useChatStore.getState();
  const fallback = chatStore.activeChat?.id === chat.id ? chatStore.activeChat : null;
  const base = cached ?? fallback;
  if (!base) return chat;
  return {
    ...chat,
    metadata: mergeMetadataForVersion(chat.id, base.metadata, chat.metadata, versionAtRequest),
  };
}

export function syncCachedChat(qc: QueryClient, chat: Chat) {
  const normalized = normalizeChatForCache(chat);
  qc.setQueryData<Chat>(chatKeys.detail(normalized.id), normalized);
  qc.setQueryData<Chat[]>(chatKeys.list(), (existing) => upsertCachedChat(existing, normalized));
  if (normalized.groupId) {
    qc.setQueryData<Chat[]>(chatKeys.group(normalized.groupId), (existing) => upsertCachedChat(existing, normalized));
  }
  const chatStore = useChatStore.getState();
  if (chatStore.activeChatId === normalized.id || chatStore.activeChat?.id === normalized.id) {
    chatStore.setActiveChat(normalized);
  }
}

function syncCachedBranch(rows: Chat[] | undefined, sourceChatId: string, newChat: Chat): Chat[] | undefined {
  if (!rows) return rows;
  const groupedRows = newChat.groupId
    ? rows.map((row) =>
        row.id === sourceChatId && row.groupId !== newChat.groupId ? { ...row, groupId: newChat.groupId } : row,
      )
    : rows;
  return upsertCachedChat(groupedRows, newChat);
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      mode: string;
      characterIds?: string[];
      groupId?: string | null;
      connectionId?: string | null;
      personaId?: string | null;
      personaCharacterId?: string | null;
      promptPresetId?: string | null;
    }) => api.post<Chat>("/chats", data),
    onSuccess: (chat) => {
      if (chat) {
        qc.setQueryData(chatKeys.detail(chat.id), chat);
        qc.setQueryData<Chat[]>(chatKeys.list(), (existing) => upsertCachedChat(existing, chat));
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: homeFeedKeys.all });
      void trackAchievementEvent("chat_created")
        .finally(() => qc.invalidateQueries({ queryKey: achievementKeys.all }))
        .catch(() => undefined);
    },
    onError: (error) => {
      toast.error(chatMutationErrorMessage(error, "Couldn't create the conversation. Please try again."));
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteChatInput) => {
      const force = getDeleteChatForce(input) ? "?force=true" : "";
      return api.delete(`/chats/${getDeleteChatId(input)}${force}`);
    },
    onMutate: async (input) => {
      const id = getDeleteChatId(input);
      const providedGroupId = getDeleteChatGroupId(input);
      const cachedList = qc.getQueryData<Chat[]>(chatKeys.list());
      const cachedProvidedGroup = providedGroupId
        ? qc.getQueryData<Chat[]>(chatKeys.group(providedGroupId))
        : undefined;
      const cachedDetail = qc.getQueryData<Chat>(chatKeys.detail(id));
      const cachedHomeFeed = qc.getQueryData<HomeFeedSnapshot>(homeFeedKeys.snapshot());
      const deletedChat =
        cachedList?.find((chat) => chat.id === id) ??
        cachedProvidedGroup?.find((chat) => chat.id === id) ??
        cachedDetail ??
        cachedHomeFeed?.recentChats.find(({ chat }) => chat.id === id)?.chat ??
        null;
      const groupId = deletedChat?.groupId ?? providedGroupId;
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      await qc.cancelQueries({ queryKey: homeFeedKeys.all });
      await qc.cancelQueries({ queryKey: chatKeys.detail(id), exact: true });
      const affectedGroupIds = Array.from(
        new Set([providedGroupId, groupId].filter((value): value is string => Boolean(value))),
      );
      for (const affectedGroupId of affectedGroupIds) {
        await qc.cancelQueries({ queryKey: chatKeys.group(affectedGroupId) });
      }
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      const previousHomeFeed = qc.getQueryData<HomeFeedSnapshot>(homeFeedKeys.snapshot());
      const previousGroups = affectedGroupIds.map((affectedGroupId) => ({
        groupId: affectedGroupId,
        chats: qc.getQueryData<Chat[]>(chatKeys.group(affectedGroupId)),
      }));

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.id !== id));
      qc.setQueryData<HomeFeedSnapshot>(homeFeedKeys.snapshot(), (old) => removeChatsFromHomeFeed(old, new Set([id])));
      qc.removeQueries({ queryKey: chatKeys.detail(id), exact: true });

      for (const affectedGroupId of affectedGroupIds) {
        qc.setQueryData<Chat[]>(chatKeys.group(affectedGroupId), (old) => old?.filter((c) => c.id !== id));
      }

      return { previous, previousDetail: cachedDetail, previousHomeFeed, previousGroups, affectedGroupIds };
    },
    onError: (_err, input, context) => {
      const id = getDeleteChatId(input);
      if (context?.previous) {
        qc.setQueryData(chatKeys.list(), context.previous);
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.list() });
      }
      if (context?.previousDetail !== undefined) {
        qc.setQueryData(chatKeys.detail(id), context.previousDetail);
      }
      if (context?.previousHomeFeed) qc.setQueryData(homeFeedKeys.snapshot(), context.previousHomeFeed);
      for (const previousGroup of context?.previousGroups ?? []) {
        if (previousGroup.chats !== undefined) {
          qc.setQueryData(chatKeys.group(previousGroup.groupId), previousGroup.chats);
        } else {
          qc.removeQueries({ queryKey: chatKeys.group(previousGroup.groupId), exact: true });
        }
      }
      toast.error("Couldn't delete the conversation. It has been restored.");
    },
    onSettled: (_data, error, input, context) => {
      const id = getDeleteChatId(input);
      const affectedGroupIds =
        context?.affectedGroupIds ?? [getDeleteChatGroupId(input)].filter((value): value is string => Boolean(value));
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: homeFeedKeys.all });
      if (!error) {
        qc.removeQueries({ queryKey: chatKeys.detail(id), exact: true });
      }
      for (const affectedGroupId of affectedGroupIds) {
        qc.invalidateQueries({ queryKey: chatKeys.group(affectedGroupId) });
      }
    },
  });
}

export function useDeleteChatGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { groupId: string; force?: boolean }) => {
      const groupId = typeof input === "string" ? input : input.groupId;
      const force = typeof input === "string" ? "" : input.force === true ? "?force=true" : "";
      return api.delete(`/chats/group/${groupId}${force}`);
    },
    onMutate: async (input) => {
      const groupId = typeof input === "string" ? input : input.groupId;
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      await qc.cancelQueries({ queryKey: homeFeedKeys.all });
      await qc.cancelQueries({ queryKey: chatKeys.group(groupId) });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      const previousGroup = qc.getQueryData<Chat[]>(chatKeys.group(groupId));
      const previousHomeFeed = qc.getQueryData<HomeFeedSnapshot>(homeFeedKeys.snapshot());
      const removedIds = new Set([
        ...(previous?.filter((chat) => chat.groupId === groupId).map((chat) => chat.id) ?? []),
        ...(previousGroup?.map((chat) => chat.id) ?? []),
        ...(previousHomeFeed?.recentChats.filter(({ chat }) => chat.groupId === groupId).map(({ chat }) => chat.id) ??
          []),
      ]);

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.groupId !== groupId));
      qc.setQueryData<Chat[]>(chatKeys.group(groupId), []);
      qc.setQueryData<HomeFeedSnapshot>(homeFeedKeys.snapshot(), (old) => removeChatsFromHomeFeed(old, removedIds));

      return { previous, previousGroup, previousHomeFeed, groupId };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(chatKeys.list(), context.previous);
      if (context?.previousHomeFeed) qc.setQueryData(homeFeedKeys.snapshot(), context.previousHomeFeed);
      if (context?.groupId && context.previousGroup) {
        qc.setQueryData(chatKeys.group(context.groupId), context.previousGroup);
      } else if (context?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
      }
    },
    onSettled: (_data, _err, _input, context) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: homeFeedKeys.all });
      if (context?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
      }
    },
  });
}

export function useUpdateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      mode?: string;
      connectionId?: string | null;
      promptPresetId?: string | null;
      personaId?: string | null;
      personaCharacterId?: string | null;
      characterIds?: string[];
    }) => api.patch<Chat>(`/chats/${id}`, data),
    onMutate: ({ id }) => ({ metadataVersion: captureChatMetadataVersion(id) }),
    onSuccess: (updatedChat, vars, context) => {
      const guardedChat = updatedChat ? guardServerChatSnapshot(qc, updatedChat, context?.metadataVersion ?? 0) : null;
      if (guardedChat) {
        syncCachedChat(qc, guardedChat);
      }
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      if (vars.characterIds !== undefined) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(vars.id) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(vars.id) });
      }
      if (vars.personaId !== undefined || vars.personaCharacterId !== undefined) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(vars.id) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(vars.id) });
        qc.invalidateQueries({ queryKey: chatKeys.messagePeek(vars.id) });
      }

      // Patch the group cache so the branch selector dropdown reflects renames
      // (and any other field changes) without waiting for a chat switch. Use
      // the guarded chat — the raw snapshot would regress this cache to the
      // stale metadata the guard just filtered out (#5641).
      if (guardedChat?.groupId) {
        qc.setQueryData<Chat[]>(chatKeys.group(guardedChat.groupId), (existing) =>
          existing?.map((chat) => (chat.id === vars.id ? guardedChat : chat)),
        );
      }
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "group"] });
    },
  });
}

export function useUpdateChatMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...metadata }: { id: string; [key: string]: unknown }) =>
      api.patch<Chat>(`/chats/${id}/metadata`, metadata),
    onMutate: async ({ id, ...metadata }) => {
      await qc.cancelQueries({ queryKey: chatKeys.detail(id) });
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      const previous = qc.getQueryData<Chat>(chatKeys.detail(id));
      const fallback = useChatStore.getState().activeChat?.id === id ? useChatStore.getState().activeChat : null;
      const base = previous ?? fallback;
      const updatedAt = new Date().toISOString();
      const changedKeys = Object.keys(metadata);
      const version = nextChatMetadataMutationVersion(id, changedKeys);
      if (base) {
        syncCachedChat(qc, {
          ...base,
          metadata: {
            ...(normalizeChatMetadataValue(base.metadata) as Record<string, unknown>),
            ...metadata,
          } as Chat["metadata"],
          updatedAt,
        });
      }
      return { previous, version, changedKeys };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        const current = qc.getQueryData<Chat>(chatKeys.detail(variables.id)) ?? context.previous;
        syncCachedChat(qc, {
          ...current,
          metadata: mergeMetadataForVersion(
            variables.id,
            current.metadata,
            context.previous.metadata,
            context.version,
            context.changedKeys,
          ),
          updatedAt: context.previous.updatedAt,
        });
      }
    },
    onSuccess: (data, vars, context) => {
      if (data) {
        const existing = qc.getQueryData<Chat>(chatKeys.detail(vars.id));
        const base = existing ?? data;
        syncCachedChat(qc, {
          ...base,
          metadata: mergeMetadataForVersion(
            vars.id,
            base.metadata,
            data.metadata,
            context?.version ?? chatMetadataMutationVersions.get(vars.id) ?? 0,
          ),
          updatedAt: data.updatedAt,
        });
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "group"] });
      qc.invalidateQueries({ queryKey: lorebookKeys.active(vars.id) });
    },
  });
}

export function useClearAutonomousUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => api.delete<Chat>(`/chats/${chatId}/autonomous-unread`),
    onMutate: (chatId) => ({ metadataVersion: captureChatMetadataVersion(chatId) }),
    onSuccess: (data, chatId, context) => {
      if (data) {
        const guarded = guardServerChatSnapshot(qc, data, context?.metadataVersion ?? 0);
        // The server clears unread state by DELETING these keys, so the
        // response omits them and the merge keeps the cached residue. Nothing
        // client-side ever PATCHes them, so no field version can legitimately
        // outrank their deletion — drop them explicitly.
        const metadata = { ...(normalizeChatMetadataValue(guarded.metadata) as Record<string, unknown>) };
        delete metadata.autonomousUnreadCount;
        delete metadata.autonomousUnreadCharacterIds;
        delete metadata.autonomousUnreadAt;
        qc.setQueryData(chatKeys.detail(chatId), { ...guarded, metadata: metadata as Chat["metadata"] });
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

/** Patch day/week summaries via entry-level merge (concurrent-edit safe). */
export function useUpdateChatSummaries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      daySummaries?: Record<string, DaySummaryEntry>;
      weekSummaries?: Record<string, WeekSummaryEntry>;
    }) => api.patch<Chat>(`/chats/${id}/summaries`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
    },
  });
}

export type SummaryEntryOperation =
  | { operation: "replace"; entry: Partial<ChatSummaryEntry> & { id: string; content: string } }
  | { operation: "delete"; entryId?: string; entryIds?: string[] }
  | { operation: "toggle"; entryId: string; enabled: boolean }
  | { operation: "reorder"; entryIds: string[] };

function useSummaryEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...body }: { chatId: string } & SummaryEntryOperation) =>
      api.patch<Chat>(`/chats/${chatId}/summary-entries`, body),
    onMutate: ({ chatId }) => ({ metadataVersion: captureChatMetadataVersion(chatId) }),
    onSuccess: (data, vars, context) => {
      if (data) {
        syncCachedChat(qc, guardServerChatSnapshot(qc, data, context?.metadataVersion ?? 0));
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.detail(vars.chatId) });
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: lorebookKeys.active(vars.chatId) });
      // Only delete changes message visibility (it unhides server-side), so scope
      // the message-list refetch to that operation rather than every summary edit.
      if (vars.operation === "delete") {
        qc.invalidateQueries({ queryKey: chatKeys.messages(vars.chatId) });
      }
    },
  });
}

export function useUpdateSummaryEntry() {
  const mutation = useSummaryEntryMutation();
  return {
    ...mutation,
    mutate: (input: { chatId: string; entry: Partial<ChatSummaryEntry> & { id: string; content: string } }) =>
      mutation.mutate({ ...input, operation: "replace" }),
    mutateAsync: (input: { chatId: string; entry: Partial<ChatSummaryEntry> & { id: string; content: string } }) =>
      mutation.mutateAsync({ ...input, operation: "replace" }),
  };
}

export function useDeleteSummaryEntry() {
  const mutation = useSummaryEntryMutation();
  return {
    ...mutation,
    mutate: (input: { chatId: string; entryId?: string; entryIds?: string[] }) =>
      mutation.mutate({ ...input, operation: "delete" }),
    mutateAsync: (input: { chatId: string; entryId?: string; entryIds?: string[] }) =>
      mutation.mutateAsync({ ...input, operation: "delete" }),
  };
}

export function useToggleSummaryEntry() {
  const mutation = useSummaryEntryMutation();
  return {
    ...mutation,
    mutate: (input: { chatId: string; entryId: string; enabled: boolean }) =>
      mutation.mutate({ ...input, operation: "toggle" }),
    mutateAsync: (input: { chatId: string; entryId: string; enabled: boolean }) =>
      mutation.mutateAsync({ ...input, operation: "toggle" }),
  };
}

export function useReorderSummaryEntries() {
  const mutation = useSummaryEntryMutation();
  return {
    ...mutation,
    mutate: (input: { chatId: string; entryIds: string[] }) => mutation.mutate({ ...input, operation: "reorder" }),
    mutateAsync: (input: { chatId: string; entryIds: string[] }) =>
      mutation.mutateAsync({ ...input, operation: "reorder" }),
  };
}

/** Backfill missing conversation day/week summaries via the LLM. */
export function useBackfillConversationSummaries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, maxMissingDays }: { chatId: string; maxMissingDays?: number }) =>
      api.post<ConversationSummaryBackfillResult>(`/chats/${chatId}/backfill-summaries`, { maxMissingDays }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.chatId) });
    },
  });
}

export interface RollingSummaryBackfillInput {
  chatId: string;
  summaryEntries: ChatSummaryEntry[];
  batchSize: number;
  maxMessagesPerBatch: number;
  promptTemplateId?: string | null;
}

export function useRollingSummaryBackfill() {
  const qc = useQueryClient();

  const startBackfill = useCallback(
    async (input: RollingSummaryBackfillInput) => {
      const { chatId, summaryEntries, batchSize, maxMessagesPerBatch, promptTemplateId } = input;

      const store = useRollingBackfillStore.getState();
      if (store.status === "running") return;

      // Flip to "running" synchronously before any await
      store.startBackfill(chatId);

      let allMessages: Array<{ id: string; role: string; extra?: unknown }>;
      try {
        allMessages = await api.get(`/chats/${chatId}/messages`);
      } catch {
        useRollingBackfillStore.getState().stopBackfill();
        toast.error("Could not start backfill: failed to load messages.");
        return;
      }
      if (!Array.isArray(allMessages) || allMessages.length === 0) {
        useRollingBackfillStore.getState().stopBackfill();
        return;
      }

      const messageIds = allMessages.map((m) => m.id);
      const totalMessageCount = messageIds.length;

      const summarizedIds = new Set<string>();
      for (const entry of summaryEntries) {
        if (Array.isArray(entry.messageIds)) {
          for (const id of entry.messageIds) summarizedIds.add(id);
        }
      }

      const safeBatchSize = Math.max(1, Math.min(totalMessageCount, batchSize));
      const batches: Array<{ rangeStart: number; rangeEnd: number }> = [];
      let cursor = 0;
      while (cursor < totalMessageCount) {
        while (cursor < totalMessageCount) {
          const msg = allMessages[cursor]!;
          if (summarizedIds.has(msg.id) || isMessageHidden(msg)) {
            cursor++;
          } else {
            break;
          }
        }
        if (cursor >= totalMessageCount) break;

        let userCount = 0;
        let msgCount = 0;
        let endCursor = cursor;
        while (endCursor < totalMessageCount && userCount < safeBatchSize && msgCount < maxMessagesPerBatch) {
          const msg = allMessages[endCursor]!;
          if (!isMessageHidden(msg)) {
            if (msg.role === "user") {
              userCount++;
            }
            msgCount++;
          }
          endCursor++;
        }

        batches.push({ rangeStart: cursor + 1, rangeEnd: endCursor });
        cursor = endCursor;
      }

      if (batches.length === 0) {
        useRollingBackfillStore.getState().stopBackfill();
        toast.info("Everything is already summarized.");
        return;
      }

      const abortController = new AbortController();
      useRollingBackfillStore.setState({ abortController });

      const currentStore = useRollingBackfillStore.getState();
      currentStore.setTotalBatches(batches.length);

      const debugMode = useUIStore.getState().debugMode;

      console.warn(
        `[Backfill] Starting — ${batches.length} batch(es) covering ${totalMessageCount} messages` +
          (debugMode ? "" : " (enable Advanced > Debug Mode for per-batch logs)"),
      );

      let failedBatches = 0;

      for (let i = 0; i < batches.length; i++) {
        if (abortController.signal.aborted) break;

        const batch = batches[i]!;
        currentStore.updateProgress(i + 1, batch.rangeStart, batch.rangeEnd);

        if (debugMode) {
          console.warn(`[Backfill] Batch ${i + 1}/${batches.length}: messages ${batch.rangeStart}-${batch.rangeEnd}`);
        }

        try {
          const result = await api.post<{
            summary: string | null;
            entry: ChatSummaryEntry | null;
            entries: ChatSummaryEntry[];
            messageIds: string[];
            hideMessageIds: string[];
          }>(
            `/chats/${chatId}/generate-summary`,
            { rangeStartIndex: batch.rangeStart, rangeEndIndex: batch.rangeEnd, promptTemplateId },
            { signal: abortController.signal },
          );

          const existing = qc.getQueryData<Chat>(chatKeys.detail(chatId));
          if (existing) {
            syncCachedChat(qc, {
              ...existing,
              metadata: {
                ...(normalizeChatMetadataValue(existing.metadata) as Record<string, unknown>),
                summary: result.summary,
                summaryEntries: result.entries,
              } as Chat["metadata"],
            });
          }
          qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });

          if (debugMode) {
            console.warn(`[Backfill] Batch ${i + 1} complete`);
          }
        } catch (err) {
          if (abortController.signal.aborted) break;
          failedBatches++;
          if (debugMode) {
            console.warn(`[Backfill] Batch ${i + 1} failed:`, err);
          }
        }
      }

      if (abortController.signal.aborted) {
        useRollingBackfillStore.setState({ status: "idle", abortController: null });
        console.warn(`[Backfill] Stopped`);
      } else {
        currentStore.stopBackfill();
        if (failedBatches > 0) {
          console.warn(
            `[Backfill] Done — ${batches.length - failedBatches}/${batches.length} batch(es) succeeded, ${failedBatches} failed`,
          );
          toast.error(`Backfill finished with ${failedBatches} failed batch(es).`);
        } else {
          console.warn(`[Backfill] Done — ${batches.length} batch(es) completed`);
        }
      }
    },
    [qc],
  );

  const stopBackfill = useCallback(() => {
    useRollingBackfillStore.getState().stopBackfill();
  }, []);

  return { startBackfill, stopBackfill };
}

export function useCreateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      role: string;
      content: string;
      characterId?: string | null;
      extra?: Record<string, unknown>;
    }) => api.post<Message>(`/chats/${chatId}/messages`, data),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        // Peek windows (sidebar hover, secret-plot panel) cache the same rows
        // under their own limit-keyed queries — keep them live too (#4721).
        qc.invalidateQueries({ queryKey: chatKeys.messagePeek(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.list() });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      }
    },
  });
}

export function useDeleteMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.delete(`/chats/${chatId}/messages/${messageId}`),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messagePeek(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.list() });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      }
    },
  });
}

export function useDeleteMessages(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageIds: string[]) => api.post(`/chats/${chatId}/messages/bulk-delete`, { messageIds }),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messagePeek(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.list() });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      }
    },
  });
}

/** Edit a message's content */
export function useUpdateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      enqueueMessageContentUpdate(chatId, messageId, content),
    onMutate: async ({ messageId, content }) => {
      if (!chatId) return;
      // Cancel in-flight refetches (e.g. from generation events) so they
      // don't overwrite the optimistic value with stale server data. Do not
      // await cancellation before painting the edit: leaving edit mode must
      // never reveal the old message while the cancellation promise settles.
      const cancellation = qc.cancelQueries({ queryKey: chatKeys.messages(chatId) }, { revert: false });
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const previousMessage = findCachedMessage(previous, messageId);
      const revision = rememberRecentMessageContentEdit(chatId, messageId, content, previousMessage?.activeSwipeIndex);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => page.map((msg) => (msg.id === messageId ? { ...msg, content } : msg))),
        };
      });
      await cancellation;
      return { previous, revision };
    },
    onSuccess: (updated, { messageId, content }, context) => {
      if (chatId && context) {
        confirmRecentMessageContentEdit(
          chatId,
          messageId,
          context.revision,
          updated?.content ?? content,
          updated?.activeSwipeIndex,
        );
      }
    },
    onError: (_err, _vars, context) => {
      const shouldRollback =
        !!chatId && !!context && forgetRecentMessageContentEdit(chatId, _vars.messageId, context.revision);
      if (chatId && shouldRollback && context?.previous) {
        qc.setQueryData(chatKeys.messages(chatId), context.previous);
        const revertedMessage = findCachedMessage(context.previous, _vars.messageId);
        if (revertedMessage) {
          rememberRecentMessageContentEdit(
            chatId,
            _vars.messageId,
            revertedMessage.content,
            revertedMessage.activeSwipeIndex,
          );
        }
      }
    },
    onSettled: () => {
      if (chatId) {
        // Skip invalidation while this chat is actively streaming — a refetch
        // could pick up the just-saved assistant message while the streaming
        // overlay is still visible, causing the response to appear doubled.
        // The generation's finally block will invalidate after streaming ends.
        const { streamingChatId, isStreaming } = useChatStore.getState();
        if (isStreaming && streamingChatId === chatId) return;
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messagePeek(chatId) });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      }
    },
  });
}

/** Update a message's extra metadata (partial merge) */
export function useUpdateMessageExtra(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, extra }: { messageId: string; extra: Record<string, unknown> }) =>
      api.patch<Message>(`/chats/${chatId}/messages/${messageId}/extra`, extra),
    onMutate: async ({ messageId, extra }) => {
      if (!chatId) return;
      await qc.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((msg) => {
              if (msg.id !== messageId) return msg;
              let currentExtra: Record<string, unknown> = {};
              try {
                currentExtra =
                  typeof msg.extra === "string"
                    ? JSON.parse(msg.extra)
                    : ((msg.extra ?? {}) as unknown as Record<string, unknown>);
              } catch {
                currentExtra = {};
              }
              return { ...msg, extra: { ...currentExtra, ...extra } as unknown as Message["extra"] };
            }),
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (chatId && context?.previous) {
        qc.setQueryData(chatKeys.messages(chatId), context.previous);
      }
    },
    onSettled: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      }
    },
  });
}

function replaceCachedMessage(
  old: InfiniteData<Message[]> | undefined,
  messageId: string,
  updater: (message: Message) => Message,
): InfiniteData<Message[]> | undefined {
  if (!old?.pages) return old;
  let changed = false;
  const pages = old.pages.map((page) =>
    page.map((msg) => {
      if (msg.id !== messageId) return msg;
      changed = true;
      return updater(msg);
    }),
  );
  return changed ? { ...old, pages } : old;
}

function parseMessageExtraForCache(raw: unknown): Message["extra"] | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as Message["extra"];
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Message["extra"]) : undefined;
}

function applyCachedSwipeToMessage(message: Message, swipe: MessageSwipe): Message {
  const parsedExtra = parseMessageExtraForCache(swipe.extra);
  return {
    ...message,
    activeSwipeIndex: swipe.index,
    content: swipe.content,
    ...(parsedExtra ? { extra: parsedExtra } : {}),
    swipeCount: Math.max(message.swipeCount ?? 0, swipe.index + 1),
  };
}

/** Peek at the assembled prompt for a chat */
export function usePeekPrompt() {
  return useMutation({
    mutationFn: (request: string | { chatId: string; messageId: string }) => {
      const chatId = typeof request === "string" ? request : request.chatId;
      const messageId = typeof request === "string" ? undefined : request.messageId;
      return api.post<{
        messages: Array<{ role: string; content: string }>;
        chatMode?: string;
        parameters: unknown;
        source?: "cached" | "live_preview" | "raw_messages";
        exact?: boolean;
        generationInfo: {
          model?: string;
          provider?: string;
          temperature?: number | null;
          maxTokens?: number | null;
          showThoughts?: boolean | null;
          reasoningEffort?: string | null;
          verbosity?: string | null;
          serviceTier?: string | null;
          assistantPrefill?: string | null;
          tokensPrompt?: number | null;
          tokensCompletion?: number | null;
          tokensCachedPrompt?: number | null;
          tokensCacheWritePrompt?: number | null;
          durationMs?: number | null;
          finishReason?: string | null;
        } | null;
        agentNote?: string;
      }>(`/chats/${chatId}/peek-prompt`, messageId ? { messageId } : {});
    },
  });
}

/** Export a chat as JSONL or plain text */
export function useExportChat() {
  return useMutation({
    mutationFn: async ({ chatId, format = "jsonl" }: { chatId: string; format?: "jsonl" | "text" }) => {
      const ext = format === "text" ? ".txt" : ".jsonl";
      const includeReasoning = useUIStore.getState().includeReasoningInExports;
      const reasoningParam = includeReasoning ? "&includeReasoning=true" : "";
      await api.download(
        `/chats/${encodeURIComponent(chatId)}/export?format=${encodeURIComponent(format)}${reasoningParam}`,
        `chat-${chatId}${ext}`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? `Export failed: ${error.message}` : "Export failed.");
    },
  });
}

/** Export selected or all chats as a zip of JSONL/text transcripts */
export function useBulkExportChats() {
  return useMutation({
    mutationFn: ({
      chatIds,
      format = "jsonl",
      scope = "selected",
    }: {
      chatIds?: string[];
      format?: "jsonl" | "text";
      scope?: "selected" | "all";
    }) =>
      api.downloadPost(
        "/chats/export/bulk",
        { chatIds, format, scope, includeReasoning: useUIStore.getState().includeReasoningInExports },
        `chat-transcripts-${format}.zip`,
      ),
  });
}

/** Create a branch (copy) of an existing chat */
export function useBranchChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, upToMessageId }: { chatId: string; upToMessageId?: string }) =>
      api.post<Chat>(`/chats/${chatId}/branch`, { upToMessageId }),
    onSuccess: (newChat, { chatId }) => {
      if (newChat) {
        copyLocalSpriteVisualSettings(chatId, newChat.id);
        qc.setQueryData(chatKeys.detail(newChat.id), newChat);
        qc.setQueryData<Chat[]>(chatKeys.list(), (existing) => syncCachedBranch(existing, chatId, newChat));

        if (newChat.groupId) {
          qc.setQueryData<Chat>(chatKeys.detail(chatId), (existing) =>
            existing && existing.groupId !== newChat.groupId ? { ...existing, groupId: newChat.groupId } : existing,
          );
          qc.setQueryData<Chat[]>(chatKeys.group(newChat.groupId), (existing) =>
            syncCachedBranch(existing, chatId, newChat),
          );
        }
      }

      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });

      if (newChat?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(newChat.groupId) });
      }
    },
  });
}

/** Generate a rolling summary for a chat via the LLM */
export type GenerateSummaryInput = {
  chatId: string;
  contextSize?: number;
  rangeStartMessageId?: string;
  rangeEndMessageId?: string;
  rangeStartIndex?: number;
  rangeEndIndex?: number;
  summaryEntryIds?: string[];
  promptTemplateId?: string | null;
  signal?: AbortSignal;
};

export function useGenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      chatId,
      contextSize,
      rangeStartMessageId,
      rangeEndMessageId,
      rangeStartIndex,
      rangeEndIndex,
      summaryEntryIds,
      promptTemplateId,
      signal,
    }: GenerateSummaryInput) =>
      api.post<{
        summary: string | null;
        entry: ChatSummaryEntry | null;
        entries: ChatSummaryEntry[];
        messageIds: string[];
        /** Subset of messageIds eligible to hide (summarized set minus the protected tail). */
        hideMessageIds: string[];
      }>(
        `/chats/${chatId}/generate-summary`,
        {
          contextSize,
          rangeStartMessageId,
          rangeEndMessageId,
          rangeStartIndex,
          rangeEndIndex,
          summaryEntryIds,
          promptTemplateId,
        },
        { signal },
      ),
    onSuccess: (data, vars) => {
      const existing = qc.getQueryData<Chat>(chatKeys.detail(vars.chatId));
      if (existing) {
        syncCachedChat(qc, {
          ...existing,
          metadata: {
            ...(normalizeChatMetadataValue(existing.metadata) as Record<string, unknown>),
            summary: data.summary,
            summaryEntries: data.entries,
          } as Chat["metadata"],
        });
      }
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.chatId) });
      // The server may have hidden the tail-excluded subset; refresh the message
      // list so the hidden state shows without a manual reload.
      if (data.hideMessageIds.length > 0) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(vars.chatId) });
      }
    },
  });
}

/** Clear all user data */
export function useExpungeData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scopes: ExpungeScope[]) => api.post<{ success: boolean }>("/admin/expunge", { confirm: true, scopes }),
    onSuccess: async () => {
      await resetClientAfterExpunge(qc);
    },
  });
}

/** Clear all user data */
export function useClearAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/admin/clear-all", { confirm: true }),
    onSuccess: async () => {
      await resetClientAfterExpunge(qc);
    },
  });
}

/** Set the active swipe for a message */
export function useSetActiveSwipe(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      api.put<Message | null>(`/chats/${chatId}/messages/${messageId}/active-swipe`, { index }),
    onMutate: async ({ messageId, index }) => {
      if (!chatId) return;
      await qc.cancelQueries({ queryKey: chatKeys.messages(chatId), exact: true });
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const cachedSwipes = qc.getQueryData<MessageSwipe[]>([...chatKeys.all, "swipes", messageId]);
      const targetSwipe = cachedSwipes?.find((swipe) => swipe.index === index);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        replaceCachedMessage(old, messageId, (msg) =>
          targetSwipe ? applyCachedSwipeToMessage(msg, targetSwipe) : { ...msg, activeSwipeIndex: index },
        ),
      );
      return { previous };
    },
    onSuccess: (updated, { messageId }) => {
      if (!chatId) return;
      if (!updated) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
        return;
      }
      const normalizedUpdated = normalizeHydratedMessage(updated);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        replaceCachedMessage(old, messageId, (msg) => ({ ...msg, ...normalizedUpdated })),
      );
      qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
    },
    onError: (_err, _vars, context) => {
      if (chatId && context?.previous) {
        qc.setQueryData(chatKeys.messages(chatId), context.previous);
      }
    },
  });
}

/** Delete a single swipe while keeping the parent message */
export function useDeleteSwipe(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      api.delete<Message>(`/chats/${chatId}/messages/${messageId}/swipes/${index}`),
    onSuccess: (_data, { messageId }) => {
      if (!chatId) return;
      qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "swipes", messageId] });
    },
  });
}

/** Keep the selected swipe and delete every alternate from the parent message. */
export function useDeleteOtherSwipes(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      api.delete<Message>(`/chats/${chatId}/messages/${messageId}/swipes/others/${index}`),
    onSuccess: (_data, { messageId }) => {
      if (!chatId) return;
      qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "swipes", messageId] });
    },
  });
}

/** Connect two chats bidirectionally (conversation ↔ roleplay) */
export function useConnectChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, targetChatId }: { chatId: string; targetChatId: string }) =>
      api.post<{ connected: boolean }>(`/chats/${chatId}/connect`, { targetChatId }),
    onSuccess: (_data, { chatId, targetChatId }) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.detail(targetChatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

/** Disconnect a chat from its linked partner */
export function useDisconnectChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => api.post<{ disconnected: boolean }>(`/chats/${chatId}/disconnect`, {}),
    onSuccess: (_data, chatId) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
