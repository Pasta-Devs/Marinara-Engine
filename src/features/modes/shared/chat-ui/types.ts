import type { Message, MessageSwipe } from "../../../../engine/contracts/types/chat";
export type { CharacterMap, PersonaInfo } from "../../../runtime/visuals/types";

type PeekPromptMessage = { role: string; content: string; displayName?: string; images?: string[] };

export type PeekPromptData = {
  messages: PeekPromptMessage[];
  previewMessages?: PeekPromptMessage[];
  parameters: unknown;
  promptPresetId?: string | null;
  generationInfo?: {
    model?: string;
    provider?: string;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    topK?: number | null;
    frequencyPenalty?: number | null;
    presencePenalty?: number | null;
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
  loading?: boolean;
  error?: string;
};

export type PeekPromptOptions = {
  forCharacterId?: string | null;
  messageId?: string | null;
  promptSnapshot?: Message["extra"]["generationPromptSnapshot"] | null;
};

export type MessageWithSwipes = Message & {
  swipes?: Array<Pick<MessageSwipe, "content" | "extra"> & { id?: string }>;
  swipePreviews?: Array<Pick<MessageSwipe, "content"> & { id?: string }>;
};

export type ExpressionAvatarResolver = (message: MessageWithSwipes, characterId: string) => string | null;

export type MessageSelectionToggle = {
  messageId: string;
  orderIndex: number;
  checked: boolean;
  shiftKey: boolean;
};
