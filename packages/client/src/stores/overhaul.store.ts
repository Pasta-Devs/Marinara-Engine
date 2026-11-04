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
  | "chat"
  | "character"
  | "persona"
  | "lorebook"
  | "preset"
  | "connection"
  | "agent"
  | "regex"
  | "library"
  | "docs"
  | "mari";

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

/** Chat settings drawer arrangement for one chat mode: section ids in order, and hidden ones. */
export type OverhaulChatSettingsLayout = { order: string[]; hidden: string[] };

export type OverhaulGamePaneTab = "party" | "inventory" | "journal" | "map" | "sessions";

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
  /** Drag-to-reorder: put the tab with `key` at `index` in the strip. */
  moveTab: (key: string, index: number) => void;
  /** Professor Mari's chat is the page on screen (her tab). */
  activeMari: boolean;
  openMari: () => void;
  setLibraryPage: (section: LibrarySection | null) => void;
  /** Docs tabs: tab id -> open guide path (null = guide index). */
  docsTabs: Record<string, string | null>;
  /** The Docs tab showing in the main area, if any. */
  activeDocsTab: string | null;
  /** Open the docs in a tab. `newTab` gives the guide its own tab (Macro Reference). */
  openDocs: (path: string | null, options?: { newTab?: boolean }) => void;
  setDocsPath: (tabId: string, path: string | null) => void;
  leaveDocs: () => void;
  /** Chat settings drawer: per chat mode order/hidden sections (Edit mode). */
  chatSettingsLayouts: Record<string, OverhaulChatSettingsLayout>;
  setChatSettingsLayout: (mode: string, layout: OverhaulChatSettingsLayout | null) => void;
  /** Docked drawer width in px (0 = default). */
  chatSettingsWidth: number;
  setChatSettingsWidth: (width: number) => void;
  /** Float the drawer as the movable, resizable window instead of docking it on the right. */
  chatSettingsFloating: boolean;
  setChatSettingsFloating: (floating: boolean) => void;
  chatSettingsEditing: boolean;
  setChatSettingsEditing: (editing: boolean) => void;
  /** Game Mode's right pane (Party, Inventory, Journal, Map, Sessions). */
  gamePaneOpen: boolean;
  setGamePaneOpen: (open: boolean) => void;
  gamePaneTab: OverhaulGamePaneTab;
  setGamePaneTab: (tab: OverhaulGamePaneTab) => void;
  /** Where Chat settings shows the game's own tools (the game portals them in). */
  gameSettingsSlot: HTMLElement | null;
  setGameSettingsSlot: (element: HTMLElement | null) => void;
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
      moveTab: (key, index) =>
        set((state) => {
          const from = state.tabs.findIndex((tab) => overhaulTabKey(tab) === key);
          if (from < 0) return state;
          const tabs = [...state.tabs];
          const [moved] = tabs.splice(from, 1);
          tabs.splice(Math.max(0, Math.min(index > from ? index - 1 : index, tabs.length)), 0, moved!);
          return { tabs };
        }),
      activeMari: false,
      openMari: () => set({ activeMari: true, activeDocsTab: null, libraryPage: null }),
      setLibraryPage: (libraryPage) =>
        set(libraryPage ? { libraryPage, activeDocsTab: null, activeMari: false } : { libraryPage }),
      docsTabs: {},
      activeDocsTab: null,
      openDocs: (path, options) =>
        set((state) => {
          const tabId = options?.newTab && path ? path : "main";
          return {
            docsTabs: { ...state.docsTabs, [tabId]: path ?? state.docsTabs[tabId] ?? null },
            activeDocsTab: tabId,
            activeMari: false,
            libraryPage: null,
          };
        }),
      setDocsPath: (tabId, path) => set((state) => ({ docsTabs: { ...state.docsTabs, [tabId]: path } })),
      leaveDocs: () => set({ activeDocsTab: null, activeMari: false }),
      chatSettingsLayouts: {},
      setChatSettingsLayout: (mode, layout) =>
        set((state) => {
          const chatSettingsLayouts = { ...state.chatSettingsLayouts };
          if (layout) chatSettingsLayouts[mode] = layout;
          else delete chatSettingsLayouts[mode];
          return { chatSettingsLayouts };
        }),
      chatSettingsWidth: 0,
      setChatSettingsWidth: (chatSettingsWidth) => set({ chatSettingsWidth }),
      chatSettingsFloating: false,
      setChatSettingsFloating: (chatSettingsFloating) => set({ chatSettingsFloating }),
      chatSettingsEditing: false,
      setChatSettingsEditing: (chatSettingsEditing) => set({ chatSettingsEditing }),
      gamePaneOpen: true,
      setGamePaneOpen: (gamePaneOpen) => set({ gamePaneOpen }),
      gamePaneTab: "party",
      setGamePaneTab: (gamePaneTab) => set({ gamePaneTab }),
      gameSettingsSlot: null,
      setGameSettingsSlot: (gameSettingsSlot) => set({ gameSettingsSlot }),
    }),
    {
      name: "marinara-overhaul-layout",
      version: 2,
      // v2: Library sections no longer get tabs (they are one click away in the Library pane).
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { tabs?: OverhaulTab[] };
        return { ...state, tabs: (state.tabs ?? []).filter((tab) => tab.kind !== "library") } as never;
      },
      partialize: (state) => ({
        enabled: state.enabled,
        tabs: state.tabs,
        libraryPage: state.libraryPage,
        settingsTab: state.settingsTab,
        docsTabs: state.docsTabs,
        chatSettingsLayouts: state.chatSettingsLayouts,
        chatSettingsWidth: state.chatSettingsWidth,
        chatSettingsFloating: state.chatSettingsFloating,
        gamePaneOpen: state.gamePaneOpen,
        gamePaneTab: state.gamePaneTab,
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
