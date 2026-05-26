import { useEffect, useMemo } from "react";
import {
  useChat,
  useChatSummaries,
  useChatMessages,
  type Chat,
  type ChatMode,
} from "../../../../catalog/chats/index";
import { useCharacters, usePersonas } from "../../../../catalog/characters/index";
import { ApiError } from "../../../../../shared/api/api-errors";
import { getConnectedChatDisplayName, parseChatMetadata } from "../../../../../shared/lib/chat-display";
import { parseCharacterDisplayData } from "../../../../../shared/lib/character-display";
import { parseAvatarCropJson } from "../../../../../shared/lib/utils";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import type { CharacterMap, MessageWithSwipes, PersonaInfo } from "../types";

type PersonaFallback = "active-persona" | "none";

type UseChatSurfaceDataOptions = {
  activeChatId: string;
  messagePageSize: number;
  fallbackChatMode?: ChatMode;
  personaFallback?: PersonaFallback;
};

type CharacterRow = {
  id: string;
  data: Record<string, any>;
  comment?: string | null;
  avatarPath: string | null;
};

type PersonaRow = {
  id: string;
  isActive: string | boolean;
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  backstory?: string;
  appearance?: string;
  altDescriptions?: Array<{ active?: boolean; content?: string }>;
  avatarPath?: string | null;
  avatarCrop?: string;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
};

function parseChatCharacterIds(chat: Chat | null | undefined): string[] {
  if (!chat) return [];
  const raw = chat.characterIds;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

function parseCharacterData(data: Record<string, any>): Record<string, any> {
  return data && typeof data === "object" ? data : {};
}

function buildPersonaInfo(
  personas: PersonaRow[] | undefined,
  chat: Chat | null | undefined,
  fallback: PersonaFallback,
): PersonaInfo | undefined {
  if (!personas) return undefined;
  const chatPersonaId = (chat as unknown as { personaId?: string | null })?.personaId;
  const persona =
    (chatPersonaId ? personas.find((candidate) => candidate.id === chatPersonaId) : null) ??
    (fallback === "active-persona"
      ? personas.find((candidate) => candidate.isActive === "true" || candidate.isActive === true)
      : null);
  if (!persona) return undefined;

  let description = persona.description ?? "";
  if (Array.isArray(persona.altDescriptions)) {
    for (const altDescription of persona.altDescriptions) {
      if (altDescription?.active && typeof altDescription.content === "string" && altDescription.content.trim()) {
        description = [description, altDescription.content.trim()].filter(Boolean).join("\n");
      }
    }
  }

  return {
    name: persona.name,
    description,
    personality: persona.personality || undefined,
    scenario: persona.scenario || undefined,
    backstory: persona.backstory || undefined,
    appearance: persona.appearance || undefined,
    avatarUrl: persona.avatarPath || undefined,
    avatarCrop: parseAvatarCropJson(persona.avatarCrop),
    nameColor: persona.nameColor || undefined,
    dialogueColor: persona.dialogueColor || undefined,
    boxColor: persona.boxColor || undefined,
  };
}

export function useChatSurfaceData({
  activeChatId,
  messagePageSize,
  fallbackChatMode = "conversation",
  personaFallback = "active-persona",
}: UseChatSurfaceDataOptions) {
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const { data: chat, error: chatError } = useChat(activeChatId);
  const { data: allChats } = useChatSummaries();
  const {
    data: msgData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useChatMessages(activeChatId, messagePageSize, !!chat);
  const { data: allCharacters } = useCharacters();
  const { data: allPersonas } = usePersonas();

  useEffect(() => {
    if (!(chatError instanceof ApiError) || chatError.status !== 404) return;
    setActiveChatId(null);
  }, [chatError, setActiveChatId]);

  useEffect(() => {
    if (chat) useChatStore.getState().setActiveChat(chat);
  }, [chat]);

  const rawMode = chat?.mode;
  const chatMode = rawMode ?? fallbackChatMode;
  const chatMeta = useMemo(() => parseChatMetadata(chat?.metadata), [chat]);
  const messages = useMemo<MessageWithSwipes[] | undefined>(
    () => (msgData ? [...msgData.pages].reverse().flat() : undefined),
    [msgData],
  );
  const totalMessageCount = messages?.length ?? 0;
  const loadedMessageCount = messages?.length ?? 0;
  const messageOffset = messages ? totalMessageCount - messages.length : 0;
  const messageIdByOrderIndex = useMemo(() => {
    const map = new Map<number, string>();
    if (!messages) return map;
    messages.forEach((message, index) => {
      map.set(messageOffset + index, message.id);
    });
    return map;
  }, [messageOffset, messages]);

  const characterMap: CharacterMap = useMemo(() => {
    const map: CharacterMap = new Map();
    if (!allCharacters) return map;
    for (const character of allCharacters as CharacterRow[]) {
      try {
        const parsed = parseCharacterData(character.data);
        map.set(character.id, {
          name: parsed.name ?? "Unknown",
          description: parsed.description ?? "",
          personality: parsed.personality ?? "",
          backstory: parsed.extensions?.backstory ?? "",
          appearance: parsed.extensions?.appearance ?? "",
          scenario: parsed.scenario ?? "",
          example: parsed.mes_example ?? "",
          avatarUrl: character.avatarPath ?? null,
          nameColor: parsed.extensions?.nameColor || undefined,
          dialogueColor: parsed.extensions?.dialogueColor || undefined,
          boxColor: parsed.extensions?.boxColor || undefined,
          avatarCrop: parsed.extensions?.avatarCrop || null,
          conversationStatus: parsed.extensions?.conversationStatus || undefined,
          conversationActivity: parsed.extensions?.conversationActivity || undefined,
        });
      } catch {
        map.set(character.id, { name: "Unknown", avatarUrl: null });
      }
    }
    return map;
  }, [allCharacters]);

  const chatCharIds = useMemo(() => parseChatCharacterIds(chat), [chat]);
  const characterNames = useMemo(
    () => chatCharIds.map((id) => characterMap.get(id)?.name).filter((name): name is string => !!name),
    [characterMap, chatCharIds],
  );
  const personaInfo = useMemo(
    () => buildPersonaInfo(allPersonas as PersonaRow[] | undefined, chat, personaFallback),
    [allPersonas, chat, personaFallback],
  );
  const chatList =
    (allChats as Array<{ id: string; name: string; metadata?: string | Record<string, unknown> | null }> | undefined) ??
    [];
  const connectedChatName = chat?.connectedChatId
    ? getConnectedChatDisplayName(chatList.find((item) => item.id === chat.connectedChatId))
    : undefined;
  const pageCount = msgData?.pages.length ?? 0;

  const gameCharacters = useMemo(
    () =>
      allCharacters
        ? (allCharacters as CharacterRow[]).map((character) => {
            try {
              const parsed = parseCharacterData(character.data);
              const display = parseCharacterDisplayData(character);
              return {
                id: character.id,
                name: display.name,
                comment: display.comment,
                avatarUrl: character.avatarPath ?? undefined,
                avatarCrop: parsed.extensions?.avatarCrop || null,
                nameColor: parsed.extensions?.nameColor || undefined,
                dialogueColor: parsed.extensions?.dialogueColor || undefined,
                description: parsed.description ?? "",
                personality: parsed.personality ?? "",
                backstory: parsed.extensions?.backstory ?? "",
                appearance: parsed.extensions?.appearance ?? "",
                tags: parsed.tags ?? [],
              };
            } catch {
              return { id: character.id, name: "Unknown" };
            }
          })
        : [],
    [allCharacters],
  );

  return {
    chat,
    chatMode,
    chatMeta,
    messages,
    msgData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetchMessages,
    totalMessageCount,
    loadedMessageCount,
    messageOffset,
    messageIdByOrderIndex,
    characterMap,
    chatCharIds,
    characterNames,
    personaInfo,
    chatList,
    connectedChatName,
    pageCount,
    gameCharacters,
  };
}
