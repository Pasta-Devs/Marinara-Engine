import type { ChatMode, MessageRole } from "./chat.js";

/** Maximum persisted expression label exposed through the bounded Home feed. */
export const HOME_FEED_SPRITE_EXPRESSION_MAX_LENGTH = 128;

/** Compact chat identity used by Home; transcript and world-state metadata stay server-side. */
export interface HomeRecentChatSummary {
  id: string;
  name: string;
  mode: ChatMode;
  characterIds: string[];
  background: string | null;
  /** Game Mode's current scene asset tag. Resolved through the game-asset manifest by Home. */
  gameBackgroundTag: string | null;
  /** Character ids explicitly participating in this chat's Expression Engine stage. */
  spriteCharacterIds: string[];
  /** Sprite families enabled for the chat. */
  spriteDisplayModes: Array<"expressions" | "full-body">;
  /** Last known Expression Engine pose for each staged character. */
  spriteExpressions: Record<string, string>;
}

/** A bounded last-message glimpse for the Home hub. Full transcripts never cross this contract. */
export interface HomeRecentMessagePreview {
  id: string;
  role: MessageRole;
  characterId: string | null;
  content: string;
  createdAt: string;
}

export interface HomeRecentChatPreview {
  chat: HomeRecentChatSummary;
  latestMessage: HomeRecentMessagePreview | null;
}

/** Local, deterministic data needed for first paint of the Home browser feed. */
export interface HomeFeedSnapshot {
  generatedAt: string;
  recentChats: HomeRecentChatPreview[];
}
