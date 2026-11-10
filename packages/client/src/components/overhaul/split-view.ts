// ──────────────────────────────────────────────
// UI overhaul (desktop): split view, browser style
//
// Drag a tab (or Home, a Library section, a chat from the chat list, the Docs
// button) to the far left or right of the page and drop it there: the page
// splits, with what you dragged on that side and the page you were on beside
// it. The tab bar, chat list and Library pane keep working on the main side;
// the second side has a slim bar of its own (swap sides, show only it, close).
// Phones never split; the phone shell has no room for two pages.
//
// This file is the light part (state and actions). The second side, its frame
// and the drop targets are in SplitView.tsx, loaded when first needed.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import type { SplitPage } from "../../lib/split-view-env";
import { overhaulTabKey, useOverhaulStore, type OverhaulTab } from "../../stores/overhaul.store";
import { activateTab, currentTabNow, goHome } from "./OverhaulTopBar";

export const SPLIT_MIME = "application/x-marinara-split-page";
/** The main side never gets narrower than this. */
export const SPLIT_MIN_SIDE = 440;
/** The second side can go down to phone width: below SPLIT_PANE_PHONE_WIDTH it shows the tablet or phone layout. */
export const SPLIT_MIN_SECOND = 340;
/** Room needed for two pages; with less, the page shows one side only. */
export const SPLIT_MIN_ROOM = SPLIT_MIN_SIDE + SPLIT_MIN_SECOND + 6;
export const SPLIT_DIVIDER = 6;
export const HOME_PAGE: SplitPage = { kind: "home", id: "main" };

/** Pages that are not tabs (Home, Library sections, the Docs): they are one click away instead. */
const NOT_TABS = new Set(["home", "library", "docs"]);

export const splitPageKey = (page: SplitPage | null) => (page ? `${page.kind}:${page.id}` : "home:main");
export const isTabPage = (page: SplitPage) => !NOT_TABS.has(page.kind);

/**
 * Pages that stay on the main side. Settings: the second side keeps its own copy of the app's settings
 * in memory, so changes made there would not be saved.
 */
export const canSplit = (page: SplitPage) => !(page.kind === "library" && page.id === "settings");

export function pageOfTab(tab: OverhaulTab | null): SplitPage {
  if (!tab) return HOME_PAGE;
  if (tab.kind === "docs")
    return { kind: "docs", id: tab.id, path: useOverhaulStore.getState().docsTabs[tab.id] ?? null };
  return { kind: tab.kind, id: tab.id };
}

/** Show a page on this window's main side (in the second side's frame, that frame's only side). */
export function showPage(page: SplitPage) {
  if (page.kind === "home") {
    goHome();
    return;
  }
  const store = useOverhaulStore.getState();
  if (page.kind === "docs" && page.path !== undefined) store.setDocsPath(page.id, page.path ?? null);
  if (isTabPage(page)) store.touchTab(page as OverhaulTab);
  activateTab(page as OverhaulTab);
}

/** Load the second side's code ahead of the first drop, so the drop targets show at once. */
export const loadSplitView = () => import("./SplitView");

export function beginSplitDrag(page: SplitPage) {
  if (!canSplit(page)) return;
  void loadSplitView();
  if (useOverhaulStore.getState().splitDrag !== page) useOverhaulStore.getState().setSplitDrag(page);
}

export function endSplitDrag() {
  if (useOverhaulStore.getState().splitDrag) useOverhaulStore.getState().setSplitDrag(null);
}

let dropHandler: ((x: number, y: number) => boolean) | null = null;

/** Set by the drop targets while they're up: lands a drag at x, y, true when it hit one. */
export function setSplitDropHandler(handler: ((x: number, y: number) => boolean) | null) {
  dropHandler = handler;
}

/**
 * The chat list drags rows its own way (not the browser's drag and drop): where such a drag ends, a chat
 * dropped on a split target opens there. True when it did.
 */
export function dropSplitAt(x: number, y: number) {
  const landed = dropHandler ? dropHandler(x, y) : false;
  endSplitDrag();
  return landed;
}

/** Drag props for things that can be dropped at a side to split (Library sections, the Docs button). */
export function splitDragProps(page: () => SplitPage) {
  if (!canSplit(page())) return {};
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData(SPLIT_MIME, "1");
      beginSplitDrag(page());
    },
    onDragEnd: endSplitDrag,
  };
}

/**
 * Put a page on the second side. The page you were on stays on the main side; if you split the page
 * you were on, the main side shows what was on the second side (or the next tab, or Home).
 */
export function openInSplit(page: SplitPage, side?: "left" | "right") {
  if (!canSplit(page)) return false;
  const store = useOverhaulStore.getState();
  const before = store.split;
  const key = splitPageKey(page);
  const main = pageOfTab(currentTabNow());
  if (isTabPage(page)) store.touchTab(page as OverhaulTab);
  let mainNext: SplitPage | null = null;
  if (splitPageKey(main) === key) {
    if (before && splitPageKey(before.page) !== key) mainNext = before.page;
    else {
      const tabs = store.tabs;
      const at = tabs.findIndex((tab) => overhaulTabKey(tab) === key);
      const others = tabs.filter((tab) => overhaulTabKey(tab) !== key);
      const next = others[Math.max(0, Math.min(at, others.length - 1))];
      mainNext = next ? pageOfTab(next) : page.kind === "home" ? null : HOME_PAGE;
      // Home dragged off Home with no tabs open: there is nothing to show beside it.
      if (!mainNext) return false;
    }
  }
  store.setSplit({ page, side: side ?? before?.side ?? "right", size: before?.size ?? 0.5 });
  if (mainNext) showPage(mainNext);
  return true;
}

/** Show a page on the main side (a drop on it). If it was on the second side, the two sides trade pages. */
export function openInMain(page: SplitPage) {
  showPage(page);
}

export function closeSplit() {
  useOverhaulStore.getState().setSplit(null);
}

/** Room for the two pages: the window minus the chat list and the Library pane. */
export function useSplitRoom(leftWidth: number, rightWidth: number) {
  const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? 1920 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return Math.max(0, viewport - leftWidth - rightWidth);
}

/** The second side's share, kept between its phone-width minimum and the main side's minimum. */
export function clampSplitSize(size: number, room: number) {
  const usable = Math.max(1, room - SPLIT_DIVIDER);
  const min = SPLIT_MIN_SECOND / usable;
  const max = 1 - SPLIT_MIN_SIDE / usable;
  if (min >= max) return Math.min(0.5, Math.max(0, max));
  return Math.min(max, Math.max(min, size));
}
