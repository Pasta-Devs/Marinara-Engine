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
import { batchBackLayers, type BackLayer } from "./back-navigation";
import { hasEditorLeaveHandler } from "./editor-leave";
import { useOverhaulStore } from "../stores/overhaul.store";
import { useChatStore } from "../stores/chat.store";
import { CHAT_SETTINGS_WINDOW_ID } from "../stores/floating-window.store";
import { useMobileChatSettingsNav } from "../features/chat-settings/mobile-nav";
import { requestCloseChatSettingsSubpage, useChatSettingsSubpage } from "../features/chat-settings/subpage";
import { SPLIT_PANE } from "./split-view-env";
import { requestCloseChatSettings } from "./chat-settings-close";
import { isTouchDevice } from "./touch-device";

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
  return requestSurfaceClose(() => closeThenLibraryList(() => useUIStore.getState().closeTopMainSurface()));
}

/** A Library section picked from the phone's Library list is open (its page, or an editor opened from it). */
function libraryHubShowing() {
  const overhaul = useOverhaulStore.getState();
  return overhaul.libraryHubReturn && (!!overhaul.libraryPage || useUIStore.getState().hasAnyDetailOpen());
}

/**
 * Runs a back close. When it closes the last thing opened from the Library list page, the list slides back over in
 * the same step (QC Nov 22): the `library-hub` layer becomes the `side-page` layer, so history needs no change.
 */
function closeThenLibraryList(close: () => void) {
  if (!libraryHubShowing()) {
    close();
    return;
  }
  batchBackLayers(() => {
    close();
    const overhaul = useOverhaulStore.getState();
    if (overhaul.libraryPage || useUIStore.getState().hasAnyDetailOpen()) return;
    overhaul.setSidePane("library");
    // Opening the page clears the return flag too.
    overhaul.setMobileSidePageOpen(true);
  });
}

/**
 * A section picked from the Library list leaves nothing behind to come back to once it is closed some other way (its
 * own Back button, Home): the flag goes with it. Checked a moment later, so the in-between states of one tap (the
 * list closing before the section opens) don't clear it.
 */
export function watchLibraryHubReturn() {
  let queued = false;
  const check = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const overhaul = useOverhaulStore.getState();
      if (overhaul.libraryHubReturn && !libraryHubShowing() && !overhaul.mobileSidePageOpen)
        overhaul.setLibraryHubReturn(false);
    });
  };
  const unsubscribeOverhaul = useOverhaulStore.subscribe(check);
  const unsubscribeUI = useUIStore.subscribe(check);
  return () => {
    unsubscribeOverhaul();
    unsubscribeUI();
  };
}

/** Closes every open full-page surface at once, straight to the chat (or Home), through the same unsaved-changes guard. */
export function requestCloseAllSurfaces() {
  return requestSurfaceClose(() => useUIStore.getState().closeAllDetails());
}

/**
 * New layout on the phone shell, or on any touch device (an iPad or Android tablet held sideways shows the desktop
 * shell): something other than Home fills the screen (a chat, Docs, Professor Mari, an app, a Library page). Safari's
 * back and the left-edge swipe go there one level up, like every iOS app, instead of leaving the app (QC panels
 * Nov 21 MOB1, Nov 22). A desktop browser with a mouse never gets these layers, so its back is never trapped.
 */
function phonePageLayers(layers: BackLayer[]) {
  const overhaul = useOverhaulStore.getState();
  if (!overhaul.enabled || SPLIT_PANE || (overhaul.desktop && !isTouchDevice())) return;
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
  // Picked from the Library list page: one more step back, to that list (it replaces this layer when it opens).
  if (!overhaul.desktop && libraryHubShowing())
    layers.push({ id: "library-hub", close: () => useOverhaulStore.getState().setLibraryHubReturn(false) });
  // A Library section's page (Settings among them) sits over whatever was on screen: back shows that again.
  if (overhaul.libraryPage)
    layers.push({
      id: "library-page",
      close: () => closeThenLibraryList(() => useOverhaulStore.getState().setLibraryPage(null)),
    });
}

/** The phone's Chats / Library page and All tabs grid: both slide over the page, so back closes them. */
function phoneSheetLayers(layers: BackLayer[]) {
  const overhaul = useOverhaulStore.getState();
  if (!overhaul.enabled) return;
  const chatSettingsOpen = useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID] === true;
  if (overhaul.desktop) {
    // Touch desktop shell (a tablet held sideways): Chat settings is one accordion with no drill views, so back closes
    // it, or first its editor page. Kept in the same place as the phone sheet's layer, so rotating with it open
    // pushes and pops nothing.
    if (isTouchDevice() && !SPLIT_PANE && chatSettingsOpen) chatSettingsLayers(layers, false);
    return;
  }
  if (overhaul.mobileSidePageOpen)
    layers.push({ id: "side-page", close: () => useOverhaulStore.getState().setMobileSidePageOpen(false) });
  if (overhaul.allTabsOpen)
    layers.push({ id: "all-tabs", close: () => useOverhaulStore.getState().setAllTabsOpen(false) });
  // Chat settings as a sheet: back goes from an editor page to its section, from a section's page to the list
  // it came from, then closes the sheet.
  if (chatSettingsOpen) chatSettingsLayers(layers, true);
}

/**
 * Chat settings, one back entry per level, so each back (and each Safari swipe) steps up exactly one: the sheet,
 * All settings, a section's page, an editor page (Chat Variables, Memories…). An entry pushed when a level opens
 * stays inside the tap that opened it, where Safari keeps it. Unsaved edits on an editor page are asked about
 * before leaving it, and closing the sheet goes through the same question (QC panel 3, Nov 22).
 */
function chatSettingsLayers(layers: BackLayer[], drill: boolean) {
  layers.push({ id: "chat-settings", close: () => void requestCloseChatSettings() });
  if (drill) {
    const nav = useMobileChatSettingsNav.getState();
    if (nav.view === "all" || (nav.view === "page" && nav.back === "all"))
      layers.push({ id: "chat-settings-all", close: () => useMobileChatSettingsNav.getState().showQuick() });
    if (nav.view === "page")
      layers.push({ id: "chat-settings-page", close: () => useMobileChatSettingsNav.getState().goBack() });
  }
  if (useChatSettingsSubpage.getState().subpage)
    layers.push({ id: "chat-settings-sub", close: () => void requestCloseChatSettingsSubpage() });
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

  // One layer per full-page surface on the stack (Wren's editor over Characters is two), because back steps through
  // them one at a time. A single layer for the stack had to re-push its entry after each press without a tap, which
  // Safari and Chrome skip, so the next swipe left the app (QC Nov 22, the "unexplained exit").
  if (ui.hasAnyDetailOpen()) {
    for (let index = 0; index <= ui.mainSurfaceHistory.length; index += 1)
      layers.push({
        id: index === 0 ? "detail" : `detail-${index}`,
        close: () => {
          void requestCloseDetails();
        },
      });
  }

  phoneSheetLayers(layers);

  // Store-driven modals also register themselves through `Modal`; the two
  // handful that render their own shell are only reachable via this entry.
  if (ui.modal) layers.push({ id: "modal", close: () => useUIStore.getState().closeModal() });

  // Dismissing must go through `app-dialogs`, not `closeDialog()` — the store
  // holds no resolver, so closing it directly would hang the awaiting caller.
  if (dialog.dialog) layers.push({ id: "dialog", close: dismissActiveDialog });

  return layers;
}
