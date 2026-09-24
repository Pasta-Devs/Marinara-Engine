// ──────────────────────────────────────────────
// Command palette host: global shortcuts + built-in actions
// ──────────────────────────────────────────────
// Ctrl/Cmd+K toggles the palette. No other binding in the app uses it, so it
// also works while typing; a field that handles Ctrl+K itself and calls
// preventDefault() keeps it. "?" opens the shortcuts overlay unless the user
// is typing. Both surfaces are lazy-loaded on first open.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Chat } from "@marinara-engine/shared";
import {
  canTogglePaletteFromShortcut,
  isPaletteShortcut,
  isShortcutsHelpKey,
  isTypingTarget,
  registerCommand,
} from "../../lib/command-palette";
import { requestChatHelp } from "../../lib/chat-help-events";
import { countModalOverlays } from "../../lib/modal-overlay-registry";
import { chatKeys } from "../../hooks/use-chats";
import { useLaunchNewChat } from "../chat/HomeNewChatLauncher";
import { useCommandPaletteStore } from "../../stores/command-palette.store";
import { useChatStore } from "../../stores/chat.store";
import { isMobileShellViewport, useUIStore, type Panel } from "../../stores/ui.store";
import { confirmLeaveDirtyEditor } from "./palette-navigation";

const CommandPalette = lazy(() => import("./CommandPalette").then((module) => ({ default: module.CommandPalette })));
const KeyboardShortcutsOverlay = lazy(() =>
  import("./KeyboardShortcutsOverlay").then((module) => ({ default: module.KeyboardShortcutsOverlay })),
);

const PANEL_COMMANDS: ReadonlyArray<{ panel: Panel; labelKey: string; keywords: string[] }> = [
  { panel: "characters", labelKey: "palette.actions.openCharacters", keywords: ["cards", "bots"] },
  { panel: "personas", labelKey: "palette.actions.openPersonas", keywords: ["user", "profile"] },
  { panel: "lorebooks", labelKey: "palette.actions.openLorebooks", keywords: ["world info", "lore"] },
  { panel: "presets", labelKey: "palette.actions.openPresets", keywords: ["prompts"] },
  { panel: "connections", labelKey: "palette.actions.openConnections", keywords: ["api", "models", "providers"] },
  { panel: "agents", labelKey: "palette.actions.openAgents", keywords: ["tools"] },
];

export function CommandPaletteHost() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const paletteOpen = useCommandPaletteStore((s) => s.paletteOpen);
  const shortcutsOpen = useCommandPaletteStore((s) => s.shortcutsOpen);
  const [paletteLoaded, setPaletteLoaded] = useState(false);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const { launch } = useLaunchNewChat();
  // launch() is rebuilt every render; a ref keeps the registered actions stable.
  const launchRef = useRef(launch);
  launchRef.current = launch;

  useEffect(() => {
    if (paletteOpen) setPaletteLoaded(true);
  }, [paletteOpen]);
  useEffect(() => {
    if (shortcutsOpen) setShortcutsLoaded(true);
  }, [shortcutsOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (isPaletteShortcut(event)) {
        // Not over a dialog the user is in the middle of: a palette command that opens its own
        // dialog would swap that one out, since the app shows one dialog at a time.
        const palette = useCommandPaletteStore.getState();
        if (!canTogglePaletteFromShortcut(countModalOverlays(), palette.paletteOpen)) return;
        event.preventDefault();
        palette.togglePalette();
        return;
      }
      if (isShortcutsHelpKey(event) && !isTypingTarget(event.target) && countModalOverlays() === 0) {
        event.preventDefault();
        useCommandPaletteStore.getState().openShortcuts();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Built-in actions go through the same public registry other features use.
  useEffect(() => {
    const activeChatMode = () => {
      const activeChatId = useChatStore.getState().activeChatId;
      if (!activeChatId) return null;
      const chats = queryClient.getQueryData<Chat[]>(chatKeys.list());
      return chats?.find((chat) => chat.id === activeChatId)?.mode ?? null;
    };
    const newChat = (mode: "conversation" | "roleplay" | "game") => async () => {
      if (!(await confirmLeaveDirtyEditor())) return;
      useUIStore.getState().closeAllDetails();
      launchRef.current(mode);
    };
    const unregisters = [
      registerCommand({
        id: "action:new-conversation",
        section: "actions",
        title: t("palette.actions.newConversation"),
        keywords: ["new chat", "create", "start"],
        run: newChat("conversation"),
      }),
      registerCommand({
        id: "action:new-roleplay",
        section: "actions",
        title: t("palette.actions.newRoleplay"),
        keywords: ["new chat", "create", "start", "rp"],
        run: newChat("roleplay"),
      }),
      registerCommand({
        id: "action:new-game",
        section: "actions",
        title: t("palette.actions.newGame"),
        keywords: ["new chat", "create", "start", "campaign"],
        run: newChat("game"),
      }),
      registerCommand({
        id: "action:home",
        section: "actions",
        title: t("palette.actions.home"),
        keywords: ["start page", "hub"],
        run: async () => {
          if (!(await confirmLeaveDirtyEditor())) return;
          window.dispatchEvent(new Event("marinara:home-professor-mari-close"));
          useChatStore.getState().setActiveChatId(null);
          const ui = useUIStore.getState();
          ui.closeAllDetails();
          // Like the top bar's Home button: in the overlay layout, panels covering Home close too.
          if (!isMobileShellViewport()) return;
          ui.setSidebarOpen(false);
          ui.closeRightPanel();
        },
      }),
      registerCommand({
        id: "action:toggle-chats",
        section: "actions",
        title: t("palette.actions.toggleChats"),
        keywords: ["sidebar", "chat list"],
        run: () => useUIStore.getState().toggleSidebar(),
      }),
      registerCommand({
        id: "action:open-settings",
        section: "actions",
        title: t("palette.actions.openSettings"),
        keywords: ["preferences", "options"],
        run: () => useUIStore.getState().openRightPanel("settings"),
      }),
      registerCommand({
        id: "action:toggle-theme",
        section: "actions",
        title: t("palette.actions.toggleTheme"),
        keywords: ["dark mode", "light mode", "appearance"],
        run: () => {
          const ui = useUIStore.getState();
          ui.setTheme(ui.theme === "dark" ? "light" : "dark");
        },
      }),
      registerCommand({
        id: "action:shortcuts",
        section: "actions",
        title: t("palette.actions.shortcuts"),
        keywords: ["keyboard", "hotkeys", "help", "keys"],
        shortcut: "?",
        run: () => useCommandPaletteStore.getState().openShortcuts(),
      }),
      registerCommand({
        id: "action:chat-guide",
        section: "actions",
        title: t("palette.actions.chatGuide"),
        keywords: ["help", "tour", "explain"],
        // The guide lives in the chat screen, which an open editor replaces.
        when: () => activeChatMode() !== null && !useUIStore.getState().hasAnyDetailOpen(),
        run: () => {
          const mode = activeChatMode();
          if (mode) requestChatHelp(mode);
        },
      }),
      registerCommand({
        id: "action:browse-cards",
        section: "actions",
        title: t("palette.actions.browseCards"),
        keywords: ["bot browser", "download", "import"],
        run: () => useUIStore.getState().openBotBrowser(),
      }),
      registerCommand({
        id: "action:character-library",
        section: "actions",
        title: t("palette.actions.characterLibrary"),
        keywords: ["characters", "cards"],
        run: () => useUIStore.getState().openCharacterLibrary(),
      }),
      ...PANEL_COMMANDS.map(({ panel, labelKey, keywords }) =>
        registerCommand({
          id: `action:panel-${panel}`,
          section: "actions",
          title: t(labelKey),
          keywords,
          run: () => useUIStore.getState().openRightPanel(panel),
        }),
      ),
    ];
    return () => unregisters.forEach((unregister) => unregister());
  }, [queryClient, t]);

  return (
    <>
      {paletteLoaded && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      {shortcutsLoaded && (
        <Suspense fallback={null}>
          <KeyboardShortcutsOverlay />
        </Suspense>
      )}
    </>
  );
}
