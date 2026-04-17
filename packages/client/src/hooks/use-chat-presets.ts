// ──────────────────────────────────────────────
// React Query: Chat Preset hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { chatKeys } from "./use-chats";
import type { Chat, ChatMode, ChatPreset, ChatPresetSettings } from "@marinara-engine/shared";

export const chatPresetKeys = {
  all: ["chat-presets"] as const,
  list: (mode?: ChatMode | null) => [...chatPresetKeys.all, "list", mode ?? "all"] as const,
  detail: (id: string) => [...chatPresetKeys.all, "detail", id] as const,
  active: (mode: ChatMode) => [...chatPresetKeys.all, "active", mode] as const,
};

export function useChatPresets(mode?: ChatMode | null) {
  return useQuery({
    queryKey: chatPresetKeys.list(mode ?? null),
    queryFn: () => api.get<ChatPreset[]>(mode ? `/chat-presets?mode=${encodeURIComponent(mode)}` : "/chat-presets"),
    staleTime: 60_000,
  });
}

export function useActiveChatPreset(mode: ChatMode | null) {
  return useQuery({
    queryKey: mode ? chatPresetKeys.active(mode) : chatPresetKeys.all,
    queryFn: () => api.get<ChatPreset | null>(`/chat-presets/active/${mode}`),
    enabled: !!mode,
    staleTime: 60_000,
  });
}

export function useCreateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; mode: ChatMode; settings?: ChatPresetSettings }) =>
      api.post<ChatPreset>("/chat-presets", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
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

/** Apply a preset's settings to an existing chat. Refetches the chat afterward. */
export function useApplyChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, chatId }: { presetId: string; chatId: string }) =>
      api.post<Chat>(`/chat-presets/${presetId}/apply/${chatId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
