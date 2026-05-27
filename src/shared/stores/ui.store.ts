// --------------------------------------------------
// Zustand Store: UI Slice
// --------------------------------------------------
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeQuoteFormat } from "../lib/dialogue-quotes";
import {
  DEFAULT_GAME_SETUP_LEARNED_OPTIONS,
  DEFAULT_GAME_SETUP_REMEMBERED_TEXT,
  DEFAULT_SUMMARY_POPOVER_SETTINGS,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  ROLEPLAY_AVATAR_SCALE_MAX,
  ROLEPLAY_AVATAR_SCALE_MIN,
  ROLEPLAY_SPRITE_SCALE_MAX,
  ROLEPLAY_SPRITE_SCALE_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  TRACKER_DATA_PANEL_SECTIONS,
  CLEARED_DETAIL_IDS,
  clampImageDimension,
  mergeLearnedGameSetupOptions,
  mobilePanelClosePatch,
  normalizeLearnedGameSetupOption,
  normalizeRememberedGameSetupText,
  normalizeSummaryPopoverSettings,
  normalizeTrackerPanelSizeProfile,
  normalizeTrackerPanelSectionOrder,
  normalizeTrackerTemperatureUnit,
  normalizeTrackerThoughtBubbleDisplay,
  openDetailRouteState,
} from "./ui/model";
import type {
  AppLanguage,
  EchoChamberSide,
  FontSize,
  GameDialogueDisplayMode,
  HudPosition,
  Panel,
  QuoteFormat,
  RoleplayAvatarStyle,
  TrackerPanelSizeProfile,
  TrackerPanelSide,
  TrackerTemperatureUnit,
  TrackerThoughtBubbleDisplay,
  UIState,
  UserStatus,
  VisualTheme,
} from "./ui/model";
import {
  createDebouncedUiStorage,
  migrateUiState,
  partializeUiState,
  UI_STORE_NAME,
  UI_STORE_VERSION,
} from "./ui/persistence";

export {
  APP_LANGUAGE_OPTIONS,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  TRACKER_DATA_PANEL_SECTIONS,
  TRACKER_PANEL_SIZE_PROFILES,
  TRACKER_PANEL_SIZE_PROFILE_WIDTHS,
  TRACKER_PANEL_WIDTH_DEFAULT,
  TRACKER_PANEL_WIDTH_MAX,
  TRACKER_PANEL_WIDTH_MIN,
  TRACKER_TEMPERATURE_UNITS,
  getTrackerPanelWidthForProfile,
} from "./ui/model";
export type {
  AppLanguage,
  EchoChamberSide,
  FloatingWidgetPosition,
  FontSize,
  GameDialogueDisplayMode,
  GameSetupLearnedOptions,
  GameSetupRememberedText,
  HudPosition,
  Panel,
  QuoteFormat,
  RoleplayAvatarStyle,
  SummaryPopoverSettings,
  SummaryPopoverSourceMode,
  TrackerDataPanelSection,
  TrackerPanelCollapsedSections,
  TrackerPanelSectionOrder,
  TrackerPanelSizeProfile,
  TrackerPanelSide,
  TrackerTemperatureUnit,
  TrackerThoughtBubbleDisplay,
  UIState,
  UserStatus,
  VisualTheme,
} from "./ui/model";
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      rightPanelOpen: false,
      rightPanelWidth: 320,
      rightPanel: "chat" as Panel,
      trackerPanelEnabled: true,
      trackerPanelOpen: false,
      trackerPanelSide: "right" as TrackerPanelSide,
      trackerPanelHideHudWidgets: false,
      trackerPanelUseExpressionSprites: false,
      trackerPanelThoughtBubbleDisplay: "inline" as TrackerThoughtBubbleDisplay,
      trackerPanelDockedThoughtsAlwaysVisible: false,
      trackerPanelSizeProfile: "standard" as TrackerPanelSizeProfile,
      trackerTemperatureUnit: "celsius" as TrackerTemperatureUnit,
      trackerPanelCollapsedSections: {},
      trackerPanelSectionOrder: [...TRACKER_DATA_PANEL_SECTIONS],
      settingsTab: "general",
      modal: null,
      theme: "dark" as const,
      chatBackground: null,
      chatBackgroundBlur: 0,
      characterDetailId: null,
      lorebookDetailId: null,
      presetDetailId: null,
      connectionDetailId: null,
      agentDetailId: null,
      toolDetailId: null,
      personaDetailId: null,
      regexDetailId: null,
      botBrowserOpen: false,
      gameAssetsBrowserOpen: false,
      characterLibraryOpen: false,
      editorDirty: false,

      // Settings defaults
      fontSize: 17 as FontSize,
      language: "en" as AppLanguage,
      chatFontSize: 16,
      fontFamily: "",
      enableStreaming: true,
      debugMode: false,
      streamingSpeed: 50,
      gameInstantTextReveal: false,
      gameMiddleMouseNav: false,
      gameDialogueDisplayMode: "classic" as GameDialogueDisplayMode,
      gameTextSpeed: 50,
      gameAutoPlayDelay: 3000,
      reviewImagePromptsBeforeSend: false,
      imageBackgroundWidth: 1280,
      imageBackgroundHeight: 720,
      imagePortraitWidth: 1024,
      imagePortraitHeight: 1024,
      imageSelfieWidth: 896,
      imageSelfieHeight: 1152,

      messageGrouping: true,
      showTimestamps: false,
      showModelName: false,
      showTokenUsage: false,
      showMessageNumbers: false,
      guideGenerations: false,
      showQuickRepliesMenu: false,
      showQuickReplyPostOnly: true,
      showQuickReplyGuide: true,
      showQuickReplyImpersonate: true,
      confirmBeforeDelete: true,
      messagesPerPage: 20,
      boldDialogue: true,
      quoteFormat: "straight" as QuoteFormat,
      trimIncompleteModelOutput: false,
      speechToTextEnabled: false,
      spotifyPlayerEnabled: false,
      chibiProfessorMariEnabled: true,
      remoteRuntimeUrl: "",
      spotifyMobileWidgetCollapsed: true,
      spotifyMobileWidgetPosition: { x: 16, y: 96 },
      intuitiveSwipeNavigation: false,
      intuitiveSwipeRerollLatest: false,
      editLastMessageOnArrowUp: true,
      summaryPopoverSettings: DEFAULT_SUMMARY_POPOVER_SETTINGS,
      narrationFontColor: "",
      narrationOpacity: 80,
      chatFontColor: "",
      chatFontOpacity: 90,
      roleplayAvatarStyle: "circles" as RoleplayAvatarStyle,
      roleplayAvatarScale: 1,
      roleplaySpriteScale: 1,
      gameAvatarScale: 1,
      gameFullBodySpriteScale: 1.35,
      textStrokeWidth: 0.5,
      textStrokeColor: "#000000",
      visualTheme: "default" as VisualTheme,
      convoGradient: {
        dark: { from: "#0a0a0e", to: "#1c2133" },
        light: { from: "#f2eff7", to: "#eae6f0" },
      },
      convoNotificationSound: true,
      rpNotificationSound: true,
      conversationBrowserNotifications: false,
      customConversationPrompt: null,
      scheduleGenerationPreferences: "",
      learnedGameSetupOptions: DEFAULT_GAME_SETUP_LEARNED_OPTIONS,
      rememberedGameSetupText: DEFAULT_GAME_SETUP_REMEMBERED_TEXT,
      enterToSendRP: false,
      enterToSendConvo: true,
      enterToSendGame: true,
      weatherEffects: true,
      hudPosition: "top" as HudPosition,
      hasCompletedOnboarding: false,
      gameTutorialDisabled: false,
      linkApiBannerDismissed: false,
      echoChamberOpen: false,
      echoChamberSide: "bottom-right" as EchoChamberSide,
      userStatusManual: "active" as const,
      userStatus: "active" as UserStatus,
      userActivity: "",
      centerCompact: false,

      // Impersonate settings defaults
      impersonatePromptTemplate: "",
      impersonateShowQuickButton: false,
      impersonateCyoaChoices: false,
      impersonatePresetId: null,
      impersonateConnectionId: null,
      impersonateBlockAgents: false,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, width)) }),
      setRightPanelWidth: (width) =>
        set({ rightPanelWidth: Math.max(RIGHT_PANEL_WIDTH_MIN, Math.min(RIGHT_PANEL_WIDTH_MAX, width)) }),
      toggleTrackerPanel: () =>
        set((s) => ({
          trackerPanelOpen: s.trackerPanelEnabled ? !s.trackerPanelOpen : false,
        })),
      setTrackerPanelEnabled: (enabled) =>
        set({
          trackerPanelEnabled: enabled,
          trackerPanelOpen: enabled ? get().trackerPanelOpen : false,
        }),
      setTrackerPanelOpen: (open) =>
        set((s) => ({
          trackerPanelOpen: s.trackerPanelEnabled ? open : false,
        })),
      setTrackerPanelSide: (side) => set({ trackerPanelSide: side }),
      setTrackerPanelHideHudWidgets: (hidden) => set({ trackerPanelHideHudWidgets: hidden }),
      setTrackerPanelUseExpressionSprites: (enabled) => set({ trackerPanelUseExpressionSprites: enabled }),
      setTrackerPanelThoughtBubbleDisplay: (display) =>
        set({ trackerPanelThoughtBubbleDisplay: normalizeTrackerThoughtBubbleDisplay(display) }),
      setTrackerPanelDockedThoughtsAlwaysVisible: (visible) =>
        set({ trackerPanelDockedThoughtsAlwaysVisible: visible }),
      setTrackerPanelSizeProfile: (profile) =>
        set({ trackerPanelSizeProfile: normalizeTrackerPanelSizeProfile(profile) }),
      setTrackerTemperatureUnit: (unit) => set({ trackerTemperatureUnit: normalizeTrackerTemperatureUnit(unit) }),
      setTrackerPanelSectionOrder: (order) =>
        set({ trackerPanelSectionOrder: normalizeTrackerPanelSectionOrder(order) }),
      setTrackerPanelSectionCollapsed: (section, collapsed) =>
        set((s) => {
          const next = { ...s.trackerPanelCollapsedSections };
          if (collapsed) {
            next[section] = true;
          } else {
            delete next[section];
          }
          return { trackerPanelCollapsedSections: next };
        }),
      toggleTrackerPanelSectionCollapsed: (section) =>
        set((s) => {
          const next = { ...s.trackerPanelCollapsedSections };
          if (next[section]) {
            delete next[section];
          } else {
            next[section] = true;
          }
          return { trackerPanelCollapsedSections: next };
        }),

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
      setChatBackgroundBlur: (v) =>
        set({ chatBackgroundBlur: Math.max(0, Math.min(24, Math.round(Number.isFinite(v) ? v : 0))) }),
      openCharacterDetail: (id) =>
        set(openDetailRouteState({ characterDetailId: id })),
      closeCharacterDetail: () => set({ characterDetailId: null, editorDirty: false }),
      openLorebookDetail: (id) =>
        set(openDetailRouteState({ lorebookDetailId: id, characterLibraryOpen: false })),
      closeLorebookDetail: () => set({ lorebookDetailId: null, editorDirty: false }),
      openPresetDetail: (id) =>
        set(openDetailRouteState({ presetDetailId: id, characterLibraryOpen: false })),
      closePresetDetail: () => set({ presetDetailId: null, editorDirty: false }),
      openConnectionDetail: (id) =>
        set(openDetailRouteState({ connectionDetailId: id, characterLibraryOpen: false })),
      closeConnectionDetail: () => set({ connectionDetailId: null, editorDirty: false }),
      openAgentDetail: (agentType) =>
        set(openDetailRouteState({ agentDetailId: agentType, characterLibraryOpen: false })),
      closeAgentDetail: () => set({ agentDetailId: null, editorDirty: false }),
      openToolDetail: (id) =>
        set(openDetailRouteState({ toolDetailId: id, characterLibraryOpen: false })),
      closeToolDetail: () => set({ toolDetailId: null, editorDirty: false }),
      openPersonaDetail: (id) =>
        set(openDetailRouteState({ personaDetailId: id, characterLibraryOpen: false })),
      closePersonaDetail: () => set({ personaDetailId: null, editorDirty: false }),
      openRegexDetail: (id) =>
        set(openDetailRouteState({ regexDetailId: id, characterLibraryOpen: false })),
      closeRegexDetail: () => set({ regexDetailId: null, editorDirty: false }),
      openCharacterLibrary: () =>
        set({
          ...CLEARED_DETAIL_IDS,
          characterLibraryOpen: true,
          botBrowserOpen: false,
          editorDirty: false,
          rightPanelOpen: false,
        }),
      closeCharacterLibrary: () => set({ characterLibraryOpen: false }),
      openBotBrowser: () =>
        set({
          ...CLEARED_DETAIL_IDS,
          botBrowserOpen: true,
          gameAssetsBrowserOpen: false,
          characterLibraryOpen: false,
          ...mobilePanelClosePatch(),
        }),
      closeBotBrowser: () => set({ botBrowserOpen: false }),
      openGameAssetsBrowser: () =>
        set({
          ...CLEARED_DETAIL_IDS,
          gameAssetsBrowserOpen: true,
          botBrowserOpen: false,
          characterLibraryOpen: false,
          ...mobilePanelClosePatch(),
        }),
      closeGameAssetsBrowser: () => set({ gameAssetsBrowserOpen: false }),

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
          s.regexDetailId ||
          s.characterLibraryOpen ||
          s.botBrowserOpen ||
          s.gameAssetsBrowserOpen
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
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          editorDirty: false,
        }),
      setEditorDirty: (dirty) => set({ editorDirty: dirty }),

      // Settings actions
      setFontSize: (size) => set({ fontSize: size }),
      setLanguage: (language) => set({ language }),
      setChatFontSize: (size) => set({ chatFontSize: size }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setEnableStreaming: (v) => set({ enableStreaming: v }),
      setDebugMode: (v) => set({ debugMode: v }),
      setStreamingSpeed: (v) => set({ streamingSpeed: Math.max(1, Math.min(100, v)) }),
      setGameInstantTextReveal: (v) => set({ gameInstantTextReveal: v }),
      setGameMiddleMouseNav: (v) => set({ gameMiddleMouseNav: v }),
      setGameDialogueDisplayMode: (v) => set({ gameDialogueDisplayMode: v }),
      setGameTextSpeed: (v) => set({ gameTextSpeed: Math.max(1, Math.min(100, v)) }),
      setGameAutoPlayDelay: (v) => set({ gameAutoPlayDelay: Math.max(200, Math.min(10000, Math.round(v))) }),
      setReviewImagePromptsBeforeSend: (v) => set({ reviewImagePromptsBeforeSend: v }),
      setImageBackgroundDimensions: (width, height) =>
        set({
          imageBackgroundWidth: clampImageDimension(width),
          imageBackgroundHeight: clampImageDimension(height),
        }),
      setImagePortraitDimensions: (width, height) =>
        set({
          imagePortraitWidth: clampImageDimension(width),
          imagePortraitHeight: clampImageDimension(height),
        }),
      setImageSelfieDimensions: (width, height) =>
        set({
          imageSelfieWidth: clampImageDimension(width),
          imageSelfieHeight: clampImageDimension(height),
        }),

      setMessageGrouping: (v) => set({ messageGrouping: v }),
      setShowTimestamps: (v) => set({ showTimestamps: v }),
      setShowModelName: (v) => set({ showModelName: v }),
      setShowTokenUsage: (v) => set({ showTokenUsage: v }),
      setShowMessageNumbers: (v) => set({ showMessageNumbers: v }),
      setGuideGenerations: (v) => set({ guideGenerations: v }),
      setShowQuickRepliesMenu: (v) => set({ showQuickRepliesMenu: v }),
      setShowQuickReplyPostOnly: (v) => set({ showQuickReplyPostOnly: v }),
      setShowQuickReplyGuide: (v) => set({ showQuickReplyGuide: v }),
      setShowQuickReplyImpersonate: (v) => set({ showQuickReplyImpersonate: v }),
      setConfirmBeforeDelete: (v) => set({ confirmBeforeDelete: v }),
      setMessagesPerPage: (n) => set({ messagesPerPage: n }),
      setBoldDialogue: (v) => set({ boldDialogue: v }),
      setQuoteFormat: (v) => set({ quoteFormat: normalizeQuoteFormat(v) }),
      setTrimIncompleteModelOutput: (v) => set({ trimIncompleteModelOutput: v }),
      setSpeechToTextEnabled: (v) => set({ speechToTextEnabled: v }),
      setSpotifyPlayerEnabled: (v) => set({ spotifyPlayerEnabled: v }),
      setChibiProfessorMariEnabled: (v) => set({ chibiProfessorMariEnabled: v }),
      setRemoteRuntimeUrl: (v) => set({ remoteRuntimeUrl: v.trim() }),
      setSpotifyMobileWidgetCollapsed: (v) => set({ spotifyMobileWidgetCollapsed: v }),
      setSpotifyMobileWidgetPosition: (position) =>
        set({
          spotifyMobileWidgetPosition: {
            x: Number.isFinite(position.x) ? Math.max(8, Math.round(position.x)) : 16,
            y: Number.isFinite(position.y) ? Math.max(8, Math.round(position.y)) : 96,
          },
        }),
      setIntuitiveSwipeNavigation: (v) => set({ intuitiveSwipeNavigation: v }),
      setIntuitiveSwipeRerollLatest: (v) => set({ intuitiveSwipeRerollLatest: v }),
      setEditLastMessageOnArrowUp: (v) => set({ editLastMessageOnArrowUp: v }),
      setSummaryPopoverSettings: (settings) =>
        set((state) => ({
          summaryPopoverSettings: normalizeSummaryPopoverSettings({
            ...state.summaryPopoverSettings,
            ...settings,
          }),
        })),
      setNarrationFontColor: (v) => set({ narrationFontColor: v }),
      setNarrationOpacity: (v) => set({ narrationOpacity: Math.max(0, Math.min(100, v)) }),
      setChatFontColor: (v) => set({ chatFontColor: v }),
      setChatFontOpacity: (v) => set({ chatFontOpacity: Math.max(0, Math.min(100, v)) }),
      setRoleplayAvatarStyle: (v) => set({ roleplayAvatarStyle: v }),
      setRoleplayAvatarScale: (v) =>
        set({ roleplayAvatarScale: Math.max(ROLEPLAY_AVATAR_SCALE_MIN, Math.min(ROLEPLAY_AVATAR_SCALE_MAX, v)) }),
      setRoleplaySpriteScale: (v) =>
        set({ roleplaySpriteScale: Math.max(ROLEPLAY_SPRITE_SCALE_MIN, Math.min(ROLEPLAY_SPRITE_SCALE_MAX, v)) }),
      setGameAvatarScale: (v) => set({ gameAvatarScale: Math.max(0.75, Math.min(1.75, v)) }),
      setGameFullBodySpriteScale: (v) => set({ gameFullBodySpriteScale: Math.max(0.75, Math.min(2.75, v)) }),
      setTextStrokeWidth: (v) => set({ textStrokeWidth: Math.max(0, Math.min(5, v)) }),
      setTextStrokeColor: (v) => set({ textStrokeColor: v }),
      setCenterCompact: (v) => set({ centerCompact: v }),
      setVisualTheme: (v) => set({ visualTheme: v }),
      setConvoGradientField: (scheme, field, value) =>
        set((s) => ({
          convoGradient: {
            ...s.convoGradient,
            [scheme]: { ...s.convoGradient[scheme], [field]: value },
          },
        })),
      setConvoNotificationSound: (v) => set({ convoNotificationSound: v }),
      setRpNotificationSound: (v) => set({ rpNotificationSound: v }),
      setConversationBrowserNotifications: (v) => set({ conversationBrowserNotifications: v }),
      setCustomConversationPrompt: (v) => set({ customConversationPrompt: v }),
      setScheduleGenerationPreferences: (v) => set({ scheduleGenerationPreferences: v }),
      rememberGameSetupOptions: (options, text) =>
        set((state) => {
          const learned = state.learnedGameSetupOptions ?? DEFAULT_GAME_SETUP_LEARNED_OPTIONS;
          const remembered = state.rememberedGameSetupText ?? DEFAULT_GAME_SETUP_REMEMBERED_TEXT;
          return {
            learnedGameSetupOptions: {
              genres: mergeLearnedGameSetupOptions(learned.genres, options.genres ?? []),
              tones: mergeLearnedGameSetupOptions(learned.tones, options.tones ?? []),
              settings: mergeLearnedGameSetupOptions(learned.settings, options.settings ?? []),
              goals: mergeLearnedGameSetupOptions(learned.goals, options.goals ?? []),
              preferences: mergeLearnedGameSetupOptions(learned.preferences, options.preferences ?? []),
            },
            rememberedGameSetupText: {
              playerGoals:
                text?.playerGoals !== undefined
                  ? normalizeRememberedGameSetupText(text.playerGoals)
                  : remembered.playerGoals,
              preferences:
                text?.preferences !== undefined
                  ? normalizeRememberedGameSetupText(text.preferences)
                  : remembered.preferences,
            },
          };
        }),
      forgetGameSetupOption: (group, value) =>
        set((state) => {
          const learned = state.learnedGameSetupOptions ?? DEFAULT_GAME_SETUP_LEARNED_OPTIONS;
          const targetKey = normalizeLearnedGameSetupOption(value).toLowerCase();
          if (!targetKey) return state;
          const next = learned[group].filter(
            (entry) => normalizeLearnedGameSetupOption(entry).toLowerCase() !== targetKey,
          );
          if (next.length === learned[group].length) return state;
          return {
            learnedGameSetupOptions: { ...learned, [group]: next },
          };
        }),
      setEnterToSendRP: (v) => set({ enterToSendRP: v }),
      setEnterToSendConvo: (v) => set({ enterToSendConvo: v }),
      setEnterToSendGame: (v) => set({ enterToSendGame: v }),
      setWeatherEffects: (v) => set({ weatherEffects: v }),
      setHudPosition: (v) => set({ hudPosition: v }),
      setImpersonatePromptTemplate: (v) => set({ impersonatePromptTemplate: v }),
      setImpersonateShowQuickButton: (v) => set({ impersonateShowQuickButton: v }),
      setImpersonateCyoaChoices: (v) => set({ impersonateCyoaChoices: v }),
      setImpersonatePresetId: (id) => set({ impersonatePresetId: id }),
      setImpersonateConnectionId: (id) => set({ impersonateConnectionId: id }),
      setImpersonateBlockAgents: (v) => set({ impersonateBlockAgents: v }),
      setHasCompletedOnboarding: (v) => set({ hasCompletedOnboarding: v }),
      setGameTutorialDisabled: (v) => set({ gameTutorialDisabled: v }),
      dismissLinkApiBanner: () => set({ linkApiBannerDismissed: true }),
      toggleEchoChamber: () => set((s) => ({ echoChamberOpen: !s.echoChamberOpen })),
      setEchoChamberSide: (side) => set({ echoChamberSide: side }),
      setUserStatus: (status) =>
        set((state) => {
          if (state.userStatusManual === "dnd") {
            return state.userStatus === "dnd" ? state : { userStatus: "dnd" };
          }
          const nextStatus = status === "dnd" ? "active" : status;
          return state.userStatus === nextStatus ? state : { userStatus: nextStatus };
        }),
      setUserStatusManual: (status) =>
        set({
          userStatusManual: status === "dnd" ? "dnd" : "active",
          userStatus: status,
        }),
      setUserActivity: (activity) => set({ userActivity: activity.slice(0, 120) }),
    }),
    {
      name: UI_STORE_NAME,
      version: UI_STORE_VERSION,
      storage: createDebouncedUiStorage(),
      migrate: migrateUiState,
      partialize: partializeUiState,
    },
  ),
);
