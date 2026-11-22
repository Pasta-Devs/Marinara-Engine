// ──────────────────────────────────────────────
// Derives the back-dismissable layer stack from store state.
//
// Read-only over `ui.store` / `dialog.store`; no overlay component has to know
// this file exists. Ordered outermost → innermost — `back-navigation.ts` closes
// the last entry.
// ──────────────────────────────────────────────
import { isMobileShellViewport, selectSidebarShown, useUIStore } from "../stores/ui.store";
import { TRACKER_PANEL_BUBBLE_ID, useFloatingWindowStore } from "../stores/floating-window.store";
import { closeTrackerPanel } from "./tracker-panel-surface";
import { useDialogStore } from "../stores/dialog.store";
import { dismissActiveDialog, showConfirmDialog } from "./app-dialogs";
import { translate } from "../localization/i18n";
import type { BackLayer } from "./back-navigation";
import { hasEditorLeaveHandler } from "./editor-leave";
import { useOverhaulStore } from "../stores/overhaul.store";
import { useChatStore } from "../stores/chat.store";
import { CHAT_SETTINGS_WINDOW_ID } from "../stores/floating-window.store";
import { useMobileChatSettingsNav } from "../features/chat-settings/mobile-nav";
import { requestCloseChatSettingsSubpage, useChatSettingsSubpage } from "../features/chat-settings/subpage";
import { SPLIT_PANE } from "./split-view-env";

/**
 * The shell docks the sidebar / right panel / tracker panel on a desktop-sized
 * viewport and floats them over the content below it (`AppShell.tsx`'s
 * `shellOverlayMode`). Only the floating form is something back should dismiss:
 * a docked panel is layout, not an overlay, and treating it as one would leave
 * a desktop browser permanently unable to navigate away.
 */
function isShellOverlayMode() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return isMobileShellViewport();
}

let detailCloseInFlight = false;

/**
 * Runs `close` for the open full-page surfaces behind the unsaved-changes confirm, so neither hardware back nor the
 * on-screen buttons can discard an edit silently. An editor with a leave handler saves itself on the way out
 * (the store's `set` routes the leave through it), so only an editor without one is asked.
 */
async function requestSurfaceClose(close: () => void) {
  if (detailCloseInFlight) return;
  const ui = useUIStore.getState();
  if (!ui.hasAnyDetailOpen()) return;

  if (ui.editorDirty && !hasEditorLeaveHandler(ui)) {
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

  close();
}

/** Closes the front-most surface the way the on-screen Back button does: one step back through the surfaces opened before it. */
function requestCloseDetails() {
  return requestSurfaceClose(() => useUIStore.getState().closeTopMainSurface());
}

/** Closes every open full-page surface at once, straight to the chat (or Home), through the same unsaved-changes guard. */
export function requestCloseAllSurfaces() {
  return requestSurfaceClose(() => useUIStore.getState().closeAllDetails());
}

/**
 * New layout on a phone or tablet in portrait: something other than Home fills the screen (a chat, Docs, Professor
 * Mari, an app, a Library page). Safari's back and the left-edge swipe go there one level up, like every iOS app,
 * instead of leaving the app (QC panel Nov 21, MOB1). The desktop shell never gets this layer, so a desktop browser's
 * back is never trapped.
 */
function phonePageLayers(layers: BackLayer[]) {
  const overhaul = useOverhaulStore.getState();
  if (!overhaul.enabled || overhaul.desktop || SPLIT_PANE) return;
  const awayFromHome =
    !!useChatStore.getState().activeChatId ||
    !!overhaul.activeDocsTab ||
    overhaul.activeMari ||
    overhaul.activeSchedules ||
    !!overhaul.activeApp;
  if (awayFromHome)
    layers.push({
      id: "phone-home",
      close: () => {
        window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
        const state = useOverhaulStore.getState();
        state.leaveDocs();
        state.setLibraryPage(null);
        useChatStore.getState().setActiveChatId(null);
      },
    });
  // A Library section's page (Settings among them) sits over whatever was on screen: back shows that again.
  if (overhaul.libraryPage)
    layers.push({ id: "library-page", close: () => useOverhaulStore.getState().setLibraryPage(null) });
}

/** The phone's Chats / Library page and All tabs grid: both slide over the page, so back closes them. */
function phoneSheetLayers(layers: BackLayer[]) {
  const overhaul = useOverhaulStore.getState();
  if (!overhaul.enabled || overhaul.desktop) return;
  if (overhaul.mobileSidePageOpen)
    layers.push({ id: "side-page", close: () => useOverhaulStore.getState().setMobileSidePageOpen(false) });
  if (overhaul.allTabsOpen)
    layers.push({ id: "all-tabs", close: () => useOverhaulStore.getState().setAllTabsOpen(false) });
  // Chat settings as a sheet: back goes from an editor page to its section, from a section's page to the list
  // it came from, then closes the sheet.
  if (useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID] === true)
    layers.push({
      id: "chat-settings",
      close: () => {
        const nav = useMobileChatSettingsNav.getState();
        // An editor page (Chat Variables, Agent Suite…) goes back to the settings first, asking about unsaved edits.
        if (useChatSettingsSubpage.getState().subpage) void requestCloseChatSettingsSubpage();
        else if (nav.view === "page") nav.goBack();
        else if (nav.view === "all") nav.showQuick();
        else useFloatingWindowStore.getState().closeWindow(CHAT_SETTINGS_WINDOW_ID);
      },
    });
}

export function getStoreBackLayers(): BackLayer[] {
  const ui = useUIStore.getState();
  const dialog = useDialogStore.getState();
  const layers: BackLayer[] = [];

  phonePageLayers(layers);

  if (isShellOverlayMode()) {
    if (selectSidebarShown(ui))
      layers.push({ id: "sidebar", close: () => useUIStore.getState().setSidebarOpen(false) });
    if (ui.rightPanelOpen) layers.push({ id: "right-panel", close: () => useUIStore.getState().closeRightPanel() });
    // The chat's panel preference leaves a button on screen; only the open panel is a layer.
    const trackerPanelShowing =
      ui.trackerPanelEnabled &&
      ui.trackerPanelOpen &&
      useFloatingWindowStore.getState().open[TRACKER_PANEL_BUBBLE_ID] === true;
    if (trackerPanelShowing) layers.push({ id: "tracker-panel", close: () => closeTrackerPanel() });
  }

  if (ui.hasAnyDetailOpen())
    layers.push({
      id: "detail",
      close: () => {
        void requestCloseDetails();
      },
    });

  phoneSheetLayers(layers);

  // Store-driven modals also register themselves through `Modal`; the two
  // handful that render their own shell are only reachable via this entry.
  if (ui.modal) layers.push({ id: "modal", close: () => useUIStore.getState().closeModal() });

  // Dismissing must go through `app-dialogs`, not `closeDialog()` — the store
  // holds no resolver, so closing it directly would hang the awaiting caller.
  if (dialog.dialog) layers.push({ id: "dialog", close: dismissActiveDialog });

  return layers;
}
