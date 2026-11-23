// ──────────────────────────────────────────────
// One first-run surface at a time
//
// Tours, tips and the chat help each open by themselves the first time. On
// their own each is fine; together they stacked up (QC panel Nov 21, MOB12 and
// ONB-2): the mode help opened over an open Chat settings sheet, and an offer
// popped up right after a tip. Every surface that opens by itself takes the one
// slot here first and gives it back when it closes, and none of them opens
// while a sheet, page or window covers the chat.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { useUIStore } from "../stores/ui.store";
import { useOverhaulStore } from "../stores/overhaul.store";
import { useDialogStore } from "../stores/dialog.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../stores/floating-window.store";

/** Surfaces that open by themselves. */
export type FirstRunSurface = "chat-settings-tip" | "chat-help" | "hold-tip" | "rp-enter-tip" | "ai-basics-offer";

export const useFirstRunQueue = create<{ showing: FirstRunSurface | null }>(() => ({ showing: null }));

/** Takes the slot for `id`. False while another surface holds it. */
export function claimFirstRunSlot(id: FirstRunSurface): boolean {
  const { showing } = useFirstRunQueue.getState();
  if (showing && showing !== id) return false;
  if (showing !== id) useFirstRunQueue.setState({ showing: id });
  return true;
}

export function releaseFirstRunSlot(id: FirstRunSurface) {
  if (useFirstRunQueue.getState().showing === id) useFirstRunQueue.setState({ showing: null });
}

/** True while another surface than `id` is showing. */
export function useFirstRunSlotTaken(id: FirstRunSurface): boolean {
  return useFirstRunQueue((state) => state.showing !== null && state.showing !== id);
}

/**
 * True while something covers the chat: the Chat settings sheet or window, a page (an editor, a Library page,
 * Settings), the phone's Chats / Library page or All tabs, a window or a dialog. A first-run surface waits for it.
 */
export function useChatCovered(): boolean {
  const settingsOpen = useFloatingWindowStore((s) => s.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const detailOpen = useUIStore((s) => s.hasAnyDetailOpen());
  const modalOpen = useUIStore((s) => s.modal !== null);
  const dialogOpen = useDialogStore((s) => s.dialog !== null);
  const sidePage = useOverhaulStore((s) => s.mobileSidePageOpen || s.allTabsOpen || s.libraryPage !== null);
  return settingsOpen || detailOpen || modalOpen || dialogOpen || sidePage;
}
