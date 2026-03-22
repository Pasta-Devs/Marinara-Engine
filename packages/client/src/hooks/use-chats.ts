// ──────────────────────────────────────────────
// React Query: Chat hooks
// ──────────────────────────────────────────────
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { Chat, Message, MessageSwipe } from "@marinara-engine/shared";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
  group: (groupId: string) => [...chatKeys.all, "group", groupId] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api.get<Chat[]>("/chats"),
    staleTime: 2 * 60_000,
  });
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () => api.get<Chat>(`/chats/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useChatMessages(chatId: string | null, pageSize: number = 0) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(chatId ?? ""),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageSize > 0) params.set("limit", String(pageSize));
      if (pageParam) params.set("before", pageParam);
      const qs = params.toString();
      return api.get<Message[]>(`/chats/${chatId}/messages${qs ? `?${qs}` : ""}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (pageSize <= 0 || lastPage.length < pageSize) return undefined;
      return lastPage[0]?.createdAt;
    },
    enabled: !!chatId,
  });
}

export function useChatGroup(groupId: string | null) {
  return useQuery({
    queryKey: chatKeys.group(groupId ?? ""),
    queryFn: () => api.get<Chat[]>(`/chats/group/${groupId}`),
    enabled: !!groupId,
  });
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
    }) => api.post<Chat>("/chats", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/chats/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(chatKeys.list(), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useDeleteChatGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.delete(`/chats/group/${groupId}`),
    onMutate: async (groupId) => {
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      qc.setQueryData<Chat[]>(chatKeys.list(), (old) => old?.filter((c) => c.groupId !== groupId));
      return { previous };
    },
    onError: (_err, _groupId, context) => {
      if (context?.previous) qc.setQueryData(chatKeys.list(), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useUpdateChatMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...metadata }: { id: string; [key: string]: unknown }) =>
      api.patch<Chat>(`/chats/${id}/metadata`, metadata),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
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
        qc.invalidateQueries({ queryKey: chatKeys.list() });
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
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
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
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      }
    },
  });
}

/** Peek at the assembled prompt for a chat */
export function usePeekPrompt() {
  return useMutation({
    mutationFn: (chatId: string) =>
      api.post<{
        messages: Array<{ role: string; content: string }>;
        parameters: unknown;
        generationInfo: {
          model?: string;
          provider?: string;
          temperature?: number | null;
          maxTokens?: number | null;
          showThoughts?: boolean | null;
          reasoningEffort?: string | null;
          verbosity?: string | null;
          tokensPrompt?: number | null;
          tokensCompletion?: number | null;
          durationMs?: number | null;
          finishReason?: string | null;
        } | null;
      }>(`/chats/${chatId}/peek-prompt`, {}),
  });
}

/** Export a chat as JSONL */
export function useExportChat() {
  return useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(`/api/chats/${chatId}/export`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] ? decodeURIComponent(match[1]) : `chat-${chatId}.jsonl`;
      // Download via blob
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

/** Create a branch (copy) of an existing chat */
export function useBranchChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, upToMessageId }: { chatId: string; upToMessageId?: string }) =>
      api.post<Chat>(`/chats/${chatId}/branch`, { upToMessageId }),
    onSuccess: (_data, { chatId }) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}

/** Generate a rolling summary for a chat via the LLM */
export function useGenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => api.post<{ summary: string }>(`/chats/${chatId}/generate-summary`, {}),
    onSuccess: (_data, chatId) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}

/** Clear all user data */
export function useClearAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/admin/clear-all", { confirm: true }),
    onSuccess: () => qc.invalidateQueries(),
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
      api.put<Message>(`/chats/${chatId}/messages/${messageId}/active-swipe`, { index }),
    onSuccess: () => {
      if (chatId) qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
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
