import type { CharacterData } from "./character.js";
import type { ChatMode, MessageRole } from "./chat.js";
import type { APIProvider } from "./connection.js";
import type { ChatPresetSettings } from "./chat-preset.js";

export interface DiscordBridgeConnectionOption {
  id: string;
  name: string;
  provider: APIProvider;
  model: string;
  baseUrl: string;
  maxContext: number;
  isDefault: boolean;
  useForRandom: boolean;
  defaultForAgents: boolean;
  defaultParameters: Record<string, unknown> | null;
  promptPresetId: string | null;
  updatedAt: string;
}

export interface DiscordBridgePromptPresetOption {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  author: string;
  parameters: Record<string, unknown>;
  updatedAt: string;
}

export interface DiscordBridgeChatPresetOption {
  id: string;
  name: string;
  mode: ChatMode;
  isDefault: boolean;
  isActive: boolean;
  settings: ChatPresetSettings;
  updatedAt: string;
}

export interface DiscordBridgeRoleplayDefaults {
  connection: DiscordBridgeConnectionOption | null;
  chatPreset: DiscordBridgeChatPresetOption | null;
  promptPreset: DiscordBridgePromptPresetOption | null;
  connectionId: string | null;
  promptPresetId: string | null;
  defaultParameters: Record<string, unknown> | null;
  settings: DiscordBridgeRoleplaySettings;
}

export interface DiscordBridgeRoleplaySettings {
  connectionId: string | null;
  promptPresetId: string | null;
}

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
  persona:
    | (DiscordBridgePersonaOption & {
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
      })
    | null;
  missingCharacterIds: string[];
  messages: Array<{
    id: string;
    role: MessageRole;
    characterId: string | null;
    displayName: string;
    content: string;
    createdAt: string;
  }>;
}

export type DiscordBridgeMessageDirection = "discord_to_engine" | "engine_to_discord";

export interface DiscordBridgeThreadBinding {
  id: string;
  guildId: string;
  channelId: string;
  threadId: string;
  chatId: string;
  chatName: string;
  personaId: string | null;
  characterIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscordBridgeUserPersona {
  id: string;
  guildId: string;
  discordUserId: string;
  personaId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscordBridgeParticipant {
  id: string;
  chatId: string;
  source: "discord_bridge";
  guildId: string | null;
  discordUserId: string | null;
  discordDisplayName: string;
  personaId: string | null;
  active: boolean;
  hasSpoken: boolean;
  lastMessageId: string | null;
  lastSpokeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscordBridgeMessageMapping {
  id: string;
  bindingId: string;
  marinaraMessageId: string;
  discordMessageIds: string[];
  role: MessageRole;
  direction: DiscordBridgeMessageDirection;
  contentHash: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscordBridgeCreateRoleplayChatRequest {
  name: string;
  personaId: string | null;
  characterIds: string[];
}

export interface DiscordBridgeCreateRoleplayChatResponse {
  chat: DiscordBridgeChatContext["chat"];
}

export interface DiscordBridgeEngineSyncItem {
  action: "create" | "update";
  binding: DiscordBridgeThreadBinding;
  mapping: DiscordBridgeMessageMapping | null;
  message: DiscordBridgeChatContext["messages"][number];
  contentHash: string;
}

export interface DiscordBridgeEngineSyncResponse {
  items: DiscordBridgeEngineSyncItem[];
}

export interface DiscordBridgeIngestDiscordMessageResponse {
  message: DiscordBridgeChatContext["messages"][number];
  mapping: DiscordBridgeMessageMapping;
}

export interface DiscordBridgeControlsState {
  chatId: string;
  chatName: string;
  threadId: string;
  latestAssistantMessage: {
    id: string;
    activeSwipeIndex: number;
    swipeCount: number;
  } | null;
  canRegenerate: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}
