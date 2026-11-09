// ──────────────────────────────────────────────
// UI overhaul (desktop): split view, the second side's page
//
// The second side of a split view is the app itself in a frame, opened with
// ?ovSplitPane=<page>. It runs on its own (its own chat, editor, Library page),
// so both sides work at once without one page's state leaking into the other.
//
// This module runs before anything else in that frame (it is main.tsx's first
// import): the frame reads the saved settings like any window, but where it
// is (open chat, editor, Library page, tabs) stays its own. Those saves go to
// memory instead of this device's storage, or a reload of the main window
// would open the second side's page. Nothing here imports a store.
// ──────────────────────────────────────────────

/** A page that can be on a side of the split: a tab, a Library section, the Docs, or Home. */
export type SplitPage = { kind: string; id: string; path?: string | null };

function readSplitPane(): SplitPage | null {
  try {
    if (typeof window === "undefined" || window.parent === window) return null;
    const raw = new URLSearchParams(window.location.search).get("ovSplitPane");
    if (!raw) return null;
    const page = JSON.parse(raw) as SplitPage;
    return page && typeof page.kind === "string" && typeof page.id === "string" ? page : null;
  } catch {
    return null;
  }
}

/** Set inside the second side's frame: the page it opened on. Null in the main window. */
export const SPLIT_PANE: SplitPage | null = readSplitPane();

/** Saved keys that say where a window is. The second side keeps these in memory. */
export const SPLIT_PANE_PLACE_KEYS = new Set([
  "marinara-overhaul-layout",
  "marinara-active-chat-id",
  "marinara-last-shell",
  "marinara-engine-ui",
  "marinara-engine-ui:host",
]);

const overlay = new Map<string, string | null>();

/** Drop the frame's own copy of a key, so its next read sees what the main window saved. */
export function forgetSplitPaneCopy(key: string) {
  overlay.delete(key);
}

if (SPLIT_PANE && typeof Storage !== "undefined") {
  try {
    const local = window.localStorage;
    const proto = Storage.prototype;
    const getItem = proto.getItem;
    const setItem = proto.setItem;
    const removeItem = proto.removeItem;
    proto.getItem = function (this: Storage, key: string) {
      if (this === local && overlay.has(key)) return overlay.get(key) ?? null;
      return getItem.call(this, key);
    };
    proto.setItem = function (this: Storage, key: string, value: string) {
      if (this === local && SPLIT_PANE_PLACE_KEYS.has(key)) {
        overlay.set(key, String(value));
        return;
      }
      setItem.call(this, key, value);
    };
    proto.removeItem = function (this: Storage, key: string) {
      if (this === local && SPLIT_PANE_PLACE_KEYS.has(key)) {
        overlay.set(key, null);
        return;
      }
      removeItem.call(this, key);
    };
    document.documentElement.setAttribute("data-ov-split-pane", "");
  } catch {
    /* storage blocked: nothing is saved anyway */
  }
}
