// ──────────────────────────────────────────────
// Touch gestures catalog (Settings › Shortcuts › Touch gestures, docs/home/shortcuts-and-gestures.md)
// ──────────────────────────────────────────────
// Every entry mirrors a gesture that exists in the code; the comment above it
// names where. Keep this list in sync when adding or removing a gesture.

export interface TouchGesture {
  id: string;
  /** Localization key of the gesture ("Swipe the top bar's title"). */
  gestureKey: string;
  /** Localization key of what it does. */
  labelKey: string;
  /** Only works while "Swipe gestures on touch screens" is on. */
  needsSwipeSetting?: boolean;
}

export const TOUCH_GESTURES: readonly TouchGesture[] = [
  // lib/back-navigation.ts (Safari, Chrome, Android); edge-swipe-back.ts in the installed iPhone / iPad app
  { id: "edge-back", gestureKey: "gestures.edgeBack.gesture", labelKey: "gestures.edgeBack.label" },
  // MobileTopBar titleSwipe (use-horizontal-swipe.ts)
  {
    id: "title-swipe",
    gestureKey: "gestures.titleSwipe.gesture",
    labelKey: "gestures.titleSwipe.label",
    needsSwipeSetting: true,
  },
  // use-pull-to-open-omnibar.ts (TopBar)
  { id: "pull-search", gestureKey: "gestures.pullSearch.gesture", labelKey: "gestures.pullSearch.label" },
  // ChatSidebar pull to refresh (use-pull-to-refresh.ts)
  { id: "pull-refresh", gestureKey: "gestures.pullRefresh.gesture", labelKey: "gestures.pullRefresh.label" },
  // ChatArea phone swipes on the latest reply
  {
    id: "reply-swipe",
    gestureKey: "gestures.replySwipe.gesture",
    labelKey: "gestures.replySwipe.label",
    needsSwipeSetting: true,
  },
  // SwipeActionsRow in ChatSidebar
  {
    id: "row-swipe",
    gestureKey: "gestures.rowSwipe.gesture",
    labelKey: "gestures.rowSwipe.label",
    needsSwipeSetting: true,
  },
  // MobileMessageSheet, RowActionSheet, tab menus
  { id: "hold", gestureKey: "gestures.hold.gesture", labelKey: "gestures.hold.label" },
];
