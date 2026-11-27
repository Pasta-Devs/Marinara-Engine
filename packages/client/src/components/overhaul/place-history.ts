// ──────────────────────────────────────────────
// UI overhaul: Back and Forward between the places you visited
//
// Every page change (a tab, Home, a Library section, the Docs, Professor Mari) is
// remembered in order, like a browser's history. Back (Alt+←, ⌘[ on a Mac, the
// mouse's back button, the top bar's ← arrow) returns to the place before; Forward
// goes the other way again. A new page change drops the places ahead of it.
//
// It never touches the browser's own history: the keys and mouse buttons are taken
// only when there is a place to go to, so with nothing to go back to the browser
// does what it always does (back-navigation.ts keeps a desktop browser from being
// trapped). Places whose tab has been closed since are skipped.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { useChatStore } from "../../stores/chat.store";
import { overhaulTabKey, useOverhaulStore } from "../../stores/overhaul.store";
import { placeKey, recordPlace, type Place } from "../../lib/navigation-keys";
import { useUIStore } from "../../stores/ui.store";
import { SPLIT_PANE } from "../../lib/split-view-env";
import { activateTab, currentTabNow, goHome } from "./OverhaulTopBar";

type PlaceHistoryState = {
  entries: Place[];
  index: number;
  canBack: boolean;
  canForward: boolean;
};

export const usePlaceHistory = create<PlaceHistoryState>(() => ({
  entries: [],
  index: -1,
  canBack: false,
  canForward: false,
}));

/** True when `place` can still be shown: Home, a Library section, an open Docs tab, or a tab that is still open. */
export function placeStillThere(place: Place): boolean {
  if (!place) return true;
  const overhaul = useOverhaulStore.getState();
  if (place.kind === "library") return true;
  if (place.kind === "docs") return place.id in overhaul.docsTabs;
  const key = overhaulTabKey(place);
  return overhaul.tabs.some((tab) => overhaulTabKey(tab) === key);
}

function nextIndex(entries: Place[], from: number, step: -1 | 1): number {
  for (let index = from + step; index >= 0 && index < entries.length; index += step) {
    if (placeStillThere(entries[index]!)) return index;
  }
  return -1;
}

function publish(entries: Place[], index: number) {
  usePlaceHistory.setState({
    entries,
    index,
    canBack: nextIndex(entries, index, -1) >= 0,
    canForward: nextIndex(entries, index, 1) >= 0,
  });
}

/** Set while Back or Forward is showing a place, so that change is not recorded as a new visit. */
let travelling: string | null = null;

function show(place: Place) {
  if (place) activateTab(place);
  else goHome();
}

function travel(step: -1 | 1): boolean {
  const { entries, index } = usePlaceHistory.getState();
  const target = nextIndex(entries, index, step);
  if (target < 0) return false;
  const place = entries[target]!;
  travelling = placeKey(place);
  publish(entries, target);
  show(place);
  return true;
}

export const goBackPlace = () => travel(-1);
export const goForwardPlace = () => travel(1);

/** The overhaul's Back and Forward apply on the desktop shell (also a tablet held sideways), not inside a split side. */
export function placeHistoryActive(): boolean {
  const overhaul = useOverhaulStore.getState();
  return overhaul.enabled && overhaul.desktop && !SPLIT_PANE;
}

/** Starts recording page changes. Returns the cleanup. */
export function watchPlaceHistory(): () => void {
  let queued = false;
  const check = () => {
    if (queued) return;
    queued = true;
    // One tap can change several stores (close the editor, then open the chat): record where it settles.
    queueMicrotask(() => {
      queued = false;
      if (!useOverhaulStore.getState().enabled) return;
      const place = currentTabNow();
      const key = placeKey(place);
      const { entries, index } = usePlaceHistory.getState();
      if (travelling !== null) {
        const arrived = travelling === key;
        travelling = null;
        // Arrived where Back/Forward was going: nothing new to record.
        if (arrived) {
          publish(entries, index);
          return;
        }
      }
      const next = recordPlace(entries, index, place);
      if (next.entries !== entries || next.index !== index) publish(next.entries, next.index);
      else publish(entries, index);
    });
  };
  check();
  const unsubscribers = [useUIStore.subscribe(check), useOverhaulStore.subscribe(check), useChatStore.subscribe(check)];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
