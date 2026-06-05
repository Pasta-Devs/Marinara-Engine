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
import { toast } from "sonner";
import { chatKeys } from "../query-keys";
import {
  previewGenerationPrompt,
  type PromptPreviewInput,
  type PromptPreviewResult,
} from "../../../../engine/generation/prompt-preview";
import { createMessageSchema, summariesPatchSchema } from "../../../../engine/contracts/schemas/chat.schema";
import { getDefaultAgentPrompt } from "../../../../engine/contracts/constants/agent-prompts";
import { boolish } from "../../../../engine/generation/runtime-records";
import { backfillConversationSummaries } from "../../../../engine/modes/chat/core/summaries/auto-summary.service";
import { appendChatSummaryEntryToMetadata } from "../../../../engine/shared/text/chat-summary-entries";
import { chatCommandApi } from "../../../../shared/api/chat-command-api";
import { llmApi } from "../../../../shared/api/llm-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { visualAssetsApi } from "../../../../shared/api/visual-assets-api";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { ApiError } from "../../../../shared/api/api-errors";
import { getExportErrorMessage } from "../../../shared/lib/export-feedback";
import {
  chatExportFilename,
  formatChatJsonl,
  formatChatText,
  type ChatTranscriptExportFormat,
} from "../lib/chat-transcript-export";
import { downloadTextFile } from "../lib/download";
import { sanitizeTimelineMessage, timelineMessageProjection } from "../lib/timeline-message";
import { lorebookKeys } from "../../lorebooks/query-keys";
import { CHAT_SUMMARY_FIELDS } from "./use-chat-summaries";
import { applyChatFieldPatch, cancelChatCacheQueries, setChatCacheRecord, type ChatCacheRecord } from "./chat-cache";
import type {
  Chat,
  ChatMemoryChunk,
  ConversationNote,
  Message,
  ChatSummaryPromptTemplate,
  DaySummaryEntry,
  WeekSummaryEntry,
} from "../../../../engine/contracts/types/chat";
import type {
  ChatMemoryRecallExportPayload,
  ChatMemoryRecallImportResult,
  ExportEnvelope,
} from "../../../../engine/contracts/types/export";

export { chatKeys } from "../query-keys";
export { useCreateChat, useDeleteChat, useDeleteChatGroup, useUpdateChatMetadata } from "./use-chat-lifecycle";
export { useChatSummaries, useRecentChatSummaries } from "./use-chat-summaries";
export type { ChatListItem } from "./use-chat-summaries";
export type { ChatTranscriptExportFormat } from "../lib/chat-transcript-export";

const RECENT_MESSAGE_CONTENT_EDIT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CHAT_MESSAGE_PAGE_SIZE = 20;
const MAX_MEMORY_RECALL_IMPORT_BYTES = 25 * 1024 * 1024;
const scheduledDeleteRefreshTimers = new Map<string, number>();
let optimisticMessageSequence = 0;

type MessageCountResult = { count: number };

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

function scheduleDeleteRefresh(qc: QueryClient, chatId: string) {
  const previous = scheduledDeleteRefreshTimers.get(chatId);
  if (previous) window.clearTimeout(previous);
  const timer = window.setTimeout(() => {
    scheduledDeleteRefreshTimers.delete(chatId);
    void Promise.all([
      qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
      qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) }),
      qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) }),
    ]).catch((error) => console.warn("[chats] message delete refresh failed", error));
  }, 75);
  scheduledDeleteRefreshTimers.set(chatId, timer);
}

function findCachedMessage(data: InfiniteData<Message[]> | undefined, messageId: string): Message | null {
  if (!data?.pages) return null;
  for (const page of data.pages) {
    const found = page.find((message) => message.id === messageId);
    if (found) return found;
  }
  return null;
}

function removeCachedMessages(
  old: InfiniteData<Message[]> | undefined,
  messageIds: Set<string>,
): InfiniteData<Message[]> | undefined {
  if (!old?.pages || messageIds.size === 0) return old;
  let changed = false;
  const pages = old.pages.map((page) => {
    const next = page.filter((message) => !messageIds.has(message.id));
    if (next.length !== page.length) changed = true;
    return next;
  });
  return changed ? { ...old, pages } : old;
}

function appendCachedMessage(
  old: InfiniteData<Message[]> | undefined,
  message: Message,
): InfiniteData<Message[]> | undefined {
  if (!old?.pages?.length) return old;
  for (const page of old.pages) {
    if (page.some((cached) => cached.id === message.id)) return old;
  }
  return {
    ...old,
    pages: old.pages.map((page, index) => (index === 0 ? [...page, message] : page)),
  };
}

function optimisticChatMessage(
  chatId: string,
  data: { role: string; content: string; characterId?: string | null },
): Message {
  optimisticMessageSequence += 1;
  return {
    id: `__optimistic_create_${Date.now()}_${optimisticMessageSequence}`,
    chatId,
    role: data.role as Message["role"],
    characterId: data.characterId ?? null,
    content: data.content,
    activeSwipeIndex: 0,
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
    },
    createdAt: new Date().toISOString(),
  };
}

function replaceOptimisticCreatedMessage(
  old: InfiniteData<Message[]> | undefined,
  optimisticId: string | null | undefined,
  saved: Message,
): InfiniteData<Message[]> | undefined {
  if (!optimisticId) return appendCachedMessage(old, saved);
  const replaced = replaceCachedMessage(old, optimisticId, () => saved);
  return replaced === old ? appendCachedMessage(old, saved) : replaced;
}

function updateCachedMessageCount(qc: QueryClient, chatId: string, delta: number) {
  qc.setQueryData<MessageCountResult | undefined>(chatKeys.messageCount(chatId), (current) => {
    if (!current || typeof current.count !== "number") return current;
    return { ...current, count: Math.max(0, current.count + delta) };
  });
}

function deletedCountFromResult(result: unknown): number | null {
  if (!result || typeof result !== "object" || !("deleted" in result)) return null;
  const deleted = (result as { deleted?: unknown }).deleted;
  if (typeof deleted === "boolean") return deleted ? 1 : 0;
  if (typeof deleted === "number" && Number.isFinite(deleted)) return Math.max(0, Math.floor(deleted));
  return null;
}

function assertDeletedMessages(result: unknown, expectedCount: number) {
  const deletedCount = deletedCountFromResult(result);
  if (deletedCount !== null && deletedCount < expectedCount) {
    throw new Error(expectedCount === 1 ? "Message was not found." : "Some selected messages were not found.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMemoryRecallExportEnvelope(value: unknown): value is ExportEnvelope<ChatMemoryRecallExportPayload> {
  if (!isRecord(value) || value.type !== "marinara_memory_recall" || value.version !== 1) return false;
  const data = value.data;
  return isRecord(data) && Array.isArray(data.chunks);
}

async function readChatMemoryRecallImportFile(
  file: File,
): Promise<ExportEnvelope<ChatMemoryRecallExportPayload>> {
  if (file.size > MAX_MEMORY_RECALL_IMPORT_BYTES) {
    throw new Error("Memory Recall import is too large. Choose a file under 25 MB.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error("Memory Recall import must be valid JSON.");
  }

  if (!isMemoryRecallExportEnvelope(payload)) {
    throw new Error("Choose a Memory Recall export from Marinara Engine.");
  }

  return payload;
}

function rememberRecentMessageContentEdit(
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

function forgetRecentMessageContentEdit(chatId: string, messageId: string) {
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

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () =>
      storageApi.get<Chat>("chats", id!, { fields: [...CHAT_SUMMARY_FIELDS] }).then((chat) => {
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
          ...timelineMessageProjection({
            ...(pageSize > 0 ? { limit: pageSize } : {}),
            ...(pageParam ? { before: pageParam } : {}),
          }),
        })
        .then((messages) =>
          chatId
            ? messages.map((message) => preserveRecentMessageContentEdit(chatId, sanitizeTimelineMessage(message)))
            : messages.map(sanitizeTimelineMessage),
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
    queryFn: () => chatCommandApi.messageCount(chatId),
    enabled: !!chatId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatMemories(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: chatKeys.memories(chatId ?? ""),
    queryFn: () => chatCommandApi.memoriesList<ChatMemoryChunk[]>(chatId),
    enabled: !!chatId && enabled,
    staleTime: 10_000,
  });
}

export function useDeleteChatMemory(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => chatCommandApi.memoryDelete(chatId, memoryId),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useClearChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chatCommandApi.memoriesClear(chatId),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useRefreshChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chatCommandApi.memoriesRefresh<{ rebuilt: number }>(chatId),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useExportChatMemories(chatId: string | null) {
  return useMutation({
    mutationFn: async () => {
      if (!chatId) throw new Error("No chat selected.");
      const payload = await chatCommandApi.memoriesExport(chatId);
      downloadTextFile(
        JSON.stringify(payload, null, 2),
        "memory-recall.marinara.json",
        "application/json;charset=utf-8",
      );
    },
  });
}

export function useImportChatMemories(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!chatId) throw new Error("No chat selected.");
      const payload = await readChatMemoryRecallImportFile(file);
      return chatCommandApi.memoriesImport<ChatMemoryRecallImportResult>(chatId, payload);
    },
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.memories(chatId) });
    },
  });
}

export function useChatNotes(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.notes(chatId ?? ""),
    queryFn: () => chatCommandApi.notesList<ConversationNote[]>(chatId),
    enabled: !!chatId,
    staleTime: 10_000,
  });
}

export function useDeleteChatNote(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => chatCommandApi.noteDelete(chatId, noteId),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.notes(chatId) });
    },
  });
}

export function useClearChatNotes(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chatCommandApi.notesClear(chatId),
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
    }) => storageApi.patchChatSummaries<Chat>(id, summariesPatchSchema.parse(body)),
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
    mutationFn: (data: { role: string; content: string; characterId?: string | null }) => {
      const payload = createMessageSchema.parse({ chatId: chatId!, ...data });
      return storageApi.createChatMessage<Message>(payload.chatId, payload);
    },
    onMutate: (data) => {
      if (!chatId) return;
      const previousMessages = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const previousCount = qc.getQueryData<MessageCountResult>(chatKeys.messageCount(chatId));
      const optimistic = optimisticChatMessage(chatId, data);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        appendCachedMessage(old, optimistic),
      );
      updateCachedMessageCount(qc, chatId, 1);
      return { previousMessages, previousCount, optimisticId: optimistic.id };
    },
    onError: (_error, _data, context) => {
      if (!chatId) return;
      if (context?.previousMessages) qc.setQueryData(chatKeys.messages(chatId), context.previousMessages);
      if (context?.previousCount) qc.setQueryData(chatKeys.messageCount(chatId), context.previousCount);
    },
    onSuccess: (created, _data, context) => {
      if (chatId) {
        qc.setQueryData<InfiniteData<Message[]> | undefined>(chatKeys.messages(chatId), (old) =>
          created
            ? replaceOptimisticCreatedMessage(
                old,
                context?.optimisticId,
                preserveRecentMessageContentEdit(chatId, sanitizeTimelineMessage(created)),
              )
            : old,
        );
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
    mutationFn: async (messageId: string) => {
      if (!chatId) throw new Error("Chat was not found.");
      const result = await chatCommandApi.bulkDeleteMessages(chatId, [messageId]);
      assertDeletedMessages(result, 1);
      return result;
    },
    onMutate: (messageId: string) => {
      if (!chatId) return;
      void qc.cancelQueries({ queryKey: chatKeys.messages(chatId), exact: true }).catch(() => undefined);
      const previousMessages = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const previousCount = qc.getQueryData<MessageCountResult>(chatKeys.messageCount(chatId));
      forgetRecentMessageContentEdit(chatId, messageId);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        removeCachedMessages(old, new Set([messageId])),
      );
      updateCachedMessageCount(qc, chatId, -1);
      return { previousMessages, previousCount };
    },
    onError: (_err, _messageId, context) => {
      if (!chatId) return;
      if (context?.previousMessages) qc.setQueryData(chatKeys.messages(chatId), context.previousMessages);
      if (context?.previousCount) qc.setQueryData(chatKeys.messageCount(chatId), context.previousCount);
    },
    onSettled: () => {
      if (chatId) {
        scheduleDeleteRefresh(qc, chatId);
      }
    },
  });
}

function compactMessageIdList(messageIds: string[]): string[] {
  return Array.from(new Set(messageIds.map((id) => id.trim()).filter(Boolean)));
}

function requireMessageIdList(messageIds: string[], action: string): string[] {
  const uniqueIds = compactMessageIdList(messageIds);
  if (uniqueIds.length === 0) throw new Error(`${action} requires at least one message.`);
  return uniqueIds;
}

export function useDeleteMessages(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      if (!chatId) throw new Error("Chat was not found.");
      const uniqueIds = requireMessageIdList(messageIds, "Deleting messages");
      const result = await chatCommandApi.bulkDeleteMessages(chatId, uniqueIds);
      assertDeletedMessages(result, uniqueIds.length);
      return result;
    },
    onMutate: (messageIds: string[]) => {
      if (!chatId) return;
      const uniqueIds = compactMessageIdList(messageIds);
      if (uniqueIds.length === 0) return;
      const idSet = new Set(uniqueIds);
      void qc.cancelQueries({ queryKey: chatKeys.messages(chatId), exact: true }).catch(() => undefined);
      const previousMessages = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const previousCount = qc.getQueryData<MessageCountResult>(chatKeys.messageCount(chatId));
      for (const messageId of uniqueIds) forgetRecentMessageContentEdit(chatId, messageId);
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => removeCachedMessages(old, idSet));
      updateCachedMessageCount(qc, chatId, -uniqueIds.length);
      return { previousMessages, previousCount };
    },
    onError: (_err, _messageIds, context) => {
      if (!chatId) return;
      if (context?.previousMessages) qc.setQueryData(chatKeys.messages(chatId), context.previousMessages);
      if (context?.previousCount) qc.setQueryData(chatKeys.messageCount(chatId), context.previousCount);
    },
    onSettled: () => {
      if (chatId) {
        scheduleDeleteRefresh(qc, chatId);
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
        const saved = updated ? preserveRecentMessageContentEdit(chatId, sanitizeTimelineMessage(updated)) : null;
        rememberRecentMessageContentEdit(chatId, messageId, saved?.content ?? content, saved?.activeSwipeIndex);
        if (saved) {
          qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
            replaceCachedMessage(old, messageId, (msg) => ({ ...msg, ...saved })),
          );
        }
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
        const { streamingChatId, isStreaming } = useChatStore.getState();
        if (isStreaming && streamingChatId === chatId) return;
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
      const uniqueIds = requireMessageIdList(messageIds, "Updating hidden message state");
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
      const uniqueIds = compactMessageIdList(messageIds);
      if (uniqueIds.length === 0) return;
      await qc.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      const previous = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
      const idSet = new Set(uniqueIds);
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
  const previewSource = message as Message & { swipePreviews?: unknown; swipes?: unknown };
  const rawSwipes = Array.isArray(previewSource.swipes) ? previewSource.swipes : previewSource.swipePreviews;
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
    swipe && typeof swipe === "object" && !Array.isArray(swipe) && Object.prototype.hasOwnProperty.call(swipe, "extra")
      ? parseRecord((swipe as { extra?: unknown }).extra)
      : null;
  const swipeCharacterId =
    swipe &&
    typeof swipe === "object" &&
    !Array.isArray(swipe) &&
    Object.prototype.hasOwnProperty.call(swipe, "characterId")
      ? ((swipe as { characterId?: unknown }).characterId ?? null)
      : undefined;
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
    ...(swipeCharacterId !== undefined
      ? { characterId: typeof swipeCharacterId === "string" ? swipeCharacterId : null }
      : {}),
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
  "generationPromptSnapshot",
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
  promptTemplateId?: string | null;
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
  const [agents, connections] = await Promise.all([
    storageApi.list<Record<string, unknown>>("agents").catch(() => []),
    storageApi.list<Record<string, unknown>>("connections"),
  ]);
  const summaryAgent = agents.find(
    (agent) => readString(agent.id).trim() === "chat-summary" || readString(agent.type).trim() === "chat-summary",
  );
  const summaryConnectionId = readString(summaryAgent?.connectionId).trim();
  if (summaryConnectionId) return summaryConnectionId;
  const agentDefault = connections.find((connection) => boolish(connection.defaultForAgents, false));
  const agentDefaultId = readString(agentDefault?.id).trim();
  if (agentDefaultId) return agentDefaultId;
  if (typeof chat.connectionId === "string" && chat.connectionId.trim()) return chat.connectionId.trim();
  const selected =
    connections.find((connection) => boolish(connection.isDefault, false) || boolish(connection.default, false)) ??
    connections[0];
  const connectionId = readString(selected?.id).trim();
  if (!connectionId) throw new Error("No API connection configured for summary generation.");
  return connectionId;
}

async function generateLlmChatSummary(input: GenerateSummaryInput): Promise<GenerateSummaryResult> {
  const { chatId, contextSize, rangeStartIndex, rangeEndIndex, promptTemplateId } = input;
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
  const metadata = parseRecord(chat.metadata);
  const promptTemplate = resolveSummaryPromptTemplate(metadata, promptTemplateId);
  const transcript = compactTranscript(selected);
  const rawSummary = await llmApi.complete({
    connectionId,
    messages: [
      {
        role: "system",
        content: promptTemplate.prompt,
      },
      {
        role: "user",
        content: [
          "Existing summary:",
          readString(metadata.summary).trim() || "(none)",
          "",
          "Transcript to summarize:",
          transcript,
        ].join("\n"),
      },
    ],
    parameters: { temperature: 0.2, maxTokens: 700 },
  });
  const content = rawSummary.trim();
  if (!content) throw new Error("Summary generation returned an empty response.");

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
      promptTemplateId: promptTemplate.id,
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

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function summaryPromptTemplates(value: unknown): ChatSummaryPromptTemplate[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((template): template is ChatSummaryPromptTemplate => {
      if (!template || typeof template !== "object" || Array.isArray(template)) return false;
      const record = template as Record<string, unknown>;
      return !!readString(record.id).trim() && !!readString(record.name).trim() && !!readString(record.prompt).trim();
    })
    .map((template) => ({
      id: template.id.trim(),
      name: template.name.trim(),
      prompt: template.prompt.trim(),
    }));
}

function resolveSummaryPromptTemplate(
  metadata: Record<string, unknown>,
  requestedTemplateId?: string | null,
): { id: string | null; prompt: string } {
  const templates = summaryPromptTemplates(metadata.summaryPromptTemplates);
  const selectedId =
    readString(requestedTemplateId).trim() || readString(metadata.activeSummaryPromptTemplateId).trim();
  const selected = templates.find((template) => template.id === selectedId);
  return {
    id: selected?.id ?? null,
    prompt: selected?.prompt ?? getDefaultAgentPrompt("chat-summary"),
  };
}

/** Peek at the assembled prompt for a chat */
export function usePeekPrompt() {
  return useMutation({
    mutationFn: (input: string | PromptPreviewInput): Promise<PromptPreviewResult> => {
      const request: PromptPreviewInput = typeof input === "string" ? { chatId: input } : input;
      return previewGenerationPrompt(storageApi, request, visualAssetsApi);
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
      return { format };
    },
    onSuccess: ({ format }) => {
      toast.success(format === "text" ? "Chat transcript exported as text." : "Chat transcript exported as JSONL.");
    },
    onError: (error) => {
      toast.error(getExportErrorMessage(error, "Failed to export chat transcript."));
    },
  });
}

/** Create a branch (copy) of an existing chat */
export function useBranchChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, upToMessageId }: { chatId: string; upToMessageId?: string }) =>
      chatCommandApi.branch<Chat>(chatId, upToMessageId),
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

/** Set the active swipe for a message */
export function useSetActiveSwipe(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      chatCommandApi
        .setActiveSwipe<Message | null>(chatId, messageId, index)
        .then((message) => sanitizeTimelineMessage(message)),
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
      chatCommandApi.deleteSwipe<Message>(chatId, messageId, index),
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
      chatCommandApi.connect<{ connected: boolean }>(chatId, targetChatId),
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
    mutationFn: (chatId: string) => chatCommandApi.disconnect<{ disconnected: boolean; chatIds?: string[] }>(chatId),
    onSuccess: (data, chatId) => {
      const chatIds = data.chatIds && data.chatIds.length > 0 ? data.chatIds : [chatId];
      chatIds.forEach((id) => {
        qc.invalidateQueries({ queryKey: chatKeys.detail(id) });
        qc.invalidateQueries({ queryKey: chatKeys.notes(id) });
      });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
