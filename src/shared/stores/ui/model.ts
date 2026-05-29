// UI store types, constants, and pure helpers.
import { normalizeTemperatureUnit, type TemperatureUnit } from "../../lib/temperature-units";
import type { QuoteFormat } from "../../lib/dialogue-quotes";

export type { QuoteFormat };

export type Panel =
  | "chat"
  | "characters"
  | "lorebooks"
  | "presets"
  | "connections"
  | "agents"
  | "personas"
  | "settings"
  | "bot-browser";
export type FontSize = 12 | 14 | 16 | 17 | 19 | 22;
export type VisualTheme = "default" | "sillytavern";
export type HudPosition = "top" | "left" | "right";
export type TrackerPanelSide = "left" | "right";
export type TrackerThoughtBubbleDisplay = "inline" | "floating";
export type ImagePromptFormat = "descriptive" | "tags";
export type TrackerTemperatureUnit = TemperatureUnit;
export const TRACKER_PANEL_SIZE_PROFILES = ["compact", "standard", "expanded"] as const;
export type TrackerPanelSizeProfile = (typeof TRACKER_PANEL_SIZE_PROFILES)[number];
export type TrackerDataPanelSection = "world" | "persona" | "characters" | "quests" | "custom";
type TrackerPanelCollapsedSections = Partial<Record<TrackerDataPanelSection, boolean>>;
type TrackerPanelSectionOrder = TrackerDataPanelSection[];
export type EchoChamberSide = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type UserStatus = "active" | "idle" | "dnd";
export type RoleplayAvatarStyle = "none" | "circles" | "rectangles" | "panel";
export type GameDialogueDisplayMode = "classic" | "stacked";
export type SummaryPopoverSourceMode = "last" | "range";
interface FloatingWidgetPosition {
  x: number;
  y: number;
}
interface SummaryPopoverSettings {
  sourceMode: SummaryPopoverSourceMode;
  contextSize: number | null;
  rangeStart: number | null;
  rangeEnd: number | null;
  hideSummarizedMessages: boolean;
  collapseHiddenMessages: boolean;
}
export const APP_LANGUAGE_OPTIONS = [{ id: "en", label: "English" }] as const;
export type AppLanguage = (typeof APP_LANGUAGE_OPTIONS)[number]["id"];

interface GameSetupLearnedOptions {
  genres: string[];
  tones: string[];
  settings: string[];
  goals: string[];
  preferences: string[];
}

interface GameSetupRememberedText {
  playerGoals: string;
  preferences: string;
}

export const SIDEBAR_WIDTH_DEFAULT = 320;
export const RIGHT_PANEL_WIDTH_DEFAULT = 320;
export const SIDEBAR_WIDTH_MIN = 280;
export const SIDEBAR_WIDTH_MAX = 520;
export const RIGHT_PANEL_WIDTH_MIN = 280;
export const RIGHT_PANEL_WIDTH_MAX = 520;
const TRACKER_PANEL_SIZE_PROFILE_WIDTHS: Record<TrackerPanelSizeProfile, number> = {
  compact: 280,
  standard: 340,
  expanded: 420,
};
const TRACKER_PANEL_WIDTH_DEFAULT = TRACKER_PANEL_SIZE_PROFILE_WIDTHS.standard;
const TRACKER_PANEL_WIDTH_MIN = TRACKER_PANEL_SIZE_PROFILE_WIDTHS.compact;
const TRACKER_PANEL_WIDTH_MAX = TRACKER_PANEL_SIZE_PROFILE_WIDTHS.expanded;
export const IMAGE_DIMENSION_MIN = 64;
export const IMAGE_DIMENSION_MAX = 4096;
const GAME_SETUP_LEARNED_LIMIT = 60;
export const TRACKER_DATA_PANEL_SECTIONS: TrackerDataPanelSection[] = [
  "world",
  "persona",
  "characters",
  "quests",
  "custom",
];
export const ROLEPLAY_AVATAR_SCALE_MIN = 0.75;
export const ROLEPLAY_AVATAR_SCALE_MAX = 2.5;
export const ROLEPLAY_SPRITE_SCALE_MIN = 0.5;
export const ROLEPLAY_SPRITE_SCALE_MAX = 1.75;

export const DEFAULT_GAME_SETUP_LEARNED_OPTIONS: GameSetupLearnedOptions = {
  genres: [],
  tones: [],
  settings: [],
  goals: [],
  preferences: [],
};

export const DEFAULT_GAME_SETUP_REMEMBERED_TEXT: GameSetupRememberedText = {
  playerGoals: "",
  preferences: "",
};
export const DEFAULT_SUMMARY_POPOVER_SETTINGS: SummaryPopoverSettings = {
  sourceMode: "last",
  contextSize: null,
  rangeStart: null,
  rangeEnd: null,
  hideSummarizedMessages: false,
  collapseHiddenMessages: false,
};

export function clampImageDimension(value: number) {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(IMAGE_DIMENSION_MIN, Math.min(IMAGE_DIMENSION_MAX, rounded));
}

function clampTrackerPanelWidth(value: unknown) {
  const width = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : TRACKER_PANEL_WIDTH_DEFAULT;
  return Math.max(TRACKER_PANEL_WIDTH_MIN, Math.min(TRACKER_PANEL_WIDTH_MAX, width));
}

export function getTrackerPanelWidthForProfile(profile: TrackerPanelSizeProfile) {
  return TRACKER_PANEL_SIZE_PROFILE_WIDTHS[profile] ?? TRACKER_PANEL_SIZE_PROFILE_WIDTHS.standard;
}

export function normalizeTrackerPanelSizeProfile(value: unknown, legacyWidth?: unknown): TrackerPanelSizeProfile {
  if (TRACKER_PANEL_SIZE_PROFILES.includes(value as TrackerPanelSizeProfile)) {
    return value as TrackerPanelSizeProfile;
  }

  const width = typeof legacyWidth === "number" && Number.isFinite(legacyWidth) ? clampTrackerPanelWidth(legacyWidth) : null;
  if (width !== null) {
    if (width <= 300) return "compact";
    if (width >= 380) return "expanded";
  }

  return "standard";
}

export function normalizeTrackerThoughtBubbleDisplay(value: unknown): TrackerThoughtBubbleDisplay {
  return value === "inline" || value === "floating" ? value : "inline";
}

export function normalizeTrackerTemperatureUnit(value: unknown): TrackerTemperatureUnit {
  return normalizeTemperatureUnit(value);
}

export function normalizeTrackerPanelCollapsedSections(value: unknown): TrackerPanelCollapsedSections {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const collapsed: TrackerPanelCollapsedSections = {};
  for (const section of TRACKER_DATA_PANEL_SECTIONS) {
    if (raw[section] === true) collapsed[section] = true;
  }
  return collapsed;
}

export function normalizeTrackerPanelSectionOrder(value: unknown): TrackerPanelSectionOrder {
  const order: TrackerPanelSectionOrder = [];
  const seen = new Set<TrackerDataPanelSection>();
  const raw = Array.isArray(value) ? value : [];

  for (const section of raw) {
    if (!TRACKER_DATA_PANEL_SECTIONS.includes(section as TrackerDataPanelSection)) continue;
    const validSection = section as TrackerDataPanelSection;
    if (seen.has(validSection)) continue;
    seen.add(validSection);
    order.push(validSection);
  }

  for (const section of TRACKER_DATA_PANEL_SECTIONS) {
    if (!seen.has(section)) order.push(section);
  }

  return order;
}

export function normalizeSummaryPopoverSettings(value: unknown): SummaryPopoverSettings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const numberOrNull = (next: unknown) =>
    typeof next === "number" && Number.isFinite(next) ? Math.round(next) : null;
  return {
    sourceMode: raw.sourceMode === "range" ? "range" : "last",
    contextSize: numberOrNull(raw.contextSize),
    rangeStart: numberOrNull(raw.rangeStart),
    rangeEnd: numberOrNull(raw.rangeEnd),
    hideSummarizedMessages: raw.hideSummarizedMessages === true || raw.hideSummarisedMessages === true,
    collapseHiddenMessages: raw.collapseHiddenMessages === true,
  };
}

export function normalizeLearnedGameSetupOption(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function normalizeRememberedGameSetupText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2000);
}

export function mergeLearnedGameSetupOptions(existing: string[] | undefined, incoming: unknown[]) {
  const byKey = new Map<string, string>();

  for (const value of existing ?? []) {
    const normalized = normalizeLearnedGameSetupOption(value);
    if (normalized) byKey.set(normalized.toLowerCase(), normalized);
  }

  for (const value of [...incoming].reverse()) {
    const normalized = normalizeLearnedGameSetupOption(value);
    if (!normalized) continue;
    byKey.delete(normalized.toLowerCase());
    byKey.set(normalized.toLowerCase(), normalized);
  }

  return [...byKey.values()].reverse().slice(0, GAME_SETUP_LEARNED_LIMIT);
}

export type FullPageRoutePatch = Partial<
  Pick<
    UIState,
    | "characterDetailId"
    | "lorebookDetailId"
    | "presetDetailId"
    | "connectionDetailId"
    | "agentDetailId"
    | "toolDetailId"
    | "personaDetailId"
    | "regexDetailId"
    | "characterLibraryOpen"
    | "botBrowserOpen"
    | "gameAssetsBrowserOpen"
    | "rightPanelOpen"
    | "editorDirty"
  >
>;

export const CLEARED_DETAIL_IDS = {
  characterDetailId: null,
  lorebookDetailId: null,
  presetDetailId: null,
  connectionDetailId: null,
  agentDetailId: null,
  toolDetailId: null,
  personaDetailId: null,
  regexDetailId: null,
} satisfies FullPageRoutePatch;

export function mobilePanelClosePatch(): FullPageRoutePatch {
  return typeof window !== "undefined" && window.innerWidth < 768 ? { rightPanelOpen: false } : {};
}

export function openDetailRouteState(patch: FullPageRoutePatch): FullPageRoutePatch {
  return {
    ...CLEARED_DETAIL_IDS,
    ...patch,
    ...mobilePanelClosePatch(),
  };
}

export interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  rightPanel: Panel;
  trackerPanelEnabled: boolean;
  trackerPanelOpen: boolean;
  trackerPanelSide: TrackerPanelSide;
  trackerPanelHideHudWidgets: boolean;
  trackerPanelUseExpressionSprites: boolean;
  trackerPanelThoughtBubbleDisplay: TrackerThoughtBubbleDisplay;
  trackerPanelDockedThoughtsAlwaysVisible: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  trackerPanelCollapsedSections: TrackerPanelCollapsedSections;
  trackerPanelSectionOrder: TrackerPanelSectionOrder;
  settingsTab: string;
  modal: { type: string; props?: Record<string, unknown> } | null;
  theme: "dark" | "light";
  chatBackground: string | null;
  /** Blur applied to the current chat background image in px. */
  chatBackgroundBlur: number;
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
  /** When true, the main area shows the browser */
  botBrowserOpen: boolean;
  /** When true, the main area shows the game assets browser */
  gameAssetsBrowserOpen: boolean;
  /** When true, the main area shows the full-page character library */
  characterLibraryOpen: boolean;
  /** True when any open detail editor has unsaved changes */
  editorDirty: boolean;

  // ── Settings (persisted) ──
  fontSize: FontSize;
  language: AppLanguage;
  /** Font size for chat messages (px) */
  chatFontSize: number;
  /** Custom font family name (empty = default Inter) */
  fontFamily: string;
  enableStreaming: boolean;
  debugMode: boolean;
  /** Typewriter speed: 1 (very slow) to 100 (instant). Controls how fast streaming tokens appear. */
  streamingSpeed: number;
  /** When true, Game mode narration segments are revealed in full as soon as they become active. */
  gameInstantTextReveal: boolean;
  /**
   * When true, the mouse wheel skips through past assistant turns in Game mode (up = back,
   * down = forward) and clicking the scene background acts like the Next button. While
   * scrolled into the past, the Next button changes to "Return" so the player can jump back
   * to where they were reading.
   */
  gameMiddleMouseNav: boolean;
  /** Game mode dialogue layout: classic VN box or a VN box with a scrollable segment history above it. */
  gameDialogueDisplayMode: GameDialogueDisplayMode;
  /** Game narration text speed: 1 (very slow) to 100 (instant). Controls the typewriter in game mode. */
  gameTextSpeed: number;
  /** Delay in ms between auto-advancing narration segments when auto-play is enabled. */
  gameAutoPlayDelay: number;
  /** When true, generated game image prompts are shown for review before provider calls are sent. */
  reviewImagePromptsBeforeSend: boolean;
  /** When true, character/persona appearance text is allowed into generated image prompts. */
  imagePromptIncludeAppearances: boolean;
  /** Preferred prompt wording for image prompt generation. */
  imagePromptFormat: ImagePromptFormat;
  imageBackgroundWidth: number;
  imageBackgroundHeight: number;
  imagePortraitWidth: number;
  imagePortraitHeight: number;
  imageSelfieWidth: number;
  imageSelfieHeight: number;

  messageGrouping: boolean;
  showTimestamps: boolean;
  showModelName: boolean;
  showTokenUsage: boolean;
  showMessageNumbers: boolean;
  guideGenerations: boolean;
  showQuickRepliesMenu: boolean;
  showQuickReplyPostOnly: boolean;
  showQuickReplyGuide: boolean;
  showQuickReplyImpersonate: boolean;
  confirmBeforeDelete: boolean;
  /** Number of messages to load per page */
  messagesPerPage: number;
  /** Bold quoted dialogue in chat messages; color highlighting can still remain when this is off */
  boldDialogue: boolean;
  /** Preferred quote style applied to user input and displayed model output. */
  quoteFormat: QuoteFormat;
  /** When true, model responses are trimmed back to the last complete sentence before saving. */
  trimIncompleteModelOutput: boolean;
  /** When true, chat inputs show a microphone button for browser speech-to-text dictation. */
  speechToTextEnabled: boolean;
  /** When true, show the global Spotify mini player in the app chrome. */
  spotifyPlayerEnabled: boolean;
  /** When true, allow the rare Chibi Professor Mari scroll toast to register. */
  chibiProfessorMariEnabled: boolean;
  /** Optional remote Rust runtime URL. Blank uses the embedded Tauri backend. */
  remoteRuntimeUrl: string;
  /** Mobile Spotify widget collapsed state. */
  spotifyMobileWidgetCollapsed: boolean;
  /** Mobile Spotify widget position in viewport pixels. */
  spotifyMobileWidgetPosition: FloatingWidgetPosition;
  /** When true, Roleplay and Conversation modes support arrow-key and touch-swipe navigation between message swipes. */
  intuitiveSwipeNavigation: boolean;
  /** When true, moving past the newest swipe on the latest assistant message creates a new reroll. */
  intuitiveSwipeRerollLatest: boolean;
  /** When true, pressing Up Arrow with an empty chat input opens the last user message for editing (Conversation/Roleplay). */
  editLastMessageOnArrowUp: boolean;
  /** When true, double-clicking or double-tapping a message opens it for editing. */
  editMessagesOnDoubleClick: boolean;
  /** Persisted controls shown in the Chat Summary popover settings window. */
  summaryPopoverSettings: SummaryPopoverSettings;

  // ── Text Appearance ──
  /** Color for narrator text in RP mode (empty = default amber) */
  narrationFontColor: string;
  /** Opacity for narrator text (0–100) */
  narrationOpacity: number;
  /** Color for chat message text (empty = theme default) */
  chatFontColor: string;
  /** Opacity for roleplay message backgrounds (0–100) */
  chatFontOpacity: number;
  /** Layout style for roleplay message avatars */
  roleplayAvatarStyle: RoleplayAvatarStyle;
  /** Scale multiplier for Roleplay message avatars. */
  roleplayAvatarScale: number;
  /** Default scale multiplier for Roleplay full-body sprites. */
  roleplaySpriteScale: number;
  /** Scale multiplier for Game mode VN dialogue portraits. */
  gameAvatarScale: number;
  /** Scale multiplier for Game mode center full-body sprites. */
  gameFullBodySpriteScale: number;
  /** Text outline/stroke width in px (0 = off) */
  textStrokeWidth: number;
  /** Text outline/stroke color */
  textStrokeColor: string;

  // ── Visual Theme ──
  visualTheme: VisualTheme;

  // ── Conversation Gradient (per color-scheme) ──
  convoGradient: {
    dark: { from: string; to: string };
    light: { from: string; to: string };
  };

  // ── Sound ──
  convoNotificationSound: boolean;
  rpNotificationSound: boolean;
  /** When true, show native local notifications for new Conversation messages while Marinara is unfocused. */
  conversationBrowserNotifications: boolean;

  // ── Custom Conversation Prompt ──
  /** User's custom default system prompt for new conversations (null = built-in default). */
  customConversationPrompt: string | null;

  // ── Schedule Generation Preferences ──
  /** Free-form user guidance injected into the conversation-mode schedule generation prompt (empty = unset). */
  scheduleGenerationPreferences: string;
  /** Custom Game setup chips learned from previous games. */
  learnedGameSetupOptions: GameSetupLearnedOptions;
  /** Last submitted free-text Game setup fields. */
  rememberedGameSetupText: GameSetupRememberedText;

  // ── Input ──
  enterToSendRP: boolean;
  enterToSendConvo: boolean;
  enterToSendGame: boolean;

  // ── Roleplay Effects ──
  weatherEffects: boolean;

  // ── HUD Layout ──
  hudPosition: HudPosition;

  // ── Onboarding ──
  hasCompletedOnboarding: boolean;
  /** True once the user has permanently disabled the in-game tutorial (? icon still re-opens). */
  gameTutorialDisabled: boolean;

  // ── Dismissals ──
  linkApiBannerDismissed: boolean;

  // ── EchoChamber ──
  echoChamberOpen: boolean;
  echoChamberSide: EchoChamberSide;

  // ── User Status ──
  /** The user's sticky manual status. "dnd" locks presence; "active" allows automatic idle. Persisted. */
  userStatusManual: UserStatus;
  /** Effective status: "active" or "idle" from app presence, unless manual DND is enabled. */
  userStatus: UserStatus;
  /** Optional short activity shown with the user's status in Conversation mode. */
  userActivity: string;

  // ── Impersonate Settings ──
  /** Custom prompt template for /impersonate (empty = use the built-in default). Persisted. */
  impersonatePromptTemplate: string;
  /** Show a quick /impersonate button in the chat input toolbar. Persisted. */
  impersonateShowQuickButton: boolean;
  /** When true, CYOA choices generate impersonate requests instead of normal user messages. Persisted. */
  impersonateCyoaChoices: boolean;
  /** Override preset used when impersonating (null = use chat default). Persisted. */
  impersonatePresetId: string | null;
  /** Override connection used when impersonating (null = use chat default). Persisted. */
  impersonateConnectionId: string | null;
  /** When true, suppress agent pipeline during impersonate. Persisted. */
  impersonateBlockAgents: boolean;

  /** Transient: true when center content area is too narrow (overflow detected) */
  centerCompact: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleTrackerPanel: () => void;
  setTrackerPanelEnabled: (enabled: boolean) => void;
  setTrackerPanelOpen: (open: boolean) => void;
  setTrackerPanelSide: (side: TrackerPanelSide) => void;
  setTrackerPanelHideHudWidgets: (hidden: boolean) => void;
  setTrackerPanelUseExpressionSprites: (enabled: boolean) => void;
  setTrackerPanelThoughtBubbleDisplay: (display: TrackerThoughtBubbleDisplay) => void;
  setTrackerPanelDockedThoughtsAlwaysVisible: (visible: boolean) => void;
  setTrackerPanelSizeProfile: (profile: TrackerPanelSizeProfile) => void;
  setTrackerTemperatureUnit: (unit: TrackerTemperatureUnit) => void;
  setTrackerPanelSectionOrder: (order: TrackerPanelSectionOrder) => void;
  setTrackerPanelSectionCollapsed: (section: TrackerDataPanelSection, collapsed: boolean) => void;
  toggleTrackerPanelSectionCollapsed: (section: TrackerDataPanelSection) => void;
  openRightPanel: (panel: Panel) => void;
  closeRightPanel: () => void;
  toggleRightPanel: (panel: Panel) => void;
  setSettingsTab: (tab: string) => void;
  openModal: (type: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setChatBackground: (url: string | null) => void;
  setChatBackgroundBlur: (v: number) => void;
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
  openCharacterLibrary: () => void;
  closeCharacterLibrary: () => void;
  openBotBrowser: () => void;
  closeBotBrowser: () => void;
  openGameAssetsBrowser: () => void;
  closeGameAssetsBrowser: () => void;

  /** Returns true if any full-page detail editor is currently open */
  hasAnyDetailOpen: () => boolean;
  /** Close all detail editors at once */
  closeAllDetails: () => void;
  /** Update the editor dirty flag (called by detail editors when their dirty state changes) */
  setEditorDirty: (dirty: boolean) => void;

  // Settings actions
  setFontSize: (size: FontSize) => void;
  setLanguage: (language: AppLanguage) => void;
  setChatFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setEnableStreaming: (v: boolean) => void;
  setDebugMode: (v: boolean) => void;
  setStreamingSpeed: (v: number) => void;
  setGameInstantTextReveal: (v: boolean) => void;
  setGameMiddleMouseNav: (v: boolean) => void;
  setGameDialogueDisplayMode: (v: GameDialogueDisplayMode) => void;
  setGameTextSpeed: (v: number) => void;
  setGameAutoPlayDelay: (v: number) => void;
  setReviewImagePromptsBeforeSend: (v: boolean) => void;
  setImagePromptIncludeAppearances: (v: boolean) => void;
  setImagePromptFormat: (format: ImagePromptFormat) => void;
  setImageBackgroundDimensions: (width: number, height: number) => void;
  setImagePortraitDimensions: (width: number, height: number) => void;
  setImageSelfieDimensions: (width: number, height: number) => void;

  setMessageGrouping: (v: boolean) => void;
  setShowTimestamps: (v: boolean) => void;
  setShowModelName: (v: boolean) => void;
  setShowTokenUsage: (v: boolean) => void;
  setShowMessageNumbers: (v: boolean) => void;
  setGuideGenerations: (v: boolean) => void;
  setShowQuickRepliesMenu: (v: boolean) => void;
  setShowQuickReplyPostOnly: (v: boolean) => void;
  setShowQuickReplyGuide: (v: boolean) => void;
  setShowQuickReplyImpersonate: (v: boolean) => void;
  setConfirmBeforeDelete: (v: boolean) => void;
  setMessagesPerPage: (n: number) => void;
  setBoldDialogue: (v: boolean) => void;
  setQuoteFormat: (v: QuoteFormat) => void;
  setTrimIncompleteModelOutput: (v: boolean) => void;
  setSpeechToTextEnabled: (v: boolean) => void;
  setSpotifyPlayerEnabled: (v: boolean) => void;
  setChibiProfessorMariEnabled: (v: boolean) => void;
  setRemoteRuntimeUrl: (v: string) => void;
  setSpotifyMobileWidgetCollapsed: (v: boolean) => void;
  setSpotifyMobileWidgetPosition: (position: FloatingWidgetPosition) => void;
  setIntuitiveSwipeNavigation: (v: boolean) => void;
  setIntuitiveSwipeRerollLatest: (v: boolean) => void;
  setEditLastMessageOnArrowUp: (v: boolean) => void;
  setEditMessagesOnDoubleClick: (v: boolean) => void;
  setSummaryPopoverSettings: (settings: Partial<SummaryPopoverSettings>) => void;
  setNarrationFontColor: (v: string) => void;
  setNarrationOpacity: (v: number) => void;
  setChatFontColor: (v: string) => void;
  setChatFontOpacity: (v: number) => void;
  setRoleplayAvatarStyle: (v: RoleplayAvatarStyle) => void;
  setRoleplayAvatarScale: (v: number) => void;
  setRoleplaySpriteScale: (v: number) => void;
  setGameAvatarScale: (v: number) => void;
  setGameFullBodySpriteScale: (v: number) => void;
  setTextStrokeWidth: (v: number) => void;
  setTextStrokeColor: (v: string) => void;
  setCenterCompact: (v: boolean) => void;
  setVisualTheme: (v: VisualTheme) => void;
  setConvoGradientField: (scheme: "dark" | "light", field: "from" | "to", value: string) => void;
  setConvoNotificationSound: (v: boolean) => void;
  setRpNotificationSound: (v: boolean) => void;
  setConversationBrowserNotifications: (v: boolean) => void;
  setCustomConversationPrompt: (v: string | null) => void;
  setScheduleGenerationPreferences: (v: string) => void;
  rememberGameSetupOptions: (
    options: Partial<GameSetupLearnedOptions>,
    text?: Partial<GameSetupRememberedText>,
  ) => void;
  forgetGameSetupOption: (group: keyof GameSetupLearnedOptions, value: string) => void;
  setEnterToSendRP: (v: boolean) => void;
  setEnterToSendConvo: (v: boolean) => void;
  setEnterToSendGame: (v: boolean) => void;
  setWeatherEffects: (v: boolean) => void;
  setHudPosition: (v: HudPosition) => void;

  // Impersonate settings actions
  setImpersonatePromptTemplate: (v: string) => void;
  setImpersonateShowQuickButton: (v: boolean) => void;
  setImpersonateCyoaChoices: (v: boolean) => void;
  setImpersonatePresetId: (id: string | null) => void;
  setImpersonateConnectionId: (id: string | null) => void;
  setImpersonateBlockAgents: (v: boolean) => void;

  setHasCompletedOnboarding: (v: boolean) => void;
  setGameTutorialDisabled: (v: boolean) => void;
  dismissLinkApiBanner: () => void;
  toggleEchoChamber: () => void;
  setEchoChamberSide: (side: EchoChamberSide) => void;
  setUserStatus: (status: UserStatus) => void;
  /** Sets sticky DND, or clears DND and applies an immediate active/idle effective status. */
  setUserStatusManual: (status: UserStatus) => void;
  setUserActivity: (activity: string) => void;
}
