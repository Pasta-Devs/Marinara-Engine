// ──────────────────────────────────────────────
// UI overhaul preview: layout state
//
// The overhaul layout (single tab bar, Library pane on the right, Library
// landing pages) is a preview that can be switched off in
// Settings > Appearance. It only applies to the desktop shell; phones keep the
// standard layout. Everything here is per device.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OverhaulTabKind =
  "chat" | "character" | "persona" | "lorebook" | "preset" | "connection" | "agent" | "regex" | "library" | "docs";

export type OverhaulTab = { kind: OverhaulTabKind; id: string };

/** Library sections shown in the right-hand Library pane. */
export type LibrarySection =
  | "characters"
  | "personas"
  | "lorebooks"
  | "presets"
  | "regex"
  | "connections"
  | "agents"
  | "settings"
  | "extensions"
  | "bot-browser";

export const MAX_OVERHAUL_TABS = 8;

export type OverhaulSettingsTab = "general" | "chatting" | "appearance" | "chat-modes" | "media" | "data" | "advanced";

export function overhaulTabKey(tab: OverhaulTab) {
  return `${tab.kind}:${tab.id}`;
}

interface OverhaulState {
  /** The person's choice; on by default on this branch. */
  enabled: boolean;
  /** Set by AppShell: the desktop shell is showing (not the phone overlay shell). */
  desktop: boolean;
  tabs: OverhaulTab[];
  /** The Library landing page shown in the main area, when no editor is open. */
  libraryPage: LibrarySection | null;
  /** Characters gallery filter picked from the tag list in the Library pane. */
  characterTag: string | null;
  /** Which of the overhaul's Settings tabs is open. */
  settingsTab: OverhaulSettingsTab;
  setSettingsTab: (tab: OverhaulSettingsTab) => void;
  setCharacterTag: (tag: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setDesktop: (desktop: boolean) => void;
  touchTab: (tab: OverhaulTab) => void;
  closeTab: (tab: OverhaulTab) => void;
  setLibraryPage: (section: LibrarySection | null) => void;
  /** Docs tabs: tab id -> open guide path (null = guide index). */
  docsTabs: Record<string, string | null>;
  /** The Docs tab showing in the main area, if any. */
  activeDocsTab: string | null;
  /** Open the docs in a tab. `newTab` gives the guide its own tab (Macro Reference). */
  openDocs: (path: string | null, options?: { newTab?: boolean }) => void;
  setDocsPath: (tabId: string, path: string | null) => void;
  leaveDocs: () => void;
}

export const useOverhaulStore = create<OverhaulState>()(
  persist(
    (set) => ({
      enabled: true,
      desktop: true,
      tabs: [],
      libraryPage: null,
      characterTag: null,
      settingsTab: "general",
      setSettingsTab: (settingsTab) => set({ settingsTab }),
      setCharacterTag: (characterTag) => set({ characterTag }),
      setEnabled: (enabled) => set({ enabled }),
      setDesktop: (desktop) => set({ desktop }),
      touchTab: (tab) =>
        set((state) => {
          const key = overhaulTabKey(tab);
          if (state.tabs.some((existing) => overhaulTabKey(existing) === key)) return state;
          const tabs = [...state.tabs, tab];
          // Oldest tabs fall off the front once the strip is full.
          return { tabs: tabs.slice(Math.max(0, tabs.length - MAX_OVERHAUL_TABS)) };
        }),
      closeTab: (tab) =>
        set((state) => ({ tabs: state.tabs.filter((existing) => overhaulTabKey(existing) !== overhaulTabKey(tab)) })),
      setLibraryPage: (libraryPage) => set(libraryPage ? { libraryPage, activeDocsTab: null } : { libraryPage }),
      docsTabs: {},
      activeDocsTab: null,
      openDocs: (path, options) =>
        set((state) => {
          const tabId = options?.newTab && path ? path : "main";
          return {
            docsTabs: { ...state.docsTabs, [tabId]: path ?? state.docsTabs[tabId] ?? null },
            activeDocsTab: tabId,
            libraryPage: null,
          };
        }),
      setDocsPath: (tabId, path) => set((state) => ({ docsTabs: { ...state.docsTabs, [tabId]: path } })),
      leaveDocs: () => set({ activeDocsTab: null }),
    }),
    {
      name: "marinara-overhaul-layout",
      version: 1,
      partialize: (state) => ({
        enabled: state.enabled,
        tabs: state.tabs,
        libraryPage: state.libraryPage,
        settingsTab: state.settingsTab,
        docsTabs: state.docsTabs,
      }),
    },
  ),
);

/** True when the overhaul layout is on and the desktop shell is showing. */
export function useOverhaulActive() {
  return useOverhaulStore((state) => state.enabled && state.desktop);
}

export function isOverhaulActive() {
  const state = useOverhaulStore.getState();
  return state.enabled && state.desktop;
}
