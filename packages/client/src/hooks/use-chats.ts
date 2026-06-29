// ──────────────────────────────────────────────
// React Query: Chat hooks
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
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { useAgentStore } from "../stores/agent.store";
import { useGameStateStore } from "../stores/game-state.store";
import { useEncounterStore } from "../stores/encounter.store";
import { useUIStore } from "../stores/ui.store";
import { clearBrowserRuntimeCaches } from "../lib/browser-runtime";
import { ApiError } from "../lib/api-client";
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
} from "@marinara-engine/shared";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
  messageCount: (chatId: string) => [...chatKeys.all, "messageCount", chatId] as const,
  memories: (chatId: string) => [...chatKeys.all, "memories", chatId] as const,
  notes: (chatId: string) => [...chatKeys.all, "notes", chatId] as const,
  group: (groupId: string) => [...chatKeys.all, "group", groupId] as const,
};

const RECENT_MESSAGE_CONTENT_EDIT_TTL_MS = 5 * 60 * 1000;
const chatMetadataMutationVersions = new Map<string, number>();
const chatMetadataFieldVersions = new Map<string, Map<string, number>>();

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

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () => api.get<Chat>(`/chats/${id}`),
    enabled: !!id,
    staleTime: 60_000,
    retry: (failureCount, error) => {
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
      return typeof oldestLoaded.rowid === "number"
        ? `${oldestLoaded.createdAt}|${oldestLoaded.rowid}`
        : oldestLoaded.createdAt;
    },
    enabled: !!chatId && enabled,
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
      promptPresetId?: string | null;
    }) => api.post<Chat>("/chats", data),
    onSuccess: (chat) => {
      if (chat) {
        qc.setQueryData(chatKeys.detail(chat.id), chat);
        qc.setQueryData<Chat[]>(chatKeys.list(), (existing) => upsertCachedChat(existing, chat));
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
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
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      if (providedGroupId) {
        await qc.cancelQueries({ queryKey: chatKeys.group(providedGroupId) });
      }
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      const previousGroup = providedGroupId ? qc.getQueryData<Chat[]>(chatKeys.group(providedGroupId)) : undefined;
      const deletedChat = previous?.find((c) => c.id === id) ?? previousGroup?.find((c) => c.id === id) ?? null;
      const groupId = deletedChat?.groupId ?? providedGroupId;

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.id !== id));

      if (groupId) {
        qc.setQueryData<Chat[]>(chatKeys.group(groupId), (old) => old?.filter((c) => c.id !== id));
      }

      return { previous, previousGroup, groupId };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(chatKeys.list(), context.previous);
      } else {
        qc.invalidateQueries({ queryKey: chatKeys.list() });
      }
      if (context?.groupId) {
        if (context.previousGroup) {
          qc.setQueryData(chatKeys.group(context.groupId), context.previousGroup);
        } else {
          qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
        }
      }
      toast.error("Couldn't delete the conversation. It has been restored.");
    },
    onSettled: (_data, _err, input, context) => {
      const groupId = context?.groupId ?? getDeleteChatGroupId(input);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      if (groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(groupId) });
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
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());

      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.groupId !== groupId));
      qc.setQueryData<Chat[]>(chatKeys.group(groupId), []);

      return { previous, groupId };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(chatKeys.list(), context.previous);
      if (context?.groupId) {
        qc.invalidateQueries({ queryKey: chatKeys.group(context.groupId) });
      }
    },
    onSettled: (_data, _err, _input, context) => {
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
    }) => api.patch<Chat>(`/chats/${id}`, data),
    onSuccess: (updatedChat, vars) => {
      if (updatedChat) {
        syncCachedChat(qc, updatedChat);
      }
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      if (vars.characterIds !== undefined) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(vars.id) });
        qc.invalidateQueries({ queryKey: chatKeys.messageCount(vars.id) });
      }

      // Patch the group cache so the branch selector dropdown reflects renames
      // (and any other field changes) without waiting for a chat switch.
      if (updatedChat?.groupId) {
        qc.setQueryData<Chat[]>(chatKeys.group(updatedChat.groupId), (existing) =>
          existing?.map((chat) => (chat.id === vars.id ? updatedChat : chat)),
        );
      }
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "group"] });
    },
  });
}

export function useTouchChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Chat>(`/chats/${id}/touch`, {}),
    onMutate: async (id) => {
      const updatedAt = new Date().toISOString();
      qc.setQueryData<Chat[]>(chatKeys.list(), (existing) =>
        existing
          ?.map((chat) => (chat.id === id ? { ...chat, updatedAt } : chat))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
      qc.setQueryData<Chat>(chatKeys.detail(id), (existing) => (existing ? { ...existing, updatedAt } : existing));
    },
    onSuccess: (chat, id) => {
      if (chat) qc.setQueryData<Chat>(chatKeys.detail(id), chat);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
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
            context?.version ?? (chatMetadataMutationVersions.get(vars.id) ?? 0),
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

export function useMarkAutonomousUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, characterId, count }: { chatId: string; characterId?: string | null; count?: number }) =>
      api.post<Chat>(`/chats/${chatId}/autonomous-unread`, { characterId: characterId ?? null, count }),
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
    mutationFn: (chatId: string) => api.delete<Chat>(`/chats/${chatId}/autonomous-unread`),
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
    }) => api.patch<Chat>(`/chats/${id}/summaries`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
    },
  });
}

export type SummaryEntryOperation =
  | { operation: "replace"; entry: Partial<ChatSummaryEntry> & { id: string; content: string } }
  | { operation: "delete"; entryId: string }
  | { operation: "toggle"; entryId: string; enabled: boolean };

function useSummaryEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, ...body }: { chatId: string } & SummaryEntryOperation) =>
      api.patch<Chat>(`/chats/${chatId}/summary-entries`, body),
    onSuccess: (data, vars) => {
      if (data) {
        syncCachedChat(qc, data);
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
    mutate: (input: { chatId: string; entryId: string }) => mutation.mutate({ ...input, operation: "delete" }),
    mutateAsync: (input: { chatId: string; entryId: string }) =>
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

export function useCreateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: string; content: string; characterId?: string | null }) =>
      api.post<Message>(`/chats/${chatId}/messages`, data),
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
    mutationFn: (messageId: string) => api.delete(`/chats/${chatId}/messages/${messageId}`),
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

export function useDeleteMessages(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageIds: string[]) => api.post(`/chats/${chatId}/messages/bulk-delete`, { messageIds }),
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

/** Edit a message's content */
export function useUpdateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content }),
    onMutate: async ({ messageId, content }) => {
      if (!chatId) return;
      // Cancel in-flight refetches (e.g. from generation events) so they
      // don't overwrite the optimistic value with stale server data.
      await qc.cancelQueries({ queryKey: chatKeys.messages(chatId) });
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

export function useBulkSetMessagesHiddenFromAI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, messageIds, hidden }: { chatId: string; messageIds: string[]; hidden: boolean }) =>
      api.patch<{ updated: number }>(`/chats/${chatId}/messages/bulk-hidden`, { messageIds, hidden }),
    onMutate: async ({ chatId, messageIds, hidden }) => {
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
              let currentExtra: Record<string, unknown> = {};
              try {
                currentExtra =
                  typeof msg.extra === "string"
                    ? JSON.parse(msg.extra)
                    : ((msg.extra ?? {}) as unknown as Record<string, unknown>);
              } catch {
                currentExtra = {};
              }
              return { ...msg, extra: { ...currentExtra, hiddenFromAI: hidden } as unknown as Message["extra"] };
            }),
          ),
        };
      });

      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        qc.setQueryData(chatKeys.messages(vars.chatId), context.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.chatId) });
      qc.invalidateQueries({ queryKey: lorebookKeys.active(vars.chatId) });
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
    mutationFn: (chatId: string) =>
      api.post<{
        messages: Array<{ role: string; content: string }>;
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
      }>(`/chats/${chatId}/peek-prompt`, {}),
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
  promptTemplateId?: string | null;
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
      promptTemplateId,
    }: GenerateSummaryInput) =>
      api.post<{
        summary: string | null;
        entry: ChatSummaryEntry | null;
        entries: ChatSummaryEntry[];
        messageIds: string[];
        /** Subset of messageIds eligible to hide (summarized set minus the protected tail). */
        hideMessageIds: string[];
      }>(`/chats/${chatId}/generate-summary`, {
        contextSize,
        rangeStartMessageId,
        rangeEndMessageId,
        rangeStartIndex,
        rangeEndIndex,
        promptTemplateId,
      }),
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

/** Fetch swipes for a message */
export function useSwipes(chatId: string | null, messageId: string | null) {
  return useQuery({
    queryKey: [...chatKeys.all, "swipes", messageId ?? ""],
    queryFn: () => api.get<MessageSwipe[]>(`/chats/${chatId}/messages/${messageId}/swipes`),
    enabled: !!chatId && !!messageId,
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
      qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
        replaceCachedMessage(old, messageId, (msg) => ({ ...msg, ...updated })),
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
