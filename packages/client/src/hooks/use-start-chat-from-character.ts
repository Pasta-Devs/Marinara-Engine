import { useCallback, useState } from "react";
import type { ChatMode } from "@marinara-engine/shared";
import { useCreateChatDraft } from "./use-create-chat-draft";

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
  const { createChatDraft, isCreatingChatDraft } = useCreateChatDraft();
  const [isStartingChat, setIsStartingChat] = useState(false);

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
      setIsStartingChat(true);
      void createChatDraft({
        name: characterName ? `${characterName} - ${label}` : `New ${label}`,
        mode,
        characterIds: [characterId],
        shortcutMode,
        greeting: firstMessage?.trim() ? { characterId, firstMessage, alternateGreetings } : undefined,
      })
        .then(({ chat }) => onSuccess?.(chat.id))
        .catch(() => undefined)
        .finally(() => setIsStartingChat(false));
    },
    [createChatDraft],
  );

  return {
    startChatFromCharacter,
    isStartingChat: isStartingChat || isCreatingChatDraft,
  };
}
