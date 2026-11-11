// ──────────────────────────────────────────────
// UI overhaul: the single top bar
//
// One browser-style strip replaces the old top bar and Home's fake browser
// chrome: chat list toggle, Home, one tab per chat or editor you opened, then
// Chat settings, Help, Library and the Library pane toggle on the right.
// Sidebar collapse controls live here, never over the chat background.
// ──────────────────────────────────────────────
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  FileText,
  Gamepad2,
  GraduationCap,
  Layers,
  Link,
  Plus,
  Regex,
  Settings2,
  Sparkles,
  Users,
  VenetianMask,
  type LucideIcon,
} from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import {
  overhaulTabKey,
  useOverhaulStore,
  type LibrarySection,
  type OverhaulTab,
  type OverhaulTabKind,
} from "../../stores/overhaul.store";
import { useChats } from "../../hooks/use-chats";
import { useCharacter, usePersona } from "../../hooks/use-characters";
import { useLorebook } from "../../hooks/use-lorebooks";
import { useConnection, useConnections } from "../../hooks/use-connections";
import { usePresetFull } from "../../hooks/use-presets";
import { getChatDisplayName, parseChatMetadata, stripChatDateSuffix } from "../../lib/chat-display";
import { resolveLiveConversationStatus } from "../../lib/conversation-presence-status";
import { useDocsIndex } from "../../hooks/use-docs";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { MariTopbarStatus } from "../layout/MariTopbarStatus";
import { useMariEdgeGlow } from "../../hooks/use-mari-presence";
import {
  PersonalExtensionContributionsMenu,
  PersonalExtensionTopbarButtons,
} from "../layout/PersonalExtensionContributionsMenu";
import { preloadChatSettingsDrawer } from "../chat/ChatCommonOverlays";
import { BrowserPackageTabIcon } from "../chat/BrowserPackageTabIcon";
import { selectHomeBrowserPackages, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { resolveCapabilityPackageDisplay } from "../../lib/capability-package-localization";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";
import { useTabScrollMemory } from "./use-tab-scroll-memory";
import { splitDragProps } from "./split-view";
// Its own chunk, so the app shell stays under the bundle budget.
const DesktopTabStrip = lazy(() => import("./DesktopTabStrip").then((module) => ({ default: module.DesktopTabStrip })));

const TAB_ICONS: Record<Exclude<OverhaulTabKind, "chat" | "library" | "app">, LucideIcon> = {
  character: Users,
  persona: VenetianMask,
  lorebook: BookOpen,
  preset: FileText,
  connection: Link,
  agent: Sparkles,
  regex: Regex,
  docs: CircleHelp,
  mari: GraduationCap,
  schedules: CalendarDays,
};

const MODE_DOT: Record<string, string> = {
  conversation: "var(--ov-mode-conversation)",
  roleplay: "var(--ov-mode-roleplay)",
  game: "var(--ov-mode-game)",
};

type CurrentTabInputs = {
  activeChatId: string | null;
  characterDetailId: string | null;
  personaDetailId: string | null;
  lorebookDetailId: string | null;
  presetDetailId: string | null;
  connectionDetailId: string | null;
  agentDetailId: string | null;
  regexDetailId: string | null;
  toolDetailId: string | null;
  characterLibraryOpen: boolean;
  cardLibraryKind: string;
  libraryPage: LibrarySection | null;
  activeDocsTab: string | null;
  activeMari: boolean;
  activeSchedules: boolean;
  activeApp: string | null;
};

function currentTabFrom(v: CurrentTabInputs): OverhaulTab | null {
  const real = (id: string | null | undefined) => (id && id !== "__new__" ? id : null);
  if (v.activeSchedules) return { kind: "schedules", id: "main" };
  if (v.activeMari) return { kind: "mari", id: "main" };
  if (v.activeDocsTab) return { kind: "docs", id: v.activeDocsTab };
  // Regex scripts, Connections and Agents open in one viewer per section, so they share its Library tab.
  if (v.regexDetailId) return { kind: "library", id: "regex" };
  if (v.toolDetailId) return { kind: "library", id: "tools" };
  if (real(v.personaDetailId)) return { kind: "persona", id: v.personaDetailId! };
  if (v.agentDetailId) return { kind: "library", id: "agents" };
  if (v.connectionDetailId) return { kind: "library", id: "connections" };
  if (real(v.presetDetailId)) return { kind: "preset", id: v.presetDetailId! };
  if (real(v.characterDetailId)) return { kind: "character", id: v.characterDetailId! };
  if (v.characterLibraryOpen)
    return { kind: "library", id: v.cardLibraryKind === "personas" ? "personas" : "characters" };
  if (real(v.lorebookDetailId)) return { kind: "lorebook", id: v.lorebookDetailId! };
  if (v.libraryPage) return { kind: "library", id: v.libraryPage };
  if (v.activeChatId) return { kind: "chat", id: v.activeChatId };
  if (v.activeApp) return { kind: "app", id: v.activeApp };
  return null;
}

/** The page on screen right now, read outside React (split view uses it when a drop lands). */
export function currentTabNow(): OverhaulTab | null {
  const ui = useUIStore.getState();
  const overhaul = useOverhaulStore.getState();
  return currentTabFrom({
    activeChatId: useChatStore.getState().activeChatId,
    characterDetailId: ui.characterDetailId,
    personaDetailId: ui.personaDetailId,
    lorebookDetailId: ui.lorebookDetailId,
    presetDetailId: ui.presetDetailId,
    connectionDetailId: ui.connectionDetailId,
    agentDetailId: ui.agentDetailId,
    regexDetailId: ui.regexDetailId,
    toolDetailId: ui.toolDetailId,
    characterLibraryOpen: ui.characterLibraryOpen,
    cardLibraryKind: ui.cardLibraryKind,
    libraryPage: overhaul.libraryPage,
    activeDocsTab: overhaul.activeDocsTab,
    activeMari: overhaul.activeMari,
    activeSchedules: overhaul.activeSchedules,
    activeApp: overhaul.activeApp,
  });
}

/** The editor or chat on screen right now, as a tab; null on Home. */
export function useCurrentTab(): OverhaulTab | null {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const libraryPage = useOverhaulStore((s) => s.libraryPage);
  const activeDocsTab = useOverhaulStore((s) => s.activeDocsTab);
  const activeMari = useOverhaulStore((s) => s.activeMari);
  const activeSchedules = useOverhaulStore((s) => s.activeSchedules);
  const activeApp = useOverhaulStore((s) => s.activeApp);
  return useMemo(
    () =>
      currentTabFrom({
        activeChatId,
        characterDetailId,
        personaDetailId,
        lorebookDetailId,
        presetDetailId,
        connectionDetailId,
        agentDetailId,
        regexDetailId,
        toolDetailId,
        characterLibraryOpen,
        cardLibraryKind,
        libraryPage,
        activeDocsTab,
        activeMari,
        activeSchedules,
        activeApp,
      }),
    [
      activeApp,
      activeChatId,
      activeDocsTab,
      activeMari,
      activeSchedules,
      agentDetailId,
      cardLibraryKind,
      characterDetailId,
      characterLibraryOpen,
      connectionDetailId,
      libraryPage,
      lorebookDetailId,
      personaDetailId,
      presetDetailId,
      regexDetailId,
      toolDetailId,
    ],
  );
}

export function goHome() {
  window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
  useOverhaulStore.getState().leaveDocs();
  useOverhaulStore.getState().setLibraryPage(null);
  useChatStore.getState().setActiveChatId(null);
  useUIStore.getState().closeAllDetails();
}

export function activateTab(tab: OverhaulTab) {
  const ui = useUIStore.getState();
  const overhaul = useOverhaulStore.getState();
  if (tab.kind === "docs") {
    ui.closeAllDetails();
    useOverhaulStore.setState({ activeDocsTab: tab.id, activeMari: false, libraryPage: null });
    return;
  }
  if (tab.kind === "mari") {
    ui.closeAllDetails();
    overhaul.openMari();
    return;
  }
  if (tab.kind === "schedules") {
    ui.closeAllDetails();
    overhaul.openSchedules();
    return;
  }
  if (tab.kind === "app") {
    ui.closeAllDetails();
    useChatStore.getState().setActiveChatId(null);
    overhaul.openApp(tab.id);
    return;
  }
  overhaul.leaveDocs();
  switch (tab.kind) {
    case "chat":
      ui.closeAllDetails();
      overhaul.setLibraryPage(null);
      useChatStore.getState().setActiveChatId(tab.id);
      return;
    case "library":
      openLibrarySection(tab.id as LibrarySection);
      return;
    case "character":
      ui.openCharacterDetail(tab.id);
      return;
    case "persona":
      ui.openPersonaDetail(tab.id);
      return;
    case "lorebook":
      ui.openLorebookDetail(tab.id);
      return;
    case "preset":
      ui.openPresetDetail(tab.id);
      return;
    case "connection":
      ui.openConnectionDetail(tab.id);
      return;
    case "agent":
      ui.openAgentDetail(tab.id);
      return;
    case "regex":
      ui.openRegexDetail(tab.id);
      return;
  }
}

function parseCharacterName(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const data = (record as { data?: unknown }).data;
  try {
    const parsed = typeof data === "string" ? (JSON.parse(data) as { name?: unknown }) : (data as { name?: unknown });
    return typeof parsed?.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}

export function nameOf(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const name = (record as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name : null;
}

/** "Roleplay · Claude Opus": the chat's mode and the model it talks to. */
export function ChatSettingsSummary({ chat, fallback }: { chat: Chat; fallback: string }) {
  // One fixed format everywhere: "Mode · model" (panel 3, PV14/N10a). The preset and agent count made the
  // label change while things loaded and from chat to chat; both are one click away in Chat settings.
  const { data: connections } = useConnections();
  const list = Array.isArray(connections) ? (connections as Array<Record<string, unknown>>) : [];
  const connection = chat.connectionId
    ? list.find((item) => item.id === chat.connectionId)
    : list.find((item) => item.isDefault === true);
  const parts = [fallback, nameOf(connection)].filter(Boolean);
  return <small>{parts.join(" · ")}</small>;
}

/** Installed Home apps (Noodle, Slurp...) with their tab label and icon. */
function useHomeApps() {
  const { i18n } = useTranslation();
  const installed = useInstalledCapabilityPackages();
  return useMemo(
    () => ({
      loaded: Boolean(installed.data),
      apps: selectHomeBrowserPackages(installed.data).map((item) => {
        const display = resolveCapabilityPackageDisplay(item.manifest, i18n.resolvedLanguage ?? i18n.language);
        return {
          id: item.id,
          version: item.version,
          label: display.homeBrowserTab?.label ?? display.name,
          iconPaths: display.homeBrowserTab?.iconPaths,
        };
      }),
    }),
    [i18n.language, i18n.resolvedLanguage, installed.data],
  );
}

/** Resolves a tab's label with the same queries the editors use, so it is usually cached already. */
export function TabLabel({ tab, chats }: { tab: OverhaulTab; chats: Chat[] }) {
  const localize = useLocalizedUiText();
  const character = useCharacter(tab.kind === "character" ? tab.id : null);
  const persona = usePersona(tab.kind === "persona" ? tab.id : null);
  const lorebook = useLorebook(tab.kind === "lorebook" ? tab.id : null);
  const preset = usePresetFull(tab.kind === "preset" ? tab.id : null);
  const connection = useConnection(tab.kind === "connection" ? tab.id : null);
  const docsPath = useOverhaulStore((s) => (tab.kind === "docs" ? (s.docsTabs[tab.id] ?? null) : null));
  const docsIndex = useDocsIndex(tab.kind === "docs");
  const homeApps = useHomeApps();
  const docsTitle = (path: string | null) =>
    path ? (docsIndex.data?.docs.find((entry) => entry.path === path)?.title ?? null) : null;
  let label: string | null = null;
  if (tab.kind === "chat") {
    const chat = chats.find((entry) => entry.id === tab.id);
    label = chat ? getChatDisplayName(chat) || null : null;
    // A shared "[game] " style prefix would make every such tab read "[game…"; the tab's icon shows the mode.
    const unprefixed = label?.replace(/^\[[^\]]{1,24}\]\s*/, "");
    if (unprefixed) label = unprefixed;
    // An imported "Name - 2025-11-25@19h22m33s" shows as "Name": the tab is for the chat's name, not its date.
    if (label) label = stripChatDateSuffix(label);
  } else if (tab.kind === "character") label = parseCharacterName(character.data);
  else if (tab.kind === "persona") label = nameOf(persona.data);
  else if (tab.kind === "lorebook") label = nameOf(lorebook.data);
  else if (tab.kind === "preset")
    label = nameOf((preset.data as { preset?: unknown } | undefined)?.preset ?? preset.data);
  else if (tab.kind === "connection") label = nameOf(connection.data);
  else if (tab.kind === "library") {
    const section = LIBRARY_SECTIONS.find((entry) => entry.id === tab.id);
    label = section ? localize(section.label) : null;
  } else if (tab.kind === "agent") label = tab.id.replace(/[-_]/g, " ");
  else if (tab.kind === "regex") label = localize("Regex script");
  else if (tab.kind === "mari") label = localize("Professor Mari");
  else if (tab.kind === "schedules") label = localize("Character schedules");
  else if (tab.kind === "app") label = homeApps.apps.find((app) => app.id === tab.id)?.label ?? tab.id;
  else if (tab.kind === "docs") {
    const title = docsTitle(docsPath);
    label = title ? `${localize("Docs")}: ${title}` : localize("Docs");
  }
  const text = label ?? localize("Untitled");
  // Short names keep their natural width; only long names give way when the strip is full.
  return (
    <span className="ov-tab__label" data-short={text.length <= 10 ? "true" : undefined} title={text}>
      {text}
    </span>
  );
}

const PRESENCE_LABEL: Record<string, string> = { online: "Online", idle: "Idle", dnd: "Busy", offline: "Offline" };

/** Convo tabs show the character's presence ("Online"), which used to float over the chat. */
export function TabPresence({ tab, chats, dotOnly = false }: { tab: OverhaulTab; chats: Chat[]; dotOnly?: boolean }) {
  const chat = tab.kind === "chat" ? chats.find((entry) => entry.id === tab.id) : undefined;
  const firstId = chat?.mode === "conversation" ? chat.characterIds?.[0] : undefined;
  const character = useCharacter(firstId ?? null);
  if (!chat || !firstId) return null;
  const meta = parseChatMetadata(chat.metadata);
  const snapshot = (meta?.conversationCharacterStatuses as Record<string, { status?: unknown }> | undefined)?.[firstId];
  const stored = (character.data as { conversationStatus?: unknown } | undefined)?.conversationStatus;
  const raw = resolveLiveConversationStatus(meta, firstId, new Date())?.status ?? snapshot?.status ?? stored;
  const status = typeof raw === "string" && raw in PRESENCE_LABEL ? raw : "online";
  return (
    <small
      className={cn("ov-tab__presence", `is-${status}`)}
      title={dotOnly ? PRESENCE_LABEL[status] : undefined}
      aria-label={dotOnly ? PRESENCE_LABEL[status] : undefined}
    >
      <i aria-hidden="true" />
      {/* Consistency audit H12: in the tab strip the dot is enough, so the name keeps the room. */}
      {dotOnly ? null : PRESENCE_LABEL[status]}
    </small>
  );
}

/** Game chats: show or hide the right game pane (Party, Inventory, Journal, Map, Sessions). */
export function GamePaneToggle() {
  const { t: localizeUi } = useUiTranslation();
  const paneOpen = useOverhaulStore((state) => state.gamePaneOpen);
  const madeRoom = useOverhaulStore((state) => state.gamePaneMadeRoom);
  const setPaneOpen = useOverhaulStore((state) => state.setGamePaneOpen);
  const setForced = useOverhaulStore((state) => state.setGamePaneForced);
  // Folded away to give the scene room, the pane counts as hidden here: pressing shows it over the scene.
  const open = paneOpen && !madeRoom;
  const setOpen = (next: boolean) => {
    if (next && paneOpen && madeRoom) setForced(true);
    else setPaneOpen(next);
  };
  return (
    <button
      type="button"
      className={cn("ov-icon-btn ov-game-pane-toggle", open && "is-on")}
      aria-pressed={open}
      title={
        open ? localizeUi("ui.overhaul.ovgamepane.hideGamePane") : localizeUi("ui.overhaul.gamepanetoggle.showGamePane")
      }
      aria-label={
        open ? localizeUi("ui.overhaul.ovgamepane.hideGamePane") : localizeUi("ui.overhaul.gamepanetoggle.showGamePane")
      }
      onClick={() => setOpen(!open)}
    >
      <Gamepad2 aria-hidden="true" size={16} />
    </button>
  );
}

function AppTabIcon({ id }: { id: string }) {
  const app = useHomeApps().apps.find((entry) => entry.id === id);
  if (!app) return <Sparkles aria-hidden="true" size={14} className="ov-tab__icon" />;
  return (
    <span className="ov-tab__icon ov-tab__appicon" aria-hidden="true">
      <BrowserPackageTabIcon packageId={app.id} version={app.version} iconPaths={app.iconPaths} />
    </span>
  );
}

/** The picture of what a tab shows (avatar, lorebook or preset image); null falls back to its icon. */
function pictureOf(value: unknown): string | null {
  const item = value as { avatarPath?: unknown; imagePath?: unknown; preset?: { imagePath?: unknown } } | undefined;
  const src = item?.avatarPath ?? item?.imagePath ?? item?.preset?.imagePath;
  return typeof src === "string" && src ? src : null;
}

export function useTabPicture(tab: OverhaulTab | null, chats: Chat[]): string | null {
  const chat = tab?.kind === "chat" ? chats.find((entry) => entry.id === tab.id) : undefined;
  // A chat shows its (first) character.
  const characterId = tab?.kind === "character" ? tab.id : (chat?.characterIds?.[0] ?? null);
  const character = useCharacter(characterId);
  const persona = usePersona(tab?.kind === "persona" ? tab.id : null);
  const lorebook = useLorebook(tab?.kind === "lorebook" ? tab.id : null);
  const preset = usePresetFull(tab?.kind === "preset" ? tab.id : null);
  if (!tab) return null;
  if (tab.kind === "character" || tab.kind === "chat") return pictureOf(character.data);
  if (tab.kind === "persona") return pictureOf(persona.data);
  if (tab.kind === "lorebook") return pictureOf(lorebook.data);
  if (tab.kind === "preset") return pictureOf(preset.data);
  return null;
}

export function TabIcon({ tab, chats }: { tab: OverhaulTab; chats: Chat[] }) {
  if (tab.kind === "chat") {
    const mode = chats.find((chat) => chat.id === tab.id)?.mode ?? "roleplay";
    return (
      <span aria-hidden="true" className="ov-tab__dot" style={{ background: MODE_DOT[mode] ?? MODE_DOT.roleplay }} />
    );
  }
  if (tab.kind === "library") {
    const Icon = LIBRARY_SECTIONS.find((entry) => entry.id === tab.id)?.icon ?? Layers;
    return <Icon aria-hidden="true" size={14} className="ov-tab__icon" />;
  }
  if (tab.kind === "app") return <AppTabIcon id={tab.id} />;
  const Icon = TAB_ICONS[tab.kind];
  return <Icon aria-hidden="true" size={14} className="ov-tab__icon" />;
}

/**
 * Shared by the desktop tab bar and the mobile top bar: whatever is on screen gets a tab, and tabs whose
 * chat or app is gone are dropped.
 */
export function useTabBookkeeping(current: OverhaulTab | null, chats: Chat[]) {
  const tabs = useOverhaulStore((s) => s.tabs);
  const touchTab = useOverhaulStore((s) => s.touchTab);
  const closeTab = useOverhaulStore((s) => s.closeTab);
  const activeChatId = useChatStore((s) => s.activeChatId);

  // Whatever is on screen gets a tab, so you can hop back to it. Library sections, Settings and
  // Extensions don't: they are one click away in the Library pane. Neither do the Docs (the Docs button).
  useEffect(() => {
    if (current && current.kind !== "library" && current.kind !== "docs") touchTab(current);
  }, [current, touchTab]);

  // Opening a chat leaves the app it was opened over.
  useEffect(() => {
    if (activeChatId && useOverhaulStore.getState().activeApp) useOverhaulStore.setState({ activeApp: null });
  }, [activeChatId]);

  // Drop app tabs whose app was uninstalled.
  const homeApps = useHomeApps();
  useEffect(() => {
    if (!homeApps.loaded) return;
    for (const tab of tabs) {
      if (tab.kind === "app" && !homeApps.apps.some((app) => app.id === tab.id)) closeTab(tab);
    }
  }, [closeTab, homeApps, tabs]);

  // Drop chat tabs whose chat was deleted.
  useEffect(() => {
    if (!chats.length) return;
    for (const tab of tabs) {
      if (tab.kind === "chat" && !chats.some((chat) => chat.id === tab.id)) closeTab(tab);
    }
  }, [chats, closeTab, tabs]);
}

/** Close a tab; when it was the one on screen, move to its neighbour (or Home). */
export function closeTabAndMove(tab: OverhaulTab, tabs: OverhaulTab[], currentKey: string | null) {
  const key = overhaulTabKey(tab);
  const index = tabs.findIndex((entry) => overhaulTabKey(entry) === key);
  useOverhaulStore.getState().rememberClosedTab(tab);
  useOverhaulStore.getState().closeTab(tab);
  if (key !== currentKey) return;
  const remaining = tabs.filter((entry) => overhaulTabKey(entry) !== key);
  const next = remaining[Math.min(index, remaining.length - 1)];
  if (next) activateTab(next);
  else goHome();
}

/** Brings back the tab closed most recently (tab menu, Ctrl+Shift+T where the browser allows it). */
export function reopenClosedTab() {
  const tab = useOverhaulStore.getState().takeClosedTab();
  if (!tab) return false;
  useOverhaulStore.getState().touchTab(tab);
  activateTab(tab);
  return true;
}

/**
 * True while the window is fullscreen (F11 / the browser's fullscreen, or the page's own fullscreen).
 * Then the top bar slides away and comes back when the pointer reaches the top edge, like a browser.
 */
function useWindowFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: fullscreen)");
    // Touch screens (tablets in landscape) have no pointer to bring the bar back, so it never hides there.
    const touch = window.matchMedia("(hover: none)");
    const check = () =>
      setFullscreen(
        !touch.matches &&
          (Boolean(document.fullscreenElement) ||
            media.matches ||
            // Browser fullscreen (F11): no toolbars, so the page is the whole window and the whole screen.
            (Math.abs(window.outerHeight - window.innerHeight) <= 1 &&
              Math.abs(window.outerWidth - window.innerWidth) <= 1 &&
              window.innerHeight >= window.screen.height - 1)),
      );
    check();
    window.addEventListener("resize", check);
    document.addEventListener("fullscreenchange", check);
    media.addEventListener("change", check);
    touch.addEventListener("change", check);
    return () => {
      window.removeEventListener("resize", check);
      document.removeEventListener("fullscreenchange", check);
      media.removeEventListener("change", check);
      touch.removeEventListener("change", check);
    };
  }, []);
  return fullscreen;
}

/** Publishes --mari-top-bar-height on <html>: the bar's real height, desktop and phone (themes can make it taller). */
export function usePublishTopBarHeight(barRef: { current: HTMLElement | null }) {
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--mari-top-bar-height", `${Math.round(bar.offsetHeight)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--mari-top-bar-height");
    };
  }, [barRef]);
}

export function OverhaulTopBar() {
  const localize = useLocalizedUiText();
  const mariEdgeGlow = useMariEdgeGlow();
  const autoHide = useWindowFullscreen();
  useEffect(() => {
    document.documentElement.toggleAttribute("data-ov-topbar-autohide", autoHide);
    return () => document.documentElement.removeAttribute("data-ov-topbar-autohide");
  }, [autoHide]);
  // --mari-top-bar-height: the bar's real height (themes can make it taller), for themes and for the
  // room the page makes while the fullscreen bar is pinned open.
  const barRef = useRef<HTMLElement | null>(null);
  usePublishTopBarHeight(barRef);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setOmnibarOpen = useUIStore((s) => s.setOmnibarOpen);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chatSettingsOpen = useFloatingWindowStore((s) => s.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const { data: chats = [] } = useChats();
  const current = useCurrentTab();
  const currentKey = current ? overhaulTabKey(current) : null;
  // Tabs keep their scroll place. Chats are left out: they manage their own scroll (stick to the newest message).
  useTabScrollMemory(current && current.kind !== "chat" ? currentKey : null);

  // The docked Chat settings pane and the Library pane share the right edge: opening one closes the other.
  const chatSettingsFloating = useOverhaulStore((s) => s.chatSettingsFloating);
  const sidePanesRef = useRef({ library: rightPanelOpen, settings: chatSettingsOpen });
  // Consistency audit H3: the sidebar Chat settings pushed aside comes back when Chat settings closes.
  const reopenLibraryRef = useRef(false);
  useEffect(() => {
    const before = sidePanesRef.current;
    sidePanesRef.current = { library: rightPanelOpen, settings: chatSettingsOpen };
    if (before.settings && !chatSettingsOpen && reopenLibraryRef.current) {
      reopenLibraryRef.current = false;
      if (!rightPanelOpen) useUIStore.setState({ rightPanelOpen: true });
      return;
    }
    // The person opened the sidebar themselves: nothing to bring back later.
    if (rightPanelOpen && !before.library) reopenLibraryRef.current = false;
    if (chatSettingsFloating || !rightPanelOpen || !chatSettingsOpen) return;
    if (!before.settings) {
      reopenLibraryRef.current = true;
      useUIStore.getState().closeRightPanel();
    } else if (!before.library)
      useFloatingWindowStore.getState().dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
  }, [chatSettingsFloating, chatSettingsOpen, rightPanelOpen]);

  useTabBookkeeping(current, chats);

  const activeChat = activeChatId ? chats.find((chat) => chat.id === activeChatId) : undefined;
  const chatOnScreen = current?.kind === "chat";
  const toggleChatSettings = (button: HTMLButtonElement) => {
    void preloadChatSettingsDrawer();
    const windows = useFloatingWindowStore.getState();
    if (windows.open[CHAT_SETTINGS_WINDOW_ID]) windows.dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
    else windows.openWindow(CHAT_SETTINGS_WINDOW_ID, button);
  };
  const libraryOpen = rightPanelOpen;
  const modeLabel = activeChat
    ? localize(activeChat.mode === "conversation" ? "Conversation" : activeChat.mode === "game" ? "Game" : "Roleplay")
    : "";

  return (
    <>
      {autoHide ? <div className="ov-topbar-hotzone" aria-hidden="true" /> : null}
      <header
        ref={barRef}
        data-component="TopBar"
        data-overhaul-topbar="true"
        className={cn("ov-topbar", autoHide && "is-autohide")}
      >
        {mariEdgeGlow ? <span aria-hidden="true" data-state={mariEdgeGlow} className="mari-topbar-edge-glow" /> : null}
        <img
          className="ov-mark"
          src="/favicon.png"
          srcSet="/favicon.png 1x, /icon-192.png 3x"
          alt=""
          aria-hidden="true"
        />
        <Suspense fallback={<nav className="ov-tabs" aria-label={localize("Open tabs")} />}>
          <DesktopTabStrip chats={chats} current={current} currentKey={currentKey} />
        </Suspense>
        <button
          type="button"
          className="ov-icon-btn ov-icon-btn--sm"
          onClick={() => setOmnibarOpen(true)}
          data-tour="omnibar-button"
          title={localize("Search or open anything")}
          aria-label={localize("Search or open anything")}
        >
          <Plus size={15} />
        </button>
        <div className="ov-topbar__right">
          <MariTopbarStatus state={mariEdgeGlow} />
          {chatOnScreen && activeChat ? (
            <button
              type="button"
              className={cn("ov-text-btn", chatSettingsOpen && "is-on")}
              aria-pressed={chatSettingsOpen}
              data-window-opener={CHAT_SETTINGS_WINDOW_ID}
              onClick={(event) => toggleChatSettings(event.currentTarget)}
            >
              <Settings2 size={15} aria-hidden="true" />
              <span>{localize("Chat settings")}</span>
              <ChatSettingsSummary chat={activeChat} fallback={modeLabel} />
            </button>
          ) : null}
          {chatOnScreen && activeChat?.mode === "game" ? <GamePaneToggle /> : null}
          <span className="ov-vsep" aria-hidden="true" />
          <PersonalExtensionTopbarButtons />
          <PersonalExtensionContributionsMenu />
          <button
            type="button"
            className="ov-text-btn"
            onClick={() => useUIStore.getState().openModal("docs-viewer")}
            title={localize("Docs")}
            data-tour="docs-button"
            {...splitDragProps(() => ({
              kind: "docs",
              id: "main",
              path: useOverhaulStore.getState().docsTabs.main ?? null,
            }))}
          >
            <span aria-hidden="true">📖</span>
            <span>{localize("Docs")}</span>
          </button>
          <button
            type="button"
            className={cn("ov-text-btn ov-text-btn--library", libraryOpen && "is-on")}
            aria-pressed={libraryOpen}
            onClick={() => {
              const ui = useUIStore.getState();
              if (ui.rightPanelOpen) ui.closeRightPanel();
              else ui.openRightPanel(ui.rightPanel === "chat" ? "characters" : ui.rightPanel);
            }}
            title={localize(libraryOpen ? "Hide Library pane" : "Show Library pane")}
            data-tour="panel-buttons"
          >
            <Layers size={15} aria-hidden="true" />
            <span>{localize("Library")}</span>
          </button>
        </div>
      </header>
    </>
  );
}
