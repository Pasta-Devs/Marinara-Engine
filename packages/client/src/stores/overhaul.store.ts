// ──────────────────────────────────────────────
// UI overhaul preview: layout state
//
// The overhaul layout (single tab bar, Library pane on the right, Library
// landing pages) is a preview that can be switched off in
// Settings > Appearance. The desktop shell gets the tab bar and side panes;
// phones and tablets get the mobile overhaul (top bar with the Library Stack,
// All Tabs viewer, long-press message sheet). Everything here is per device.
// ──────────────────────────────────────────────
import { useSyncExternalStore } from "react";
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
  | "mari"
  | "schedules"
  | "app";

/** `group` is the tab group (Vivaldi-style stack) the tab belongs to, if any. */
export type OverhaulTab = { kind: OverhaulTabKind; id: string; group?: string };

/** A tab group: its name, and the tab you were last on inside it (clicking the group opens that one). */
export type OverhaulTabGroup = { name: string; lastKey?: string };

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

export type OverhaulSettingsTab =
  "general" | "chatting" | "appearance" | "conversation" | "roleplay" | "game" | "media" | "data" | "advanced";

/** Chat settings drawer arrangement for one chat mode: section ids in order, and hidden ones. */
export type OverhaulChatSettingsLayout = { order: string[]; hidden: string[] };

/** How big the Characters / Personas gallery cards are. */
export type GalleryCardSize = "small" | "medium" | "large";

export type OverhaulGamePaneTab = "party" | "inventory" | "journal" | "map" | "sessions";

export function overhaulTabKey(tab: OverhaulTab) {
  return `${tab.kind}:${tab.id}`;
}

interface OverhaulState {
  /** Card size in the Characters / Personas galleries (this device). */
  galleryCardSize: GalleryCardSize;
  setGalleryCardSize: (size: GalleryCardSize) => void;
  /** The person's choice; on by default on this branch. */
  enabled: boolean;
  /** Set by AppShell: the desktop shell is showing (not the phone overlay shell). */
  desktop: boolean;
  tabs: OverhaulTab[];
  /** The Library landing page shown in the main area, when no editor is open. */
  libraryPage: LibrarySection | null;
  /** Characters gallery filter picked from the tag list in the Library pane. */
  characterTag: string | null;
  /** Personas gallery / Lorebooks list filters from the same tag lists ("" = untagged). */
  personaTag: string | null;
  lorebookTag: string | null;
  setPersonaTag: (tag: string | null) => void;
  setLorebookTag: (tag: string | null) => void;
  /** Which of the overhaul's Settings tabs is open. */
  settingsTab: OverhaulSettingsTab;
  setSettingsTab: (tab: OverhaulSettingsTab) => void;
  setCharacterTag: (tag: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setDesktop: (desktop: boolean) => void;
  touchTab: (tab: OverhaulTab) => void;
  closeTab: (tab: OverhaulTab) => void;
  /** Tabs the person closed this session, newest last, for "Reopen closed tab" (Ctrl+Shift+T). */
  closedTabs: OverhaulTab[];
  rememberClosedTab: (tab: OverhaulTab) => void;
  /** Takes the most recently closed tab off the list. */
  takeClosedTab: () => OverhaulTab | null;
  /** Drag-to-reorder: put the tab with `key` at `index` in the strip. */
  moveTab: (key: string, index: number) => void;
  /** Tab groups by id. A group's tabs always sit next to each other in `tabs`. */
  tabGroups: Record<string, OverhaulTabGroup>;
  /** Put tabs in a new group (at the first tab's place); returns the group id. */
  createTabGroup: (keys: string[], name?: string) => string;
  /** Move a tab into a group (null = out of its group). `index` places it; by default it goes to the group's end. */
  setTabGroup: (key: string, groupId: string | null, index?: number) => void;
  /** Move a whole group so it starts at `index` in `tabs`. */
  moveTabGroup: (groupId: string, index: number) => void;
  renameTabGroup: (groupId: string, name: string) => void;
  /** Dissolve a group; its tabs stay open. */
  ungroupTabs: (groupId: string) => void;
  setTabGroupLastKey: (groupId: string, key: string) => void;
  /** Professor Mari's chat is the page on screen (her tab). */
  activeMari: boolean;
  openMari: () => void;
  /** An installed Home app (Noodle, Slurp...) is on screen in its own tab: its package id. */
  activeApp: string | null;
  openApp: (id: string) => void;
  /** The Character schedules page is on screen (its tab). */
  activeSchedules: boolean;
  /** Open the schedules page; with an id, on that character's schedule. */
  openSchedules: (characterId?: string) => void;
  /** The character the schedules page should show next (set by openSchedules, read once by the page). */
  schedulesCharacterId: string | null;
  setSchedulesCharacterId: (id: string | null) => void;
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
  /** Phones and tablets: the Safari-style All Tabs viewer is open. */
  allTabsOpen: boolean;
  setAllTabsOpen: (open: boolean) => void;
}

/** A group's tabs stay side by side: each group gathers at its first tab's place. */
function keepGroupsTogether(tabs: OverhaulTab[]): OverhaulTab[] {
  const out: OverhaulTab[] = [];
  const placed = new Set<string>();
  for (const tab of tabs) {
    if (!tab.group) out.push(tab);
    else if (!placed.has(tab.group)) {
      placed.add(tab.group);
      out.push(...tabs.filter((entry) => entry.group === tab.group));
    }
  }
  return out;
}

/** Drop groups that no longer have tabs, and group marks that point at a missing group. */
function withoutEmptyGroups(state: { tabs: OverhaulTab[]; tabGroups: Record<string, OverhaulTabGroup> }) {
  const used = new Set(state.tabs.map((tab) => tab.group).filter(Boolean) as string[]);
  const tabGroups = Object.fromEntries(Object.entries(state.tabGroups).filter(([id]) => used.has(id)));
  const tabs = state.tabs.map((tab) => (tab.group && !tabGroups[tab.group] ? { kind: tab.kind, id: tab.id } : tab));
  return { tabs, tabGroups };
}

export const useOverhaulStore = create<OverhaulState>()(
  persist(
    (set, get) => ({
      enabled: true,
      desktop: true,
      tabs: [],
      libraryPage: null,
      characterTag: null,
      personaTag: null,
      lorebookTag: null,
      setPersonaTag: (personaTag) => set({ personaTag }),
      setLorebookTag: (lorebookTag) => set({ lorebookTag }),
      settingsTab: "general",
      setSettingsTab: (settingsTab) => set({ settingsTab }),
      setCharacterTag: (characterTag) => set({ characterTag }),
      setEnabled: (enabled) => set({ enabled }),
      setDesktop: (desktop) => set({ desktop }),
      touchTab: (tab) =>
        set((state) => {
          const key = overhaulTabKey(tab);
          if (state.tabs.some((existing) => overhaulTabKey(existing) === key)) return state;
          // No limit: tabs that don't fit the strip go to its overflow menu instead of being closed.
          return { tabs: [...state.tabs, { kind: tab.kind, id: tab.id }] };
        }),
      closedTabs: [],
      rememberClosedTab: (tab) =>
        set((state) => ({
          closedTabs: [
            ...state.closedTabs.filter((existing) => overhaulTabKey(existing) !== overhaulTabKey(tab)),
            { kind: tab.kind, id: tab.id },
          ].slice(-20),
        })),
      takeClosedTab: () => {
        const closed = get().closedTabs;
        const tab = closed[closed.length - 1] ?? null;
        if (tab) set({ closedTabs: closed.slice(0, -1) });
        return tab;
      },
      closeTab: (tab) =>
        set((state) =>
          withoutEmptyGroups({
            tabs: state.tabs.filter((existing) => overhaulTabKey(existing) !== overhaulTabKey(tab)),
            tabGroups: state.tabGroups,
          }),
        ),
      moveTab: (key, index) =>
        set((state) => {
          const from = state.tabs.findIndex((tab) => overhaulTabKey(tab) === key);
          if (from < 0) return state;
          const tabs = [...state.tabs];
          const [moved] = tabs.splice(from, 1);
          tabs.splice(Math.max(0, Math.min(index > from ? index - 1 : index, tabs.length)), 0, moved!);
          return { tabs };
        }),
      tabGroups: {},
      createTabGroup: (keys, name) => {
        const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        set((state) => {
          const wanted = new Set(keys);
          const members = state.tabs.filter((tab) => wanted.has(overhaulTabKey(tab)));
          if (!members.length) return state;
          const at = state.tabs.findIndex((tab) => wanted.has(overhaulTabKey(tab)));
          const rest = state.tabs.filter((tab) => !wanted.has(overhaulTabKey(tab)));
          const before = state.tabs.slice(0, at).filter((tab) => !wanted.has(overhaulTabKey(tab))).length;
          rest.splice(before, 0, ...members.map((tab) => ({ ...tab, group: id })));
          const count = Object.keys(state.tabGroups).length + 1;
          return withoutEmptyGroups({
            tabs: rest,
            tabGroups: { ...state.tabGroups, [id]: { name: name?.trim() || `Group ${count}` } },
          });
        });
        return id;
      },
      setTabGroup: (key, groupId, index) =>
        set((state) => {
          const from = state.tabs.findIndex((tab) => overhaulTabKey(tab) === key);
          if (from < 0) return state;
          const moved: OverhaulTab = { ...state.tabs[from]!, group: groupId ?? undefined };
          if (!groupId) delete moved.group;
          const tabs = state.tabs.filter((_, i) => i !== from);
          let at: number;
          if (index !== undefined) at = index > from ? index - 1 : index;
          else if (groupId) {
            const last = tabs.map((tab) => tab.group).lastIndexOf(groupId);
            at = last >= 0 ? last + 1 : tabs.length;
          } else {
            // Leaving a group: land just after it.
            const oldGroup = state.tabs[from]!.group;
            const last = oldGroup ? tabs.map((tab) => tab.group).lastIndexOf(oldGroup) : -1;
            at = last >= 0 ? last + 1 : from;
          }
          tabs.splice(Math.max(0, Math.min(at, tabs.length)), 0, moved);
          return withoutEmptyGroups({ tabs: keepGroupsTogether(tabs), tabGroups: state.tabGroups });
        }),
      moveTabGroup: (groupId, index) =>
        set((state) => {
          const first = state.tabs.findIndex((tab) => tab.group === groupId);
          if (first < 0) return state;
          const members = state.tabs.filter((tab) => tab.group === groupId);
          const before = state.tabs.slice(0, index).filter((tab) => tab.group !== groupId).length;
          const rest = state.tabs.filter((tab) => tab.group !== groupId);
          rest.splice(before, 0, ...members);
          return { tabs: rest };
        }),
      renameTabGroup: (groupId, name) =>
        set((state) =>
          state.tabGroups[groupId]
            ? {
                tabGroups: {
                  ...state.tabGroups,
                  [groupId]: { ...state.tabGroups[groupId]!, name: name.trim() || state.tabGroups[groupId]!.name },
                },
              }
            : state,
        ),
      ungroupTabs: (groupId) =>
        set((state) => {
          const { [groupId]: _removed, ...tabGroups } = state.tabGroups;
          return {
            tabGroups,
            tabs: state.tabs.map((tab) => (tab.group === groupId ? { kind: tab.kind, id: tab.id } : tab)),
          };
        }),
      setTabGroupLastKey: (groupId, key) =>
        set((state) =>
          state.tabGroups[groupId] && state.tabGroups[groupId]!.lastKey !== key
            ? { tabGroups: { ...state.tabGroups, [groupId]: { ...state.tabGroups[groupId]!, lastKey: key } } }
            : state,
        ),
      activeMari: false,
      openMari: () =>
        set({ activeMari: true, activeSchedules: false, activeDocsTab: null, libraryPage: null, activeApp: null }),
      activeApp: null,
      openApp: (activeApp) =>
        set({ activeApp, activeMari: false, activeSchedules: false, activeDocsTab: null, libraryPage: null }),
      activeSchedules: false,
      openSchedules: (characterId) =>
        set({
          activeSchedules: true,
          schedulesCharacterId: characterId ?? null,
          activeMari: false,
          activeDocsTab: null,
          libraryPage: null,
          activeApp: null,
        }),
      schedulesCharacterId: null,
      setSchedulesCharacterId: (schedulesCharacterId) => set({ schedulesCharacterId }),
      setLibraryPage: (libraryPage) =>
        set(
          libraryPage
            ? { libraryPage, activeDocsTab: null, activeMari: false, activeSchedules: false, activeApp: null }
            : { libraryPage },
        ),
      docsTabs: {},
      activeDocsTab: null,
      openDocs: (path, options) =>
        set((state) => {
          const tabId = options?.newTab && path ? path : "main";
          return {
            docsTabs: { ...state.docsTabs, [tabId]: path ?? state.docsTabs[tabId] ?? null },
            activeDocsTab: tabId,
            activeMari: false,
            activeSchedules: false,
            activeApp: null,
            libraryPage: null,
          };
        }),
      setDocsPath: (tabId, path) => set((state) => ({ docsTabs: { ...state.docsTabs, [tabId]: path } })),
      leaveDocs: () => set({ activeDocsTab: null, activeMari: false, activeSchedules: false, activeApp: null }),
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
      allTabsOpen: false,
      setAllTabsOpen: (allTabsOpen) => set({ allTabsOpen }),
      galleryCardSize: "medium",
      setGalleryCardSize: (galleryCardSize) => set({ galleryCardSize }),
    }),
    {
      name: "marinara-overhaul-layout",
      version: 3,
      // v2: Library sections no longer get tabs (they are one click away in the Library pane).
      // v3: neither do the Docs (one click away on the Docs button).
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { tabs?: OverhaulTab[] };
        return {
          ...state,
          tabs: (state.tabs ?? []).filter((tab) => tab.kind !== "library" && tab.kind !== "docs"),
        } as never;
      },
      partialize: (state) => ({
        enabled: state.enabled,
        tabs: state.tabs,
        tabGroups: state.tabGroups,
        libraryPage: state.libraryPage,
        settingsTab: state.settingsTab,
        docsTabs: state.docsTabs,
        chatSettingsLayouts: state.chatSettingsLayouts,
        chatSettingsWidth: state.chatSettingsWidth,
        chatSettingsFloating: state.chatSettingsFloating,
        gamePaneOpen: state.gamePaneOpen,
        gamePaneTab: state.gamePaneTab,
        galleryCardSize: state.galleryCardSize,
      }),
    },
  ),
);

/** True when the overhaul layout is on and the desktop shell is showing. */
export function useOverhaulActive() {
  return useOverhaulStore((state) => state.enabled && state.desktop);
}

/** True when the overhaul layout is on and the phone/tablet shell is showing (the mobile overhaul). */
/**
 * Messages use the long-press action menu: phones and tablets, and the desktop layout on a touch
 * screen (a tablet held sideways), where there is no hover to show the action row.
 */
const TOUCH_QUERY = "(hover: none) and (any-pointer: coarse)";

export function useOverhaulTouchMessages() {
  const enabled = useOverhaulStore((state) => state.enabled);
  const desktop = useOverhaulStore((state) => state.desktop);
  const touch = useSyncExternalStore(subscribeTouch, getTouch, () => false);
  return enabled && (!desktop || touch);
}
function subscribeTouch(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(TOUCH_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function getTouch() {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(TOUCH_QUERY).matches
  );
}

export function useOverhaulMobile() {
  return useOverhaulStore((state) => state.enabled && !state.desktop);
}

export function isOverhaulMobile() {
  const state = useOverhaulStore.getState();
  return state.enabled && !state.desktop;
}

export function isOverhaulActive() {
  const state = useOverhaulStore.getState();
  return state.enabled && state.desktop;
}

/**
 * True when the overhaul is on at any size. Pages and editors (Library, character/persona pages,
 * Home, the editors) use the overhaul look on desktop and mobile alike; only the shell differs.
 */
export function useOverhaulLook() {
  return useOverhaulStore((state) => state.enabled);
}

export function isOverhaulLook() {
  return useOverhaulStore.getState().enabled;
}
