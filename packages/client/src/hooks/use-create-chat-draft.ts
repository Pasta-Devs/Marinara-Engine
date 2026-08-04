import { useCallback } from "react";
import type { Chat, ChatMode } from "@marinara-engine/shared";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { addSilentGreetingSwipes } from "../lib/message-swipes";
import { useChatStore } from "../stores/chat.store";
import { useApplyChatPreset, useChatPresets } from "./use-chat-presets";
import { chatKeys, useCreateChat, useUpdateChatMetadata } from "./use-chats";

export interface ChatDraftGreeting {
  characterId: string;
  firstMessage: string;
  alternateGreetings?: string[];
}

export interface ChatDraft {
  name: string;
  mode: ChatMode;
  characterIds: string[];
  personaId?: string | null;
  lorebookIds?: string[];
  greeting?: ChatDraftGreeting;
  shortcutMode?: boolean;
}

export interface CreateChatDraftResult {
  chat: Chat;
  lorebooksAttached: boolean;
}

export function useCreateChatDraft() {
  const createChat = useCreateChat();
  const updateChatMetadata = useUpdateChatMetadata();
  const applyChatPreset = useApplyChatPreset();
  const { data: chatPresetsData } = useChatPresets();
  const queryClient = useQueryClient();

  const createChatDraft = useCallback(
    async (draft: ChatDraft): Promise<CreateChatDraftResult> => {
      const presetMode = draft.mode === "conversation" || draft.mode === "roleplay" ? draft.mode : null;
      const starred = presetMode
        ? (chatPresetsData ?? []).find((preset) => preset.mode === presetMode && preset.isActive && !preset.isDefault)
        : null;
      const lorebookIds = Array.from(new Set(draft.lorebookIds ?? []));
      const chat = await createChat.mutateAsync({
        name: draft.name,
        mode: draft.mode,
        characterIds: Array.from(new Set(draft.characterIds)),
        personaId: draft.personaId ?? null,
        connectionId: starred?.settings.connectionId ?? undefined,
        promptPresetId: starred?.settings.promptPresetId ?? undefined,
      });

      if (starred) {
        try {
          await applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id });
        } catch {
          // The setup wizard remains available with system defaults.
        }
      }

      let lorebooksAttached = lorebookIds.length === 0;
      if (lorebookIds.length > 0) {
        try {
          await updateChatMetadata.mutateAsync({ id: chat.id, activeLorebookIds: lorebookIds });
          lorebooksAttached = true;
        } catch {
          // Chat creation succeeded. Keep opening it so the user can attach lorebooks in settings.
        }
      }

      const shortcutMode = draft.shortcutMode === true;
      if (shortcutMode && draft.mode === "roleplay" && draft.greeting?.firstMessage.trim()) {
        try {
          const message = await api.post<{ id: string }>(`/chats/${chat.id}/messages`, {
            role: "assistant",
            content: draft.greeting.firstMessage,
            characterId: draft.greeting.characterId,
          });
          if (message.id && draft.greeting.alternateGreetings?.length) {
            await addSilentGreetingSwipes(chat.id, message.id, draft.greeting.alternateGreetings);
          }
          await queryClient.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
        } catch {
          // Greeting injection is optional and must not block the new chat.
        }
      }

      const store = useChatStore.getState();
      store.setActiveChatId(chat.id);
      store.setShouldOpenSettings(true);
      store.setShouldOpenWizard(true);
      store.setShouldOpenWizardInShortcutMode(shortcutMode && draft.mode === "roleplay");

      return { chat, lorebooksAttached };
    },
    [applyChatPreset, chatPresetsData, createChat, queryClient, updateChatMetadata],
  );

  return {
    createChatDraft,
    isCreatingChatDraft: createChat.isPending || applyChatPreset.isPending || updateChatMetadata.isPending,
  };
}
