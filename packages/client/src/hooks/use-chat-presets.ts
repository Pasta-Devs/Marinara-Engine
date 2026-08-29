// ──────────────────────────────────────────────
// React Query: chat settings profiles (legacy hook/route names retain "ChatPreset")
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { captureChatMetadataVersion, chatKeys, guardServerChatSnapshot, syncCachedChat } from "./use-chats";
import type { Chat, ChatMode, ChatPreset, ChatPresetSettings } from "@marinara-engine/shared";

export const chatPresetKeys = {
  all: ["chat-presets"] as const,
  list: (mode?: ChatMode | null) => [...chatPresetKeys.all, "list", mode ?? "all"] as const,
};

export function useChatPresets(mode?: ChatMode | null) {
  return useQuery({
    queryKey: chatPresetKeys.list(mode ?? null),
    queryFn: () => api.get<ChatPreset[]>(mode ? `/chat-presets?mode=${encodeURIComponent(mode)}` : "/chat-presets"),
    staleTime: 60_000,
  });
}

export function useUpdateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; settings?: ChatPresetSettings }) =>
      api.patch<ChatPreset>(`/chat-presets/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useSaveChatPresetSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: ChatPresetSettings }) =>
      api.put<ChatPreset>(`/chat-presets/${id}/settings`, settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useDuplicateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      api.post<ChatPreset>(`/chat-presets/${id}/duplicate`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useSetActiveChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ChatPreset>(`/chat-presets/${id}/set-active`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useDeleteChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/chat-presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useImportChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: unknown) => api.post<ChatPreset>("/chat-presets/import", envelope),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

/** Apply a settings profile to an existing chat. */
export function useApplyChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      presetId,
      chatId,
      connectionId,
    }: {
      presetId: string;
      chatId: string;
      connectionId?: string | null;
    }) =>
      api.post<Chat>(
        `/chat-presets/${presetId}/apply/${chatId}`,
        connectionId !== undefined ? { connectionId } : undefined,
      ),
    onMutate: ({ chatId }) => ({ metadataVersion: captureChatMetadataVersion(chatId) }),
    onSuccess: (data, variables, context) => {
      if (data) syncCachedChat(qc, guardServerChatSnapshot(qc, data, context?.metadataVersion ?? 0));
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "group"] });
    },
  });
}
