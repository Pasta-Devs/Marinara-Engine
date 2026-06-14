import type { CharacterData } from "./character.js";
import type { ChatMode, MessageRole } from "./chat.js";

export interface DiscordBridgeChatOption {
  id: string;
  name: string;
  mode: ChatMode;
  characterIds: string[];
  personaId: string | null;
  updatedAt: string;
}

export interface DiscordBridgeCharacterOption {
  id: string;
  name: string;
  comment: string;
  avatarPath: string | null;
  tags: string[];
  updatedAt: string;
}

export interface DiscordBridgePersonaOption {
  id: string;
  name: string;
  comment: string;
  avatarPath: string | null;
  isActive: boolean;
  tags: string[];
  updatedAt: string;
}

export interface DiscordBridgeSetupOptions {
  chats: DiscordBridgeChatOption[];
  characters: DiscordBridgeCharacterOption[];
  personas: DiscordBridgePersonaOption[];
}

export interface DiscordBridgeChatContext {
  chat: DiscordBridgeChatOption & {
    groupId: string | null;
    promptPresetId: string | null;
    connectionId: string | null;
    connectedChatId: string | null;
    metadata: Record<string, unknown>;
  };
  characters: Array<DiscordBridgeCharacterOption & { data: CharacterData }>;
  persona: (DiscordBridgePersonaOption & {
    description: string;
    personality: string;
    scenario: string;
    backstory: string;
    appearance: string;
    nameColor: string;
    dialogueColor: string;
    boxColor: string;
    trackerCardColors: unknown;
    personaStats: unknown;
    altDescriptions: unknown[];
    savedStatusOptions: string[];
  }) | null;
  missingCharacterIds: string[];
  messages: Array<{
    id: string;
    role: MessageRole;
    characterId: string | null;
    content: string;
    createdAt: string;
  }>;
}
