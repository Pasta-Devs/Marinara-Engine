// ──────────────────────────────────────────────
// Chat insights: modal openers and chat navigation
// ──────────────────────────────────────────────
// The openers are plain functions so a command palette, slash command or any
// other surface can open the same modals without importing their components.
import { api } from "./api-client";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore } from "../stores/ui.store";

export const GLOBAL_SEARCH_MODAL = "global-chat-search";
export const CHAT_STATS_MODAL = "chat-stats";
export const ACTIVITY_OVERVIEW_MODAL = "activity-overview";

/** Open the Search All Chats modal, optionally pre-filled. */
export function openGlobalSearch(initialQuery?: string) {
  useUIStore.getState().openModal(GLOBAL_SEARCH_MODAL, initialQuery ? { initialQuery } : undefined);
}

export function openChatStats(chatId: string) {
  useUIStore.getState().openModal(CHAT_STATS_MODAL, { chatId });
}

export function openActivityOverview() {
  useUIStore.getState().openModal(ACTIVITY_OVERVIEW_MODAL);
}

/** Switch to a chat and scroll to a 1-based message number once it loads. */
export function openChatAtMessage(chatId: string, messageNumber?: number) {
  const ui = useUIStore.getState();
  if (ui.hasAnyDetailOpen()) ui.closeAllDetails();
  const chat = useChatStore.getState();
  if (messageNumber && messageNumber > 0) chat.requestGotoMessage(chatId, messageNumber);
  chat.setActiveChatId(chatId);
  if (isMobileShellViewport()) ui.setSidebarOpen(false);
}

/** The query parameter a push notification's tap opens a chat with: `/?chat=<id>` (#9752). */
export const CHAT_LAUNCH_PARAM = "chat";

/**
 * Open the chat a launch URL names, then drop the parameter so a reload does not open it again.
 * An id that is malformed or no longer exists is ignored.
 */
export async function openChatFromLaunchUrl(): Promise<void> {
  const url = new URL(window.location.href);
  const chatId = url.searchParams.get(CHAT_LAUNCH_PARAM)?.trim();
  if (chatId === undefined) return;
  url.searchParams.delete(CHAT_LAUNCH_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  if (!chatId || !/^[\w-]{1,128}$/.test(chatId)) return;
  try {
    await api.get(`/chats/${encodeURIComponent(chatId)}`);
  } catch {
    return;
  }
  openChatAtMessage(chatId);
}
