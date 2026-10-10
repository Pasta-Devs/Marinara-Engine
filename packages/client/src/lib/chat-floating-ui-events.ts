export const CHAT_FLOATING_UI_DISMISS_EVENT = "marinara:chat-floating-ui-dismiss";
export const CHAT_SUMMARY_OPEN_REQUEST_EVENT = "marinara:chat-summary-open-request";
export const CHAT_LOREBOOK_ENTRIES_OPEN_REQUEST_EVENT = "marinara:chat-lorebook-entries-open-request";
export const CHAT_SEARCH_OPEN_REQUEST_EVENT = "marinara:chat-search-open-request";
export const CHAT_PEEK_PROMPT_REQUEST_EVENT = "marinara:chat-peek-prompt-request";
export const CHAT_REGENERATE_REQUEST_EVENT = "marinara:chat-regenerate-request";
export const CHAT_REPLY_CHECKUP_REQUEST_EVENT = "marinara:chat-reply-checkup-request";
export const CHAT_RETRY_WITH_CONNECTION_REQUEST_EVENT = "marinara:chat-retry-with-connection-request";
export const CHAT_SETTINGS_SECTION_OPEN_REQUEST_EVENT = "marinara:chat-settings-section-open-request";

export function announceChatFloatingUiDismiss() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHAT_FLOATING_UI_DISMISS_EVENT));
}

/** Opens Chat Settings at one section, for omnibar rows that name a setting inside it (UX-13). */
export function requestChatSettingsSectionOpen(chatId: string, section: "advanced-parameters" | "memory-recall") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_SETTINGS_SECTION_OPEN_REQUEST_EVENT, { detail: { chatId, section } }));
}

export function requestChatSummaryOpen(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_SUMMARY_OPEN_REQUEST_EVENT, { detail: { chatId } }));
}

export function requestChatLorebookEntriesOpen(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_LOREBOOK_ENTRIES_OPEN_REQUEST_EVENT, { detail: { chatId } }));
}

export function requestChatSearchOpen(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_SEARCH_OPEN_REQUEST_EVENT, { detail: { chatId } }));
}

export function requestChatPeekPrompt(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_PEEK_PROMPT_REQUEST_EVENT, { detail: { chatId } }));
}

/** R2: opens the reply checkup under the chat's newest reply (the omnibar Fix row). */
export function requestChatReplyCheckup(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_REPLY_CHECKUP_REQUEST_EVENT, { detail: { chatId } }));
}

export function requestChatRegenerate(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_REGENERATE_REQUEST_EVENT, { detail: { chatId } }));
}

/** Retries the chat's last failed reply with a specific connection, one-off (O4 item 3). */
export function requestChatRetryWithConnection(chatId: string, connectionId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_RETRY_WITH_CONNECTION_REQUEST_EVENT, { detail: { chatId, connectionId } }));
}

/**
 * Blurs a focused control in a chat panel that is closing, so a field being edited saves first.
 * `keepWindowFocus` leaves focus alone inside a window that stays open, such as Chat Settings.
 */
export function blurActiveChatFloatingUiControl(options?: { keepWindowFocus?: boolean }) {
  if (typeof document === "undefined") return;
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return;
  if (!activeElement.closest("[data-chat-floating-panel]")) return;
  if (options?.keepWindowFocus && activeElement.closest(".mari-window")) return;
  activeElement.blur();
}

export function isDesktopShellNavigationTarget(target: EventTarget | null) {
  if (typeof window === "undefined" || window.matchMedia("(max-width: 767px)").matches) return false;
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  // A window toggle in the topbar, such as Chat Settings, is a chat control: pressing it closes chat popovers.
  if (element?.closest("[data-window-opener]")) return false;
  return Boolean(element?.closest('[data-component="TopBar"]'));
}
