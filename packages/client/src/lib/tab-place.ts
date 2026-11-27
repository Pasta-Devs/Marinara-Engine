// ──────────────────────────────────────────────
// UI overhaul: each tab keeps its place
//
// An editor's tab unmounts the editor when you switch to another tab, so the
// page, entry or section it had open was lost: back on a preset you edit with
// Prof. Mari, it showed the preset's Overview again instead of the section you
// were on. `useTabPlace` is useState that remembers its value per tab, so the
// editor opens where you left it. Scroll positions are kept the same way by
// use-tab-scroll-memory; unsaved edits wait in the tab (use-editor-leave-save).
//
// Kept in memory for this window only, and forgotten when the tab closes.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { overhaulTabKey, useOverhaulStore, type OverhaulTabKind } from "../stores/overhaul.store";

const places = new Map<string, Map<string, unknown>>();

/** The tab key (`preset:<id>`) an editor's place is kept under; null when nothing is open. */
export function tabPlaceKey(kind: OverhaulTabKind, id: string | null | undefined): string | null {
  return id ? `${kind}:${id}` : null;
}

/** A tab's kept value outside React (undefined when none). */
export function readTabPlace<T>(key: string | null, name: string): T | undefined {
  return readPlace<T>(key, name).value;
}

/** Keep a value for a tab outside React (forgotten when the tab closes). */
export function writeTabPlace(key: string, name: string, value: unknown) {
  watchClosedTabs();
  writePlace(key, name, value);
}

function readPlace<T>(key: string | null, name: string): { found: boolean; value?: T } {
  const saved = key ? places.get(key) : undefined;
  return saved?.has(name) ? { found: true, value: saved.get(name) as T } : { found: false };
}

function writePlace(key: string, name: string, value: unknown) {
  let saved = places.get(key);
  if (!saved) places.set(key, (saved = new Map()));
  saved.set(name, value);
}

/** Forget a tab's place (its tab closed). */
export function forgetTabPlace(key: string) {
  places.delete(key);
}

let watching = false;
function watchClosedTabs() {
  if (watching) return;
  watching = true;
  let open = new Set(useOverhaulStore.getState().tabs.map(overhaulTabKey));
  useOverhaulStore.subscribe((state) => {
    const next = new Set(state.tabs.map(overhaulTabKey));
    for (const key of open) if (!next.has(key)) forgetTabPlace(key);
    open = next;
  });
}

/**
 * useState that keeps its value per tab. `tabKey` names the tab (see tabPlaceKey); when it changes (the same editor
 * showing another item) the value switches to that tab's. `opening` (`{ value }`) wins over the kept value when given: the
 * editor was opened at a given page on purpose (Mari showing a field, "Open in Regex").
 */
export function useTabPlace<T>(
  tabKey: string | null,
  name: string,
  initial: T | (() => T),
  opening?: { value: T } | null,
): [T, Dispatch<SetStateAction<T>>] {
  watchClosedTabs();
  const pick = (key: string | null): T => {
    if (opening) return opening.value;
    const saved = readPlace<T>(key, name);
    if (saved.found) return saved.value as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  };
  const [state, setState] = useState(() => ({ key: tabKey, value: pick(tabKey) }));
  let current = state;
  if (state.key !== tabKey) {
    // Another item in the same editor: its own place, set during render so the old one never shows.
    current = { key: tabKey, value: pick(tabKey) };
    setState(current);
  }
  useEffect(() => {
    if (current.key) writePlace(current.key, name, current.value);
  }, [current.key, current.value, name]);
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setState((prev) => ({
        key: prev.key,
        value: typeof next === "function" ? (next as (value: T) => T)(prev.value) : next,
      })),
    [],
  );
  return [current.value, set];
}
