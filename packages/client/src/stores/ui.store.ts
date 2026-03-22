// ──────────────────────────────────────────────
// Zustand Store: UI Slice
// ──────────────────────────────────────────────
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Panel = "chat" | "characters" | "lorebooks" | "presets" | "connections" | "agents" | "personas" | "settings";
type FontSize = 12 | 14 | 16 | 17 | 19 | 22;
export type VisualTheme = "default" | "sillytavern";
export type HudPosition = "top" | "left" | "right";
export type EchoChamberSide = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type UserStatus = "active" | "idle" | "dnd";

/** A user-installed custom theme */
export interface CustomTheme {
  id: string;
  name: string;
  /** Raw CSS that gets injected as a <style> tag */
  css: string;
  /** When this theme was installed */
  installedAt: string;
}

/** A user-installed extension (JS/CSS) */
export interface InstalledExtension {
  id: string;
  name: string;
  description: string;
  /** CSS to inject */
  css?: string;
  /** Whether the extension is enabled */
  enabled: boolean;
  installedAt: string;
}

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanel: Panel;
  settingsTab: string;
  modal: { type: string; props?: Record<string, unknown> } | null;
  theme: "dark" | "light";
  chatBackground: string | null;
  /** When set, the main area shows the full-page character editor instead of chat */
  characterDetailId: string | null;
  /** When set, the main area shows the full-page lorebook editor instead of chat */
  lorebookDetailId: string | null;
  /** When set, the main area shows the full-page preset editor instead of chat */
  presetDetailId: string | null;
  /** When set, the main area shows the full-page connection editor instead of chat */
  connectionDetailId: string | null;
  /** When set, the main area shows the full-page agent editor. Value is the agent *type* id (e.g. "world-state") */
  agentDetailId: string | null;
  /** When set, the main area shows the full-page tool editor */
  toolDetailId: string | null;
  /** When set, the main area shows the full-page persona editor */
  personaDetailId: string | null;
  /** When set, the main area shows the full-page regex script editor */
  regexDetailId: string | null;
  /** True when any open detail editor has unsaved changes */
  editorDirty: boolean;

  // ── Settings (persisted) ──
  fontSize: FontSize;
  /** Font size for chat messages (px) */
  chatFontSize: number;
  /** Custom font family name (empty = default Inter) */
  fontFamily: string;
  enableStreaming: boolean;
  /** Typewriter speed: 1 (very slow) to 100 (instant). Controls how fast streaming tokens appear. */
  streamingSpeed: number;
  debugMode: boolean;
  messageGrouping: boolean;
  showTimestamps: boolean;
  showModelName: boolean;
  confirmBeforeDelete: boolean;
  /** Number of messages to load per page (0 = load all) */
  messagesPerPage: number;
  /** Bold and color text inside quotation marks in chat messages */
  boldDialogue: boolean;

  // ── Visual Theme ──
  visualTheme: VisualTheme;

  // ── Conversation Gradient ──
  convoGradientFrom: string;
  convoGradientTo: string;

  // ── Sound ──
  convoNotificationSound: boolean;

  // ── Input ──
  enterToSendRP: boolean;
  enterToSendConvo: boolean;

  // ── Roleplay Effects ──
  weatherEffects: boolean;

  // ── HUD Layout ──
  hudPosition: HudPosition;

  // ── Custom Themes & Extensions ──
  /** Currently active custom theme id (null = built-in default) */
  activeCustomTheme: string | null;
  customThemes: CustomTheme[];
  installedExtensions: InstalledExtension[];

  // ── Onboarding ──
  hasCompletedOnboarding: boolean;

  // ── Dismissals ──
  linkApiBannerDismissed: boolean;

  // ── EchoChamber ──
  echoChamberOpen: boolean;
  echoChamberSide: EchoChamberSide;

  // ── User Status ──
  /** The user's manually chosen status. Persisted. */
  userStatusManual: UserStatus;
  /** Effective status: matches manual, but auto-flips to "idle" on inactivity */
  userStatus: UserStatus;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  openRightPanel: (panel: Panel) => void;
  closeRightPanel: () => void;
  toggleRightPanel: (panel: Panel) => void;
  setSettingsTab: (tab: string) => void;
  openModal: (type: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setChatBackground: (url: string | null) => void;
  openCharacterDetail: (id: string) => void;
  closeCharacterDetail: () => void;
  openLorebookDetail: (id: string) => void;
  closeLorebookDetail: () => void;
  openPresetDetail: (id: string) => void;
  closePresetDetail: () => void;
  openConnectionDetail: (id: string) => void;
  closeConnectionDetail: () => void;
  openAgentDetail: (agentType: string) => void;
  closeAgentDetail: () => void;
  openToolDetail: (id: string) => void;
  closeToolDetail: () => void;
  openPersonaDetail: (id: string) => void;
  closePersonaDetail: () => void;
  openRegexDetail: (id: string) => void;
  closeRegexDetail: () => void;

  /** Returns true if any full-page detail editor is currently open */
  hasAnyDetailOpen: () => boolean;
  /** Close all detail editors at once */
  closeAllDetails: () => void;
  /** Update the editor dirty flag (called by detail editors when their dirty state changes) */
  setEditorDirty: (dirty: boolean) => void;

  // Settings actions
  setFontSize: (size: FontSize) => void;
  setChatFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setEnableStreaming: (v: boolean) => void;
  setStreamingSpeed: (v: number) => void;
  setDebugMode: (v: boolean) => void;
  setMessageGrouping: (v: boolean) => void;
  setShowTimestamps: (v: boolean) => void;
  setShowModelName: (v: boolean) => void;
  setConfirmBeforeDelete: (v: boolean) => void;
  setMessagesPerPage: (n: number) => void;
  setBoldDialogue: (v: boolean) => void;
  setVisualTheme: (v: VisualTheme) => void;
  setConvoGradientFrom: (v: string) => void;
  setConvoGradientTo: (v: string) => void;
  setConvoNotificationSound: (v: boolean) => void;
  setEnterToSendRP: (v: boolean) => void;
  setEnterToSendConvo: (v: boolean) => void;
  setWeatherEffects: (v: boolean) => void;
  setHudPosition: (v: HudPosition) => void;
  setActiveCustomTheme: (id: string | null) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  updateCustomTheme: (id: string, patch: Partial<Pick<CustomTheme, "name" | "css">>) => void;
  removeCustomTheme: (id: string) => void;
  addExtension: (ext: InstalledExtension) => void;
  removeExtension: (id: string) => void;
  toggleExtension: (id: string) => void;
  setHasCompletedOnboarding: (v: boolean) => void;
  dismissLinkApiBanner: () => void;
  toggleEchoChamber: () => void;
  setEchoChamberSide: (side: EchoChamberSide) => void;
  setUserStatus: (status: UserStatus) => void;
  setUserStatusManual: (status: UserStatus) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      rightPanelOpen: false,
      rightPanel: "chat" as Panel,
      settingsTab: "general",
      modal: null,
      theme: "dark" as const,
      chatBackground: null,
      characterDetailId: null,
      lorebookDetailId: null,
      presetDetailId: null,
      connectionDetailId: null,
      agentDetailId: null,
      toolDetailId: null,
      personaDetailId: null,
      regexDetailId: null,
      editorDirty: false,

      // Settings defaults
      fontSize: 17 as FontSize,
      chatFontSize: 16,
      fontFamily: "",
      enableStreaming: true,
      streamingSpeed: 50,
      debugMode: false,
      messageGrouping: true,
      showTimestamps: false,
      showModelName: false,
      confirmBeforeDelete: true,
      messagesPerPage: 20,
      boldDialogue: true,
      visualTheme: "default" as VisualTheme,
      convoGradientFrom: "#0a0a0e",
      convoGradientTo: "#1c2133",
      convoNotificationSound: true,
      enterToSendRP: false,
      enterToSendConvo: true,
      weatherEffects: true,
      hudPosition: "top" as HudPosition,
      activeCustomTheme: null,
      customThemes: [],
      installedExtensions: [],
      hasCompletedOnboarding: false,
      linkApiBannerDismissed: false,
      echoChamberOpen: false,
      echoChamberSide: "bottom-right" as EchoChamberSide,
      userStatusManual: "active" as const,
      userStatus: "active" as UserStatus,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openRightPanel: (panel) => set({ rightPanelOpen: true, rightPanel: panel }),
      closeRightPanel: () => set({ rightPanelOpen: false }),
      toggleRightPanel: (panel) =>
        set((s) =>
          s.rightPanelOpen && s.rightPanel === panel
            ? { rightPanelOpen: false }
            : { rightPanelOpen: true, rightPanel: panel },
        ),

      setSettingsTab: (tab) => set({ settingsTab: tab }),
      openModal: (type, props) => set({ modal: { type, props } }),
      closeModal: () => set({ modal: null }),
      setTheme: (theme) => set({ theme }),
      setChatBackground: (url) => set({ chatBackground: url }),
      openCharacterDetail: (id) =>
        set({
          characterDetailId: id,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeCharacterDetail: () => set({ characterDetailId: null, editorDirty: false }),
      openLorebookDetail: (id) =>
        set({
          lorebookDetailId: id,
          characterDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeLorebookDetail: () => set({ lorebookDetailId: null, editorDirty: false }),
      openPresetDetail: (id) =>
        set({
          presetDetailId: id,
          characterDetailId: null,
          lorebookDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closePresetDetail: () => set({ presetDetailId: null, editorDirty: false }),
      openConnectionDetail: (id) =>
        set({
          connectionDetailId: id,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          agentDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeConnectionDetail: () => set({ connectionDetailId: null, editorDirty: false }),
      openAgentDetail: (agentType) =>
        set({
          agentDetailId: agentType,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeAgentDetail: () => set({ agentDetailId: null, editorDirty: false }),
      openToolDetail: (id) =>
        set({
          toolDetailId: id,
          agentDetailId: null,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeToolDetail: () => set({ toolDetailId: null, editorDirty: false }),
      openPersonaDetail: (id) =>
        set({
          personaDetailId: id,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          regexDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closePersonaDetail: () => set({ personaDetailId: null, editorDirty: false }),
      openRegexDetail: (id) =>
        set({
          regexDetailId: id,
          personaDetailId: null,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeRegexDetail: () => set({ regexDetailId: null, editorDirty: false }),

      hasAnyDetailOpen: () => {
        const s = get();
        return !!(
          s.characterDetailId ||
          s.lorebookDetailId ||
          s.presetDetailId ||
          s.connectionDetailId ||
          s.agentDetailId ||
          s.toolDetailId ||
          s.personaDetailId ||
          s.regexDetailId
        );
      },
      closeAllDetails: () =>
        set({
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          editorDirty: false,
        }),
      setEditorDirty: (dirty) => set({ editorDirty: dirty }),

      // Settings actions
      setFontSize: (size) => set({ fontSize: size }),
      setChatFontSize: (size) => set({ chatFontSize: size }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setEnableStreaming: (v) => set({ enableStreaming: v }),
      setStreamingSpeed: (v) => set({ streamingSpeed: Math.max(1, Math.min(100, v)) }),
      setDebugMode: (v) => set({ debugMode: v }),
      setMessageGrouping: (v) => set({ messageGrouping: v }),
      setShowTimestamps: (v) => set({ showTimestamps: v }),
      setShowModelName: (v) => set({ showModelName: v }),
      setConfirmBeforeDelete: (v) => set({ confirmBeforeDelete: v }),
      setMessagesPerPage: (n) => set({ messagesPerPage: n }),
      setBoldDialogue: (v) => set({ boldDialogue: v }),
      setVisualTheme: (v) => set({ visualTheme: v }),
      setConvoGradientFrom: (v) => set({ convoGradientFrom: v }),
      setConvoGradientTo: (v) => set({ convoGradientTo: v }),
      setConvoNotificationSound: (v) => set({ convoNotificationSound: v }),
      setEnterToSendRP: (v) => set({ enterToSendRP: v }),
      setEnterToSendConvo: (v) => set({ enterToSendConvo: v }),
      setWeatherEffects: (v) => set({ weatherEffects: v }),
      setHudPosition: (v) => set({ hudPosition: v }),
      setActiveCustomTheme: (id) => set({ activeCustomTheme: id }),
      addCustomTheme: (theme) => set((s) => ({ customThemes: [...s.customThemes, theme] })),
      updateCustomTheme: (id, patch) =>
        set((s) => ({
          customThemes: s.customThemes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeCustomTheme: (id) =>
        set((s) => ({
          customThemes: s.customThemes.filter((t) => t.id !== id),
          activeCustomTheme: s.activeCustomTheme === id ? null : s.activeCustomTheme,
        })),
      addExtension: (ext) => set((s) => ({ installedExtensions: [...s.installedExtensions, ext] })),
      removeExtension: (id) =>
        set((s) => ({
          installedExtensions: s.installedExtensions.filter((e) => e.id !== id),
        })),
      toggleExtension: (id) =>
        set((s) => ({
          installedExtensions: s.installedExtensions.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
        })),
      setHasCompletedOnboarding: (v) => set({ hasCompletedOnboarding: v }),
      dismissLinkApiBanner: () => set({ linkApiBannerDismissed: true }),
      toggleEchoChamber: () => set((s) => ({ echoChamberOpen: !s.echoChamberOpen })),
      setEchoChamberSide: (side) => set({ echoChamberSide: side }),
      setUserStatus: (status) => set({ userStatus: status }),
      setUserStatusManual: (status) => set({ userStatusManual: status, userStatus: status }),
    }),
    {
      name: "marinara-engine-ui",
      version: 4,
      migrate: (persisted: any, version: number) => {
        if (version === 0 && persisted.fontSize === 14) {
          persisted.fontSize = 17;
        }
        // v1 → v2: replace streamingFps (30|60) with streamingSpeed (1–100)
        if (version <= 1) {
          delete persisted.streamingFps;
          if (persisted.streamingSpeed === undefined) {
            persisted.streamingSpeed = 50;
          }
        }
        // v2 → v3: split enterToSend into per-mode toggles
        if (version <= 2) {
          const old = persisted.enterToSend;
          delete persisted.enterToSend;
          // Keep conversation default true; respect old value for RP
          if (persisted.enterToSendRP === undefined) {
            persisted.enterToSendRP = old === true ? true : false;
          }
          if (persisted.enterToSendConvo === undefined) {
            persisted.enterToSendConvo = true;
          }
        }
        // v3 → v4: add conversation notification sound default
        if (version <= 3) {
          if (persisted.convoNotificationSound === undefined) {
            persisted.convoNotificationSound = true;
          }
        }
        return persisted;
      },
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
        chatBackground: state.chatBackground,
        fontSize: state.fontSize,
        chatFontSize: state.chatFontSize,
        fontFamily: state.fontFamily,
        enableStreaming: state.enableStreaming,
        streamingSpeed: state.streamingSpeed,
        debugMode: state.debugMode,
        messageGrouping: state.messageGrouping,
        showTimestamps: state.showTimestamps,
        showModelName: state.showModelName,
        confirmBeforeDelete: state.confirmBeforeDelete,
        messagesPerPage: state.messagesPerPage,
        boldDialogue: state.boldDialogue,
        visualTheme: state.visualTheme,
        convoGradientFrom: state.convoGradientFrom,
        convoGradientTo: state.convoGradientTo,
        enterToSendRP: state.enterToSendRP,
        enterToSendConvo: state.enterToSendConvo,
        weatherEffects: state.weatherEffects,
        hudPosition: state.hudPosition,
        activeCustomTheme: state.activeCustomTheme,
        customThemes: state.customThemes,
        installedExtensions: state.installedExtensions,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        linkApiBannerDismissed: state.linkApiBannerDismissed,
        echoChamberSide: state.echoChamberSide,
        userStatusManual: state.userStatusManual,
        convoNotificationSound: state.convoNotificationSound,
      }),
    },
  ),
);
