// ──────────────────────────────────────────────
// UI overhaul: the single top bar
//
// One browser-style strip replaces the old top bar and Home's fake browser
// chrome: chat list toggle, Home, one tab per chat or editor you opened, then
// Chat settings, Help, Library and the Library pane toggle on the right.
// Sidebar collapse controls live here, never over the chat background.
// ──────────────────────────────────────────────
import {
  requestCloseChatSettings,
  toggleChatSettings as toggleChatSettingsWindow,
} from "../../lib/chat-settings-close";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  FileText,
  Gamepad2,
  GraduationCap,
  Layers,
  Link,
  Pencil,
  Regex,
  Search,
  Settings2,
  Sparkles,
  Users,
  VenetianMask,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { readChatModelOverride } from "@marinara-engine/shared";
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
import {
  getChatDisplayName,
  getChatDisplayParts,
  parseChatMetadata,
  splitAtDisplaySuffix,
  stripChatDateSuffix,
} from "../../lib/chat-display";
import { resolveLiveConversationStatus } from "../../lib/conversation-presence-status";
import { useDocsIndex } from "../../hooks/use-docs";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
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
import { isAssetTab, LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";
import { editorLeaveKeyForTab, requestEditorClose } from "../../lib/editor-leave";
import { showChoiceDialog } from "../../lib/app-dialogs";
import { discardParkedDraft, useEditorDraftOfferStore, useParkedDraftsStore } from "../../hooks/use-editor-leave-save";
import { translate } from "../../localization/i18n";
import { useTabScrollMemory } from "./use-tab-scroll-memory";
import { markThingTried } from "../../lib/things-to-try-progress";
import { splitDragProps } from "./split-view";
import { ChatModeIcon } from "../chat/ChatModeIcon";
import { goBackPlace, goForwardPlace, usePlaceHistory } from "./place-history";
import { isApplePlatform } from "../../lib/command-center";
import { useNavigationKeys } from "./use-navigation-keys";
import { requestPromptViewerTabClose } from "./prompt-viewer/close-guard";
import { PancakeIcon } from "../../lib/pancake-icon";
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
  "prompt-viewer": PancakeIcon,
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
  agentCatalogOpen: boolean;
  regexDetailId: string | null;
  toolDetailId: string | null;
  profileDetailId: string | null;
  characterLibraryOpen: boolean;
  cardLibraryKind: string;
  libraryPage: LibrarySection | null;
  activeDocsTab: string | null;
  activeMari: boolean;
  activeSchedules: boolean;
  activePromptViewer: boolean;
  activeApp: string | null;
};

function currentTabFrom(v: CurrentTabInputs): OverhaulTab | null {
  const real = (id: string | null | undefined) => (id && id !== "__new__" ? id : null);
  if (v.activeSchedules) return { kind: "schedules", id: "main" };
  if (v.activePromptViewer) return { kind: "prompt-viewer", id: "main" };
  if (v.activeMari) return { kind: "mari", id: "main" };
  if (v.activeDocsTab) return { kind: "docs", id: v.activeDocsTab };
  // Regex scripts, Connections and Agents open in one viewer per section, so they share its Library tab.
  if (v.regexDetailId) return { kind: "library", id: "regex" };
  if (v.toolDetailId) return { kind: "library", id: "tools" };
  if (v.profileDetailId) return { kind: "library", id: "profiles" };
  if (real(v.personaDetailId)) return { kind: "persona", id: v.personaDetailId! };
  // The agent store page (an agent's install page) is part of Library > Agents too.
  if (v.agentDetailId || v.agentCatalogOpen) return { kind: "library", id: "agents" };
  if (v.connectionDetailId) return { kind: "library", id: "connections" };
  if (real(v.presetDetailId)) return { kind: "preset", id: v.presetDetailId! };
  if (real(v.characterDetailId)) return { kind: "character", id: v.characterDetailId! };
  if (v.characterLibraryOpen)
    return { kind: "library", id: v.cardLibraryKind === "personas" ? "personas" : "characters" };
  if (real(v.lorebookDetailId)) return { kind: "lorebook", id: v.lorebookDetailId! };
  // Backgrounds, Game assets and Rulesets are tabs of one Assets page, so they share its tab.
  if (v.libraryPage) return { kind: "library", id: isAssetTab(v.libraryPage) ? "assets" : v.libraryPage };
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
    agentCatalogOpen: ui.agentCatalogOpen,
    regexDetailId: ui.regexDetailId,
    toolDetailId: ui.toolDetailId,
    profileDetailId: ui.profileDetailId,
    characterLibraryOpen: ui.characterLibraryOpen,
    cardLibraryKind: ui.cardLibraryKind,
    libraryPage: overhaul.libraryPage,
    activeDocsTab: overhaul.activeDocsTab,
    activeMari: overhaul.activeMari,
    activeSchedules: overhaul.activeSchedules,
    activePromptViewer: overhaul.activePromptViewer,
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
  const agentCatalogOpen = useUIStore((s) => s.agentCatalogOpen);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const profileDetailId = useUIStore((s) => s.profileDetailId);
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const libraryPage = useOverhaulStore((s) => s.libraryPage);
  const activeDocsTab = useOverhaulStore((s) => s.activeDocsTab);
  const activeMari = useOverhaulStore((s) => s.activeMari);
  const activeSchedules = useOverhaulStore((s) => s.activeSchedules);
  const activePromptViewer = useOverhaulStore((s) => s.activePromptViewer);
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
        agentCatalogOpen,
        regexDetailId,
        toolDetailId,
        profileDetailId,
        characterLibraryOpen,
        cardLibraryKind,
        libraryPage,
        activeDocsTab,
        activeMari,
        activeSchedules,
        activePromptViewer,
        activeApp,
      }),
    [
      activeApp,
      activeChatId,
      activeDocsTab,
      activeMari,
      activeSchedules,
      activePromptViewer,
      agentCatalogOpen,
      agentDetailId,
      cardLibraryKind,
      characterDetailId,
      characterLibraryOpen,
      connectionDetailId,
      libraryPage,
      lorebookDetailId,
      personaDetailId,
      presetDetailId,
      profileDetailId,
      regexDetailId,
      toolDetailId,
    ],
  );
}

/** Open the Prompt viewer (kolache's AIO) in its tab: from the top bar, Search, or Chat settings on a phone. */
export function openPromptViewerTab() {
  const overhaul = useOverhaulStore.getState();
  useUIStore.getState().closeAllDetails();
  if (overhaul.allTabsOpen) overhaul.setAllTabsOpen(false);
  overhaul.openPromptViewer();
}

export function goHome() {
  window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
  useOverhaulStore.getState().leaveDocs();
  useOverhaulStore.getState().setLibraryPage(null);
  useOverhaulStore.getState().setLibraryHubReturn(false);
  useChatStore.getState().setActiveChatId(null);
  useUIStore.getState().closeAllDetails();
}

export function activateTab(tab: OverhaulTab) {
  const ui = useUIStore.getState();
  const overhaul = useOverhaulStore.getState();
  if (tab.kind === "docs") {
    ui.closeAllDetails();
    useOverhaulStore.setState({
      activeDocsTab: tab.id,
      activeMari: false,
      activeSchedules: false,
      activePromptViewer: false,
      libraryPage: null,
    });
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
  if (tab.kind === "prompt-viewer") {
    ui.closeAllDetails();
    overhaul.openPromptViewer();
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

/**
 * "Roleplay · Claude Opus": the chat's mode and the model it talks to. `modelOnly` drops the mode, for the phone's
 * title, where the symbol and CO / RP / GM in front of the name already say it.
 */
export function ChatSettingsSummary({
  chat,
  fallback,
  modelOnly = false,
}: {
  chat: Chat;
  fallback: string;
  modelOnly?: boolean;
}) {
  // One fixed format everywhere: "Mode · model" (panel 3, PV14/N10a). The preset and agent count made the
  // label change while things loaded and from chat to chat; both are one click away in Chat settings.
  const { t } = useTranslation();
  const { data: connections } = useConnections();
  const list = Array.isArray(connections) ? (connections as Array<Record<string, unknown>>) : [];
  const connection = chat.connectionId
    ? list.find((item) => item.id === chat.connectionId)
    : list.find((item) => isConnectionFlagTrue(item.isDefault));
  // A tried model (one the chat runs without saving it) is named itself, not the saved Model it runs through.
  const override = chat.connectionId ? readChatModelOverride(chat) : null;
  const modelName = override ? (override.name ?? override.model) : nameOf(connection);
  if (modelOnly) {
    // Nothing while the Models load, so the line doesn't flash "No model" first.
    const model = modelName ?? (connections ? t("ui.overhaul.chatSummary.noModel") : "");
    return <small>{model}</small>;
  }
  const parts = [fallback, modelName].filter(Boolean);
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
  const { t } = useTranslation();
  const base = useTabLabelText(tab, chats);
  const key = overhaulTabKey(tab);
  const chat = tab.kind === "chat" ? chats.find((entry) => entry.id === tab.id) : undefined;
  // A tab's symbol already says what it is (a character, a lorebook, a chat's mode), so tabs of different kinds that
  // share a name ("pancakecat" the character and "pancakecat" the chat) keep their plain names. Only tabs of the same
  // kind (and, for chats, the same mode) with the same name are told apart, by their order: "Luna", "Luna · 2".
  const kindKey = chat ? null : TAB_KIND_KEYS[tab.kind];
  const kind = kindKey ? t(kindKey) : null;
  const withKind = chat ? `${base}\u0000chat\u0000${chat.mode}` : `${base}\u0000${tab.kind}`;
  const order = chat?.createdAt ?? key;
  useEffect(() => publishTabLabel(key, base, withKind, order), [base, key, order, withKind]);
  const clash = useSyncExternalStore(subscribeTabLabels, () => tabLabelClash(key, base, withKind, order));
  const text = clash > 1 ? t("ui.overhaul.tab.labelN", { name: base, n: clash }) : base;
  // What tells the tab apart (a branch's "· branch N", a clash's "· roleplay 2") stays in view; the name in front of
  // it is what gives way.
  const [name] = splitAtDisplaySuffix(base, chat ? getChatDisplayParts(chat).suffix : "");
  const head = text.startsWith(name) && text.length > name.length ? name : text;
  const tail = head === text ? "" : text.slice(name.length).trim();
  // Short names keep their natural width; only long names give way when the strip is full.
  return (
    <span
      className={cn("ov-tab__label", tail && "ov-tab__label--split")}
      data-short={text.length <= 10 ? "true" : undefined}
      title={
        chat
          ? t("ui.overhaul.tab.labelWithKind", {
              name: text,
              kind: t(CHAT_MODE_KIND_KEYS[chat.mode] ?? TAB_KIND_KEYS.chat!),
            })
          : kind
            ? t("ui.overhaul.tab.labelWithKind", { name: text, kind })
            : text
      }
    >
      {/* The symbol in front is hidden from screen readers, so they hear the kind instead. */}
      {kind ? <span className="sr-only">{kind} </span> : null}
      {tail ? (
        <>
          <span className="ov-tab__label-head">{head}</span>
          <span className="ov-tab__label-tail">{tail}</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}

/** A tab's ✕, named after its tab: "Close Storm at Gull Point", not one "Close tab" per tab (QC panel 3 AX16). */
export function TabCloseButton({ tab, chats, onClose }: { tab: OverhaulTab; chats: Chat[]; onClose: () => void }) {
  const { t } = useTranslation();
  const name = useTabLabelText(tab, chats);
  const label = t("ui.tabs.closeNamed", { name });
  return (
    <button type="button" draggable className="ov-tab__close" aria-label={label} title={label} onClick={onClose}>
      <X size={12} />
    </button>
  );
}

const TAB_KIND_KEYS: Partial<Record<OverhaulTab["kind"], string>> = {
  character: "ui.overhaul.tab.kindCharacter",
  chat: "ui.overhaul.tab.kindChat",
  persona: "ui.overhaul.tab.kindPersona",
  lorebook: "ui.overhaul.tab.kindLorebook",
  preset: "ui.overhaul.tab.kindPreset",
};
const CHAT_MODE_KIND_KEYS: Partial<Record<string, string>> = {
  roleplay: "ui.overhaul.tab.kindRoleplay",
  conversation: "ui.overhaul.tab.kindConversation",
  game: "ui.overhaul.tab.kindGame",
};

// Every shown tab's plain label (and the label with its kind), so a tab can tell when another one reads the same.
type PublishedTabLabel = { label: string; withKind: string; order: string; count: number };
const tabLabels = new Map<string, PublishedTabLabel>();
const tabLabelListeners = new Set<() => void>();
function subscribeTabLabels(listener: () => void) {
  tabLabelListeners.add(listener);
  return () => tabLabelListeners.delete(listener);
}
function publishTabLabel(key: string, label: string, withKind: string, order: string) {
  const entry = tabLabels.get(key);
  if (entry && entry.label === label && entry.withKind === withKind && entry.order === order) entry.count += 1;
  else tabLabels.set(key, { label, withKind, order, count: 1 });
  tabLabelListeners.forEach((listener) => listener());
  return () => {
    const current = tabLabels.get(key);
    if (!current) return;
    current.count -= 1;
    if (current.count <= 0) tabLabels.delete(key);
    tabLabelListeners.forEach((listener) => listener());
  };
}
/** 0: no other tab reads the same. 1: show the kind. 2+: the kind clashes too, so this is its number by order. */
function tabLabelClash(key: string, label: string, withKind: string, order: string): number {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (!label.trim()) return 0;
  let before = 0;
  let twin = false;
  for (const [otherKey, entry] of tabLabels) {
    if (otherKey === key || !same(entry.withKind, withKind)) continue;
    twin = true;
    if (entry.order < order || (entry.order === order && otherKey < key)) before += 1;
  }
  return twin ? before + 1 : 0;
}

/** The browser tab says which page or chat is open ("Smuggler's Run · Marinara Engine"), audit C23. */
export function DocumentTitle({ tab, chats }: { tab: OverhaulTab | null; chats: Chat[] }) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const label = useTabLabelText(tab ?? HOME_TITLE_TAB, chats);
  const base = t("app.documentTitle", "Marinara Engine");
  const text = tab ? label : localize("Home");
  useEffect(() => {
    document.title = `${text} · ${base}`;
  }, [base, text]);
  useEffect(() => () => void (document.title = base), [base]);
  return null;
}
const HOME_TITLE_TAB = { kind: "library", id: "" } as OverhaulTab;

export function useTabLabelText(tab: OverhaulTab, chats: Chat[]): string {
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
  else if (tab.kind === "prompt-viewer") label = localize("Prompt viewer");
  else if (tab.kind === "app") label = homeApps.apps.find((app) => app.id === tab.id)?.label ?? tab.id;
  else if (tab.kind === "docs") {
    const title = docsTitle(docsPath);
    label = title ? `${localize("Docs")}: ${title}` : localize("Docs");
  }
  return label ?? localize("Untitled");
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

/** True for an editor tab with unsaved changes: open now, or waiting as a draft. */
function useTabUnsaved(tab: OverhaulTab, current: boolean): boolean {
  const editorKey = editorLeaveKeyForTab(tab);
  const parked = useParkedDraftsStore((s) => (editorKey ? s.keys.includes(editorKey) : false));
  const openDirty = useUIStore((s) => current && s.editorDirty);
  return Boolean(editorKey) && (parked || openDirty);
}

/**
 * An editor tab with unsaved changes shows a small pencil after its name, in the tab's own text colour. It was a
 * ring before, which read as the Conversation online dot in themes with a green accent.
 */
export function TabDraftDot({ tab, current }: { tab: OverhaulTab; current: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  if (!useTabUnsaved(tab, current)) return null;
  const label = localizeUi("editor.draft.tabUnsaved");
  return (
    <span className="ov-tab__draft" role="img" aria-label={label} title={label}>
      <Pencil size={11} aria-hidden="true" />
    </span>
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
    else {
      // Opening it with no room beside the scene floats it straight away; it used to fold away on the
      // same tap, so the first tap looked like it did nothing (phone/tablet panel TL7).
      if (next) setForced(true);
      setPaneOpen(next);
    }
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

/**
 * A chat tab's mode: the mode's own symbol (the one the Chats list uses) in the mode's colour, then CO / RP / GM.
 * Screen readers hear the mode's name instead of the code. `code={false}` leaves the symbol alone (phone tab cards,
 * whose card already names the mode).
 */
function ChatTabMode({ mode, code }: { mode: string | undefined; code: boolean }) {
  const { t } = useTranslation();
  const known = mode === "conversation" || mode === "game" ? mode : "roleplay";
  return (
    <span className="ov-tab__mode" data-tab-mode={known} style={{ "--ov-tab-mode": MODE_DOT[known] } as CSSProperties}>
      <ChatModeIcon mode={known} aria-hidden="true" size={code ? 14 : 24} className="ov-tab__mode-icon" />
      {code ? (
        <>
          <span className="ov-tab__mode-code" aria-hidden="true">
            {t(CHAT_MODE_CODE_KEYS[known]!)}
          </span>
          <span className="sr-only">{t(CHAT_MODE_KIND_KEYS[known]!)}</span>
        </>
      ) : null}
    </span>
  );
}
const CHAT_MODE_CODE_KEYS: Partial<Record<string, string>> = {
  conversation: "ui.overhaul.tab.codeConversation",
  roleplay: "ui.overhaul.tab.codeRoleplay",
  game: "ui.overhaul.tab.codeGame",
};

export function TabIcon({ tab, chats, code = true }: { tab: OverhaulTab; chats: Chat[]; code?: boolean }) {
  if (tab.kind === "chat") return <ChatTabMode mode={chats.find((chat) => chat.id === tab.id)?.mode} code={code} />;
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
  // Extensions don't get one by themselves: they are one click away in the Library pane, and you pin one by
  // dragging its row onto the tab strip (DesktopTabStrip). Neither do the Docs (the Docs button).
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
  const close = () => {
    useOverhaulStore.getState().rememberClosedTab(tab);
    useOverhaulStore.getState().closeTab(tab);
    if (key !== currentKey) return;
    const remaining = useOverhaulStore.getState().tabs;
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) activateTab(next);
    else goHome();
  };
  // The Prompt viewer keeps unsaved edits while you switch tabs; closing its tab asks first.
  if (tab.kind === "prompt-viewer" && requestPromptViewerTabClose(close)) return;
  const editorKey = editorLeaveKeyForTab(tab);
  const offer = useEditorDraftOfferStore.getState().offer;
  if (editorKey && key === currentKey && offer?.key === editorKey && offer.state === "found") {
    // The open editor still offers edits from before a reload: closing would quietly leave them behind (IR2-5).
    void showChoiceDialog({
      title: translate("editor.leave.title"),
      message: translate("editor.draft.closeTabMessage"),
      choices: [
        { key: "restore", label: translate("editor.draft.restore") },
        { key: "discard", label: translate("editor.leave.discard"), tone: "destructive" },
      ],
      cancelLabel: translate("editor.draft.keepTab"),
      layout: "row",
    }).then((choice) => {
      if (choice === "restore") {
        useOverhaulStore.getState().setAllTabsOpen(false);
        offer.restore();
      } else if (choice === "discard") {
        offer.discard();
        close();
      }
    });
    return;
  }
  if (editorKey && key === currentKey) {
    // Closing the open editor's tab is leaving for real: Save / Don't save / Keep editing first.
    if (!requestEditorClose(editorKey, close)) close();
    return;
  }
  if (editorKey && useParkedDraftsStore.getState().keys.includes(editorKey)) {
    // Its edits wait as a draft in this tab: closing it would throw them away, so ask.
    void showChoiceDialog({
      title: translate("editor.leave.title"),
      message: translate("editor.draft.closeTabMessage"),
      choices: [
        { key: "open", label: translate("editor.draft.openToSave") },
        { key: "discard", label: translate("editor.leave.discard"), tone: "destructive" },
      ],
      cancelLabel: translate("editor.draft.keepTab"),
      layout: "row",
    }).then((choice) => {
      if (choice === "open") {
        // Straight to the tab, with its Save in view: the All Tabs grid gets out of the way (TP15).
        useOverhaulStore.getState().setAllTabsOpen(false);
        activateTab(tab);
      } else if (choice === "discard") {
        discardParkedDraft(editorKey);
        close();
      }
    });
    return;
  }
  close();
}

/** Brings back the tab closed most recently (tab menu, Ctrl+Shift+T where the browser allows it). */
export function reopenClosedTab() {
  const tab = useOverhaulStore.getState().takeClosedTab();
  if (!tab) return false;
  markThingTried("KW3");
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

/** Publishes --mari-top-bar-height on <html>: the bar's real height, desktop and phone (themes can make it taller),
 *  plus a tab group's row under it. */
export function usePublishTopBarHeight(barRef: { current: HTMLElement | null }) {
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    // A tab group's row under the bar counts too (--ov-tabrow-height, 0 without one), so what a theme places
    // below the bar (a docked window, art masked to the page) starts below the row.
    const publish = () => {
      const height = Math.round(bar.offsetHeight);
      root.style.setProperty("--mari-top-bar-height", `calc(${height}px + var(--ov-tabrow-height, 0px))`);
      // The bar alone: the fullscreen bar slides a group's row in just under itself.
      root.style.setProperty("--ov-topbar-bar-h", `${height}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    // Border box: a theme can trade the bar's height for its padding (the content box alone stays the same).
    observer.observe(bar, { box: "border-box" });
    return () => {
      observer.disconnect();
      root.style.removeProperty("--mari-top-bar-height");
      root.style.removeProperty("--ov-topbar-bar-h");
    };
  }, [barRef]);
}

const KEYS_ARIA = {
  back: "Alt+ArrowLeft",
  backApple: "Meta+BracketLeft",
  forward: "Alt+ArrowRight",
  forwardApple: "Meta+BracketRight",
} as const;

/** Back and Forward between the places visited (place-history.ts), beside the logo like a browser's arrows. */
function PlaceArrows() {
  const { t } = useTranslation();
  const canBack = usePlaceHistory((s) => s.canBack);
  const canForward = usePlaceHistory((s) => s.canForward);
  const apple = isApplePlatform();
  const backKeys = apple ? "⌘[" : "Alt+←";
  const forwardKeys = apple ? "⌘]" : "Alt+→";
  // ARIA key names, not words to translate.
  const backAria = apple ? KEYS_ARIA.backApple : KEYS_ARIA.back;
  const forwardAria = apple ? KEYS_ARIA.forwardApple : KEYS_ARIA.forward;
  return (
    <div className="ov-place-arrows" role="group" aria-label={t("ui.overhaul.places.group")}>
      <button
        type="button"
        className="ov-icon-btn ov-icon-btn--sm"
        disabled={!canBack}
        onClick={() => goBackPlace()}
        title={t("ui.overhaul.places.backWithKeys", { keys: backKeys })}
        aria-label={t("ui.overhaul.places.back")}
        aria-keyshortcuts={backAria}
        data-tour="place-back"
      >
        <ArrowLeft size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="ov-icon-btn ov-icon-btn--sm"
        disabled={!canForward}
        onClick={() => goForwardPlace()}
        title={t("ui.overhaul.places.forwardWithKeys", { keys: forwardKeys })}
        aria-label={t("ui.overhaul.places.forward")}
        aria-keyshortcuts={forwardAria}
      >
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function OverhaulTopBar() {
  const localize = useLocalizedUiText();
  useNavigationKeys();
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
  const [tabRowSlot, setTabRowSlot] = useState<HTMLDivElement | null>(null);
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
    } else if (!before.library) {
      // An editor page with unsaved edits asks first; keeping them keeps Chat settings and closes the Library again.
      void requestCloseChatSettings().then((closed) => {
        if (!closed) useUIStore.getState().closeRightPanel();
      });
    }
  }, [chatSettingsFloating, chatSettingsOpen, rightPanelOpen]);

  useTabBookkeeping(current, chats);

  const activeChat = activeChatId ? chats.find((chat) => chat.id === activeChatId) : undefined;
  const chatOnScreen = current?.kind === "chat";
  const toggleChatSettings = (button: HTMLButtonElement) => {
    void preloadChatSettingsDrawer();
    toggleChatSettingsWindow(button);
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
        data-mari-part="top-bar"
        data-overhaul-topbar="true"
        className={cn("ov-topbar", autoHide && "is-autohide")}
      >
        <DocumentTitle tab={current} chats={chats} />
        {mariEdgeGlow ? <span aria-hidden="true" data-state={mariEdgeGlow} className="mari-topbar-edge-glow" /> : null}
        <img
          className="ov-mark"
          src="/favicon.png"
          srcSet="/favicon.png 1x, /icon-192.png 3x"
          alt=""
          aria-hidden="true"
        />
        <PlaceArrows />
        <Suspense fallback={<nav className="ov-tabs" aria-label={localize("Open tabs")} />}>
          <DesktopTabStrip chats={chats} current={current} currentKey={currentKey} rowSlot={tabRowSlot} />
        </Suspense>
        <button
          type="button"
          className="ov-icon-btn"
          onClick={() => setOmnibarOpen(true)}
          data-tour="omnibar-button"
          title={localize("Search or open anything")}
          aria-label={localize("Search or open anything")}
        >
          <Search size={15} />
        </button>
        <button
          type="button"
          className={cn("ov-icon-btn", current?.kind === "prompt-viewer" && "is-on")}
          aria-pressed={current?.kind === "prompt-viewer"}
          onClick={() => openPromptViewerTab()}
          data-tour="prompt-viewer-button"
          title={localize("Prompt viewer")}
          aria-label={localize("Prompt viewer")}
        >
          <PancakeIcon size={15} />
        </button>
        <div className="ov-topbar__right">
          <MariTopbarStatus state={mariEdgeGlow} />
          {chatOnScreen && activeChat ? (
            <button
              type="button"
              className={cn("ov-text-btn", chatSettingsOpen && "is-on")}
              aria-expanded={chatSettingsOpen}
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
            className={cn("ov-text-btn", current?.kind === "docs" && "is-on")}
            aria-pressed={current?.kind === "docs"}
            onClick={() => useUIStore.getState().openModal("docs-viewer")}
            title={localize("Docs")}
            data-tour="docs-button"
            {...splitDragProps(() => ({
              kind: "docs",
              id: "main",
              path: useOverhaulStore.getState().docsTabs.main ?? null,
            }))}
          >
            <CircleHelp size={15} aria-hidden="true" />
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
            title={localize(libraryOpen ? "Hide sidebar" : "Show sidebar")}
            data-tour="panel-buttons"
          >
            <Layers size={15} aria-hidden="true" />
            <span>{localize("Library")}</span>
          </button>
        </div>
      </header>
      {/* A tab group's own row, under the bar (DesktopTabStrip puts it here). */}
      <div ref={setTabRowSlot} className="ov-tabrow2-slot" />
    </>
  );
}
