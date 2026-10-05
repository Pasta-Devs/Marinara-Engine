// ──────────────────────────────────────────────
// Drawer hosts: the windows whose drawers can pop out
//
// A host window (Chat Settings, the Trackers window) provides this context, and
// every <Drawer> with an id inside it gets a pop-out button and drag-out. The
// popped-out window borrows the host's look from here.
// ──────────────────────────────────────────────
import { createContext, useContext } from "react";
import { create } from "zustand";
import type { FloatingWindowId } from "../../lib/floating-window-layout";
import { selectHasDetachedDrawers, useFloatingWindowStore } from "../../stores/floating-window.store";

export interface DrawerHost {
  /** The host window's id ("chat-settings", "trackers"). */
  id: FloatingWindowId;
  /** Its name, for the "Put back in …" close button. */
  title: string;
  /** Classes for a popped-out drawer's window, so it looks like its host. */
  windowClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  /** Classes for the scrolling area inside that window. */
  scrollClassName?: string;
  /** The host's own data attributes (such as `data-chat-floating-panel`), so its windows count as part of it. */
  rootAttributes?: Record<`data-${string}`, string | boolean | undefined>;
  ignoreOutsidePointer?: (target: Element) => boolean;
}

export const DrawerHostContext = createContext<DrawerHost | null>(null);

/** Chat-owned controls keep their React context while rendering inside this explicit Settings slot. */
export const useChatControlDockStore = create<{
  element: HTMLDivElement | null;
  setElement: (element: HTMLDivElement | null) => void;
}>()((set) => ({ element: null, setElement: (element) => set({ element }) }));

export function useDrawerHost() {
  return useContext(DrawerHostContext);
}

/**
 * True while a drawer of `hostId` is popped out (a window on a computer, a bubble on a phone). The host
 * then stays mounted, hidden when closed, because popped-out drawers render from inside it.
 */
export function useHostHasDetachedDrawers(hostId: FloatingWindowId) {
  return useFloatingWindowStore((state) => selectHasDetachedDrawers(state, hostId));
}
