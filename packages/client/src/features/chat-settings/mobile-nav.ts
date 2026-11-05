// ──────────────────────────────────────────────
// New layout on phones and tablets: Chat settings pages
//
// The sheet opens on a short "quick" page (connection, preset, persona and a
// few switches). All settings is a list of rows, and a row opens its section
// as a page of its own. "off" keeps the classic collapsible sections (Edit mode).
// ──────────────────────────────────────────────
import { create } from "zustand";

export type MobileChatSettingsView = "off" | "quick" | "all" | "page";

interface MobileChatSettingsNavState {
  view: MobileChatSettingsView;
  /** The section shown while `view` is "page". */
  page: string | null;
  showQuick: () => void;
  showAll: () => void;
  showPage: (id: string) => void;
  turnOff: () => void;
}

export const useMobileChatSettingsNav = create<MobileChatSettingsNavState>()((set) => ({
  view: "off",
  page: null,
  showQuick: () => set({ view: "quick", page: null }),
  showAll: () => set({ view: "all", page: null }),
  showPage: (page) => set({ view: "page", page }),
  turnOff: () => set({ view: "off", page: null }),
}));
