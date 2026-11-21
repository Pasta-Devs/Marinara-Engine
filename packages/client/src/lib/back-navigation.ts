// ──────────────────────────────────────────────
// Hardware / gesture back → dismiss the topmost overlay
//
// The app has no URL router, so nothing ever creates a history entry and the
// Android WebView's `canGoBack()` is permanently false: every back press falls
// through to backgrounding the app, even with a panel or editor open.
//
// This module keeps ONE history entry per dismissable layer on screen. A back
// press pops one entry, we close the topmost layer, and the entries left match
// the layers left. Because it is plain history, browser back, installed-PWA
// back, Safari's left-edge swipe and mouse-button-4 all get the same behaviour
// without an APK change.
//
// One entry per layer, pushed when the layer opens, rather than a single entry
// re-pushed after every press: Safari and Chrome skip history entries a page
// adds without a tap in between, so a re-pushed entry was skipped by the very
// next swipe and two quick swipes left the app (QC panel Nov 21, MOB1). Entries
// pushed while the tap that opened a layer is still being handled are kept.
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
/** How many of our entries sit on top of the page's own entry: the history position we are at. */
let armedDepth = 0;
/**
 * Pops we asked for ourselves, awaiting their `popstate`. `history.back()` is
 * asynchronous, so without this the resulting event would look like a user
 * press and close another layer.
 */
let pendingSelfPops = 0;
let registrationSeq = 0;

const STATE_KEY = "marinaraOverlay";

/** The full stack, outermost → innermost. The last entry is what back closes. */
export function getBackLayerStack(): BackLayer[] {
  return [...resolveStoreLayers(), ...registeredLayers];
}

function depthOf(state: unknown): number {
  const value = (state as Record<string, unknown> | null)?.[STATE_KEY];
  // Older builds stored `true` for their single entry.
  return typeof value === "number" ? value : value === true ? 1 : 0;
}

/** Push or pop entries until there is one per open layer. Idempotent — safe to over-call. */
export function syncBackNavigation() {
  if (!initialized) return;
  // A cleanup pop cannot be cancelled once requested. Wait for its popstate
  // instead of pushing an entry that the in-flight pop would eat.
  if (pendingSelfPops > 0) return;
  const wanted = getBackLayerStack().length;
  if (wanted > armedDepth) {
    while (armedDepth < wanted) {
      armedDepth += 1;
      window.history.pushState({ [STATE_KEY]: armedDepth }, "");
    }
    return;
  }
  if (wanted < armedDepth) {
    // Consume our own entries so they cannot leak into the back stack.
    const extra = armedDepth - wanted;
    armedDepth = wanted;
    pendingSelfPops += 1;
    if (extra === 1) window.history.back();
    else window.history.go(-extra);
  }
}

function handlePopState(event: PopStateEvent) {
  if (pendingSelfPops > 0) {
    // Our own cleanup pop; whatever it closed is already closed.
    pendingSelfPops -= 1;
    if (pendingSelfPops === 0) syncBackNavigation();
    return;
  }
  const depth = depthOf(event?.state ?? null);
  if (depth >= armedDepth) {
    // Forward, or an entry that isn't ours: nothing to close. Line our count up with where history now is.
    if (armedDepth > 0 || depth > 0) {
      armedDepth = depth;
      syncBackNavigation();
    }
    return;
  }

  // Back over one of our entries (a long-press on the back button can jump several): close that many layers.
  let presses = armedDepth - depth;
  armedDepth = depth;
  while (presses > 0) {
    presses -= 1;
    const top = getBackLayerStack().at(-1);
    if (!top) break;
    try {
      top.close();
    } catch (error) {
      console.error("[back-navigation] layer close failed", error);
    }
  }

  // A store layer is gone already; a React-owned one unregisters on effect
  // cleanup, a moment later. Syncing now would push a fresh entry for it (one
  // Safari skips) and pop it again, so line up once React has caught up.
  globalThis.setTimeout(syncBackNavigation, 120);
}

export function initBackNavigation(getLayers: () => BackLayer[]) {
  if (typeof window === "undefined") return;
  resolveStoreLayers = getLayers;
  if (initialized) return;
  initialized = true;
  // A reload keeps the history entries: start from the one we are on, so reopening the same layers pushes nothing.
  armedDepth = depthOf(window.history.state ?? null);
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
  armedDepth = 0;
  pendingSelfPops = 0;
  registrationSeq = 0;
  if (typeof window !== "undefined") window.removeEventListener("popstate", handlePopState);
}
