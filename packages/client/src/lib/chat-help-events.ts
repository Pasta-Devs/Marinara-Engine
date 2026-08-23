import type { ChatMode } from "@marinara-engine/shared";

export const CHAT_HELP_OPEN_REQUEST_EVENT = "mari-chat-help-open-request";
export const CHAT_HELP_CLOSE_EVENT = "mari-chat-help-close";

const CHAT_HELP_MODES = {
  conversation: true,
  roleplay: true,
  game: true,
} satisfies Record<ChatMode, true>;

export function readChatHelpMode(value: unknown): ChatMode | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CHAT_HELP_MODES, value)
    ? (value as ChatMode)
    : null;
}

export function requestChatHelp(mode: ChatMode) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_HELP_OPEN_REQUEST_EVENT, { detail: { mode } }));
}

export function closeChatHelp(mode: ChatMode) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_HELP_CLOSE_EVENT, { detail: { mode } }));
}

export function readChatHelpEventMode(event: Event): ChatMode | null {
  if (!(event instanceof CustomEvent)) return null;
  const mode = (event.detail as { mode?: unknown } | null)?.mode;
  return readChatHelpMode(mode);
}
