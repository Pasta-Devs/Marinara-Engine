// ──────────────────────────────────────────────
// UI overhaul: the single top bar
//
// One browser-style strip replaces the old top bar and Home's fake browser
// chrome: chat list toggle, Home, one tab per chat or editor you opened, then
// Chat settings, Help, Library and the Library pane toggle on the right.
// Sidebar collapse controls live here, never over the chat background.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  FileText,
  GraduationCap,
  Home,
  Layers,
  Link,
  PanelLeft,
  PanelRight,
  Plus,
  Regex,
  Settings2,
  Sparkles,
  Users,
  VenetianMask,
  X,
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
import { useConnection } from "../../hooks/use-connections";
import { usePresetFull } from "../../hooks/use-presets";
import { getChatDisplayName, parseChatMetadata } from "../../lib/chat-display";
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
import { useTranslation } from "react-i18next";
import { LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";

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

/** The editor or chat on screen right now, as a tab; null on Home. */
function useCurrentTab(): OverhaulTab | null {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const libraryPage = useOverhaulStore((s) => s.libraryPage);
  const activeDocsTab = useOverhaulStore((s) => s.activeDocsTab);
  const activeMari = useOverhaulStore((s) => s.activeMari);
  const activeSchedules = useOverhaulStore((s) => s.activeSchedules);
  const activeApp = useOverhaulStore((s) => s.activeApp);
  return useMemo(() => {
    const real = (id: string | null | undefined) => (id && id !== "__new__" ? id : null);
    if (activeSchedules) return { kind: "schedules", id: "main" };
    if (activeMari) return { kind: "mari", id: "main" };
    if (activeDocsTab) return { kind: "docs", id: activeDocsTab };
    // Regex scripts, Connections and Agents open in one viewer per section, so they share its Library tab.
    if (regexDetailId) return { kind: "library", id: "regex" };
    if (real(personaDetailId)) return { kind: "persona", id: personaDetailId! };
    if (agentDetailId) return { kind: "library", id: "agents" };
    if (connectionDetailId) return { kind: "library", id: "connections" };
    if (real(presetDetailId)) return { kind: "preset", id: presetDetailId! };
    if (real(characterDetailId)) return { kind: "character", id: characterDetailId! };
    if (characterLibraryOpen)
      return { kind: "library", id: cardLibraryKind === "personas" ? "personas" : "characters" };
    if (real(lorebookDetailId)) return { kind: "lorebook", id: lorebookDetailId! };
    if (libraryPage) return { kind: "library", id: libraryPage };
    if (activeChatId) return { kind: "chat", id: activeChatId };
    if (activeApp) return { kind: "app", id: activeApp };
    return null;
  }, [
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
  ]);
}

function goHome() {
  window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
  useOverhaulStore.getState().leaveDocs();
  useOverhaulStore.getState().setLibraryPage(null);
  useChatStore.getState().setActiveChatId(null);
  useUIStore.getState().closeAllDetails();
}

function activateTab(tab: OverhaulTab) {
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

function nameOf(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const name = (record as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name : null;
}

/** "Universal · princess · 2 agents": the chat's preset, connection and agents at a glance. */
function ChatSettingsSummary({ chat, fallback }: { chat: Chat; fallback: string }) {
  const localize = useLocalizedUiText();
  const preset = usePresetFull(chat.promptPresetId ?? null);
  const connection = useConnection(chat.connectionId ?? null);
  const presetName = nameOf((preset.data as { preset?: unknown } | undefined)?.preset ?? preset.data);
  const connectionName = nameOf(connection.data);
  const agents = Array.isArray(chat.metadata?.activeAgentIds) ? chat.metadata.activeAgentIds.length : 0;
  const parts = [
    presetName,
    connectionName,
    agents ? `${agents} ${localize(agents === 1 ? "agent" : "agents")}` : null,
  ].filter(Boolean);
  return <small>{parts.length ? parts.join(" · ") : fallback}</small>;
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
function TabLabel({ tab, chats }: { tab: OverhaulTab; chats: Chat[] }) {
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
  return <span className="ov-tab__label">{label ?? localize("Untitled")}</span>;
}

const PRESENCE_LABEL: Record<string, string> = { online: "Online", idle: "Idle", dnd: "Busy", offline: "Offline" };

/** Convo tabs show the character's presence ("Online"), which used to float over the chat. */
function TabPresence({ tab, chats }: { tab: OverhaulTab; chats: Chat[] }) {
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
    <small className={cn("ov-tab__presence", `is-${status}`)}>
      <i aria-hidden="true" />
      {PRESENCE_LABEL[status]}
    </small>
  );
}

/** Game chats: show or hide the right game pane (Party, Inventory, Journal, Map, Sessions). */
function GamePaneToggle() {
  const open = useOverhaulStore((state) => state.gamePaneOpen);
  const setOpen = useOverhaulStore((state) => state.setGamePaneOpen);
  return (
    <button
      type="button"
      className={cn("ov-icon-btn", open && "is-on")}
      aria-pressed={open}
      title={open ? "Hide game pane" : "Show game pane"}
      aria-label={open ? "Hide game pane" : "Show game pane"}
      onClick={() => setOpen(!open)}
    >
      <PanelRight size={16} />
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

function TabIcon({ tab, chats }: { tab: OverhaulTab; chats: Chat[] }) {
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

export function OverhaulTopBar() {
  const localize = useLocalizedUiText();
  const mariEdgeGlow = useMariEdgeGlow();
  const tabs = useOverhaulStore((s) => s.tabs);
  const touchTab = useOverhaulStore((s) => s.touchTab);
  const closeTab = useOverhaulStore((s) => s.closeTab);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setOmnibarOpen = useUIStore((s) => s.setOmnibarOpen);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chatSettingsOpen = useFloatingWindowStore((s) => s.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const { data: chats = [] } = useChats();
  const current = useCurrentTab();
  const currentKey = current ? overhaulTabKey(current) : null;
  const stripRef = useRef<HTMLDivElement | null>(null);
  const moveTab = useOverhaulStore((s) => s.moveTab);
  // Drag to reorder: the dragged tab's key, and where it would land (index in `tabs`).
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Whatever is on screen gets a tab, so you can hop back to it. Library sections, Settings and
  // Extensions don't: they are one click away in the Library pane. Neither do the Docs (the Docs button).
  useEffect(() => {
    if (current && current.kind !== "library" && current.kind !== "docs") touchTab(current);
  }, [current, touchTab]);

  // Keep the active tab in view when the strip overflows.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !currentKey) return;
    strip.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(currentKey)}"]`)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [currentKey, tabs.length]);

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

  const handleClose = (tab: OverhaulTab) => {
    const key = overhaulTabKey(tab);
    const index = tabs.findIndex((entry) => overhaulTabKey(entry) === key);
    closeTab(tab);
    if (key !== currentKey) return;
    const remaining = tabs.filter((entry) => overhaulTabKey(entry) !== key);
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) activateTab(next);
    else goHome();
  };

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
    <header data-component="TopBar" data-overhaul-topbar="true" className="ov-topbar">
      {mariEdgeGlow ? <span aria-hidden="true" data-state={mariEdgeGlow} className="mari-topbar-edge-glow" /> : null}
      <button
        type="button"
        className={cn("ov-icon-btn", sidebarOpen && "is-on")}
        aria-pressed={sidebarOpen}
        onClick={toggleSidebar}
        title={localize(sidebarOpen ? "Hide chat list" : "Show chat list")}
        aria-label={localize(sidebarOpen ? "Hide chat list" : "Show chat list")}
        data-tour="sidebar-toggle"
      >
        <PanelLeft size={16} />
      </button>
      <img
        className="ov-mark"
        src="/favicon.png"
        srcSet="/favicon.png 1x, /icon-192.png 3x"
        alt=""
        aria-hidden="true"
      />
      <nav className="ov-tabs" aria-label={localize("Open tabs")} ref={stripRef}>
        <button
          type="button"
          className={cn("ov-tab ov-tab--home", current === null && "is-on")}
          aria-current={current === null ? "page" : undefined}
          onClick={goHome}
        >
          <Home size={14} aria-hidden="true" className="ov-tab__icon" />
          <span className="ov-tab__label">{localize("Home")}</span>
        </button>
        {tabs.map((tab, index) => {
          const key = overhaulTabKey(tab);
          const on = key === currentKey;
          return (
            <div
              key={key}
              className={cn(
                "ov-tab",
                on && "is-on",
                dragKey === key && "is-dragging",
                dragKey && dropIndex === index && "is-drop-before",
                dragKey && dropIndex === tabs.length && index === tabs.length - 1 && "is-drop-after",
              )}
              data-tab-key={key}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", key);
                setDragKey(key);
              }}
              onDragOver={(event) => {
                if (!dragKey) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const box = event.currentTarget.getBoundingClientRect();
                setDropIndex(event.clientX < box.left + box.width / 2 ? index : index + 1);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragKey && dropIndex !== null) moveTab(dragKey, dropIndex);
                setDragKey(null);
                setDropIndex(null);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setDropIndex(null);
              }}
            >
              <button
                type="button"
                className="ov-tab__main"
                aria-current={on ? "page" : undefined}
                onClick={() => activateTab(tab)}
                onAuxClick={(event) => {
                  if (event.button === 1) handleClose(tab);
                }}
              >
                <TabIcon tab={tab} chats={chats} />
                <TabLabel tab={tab} chats={chats} />
                <TabPresence tab={tab} chats={chats} />
              </button>
              <button
                type="button"
                className="ov-tab__close"
                aria-label={localize("Close tab")}
                title={localize("Close tab")}
                onClick={() => handleClose(tab)}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="ov-icon-btn ov-icon-btn--sm"
          onClick={() => setOmnibarOpen(true)}
          title={localize("Search or open anything")}
          aria-label={localize("Search or open anything")}
        >
          <Plus size={15} />
        </button>
      </nav>
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
  );
}
