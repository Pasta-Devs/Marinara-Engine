// ──────────────────────────────────────────────
// Closing Chat settings: one guarded way for every closer
//
// Chat settings can be closed from many places (its own ×, the top-bar and chat toolbar buttons, back on a
// tablet held sideways, a phone pop-out). They used to force the window shut, skipping the drawer's own
// close, so an editor page (Chat Variables, Memories…) with unsaved edits lost them without a word, and the
// next open landed on that page again (QC panel 3, Nov 22). Every person-initiated close now goes through
// `requestCloseChatSettings`, which asks first, and closing the window always leaves its editor page.
// ──────────────────────────────────────────────
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../stores/floating-window.store";
import { requestCloseChatSettingsSubpage, useChatSettingsSubpage } from "../features/chat-settings/subpage";
import { useMobileChatSettingsNav } from "../features/chat-settings/mobile-nav";

/** The mounted drawer's own close (editor page, unsaved prose, inline card saves), when it is mounted. */
let drawerCloser: (() => Promise<boolean>) | null = null;

/** The drawer registers its guarded close while it is mounted. Returns the unregister function. */
export function registerChatSettingsCloser(close: () => Promise<boolean>): () => void {
  drawerCloser = close;
  return () => {
    if (drawerCloser === close) drawerCloser = null;
  };
}

/** Closes Chat settings after asking about unsaved edits. Resolves false when the person kept editing. */
export async function requestCloseChatSettings(): Promise<boolean> {
  if (useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID] !== true) return true;
  if (drawerCloser) return drawerCloser();
  if (!(await requestCloseChatSettingsSubpage())) return false;
  useFloatingWindowStore.getState().dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
  return true;
}

/** The Chat settings buttons (top bar, chat toolbar, bubble): open it, or close it the guarded way. */
export function toggleChatSettings(opener?: HTMLElement | null) {
  const windows = useFloatingWindowStore.getState();
  if (windows.open[CHAT_SETTINGS_WINDOW_ID] === true) void requestCloseChatSettings();
  else windows.openWindow(CHAT_SETTINGS_WINDOW_ID, opener ?? null);
}

/**
 * Closing Chat settings by any path leaves its editor page, so the next open starts on the settings. The drawer
 * unmounts as it closes, so a component effect never saw the close; a store subscription always does.
 */
export function watchChatSettingsClose(): () => void {
  let wasOpen = useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID] === true;
  return useFloatingWindowStore.subscribe((state) => {
    const open = state.open[CHAT_SETTINGS_WINDOW_ID] === true;
    if (wasOpen && !open) {
      if (useChatSettingsSubpage.getState().subpage) useChatSettingsSubpage.getState().closeSubpage();
      // The phone sheet reopens on its Quick page too, so no stale level is a back entry while it opens.
      const nav = useMobileChatSettingsNav.getState();
      if (nav.view === "all" || nav.view === "page") nav.showQuick();
    }
    wasOpen = open;
  });
}
