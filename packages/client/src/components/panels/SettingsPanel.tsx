// ──────────────────────────────────────────────
// Panel: Settings (polished)
// ──────────────────────────────────────────────
import {
  TRACKER_DATA_PANEL_SECTIONS,
  TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
  QUICK_REPLIES_SETTINGS_CONTROL_ID,
  useUIStore,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  RIGHT_PANEL_WIDTH_MAX,
  getDefaultAppAccentColor,
  getDefaultAppBackgroundColor,
  getDefaultChatChromeTextColor,
  getDefaultChatTextColor,
  getTrackerPanelWidthForProfile,
  type ChatWidgetPreset,
  type ChatWidgetShape,
  type ConversationAvatarShape,
  type ConversationMessageStyle,
  type GameDialogueDisplayMode,
  type ChatListBackgroundMode,
  type RoleplayAvatarStyle,
  type RoleplayChatPosition,
  type TrackerDataPanelSection,
  type TrackerPanelSizeProfile,
  type TrackerStatDisplayMode,
  type TrackerThoughtBubbleDisplay,
  type VisualTheme,
} from "../../stores/ui.store";
import { UILanguageSetting } from "./settings/UILanguageSetting";
import { MultiplayerSettings } from "../../features/multiplayer/MultiplayerSettings";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import {
  SETTINGS_SEARCHABLE_CONTROLS,
  SETTINGS_SECTION_BY_ID,
  SETTINGS_SECTIONS,
  isOmnibarSettingsTarget,
  searchSettings,
  type SettingsSearchResult,
  type SettingsSectionId,
  type SettingsSectionMeta,
  type SettingsTabId,
} from "../../lib/settings-registry";
import { cn, copyToClipboard } from "../../lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ADMIN_SECRET_STORAGE_KEY,
  ApiError,
  api,
  getPrivilegedActionErrorMessage,
  isRequestTimeoutError,
  requestTimeoutSignal,
} from "../../lib/api-client";
import { ANDROID_BRIDGE_READY_EVENT, getAndroidBridgeToken } from "../../lib/android-bridge";
import { chatBackgroundUrlToMetadata } from "../../lib/backgrounds";
import { normalizeThemeCss, sanitizeAppCss } from "../../lib/theme-css";
import { getChatWidgetFontFamily } from "../../lib/font-family";
import { forceRefreshSpa } from "@/lib/browser-runtime";
import {
  formatProfileImportWarningDetails,
  formatProfileImportWarningSummary,
  normalizeProfileImportWarnings,
  type ProfileImportWarningCopy,
  type ProfileImportWarning,
} from "@/lib/profile-import-warnings";
import React, { Activity, useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  APP_VERSION,
  CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS,
  DEFAULT_IMAGE_STYLE_PROFILES,
  VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX,
  VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN,
  VIDEO_CALL_CLIP_DURATION_MAX,
  VIDEO_CALL_CLIP_DURATION_MIN,
  VIDEO_GENERATION_SETTINGS_KEY,
  VIDEO_SCENE_DURATION_MAX,
  VIDEO_SCENE_DURATION_MIN,
  compileImagePrompt,
  normalizeImageStyleProfileSettings,
  normalizeVideoGenerationUserSettings,
  createFolderEntry,
  getFolderImportEntries,
  getFolderManifestConfig,
  type AppSettingsResponse,
  type APIConnection,
  type ConversationCallCharacterVideoClipKind,
  type ImagePromptKind,
  type ImagePromptMode,
  type ImageStyleProfile,
  type ImageStyleProfileSettings,
  type QuoteFormat,
  type SidecarHealthSection,
  type Theme,
  type VideoGenerationUserSettings,
} from "@marinara-engine/shared";
import {
  findDuplicateTheme,
  useCreateTheme,
  useDeleteTheme,
  useSetActiveTheme,
  useThemes,
  useUpdateTheme,
} from "../../hooks/use-themes";
import {
  ArrowDown,
  ArrowUp,
  Upload,
  X,
  Image,
  Trash2,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Palette,
  Puzzle,
  CloudRain,
  FileCode2,
  FileText,
  Power,
  Paintbrush,
  AlertTriangle,
  ShieldAlert,
  Tag,
  Code,
  Plus,
  Save,
  Eye,
  EyeOff,
  Download,
  Dock,
  FolderOpen,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  ScrollText,
  UserCheck,
  WandSparkles,
  Terminal,
  Film,
  Settings2,
  Bell,
  Copy,
  BookOpen,
  BarChart3,
  Gauge,
  HardDrive,
  LifeBuoy,
  SlidersHorizontal,
  ToggleRight,
  Wrench,
} from "lucide-react";
import {
  useChat,
  useClearAllData,
  useExpungeData,
  useUpdateChatMetadata,
  type ExpungeScope,
} from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useChatStore } from "../../stores/chat.store";
import { parseChatMetadata } from "../../lib/chat-display";
import { useOpenGameAssetsFolder, useRescanGameAssets } from "../../hooks/use-game-assets";
import { chatKeys } from "../../hooks/use-chats";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { useDocsLanguage, useFixDocsLanguage, useSetDocsLanguage } from "../../hooks/use-docs-language";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ColorPicker } from "../ui/ColorPicker";
import { getChatWidgetColorRoles, getChatWidgetColorStyle, type ChatWidgetColors } from "../../lib/chat-widget-colors";
import { EmojiPicker } from "../ui/EmojiPicker";
import { TrackerPanelIcon } from "../ui/TrackerPanelIcon";
import { TrackerSizeTierIcon } from "../ui/TrackerSizeTierIcon";
import {
  ConversationSoundSetting,
  SETTINGS_BUTTON_CLASS,
  SETTINGS_CHOICE_CARD_CLASS,
  SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS,
  SETTINGS_ICON_BUTTON_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_PRIMARY_FULL_BUTTON_CLASS,
  SettingsIntro,
  SettingsSection,
  SettingsSwitch,
  ToggleSetting,
} from "./settings/SettingControls";
import { TrackerCardColorSettings } from "./settings/TrackerCardColorSettings";
import { PromptOverridesEditor } from "./settings/PromptOverridesEditor";
import { BackgroundPicker } from "./settings/BackgroundPicker";
import { RequestTimeoutSettings } from "./settings/RequestTimeoutSettings";
import { FEATURE_SWITCHES_CONTROL_ID, FeatureSwitchesSettings } from "./settings/FeatureSwitchesSettings";
import { CustomGenerationParametersSettings } from "./settings/CustomGenerationParametersSettings";
import { ExternalExtensionsSettings, PersonalExtensionsSettings } from "./settings/PersonalExtensionsSettings";
import { usePersonalExtensionPolicy, useSetExternalExtensionsEnabled } from "../../hooks/use-personal-extensions";
import { useAgentImportPolicy, useSetAgentImportsEnabled } from "../../hooks/use-agents";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { inspectCharacterFilesForEmbeddedLorebooks } from "../../lib/character-import";
import { getClientRuntimeDiagnostics } from "../../lib/client-runtime-diagnostics";
import {
  detectBrowserGpu,
  formatSupportDiagnostics,
  resolveClientOs,
  type SupportDiagnostics,
} from "../../lib/support-diagnostics";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { saveExportFile } from "../../lib/file-download";
import {
  HOST_DEVICE_FILE_MANAGER_MESSAGE,
  HostDeviceFileManagerError,
  isHostDeviceBrowser,
} from "../../lib/host-device";

type CustomFontFace = {
  filename: string;
  family: string;
  url: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
};

const TABS = [
  {
    id: "general",
    label: "General",
    labelKey: "settings.tabs.general.label",
    icon: Settings2,
    description: "App behavior, responses, input, and playback.",
    descriptionKey: "settings.tabs.general.description",
  },
  {
    id: "appearance",
    label: "Appearance",
    labelKey: "settings.tabs.appearance.label",
    icon: Palette,
    description: "Theme, chat display, art, motion, and backgrounds.",
    descriptionKey: "settings.tabs.appearance.description",
  },
  {
    id: "generations",
    label: "Generations",
    labelKey: "settings.tabs.generations.label",
    icon: WandSparkles,
    description: "Image/video defaults and prompt templates.",
    descriptionKey: "settings.tabs.generations.description",
  },
  {
    id: "addons",
    label: "Addons",
    labelKey: "settings.tabs.addons.label",
    icon: Puzzle,
    description: "Personal Extensions and custom themes.",
    descriptionKey: "settings.tabs.addons.description",
  },
  {
    id: "import",
    label: "Imports",
    labelKey: "settings.tabs.imports.label",
    icon: Download,
    description: "Imports, asset folders, and data transfer.",
    descriptionKey: "settings.tabs.imports.description",
  },
  {
    id: "advanced",
    label: "Advanced",
    labelKey: "settings.tabs.advanced.label",
    icon: Terminal,
    description: "Admin access, updates, tools, backups, and danger zone.",
    descriptionKey: "settings.tabs.advanced.description",
  },
] as const satisfies readonly { id: SettingsTabId; [key: string]: unknown }[];
// `satisfies` above rejects an unknown tab id; this rejects a missing one.
// Operand order matters: the rendered ids must cover the registry, not the other
// way round, or deleting a tab from TABS still type-checks.
type _EveryTabIsRendered =
  Record<(typeof TABS)[number]["id"], true> extends Record<SettingsTabId, true>
    ? true
    : ["TABS is missing a settings tab", Exclude<SettingsTabId, (typeof TABS)[number]["id"]>];
const _everyTabIsRendered: _EveryTabIsRendered = true;
void _everyTabIsRendered;

type MarinaraAndroidBridge = {
  openLauncher?: (token?: string) => void;
  openConsole?: {
    (token: string): void;
    (): void;
  };
  isStatusBarVisible?: {
    (token: string): boolean;
    (): boolean;
  };
  setStatusBarVisible?: {
    (token: string, visible: boolean): void;
    (visible: boolean): void;
  };
};

function getMarinaraAndroidBridge(): MarinaraAndroidBridge | null {
  if (typeof window === "undefined") return null;
  const nativeWindow = window as Window & { MarinaraAndroid?: MarinaraAndroidBridge };
  return nativeWindow.MarinaraAndroid ?? null;
}

function isMarinaraAndroidShell(): boolean {
  return typeof navigator !== "undefined" && /\bMarinaraEngine\/Android\b/u.test(navigator.userAgent);
}

function readAndroidStatusBarVisibility(): boolean | null {
  const bridge = getMarinaraAndroidBridge();
  if (typeof bridge?.isStatusBarVisible !== "function") return null;
  try {
    const token = getAndroidBridgeToken();
    return token ? bridge.isStatusBarVisible(token) : bridge.isStatusBarVisible();
  } catch {
    return null;
  }
}

function updateAndroidStatusBarVisibility(visible: boolean): boolean {
  const bridge = getMarinaraAndroidBridge();
  if (typeof bridge?.setStatusBarVisible !== "function") return false;
  try {
    const token = getAndroidBridgeToken();
    if (token) bridge.setStatusBarVisible(token, visible);
    else bridge.setStatusBarVisible(visible);
    return true;
  } catch {
    return false;
  }
}

function AndroidStatusBarSetting() {
  const { t } = useTranslation();
  const initialVisibility = readAndroidStatusBarVisibility();
  const [visible, setVisible] = useState(initialVisibility ?? false);
  const [supported, setSupported] = useState(initialVisibility !== null);

  useEffect(() => {
    const refreshBridge = () => {
      const nextVisibility = readAndroidStatusBarVisibility();
      if (nextVisibility === null) return;
      setVisible(nextVisibility);
      setSupported(true);
    };
    window.addEventListener(ANDROID_BRIDGE_READY_EVENT, refreshBridge);
    refreshBridge();
    return () => window.removeEventListener(ANDROID_BRIDGE_READY_EVENT, refreshBridge);
  }, []);

  const handleChange = useCallback(
    (nextVisible: boolean) => {
      if (!updateAndroidStatusBarVisibility(nextVisible)) {
        toast.error(t("settings.application.androidStatusBar.error"));
        return;
      }
      setVisible(nextVisible);
    },
    [t],
  );

  let help = t("settings.application.androidStatusBar.unavailable");
  if (supported) {
    help = t("settings.application.androidStatusBar.help");
  } else if (isMarinaraAndroidShell()) {
    help = t("settings.application.androidStatusBar.updateRequired");
  }

  return (
    <>
      <ToggleSetting
        anchorId={getSettingsControlAnchorId("android-status-bar")}
        label={t("settings.application.androidStatusBar.label")}
        checked={visible}
        onChange={handleChange}
        help={help}
        disabled={!supported}
      />
      {typeof getMarinaraAndroidBridge()?.openLauncher === "function" && (
        <button
          type="button"
          className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          onClick={() => getMarinaraAndroidBridge()?.openLauncher?.(getAndroidBridgeToken() ?? undefined)}
        >
          <ExternalLink size="0.8125rem" />
          {t("settings.application.androidLauncher")}
        </button>
      )}
    </>
  );
}

function isStandaloneIosInstall(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const isIos = /\b(iPad|iPhone|iPod)\b/u.test(nav.userAgent);
  const isStandalone = nav.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return isIos && isStandalone;
}

function getNativeConsoleShortcutHelp(): string {
  const bridge = getMarinaraAndroidBridge();
  if (typeof bridge?.openConsole === "function") {
    return "Opens Termux from the Android APK so you can view Marinara server logs while Debug mode is enabled.";
  }
  if (isMarinaraAndroidShell()) {
    return "This Android APK build cannot expose the Termux console shortcut yet. Update Marinara, or open Termux manually.";
  }
  if (isStandaloneIosInstall()) {
    return "iPhone installations do not expose a native console shortcut yet. Use the host server logs or Safari Web Inspector.";
  }
  return "Available in packaged Android/iPhone installations only. Browser and desktop users should use the server terminal or browser developer tools.";
}

const SETTINGS_COMPONENTS: Record<(typeof TABS)[number]["id"], React.FC> = {
  general: React.memo(GeneralSettings),
  appearance: React.memo(AppearanceSettings),
  generations: React.memo(GenerationsSettings),
  addons: React.memo(AddonsSettings),
  import: React.memo(ImportSettings),
  advanced: React.memo(AdvancedSettings),
};

function normalizeSettingsTab(tab: string): (typeof TABS)[number]["id"] {
  if (tab === "themes") return "addons";
  if (tab === "extensions") return "addons";
  if (tab === "import") return "import";
  return TABS.some((entry) => entry.id === tab) ? (tab as (typeof TABS)[number]["id"]) : "general";
}

function getSettingsSectionAnchorId(sectionId: SettingsSectionId) {
  return `settings-section-${sectionId}`;
}

function getSettingsControlAnchorId(controlId: string) {
  return `settings-control-${controlId}`;
}

function SearchableSettingTarget({
  controlId,
  className,
  children,
}: {
  controlId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={getSettingsControlAnchorId(controlId)} className={cn("scroll-mt-3", className)}>
      {children}
    </div>
  );
}

function getSettingsSectionAnchorProps(sectionId: SettingsSectionId) {
  return {
    anchorId: getSettingsSectionAnchorId(sectionId),
  };
}

type SettingsArtPreviewSize = { width: number; height: number };

const SETTINGS_ART_PREVIEW_FRAME = {
  width: 6,
  height: 4,
  gap: 0.75,
} as const;

function fitSettingsArtPreviewSizes(sizes: SettingsArtPreviewSize[]): SettingsArtPreviewSize[] {
  const visibleSizes = sizes.filter((size) => size.width > 0 && size.height > 0);
  if (!visibleSizes.length) return sizes;

  const totalWidth =
    visibleSizes.reduce((sum, size) => sum + size.width, 0) +
    SETTINGS_ART_PREVIEW_FRAME.gap * Math.max(0, visibleSizes.length - 1);
  const maxHeight = Math.max(...visibleSizes.map((size) => size.height));
  const fit = Math.min(1, SETTINGS_ART_PREVIEW_FRAME.width / totalWidth, SETTINGS_ART_PREVIEW_FRAME.height / maxHeight);

  return sizes.map((size) => ({
    width: size.width * fit,
    height: size.height * fit,
  }));
}

function toPreviewRem(value: number) {
  return `${Number(value.toFixed(3))}rem`;
}

const EXPUNGE_SCOPE_OPTIONS: Array<{ id: ExpungeScope; label: string; description: string }> = [
  {
    id: "chats",
    label: "Chats & Messages",
    description: "Chats, folders, messages, scene/OOC data, and chat runtime state.",
  },
  {
    id: "characters",
    label: "Characters",
    description: "Characters and character groups. Professor Mari is always preserved.",
  },
  { id: "personas", label: "Personas", description: "Personas and persona groups." },
  { id: "lorebooks", label: "Lorebooks", description: "Lorebooks and lorebook entries." },
  { id: "presets", label: "Presets", description: "Prompt presets, groups, sections, and variables." },
  { id: "connections", label: "Connections", description: "API connections and model endpoints." },
  {
    id: "automation",
    label: "Automation & Addons",
    description: "Agents, tools, regex scripts, synced themes, and automation state.",
  },
  {
    id: "media",
    label: "Media & Assets",
    description: "Backgrounds, avatars, sprites, gallery items, fonts, and knowledge-source files.",
  },
];

function formatStorageBytes(bytes: number): string {
  const safeBytes = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (safeBytes < 1_000) {
    return new Intl.NumberFormat(undefined, { style: "unit", unit: "byte", unitDisplay: "short" }).format(safeBytes);
  }
  if (safeBytes < 1_000_000) {
    return new Intl.NumberFormat(undefined, {
      style: "unit",
      unit: "kilobyte",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(safeBytes / 1_000);
  }
  if (safeBytes < 1_000_000_000) {
    return new Intl.NumberFormat(undefined, {
      style: "unit",
      unit: "megabyte",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(safeBytes / 1_000_000);
  }
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "gigabyte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(safeBytes / 1_000_000_000);
}

const ROLEPLAY_CHAT_POSITIONS: RoleplayChatPosition[] = ["left", "center", "right"];

const ROLEPLAY_AVATAR_STYLE_OPTIONS: Array<{ id: RoleplayAvatarStyle; label: string; desc: string }> = [
  {
    id: "none",
    label: "None",
    desc: "Hide message avatars and let roleplay bubbles use the full row.",
  },
  {
    id: "circles",
    label: "Small Circles",
    desc: "Compact portrait bubbles beside each roleplay message.",
  },
  {
    id: "rectangles",
    label: "Small Rectangles",
    desc: "Compact side portraits with a taller frame for less top-edge cutoff.",
  },
  {
    id: "panel",
    label: "Glued Side Panel",
    desc: "A taller portrait strip fused into the message bubble.",
  },
];

const CHAT_LIST_BACKGROUND_OPTIONS: Array<{ id: ChatListBackgroundMode; label: string; desc: string }> = [
  {
    id: "hover",
    label: "Active & Hovered",
    desc: "Banner on the chat you are in and the one under the pointer. On touch devices, the active chat only.",
  },
  {
    id: "always",
    label: "Every Row",
    desc: "Banner behind every chat in the list. Loads one downscaled image per chat.",
  },
  { id: "off", label: "Off", desc: "No banners. Chat rows keep the plain sidebar background." },
];

const GAME_DIALOGUE_DISPLAY_OPTIONS: Array<{ id: GameDialogueDisplayMode; label: string; desc: string }> = [
  {
    id: "classic",
    label: "Classic Dialogue Box",
    desc: "One active segment in the dialogue box, with logs available from the Logs button.",
  },
  {
    id: "stacked",
    label: "History Above Dialogue Box",
    desc: "Shows prior segments above the dialogue box and keeps the full session scrollable there.",
  },
];

const TRACKER_THOUGHT_BUBBLE_DISPLAY_OPTIONS: Array<{
  id: TrackerThoughtBubbleDisplay;
  label: string;
  desc: string;
}> = [
  {
    id: "inline",
    label: "Docked",
    desc: "Thoughts open inside the character card for a stable panel shape.",
  },
  {
    id: "floating",
    label: "Floating",
    desc: "Thoughts open as a bubble beside the portrait.",
  },
];

const TRACKER_STAT_DISPLAY_OPTIONS: TrackerStatDisplayMode[] = ["bars", "gauges"];

const TRACKER_PANEL_SIZE_PROFILE_OPTIONS: Array<{
  id: TrackerPanelSizeProfile;
  label: string;
  desc: string;
}> = [
  {
    id: "compact",
    label: "Compact",
    desc: "A narrow reference rail for quick stats and one-column cards.",
  },
  {
    id: "standard",
    label: "Standard",
    desc: "Balanced tracker cards with room for editing and thoughts.",
  },
  {
    id: "expanded",
    label: "Expanded",
    desc: "A roomier board for featured cards, portraits, and full thoughts.",
  },
];

const TRACKER_PANEL_CARD_OPTIONS: Record<TrackerDataPanelSection, { label: string; desc: string }> = {
  world: {
    label: "World State",
    desc: "Date, time, location, weather, and temperature.",
  },
  persona: {
    label: "Persona",
    desc: "Persona status, stats, portrait, and inventory.",
  },
  characters: {
    label: "Characters",
    desc: "Present character cards, stats, portraits, and thoughts.",
  },
  inventory: {
    label: "ui.panels.trackerOrder.inventoryTracker",
    desc: "ui.panels.trackerOrder.inventoryTrackerDescription",
  },
  quests: {
    label: "Quests",
    desc: "Active quest progress and objectives.",
  },
  custom: {
    label: "Custom",
    desc: "Extra tracker fields from custom tracker agents.",
  },
};

const QUOTE_FORMAT_OPTIONS: Array<{ id: QuoteFormat; label: string; sample: string }> = [
  { id: "straight", label: "Straight", sample: '"Hello," it\'s me.' },
  { id: "typographic", label: "Typographic", sample: "\u201cHello,\u201d it\u2019s me." },
];

const GAME_ASSET_CATEGORIES = [
  {
    id: "music",
    label: "Music",
    defaultFolder: "exploration/fantasy/calm",
    accept: "audio/*,.mp3,.ogg,.wav,.flac,.m4a,.aac,.webm",
  },
  {
    id: "ambient",
    label: "Ambient",
    defaultFolder: "nature",
    accept: "audio/*,.mp3,.ogg,.wav,.flac,.m4a,.aac,.webm",
  },
  {
    id: "sfx",
    label: "Sound Effects",
    defaultFolder: "exploration",
    accept: "audio/*,.mp3,.ogg,.wav,.flac,.m4a,.aac,.webm",
  },
  {
    id: "sprites",
    label: "Sprites",
    defaultFolder: "generic-fantasy",
    accept: "image/*,.svg",
  },
  {
    id: "backgrounds",
    label: "Backgrounds",
    defaultFolder: "custom",
    accept: "image/*",
  },
] as const;

const VIDEO_PROMPT_TEMPLATE_KEYS = [
  "game.video",
  "roleplay.galleryVideoDirector",
  "conversation.callVideo.idle",
  "conversation.callVideo.talking",
  "conversation.callVideo.laughing",
  "conversation.callVideo.angry",
  "conversation.callVideo.crying",
  "conversation.callVideo.sighing",
  "conversation.callVideo.custom",
  "sprites.animatedPortrait",
] as const;

const CONVERSATION_CALL_VIDEO_CLIP_LABELS: Record<ConversationCallCharacterVideoClipKind, string> = {
  idle: "Idle loop",
  talking: "Talking loop",
  laughing: "Laughing",
  angry: "Angry",
  crying: "Crying",
  sighing: "Sighing",
};

type GameAssetCategoryId = (typeof GAME_ASSET_CATEGORIES)[number]["id"];
const GAME_ASSET_CATEGORY_BY_ID = new Map(GAME_ASSET_CATEGORIES.map((category) => [category.id, category]));

const IMAGE_STYLE_SUBJECT_KINDS: ImagePromptKind[] = [
  "avatar",
  "portrait",
  "selfie",
  "background",
  "illustration",
  "sprite",
];
const IMAGE_PROMPT_MODE_OPTIONS: Array<{ value: ImagePromptMode; label: string }> = [
  { value: "hybrid", label: "Hybrid" },
  { value: "danbooru", label: "Danbooru tags" },
  { value: "tagged", label: "Tags" },
  { value: "natural", label: "Natural language" },
];

function ImageDimensionRow({
  label,
  help,
  width,
  height,
  onCommit,
  controlId,
}: {
  label: string;
  help: string;
  width: number;
  height: number;
  onCommit: (width: number, height: number) => void;
  controlId?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      id={controlId ? getSettingsControlAnchorId(controlId) : undefined}
      className="grid scroll-mt-3 gap-2 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
          {label}
          <HelpTooltip text={help} />
        </div>
        <div className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.imagedimensionrow.pixelsClampedFrom64To4096")}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:w-40">
        <DraftNumberInput
          value={width}
          ariaLabel={localizeUi("settings.imageDimensions.width", { label })}
          min={64}
          max={4096}
          commitOnValidChange
          onCommit={(nextWidth) => onCommit(nextWidth, height)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
        />
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.imagedimensionrow.x")}
        </span>
        <DraftNumberInput
          value={height}
          ariaLabel={localizeUi("settings.imageDimensions.height", { label })}
          min={64}
          max={4096}
          commitOnValidChange
          onCommit={(nextHeight) => onCommit(width, nextHeight)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

function ImageStyleProfilesEditor({
  value,
  onChange,
}: {
  value: ImageStyleProfileSettings;
  onChange: (settings: ImageStyleProfileSettings) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const settings = normalizeImageStyleProfileSettings(value);
  const [selectedId, setSelectedId] = useState(settings.defaultProfileId);
  const [previewKind, setPreviewKind] = useState<ImagePromptKind>("portrait");
  const [previewPrompt, setPreviewPrompt] = useState(
    "Create a portrait of Mira, anime style, best quality, high quality, detailed eyes. Avoid blurry, text, watermark. no extra fingers",
  );
  const selected = settings.profiles.find((profile) => profile.id === selectedId) ?? settings.profiles[0]!;
  const preview = useMemo(
    () =>
      compileImagePrompt({
        kind: previewKind,
        prompt: previewPrompt,
        styleProfiles: { ...settings, defaultProfileId: selected.id },
        styleProfileId: selected.id,
      }),
    [previewKind, previewPrompt, selected.id, settings],
  );
  const cleanupCount =
    preview.diagnostics.removedPositiveDuplicates.length +
    preview.diagnostics.removedNegativeDuplicates.length +
    preview.diagnostics.movedNegativeFragments.length;

  useEffect(() => {
    if (!settings.profiles.some((profile) => profile.id === selectedId)) {
      setSelectedId(settings.defaultProfileId);
    }
  }, [selectedId, settings.defaultProfileId, settings.profiles]);

  const commit = useCallback(
    (next: ImageStyleProfileSettings) => {
      onChange(normalizeImageStyleProfileSettings(next));
    },
    [onChange],
  );

  const updateSelected = useCallback(
    (patch: Partial<ImageStyleProfile>) => {
      commit({
        ...settings,
        profiles: settings.profiles.map((profile) =>
          profile.id === selected.id ? { ...profile, ...patch, id: selected.id } : profile,
        ),
      });
    },
    [commit, selected.id, settings],
  );

  const updateSubjectTags = useCallback(
    (kind: ImagePromptKind, tags: string) => {
      updateSelected({ subjectTags: { ...selected.subjectTags, [kind]: tags } });
    },
    [selected.subjectTags, updateSelected],
  );

  const cloneSelected = useCallback(() => {
    let suffix = 1;
    let id = `${selected.id}-custom`;
    while (settings.profiles.some((profile) => profile.id === id)) {
      suffix += 1;
      id = `${selected.id}-custom-${suffix}`;
    }
    const clone = { ...selected, id, name: `${selected.name} Custom`, builtIn: false };
    commit({ ...settings, profiles: [...settings.profiles, clone], defaultProfileId: id });
    setSelectedId(id);
  }, [commit, selected, settings]);

  const resetSelected = useCallback(() => {
    const builtIn = DEFAULT_IMAGE_STYLE_PROFILES.find((profile) => profile.id === selected.id);
    if (!builtIn) return;
    commit({
      ...settings,
      profiles: settings.profiles.map((profile) => (profile.id === selected.id ? { ...builtIn } : profile)),
    });
  }, [commit, selected.id, settings]);

  const deleteSelected = useCallback(() => {
    if (selected.builtIn || settings.profiles.length <= 1) return;
    const profiles = settings.profiles.filter((profile) => profile.id !== selected.id);
    const defaultProfileId = settings.defaultProfileId === selected.id ? profiles[0]!.id : settings.defaultProfileId;
    commit({ profiles, defaultProfileId });
    setSelectedId(defaultProfileId);
  }, [commit, selected.builtIn, selected.id, settings]);

  const setDefaultProfileId = useCallback(
    (defaultProfileId: string) => {
      commit({ ...settings, defaultProfileId });
    },
    [commit, settings],
  );

  return (
    <div className="rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)]">
      <div className="space-y-3">
        <div className="grid gap-2">
          <label className="min-w-0">
            <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.imagestyleprofileseditor.defaultStyle")}
            </span>
            <select
              value={settings.defaultProfileId}
              onChange={(event) => setDefaultProfileId(event.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs"
            >
              {settings.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.imagestyleprofileseditor.editing")}
            </span>
            <select
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs"
            >
              {settings.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={cloneSelected} className={SETTINGS_BUTTON_CLASS}>
            <Plus size="0.75rem" />
            {localizeUi("ui.panels.imagestyleprofileseditor.clone")}
          </button>
          <button type="button" onClick={resetSelected} disabled={!selected.builtIn} className={SETTINGS_BUTTON_CLASS}>
            <RotateCcw size="0.75rem" />
            {localizeUi("ui.panels.imagestyleprofileseditor.reset")}
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selected.builtIn || settings.profiles.length <= 1}
            className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--danger")}
          >
            <Trash2 size="0.75rem" />
            {localizeUi("lorebook.editor.batch.delete")}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="min-w-0">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.panels.imagestyleprofileseditor.name")}
          </span>
          <input
            value={selected.name}
            onChange={(event) => updateSelected({ name: event.target.value })}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.panels.imagestyleprofileseditor.promptGrammar")}
          </span>
          <select
            value={selected.promptMode}
            onChange={(event) => updateSelected({ promptMode: event.target.value as ImagePromptMode })}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs"
          >
            {IMAGE_PROMPT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.imagestyleprofileseditor.styleText")}
        </span>
        <textarea
          value={selected.styleText}
          onChange={(event) => updateSelected({ styleText: event.target.value })}
          className="min-h-20 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed"
        />
      </label>

      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.panels.imagestyleprofileseditor.positiveTags")}
          </span>
          <textarea
            value={selected.positiveTags}
            onChange={(event) => updateSelected({ positiveTags: event.target.value })}
            className="min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.panels.imagestyleprofileseditor.negativeTags")}
          </span>
          <textarea
            value={selected.negativeTags}
            onChange={(event) => updateSelected({ negativeTags: event.target.value })}
            className="min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed"
          />
        </label>
      </div>

      <details className="mt-3 rounded-md bg-[var(--secondary)]/55 p-2.5 ring-1 ring-[var(--border)]">
        <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
          {localizeUi("ui.panels.imagestyleprofileseditor.perImageTags")}
        </summary>
        <div className="mt-2 grid gap-2">
          {IMAGE_STYLE_SUBJECT_KINDS.map((kind) => (
            <label key={kind} className="block">
              <span className="mb-1 block text-[0.625rem] font-medium capitalize text-[var(--muted-foreground)]">
                {kind}
              </span>
              <textarea
                value={selected.subjectTags[kind] ?? ""}
                onChange={(event) => updateSubjectTags(kind, event.target.value)}
                className="min-h-14 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs leading-relaxed"
              />
            </label>
          ))}
        </div>
      </details>

      <details className="mt-2 rounded-md bg-[var(--secondary)]/55 p-2 ring-1 ring-[var(--border)]">
        <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
          {localizeUi("ui.panels.imagestyleprofileseditor.testBench")}
        </summary>
        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.imagestyleprofileseditor.imageKind")}
              </span>
              <select
                value={previewKind}
                onChange={(event) => setPreviewKind(event.target.value as ImagePromptKind)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
              >
                {IMAGE_STYLE_SUBJECT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.imagestyleprofileseditor.sampleInput")}
              </span>
              <textarea
                value={previewPrompt}
                onChange={(event) => setPreviewPrompt(event.target.value)}
                className="min-h-32 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </label>
            <div className="text-[0.625rem] text-[var(--muted-foreground)]">
              {cleanupCount > 0
                ? localizeUi("ui.panels.imagestyleprofileseditor.value1DuplicateOrMisplacedFragmentValue2Cleaned", {
                    value1: cleanupCount,
                    value2: cleanupCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                  })
                : localizeUi("ui.panels.imagestyleprofileseditor.noCleanupNeededForThisSample")}
            </div>
          </div>
          <div className="grid gap-2">
            <label className="block">
              <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.imagestyleprofileseditor.finalPositivePrompt")}
              </span>
              <textarea
                value={preview.prompt}
                readOnly
                className="min-h-32 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.imagestyleprofileseditor.finalNegativePrompt")}
              </span>
              <textarea
                value={preview.negativePrompt}
                readOnly
                className="min-h-20 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 font-mono text-xs"
                spellCheck={false}
              />
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}

function TrackerPanelCardOrderSetting() {
  const { t: localizeUi } = useUiTranslation();
  const trackerPanelSectionOrder = useUIStore((s) => s.trackerPanelSectionOrder);
  const setTrackerPanelSectionOrder = useUIStore((s) => s.setTrackerPanelSectionOrder);
  const orderedSections = [
    ...trackerPanelSectionOrder.filter((section) => TRACKER_DATA_PANEL_SECTIONS.includes(section)),
    ...TRACKER_DATA_PANEL_SECTIONS.filter((section) => !trackerPanelSectionOrder.includes(section)),
  ];
  const isDefaultOrder = orderedSections.every((section, index) => section === TRACKER_DATA_PANEL_SECTIONS[index]);
  const [orderOpen, setOrderOpen] = useState(!isDefaultOrder);
  const orderId = React.useId();

  const moveCard = (section: TrackerDataPanelSection, direction: -1 | 1) => {
    const index = orderedSections.indexOf(section);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedSections.length) return;

    const nextOrder = [...orderedSections];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex]!, nextOrder[index]!];
    setTrackerPanelSectionOrder(nextOrder);
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg bg-[var(--background)]/36 p-1.5 ring-1 ring-[var(--border)]">
      <div className="flex min-h-5 items-center justify-between gap-2 px-0.5">
        <button
          type="button"
          onClick={() => setOrderOpen((open) => !open)}
          aria-expanded={orderOpen}
          aria-controls={orderId}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left text-[0.625rem] font-medium text-[var(--foreground)] transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
        >
          <ChevronDown
            size="0.6875rem"
            className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", !orderOpen && "-rotate-90")}
          />
          <span className="truncate">{localizeUi("ui.panels.trackerpanelcardordersetting.cardOrder")}</span>
          <span className="shrink-0 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.5625rem] font-normal text-[var(--muted-foreground)]">
            {isDefaultOrder
              ? localizeUi("ui.noodle.noodlehome.default")
              : localizeUi("settings.notifications.customSound.status.custom")}
          </span>
        </button>
        <HelpTooltip
          text={localizeUi("ui.panels.trackerpanelcardordersetting.controlsTheTopToBottomOrderOfTrackerCards")}
        />
        <button
          type="button"
          onClick={() => setTrackerPanelSectionOrder([...TRACKER_DATA_PANEL_SECTIONS])}
          disabled={isDefaultOrder}
          title={localizeUi("settings.actions.resetTrackerOrder")}
          aria-label={localizeUi("settings.actions.resetTrackerOrder")}
          className={SETTINGS_ICON_BUTTON_CLASS}
        >
          <RotateCcw size="0.75rem" />
        </button>
      </div>
      {orderOpen && (
        <div id={orderId} className="grid gap-0.5">
          {orderedSections.map((section, index) => {
            const option = TRACKER_PANEL_CARD_OPTIONS[section];
            return (
              <div
                key={section}
                className="grid min-h-7 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-sm bg-[var(--secondary)]/42 px-1.5 py-1 ring-1 ring-[var(--border)]/60"
                title={localizeUi(option.desc)}
              >
                <div className="min-w-0">
                  <div className="truncate text-[0.6875rem] font-medium leading-4 text-[var(--foreground)]">
                    {localizeUi(option.label)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveCard(section, -1)}
                    disabled={index === 0 || (section === "custom" && orderedSections[index - 1] === "inventory")}
                    title={localizeUi("ui.panels.trackerpanelcardordersetting.moveValue1Up", {
                      value1: localizeUi(option.label),
                    })}
                    aria-label={localizeUi("ui.panels.trackerpanelcardordersetting.moveValue1Up", {
                      value1: localizeUi(option.label),
                    })}
                    className={SETTINGS_ICON_BUTTON_CLASS}
                  >
                    <ArrowUp size="0.75rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCard(section, 1)}
                    disabled={
                      index === orderedSections.length - 1 ||
                      (section === "inventory" && orderedSections[index + 1] === "custom")
                    }
                    title={localizeUi("ui.panels.trackerpanelcardordersetting.moveValue1Down", {
                      value1: localizeUi(option.label),
                    })}
                    aria-label={localizeUi("ui.panels.trackerpanelcardordersetting.moveValue1Down", {
                      value1: localizeUi(option.label),
                    })}
                    className={SETTINGS_ICON_BUTTON_CLASS}
                  >
                    <ArrowDown size="0.75rem" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrackerPanelAppearanceDrawer() {
  const { t: localizeUi } = useUiTranslation();
  const trackerPanelEnabled = useUIStore((state) => state.trackerPanelEnabled);
  const setTrackerPanelEnabled = useUIStore((state) => state.setTrackerPanelEnabled);
  const trackerPanelHideHudWidgets = useUIStore((state) => state.trackerPanelHideHudWidgets);
  const setTrackerPanelHideHudWidgets = useUIStore((state) => state.setTrackerPanelHideHudWidgets);
  const trackerPanelUseExpressionSprites = useUIStore((state) => state.trackerPanelUseExpressionSprites);
  const setTrackerPanelUseExpressionSprites = useUIStore((state) => state.setTrackerPanelUseExpressionSprites);
  const trackerPanelThoughtBubbleDisplay = useUIStore((state) => state.trackerPanelThoughtBubbleDisplay);
  const setTrackerPanelThoughtBubbleDisplay = useUIStore((state) => state.setTrackerPanelThoughtBubbleDisplay);
  const trackerPanelDockedThoughtsAlwaysVisible = useUIStore((state) => state.trackerPanelDockedThoughtsAlwaysVisible);
  const setTrackerPanelDockedThoughtsAlwaysVisible = useUIStore(
    (state) => state.setTrackerPanelDockedThoughtsAlwaysVisible,
  );
  const trackerPanelSizeProfile = useUIStore((state) => state.trackerPanelSizeProfile);
  const setTrackerPanelSizeProfile = useUIStore((state) => state.setTrackerPanelSizeProfile);
  const trackerPanelBackgroundColor = useUIStore((state) => state.trackerPanelBackgroundColor);
  const setTrackerPanelBackgroundColor = useUIStore((state) => state.setTrackerPanelBackgroundColor);
  const trackerTemperatureUnit = useUIStore((state) => state.trackerTemperatureUnit);
  const setTrackerTemperatureUnit = useUIStore((state) => state.setTrackerTemperatureUnit);
  const trackerStatDisplayMode = useUIStore((state) => state.trackerStatDisplayMode);
  const setTrackerStatDisplayMode = useUIStore((state) => state.setTrackerStatDisplayMode);

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]/34 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)]/70 text-[var(--primary)] ring-1 ring-[var(--border)]">
            <TrackerPanelIcon size="0.9rem" />
          </span>
          <span className="min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.panels.trackerpanelappearancedrawer.trackerPanel")}
              <HelpTooltip
                text={localizeUi("ui.panels.trackerpanelappearancedrawer.controlsTheRoleplayHudSidePanelForTheFixed")}
              />
            </span>
            <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {trackerPanelEnabled
                ? localizeUi("ui.panels.trackerpanelappearancedrawer.shownInTheRoleplayHud")
                : localizeUi("ui.panels.trackerpanelappearancedrawer.inATrackerWindow")}
            </span>
          </span>
        </div>

        <SettingsSwitch
          anchorId={getSettingsControlAnchorId("tracker-panel")}
          checked={trackerPanelEnabled}
          onChange={setTrackerPanelEnabled}
          ariaLabel={trackerPanelEnabled ? "Disable Tracker Panel" : "Enable Tracker Panel"}
          className="p-0 hover:bg-transparent"
        />
      </div>

      <fieldset
        disabled={!trackerPanelEnabled}
        className={cn(
          "border-t border-[var(--border)] px-3 pb-3 pt-2 transition-opacity",
          trackerPanelEnabled ? "" : "opacity-45",
        )}
      >
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("tracker-replace-hud-icons")}
          label={localizeUi("settings.controls.replaceTrackerIcons.label")}
          checked={trackerPanelHideHudWidgets}
          onChange={setTrackerPanelHideHudWidgets}
          help={localizeUi("settings.controls.replaceTrackerIcons.help")}
        />
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("tracker-expression-sprites")}
          label={localizeUi("settings.controls.useExpressionSprites.label")}
          checked={trackerPanelUseExpressionSprites}
          onChange={setTrackerPanelUseExpressionSprites}
          help={localizeUi("settings.controls.useExpressionSprites.help")}
        />
        <div id={getSettingsControlAnchorId("tracker-panel-background")} className="mt-2 scroll-mt-3">
          <ColorPicker
            value={trackerPanelBackgroundColor}
            onChange={setTrackerPanelBackgroundColor}
            gradient
            compact
            label={localizeUi("settings.controls.panelBackground.label")}
            helpText="Pick the Tracker panel and tracker section background. CSS colors and gradients are accepted."
            emptyText={localizeUi("ui.panels.trackerpanelappearancedrawer.defaultValue1", {
              value1: TRACKER_PANEL_DEFAULT_BACKGROUND_COLOR,
            })}
            clearLabel="Reset"
          />
        </div>
        <div id={getSettingsControlAnchorId("tracker-desktop-size")} className="mt-2 grid scroll-mt-3 gap-1.5">
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
            {localizeUi("ui.panels.trackerpanelappearancedrawer.desktopSize")}
            <HelpTooltip
              text={localizeUi(
                "ui.panels.trackerpanelappearancedrawer.chooseTheDesignedDesktopWidthForTheTrackerPanel",
              )}
            />
          </span>
          <div className="flex flex-wrap gap-1">
            {TRACKER_PANEL_SIZE_PROFILE_OPTIONS.map((opt) => {
              const selected = trackerPanelSizeProfile === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTrackerPanelSizeProfile(opt.id)}
                  aria-pressed={selected}
                  title={localizeUi("ui.panels.trackerpanelappearancedrawer.value1Value2PxValue3", {
                    value1: opt.label,
                    value2: getTrackerPanelWidthForProfile(opt.id),
                    value3: opt.desc,
                  })}
                  className={cn(SETTINGS_BUTTON_CLASS, "flex-auto")}
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-flex">
                      <TrackerSizeTierIcon sizeProfile={opt.id} />
                    </span>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div id={getSettingsControlAnchorId("tracker-thought-display-mode")} className="mt-2 grid scroll-mt-3 gap-1.5">
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
            {localizeUi("ui.panels.trackerpanelappearancedrawer.thoughtDisplayMode")}
            <HelpTooltip
              text={localizeUi(
                "ui.panels.trackerpanelappearancedrawer.chooseWhetherFeaturedCharacterThoughtsOpenInsideTheTracker",
              )}
            />
          </span>
          <div className="grid grid-cols-2 gap-1">
            {TRACKER_THOUGHT_BUBBLE_DISPLAY_OPTIONS.map((opt) => {
              const selected = trackerPanelThoughtBubbleDisplay === opt.id;
              const Icon = opt.id === "inline" ? Dock : MessageCircle;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTrackerPanelThoughtBubbleDisplay(opt.id)}
                  aria-pressed={selected}
                  title={opt.desc}
                  className={SETTINGS_BUTTON_CLASS}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size="0.75rem" />
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div id={getSettingsControlAnchorId("tracker-stat-display-mode")} className="mt-2 grid scroll-mt-3 gap-1.5">
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
            {localizeUi("ui.panels.trackerpanelappearancedrawer.statDisplayMode")}
            <HelpTooltip
              text={localizeUi("ui.panels.trackerpanelappearancedrawer.chooseBarsOrGaugesForTrackerStats")}
            />
          </span>
          <div className="grid grid-cols-2 gap-1">
            {TRACKER_STAT_DISPLAY_OPTIONS.map((option) => {
              const selected = trackerStatDisplayMode === option;
              const Icon = option === "bars" ? BarChart3 : Gauge;
              const label = localizeUi(
                option === "bars"
                  ? "ui.panels.trackerpanelappearancedrawer.bars"
                  : "ui.panels.trackerpanelappearancedrawer.gauges",
              );
              const description = localizeUi(
                option === "bars"
                  ? "ui.panels.trackerpanelappearancedrawer.barsDescription"
                  : "ui.panels.trackerpanelappearancedrawer.gaugesDescription",
              );
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTrackerStatDisplayMode(option)}
                  aria-pressed={selected}
                  title={description}
                  className={SETTINGS_BUTTON_CLASS}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size="0.75rem" />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("tracker-docked-thoughts")}
          label={localizeUi("settings.controls.alwaysShowDockedThoughts.label")}
          checked={trackerPanelDockedThoughtsAlwaysVisible}
          onChange={setTrackerPanelDockedThoughtsAlwaysVisible}
          help={localizeUi("settings.controls.alwaysShowDockedThoughts.help")}
        />
        <div
          id={getSettingsControlAnchorId("tracker-temperature-unit")}
          className="mt-2 flex scroll-mt-3 min-h-8 items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
            {localizeUi("ui.panels.trackerpanelappearancedrawer.temperatureUnit")}
            <HelpTooltip
              text={localizeUi(
                "ui.panels.trackerpanelappearancedrawer.changesTrackerPanelAndRoleplayHudTemperatureDisplaysWithout",
              )}
            />
          </span>
          <div
            role="group"
            aria-label={localizeUi("ui.panels.trackerpanelappearancedrawer.temperatureUnit")}
            className="grid shrink-0 grid-cols-2 gap-1"
          >
            {(
              [
                {
                  unit: "celsius",
                  label: localizeUi("ui.panels.trackerpanelappearancedrawer.c"),
                  title: localizeUi("ui.panels.trackerpanelappearancedrawer.celsius"),
                },
                {
                  unit: "fahrenheit",
                  label: localizeUi("ui.panels.trackerpanelappearancedrawer.f"),
                  title: localizeUi("ui.panels.trackerpanelappearancedrawer.fahrenheit"),
                },
              ] as const
            ).map((option) => (
              <button
                key={option.unit}
                type="button"
                aria-pressed={trackerTemperatureUnit === option.unit}
                title={option.title}
                onClick={() => setTrackerTemperatureUnit(option.unit)}
                className={SETTINGS_BUTTON_CLASS}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <TrackerPanelCardOrderSetting />
        <TrackerCardColorSettings />
      </fieldset>
    </section>
  );
}

type AppearanceGroup = "app" | "conversation" | "roleplay" | "game";

function appearanceGroupForSection(id: SettingsSectionId): AppearanceGroup {
  if (id === "chat-display" || id === "conversation-theme") return "conversation";
  if (id === "roleplay-tracker" || id === "roleplay-messages") return "roleplay";
  if (id === "game-presentation") return "game";
  return "app";
}

export function SettingsPanel() {
  const [mountedSettingsTabs] = useState(() => new Set<string>());
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const rawSettingsTab = useUIStore((s) => s.settingsTab);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const settingsTargetControlId = useUIStore((s) => s.settingsTargetControlId);
  const setSettingsTargetControlId = useUIStore((s) => s.setSettingsTargetControlId);
  const settingsTargetSectionId = useUIStore((s) => s.settingsTargetSectionId);
  const setSettingsTargetSectionId = useUIStore((s) => s.setSettingsTargetSectionId);
  const settingsTab = normalizeSettingsTab(rawSettingsTab);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [appearanceGroup, setAppearanceGroup] = useState<AppearanceGroup>("app");
  const activePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (rawSettingsTab !== settingsTab) {
      setSettingsTab(settingsTab);
    }
  }, [rawSettingsTab, setSettingsTab, settingsTab]);

  mountedSettingsTabs.add(settingsTab);

  const activeSections = SETTINGS_SECTIONS.filter((section) => section.tab === settingsTab);
  const searchResults = searchSettings(settingsSearch, localize);

  const jumpToSection = useCallback(
    (section: SettingsSectionMeta) => {
      if (isOmnibarSettingsTarget({ sectionId: section.id })) {
        useUIStore.getState().openOmnibarSettings();
        return;
      }
      setSettingsTab(section.tab);
      if (section.tab === "appearance") setAppearanceGroup(appearanceGroupForSection(section.id));
      mountedSettingsTabs.add(section.tab);
      window.requestAnimationFrame(() => {
        const panel = activePanelRef.current;
        const target = document.getElementById(getSettingsSectionAnchorId(section.id));
        if (!panel || !target) return;
        panel.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
      });
    },
    [setSettingsTab, mountedSettingsTabs],
  );

  const jumpToSearchResult = useCallback(
    (result: SettingsSearchResult) => {
      setSettingsSearch("");
      const section = result.section;
      // Q2: the omnibar's settings live in the omnibar; open them there, at the control.
      if (isOmnibarSettingsTarget({ sectionId: section.id })) {
        useUIStore.getState().openOmnibarSettings(result.type === "control" ? result.control.id : null);
        return;
      }
      if (section.tab === "appearance") setAppearanceGroup(appearanceGroupForSection(section.id));
      const targetId =
        result.type === "control"
          ? getSettingsControlAnchorId(result.control.id)
          : getSettingsSectionAnchorId(section.id);
      setSettingsTab(section.tab);
      mountedSettingsTabs.add(section.tab);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const panel = activePanelRef.current;
          const target =
            document.getElementById(targetId) ?? document.getElementById(getSettingsSectionAnchorId(section.id));
          if (!panel || !target) return;
          panel.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
          const focusTarget =
            result.type === "control"
              ? target.querySelector<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                )
              : target;
          if (focusTarget === target) target.tabIndex = -1;
          focusTarget?.focus({ preventScroll: true });
        });
      });
    },
    [setSettingsTab, mountedSettingsTabs],
  );

  useEffect(() => {
    if (!settingsTargetControlId) return;
    const control = SETTINGS_SEARCHABLE_CONTROLS.find((entry) => entry.id === settingsTargetControlId);
    const section = control ? SETTINGS_SECTION_BY_ID.get(control.sectionId) : null;
    if (control && section) {
      jumpToSearchResult({ type: "control", control, section });
    }
    setSettingsTargetControlId(null);
  }, [jumpToSearchResult, setSettingsTargetControlId, settingsTargetControlId]);

  // A jump that names a section rather than one control, which is what the
  // omnibar's section rows ask for. It goes through `jumpToSearchResult` rather
  // than `jumpToSection` because it can arrive from another tab with the panel
  // freshly mounted: that path waits two frames and falls back to the section
  // anchor, where `jumpToSection`'s single frame can still see the old panel.
  useEffect(() => {
    if (!settingsTargetSectionId) return;
    const section = SETTINGS_SECTION_BY_ID.get(settingsTargetSectionId);
    if (section) jumpToSearchResult({ type: "section", section });
    setSettingsTargetSectionId(null);
  }, [jumpToSearchResult, setSettingsTargetSectionId, settingsTargetSectionId]);

  return (
    <div className="mari-settings-panel-chrome flex h-full flex-col overflow-hidden">
      <div className="mari-editor-header mari-settings-search-header">
        <div className="flex w-full items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search
              size="0.875rem"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              value={settingsSearch}
              onChange={(event) => setSettingsSearch(event.target.value)}
              placeholder={localize("Search settings")}
              className="mari-chrome-field h-9 w-full rounded-lg pl-8 pr-8 text-xs"
            />
            {settingsSearch && (
              <button
                type="button"
                onClick={() => setSettingsSearch("")}
                aria-label={localize("Clear settings search")}
                className={cn(SETTINGS_ICON_BUTTON_CLASS, "absolute right-1 top-1/2 -translate-y-1/2")}
              >
                <X size="0.75rem" />
              </button>
            )}
          </label>
        </div>
        {settingsSearch.trim() && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/40 p-1.5">
            {searchResults.length ? (
              <div className="grid gap-1">
                {searchResults.map((result) => {
                  const section = result.section;
                  const tab = TABS.find((entry) => entry.id === section.tab);
                  const label = localize(result.type === "control" ? result.control.label : section.label);
                  const description = localize(
                    result.type === "control" ? result.control.description : section.description,
                  );
                  return (
                    <button
                      key={`${result.type}-${result.type === "control" ? result.control.id : section.id}`}
                      type="button"
                      onClick={() => jumpToSearchResult(result)}
                      className="grid min-w-0 gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--accent)]/70"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-[var(--foreground)]">{label}</span>
                        <span className="shrink-0 rounded-full border border-[var(--border)]/70 px-1.5 py-px text-[0.5625rem] font-medium text-[var(--muted-foreground)]">
                          {localize(result.type === "control" ? result.control.kind : "Section")}
                        </span>
                      </span>
                      <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                        {tab ? t(tab.labelKey) : localize("Settings")} / {localize(section.label)} / {description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
                {localize("No matching settings.")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--border)]/70 px-2.5 py-1.5">
        <div
          role="tablist"
          aria-label={localize("Settings categories")}
          className="grid grid-cols-3 gap-x-1.5 gap-y-1 rounded-xl border border-[var(--border)]/70 bg-[var(--background)]/32 p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_7%,transparent)]"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = settingsTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={settingsTab === tab.id}
                aria-controls={`settings-panel-${tab.id}`}
                tabIndex={settingsTab === tab.id ? 0 : -1}
                onClick={() => setSettingsTab(tab.id)}
                className={cn(
                  "group relative isolate flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-1 py-0.5 text-center text-[0.625rem] font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40",
                  active
                    ? "border-[var(--primary)]/35 bg-[var(--primary)]/10 text-[var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_11%,transparent)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)]/80 hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                )}
                title={t(tab.descriptionKey)}
              >
                {active && (
                  <>
                    <span className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_18%,transparent),color-mix(in_srgb,var(--primary)_7%,transparent)_62%,transparent)]" />
                    <span className="pointer-events-none absolute inset-x-3 bottom-0 h-px rounded-full bg-[var(--primary)]/60" />
                  </>
                )}
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors",
                    active
                      ? "border-[var(--primary)]/35 bg-[var(--primary)]/16 text-[var(--primary)]"
                      : "border-[var(--border)]/55 bg-[var(--secondary)]/45 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon size="0.6875rem" />
                </span>
                <span className="w-full min-w-0 break-words px-0.5">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {activeSections.length > 1 && (
          <div className="min-w-0 rounded-xl border border-[var(--border)]/60 bg-[var(--background)]/24 p-0.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_6%,transparent)]">
            <div className="flex max-w-full flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setQuickAccessOpen((open) => !open)}
                aria-expanded={quickAccessOpen}
                className={cn(SETTINGS_BUTTON_CLASS, "max-w-full")}
                title={localize(quickAccessOpen ? "Collapse Quick Access" : "Expand Quick Access")}
              >
                <Tag size="0.75rem" className="shrink-0" />
                <span>
                  {localize("Quick Access")} ({activeSections.length})
                </span>
                <ChevronDown
                  size="0.75rem"
                  className={cn("shrink-0 transition-transform", quickAccessOpen ? "rotate-180" : "")}
                />
              </button>
              {quickAccessOpen &&
                activeSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section)}
                    className={cn(SETTINGS_BUTTON_CLASS, "max-w-full")}
                    title={localizeUi("ui.panels.settingspanel.value1Value2", {
                      value1: localize(section.label),
                      value2: localize(section.description),
                    })}
                  >
                    <span>{localize(section.label)}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {TABS.map((tab) => {
          if (!mountedSettingsTabs.has(tab.id)) return null;
          const Comp = SETTINGS_COMPONENTS[tab.id];
          const active = settingsTab === tab.id;
          return (
            <Activity key={tab.id} mode={active ? "visible" : "hidden"}>
              <div
                id={`settings-panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`settings-tab-${tab.id}`}
                hidden={!active}
                ref={active ? activePanelRef : undefined}
                className="absolute inset-0 overflow-y-auto p-3"
                style={active ? undefined : { clipPath: "inset(100%)", pointerEvents: "none" }}
              >
                {tab.id === "appearance" ? (
                  <>
                    <div
                      role="group"
                      aria-label={localizeUi("settings.appearance.modeNavigation")}
                      className="@container mb-3 grid grid-cols-4 divide-x divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40"
                    >
                      {(["app", "conversation", "roleplay", "game"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={appearanceGroup === mode}
                          onClick={() => {
                            setAppearanceGroup(mode);
                            activePanelRef.current?.scrollTo({ top: 0 });
                          }}
                          className={cn(
                            "min-h-11 min-w-0 whitespace-nowrap px-0.5 py-2 font-semibold transition-colors",
                            appearanceGroup === mode
                              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                          )}
                          style={{ fontSize: "clamp(0.5rem, 3.5cqi, 0.625rem)" }}
                        >
                          {localizeUi(`settings.appearance.modes.${mode}`)}
                        </button>
                      ))}
                    </div>
                    <AppearanceSettings group={appearanceGroup} />
                  </>
                ) : (
                  <Comp />
                )}
              </div>
            </Activity>
          );
        })}
      </div>
    </div>
  );
}

function QuickRepliesSetting() {
  const localize = useLocalizedUiText();
  const showQuickRepliesMenu = useUIStore((s) => s.showQuickRepliesMenu);
  const setShowQuickRepliesMenu = useUIStore((s) => s.setShowQuickRepliesMenu);
  const showQuickReplyPostOnly = useUIStore((s) => s.showQuickReplyPostOnly);
  const setShowQuickReplyPostOnly = useUIStore((s) => s.setShowQuickReplyPostOnly);
  const showQuickReplyGuide = useUIStore((s) => s.showQuickReplyGuide);
  const setShowQuickReplyGuide = useUIStore((s) => s.setShowQuickReplyGuide);
  const showQuickReplyImpersonate = useUIStore((s) => s.showQuickReplyImpersonate);
  const setShowQuickReplyImpersonate = useUIStore((s) => s.setShowQuickReplyImpersonate);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const handleEnabledChange = (enabled: boolean) => {
    setShowQuickRepliesMenu(enabled);
    if (enabled) setDrawerOpen(true);
  };

  return (
    <div
      id={getSettingsControlAnchorId(QUICK_REPLIES_SETTINGS_CONTROL_ID)}
      className={cn(
        "scroll-mt-3 overflow-hidden rounded-xl border transition-colors",
        showQuickRepliesMenu
          ? "border-[var(--primary)]/30 bg-[var(--secondary)]/15"
          : "border-transparent bg-transparent hover:bg-[var(--accent)]/30",
      )}
    >
      <div className="flex min-h-9 items-stretch">
        <div className="flex min-w-0 items-center gap-1.5 py-2 pl-1.5 pr-2">
          <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={showQuickRepliesMenu}
              onChange={(event) => handleEnabledChange(event.target.checked)}
              className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <span className="min-w-0 text-xs">{localize("Quick replies")}</span>
          </label>
          <span className="shrink-0" onClick={(event) => event.preventDefault()}>
            <HelpTooltip
              text={localize(
                "Adds alternate draft actions beside Send. One action appears directly; multiple actions open from the ellipsis.",
              )}
            />
          </span>
        </div>
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (!showQuickRepliesMenu) return;
            setDrawerOpen((open) => !open);
          }}
          aria-disabled={!showQuickRepliesMenu}
          aria-controls="quick-replies-actions-drawer"
          aria-expanded={showQuickRepliesMenu && drawerOpen}
          aria-label={localize(
            !showQuickRepliesMenu
              ? "Quick replies options disabled"
              : drawerOpen
                ? "Collapse Quick replies options"
                : "Expand Quick replies options",
          )}
          title={localize(
            !showQuickRepliesMenu
              ? "Enable Quick replies to configure options"
              : drawerOpen
                ? "Collapse options"
                : "Expand options",
          )}
          className={cn(
            "flex min-w-10 flex-1 items-center justify-end py-2 pl-2 pr-2 text-[var(--muted-foreground)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
            showQuickRepliesMenu && drawerOpen ? "rounded-tr-xl" : "rounded-r-xl",
            showQuickRepliesMenu
              ? "cursor-pointer hover:bg-[var(--accent)]/35 hover:text-[var(--foreground)] active:scale-[0.99]"
              : "cursor-not-allowed opacity-35",
          )}
          tabIndex={showQuickRepliesMenu ? 0 : -1}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg">
            <ChevronDown
              size="0.875rem"
              aria-hidden="true"
              className={cn("transition-transform", showQuickRepliesMenu && drawerOpen ? "" : "-rotate-90")}
            />
          </span>
        </button>
      </div>
      {showQuickRepliesMenu && drawerOpen && (
        <div
          id="quick-replies-actions-drawer"
          className="grid min-w-0 max-w-full gap-1 overflow-hidden border-t border-[var(--border)]/60 bg-[var(--background)]/25 p-1"
          role="group"
          aria-label={localize("Quick replies actions to include")}
        >
          {[
            {
              label: "Post only",
              checked: showQuickReplyPostOnly,
              onChange: setShowQuickReplyPostOnly,
              description: "Add persona message without triggering a reply.",
              icon: FileText,
            },
            {
              label: "Guide reply",
              checked: showQuickReplyGuide,
              onChange: setShowQuickReplyGuide,
              description: "Use draft as /guided direction.",
              icon: WandSparkles,
            },
            {
              label: "Impersonate",
              checked: showQuickReplyImpersonate,
              onChange: setShowQuickReplyImpersonate,
              description: "Generate a persona-side user reply.",
              icon: UserCheck,
            },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.label}
                aria-pressed={option.checked}
                onClick={() => option.onChange(!option.checked)}
                className={SETTINGS_CHOICE_CARD_CLASS}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)]/35 ring-1 ring-[var(--border)]/60">
                    <Icon size="0.8125rem" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{localize(option.label)}</span>
                    <span className="block text-[0.65rem] leading-tight text-[var(--muted-foreground)]">
                      {localize(option.description)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-[var(--border)]/70",
                      !option.checked && "text-transparent",
                    )}
                    aria-hidden="true"
                  >
                    <Check size="0.625rem" strokeWidth={3} />
                  </span>
                </div>
              </button>
            );
          })}
          <CustomQuickRepliesManager />
        </div>
      )}
    </div>
  );
}

function CustomQuickReplyIconButton({
  icon,
  onSelect,
}: {
  icon: string | undefined;
  onSelect: (icon: string) => void;
}) {
  const localize = useLocalizedUiText();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(SETTINGS_ICON_BUTTON_CLASS, "text-xs")}
        title={localize("Choose quick reply icon")}
        aria-label={localize("Choose quick reply icon")}
        aria-expanded={open}
      >
        {icon?.trim() || "✨"}
      </button>
      <EmojiPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(emoji) => {
          onSelect(emoji);
          setOpen(false);
        }}
        anchorRef={buttonRef}
      />
    </>
  );
}

function CustomQuickRepliesManager() {
  const localize = useLocalizedUiText();
  const customQuickReplies = useUIStore((s) => s.customQuickReplies);
  const addCustomQuickReply = useUIStore((s) => s.addCustomQuickReply);
  const updateCustomQuickReply = useUIStore((s) => s.updateCustomQuickReply);
  const removeCustomQuickReply = useUIStore((s) => s.removeCustomQuickReply);

  return (
    <div className="mt-1 min-w-0 max-w-full overflow-hidden border-t border-[var(--border)]/60 pt-2">
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {localize("Custom quick replies")}
        </span>
        <button
          type="button"
          onClick={() => addCustomQuickReply("", "")}
          className={SETTINGS_BUTTON_CLASS}
          title={localize("Add a custom quick reply")}
        >
          <Plus size="0.75rem" aria-hidden="true" />
          {localize("Add")}
        </button>
      </div>
      {customQuickReplies.length === 0 ? (
        <p className="px-1 pb-1 text-[0.65rem] leading-tight text-[var(--muted-foreground)]">
          {localize(
            "Add buttons that send a fixed message, macro, or slash command from the quick replies menu beside Send.",
          )}
        </p>
      ) : (
        <div className="grid min-w-0 max-w-full gap-1.5">
          {customQuickReplies.map((entry) => (
            <div
              key={entry.id}
              className="grid min-w-0 max-w-full gap-1 overflow-hidden rounded-md border border-[var(--border)]/60 bg-[var(--background)]/30 p-1.5"
            >
              <div className="flex min-w-0 max-w-full items-center gap-1.5">
                <CustomQuickReplyIconButton
                  icon={entry.icon}
                  onSelect={(icon) => updateCustomQuickReply(entry.id, { icon })}
                />
                <input
                  value={entry.label}
                  onChange={(event) => updateCustomQuickReply(entry.id, { label: event.target.value })}
                  placeholder={localize("Button label")}
                  className="min-w-0 flex-1 rounded bg-[var(--secondary)]/60 px-2 py-1 text-xs outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
                />
                <button
                  type="button"
                  onClick={() => removeCustomQuickReply(entry.id)}
                  className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger")}
                  title={localize("Remove quick reply")}
                  aria-label={localize("Remove quick reply")}
                >
                  <Trash2 size="0.75rem" aria-hidden="true" />
                </button>
              </div>
              <textarea
                value={entry.content}
                onChange={(event) => updateCustomQuickReply(entry.id, { content: event.target.value })}
                placeholder={localize("Message, macro, or /slash command to send")}
                rows={2}
                className="min-w-0 max-w-full resize-y rounded bg-[var(--secondary)]/60 px-2 py-1 text-xs outline-none ring-1 ring-transparent focus:ring-[var(--primary)]/40"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Documentation Language row (Settings › General › App Behavior). Separate from
 * the UI-language selector above it: this controls which docs/i18n/<code> tree
 * the in-app guides are served from. The choice is server-authoritative (a
 * data-dir app-setting), so it survives updates and applies to every device.
 */
function DocsLanguageSetting() {
  const { t: localizeUi } = useUiTranslation();
  const { data: status, isLoading: statusLoading } = useDocsLanguage();
  const setDocsLanguage = useSetDocsLanguage();
  const fixDocsLanguage = useFixDocsLanguage();
  // null = "no pending pick"; the select then mirrors the server-active language.
  const [pickedLanguage, setPickedLanguage] = useState<string | null>(null);

  const active = status?.active ?? "en";
  const options = status?.available ?? [];
  const selection = pickedLanguage ?? active;
  const pendingSwitch = selection !== active;
  const selectionInfo = options.find((option) => option.code === selection);
  const activeInfo = options.find((option) => option.code === active);
  const integrityOk = status ? status.integrity.ok : true;
  // A language without a downloaded pack needs a download first — the button
  // becomes "Download & Replace" and the switch may take a short while.
  const needsDownload = pendingSwitch && selection !== "en" && !(selectionInfo?.installed ?? false);
  const installProgress = status?.install ?? null;

  const handleSwitch = async () => {
    try {
      const result = await setDocsLanguage.mutateAsync(selection);
      setPickedLanguage(null);
      const label = result.available.find((option) => option.code === result.active)?.label ?? result.active;
      toast.success(localizeUi("settings.application.docsLanguage.switched", { language: label }));
    } catch (err) {
      const reason =
        err instanceof ApiError && err.status === 409
          ? localizeUi("settings.application.docsLanguage.installInProgress")
          : err instanceof Error
            ? err.message
            : String(err);
      toast.error(localizeUi("settings.application.docsLanguage.switchFailed", { reason }));
    }
  };

  const handleFix = async () => {
    try {
      const result = await fixDocsLanguage.mutateAsync();
      setPickedLanguage(null);
      // Say what the fix actually did: re-downloaded the pack, reset to
      // English, or just swept leftovers — the outcomes are very different.
      const message = !result.repaired
        ? "settings.application.docsLanguage.healthy"
        : result.actions.includes("reinstalled-pack")
          ? "settings.application.docsLanguage.fixedReinstalled"
          : result.actions.some((action) => action.startsWith("reset"))
            ? "settings.application.docsLanguage.fixed"
            : "settings.application.docsLanguage.fixedCleaned";
      toast.success(localizeUi(message));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div id={getSettingsControlAnchorId("docs-language")} className="flex scroll-mt-3 flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-xs font-medium">
          {localizeUi("settings.application.docsLanguage.label")}
          <HelpTooltip text={localizeUi("settings.application.docsLanguage.help")} />
        </span>
        <select
          value={selection}
          onChange={(event) => setPickedLanguage(event.target.value)}
          disabled={statusLoading || setDocsLanguage.isPending}
          className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
        >
          {(options.length > 0 ? options : [{ code: "en", label: "English" }]).map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {activeInfo && active !== "en" ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("settings.application.docsLanguage.active", {
            language: activeInfo.label,
            translated: activeInfo.translated,
            total: activeInfo.total,
          })}
        </p>
      ) : null}
      {(pendingSwitch && selection !== "en") || active !== "en" ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("settings.application.docsLanguage.fallbackNote")}
        </p>
      ) : null}
      {needsDownload ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("settings.application.docsLanguage.downloadNote")}
        </p>
      ) : null}
      {pendingSwitch ? (
        <button
          type="button"
          onClick={() => void handleSwitch()}
          disabled={setDocsLanguage.isPending}
          className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
        >
          {setDocsLanguage.isPending ? (
            <>
              <Loader2 size="0.8125rem" className="animate-spin" />
              {installProgress && installProgress.filesTotal > 0
                ? localizeUi("settings.application.docsLanguage.downloading", {
                    done: installProgress.filesDone,
                    total: installProgress.filesTotal,
                  })
                : localizeUi("settings.application.docsLanguage.switching")}
            </>
          ) : (
            <>
              <BookOpen size="0.8125rem" />
              {needsDownload
                ? localizeUi("settings.application.docsLanguage.downloadAndReplace")
                : localizeUi("settings.application.docsLanguage.switch", {
                    language: selectionInfo?.label ?? selection,
                  })}
            </>
          )}
        </button>
      ) : null}
      {!integrityOk ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--background)]/60 p-2 ring-1 ring-[var(--border)]">
          <div className="flex items-start gap-1.5">
            <AlertTriangle size="0.8125rem" className="mt-0.5 shrink-0 text-amber-500" />
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("settings.application.docsLanguage.fixNeeded")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleFix()}
            disabled={fixDocsLanguage.isPending}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            {fixDocsLanguage.isPending ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                {localizeUi("settings.application.docsLanguage.fixing")}
              </>
            ) : (
              <>
                <Wrench size="0.8125rem" />
                {localizeUi("settings.application.docsLanguage.fix")}
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GeneralSettings() {
  const { t: localizeUi } = useUiTranslation();
  const { t, i18n: localization } = useTranslation();
  const localize = useLocalizedUiText();
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const musicDjInstalled = installedCapabilities.some(
    (capability) => capability.id === "spotify" && capability.status === "active",
  );
  const enableStreaming = useUIStore((s) => s.enableStreaming);
  const notificationPosition = useUIStore((s) => s.notificationPosition);
  const setNotificationPosition = useUIStore((s) => s.setNotificationPosition);
  const setEnableStreaming = useUIStore((s) => s.setEnableStreaming);
  const streamingSpeed = useUIStore((s) => s.streamingSpeed);
  const setStreamingSpeed = useUIStore((s) => s.setStreamingSpeed);
  const gameInstantTextReveal = useUIStore((s) => s.gameInstantTextReveal);
  const setGameInstantTextReveal = useUIStore((s) => s.setGameInstantTextReveal);
  const gameMiddleMouseNav = useUIStore((s) => s.gameMiddleMouseNav);
  const setGameMiddleMouseNav = useUIStore((s) => s.setGameMiddleMouseNav);
  const gameTextSpeed = useUIStore((s) => s.gameTextSpeed);
  const setGameTextSpeed = useUIStore((s) => s.setGameTextSpeed);
  const gameAutoPlayDelay = useUIStore((s) => s.gameAutoPlayDelay);
  const setGameAutoPlayDelay = useUIStore((s) => s.setGameAutoPlayDelay);
  const enterToSendRP = useUIStore((s) => s.enterToSendRP);
  const setEnterToSendRP = useUIStore((s) => s.setEnterToSendRP);
  const enterToSendConvo = useUIStore((s) => s.enterToSendConvo);
  const setEnterToSendConvo = useUIStore((s) => s.setEnterToSendConvo);
  const enterToSendGame = useUIStore((s) => s.enterToSendGame);
  const setEnterToSendGame = useUIStore((s) => s.setEnterToSendGame);
  const keepGuidanceAfterRegenerate = useUIStore((s) => s.keepGuidanceAfterRegenerate);
  const setKeepGuidanceAfterRegenerate = useUIStore((s) => s.setKeepGuidanceAfterRegenerate);
  const addCyoaChoicesToMessage = useUIStore((s) => s.addCyoaChoicesToMessage);
  const setAddCyoaChoicesToMessage = useUIStore((s) => s.setAddCyoaChoicesToMessage);
  const confirmBeforeDelete = useUIStore((s) => s.confirmBeforeDelete);
  const setConfirmBeforeDelete = useUIStore((s) => s.setConfirmBeforeDelete);
  const chatHelpButtonHidden = useUIStore((s) => s.chatHelpButtonHidden ?? false);
  const setChatHelpButtonHidden = useUIStore((s) => s.setChatHelpButtonHidden);
  const achievementsEnabled = useUIStore((s) => s.achievementsEnabled);
  const setAchievementsEnabled = useUIStore((s) => s.setAchievementsEnabled);
  const messagesPerPage = useUIStore((s) => s.messagesPerPage);
  const setMessagesPerPage = useUIStore((s) => s.setMessagesPerPage);
  const boldDialogue = useUIStore((s) => s.boldDialogue);
  const setBoldDialogue = useUIStore((s) => s.setBoldDialogue);
  const colorInlineNames = useUIStore((s) => s.colorInlineNames);
  const setColorInlineNames = useUIStore((s) => s.setColorInlineNames);
  const disableInlineNameGradients = useUIStore((s) => s.disableInlineNameGradients);
  const setDisableInlineNameGradients = useUIStore((s) => s.setDisableInlineNameGradients);
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const setQuoteFormat = useUIStore((s) => s.setQuoteFormat);
  const convertLatexSymbols = useUIStore((s) => s.convertLatexSymbols);
  const setConvertLatexSymbols = useUIStore((s) => s.setConvertLatexSymbols);
  const trimIncompleteModelOutput = useUIStore((s) => s.trimIncompleteModelOutput);
  const setTrimIncompleteModelOutput = useUIStore((s) => s.setTrimIncompleteModelOutput);
  const continueAddsNewline = useUIStore((s) => s.continueAddsNewline);
  const setContinueAddsNewline = useUIStore((s) => s.setContinueAddsNewline);
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const setSpeechToTextEnabled = useUIStore((s) => s.setSpeechToTextEnabled);
  const musicPlayerEnabled = useUIStore((s) => s.musicPlayerEnabled);
  const setMusicPlayerEnabled = useUIStore((s) => s.setMusicPlayerEnabled);
  const intuitiveSwipeNavigation = useUIStore((s) => s.intuitiveSwipeNavigation);
  const setIntuitiveSwipeNavigation = useUIStore((s) => s.setIntuitiveSwipeNavigation);
  const intuitiveSwipeRerollLatest = useUIStore((s) => s.intuitiveSwipeRerollLatest);
  const setIntuitiveSwipeRerollLatest = useUIStore((s) => s.setIntuitiveSwipeRerollLatest);
  const editLastMessageOnArrowUp = useUIStore((s) => s.editLastMessageOnArrowUp);
  const setEditLastMessageOnArrowUp = useUIStore((s) => s.setEditLastMessageOnArrowUp);
  const editMessageOnDoubleClick = useUIStore((s) => s.editMessageOnDoubleClick);
  const setEditMessageOnDoubleClick = useUIStore((s) => s.setEditMessageOnDoubleClick);

  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>{t("settings.application.intro")}</SettingsIntro>

      <SettingsSection
        title={t("settings.application.title")}
        description={t("settings.application.description")}
        icon={<Power size="0.875rem" />}
        {...getSettingsSectionAnchorProps("application")}
      >
        <div className="flex flex-col gap-2.5">
          <UILanguageSetting anchorId={getSettingsControlAnchorId("language")} />

          <DocsLanguageSetting />

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("confirm-before-delete")}
            label={localizeUi("settings.controls.confirmBeforeDelete.label")}
            checked={confirmBeforeDelete}
            onChange={setConfirmBeforeDelete}
            help={localizeUi("settings.controls.confirmBeforeDelete.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("hide-chat-help-button")}
            label={localizeUi("settings.controls.hideChatHelpButton.label")}
            checked={chatHelpButtonHidden}
            onChange={setChatHelpButtonHidden}
            help={localizeUi("settings.controls.hideChatHelpButton.help")}
          />
          <AndroidStatusBarSetting />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("achievements")}
            label={localizeUi("home.achievements.title")}
            checked={achievementsEnabled}
            onChange={setAchievementsEnabled}
            help={localizeUi("settings.controls.achievements.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("music-player")}
            label={localizeUi("settings.controls.musicPlayer.label")}
            checked={musicDjInstalled && musicPlayerEnabled}
            onChange={setMusicPlayerEnabled}
            help={localizeUi(
              musicDjInstalled ? "settings.controls.musicPlayer.help" : "settings.controls.musicPlayer.requiresMusicDj",
            )}
            disabled={!musicDjInstalled}
          />
          {/* Q2: every omnibar and Professor Mari setting lives in the omnibar; this row opens it. */}
          <div
            id={getSettingsSectionAnchorId("omnibar")}
            className="flex scroll-mt-3 items-center justify-between gap-3 p-1.5"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs">
              <span id="settings-omnibar-row-label">{localizeUi("settings.controls.omnibarSettings.label")}</span>
              <HelpTooltip text={localizeUi("settings.controls.omnibarSettings.help")} />
            </span>
            <button
              type="button"
              id="settings-omnibar-row-open"
              aria-labelledby="settings-omnibar-row-open settings-omnibar-row-label"
              className={SETTINGS_BUTTON_CLASS}
              onClick={() => useUIStore.getState().openOmnibarSettings()}
            >
              {localizeUi("settings.controls.omnibarSettings.open")}
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.notifications.title")}
        description={localizeUi("settings.sections.notifications.description")}
        icon={<Bell size="0.875rem" />}
        {...getSettingsSectionAnchorProps("notifications")}
      >
        <label
          id={getSettingsControlAnchorId("notification-position")}
          className="mb-3 flex scroll-mt-3 flex-col gap-1.5 text-xs"
        >
          <span>{localizeUi("settings.notifications.position.label")}</span>
          <select
            value={notificationPosition}
            onChange={(event) => setNotificationPosition(event.target.value === "bottom" ? "bottom" : "top")}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-[var(--border)]"
          >
            <option value="top">{localizeUi("settings.notifications.position.top")}</option>
            <option value="bottom">{localizeUi("settings.notifications.position.bottom")}</option>
          </select>
          <span className="text-[var(--muted-foreground)]">{localizeUi("settings.notifications.position.help")}</span>
        </label>
        <ConversationSoundSetting />
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.responses.title")}
        description={localizeUi("settings.sections.responses.description")}
        icon={<MessageCircle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("responses")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("enable-streaming")}
            label={localizeUi("settings.controls.enableStreaming.label")}
            checked={enableStreaming}
            onChange={setEnableStreaming}
            help={localizeUi("settings.controls.enableStreaming.help")}
          />

          <label
            id={getSettingsControlAnchorId("streaming-speed")}
            className={cn(
              "flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors",
              enableStreaming ? "hover:bg-[var(--accent)]/50" : "opacity-40 pointer-events-none",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">{localize("Streaming speed")}</span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{streamingSpeed}</span>
              <HelpTooltip
                text={localize(
                  "How fast streaming tokens appear on screen. Lower values give a slower typewriter effect so you can read along. Higher values show text almost instantly.",
                )}
              />
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={streamingSpeed}
              onChange={(e) => setStreamingSpeed(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[0.625rem] text-[var(--muted-foreground)]">
              <span>{localize("Slow")}</span>
              <span>{localize("Fast")}</span>
            </div>
          </label>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("trim-incomplete-output")}
            label={localizeUi("settings.controls.trimIncomplete.label")}
            checked={trimIncompleteModelOutput}
            onChange={setTrimIncompleteModelOutput}
            help={localizeUi("settings.controls.trimIncomplete.help")}
          />

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("continue-adds-newline")}
            label={localizeUi("settings.controls.continueAddsNewline.label")}
            checked={continueAddsNewline}
            onChange={setContinueAddsNewline}
            help={localizeUi("settings.controls.continueAddsNewline.help")}
          />

          <label
            id={getSettingsControlAnchorId("messages-per-page")}
            className="flex scroll-mt-3 flex-wrap items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-[var(--accent)]/50"
          >
            <span className="text-xs">{localize("Messages per page")}</span>
            <HelpTooltip
              text={localize(
                "How many messages to load at a time. Click 'Load More' in the chat to see older messages. Set to 0 to load all messages at once.",
              )}
            />
            <DraftNumberInput
              value={messagesPerPage}
              min={0}
              max={500}
              onCommit={(nextValue) => setMessagesPerPage(Math.max(0, Math.min(500, nextValue)))}
              className="w-16 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.inputEditing.title")}
        description={localizeUi("settings.sections.inputEditing.description")}
        icon={<UserCheck size="0.875rem" />}
        {...getSettingsSectionAnchorProps("input-editing")}
      >
        <div className="flex flex-col gap-2.5">
          <div
            id={getSettingsControlAnchorId("send-on-enter")}
            className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--accent)]/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">{localizeUi("settings.controls.sendOnEnter.label")}</span>
              <HelpTooltip text={localizeUi("settings.controls.sendOnEnter.help")} />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setEnterToSendRP(!enterToSendRP)}
                aria-pressed={enterToSendRP}
                className={SETTINGS_BUTTON_CLASS}
              >
                {localizeUi("settings.modes.roleplay")}
              </button>
              <button
                type="button"
                onClick={() => setEnterToSendConvo(!enterToSendConvo)}
                aria-pressed={enterToSendConvo}
                className={SETTINGS_BUTTON_CLASS}
              >
                {localizeUi("settings.modes.conversations")}
              </button>
              <button
                type="button"
                onClick={() => setEnterToSendGame(!enterToSendGame)}
                aria-pressed={enterToSendGame}
                className={SETTINGS_BUTTON_CLASS}
              >
                {localizeUi("settings.modes.game")}
              </button>
            </div>
          </div>

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("keep-guidance-after-regenerating")}
            label={localizeUi("settings.controls.keepGuidanceAfterRegenerate.label")}
            checked={keepGuidanceAfterRegenerate}
            onChange={setKeepGuidanceAfterRegenerate}
            help={localizeUi("settings.controls.keepGuidanceAfterRegenerate.help")}
          />

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("add-cyoa-choices-to-message")}
            label={localizeUi("settings.controls.addCyoaChoicesToMessage.label")}
            checked={addCyoaChoicesToMessage}
            onChange={setAddCyoaChoicesToMessage}
          />

          <QuickRepliesSetting />

          <ToggleSetting
            anchorId={getSettingsControlAnchorId("speech-to-text")}
            label={localizeUi("settings.controls.speechToText.label")}
            checked={speechToTextEnabled}
            onChange={setSpeechToTextEnabled}
            help={localizeUi("settings.controls.speechToText.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("intuitive-swipe-navigation")}
            label={localizeUi("settings.controls.intuitiveSwipes.label")}
            checked={intuitiveSwipeNavigation}
            onChange={setIntuitiveSwipeNavigation}
            help={localizeUi("settings.controls.intuitiveSwipes.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("reroll-past-newest-swipe")}
            label={localizeUi("settings.controls.rerollLatest.label")}
            checked={intuitiveSwipeRerollLatest}
            onChange={setIntuitiveSwipeRerollLatest}
            disabled={!intuitiveSwipeNavigation}
            help={localizeUi("settings.controls.rerollLatest.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("up-arrow-edits-last-message")}
            label={localizeUi("settings.controls.upArrowEdit.label")}
            checked={editLastMessageOnArrowUp}
            onChange={setEditLastMessageOnArrowUp}
            help={localizeUi("settings.controls.upArrowEdit.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("double-click-edits-messages")}
            label={localizeUi("settings.controls.doubleClickEdit.label")}
            checked={editMessageOnDoubleClick}
            onChange={setEditMessageOnDoubleClick}
            help={localizeUi("settings.controls.doubleClickEdit.help")}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.textRules.title")}
        description={localizeUi("settings.sections.textRules.description")}
        icon={<FileText size="0.875rem" />}
        {...getSettingsSectionAnchorProps("text-rules")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("bold-dialogue")}
            label={localizeUi("settings.controls.boldDialogue.label")}
            checked={boldDialogue ?? true}
            onChange={setBoldDialogue}
            help={localizeUi("settings.controls.boldDialogue.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("convert-latex-symbols")}
            label={localizeUi("settings.controls.convertLatex.label")}
            checked={convertLatexSymbols}
            onChange={setConvertLatexSymbols}
            help={localizeUi("ui.panels.generalsettings.turnsCommonModelWrittenLatexCommandsLikeRightarrowNeq")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("color-inline-names")}
            label={localizeUi("settings.controls.colorInlineNames.label")}
            checked={colorInlineNames ?? false}
            onChange={setColorInlineNames}
            help={localizeUi("settings.controls.colorInlineNames.help")}
          />
          {colorInlineNames && (
            <ToggleSetting
              anchorId={getSettingsControlAnchorId("disable-inline-name-gradients")}
              label={localizeUi("settings.controls.disableInlineNameGradients.label")}
              checked={disableInlineNameGradients ?? false}
              onChange={setDisableInlineNameGradients}
              help={localizeUi("settings.controls.disableInlineNameGradients.help")}
            />
          )}
          <div
            id={getSettingsControlAnchorId("quote-style")}
            className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--accent)]/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">{localize("Quote style")}</span>
              <HelpTooltip
                text={localize(
                  "Choose how straight and smart quotation marks are unified in chat inputs and displayed AI output.",
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUOTE_FORMAT_OPTIONS.map((option) => {
                const active = quoteFormat === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setQuoteFormat(option.id)}
                    className={SETTINGS_CHOICE_CARD_CLASS}
                  >
                    <span className="font-semibold">{localize(option.label)}</span>
                    <span className="text-[0.625rem] opacity-80">{option.sample}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.gamePlayback.title")}
        description={localizeUi("settings.sections.gamePlayback.description")}
        icon={<ScrollText size="0.875rem" />}
        {...getSettingsSectionAnchorProps("game-playback")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("game-instant-text-reveal")}
            label={localizeUi("settings.controls.gameInstantText.label")}
            checked={gameInstantTextReveal}
            onChange={setGameInstantTextReveal}
            help={localizeUi("settings.controls.gameInstantText.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("game-middle-mouse-navigation")}
            label={localizeUi("settings.controls.gameMouseNavigation.label")}
            checked={gameMiddleMouseNav}
            onChange={setGameMiddleMouseNav}
            help={localizeUi("settings.controls.gameMouseNavigation.help")}
          />

          {!gameInstantTextReveal && (
            <label
              id={getSettingsControlAnchorId("game-narration-speed")}
              className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--accent)]/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">{localize("Game narration speed")}</span>
                <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{gameTextSpeed}</span>
                <HelpTooltip
                  text={localize(
                    "How fast the typewriter effect displays narration text in Game mode. Lower values give a slower cinematic reveal. Higher values show text almost instantly.",
                  )}
                />
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={gameTextSpeed}
                onChange={(e) => setGameTextSpeed(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[0.625rem] text-[var(--muted-foreground)]">
                <span>{localize("Slow")}</span>
                <span>{localize("Fast")}</span>
              </div>
            </label>
          )}

          <label
            id={getSettingsControlAnchorId("game-auto-play-delay")}
            className="flex scroll-mt-3 flex-col gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--accent)]/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">{localize("Game auto-play segment delay")}</span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                {t("settings.units.secondsShort", {
                  value: new Intl.NumberFormat(localization.resolvedLanguage ?? localization.language, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(gameAutoPlayDelay / 1000),
                })}
              </span>
              <HelpTooltip
                text={localize(
                  "Pause between each narration segment when auto-play is enabled in Game mode. Enable auto-play via the ▶ button next to Next.",
                )}
              />
            </div>
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={gameAutoPlayDelay}
              onChange={(e) => setGameAutoPlayDelay(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[0.625rem] text-[var(--muted-foreground)]">
              <span>{t("settings.common.short")}</span>
              <span>{t("settings.common.long")}</span>
            </div>
          </label>
        </div>
      </SettingsSection>
    </div>
  );
}

function OverallGenerationSettings() {
  const { t: localizeUi } = useUiTranslation();
  const queueImageGenerationRequests = useUIStore((s) => s.queueImageGenerationRequests);
  const setQueueImageGenerationRequests = useUIStore((s) => s.setQueueImageGenerationRequests);
  const reviewImagePromptsBeforeSend = useUIStore((s) => s.reviewImagePromptsBeforeSend);
  const setReviewImagePromptsBeforeSend = useUIStore((s) => s.setReviewImagePromptsBeforeSend);

  return (
    <SettingsSection
      title={localizeUi("settings.sections.overallGenerations.title")}
      description={localizeUi("settings.sections.overallGenerations.componentDescription")}
      icon={<WandSparkles size="0.875rem" />}
      {...getSettingsSectionAnchorProps("overall-generations")}
    >
      <div className="flex flex-col gap-2.5">
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("queue-media-generation")}
          label={localizeUi("settings.controls.queueMedia.label")}
          checked={queueImageGenerationRequests}
          onChange={setQueueImageGenerationRequests}
          help={localizeUi("settings.controls.queueMedia.help")}
        />
        <ToggleSetting
          anchorId={getSettingsControlAnchorId("image-prompt-review")}
          label={localizeUi("settings.controls.reviewMediaPrompts.label")}
          checked={reviewImagePromptsBeforeSend}
          onChange={setReviewImagePromptsBeforeSend}
          help={localizeUi("settings.controls.reviewMediaPrompts.help")}
        />
      </div>
    </SettingsSection>
  );
}

function ImageGenerationSettings() {
  const { t: localizeUi } = useUiTranslation();
  const autoSaveToGalleries = useUIStore((s) => s.autoSaveGeneratedImagesToGalleries);
  const setAutoSaveToGalleries = useUIStore((s) => s.setAutoSaveGeneratedImagesToGalleries);
  const imageBackgroundWidth = useUIStore((s) => s.imageBackgroundWidth);
  const imageBackgroundHeight = useUIStore((s) => s.imageBackgroundHeight);
  const setImageBackgroundDimensions = useUIStore((s) => s.setImageBackgroundDimensions);
  const imageIllustrationWidth = useUIStore((s) => s.imageIllustrationWidth);
  const imageIllustrationHeight = useUIStore((s) => s.imageIllustrationHeight);
  const setImageIllustrationDimensions = useUIStore((s) => s.setImageIllustrationDimensions);
  const imageGameWidth = useUIStore((s) => s.imageGameWidth);
  const imageGameHeight = useUIStore((s) => s.imageGameHeight);
  const setImageGameDimensions = useUIStore((s) => s.setImageGameDimensions);
  const imagePortraitWidth = useUIStore((s) => s.imagePortraitWidth);
  const imagePortraitHeight = useUIStore((s) => s.imagePortraitHeight);
  const setImagePortraitDimensions = useUIStore((s) => s.setImagePortraitDimensions);
  const imageCharacterSheetWidth = useUIStore((s) => s.imageCharacterSheetWidth);
  const imageCharacterSheetHeight = useUIStore((s) => s.imageCharacterSheetHeight);
  const setImageCharacterSheetDimensions = useUIStore((s) => s.setImageCharacterSheetDimensions);
  const imageSelfieWidth = useUIStore((s) => s.imageSelfieWidth);
  const imageSelfieHeight = useUIStore((s) => s.imageSelfieHeight);
  const setImageSelfieDimensions = useUIStore((s) => s.setImageSelfieDimensions);
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  const setImageStyleProfiles = useUIStore((s) => s.setImageStyleProfiles);

  return (
    <SettingsSection
      title={localizeUi("settings.sections.imageGeneration.title")}
      description={localizeUi("settings.sections.imageGeneration.componentDescription")}
      icon={<Image size="0.875rem" />}
      {...getSettingsSectionAnchorProps("image-generation")}
    >
      <div className="flex flex-col gap-2.5">
        <ToggleSetting
          label={localizeUi("settings.controls.autoSaveGeneratedImagesToGalleries.label")}
          help={localizeUi("settings.controls.autoSaveGeneratedImagesToGalleries.help")}
          checked={autoSaveToGalleries}
          onChange={setAutoSaveToGalleries}
        />
        <ImageDimensionRow
          controlId="image-background-size"
          label={localizeUi("settings.controls.backgroundGeneration.label")}
          help={localizeUi("settings.controls.backgroundGeneration.help")}
          width={imageBackgroundWidth}
          height={imageBackgroundHeight}
          onCommit={setImageBackgroundDimensions}
        />
        <ImageDimensionRow
          controlId="image-illustration-size"
          label={localizeUi("settings.controls.illustrations.label")}
          help={localizeUi("settings.controls.illustrations.help")}
          width={imageIllustrationWidth}
          height={imageIllustrationHeight}
          onCommit={setImageIllustrationDimensions}
        />
        <ImageDimensionRow
          controlId="image-game-size"
          label={localizeUi("settings.controls.gameGeneration.label")}
          help={localizeUi("settings.controls.gameGeneration.help")}
          width={imageGameWidth}
          height={imageGameHeight}
          onCommit={setImageGameDimensions}
        />
        <ImageDimensionRow
          controlId="image-portrait-size"
          label={localizeUi("settings.controls.portraits.label")}
          help={localizeUi("settings.controls.portraits.help")}
          width={imagePortraitWidth}
          height={imagePortraitHeight}
          onCommit={setImagePortraitDimensions}
        />
        <ImageDimensionRow
          controlId="image-character-sheet-size"
          label={localizeUi("settings.controls.characterSheets.label")}
          help={localizeUi("settings.controls.characterSheets.help")}
          width={imageCharacterSheetWidth}
          height={imageCharacterSheetHeight}
          onCommit={setImageCharacterSheetDimensions}
        />
        <ImageDimensionRow
          controlId="image-selfie-size"
          label={localizeUi("settings.controls.selfies.label")}
          help={localizeUi("settings.controls.selfies.help")}
          width={imageSelfieWidth}
          height={imageSelfieHeight}
          onCommit={setImageSelfieDimensions}
        />

        <div id={getSettingsControlAnchorId("image-style-profiles")} className="mt-1 scroll-mt-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
            {localizeUi("ui.panels.imagegenerationsettings.styleProfiles")}
            <HelpTooltip
              text={localizeUi(
                "ui.panels.imagegenerationsettings.definesWhatAnimeDanbooruRealisticAndCustomStylesMean",
              )}
            />
          </div>
          <ImageStyleProfilesEditor value={imageStyleProfiles} onChange={setImageStyleProfiles} />
        </div>
      </div>
    </SettingsSection>
  );
}

const VIDEO_GENERATION_SETTINGS_QUERY_KEY = ["app-settings", VIDEO_GENERATION_SETTINGS_KEY] as const;

function serializeVideoGenerationSettings(settings: VideoGenerationUserSettings): string {
  return JSON.stringify(normalizeVideoGenerationUserSettings(settings));
}

function VideoGenerationSettings() {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const videoSettingsQuery = useQuery<AppSettingsResponse>({
    queryKey: VIDEO_GENERATION_SETTINGS_QUERY_KEY,
    queryFn: () => api.get(`/app-settings/${VIDEO_GENERATION_SETTINGS_KEY}`),
    staleTime: 60_000,
  });
  const savedSettings = useMemo(
    () => normalizeVideoGenerationUserSettings(videoSettingsQuery.data?.value ?? null),
    [videoSettingsQuery.data?.value],
  );
  const [draft, setDraft] = useState<VideoGenerationUserSettings>(savedSettings);

  useEffect(() => {
    setDraft(savedSettings);
  }, [savedSettings]);

  const saveVideoSettings = useMutation<AppSettingsResponse, Error, VideoGenerationUserSettings>({
    mutationFn: (next) =>
      api.put<AppSettingsResponse>(`/app-settings/${VIDEO_GENERATION_SETTINGS_KEY}`, {
        value: serializeVideoGenerationSettings(next),
      }),
    onSuccess: (data) => {
      qc.setQueryData(VIDEO_GENERATION_SETTINGS_QUERY_KEY, data);
    },
    onError: (err) => {
      setDraft(savedSettings);
      toast.error(err.message || localizeUi("ui.panels.videogenerationsettings.failedToSaveVideoGenerationSettings"));
    },
  });

  const commitSettings = useCallback(
    (next: VideoGenerationUserSettings) => {
      const normalized = normalizeVideoGenerationUserSettings(next);
      setDraft(normalized);
      saveVideoSettings.mutate(normalized);
    },
    [saveVideoSettings],
  );

  const handleSceneDurationChange = (duration: number) => {
    commitSettings({ ...draft, sceneVideoDurationSeconds: duration });
  };

  const handleCallClipDurationChange = (kind: ConversationCallCharacterVideoClipKind, duration: number) => {
    commitSettings({
      ...draft,
      callClipDurations: {
        ...draft.callClipDurations,
        [kind]: duration,
      },
    });
  };

  const handleCustomClipDurationChange = (duration: number) => {
    commitSettings({ ...draft, callCustomClipDurationSeconds: duration });
  };

  const handleAnimatedExpressionDurationChange = (duration: number) => {
    commitSettings({ ...draft, animatedExpressionClipDurationSeconds: duration });
  };

  return (
    <SettingsSection
      title={localizeUi("settings.sections.videoGeneration.title")}
      description={localizeUi("settings.sections.videoGeneration.componentDescription")}
      icon={<Film size="0.875rem" />}
      {...getSettingsSectionAnchorProps("video-generation")}
    >
      {videoSettingsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--background)]/55 px-3 py-2 text-xs text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          <Loader2 size="0.8125rem" className="animate-spin" />
          {localizeUi("ui.panels.videogenerationsettings.loadingVideoSettings")}
        </div>
      ) : videoSettingsQuery.isError ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-2.5 py-2 text-xs text-[var(--destructive)] ring-1 ring-[var(--destructive)]/20">
          <AlertTriangle size="0.8125rem" className="shrink-0" />
          {localizeUi("ui.panels.videogenerationsettings.couldNotLoadVideoSettings")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            id={getSettingsControlAnchorId("video-scene-duration")}
            className="grid scroll-mt-3 gap-2 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                {localizeUi("ui.panels.videogenerationsettings.sceneVideoFallbackLength")}
                <HelpTooltip
                  text={localizeUi("ui.panels.videogenerationsettings.usedByGameAndGallerySceneVideosWhenThe")}
                />
              </div>
              <div className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.videogenerationsettings.secondsClampedFrom")} {VIDEO_SCENE_DURATION_MIN}{" "}
                {localizeUi("ui.noodle.wizardfooter.to")} {VIDEO_SCENE_DURATION_MAX}.
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,4rem)_auto] items-center gap-1.5 sm:w-28">
              <DraftNumberInput
                value={draft.sceneVideoDurationSeconds}
                min={VIDEO_SCENE_DURATION_MIN}
                max={VIDEO_SCENE_DURATION_MAX}
                onCommit={handleSceneDurationChange}
                className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
                ariaLabel="Scene video fallback length in seconds"
              />
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.stageprofileview.s")}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)]">
            <div className="mb-2 flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
              {localizeUi("ui.panels.videogenerationsettings.conversationCallClips")}
              <HelpTooltip
                text={localizeUi(
                  "ui.panels.videogenerationsettings.lengthsForGeneratedCharacterVideoCallPresenceClipsIdle",
                )}
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2">
              {CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.map((kind) => (
                <label
                  key={kind}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-[var(--secondary)]/60 px-2.5 py-2 ring-1 ring-[var(--border)]/80"
                >
                  <span className="truncate text-xs text-[var(--foreground)]">
                    {CONVERSATION_CALL_VIDEO_CLIP_LABELS[kind]}
                  </span>
                  <span className="grid w-[3.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                    <DraftNumberInput
                      value={draft.callClipDurations[kind]}
                      min={VIDEO_CALL_CLIP_DURATION_MIN}
                      max={VIDEO_CALL_CLIP_DURATION_MAX}
                      onCommit={(duration) => handleCallClipDurationChange(kind, duration)}
                      className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-xs"
                      ariaLabel={`${CONVERSATION_CALL_VIDEO_CLIP_LABELS[kind]} length in seconds`}
                    />
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.noodle.stageprofileview.s")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-[var(--secondary)]/60 px-2.5 py-2 ring-1 ring-[var(--border)]/80">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xs text-[var(--foreground)]">
                  {localizeUi("ui.panels.videogenerationsettings.customRequest")}
                </span>
                <span className="text-[0.55rem] leading-snug text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.videogenerationsettings.usedForOneOffClipsCharactersGenerateFromExplicit")}
                </span>
              </span>
              <span className="grid w-[3.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                <DraftNumberInput
                  value={draft.callCustomClipDurationSeconds}
                  min={VIDEO_CALL_CLIP_DURATION_MIN}
                  max={VIDEO_CALL_CLIP_DURATION_MAX}
                  onCommit={handleCustomClipDurationChange}
                  className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-xs"
                  ariaLabel="Custom call clip length in seconds"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.stageprofileview.s")}
                </span>
              </span>
            </label>
            <div className="mt-2 text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.videogenerationsettings.callClipsAreClampedFrom")} {VIDEO_CALL_CLIP_DURATION_MIN}{" "}
              {localizeUi("ui.noodle.wizardfooter.to")} {VIDEO_CALL_CLIP_DURATION_MAX}{" "}
              {localizeUi("ui.panels.videogenerationsettings.seconds")}
              {saveVideoSettings.isPending ? localizeUi("chat.settings.inlineEditor.saving") : ""}
            </div>
          </div>

          <div
            id={getSettingsControlAnchorId("video-animated-expression-duration")}
            className="grid scroll-mt-3 gap-2 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                {localizeUi("ui.panels.videogenerationsettings.animatedExpressionLength")}
                <HelpTooltip
                  text={localizeUi(
                    "ui.panels.videogenerationsettings.usedByExpressionEngineAnimatedPortraitGenerationBeforeThe",
                  )}
                />
              </div>
              <div className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.videogenerationsettings.secondsClampedFrom")}{" "}
                {VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN} {localizeUi("ui.noodle.wizardfooter.to")}{" "}
                {VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX}.
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,4rem)_auto] items-center gap-1.5 sm:w-28">
              <DraftNumberInput
                value={draft.animatedExpressionClipDurationSeconds}
                min={VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN}
                max={VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX}
                onCommit={handleAnimatedExpressionDurationChange}
                className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
                ariaLabel="Animated expression clip length in seconds"
              />
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.stageprofileview.s")}
              </span>
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

function GameAssetsSettings() {
  const { t: localizeUi } = useUiTranslation();
  const rescanGameAssets = useRescanGameAssets();
  const openGameAssetsFolder = useOpenGameAssetsFolder();
  const openGameAssetsBrowser = useUIStore((s) => s.openGameAssetsBrowser);
  const assetFileRef = useRef<HTMLInputElement>(null);
  const [assetCategory, setAssetCategory] = useState<GameAssetCategoryId>("backgrounds");
  const [assetSubcategory, setAssetSubcategory] = useState<string>(
    GAME_ASSET_CATEGORY_BY_ID.get("backgrounds")?.defaultFolder ?? "custom",
  );
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [assetUploading, setAssetUploading] = useState(false);
  const assetCategoryMeta = GAME_ASSET_CATEGORY_BY_ID.get(assetCategory) ?? GAME_ASSET_CATEGORIES[0];

  const handleAssetCategoryChange = (nextCategory: GameAssetCategoryId) => {
    setAssetCategory(nextCategory);
    setAssetSubcategory(GAME_ASSET_CATEGORY_BY_ID.get(nextCategory)?.defaultFolder ?? "custom");
    setAssetFiles([]);
    if (assetFileRef.current) assetFileRef.current.value = "";
  };

  const handleOpenGameAssetFolder = (subfolder: string) => {
    openGameAssetsFolder.mutate(subfolder, {
      onError: (error) => {
        if (error instanceof HostDeviceFileManagerError) return;
        toast.error(
          getPrivilegedActionErrorMessage(
            error,
            localizeUi("ui.panels.gameassetssettings.failedToOpenGameAssetsFolder"),
          ),
        );
      },
    });
  };

  const handleGameAssetUpload = async () => {
    if (assetUploading) return;
    if (assetFiles.length === 0) {
      toast.error(localizeUi("ui.panels.gameassetssettings.chooseAtLeastOneAssetFileFirst"));
      return;
    }
    const folder = assetSubcategory.trim().replace(/^\/+|\/+$/g, "") || assetCategoryMeta.defaultFolder;
    if (folder.includes("..") || folder.includes("\\") || folder.startsWith("/")) {
      toast.error(localizeUi("ui.panels.gameassetssettings.folderNamesCannotContainPathTraversal"));
      return;
    }

    const tooLarge = assetFiles.find((file) => file.size > 50 * 1024 * 1024);
    if (tooLarge) {
      toast.error(
        localizeUi("ui.panels.gameassetssettings.value1IsTooLargeGameAssetsAreLimitedTo", { value1: tooLarge.name }),
      );
      return;
    }

    setAssetUploading(true);
    try {
      const uploads = await Promise.allSettled(
        assetFiles.map((file) => {
          const form = new FormData();
          form.append("category", assetCategory);
          form.append("subcategory", folder);
          form.append("file", file, file.name);
          return api.upload<{ tag: string; path: string; manifestCount: number }>("/game-assets/upload", form);
        }),
      );
      const succeeded = uploads.filter((result) => result.status === "fulfilled").length;
      const failed = uploads.length - succeeded;
      await rescanGameAssets.mutateAsync();
      if (succeeded > 0) {
        toast.success(
          localizeUi("ui.panels.gameassetssettings.uploadedValue1GameAssetValue2", {
            value1: succeeded,
            value2: succeeded === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      }
      if (failed > 0) {
        const reason = uploads.find((result) => result.status === "rejected");
        toast.error(
          reason?.status === "rejected" && reason.reason instanceof Error
            ? reason.reason.message
            : localizeUi("ui.panels.gameassetssettings.value1AssetUploadValue2Failed", {
                value1: failed,
                value2: failed === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
              }),
        );
      }
      setAssetFiles([]);
      if (assetFileRef.current) assetFileRef.current.value = "";
    } finally {
      setAssetUploading(false);
    }
  };

  return (
    <SettingsSection
      title={localizeUi("settings.sections.gameAssets.title")}
      description={localizeUi("settings.sections.gameAssets.componentDescription")}
      icon={<FolderOpen size="0.875rem" />}
      {...getSettingsSectionAnchorProps("game-assets")}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={openGameAssetsBrowser}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
            title={localizeUi("settings.actions.openAssetBrowser")}
          >
            <Image size="0.8125rem" />
            {localizeUi("ui.panels.gameassetssettings.assetBrowser")}
          </button>
          <button
            type="button"
            onClick={() => {
              rescanGameAssets
                .mutateAsync()
                .then(() => toast.success(localizeUi("ui.panels.gameassetssettings.gameAssetsRescanned")))
                .catch(() => toast.error(localizeUi("ui.panels.gameassetssettings.failedToRescanGameAssets")));
            }}
            className={cn(SETTINGS_BUTTON_CLASS, "w-full")}
          >
            <RefreshCw size="0.75rem" />
            {localizeUi("ui.panels.gameassetssettings.rescan")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {GAME_ASSET_CATEGORIES.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => handleOpenGameAssetFolder(folder.id)}
              className={cn(SETTINGS_BUTTON_CLASS, "capitalize")}
            >
              <FolderOpen size="0.75rem" />
              {folder.id}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.gameassetssettings.type")}
            </span>
            <select
              value={assetCategory}
              onChange={(e) => handleAssetCategoryChange(e.target.value as GameAssetCategoryId)}
              className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]"
            >
              {GAME_ASSET_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.gameassetssettings.folder")}
            </span>
            <input
              value={assetSubcategory}
              onChange={(e) => setAssetSubcategory(e.target.value)}
              placeholder={assetCategoryMeta.defaultFolder}
              className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={assetFileRef}
            type="file"
            multiple
            accept={assetCategoryMeta.accept}
            className="hidden"
            onChange={(e) => setAssetFiles(Array.from(e.target.files ?? []))}
          />
          <button type="button" onClick={() => assetFileRef.current?.click()} className={SETTINGS_BUTTON_CLASS}>
            <Upload size="0.75rem" />
            {localizeUi("ui.panels.gameassetssettings.chooseFiles")}
          </button>
          <button
            type="button"
            onClick={handleGameAssetUpload}
            disabled={assetUploading || assetFiles.length === 0}
            className={SETTINGS_BUTTON_CLASS}
          >
            {assetUploading ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
            {localizeUi("ui.panels.gameassetssettings.uploadToServer")}
          </button>
          {assetFiles.length > 0 && (
            <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
              {assetFiles.length === 1
                ? assetFiles[0]?.name
                : localizeUi("ui.panels.gameassetssettings.value1FilesSelected", { value1: assetFiles.length })}
            </span>
          )}
        </div>

        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.gameassetssettings.audioSupportsMp3OggWavFlacM4aAacAnd")}
        </p>
      </div>
    </SettingsSection>
  );
}

function ChatWidgetStylePreview({
  preset,
  font,
  shape,
  colors,
}: {
  preset: ChatWidgetPreset;
  font: string;
  shape: ChatWidgetShape;
  colors?: ChatWidgetColors;
}) {
  const { t } = useUiTranslation();
  const colorStyle = getChatWidgetColorStyle(colors);
  const presetIconClassName =
    preset !== "default" || colorStyle["--mari-widget-custom-border"] ? "mari-rgb-static-icon" : undefined;
  return (
    <span
      aria-hidden="true"
      data-chat-widget-preview
      data-chat-widget-colors={getChatWidgetColorRoles(colorStyle) || undefined}
      data-chat-widget-preset={preset}
      data-chat-widget-font={font}
      data-chat-widget-shape={shape}
      className="mari-widget-style-preview pointer-events-none block min-w-0 w-full"
      style={
        {
          "--mari-widget-font-override": getChatWidgetFontFamily(font) ?? "initial",
          ...colorStyle,
        } as React.CSSProperties
      }
    >
      <span className="mari-window mari-widget-style-preview__window relative flex min-w-0 flex-col">
        <span className="mari-window__header flex min-w-0 items-center justify-between gap-1">
          <span className="mari-window__title min-w-0 truncate">{t("chat.help.targets.settings.title")}</span>
          <X
            size="0.625rem"
            className={cn(
              "shrink-0",
              presetIconClassName,
              presetIconClassName &&
                "text-[var(--mari-window-control-color,var(--mari-widget-custom-border-solid,var(--mari-widget-accent,var(--marinara-chat-chrome-panel-muted))))]",
            )}
          />
        </span>
        <span className="mari-window__body block p-1.5">
          <span className="mari-drawer block">
            <span className="mari-drawer__header flex min-w-0 items-center gap-1">
              <FileText size="0.625rem" className={cn("mari-drawer__icon shrink-0", presetIconClassName)} />
              <span className="mari-drawer__title min-w-0 flex-1 truncate">{t("settings.common.section")}</span>
              <ChevronDown size="0.625rem" className={cn("mari-drawer__arrow shrink-0", presetIconClassName)} />
            </span>
          </span>
        </span>
      </span>
      <span className="flex justify-center pt-3">
        <span className="mari-window-bubble relative">
          <span className="mari-window-bubble__paint pointer-events-none" aria-hidden="true" />
          <span className="mari-window-bubble__icon">
            <SlidersHorizontal size="0.875rem" className={presetIconClassName} />
          </span>
        </span>
      </span>
    </span>
  );
}

function AppearanceSettings({ group = "app" }: { group?: AppearanceGroup }) {
  const { t: localizeUi } = useUiTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const rightPanelWidth = useUIStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = useUIStore((state) => state.setRightPanelWidth);
  const appBackgroundColor = useUIStore((s) => s.appBackgroundColor);
  const setAppBackgroundColor = useUIStore((s) => s.setAppBackgroundColor);
  const appAccentColor = useUIStore((s) => s.appAccentColor);
  const setAppAccentColor = useUIStore((s) => s.setAppAccentColor);
  const appAccentPulseMode = useUIStore((s) => s.appAccentPulseMode);
  const setAppAccentPulseMode = useUIStore((s) => s.setAppAccentPulseMode);
  const appAccentRgbMode = useUIStore((s) => s.appAccentRgbMode);
  const setAppAccentRgbMode = useUIStore((s) => s.setAppAccentRgbMode);
  const customCursorEnabled = useUIStore((s) => s.customCursorEnabled);
  const setCustomCursorEnabled = useUIStore((s) => s.setCustomCursorEnabled);
  const reduceAmbientEffects = useUIStore((s) => s.reduceAmbientEffects);
  const setReduceAmbientEffects = useUIStore((s) => s.setReduceAmbientEffects);
  const defaultAppBackgroundColor = getDefaultAppBackgroundColor(theme);
  const displayedAppBackgroundColor =
    appBackgroundColor.trim().toLowerCase() === defaultAppBackgroundColor.toLowerCase() ? "" : appBackgroundColor;
  const defaultAppAccentColor = getDefaultAppAccentColor();
  const displayedAppAccentColor =
    appAccentColor.trim().toLowerCase() === defaultAppAccentColor.toLowerCase() ? "" : appAccentColor;
  const visualTheme = useUIStore((s) => s.visualTheme);
  const setVisualTheme = useUIStore((s) => s.setVisualTheme);
  const chatWidgetPreset = useUIStore((s) => s.chatWidgetPreset);
  const setChatWidgetPreset = useUIStore((s) => s.setChatWidgetPreset);
  const chatWidgetFont = useUIStore((s) => s.chatWidgetFont);
  const setChatWidgetFont = useUIStore((s) => s.setChatWidgetFont);
  const chatWidgetShape = useUIStore((s) => s.chatWidgetShape);
  const chatWidgetButtonSize = useUIStore((s) => s.chatWidgetButtonSize);
  const setChatWidgetButtonSize = useUIStore((s) => s.setChatWidgetButtonSize);
  const setChatWidgetShape = useUIStore((s) => s.setChatWidgetShape);
  const chatWidgetBorderColor = useUIStore((s) => s.chatWidgetBorderColor);
  const setChatWidgetBorderColor = useUIStore((s) => s.setChatWidgetBorderColor);
  const chatWidgetBackgroundColor = useUIStore((s) => s.chatWidgetBackgroundColor);
  const setChatWidgetBackgroundColor = useUIStore((s) => s.setChatWidgetBackgroundColor);
  const chatWidgetTextColor = useUIStore((s) => s.chatWidgetTextColor);
  const setChatWidgetTextColor = useUIStore((s) => s.setChatWidgetTextColor);
  const chatWidgetApplyFont = useUIStore((s) => s.chatWidgetApplyFont);
  const setChatWidgetApplyFont = useUIStore((s) => s.setChatWidgetApplyFont);
  const chatWidgetApplyShape = useUIStore((s) => s.chatWidgetApplyShape);
  const setChatWidgetApplyShape = useUIStore((s) => s.setChatWidgetApplyShape);
  const chatWidgetApplyColors = useUIStore((s) => s.chatWidgetApplyColors);
  const setChatWidgetApplyColors = useUIStore((s) => s.setChatWidgetApplyColors);
  const chatBackground = useUIStore((s) => s.chatBackground);
  const setChatBackgroundRaw = useUIStore((s) => s.setChatBackground);
  const defaultRoleplayBackground = useUIStore((s) => s.defaultRoleplayBackground);
  const setDefaultRoleplayBackground = useUIStore((s) => s.setDefaultRoleplayBackground);
  const chatBackgroundBlur = useUIStore((s) => s.chatBackgroundBlur);
  const setChatBackgroundBlur = useUIStore((s) => s.setChatBackgroundBlur);
  const conversationBackgroundImageOpacity = useUIStore((s) => s.conversationBackgroundImageOpacity);
  const setConversationBackgroundImageOpacity = useUIStore((s) => s.setConversationBackgroundImageOpacity);
  const resetAppearanceSettings = useUIStore((s) => s.resetAppearanceSettings);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: appearanceChat } = useChat(activeChatId);
  const updateMeta = useUpdateChatMetadata();
  const setActiveSyncedTheme = useSetActiveTheme();
  const handleOpenFontsFolder = async () => {
    if (!isHostDeviceBrowser()) {
      toast.info(HOST_DEVICE_FILE_MANAGER_MESSAGE);
      return;
    }
    try {
      await api.post("/fonts/open-folder");
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(error, localizeUi("ui.panels.appearancesettings.couldNotOpenFontsFolder")),
      );
    }
  };
  const handleAppBackgroundColorChange = useCallback(
    (color: string) => {
      const normalized = color.trim();
      setAppBackgroundColor(normalized.toLowerCase() === defaultAppBackgroundColor.toLowerCase() ? "" : normalized);
    },
    [defaultAppBackgroundColor, setAppBackgroundColor],
  );
  const handleAppAccentColorChange = useCallback(
    (color: string) => {
      const normalized = color.trim();
      const normalizedAccent = normalized.toLowerCase() === defaultAppAccentColor.toLowerCase() ? "" : normalized;

      setAppAccentColor(normalizedAccent);
    },
    [defaultAppAccentColor, setAppAccentColor],
  );
  const handleAppAccentRgbModeChange = useCallback(
    (enabled: boolean) => {
      if (enabled && appAccentPulseMode) {
        setAppAccentPulseMode(false);
      }
      setAppAccentRgbMode(enabled);
    },
    [appAccentPulseMode, setAppAccentPulseMode, setAppAccentRgbMode],
  );
  const handleAppAccentPulseModeChange = useCallback(
    (enabled: boolean) => {
      if (enabled && appAccentRgbMode) {
        setAppAccentRgbMode(false);
      }
      setAppAccentPulseMode(enabled);
    },
    [appAccentRgbMode, setAppAccentPulseMode, setAppAccentRgbMode],
  );
  // Persist background changes to the active chat's metadata immediately so
  // a clear (or pick) survives chat switches and page reloads. The effect-based
  // persist in ChatArea covers other sources (agents/scene/slash commands), but
  // for the Settings UI we wire the mutation directly to the click to remove
  // any timing ambiguity around clearing.
  const setChatBackground = useCallback(
    (url: string | null) => {
      setChatBackgroundRaw(url);
      if (!activeChatId) return;
      updateMeta.mutate({ id: activeChatId, background: chatBackgroundUrlToMetadata(url) });
    },
    [setChatBackgroundRaw, activeChatId, updateMeta],
  );
  const fontFamily = useUIStore((s) => s.fontFamily);
  const setFontFamily = useUIStore((s) => s.setFontFamily);
  const convoGradient = useUIStore((s) => s.convoGradient);
  const setConvoGradientField = useUIStore((s) => s.setConvoGradientField);
  const [activeGradientScheme, setActiveGradientScheme] = useState<"dark" | "light">(theme);
  const currentGradient = convoGradient[activeGradientScheme];
  const [draftFrom, setDraftFrom] = useState(currentGradient.from);
  const [draftTo, setDraftTo] = useState(currentGradient.to);
  const pendingGradientChangeRef = useRef<{
    scheme: "dark" | "light";
    field: "from" | "to";
    value: string;
  } | null>(null);
  const pendingGradientFrameRef = useRef<number | null>(null);

  const flushPendingGradientChange = useCallback(() => {
    if (pendingGradientFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingGradientFrameRef.current);
      pendingGradientFrameRef.current = null;
    }

    const pending = pendingGradientChangeRef.current;
    pendingGradientChangeRef.current = null;
    if (pending) {
      setConvoGradientField(pending.scheme, pending.field, pending.value);
    }
  }, [setConvoGradientField]);

  const cancelPendingGradientChange = useCallback(() => {
    if (pendingGradientFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingGradientFrameRef.current);
      pendingGradientFrameRef.current = null;
    }
    pendingGradientChangeRef.current = null;
  }, []);

  useEffect(
    () => () => {
      flushPendingGradientChange();
    },
    [flushPendingGradientChange],
  );

  const commitConvoGradientField = useCallback(
    (scheme: "dark" | "light", field: "from" | "to", value: string, defer = false) => {
      if (!defer) {
        cancelPendingGradientChange();
        setConvoGradientField(scheme, field, value);
        return;
      }

      pendingGradientChangeRef.current = { scheme, field, value };
      if (pendingGradientFrameRef.current !== null) return;
      pendingGradientFrameRef.current = window.requestAnimationFrame(() => {
        pendingGradientFrameRef.current = null;
        const pending = pendingGradientChangeRef.current;
        pendingGradientChangeRef.current = null;
        if (pending) {
          setConvoGradientField(pending.scheme, pending.field, pending.value);
        }
      });
    },
    [cancelPendingGradientChange, setConvoGradientField],
  );

  const handleGradientColorInput = useCallback(
    (field: "from" | "to", value: string) => {
      commitConvoGradientField(activeGradientScheme, field, value, true);
    },
    [activeGradientScheme, commitConvoGradientField],
  );

  // Sync draft inputs when switching between scheme tabs so the text fields
  // always reflect the stored value for the active scheme.
  useEffect(() => {
    setDraftFrom(currentGradient.from);
    setDraftTo(currentGradient.to);
  }, [activeGradientScheme, currentGradient.from, currentGradient.to]);
  const handleResetAppearance = useCallback(() => {
    resetAppearanceSettings();
    setActiveGradientScheme("dark");
    setDraftFrom("#0a0a0e");
    setDraftTo("#1c2133");
    document.getElementById("marinara-css-editor-preview")?.remove();
    if (activeChatId) {
      updateMeta.mutate({ id: activeChatId, background: chatBackgroundUrlToMetadata(null) });
    }
    void setActiveSyncedTheme
      .mutateAsync(null)
      .then(() => {
        toast.success(localizeUi("ui.panels.appearancesettings.appearanceResetToMarinaraDefaults"));
      })
      .catch((err) => {
        console.error("[AppearanceSettings] Failed to clear active synced theme:", err);
        toast.warning(localizeUi("ui.panels.appearancesettings.appearanceResetLocallyButTheActiveSyncedThemeCould"));
      });
  }, [activeChatId, resetAppearanceSettings, setActiveSyncedTheme, updateMeta, localizeUi]);
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const chatFontSize = useUIStore((s) => s.chatFontSize);
  const setChatFontSize = useUIStore((s) => s.setChatFontSize);
  const conversationMessageStyle = useUIStore((s) => s.conversationMessageStyle);
  const setConversationMessageStyle = useUIStore((s) => s.setConversationMessageStyle);
  const alwaysDisplayConversationSwipeMenu = useUIStore((s) => s.alwaysDisplayConversationSwipeMenu);
  const setAlwaysDisplayConversationSwipeMenu = useUIStore((s) => s.setAlwaysDisplayConversationSwipeMenu);
  const alwaysDisplayRoleplaySwipeMenu = useUIStore((s) => s.alwaysDisplayRoleplaySwipeMenu);
  const setAlwaysDisplayRoleplaySwipeMenu = useUIStore((s) => s.setAlwaysDisplayRoleplaySwipeMenu);
  const conversationAvatarShape = useUIStore((s) => s.conversationAvatarShape);
  const setConversationAvatarShape = useUIStore((s) => s.setConversationAvatarShape);
  const weatherEffects = useUIStore((s) => s.weatherEffects);
  const setWeatherEffects = useUIStore((s) => s.setWeatherEffects);
  // Text appearance
  const chatFontColor = useUIStore((s) => s.chatFontColor);
  const setChatFontColor = useUIStore((s) => s.setChatFontColor);
  const defaultDialogueColor = useUIStore((s) => s.defaultDialogueColor);
  const setDefaultDialogueColor = useUIStore((s) => s.setDefaultDialogueColor);
  const chatChromeTextColor = useUIStore((s) => s.chatChromeTextColor);
  const setChatChromeTextColor = useUIStore((s) => s.setChatChromeTextColor);
  const chatFontOpacity = useUIStore((s) => s.chatFontOpacity);
  const setChatFontOpacity = useUIStore((s) => s.setChatFontOpacity);
  const roleplayReducedPaintEffects = useUIStore((s) => s.roleplayReducedPaintEffects);
  const setRoleplayReducedPaintEffects = useUIStore((s) => s.setRoleplayReducedPaintEffects);
  const showRoleplayThinkingInMessages = useUIStore((s) => s.showRoleplayThinkingInMessages);
  const setShowRoleplayThinkingInMessages = useUIStore((s) => s.setShowRoleplayThinkingInMessages);
  const keepRoleplayThinkingExpanded = useUIStore((s) => s.keepRoleplayThinkingExpanded);
  const setKeepRoleplayThinkingExpanded = useUIStore((s) => s.setKeepRoleplayThinkingExpanded);
  const roleplayAvatarStyle = useUIStore((s) => s.roleplayAvatarStyle);
  const setRoleplayAvatarStyle = useUIStore((s) => s.setRoleplayAvatarStyle);
  const roleplayAvatarScale = useUIStore((s) => s.roleplayAvatarScale);
  const setRoleplayAvatarScale = useUIStore((s) => s.setRoleplayAvatarScale);
  const roleplayAvatarsScrollable = useUIStore((s) => s.roleplayAvatarsScrollable);
  const setRoleplayAvatarsScrollable = useUIStore((s) => s.setRoleplayAvatarsScrollable);
  const roleplayNarratorAvatarCycling = useUIStore((s) => s.roleplayNarratorAvatarCycling);
  const setRoleplayNarratorAvatarCycling = useUIStore((s) => s.setRoleplayNarratorAvatarCycling);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const setRoleplaySpriteScale = useUIStore((s) => s.setRoleplaySpriteScale);
  const roleplayDisplayStyle = useUIStore((s) => s.roleplayDisplayStyle);
  const setRoleplayDisplayStyle = useUIStore((s) => s.setRoleplayDisplayStyle);
  const roleplayChatPosition = useUIStore((s) => s.roleplayChatPosition);
  const setRoleplayChatPosition = useUIStore((s) => s.setRoleplayChatPosition);
  const roleplayVnPortraitScale = useUIStore((s) => s.roleplayVnPortraitScale);
  const setRoleplayVnPortraitScale = useUIStore((s) => s.setRoleplayVnPortraitScale);
  const roleplayVnSpriteScale = useUIStore((s) => s.roleplayVnSpriteScale);
  const setRoleplayVnSpriteScale = useUIStore((s) => s.setRoleplayVnSpriteScale);
  const roleplayVnAutoPlay = useUIStore((s) => s.roleplayVnAutoPlay);
  const setRoleplayVnAutoPlay = useUIStore((s) => s.setRoleplayVnAutoPlay);
  const roleplayVnAutoPlayDelay = useUIStore((s) => s.roleplayVnAutoPlayDelay);
  const setRoleplayVnAutoPlayDelay = useUIStore((s) => s.setRoleplayVnAutoPlayDelay);
  const activeRoleplayStyle =
    appearanceChat?.mode === "roleplay"
      ? (parseChatMetadata(appearanceChat.metadata).roleplayDisplayStyle ?? roleplayDisplayStyle)
      : roleplayDisplayStyle;
  const gameDialogueDisplayMode = useUIStore((s) => s.gameDialogueDisplayMode);
  const setGameDialogueDisplayMode = useUIStore((s) => s.setGameDialogueDisplayMode);
  const chatListBackgrounds = useUIStore((s) => s.chatListBackgrounds);
  const setChatListBackgrounds = useUIStore((s) => s.setChatListBackgrounds);
  const gameTextEffectsEnabled = useUIStore((s) => s.gameTextEffectsEnabled);
  const setGameTextEffectsEnabled = useUIStore((s) => s.setGameTextEffectsEnabled);
  const gameAvatarScale = useUIStore((s) => s.gameAvatarScale);
  const setGameAvatarScale = useUIStore((s) => s.setGameAvatarScale);
  const gameFullBodySpriteScale = useUIStore((s) => s.gameFullBodySpriteScale);
  const setGameFullBodySpriteScale = useUIStore((s) => s.setGameFullBodySpriteScale);
  const textStrokeWidth = useUIStore((s) => s.textStrokeWidth);
  const setTextStrokeWidth = useUIStore((s) => s.setTextStrokeWidth);
  const textStrokeColor = useUIStore((s) => s.textStrokeColor);
  const setTextStrokeColor = useUIStore((s) => s.setTextStrokeColor);

  // Custom fonts — query is pre-warmed in App.tsx, no fetch here
  const { data: customFonts } = useQuery<CustomFontFace[]>({
    queryKey: ["custom-fonts"],
    queryFn: () => api.get("/fonts"),
    staleTime: Infinity,
  });
  const customFontOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return (customFonts ?? []).filter((font) => {
      const family = font.family.trim();
      if (!family || seen.has(family)) return false;
      seen.add(family);
      return true;
    });
  }, [customFonts]);
  const unavailableWidgetFont =
    chatWidgetFont.startsWith("custom:") &&
    !customFontOptions.some((font) => `custom:${font.family}` === chatWidgetFont)
      ? chatWidgetFont.slice("custom:".length)
      : null;

  // Google Fonts download
  const [googleFontName, setGoogleFontName] = useState("");
  const queryClient = useQueryClient();
  const googleFontMutation = useMutation({
    mutationFn: (family: string) =>
      api.post<{ filename: string; family: string; url: string; files?: CustomFontFace[] }>("/fonts/google/download", {
        family,
      }),
    onSuccess: (data) => {
      toast.success(localizeUi("ui.panels.appearancesettings.installedValue1", { value1: data.family }));
      setGoogleFontName("");
      queryClient.invalidateQueries({ queryKey: ["custom-fonts"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || localizeUi("ui.panels.appearancesettings.failedToDownloadFont"));
    },
  });

  const roleplayAvatarPreviewBase: SettingsArtPreviewSize =
    roleplayAvatarStyle === "none"
      ? { width: 5, height: 2.5 }
      : roleplayAvatarStyle === "panel"
        ? { width: 2.6 * roleplayAvatarScale, height: 2 * roleplayAvatarScale }
        : {
            width: (roleplayAvatarStyle === "rectangles" ? 2.15 : 2) * roleplayAvatarScale,
            height: (roleplayAvatarStyle === "rectangles" ? 2.7 : 3.4) * roleplayAvatarScale,
          };
  const roleplaySpritePreviewBase: SettingsArtPreviewSize = {
    width: 0.85 * roleplaySpriteScale,
    height: 3.2 * roleplaySpriteScale,
  };
  const [roleplayAvatarPreviewSize, roleplaySpritePreviewSize] = fitSettingsArtPreviewSizes([
    roleplayAvatarPreviewBase,
    roleplaySpritePreviewBase,
  ]);
  const roleplayAvatarPreview = roleplayAvatarPreviewSize ?? roleplayAvatarPreviewBase;
  const roleplaySpritePreview = roleplaySpritePreviewSize ?? roleplaySpritePreviewBase;
  const gameAvatarPreviewBase: SettingsArtPreviewSize = {
    width: 2.25 * gameAvatarScale,
    height: 2.6 * gameAvatarScale,
  };
  const gameFullBodyPreviewBase: SettingsArtPreviewSize = {
    width: 0.9 * gameFullBodySpriteScale,
    height: 3.4 * gameFullBodySpriteScale,
  };
  const [gameAvatarPreviewSize, gameFullBodyPreviewSize] = fitSettingsArtPreviewSizes([
    gameAvatarPreviewBase,
    gameFullBodyPreviewBase,
  ]);
  const gameAvatarPreview = gameAvatarPreviewSize ?? gameAvatarPreviewBase;
  const gameFullBodyPreview = gameFullBodyPreviewSize ?? gameFullBodyPreviewBase;

  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>
        {localizeUi("ui.panels.appearancesettings.visualPreferencesGroupedByGlobalChromeTextConversationRoleplay")}
      </SettingsIntro>

      {group === "app" && (
        <>
          <h2 className="text-sm font-semibold" data-appearance-group="general">
            {localizeUi("settings.appearance.groups.general")}
          </h2>
          <SettingsSection
            title={localizeUi("settings.sections.appStyle.title")}
            description={localizeUi("settings.sections.appStyle.componentDescription")}
            icon={<Paintbrush size="0.875rem" />}
            {...getSettingsSectionAnchorProps("app-style")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleResetAppearance}
                  disabled={setActiveSyncedTheme.isPending}
                  className={SETTINGS_BUTTON_CLASS}
                  title={localizeUi("settings.actions.resetAppearance")}
                >
                  {setActiveSyncedTheme.isPending ? (
                    <Loader2 size="0.75rem" className="animate-spin" />
                  ) : (
                    <RotateCcw size="0.75rem" />
                  )}
                  {localizeUi("ui.panels.appearancesettings.resetAppearance")}
                </button>
              </div>
              {/* ── Visual Style ── */}
              <div className="flex min-w-0 flex-col gap-2" id={getSettingsControlAnchorId("desktop-sidebar-width")}>
                <label htmlFor="desktop-sidebar-width" className="text-xs font-medium">
                  {localizeUi("settings.appearance.sidebarWidth")}
                </label>
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("settings.appearance.sidebarWidthHelp")}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    id="desktop-sidebar-width"
                    type="range"
                    min={Math.max(SIDEBAR_WIDTH_MIN, RIGHT_PANEL_WIDTH_MIN)}
                    max={Math.min(SIDEBAR_WIDTH_MAX, RIGHT_PANEL_WIDTH_MAX)}
                    step={8}
                    value={rightPanelWidth || sidebarWidth}
                    onChange={(event) => {
                      const width = Number(event.target.value);
                      setSidebarWidth(width);
                      setRightPanelWidth(width);
                    }}
                    className="min-w-0 flex-1 accent-[var(--primary)]"
                  />
                  <output className="shrink-0 text-xs tabular-nums">
                    {localizeUi("ui.panels.appearancesettings.value1Px", { value1: rightPanelWidth || sidebarWidth })}
                  </output>
                  <button
                    type="button"
                    className={SETTINGS_BUTTON_CLASS}
                    onClick={() => {
                      setSidebarWidth(320);
                      setRightPanelWidth(320);
                    }}
                  >
                    {localizeUi("settings.appearance.resetSidebarWidth")}
                  </button>
                </span>
              </div>
              <div id={getSettingsControlAnchorId("visual-theme")} className="flex scroll-mt-3 flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Paintbrush size="0.75rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />
                  <span className="text-xs font-medium">{localizeUi("ui.panels.appearancesettings.visualStyle")}</span>
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.chooseHowTheEntireAppLooksMarinaraUsesA")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "default" as VisualTheme,
                        label: "Default (Marinara)",
                        desc: "Y2K / retro aesthetic with glow effects",
                      },
                      {
                        id: "sillytavern" as VisualTheme,
                        label: "SillyTavern",
                        desc: "Classic SillyTavern look — clean & minimal",
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={visualTheme === opt.id}
                      onClick={() => setVisualTheme(opt.id)}
                      className={SETTINGS_CHOICE_CARD_CLASS}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[0.625rem] text-[var(--muted-foreground)] leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label id={getSettingsControlAnchorId("theme-mode")} className="flex scroll-mt-3 flex-col gap-1">
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.colorScheme")}{" "}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.switchBetweenDarkAndLightModeDarkModeIs")}
                  />
                </span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as "dark" | "light")}
                  className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
                >
                  <option value="dark">{localizeUi("ui.panels.appearancesettings.dark")}</option>
                  <option value="light">{localizeUi("ui.panels.appearancesettings.light")}</option>
                </select>
              </label>

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("custom-cursor")}
                label={localizeUi("settings.controls.customPointer.label")}
                checked={customCursorEnabled}
                onChange={setCustomCursorEnabled}
                help={localizeUi("settings.controls.customPointer.help")}
              />

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("reduce-ambient-effects")}
                label={localizeUi("settings.controls.reduceAmbientEffects.label")}
                checked={reduceAmbientEffects}
                onChange={setReduceAmbientEffects}
                help={localizeUi("settings.controls.reduceAmbientEffects.help")}
              />

              <SearchableSettingTarget controlId="app-background-color">
                <ColorPicker
                  value={displayedAppBackgroundColor}
                  onChange={handleAppBackgroundColorChange}
                  gradient
                  compact
                  label={localizeUi("settings.controls.backgroundColor.label")}
                  helpText="Colors the main app shell background. Leave it on the scheme default to follow Dark and Light mode automatically. Gradients are supported for the shell paint."
                  emptyText={localizeUi("ui.panels.trackerpanelappearancedrawer.defaultValue1", {
                    value1: defaultAppBackgroundColor,
                  })}
                  emptyPreviewValue={defaultAppBackgroundColor}
                  clearLabel="Reset to default"
                />
              </SearchableSettingTarget>

              <SearchableSettingTarget controlId="app-accent-color">
                <ColorPicker
                  value={displayedAppAccentColor}
                  onChange={handleAppAccentColorChange}
                  gradient
                  compact
                  label={localizeUi("settings.controls.accentColor.label")}
                  helpText={localizeUi("settings.controls.accentColor.help")}
                  emptyText={localizeUi("ui.panels.trackerpanelappearancedrawer.defaultValue1", {
                    value1: localizeUi("ui.ui.colorpicker.marinaraGradient"),
                  })}
                  emptyPreviewValue={defaultAppAccentColor}
                  clearLabel="Reset to default"
                />
              </SearchableSettingTarget>

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("accent-pulse")}
                label={localizeUi("settings.controls.accentPulse.label")}
                checked={appAccentPulseMode}
                onChange={handleAppAccentPulseModeChange}
                help={localizeUi("settings.controls.accentPulse.help")}
              />

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("rgb-mode")}
                label={
                  <span className={cn(appAccentRgbMode && "mari-logo-gradient-text mari-logo-gradient-text--active")}>
                    {localizeUi("ui.panels.appearancesettings.rgbMode")}
                  </span>
                }
                checked={appAccentRgbMode}
                onChange={handleAppAccentRgbModeChange}
                switchClassName={appAccentRgbMode ? "mari-rgb-toggle-track" : undefined}
                help={localizeUi("settings.controls.rainbowAccent.help")}
              />

              <fieldset
                id={getSettingsControlAnchorId("chat-widget-style")}
                data-chat-widget-style-controls
                className="@container min-w-0 scroll-mt-3 pt-4"
              >
                <legend className="px-0 text-xs font-medium">
                  {localizeUi("settings.controls.chatWidgetStyle.label")}
                </legend>
                <p className="mb-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("settings.controls.chatWidgetStyle.help")}
                </p>
                <div className="grid grid-cols-1 gap-2 @min-[34rem]:grid-cols-3">
                  {(
                    [
                      {
                        id: "default",
                        labelKey: "settings.controls.chatWidgetStyle.default",
                        descriptionKey: "settings.controls.chatWidgetStyle.defaultDescription",
                      },
                      {
                        id: "dottore",
                        labelKey: "settings.controls.chatWidgetStyle.dottore",
                        descriptionKey: "settings.controls.chatWidgetStyle.dottoreDescription",
                      },
                      {
                        id: "mari",
                        labelKey: "settings.controls.chatWidgetStyle.mari",
                        descriptionKey: "settings.controls.chatWidgetStyle.mariDescription",
                      },
                    ] as const
                  ).map((preset) => {
                    const selected = chatWidgetPreset === preset.id;
                    const descriptionId = `chat-widget-preset-${preset.id}-description`;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-chat-widget-preset-option={preset.id}
                        aria-label={localizeUi(preset.labelKey)}
                        aria-describedby={descriptionId}
                        aria-pressed={selected}
                        onClick={() => setChatWidgetPreset(preset.id)}
                        className={SETTINGS_CHOICE_CARD_CLASS}
                      >
                        <span className="font-semibold">{localizeUi(preset.labelKey)}</span>
                        <ChatWidgetStylePreview
                          preset={preset.id}
                          font={selected ? chatWidgetFont : ""}
                          shape={selected ? chatWidgetShape : "preset"}
                          colors={
                            selected
                              ? {
                                  border: chatWidgetBorderColor,
                                  background: chatWidgetBackgroundColor,
                                  text: chatWidgetTextColor,
                                }
                              : undefined
                          }
                        />
                        <span
                          id={descriptionId}
                          className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]"
                        >
                          {localizeUi(preset.descriptionKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label
                    id={getSettingsControlAnchorId("chat-widget-font")}
                    className="flex min-w-0 scroll-mt-3 flex-col gap-1"
                  >
                    <span className="text-xs font-medium">{localizeUi("settings.controls.chatWidgetFont.label")}</span>
                    <select
                      id="chat-widget-font"
                      value={chatWidgetFont}
                      onChange={(event) => setChatWidgetFont(event.target.value)}
                      className="min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
                    >
                      <option value="">{localizeUi("settings.controls.chatWidgetFont.preset")}</option>
                      <option value="@app">{localizeUi("settings.controls.chatWidgetFont.app")}</option>
                      <option value="@sans">{localizeUi("settings.controls.chatWidgetFont.sans")}</option>
                      <option value="@serif">{localizeUi("settings.controls.chatWidgetFont.serif")}</option>
                      <option value="@mono">{localizeUi("settings.controls.chatWidgetFont.mono")}</option>
                      {customFontOptions.map((font) => (
                        <option key={font.family} value={`custom:${font.family}`}>
                          {font.family}
                        </option>
                      ))}
                      {unavailableWidgetFont && (
                        <option value={chatWidgetFont}>
                          {localizeUi("settings.controls.chatWidgetFont.unavailable", { font: unavailableWidgetFont })}
                        </option>
                      )}
                    </select>
                  </label>
                  <label
                    id={getSettingsControlAnchorId("chat-widget-shape")}
                    className="flex min-w-0 scroll-mt-3 flex-col gap-1"
                  >
                    <span className="text-xs font-medium">{localizeUi("settings.controls.chatWidgetShape.label")}</span>
                    <select
                      id="chat-widget-shape"
                      value={chatWidgetShape}
                      onChange={(event) => setChatWidgetShape(event.target.value as ChatWidgetShape)}
                      className="min-w-0 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
                    >
                      <option value="preset">{localizeUi("settings.controls.chatWidgetShape.preset")}</option>
                      <option value="rounded">{localizeUi("settings.controls.chatWidgetShape.rounded")}</option>
                      <option value="square">{localizeUi("settings.controls.chatWidgetShape.square")}</option>
                      <option value="cut-corner">{localizeUi("settings.controls.chatWidgetShape.cutCorner")}</option>
                      <option value="arched">{localizeUi("settings.controls.chatWidgetShape.arched")}</option>
                    </select>
                  </label>
                </div>
                <div id={getSettingsControlAnchorId("chat-widget-button-size")} className="mt-4 scroll-mt-3">
                  <label
                    htmlFor="chat-widget-button-size"
                    className="inline-flex items-center gap-1 text-xs font-medium"
                  >
                    {localizeUi("settings.controls.chatWidgetButtonSize.label")}
                    <HelpTooltip text={localizeUi("settings.controls.chatWidgetButtonSize.help")} />
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <DraftNumberInput
                      id="chat-widget-button-size"
                      allowEmpty
                      value={chatWidgetButtonSize}
                      min={32}
                      max={96}
                      onCommit={setChatWidgetButtonSize}
                      placeholder={localizeUi("settings.controls.chatWidgetButtonSize.default")}
                      className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent focus:ring-[var(--primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setChatWidgetButtonSize(null)}
                      aria-label={localizeUi("settings.controls.chatWidgetButtonSize.reset")}
                      title={localizeUi("settings.controls.chatWidgetButtonSize.reset")}
                      className={SETTINGS_ICON_BUTTON_CLASS}
                    >
                      <RotateCcw size="0.75rem" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("settings.controls.chatWidgetColors.help")}
                  </p>
                  <SearchableSettingTarget controlId="chat-widget-border-color">
                    <div data-chat-widget-color="border">
                      <ColorPicker
                        value={chatWidgetBorderColor}
                        onChange={setChatWidgetBorderColor}
                        gradient
                        compact
                        label={localizeUi("settings.controls.chatWidgetBorderColor.label")}
                        helpText={localizeUi("settings.controls.chatWidgetBorderColor.help")}
                        emptyText={localizeUi("settings.controls.chatWidgetColors.preset")}
                        emptyPreviewValue="var(--mari-widget-accent, var(--marinara-chat-chrome-button-text))"
                        clearLabel={localizeUi("settings.controls.chatWidgetColors.reset")}
                      />
                    </div>
                  </SearchableSettingTarget>
                  <SearchableSettingTarget controlId="chat-widget-background-color">
                    <div data-chat-widget-color="background">
                      <ColorPicker
                        value={chatWidgetBackgroundColor}
                        onChange={setChatWidgetBackgroundColor}
                        gradient
                        compact
                        label={localizeUi("settings.controls.chatWidgetBackgroundColor.label")}
                        helpText={localizeUi("settings.controls.chatWidgetBackgroundColor.help")}
                        emptyText={localizeUi("settings.controls.chatWidgetColors.preset")}
                        emptyPreviewValue="var(--mari-widget-bg, var(--marinara-chat-chrome-panel-bg))"
                        clearLabel={localizeUi("settings.controls.chatWidgetColors.reset")}
                      />
                    </div>
                  </SearchableSettingTarget>
                  <SearchableSettingTarget controlId="chat-widget-text-color">
                    <div data-chat-widget-color="text">
                      <ColorPicker
                        value={chatWidgetTextColor}
                        onChange={setChatWidgetTextColor}
                        gradient
                        compact
                        label={localizeUi("settings.controls.chatWidgetTextColor.label")}
                        helpText={localizeUi("settings.controls.chatWidgetTextColor.help")}
                        emptyText={localizeUi("settings.controls.chatWidgetColors.preset")}
                        emptyPreviewValue="var(--mari-widget-text, var(--marinara-chat-chrome-panel-text))"
                        clearLabel={localizeUi("settings.controls.chatWidgetColors.reset")}
                      />
                    </div>
                  </SearchableSettingTarget>
                  <ToggleSetting
                    anchorId={getSettingsControlAnchorId("chat-widget-apply-font")}
                    label={localizeUi("settings.controls.chatWidgetApplyFont.label")}
                    checked={chatWidgetApplyFont}
                    onChange={setChatWidgetApplyFont}
                    help={localizeUi("settings.controls.chatWidgetApplyFont.help")}
                  />
                  <ToggleSetting
                    anchorId={getSettingsControlAnchorId("chat-widget-apply-shape")}
                    label={localizeUi("settings.controls.chatWidgetApplyShape.label")}
                    checked={chatWidgetApplyShape}
                    onChange={setChatWidgetApplyShape}
                    help={localizeUi("settings.controls.chatWidgetApplyShape.help")}
                  />
                  <ToggleSetting
                    anchorId={getSettingsControlAnchorId("chat-widget-apply-colors")}
                    label={localizeUi("settings.controls.chatWidgetApplyColors.label")}
                    checked={chatWidgetApplyColors}
                    onChange={setChatWidgetApplyColors}
                    help={localizeUi("settings.controls.chatWidgetApplyColors.help")}
                  />
                </div>
              </fieldset>
            </div>
          </SettingsSection>

          <SettingsSection
            title={localizeUi("settings.sections.textScale.title")}
            description={localizeUi("settings.sections.textScale.description")}
            icon={<FileText size="0.875rem" />}
            {...getSettingsSectionAnchorProps("text-scale")}
          >
            <div className="flex flex-col gap-3">
              <label id={getSettingsControlAnchorId("font-family")} className="flex scroll-mt-3 flex-col gap-1">
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.font")}{" "}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.chooseTheFontUsedAcrossTheAppDefaultInter")}
                  />
                </span>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
                >
                  <option value="">{localizeUi("ui.panels.appearancesettings.defaultInter")}</option>
                  {customFontOptions.map((f) => (
                    <option key={f.family} value={f.family}>
                      {f.family}
                    </option>
                  ))}
                </select>
                {(!customFonts || customFonts.length === 0) && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.appearancesettings.dropFontFilesTtfOtfWoffWoff2IntoThe")}{" "}
                    <span className="font-medium">{localizeUi("ui.panels.appearancesettings.dataFonts")}</span>{" "}
                    {localizeUi("ui.panels.appearancesettings.folderToAddCustomFonts")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleOpenFontsFolder}
                  className={cn(SETTINGS_BUTTON_CLASS, "mt-1 self-start")}
                >
                  <FolderOpen size="0.75rem" />
                  {localizeUi("ui.panels.appearancesettings.openFontsFolder")}
                </button>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.googleFonts")}{" "}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.downloadAFontDirectlyFromGoogleFontsByName")}
                  />
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={googleFontName}
                    onChange={(e) => setGoogleFontName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && googleFontName.trim() && !googleFontMutation.isPending) {
                        googleFontMutation.mutate(googleFontName.trim());
                      }
                    }}
                    placeholder={localizeUi("settings.placeholders.fontFamily")}
                    className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => googleFontMutation.mutate(googleFontName.trim())}
                    disabled={!googleFontName.trim() || googleFontMutation.isPending}
                    className={SETTINGS_BUTTON_CLASS}
                  >
                    {googleFontMutation.isPending ? (
                      <Loader2 size="0.75rem" className="animate-spin" />
                    ) : (
                      <Download size="0.75rem" />
                    )}
                    {googleFontMutation.isPending
                      ? localizeUi("ui.panels.appearancesettings.downloading")
                      : localizeUi("ui.panels.appearancesettings.add")}
                  </button>
                </div>
                <a
                  href="https://fonts.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.625rem] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1"
                >
                  {localizeUi("ui.panels.appearancesettings.browseFontsAtFontsGoogleCom")}
                </a>
              </div>

              <label id={getSettingsControlAnchorId("display-size")} className="flex scroll-mt-3 flex-col gap-1">
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.displaySize")}{" "}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.adjustsTheBaseFontSizeAcrossTheWholeApp")}
                  />
                </span>
                <select
                  value={String(fontSize)}
                  onChange={(e) => setFontSize(Number(e.target.value) as Parameters<typeof setFontSize>[0])}
                  className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
                >
                  <option value="12">{localizeUi("ui.panels.appearancesettings.tiny")}</option>
                  <option value="14">{localizeUi("ui.panels.appearancesettings.small")}</option>
                  <option value="16">{localizeUi("ui.panels.appearancesettings.medium")}</option>
                  <option value="17">{localizeUi("ui.noodle.noodlehome.default")}</option>
                  <option value="19">{localizeUi("ui.panels.appearancesettings.large")}</option>
                  <option value="22">{localizeUi("ui.panels.appearancesettings.huge")}</option>
                  <option value="26">{localizeUi("settings.appearance.displaySize.extraLarge")}</option>
                  <option value="30">{localizeUi("settings.appearance.displaySize.extraExtraLarge")}</option>
                  <option value="34">{localizeUi("settings.appearance.displaySize.maximum")}</option>
                </select>
              </label>

              <label id={getSettingsControlAnchorId("chat-font-size")} className="flex scroll-mt-3 flex-col gap-1">
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.chatFontSize")}{" "}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.adjustsTheFontSizeOfChatMessagesOnThis")}
                  />
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={12}
                    max={72}
                    step={1}
                    value={chatFontSize}
                    onChange={(e) => setChatFontSize(Number(e.target.value))}
                    className="min-w-0 flex-1 accent-[var(--primary)]"
                  />
                  <span className="text-xs tabular-nums text-[var(--muted-foreground)] w-8 text-right">
                    {chatFontSize}
                    {localizeUi("ui.panels.appearancesettings.px")}
                  </span>
                </div>
              </label>

              <SearchableSettingTarget controlId="chat-text-color">
                <ColorPicker
                  value={chatFontColor}
                  onChange={setChatFontColor}
                  gradient
                  compact
                  label={localizeUi("settings.colors.chatText")}
                  helpText="Controls the main chat message text color. Leave it on the scheme default to keep dark and light mode readable. Gradients are accepted for layouts that support them."
                  emptyText={localizeUi("ui.panels.appearancesettings.schemeDefaultValue1", {
                    value1: getDefaultChatTextColor(theme),
                  })}
                  emptyPreviewValue={getDefaultChatTextColor(theme)}
                  clearLabel="Reset to default"
                />
              </SearchableSettingTarget>

              <SearchableSettingTarget controlId="default-dialogue-color">
                <ColorPicker
                  value={defaultDialogueColor}
                  onChange={setDefaultDialogueColor}
                  compact
                  label={localizeUi("settings.colors.defaultDialogue")}
                  helpText="Colors dialogue for character and persona cards that do not have their own Dialogue Highlight Color. A card's own dialogue color always overrides it."
                  emptyText={localizeUi("ui.panels.appearancesettings.schemeDefaultValue1", {
                    value1: getDefaultChatTextColor(theme),
                  })}
                  emptyPreviewValue={getDefaultChatTextColor(theme)}
                  clearLabel="Reset to scheme default"
                />
              </SearchableSettingTarget>

              <SearchableSettingTarget controlId="chat-chrome-text-color">
                <ColorPicker
                  value={chatChromeTextColor}
                  onChange={setChatChromeTextColor}
                  gradient
                  compact
                  label={localizeUi("settings.colors.chatChrome")}
                  helpText="Controls ordinary chrome copy in tracker widgets, folder labels, settings descriptors, and windows opened from chat buttons. Accent-colored button text and active icons follow Accent Color instead. Gradients use a compatible fallback where plain CSS color is required."
                  emptyText={localizeUi("ui.panels.appearancesettings.schemeDefaultValue1", {
                    value1: getDefaultChatChromeTextColor(theme),
                  })}
                  emptyPreviewValue={getDefaultChatChromeTextColor(theme)}
                  clearLabel="Reset to default"
                />
              </SearchableSettingTarget>

              <div id={getSettingsControlAnchorId("text-outline-width")} className="flex scroll-mt-3 flex-col gap-1.5">
                <span className="text-[0.6875rem] font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.textOutlineStroke")}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.addsAnOutlineAroundChatTextForBetterReadability")}
                  />
                </span>
                <ColorPicker
                  value={textStrokeColor || "#000000"}
                  onChange={(value) => setTextStrokeColor(value || "#000000")}
                  compact
                  label={localizeUi("settings.colors.textOutline")}
                  helpText="Controls the outline color used when text stroke width is above 0."
                  clearLabel="Reset to default"
                  clearValue="#000000"
                />
                <label className="flex flex-col gap-1">
                  <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.appearancesettings.width")}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.5}
                      value={textStrokeWidth}
                      onChange={(e) => setTextStrokeWidth(Number(e.target.value))}
                      className="flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-10 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                      {textStrokeWidth}
                      {localizeUi("ui.panels.appearancesettings.px")}
                    </span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTextStrokeWidth(0.5);
                    setTextStrokeColor("#000000");
                  }}
                  className={cn(SETTINGS_BUTTON_CLASS, "self-start")}
                >
                  {localizeUi("ui.panels.appearancesettings.resetToDefault")}
                </button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title={localizeUi("settings.sections.atmosphere.title")}
            description={localizeUi("settings.sections.atmosphere.description")}
            icon={<CloudRain size="0.875rem" />}
            {...getSettingsSectionAnchorProps("motion-backgrounds")}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <CloudRain size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <span className="text-xs font-medium">{localizeUi("ui.panels.appearancesettings.effects")}</span>
                  <HelpTooltip
                    text={localizeUi(
                      "ui.panels.appearancesettings.visualEffectsThatEnhanceTheRoleplayAtmosphereWeatherParticles",
                    )}
                  />
                </div>
                <ToggleSetting
                  anchorId={getSettingsControlAnchorId("weather-effects")}
                  label={localizeUi("settings.controls.weatherEffects.label")}
                  checked={weatherEffects}
                  onChange={setWeatherEffects}
                />
                <p className="text-[0.625rem] text-[var(--muted-foreground)] pl-6">
                  {localizeUi("ui.panels.appearancesettings.showsAnimatedWeatherParticlesBasedOnInStoryWeather")}{" "}
                  <span className="font-medium">{localizeUi("ui.panels.appearancesettings.worldState")}</span>{" "}
                  {localizeUi("ui.panels.appearancesettings.agentToBeEnabledSoWeatherDataIsExtracted")}
                </p>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title={localizeUi("settings.controls.backgroundGeneration.label")}
            description={localizeUi("settings.sections.backgrounds.componentDescription")}
            icon={<Image size="0.875rem" />}
            {...getSettingsSectionAnchorProps("chat-backgrounds")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {localizeUi("ui.panels.appearancesettings.chatBackground")}{" "}
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.importOneOrMoreCustomImagesOrChooseFrom")}
                  />
                </span>
                <label className="flex flex-col gap-1 rounded-lg bg-[var(--secondary)]/45 p-3 ring-1 ring-[var(--border)]/70">
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
                    {localizeUi("ui.panels.appearancesettings.backgroundBlur")}
                    <HelpTooltip
                      text={localizeUi(
                        "ui.panels.appearancesettings.softensSelectedRoleplayAndGameModeBackgroundImagesBehind",
                      )}
                    />
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={chatBackgroundBlur}
                      onChange={(e) => setChatBackgroundBlur(Number(e.target.value))}
                      className="min-w-0 flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-12 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                      {chatBackgroundBlur === 0
                        ? localizeUi("ui.panels.appearancesettings.off")
                        : localizeUi("ui.panels.appearancesettings.value1Px", { value1: chatBackgroundBlur })}
                    </span>
                  </div>
                </label>
                <label className="flex flex-col gap-1 rounded-lg bg-[var(--secondary)]/45 p-3 ring-1 ring-[var(--border)]/70">
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium">
                    {localizeUi("settings.controls.conversationBackgroundImageOpacity.label")}
                    <HelpTooltip text={localizeUi("settings.controls.conversationBackgroundImageOpacity.help")} />
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      aria-label={localizeUi("settings.controls.conversationBackgroundImageOpacity.label")}
                      min={0}
                      max={100}
                      step={5}
                      value={conversationBackgroundImageOpacity}
                      onChange={(event) => setConversationBackgroundImageOpacity(Number(event.target.value))}
                      className="min-w-0 flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-12 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                      {conversationBackgroundImageOpacity}%
                    </span>
                  </div>
                </label>
                <label className="flex items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium">
                    {localizeUi("ui.panels.appearancesettings.chatListBackgrounds")}
                    <HelpTooltip
                      text={localizeUi("ui.panels.appearancesettings.showsEachChatsOwnBackgroundAsAMutedBanner")}
                    />
                  </span>
                  <select
                    id={getSettingsControlAnchorId("chat-list-backgrounds")}
                    value={chatListBackgrounds}
                    onChange={(e) => setChatListBackgrounds(e.target.value as ChatListBackgroundMode)}
                    className="h-7 min-w-0 flex-1 scroll-mt-3 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-xs"
                  >
                    {CHAT_LIST_BACKGROUND_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <BackgroundPicker
                  selected={chatBackground}
                  onSelect={setChatBackground}
                  defaultRoleplayBackground={defaultRoleplayBackground}
                  onDefaultChange={setDefaultRoleplayBackground}
                />
              </div>
            </div>
          </SettingsSection>
        </>
      )}

      {group === "conversation" && (
        <>
          <h2 className="text-sm font-semibold" data-appearance-group="conversation">
            {localizeUi("settings.appearance.groups.conversation")}
          </h2>
          <SettingsSection
            title={localizeUi("settings.sections.conversationDisplay.title")}
            description={localizeUi("settings.sections.conversationDisplay.componentDescription")}
            icon={<MessageCircle size="0.875rem" />}
            {...getSettingsSectionAnchorProps("chat-display")}
          >
            <div className="flex flex-col gap-3">
              <ToggleSetting
                anchorId={getSettingsControlAnchorId("conversation-always-display-swipe-menu")}
                label={localizeUi("settings.controls.alwaysDisplaySwipeMenu.label")}
                checked={alwaysDisplayConversationSwipeMenu}
                onChange={setAlwaysDisplayConversationSwipeMenu}
                help={localizeUi("settings.controls.alwaysDisplaySwipeMenu.help")}
              />
              <div
                id={getSettingsControlAnchorId("conversation-layout")}
                className="flex scroll-mt-3 flex-col gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--secondary)]/25 p-3"
              >
                <div className="flex items-center gap-1.5">
                  <MessageCircle size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <span className="text-xs font-medium">{localizeUi("ui.panels.appearancesettings.chatLayout")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "classic" as ConversationMessageStyle, label: "Linear", desc: "Chat-style rows" },
                      { id: "bubble" as ConversationMessageStyle, label: "Bubbles", desc: "Messenger-style bubbles" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setConversationMessageStyle(opt.id)}
                      className={SETTINGS_CHOICE_CARD_CLASS}
                      aria-pressed={conversationMessageStyle === opt.id}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[0.625rem] leading-tight text-[var(--muted-foreground)]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/35 p-2.5 text-[0.6875rem]">
                  {conversationMessageStyle === "bubble" ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <div className="mari-message-bubble texting-bubble texting-bubble-user max-w-[78%] rounded-2xl px-3 py-1.5 text-xs shadow-sm">
                          {localizeUi("ui.panels.appearancesettings.heyHowSItGoing")}
                        </div>
                      </div>
                      <div className="flex items-end gap-1.5 justify-start">
                        <div
                          className={cn(
                            "h-5 w-5 shrink-0 bg-[var(--accent)]",
                            conversationAvatarShape === "square" ? "rounded-[0.2rem]" : "rounded-full",
                          )}
                        />
                        <div className="mari-message-bubble texting-bubble texting-bubble-other max-w-[78%] rounded-2xl px-3 py-1.5 text-xs shadow-sm">
                          {localizeUi("ui.panels.appearancesettings.prettyGoodThanks")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 text-xs">
                      <div
                        className={cn(
                          "h-6 w-6 shrink-0 bg-[var(--accent)]",
                          conversationAvatarShape === "square" ? "rounded-[0.2rem]" : "rounded-full",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-baseline gap-2">
                          <span className="font-semibold">{localizeUi("ui.panels.appearancesettings.character")}</span>
                          <span className="text-[0.625rem] text-[var(--muted-foreground)]">12:45</span>
                        </div>
                        <div className="space-y-0.5 text-[var(--foreground)]/90">
                          <div>{localizeUi("ui.panels.appearancesettings.messagesAppearAsRows")}</div>
                          <div>{localizeUi("ui.panels.appearancesettings.groupedBySender")}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div
                id={getSettingsControlAnchorId("conversation-avatar-shape")}
                className="flex scroll-mt-3 flex-col gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--secondary)]/25 p-3"
              >
                <div>
                  <div className="text-xs font-medium">
                    {localizeUi("ui.panels.appearancesettings.conversationAvatarShape")}
                  </div>
                  <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.appearancesettings.conversationAvatarShapeDescription")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "circle" as ConversationAvatarShape,
                        label: localizeUi("ui.panels.appearancesettings.circularAvatars"),
                        cornerClass: "rounded-full",
                      },
                      {
                        id: "square" as ConversationAvatarShape,
                        label: localizeUi("ui.panels.appearancesettings.squareAvatars"),
                        cornerClass: "rounded-[0.2rem]",
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setConversationAvatarShape(option.id)}
                      className={SETTINGS_BUTTON_CLASS}
                      aria-pressed={conversationAvatarShape === option.id}
                    >
                      <span
                        className={cn("h-5 w-5 shrink-0 border border-current bg-[var(--accent)]", option.cornerClass)}
                        data-avatar-shape-preview={option.id}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title={localizeUi("settings.sections.conversationTheme.title")}
            description={localizeUi("settings.sections.conversationTheme.description")}
            icon={<Palette size="0.875rem" />}
            {...getSettingsSectionAnchorProps("conversation-theme")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Palette size="0.75rem" className="text-[var(--muted-foreground)]" />
                    <span className="text-xs font-medium">
                      {localizeUi("settings.sections.conversationTheme.title")}
                    </span>
                    <HelpTooltip
                      text={localizeUi(
                        "ui.panels.appearancesettings.setABackgroundGradientForAllConversationModeChats",
                      )}
                    />
                  </div>
                  {/* Scheme tabs */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveGradientScheme("dark")}
                      aria-pressed={activeGradientScheme === "dark"}
                      className={SETTINGS_BUTTON_CLASS}
                    >
                      {localizeUi("ui.panels.appearancesettings.dark")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveGradientScheme("light")}
                      aria-pressed={activeGradientScheme === "light"}
                      className={SETTINGS_BUTTON_CLASS}
                    >
                      {localizeUi("ui.panels.appearancesettings.light")}
                    </button>
                  </div>
                </div>
                {/* Preview */}
                <div
                  className="h-16 rounded-lg ring-1 ring-[var(--border)]"
                  style={{ background: `linear-gradient(135deg, ${currentGradient.from}, ${currentGradient.to})` }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentGradient.from}
                        onInput={(e) => handleGradientColorInput("from", e.currentTarget.value)}
                        onChange={(e) => handleGradientColorInput("from", e.currentTarget.value)}
                        onBlur={flushPendingGradientChange}
                        onPointerUp={flushPendingGradientChange}
                        onKeyUp={flushPendingGradientChange}
                        className="h-8 w-8 flex-shrink-0 cursor-pointer rounded-md border border-[var(--border)] bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        value={draftFrom}
                        onChange={(e) => {
                          setDraftFrom(e.target.value);
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                            commitConvoGradientField(activeGradientScheme, "from", e.target.value);
                        }}
                        onBlur={() => setDraftFrom(currentGradient.from)}
                        className="w-full rounded-md bg-[var(--secondary)] px-2 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                      />
                    </div>
                  </label>
                  <label className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentGradient.to}
                        onInput={(e) => handleGradientColorInput("to", e.currentTarget.value)}
                        onChange={(e) => handleGradientColorInput("to", e.currentTarget.value)}
                        onBlur={flushPendingGradientChange}
                        onPointerUp={flushPendingGradientChange}
                        onKeyUp={flushPendingGradientChange}
                        className="h-8 w-8 flex-shrink-0 cursor-pointer rounded-md border border-[var(--border)] bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        value={draftTo}
                        onChange={(e) => {
                          setDraftTo(e.target.value);
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                            commitConvoGradientField(activeGradientScheme, "to", e.target.value);
                        }}
                        onBlur={() => setDraftTo(currentGradient.to)}
                        className="w-full rounded-md bg-[var(--secondary)] px-2 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                      />
                    </div>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaults =
                      activeGradientScheme === "dark"
                        ? { from: "#0a0a0e", to: "#1c2133" }
                        : { from: "#f2eff7", to: "#eae6f0" };
                    commitConvoGradientField(activeGradientScheme, "from", defaults.from);
                    commitConvoGradientField(activeGradientScheme, "to", defaults.to);
                    setDraftFrom(defaults.from);
                    setDraftTo(defaults.to);
                  }}
                  className={cn(SETTINGS_BUTTON_CLASS, "self-start")}
                >
                  {localizeUi("ui.panels.imagestyleprofileseditor.reset")}{" "}
                  {activeGradientScheme === "dark"
                    ? localizeUi("ui.panels.appearancesettings.dark")
                    : localizeUi("ui.panels.appearancesettings.light")}{" "}
                  {localizeUi("ui.panels.appearancesettings.toDefault")}
                </button>
              </div>
            </div>
          </SettingsSection>
        </>
      )}

      {group === "roleplay" && (
        <>
          <h2 className="text-sm font-semibold" data-appearance-group="roleplay">
            {localizeUi("settings.appearance.groups.roleplay")}
          </h2>
          <div id={getSettingsSectionAnchorId("roleplay-tracker")} className="flex scroll-mt-3 flex-col gap-3">
            <TrackerPanelAppearanceDrawer />
          </div>

          <SettingsSection
            title={localizeUi("settings.sections.roleplayMessages.title")}
            description={localizeUi("settings.sections.roleplayMessages.description")}
            icon={<Image size="0.875rem" />}
            {...getSettingsSectionAnchorProps("roleplay-messages")}
          >
            <div className="flex flex-col gap-3">
              <div id={getSettingsControlAnchorId("roleplay-chat-position")} className="grid scroll-mt-3 gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium">
                  {localizeUi("settings.controls.roleplayChatPosition.label")}
                  <HelpTooltip text={localizeUi("settings.controls.roleplayChatPosition.help")} />
                </span>
                <div
                  role="group"
                  aria-label={localizeUi("settings.controls.roleplayChatPosition.label")}
                  className="grid grid-cols-3 gap-1"
                >
                  {ROLEPLAY_CHAT_POSITIONS.map((position) => {
                    // An unknown synced value shows as Center, which is how the chat treats it.
                    const selected =
                      position ===
                      (ROLEPLAY_CHAT_POSITIONS.includes(roleplayChatPosition) ? roleplayChatPosition : "center");
                    return (
                      <button
                        key={position}
                        type="button"
                        onClick={() => setRoleplayChatPosition(position)}
                        aria-pressed={selected}
                        className={SETTINGS_BUTTON_CLASS}
                      >
                        {localizeUi(`settings.controls.roleplayChatPosition.${position}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <ToggleSetting
                anchorId={getSettingsControlAnchorId("roleplay-vn-display")}
                label={localizeUi("settings.roleplayVn.enabled")}
                help={localizeUi("settings.roleplayVn.help")}
                checked={activeRoleplayStyle === "visual-novel"}
                onChange={(enabled) => {
                  const style = enabled ? "visual-novel" : "classic";
                  setRoleplayDisplayStyle(style);
                  if (appearanceChat?.mode === "roleplay")
                    updateMeta.mutate({ id: appearanceChat.id, roleplayDisplayStyle: style });
                }}
              />
              <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("settings.roleplayVn.scope")}</p>
              <ToggleSetting
                anchorId={getSettingsControlAnchorId("roleplay-vn-autoplay")}
                label={localizeUi("settings.roleplayVn.autoPlay")}
                help={localizeUi("settings.roleplayVn.autoPlayHelp")}
                checked={roleplayVnAutoPlay}
                onChange={setRoleplayVnAutoPlay}
              />
              <label
                id={getSettingsControlAnchorId("roleplay-vn-autoplay-delay")}
                className="flex scroll-mt-3 flex-col gap-2 text-xs"
              >
                <span>
                  {localizeUi("settings.roleplayVn.autoPlayDelay")}{" "}
                  {localizeUi("settings.units.secondsShort", { value: roleplayVnAutoPlayDelay / 1000 })}
                </span>
                <input
                  type="range"
                  min={200}
                  max={10000}
                  step={100}
                  value={roleplayVnAutoPlayDelay}
                  disabled={!roleplayVnAutoPlay}
                  onChange={(event) => setRoleplayVnAutoPlayDelay(Number(event.target.value))}
                  className="w-full accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <div className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2">
                <label
                  id={getSettingsControlAnchorId("roleplay-vn-portrait-scale")}
                  className="flex scroll-mt-3 min-w-0 flex-col gap-2 text-xs"
                >
                  <span>{localizeUi("ui.panels.appearancesettings.dialoguePortraitScale")}</span>
                  <div className="flex min-h-11 items-center gap-2">
                    <input
                      type="range"
                      min={0.75}
                      max={1.75}
                      step={0.05}
                      value={roleplayVnPortraitScale}
                      onChange={(event) => setRoleplayVnPortraitScale(Number(event.target.value))}
                      className="min-w-0 flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-10 text-right tabular-nums">{Math.round(roleplayVnPortraitScale * 100)}%</span>
                  </div>
                </label>
                <label
                  id={getSettingsControlAnchorId("roleplay-vn-sprite-scale")}
                  className="flex scroll-mt-3 min-w-0 flex-col gap-2 text-xs"
                >
                  <span>{localizeUi("ui.panels.appearancesettings.fullBodySpriteScale")}</span>
                  <div className="flex min-h-11 items-center gap-2">
                    <input
                      type="range"
                      min={0.75}
                      max={2.75}
                      step={0.05}
                      value={roleplayVnSpriteScale}
                      onChange={(event) => setRoleplayVnSpriteScale(Number(event.target.value))}
                      className="min-w-0 flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-10 text-right tabular-nums">{Math.round(roleplayVnSpriteScale * 100)}%</span>
                  </div>
                </label>
              </div>
              <label
                id={getSettingsControlAnchorId("roleplay-message-opacity")}
                className="flex scroll-mt-3 flex-col gap-1"
              >
                <span className="text-[0.6875rem] font-medium">
                  {localizeUi("ui.panels.appearancesettings.roleplayMessagesBackgroundOpacity")}
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={chatFontOpacity}
                    onChange={(e) => setChatFontOpacity(Number(e.target.value))}
                    className="flex-1 accent-[var(--primary)]"
                  />
                  <span className="text-xs tabular-nums text-[var(--muted-foreground)] w-8 text-right">
                    {chatFontOpacity}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setChatFontOpacity(90)}
                  disabled={chatFontOpacity === 90}
                  className={cn(SETTINGS_BUTTON_CLASS, "self-start")}
                >
                  {localizeUi("ui.panels.appearancesettings.resetOpacityToDefault")}
                </button>
              </label>

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("roleplay-always-display-swipe-menu")}
                label={localizeUi("settings.controls.alwaysDisplaySwipeMenu.label")}
                checked={alwaysDisplayRoleplaySwipeMenu}
                onChange={setAlwaysDisplayRoleplaySwipeMenu}
                help={localizeUi("settings.controls.alwaysDisplaySwipeMenu.help")}
              />
              <ToggleSetting
                anchorId={getSettingsControlAnchorId("roleplay-reduced-paint-effects")}
                label={localizeUi("settings.controls.reducedPaintEffects.label")}
                checked={roleplayReducedPaintEffects}
                onChange={setRoleplayReducedPaintEffects}
                help={localizeUi("settings.controls.reducedPaintEffects.help")}
              />

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("show-roleplay-thinking-in-messages")}
                label={localizeUi("settings.controls.showRoleplayThinkingInMessages.label")}
                checked={showRoleplayThinkingInMessages}
                onChange={setShowRoleplayThinkingInMessages}
                help={localizeUi("settings.controls.showRoleplayThinkingInMessages.help")}
              />
              <ToggleSetting
                anchorId={getSettingsControlAnchorId("keep-roleplay-thinking-expanded")}
                label={localizeUi("settings.controls.keepRoleplayThinkingExpanded.label")}
                checked={keepRoleplayThinkingExpanded}
                onChange={setKeepRoleplayThinkingExpanded}
                disabled={!showRoleplayThinkingInMessages}
                help={localizeUi("settings.controls.keepRoleplayThinkingExpanded.help")}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <span className="text-xs font-medium">
                    {localizeUi("ui.panels.appearancesettings.roleplayAvatars")}
                  </span>
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.chooseHowAvatarsSitNextToRoleplayMessagesNone")}
                  />
                </div>
                <ToggleSetting
                  anchorId={getSettingsControlAnchorId("scrollable-avatars")}
                  label={localizeUi("settings.controls.scrollableAvatars.label")}
                  checked={roleplayAvatarsScrollable}
                  onChange={setRoleplayAvatarsScrollable}
                  help={localizeUi("settings.controls.scrollableAvatars.help")}
                />
                <ToggleSetting
                  anchorId={getSettingsControlAnchorId("narrator-cycling-avatars")}
                  label={localizeUi("settings.controls.narratorCyclingAvatars.label")}
                  checked={roleplayNarratorAvatarCycling}
                  onChange={setRoleplayNarratorAvatarCycling}
                  help={localizeUi("settings.controls.narratorCyclingAvatars.help")}
                />
                <div
                  id={getSettingsControlAnchorId("roleplay-avatar-style")}
                  className="grid scroll-mt-3 grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {ROLEPLAY_AVATAR_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={roleplayAvatarStyle === opt.id}
                      onClick={() => setRoleplayAvatarStyle(opt.id)}
                      className={SETTINGS_CHOICE_CARD_CLASS}
                    >
                      <div className="w-full overflow-hidden rounded-md bg-[var(--secondary)]/80 ring-1 ring-[var(--border)]/70">
                        {opt.id === "none" ? (
                          <div className="flex h-14 items-center px-3">
                            <div className="flex-1 rounded-2xl bg-black/25 px-3 py-2">
                              <div className="h-1.5 w-16 rounded-full bg-white/20" />
                              <div className="mt-1.5 h-1.5 w-24 rounded-full bg-white/12" />
                            </div>
                          </div>
                        ) : opt.id === "circles" ? (
                          <div className="flex h-14 items-center px-3">
                            <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-black/25 px-3 py-2">
                              <div className="mari-settings-accent-dot absolute left-2 top-2 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.16)]" />
                              <div className="ml-4 h-1.5 w-14 rounded-full bg-white/20" />
                              <div className="mt-1.5 ml-4 h-1.5 w-20 rounded-full bg-white/12" />
                            </div>
                          </div>
                        ) : opt.id === "rectangles" ? (
                          <div className="flex h-14 items-center px-3">
                            <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-black/25 py-2 pl-8 pr-3">
                              <div className="mari-settings-portrait-preview absolute left-2 top-2 h-4 w-4 overflow-hidden rounded ring-1 ring-white/20">
                                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_58%)]" />
                              </div>
                              <div className="h-1.5 w-14 rounded-full bg-white/20" />
                              <div className="mt-1.5 h-1.5 w-20 rounded-full bg-white/12" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-14 items-stretch overflow-hidden bg-black/25">
                            <div className="mari-settings-scene-preview relative flex w-[42%] shrink-0 items-end justify-center overflow-hidden">
                              <div className="absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-orange-50/45 shadow-[0_0_12px_rgba(255,237,213,0.35)]" />
                              <div className="h-8 w-8 rounded-t-full bg-zinc-950/35" />
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%] backdrop-blur-[4px] [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.25)_28%,rgba(0,0,0,0.8)_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.25)_28%,rgba(0,0,0,0.8)_100%)]" />
                              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_72%,rgba(113,113,122,0.84)_92%,rgba(113,113,122,1)_100%)]" />
                            </div>
                            <div className="flex-1 px-3 py-2">
                              <div className="h-1.5 w-14 rounded-full bg-white/20" />
                              <div className="mt-1.5 h-1.5 w-20 rounded-full bg-white/12" />
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[0.625rem] leading-tight text-[var(--muted-foreground)]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex h-20 w-full shrink-0 items-end justify-center gap-3 overflow-hidden rounded-md bg-black/30 p-2 ring-1 ring-[var(--border)]/70 sm:w-28">
                      {roleplayAvatarStyle === "none" ? (
                        <div
                          className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 px-2 text-[0.625rem] font-medium text-white/35"
                          style={{
                            width: toPreviewRem(roleplayAvatarPreview.width),
                            height: toPreviewRem(roleplayAvatarPreview.height),
                          }}
                        >
                          {localizeUi("ui.panels.appearancesettings.noAvatars")}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "mari-settings-portrait-preview shrink-0 border border-white/20 shadow-lg transition-all",
                            roleplayAvatarStyle === "circles"
                              ? "rounded-full"
                              : roleplayAvatarStyle === "rectangles"
                                ? "rounded-xl"
                                : "rounded-md",
                          )}
                          style={{
                            width: toPreviewRem(roleplayAvatarPreview.width),
                            height: toPreviewRem(roleplayAvatarPreview.height),
                          }}
                        />
                      )}
                      <div
                        className="mari-settings-scene-preview shrink-0 rounded-full border border-white/20 shadow-lg transition-all"
                        style={{
                          width: toPreviewRem(roleplaySpritePreview.width),
                          height: toPreviewRem(roleplaySpritePreview.height),
                        }}
                      />
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3 sm:min-w-[9rem]">
                      <label
                        id={getSettingsControlAnchorId("roleplay-avatar-scale")}
                        className="flex scroll-mt-3 min-w-0 flex-col gap-1"
                      >
                        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                          {localizeUi("ui.panels.appearancesettings.messageAvatarScale")}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.75}
                            max={2.5}
                            step={0.05}
                            value={roleplayAvatarScale}
                            onChange={(e) => setRoleplayAvatarScale(Number(e.target.value))}
                            className="min-w-0 flex-1 accent-[var(--primary)]"
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                            {Math.round(roleplayAvatarScale * 100)}%
                          </span>
                        </div>
                      </label>
                      <label
                        id={getSettingsControlAnchorId("roleplay-sprite-scale")}
                        className="flex scroll-mt-3 min-w-0 flex-col gap-1"
                      >
                        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                          {localizeUi("ui.panels.appearancesettings.defaultSpriteScale")}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.5}
                            max={1.75}
                            step={0.05}
                            value={roleplaySpriteScale}
                            onChange={(e) => setRoleplaySpriteScale(Number(e.target.value))}
                            className="min-w-0 flex-1 accent-[var(--primary)]"
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                            {Math.round(roleplaySpriteScale * 100)}%
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.appearancesettings.rectanglesKeepTheCompactSideSlotButGivePortraits")}
                </p>
              </div>
            </div>
          </SettingsSection>
        </>
      )}

      {group === "game" && (
        <>
          <h2 className="text-sm font-semibold" data-appearance-group="game">
            {localizeUi("settings.appearance.groups.game")}
          </h2>
          <SettingsSection
            title={localizeUi("settings.sections.gamePresentation.title")}
            description={localizeUi("settings.sections.gamePresentation.description")}
            icon={<ScrollText size="0.875rem" />}
            {...getSettingsSectionAnchorProps("game-presentation")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <span className="text-xs font-medium">{localizeUi("ui.panels.appearancesettings.gameVnArt")}</span>
                  <HelpTooltip
                    text={localizeUi(
                      "ui.panels.appearancesettings.scalesGameModeDialoguePortraitsSeparatelyFromTheCenter",
                    )}
                  />
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex h-20 w-full shrink-0 items-end justify-center gap-3 overflow-hidden rounded-md bg-black/30 p-2 ring-1 ring-[var(--border)]/70 sm:w-28">
                      <div
                        className="shrink-0 rounded-lg border border-white/20 bg-gradient-to-b from-sky-300/80 via-cyan-200/65 to-slate-800/90 shadow-lg transition-all"
                        style={{
                          width: toPreviewRem(gameAvatarPreview.width),
                          height: toPreviewRem(gameAvatarPreview.height),
                        }}
                      />
                      <div
                        className="mari-settings-portrait-preview shrink-0 rounded-full border border-white/20 shadow-lg transition-all"
                        style={{
                          width: toPreviewRem(gameFullBodyPreview.width),
                          height: toPreviewRem(gameFullBodyPreview.height),
                        }}
                      />
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3 sm:min-w-[9rem]">
                      <label
                        id={getSettingsControlAnchorId("game-dialogue-portrait-scale")}
                        className="flex scroll-mt-3 min-w-0 flex-col gap-1"
                      >
                        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                          {localizeUi("ui.panels.appearancesettings.dialoguePortraitScale")}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.75}
                            max={1.75}
                            step={0.05}
                            value={gameAvatarScale}
                            onChange={(e) => setGameAvatarScale(Number(e.target.value))}
                            className="min-w-0 flex-1 accent-[var(--primary)]"
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                            {Math.round(gameAvatarScale * 100)}%
                          </span>
                        </div>
                      </label>
                      <label
                        id={getSettingsControlAnchorId("game-full-body-sprite-scale")}
                        className="flex scroll-mt-3 min-w-0 flex-col gap-1"
                      >
                        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                          {localizeUi("ui.panels.appearancesettings.fullBodySpriteScale")}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0.75}
                            max={2.75}
                            step={0.05}
                            value={gameFullBodySpriteScale}
                            onChange={(e) => setGameFullBodySpriteScale(Number(e.target.value))}
                            className="min-w-0 flex-1 accent-[var(--primary)]"
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
                            {Math.round(gameFullBodySpriteScale * 100)}%
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <ScrollText size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <span className="text-xs font-medium">
                    {localizeUi("ui.panels.appearancesettings.gameDialogueDisplay")}
                  </span>
                  <HelpTooltip
                    text={localizeUi("ui.panels.appearancesettings.chooseWhetherGameModeUsesAClassicDialogueBox")}
                  />
                </div>
                <div
                  id={getSettingsControlAnchorId("game-dialogue-display")}
                  className="grid scroll-mt-3 grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {GAME_DIALOGUE_DISPLAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={gameDialogueDisplayMode === opt.id}
                      onClick={() => setGameDialogueDisplayMode(opt.id)}
                      className={SETTINGS_CHOICE_CARD_CLASS}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[0.625rem] leading-tight text-[var(--muted-foreground)]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <ToggleSetting
                anchorId={getSettingsControlAnchorId("game-text-effects")}
                label={localizeUi("settings.controls.gameTextEffects.label")}
                checked={gameTextEffectsEnabled}
                onChange={setGameTextEffectsEnabled}
                help={localizeUi("settings.controls.gameTextEffects.help")}
              />
            </div>
          </SettingsSection>
        </>
      )}
    </div>
  );
}

function GenerationsSettings() {
  const { t: localizeUi } = useUiTranslation();
  const { data: installedCapabilities = [], isLoading } = useInstalledCapabilityPackages();
  const openRightPanel = useUIStore((state) => state.openRightPanel);
  const openAgentCatalog = useUIStore((state) => state.openAgentCatalog);
  const illustratorInstalled = installedCapabilities.some(
    (capability) => capability.id === "illustrator" && capability.status === "active",
  );
  const openDownloadAgents = useCallback(() => {
    openRightPanel("agents");
    openAgentCatalog("illustrator");
  }, [openAgentCatalog, openRightPanel]);

  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>
        {localizeUi("ui.panels.generationssettings.globalDefaultsForGeneratedImagesVideosAndReusablePrompt")}
      </SettingsIntro>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-4 py-8 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
          <Loader2 size="1rem" className="animate-spin" />
          {localizeUi("ui.panels.generationssettings.checkingInstalledAgents")}
        </div>
      ) : !illustratorInstalled ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-5 py-8 text-center">
          <WandSparkles size="1.5rem" className="text-[var(--marinara-chat-chrome-highlight-text)]" />
          <p className="max-w-md text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
            {localizeUi("ui.panels.generationssettings.downloadIllustratorAgentFirstFromAgentsTabToEnable")}
          </p>
          <button type="button" onClick={openDownloadAgents} className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}>
            <Download size="0.8125rem" />
            {localizeUi("ui.panels.generationssettings.downloadIllustratorAgent")}
          </button>
        </div>
      ) : (
        <>
          <OverallGenerationSettings />
          <ImageGenerationSettings />
          <VideoGenerationSettings />
          <div id={getSettingsSectionAnchorId("prompt-overrides")} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/35 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--foreground)]">
                  {localizeUi("settings.sections.promptOverrides.title")}
                </div>
                <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("settings.sections.promptOverrides.description")}
                </div>
              </div>
            </div>
            <PromptOverridesEditor
              title={localizeUi("settings.prompts.video.title")}
              description={localizeUi("settings.prompts.video.description")}
              help={localizeUi("settings.prompts.video.help")}
              keys={VIDEO_PROMPT_TEMPLATE_KEYS}
              preferredKey="game.video"
            />
            <PromptOverridesEditor
              title={localizeUi("settings.prompts.image.title")}
              description={localizeUi("settings.prompts.image.description")}
              help={localizeUi("settings.prompts.image.help")}
              preferredKey="game.npcPortrait"
            />
          </div>
        </>
      )}
    </div>
  );
}

function AddonsSettings() {
  const { t: localizeUi } = useUiTranslation();
  const { data: extensionPolicy } = usePersonalExtensionPolicy();
  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>
        {localizeUi("ui.panels.addonssettings.privateCustomBehaviorAndAppearanceSyncedByThisMarinara")}
      </SettingsIntro>
      <PersonalExtensionsSettings showIntro={false} />
      {extensionPolicy?.externalExtensionsEnabled && <ExternalExtensionsSettings />}
      <ThemesSettings showIntro={false} />
    </div>
  );
}

const THEME_PREVIEW_DEBOUNCE_MS = 300;

function ThemesSettings({ showIntro = true }: { showIntro?: boolean } = {}) {
  const { t: localizeUi } = useUiTranslation();
  const { data: syncedThemes = [], isLoading } = useThemes();
  const createTheme = useCreateTheme();
  const updateTheme = useUpdateTheme();
  const deleteTheme = useDeleteTheme();
  const setActiveTheme = useSetActiveTheme();
  const activeCustomTheme = syncedThemes.find((theme) => theme.isActive) ?? null;
  const isSavingTheme = createTheme.isPending || updateTheme.isPending || setActiveTheme.isPending;

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = creating new
  const [themeName, setThemeName] = useState("");
  const [themeCss, setThemeCss] = useState("");
  const [livePreview, setLivePreview] = useState(true);

  // Replacing a dense app-level stylesheet invalidates styles across the full
  // document. Keep typing immediate and apply only the settled preview instead
  // of forcing that work for every character entered.
  useEffect(() => {
    const previewStyleId = "marinara-css-editor-preview";
    const existingStyle = document.getElementById(previewStyleId) as HTMLStyleElement | null;

    if (!editorOpen || !livePreview) {
      existingStyle?.remove();
      return;
    }

    const style = existingStyle ?? document.createElement("style");
    if (!existingStyle) {
      style.id = previewStyleId;
      document.head.appendChild(style);
    }

    const previewTimeout = window.setTimeout(() => {
      style.textContent = sanitizeAppCss(themeCss);
      // Keep the preview after the active-theme injector's saved CSS.
      document.head.appendChild(style);
    }, THEME_PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(previewTimeout);
  }, [editorOpen, livePreview, themeCss]);

  useEffect(
    () => () => {
      document.getElementById("marinara-css-editor-preview")?.remove();
    },
    [],
  );

  const openNewTheme = useCallback(() => {
    setEditingId(null);
    setThemeName("");
    setThemeCss(CSS_TEMPLATE);
    setEditorOpen(true);
  }, []);

  const openEditTheme = useCallback((theme: Theme) => {
    setEditingId(theme.id);
    setThemeName(theme.name);
    setThemeCss(normalizeThemeCss(theme.css));
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const name = themeName.trim() || "Untitled Theme";
      const css = normalizeThemeCss(themeCss);
      if (editingId) {
        await updateTheme.mutateAsync({ id: editingId, name, css });
        toast.success(localizeUi("ui.panels.themessettings.themeValue1Updated", { value1: name }));
      } else {
        const theme = await createTheme.mutateAsync({
          name,
          css,
          installedAt: new Date().toISOString(),
        });
        await setActiveTheme.mutateAsync(theme.id);
        toast.success(localizeUi("ui.panels.themessettings.themeValue1SavedAndActivated", { value1: name }));
      }
      setEditorOpen(false);
    } catch (err) {
      console.error("[ThemesSettings] Failed to save theme:", err);
      toast.error(localizeUi("ui.panels.themessettings.failedToSaveThemeCheckTheBrowserConsoleFor"));
    }
  }, [createTheme, editingId, setActiveTheme, themeCss, themeName, updateTheme, localizeUi]);

  const handleImportThemeFile = async (file: File) => {
    try {
      const text = await file.text();
      const latestThemes = await api.get<Theme[]>("/themes");
      let workingThemes = [...latestThemes];
      let imported = 0;
      let skipped = 0;
      let failed = 0;
      const skipMessages: string[] = [];
      const failureMessages: string[] = [];

      const recordSkippedTheme = (message: string) => {
        skipped++;
        skipMessages.push(message);
      };

      if (file.name.endsWith(".json")) {
        const parsed = parseThemeJsonWithControlCharFallback(text);
        const entries = getFolderImportEntries(parsed, ["themes"]);
        for (const [index, entry] of entries.entries()) {
          const source = getFolderManifestConfig(entry);
          if (!source || typeof source !== "object" || Array.isArray(source)) {
            recordSkippedTheme(`Entry ${index + 1} is not a theme object.`);
            continue;
          }
          const record = source as Record<string, unknown>;
          const importedThemeName =
            typeof record.name === "string" && record.name.trim()
              ? record.name.trim()
              : file.name.replace(/\.json$/i, "");
          if (typeof record.css !== "string") {
            recordSkippedTheme(`"${importedThemeName}" is missing a css field.`);
            continue;
          }
          const importedThemeCss = normalizeThemeCss(record.css);
          if (!importedThemeCss.trim()) {
            recordSkippedTheme(`"${importedThemeName}" has empty css.`);
            continue;
          }
          const duplicate = findDuplicateTheme(workingThemes, importedThemeName, importedThemeCss);
          if (duplicate) {
            recordSkippedTheme(`"${importedThemeName}" is already synced.`);
            continue;
          }
          try {
            const created = await createTheme.mutateAsync({
              name: importedThemeName,
              css: importedThemeCss,
              installedAt: new Date().toISOString(),
            });
            workingThemes = [created, ...workingThemes];
            imported++;
          } catch (err) {
            failed++;
            failureMessages.push(
              err instanceof Error ? `"${importedThemeName}" failed: ${err.message}` : `"${importedThemeName}" failed.`,
            );
            console.warn("[ThemesSettings] Failed to import theme entry:", importedThemeName, err);
          }
        }
      } else {
        const importedThemeName = file.name.replace(/\.css$/, "");
        const importedThemeCss = normalizeThemeCss(text);
        const duplicate = findDuplicateTheme(workingThemes, importedThemeName, importedThemeCss);
        if (duplicate) {
          recordSkippedTheme(`"${importedThemeName}" is already synced.`);
        } else {
          await createTheme.mutateAsync({
            name: importedThemeName,
            css: importedThemeCss,
            installedAt: new Date().toISOString(),
          });
          imported++;
        }
      }

      if (imported > 0 || skipped > 0 || failed > 0) {
        const summary = [
          imported > 0 ? `${imported} imported` : null,
          skipped > 0 ? `${skipped} skipped` : null,
          failed > 0 ? `${failed} failed` : null,
        ].filter(Boolean);
        const message = `Theme import: ${summary.join(", ")}`;
        const description = [...failureMessages, ...skipMessages].slice(0, 3).join(" ");
        if (failed > 0) toast.warning(message, { description, duration: 12_000 });
        else if (skipped > 0) toast.warning(message, { description, duration: 12_000 });
        else toast.success(message);
      } else {
        toast.error(localizeUi("ui.panels.themessettings.noValidThemesFoundInFile"));
      }
    } catch (err) {
      console.error("[ThemesSettings] Failed to import theme:", err);
      toast.error(
        err instanceof SyntaxError
          ? localizeUi("ui.panels.themessettings.failedToImportThemeTheJsonCouldNotBe")
          : getPrivilegedActionErrorMessage(
              err,
              localizeUi("ui.panels.themessettings.failedToImportThemeEnsureValidFile"),
            ),
      );
    }
  };
  // ── CSS Editor View ──
  if (editorOpen) {
    return (
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label={localizeUi("settings.actions.closeThemeEditor")}
              title={localizeUi("settings.actions.closeThemeEditor")}
              className={SETTINGS_ICON_BUTTON_CLASS}
            >
              <X size="0.75rem" />
            </button>
            <span className="text-xs font-semibold">
              {editingId
                ? localizeUi("ui.panels.themessettings.editTheme")
                : localizeUi("ui.panels.themessettings.newTheme")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLivePreview(!livePreview)}
              aria-pressed={livePreview}
              className={SETTINGS_BUTTON_CLASS}
              title={
                livePreview
                  ? localizeUi("ui.panels.themessettings.disableLivePreview")
                  : localizeUi("ui.panels.themessettings.enableLivePreview")
              }
            >
              {livePreview ? <Eye size="0.75rem" /> : <EyeOff size="0.75rem" />}
              {localizeUi("settings.notifications.customSound.actions.preview")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSavingTheme}
              className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}
            >
              {isSavingTheme ? <Loader2 size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
              {isSavingTheme
                ? localizeUi("ui.noodle.stageprofileform.saving")
                : localizeUi("ui.noodle.noodlehome.save")}
            </button>
          </div>
        </div>

        {/* Theme name */}
        <input
          type="text"
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          placeholder={localizeUi("settings.placeholders.themeName")}
          className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
        />

        {/* CSS textarea */}
        <textarea
          value={themeCss}
          onChange={(e) => setThemeCss(e.target.value)}
          spellCheck={false}
          className="min-h-[22.5rem] resize-y rounded-lg border border-[var(--border)] bg-[#0d1117] p-3 font-mono text-[0.6875rem] leading-relaxed text-emerald-300 outline-none transition-colors focus:border-[var(--primary)]/50 placeholder:text-white/20"
          placeholder={localizeUi("settings.placeholders.themeCss")}
        />

        {/* Quick reference */}
        <details className="group rounded-lg bg-[var(--secondary)]/50 ring-1 ring-[var(--border)]">
          <summary className="cursor-pointer px-3 py-2 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
            {localizeUi("ui.panels.themessettings.cssVariableReference")}
          </summary>
          <div className="border-t border-[var(--border)] px-3 py-2 font-mono text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span>{localizeUi("ui.panels.themessettings.background")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.pageBackground")}</span>
              <span>{localizeUi("ui.panels.themessettings.foreground")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.mainText")}</span>
              <span>{localizeUi("ui.panels.themessettings.primary")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.accentButtons")}</span>
              <span>{localizeUi("ui.panels.themessettings.primaryForeground")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.textOnPrimary")}</span>
              <span>{localizeUi("ui.panels.themessettings.secondary")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.cardsInputs")}</span>
              <span>{localizeUi("ui.panels.themessettings.card")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.cardBackground")}</span>
              <span>{localizeUi("ui.panels.themessettings.border")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.borders")}</span>
              <span>{localizeUi("ui.panels.themessettings.mutedForeground")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.dimmedText")}</span>
              <span>{localizeUi("ui.panels.themessettings.sidebar")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.sidebarBg")}</span>
              <span>{localizeUi("ui.panels.themessettings.sidebarBorder")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.sidebarBorder_26eaad1")}</span>
              <span>{localizeUi("ui.panels.themessettings.marinaraShellEdgeBorder")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.leftRightShellEdge")}</span>
              <span>{localizeUi("ui.panels.themessettings.destructive")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.errorDelete")}</span>
              <span>{localizeUi("ui.panels.themessettings.popover")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.dropdownBg")}</span>
              <span>{localizeUi("ui.panels.themessettings.accent")}</span>
              <span className="text-white/40">{localizeUi("ui.panels.themessettings.hoverHighlights")}</span>
            </div>
          </div>
        </details>
      </div>
    );
  }

  // ── Theme List View ──
  return (
    <div className="flex flex-col gap-3">
      {showIntro && (
        <SettingsIntro>
          {localizeUi("ui.panels.themessettings.createOrImportCustomCssThemesThemesSyncAcross")}
        </SettingsIntro>
      )}

      <SettingsSection
        title={localizeUi("settings.sections.themeLibrary.title")}
        description={localizeUi("settings.sections.themeLibrary.componentDescription")}
        icon={<Palette size="0.875rem" />}
        {...getSettingsSectionAnchorProps("theme-library")}
      >
        <div className="flex flex-col gap-3">
          {/* Action buttons */}
          <div className="flex gap-2">
            <button type="button" onClick={openNewTheme} className={cn(SETTINGS_BUTTON_CLASS, "flex-1")}>
              <Plus size="0.75rem" />
              {localizeUi("ui.panels.themessettings.createTheme")}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerFilePicker({
                  accept: ".css,.json",
                  onSelect: (files) => {
                    const file = files[0];
                    if (file) void handleImportThemeFile(file);
                  },
                });
              }}
              className={cn(SETTINGS_BUTTON_CLASS, "flex-1")}
            >
              <Download size="0.75rem" />
              {localizeUi("ui.panels.themessettings.importFile")}
            </button>
          </div>

          {/* Active theme: None option */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{localizeUi("ui.panels.themessettings.installedThemes")}</span>
            <button
              onClick={() =>
                setActiveTheme.mutate(null, {
                  onError: (err) => {
                    console.error("[ThemesSettings] Failed to reset active theme:", err);
                    toast.error(localizeUi("ui.panels.themessettings.failedToResetTheActiveTheme"));
                  },
                })
              }
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-all",
                activeCustomTheme === null
                  ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
              )}
            >
              <Palette size="0.75rem" className="mari-chrome-accent-icon" />
              {localizeUi("ui.panels.themessettings.defaultTheme")}
              {activeCustomTheme === null && <Check size="0.75rem" className="mari-chrome-accent-icon ml-auto" />}
            </button>

            {/* Custom theme list */}
            {syncedThemes.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all",
                  activeCustomTheme?.id === t.id
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                <button
                  onClick={() =>
                    setActiveTheme.mutate(t.id, {
                      onError: (err) => {
                        console.error("[ThemesSettings] Failed to activate theme:", err);
                        toast.error(localizeUi("ui.panels.themessettings.failedToActivateTheme"));
                      },
                    })
                  }
                  className="flex flex-1 items-center gap-2 min-w-0"
                >
                  <FileCode2 size="0.75rem" className="mari-chrome-accent-icon shrink-0" />
                  <span className="mari-chrome-text truncate">{t.name}</span>
                  {activeCustomTheme?.id === t.id && (
                    <Check size="0.75rem" className="mari-chrome-accent-icon shrink-0" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openEditTheme(t)}
                  className={SETTINGS_ICON_BUTTON_CLASS}
                  title={localizeUi("settings.actions.editThemeCss")}
                  aria-label={localizeUi("settings.actions.editThemeCss")}
                >
                  <Code size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadJsonFile(
                      {
                        kind: "marinara.theme-folder",
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        folderName: "Themes",
                        themes: [
                          createFolderEntry({
                            folderName: "Themes",
                            itemName: t.name,
                            itemKind: "marinara.theme",
                            config: { name: t.name, css: t.css },
                            fallbackName: "theme",
                          }),
                        ],
                      },
                      `${sanitizeExportFilenamePart(t.name, "theme")}.json`,
                    );
                  }}
                  className={SETTINGS_ICON_BUTTON_CLASS}
                  title={localizeUi("settings.actions.exportTheme")}
                  aria-label={localizeUi("settings.actions.exportTheme")}
                >
                  <Upload size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const confirmed = await showConfirmDialog({
                        title: localizeUi("ui.panels.themessettings.deleteTheme"),
                        message: localizeUi(
                          "ui.panels.themessettings.deleteValue1ThisPermanentlyRemovesTheSavedThemeCss",
                          { value1: t.name },
                        ),
                        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                        tone: "destructive",
                      });
                      if (!confirmed) return;
                      try {
                        await deleteTheme.mutateAsync(t.id);
                        toast.success(localizeUi("ui.panels.themessettings.themeValue1Removed", { value1: t.name }));
                      } catch (err) {
                        console.error("[ThemesSettings] Failed to remove theme:", err);
                        toast.error(localizeUi("ui.panels.themessettings.failedToRemoveTheme"));
                      }
                    })();
                  }}
                  className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger")}
                  title={localizeUi("settings.actions.removeTheme")}
                  aria-label={localizeUi("settings.actions.removeTheme")}
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            ))}

            {isLoading && syncedThemes.length === 0 && (
              <p className="mari-chrome-text-muted py-2 text-center text-[0.625rem]">
                {localizeUi("ui.panels.themessettings.loadingSyncedThemes")}
              </p>
            )}

            {!isLoading && syncedThemes.length === 0 && (
              <p className="mari-chrome-text-muted py-2 text-center text-[0.625rem]">
                {localizeUi("ui.panels.themessettings.noSyncedCustomThemesYetCreateOneOrImport")}
              </p>
            )}
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            <strong>{localizeUi("ui.panels.themessettings.tip")}</strong>{" "}
            {localizeUi("ui.panels.themessettings.cssThemesCanOverrideAnyCssVariableEG")}{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--background"}</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--primary"}</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--marinara-app-accent-solid"}</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--marinara-theme-accent-pulse"}</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--marinara-chat-chrome-accent"}</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--marinara-chat-chrome-accent-gradient"}</code>,{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{"--marinara-chat-chrome-surface-bg"}</code>
            {localizeUi("ui.panels.themessettings.orAddCustomStylesJsonThemesShouldHave")}{" "}
            <code className="rounded bg-[var(--secondary)] px-1">{'{ "name": "...", "css": "..." }'}</code>{" "}
            {localizeUi("ui.panels.themessettings.formatImportedThemeFilesSyncToThisMarinaraServer")}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

const CSS_TEMPLATE = `/* ═══════════════════════════════════════
   My Custom Theme
   ═══════════════════════════════════════ */

:root {
  /* ── Core Colors ── */
  /* --background: #0a0a0f; */
  /* --foreground: #e4e4e7; */
  /* --primary: #a78bfa; */
  /* --primary-foreground: #fff; */
  /* --marinara-app-accent-solid: var(--primary); */
  /* --marinara-app-accent-gradient: linear-gradient(90deg, var(--marinara-app-accent-solid), color-mix(in srgb, var(--marinara-app-accent-solid) 76%, var(--foreground) 24%), var(--marinara-app-accent-solid)); */
  /* --marinara-theme-accent-pulse: enabled; */
  /* --marinara-theme-accent-pulse-source: #a78bfa; */

  /* ── Surface Colors ── */
  /* --card: #111118; */
  /* --secondary: #1a1a24; */
  /* --accent: #252534; */
  /* --popover: #111118; */

  /* ── Borders ── */
  /* --border: #27272a; */
  /* --sidebar-border: #27272a; */
  /* --marinara-shell-edge-border: color-mix(in srgb, var(--primary) 14%, var(--background) 86%); */

  /* ── Text ── */
  /* --muted-foreground: #71717a; */

  /* ── Sidebar ── */
  /* --sidebar: #0c0c12; */

  /* ── Shared Chat / Roleplay / Game Chrome ── */
  /* --marinara-chat-chrome-accent: var(--marinara-app-accent-solid); */
  /* --marinara-chat-chrome-accent-gradient: var(--marinara-app-accent-gradient); */
  /* --marinara-chat-chrome-text: var(--foreground); Non-action chrome copy. */
  /* --marinara-chat-chrome-button-text-base: var(--marinara-chat-chrome-accent); */
  /* --marinara-chat-chrome-highlight-text-base: var(--marinara-chat-chrome-accent); */
  /* --marinara-chat-chrome-surface-bg: var(--card); */
  /* --marinara-chat-chrome-surface-bg-hover: color-mix(in srgb, var(--marinara-chat-chrome-surface-bg) 92%, var(--foreground) 8%); */
  /* --marinara-chat-chrome-surface-bg-active: color-mix(in srgb, var(--marinara-chat-chrome-surface-bg) 88%, var(--foreground) 12%); */
  /* --marinara-chat-chrome-button-bg: var(--marinara-chat-chrome-surface-bg); */
  /* --marinara-chat-chrome-button-bg-hover: color-mix(in srgb, var(--marinara-chat-chrome-surface-bg-hover) 90%, var(--marinara-chat-chrome-accent) 10%); */
  /* --marinara-chat-chrome-button-bg-active: color-mix(in srgb, var(--marinara-chat-chrome-surface-bg-active) 84%, var(--marinara-chat-chrome-accent) 16%); */
  /* --marinara-chat-chrome-button-border: color-mix(in srgb, var(--marinara-chat-chrome-accent) 12%, transparent); */
  /* --marinara-chat-chrome-button-border-hover: color-mix(in srgb, var(--marinara-chat-chrome-accent) 20%, transparent); */
  /* --marinara-chat-chrome-button-border-active: color-mix(in srgb, var(--marinara-chat-chrome-accent) 24%, transparent); */
  /* --marinara-chat-chrome-button-text: color-mix(in srgb, var(--marinara-chat-chrome-button-text-base) 64%, transparent); */
  /* --marinara-chat-chrome-button-text-hover: color-mix(in srgb, var(--marinara-chat-chrome-button-text-base) 92%, transparent); */
  /* --marinara-chat-chrome-button-text-active: color-mix(in srgb, var(--marinara-chat-chrome-button-text-base) 96%, transparent); */
  /* --marinara-chat-chrome-panel-bg: var(--marinara-chat-chrome-button-bg); */
  /* --marinara-chat-chrome-panel-border: color-mix(in srgb, var(--marinara-chat-chrome-accent) 16%, transparent); */
  /* --marinara-chat-chrome-panel-divider: color-mix(in srgb, var(--marinara-chat-chrome-accent) 13%, transparent); */
  /* --marinara-chat-chrome-panel-text: color-mix(in srgb, var(--marinara-chat-chrome-text) 90%, transparent); */
  /* --marinara-chat-chrome-panel-title: color-mix(in srgb, var(--marinara-chat-chrome-text) 96%, transparent); */
  /* --marinara-chat-chrome-panel-muted: color-mix(in srgb, var(--marinara-chat-chrome-text) 58%, transparent); */
  /* --marinara-chat-chrome-highlight-bg: color-mix(in srgb, var(--marinara-chat-chrome-accent) 9%, transparent); */
  /* --marinara-chat-chrome-highlight-bg-hover: color-mix(in srgb, var(--marinara-chat-chrome-accent) 13%, transparent); */
  /* --marinara-chat-chrome-highlight-text: color-mix(in srgb, var(--marinara-chat-chrome-highlight-text-base) 94%, transparent); */
  /* --marinara-chat-chrome-input-bg: var(--marinara-chat-chrome-surface-bg); */

  /* ── Chat windows and drawers (Chat Settings and its sections) ── */
  /* --mari-window-bg: var(--marinara-chat-chrome-panel-bg); */
  /* --mari-window-border: var(--marinara-chat-chrome-panel-border); */
  /* --mari-window-radius: calc(var(--radius) + 0.25rem); */
  /* --mari-window-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.4); */
  /* --mari-window-header-bg: transparent; */
  /* --mari-drawer-border: var(--border); */
  /* --mari-drawer-header-bg-hover: color-mix(in oklab, var(--accent) 50%, transparent); */
}

/* Uncomment and edit the variables above.
   You can also target shared chrome directly:
   .marinara-chat-toolbar-button { border-radius: 0.5rem; }
   .marinara-chat-popover { box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4); }
   [data-window="chat-settings"] .mari-window__header { background: rgb(0 0 0 / 0.2); }

   You can also add any custom CSS below: */
`;

function parseThemeJsonWithControlCharFallback(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch (parseErr) {
    try {
      const sanitized = text.replace(/"([^"\\]|\\.)*"/g, (match) =>
        match.replace(/\r/g, "").replace(/\n/g, "\\n").replace(/\t/g, "\\t"),
      );
      return JSON.parse(sanitized) as unknown;
    } catch {
      throw parseErr;
    }
  }
}

function triggerFilePicker(options: {
  accept?: string;
  multiple?: boolean;
  webkitdirectory?: boolean;
  onSelect: (files: FileList) => void;
}) {
  // Clean up any previously created/leaked inputs before spawning a new one.
  const existing = document.querySelectorAll(".marinara-programmatic-picker");
  existing.forEach((el) => el.parentNode?.removeChild(el));

  const el = document.createElement("input");
  el.type = "file";
  el.className = "marinara-programmatic-picker";
  el.style.position = "fixed";
  el.style.top = "10px";
  el.style.left = "10px";
  el.style.zIndex = "99999";
  el.style.opacity = "0";
  if (options.accept) el.accept = options.accept;
  if (options.multiple) el.multiple = true;
  if (options.webkitdirectory) {
    el.setAttribute("webkitdirectory", "");
  }

  el.addEventListener("change", (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      try {
        options.onSelect(files);
      } catch (err) {
        console.error("[triggerFilePicker] Error in onSelect callback:", err);
      }
    }
    if (el.parentNode === document.body) {
      document.body.removeChild(el);
    }
  });

  document.body.appendChild(el);
  el.click();
}

type ProfileImportStats = {
  characters?: number;
  personas?: number;
  lorebooks?: number;
  presets?: number;
  agents?: number;
  themes?: number;
  chats?: number;
  messages?: number;
  connections?: number;
  customTools?: number;
  mariInstructions?: number;
  personalExtensions?: number;
  files?: number;
};

type ProfileImportProgressData = {
  phase: string;
  label: string;
  completedItems: number;
  totalItems: number;
  imported?: ProfileImportStats;
};

type ProfileImportProgressState = {
  status: "reading" | "preview" | "starting" | "running" | "success" | "error";
  label: string;
  completedItems: number;
  totalItems: number;
  startedAt: number;
  elapsedSeconds: number;
  imported?: ProfileImportStats;
  warnings?: ProfileImportWarning[];
  error?: string;
};

type ProfileImportStreamEvent =
  | { type: "started"; data?: { label?: string; totalItems?: number } }
  | { type: "progress"; data?: ProfileImportProgressData }
  | {
      type: "done";
      data?: {
        success?: boolean;
        imported?: ProfileImportStats;
        warnings?: ProfileImportWarning[];
        error?: string;
        message?: string;
      };
    }
  | { type: "error"; data?: string | { error?: string; message?: string } };

type ProfileImportPreviewResult = {
  success?: boolean;
  preview?: boolean;
  imported?: ProfileImportStats;
  warnings?: ProfileImportWarning[];
  previewToken?: string;
  error?: string;
  message?: string;
};

function formatProfileImportDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function estimateProfileImportRemainingSeconds(progress: ProfileImportProgressState) {
  if (progress.status !== "running" || progress.completedItems <= 0 || progress.totalItems <= progress.completedItems) {
    return null;
  }
  const secondsPerItem = progress.elapsedSeconds / progress.completedItems;
  return Math.max(1, Math.round(secondsPerItem * (progress.totalItems - progress.completedItems)));
}

function getProfileImportPercent(progress: ProfileImportProgressState) {
  if (progress.status === "success") return 100;
  if (progress.status === "preview") return 0;
  if (progress.totalItems <= 0) return progress.status === "running" ? 8 : 0;
  const percent = Math.round((progress.completedItems / progress.totalItems) * 100);
  return Math.min(99, Math.max(progress.status === "running" ? 8 : 0, percent));
}

function formatProfileImportStats(stats: ProfileImportStats | undefined, localizeUi: TFunction) {
  if (!stats) return "";
  const entries: Array<[number | undefined, string]> = [
    [stats.characters, "characters"],
    [stats.personas, "personas"],
    [stats.lorebooks, "lorebooks"],
    [stats.presets, "presets"],
    [stats.agents, "agents"],
    [stats.themes, "themes"],
    [stats.chats, "chats"],
    [stats.messages, "messages"],
    [stats.connections, "connections"],
    [stats.customTools, localizeUi("ui.panels.importsettings.customTools")],
    [stats.mariInstructions, localizeUi("ui.panels.importsettings.professorMariMemories")],
    [stats.personalExtensions, localizeUi("ui.panels.importsettings.personalExtensions")],
    [stats.files, "files"],
  ];
  return entries
    .filter(([count]) => typeof count === "number" && count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(", ");
}

function getProfileImportItemCount(stats?: ProfileImportStats) {
  if (!stats) return 0;
  const counts: Array<number | undefined> = [
    stats.characters,
    stats.personas,
    stats.lorebooks,
    stats.presets,
    stats.agents,
    stats.themes,
    stats.chats,
    stats.messages,
    stats.connections,
    stats.customTools,
    stats.mariInstructions,
    stats.personalExtensions,
    stats.files,
  ];
  return counts.reduce<number>((total, count) => total + (typeof count === "number" && count > 0 ? count : 0), 0);
}

function getProfileImportWarningCopy(localizeUi: TFunction): ProfileImportWarningCopy {
  return {
    missingAssetSummary: (count) => localizeUi("ui.panels.importsettings.profileImportMissingAssets", { count }),
    skippedAssetSummary: (count) => localizeUi("ui.panels.importsettings.profileImportSkippedAssets", { count }),
    securityWarningSummary: (count) => localizeUi("ui.panels.importsettings.profileImportSecurityWarnings", { count }),
    missingLabel: localizeUi("ui.panels.importsettings.profileImportMissingLabel"),
    skippedLabel: localizeUi("ui.panels.importsettings.profileImportSkippedLabel"),
    additionalPaths: (count) => localizeUi("ui.panels.importsettings.profileImportAdditionalPaths", { count }),
    additionalMessages: (count) => localizeUi("ui.panels.importsettings.profileImportAdditionalMessages", { count }),
  };
}

function getProfileImportErrorMessage(data: unknown) {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const record = data as { message?: unknown; error?: unknown };
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return "Unknown error";
}

function formatProfileImportConfirmationMessage(preview: ProfileImportPreviewResult, localizeUi: TFunction) {
  const warnings = normalizeProfileImportWarnings(preview.warnings);
  const found = formatProfileImportStats(preview.imported, localizeUi) || "no counted records";
  const warningCopy = getProfileImportWarningCopy(localizeUi);
  const warningDetail =
    warnings.length > 0
      ? `${formatProfileImportWarningSummary(warnings, warningCopy)} ${formatProfileImportWarningDetails(warnings, warningCopy)}`
      : "";
  return [
    `Found: ${found}.`,
    warningDetail,
    "Importing writes profile data from this file and cannot be undone. Continue?",
  ]
    .filter(Boolean)
    .join("\n");
}

function getDownloadFilename(res: Response, fallback: string) {
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

type ProfileExportFailure = {
  code?: string;
  message: string;
  fallbackFormat?: string;
};

async function readProfileExportFailure(res: Response, fallback: string): Promise<ProfileExportFailure> {
  const contentType = res.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as {
        code?: unknown;
        error?: unknown;
        message?: unknown;
        fallbackFormat?: unknown;
      };
      const message = typeof payload.message === "string" ? payload.message : payload.error;
      return {
        code: typeof payload.code === "string" ? payload.code : undefined,
        fallbackFormat: typeof payload.fallbackFormat === "string" ? payload.fallbackFormat : undefined,
        message: typeof message === "string" && message.trim() ? message : fallback,
      };
    }

    const text = (await res.text()).trim();
    return { message: text ? text.slice(0, 500) : fallback };
  } catch {
    return { message: fallback };
  }
}

async function isZipFile(file: File) {
  if (file.size < 2) return false;
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b;
}

async function* readProfileImportStream(res: Response): AsyncGenerator<ProfileImportStreamEvent> {
  if (!res.body) throw new Error("Import started but no progress stream was returned.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6)) as ProfileImportStreamEvent;
      } catch {
        /* ignore malformed progress chunks */
      }
    }
  }
}

function ImportSettings() {
  const { t: localizeUi } = useUiTranslation();
  const profileImportWarningCopy = getProfileImportWarningCopy(localizeUi);
  const openModal = useUIStore((s) => s.openModal);
  const qc = useQueryClient();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const [profileImportProgress, setProfileImportProgress] = useState<ProfileImportProgressState | null>(null);
  const profileImportBusy =
    profileImportProgress?.status === "reading" ||
    profileImportProgress?.status === "preview" ||
    profileImportProgress?.status === "starting" ||
    profileImportProgress?.status === "running";

  useEffect(() => {
    if (!profileImportBusy) return;
    const timer = window.setInterval(() => {
      setProfileImportProgress((current) =>
        current &&
        (current.status === "reading" ||
          current.status === "preview" ||
          current.status === "starting" ||
          current.status === "running")
          ? { ...current, elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000) }
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [profileImportBusy]);

  const profileImportInputRef = useRef<HTMLInputElement>(null);
  const handleProfileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let previewToken: string | undefined;
    const releaseProfilePreview = async () => {
      if (!previewToken) return;
      const token = previewToken;
      previewToken = undefined;
      await api
        .raw(`/backup/import-profile-preview/${encodeURIComponent(token)}`, { method: "DELETE" })
        .catch(() => {});
    };
    const startedAt = Date.now();
    const makeImportBody = (isZip: boolean, text: string): BodyInit => {
      if (!isZip) return text;
      const form = new FormData();
      form.append("file", file, file.name);
      return form;
    };
    setProfileImportProgress({
      status: "reading",
      label: "Reading profile file",
      completedItems: 0,
      totalItems: 1,
      startedAt,
      elapsedSeconds: 0,
    });
    try {
      const isLoopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
      if (window.location.protocol !== "https:" && !isLoopbackHost) {
        throw new Error(localizeUi("ui.panels.importsettings.profileImportRequiresHttps"));
      }
      const isZip = await isZipFile(file);
      let profileText = "";
      if (!isZip) {
        profileText = await file.text();
        const envelope = JSON.parse(profileText) as { type?: string };
        if (envelope.type !== "marinara_profile") {
          setProfileImportProgress({
            status: "error",
            label: "Profile import failed",
            completedItems: 0,
            totalItems: 1,
            startedAt,
            elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            error: "Not a valid profile export file.",
          });
          toast.error(localizeUi("ui.panels.importsettings.notAValidProfileExportFile"));
          e.target.value = "";
          return;
        }
      }

      setProfileImportProgress((current) =>
        current
          ? {
              ...current,
              status: "preview",
              label: isZip ? "Scanning profile archive" : "Scanning profile file",
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            }
          : current,
      );
      const previewRes = await api.raw("/backup/import-profile?preview=true", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: makeImportBody(isZip, profileText),
      });
      if (!previewRes.ok) {
        const data = (await previewRes.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(data.message ?? data.error ?? previewRes.statusText ?? "Unknown error");
      }
      const preview = (await previewRes.json()) as ProfileImportPreviewResult;
      if (preview.success === false) {
        throw new Error(preview.message ?? preview.error ?? "Unknown error");
      }
      previewToken = preview.previewToken;
      const previewWarnings = normalizeProfileImportWarnings(preview.warnings);
      const previewTotalItems = Math.max(1, getProfileImportItemCount(preview.imported));
      setProfileImportProgress({
        status: "preview",
        label: "Review profile import",
        completedItems: 0,
        totalItems: previewTotalItems,
        startedAt,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        imported: preview.imported,
        warnings: previewWarnings,
      });

      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.panels.importsettings.importProfile"),
        message: formatProfileImportConfirmationMessage(preview, localizeUi),
        confirmLabel: localizeUi("ui.chat.chatbranchselector.import"),
        cancelLabel: "Cancel",
        tone: "destructive",
      });
      if (!confirmed) {
        await releaseProfilePreview();
        setProfileImportProgress(null);
        e.target.value = "";
        return;
      }

      if (!isZip) {
        // Re-parse the cached text after the confirmation boundary so malformed
        // JSON still reports as a profile-file error before we start streaming.
        const envelope = JSON.parse(profileText) as { type?: string };
        if (envelope.type !== "marinara_profile") {
          setProfileImportProgress({
            status: "error",
            label: "Profile import failed",
            completedItems: 0,
            totalItems: 1,
            startedAt,
            elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            error: "Not a valid profile export file.",
          });
          toast.error(localizeUi("ui.panels.importsettings.notAValidProfileExportFile"));
          e.target.value = "";
          return;
        }
      }
      setProfileImportProgress((current) =>
        current
          ? {
              ...current,
              status: "starting",
              label: previewToken
                ? "Starting profile import"
                : isZip
                  ? "Uploading profile archive"
                  : "Starting profile import",
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            }
          : current,
      );
      const res = await api.raw("/backup/import-profile", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          ...(previewToken ? { "X-Profile-Preview-Token": previewToken } : {}),
        },
        body: previewToken ? undefined : makeImportBody(isZip, profileText),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(data.message ?? data.error ?? res.statusText ?? "Unknown error");
      }
      let importCompleted = false;
      for await (const event of readProfileImportStream(res)) {
        if (event.type === "started") {
          setProfileImportProgress((current) => ({
            status: "running",
            label: event.data?.label ?? "Profile import started",
            completedItems: 0,
            totalItems: Math.max(1, event.data?.totalItems ?? current?.totalItems ?? 1),
            startedAt,
            elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          }));
          continue;
        }
        if (event.type === "progress" && event.data) {
          setProfileImportProgress((current) => ({
            status: "running",
            label: event.data?.label ?? "Importing profile",
            completedItems: event.data?.completedItems ?? current?.completedItems ?? 0,
            totalItems: Math.max(1, event.data?.totalItems ?? current?.totalItems ?? 1),
            startedAt,
            elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
            imported: event.data?.imported,
          }));
          continue;
        }
        if (event.type === "error") {
          throw new Error(getProfileImportErrorMessage(event.data));
        }
        if (event.type === "done") {
          if (event.data?.success === false) throw new Error(event.data.error ?? event.data.message ?? "Unknown error");
          importCompleted = true;
          qc.invalidateQueries();
          const imported = event.data?.imported;
          const warnings = normalizeProfileImportWarnings(event.data?.warnings);
          const summary = formatProfileImportStats(imported, localizeUi);
          setProfileImportProgress((current) => {
            const totalItems = Math.max(1, current?.totalItems ?? 1);
            return {
              status: "success",
              label:
                warnings.length > 0
                  ? localizeUi("ui.panels.importsettings.profileImportCompleteWithWarnings")
                  : "Profile import complete",
              completedItems: totalItems,
              totalItems,
              startedAt,
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
              imported,
              warnings,
            };
          });
          if (warnings.length > 0) {
            const warningSummary = formatProfileImportWarningSummary(warnings, profileImportWarningCopy);
            toast.warning(
              summary
                ? localizeUi("ui.panels.importsettings.importedValue1Value2", {
                    value1: summary,
                    value2: warningSummary,
                  })
                : warningSummary,
            );
          } else {
            toast.success(
              summary
                ? localizeUi("ui.panels.importsettings.importedValue1", { value1: summary })
                : localizeUi("ui.panels.importsettings.profileImported"),
            );
          }
        }
      }
      if (!importCompleted) {
        throw new Error("Profile import stream closed before completion.");
      }
      previewToken = undefined;
    } catch (err) {
      await releaseProfilePreview();
      const message =
        err instanceof SyntaxError
          ? "Import failed. Make sure this is a valid profile JSON or ZIP file."
          : `Import failed: ${err instanceof Error ? err.message : "network/server error"}`;
      setProfileImportProgress({
        status: "error",
        label: "Profile import failed",
        completedItems: 0,
        totalItems: 1,
        startedAt,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        error: message.replace(/^Import failed:\s*/, ""),
      });
      toast.error(message);
    }
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      <SettingsIntro>
        {localizeUi("ui.panels.importsettings.importDataFromMarinaraExportsSillytavernOrAssetFolders")}
      </SettingsIntro>

      <SettingsSection
        title={localizeUi("settings.sections.profileMarinara.title")}
        description={localizeUi("settings.sections.profileMarinara.description")}
        icon={<Download size="0.875rem" />}
        {...getSettingsSectionAnchorProps("profile-marinara")}
      >
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => profileImportInputRef.current?.click()}
            disabled={profileImportBusy}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            {profileImportBusy ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Download size="0.8125rem" />}
            {profileImportBusy
              ? profileImportProgress?.status === "reading" || profileImportProgress?.status === "preview"
                ? localizeUi("ui.panels.importsettings.scanningProfile")
                : localizeUi("ui.panels.importsettings.importingProfile")
              : localizeUi("ui.panels.importsettings.importProfileJsonZip")}
          </button>
          <input
            ref={profileImportInputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={handleProfileImport}
            disabled={profileImportBusy}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {profileImportProgress && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "flex flex-col gap-2 rounded-lg border px-3 py-2 text-xs",
                profileImportProgress.status === "error"
                  ? "border-[var(--destructive)]/40 bg-[var(--destructive)]/10 text-[var(--destructive)]"
                  : profileImportProgress.status === "success" && profileImportProgress.warnings?.length
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                    : profileImportProgress.status === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-[var(--foreground)]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {profileImportProgress.status === "success" && profileImportProgress.warnings?.length ? (
                    <AlertTriangle size="0.875rem" className="shrink-0" />
                  ) : profileImportProgress.status === "success" ? (
                    <Check size="0.875rem" className="shrink-0" />
                  ) : profileImportProgress.status === "error" ? (
                    <AlertTriangle size="0.875rem" className="shrink-0" />
                  ) : (
                    <Loader2 size="0.875rem" className="shrink-0 animate-spin text-emerald-500" />
                  )}
                  <span className="truncate font-medium">{profileImportProgress.label}</span>
                </div>
                <span className="shrink-0 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {formatProfileImportDuration(profileImportProgress.elapsedSeconds)}
                </span>
              </div>

              {profileImportProgress.status !== "error" && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        profileImportProgress.status === "success" && profileImportProgress.warnings?.length
                          ? "bg-amber-500"
                          : profileImportProgress.status === "success"
                            ? "bg-emerald-500"
                            : "bg-emerald-400",
                      )}
                      style={{ width: `${getProfileImportPercent(profileImportProgress)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                    <span>
                      {profileImportProgress.completedItems}/{profileImportProgress.totalItems}{" "}
                      {localizeUi("ui.panels.importsettings.items")}
                    </span>
                    {estimateProfileImportRemainingSeconds(profileImportProgress) !== null && (
                      <span>
                        {localizeUi("ui.panels.importsettings.eta")}{" "}
                        {formatProfileImportDuration(estimateProfileImportRemainingSeconds(profileImportProgress) ?? 0)}
                      </span>
                    )}
                  </div>
                  {formatProfileImportStats(profileImportProgress.imported, localizeUi) && (
                    <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {profileImportProgress.status === "preview"
                        ? localizeUi("ui.panels.importsettings.found")
                        : localizeUi("ui.panels.importsettings.importedSoFar")}
                      : {formatProfileImportStats(profileImportProgress.imported, localizeUi)}
                    </div>
                  )}
                  {profileImportProgress.warnings?.length ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[0.6875rem] text-amber-700 dark:text-amber-200">
                      <div className="font-medium">
                        {formatProfileImportWarningSummary(profileImportProgress.warnings, profileImportWarningCopy)}
                      </div>
                      {formatProfileImportWarningDetails(profileImportProgress.warnings, profileImportWarningCopy) && (
                        <div className="mt-0.5 break-words text-amber-700/80 dark:text-amber-100/80">
                          {formatProfileImportWarningDetails(profileImportProgress.warnings, profileImportWarningCopy)}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}

              {profileImportProgress.status === "error" && profileImportProgress.error && (
                <div className="text-[0.6875rem]">{profileImportProgress.error}</div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.sillyTavernImport.title")}
        description={localizeUi("settings.sections.sillyTavernImport.componentDescription")}
        icon={<FolderOpen size="0.875rem" />}
        {...getSettingsSectionAnchorProps("sillytavern-import")}
      >
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => openModal("st-bulk-import")}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            <Download size="0.8125rem" />
            {localizeUi("ui.panels.importsettings.importFromSillytavernFolder")}
          </button>

          <div className="flex flex-col gap-2">
            <ImportButton
              label={localizeUi("settings.transfer.importCharacter")}
              accept=".json,.png"
              endpoint="/import/st-character"
              mode="auto"
            />
            <ImportButton
              label={localizeUi("settings.transfer.importChat")}
              accept=".jsonl"
              endpoint="/import/st-chat"
              mode="file"
              onImported={(data) => {
                qc.invalidateQueries({ queryKey: chatKeys.list() });
                if (data.chatId) setActiveChatId(data.chatId);
              }}
            />
            <ImportButton
              label={localizeUi("settings.transfer.importPreset")}
              accept=".json"
              endpoint="/import/st-preset"
              mode="json"
            />
            <ImportButton
              label={localizeUi("settings.transfer.importLorebook")}
              accept=".json"
              endpoint="/import/st-lorebook"
              mode="json"
            />
          </div>
        </div>
      </SettingsSection>

      <GameAssetsSettings />
    </div>
  );
}

function ImportButton({
  label,
  accept,
  endpoint,
  mode = "file",
  onImported,
}: {
  label: string;
  accept: string;
  endpoint: string;
  mode?: "file" | "json" | "auto";
  onImported?: (data: any) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let res: Response;
      let importEmbeddedLorebook: boolean | undefined;

      // "auto" mode: send binary files (PNG) as multipart, JSON files as JSON body
      const effectiveMode = mode === "auto" ? (file.name.toLowerCase().endsWith(".json") ? "json" : "file") : mode;
      if (endpoint === "/import/st-character") {
        const previews = await inspectCharacterFilesForEmbeddedLorebooks([file]);
        const preview = previews[0];
        if (preview) {
          importEmbeddedLorebook = window.confirm(
            localizeUi("ui.panels.importbutton.embeddedLorebookImportPrompt", {
              name: preview.name ?? file.name,
              count: preview.embeddedLorebookEntries,
            }),
          );
        }
      }

      if (effectiveMode === "json") {
        const text = await file.text();
        const json = JSON.parse(text);
        // Pass filename as fallback name for lorebook/preset imports
        if (endpoint.includes("lorebook") || endpoint.includes("preset")) {
          json.__filename = file.name.replace(/\.json$/i, "");
        }
        if (endpoint === "/import/st-character" && importEmbeddedLorebook !== undefined) {
          json.importEmbeddedLorebook = importEmbeddedLorebook;
        }
        res = await fetch(`/api${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        });
      } else {
        const formData = new FormData();
        if (endpoint === "/import/st-character" && importEmbeddedLorebook !== undefined) {
          formData.append("importEmbeddedLorebook", String(importEmbeddedLorebook));
        }
        formData.append("file", file);
        res = await fetch(`/api${endpoint}`, {
          method: "POST",
          body: formData,
        });
      }
      const data = await res.json();
      if (data.success) {
        if (onImported) {
          onImported(data);
        } else {
          toast.success(localizeUi("ui.panels.importbutton.importedSuccessfully"));
        }
      } else {
        toast.error(
          localizeUi("ui.panels.importbutton.importFailedValue1", {
            value1: data.error ?? localizeUi("ui.panels.importbutton.unknownError"),
          }),
        );
      }
    } catch {
      toast.error(localizeUi("chat.branches.importFailed"));
    }
    e.target.value = "";
  };

  return (
    <label className={cn(SETTINGS_BUTTON_CLASS, "cursor-pointer")}>
      {label}
      <input type="file" accept={accept} onChange={handleImport} className="hidden" />
    </label>
  );
}

function ManualUpdateCommand({ command }: { command: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const didCopy = await copyToClipboard(command);
    setCopied(didCopy);
    if (!didCopy) toast.error(localizeUi("ui.panels.manualupdatecommand.couldNotCopyTheUpdateCommand"));
  }, [command, localizeUi]);

  return (
    <div
      data-component="SettingsPanel.ManualUpdateCommand"
      className="min-w-0 rounded-md bg-[var(--background)]/70 p-2 ring-1 ring-[var(--border)]"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.manualupdatecommand.manualUpdate")}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={SETTINGS_BUTTON_CLASS}
          aria-label={localizeUi("settings.actions.copyUpdateCommand")}
        >
          {copied ? <Check size="0.75rem" /> : <Copy size="0.75rem" />}
          {copied ? localizeUi("ui.panels.manualupdatecommand.copied") : localizeUi("lorebook.editor.batch.copy")}
        </button>
      </div>
      <code className="block max-w-full overflow-x-auto whitespace-pre rounded bg-[var(--background)] px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)]">
        {command}
      </code>
    </div>
  );
}

function AdvancedSettings() {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const activeChatId = useChatStore((state) => state.activeChatId);
  const { data: activeChat, isLoading: isActiveChatLoading } = useChat(activeChatId);
  const { data: rawConnections, isLoading: isConnectionsLoading } = useConnections();
  const showTimestamps = useUIStore((s) => s.showTimestamps);
  const setShowTimestamps = useUIStore((s) => s.setShowTimestamps);
  const showModelName = useUIStore((s) => s.showModelName);
  const setShowModelName = useUIStore((s) => s.setShowModelName);
  const showTokenUsage = useUIStore((s) => s.showTokenUsage);
  const setShowTokenUsage = useUIStore((s) => s.setShowTokenUsage);
  const showContextUsage = useUIStore((s) => s.showContextUsage);
  const setShowContextUsage = useUIStore((s) => s.setShowContextUsage);
  const showMessageNumbers = useUIStore((s) => s.showMessageNumbers);
  const setShowMessageNumbers = useUIStore((s) => s.setShowMessageNumbers);
  const showCharactersInPersonaPickers = useUIStore((s) => s.showCharactersInPersonaPickers);
  const setShowCharactersInPersonaPickers = useUIStore((s) => s.setShowCharactersInPersonaPickers);
  const guideGenerations = useUIStore((s) => s.guideGenerations);
  const setGuideGenerations = useUIStore((s) => s.setGuideGenerations);
  const includeReasoningInExports = useUIStore((s) => s.includeReasoningInExports);
  const setIncludeReasoningInExports = useUIStore((s) => s.setIncludeReasoningInExports);
  const includePrivateNotesInExports = useUIStore((s) => s.includePrivateNotesInExports);
  const setIncludePrivateNotesInExports = useUIStore((s) => s.setIncludePrivateNotesInExports);
  const debugMode = useUIStore((s) => s.debugMode);
  const setDebugMode = useUIStore((s) => s.setDebugMode);
  const clearAllData = useClearAllData();
  const expungeData = useExpungeData();
  const [selectedScopes, setSelectedScopes] = useState<ExpungeScope[]>([]);
  const [confirmAction, setConfirmAction] = useState<"selected" | "all" | null>(null);
  const [exportingProfile, setExportingProfile] = useState(false);
  const [exportProfileDialogOpen, setExportProfileDialogOpen] = useState(false);
  const [refreshingSpa, setRefreshingSpa] = useState(false);
  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? "");
  const restartServer = useMutation({
    mutationFn: () => api.post<{ status: "restarting" }>("/admin/restart", { confirm: true }),
    onSuccess: () => toast.success(localizeUi("settings.serverRestart.success")),
    onError: (error) => {
      toast.error(getPrivilegedActionErrorMessage(error, localizeUi("settings.serverRestart.error")));
    },
  });
  const { data: extensionPolicy, isLoading: extensionPolicyLoading } = usePersonalExtensionPolicy();
  const setExternalExtensionsEnabled = useSetExternalExtensionsEnabled();
  const { data: agentImportPolicy, isLoading: agentImportPolicyLoading } = useAgentImportPolicy();
  const setAgentImportsEnabled = useSetAgentImportsEnabled();
  type AvatarStorageSummary = { files: number; bytes: number; minimumAgeMinutes: number };
  const [avatarStorageSummary, setAvatarStorageSummary] = useState<AvatarStorageSummary | null>(null);
  const scanAvatarStorage = useMutation({
    mutationFn: () => api.get<AvatarStorageSummary>("/admin/avatar-storage/abandoned"),
    onSuccess: setAvatarStorageSummary,
    onError: (error) => {
      toast.error(getPrivilegedActionErrorMessage(error, localizeUi("settings.storageOptimization.error")));
    },
  });
  const cleanAvatarStorage = useMutation({
    mutationFn: () => api.post<AvatarStorageSummary>("/admin/avatar-storage/cleanup", { confirm: true }),
    onSuccess: (result) => {
      setAvatarStorageSummary({ ...result, files: 0, bytes: 0 });
      toast.success(
        localizeUi("settings.storageOptimization.deleted", {
          count: result.files,
          size: formatStorageBytes(result.bytes),
        }),
      );
    },
    onError: (error) => {
      toast.error(getPrivilegedActionErrorMessage(error, localizeUi("settings.storageOptimization.error")));
    },
  });
  const nativeConsoleBridge = getMarinaraAndroidBridge();
  const canOpenNativeConsole = typeof nativeConsoleBridge?.openConsole === "function";
  const nativeConsoleHelp = getNativeConsoleShortcutHelp();

  const handleOpenNativeConsole = useCallback(() => {
    const bridge = getMarinaraAndroidBridge();
    if (typeof bridge?.openConsole !== "function") {
      toast.info(getNativeConsoleShortcutHelp());
      return;
    }

    const token = getAndroidBridgeToken();
    if (token) bridge.openConsole(token);
    else bridge.openConsole();
    toast.info(localizeUi("ui.panels.advancedsettings.openingTermuxConsole"));
  }, [localizeUi]);

  const handleExternalExtensionsToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const confirmed = await showConfirmDialog({
          title: t("settings.externalExtensions.confirm.title"),
          message: t("settings.externalExtensions.warning"),
          confirmLabel: t("settings.externalExtensions.confirm.action"),
          cancelLabel: t("settings.externalExtensions.confirm.cancel"),
          tone: "destructive",
        });
        if (!confirmed) return;
      }
      try {
        await setExternalExtensionsEnabled.mutateAsync(enabled);
        toast.success(enabled ? t("settings.externalExtensions.enabled") : t("settings.externalExtensions.disabled"));
      } catch (toggleError) {
        toast.error(getPrivilegedActionErrorMessage(toggleError, t("settings.externalExtensions.error")));
      }
    },
    [setExternalExtensionsEnabled, t],
  );

  const handleAgentImportsToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const confirmed = await showConfirmDialog({
          title: t("settings.agentImports.confirm.title"),
          message: t("settings.agentImports.warning"),
          confirmLabel: t("settings.agentImports.confirm.action"),
          cancelLabel: t("settings.agentImports.confirm.cancel"),
          tone: "destructive",
        });
        if (!confirmed) return;
      }
      try {
        await setAgentImportsEnabled.mutateAsync(enabled);
        toast.success(enabled ? t("settings.agentImports.enabled") : t("settings.agentImports.disabled"));
      } catch (toggleError) {
        toast.error(getPrivilegedActionErrorMessage(toggleError, t("settings.agentImports.error")));
      }
    },
    [setAgentImportsEnabled, t],
  );

  const handleDeleteAbandonedAvatars = useCallback(async () => {
    if (!avatarStorageSummary || avatarStorageSummary.files < 1) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("settings.storageOptimization.confirm.title", {
        count: avatarStorageSummary.files,
      }),
      message: localizeUi("settings.storageOptimization.confirm.message", {
        count: avatarStorageSummary.files,
        minutes: avatarStorageSummary.minimumAgeMinutes,
        size: formatStorageBytes(avatarStorageSummary.bytes),
      }),
      confirmLabel: localizeUi("settings.storageOptimization.action.delete"),
      cancelLabel: localizeUi("chat.delete.dialog.cancel"),
      tone: "destructive",
    });
    if (confirmed) cleanAvatarStorage.mutate();
  }, [avatarStorageSummary, cleanAvatarStorage, localizeUi]);

  type ProfileExportFormat = "native" | "compatible" | "zip";
  const profileExportFallbackNames: Record<ProfileExportFormat, string> = {
    native: "marinara-profile.json",
    compatible: "marinara-compatible-export.zip",
    zip: "marinara-profile.zip",
  };
  const profileExportSuccessMessages: Record<ProfileExportFormat, string> = {
    native: "Profile exported!",
    compatible: "Compatible export created!",
    zip: "Profile ZIP exported!",
  };

  const handleExportProfile = async (format: ProfileExportFormat) => {
    setExportingProfile(true);
    setExportProfileDialogOpen(false);
    try {
      const res = await api.raw(`/backup/export-profile?format=${format}`);
      if (!res.ok) {
        const failure = await readProfileExportFailure(res, "Export failed");
        if (
          format === "native" &&
          failure.code === "PROFILE_EXPORT_JSON_TOO_LARGE" &&
          failure.fallbackFormat === "zip"
        ) {
          const confirmed = await showConfirmDialog({
            title: localizeUi("ui.panels.advancedsettings.exportProfileAsZip"),
            message: failure.message,
            confirmLabel: localizeUi("ui.panels.advancedsettings.exportZip"),
            cancelLabel: "Cancel",
          });
          if (confirmed) {
            await handleExportProfile("zip");
          }
          return;
        }
        throw new Error(failure.message);
      }
      const saveStatus = await saveExportFile(
        await res.blob(),
        getDownloadFilename(res, profileExportFallbackNames[format]),
      );
      if (saveStatus === "saved") toast.success(profileExportSuccessMessages[format]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : localizeUi("ui.panels.advancedsettings.failedToExportProfile"));
    } finally {
      setExportingProfile(false);
    }
  };

  const handleExportProfileChoice = (format: ExportFormatChoice) => {
    if (format === "compatible-png") return;
    void handleExportProfile(format);
  };

  const handleForceRefreshSpa = async () => {
    if (refreshingSpa) {
      return;
    }

    setRefreshingSpa(true);

    try {
      toast.info(localizeUi("ui.panels.advancedsettings.clearingCachesAndRefreshingApp"));
      await forceRefreshSpa();
    } catch (err) {
      setRefreshingSpa(false);
      toast.error(err instanceof Error ? err.message : localizeUi("ui.panels.advancedsettings.failedToRefreshTheApp"));
    }
  };

  const qc = useQueryClient();
  const [creatingBackup, setCreatingBackup] = useState(false);

  /**
   * Prepare a full backup, then hand its finished stream directly to the browser.
   * Keeping the archive out of a page-held Blob lets Safari and memory-limited
   * mobile browsers save large backups through their normal download handling.
   */
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const started = await api.post<{ jobId: string; status: "preparing" }>("/backup/download/start");
      const deadline = Date.now() + 60 * 60 * 1_000;
      let status: {
        status: "preparing" | "ready" | "failed";
        error?: string;
        downloadUrl?: string;
      } = { status: started.status };
      while (status.status === "preparing") {
        if (Date.now() >= deadline) {
          throw new Error(localizeUi("ui.panels.advancedsettings.backupPreparationTimedOut"));
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        status = await api.get(`/backup/download/status/${encodeURIComponent(started.jobId)}`);
      }
      if (status.status === "failed") {
        throw new Error(status.error || localizeUi("ui.panels.advancedsettings.failedToCreateBackup"));
      }
      if (!status.downloadUrl) {
        throw new Error(localizeUi("ui.panels.advancedsettings.failedToCreateBackup"));
      }

      window.location.assign(status.downloadUrl);
      toast.success(localizeUi("ui.panels.advancedsettings.backupDownloadStarted"));
      qc.invalidateQueries({ queryKey: ["backups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : localizeUi("ui.panels.advancedsettings.failedToCreateBackup"));
    } finally {
      setCreatingBackup(false);
    }
  };

  const { data: backups } = useQuery<{ name: string; createdAt: string; path: string }[]>({
    queryKey: ["backups"],
    queryFn: () => api.get("/backup"),
  });
  type AutomaticBackupFrequency = "daily" | "weekly" | "monthly";
  type AutomaticBackupSettings = {
    enabled: boolean;
    frequency: AutomaticBackupFrequency;
    retentionCount: number;
    lastBackupAt: string | null;
    lastError: string | null;
    nextBackupAt: string | null;
    backupExists: boolean;
  };
  const automaticBackupQuery = useQuery<AutomaticBackupSettings>({
    queryKey: ["backups", "automatic"],
    queryFn: () => api.get("/backup/automatic"),
    refetchInterval: (query) => (query.state.data?.enabled ? 30_000 : false),
  });
  const automaticBackupMutation = useMutation({
    mutationFn: (settings: Pick<AutomaticBackupSettings, "enabled" | "frequency" | "retentionCount">) =>
      api.put<AutomaticBackupSettings>("/backup/automatic", settings),
    onSuccess: (settings) => {
      qc.setQueryData(["backups", "automatic"], settings);
      toast.success(localizeUi("ui.panels.advancedsettings.automaticBackupSettingsSaved"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.panels.advancedsettings.failedToSaveAutomaticBackupSettings"),
      );
    },
  });
  const updateAutomaticBackup = (
    patch: Partial<Pick<AutomaticBackupSettings, "enabled" | "frequency" | "retentionCount">>,
  ) => {
    const current = automaticBackupQuery.data;
    if (!current) return;
    automaticBackupMutation.mutate({
      enabled: patch.enabled ?? current.enabled,
      frequency: patch.frequency ?? current.frequency,
      retentionCount: patch.retentionCount ?? current.retentionCount,
    });
  };

  const health = useQuery<{
    status: string;
    timestamp: string;
    version: string;
    commit: string | null;
    build: string;
    serverOs: string;
    memory: {
      heapUsedMiB: number;
      heapLimitMiB: number;
      rssMiB: number;
    };
    wakeLock?: string | null;
    lastFreeze?: { detectedAt: string; gapMs: number; suspendedMs: number } | null;
    previousSession?:
      | { status: "unknown"; reason: string }
      | { status: "ended"; exitKind: "clean" | "crash" | "restart"; exitedAt: string | null; exitCode: number | null }
      | {
          status: "unclean";
          record: {
            startedAt: string;
            lastSeenAt: string;
            uptimeMs: number;
            rssMiB: number;
            heapUsedMiB: number;
            pid: number;
            rebootedSince: boolean | null;
            detectedAt: string;
          };
        };
    uncleanExitCount?: number;
    sidecars?: SidecarHealthSection;
  }>({
    queryKey: ["health"],
    // Against a frozen host this fetch would otherwise pend forever, leaving
    // supportDiagnosticsPending true and the copy button disabled with no
    // explanation (#5657). A deadline turns that into a distinguishable error.
    queryFn: ({ signal }) => api.get("/health", { signal: requestTimeoutSignal(10_000, signal) }),
    staleTime: 60_000,
    // failureCount < 1 preserves the app-wide default of one retry (main.tsx);
    // only the timeout carve-out is new.
    retry: (failureCount, error) => !isRequestTimeoutError(error) && failureCount < 1,
  });
  // #5740: the report includes what Mari last reported acting on. Safari only
  // lets a tap write to the clipboard while the tap is handled, so this cannot
  // be fetched after the tap; it reloads whenever Settings opens instead. The
  // deadline keeps a frozen host from disabling the copy button (#5657).
  const settingsOpen = useUIStore((s) => s.rightPanelOpen && s.rightPanel === "settings");
  const mariStatus = useQuery<{ latestUnderstoodRequest?: SupportDiagnostics["mariActingOn"] }>({
    queryKey: ["professor-mari", "workspace-status"],
    queryFn: ({ signal }) =>
      api.get("/professor-mari/workspace/status", { signal: requestTimeoutSignal(5_000, signal) }),
    enabled: settingsOpen,
    staleTime: 0,
    retry: false,
  });
  const connections = (rawConnections ?? []) as APIConnection[];
  const activeConnection = activeChat?.connectionId
    ? (connections.find((connection) => connection.id === activeChat.connectionId) ?? null)
    : (connections.find((connection) => connection.isDefault) ?? null);
  // Health is included so a copy taken before the query settles cannot label
  // pending wake-lock/freeze telemetry as genuinely absent (#5656 review).
  const supportDiagnosticsPending =
    isConnectionsLoading || (!!activeChatId && isActiveChatLoading) || health.isPending || mariStatus.isPending;

  const handleCopySupportDiagnostics = useCallback(async () => {
    // Best-effort: a failed status request reads as unavailable, never blocks the copy.
    const mariActingOn = mariStatus.isError ? undefined : (mariStatus.data?.latestUnderstoodRequest ?? null);
    const report = formatSupportDiagnostics({
      clientRuntime: getClientRuntimeDiagnostics(),
      mariActingOn,
      // Distinguish "the server never answered" (frozen host) from ordinary
      // missing fields so support reports carry the signal (#5657): the
      // formatter renders every server telemetry line as unreachable.
      serverUnreachable: isRequestTimeoutError(health.error),
      version: health.data?.version ?? APP_VERSION,
      build: health.data?.build ?? APP_VERSION,
      commit: health.data?.commit ?? null,
      serverOs: health.data?.serverOs ?? "",
      serverMemory: health.data?.memory,
      wakeLock: health.data?.wakeLock ?? null,
      lastFreeze: health.data?.lastFreeze ?? null,
      // undefined (fetch failed) stays undefined so the report says
      // Unavailable instead of asserting a fate it never observed.
      previousSession: health.data?.previousSession,
      uncleanExitCount: health.data?.uncleanExitCount,
      // The server's own GPU and local model slots. Useful on its own for
      // "my local model won't load" reports, whether or not the user has
      // ever touched an activation question.
      sidecars: health.data?.sidecars,
      clientOs: resolveClientOs(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
      browser: navigator.userAgent,
      gpu: detectBrowserGpu(),
      connectionName: activeConnection?.name ?? null,
      connectionProvider: activeConnection?.provider ?? null,
      model: activeConnection?.model ?? null,
    });
    // Fenced so Discord and GitHub render the report as a code block (#6668). Discord only knows
    // ``` fences, so a backtick run inside the report (a connection name, Mari's phrase) is split
    // with a zero-width space instead of lengthening the fence.
    const copied = await copyToClipboard(
      `\`\`\`\n${report.replace(/``+/gu, (run) => run.split("").join("\u200b"))}\n\`\`\``,
    );
    if (copied) {
      toast.success(localizeUi("ui.panels.advancedsettings.supportDiagnosticsCopied"));
    } else {
      toast.error(localizeUi("ui.panels.advancedsettings.supportDiagnosticsCopyFailed"));
    }
  }, [activeConnection, health.data, health.error, localizeUi, mariStatus.data, mariStatus.isError]);

  const deleteBackupMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/backup/${name}`),
    onSuccess: () => {
      toast.success(localizeUi("ui.panels.advancedsettings.backupDeleted"));
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
  });

  const saveAdminSecret = useCallback(() => {
    const trimmed = adminSecret.trim();
    if (trimmed) {
      localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, trimmed);
      toast.success(localizeUi("ui.panels.advancedsettings.adminSecretSavedForThisBrowser"));
    } else {
      localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
      toast.info(localizeUi("ui.panels.advancedsettings.adminSecretCleared"));
    }
  }, [adminSecret, localizeUi]);

  const handleRestartServer = useCallback(async () => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("settings.serverRestart.confirm.title"),
      message: localizeUi("settings.serverRestart.confirm.message"),
      confirmLabel: localizeUi("settings.serverRestart.action"),
      cancelLabel: localizeUi("chat.delete.dialog.cancel"),
    });
    if (confirmed) restartServer.mutate();
  }, [localizeUi, restartServer]);

  type UpdateChannelId = "stable" | "staging";
  const [updateChannel, setUpdateChannel] = useState<UpdateChannelId | null>(null);
  const installedChannel = useQuery<{ channel: UpdateChannelId }>({
    queryKey: ["update-channel"],
    queryFn: () => api.get("/updates/channel"),
    staleTime: 30_000,
  });
  const updateCheck = useQuery<{
    currentVersion: string;
    currentCommit: string | null;
    currentBuild: string;
    channel: UpdateChannelId;
    channelLabel: string;
    currentBranch?: string | null;
    channels: Array<{
      id: UpdateChannelId;
      label: string;
      branch: string;
      targetRef: string;
      warning?: string | null;
    }>;
    targetRef: string;
    targetCommit: string | null;
    latestVersion: string;
    updateAvailable: boolean;
    versionUpdate?: boolean;
    commitsBehind?: number;
    releaseUrl: string;
    releaseNotes: string;
    publishedAt: string;
    releaseTag?: string;
    dockerImage?: string;
    dockerImageTag?: string;
    dockerLiteImageTag?: string | null;
    installType: "git" | "docker" | "standalone";
    serverPlatform?: "windows" | "macos" | "linux" | "android-termux" | "unknown";
    clientPlatform?: "ios" | "android" | "desktop" | "unknown";
    applyAvailable?: boolean;
    channelSwitch?: boolean;
    updatesApplyEnabled?: boolean;
    applyUnavailableReason?:
      "disabled" | "hard-disabled" | "dev-branch" | "unsupported-install" | "container-install" | null;
    manualUpdateCommand?: string | null;
    manualUpdateHint?: string | null;
  }>({
    queryKey: ["update-check", updateChannel ?? "current"],
    queryFn: () =>
      api.get(updateChannel ? `/updates/check?channel=${encodeURIComponent(updateChannel)}` : "/updates/check"),
    enabled: false,
    retry: false,
  });

  const selectedUpdateChannelId = updateChannel ?? updateCheck.data?.channel ?? installedChannel.data?.channel;

  const applyUpdate = useMutation({
    mutationFn: () =>
      api.post<{ status: string; message: string }>("/updates/apply", {
        confirm: true,
        channel: selectedUpdateChannelId,
        currentVersion: updateCheck.data?.currentVersion ?? health.data?.version ?? APP_VERSION,
        currentCommit: updateCheck.data?.currentCommit ?? health.data?.commit ?? null,
        targetRef: updateCheck.data?.targetRef,
        targetCommit: updateCheck.data?.targetCommit,
      }),
    onSuccess: (data) => {
      if (data.status === "already_up_to_date") {
        toast.info(data.message);
      } else {
        toast.success(data.message);
      }
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError &&
        err.payload &&
        typeof err.payload === "object" &&
        "message" in err.payload &&
        typeof err.payload.message === "string"
          ? err.payload.message
          : err instanceof Error
            ? err.message
            : "Update failed";
      toast.error(message);
    },
  });

  const updateChannelOptions = updateCheck.data?.channels ?? [
    { id: "stable" as const, label: "Latest Stable", branch: "main", targetRef: "origin/main", warning: null },
    {
      id: "staging" as const,
      label: "Staging/UAT",
      branch: "staging",
      targetRef: "origin/staging",
      warning: "Staging builds are pre-release tester builds. Back up your app data before applying them.",
    },
  ];
  const selectedUpdateChannel = updateChannelOptions.find((channel) => channel.id === selectedUpdateChannelId);
  const currentReleaseLabel = `v${health.data?.version ?? updateCheck.data?.currentVersion ?? APP_VERSION}`;
  const currentCommit = health.data?.commit ?? updateCheck.data?.currentCommit ?? null;
  const currentBuildLabel = currentCommit ? `Build: ${currentCommit.slice(0, 7)}` : "Build: unavailable";
  const commitsBehind = updateCheck.data?.commitsBehind ?? 0;
  const installType = updateCheck.data?.installType ?? "standalone";
  const isIosClient = updateCheck.data?.clientPlatform === "ios";
  const applyUnavailableReason = updateCheck.data?.applyUnavailableReason ?? null;
  const manualUpdateCommand = updateCheck.data?.manualUpdateCommand ?? null;
  const manualUpdateHint = updateCheck.data?.manualUpdateHint ?? null;
  const applyUnavailableCopy =
    applyUnavailableReason === "container-install"
      ? "Container installs cannot replace themselves from inside the browser. Pull the release image tag or latest image on the host, then restart the container."
      : applyUnavailableReason === "hard-disabled"
        ? "Applying updates from the browser is blocked for this server instance (UPDATES_APPLY_DISABLED). The dev and e2e launchers set this so a browser tab cannot rewrite a development checkout."
        : applyUnavailableReason === "dev-branch"
          ? "This checkout is on a development branch, so applying updates from the browser is blocked to protect work in progress. Update the checkout manually if you really intend to."
          : applyUnavailableReason === "disabled"
            ? "This install can check for updates, but applying them from the browser is disabled. Update manually with the command below. Advanced git installs can enable server-side apply with UPDATES_APPLY_ENABLED=true."
            : "This install can check for updates, but it cannot apply them from the browser. Relaunch the app if you use the launcher, or update manually for your install type.";
  const isClearing = clearAllData.isPending || expungeData.isPending;
  const isAllScopesSelected = selectedScopes.length === EXPUNGE_SCOPE_OPTIONS.length;

  const toggleScope = (scope: ExpungeScope) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((entry) => entry !== scope) : [...current, scope],
    );
  };

  const runExpunge = (mode: "selected" | "all") => {
    if (mode === "all") {
      clearAllData.mutate(undefined, {
        onSuccess: () =>
          toast.success(localizeUi("ui.panels.advancedsettings.allSelectedDataWasClearedRuntimeCachesWereReset")),
        onError: () => toast.error(localizeUi("ui.panels.advancedsettings.failedToClearAllData")),
        onSettled: () => setConfirmAction(null),
      });
      return;
    }

    expungeData.mutate(selectedScopes, {
      onSuccess: () =>
        toast.success(localizeUi("ui.panels.advancedsettings.selectedDataWasClearedRuntimeCachesWereResetImmediately")),
      onError: () => toast.error(localizeUi("ui.panels.advancedsettings.failedToClearSelectedData")),
      onSettled: () => setConfirmAction(null),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ExportFormatDialog
        open={exportProfileDialogOpen}
        title={localizeUi("settings.transfer.exportProfile.title")}
        description={localizeUi("settings.transfer.exportProfile.description")}
        nativeDescription="Keeps Marinara fields, lorebook folders, character/persona metadata, presets, agents, themes, and inline assets for re-import."
        compatibleDescription="Exports direct character JSON, simple persona JSON, and folderless lorebooks for other roleplay tools."
        onClose={() => setExportProfileDialogOpen(false)}
        onSelect={handleExportProfileChoice}
      />

      <SettingsIntro>
        {localizeUi("ui.panels.advancedsettings.serverMaintenanceMessageUtilitiesBackupsAndDataRemoval")}
      </SettingsIntro>
      <MultiplayerSettings />

      <SettingsSection
        title={localizeUi("settings.sections.adminAccess.title")}
        description={localizeUi("settings.sections.adminAccess.componentDescription")}
        icon={<Power size="0.875rem" />}
        {...getSettingsSectionAnchorProps("admin-access")}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder={localizeUi("ui.panels.advancedsettings.adminSecret")}
            className="w-full min-w-0 rounded-lg bg-[var(--background)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]"
          />
          <button
            type="button"
            onClick={saveAdminSecret}
            className={cn(SETTINGS_PRIMARY_FULL_BUTTON_CLASS, "whitespace-nowrap")}
          >
            <Save size="0.8125rem" />
            {localizeUi("ui.noodle.noodlehome.save")}
          </button>
          <SearchableSettingTarget controlId="restart-server" className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => void handleRestartServer()}
              disabled={restartServer.isPending}
              className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
            >
              {restartServer.isPending ? (
                <Loader2 size="0.8125rem" className="animate-spin" />
              ) : (
                <Power size="0.8125rem" />
              )}
              {restartServer.isPending
                ? localizeUi("settings.serverRestart.restarting")
                : localizeUi("settings.serverRestart.action")}
            </button>
            <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("settings.serverRestart.description")}
            </p>
          </SearchableSettingTarget>
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.features.title")}
        description={localizeUi("settings.sections.features.description")}
        icon={<ToggleRight size="0.875rem" />}
        {...getSettingsSectionAnchorProps("features")}
      >
        <FeatureSwitchesSettings anchorId={getSettingsControlAnchorId(FEATURE_SWITCHES_CONTROL_ID)} />
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.updates.title")}
        description={localizeUi("settings.sections.updates.componentDescription")}
        icon={<RefreshCw size="0.875rem" />}
        {...getSettingsSectionAnchorProps("updates")}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <label
              id={getSettingsControlAnchorId("release-channel")}
              className="flex scroll-mt-3 min-w-0 flex-col gap-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              {localizeUi("ui.panels.advancedsettings.releaseChannel")}
              <select
                value={selectedUpdateChannelId ?? ""}
                onChange={(event) => setUpdateChannel(event.target.value as UpdateChannelId)}
                className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs font-medium normal-case tracking-normal text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]"
              >
                {!selectedUpdateChannelId && (
                  <option value="" disabled>
                    {localizeUi("settings.updates.channelPending")}
                  </option>
                )}
                {updateChannelOptions.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => updateCheck.refetch()}
              disabled={updateCheck.isFetching}
              className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
            >
              {updateCheck.isFetching ? (
                <>
                  <Loader2 size="0.8125rem" className="animate-spin" />
                  {localizeUi("settings.notifications.customSound.status.loading")}
                </>
              ) : (
                <>
                  <RefreshCw size="0.8125rem" />
                  {localizeUi("ui.panels.advancedsettings.checkForUpdates")}
                </>
              )}
            </button>
            <div className="flex flex-col px-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              <span>
                {localizeUi("ui.panels.advancedsettings.release")} {currentReleaseLabel}
              </span>
              <span>{currentBuildLabel}</span>
              {updateCheck.data?.currentBranch && (
                <span>
                  {localizeUi("ui.panels.advancedsettings.branch")} {updateCheck.data.currentBranch}
                </span>
              )}
            </div>
          </div>

          {selectedUpdateChannel?.warning && (
            <div className="flex items-start gap-1.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2 text-[0.6875rem] text-[var(--primary)] ring-1 ring-[var(--primary)]/30">
              <AlertTriangle size="0.8125rem" className="mt-0.5 shrink-0" />
              <span>{selectedUpdateChannel.warning}</span>
            </div>
          )}

          {updateCheck.data && !updateCheck.data.updateAvailable && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-2 ring-1 ring-[var(--border)]">
              <Check size="0.8125rem" className="text-green-500 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs">
                  {localizeUi("ui.panels.advancedsettings.youReOnTheLatest")}{" "}
                  {updateCheck.data.channelLabel ?? "release"} {localizeUi("ui.panels.advancedsettings.target")}
                  {currentReleaseLabel})
                </span>
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{currentBuildLabel}</span>
              </div>
            </div>
          )}

          {updateCheck.data?.updateAvailable && (
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--secondary)] p-2.5 ring-1 ring-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {updateCheck.data.channelSwitch
                    ? localizeUi("ui.panels.advancedsettings.switchToValue1", {
                        value1: updateCheck.data.channelLabel,
                      })
                    : updateCheck.data.versionUpdate
                      ? localizeUi("ui.panels.advancedsettings.vValue1Available", {
                          value1: updateCheck.data.latestVersion,
                        })
                      : localizeUi("ui.panels.advancedsettings.value1CommitValue2BehindValue3", {
                          value1: commitsBehind,
                          value2: commitsBehind !== 1 ? localizeUi("ui.noodle.stageprofileview.s") : "",
                          value3: updateCheck.data.targetRef ?? localizeUi("ui.panels.advancedsettings.originMain"),
                        })}
                </span>
                {updateCheck.data.versionUpdate && (
                  <a
                    href={updateCheck.data.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[0.625rem] text-[var(--primary)] hover:underline"
                  >
                    {localizeUi("ui.panels.advancedsettings.releaseNotes")} <ExternalLink size="0.625rem" />
                  </a>
                )}
              </div>
              {updateCheck.data.versionUpdate && updateCheck.data.releaseNotes && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)] line-clamp-4 whitespace-pre-wrap">
                  {updateCheck.data.releaseNotes}
                </p>
              )}
              {commitsBehind > 0 && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.advancedsettings.commitCountsCompareThisBuildWith")}{" "}
                  {updateCheck.data.targetRef ?? "origin/main"}{" "}
                  {localizeUi("ui.panels.advancedsettings.andMayIncludeUnreleasedDevelopmentCommitsNotJustTagged")}
                </p>
              )}
              {isIosClient && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.advancedsettings.onIphoneOrIpadThisUpdatesTheMarinaraServer")}
                </p>
              )}
              {updateCheck.data.applyAvailable ? (
                <button
                  type="button"
                  onClick={() => applyUpdate.mutate()}
                  disabled={applyUpdate.isPending}
                  className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
                >
                  {applyUpdate.isPending ? (
                    <>
                      <Loader2 size="0.8125rem" className="animate-spin" />
                      {updateCheck.data.channelSwitch
                        ? localizeUi("ui.panels.advancedsettings.switching")
                        : localizeUi("ui.panels.advancedsettings.updating")}
                    </>
                  ) : (
                    <>
                      <Download size="0.8125rem" />
                      {updateCheck.data.channelSwitch
                        ? localizeUi("ui.panels.advancedsettings.switchToValue1", {
                            value1: updateCheck.data.channelLabel,
                          })
                        : localizeUi("ui.panels.advancedsettings.applyUpdate")}
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--background)]/60 p-2 ring-1 ring-[var(--border)]">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle size="0.8125rem" className="mt-0.5 shrink-0 text-amber-500" />
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{applyUnavailableCopy}</span>
                  </div>
                  {updateCheck.data.versionUpdate && (
                    <a
                      href={updateCheck.data.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
                    >
                      <Download size="0.8125rem" />
                      {localizeUi("ui.panels.advancedsettings.downloadV")}
                      {updateCheck.data.latestVersion}
                    </a>
                  )}
                  {updateCheck.data.versionUpdate && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.panels.advancedsettings.androidApkAssetsAreWebviewShellsNotStandaloneApps")}
                    </span>
                  )}
                  {manualUpdateHint && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">{manualUpdateHint}</span>
                  )}
                  {installType === "docker" && updateCheck.data.dockerImageTag && (
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.panels.advancedsettings.containerTag")}{" "}
                      <code className="break-all rounded bg-[var(--background)] px-1 py-0.5">
                        {updateCheck.data.dockerImageTag}
                      </code>
                      {updateCheck.data.dockerLiteImageTag ? (
                        <>
                          {" "}
                          {localizeUi("ui.panels.advancedsettings.lite")}{" "}
                          <code className="break-all rounded bg-[var(--background)] px-1 py-0.5">
                            {updateCheck.data.dockerLiteImageTag}
                          </code>
                        </>
                      ) : null}
                    </span>
                  )}
                  {manualUpdateCommand && <ManualUpdateCommand command={manualUpdateCommand} />}
                </div>
              )}
            </div>
          )}

          {updateCheck.isError && (
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-2.5 py-2 text-xs text-[var(--destructive)]">
              <AlertTriangle size="0.8125rem" className="shrink-0" />
              {localizeUi("ui.panels.advancedsettings.couldNotCheckForUpdatesTryAgainLater")}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleForceRefreshSpa()}
              disabled={refreshingSpa}
              className={cn(SETTINGS_PRIMARY_BUTTON_CLASS, "flex-1")}
            >
              {refreshingSpa ? (
                <>
                  <Loader2 size="0.8125rem" className="animate-spin" />
                  {localizeUi("ui.panels.advancedsettings.refreshing")}
                </>
              ) : (
                <>
                  <RefreshCw size="0.8125rem" />
                  {localizeUi("ui.panels.advancedsettings.refreshApp")}
                </>
              )}
            </button>
            <HelpTooltip
              side="bottom"
              text={localizeUi("ui.panels.advancedsettings.manualRefreshUnregistersTheActiveServiceWorkerAndClears")}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("ui.panels.advancedsettings.supportDiagnostics")}
        description={localizeUi("ui.panels.advancedsettings.supportDiagnosticsDescription")}
        icon={<LifeBuoy size="0.875rem" />}
        {...getSettingsSectionAnchorProps("support-diagnostics")}
      >
        <SearchableSettingTarget controlId="copy-support-diagnostics">
          <button
            type="button"
            onClick={() => void handleCopySupportDiagnostics()}
            disabled={supportDiagnosticsPending}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            <Copy size="0.8125rem" />
            {localizeUi("ui.panels.advancedsettings.copySupportDiagnostics")}
          </button>
        </SearchableSettingTarget>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.timeouts.title")}
        icon={<Gauge size="0.875rem" />}
        {...getSettingsSectionAnchorProps("request-timeouts")}
      >
        <RequestTimeoutSettings />
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.customGenerationParameters.title")}
        description={localizeUi("settings.customGenerationParameters.sectionDescription")}
        help={localizeUi("settings.customGenerationParameters.help")}
        icon={<SlidersHorizontal size="0.875rem" />}
        {...getSettingsSectionAnchorProps("parameters")}
      >
        <SearchableSettingTarget controlId="custom-generation-parameters">
          <CustomGenerationParametersSettings />
        </SearchableSettingTarget>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.messageTools.title")}
        description={localizeUi("settings.sections.messageTools.componentDescription")}
        icon={<MessageCircle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("message-tools")}
      >
        <div className="flex flex-col gap-2.5">
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-message-timestamps")}
            label={localizeUi("settings.controls.showTimestamps.label")}
            checked={showTimestamps}
            onChange={setShowTimestamps}
            help={localizeUi("settings.controls.showTimestamps.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-characters-in-persona-pickers")}
            label={localizeUi("settings.controls.showCharactersInPersonaPickers.label")}
            checked={showCharactersInPersonaPickers}
            onChange={setShowCharactersInPersonaPickers}
            help={localizeUi("settings.controls.showCharactersInPersonaPickers.description")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-model-name")}
            label={localizeUi("settings.controls.showModelName.label")}
            checked={showModelName}
            onChange={setShowModelName}
            help={localizeUi("settings.controls.showModelName.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-token-usage")}
            label={localizeUi("settings.controls.showTokenUsage.label")}
            checked={showTokenUsage}
            onChange={setShowTokenUsage}
            help={localizeUi("settings.controls.showTokenUsage.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-context-usage")}
            label={localizeUi("settings.controls.showContextUsage.label")}
            checked={showContextUsage}
            onChange={setShowContextUsage}
            help={localizeUi("settings.controls.showContextUsage.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("show-message-numbers")}
            label={localizeUi("settings.controls.showMessageNumbers.label")}
            checked={showMessageNumbers}
            onChange={setShowMessageNumbers}
            help={localizeUi("settings.controls.showMessageNumbers.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("guide-generations")}
            label={localizeUi("settings.controls.guideGenerations.label")}
            checked={guideGenerations}
            onChange={setGuideGenerations}
            help={localizeUi("settings.controls.guideGenerations.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("include-reasoning-in-exports")}
            label={localizeUi("settings.controls.includeReasoning.label")}
            checked={includeReasoningInExports}
            onChange={setIncludeReasoningInExports}
            help={localizeUi("settings.controls.includeReasoning.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("include-private-notes-in-exports")}
            label={localizeUi("settings.controls.includePrivateNotes.label")}
            checked={includePrivateNotesInExports}
            onChange={setIncludePrivateNotesInExports}
            help={localizeUi("settings.controls.includePrivateNotes.help")}
          />
          <ToggleSetting
            anchorId={getSettingsControlAnchorId("debug-mode")}
            label={localizeUi("settings.controls.debugMode.label")}
            checked={debugMode}
            onChange={setDebugMode}
            help={localizeUi("settings.controls.debugMode.help")}
          />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1" title={nativeConsoleHelp}>
              <button
                type="button"
                onClick={handleOpenNativeConsole}
                disabled={!canOpenNativeConsole}
                className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
              >
                <Terminal size="0.8125rem" className="shrink-0" />
                <span>{localizeUi("ui.panels.advancedsettings.openConsole")}</span>
              </button>
            </div>
            <HelpTooltip side="bottom" text={nativeConsoleHelp} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.backupExport.title")}
        description={localizeUi("settings.sections.backupExport.componentDescription")}
        help={localizeUi("settings.transfer.fullBackup.help")}
        icon={<Download size="0.875rem" />}
        {...getSettingsSectionAnchorProps("backup-export")}
      >
        <div className="flex flex-col gap-2">
          {automaticBackupQuery.data && (
            <div className="rounded-lg border border-[var(--border)]/70 bg-[var(--secondary)]/35 p-2.5">
              <ToggleSetting
                anchorId={getSettingsControlAnchorId("automatic-backups")}
                label={localizeUi("ui.panels.advancedsettings.automaticBackups")}
                help={localizeUi("ui.panels.advancedsettings.automaticBackupsDescription")}
                checked={automaticBackupQuery.data.enabled}
                onChange={(enabled) => updateAutomaticBackup({ enabled })}
                disabled={automaticBackupMutation.isPending}
              />
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(["daily", "weekly", "monthly"] as const).map((frequency) => (
                  <button
                    key={frequency}
                    type="button"
                    onClick={() => updateAutomaticBackup({ frequency })}
                    disabled={automaticBackupMutation.isPending}
                    aria-pressed={automaticBackupQuery.data.frequency === frequency}
                    className={SETTINGS_BUTTON_CLASS}
                  >
                    {localizeUi(`ui.panels.advancedsettings.automaticBackupFrequency.${frequency}`)}
                  </button>
                ))}
              </div>
              <div
                id={getSettingsControlAnchorId("automatic-backups-kept")}
                className="mt-2 grid scroll-mt-3 gap-2 border-t border-[var(--border)]/60 pt-2 sm:grid-cols-[minmax(0,1fr)_5.5rem] sm:items-center"
              >
                <div className="min-w-0">
                  <label
                    htmlFor="automatic-backup-retention-count"
                    className="text-[0.6875rem] font-medium text-[var(--foreground)]"
                  >
                    {localizeUi("ui.panels.advancedsettings.automaticBackupsKept")}
                  </label>
                  <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.advancedsettings.automaticBackupsKeptDescription")}
                  </p>
                </div>
                <DraftNumberInput
                  id="automatic-backup-retention-count"
                  value={automaticBackupQuery.data.retentionCount}
                  min={1}
                  max={9999}
                  selectOnFocus
                  disabled={automaticBackupMutation.isPending}
                  onCommit={(retentionCount) => updateAutomaticBackup({ retentionCount })}
                  ariaLabel={localizeUi("ui.panels.advancedsettings.automaticBackupsKeptAriaLabel")}
                  className="mari-chrome-field h-9 w-full px-2 text-right text-xs tabular-nums"
                />
              </div>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {automaticBackupQuery.data.lastError
                  ? localizeUi("ui.panels.advancedsettings.automaticBackupErrorValue1", {
                      value1: automaticBackupQuery.data.lastError,
                    })
                  : automaticBackupQuery.data.lastBackupAt
                    ? localizeUi("ui.panels.advancedsettings.lastAutomaticBackupValue1", {
                        value1: new Date(automaticBackupQuery.data.lastBackupAt).toLocaleString(),
                      })
                    : automaticBackupQuery.data.enabled
                      ? localizeUi("ui.panels.advancedsettings.automaticBackupWillBeCreatedShortly")
                      : localizeUi("ui.panels.advancedsettings.automaticBackupsAreOff")}
              </p>
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-[var(--background)]/45 px-2 py-1.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/60">
                <FolderOpen size="0.75rem" className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <p>{localizeUi("settings.transfer.automaticBackup.location")}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            {creatingBackup ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                {localizeUi("ui.panels.advancedsettings.creatingBackup")}
              </>
            ) : (
              <>
                <Download size="0.8125rem" />
                {localizeUi("ui.panels.advancedsettings.downloadBackup")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setExportProfileDialogOpen(true)}
            disabled={exportingProfile}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            {exportingProfile ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                {localizeUi("ui.panels.advancedsettings.exporting")}
              </>
            ) : (
              <>
                <Upload size="0.8125rem" />
                {localizeUi("settings.transfer.exportProfile.title")}
              </>
            )}
          </button>
          {backups && backups.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.advancedsettings.existingBackups")}
              </span>
              {backups.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 ring-1 ring-[var(--border)]"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[0.6875rem] font-medium truncate">{b.name}</span>
                    <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                      {new Date(b.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBackupMutation.mutate(b.name)}
                    aria-label={localizeUi("settings.actions.deleteBackup")}
                    title={localizeUi("settings.actions.deleteBackup")}
                    className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger ml-2")}
                  >
                    <Trash2 size="0.75rem" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.storageOptimization.title")}
        description={localizeUi("settings.sections.storageOptimization.componentDescription")}
        icon={<HardDrive size="0.875rem" />}
        {...getSettingsSectionAnchorProps("storage-optimization")}
      >
        <SearchableSettingTarget controlId="avatar-storage-optimization" className="flex flex-col gap-2">
          <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("settings.storageOptimization.description")}
          </p>
          <button
            type="button"
            onClick={() => scanAvatarStorage.mutate()}
            disabled={scanAvatarStorage.isPending || cleanAvatarStorage.isPending}
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
          >
            {scanAvatarStorage.isPending ? (
              <Loader2 size="0.8125rem" className="animate-spin" />
            ) : (
              <Search size="0.8125rem" />
            )}
            {scanAvatarStorage.isPending
              ? localizeUi("settings.storageOptimization.scanning")
              : localizeUi("settings.storageOptimization.action.check")}
          </button>
          {avatarStorageSummary && (
            <div className="rounded-lg bg-[var(--background)]/55 p-2.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {avatarStorageSummary.files > 0
                ? localizeUi("settings.storageOptimization.found", {
                    count: avatarStorageSummary.files,
                    minutes: avatarStorageSummary.minimumAgeMinutes,
                    size: formatStorageBytes(avatarStorageSummary.bytes),
                  })
                : localizeUi("settings.storageOptimization.clean")}
            </div>
          )}
          {avatarStorageSummary && avatarStorageSummary.files > 0 && (
            <button
              type="button"
              onClick={() => void handleDeleteAbandonedAvatars()}
              disabled={cleanAvatarStorage.isPending || scanAvatarStorage.isPending}
              className={cn(SETTINGS_PRIMARY_FULL_BUTTON_CLASS, "mari-chrome-control--danger")}
            >
              {cleanAvatarStorage.isPending ? (
                <Loader2 size="0.8125rem" className="animate-spin" />
              ) : (
                <Trash2 size="0.8125rem" />
              )}
              {cleanAvatarStorage.isPending
                ? localizeUi("settings.storageOptimization.deleting")
                : localizeUi("settings.storageOptimization.action.delete")}
            </button>
          )}
        </SearchableSettingTarget>
      </SettingsSection>

      <SettingsSection
        title={localizeUi("settings.sections.dangerZone.title")}
        description={localizeUi("settings.sections.dangerZone.componentDescription")}
        icon={<AlertTriangle size="0.875rem" />}
        {...getSettingsSectionAnchorProps("danger-zone")}
      >
        <div className="flex flex-col gap-2">
          <div className="grid gap-2">
            {EXPUNGE_SCOPE_OPTIONS.map((scope) => {
              const checked = selectedScopes.includes(scope.id);
              return (
                <label
                  key={scope.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 ring-1 transition-colors",
                    checked
                      ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
                      : "bg-[var(--background)]/40 ring-[var(--border)] hover:bg-[var(--accent)]/70",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isClearing}
                    onChange={() => toggleScope(scope.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-[var(--marinara-chat-chrome-panel-text)]">
                      {scope.label}
                    </span>
                    <span className="block text-[0.625rem] text-[var(--muted-foreground)]">{scope.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedScopes(isAllScopesSelected ? [] : EXPUNGE_SCOPE_OPTIONS.map((scope) => scope.id))
              }
              disabled={isClearing}
              className={cn(SETTINGS_BUTTON_CLASS, "w-full")}
            >
              {isAllScopesSelected
                ? localizeUi("ui.panels.advancedsettings.clearSelection")
                : localizeUi("ui.panels.advancedsettings.selectAll")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("selected")}
              disabled={selectedScopes.length === 0 || isClearing}
              className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--danger w-full")}
            >
              <Trash2 size="0.75rem" />
              {localizeUi("ui.panels.advancedsettings.clearSelectedData")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("all")}
              disabled={isClearing}
              className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--danger w-full")}
            >
              <Trash2 size="0.75rem" />
              {localizeUi("ui.panels.advancedsettings.clearAllData")}
            </button>
          </div>
          {confirmAction && (
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--background)]/55 p-2.5 ring-1 ring-[var(--border)]">
              <div className="flex items-start gap-2 text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-text)]">
                <AlertTriangle
                  size="0.875rem"
                  className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]"
                />
                {confirmAction === "all"
                  ? localizeUi("ui.panels.advancedsettings.deleteAllSupportedDataCategoriesExceptProfessorMariThere")
                  : localizeUi("ui.panels.advancedsettings.deleteSelectedDataCategories", {
                      count: selectedScopes.length,
                    })}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isClearing}
                  className={cn(SETTINGS_BUTTON_CLASS, "w-full")}
                >
                  {localizeUi("chat.delete.dialog.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => runExpunge(confirmAction)}
                  disabled={isClearing}
                  className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--danger w-full")}
                >
                  {isClearing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Trash2 size="0.75rem" />}
                  {localizeUi("ui.panels.advancedsettings.confirmDelete")}
                </button>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/45 p-2.5">
            <ToggleSetting
              label={t("settings.agentImports.toggle.label")}
              checked={agentImportPolicy?.enabled ?? false}
              onChange={(enabled) => void handleAgentImportsToggle(enabled)}
              disabled={agentImportPolicyLoading || setAgentImportsEnabled.isPending}
              help={t("settings.agentImports.toggle.help")}
            />
            <div className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-[var(--primary)]">
              <ShieldAlert size="0.875rem" className="mt-0.5 shrink-0" />
              <p>{t("settings.agentImports.warning")}</p>
            </div>
            <div className="my-1 border-t border-[var(--border)]" />
            <ToggleSetting
              label={t("settings.externalExtensions.toggle.label")}
              checked={extensionPolicy?.externalExtensionsEnabled ?? false}
              onChange={(enabled) => void handleExternalExtensionsToggle(enabled)}
              disabled={
                extensionPolicyLoading ||
                setExternalExtensionsEnabled.isPending ||
                !extensionPolicy?.externalExtensionsEnvEnabled
              }
              help={
                extensionPolicy?.externalExtensionsEnvEnabled
                  ? t("settings.externalExtensions.toggle.help")
                  : t("settings.externalExtensions.toggle.locked")
              }
            />
            <div className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-[var(--primary)]">
              <ShieldAlert size="0.875rem" className="mt-0.5 shrink-0" />
              <p>{t("settings.externalExtensions.warning")}</p>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
