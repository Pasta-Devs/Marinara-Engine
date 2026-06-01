import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { storageApi } from "../../../../shared/api/storage-api";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { chatKeys, useCreateMessage, useUpdateChat } from "../../chats/index";
import type { CharacterFirstMessageConfirmation } from "../components/CharacterFirstMessageDialog";
import { type CharacterRow, type ParsedCharacterRow } from "../lib/characters-panel-model";
import { useStartChatFromCharacter } from "./use-start-chat-from-character";

export function useCharactersPanelChatActions() {
  const activeChat = useChatStore((state) => state.activeChat);
  const updateChat = useUpdateChat();
  const createMessage = useCreateMessage(activeChat?.id ?? null);
  const queryClient = useQueryClient();
  const { startChatFromCharacter, isStartingChat } = useStartChatFromCharacter();
  const [firstMesConfirm, setFirstMesConfirm] = useState<CharacterFirstMessageConfirmation | null>(null);
  const pendingStartCharacterIdRef = useRef<string | null>(null);
  const [pendingStartCharacterId, setPendingStartCharacterId] = useState<string | null>(null);

  const chatCharacterIds = useMemo(() => activeChat?.characterIds ?? [], [activeChat?.characterIds]);
  const isConversation = (activeChat as unknown as { mode?: string })?.mode === "conversation";

  const loadFullCharacter = useCallback(async (charId: string): Promise<ParsedCharacterRow | null> => {
    try {
      const character = await storageApi.get<CharacterRow>("characters", charId);
      if (!character) return null;
      return {
        ...character,
        parsed: character.data ?? { name: "Unknown", description: "" },
      };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load character details.");
      return null;
    }
  }, []);

  const isFirstMessageTargetStillCurrent = useCallback((chatId: string, charId: string): boolean => {
    const currentChat = useChatStore.getState().activeChat;
    return currentChat?.id === chatId && (currentChat.characterIds ?? []).includes(charId);
  }, []);

  const toggleCharacter = useCallback(
    (charId: string) => {
      if (!activeChat) return;
      const targetChatId = activeChat.id;
      const isActive = chatCharacterIds.includes(charId);
      const newIds = isActive ? chatCharacterIds.filter((id: string) => id !== charId) : [...chatCharacterIds, charId];
      if (newIds.length === 0) return;
      updateChat.mutate(
        { id: activeChat.id, characterIds: newIds },
        {
          onSuccess: () => {
            if (isActive) return;
            if (isConversation) return;
            void loadFullCharacter(charId).then((character) => {
              if (!character) return;
              if (!isFirstMessageTargetStillCurrent(targetChatId, charId)) return;
              const firstMes = character.parsed.first_mes as string | undefined;
              const altGreetings = (character.parsed.alternate_greetings ?? []) as string[];
              const name = (character.parsed.name as string | undefined) ?? "Unknown";
              if (firstMes) {
                setFirstMesConfirm({
                  chatId: targetChatId,
                  charId,
                  charName: name,
                  message: firstMes,
                  alternateGreetings: altGreetings,
                });
              }
            });
          },
        },
      );
    },
    [activeChat, chatCharacterIds, isConversation, isFirstMessageTargetStillCurrent, loadFullCharacter, updateChat],
  );

  const addGroupToChat = useCallback(
    (memberIds: string[]) => {
      if (!activeChat || memberIds.length === 0) return;
      const targetChatId = activeChat.id;
      const merged = [...new Set([...chatCharacterIds, ...memberIds])];
      const newlyAdded = memberIds.filter((id) => !chatCharacterIds.includes(id));
      updateChat.mutate(
        { id: activeChat.id, characterIds: merged },
        {
          onSuccess: () => {
            if (isConversation) return;
            void (async () => {
              for (const charId of newlyAdded) {
                const character = await loadFullCharacter(charId);
                if (!character) continue;
                if (!isFirstMessageTargetStillCurrent(targetChatId, charId)) continue;
                const firstMes = character.parsed.first_mes as string | undefined;
                const altGreetings = (character.parsed.alternate_greetings ?? []) as string[];
                const name = (character.parsed.name as string | undefined) ?? "Unknown";
                if (firstMes) {
                  setFirstMesConfirm({
                    chatId: targetChatId,
                    charId,
                    charName: name,
                    message: firstMes,
                    alternateGreetings: altGreetings,
                  });
                  break;
                }
              }
            })();
          },
        },
      );
    },
    [activeChat, chatCharacterIds, isConversation, isFirstMessageTargetStillCurrent, loadFullCharacter, updateChat],
  );

  const handleStartNewChat = useCallback(
    async (characterId: string, characterName: string, firstMessage?: string, alternateGreetings?: string[]) => {
      if (pendingStartCharacterIdRef.current === characterId) return;
      pendingStartCharacterIdRef.current = characterId;
      setPendingStartCharacterId(characterId);
      try {
        let resolvedFirstMessage = firstMessage;
        let resolvedAlternateGreetings = alternateGreetings;
        if (resolvedFirstMessage === undefined && resolvedAlternateGreetings === undefined) {
          const fullCharacter = await loadFullCharacter(characterId);
          if (!fullCharacter) return;
          resolvedFirstMessage = fullCharacter.parsed.first_mes as string | undefined;
          resolvedAlternateGreetings = (fullCharacter.parsed.alternate_greetings ?? []) as string[];
        }
        startChatFromCharacter({
          characterId,
          characterName,
          mode: "roleplay",
          firstMessage: resolvedFirstMessage,
          alternateGreetings: resolvedAlternateGreetings,
        });
      } finally {
        pendingStartCharacterIdRef.current = null;
        setPendingStartCharacterId(null);
      }
    },
    [loadFullCharacter, startChatFromCharacter],
  );

  const handleStartConversation = useCallback(
    (characterId: string, characterName: string) => {
      startChatFromCharacter({
        characterId,
        characterName,
        mode: "conversation",
      });
    },
    [startChatFromCharacter],
  );

  const handleAddFirstMessage = useCallback(
    async (confirmation: CharacterFirstMessageConfirmation) => {
      try {
        if (!isFirstMessageTargetStillCurrent(confirmation.chatId, confirmation.charId)) {
          toast.error("That character is no longer in the active chat.");
          setFirstMesConfirm(null);
          return;
        }
        const msg = await createMessage.mutateAsync({
          role: "assistant",
          content: confirmation.message,
          characterId: confirmation.charId,
        });
        if (msg?.id && confirmation.alternateGreetings.length > 0) {
          for (const greeting of confirmation.alternateGreetings) {
            if (greeting.trim()) {
              await storageApi.addChatMessageSwipe(confirmation.chatId, msg.id, greeting, {
                activate: false,
              });
            }
          }
          queryClient.invalidateQueries({ queryKey: chatKeys.messages(confirmation.chatId) });
        }
      } catch {
        toast.error("Failed to add first message");
      } finally {
        setFirstMesConfirm(null);
      }
    },
    [createMessage, isFirstMessageTargetStillCurrent, queryClient],
  );

  const closeFirstMessageConfirm = useCallback(() => {
    setFirstMesConfirm(null);
  }, []);

  return {
    addGroupToChat,
    chatCharacterIds,
    closeFirstMessageConfirm,
    firstMesConfirm,
    handleAddFirstMessage,
    handleStartConversation,
    handleStartNewChat,
    hasActiveChat: !!activeChat,
    isStartingChat,
    pendingStartCharacterId,
    toggleCharacter,
  };
}
