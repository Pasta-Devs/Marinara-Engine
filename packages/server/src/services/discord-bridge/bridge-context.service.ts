import type {
  CharacterData,
  DiscordBridgeCharacterOption,
  DiscordBridgeChatContext,
  DiscordBridgeChatOption,
  DiscordBridgePersonaOption,
  DiscordBridgeSetupOptions,
} from "@marinara-engine/shared";
import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import type { createCharactersStorage } from "../storage/characters.storage.js";
import type { createChatsStorage } from "../storage/chats.storage.js";

type CharactersStorage = ReturnType<typeof createCharactersStorage>;
type ChatsStorage = ReturnType<typeof createChatsStorage>;

function safeJson(raw: unknown, fallback: unknown): unknown {
  if (typeof raw !== "string" || raw.trim().length === 0) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    const parsed = safeJson(raw, {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function parseStringArray(raw: unknown): string[] {
  const value = typeof raw === "string" ? safeJson(raw, []) : raw;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseUnknownArray(raw: unknown): unknown[] {
  const value = typeof raw === "string" ? safeJson(raw, []) : raw;
  return Array.isArray(value) ? value : [];
}

function parseCharacterData(raw: unknown): CharacterData | null {
  const parsed = safeJson(raw, null);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as CharacterData) : null;
}

function toChatOption(chat: Awaited<ReturnType<ChatsStorage["getById"]>>): DiscordBridgeChatOption | null {
  if (!chat) return null;
  return {
    id: chat.id,
    name: chat.name,
    mode: chat.mode,
    characterIds: parseStringArray(chat.characterIds),
    personaId: chat.personaId ?? null,
    updatedAt: chat.updatedAt,
  };
}

function toCharacterOption(
  character: Awaited<ReturnType<CharactersStorage["getById"]>>,
): (DiscordBridgeCharacterOption & { data: CharacterData }) | null {
  if (!character || character.id === PROFESSOR_MARI_ID) return null;
  const data = parseCharacterData(character.data);
  if (!data) return null;
  return {
    id: character.id,
    name: data.name || "Unnamed Character",
    comment: character.comment ?? "",
    avatarPath: character.avatarPath ?? null,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [],
    updatedAt: character.updatedAt,
    data,
  };
}

function toPersonaOption(persona: Awaited<ReturnType<CharactersStorage["getPersona"]>>) {
  if (!persona) return null;
  const option: DiscordBridgePersonaOption = {
    id: persona.id,
    name: persona.name,
    comment: persona.comment ?? "",
    avatarPath: persona.avatarPath ?? null,
    isActive: persona.isActive === "true",
    tags: parseStringArray(persona.tags),
    updatedAt: persona.updatedAt,
  };
  return {
    ...option,
    description: persona.description ?? "",
    personality: persona.personality ?? "",
    scenario: persona.scenario ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    nameColor: persona.nameColor ?? "",
    dialogueColor: persona.dialogueColor ?? "",
    boxColor: persona.boxColor ?? "",
    trackerCardColors: safeJson(persona.trackerCardColors, null),
    personaStats: safeJson(persona.personaStats, null),
    altDescriptions: parseUnknownArray(persona.altDescriptions),
    savedStatusOptions: parseStringArray(persona.savedStatusOptions),
  };
}

export async function getDiscordBridgeSetupOptions(
  chatsStorage: ChatsStorage,
  charactersStorage: CharactersStorage,
): Promise<DiscordBridgeSetupOptions> {
  const [chats, characters, personas] = await Promise.all([
    chatsStorage.list(),
    charactersStorage.list(),
    charactersStorage.listPersonas(),
  ]);

  return {
    chats: chats.flatMap((chat) => {
      const option = toChatOption(chat);
      return option ? [option] : [];
    }),
    characters: characters.flatMap((character) => {
      const option = toCharacterOption(character);
      if (!option) return [];
      const { data: _data, ...summary } = option;
      return [summary];
    }),
    personas: personas.flatMap((persona) => {
      const option = toPersonaOption(persona);
      if (!option) return [];
      const {
        description: _description,
        personality: _personality,
        scenario: _scenario,
        backstory: _backstory,
        appearance: _appearance,
        nameColor: _nameColor,
        dialogueColor: _dialogueColor,
        boxColor: _boxColor,
        trackerCardColors: _trackerCardColors,
        personaStats: _personaStats,
        altDescriptions: _altDescriptions,
        savedStatusOptions: _savedStatusOptions,
        ...summary
      } = option;
      return [summary];
    }),
  };
}

export async function getDiscordBridgeChatContext(
  chatsStorage: ChatsStorage,
  charactersStorage: CharactersStorage,
  chatId: string,
  options: { messageLimit?: number; allMessages?: boolean } = {},
): Promise<DiscordBridgeChatContext | null> {
  const chat = await chatsStorage.getById(chatId);
  const chatOption = toChatOption(chat);
  if (!chat || !chatOption) return null;

  const characterRows = await Promise.all(chatOption.characterIds.map((id) => charactersStorage.getById(id)));
  const characters = characterRows.flatMap((character) => {
    const option = toCharacterOption(character);
    return option ? [option] : [];
  });
  const foundCharacterIds = new Set(characters.map((character) => character.id));

  const personas = await charactersStorage.listPersonas();
  const personaRow =
    (chat.personaId ? personas.find((candidate) => candidate.id === chat.personaId) : null) ??
    personas.find((candidate) => candidate.isActive === "true") ??
    null;

  const messageLimit = Math.max(0, Math.min(200, Math.floor(options.messageLimit ?? 50)));
  const messages = options.allMessages
    ? await chatsStorage.listMessages(chat.id)
    : messageLimit > 0
      ? await chatsStorage.listMessagesPaginated(chat.id, messageLimit)
      : [];

  return {
    chat: {
      ...chatOption,
      groupId: chat.groupId ?? null,
      promptPresetId: chat.promptPresetId ?? null,
      connectionId: chat.connectionId ?? null,
      connectedChatId: chat.connectedChatId ?? null,
      metadata: parseRecord(chat.metadata),
    },
    characters,
    persona: toPersonaOption(personaRow),
    missingCharacterIds: chatOption.characterIds.filter((id) => !foundCharacterIds.has(id)),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      characterId: message.characterId ?? null,
      content: message.content,
      createdAt: message.createdAt,
    })),
  };
}
