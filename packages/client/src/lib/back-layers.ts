// ──────────────────────────────────────────────
// Derives the back-dismissable layer stack from store state.
//
// Read-only over `ui.store` / `dialog.store`; no overlay component has to know
// this file exists. Ordered outermost → innermost — `back-navigation.ts` closes
// the last entry.
// ──────────────────────────────────────────────
import { MOBILE_SHELL_MEDIA_QUERY, useUIStore } from "../stores/ui.store";
import { useDialogStore } from "../stores/dialog.store";
import { dismissActiveDialog, showConfirmDialog } from "./app-dialogs";
import { translate } from "../localization/i18n";
import type { BackLayer } from "./back-navigation";

/**
 * The shell docks the sidebar / right panel / tracker panel on a desktop-sized
 * viewport and floats them over the content below it (`AppShell.tsx`'s
 * `shellOverlayMode`). Only the floating form is something back should dismiss:
 * a docked panel is layout, not an overlay, and treating it as one would leave
 * a desktop browser permanently unable to navigate away.
 */
let shellQuery: MediaQueryList | null = null;

function isShellOverlayMode() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  // Held once: this is re-read on every store update, and re-parsing the query
  // string each time would be needless work on a hot path.
  shellQuery ??= window.matchMedia(MOBILE_SHELL_MEDIA_QUERY);
  return shellQuery.matches;
}

let detailCloseInFlight = false;

/**
 * Closes the open detail editor the same way the sidebar does — including the
 * unsaved-changes confirm, so back can never discard an edit silently.
 */
async function requestCloseDetails() {
  if (detailCloseInFlight) return;
  const ui = useUIStore.getState();
  if (!ui.hasAnyDetailOpen()) return;

  if (ui.editorDirty) {
    detailCloseInFlight = true;
    try {
      const discard = await showConfirmDialog({
        title: translate("ui.layout.chatsidebar.unsavedChanges"),
        message: translate("ui.layout.chatsidebar.youHaveUnsavedChangesDiscardAndContinue"),
        confirmLabel: translate("ui.agents.agenteditor.discard"),
        tone: "destructive",
      });
      if (!discard) return;
    } finally {
      detailCloseInFlight = false;
    }
  }

  const current = useUIStore.getState();
  // A regex editor opened from a character's scoped-regex manager has a real
  // one-step return path; `closeRegexDetail` walks it back to that character.
  if (current.regexDetailId && current.regexDetailReturn) current.closeRegexDetail();
  else current.closeAllDetails();
}

export function getStoreBackLayers(): BackLayer[] {
  const ui = useUIStore.getState();
  const dialog = useDialogStore.getState();
  const layers: BackLayer[] = [];

  if (isShellOverlayMode()) {
    if (ui.sidebarOpen) layers.push({ id: "sidebar", close: () => useUIStore.getState().setSidebarOpen(false) });
    if (ui.rightPanelOpen) layers.push({ id: "right-panel", close: () => useUIStore.getState().closeRightPanel() });
    if (ui.trackerPanelOpen)
      layers.push({ id: "tracker-panel", close: () => useUIStore.getState().setTrackerPanelOpen(false) });
  }

  if (ui.hasAnyDetailOpen())
    layers.push({
      id: "detail",
      close: () => {
        void requestCloseDetails();
      },
    });

  // Store-driven modals also register themselves through `Modal`; the two
  // handful that render their own shell are only reachable via this entry.
  if (ui.modal) layers.push({ id: "modal", close: () => useUIStore.getState().closeModal() });

  // Dismissing must go through `app-dialogs`, not `closeDialog()` — the store
  // holds no resolver, so closing it directly would hang the awaiting caller.
  if (dialog.dialog) layers.push({ id: "dialog", close: dismissActiveDialog });

  return layers;
}
