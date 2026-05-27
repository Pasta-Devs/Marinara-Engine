import type { Message } from "../../../../engine/contracts/types/chat";
export type { CharacterMap, PersonaInfo } from "../../../runtime/visuals/types";

export type PeekPromptData = {
  messages: Array<{ role: string; content: string }>;
  parameters: unknown;
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
