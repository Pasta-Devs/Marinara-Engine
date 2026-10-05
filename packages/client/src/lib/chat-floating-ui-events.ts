export const CHAT_FLOATING_UI_DISMISS_EVENT = "marinara:chat-floating-ui-dismiss";
export const CHAT_SUMMARY_OPEN_REQUEST_EVENT = "marinara:chat-summary-open-request";

export function announceChatFloatingUiDismiss() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHAT_FLOATING_UI_DISMISS_EVENT));
}

export function requestChatSummaryOpen(chatId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_SUMMARY_OPEN_REQUEST_EVENT, { detail: { chatId } }));
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
