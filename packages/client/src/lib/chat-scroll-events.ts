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
