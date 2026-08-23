// ──────────────────────────────────────────────
// Hardware / gesture back → dismiss the topmost overlay
//
// The app has no URL router, so nothing ever creates a history entry and the
// Android WebView's `canGoBack()` is permanently false: every back press falls
// through to backgrounding the app, even with a panel or editor open.
//
// This module keeps at most ONE sentinel history entry alive while any
// dismissable layer is on screen. A back press pops the sentinel, we close the
// topmost layer, and re-arm if something is still open. Because it is plain
// history, browser back, installed-PWA back and mouse-button-4 all get the same
// behaviour without an APK change.
// ──────────────────────────────────────────────

export type BackLayer = {
  /** Diagnostic label; not used for matching. */
  id: string;
  close: () => void;
};

/** Layers derived from store state (see `back-layers.ts`), outermost first. */
let resolveStoreLayers: () => BackLayer[] = () => [];

/** Layers registered by mounted components, in mount order (LIFO on pop). */
const registeredLayers: BackLayer[] = [];

let initialized = false;
let sentinelActive = false;
/**
 * Pops we asked for ourselves, awaiting their `popstate`. `history.back()` is
 * asynchronous, so without this the resulting event would look like a user
 * press and close a second layer.
 */
let pendingSelfPops = 0;
let registrationSeq = 0;

/** The full stack, outermost → innermost. The last entry is what back closes. */
export function getBackLayerStack(): BackLayer[] {
  return [...resolveStoreLayers(), ...registeredLayers];
}

function armSentinel() {
  // A cleanup back() cannot be cancelled once requested. Wait for its
  // popstate instead of pushing an entry that the in-flight back would eat.
  if (sentinelActive || pendingSelfPops > 0) return;
  sentinelActive = true;
  window.history.pushState({ marinaraOverlay: true }, "");
}

function disarmSentinel() {
  if (!sentinelActive) return;
  sentinelActive = false;
  pendingSelfPops += 1;
  // Consume our own entry so it cannot leak into the back stack.
  window.history.back();
}

/** Arm or disarm to match the current stack. Idempotent — safe to over-call. */
export function syncBackNavigation() {
  if (!initialized) return;
  if (getBackLayerStack().length > 0) armSentinel();
  else disarmSentinel();
}

function handlePopState() {
  if (pendingSelfPops > 0) {
    // Our own cleanup pop; whatever it closed is already closed.
    pendingSelfPops -= 1;
    if (pendingSelfPops === 0 && getBackLayerStack().length > 0) armSentinel();
    return;
  }
  if (!sentinelActive) return; // Not ours — let the WebView/browser handle it.
  sentinelActive = false;

  const top = getBackLayerStack().at(-1);
  if (!top) return;

  try {
    top.close();
  } catch (error) {
    console.error("[back-navigation] layer close failed", error);
  }

  // React-owned layers unregister on effect cleanup, a tick later, so the stack
  // can still look non-empty here. That only re-arms early; the follow-up sync
  // from the unregister disarms again.
  if (getBackLayerStack().length > 0) armSentinel();
}

export function initBackNavigation(getLayers: () => BackLayer[]) {
  if (typeof window === "undefined") return;
  resolveStoreLayers = getLayers;
  if (initialized) return;
  initialized = true;
  window.addEventListener("popstate", handlePopState);
}

/**
 * Registers a component-owned layer. Returns the unregister function.
 * Later registrations sit on top, so the most recently opened overlay is the
 * one back closes.
 */
export function registerBackLayer(close: () => void): () => void {
  registrationSeq += 1;
  const layer: BackLayer = { id: `registered-${registrationSeq}`, close };
  registeredLayers.push(layer);
  syncBackNavigation();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = registeredLayers.indexOf(layer);
    if (index >= 0) registeredLayers.splice(index, 1);
    syncBackNavigation();
  };
}

/** Test seam: drop all state so a regression can drive the module repeatedly. */
export function __resetBackNavigationForTests() {
  registeredLayers.length = 0;
  resolveStoreLayers = () => [];
  initialized = false;
  sentinelActive = false;
  pendingSelfPops = 0;
  registrationSeq = 0;
  if (typeof window !== "undefined") window.removeEventListener("popstate", handlePopState);
}
