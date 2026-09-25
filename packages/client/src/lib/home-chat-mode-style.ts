import type { ChatMode } from "@marinara-engine/shared";

export const HOME_CHAT_MODE_ACCENTS: Record<ChatMode, string> = {
  conversation: "oklch(0.79 0.16 205)",
  roleplay: "oklch(0.76 0.19 52)",
  game: "var(--marinara-chat-chrome-accent)",
};
