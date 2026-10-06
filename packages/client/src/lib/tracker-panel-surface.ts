// ──────────────────────────────────────────────
// Tracker Panel visibility
//
// Chat Settings remembers which tracker surface a chat uses. Closing that surface
// only hides it; the Trackers button opens it again without changing the choice.
// ──────────────────────────────────────────────
import { TRACKER_PANEL_BUBBLE_ID, useFloatingWindowStore } from "../stores/floating-window.store";

/** Close the panel while preserving the chat's Tracker Panel preference. */
export function closeTrackerPanel() {
  useFloatingWindowStore.getState().closeWindow(TRACKER_PANEL_BUBBLE_ID);
}
