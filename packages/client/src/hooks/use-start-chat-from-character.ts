import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { chatKeys, useCreateChat } from "./use-chats";
import { useApplyChatPreset, useChatPresets } from "./use-chat-presets";
import { addSilentGreetingSwipes } from "../lib/message-swipes";

type ChatMode = "roleplay" | "conversation" | "game";

interface StartChatFromCharacterOptions {
  characterId: string;
  characterName: string;
  mode: ChatMode;
  firstMessage?: string;
  alternateGreetings?: string[];
  shortcutMode?: boolean;
  onSuccess?: (chatId: string) => void;
}

export function useStartChatFromCharacter() {
  const createChat = useCreateChat();
  const queryClient = useQueryClient();
  const { data: chatPresetsData } = useChatPresets();
  const applyChatPreset = useApplyChatPreset();

  const startChatFromCharacter = useCallback(
    ({
      characterId,
      characterName,
      mode,
      firstMessage,
      alternateGreetings,
      shortcutMode = true,
      onSuccess,
    }: StartChatFromCharacterOptions) => {
      const label = mode === "conversation" ? "Conversation" : mode === "game" ? "Game" : "Roleplay";
      const presets = chatPresetsData ?? [];
      const presetMode = mode === "conversation" || mode === "roleplay" ? mode : null;
      const starred = presetMode
        ? presets.find((preset) => preset.mode === presetMode && preset.isActive && !preset.isDefault)
        : null;

      createChat.mutate(
        {
          name: characterName ? `${characterName} - ${label}` : `New ${label}`,
          mode,
          characterIds: [characterId],
          connectionId: starred?.settings.connectionId ?? undefined,
          promptPresetId: starred?.settings.promptPresetId ?? undefined,
          setupPending: true,
        },
        {
          onSuccess: (chat) => {
            const store = useChatStore.getState();
            store.setActiveChatId(chat.id);
            store.setShouldOpenSettings(true);
            store.setShouldOpenWizard(true);
            store.setShouldOpenWizardInShortcutMode(shortcutMode && mode === "roleplay");
            onSuccess?.(chat.id);

            void (async () => {
              if (starred) {
                try {
                  await applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id });
                } catch {
                  /* non-fatal: chat still opens with system defaults */
                }
              }

              if (shortcutMode && mode === "roleplay" && firstMessage?.trim()) {
                try {
                  const msg = await api.post<{ id: string }>(`/chats/${chat.id}/messages`, {
                    role: "assistant",
                    content: firstMessage,
                    characterId,
                  });

                  if (msg?.id && alternateGreetings?.length) {
                    await addSilentGreetingSwipes(chat.id, msg.id, alternateGreetings);
                  }

                  queryClient.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
                } catch {
                  /* non-fatal: don't block the new chat if greeting injection fails */
                }
              }
            })();
          },
        },
      );
    },
    [applyChatPreset, chatPresetsData, createChat, queryClient],
  );

  return {
    startChatFromCharacter,
    isStartingChat: createChat.isPending,
  };
}
