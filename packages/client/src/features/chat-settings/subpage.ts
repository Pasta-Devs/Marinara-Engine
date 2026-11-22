// ──────────────────────────────────────────────
// New layout: per-chat editors as pages inside Chat settings
//
// Chat Variables, Agent Suite, Memories and Summaries used to open as windows over the chat. In the new
// layout they open as a full-height page inside Chat settings instead (desktop drawer, iPad and phone
// sheet alike), with a "‹ Chat settings" back button. The classic layout keeps the windows.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { registerChatSwitchGate } from "../../lib/chat-switch-gate";

export type ChatSettingsSubpageId = "variables" | "agent-suite" | "memories" | "summaries";

/** What an open editor tells the page about unsaved edits. */
export interface ChatSettingsSubpageGuard {
  /** True while the editor holds edits that leaving would lose. */
  isDirty: () => boolean;
  /** Asks the editor's own "discard?" question; true when it is fine to leave. */
  confirmLeave: () => Promise<boolean>;
}

interface ChatSettingsSubpageState {
  subpage: { chatId: string; id: ChatSettingsSubpageId; props?: Record<string, unknown> } | null;
  /** The element the open editor renders its body into (inside the drawer). */
  slot: HTMLElement | null;
  /** The page header's action area (Save and the like). */
  actionsSlot: HTMLElement | null;
  guard: ChatSettingsSubpageGuard | null;
  openSubpage: (chatId: string, id: ChatSettingsSubpageId, props?: Record<string, unknown>) => void;
  /** Leaves without asking (after a save, or once the question was answered). */
  closeSubpage: () => void;
  setSlot: (slot: HTMLElement | null) => void;
  setActionsSlot: (slot: HTMLElement | null) => void;
  setGuard: (guard: ChatSettingsSubpageGuard | null) => void;
}

/**
 * The button that opened the page, so leaving it puts focus back there (QC panel 3 AX10), and the Chat settings
 * section it sat in, for when that button is gone by then.
 */
let subpageOpener: { element: HTMLElement; section: string | null } | null = null;

/** Hands over (once) where focus goes when the open page closes. */
export function takeChatSettingsSubpageOpener(): { element: HTMLElement; section: string | null } | null {
  const opener = subpageOpener;
  subpageOpener = null;
  return opener;
}

export const useChatSettingsSubpage = create<ChatSettingsSubpageState>()((set) => ({
  subpage: null,
  slot: null,
  actionsSlot: null,
  guard: null,
  openSubpage: (chatId, id, props) => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    subpageOpener =
      active instanceof HTMLElement && active !== document.body
        ? {
            element: active,
            section:
              active.closest<HTMLElement>("[data-chat-settings-section]")?.dataset.chatSettingsSection ?? null,
          }
        : null;
    set({ subpage: { chatId, id, props } });
  },
  closeSubpage: () => set({ subpage: null, guard: null }),
  setSlot: (slot) => set({ slot }),
  setActionsSlot: (actionsSlot) => set({ actionsSlot }),
  setGuard: (guard) => set({ guard }),
}));

/** The page's back button, back gesture and closing Chat settings: asks about unsaved edits first. */
export async function requestCloseChatSettingsSubpage(): Promise<boolean> {
  const { subpage, guard } = useChatSettingsSubpage.getState();
  if (!subpage) return true;
  if (guard && guard.isDirty() && !(await guard.confirmLeave())) return false;
  useChatSettingsSubpage.getState().closeSubpage();
  return true;
}

/** True while an editor page holds unsaved edits (checked before switching chats). */
export function chatSettingsSubpageDirty(): boolean {
  const { subpage, guard } = useChatSettingsSubpage.getState();
  return !!subpage && !!guard?.isDirty();
}

/** Opens Chat settings for this chat straight on one of its editor pages (from outside the drawer). */
export function openChatSettingsSubpage(
  chatId: string,
  id: ChatSettingsSubpageId,
  props?: Record<string, unknown>,
): void {
  useChatSettingsSubpage.getState().openSubpage(chatId, id, props);
  const windows = useFloatingWindowStore.getState();
  if (windows.open[CHAT_SETTINGS_WINDOW_ID] !== true) windows.openWindow(CHAT_SETTINGS_WINDOW_ID, null);
}

// Switching chats while an editor page holds unsaved edits asks first (the page belongs to the old chat).
registerChatSwitchGate((proceed) => {
  if (!chatSettingsSubpageDirty()) return false;
  void requestCloseChatSettingsSubpage().then((left) => {
    if (left) proceed();
  });
  return true;
});
