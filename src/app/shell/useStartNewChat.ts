import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CHAT_MODES } from "../../engine/contracts/constants/chat-modes";
import type { ChatMode } from "../../engine/contracts/types/chat";
import {
  chatPresetKeys,
  findUserStarredChatPreset,
  listChatPresets,
  useApplyChatPreset,
} from "../../features/catalog/chat-presets/index";
import { useCreateChat } from "../../features/catalog/chats/sidebar";
import { connectionKeys } from "../../features/catalog/connections/index";
import { storageApi } from "../../shared/api/storage-api";
import { filterLanguageGenerationConnections } from "../../shared/lib/connection-filters";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";

function hasEmbeddedTauriIpc(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

export function useStartNewChat() {
  const queryClient = useQueryClient();
  const createChat = useCreateChat();
  const applyChatPreset = useApplyChatPreset();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const setPendingNewChatMode = useChatStore((s) => s.setPendingNewChatMode);
  const remoteRuntimeUrl = useUIStore((s) => s.remoteRuntimeUrl);
  const hasAnyDetailOpen = useUIStore((s) => s.hasAnyDetailOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);

  return useCallback(
    async (mode: ChatMode) => {
      if (!hasEmbeddedTauriIpc() && remoteRuntimeUrl.trim().length === 0) {
        if (mode === "conversation" || mode === "roleplay" || mode === "game") {
          setPendingNewChatMode(mode);
        }
        return;
      }

      const connections = await queryClient.fetchQuery({
        queryKey: connectionKeys.list(),
        queryFn: () => storageApi.list<Record<string, unknown>>("connections"),
        staleTime: 5 * 60_000,
      });
      const connectionRows = filterLanguageGenerationConnections(
        (connections ?? []) as Array<{ id: string; provider?: string }>,
      ).filter((connection) => !!connection.id);
      if (connectionRows.length === 0) {
        if (mode === "conversation" || mode === "roleplay" || mode === "game") {
          setPendingNewChatMode(mode);
        }
        return;
      }

      if (hasAnyDetailOpen()) {
        closeAllDetails();
      }

      const presetMode: ChatMode | null = mode === "conversation" || mode === "roleplay" ? mode : null;
      const presets = presetMode
        ? await queryClient.fetchQuery({
            queryKey: chatPresetKeys.list(null),
            queryFn: () => listChatPresets(null),
            staleTime: 60_000,
          })
        : [];
      const starred = findUserStarredChatPreset(presets, presetMode);

      createChat.mutate(
        {
          name: `New ${CHAT_MODES[mode]?.name ?? mode}`,
          mode,
          characterIds: [],
          connectionId: connectionRows[0]!.id,
        },
        {
          onSuccess: async (chat) => {
            setActiveChatId(chat.id);
            if (starred) {
              try {
                await applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id });
              } catch {
                /* non-fatal: chat still opens with system defaults */
              }
            }
            useChatStore.getState().setShouldOpenSettings(true, chat.id);
            useChatStore.getState().setShouldOpenWizard(true, chat.id);
          },
        },
      );
    },
    [
      applyChatPreset,
      closeAllDetails,
      createChat,
      hasAnyDetailOpen,
      queryClient,
      remoteRuntimeUrl,
      setActiveChatId,
      setPendingNewChatMode,
    ],
  );
}
