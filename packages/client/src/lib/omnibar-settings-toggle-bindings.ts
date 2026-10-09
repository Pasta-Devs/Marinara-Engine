/**
 * `settings-registry.ts` control ids the omnibar can flip in place, mapped to the
 * client-store field that backs them. Kept beside `omnibar-settings.ts` rather
 * than inside it, since that file is documented to stay free of store imports.
 *
 * Only client-store booleans are bound. Excluded on purpose: anything
 * server-backed (`automatic-backups`, `roleplay-vn-display`, which patches the
 * active chat on the server), anything gated behind an OS permission prompt
 * (`browser-background-notifications`, `mobile-background-notifications`),
 * anything backed by the Android bridge rather than the store
 * (`android-status-bar`), a non-boolean control mislabeled `Toggle` in the
 * registry (`default-dialogue-color`, actually a color picker), and a
 * two-value enum rather than a real boolean (`tracker-temperature-unit`).
 * `music-player`, `speech-to-text`, `notification-unfocused-only`,
 * `show-message-timestamps`, `show-model-name` and `show-token-usage` are
 * also skipped here: they already flip via the hand-built rows in
 * `omnibar-results.ts` (`toggleRows`), and binding them again would show the
 * same setting as two rows. `omnibar-suggestions` and `ask-mari` are bound
 * here instead, and `toggleRows` must not hand-build rows for them.
 *
 * Also excluded on purpose, per the K5 rule against anything that deletes,
 * spends money, or changes security: `confirm-before-delete`, `debug-mode`,
 * `include-private-notes-in-exports`, `include-reasoning-in-exports`, and
 * `image-prompt-review`. These navigate to Settings instead of flipping in
 * place.
 *
 * `omnibar-settings-toggle-bindings.regression.ts`-style coverage lives in
 * `scripts/regressions/command-center.regression.ts`: every id here must name
 * an actual `Toggle` control in `SETTINGS_SEARCHABLE_CONTROLS`.
 */
import { useUIStore } from "../stores/ui.store";
import { QUICK_REPLIES_SETTINGS_CONTROL_ID } from "./settings-registry";

type UIState = ReturnType<typeof useUIStore.getState>;

export type OmnibarSettingsToggleBinding = {
  get: (state: UIState) => boolean;
  set: (value: boolean) => void;
};

export const OMNIBAR_SETTINGS_TOGGLE_BINDINGS: Readonly<Record<string, OmnibarSettingsToggleBinding>> = {
  "omnibar-suggestions": {
    get: (state) => state.omnibarSuggestionsEnabled,
    set: (value) => useUIStore.getState().setOmnibarSuggestionsEnabled(value),
  },
  "ask-mari": {
    get: (state) => state.commandCenterMariEnabled,
    set: (value) => useUIStore.getState().setCommandCenterMariEnabled(value),
  },
  "hide-chat-help-button": {
    get: (state) => state.chatHelpButtonHidden,
    set: (value) => useUIStore.getState().setChatHelpButtonHidden(value),
  },
  achievements: {
    get: (state) => state.achievementsEnabled,
    set: (value) => useUIStore.getState().setAchievementsEnabled(value),
  },
  "mini-mari": {
    get: (state) => state.chibiProfessorMariEnabled,
    set: (value) => useUIStore.getState().setChibiProfessorMariEnabled(value),
  },
  "notification-conversation-sound": {
    get: (state) => state.convoNotificationSound,
    set: (value) => useUIStore.getState().setConvoNotificationSound(value),
  },
  "notification-roleplay-sound": {
    get: (state) => state.rpNotificationSound,
    set: (value) => useUIStore.getState().setRpNotificationSound(value),
  },
  "notification-game-sound": {
    get: (state) => state.gameNotificationSound,
    set: (value) => useUIStore.getState().setGameNotificationSound(value),
  },
  "enable-streaming": {
    get: (state) => state.enableStreaming,
    set: (value) => useUIStore.getState().setEnableStreaming(value),
  },
  "trim-incomplete-output": {
    get: (state) => state.trimIncompleteModelOutput,
    set: (value) => useUIStore.getState().setTrimIncompleteModelOutput(value),
  },
  "intuitive-swipe-navigation": {
    get: (state) => state.intuitiveSwipeNavigation,
    set: (value) => useUIStore.getState().setIntuitiveSwipeNavigation(value),
  },
  "reroll-past-newest-swipe": {
    get: (state) => state.intuitiveSwipeRerollLatest,
    set: (value) => useUIStore.getState().setIntuitiveSwipeRerollLatest(value),
  },
  "up-arrow-edits-last-message": {
    get: (state) => state.editLastMessageOnArrowUp,
    set: (value) => useUIStore.getState().setEditLastMessageOnArrowUp(value),
  },
  "double-click-edits-messages": {
    get: (state) => state.editMessageOnDoubleClick,
    set: (value) => useUIStore.getState().setEditMessageOnDoubleClick(value),
  },
  "bold-dialogue": {
    get: (state) => state.boldDialogue ?? true,
    set: (value) => useUIStore.getState().setBoldDialogue(value),
  },
  "convert-latex-symbols": {
    get: (state) => state.convertLatexSymbols,
    set: (value) => useUIStore.getState().setConvertLatexSymbols(value),
  },
  "color-inline-names": {
    get: (state) => state.colorInlineNames ?? false,
    set: (value) => useUIStore.getState().setColorInlineNames(value),
  },
  "disable-inline-name-gradients": {
    get: (state) => state.disableInlineNameGradients ?? false,
    set: (value) => useUIStore.getState().setDisableInlineNameGradients(value),
  },
  "game-instant-text-reveal": {
    get: (state) => state.gameInstantTextReveal,
    set: (value) => useUIStore.getState().setGameInstantTextReveal(value),
  },
  "game-middle-mouse-navigation": {
    get: (state) => state.gameMiddleMouseNav,
    set: (value) => useUIStore.getState().setGameMiddleMouseNav(value),
  },
  "queue-media-generation": {
    get: (state) => state.queueImageGenerationRequests,
    set: (value) => useUIStore.getState().setQueueImageGenerationRequests(value),
  },
  "custom-cursor": {
    get: (state) => state.customCursorEnabled,
    set: (value) => useUIStore.getState().setCustomCursorEnabled(value),
  },
  // Pulse and RGB are mutually exclusive, same as the Appearance settings row.
  "accent-pulse": {
    get: (state) => state.appAccentPulseMode,
    set: (value) => {
      const store = useUIStore.getState();
      if (value && store.appAccentRgbMode) store.setAppAccentRgbMode(false);
      store.setAppAccentPulseMode(value);
    },
  },
  "rgb-mode": {
    get: (state) => state.appAccentRgbMode,
    set: (value) => {
      const store = useUIStore.getState();
      if (value && store.appAccentPulseMode) store.setAppAccentPulseMode(false);
      store.setAppAccentRgbMode(value);
    },
  },
  "conversation-always-display-swipe-menu": {
    get: (state) => state.alwaysDisplayConversationSwipeMenu,
    set: (value) => useUIStore.getState().setAlwaysDisplayConversationSwipeMenu(value),
  },
  "roleplay-always-display-swipe-menu": {
    get: (state) => state.alwaysDisplayRoleplaySwipeMenu,
    set: (value) => useUIStore.getState().setAlwaysDisplayRoleplaySwipeMenu(value),
  },
  "show-characters-in-persona-pickers": {
    get: (state) => state.showCharactersInPersonaPickers,
    set: (value) => useUIStore.getState().setShowCharactersInPersonaPickers(value),
  },
  "tracker-panel": {
    get: (state) => state.trackerPanelEnabled,
    set: (value) => useUIStore.getState().setTrackerPanelEnabled(value),
  },
  "tracker-replace-hud-icons": {
    get: (state) => state.trackerPanelHideHudWidgets,
    set: (value) => useUIStore.getState().setTrackerPanelHideHudWidgets(value),
  },
  "tracker-expression-sprites": {
    get: (state) => state.trackerPanelUseExpressionSprites,
    set: (value) => useUIStore.getState().setTrackerPanelUseExpressionSprites(value),
  },
  "tracker-docked-thoughts": {
    get: (state) => state.trackerPanelDockedThoughtsAlwaysVisible,
    set: (value) => useUIStore.getState().setTrackerPanelDockedThoughtsAlwaysVisible(value),
  },
  "roleplay-vn-autoplay": {
    get: (state) => state.roleplayVnAutoPlay,
    set: (value) => useUIStore.getState().setRoleplayVnAutoPlay(value),
  },
  "roleplay-reduced-paint-effects": {
    get: (state) => state.roleplayReducedPaintEffects,
    set: (value) => useUIStore.getState().setRoleplayReducedPaintEffects(value),
  },
  "show-roleplay-thinking-in-messages": {
    get: (state) => state.showRoleplayThinkingInMessages,
    set: (value) => useUIStore.getState().setShowRoleplayThinkingInMessages(value),
  },
  "keep-roleplay-thinking-expanded": {
    get: (state) => state.keepRoleplayThinkingExpanded,
    set: (value) => useUIStore.getState().setKeepRoleplayThinkingExpanded(value),
  },
  "scrollable-avatars": {
    get: (state) => state.roleplayAvatarsScrollable,
    set: (value) => useUIStore.getState().setRoleplayAvatarsScrollable(value),
  },
  "narrator-cycling-avatars": {
    get: (state) => state.roleplayNarratorAvatarCycling,
    set: (value) => useUIStore.getState().setRoleplayNarratorAvatarCycling(value),
  },
  "game-text-effects": {
    get: (state) => state.gameTextEffectsEnabled,
    set: (value) => useUIStore.getState().setGameTextEffectsEnabled(value),
  },
  "weather-effects": {
    get: (state) => state.weatherEffects,
    set: (value) => useUIStore.getState().setWeatherEffects(value),
  },
  [QUICK_REPLIES_SETTINGS_CONTROL_ID]: {
    get: (state) => state.showQuickRepliesMenu,
    set: (value) => useUIStore.getState().setShowQuickRepliesMenu(value),
  },
  "show-message-numbers": {
    get: (state) => state.showMessageNumbers,
    set: (value) => useUIStore.getState().setShowMessageNumbers(value),
  },
  "guide-generations": {
    get: (state) => state.guideGenerations,
    set: (value) => useUIStore.getState().setGuideGenerations(value),
  },
};
