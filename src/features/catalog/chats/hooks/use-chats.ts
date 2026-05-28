// ──────────────────────────────────────────────
// React Query: neutral chat data hooks used by conversation, roleplay, and game.
// ──────────────────────────────────────────────
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { chatKeys } from "../query-keys";
import {
  previewGenerationPrompt,
  type PromptPreviewInput,
  type PromptPreviewResult,
} from "../../../../engine/generation/prompt-preview";
import { boolish } from "../../../../engine/generation/runtime-records";
import { backfillConversationSummaries } from "../../../../engine/modes/chat/core/summaries/auto-summary.service";
import { appendChatSummaryEntryToMetadata } from "../../../../engine/shared/text/chat-summary-entries";
import { llmApi } from "../../../../shared/api/llm-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { invokeTauri } from "../../../../shared/api/tauri-client";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { ApiError } from "../../../../shared/api/api-errors";
import { apiQueryRetryDelay, shouldRetryApiQuery } from "../../../../shared/api/query-retry";
import { createStoredZip } from "../../../../shared/lib/zip";
import {
  buildChatTranscriptZipFiles,
  chatExportFilename,
  formatChatJsonl,
  formatChatText,
  type BulkChatExportFormat,
  type ChatTranscriptExportFormat,
} from "../lib/chat-transcript-export";
import { lorebookKeys } from "../../lorebooks/query-keys";
import type {
  Chat,
  ChatMemoryChunk,
  ConversationNote,
  Message,
  MessageSwipe,
  DaySummaryEntry,
  WeekSummaryEntry,
} from "../../../../engine/contracts/types/chat";

export { chatKeys } from "../query-keys";
export type { BulkChatExportFormat, ChatTranscriptExportFormat } from "../lib/chat-transcript-export";

const RECENT_MESSAGE_CONTENT_EDIT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CHAT_MESSAGE_PAGE_SIZE = 20;

interface RecentMessageContentEdit {
  chatId: string;
  content: string;
  activeSwipeIndex: number | null;
  updatedAt: number;
}

const recentMessageContentEdits = new Map<string, RecentMessageContentEdit>();

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
  recentMessageContentEdits.set(messageId, {
    chatId,
    content,
    activeSwipeIndex: activeSwipeIndex ?? null,
    updatedAt: Date.now(),
  });
}

export function forgetRecentMessageContentEdit(chatId: string, messageId: string) {
  const edit = recentMessageContentEdits.get(messageId);
  if (edit?.chatId === chatId) {
    recentMessageContentEdits.delete(messageId);
  }
}

export function preserveRecentMessageContentEdit(chatId: string, message: Message): Message {
  pruneRecentMessageContentEdits();
  const edit = recentMessageContentEdits.get(message.id);
  if (!edit || edit.chatId !== chatId) return message;
  if (edit.activeSwipeIndex !== null && edit.activeSwipeIndex !== (message.activeSwipeIndex ?? 0)) return message;
  if (message.content === edit.content) return message;
  return { ...message, content: edit.content };
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

export interface ConversationSummaryBackfillResult {
  generatedDays: string[];
  consolidatedWeeks: string[];
  failedDays: Array<{ date: string; error: string }>;
  failedWeeks: Array<{ weekKey: string; error: string }>;
  missingDayCount: number;
  processedDayCount: number;
  remainingMissingDayCount: number;
}

const CHAT_SUMMARY_FIELDS = [
  "id",
  "name",
  "mode",
  "characterIds",
  "groupId",
  "personaId",
  "promptPresetId",
  "connectionId",
  "folderId",
  "sortOrder",
  "connectedChatId",
  "createdAt",
  "updatedAt",
  "metadata",
];

const CHAT_SUMMARY_METADATA_FIELDS = [
  "autonomousUnreadAt",
  "autonomousUnreadCharacterIds",
  "autonomousUnreadCount",
  "branchName",
  "gameId",
  "pinned",
  "tags",
];

export type ChatListItem = Pick<
  Chat,
  | "id"
  | "name"
  | "mode"
  | "characterIds"
  | "groupId"
  | "personaId"
  | "promptPresetId"
  | "connectionId"
  | "folderId"
  | "sortOrder"
  | "connectedChatId"
  | "createdAt"
  | "updatedAt"
> & {
  metadata: Partial<
    Pick<
      Chat["metadata"],
      | "autonomousUnreadAt"
      | "autonomousUnreadCharacterIds"
      | "autonomousUnreadCount"
      | "branchName"
      | "gameId"
      | "pinned"
      | "tags"
    >
  >;
};

type ChatCacheRecord = Record<string, unknown> & { id?: string; metadata?: unknown };

function updateCachedChatRows<T extends ChatCacheRecord>(
  rows: T[] | undefined,
  id: string,
  updater: (row: T) => T,
): T[] | undefined {
  if (!Array.isArray(rows)) return rows;
  let changed = false;
  const next = rows.map((row) => {
    if (!row || row.id !== id) return row;
    changed = true;
    return updater(row);
  });
  return changed ? next : rows;
}

function applyChatFieldPatch<T extends ChatCacheRecord>(chat: T, patch: Record<string, unknown>): T {
  return { ...chat, ...patch };
}

function applyChatMetadataPatch<T extends ChatCacheRecord>(chat: T, patch: Record<string, unknown>): T {
  return {
    ...chat,
    metadata: {
      ...parseRecord(chat.metadata),
      ...patch,
    },
  };
}

function setChatCacheRecord(
  qc: Pick<QueryClient, "setQueryData" | "setQueriesData">,
  id: string,
  updater: (chat: ChatCacheRecord) => ChatCacheRecord,
) {
  qc.setQueryData<ChatCacheRecord | undefined>(chatKeys.detail(id), (current) =>
    current ? updater(current) : current,
  );
  qc.setQueriesData<ChatCacheRecord[]>({ queryKey: chatKeys.list() }, (rows) =>
    updateCachedChatRows(rows, id, updater),
  );
  qc.setQueriesData<ChatCacheRecord[]>({ queryKey: [...chatKeys.all, "group"] }, (rows) =>
    updateCachedChatRows(rows, id, updater),
  );

  const activeChat = useChatStore.getState().activeChat as ChatCacheRecord | null;
  if (activeChat?.id === id) {
    useChatStore.getState().setActiveChat(updater(activeChat) as unknown as Chat);
  }
}

function cancelChatCacheQueries(qc: QueryClient, id: string) {
  // Tauri-backed reads are not abortable, so awaiting broad cache cancellation
  // can make optimistic chat-setting toggles wait behind large startup loads.
  void qc.cancelQueries({ queryKey: chatKeys.detail(id) }).catch(() => undefined);
  void qc.cancelQueries({ queryKey: chatKeys.list() }).catch(() => undefined);
  void qc.cancelQueries({ queryKey: [...chatKeys.all, "group"] }).catch(() => undefined);
}

function patchAffectsActiveLorebooks(patch: Record<string, unknown>): boolean {
  return [
    "activeLorebookIds",
    "lorebookTokenBudget",
    "lorebookKeeperTargetLorebookId",
    "gameLorebookKeeperEnabled",
    "gameLorebookKeeperLorebookId",
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => storageApi.list<Chat>("chats"),
    staleTime: 10_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => shouldRetryApiQuery(failureCount, error, { maxRetries: 10 }),
    retryDelay: (attempt, error) => apiQueryRetryDelay(attempt, error, { baseDelayMs: 750, maxDelayMs: 5_000 }),
  });
}

export function useChatSummaries() {
  return useQuery({
    queryKey: chatKeys.summaries(),
    queryFn: () =>
      storageApi.list<ChatListItem>("chats", {
        fields: CHAT_SUMMARY_FIELDS,
        fieldSelections: { metadata: CHAT_SUMMARY_METADATA_FIELDS },
      }),
    staleTime: 10_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => shouldRetryApiQuery(failureCount, error, { maxRetries: 10 }),
    retryDelay: (attempt, error) => apiQueryRetryDelay(attempt, error, { baseDelayMs: 750, maxDelayMs: 5_000 }),
  });
}

export function useRecentChatSummaries(limit = 3) {
  return useQuery({
    queryKey: chatKeys.recentSummaries(limit),
    queryFn: () =>
      storageApi.list<ChatListItem>("chats", {
        fields: CHAT_SUMMARY_FIELDS,
        fieldSelections: { metadata: CHAT_SUMMARY_METADATA_FIELDS },
        orderBy: "updatedAt",
        descending: true,
        limit,
      }),
    staleTime: 10_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () =>
      storageApi.get<Chat>("chats", id!, { fields: CHAT_SUMMARY_FIELDS }).then((chat) => {
        if (!chat) throw new ApiError("Chat not found", 404);
        return chat;
      }),
    enabled: !!id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatMessages(
  chatId: string | null,
  pageSize: number = DEFAULT_CHAT_MESSAGE_PAGE_SIZE,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(chatId ?? ""),
    queryFn: ({ pageParam, signal }) => {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      return storageApi
        .listChatMessages<Message>(chatId!, {
          ...(pageSize > 0 ? { limit: pageSize } : {}),
          ...(pageParam ? { before: pageParam } : {}),
        })
        .then((messages) =>
          chatId ? messages.map((message) => preserveRecentMessageContentEdit(chatId, message)) : messages,
        );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (pageSize <= 0 || lastPage.length < pageSize) return undefined;
      const oldestLoaded = lastPage[0];
      if (!oldestLoaded) return undefined;
      const createdAt = String(oldestLoaded.createdAt ?? "");
      const id = String(oldestLoaded.id ?? "");
      return id ? `${createdAt}|${id}` : createdAt;
    },
    enabled: !!chatId && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatMessageCount(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messageCount(chatId ?? ""),
    queryFn: () => invokeTauri<{ count: number }>("chat_message_count", { chatId }),
    enabled: !!chatId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatMemories(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: chatKeys.memories(chatId ?? ""),
    queryFn: () => invokeTauri<ChatMemoryChunk[]>("chat_memories_list", { chatId }),
    enabled: !!chatId && enabled,
    staleTime: 10_000,
  });
}

export function useDeleteChatMemory(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => invokeTauri("chat_memory_delete", { chatId, memoryId }),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useClearChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokeTauri("chat_memories_clear", { chatId }),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useRefreshChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokeTauri<{ rebuilt: number }>("chat_memories_refresh", { chatId }),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useExportChatMemories(chatId: string | null) {
  return useMutation({
    mutationFn: async () => {
      if (!chatId) throw new Error("No chat selected.");
      const payload = await invokeTauri("chat_memories_export", { chatId });
      downloadTextFile(
        JSON.stringify(payload, null, 2),
        "memory-recall.marinara.json",
        "application/json;charset=utf-8",
      );
    },
  });
}

export type ChatMemoryRecallImportResult = {
  imported: number;
  skipped: number;
};

export function useImportChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!chatId) throw new Error("No chat selected.");
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      return invokeTauri<ChatMemoryRecallImportResult>("chat_memories_import", { chatId, body: payload });
    },
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useChatNotes(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.notes(chatId ?? ""),
    queryFn: () => invokeTauri<ConversationNote[]>("chat_notes_list", { chatId }),
    enabled: !!chatId,
    staleTime: 10_000,
  });
}

export function useDeleteChatNote(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => invokeTauri("chat_note_delete", { chatId, noteId }),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.notes(chatId) });
    },
  });
}

export function useClearChatNotes(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => invokeTauri("chat_notes_clear", { chatId }),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.notes(chatId) });
    },
  });
}

export function useChatGroup(groupId: string | null) {
  return useQuery({
    queryKey: chatKeys.group(groupId ?? ""),
    queryFn: () => storageApi.list<Chat>("chats", { filters: { groupId } }),
    enabled: !!groupId,
  });
}

type DeleteChatInput = string | { id: string; groupId?: string | null };

function getDeleteChatId(input: DeleteChatInput) {
  return typeof input === "string" ? input : input.id;
}

function getDeleteChatGroupId(input: DeleteChatInput) {
  return typeof input === "string" ? null : (input.groupId ?? null);
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
      promptPresetId?: string | null;
    }) => storageApi.create<Chat>("chats", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.summaries() });
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteChatInput) => storageApi.delete("chats", getDeleteChatId(input)),
    onMutate: async (input) => {
      const id = getDeleteChatId(input);
      const providedGroupId = getDeleteChatGroupId(input);
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      if (providedGroupId) {
        await qc.cancelQueries({ queryKey: chatKeys.group(providedGroupId) });
      }
      await qc.cancelQueries({ queryKey: chatKeys.summaries() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      const previousSummaries = qc.getQueriesData<ChatListItem[]>({ queryKey: chatKeys.summaries() });
      const previousGroup = providedGroupId ? qc.getQueryData<Chat[]>(chatKeys.group(providedGroupId)) : undefined;
      const deletedChat =
        previous?.find((c) => c.id === id) ??
        previousGroup?.find((c) => c.id === id) ??
        previousSummaries.flatMap(([, rows]) => rows ?? []).find((c) => c.id === id) ??
        null;
      const groupId = deletedChat?.groupId ?? providedGroupId;

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.id !== id));
      qc.setQueriesData<ChatListItem[]>({ queryKey: chatKeys.summaries() }, (old) => old?.filter((c) => c.id !== id));

      if (groupId) {
        qc.setQueryData<Chat[]>(chatKeys.group(groupId), (old) => old?.filter((c) => c.id !== id));
      }

      return { previous, previousSummaries, previousGroup, groupId };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(chatKeys.list(), context.previous);
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.list() });
      }
      for (const [queryKey, data] of context?.previousSummaries ?? []) {
        qc.setQueryData(queryKey, data);
      }
      if (context?.groupId) {
        if (context.previousGroup) {
          qc.setQueryData(chatKeys.group(context.groupId), context.previousGroup);
        } else {
          qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
        }
      }
    },
    onSettled: (_data, _err, input, context) => {
      const groupId = context?.groupId ?? getDeleteChatGroupId(input);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.summaries() });
      if (groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(groupId) });
      }
    },
  });
}

export function useDeleteChatGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => invokeTauri("chat_group_delete", { groupId }),
    onMutate: async (groupId) => {
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.groupId !== groupId));
      qc.setQueryData<Chat[]>(chatKeys.group(groupId), []);

      return { previous, groupId };
    },
    onError: (_err, _groupId, context) => {
      if (context?.previous) qc.setQueryData(chatKeys.list(), context.previous);
      if (context?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
      }
    },
    onSettled: (_data, _err, _groupId, context) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
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
      characterIds?: string[];
    }) => storageApi.update<Chat>("chats", id, data),
    onMutate: ({ id, ...data }) => {
      cancelChatCacheQueries(qc, id);
      const previousDetail = qc.getQueryData<ChatCacheRecord>(chatKeys.detail(id));
      const previousListQueries = qc.getQueriesData<ChatCacheRecord[]>({ queryKey: chatKeys.list() });
      const previousGroupQueries = qc.getQueriesData<ChatCacheRecord[]>({ queryKey: [...chatKeys.all, "group"] });
      const previousActiveChat = useChatStore.getState().activeChat;

      setChatCacheRecord(qc, id, (chat) => applyChatFieldPatch(chat, data));

      return { previousDetail, previousListQueries, previousGroupQueries, previousActiveChat };
    },
    onError: (_error, vars, context) => {
      if (context?.previousDetail) qc.setQueryData(chatKeys.detail(vars.id), context.previousDetail);
      for (const [queryKey, data] of context?.previousListQueries ?? []) qc.setQueryData(queryKey, data);
      for (const [queryKey, data] of context?.previousGroupQueries ?? []) qc.setQueryData(queryKey, data);
      if (context?.previousActiveChat) useChatStore.getState().setActiveChat(context.previousActiveChat);
    },
    onSuccess: (updatedChat, vars) => {
      if (updatedChat) {
        qc.setQueryData(chatKeys.detail(vars.id), updatedChat);
        setChatCacheRecord(qc, vars.id, (chat) => applyChatFieldPatch(chat, vars));
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
      }

      // Patch the group cache so the branch selector dropdown reflects renames
      // (and any other field changes) without waiting for a chat switch.
      if (updatedChat?.groupId) {
        qc.setQueryData<Chat[]>(chatKeys.group(updatedChat.groupId), (existing) =>
          existing?.map((chat) => (chat.id === vars.id ? updatedChat : chat)),
        );
      }
      if ("characterIds" in vars || "personaId" in vars || "promptPresetId" in vars || "connectionId" in vars) {
        qc.invalidateQueries({ queryKey: lorebookKeys.active(vars.id) });
      }
    },
  });
}

export function useUpdateChatMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...metadata }: { id: string; [key: string]: unknown }) =>
      storageApi.patchChatMetadata<Chat>(id, metadata),
    onMutate: ({ id, ...metadata }) => {
      cancelChatCacheQueries(qc, id);
      const previousDetail = qc.getQueryData<ChatCacheRecord>(chatKeys.detail(id));
      const previousListQueries = qc.getQueriesData<ChatCacheRecord[]>({ queryKey: chatKeys.list() });
      const previousGroupQueries = qc.getQueriesData<ChatCacheRecord[]>({ queryKey: [...chatKeys.all, "group"] });
      const previousActiveChat = useChatStore.getState().activeChat;

      setChatCacheRecord(qc, id, (chat) => applyChatMetadataPatch(chat, metadata));

      return { previousDetail, previousListQueries, previousGroupQueries, previousActiveChat };
    },
    onError: (_error, vars, context) => {
      if (context?.previousDetail) qc.setQueryData(chatKeys.detail(vars.id), context.previousDetail);
      for (const [queryKey, data] of context?.previousListQueries ?? []) qc.setQueryData(queryKey, data);
      for (const [queryKey, data] of context?.previousGroupQueries ?? []) qc.setQueryData(queryKey, data);
      if (context?.previousActiveChat) useChatStore.getState().setActiveChat(context.previousActiveChat);
    },
    onSuccess: (data, vars) => {
      const { id, ...metadata } = vars;
      // Write the saved response straight into the detail cache. Plain
      // invalidation alone leaves stale data in place when no observer is
      // mounted to trigger a refetch (e.g. user navigated away after firing
      // the mutation), causing later renders to re-read the pre-mutation
      // value — which is what made cleared chat backgrounds reappear after
      // a chat switch round-trip.
      if (data) {
        qc.setQueryData(chatKeys.detail(id), data);
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.detail(id) });
      }
      setChatCacheRecord(qc, id, (chat) => applyChatMetadataPatch(chat, metadata));
      if (patchAffectsActiveLorebooks(metadata)) qc.invalidateQueries({ queryKey: lorebookKeys.active(id) });
    },
  });
}

export function useMarkAutonomousUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, characterId, count }: { chatId: string; characterId?: string | null; count?: number }) =>
      invokeTauri<Chat>("chat_autonomous_unread_mark", { chatId, body: { characterId: characterId ?? null, count } }),
    onSuccess: (data, vars) => {
      if (data) {
        qc.setQueryData(chatKeys.detail(vars.chatId), data);
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useClearAutonomousUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => invokeTauri<Chat>("chat_autonomous_unread_clear", { chatId }),
    onSuccess: (data, chatId) => {
      if (data) {
        qc.setQueryData(chatKeys.detail(chatId), data);
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
    }) => storageApi.patchChatSummaries<Chat>(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
    },
  });
}

/** Backfill missing conversation day/week summaries via the LLM. */
export function useBackfillConversationSummaries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, maxMissingDays }: { chatId: string; maxMissingDays?: number }) =>
      backfillConversationSummaries({ storage: storageApi, llm: llmApi }, { chatId, maxMissingDays }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.chatId) });
    },
  });
}

export function useCreateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: string; content: string; characterId?: string | null }) =>
      storageApi.createChatMessage<Message>(chatId!, data),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
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
    mutationFn: (messageId: string) => storageApi.deleteChatMessage(messageId),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) });
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });
      }
    },
  });
}

export function useDeleteMessages(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageIds: string[]) => invokeTauri("chat_messages_bulk_delete", { chatId, messageIds }),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) });
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
      storageApi.updateChatMessage<Message>(messageId, { content }),
    onMutate: ({ messageId, content }) => {
      if (!chatId) return;
      // Do not block the optimistic edit on slow in-flight message refetches.
      // The recent edit overlay below keeps stale refetches from flashing over it.
      void qc
        .cancelQueries({ queryKey: chatKeys.messages(chatId) })
        .catch((error) => console.warn("Failed to cancel stale message refetch before edit.", error));
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const previousMessage = findCachedMessage(previous, messageId);
      rememberRecentMessageContentEdit(chatId, messageId, content, previousMessage?.activeSwipeIndex);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => page.map((msg) => (msg.id === messageId ? { ...msg, content } : msg))),
        };
      });
      return { previous };
    },
    onSuccess: (updated, { messageId, content }) => {
      if (chatId) {
        rememberRecentMessageContentEdit(chatId, messageId, updated?.content ?? content, updated?.activeSwipeIndex);
      }
    },
    onError: (_err, _vars, context) => {
      if (chatId) {
        forgetRecentMessageContentEdit(chatId, _vars.messageId);
      }
      if (chatId && context?.previous) {
        qc.setQueryData(chatKeys.messages(chatId), context.previous);
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
      storageApi.patchChatMessageExtra<Message>(messageId, extra),
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

export function useBulkSetMessagesHiddenFromAI(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageIds, hidden }: { messageIds: string[]; hidden: boolean }) => {
      if (!chatId) throw new Error("Chat was not found.");
      const uniqueIds = Array.from(new Set(messageIds.filter((id) => id.trim().length > 0)));
      await Promise.all(
        uniqueIds.map(async (messageId) => {
          const message = await storageApi.get<Message>("messages", messageId);
          if (!message || message.chatId !== chatId) return null;
          return storageApi.patchChatMessageExtra<Message>(messageId, { hiddenFromAI: hidden, hiddenFromAi: hidden });
        }),
      );
      return { updated: uniqueIds.length };
    },
    onMutate: async ({ messageIds, hidden }) => {
      if (!chatId) return;
      await qc.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const idSet = new Set(messageIds);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((msg) => {
              if (!idSet.has(msg.id)) return msg;
              return {
                ...msg,
                extra: {
                  ...parseRecord(msg.extra),
                  hiddenFromAI: hidden,
                  hiddenFromAi: hidden,
                } as unknown as Message["extra"],
              };
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
  for (let pageIndex = 0; pageIndex < old.pages.length; pageIndex += 1) {
    const page = old.pages[pageIndex];
    if (!page) continue;
    const messageIndex = page.findIndex((msg) => msg.id === messageId);
    if (messageIndex < 0) continue;
    const nextPage = page.slice();
    nextPage[messageIndex] = updater(page[messageIndex]!);
    const pages = old.pages.slice();
    pages[pageIndex] = nextPage;
    return { ...old, pages };
  }
  return old;
}

function messageWithOptimisticActiveSwipe(message: Message, requestedIndex: number): Message {
  const rawSwipes = (message as Message & { swipes?: unknown }).swipes;
  const swipes = Array.isArray(rawSwipes) ? rawSwipes : [];
  const swipeCount =
    typeof message.swipeCount === "number" && Number.isFinite(message.swipeCount) && message.swipeCount > 0
      ? Math.floor(message.swipeCount)
      : swipes.length;
  const normalizedRequestedIndex = Number.isFinite(requestedIndex) ? Math.floor(requestedIndex) : 0;
  const activeSwipeIndex = Math.min(Math.max(normalizedRequestedIndex, 0), Math.max(swipeCount - 1, 0));
  const swipe = swipes[activeSwipeIndex];
  const swipeContent =
    swipe &&
    typeof swipe === "object" &&
    !Array.isArray(swipe) &&
    typeof (swipe as { content?: unknown }).content === "string"
      ? (swipe as { content: string }).content
      : null;
  const swipeExtra =
    swipe &&
    typeof swipe === "object" &&
    !Array.isArray(swipe) &&
    Object.prototype.hasOwnProperty.call(swipe, "extra")
      ? parseRecord((swipe as { extra?: unknown }).extra)
      : null;
  const nextExtra = swipeExtra
    ? extraForActiveSwipe(message.extra, swipeExtra)
    : swipeCount > 1
      ? extraForActiveSwipe(message.extra, {})
      : null;

  return {
    ...message,
    activeSwipeIndex,
    swipeCount: swipeCount || message.swipeCount,
    content: swipeContent ?? message.content,
    ...(nextExtra ? { extra: nextExtra as unknown as Message["extra"] } : {}),
  };
}

const SWIPE_SCOPED_EXTRA_KEYS = new Set([
  "displayText",
  "isGenerated",
  "tokenCount",
  "generationInfo",
  "thinking",
  "spriteExpressions",
  "cyoaChoices",
  "contextInjections",
  "chatSummaryFingerprint",
  "cachedPrompt",
  "generationReplay",
  "attachments",
  "reasoning",
  "reasoning_content",
]);

function extraForActiveSwipe(baseExtra: unknown, swipeExtra: Record<string, unknown>): Record<string, unknown> {
  const next = parseRecord(baseExtra);
  for (const key of SWIPE_SCOPED_EXTRA_KEYS) {
    delete next[key];
  }
  for (const key of SWIPE_SCOPED_EXTRA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(swipeExtra, key)) {
      next[key] = swipeExtra[key];
    }
  }
  return next;
}

function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  downloadBlobFile(blob, filename);
}

function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function messageHiddenFromAi(message: Message) {
  const extra = parseRecord(message.extra);
  return extra.hiddenFromAI === true || extra.hiddenFromAi === true;
}

export type GenerateSummaryInput = {
  chatId: string;
  contextSize?: number;
  rangeStartIndex?: number;
  rangeEndIndex?: number;
};

export type GenerateSummaryResult = {
  summary: string;
  messageIds: string[];
};

function compactTranscript(messages: Message[]) {
  return messages
    .map((message, index) => {
      const role = message.role === "assistant" ? "Assistant" : message.role === "system" ? "System" : "User";
      return `[${index + 1}] ${role}: ${(message.content ?? "").trim()}`;
    })
    .join("\n\n");
}

async function resolveSummaryConnectionId(chat: Chat): Promise<string> {
  if (typeof chat.connectionId === "string" && chat.connectionId.trim()) return chat.connectionId.trim();
  const connections = await storageApi.list<Record<string, unknown>>("connections");
  const selected =
    connections.find((connection) => boolish(connection.isDefault, false) || boolish(connection.default, false)) ??
    connections[0];
  const connectionId = typeof selected?.id === "string" ? selected.id.trim() : "";
  if (!connectionId) throw new Error("No API connection configured for summary generation.");
  return connectionId;
}

async function generateLlmChatSummary(input: GenerateSummaryInput): Promise<GenerateSummaryResult> {
  const { chatId, contextSize, rangeStartIndex, rangeEndIndex } = input;
  const [chat, allMessages] = await Promise.all([
    storageApi.get<Chat>("chats", chatId),
    storageApi.listChatMessages<Message>(chatId),
  ]);
  if (!chat) throw new Error("Chat was not found.");
  const storedContextSize = Number((chat.metadata as { summaryContextSize?: unknown } | null)?.summaryContextSize);
  const limit = Math.max(
    5,
    Math.min(200, Math.trunc(contextSize ?? (Number.isFinite(storedContextSize) ? storedContextSize : 50))),
  );
  const hasRange = Number.isInteger(rangeStartIndex) && Number.isInteger(rangeEndIndex);
  const rangeLow = hasRange ? Math.max(1, Math.min(rangeStartIndex!, rangeEndIndex!)) : null;
  const rangeHigh = hasRange ? Math.max(rangeStartIndex!, rangeEndIndex!) : null;
  if (hasRange) {
    if (!rangeLow || !rangeHigh || rangeHigh > allMessages.length) {
      throw new Error("Summary range is outside this chat's message history.");
    }
    if (rangeHigh - rangeLow + 1 > 200) {
      throw new Error("Summary ranges cannot include more than 200 messages.");
    }
  }
  const sourceMessages = hasRange
    ? allMessages.slice(rangeLow! - 1, rangeHigh ?? undefined)
    : allMessages.slice(-limit);
  const selected = sourceMessages.filter((message) => !messageHiddenFromAi(message) && !!message.content?.trim());
  if (selected.length === 0) throw new Error("No non-hidden messages available for the requested summary.");

  const connectionId = await resolveSummaryConnectionId(chat);
  const transcript = compactTranscript(selected);
  const rawSummary = await llmApi.complete({
    connectionId,
    messages: [
      {
        role: "system",
        content:
          "Summarize the provided chat transcript for future roleplay/conversation context. Preserve durable facts, relationships, goals, decisions, unresolved threads, and emotional state. Do not add new events.",
      },
      {
        role: "user",
        content: `Create a concise but useful memory summary from this transcript:\n\n${transcript}`,
      },
    ],
    parameters: { temperature: 0.2, maxTokens: 700 },
  });
  const content = rawSummary.trim();
  if (!content) throw new Error("Summary generation returned an empty response.");

  const metadata = parseRecord(chat.metadata);
  const now = new Date().toISOString();
  const appended = appendChatSummaryEntryToMetadata(
    metadata,
    {
      content,
      origin: "manual",
      sourceMode: hasRange ? "range" : "last",
      title: hasRange ? `Summary messages ${rangeLow}-${rangeHigh}` : "Summary of recent messages",
      messageCount: hasRange ? undefined : selected.length,
      rangeStartIndex: rangeLow ?? undefined,
      rangeEndIndex: rangeHigh ?? undefined,
      messageIds: selected.map((message) => message.id),
    },
    {
      now,
      createId: () =>
        globalThis.crypto?.randomUUID ? `summary-${globalThis.crypto.randomUUID()}` : `summary-${Date.now()}`,
    },
  );

  await storageApi.patchChatMetadata(chatId, {
    summary: appended.summary,
    summaryEntries: appended.entries,
    summaryContextSize: limit,
  });
  return { summary: appended.summary ?? content, messageIds: selected.map((message) => message.id) };
}

/** Peek at the assembled prompt for a chat */
export function usePeekPrompt() {
  return useMutation({
    mutationFn: (input: string | PromptPreviewInput): Promise<PromptPreviewResult> => {
      const request: PromptPreviewInput = typeof input === "string" ? { chatId: input } : input;
      return previewGenerationPrompt(storageApi, request);
    },
  });
}

/** Export a chat as JSONL or plain text */
export function useExportChat() {
  return useMutation({
    mutationFn: async ({ chatId, format = "jsonl" }: { chatId: string; format?: ChatTranscriptExportFormat }) => {
      const [chat, messages] = await Promise.all([
        storageApi.get<Chat>("chats", chatId).then((chat) => {
          if (!chat) throw new Error("Chat was not found.");
          return chat;
        }),
        storageApi.listChatMessages<Message>(chatId),
      ]);
      const filename = chatExportFilename(chat, format);
      if (format === "text") {
        downloadTextFile(formatChatText(messages), filename, "text/plain;charset=utf-8");
      } else {
        downloadTextFile(formatChatJsonl(messages), filename, "application/x-ndjson;charset=utf-8");
      }
    },
  });
}

async function loadChatsForExport(chatIds: string[]) {
  const ids = Array.from(new Set(chatIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) throw new Error("Choose at least one chat to export.");
  return Promise.all(
    ids.map(async (chatId) => {
      const [chat, messages] = await Promise.all([
        storageApi.get<Chat>("chats", chatId).then((chat) => {
          if (!chat) throw new Error("Chat was not found.");
          return chat;
        }),
        storageApi.listChatMessages<Message>(chatId),
      ]);
      return { chat, messages };
    }),
  );
}

/** Export selected chats as native JSON or a ZIP of JSONL/text transcripts. */
export function useBulkExportChats() {
  return useMutation({
    mutationFn: async ({
      chatIds,
      format = "native",
      scope = "selected",
    }: {
      chatIds?: string[];
      format?: BulkChatExportFormat;
      scope?: "selected" | "all";
    }) => {
      const exportIds =
        scope === "all" ? (await storageApi.list<Chat>("chats")).map((chat) => chat.id) : (chatIds ?? []);
      const chats = await loadChatsForExport(exportIds);
      const exportedAt = new Date().toISOString();
      if (format === "jsonl" || format === "text") {
        const files = buildChatTranscriptZipFiles(chats, format);
        downloadBlobFile(createStoredZip(files), `chat-transcripts-${format}-${exportedAt.slice(0, 10)}.zip`);
        return;
      }

      downloadTextFile(
        JSON.stringify(
          {
            format: "marinara-chat-bulk",
            version: 1,
            exportedAt,
            count: chats.length,
            chats,
          },
          null,
          2,
        ),
        `marinara-chats-${exportedAt.slice(0, 10)}.json`,
        "application/json;charset=utf-8",
      );
    },
  });
}

/** Create a branch (copy) of an existing chat */
export function useBranchChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, upToMessageId }: { chatId: string; upToMessageId?: string }) =>
      invokeTauri<Chat>("chat_branch", { chatId, upToMessageId: upToMessageId ?? null }),
    onSuccess: (newChat, { chatId }) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });

      if (newChat?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(newChat.groupId) });
      }

      if (newChat) {
        qc.setQueryData(chatKeys.detail(newChat.id), newChat);
      }
    },
  });
}

/** Generate a rolling summary for a chat via the LLM */
export function useGenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateSummaryInput) => generateLlmChatSummary(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.chatId) });
    },
  });
}

/** Fetch swipes for a message */
export function useSwipes(chatId: string | null, messageId: string | null) {
  return useQuery({
    queryKey: [...chatKeys.all, "swipes", messageId ?? ""],
    queryFn: () => invokeTauri<MessageSwipe[]>("chat_message_swipes", { chatId, messageId }),
    enabled: !!chatId && !!messageId,
  });
}

/** Set the active swipe for a message */
export function useSetActiveSwipe(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      invokeTauri<Message | null>("chat_message_set_active_swipe", { chatId, messageId, index }),
    onMutate: ({ messageId, index }) => {
      if (!chatId) return;
      void qc.cancelQueries({ queryKey: chatKeys.messages(chatId), exact: true });
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        replaceCachedMessage(old, messageId, (msg) => messageWithOptimisticActiveSwipe(msg, index)),
      );
      return { previous };
    },
    onSuccess: (updated, { messageId, index }) => {
      if (!chatId) return;
      const current = findCachedMessage(qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId)), messageId);
      if (current && current.activeSwipeIndex !== index) return;
      if (!updated) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        return;
      }
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        replaceCachedMessage(old, messageId, (msg) => ({ ...msg, ...updated })),
      );
    },
    onError: (_err, { messageId, index }, context) => {
      if (chatId && context?.previous) {
        const current = findCachedMessage(
          qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId)),
          messageId,
        );
        if (current && current.activeSwipeIndex !== index) return;
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
      invokeTauri<Message>("chat_message_delete_swipe", { chatId, messageId, index: String(index) }),
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
      invokeTauri<{ connected: boolean }>("chat_connect", { chatId, targetChatId }),
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
    mutationFn: (chatId: string) => invokeTauri<{ disconnected: boolean }>("chat_disconnect", { chatId }),
    onSuccess: (_data, chatId) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
