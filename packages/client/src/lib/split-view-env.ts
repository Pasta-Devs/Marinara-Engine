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
// would open the second side's page. The settings in those saves still reach
// this device's storage (with the main window's place kept), so Settings work
// on either side. Nothing here imports a store.
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

/**
 * Below this width the second side switches to the touch layout, which fits a narrow side better than a
 * squeezed computer layout: the tablet look from 600 px, the phone look below that (minus the phone top bar,
 * so the side stays on its page).
 */
export const SPLIT_PANE_PHONE_WIDTH = 900;

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

/**
 * In the saves that say where a window is, the fields that do (the rest are settings, shared by both sides).
 * The open Settings category is a place too: each side shows its own.
 */
export const SPLIT_PLACE_FIELDS: Record<string, RegExp> = {
  "marinara-engine-ui":
    /DetailId$|DetailChatId$|Open$|^sidebar|^rightPanel|LibrarySelectedId$|LibraryKind$|ScrollTop$|^noodle|settingsTab/,
  "marinara-overhaul-layout": /^(tabs|tabGroups|libraryPage|settingsTab|docsTabs|split|sidePane)$/,
};
SPLIT_PLACE_FIELDS["marinara-engine-ui:host"] = SPLIT_PLACE_FIELDS["marinara-engine-ui"];

type Saved = { state?: Record<string, unknown>; version?: number };

function parseSaved(raw: string | null): Saved | null {
  try {
    const saved = raw === null ? null : (JSON.parse(raw) as Saved);
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

/**
 * `mine`'s settings with `theirs`'s place, as a save; null when `theirs` already has those settings.
 * The second side's settings go into this device's storage this way, under the main window's place.
 */
export function savedSettingsOver(key: string, theirs: string | null, mine: string): string | null {
  const place = SPLIT_PLACE_FIELDS[key];
  const own = parseSaved(mine);
  if (!place || !own?.state) return null;
  const other = parseSaved(theirs);
  const otherState = other?.state ?? {};
  const state: Record<string, unknown> = {};
  let changed = !other || other.version !== own.version;
  for (const [field, value] of Object.entries(otherState)) {
    if (place.test(field)) state[field] = value;
    else if (!(field in own.state)) changed = true;
  }
  for (const [field, value] of Object.entries(own.state)) {
    if (place.test(field)) continue;
    state[field] = value;
    if (!changed && JSON.stringify(otherState[field]) !== JSON.stringify(value)) changed = true;
  }
  return changed ? JSON.stringify({ ...other, ...own, state }) : null;
}

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
        // Settings changed here are saved for real, under the main window's place (the main window
        // picks them up from the storage event).
        const shared = savedSettingsOver(key, getItem.call(this, key), String(value));
        if (shared !== null) setItem.call(this, key, shared);
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
