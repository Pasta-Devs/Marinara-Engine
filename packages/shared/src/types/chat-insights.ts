// ──────────────────────────────────────────────
// Chat insights: global search, chat stats and activity overview
// ──────────────────────────────────────────────
import type { ChatMode } from "./chat.js";

export type ChatSearchRole = "user" | "assistant" | "narrator" | "system";

/** A highlighted range inside a search snippet, as [start, end) character offsets. */
export type ChatSearchHighlight = [start: number, end: number];

export interface GlobalChatSearchResult {
  chatId: string;
  chatName: string;
  chatMode: ChatMode;
  messageId: string;
  /** 1-based position of the message in the chat, matching the /goto numbering. */
  messageNumber: number;
  role: ChatSearchRole;
  /** Character name for character turns; null for user, narrator and system turns. */
  speaker: string | null;
  /** The speaking character's id, for its portrait; null when `speaker` is null. */
  characterId: string | null;
  createdAt: string;
  snippet: string;
  highlights: ChatSearchHighlight[];
}

/** One chat with matches, for grouping hits under it. Only filled when the search asks `perChat`. */
export interface GlobalChatSearchChat {
  chatId: string;
  chatName: string;
  chatMode: ChatMode;
  /** Every matching message in this chat, not only the ones in `results`. */
  matches: number;
  /** Display names of the chat's characters that still exist, in chat order. */
  cast: string[];
}

export interface GlobalChatSearchResponse {
  query: string;
  results: GlobalChatSearchResult[];
  /** Chats with matches, newest activity first. Empty unless the search asked `perChat`. */
  chats: GlobalChatSearchChat[];
  offset: number;
  limit: number;
  /** True when at least one more match exists after this page. */
  hasMore: boolean;
  /** True when the search stopped early (result cap or time budget) before scanning every chat. */
  partial: boolean;
  scannedChats: number;
  totalChats: number;
}

export interface ChatSpeakerStats {
  key: string;
  name: string;
  role: ChatSearchRole;
  messages: number;
  words: number;
  averageWords: number;
  longestWords: number;
}

export interface ChatDayCount {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface ChatLongestMessage {
  messageId: string;
  messageNumber: number;
  speaker: string;
  words: number;
  characters: number;
  preview: string;
}

export interface ChatTokenTotals {
  prompt: number;
  completion: number;
  total: number;
  /** Messages whose generation info reported usage. */
  messagesWithUsage: number;
}

export interface ChatPlayTime {
  /** Sum of every sitting, where a gap longer than `gapMs` between messages starts a new sitting. */
  totalMs: number;
  sittings: number;
  longestSittingMs: number;
  gapMs: number;
}

export interface ChatStats {
  chatId: string;
  chatName: string;
  totalMessages: number;
  totalWords: number;
  /** Average words per character/narrator reply. */
  averageReplyWords: number;
  /** Average words per user message. */
  averageUserWords: number;
  speakers: ChatSpeakerStats[];
  messagesPerDay: ChatDayCount[];
  activeDays: number;
  longestMessage: ChatLongestMessage | null;
  tokens: ChatTokenTotals;
  playTime: ChatPlayTime;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
}

export interface ActivityTopChat {
  chatId: string;
  chatName: string;
  chatMode: ChatMode;
  messages: number;
  playTimeMs: number;
  lastMessageAt: string | null;
}

export interface ActivityOverview {
  generatedAt: string;
  /** Messages per local calendar day across every chat, keyed YYYY-MM-DD. */
  days: Record<string, number>;
  totalMessages: number;
  totalWords: number;
  activeChats: number;
  activeDays: number;
  currentStreakDays: number;
  longestStreakDays: number;
  playTime: ChatPlayTime;
  topChats: ActivityTopChat[];
  firstMessageAt: string | null;
  lastMessageAt: string | null;
}
