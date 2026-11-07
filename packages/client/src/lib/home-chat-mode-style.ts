import type { ChatMode } from "@marinara-engine/shared";

export const HOME_CHAT_MODE_ACCENTS: Record<ChatMode, string> = {
  conversation: "var(--mari-mode-conversation)",
  roleplay: "var(--mari-mode-roleplay)",
  game: "var(--mari-mode-game)",
};
