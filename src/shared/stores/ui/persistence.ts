import { createJSONStorage } from "zustand/middleware";
import { normalizeQuoteFormat } from "../../lib/dialogue-quotes";
import {
  RIGHT_PANEL_WIDTH_DEFAULT,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  normalizeTrackerPanelSectionOrder,
  normalizeTrackerPanelSizeProfile,
  normalizeSummaryPopoverSettings,
  normalizeTrackerPanelCollapsedSections,
  normalizeTrackerTemperatureUnit,
  normalizeTrackerThoughtBubbleDisplay,
} from "./model";
import type { UIState } from "./model";

export const UI_STORE_NAME = "marinara-engine-ui-tauri";
export const UI_STORE_VERSION = 6;

const LEGACY_SIDEBAR_WIDTH_DEFAULT = 280;

type PersistedUiState = Partial<UIState> & {
  trackerPanelWidth?: unknown;
};

function normalizePersistedWidth(value: unknown, fallback: number, min: number, max: number): number {
  const width = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, width));
}

export function createDebouncedUiStorage() {
  return createJSONStorage(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingName: string | null = null;
    let pendingValue: string | null = null;

    const flush = () => {
      if (pendingName !== null && pendingValue !== null) {
        localStorage.setItem(pendingName, pendingValue);
        pendingName = null;
        pendingValue = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", flush);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
    }

    return {
      getItem: (name: string) => localStorage.getItem(name),
      setItem: (name: string, value: string) => {
        pendingName = name;
        pendingValue = value;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 1000);
      },
      removeItem: (name: string) => localStorage.removeItem(name),
    };
  });
}

export function partializeUiState(state: UIState) {
  return {
    sidebarOpen: state.sidebarOpen,
    sidebarWidth: state.sidebarWidth,
    rightPanelWidth: state.rightPanelWidth,
    trackerPanelEnabled: state.trackerPanelEnabled,
    trackerPanelOpen: state.trackerPanelOpen,
    trackerPanelSide: state.trackerPanelSide,
    trackerPanelHideHudWidgets: state.trackerPanelHideHudWidgets,
    trackerPanelUseExpressionSprites: state.trackerPanelUseExpressionSprites,
    trackerPanelThoughtBubbleDisplay: state.trackerPanelThoughtBubbleDisplay,
    trackerPanelDockedThoughtsAlwaysVisible: state.trackerPanelDockedThoughtsAlwaysVisible,
    trackerPanelSizeProfile: state.trackerPanelSizeProfile,
    trackerTemperatureUnit: state.trackerTemperatureUnit,
    trackerPanelCollapsedSections: state.trackerPanelCollapsedSections,
    trackerPanelSectionOrder: state.trackerPanelSectionOrder,
    theme: state.theme,
    chatBackground: state.chatBackground,
    chatBackgroundBlur: state.chatBackgroundBlur,
    fontSize: state.fontSize,
    language: state.language,
    chatFontSize: state.chatFontSize,
    fontFamily: state.fontFamily,
    enableStreaming: state.enableStreaming,
    debugMode: state.debugMode,
    streamingSpeed: state.streamingSpeed,
    gameInstantTextReveal: state.gameInstantTextReveal,
    gameMiddleMouseNav: state.gameMiddleMouseNav,
    gameDialogueDisplayMode: state.gameDialogueDisplayMode,
    gameTextSpeed: state.gameTextSpeed,
    gameAutoPlayDelay: state.gameAutoPlayDelay,
    reviewImagePromptsBeforeSend: state.reviewImagePromptsBeforeSend,
    imagePromptIncludeAppearances: state.imagePromptIncludeAppearances,
    imagePromptFormat: state.imagePromptFormat,
    imageBackgroundWidth: state.imageBackgroundWidth,
    imageBackgroundHeight: state.imageBackgroundHeight,
    imagePortraitWidth: state.imagePortraitWidth,
    imagePortraitHeight: state.imagePortraitHeight,
    imageSelfieWidth: state.imageSelfieWidth,
    imageSelfieHeight: state.imageSelfieHeight,
    messageGrouping: state.messageGrouping,
    showTimestamps: state.showTimestamps,
    showModelName: state.showModelName,
    showTokenUsage: state.showTokenUsage,
    showMessageNumbers: state.showMessageNumbers,
    guideGenerations: state.guideGenerations,
    showQuickRepliesMenu: state.showQuickRepliesMenu,
    showQuickReplyPostOnly: state.showQuickReplyPostOnly,
    showQuickReplyGuide: state.showQuickReplyGuide,
    showQuickReplyImpersonate: state.showQuickReplyImpersonate,
    confirmBeforeDelete: state.confirmBeforeDelete,
    messagesPerPage: state.messagesPerPage,
    boldDialogue: state.boldDialogue,
    quoteFormat: state.quoteFormat,
    trimIncompleteModelOutput: state.trimIncompleteModelOutput,
    speechToTextEnabled: state.speechToTextEnabled,
    spotifyPlayerEnabled: state.spotifyPlayerEnabled,
    chibiProfessorMariEnabled: state.chibiProfessorMariEnabled,
    remoteRuntimeUrl: state.remoteRuntimeUrl,
    spotifyMobileWidgetCollapsed: state.spotifyMobileWidgetCollapsed,
    spotifyMobileWidgetPosition: state.spotifyMobileWidgetPosition,
    intuitiveSwipeNavigation: state.intuitiveSwipeNavigation,
    intuitiveSwipeRerollLatest: state.intuitiveSwipeRerollLatest,
    editLastMessageOnArrowUp: state.editLastMessageOnArrowUp,
    editMessagesOnDoubleClick: state.editMessagesOnDoubleClick,
    summaryPopoverSettings: state.summaryPopoverSettings,
    narrationFontColor: state.narrationFontColor,
    narrationOpacity: state.narrationOpacity,
    chatFontColor: state.chatFontColor,
    chatFontOpacity: state.chatFontOpacity,
    roleplayAvatarStyle: state.roleplayAvatarStyle,
    roleplayAvatarScale: state.roleplayAvatarScale,
    roleplaySpriteScale: state.roleplaySpriteScale,
    gameAvatarScale: state.gameAvatarScale,
    gameFullBodySpriteScale: state.gameFullBodySpriteScale,
    textStrokeWidth: state.textStrokeWidth,
    textStrokeColor: state.textStrokeColor,
    visualTheme: state.visualTheme,
    convoGradient: state.convoGradient,
    enterToSendRP: state.enterToSendRP,
    enterToSendConvo: state.enterToSendConvo,
    enterToSendGame: state.enterToSendGame,
    weatherEffects: state.weatherEffects,
    hudPosition: state.hudPosition,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    gameTutorialDisabled: state.gameTutorialDisabled,
    linkApiBannerDismissed: state.linkApiBannerDismissed,
    echoChamberSide: state.echoChamberSide,
    userStatusManual: state.userStatusManual === "dnd" ? "dnd" : "active",
    userActivity: state.userActivity,
    convoNotificationSound: state.convoNotificationSound,
    rpNotificationSound: state.rpNotificationSound,
    conversationBrowserNotifications: state.conversationBrowserNotifications,
    customConversationPrompt: state.customConversationPrompt,
    scheduleGenerationPreferences: state.scheduleGenerationPreferences,
    impersonatePromptTemplate: state.impersonatePromptTemplate,
    impersonateShowQuickButton: state.impersonateShowQuickButton,
    impersonateCyoaChoices: state.impersonateCyoaChoices,
    impersonatePresetId: state.impersonatePresetId,
    impersonateConnectionId: state.impersonateConnectionId,
    impersonateBlockAgents: state.impersonateBlockAgents,
    learnedGameSetupOptions: state.learnedGameSetupOptions,
    rememberedGameSetupText: state.rememberedGameSetupText,
  };
}

export function migrateUiState(persistedState: unknown): Partial<UIState> {
  const persisted =
    typeof persistedState === "object" && persistedState !== null
      ? { ...(persistedState as PersistedUiState) }
      : {};

  const legacyWidth = persisted.trackerPanelWidth;
  persisted.sidebarWidth = normalizePersistedWidth(
    persisted.sidebarWidth === LEGACY_SIDEBAR_WIDTH_DEFAULT ? SIDEBAR_WIDTH_DEFAULT : persisted.sidebarWidth,
    SIDEBAR_WIDTH_DEFAULT,
    SIDEBAR_WIDTH_MIN,
    SIDEBAR_WIDTH_MAX,
  );
  persisted.rightPanelWidth = normalizePersistedWidth(
    persisted.rightPanelWidth,
    RIGHT_PANEL_WIDTH_DEFAULT,
    RIGHT_PANEL_WIDTH_MIN,
    RIGHT_PANEL_WIDTH_MAX,
  );
  persisted.trackerPanelThoughtBubbleDisplay = normalizeTrackerThoughtBubbleDisplay(
    persisted.trackerPanelThoughtBubbleDisplay,
  );
  persisted.trackerPanelDockedThoughtsAlwaysVisible =
    persisted.trackerPanelDockedThoughtsAlwaysVisible === true;
  persisted.trackerPanelSizeProfile = normalizeTrackerPanelSizeProfile(
    persisted.trackerPanelSizeProfile,
    legacyWidth,
  );
  persisted.trackerTemperatureUnit = normalizeTrackerTemperatureUnit(persisted.trackerTemperatureUnit);
  persisted.trackerPanelCollapsedSections = normalizeTrackerPanelCollapsedSections(
    persisted.trackerPanelCollapsedSections,
  );
  persisted.trackerPanelSectionOrder = normalizeTrackerPanelSectionOrder(persisted.trackerPanelSectionOrder);
  persisted.summaryPopoverSettings = normalizeSummaryPopoverSettings(persisted.summaryPopoverSettings);
  persisted.quoteFormat = normalizeQuoteFormat(persisted.quoteFormat);
  persisted.editMessagesOnDoubleClick = persisted.editMessagesOnDoubleClick !== false;
  persisted.imagePromptIncludeAppearances = persisted.imagePromptIncludeAppearances !== false;
  persisted.imagePromptFormat = persisted.imagePromptFormat === "tags" ? "tags" : "descriptive";
  persisted.userStatusManual = persisted.userStatusManual === "dnd" ? "dnd" : "active";
  persisted.userStatus = persisted.userStatusManual === "dnd" ? "dnd" : "active";
  delete persisted.trackerPanelWidth;

  return persisted;
}
