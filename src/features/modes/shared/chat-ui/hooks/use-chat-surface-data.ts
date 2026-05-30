import { useEffect, useMemo, useState } from "react";
import {
  useChat,
  useChatMessageCount,
  useChatMessages,
  type Chat,
  type ChatMode,
} from "../../../../catalog/chats/index";
import {
  characterAvatarUrl,
  useActivePersona,
  useCharactersByIds,
  usePersona,
} from "../../../../catalog/characters/index";
import { ApiError } from "../../../../../shared/api/api-errors";
import { getConnectedChatDisplayName, parseChatMetadata } from "../../../../../shared/lib/chat-display";
import { parseCharacterDisplayData } from "../../../../../shared/lib/character-display";
import { parseAvatarCropJson } from "../../../../../shared/lib/utils";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import type { CharacterMap, MessageWithSwipes, PersonaInfo } from "../types";

type PersonaFallback = "active-persona" | "none";
const DEFAULT_MESSAGE_PAGE_SIZE = 20;
type RelatedChat = { id: string; name: string; metadata?: string | Record<string, unknown> | null };

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
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
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
  const raw = chat.characterIds as string[] | string | null | undefined;
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

function normalizeIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)));
}

function extractMessageCharacterIds(messages: MessageWithSwipes[] | undefined): string[] {
  if (!messages) return [];
  return normalizeIds(messages.map((message) => message.characterId));
}

function parseMessageExtra(extra: unknown): Record<string, unknown> {
  if (typeof extra === "string") {
    try {
      const parsed = JSON.parse(extra);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : {};
}

function isLegacyGenerationFailureNotice(message: MessageWithSwipes): boolean {
  const extra = parseMessageExtra(message.extra);
  return extra.generationError === true && message.role === "system";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function collectGameCharacterIds(chatMeta: Record<string, any>): string[] {
  const setup =
    chatMeta.gameSetupConfig && typeof chatMeta.gameSetupConfig === "object" ? chatMeta.gameSetupConfig : {};
  const ids: Array<string | null | undefined> = [
    typeof setup.gmCharacterId === "string" ? setup.gmCharacterId : null,
    ...stringArray(setup.partyCharacterIds),
    ...stringArray(chatMeta.gamePartyCharacterIds),
  ];
  if (Array.isArray(chatMeta.gameCharacterCards)) {
    for (const card of chatMeta.gameCharacterCards as Array<Record<string, unknown>>) {
      ids.push(
        typeof card.id === "string" ? card.id : null,
        typeof card.characterId === "string" ? card.characterId : null,
        typeof card.libraryCharacterId === "string" ? card.libraryCharacterId : null,
      );
    }
  }
  return normalizeIds(ids);
}

function buildPersonaInfo(persona: PersonaRow | null | undefined): PersonaInfo | undefined {
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
  const resolvedMessagePageSize =
    Number.isFinite(messagePageSize) && messagePageSize > 0 ? Math.floor(messagePageSize) : DEFAULT_MESSAGE_PAGE_SIZE;
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const {
    data: chat,
    error: chatError,
    isLoading: isChatLoading,
    isFetching: isChatFetching,
    refetch: refetchChat,
  } = useChat(activeChatId);
  const {
    data: msgData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useChatMessages(activeChatId, resolvedMessagePageSize, !!chat);

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
  const connectedChatId =
    typeof (chat as unknown as { connectedChatId?: unknown } | null | undefined)?.connectedChatId === "string"
      ? (chat as unknown as { connectedChatId: string }).connectedChatId.trim() || null
      : null;
  const activeSceneChatId =
    typeof chatMeta.activeSceneChatId === "string" && chatMeta.activeSceneChatId.trim()
      ? chatMeta.activeSceneChatId.trim()
      : null;
  const { data: connectedChat } = useChat(connectedChatId && connectedChatId !== activeChatId ? connectedChatId : null);
  const { data: activeSceneChat } = useChat(
    activeSceneChatId && activeSceneChatId !== activeChatId && activeSceneChatId !== connectedChatId
      ? activeSceneChatId
      : null,
  );
  const messages = useMemo<MessageWithSwipes[] | undefined>(
    () =>
      msgData
        ? [...msgData.pages]
            .reverse()
            .flat()
            .filter((message) => !isLegacyGenerationFailureNotice(message))
        : undefined,
    [msgData],
  );
  const loadedMessageCount = messages?.length ?? 0;
  const [messageCountEnabledForChatId, setMessageCountEnabledForChatId] = useState<string | null>(null);
  useEffect(() => {
    setMessageCountEnabledForChatId(null);
    if (!chat?.id || !msgData?.pages.length) return;
    const id = window.setTimeout(() => setMessageCountEnabledForChatId(activeChatId), 350);
    return () => window.clearTimeout(id);
  }, [activeChatId, chat?.id, msgData?.pages.length]);
  const { data: messageCountData } = useChatMessageCount(
    chat && messageCountEnabledForChatId === activeChatId ? activeChatId : null,
  );
  const totalMessageCount =
    typeof messageCountData?.count === "number"
      ? Math.max(messageCountData.count, loadedMessageCount)
      : loadedMessageCount;
  const messageOffset = messages ? totalMessageCount - messages.length : 0;
  const messageIdByOrderIndex = useMemo(() => {
    const map = new Map<number, string>();
    if (!messages) return map;
    messages.forEach((message, index) => {
      map.set(messageOffset + index, message.id);
    });
    return map;
  }, [messageOffset, messages]);

  const chatCharIds = useMemo(() => parseChatCharacterIds(chat), [chat]);
  const neededCharacterIds = useMemo(
    () => normalizeIds([...chatCharIds, ...extractMessageCharacterIds(messages), ...collectGameCharacterIds(chatMeta)]),
    [chatCharIds, chatMeta, messages],
  );
  const { data: characterRows } = useCharactersByIds(neededCharacterIds, neededCharacterIds.length > 0);
  const characterMap: CharacterMap = useMemo(() => {
    const map: CharacterMap = new Map();
    for (const character of (characterRows ?? []) as CharacterRow[]) {
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
          systemPrompt: parsed.system_prompt ?? parsed.systemPrompt ?? "",
          postHistoryInstructions: parsed.post_history_instructions ?? parsed.postHistoryInstructions ?? "",
          avatarUrl: characterAvatarUrl(character),
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
  }, [characterRows]);

  const characterNames = useMemo(
    () => chatCharIds.map((id) => characterMap.get(id)?.name).filter((name): name is string => !!name),
    [characterMap, chatCharIds],
  );
  const chatPersonaId =
    typeof (chat as unknown as { personaId?: unknown } | null | undefined)?.personaId === "string"
      ? (chat as unknown as { personaId: string }).personaId.trim() || null
      : null;
  const { data: chatPersona } = usePersona(chatPersonaId, !!chatPersonaId);
  const { data: activePersona } = useActivePersona(personaFallback === "active-persona" && !chatPersonaId);
  const personaInfo = useMemo(
    () => buildPersonaInfo((chatPersona ?? activePersona) as PersonaRow | null | undefined),
    [activePersona, chatPersona],
  );
  const chatList = useMemo(() => {
    const rows: RelatedChat[] = [];
    if (connectedChat) rows.push(connectedChat as RelatedChat);
    if (activeSceneChat) rows.push(activeSceneChat as RelatedChat);
    return rows;
  }, [activeSceneChat, connectedChat]);
  const connectedChatName = connectedChat ? getConnectedChatDisplayName(connectedChat) : undefined;
  const pageCount = msgData?.pages.length ?? 0;

  const gameCharacters = useMemo(
    () =>
      characterRows
        ? (characterRows as CharacterRow[]).map((character) => {
            try {
              const parsed = parseCharacterData(character.data);
              const display = parseCharacterDisplayData(character);
              return {
                id: character.id,
                name: display.name,
                comment: display.comment,
                avatarUrl: characterAvatarUrl(character) ?? undefined,
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
    [characterRows],
  );

  return {
    chat,
    chatError,
    isChatLoading,
    isChatFetching,
    refetchChat,
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
