import type { Message } from "@marinara-engine/shared";
import type { AvatarCrop, LegacyAvatarCrop } from "../../lib/utils";

export type CharacterMap = Map<
  string,
  {
    name: string;
    /** Conversation-only cosmetic display name (extensions.convoDisplayName). */
    convoDisplayName?: string;
    phoneticName?: string;
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
    example?: string;
    avatarUrl: string | null;
    nameColor?: string;
    dialogueColor?: string;
    boxColor?: string;
    avatarCrop?: AvatarCrop | LegacyAvatarCrop | null;
    conversationStatus?: "online" | "idle" | "dnd" | "offline";
    conversationActivity?: string;
  }
>;

export type PersonaInfo = {
  id?: string;
  name: string;
  /** Conversation-only cosmetic display name (persona.convoDisplayName). */
  convoDisplayName?: string;
  phoneticName?: string;
  description?: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
  avatarUrl?: string;
  avatarCrop?: AvatarCrop | LegacyAvatarCrop | null;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
};

export type PeekPromptData = {
  messages: Array<{ role: string; content: string }>;
  chatMode?: string;
  parameters: unknown;
  source?: "cached" | "live_preview" | "raw_messages";
  exact?: boolean;
  generationInfo?: {
    model?: string;
    provider?: string;
    temperature?: number | null;
    maxTokens?: number | null;
    showThoughts?: boolean | null;
    reasoningEffort?: string | null;
    verbosity?: string | null;
    serviceTier?: string | null;
    assistantPrefill?: string | null;
    tokensPrompt?: number | null;
    tokensCompletion?: number | null;
    tokensCachedPrompt?: number | null;
    tokensCacheWritePrompt?: number | null;
    durationMs?: number | null;
    finishReason?: string | null;
  } | null;
  agentNote?: string;
};

export type MessageWithSwipes = Message & {
  swipes?: Array<{ id: string; content: string }>;
};

export type ExpressionAvatarResolver = (message: MessageWithSwipes, characterId: string) => string | null;

export type MessageSelectionToggle = {
  messageId: string;
  orderIndex: number;
  checked: boolean;
  shiftKey: boolean;
};
