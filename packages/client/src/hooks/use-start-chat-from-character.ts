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
      onSuccess,
    }: StartChatFromCharacterOptions) => {
      const label = mode === "conversation" ? "Conversation" : mode === "game" ? "Game" : "Roleplay";
      const presets = chatPresetsData ?? [];
      const presetMode = mode === "conversation" || mode === "roleplay" ? mode : null;
      const starred = presetMode
        ? (presets.find((preset) => preset.mode === presetMode && preset.isActive && !preset.isDefault) ?? null)
        : null;

      createChat.mutate(
        {
          name: characterName ? `${characterName} - ${label}` : `New ${label}`,
          mode,
          characterIds: [characterId],
          connectionId: starred?.settings.connectionId ?? undefined,
          promptPresetId: starred?.settings.promptPresetId ?? undefined,
        },
        {
          onSuccess: (chat) => {
            const store = useChatStore.getState();
            store.setActiveChatId(chat.id);
            // Roleplay and conversation open straight into the chat with its setup stage; game keeps the wizard.
            if (mode !== "game") store.setSetupStageChatId(chat.id);
            else {
              store.setShouldOpenSettings(true);
              store.setShouldOpenWizard(true);
            }
            onSuccess?.(chat.id);

            void (async () => {
              if (starred) {
                try {
                  await applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id });
                } catch {
                  /* non-fatal: chat still opens with system defaults */
                }
              }

              if (mode !== "roleplay") return;
              try {
                // The stage previews the greeting, so it must exist before the user begins.
                let greeting = firstMessage;
                let alternates = alternateGreetings;
                if (greeting === undefined) {
                  const character = await api.get<{ data: unknown }>(`/characters/${characterId}`);
                  const data = (typeof character.data === "string" ? JSON.parse(character.data) : character.data) as {
                    first_mes?: string;
                    alternate_greetings?: string[];
                  } | null;
                  greeting = data?.first_mes;
                  alternates = data?.alternate_greetings;
                }
                if (!greeting?.trim()) return;
                const msg = await api.post<{ id: string }>(`/chats/${chat.id}/messages`, {
                  role: "assistant",
                  content: greeting,
                  characterId,
                });

                if (msg?.id && alternates?.length) {
                  await addSilentGreetingSwipes(chat.id, msg.id, alternates);
                }

                queryClient.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
              } catch {
                /* non-fatal: don't block the new chat if greeting injection fails */
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
