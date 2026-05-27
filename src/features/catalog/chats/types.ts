export type ChatMode = "conversation" | "roleplay" | "visual_novel" | "game";

export interface ChatMetadata {
  tags?: string[];
  gameId?: string;
  [key: string]: unknown;
}

export interface Chat {
  id: string;
  name: string;
  mode: ChatMode;
  characterIds?: string[] | string | null;
  groupId: string | null;
  folderId: string | null;
  updatedAt: string;
  metadata: ChatMetadata | null;
}

export interface ChatFolder {
  id: string;
  name: string;
  mode: ChatMode;
  color: string;
  sortOrder: number;
  collapsed: boolean;
}

export type MessageRole = "user" | "assistant" | "system" | "narrator";

export interface MessageExtra {
  displayText?: string | null;
  isGenerated?: boolean;
  tokenCount?: number | null;
  thinking?: string | null;
  hiddenFromUser?: boolean;
  hiddenFromAI?: boolean;
  chatSummaryFingerprint?: string | null;
  isConversationStart?: boolean;
  personaSnapshot?: {
    name?: string | null;
    avatarUrl?: string | null;
    nameColor?: string | null;
  } | null;
  attachments?: Array<{
    type?: string;
    url?: string;
    data?: string;
    filename?: string;
    name?: string;
    prompt?: string;
  }>;
  [key: string]: unknown;
}

export interface MessageSwipe {
  id: string;
  messageId?: string;
  index?: number;
  content: string;
  createdAt?: string;
  extra?: MessageExtra | string | null;
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  characterId: string | null;
  content: string;
  activeSwipeIndex: number;
  swipeCount?: number;
  createdAt: string;
  extra: MessageExtra | string | null;
  swipes?: MessageSwipe[];
}
