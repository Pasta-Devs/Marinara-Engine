// ──────────────────────────────────────────────
// React Query: chat settings profiles (legacy hook/route names retain "ChatPreset")
// ──────────────────────────────────────────────
import { useIsMutating, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { advanceStarredProfileDraft } from "../lib/chat-setup-draft";
import { useChatStore } from "../stores/chat.store";
import { api } from "../lib/api-client";
import { CHAT_PRESET_APPLY_MUTATION_KEY, chatPresetApplyFilters } from "../lib/chat-preset-apply";
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

export function useCreateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; mode: ChatMode; settings: ChatPresetSettings }) =>
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

/** Apply a settings profile to an existing chat. */
export function useApplyChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CHAT_PRESET_APPLY_MUTATION_KEY,
    mutationFn: ({
      presetId,
      chatId,
      connectionId,
    }: {
      presetId: string;
      chatId: string;
      connectionId?: string | null;
      initialSetupProfile?: ChatPreset;
    }) =>
      api.post<Chat>(
        `/chat-presets/${presetId}/apply/${chatId}`,
        connectionId !== undefined ? { connectionId } : undefined,
      ),
    onMutate: ({ chatId }) => ({ metadataVersion: captureChatMetadataVersion(chatId) }),
    onSuccess: (data, variables, context) => {
      const draft = useChatStore.getState().pendingNewChatSetups[variables.chatId];
      if (data && variables.initialSetupProfile && draft?.id === variables.chatId) {
        useChatStore
          .getState()
          .setPendingNewChatSetup(
            advanceStarredProfileDraft(draft, data, variables.initialSetupProfile, variables.connectionId),
          );
      }
      if (data) syncCachedChat(qc, guardServerChatSnapshot(qc, data, context?.metadataVersion ?? 0));
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "group"] });
    },
  });
}

/** True while a profile is being applied to this chat, as when a new chat starts from the starred profile. */
export function useIsApplyingChatPreset(chatId: string) {
  return useIsMutating(chatPresetApplyFilters(chatId)) > 0;
}

/** After saving a profile, update the chat settings of the other chats that use it. */
export function useApplyChatPresetToFollowers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, exceptChatId }: { presetId: string; exceptChatId: string }) =>
      api.post<{ updated: number; chatIds: string[]; failed: number }>(`/chat-presets/${presetId}/apply-to-followers`, {
        exceptChatId,
      }),
    onSuccess: ({ chatIds }) => {
      for (const chatId of chatIds) qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.invalidateQueries({ queryKey: [...chatKeys.all, "group"] });
    },
  });
}
