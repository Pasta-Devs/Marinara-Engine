export const CHAT_SCROLL_TO_BOTTOM_EVENT = "marinara:chat-scroll-to-bottom";

export type ChatScrollToBottomDetail = {
  chatId: string;
  behavior?: ScrollBehavior;
};

export function requestChatScrollToBottom(detail: ChatScrollToBottomDetail): void {
  window.dispatchEvent(
    new CustomEvent<ChatScrollToBottomDetail>(CHAT_SCROLL_TO_BOTTOM_EVENT, {
      detail,
    }),
  );
}

/** Whether the open chat's transcript is at (or near) its bottom, read from the page itself. */
export function isChatScrolledToBottom(chatId: string): boolean {
  if (typeof document === "undefined") return false;
  const composer = Array.from(document.querySelectorAll<HTMLElement>("[data-chat-composer][data-chat-id]")).find(
    (el) => el.dataset.chatId === chatId,
  );
  const scroller = composer?.closest("[data-chat-mode]")?.querySelector<HTMLElement>("[data-chat-scroll]");
  if (!scroller) return false;
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 150;
}
