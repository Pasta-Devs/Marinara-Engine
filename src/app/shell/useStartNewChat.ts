import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CHAT_MODES } from "../../engine/contracts/constants/chat-modes";
import type { ChatMode } from "../../engine/contracts/types/chat";
import {
  useApplyUserStarredChatPreset,
} from "../../features/catalog/chat-presets/index";
import { useCreateChat } from "../../features/catalog/chats/sidebar";
import { connectionKeys } from "../../features/catalog/connections/index";
import { checkRemoteRuntimeHealth } from "../../shared/api/remote-runtime";
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
  const applyUserStarredChatPreset = useApplyUserStarredChatPreset();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const setPendingNewChatMode = useChatStore((s) => s.setPendingNewChatMode);
  const remoteRuntimeUrl = useUIStore((s) => s.remoteRuntimeUrl);
  const hasAnyDetailOpen = useUIStore((s) => s.hasAnyDetailOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);

  return useCallback(
    async (mode: ChatMode) => {
      const isNewChatMode = mode === "conversation" || mode === "roleplay" || mode === "game";
      const remoteRuntime = remoteRuntimeUrl.trim();
      const needsRemoteRuntime = !hasEmbeddedTauriIpc();

      if (needsRemoteRuntime && remoteRuntime.length === 0) {
        if (mode === "conversation" || mode === "roleplay" || mode === "game") {
          setPendingNewChatMode(mode);
        }
        return;
      }

      if (needsRemoteRuntime) {
        let health: Awaited<ReturnType<typeof checkRemoteRuntimeHealth>>;
        try {
          health = await checkRemoteRuntimeHealth(remoteRuntime);
        } catch {
          if (isNewChatMode) setPendingNewChatMode(mode);
          return;
        }
        if (health.status !== "ok") {
          if (isNewChatMode) setPendingNewChatMode(mode);
          return;
        }
      }

      let connections: Record<string, unknown>[];
      try {
        connections = await queryClient.fetchQuery({
          queryKey: connectionKeys.list(),
          queryFn: () => storageApi.list<Record<string, unknown>>("connections"),
          staleTime: 5 * 60_000,
        });
      } catch {
        if (isNewChatMode) setPendingNewChatMode(mode);
        return;
      }
      const connectionRows = filterLanguageGenerationConnections(
        (connections ?? []) as Array<{ id: string; provider?: string }>,
      ).filter((connection) => !!connection.id);
      if (connectionRows.length === 0) {
        if (isNewChatMode) {
          setPendingNewChatMode(mode);
        }
        return;
      }

      if (hasAnyDetailOpen()) {
        closeAllDetails();
      }

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
            try {
              await applyUserStarredChatPreset({ mode, chatId: chat.id });
            } catch {
              /* non-fatal: chat still opens with system defaults */
            }
            useChatStore.getState().setShouldOpenSettings(true, chat.id);
            useChatStore.getState().setShouldOpenWizard(true, chat.id);
          },
        },
      );
    },
    [
      applyUserStarredChatPreset,
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
