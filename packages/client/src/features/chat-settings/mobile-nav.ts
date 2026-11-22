// ──────────────────────────────────────────────
// New layout on phones and tablets: Chat settings pages
//
// The sheet opens on a short "quick" page (connection, preset, persona and a
// few switches). All settings is a list of rows, and a row opens its section
// as a page of its own. "off" keeps the classic collapsible sections (Edit mode).
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { create } from "zustand";

export type MobileChatSettingsView = "off" | "quick" | "all" | "page";

interface MobileChatSettingsNavState {
  view: MobileChatSettingsView;
  /** The section shown while `view` is "page". */
  page: string | null;
  /** Where the page's back button returns: the view the page was opened from. */
  back: "quick" | "all";
  /** How far the All settings list was scrolled when a page opened from it. */
  listScroll: number;
  /** The open page's own title and help, shown in the sheet's header (the page draws no header of its own). */
  pageTitle: ReactNode;
  pageHelp: string | null;
  setPageMeta: (title: ReactNode, help: string | null) => void;
  showQuick: () => void;
  showAll: () => void;
  showPage: (id: string) => void;
  goBack: () => void;
  turnOff: () => void;
}

function scrollContainer(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-ovm-cs-view]");
}

export const useMobileChatSettingsNav = create<MobileChatSettingsNavState>()((set, get) => ({
  view: "off",
  page: null,
  back: "all",
  listScroll: 0,
  pageTitle: null,
  pageHelp: null,
  setPageMeta: (pageTitle, pageHelp) => {
    const current = get();
    if (current.pageTitle !== pageTitle || current.pageHelp !== pageHelp) set({ pageTitle, pageHelp });
  },
  showQuick: () => set({ view: "quick", page: null }),
  showAll: () => set({ view: "all", page: null }),
  showPage: (page) => {
    const { view } = get();
    const scroller = scrollContainer();
    set({
      view: "page",
      page,
      pageTitle: get().page === page ? get().pageTitle : null,
      pageHelp: get().page === page ? get().pageHelp : null,
      back: view === "quick" ? "quick" : "all",
      listScroll: view === "all" && scroller ? scroller.scrollTop : get().listScroll,
    });
    // A page always opens at its top.
    requestAnimationFrame(() => scrollContainer()?.scrollTo({ top: 0 }));
  },
  goBack: () => {
    const { back, listScroll } = get();
    set({ view: back, page: null });
    // Back to All settings lands where you left it.
    const restore = back === "all" ? listScroll : 0;
    requestAnimationFrame(() => requestAnimationFrame(() => scrollContainer()?.scrollTo({ top: restore })));
  },
  turnOff: () => set({ view: "off", page: null }),
}));
