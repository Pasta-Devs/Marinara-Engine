// ──────────────────────────────────────────────
// The Tracker Panel on a phone
//
// On a phone the Tracker Panel switch (top of Chat Settings) shows a bubble the user
// places anywhere; tapping it opens the panel, and closing the panel goes back to
// the bubble. Elsewhere the switch shows and hides the panel itself.
// ──────────────────────────────────────────────
import { TRACKER_PANEL_BUBBLE_ID, isPhoneWindowLayout, useFloatingWindowStore } from "../stores/floating-window.store";
import { useUIStore } from "../stores/ui.store";

/** Closes the Tracker Panel: on a phone back to its bubble (the switch stays on), elsewhere the switch turns off. */
export function closeTrackerPanel(chatId?: string | null) {
  if (isPhoneWindowLayout()) useFloatingWindowStore.getState().closeWindow(TRACKER_PANEL_BUBBLE_ID);
  else useUIStore.getState().setTrackerPanelOpen(false, chatId);
}
