// ──────────────────────────────────────────────
// Zustand Store: UI Slice
// ──────────────────────────────────────────────
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  IMAGE_STYLE_PROFILES_STORAGE_KEY,
  normalizeImageStyleProfileSettings,
  normalizeQuoteFormat,
  type ImageStyleProfileSettings,
  type LorebookCategory,
  type QuoteFormat,
} from "@marinara-engine/shared";
import { isCssGradient, RAINBOW_GRADIENT_PRESET } from "../lib/css-colors";
import { announceChatFloatingUiDismiss } from "../lib/chat-floating-ui-events";
import { BASIC_PANEL_SORT_OPTIONS, normalizeBasicPanelSort, type BasicPanelSort } from "../lib/panel-sort";

type Panel =
  | "chat"
  | "characters"
  | "lorebooks"
  | "presets"
  | "connections"
  | "agents"
  | "personas"
  | "settings"
  | "bot-browser";
export type ChatModeShortcut = "conversation" | "roleplay" | "game";
export const CHARACTER_LIBRARY_SORT_OPTIONS = ["name-asc", "name-desc", "newest", "oldest", "favorites"] as const;
export type CharacterLibrarySort = (typeof CHARACTER_LIBRARY_SORT_OPTIONS)[number];
export const CHARACTER_PANEL_FAVORITE_FILTER_OPTIONS = ["all", "favorites", "non-favorites"] as const;
export type CharacterPanelFavoriteFilter = (typeof CHARACTER_PANEL_FAVORITE_FILTER_OPTIONS)[number];
export const LOREBOOK_PANEL_CATEGORY_OPTIONS = [
  "all",
  "active",
  "world",
  "character",
  "npc",
  "spellbook",
  "uncategorized",
] as const satisfies readonly (LorebookCategory | "all" | "active")[];
export type LorebookPanelCategory = (typeof LOREBOOK_PANEL_CATEGORY_OPTIONS)[number];
export const LOREBOOK_PANEL_SORT_OPTIONS = ["name-asc", "name-desc", "newest", "oldest", "tokens"] as const;
export type LorebookPanelSort = (typeof LOREBOOK_PANEL_SORT_OPTIONS)[number];
export const RESOURCE_PANEL_SORT_OPTIONS = BASIC_PANEL_SORT_OPTIONS;
export type ResourcePanelSort = BasicPanelSort;
type FontSize = 12 | 14 | 16 | 17 | 19 | 22;
export type VisualTheme = "default" | "sillytavern";
export type ConversationMessageStyle = "classic" | "bubble";
export type HudPosition = "top" | "left" | "right";
export type TrackerPanelSide = "left" | "right";
export type TrackerThoughtBubbleDisplay = "inline" | "floating";
export type MusicPlayerSource = "spotify" | "youtube" | "custom";
export const TRACKER_TEMPERATURE_UNITS = ["celsius", "fahrenheit"] as const;
export type TrackerTemperatureUnit = (typeof TRACKER_TEMPERATURE_UNITS)[number];
export const TRACKER_PANEL_SIZE_PROFILES = ["compact", "standard", "expanded"] as const;
export type TrackerPanelSizeProfile = (typeof TRACKER_PANEL_SIZE_PROFILES)[number];
export type TrackerDataPanelSection = "world" | "persona" | "characters" | "quests" | "custom";
export type TrackerPanelCollapsedSections = Partial<Record<TrackerDataPanelSection, boolean>>;
export type TrackerPanelSectionOrder = TrackerDataPanelSection[];
export type EchoChamberSide = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type UserStatus = "active" | "idle" | "dnd" | "invisible";
export type RoleplayAvatarStyle = "none" | "circles" | "rectangles" | "panel";
export type GameDialogueDisplayMode = "classic" | "stacked";
export type SummaryPopoverSourceMode = "last" | "range";
export const DEFAULT_ROLEPLAY_BACKGROUND_URL = "/api/backgrounds/file/Black.jpg";
export interface FloatingWidgetPosition {
  x: number;
  y: number;
}
export interface SummaryPopoverSettings {
  sourceMode: SummaryPopoverSourceMode;
  contextSize: number | null;
  rangeStart: number | null;
  rangeEnd: number | null;
  hideSummarisedMessages: boolean;
  collapseHiddenMessages: boolean;
}
export const APP_LANGUAGE_OPTIONS = [{ id: "en", label: "English" }] as const;
export type AppLanguage = (typeof APP_LANGUAGE_OPTIONS)[number]["id"];

export interface GameSetupLearnedOptions {
  genres: string[];
  tones: string[];
  settings: string[];
  goals: string[];
  preferences: string[];
}

export interface GameSetupRememberedText {
  playerGoals: string;
  preferences: string;
}

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 480;
export const RIGHT_PANEL_WIDTH_MIN = 280;
export const RIGHT_PANEL_WIDTH_MAX = 520;
export const TRACKER_PANEL_SIZE_PROFILE_WIDTHS: Record<TrackerPanelSizeProfile, number> = {
  compact: 280,
  standard: 340,
  expanded: 420,
};
export const TRACKER_PANEL_WIDTH_DEFAULT = TRACKER_PANEL_SIZE_PROFILE_WIDTHS.standard;
export const TRACKER_PANEL_WIDTH_MIN = TRACKER_PANEL_SIZE_PROFILE_WIDTHS.compact;
export const TRACKER_PANEL_WIDTH_MAX = TRACKER_PANEL_SIZE_PROFILE_WIDTHS.expanded;
export const TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR = "#09090b";
export const DEFAULT_APP_BACKGROUND_DARK = "#050312";
export const DEFAULT_APP_BACKGROUND_LIGHT = "#faf8ff";
const DEFAULT_APP_BACKGROUNDS = new Set([DEFAULT_APP_BACKGROUND_DARK, DEFAULT_APP_BACKGROUND_LIGHT]);
export const DEFAULT_APP_ACCENT_DARK = "#d4acfb";
export const DEFAULT_APP_ACCENT_LIGHT = "#d4acfb";
const LEGACY_DEFAULT_APP_ACCENTS = new Set(["#d4d4d4", "#1a1025"]);
export const DEFAULT_CHAT_TEXT_DARK = "#d4d4d4";
export const DEFAULT_CHAT_TEXT_LIGHT = "#1a1025";
export const DEFAULT_CHAT_CHROME_TEXT_DARK = "#d4d4d4";
export const DEFAULT_CHAT_CHROME_TEXT_LIGHT = "#1a1025";
const IMAGE_DIMENSION_MIN = 64;
const IMAGE_DIMENSION_MAX = 4096;
const GAME_SETUP_LEARNED_LIMIT = 60;
const USER_ACTIVITY_MAX_LENGTH = 120;
const RECENT_USER_ACTIVITY_LIMIT = 8;
export const TRACKER_DATA_PANEL_SECTIONS: TrackerDataPanelSection[] = [
  "world",
  "persona",
  "characters",
  "quests",
  "custom",
];
const ROLEPLAY_AVATAR_SCALE_MIN = 0.75;
const ROLEPLAY_AVATAR_SCALE_MAX = 2.5;
const ROLEPLAY_SPRITE_SCALE_MIN = 0.5;
const ROLEPLAY_SPRITE_SCALE_MAX = 1.75;

const DEFAULT_GAME_SETUP_LEARNED_OPTIONS: GameSetupLearnedOptions = {
  genres: [],
  tones: [],
  settings: [],
  goals: [],
  preferences: [],
};

const DEFAULT_GAME_SETUP_REMEMBERED_TEXT: GameSetupRememberedText = {
  playerGoals: "",
  preferences: "",
};
const DEFAULT_SUMMARY_POPOVER_SETTINGS: SummaryPopoverSettings = {
  sourceMode: "last",
  contextSize: null,
  rangeStart: null,
  rangeEnd: null,
  hideSummarisedMessages: false,
  collapseHiddenMessages: false,
};

function normalizeUserActivity(activity: string): string {
  return activity.replace(/\s+/g, " ").trim().slice(0, USER_ACTIVITY_MAX_LENGTH);
}

export function getDefaultAppAccentColor(theme: "dark" | "light") {
  return theme === "light" ? DEFAULT_APP_ACCENT_LIGHT : DEFAULT_APP_ACCENT_DARK;
}

export function getDefaultAppBackgroundColor(theme: "dark" | "light") {
  return theme === "light" ? DEFAULT_APP_BACKGROUND_LIGHT : DEFAULT_APP_BACKGROUND_DARK;
}

export function getDefaultChatTextColor(theme: "dark" | "light") {
  return theme === "light" ? DEFAULT_CHAT_TEXT_LIGHT : DEFAULT_CHAT_TEXT_DARK;
}

export function getDefaultChatChromeTextColor(theme: "dark" | "light") {
  return theme === "light" ? DEFAULT_CHAT_CHROME_TEXT_LIGHT : DEFAULT_CHAT_CHROME_TEXT_DARK;
}

export function normalizeCharacterLibrarySort(value: unknown): CharacterLibrarySort {
  return CHARACTER_LIBRARY_SORT_OPTIONS.includes(value as CharacterLibrarySort)
    ? (value as CharacterLibrarySort)
    : "name-asc";
}

function normalizeCharacterPanelFavoriteFilter(value: unknown): CharacterPanelFavoriteFilter {
  return CHARACTER_PANEL_FAVORITE_FILTER_OPTIONS.includes(value as CharacterPanelFavoriteFilter)
    ? (value as CharacterPanelFavoriteFilter)
    : "all";
}

function normalizeLorebookPanelCategory(value: unknown): LorebookPanelCategory {
  return LOREBOOK_PANEL_CATEGORY_OPTIONS.includes(value as LorebookPanelCategory)
    ? (value as LorebookPanelCategory)
    : "all";
}

function normalizeLorebookPanelSort(value: unknown): LorebookPanelSort {
  return LOREBOOK_PANEL_SORT_OPTIONS.includes(value as LorebookPanelSort) ? (value as LorebookPanelSort) : "name-asc";
}

function normalizePanelText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizePanelStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)),
  );
}

function normalizeScrollTop(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function isMobileShellViewport() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function dismissChatFloatingUiForMobilePanel(open: boolean) {
  if (open && isMobileShellViewport()) announceChatFloatingUiDismiss();
}

function normalizeAppAccentColor(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return LEGACY_DEFAULT_APP_ACCENTS.has(normalized.toLowerCase()) ? "" : normalized;
}

function normalizeAppBackgroundColor(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DEFAULT_APP_BACKGROUNDS.has(normalized.toLowerCase()) ? "" : normalized;
}

function normalizeChatChromeTextColor(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampImageDimension(value: number) {
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

  const width =
    typeof legacyWidth === "number" && Number.isFinite(legacyWidth) ? clampTrackerPanelWidth(legacyWidth) : null;
  if (width !== null) {
    if (width <= 300) return "compact";
    if (width >= 380) return "expanded";
  }

  return "standard";
}

function normalizeTrackerPanelCollapsedSections(value: unknown): TrackerPanelCollapsedSections {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const collapsed: TrackerPanelCollapsedSections = {};
  for (const section of TRACKER_DATA_PANEL_SECTIONS) {
    if (raw[section] === true) collapsed[section] = true;
  }
  return collapsed;
}

function normalizeTrackerPanelSectionOrder(value: unknown): TrackerPanelSectionOrder {
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

function normalizeSummaryPopoverSettings(value: unknown): SummaryPopoverSettings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const numberOrNull = (next: unknown) => (typeof next === "number" && Number.isFinite(next) ? Math.round(next) : null);

  return {
    sourceMode: raw.sourceMode === "range" ? "range" : "last",
    contextSize: numberOrNull(raw.contextSize),
    rangeStart: numberOrNull(raw.rangeStart),
    rangeEnd: numberOrNull(raw.rangeEnd),
    hideSummarisedMessages: raw.hideSummarisedMessages === true,
    collapseHiddenMessages: raw.collapseHiddenMessages === true,
  };
}

export function normalizeConversationMessageStyle(value: unknown): ConversationMessageStyle {
  return value === "bubble" || value === "classic" ? value : "classic";
}

export function normalizeTrackerThoughtBubbleDisplay(value: unknown): TrackerThoughtBubbleDisplay {
  return value === "inline" || value === "floating" ? value : "inline";
}

export function normalizeTrackerTemperatureUnit(value: unknown): TrackerTemperatureUnit {
  return TRACKER_TEMPERATURE_UNITS.includes(value as TrackerTemperatureUnit)
    ? (value as TrackerTemperatureUnit)
    : "celsius";
}

function normalizeTrackerPanelBackgroundColor(value: unknown) {
  if (typeof value !== "string") return TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR;
  return value.trim() || TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR;
}

function normalizeDefaultRoleplayBackground(value: unknown) {
  if (typeof value !== "string") return DEFAULT_ROLEPLAY_BACKGROUND_URL;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_ROLEPLAY_BACKGROUND_URL;
  if (trimmed.startsWith("/api/backgrounds/file/")) return trimmed;
  if (trimmed.startsWith("/") || /^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `/api/backgrounds/file/${encodeURIComponent(trimmed)}`;
}

function normalizeLearnedGameSetupOption(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function normalizeRememberedGameSetupText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2000);
}

function mergeLearnedGameSetupOptions(existing: string[] | undefined, incoming: unknown[]) {
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

/** Legacy browser-local custom theme preserved for one-time migration. */
export interface CustomTheme {
  id: string;
  name: string;
  /** Raw CSS that gets injected as a <style> tag */
  css: string;
  /** When this theme was installed */
  installedAt: string;
}

/**
 * Pre-migration shape of a browser-local extension. Only used to read
 * existing localStorage state and replay it against the server
 * (`/api/extensions`) on first load — see `useLegacyExtensionMigration`.
 * New extensions go directly through the server-synced hooks in
 * `use-extensions.ts` and use the canonical `InstalledExtension` type
 * exported from `@marinara-engine/shared`.
 */
export interface LegacyInstalledExtension {
  id: string;
  name: string;
  description: string;
  css?: string;
  js?: string;
  enabled: boolean;
  installedAt: string;
}

interface UIState {
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
  trackerPanelBackgroundColor: string;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  trackerPanelCollapsedSections: TrackerPanelCollapsedSections;
  trackerPanelSectionOrder: TrackerPanelSectionOrder;
  settingsTab: string;
  modal: { type: string; props?: Record<string, unknown> } | null;
  theme: "dark" | "light";
  appBackgroundColor: string;
  appAccentColor: string;
  appAccentColorBeforeRgbMode: string | null;
  appAccentPulseMode: boolean;
  appAccentRgbMode: boolean;
  customCursorEnabled: boolean;
  chatBackground: string | null;
  /** Default background applied when a Roleplay chat has no saved background yet. */
  defaultRoleplayBackground: string;
  /** Native blur applied to selected chat/game background images, in px. */
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
  /** Pre-selected target characters for a NEW regex script opened via openRegexDetail("__new__") */
  regexDetailDefaultCharacterIds: string[] | null;
  /** Where to return when the regex editor closes — e.g. back to a character's Advanced tab */
  regexDetailReturn: { characterId: string; tab?: string } | null;
  /** One-shot tab the character editor should open to (set by the regex-editor return path) */
  characterDetailInitialTab: string | null;
  /** When true, the main area shows the browser */
  botBrowserOpen: boolean;
  /** When true, the main area shows the game assets browser */
  gameAssetsBrowserOpen: boolean;
  /** When true, the main area shows the full-page character library */
  characterLibraryOpen: boolean;
  /** Last selected character card inside the full-page character library */
  characterLibrarySelectedId: string | null;
  /** Last selected sort order for character lists and the full-page character library */
  characterLibrarySort: CharacterLibrarySort;
  /** Search text for the compact Characters panel */
  characterPanelSearch: string;
  /** Included tag filters for the compact Characters panel */
  characterPanelIncludedTags: string[];
  /** Excluded tag filters for the compact Characters panel */
  characterPanelExcludedTags: string[];
  /** Whether the compact Characters panel tag filter shelf is expanded */
  characterPanelTagsExpanded: boolean;
  /** Favorite filter for the compact Characters panel */
  characterPanelFavoriteFilter: CharacterPanelFavoriteFilter;
  /** Last scroll offset for the compact Characters panel */
  characterPanelScrollTop: number;
  /** Last scroll offset for the full-page Character Library list */
  characterLibraryScrollTop: number;
  /** Selected category for the compact Lorebooks panel */
  lorebookPanelCategory: LorebookPanelCategory;
  /** Search text for the compact Lorebooks panel */
  lorebookPanelSearch: string;
  /** Sort order for the compact Lorebooks panel */
  lorebookPanelSort: LorebookPanelSort;
  /** Selected tag filter for the compact Lorebooks panel */
  lorebookPanelActiveTag: string | null;
  /** Whether the compact Lorebooks panel tag/category shelf is expanded */
  lorebookPanelTagsExpanded: boolean;
  /** Sort order for imported characters in the Browser panel */
  botBrowserPanelSort: ResourcePanelSort;
  /** Sort order for the compact Presets panel */
  presetPanelSort: ResourcePanelSort;
  /** Sort order for the compact Connections panel */
  connectionPanelSort: ResourcePanelSort;
  /** Sort order for the compact Agents panel */
  agentPanelSort: ResourcePanelSort;
  /** True when any open detail editor has unsaved changes */
  editorDirty: boolean;
  /** Mobile-only return target for detail editors opened from a right panel */
  detailReturnRightPanel: Panel | null;

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
  /** When true, image generation requests are sent one at a time for providers that reject concurrent jobs. */
  queueImageGenerationRequests: boolean;
  /** When true, generated game image prompts are shown for review before provider calls are sent. */
  reviewImagePromptsBeforeSend: boolean;
  imageBackgroundWidth: number;
  imageBackgroundHeight: number;
  imageIllustrationWidth: number;
  imageIllustrationHeight: number;
  imagePortraitWidth: number;
  imagePortraitHeight: number;
  imageSelfieWidth: number;
  imageSelfieHeight: number;
  imageStyleProfiles: ImageStyleProfileSettings;

  messageGrouping: boolean;
  conversationMessageStyle: ConversationMessageStyle;
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
  /** When true, chat exports include saved thinking/reasoning metadata. */
  includeReasoningInExports: boolean;
  /** Number of messages to load per page (0 = load all) */
  messagesPerPage: number;
  /** Bold quoted dialogue in chat messages; color highlighting can still remain when this is off */
  boldDialogue: boolean;
  /** Preferred quote style applied to AI output and user input. */
  quoteFormat: QuoteFormat;
  /** When true, common LaTeX symbol commands render as plain Unicode symbols in chat text. */
  convertLatexSymbols: boolean;
  /** When true, model responses are trimmed back to the last complete sentence before saving. */
  trimIncompleteModelOutput: boolean;
  /** When true, chat inputs show a microphone button for browser speech-to-text dictation. */
  speechToTextEnabled: boolean;
  /** When true, allow the rare Chibi Professor Mari scroll toast. */
  chibiProfessorMariEnabled: boolean;
  /** When true, achievements appear on Home and announce unlocks. Backend tracking stays silent either way. */
  achievementsEnabled: boolean;
  /** When true, show the global Music Player surface. */
  musicPlayerEnabled: boolean;
  /** Which Music Player surface to show. */
  musicPlayerSource: MusicPlayerSource;
  /** When true, show the global Spotify mini player in the app chrome. */
  spotifyPlayerEnabled: boolean;
  /** When true, show the Music DJ YouTube mini player when Music DJ plays a track. */
  youtubePlayerEnabled: boolean;
  /** User-set YouTube player volume (0–100). The DJ can also steer this. */
  youtubePlayerVolume: number;
  /** User-set local Custom music player volume (0–100). The DJ can also steer this. */
  localMusicPlayerVolume: number;
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
  /** When true, double-clicking or double-tapping a Roleplay message opens it for editing. */
  editMessageOnDoubleClick: boolean;
  /** Persisted controls shown in the Chat Summary popover settings window. */
  summaryPopoverSettings: SummaryPopoverSettings;

  // ── Text Appearance ──
  /** Color for narrator text in RP mode (empty = default amber) */
  narrationFontColor: string;
  /** Opacity for narrator text (0–100) */
  narrationOpacity: number;
  /** Color for chat message text (empty = theme default) */
  chatFontColor: string;
  /** Color for non-action chrome copy in tracker widgets, folder labels, settings descriptors, and popovers (empty = scheme default) */
  chatChromeTextColor: string;
  /** Opacity for roleplay message backgrounds (0–100) */
  chatFontOpacity: number;
  /** Layout style for roleplay message avatars */
  roleplayAvatarStyle: RoleplayAvatarStyle;
  /** Scale multiplier for Roleplay message avatars. */
  roleplayAvatarScale: number;
  /** When true, Roleplay message avatars stay visible while scrolling through long messages. */
  roleplayAvatarsScrollable: boolean;
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
  gameNotificationSound: boolean;
  notificationSoundsOnlyWhenUnfocused: boolean;
  conversationBrowserNotifications: boolean;

  // ── Custom Conversation Prompt ──
  /** User's custom default system prompt for new conversations (null = built-in default). */
  customConversationPrompt: string | null;

  // ── Schedule Generation Preferences ──
  /** Free-form user guidance injected into the conversation-mode schedule generation prompt (empty = unset). */
  scheduleGenerationPreferences: string;
  /** Custom Game setup chips learned from previous games. Synced so they follow the user. */
  learnedGameSetupOptions: GameSetupLearnedOptions;
  /** Last submitted free-text Game setup fields. Synced so new games can start from the previous setup. */
  rememberedGameSetupText: GameSetupRememberedText;

  // ── Input ──
  enterToSendRP: boolean;
  enterToSendConvo: boolean;
  enterToSendGame: boolean;

  // ── Roleplay Effects ──
  weatherEffects: boolean;

  // ── HUD Layout ──
  hudPosition: HudPosition;

  // ── Legacy Custom Themes & Extensions ──
  /** Legacy active custom theme id (null = built-in default). Migration only. */
  activeCustomTheme: string | null;
  /** Legacy browser-local custom themes. Migration only. */
  customThemes: CustomTheme[];
  /** True once legacy browser-local themes have been migrated to the server. */
  hasMigratedCustomThemesToServer: boolean;
  /** Legacy browser-local extensions. Migration only — see useLegacyExtensionMigration. */
  installedExtensions: LegacyInstalledExtension[];
  /** True once legacy browser-local extensions have been migrated to the server. */
  hasMigratedExtensionsToServer: boolean;

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
  /** The user's manually chosen status. Persisted. */
  userStatusManual: UserStatus;
  /** Effective status: matches manual, but auto-flips to "idle" on inactivity */
  userStatus: UserStatus;
  /** Optional short activity shown with the user's status in Conversation mode. */
  userActivity: string;
  /** Recent user activity strings shown under the chat sidebar status editor. */
  recentUserActivities: string[];

  // ── Impersonate Settings ──
  /** Custom prompt template for /impersonate (empty = use server default). Persisted. */
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
  /** Transient request for the chat sidebar to focus a fixed mode shortcut. */
  chatModeShortcutRequest: { mode: ChatModeShortcut; token: number } | null;

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
  setTrackerPanelBackgroundColor: (color: string) => void;
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
  setAppBackgroundColor: (color: string) => void;
  setAppAccentColor: (color: string) => void;
  setAppAccentColorBeforeRgbMode: (color: string | null) => void;
  setAppAccentPulseMode: (enabled: boolean) => void;
  setAppAccentRgbMode: (enabled: boolean) => void;
  setCustomCursorEnabled: (enabled: boolean) => void;
  setChatBackground: (url: string | null) => void;
  setDefaultRoleplayBackground: (url: string) => void;
  setChatBackgroundBlur: (v: number) => void;
  setCharacterLibrarySelectedId: (id: string | null) => void;
  setCharacterLibrarySort: (sort: CharacterLibrarySort) => void;
  setCharacterPanelSearch: (search: string) => void;
  setCharacterPanelIncludedTags: (tags: string[]) => void;
  setCharacterPanelExcludedTags: (tags: string[]) => void;
  setCharacterPanelTagsExpanded: (expanded: boolean) => void;
  setCharacterPanelFavoriteFilter: (filter: CharacterPanelFavoriteFilter) => void;
  setCharacterPanelScrollTop: (scrollTop: number) => void;
  setCharacterLibraryScrollTop: (scrollTop: number) => void;
  setLorebookPanelCategory: (category: LorebookPanelCategory) => void;
  setLorebookPanelSearch: (search: string) => void;
  setLorebookPanelSort: (sort: LorebookPanelSort) => void;
  setLorebookPanelActiveTag: (tag: string | null) => void;
  setLorebookPanelTagsExpanded: (expanded: boolean) => void;
  setBotBrowserPanelSort: (sort: ResourcePanelSort) => void;
  setPresetPanelSort: (sort: ResourcePanelSort) => void;
  setConnectionPanelSort: (sort: ResourcePanelSort) => void;
  setAgentPanelSort: (sort: ResourcePanelSort) => void;
  openCharacterDetail: (id: string, options?: { preserveCharacterLibrary?: boolean }) => void;
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
  openRegexDetail: (
    id: string,
    options?: { defaultCharacterIds?: string[]; returnTo?: { characterId: string; tab?: string } },
  ) => void;
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
  setQueueImageGenerationRequests: (v: boolean) => void;
  setReviewImagePromptsBeforeSend: (v: boolean) => void;
  setImageBackgroundDimensions: (width: number, height: number) => void;
  setImageIllustrationDimensions: (width: number, height: number) => void;
  setImagePortraitDimensions: (width: number, height: number) => void;
  setImageSelfieDimensions: (width: number, height: number) => void;
  setImageStyleProfiles: (settings: ImageStyleProfileSettings) => void;

  setMessageGrouping: (v: boolean) => void;
  setConversationMessageStyle: (v: ConversationMessageStyle) => void;
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
  setIncludeReasoningInExports: (v: boolean) => void;
  setMessagesPerPage: (n: number) => void;
  setBoldDialogue: (v: boolean) => void;
  setQuoteFormat: (v: QuoteFormat) => void;
  setConvertLatexSymbols: (v: boolean) => void;
  setTrimIncompleteModelOutput: (v: boolean) => void;
  setSpeechToTextEnabled: (v: boolean) => void;
  setChibiProfessorMariEnabled: (v: boolean) => void;
  setAchievementsEnabled: (v: boolean) => void;
  setMusicPlayerEnabled: (v: boolean) => void;
  setMusicPlayerSource: (v: MusicPlayerSource) => void;
  setSpotifyPlayerEnabled: (v: boolean) => void;
  setYoutubePlayerEnabled: (v: boolean) => void;
  setYoutubePlayerVolume: (v: number) => void;
  setLocalMusicPlayerVolume: (v: number) => void;
  setSpotifyMobileWidgetCollapsed: (v: boolean) => void;
  setSpotifyMobileWidgetPosition: (position: FloatingWidgetPosition) => void;
  setIntuitiveSwipeNavigation: (v: boolean) => void;
  setIntuitiveSwipeRerollLatest: (v: boolean) => void;
  setEditLastMessageOnArrowUp: (v: boolean) => void;
  setEditMessageOnDoubleClick: (v: boolean) => void;
  setSummaryPopoverSettings: (settings: Partial<SummaryPopoverSettings>) => void;
  setNarrationFontColor: (v: string) => void;
  setNarrationOpacity: (v: number) => void;
  setChatFontColor: (v: string) => void;
  setChatChromeTextColor: (v: string) => void;
  setChatFontOpacity: (v: number) => void;
  setRoleplayAvatarStyle: (v: RoleplayAvatarStyle) => void;
  setRoleplayAvatarScale: (v: number) => void;
  setRoleplayAvatarsScrollable: (v: boolean) => void;
  setRoleplaySpriteScale: (v: number) => void;
  setGameAvatarScale: (v: number) => void;
  setGameFullBodySpriteScale: (v: number) => void;
  setTextStrokeWidth: (v: number) => void;
  setTextStrokeColor: (v: string) => void;
  setCenterCompact: (v: boolean) => void;
  requestChatModeShortcut: (mode: ChatModeShortcut) => void;
  setVisualTheme: (v: VisualTheme) => void;
  setConvoGradientField: (scheme: "dark" | "light", field: "from" | "to", value: string) => void;
  resetAppearanceSettings: () => void;
  setConvoNotificationSound: (v: boolean) => void;
  setRpNotificationSound: (v: boolean) => void;
  setGameNotificationSound: (v: boolean) => void;
  setNotificationSoundsOnlyWhenUnfocused: (v: boolean) => void;
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

  /** Legacy migration helpers for browser-local custom themes. */
  setHasMigratedCustomThemesToServer: (v: boolean) => void;
  clearLegacyCustomThemes: () => void;
  setActiveCustomTheme: (id: string | null) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  updateCustomTheme: (id: string, patch: Partial<Pick<CustomTheme, "name" | "css">>) => void;
  removeCustomTheme: (id: string) => void;
  /** Legacy migration helpers for browser-local extensions. */
  setHasMigratedExtensionsToServer: (v: boolean) => void;
  clearLegacyExtensions: () => void;
  setHasCompletedOnboarding: (v: boolean) => void;
  setGameTutorialDisabled: (v: boolean) => void;
  dismissLinkApiBanner: () => void;
  toggleEchoChamber: () => void;
  setEchoChamberSide: (side: EchoChamberSide) => void;
  setUserStatus: (status: UserStatus) => void;
  setUserStatusManual: (status: UserStatus) => void;
  setUserActivity: (activity: string) => void;
  rememberUserActivity: (activity: string) => void;
}

function getMobileDetailReturnState(state: UIState) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const useOverlayDetailReturn = isMobile || state.centerCompact;
  return {
    detailReturnRightPanel: useOverlayDetailReturn && state.rightPanelOpen ? state.rightPanel : null,
    ...(useOverlayDetailReturn && { rightPanelOpen: false }),
  };
}

function restoreMobileDetailReturnPanel(panel: Panel | null) {
  return {
    detailReturnRightPanel: null,
    ...(panel && { rightPanelOpen: true, rightPanel: panel }),
  };
}

function normalizePersistedMainSurface(persisted: Record<string, unknown>) {
  const surfaceKeys = [
    "regexDetailId",
    "personaDetailId",
    "toolDetailId",
    "agentDetailId",
    "connectionDetailId",
    "presetDetailId",
    "characterDetailId",
    "lorebookDetailId",
    "characterLibraryOpen",
    "botBrowserOpen",
    "gameAssetsBrowserOpen",
  ] as const;
  let found = false;
  for (const key of surfaceKeys) {
    const value = persisted[key];
    const isOpen = typeof value === "string" ? value.trim().length > 0 : value === true;
    if (!isOpen) {
      if (typeof value === "string") persisted[key] = null;
      if (typeof value === "boolean") persisted[key] = false;
      continue;
    }
    if (!found) {
      found = true;
      continue;
    }
    persisted[key] = typeof value === "string" ? null : false;
  }
  persisted.editorDirty = false;
  persisted.detailReturnRightPanel = null;
}

/**
 * Returns the subset of UI state that is synced to the server so it persists
 * across devices and browsers. Excludes device-local sizing preferences,
 * legacy migration flags, auto-computed fields (userStatus), and items tracked
 * via their own server resources (custom themes, extensions).
 */
export function pickSyncedSettings(state: UIState) {
  return {
    sidebarOpen: state.sidebarOpen,
    sidebarWidth: state.sidebarWidth,
    trackerPanelEnabled: state.trackerPanelEnabled,
    trackerPanelOpen: state.trackerPanelOpen,
    trackerPanelSide: state.trackerPanelSide,
    trackerPanelHideHudWidgets: state.trackerPanelHideHudWidgets,
    trackerPanelUseExpressionSprites: state.trackerPanelUseExpressionSprites,
    trackerPanelThoughtBubbleDisplay: state.trackerPanelThoughtBubbleDisplay,
    trackerPanelDockedThoughtsAlwaysVisible: state.trackerPanelDockedThoughtsAlwaysVisible,
    trackerPanelSizeProfile: state.trackerPanelSizeProfile,
    trackerPanelBackgroundColor: state.trackerPanelBackgroundColor,
    trackerTemperatureUnit: state.trackerTemperatureUnit,
    trackerPanelCollapsedSections: state.trackerPanelCollapsedSections,
    trackerPanelSectionOrder: state.trackerPanelSectionOrder,
    theme: state.theme,
    appBackgroundColor: state.appBackgroundColor,
    appAccentColor: state.appAccentColor,
    chatBackground: state.chatBackground,
    defaultRoleplayBackground: state.defaultRoleplayBackground,
    chatBackgroundBlur: state.chatBackgroundBlur,
    language: state.language,
    fontFamily: state.fontFamily,
    enableStreaming: state.enableStreaming,
    streamingSpeed: state.streamingSpeed,
    gameInstantTextReveal: state.gameInstantTextReveal,
    gameMiddleMouseNav: state.gameMiddleMouseNav,
    gameDialogueDisplayMode: state.gameDialogueDisplayMode,
    gameTextSpeed: state.gameTextSpeed,
    gameAutoPlayDelay: state.gameAutoPlayDelay,
    queueImageGenerationRequests: state.queueImageGenerationRequests,
    reviewImagePromptsBeforeSend: state.reviewImagePromptsBeforeSend,
    imageBackgroundWidth: state.imageBackgroundWidth,
    imageBackgroundHeight: state.imageBackgroundHeight,
    imageIllustrationWidth: state.imageIllustrationWidth,
    imageIllustrationHeight: state.imageIllustrationHeight,
    imagePortraitWidth: state.imagePortraitWidth,
    imagePortraitHeight: state.imagePortraitHeight,
    imageSelfieWidth: state.imageSelfieWidth,
    imageSelfieHeight: state.imageSelfieHeight,
    [IMAGE_STYLE_PROFILES_STORAGE_KEY]: state.imageStyleProfiles,

    messageGrouping: state.messageGrouping,
    conversationMessageStyle: state.conversationMessageStyle,
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
    includeReasoningInExports: state.includeReasoningInExports,
    messagesPerPage: state.messagesPerPage,
    boldDialogue: state.boldDialogue,
    quoteFormat: state.quoteFormat,
    convertLatexSymbols: state.convertLatexSymbols,
    trimIncompleteModelOutput: state.trimIncompleteModelOutput,
    speechToTextEnabled: state.speechToTextEnabled,
    chibiProfessorMariEnabled: state.chibiProfessorMariEnabled,
    achievementsEnabled: state.achievementsEnabled,
    musicPlayerEnabled: state.musicPlayerEnabled,
    musicPlayerSource: state.musicPlayerSource,
    spotifyPlayerEnabled: state.spotifyPlayerEnabled,
    youtubePlayerEnabled: state.youtubePlayerEnabled,
    youtubePlayerVolume: state.youtubePlayerVolume,
    localMusicPlayerVolume: state.localMusicPlayerVolume,
    spotifyMobileWidgetCollapsed: state.spotifyMobileWidgetCollapsed,
    spotifyMobileWidgetPosition: state.spotifyMobileWidgetPosition,
    intuitiveSwipeNavigation: state.intuitiveSwipeNavigation,
    intuitiveSwipeRerollLatest: state.intuitiveSwipeRerollLatest,
    editLastMessageOnArrowUp: state.editLastMessageOnArrowUp,
    editMessageOnDoubleClick: state.editMessageOnDoubleClick,
    summaryPopoverSettings: state.summaryPopoverSettings,
    narrationFontColor: state.narrationFontColor,
    narrationOpacity: state.narrationOpacity,
    chatFontColor: state.chatFontColor,
    chatChromeTextColor: state.chatChromeTextColor,
    chatFontOpacity: state.chatFontOpacity,
    roleplayAvatarStyle: state.roleplayAvatarStyle,
    roleplayAvatarScale: state.roleplayAvatarScale,
    roleplayAvatarsScrollable: state.roleplayAvatarsScrollable,
    roleplaySpriteScale: state.roleplaySpriteScale,
    gameAvatarScale: state.gameAvatarScale,
    gameFullBodySpriteScale: state.gameFullBodySpriteScale,
    textStrokeWidth: state.textStrokeWidth,
    textStrokeColor: state.textStrokeColor,
    visualTheme: state.visualTheme,
    convoGradient: state.convoGradient,
    enterToSendRP: state.enterToSendRP,
    enterToSendConvo: state.enterToSendConvo,
    weatherEffects: state.weatherEffects,
    hudPosition: state.hudPosition,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    gameTutorialDisabled: state.gameTutorialDisabled,
    linkApiBannerDismissed: state.linkApiBannerDismissed,
    echoChamberOpen: state.echoChamberOpen,
    echoChamberSide: state.echoChamberSide,
    userStatusManual: state.userStatusManual,
    userActivity: state.userActivity,
    recentUserActivities: state.recentUserActivities,
    convoNotificationSound: state.convoNotificationSound,
    rpNotificationSound: state.rpNotificationSound,
    gameNotificationSound: state.gameNotificationSound,
    notificationSoundsOnlyWhenUnfocused: state.notificationSoundsOnlyWhenUnfocused,
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

export type SyncedSettings = ReturnType<typeof pickSyncedSettings>;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarWidth: 320,
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
      trackerPanelBackgroundColor: TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
      trackerTemperatureUnit: "celsius" as TrackerTemperatureUnit,
      trackerPanelCollapsedSections: {},
      trackerPanelSectionOrder: [...TRACKER_DATA_PANEL_SECTIONS],
      settingsTab: "general",
      modal: null,
      theme: "dark" as const,
      appBackgroundColor: "",
      appAccentColor: "",
      appAccentColorBeforeRgbMode: null,
      appAccentPulseMode: false,
      appAccentRgbMode: false,
      customCursorEnabled: true,
      chatBackground: null,
      defaultRoleplayBackground: DEFAULT_ROLEPLAY_BACKGROUND_URL,
      chatBackgroundBlur: 0,
      characterDetailId: null,
      lorebookDetailId: null,
      presetDetailId: null,
      connectionDetailId: null,
      agentDetailId: null,
      toolDetailId: null,
      personaDetailId: null,
      regexDetailId: null,
      regexDetailDefaultCharacterIds: null,
      regexDetailReturn: null,
      characterDetailInitialTab: null,
      botBrowserOpen: false,
      gameAssetsBrowserOpen: false,
      characterLibraryOpen: false,
      characterLibrarySelectedId: null,
      characterLibrarySort: "name-asc" as CharacterLibrarySort,
      characterPanelSearch: "",
      characterPanelIncludedTags: [],
      characterPanelExcludedTags: [],
      characterPanelTagsExpanded: false,
      characterPanelFavoriteFilter: "all" as CharacterPanelFavoriteFilter,
      characterPanelScrollTop: 0,
      characterLibraryScrollTop: 0,
      lorebookPanelCategory: "all" as LorebookPanelCategory,
      lorebookPanelSearch: "",
      lorebookPanelSort: "name-asc" as LorebookPanelSort,
      lorebookPanelActiveTag: null,
      lorebookPanelTagsExpanded: false,
      botBrowserPanelSort: "name-asc" as ResourcePanelSort,
      presetPanelSort: "name-asc" as ResourcePanelSort,
      connectionPanelSort: "name-asc" as ResourcePanelSort,
      agentPanelSort: "name-asc" as ResourcePanelSort,
      editorDirty: false,
      detailReturnRightPanel: null,

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
      queueImageGenerationRequests: true,
      reviewImagePromptsBeforeSend: false,
      imageBackgroundWidth: 1280,
      imageBackgroundHeight: 720,
      imageIllustrationWidth: 896,
      imageIllustrationHeight: 1280,
      imagePortraitWidth: 1024,
      imagePortraitHeight: 1024,
      imageSelfieWidth: 896,
      imageSelfieHeight: 1152,
      imageStyleProfiles: normalizeImageStyleProfileSettings(null),

      messageGrouping: true,
      conversationMessageStyle: "classic" as ConversationMessageStyle,
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
      includeReasoningInExports: false,
      messagesPerPage: 20,
      boldDialogue: true,
      quoteFormat: "straight" as QuoteFormat,
      convertLatexSymbols: true,
      trimIncompleteModelOutput: false,
      speechToTextEnabled: false,
      chibiProfessorMariEnabled: true,
      achievementsEnabled: true,
      musicPlayerEnabled: true,
      musicPlayerSource: "youtube" as MusicPlayerSource,
      spotifyPlayerEnabled: false,
      youtubePlayerEnabled: true,
      youtubePlayerVolume: 70,
      localMusicPlayerVolume: 70,
      spotifyMobileWidgetCollapsed: true,
      spotifyMobileWidgetPosition: { x: 16, y: 96 },
      intuitiveSwipeNavigation: false,
      intuitiveSwipeRerollLatest: false,
      editLastMessageOnArrowUp: true,
      editMessageOnDoubleClick: true,
      summaryPopoverSettings: DEFAULT_SUMMARY_POPOVER_SETTINGS,
      narrationFontColor: "",
      narrationOpacity: 80,
      chatFontColor: "",
      chatChromeTextColor: "",
      chatFontOpacity: 90,
      roleplayAvatarStyle: "circles" as RoleplayAvatarStyle,
      roleplayAvatarScale: 1,
      roleplayAvatarsScrollable: false,
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
      gameNotificationSound: true,
      notificationSoundsOnlyWhenUnfocused: false,
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
      activeCustomTheme: null,
      customThemes: [],
      hasMigratedCustomThemesToServer: false,
      installedExtensions: [],
      hasMigratedExtensionsToServer: false,
      hasCompletedOnboarding: false,
      gameTutorialDisabled: false,
      linkApiBannerDismissed: false,
      echoChamberOpen: false,
      echoChamberSide: "bottom-right" as EchoChamberSide,
      userStatusManual: "active" as const,
      userStatus: "active" as UserStatus,
      userActivity: "",
      recentUserActivities: [],
      centerCompact: false,
      chatModeShortcutRequest: null,

      // Impersonate settings defaults
      impersonatePromptTemplate: "",
      impersonateShowQuickButton: false,
      impersonateCyoaChoices: false,
      impersonatePresetId: null,
      impersonateConnectionId: null,
      impersonateBlockAgents: false,

      toggleSidebar: () =>
        set((s) => {
          const sidebarOpen = !s.sidebarOpen;
          const mobile = isMobileShellViewport();
          dismissChatFloatingUiForMobilePanel(sidebarOpen);
          return {
            sidebarOpen,
            ...(mobile && sidebarOpen ? { rightPanelOpen: false } : {}),
          };
        }),
      setSidebarOpen: (open) => {
        dismissChatFloatingUiForMobilePanel(open);
        set({ sidebarOpen: open });
      },
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
      setTrackerPanelBackgroundColor: (color) =>
        set({ trackerPanelBackgroundColor: normalizeTrackerPanelBackgroundColor(color) }),
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

      openRightPanel: (panel) =>
        set(() => {
          const mobile = isMobileShellViewport();
          dismissChatFloatingUiForMobilePanel(true);
          return {
            rightPanelOpen: true,
            rightPanel: panel,
            ...(mobile ? { sidebarOpen: false } : {}),
          };
        }),
      closeRightPanel: () => set({ rightPanelOpen: false }),
      toggleRightPanel: (panel) =>
        set((s) => {
          if (s.rightPanelOpen && s.rightPanel === panel) return { rightPanelOpen: false };
          const mobile = isMobileShellViewport();
          dismissChatFloatingUiForMobilePanel(true);
          return {
            rightPanelOpen: true,
            rightPanel: panel,
            ...(mobile ? { sidebarOpen: false } : {}),
          };
        }),

      setSettingsTab: (tab) => set({ settingsTab: tab }),
      openModal: (type, props) => set({ modal: { type, props } }),
      closeModal: () => set({ modal: null }),
      setTheme: (theme) => set({ theme }),
      setAppBackgroundColor: (color) => set({ appBackgroundColor: normalizeAppBackgroundColor(color) }),
      setAppAccentColor: (color) => set({ appAccentColor: normalizeAppAccentColor(color) }),
      setAppAccentColorBeforeRgbMode: (color) =>
        set({ appAccentColorBeforeRgbMode: color === null ? null : normalizeAppAccentColor(color) }),
      setAppAccentPulseMode: (enabled) => set({ appAccentPulseMode: enabled }),
      setAppAccentRgbMode: (enabled) => set({ appAccentRgbMode: enabled }),
      setCustomCursorEnabled: (enabled) => set({ customCursorEnabled: enabled }),
      setChatBackground: (url) => set({ chatBackground: url }),
      setDefaultRoleplayBackground: (url) => set({ defaultRoleplayBackground: normalizeDefaultRoleplayBackground(url) }),
      setChatBackgroundBlur: (v) => set({ chatBackgroundBlur: Math.max(0, Math.min(24, Math.round(v))) }),
      setCharacterLibrarySelectedId: (id) => set({ characterLibrarySelectedId: id }),
      setCharacterLibrarySort: (sort) => set({ characterLibrarySort: normalizeCharacterLibrarySort(sort) }),
      setCharacterPanelSearch: (search) => set({ characterPanelSearch: normalizePanelText(search) }),
      setCharacterPanelIncludedTags: (tags) => set({ characterPanelIncludedTags: normalizePanelStringArray(tags) }),
      setCharacterPanelExcludedTags: (tags) => set({ characterPanelExcludedTags: normalizePanelStringArray(tags) }),
      setCharacterPanelTagsExpanded: (expanded) => set({ characterPanelTagsExpanded: expanded }),
      setCharacterPanelFavoriteFilter: (filter) =>
        set({ characterPanelFavoriteFilter: normalizeCharacterPanelFavoriteFilter(filter) }),
      setCharacterPanelScrollTop: (scrollTop) => set({ characterPanelScrollTop: normalizeScrollTop(scrollTop) }),
      setCharacterLibraryScrollTop: (scrollTop) => set({ characterLibraryScrollTop: normalizeScrollTop(scrollTop) }),
      setLorebookPanelCategory: (category) => set({ lorebookPanelCategory: normalizeLorebookPanelCategory(category) }),
      setLorebookPanelSearch: (search) => set({ lorebookPanelSearch: normalizePanelText(search) }),
      setLorebookPanelSort: (sort) => set({ lorebookPanelSort: normalizeLorebookPanelSort(sort) }),
      setLorebookPanelActiveTag: (tag) => set({ lorebookPanelActiveTag: tag ? tag.trim() || null : null }),
      setLorebookPanelTagsExpanded: (expanded) => set({ lorebookPanelTagsExpanded: expanded }),
      setBotBrowserPanelSort: (sort) => set({ botBrowserPanelSort: normalizeBasicPanelSort(sort) }),
      setPresetPanelSort: (sort) => set({ presetPanelSort: normalizeBasicPanelSort(sort) }),
      setConnectionPanelSort: (sort) => set({ connectionPanelSort: normalizeBasicPanelSort(sort) }),
      setAgentPanelSort: (sort) => set({ agentPanelSort: normalizeBasicPanelSort(sort) }),
      openCharacterDetail: (id, options) =>
        set((s) => {
          const preserveCharacterLibrary = options?.preserveCharacterLibrary ?? s.characterLibraryOpen;
          return {
            characterDetailId: id,
            characterDetailInitialTab: null,
            lorebookDetailId: null,
            presetDetailId: null,
            connectionDetailId: null,
            agentDetailId: null,
            toolDetailId: null,
            personaDetailId: null,
            regexDetailId: null,
            characterLibraryOpen: preserveCharacterLibrary ? s.characterLibraryOpen : false,
            characterLibrarySelectedId: preserveCharacterLibrary ? id : s.characterLibrarySelectedId,
            botBrowserOpen: false,
            gameAssetsBrowserOpen: false,
            ...getMobileDetailReturnState(s),
          };
        }),
      closeCharacterDetail: () =>
        set((s) => ({
          characterDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openLorebookDetail: (id) =>
        set((s) => ({
          lorebookDetailId: id,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closeLorebookDetail: () =>
        set((s) => ({
          lorebookDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openPresetDetail: (id) =>
        set((s) => ({
          presetDetailId: id,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          lorebookDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closePresetDetail: () =>
        set((s) => ({
          presetDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openConnectionDetail: (id) =>
        set((s) => ({
          connectionDetailId: id,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closeConnectionDetail: () =>
        set((s) => ({
          connectionDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openAgentDetail: (agentType) =>
        set((s) => ({
          agentDetailId: agentType,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closeAgentDetail: () =>
        set((s) => ({
          agentDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openToolDetail: (id) =>
        set((s) => ({
          toolDetailId: id,
          agentDetailId: null,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closeToolDetail: () =>
        set((s) => ({
          toolDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openPersonaDetail: (id) =>
        set((s) => ({
          personaDetailId: id,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          regexDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closePersonaDetail: () =>
        set((s) => ({
          personaDetailId: null,
          editorDirty: false,
          ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
        })),
      openRegexDetail: (id, options) =>
        set((s) => ({
          regexDetailId: id,
          regexDetailDefaultCharacterIds: options?.defaultCharacterIds ?? null,
          regexDetailReturn: options?.returnTo ?? null,
          personaDetailId: null,
          characterLibraryOpen: false,
          botBrowserOpen: false,
          gameAssetsBrowserOpen: false,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          ...getMobileDetailReturnState(s),
        })),
      closeRegexDetail: () =>
        set((s) => {
          const ret = s.regexDetailReturn;
          if (ret) {
            // Opened from a character's scoped-regex manager — return to that character's tab.
            return {
              regexDetailId: null,
              regexDetailReturn: null,
              regexDetailDefaultCharacterIds: null,
              characterDetailId: ret.characterId,
              characterDetailInitialTab: ret.tab ?? null,
              editorDirty: false,
            };
          }
          return {
            regexDetailId: null,
            regexDetailReturn: null,
            editorDirty: false,
            ...restoreMobileDetailReturnPanel(s.detailReturnRightPanel),
          };
        }),
      openCharacterLibrary: () =>
        set({
          characterLibraryOpen: true,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          personaDetailId: null,
          regexDetailId: null,
          botBrowserOpen: false,
          editorDirty: false,
          detailReturnRightPanel: null,
          rightPanelOpen: false,
        }),
      closeCharacterLibrary: () => set({ characterLibraryOpen: false }),
      openBotBrowser: () =>
        set({
          botBrowserOpen: true,
          gameAssetsBrowserOpen: false,
          characterLibraryOpen: false,
          detailReturnRightPanel: null,
          regexDetailId: null,
          personaDetailId: null,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
        }),
      closeBotBrowser: () => set({ botBrowserOpen: false }),
      openGameAssetsBrowser: () =>
        set({
          gameAssetsBrowserOpen: true,
          botBrowserOpen: false,
          characterLibraryOpen: false,
          detailReturnRightPanel: null,
          regexDetailId: null,
          personaDetailId: null,
          characterDetailId: null,
          lorebookDetailId: null,
          presetDetailId: null,
          connectionDetailId: null,
          agentDetailId: null,
          toolDetailId: null,
          ...(window.innerWidth < 768 && { rightPanelOpen: false }),
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
          detailReturnRightPanel: null,
        }),
      setEditorDirty: (dirty) => set({ editorDirty: dirty }),
      requestChatModeShortcut: (mode) =>
        set((state) => ({
          sidebarOpen: true,
          rightPanelOpen: window.innerWidth < 768 ? false : state.rightPanelOpen,
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
          detailReturnRightPanel: null,
          chatModeShortcutRequest: {
            mode,
            token: (state.chatModeShortcutRequest?.token ?? 0) + 1,
          },
        })),

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
      setQueueImageGenerationRequests: (v) => set({ queueImageGenerationRequests: v }),
      setReviewImagePromptsBeforeSend: (v) => set({ reviewImagePromptsBeforeSend: v }),
      setImageBackgroundDimensions: (width, height) =>
        set({
          imageBackgroundWidth: clampImageDimension(width),
          imageBackgroundHeight: clampImageDimension(height),
        }),
      setImageIllustrationDimensions: (width, height) =>
        set({
          imageIllustrationWidth: clampImageDimension(width),
          imageIllustrationHeight: clampImageDimension(height),
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
      setImageStyleProfiles: (settings) => set({ imageStyleProfiles: normalizeImageStyleProfileSettings(settings) }),

      setMessageGrouping: (v) => set({ messageGrouping: v }),
      setConversationMessageStyle: (v) => set({ conversationMessageStyle: normalizeConversationMessageStyle(v) }),
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
      setIncludeReasoningInExports: (v) => set({ includeReasoningInExports: v }),
      setMessagesPerPage: (n) => set({ messagesPerPage: n }),
      setBoldDialogue: (v) => set({ boldDialogue: v }),
      setQuoteFormat: (v) => set({ quoteFormat: normalizeQuoteFormat(v) }),
      setConvertLatexSymbols: (v) => set({ convertLatexSymbols: v }),
      setTrimIncompleteModelOutput: (v) => set({ trimIncompleteModelOutput: v }),
      setSpeechToTextEnabled: (v) => set({ speechToTextEnabled: v }),
      setChibiProfessorMariEnabled: (v) => set({ chibiProfessorMariEnabled: v }),
      setAchievementsEnabled: (v) => set({ achievementsEnabled: v }),
      setMusicPlayerEnabled: (v) =>
        set((state) => ({
          musicPlayerEnabled: v,
          spotifyPlayerEnabled: v && state.musicPlayerSource === "spotify",
          youtubePlayerEnabled: v && state.musicPlayerSource === "youtube",
        })),
      setMusicPlayerSource: (v) =>
        set({
          musicPlayerEnabled: true,
          musicPlayerSource: v,
          spotifyPlayerEnabled: v === "spotify",
          youtubePlayerEnabled: v === "youtube",
        }),
      setSpotifyPlayerEnabled: (v) => set({ spotifyPlayerEnabled: v }),
      setYoutubePlayerEnabled: (v) => set({ youtubePlayerEnabled: v }),
      setYoutubePlayerVolume: (v) => set({ youtubePlayerVolume: Math.max(0, Math.min(100, Math.round(v))) }),
      setLocalMusicPlayerVolume: (v) => set({ localMusicPlayerVolume: Math.max(0, Math.min(100, Math.round(v))) }),
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
      setEditMessageOnDoubleClick: (v) => set({ editMessageOnDoubleClick: v }),
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
      setChatChromeTextColor: (v) => set({ chatChromeTextColor: normalizeChatChromeTextColor(v) }),
      setChatFontOpacity: (v) => set({ chatFontOpacity: Math.max(0, Math.min(100, v)) }),
      setRoleplayAvatarStyle: (v) => set({ roleplayAvatarStyle: v }),
      setRoleplayAvatarScale: (v) =>
        set({ roleplayAvatarScale: Math.max(ROLEPLAY_AVATAR_SCALE_MIN, Math.min(ROLEPLAY_AVATAR_SCALE_MAX, v)) }),
      setRoleplayAvatarsScrollable: (v) => set({ roleplayAvatarsScrollable: v }),
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
      resetAppearanceSettings: () =>
        set({
          trackerPanelEnabled: true,
          trackerPanelOpen: false,
          trackerPanelSide: "right" as TrackerPanelSide,
          trackerPanelHideHudWidgets: false,
          trackerPanelUseExpressionSprites: false,
          trackerPanelThoughtBubbleDisplay: "inline" as TrackerThoughtBubbleDisplay,
          trackerPanelDockedThoughtsAlwaysVisible: false,
          trackerPanelSizeProfile: "standard" as TrackerPanelSizeProfile,
          trackerPanelBackgroundColor: TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
          trackerTemperatureUnit: "celsius" as TrackerTemperatureUnit,
          trackerPanelCollapsedSections: {},
          trackerPanelSectionOrder: [...TRACKER_DATA_PANEL_SECTIONS],
          theme: "dark" as const,
          appBackgroundColor: "",
          appAccentColor: "",
          appAccentRgbMode: false,
          customCursorEnabled: true,
          chatBackground: null,
          defaultRoleplayBackground: DEFAULT_ROLEPLAY_BACKGROUND_URL,
          chatBackgroundBlur: 0,
          fontSize: 17 as FontSize,
          chatFontSize: 16,
          fontFamily: "",
          conversationMessageStyle: "classic" as ConversationMessageStyle,
          narrationFontColor: "",
          narrationOpacity: 80,
          chatFontColor: "",
          chatChromeTextColor: "",
          chatFontOpacity: 90,
          roleplayAvatarStyle: "circles" as RoleplayAvatarStyle,
          roleplayAvatarScale: 1,
          roleplayAvatarsScrollable: false,
          roleplaySpriteScale: 1,
          gameDialogueDisplayMode: "classic" as GameDialogueDisplayMode,
          gameAvatarScale: 1,
          gameFullBodySpriteScale: 1.35,
          textStrokeWidth: 0.5,
          textStrokeColor: "#000000",
          visualTheme: "default" as VisualTheme,
          convoGradient: {
            dark: { from: "#0a0a0e", to: "#1c2133" },
            light: { from: "#f2eff7", to: "#eae6f0" },
          },
          weatherEffects: true,
          hudPosition: "top" as HudPosition,
        }),
      setConvoNotificationSound: (v) => set({ convoNotificationSound: v }),
      setRpNotificationSound: (v) => set({ rpNotificationSound: v }),
      setGameNotificationSound: (v) => set({ gameNotificationSound: v }),
      setNotificationSoundsOnlyWhenUnfocused: (v) => set({ notificationSoundsOnlyWhenUnfocused: v }),
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
      setHasMigratedCustomThemesToServer: (v) => set({ hasMigratedCustomThemesToServer: v }),
      clearLegacyCustomThemes: () => set({ customThemes: [], activeCustomTheme: null }),
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
      setHasMigratedExtensionsToServer: (v) => set({ hasMigratedExtensionsToServer: v }),
      clearLegacyExtensions: () => set({ installedExtensions: [] }),
      setHasCompletedOnboarding: (v) => set({ hasCompletedOnboarding: v }),
      setGameTutorialDisabled: (v) => set({ gameTutorialDisabled: v }),
      dismissLinkApiBanner: () => set({ linkApiBannerDismissed: true }),
      toggleEchoChamber: () => set((s) => ({ echoChamberOpen: !s.echoChamberOpen })),
      setEchoChamberSide: (side) => set({ echoChamberSide: side }),
      setUserStatus: (status) => set({ userStatus: status }),
      setUserStatusManual: (status) => set({ userStatusManual: status, userStatus: status }),
      setUserActivity: (activity) => set({ userActivity: activity.slice(0, USER_ACTIVITY_MAX_LENGTH) }),
      rememberUserActivity: (activity) =>
        set((state) => {
          const normalized = normalizeUserActivity(activity);
          if (!normalized) return { recentUserActivities: state.recentUserActivities };
          return {
            recentUserActivities: [
              normalized,
              ...state.recentUserActivities.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
            ].slice(0, RECENT_USER_ACTIVITY_LIMIT),
          };
        }),
    }),
    {
      name: "marinara-engine-ui",
      version: 67,
      // Debounce localStorage writes to avoid sync I/O on every state change
      storage: createJSONStorage(() => {
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

        // Flush pending writes before the tab closes
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
      }),
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
        // v4 → v5: add RP notification sound default
        if (version <= 4) {
          if (persisted.rpNotificationSound === undefined) {
            persisted.rpNotificationSound = true;
          }
        }
        // v5 → v6: add text appearance settings
        if (version <= 5) {
          if (persisted.narrationFontColor === undefined) persisted.narrationFontColor = "";
          if (persisted.narrationOpacity === undefined) persisted.narrationOpacity = 80;
          if (persisted.chatFontColor === undefined) persisted.chatFontColor = "";
          if (persisted.chatFontOpacity === undefined) persisted.chatFontOpacity = 90;
          if (persisted.textStrokeWidth === undefined) persisted.textStrokeWidth = 0.5;
          if (persisted.textStrokeColor === undefined) persisted.textStrokeColor = "#000000";
        }
        // v6 → v7: add legacy theme migration completion flag
        if (version <= 6) {
          if (persisted.hasMigratedCustomThemesToServer === undefined) {
            persisted.hasMigratedCustomThemesToServer = false;
          }
        }
        // v7 → v8: persist right panel width
        if (version <= 7) {
          if (persisted.rightPanelWidth === undefined) {
            persisted.rightPanelWidth = 320;
          }
          if (persisted.sidebarWidth === 280) {
            persisted.sidebarWidth = 320;
          }
        }
        // v8 → v9: add roleplay avatar layout setting
        if (version <= 8) {
          if (persisted.roleplayAvatarStyle === undefined) {
            persisted.roleplayAvatarStyle = "circles";
          }
        }
        // v9 → v10: add Game mode avatar/sprite scale.
        if (version <= 9) {
          if (persisted.gameAvatarScale === undefined) {
            persisted.gameAvatarScale = 1;
          }
        }
        // v10 → v11: convert flat convoGradientFrom/To into per-scheme nested object.
        if (version <= 10) {
          if ("convoGradientFrom" in persisted || "convoGradientTo" in persisted) {
            const oldFrom = persisted.convoGradientFrom ?? "#0a0a0e";
            const oldTo = persisted.convoGradientTo ?? "#1c2133";
            persisted.convoGradient = {
              dark: { from: oldFrom, to: oldTo },
              light: { from: "#f2eff7", to: "#eae6f0" },
            };
            delete persisted.convoGradientFrom;
            delete persisted.convoGradientTo;
          }
        }
        // v11 -> v12: add Game mode dialogue display layout.
        if (version <= 11) {
          if (persisted.gameDialogueDisplayMode === undefined) {
            persisted.gameDialogueDisplayMode = "classic";
          }
        }
        // v12 -> v13: image generation prompt review and default canvas sizes.
        if (version <= 12) {
          if (persisted.reviewImagePromptsBeforeSend === undefined) {
            persisted.reviewImagePromptsBeforeSend = false;
          }
          if (persisted.imageBackgroundWidth === undefined) persisted.imageBackgroundWidth = 1280;
          if (persisted.imageBackgroundHeight === undefined) persisted.imageBackgroundHeight = 720;
          if (persisted.imageIllustrationWidth === undefined) persisted.imageIllustrationWidth = 896;
          if (persisted.imageIllustrationHeight === undefined) persisted.imageIllustrationHeight = 1280;
          if (persisted.imagePortraitWidth === undefined) persisted.imagePortraitWidth = 1024;
          if (persisted.imagePortraitHeight === undefined) persisted.imagePortraitHeight = 1024;
          if (persisted.imageSelfieWidth === undefined) persisted.imageSelfieWidth = 896;
          if (persisted.imageSelfieHeight === undefined) persisted.imageSelfieHeight = 1152;
        }
        // v13 -> v14: add optional custom user activity text for Conversation status.
        if (version <= 13) {
          if (persisted.userActivity === undefined) {
            persisted.userActivity = "";
          }
        }
        // v14 -> v15: remember reusable custom Game setup options.
        if (version <= 14) {
          if (persisted.learnedGameSetupOptions === undefined) {
            persisted.learnedGameSetupOptions = DEFAULT_GAME_SETUP_LEARNED_OPTIONS;
          }
        }
        // v15 -> v16: add impersonate settings and opt-in output cleanup for incomplete final sentences.
        if (version <= 15) {
          if (persisted.impersonatePromptTemplate === undefined) persisted.impersonatePromptTemplate = "";
          if (persisted.impersonateShowQuickButton === undefined) persisted.impersonateShowQuickButton = false;
          if (persisted.impersonatePresetId === undefined) persisted.impersonatePresetId = null;
          if (persisted.impersonateConnectionId === undefined) persisted.impersonateConnectionId = null;
          if (persisted.impersonateBlockAgents === undefined) persisted.impersonateBlockAgents = false;
          if (persisted.trimIncompleteModelOutput === undefined) {
            persisted.trimIncompleteModelOutput = false;
          }
        }
        // v16 -> v17: opt-in intuitive swipe/reroll shortcuts.
        if (version <= 16) {
          if (persisted.intuitiveSwipeNavigation === undefined) {
            persisted.intuitiveSwipeNavigation = false;
          }
          if (persisted.intuitiveSwipeRerollLatest === undefined) {
            persisted.intuitiveSwipeRerollLatest = false;
          }
        }
        // v17 -> v18: add legacy extension migration completion flag.
        if (version <= 17) {
          if (persisted.hasMigratedExtensionsToServer === undefined) {
            persisted.hasMigratedExtensionsToServer = false;
          }
        }
        // v18 -> v19: add impersonate CYOA opt-in and split full-body sprite scale from portrait scale.
        if (version <= 18) {
          if (persisted.impersonateCyoaChoices === undefined) persisted.impersonateCyoaChoices = false;
          if (persisted.gameFullBodySpriteScale === undefined) {
            persisted.gameFullBodySpriteScale = 1.35;
          }
        }
        // v19 -> v20: add global Spotify mini player controls.
        if (version <= 19) {
          if (persisted.spotifyPlayerEnabled === undefined) persisted.spotifyPlayerEnabled = false;
          if (persisted.spotifyMobileWidgetCollapsed === undefined) persisted.spotifyMobileWidgetCollapsed = true;
          if (persisted.spotifyMobileWidgetPosition === undefined) {
            persisted.spotifyMobileWidgetPosition = { x: 16, y: 96 };
          }
        }
        // v20 -> v21: remember Game setup free-text fields and learned preference chips.
        if (version <= 20) {
          const learned =
            persisted.learnedGameSetupOptions && typeof persisted.learnedGameSetupOptions === "object"
              ? persisted.learnedGameSetupOptions
              : {};
          persisted.learnedGameSetupOptions = {
            ...DEFAULT_GAME_SETUP_LEARNED_OPTIONS,
            ...learned,
            preferences: Array.isArray(learned.preferences) ? learned.preferences : [],
          };
          if (persisted.rememberedGameSetupText === undefined) {
            persisted.rememberedGameSetupText = DEFAULT_GAME_SETUP_REMEMBERED_TEXT;
          } else {
            persisted.rememberedGameSetupText = {
              playerGoals: normalizeRememberedGameSetupText(persisted.rememberedGameSetupText.playerGoals),
              preferences: normalizeRememberedGameSetupText(persisted.rememberedGameSetupText.preferences),
            };
          }
        }
        // v21 -> v22: add the optional centralized tracker sidebar.
        if (version <= 21) {
          if (persisted.trackerPanelOpen === undefined) persisted.trackerPanelOpen = false;
          if (persisted.trackerPanelSide === undefined) persisted.trackerPanelSide = "right";
          if (persisted.trackerPanelEnabled === undefined) persisted.trackerPanelEnabled = true;
          if (persisted.trackerPanelHideHudWidgets === undefined) persisted.trackerPanelHideHudWidgets = false;
        }
        // v22 -> v23: persist the desktop tracker sidebar width.
        if (version <= 22) {
          persisted.trackerPanelWidth = clampTrackerPanelWidth(persisted.trackerPanelWidth);
        }
        // v23 -> v24: remember collapsed tracker data panels.
        if (version <= 23) {
          persisted.trackerPanelCollapsedSections = normalizeTrackerPanelCollapsedSections(
            persisted.trackerPanelCollapsedSections,
          );
        }
        persisted.trackerPanelCollapsedSections = normalizeTrackerPanelCollapsedSections(
          persisted.trackerPanelCollapsedSections,
        );
        // v24 -> v25: require an explicit tracker-panel opt-in before expression sprites replace portraits.
        if (version <= 24 && persisted.trackerPanelUseExpressionSprites === undefined) {
          persisted.trackerPanelUseExpressionSprites = false;
        }
        if (persisted.trackerPanelUseExpressionSprites === undefined) {
          persisted.trackerPanelUseExpressionSprites = false;
        }
        // v25 -> v26: allow users to reorder tracker panel cards.
        if (version <= 25) {
          persisted.trackerPanelSectionOrder = normalizeTrackerPanelSectionOrder(persisted.trackerPanelSectionOrder);
        }
        persisted.trackerPanelSectionOrder = normalizeTrackerPanelSectionOrder(persisted.trackerPanelSectionOrder);
        // v26 -> v27: add Roleplay avatar and default sprite scale controls.
        if (version <= 26) {
          if (persisted.roleplayAvatarScale === undefined) {
            persisted.roleplayAvatarScale = 1;
          }
          if (persisted.roleplaySpriteScale === undefined) {
            persisted.roleplaySpriteScale = 1;
          }
        }
        if (persisted.roleplayAvatarsScrollable === undefined) {
          persisted.roleplayAvatarsScrollable = false;
        }
        // v27 -> v28: enable Up-Arrow recall of the last user message by default.
        if (version <= 27 && persisted.editLastMessageOnArrowUp === undefined) {
          persisted.editLastMessageOnArrowUp = true;
        }
        // v28 -> v29: preserve existing Impersonate quick-button users by moving them into Quick replies.
        if (
          version <= 28 &&
          persisted.showQuickRepliesMenu === undefined &&
          persisted.impersonateShowQuickButton === true
        ) {
          persisted.showQuickRepliesMenu = true;
          persisted.showQuickReplyPostOnly = false;
          persisted.showQuickReplyGuide = false;
          persisted.showQuickReplyImpersonate = true;
        }
        // v29 -> v30: allow users to disable the rare Chibi Professor Mari toast.
        if (version <= 29 && persisted.chibiProfessorMariEnabled === undefined) {
          persisted.chibiProfessorMariEnabled = true;
        }
        // v30 -> v31: persist Chat Summary popover source and display controls.
        if (version <= 30) {
          persisted.summaryPopoverSettings = normalizeSummaryPopoverSettings(persisted.summaryPopoverSettings);
        }
        persisted.summaryPopoverSettings = normalizeSummaryPopoverSettings(persisted.summaryPopoverSettings);
        // v31 -> v32: add native chat/game background blur.
        if (version <= 31 && persisted.chatBackgroundBlur === undefined) {
          persisted.chatBackgroundBlur = 0;
        }
        // v32 -> v33: make tracker character thought placement an explicit user preference.
        if (version <= 32) {
          persisted.trackerPanelThoughtBubbleDisplay = normalizeTrackerThoughtBubbleDisplay(
            persisted.trackerPanelThoughtBubbleDisplay,
          );
        }
        persisted.trackerPanelThoughtBubbleDisplay = normalizeTrackerThoughtBubbleDisplay(
          persisted.trackerPanelThoughtBubbleDisplay,
        );
        // v33 -> v34: replace arbitrary tracker desktop widths with curated size profiles.
        if (version <= 33) {
          persisted.trackerPanelSizeProfile = normalizeTrackerPanelSizeProfile(
            persisted.trackerPanelSizeProfile,
            persisted.trackerPanelWidth,
          );
        }
        persisted.trackerPanelSizeProfile = normalizeTrackerPanelSizeProfile(
          persisted.trackerPanelSizeProfile,
          persisted.trackerPanelWidth,
        );
        // v34 -> v35: tracker-only temperature display unit.
        if (version <= 34) {
          persisted.trackerTemperatureUnit = normalizeTrackerTemperatureUnit(persisted.trackerTemperatureUnit);
        }
        persisted.trackerTemperatureUnit = normalizeTrackerTemperatureUnit(persisted.trackerTemperatureUnit);
        // v35 -> v36: optional always-visible docked tracker thoughts.
        if (version <= 35 && persisted.trackerPanelDockedThoughtsAlwaysVisible === undefined) {
          persisted.trackerPanelDockedThoughtsAlwaysVisible = false;
        }
        if (persisted.trackerPanelDockedThoughtsAlwaysVisible === undefined) {
          persisted.trackerPanelDockedThoughtsAlwaysVisible = false;
        }
        // v36 -> v37: user-selectable straight or typographic quote formatting.
        if (version <= 36) {
          persisted.quoteFormat = normalizeQuoteFormat(persisted.quoteFormat);
        }
        persisted.quoteFormat = normalizeQuoteFormat(persisted.quoteFormat);
        // v37 -> v38: customizable image style profiles.
        if (version <= 37) {
          persisted.imageStyleProfiles = normalizeImageStyleProfileSettings(
            persisted[IMAGE_STYLE_PROFILES_STORAGE_KEY] ?? persisted.imageStyleProfiles,
          );
        }
        persisted.imageStyleProfiles = normalizeImageStyleProfileSettings(persisted.imageStyleProfiles);
        // v38 -> v39: opt-in browser notifications for background replies.
        if (version <= 38 && persisted.conversationBrowserNotifications === undefined) {
          persisted.conversationBrowserNotifications = false;
        }
        // v39 -> v40: selectable Conversation message layout.
        persisted.conversationMessageStyle = normalizeConversationMessageStyle(persisted.conversationMessageStyle);
        // v40 -> v41: reconcile parallel v40 UI preference additions.
        if (persisted.editMessageOnDoubleClick === undefined) {
          persisted.editMessageOnDoubleClick = true;
        }
        // v40 -> v41: separate Illustrator/scene illustration canvas from backgrounds.
        if (version <= 40) {
          if (persisted.imageIllustrationWidth === undefined) persisted.imageIllustrationWidth = 896;
          if (persisted.imageIllustrationHeight === undefined) persisted.imageIllustrationHeight = 1280;
        }
        // v41 -> v42: Game mode gets its own turn-loaded notification sound setting.
        if (version <= 41 && persisted.gameNotificationSound === undefined) {
          persisted.gameNotificationSound = true;
        }
        // v62 -> v63: optional focus-aware notification sounds.
        if (version <= 62 && persisted.notificationSoundsOnlyWhenUnfocused === undefined) {
          persisted.notificationSoundsOnlyWhenUnfocused = false;
        }
        // v63 -> v64: add the offline Custom music player volume.
        if (version <= 63 && typeof persisted.localMusicPlayerVolume !== "number") {
          persisted.localMusicPlayerVolume = 70;
        }
        // v64 -> v65: queue image generation requests by default for provider compatibility.
        if (version <= 64 && persisted.queueImageGenerationRequests === undefined) {
          persisted.queueImageGenerationRequests = true;
        }

        if (version <= 65 && persisted.includeReasoningInExports === undefined) {
          persisted.includeReasoningInExports = false;
        }
        // v42 -> v44: reconcile parallel v43 UI preference additions.
        if (version <= 43 && persisted.youtubePlayerEnabled === undefined) {
          persisted.youtubePlayerEnabled = true;
        }
        if (version <= 43) {
          persisted.trackerPanelBackgroundColor = normalizeTrackerPanelBackgroundColor(
            persisted.trackerPanelBackgroundColor,
          );
        }
        persisted.trackerPanelBackgroundColor = normalizeTrackerPanelBackgroundColor(
          persisted.trackerPanelBackgroundColor,
        );
        if (version <= 44) {
          const spotifyEnabled = persisted.spotifyPlayerEnabled === true;
          const youtubeEnabled = persisted.youtubePlayerEnabled !== false;
          if (
            persisted.musicPlayerSource !== "spotify" &&
            persisted.musicPlayerSource !== "youtube" &&
            persisted.musicPlayerSource !== "custom"
          ) {
            persisted.musicPlayerSource = spotifyEnabled ? "spotify" : "youtube";
          }
          if (persisted.musicPlayerEnabled === undefined) {
            persisted.musicPlayerEnabled = spotifyEnabled || youtubeEnabled;
          }
          persisted.spotifyPlayerEnabled = persisted.musicPlayerEnabled && persisted.musicPlayerSource === "spotify";
          persisted.youtubePlayerEnabled = persisted.musicPlayerEnabled && persisted.musicPlayerSource === "youtube";
        }
        if (version <= 45) {
          persisted.appAccentColor = normalizeAppAccentColor(persisted.appAccentColor);
        }
        if (version <= 46 && typeof persisted.youtubePlayerVolume !== "number") {
          persisted.youtubePlayerVolume = 70;
        }
        if (version <= 47 && persisted.chatChromeTextColor === undefined) {
          persisted.chatChromeTextColor = "";
        }
        if (version <= 48 && !Array.isArray(persisted.recentUserActivities)) {
          persisted.recentUserActivities = [];
        }
        if (version <= 49 && persisted.defaultRoleplayBackground === undefined) {
          persisted.defaultRoleplayBackground = DEFAULT_ROLEPLAY_BACKGROUND_URL;
        }
        if (version <= 50 && persisted.achievementsEnabled === undefined) {
          persisted.achievementsEnabled = true;
        }
        if (version <= 52 && persisted.convertLatexSymbols === undefined) {
          persisted.convertLatexSymbols = true;
        }
        if (version <= 57 && persisted.appAccentRgbMode === undefined) {
          persisted.appAccentRgbMode = false;
        }
        if (version <= 58 && persisted.appBackgroundColor === undefined) {
          persisted.appBackgroundColor = "";
        }
        if (version <= 59 && persisted.appAccentRgbMode === undefined) {
          persisted.appAccentRgbMode = false;
        }
        if (version <= 60 && persisted.appAccentColorBeforeRgbMode === undefined) {
          persisted.appAccentColorBeforeRgbMode = null;
        }
        if (version <= 60 && persisted.appAccentPulseMode === undefined) {
          persisted.appAccentPulseMode = false;
        }
        if (
          version <= 61 &&
          persisted.appAccentRgbMode === true &&
          persisted.appAccentColor === RAINBOW_GRADIENT_PRESET &&
          persisted.appAccentColorBeforeRgbMode !== null &&
          persisted.appAccentColorBeforeRgbMode !== undefined
        ) {
          persisted.appAccentColor = persisted.appAccentColorBeforeRgbMode;
          persisted.appAccentColorBeforeRgbMode = null;
        }
        persisted.characterLibrarySort = normalizeCharacterLibrarySort(persisted.characterLibrarySort);
        persisted.characterPanelSearch = normalizePanelText(persisted.characterPanelSearch);
        persisted.characterPanelIncludedTags = normalizePanelStringArray(persisted.characterPanelIncludedTags);
        persisted.characterPanelExcludedTags = normalizePanelStringArray(persisted.characterPanelExcludedTags);
        persisted.characterPanelTagsExpanded = persisted.characterPanelTagsExpanded === true;
        persisted.characterPanelFavoriteFilter = normalizeCharacterPanelFavoriteFilter(persisted.characterPanelFavoriteFilter);
        persisted.characterPanelScrollTop = normalizeScrollTop(persisted.characterPanelScrollTop);
        persisted.characterLibraryScrollTop = normalizeScrollTop(persisted.characterLibraryScrollTop);
        persisted.lorebookPanelCategory = normalizeLorebookPanelCategory(persisted.lorebookPanelCategory);
        persisted.lorebookPanelSearch = normalizePanelText(persisted.lorebookPanelSearch);
        persisted.lorebookPanelSort = normalizeLorebookPanelSort(persisted.lorebookPanelSort);
        persisted.lorebookPanelActiveTag =
          typeof persisted.lorebookPanelActiveTag === "string" && persisted.lorebookPanelActiveTag.trim()
            ? persisted.lorebookPanelActiveTag.trim()
            : null;
        persisted.lorebookPanelTagsExpanded = persisted.lorebookPanelTagsExpanded === true;
        persisted.botBrowserPanelSort = normalizeBasicPanelSort(persisted.botBrowserPanelSort);
        persisted.presetPanelSort = normalizeBasicPanelSort(persisted.presetPanelSort);
        persisted.connectionPanelSort = normalizeBasicPanelSort(persisted.connectionPanelSort);
        persisted.agentPanelSort = normalizeBasicPanelSort(persisted.agentPanelSort);
        normalizePersistedMainSurface(persisted);
        if (Array.isArray(persisted.recentUserActivities)) {
          persisted.recentUserActivities = persisted.recentUserActivities
            .filter((activity: unknown): activity is string => typeof activity === "string")
            .map((activity: string) => normalizeUserActivity(activity))
            .filter(Boolean)
            .slice(0, RECENT_USER_ACTIVITY_LIMIT);
        } else {
          persisted.recentUserActivities = [];
        }
        persisted.appAccentColor = normalizeAppAccentColor(persisted.appAccentColor);
        persisted.appAccentColorBeforeRgbMode =
          persisted.appAccentColorBeforeRgbMode === null
            ? null
            : normalizeAppAccentColor(persisted.appAccentColorBeforeRgbMode);
        persisted.appBackgroundColor = normalizeAppBackgroundColor(persisted.appBackgroundColor);
        persisted.appAccentPulseMode = persisted.appAccentPulseMode === true;
        if (version <= 60 && persisted.appAccentRgbMode === true) {
          const persistedTheme = persisted.theme === "light" ? "light" : "dark";
          const persistedAccentSource = persisted.appAccentColor || getDefaultAppAccentColor(persistedTheme);
          if (!isCssGradient(persistedAccentSource)) {
            persisted.appAccentPulseMode = true;
            persisted.appAccentRgbMode = false;
          }
        }
        if (version <= 66 && persisted.customCursorEnabled === undefined) {
          persisted.customCursorEnabled = true;
        }
        persisted.appAccentRgbMode = persisted.appAccentRgbMode === true;
        persisted.customCursorEnabled = persisted.customCursorEnabled !== false;
        persisted.includeReasoningInExports = persisted.includeReasoningInExports === true;
        persisted.chatChromeTextColor = normalizeChatChromeTextColor(persisted.chatChromeTextColor);
        persisted.defaultRoleplayBackground = normalizeDefaultRoleplayBackground(persisted.defaultRoleplayBackground);
        delete persisted.trackerPanelWidth;
        return persisted;
      },
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        rightPanelOpen: state.rightPanelOpen,
        rightPanelWidth: state.rightPanelWidth,
        rightPanel: state.rightPanel,
        settingsTab: state.settingsTab,
        characterDetailId: state.characterDetailId,
        lorebookDetailId: state.lorebookDetailId,
        presetDetailId: state.presetDetailId,
        connectionDetailId: state.connectionDetailId,
        agentDetailId: state.agentDetailId,
        toolDetailId: state.toolDetailId,
        personaDetailId: state.personaDetailId,
        regexDetailId: state.regexDetailId,
        botBrowserOpen: state.botBrowserOpen,
        gameAssetsBrowserOpen: state.gameAssetsBrowserOpen,
        characterLibraryOpen: state.characterLibraryOpen,
        characterLibrarySelectedId: state.characterLibrarySelectedId,
        characterLibrarySort: state.characterLibrarySort,
        characterPanelSearch: state.characterPanelSearch,
        characterPanelIncludedTags: state.characterPanelIncludedTags,
        characterPanelExcludedTags: state.characterPanelExcludedTags,
        characterPanelTagsExpanded: state.characterPanelTagsExpanded,
        characterPanelFavoriteFilter: state.characterPanelFavoriteFilter,
        characterPanelScrollTop: state.characterPanelScrollTop,
        characterLibraryScrollTop: state.characterLibraryScrollTop,
        lorebookPanelCategory: state.lorebookPanelCategory,
        lorebookPanelSearch: state.lorebookPanelSearch,
        lorebookPanelSort: state.lorebookPanelSort,
        lorebookPanelActiveTag: state.lorebookPanelActiveTag,
        lorebookPanelTagsExpanded: state.lorebookPanelTagsExpanded,
        botBrowserPanelSort: state.botBrowserPanelSort,
        presetPanelSort: state.presetPanelSort,
        connectionPanelSort: state.connectionPanelSort,
        agentPanelSort: state.agentPanelSort,
        trackerPanelEnabled: state.trackerPanelEnabled,
        trackerPanelOpen: state.trackerPanelOpen,
        trackerPanelSide: state.trackerPanelSide,
        trackerPanelHideHudWidgets: state.trackerPanelHideHudWidgets,
        trackerPanelUseExpressionSprites: state.trackerPanelUseExpressionSprites,
        trackerPanelThoughtBubbleDisplay: state.trackerPanelThoughtBubbleDisplay,
        trackerPanelDockedThoughtsAlwaysVisible: state.trackerPanelDockedThoughtsAlwaysVisible,
        trackerPanelSizeProfile: state.trackerPanelSizeProfile,
        trackerPanelBackgroundColor: state.trackerPanelBackgroundColor,
        trackerTemperatureUnit: state.trackerTemperatureUnit,
        trackerPanelCollapsedSections: state.trackerPanelCollapsedSections,
        trackerPanelSectionOrder: state.trackerPanelSectionOrder,
        theme: state.theme,
        appBackgroundColor: state.appBackgroundColor,
        appAccentColor: state.appAccentColor,
        appAccentColorBeforeRgbMode: state.appAccentColorBeforeRgbMode,
        appAccentPulseMode: state.appAccentPulseMode,
        appAccentRgbMode: state.appAccentRgbMode,
        customCursorEnabled: state.customCursorEnabled,
        chatBackground: state.chatBackground,
        defaultRoleplayBackground: state.defaultRoleplayBackground,
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
        queueImageGenerationRequests: state.queueImageGenerationRequests,
        reviewImagePromptsBeforeSend: state.reviewImagePromptsBeforeSend,
        imageBackgroundWidth: state.imageBackgroundWidth,
        imageBackgroundHeight: state.imageBackgroundHeight,
        imageIllustrationWidth: state.imageIllustrationWidth,
        imageIllustrationHeight: state.imageIllustrationHeight,
        imagePortraitWidth: state.imagePortraitWidth,
        imagePortraitHeight: state.imagePortraitHeight,
        imageSelfieWidth: state.imageSelfieWidth,
        imageSelfieHeight: state.imageSelfieHeight,
        imageStyleProfiles: state.imageStyleProfiles,

        messageGrouping: state.messageGrouping,
        conversationMessageStyle: state.conversationMessageStyle,
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
        includeReasoningInExports: state.includeReasoningInExports,
        messagesPerPage: state.messagesPerPage,
        boldDialogue: state.boldDialogue,
        quoteFormat: state.quoteFormat,
        convertLatexSymbols: state.convertLatexSymbols,
        trimIncompleteModelOutput: state.trimIncompleteModelOutput,
        speechToTextEnabled: state.speechToTextEnabled,
        chibiProfessorMariEnabled: state.chibiProfessorMariEnabled,
        achievementsEnabled: state.achievementsEnabled,
        musicPlayerEnabled: state.musicPlayerEnabled,
        musicPlayerSource: state.musicPlayerSource,
        spotifyPlayerEnabled: state.spotifyPlayerEnabled,
        youtubePlayerEnabled: state.youtubePlayerEnabled,
        youtubePlayerVolume: state.youtubePlayerVolume,
        localMusicPlayerVolume: state.localMusicPlayerVolume,
        spotifyMobileWidgetCollapsed: state.spotifyMobileWidgetCollapsed,
        spotifyMobileWidgetPosition: state.spotifyMobileWidgetPosition,
        intuitiveSwipeNavigation: state.intuitiveSwipeNavigation,
        intuitiveSwipeRerollLatest: state.intuitiveSwipeRerollLatest,
        editLastMessageOnArrowUp: state.editLastMessageOnArrowUp,
        editMessageOnDoubleClick: state.editMessageOnDoubleClick,
        summaryPopoverSettings: state.summaryPopoverSettings,
        narrationFontColor: state.narrationFontColor,
        narrationOpacity: state.narrationOpacity,
        chatFontColor: state.chatFontColor,
        chatChromeTextColor: state.chatChromeTextColor,
        chatFontOpacity: state.chatFontOpacity,
        roleplayAvatarStyle: state.roleplayAvatarStyle,
        roleplayAvatarScale: state.roleplayAvatarScale,
        roleplayAvatarsScrollable: state.roleplayAvatarsScrollable,
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
        hasMigratedCustomThemesToServer: state.hasMigratedCustomThemesToServer,
        activeCustomTheme: state.activeCustomTheme,
        customThemes: state.customThemes,
        installedExtensions: state.installedExtensions,
        hasMigratedExtensionsToServer: state.hasMigratedExtensionsToServer,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        linkApiBannerDismissed: state.linkApiBannerDismissed,
        echoChamberOpen: state.echoChamberOpen,
        echoChamberSide: state.echoChamberSide,
        userStatusManual: state.userStatusManual,
        userStatus: state.userStatus,
        userActivity: state.userActivity,
        recentUserActivities: state.recentUserActivities,
        convoNotificationSound: state.convoNotificationSound,
        rpNotificationSound: state.rpNotificationSound,
        gameNotificationSound: state.gameNotificationSound,
        notificationSoundsOnlyWhenUnfocused: state.notificationSoundsOnlyWhenUnfocused,
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
      }),
    },
  ),
);
